var EnemyManager = pc.createScript('enemyManager');

EnemyManager.attributes.add('invincibleTime', { type: 'number', default: 3, title: '無敵閃爍時間 (秒)' });

EnemyManager.prototype.initialize = function() {
    this.enemies = {}; 
    this.app.enemyManager = this;

    this._tempVec1 = new pc.Vec3();
    this._tempVec2 = new pc.Vec3();
    this._healColor = new pc.Color(0, 1, 0, 1); 
    
    this.app.on('network:enemyMoved', this._onEnemyMoved, this);
    this.app.on('network:enemyDisconnected', this._onEnemyDisconnected, this);
    this.app.on('network:enemyShot', this._onEnemyShot, this);
    this.app.on('network:enemyRoll', this._onEnemyRoll, this);   // 🌟 對方翻滾
    this.app.on('network:enemyState', this._onEnemyState, this);   // 🌟 對方狀態(DOT/stun)
    this.app.on('network:enemyRespawned', this._onEnemyRespawned, this);
    this.app.on('global:syncHit', this._onEnemyHit, this);
    this.app.on('game:start', this._cleanup, this);
    this.app.on('network:cancelMatchmaking', this._cleanup, this);
    this.app.on('round:start', this._onRoundStart, this);

    this.app.on('network:fullStateSync', this._onFullStateSync, this);
    
    this.on('destroy', function() {
        this.app.off('network:enemyMoved', this._onEnemyMoved, this);
        this.app.off('network:enemyDisconnected', this._onEnemyDisconnected, this);
        this.app.off('network:enemyShot', this._onEnemyShot, this);
        this.app.off('network:enemyRespawned', this._onEnemyRespawned, this);
        this.app.off('global:syncHit', this._onEnemyHit, this);
        this.app.off('game:start', this._cleanup, this);
        this.app.off('network:cancelMatchmaking', this._cleanup, this);
        this.app.off('round:start', this._onRoundStart, this);
        this.app.off('network:fullStateSync', this._onFullStateSync, this);
        
        if (this.app.enemyManager === this) { 
            this.app.enemyManager = null; 
        }
    }, this);  
};

EnemyManager.prototype._onFullStateSync = function(data) {
    if (!data) return;
    
    if (!data.players) return;   // 🌟 新 server 純玩家，無 data.bots（舊版會在此崩潰）

    for (var id in this.enemies) {
        var enemy = this.enemies[id];
        var snapshot = data.players[id];   // 🌟 只讀 players（移除 data.bots）
        
        if (snapshot) {
            enemy.hp = snapshot.hp;

            var snapBrawler = snapshot.brawler || snapshot.b || enemy.brawlerType;
            var snapSkin = snapshot.skinKey || '';
            if (snapBrawler !== enemy.brawlerType || snapSkin !== (enemy.skinKey || '')) {
                this._transformEnemy(enemy, snapBrawler, snapSkin);
            }
            
            if (this.app.floatingUIManager) {
                this.app.floatingUIManager.updateHealth(enemy.entity, enemy.hp);
            }
            
            if (enemy.hp <= 0 && enemy.s !== 3 && enemy.brawlerType !== 'diaochan_lubu') {
                this._beginDeathVanish(enemy);
            } else if (enemy.hp > 0 && enemy.s === 3) {
                enemy.s = 1;
                enemy._deathVanishTimer = 0;
                if (!enemy.entity.enabled) enemy.entity.enabled = true;
                if (enemy.animEntity && enemy.animEntity.anim) {
                    enemy.animEntity.anim.speed = 1.0;
                }
                if (this.app.combatManager && this.app.combatManager.clearDeathVisual) {
                    this.app.combatManager.clearDeathVisual(enemy.entity);
                }
            }
        }
    }
};

EnemyManager.prototype._beginDeathVanish = function(enemy) {
    if (!enemy || !enemy.entity || enemy.entity._destroyed) return;
    enemy.hp = 0;
    enemy.s = 3;
    enemy.flashTimer = 0;
    if (enemy._deathVanishTimer && enemy._deathVanishTimer > 0) return;

    enemy._deathVanishTimer = 0.8;
    enemy._deathVanishTotal = 0.8;
    if (enemy.animEntity && enemy.animEntity.anim) {
        enemy.animEntity.anim.setFloat('speed', 0);
        enemy.animEntity.anim.speed = 0;
    }
    if (this.app.combatManager && this.app.combatManager.applyDeathGray) {
        this.app.combatManager.applyDeathGray(enemy.entity);
    }
};

EnemyManager.prototype._findAnimEntity = function(node) {
    if (node.anim) return node;
    for (var i = 0; i < node.children.length; i++) {
        var res = this._findAnimEntity(node.children[i]);
        if (res) return res;
    }
    return null;
};

EnemyManager.prototype._cleanup = function() {
    for (var id in this.enemies) {
        if (this.enemies[id]) {
            if (this.enemies[id].decoyEntity) {
                if (this.app.floatingUIManager) this.app.floatingUIManager.removeUI(this.enemies[id].decoyEntity);
                this.enemies[id].decoyEntity.destroy();
            }
            if (this.enemies[id].entity) {
                if (this.app.floatingUIManager) this.app.floatingUIManager.removeUI(this.enemies[id].entity);
                this.enemies[id].entity.destroy();
            }
        }
    }
    this.enemies = {};
};

EnemyManager.prototype._onRoundStart = function() {
    var isKnockout = this.app.gameModeManager && this.app.gameModeManager.currentMode === '3V3_KNOCKOUT';
    if (!isKnockout) return;

    for (var id in this.enemies) {
        var enemy = this.enemies[id];
        
        if (enemy.brawlerType === 'diaochan_lubu') {
            this._transformEnemy(enemy, 'diaochan');
        }

        enemy.hp = enemy.maxHp; 
        enemy.s = 1; 
        enemy.invincibleTimer = this.invincibleTime;
        enemy.isStealth = false; 
        enemy.stealthTimer = 0; 
        enemy.revealTimer = 0; 
        
        // 🌟 回合開始重置假擊退
        enemy.vKbkX = 0;
        enemy.vKbkZ = 0;
        if (enemy.animEntity) enemy.animEntity.setLocalPosition(0, 0, 0);

        if (this.app.combatManager) {
            this.app.combatManager.setEntityOpacity(enemy.entity, 1.0);
            this.app.combatManager.setEntityVisibility(enemy.entity, true);
        }
        
        if (this.app.floatingUIManager) {
            this.app.floatingUIManager.updateHealth(enemy.entity, enemy.hp);
        }
        
        enemy.lastVisibility = true;
        enemy.lastDamageTime = Date.now();
        
        if (!enemy.entity.enabled) {
            enemy.entity.enabled = true;
        }
        if (enemy.animEntity && enemy.animEntity.anim) {
            enemy.animEntity.anim.setFloat('speed', 0);
            enemy.animEntity.anim.speed = 1.0; 
        }
    }
};

EnemyManager.prototype._enemyOriginSuperConf = function(enemy) {
    var baseType = enemy._transformOriginType || enemy.brawlerType;
    var cfg = window.BrawlerConfig ? window.BrawlerConfig[baseType] : null;
    return (cfg && cfg.super) ? cfg.super : {};
};

EnemyManager.prototype._enemyUsesSharedTransformHealth = function(enemy) {
    return !!this._enemyOriginSuperConf(enemy).shareHealth;
};

