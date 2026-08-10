var GameModeManager = pc.createScript('gameModeManager');

GameModeManager.t = function (key, vars) {
    if (window.TKI18n && typeof window.TKI18n.t === 'function') return window.TKI18n.t(key, vars);
    return key;
};
GameModeManager.prototype.t = GameModeManager.t;

GameModeManager.normalizeMode = function(mode) {
    var m = String(mode || 'FFA').trim().toUpperCase().replace(/\s+/g, '_');
    if (m === '3V3BOUNTY') return '3V3_BOUNTY';
    if (m === '3V3KNOCKOUT') return '3V3_KNOCKOUT';
    return m;
};

GameModeManager.prototype._isBountyMode = function() {
    return GameModeManager.normalizeMode(this.currentMode) === '3V3_BOUNTY';
};

GameModeManager.prototype._isMultiplayerSession = function() {
    if (this.app._lastGameStart && this.app._lastGameStart.isMultiplayer) return true;
    var cs = this.app.characterSelect;
    if (cs && cs.selection && cs.selection.isMultiplayer) return true;
    var nm = this.app.networkManager;
    return !!(nm && nm.socket && nm.socket.connected);
};

GameModeManager.INTRO_DURATION = 4.5;

// ==========================================
// 🌟 屬性設定 (Attributes)
// ==========================================
GameModeManager.attributes.add('mapRoot', { type: 'entity', title: '當前地圖根節點 (Map Root)' });
GameModeManager.attributes.add('teamSpawnZ', { type: 'number', default: 6.0, title: 'Team Spawn Z' });
GameModeManager.attributes.add('titleFontSize', { type: 'string', default: 'clamp(28px, 7vw, 84px)', title: '開場標題字級（已由 uiTheme --tk-announcer-* 統一，此欄位保留相容）' });
GameModeManager.attributes.add('countdownFontSize', { type: 'string', default: 'clamp(70px, 24.5vw, 245px)', title: '倒數數字字級（已由 uiTheme 統一）' });
GameModeManager.attributes.add('battleFontSize', { type: 'string', default: 'clamp(56px, 17.5vw, 175px)', title: '開戰字級（已由 uiTheme 統一）' });
GameModeManager.attributes.add('bushFxTemplate', { type: 'entity', title: 'Bush Destroy FX Template' });
GameModeManager.attributes.add('timerDisplay', { type: 'entity', title: 'Timer Display UI (全局計時器)' });

// 模式變數設定
GameModeManager.attributes.add('gemSpawnInterval', { type: 'number', default: 7.0, title: '寶石產出間隔(秒)' });
GameModeManager.attributes.add('targetGemsToWin', { type: 'number', default: 15, title: '獲勝所需寶石數' });
GameModeManager.attributes.add('countdownSeconds', { type: 'number', default: 15, title: '達標後倒數時間(秒)' });

// 🌟 全局時間設定
GameModeManager.attributes.add('matchDuration', { type: 'number', default: 180, title: '全局比賽時間(秒) [Bounty/FFA]' });
GameModeManager.attributes.add('knockoutRoundDuration', { type: 'number', default: 60, title: 'Knockout 單局時間(秒)' });

// ==========================================
// 🌟 初始化
// ==========================================
GameModeManager.prototype.initialize = function() {
    this.app.gameModeManager = this; 
    
    this.obstacles = []; this.bushes = [];
    this.ffaSpawns = []; this.pveEnemySpawns = [];
    this.blueSpawns = []; this.redSpawns = [];
    this.mapCenterX = 0; this.mapCenterZ = 0;
    
    this.mapLimitX = 11.5; this.mapLimitZ = 10.0;
    this.mapMinX = -11.5; this.mapMaxX = 11.5;
    this.mapMinZ = -10.0; this.mapMaxZ = 10.0;

    if (this.mapRoot) {
        this._parseMapFromHierarchy();
    } else {
        this._loadLegacyMapData();
    }

    this.currentMode = 'FFA'; 
    this.blueWins = 0; this.redWins = 0; this.targetWins = 3; 
    this.currentRound = 1; 
    this.currentWave = 0; this.maxWaves = 3; this.waveStatus = 'waiting'; 
    this.isRoundOver = false; this.isMatchOver = false;
    
    this._introTimer = 0; this.introStep = 0;
    Object.defineProperty(this, 'introTimer', { get: function() { return Math.min(3.0, Math.max(0, this._introTimer)); } });

    this.bushFxPool = []; this.bushFxIndex = 0;
    this._shadowRefreshFrames = 0;
    if (this.bushFxTemplate) {
        for (var i = 0; i < 15; i++) {
            var fx = this.bushFxTemplate.clone();
            this.app.root.addChild(fx);
            fx.enabled = false; this.bushFxPool.push(fx);
        }
    }

    this.gemSpawnTimer = this.gemSpawnInterval;
    this.blueTeamGems = 0; this.redTeamGems = 0;
    this.matchCountdown = 0; this.countdownTeam = 'none'; this.isCountdownActive = false;
    
    // 🌟 全局計時器變數
    this.globalTimer = this.matchDuration;
    this._gemManagerCache = null;
    this._botManagerCache = null;

    // 建立提示 UI (保留了 Bounty 原本的倒數 UI)
    this._createAnnouncerUI(); this._createIntroUI(); this._createBountyUI(); this._createTimerUI();
    
    this.app.on('game:start', this._onGameStart, this);
    this.app.on('round:start', this._onRoundStart, this); 
    this.app.on('score:death', this._onPlayerDeath, this);
    this.app.on('game:introStart', this.startIntroSequence, this); 
    this.app.on('bounty:updateTeamGems', this._onUpdateTeamGems, this);
    this.app.on('network:syncTimer', this._onSyncTimer, this);   // 🌟 接收 server 權威時間

    this.on('destroy', function() {
        if (this.bountyUI) this.bountyUI.remove();
        if (this.introDiv) this.introDiv.remove();
        if (this._introFadeEl) this._introFadeEl.remove();
        if (this.announcerUI) this.announcerUI.remove();
    }, this);
};

