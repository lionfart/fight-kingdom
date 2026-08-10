var BulletManager = pc.createScript('bulletManager');

// 🌟 本命卡 stun 覆蓋：只有玩家攻擊才問 wordSystem，敵人零成本早退。
//    命中事件非每帧，多一次 O(1) 查表可忽略。不觸發回原 config 值。
BulletManager.prototype._resolveSigStun = function(b, comboIndex, baseStun) {
    if (!b || b.ownerType !== 'player') return baseStun;
    var ws = this.app && this.app.wordSystem;
    if (!ws || !ws.getSignatureEffect) return baseStun;
    // super 子彈 comboIndex 視為 -1（大招，只在 Lv3/every_hit 生效）
    var ci = this._sigComboIndex(b);
    if (comboIndex !== undefined && comboIndex !== null) ci = comboIndex;
    var v = ws.getSignatureEffect('stun', 'stunDuration', ci);
    // undefined = 沒裝效果本命 → 用 config 原值(rogue 外本體能力)
    // null      = 裝了本命卡但此段不觸發 → 完全接管,無 stun(config 原值讓位)
    // 數值      = 本命卡覆蓋值
    if (v === undefined) return baseStun;
    return (v === null) ? 0 : v;
};

BulletManager.prototype._sigComboIndex = function(b) {
    if (b.isSuper || (b.type && b.type.indexOf('super') === 0)) return -1;
    return this._bulletComboIndex(b);
};

BulletManager.prototype._resolveSigSnare = function(b, comboIndex, baseDur, baseMult) {
    if (!b || b.ownerType !== 'player') {
        return { snareDuration: baseDur, snareMultiplier: baseMult };
    }
    var ws = this.app && this.app.wordSystem;
    if (!ws || !ws.getSignatureEffect) {
        return { snareDuration: baseDur, snareMultiplier: baseMult };
    }
    var ci = this._sigComboIndex(b);
    if (comboIndex !== undefined && comboIndex !== null) ci = comboIndex;
    var dur = ws.getSignatureEffect('snare', 'snareDuration', ci);
    var mult = ws.getSignatureEffect('snare', 'snareMultiplier', ci);
    return {
        snareDuration: dur === undefined ? baseDur : (dur === null ? 0 : dur),
        snareMultiplier: mult === undefined ? baseMult : (mult === null ? 1 : mult)
    };
};

BulletManager.prototype._resolveSigDot = function(b, comboIndex, baseDot) {
    if (!b || b.ownerType !== 'player') return baseDot;
    var ws = this.app && this.app.wordSystem;
    if (!ws || !ws.getSignatureEffect) return baseDot;
    var ci = this._sigComboIndex(b);
    if (comboIndex !== undefined && comboIndex !== null) ci = comboIndex;
    var v = ws.getSignatureEffect('dot', 'dotConfig', ci);
    if (v === undefined) return baseDot;
    return v;
};

BulletManager.prototype._finalizeDotConfig = function(b, dotConfig) {
    if (!dotConfig || !b) return dotConfig;
    if (window.CombatResolver && CombatResolver.applyFireDotMods) {
        return CombatResolver.applyFireDotMods(this.app, b.ownerId, b.ownerType, dotConfig);
    }
    if (window.CombatResolver && CombatResolver.applyFireDotEnhance) {
        return CombatResolver.applyFireDotEnhance(this.app, b.ownerId, b.ownerType, dotConfig);
    }
    return dotConfig;
};

BulletManager.prototype._perTargetHitMeta = function(baseMeta, targetUnit) {
    var meta = baseMeta ? Object.assign({}, baseMeta) : {};
    if (window.CombatResolver && CombatResolver.hasFireDot) {
        meta._hadFireDotBeforeHit = CombatResolver.hasFireDot(targetUnit);
    }
    return meta;
};

BulletManager.prototype._tryAttackerBurnSplash = function(b, targetUnit, damage, hitMeta) {
    if (!b || !targetUnit || !damage || damage <= 0) return;
    if (!window.CombatResolver || !CombatResolver.tryBurnSplash) return;
    CombatResolver.tryBurnSplash(this.app, b.ownerId, b.ownerType, targetUnit, damage, hitMeta || {});
};

// 出招當下鎖定的段數（fireDelay 後仍正確）；無則 fallback 即時 comboIndex
BulletManager.prototype._bulletComboIndex = function(b) {
    if (b && b.comboIndex !== undefined && b.comboIndex !== null) return b.comboIndex;
    if (b && b.ownerType === 'player' && this.app.playerController) {
        return this.app.playerController.comboIndex;
    }
    return 0;
};

BulletManager.prototype.initialize = function() {
    this.app.bulletManager = this;
    this.bullets = [];
    this.damageZones = [];
    this.deployables = [];
    
    this.pendingNetworkHits = {};
    this.pendingLocalBotHits = {};
    this.healColor = new pc.Color(0, 1, 0); 
    
    this._botManager = null; 
    this._isMultiplayer = false; 
    this.hitFxs = [];

    // 每帧共用戰鬥目標快取（只快取「掃誰」，命中條件仍在各路徑 live 檢查）
    this._frameBotCtrl = null;
    this._frameBots = null;
    this._frameEnemyList = [];
    this._frameDeployables = null;
    this._frameLocalPlayer = null;
    this._frameMyTeam = null;
    this._frameMyId = 'player';
    // 同一輪齊射／burst 多彈命中：combo 收尾鏡頭只震一次
    this._lastComboShakeAt = 0;
};

BulletManager.prototype._getBotCtrl = function() {
    if (this.app.botController && this.app.botController.bots) {
        return this.app.botController;
    }
    if (!this._botManager) {
        var node = this.app.root.findByName('BotManager');
        if (node && node.script && node.script.botController) {
            this._botManager = node.script.botController;
        }
    }
    return this._botManager || this.app.botController || null;
};

/**
 * 每帧（或 ime lee 立即結算前）刷新一次單位清單。
 * bots 保持原陣列與索引（_queueLocalBotHit 依賴 index）；enemies 轉成可重用陣列避免每子彈 for-in。
 */
BulletManager.prototype._refreshCombatTargets = function() {
    this._frameBotCtrl = this._getBotCtrl();
    this._frameBots = (this._frameBotCtrl && this._frameBotCtrl.bots) ? this._frameBotCtrl.bots : null;

    var list = this._frameEnemyList;
    var n = 0;
    var enemyMgr = this.app.enemyManager;
    if (enemyMgr && enemyMgr.enemies) {
        for (var eid in enemyMgr.enemies) {
            if (!Object.prototype.hasOwnProperty.call(enemyMgr.enemies, eid)) continue;
            var slot = list[n];
            if (!slot) {
                slot = { id: eid, enemy: null };
                list[n] = slot;
            }
            slot.id = eid;
            slot.enemy = enemyMgr.enemies[eid];
            n++;
        }
    }
    list.length = n;

    this.deployables = this.deployables || [];
    this._frameDeployables = this.deployables;
    this._frameLocalPlayer = this.app.playerController;
    this._frameMyTeam = this.app.myTeam;
    this._frameMyId = this.app.socketId || 'player';
};

BulletManager.prototype._resolveBotIndex = function(botCtrl, botId, fallbackIndex) {
    if (!botCtrl || !botCtrl.bots) return -1;
    if (fallbackIndex >= 0 && botCtrl.bots[fallbackIndex] && botCtrl.bots[fallbackIndex].id === botId) {
        return fallbackIndex;
    }
    for (var i = 0; i < botCtrl.bots.length; i++) {
        if (botCtrl.bots[i].id === botId) return i;
    }
    return -1;
};

BulletManager.prototype._isOfflinePvEMode = function() {
    var mode = String(
        (this.app.gameModeManager && this.app.gameModeManager.currentMode) ||
        this.app.gameMode || ''
    ).trim().toUpperCase();
    return mode === 'ROGUE' || mode === 'PVE';
};

BulletManager.prototype._queueLocalBotHit = function(botId, botIndex, damage, attackerId, attackerType, hitMeta) {
    if (!this.pendingLocalBotHits[botId]) {
        this.pendingLocalBotHits[botId] = {
            botIndex: botIndex, damage: 0,
            attackerId: attackerId, attackerType: attackerType, hitMeta: hitMeta
        };
    }
    this.pendingLocalBotHits[botId].damage += damage;
};

BulletManager.prototype._applyPlayerPerfectCounter = function (hitMeta, damage) {
    if (!(damage > 0)) return hitMeta;
    hitMeta = hitMeta || {};
    if (hitMeta.isDotTick || hitMeta._perfectCounterApplied) return hitMeta;
    var pc = this.app.playerController;
    if (pc && pc._consumePerfectCounter) return pc._consumePerfectCounter(hitMeta);
    return hitMeta;
};

BulletManager.prototype._queueNetworkPlayerHit = function (targetId, damage, hitMeta, extras) {
    if (!(damage > 0)) return;
    if (!this.pendingNetworkHits[targetId]) {
        hitMeta = this._applyPlayerPerfectCounter(hitMeta, damage);
        this.pendingNetworkHits[targetId] = { damage: 0, hitMeta: hitMeta };
        if (extras) {
            for (var k in extras) {
                if (extras.hasOwnProperty(k)) this.pendingNetworkHits[targetId][k] = extras[k];
            }
        }
    }
    this.pendingNetworkHits[targetId].damage += damage;
};

