//New BotController V3 (Perfected Version with Squash, Snare, Separation & Knockback)

var BotController = pc.createScript('botController');

BotController.attributes.add('invincibleTime', { type: 'number', default: 3, title: '無敵閃爍時間 (秒)' });
BotController.attributes.add('allyLeashRadius', { type: 'number', default: 8, title: 'ROGUE 友軍韁繩半徑' });
BotController.attributes.add('allyFollowRadius', { type: 'number', default: 3.5, title: 'ROGUE 友軍跟隨半徑' });

// Rogue 友軍卡死脫困：同 XZ 停滯超過此秒數 → 傳玩家附近
BotController.ALLY_UNSTUCK_SEC = 15;
BotController.ALLY_UNSTUCK_EPS = 0.2;

var CHARACTER_MAP = {
    guanyu:   { type: 'guanyu',   name: 'GuanYu' }, 
    zhangjiao: { type: 'zhangjiao', name: 'ZhangJiao' },
    zhangliao: { type: 'zhangliao', name: 'ZhangLiao' },
    caocao:   { type: 'caocao',   name: 'CaoCao' }, 
    zhouyu:   { type: 'zhouyu',   name: 'ZhouYu' },
    sunquan:  { type: 'sunquan',  name: 'SunQuan' },
    lubu:     { type: 'lubu',     name: 'LuBu' },   
    zhangfei: { type: 'zhangfei', name: 'ZhangFei' },
    diaochan: { type: 'diaochan', name: 'DiaoChan' }, 
    liubei:   { type: 'liubei',   name: 'LiuBei' } 
};

function _getZhBrawlerName(bType, app) {
    if (window.BrawlerConfig && window.BrawlerConfig.getDisplayName) {
        return window.BrawlerConfig.getDisplayName(bType);
    }
    if (window.BrawlerConfig && window.BrawlerConfig.getDisplayZh) {
        return window.BrawlerConfig.getDisplayZh(bType);
    }
    if (app && app.scoreManager && app.scoreManager.getBrawlerZhName) {
        return app.scoreManager.getBrawlerZhName(bType);
    }
    var cfg = window.BrawlerConfig && window.BrawlerConfig[bType];
    if (cfg && cfg.displayZh) return cfg.displayZh;
    if (cfg && cfg.select && cfg.select.zh) return cfg.select.zh;
    if (cfg && cfg.name) return cfg.name;
    return bType;
}

function _getBotArenaName(bType, app) {
    if (app && app.scoreManager && app.scoreManager.getBotArenaName) {
        return app.scoreManager.getBotArenaName(bType);
    }
    if (BOT_ARENA_NAMES_FALLBACK[bType]) return BOT_ARENA_NAMES_FALLBACK[bType];
    return CHARACTER_MAP[bType] ? CHARACTER_MAP[bType].name : 'Bot';
}

var BOT_ARENA_NAMES_FALLBACK = {
    lubu: '奉先弒天',
    guanyu: '武聖弒神',
    caocao: '魔王孟德',
    zhangliao: '文遠夜襲',
    zhangjiao: '黃天業火',
    zhouyu: '臥龍幽冥',
    zhangfei: '萬人敵狂',
    diaochan: '閉月傾城',
    liubei: '仁德昭烈'
};

// 友軍／關卡武將 AI 職能（移動與韁繩；索敵仍為最近敵人）
var ALLY_ROLE_PROFILES = {
    vanguard:  { leash: 22, follow: 3.5, retreatHp: 0.32 },
    guardian:  { leash: 6,  follow: 3.0, retreatHp: 0.32 },
    tactician: { leash: 10, follow: 4.0, retreatHp: 0.32, kiteMin: 0.85 }
};

BotController.prototype.initialize = function () {
    this.bots = []; 
    this.decoys = []; 
    this.isActive = false;

    this._targetResult = { position: null, distance: Infinity }; 
    this._gemResult = { position: null, distance: Infinity };
    this._healColor = new pc.Color(0, 1, 0, 1);                  
    this._tempVec3 = new pc.Vec3();
    this._gemTargetPos = new pc.Vec3();

    this.app.on('game:start', function(data) {
        var normMode = (data && data.mode) ? String(data.mode).toUpperCase().replace(/\s+/g,'_') : 'FFA';
        if (normMode === 'ARMY_6V6' || normMode === 'ARMY6V6' || normMode === 'ARMY') normMode = 'ARMY_6V6';
        var isArmy = normMode === 'ARMY_6V6';
        if (isArmy) {
            // Army modda her zaman AI NPC'ler lazım (online/offline fark etmez) — sadece liderler network
            this.isActive = true;
            var selfArmy = this;
            setTimeout(function() {
                selfArmy._spawnArmyBots(data);
            }, 60);
            return;
        }
        if (data && data.isMultiplayer) { 
            this.isActive = false; 
            this._cleanup(); 
        } 
        else { 
            this.isActive = true; 
            var self = this; 
            setTimeout(function() { 
                self._spawnBots(data ? data.mode : 'FFA'); 
            }, 50); 
        }
    }, this);

    this.app.on('lobby:matchFound', function(data) {
        var m = data && data.mode ? String(data.mode).toUpperCase().replace(/\s+/g,'_') : '';
        if (m === 'ARMY6V6' || m === 'ARMY_6V6' || m === 'ARMY' || m === '6V6') m = 'ARMY_6V6';
        if (m === 'ARMY_6V6') {
            // Army modda lobiden sonra da botlar kalacak — cleanup yapma
            return;
        }
        this.isActive = false; 
        this._cleanup(); 
    }, this);
    
    this.app.on('enemy:hit', function(data) {
        if (!this.isActive) return;
        var botIdx = this.bots.findIndex(function(b) { return b.id === data.targetId || b.entity.name === data.targetId; });
        if (botIdx !== -1) { 
            this.hitBot(botIdx, data.damage, 'player'); 
            this.app.fire('score:damage', 'player', data.damage); 
            return; 
        }
    }, this);

    this.app.on('round:start', this._onRoundStart, this);
    this.app.on('pve:startWave', this._onPVEWaveStart, this);
    this.app.on('network:fullStateSync', this._onFullStateSync, this);
    
    this.app.botController = this;

    this.on('destroy', function() {
        this.app.off('network:fullStateSync', this._onFullStateSync, this);
    }, this);
};

BotController.prototype._onFullStateSync = function(data) {
    if (!this.isActive || !data || !data.bots) return;

    for (var i = 0; i < this.bots.length; i++) {
        var bot = this.bots[i];
        var snapshot = data.bots[bot.id];
        
        if (snapshot) {
            bot.health = snapshot.hp;
            
            if (this.app.floatingUIManager) {
                this.app.floatingUIManager.updateHealth(bot.entity, bot.health);
            }
            
            var isMechaTransformed = bot._isTransformed && bot.config && bot.config.isMecha;
            if (bot.health <= 0 && bot.state !== 'dead' && !isMechaTransformed) {
                this._beginDeathVanish(bot, false);
            } else if (bot.health > 0 && bot.state === 'dead') {
                bot.state = 'alive';
                bot._pendingDestroy = false;
                bot._deathVanishTimer = 0;
                if (!bot.entity.enabled) bot.entity.enabled = true;
                if (bot.animEntity && bot.animEntity.anim) {
                    bot.animEntity.anim.speed = 1.0;
                }
                if (this.app.combatManager && this.app.combatManager.clearDeathVisual) {
                    this.app.combatManager.clearDeathVisual(bot.entity);
                }
            }
        }
    }
};

BotController.prototype._findAnimEntity = function(node) {
    if (node.anim) return node;
    for (var i = 0; i < node.children.length; i++) {
        var res = this._findAnimEntity(node.children[i]);
        if (res) return res;
    }
    return null;
};

BotController.prototype._cleanup = function () {
    for (var i = 0; i < this.bots.length; i++) {
        this._clearBotTargetMarker(this.bots[i]);
        if (this.bots[i].decoyEntity) {
            if (this.app.floatingUIManager) this.app.floatingUIManager.removeUI(this.bots[i].decoyEntity);
            this.bots[i].decoyEntity.destroy();
        }
        if (this.bots[i].entity) {
            if (this.app.floatingUIManager) this.app.floatingUIManager.removeUI(this.bots[i].entity);
            this.bots[i].entity.destroy();
        }
    }
    this.bots = [];
};

BotController.prototype._resetBotAnimation = function (bot) {
    if (!bot || !bot.animEntity || !bot.animEntity.anim) return;
    bot.animEntity.anim.setFloat('speed', 0);
    bot.animEntity.anim.speed = 1.0;
    
    if (bot.animEntity.anim.layers) {
        for (var l = 0; l < bot.animEntity.anim.layers.length; l++) {
            var layer = bot.animEntity.anim.layers[l];
            if (layer.name === 'Shoot') {
                layer.weight = 0.0;
            }
        }
    }
    
    if (bot.animEntity.anim.baseLayer) {
        var baseLayer = bot.animEntity.anim.baseLayer;
        var defaultState = baseLayer.initialState;
        if (defaultState && baseLayer.activeState !== defaultState) {
            baseLayer.transition(defaultState, 0);
        }
    }
};

BotController.prototype._createBotData = function(entity, animNode, bType, config, i, botName, assignedTeam, spawnIdx) {
    var wp = entity.find(function(n) { return n.name === 'WeaponProp'; });
    if (wp) wp.enabled = false;

    return {
        entity: entity, 
        animEntity: animNode, 
        brawlerType: bType, 
        config: config, 
        health: config.health, 
        maxHealth: config.health, 
        lastDamageTime: Date.now(),
        state: 'alive', 
        id: (spawnIdx === undefined) ? ('pve_bot_' + i) : ('bot_' + i), 
        name: botName, 
        team: assignedTeam, 
        slot: (spawnIdx === undefined) ? i : spawnIdx, 
        gemCount: 0, 
        moveDir: new pc.Vec2(Math.random() - 0.5, Math.random() - 0.5).normalize(),
        moveTimer: 0, 
        changeDirInterval: 1.5 + Math.random() * 2, 
        shootTimer: 1.0 + (spawnIdx !== undefined ? Math.random() * (config.shootCooldown || 0.5) * 2 : 0),
        _nextBasicAttackAt: 0, // ROGUE attackEvery 節流：下一次允許普攻的時間點(ms)
        aimAngle: 0, 
        _targetScanTimer: 0,      // 🌟 索敵降頻計時器
        _cachedTarget: null,      // 🌟 快取的最近戰鬥目標
        _cachedGem: null,         // 🌟 Bounty：撿寶石移動目標（不進戰鬥瞄準）
        ammo: config.ammo, 
        timeSinceLastAttack: 0, 
        stunTimer: 0,
        _initialStunDuration: 0,
        _pvpThreatTimer: 0,
        _deathVanishTimer: 0,
        _deathVanishTotal: 0,
        
        // 🌟 形變 (Squash) 與微減速 (Snare) 變數
        _squashScale: 0,
        _squashVelocity: 0,
        _baseAnimScale: animNode.getLocalScale().clone(), // 快取原本的模型比例
        _animMirrorSign: 1,
        snareTimer: 0,
        snareMultiplier: 1.0,
        shieldHP: 0,
        shieldMax: 0,
        shieldMaxPct: 0,
        _combatStats: null,
        _wordKillDmgStacks: 0,
        _auraDamageTakenMul: 1,

        isReloading: false,     
        
        attackQueue: [],
        activeStates: {},
        weaponProps: wp, 
        
        comboIndex: 0,
        lastAttackTime: 0,
        comboResetTime: 2.0,
        
        attackAnimTimer: 0,
        hitStopTimer: 0,
        dashCharges: 2,
        dashRechargeTimer: 0,

        // 🌟 通用等速衝刺狀態機（與 PlayerController 同步：rushConfig 驅動）
        _rushState: 'none',
        _rushTimer: 0,
        _rushDirX: 0,
        _rushDirZ: 0,
        _rushSpeed: 0,
        _rushDistTraveled: 0,
        _rushDistance: 0,
        _rushRecoverTime: 0,
        _rushAfterimageConf: null,
        _rushAfterimageTimer: 0,
        _faceLockTimer: 0,   // 🌟 衝刺收尾鎖面向緩衝（與 PlayerController 同步）

        burstRemaining: 0, 
        burstTimer: 0, 
        flashTimer: 0, 
        invincibleTimer: (spawnIdx === undefined) ? 1.0 : this.invincibleTime, 
        
        superTimer: (spawnIdx === undefined) ? 999 : (10 + Math.random() * 10), 
        superBurstRemaining: 0, 
        superBurstTimer: 0, 
        superBurstAngle: 0, 
        superCenter: { x:0, z:0 },
        
        decoyEntity: null, 
        decoyAnimEntity: null, 
        decoyTimer: 0, 
        decoyConfig: null, 

        _dashTargetZ: 0,
        
        // 🚀 實體擊退狀態變數
        _kbTimer: 0,
        _kbTargetX: 0,
        _kbTargetZ: 0, 
        
        wallAvoidTimer: 0,
        wallAvoidAngle: 0,

        isStealth: false, 
        stealthTimer: 0,
        decoyDirX: 0, 
        decoyDirZ: 0, 
        revealTimer: 0, 
        inBush: false, 
        lastVisibility: true, 
        isBoss: !!config.scale,
        _currentBushIdx: -1, 
        
        _isTransformed: false,
        _isTransforming: false,
        _originalConfig: null,
        _originalBrawlerType: '',
        _originalHealth: 0,
        _originalMaxHealth: 0,
        _originalAmmo: 0,
        _sharedMaxHealth: 0,
        _dashTimer: 0,
        _dashTargetX: 0,
        _dashTargetZ: 0,
        _dashStartX: 0,
        _dashStartZ: 0,
        _dashTotalDuration: 0,
        _autoStepTimer: 0,
        _autoStepTargetX: 0,
        _autoStepTargetZ: 0,
        _autoStepStartX: 0,
        _autoStepStartZ: 0,
        _autoStepTotalDuration: 0,
        _dashEasePower: 2.5,
        _autoStepEasePower: 4
    };
};

BotController.prototype._onPVEWaveStart = function(waveNum) {
    if (!this.isActive) return;
    this._cleanup(); 

    var spawnList = [];
    if (waveNum === 1) {
        spawnList = [
            { type: 'minion_melee', x: -5, z: 15 },
            { type: 'minion_melee', x: 0, z: 16 },
            { type: 'minion_melee', x: 5, z: 15 }
        ];
    } else if (waveNum === 2) {
        spawnList = [
            { type: 'minion_ranged', x: 5, z: 6 },
            { type: 'minion_ranged', x: 0, z: 6 },
            { type: 'minion_ranged', x: -5, z: 6 }
        ];
    } else if (waveNum === 3) {
        spawnList = [
            { type: 'minion_melee', x: -3, z: 8 },
            { type: 'minion_melee', x: 0, z: 8 },
            { type: 'minion_melee', x: 3, z: 8 },
            { type: 'minion_ranged', x: 3, z: -4 },
            { type: 'minion_ranged', x: 0, z: -4 },
            { type: 'minion_ranged', x: -3, z: 4 },
            { type: 'boss_zhangjiao', x: 0, z: 0 }
        ];
    }

    for (var i = 0; i < spawnList.length; i++) {
        var spawnData = spawnList[i];
        var bType = typeof spawnData === 'string' ? spawnData : spawnData.type;
        var config = window.BrawlerConfig ? window.BrawlerConfig[bType] : null;
        if (!config) continue;

        var template = this.app.combatManager ? this.app.combatManager.getCharacterTemplate(bType) : null;
        if (!template) continue;

        var entity = template.clone();
        entity.enabled = true; 
        entity.name = 'bot_' + i; 
        template.parent.addChild(entity);
        
        if (config.scale) { 
            entity.setLocalScale(config.scale, config.scale, config.scale);
        }

        var assignedTeam = 'red';
        var spawn = {x: 0, z: 0};
        if (typeof spawnData === 'object' && spawnData.x !== undefined && spawnData.z !== undefined) {
            // 🌟 依競技場比例放大固定出生點 (Asian → AsianLarge / Riverside)
            var gmm = this.app.gameModeManager;
            var sx = gmm ? (gmm.arenaSx || 1) : 1;
            var sz = gmm ? (gmm.arenaSz || 1) : 1;
            spawn.x = spawnData.x * sx;
            spawn.z = spawnData.z * sz;
        } else if (this.app.gameModeManager) {
            spawn = this.app.gameModeManager.getSafeSpawnPoint(assignedTeam, i);
        }
        
        entity.setPosition(spawn.x, 0, spawn.z);
        if (this.app.combatManager) {
            this.app.combatManager.tintHealthAndRing(entity, true);
        }
        
        var animNode = this._findAnimEntity(entity) || entity;
        
        var hpFill = entity.findByName('HealthFill');
        if (hpFill) hpFill.enabled = false;
        var hpBg = entity.findByName('HealthBackground');
        if (hpBg) hpBg.enabled = false;

        var botName = config.name || 'Minion';
        if (this.app.floatingUIManager) {
            this.app.floatingUIManager.registerUI(entity, botName, config.health, 'enemy');
            this.app.floatingUIManager.updateHealth(entity, config.health);
            if (this.app.floatingUIManager.updateGems) this.app.floatingUIManager.updateGems(entity, 0); 
        }

        this.bots.push(this._createBotData(entity, animNode, bType, config, i, botName, assignedTeam, undefined));
    }
};

// ═══════════════════════════════════════════════════════════════
// 🎲 ROGUE 模式公用 API(由 RogueDirector 呼叫)
// ═══════════════════════════════════════════════════════════════

// 通用單隻生成。
// opts: {
//   isAlly:    true = 招募的友方武將(隊伍跟玩家、會放大招、有韁繩)
//   hpScale:   血量倍率(波次難度)      speedScale: 移速倍率(詞綴)
//   dmgScale:  傷害倍率(詞綴/難度)     sizeScale:  體型倍率(精英視覺)
//   affixName: 單一詞綴/稱號前綴（腳本用，如「天公將軍」）
//   affixNames: 詞綴陣列（budget 系統疊加，顯示成「堅甲·強力·關羽」）
//   canSuper:  敵方也能放大招(敵將 boss 用,Phase 2)
//   botId:     自訂 id(不給則自動產生唯一 id)
//   allyRole:  'vanguard'|'guardian'|'tactician'（覆寫 brawlerConfig.allyRole）
//   duelAi:    單挑用 smartCombo + 壓力走位（不污染共用 BrawlerConfig）
// }
BotController.prototype.spawnBotAt = function(bType, x, z, opts) {
    opts = opts || {};
    var baseConfig = window.BrawlerConfig ? window.BrawlerConfig[bType] : null;
    if (!baseConfig) return null;
    var template = this.app.combatManager ? this.app.combatManager.getCharacterTemplate(bType) : null;
    if (!template) return null;

    // 友軍一律深複製 config:強化卡會直接改它,絕不能污染全域 BrawlerConfig
    var config = this._cloneConfigScaled(baseConfig, opts);
    var isRogue = this._isRogueMode();

    // Rogue 敵方：canSuper 未開啟時剝離 super，避免僅靠 superTimer 擋變身
    if (!opts.isAlly && !opts.canSuper) {
        config = this._deepCloneBotConfig(config);
        delete config.super;
    }
    // 單挑／精英 AI：非順序選招；深複製以免污染全域 BrawlerConfig
    if (opts.duelAi || opts.smartCombo) {
        config = this._deepCloneBotConfig(config);
        config.smartCombo = true;
    }

    var entity = template.clone();
    entity.enabled = true;

    var team = opts.isAlly ? (this.app.myTeam || 'blue') : 'red';
    var idx = this.bots.length;
    var botId = opts.botId || ((opts.isAlly ? 'ally_' : 'rogue_') + bType + '_' + Date.now() + '_' + idx);
    entity.name = botId;
    template.parent.addChild(entity);

    // sizeScale 是相對倍率；勿當成絕對 localScale（小兵無 config.scale 時會蓋掉模板尺度）
    var MAX_SIZE_SCALE = 2.0;
    var sizeMul = Math.min(opts.sizeScale || 1, MAX_SIZE_SCALE);
    if (config.scale) {
        var s = config.scale * sizeMul;
        entity.setLocalScale(s, s, s);
    } else if (sizeMul !== 1) {
        var ls = entity.getLocalScale();
        entity.setLocalScale(ls.x * sizeMul, ls.y * sizeMul, ls.z * sizeMul);
    }

    entity.setPosition(x, 0, z);
    var isEnemy = !opts.isAlly;
    if (this.app.combatManager) {
        this.app.combatManager.tintHealthAndRing(entity, isEnemy);
    }

    var animNode = this._findAnimEntity(entity) || entity;
    var hpFill = entity.findByName('HealthFill');
    if (hpFill) hpFill.enabled = false;
    var hpBg = entity.findByName('HealthBackground');
    if (hpBg) hpBg.enabled = false;

    var rawName = _getZhBrawlerName(bType, this.app);
    var affixNames = opts.affixNames ? opts.affixNames.slice() : [];
    // Rogue：有護盾的敵軍顯示「護盾」詞綴（且護盾存在時免疫暈眩）
    if (isRogue && isEnemy && opts.shieldPct && opts.shieldPct > 0) {
        var shieldLbl = (window.TKI18n && TKI18n.isEn && TKI18n.isEn()) ? 'Shield' : '護盾';
        if (affixNames.indexOf(shieldLbl) < 0 && affixNames.indexOf('護盾') < 0 && affixNames.indexOf('Shield') < 0) {
            affixNames.unshift(shieldLbl);
        }
    }
    if (opts.affixName && affixNames.indexOf(opts.affixName) < 0) affixNames.unshift(opts.affixName);
    var botName = (affixNames.length ? (affixNames.join('·') + '·') : '') + rawName;

    if (this.app.floatingUIManager) {
        this.app.floatingUIManager.registerUI(entity, rawName, config.health, isEnemy ? 'enemy' : 'ally', null, affixNames.length ? affixNames : null);
        this.app.floatingUIManager.updateHealth(entity, config.health);
        if (this.app.floatingUIManager.updateGems) this.app.floatingUIManager.updateGems(entity, 0);
    }

    var bot = this._createBotData(entity, animNode, bType, config, idx, botName, team, undefined);
    bot.id = botId;
    bot.rawName = rawName;
    bot.affixNames = affixNames;
    bot._isRogueAlly = !!opts.isAlly;
    // 🧱 特殊波行為積木
    if (opts.lockCombo !== undefined) bot._lockCombo = opts.lockCombo;   // 鎖定只用第 N 招
    if (opts.stationary) bot._stationary = true;                          // 站樁不動
    if (opts.superEvery) bot._superEvery = opts.superEvery;               // 每 N 秒強制放大招
    if (opts.attackEvery) bot._attackEvery = opts.attackEvery;            // 每 N 秒才允許普攻(ROGUE 用)
    if (opts.noRegen) bot._noRegen = true;                                // 🧱 關閉自動回血(群體 clear 波)
    if (opts.noBasicAttack) bot._noBasicAttack = true;                    // 🧱 只放大招,不普攻
    if (opts.noDodge) bot._noDodge = true;                                // 🧱 不受擊自動翻滾
    if (opts.immortal) bot._tutorialImmortal = true;                      // 🎓 教學：血可扣但不會死
    if (opts.tutorialDummy) bot._tutorialDummy = true;                    // 🎓 教學木樁（可清理）
    if (opts.trueStrike) bot.trueStrike = true;                           // Rogue：無視閃避＋破盾
    if (opts.duelAi) bot._duelAi = true;                                    // 單挑：壓力走位（smartCombo 已在 config）
    if (opts.aimMode === 'fixed') {                                        // 🧱 固定方位攻擊(不鎖玩家,可對空)
        bot._aimFixed = true;
        bot._aimFixedAngle = (opts.aimAngle || 0) * (Math.PI / 180);      // 資料填「度」,存弧度
    }
    bot._allyRole = opts.allyRole || baseConfig.allyRole || null;
    // 🧱 敵方前後排編隊（連環計等）：bodyguard 擋在夥伴前；backline 躲在夥伴後
    if (opts.formation) bot._formation = opts.formation;
    if (opts.partnerType) bot._partnerType = opts.partnerType;
    if (opts.formationBackDist) bot._formationBackDist = opts.formationBackDist;
    bot._wordConfigBase = this._deepCloneBotConfig(config);
    bot._canSuper = !!config.super;

    if (config.bossAttackModes && config.bossAttackModes.length) {
        bot._bossModeIdx = Math.floor(Math.random() * config.bossAttackModes.length);
        bot._bossRecoverTimer = 0;
        bot._bossMoveLockTimer = 0;
    }

    if (opts.isAlly) {
        bot.invincibleTimer = 1.0;
        bot.superTimer = bot._canSuper ? (8 + Math.random() * 8) : 999;
        bot._stuckTimer = 0;
        bot._stuckX = x;
        bot._stuckZ = z;
    } else {
        bot.superTimer = opts.superEvery ? opts.superEvery
                       : (bot._canSuper && opts.canSuper ? (10 + Math.random() * 8) : 999);
    }
    // 🧱 普攻節奏積木:只影響普攻(不影響大招)；用獨立閘門避免被 shootTimer/attackQueue 打穿
    if (bot._attackEvery) {
        bot._nextBasicAttackAt = Date.now() + (bot._attackEvery * 1000) * (0.8 + Math.random() * 0.4);
    }
    if (opts.shieldPct && window.CombatResolver && window.CombatResolver.spawnShieldOnUnit) {
        window.CombatResolver.spawnShieldOnUnit(bot, opts.shieldPct, true);
        if (this.app.floatingUIManager && this.app.floatingUIManager.updateShield) {
            this.app.floatingUIManager.updateShield(entity, bot.shieldHP || 0, bot.shieldMax || 0);
        }
    }

    this.bots.push(bot);
    return bot;
};