// ==========================================
// 🌟 核心：Land 邊界解析與草叢修復
// ==========================================
GameModeManager.prototype._parseMapFromHierarchy = function() {
    var self = this;
    var obstacleFolders = ['Obstacle', 'Tree', 'Building', 'Obstacles', 'Trees', 'Buildings'];
    obstacleFolders.forEach(function(folderName) {
        var folder = self.mapRoot.findByName(folderName);
        if (!folder) return;
        folder.findComponents('render').forEach(function(renderComp) {
            var ent = renderComp.entity;
            var pos = ent.getPosition(); 
            var hw = 1.0, hd = 1.0;
            if (renderComp.meshInstances && renderComp.meshInstances.length > 0) {
                hw = renderComp.meshInstances[0].aabb.halfExtents.x;
                hd = renderComp.meshInstances[0].aabb.halfExtents.z;
            }
            var isWater = ent.name.toLowerCase().indexOf('water') !== -1;
            self.obstacles.push({ x: pos.x, z: pos.z, hw: hw, hd: hd, isWater: isWater });
        });
    });

    // 🧱 可破壞障礙物:平常擋路擋彈(進 obstacles),被 destroyBush 子彈一發清除(帶 entity+旗標)
    //    投影請在 Editor 開 castShadows；摧毀後由 _refreshShadowMapOnce 清殘影
    var destructFolder = self.mapRoot.findByName('DestructibleObstacle') || self.mapRoot.findByName('DestructibleObstacles');
    if (destructFolder) {
        destructFolder.findComponents('render').forEach(function(renderComp) {
            var ent = renderComp.entity;
            var pos = ent.getPosition();
            var hw = 1.0, hd = 1.0;
            if (renderComp.meshInstances && renderComp.meshInstances.length > 0) {
                hw = renderComp.meshInstances[0].aabb.halfExtents.x;
                hd = renderComp.meshInstances[0].aabb.halfExtents.z;
            }
            self.obstacles.push({ x: pos.x, z: pos.z, hw: hw, hd: hd, isWater: false, destructible: true, destroyed: false, entity: ent });
        });
    }

    var processBushes = function(folderName, isIndestructible) {
        var folder = self.mapRoot.findByName(folderName);
        if (!folder) return;
        var bushComps = folder.findComponents('render');
        if (bushComps.length === 0) bushComps = folder.findComponents('model');

        bushComps.forEach(function(comp) {
            var ent = comp.entity;
            var pos = ent.getPosition();
            var hw = 1.5, hd = 1.5;
            if (comp.meshInstances && comp.meshInstances.length > 0) {
                var aabb = comp.meshInstances[0].aabb;
                if (aabb.halfExtents.x > 0) { hw = aabb.halfExtents.x; hd = aabb.halfExtents.z; }
                var mat = comp.meshInstances[0].material;
                if (mat) comp.meshInstances[0].material = mat.clone();
            }
            // 投影請在 Editor 開 castShadows；燒毀後由 destroyBushesInArea → _refreshShadowMapOnce
            self.bushes.push({ x: pos.x, z: pos.z, hw: hw, hd: hd, entity: ent, isIndestructible: isIndestructible });
        });
    };

    processBushes('Bush', false); processBushes('Bushes', false);
    processBushes('InvincibleBush', true); processBushes('IndestructibleBush', true);

    var spawnFolder = this.mapRoot.findByName('Spawns');
    if (spawnFolder) this._parseSpawns(spawnFolder);

    var landFolder = this.mapRoot.findByName('Land');
    if (landFolder && landFolder.children.length > 0) {
        var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        this.walkableFloors = [];
        var self = this;
        landFolder.children.forEach(function(child) {            
            var pos = child.getPosition(); self.walkableFloors.push({ x: pos.x, z: pos.z });
            var scale = child.getLocalScale();
            var hw = scale.x / 2; var hd = scale.z / 2;
            if (pos.x - hw < minX) minX = pos.x - hw; if (pos.x + hw > maxX) maxX = pos.x + hw;
            if (pos.z - hd < minZ) minZ = pos.z - hd; if (pos.z + hd > maxZ) maxZ = pos.z + hd;
        });
        if (minX !== Infinity) {
            this.mapMinX = minX; this.mapMaxX = maxX; this.mapMinZ = minZ; this.mapMaxZ = maxZ;
            this.mapCenterX = (minX + maxX) / 2; this.mapCenterZ = (minZ + maxZ) / 2;
            this.mapLimitX = Math.max(Math.abs(minX), Math.abs(maxX));
            this.mapLimitZ = Math.max(Math.abs(minZ), Math.abs(maxZ));
            this._generateBoundingWalls();
        }
    }

    this.doors = [];
    var doorFolder = this.mapRoot.findByName('Doors');
    if (doorFolder) {
        doorFolder.children.forEach(function(pivot) {
            var p = pivot.getPosition();
            var panel = pivot.children[0];
            self.doors.push({
                entity: pivot, x: p.x, z: p.z,
                baseY: pivot.getLocalEulerAngles().y,
                angle: 0,
                hingeSide: (panel && panel.getLocalPosition().x < 0) ? -1 : 1,
                fwd: pivot.forward.clone(),
                baseRot: pivot.getLocalRotation().clone(),
                holdTimer: 0,
                lockedSide: 0
            });
        });
    }
};

GameModeManager.prototype._generateBoundingWalls = function() {
    var cx = this.mapCenterX, cz = this.mapCenterZ;
    var width = this.mapMaxX - this.mapMinX, depth = this.mapMaxZ - this.mapMinZ;
    var thickness = 2, height = 10;   
    this._createInvisibleWall(cx, cz + depth/2 + thickness/2, width + thickness*2, height, thickness);
    this._createInvisibleWall(cx, cz - depth/2 - thickness/2, width + thickness*2, height, thickness);
    this._createInvisibleWall(cx + width/2 + thickness/2, cz, thickness, height, depth);
    this._createInvisibleWall(cx - width/2 - thickness/2, cz, thickness, height, depth);
};

GameModeManager.prototype._createInvisibleWall = function(x, z, width, height, depth) {
    var entity = new pc.Entity('Auto_Edge_Wall');
    entity.addComponent('collision', { type: 'box', halfExtents: new pc.Vec3(width / 2, height / 2, depth / 2) });
    entity.addComponent('rigidbody', { type: 'static' }); entity.setPosition(x, height / 2, z);
    if (this.mapRoot) this.mapRoot.addChild(entity); else this.app.root.addChild(entity);
};

GameModeManager.prototype._parseSpawns = function(spawnFolder) {
    var self = this; var tempBlue = [], tempRed = [];
    var allSpawnEnts = spawnFolder.find(function(node) { return node.name.toUpperCase().match(/^(FFA|BLUE|RED|PVE)/); });
    allSpawnEnts.forEach(function(spawnEnt) {
        var pos = spawnEnt.getPosition(), name = spawnEnt.name.toUpperCase();
        if (name.indexOf('FFA') !== -1) self.ffaSpawns.push({ x: pos.x, z: pos.z });
        else if (name.indexOf('BLUE') !== -1) tempBlue.push({ name: name, x: pos.x, z: pos.z });
        else if (name.indexOf('RED') !== -1) tempRed.push({ name: name, x: pos.x, z: pos.z });
        else if (name.indexOf('PVE') !== -1) self.pveEnemySpawns.push({ x: pos.x, z: pos.z });
    });
    tempBlue.sort(function(a, b) { return a.name.localeCompare(b.name); });
    tempRed.sort(function(a, b) { return a.name.localeCompare(b.name); });
    this.blueSpawns = tempBlue.map(function(i) { return { x: i.x, z: i.z }; });
    this.redSpawns = tempRed.map(function(i) { return { x: i.x, z: i.z }; });
};