BulletManager.prototype._resolveConfig = function(b) {
    if (b.brawlerType && window.BrawlerConfig) return window.BrawlerConfig[b.brawlerType] || {};
    if (b.ownerType === 'player' && this.app.playerController) {
        var pType = this.app.playerController.brawlerType;
        if (pType && window.BrawlerConfig) return window.BrawlerConfig[pType] || {};
    }
    if (b.ownerType === 'bot') {
        var botCtrl = this._getBotCtrl();
        if (botCtrl) {
            var bot = botCtrl.bots.find(function(x) { return x.id === b.ownerId; });
            if (bot && bot.config) return bot.config;
        }
    }
    if (b.ownerType === 'enemy' && this.app.enemyManager) {
        var enemy = this.app.enemyManager.enemies[b.ownerId];
        if (enemy && enemy.config) return enemy.config;
    }
    return {};
};

// 🌟 dash 用：從 ownerType/ownerId 反查主人的 entity（讓判定跟隨身體）
BulletManager.prototype._getOwnerEntity = function(b) {
    if (b.ownerType === 'player' && this.app.playerController) {
        return this.app.playerController.player || null;
    }
    if (b.ownerType === 'bot') {
        var botCtrl = this._getBotCtrl();
        if (botCtrl) {
            var bot = botCtrl.bots.find(function(x) { return x.id === b.ownerId; });
            if (bot && bot.entity) return bot.entity;
        }
    }
    if (b.ownerType === 'enemy' && this.app.enemyManager) {
        var enemy = this.app.enemyManager.enemies[b.ownerId];
        if (enemy && enemy.entity) return enemy.entity;
    }
    return null;
};

BulletManager.prototype.addBullet = function(bulletData) {
    bulletData.life = 0;
    bulletData._hasTriggeredFeedback = false; 
    bulletData._hitStopTriggered = false; 
    
    if (!bulletData.hitTargets) bulletData.hitTargets = new Set();
    
    bulletData.config = bulletData.config || this._resolveConfig(bulletData);
    bulletData.skillConf = bulletData.config;
    
    if (bulletData.isSuper && bulletData.config.super && !bulletData.config.attackPattern) {
        bulletData.skillConf = bulletData.config.super;
    }

    if (bulletData.bulletFlip === undefined) {
        bulletData.bulletFlip = !!(bulletData.skillConf && bulletData.skillConf.bulletFlip) ||
            !!(bulletData.config && bulletData.config.bulletFlip);
    }

    if (bulletData.type === 'imelee') {
        bulletData.attackPos = { x: bulletData.startX, z: bulletData.startZ };
        this._resolveInstantMeleeHit(bulletData);
        bulletData.damage = 0;
        if (bulletData.entity) this._setBulletOpacity(bulletData, 1); // 🌟 重置淡出
    }

    if (bulletData.type === 'super_homing_bomb' || bulletData.type === 'homing') {
        bulletData.state = 'lobbing'; 
        bulletData.chaseTimer = 0; 
    }

    // 🌟 回力標：去程 outbound → 掉頭 → 回程 inbound（追主人現在位置）
    if (bulletData.type === 'boomerang') {
        bulletData.state = 'outbound';
        bulletData.distTraveled = 0;
        // 去程一組去重、回程一組去重，讓同一敵人去回各吃一次傷害
        bulletData.hitTargetsReturn = new Set();
    }

    if (bulletData.type === 'lob' && bulletData.entity) {
        var lobSc = bulletData.entity.getLocalScale();
        bulletData._lobBaseScale = Math.abs(lobSc.x) || 1;
        if (bulletData.lobYaw === undefined) {
            bulletData.lobYaw = Math.atan2(bulletData.dirX, bulletData.dirZ);
        }
    }
    
    this.bullets.push(bulletData);
    
    if (bulletData.entity) {
        if (bulletData.entity.collision) bulletData.entity.collision.enabled = false;
        if (bulletData.entity.rigidbody) bulletData.entity.rigidbody.enabled = false;
    }
};

// 保留 bulletFlip：runtime 覆寫 scale 時只翻 X
BulletManager.prototype._setBulletVisualScale = function(b, sx, sy, sz) {
    if (!b || !b.entity) return;
    var flip = !!b.bulletFlip;
    var ax = Math.abs(sx);
    b.entity.setLocalScale(flip ? -ax : ax, sy, sz);
};

BulletManager.prototype.addDamageZone = function(zoneData) {
    zoneData.life = 0;
    if (zoneData.tickTimer === undefined) zoneData.tickTimer = zoneData.tickRate; 
    
    zoneData.config = zoneData.config || this._resolveConfig(zoneData);
    zoneData.skillConf = zoneData.config;

    if (zoneData.isSuper && zoneData.config.super && !zoneData.config.attackPattern) {
        zoneData.skillConf = zoneData.config.super;
    }
    
    this.damageZones.push(zoneData);
};

BulletManager.prototype.addDeployable = function(data) {
    data.flashTimer = 0;
    
    if (data.entity) {
        var hpFill = data.entity.findByName('HealthFill');
        if (hpFill) hpFill.enabled = false;
        var hpBg = data.entity.findByName('HealthBackground');
        if (hpBg) hpBg.enabled = false;

        var isEnemy = (this.app.gameMode === 'FFA') ? true : (data.team !== this.app.myTeam);
        var relation = isEnemy ? 'enemy' : 'ally';
        var deployableName = data.entity.name.indexOf('Tree') !== -1 ? 'Sacred Tree' : 'Decoy';

        if (this.app.floatingUIManager) {
            this.app.floatingUIManager.registerUI(data.entity, deployableName, data.maxHp, relation);
            this.app.floatingUIManager.updateHealth(data.entity, data.hp);
        }
    }

    this.deployables = this.deployables || []; 
    this.deployables.push(data);
};

// 🌟 決定命中特效外型：slash（斬擊）/ blunt（打擊）/ magic（魔法）
//   優先看技能設定 skillConf.hitFx（可精確指定，不受 pierce 等機制影響）
//   沒指定時，再用 b.type 猜一個合理預設
BulletManager.prototype._fxTypeFromBullet = function(b) {
    if (!b) return 'slash';

    // 1) 技能設定明確指定外型 → 直接採用（建議在每個技能 config 填 hitFx）
    var sc = b.skillConf;
    if (sc && sc.hitFx) {
        if (sc.hitFx === 'slash' || sc.hitFx === 'blunt' || sc.hitFx === 'magic') {
            return sc.hitFx;
        }
    }

    // 2) 後備：用機制類型猜外型
    switch (b.type) {
        case 'melee':
        case 'imelee':
                return 'slash';
        case 'wave':
        case 'pierce': 
        case 'super_pierce':
            return 'blunt';
        case 'explode':
        case 'homing':
        case 'super_homing_bomb':
        case 'lob':
            return 'magic';
        case 'boomerang':
            return 'slash';
        default:
            return 'blunt';
    }
};

BulletManager.prototype._applyAttackerFeedback = function(b, isComboFinish, isShakeComboFinish, hitPos, hitScale) {
    if (b._hasTriggeredFeedback) return;
    b._hasTriggeredFeedback = true;

    if (hitPos) {
        this.app.fire('fx:hit', hitPos, isComboFinish, this._fxTypeFromBullet(b));
    }

    var skillConf = b.skillConf || {};
    // 🌟 Brawl Stars 式震動：只有玩家的重擊(combo收尾)才震；同輪多彈（曹操三箭等）180ms 內只震一次
    if (isShakeComboFinish) {
        var now = Date.now();
        if (!this._lastComboShakeAt || (now - this._lastComboShakeAt) >= 180) {
            this._lastComboShakeAt = now;
            this.app.fire('camera:shake', 0.35);
        }
    } else if (skillConf.isEmptyAmmoFallback && skillConf.cameraShake && b.ownerType === 'player') {
        this.app.fire('camera:shake', skillConf.cameraShake);
    }
};

BulletManager.prototype.update = function(dt) {
    if (this.app.scoreManager && this.app.scoreManager.getState() === 'gameover') return;
    // 結算後凍結投射物命中，避免慢動作期間改寫勝負／分數
    if (this.app.gameModeManager && this.app.gameModeManager.isMatchOver) return;
    
    this._isMultiplayer = !!(this.app.networkManager && this.app.networkManager.socket && this.app.networkManager.socket.connected);
    this.deployables = this.deployables || [];
    this._refreshCombatTargets();

    this._updateBullets(dt);
    this._updateDamageZones(dt);
    this._updateDeployables(dt);
        
    for (var targetId in this.pendingNetworkHits) {
        var hitData = this.pendingNetworkHits[targetId];
        var payload = { targetId: targetId, damage: hitData.damage, hitMeta: hitData.hitMeta };
        if (hitData.maxHp) payload.maxHp = hitData.maxHp;
        if (hitData.dotConfig) payload.dotConfig = hitData.dotConfig;   // 🌟 DOT：傳給 server 權威 tick
        this.app.fire('network:hitPlayer', payload);
    }

    var botCtrl = this._getBotCtrl();
    for (var botId in this.pendingLocalBotHits) {
        var lHit = this.pendingLocalBotHits[botId];
        if (botCtrl) {
            var botIdx = this._resolveBotIndex(botCtrl, botId, lHit.botIndex);
            if (botIdx >= 0) {
                botCtrl.hitBot(botIdx, lHit.damage, lHit.attackerId, lHit.hitMeta);
            }
        }
        this._reportDamage(lHit.attackerId, lHit.attackerType, lHit.damage);
    }

    this.pendingNetworkHits = {};
    this.pendingLocalBotHits = {};
};

BulletManager.prototype._triggerMeleeHitStop = function(b, duration) {
    if (b._hitStopTriggered) return;
    b._hitStopTriggered = true;
};