EnemyManager.prototype._transformEnemy = function (enemy, newBrawlerType, newSkinKey) {
    var config = window.BrawlerConfig ? window.BrawlerConfig[newBrawlerType] : null;
    if (!config) return;

    var oldType = enemy.brawlerType;
    var resolvedSkinKey = (newSkinKey !== undefined) ? (newSkinKey || '') : (enemy.skinKey || '');
    var skinOnlyChange = (oldType === newBrawlerType) && resolvedSkinKey !== (enemy.skinKey || '');
    if (oldType === newBrawlerType && !skinOnlyChange) return;

    var isReverting = (oldType === 'diaochan_lubu' && newBrawlerType === 'diaochan');
    var enteringMecha = !!(config.isMecha) && !isReverting;

    if (!enemy._transformOriginType && oldType !== newBrawlerType) {
        enemy._transformOriginType = oldType;
    }
    var useSharedHealth = this._enemyUsesSharedTransformHealth(enemy);
    if (useSharedHealth && !enemy._sharedMaxHp) {
        enemy._sharedMaxHp = enemy.maxHp;
    }

    this._tempVec1.copy(enemy.entity.getPosition());
    this._tempVec2.copy(enemy.entity.getEulerAngles());

    var template = this.app.combatManager ? this.app.combatManager.getCharacterTemplate(newBrawlerType, resolvedSkinKey) : null;
    if (!template) return;

    var newEntity = template.clone();
    newEntity.enabled = true;
    newEntity.name = enemy.id;
    template.parent.addChild(newEntity);

    if (config.scale) newEntity.setLocalScale(config.scale, config.scale, config.scale);

    newEntity.setPosition(this._tempVec1.x, 0, this._tempVec1.z);
    newEntity.setEulerAngles(this._tempVec2.x, this._tempVec2.y, this._tempVec2.z);

    var isEnemy = true;
    if (this.app.gameMode === '3V3_BOUNTY' || this.app.gameMode === '3V3_KNOCKOUT') {
        if (enemy.team === this.app.myTeam) isEnemy = false;
    }

    try {
        if (this.app.combatManager) this.app.combatManager.tintHealthAndRing(newEntity, isEnemy);
        
        var animNode = this.app.combatManager ? this.app.combatManager.findAnimEntity(newEntity) : newEntity;
        
        var hpFill = newEntity.findByName('HealthFill');
        if (hpFill) hpFill.enabled = false;
        var hpBg = newEntity.findByName('HealthBackground');
        if (hpBg) hpBg.enabled = false;

        if (this.app.floatingUIManager) {
            this.app.floatingUIManager.removeUI(enemy.entity);
        }
        
        enemy.entity.destroy();
        enemy.entity = newEntity;
        enemy.animEntity = animNode;
        enemy.brawlerType = newBrawlerType;
        enemy.skinKey = resolvedSkinKey;
        enemy.config = config;

        if (!skinOnlyChange) {
        if (isReverting && !useSharedHealth) {
            if (enemy._preTransformMaxHp > 0) {
                enemy.maxHp = enemy._preTransformMaxHp;
                enemy.hp = Math.max(1, Math.min(enemy._preTransformHp, enemy.maxHp));
            } else {
                enemy.maxHp = config.health || 1000;
                enemy.hp = enemy.maxHp;
            }
            enemy._preTransformHp = 0;
            enemy._preTransformMaxHp = 0;
            enemy._transformOriginType = '';
            enemy._sharedMaxHp = 0;
        } else if (enteringMecha && !useSharedHealth) {
            enemy._preTransformHp = enemy.hp;
            enemy._preTransformMaxHp = enemy.maxHp;
            var hpRatio = enemy.maxHp > 0 ? (enemy.hp / enemy.maxHp) : 1;
            enemy.maxHp = config.health || 1000;
            enemy.hp = Math.max(1, Math.round(enemy.maxHp * hpRatio));
        } else if (useSharedHealth && enemy._sharedMaxHp > 0) {
            enemy.maxHp = enemy._sharedMaxHp;
            enemy.hp = Math.min(enemy.hp, enemy.maxHp);
        } else {
            enemy.maxHp = config.health || 1000;
            enemy.hp = enemy.maxHp;
        }
        }

        if (this.app.floatingUIManager) {
            var eName = window.BrawlerConfig[newBrawlerType].name || newBrawlerType;
            var relation = isEnemy ? 'enemy' : 'ally';
            this.app.floatingUIManager.registerUI(enemy.entity, eName, enemy.maxHp, relation, enemy.playerName);
            this.app.floatingUIManager.updateHealth(enemy.entity, enemy.hp);
            
            if (this.app.floatingUIManager.updateGems) {
                this.app.floatingUIManager.updateGems(enemy.entity, enemy.gemCount);
            }
        }

        if (isReverting) {
            enemy.invincibleTimer = 1.5;
            if (this.app.combatManager) this.app.combatManager.setEntityOpacity(enemy.entity, 0.4);
        }
        else if (config.isMecha && this.app.bulletManager && this.app.combatManager) {
            this.app.bulletManager._triggerExplosion({
                entity: enemy.entity, aoeTemplate: this.app.combatManager.aoeMap['lubu'],
                explodeRadius: 3.0, explodeDamage: 0,
                ownerType: 'enemy', ownerId: enemy.id, ownerTeam: enemy.team,
                config: config
            });
        }
    } catch (e) {
        console.warn("Enemy transformation visual error", e);
    }
};

// 🌟 套用 enemy 擊退（vKbk 視覺位移）。供 server confirmHit 與 bulletManager 本地預測共用，算法一致。
EnemyManager.prototype._applyEnemyKnockback = function(enemy, meta, isComboFinish) {
    if (!enemy || !meta) return;
    var force = isComboFinish ? 0.8 : 0.3;

    // 優先用 pushX/pushZ（若 server 有提供）；否則用 knockbackDist + hitAngle 自行換算
    if (meta.pushX !== undefined && meta.pushZ !== undefined) {
        enemy.vKbkX = meta.pushX * force;
        enemy.vKbkZ = meta.pushZ * force;
    } else if (meta.knockbackDist !== undefined && meta.hitAngle !== undefined && Math.abs(meta.knockbackDist) > 0.01) {
        var dist = meta.knockbackDist;
        enemy.vKbkX = Math.sin(meta.hitAngle) * dist * force;
        enemy.vKbkZ = Math.cos(meta.hitAngle) * dist * force;
    }
};

// 🌟 本地預測擊退：你的子彈打中 enemy 當下，立刻套擊退（不等 server），並設 flag 防 server 再推一次。
EnemyManager.prototype.predictKnockback = function(enemyId, hitMeta, isComboFinish) {
    var enemy = this.enemies[enemyId];
    if (!enemy || enemy.hp <= 0 || enemy.s === 3) return;
    if (!hitMeta) return;

    // 1. vKbk 視覺彈動（打擊瞬間衝擊感）
    this._applyEnemyKnockback(enemy, hitMeta, isComboFinish);

    // 2. 🌟 本體真的推開：把 targetX/targetZ 往擊退方向推，enemy 本體即時 lerp 過去（踏實，像 player）。
    //    等對方真實位置透過 enemyMoved 同步回來時自然校正。
    if (hitMeta.knockbackDist !== undefined && hitMeta.hitAngle !== undefined && Math.abs(hitMeta.knockbackDist) > 0.01) {
        var force = isComboFinish ? 0.8 : 0.3;
        var pushDist = hitMeta.knockbackDist * force;
        var pushXDir = Math.sin(hitMeta.hitAngle);
        var pushZDir = Math.cos(hitMeta.hitAngle);

        var newTX = enemy.targetX + pushXDir * pushDist;
        var newTZ = enemy.targetZ + pushZDir * pushDist;

        // 地圖邊界 clamp（與位移邏輯一致）
        var limitX = this.app.gameModeManager ? this.app.gameModeManager.mapLimitX : 11.5;
        var limitZ = this.app.gameModeManager ? this.app.gameModeManager.mapLimitZ : 10.0;
        newTX = pc.math.clamp(newTX, -limitX, limitX);
        newTZ = pc.math.clamp(newTZ, -limitZ, limitZ);

        // 牆壁碰撞檢查（撞牆就不推）
        if (!(this.app.combatManager && this.app.combatManager.checkCollision(newTX, newTZ))) {
            enemy.targetX = newTX;
            enemy.targetZ = newTZ;
            enemy._kbkBoostTimer = 0.15;   // 🌟 擊退後 0.15s 內用高 lerp 速度，瞬間到位（踏實打擊感）
        }
    }

    enemy._lastPredictedKbk = Date.now();
};