BotController.prototype._isRogueMode = function() {
    return !!(this.app && this.app.gameModeManager && this.app.gameModeManager.currentMode === 'ROGUE');
};

BotController.prototype._getWordBuffConfigBase = function(bot) {
    // 變身後詞綴同步仍從 _wordConfigBase（貂蟬）還原 config，會與呂布模型錯位
    if (bot._isTransformed && bot.brawlerType && window.BrawlerConfig && window.BrawlerConfig[bot.brawlerType]) {
        return window.BrawlerConfig[bot.brawlerType];
    }
    return bot._wordConfigBase || bot.config;
};

// 複製 config 並套用倍率(comboOverrides / super 一併深複製,傷害倍率才能正確生效)
BotController.prototype._deepCloneBotConfig = function(src) {
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
    }
    if (src.dotConfig) out.dotConfig = Object.assign({}, src.dotConfig);
    return out;
};

BotController.prototype._cloneConfigScaled = function(baseConfig, opts) {
    var hpS = opts.hpScale || 1;
    var spS = opts.speedScale || 1;
    var dmgS = opts.dmgScale || 1;
    if (!opts.isAlly && hpS === 1 && spS === 1 && dmgS === 1) return baseConfig;

    var config = Object.assign({}, baseConfig);
    config.health = Math.round((baseConfig.health || 100) * hpS);
    if (baseConfig.speed) config.speed = baseConfig.speed * spS;

    if (baseConfig.comboOverrides) {
        config.comboOverrides = [];
        for (var c = 0; c < baseConfig.comboOverrides.length; c++) {
            var step = Object.assign({}, baseConfig.comboOverrides[c]);
            if (dmgS !== 1) this._scaleDamageFields(step, dmgS);
            config.comboOverrides.push(step);
        }
    }
    if (baseConfig.super) {
        config.super = Object.assign({}, baseConfig.super);
        if (dmgS !== 1) this._scaleDamageFields(config.super, dmgS);
    }
    if (baseConfig.bossAttackModes) {
        config.bossAttackModes = [];
        for (var m = 0; m < baseConfig.bossAttackModes.length; m++) {
            var mode = Object.assign({}, baseConfig.bossAttackModes[m]);
            if (dmgS !== 1) this._scaleDamageFields(mode, dmgS);
            config.bossAttackModes.push(mode);
        }
    }
    if (dmgS !== 1) this._scaleDamageFields(config, dmgS);
    return config;
};

// 傷害倍率統一套用到所有真實傷害欄位(BrawlerConfig 用的是 bulletDamage,非 damage)
BotController.prototype._scaleDamageFields = function(obj, mul) {
    if (!obj) return;
    var fields = ['bulletDamage', 'explodeDamage', 'lobAreaDamage', 'damagePerTick', 'damage'];
    for (var i = 0; i < fields.length; i++) {
        if (typeof obj[fields[i]] === 'number') obj[fields[i]] = Math.round(obj[fields[i]] * mul);
    }
    if (obj.dotConfig) this._scaleDamageFields(obj.dotConfig, mul);   // 🌟 DOT 傷害巢狀在 dotConfig 內,遞迴處理
};

// 只清掉指定隊伍的 bot(波次結束清紅隊,友方武將留在場上)
// withDeathFx=true：先播死亡定格/停留，結束後再 destroy（reach/kill_target/survive 過關用）
BotController.prototype.cleanupByTeam = function(team, withDeathFx) {
    for (var i = this.bots.length - 1; i >= 0; i--) {
        var b = this.bots[i];
        if (b.team !== team) continue;

        if (withDeathFx && b.entity && !b.entity._destroyed) {
            this._beginDeathVanish(b, true);
            continue;
        }

        this._destroyBotAtIndex(i);
    }
};

BotController.prototype._clearBotTargetMarker = function(bot) {
    if (!bot || !bot.entity) return;
    if (this.app.combatManager && this.app.combatManager.clearRogueTargetMarker) {
        this.app.combatManager.clearRogueTargetMarker(bot.entity);
    }
};

// 死亡定格停留；pendingDestroy=true 時停留結束後從場上移除
BotController.prototype._beginDeathVanish = function(bot, pendingDestroy) {
    if (!bot || !bot.entity || bot.entity._destroyed) return;
    bot.state = 'dead';
    bot.health = 0;
    bot.attackQueue = [];
    bot.activeStates = {};
    bot.flashTimer = 0;
    this._setBotWeaponVisible(bot, false);
    if (pendingDestroy) bot._pendingDestroy = true;

    if (!bot._deathVanishTimer || bot._deathVanishTimer <= 0) {
        bot._deathVanishTimer = 0.8;
        bot._deathVanishTotal = 0.8;
        if (bot.animEntity && bot.animEntity.anim) {
            bot.animEntity.anim.setFloat('speed', 0);
            bot.animEntity.anim.speed = 0;
        }
        if (this.app.combatManager && this.app.combatManager.applyDeathGray) {
            this.app.combatManager.applyDeathGray(bot.entity);
        }
    }

    // 金色目標光圈掛在 app.root，死亡當下就要清，否則會留在地圖上
    this._clearBotTargetMarker(bot);
};

BotController.prototype._finishDeathVanish = function(bot) {
    if (!bot) return;
    bot._deathVanishTimer = 0;
    this._clearBotTargetMarker(bot);
    if (bot._pendingDestroy) {
        bot._pendingDestroy = false;
        var idx = this.bots.indexOf(bot);
        if (idx >= 0) this._destroyBotAtIndex(idx);
        return;
    }
    if (bot.entity && !bot.entity._destroyed) bot.entity.enabled = false;
};

BotController.prototype._updateOrphanDecoys = function(dt, limitX, limitZ) {
    if (!this._orphanDecoys || this._orphanDecoys.length === 0) return;
    for (var i = this._orphanDecoys.length - 1; i >= 0; i--) {
        var d = this._orphanDecoys[i];
        this._updateBotDecoy(d, dt, limitX, limitZ);
        if (!(d.decoyTimer > 0) || !d.decoyEntity) {
            this._orphanDecoys.splice(i, 1);
        }
    }
};

BotController.prototype._updateBotDecoy = function(bot, dt, limitX, limitZ) {
    if (!bot || !(bot.decoyTimer > 0) || !bot.decoyEntity || bot.decoyEntity._destroyed) {
        if (bot && bot.decoyEntity && bot.decoyEntity._destroyed) {
            bot.decoyEntity = null;
            bot.decoyAnimEntity = null;
            bot.decoyTimer = 0;
        }
        return;
    }

    var speedBase = bot.decoyOwnerSpeed || (bot.config && bot.config.speed) || 8;
    var dSpeed = speedBase * 0.8;
    var dPos = bot.decoyEntity.getPosition();
    var dNewX = dPos.x + bot.decoyDirX * dSpeed * dt;
    var dNewZ = dPos.z + bot.decoyDirZ * dSpeed * dt;

    dNewX = pc.math.clamp(dNewX, -limitX, limitX);
    dNewZ = pc.math.clamp(dNewZ, -limitZ, limitZ);
    var dFinalX = dPos.x;
    var dFinalZ = dPos.z;

    if (this.app.combatManager) {
        if (!this.app.combatManager.checkCollision(dNewX, dPos.z)) dFinalX = dNewX;
        if (!this.app.combatManager.checkCollision(dFinalX, dNewZ)) dFinalZ = dNewZ;
    }

    bot.decoyEntity.setPosition(dFinalX, 0, dFinalZ);

    if (bot.decoyAnimEntity && bot.decoyAnimEntity.anim) {
        bot.decoyAnimEntity.anim.setFloat('speed', 1);
    }

    bot.decoyTimer -= dt;
    if (bot.decoyTimer > 0) return;

    if (this.app.bulletManager && this.app.combatManager) {
        this.app.bulletManager._triggerExplosion({
            entity: bot.decoyEntity,
            aoeTemplate: this.app.combatManager.aoeMap['caocao'] || bot.decoyEntity,
            explodeRadius: bot.decoyConfig.explodeRadius,
            explodeDamage: bot.decoyConfig.explodeDamage,
            ownerType: 'bot',
            ownerId: bot.id,
            ownerTeam: bot.team,
            config: bot.config,
            skillConf: bot.decoyConfig
        });
    }
    if (this.app.floatingUIManager) this.app.floatingUIManager.removeUI(bot.decoyEntity);
    bot.decoyEntity.destroy();
    bot.decoyEntity = null;
    bot.decoyAnimEntity = null;
};

BotController.prototype._destroyBotAtIndex = function(i) {
    var b = this.bots[i];
    if (!b) return;
    this._clearBotTargetMarker(b);
    // 進行中的誘餌轉為 orphan，繼續跑完爆炸（不因 bot 銷毀而中斷）
    if (b.decoyEntity && b.decoyTimer > 0 && !b.decoyEntity._destroyed) {
        this._orphanDecoys = this._orphanDecoys || [];
        this._orphanDecoys.push({
            decoyEntity: b.decoyEntity,
            decoyAnimEntity: b.decoyAnimEntity,
            decoyTimer: b.decoyTimer,
            decoyConfig: b.decoyConfig,
            decoyDirX: b.decoyDirX,
            decoyDirZ: b.decoyDirZ,
            decoyOwnerSpeed: b.decoyOwnerSpeed || (b.config && b.config.speed) || 8,
            id: b.id,
            team: b.team,
            config: b.config
        });
        b.decoyEntity = null;
        b.decoyAnimEntity = null;
        b.decoyTimer = 0;
    } else if (b.decoyEntity) {
        if (this.app.floatingUIManager) this.app.floatingUIManager.removeUI(b.decoyEntity);
        b.decoyEntity.destroy();
        b.decoyEntity = null;
    }
    if (b.entity) {
        if (this.app.floatingUIManager) this.app.floatingUIManager.removeUI(b.entity);
        if (!b.entity._destroyed) b.entity.destroy();
    }
    this.bots.splice(i, 1);
};

// 救援卡:復活陣亡武將(config 是該 bot 專屬副本,吃過的強化自動保留)
BotController.prototype.reviveBot = function(botId, x, z) {
    var bot = null;
    for (var i = 0; i < this.bots.length; i++) {
        if (this.bots[i].id === botId) { bot = this.bots[i]; break; }
    }
    if (!bot || bot.state === 'alive') return false;

    bot.state = 'alive';
    bot.health = bot.maxHealth;
    bot.entity.enabled = true;
    bot.entity.setPosition(x, 0, z);
    bot.invincibleTimer = 1.5;
    bot.stunTimer = 0;
    bot.attackQueue = [];
    bot.comboIndex = 0;
    bot.activeStates = {};
    bot._deathVanishTimer = 0;
    bot._pendingDestroy = false;
    bot._stuckTimer = 0;
    bot._stuckX = x;
    bot._stuckZ = z;
    bot.superTimer = bot._canSuper ? (8 + Math.random() * 8) : 999;
    this._resetBotAnimation(bot);
    this._restoreBotMaterials(bot);
    if (this.app.combatManager && this.app.combatManager.clearDeathVisual) {
        this.app.combatManager.clearDeathVisual(bot.entity);
    }

    if (this.app.floatingUIManager) {
        this.app.floatingUIManager.updateHealth(bot.entity, bot.health);
    }
    this._updateHealthBar(bot);
    return true;
};

// 武將強化卡:乘算強化指定武將(改的是該 bot 的專屬 config 副本)
// mults: { hpMul, dmgMul, speedMul }
BotController.prototype.buffBot = function(botId, mults) {
    mults = mults || {};
    var bot = null;
    for (var i = 0; i < this.bots.length; i++) {
        if (this.bots[i].id === botId) { bot = this.bots[i]; break; }
    }
    if (!bot) return false;

    if (mults.hpMul && mults.hpMul !== 1) {
        var oldMax = bot.maxHealth;
        bot.maxHealth = Math.round(bot.maxHealth * mults.hpMul);
        bot.config.health = bot.maxHealth;
        if (bot.state === 'alive') {
            bot.health += (bot.maxHealth - oldMax);   // 增量直接補進當前血量
            var fum = this.app.floatingUIManager;
            if (fum) {
                // 更新血條最大值(避免視覺爆條);API 不存在則重新註冊
                if (typeof fum.updateMaxHealth === 'function') {
                    fum.updateMaxHealth(bot.entity, bot.maxHealth);
                } else if (typeof fum.registerUI === 'function') {
                    fum.registerUI(bot.entity, bot.rawName || bot.name, bot.maxHealth, bot._isRogueAlly ? 'ally' : 'enemy', null, bot.affixNames || null);
                }
                fum.updateHealth(bot.entity, bot.health);
            }
            this._updateHealthBar(bot);
        }
    }
    if (mults.speedMul && bot.config.speed) bot.config.speed *= mults.speedMul;
    if (mults.reloadMul && mults.reloadMul !== 1) {
        var brt = (bot.config.reloadTime !== undefined) ? bot.config.reloadTime : 1.5;
        bot.config.reloadTime = brt / mults.reloadMul;
    }
    if (mults.dmgMul && mults.dmgMul !== 1) {
        this._scaleDamageFields(bot.config, mults.dmgMul);
        if (bot.config.comboOverrides) {
            for (var c = 0; c < bot.config.comboOverrides.length; c++) {
                this._scaleDamageFields(bot.config.comboOverrides[c], mults.dmgMul);
            }
        }
        if (bot.config.super) this._scaleDamageFields(bot.config.super, mults.dmgMul);
    }
    if (bot.shieldMaxPct > 0 && window.CombatResolver && window.CombatResolver.syncShieldMaxFromPct) {
        window.CombatResolver.syncShieldMaxFromPct(bot, bot.shieldMaxPct, false);
        if (bot.entity && this.app.floatingUIManager && this.app.floatingUIManager.updateShield) {
            this.app.floatingUIManager.updateShield(bot.entity, bot.shieldHP || 0, bot.shieldMax || 0);
        }
    }
    if (mults.damageTakenMul !== undefined) bot._damageTakenMul = mults.damageTakenMul;
    return true;
};

BotController.prototype.applyAbsoluteWordBuffsToBot = function(botId, stats) {
    stats = stats || {};
    var bot = null;
    for (var i = 0; i < this.bots.length; i++) {
        if (this.bots[i].id === botId) { bot = this.bots[i]; break; }
    }
    if (!bot || !bot._isRogueAlly) return false;

    var base = this._getWordBuffConfigBase(bot);
    bot.config = this._deepCloneBotConfig(base);
    bot.maxHealth = bot.config.health;
    if (bot.state === 'alive') bot.health = Math.min(bot.health, bot.maxHealth);

    var mults = {
        dmgMul: stats.dmgMul || 1,
        hpMul: stats.hpMul || 1,
        speedMul: stats.speedMul || 1,
        reloadMul: stats.reloadMul || 1,
        damageTakenMul: stats.damageTakenMul || 1
    };
    this.buffBot(botId, mults);
    bot.shieldMaxPct = stats.shieldMaxPct || 0;
    if (window.CombatResolver && window.CombatResolver.applyDefenseStats) {
        window.CombatResolver.applyDefenseStats(bot, stats);
    }
    if (bot.shieldMaxPct > 0 && window.CombatResolver && window.CombatResolver.syncShieldMaxFromPct) {
        var fill = !!stats._fillShield;
        window.CombatResolver.syncShieldMaxFromPct(bot, bot.shieldMaxPct, fill);
        if (bot.entity && this.app.floatingUIManager && this.app.floatingUIManager.updateShield) {
            this.app.floatingUIManager.updateShield(bot.entity, bot.shieldHP || 0, bot.shieldMax || 0);
        }
    }
    return true;
};

// 🌟 ROGUE 友軍韁繩:接管移動時回傳 true(本幀跳過一般移動決策)
// 🌟 算某招的有效射程(從攻擊判斷流程抽出,供判斷點與 smartCombo 選招共用;計算邏輯原封不變)
BotController.prototype._calcRange = function(conf, baseConfig) {
    var pattern = conf.attackPattern || conf.type || 'normal';
    var base = baseConfig || conf;
    var effectiveRange = 5.0;
    if (pattern === 'super_skyfall' || pattern === 'super_zhouyu_burst') {
        return conf.range !== undefined ? conf.range : 12;
    }
    if (pattern === 'melee' || pattern === 'imelee' || pattern === 'dash' || pattern === 'super_whirlwind' || pattern === 'super_zhangfei_roar') {
        var stepR = conf.autoStepRange !== undefined ? conf.autoStepRange : (base.autoStepRange || 0);
        var hitR = conf.dashHitRadius || conf.bulletHitRadius || conf.hitRadius || conf.maxHitRadius || 1.5;
        var whiffR = conf.whiffStep || 0;
        var sweepR = (conf.sweepConfig && conf.sweepConfig.snapDist) ? conf.sweepConfig.snapDist : 0;
        var rushR = (conf.rushConfig && conf.rushConfig.rushDistance) ? conf.rushConfig.rushDistance : 0;
        var reach = Math.max(stepR, whiffR, sweepR, rushR);
        // imelee 瞬間判定：以命中半徑為主；略留余量避免貼邊空揮
        var hitMul = (pattern === 'imelee' || pattern === 'melee') ? 0.92 : 0.8;
        effectiveRange = reach + hitR * hitMul;
        // fireDelay 期間目標會走位，遠程以外也影響近戰出手時機
        var fireDelay = conf.fireDelay || 0;
        if (fireDelay > 0) effectiveRange = Math.max(1.2, effectiveRange - fireDelay * 1.2);
    } else if (pattern === 'boomerang') {
        var boomD = conf.boomerangDistance !== undefined ? conf.boomerangDistance : 6.0;
        var boomR = conf.bulletHitRadius !== undefined ? conf.bulletHitRadius : 1.2;
        effectiveRange = boomD + boomR;
    } else if (pattern === 'lob') {
        if (this.app.combatManager && this.app.combatManager.getLobRange) {
            var lobR = this.app.combatManager.getLobRange(conf);
            effectiveRange = lobR.max + (conf.lobAreaRadius || conf.explodeRadius || 1.2);
        } else {
            var lSpeed = conf.lobSpeed !== undefined ? conf.lobSpeed : (conf.bulletSpeed || 6);
            var lDur = conf.lobDuration !== undefined ? conf.lobDuration : 1.1;
            effectiveRange = (lSpeed * lDur) + (conf.lobAreaRadius || 1.2);
        }
    } else if (pattern === 'super_homing_bomb' || pattern === 'homing') {
        var hLobD = conf.lobDuration !== undefined ? conf.lobDuration : 0.8;
        var hLobS = conf.lobSpeed !== undefined ? conf.lobSpeed : 10;
        var hChaseT = conf.chaseTime !== undefined ? conf.chaseTime : 2.0;
        var hChaseS = conf.chaseSpeed !== undefined ? conf.chaseSpeed : 5.5;
        effectiveRange = (hLobS * hLobD) + (hChaseS * hChaseT) * 0.8;
    } else {
        var bSpeed = conf.bulletSpeed || conf.speed || 10;
        var bLife = conf.bulletLifetime || conf.maxLife || 0.8;
        var hitRad = conf.bulletHitRadius || conf.hitRadius || 0.5;
        effectiveRange = (bSpeed * bLife) + hitRad;
    }
    return effectiveRange;
};

// 🌟 smartCombo:從「當前距離打得到」的一般 combo 招中隨機挑一個 index(大招獨立,不在此列)
// 選定後存 bot._smartPick,讓攻擊判斷與執行共用同一招,避免判斷用 A 招、執行出 B 招
BotController.prototype._pickSmartCombo = function(bot, dist) {
    var combos = bot.config.comboOverrides;
    if (!combos || combos.length === 0) return 0;
    var candidates = [];
    for (var i = 0; i < combos.length; i++) {
        var conf = Object.assign({}, bot.config, combos[i]);
        if (this._calcRange(conf, bot.config) >= dist) candidates.push(i);
    }
    if (candidates.length === 0) return -1;   // 全部打不到 → 交給既有「走近」邏輯,不攻擊
    return candidates[Math.floor(Math.random() * candidates.length)];
};

BotController.prototype._hasBossAttackModes = function(bot) {
    return !!(bot && bot.config && bot.config.bossAttackModes && bot.config.bossAttackModes.length);
};

BotController.prototype._isBossSkyfallConf = function(conf) {
    if (!conf) return false;
    var t = conf.type || conf.attackPattern;
    return t === 'super_skyfall' || t === 'super_zhouyu_burst';
};

/** 移動／攻擊共用：minR + maxR（max 對齊實際 _calcRange，消假甜區） */
BotController.prototype._getBossModeBand = function(bot, modeIndex) {
    var modes = bot.config.bossAttackModes;
    var mode = modes[modeIndex % modes.length];
    var conf = this._getBossModeConf(bot, modeIndex);
    var atkRange = this._calcRange(conf, bot.config);
    var minR = mode.minRange || 0;
    var maxR = mode.maxRange !== undefined ? mode.maxRange : atkRange;
    maxR = Math.min(maxR, atkRange);
    if (maxR < minR) maxR = minR;
    return { minR: minR, maxR: maxR, atkRange: atkRange, conf: conf, mode: mode };
};

BotController.prototype._getBossModeConf = function(bot, modeIndex) {
    var modes = bot.config.bossAttackModes;
    var mode = modes[modeIndex % modes.length];
    return Object.assign({}, bot.config, mode);
};

BotController.prototype._getBossModeRange = function(bot, modeIndex, dist) {
    var band = this._getBossModeBand(bot, modeIndex);
    if (dist < band.minR || dist > band.maxR) return 0;
    return band.atkRange;
};

/** 依距離挑可用招；無候選則挑理想帶最接近者（只移動、不出手由 range=0 處理） */
BotController.prototype._pickBossAttackModeByDist = function(bot, dist) {
    if (!this._hasBossAttackModes(bot)) return 0;
    var modes = bot.config.bossAttackModes;
    var candidates = [];
    var i, band, mid, score;
    for (i = 0; i < modes.length; i++) {
        band = this._getBossModeBand(bot, i);
        if (dist >= band.minR && dist <= band.maxR) {
            mid = (band.minR + band.maxR) * 0.5;
            score = Math.abs(dist - mid);
            // 略懲罰剛用過的招，避免同一招刷到膩
            if (bot._bossLastModeIdx !== undefined && i === bot._bossLastModeIdx) score += 1.5;
            candidates.push({ i: i, score: score });
        }
    }
    if (candidates.length > 0) {
        candidates.sort(function(a, b) { return a.score - b.score; });
        return candidates[0].i;
    }
    var bestI = 0;
    var bestGap = Infinity;
    for (i = 0; i < modes.length; i++) {
        band = this._getBossModeBand(bot, i);
        var gap = 0;
        if (dist < band.minR) gap = band.minR - dist;
        else if (dist > band.maxR) gap = dist - band.maxR;
        if (gap < bestGap) {
            bestGap = gap;
            bestI = i;
        }
    }
    return bestI;
};