// ==========================================
// 🌟 出生點分配 (退回你原本設定：允許同點出生)
// ==========================================
GameModeManager.prototype.getSafeSpawnPoint = function(team, slotIndex) {
    var mode = GameModeManager.normalizeMode(this.app.gameMode || this.currentMode || 'FFA');
    var cx = this.mapCenterX || 0, cz = this.mapCenterZ || 0;
    
    // ================= PVE / ROGUE 模式 =================
    if (mode === 'PVE' || mode === 'ROGUE') {
        if (team === 'blue' || team === 'none') return this._nudgeOutOfObstacles(cx, cz + 25);
        var pveSpot = this.pveEnemySpawns[Math.floor(Math.random() * this.pveEnemySpawns.length)];
        return this._nudgeOutOfObstacles(pveSpot.x + (Math.random() - 0.5) * 2.0, pveSpot.z + (Math.random() - 0.5) * 2.0);
    }

    // 🌟 防禦性機制：確保 slotIndex 是有效的「正整數」
    var safeSlot = parseInt(slotIndex, 10);
    var hasValidSlot = !isNaN(safeSlot) && safeSlot >= 0;
    
    // ================= 3V3 模式 =================
    if (mode === '3V3_BOUNTY' || mode === '3V3_KNOCKOUT') {
        var defaultZ = this.teamSpawnZ || 6.0;
        var bSpawns = (this.blueSpawns && this.blueSpawns.length >= 3) ? this.blueSpawns : [{x: cx - 6, z: cz + defaultZ}, {x: cx, z: cz + defaultZ}, {x: cx + 6, z: cz + defaultZ}];
        var rSpawns = (this.redSpawns && this.redSpawns.length >= 3) ? this.redSpawns : [{x: cx - 6, z: cz - defaultZ}, {x: cx, z: cz - defaultZ}, {x: cx + 6, z: cz - defaultZ}];
        var targetSpawns = (team === 'red') ? rSpawns : bSpawns;
        
        var spawnSpot;
        // 只有在數字 >= 0 且有效時，才進行取餘數分配
        if (hasValidSlot) {
            spawnSpot = targetSpawns[safeSlot % targetSpawns.length];
        } else {
            spawnSpot = targetSpawns[Math.floor(Math.random() * targetSpawns.length)];
        }
        return { x: spawnSpot.x + (Math.random() - 0.5) * 0.3, z: spawnSpot.z + (Math.random() - 0.5) * 0.3 };
    }

    // ================= FFA 模式 =================
    if (mode === 'FFA' && this.ffaSpawns && this.ffaSpawns.length > 0) {
        var spot;
        
        // 只有在數字 >= 0 且有效時，才進行取餘數分配
        if (hasValidSlot) {
            spot = this.ffaSpawns[safeSlot % this.ffaSpawns.length];
        }
        
        // 退回機制 1：如果沒拿到點（包含沒傳 slotIndex），使用動態找最遠點
        if (!spot) {
            spot = this._getSafestSpawn(this.ffaSpawns);
        }
        
        // 退回機制 2：終極防呆，如果連動態計算都壞了，硬塞地圖第一個點給他
        if (!spot) {
            spot = this.ffaSpawns[0];
        }
        
        return { x: spot.x + (Math.random()-0.5)*0.3, z: spot.z + (Math.random()-0.5)*0.3 };
    }

    // ================= 找不到特定點的備用處理 =================
    var safe, attempts = 0, spawnX = 0, spawnZ = 0;
    do {
        spawnX = this.mapMinX + 1 + Math.random() * (this.mapMaxX - this.mapMinX - 2);
        spawnZ = this.mapMinZ + 1 + Math.random() * (this.mapMaxZ - this.mapMinZ - 2);
        safe = true; attempts++;
        for (var i = 0; i < this.obstacles.length; i++) {
            var obs = this.obstacles[i];
            if (obs.destroyed) continue;   // 🧱 已破壞的可破壞障礙物不再擋
            if (Math.abs(spawnX - obs.x) < obs.hw + 0.6 && Math.abs(spawnZ - obs.z) < obs.hd + 0.6) { safe = false; break; }
        }
    } while (!safe && attempts < 50);
    return { x: spawnX, z: spawnZ };
};

// ==========================================
// 🌟 遊戲主邏輯與 UI 控制
// ==========================================
GameModeManager.prototype._introCopyForMode = function(mode) {
    var keyMap = {
        '3V3_KNOCKOUT': 'announcer.mode.knockout',
        '3V3_BOUNTY': 'announcer.mode.bounty',
        'PVE': 'announcer.mode.pve',
        'ROGUE': 'announcer.mode.rogue',
        'FFA': 'announcer.mode.ffa'
    };
    return GameModeManager.t(keyMap[mode] || 'announcer.mode.default');
};

GameModeManager.prototype._roundOverCopy = function(round) {
    return GameModeManager.t('announcer.roundOver', { n: round });
};

GameModeManager.prototype._teamWinCopy = function(winnerTeam) {
    if (winnerTeam === 'blue') return GameModeManager.t('announcer.team.blue');
    if (winnerTeam === 'red') return GameModeManager.t('announcer.team.red');
    if (winnerTeam === 'draw') return GameModeManager.t('announcer.team.draw');
    return '';
};

GameModeManager.prototype._pulseIntro = function(text, variant) {
    if (!this.introDiv) return;
    this.introDiv.style.display = 'block';
    this.introDiv.innerText = text;
    this.introDiv.className = 'tk-announcer-intro tk-announcer-intro-' + (variant || 'title');
    this.introDiv.style.animation = 'none';
    this.introDiv.offsetHeight;
    this.introDiv.style.animation = 'tkAnnouncerPop 0.5s ease-out forwards';
};

GameModeManager.prototype._createBountyUI = function() {
    this.bountyUI = document.createElement('div');
    this.bountyUI.id = 'bounty-countdown-ui';
    this.bountyUI.className = 'tk-banner';
    this.bountyLine = document.createElement('div');
    this.bountyLine.className = 'tk-banner-line';
    this.bountyUI.appendChild(this.bountyLine);
    document.body.appendChild(this.bountyUI);
};

GameModeManager.prototype._showBountyBanner = function(text, team) {
    if (!this.bountyUI || !this.bountyLine) return;
    this.bountyLine.textContent = text;
    this.bountyUI.className = 'tk-banner show tk-banner-team-' + (team === 'red' ? 'red' : 'blue');
};

GameModeManager.prototype._hideBountyBanner = function() {
    if (!this.bountyUI) return;
    this.bountyUI.classList.remove('show', 'tk-banner-team-blue', 'tk-banner-team-red');
};

