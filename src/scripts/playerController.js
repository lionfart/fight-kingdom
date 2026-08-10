//New V3 (Perfected Version)

var PlayerController = pc.createScript('playerController');

/** Core Auto-Aim v2 (B'): 移動錐取得 / 交戰黏住 / 迴避不換鎖
 *  手動模式（設定）：有鎖硬黏，僅換鎖鍵／脫鎖才換 — 見 GameSettings.AIM_MODE */
PlayerController.AUTO_AIM = {
    SCAN_INTERVAL: 0.15,
    CONE_HALF_DEG: 60,
    OUTSIDE_CONE_PENALTY: 8,
    SOFT_STICK: 20,
    COMBO_STICK: 1000,
    ENGAGE_DURATION: 1.25,
    SWITCH_MARGIN: 6,
    SWITCH_DWELL: 0.2,
    AIM_CONTEXT_HOLD: 0.4,
    LOST_FADE: 0.35,
    LEAD_MAX_SEC: 0.45
};

PlayerController.isManualAimMode = function () {
    if (typeof GameSettings !== 'undefined' && typeof GameSettings.isManualAimMode === 'function') {
        return GameSettings.isManualAimMode();
    }
    try {
        return localStorage.getItem('tk_aim_mode') === 'manual';
    } catch (e) {}
    return false;
};

PlayerController.t = function (key, vars) {
    if (window.TKI18n && typeof window.TKI18n.t === 'function') return window.TKI18n.t(key, vars);
    return key;
};
PlayerController.prototype.t = function (key, vars) {
    return PlayerController.t(key, vars);
};

PlayerController.attributes.add('playerTemplate', { type: 'entity', title: 'Player Template' });
PlayerController.attributes.add('tutorialPlayerTemplate', { type: 'entity', title: 'Tutorial Player Template' });
PlayerController.attributes.add('deathMessage', { type: 'entity', title: 'Death Message UI' });
PlayerController.attributes.add('respawnTime', { type: 'number', default: 3, title: '重生等待時間 (秒)' });
PlayerController.attributes.add('invincibleTime', { type: 'number', default: 3, title: '無敵閃爍時間 (秒)' });

PlayerController.prototype.initialize = function () {
    this.player = null; 
    this.animEntity = null; 
    this.lastShootTime = 0; 
    this.brawlerType = 'zhouyu';
    this.config = null;
    
    this.health = 0; 
    this.maxHealth = 0; 
    this.lastDamageTime = 0;
    this.ammo = 0; 
    this.maxAmmo = 0;
    
    this.timeSinceLastAttack = 0; 
    this.isReloading = false;     
    this.stunTimer = 0;
    this._initialStunDuration = 0; // 🌟 記錄暈眩長度以過濾微打斷

    this.comboIndex = 0;
    this.comboResetTime = 2.0; 
    this.lastAttackTime = 0;
    this.currentDamageMult = 1.0; 
    this._currentAttackConfig = null; 

    this._attackQueue = []; 
    this.activeStates = {}; 
    this._pendingIsAutoAim = false;

    this._weaponProp = null;

    this._lockedTargetId = null;     
    this._lockedTargetEntity = null; 
    this.lockOnRing = null;
    this.aimAssistArrow = null;
    this.aimAssistArrowTex = null;
    this._autoAimTimer = 0; 
    this._faceLockTimer = 0;
    this._aimLockState = 'idle'; // idle | soft | engaged
    this._engagedTargetId = null;
    this._engageTimer = 0;
    this._aimContextX = 0;
    this._aimContextZ = 1;
    this._aimContextHoldTimer = 0;
    this._dwellCandidateId = null;
    this._dwellTimer = 0;
    this._lostLockTimer = 0;
    this._lostLockX = 0;
    this._lostLockZ = 0;
    this._lockVelX = 0;
    this._lockVelZ = 0;
    this._lockPrevX = null;
    this._lockPrevZ = null;
    this._lockTrackHadTarget = false;
    this._lockPopTimer = 0;       

    this.maxDashCharges = 2;
    this.currentDashCharges = 2;
    this.dashRechargeTimer = 0;
    this.isDashing = false;
    this._dashCommandedThisFrame = false; 
    
    this._autoStepTimer = 0;
    this._autoStepTargetX = 0;
    this._autoStepTargetZ = 0;

    // 🌟 通用等速衝刺狀態機（劉備穿透 / 張飛撞飛，由 config 的 rushConfig 驅動）
    this._rushState = 'none';   // none / windup / rushing / recover
    this._rushTimer = 0;
    this._rushDirX = 0;
    this._rushDirZ = 0;
    this._rushSpeed = 0;
    this._rushDistTraveled = 0;
    this._rushDistance = 0;
    this._rushRecoverTime = 0;
    this._rushPendingFire = null;  // 衝刺開始時要發射的判定子彈資料
    this._rushAfterimageConf = null;
    this._rushAfterimageTimer = 0;

    this.gemCount = 0; 
    
    this._burstRemaining = 0; 
    this._burstTimer = 0; 
    this._burstAngle = 0;
    this._burstDistance = 1.0;
    this._superBurstRemaining = 0; 
    this._superBurstTimer = 0;
    this._superBurstAngle = 0; 
    this._superCenter = new pc.Vec3(); 
    this.superCharge = 0; 
    this.maxSuperCharge = 1500; 

    this.isDead = false; 
    this._invincible = false;
    this.invincibleTimer = 0; 
    this.respawnTimer = 0;
    
    this._isStealth = false; 
    this.stealthTimer = 0; 
    this.stealthSpeedMultiplier = 1.0;
    this.inBush = false;
    this.revealTimer = 0;
    this._bushUpdateTimer = 0; 
    this._bushRenders = null;
    
    this._decoyEntity = null; 
    this._decoyAnimEntity = null; 
    this._decoyTimer = 0; 
    this._decoyConfig = null;
    this._decoyDirX = 0;
    this._decoyDirZ = 0;
    this._decoyOwnerSpeed = 3.5;

    this._isTransformed = false;
    this._isTransforming = false;
    this._transformCycleIndex = -1;
    this._sharedMaxHealth = 0;
    this._originalConfig = null;
    this._originalBrawlerType = '';
    this._originalHealth = 0;
    this._originalMaxHealth = 0;
    this._originalAmmo = 0;
    this._rogueBuffMults = null;
    this._combatStats = null;
    this.shieldHP = 0;
    this.shieldMax = 0;
    this.shieldMaxPct = 0;
    this._dashTimer = 0;
    this._dashTargetX = 0;
    this._dashTargetZ = 0;
    this._dashStartX = 0;
    this._dashStartZ = 0;
    this._dashTotalDuration = 0;
    this._dashEasePower = 2.5;
    this._autoStepStartX = 0;
    this._autoStepStartZ = 0;
    this._autoStepTotalDuration = 0;
    this._autoStepEasePower = 4;
    this._squashScale = 0;      
    this._squashVelocity = 0;   
    this._baseAnimScale = new pc.Vec3(1, 1, 1);
    this._animMirrorSign = 1;
    this.snareTimer = 0;        
    this.snareMultiplier = 1.0; 

    this.kills = 0;
    this.deaths = 0; 
    this.damageDealt = 0; 
    
    this.hitStopTimer = 0; 
    
    this._currentBodyAngle = 0; 
    this._facingAngle = 0; 
    this._attackAnimTimer = 0;
    // 🚀 新增：實體擊退變數
    this._kbTimer = 0;
    this._kbTargetX = 0;
    this._kbTargetZ = 0;

    this._tempVec1 = new pc.Vec3();
    this._tempVec2 = new pc.Vec3();
    this._tempVec3 = new pc.Vec3();
    this._tempVec2D_1 = new pc.Vec2();
    this._tempVec2D_2 = new pc.Vec2();
    this._tempColor1 = new pc.Color();
    this._tempColor2 = new pc.Color();
    this._botCtrlCache = null; 
    this._lastSuperFull = false;
    this._hitFlashTimer = 0;
    this._perfectCounterStun = 0;
    this._perfectCounterExpire = 0;

    var normalizeMode = function(mode) {
        var m = String(mode || 'FFA').trim().toUpperCase().replace(/\s+/g, '_');
        if (m === '3V3BOUNTY') return '3V3_BOUNTY';
        if (m === '3V3KNOCKOUT') return '3V3_KNOCKOUT';
        return m;
    };

    this._eventHandlers = {
        'player:hit': this._onPlayerHit.bind(this),
        'bot:killed': this._onBotKilled.bind(this),
        'player:clearAmmo': this._onClearAmmo.bind(this),
        'input:flick': this._onFlickDodge.bind(this),
        'network:fullStateSync': this._onFullStateSync.bind(this),
        'round:start': this._onRoundStart.bind(this),
        'camera:startIntro': this._setupIntroCamera.bind(this),
        'enemy:hit': function(data) {
            if (!(this.app.networkManager && this.app.networkManager.socket && this.app.networkManager.socket.connected)) {
                if (!data.ownerId || data.ownerId === 'player' || data.ownerId === this.app.myId) {
                    this._chargeSuper(data.damage);
                }
            }
        }.bind(this),
    'global:syncHit': function(data) {
            var isMultiplayer = !!(this.app.networkManager && this.app.networkManager.socket && this.app.networkManager.socket.connected);
            if (isMultiplayer) {
                if (data.shooterId === 'player' || (this.app.socketId && data.shooterId === this.app.socketId)) {
                    this._chargeSuper(data.damage);
                }
                
                // 🌟 Server 判決「被打中的人就是我」：擊退 + DoT
                if (data.targetId === this.app.socketId) {
                    // 🌟 本地預測擊退協調：若 200ms 內本地已預測過擊退，跳過（避免推兩次）。
                    //    擊退+受擊特效本地已即時做過，這裡只補 DOT（DOT 無延遲問題，由 server 權威）。
                    var recentlyPredicted = this._lastPredictedHitTime && (Date.now() - this._lastPredictedHitTime < 200);
                    if (data.hitMeta && !recentlyPredicted) {
                        this._onPlayerHit(0, data.shooterId, data.isDead, undefined, data.hitMeta);
                    }
                    if (data.dotConfig) {
                        this.applyDebuff(data.dotConfig, data.shooterId);
                    }
                }
            }
        }.bind(this),
        'lobby:matchmakingStatus': function(data) { 
            this.app.myTeam = data.team; 
            this.app.gameMode = normalizeMode(data.mode); 
        }.bind(this),
        'game:start': function(data) {
            this.app.gameMode = normalizeMode(data.mode);
            var sm = this.app.scoreManager;
            this.app.playerName = (sm && sm.resolvePlayerName)
                ? sm.resolvePlayerName(data)
                : (data.playerName || data.name || 'Player');
            if (!data.isMultiplayer) { 
                this.app.myTeam = (this.app.gameMode === 'FFA') ? 'none' : 'blue'; 
                this.app.mySlot = 1; 
            }
            // 🎓 教學局：僅在手動進教學時套用指定武將與造型
            if (String(this.app.gameMode).toUpperCase() === 'ROGUE') {
                var forceTut = !!(this.app._forceTutorialRun || this.app._pendingTutorialRun || (this.app.rogueDirector && this.app.rogueDirector.isTutorialRun));
                if (forceTut) {
                    this.app._pendingTutorialRun = true;
                    if (!this.app._tutorialEntry) {
                        this.app._tutorialEntry = this.app._forceTutorialRun ? 'lobby_help' : 'rogue_inline';
                    }
                    data.brawler = (window.TutorialConfig && window.TutorialConfig.heroBrawlerType) || 'guanyu';
                }
            }
            this.selectedSkinKey = data.skinKey || '';
            this._onSelectBrawler(data.brawler || data.hero || 'guanyu'); 
        }.bind(this),
        'rogue:buffPlayer': function(mults) {
            this.applyRogueBuff(mults);   // 🎲 ROGUE 玩家強化卡
        }.bind(this),
        'rogue:extraBuffs': function(mults) {
            this.applyRogueExtraBuffs(mults);
        }.bind(this),
        'aim:setMode': function() {
            this._dwellCandidateId = null;
            this._dwellTimer = 0;
        }.bind(this)
    };

    for (var evt in this._eventHandlers) {
        this.app.on(evt, this._eventHandlers[evt]);
    }

    this.on('destroy', function() {
        for (var e in this._eventHandlers) {
            this.app.off(e, this._eventHandlers[e]);
        }
        this._destroyRings(); 
    }, this);

    this.app.playerController = this; 
    this.app.myTeam = 'none'; 
    this.app.gameMode = 'FFA';
};

PlayerController.prototype._destroyRings = function() {
    if (this.lockOnRing) {
        this.lockOnRing.enabled = false; 
        if (this.lockOnRing.render && this.lockOnRing.render.meshInstances[0]) {
            var mat = this.lockOnRing.render.meshInstances[0].material;
            if (mat) {
                mat.emissiveMap = null;
                mat.opacityMap = null;
                mat.update();
                mat.destroy();
            }
        }
        if (this.lockOnRingTex) {
            this.lockOnRingTex.destroy();
            this.lockOnRingTex = null;
        }
        this.lockOnRing.destroy();
        this.lockOnRing = null;
    }

    if (this.aimAssistArrow) {
        this.aimAssistArrow.enabled = false;
        if (this.aimAssistArrow.render && this.aimAssistArrow.render.meshInstances[0]) {
            var arrowMat = this.aimAssistArrow.render.meshInstances[0].material;
            if (arrowMat) {
                arrowMat.emissiveMap = null;
                arrowMat.opacityMap = null;
                arrowMat.update();
                arrowMat.destroy();
            }
        }
        if (this.aimAssistArrowTex) {
            this.aimAssistArrowTex.destroy();
            this.aimAssistArrowTex = null;
        }
        this.aimAssistArrow.destroy();
        this.aimAssistArrow = null;
    }
    
    if (this.superRingEntity) {
        this.superRingEntity.enabled = false;
        if (this.superRingMat) {
            this.superRingMat.emissiveMap = null;
            this.superRingMat.opacityMap = null;
            this.superRingMat.update();
            this.superRingMat.destroy();
            this.superRingMat = null;
        }
        if (this.superRingTex) {
            this.superRingTex.destroy();
            this.superRingTex = null;
        }
        this.superRingCtx = null;
        this.superRingCanvas = null;
        this.superRingEntity.destroy();
        this.superRingEntity = null;
    }
};

PlayerController.prototype._createLockOnRing = function() {
    if (this.lockOnRing) return;
    this.lockOnRing = new pc.Entity('LockOnRing');
    this.lockOnRing.addComponent('render', { type: 'plane', castShadows: false, receiveShadows: false });
    
    var canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    var ctx = canvas.getContext('2d');
    var cx = 128, cy = 128, r = 100;

    ctx.clearRect(0, 0, 256, 256);
    ctx.lineCap = 'round';

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)'; 
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.lineWidth = 36;
    for (var i = 0; i < 4; i++) {
        ctx.beginPath();
        var angle = i * (Math.PI / 2);
        ctx.arc(cx, cy, r, angle - 0.2, angle + 0.2);
        ctx.stroke();
    }

    ctx.strokeStyle = '#FFFF00'; 
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.strokeStyle = '#FFCC00'; 
    ctx.lineWidth = 20;
    for (var i = 0; i < 4; i++) {
        ctx.beginPath();
        var angle = i * (Math.PI / 2);
        ctx.arc(cx, cy, r, angle - 0.2, angle + 0.2);
        ctx.stroke();
    }

    if (this.lockOnRingTex) this.lockOnRingTex.destroy();
    this.lockOnRingTex = new pc.Texture(this.app.graphicsDevice, { format: pc.PIXELFORMAT_R8_G8_B8_A8, autoMipmap: false });
    this.lockOnRingTex.setSource(canvas);

    var mat = new pc.StandardMaterial();
    mat.diffuse = new pc.Color(0.0, 0.0, 0.0);
    mat.emissive = new pc.Color(1.0, 1.0, 1.0); 
    
    mat.opacityMap = this.lockOnRingTex;
    mat.opacityMapChannel = 'a'; 
    mat.emissiveMap = this.lockOnRingTex;
    mat.emissiveMapChannel = 'a';
    
    mat.emissiveIntensity = 3.0; 
    mat.blendType = pc.BLEND_NORMAL; 
    mat.depthWrite = false;
    mat.useLighting = false;
    mat.update();
    
    this.lockOnRing.render.meshInstances[0].material = mat;
    this.app.root.addChild(this.lockOnRing);
    this.lockOnRing.enabled = false;

    if (!this.aimAssistArrow) {
        this.aimAssistArrow = new pc.Entity('AimAssistArrow');
        this.aimAssistArrow.addComponent('render', { type: 'plane', castShadows: false, receiveShadows: false });

        var arrowCanvas = document.createElement('canvas');
        arrowCanvas.width = 128;
        arrowCanvas.height = 128;
        var actx = arrowCanvas.getContext('2d');
        actx.clearRect(0, 0, 128, 128);
        // Tip toward top of texture (= local +Z after yaw)
        actx.beginPath();
        actx.moveTo(64, 12);
        actx.lineTo(108, 108);
        actx.lineTo(20, 108);
        actx.closePath();
        actx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        actx.fill();
        actx.beginPath();
        actx.moveTo(64, 22);
        actx.lineTo(98, 100);
        actx.lineTo(30, 100);
        actx.closePath();
        actx.fillStyle = '#FFCC00';
        actx.fill();
        actx.strokeStyle = '#FFFF66';
        actx.lineWidth = 4;
        actx.stroke();

        if (this.aimAssistArrowTex) this.aimAssistArrowTex.destroy();
        this.aimAssistArrowTex = new pc.Texture(this.app.graphicsDevice, { format: pc.PIXELFORMAT_R8_G8_B8_A8, autoMipmap: false });
        this.aimAssistArrowTex.setSource(arrowCanvas);

        var arrowMat = new pc.StandardMaterial();
        arrowMat.diffuse = new pc.Color(0, 0, 0);
        arrowMat.emissive = new pc.Color(1, 1, 1);
        arrowMat.opacityMap = this.aimAssistArrowTex;
        arrowMat.opacityMapChannel = 'a';
        arrowMat.emissiveMap = this.aimAssistArrowTex;
        arrowMat.emissiveMapChannel = 'a';
        arrowMat.emissiveIntensity = 2.8;
        arrowMat.blendType = pc.BLEND_NORMAL;
        arrowMat.depthWrite = false;
        arrowMat.useLighting = false;
        arrowMat.update();
        this.aimAssistArrow.render.meshInstances[0].material = arrowMat;
        this.app.root.addChild(this.aimAssistArrow);
        this.aimAssistArrow.enabled = false;
    }
};

PlayerController.prototype._getBotCtrl = function() {
    if (!this._botCtrlCache) {
        var node = this.app.root.findByName('BotManager');
        if (node && node.script) this._botCtrlCache = node.script.botController;
    }
    return this._botCtrlCache;
};

PlayerController.prototype._onFullStateSync = function(data) {
    if (!this.app.socketId || !data || !data.players) return;
    var myData = data.players[this.app.socketId];
    if (myData) {
        this.health = myData.hp;
        this.lastDamageTime = Date.now(); 
        this._updatePlayerHealthBar();
        if (this.health <= 0 && !this.isDead) this._die();
        else if (this.health > 0 && this.isDead) this._respawn();
    }
};

PlayerController.prototype._findAnimEntity = function(node) {
    if (!node) return null;
    if (node.anim) return node;
    for (var i = 0; i < node.children.length; i++) {
        var res = this._findAnimEntity(node.children[i]);
        if (res) return res;
    }
    return null;
};

PlayerController.prototype._setupIntroCamera = function() {
    if (this.app.cameraFollow && this.app.cameraFollow.snapIntroCamera) {
        this.app.cameraFollow.snapIntroCamera();
    }
};

// 🌟 config 深複製:巢狀的 comboOverrides / super / dotConfig 都複製一份
// baseConfig 保持唯讀原始表,this.config 是可安全修改的本局副本(modifier 系統地基)
PlayerController.prototype._deepCloneConfig = function (src) {
    if (!src) return src;
    var out = Object.assign({}, src);
    if (Array.isArray(src.comboOverrides)) {
        out.comboOverrides = [];
        for (var i = 0; i < src.comboOverrides.length; i++) {
            var step = Object.assign({}, src.comboOverrides[i]);
            if (step.dotConfig) step.dotConfig = Object.assign({}, step.dotConfig);
            out.comboOverrides.push(step);
        }
    }
    if (src.super) {
        out.super = Object.assign({}, src.super);
        if (src.super.dotConfig) out.super.dotConfig = Object.assign({}, src.super.dotConfig);
        if (Array.isArray(src.super.transformCycle)) {
            out.super.transformCycle = src.super.transformCycle.slice();
        }
    }
    if (src.dotConfig) out.dotConfig = Object.assign({}, src.dotConfig);
    return out;
};

// 🎲 ROGUE 玩家強化:改本局 config 副本(baseConfig 不動)。傷害/移速現讀即生效,血量需重算
PlayerController.prototype._mergeRogueBuffMults = function (mults) {
    if (!mults) return;
    if (!this._rogueBuffMults) this._rogueBuffMults = {};
    var keys = ['dmgMul', 'hpMul', 'speedMul', 'reloadMul'];
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (mults[key] && mults[key] !== 1) {
            this._rogueBuffMults[key] = (this._rogueBuffMults[key] || 1) * mults[key];
        }
    }
};