/** 壓迫移動（共用）：追入射程帶／帶內側移／過近拉開 */
BotController.prototype._applyPressureMoveWithBand = function(bot, botPos, targetPos, distToTarget, dx, dz, bandMin, bandMax, dt) {
    if (!targetPos || distToTarget < 0.05) {
        bot.moveDir.set(0, 0);
        return true;
    }
    if (bandMin > 0 && distToTarget < bandMin) {
        bot.moveDir.set(-dx / distToTarget, -dz / distToTarget);
        bot.moveTimer = 0.35;
        return true;
    }
    if (distToTarget > bandMax * 0.9) {
        bot.moveDir.set(dx / distToTarget, dz / distToTarget);
        bot.moveTimer = 0.35;
        return true;
    }

    bot.moveTimer -= dt;
    if (bot.moveTimer <= 0 || !bot._bossStrafeSign) {
        bot.moveTimer = 0.45 + Math.random() * 0.25;
        bot._bossStrafeSign = (bot._bossStrafeSign === 1) ? -1 : 1;
        if (Math.random() < 0.5) bot._bossStrafeSign *= -1;
    }
    var sx = -dz / distToTarget * bot._bossStrafeSign;
    var sz = dx / distToTarget * bot._bossStrafeSign;
    bot.moveDir.set(sx * 0.85 + (dx / distToTarget) * 0.15, sz * 0.85 + (dz / distToTarget) * 0.15).normalize();
    return true;
};

/** Boss：依 bossAttackModes 距離帶壓迫 */
BotController.prototype._applyBossPressureMove = function(bot, botPos, targetPos, distToTarget, dx, dz, effectiveRange, dt) {
    var band = this._getBossModeBand(bot, bot._bossModeIdx || 0);
    var bandMin = band.minR;
    var bandMax = band.maxR;
    if (effectiveRange > 0) bandMax = Math.min(bandMax, effectiveRange);
    return this._applyPressureMoveWithBand(bot, botPos, targetPos, distToTarget, dx, dz, bandMin, bandMax, dt);
};

/** 單挑 duelAi：依當前可打招射程做甜區壓迫（無 bossAttackModes） */
BotController.prototype._applyDuelPressureMove = function(bot, botPos, targetPos, distToTarget, dx, dz, effectiveRange, dt) {
    var range = effectiveRange > 0 ? effectiveRange : this._calcRange(bot.config, bot.config);
    if (!(range > 0.5)) range = 8;
    return this._applyPressureMoveWithBand(bot, botPos, targetPos, distToTarget, dx, dz, range * 0.5, range, dt);
};

BotController.prototype._advanceBossAttackMode = function(bot) {
    if (!this._hasBossAttackModes(bot)) return;
    var modes = bot.config.bossAttackModes;
    bot._bossLastModeIdx = bot._bossModeIdx || 0;
    bot._bossModeIdx = ((bot._bossModeIdx || 0) + 1) % modes.length;
};

BotController.prototype._getAllyRoleProfile = function(bot) {
    if (!bot || !bot._allyRole) return null;
    return ALLY_ROLE_PROFILES[bot._allyRole] || null;
};

BotController.prototype._getAllyLeashRadius = function(bot) {
    var profile = this._getAllyRoleProfile(bot);
    return profile ? profile.leash : this.allyLeashRadius;
};

BotController.prototype._getAllyFollowRadius = function(bot) {
    var profile = this._getAllyRoleProfile(bot);
    return profile ? profile.follow : this.allyFollowRadius;
};

BotController.prototype._shouldDisengageToPlayer = function(bot) {
    if (!bot._isRogueAlly || !bot._allyRole || bot._passive || bot._stationary) return false;
    var profile = this._getAllyRoleProfile(bot);
    if (!profile) return false;
    return (bot.health / bot.maxHealth) < profile.retreatHp;
};

BotController.prototype._applyDisengageToPlayer = function(bot, botPos) {
    if (!this._shouldDisengageToPlayer(bot)) return false;
    var player = this.app._localPlayerEntity || (this.app.playerController ? this.app.playerController.player : null);
    if (!player || !player.enabled) return false;
    var pp = player.getPosition();
    var ldx = pp.x - botPos.x;
    var ldz = pp.z - botPos.z;
    if (ldx * ldx + ldz * ldz < 0.25) {
        bot.moveDir.set(0, 0);
    } else {
        bot.moveDir.set(ldx, ldz).normalize();
    }
    bot.moveTimer = 0.35;
    return true;
};

/** Rogue 友軍：同點停滯過久 → 傳玩家附近脫困 */
BotController.prototype._updateAllyUnstuck = function(bot, dt) {
    if (!bot || !bot._isRogueAlly || bot.state !== 'alive') return;
    if (!bot.entity || bot.entity._destroyed) return;
    // 主動待命／站樁不算卡死
    if (bot._passive || bot._stationary) {
        bot._stuckTimer = 0;
        return;
    }
    var pos = bot.entity.getPosition();
    var eps = BotController.ALLY_UNSTUCK_EPS;
    if (bot._stuckX === undefined || bot._stuckZ === undefined) {
        bot._stuckX = pos.x;
        bot._stuckZ = pos.z;
        bot._stuckTimer = 0;
        return;
    }
    var dx = pos.x - bot._stuckX;
    var dz = pos.z - bot._stuckZ;
    if (dx * dx + dz * dz > eps * eps) {
        bot._stuckX = pos.x;
        bot._stuckZ = pos.z;
        bot._stuckTimer = 0;
        return;
    }
    bot._stuckTimer = (bot._stuckTimer || 0) + dt;
    if (bot._stuckTimer >= BotController.ALLY_UNSTUCK_SEC) {
        this._unstuckAllyNearPlayer(bot);
    }
};

BotController.prototype._unstuckAllyNearPlayer = function(bot) {
    if (!bot || !bot.entity || bot.entity._destroyed) return false;
    var player = this.app._localPlayerEntity ||
        (this.app.playerController ? this.app.playerController.player : null);
    if (!player || !player.enabled) return false;
    var pp = player.getPosition();
    var dest = { x: pp.x + 1.2, z: pp.z };
    var rd = this.app.rogueDirector;
    var gmm = this.app.gameModeManager;
    if (rd && typeof rd._findNearbySafePos === 'function') {
        dest = rd._findNearbySafePos(pp.x, pp.z, 2.4);
    } else if (gmm && typeof gmm.getSafeSpawnPoint === 'function') {
        var spot = gmm.getSafeSpawnPoint(bot.team || 'blue', bot.slot || 1);
        if (spot) dest = { x: spot.x, z: spot.z };
    } else if (gmm && gmm._nudgeOutOfObstacles) {
        dest = gmm._nudgeOutOfObstacles(dest.x, dest.z);
    }
    if (bot.entity.rigidbody && typeof bot.entity.rigidbody.teleport === 'function') {
        bot.entity.rigidbody.teleport(dest.x, 0, dest.z);
    } else {
        bot.entity.setPosition(dest.x, 0, dest.z);
    }
    // 短無敵 + 清會讓人「站著不動」的暫態（不動角色配置）
    bot.invincibleTimer = Math.max(bot.invincibleTimer || 0, 1.5);
    bot.stunTimer = 0;
    bot._kbTimer = 0;
    bot._dashTimer = 0;
    bot._autoStepTimer = 0;
    if (bot._rushState) {
        bot._rushState = 'none';
        bot._rushTimer = 0;
        bot._rushAfterimageConf = null;
        bot._rushAfterimageTimer = 0;
    }
    bot.attackQueue = [];
    if (bot.moveDir) bot.moveDir.set(0, 0);
    bot._stuckTimer = 0;
    bot._stuckX = dest.x;
    bot._stuckZ = dest.z;
    return true;
};

BotController.prototype._applyAllyLeash = function(bot, botPos, targetPos, distToTarget, dt) {
    if (!bot._isRogueAlly) return false;
    var leashR = this._getAllyLeashRadius(bot);
    var followR = this._getAllyFollowRadius(bot);
    var ax, az;
    if (bot._holdPos) {
        // 🧱 定點不參戰積木:錨點是指定位置,不是玩家
        ax = bot._holdPos.x; az = bot._holdPos.z;
    } else {
        var player = this.app._localPlayerEntity || (this.app.playerController ? this.app.playerController.player : null);
        if (!player || !player.enabled) return false;
        var pp = player.getPosition();
        ax = pp.x; az = pp.z;
    }
    var ldx = ax - botPos.x;
    var ldz = az - botPos.z;
    var dSq = ldx * ldx + ldz * ldz;

    // 1) 超出韁繩:無條件回錨點(邊跑邊打仍允許,射擊判斷不受影響)
    if (dSq > leashR * leashR) {
        bot.moveDir.set(ldx, ldz).normalize();
        bot.moveTimer = 0.25;
        return true;
    }
    // 2) 沒有(近距離)目標、或 passive 不參戰:貼緊錨點,太近則原地小幅遊走
    if (bot._passive || !targetPos || distToTarget > 16) {
        if (dSq > followR * followR) {
            bot.moveDir.set(ldx, ldz).normalize();
        } else {
            bot.moveTimer -= dt;
            if (bot.moveTimer <= 0) {
                bot.moveTimer = 0.8 + Math.random();
                bot.moveDir.set(Math.random() - 0.5, Math.random() - 0.5).normalize().mulScalar(0.4);
            }
        }
        return true;
    }
    // 3) 韁繩內且有目標:交還一般戰鬥移動邏輯
    return false;
};

BotController.prototype._findFormationPartner = function(bot) {
    if (!bot || !bot._partnerType || !this.bots) return null;
    for (var i = 0; i < this.bots.length; i++) {
        var other = this.bots[i];
        if (!other || other === bot || other.state !== 'alive' || !other.entity) continue;
        if (other.team !== bot.team) continue;
        if (other.brawlerType === bot._partnerType) return other;
    }
    return null;
};

// formation: 'bodyguard' 站在玩家與夥伴之間；'backline' 躲在夥伴遠離玩家的一側
BotController.prototype._applyFormationMove = function(bot, botPos, targetPos, distToTarget, dx, dz) {
    if (!bot._formation || !targetPos) return false;
    var partner = this._findFormationPartner(bot);
    if (!partner) return false;
    var pp = partner.entity.getPosition();
    var idealX, idealZ, idx, idz, id;

    if (bot._formation === 'bodyguard') {
        idealX = pp.x * 0.4 + targetPos.x * 0.6;
        idealZ = pp.z * 0.4 + targetPos.z * 0.6;
        idx = idealX - botPos.x;
        idz = idealZ - botPos.z;
        id = Math.sqrt(idx * idx + idz * idz);
        if (id < 1.0 && distToTarget < 5.5) return false;
        if (id > 0.5) {
            bot.moveDir.set(idx / id, idz / id);
            bot.moveTimer = 0.25;
            return true;
        }
        return false;
    }

    if (bot._formation === 'backline') {
        var pdx = pp.x - targetPos.x;
        var pdz = pp.z - targetPos.z;
        var pl = Math.sqrt(pdx * pdx + pdz * pdz) || 1;
        var backDist = bot._formationBackDist || 6.5;
        idealX = pp.x + (pdx / pl) * backDist;
        idealZ = pp.z + (pdz / pl) * backDist;
        if (distToTarget < 5.5) {
            bot.moveDir.set(-dx / Math.max(distToTarget, 0.1), -dz / Math.max(distToTarget, 0.1));
            bot.moveTimer = 0.28;
            return true;
        }
        idx = idealX - botPos.x;
        idz = idealZ - botPos.z;
        id = Math.sqrt(idx * idx + idz * idz);
        if (id > 1.4) {
            bot.moveDir.set(idx / id, idz / id);
            bot.moveTimer = 0.28;
            return true;
        }
        return false;
    }
    return false;
};

BotController.prototype._applyTacticianKite = function(bot, botPos, targetPos, distToTarget, dx, dz, effectiveRange, pendingPattern) {
    if (bot._allyRole !== 'tactician' || !targetPos || distToTarget < 0.1 || effectiveRange <= 0) return false;
    if (pendingPattern === 'melee' || pendingPattern === 'dash' || pendingPattern === 'super_whirlwind') return false;
    var profile = this._getAllyRoleProfile(bot);
    var kiteMin = profile ? profile.kiteMin : 0.85;
    if (distToTarget >= effectiveRange * kiteMin) return false;

    var ax = -dx / distToTarget;
    var az = -dz / distToTarget;
    if (bot._isRogueAlly) {
        var player = this.app._localPlayerEntity || (this.app.playerController ? this.app.playerController.player : null);
        if (player && player.enabled) {
            var pp = player.getPosition();
            var pdx = pp.x - botPos.x;
            var pdz = pp.z - botPos.z;
            var pl = Math.sqrt(pdx * pdx + pdz * pdz);
            if (pl > 0.5) {
                ax = ax * 0.65 + (pdx / pl) * 0.35;
                az = az * 0.65 + (pdz / pl) * 0.35;
            }
        }
    }
    bot.moveDir.set(ax, az).normalize();
    bot.moveTimer = 0.2;
    return true;
};

// 🧱 設定友軍不參戰狀態(RogueDirector 特殊波用)。holdPos 給了就定點,不給就跟隨玩家
// 🎬 入場演出:定身 duration 秒,anim ready 後硬觸發一次 action(預設 attack = 齊吼)
// aimMode/aimAngle 是 intro 專屬方向(不影響 bot 平常瞄準):'player'=朝玩家(預設),'fixed'=固定角度
BotController.prototype.triggerIntroRoar = function(duration, action, aimMode, aimAngleDeg) {
    for (var i = 0; i < this.bots.length; i++) {
        var bot = this.bots[i];
        if (bot.team !== 'red' || bot.state !== 'alive') continue;
        bot._introTimer = duration;
        bot._introDone = false;
        bot._introAction = action || 'attack';
        bot._introAimFixed = (aimMode === 'fixed');
        bot._introAimAngle = (aimAngleDeg || 0) * (Math.PI / 180);
        bot.attackAnimTimer = 0;
    }
};

BotController.prototype.setBotPassive = function(botId, passive, holdPos) {
    for (var i = 0; i < this.bots.length; i++) {
        if (this.bots[i].id === botId) {
            this.bots[i]._passive = !!passive;
            this.bots[i]._holdPos = (passive && holdPos) ? holdPos : null;
            return true;
        }
    }
    return false;
};

BotController.prototype._spawnBots = function (mode) {
    if (mode === 'PVE' || mode === 'ROGUE') return; // 🎲 ROGUE 由 RogueDirector 負責生成

    this._cleanup(); 
    var playerType = this.app.playerController ? this.app.playerController.brawlerType : 'zhouyu'; 
    var allTypes = ['guanyu', 'zhangjiao', 'zhangliao', 'caocao', 'zhouyu', 'lubu', 'zhangfei', 'diaochan', 'liubei'];
    var availableTypes = allTypes.filter(function(t) { return t !== playerType; });
    for (var k = availableTypes.length - 1; k > 0; k--) {
        var rIdx = Math.floor(Math.random() * (k + 1));
        var temp = availableTypes[k]; 
        availableTypes[k] = availableTypes[rIdx]; 
        availableTypes[rIdx] = temp;
    }

    var myTeamCount = 1;
    var pTeam = this.app.myTeam || 'blue'; 
    var friendlyIndices = [0, 2]; 
    var enemyIndices = [0, 1, 2];
    var fCount = 0; 
    var eCount = 0;

    for (var i = 0; i < 5; i++) {
        var bType = availableTypes[i];
        var config = window.BrawlerConfig ? window.BrawlerConfig[bType] : null;
        if (!config) continue;
        
        var template = this.app.combatManager ? this.app.combatManager.getCharacterTemplate(bType) : null;
        if (!template) continue;

        var entity = template.clone(); 
        entity.enabled = true; 
        entity.name = 'bot_' + i; 
        template.parent.addChild(entity);
        
        var botName = _getBotArenaName(bType, this.app);
        var isEnemy = true;
        var assignedTeam = 'none'; 
        var spawnIdx = undefined;

        if (mode === '3V3_BOUNTY' || mode === '3V3_KNOCKOUT') {
            if (myTeamCount < 3) { 
                isEnemy = false;
                assignedTeam = pTeam; 
                myTeamCount++; 
                spawnIdx = friendlyIndices[fCount++]; 
            } else { 
                assignedTeam = (pTeam === 'blue') ? 'red' : 'blue'; 
                spawnIdx = enemyIndices[eCount++]; 
            }
        } else {
            spawnIdx = (i % 5) + 2; 
        }

        var spawn = {x: 0, z: 0};
        if (this.app.gameModeManager) {
            spawn = this.app.gameModeManager.getSafeSpawnPoint(assignedTeam, spawnIdx);
        }
        
        entity.setPosition(spawn.x, 0, spawn.z);
        if (this.app.combatManager) {
            this.app.combatManager.tintHealthAndRing(entity, isEnemy);
        }

        var animNode = this._findAnimEntity(entity) || entity;
        
        var hpFill = entity.findByName('HealthFill');
        if (hpFill) hpFill.enabled = false;
        var hpBg = entity.findByName('HealthBackground');
        if (hpBg) hpBg.enabled = false;

        var relation = isEnemy ? 'enemy' : 'ally';
        if (this.app.floatingUIManager) {
            this.app.floatingUIManager.registerUI(entity, botName, config.health, relation);
            this.app.floatingUIManager.updateHealth(entity, config.health);
            if (this.app.floatingUIManager.updateGems) this.app.floatingUIManager.updateGems(entity, 0); 
        }

        this.bots.push(this._createBotData(entity, animNode, bType, config, i, botName, assignedTeam, spawnIdx));
        
        if (this.app.scoreManager) {
            this.app.scoreManager.registerBot('bot_' + i, bType, assignedTeam);
        }
    }
};

// ==========================================
// 🌟 ARMY_6V6 5+1 NPC ordu spawn (AI only)
// ==========================================
BotController.prototype._pickRandomArmy = function(excludeTypes, count) {
    var all = ['guanyu','zhangjiao','zhangliao','caocao','zhouyu','lubu','zhangfei','diaochan','liubei','sunquan','zhangbao'];
    var pool = all.filter(function(t){ return excludeTypes.indexOf(t) < 0 && window.BrawlerConfig && window.BrawlerConfig[t] && window.BrawlerConfig[t].select; });
    // karıştır
    for (var k = pool.length - 1; k > 0; k--) { var r = Math.floor(Math.random()*(k+1)); var tmp=pool[k]; pool[k]=pool[r]; pool[r]=tmp; }
    return pool.slice(0, count);
};

BotController.prototype._normalizeArmy = function(arr) {
    if (!Array.isArray(arr)) return [];
    var out = [];
    for (var i=0;i<arr.length && out.length<5;i++) {
        var v = String(arr[i]||'').toLowerCase();
        if (window.BrawlerConfig && window.BrawlerConfig[v] && window.BrawlerConfig[v].select) out.push(v);
    }
    return out;
};

BotController.prototype._spawnArmyBots = function(gameData) {
    var self = this;
    this._cleanup();
    var app = this.app;
    var gmm = app.gameModeManager;
    var isMulti = false;
    try { isMulti = gmm && gmm._isMultiplayerSession && gmm._isMultiplayerSession(); } catch(e) {}
    // Fallback: check socket connected
    if (!isMulti && app.networkManager && app.networkManager.socket && app.networkManager.socket.connected) isMulti = true;

    var myTeam = app.myTeam || 'blue';
    var enemyTeam = myTeam === 'blue' ? 'red' : 'blue';

    // --- Kendi ordum ---
    var sel = app.characterSelect && app.characterSelect.selection;
    var myBrawler = (app.playerController && app.playerController.brawlerType) || (sel && sel.brawler) || 'guanyu';
    var myArmy = [];
    if (sel && sel.army) myArmy = this._normalizeArmy(sel.army);
    if (myArmy.length === 0 && app._lastGameStart && app._lastGameStart.armies) {
        var myId = app.myId || app.socketId;
        if (myId && app._lastGameStart.armies[myId]) myArmy = this._normalizeArmy(app._lastGameStart.armies[myId]);
    }
    if (myArmy.length === 0 && gameData && gameData.armies) {
        var mid = app.myId || app.socketId;
        if (mid && gameData.armies[mid]) myArmy = this._normalizeArmy(gameData.armies[mid]);
        else {
            // offline tek kişi -> gameData.army doğrudan
            if (Array.isArray(gameData.army)) myArmy = this._normalizeArmy(gameData.army);
            if (Array.isArray(gameData.myArmy)) myArmy = this._normalizeArmy(gameData.myArmy);
        }
    }
    if (myArmy.length < 5) {
        var need = 5 - myArmy.length;
        var filler = this._pickRandomArmy([myBrawler].concat(myArmy), need);
        myArmy = myArmy.concat(filler);
    }

    // --- Düşman ordusu ---
    var enemyBrawler = null;
    var enemyArmy = [];
    if (isMulti && gameData && gameData.armies) {
        // online: diğer socket'in army'si
        for (var sid in gameData.armies) {
            if (sid !== (app.myId || app.socketId)) {
                enemyArmy = this._normalizeArmy(gameData.armies[sid]);
                // enemy brawler'ı fullStatePayload'dan bul
                if (app._lastGameStart && app._lastGameStart.players) {
                    // not reliable
                }
                break;
            }
        }
        if (enemyArmy.length === 0 && app._lastGameStart && app._lastGameStart.armies) {
            for (var sid2 in app._lastGameStart.armies) {
                if (sid2 !== (app.myId || app.socketId)) { enemyArmy = this._normalizeArmy(app._lastGameStart.armies[sid2]); break; }
            }
        }
        // enemy brawler: server'dan gelen players bilgisi
        if (gameData.players) {
            for (var pi=0; pi<gameData.players.length; pi++) {
                var pl = gameData.players[pi];
                if (pl.team === enemyTeam) { enemyBrawler = pl.brawler; break; }
            }
        }
        if (!enemyBrawler && app.enemyManager && app.enemyManager.enemies && app.enemyManager.enemies.length) {
            enemyBrawler = app.enemyManager.enemies[0].brawlerType || app.enemyManager.enemies[0].brawler;
        }
    }
    if (!enemyBrawler) {
        // offline: rastgele lider
        var enemyPool = this._pickRandomArmy([myBrawler].concat(myArmy), 1);
        enemyBrawler = enemyPool[0] || 'lubu';
    }
    if (enemyArmy.length < 5) {
        var needE = 5 - enemyArmy.length;
        var fillerE = this._pickRandomArmy([enemyBrawler].concat(enemyArmy).concat(myArmy).concat([myBrawler]), needE);
        enemyArmy = enemyArmy.concat(fillerE);
    }

    console.log('[Army] myTeam=' + myTeam + ' myBrawler=' + myBrawler + ' myArmy=' + myArmy.join(',') + ' enemyBrawler=' + enemyBrawler + ' enemyArmy=' + enemyArmy.join(',') + ' isMulti=' + isMulti);

    // Düşman lider bot olarak spawn edilecek (offline) — online'da lider insan oyuncu, sadece NPC'ler bot
    var needEnemyLeaderBot = !isMulti;

    // Helper: bir orduyu spawn et
    function spawnSquad(brawlerList, team, isMySquad) {
        var baseSpawn = null;
        if (gmm) {
            // lider spawn noktası (0 index)
            baseSpawn = gmm.getSafeSpawnPoint(team, 0);
        } else {
            baseSpawn = {x:0,z: team==='blue'? 50 : -50};
        }
        for (var oi=0; oi<brawlerList.length; oi++) {
            var bType = brawlerList[oi];
            var cfg = window.BrawlerConfig ? window.BrawlerConfig[bType] : null;
            if (!cfg) continue;
            var template = app.combatManager ? app.combatManager.getCharacterTemplate(bType) : null;
            if (!template) continue;
            var ent = template.clone();
            ent.enabled = true;
            // NPC id: army_{team}_{i}
            ent.name = 'army_' + team + '_' + bType + '_' + oi;
            template.parent.addChild(ent);
            // Halka offset: lider etrafında 5'li daire
            var angle = (oi / brawlerList.length) * Math.PI * 2;
            var radius = 3.2 + (oi % 2) * 0.7;
            var sx = baseSpawn.x + Math.cos(angle) * radius;
            var sz = baseSpawn.z + Math.sin(angle) * radius;
            var pos = gmm ? gmm._nudgeOutOfObstacles(sx, sz) : {x:sx,z:sz};
            ent.setPosition(pos.x, 0, pos.z);
            if (app.combatManager) app.combatManager.tintHealthAndRing(ent, team !== myTeam);
            var animNode = self._findAnimEntity(ent) || ent;
            var hpFill = ent.findByName('HealthFill'); if (hpFill) hpFill.enabled = false;
            var hpBg = ent.findByName('HealthBackground'); if (hpBg) hpBg.enabled = false;
            var botName = _getBotArenaName(bType, app);
            var relation = (team === myTeam) ? 'ally' : 'enemy';
            if (app.floatingUIManager) {
                app.floatingUIManager.registerUI(ent, botName, cfg.health, relation);
                app.floatingUIManager.updateHealth(ent, cfg.health);
                if (app.floatingUIManager.updateGems) app.floatingUIManager.updateGems(ent, 0);
            }
            var botData = self._createBotData(ent, animNode, bType, cfg, self.bots.length, botName, team, oi);
            // Army NPC'ler tam AI, hafif leash ayarı
            botData._isArmyNPC = true;
            botData._isRogueAlly = (team === myTeam);
            botData.invincibleTimer = 1.0;
            self.bots.push(botData);
            if (app.scoreManager) app.scoreManager.registerBot(botData.id, bType, team);
        }
    }

    // Kendi 5 NPC
    spawnSquad(myArmy, myTeam, true);
    // Düşman NPC'ler (her zaman 5)
    spawnSquad(enemyArmy, enemyTeam, false);
    // Offline ise düşman lideri de bot olarak ekle (toplam 6v6 için lider bot)
    if (needEnemyLeaderBot) {
        var eCfg = window.BrawlerConfig ? window.BrawlerConfig[enemyBrawler] : null;
        if (eCfg) {
            var eTpl = app.combatManager ? app.combatManager.getCharacterTemplate(enemyBrawler) : null;
            if (eTpl) {
                var eEnt = eTpl.clone();
                eEnt.enabled = true;
                eEnt.name = 'army_' + enemyTeam + '_leader_' + enemyBrawler;
                eTpl.parent.addChild(eEnt);
                var eSpawn = gmm ? gmm.getSafeSpawnPoint(enemyTeam, 0) : {x:0, z: enemyTeam==='blue'?50:-50};
                eEnt.setPosition(eSpawn.x, 0, eSpawn.z);
                if (app.combatManager) app.combatManager.tintHealthAndRing(eEnt, true);
                var eAnim = self._findAnimEntity(eEnt) || eEnt;
                var eh = eEnt.findByName('HealthFill'); if (eh) eh.enabled = false;
                var eb = eEnt.findByName('HealthBackground'); if (eb) eb.enabled = false;
                var eName = _getBotArenaName(enemyBrawler, app);
                if (app.floatingUIManager) {
                    app.floatingUIManager.registerUI(eEnt, eName, eCfg.health, 'enemy');
                    app.floatingUIManager.updateHealth(eEnt, eCfg.health);
                }
                var eBot = self._createBotData(eEnt, eAnim, enemyBrawler, eCfg, self.bots.length, eName, enemyTeam, 0);
                eBot._isArmyLeader = true;
                eBot.invincibleTimer = 1.0;
                self.bots.push(eBot);
                if (app.scoreManager) app.scoreManager.registerBot(eBot.id, enemyBrawler, enemyTeam);
            }
        }
    }
    console.log('[Army] spawn done total bots=' + self.bots.length);
};