// 🌟 計時器改填進 scoreManager 建的計分牌匾中格（#hud-timer-slot），不自建獨立 DOM
GameModeManager.prototype._createTimerUI = function() {
    // 牌匾由 scoreManager 統一建立，這裡不需要建 DOM。
    // 保留空函式避免其他呼叫點報錯。
};

GameModeManager.prototype._onUpdateTeamGems = function(blueCount, redCount) {
    if (this.currentMode !== '3V3_BOUNTY' || this.isMatchOver) return;
    this.blueTeamGems = blueCount; this.redTeamGems = redCount;
    var leadingTeam = 'none';
    if (this.blueTeamGems >= this.targetGemsToWin && this.blueTeamGems > this.redTeamGems) leadingTeam = 'blue';
    if (this.redTeamGems >= this.targetGemsToWin && this.redTeamGems > this.blueTeamGems) leadingTeam = 'red';
    if (leadingTeam !== 'none') {
        if (!this.isCountdownActive || this.countdownTeam !== leadingTeam) {
            this.isCountdownActive = true; this.countdownTeam = leadingTeam; this.matchCountdown = this.countdownSeconds;
        }
    } else {
        if (this.isCountdownActive) {
            this.isCountdownActive = false; this.countdownTeam = 'none'; this.matchCountdown = 0;
        }
    }
};

/** 標記比賽結束並立刻通知 ScoreManager 鎖分／停傷 */
GameModeManager.prototype._markMatchOver = function() {
    this.isMatchOver = true;
    if (this.app.scoreManager && this.app.scoreManager.beginMatchEnding) {
        this.app.scoreManager.beginMatchEnding();
    }
};

GameModeManager.prototype.getBushIndex = function(x, z) {
    if (!this.bushes) return -1;
    for (var i = 0; i < this.bushes.length; i++) {
        var b = this.bushes[i];
        if (Math.abs(x - b.x) < b.hw && Math.abs(z - b.z) < b.hd) return i;
    }
    return -1;
};
GameModeManager.prototype.isInBush = function(x, z) { return this.getBushIndex(x, z) !== -1; };

GameModeManager.prototype.setBushTransparent = function(bushIndex, isTransparent) {
    if (bushIndex < 0 || bushIndex >= this.bushes.length) return;
    var bushData = this.bushes[bushIndex];
    if (!bushData || !bushData.entity) return;
    var comp = bushData.entity.render || bushData.entity.model;
    if (!comp || !comp.meshInstances) return;
    var meshes = comp.meshInstances;
    for (var i = 0; i < meshes.length; i++) {
        var mat = meshes[i].material;
        if (!mat) continue;
        if (isTransparent) { mat.blendType = pc.BLEND_NORMAL; mat.opacity = 0.4; } 
        else { mat.blendType = pc.BLEND_NONE; mat.opacity = 1.0; }
        mat.update();
    }
};

GameModeManager.prototype._createIntroUI = function() {
    this.introDiv = document.createElement('div');
    this.introDiv.id = 'brawl-intro-text';
    this.introDiv.className = 'tk-announcer-intro tk-announcer-intro-title';
    document.body.appendChild(this.introDiv);

    this._introFadeEl = document.createElement('div');
    this._introFadeEl.id = 'intro-fade-overlay';
    this._introFadeEl.style.cssText =
        'position:fixed;inset:0;background:#0a0806;opacity:0;pointer-events:none;z-index:5500;' +
        'transition:opacity 0.38s ease;';
    document.body.appendChild(this._introFadeEl);
};

GameModeManager.prototype._updateIntroFade = function(elapsed) {
    if (!this._introFadeEl) return;
    var fadeInStart = 2.5;
    var fadeInEnd = 3.1;
    if (elapsed < fadeInStart) {
        this._introFadeEl.style.opacity = '0';
    } else if (elapsed < fadeInEnd) {
        var t = (elapsed - fadeInStart) / (fadeInEnd - fadeInStart);
        this._introFadeEl.style.opacity = String(this._smoothstep(t));
    } else {
        this._introFadeEl.style.opacity = '1';
    }
};

GameModeManager.prototype._fadeOutIntro = function() {
    if (!this._introFadeEl) return;
    var el = this._introFadeEl;
    el.style.transition = 'opacity 0.45s ease';
    el.style.opacity = '0';
    setTimeout(function() {
        if (el) el.style.opacity = '0';
    }, 500);
};

GameModeManager.prototype._smoothstep = function(t) {
    t = Math.max(0, Math.min(1, t));
    return t * t * (3 - 2 * t);
};

GameModeManager.prototype._createAnnouncerUI = function() {
    this.announcerUI = document.createElement('div');
    this.announcerUI.id = 'knockout-announcer';
    this.announcerUI.className = 'tk-announcer-overlay';
    this.roundText = document.createElement('div');
    this.roundText.id = 'announcer-round';
    this.roundText.className = 'tk-announcer-round';
    this.resultText = document.createElement('div');
    this.resultText.id = 'announcer-result';
    this.resultText.className = 'tk-announcer-result';
    this.announcerUI.appendChild(this.roundText);
    this.announcerUI.appendChild(this.resultText);
    document.body.appendChild(this.announcerUI);
};

GameModeManager.prototype._showAnnouncer = function(titleText, winnerTeam) {
    if (!this.announcerUI || !this.roundText) return;
    this.roundText.innerText = titleText || '';
    this.roundText.style.display = titleText ? 'block' : 'none';
    var resultCopy = this._teamWinCopy(winnerTeam);
    if (resultCopy && this.resultText) {
        this.resultText.innerText = resultCopy;
        this.resultText.className = 'tk-announcer-result';
        if (winnerTeam === 'blue') this.resultText.classList.add('tk-announcer-team-blue');
        else if (winnerTeam === 'red') this.resultText.classList.add('tk-announcer-team-red');
        else if (winnerTeam === 'draw') this.resultText.classList.add('tk-announcer-draw');
        this.resultText.style.display = 'block';
    } else if (this.resultText) {
        this.resultText.style.display = 'none';
    }
    this.announcerUI.style.opacity = '1';
    var self = this;
    setTimeout(function() {
        if (self.roundText && titleText) self.roundText.style.transform = 'scale(1)';
        if (self.resultText && resultCopy) self.resultText.style.transform = 'scale(1)';
    }, 50);
};

GameModeManager.prototype._hideAnnouncer = function() {
    if (this.announcerUI) this.announcerUI.style.opacity = '0';
    if (this.roundText) this.roundText.style.transform = 'scale(0.88)';
    if (this.resultText) this.resultText.style.transform = 'scale(0.88)';
};