EnemyManager.prototype._onEnemyHit = function(data) {
    var enemy = this.enemies[data.targetId];
    if (enemy) {
        // _isJumping：舊跳躍系統已停用

        var isHeal = data.damage < 0;

        if (!isHeal) enemy.lastDamageTime = Date.now(); 
        
        if (data.currentHp !== undefined) {
            enemy.hp = data.currentHp;
        } else if (data.isDead) {
            enemy.hp = 0; 
        } else {
            enemy.hp -= data.damage;
            enemy.hp = Math.min(enemy.hp, enemy.maxHp);
        }
        
        if (enemy.hp <= 0 && !data.isDead) enemy.hp = 0; 
        
        if (this.app.floatingUIManager) {
            this.app.floatingUIManager.updateHealth(enemy.entity, enemy.hp);
        }

        var meta = data.hitMeta || {};
        var isComboFinish = meta.isCombo || false;
        var scaleMult = meta.scale || 1.0;
        
        // 🌟 假擊退套用：若本地已預測過（200ms 內）就跳過，避免推兩次
        var hasKbk = (meta.pushX !== undefined) || (meta.knockbackDist !== undefined && Math.abs(meta.knockbackDist) > 0.01);
        if (!isHeal && hasKbk) {
            if (!(enemy._lastPredictedKbk && (Date.now() - enemy._lastPredictedKbk < 200))) {
                this._applyEnemyKnockback(enemy, meta, isComboFinish);
            }
        }

        if (!isHeal) {
            enemy.revealTimer = 2.5; 
            enemy.lastVisibility = true;

            if (enemy.isStealth) {
                enemy.isStealth = false; enemy.stealthTimer = 0; 
                if (this.app.combatManager) this.app.combatManager.setEntityOpacity(enemy.entity, 1.0);
            } else if (!(data.isDead || enemy.hp <= 0)) { 
                // 沒打死才白閃；打死交給死亡變灰
                enemy.flashTimer = 0.1;
                if (this.app.combatManager) this.app.combatManager.applyHitFlash(enemy.entity);
            }
            
            if (data.damage > 0) {

                // 🌟 受擊形變：觸發 Squash（對齊 player/bot）
                var configFlinch = (meta.flinchAmount !== undefined) ? meta.flinchAmount : 0.15;
                if (configFlinch > 0) enemy._squashScale = configFlinch;
            }

            this.app.fire('fx:hit', enemy.entity.getPosition());

            // 🌟 暈眩：命中當下即時設 stunTimer（凍結位移，不等狀態廣播）
            //    完整狀態（含 DOT 圖示）由 _onEnemyState 從 player 廣播同步，與 player/bot 結構一致
            var stunDur = meta.stunDuration || data.stunDuration;
            if (stunDur && stunDur >= 0.5) {
                enemy.stunTimer = stunDur;
                enemy._initialStunDuration = stunDur;
            }
        }

        if (isHeal) {
            this.app.fire('ui:floatingDamage', enemy.entity.getPosition(), "+" + (-data.damage), false, this._healColor);
        } else {
            var isTrueCrit = !!(meta && meta.isCrit);
            this.app.fire('ui:floatingDamage', enemy.entity.getPosition(), data.damage, isComboFinish, null, scaleMult, isTrueCrit);
        }

        if (data.isDead || (enemy.hp <= 0 && enemy.brawlerType !== 'diaochan_lubu')) {
            this._beginDeathVanish(enemy);
            this.updateGemCount(data.targetId, 0);
        }
    }
};

EnemyManager.prototype._onEnemyMoved = function(data) {
    var id = data.id; 
    if (!this.enemies[id]) {
        this._spawnEnemy(data);
    }
    var enemyData = this.enemies[id];
    
    var incomingSkinKey = data.skinKey || '';
    if ((data.b && enemyData.brawlerType !== data.b) || incomingSkinKey !== (enemyData.skinKey || '')) {
        this._transformEnemy(enemyData, data.b || enemyData.brawlerType, incomingSkinKey);
    }
    
    if (data.s === 3) {
        this._beginDeathVanish(enemyData);
        return; 
    }
    
    if (enemyData.hp <= 0 || enemyData.s === 3) return; 

    enemyData.targetX = data.x; 
    enemyData.targetZ = data.z; 
    
    enemyData.s = data.s; 
    enemyData.team = data.team; 
    // 🌟 server 廣播的 facing 存起來（不直接覆寫 targetR）。
    //    移動時由本地移動朝向主導（跟 player 一致）；靜止時才用這個 server facing。
    //    直接覆寫會跟本地移動朝向打架（尤其 volatile 丟包時），造成「面朝右往上走」。
    if (!enemyData.attackLock || enemyData.attackLock <= 0) {
        enemyData._serverFacing = data.r;
    }
};

EnemyManager.prototype._onEnemyDisconnected = function(id) {
    if (this.enemies[id]) {
        var enemy = this.enemies[id];
        // 斷線不中斷已放出誘餌
        if (enemy.decoyEntity && enemy.decoyTimer > 0 && !enemy.decoyEntity._destroyed) {
            this._orphanDecoys = this._orphanDecoys || [];
            this._orphanDecoys.push({
                decoyEntity: enemy.decoyEntity,
                decoyAnimEntity: enemy.decoyAnimEntity,
                decoyTimer: enemy.decoyTimer,
                decoyConfig: enemy.decoyConfig,
                decoyDirX: enemy.decoyDirX,
                decoyDirZ: enemy.decoyDirZ,
                decoyOwnerSpeed: enemy.decoyOwnerSpeed || (enemy.config && enemy.config.speed) || 8,
                id: enemy.id,
                team: enemy.team,
                config: enemy.config
            });
            enemy.decoyEntity = null;
            enemy.decoyAnimEntity = null;
            enemy.decoyTimer = 0;
        } else if (enemy.decoyEntity) {
            if (this.app.floatingUIManager) this.app.floatingUIManager.removeUI(enemy.decoyEntity);
            enemy.decoyEntity.destroy();
        }
        if (this.app.floatingUIManager) this.app.floatingUIManager.removeUI(enemy.entity);
        enemy.entity.destroy(); 
        delete this.enemies[id];
    }
};

EnemyManager.prototype._spawnEnemy = function(data) {
    var config = window.BrawlerConfig ? (window.BrawlerConfig[data.b] || {}) : {};
    var maxHp = config.health || 1000;
    var skinKey = data.skinKey || '';
    var template = this.app.combatManager ? this.app.combatManager.getCharacterTemplate(data.b, skinKey) : null;
    if (!template) return;

    var enemyEntity = template.clone(); 
    enemyEntity.enabled = (data.s !== 3);
    enemyEntity.setPosition(data.x, 0, data.z); 
    template.parent.addChild(enemyEntity);

    this.enemies[data.id] = {
        id: data.id, 
        playerName: data.name || null,   // 🌟 真人玩家名字（頭頂顯示）
        attackAnimTimer: 0,              // 🌟 斷層一：開火動畫鎖
        _pvpThreatTimer: 0,              // 🌟 PVP Perfect Dodge 隱性威脅窗口
        _deathVanishTimer: 0,
        _deathVanishTotal: 0,
        stunTimer: 0,                    // 🌟 斷層三：暈眩計時
        _initialStunDuration: 0,         // 🌟 對齊 player/bot：暈眩長度過濾
        activeStates: {},                // 🌟 對齊 player/bot：DOT 狀態（由 _onEnemyState 同步）
        brawlerType: data.b, 
        skinKey: skinKey,
        entity: enemyEntity, 
        animEntity: enemyEntity, 
        ownerType: 'enemy', 
        team: data.team, 
        _preTransformHp: 0,
        _preTransformMaxHp: 0,
        _sharedMaxHp: 0,
        _transformOriginType: '',
        targetX: data.x, 
        targetZ: data.z, 
        targetR: data.r, 
        currentR: data.r || 0,   // 🌟 純變數記憶當前角度（不向引擎讀回，避免 180度奇異點）
        s: data.s, 
        config: config,
        maxHp: maxHp, 
        hp: (data.s === 3) ? 0 : maxHp, 
        flashTimer: 0, 
        invincibleTimer: this.invincibleTime, 
        lastDamageTime: Date.now(),
        isStealth: false, 
        stealthTimer: 0, 
        decoyEntity: null, 
        decoyAnimEntity: null, 
        decoyTimer: 0, 
        decoyConfig: null,
        decoyDirX: 0, 
        decoyDirZ: 0, 
        revealTimer: 0, 
        lastVisibility: true,
        // _isJumping / _jump*：舊跳躍系統已停用
        superBurstRemaining: 0,  
        superBurstTimer: 0,
        superBurstAngle: 0,
        gemCount: 0,
        // 🌟 預備假擊退變數
        vKbkX: 0,
        vKbkZ: 0,
        _kbkBoostTimer: 0,   // 🌟 擊退加速計時
        // 🌟 受擊形變 (Squash & Stretch)
        _squashScale: 0,
        _squashVelocity: 0,
        _baseAnimScale: null,
        _animMirrorSign: 1,
        _weaponProps: null
    };

    var isEnemy = true; 
    if (this.app.gameMode === '3V3_BOUNTY' || this.app.gameMode === '3V3_KNOCKOUT') {
        if (data.team === this.app.myTeam) isEnemy = false; 
    }

    try {
        if (this.app.combatManager) {
            this.app.combatManager.tintHealthAndRing(enemyEntity, isEnemy);
        }
        
        var hpFill = enemyEntity.findByName('HealthFill');
        if (hpFill) hpFill.enabled = false;
        var hpBg = enemyEntity.findByName('HealthBackground');
        if (hpBg) hpBg.enabled = false;

        var eName = config.name || data.b;
        var relation = isEnemy ? 'enemy' : 'ally';
        
        if (this.app.floatingUIManager) {
            this.app.floatingUIManager.registerUI(enemyEntity, eName, maxHp, relation, this.enemies[data.id].playerName);
            this.app.floatingUIManager.updateHealth(enemyEntity, this.enemies[data.id].hp);
            
            if (this.app.floatingUIManager.updateGems) {
                this.app.floatingUIManager.updateGems(enemyEntity, 0);
            }
        }
        
        var animNode = this.app.combatManager ? this.app.combatManager.findAnimEntity(enemyEntity) : enemyEntity;
        if (animNode) {
            this.enemies[data.id].animEntity = animNode;
        }
    } catch (e) {
        console.warn("視覺模型設定出現異常", e);
    }
};

