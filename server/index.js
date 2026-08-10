// =============================================================================
// Fight Kingdom — Multiplayer Server (Socket.IO)
// Client-authoritative relay: clients simulate gameplay, this server relays
// state, assigns teams/slots, confirms hits (tracks HP), runs match timers,
// and manages Bounty gems / Knockout rounds.
// Protocol matches src/scripts/networkManager.js on the client.
// =============================================================================

'use strict';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '*').split(',').map(s => s.trim());

const MODES = {
    '3V3_BOUNTY': { teams: 2, perTeam: 3, max: 6, duration: 180 },
    '3V3_KNOCKOUT': { teams: 2, perTeam: 3, max: 6, duration: 60, rounds: true },
    'FFA': { teams: 0, perTeam: 0, max: 8, duration: 180 }
};

const GEM_SPAWN_INTERVAL = 7.0;
const TARGET_GEMS = 15;
const GEM_COUNTDOWN = 15;
const KNOCKOUT_TARGET_WINS = 3;

const app = express();
app.use(express.json());
app.get('/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: CORS_ORIGINS, methods: ['GET', 'POST'] },
    transports: ['websocket']
});

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let matchmakingQueues = {};   // mode -> [socketIds]
let rooms = {};               // roomId -> Room
let matches = {};             // roomId -> Match
let nextRoomId = 100000;

// Socket -> { name, brawler, skinKey, mode, roomId, matchRoomId }
const playerMeta = new Map();

function roomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
}

// ---------------------------------------------------------------------------
// Match helpers
// ---------------------------------------------------------------------------

function createMatch(roomId, mode, sockets) {
    const cfg = MODES[mode];
    const match = {
        roomId,
        mode,
        cfg,
        players: {},        // socketId -> { hp, maxHp, x, z, r, s, brawler, skinKey, name, team, isDead, gems }
        startedAt: Date.now(),
        timeLeft: cfg.duration,
        timer: null,
        gemTimer: null,
        gems: {},           // gemId -> { x, z }
        gemIdSeq: 0,
        blueGems: 0,
        redGems: 0,
        blueWins: 0,
        redWins: 0,
        round: 1,
        roundOver: false,
        gameOver: false,
        hitSeq: {}          // per-target last hp for dedupe
    };

    sockets.forEach((socket, index) => {
        const meta = playerMeta.get(socket.id) || {};
        const team = cfg.teams ? (index < cfg.perTeam ? 'blue' : 'red') : 'ffa';
        match.players[socket.id] = {
            hp: 3000,
            maxHp: 3000,
            x: 0,
            z: 0,
            r: 0,
            s: 0,
            brawler: meta.brawler || 'guanyu',
            skinKey: meta.skinKey || '',
            name: meta.name || 'Fighter',
            team,
            isDead: false,
            gems: 0
        };
    });

    return match;
}

function broadcastMatch(match, event, payload) {
    Object.keys(match.players).forEach(sid => {
        const socket = io.sockets.sockets.get(sid);
        if (socket && socket.connected) socket.emit(event, payload);
    });
}

function fullStatePayload(match) {
    const players = Object.keys(match.players).map(sid => {
        const p = match.players[sid];
        return {
            id: sid,
            name: p.name,
            brawler: p.brawler,
            skinKey: p.skinKey,
            team: p.team,
            x: p.x, z: p.z, r: p.r, s: p.s,
            hp: p.hp,
            maxHp: p.maxHp,
            isDead: p.isDead
        };
    });
    return { players, activeGems: Object.keys(match.gems).map(id => ({ id, x: match.gems[id].x, z: match.gems[id].z })) };
}

function sendTeamScore(match) {
    if (match.mode !== '3V3_BOUNTY') return;
    broadcastMatch(match, 'gemPicked', {
        blueGems: match.blueGems,
        redGems: match.redGems,
        target: TARGET_GEMS
    });
}

function endMatch(match, winnerTeam) {
    if (match.gameOver) return;
    match.gameOver = true;
    stopMatchTimers(match);
    broadcastMatch(match, 'game_over', { winner: winnerTeam || null });
    const roomId = match.roomId;
    setTimeout(() => {
        delete matches[roomId];
        if (rooms[roomId]) delete rooms[roomId];
    }, 10000);
}