PlayerController.prototype._applyBuffMultsToPlayerConfig = function (mults) {
    if (!this.config || !mults) return;
    if (mults.dmgMul && mults.dmgMul !== 1) {
        this._scalePlayerDamage(this.config, mults.dmgMul);
        if (this.config.comboOverrides) {
            for (var c = 0; c < this.config.comboOverrides.length; c++) {
                this._scalePlayerDamage(this.config.comboOverrides[c], mults.dmgMul);
            }
        }
        if (this.config.super) this._scalePlayerDamage(this.config.super, mults.dmgMul);
        this._currentAttackConfig = this.config;
    }
    if (mults.reloadMul && mults.reloadMul !== 1) {
        var rt = (this.config.reloadTime !== undefined) ? this.config.reloadTime : 1.5;
        this.config.reloadTime = rt / mults.reloadMul;
    }
    if (mults.dashRechargeMul && mults.dashRechargeMul !== 1) {
        var drt = (this.config.dashRechargeTime !== undefined) ? this.config.dashRechargeTime : 2.4;
        this.config.dashRechargeTime = drt / mults.dashRechargeMul;
    }
    if (mults.speedMul && this.config.speed) this.config.speed *= mults.speedMul;
    if (mults.hpMul && mults.hpMul !== 1) {
        var oldMax = this.maxHealth;
        this.config.health = Math.round(this.config.health * mults.hpMul);
        this.maxHealth = this.config.health;
        this.health = Math.min(this.health + (this.maxHealth - oldMax), this.maxHealth);
        if (this._usesSharedTransformHealth()) this._sharedMaxHealth = this.maxHealth;
        var fum = this.app.floatingUIManager;
        if (fum && this.player) {
            if (typeof fum.updateMaxHealth === 'function') fum.updateMaxHealth(this.player, this.maxHealth);
            fum.updateHealth(this.player, this.health);
        }
        if (this._updatePlayerHealthBar) this._updatePlayerHealthBar();
    }
    if (this.shieldMaxPct > 0 && window.CombatResolver && window.CombatResolver.syncShieldMaxFromPct) {
        window.CombatResolver.syncShieldMaxFromPct(this, this.shieldMaxPct, false);
        if (this.player && this.app.floatingUIManager && this.app.floatingUIManager.updateShield) {
            this.app.floatingUIManager.updateShield(this.player, this.shieldHP || 0, this.shieldMax || 0);
        }
    }
};

PlayerController.prototype._reapplyAllRogueBuffs = function () {
    if (!this._rogueBuffMults || !this.config) return;
    this._applyBuffMultsToPlayerConfig(this._rogueBuffMults);
};

PlayerController.prototype.applyRogueBuff = function (mults) {
    if (!this.config || !mults) return;
    this._mergeRogueBuffMults(mults);
    this._applyBuffMultsToPlayerConfig(mults);
};

// 🃏 詞卡系統：非乘算類 buff（減傷 / DOT / 控場）直接設絕對值
PlayerController.prototype.applyRogueExtraBuffs = function (mults) {
    if (!mults) return;
    if (!this._rogueBuffMults) this._rogueBuffMults = {};
    if (mults.damageTakenMul !== undefined) this._rogueBuffMults.damageTakenMul = mults.damageTakenMul;
    if (mults.dotMul !== undefined) this._rogueBuffMults.dotMul = mults.dotMul;
    if (mults.ccDurationMul !== undefined) this._rogueBuffMults.ccDurationMul = mults.ccDurationMul;
    if (mults.dodgeChance !== undefined && window.CombatResolver && window.CombatResolver.applyDefenseStats) {
        window.CombatResolver.applyDefenseStats(this, mults);
    }
};

PlayerController.prototype.applyAbsoluteWordBuffs = function (stats) {
    if (!this.baseConfig || !stats) return;
    this.config = this._deepCloneConfig(this.baseConfig);
    this.maxHealth = this.config.health;
    this.health = Math.min(this.health, this.maxHealth);
    this._rogueBuffMults = {
        dmgMul: stats.dmgMul || 1,
        hpMul: stats.hpMul || 1,
        speedMul: stats.speedMul || 1,
        reloadMul: stats.reloadMul || 1,
        dashRechargeMul: stats.dashRechargeMul || 1,
        damageTakenMul: stats.damageTakenMul || 1,
        dotMul: stats.dotMul || 1,
        ccDurationMul: stats.ccDurationMul || 1
    };
    this._applyBuffMultsToPlayerConfig(this._rogueBuffMults);
    this.applyRogueExtraBuffs(stats);

    // 速射 Lv3：彈匣／回避上限
    var baseAmmo = (this.baseConfig && this.baseConfig.ammo) ? this.baseConfig.ammo : (this.config.ammo || 3);
    var ammoBonus = stats.ammoBonus || 0;
    this.maxAmmo = baseAmmo + ammoBonus;
    this.config.ammo = this.maxAmmo;
    if (this.ammo > this.maxAmmo) this.ammo = this.maxAmmo;
    if (typeof this._updateAmmoUI === 'function') this._updateAmmoUI();

    var baseDash = 2;
    if (this._baseMaxDashCharges) baseDash = this._baseMaxDashCharges;
    else this._baseMaxDashCharges = this.maxDashCharges || 2;
    this.maxDashCharges = baseDash + (stats.dashChargesBonus || 0);
    if (this.currentDashCharges > this.maxDashCharges) this.currentDashCharges = this.maxDashCharges;
    if (typeof this._updateDodgeUI === 'function') this._updateDodgeUI();

    this.shieldMaxPct = stats.shieldMaxPct || 0;
    if (window.CombatResolver && window.CombatResolver.applyDefenseStats) {
        window.CombatResolver.applyDefenseStats(this, stats);
    }
    if (this.shieldMaxPct > 0 && window.CombatResolver && window.CombatResolver.syncShieldMaxFromPct) {
        var fill = !!stats._fillShield;
        window.CombatResolver.syncShieldMaxFromPct(this, this.shieldMaxPct, fill);
        if (this.player && this.app.floatingUIManager && this.app.floatingUIManager.updateShield) {
            this.app.floatingUIManager.updateShield(this.player, this.shieldHP || 0, this.shieldMax || 0);
        }
    }
};

PlayerController.prototype._scalePlayerDamage = function (obj, mul) {
    if (!obj) return;
    var fields = ['bulletDamage', 'explodeDamage', 'lobAreaDamage', 'damagePerTick', 'damage'];
    for (var i = 0; i < fields.length; i++) {
        if (typeof obj[fields[i]] === 'number') obj[fields[i]] = Math.round(obj[fields[i]] * mul);
    }
    if (obj.dotConfig) this._scalePlayerDamage(obj.dotConfig, mul);   // 🌟 DOT 傷害巢狀在 dotConfig 內,遞迴處理
};

PlayerController.prototype._onSelectBrawler = function (type) {
    this.brawlerType = type; 
    if (this.app && this.app.wordSystem && typeof this.app.wordSystem.autoEquipSignatureForMatch === 'function') {
        this.app.wordSystem.autoEquipSignatureForMatch(type);
    }
    var srcConfig = window.BrawlerConfig[type] || window.BrawlerConfig.guanyu;
    // 🌟 baseConfig = 原始表(唯讀,不可改);config = 本局可改副本(承載 ROGUE 強化/未來 PvP 道具)
    this.baseConfig = srcConfig;
    this.config = this._deepCloneConfig(srcConfig);
    this.maxHealth = this.config.health;
    this.health = this.config.health;
    this.maxAmmo = this.config.ammo; 
    this.ammo = this.config.ammo;
    this.reloadTimer = 0; 
    this.timeSinceLastAttack = 0;
    this.isReloading = false;
    this.kills = 0; 
    this.deaths = 0;
    this.damageDealt = 0; 
    this.maxSuperCharge = this.config.superChargeNeeded || 1500; 
    this.superCharge = 0;
    this._currentAttackConfig = this.config; 
    
    this._isTransformed = false;
    this._transformCycleIndex = -1;
    this._sharedMaxHealth = 0;
    this._rogueBuffMults = null;
    this._combatStats = null;
    this.shieldHP = 0;
    this.shieldMax = 0;
    this.shieldMaxPct = 0;
    this._wordKillDmgStacks = 0;
    this._auraDamageTakenMul = 1;
    this._originalConfig = null;
    this._originalBrawlerType = '';
    this.gemCount = 0; 
    this._spawnPlayer(); 
    this._updateAmmoUI(); 
};

/** 教學結束接正式 Rogue：清 buff、回滿狀態、傳回出生點 */
PlayerController.prototype.resetForOfficialRogue = function () {
    if (this._isTransformed && this._originalBrawlerType) {
        try { this._revertTransform(); } catch (e) {}
    }
    var type = this.brawlerType || 'guanyu';
    var srcConfig = window.BrawlerConfig[type] || window.BrawlerConfig.guanyu;
    this.baseConfig = srcConfig;
    this.config = this._deepCloneConfig(srcConfig);
    this.maxHealth = this.config.health;
    this.health = this.config.health;
    this.maxAmmo = this.config.ammo;
    this.ammo = this.config.ammo;
    this.reloadTimer = 0;
    this.timeSinceLastAttack = 0;
    this.isReloading = false;
    this.maxSuperCharge = this.config.superChargeNeeded || 1500;
    this.superCharge = 0;
    this._currentAttackConfig = this.config;
    this.comboIndex = 0;
    this._attackQueue = [];
    this.activeStates = {};
    this.stunTimer = 0;
    this._invincible = false;
    this.invincibleTimer = 0;
    this._isTransformed = false;
    this._transformCycleIndex = -1;
    this._sharedMaxHealth = 0;
    this._rogueBuffMults = null;
    this._combatStats = null;
    this.shieldHP = 0;
    this.shieldMax = 0;
    this.shieldMaxPct = 0;
    this._wordKillDmgStacks = 0;
    this._auraDamageTakenMul = 1;
    this._originalConfig = null;
    this._originalBrawlerType = '';
    this.isDead = false;

    // 再玩一次：清死亡／戰鬥凍結（否則 anim.speed=0 會鎖死動作）
    this._deathVanishTimer = 0;
    this.hitStopTimer = 0;
    this._rushState = 'none';
    this._rushTimer = 0;
    this._rushAfterimageConf = null;
    this._rushAfterimageTimer = 0;
    this._dashTimer = 0;
    this.isDashing = false;
    this._attackAnimTimer = 0;
    if (this._setAnimMirror) this._setAnimMirror(false);
    this._autoStepTimer = 0;
    this._kbTimer = 0;
    this._isTransforming = false;
    if (this._flinchTimer !== undefined) this._flinchTimer = 0;

    var slot = (this.app.mySlot !== undefined) ? this.app.mySlot : 1;
    var spawn = { x: 0, z: 0 };
    if (this.app.gameModeManager && this.app.gameModeManager.getSafeSpawnPoint) {
        spawn = this.app.gameModeManager.getSafeSpawnPoint(this.app.myTeam || 'blue', slot);
    }
    if (this.player) {
        this.player.setPosition(spawn.x, 0, spawn.z);
        this.player.enabled = true;
        this.player.setEulerAngles(0, 0, 0);
        if (this.app.combatManager && this.app.combatManager.clearDeathVisual) {
            this.app.combatManager.clearDeathVisual(this.player);
        }
        if (this.app.combatManager && this.app.combatManager.setEntityOpacity) {
            this.app.combatManager.setEntityOpacity(this.player, 1.0);
        }
    }
    if (this.app.cameraFollow && this.app.cameraFollow.snapToPlayer && this.player) {
        this.app.cameraFollow.snapToPlayer(this.player);
    }
    this._resetAnimationState();
    this._updateAmmoUI();
    this._updatePlayerHealthBar();
    this._updateMaterialVisibility();
    if (this.app.inputManager && this.app.inputManager.setSuperReady) {
        this.app.inputManager.setSuperReady(false);
    }
    if (this.app.wordSystem && this.app.wordSystem.syncArmyCombatStats && this.app.rogueDirector) {
        this.app.wordSystem.syncArmyCombatStats(this.app.rogueDirector, true);
    }
};

PlayerController.prototype._setupAliveState = function(overrideX, overrideZ, opts) {
    opts = opts || {};
    var slot = (this.app.mySlot !== undefined) ? this.app.mySlot : 1;
    var spawn = { x: 0, z: 0 };
    if (this.app.gameModeManager) spawn = this.app.gameModeManager.getSafeSpawnPoint(this.app.myTeam, slot);
    
    var finalX = (overrideX !== undefined) ? overrideX : spawn.x;
    var finalZ = (overrideZ !== undefined) ? overrideZ : spawn.z;
    
    this.player.setPosition(finalX, 0, finalZ); 
    this.player.enabled = true;

    var gm = this.app.gameModeManager;
    if (gm && !opts.isTransform) {
        var cx = gm.mapCenterX || 0;
        var cz = gm.mapCenterZ || 0;
        var faceDx = cx - finalX;
        var faceDz = cz - finalZ;
        if ((faceDx * faceDx + faceDz * faceDz) > 0.25) {
            this._facingAngle = Math.atan2(faceDx, faceDz) * (180 / Math.PI);
            this._currentBodyAngle = this._facingAngle;
            this.player.setEulerAngles(0, this._facingAngle, 0);
        }
    }
    
    // 鏡頭交由 cameraFollow（依當前 VIEW ANGLE 模式）；僅在沒有 follow 腳本時用舊的固定偏移
    if (!opts.isTransform && !this.app.cameraFollow && this.mainCam) {
        this.mainCam.setPosition(finalX + this.targetCamOffset.x, this.targetCamOffset.y, finalZ + this.targetCamOffset.z);
    }
    
    this._updatePlayerHealthBar(); 
    this._updateAmmoUI();
    if (this.deathMessage) this.deathMessage.enabled = false;
    
    if (this.app.floatingUIManager && this.app.floatingUIManager.updateGems) {
        this.app.floatingUIManager.updateGems(this.player, this.gemCount);
    }
    
    this.lastDamageTime = Date.now() + 3000; 
    this._invincible = true; 
    this.invincibleTimer = this.invincibleTime;
    
    if (this.app.inputManager && this.app.inputManager.attackCommand) { 
        this.app.inputManager.attackCommand = null; 
    }
    
    this.lastShootTime = Date.now() + 500; 
    this._updateMaterialVisibility(); 
    this._updateDodgeUI();

    this._resetAnimationState(); 
};

PlayerController.prototype._spawnPlayer = function (overrideX, overrideZ, opts) {
    opts = opts || {};
    if (this.player) {
        if (this.app.floatingUIManager) this.app.floatingUIManager.removeUI(this.player);
        this._destroyRings(); 
        this.player.destroy();
        this._bushRenders = null; 
    }

    var modelKey = this.config.modelKey || this.brawlerType;
    var skinKeyToUse = this.selectedSkinKey || '';
    var isTutorialRun = !!(this.app && (
        this.app._forceTutorialRun ||
        this.app._pendingTutorialRun ||
        (this.app.rogueDirector && this.app.rogueDirector.isTutorialRun)
    ));
    var forcedTemplate = null;
    if (isTutorialRun && this.tutorialPlayerTemplate) {
        forcedTemplate = this.tutorialPlayerTemplate;
    }
    var template = forcedTemplate || this.app.combatManager.getCharacterTemplate(modelKey, skinKeyToUse) || this.playerTemplate;
    this.player = template.clone(); 
    
    if (this.config.scale) this.player.setLocalScale(this.config.scale, this.config.scale, this.config.scale);
    
    template.parent.addChild(this.player);
    this.animEntity = this._findAnimEntity(this.player) || this.player;
    this._baseAnimScale.copy(this.animEntity.getLocalScale());
    this._animMirrorSign = 1;

    this._weaponProp = this.player.findByName('WeaponProp');
    if (this._weaponProp) this._weaponProp.enabled = false;

    var hpFill = this.player.findByName('HealthFill');
    if (hpFill) hpFill.enabled = false;
    var hpBg = this.player.findByName('HealthBackground');
    if (hpBg) hpBg.enabled = false;

    if (this.app.floatingUIManager) {
        var pName = this.app.playerName || 'Player';
        this.app.floatingUIManager.registerUI(this.player, pName, this.maxHealth, 'me');
        this.app.floatingUIManager.updateHealth(this.player, this.health);
        if (this.shieldMax > 0 && this.app.floatingUIManager.updateShield) {
            this.app.floatingUIManager.updateShield(this.player, this.shieldHP || 0, this.shieldMax || 0);
        } else if (this.app.wordSystem && this.app.wordSystem.syncArmyCombatStats && this.app.rogueDirector) {
            this.app.wordSystem.syncArmyCombatStats(this.app.rogueDirector, true);
        }
    }

    this._createLockOnRing();
    this._createTeamRing(); 
    this._createSuperRing();
    
    this.hitStopTimer = 0; 
    
    this._setupAliveState(overrideX, overrideZ, opts);

    this.app._localPlayerEntity = this.player;
    this.app.fire('singleplayer:playerCreated', this.player, { isTransform: !!opts.isTransform });

    if (this.app.gameState !== 'playing') this.app.fire('game:introStart'); 
};

PlayerController.prototype.applyDebuff = function(dotConfig, attackerId) {
    if (!dotConfig || this.isDead || this._invincible) return;

    var type = dotConfig.type || 'bleed';
    
    this.activeStates[type] = {
        duration: dotConfig.duration || 3.0,
        tickRate: dotConfig.tickRate || 0.5,
        damagePerTick: dotConfig.damagePerTick || 50,
        tickTimer: 0,
        attackerId: attackerId || 'unknown',
        _fireSustainDmgMul: dotConfig._fireSustainDmgMul || 1
    };

    if (window.CombatResolver && window.CombatResolver.onDotApplied) {
        window.CombatResolver.onDotApplied(this.app, this, type);
    }

    this._broadcastState();   // 🌟 狀態變化即時廣播給其他玩家
};

// 🌟 統一狀態廣播：打包當前 activeStates + stun，發給其他玩家（enemy 端用相同結構重現）
PlayerController.prototype._broadcastState = function() {
    if (!this.app.networkManager || !this.app.networkManager.socket || !this.app.networkManager.socket.connected) return;

    // 只送顯示需要的最小資料（type + 剩餘時間），不送傷害數值（傷害由 server 權威）
    var states = {};
    if (this.activeStates) {
        for (var k in this.activeStates) {
            if (this.activeStates[k]) states[k] = { duration: this.activeStates[k].duration };
        }
    }
    this.app.fire('network:playerState', {
        states: states,
        stunTimer: this.stunTimer || 0,
        initialStun: this._initialStunDuration || 0
    });
};

PlayerController.prototype._easeSlideT = function(t, power) {
    t = Math.max(0, Math.min(1, t));
    power = power || 3;
    return 1 - Math.pow(1 - t, power);
};

PlayerController.prototype._calcSlideDuration = function(dist, speed, maxDuration) {
    if (!speed || speed <= 0 || dist < 0.001) return 0;
    var duration = Math.max(0.06, dist / speed);
    if (maxDuration !== undefined && maxDuration > 0) duration = Math.min(duration, maxDuration);
    return duration;
};

PlayerController.prototype._beginConstantSlide = function(startX, startZ, targetX, targetZ, slideOpts, out) {
    var speed = slideOpts.speed;
    var maxDuration = slideOpts.maxDuration;
    var easePower = slideOpts.easePower !== undefined ? slideOpts.easePower : 3;
    var dx = targetX - startX;
    var dz = targetZ - startZ;
    var dist = Math.sqrt(dx * dx + dz * dz);
    var duration = this._calcSlideDuration(dist, speed, maxDuration);
    if (duration <= 0) return 0;
    out.startX = startX;
    out.startZ = startZ;
    out.targetX = targetX;
    out.targetZ = targetZ;
    out.duration = duration;
    out.easePower = easePower;
    return duration;
};

PlayerController.prototype._startWhiffStep = function(startX, startZ, targetX, targetZ, atkConf) {
    var slide = {};
    var duration = this._beginConstantSlide(startX, startZ, targetX, targetZ, {
        speed: atkConf.whiffStepSpeed !== undefined ? atkConf.whiffStepSpeed
            : (this.config.whiffStepSpeed !== undefined ? this.config.whiffStepSpeed : 12),
        maxDuration: atkConf.whiffStepMaxDuration !== undefined ? atkConf.whiffStepMaxDuration
            : (this.config.whiffStepMaxDuration !== undefined ? this.config.whiffStepMaxDuration : 0.16),
        easePower: atkConf.whiffStepEasePower !== undefined ? atkConf.whiffStepEasePower
            : (this.config.whiffStepEasePower !== undefined ? this.config.whiffStepEasePower : 2.5)
    }, slide);
    if (duration <= 0) return;
    this._autoStepStartX = slide.startX;
    this._autoStepStartZ = slide.startZ;
    this._autoStepTargetX = slide.targetX;
    this._autoStepTargetZ = slide.targetZ;
    this._autoStepTotalDuration = duration;
    this._autoStepEasePower = slide.easePower;
    this._autoStepTimer = duration;
};