EnemyManager.prototype._onEnemyRespawned = function(data) {
    var enemy = this.enemies[data.id];
    if (enemy) {
        if (this.app.gameModeManager && this.app.gameModeManager.isRoundOver) return;
        
        if (enemy.brawlerType === 'diaochan_lubu') {
            this._transformEnemy(enemy, 'diaochan');
        }

        enemy.hp = enemy.maxHp; 
        enemy.s = 1; 
        enemy.invincibleTimer = this.invincibleTime;
        enemy.isStealth = false; 
        enemy.stealthTimer = 0; 
        enemy.revealTimer = 0;
        
        this.updateGemCount(data.id, 0);
        
        // 🌟 重生時確保假擊退歸零
        enemy.vKbkX = 0;
        enemy.vKbkZ = 0;
        
        if (this.app.combatManager) {
            this.app.combatManager.setEntityOpacity(enemy.entity, 1.0);
            this.app.combatManager.setEntityVisibility(enemy.entity, true);
        }
        
        if (this.app.floatingUIManager) {
            this.app.floatingUIManager.updateHealth(enemy.entity, enemy.hp);
        }
        
        enemy.lastVisibility = true;
        enemy.lastDamageTime = Date.now(); 
        enemy.targetX = data.x; 
        enemy.targetZ = data.z;
        enemy.entity.setPosition(data.x, 0, data.z); 
        enemy.entity.enabled = true; 
        
        // _isJumping / _jump*：舊跳躍系統已停用

        if (enemy.animEntity) {
            enemy.animEntity.setLocalPosition(0, 0, 0); 
            if (enemy.animEntity.anim) {
                enemy.animEntity.anim.setFloat('speed', 0); 
                enemy.animEntity.anim.speed = 1.0; 
            }
        }
    }
};

EnemyManager.prototype.updateGemCount = function(enemyId, newCount) {
    var enemy = this.enemies[enemyId];
    if (enemy) {
        enemy.gemCount = newCount;
        if (this.app.floatingUIManager && this.app.floatingUIManager.updateGems) {
            this.app.floatingUIManager.updateGems(enemy.entity, enemy.gemCount);
        }
    }
};

// 🌟 重寫：對齊 playerController 的攻擊系統（comboOverrides + cIdx），支援所有新 pattern 與 super
// 🌟 對方翻滾：播 roll 動畫（位置由 enemyMoved 同步，這裡只補動作）
// 🌟 對方狀態同步（DOT/stun）：用跟 player/bot 完全一致的 activeStates + stunTimer 結構
EnemyManager.prototype._onEnemyState = function(data) {
    var enemy = this.enemies[data.id];
    if (!enemy) return;

    // activeStates：直接用 player 廣播的（type + duration），結構與 player/bot 一致
    enemy.activeStates = {};
    if (data.states) {
        for (var k in data.states) {
            enemy.activeStates[k] = { duration: data.states[k].duration };
        }
    }

    // stun：與 player/bot 一致（stunTimer + _initialStunDuration）
    enemy.stunTimer = data.stunTimer || 0;
    enemy._initialStunDuration = data.initialStun || 0;
};

EnemyManager.prototype._onEnemyRoll = function(data) {
    var enemy = this.enemies[data.id];
    console.log("[Enemy] apply roll id=" + data.id + " enemy var mi=" + !!enemy);
    if (!enemy || enemy.hp <= 0 || enemy.s === 3) return;

    if (enemy.animEntity && enemy.animEntity.anim) {
        var config = enemy.config || window.BrawlerConfig[enemy.brawlerType];
        var dashAnim = (config && config.dashAnimTrigger !== undefined) ? config.dashAnimTrigger : 'roll';
        if (dashAnim !== 'none') {
            enemy.animEntity.anim.setTrigger(dashAnim);
        }
    }
    // 鎖一下動畫權重，避免翻滾動作被位置封包切換打斷（對齊攻擊的處理）
    enemy.attackAnimTimer = 0.35;
};

EnemyManager.prototype._setPvpThreatTimer = function (enemy, atkConf) {
    if (!enemy || !atkConf) return;
    var d = atkConf.fireDelay || 0;
    var telegraphTotal = Math.min(1.2, d + 0.15);
    enemy._pvpThreatTimer = Math.max(enemy._pvpThreatTimer || 0, telegraphTotal);
};