function checkBountyVictory(match) {
    if (match.mode !== '3V3_BOUNTY' || match.gameOver) return;
    if (match.blueGems >= TARGET_GEMS || match.redGems >= TARGET_GEMS) {
        let winner = match.blueGems >= TARGET_GEMS ? 'blue' : 'red';
        let timer = 0;
        const interval = setInterval(() => {
            timer += 1;
            if (match.gameOver) { clearInterval(interval); return; }
            if (timer >= GEM_COUNTDOWN) {
                clearInterval(interval);
                endMatch(match, winner);
            }
        }, 1000);
    }
}

function checkRoundWinner(match) {
    if (!match.cfg.rounds || match.gameOver || match.roundOver) return;
    const teams = { blue: 0, red: 0 };
    Object.values(match.players).forEach(p => {
        if (!p.isDead && p.team !== 'ffa') teams[p.team]++;
    });
    let winner = null;
    if (teams.blue === 0 && teams.red === 0) winner = null;
    else if (teams.blue === 0) winner = 'red';
    else if (teams.red === 0) winner = 'blue';

    if (winner) {
        match.roundOver = true;
        if (winner === 'blue') match.blueWins++; else match.redWins++;
        broadcastMatch(match, 'server:knockoutScore', { blueWins: match.blueWins, redWins: match.redWins });
        broadcastMatch(match, 'server:roundOver', { round: match.round, winner });

        setTimeout(() => {
            if (match.blueWins >= KNOCKOUT_TARGET_WINS || match.redWins >= KNOCKOUT_TARGET_WINS) {
                endMatch(match, winner);
                return;
            }
            match.round++;
            match.roundOver = false;
            Object.keys(match.players).forEach(sid => {
                const p = match.players[sid];
                p.hp = p.maxHp;
                p.isDead = false;
                p.gems = 0;
                p.x = 0; p.z = 0; p.r = 0; p.s = 0;
            });
            match.timeLeft = match.cfg.duration;
            broadcastMatch(match, 'server:roundStart');
            broadcastMatch(match, 'server:fullStateSync', fullStatePayload(match));
        }, 4000);
    }
}

function startMatchTimer(match) {
    stopMatchTimers(match);
    match.timeLeft = match.cfg.duration;
    match.timer = setInterval(() => {
        match.timeLeft -= 1;
        if (match.timeLeft <= 0) {
            stopMatchTimers(match);
            match.timeLeft = 0;
            if (match.cfg.rounds) {
                checkRoundWinner(match);
                if (match.roundOver) return;
                endMatch(match, null);
                return;
            }
            endMatch(match, null);
            return;
        }
        broadcastMatch(match, 'syncTimer', match.timeLeft);
    }, 1000);

    if (match.mode === '3V3_BOUNTY') {
        match.gemTimer = setInterval(() => {
            if (match.gameOver) return;
            spawnGems(match);
        }, GEM_SPAWN_INTERVAL * 1000);
        spawnGems(match);
    }
}

function spawnGems(match) {
    const count = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) {
        const gemId = 'gem_' + (++match.gemIdSeq);
        const x = (Math.random() * 2 - 1) * 9;
        const z = (Math.random() * 2 - 1) * 8;
        match.gems[gemId] = { x, z };
        broadcastMatch(match, 'spawnGem', { gemId, x, z });
    }
}

function dropPlayerGems(match, sid) {
    const p = match.players[sid];
    if (!p || p.gems <= 0) return;
    const gems = [];
    for (let i = 0; i < p.gems; i++) {
        const gemId = 'gem_' + (++match.gemIdSeq);
        const x = p.x + (Math.random() * 2 - 1);
        const z = p.z + (Math.random() * 2 - 1);
        match.gems[gemId] = { x, z };
        gems.push({ gemId, x, z });
    }
    p.gems = 0;
    if (gems.length) broadcastMatch(match, 'dropGems', { gems, playerId: sid });
}

function stopMatchTimers(match) {
    if (match.timer) clearInterval(match.timer);
    if (match.gemTimer) clearInterval(match.gemTimer);
    match.timer = null;
    match.gemTimer = null;
}

function handlePlayerDisconnect(socket) {
    const meta = playerMeta.get(socket.id);
    if (meta) {
        removeFromMatchmaking(socket.id);
        if (meta.roomId && rooms[meta.roomId]) {
            removeFromRoom(socket.id, meta.roomId);
        }
        if (meta.matchRoomId && matches[meta.matchRoomId]) {
            const match = matches[meta.matchRoomId];
            if (match.players[socket.id]) {
                if (match.mode === '3V3_BOUNTY') dropPlayerGems(match, socket.id);
                delete match.players[socket.id];
                broadcastMatch(match, 'enemyDisconnected', socket.id);
                const alive = Object.values(match.players).filter(p => !p.isDead).length;
                if (Object.keys(match.players).length === 0) {
                    stopMatchTimers(match);
                    delete matches[meta.matchRoomId];
                } else if (match.cfg.rounds && !match.roundOver) {
                    checkRoundWinner(match);
                }
            }
        }
        playerMeta.delete(socket.id);
    }
}