PlayerController.prototype._onFlickDodge = function (angle) {
    var im = this.app.inputManager;
    if (im && im._isCombatInputBlocked && im._isCombatInputBlocked()) return;
    if (this.app.gameState === 'intro' || this.app.gameState === 'promo') return;
    if (this.stunTimer > 0 || this._dashCommandedThisFrame || this.isDead || (this._isTransformed && !this._allowsTransformSuper()) || this.currentDashCharges <= 0 || this.isDashing) {
        return; 
    }

    this._dashCommandedThisFrame = true;
    this.currentDashCharges--;
    this._attackAnimTimer = 0; 
    this._setAnimMirror(false);
    
    this._attackQueue = []; 
    this.player.fire('trail:interrupt');
    if (this._weaponProp) this._weaponProp.enabled = false; 
    
    this._updateDodgeUI();
    
    this.comboIndex = 0; 
    this._lockedTargetId = null;
    this._lockedTargetEntity = null;

    var dashDist = this.config.dashDist || 3.5;
    var pPos = this.player.getPosition();
    var limitX = this.app.gameModeManager ? this.app.gameModeManager.mapLimitX : 11.5;
    var limitZ = this.app.gameModeManager ? this.app.gameModeManager.mapLimitZ : 10.0;
    
    var step = 0.5;
    var safeX = pPos.x;
    var safeZ = pPos.z;
    var currentDist = 0;

    while (currentDist < dashDist) {
        currentDist += step;
        if (currentDist > dashDist) currentDist = dashDist;

        var nextX = pPos.x + Math.sin(angle) * currentDist;
        var nextZ = pPos.z + Math.cos(angle) * currentDist;

        if (nextX > limitX || nextX < -limitX || nextZ > limitZ || nextZ < -limitZ) break;
        if (this.app.combatManager && this.app.combatManager.checkCollision(nextX, nextZ)) break;
        safeX = nextX;
        safeZ = nextZ;
    }

    this._dashTargetX = safeX;
    this._dashTargetZ = safeZ;
    var dashSlide = {};
    var dashDuration = this._beginConstantSlide(pPos.x, pPos.z, safeX, safeZ, {
        speed: this.config.dashSpeed !== undefined ? this.config.dashSpeed : 14,
        maxDuration: this.config.dashMaxDuration !== undefined ? this.config.dashMaxDuration : 0.30,
        easePower: this.config.dashEasePower !== undefined ? this.config.dashEasePower : 2.5
    }, dashSlide);
    this._dashStartX = dashSlide.startX;
    this._dashStartZ = dashSlide.startZ;
    this._dashTotalDuration = dashDuration;
    this._dashEasePower = dashSlide.easePower;
    this._dashTimer = dashDuration;
    this.isDashing = dashDuration > 0;

    // 蓄勢：迴避取消（精煉 Lv2+ 可保留）
    var poiseCfg = this._combatStats && this._combatStats.poiseCharge;
    if (!poiseCfg || poiseCfg.dodgeClears !== false) {
        this._poiseChargeSec = 0;
        if (window.CombatResolver && window.CombatResolver.clearNextHitMod) {
            window.CombatResolver.clearNextHitMod(this, 'poiseCharge');
        }
    }

    // 白貓風：位移結束後仍短暫無敵（i-frame 含寬限期，預設 0.35s）
    this._invincible = true;
    var dashInvuln = this.config.dashInvuln !== undefined ? this.config.dashInvuln : 0.35;
    this.invincibleTimer = dashInvuln;
    this._updateMaterialVisibility();

    // Perfect Dodge：ROGUE 讀紅光窗口；PVP(FFA/Bounty/Knockout) 讀隱性 _pvpThreatTimer
    var perfect = this._tryPerfectDodge();
    if (perfect) {
        this.app.fire('tutorial:perfectDodge');
    }
    this.app.fire('tutorial:dash');

    // 風返：翻滾後下一擊加傷；Perfect 另回 1 dash
    this._applyWindReturnOnDash(perfect);

    if (this.animEntity && this.animEntity.anim) {
        var dashAnim = this.config.dashAnimTrigger !== undefined ? this.config.dashAnimTrigger : 'roll';
        if (dashAnim !== 'none') {
            this.animEntity.anim.setTrigger(dashAnim);
        }
    }

    // 🌟 廣播 roll 給其他玩家（讓對方畫面看到翻滾動作）
    this.app.fire('network:roll', {
        a: Number(angle.toFixed(2)),
        tx: Number(this._dashTargetX.toFixed(2)),
        tz: Number(this._dashTargetZ.toFixed(2))
    });
};

PlayerController.prototype._ensurePerfectDodgeUi = function() {
    // Fallback-only (if FloatingDamageManager isn't present).
    if (document.getElementById('perfect-dodge-style')) return;
    var st = document.createElement('style');
    st.id = 'perfect-dodge-style';
    st.innerHTML =
        '#perfect-dodge{position:fixed;left:50%;top:32%;transform:translate(-50%,-50%);z-index:9000;' +
        'font-family:"Anton","Impact",sans-serif;font-size:54px;letter-spacing:6px;' +
        'color:#f5d27a;text-shadow:3px 3px 0 #000,0 0 16px rgba(245,210,122,0.35);' +
        'pointer-events:none;opacity:0;transition:opacity 0.08s ease;}' +
        '#perfect-dodge.show{opacity:1;}';
    document.head.appendChild(st);
};

PlayerController.prototype._showPerfectDodgeUi = function() {
    var rd = this.app.rogueDirector;
    if (rd && rd.active && typeof rd._notePerfectDodge === 'function') {
        rd._notePerfectDodge();
    }
    // Prefer FloatingDamageManager-style pop text.
    if (this.app && typeof this.app.fire === 'function' && this.player && window.pc) {
        var pos = this.player.getPosition();
        var worldPos = new pc.Vec3(pos.x, pos.y + 0.8, pos.z);
        // customColor: gold-ish
        var col = new pc.Color(0.96, 0.82, 0.48, 1);
        // scaleMultiplier tuned smaller for readability
        this.app.fire('ui:floatingDamage', worldPos, 'PERFECT', true, col, 0.70);
        return;
    }

    // Fallback: fixed HUD stamp (should rarely be used).
    this._ensurePerfectDodgeUi();
    var el = document.getElementById('perfect-dodge');
    if (!el) {
        el = document.createElement('div');
        el.id = 'perfect-dodge';
        el.textContent = 'PERFECT';
        document.body.appendChild(el);
    }
    el.classList.remove('show');
    el.offsetHeight;
    el.classList.add('show');
    setTimeout(function() { if (el) el.classList.remove('show'); }, 220);
};

PlayerController.prototype._getCombatMode = function () {
    if (!this.app) return '';
    return String(
        (this.app.gameModeManager && this.app.gameModeManager.currentMode) ||
        this.app.gameMode || ''
    ).trim().toUpperCase();
};

PlayerController.prototype._isPvpCombatMode = function (mode) {
    mode = mode || this._getCombatMode();
    return mode === 'FFA' || mode === '3V3_BOUNTY' || mode === '3V3_KNOCKOUT';
};

PlayerController.prototype._isThreatToPlayer = function (team, entityId) {
    var mode = this._getCombatMode();
    if (mode === 'ROGUE') return team === 'red';
    if (!this._isPvpCombatMode(mode)) return false;
    if (entityId === 'player' || (this.app.socketId && entityId === this.app.socketId)) return false;
    if (mode === 'FFA') return true;
    var myTeam = this.app.myTeam || 'none';
    if (myTeam === 'none') return true;
    return team !== myTeam;
};

PlayerController.prototype._tryPerfectDodge = function() {
    if (!this.app || !this.player) return false;
    var mode = this._getCombatMode();
    var isRogue = mode === 'ROGUE';
    var isPvp = this._isPvpCombatMode(mode);
    if (!isRogue && !isPvp) return false;

    var pPos = this.player.getPosition();
    var bestDistSq = Infinity;
    var found = false;

    var gmm = this.app.gameModeManager;
    var bCtrl = this.app.botController || (gmm && gmm._getBotCtrl ? gmm._getBotCtrl() : null);
    if (bCtrl && bCtrl.bots) {
        for (var i = 0; i < bCtrl.bots.length; i++) {
            var b = bCtrl.bots[i];
            if (!b || b.state !== 'alive' || !b.entity || !b.entity.enabled) continue;
            if (!this._isThreatToPlayer(b.team, b.id)) continue;
            var threatOk = isRogue ? (b._preAttackGlowTimer > 0) : (b._pvpThreatTimer > 0);
            if (!threatOk) continue;
            var bp = b.entity.getPosition();
            var dx = bp.x - pPos.x;
            var dz = bp.z - pPos.z;
            var dsq = dx * dx + dz * dz;
            if (dsq < bestDistSq) { bestDistSq = dsq; found = true; }
        }
    }

    if (isPvp && this.app.enemyManager && this.app.enemyManager.enemies) {
        var enemies = this.app.enemyManager.enemies;
        for (var eid in enemies) {
            var e = enemies[eid];
            if (!e || e.hp <= 0 || e.s === 3 || !e.entity || !e.entity.enabled) continue;
            if (!this._isThreatToPlayer(e.team, eid)) continue;
            if (!(e._pvpThreatTimer > 0)) continue;
            var ep = e.entity.getPosition();
            var edx = ep.x - pPos.x;
            var edz = ep.z - pPos.z;
            var edsq = edx * edx + edz * edz;
            if (edsq < bestDistSq) { bestDistSq = edsq; found = true; }
        }
    }

    var range = 6.0;
    if (!found || bestDistSq > range * range) return false;

    var extra = 0.20;
    this._invincible = true;
    this.invincibleTimer = Math.max(this.invincibleTimer || 0, 0.35 + extra);
    this._armPerfectCounter(0.5, 3.0);
    this._showPerfectDodgeUi();
    return true;
};

PlayerController.prototype._applyWindReturnOnDash = function(perfect) {
    var stats = this._combatStats;
    if (!stats || !stats.windReturn) return;
    var wr = stats.windReturn;
    if (window.CombatResolver && window.CombatResolver.grantNextHitMod) {
        window.CombatResolver.grantNextHitMod(this, wr.nextHitDmgBonus || 0.25, { source: 'windReturn' });
    }
    if (perfect && (wr.perfectDashRestore || 0) > 0) {
        var restore = wr.perfectDashRestore || 1;
        this.currentDashCharges = Math.min(this.maxDashCharges, this.currentDashCharges + restore);
        if (typeof this._updateDodgeUI === 'function') this._updateDodgeUI();
    }
};

// Perfect 反擊 buff：寫在 app 層，避免 playerController 引用不同步
PlayerController.prototype._armPerfectCounter = function (stunSec, windowSec) {
    var stun = (stunSec !== undefined && stunSec > 0) ? stunSec : 0.5;
    var win = (windowSec !== undefined && windowSec > 0) ? windowSec : 3.0;
    this._perfectCounterStun = stun;
    this._perfectCounterExpire = win;
    if (!this.app) return;
    this.app._perfectCounterActive = true;
    this.app._perfectCounterStun = stun;
    this.app._perfectCounterUntilMs = Date.now() + (win * 1000);
};

PlayerController.prototype._consumePerfectCounter = function (hitMeta) {
    hitMeta = hitMeta || {};
    if (hitMeta.isDotTick || hitMeta._perfectCounterApplied) return hitMeta;

    var app = this.app;
    var stunAmt = 0;

    if (app && app._perfectCounterActive) {
        var until = app._perfectCounterUntilMs || 0;
        if (!until || Date.now() <= until) {
            stunAmt = Number(app._perfectCounterStun) || Number(this._perfectCounterStun) || 0.5;
        }
    } else if (this._perfectCounterStun > 0 && this._perfectCounterExpire > 0) {
        stunAmt = this._perfectCounterStun;
    }

    if (!(stunAmt > 0)) return hitMeta;

    hitMeta.stunDuration = Math.max(Number(hitMeta.stunDuration) || 0, stunAmt);
    hitMeta._perfectCounterApplied = true;

    this._perfectCounterStun = 0;
    this._perfectCounterExpire = 0;
    if (app) {
        app._perfectCounterActive = false;
        app._perfectCounterUntilMs = 0;
        app._perfectCounterStun = 0;
    }
    return hitMeta;
};

PlayerController.prototype.consumePerfectCounterStun = function (hitMeta) {
    return this._consumePerfectCounter(hitMeta);
};

PlayerController.prototype._getOriginSuperConf = function () {
    if (this._originalConfig && this._originalConfig.super) return this._originalConfig.super;
    return (this.config && this.config.super) ? this.config.super : {};
};

PlayerController.prototype._allowsTransformSuper = function () {
    var superConf = this._getOriginSuperConf();
    return superConf.type === 'super_transform' && superConf.transformCycle && superConf.transformCycle.length > 0;
};

PlayerController.prototype._getTransformSuperConf = function () {
    var origin = this._getOriginSuperConf();
    if (origin.type === 'super_transform') return origin;
    var cur = (this.config && this.config.super) ? this.config.super : {};
    if (cur.type === 'super_transform') return cur;
    return origin;
};

PlayerController.prototype._usesSharedTransformHealth = function () {
    return !!this._getOriginSuperConf().shareHealth;
};

PlayerController.prototype._resolveTransformTarget = function (superConf) {
    if (!superConf) return null;
    if (superConf.transformCycle && superConf.transformCycle.length > 0) {
        this._transformCycleIndex = (this._transformCycleIndex + 1) % superConf.transformCycle.length;
        return superConf.transformCycle[this._transformCycleIndex];
    }
    return superConf.transformTo || null;
};

PlayerController.prototype._transformToMecha = function (targetConfigKey) {
    if (!targetConfigKey) {
        console.warn('[PlayerController] 變身目標為空');
        return;
    }
    if (!window.BrawlerConfig || !window.BrawlerConfig[targetConfigKey]) {
        console.warn('[PlayerController] BrawlerConfig 缺少變身形態: ' + targetConfigKey);
        return;
    }
    var canCycle = this._allowsTransformSuper();
    if (this._isTransformed && !canCycle) return;
    if (this.brawlerType === targetConfigKey) return;

    var currentPos = this.player.getPosition().clone();
    var currentRot = this.player.getEulerAngles().clone();
    var useSharedHealth = this._usesSharedTransformHealth();
    var healthRatio = this.maxHealth > 0 ? (this.health / this.maxHealth) : 1;

    if (!this._isTransformed) {
        this._originalConfig = this.config;
        this._originalBrawlerType = this.brawlerType;
        this._originalHealth = this.health;
        this._originalMaxHealth = this.maxHealth;
        this._originalAmmo = this.ammo;
        if (useSharedHealth) this._sharedMaxHealth = this.maxHealth;
    }
    
    this.brawlerType = targetConfigKey;
    this.baseConfig = window.BrawlerConfig[targetConfigKey];
    this.config = this._deepCloneConfig(window.BrawlerConfig[targetConfigKey]);
    this._reapplyAllRogueBuffs();
    if (useSharedHealth) {
        this.maxHealth = this._sharedMaxHealth || this._originalMaxHealth || this.maxHealth;
        this.health = Math.min(this.health, this.maxHealth);
    } else {
        this.maxHealth = this.config.health;
        this.health = Math.max(1, Math.round(this.maxHealth * healthRatio));
    }
    this.maxAmmo = this.config.ammo; 
    this.ammo = this.config.ammo;
    this._currentAttackConfig = this.config;
    this.comboIndex = 0;
    this._attackQueue = [];
    this._isTransformed = (targetConfigKey !== this._originalBrawlerType);
    if (this._originalConfig && this._originalConfig.superChargeNeeded) {
        this.maxSuperCharge = this._originalConfig.superChargeNeeded;
    }
    if (this.app.networkManager) {
        this.app.networkManager.brawlerType = this.brawlerType;
        this.app.networkManager.hero = this.brawlerType;
    }
    
    this._spawnPlayer(currentPos.x, currentPos.z, { isTransform: true });
    
    this._invincible = false;
    this.invincibleTimer = 0;
    this.player.setEulerAngles(currentRot.x, currentRot.y, currentRot.z);

    this._updatePlayerHealthBar();
    this._updateAmmoUI();
    this._updateMaterialVisibility();
    this.app.fire('network:shoot', { a: 0, d: 0, b: this.brawlerType, isSuper: true });
};

PlayerController.prototype._resolveBaseBrawlerType = function() {
    if (this._originalBrawlerType && window.BrawlerConfig && window.BrawlerConfig[this._originalBrawlerType]) {
        return this._originalBrawlerType;
    }
    var cur = this.brawlerType;
    if (!window.BrawlerConfig || !window.BrawlerConfig[cur]) return cur;
    var curCfg = window.BrawlerConfig[cur];
    if (!curCfg.isMecha) return cur;
    for (var id in window.BrawlerConfig) {
        var bc = window.BrawlerConfig[id];
        if (!bc || !bc.super) continue;
        if (bc.super.transformTo === cur) return id;
        var cycle = bc.super.transformCycle;
        if (cycle) {
            for (var i = 0; i < cycle.length; i++) {
                if (cycle[i] === cur) return id;
            }
        }
    }
    return cur;
};

PlayerController.prototype._isTransformVariantType = function(type) {
    var cfg = window.BrawlerConfig && window.BrawlerConfig[type];
    return !!(cfg && cfg.isMecha);
};

PlayerController.prototype._resetToBaseForm = function () {
    var baseType = this._resolveBaseBrawlerType();
    if (!window.BrawlerConfig || !window.BrawlerConfig[baseType]) return;

    this.brawlerType = baseType;
    this.baseConfig = window.BrawlerConfig[baseType];
    this.config = this._deepCloneConfig(window.BrawlerConfig[baseType]);
    this._reapplyAllRogueBuffs();
    this.maxAmmo = this.config.ammo;
    this.maxSuperCharge = this.config.superChargeNeeded || this.maxSuperCharge || 1500;

    if (this._sharedMaxHealth > 0) {
        this.maxHealth = this._sharedMaxHealth;
    } else {
        this.maxHealth = this.config.health;
    }

    this._currentAttackConfig = this.config;
    this._isTransformed = false;
    this._isTransforming = false;
    this._transformCycleIndex = -1;
    this._originalConfig = null;
    this._originalBrawlerType = '';
    this._sharedMaxHealth = 0;
    this._originalHealth = 0;
    this._originalMaxHealth = 0;
    this._originalAmmo = 0;

    if (this.app.networkManager) {
        this.app.networkManager.brawlerType = this.brawlerType;
        this.app.networkManager.hero = this.brawlerType;
    }
};

PlayerController.prototype._revertTransform = function () {
    if (!this._isTransformed && !this._originalBrawlerType) return;
    var currentPos = this.player.getPosition().clone();
    var currentRot = this.player.getEulerAngles().clone();
    // 張寶 cycle：shareHealth 延續當前血量；貂蟬等：還原變身前快照（不受 mecha autodrain 影響）
    var useSharedHealth = this._usesSharedTransformHealth();
    var restoreHealth, restoreMaxHealth, restoreAmmo;

    if (useSharedHealth) {
        restoreHealth = this.health;
        restoreMaxHealth = this._sharedMaxHealth || this.maxHealth;
        restoreAmmo = this.ammo;
    } else {
        restoreHealth = this._originalHealth;
        restoreMaxHealth = this._originalMaxHealth;
        restoreAmmo = this._originalAmmo;
    }

    this._resetToBaseForm();

    this.maxHealth = restoreMaxHealth > 0 ? restoreMaxHealth : this.config.health;
    if (useSharedHealth) {
        this.health = Math.max(0, Math.min(restoreHealth, this.maxHealth));
    } else {
        this.health = Math.max(1, Math.min(restoreHealth, this.maxHealth));
    }
    this.ammo = (restoreAmmo !== undefined && restoreAmmo !== null) ? restoreAmmo : this.config.ammo;
    
    if (!this.isDead) {
        this._spawnPlayer(currentPos.x, currentPos.z, { isTransform: true });
        this.player.setEulerAngles(currentRot.x, currentRot.y, currentRot.z);
        this._updatePlayerHealthBar();
        this._updateAmmoUI();
        
        this._invincible = true; 
        this.invincibleTimer = 1.5;
        this._updateMaterialVisibility();
        this.app.fire('network:shoot', { a: this._facingAngle * (Math.PI / 180), d: 0, b: this.brawlerType, isSuper: false });
    }
};

PlayerController.prototype._getSpectatorTarget = function() {
    var pTeam = this.app.myTeam || 'none';
    var mode = this.app.gameMode || 'FFA';
    var botCtrl = this._getBotCtrl();

    if (botCtrl) {
        // 3V3：優先找同隊
        if (mode !== 'FFA') {
            for (var i = 0; i < botCtrl.bots.length; i++) {
                var b = botCtrl.bots[i];
                if (b.team === pTeam && b.state === 'alive') return b.entity.getPosition();
            }
        }
        // FFA 或同隊全滅：找任意存活的 bot
        for (var i = 0; i < botCtrl.bots.length; i++) {
            var b = botCtrl.bots[i];
            if (b.state === 'alive') return b.entity.getPosition();
        }
    }

    // 全場沒人存活，返回 null 讓 CameraFollow 切換成自由移動
    return null;
};

PlayerController.prototype._updateDecoy = function (dt, limitX, limitZ) {
    if (!(this._decoyTimer > 0) || !this._decoyEntity || this._decoyEntity._destroyed) {
        if (this._decoyEntity && this._decoyEntity._destroyed) {
            this._decoyEntity = null;
            this._decoyAnimEntity = null;
            this._decoyTimer = 0;
        }
        return;
    }

    var speedBase = this._decoyOwnerSpeed ||
        (this.config && this.config.speed) || 3.5;
    var dSpeed = speedBase * 0.8;
    var dPos = this._decoyEntity.getPosition();
    var dNewX = dPos.x + this._decoyDirX * dSpeed * dt;
    var dNewZ = dPos.z + this._decoyDirZ * dSpeed * dt;
    dNewX = pc.math.clamp(dNewX, -limitX, limitX);
    dNewZ = pc.math.clamp(dNewZ, -limitZ, limitZ);
    var dFinalX = dPos.x;
    var dFinalZ = dPos.z;
    if (this.app.combatManager) {
        if (!this.app.combatManager.checkCollision(dNewX, dPos.z)) dFinalX = dNewX;
        if (!this.app.combatManager.checkCollision(dFinalX, dNewZ)) dFinalZ = dNewZ;
    }
    this._decoyEntity.setPosition(dFinalX, 0, dFinalZ);
    if (this._decoyAnimEntity && this._decoyAnimEntity.anim) this._decoyAnimEntity.anim.setFloat('speed', 1);
    this._decoyTimer -= dt;
    if (this._decoyTimer > 0) return;

    if (this.app.bulletManager && this.app.combatManager) {
        this.app.bulletManager._triggerExplosion({
            entity: this._decoyEntity,
            aoeTemplate: this.app.combatManager.aoeMap['caocao'] || this._decoyEntity,
            explodeRadius: this._decoyConfig.explodeRadius,
            explodeDamage: this._decoyConfig.explodeDamage,
            ownerType: 'player',
            ownerId: 'player',
            ownerTeam: this.app.myTeam,
            config: this.config,
            skillConf: this._decoyConfig
        });
    }
    if (this.app.floatingUIManager) this.app.floatingUIManager.removeUI(this._decoyEntity);
    this._decoyEntity.destroy();
    this._decoyEntity = null;
    this._decoyAnimEntity = null;
};