EnemyManager.prototype._onEnemyShot = function(data) {
    var enemy = this.enemies[data.id];
    console.log("[Enemy] apply shot id=" + data.id + " enemy var mi=" + !!enemy);
    if (!enemy) return;

    // 變身同步（貂蟬機甲）
    if (data.b && enemy.brawlerType !== data.b) {
        this._transformEnemy(enemy, data.b);
    }

    if (enemy.hp <= 0) return;

    // 出手即現形（隱身/草叢）
    if (enemy.isStealth) {
        enemy.isStealth = false;
        enemy.stealthTimer = 0;
        if (this.app.combatManager) this.app.combatManager.setEntityOpacity(enemy.entity, 1.0);
    }
    enemy.revealTimer = 2.5;
    if (this.app.combatManager) this.app.combatManager.setEntityVisibility(enemy.entity, true);
    enemy.lastVisibility = true;

    // 朝向同步
    enemy.targetR = data.a * (180 / Math.PI);
    enemy.currentR = enemy.targetR;   // 🌟 開火瞬間直接覆寫記憶角度（避免轉向插值干擾攻擊朝向）
    enemy.entity.setEulerAngles(0, enemy.targetR, 0);
    enemy.attackLock = 0.2;

    var config = enemy.config || (window.BrawlerConfig ? window.BrawlerConfig[data.b] : {}) || {};
    var ePos = enemy.entity.getPosition();

    // ==========================================
    // 🌟 大招分支（對齊 playerController._spawnSuper）
    // ==========================================
    if (data.isSuper) {
        var superConf = config.super || {};

        this._setPvpThreatTimer(enemy, superConf);

        // 1. 抬手視覺即時觸發 (第 0 秒立刻做，對手才看得到你舉刀蓄力)
        this._setEnemyWeaponVisible(enemy, !superConf.hideWeaponProp);

        if (enemy.animEntity && enemy.animEntity.anim) {
            enemy.animEntity.anim.setTrigger('superAttack');
        }
        this._setEnemyAnimMirror(enemy, !!superConf.animMirror);
        enemy.entity.fire('trail:play', superConf);

        var sType = superConf.type;
        if (sType === 'super_transform') {
            return;
        }

        // 🌟 2. 實質傷害判定：強制包入延遲容器中！
        var superDelay = superConf.fireDelay || 0;
        var self = this;
        var enemyId = enemy.id;

        var executeEnemySuper = function() {
            var e = self.enemies[enemyId];
            // 蓄力期間武將可能已被陣亡/離線，發射前作終極存活校驗
            if (!e || e.hp <= 0 || e.s === 3 || !e.entity || !e.entity.enabled) return;

            var curPos = e.entity.getPosition();

            // 相機震動移至此處：例如流星1.2秒後砸地，螢幕不該在0秒時震動
            var distToPlayerSq = Infinity;
            var pCtrlS = self.app.playerController;
            if (pCtrlS && pCtrlS.player && !pCtrlS.isDead) {
                var pPosS = pCtrlS.player.getPosition();
                distToPlayerSq = (curPos.x - pPosS.x) * (curPos.x - pPosS.x) + (curPos.z - pPosS.z) * (curPos.z - pPosS.z);
            }
            if (superConf.cameraShake && distToPlayerSq < 100) {
                self.app.fire('camera:shake', superConf.cameraShake * (1 - Math.sqrt(distToPlayerSq) / 10));
            }

            if (sType === 'super_pierce') {
                if (self.app.combatManager) {
                    // 🌟 版本斷層修復：合併大招設定（superConf），否則讀到的是普攻 config，
                    //    讀不到大招專屬的 bulletKey/傷害/穿刺等（關羽大招就是這樣失效）。對齊 homing_bomb 與 player。
                    var mergedPierce = Object.assign({}, config, superConf);
                    mergedPierce.isSuper = true;
                    mergedPierce.super = superConf;
                    self.app.combatManager.executeSuperPierce('enemy', e.id, e.team, data.b, curPos, data.a, mergedPierce);
                }
            }
            else if (sType === 'super_homing_bomb' || superConf.attackPattern === 'super_homing_bomb') {
                if (self.app.combatManager) {
                    var mergedHoming = Object.assign({}, config, superConf);
                    mergedHoming.isSuper = true;
                    mergedHoming.super = superConf;
                    var shCount = superConf.spreadCount || superConf.projectileCount || 1;
                    var shRad = (superConf.spreadAngle || 0) * Math.PI / 180;
                    for (var sh = 0; sh < shCount; sh++) {
                        var shA = data.a;
                        var shX = curPos.x, shZ = curPos.z;
                        if (shCount > 1) {
                            shA = data.a - shRad / 2 + (shRad / (shCount - 1)) * sh;
                            shX += Math.sin(shA) * 0.5;
                            shZ += Math.cos(shA) * 0.5;
                        }
                        self.app.combatManager.executeSuperHomingBomb('enemy', e.id, e.team, data.b, {x: shX, z: shZ}, shA, mergedHoming);
                    }
                }
            }
            else if (sType === 'super_liubei_tree') {
                if (self.app.combatManager) {
                    self._tempVec1.set(curPos.x + Math.sin(data.a) * 2, 0, curPos.z + Math.cos(data.a) * 2);
                    self.app.combatManager.executeSuperLiuBeiTree('enemy', e.id, e.team, data.b, self._tempVec1, data.a, superConf);
                }
            }
            else if (sType === 'super_skyfall' || sType === 'super_zhouyu_burst') {
                if (self.app.combatManager && self.app.combatManager.beginSuperSkyfall) {
                    self.app.combatManager.beginSuperSkyfall(
                        'enemy', e.id, e.team, data.b || e.brawlerType,
                        curPos, data.a, data.d !== undefined ? data.d : 1.0, superConf, null
                    );
                }
            }
            else if (sType === 'super_zhangfei_roar') {
                e.superBurstRemaining = superConf.burstCount || 7;
                e.superBurstTimer = 0;
                e.superBurstAngle = data.a;
            }
            else if (sType === 'super_whirlwind') {
                e.superBurstRemaining = superConf.burstCount || 10;
                e.superBurstTimer = 0;
                e.superBurstAngle = data.a;
            }
            else if (sType === 'super_decoy') {
                e.isStealth = true;
                e.stealthTimer = superConf.stealthDuration || 3.0;
                e.revealTimer = 0;
                if (self.app.combatManager) {
                    e.decoyEntity = self.app.combatManager.spawnDecoy(e.team, data.b, curPos, data.a);
                    e.decoyAnimEntity = self._findAnimEntity(e.decoyEntity) || e.decoyEntity;
                    e.decoyDirX = Math.sin(data.a);
                    e.decoyDirZ = Math.cos(data.a);
                }
                e.decoyTimer = superConf.decoyLifetime || 3.0;
                e.decoyConfig = superConf;
                e.decoyOwnerSpeed = (e.config && e.config.speed) || 8;
            }
            else {
                var mergedSuper = Object.assign({}, config, superConf);
                mergedSuper.isSuper = true;
                self._spawnEnemyAttackByPattern(e, mergedSuper, data.a, data.d || 1.0);
            }
        };

        if (superDelay > 0) {
            setTimeout(executeEnemySuper, superDelay * 1000);
        } else {
            executeEnemySuper();
        }
        return;
    }

    // ==========================================
    // 🌟 普攻分支（用 cIdx 查 comboOverrides，對齊 _executeAttack）
    // ==========================================
    var atkConf;
    if (data.isEmptyPunch && window.BrawlerConfig && BrawlerConfig.getEmptyAmmoPunchConf) {
        atkConf = BrawlerConfig.getEmptyAmmoPunchConf(data.b);
    } else {
        var cIdx = (data.cIdx !== undefined) ? data.cIdx : 0;
        var stepOverride = config.comboOverrides ? config.comboOverrides[cIdx] : null;
        atkConf = stepOverride ? Object.assign({}, config, stepOverride) : config;
    }

    this._setPvpThreatTimer(enemy, atkConf);

    // 武器 prop（對齊 hideWeaponProp）
    this._setEnemyWeaponVisible(enemy, !atkConf.hideWeaponProp);

    // 動畫：用該段的 animTrigger（對齊 comboOverrides）
    if (enemy.animEntity && enemy.animEntity.anim) {
        enemy.animEntity.anim.setTrigger(atkConf.animTrigger || 'attack');
    }
    this._setEnemyAnimMirror(enemy, !!atkConf.animMirror);
    enemy.entity.fire('trail:play', atkConf);

    // 🌟 動畫鎖時長修復：用該段實際攻擊時長鎖住動畫權重，避免長動畫（如曹操 attack2/3 拉弓）被提早打斷。
    //    取 fireDelay（拉弓到放箭的時間）與 shootCooldown 的較大值，再加緩衝讓放箭動作播完。
    var animLockDur = Math.max(atkConf.fireDelay || 0, atkConf.shootCooldown || 0.4) + 0.15;
    enemy.attackAnimTimer = animLockDur;

    // 🌟 rushConfig：enemy 端只播衝刺動畫，不位移（位移交給 server 位置同步）
    // 動畫已由 animTrigger 播放，這裡不做位置處理

    // 🌟 Bug B 修復：補上 fireDelay —— 動畫立刻播（上面已觸發），但子彈延遲發射，
    //    對齊 player 真實射出時機（player 是 fireDelay 後才射，廣播卻在按下當下，故 enemy 端要補延遲）
    var fireDelay = atkConf.fireDelay || 0;
    if (fireDelay > 0) {
        var self = this;
        var enemyId = enemy.id;
        setTimeout(function() {
            // 延遲期間 enemy 可能已死亡/離線/變身，發射前再驗證
            var e = self.enemies[enemyId];
            if (!e || e.hp <= 0 || e.s === 3 || !e.entity || !e.entity.enabled) return;
            self._spawnEnemyAttackByPattern(e, atkConf, data.a, data.d || 1.0);
        }, fireDelay * 1000);
    } else {
        this._spawnEnemyAttackByPattern(enemy, atkConf, data.a, data.d || 1.0);
    }
};

