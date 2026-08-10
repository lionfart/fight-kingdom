// ═══════════════════════════════════════════════════════════════
// diagRunner.js — 純觀察者診斷（零副作用於 gameplay）
//
// 僅在 ?diag=… 或 ?auto=1 時啟動；否則立即 return，正式局零成本。
// 不驅動遊戲、不修 bug、不改 entity / 戰鬥狀態。
//
// 用法：
//   ?diag=1                 全開 check，預設跑 diagSec 秒後出報告
//   ?diag=pool,mat          只跑指定 category
//   ?diag=selftest          自我驗證（每條 check 必須抓得到假違反）
//   ?diagSec=90             時限（秒，預設 90）
//   ?diagEvery=30           每 N 幀跑一次輕量 check（預設 30）
//   ?post=1                 結束時 POST → /diag（kendi sunucumuz)
//   DiagRunner.stop()       手動結束並輸出報告
//   DiagRunner.report()     隨時看目前累積
// ═══════════════════════════════════════════════════════════════
(function (root) {
    'use strict';

    var POST_URL = '/diag';
    var BUDGET_MS = 1.0;
    var HEAVY_EVERY = 300;
    var POOL_SOFT_CAP = 80;
    var STALL_SEC = 60;
    var HITCH_DT = 0.1;
    var HITCH_STREAK = 3;

    function parseQuery() {
        var out = {};
        try {
            var q = (root.location && root.location.search) || '';
            if (q.charAt(0) === '?') q = q.slice(1);
            var parts = q.split('&');
            for (var i = 0; i < parts.length; i++) {
                if (!parts[i]) continue;
                var kv = parts[i].split('=');
                var k = decodeURIComponent(kv[0] || '');
                var v = decodeURIComponent(kv[1] || '1');
                out[k] = v;
            }
        } catch (e) { /* ignore */ }
        return out;
    }

    var qs = parseQuery();
    var wantDiag = qs.diag !== undefined && qs.diag !== '0' && qs.diag !== 'false';
    var wantAuto = qs.auto === '1' || qs.auto === 'true';
    if (!wantDiag && !wantAuto) {
        root.DiagRunner = {
            active: false,
            reason: 'no ?diag= or ?auto=1 — idle'
        };
        return;
    }

    var filterCats = null;
    var selftestMode = false;
    if (wantDiag) {
        var raw = String(qs.diag || '1');
        if (raw === 'selftest') {
            selftestMode = true;
            filterCats = null;
        } else if (raw !== '1' && raw !== 'true' && raw !== 'all') {
            filterCats = {};
            var bits = raw.split(',');
            for (var bi = 0; bi < bits.length; bi++) {
                var c = bits[bi].trim().toLowerCase();
                if (c) filterCats[c] = true;
            }
        }
    }

    var durationSec = parseFloat(qs.diagSec);
    if (!(durationSec > 0)) durationSec = selftestMode ? 8 : 90;
    var everyN = parseInt(qs.diagEvery, 10);
    if (!(everyN > 0)) everyN = 30;
    var doPost = qs.post === '1' || qs.post === 'true';

    // ── Internal state ─────────────────────────────────────────
    var checks = [];
    var checkById = {};
    var violations = {}; // id → record
    var passCount = {};
    var failCount = {};
    var disabled = {};
    var frame = 0;
    var t0 = 0;
    var running = false;
    var ended = false;
    var appRef = null;
    var hitchStreak = 0;
    var lastEntityCount = -1;
    var entityRiseStreak = 0;
    var progressSig = null;
    var progressSince = 0;
    var stallArmed = false;
    var lastDotKeys = null; // frame → map
    var uncaughtBuf = [];
    var consoleErrBuf = [];
    var hooked = false;
    var hitBotWrapped = false;
    var forceFailId = null; // selftest

    function nowMs() {
        return (root.performance && performance.now) ? performance.now() : Date.now();
    }

    function okResult() { return true; }
    function failResult(snapshot) {
        return { ok: false, snapshot: snapshot || {} };
    }

    /**
     * registerCheck(id, category, fn)
     * fn(ctx) → true | { ok:false, snapshot } | false
     * 必須純觀察；失敗不 throw（外層已 catch）。
     */
    function registerCheck(id, category, fn, opts) {
        opts = opts || {};
        var entry = {
            id: id,
            category: category,
            fn: fn,
            heavy: !!opts.heavy,
            cats: (opts.cats || [category]).map(function (x) { return String(x).toLowerCase(); })
        };
        checks.push(entry);
        checkById[id] = entry;
        passCount[id] = 0;
        failCount[id] = 0;
    }

    function catAllowed(entry) {
        if (!filterCats) return true;
        for (var i = 0; i < entry.cats.length; i++) {
            if (filterCats[entry.cats[i]]) return true;
        }
        if (filterCats[entry.id]) return true;
        return false;
    }

    function recordViolation(id, category, snapshot) {
        var prev = violations[id];
        if (prev) {
            prev.count += 1;
            return;
        }
        violations[id] = {
            id: id,
            category: category,
            frame: frame,
            t: (nowMs() - t0) / 1000,
            count: 1,
            snapshot: snapshot || {}
        };
    }

    function runOne(entry, ctx) {
        if (disabled[entry.id]) return;
        if (!catAllowed(entry)) return;
        var tStart = nowMs();
        var result;
        try {
            result = entry.fn(ctx);
        } catch (e) {
            result = failResult({
                thrown: true,
                message: (e && e.message) || String(e)
            });
        }
        var cost = nowMs() - tStart;
        if (cost > BUDGET_MS) {
            disabled[entry.id] = true;
            recordViolation('budget_' + entry.id, 'runtime', {
                check: entry.id,
                costMs: +cost.toFixed(3),
                note: 'check disabled for overrun'
            });
            return;
        }
        var ok = result === true || result === undefined || result === null ||
            (result && result.ok === true);
        if (ok) {
            passCount[entry.id] = (passCount[entry.id] || 0) + 1;
        } else {
            failCount[entry.id] = (failCount[entry.id] || 0) + 1;
            var snap = (result && result.snapshot) ? result.snapshot : { ok: false };
            recordViolation(entry.id, entry.category, snap);
        }
    }

    function countEntities(node, acc) {
        if (!node) return acc;
        acc.n += 1;
        // 上限掃描，避免超大場景拖垮
        if (acc.n > 20000) return acc;
        var ch = node.children;
        if (!ch) return acc;
        for (var i = 0; i < ch.length; i++) countEntities(ch[i], acc);
        return acc;
    }

    function getPosSafe(entity) {
        if (!entity || !entity.getPosition) return null;
        try { return entity.getPosition(); } catch (e) { return null; }
    }

    function isNanVec(p) {
        return !p || isNaN(p.x) || isNaN(p.y) || isNaN(p.z);
    }

    function wrapHitObservers(app) {
        if (hitBotWrapped) return;
        var bc = app.botController;
        if (bc && typeof bc.hitBot === 'function' && !bc.hitBot._diagWrapped) {
            var orig = bc.hitBot.bind(bc);
            bc.hitBot = function (botIndex, damage, attackerId, hitMeta) {
                try {
                    if (hitMeta && hitMeta.isDotTick && running) {
                        var key = String(botIndex) + '>' + String(attackerId || '');
                        if (!lastDotKeys || lastDotKeys.frame !== frame) {
                            lastDotKeys = { frame: frame, map: {} };
                        }
                        lastDotKeys.map[key] = (lastDotKeys.map[key] || 0) + 1;
                    }
                } catch (e) { /* observe only */ }
                return orig(botIndex, damage, attackerId, hitMeta);
            };
            bc.hitBot._diagWrapped = true;
            hitBotWrapped = true;
        }
    }

    function installGlobalHooks() {
        if (hooked) return;
        hooked = true;
        var prevOnError = root.onerror;
        root.onerror = function (msg, src, line, col, err) {
            try {
                uncaughtBuf.push({
                    message: String(msg),
                    src: src || '',
                    line: line || 0
                });
                if (uncaughtBuf.length > 20) uncaughtBuf.shift();
            } catch (e) { /* ignore */ }
            if (typeof prevOnError === 'function') {
                return prevOnError.apply(this, arguments);
            }
            return false;
        };
        if (root.addEventListener) {
            root.addEventListener('unhandledrejection', function (ev) {
                try {
                    var r = ev && ev.reason;
                    uncaughtBuf.push({
                        message: 'unhandledrejection: ' + ((r && r.message) || String(r)),
                        src: '',
                        line: 0
                    });
                    if (uncaughtBuf.length > 20) uncaughtBuf.shift();
                } catch (e) { /* ignore */ }
            });
        }
        var origErr = console.error;
        console.error = function () {
            try {
                var msg = Array.prototype.slice.call(arguments).map(String).join(' ');
                // 忽略自己的報告輸出，避免循環
                if (msg.indexOf('[DiagRunner]') === -1) {
                    consoleErrBuf.push(msg);
                    if (consoleErrBuf.length > 30) consoleErrBuf.shift();
                }
            } catch (e) { /* ignore */ }
            return origErr.apply(console, arguments);
        };
    }

    // ── Checks ─────────────────────────────────────────────────
    registerCheck('err_uncaught', 'runtime', function (ctx) {
        if (ctx.forceFail === 'err_uncaught') return failResult({ selftest: true });
        if (!uncaughtBuf.length) return okResult();
        var last = uncaughtBuf[uncaughtBuf.length - 1];
        uncaughtBuf.length = 0;
        return failResult(last);
    });

    registerCheck('err_console', 'runtime', function (ctx) {
        if (ctx.forceFail === 'err_console') return failResult({ selftest: true });
        if (!consoleErrBuf.length) return okResult();
        var last = consoleErrBuf[consoleErrBuf.length - 1];
        consoleErrBuf.length = 0;
        return failResult({ message: last });
    });

    registerCheck('frame_hitch', 'runtime', function (ctx) {
        if (ctx.forceFail === 'frame_hitch') return failResult({ selftest: true, dt: 0.2, streak: 3 });
        var dt = ctx.dt || 0;
        if (dt > HITCH_DT) hitchStreak++;
        else hitchStreak = 0;
        if (hitchStreak >= HITCH_STREAK) {
            return failResult({ dt: +dt.toFixed(4), streak: hitchStreak });
        }
        return okResult();
    });

    registerCheck('nan_pos', 'numeric', function (ctx) {
        if (ctx.forceFail === 'nan_pos') return failResult({ selftest: true, who: 'fake' });
        var app = ctx.app;
        if (!app) return okResult();
        var bad = [];
        var pc = app.playerController;
        if (pc && pc.player && !pc.isDead) {
            var pp = getPosSafe(pc.player);
            if (isNanVec(pp)) bad.push({ who: 'player' });
        }
        var bots = app.botController && app.botController.bots;
        if (bots) {
            for (var i = 0; i < bots.length; i++) {
                var b = bots[i];
                if (!b || b.state !== 'alive' || !b.entity) continue;
                var bp = getPosSafe(b.entity);
                if (isNanVec(bp)) bad.push({ who: b.id || ('bot_' + i) });
                if (bad.length >= 5) break;
            }
        }
        if (bad.length) return failResult({ bad: bad });
        return okResult();
    });

    registerCheck('hp_range', 'numeric', function (ctx) {
        if (ctx.forceFail === 'hp_range') return failResult({ selftest: true, hp: -1, maxHp: 100 });
        var app = ctx.app;
        if (!app) return okResult();
        var bad = [];
        function checkUnit(id, hp, maxHp) {
            if (typeof hp !== 'number' || typeof maxHp !== 'number') return;
            if (maxHp <= 0) return;
            if (hp < 0 || hp > maxHp + 0.01 || isNaN(hp) || isNaN(maxHp)) {
                bad.push({ id: id, hp: hp, maxHp: maxHp });
            }
        }
        var pc = app.playerController;
        if (pc) checkUnit('player', pc.health, pc.maxHealth);
        var bots = app.botController && app.botController.bots;
        if (bots) {
            for (var i = 0; i < bots.length; i++) {
                var b = bots[i];
                if (!b || b.state !== 'alive') continue;
                checkUnit(b.id || ('bot_' + i), b.health, b.maxHealth);
                if (bad.length >= 5) break;
            }
        }
        if (bad.length) return failResult({ bad: bad });
        return okResult();
    });

    registerCheck('entity_leak', 'leak', function (ctx) {
        if (ctx.forceFail === 'entity_leak') return failResult({ selftest: true, n: 99999, rise: 5 });
        var app = ctx.app;
        if (!app || !app.root) return okResult();
        var acc = countEntities(app.root, { n: 0 });
        var n = acc.n;
        if (lastEntityCount < 0) {
            lastEntityCount = n;
            return okResult();
        }
        if (n > lastEntityCount + 8) entityRiseStreak++;
        else entityRiseStreak = 0;
        lastEntityCount = n;
        // 連續多次重掃仍明顯上升 → 疑似 leak
        if (entityRiseStreak >= 5) {
            return failResult({ n: n, riseStreak: entityRiseStreak });
        }
        return okResult();
    }, { heavy: true, cats: ['leak', 'pool'] });

    registerCheck('pool_leak', 'leak', function (ctx) {
        if (ctx.forceFail === 'pool_leak') return failResult({ selftest: true, key: 'fake', len: 999 });
        var app = ctx.app;
        var cm = app && app.combatManager;
        if (!cm || !cm.bulletPools) return okResult();
        var fat = [];
        for (var k in cm.bulletPools) {
            if (!cm.bulletPools.hasOwnProperty(k)) continue;
            var len = cm.bulletPools[k] ? cm.bulletPools[k].length : 0;
            if (len > POOL_SOFT_CAP) fat.push({ key: k, len: len, cap: POOL_SOFT_CAP });
        }
        if (cm.aoePools) {
            for (var a in cm.aoePools) {
                if (!cm.aoePools.hasOwnProperty(a)) continue;
                var al = cm.aoePools[a] ? cm.aoePools[a].length : 0;
                if (al > POOL_SOFT_CAP) fat.push({ key: 'aoe:' + a, len: al, cap: POOL_SOFT_CAP });
            }
        }
        var bm = app.bulletManager;
        if (bm && bm.bullets && bm.bullets.length > 200) {
            fat.push({ key: 'activeBullets', len: bm.bullets.length, cap: 200 });
        }
        if (fat.length) return failResult({ fat: fat });
        return okResult();
    }, { heavy: true, cats: ['leak', 'pool'] });

    registerCheck('orphan_bullet', 'leak', function (ctx) {
        if (ctx.forceFail === 'orphan_bullet') return failResult({ selftest: true, orphans: 1 });
        var app = ctx.app;
        var cm = app && app.combatManager;
        if (!cm || !cm.bulletPools) return okResult();
        var orphans = [];
        for (var k in cm.bulletPools) {
            if (!cm.bulletPools.hasOwnProperty(k)) continue;
            var pool = cm.bulletPools[k];
            if (!pool) continue;
            for (var i = 0; i < pool.length; i++) {
                var e = pool[i];
                if (!e || e._destroyed || !e.parent) {
                    orphans.push({ key: k, index: i, destroyed: !!(e && e._destroyed), noParent: !(e && e.parent) });
                    if (orphans.length >= 8) break;
                }
            }
            if (orphans.length >= 8) break;
        }
        if (orphans.length) return failResult({ orphans: orphans });
        return okResult();
    }, { heavy: true, cats: ['leak', 'pool'] });

    registerCheck('fx_in_cache', 'regression', function (ctx) {
        if (ctx.forceFail === 'fx_in_cache') return failResult({ selftest: true, who: 'fake' });
        var app = ctx.app;
        if (!app) return okResult();
        var hits = [];
        function scanEntity(ent, who) {
            if (!ent || !ent._cachedMeshes || !ent._cachedMeshes.length) return;
            var meshes = ent._cachedMeshes;
            for (var i = 0; i < meshes.length; i++) {
                var mi = meshes[i];
                var node = mi && (mi.node || (mi.mesh && mi.mesh.node));
                if (!node && mi && mi._entity) node = mi._entity;
                // meshInstance 常掛在 GraphNode；往上找 _isFx
                var p = node;
                var depth = 0;
                while (p && depth < 12) {
                    if (p._isFx) {
                        hits.push({ who: who, meshIndex: i });
                        return;
                    }
                    p = p.parent;
                    depth++;
                }
            }
        }
        var pc = app.playerController;
        if (pc && pc.player) scanEntity(pc.player, 'player');
        var bots = app.botController && app.botController.bots;
        if (bots) {
            for (var i = 0; i < bots.length; i++) {
                if (bots[i] && bots[i].entity) scanEntity(bots[i].entity, bots[i].id || ('bot_' + i));
                if (hits.length >= 5) break;
            }
        }
        if (hits.length) return failResult({ hits: hits });
        return okResult();
    }, { heavy: true, cats: ['regression', 'mat'] });

    registerCheck('dot_double', 'regression', function (ctx) {
        if (ctx.forceFail === 'dot_double') return failResult({ selftest: true, key: '0>player', n: 2 });
        if (!lastDotKeys || lastDotKeys.frame !== frame) return okResult();
        var dup = [];
        var map = lastDotKeys.map;
        for (var k in map) {
            if (map[k] > 1) dup.push({ key: k, n: map[k] });
        }
        if (dup.length) return failResult({ dup: dup });
        return okResult();
    });

    registerCheck('batch_anim', 'regression', function (ctx) {
        if (ctx.forceFail === 'batch_anim') return failResult({ selftest: true, name: 'fakeAnim' });
        var app = ctx.app;
        if (!app || !app.root || !app.root.findComponents) return okResult();
        var bad = [];
        try {
            var anims = app.root.findComponents('anim') || [];
            for (var i = 0; i < anims.length; i++) {
                var ent = anims[i].entity;
                if (!ent) continue;
                var bg = -1;
                if (ent.render && ent.render.batchGroupId !== undefined) bg = ent.render.batchGroupId;
                if (ent.model && ent.model.batchGroupId !== undefined && ent.model.batchGroupId >= 0) {
                    bg = ent.model.batchGroupId;
                }
                if (bg >= 0) {
                    bad.push({ name: ent.name, batchGroupId: bg });
                    if (bad.length >= 5) break;
                }
            }
        } catch (e) {
            return okResult();
        }
        if (bad.length) return failResult({ bad: bad });
        return okResult();
    }, { heavy: true, cats: ['regression', 'mat'] });

    registerCheck('preattack_mat', 'regression', function (ctx) {
        if (ctx.forceFail === 'preattack_mat') return failResult({ selftest: true, key: 'fakeFx' });
        var app = ctx.app;
        var cm = app && app.combatManager;
        if (!cm || !cm.preAttackMat || !cm.bulletPools) return okResult();
        var pam = cm.preAttackMat;
        var pum = cm.preAttackUrgentMat;
        var hits = [];
        function scanPool(pool, key) {
            if (!pool) return;
            for (var i = 0; i < pool.length; i++) {
                var e = pool[i];
                if (!e || !e._isFx || e._destroyed) continue;
                // 只抽樣：enabled 或前幾個
                if (!e.enabled && i > 2) continue;
                var renders = e.findComponents ? e.findComponents('render') : [];
                for (var r = 0; r < renders.length; r++) {
                    var mis = renders[r].meshInstances || [];
                    for (var m = 0; m < mis.length; m++) {
                        var mat = mis[m].material;
                        if (mat === pam || mat === pum) {
                            hits.push({ key: key, index: i, name: e.name });
                            return;
                        }
                    }
                }
            }
        }
        for (var k in cm.bulletPools) {
            if (!cm.bulletPools.hasOwnProperty(k)) continue;
            scanPool(cm.bulletPools[k], k);
            if (hits.length >= 5) break;
        }
        if (hits.length) return failResult({ hits: hits });
        return okResult();
    }, { heavy: true, cats: ['regression', 'mat'] });

    registerCheck('stall', 'progress', function (ctx) {
        if (ctx.forceFail === 'stall') return failResult({ selftest: true, idleSec: 60 });
        var app = ctx.app;
        if (!app) return okResult();
        var playing = app.gameState === 'playing';
        if (!playing) {
            stallArmed = false;
            progressSig = null;
            return okResult();
        }
        var wave = 0;
        if (app.gameModeManager && app.gameModeManager.currentWave !== undefined) {
            wave = app.gameModeManager.currentWave;
        }
        if (app.rogueDirector && app.rogueDirector.wave !== undefined) {
            wave = app.rogueDirector.wave;
        }
        var hp = 0;
        if (app.playerController) hp = app.playerController.health || 0;
        var sig = wave + '|' + Math.round(hp);
        var t = (nowMs() - t0) / 1000;
        if (!stallArmed) {
            stallArmed = true;
            progressSig = sig;
            progressSince = t;
            return okResult();
        }
        if (sig !== progressSig) {
            progressSig = sig;
            progressSince = t;
            return okResult();
        }
        if (t - progressSince >= STALL_SEC) {
            return failResult({
                idleSec: +(t - progressSince).toFixed(1),
                sig: sig,
                mode: app.gameMode || ''
            });
        }
        return okResult();
    });

    // ── Tick / lifecycle ───────────────────────────────────────
    function buildReport(reason) {
        var elapsed = (nowMs() - t0) / 1000;
        var list = [];
        for (var id in violations) {
            if (violations.hasOwnProperty(id)) list.push(violations[id]);
        }
        list.sort(function (a, b) { return a.t - b.t; });
        var checkSummary = {};
        for (var i = 0; i < checks.length; i++) {
            var c = checks[i];
            checkSummary[c.id] = {
                category: c.category,
                pass: passCount[c.id] || 0,
                fail: failCount[c.id] || 0,
                disabled: !!disabled[c.id],
                violated: !!violations[c.id]
            };
        }
        return {
            ok: list.length === 0,
            reason: reason || 'end',
            selftest: selftestMode,
            elapsedSec: +elapsed.toFixed(2),
            frames: frame,
            mode: (appRef && (appRef.gameMode || (appRef.gameModeManager && appRef.gameModeManager.currentMode))) || '',
            filter: filterCats ? Object.keys(filterCats) : ['all'],
            checks: checkSummary,
            violations: list,
            message: list.length === 0 ? 'all pass' : ('violations=' + list.length)
        };
    }

    function emitReport(reason) {
        if (ended) return null;
        ended = true;
        running = false;
        var report = buildReport(reason);
        // 主要輸出：單行 JSON，方便 vConsole
        console.warn('[DiagRunner] ' + JSON.stringify(report));
        if (doPost) {
            try {
                if (root.fetch) {
                    root.fetch(POST_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(report),
                        mode: 'cors',
                        keepalive: true
                    }).catch(function () { /* ignore network */ });
                }
            } catch (e) { /* ignore */ }
        }
        return report;
    }

    function tick(dt) {
        if (!running || ended) return;
        frame++;
        var app = appRef;
        if (!app && root.pc && pc.Application && pc.Application.getApplication) {
            app = pc.Application.getApplication();
            appRef = app;
        }
        if (app) wrapHitObservers(app);

        var elapsed = (nowMs() - t0) / 1000;
        if (elapsed >= durationSec) {
            emitReport('timeout');
            return;
        }

        var isHeavyFrame = (frame % HEAVY_EVERY) === 0;
        var isLightFrame = (frame % everyN) === 0;
        if (!isLightFrame && !isHeavyFrame) return;

        var ctx = {
            app: app,
            dt: dt,
            frame: frame,
            t: elapsed,
            forceFail: forceFailId
        };

        var budgetStart = nowMs();
        for (var i = 0; i < checks.length; i++) {
            var entry = checks[i];
            if (entry.heavy && !isHeavyFrame && !forceFailId) continue;
            if (!entry.heavy && !isLightFrame && !forceFailId) continue;
            runOne(entry, ctx);
            if (nowMs() - budgetStart > BUDGET_MS * checks.length) break;
        }
    }

    function runSelftest() {
        console.warn('[DiagRunner] selftest begin — injecting one fake fail per check');
        var missed = [];
        for (var i = 0; i < checks.length; i++) {
            var entry = checks[i];
            if (!catAllowed(entry)) continue;
            // 清掉該 id 舊紀錄再測
            delete violations[entry.id];
            failCount[entry.id] = 0;
            forceFailId = entry.id;
            runOne(entry, {
                app: appRef,
                dt: 0.016,
                frame: frame,
                t: 0,
                forceFail: entry.id
            });
            forceFailId = null;
            if (!violations[entry.id]) {
                missed.push(entry.id);
                recordViolation('selftest_miss_' + entry.id, 'runtime', {
                    check: entry.id,
                    note: 'check ignored forceFail — treat as missing'
                });
            }
        }
        var report = emitReport('selftest');
        if (missed.length) {
            console.warn('[DiagRunner] selftest MISSED checks: ' + missed.join(','));
        } else {
            console.warn('[DiagRunner] selftest OK — every check can record a violation');
        }
        return report;
    }

    function onUpdate(dt) {
        tick(dt);
    }

    function attachToApp(app) {
        if (running || ended) return;
        appRef = app;
        installGlobalHooks();
        wrapHitObservers(app);
        t0 = nowMs();
        running = true;
        frame = 0;
        app.on('update', onUpdate);

        console.warn('[DiagRunner] attached', JSON.stringify({
            diag: qs.diag,
            auto: qs.auto,
            selftest: selftestMode,
            durationSec: durationSec,
            everyN: everyN,
            post: doPost,
            checks: checks.length
        }));

        if (selftestMode) {
            // 等一幀讓 app 就緒
            setTimeout(function () { runSelftest(); }, 200);
        }
    }

    function tryAttach() {
        var app = null;
        if (root.pc && pc.Application && pc.Application.getApplication) {
            app = pc.Application.getApplication();
        }
        if (app) {
            attachToApp(app);
            return;
        }
        var tries = 0;
        var iv = setInterval(function () {
            tries++;
            if (root.pc && pc.Application && pc.Application.getApplication) {
                app = pc.Application.getApplication();
            }
            if (app) {
                clearInterval(iv);
                attachToApp(app);
            } else if (tries > 100) {
                clearInterval(iv);
                console.warn('[DiagRunner] gave up waiting for pc.Application');
            }
        }, 100);
    }

    var api = {
        active: true,
        registerCheck: registerCheck,
        stop: function () { return emitReport('manual_stop'); },
        report: function () { return buildReport('snapshot'); },
        isRunning: function () { return running && !ended; }
    };
    root.DiagRunner = api;

    // 可選：掛腳本到 Entity 也能啟動（仍受 query gate；無 param 時 script 不該被加進正式 build）
    if (root.pc && typeof pc.createScript === 'function') {
        var DiagRunnerScript = pc.createScript('diagRunner');
        DiagRunnerScript.prototype.initialize = function () {
            if (!running && !ended) attachToApp(this.app);
        };
    }

    tryAttach();
})(typeof window !== 'undefined' ? window : this);