BotController.prototype._easeSlideT = function(t, power) {
    t = Math.max(0, Math.min(1, t));
    power = power || 3;
    return 1 - Math.pow(1 - t, power);
};

BotController.prototype._calcSlideDuration = function(dist, speed, maxDuration) {
    if (!speed || speed <= 0 || dist < 0.001) return 0;
    var duration = Math.max(0.06, dist / speed);
    if (maxDuration !== undefined && maxDuration > 0) duration = Math.min(duration, maxDuration);
    return duration;
};

BotController.prototype._beginConstantSlide = function(startX, startZ, targetX, targetZ, slideOpts, out) {
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

BotController.prototype._startBotDash = function(bot, startX, startZ, targetX, targetZ) {
    var slide = {};
    var duration = this._beginConstantSlide(startX, startZ, targetX, targetZ, {
        speed: bot.config.dashSpeed !== undefined ? bot.config.dashSpeed : 14,
        maxDuration: bot.config.dashMaxDuration !== undefined ? bot.config.dashMaxDuration : 0.30,
        easePower: bot.config.dashEasePower !== undefined ? bot.config.dashEasePower : 2.5
    }, slide);
    bot._dashStartX = slide.startX;
    bot._dashStartZ = slide.startZ;
    bot._dashTargetX = slide.targetX;
    bot._dashTargetZ = slide.targetZ;
    bot._dashTotalDuration = duration;
    bot._dashEasePower = slide.easePower;
    bot._dashTimer = duration;
    return duration;
};

BotController.prototype._startBotWhiffStep = function(bot, startX, startZ, targetX, targetZ, atkConf) {
    var slide = {};
    var duration = this._beginConstantSlide(startX, startZ, targetX, targetZ, {
        speed: atkConf.whiffStepSpeed !== undefined ? atkConf.whiffStepSpeed
            : (bot.config.whiffStepSpeed !== undefined ? bot.config.whiffStepSpeed : 12),
        maxDuration: atkConf.whiffStepMaxDuration !== undefined ? atkConf.whiffStepMaxDuration
            : (bot.config.whiffStepMaxDuration !== undefined ? bot.config.whiffStepMaxDuration : 0.16),
        easePower: atkConf.whiffStepEasePower !== undefined ? atkConf.whiffStepEasePower
            : (bot.config.whiffStepEasePower !== undefined ? bot.config.whiffStepEasePower : 2.5)
    }, slide);
    if (duration <= 0) return;
    bot._autoStepStartX = slide.startX;
    bot._autoStepStartZ = slide.startZ;
    bot._autoStepTargetX = slide.targetX;
    bot._autoStepTargetZ = slide.targetZ;
    bot._autoStepTotalDuration = duration;
    bot._autoStepEasePower = slide.easePower;
    bot._autoStepTimer = duration;
};

BotController.prototype._executeBotRoll = function(bot, angle) {
    var dashDist = bot.config.dashDist || 3.5;
    var bPos = bot.entity.getPosition();
    var limitX = this.app.gameModeManager ? this.app.gameModeManager.mapLimitX : 11.5;
    var limitZ = this.app.gameModeManager ? this.app.gameModeManager.mapLimitZ : 10.0;
    
    var step = 0.5;
    var safeX = bPos.x;
    var safeZ = bPos.z;
    var currentDist = 0;

    bot.attackQueue = []; 

    this._setBotWeaponVisible(bot, false);

    while (currentDist < dashDist) {
        currentDist += step;
        if (currentDist > dashDist) currentDist = dashDist;

        var nextX = bPos.x + Math.sin(angle) * currentDist;
        var nextZ = bPos.z + Math.cos(angle) * currentDist;

        if (nextX > limitX || nextX < -limitX || nextZ > limitZ || nextZ < -limitZ) break;
        if (this.app.combatManager && this.app.combatManager.checkCollision(nextX, nextZ)) break;
        
        safeX = nextX;
        safeZ = nextZ;
    }

    bot._dashTargetX = safeX;
    bot._dashTargetZ = safeZ;
    this._startBotDash(bot, bPos.x, bPos.z, safeX, safeZ);
    bot.attackAnimTimer = 0; 
    this._setBotAnimMirror(bot, false);
    
    // 白貓風：位移結束後仍短暫無敵（i-frame 含寬限期，預設 0.35s）
    bot.invincibleTimer = bot.config.dashInvuln !== undefined ? bot.config.dashInvuln : 0.35;
    this._restoreBotMaterials(bot);

    if (bot.animEntity && bot.animEntity.anim) {
        var dashAnim = bot.config.dashAnimTrigger !== undefined ? bot.config.dashAnimTrigger : 'roll';
        if (dashAnim !== 'none') {
            bot.animEntity.anim.setTrigger(dashAnim);
        }
    }
};

// 🌟 啟動等速衝刺（與 PlayerController._startRush 同步）
BotController.prototype._startBotRush = function(bot, angle, rushCfg, atkConf) {
    bot._rushDirX = Math.sin(angle);
    bot._rushDirZ = Math.cos(angle);
    bot._rushSpeed = rushCfg.rushSpeed || 10.0;
    bot._rushDistance = rushCfg.rushDistance || 2.8;
    bot._rushDistTraveled = 0;
    bot._rushRecoverTime = rushCfg.recoverTime || 0;
    var windup = rushCfg.windupTime || 0;
    bot._rushAfterimageConf = (typeof DashAfterimage !== 'undefined')
        ? DashAfterimage.confFromAtk(atkConf, bot.config && bot.config.color)
        : null;
    bot._rushAfterimageTimer = 0;

    if (windup > 0) {
        bot._rushState = 'windup';
        bot._rushTimer = windup;
    } else {
        bot._rushState = 'rushing';
        bot._rushTimer = 0;
        this._stampBotRushAfterimage(bot, true);
    }
};

BotController.prototype._stampBotRushAfterimage = function (bot, force) {
    if (!bot || !bot._rushAfterimageConf || typeof DashAfterimage === 'undefined') return;
    var src = bot.animEntity || bot.entity;
    if (!src) return;
    if (force) {
        DashAfterimage.stamp(this.app, src, bot._rushAfterimageConf);
        bot._rushAfterimageTimer = 0;
    }
};

// 🌟 衝刺狀態機每幀更新（與 PlayerController._updateRush 同步）
BotController.prototype._updateBotRush = function(bot, dt) {
    if (bot._rushState === 'none') return false;

    if (bot._rushState === 'windup') {
        bot._rushTimer -= dt;
        if (bot._rushTimer <= 0) {
            bot._rushState = 'rushing';
            this._stampBotRushAfterimage(bot, true);
        }
        return true;
    }

    if (bot._rushState === 'rushing') {
        var moveStep = bot._rushSpeed * dt;
        var pPos = bot.entity.getPosition();
        var nextX = pPos.x + bot._rushDirX * moveStep;
        var nextZ = pPos.z + bot._rushDirZ * moveStep;

        var limitX = this.app.gameModeManager ? this.app.gameModeManager.mapLimitX : 11.5;
        var limitZ = this.app.gameModeManager ? this.app.gameModeManager.mapLimitZ : 10.0;
        var blocked = false;
        if (nextX > limitX || nextX < -limitX || nextZ > limitZ || nextZ < -limitZ) blocked = true;
        if (!blocked && this.app.combatManager && this.app.combatManager.checkCollision(nextX, nextZ)) blocked = true;

        if (blocked) {
            this._enterBotRushRecover(bot);
            return true;
        }

        bot.entity.setPosition(nextX, 0, nextZ);
        bot._rushDistTraveled += moveStep;

        if (bot._rushAfterimageConf && typeof DashAfterimage !== 'undefined') {
            var src = bot.animEntity || bot.entity;
            bot._rushAfterimageTimer = DashAfterimage.accumulate(
                this.app, src, bot._rushAfterimageConf, bot._rushAfterimageTimer, dt
            );
        }

        if (bot._rushDistTraveled >= bot._rushDistance) {
            this._enterBotRushRecover(bot);
        }
        return true;
    }

    if (bot._rushState === 'recover') {
        bot._rushTimer -= dt;
        if (bot._rushTimer <= 0) {
            bot._rushState = 'none';
            bot._faceLockTimer = 0.12;
            return false;
        }
        return true;
    }

    return false;
};

BotController.prototype._enterBotRushRecover = function(bot) {
    bot._rushAfterimageConf = null;
    bot._rushAfterimageTimer = 0;
    if (bot._rushRecoverTime > 0) {
        bot._rushState = 'recover';
        bot._rushTimer = bot._rushRecoverTime;
    } else {
        bot._rushState = 'none';
        bot._faceLockTimer = 0.12;
    }
};

BotController.prototype._botOriginSuperConf = function (bot) {
    var cfg = (bot._originalConfig && bot._originalConfig.super) ? bot._originalConfig.super : ((bot.config && bot.config.super) ? bot.config.super : null);
    return cfg || {};
};

BotController.prototype._botUsesSharedTransformHealth = function (bot) {
    return !!this._botOriginSuperConf(bot).shareHealth;
};

BotController.prototype._transformBotToMecha = function (bot, targetConfigKey) {
    if (!window.BrawlerConfig || !window.BrawlerConfig[targetConfigKey]) return;
    var originSuper = this._botOriginSuperConf(bot);
    var canCycle = originSuper.type === 'super_transform' && originSuper.transformCycle && originSuper.transformCycle.length > 0;
    if (bot._isTransformed && !canCycle) return;
    if (bot.brawlerType === targetConfigKey) return;

    var currentPos = bot.entity.getPosition().clone();
    var currentRot = bot.entity.getEulerAngles().clone();
    var useSharedHealth = this._botUsesSharedTransformHealth(bot);
    var healthRatio = bot.maxHealth > 0 ? (bot.health / bot.maxHealth) : 1;

    if (!bot._isTransformed) {
        bot._originalConfig = bot.config;
        bot._originalBrawlerType = bot.brawlerType;
        bot._originalHealth = bot.health;
        bot._originalMaxHealth = bot.maxHealth;
        bot._originalAmmo = bot.ammo;
        if (useSharedHealth) bot._sharedMaxHealth = bot.maxHealth;
    }

    bot.brawlerType = targetConfigKey;
    bot.config = this._deepCloneBotConfig(window.BrawlerConfig[targetConfigKey]);
    if (useSharedHealth) {
        bot.maxHealth = bot._sharedMaxHealth || bot._originalMaxHealth || bot.config.health;
        bot.health = Math.min(bot.health, bot.maxHealth);
    } else {
        bot.maxHealth = bot.config.health;
        bot.health = Math.max(1, Math.round(bot.maxHealth * healthRatio));
    }
    bot.ammo = bot.config.ammo;
    bot._isTransformed = (targetConfigKey !== bot._originalBrawlerType);

    // 變身不中斷已放出的誘餌（轉 orphan 繼續跑）
    if (bot.decoyEntity && bot.decoyTimer > 0 && !bot.decoyEntity._destroyed) {
        this._orphanDecoys = this._orphanDecoys || [];
        this._orphanDecoys.push({
            decoyEntity: bot.decoyEntity,
            decoyAnimEntity: bot.decoyAnimEntity,
            decoyTimer: bot.decoyTimer,
            decoyConfig: bot.decoyConfig,
            decoyDirX: bot.decoyDirX,
            decoyDirZ: bot.decoyDirZ,
            decoyOwnerSpeed: bot.decoyOwnerSpeed || (bot.config && bot.config.speed) || 8,
            id: bot.id,
            team: bot.team,
            config: bot.config
        });
        bot.decoyEntity = null;
        bot.decoyAnimEntity = null;
        bot.decoyTimer = 0;
    } else if (bot.decoyEntity) {
        if (this.app.floatingUIManager) this.app.floatingUIManager.removeUI(bot.decoyEntity);
        bot.decoyEntity.destroy();
        bot.decoyEntity = null;
        bot.decoyAnimEntity = null;
    }

    var template = this.app.combatManager.getCharacterTemplate(targetConfigKey);
    var newEntity = template.clone();
    
    newEntity.setPosition(currentPos.x, 0, currentPos.z);
    newEntity.setEulerAngles(currentRot.x, currentRot.y, currentRot.z);
    newEntity.enabled = true;
    newEntity.name = bot.id;
    template.parent.addChild(newEntity);

    var isEnemy = (this.app.gameMode === 'FFA') ? true : (bot.team !== this.app.myTeam);
    if (this.app.combatManager) {
        this.app.combatManager.tintHealthAndRing(newEntity, isEnemy);
    }

    var animNode = this._findAnimEntity(newEntity) || newEntity;
    
    if (this.app.floatingUIManager) {
        this.app.floatingUIManager.removeUI(bot.entity);
    }
    
    var hpFill = newEntity.findByName('HealthFill');
    if (hpFill) hpFill.enabled = false;
    var hpBg = newEntity.findByName('HealthBackground');
    if (hpBg) hpBg.enabled = false;

    bot.entity.destroy();
    bot.entity = newEntity;
    bot.animEntity = animNode;
    if (bot.config.scale) {
    newEntity.setLocalScale(bot.config.scale, bot.config.scale, bot.config.scale);
    }
    bot._baseAnimScale = animNode.getLocalScale().clone(); // 🌟 更新變身後的比例
    bot._animMirrorSign = 1;

    bot.weaponProps = newEntity.find(function(n) { return n.name === 'WeaponProp'; });

    var relation = isEnemy ? 'enemy' : 'ally';
    if (this.app.floatingUIManager) {
        this.app.floatingUIManager.registerUI(bot.entity, bot.rawName || bot.name, bot.maxHealth, relation, null, bot.affixNames || null);
        this.app.floatingUIManager.updateHealth(bot.entity, bot.health);
        if (this.app.floatingUIManager.updateGems) this.app.floatingUIManager.updateGems(bot.entity, bot.gemCount);
    }
};

BotController.prototype._revertBotTransform = function (bot) {
    if (!bot._isTransformed) return;
    
    var currentPos = bot.entity.getPosition().clone();
    var currentRot = bot.entity.getEulerAngles().clone();
    var useSharedHealth = this._botUsesSharedTransformHealth(bot);
    var restoreHealth, restoreMaxHealth, restoreAmmo;

    if (useSharedHealth) {
        restoreHealth = bot.health;
        restoreMaxHealth = bot._sharedMaxHealth || bot.maxHealth;
        restoreAmmo = bot.ammo;
    } else {
        restoreHealth = bot._originalHealth;
        restoreMaxHealth = bot._originalMaxHealth;
        restoreAmmo = bot._originalAmmo;
    }

    bot.config = bot._originalConfig;
    bot.brawlerType = bot._originalBrawlerType;
    bot.maxHealth = restoreMaxHealth > 0 ? restoreMaxHealth : (bot.config ? bot.config.health : 1000);
    if (useSharedHealth) {
        bot.health = Math.max(0, Math.min(restoreHealth, bot.maxHealth));
    } else {
        bot.health = Math.max(1, Math.min(restoreHealth, bot.maxHealth));
    }
    bot.ammo = restoreAmmo;
    bot._isTransformed = false;
    bot._sharedMaxHealth = 0;
    bot._originalConfig = null;
    bot._originalBrawlerType = '';
    bot._originalHealth = 0;
    bot._originalMaxHealth = 0;
    bot._originalAmmo = 0;
    
    var template = this.app.combatManager.getCharacterTemplate(bot.brawlerType);
    var newEntity = template.clone();
    
    newEntity.setPosition(currentPos.x, 0, currentPos.z);
    newEntity.setEulerAngles(currentRot.x, currentRot.y, currentRot.z);
    newEntity.enabled = true;
    newEntity.name = bot.id;
    template.parent.addChild(newEntity);

    var isEnemy = (this.app.gameMode === 'FFA') ? true : (bot.team !== this.app.myTeam);
    if (this.app.combatManager) {
        this.app.combatManager.tintHealthAndRing(newEntity, isEnemy);
    }

    var animNode = this._findAnimEntity(newEntity) || newEntity;
    
    if (this.app.floatingUIManager) {
        this.app.floatingUIManager.removeUI(bot.entity);
    }
    
    var hpFill = newEntity.findByName('HealthFill');
    if (hpFill) hpFill.enabled = false;
    var hpBg = newEntity.findByName('HealthBackground');
    if (hpBg) hpBg.enabled = false;

    bot.entity.destroy();
    bot.entity = newEntity;
    bot.animEntity = animNode;
    bot._baseAnimScale = animNode.getLocalScale().clone(); // 🌟 更新變身後的比例
    bot._animMirrorSign = 1;

    bot.weaponProps = newEntity.find(function(n) { return n.name === 'WeaponProp'; });
    this._setBotWeaponVisible(bot, false);

    var relation = isEnemy ? 'enemy' : 'ally';
    if (this.app.floatingUIManager) {
        this.app.floatingUIManager.registerUI(bot.entity, bot.rawName || bot.name, bot.maxHealth, relation, null, bot.affixNames || null);
        this.app.floatingUIManager.updateHealth(bot.entity, bot.health);
        if (this.app.floatingUIManager.updateGems) this.app.floatingUIManager.updateGems(bot.entity, bot.gemCount);
    }
    
    bot.superTimer = (bot._canSuper && bot.config && bot.config.super) ? (15 + Math.random() * 10) : 999;
    bot.invincibleTimer = 1.5;
    this._restoreBotMaterials(bot);
};

BotController.prototype.updateGemCount = function (bot, newCount) {
    if (bot.state === 'dead') return; 
    bot.gemCount = newCount;
    if (this.app.floatingUIManager && this.app.floatingUIManager.updateGems) {
        this.app.floatingUIManager.updateGems(bot.entity, bot.gemCount);
    }
};

/** Bounty：最近可撿寶石（僅供移動尋路，不進戰鬥瞄準） */
BotController.prototype._getClosestGem = function (bot) {
    this._gemResult.position = null;
    this._gemResult.distance = Infinity;

    var mode = this.app.gameModeManager ? this.app.gameModeManager.currentMode : (this.app.gameMode || '3V3_BOUNTY');
    if (mode !== '3V3_BOUNTY') return this._gemResult;

    var gemMgr = this.app.gemManager;
    if (!gemMgr) {
        var gemEnt = this.app.root.findByName('GemManager');
        if (gemEnt && gemEnt.script) gemMgr = gemEnt.script.gemManager;
        if (gemMgr) this.app.gemManager = gemMgr;
    }
    if (!gemMgr || !gemMgr.gems) return this._gemResult;

    var botPos = bot.entity.getPosition();
    var bestDistSq = Infinity;
    var bestX = 0;
    var bestZ = 0;
    for (var g = 0; g < gemMgr.gems.length; g++) {
        var gem = gemMgr.gems[g];
        if (!gem.isPickable || !gem.entity || !gem.entity.enabled) continue;
        var gdx = gem.x - botPos.x;
        var gdz = gem.z - botPos.z;
        var gDistSq = gdx * gdx + gdz * gdz;
        // 與舊邏輯相同：約 10 單位內主動靠近
        if (gDistSq < 100 && gDistSq < bestDistSq) {
            bestDistSq = gDistSq;
            bestX = gem.x;
            bestZ = gem.z;
        }
    }
    if (bestDistSq === Infinity) return this._gemResult;

    this._gemTargetPos.set(bestX, 0, bestZ);
    this._gemResult.position = this._gemTargetPos;
    this._gemResult.distance = Math.sqrt(bestDistSq);
    return this._gemResult;
};

/** Bounty：朝寶石移動；低血優先脫戰。回傳 true 表示已接管本幀 moveDir */
BotController.prototype._applyGemSeek = function (bot, botPos) {
    var gemInfo = bot._cachedGem;
    if (!gemInfo || !gemInfo.position) return false;
    if (bot.isBoss || bot._stationary || bot._passive) return false;
    if (!bot.isBoss && !bot._noRegen && bot.health / bot.maxHealth < 0.20) return false;

    var gp = gemInfo.position;
    var gdx = gp.x - botPos.x;
    var gdz = gp.z - botPos.z;
    var gDist = gemInfo.distance;
    if (!(gDist > 0.15) || gDist > 10) return false;

    bot.moveDir.set(gdx / gDist, gdz / gDist);
    return true;
};

BotController.prototype._getClosestTarget = function (bot) {
    var bestScoreSq = Infinity; 
    var bestPos = null;
    var botPos = bot.entity.getPosition();
    var botBushIdx = this.app.gameModeManager ? this.app.gameModeManager.getBushIndex(botPos.x, botPos.z) : -1;
    
    var mode = this.app.gameModeManager ? this.app.gameModeManager.currentMode : (this.app.gameMode || '3V3_BOUNTY');
    // 🎲 有隊伍歸屬的模式(同隊互不索敵):3v3 兩種 + ROGUE
    var isTeamBased = (mode === '3V3_BOUNTY' || mode === '3V3_KNOCKOUT' || mode === 'ROGUE');

    var player = this.app._localPlayerEntity || (this.app.playerController ? this.app.playerController.player : null);
    var pTeam = this.app.myTeam || 'blue';
    
    if (player && player.enabled) {
        var pCtrl = this.app.playerController;
        if (!(pCtrl && (pCtrl._invincible || pCtrl._isStealth))) {
            if (mode === 'PVE' || !(isTeamBased && bot.team === pTeam)) {
                var pBushIdx = this.app.gameModeManager ? this.app.gameModeManager.getBushIndex(player.getPosition().x, player.getPosition().z) : -1;
                if (!(pBushIdx !== -1 && pCtrl.revealTimer <= 0 && pBushIdx !== botBushIdx)) {
                    var dx = player.getPosition().x - botPos.x;
                    var dz = player.getPosition().z - botPos.z; 
                    var distSq = dx * dx + dz * dz;
                    var hasLOS = this.app.combatManager.checkLOS(botPos.x, botPos.z, player.getPosition().x, player.getPosition().z);
                    var scoreSq = hasLOS ? distSq : distSq + 10000;
                    if (scoreSq < bestScoreSq) { 
                        bestScoreSq = scoreSq;
                        bestPos = player.getPosition();
                    }
                }
            }
        }
    }

    if (mode !== 'PVE') {
        for (var i = 0; i < this.bots.length; i++) {
            var otherBot = this.bots[i];
            if (otherBot.state !== 'alive' || otherBot.id === bot.id || otherBot.invincibleTimer > 0 || otherBot.isStealth) continue;
            if (!(isTeamBased && bot.team !== 'none' && bot.team === otherBot.team)) {
                var oBushIdx = this.app.gameModeManager ? this.app.gameModeManager.getBushIndex(otherBot.entity.getPosition().x, otherBot.entity.getPosition().z) : -1;
                if (oBushIdx !== -1 && otherBot.revealTimer <= 0 && oBushIdx !== botBushIdx) continue;
                var oPos = otherBot.entity.getPosition(); 
                var bdx = oPos.x - botPos.x; 
                var bdz = oPos.z - botPos.z;
                var distSq2 = bdx * bdx + bdz * bdz;
                var scoreSq2 = this.app.combatManager.checkLOS(botPos.x, botPos.z, oPos.x, oPos.z) ? distSq2 : distSq2 + 10000;
                
                if (scoreSq2 < bestScoreSq) { 
                    bestScoreSq = scoreSq2;
                    bestPos = oPos;
                }
            }
        }
    }

    if (this.app.bulletManager && this.app.bulletManager.deployables) {
        for (var di = 0; di < this.app.bulletManager.deployables.length; di++) {
            var dep = this.app.bulletManager.deployables[di];
            if (dep.hp <= 0 || !dep.entity) continue;
            if (isTeamBased && bot.team !== 'none' && bot.team === dep.team) continue;

            var depPos = dep.entity.getPosition();
            var ddx = depPos.x - botPos.x;
            var ddz = depPos.z - botPos.z;
            var depDistSq = ddx * ddx + ddz * ddz;
            var depScoreSq = this.app.combatManager.checkLOS(botPos.x, botPos.z, depPos.x, depPos.z) ? depDistSq : depDistSq + 10000;
            
            if (depScoreSq < bestScoreSq) {
                bestScoreSq = depScoreSq;
                bestPos = depPos;
            }
        }
    }
    
    var distanceToTarget = Infinity;
    if (bestPos) {
        distanceToTarget = Math.sqrt(Math.pow(bestPos.x - botPos.x, 2) + Math.pow(bestPos.z - botPos.z, 2));
    }
    
    this._targetResult.position = bestPos;
    this._targetResult.distance = distanceToTarget;
    return this._targetResult;
};

BotController.prototype._setBotVisibility = function(bot, isVisible) {
    var renders = bot.entity.findComponents('render');
    for (var i = 0; i < renders.length; i++) { 
        renders[i].enabled = isVisible;
    }
};

BotController.prototype.applyDebuff = function(target, dotConfig, attackerId) {
    if (!dotConfig) return;
    var bot = this.bots.find(function(b) {
        return b.id === target || b.entity === target || (target && target.name === b.id);
    });
    if (!bot || bot.state !== 'alive' || bot.invincibleTimer > 0) return;

    var type = dotConfig.type || 'bleed';
    if (!bot.activeStates) bot.activeStates = {};

    bot.activeStates[type] = {
        duration: dotConfig.duration || 3.0,
        tickRate: dotConfig.tickRate || 0.5,
        damagePerTick: dotConfig.damagePerTick || 50,
        tickTimer: 0,
        attackerId: attackerId || 'unknown',
        _fireSustainDmgMul: dotConfig._fireSustainDmgMul || 1
    };
    if (window.CombatResolver && window.CombatResolver.onDotApplied) {
        window.CombatResolver.onDotApplied(this.app, bot, type);
    }
};

BotController.prototype._executeBotSuper = function(bot, angle, distance) {
    if (!bot.config || !bot.config.super || bot._canSuper === false) return;
    bot.superTimer = bot._superEvery || (15 + Math.random() * 10);   // 🧱 定時大招積木
    var sConf = bot.config.super || {};

    // 🌟 與 PlayerController 同步：支援 hideWeaponProp
    this._setBotWeaponVisible(bot, !sConf.hideWeaponProp);

    var delay = sConf.fireDelay || 0;
    var glowLead = this._preAttackGlowIfRogueEnemy(bot, delay) || 0;
    this._setPvpThreatTimer(bot, delay);
    var spawnDelay = glowLead + delay;
    
    if (sConf.type === 'super_transform') {
        bot.attackAnimTimer = sConf.shootCooldown || 0.5;
    } else {
        var baseCooldown = sConf.shootCooldown || sConf.duration || 1.0;
        bot.attackAnimTimer = Math.max(baseCooldown, spawnDelay + 0.1);
    }
    if ((sConf.type === 'super_skyfall' || sConf.type === 'super_zhouyu_burst') &&
        this.app.combatManager && this.app.combatManager.estimateSkyfallLockDuration) {
        bot.attackAnimTimer = Math.max(
            bot.attackAnimTimer,
            spawnDelay + this.app.combatManager.estimateSkyfallLockDuration(sConf)
        );
    }

    if (bot.animEntity && bot.animEntity.anim) {
        bot.animEntity.anim.setTrigger('superAttack');
    }
    this._setBotAnimMirror(bot, !!sConf.animMirror);
    bot.entity.fire('trail:play', sConf);

    if (spawnDelay > 0) {
        bot.attackQueue.push({
            timer: spawnDelay, config: sConf, angle: angle, distance: distance, isAutoAim: true, isExtra: false, isSuper: true
        });
    } else {
        if (sConf.hitStopDuration) {
            bot.hitStopTimer = sConf.hitStopDuration;
            if (bot.animEntity && bot.animEntity.anim) bot.animEntity.anim.speed = 0;
        }
        this._clearBotPreAttackGlow(bot);
        this._spawnBotSuper(bot, sConf, angle, distance);
    }
};

BotController.prototype._isPvpCombatMode = function () {
    if (!this.app) return false;
    var mode = String(
        (this.app.gameModeManager && this.app.gameModeManager.currentMode) ||
        this.app.gameMode || ''
    ).trim().toUpperCase();
    return mode === 'FFA' || mode === '3V3_BOUNTY' || mode === '3V3_KNOCKOUT';
};

BotController.prototype._isBotThreatToPlayer = function (bot) {
    if (!bot || bot.state !== 'alive' || !this._isPvpCombatMode()) return false;
    var mode = String(
        (this.app.gameModeManager && this.app.gameModeManager.currentMode) ||
        this.app.gameMode || ''
    ).trim().toUpperCase();
    if (mode === 'FFA') return true;
    return bot.team !== this.app.myTeam;
};

// PVP 隱性威脅窗口（不亮紅光）：對手出招前可被 Perfect Dodge 讀取
BotController.prototype._setPvpThreatTimer = function (bot, delaySeconds) {
    if (!this._isBotThreatToPlayer(bot)) return 0;
    var d = (delaySeconds !== undefined && delaySeconds > 0) ? delaySeconds : 0.22;
    var telegraphTotal = Math.min(1.2, d + 0.15);
    bot._pvpThreatTimer = Math.max(bot._pvpThreatTimer || 0, telegraphTotal);
    return telegraphTotal;
};

BotController.prototype._preAttackGlowIfRogueEnemy = function(bot, delaySeconds) {
    // 白貓式提示：ROGUE 時敵人出招前亮紅光
    // 紅光至少 0.5s（不足加 lead）；可見窗 = lead + fireDelay，與 spawnDelay 對齊（不再 1.2 cap 砍短於出傷）
    if (!bot || bot.state !== 'alive' || bot.isStealth) return 0;
    if (!this.app || !this.app.gameModeManager || this.app.gameModeManager.currentMode !== 'ROGUE') return 0;
    if (bot.team !== 'red') return 0;
    if (!this.app.combatManager || !this.app.combatManager.applyPreAttackGlow) return 0;

    var minGlow = 0.5;
    var d = (delaySeconds !== undefined && delaySeconds > 0) ? delaySeconds : 0;
    var lead = Math.max(0, minGlow - d);
    var telegraphTotal = lead + d;

    bot._preAttackGlowTimer = Math.max(bot._preAttackGlowTimer || 0, telegraphTotal);
    bot._rogueGlowLead = lead;
    bot._preAttackGlowUrgent = false;
    this.app.combatManager.applyPreAttackGlow(bot.entity, false);
    return lead;
};

// 出傷當幀：紅滅 ≈ 打出（Perfect 窗與主彈對齊）
BotController.prototype._clearBotPreAttackGlow = function (bot) {
    if (!bot) return;
    if (!(bot._preAttackGlowTimer > 0) && !bot._rogueGlowLead) return;
    bot._preAttackGlowTimer = 0;
    bot._rogueGlowLead = 0;
    bot._preAttackGlowUrgent = false;
    this._restoreBotMaterials(bot);
};

// restore／flash 結束後：timer 仍在則重套紅光（視覺 = 判定；前段暗／末段亮）
BotController.prototype._syncBotPreAttackGlowVisual = function (bot) {
    if (!bot || bot.state !== 'alive' || bot.isStealth) return;
    if (!(bot._preAttackGlowTimer > 0)) return;
    if (bot.flashTimer > 0) return;
    if (!this.app || !this.app.gameModeManager || this.app.gameModeManager.currentMode !== 'ROGUE') return;
    if (bot.team !== 'red') return;
    if (!this.app.combatManager || !this.app.combatManager.applyPreAttackGlow) return;
    var urgentSec = this.app.combatManager.PRE_ATTACK_URGENT_SEC || 0.25;
    var urgent = bot._preAttackGlowTimer <= urgentSec;
    bot._preAttackGlowUrgent = urgent;
    this.app.combatManager.applyPreAttackGlow(bot.entity, urgent);
};

BotController.prototype._spawnBotSuper = function(bot, sConf, angle, distance) {
    if (bot.state !== 'alive' || !bot.entity) return;
    var botPos = bot.entity.getPosition();

    var distToPlayerSq = Infinity;
    var pCtrlRef = this.app.playerController;
    if (pCtrlRef && pCtrlRef.player && !pCtrlRef.isDead) {
        var bx = botPos.x - pCtrlRef.player.getPosition().x;
        var bz = botPos.z - pCtrlRef.player.getPosition().z;
        distToPlayerSq = bx * bx + bz * bz;
    }
    // 不要讓 bot 的大招觸發 camera shake（只保留玩家側的震動）

    if (sConf.type === 'super_transform') {
        if (sConf.transformTo) {
            bot._isTransforming = true;
            var self = this;
            setTimeout(function() {
                if (bot.state !== 'alive' || bot.health <= 0 || !bot.entity || !bot.entity.enabled || !bot._isTransforming) return;
                
                bot._isTransforming = false;
                self._transformBotToMecha(bot, sConf.transformTo);

                if (self.app.bulletManager && self.app.combatManager) {
                    self.app.bulletManager._triggerExplosion({
                        entity: bot.entity,
                        aoeTemplate: self.app.combatManager.aoeMap['lubu'],
                        explodeRadius: 3.0, explodeDamage: 0, ownerType: 'bot', ownerId: bot.id, ownerTeam: bot.team, config: bot.config
                     });
                }
                if (bot.animEntity && bot.animEntity.anim) bot.animEntity.anim.setTrigger('superAttack');
            }, 400);
        }
    }
    else if (sConf.type === 'super_liubei_tree') {
        if (this.app.combatManager) {
            this._tempVec3.set(botPos.x + Math.sin(angle) * 2, 0, botPos.z + Math.cos(angle) * 2);
            this.app.combatManager.executeSuperLiuBeiTree('bot', bot.id, bot.team, bot.brawlerType, this._tempVec3, angle, sConf);
        }
    }
    else if (sConf.type === 'super_homing_bomb' || sConf.type === 'homing') {
        if (this.app.combatManager) {
            var superHomingCount = sConf.spreadCount || sConf.projectileCount || 1;
            var superHomingRad = (sConf.spreadAngle || 0) * Math.PI / 180;
            for (var shi = 0; shi < superHomingCount; shi++) {
                var sFA = angle;
                var shX = botPos.x, shZ = botPos.z;
                if (superHomingCount > 1) {
                    sFA = angle - superHomingRad / 2 + (superHomingRad / (superHomingCount - 1)) * shi;
                    shX += Math.sin(sFA) * 0.5;
                    shZ += Math.cos(sFA) * 0.5;
                }
                this.app.combatManager.executeSuperHomingBomb('bot', bot.id, bot.team, bot.brawlerType, {x: shX, z: shZ}, sFA, bot.config);
            }
        }
    }
    else if (sConf.type === 'super_skyfall' || sConf.type === 'super_zhouyu_burst') {
        // bot 快取通常只有 position；交給 skyfall 用準心／最近敵解析
        var lockEnt = null;
        if (this.app.playerController && this.app.playerController.player && !this.app.playerController.isDead) {
            if (bot.team !== this.app.myTeam) lockEnt = this.app.playerController.player;
        }
        if (this.app.combatManager && this.app.combatManager.beginSuperSkyfall) {
            this.app.combatManager.beginSuperSkyfall(
                'bot', bot.id, bot.team, bot.brawlerType,
                botPos, angle, 1.0, sConf, lockEnt
            );
        }
    }
    else if (sConf.type === 'super_zhangfei_roar') {
        bot.superBurstRemaining = sConf.burstCount || 15; 
        bot.superBurstTimer = 0; 
        bot.superBurstAngle = angle; 
    } 
    else if (sConf.type === 'super_whirlwind') {
        bot.superBurstRemaining = sConf.burstCount || 8;
        bot.superBurstTimer = 0;
        bot.superBurstAngle = angle;
    }
    else if (sConf.type === 'super_decoy') {
        bot.isStealth = true;
        bot.stealthTimer = sConf.stealthDuration; 
        bot.revealTimer = 0; 
        this._restoreBotMaterials(bot);
        if(this.app.combatManager) {
            bot.decoyEntity = this.app.combatManager.spawnDecoy(bot.team, bot.brawlerType, botPos, angle);
            bot.decoyAnimEntity = this._findAnimEntity(bot.decoyEntity) || bot.decoyEntity; 
            bot.decoyDirX = Math.sin(angle); 
            bot.decoyDirZ = Math.cos(angle);
        }
        bot.decoyTimer = sConf.decoyLifetime;
        bot.decoyConfig = sConf;
        bot.decoyOwnerSpeed = (bot.config && bot.config.speed) || 8;
        bot.moveTimer = 0; 
        bot.moveDir.set(Math.random() - 0.5, Math.random() - 0.5).normalize();
    } 
     else {
        if(this.app.combatManager) {
            var mergedConf = Object.assign({}, bot.config, sConf);
            mergedConf.isSuper = true;
            // 🌟 傳 attackPattern 優先：super_enhanced_attack 的本意是「用 attackPattern 的機制發射」
            var superPattern = sConf.attackPattern || sConf.type || 'normal';
            this.app.combatManager.fireProjectile('bot', bot.id, bot.team, bot.brawlerType, botPos, angle, superPattern, 1.0, mergedConf);
        }
    }

   if (sConf.extraAttacks && sConf.extraAttacks.length > 0) {
        var parsedExtras = [];
        for (var e = 0; e < sConf.extraAttacks.length; e++) {
            var extraAtk = sConf.extraAttacks[e]; 
            var safeExtra = Object.assign({}, bot.config, sConf, extraAtk);
            safeExtra.isSuper = true;
            
            if (extraAtk.stunDuration === undefined) delete safeExtra.stunDuration;
            if (extraAtk.hitStopDuration === undefined) delete safeExtra.hitStopDuration;
            
            parsedExtras.push(safeExtra);
        }
        this._spawnBotExtraEffects(bot, parsedExtras, angle, distance);
    }
};

BotController.prototype._spawnBotProjectiles = function(bot, atkConf, angle, distance, comboIndex) {
    if (bot.state !== 'alive' || !bot.entity) return;
    var botPos = bot.entity.getPosition();
    var pType = atkConf.attackPattern || atkConf.type || 'normal';

    if (pType === 'burst' || pType === 'flamethrower') {
        if (!atkConf.isExtraBullet) {
            bot.burstRemaining = atkConf.burstCount || 3;
            bot.burstTimer = 0;
            bot._currentAttackConfig = atkConf; 
        }
    }
    else if (pType === 'super_homing_bomb' || pType === 'homing') {
        var pCountHoming = atkConf.projectileCount || atkConf.spreadCount || 1;
        var sAngleHoming = atkConf.spreadAngle || 0;
        var tRadHoming = sAngleHoming * Math.PI / 180;
        for (var h = 0; h < pCountHoming; h++) {
            var finalAHoming = angle;
            var spawnX = botPos.x;
            var spawnZ = botPos.z;
            if (pCountHoming > 1) {
                finalAHoming = angle - tRadHoming / 2 + (tRadHoming / (pCountHoming - 1)) * h;
                spawnX += Math.sin(finalAHoming) * 0.5;
                spawnZ += Math.cos(finalAHoming) * 0.5;
            }
            if (this.app.combatManager) this.app.combatManager.executeSuperHomingBomb('bot', bot.id, bot.team, bot.brawlerType, {x: spawnX, z: spawnZ}, finalAHoming, atkConf);
        }
    } else {
        var pCount = atkConf.projectileCount || atkConf.spreadCount || 1;
        var sAngle = atkConf.spreadAngle || 0;
        var tRad = sAngle * Math.PI / 180;

        // 🎯 lob 落點依玩家實際距離:distanceRatio = 玩家距離 / (bulletSpeed×bulletLifetime)
        //    讓拋射大約落在玩家當時方位(玩家仍可走位躲,因落點投出後不追蹤)
        var distRatio = 1.0;
        var lobConf = atkConf;
        if (pType === 'lob') {
            lobConf = Object.assign({}, atkConf);
            var tgt = bot._cachedTarget;
            if (tgt && tgt.entity && tgt.entity.parent) {
                var tPos = tgt.entity.getPosition();
                lobConf.lobTargetX = tPos.x;
                lobConf.lobTargetZ = tPos.z;
                if (this.app.combatManager && this.app.combatManager.getLobRange) {
                    var lobR = this.app.combatManager.getLobRange(lobConf);
                    var pd = tgt.distance || 0;
                    var clamped = pc.math.clamp(pd, lobR.min, lobR.max);
                    distRatio = lobR.max > lobR.min ? (clamped - lobR.min) / (lobR.max - lobR.min) : 1.0;
                }
            } else {
                var pd2 = (tgt && tgt.distance) ? tgt.distance : (distance || 6);
                if (this.app.combatManager && this.app.combatManager.getLobRange) {
                    var lobR2 = this.app.combatManager.getLobRange(lobConf);
                    var clamped2 = pc.math.clamp(pd2, lobR2.min, lobR2.max);
                    distRatio = lobR2.max > lobR2.min ? (clamped2 - lobR2.min) / (lobR2.max - lobR2.min) : 1.0;
                }
            }
        }

        for (var bi = 0; bi < pCount; bi++) {
            var a = angle;
            if (pCount > 1) {
                a = (window.CombatResolver && CombatResolver.getSpreadAngle)
                    ? CombatResolver.getSpreadAngle(angle, sAngle, bi, pCount)
                    : (angle - tRad / 2 + (tRad / (pCount - 1)) * bi);
            }
            a += (Math.random() - 0.5) * 0.04;
            if(this.app.combatManager) {
                this.app.combatManager.fireProjectile('bot', bot.id, bot.team, bot.brawlerType, botPos, a, pType, distRatio, lobConf);
            }
        }
    }

    if (!atkConf.isExtraBullet && !atkConf.isWordProc && window.CombatResolver && window.CombatResolver.tryFireBasicProcs) {
        window.CombatResolver.tryFireBasicProcs(
            this.app, 'bot', bot.id, bot.team, bot.brawlerType,
            atkConf, angle, distance, comboIndex || 0
        );
    }
};

BotController.prototype._spawnBotExtraEffects = function(bot, extraAttacks, angle, distance) {
    if (!extraAttacks || !Array.isArray(extraAttacks) || bot.state !== 'alive' || !bot.entity) return;
    var botPos = bot.entity.getPosition();

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
                    var spawnX = botPos.x, spawnZ = botPos.z;
                    if (pCountHoming > 1) {
                        finalAHoming = angle - tRadHoming / 2 + (tRadHoming / (pCountHoming - 1)) * h;
                        spawnX += Math.sin(finalAHoming) * 0.5;
                        spawnZ += Math.cos(finalAHoming) * 0.5;
                    }
                    this.app.combatManager.executeSuperHomingBomb('bot', bot.id, bot.team, bot.brawlerType, {x: spawnX, z: spawnZ}, finalAHoming, conf);
                }
            } else {
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
                    this.app.combatManager.fireProjectile('bot', bot.id, bot.team, bot.brawlerType, botPos, finalA, pType, distance, conf);
                }
            }
        }
    }
};