GameModeManager.prototype._onGameStart = function(data) {
    this.app._lastGameStart = data || null;
    // Prefer payload mode — app.gameMode may still be default 'FFA' when this runs before playerController.
    this.currentMode = GameModeManager.normalizeMode((data && data.mode) || this.app.gameMode || 'FFA');
    this.app.gameMode = this.currentMode;
    this._gemManagerCache = this.app.gemManager || null;
    this.blueWins = 0; this.redWins = 0; this.currentRound = 1; this.isRoundOver = false; this.isMatchOver = false; this._hideAnnouncer();
    this.gemSpawnTimer = this.gemSpawnInterval; this.blueTeamGems = 0; this.redTeamGems = 0; this.isCountdownActive = false; this.matchCountdown = 0;
    if (this.bountyUI) this._hideBountyBanner();

    // 🌟 設定全局時間 (Bounty/FFA = 180s, Knockout = 60s)
    if (this.currentMode === '3V3_KNOCKOUT') this.globalTimer = this.knockoutRoundDuration;
    else this.globalTimer = this.matchDuration;

    this._timerSlot = null; // 重置快取，下次 update 重新抓牌匾中格

    if (this.currentMode === 'PVE') { this.currentWave = 0; this.waveStatus = 'waiting'; } 
    else if (this.currentMode === 'ROGUE') { this.app.myTeam = 'blue'; } // 🎲 友傷判定與索敵豁免的地基
    else if (this.currentMode === '3V3_KNOCKOUT' || this.currentMode === '3V3_BOUNTY') { this.app.fire('knockout:updateScore', this.blueWins, this.redWins); }
    this.app.fire('network:clientReady'); 
};

GameModeManager.prototype._onRoundStart = function() {
    this.isRoundOver = false;
    this.globalTimer = this.knockoutRoundDuration; // Knockout 每局重置時間
};

GameModeManager.prototype.startIntroSequence = function() {
    // 宣傳拍攝：跳過一般倒數開場，改由 promoDirector 接管
    if (this.app._promoCapture) {
        this.app.gameState = 'promo';
        if (this.introDiv) this.introDiv.style.display = 'none';
        if (this._introFadeEl) this._introFadeEl.style.opacity = '0';
        this.app.fire('promo:begin');
        return;
    }
    this.app.gameState = 'intro';
    this._introTimer = GameModeManager.INTRO_DURATION;
    this.introStep = 4;
    if (this._introFadeEl) this._introFadeEl.style.opacity = '0';
    var activeMode = GameModeManager.normalizeMode(this.app.gameMode || this.currentMode || 'FFA');
    this._pulseIntro(this._introCopyForMode(activeMode), 'title');
    this.app.fire('camera:startIntro');
    // 開場鏡頭就位後立刻 bake 陰影（冷啟動進局否則可能整場偏黑／全黑）
    var selfIntro = this;
    this.app.once('postrender', function() {
        selfIntro._refreshShadowMapOnce();
        if (selfIntro.app.updateCanvasSize) selfIntro.app.updateCanvasSize();
    });
};

GameModeManager.prototype.startNextPVEWave = function() {
    this.currentWave++; this.waveStatus = 'playing';
    var waveTitle = (this.currentWave === this.maxWaves)
        ? GameModeManager.t('announcer.pve.finalBoss')
        : GameModeManager.t('announcer.pve.wave', { n: this.currentWave });
    this._showAnnouncer(waveTitle, ''); var self = this; setTimeout(function() { self._hideAnnouncer(); }, 2000);
    this.app.fire('pve:startWave', this.currentWave);
};

GameModeManager.prototype._getAlivePositions = function() {
    var positions = [];
    if (this.app.playerController && !this.app.playerController.isDead && this.app.playerController.player) {
        positions.push(this.app.playerController.player.getPosition());
    }
    var bCtrl = this._getBotCtrl();
    if (bCtrl && bCtrl.bots) {
        bCtrl.bots.forEach(function(b) {
            if (b.state === 'alive' && b.entity) positions.push(b.entity.getPosition());
        });
    }
    return positions;
};

GameModeManager.prototype._getSafestSpawn = function(spawnList) {
    if (!spawnList || spawnList.length === 0) return null;
    var alivePos = this._getAlivePositions();
    if (alivePos.length === 0) return spawnList[Math.floor(Math.random() * spawnList.length)];
    var bestSpot = spawnList[0];
    var maxMinDist = -1;
    for (var i = 0; i < spawnList.length; i++) {
        var spot = spawnList[i];
        var minDist = Infinity;
        for (var j = 0; j < alivePos.length; j++) {
            var p = alivePos[j];
            var d = Math.sqrt((spot.x-p.x)*(spot.x-p.x)+(spot.z-p.z)*(spot.z-p.z));
            if (d < minDist) minDist = d;
        }
        if (minDist > maxMinDist) { maxMinDist = minDist; bestSpot = spot; }
    }
    return bestSpot;
};

