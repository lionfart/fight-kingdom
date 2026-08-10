var GemManager = pc.createScript('gemManager');

GemManager.attributes.add('gemTemplate', { type: 'entity', title: 'Gem Template (GLB)' });
GemManager.attributes.add('pickupRadius', { type: 'number', default: 1.5, title: '拾取判定半徑' });

GemManager.prototype.initialize = function() {
    this.gems = []; 
    this.gemIdCounter = 0;
    this._isMultiplayerSession = false;
    this.app.gemManager = this;

    // 🌟 單機模式事件監聽 (由 GameModeManager 或 PlayerController 觸發)
    this.app.on('bounty:spawnCenterGem', this._localSpawnCenterGem, this);
    this.app.on('bounty:dropGems', this._localDropGems, this);
    this.app.on('game:start', this._onGameStart, this);

    // 🌟 多人連線事件監聽 (由 NetworkManager 轉發伺服器指令)
    this.app.on('network:spawnGem', this._networkSpawnGem, this);
    this.app.on('network:dropGems', this._networkDropGems, this);
    this.app.on('network:gemPicked', this._networkGemPicked, this);

    this.on('destroy', function() {
        this.app.off('bounty:spawnCenterGem', this._localSpawnCenterGem, this);
        this.app.off('bounty:dropGems', this._localDropGems, this);
        this.app.off('game:start', this._onGameStart, this);
        this.app.off('network:spawnGem', this._networkSpawnGem, this);
        this.app.off('network:dropGems', this._networkDropGems, this);
        this.app.off('network:gemPicked', this._networkGemPicked, this);
        if (this.app.gemManager === this) this.app.gemManager = null;
    }, this);
};

// 僅在「本場為多人」且 socket 仍連線時才走伺服器權威邏輯
GemManager.prototype._isMultiplayer = function() {
    if (!this._isMultiplayerSession) return false;
    var nm = this.app.networkManager;
    return !!(nm && nm.socket && nm.socket.connected);
};

GemManager.prototype._resolveGemTemplate = function() {
    if (this.gemTemplate) return this.gemTemplate;
    var names = ['GemTemplate', 'Gem_Template', 'BountyGem', 'Gem'];
    for (var i = 0; i < names.length; i++) {
        var ent = this.app.root.findByName(names[i]);
        if (ent) {
            this.gemTemplate = ent;
            return ent;
        }
    }
    return null;
};

GemManager.prototype._ensureProceduralGemTemplate = function() {
    if (this._proceduralGemTemplate) return this._proceduralGemTemplate;
    var ent = new pc.Entity('GemTemplate_Procedural');
    ent.addComponent('render', { type: 'capsule' });
    ent.setLocalScale(0.35, 0.5, 0.35);
    var mat = new pc.StandardMaterial();
    mat.diffuse.set(0.15, 0.45, 1, 1);
    mat.emissive.set(0.2, 0.55, 1, 1);
    mat.emissiveIntensity = 1.5;
    mat.metal = 0.3;
    mat.shininess = 60;
    mat.update();
    if (ent.render && ent.render.meshInstances[0]) {
        ent.render.meshInstances[0].material = mat;
    }
    ent.enabled = false;
    this.app.root.addChild(ent);
    this._proceduralGemTemplate = ent;
    return ent;
};

GemManager.prototype._getSpawnTemplate = function() {
    return this._resolveGemTemplate() || this._ensureProceduralGemTemplate();
};

GemManager.prototype._getActiveMode = function() {
    var raw = (this.app.gameModeManager && this.app.gameModeManager.currentMode)
        || this.app.gameMode
        || 'FFA';
    var mode = String(raw).trim().toUpperCase().replace(/\s+/g, '_');
    if (mode === '3V3BOUNTY') return '3V3_BOUNTY';
    if (mode === '3V3KNOCKOUT') return '3V3_KNOCKOUT';
    return mode;
};

GemManager.prototype._isBountyMode = function() {
    return this._getActiveMode() === '3V3_BOUNTY';
};