BotController.prototype._executeBotEmptyAmmoPunch = function (bot, angle, distance) {
    if (!bot.entity || bot.state !== 'alive') return;

    var punchConf = (window.BrawlerConfig && BrawlerConfig.getEmptyAmmoPunchConf)
        ? BrawlerConfig.getEmptyAmmoPunchConf(bot.brawlerType)
        : {
            animTrigger: 'punch', bulletKey: 'punch_heavy', attackPattern: 'imelee',
            bulletDamage: 50, fireDelay: 0.12, shootCooldown: 0.38, isWordProc: true,
            hideWeaponProp: true
        };

    this._setBotWeaponVisible(bot, !punchConf.hideWeaponProp);

    bot.revealTimer = 2.5;
    this._setBotVisibility(bot, true);
    bot.lastVisibility = true;

    bot.aimAngle = angle;
    bot.entity.setEulerAngles(0, angle * (180 / Math.PI), 0);
    this._setBotAnimMirror(bot, !!punchConf.animMirror);

    var mainDelay = punchConf.fireDelay || 0;
    var glowLead = this._preAttackGlowIfRogueEnemy(bot, mainDelay) || 0;
    this._setPvpThreatTimer(bot, mainDelay);
    var spawnDelay = glowLead + mainDelay;
    bot.attackAnimTimer = Math.max(punchConf.shootCooldown || 0.38, spawnDelay + 0.1);
    bot._squashScale = -0.07;
    bot._squashVelocity = 0.35;

    if (bot.animEntity && bot.animEntity.anim) {
        bot.animEntity.anim.setTrigger(punchConf.animTrigger || 'punch');
    }
    if (punchConf.useTrail !== false) {
        bot.entity.fire('trail:play', punchConf);
    }

    if (spawnDelay > 0) {
        bot.attackQueue.push({
            timer: spawnDelay, config: punchConf, angle: angle, distance: distance,
            isAutoAim: true, isExtra: false, isSuper: false, comboIndex: -1
        });
    } else {
        this._clearBotPreAttackGlow(bot);
        this._spawnBotProjectiles(bot, punchConf, angle, distance, -1);
    }
};