PlayerController.prototype._getAutoAimEntityId = function(entity) {
    if (!entity) return null;
    if (entity.name) return entity.name;
    if (entity.getGuid) return entity.getGuid();
    return null;
};

PlayerController.prototype._updateAimContext = function(dt, mx, mz) {
    var cfg = PlayerController.AUTO_AIM;
    var moving = Math.abs(mx) > 0.01 || Math.abs(mz) > 0.01;
    if (moving) {
        var len = Math.sqrt(mx * mx + mz * mz);
        this._aimContextX = mx / len;
        this._aimContextZ = mz / len;
        this._aimContextHoldTimer = cfg.AIM_CONTEXT_HOLD;
        return;
    }
    if (this._aimContextHoldTimer > 0) {
        this._aimContextHoldTimer -= dt;
        return;
    }
    var facingRad = this._facingAngle * (Math.PI / 180);
    this._aimContextX = Math.sin(facingRad);
    this._aimContextZ = Math.cos(facingRad);
};

PlayerController.prototype._clearAimLock = function(rememberLost) {
    if (rememberLost && this._lockedTargetEntity && this._lockedTargetEntity.parent) {
        var lp = this._lockedTargetEntity.getPosition();
        this._lostLockX = lp.x;
        this._lostLockZ = lp.z;
        this._lostLockTimer = PlayerController.AUTO_AIM.LOST_FADE;
    }
    this._lockedTargetId = null;
    this._lockedTargetEntity = null;
    this._aimLockState = 'idle';
    this._engagedTargetId = null;
    this._engageTimer = 0;
    this._dwellCandidateId = null;
    this._dwellTimer = 0;
    this._lockPrevX = null;
    this._lockPrevZ = null;
    this._lockVelX = 0;
    this._lockVelZ = 0;
    this._lockTrackHadTarget = false;
};

PlayerController.prototype._setAimLock = function(targetId, entity, state) {
    var switched = (targetId !== this._lockedTargetId);
    this._lockedTargetId = targetId;
    this._lockedTargetEntity = entity;
    this._aimLockState = state || 'soft';
    if (switched) {
        this._lockPopTimer = 0.18;
        this._lockPrevX = null;
        this._lockPrevZ = null;
        this._lockVelX = 0;
        this._lockVelZ = 0;
    }
    this._lostLockTimer = 0;
};

PlayerController.prototype._beginEngagement = function(targetId, entity) {
    if (!targetId || !entity) return;
    this._engagedTargetId = targetId;
    this._engageTimer = PlayerController.AUTO_AIM.ENGAGE_DURATION;
    this._setAimLock(targetId, entity, 'engaged');
    this._dwellCandidateId = null;
    this._dwellTimer = 0;
};

PlayerController.prototype._refreshEngagementFromLock = function() {
    if (this._lockedTargetId && this._lockedTargetEntity && this._lockedTargetEntity.parent) {
        this._beginEngagement(this._lockedTargetId, this._lockedTargetEntity);
    }
};

PlayerController.prototype._tryEngageAttacker = function(attackerId) {
    if (!attackerId || attackerId === 'player' || attackerId === this.app.socketId) return;
    if (this._aimLockState === 'engaged') return;
    if (PlayerController.isManualAimMode() && this._lockedTargetId) return;

    var entity = null;
    var botCtrl = this._getBotCtrl();
    if (botCtrl) {
        for (var i = 0; i < botCtrl.bots.length; i++) {
            var b = botCtrl.bots[i];
            if (b.id === attackerId || (b.entity && b.entity.name === attackerId)) {
                entity = b.entity;
                break;
            }
        }
    }
    if (!entity && this.app.enemyManager && this.app.enemyManager.enemies) {
        var e = this.app.enemyManager.enemies[attackerId];
        if (e) entity = e.entity;
    }
    if (!entity || !entity.parent) return;
    var tid = this._getAutoAimEntityId(entity);
    if (tid) this._beginEngagement(tid, entity);
};

/** 手動模式：強制鎖到指定目標（換鎖鍵／循環） */
PlayerController.prototype.forceAimLock = function(targetId, entity) {
    if (!targetId || !entity || !entity.parent) return false;
    this._beginEngagement(targetId, entity);
    return true;
};

/** 手動模式：依距離近→遠循環可鎖敵人 */
PlayerController.prototype.cycleAimLock = function() {
    if (!PlayerController.isManualAimMode()) return false;
    if (this.isDead || !this.player) return false;

    var list = this._collectAutoAimCandidates();
    if (!list || list.length === 0) return false;

    list.sort(function(a, b) { return a.dist - b.dist; });

    var idx = -1;
    if (this._lockedTargetId) {
        for (var i = 0; i < list.length; i++) {
            if (list[i].id === this._lockedTargetId) { idx = i; break; }
        }
    }
    var next = list[(idx + 1) % list.length];
    return this.forceAimLock(next.id, next.entity);
};

/** 與 _updateAutoAim 相同過濾，回傳候選陣列（含 dist／score／inCone） */
PlayerController.prototype._collectAutoAimCandidates = function() {
    var cfg = PlayerController.AUTO_AIM;
    if (!this.player) return [];

    var px = this.player.getPosition().x;
    var pz = this.player.getPosition().z;
    var myBushIdx = this.app.gameModeManager ? this.app.gameModeManager.getBushIndex(px, pz) : -1;

    var atkConf = this._currentAttackConfig || this.config;
    var searchRadius = 12.0;
    if (atkConf) {
        if (atkConf.attackPattern === 'melee') {
            searchRadius = 9.0;
        } else if (atkConf.attackPattern === 'lob' && this.app.combatManager && this.app.combatManager.getLobRange) {
            var lobR = this.app.combatManager.getLobRange(atkConf);
            searchRadius = lobR.max + 2.0;
        } else {
            var speed = atkConf.bulletSpeed || 10;
            var life = atkConf.bulletLife || 0.8;
            searchRadius = Math.max(10.0, (speed * life) + 2.0);
        }
    }

    var mode = this.app.gameMode || 'FFA';
    var pTeam = this.app.myTeam || 'none';
    var ctxX = this._aimContextX;
    var ctxZ = this._aimContextZ;
    var ctxLen = Math.sqrt(ctxX * ctxX + ctxZ * ctxZ);
    if (ctxLen > 0.001) { ctxX /= ctxLen; ctxZ /= ctxLen; }
    else { ctxX = 0; ctxZ = 1; }

    var candidates = [];
    var self = this;

    var evaluateTarget = function(entity, targetX, targetZ, isAlive, isStealth, team, revealTimer) {
        if (!isAlive || isStealth || (mode !== 'FFA' && team === pTeam)) return;

        var targetBushIdx = self.app.gameModeManager ? self.app.gameModeManager.getBushIndex(targetX, targetZ) : -1;
        if (targetBushIdx !== -1 && revealTimer <= 0 && myBushIdx !== targetBushIdx) return;

        var dx = targetX - px;
        var dz = targetZ - pz;
        var dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > searchRadius) return;
        if (self.app.combatManager && !self.app.combatManager.checkLOS(px, pz, targetX, targetZ)) return;

        var dirX = dist > 0.01 ? dx / dist : 0;
        var dirZ = dist > 0.01 ? dz / dist : 1;
        var dot = ctxX * dirX + ctxZ * dirZ;
        var angleDiff = Math.acos(pc.math.clamp(dot, -1, 1)) * (180 / Math.PI);
        var inCone = angleDiff <= cfg.CONE_HALF_DEG;

        var score = dist;
        if (!inCone) score += cfg.OUTSIDE_CONE_PENALTY;

        var eId = self._getAutoAimEntityId(entity);
        if (eId && eId === self._lockedTargetId) {
            if (self.comboIndex > 0) score -= cfg.COMBO_STICK;
            else score -= cfg.SOFT_STICK;
        }

        candidates.push({
            id: eId,
            entity: entity,
            dist: dist,
            score: score,
            inCone: inCone
        });
    };

    var botCtrl = this._getBotCtrl();
    if (botCtrl) {
        for (var i = 0; i < botCtrl.bots.length; i++) {
            var b = botCtrl.bots[i];
            evaluateTarget(b.entity, b.entity.getPosition().x, b.entity.getPosition().z, b.state === 'alive', b.isStealth, b.team, b.revealTimer);
        }
    }
    var enemyMgr = this.app.enemyManager;
    if (enemyMgr) {
        for (var eid in enemyMgr.enemies) {
            var e = enemyMgr.enemies[eid];
            evaluateTarget(e.entity, e.targetX, e.targetZ, e.hp > 0 && e.s !== 3, e.isStealth, e.team, e.revealTimer);
        }
    }
    return candidates;
};

PlayerController.prototype._trackLockedVelocity = function(dt) {
    if (!this._lockedTargetEntity || !this._lockedTargetEntity.parent || dt <= 0) {
        this._lockVelX = 0;
        this._lockVelZ = 0;
        this._lockPrevX = null;
        this._lockPrevZ = null;
        return;
    }
    var pos = this._lockedTargetEntity.getPosition();
    if (this._lockPrevX !== null) {
        this._lockVelX = (pos.x - this._lockPrevX) / dt;
        this._lockVelZ = (pos.z - this._lockPrevZ) / dt;
    }
    this._lockPrevX = pos.x;
    this._lockPrevZ = pos.z;
};

PlayerController.prototype._updateAutoAim = function() {
    var cfg = PlayerController.AUTO_AIM;

    if (this._lockedTargetEntity && !this._lockedTargetEntity.parent) {
        this._clearAimLock(true);
    }

    if (this.isDead || !this.app.gameModeManager || !this.player) {
        this._clearAimLock(false);
        return;
    }

    var px = this.player.getPosition().x;
    var pz = this.player.getPosition().z;
    var myBushIdx = this.app.gameModeManager ? this.app.gameModeManager.getBushIndex(px, pz) : -1;
    
    var atkConf = this._currentAttackConfig || this.config;
    var searchRadius = 12.0; 
    if (atkConf) {
        if (atkConf.attackPattern === 'melee') {
            searchRadius = 9.0;
        } else if (atkConf.attackPattern === 'lob' && this.app.combatManager && this.app.combatManager.getLobRange) {
            var lobR = this.app.combatManager.getLobRange(atkConf);
            searchRadius = lobR.max + 2.0;
        } else {
            var speed = atkConf.bulletSpeed || 10;
            var life = atkConf.bulletLifetime || 0.8;
            searchRadius = Math.max(10.0, (speed * life) + 2.0);
        }
    }

    var mode = this.app.gameMode || 'FFA'; 
    var pTeam = this.app.myTeam || 'none';
    var ctxX = this._aimContextX;
    var ctxZ = this._aimContextZ;
    var ctxLen = Math.sqrt(ctxX * ctxX + ctxZ * ctxZ);
    if (ctxLen > 0.001) { ctxX /= ctxLen; ctxZ /= ctxLen; }
    else { ctxX = 0; ctxZ = 1; }

    var candidates = [];
    var self = this;

    var evaluateTarget = function(entity, targetX, targetZ, isAlive, isStealth, team, revealTimer) {
        if (!isAlive || isStealth || (mode !== 'FFA' && team === pTeam)) return;

        var targetBushIdx = self.app.gameModeManager ? self.app.gameModeManager.getBushIndex(targetX, targetZ) : -1;
        if (targetBushIdx !== -1 && revealTimer <= 0 && myBushIdx !== targetBushIdx) return;

        var dx = targetX - px;
        var dz = targetZ - pz;
        var dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > searchRadius) return;
        if (self.app.combatManager && !self.app.combatManager.checkLOS(px, pz, targetX, targetZ)) return;

        var dirX = dist > 0.01 ? dx / dist : 0;
        var dirZ = dist > 0.01 ? dz / dist : 1;
        var dot = ctxX * dirX + ctxZ * dirZ;
        var angleDiff = Math.acos(pc.math.clamp(dot, -1, 1)) * (180 / Math.PI);
        var inCone = angleDiff <= cfg.CONE_HALF_DEG;

        var score = dist;
        if (!inCone) score += cfg.OUTSIDE_CONE_PENALTY;

        var eId = self._getAutoAimEntityId(entity);
        if (eId && eId === self._lockedTargetId) {
            if (self.comboIndex > 0) score -= cfg.COMBO_STICK;
            else score -= cfg.SOFT_STICK;
        }

        candidates.push({
            id: eId,
            entity: entity,
            dist: dist,
            score: score,
            inCone: inCone
        });
    };

    var botCtrl = this._getBotCtrl();
    if (botCtrl) {
        for (var i = 0; i < botCtrl.bots.length; i++) {
            var b = botCtrl.bots[i];
            evaluateTarget(b.entity, b.entity.getPosition().x, b.entity.getPosition().z, b.state === 'alive', b.isStealth, b.team, b.revealTimer);
        }
    }
    var enemyMgr = this.app.enemyManager;
    if (enemyMgr) {
        for (var eid in enemyMgr.enemies) {
            var e = enemyMgr.enemies[eid];
            evaluateTarget(e.entity, e.targetX, e.targetZ, e.hp > 0 && e.s !== 3, e.isStealth, e.team, e.revealTimer);
        }
    }

    if (candidates.length === 0) {
        this._clearAimLock(true);
        return;
    }

    var findById = function(id) {
        for (var ci = 0; ci < candidates.length; ci++) {
            if (candidates[ci].id === id) return candidates[ci];
        }
        return null;
    };

    var pickBest = function() {
        var best = null;
        for (var ci = 0; ci < candidates.length; ci++) {
            var c = candidates[ci];
            if (!best || c.score < best.score) best = c;
        }
        return best;
    };

    var applyDwellSwitch = function(nextCand, acceptState) {
        if (!nextCand) return false;
        if (!self._lockedTargetId || nextCand.id === self._lockedTargetId) {
            self._dwellCandidateId = null;
            self._dwellTimer = 0;
            self._setAimLock(nextCand.id, nextCand.entity, acceptState);
            return true;
        }
        if (self._dwellCandidateId === nextCand.id) {
            self._dwellTimer += cfg.SCAN_INTERVAL;
        } else {
            self._dwellCandidateId = nextCand.id;
            self._dwellTimer = cfg.SCAN_INTERVAL;
        }
        if (self._dwellTimer >= cfg.SWITCH_DWELL) {
            self._dwellCandidateId = null;
            self._dwellTimer = 0;
            self._setAimLock(nextCand.id, nextCand.entity, acceptState);
            if (acceptState !== 'engaged') {
                self._engagedTargetId = null;
                self._engageTimer = 0;
            }
            return true;
        }
        return false;
    };

    // Engaged: freeze retarget from movement; only margin+dwell or invalid leaves
    if (this._aimLockState === 'engaged' && this._engagedTargetId) {
        var engagedCand = findById(this._engagedTargetId);
        if (!engagedCand) {
            this._engagedTargetId = null;
            this._engageTimer = 0;
            this._aimLockState = 'soft';
        } else {
            this._setAimLock(engagedCand.id, engagedCand.entity, 'engaged');

            var bestOther = null;
            for (var oi = 0; oi < candidates.length; oi++) {
                var oc = candidates[oi];
                if (oc.id === engagedCand.id) continue;
                if (!oc.inCone) continue;
                if (!bestOther || oc.score < bestOther.score) bestOther = oc;
            }

            if (bestOther && bestOther.score < engagedCand.score - cfg.SWITCH_MARGIN) {
                applyDwellSwitch(bestOther, 'soft');
            } else {
                this._dwellCandidateId = null;
                this._dwellTimer = 0;
            }
            return;
        }
    }

    // Soft / idle acquisition via cone score
    var best = pickBest();
    if (!best) {
        this._clearAimLock(true);
        return;
    }

    if (!this._lockedTargetId) {
        this._setAimLock(best.id, best.entity, 'soft');
        this._dwellCandidateId = null;
        this._dwellTimer = 0;
        return;
    }

    if (best.id === this._lockedTargetId) {
        this._setAimLock(best.id, best.entity, this._aimLockState === 'engaged' ? 'engaged' : 'soft');
        this._dwellCandidateId = null;
        this._dwellTimer = 0;
        return;
    }

    applyDwellSwitch(best, 'soft');
};

PlayerController.prototype._updateLockOnFeedback = function(dt) {
    var cfg = PlayerController.AUTO_AIM;
    if (this._lockPopTimer > 0) this._lockPopTimer -= dt;
    if (this._lostLockTimer > 0) this._lostLockTimer -= dt;

    var showLock = this._lockedTargetEntity && !this.isDead && this.lockOnRing;
    var showLost = !showLock && this._lostLockTimer > 0 && this.lockOnRing && !this.isDead;

    if (showLock) {
        this.lockOnRing.enabled = true;
        var tPos = this._lockedTargetEntity.getPosition();
        this.lockOnRing.setPosition(tPos.x, 0.08, tPos.z);

        var engaged = this._aimLockState === 'engaged';
        var baseScale = engaged ? 2.05 : 1.8;
        var pop = this._lockPopTimer > 0 ? (1.0 + this._lockPopTimer * 1.2) : 1.0;
        var ringScale = (baseScale + 0.15 * Math.sin(Date.now() / 150)) * pop;
        this.lockOnRing.setLocalScale(ringScale, 1, ringScale);
        this.lockOnRing.rotateLocal(0, dt * 100, 0);

        var ringMat = this.lockOnRing.render.meshInstances[0].material;
        if (engaged || this.comboIndex > 0) {
            ringMat.emissiveIntensity = 4.5;
            ringMat.opacity = 1.0;
        } else {
            ringMat.emissiveIntensity = 2.5;
            ringMat.opacity = 0.8;
        }
        ringMat.update();

        if (this.aimAssistArrow && this.player) {
            var p = this.player.getPosition();
            var dx = tPos.x - p.x;
            var dz = tPos.z - p.z;
            var dist = Math.sqrt(dx * dx + dz * dz);
            if (dist > 0.35) {
                var nx = dx / dist;
                var nz = dz / dist;
                var arrowScale = engaged ? 0.55 : 0.48;
                // Super ring plane scale 2.2, stroke ~110/128 of half-extent → ~1.0 radius
                var ringScaleX = (this.superRingEntity) ? this.superRingEntity.getLocalScale().x : 2.2;
                var ringOuter = ringScaleX * 0.5 * (110 / 128);
                var standOff = ringOuter + arrowScale * 0.55 + 0.18;
                this.aimAssistArrow.enabled = true;
                this.aimAssistArrow.setPosition(p.x + nx * standOff, 0.08, p.z + nz * standOff);
                // Plane UV tip maps opposite local +Z → flip 180 so tip faces the enemy
                var yaw = Math.atan2(nx, nz) * (180 / Math.PI) + 180;
                this.aimAssistArrow.setEulerAngles(0, yaw, 0);
                this.aimAssistArrow.setLocalScale(arrowScale, 1, arrowScale);
                var arrowMat = this.aimAssistArrow.render.meshInstances[0].material;
                arrowMat.emissiveIntensity = engaged ? 4.0 : 2.8;
                arrowMat.opacity = engaged ? 1.0 : 0.85;
                arrowMat.update();
            } else {
                this.aimAssistArrow.enabled = false;
            }
        }
    } else if (showLost) {
        this.lockOnRing.enabled = true;
        this.lockOnRing.setPosition(this._lostLockX, 0.08, this._lostLockZ);
        var fade = this._lostLockTimer / cfg.LOST_FADE;
        this.lockOnRing.setLocalScale(1.6, 1, 1.6);
        var fadeMat = this.lockOnRing.render.meshInstances[0].material;
        fadeMat.emissiveIntensity = 1.2 * fade;
        fadeMat.opacity = 0.55 * fade;
        fadeMat.update();
        if (this.aimAssistArrow) this.aimAssistArrow.enabled = false;
    } else {
        if (this.lockOnRing) this.lockOnRing.enabled = false;
        if (this.aimAssistArrow) this.aimAssistArrow.enabled = false;
    }
};