// 🌟 共用：依 attackPattern 重建攻擊（對齊 playerController._spawnProjectiles）
EnemyManager.prototype._spawnEnemyAttackByPattern = function(enemy, atkConf, angle, distance) {
    if (!this.app.combatManager || enemy.hp <= 0) return;
    var ePos = enemy.entity.getPosition();
    var pType = atkConf.attackPattern || atkConf.type || 'normal';

    if (pType === 'burst' || pType === 'flamethrower') {
        enemy.burstRemaining = atkConf.burstCount || 5;
        enemy.burstTimer = 0;
        enemy.burstAngle = angle;
        enemy.burstType = enemy.brawlerType;
        enemy.burstInterval = atkConf.burstInterval || 0.08;
        enemy.attackPattern = pType;
        enemy._burstConfig = atkConf;
    }
    else if (pType === 'super_homing_bomb' || pType === 'homing') {
        var hCount = atkConf.projectileCount || atkConf.spreadCount || 1;
        var hRad = (atkConf.spreadAngle || 0) * Math.PI / 180;
        for (var h = 0; h < hCount; h++) {
            var hA = angle, hX = ePos.x, hZ = ePos.z;
            if (hCount > 1) {
                hA = angle - hRad / 2 + (hRad / (hCount - 1)) * h;
                hX += Math.sin(hA) * 0.5;
                hZ += Math.cos(hA) * 0.5;
            }
            this.app.combatManager.executeSuperHomingBomb('enemy', enemy.id, enemy.team, enemy.brawlerType, {x: hX, z: hZ}, hA, atkConf);
        }
    }
    else if (pType === 'spread') {
        var count = atkConf.spreadCount || atkConf.projectileCount || 5;
        var totalRad = (atkConf.spreadAngle || 30) * Math.PI / 180;
        for (var i = 0; i < count; i++) {
            var a = angle;
            if (count > 1) a = angle - totalRad / 2 + (totalRad / (count - 1)) * i;
            a += (Math.random() - 0.5) * 0.04;
            this.app.combatManager.fireProjectile('enemy', enemy.id, enemy.team, enemy.brawlerType, ePos, a, 'normal', distance, atkConf);
        }
    }
    else {
        // imelee / dash / boomerang / melee / lob / explode / normal / pierce / wave
        // 直接交給 fireProjectile 的統一路由（它會處理 imelee/dash/boomerang 等所有 pattern）
        this.app.combatManager.fireProjectile('enemy', enemy.id, enemy.team, enemy.brawlerType, ePos, angle, pType, distance, atkConf);
    }
};

// 🌟 武器 prop 顯示控制（對齊 hideWeaponProp）
EnemyManager.prototype._setEnemyWeaponVisible = function(enemy, visible) {
    if (!enemy.entity) return;
    if (!enemy._weaponProps) {
        enemy._weaponProps = enemy.entity.findByName('WeaponProp');
    }
    if (enemy._weaponProps) enemy._weaponProps.enabled = visible;
};

EnemyManager.prototype._setEnemyAnimMirror = function(enemy, on) {
    if (!enemy) return;
    enemy._animMirrorSign = on ? -1 : 1;
    if (!enemy.animEntity) return;
    if (!enemy._baseAnimScale) {
        enemy._baseAnimScale = enemy.animEntity.getLocalScale().clone();
    }
    var sq = enemy._squashScale || 0;
    var s = 1.0 + sq;
    var y = 1.0 - (sq * 0.5);
    enemy.animEntity.setLocalScale(
        enemy._baseAnimScale.x * enemy._animMirrorSign * s,
        enemy._baseAnimScale.y * y,
        enemy._baseAnimScale.z * s
    );
};

EnemyManager.prototype._updateOrphanDecoys = function(dt, limitX, limitZ) {
    if (!this._orphanDecoys || this._orphanDecoys.length === 0) return;
    for (var i = this._orphanDecoys.length - 1; i >= 0; i--) {
        var d = this._orphanDecoys[i];
        this._updateEnemyDecoy(d, dt, limitX, limitZ);
        if (!(d.decoyTimer > 0) || !d.decoyEntity) {
            this._orphanDecoys.splice(i, 1);
        }
    }
};

EnemyManager.prototype._updateEnemyDecoy = function(enemy, dt, limitX, limitZ) {
    if (!enemy || !(enemy.decoyTimer > 0) || !enemy.decoyEntity || enemy.decoyEntity._destroyed) {
        if (enemy && enemy.decoyEntity && enemy.decoyEntity._destroyed) {
            enemy.decoyEntity = null;
            enemy.decoyAnimEntity = null;
            enemy.decoyTimer = 0;
        }
        return;
    }

    var speedBase = enemy.decoyOwnerSpeed || (enemy.config && enemy.config.speed) || 8;
    var dSpeed = speedBase * 0.8;
    var dPos = enemy.decoyEntity.getPosition();
    var dNewX = dPos.x + enemy.decoyDirX * dSpeed * dt;
    var dNewZ = dPos.z + enemy.decoyDirZ * dSpeed * dt;
    dNewX = pc.math.clamp(dNewX, -limitX, limitX);
    dNewZ = pc.math.clamp(dNewZ, -limitZ, limitZ);

    var dFinalX = dPos.x;
    var dFinalZ = dPos.z;
    if (this.app.combatManager) {
        if (!this.app.combatManager.checkCollision(dNewX, dPos.z)) dFinalX = dNewX;
        if (!this.app.combatManager.checkCollision(dFinalX, dNewZ)) dFinalZ = dNewZ;
    }
    enemy.decoyEntity.setPosition(dFinalX, 0, dFinalZ);

    if (enemy.decoyAnimEntity && enemy.decoyAnimEntity.anim) {
        enemy.decoyAnimEntity.anim.setFloat('speed', 1);
    }

    enemy.decoyTimer -= dt;
    if (enemy.decoyTimer > 0) return;

    if (this.app.bulletManager && this.app.combatManager) {
        this.app.bulletManager._triggerExplosion({
            entity: enemy.decoyEntity,
            aoeTemplate: this.app.combatManager.aoeMap['caocao'] || enemy.decoyEntity,
            explodeRadius: (enemy.decoyConfig && enemy.decoyConfig.explodeRadius) || 2.5,
            explodeDamage: (enemy.decoyConfig && enemy.decoyConfig.explodeDamage) || 400,
            ownerType: 'enemy',
            ownerId: enemy.id,
            ownerTeam: enemy.team,
            config: enemy.config,
            skillConf: enemy.decoyConfig
        });
    }
    if (this.app.floatingUIManager) {
        this.app.floatingUIManager.removeUI(enemy.decoyEntity);
    }
    enemy.decoyEntity.destroy();
    enemy.decoyEntity = null;
    enemy.decoyAnimEntity = null;
};