BotController.prototype._executeBotAttack = function (bot, angle, distance) {
    if (window.CombatResolver && window.CombatResolver.markEmberProcAvailable) {
        window.CombatResolver.markEmberProcAvailable(bot);
    }
    var atkConf;
    var procComboIndex = 0;
    if (this._hasBossAttackModes(bot)) {
        atkConf = this._getBossModeConf(bot, bot._bossModeIdx || 0);
    } else {
        var stepIndex;
        if (bot._lockCombo !== undefined && bot.config.comboOverrides) {
            stepIndex = bot._lockCombo;   // 🧱 鎖招積木
        } else if (bot.config.smartCombo && bot._smartPick !== null && bot._smartPick !== undefined && bot._smartPick >= 0) {
            stepIndex = bot._smartPick;   // 🎲 smartCombo:用判斷時選定的招
        } else {
            stepIndex = bot.comboIndex;
        }
        var stepOverride = bot.config.comboOverrides ? bot.config.comboOverrides[stepIndex] : null;
        atkConf = stepOverride ? Object.assign({}, bot.config, stepOverride) : bot.config;
        procComboIndex = stepIndex;
    }
    bot._currentAttackConfig = atkConf;

    // 🌟 與 PlayerController 同步：支援 hideWeaponProp（須在 atkConf 算出後判斷）
    this._setBotWeaponVisible(bot, !atkConf.hideWeaponProp);

    var mainDelay = atkConf.fireDelay || 0;
    var glowLead = this._preAttackGlowIfRogueEnemy(bot, mainDelay) || 0;
    this._setPvpThreatTimer(bot, mainDelay);
    var spawnDelay = glowLead + mainDelay;
    bot.attackAnimTimer = Math.max(atkConf.shootCooldown || 0.5, spawnDelay + 0.1);
    // Boss：攻擊整段鎖腳（與框架一致）；招間橫移改由 modeRecoverTime 負責
    if (this._hasBossAttackModes(bot)) {
        bot._bossRecoverTimer = 0;
        bot._bossMoveLockTimer = 0;
    }

    var botPos = bot.entity.getPosition();
    var isSkyfallAtk = this._isBossSkyfallConf(atkConf);
    // sequential_mark 整段遠長於 shootCooldown：鎖定到預估結束，避免未完又開下一輪
    if (isSkyfallAtk && this.app.combatManager && this.app.combatManager.estimateSkyfallLockDuration) {
        var skyLock = this.app.combatManager.estimateSkyfallLockDuration(atkConf);
        bot.attackAnimTimer = Math.max(bot.attackAnimTimer, spawnDelay + skyLock);
    }

    // 🌟 等速衝刺：若該招有 rushConfig，啟動衝刺狀態機（與 PlayerController 同步）
    var rushCfg = atkConf.rushConfig;
    var usingRush = false;
    if (rushCfg && bot.state === 'alive') {
        usingRush = true;
        this._startBotRush(bot, angle, rushCfg, atkConf);
    }

    var stepRange = atkConf.autoStepRange !== undefined ? atkConf.autoStepRange : (bot.config.autoStepRange || 0);
    var whiffStep = atkConf.whiffStep !== undefined ? atkConf.whiffStep : 0;
    
    var targetStepDist = whiffStep !== 0 ? whiffStep : 0; 
    var stepAngle = angle; 

    if (stepRange > 0) {
        var targetInfo = bot._cachedTarget;   // 🌟 改讀快取，避免重算
        if (targetInfo && targetInfo.position) {
            var distToTarget = targetInfo.distance;
            if (distToTarget > 1.5 && distToTarget <= stepRange + 1.5) {
                targetStepDist = distToTarget - 1.2;
                stepAngle = Math.atan2(targetInfo.position.x - botPos.x, targetInfo.position.z - botPos.z);
            }
        }
    }

    // 🌟 衝刺中不跑滑步（與 PlayerController 同步）
    if (!usingRush && Math.abs(targetStepDist) > 0.01) {
        var limitX = this.app.gameModeManager ? this.app.gameModeManager.mapLimitX : 11.5;
        var limitZ = this.app.gameModeManager ? this.app.gameModeManager.mapLimitZ : 10.0;
        var absDist = Math.abs(targetStepDist);
        var dirSign = targetStepDist > 0 ? 1 : -1;
        var stepSize = 0.2, curDist = 0, safeX = botPos.x, safeZ = botPos.z;
        
        while (curDist < absDist) {
            curDist += stepSize;
            if (curDist > absDist) curDist = absDist;
            var nx = botPos.x + Math.sin(stepAngle) * (curDist * dirSign);
            var nz = botPos.z + Math.cos(stepAngle) * (curDist * dirSign);
            if (nx > limitX || nx < -limitX || nz > limitZ || nz < -limitZ) break;
            if (this.app.combatManager && this.app.combatManager.checkCollision(nx, nz)) break;
            safeX = nx; safeZ = nz;
        }
        this._startBotWhiffStep(bot, botPos.x, botPos.z, safeX, safeZ, atkConf);
    }

    bot.ammo--;
    bot.timeSinceLastAttack = 0;
    bot.isReloading = false;
    if (!this._hasBossAttackModes(bot)) {
        bot.comboIndex++;
        var maxCombo = bot.config.comboOverrides ? bot.config.comboOverrides.length : 1;
        if (bot.comboIndex >= maxCombo) bot.comboIndex = 0;
    } else {
        this._advanceBossAttackMode(bot);
    }
    bot.lastAttackTime = 0;

    if (bot.animEntity && bot.animEntity.anim) {
        bot.animEntity.anim.setTrigger(atkConf.animTrigger || 'attack');
    }
    this._setBotAnimMirror(bot, !!atkConf.animMirror);
    bot.entity.fire('trail:play', atkConf);

    var isAuto = true; 

    if (spawnDelay > 0) {
        bot.attackQueue.push({
            timer: spawnDelay, config: atkConf, angle: angle, distance: distance,
            isAutoAim: isAuto, isExtra: false, isSuper: isSkyfallAtk, comboIndex: procComboIndex
        });
    } else {
        if (atkConf.hitStopDuration) {
            bot.hitStopTimer = atkConf.hitStopDuration;
            if (bot.animEntity && bot.animEntity.anim) bot.animEntity.anim.speed = 0;
        }
        this._clearBotPreAttackGlow(bot);
        if (isSkyfallAtk) {
            this._spawnBotSuper(bot, atkConf, angle, distance);
        } else {
            this._spawnBotProjectiles(bot, atkConf, angle, distance, procComboIndex);
        }
    }

    if (atkConf.extraAttacks && atkConf.extraAttacks.length > 0) {
        for (var e = 0; e < atkConf.extraAttacks.length; e++) {
            var extraAtk = atkConf.extraAttacks[e];
            var safeExtraConf = Object.assign({}, atkConf, extraAtk);
            safeExtraConf.isExtraBullet = true;
            delete safeExtraConf.extraAttacks;
            delete safeExtraConf.animTrigger; 
          
            if (extraAtk.spreadCount === undefined) delete safeExtraConf.spreadCount;
            if (extraAtk.projectileCount === undefined) delete safeExtraConf.projectileCount;
            if (extraAtk.burstCount === undefined) delete safeExtraConf.burstCount;
            if (extraAtk.stunDuration === undefined) delete safeExtraConf.stunDuration;
            if (extraAtk.hitStopDuration === undefined) delete safeExtraConf.hitStopDuration;

            var extraDelay = extraAtk.fireDelay !== undefined ? extraAtk.fireDelay : mainDelay;
            var extraSpawnDelay = glowLead + extraDelay;

            if (extraSpawnDelay > 0) {
                bot.attackQueue.push({
                    timer: extraSpawnDelay, config: safeExtraConf, angle: angle, distance: distance, isAutoAim: isAuto, isExtra: true, isSuper: false
                });
            } else {
                this._spawnBotExtraEffects(bot, [safeExtraConf], angle, distance);
            }
        }
    }
};