BulletManager.prototype._updateDeployables = function(dt) {
    this.deployables = this.deployables || []; 
    for (var i = this.deployables.length - 1; i >= 0; i--) {
        var dep = this.deployables[i];
        dep.life += dt;
        
        if (dep.hp <= 0 || dep.life >= dep.maxLife) {
            if (dep.entity) {
                if (this.app.floatingUIManager) this.app.floatingUIManager.removeUI(dep.entity);
                dep.entity.destroy();
            }
            if (dep.linkedZone) dep.linkedZone.duration = 0; 
            this.deployables.splice(i, 1);
            continue;
        }
        
        if (dep.flashTimer > 0) {
            dep.flashTimer -= dt;
            if (dep.flashTimer <= 0 && this.app.combatManager) {
                this.app.combatManager.setEntityOpacity(dep.entity, 1.0);
            }
        }
    }
};

BulletManager.prototype._recycleBullet = function(bulletEntity) {
    if (!bulletEntity) return;
    var parent = bulletEntity.parent;
    var cm = this.app && this.app.combatManager;
    if (cm) {
        if (cm.restorePooledFxMaterials) cm.restorePooledFxMaterials(bulletEntity);
        if (parent && cm._purgeFxFromMeshCache) cm._purgeFxFromMeshCache(parent);
    }
    bulletEntity.reparent(this.app.root);   // 🌟 脫離攻擊者，避免隨攻擊者destroy陪葬
    bulletEntity.enabled = false;
    bulletEntity.setLocalScale(1, 1, 1);
    bulletEntity.setEulerAngles(0, 0, 0);
    bulletEntity.setPosition(0, -50, 0);
};

BulletManager.prototype._checkWallCollision = function(x, z, isDestroyer) {
    if (!this.app.gameModeManager || !this.app.gameModeManager.obstacles) return false;
    var obsList = this.app.gameModeManager.obstacles;
    for (var i = 0; i < obsList.length; i++) {
        var obs = obsList[i];
        if (obs.isWater) continue;
        if (obs.destroyed) continue;
        if (obs.destructible && isDestroyer) continue;
        if (Math.abs(x - obs.x) < obs.hw + 0.1 && Math.abs(z - obs.z) < obs.hd + 0.1) return true;
    }
    return false;
};

BulletManager.prototype._canHit = function(attackerTeam, targetTeam) {
    if (this.app.gameMode === '3V3_BOUNTY' || this.app.gameMode === '3V3_KNOCKOUT' || this.app.gameMode === 'ROGUE') {
        if (attackerTeam === 'none' || targetTeam === 'none') return true;
        return attackerTeam !== targetTeam;
    }
    return true;
};

BulletManager.prototype._isValidZoneTarget = function(zone, targetTeam) {
    if (zone.isHeal) return zone.ownerTeam === targetTeam || (zone.ownerTeam === 'none' && targetTeam === 'none');
    return this._canHit(zone.ownerTeam, targetTeam);
};

BulletManager.prototype._getClosestTargetForHoming = function(bombPos, ownerTeam, ownerId) {
    var bestDistSq = Infinity;
    var bestPos = null;
    
    var bots = this._frameBots;
    if (bots) {
        for (var j = 0; j < bots.length; j++) {
            if (bots[j].state !== 'alive' || bots[j].id === ownerId || !this._canHit(ownerTeam, bots[j].team)) continue;
            var bPos = bots[j].entity.getPosition();
            var distSq = (bPos.x - bombPos.x) * (bPos.x - bombPos.x) + (bPos.z - bombPos.z) * (bPos.z - bombPos.z);
            if (distSq < bestDistSq) { bestDistSq = distSq; bestPos = bPos; }
        }
    }
    
    var enemyList = this._frameEnemyList;
    for (var ei = 0; ei < enemyList.length; ei++) {
        var eid = enemyList[ei].id;
        var enemy = enemyList[ei].enemy;
        if (!enemy || enemy.hp <= 0 || enemy.s === 3 || eid === ownerId || !this._canHit(ownerTeam, enemy.team)) continue;
        var ePos = enemy.entity.getPosition();
        var distSq2 = (ePos.x - bombPos.x) * (ePos.x - bombPos.x) + (ePos.z - bombPos.z) * (ePos.z - bombPos.z);
        if (distSq2 < bestDistSq) { bestDistSq = distSq2; bestPos = ePos; }
    }
    
    var localPlayer = this._frameLocalPlayer;
    if (localPlayer && !localPlayer.isDead && !localPlayer._invincible) {
        var myId = this._frameMyId;
        if (ownerId !== myId && ownerId !== 'player' && this._canHit(ownerTeam, this._frameMyTeam)) {
            var pPos = localPlayer.player.getPosition();
            var distSq3 = (pPos.x - bombPos.x) * (pPos.x - bombPos.x) + (pPos.z - bombPos.z) * (pPos.z - bombPos.z);
            if (distSq3 < bestDistSq) { bestDistSq = distSq3; bestPos = pPos; }
        }
    }
    
    return bestPos;
};