function removeFromMatchmaking(socketId) {
    for (const mode in matchmakingQueues) {
        const q = matchmakingQueues[mode];
        const i = q.indexOf(socketId);
        if (i !== -1) q.splice(i, 1);
        if (q.length === 0) delete matchmakingQueues[mode];
    }
}

// ---------------------------------------------------------------------------
// Private rooms
// ---------------------------------------------------------------------------

function createRoom(socket, data) {
    const mode = normalizeMode(data.mode);
    const roomId = 'R' + (nextRoomId++) + '_' + roomCode();
    rooms[roomId] = {
        id: roomId,
        code: roomId.split('_')[1],
        mode,
        hostId: socket.id,
        players: [{
            id: socket.id,
            name: data.playerName || 'Fighter',
            brawler: data.brawler || 'guanyu',
            skinKey: data.skinKey || '',
            team: 'blue',
            slot: 0,
            ready: false
        }]
    };
    const meta = playerMeta.get(socket.id) || {};
    meta.roomId = roomId;
    meta.name = data.playerName || meta.name || 'Fighter';
    meta.brawler = data.brawler || 'guanyu';
    meta.skinKey = data.skinKey || '';
    meta.mode = mode;
    playerMeta.set(socket.id, meta);

    socket.join(roomId);
    socket.emit('room_created', { roomId, code: rooms[roomId].code, mode });
    emitRoomUpdate(roomId);
}

function joinRoom(socket, data) {
    const room = findRoomByCode(data.roomId || data.code || '');
    if (!room) {
        socket.emit('room_error', 'Room not found');
        return;
    }
    if (room.players.length >= MODES[room.mode].max) {
        socket.emit('room_error', 'Room is full');
        return;
    }
    const meta = playerMeta.get(socket.id) || {};
    const slot = room.players.length;
    room.players.push({
        id: socket.id,
        name: data.playerName || 'Fighter',
        brawler: data.brawler || 'guanyu',
        skinKey: data.skinKey || '',
        team: slot < MODES[room.mode].perTeam ? 'blue' : 'red',
        slot,
        ready: false
    });
    meta.roomId = room.id;
    meta.name = data.playerName || meta.name || 'Fighter';
    meta.brawler = data.brawler || 'guanyu';
    meta.skinKey = data.skinKey || '';
    playerMeta.set(socket.id, meta);
    socket.join(room.id);
    socket.emit('room_joined', { roomId: room.id, code: room.code, mode: room.mode });
    emitRoomUpdate(room.id);
}

function findRoomByCode(code) {
    const c = String(code || '').trim().toUpperCase();
    if (rooms[c]) return rooms[c];
    for (const id in rooms) {
        if (rooms[id].code === c) return rooms[id];
    }
    return null;
}

function emitRoomUpdate(roomId) {
    const room = rooms[roomId];
    if (!room) return;
    io.to(roomId).emit('room_update', {
        roomId,
        code: room.code,
        mode: room.mode,
        hostId: room.hostId,
        players: room.players
    });
}

function removeFromRoom(socketId, roomId) {
    const room = rooms[roomId];
    if (!room) return;
    room.players = room.players.filter(p => p.id !== socketId);
    if (room.players.length === 0) {
        delete rooms[roomId];
        return;
    }
    if (room.hostId === socketId) room.hostId = room.players[0].id;
    // rebalance teams
    room.players.forEach((p, i) => {
        p.slot = i;
        p.team = i < MODES[room.mode].perTeam ? 'blue' : 'red';
    });
    emitRoomUpdate(roomId);
}

// ---------------------------------------------------------------------------
// Matchmaking
// ---------------------------------------------------------------------------