BotController.prototype.update = function (dt) {
    if (!this.isActive) return; 
    
    dt = Math.min(dt, 0.1); 
    
    var limitX = this.app.gameModeManager ? this.app.gameModeManager.mapLimitX : 11.5;
    var limitZ = this.app.gameModeManager ? this.app.gameModeManager.mapLimitZ : 10.0;

    // gameover 仍要跑誘餌（離體投射物）
    this._updateOrphanDecoys(dt, limitX, limitZ);
    if (this.app.scoreManager && this.app.scoreManager.getState() === 'gameover') {
        for (var gi = 0; gi < this.bots.length; gi++) {
            this._updateBotDecoy(this.bots[gi], dt, limitX, limitZ);
        }
        return;
    }

    var now = Date.now();
    
    if (this.app.gameState === 'intro') {
        for (var i = 0; i < this.bots.length; i++) { 
            if (this.bots[i].animEntity && this.bots[i].animEntity.anim) {
                this.bots[i].animEntity.anim.setFloat('speed', 0);
            }
        } 
        return;
    }

    var myBushIdx = -1;
    var pCtrl = this.app.playerController;
    if (pCtrl && pCtrl.player && !pCtrl.isDead) {
        myBushIdx = this.app.gameModeManager ? this.app.gameModeManager.getBushIndex(pCtrl.player.getPosition().x, pCtrl.player.getPosition().z) : -1;
    }

    var anyUrgentGlow = false;
    var urgentGlowSec = (this.app.combatManager && this.app.combatManager.PRE_ATTACK_URGENT_SEC) || 0.25;

    for (var i = 0; i < this.bots.length; i++) {
        var bot = this.bots[i];

        // 誘餌離體：死亡後仍要移動／爆炸（不可因 dead continue 原地停住）
        this._updateBotDecoy(bot, dt, limitX, limitZ);

        if (bot.state === 'dead') {
            if (bot.entity && !bot.entity._destroyed && bot.entity.enabled) {
                // 灰材質已在 _beginDeathVanish 套一次；死透後不會走 flash/restore
                if (bot._deathVanishTimer && bot._deathVanishTimer > 0) {
                    bot._deathVanishTimer -= dt;
                    if (bot._deathVanishTimer <= 0) {
                        this._finishDeathVanish(bot);
                    }
                } else {
                    this._finishDeathVanish(bot);
                }
            } else if (bot._pendingDestroy) {
                this._finishDeathVanish(bot);
            }
            var _cm = this.app.gameModeManager ? this.app.gameModeManager.currentMode : '';
            if (_cm !== 'PVE' && _cm !== 'ROGUE' && _cm !== '3V3_KNOCKOUT') {
                bot.respawnTimer -= dt;
                if (bot.respawnTimer <= 0) {
                    this._respawnBot(bot);
                }
            }
            // 死亡後仍消化已排隊的誘餌大招
            if (bot.attackQueue && bot.attackQueue.length > 0) {
                for (var qd = bot.attackQueue.length - 1; qd >= 0; qd--) {
                    var deadTask = bot.attackQueue[qd];
                    deadTask.timer -= dt;
                    if (deadTask.timer > 0) continue;
                    var allowDeadDecoy = deadTask.isSuper && deadTask.config && deadTask.config.type === 'super_decoy';
                    if (allowDeadDecoy) {
                        this._spawnBotSuper(bot, deadTask.config, deadTask.angle, deadTask.distance);
                    }
                    bot.attackQueue.splice(qd, 1);
                }
            }
            continue;
        }

        // 🌟 衝刺狀態機（與 PlayerController 同步）：衝刺中鎖定移動與攻擊
        var rushActive = this._updateBotRush(bot, dt);
        if (bot._faceLockTimer > 0) bot._faceLockTimer -= dt;

        if (bot.attackQueue.length > 0) {
            for (var q = bot.attackQueue.length - 1; q >= 0; q--) {
                var task = bot.attackQueue[q];
                task.timer -= dt;

                if (task.isAutoAim && bot.state === 'alive' && !bot._isTransforming) {
                    task.angle = bot.aimAngle; 
                }

                if (task.timer <= 0) {
                    if (bot.state === 'alive') {
                        if (task.config && task.config.hitStopDuration) {
                            bot.hitStopTimer = task.config.hitStopDuration;
                            if (bot.animEntity && bot.animEntity.anim) {
                                bot.animEntity.anim.speed = 0;
                            }
                        }

                        // 主彈／大招出傷：清紅光。extra 不在此清（可能早於或晚於主彈）
                        if (!task.isExtra) this._clearBotPreAttackGlow(bot);

                        if (task.isSuper) {
                            this._spawnBotSuper(bot, task.config, task.angle, task.distance);
                        } else if (task.isExtra) {
                            this._spawnBotExtraEffects(bot, [task.config], task.angle, task.distance);
                        } else {
                            this._spawnBotProjectiles(bot, task.config, task.angle, task.distance, task.comboIndex || 0);
                        }
                    }
                    bot.attackQueue.splice(q, 1);
                }
            }
        }

        if (bot.activeStates) {
            for (var stateKey in bot.activeStates) {
                var status = bot.activeStates[stateKey];
                
                if (!status) continue; 

                status.duration -= dt;
                status.tickTimer += dt;
                if (status.tickTimer >= status.tickRate) {
                    status.tickTimer = 0;
                    if (bot.state === 'alive') {
                        this.hitBot(i, status.damagePerTick, status.attackerId, { isCombo: true, scale: 1.2, isDotTick: true });
                    }
                }
                if (status.duration <= 0) {
                    delete bot.activeStates[stateKey];
                }
            }
        }

        if (bot.dashCharges < 2) {
            bot.dashRechargeTimer += dt;
            if (bot.dashRechargeTimer >= (bot.config.dashRechargeTime || 2.4)) {
                bot.dashCharges++;
                bot.dashRechargeTimer = 0;
            }
        }

        if (bot.hitStopTimer > 0) {
            bot.hitStopTimer -= dt;
            if (bot.hitStopTimer <= 0 && bot.animEntity && bot.animEntity.anim) {
                bot.animEntity.anim.speed = 1.0; 
            }
        }

        if (bot.comboIndex > 0) {
            bot.lastAttackTime += dt;
            if (bot.lastAttackTime > bot.comboResetTime) {
                bot.comboIndex = 0;
            }
        }

        if (bot.attackAnimTimer > 0) {
            bot.attackAnimTimer -= dt;
            if (bot.attackAnimTimer <= 0) {
                bot.attackAnimTimer = 0;
                this._setBotWeaponVisible(bot, false);
                this._setBotAnimMirror(bot, false);
                // Boss：攻擊結束進入招間 recover（可走位、不可出手）
                if (this._hasBossAttackModes(bot)) {
                    var recoverSec = (bot.config && bot.config.modeRecoverTime !== undefined)
                        ? bot.config.modeRecoverTime : 0.8;
                    bot._bossRecoverTimer = Math.max(recoverSec, 0);
                }
            }
        }

        if (bot._bossRecoverTimer > 0) {
            bot._bossRecoverTimer -= dt;
            if (bot._bossRecoverTimer < 0) bot._bossRecoverTimer = 0;
        }

        if (bot._bossMoveLockTimer > 0) {
            bot._bossMoveLockTimer -= dt;
            if (bot._bossMoveLockTimer < 0) bot._bossMoveLockTimer = 0;
        }

        if (bot._preAttackGlowTimer > 0) {
            bot._preAttackGlowTimer -= dt;
            if (bot._preAttackGlowTimer <= 0) {
                bot._preAttackGlowTimer = 0;
                bot._rogueGlowLead = 0;
                bot._preAttackGlowUrgent = false;
                this._restoreBotMaterials(bot);
            } else {
                var urgentGlow = bot._preAttackGlowTimer <= urgentGlowSec;
                if (urgentGlow) anyUrgentGlow = true;
                if (urgentGlow !== !!bot._preAttackGlowUrgent) {
                    bot._preAttackGlowUrgent = urgentGlow;
                    if (bot.flashTimer <= 0 && !bot.isStealth &&
                        this.app.combatManager && this.app.combatManager.applyPreAttackGlow) {
                        this.app.combatManager.applyPreAttackGlow(bot.entity, urgentGlow);
                    }
                }
            }
        }

        if (bot._pvpThreatTimer > 0) {
            bot._pvpThreatTimer -= dt;
            if (bot._pvpThreatTimer <= 0) bot._pvpThreatTimer = 0;
        }

        if (bot.state === 'alive') {
            if (bot._isTransformed && bot.config.isMecha && bot.config.autoDrainRate) {
                bot.health -= bot.maxHealth * bot.config.autoDrainRate * dt;
                bot.lastDamageTime = now;
                this._updateHealthBar(bot);
                if (bot.health <= 0) {
                    bot.health = 0;
                    this._revertBotTransform(bot);
                    continue;
                }
            } else if (!bot._noRegen && now - bot.lastDamageTime > 3000 && bot.health < bot.maxHealth) {
                bot.health = Math.min(bot.health + bot.maxHealth * 0.13 * dt, bot.maxHealth);
                this._updateHealthBar(bot);
            }
            if (window.CombatResolver && window.CombatResolver.tickShieldRegen) {
                window.CombatResolver.tickShieldRegen(bot, dt);
                if (bot.entity && this.app.floatingUIManager && this.app.floatingUIManager.updateShield) {
                    this.app.floatingUIManager.updateShield(bot.entity, bot.shieldHP || 0, bot.shieldMax || 0);
                }
            }
        }

        if (bot.revealTimer > 0) bot.revealTimer -= dt;

        var botPos = bot.entity.getPosition();
        var botBushIdx = this.app.gameModeManager
            ? this.app.gameModeManager.getBushIndex(botPos.x, botPos.z) : -1;
        var nowInBush = (botBushIdx !== -1);
        var isEnemyToMe = (this.app.myTeam === 'none' || bot.team !== this.app.myTeam);

        if (bot._currentBushIdx !== -1 && bot._currentBushIdx !== botBushIdx) {
            if (this.app.gameModeManager)
                this.app.gameModeManager.setBushTransparent(bot._currentBushIdx, false);
        }
        bot._currentBushIdx = botBushIdx;

        var shouldBeVisible = true;
        if (bot.isStealth) {
            shouldBeVisible = false;
        } else if (isEnemyToMe && nowInBush) {
            if (bot.revealTimer > 0) {
                if (this.app.gameModeManager)
                    this.app.gameModeManager.setBushTransparent(botBushIdx, true);
                shouldBeVisible = true;
            } else {
                if (myBushIdx !== botBushIdx) {
                if (this.app.gameModeManager)
                    this.app.gameModeManager.setBushTransparent(botBushIdx, false);
                }
                shouldBeVisible = (myBushIdx !== -1 && myBushIdx === botBushIdx);
            }
        }

        if (bot.lastVisibility !== shouldBeVisible) {
            this._setBotVisibility(bot, shouldBeVisible);
            bot.lastVisibility = shouldBeVisible;
        }

        bot.inBush = nowInBush;

        if (bot.isStealth && bot.stealthTimer > 0) {
            bot.stealthTimer -= dt;
            if (bot.stealthTimer <= 0) {
                bot.isStealth = false;
                this._restoreBotMaterials(bot);
            }
        }
        
        if (bot.superTimer > 0 && !bot._isTransformed && bot.stunTimer <= 0) {
            bot.superTimer -= dt;   // 🧱 stun 時暫停計時(炮台被打斷,stun 完重新計)
        }
        
        if (bot.invincibleTimer > 0) {
            bot.invincibleTimer -= dt;
            if (bot.invincibleTimer <= 0) { 
                bot.invincibleTimer = 0;
                if (!bot.isStealth) this._restoreBotMaterials(bot);
            } 
            else if (bot.flashTimer <= 0 && !bot.isStealth && this.app.gameState === 'playing') {
                if (this.app.combatManager) {
                    var targetOpacity = (Math.floor(bot.invincibleTimer / 0.15) % 2 === 0) ? 0.3 : 1.0;
                    this.app.combatManager.setEntityOpacity(bot.entity, targetOpacity);
                }
            }
        }

        if (bot.flashTimer > 0 && bot.invincibleTimer <= 0 && !bot.isStealth) { 
            bot.flashTimer -= dt;
            if (bot.flashTimer <= 0) {
                this._restoreBotMaterials(bot);
            }
        }

        if (bot.stunTimer > 0) {
            bot.stunTimer -= dt;
            bot.moveDir.set(0, 0);
            bot.shootTimer = 0.5; 
            bot.attackAnimTimer = Math.max(bot.attackAnimTimer, 0.1); 
        }

        // 🎬 入場演出:定身無敵。anim ready 後硬觸發一次 intro action(不看目標/射程,可對空)
        //    action 結構可擴充:目前支援 'attack'(播攻擊動畫射一次);之後可加 move/anim/death 等
        if (bot._introTimer > 0) {
            bot._introTimer -= dt;
            bot.moveDir.set(0, 0);
            bot.invincibleTimer = Math.max(bot.invincibleTimer, 0.1);
            var animReady = bot.animEntity && bot.animEntity.anim && bot.animEntity.anim.baseLayer;
            if (!bot._introDone && animReady) {
                bot._introDone = true;
                var iAngle = bot._introAimFixed ? bot._introAimAngle : bot.aimAngle;
                var iAct = bot._introAction || 'attack';
                if (iAct === 'attack') {
                    if (bot.superTimer <= 0 && bot.config.super) this._executeBotSuper(bot, iAngle, 1.0);
                    else this._executeBotAttack(bot, iAngle, 1.0);
                }
                // 未來:else if (iAct === 'move') {...} else if (iAct === 'anim') {...}
            }
            if (bot._introTimer <= 0) {
                bot._introTimer = 0;
                bot.lastDamageTime = Date.now();   // 避免 intro 剛結束就被判回血
            }
            continue;   // intro 期間跳過正常 AI(定身)
        }

        // Rogue 友軍卡死脫困（同 XZ 停滯 ≥15s → 傳玩家附近）
        if (bot._isRogueAlly) this._updateAllyUnstuck(bot, dt);

        // 🧱 定時砲台(superEvery):純計時器驅動,時間到朝固定角度無條件放大招,
        //    完全繞開攻擊判斷鏈(不看目標/射程/視線)。stun 時 superTimer 已暫停(見上方倒數)。
        if (bot._superEvery) {
            if (bot.stunTimer <= 0 && bot.superTimer <= 0 && bot.config.super && bot.attackAnimTimer <= 0) {
                var castAngle;
                if (bot._aimFixed) {
                    castAngle = bot._aimFixedAngle;
                } else {
                    // 非固定方位:就地算朝玩家(因 stationary 會 continue 跳過下方的 aimAngle 計算)
                    var stgt = bot._cachedTarget;
                    if (stgt && stgt.position) {
                        var bp = bot.entity.getPosition();
                        castAngle = Math.atan2(stgt.position.x - bp.x, stgt.position.z - bp.z);
                    } else {
                        castAngle = bot.aimAngle;
                    }
                }
                bot.aimAngle = castAngle;
                this._executeBotSuper(bot, castAngle, 1.0);
            }
            // 注意: stationary 只禁止移動，不應該跳過瞄準/普攻邏輯；否則會造成只朝單一方向放招/射擊
            if (bot._stationary) { bot.moveDir.set(0, 0); }
        }
           // 🌟 索敵降頻：每 0.15 秒才重算一次最近目標，中間用快取
        bot._targetScanTimer -= dt;
        if (bot._targetScanTimer <= 0 || !bot._cachedTarget) {
            bot._targetScanTimer = 0.15;
            var freshTarget = this._getClosestTarget(bot);
            // _getClosestTarget 回傳共用物件 this._targetResult；單位位置可留 entity 引用追蹤移動
            bot._cachedTarget = { position: freshTarget.position, distance: freshTarget.distance };

            var freshGem = this._getClosestGem(bot);
            var gp = freshGem.position;
            // 寶石座標必須拷貝，否則下一個 bot 掃描會覆寫 _gemTargetPos
            bot._cachedGem = (gp)
                ? { position: { x: gp.x, y: 0, z: gp.z }, distance: freshGem.distance }
                : null;
        }
        var targetInfo = bot._cachedTarget; // 🔧 修復:原本這行又呼叫 _getClosestTarget,把上面的降頻快取完全繞過了
        var targetPos = targetInfo.position; 
        var distToTarget = targetInfo.distance;
        var dx = 0, dz = 0;
        
        if (bot._aimFixed) {
            bot.aimAngle = bot._aimFixedAngle;   // 🧱 固定方位:鎖定角度,不朝玩家
        } else if (targetPos) { 
            dx = targetPos.x - botPos.x;
            dz = targetPos.z - botPos.z;
            bot.aimAngle = Math.atan2(dx, dz);
        }

        var isSuperReady = (bot.superTimer <= 0 && bot.config.super);
        var pendingConf = null;
        if (isSuperReady) {
            pendingConf = bot.config.super;
            bot._smartPick = null;
        } else if (this._hasBossAttackModes(bot)) {
            bot._bossModeIdx = this._pickBossAttackModeByDist(bot, distToTarget);
            pendingConf = this._getBossModeConf(bot, bot._bossModeIdx || 0);
            bot._smartPick = null;
        } else if (bot._lockCombo !== undefined && bot.config.comboOverrides) {
            // 🧱 鎖招積木:永遠只用第 _lockCombo 招
            var lo = bot.config.comboOverrides[bot._lockCombo];
            pendingConf = lo ? Object.assign({}, bot.config, lo) : bot.config;
            bot._smartPick = null;
        } else if (bot.config.smartCombo) {
            // 🎲 smartCombo:按當前距離篩「打得到」的招隨機挑,存 _smartPick 供執行共用
            var pick = this._pickSmartCombo(bot, distToTarget);
            bot._smartPick = pick;
            if (pick < 0) {
                pendingConf = bot.config;   // 全打不到,range 會算很小 → 不觸發攻擊,交給走近邏輯
            } else {
                var so = bot.config.comboOverrides ? bot.config.comboOverrides[pick] : null;
                pendingConf = so ? Object.assign({}, bot.config, so) : bot.config;
            }
        } else {
            var stepIndex = bot.comboIndex;
            var stepOverride = bot.config.comboOverrides ? bot.config.comboOverrides[stepIndex] : null;
            pendingConf = stepOverride ? Object.assign({}, bot.config, stepOverride) : bot.config;
            bot._smartPick = null;
        }
        var pendingPattern = pendingConf.attackPattern || pendingConf.type || 'normal';

        var effectiveRange = this._calcRange(pendingConf, bot.config);
        if (this._hasBossAttackModes(bot)) {
            effectiveRange = this._getBossModeRange(bot, bot._bossModeIdx || 0, distToTarget);
        }
        if (bot.config.smartCombo && bot._smartPick === -1) effectiveRange = 0;   // 全打不到 → 強制不觸發
        if (bot._passive) effectiveRange = 0;   // 🧱 不參戰積木:永不觸發攻擊
        if (bot._noBasicAttack && !isSuperReady) effectiveRange = 0;   // 🧱 只大招:非大招時不觸發普攻

        if (isSuperReady) {
            if (pendingConf.type === 'super_liubei_tree') effectiveRange = 8.0; 
            if (pendingConf.type === 'super_decoy') effectiveRange = 10.0;
        }

        // 🌟 衝刺／攻擊中鎖定 AI 移動（與 PlayerController 同步）
        // Boss 招間 recover：attackAnimTimer=0，可走位壓迫（橫移）
        var canDecideMove = !bot._isTransforming && bot.attackAnimTimer <= 0;
        if (rushActive) {
            bot.moveDir.set(0, 0);
        } else if (canDecideMove) {
            if (bot._stationary) {
                bot.moveDir.set(0, 0);   // 🧱 站樁積木:不移動
            } else if (this._applyDisengageToPlayer(bot, botPos)) {
                // 友軍職能：低血回玩家脫戰（沿用既有脫戰回血）
            } else if (bot.wallAvoidTimer > 0) {
                bot.wallAvoidTimer -= dt;
                bot.moveDir.set(Math.sin(bot.wallAvoidAngle), Math.cos(bot.wallAvoidAngle));
            } else if (this._applyGemSeek(bot, botPos)) {
                // Bounty：主動靠近地上寶石（不影響 aim / 開火）
            } else if (this._applyFormationMove(bot, botPos, targetPos, distToTarget, dx, dz)) {
                // 敵方編隊：護衛擋前／後排躲後
            } else if (this._applyTacticianKite(bot, botPos, targetPos, distToTarget, dx, dz, effectiveRange, pendingPattern)) {
                // 軍師：過近時後退拉距
            } else if (this._applyAllyLeash(bot, botPos, targetPos, distToTarget, dt)) {
                // 🎲 ROGUE 友軍韁繩接管本幀移動(貼住玩家,不打野)
            } else if (this._hasBossAttackModes(bot) && targetPos) {
                this._applyBossPressureMove(bot, botPos, targetPos, distToTarget, dx, dz, effectiveRange, dt);
            } else if (bot._duelAi && targetPos) {
                this._applyDuelPressureMove(bot, botPos, targetPos, distToTarget, dx, dz, effectiveRange, dt);
            } else {
                bot.moveTimer -= dt;
                if (bot.moveTimer <= 0) {
                    bot.moveTimer = 0.5 + Math.random() * 0.8;
                    var hpRatio = bot.health / bot.maxHealth;

                    if (targetPos && distToTarget < 14) {
                        if (hpRatio < 0.20 && !bot.isBoss && !bot._noRegen && !(bot._isRogueAlly && bot._allyRole)) {
                            bot.moveDir.set(-dx, -dz).normalize(); 
                        } 
                        else if (distToTarget < effectiveRange * 0.8 && pendingPattern !== 'melee' && pendingPattern !== 'dash' && pendingPattern !== 'super_whirlwind') {
                            var strafe = Math.random() > 0.5 ? 1 : -1;
                            bot.moveDir.set(-dz * strafe, dx * strafe).normalize(); 
                            bot.moveDir.x += (Math.random() - 0.5) * 0.5;
                            bot.moveDir.y += (Math.random() - 0.5) * 0.5;
                            bot.moveDir.normalize();
                        } else {
                            var jitterX = (Math.random() - 0.5) * 0.5;
                            var jitterZ = (Math.random() - 0.5) * 0.5;
                            bot.moveDir.set(dx / distToTarget + jitterX, dz / distToTarget + jitterZ).normalize();
                        }
                    } else { 
                        if (targetPos) {
                            bot.moveDir.set(dx, dz).normalize();
                        } else {
                            bot.moveDir.set(Math.random() - 0.5, Math.random() - 0.5).normalize();
                        }
                    }
                }
                
                if (targetPos && distToTarget < 8 && bot.dashCharges > 0 && bot._dashTimer <= 0) {
                    if (Math.random() < 0.005) { 
                        bot.dashCharges--;
                        var strafeA = bot.aimAngle + (Math.random() > 0.5 ? 1 : -1) * (Math.PI / 2);
                        this._executeBotRoll(bot, strafeA);
                    }
                }
            }  
        } else {
            bot.moveDir.set(0, 0); 
        }

        var currentMoveX = bot.moveDir.x;
        var currentMoveY = bot.moveDir.y;

        // 攻擊整段鎖腳（Boss 與一般 bot 相同；招間橫移不受此閘）
        if (bot._isTransforming || bot.attackAnimTimer > 0 || bot._kbTimer > 0 || rushActive) {
            currentMoveX = 0;
            currentMoveY = 0;
        }

        var finalX = botPos.x;
        var finalZ = botPos.z;

        if (bot._dashTimer > 0) {
            bot._dashTimer -= dt;
            var dashDur = bot._dashTotalDuration > 0 ? bot._dashTotalDuration : 0.001;
            var dashElapsed = dashDur - Math.max(0, bot._dashTimer);
            var dashT = Math.min(1, dashElapsed / dashDur);
            var easedDashT = this._easeSlideT(dashT, bot._dashEasePower);
            finalX = pc.math.lerp(bot._dashStartX, bot._dashTargetX, easedDashT);
            finalZ = pc.math.lerp(bot._dashStartZ, bot._dashTargetZ, easedDashT);
            if (bot._dashTimer <= 0 || dashT >= 1) {
                finalX = bot._dashTargetX;
                finalZ = bot._dashTargetZ;
                bot._dashTimer = 0;
            }
        } else if (bot._autoStepTimer > 0) {
            bot._autoStepTimer -= dt;
            var stepDur = bot._autoStepTotalDuration > 0 ? bot._autoStepTotalDuration : 0.001;
            var stepElapsed = stepDur - Math.max(0, bot._autoStepTimer);
            var stepT = Math.min(1, stepElapsed / stepDur);
            var easedStepT = this._easeSlideT(stepT, bot._autoStepEasePower);
            finalX = pc.math.lerp(bot._autoStepStartX, bot._autoStepTargetX, easedStepT);
            finalZ = pc.math.lerp(bot._autoStepStartZ, bot._autoStepTargetZ, easedStepT);
            if (bot._autoStepTimer <= 0 || stepT >= 1) {
                finalX = bot._autoStepTargetX;
                finalZ = bot._autoStepTargetZ;
                bot._autoStepTimer = 0;
            }
        } else if (bot._kbTimer > 0) { // 🚀 優先執行擊退位移
            bot._kbTimer -= dt;
            finalX = pc.math.lerp(botPos.x, bot._kbTargetX, dt * 12);
            finalZ = pc.math.lerp(botPos.z, bot._kbTargetZ, dt * 12);
        } else if (!bot._isTransforming && !rushActive) {
            
            // 🌟 核心：套用微減速 (Micro-Snare)
            if (bot.snareTimer > 0) bot.snareTimer -= dt;
            var stealthMultiplier = bot.isStealth ? 1.2 : 1.0; 
            var currentSnare = (bot.snareTimer > 0) ? bot.snareMultiplier : 1.0;
            var speed = bot.config.speed * stealthMultiplier * currentSnare; 
            
            var nextX = botPos.x + currentMoveX * speed * dt; 
            var nextZ = botPos.z + currentMoveY * speed * dt;
            nextX = pc.math.clamp(nextX, -limitX, limitX); 
            nextZ = pc.math.clamp(nextZ, -limitZ, limitZ);

            var hitWallX = false; 
            var hitWallZ = false;
            if (this.app.combatManager) {
                if (!this.app.combatManager.checkCollision(nextX, botPos.z)) {
                    finalX = nextX;
                } else {
                    hitWallX = true;
                }

                if (!this.app.combatManager.checkCollision(botPos.x, nextZ)) {
                    finalZ = nextZ;
                } else {
                    hitWallZ = true;
                }
            }

            if (hitWallX || hitWallZ) {
                bot.moveTimer = 0;
                
                var targetAngle = bot.aimAngle;
                var found = false;
                var offsets = [Math.PI/4, -Math.PI/4, Math.PI/2, -Math.PI/2, Math.PI * 0.75, -Math.PI * 0.75, Math.PI];
                
                for (var oi = 0; oi < offsets.length; oi++) {
                    var tryAngle = targetAngle + offsets[oi];
                    var tryX = botPos.x + Math.sin(tryAngle) * 1.0;
                    var tryZ = botPos.z + Math.cos(tryAngle) * 1.0;
                    if (!this.app.combatManager.checkCollision(tryX, tryZ)) {
                        bot.moveDir.set(Math.sin(tryAngle), Math.cos(tryAngle));
                        bot.wallAvoidTimer = 0.5 + Math.random() * 0.3;
                        bot.wallAvoidAngle = tryAngle;
                        found = true;
                        break;
                    }
                }
                
                if (!found) {
                    bot.moveDir.set(Math.random() - 0.5, Math.random() - 0.5).normalize();
                    bot.wallAvoidTimer = 0.8;
                }
            }
        }
        bot.entity.setPosition(finalX, 0, finalZ);
        
        if (bot.attackAnimTimer > 0 || rushActive) {
            if (!bot._isTransforming) {
                bot.entity.setEulerAngles(0, bot.aimAngle * (180 / Math.PI), 0);
            }
        }
        else if (this._hasBossAttackModes(bot) && !bot._isTransforming && bot._faceLockTimer <= 0) {
            bot.entity.setEulerAngles(0, bot.aimAngle * (180 / Math.PI), 0);
        }
        else if (!bot._isTransforming && bot._faceLockTimer <= 0 && (Math.abs(currentMoveX) > 0.01 || Math.abs(currentMoveY) > 0.01)) { 
            bot.entity.setEulerAngles(0, Math.atan2(currentMoveX, currentMoveY) * (180 / Math.PI), 0);
        }

        if (bot.animEntity && bot.animEntity.anim) {
            var speedMag = (bot.attackAnimTimer > 0) ? 0 : Math.sqrt(currentMoveX * currentMoveX + currentMoveY * currentMoveY);
            if (bot.hitStopTimer <= 0) {
                bot.animEntity.anim.setFloat('speed', speedMag); 
            }
            
            if (bot.animEntity.anim.layers) {
                for (var l = 0; l < bot.animEntity.anim.layers.length; l++) {
                    var layer = bot.animEntity.anim.layers[l];
                    if (layer.name === 'Shoot') {
                        var isFullBodyAttack = (bot.brawlerType === 'guanyu' || bot.brawlerType === 'lubu' || bot.brawlerType === 'zhangfei' || bot.brawlerType === 'liubei');
                        var isActiveAttack = bot.attackAnimTimer > 0;
                        
                        var targetWeight = (isActiveAttack && !isFullBodyAttack) ? 1.0 : 0.0;
                        layer.weight = pc.math.lerp(layer.weight, targetWeight, dt * 15);
                        break;
                    }
                }
            }
        }

        bot.timeSinceLastAttack += dt;
        if (bot.ammo < bot.config.ammo) {
            var botReloadTime = bot.config.reloadTime !== undefined ? bot.config.reloadTime : 1.5;
            
            if (bot.timeSinceLastAttack >= botReloadTime) {
                bot.ammo = bot.config.ammo;
                bot.isReloading = false;
            } else {
                bot.isReloading = true;
            }
        } else {
            bot.isReloading = false;
        }

        if (bot.burstRemaining > 0) {
            bot.burstTimer -= dt;
            if (bot.burstTimer <= 0) {
                var atkConf = bot._currentAttackConfig || bot.config;
                var pType = atkConf.attackPattern === 'flamethrower' ? 'wave' : (atkConf.attackPattern || atkConf.type || 'normal');
                var CR = window.CombatResolver;
                var pCount = (CR && CR.getBurstProjectileCount) ? CR.getBurstProjectileCount(atkConf) : (atkConf.spreadCount || atkConf.projectileCount || 1);
                var tRad = (atkConf.spreadAngle || 0) * Math.PI / 180;
                
                var burstSpawnPos = bot.entity.getPosition().clone();

                if (pType === 'super_homing_bomb' || pType === 'homing') {
                    for (var h = 0; h < pCount; h++) {
                        var finalAHoming = bot.aimAngle;
                        var spawnX = burstSpawnPos.x;
                        var spawnZ = burstSpawnPos.z;
                        if (pCount > 1) {
                            finalAHoming = bot.aimAngle - tRad / 2 + (tRad / (pCount - 1)) * h;
                            spawnX += Math.sin(finalAHoming) * 0.5;
                            spawnZ += Math.cos(finalAHoming) * 0.5;
                        }
                        if (this.app.combatManager) this.app.combatManager.executeSuperHomingBomb('bot', bot.id, bot.team, bot.brawlerType, {x: spawnX, z: spawnZ}, finalAHoming, atkConf);
                    }
                } else {
                    for (var bi = 0; bi < pCount; bi++) {
                        var a = bot.aimAngle;
                        if (pCount > 1) {
                            a = (window.CombatResolver && CombatResolver.getSpreadAngle)
                                ? CombatResolver.getSpreadAngle(bot.aimAngle, atkConf.spreadAngle || 0, bi, pCount)
                                : (bot.aimAngle - tRad / 2 + (tRad / (pCount - 1)) * bi);
                        }
                        a += (Math.random() - 0.5) * 0.04;
                        if(this.app.combatManager) {
                            this.app.combatManager.fireProjectile('bot', bot.id, bot.team, bot.brawlerType, burstSpawnPos, a, pType, 1.0, atkConf);
                        }
                    }
                }
                bot.burstRemaining--;
                bot.burstTimer = atkConf.burstInterval || 0.08;
            }
        }
        
        if (bot.superBurstRemaining > 0) {
            bot.superBurstTimer -= dt;
            if (bot.superBurstTimer <= 0) {
                var sConf = bot.config.super || {}; 
                var sCount = sConf.burstCount || 6; 
                var sIdx = sCount - bot.superBurstRemaining;
                if(this.app.combatManager) {
                    if (sConf.type === 'super_zhouyu_burst' || sConf.type === 'super_skyfall') {
                        // skyfall 一次排程
                    } 
                    else if (sConf.type === 'super_zhangfei_roar') {
                        var mergedConf = Object.assign({}, bot.config, sConf);
                        mergedConf.type = sConf.type || 'super_zhangfei_roar'; 
                        mergedConf.isSuper = true; 
                        this.app.combatManager.fireProjectile('bot', bot.id, bot.team, bot.brawlerType, botPos, bot.superBurstAngle || bot.aimAngle, 'wave', 1.0, mergedConf);
                    }
                    else if (sConf.type === 'super_whirlwind') {
                        var aWhirl = (bot.superBurstAngle || bot.aimAngle) + (Math.PI / 4) * sIdx;
                        var spawnWhirlX = botPos.x + Math.sin(aWhirl) * 1.5;
                        var spawnWhirlZ = botPos.z + Math.cos(aWhirl) * 1.5;
                        this._tempVec3.set(spawnWhirlX, 0, spawnWhirlZ);
                        this.app.combatManager.fireProjectile('bot', bot.id, bot.team, bot.brawlerType, this._tempVec3, aWhirl, 'melee', 1.0, sConf);
                    }
                }
                bot.superBurstRemaining--;
                bot.superBurstTimer = sConf.burstInterval || 0.15;
            }
        }

        var canSeeTarget = targetPos && this.app.combatManager && this.app.combatManager.checkLOS(botPos.x, botPos.z, targetPos.x, targetPos.z);
        if (pendingPattern === 'lob' || pendingPattern === 'homing' || pendingPattern === 'super_homing_bomb' || pendingPattern === 'super_skyfall' || pendingPattern === 'super_zhouyu_burst') canSeeTarget = true; 

        // 🧱 固定方位攻擊:覆寫瞄準角、免「有目標」要求(可對空),但仍尊重 effectiveRange
        //    (noBasicAttack 把 effectiveRange 設 0 時不觸發普攻;大招時為 9999 照放)
        var aimA = bot.aimAngle;
        var canTrigger = (targetPos && distToTarget <= effectiveRange);
        if (bot._aimFixed) {
            aimA = bot._aimFixedAngle;
            bot.aimAngle = aimA;                     // 同步朝向
            canTrigger = (effectiveRange > 0);       // 免目標,但 effectiveRange=0(noBasicAttack)時仍不觸發
        }

        var bossRecovering = this._hasBossAttackModes(bot) && (bot._bossRecoverTimer || 0) > 0;
        var skyfallBusy = this.app.combatManager && this.app.combatManager.hasActiveSkyfallFor &&
            this.app.combatManager.hasActiveSkyfallFor('bot', bot.id);
        if (canTrigger && bot.burstRemaining <= 0 && bot.superBurstRemaining <= 0 && canSeeTarget && !bot._isTransforming && bot.attackAnimTimer <= 0 && !rushActive && !bossRecovering && !skyfallBusy) {
            bot.shootTimer -= dt;
            
            if (bot.shootTimer <= 0) {
                if (bot.isStealth) { 
                    bot.isStealth = false;
                    bot.stealthTimer = 0; 
                    this._restoreBotMaterials(bot);
                }
                if (bot.invincibleTimer > 0) { 
                    bot.invincibleTimer = 0;
                    this._restoreBotMaterials(bot); 
                }
                
                bot.revealTimer = 2.5;
                this._setBotVisibility(bot, true); 
                bot.lastVisibility = true;
                if (bot.invincibleTimer <= 0) this._restoreBotMaterials(bot);

                var hasNonSuperQueued = false;
                for (var qi = 0; qi < bot.attackQueue.length; qi++) {
                    if (!bot.attackQueue[qi].isSuper) { hasNonSuperQueued = true; break; }
                }

                var nowMs = Date.now();
                if (bot.superTimer <= 0 && bot.config.super) {
                    bot.shootTimer = 0.1 + Math.random() * 0.15; // 大招維持高頻檢查/觸發，不被 attackEvery 限制
                    this._executeBotSuper(bot, aimA, 1.0);
                } else if (bot.ammo > 0 && !hasNonSuperQueued) {
                    // ✅ ROGUE 普攻節流：到點才允許觸發一次普攻（不改招式內部 burst/連段節奏）
                    if (!bot._attackEvery || nowMs >= (bot._nextBasicAttackAt || 0)) {
                        if (bot._attackEvery) bot._nextBasicAttackAt = nowMs + bot._attackEvery * 1000;
                        bot.shootTimer = 0.1 + Math.random() * 0.15;
                        this._executeBotAttack(bot, aimA, 1.0);
                    } else {
                        // 未到點：保持頻繁檢查，但不會出普攻
                        bot.shootTimer = 0.1 + Math.random() * 0.15;
                    }
                } else {
                    // 沒打出去就別卡太久；下一幀再看一次條件(例如 queued 清空/裝填完成)
                    bot.shootTimer = 0.1 + Math.random() * 0.15;
                }
            }
        }
        
        // ==========================================
        // 🌟 動態狀態標籤分配器 (Emoji 視覺版)
        // ==========================================
        if (this.app.floatingUIManager && bot.state === 'alive') {
            // 友軍不應掛破綻印（僅敵軍顯示「破」）
            if (bot._breachMark && window.CombatResolver && CombatResolver._isEnemyOfPlayer &&
                !CombatResolver._isEnemyOfPlayer(this.app, bot)) {
                bot._breachMark = null;
            }
            var statusEmojis = (window.CombatResolver && CombatResolver.buildStatusIcons)
                ? CombatResolver.buildStatusIcons(bot)
                : '';
            if (!statusEmojis) {
                if (bot.stunTimer > 0 && bot._initialStunDuration >= 0.5) statusEmojis += "💫";
                if (WordSystem.hasActiveBleedDot(bot.activeStates)) statusEmojis += "☠️";
                if (WordSystem.hasActiveFireDot(bot.activeStates)) statusEmojis += "🔥";
            }
            this.app.floatingUIManager.updateStatus(bot.entity, statusEmojis, null);
        }
        
        // ==========================================
        // 🌟 視覺受擊形變 (Squash & Stretch) 彈簧回歸
        // ==========================================
        if (bot.animEntity && bot.state === 'alive') {
            var isBigBoss = this._hasBossAttackModes(bot);
            var damping = isBigBoss ? 0.88 : 0.7;
            var stiffness = isBigBoss ? 0.22 : 0.5;

            bot._squashVelocity = (bot._squashVelocity || 0) - (bot._squashScale * stiffness);
            bot._squashVelocity *= damping;
            bot._squashScale += bot._squashVelocity;
            if (isBigBoss && Math.abs(bot._squashScale) < 0.003) {
                bot._squashScale = 0;
                bot._squashVelocity = 0;
            }

            var s = 1.0 + bot._squashScale;
            var y = 1.0 - (bot._squashScale * 0.5);
            var mirror = bot._animMirrorSign || 1;
            bot.animEntity.setLocalScale(
                bot._baseAnimScale.x * mirror * s,
                bot._baseAnimScale.y * y,
                bot._baseAnimScale.z * s
            );
        }
    }

    // 🌟 在所有實體移動完畢後，執行純邏輯防重疊推擠
    this._handleSoftCollision(dt);

    if (anyUrgentGlow && this.app.combatManager && this.app.combatManager.tickPreAttackGlowPulse) {
        this.app.combatManager.tickPreAttackGlowPulse(dt);
    }
};

BotController.prototype._setBotWeaponVisible = function(bot, visible) {
    if (!bot.weaponProps) return;
    for (var i = 0; i < bot.weaponProps.length; i++) {
        if (bot.weaponProps[i]) bot.weaponProps[i].enabled = visible;
    }
};

BotController.prototype._setBotAnimMirror = function(bot, on) {
    if (!bot) return;
    bot._animMirrorSign = on ? -1 : 1;
    if (!bot.animEntity || !bot._baseAnimScale) return;
    var sq = bot._squashScale || 0;
    var s = 1.0 + sq;
    var y = 1.0 - (sq * 0.5);
    bot.animEntity.setLocalScale(
        bot._baseAnimScale.x * bot._animMirrorSign * s,
        bot._baseAnimScale.y * y,
        bot._baseAnimScale.z * s
    );
};