BulletManager.prototype._updateBullets = function(dt) {
    var limitX = this.app.gameModeManager ? this.app.gameModeManager.mapLimitX : 11.5;
    var limitZ = this.app.gameModeManager ? this.app.gameModeManager.mapLimitZ : 10.0;

    for (var i = this.bullets.length - 1; i >= 0; i--) {
        var b = this.bullets[i];
        b.life += dt;
        
        var skillConf = b.skillConf || {};

        if (b.type === 'super_homing_bomb' || b.type === 'homing') {
            var lobDur = skillConf.lobDuration !== undefined ? skillConf.lobDuration : 0.8;
            var chaseSpeed = skillConf.chaseSpeed !== undefined ? skillConf.chaseSpeed : 5.5;
            var chaseDur = skillConf.chaseTime !== undefined ? skillConf.chaseTime : 2.0;
            
            var actualLobSpeed = skillConf.lobSpeed !== undefined ? skillConf.lobSpeed : b.speed;
            var bPos = b.entity.getPosition();

            if (b.state === 'lobbing') {
                var pr = b.life / lobDur;
                if (pr >= 1.0) {
                    b.state = 'chasing';
                    b.startX = bPos.x;
                    b.startZ = bPos.z;
                } else {
                    var lobH = skillConf.lobHeight !== undefined ? skillConf.lobHeight : 4;
                    var curX = b.startX + b.dirX * actualLobSpeed * b.life; 
                    var curZ = b.startZ + b.dirZ * actualLobSpeed * b.life;
                    var curY = 0.5 + 4 * lobH * pr * (1 - pr);
                    b.entity.setPosition(curX, curY, curZ);
                    
                    if (this.app.combatManager) {
                        var animNode = this.app.combatManager.findAnimEntity(b.entity);
                        if (animNode && animNode.anim) animNode.anim.setFloat('speed', 1.0);
                    }
                }
            } 
            else if (b.state === 'chasing') {
                b.chaseTimer += dt;
                if (b.chaseTimer >= chaseDur) {
                    b.explodeRadius = skillConf.explodeRadius;
                    b.explodeDamage = skillConf.explodeDamage;
                    this._triggerExplosion(b);
                    this._recycleBullet(b.entity);
                    this.bullets.splice(i, 1);
                    continue;
                }

                var targetPos = this._getClosestTargetForHoming(bPos, b.ownerTeam, b.ownerId);
                if (targetPos) {
                    var dx = targetPos.x - bPos.x;
                    var dz = targetPos.z - bPos.z;
                    var dist = Math.sqrt(dx * dx + dz * dz); 
                    if (dist > 0.1) {
                        b.dirX = dx / dist;
                        b.dirZ = dz / dist;
                    }
                }

                var newX = bPos.x + b.dirX * chaseSpeed * dt;
                var newZ = bPos.z + b.dirZ * chaseSpeed * dt;
                
                newX = pc.math.clamp(newX, -limitX, limitX);
                newZ = pc.math.clamp(newZ, -limitZ, limitZ);

                var finalX = bPos.x; var finalZ = bPos.z;
                if (!this._checkWallCollision(newX, bPos.z, b.skillConf && b.skillConf.destroyBush)) finalX = newX;
                if (!this._checkWallCollision(bPos.x, newZ, b.skillConf && b.skillConf.destroyBush)) finalZ = newZ;
                
                b.entity.setPosition(finalX, 0, finalZ);
                
                var angle = Math.atan2(b.dirX, b.dirZ) * (180 / Math.PI);
                b.entity.setEulerAngles(0, angle, 0);

                this._checkBulletHit(b, i, b.entity.getPosition());
            }
            continue; 
        }
        // 🌟 dash：判定跟隨主人位置，圓形穿透判定，不自己移動/不推身體
        if (b.type === 'dash') {
            var owner = this._getOwnerEntity(b);
            if (owner) {
                var oPos = owner.getPosition();
                var off = skillConf.dashOffset || 0;
                // 沿發射方向偏移（dirX/dirZ 是發射時鎖定的方向，不追面向）
                b.entity.setPosition(
                    oPos.x + b.dirX * off,
                    oPos.y,
                    oPos.z + b.dirZ * off
                );
            }

            // 到期回收
            if (b.life >= b.maxLife) {
                this._recycleBullet(b.entity);
                this.bullets.splice(i, 1);
                continue;
            }

            // 每帧做圓形判定（hitTargets 去重，穿透不重置）
            this._checkBulletHit(b, i, b.entity.getPosition());
            continue;
        }

        // 🌟 回力標：去程直線飛出 → 到距離/撞牆掉頭 → 回程追主人現在位置 → 接住回收
        if (b.type === 'boomerang') {
            var bPosBoom = b.entity.getPosition();
            var spd = b.speed;
            var spin = skillConf.boomerangSpin !== undefined ? skillConf.boomerangSpin : 720;
            var moveStep = spd * dt;

            // 自轉（純視覺）
            b.entity.rotateLocal(0, spin * dt, 0);

           if (b.state === 'outbound') {
            var maxDist = skillConf.boomerangDistance !== undefined ? skillConf.boomerangDistance : 6.0;
            var curveAmt = skillConf.boomerangCurve !== undefined ? skillConf.boomerangCurve : 0;
            var curveDir = skillConf.boomerangCurveDir !== undefined ? skillConf.boomerangCurveDir : 1;

            b.distTraveled += moveStep;
            if (b.distTraveled > maxDist) b.distTraveled = maxDist;

            var prog = b.distTraveled / maxDist;           // 去程進度 0→1

            // 沿發射方向(用發射時鎖定的 launchDirX/Z)的前進量
            var forwardDist = b.distTraveled;
            var fx = b.launchDirX * forwardDist;
            var fz = b.launchDirZ * forwardDist;

            // 垂直發射方向的側偏(把 launchDir 旋轉 90°),sin 弧:兩端 0、中間最大
            var sideOffset = Math.sin(prog * Math.PI) * curveAmt * curveDir;
            var perpX = b.launchDirZ;    // (dirX, dirZ) 旋轉 90° = (dirZ, -dirX)
            var perpZ = -b.launchDirX;
            var sx = perpX * sideOffset;
            var sz = perpZ * sideOffset;

            var nextX = b.startX + fx + sx;
            var nextZ = b.startZ + fz + sz;

            // 撞牆 / 出界提前掉頭
            var hitWall = this._checkWallCollision(nextX, nextZ, b.skillConf && b.skillConf.destroyBush);
            var outB = (nextX > limitX || nextX < -limitX || nextZ > limitZ || nextZ < -limitZ);

            if (hitWall || outB || b.distTraveled >= maxDist) {
                b.state = 'inbound';
            } else {
                b.entity.setPosition(nextX, bPosBoom.y, nextZ);
            }

            if (this.bullets[i] === b) this._checkBulletHit(b, i, b.entity.getPosition());
        }
            else { // inbound 回程：追主人現在位置
                var ownerBoom = this._getOwnerEntity(b);
                if (!ownerBoom) {
                    // 主人不在了（死亡等），直接回收
                    this._recycleBullet(b.entity);
                    this.bullets.splice(i, 1);
                    continue;
                }
                var oPosBoom = ownerBoom.getPosition();
                var dxBoom = oPosBoom.x - bPosBoom.x;
                var dzBoom = oPosBoom.z - bPosBoom.z;
                var distBoom = Math.sqrt(dxBoom * dxBoom + dzBoom * dzBoom);

                var catchDist = skillConf.boomerangCatchDist !== undefined ? skillConf.boomerangCatchDist : 1.0;
                if (distBoom <= catchDist) {
                    // 飛回主人身邊，接住回收
                    this._recycleBullet(b.entity);
                    this.bullets.splice(i, 1);
                    continue;
                }

                if (distBoom > 0.01) {
                    b.dirX = dxBoom / distBoom;
                    b.dirZ = dzBoom / distBoom;
                }
                b.entity.setPosition(bPosBoom.x + b.dirX * moveStep, bPosBoom.y, bPosBoom.z + b.dirZ * moveStep);

                // 回程判定：暫時換成回程的去重集合，讓同一敵人能再吃一次傷害
                var savedHitTargets = b.hitTargets;
                b.hitTargets = b.hitTargetsReturn;
                this._checkBulletHit(b, i, b.entity.getPosition());
                // _checkBulletHit 內不會 splice boomerang，但保險起見確認還在才還原
                if (this.bullets[i] === b) b.hitTargets = savedHitTargets;
            }

            // 安全上限（正常會在回程接住時提前回收）
            if (this.bullets[i] === b && b.life >= b.maxLife) {
                this._recycleBullet(b.entity);
                this.bullets.splice(i, 1);
            }
            continue;
        }

        if (b.life >= b.maxLife) {
            if (b.type === 'lob') {
                var lobEndT = b.maxLife;
                var lobBaseY = b.lobBaseY !== undefined ? b.lobBaseY : 0.5;
                b.entity.setPosition(
                    b.startX + b.dirX * b.speed * lobEndT,
                    lobBaseY,
                    b.startZ + b.dirZ * b.speed * lobEndT
                );
                this._createDamageZone(b);
            }
            if (b.type === 'explode') this._triggerExplosion(b); 
            if (b.type === 'super_pierce' || b.type === 'pierce') {
                b.entity.destroy(); 
            } else {
                this._recycleBullet(b.entity);
            }
            this.bullets.splice(i, 1);
            continue;
        }

        if (b.type === 'lob') {
            var lobT = Math.min(b.life, b.maxLife);
            var lobDur = b.maxLife;
            var pr = lobDur > 0 ? lobT / lobDur : 1;
            var lobH = b.lobHeight !== undefined ? b.lobHeight : (skillConf.lobHeight !== undefined ? skillConf.lobHeight : 3);
            var lobBaseY = b.lobBaseY !== undefined ? b.lobBaseY : 0.5;
            var curX = b.startX + b.dirX * b.speed * lobT;
            var curZ = b.startZ + b.dirZ * b.speed * lobT;
            var curY = lobBaseY + 4 * lobH * pr * (1 - pr);
            b.entity.setPosition(curX, curY, curZ);

            var lobYaw = b.lobYaw !== undefined ? b.lobYaw : Math.atan2(b.dirX, b.dirZ);
            var vy = lobDur > 0 ? (4 * lobH / lobDur) * (1 - 2 * pr) : 0;
            var pitch = Math.atan2(vy, Math.max(b.speed, 0.01)) * (180 / Math.PI);
            b.entity.setEulerAngles(pitch, lobYaw * (180 / Math.PI), 0);

            var baseSc = b._lobBaseScale !== undefined ? b._lobBaseScale : 1;
            var s = baseSc * (1 + pr * 0.12);
            this._setBulletVisualScale(b, s, s, s);

        } else if (b.type === 'wave') {
            var wPos = b.entity.getPosition();
            var newX = wPos.x + b.dirX * b.speed * dt;
            var newZ = wPos.z + b.dirZ * b.speed * dt;
            b.entity.setPosition(newX, wPos.y, newZ);
            
            var isSuperRoar = (skillConf.type === 'super_zhangfei_roar');
            var maxSc = isSuperRoar ? (skillConf.maxScale || 6.0) : (skillConf.maxScale || 4.0);
            var baseHitRadius = isSuperRoar ? (skillConf.baseHitRadius || 2.0) : (skillConf.baseHitRadius || 1.0);
            var maxHitRadius = isSuperRoar ? (skillConf.maxHitRadius || 6.0) : (skillConf.maxHitRadius || 4.0);
            
            var sc = 1 + (b.life / b.maxLife) * (maxSc - 1); 
            this._setBulletVisualScale(b, sc, 1, sc);
            b.currentHitRadius = baseHitRadius + (b.life / b.maxLife) * (maxHitRadius - baseHitRadius); 

            if (this._checkWallCollision(newX, newZ, b.skillConf && b.skillConf.destroyBush)) { 
                this._recycleBullet(b.entity);
                this.bullets.splice(i, 1);
                continue;
            }

        } else if (b.type === 'super_pierce' || b.type === 'pierce') {
            var pPos = b.entity.getPosition();
            var newX = pPos.x + b.dirX * b.speed * dt;
            var newZ = pPos.z + b.dirZ * b.speed * dt;
            b.entity.setPosition(newX, pPos.y, newZ);

          } else if (b.type === 'imelee') {
            // 🌟 三段式重斬編排：弧線掃過(揮) → 滯留 → 淡出微膨脹
            var pr = b.life / b.maxLife;
            var sweep = (b.skillConf && b.skillConf.sweepConfig) || {};
            var targetScale = b.skillConf.bulletScale !== undefined ? b.skillConf.bulletScale : 1.0;
            var snapRatio = sweep.snapRatio !== undefined ? sweep.snapRatio : 0.25; // 揮擊佔生命比例
            var snapDist  = sweep.snapDist  !== undefined ? sweep.snapDist  : 1.2;  // 甩出半徑
            var sweepFrom = sweep.sweepFrom !== undefined ? sweep.sweepFrom : 0;    // 起手角(度,相對面向)
            var sweepTo   = sweep.sweepTo   !== undefined ? sweep.sweepTo   : 0;    // 收刀角
            var fadeStart = sweep.fadeStart !== undefined ? sweep.fadeStart : 0.5;
            var scaleFrom = sweep.scaleFrom !== undefined ? sweep.scaleFrom : 0.7;
            var endScale  = sweep.endScale  !== undefined ? sweep.endScale  : 1.08;
            var power     = sweep.easePower !== undefined ? sweep.easePower : 5;

            var eased = 1 - Math.pow(1 - Math.min(pr / snapRatio, 1), power);

            // 極座標：角度掃弧 + 半徑甩出，共用 ease（鞭出去、減速收刀）
            if (b._baseAng === undefined) b._baseAng = Math.atan2(b.dirX, b.dirZ);
            var ang = b._baseAng + pc.math.lerp(sweepFrom, sweepTo, eased) * pc.math.DEG_TO_RAD;
            var r = snapDist * eased;
            var ePos = b.entity.getPosition();
            b.entity.setPosition(b.startX + Math.sin(ang) * r, ePos.y, b.startZ + Math.cos(ang) * r);
            b.entity.setEulerAngles(0, ang * pc.math.RAD_TO_DEG, 0);

            var sc;
            if (pr < fadeStart) {
                sc = pc.math.lerp(scaleFrom, 1, eased) * targetScale;
                this._setBulletOpacity(b, 1);
            } else {
                var f = (pr - fadeStart) / (1 - fadeStart);
                sc = pc.math.lerp(1, endScale, f) * targetScale;
                this._setBulletOpacity(b, 1 - f);
            }
            this._setBulletVisualScale(b, sc, sc, sc);
        
        
        }else {
            var nPos = b.entity.getPosition();
            var newX = nPos.x + b.dirX * b.speed * dt;
            var newZ = nPos.z + b.dirZ * b.speed * dt;
            b.entity.setPosition(newX, nPos.y, newZ);

            if (this._checkWallCollision(newX, newZ, b.skillConf && b.skillConf.destroyBush)) { 
                if (b.type === 'explode') this._triggerExplosion(b);
                this._recycleBullet(b.entity); 
                this.bullets.splice(i, 1);
                continue;
            }
        }

        if (skillConf.destroyBush && this.app.gameModeManager && this.app.gameModeManager.destroyBushesInArea) {
            var curPos = b.entity.getPosition();
            var clearRadius = b.currentHitRadius || skillConf.bulletHitRadius || skillConf.hitRadius || 1.5;
            this.app.gameModeManager.destroyBushesInArea(curPos.x, curPos.z, clearRadius + 0.5);
            if (this.app.gameModeManager.destroyObstacle) {
                this.app.gameModeManager.destroyObstacle(curPos.x, curPos.z, clearRadius + 0.5);
            }
        }

        if (this.bullets[i]) {
            this._checkBulletHit(b, i, b.entity.getPosition());
        }
    }
};