EnemyManager.prototype.update = function(dt) {
    dt = Math.min(dt, 0.1); 

    var now = Date.now();
    var limitX = this.app.gameModeManager ? this.app.gameModeManager.mapLimitX : 11.5;
    var limitZ = this.app.gameModeManager ? this.app.gameModeManager.mapLimitZ : 10.0;

    this._updateOrphanDecoys(dt, limitX, limitZ);

    var myBushIdx = -1; 
    var pCtrl = this.app.playerController;
    if (pCtrl && pCtrl.player && !pCtrl.isDead) {
        myBushIdx = this.app.gameModeManager ? this.app.gameModeManager.getBushIndex(pCtrl.player.getPosition().x, pCtrl.player.getPosition().z) : -1;
    }

    for (var id in this.enemies) {
        var enemy = this.enemies[id]; 
        var ent = enemy.entity;
        
        // _isJumping / executeJump：目前專案沒有任何技能會啟用，移除相關更新分支

        this._updateEnemyDecoy(enemy, dt, limitX, limitZ);

        if (enemy.s === 3 || (enemy.hp <= 0 && enemy.brawlerType !== 'diaochan_lubu')) {
            this._beginDeathVanish(enemy);

            if (ent && ent.enabled) {
                // 灰材質已在 _beginDeathVanish 套一次
                if (enemy._deathVanishTimer && enemy._deathVanishTimer > 0) {
                    enemy._deathVanishTimer -= dt;
                    if (enemy._deathVanishTimer <= 0) {
                        enemy._deathVanishTimer = 0;
                        ent.enabled = false;
                    }
                } else {
                    ent.enabled = false;
                }
            }
            continue;
        }
        
        var pos = ent.getPosition(); 
        
        if (enemy.hp <= 0 && enemy.brawlerType === 'diaochan_lubu') {
             enemy.targetX = pos.x;
             enemy.targetZ = pos.z;
        }

        if (enemy.revealTimer > 0) {
            enemy.revealTimer -= dt;
        }
        
        var enemyBushIdx = this.app.gameModeManager ? this.app.gameModeManager.getBushIndex(pos.x, pos.z) : -1;
        var inBush = (enemyBushIdx !== -1);
        
        var isEnemyToMe = (this.app.myTeam === 'none' || enemy.team !== this.app.myTeam);
        var shouldBeVisible = true;
        
        if (enemy.isStealth) {
            shouldBeVisible = false;
        } else if (isEnemyToMe && inBush && enemy.revealTimer <= 0) {
            if (myBushIdx === -1 || myBushIdx !== enemyBushIdx) {
                shouldBeVisible = false;
            }
        }

        if (enemy.lastVisibility !== shouldBeVisible) {
            if (this.app.combatManager) {
                this.app.combatManager.setEntityVisibility(enemy.entity, shouldBeVisible);
            }
            enemy.lastVisibility = shouldBeVisible;
        }

        if (enemy.isStealth && enemy.stealthTimer > 0) {
            enemy.stealthTimer -= dt;
            if (enemy.stealthTimer <= 0) { 
                enemy.isStealth = false; 
                enemy.stealthTimer = 0; 
            }
        }

        if (enemy.attackLock > 0) {
            enemy.attackLock -= dt;
        }
        
        if (enemy.flashTimer > 0) { 
            enemy.flashTimer -= dt; 
            if (enemy.flashTimer <= 0 && this.app.combatManager) {
                this.app.combatManager.setEntityOpacity(enemy.entity, enemy.isStealth ? 0.4 : 1.0); 
            }
        }

        if (enemy.invincibleTimer > 0) {
            enemy.invincibleTimer -= dt;
            if (enemy.invincibleTimer <= 0) { 
                enemy.invincibleTimer = 0; 
                if (this.app.combatManager) {
                    this.app.combatManager.setEntityOpacity(enemy.entity, enemy.isStealth ? 0.4 : 1.0); 
                }
            } 
            else if (enemy.flashTimer <= 0 && !enemy.isStealth && this.app.gameState === 'playing') {
                if (this.app.combatManager) {
                    var isFlashOn = (Math.floor(enemy.invincibleTimer / 0.15) % 2 === 0);
                    this.app.combatManager.setEntityOpacity(enemy.entity, isFlashOn ? 0.3 : 1.0);
                }
            }
        }

        var enemyConfig = enemy.config; 
        if (enemyConfig && enemyConfig.isMecha && enemyConfig.autoDrainRate && enemy.hp > 0) {
            enemy.hp -= enemy.maxHp * enemyConfig.autoDrainRate * dt;
            enemy.lastDamageTime = now;
            if (enemy.hp < 0) enemy.hp = 0; 
            if (this.app.floatingUIManager) {
                this.app.floatingUIManager.updateHealth(enemy.entity, enemy.hp);
            }
            if (enemy.hp <= 0 && enemy.brawlerType === 'diaochan_lubu') {
                this._transformEnemy(enemy, 'diaochan');
            }
        } else if (now - enemy.lastDamageTime > 3000 && enemy.hp > 0 && enemy.hp < enemy.maxHp) {
            enemy.hp = Math.min(enemy.hp + enemy.maxHp * 0.13 * dt, enemy.maxHp);
            if (this.app.floatingUIManager) {
                this.app.floatingUIManager.updateHealth(enemy.entity, enemy.hp);
            }
        }

        // 🌟 斷層三修復：暈眩主權閘門 — 暈眩期間凍結位移 lerp（避免暈眩敵人還滑過來）
        if (enemy.stunTimer > 0) {
            enemy.stunTimer -= dt;
            enemy.attackAnimTimer = 0;
            if (enemy._animMirrorSign === -1) this._setEnemyAnimMirror(enemy, false);
            // 暈眩期間不更新位置（保持原地），但仍套用假擊退（下方）
        } else {
            var dex = enemy.targetX - pos.x;
            var dez = enemy.targetZ - pos.z;
            var distErrorSq = dex * dex + dez * dez;
            var lerpSpeed = distErrorSq > 4.0 ? 15 : 5; 

            // 🌟 擊退加速期：用高 lerp 速度讓擊退瞬間到位（踏實打擊感）
            if (enemy._kbkBoostTimer && enemy._kbkBoostTimer > 0) {
                enemy._kbkBoostTimer -= dt;
                lerpSpeed = 25;
            }

            var newX = pc.math.lerp(pos.x, enemy.targetX, dt * lerpSpeed); 
            var newZ = pc.math.lerp(pos.z, enemy.targetZ, dt * lerpSpeed);
            
            newX = pc.math.clamp(newX, -limitX, limitX); 
            newZ = pc.math.clamp(newZ, -limitZ, limitZ);

            // 🌟 朝向（對齊 player：攻擊時朝攻擊方向、移動時朝移動方向、靜止時保持 facing）
            //    用「往目標的方向」(targetX - pos)，不是單幀 lerp 位移。
            //    單幀位移會被 server 位置修正污染（位置一跳，方向就跳到修正方向），
            //    這正是「向上走卻面朝右」的根因（log 顯示 moveX 突然=1.274 → 90度）。
            //    往目標方向是穩定的移動意圖，不受單幀跳變影響。
            if (!enemy.attackLock || enemy.attackLock <= 0) {
                var toTargetX = enemy.targetX - pos.x;
                var toTargetZ = enemy.targetZ - pos.z;
                if ((toTargetX * toTargetX + toTargetZ * toTargetZ) > 0.0025) {
                    // 移動中：面向「要去的方向」
                    enemy.targetR = Math.atan2(toTargetX, toTargetZ) * (180 / Math.PI);
                } else if (enemy._serverFacing !== undefined) {
                    // 已到位/靜止：用 server 廣播的 facing（玩家站著瞄準的方向）
                    enemy.targetR = enemy._serverFacing;
                }
            }
            
            ent.setPosition(newX, 0, newZ); 
        }
        
        // 🌟 核心修復：用純變數 enemy.currentR 記憶角度，絕不向引擎讀 getLocalEulerAngles().y。
        //    引擎底層是四元數，getLocalEulerAngles 在 180 度附近會讀回錯誤的等價值（如 90/0），
        //    導致程式誤判方向而抽搐。player 用純變數 _facingAngle 所以沒事，enemy 照做。
        if (enemy.currentR === undefined) enemy.currentR = enemy.targetR || 0;
        var diffR = enemy.targetR - enemy.currentR;
        while (diffR < -180) diffR += 360;
        while (diffR > 180) diffR -= 360;
        enemy.currentR += diffR * (dt * 10);
        while (enemy.currentR <= -180) enemy.currentR += 360;
        while (enemy.currentR > 180) enemy.currentR -= 360;

        ent.setEulerAngles(0, enemy.currentR, 0);

        // 🌟 假擊退演算法：利用視覺錯覺帶來打擊震撼感
        if (Math.abs(enemy.vKbkX) > 0.01 || Math.abs(enemy.vKbkZ) > 0.01) {
            enemy.vKbkX = pc.math.lerp(enemy.vKbkX, 0, dt * 15);
            enemy.vKbkZ = pc.math.lerp(enemy.vKbkZ, 0, dt * 15);
        } else {
            enemy.vKbkX = 0; 
            enemy.vKbkZ = 0;
        }

        if (enemy.animEntity && enemy.animEntity.anim) {
            // 移動動畫：移動中=1、靜止=0（控制走路/待機混合，與 attack 連段無關）
            var speedVal = (enemy.s === 1 && enemy.hp > 0) ? 1 : 0;
            
            enemy.animEntity.anim.setFloat('speed', speedVal);

            // 🌟 移除舊的 s===2 攻擊觸發：
            //    攻擊動畫現在由 _onEnemyShot 用 cIdx 查 comboOverrides 觸發正確連段（attack1/2/3）。
            //    此處舊寫法寫死 'attack'（你的圖裡是 attack1/2/3，'attack' 不存在或錯誤），
            //    且會打斷正確連段動畫造成「快播/播不完整」，故移除。
            enemy.lastState = enemy.s;
        if (enemy.animEntity.anim.layers) {
                // 🌟 核心一：開火計時器實時倒數
                if (enemy.attackAnimTimer > 0) {
                    enemy.attackAnimTimer -= dt;
                    if (enemy.attackAnimTimer <= 0) {
                        enemy.attackAnimTimer = 0;
                        this._setEnemyAnimMirror(enemy, false);
                    }
                }
                if (enemy._pvpThreatTimer > 0) {
                    enemy._pvpThreatTimer -= dt;
                    if (enemy._pvpThreatTimer <= 0) enemy._pvpThreatTimer = 0;
                }

                for (var l = 0; l < enemy.animEntity.anim.layers.length; l++) {
                    var layer = enemy.animEntity.anim.layers[l];
                    if (layer.name === 'Shoot') {
                        var stateName = layer.activeState || '';
                        
                        // 🌟 核心二：全圖譜關鍵字防呆（普攻 + 大招全包）
                        var isActiveAttack = stateName.indexOf('Attack') !== -1 || stateName.indexOf('attack') !== -1;
                        var isSuper = stateName.indexOf('Super') !== -1 || stateName.indexOf('super') !== -1;
                        
                        // 🌟 核心三：雙保險鎖死權重
                        // 只要「開火時長還沒到」OR「當前圖卡正處於攻擊/大招節點」，權重就是 1.0！
                        var targetWeight = (enemy.attackAnimTimer > 0 || isActiveAttack || isSuper) ? 1.0 : 0.0;
                        
                        layer.weight = pc.math.lerp(layer.weight, targetWeight, dt * 12); 
                        break;
                    }
                }
            }

            // 🌟 將假擊退疊加進去 (Y 軸維持現狀)
            var curY = enemy.animEntity.getLocalPosition().y;
            enemy.animEntity.setLocalPosition(enemy.vKbkX, curY, enemy.vKbkZ);

            // 🌟 受擊形變 (Squash & Stretch) 彈簧回歸（對齊 player/bot）
            if (!enemy._baseAnimScale) {
                enemy._baseAnimScale = enemy.animEntity.getLocalScale().clone();
            }
            var damping = 0.7, stiffness = 0.5;
            enemy._squashVelocity = (enemy._squashVelocity || 0) - (enemy._squashScale * stiffness);
            enemy._squashVelocity *= damping;
            enemy._squashScale += enemy._squashVelocity;
            var sq = 1.0 + enemy._squashScale;
            var sqy = 1.0 - (enemy._squashScale * 0.5);
            var mirror = enemy._animMirrorSign || 1;
            enemy.animEntity.setLocalScale(
                enemy._baseAnimScale.x * mirror * sq,
                enemy._baseAnimScale.y * sqy,
                enemy._baseAnimScale.z * sq
            );
        }

        // 🌟 狀態圖示：用跟 player/bot 完全一致的邏輯（activeStates + stunTimer + _initialStunDuration）
        //    狀態資料由 _onEnemyState 從 player 廣播同步，這裡只負責顯示（不扣血，server 權威）
        if (this.app.floatingUIManager && this.app.floatingUIManager.updateStatus && enemy.hp > 0) {
            // activeStates 倒數（純視覺，duration 跑完就清，避免圖示殘留）
            if (enemy.activeStates) {
                for (var sk in enemy.activeStates) {
                    if (!enemy.activeStates[sk]) continue;
                    enemy.activeStates[sk].duration -= dt;
                    if (enemy.activeStates[sk].duration <= 0) delete enemy.activeStates[sk];
                }
            }
            if (enemy.stunTimer > 0) enemy.stunTimer -= dt;

            // ── 與 player / bot 共用 CombatResolver.buildStatusIcons ──
            var statusEmojis = (window.CombatResolver && CombatResolver.buildStatusIcons)
                ? CombatResolver.buildStatusIcons(enemy)
                : '';
            if (!statusEmojis) {
                if (enemy.stunTimer > 0 && enemy._initialStunDuration >= 0.5) statusEmojis += "💫";
                if (WordSystem.hasActiveBleedDot(enemy.activeStates)) statusEmojis += "☠️";
                if (WordSystem.hasActiveFireDot(enemy.activeStates)) statusEmojis += "🔥";
            }

            this.app.floatingUIManager.updateStatus(enemy.entity, statusEmojis, null);
        }

        if (enemy.burstRemaining > 0 && enemy.hp > 0) {
            enemy.burstTimer -= dt;
            if (enemy.burstTimer <= 0) {
                var burstConf = enemy._burstConfig || enemy.config;
                var type = enemy.attackPattern === 'flamethrower' ? 'wave' : 'normal';
                var CR = window.CombatResolver;
                var pCount = (CR && CR.getBurstProjectileCount) ? CR.getBurstProjectileCount(burstConf) : (burstConf.projectileCount || burstConf.spreadCount || 1);
                var tRad = (burstConf.spreadAngle || 0) * Math.PI / 180;
                if (this.app.combatManager) {
                    for (var bi = 0; bi < pCount; bi++) {
                        var a = enemy.burstAngle;
                        if (pCount > 1) {
                            a = (CR && CR.getSpreadAngle)
                                ? CR.getSpreadAngle(enemy.burstAngle, burstConf.spreadAngle || 0, bi, pCount)
                                : (enemy.burstAngle - tRad / 2 + (tRad / (pCount - 1)) * bi);
                        }
                        a += (Math.random() - 0.5) * 0.04;
                        this.app.combatManager.fireProjectile('enemy', enemy.id, enemy.team, enemy.burstType, pos, a, type, 1.0, burstConf);
                    }
                }
                enemy.burstRemaining--;
                enemy.burstTimer = enemy.burstInterval;
            }
        } 
        
        if (enemy.superBurstRemaining > 0 && enemy.hp > 0) {
            enemy.superBurstTimer -= dt;
            if (enemy.superBurstTimer <= 0) {
                var sConf = (enemy.config || {}).super || {};
                var sCount = sConf.burstCount || 6;
                var sIdx = sCount - enemy.superBurstRemaining;

                if (this.app.combatManager) {
                    if (sConf.type === 'super_zhouyu_burst' || sConf.type === 'super_skyfall') {
                        // skyfall 一次排程
                    }
                    else if (sConf.type === 'super_zhangfei_roar') {
                        // 🌟 對齊 player/bot：張飛咆哮走 fireProjectile 的 wave
                        var roarConf = Object.assign({}, enemy.config, sConf);
                        roarConf.type = sConf.type;
                        roarConf.isSuper = true;
                        this.app.combatManager.fireProjectile('enemy', enemy.id, enemy.team, enemy.brawlerType, pos, enemy.superBurstAngle || (enemy.targetR * Math.PI / 180), 'wave', 1.0, roarConf);
                    }
                    else if (sConf.type === 'super_whirlwind') {
                        // 🌟 對齊 player/bot：呂布旋風走 fireProjectile 的 melee，繞圈散開
                        var aWhirl = (enemy.superBurstAngle || 0) + (Math.PI / 4) * sIdx;
                        var spawnWhirlX = pos.x + Math.sin(aWhirl) * 1.5;
                        var spawnWhirlZ = pos.z + Math.cos(aWhirl) * 1.5;
                        this._tempVec1.set(spawnWhirlX, 0, spawnWhirlZ);
                        this.app.combatManager.fireProjectile('enemy', enemy.id, enemy.team, enemy.brawlerType, this._tempVec1, aWhirl, 'melee', 1.0, sConf);
                    }
                }
                enemy.superBurstRemaining--;
                enemy.superBurstTimer = sConf.burstInterval || 0.15;
            }
        }
    }

    // 🌟 斷層四：enemy 對玩家的軟碰撞（避免真人對手卡進本地玩家模型）
    this._handleEnemySoftCollision(dt);
};