// 🌟 新增：純邏輯防重疊引擎 (Soft Collision)
BotController.prototype._handleSoftCollision = function(dt) {
    var collisionRadius = 1.0; // 兩人距離小於 1.0 就判定為重疊
    var pushForce = dt * 5.0;  // 平滑推擠的力道

    // 1. Bot 與 Bot 之間的互斥
    for (var i = 0; i < this.bots.length; i++) {
        var botA = this.bots[i];
        if (botA.state !== 'alive' || botA._dashTimer > 0 || botA._autoStepTimer > 0 || botA._rushState !== 'none') continue; 
        
        var posA = botA.entity.getPosition();

        for (var j = i + 1; j < this.bots.length; j++) {
            var botB = this.bots[j];
            if (botB.state !== 'alive' || botB._dashTimer > 0 || botB._autoStepTimer > 0 || botB._rushState !== 'none') continue;

            var posB = botB.entity.getPosition();
            var dx = posA.x - posB.x;
            var dz = posA.z - posB.z;
            var dist = Math.sqrt(dx * dx + dz * dz);

            // 防除零陷阱 (Anti-NaN Jitter)
            if (dist < 0.001) {
                dx = (Math.random() - 0.5) * 0.01;
                dz = (Math.random() - 0.5) * 0.01;
                dist = Math.sqrt(dx * dx + dz * dz);
            }

            if (dist < collisionRadius) {
                var overlap = collisionRadius - dist;
                var pushX = (dx / dist) * overlap * pushForce;
                var pushZ = (dz / dist) * overlap * pushForce;

                // Boss 盡量不要被推來推去（避免原地抖動）：遇到 Boss 時只推開非 Boss 的那一方
                var aBoss = !!botA.isBoss;
                var bBoss = !!botB.isBoss;
                var targetAx = posA.x, targetAz = posA.z;
                var targetBx = posB.x, targetBz = posB.z;
                if (aBoss && !bBoss) {
                    targetBx = posB.x - (pushX * 2); targetBz = posB.z - (pushZ * 2);
                } else if (!aBoss && bBoss) {
                    targetAx = posA.x + (pushX * 2); targetAz = posA.z + (pushZ * 2);
                } else {
                    targetAx = posA.x + pushX; targetAz = posA.z + pushZ;
                    targetBx = posB.x - pushX; targetBz = posB.z - pushZ;
                }

                // 穿牆防護網
                if (this.app.combatManager) {
                    if (this.app.combatManager.checkCollision(targetAx, targetAz)) { targetAx = posA.x; targetAz = posA.z; }
                    if (this.app.combatManager.checkCollision(targetBx, targetBz)) { targetBx = posB.x; targetBz = posB.z; }
                }

                if (targetAx !== posA.x || targetAz !== posA.z) botA.entity.setPosition(targetAx, 0, targetAz);
                if (targetBx !== posB.x || targetBz !== posB.z) botB.entity.setPosition(targetBx, 0, targetBz);
                
                posA.x = targetAx; posA.z = targetAz;
                posB.x = targetBx; posB.z = targetBz;
            }
        }

        // 2. Bot 與 玩家 (Player) 之間的互斥
        var pCtrl = this.app.playerController;
        if (pCtrl && pCtrl.player && !pCtrl.isDead) {
            // 檢查玩家豁免權
            if (pCtrl._dashTimer <= 0 && pCtrl._autoStepTimer <= 0 && (!pCtrl._rushState || pCtrl._rushState === 'none')) {
                var posP = pCtrl.player.getPosition();
                var pdx = posA.x - posP.x;
                var pdz = posA.z - posP.z;
                var pDist = Math.sqrt(pdx * pdx + pdz * pdz);

                if (pDist < 0.001) {
                    pdx = (Math.random() - 0.5) * 0.01;
                    pdz = (Math.random() - 0.5) * 0.01;
                    pDist = Math.sqrt(pdx * pdx + pdz * pdz);
                }

                if (pDist < collisionRadius) {
                    // Boss 不要被 soft collision 推（避免抖動）；玩家自己有 dodge/移動控制，這裡先不強推玩家
                    if (botA.isBoss) continue;
                    var pOverlap = collisionRadius - pDist;
                    var pPushX = (pdx / pDist) * pOverlap * pushForce;
                    var pPushZ = (pdz / pDist) * pOverlap * pushForce;

                    var targetAx = posA.x + pPushX; var targetAz = posA.z + pPushZ;
                    var targetPx = posP.x - pPushX; var targetPz = posP.z - pPushZ;

                    if (this.app.combatManager) {
                        if (this.app.combatManager.checkCollision(targetAx, targetAz)) { targetAx = posA.x; targetAz = posA.z; }
                        if (this.app.combatManager.checkCollision(targetPx, targetPz)) { targetPx = posP.x; targetPz = posP.z; }
                    }

                    botA.entity.setPosition(targetAx, 0, targetAz);
                    pCtrl.player.setPosition(targetPx, 0, targetPz);
                }
            }
        }

        // 3. Bot 與 Enemy（真人對手）之間的互斥
        // 🌟 鐵律：enemy 位置由 server 權威同步，這裡【只推 bot】，不動 enemy（否則下個封包會回溯覆蓋）
        var enemyDict = this.app.enemyManager ? this.app.enemyManager.enemies : null;
        if (enemyDict) {
            for (var eid in enemyDict) {
                var eObj = enemyDict[eid];
                if (!eObj.entity || !eObj.entity.enabled) continue;
                if (eObj.hp <= 0 || eObj.s === 3) continue;

                var posE = eObj.entity.getPosition();
                var edx = posA.x - posE.x;
                var edz = posA.z - posE.z;
                var eDist = Math.sqrt(edx * edx + edz * edz);

                if (eDist < 0.001) {
                    edx = (Math.random() - 0.5) * 0.01;
                    edz = (Math.random() - 0.5) * 0.01;
                    eDist = Math.sqrt(edx * edx + edz * edz);
                }

                if (eDist < collisionRadius) {
                    var eOverlap = collisionRadius - eDist;
                    // 只推 bot：用全量 overlap（因為 enemy 不動，bot 要負責整個分離量）
                    var ePushX = (edx / eDist) * eOverlap * pushForce;
                    var ePushZ = (edz / eDist) * eOverlap * pushForce;

                    var targetEAx = posA.x + ePushX;
                    var targetEAz = posA.z + ePushZ;

                    if (this.app.combatManager && this.app.combatManager.checkCollision(targetEAx, targetEAz)) {
                        targetEAx = posA.x; targetEAz = posA.z;
                    }

                    botA.entity.setPosition(targetEAx, 0, targetEAz);
                    posA.x = targetEAx; posA.z = targetEAz;   // 更新供後續迴圈
                }
            }
        }
    }
};

// 1759 行函式簽名與時長
BotController.prototype._flashBotWhite = function (bot, isHeavy) {
    if (bot.isStealth) return;
        if (this.app.combatManager) {
                this.app.combatManager.applyHitFlash(bot.entity);
     }
        bot.flashTimer = isHeavy ? 0.18 : 0.10;
    };

BotController.prototype._restoreBotMaterials = function (bot) {
    if (!bot || bot.state === 'dead') return;
    var targetOpacity = bot.isStealth ? 0.4 : 1.0;
    
    var isEnemyToMe = (this.app.myTeam === 'none' || bot.team !== this.app.myTeam);
    if (!isEnemyToMe && bot.inBush && bot.revealTimer <= 0 && !bot.isStealth) {
        targetOpacity = 0.6;
    }

    if (this.app.combatManager) {
        this.app.combatManager.setEntityOpacity(bot.entity, targetOpacity);
    }
    this._syncBotPreAttackGlowVisual(bot);
};

BotController.prototype._updateHealthBar = function (bot) {
    if (this.app.floatingUIManager && bot.entity) {
        this.app.floatingUIManager.updateHealth(bot.entity, bot.health);
    }
};

BotController.prototype._respawnBot = function (bot) {
    bot.state = 'alive';
    bot.health = bot.maxHealth; 
    bot.ammo = bot.config.ammo;
    bot.lastDamageTime = Date.now();
    bot.comboIndex = 0; 
    bot.lastAttackTime = 0;
    bot.timeSinceLastAttack = 0;
    bot.isReloading = false;
    bot.stunTimer = 0;
    bot._initialStunDuration = 0;
    bot.attackQueue = []; 
    bot.activeStates = {};
    this._setBotWeaponVisible(bot, false);
    
    bot.burstRemaining = 0; 
    bot.burstTimer = 0;
    bot.superBurstRemaining = 0;
    bot.superBurstTimer = 0;
    bot.superTimer = (bot._canSuper && bot.config && bot.config.super) ? (15 + Math.random() * 10) : 999;
    bot.attackAnimTimer = 0;
    this._setBotAnimMirror(bot, false);
    bot.hitStopTimer = 0;
    bot.dashCharges = 2;

    // 🌟 重置衝刺狀態機（與 PlayerController 同步）
    bot._rushState = 'none';
    bot._rushTimer = 0;
    bot._rushDistTraveled = 0;
    bot._rushAfterimageConf = null;
    bot._rushAfterimageTimer = 0;
    bot._faceLockTimer = 0;
    
    // 🌟 重置形變與擊退狀態
    bot._squashScale = 0; 
    bot._squashVelocity = 0;
    bot.snareTimer = 0;
    bot._kbTimer = 0;
    bot._targetScanTimer = 0;   // 🌟 重生立刻重算目標
    bot._cachedTarget = null;
    bot._cachedGem = null;
    bot.gemCount = 0;
    
    var spawn = { x: 0, z: 0 };
    if (this.app.gameModeManager) spawn = this.app.gameModeManager.getSafeSpawnPoint(bot.team, bot.slot);
    
    bot.entity.setPosition(spawn.x, 0, spawn.z);
    if (bot.entity.rigidbody) bot.entity.rigidbody.teleport(spawn.x, 0, spawn.z);
    bot.entity.enabled = true; 
    
    bot.invincibleTimer = this.invincibleTime; bot.isStealth = false; bot.stealthTimer = 0; bot.revealTimer = 0;
    bot._isTransforming = false; bot._dashTimer = 0; bot._autoStepTimer = 0;
    
    if (bot.animEntity) bot.animEntity.setLocalPosition(0, 0, 0); 
    this._resetBotAnimation(bot);
    this._restoreBotMaterials(bot); 
    this._updateHealthBar(bot);
    this._setBotVisibility(bot, true);
    
    if (this.app.floatingUIManager && this.app.floatingUIManager.updateGems) {
        this.app.floatingUIManager.updateGems(bot.entity, 0);
    }
};

BotController.prototype._onRoundStart = function () {
    var isKnockout = this.app.gameModeManager && this.app.gameModeManager.currentMode === '3V3_KNOCKOUT';
    if (!this.isActive || !isKnockout) return;
    
    for (var i = 0; i < this.bots.length; i++) { 
        this._respawnBot(this.bots[i]);
    }
};

BotController.prototype._applyPerfectCounterToHitMeta = function (hitMeta, attackerId, damage) {
    hitMeta = hitMeta || {};
    if (!(damage > 0)) return hitMeta;
    if (hitMeta.isDotTick || hitMeta._perfectCounterApplied) return hitMeta;

    var isPlayerAtk = (attackerId === 'player') || (this.app.socketId && attackerId === this.app.socketId);
    if (!isPlayerAtk) return hitMeta;

    var app = this.app;
    if (!app || !app._perfectCounterActive) return hitMeta;

    var until = app._perfectCounterUntilMs || 0;
    if (until && Date.now() > until) {
        app._perfectCounterActive = false;
        return hitMeta;
    }

    var stunAmt = Number(app._perfectCounterStun) || 0.5;
    hitMeta.stunDuration = Math.max(Number(hitMeta.stunDuration) || 0, stunAmt);
    hitMeta._perfectCounterApplied = true;

    app._perfectCounterActive = false;
    app._perfectCounterUntilMs = 0;
    app._perfectCounterStun = 0;
    var pc = app.playerController;
    if (pc) {
        pc._perfectCounterStun = 0;
        pc._perfectCounterExpire = 0;
    }
    return hitMeta;
};

BotController.prototype.hitBot = function (botIndex, damage, attackerId, hitMeta) {
    var bot = this.bots[botIndex];
    if (!bot || bot.state !== 'alive') {
        return;
    }
    if (this.app.gameModeManager && this.app.gameModeManager.isRoundOver) return;

    hitMeta = hitMeta || {};
    var isHeal = damage < 0;
    if (!isHeal && this.app.gameModeManager && this.app.gameModeManager.isMatchOver) return;

    if (bot.invincibleTimer > 0 && !isHeal) {
        return;
    }

    if (attackerId && !isHeal) {
        var aTeam = 'none';
        if (attackerId === 'player') {
            aTeam = this.app.myTeam;
        } else {
            // 先從自己的 bots 陣列查(不依賴 scoreManager,ROGUE 下 scoreManager 無 bot 資料)
            for (var ai = 0; ai < this.bots.length; ai++) {
                if (this.bots[ai].id === attackerId) { aTeam = this.bots[ai].team; break; }
            }
            if (aTeam === 'none' && this.app.scoreManager && this.app.scoreManager._scores[attackerId]) {
                aTeam = this.app.scoreManager._scores[attackerId].team;
            }
        }
        if (aTeam === bot.team && aTeam !== 'none') {
            return;
        }
    }

    hitMeta.attackerId = attackerId;
    hitMeta.attackerType = (attackerId === 'player') ? 'player' : 'bot';
    if (!isHeal && damage > 0 && window.CombatResolver && window.CombatResolver._getUnit) {
        var atkU = window.CombatResolver._getUnit(this.app, attackerId, hitMeta.attackerType);
        if (atkU && atkU.trueStrike) {
            hitMeta.trueStrike = true;
            hitMeta.ignoreDodge = true;
            hitMeta.pierceShield = true;
        }
    }

    if (!isHeal && damage > 0) {
        var isPlayerAtk = (attackerId === 'player') || (this.app.socketId && attackerId === this.app.socketId);
        var skipPerfect = hitMeta && (hitMeta.isDotTick || hitMeta._perfectCounterApplied);
        if (isPlayerAtk && !skipPerfect) {
            hitMeta = this._applyPerfectCounterToHitMeta(hitMeta, attackerId, damage);
        }
    }

    if (!isHeal && damage > 0 && window.CombatResolver && window.CombatResolver.tryDodgeIncoming) {
        if (window.CombatResolver.tryDodgeIncoming(this.app, bot, bot.entity, damage, hitMeta)) return;
    }
    
    var isComboFinish = hitMeta.isCrit || hitMeta.isCombo || false;
    var scaleMult = hitMeta ? hitMeta.scale : 1.0;
    var displayDamage = damage;

    if (!isHeal && damage > 0 && !hitMeta._combatResolved && window.CombatResolver && window.CombatResolver.resolveOutgoingHit) {
        var attackerType = (attackerId === 'player') ? 'player' : 'bot';
        var resolved = window.CombatResolver.resolveOutgoingHit(this.app, attackerId, attackerType, bot, damage, hitMeta);
        damage = resolved.damage;
        displayDamage = resolved.displayDamage;
        hitMeta = resolved.hitMeta;
        hitMeta._combatResolved = true;
        isComboFinish = resolved.isCrit || isComboFinish;
        if (bot.entity && this.app.floatingUIManager && this.app.floatingUIManager.updateShield) {
            this.app.floatingUIManager.updateShield(bot.entity, bot.shieldHP || 0, bot.shieldMax || 0);
        }
    }

    // 周瑜灼熱濺射：命中帶火 DoT 的目標，依本次傷害濺射（不消耗灼燒；須在餘燼前）
    if (!isHeal && damage > 0 && window.CombatResolver && window.CombatResolver.tryBurnSplash) {
        window.CombatResolver.tryBurnSplash(
            this.app, attackerId, (attackerId === 'player') ? 'player' : 'bot', bot, damage, hitMeta
        );
    }

    // 餘燼：在已結算的命中上追加即時火焰（並濺射；消耗灼燒）
    if (!isHeal && damage > 0 && !hitMeta.isEmberSplash && !hitMeta.isBurnSplash && window.CombatResolver && window.CombatResolver.tryEmberDetonate) {
        var emberBonus = window.CombatResolver.tryEmberDetonate(this.app, attackerId, (attackerId === 'player') ? 'player' : 'bot', bot, hitMeta);
        if (emberBonus > 0) {
            damage += emberBonus;
            displayDamage += emberBonus;
            isComboFinish = true;
        }
    }

    if (isHeal) {
        bot.health -= damage;
        bot.health = Math.min(bot.health, bot.maxHealth);
        this.app.fire('ui:floatingDamage', bot.entity.getPosition(), "+" + (-damage), false, this._healColor);
    } else {
    if (!isHeal && damage > 0 && window.CombatResolver && window.CombatResolver.getEffectiveDamageTakenMul) {
        damage *= window.CombatResolver.getEffectiveDamageTakenMul(bot);
    }
        if (bot._damageTakenMul && bot._damageTakenMul !== 1) damage *= bot._damageTakenMul;
        bot.health -= damage;
        if (!isHeal && damage > 0 && window.CombatResolver && window.CombatResolver.tryLifestealHeal) {
            window.CombatResolver.tryLifestealHeal(this.app, attackerId, hitMeta.attackerType, damage, hitMeta);
        }
        // 🎓 教學演武：可受擊反饋，但鎖定最低 1 HP（避免完美閃避練習被打死卡關）
        if (bot._tutorialImmortal && bot.health <= 0) bot.health = 1;
        bot.lastDamageTime = Date.now(); 
        bot.revealTimer = 2.5;
        this._setBotVisibility(bot, true);
        bot.lastVisibility = true;
        
        if (bot.isStealth) { 
            bot.isStealth = false;
            bot.stealthTimer = 0; 
            this._restoreBotMaterials(bot); 
        } else if (bot.health > 0) { 
            // 只有沒打死才白閃；打死交給死亡變灰
            this._flashBotWhite(bot, hitMeta && hitMeta.isCombo);
        }
        
        // 🌟 視覺受擊形變 (Flinch)
        var configFlinch = (hitMeta && hitMeta.flinchAmount !== undefined) ? hitMeta.flinchAmount : 0.15;
        if (configFlinch > 0) {
            bot._squashScale = this._hasBossAttackModes(bot) ? Math.min(configFlinch, 0.05) : configFlinch;
        }
        
        // 🌟 接收微減速 (Micro-Snare)
        if (hitMeta && hitMeta.snareDuration) {
            bot.snareTimer = hitMeta.snareDuration;
            bot.snareMultiplier = hitMeta.snareMultiplier !== undefined ? hitMeta.snareMultiplier : 0.6;
        }
        
        // 🌟 暈眩攔截：中斷 AI 所有行動
        var stunDur = (hitMeta && hitMeta.stunDuration !== undefined && hitMeta.stunDuration !== null)
            ? Number(hitMeta.stunDuration) : 0;
        // Rogue：護盾存在時免疫暈眩
        var isRogue2 = this.app && this.app.gameModeManager && this.app.gameModeManager.currentMode === 'ROGUE';
        if (isRogue2 && (bot.shieldHP || 0) > 0) stunDur = 0;

        if (stunDur > 0 || (hitMeta && hitMeta.snareDuration)) {
            if (window.CombatResolver && window.CombatResolver.onCrowdControlApplied) {
                window.CombatResolver.onCrowdControlApplied(this.app, bot, {
                    stunDuration: stunDur,
                    snareDuration: hitMeta.snareDuration || 0,
                    snareMultiplier: hitMeta.snareMultiplier
                });
            }
        }

        if (stunDur > 0) {
            bot.stunTimer = Math.max(bot.stunTimer || 0, stunDur);
            bot._initialStunDuration = stunDur;
            
            bot.attackQueue = [];
            bot.attackAnimTimer = 0;
            this._setBotAnimMirror(bot, false);
            bot._dashTimer = 0;
            bot.burstRemaining = 0;
            bot.superBurstRemaining = 0;
            this._setBotWeaponVisible(bot, false);

            // 🌟 暈眩同步中斷衝刺狀態機
            bot._rushState = 'none';
            bot._rushTimer = 0;
            bot._rushDistTraveled = 0;
            bot._rushAfterimageConf = null;
            bot._rushAfterimageTimer = 0;
            
            bot._isTransforming = false;
            bot.comboIndex = 0;
            this._resetBotAnimation(bot);

            if (this.app.floatingUIManager && bot.entity && stunDur >= 0.5) {
                this.app.floatingUIManager.updateStatus(bot.entity, '💫', null);
            }
        } else if (isRogue2 && (bot.shieldHP || 0) > 0) {
            // 盾在：用盾 icon 取代暈眩 icon（避免玩家誤會有被暈）
            if (this.app.floatingUIManager && bot.entity) {
                this.app.floatingUIManager.updateStatus(bot.entity, '🛡', null);
            }
        }

        // 🚀 新增：實體擊退 (Knockback) 完美植入此處！
        // 🚀 核心修正：解除大於 0 的限制，只要不是 0 就觸發 (支援負數吸力)
        var bossNoKb = this._hasBossAttackModes(bot);
        if (!bossNoKb && hitMeta && Math.abs(hitMeta.knockbackDist) > 0.01 && hitMeta.hitAngle !== undefined) {
            var targetPos = bot.entity.getPosition(); // PlayerController 則為 this.player.getPosition()
            
            var limitX = this.app.gameModeManager ? this.app.gameModeManager.mapLimitX : 11.5;
            var limitZ = this.app.gameModeManager ? this.app.gameModeManager.mapLimitZ : 10.0;
            
            var absDist = Math.abs(hitMeta.knockbackDist);     // 🌟 取絕對值來跑迴圈
            var dirSign = hitMeta.knockbackDist > 0 ? 1 : -1;  // 🌟 判斷是推(正)還是吸(負)
            
            var stepSize = 0.2, curDist = 0;
            var safeX = targetPos.x; var safeZ = targetPos.z;
            
            while (curDist < absDist) {
                curDist += stepSize;
                if (curDist > absDist) curDist = absDist;
                
                // 🌟 乘上 dirSign：如果是負數，就會自動朝著子彈「飛來的反方向(也就是攻擊者)」拉過去
                var nx = targetPos.x + Math.sin(hitMeta.hitAngle) * (curDist * dirSign);
                var nz = targetPos.z + Math.cos(hitMeta.hitAngle) * (curDist * dirSign);
                
                if (nx > limitX || nx < -limitX || nz > limitZ || nz < -limitZ) break;
                if (this.app.combatManager && this.app.combatManager.checkCollision(nx, nz)) break;
                safeX = nx; safeZ = nz;
            }
            
            bot._kbTargetX = safeX; // PlayerController 則為 this._kbTargetX = safeX
            bot._kbTargetZ = safeZ;
            bot._kbTimer = 0.15;    // 不論推或吸，都在 0.15 秒內極速滑行完畢
        }

        if (damage > 0) {
            if (!bossNoKb && !bot._noDodge && bot.stunTimer <= 0 && bot.dashCharges > 0 && bot._dashTimer <= 0 && !bot._isTransforming && !bot._isTransformed && bot.state === 'alive') {
                if (Math.random() < 0.25) { 
                    bot.dashCharges--;
                    var rollA = bot.aimAngle + Math.PI + (Math.random() - 0.5);
                    this._executeBotRoll(bot, rollA);
                }
            }
        }
        
        var isTrueCrit = !!(hitMeta && hitMeta.isCrit);
        this.app.fire('ui:floatingDamage', bot.entity.getPosition(), displayDamage, isComboFinish, null, scaleMult, isTrueCrit);
        this.app.fire('fx:hit', bot.entity.getPosition());
    }

    this._updateHealthBar(bot);
    
    if (bot.health <= 0) {
        bot._isTransforming = false;
        bot.attackQueue = []; 
        bot.activeStates = {};
        
        this._setBotWeaponVisible(bot, false);
        
        if (bot._isTransformed && bot.config && bot.config.isMecha) {
            this._revertBotTransform(bot);
            return; 
        }
        
        // 不要 _resetBotAnimation：會改姿勢；死亡要定格最後一幀
        bot.health = 0;
        this._beginDeathVanish(bot, false);

        if (bot._currentBushIdx !== -1) {
            if (this.app.gameModeManager)
                this.app.gameModeManager.setBushTransparent(bot._currentBushIdx, false);
            bot._currentBushIdx = -1;
        }
        
        if (bot.gemCount > 0) {
            if (this.app.gameModeManager && this.app.gameModeManager.isMatchOver) {
                bot.gemCount = 0;
                if (this.app.floatingUIManager && this.app.floatingUIManager.updateGems) {
                    this.app.floatingUIManager.updateGems(bot.entity, 0);
                }
            } else {
                var dropPos = bot.entity.getPosition();
                this.app.fire('bounty:dropGems', bot.gemCount, dropPos.x, dropPos.z);
                bot.gemCount = 0;
                if (this.app.floatingUIManager && this.app.floatingUIManager.updateGems) {
                    this.app.floatingUIManager.updateGems(bot.entity, 0);
                }
                var blueTotal = 0; var redTotal = 0;
                var pCtrl = this.app.playerController;
                if (pCtrl && pCtrl.gemCount) {
                    if (this.app.myTeam === 'blue') blueTotal += pCtrl.gemCount;
                    else if (this.app.myTeam === 'red') redTotal += pCtrl.gemCount;
                }
                for (var bi = 0; bi < this.bots.length; bi++) {
                    if (this.bots[bi].gemCount) {
                        if (this.bots[bi].team === 'blue') blueTotal += this.bots[bi].gemCount;
                        else if (this.bots[bi].team === 'red') redTotal += this.bots[bi].gemCount;
                    }
                }
                this.app.fire('bounty:updateTeamGems', blueTotal, redTotal);
            }
        }
        
        if (bot._isTransformed) {
            bot._isTransformed = false;
            bot._isTransforming = false;
            if (bot._originalBrawlerType) bot.brawlerType = bot._originalBrawlerType;
            if (bot._originalConfig) {
                bot.config = bot._originalConfig;
                bot.maxHealth = bot._originalMaxHealth || bot.maxHealth;
            }
            bot._originalConfig = null;
            bot._originalBrawlerType = '';
        }
        
        var isKnockout = this.app.gameModeManager && this.app.gameModeManager.currentMode === '3V3_KNOCKOUT';
        var isPVE = this.app.gameModeManager && this.app.gameModeManager.currentMode === 'PVE';
        var isRogue = this.app.gameModeManager && this.app.gameModeManager.currentMode === 'ROGUE';
        
        if (isKnockout || isPVE || isRogue) { 
            bot.respawnTimer = Infinity;
        } else { 
            bot.respawnTimer = 3;
        }
        
        bot.isStealth = false; 
        this._restoreBotMaterials(bot);
        if (attackerId && !isHeal) {
            this.app.fire('score:kill', { attackerId: attackerId, victimId: bot.id });
            if (window.CombatResolver && window.CombatResolver.onUnitKill) {
                window.CombatResolver.onUnitKill(this.app, attackerId, bot.id);
            }
        }
        this.app.fire('score:death', bot.id); 
        this.app.fire('game:killFeed', attackerId || 'Unknown', bot.id);
    }
};