GemManager.prototype._onGameStart = function(data) {
    this._isMultiplayerSession = !!(data && data.isMultiplayer);
    this._resolveGemTemplate();
    for (var i = 0; i < this.gems.length; i++) {
        if (this.gems[i].entity) this.gems[i].entity.destroy();
    }
    this.gems = [];
    this.gemIdCounter = 0;
    
    // 清空玩家寶石
    if (this.app.playerController && this.app.playerController.updateGemCount) {
        this.app.playerController.updateGemCount(0);
    }
    
    // 清空 AI 寶石
    if (this.app.botController) {
        var bots = this.app.botController.bots;
        for (var b = 0; b < bots.length; b++) {
            this.app.botController.updateGemCount(bots[b], 0);
        }
    }
    
    // 🔪 已移除冗餘的 this._recalculateTeamGems() 呼叫
};

// ==========================================
// 🌟 單機模式生成邏輯 (Local)
// ==========================================
GemManager.prototype._localSpawnCenterGem = function() {
    if (this._isMultiplayer() || !this._isBountyMode()) return;

    var angle = Math.random() * Math.PI * 2;
    var speed = 2.0 + Math.random() * 2.0; 
    var vx = Math.sin(angle) * speed;
    var vz = Math.cos(angle) * speed;
    var gemId = 'local_gem_' + (this.gemIdCounter++);
    
    this._createGem(gemId, 0, vx, vz, 0); 
};

GemManager.prototype._localDropGems = function(dropCount, x, z) {
    if (this._isMultiplayer() || !this._isBountyMode() || dropCount <= 0) return;
    
    for (var i = 0; i < dropCount; i++) {
        var angle = Math.random() * Math.PI * 2;
        var speed = 3.0 + Math.random() * 3.0; 
        var vx = Math.sin(angle) * speed;
        var vz = Math.cos(angle) * speed;
        var gemId = 'local_gem_' + (this.gemIdCounter++);
        
        this._createGem(gemId, x, vx, vz, z); 
    }
};

// ==========================================
// 🌟 多人連線生成邏輯 (Network)
// ==========================================
GemManager.prototype._networkSpawnGem = function(data) {
    if (!data) return;
    this._createGem(data.id, data.x, data.vx, data.vz, data.z);
};

GemManager.prototype._networkDropGems = function(data) {
    if (!data || !data.gems) return;
    for (var i = 0; i < data.gems.length; i++) {
        var g = data.gems[i];
        this._createGem(g.id, g.x, g.vx, g.vz, g.z);
    }
};

// 🌟 接收伺服器確認拾取
GemManager.prototype._networkGemPicked = function(data) {
    // 1. 刪除地上的寶石
    for (var i = this.gems.length - 1; i >= 0; i--) {
        if (this.gems[i].id === data.gemId) {
            this.gems[i].entity.destroy();
            this.gems.splice(i, 1);
            if (this.app.gameModeManager) this.app.gameModeManager.activeGemsOnFloor--;
            break;
        }
    }

    // 2. 更新撿到寶石的對象身上的 UI 與資料 (讓 ScoreManager 自己去抓這個最新資料)
    if (data.playerId === this.app.socketId && this.app.playerController) {
        var newCount = (this.app.playerController.gemCount || 0) + 1;
        this.app.playerController.updateGemCount(newCount);
    } 
    else {
        var isBot = false;
        if (this.app.botController) {
            var bots = this.app.botController.bots;
            for (var b = 0; b < bots.length; b++) {
                if (bots[b].id === data.playerId) {
                    var bCount = (bots[b].gemCount || 0) + 1;
                    this.app.botController.updateGemCount(bots[b], bCount);
                    isBot = true;
                    break;
                }
            }
        }
        
        if (!isBot && this.app.enemyManager && this.app.enemyManager.enemies[data.playerId]) {
            var enemy = this.app.enemyManager.enemies[data.playerId];
            enemy.gemCount = (enemy.gemCount || 0) + 1;
            if (this.app.floatingUIManager) {
                this.app.floatingUIManager.updateGems(enemy.entity, enemy.gemCount);
            }
        }
    }

    // 🔪 已移除冗餘的 GameModeManager 呼叫，徹底交給 ScoreManager 每幀掃描！
};