BulletManager.prototype._checkBulletHit = function(b, bulletIndex, cachedPos) {
     if (!b.entity.enabled || b.type === 'lob' || b.state === 'lobbing' || b.type === 'imelee') return;
    
    var bPos = cachedPos || b.entity.getPosition(); 
    var skillConf = b.skillConf || {};
    
    var comboIndex = this._bulletComboIndex(b);
    var resolvedSnare = this._resolveSigSnare(b, comboIndex, skillConf.snareDuration, skillConf.snareMultiplier);
    var resolvedDot = this._finalizeDotConfig(b, this._resolveSigDot(b, comboIndex, skillConf.dotConfig));
    
    var textScale = skillConf.textScaleMultiplier !== undefined ? skillConf.textScaleMultiplier : 1.0;
    var isComboFinish = (textScale >= 1.5); // 視覺/浮字用，不代表要震動
    var isShakeComboFinish = (b.ownerType === 'player' && comboIndex === 2);
    var hitScale = textScale >= 1.5 ? textScale : (1.5 + comboIndex * 0.5);

    var meleeHitStopDuration = isComboFinish ? 0.12 : 0.07;

    var hitMeta = { 
        isCombo: isComboFinish, 
        scale: hitScale,
        stunDuration: this._resolveSigStun(b, comboIndex, skillConf.stunDuration),
        snareDuration: resolvedSnare.snareDuration,
        snareMultiplier: resolvedSnare.snareMultiplier,
        flinchAmount: skillConf.flinchAmount,           
        knockbackDist: skillConf.knockbackDist !== undefined ? skillConf.knockbackDist : 0,
        hitAngle: Math.atan2(b.dirX, b.dirZ)
    }; 
    
    var hitRadius;
    if (b.type === 'wave') { hitRadius = b.currentHitRadius || (skillConf.maxHitRadius !== undefined ? skillConf.maxHitRadius : 4.0); } 
    else if (b.type === 'melee') { hitRadius = skillConf.bulletHitRadius !== undefined ? skillConf.bulletHitRadius : 2.0; } 
    else if (b.type === 'dash') {
        hitRadius = skillConf.dashHitRadius !== undefined ? skillConf.dashHitRadius
            : (skillConf.bulletHitRadius !== undefined ? skillConf.bulletHitRadius : 0.5);
    }
    else if (b.type === 'super_pierce' || b.type === 'pierce') { hitRadius = skillConf.hitRadius !== undefined ? skillConf.hitRadius : 3.0; } 
    else if (b.type === 'super_homing_bomb' || b.type === 'homing') { hitRadius = skillConf.bulletHitRadius !== undefined ? skillConf.bulletHitRadius : 1.5; }
    else if (b.type === 'boomerang') { hitRadius = skillConf.bulletHitRadius !== undefined ? skillConf.bulletHitRadius : 1.2; }
    else { hitRadius = skillConf.bulletHitRadius !== undefined ? skillConf.bulletHitRadius : 0.5; }

    var hitRadiusSq = hitRadius * hitRadius;
    var minHitRadius = skillConf.minHitRadius || 0;
    var minHitRadiusSq = minHitRadius * minHitRadius;

    var hasHit = false;
    var isMultiplayer = this._isMultiplayer; 
    
    var deployables = this._frameDeployables || this.deployables || [];
    for (var di = 0; di < deployables.length; di++) {
        var dep = deployables[di];
        if (dep.hp <= 0 || !this._canHit(b.ownerTeam, dep.team)) continue;
        
        var dxd = dep.entity.getPosition().x - bPos.x;
        var dzd = dep.entity.getPosition().z - bPos.z;
        var distSq = dxd * dxd + dzd * dzd;
        var combinedRadius = hitRadius + dep.radius; 
        
        if (distSq < combinedRadius * combinedRadius && distSq >= minHitRadiusSq && (!b.hitTargets || !b.hitTargets.has('dep_' + di))) {
            if (b.hitTargets) b.hitTargets.add('dep_' + di);
            
            if (b.damage > 0) {
                dep.hp -= b.damage; 
                if (this.app.floatingUIManager) this.app.floatingUIManager.updateHealth(dep.entity, Math.max(0, dep.hp));
                this.app.fire('ui:floatingDamage', dep.entity.getPosition(), b.damage, isComboFinish, null, hitScale);
                if (this.app.combatManager) {
                    this.app.combatManager.applyHitFlash(dep.entity);
                    dep.flashTimer = 0.1;
                }
            }
            
            hasHit = true;
            this._applyAttackerFeedback(b, isComboFinish, isShakeComboFinish, dep.entity.getPosition(), hitScale); 
            
            if (b.type === 'melee') {
                this._triggerMeleeHitStop(b, meleeHitStopDuration);
            }

            if (b.type === 'explode' || b.type === 'super_homing_bomb' || b.type === 'homing') {
                b.explodeRadius = skillConf.explodeRadius; b.explodeDamage = skillConf.explodeDamage;
                this._triggerExplosion(b);
                this._recycleBullet(b.entity);
                this.bullets.splice(bulletIndex, 1);
                return;
            }
        }
    }

    var botCtrl = this._frameBotCtrl;
    var bots = this._frameBots;
    if (botCtrl && bots) {
        for (var bj = 0; bj < bots.length; bj++) {
            if (bots[bj].state !== 'alive' || b.ownerId === bots[bj].id || !this._canHit(b.ownerTeam, bots[bj].team)) continue;
            var dx = bots[bj].entity.getPosition().x - bPos.x; var dz = bots[bj].entity.getPosition().z - bPos.z;
            var botDistSq = dx * dx + dz * dz;
            
            if (botDistSq < hitRadiusSq && botDistSq >= minHitRadiusSq && (!b.hitTargets || !b.hitTargets.has(bots[bj].id))) {
                if (b.hitTargets) b.hitTargets.add(bots[bj].id);   // 🌟 所有類型都去重（含 normal），防同一發子彈重複扣血
                
                if (skillConf && skillConf.type === 'super_zhangfei_roar') {
                    bots[bj].ammo = 0; bots[bj].reloadTimer = 0; 
                    this.app.fire('ui:floatingDamage', bots[bj].entity.getPosition(), 'Empty!', true, null, 1.2);
                }
                
                var botHitMeta = this._perTargetHitMeta(hitMeta, bots[bj]);
                if (resolvedDot) {
                    botCtrl.applyDebuff(bots[bj].id, resolvedDot, b.ownerId);
                }

                if (b.damage > 0) {
                    if (isMultiplayer && !this._isOfflinePvEMode() && b.ownerType === 'player') {
                        this._queueNetworkPlayerHit(bots[bj].id, b.damage, botHitMeta, {
                            maxHp: bots[bj].maxHealth
                        });
                    } else {
                        this._queueLocalBotHit(bots[bj].id, bj, b.damage, b.ownerId, b.ownerType, botHitMeta);
                    }
                }
                
                hasHit = true;
                this._applyAttackerFeedback(b, isComboFinish, isShakeComboFinish, bots[bj].entity.getPosition(), hitScale); 
                
                if (b.type === 'melee') {
                    this._triggerMeleeHitStop(b, meleeHitStopDuration);
                }

                if (b.type === 'explode' || b.type === 'super_homing_bomb' || b.type === 'homing') {
                    b.explodeRadius = skillConf.explodeRadius; b.explodeDamage = skillConf.explodeDamage;
                    this._triggerExplosion(b);
                    this._recycleBullet(b.entity);
                    this.bullets.splice(bulletIndex, 1);
                    return;
                }
            }
        }
    }

    var enemyList = this._frameEnemyList;
    for (var eIdx = 0; eIdx < enemyList.length; eIdx++) {
        var eid = enemyList[eIdx].id;
        var enemy = enemyList[eIdx].enemy;
        if (!enemy || enemy.hp <= 0 || enemy.s === 3 || b.ownerId === eid || !this._canHit(b.ownerTeam, enemy.team)) continue;
        var dx2 = enemy.entity.getPosition().x - bPos.x; var dz2 = enemy.entity.getPosition().z - bPos.z;
        var enemyDistSq = dx2 * dx2 + dz2 * dz2;

        if (enemyDistSq < hitRadiusSq && enemyDistSq >= minHitRadiusSq && (!b.hitTargets || !b.hitTargets.has(eid))) {
            if (b.hitTargets) b.hitTargets.add(eid);   // 🌟 所有類型都去重（含 normal），防同一發子彈重複扣血
            
            if (b.damage > 0) {
                if (isMultiplayer && b.ownerType === 'player') {
                    this._queueNetworkPlayerHit(eid, b.damage, hitMeta);
                    // 🌟 DOT：命中帶 dotConfig 一起上報，由 server 權威 tick
                    if (resolvedDot) {
                        this.pendingNetworkHits[eid].dotConfig = resolvedDot;
                    }
                    // 🌟 本地預測擊退：打中當下立刻讓 enemy 退（即時打擊感），不等 server confirmHit 繞一圈
                    if (this.app.enemyManager && this.app.enemyManager.predictKnockback) {
                        this.app.enemyManager.predictKnockback(eid, hitMeta, isComboFinish);
                    }
                } else if (!isMultiplayer) {
                    var finalDmg = b.damage;
                    this.app.fire('ui:floatingDamage', enemy.entity.getPosition(), finalDmg, isComboFinish, null, hitScale);
                }
            }
            
            if (skillConf && skillConf.type === 'super_zhangfei_roar') {
                this.app.fire('ui:floatingDamage', enemy.entity.getPosition(), 'WIPED!', true, null, 1.2);
            }
            
            hasHit = true;
            this._applyAttackerFeedback(b, isComboFinish, isShakeComboFinish, enemy.entity.getPosition(), hitScale); 
            
            if (b.type === 'melee') {
                this._triggerMeleeHitStop(b, meleeHitStopDuration);
            }

            if (b.type === 'explode' || b.type === 'super_homing_bomb' || b.type === 'homing') {
                b.explodeRadius = skillConf.explodeRadius; b.explodeDamage = skillConf.explodeDamage;
                this._triggerExplosion(b);
                this._recycleBullet(b.entity);
                this.bullets.splice(bulletIndex, 1);
                return;
            }
        }
    }

    var localPlayer = this._frameLocalPlayer;
    if (localPlayer && !localPlayer.isDead && !localPlayer._invincible && b.ownerType !== 'player' && this._canHit(b.ownerTeam, this._frameMyTeam)) {
        var pPos = localPlayer.player.getPosition();
        var dx3 = pPos.x - bPos.x; var dz3 = pPos.z - bPos.z;
        var pDistSq = dx3 * dx3 + dz3 * dz3;
        
        if (pDistSq < hitRadiusSq && pDistSq >= minHitRadiusSq && (!b.hitTargets || !b.hitTargets.has('localPlayer'))) {
            if (b.hitTargets) b.hitTargets.add('localPlayer');   // 🌟 所有類型都去重（含 normal），防同一發子彈重複扣血
            
            if (skillConf && skillConf.type === 'super_zhangfei_roar') {
                this.app.fire('player:clearAmmo');
            }

            if (b.damage > 0) { 
                if (isMultiplayer) {
                    // 🌟 雙扣根治：多人時「被攻擊方」不上報傷害（傷害由攻擊方權威 + server 結算）。
                    //    但【本地預測擊退】：被打中當下立刻在本機做擊退+受擊特效（即時手感），
                    //    不等 server confirmHit 繞一圈。damage 傳 0 → 只擊退不扣血。
                    //    設 flag 讓 syncHit 回來時跳過擊退（避免推兩次），DOT 仍由 server 那條路處理。
                    localPlayer._onPlayerHit(0, b.ownerId, false, undefined, hitMeta);
                    localPlayer._lastPredictedHitTime = Date.now();
                } else {
                    var playerHitMeta = this._perTargetHitMeta(hitMeta, localPlayer);
                    localPlayer._onPlayerHit(b.damage, b.ownerId, false, undefined, playerHitMeta);
                    
                    if (resolvedDot) {
                        localPlayer.applyDebuff(resolvedDot, b.ownerId);
                    }
                    this._tryAttackerBurnSplash(b, localPlayer, b.damage, playerHitMeta);
                    
                    if (hitScale > 1.0 || isComboFinish) {
                        this.app.fire('ui:floatingDamage', pPos, 0, isComboFinish, null, hitScale);
                    }
                }
            }
            
            hasHit = true;
            this._applyAttackerFeedback(b, isComboFinish, isShakeComboFinish, pPos, hitScale); 
            
            if (b.type === 'melee') {
                this._triggerMeleeHitStop(b, meleeHitStopDuration);
            }

            if (b.type === 'explode' || b.type === 'super_homing_bomb' || b.type === 'homing') {
                b.explodeRadius = skillConf.explodeRadius; b.explodeDamage = skillConf.explodeDamage;
                this._triggerExplosion(b);
                this._recycleBullet(b.entity);
                this.bullets.splice(bulletIndex, 1);
                return;
            }
        }
    }

    if (hasHit && b.type !== 'wave' && b.type !== 'melee' && b.type !== 'super_pierce' && b.type !== 'pierce' && b.type !== 'dash' && b.type !== 'boomerang') { 
        this._recycleBullet(b.entity);
        this.bullets.splice(bulletIndex, 1); 
    }
};

