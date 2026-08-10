var NetworkManager = pc.createScript('networkManager');

NetworkManager.attributes.add('serverUrl', {
    type: 'string',
    default: 'http://localhost:3000',
    title: 'Server URL (Fight Kingdom multiplayer server)'
});

NetworkManager.prototype.initialize = function() {
    this.app.networkManager = this;
    this.socket = null;
    this.playerName = 'Unknown'; 
    this.currentBrawler = 'guanyu';
    this.currentSkinKey = '';
    this.currentMode = '3V3_BOUNTY';
    
    this.app.on('network:requestJoin', this._onRequestMatchmaking, this);
    this.app.on('network:clientReady', this._onClientReady, this);
    this.app.on('network:cancelMatchmaking', this._onCancelMatchmaking, this);

    this.app.on('network:createRoom', this._onCreateRoom, this);
    this.app.on('network:joinRoom', this._onJoinRoom, this);
    this.app.on('network:startRoomGame', this._onStartRoomGame, this);
    this.app.on('network:switchTeam', () => { if (this.socket) this.socket.emit('switch_team'); }, this);

    this.app.on('network:syncPlayer', (playerData) => {
        if (this.socket && this.socket.connected) {
            playerData.name = this.playerName; 
            if (this.app.playerController) {
                playerData.b = this.app.playerController.brawlerType;
                playerData.skinKey = this.app.playerController.selectedSkinKey || this.currentSkinKey || '';
            } else {
                playerData.b = this.currentBrawler;
                playerData.skinKey = this.currentSkinKey || '';
            }
            this.socket.emit('playerMovement', playerData);
        }
    }, this);

    this.app.on('network:shoot', (shootData) => {
        if (this.socket && this.socket.connected) { 
            if (this.app.playerController) {
                shootData.b = this.app.playerController.brawlerType;
            }
            this.socket.emit('playerShoot', shootData); 
        }
    }, this);

    this.app.on('network:hitPlayer', (hitData) => {
        if (this.socket && this.socket.connected) { this.socket.emit('playerHit', hitData); }
    }, this);

    // 🌟 轉發 roll（翻滾）給 server
    this.app.on('network:roll', (rollData) => {
        if (this.socket && this.socket.connected) { this.socket.emit('playerRoll', rollData); }
    }, this);

    // 🌟 轉發玩家狀態（DOT/stun）給 server
    this.app.on('network:playerState', (stateData) => {
        if (this.socket && this.socket.connected) { this.socket.emit('playerState', stateData); }
    }, this);
    
    this.app.on('network:respawn', (respawnData) => {
        if (this.socket && this.socket.connected) {
            respawnData.id = this.socket.id;
            this.socket.emit('playerRespawn', respawnData); 
        }
    }, this);

    if (typeof document !== 'undefined') {
        document.addEventListener("visibilitychange", () => {
            if (!document.hidden) {
                console.log("👀 [NetworkManager] 玩家回到遊戲！強制請求伺服器同步全場狀態！");
                if (this.socket && this.socket.connected) {
                    this.socket.emit('requestFullSync');
                }
            }
        });
    }
};

NetworkManager.normalizeMode = function(mode) {
    var m = String(mode || 'FFA').trim().toUpperCase().replace(/\s+/g, '_');
    if (m === '3V3BOUNTY') return '3V3_BOUNTY';
    if (m === '3V3KNOCKOUT') return '3V3_KNOCKOUT';
    return m;
};

NetworkManager.prototype._onCancelMatchmaking = function() {
    if (this.socket) {
        this.socket.removeAllListeners(); 
        this.socket.disconnect();
        this.socket = null;
    }
};

NetworkManager.prototype._updateSelection = function(selection) {
    this.playerName = selection.playerName || 'Fighter_' + Math.floor(Math.random() * 9999); 
    this.currentBrawler = selection.brawler;
    this.currentSkinKey = selection.skinKey || '';
    this.currentMode = NetworkManager.normalizeMode(selection.mode);
};

NetworkManager.prototype._onRequestMatchmaking = function(selection) {
    this._updateSelection(selection);
    if (!this.socket || !this.socket.connected) { this._connectToServer('matchmaking'); } 
    else { this._joinMatchmaking(); }
};

NetworkManager.prototype._joinMatchmaking = function() {
    this.socket.emit('join_matchmaking', { mode: this.currentMode, brawler: this.currentBrawler, skinKey: this.currentSkinKey, playerName: this.playerName });
};

NetworkManager.prototype._onCreateRoom = function(selection) {
    this._updateSelection(selection);
    if (!this.socket || !this.socket.connected) { this._connectToServer('create_room'); } 
    else { this._emitCreateRoom(); }
};

NetworkManager.prototype._emitCreateRoom = function() {
    this.socket.emit('create_room', { mode: this.currentMode, brawler: this.currentBrawler, skinKey: this.currentSkinKey, playerName: this.playerName });
};

NetworkManager.prototype._onJoinRoom = function(selection, roomCode) {
    this._updateSelection(selection);
    this.targetRoomCode = roomCode; 
    if (!this.socket || !this.socket.connected) { this._connectToServer('join_room'); } 
    else { this._emitJoinRoom(); }
};

NetworkManager.prototype._emitJoinRoom = function() {
    this.socket.emit('join_room', { roomId: this.targetRoomCode, brawler: this.currentBrawler, skinKey: this.currentSkinKey, playerName: this.playerName });
};

NetworkManager.prototype._onStartRoomGame = function(roomId) {
    if (this.socket && this.socket.connected) { this.socket.emit('start_room_game', { roomId: roomId }); }
};