// 🌟 斷層四：enemy ←→ 本地玩家 軟碰撞推擠
EnemyManager.prototype._handleEnemySoftCollision = function(dt) {
    var pCtrl = this.app.playerController;
    if (!pCtrl || !pCtrl.player || pCtrl.isDead) return;
    var posP = pCtrl.player.getPosition();

    for (var id in this.enemies) {
        var enemy = this.enemies[id];
        if (!enemy.entity || !enemy.entity.enabled) continue;
        if (enemy.hp <= 0 || enemy.s === 3) continue;

        var posE = enemy.entity.getPosition();
        var ddx = posE.x - posP.x;
        var ddz = posE.z - posP.z;
        var dist = Math.sqrt(ddx * ddx + ddz * ddz);

        if (dist < 1.0 && dist > 0.001) {
            var overlap = (1.0 - dist) * (dt * 6.0);
            var nx = posP.x - (ddx / dist) * overlap;
            var nz = posP.z - (ddz / dist) * overlap;
            // 撞牆檢查：能走才推（避免把玩家推進牆裡）
            if (this.app.combatManager && this.app.combatManager.checkCollision) {
                if (!this.app.combatManager.checkCollision(nx, nz)) {
                    pCtrl.player.setPosition(nx, 0, nz);
                }
            } else {
                pCtrl.player.setPosition(nx, 0, nz);
            }
        }
    }
};