BulletManager.prototype._resolveInstantMeleeHit = function(b) {
    var skillConf = b.skillConf || {};
    var attackPos = b.attackPos;
    if (!attackPos) return;

    // addBullet 可能在 bulletManager.update 之外觸發，先刷新目標清單
    this._refreshCombatTargets();

    var hitRadius    = skillConf.bulletHitRadius !== undefined ? skillConf.bulletHitRadius : 2.5;
    var hitRadiusSq  = hitRadius * hitRadius;
    var halfAngleRad = ((skillConf.coneAngle !== undefined ? skillConf.coneAngle : 120) * 0.5) * (Math.PI / 180);
    var cosHalf      = Math.cos(halfAngleRad);

    var comboIndex = this._bulletComboIndex(b);
    var resolvedSnare = this._resolveSigSnare(b, comboIndex, skillConf.snareDuration, skillConf.snareMultiplier);
    var resolvedDot = this._finalizeDotConfig(b, this._resolveSigDot(b, comboIndex, skillConf.dotConfig));

    var textScale = skillConf.textScaleMultiplier !== undefined ? skillConf.textScaleMultiplier : 1.0;
    var isComboFinish = (textScale >= 1.5);
    var isShakeComboFinish = (b.ownerType === 'player' && comboIndex === 2);
    var hitScale = textScale >= 1.5 ? textScale : (1.5 + comboIndex * 0.5);

    var hitMeta = { 
        isCombo: isComboFinish, 
        scale: hitScale,
        stunDuration: this._resolveSigStun(b, comboIndex, skillConf.stunDuration),
        snareDuration: resolvedSnare.snareDuration,
        snareMultiplier: resolvedSnare.snareMultiplier,
        flinchAmount: skillConf.flinchAmount,           
        knockbackDist: skillConf.knockbackDist !== undefined ? skillConf.knockbackDist : 0,
        hitAngle: Math.atan2(b.dirX, b.dirZ)
    };

    var isMultiplayer = this._isMultiplayer;
    var self = this;

    function inCone(tx, tz) {
        var dx = tx - attackPos.x;
        var dz = tz - attackPos.z;
        var distSq = dx * dx + dz * dz;
        if (distSq > hitRadiusSq) return false; 
        if (distSq < 0.0001) return true;       
        
        var dist = Math.sqrt(distSq);
        var dot  = (dx / dist) * b.dirX + (dz / dist) * b.dirZ;
        if (dot < cosHalf) return false;        
        
        if (self.app.combatManager && !self.app.combatManager.checkLOS(attackPos.x, attackPos.z, tx, tz)) {
            return false; 
        }
        return true;
    }

    var deployables = this._frameDeployables || this.deployables || [];
    for (var di = 0; di < deployables.length; di++) {
        var dep = deployables[di];
        if (dep.hp <= 0 || !this._canHit(b.ownerTeam, dep.team)) continue;
        var dPos = dep.entity.getPosition();
        
        var inRange = inCone(dPos.x, dPos.z);
        if (!inRange) {
            var distToCenter = Math.sqrt(Math.pow(dPos.x - attackPos.x, 2) + Math.pow(dPos.z - attackPos.z, 2));
            if (distToCenter <= dep.radius) inRange = true; 
        }

        if (inRange && b.damage > 0) {
            dep.hp -= b.damage;
            if (this.app.floatingUIManager) this.app.floatingUIManager.updateHealth(dep.entity, Math.max(0, dep.hp));
            this.app.fire('ui:floatingDamage', dPos, b.damage, isComboFinish, null, hitScale);
            if (this.app.combatManager) {
                this.app.combatManager.applyHitFlash(dep.entity);
                dep.flashTimer = 0.1;
            }
            this._applyAttackerFeedback(b, isComboFinish, isShakeComboFinish, dPos, hitScale);
        }
    }

    var botCtrl = this._frameBotCtrl;
    var bots = this._frameBots;
    if (botCtrl && bots) {
        for (var bj = 0; bj < bots.length; bj++) {
            var bot = bots[bj];
            if (bot.state !== 'alive' || b.ownerId === bot.id || !this._canHit(b.ownerTeam, bot.team)) continue;
            var botPos = bot.entity.getPosition();
            
            if (inCone(botPos.x, botPos.z)) {
                var coneBotMeta = this._perTargetHitMeta(hitMeta, bot);
                if (resolvedDot) botCtrl.applyDebuff(bot.id, resolvedDot, b.ownerId);

                if (b.damage > 0) {
                    if (isMultiplayer && !this._isOfflinePvEMode() && b.ownerType === 'player') {
                        this._queueNetworkPlayerHit(bot.id, b.damage, coneBotMeta, {
                            maxHp: bot.maxHealth
                        });
                    } else {
                        this._queueLocalBotHit(bot.id, bj, b.damage, b.ownerId, b.ownerType, coneBotMeta);
                    }
                }
                this._applyAttackerFeedback(b, isComboFinish, isShakeComboFinish, botPos, hitScale);
            }
        }
    }

    var enemyList = this._frameEnemyList;
    for (var eIdx = 0; eIdx < enemyList.length; eIdx++) {
        var eid = enemyList[eIdx].id;
        var enemy = enemyList[eIdx].enemy;
        if (!enemy || enemy.hp <= 0 || enemy.s === 3 || b.ownerId === eid || !this._canHit(b.ownerTeam, enemy.team)) continue;
        var ePos = enemy.entity.getPosition();
        
        if (inCone(ePos.x, ePos.z)) {
            if (b.damage > 0 && isMultiplayer && b.ownerType === 'player') {
                this._queueNetworkPlayerHit(eid, b.damage, hitMeta);
                // 🌟 DOT：命中帶 dotConfig 一起上報，由 server 權威 tick（imelee 之前漏了，劉備 bleed 加不到對手）
                if (resolvedDot) {
                    this.pendingNetworkHits[eid].dotConfig = resolvedDot;
                }
                // 🌟 本地預測擊退（即時打擊感）
                if (this.app.enemyManager && this.app.enemyManager.predictKnockback) {
                    this.app.enemyManager.predictKnockback(eid, hitMeta, isComboFinish);
                }
            } else if (!isMultiplayer && b.damage > 0) {
                this.app.fire('ui:floatingDamage', ePos, b.damage, isComboFinish, null, hitScale);
            }
            this._applyAttackerFeedback(b, isComboFinish, isShakeComboFinish, ePos, hitScale);
        }
    }

    var localPlayer = this._frameLocalPlayer;
    if (localPlayer && !localPlayer.isDead && !localPlayer._invincible && b.ownerType !== 'player' && this._canHit(b.ownerTeam, this._frameMyTeam)) {
        var pPos = localPlayer.player.getPosition();
        if (inCone(pPos.x, pPos.z)) {
            if (b.damage > 0) {
                if (isMultiplayer) {
                    // 🌟 雙扣根治：被攻擊方不上報（命中由攻擊方權威上報），否則 server 雙扣
                } else {
                    var conePlayerMeta = this._perTargetHitMeta(hitMeta, localPlayer);
                    localPlayer._onPlayerHit(b.damage, b.ownerId, false, undefined, conePlayerMeta);
                    if (resolvedDot) localPlayer.applyDebuff(resolvedDot, b.ownerId);
                    this._tryAttackerBurnSplash(b, localPlayer, b.damage, conePlayerMeta);
                    if (hitScale > 1.0 || isComboFinish) {
                        this.app.fire('ui:floatingDamage', pPos, 0, isComboFinish, null, hitScale);
                    }
                }
            }
            this._applyAttackerFeedback(b, isComboFinish, isShakeComboFinish, pPos, hitScale);
        }
    }
};