PlayerController.prototype.update = function (dt) {
    dt = Math.min(dt, 0.1); 
    if (!this.config || !this.player) return;

    if (this.app.gameMode === 'ROGUE' && window.CombatResolver && window.CombatResolver.tickAuras) {
        window.CombatResolver.tickAuras(this.app);
    }

    this._dashCommandedThisFrame = false; 
    if (this._faceLockTimer > 0) this._faceLockTimer -= dt;

    if (this._perfectCounterExpire > 0) {
        this._perfectCounterExpire -= dt;
    }
    // 以時間戳為準過期（避免 pc 計時與 app 不同步）
    if (this.app && this.app._perfectCounterActive && this.app._perfectCounterUntilMs) {
        if (Date.now() > this.app._perfectCounterUntilMs) {
            this._perfectCounterStun = 0;
            this._perfectCounterExpire = 0;
            this.app._perfectCounterActive = false;
            this.app._perfectCounterUntilMs = 0;
            this.app._perfectCounterStun = 0;
        }
    }

    // 🌟 衝刺狀態機：衝刺中（前搖/衝/後搖）鎖定移動與攻擊
    var rushActive = this._updateRush(dt);

    var pPos = this.player.getPosition();

    // 🌟 DOT 狀態背包即時倒數
    var isMultiplayerDot = !!(this.app.networkManager && this.app.networkManager.socket && this.app.networkManager.socket.connected);
    for (var stateKey in this.activeStates) {
        var status = this.activeStates[stateKey];
        if (!status) continue; 

        status.duration -= dt;
        status.tickTimer += dt;
        if (status.tickTimer >= status.tickRate) {
            status.tickTimer = 0;
            // 🌟 雙扣根治：多人時 DOT 傷害由 server 權威 tick 扣（唯一來源），
            //    本地【不】扣血（否則 server 扣一次 + 本地扣一次 = 雙扣）。單機才本地扣。
            if (!this.isDead && !isMultiplayerDot) {
                this._onPlayerHit(status.damagePerTick, status.attackerId, false, undefined, { isCombo: true, scale: 1.2, isDotTick: true });
            }
        }
        if (status.duration <= 0) {
            delete this.activeStates[stateKey];
        }
    }

    // 處理排隊中的延遲攻擊 (fireDelay)
    if (this._attackQueue.length > 0) {
        if (this._lockedTargetEntity && !this._lockedTargetEntity.parent) {
            this._lockedTargetEntity = null;
            this._lockedTargetId = null;
        }

        for (var q = this._attackQueue.length - 1; q >= 0; q--) {
            var task = this._attackQueue[q];
            task.timer -= dt;

           if (task.timer <= 0) {
                // 已排隊的曹操誘餌大招：死亡後仍要放出（離體投射物）
                var allowDeadSuper = task.isSuper && task.config && task.config.type === 'super_decoy';
                if ((!this.isDead || allowDeadSuper) && (!this._isTransforming || task.isSuper)) {
                    
                    if (task.isAutoAim) {
                        if (this._lockedTargetEntity) {
                            task.angle = this._findAutoAimAngle();
                        } else {
                            task.angle = this._facingAngle * (Math.PI / 180);
                        }
                    }

                    var spawnPrep = this._prepareLobAttack(task.config, task.angle, task.distance, task.isAutoAim);
                    task.config = spawnPrep.conf;
                    task.angle = spawnPrep.angle;
                    task.distance = spawnPrep.distance;

                    this._facingAngle = task.angle * (180 / Math.PI);
                    var angleOffset = (task.config && task.config.animAngleOffset) ? task.config.animAngleOffset : 0;
                    this.player.setEulerAngles(0, this._facingAngle + angleOffset, 0);

                    if (task.config && task.config.hitStopDuration) {
                        this.hitStopTimer = task.config.hitStopDuration;
                        if (this.animEntity && this.animEntity.anim) this.animEntity.anim.speed = 0;
                    }

                    if (task.isSuper) {
                        this._spawnSuper(task.config, task.angle, task.distance);
                    } else if (task.isExtra) {
                        this._procComboIndex = (task.comboIndex !== undefined) ? task.comboIndex : 0;
                        this._spawnExtraEffects([task.config], task.angle, task.distance);
                    } else {
                        this._procComboIndex = (task.comboIndex !== undefined) ? task.comboIndex : 0;
                        this._spawnProjectiles(task.config, task.angle, task.distance);
                    }
                }
                this._attackQueue.splice(q, 1);
            }
        }
    }

    if (this._lockedTargetEntity && !this._lockedTargetEntity.parent) {
        this._lockedTargetId = null;
        this._lockedTargetEntity = null;
    }

    if (this._hitFlashTimer > 0) {
        this._hitFlashTimer -= dt;
        if (this._hitFlashTimer <= 0) {
            this._updateMaterialVisibility();
        }
    }

    if (this.currentDashCharges < this.maxDashCharges) {
        this.dashRechargeTimer += dt;
        if (this.dashRechargeTimer >= (this.config.dashRechargeTime || 2.4)) {
            this.currentDashCharges++;
            this.dashRechargeTimer = 0;
            this._updateDodgeUI();
        }
    }

    this._tickPoiseCharge(dt);

    if (this.comboIndex > 0) {
        this.lastAttackTime += dt;
        if (this.lastAttackTime > this.comboResetTime) {
            this.comboIndex = 0;
            this._attackAnimTimer = 0; 
            this._setAnimMirror(false);
            if (this._weaponProp) this._weaponProp.enabled = false;
        }
    }

    if (this._engageTimer > 0) {
        this._engageTimer -= dt;
        if (this._engageTimer <= 0) {
            this._engageTimer = 0;
            this._engagedTargetId = null;
            if (this._lockedTargetEntity && this._lockedTargetEntity.parent) {
                this._aimLockState = 'soft';
            } else {
                this._aimLockState = 'idle';
            }
        }
    }

    this._trackLockedVelocity(dt);
    this._updateLockOnFeedback(dt);

    var limitX = this.app.gameModeManager ? this.app.gameModeManager.mapLimitX : 11.5;
    var limitZ = this.app.gameModeManager ? this.app.gameModeManager.mapLimitZ : 10.0;
    
    if (this.hitStopTimer > 0) {
        this.hitStopTimer -= dt;
        if (this.hitStopTimer <= 0 && this.animEntity && this.animEntity.anim) {
            this.animEntity.anim.speed = 1.0; 
        }
    }

  
    // 誘餌已離體：等同子彈，死亡／結算仍要跑完（不可因 gameover early-return 原地停住）
    this._updateDecoy(dt, limitX, limitZ);

    if (this.app.scoreManager && this.app.scoreManager.getState() === 'gameover') {
        if (this.deathMessage && this.deathMessage.enabled) this.deathMessage.enabled = false;
        if (this.lockOnRing) this.lockOnRing.enabled = false;
        if (this.aimAssistArrow) this.aimAssistArrow.enabled = false;
        return; 
    }

    if (this._superBurstRemaining > 0) {
        this._superBurstTimer -= dt;
        if (this._superBurstTimer <= 0) {
            var sConf = this.config.super || {}; 
            var sCount = sConf.burstCount || 6; 
            var sIdx = sCount - this._superBurstRemaining;
            if(this.app.combatManager) {
                if (sConf.type === 'super_zhouyu_burst' || sConf.type === 'super_skyfall') {
                    // skyfall 由 beginSuperSkyfall 一次排程，不再走 per-tick burst
                } 
                else if (sConf.type === 'super_zhangfei_roar') {
                    var mergedConf = Object.assign({}, this.config, sConf);
                    mergedConf.type = sConf.type || 'super_zhangfei_roar'; 
                    mergedConf.isSuper = true; 
                    this.app.combatManager.fireProjectile('player', 'player', this.app.myTeam, this.brawlerType, pPos, this._superBurstAngle, 'wave', 1.0, mergedConf);
                    if (window.CombatResolver && window.CombatResolver.tryFireBasicProcs) {
                        window.CombatResolver.tryFireBasicProcs(
                            this.app, 'player', 'player', this.app.myTeam, this.brawlerType,
                            mergedConf, this._superBurstAngle, 1.0, -1
                        );
                    }
                }
                else if (sConf.type === 'super_whirlwind') {
                    var a = this._superBurstAngle + (Math.PI / 4) * sIdx;
                    var spawnX = pPos.x + Math.sin(a) * 1.5;
                    var spawnZ = pPos.z + Math.cos(a) * 1.5;
                    this._tempVec1.set(spawnX, 0, spawnZ);
                    var whirlConf = Object.assign({}, sConf, { isSuper: true });
                    this.app.combatManager.fireProjectile('player', 'player', this.app.myTeam, this.brawlerType, this._tempVec1, a, 'melee', 1.0, whirlConf);
                    if (window.CombatResolver && window.CombatResolver.tryFireBasicProcs) {
                        window.CombatResolver.tryFireBasicProcs(
                            this.app, 'player', 'player', this.app.myTeam, this.brawlerType,
                            whirlConf, a, 1.0, -1
                        );
                    }
                }
            }
            this._superBurstTimer = sConf.burstInterval || 0.15; 
            this._superBurstRemaining--;
        }
    }

    if (this._burstRemaining > 0) {
        this._burstTimer -= dt;
        if (this._burstTimer <= 0) {
            var atkConf = this._currentAttackConfig || this.config; 
            var CR = window.CombatResolver;
            var pCount = (CR && CR.getBurstProjectileCount) ? CR.getBurstProjectileCount(atkConf) : (atkConf.projectileCount || atkConf.spreadCount || 1);
            var sAngle = atkConf.spreadAngle || 0;
            var tRad = sAngle * Math.PI / 180;
            var pType = atkConf.attackPattern === 'flamethrower' ? 'wave' : (atkConf.attackPattern || atkConf.type || 'normal');

            var burstSpawnPos = this.player.getPosition().clone();

            for (var i = 0; i < pCount; i++) {
                var finalA = this._burstAngle;
                if (pCount > 1) {
                    finalA = (CR && CR.getSpreadAngle)
                        ? CR.getSpreadAngle(this._burstAngle, sAngle, i, pCount)
                        : (this._burstAngle - tRad / 2 + (tRad / (pCount - 1)) * i);
                }
                finalA += (Math.random() - 0.5) * 0.04; 

                if(this.app.combatManager) {
                    this.app.combatManager.fireProjectile(
                        'player', 'player', this.app.myTeam, this.brawlerType, 
                        burstSpawnPos, finalA, pType, this._burstDistance || 1.0, atkConf
                    );
                }
            }
            this._burstRemaining--; 
            this._burstTimer = atkConf.burstInterval || 0.08;
        }
    }

    if (this.isDead) {
        // Death linger: freeze + gray → vanish. Re-apply gray each frame
        // so hit-flash / opacity restore cannot wipe it.
        if (this.player && this.player.enabled && this.app.combatManager
            && this.app.combatManager.applyDeathGray) {
            this.app.combatManager.applyDeathGray(this.player);
        }
        if (this._deathVanishTimer && this._deathVanishTimer > 0 && this.player) {
            this._deathVanishTimer -= dt;
            if (this._deathVanishTimer <= 0) {
                this._deathVanishTimer = 0;
                this.player.enabled = false;
            }
        }
        if (this.app.gameMode !== '3V3_KNOCKOUT' && 
            this.app.gameMode !== 'ROGUE' && 
            this.app.gameMode !== 'FFA') {
            this.respawnTimer -= dt;
            if (this.deathMessage && this.deathMessage.element) {
                this.deathMessage.element.text = this.t('hud.respawn.countdown', { n: Math.max(1, Math.ceil(this.respawnTimer)) });
            }
            if (this.respawnTimer <= 0) this._respawn();
        }
        return;
    }
    
    if (this.revealTimer > 0) this.revealTimer -= dt;

    // 🌟 在這裡加入隱身倒數
    if (this._isStealth && this.stealthTimer > 0) {
        this.stealthTimer -= dt;
        if (this.stealthTimer <= 0) {
            this.stealthTimer = 0;
            this._isStealth = false;
            this.stealthSpeedMultiplier = 1.0;
            this._updateMaterialVisibility();
        }
    }

    var nowInBush = false;
    var currentBushIdx = -1;
    
    if (this.app.gameModeManager) {
        currentBushIdx = this.app.gameModeManager.getBushIndex(pPos.x, pPos.z);
        nowInBush = (currentBushIdx !== -1);
    }

    var isRevealed = (this.revealTimer > 0);

    if (nowInBush !== this.inBush || this._currentBushIdx !== currentBushIdx || this._lastRevealState !== isRevealed) {
         if (this._currentBushIdx !== -1 && this._currentBushIdx !== currentBushIdx) {
             if (this.app.gameModeManager) this.app.gameModeManager.setBushTransparent(this._currentBushIdx, false);
         }
        this.inBush = nowInBush;
        this._currentBushIdx = currentBushIdx;
        this._lastRevealState = isRevealed;

        if (this.inBush) {
            if (this.app.gameModeManager) this.app.gameModeManager.setBushTransparent(this._currentBushIdx, true);
        }

        this._updateMaterialVisibility(); 
    }

    if (this._invincible && this.invincibleTimer > 0) {
        this.invincibleTimer -= dt;
        if (this.invincibleTimer <= 0) {
            this.invincibleTimer = 0; 
            this._invincible = false; 
            this._updateMaterialVisibility();
        } else if (!this._isStealth && this.app.gameState === 'playing') {
            var targetOpacity = (Math.floor(this.invincibleTimer / 0.15) % 2 === 0) ? 0.3 : 1.0;
            this.app.combatManager.setEntityOpacity(this.player, targetOpacity);
        }
    }

    if (this.superRingCtx && this.superCharge !== this._lastRenderedSuperCharge) {
        this._lastRenderedSuperCharge = this.superCharge;
        var ratio = pc.math.clamp(this.superCharge / this.maxSuperCharge, 0, 1.0);
        var ctx = this.superRingCtx; 
        ctx.clearRect(0, 0, 256, 256);
        ctx.beginPath();
        ctx.arc(128, 128, 110, 0, 2 * Math.PI); 
        ctx.lineWidth = 14; 
        ctx.strokeStyle = 'rgba(100, 100, 100, 0.8)'; 
        ctx.stroke();
        if (ratio > 0) {
            ctx.beginPath();
            ctx.arc(128, 128, 110, -Math.PI / 2, -Math.PI / 2 + (ratio * 2 * Math.PI));
            ctx.lineWidth = 14;
            ctx.lineCap = 'round'; 
            ctx.strokeStyle = 'rgba(255, 215, 0, 1.0)'; 
            if (ratio >= 1.0) { 
                ctx.shadowBlur = 15;
                ctx.shadowColor = 'rgba(255, 215, 0, 1.0)'; 
            } else { 
                ctx.shadowBlur = 0;
            } 
            ctx.stroke();
        }
        if (this.superRingTex) {
            this.superRingTex.setSource(this.superRingCanvas); 
            this.superRingTex.upload();
        }
    }
    
    if (this.superRingMat) {
        if (this.superCharge >= this.maxSuperCharge) {
            this.superRingMat.emissiveIntensity = 1.2 + 0.8 * Math.sin(Date.now() / 150);
            this.superRingMat.update();
        } else if (this._lastSuperFull) {
            this.superRingMat.emissiveIntensity = 2.0;
            this.superRingMat.update();
        }
        this._lastSuperFull = (this.superCharge >= this.maxSuperCharge);
    }

    if (this.app.inputManager && this.app.inputManager.setSuperReady) {
        this.app.inputManager.setSuperReady(this.superCharge >= this.maxSuperCharge);
    }

    var input = this.app.inputManager;
    if (!input) return;
    
    var mx = input.moveX; 
    var mz = input.moveZ;

    // 開場 preview／選卡鎖定：強制停步並丟棄攻擊（timeScale=0 時仍可能瞬間出招）
    var combatBlocked = (input._isCombatInputBlocked && input._isCombatInputBlocked())
        || this.app.gameState === 'intro'
        || this.app.gameState === 'promo'
        || !!(input._inputLocked);
    if (combatBlocked) {
        mx = 0;
        mz = 0;
        if (input.consumeAttackCommand) input.consumeAttackCommand();
        input.attackCommand = null;
    }

    // 🌟 衝刺狀態機進行中（前搖/衝/後搖）→ 鎖死移動與攻擊輸入
    if (this._rushState && this._rushState !== 'none') {
        mx = 0; mz = 0;
        if (input.consumeAttackCommand) input.consumeAttackCommand();
        input.attackCommand = null;
    }

    // 🌟 暈眩狀態鎖死所有輸入
    if (this.stunTimer > 0 || this._kbTimer > 0) { // 🚀 補上 || this._kbTimer > 0
        if (this.stunTimer > 0) this.stunTimer -= dt; // 確保只倒數暈眩
        mx = 0; 
        mz = 0;
        if (input.consumeAttackCommand) input.consumeAttackCommand();
        input.attackCommand = null;
        if (this.animEntity && this.animEntity.anim) this.animEntity.anim.setFloat('speed', 0);
    } else {
        // 🌟 修正：保留單搖桿神級停步射擊
        if (this._isTransforming || this.isDashing || this._attackAnimTimer > 0) {
            mx = 0;
            mz = 0;
        }
    }

    this._updateAimContext(dt, mx, mz);
    this._autoAimTimer -= dt;
    if (this._autoAimTimer <= 0) {
        this._updateAutoAim();
        this._autoAimTimer = PlayerController.AUTO_AIM.SCAN_INTERVAL;
    }

    // 🚀 新增：實體擊退的平滑滑行引擎 (緊接在上面那段之後)
    if (this._kbTimer > 0) {
        this._kbTimer -= dt;
        var slideX = pc.math.lerp(pPos.x, this._kbTargetX, dt * 25);
        var slideZ = pc.math.lerp(pPos.z, this._kbTargetZ, dt * 25);
        this.player.setPosition(slideX, 0, slideZ);
        
        // 更新當前位置，以免後續程式碼讀到舊座標
        pPos.x = slideX; 
        pPos.z = slideZ;
    }
    
    if (this._dashTimer > 0) {
        this._dashTimer -= dt;
        var dashDur = this._dashTotalDuration > 0 ? this._dashTotalDuration : 0.001;
        var dashElapsed = dashDur - Math.max(0, this._dashTimer);
        var dashT = Math.min(1, dashElapsed / dashDur);
        var easedDashT = this._easeSlideT(dashT, this._dashEasePower);
        var slideX = pc.math.lerp(this._dashStartX, this._dashTargetX, easedDashT);
        var slideZ = pc.math.lerp(this._dashStartZ, this._dashTargetZ, easedDashT);
        this.player.setPosition(slideX, 0, slideZ);
        pPos.x = slideX; 
        pPos.z = slideZ;

        if (this._dashTimer <= 0 || dashT >= 1) {
            this.player.setPosition(this._dashTargetX, 0, this._dashTargetZ);
            pPos.x = this._dashTargetX;
            pPos.z = this._dashTargetZ;
            this._dashTimer = 0;
            this.isDashing = false;
        }
    }

    if (this.isDashing && this._dashTimer <= 0) {
        this.isDashing = false;
    }

    if (this._autoStepTimer > 0) {
        this._autoStepTimer -= dt;
        var stepDur = this._autoStepTotalDuration > 0 ? this._autoStepTotalDuration : 0.001;
        var stepElapsed = stepDur - Math.max(0, this._autoStepTimer);
        var stepT = Math.min(1, stepElapsed / stepDur);
        var easedStepT = this._easeSlideT(stepT, this._autoStepEasePower);
        var stepSlideX = pc.math.lerp(this._autoStepStartX, this._autoStepTargetX, easedStepT);
        var stepSlideZ = pc.math.lerp(this._autoStepStartZ, this._autoStepTargetZ, easedStepT);
        this.player.setPosition(stepSlideX, 0, stepSlideZ);
        pPos.x = stepSlideX;
        pPos.z = stepSlideZ;

        if (this._autoStepTimer <= 0 || stepT >= 1) {
            this.player.setPosition(this._autoStepTargetX, 0, this._autoStepTargetZ);
            pPos.x = this._autoStepTargetX;
            pPos.z = this._autoStepTargetZ;
            this._autoStepTimer = 0;
        }
    }
    // 🌟 新增：更新微減速計時器
    if (this.snareTimer > 0) this.snareTimer -= dt;

    var isMoving = Math.abs(mx) > 0.01 || Math.abs(mz) > 0.01;
    if (isMoving) {
        // 🌟 改寫：套用微減速
        var currentSnare = (this.snareTimer > 0) ? this.snareMultiplier : 1.0;
        var currentSpeed = this.config.speed * this.stealthSpeedMultiplier * currentSnare;
        
        var newX = pPos.x + mx * currentSpeed * dt;
        var newZ = pPos.z + mz * currentSpeed * dt;
        
        newX = pc.math.clamp(newX, -limitX, limitX); 
        newZ = pc.math.clamp(newZ, -limitZ, limitZ);
        
        var finalX = pPos.x; 
        var finalZ = pPos.z;
        if (!this.app.combatManager.checkCollision(newX, pPos.z)) finalX = newX;
        if (!this.app.combatManager.checkCollision(pPos.x, newZ)) finalZ = newZ;
        
        this.player.setPosition(finalX, 0, finalZ);
        pPos.x = finalX; 
        pPos.z = finalZ;
        this._currentBodyAngle = Math.atan2(mx, mz) * (180 / Math.PI);
    }

    if (this._attackAnimTimer > 0) { 
        this._attackAnimTimer -= dt;
        if (this._attackAnimTimer <= 0) {
            if (this._weaponProp) this._weaponProp.enabled = false;
            if (this._animMirrorSign === -1) this._setAnimMirror(false);
        }
    } else if (isMoving && this._faceLockTimer <= 0) {
        this._facingAngle = this._currentBodyAngle;
        this.player.setEulerAngles(0, this._facingAngle, 0);
    }

    if (this.superRingEntity) this.superRingEntity.setEulerAngles(0, 0, 0);

    if (this.animEntity) {
        if (this.animEntity.anim) {
            var speedMag = Math.sqrt(mx * mx + mz * mz);
            var signedSpeed = speedMag; 
            if (speedMag > 0.01) {
                var facingRad = this._facingAngle * (Math.PI / 180);
                var faceX = Math.sin(facingRad); 
                var faceZ = Math.cos(facingRad);
                var dot = (mx / speedMag) * faceX + (mz / speedMag) * faceZ;
                if (dot < -0.1) signedSpeed = -speedMag;
            }
            
            if (this.hitStopTimer <= 0) this.animEntity.anim.setFloat('speed', signedSpeed);
            
            if (this.animEntity.anim.layers) {
                for (var l = 0; l < this.animEntity.anim.layers.length; l++) {
                    var layer = this.animEntity.anim.layers[l];
                    if (layer.name === 'Shoot') {
                        var stateName = layer.activeState || '';
                        var isActiveAttack = stateName.indexOf('Attack') !== -1 || stateName.indexOf('attack') !== -1;
                        var isSuper = stateName.indexOf('Super') !== -1 || stateName.indexOf('super') !== -1;
                        
                        var targetWeight = (isActiveAttack || isSuper) ? 1.0 : 0.0;
                        layer.weight = pc.math.lerp(layer.weight, targetWeight, dt * 10); 
                        break;
                    }
                }
            }
        }
    }

    this.timeSinceLastAttack += dt;
    var wasReloading = this.isReloading;
    this.isReloading = false;

    if (this.ammo < this.maxAmmo) {
        var currentReloadTime = this.config.reloadTime !== undefined ? this.config.reloadTime : 1.5;
        
        if (this.timeSinceLastAttack >= currentReloadTime) {
            this.ammo = this.maxAmmo; 
            this._updateAmmoUI(); 
        } else {
            this.isReloading = true;
            if (!wasReloading) {
                this._updateAmmoUI();
            }
        }
    } else if (wasReloading) {
        this._updateAmmoUI();
    }


    var cmd = null;
    if (!combatBlocked) {
        if (input.consumeAttackCommand) {
            cmd = input.consumeAttackCommand();
        } else if (input.attackCommand) {
            cmd = input.attackCommand;
            input.attackCommand = null;
        }
    } else {
        input.attackCommand = null;
    }

    if (cmd) {
        var attackAngle = (cmd.mode === 'auto') ? this._findAutoAimAngle() : cmd.angle;
        var attackDistance = 1.0;
        
        if (cmd.mode === 'auto' && this._lockedTargetEntity && this._lockedTargetEntity.parent) {
            var tx = this._lockedTargetEntity.getPosition().x;
            var tz = this._lockedTargetEntity.getPosition().z;
            var actualDist = Math.sqrt((tx - pPos.x) * (tx - pPos.x) + (tz - pPos.z) * (tz - pPos.z));
            
            var stepIdx = this.comboIndex;
            var override = this.config.comboOverrides ? this.config.comboOverrides[stepIdx] : null;
            var conf = override ? Object.assign({}, this.config, override) : this.config;
            
            if ((conf.attackPattern || conf.type) === 'lob' && this.app.combatManager && this.app.combatManager.getLobRange) {
                var lobRange = this.app.combatManager.getLobRange(conf);
                var clampedDist = pc.math.clamp(actualDist, lobRange.min, lobRange.max);
                attackDistance = lobRange.max > lobRange.min
                    ? (clampedDist - lobRange.min) / (lobRange.max - lobRange.min)
                    : 1.0;
            } else {
                var maxRange = (conf.bulletSpeed || 10) * (conf.bulletLifetime || 0.8);
                attackDistance = pc.math.clamp(actualDist / maxRange, 0.15, 1.0);
            }
        } else {
            attackDistance = cmd.distance || 1.0;
        }
        
        if (this._invincible) { 
            this._invincible = false; 
            this._updateMaterialVisibility();
        }
        if (this._isStealth) { 
            this._isStealth = false;
            this.stealthTimer = 0; 
            this.stealthSpeedMultiplier = 1.0;
            this._updateMaterialVisibility(); 
        }

        if (cmd.isSuper) {
            if (this.superCharge >= this.maxSuperCharge) { 
                this.superCharge = 0;
                this._lastRenderedSuperCharge = -1; 
                
                if (this.app.inputManager && this.app.inputManager.setSuperReady) {
                    this.app.inputManager.setSuperReady(false);
                }
                
                this._pendingIsAutoAim = (cmd.mode === 'auto');
                this._executeSuper(attackAngle, attackDistance); 
                if (cmd.mode === 'auto') this._refreshEngagementFromLock();
            }
        } else {
            var hasNonSuperQueued = false;
            for (var qi = 0; qi < this._attackQueue.length; qi++) {
            if (!this._attackQueue[qi].isSuper) { hasNonSuperQueued = true; break; }
            }
            var canBasicAttack = this._burstRemaining <= 0 && this._attackAnimTimer <= 0 && !this.isDashing && !hasNonSuperQueued;
            if (this.ammo > 0 && canBasicAttack) {
                this._pendingIsAutoAim = (cmd.mode === 'auto');
                this._executeAttack(attackAngle, attackDistance);
                if (cmd.mode === 'auto') this._refreshEngagementFromLock();
            } else if (this.ammo <= 0 && this.isReloading && canBasicAttack) {
                this._pendingIsAutoAim = (cmd.mode === 'auto');
                this._executeEmptyAmmoPunch(attackAngle, attackDistance);
                if (cmd.mode === 'auto') this._refreshEngagementFromLock();
            }
        }
    }

    if (this._isTransformed && this.config.isMecha && this.config.autoDrainRate) {
        this.health -= this.maxHealth * this.config.autoDrainRate * dt;
        this.lastDamageTime = Date.now(); 
        this._updatePlayerHealthBar();
        if (this.health <= 0) {
            this.health = 0;
            this._revertTransform(); 
            return; 
        }
    } else {
        var now2 = Date.now();
        if (now2 - this.lastDamageTime > 3000 && this.health < this.maxHealth) {
            this.health = Math.min(this.health + this.maxHealth * 0.13 * dt, this.maxHealth);
            this._updatePlayerHealthBar();
        }
        if (window.CombatResolver && window.CombatResolver.tickShieldRegen) {
            window.CombatResolver.tickShieldRegen(this, dt);
            if (this.player && this.app.floatingUIManager && this.app.floatingUIManager.updateShield) {
                this.app.floatingUIManager.updateShield(this.player, this.shieldHP || 0, this.shieldMax || 0);
            }
        }
    }

    // ==========================================
    // 🌟 動態狀態標籤分配器 (Status Priority Dispatcher)
    // ==========================================
    if (this.app.floatingUIManager && !this.isDead) {
        // 清掉誤掛在玩家身上的破綻印（舊邏輯殘留）
        if (this._breachMark) this._breachMark = null;
        var statusEmojis = (window.CombatResolver && CombatResolver.buildStatusIcons)
            ? CombatResolver.buildStatusIcons(this)
            : '';
        if (!statusEmojis) {
            if (this.stunTimer > 0 && this._initialStunDuration >= 0.5) statusEmojis += "💫";
            if (WordSystem.hasActiveBleedDot(this.activeStates)) statusEmojis += "☠️";
            if (WordSystem.hasActiveFireDot(this.activeStates)) statusEmojis += "🔥";
        }
        this.app.floatingUIManager.updateStatus(this.player, statusEmojis, null);
    }
    // ==========================================
    // 🌟 視覺受擊形變 (Squash & Stretch) 彈簧回歸
    // ==========================================
    if (this.animEntity && !this.isDead) {
        var damping = 0.7;   // 阻尼：決定回彈多快停下
        var stiffness = 0.5; // 彈力：決定回彈多猛
        
        this._squashVelocity = (this._squashVelocity || 0) - (this._squashScale * stiffness);
        this._squashVelocity *= damping;
        this._squashScale += this._squashVelocity;

        // 計算目標 Scale: X和Z軸擴張，Y軸略微壓縮（_animMirrorSign 保留左右鏡像）
        var s = 1.0 + this._squashScale;
        var y = 1.0 - (this._squashScale * 0.5);
        var mirror = this._animMirrorSign || 1;
        // 🌟 修正：用 BaseScale 乘以係數！
        this.animEntity.setLocalScale(
            this._baseAnimScale.x * mirror * s, 
            this._baseAnimScale.y * y, 
            this._baseAnimScale.z * s
        );
    }
};