// ==========================================
// 🌟 核心：建立實體與物理數據
// ==========================================
GemManager.prototype._createGem = function(id, x, vx, vz, z) {
    var template = this._getSpawnTemplate();
    if (!template) return;
    var zPos = z !== undefined ? z : 0;
    var gemEnt = template.clone();
    this.app.root.addChild(gemEnt);
    gemEnt.enabled = true;
    gemEnt.setPosition(x, 1, zPos);

    this.gems.push({
        id: id,
        entity: gemEnt,
        x: x, y: 1, z: zPos,
        vx: vx, vy: 7, vz: vz, 
        isPickable: false,
        timer: 1.2, 
        bobTimer: Math.random() * 10
    });
};

GemManager.prototype.update = function(dt) {
    if (!this._isBountyMode() || this.app.gameState !== 'playing') return;

    var gravity = -20; 

    for (var i = this.gems.length - 1; i >= 0; i--) {
        var gemData = this.gems[i];
        var ent = gemData.entity;

        if (!ent || !ent.enabled) continue; 

        // 🌟 物理拋物線與彈跳
        if (!gemData.isPickable) {
            gemData.timer -= dt;
            gemData.vy += gravity * dt;
            gemData.x += gemData.vx * dt;
            gemData.y += gemData.vy * dt;
            gemData.z += gemData.vz * dt;

            // 觸地反彈邏輯
            if (gemData.y <= 0.5) {
                gemData.y = 0.5;
                if (gemData.vy < -3) {
                    gemData.vy = Math.abs(gemData.vy) * 0.4; 
                    gemData.vx *= 0.6; 
                    gemData.vz *= 0.6;
                } else {
                    gemData.vx = 0; gemData.vz = 0; gemData.vy = 0;
                }
            }
            if (gemData.timer <= 0) gemData.isPickable = true;
        } else {
            gemData.bobTimer += dt * 4;
            gemData.y = 0.5 + Math.sin(gemData.bobTimer) * 0.2;
        }

        ent.rotate(0, 120 * dt, 0); 
        ent.setPosition(gemData.x, gemData.y, gemData.z);

        // 🌟 拾取判定
        if (gemData.isPickable) {
            var picker = this._checkPickup(gemData.x, gemData.z, gemData.id);
            
            if (picker === 'pending') {
                gemData.isPickable = false;
                ent.enabled = false; 
            } 
            else if (picker) {
                var newCount = (picker.target.gemCount || 0) + 1;
                
                // 只管加到角色身上並通知頭頂 UI
                if (picker.type === 'player' && this.app.playerController) {
                    this.app.playerController.updateGemCount(newCount);
                    try { this.app.fire('sfx:gem'); } catch (eSfx) { /* ignore */ }
                } 
                else if (picker.type === 'bot' && this.app.botController) {
                    this.app.botController.updateGemCount(picker.target, newCount);
                } 
                else {
                    picker.target.gemCount = newCount; 
                }

                // 清除掉地上的寶石
                ent.destroy();
                this.gems.splice(i, 1);
                if (this.app.gameModeManager) this.app.gameModeManager.activeGemsOnFloor--;
                
                // 🔪 已移除冗餘的 this._recalculateTeamGems() 呼叫
            }
        }
    }
};

GemManager.prototype._checkPickup = function(gx, gz, gemId) {
    var radius = this.pickupRadius;
    var pCtrl = this.app.playerController;
    
    // 檢查本機玩家
    if (pCtrl && pCtrl.player && !pCtrl.isDead) {
        var pos = pCtrl.player.getPosition();
        if (Math.abs(pos.x - gx) < radius && Math.abs(pos.z - gz) < radius) {
            if (this._isMultiplayer()) {
                this.app.networkManager.socket.emit('tryPickupGem', { gemId: gemId });
                return 'pending';
            } else {
                return { type: 'player', target: pCtrl, team: this.app.myTeam };
            }
        }
    }

    // 檢查 AI (僅限單機有效)
    if (this.app.botController) {
        var bots = this.app.botController.bots;
        for (var i = 0; i < bots.length; i++) {
            if (bots[i].state === 'alive') {
                var bPos = bots[i].entity.getPosition();
                if (Math.abs(bPos.x - gx) < radius && Math.abs(bPos.z - gz) < radius) {
                    if (!this._isMultiplayer()) {
                        return { type: 'bot', target: bots[i], team: bots[i].team };
                    }
                }
            }
        }
    }
    return null;
};