BulletManager.prototype._getAoeSpawnScale = function(template, radius) {
    var base = template.getLocalScale();
    var ref = Math.max(base.x, base.y, base.z, 0.01);
    var target = Math.max(0.2, radius * 2);
    var f = target / ref;
    return { x: base.x * f, y: base.y * f, z: base.z * f };
};

BulletManager.prototype._triggerExplosion = function(b) {
    var ex = b.entity.getPosition().x; var ez = b.entity.getPosition().z;
    var isCustomAoe = !!b.aoeTemplate;
    var template = b.aoeTemplate || b.entity; 
    if (!template) return;
    
    var skillConf = b.skillConf || {};
    
    var zone = template.clone(); template.parent.addChild(zone); zone.enabled = true; zone.setPosition(ex, 0.05, ez);
    
    var radius = b.explodeRadius !== undefined ? b.explodeRadius : (skillConf.explodeRadius !== undefined ? skillConf.explodeRadius : 2.2);
    var damage = b.explodeDamage !== undefined ? b.explodeDamage : (skillConf.explodeDamage !== undefined ? skillConf.explodeDamage : 45);
    
    if (skillConf.destroyBush && this.app.gameModeManager && this.app.gameModeManager.destroyBushesInArea) {
        this.app.gameModeManager.destroyBushesInArea(ex, ez, radius + 0.5);
        // 🌟 新增：爆炸時同步拆牆
        if (this.app.gameModeManager.destroyObstacle) {
            this.app.gameModeManager.destroyObstacle(ex, ez, radius + 0.5);
        }
    }

    var spawnScale = isCustomAoe
        ? this._getAoeSpawnScale(template, radius)
        : { x: Math.max(0.2, radius * 2), y: Math.max(0.2, radius * 2), z: Math.max(0.2, radius * 2) };
    zone.setLocalScale(spawnScale.x, spawnScale.y, spawnScale.z);
    if (!isCustomAoe) {
        var render = zone.render || zone.findComponent('render');
        if (render && render.meshInstances && render.meshInstances.length > 0) {
            var mat = render.meshInstances[0].material.clone();
            mat.blendType = pc.BLEND_ADDITIVE; mat.update(); render.meshInstances[0].material = mat;
        }
    }
    var particles = zone.findComponents('particlesystem');
    for (var i = 0; i < particles.length; i++) {
        var ps = particles[i];
        var ext = ps.emitterExtents;
        if (ps.emitterShape === pc.EMITTERSHAPE_BOX) { 
            ext.x = 0.5; ext.z = 0.5; 
            ps.emitterExtents = ext; 
        } 
        else if (ps.emitterShape === pc.EMITTERSHAPE_SPHERE || ps.emitterShape === pc.EMITTERSHAPE_CYLINDER) { 
            ps.emitterRadius = 0.5; 
        }
        ps.reset(); ps.play();
    }
    
   this.addDamageZone({ 
        entity: zone, x: ex, z: ez, radius: radius, duration: 0.3, damage: damage, 
        tickRate: 0.15, tickTimer: 0.15, oneShot: true,   // 🌟 爆炸是瞬間傷害：第一帧觸發後只扣一次
        ownerType: b.ownerType, ownerId: b.ownerId, ownerTeam: b.ownerTeam,
        dotConfig: skillConf.dotConfig,
        spawnScale: spawnScale
    });
};

BulletManager.prototype._createDamageZone = function(b) {
    var ex = b.entity.getPosition().x; var ez = b.entity.getPosition().z;
    var isCustomAoe = !!b.aoeTemplate;
    var template = b.aoeTemplate || b.entity; 
    if (!template) return;
    
    var skillConf = b.skillConf || {};
    
    var zone = template.clone(); template.parent.addChild(zone); zone.enabled = true; zone.setPosition(ex, 0.05, ez);
    
    var radius = skillConf.lobAreaRadius !== undefined ? skillConf.lobAreaRadius : 1.2; 
    var duration = skillConf.lobAreaDuration !== undefined ? skillConf.lobAreaDuration : 2.0;
    var damage = skillConf.lobAreaDamage !== undefined ? skillConf.lobAreaDamage : 5; 
    var tickRate = skillConf.lobAreaTickRate !== undefined ? skillConf.lobAreaTickRate : 0.5;
    
    if (skillConf.destroyBush && this.app.gameModeManager && this.app.gameModeManager.destroyBushesInArea) {
        this.app.gameModeManager.destroyBushesInArea(ex, ez, radius + 0.5);
        if (this.app.gameModeManager.destroyObstacle) {
            this.app.gameModeManager.destroyObstacle(ex, ez, radius + 0.5);
        }
    }

    var spawnScale = isCustomAoe
        ? this._getAoeSpawnScale(template, radius)
        : { x: Math.max(0.2, radius * 2), y: Math.max(0.2, radius * 2), z: Math.max(0.2, radius * 2) };
    zone.setLocalScale(spawnScale.x, spawnScale.y, spawnScale.z);
    if (!isCustomAoe) {
        var render = zone.render || zone.findComponent('render');
        if (render && render.meshInstances && render.meshInstances.length > 0) {
            var mat = render.meshInstances[0].material.clone();
            mat.blendType = pc.BLEND_NORMAL; mat.update(); render.meshInstances[0].material = mat;
        } else if (zone.findComponents('render').length === 0 && zone.findComponents('model').length === 0) { zone.addComponent('render', { type: 'cylinder' }); }
    }
    var particles = zone.findComponents('particlesystem');
    for (var i = 0; i < particles.length; i++) {
        var ps = particles[i];
        if (ps.emitterShape === pc.EMITTERSHAPE_BOX) { 
            var ext = ps.emitterExtents; ext.x = 0.5; ext.z = 0.5; ps.emitterExtents = ext;
            if (ps.emitterExtentsInner) { 
                var extIn = ps.emitterExtentsInner; extIn.x = 0.4; extIn.z = 0.4; ps.emitterExtentsInner = extIn; 
            } 
        } 
        else if (ps.emitterShape === pc.EMITTERSHAPE_SPHERE || ps.emitterShape === pc.EMITTERSHAPE_CYLINDER) { 
            ps.emitterRadius = 0.5;
            if (ps.emitterRadiusInner !== undefined) ps.emitterRadiusInner = 0.4; 
        }
        ps.reset(); ps.play();
    }
    
    this.addDamageZone({ 
        entity: zone, x: ex, z: ez, radius: radius, duration: duration, damage: damage, tickRate: tickRate, 
        ownerType: b.ownerType, ownerId: b.ownerId, ownerTeam: b.ownerTeam,
        dotConfig: skillConf.dotConfig,
        spawnScale: spawnScale
    });
};