PlayerController.prototype._setAnimMirror = function(on) {
    this._animMirrorSign = on ? -1 : 1;
    if (!this.animEntity || !this._baseAnimScale) return;
    var sq = this._squashScale || 0;
    var s = 1.0 + sq;
    var y = 1.0 - (sq * 0.5);
    this.animEntity.setLocalScale(
        this._baseAnimScale.x * this._animMirrorSign * s,
        this._baseAnimScale.y * y,
        this._baseAnimScale.z * s
    );
};

PlayerController.prototype._updateMaterialVisibility = function() {
    if (!this.player || this.isDead) return;
    
    var targetOpacity = 1.0; 

    if (this._isStealth) {
        targetOpacity = 0.4;
    } else if (this.inBush && this.revealTimer <= 0) {
        targetOpacity = 0.6; 
    }

    if (this.app.combatManager) {
        this.app.combatManager.setEntityOpacity(this.player, targetOpacity);
    }
};

PlayerController.prototype._restoreMaterial = function() { 
    this._updateMaterialVisibility(); 
};

PlayerController.prototype._onClearAmmo = function() {
    if (this.isDead || this._invincible || (this._isTransformed && !this._allowsTransformSuper())) return;
    this.ammo = 0; 
    this.timeSinceLastAttack = 0; 
    this.isReloading = true;
    this._updateAmmoUI();
    if (this.player) {
        if (this.app.combatManager) this.app.combatManager.applyHitFlash(this.player);
    }
};

PlayerController.prototype._updateDodgeUI = function () { 
    if (this.player && this.app.floatingUIManager && this.app.floatingUIManager.updateDodge) {
        this.app.floatingUIManager.updateDodge(this.player, this.currentDashCharges, this.maxDashCharges);
    }
};

PlayerController.prototype._chargeSuper = function (damage) {
    if (this._isTransformed && !this._allowsTransformSuper()) return;
    if (this.superCharge >= this.maxSuperCharge) return;
    this.superCharge = Math.min(this.superCharge + damage, this.maxSuperCharge);
};

PlayerController.prototype._executeSuper = function (angle, distance) {
    this.revealTimer = 2.5;
    this.app.fire('tutorial:super');
      
    var superConf = this._getTransformSuperConf();
    if (this._weaponProp) this._weaponProp.enabled = !superConf.hideWeaponProp;
    
    this._facingAngle = angle * (180 / Math.PI);
    var angleOffset = superConf.animAngleOffset || 0;
    this.player.setEulerAngles(0, this._facingAngle + angleOffset, 0);
    this._setAnimMirror(!!superConf.animMirror);

    var stepRange = superConf.autoStepRange !== undefined ? superConf.autoStepRange : 0;
    var whiffStep = superConf.whiffStep !== undefined ? superConf.whiffStep : 0; 
    
    var hasTarget = (this._lockedTargetEntity && this._lockedTargetEntity.parent && !this.isDead);
    
    // 🌟 解除大於 0 的限制，直接讀取 whiffStep
    var targetStepDist = (!this.isDead && whiffStep !== 0) ? whiffStep : 0;
    var stepAngle = angle; 
    
    var pPos = this.player.getPosition();

    if (stepRange > 0 && hasTarget) {
        var tx = this._lockedTargetEntity.getPosition().x;
        var tz = this._lockedTargetEntity.getPosition().z;
        var distToTarget = Math.sqrt((tx - pPos.x) * (tx - pPos.x) + (tz - pPos.z) * (tz - pPos.z));
        if (distToTarget > 1.5 && distToTarget <= stepRange + 1.5) {
            targetStepDist = distToTarget - 1.2; 
            stepAngle = Math.atan2(tx - pPos.x, tz - pPos.z);
        }
    }

    // 🌟 核心修正：支援大招的負數後座力
    if (Math.abs(targetStepDist) > 0.01) {
        var limitX = this.app.gameModeManager ? this.app.gameModeManager.mapLimitX : 11.5;
        var limitZ = this.app.gameModeManager ? this.app.gameModeManager.mapLimitZ : 10.0;
        var absDist = Math.abs(targetStepDist);
        var dirSign = targetStepDist > 0 ? 1 : -1;
        var stepSize = 0.2, curDist = 0, safeX = pPos.x, safeZ = pPos.z;
        
        while (curDist < absDist) {
            curDist += stepSize;
            if (curDist > absDist) curDist = absDist;
            var nx = pPos.x + Math.sin(stepAngle) * (curDist * dirSign);
            var nz = pPos.z + Math.cos(stepAngle) * (curDist * dirSign);
            
            if (nx > limitX || nx < -limitX || nz > limitZ || nz < -limitZ) break;
            if (this.app.combatManager && this.app.combatManager.checkCollision(nx, nz)) break;
            safeX = nx; safeZ = nz;
        }
        this._startWhiffStep(pPos.x, pPos.z, safeX, safeZ, superConf);
    }

    if (this.animEntity && this.animEntity.anim) this.animEntity.anim.setTrigger('superAttack');
    // 🌟 大招：呼叫刀光拖尾
    this.player.fire('trail:play', superConf);
    this.app.fire('network:shoot', { a: Number(angle.toFixed(2)), d: Number(distance.toFixed(2)), b: this.brawlerType, isSuper: true });

    if (superConf.type === 'super_transform') {
        this._isTransforming = true;
        this._attackAnimTimer = superConf.shootCooldown || 0.5;
    } else {
        this._attackAnimTimer = superConf.shootCooldown || 1.0;
    }
    if ((superConf.type === 'super_skyfall' || superConf.type === 'super_zhouyu_burst') &&
        this.app.combatManager && this.app.combatManager.estimateSkyfallLockDuration) {
        var pSkyLock = this.app.combatManager.estimateSkyfallLockDuration(superConf);
        this._attackAnimTimer = Math.max(this._attackAnimTimer, (superConf.fireDelay || 0) + pSkyLock);
    }

    var delay = superConf.fireDelay || 0;
    if (delay > 0) {
        this._attackQueue.push({
            timer: delay, config: superConf, angle: angle, distance: distance, isAutoAim: this._pendingIsAutoAim, isExtra: false, isSuper: true
        });
    } else {
        if (superConf.hitStopDuration) {
            this.hitStopTimer = superConf.hitStopDuration;
            if (this.animEntity && this.animEntity.anim) this.animEntity.anim.speed = 0;
        }
        this._spawnSuper(superConf, angle, distance);
    }

    if (superConf.extraAttacks && superConf.extraAttacks.length > 0) {
        for (var e = 0; e < superConf.extraAttacks.length; e++) {
            var extraAtk = superConf.extraAttacks[e];
            var safeExtraConf = Object.assign({}, superConf, extraAtk);
            safeExtraConf.isExtraBullet = true; 
            delete safeExtraConf.extraAttacks; 

            if (extraAtk.spreadCount === undefined) delete safeExtraConf.spreadCount;
            if (extraAtk.projectileCount === undefined) delete safeExtraConf.projectileCount;
            if (extraAtk.burstCount === undefined) delete safeExtraConf.burstCount;

            // 🌟 新增：阻斷控場與卡肉屬性的自動繼承！(除非 extraAtk 自己有寫)
            if (extraAtk.stunDuration === undefined) delete safeExtraConf.stunDuration;
            if (extraAtk.hitStopDuration === undefined) delete safeExtraConf.hitStopDuration;

            var extraDelay = extraAtk.fireDelay !== undefined ? extraAtk.fireDelay : delay;

            if (extraDelay > 0) {
                this._attackQueue.push({
                    timer: extraDelay, config: safeExtraConf, angle: angle, distance: distance, isAutoAim: this._pendingIsAutoAim, isExtra: true, isSuper: false 
                });
            } else {
                this._spawnExtraEffects([safeExtraConf], angle, distance);
            }
        }
    }
};

PlayerController.prototype._spawnSuper = function (superConf, angle, distance) {
    if (!this.player || this.isDead) return;

    var pPos = this.player.getPosition();

    var transformSuperConf = this._getTransformSuperConf();
    // 大招預設震一下；config 可覆寫 cameraShake（設 0 關閉）。變身大招改由落地處 fire，避免雙震
    var isTransformSuper = (superConf.type === 'super_transform') ||
        (transformSuperConf && transformSuperConf.type === 'super_transform');
    if (!isTransformSuper) {
        var shakePower = (superConf.cameraShake !== undefined && superConf.cameraShake !== null)
            ? superConf.cameraShake
            : 0.45;
        if (shakePower > 0) this.app.fire('camera:shake', shakePower);
    }

    if (transformSuperConf.type === 'super_transform') {
        var transformTarget = this._resolveTransformTarget(transformSuperConf);
        if (transformTarget) {
            this._isTransforming = false;
            this._transformToMecha(transformTarget);
            if (this.app.bulletManager && this.app.combatManager) {
                this.app.bulletManager._triggerExplosion({
                    entity: this.player, aoeTemplate: this.app.combatManager.aoeMap['lubu'],
                    explodeRadius: 3.0, explodeDamage: 0, ownerType: 'player', ownerId: 'player', ownerTeam: this.app.myTeam, config: this.config 
                });
                this.app.fire('camera:shake', 1.0); 
            }
        }
    }
    else if (superConf.type === 'super_liubei_tree') {
        if(this.app.combatManager) {
            this._tempVec1.set(pPos.x + Math.sin(angle) * 2, 0, pPos.z + Math.cos(angle) * 2);
            this.app.combatManager.executeSuperLiuBeiTree('player', 'player', this.app.myTeam, this.brawlerType, this._tempVec1, angle, superConf);
        }
    }
    else if (superConf.type === 'super_skyfall' || superConf.type === 'super_zhouyu_burst') {
        var lockEnt = this._lockedTargetEntity || null;
        if (this.app.combatManager && this.app.combatManager.beginSuperSkyfall) {
            this.app.combatManager.beginSuperSkyfall(
                'player', 'player', this.app.myTeam, this.brawlerType,
                pPos, angle, distance, superConf, lockEnt
            );
        }
    }
    else if (superConf.type === 'super_zhangfei_roar') {
        this._superBurstRemaining = superConf.burstCount || 5; 
        this._superBurstTimer = 0; 
        this._superBurstAngle = angle; 
    }
    else if (superConf.type === 'super_whirlwind') {
        this._superBurstRemaining = superConf.burstCount || 8;
        this._superBurstTimer = 0;
        this._superBurstAngle = angle; 
    }
    else if (superConf.type === 'super_decoy') {
        this._isStealth = true;
        this.stealthTimer = superConf.stealthDuration; 
        this.stealthSpeedMultiplier = superConf.speedMultiplier || 1.0;
        this.revealTimer = 0; 
        this._updateMaterialVisibility();
        if(this.app.combatManager) {
            this._decoyEntity = this.app.combatManager.spawnDecoy(this.app.myTeam, this.brawlerType, pPos, angle);
            this._decoyAnimEntity = this._findAnimEntity(this._decoyEntity) || this._decoyEntity;
            this._decoyDirX = Math.sin(angle); 
            this._decoyDirZ = Math.cos(angle);
        }
        this._decoyTimer = superConf.decoyLifetime; 
        this._decoyConfig = superConf;
        this._decoyOwnerSpeed = (this.config && this.config.speed) || 3.5;
    }
    else if (superConf.type === 'super_homing_bomb' || superConf.type === 'homing') {
        if (this.app.combatManager) {
            var sCount = superConf.spreadCount || superConf.projectileCount || 1;
            var sAngle = superConf.spreadAngle || 0;
            var tRad = sAngle * Math.PI / 180;
            
            for (var i = 0; i < sCount; i++) {
                var finalA = angle;
                var spawnX = pPos.x;
                var spawnZ = pPos.z;

                if (sCount > 1) {
                    finalA = angle - tRad / 2 + (tRad / (sCount - 1)) * i;
                    spawnX = pPos.x + Math.sin(finalA) * 0.5;
                    spawnZ = pPos.z + Math.cos(finalA) * 0.5;
                }
                this.app.combatManager.executeSuperHomingBomb('player', 'player', this.app.myTeam, this.brawlerType, {x: spawnX, z: spawnZ}, finalA, this.config);
            }
        }
    }
    else { 
        var mergedConf = Object.assign({}, this.config, superConf);
        mergedConf.isSuper = true;
        this._spawnProjectiles(mergedConf, angle, distance);
    }
};

PlayerController.prototype._prepareLobAttack = function(atkConf, angle, distance, useAutoAim) {
    var out = { conf: atkConf, angle: angle, distance: distance };
    var pType = atkConf.attackPattern || atkConf.type || 'normal';
    if (pType !== 'lob' || !this.app.combatManager || !this.app.combatManager.getLobRange) return out;

    var lobConf = Object.assign({}, atkConf);
    var lobRange = this.app.combatManager.getLobRange(lobConf);

    if (useAutoAim && this._lockedTargetEntity && this._lockedTargetEntity.parent && this.player) {
        var pPos = this.player.getPosition();
        var tPos = this._lockedTargetEntity.getPosition();
        lobConf.lobTargetX = tPos.x;
        lobConf.lobTargetZ = tPos.z;
        var dx = tPos.x - pPos.x;
        var dz = tPos.z - pPos.z;
        var dist = Math.sqrt(dx * dx + dz * dz);
        out.angle = Math.atan2(dx, dz);
        var clamped = pc.math.clamp(dist, lobRange.min, lobRange.max);
        out.distance = lobRange.max > lobRange.min
            ? (clamped - lobRange.min) / (lobRange.max - lobRange.min)
            : 1.0;
    }

    out.conf = lobConf;
    return out;
};