function joinMatchmaking(socket, data) {
    const mode = normalizeMode(data.mode);
    const meta = playerMeta.get(socket.id) || {};
    meta.name = data.playerName || meta.name || 'Fighter';
    meta.brawler = data.brawler || 'guanyu';
    meta.skinKey = data.skinKey || '';
    meta.mode = mode;
    playerMeta.set(socket.id, meta);

    removeFromMatchmaking(socket.id);

    if (!matchmakingQueues[mode]) matchmakingQueues[mode] = [];
    const queue = matchmakingQueues[mode];

    // backfill bots? No — clients spawn their own bots when server reports
    // a partial match. Send match_found immediately if at least 2 players.
    queue.push(socket.id);
    socket.emit('matchmaking_status', { team: 'blue', slot: queue.length - 1, queued: queue.length });

    const cfg = MODES[mode];
    if (queue.length >= cfg.max) {
        const group = queue.splice(0, cfg.max);
        delete matchmakingQueues[mode];
        startMatch(mode, group);
    }
}

function startMatch(mode, socketIds) {
    const roomId = 'M' + (nextRoomId++);
    const sockets = socketIds.map(id => io.sockets.sockets.get(id)).filter(s => s && s.connected);
    if (sockets.length < 2) return;

    const match = createMatch(roomId, mode, sockets);
    matches[roomId] = match;

    sockets.forEach(socket => {
        const meta = playerMeta.get(socket.id) || {};
        meta.matchRoomId = roomId;
        meta.roomId = null;
        playerMeta.set(socket.id, meta);
        const p = match.players[socket.id];
        socket.emit('match_found', {
            roomId,
            mode,
            team: p.team,
            slot: Object.keys(match.players).indexOf(socket.id)
        });
    });

    setTimeout(() => {
        if (!matches[roomId] || match.gameOver) return;
        broadcastMatch(match, 'game_start', { mode });
        broadcastMatch(match, 'server:fullStateSync', fullStatePayload(match));
        startMatchTimer(match);
    }, 3000);
}

// ---------------------------------------------------------------------------
// Socket handlers
// ---------------------------------------------------------------------------

function normalizeMode(mode) {
    const m = String(mode || 'FFA').trim().toUpperCase().replace(/\s+/g, '_');
    if (m === '3V3BOUNTY') return '3V3_BOUNTY';
    if (m === '3V3KNOCKOUT') return '3V3_KNOCKOUT';
    return m;
}

function relay(event, outEvent) {
    return (socket, payload) => {
        const meta = playerMeta.get(socket.id);
        const match = meta && meta.matchRoomId ? matches[meta.matchRoomId] : null;
        if (!match) return;
        payload = payload || {};
        payload.id = socket.id;
        Object.keys(match.players).forEach(sid => {
            if (sid === socket.id) return;
            const s = io.sockets.sockets.get(sid);
            if (s && s.connected) s.emit(outEvent, payload);
        });
    };
}

function onPlayerMovement(socket, data) {
    const meta = playerMeta.get(socket.id);
    const match = meta && meta.matchRoomId ? matches[meta.matchRoomId] : null;
    if (!match || !data) return;
    const p = match.players[socket.id];
    if (p) {
        p.x = data.x; p.z = data.z; p.r = data.r; p.s = data.s;
    }
    data.id = socket.id;
    Object.keys(match.players).forEach(sid => {
        if (sid === socket.id) return;
        const s = io.sockets.sockets.get(sid);
        if (s && s.connected) s.emit('enemyMoved', data);
    });
}

function onPlayerHit(socket, data) {
    const meta = playerMeta.get(socket.id);
    const match = meta && meta.matchRoomId ? matches[meta.matchRoomId] : null;
    if (!match || !data || match.gameOver) return;
    const targetId = data.targetId;
    const target = match.players[targetId];
    const shooter = match.players[socket.id];
    if (!target || !shooter || target.isDead) return;

    const damage = Math.max(1, Math.min(Number(data.damage) || 0, 9999));
    target.hp = Math.max(0, target.hp - damage);
    const isDead = target.hp <= 0;

    broadcastMatch(match, 'server:confirmHit', {
        targetId,
        shooterId: socket.id,
        damage,
        isDead,
        currentHp: target.hp,
        shooterBrawler: shooter.brawler,
        targetBrawler: target.brawler
    });

    if (isDead) {
        target.isDead = true;
        if (match.mode === '3V3_BOUNTY') dropPlayerGems(match, targetId);
        if (match.cfg.rounds && !match.roundOver) checkRoundWinner(match);
    }
}