BulletManager.prototype._setBulletOpacity = function(b, v) {
    var e = b.entity;
    if (!e._fadeMeshes) {
        e._fadeMeshes = [];
        var renders = e.findComponents('render');
        for (var i = 0; i < renders.length; i++)
            for (var j = 0; j < renders[i].meshInstances.length; j++)
                e._fadeMeshes.push(renders[i].meshInstances[j]);
    }
    for (var k = 0; k < e._fadeMeshes.length; k++)
        e._fadeMeshes[k].setParameter('material_opacity', v);
};

BulletManager.prototype._updateDamageZones = function (dt) {
    for (var i = this.damageZones.length - 1; i >= 0; i--) {
        var zone = this.damageZones[i];
        zone.life += dt;
        if (zone.duration <= 0.35) {
            var progressAnim = zone.life / zone.duration;
            var scaleMul = Math.sin(progressAnim * (Math.PI / 2));
            if (zone.spawnScale) {
                zone.entity.setLocalScale(
                    zone.spawnScale.x * scaleMul,
                    zone.spawnScale.y * scaleMul,
                    zone.spawnScale.z * scaleMul
                );
            } else {
                var scaleAnim = zone.radius * 2 * scaleMul;
                zone.entity.setLocalScale(scaleAnim, scaleAnim, scaleAnim);
            }
        }
        
        if (zone.life >= zone.duration) { zone.entity.destroy(); this.damageZones.splice(i, 1); continue; }
        if (zone.duration > 0.35 && zone.life > zone.duration * 0.7) { zone.entity.enabled = Math.sin(zone.life * 15) > 0; }
        
          zone.tickTimer += dt; 
        if (zone.tickTimer >= zone.tickRate && !zone._tickedOnce) { 
            zone.tickTimer = 0; 
            if (!zone.visualOnly) this._checkZoneHit(zone); 
            if (zone.oneShot) zone._tickedOnce = true;   // 🌟 爆炸只扣一次，之後不再 tick
        }
    }
};

BulletManager.prototype._checkZoneHit = function(zone) {
    var radiusSq = zone.radius * zone.radius;
    var isMultiplayer = this._isMultiplayer; 
    
    var skillConf = zone.skillConf || {};
    var hitMeta = {
        isCombo: false,
        scale: 1.0,
        stunDuration: skillConf.stunDuration,   // zone(範圍/DOT)無 combo 概念,不套本命卡
        snareDuration: skillConf.snareDuration,
        snareMultiplier: skillConf.snareMultiplier,
        flinchAmount: 0 
    };
    
    var deployables = this._frameDeployables || this.deployables || [];
    for (var di = 0; di < deployables.length; di++) {
        var dep = deployables[di];
        if (dep.hp <= 0 || !this._isValidZoneTarget(zone, dep.team)) continue;
        if (!zone.isHeal && zone.ownerId === dep.id) continue;

        var dxd = dep.entity.getPosition().x - zone.x;
        var dzd = dep.entity.getPosition().z - zone.z;
        if (dxd * dxd + dzd * dzd < radiusSq) {
            var finalDamage = zone.isHeal ? -zone.damage : zone.damage;
            dep.hp -= finalDamage; dep.hp = Math.min(dep.hp, dep.maxHp); 
            
            if (this.app.floatingUIManager) this.app.floatingUIManager.updateHealth(dep.entity, Math.max(0, dep.hp));
            
            if (zone.isHeal) this.app.fire('ui:floatingDamage', dep.entity.getPosition(), "+" + zone.damage, false, this.healColor);
            else {
                this.app.fire('ui:floatingDamage', dep.entity.getPosition(), zone.damage, false);
                if (this.app.combatManager) { this.app.combatManager.applyHitFlash(dep.entity); dep.flashTimer = 0.1; }
            }
        }
    }

    var botCtrl = this._frameBotCtrl;
    var bots = this._frameBots;
    if (botCtrl && bots) {
        for (var j = 0; j < bots.length; j++) {
            if (bots[j].state !== 'alive' || !this._isValidZoneTarget(zone, bots[j].team)) continue;
            if (!zone.isHeal && zone.ownerId === bots[j].id) continue;

            var dx = bots[j].entity.getPosition().x - zone.x; var dz = bots[j].entity.getPosition().z - zone.z;
            if (dx * dx + dz * dz < radiusSq) { 
                var finalDamage = zone.isHeal ? -zone.damage : zone.damage;
                var zoneBotMeta = this._perTargetHitMeta(hitMeta, bots[j]);
                if (!zone.isHeal && zone.dotConfig) {
                    var zoneDot = zone.dotConfig;
                    if (window.CombatResolver && CombatResolver.applyFireDotMods) {
                        zoneDot = CombatResolver.applyFireDotMods(this.app, zone.ownerId, zone.ownerType, zoneDot);
                    }
                    botCtrl.applyDebuff(bots[j].id, zoneDot, zone.ownerId);
                }
                if (isMultiplayer && !this._isOfflinePvEMode() && zone.ownerType === 'player') {
                    this._queueNetworkPlayerHit(bots[j].id, finalDamage, zoneBotMeta, {
                        maxHp: bots[j].maxHealth
                    });
                } else {
                    this._queueLocalBotHit(bots[j].id, j, finalDamage, zone.ownerId, zone.ownerType, zoneBotMeta);
                    if (zone.isHeal) this.app.fire('ui:floatingDamage', bots[j].entity.getPosition(), "+" + zone.damage, false, this.healColor); 
                }
            }
        }
    }

    var enemyList = this._frameEnemyList;
    for (var eIdx = 0; eIdx < enemyList.length; eIdx++) {
        var eid = enemyList[eIdx].id;
        var enemy = enemyList[eIdx].enemy;
        if (!enemy || enemy.hp <= 0 || enemy.s === 3 || !this._isValidZoneTarget(zone, enemy.team)) continue;
        if (!zone.isHeal && zone.ownerId === eid) continue;

        var dx2 = enemy.entity.getPosition().x - zone.x; var dz2 = enemy.entity.getPosition().z - zone.z;
        if (dx2 * dx2 + dz2 * dz2 < radiusSq) { 
            var finalDamage = zone.isHeal ? -zone.damage : zone.damage;
            if (isMultiplayer && zone.ownerType === 'player') {
                this._queueNetworkPlayerHit(eid, finalDamage, hitMeta);
                // 🌟 DOT：區域型若帶 dotConfig 也上報（與其他命中路徑一致）
                if (!zone.isHeal && zone.dotConfig) this.pendingNetworkHits[eid].dotConfig = zone.dotConfig;
                // 🌟 本地預測擊退：由 hitMeta.knockbackDist 決定（沒設就不會擊退），統一邏輯不分攻擊類型
                if (!zone.isHeal && this.app.enemyManager && this.app.enemyManager.predictKnockback) {
                    this.app.enemyManager.predictKnockback(eid, hitMeta, false);
                }
            }
        }
    }

    var localPlayer = this._frameLocalPlayer;
    if (localPlayer && !localPlayer.isDead && this._isValidZoneTarget(zone, this._frameMyTeam)) {
        if (!zone.isHeal && (localPlayer._invincible || (zone.ownerType === 'player' && zone.ownerId === 'player'))) return;

        var pPos = localPlayer.player.getPosition();
        var dx3 = pPos.x - zone.x; var dz3 = pPos.z - zone.z;
        if (dx3 * dx3 + dz3 * dz3 < radiusSq) { 
            var finalDamage = zone.isHeal ? -zone.damage : zone.damage;
            if (isMultiplayer) { 
                // 🌟 雙扣/雙倍治療根治：傷害與治療都由「放置者(攻擊方)端」權威上報，
                //    被影響方不重複上報，否則 server 雙倍結算（傷害雙扣 / 治療雙倍回血）。
                //    例外：自己放的 zone 作用在自己身上（self-heal），放置者端沒有 enemy 分支
                //    會處理自己，故需 localPlayer 端上報。
                var myId = this._frameMyId;
                var isSelfZone = (zone.ownerId === myId || zone.ownerId === 'player');
                if (isSelfZone) {
                    if (!this.pendingNetworkHits[myId]) this.pendingNetworkHits[myId] = { damage: 0, hitMeta: hitMeta };
                    this.pendingNetworkHits[myId].damage += finalDamage;
                }
            } else {
                localPlayer._onPlayerHit(finalDamage, zone.ownerId, false, undefined, hitMeta); 
                
                if (!zone.isHeal && zone.dotConfig) {
                    var pZoneDot = zone.dotConfig;
                    if (window.CombatResolver && CombatResolver.applyFireDotMods) {
                        pZoneDot = CombatResolver.applyFireDotMods(this.app, zone.ownerId, zone.ownerType, pZoneDot);
                    }
                    localPlayer.applyDebuff(pZoneDot, zone.ownerId);
                }
                
                if (zone.isHeal) this.app.fire('ui:floatingDamage', pPos, "+" + zone.damage, false, this.healColor); 
            } 
        }
    }
};

BulletManager.prototype._reportDamage = function(ownerId, ownerType, damage) {
    if (damage <= 0) return;
    var isMultiplayer = this._isMultiplayer; 
    if (ownerType === 'player') {
        if (!isMultiplayer) { 
            this.app.fire('score:damage', 'player', damage);
            this.app.fire('enemy:hit', { ownerId: 'player', damage: damage }); 
        }
    } else if (ownerType === 'bot' && ownerId) {
        if (!isMultiplayer) { this.app.fire('score:damage', ownerId, damage); }
    }
};