PlayerController.prototype._spawnProjectiles = function(atkConf, angle, distance) {
    if (!this.player || this.isDead) return;

    var lobPrep = this._prepareLobAttack(atkConf, angle, distance, this._pendingIsAutoAim);
    atkConf = lobPrep.conf;
    angle = lobPrep.angle;
    distance = lobPrep.distance;
    
    var pPos = this.player.getPosition();
    var pType = atkConf.attackPattern || atkConf.type || 'normal';
    var comboIdx = (this._procComboIndex !== undefined) ? this._procComboIndex : 0;

    if (pType === 'burst' || pType === 'flamethrower') {
        if (!atkConf.isExtraBullet) { 
            this._burstRemaining = atkConf.burstCount || 3;
            this._burstAngle = angle;
            this._burstDistance = distance;
            this._burstTimer = 0; 
            this._currentAttackConfig = atkConf; 
        }
    } 
    else if (pType === 'super_homing_bomb' || pType === 'homing') {
        var pCountHoming = atkConf.projectileCount || atkConf.spreadCount || 1; 
        var sAngleHoming = atkConf.spreadAngle || 0;
        var tRadHoming = sAngleHoming * Math.PI / 180;
        
        for (var h = 0; h < pCountHoming; h++) {
            var finalAHoming = angle;
            var spawnX = pPos.x;
            var spawnZ = pPos.z;

            if (pCountHoming > 1) {
                finalAHoming = angle - tRadHoming / 2 + (tRadHoming / (pCountHoming - 1)) * h;
                spawnX = pPos.x + Math.sin(finalAHoming) * 0.5;
                spawnZ = pPos.z + Math.cos(finalAHoming) * 0.5;
            }
            if (this.app.combatManager) {
                this.app.combatManager.executeSuperHomingBomb(
                    'player', 'player', this.app.myTeam, this.brawlerType, 
                    {x: spawnX, z: spawnZ}, finalAHoming, atkConf 
                );
            }
        }
    } 
    else {
        var pCount = atkConf.projectileCount || atkConf.spreadCount || 1; 
        var sAngle = atkConf.spreadAngle || 0;
        var tRad = sAngle * Math.PI / 180;
        
        for (var i = 0; i < pCount; i++) {
            var finalA = angle;
            if (pCount > 1) {
                finalA = (window.CombatResolver && CombatResolver.getSpreadAngle)
                    ? CombatResolver.getSpreadAngle(angle, sAngle, i, pCount)
                    : (angle - tRad / 2 + (tRad / (pCount - 1)) * i);
            }
            if (this.app.combatManager) {
                this.app.combatManager.fireProjectile(
                    'player', 'player', this.app.myTeam, this.brawlerType, 
                    pPos, finalA, pType, distance, atkConf, comboIdx
                );
            }
        }
    }

    if (!atkConf.isExtraBullet && !atkConf.isWordProc && window.CombatResolver && window.CombatResolver.tryFireBasicProcs) {
        var comboIdx = (this._procComboIndex !== undefined) ? this._procComboIndex : 0;
        if (atkConf.isSuper) comboIdx = -1;
        window.CombatResolver.tryFireBasicProcs(
            this.app, 'player', 'player', this.app.myTeam, this.brawlerType,
            atkConf, angle, distance, comboIdx
        );
    }
};

PlayerController.prototype._spawnExtraEffects = function(extraAttacks, angle, distance) {
    if (!extraAttacks || !Array.isArray(extraAttacks) || !this.player) return;
    
    var pPos = this.player.getPosition();
    var comboIdx = (this._procComboIndex !== undefined) ? this._procComboIndex : 0;

    for (var e = 0; e < extraAttacks.length; e++) {
        var conf = extraAttacks[e];
        var pType = conf.attackPattern || conf.type || 'normal';

        if (this.app.combatManager) {
            if (pType === 'super_homing_bomb' || pType === 'homing') {
                var pCountHoming = conf.projectileCount || conf.spreadCount || 1; 
                var sAngleHoming = conf.spreadAngle || 0;
                var tRadHoming = sAngleHoming * Math.PI / 180;
                
                for (var h = 0; h < pCountHoming; h++) {
                    var finalAHoming = angle;
                    var spawnX = pPos.x;
                    var spawnZ = pPos.z;

                    if (pCountHoming > 1) {
                        finalAHoming = angle - tRadHoming / 2 + (tRadHoming / (pCountHoming - 1)) * h;
                        spawnX = pPos.x + Math.sin(finalAHoming) * 0.5;
                        spawnZ = pPos.z + Math.cos(finalAHoming) * 0.5;
                    }
                    this.app.combatManager.executeSuperHomingBomb(
                        'player', 'player', this.app.myTeam, this.brawlerType, 
                        {x: spawnX, z: spawnZ}, finalAHoming, conf 
                    );
                }
            } 
            else {
                var pCount = conf.projectileCount || conf.spreadCount || 1; 
                var sAngle = conf.spreadAngle || 0;
                var tRad = sAngle * Math.PI / 180;
                
                for (var i = 0; i < pCount; i++) {
                    var finalA = angle;
                    if (pCount > 1) {
                        finalA = (window.CombatResolver && CombatResolver.getSpreadAngle)
                            ? CombatResolver.getSpreadAngle(angle, sAngle, i, pCount)
                            : (angle - tRad / 2 + (tRad / (pCount - 1)) * i);
                    }
                    this.app.combatManager.fireProjectile(
                        'player', 'player', this.app.myTeam, this.brawlerType, 
                        pPos, finalA, pType, distance, conf, comboIdx
                    );
                }
            }
        }
    }
};

// 🌟 啟動等速衝刺（windup → rushing → recover）
PlayerController.prototype._startRush = function(angle, rushCfg, atkConf) {
    this._rushDirX = Math.sin(angle);
    this._rushDirZ = Math.cos(angle);
    this._rushSpeed = rushCfg.rushSpeed || 10.0;
    this._rushDistance = rushCfg.rushDistance || 2.8;
    this._rushDistTraveled = 0;
    this._rushRecoverTime = rushCfg.recoverTime || 0;
    var windup = rushCfg.windupTime || 0;
    this._rushAfterimageConf = (typeof DashAfterimage !== 'undefined')
        ? DashAfterimage.confFromAtk(atkConf, this.config && this.config.color)
        : null;
    this._rushAfterimageTimer = 0;

    if (windup > 0) {
        this._rushState = 'windup';
        this._rushTimer = windup;
    } else {
        this._rushState = 'rushing';
        this._rushTimer = 0;
        this._stampRushAfterimage(true);
    }
};

PlayerController.prototype._stampRushAfterimage = function (force) {
    if (!this._rushAfterimageConf || typeof DashAfterimage === 'undefined') return;
    var src = this.animEntity || this.player;
    if (!src) return;
    if (force) {
        DashAfterimage.stamp(this.app, src, this._rushAfterimageConf);
        this._rushAfterimageTimer = 0;
    }
};

// 🌟 衝刺狀態機每幀更新（在 update 呼叫）
PlayerController.prototype._updateRush = function(dt) {
    if (this._rushState === 'none') return false;

    if (this._rushState === 'windup') {
        this._rushTimer -= dt;
        if (this._rushTimer <= 0) {
            this._rushState = 'rushing';
            this._stampRushAfterimage(true);
        }
        return true; // 前搖期間鎖定操作
    }

    if (this._rushState === 'rushing') {
        var moveStep = this._rushSpeed * dt;
        var pPos = this.player.getPosition();
        var nextX = pPos.x + this._rushDirX * moveStep;
        var nextZ = pPos.z + this._rushDirZ * moveStep;

        // 撞牆 / 邊界檢查
        var limitX = this.app.gameModeManager ? this.app.gameModeManager.mapLimitX : 11.5;
        var limitZ = this.app.gameModeManager ? this.app.gameModeManager.mapLimitZ : 10.0;
        var blocked = false;
        if (nextX > limitX || nextX < -limitX || nextZ > limitZ || nextZ < -limitZ) blocked = true;
        if (!blocked && this.app.combatManager && this.app.combatManager.checkCollision(nextX, nextZ)) blocked = true;

        if (blocked) {
            this._enterRushRecover();
            return true;
        }

        this.player.setPosition(nextX, 0, nextZ);
        this._rushDistTraveled += moveStep;

        if (this._rushAfterimageConf && typeof DashAfterimage !== 'undefined') {
            var src = this.animEntity || this.player;
            this._rushAfterimageTimer = DashAfterimage.accumulate(
                this.app, src, this._rushAfterimageConf, this._rushAfterimageTimer, dt
            );
        }

        if (this._rushDistTraveled >= this._rushDistance) {
            this._enterRushRecover();
        }
        return true; // 衝刺期間鎖定操作
    }

        if (this._rushState === 'recover') {
            this._rushTimer -= dt;
            if (this._rushTimer <= 0) {
                this._rushState = 'none';
                this._faceLockTimer = 0.12;   // 🌟 衝刺收尾,鎖面向 0.12 秒
                return false;
            }
            return true;
}

    return false;
};

PlayerController.prototype._hasAnyEnemyAlive = function() {
    if (!this.app || !this.app.botController || !this.app.botController.bots) return false;
    var myTeam = this.app.myTeam || 'blue';
    var bots = this.app.botController.bots;
    for (var i = 0; i < bots.length; i++) {
        var bot = bots[i];
        if (bot.state === 'alive' && bot.team !== myTeam) return true;
    }
    return false;
};

PlayerController.prototype._hasEnemyInCombatRange = function(range) {
    if (!this.player || !this.app) return false;
    var pPos = this.player.getPosition();
    var r2 = range * range;
    var bCtrl = this.app.botController;
    if (bCtrl && bCtrl.bots) {
        for (var i = 0; i < bCtrl.bots.length; i++) {
            var bot = bCtrl.bots[i];
            if (bot.state !== 'alive' || !bot.entity) continue;
            if (bot.team === (this.app.myTeam || 'blue')) continue;
            var bp = bot.entity.getPosition();
            var dx = bp.x - pPos.x;
            var dz = bp.z - pPos.z;
            if (dx * dx + dz * dz <= r2) return true;
        }
    }
    return false;
};

PlayerController.prototype._tickPoiseCharge = function(dt) {
    var stats = this._combatStats;
    if (!stats || !stats.poiseCharge) {
        this._poiseChargeSec = 0;
        return;
    }
    if (this.isDead || this.isDashing || (this._attackAnimTimer > 0)) return;
    var cfg = stats.poiseCharge;
    var canCharge = (cfg.requireNearEnemy === false)
        ? this._hasAnyEnemyAlive()
        : this._hasEnemyInCombatRange(cfg.combatRange || 10);
    if (!canCharge) return;
    this._poiseChargeSec = Math.min(cfg.maxSec || 1.5, (this._poiseChargeSec || 0) + dt);
};

PlayerController.prototype._consumePoiseIntoNextHit = function() {
    var stats = this._combatStats;
    if (!stats || !stats.poiseCharge) {
        this._poiseChargeSec = 0;
        return { armed: false, fullCharge: false };
    }
    var cfg = stats.poiseCharge;
    var sec = this._poiseChargeSec || 0;
    this._poiseChargeSec = 0;
    var soft = cfg.softSec || 0.4;
    var maxSec = cfg.maxSec || 1.5;
    if (sec <= soft) return { armed: false, fullCharge: false };
    var t = (sec - soft) / Math.max(0.01, maxSec - soft);
    if (t > 1) t = 1;
    var fullCharge = t >= 1;
    var bonus = (cfg.peakBonus || 0.28) * t;
    if (bonus > 0 && window.CombatResolver && window.CombatResolver.grantNextHitMod) {
        window.CombatResolver.grantNextHitMod(this, bonus, { source: 'poiseCharge' });
    }
    return { armed: bonus > 0, fullCharge: fullCharge };
};

PlayerController.prototype._enterRushRecover = function() {
    this._rushAfterimageConf = null;
    this._rushAfterimageTimer = 0;
    if (this._rushRecoverTime > 0) {
        this._rushState = 'recover';
        this._rushTimer = this._rushRecoverTime;
    } else {
        this._rushState = 'none';
        this._faceLockTimer = 0.12;   // 🌟 沒有後搖時也鎖一下面向
    }
};

PlayerController.prototype._executeAttack = function (angle, distance) {
    this.revealTimer = 2.5;
    var poiseResult = this._consumePoiseIntoNextHit();
    // 蓄勢滿層：有三段連擊的武將強制打出第三段；貂蟬等無連擊僅吃加傷
    var comboLen = (this.config && this.config.comboOverrides) ? this.config.comboOverrides.length : 0;
    if (poiseResult && poiseResult.fullCharge && comboLen >= 3) {
        this.comboIndex = 2;
    }
    if (window.CombatResolver && window.CombatResolver.markEmberProcAvailable) {
        window.CombatResolver.markEmberProcAvailable(this);
    }
     
    var stepIndex = this.comboIndex;
    var stepOverride = this.config.comboOverrides ? this.config.comboOverrides[stepIndex] : null;
    var atkConf = stepOverride ? Object.assign({}, this.config, stepOverride) : this.config;
    this._currentAttackConfig = atkConf; 
    if (this._weaponProp) this._weaponProp.enabled = !atkConf.hideWeaponProp;

    this._facingAngle = angle * (180 / Math.PI);
    var angleOffset = atkConf.animAngleOffset || 0;
    this.player.setEulerAngles(0, this._facingAngle + angleOffset, 0);
    this._setAnimMirror(!!atkConf.animMirror);

    // 🌟 等速衝刺：若該招有 rushConfig，啟動衝刺狀態機（取代 whiffStep 滑步）
    var rushCfg = atkConf.rushConfig;
    var usingRush = false;
    if (rushCfg && !this.isDead) {
        usingRush = true;
        this._startRush(angle, rushCfg, atkConf);
    }

    var stepRange = atkConf.autoStepRange !== undefined ? atkConf.autoStepRange : (this.config.autoStepRange || 0);
    var whiffStep = atkConf.whiffStep !== undefined ? atkConf.whiffStep : 0; 
    
    var hasTarget = (this._lockedTargetEntity && this._lockedTargetEntity.parent && !this.isDead);
    
    // 🌟 解除大於 0 的限制，直接讀取 whiffStep
    var targetStepDist = (!this.isDead && whiffStep !== 0) ? whiffStep : 0; 
    var stepAngle = angle; 
    
    var pPos = this.player.getPosition();

    if (stepRange > 0 && hasTarget) {
        var tx = this._lockedTargetEntity.getPosition().x;
        var tz = this._lockedTargetEntity.getPosition().z;
        var distToTarget = Math.sqrt((tx - pPos.x) * (tx - pPos.x) + (tz - pPos.z) * (tz - pPos.z));
        if (distToTarget > 1.5 && distToTarget <= stepRange + 1.5) {
            targetStepDist = distToTarget - 1.2; 
            stepAngle = Math.atan2(tx - pPos.x, tz - pPos.z);
        }
    }

    // 🌟 核心修正：改用 Math.abs 取絕對值，並用 sign 決定方向
    if (!usingRush && Math.abs(targetStepDist) > 0.01) {
        var limitX = this.app.gameModeManager ? this.app.gameModeManager.mapLimitX : 11.5;
        var limitZ = this.app.gameModeManager ? this.app.gameModeManager.mapLimitZ : 10.0;
        var absDist = Math.abs(targetStepDist);
        var dirSign = targetStepDist > 0 ? 1 : -1; // 判斷是往前還是後退
        var stepSize = 0.2, curDist = 0, safeX = pPos.x, safeZ = pPos.z;
        
        while (curDist < absDist) {
            curDist += stepSize;
            if (curDist > absDist) curDist = absDist;
            // 🌟 乘上 dirSign，如果是負數就會自動往反方向退
            var nx = pPos.x + Math.sin(stepAngle) * (curDist * dirSign);
            var nz = pPos.z + Math.cos(stepAngle) * (curDist * dirSign);
            
            if (nx > limitX || nx < -limitX || nz > limitZ || nz < -limitZ) break;
            if (this.app.combatManager && this.app.combatManager.checkCollision(nx, nz)) break;
            safeX = nx; safeZ = nz;
        }
        this._startWhiffStep(pPos.x, pPos.z, safeX, safeZ, atkConf);
    }

    this.ammo--;
    this.timeSinceLastAttack = 0; 
    this.isReloading = false;     
    this._updateAmmoUI();
    this._attackAnimTimer = atkConf.shootCooldown || 0.5;
    this.app.fire('tutorial:attack');

    var isAuto = this._pendingIsAutoAim; 

    var mainDelay = atkConf.fireDelay || 0;
    if (mainDelay > 0) {
        this._attackQueue.push({
            timer: mainDelay, config: atkConf, angle: angle, distance: distance, isAutoAim: isAuto, isExtra: false, isSuper: false, comboIndex: stepIndex
        });
    } else {
        if (atkConf.hitStopDuration) {
            this.hitStopTimer = atkConf.hitStopDuration;
            if (this.animEntity && this.animEntity.anim) this.animEntity.anim.speed = 0;
        }
        this._procComboIndex = stepIndex;
        this._spawnProjectiles(atkConf, angle, distance);
    }

    if (atkConf.extraAttacks && atkConf.extraAttacks.length > 0) {
        for (var e = 0; e < atkConf.extraAttacks.length; e++) {
            var extraAtk = atkConf.extraAttacks[e];
            var safeExtraConf = Object.assign({}, atkConf, extraAtk);
            safeExtraConf.isExtraBullet = true; 
            delete safeExtraConf.extraAttacks; 

            if (extraAtk.spreadCount === undefined) delete safeExtraConf.spreadCount;
            if (extraAtk.projectileCount === undefined) delete safeExtraConf.projectileCount;
            if (extraAtk.burstCount === undefined) delete safeExtraConf.burstCount;
            // 🌟 新增：阻斷控場與卡肉屬性的自動繼承！
            if (extraAtk.stunDuration === undefined) delete safeExtraConf.stunDuration;
            if (extraAtk.hitStopDuration === undefined) delete safeExtraConf.hitStopDuration;

            var extraDelay = extraAtk.fireDelay !== undefined ? extraAtk.fireDelay : mainDelay;

            if (extraDelay > 0) {
                this._attackQueue.push({
                    timer: extraDelay, config: safeExtraConf, angle: angle, distance: distance, isAutoAim: isAuto, isExtra: true, isSuper: false, comboIndex: stepIndex
                });
            } else {
                this._procComboIndex = stepIndex;
                this._spawnExtraEffects([safeExtraConf], angle, distance);
            }
        }
    }

    this.comboIndex++;
    this.lastAttackTime = 0; 
    var maxCombo = this.config.comboOverrides ? this.config.comboOverrides.length : 1; 
    if (this.comboIndex >= maxCombo) {
        this.comboIndex = 0;
    }

    if (this.animEntity && this.animEntity.anim) {
        this.animEntity.anim.setTrigger(atkConf.animTrigger || 'attack');
    }
    // 🌟 普攻：呼叫刀光拖尾 (1 行搞定)
    this.player.fire('trail:play', atkConf);

    this.app.fire('network:shoot', { 
        a: Number(angle.toFixed(2)), d: Number(distance.toFixed(2)), 
        b: this.brawlerType, cIdx: stepIndex 
    });
};

PlayerController.prototype._executeEmptyAmmoPunch = function (angle, distance) {
    if (!this.player || this.isDead) return;

    var punchConf = (window.BrawlerConfig && BrawlerConfig.getEmptyAmmoPunchConf)
        ? BrawlerConfig.getEmptyAmmoPunchConf(this.brawlerType)
        : {
            animTrigger: 'punch', bulletKey: 'punch_heavy', attackPattern: 'imelee',
            bulletDamage: 50, fireDelay: 0.12, shootCooldown: 0.38, isWordProc: true,
            hideWeaponProp: true, hitStopDuration: 0.06, cameraShake: 0.14
        };

    if (this._weaponProp) this._weaponProp.enabled = !punchConf.hideWeaponProp;

    this.revealTimer = 2.5;
    this._facingAngle = angle * (180 / Math.PI);
    this.player.setEulerAngles(0, this._facingAngle, 0);
    this._setAnimMirror(!!punchConf.animMirror);

    this._attackAnimTimer = punchConf.shootCooldown || 0.38;
    var isAuto = this._pendingIsAutoAim;
    var mainDelay = punchConf.fireDelay || 0;
    if (mainDelay > 0) {
        this._attackQueue.push({
            timer: mainDelay, config: punchConf, angle: angle, distance: distance,
            isAutoAim: isAuto, isExtra: false, isSuper: false, comboIndex: -1
        });
    } else {
        this._procComboIndex = -1;
        this._spawnProjectiles(punchConf, angle, distance);
    }

    if (this.animEntity && this.animEntity.anim) {
        this.animEntity.anim.setTrigger(punchConf.animTrigger || 'punch');
    }
    if (punchConf.useTrail !== false) {
        this.player.fire('trail:play', punchConf);
    }

    this.app.fire('network:shoot', {
        a: Number(angle.toFixed(2)),
        d: Number(distance.toFixed(2)),
        b: this.brawlerType,
        isEmptyPunch: true
    });
};

PlayerController.prototype._findAutoAimAngle = function () {
    if (this._lockedTargetEntity && this._lockedTargetEntity.parent) {
        var px = this.player.getPosition().x;
        var pz = this.player.getPosition().z;
        var tx = this._lockedTargetEntity.getPosition().x;
        var tz = this._lockedTargetEntity.getPosition().z;

        var atkConf = this._currentAttackConfig || this.config;
        var pattern = atkConf ? (atkConf.attackPattern || atkConf.type) : null;
        if (pattern !== 'melee' && pattern !== 'lob') {
            var bulletSpeed = (atkConf && atkConf.bulletSpeed) ? atkConf.bulletSpeed : 10;
            if (bulletSpeed > 0.1) {
                var dx = tx - px;
                var dz = tz - pz;
                var dist = Math.sqrt(dx * dx + dz * dz);
                var leadT = Math.min(dist / bulletSpeed, PlayerController.AUTO_AIM.LEAD_MAX_SEC);
                tx += this._lockVelX * leadT;
                tz += this._lockVelZ * leadT;
            }
        }

        return Math.atan2(tx - px, tz - pz);
    }
    return this._facingAngle * (Math.PI / 180);
};