// ==========================================
// 🌟 核心更新迴圈
// ==========================================
GameModeManager.prototype.update = function(dt) {
    this._updateDoors(dt);   // 🌟 加這行
    if (this.app.gameState === 'promo') return;
    if (this.app.gameState === 'intro') {
        this._introTimer -= dt;
        var introElapsed = GameModeManager.INTRO_DURATION - this._introTimer;
        this._updateIntroFade(introElapsed);

        if (this._introTimer > 3.0) return;
        else if (this._introTimer > 0) {
            var currentStep = Math.ceil(this._introTimer);
            if (currentStep !== this.introStep) {
                this.introStep = currentStep;
                this._pulseIntro(String(currentStep), 'count');
            }
        } else {
            this.app.gameState = 'playing';
            this._fadeOutIntro();
            this._pulseIntro(GameModeManager.t('announcer.battle'), 'battle');
            // 戰鬥相機／單位就緒後再 bake 一次陰影（避開 intro 期間怪長影）
            var selfShadow = this;
            this.app.once('update', function() {
                selfShadow._refreshShadowMapOnce();
            });
            if (this.introDiv) {
                var selfDiv = this.introDiv;
                setTimeout(function() { if (selfDiv) selfDiv.style.display = 'none'; }, 1000);
            }
            if (this.currentMode === 'PVE') this.startNextPVEWave();
            else if (this.currentMode === 'ROGUE') this.app.fire('rogue:begin'); // 🎲 交棒 RogueDirector
            else if (this._isBountyMode()) {
                if (!this._isMultiplayerSession()) {
                    this.gemSpawnTimer = 0;
                    this.app.fire('bounty:spawnCenterGem');
                }
            }
        }
        return;
    }
    
    // 🌟 計時器 DOM 顯示 (支援 FFA, BOUNTY, KNOCKOUT)
    if (this.app.gameState === 'playing' && !this.isMatchOver && !this.isRoundOver && this.currentMode !== 'PVE' && this.currentMode !== 'ROGUE') {
        this.globalTimer -= dt;
        
        if (!this._timerSlot) this._timerSlot = document.getElementById('hud-timer-slot');
        var slot = this._timerSlot || document.getElementById('hud-timer-slot');
        if (slot) {
            var displayTime = Math.max(0, Math.ceil(this.globalTimer));
            var minutes = Math.floor(displayTime / 60);
            var seconds = displayTime % 60;
            slot.textContent = minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
            slot.classList.toggle('urgent', displayTime <= 10);
        }
        
        if (this.globalTimer <= 0) {
            var isMP_timeup = !!(this.app.networkManager && this.app.networkManager.socket && this.app.networkManager.socket.connected);
            if (!isMP_timeup) {
                this._handleTimeUp(); // 🌟 單機才本地判定時間到；多人等 server 的 game_over/ffaOver
            }
        }
    }
    
    if (this._isBountyMode() && this.app.gameState === 'playing' && !this.isMatchOver) {
        if (!this._isMultiplayerSession()) {
            var currentGemsOnFloor = 0;
            var gm = this._gemManagerCache || this.app.gemManager;
            if (!gm) {
                var gmNode = this.app.root.findByName('GemManager');
                if (gmNode && gmNode.script && gmNode.script.gemManager) {
                    gm = gmNode.script.gemManager;
                    this._gemManagerCache = gm;
                }
            }
            if (gm) currentGemsOnFloor = gm.gems.length;
            if (currentGemsOnFloor < 10) {
                this.gemSpawnTimer -= dt;
                if (this.gemSpawnTimer <= 0) {
                    this.gemSpawnTimer = this.gemSpawnInterval; this.app.fire('bounty:spawnCenterGem'); 
                }
            }
        }
        // Bounty 專屬的 15 秒結算倒數，依然使用正中間閃爍的 bountyUI
        if (this.isCountdownActive) {
            this.matchCountdown -= dt;
            if (this.matchCountdown <= 0) {
                this._markMatchOver(); this.app.timeScale = 0.3;
                var winner = this.countdownTeam;
                var self = this; setTimeout(function() {
                    self.app.timeScale = 1.0; self._showAnnouncer('', winner);
                    setTimeout(function() { if (self.app.scoreManager) self.app.scoreManager.endGame(winner); }, 3000);
                }, 1000);
            }
        }
    }

    if (this.currentMode === 'PVE' && this.waveStatus === 'playing' && !this.isMatchOver) {
        var allDead = true;
        var botCtrl = this._getBotCtrl();
        if (botCtrl) {
            var bots = botCtrl.bots;
            if (bots.length > 0) {
                for (var i = 0; i < bots.length; i++) { if (bots[i].state === 'alive') { allDead = false; break; } }
            } else { allDead = false; }
        }
        if (allDead) {
            this.waveStatus = 'cleared';
            if (this.currentWave >= this.maxWaves) {
                this.isMatchOver = true; this.app.timeScale = 0.3; var self = this;
                setTimeout(function() { self.app.timeScale = 1.0; self._showAnnouncer(GameModeManager.t('announcer.pve.victory'), ''); }, 1000);
            } else {
                this._showAnnouncer(GameModeManager.t('announcer.pve.waveClear'), ''); var self = this;
                setTimeout(function() { self.startNextPVEWave(); }, 3000);
            }
        }
    }
};

// ==========================================
// 🌟 核心功能：死亡監聽與模式結算判定
// ==========================================
GameModeManager.prototype._onPlayerDeath = function(deadEntityId) {
    if (this.isMatchOver) return;

    if (this.currentMode === 'ROGUE') return; // 🎲 ROGUE 死亡結算由 RogueDirector 處理

    if (this.currentMode === 'PVE') {
        if (deadEntityId === 'player') {
            this.waveStatus = 'gameover'; this.isMatchOver = true; this.app.timeScale = 0.3; var self = this;
            setTimeout(function() { self.app.timeScale = 1.0; self._showAnnouncer(GameModeManager.t('announcer.pve.youDied'), ''); }, 1000);
        }
        return; 
    }

    // 🌟 FFA：完全鎖死重生 (所有角色一命)
    if (this.currentMode === 'FFA') {
        // 🌟 多人模式：死亡鎖重生與結束判定都由 server 處理，客戶端讓位
        var isMP_ffaDeath = !!(this.app.networkManager && this.app.networkManager.socket && this.app.networkManager.socket.connected);
        if (isMP_ffaDeath) return;
        if (deadEntityId === 'player' && this.app.playerController) {
            this.app.playerController.respawnTimer = Infinity; // 玩家一命
            if (this.app.playerController.deathMessage) {
                this.app.playerController.deathMessage.enabled = true;
                this.app.playerController.deathMessage.element.text = GameModeManager.t('announcer.ffa.dead');
            }
        } else {
            var bCtrl = this._getBotCtrl();
            if (bCtrl && bCtrl.bots) {
                for (var i = 0; i < bCtrl.bots.length; i++) {
                    var bot = bCtrl.bots[i];
                    if (bot.entity && (bot.entity.getGuid() === deadEntityId || bot.entity.name === deadEntityId)) {
                        bot.respawnTimer = Infinity; // 阻斷所有 Bot 復活
                        break;
                    }
                }
            }
        }
        var self = this;
        if (this._ffaCheckTimer) clearTimeout(this._ffaCheckTimer);
        this._ffaCheckTimer = setTimeout(function() { self._checkFFALastManStanding(); }, 100);
        return;
    }

    if (this.currentMode === '3V3_KNOCKOUT') {
        if (this.isRoundOver) return;
        var self = this; 
        if (this._deathCheckTimer) clearTimeout(this._deathCheckTimer);
        this._deathCheckTimer = setTimeout(function() { self._checkKnockoutRoundStatus(); }, 100);
    }
};

// 🌟 接收 server 權威時間，校正本地計時器（多人模式同步）
GameModeManager.prototype._onSyncTimer = function(serverTime) {
    if (serverTime === undefined || serverTime === null) return;
    // 軟校正：偏差小於 1.5 秒時讓本地繼續平滑倒數，偏差過大才硬拉，避免每秒跳動
    if (this.globalTimer === undefined || Math.abs(this.globalTimer - serverTime) > 1.5) {
        this.globalTimer = serverTime;
    } else {
        // 緩慢靠攏 server 時間（消除累積誤差但不跳動）
        this.globalTimer = this.globalTimer + (serverTime - this.globalTimer) * 0.3;
    }
};