NetworkManager.prototype._connectToServer = function(actionType) {
    if (typeof io === 'undefined') return;

    if (this.socket) {
        this.socket.removeAllListeners();
        this.socket.disconnect();
        this.socket = null;
    }

    this.socket = io(this.serverUrl, {
        transports: ['websocket'], upgrade: false,             
        query: { playerName: encodeURIComponent(this.playerName) }
    });

    this.socket.on('connect', () => {
        this.app.myId = this.socket.id;
        this.app.socketId = this.socket.id;
        if (actionType === 'matchmaking') this._joinMatchmaking(); 
        else if (actionType === 'create_room') this._emitCreateRoom();
        else if (actionType === 'join_room') this._emitJoinRoom();
    });

    this.socket.on('room_created', (data) => { this.app.fire('lobby:roomCreated', data); });
    this.socket.on('room_joined', (data) => { this.app.fire('lobby:roomJoined', data); });
    
    this.socket.on('room_update', (data) => {
        for (let i = 0; i < data.players.length; i++) {
            if (data.players[i].id === this.socket.id) {
                this.app.myTeam = data.players[i].team; 
                this.app.mySlot = data.players[i].slot; 
                break;
            }
        }
        this.app.fire('lobby:roomUpdate', data); 
    });

    this.socket.on('room_error', (message) => { this.app.fire('lobby:roomError', message); });

    this.socket.on('matchmaking_status', (data) => {
        this.app.myTeam = data.team;
        this.app.mySlot = data.slot; 
        this.app.fire('lobby:matchmakingStatus', data);
    });

    this.socket.on('match_found', (data) => { this.app.fire('lobby:matchFound', data); });
    this.socket.on('game_start', () => { console.log("⚔️ [軍令狀] 全員就緒，戰鬥開始！"); });
    this.socket.on('enemyMoved', (enemyData) => { this.app.fire('network:enemyMoved', enemyData); });
    this.socket.on('enemyShot', (data) => { this.app.fire('network:enemyShot', data); });
    this.socket.on('enemyRoll', (data) => { this.app.fire('network:enemyRoll', data); });   // 🌟 對方翻滾
    this.socket.on('enemyState', (data) => { this.app.fire('network:enemyState', data); });   // 🌟 對方狀態(DOT/stun)

    this.socket.on('server:confirmHit', (data) => {
        this.app.fire('global:syncHit', data);
        if (data.targetId === this.socket.id) { 
            this.app.fire('player:hit', data.damage, data.shooterId, data.isDead, data.currentHp); 
        }
        if (data.shooterId === this.socket.id && this.app.playerController) { this.app.playerController._chargeSuper(data.damage); }
        if (this.app.scoreManager) { this.app.scoreManager._onDamage(data.shooterId, data.damage); }
        if (data.isDead && this.app.scoreManager) {
            this.app.scoreManager._onKill(data.shooterId);   
            this.app.scoreManager._onDeath(data.targetId);   
            this.app.scoreManager._onKillFeed(data.shooterId, data.targetId); 
        }
    });

    this.socket.on('server:fullStateSync', (data) => {
        console.log("📡 [NetworkManager] 收到全場快照，強制校正狀態！");
        this.app.fire('network:fullStateSync', data);
        
        // 🌟 如果後端有傳送當前場上的寶石狀態，可以在這裡一併校正 (選用)
        if (data.activeGems && data.activeGems.length > 0) {
            this.app.fire('network:dropGems', { gems: data.activeGems });
        }
    });

    this.socket.on('enemyRespawned', (data) => { this.app.fire('network:enemyRespawned', data); });
    this.socket.on('enemyDisconnected', (enemyId) => { this.app.fire('network:enemyDisconnected', enemyId); });
    this.socket.on('syncTimer', (serverTime) => { this.app.fire('network:syncTimer', serverTime); });
    this.socket.on('game_over', () => { if (this.app.scoreManager) { this.app.scoreManager.endGame(); } });
    
    this.socket.on('server:knockoutScore', (data) => {
        this.app.fire('knockout:updateScore', data.blueWins, data.redWins);
    });
    
    this.socket.on('server:roundOver', (data) => {
        this.app.timeScale = 0.3;
        if (this.app.gameModeManager) {
            this.app.gameModeManager.isRoundOver = true;
            this.app.gameModeManager._showAnnouncer("ROUND " + data.round + " OVER", data.winner);
        }
    });
    
    this.socket.on('server:roundStart', () => {
        this.app.timeScale = 1.0;
        if (this.app.gameModeManager) {
            this.app.gameModeManager.isRoundOver = false;
            this.app.gameModeManager.currentRound++;
            this.app.gameModeManager._hideAnnouncer();
        }
        this.app.fire('round:start'); 
    });

    // ==========================================
    // 🌟 新增：寶石爭奪戰專屬通訊協議 (Bounty Mode)
    // ==========================================
    
    // 1. 接收伺服器：中場定時產生新寶石
    this.socket.on('spawnGem', (data) => {
        this.app.fire('network:spawnGem', data);
    });

    // 2. 接收伺服器：某個玩家/AI 死亡，噴出身上寶石
    this.socket.on('dropGems', (data) => {
        this.app.fire('network:dropGems', data);
    });

    // 3. 接收伺服器：確認某玩家成功拾取寶石
    this.socket.on('gemPicked', (data) => {
        this.app.fire('network:gemPicked', data);
        if (data && (data.blueGems != null || data.redGems != null)) {
            this.app.fire('bounty:updateTeamGems', data.blueGems || 0, data.redGems || 0);
        }
    });
};

NetworkManager.prototype._onClientReady = function() {
    if (this.socket && this.socket.connected) { this.socket.emit('client_ready'); }
};

NetworkManager.prototype.destroy = function() {
    if (this.socket) { this.socket.removeAllListeners(); this.socket.disconnect(); }
};