PlayerController.prototype._onPlayerHit = function (damage, attackerId, isDeadFromServer, currentHp, hitMeta) {
    if (this.isDead) return;
    if (this.app.gameModeManager && this.app.gameModeManager.isRoundOver) return;
    hitMeta = hitMeta || {};
    var isHeal = damage < 0;
    // 結算後不再接受傷害（治療除外），避免慢動作期間死亡改寫分數
    if (!isHeal && this.app.gameModeManager && this.app.gameModeManager.isMatchOver) return;
    var isMultiplayer = !!(this.app.networkManager && this.app.networkManager.socket && this.app.networkManager.socket.connected);

    if (!isMultiplayer) {
        if (this._invincible && !isDeadFromServer && !isHeal) return;
    }

    if (attackerId && !isDeadFromServer) {
        var aTeam = 'none';
        if (attackerId === 'player') aTeam = this.app.myTeam;
        else if (this.app.scoreManager && this.app.scoreManager._scores[attackerId]) aTeam = this.app.scoreManager._scores[attackerId].team;
        if (aTeam === this.app.myTeam && aTeam !== 'none' && !isHeal) return;
    }

    hitMeta.attackerId = attackerId;
    hitMeta.attackerType = (attackerId === 'player') ? 'player' : 'bot';
    if (!isHeal && damage > 0 && window.CombatResolver && window.CombatResolver._getUnit) {
        var atkUnit = window.CombatResolver._getUnit(this.app, attackerId, hitMeta.attackerType);
        if (atkUnit && atkUnit.trueStrike) {
            hitMeta.trueStrike = true;
            hitMeta.ignoreDodge = true;
            hitMeta.pierceShield = true;
        }
    }

    if (!isHeal && damage > 0 && window.CombatResolver && window.CombatResolver.tryDodgeIncoming) {
        if (window.CombatResolver.tryDodgeIncoming(this.app, this, this.player, damage, hitMeta)) return;
    }

    var isComboFinish = hitMeta.isCrit || hitMeta.isCombo || false;
    var scaleMult = hitMeta ? hitMeta.scale : 1.0;
    var displayDamage = damage;

    if (!isHeal && damage > 0 && !hitMeta._combatResolved && window.CombatResolver && window.CombatResolver.resolveOutgoingHit) {
        var atkType = (attackerId === 'player') ? 'player' : 'bot';
        var resolved = window.CombatResolver.resolveOutgoingHit(this.app, attackerId, atkType, this, damage, hitMeta || {});
        damage = resolved.damage;
        displayDamage = resolved.displayDamage;
        hitMeta = resolved.hitMeta;
        hitMeta._combatResolved = true;
        isComboFinish = resolved.isCrit || isComboFinish;
        if (this.player && this.app.floatingUIManager && this.app.floatingUIManager.updateShield) {
            this.app.floatingUIManager.updateShield(this.player, this.shieldHP || 0, this.shieldMax || 0);
        }
    }

    if (!isHeal) {
        this.lastDamageTime = Date.now();
        this.revealTimer = 2.5;
        if (damage > 0 && attackerId) {
            this._tryEngageAttacker(attackerId);
        }
        
        if (this.player && !isDeadFromServer) {
            this._hitFlashTimer = 0.08; 
            
    var configFlinch = (hitMeta && hitMeta.flinchAmount !== undefined) ? hitMeta.flinchAmount : 0.15;
            
            if (configFlinch > 0) {
                // 🌟 改寫：觸發 Squash & Stretch 變形衝擊
                this._squashScale = configFlinch;
            }
        }
    }
    
    // 🌟 新增：接收微減速 (Micro-Snare) 參數
    if (hitMeta && hitMeta.snareDuration) {
        this.snareTimer = hitMeta.snareDuration;
        this.snareMultiplier = hitMeta.snareMultiplier !== undefined ? hitMeta.snareMultiplier : 0.6;
    }

    // 🚀 實體擊退 (Knockback / 吸力) - PlayerController 專屬版
        if (hitMeta && Math.abs(hitMeta.knockbackDist) > 0.01 && hitMeta.hitAngle !== undefined) {
            var targetPos = this.player.getPosition(); // 🌟 修正：玩家使用的是 this.player
            
            var limitX = this.app.gameModeManager ? this.app.gameModeManager.mapLimitX : 11.5;
            var limitZ = this.app.gameModeManager ? this.app.gameModeManager.mapLimitZ : 10.0;
            
            var absDist = Math.abs(hitMeta.knockbackDist);     
            var dirSign = hitMeta.knockbackDist > 0 ? 1 : -1;  
            
            var stepSize = 0.2, curDist = 0;
            var safeX = targetPos.x; var safeZ = targetPos.z;
            
            while (curDist < absDist) {
                curDist += stepSize;
                if (curDist > absDist) curDist = absDist;
                
                var nx = targetPos.x + Math.sin(hitMeta.hitAngle) * (curDist * dirSign);
                var nz = targetPos.z + Math.cos(hitMeta.hitAngle) * (curDist * dirSign);
                
                if (nx > limitX || nx < -limitX || nz > limitZ || nz < -limitZ) break;
                if (this.app.combatManager && this.app.combatManager.checkCollision(nx, nz)) break;
                safeX = nx; safeZ = nz;
            }
            
            // 🌟 修正：玩家狀態變數使用 this
            this._kbTargetX = safeX; 
            this._kbTargetZ = safeZ;
            this._kbTimer = 0.15;    
        }

    // 🌟 暈眩攔截：中斷所有行動
    // Rogue：玩家仍可被暈（維持風險），僅敵軍在 BotController 內做「護盾免暈」
    if (hitMeta && (hitMeta.stunDuration || hitMeta.snareDuration)) {
        if (window.CombatResolver && window.CombatResolver.onCrowdControlApplied) {
            window.CombatResolver.onCrowdControlApplied(this.app, this, {
                stunDuration: hitMeta.stunDuration || 0,
                snareDuration: hitMeta.snareDuration || 0,
                snareMultiplier: hitMeta.snareMultiplier
            });
        }
    }
    if (hitMeta && hitMeta.stunDuration) {
        this.stunTimer = Math.max(this.stunTimer || 0, hitMeta.stunDuration);
        this._initialStunDuration = hitMeta.stunDuration; // 🌟 記下這招本來暈多久
        this._broadcastState();   // 🌟 暈眩狀態即時廣播

        this._attackQueue = [];
        this._attackAnimTimer = 0;
        this._setAnimMirror(false);
        // 🌟 暈眩瞬間，強制收起刀光
        this.player.fire('trail:interrupt');
        this.isDashing = false;
        this._dashTimer = 0;
        this._burstRemaining = 0;
        this._superBurstRemaining = 0;
        if (this._weaponProp) this._weaponProp.enabled = false;
        
        // 🌟 徹底重置動畫與變身標記
        this._isTransforming = false;
        this.comboIndex = 0;
        this._resetAnimationState();
    }

    if (!isHeal && damage > 0 && window.CombatResolver && window.CombatResolver.getEffectiveDamageTakenMul) {
        damage *= window.CombatResolver.getEffectiveDamageTakenMul(this);
    }

    if (!isHeal && damage > 0 && this._rogueBuffMults && this._rogueBuffMults.damageTakenMul) {
        damage *= this._rogueBuffMults.damageTakenMul;
    }

    if (currentHp !== undefined) this.health = currentHp;
    else if (isDeadFromServer) this.health = 0;
    else {
        this.health -= damage;
        this.health = Math.min(this.health, this.maxHealth);
        if (!isHeal && damage > 0 && window.CombatResolver && window.CombatResolver.tryLifestealHeal) {
            window.CombatResolver.tryLifestealHeal(this.app, attackerId, hitMeta.attackerType, damage, hitMeta);
        }
    }

    if (this.health <= 0 || isDeadFromServer) {
        if (this._isTransformed && this.config && this.config.isMecha) {
            this.health = 0;
            this._revertTransform();
        } else {
            this._die(attackerId);
        }
    } else {
        if (this.player && !isDeadFromServer) { 
            if (!isHeal) {
                var isTrueCrit = !!(hitMeta && hitMeta.isCrit);
                this.app.fire('ui:floatingDamage', this.player.getPosition(), displayDamage, isComboFinish, null, scaleMult, isTrueCrit);
                if (this.app.combatManager) this.app.combatManager.applyHitFlash(this.player);
            }
        }
    }
    this._updatePlayerHealthBar();
};

PlayerController.prototype._updatePlayerHealthBar = function () {
    if (!this.player || !this.app.floatingUIManager) return;
    var fum = this.app.floatingUIManager;
    if (fum.updateMaxHealth) fum.updateMaxHealth(this.player, this.maxHealth);
    fum.updateHealth(this.player, this.health);
    if (fum.updateShield) fum.updateShield(this.player, this.shieldHP || 0, this.shieldMax || 0);
};

PlayerController.prototype._die = function (attackerId) {
    this.isDead = true;
    this.health = 0;
    try { this.app.fire('sfx:death'); } catch (eSfx) { /* ignore */ }

    this._attackAnimTimer = 0;
    this._setAnimMirror(false);
    this.player.fire('trail:interrupt');
    if (this._weaponProp) this._weaponProp.enabled = false; 
    // Death visual: freeze + gray → vanish (no sink / no death anim).
    // Apply gray LAST so later cleanup in this function cannot wipe it;
    // update() also re-applies while dead.
    if (this._deathVanishTimer === undefined || this._deathVanishTimer <= 0) {
        this._deathVanishTimer = 0.8;
        this._deathVanishTotal = 0.8;
        this._hitFlashTimer = 0;
        if (this.animEntity && this.animEntity.anim) {
            this.animEntity.anim.setFloat('speed', 0);
            this.animEntity.anim.speed = 0;
        }
    }
    // Keep enabled until the vanish timer ends.
    this.deaths++;
    
    this._attackQueue = []; 
    this.activeStates = {}; 
    this._pendingIsAutoAim = false;

    if (this.gemCount > 0) {
        // 結算後死亡不掉寶、不改寫隊伍寶石分
        if (this.app.gameModeManager && this.app.gameModeManager.isMatchOver) {
            this.gemCount = 0;
            if (this.app.floatingUIManager && this.app.floatingUIManager.updateGems) this.app.floatingUIManager.updateGems(this.player, 0);
        } else {
            var pPos = this.player.getPosition();
            this.app.fire('bounty:dropGems', this.gemCount, pPos.x, pPos.z);
            this.gemCount = 0;
            if (this.app.floatingUIManager && this.app.floatingUIManager.updateGems) this.app.floatingUIManager.updateGems(this.player, 0);
            var blueTotal = 0; var redTotal = 0;
            
            var botCtrl = this._getBotCtrl();
            if (botCtrl) {
                var bots = botCtrl.bots;
                for (var i = 0; i < bots.length; i++) {
                    if (bots[i].gemCount) {
                        if (bots[i].team === 'blue') blueTotal += bots[i].gemCount;
                        else if (bots[i].team === 'red') redTotal += bots[i].gemCount;
                    }
                }
            }
            this.app.fire('bounty:updateTeamGems', blueTotal, redTotal);
        }
    }
    
    this._isStealth = false; 
    this.stealthTimer = 0; 
    this.stealthSpeedMultiplier = 1.0; 
    // 不要 _restoreMaterial：會蓋掉死亡 gray
    this._isTransforming = false; 
    if (this._isTransformed || this._originalBrawlerType || this._isTransformVariantType(this.brawlerType)) {
        this._resetToBaseForm();
    }
    
    if (this.app.inputManager && this.app.inputManager.attackCommand) {
        this.app.inputManager.attackCommand = null;
    }

    if (this.app.combatManager && this.app.combatManager.applyDeathGray) {
        this.app.combatManager.applyDeathGray(this.player);
    }

    if (this.app.gameMode === '3V3_KNOCKOUT') {
        this.respawnTimer = Infinity;
        if (this.deathMessage) { 
            this.deathMessage.enabled = true;
            this.deathMessage.element.text = this.t('hud.respawn.wait'); 
        }
    } else if (this.app.gameMode === 'FFA') {
        // 🌟 FFA 單命：不重生。彈出選擇 UI（立刻結算 / 觀戰到結束）
        this.respawnTimer = Infinity;
        if (this.deathMessage) this.deathMessage.enabled = false;   
        this._showFFADeathChoice();
    } else {
        this.respawnTimer = this.respawnTime;
        if (this.deathMessage) { 
            this.deathMessage.enabled = true;
            this.deathMessage.element.text = this.t('hud.respawning'); 
        }
    }

    var isMultiplayer = !!(this.app.networkManager && this.app.networkManager.socket && this.app.networkManager.socket.connected);
    if (!isMultiplayer) {
        if (attackerId) this.app.fire('score:kill', { attackerId: attackerId, victimId: 'player' });
        this.app.fire('score:death', 'player');
        this.app.fire('game:killFeed', attackerId || 'Unknown', 'player');
    }
};

PlayerController.prototype._resetToAlive = function () {
    this.isDead = false; 
    this._deathVanishTimer = 0;
    this.health = this.maxHealth;
    this.ammo = this.maxAmmo; 
    this.reloadTimer = 0; 
    this.timeSinceLastAttack = 0;
    this.isReloading = false;
    this._burstRemaining = 0; 
    this._superBurstRemaining = 0;
    
    this._attackQueue = []; 
    this.activeStates = {}; 
    this._pendingIsAutoAim = false;
    this.stunTimer = 0;
    
    if (this._weaponProp) this._weaponProp.enabled = false;

    this._isTransformed = false;

    // 不在此清誘餌：已放出的 decoy 應跑完爆炸（重生／復活不中斷）
    
    this._isStealth = false;
    this.stealthTimer = 0;
    this.stealthSpeedMultiplier = 1.0;
    this._autoStepTimer = 0;
    this.hitStopTimer = 0; 
    this._dashTimer = 0;
    this.isDashing = false; 
    this._isTransforming = false;
    this._attackAnimTimer = 0; 
    this._setAnimMirror(false);
    
    if (this.animEntity) this.animEntity.setLocalPosition(0, 0, 0);

    this.currentDashCharges = this.maxDashCharges;
    this.dashRechargeTimer = 0; 
    this.comboIndex = 0;
    this.gemCount = 0;
};

PlayerController.prototype._showFFADeathChoice = function () {
    var self = this;
    var old = document.getElementById('ffa-death-choice');
    if (old) old.remove();

    var overlay = document.createElement('div');
    overlay.id = 'ffa-death-choice';
    overlay.setAttribute('data-ui-interactive', '');
    overlay.style.cssText = 'position:fixed;left:50%;bottom:14%;transform:translateX(-50%);z-index:6000;' +
        'display:flex;flex-direction:column;align-items:center;gap:14px;font-family:"Anton","Microsoft JhengHei",sans-serif;';

    var title = document.createElement('div');
    title.innerText = 'FALLEN';
    title.style.cssText = 'color:#f0e6d2;font-size:26px;letter-spacing:2px;' +
        'text-shadow:2px 2px 0 #000,0 4px 12px rgba(0,0,0,0.8);';
    overlay.appendChild(title);

    var btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:14px;';

    var mkBtn = function(label, bg, fn) {
        var b = document.createElement('button');
        b.innerText = label;
        b.style.cssText = 'padding:14px 28px;border:none;border-radius:10px;font-size:18px;' +
            'font-family:"Microsoft JhengHei";cursor:pointer;color:#fff;background:' + bg + ';' +
            'box-shadow:0 4px 14px rgba(0,0,0,0.5);';
        window.UiTouch.bindTap(b, function(e) {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            fn();
        });
        btnRow.appendChild(b);
        return b;
    };

    // 立刻結算：依目前情況進結算畫面
    mkBtn(this.t('hud.ffa.retreat'), 'linear-gradient(180deg,#c9a25a,#8a6d2f)', function() {
        overlay.remove();
        if (self.app.scoreManager && self.app.scoreManager.endGame) {
            self.app.scoreManager.endGame(true);
        }
    });

    // 觀戰到結束：留場看，等遊戲自然結束
    mkBtn(this.t('hud.ffa.spectate'), 'linear-gradient(180deg,#3a4a5a,#222e38)', function() {
        overlay.remove();
        if (self.deathMessage) {
            self.deathMessage.enabled = true;
            self.deathMessage.element.text = self.t('hud.ffa.spectating');
        }
    });

    overlay.appendChild(btnRow);
    window.UiTouch.markRoot(overlay);
    document.body.appendChild(overlay);
};

PlayerController.prototype._respawn = function () {
    var deathPos = this.player.getPosition();
    console.log('[重生診斷] 死亡位置 x=' + deathPos.x.toFixed(1) + ' z=' + deathPos.z.toFixed(1) + ' | mode=' + this.app.gameMode + ' | myTeam=' + this.app.myTeam + ' | slot=' + this.app.mySlot);

    this._resetToAlive();
    this._resetToBaseForm();
    this.maxHealth = this.config.health;
    if (this.app.wordSystem && this.app.wordSystem.syncArmyCombatStats && this.app.rogueDirector) {
        this.app.wordSystem.syncArmyCombatStats(this.app.rogueDirector, true);
    }
    this.health = this.maxHealth;
    this.ammo = this.maxAmmo;

    var slot = (this.app.mySlot !== undefined) ? this.app.mySlot : 1;
    var spawnPos = { x: 0, z: 0 };
    if (this.app.gameModeManager) {
        spawnPos = this.app.gameModeManager.getSafeSpawnPoint(this.app.myTeam, slot);
    }
    console.log('[重生診斷] 算出的spawn點 x=' + spawnPos.x.toFixed(1) + ' z=' + spawnPos.z.toFixed(1));

    this._spawnPlayer(spawnPos.x, spawnPos.z);
    this._setupAliveState(spawnPos.x, spawnPos.z);

    this.app.fire('network:respawn', { x: spawnPos.x, z: spawnPos.z });
};

PlayerController.prototype._onRoundStart = function () {
    if (this.app.gameMode !== '3V3_KNOCKOUT') return;

    if (this._isTransformed || this._originalBrawlerType) {
        this._resetToBaseForm();
    }

    this._resetToAlive();
    this._spawnPlayer();
    
    this.app.fire('game:introStart'); 
};

PlayerController.prototype._onBotKilled = function () { 
    this.kills++; 
};

PlayerController.prototype._updateAmmoUI = function () { 
    if (this.player && this.app.floatingUIManager && this.app.floatingUIManager.updateAmmo) {
        this.app.floatingUIManager.updateAmmo(this.player, this.ammo, this.maxAmmo, this.isReloading);
    }
};

PlayerController.prototype._createTeamRing = function() {
    var ring = new pc.Entity('TeamRing_Player');
    ring.addComponent('render', { type: 'plane', castShadows: false, receiveShadows: false });
    ring.setLocalScale(1.8, 1, 1.8); 
    ring.setLocalPosition(0, 0.05, 0);
    if (this.app.combatManager && this.app.combatManager._teamRingMats) {
        ring.render.meshInstances[0].material = this.app.combatManager._teamRingMats.ally;
    }
    this.player.addChild(ring);
};

PlayerController.prototype._resetAnimationState = function () {
   if (!this.animEntity || !this.animEntity.anim || !this.player) return;
    
    var anim = this.animEntity.anim;
    anim.setFloat('speed', 0);
    anim.speed = 1.0; 
    
    if (anim.parameters) {
        for (var pName in anim.parameters) {
            if (anim.parameters[pName].type === pc.ANIM_PARAMETER_TRIGGER) {
                anim.resetTrigger(pName);
            }
        }
    }

    if (anim.layers) {
        for (var l = 0; l < anim.layers.length; l++) {
            var layer = anim.layers[l];
            
            if (layer.name === 'Shoot') {
                layer.weight = 0.0;
            }
            
            var targetState = layer.initialState;
            if (targetState && 
                layer.activeState !== targetState && 
                layer.activeState !== 'START') {
                layer.transition(targetState, 0);
            }
        }
    }
};

PlayerController.prototype.updateGemCount = function (newCount) {
    if (this.isDead) return;
    this.gemCount = newCount;
    this._updateGemUI();
};

PlayerController.prototype._updateGemUI = function () {
    if (this.player && this.app.floatingUIManager && this.app.floatingUIManager.updateGems) {
        this.app.floatingUIManager.updateGems(this.player, this.gemCount);
    }
};

PlayerController.prototype._createSuperRing = function() {
    var ring = new pc.Entity('SuperRing_Player');
    ring.addComponent('render', { type: 'plane', castShadows: false, receiveShadows: false });
    ring.setLocalScale(2.2, 1, 2.2); 
    ring.setLocalPosition(0, 0.06, 0); 
    this.superRingCanvas = document.createElement('canvas');
    this.superRingCanvas.width = 256; 
    this.superRingCanvas.height = 256; 
    this.superRingCtx = this.superRingCanvas.getContext('2d');
    this.superRingCtx.clearRect(0, 0, 256, 256); 
    this.superRingCtx.beginPath();
    this.superRingCtx.arc(128, 128, 110, 0, 2 * Math.PI); 
    this.superRingCtx.lineWidth = 14; 
    this.superRingCtx.strokeStyle = 'rgba(100, 100, 100, 0.8)'; 
    this.superRingCtx.stroke();
    this.superRingTex = new pc.Texture(this.app.graphicsDevice, { format: pc.PIXELFORMAT_R8_G8_B8_A8, autoMipmap: false }); 
    this.superRingTex.setSource(this.superRingCanvas);
    var mat = new pc.StandardMaterial(); 
    mat.opacityMap = this.superRingTex;
    mat.opacityMapChannel = 'a'; 
    mat.emissiveMap = this.superRingTex;
    mat.emissive = new pc.Color(1.0, 1.0, 1.0); 
    mat.emissiveIntensity = 2.0; 
    mat.blendType = pc.BLEND_NORMAL;
    mat.depthWrite = false; 
    mat.useLighting = false; 
    mat.update();
    ring.render.meshInstances[0].material = mat; 
    this.player.addChild(ring);
    this.superRingMat = mat; 
    this.superRingEntity = ring; 
    this._lastRenderedSuperCharge = -1;
};