// 🌟 全局時間到結算機制
GameModeManager.prototype._handleTimeUp = function() {
    if (this.isRoundOver || this.isMatchOver) return;
    

    if (this.currentMode === '3V3_KNOCKOUT') {
        this.isRoundOver = true;
        var blueAlive = 0; var redAlive = 0;
        var pCtrl = this.app.playerController;
        if (pCtrl && !pCtrl.isDead) { if (this.app.myTeam === 'blue') blueAlive++; else if (this.app.myTeam === 'red') redAlive++; }
        var bCtrl = this._getBotCtrl();
        if (bCtrl) {
            for (var i = 0; i < bCtrl.bots.length; i++) {
                if (bCtrl.bots[i].state === 'alive') { if (bCtrl.bots[i].team === 'blue') blueAlive++; else if (bCtrl.bots[i].team === 'red') redAlive++; }
            }
        }
        var roundWinner = 'draw';
        if (blueAlive > redAlive) roundWinner = 'blue';
        else if (redAlive > blueAlive) roundWinner = 'red';
        this._processKnockoutRoundEnd(roundWinner, GameModeManager.t('announcer.timeUp'));
    } 
    else if (this.currentMode === '3V3_BOUNTY') {
        this._markMatchOver();
        this.app.timeScale = 0.3;
        var winTeam = 'draw';
        var winTitle = GameModeManager.t('announcer.timeUp');
        if (this.blueTeamGems > this.redTeamGems) { winTeam = 'blue'; }
        else if (this.redTeamGems > this.blueTeamGems) { winTeam = 'red'; }
        
        var self = this;
        setTimeout(function() {
            self.app.timeScale = 1.0;
            self._showAnnouncer(winTitle, winTeam);
            setTimeout(function() { if (self.app.scoreManager) self.app.scoreManager.endGame(winTeam); }, 3000);
        }, 1000);
    }
    else if (this.currentMode === 'FFA') {
        this._checkFFALastManStanding(true); 
    }
};

GameModeManager.prototype._checkKnockoutRoundStatus = function() {
    if (this.isRoundOver || this.isMatchOver) return;
    var blueAlive = 0; var redAlive = 0;
    var pCtrl = this.app.playerController;
    if (pCtrl && !pCtrl.isDead) { if (this.app.myTeam === 'blue') blueAlive++; else if (this.app.myTeam === 'red') redAlive++; }
    var bCtrl = this._getBotCtrl();
    if (bCtrl) {
        for (var i = 0; i < bCtrl.bots.length; i++) {
            if (bCtrl.bots[i].state === 'alive') { if (bCtrl.bots[i].team === 'blue') blueAlive++; else if (bCtrl.bots[i].team === 'red') redAlive++; }
        }
    }
    if (blueAlive === 0 || redAlive === 0) {
        this.isRoundOver = true;
        var roundWinner = (blueAlive === 0) ? 'red' : 'blue';
        if (blueAlive === 0 && redAlive === 0) roundWinner = 'draw';
        this._processKnockoutRoundEnd(roundWinner);
    }
};

GameModeManager.prototype._processKnockoutRoundEnd = function(roundWinner, customTitle) {
    if (roundWinner === 'blue') this.blueWins++; else if (roundWinner === 'red') this.redWins++;
    this.app.timeScale = 0.3; this.app.fire('knockout:updateScore', this.blueWins, this.redWins);

    var announcerTitle = customTitle || this._roundOverCopy(this.currentRound);
    var self = this;
    
    setTimeout(function() {
        self.app.timeScale = 1.0; 
        self._showAnnouncer(announcerTitle, roundWinner);
        
        setTimeout(function() {
            if (self.blueWins >= self.targetWins || self.redWins >= self.targetWins) {
                self.isMatchOver = true; self._hideAnnouncer();
                if (self.app.scoreManager) self.app.scoreManager.endGame(roundWinner);
            } else {
                self.currentRound++; 
                self.isRoundOver = false; 
                self._hideAnnouncer(); 
                self.app.fire('round:start'); 
            }
        }, 2500);
    }, 1000);
};

GameModeManager.prototype._checkFFALastManStanding = function(forceEnd) {
    if (this.isMatchOver) return;

    // 🌟 多人模式：FFA 勝負由 server 判定，客戶端讓位（等 server:ffaOver / game_over）
    var isMP_ffa = !!(this.app.networkManager && this.app.networkManager.socket && this.app.networkManager.socket.connected);
    if (isMP_ffa) return;
    
    var aliveEntities = [];
    var pCtrl = this.app.playerController;
    if (pCtrl && !pCtrl.isDead) {
        aliveEntities.push({ id: 'player', name: this.app.playerName || 'Player' });
    }
    
    var bCtrl = this._getBotCtrl();
    if (bCtrl) {
        for (var i = 0; i < bCtrl.bots.length; i++) {
            var bot = bCtrl.bots[i];
            if (bot.state === 'alive' && bot.entity) {
                aliveEntities.push({ id: bot.entity.getGuid(), name: bot.entity.name || 'BOT' });
            }
        }
    }
    
    if (aliveEntities.length <= 1 || forceEnd) {
        this.isMatchOver = true;
        this.app.timeScale = 0.3;
        
        var winnerId = 'draw';
        var winTitle = GameModeManager.t('announcer.team.draw');
        
        if (aliveEntities.length === 1) {
            winnerId = aliveEntities[0].id;
            winTitle = GameModeManager.t('announcer.ffa.king', { name: aliveEntities[0].name });
        } else if (aliveEntities.length > 1 && forceEnd) {
            winTitle = GameModeManager.t('announcer.ffa.timeDraw');
        }
        
        var self = this;
        setTimeout(function() {
            self.app.timeScale = 1.0;
            self._showAnnouncer(winTitle, '');
            setTimeout(function() {
                if (self.app.scoreManager) self.app.scoreManager.endGame(winnerId);
            }, 3000);
        }, 1000);
    }
};

// ==========================================
// 🌟 輔助工具函數
// ==========================================
GameModeManager.prototype._getBotCtrl = function() {
    if (!this._botManagerCache) {
        var node = this.app.root.findByName('BotManager');
        if (node && node.script) this._botManagerCache = node.script.botController;
    }
    return this._botManagerCache;
};

GameModeManager.prototype.destroyBushesInArea = function(cx, cz, radius) {
    if (!this.bushes) return false;
    var radiusSq = radius * radius; 
    var destroyedAny = false;

    for (var i = 0; i < this.bushes.length; i++) {
        var b = this.bushes[i];
        if (b.destroyed) continue;           // 跳過已摧毀的
        if (b.isIndestructible) continue;    // 跳過不可摧毀的

        if ((b.x - cx) * (b.x - cx) + (b.z - cz) * (b.z - cz) <= radiusSq) {
            destroyedAny = true;
            
            if (b.entity && b.entity.enabled) {
                if (this.bushFxPool && this.bushFxPool.length > 0) {
                    var fxEnt = this.bushFxPool[this.bushFxIndex];
                    fxEnt.setPosition(b.x, 1.6, b.z);
                    fxEnt.setLocalScale(1.4, 1.4, 1.4);
                    fxEnt.enabled = true;
                    var ps = fxEnt.particlesystem || fxEnt.findComponent('particlesystem');
                    if (ps) { ps.reset(); ps.play(); }
                    this.bushFxIndex = (this.bushFxIndex + 1) % this.bushFxPool.length;
                }
                // 先關投影再 disable，避免同幀多棵燒毀時 shadow map 仍吃到舊 caster
                var bushRenders = b.entity.findComponents('render');
                for (var bri = 0; bri < bushRenders.length; bri++) {
                    bushRenders[bri].castShadows = false;
                }
                b.entity.enabled = false;
            }

            // 標記為已摧毀，不再 splice
            b.destroyed = true;
            b.entity = null;
        }
    }
    if (destroyedAny) this._refreshShadowMapOnce();
    return destroyedAny;
};