function onGemPicked(socket, data) {
    const meta = playerMeta.get(socket.id);
    const match = meta && meta.matchRoomId ? matches[meta.matchRoomId] : null;
    if (!match || match.mode !== '3V3_BOUNTY' || !data) return;
    const p = match.players[socket.id];
    const gem = data.gemId ? match.gems[data.gemId] : null;
    if (!p || p.isDead || match.gameOver) return;
    if (gem) delete match.gems[data.gemId];

    p.gems++;
    if (p.team === 'blue') match.blueGems++; else if (p.team === 'red') match.redGems++;

    broadcastMatch(match, 'gemPicked', {
        gemId: data.gemId,
        playerId: socket.id,
        blueGems: match.blueGems,
        redGems: match.redGems
    });
    checkBountyVictory(match);
}

function onPlayerRespawn(socket) {
    const meta = playerMeta.get(socket.id);
    const match = meta && meta.matchRoomId ? matches[meta.matchRoomId] : null;
    if (!match || match.gameOver) return;
    const p = match.players[socket.id];
    if (!p) return;
    p.hp = p.maxHp;
    p.isDead = false;
    p.x = 0; p.z = 0; p.r = 0; p.s = 0;
    broadcastMatch(match, 'enemyRespawned', { id: socket.id, x: 0, z: 0 });
}

function onRequestFullSync(socket) {
    const meta = playerMeta.get(socket.id);
    const match = meta && meta.matchRoomId ? matches[meta.matchRoomId] : null;
    if (!match) return;
    socket.emit('server:fullStateSync', fullStatePayload(match));
}

function onStartRoomGame(socket, data) {
    const meta = playerMeta.get(socket.id);
    const room = meta && meta.roomId ? rooms[meta.roomId] : null;
    if (!room) return;
    if (room.hostId !== socket.id) {
        socket.emit('room_error', 'Only the host can start the game');
        return;
    }
    const players = room.players.map(p => io.sockets.sockets.get(p.id)).filter(s => s && s.connected);
    if (players.length < 2) {
        socket.emit('room_error', 'Need at least 2 players');
        return;
    }
    // move room players into a match
    const match = createMatch(room.id, room.mode, players);
    matches[room.id] = match;
    players.forEach(s => {
        const m = playerMeta.get(s.id) || {};
        m.matchRoomId = room.id;
        m.roomId = null;
        playerMeta.set(s.id, m);
    });
    delete rooms[room.id];
    broadcastMatch(match, 'game_start', { mode: match.mode, room: true });
    broadcastMatch(match, 'server:fullStateSync', fullStatePayload(match));
    startMatchTimer(match);
}

// ---------------------------------------------------------------------------
// Socket wiring
// ---------------------------------------------------------------------------

io.on('connection', (socket) => {
    const queryName = socket.handshake.query && socket.handshake.query.playerName;
    playerMeta.set(socket.id, {
        name: queryName ? decodeURIComponent(String(queryName)) : 'Fighter',
        brawler: 'guanyu',
        skinKey: '',
        mode: 'FFA',
        roomId: null,
        matchRoomId: null
    });

    socket.on('join_matchmaking', data => joinMatchmaking(socket, data || {}));
    socket.on('cancel_matchmaking', () => removeFromMatchmaking(socket.id));
    socket.on('create_room', data => createRoom(socket, data || {}));
    socket.on('join_room', data => joinRoom(socket, data || {}));
    socket.on('start_room_game', data => onStartRoomGame(socket, data || {}));
    socket.on('switch_team', socket => {
        const meta = playerMeta.get(socket.id);
        const room = meta && meta.roomId ? rooms[meta.roomId] : null;
        if (!room) return;
        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;
        player.team = player.team === 'blue' ? 'red' : 'blue';
        emitRoomUpdate(room.id);
    });
    socket.on('client_ready', () => { /* reserved */ });

    socket.on('playerMovement', data => onPlayerMovement(socket, data));
    socket.on('playerShoot', data => relay('playerShoot', 'enemyShot')(socket, data));
    socket.on('playerRoll', data => relay('playerRoll', 'enemyRoll')(socket, data));
    socket.on('playerState', data => relay('playerState', 'enemyState')(socket, data));
    socket.on('playerHit', data => onPlayerHit(socket, data));
    socket.on('playerRespawn', () => onPlayerRespawn(socket));
    socket.on('gemPicked', data => onGemPicked(socket, data));
    socket.on('requestFullSync', () => onRequestFullSync(socket));

    socket.on('disconnect', () => handlePlayerDisconnect(socket));
});

server.listen(PORT, () => {
    console.log(`[FightKingdom] server listening on port ${PORT}`);
});