// 🧱 更新：不僅隱藏畫面，更徹底抹除物理碰撞與資料邊界
GameModeManager.prototype.destroyObstacle = function(cx, cz, radius) {
    if (!this.obstacles) return false;
    var radiusSq = radius * radius;
    var destroyedAny = false;

    for (var i = 0; i < this.obstacles.length; i++) {
        var obs = this.obstacles[i];
        
        // 檢查是否為可摧毀且尚未被摧毀
        if (!obs.destructible || obs.destroyed) continue;

        // 碰撞檢查 (使用圓形距離檢查)
        if ((obs.x - cx) * (obs.x - cx) + (obs.z - cz) * (obs.z - cz) <= radiusSq) {
            
            obs.destroyed = true;
            
            // ==========================================
            // 🌟 神級解法 1：資料層徹底抹殺
            // 將長寬歸零，座標移至地圖外。這樣不管哪個腳本讀取，都會判定「沒撞到」
            // ==========================================
            obs.hw = 0;
            obs.hd = 0;
            obs.x = 99;
            obs.z = 99;

            // ==========================================
            // 🌟 神級解法 2：物理層雙向拔除
            // ==========================================
            if (obs.entity) {
                // 1. 先關投影再隱藏，與 bush 相同避免同幀多毀時殘影
                var obsRenders = obs.entity.findComponents('render');
                for (var ori = 0; ori < obsRenders.length; ori++) {
                    obsRenders[ori].castShadows = false;
                }
                obs.entity.enabled = false; 
                
                // 2. 如果原生碰撞體掛在自己身上，強制關閉
                if (obs.entity.collision) obs.entity.collision.enabled = false;
                if (obs.entity.rigidbody) obs.entity.rigidbody.enabled = false;
                
                // 3. 致命盲區：PlayCanvas 的 GLB 模型，碰撞體通常在父節點！順手把父層碰撞也拔掉
                if (obs.entity.parent) {
                    if (obs.entity.parent.collision) obs.entity.parent.collision.enabled = false;
                    if (obs.entity.parent.rigidbody) obs.entity.parent.rigidbody.enabled = false;
                }
            }
            
            destroyedAny = true;
        }
    }
    if (destroyedAny) this._refreshShadowMapOnce();
    return destroyedAny;
};

/** Cast-once 陰影：摧毀可破壞物後重 bake。同幀多次請求會合併，並連刷 2 幀以免多棵 bush 殘影。 */
GameModeManager.prototype._refreshShadowMapOnce = function() {
    if (typeof GameSettings !== 'undefined' && GameSettings.resolveQuality
        && GameSettings.resolveQuality() === 'low') {
        return;
    }
    // postUpdate 再套 THISFRAME：等本幀所有 destroy 跑完；多刷一幀清掉延遲卸除的 caster
    this._shadowRefreshFrames = Math.max(this._shadowRefreshFrames || 0, 2);
};

GameModeManager.prototype._flushShadowRefresh = function() {
    if (!this._shadowRefreshFrames || this._shadowRefreshFrames <= 0) return;
    if (typeof GameSettings !== 'undefined' && GameSettings.resolveQuality
        && GameSettings.resolveQuality() === 'low') {
        this._shadowRefreshFrames = 0;
        return;
    }
    var lights = this.app.root.findComponents('light');
    for (var i = 0; i < lights.length; i++) {
        if (lights[i].type === 'directional' && lights[i].castShadows) {
            lights[i].shadowUpdateMode = pc.SHADOWUPDATE_THISFRAME;
        }
    }
    this._shadowRefreshFrames--;
};

GameModeManager.prototype.postUpdate = function() {
    this._flushShadowRefresh();
};

GameModeManager.prototype._nudgeOutOfObstacles = function(x, z) {
    for (var a = 0; a < 8; a++) {                       // 最多推8次(處理連排建築)
        var hit = null;
        for (var i = 0; i < this.obstacles.length; i++) {
            var o = this.obstacles[i];
            if (Math.abs(x - o.x) < o.hw + 0.6 && Math.abs(z - o.z) < o.hd + 0.6) { hit = o; break; }
        }
        if (!hit) return { x: x, z: z };
        var dx = x - hit.x, dz = z - hit.z;
        var px = (hit.hw + 0.7) * (dx >= 0 ? 1 : -1) - dx;   // 推到X邊界外需要的量
        var pz = (hit.hd + 0.7) * (dz >= 0 ? 1 : -1) - dz;   // 推到Z邊界外需要的量
        if (Math.abs(px) < Math.abs(pz)) x += px; else z += pz;  // 走最短的路推出去
    }
    return { x: x, z: z };
};

GameModeManager.prototype._updateDoors = function(dt) {
    if (!this.doors || !this.doors.length) return;
    var positions = this._getAlivePositions();
    var openRadiusSq = 9;
    var holdDuration = 1.2;

    for (var i = 0; i < this.doors.length; i++) {
        var d = this.doors[i];
        var anyoneNearby = false;

        for (var j = 0; j < positions.length; j++) {
            var dx = positions[j].x - d.x, dz = positions[j].z - d.z;
            if (dx * dx + dz * dz < openRadiusSq) {
                anyoneNearby = true;
                var side = (dx * d.fwd.x + dz * d.fwd.z) > 0 ? 1 : -1;
                if (!d.lockedSide) d.lockedSide = side;
                d.holdTimer = holdDuration;
                break;
            }
        }

        if (!anyoneNearby) d.holdTimer = Math.max(0, d.holdTimer - dt);

        var target = 0;
        if (d.lockedSide && (anyoneNearby || d.holdTimer > 0)) {
            target = -80 * d.lockedSide * d.hingeSide;
        }

        d.angle += (target - d.angle) * Math.min(1, dt * 10);
        d.entity.setLocalRotation(d.baseRot);
        d.entity.rotate(0, d.angle, 0);

        if (target === 0 && Math.abs(d.angle) < 1) {
            d.angle = 0;
            d.lockedSide = 0;
            d.holdTimer = 0;
        }
    }
};

GameModeManager.prototype.getBushIndex = function(x, z) {
    if (!this.bushes) return -1;
    for (var i = 0; i < this.bushes.length; i++) {
        var b = this.bushes[i];
        if (b.destroyed) continue;  // 🌟 加這行
        if (Math.abs(x - b.x) < b.hw && Math.abs(z - b.z) < b.hd) return i;
    }
    return -1;
};
