var CombatManager = pc.createScript('combatManager');

// ==========================================
// 🌟 角色模型庫 (Character Models)
// ==========================================
CombatManager.attributes.add('gameGuanYu', { type: 'entity', title: 'Game GuanYu' });
CombatManager.attributes.add('gameZhangLiao', { type: 'entity', title: 'Game ZhangLiao' });
CombatManager.attributes.add('gameZhangJiao', { type: 'entity', title: 'Game ZhangJiao' });
CombatManager.attributes.add('gameCaoCao', { type: 'entity', title: 'Game CaoCao' });
CombatManager.attributes.add('gameZhouYu', { type: 'entity', title: 'Game ZhouYu' });
CombatManager.attributes.add('gameSunQuan', { type: 'entity', title: 'Game SunQuan' });
CombatManager.attributes.add('gameLuBu', { type: 'entity', title: 'Game LuBu' });
CombatManager.attributes.add('gameZhangFei', { type: 'entity', title: 'Game ZhangFei' });
CombatManager.attributes.add('gameDiaoChan', { type: 'entity', title: 'Game DiaoChan' });
CombatManager.attributes.add('gameLiuBei', { type: 'entity', title: 'Game LiuBei' });
CombatManager.attributes.add('gameDiaochanLubu', { type: 'entity', title: 'Game Diaochan LuBu (Mecha)' });
CombatManager.attributes.add('gameLiuBeiTree', { type: 'entity', title: 'Game LiuBei Tree (Peach Tree)' });
CombatManager.attributes.add('gameZhangBao', { type: 'entity', title: 'Game ZhangBao' });

// PVE 怪物模型
CombatManager.attributes.add('gameMinionMelee', { type: 'entity', title: 'PVE: Minion Melee' });
CombatManager.attributes.add('gameMinionRanged', { type: 'entity', title: 'PVE: Minion Ranged' });
CombatManager.attributes.add('gameMinionCB', { type: 'entity', title: 'PVE: Minion CB' });
CombatManager.attributes.add('gameBossZhangJiao', { type: 'entity', title: 'PVE: Boss ZhangJiao' });
CombatManager.attributes.add('skinLibraryRoot', { type: 'entity', title: 'Skin Library Root' });
CombatManager.attributes.add('skinMapJson', { type: 'string', default: '{}', title: 'Skin Map JSON' });

// ==========================================
// 🌟 武器與特效庫 (Bullets & AOEs)
// ==========================================
CombatManager.attributes.add('bulletTemplate', { type: 'entity', title: 'Base Bullet' });
CombatManager.attributes.add('bulletGuanYu', { type: 'entity', title: 'Bullet GuanYu' });
CombatManager.attributes.add('bulletZhangLiao', { type: 'entity', title: 'bullet ZhangLiao' });
CombatManager.attributes.add('bulletZhangJiao', { type: 'entity', title: 'Bullet ZhangJiao' });
CombatManager.attributes.add('bulletCaoCao', { type: 'entity', title: 'Bullet CaoCao' });
CombatManager.attributes.add('bulletZhouYu', { type: 'entity', title: 'Bullet ZhouYu' });
CombatManager.attributes.add('bulletZhouYuL', { type: 'entity', title: 'Bullet ZhouYu Large' });
CombatManager.attributes.add('bulletSunQuan', { type: 'entity', title: 'Bullet SunQuan' });
CombatManager.attributes.add('bulletLuBu', { type: 'entity', title: 'Bullet LuBu' });
CombatManager.attributes.add('bulletZhangFei', { type: 'entity', title: 'Bullet ZhangFei' });
CombatManager.attributes.add('bulletDiaoChan', { type: 'entity', title: 'Bullet DiaoChan' });
CombatManager.attributes.add('bulletLiuBei', { type: 'entity', title: 'Bullet LiuBei' });
CombatManager.attributes.add('bulletDiaochanLubu', { type: 'entity', title: 'Bullet Diaochan LuBu (Mecha)' });

// 🌟 新增的自定義武器外觀 (Custom Bullet Keys)
CombatManager.attributes.add('bulletFireArrow', { type: 'entity', title: 'Bullet: Fire Arrow' });
CombatManager.attributes.add('bulletHomingBomb', { type: 'entity', title: 'Bullet: Homing Bomb' });
CombatManager.attributes.add('bulletPunchLight', { type: 'entity', title: 'Bullet: Punch Light' });
CombatManager.attributes.add('bulletPunchHeavy', { type: 'entity', title: 'Bullet: Punch Heavy' });
CombatManager.attributes.add('bulletSlashLight', { type: 'entity', title: 'Bullet: Slash Light' });
CombatManager.attributes.add('bulletSlashHeavy', { type: 'entity', title: 'Bullet: Slash Heavy' });
CombatManager.attributes.add('bulletSlashSHeavy', { type: 'entity', title: 'Bullet: Slash Super Heavy' });
CombatManager.attributes.add('bulletMinionMelee', { type: 'entity', title: 'Bullet: Minion Melee' });
CombatManager.attributes.add('bulletMinionRanged', { type: 'entity', title: 'Bullet: Minion Ranged' });
CombatManager.attributes.add('bulletBossZhangJiao', { type: 'entity', title: 'Bullet: Boss ZhangJiao' });
CombatManager.attributes.add('bulletSonic', { type: 'entity', title: 'Bullet: Sonic' });
CombatManager.attributes.add('bulletArcaneSigil', { type: 'entity', title: 'Bullet: Arcane Sigil (Word Card)' });

// AOE 特效庫
CombatManager.attributes.add('superGuanYuTemplate', { type: 'entity', title: 'Super GuanYu (GLB)' });
CombatManager.attributes.add('aoeTemplate', { type: 'entity', title: 'AOE Base Template' });
CombatManager.attributes.add('aoeZhouYu', { type: 'entity', title: 'AOE ZhouYu (Fire)' });
CombatManager.attributes.add('aoeZhangJiao', { type: 'entity', title: 'AOE ZhangJiao (Poison)' });
CombatManager.attributes.add('aoeZhangFei', { type: 'entity', title: 'AOE Zhangfei' });
CombatManager.attributes.add('aoeArrow', { type: 'entity', title: 'AOE Arrow' });
CombatManager.attributes.add('aoeZhangJiaoSuper', { type: 'entity', title: 'AOE ZhangJiao SUPER (Explosion)' });
CombatManager.attributes.add('aoeDiaoChan', { type: 'entity', title: 'AOE DiaoChan (Explode)' });
CombatManager.attributes.add('aoeCaoCao', { type: 'entity', title: 'AOE CaoCao (Decoy)' });
CombatManager.attributes.add('aoeLuBu', { type: 'entity', title: 'AOE LuBu (Shockwave)' });
CombatManager.attributes.add('aoeLiuBeiTree', { type: 'entity', title: 'AOE LiuBei Tree (Heal Aura)' });

CombatManager.prototype.initialize = function() {
    this.app.combatManager = this; 

    this.colors = {
        white: new pc.Color(1, 1, 1, 1),
        redLight: new pc.Color(1, 0.2, 0.2, 1),
        redDark: new pc.Color(0.8, 0, 0, 1),
        blueLight: new pc.Color(0.2, 0.8, 1.0, 1),
        blueDark: new pc.Color(0, 0.4, 0.8, 1),
        greenAura: new pc.Color(0.2, 1.0, 0.4, 0.3),
        greenEmissive: new pc.Color(0.1, 0.8, 0.2, 1)
    };
    this._tempColor = new pc.Color();

    this.characterMap = {
        'guanyu': this.gameGuanYu, 'zhangliao': this.gameZhangLiao,
        'zhangjiao': this.gameZhangJiao, 'caocao': this.gameCaoCao, 
        'zhouyu': this.gameZhouYu, 'sunquan': this.gameSunQuan, 'lubu': this.gameLuBu, 'zhangfei': this.gameZhangFei,
        'diaochan': this.gameDiaoChan, 'liubei': this.gameLiuBei,
        'diaochan_lubu': this.gameDiaochanLubu || this.gameLuBu,
        'liubei_tree': this.gameLiuBeiTree || this.gameLiuBei,
        'zhangbao': this.gameZhangBao || this.gameMinionMelee,
        'zhangbao_throw': this.gameMinionRanged || this.gameMinionMelee,
        'zhangbao_bow': this.gameMinionCB || this.gameMinionMelee,
        // brawlerConfig.modelKey（黃巾兄弟三形態）；與敵方 minion_* 分開，避免玩家皮被怪池蓋掉
        'playerminion_melee': this.gameZhangBao || this.gameMinionMelee,
        'playerminion_ranged': this.gameMinionRanged || this.gameMinionMelee,
        'playerminion_CB': this.gameMinionCB || this.gameMinionMelee,
        'minion_melee': this.gameMinionMelee, 'minion_ranged': this.gameMinionRanged, 'minion_CB': this.gameMinionCB, 'boss_zhangjiao': this.gameBossZhangJiao
    };
    this.skinTemplateMap = this._buildSkinTemplateMap();

    this.bulletMap = {
        'guanyu': this.bulletGuanYu || this.bulletTemplate, 
        'zhangliao': this.bulletZhangLiao || this.bulletTemplate,
        'zhangjiao': this.bulletZhangJiao || this.bulletTemplate,
        'caocao': this.bulletCaoCao || this.bulletTemplate, 
        'zhouyu': this.bulletZhouYu || this.bulletTemplate,
        'zhouyuL': this.bulletZhouYuL || this.bulletTemplate,
        'sunquan': this.bulletSunQuan || this.bulletZhouYu || this.bulletTemplate,
        'lubu': this.bulletLuBu || this.bulletTemplate, 
        'zhangfei': this.bulletZhangFei || this.bulletTemplate,
        'diaochan': this.bulletDiaoChan || this.bulletTemplate, 
        'liubei': this.bulletLiuBei || this.bulletTemplate,
        'diaochan_lubu': this.bulletDiaochanLubu || this.bulletLuBu || this.bulletTemplate,
        'minion_melee': this.bulletMinionMelee || this.bulletTemplate, 
        'minion_ranged': this.bulletMinionRanged || this.bulletTemplate,
        'boss_zhangjiao': this.bulletBossZhangJiao || this.bulletTemplate,
        'homing_bomb': this.bulletHomingBomb || this.bulletTemplate,
        'firearrow': this.bulletFireArrow || this.bulletTemplate,
        'punch_light': this.bulletPunchLight || this.bulletTemplate,
        'punch_heavy': this.bulletPunchHeavy || this.bulletTemplate,
        'slash_light': this.bulletSlashLight || this.bulletTemplate,
        'slash_heavy': this.bulletSlashHeavy || this.bulletTemplate,
        'sonic': this.bulletSonic || this.bulletTemplate,
        'slash_Sheavy': this.bulletSlashSHeavy || this.bulletTemplate,
        'sguanyu': this.superGuanYuTemplate || this.bulletTemplate,
        'arcane_sigil': this.bulletArcaneSigil || this.bulletTemplate
    };

    this.aoeMap = {
        'aoeArrow': this.aoeArrow || this.aoeTemplate,
        'zhouyu': this.aoeZhouYu || this.aoeTemplate,
        'zhangjiao': this.aoeZhangJiao || this.aoeTemplate,
        'zhangfei': this.aoeZhangFei || this.aoeTemplate,
        'zhangjiao_super': this.aoeZhangJiaoSuper || this.aoeZhangJiao || this.aoeTemplate,
        'diaochan': this.aoeDiaoChan || this.aoeTemplate,
        'caocao': this.aoeCaoCao || this.aoeTemplate,
        'lubu': this.aoeLuBu || this.aoeTemplate,
        'diaochan_lubu': this.aoeLuBu || this.aoeTemplate,
        'liubei_tree': this.aoeLiuBeiTree || this.aoeTemplate
    };

    this.bulletPools = {}; 
    this.aoePools = {};
    this._skyfallPending = [];
    
    this._attachBlobShadows(); 
    this._initPools();
    this._prewarmTeamRings(); 
    
    this.flashMat = new pc.StandardMaterial();
    this.flashMat.useLighting = false; 
    this.flashMat.emissive.copy(this.colors.white);
    this.flashMat.emissiveIntensity = 1.0;
    this.flashMat.update();

    // 死亡專用灰暗：與 hit flash 同路徑（整材質替換），emissive 要夠亮才看得到
    this.deathGrayMat = new pc.StandardMaterial();
    this.deathGrayMat.useLighting = false;
    this.deathGrayMat.diffuse.set(0.42, 0.42, 0.45, 1);
    this.deathGrayMat.emissive.set(0.42, 0.42, 0.45, 1);
    this.deathGrayMat.emissiveIntensity = 1.0;
    this.deathGrayMat.update();

    // 🎯 ROGUE 預警：出招前紅光（前段偏暗、末段亮＋脈衝）
    this.preAttackMat = new pc.StandardMaterial();
    this.preAttackMat.useLighting = false;
    this.preAttackMat.diffuse.copy(this.colors.redDark);
    this.preAttackMat.emissive.copy(this.colors.redDark);
    this.preAttackMat.emissiveIntensity = 1.65;
    this.preAttackMat.update();

    this.preAttackUrgentMat = new pc.StandardMaterial();
    this.preAttackUrgentMat.useLighting = false;
    this.preAttackUrgentMat.diffuse.copy(this.colors.redLight);
    this.preAttackUrgentMat.emissive.copy(this.colors.redLight);
    this.preAttackUrgentMat.emissiveIntensity = 3.6;
    this.preAttackUrgentMat.update();
    this._preAttackUrgentPulseT = 0;
    this.PRE_ATTACK_URGENT_SEC = 0.25;

    // 🎯 ROGUE 指定目標標記（用金色光圈）
    // 以 canvas 產生圓環貼圖，避免「整片 plane」像招牌一樣插在身上
    var ringCanvas = document.createElement('canvas');
    ringCanvas.width = 256;
    ringCanvas.height = 256;
    var rctx = ringCanvas.getContext('2d');
    rctx.clearRect(0, 0, 256, 256);
    var cx = 128, cy = 128;
    // 外圈柔光
    var glow = rctx.createRadialGradient(cx, cy, 60, cx, cy, 120);
    glow.addColorStop(0.00, 'rgba(255,220,90,0.00)');
    glow.addColorStop(0.55, 'rgba(255,220,90,0.18)');
    glow.addColorStop(0.80, 'rgba(255,220,90,0.42)');
    glow.addColorStop(1.00, 'rgba(255,220,90,0.00)');
    rctx.fillStyle = glow;
    rctx.beginPath(); rctx.arc(cx, cy, 120, 0, Math.PI * 2); rctx.fill();
    // 主圓環（白色給 opacityMap / emissiveMap）
    rctx.strokeStyle = 'rgba(255,255,255,0.95)';
    rctx.lineWidth = 18;
    rctx.beginPath(); rctx.arc(cx, cy, 86, 0, Math.PI * 2); rctx.stroke();
    // 內圈淡一點，增加層次
    rctx.strokeStyle = 'rgba(255,255,255,0.35)';
    rctx.lineWidth = 6;
    rctx.beginPath(); rctx.arc(cx, cy, 70, 0, Math.PI * 2); rctx.stroke();

    this.rogueTargetTex = new pc.Texture(this.app.graphicsDevice, {
        format: pc.PIXELFORMAT_R8_G8_B8_A8,
        autoMipmap: false
    });
    this.rogueTargetTex.setSource(ringCanvas);
    this.rogueTargetTex.upload();

    this.rogueTargetMat = new pc.StandardMaterial();
    this.rogueTargetMat.useLighting = false;
    this.rogueTargetMat.opacity = 1.0;
    this.rogueTargetMat.blendType = pc.BLEND_ADDITIVE;
    this.rogueTargetMat.diffuse.set(0, 0, 0, 1);
    this.rogueTargetMat.emissive.set(1.0, 0.82, 0.1, 1);
    this.rogueTargetMat.opacityMap = this.rogueTargetTex;
    this.rogueTargetMat.emissiveMap = this.rogueTargetTex;
    this.rogueTargetMat.emissiveIntensity = 3.2;
    this.rogueTargetMat.update();

    // 🎯 Skyfall 預警圈：中心透 → 外緣實環（朱紅→暗金）
    var wCanvas = document.createElement('canvas');
    wCanvas.width = 256;
    wCanvas.height = 256;
    var wctx = wCanvas.getContext('2d');
    wctx.clearRect(0, 0, 256, 256);
    var wcx = 128, wcy = 128;
    // 內填充：中心近透明，向外漸濃
    var fill = wctx.createRadialGradient(wcx, wcy, 0, wcx, wcy, 112);
    fill.addColorStop(0.00, 'rgba(168,50,50,0.00)');
    fill.addColorStop(0.55, 'rgba(168,50,50,0.10)');
    fill.addColorStop(0.88, 'rgba(190,70,50,0.34)');
    fill.addColorStop(1.00, 'rgba(201,162,90,0.55)');
    wctx.fillStyle = fill;
    wctx.beginPath(); wctx.arc(wcx, wcy, 112, 0, Math.PI * 2); wctx.fill();
    // 外緣實環（暗金）
    wctx.strokeStyle = 'rgba(201,162,90,0.95)';
    wctx.lineWidth = 9;
    wctx.beginPath(); wctx.arc(wcx, wcy, 108, 0, Math.PI * 2); wctx.stroke();
    // 內細環（朱紅）增加層次
    wctx.strokeStyle = 'rgba(168,50,50,0.55)';
    wctx.lineWidth = 3;
    wctx.beginPath(); wctx.arc(wcx, wcy, 88, 0, Math.PI * 2); wctx.stroke();

    this.skyfallWarnTex = new pc.Texture(this.app.graphicsDevice, {
        format: pc.PIXELFORMAT_R8_G8_B8_A8,
        autoMipmap: false
    });
    this.skyfallWarnTex.setSource(wCanvas);
    this.skyfallWarnTex.upload();

    this.skyfallWarnMat = new pc.StandardMaterial();
    this.skyfallWarnMat.useLighting = false;
    this.skyfallWarnMat.opacity = 1.0;
    this.skyfallWarnMat.blendType = pc.BLEND_ADDITIVE;
    this.skyfallWarnMat.depthWrite = false;
    this.skyfallWarnMat.diffuse.set(0, 0, 0, 1);
    this.skyfallWarnMat.emissive.set(1.0, 1.0, 1.0, 1);
    this.skyfallWarnMat.opacityMap = this.skyfallWarnTex;
    this.skyfallWarnMat.emissiveMap = this.skyfallWarnTex;
    this.skyfallWarnMat.emissiveIntensity = 2.0;
    this.skyfallWarnMat.update();

    this._setTemplateMapsEnabled([this.characterMap, this.skinTemplateMap], false);

    this._prewarmShaders();
};

CombatManager.prototype._prewarmShaders = function() {
    // iOS／iPadOS：整段跳過，避免 loading 100% 後 OOM；改延後到首次使用時編譯
    var constrained = (typeof GameSettings !== 'undefined' && GameSettings.isMemoryConstrained)
        ? GameSettings.isMemoryConstrained()
        : (window.UiTouch && window.UiTouch.isIOS && window.UiTouch.isIOS());
    if (constrained) return;

    // 桌面／Android：分幀 prewarm（每幀少量），避免無痕冷啟動一次全開打爆 GPU → 黑畫面
    var allTemplates = [];
    var maps = [this.bulletMap, this.aoeMap, this.characterMap, this.skinTemplateMap];
    for (var m = 0; m < maps.length; m++) {
        for (var key in maps[m]) {
            if (maps[m][key] && allTemplates.indexOf(maps[m][key]) === -1) {
                allTemplates.push(maps[m][key]);
            }
        }
    }
    if (allTemplates.length === 0) return;

    var BATCH = 3;
    var index = 0;
    var self = this;
    var activeStates = [];

    var prepareState = function(t) {
        var state = { entity: t, cullStates: [] };
        var renders = t.findComponents('render');
        var models = t.findComponents('model');
        var meshes = renders.concat(models);
        for (var j = 0; j < meshes.length; j++) {
            for (var k = 0; k < meshes[j].meshInstances.length; k++) {
                var mi = meshes[j].meshInstances[k];
                state.cullStates.push({ mi: mi, cull: mi.cull });
                mi.cull = false;
            }
        }
        var particles = t.findComponents('particlesystem');
        for (var p = 0; p < particles.length; p++) particles[p].stop();
        return state;
    };

    var restoreStates = function(states) {
        for (var i = 0; i < states.length; i++) {
            var state = states[i];
            state.entity.enabled = false;
            for (var j = 0; j < state.cullStates.length; j++) {
                state.cullStates[j].mi.cull = state.cullStates[j].cull;
            }
        }
    };

    var step = function() {
        if (activeStates.length) {
            restoreStates(activeStates);
            activeStates = [];
        }
        if (index >= allTemplates.length) return;

        var end = Math.min(index + BATCH, allTemplates.length);
        for (; index < end; index++) {
            var t = allTemplates[index];
            var state = prepareState(t);
            t.enabled = true;
            activeStates.push(state);
        }
        self.app.once('postrender', step);
    };

    // 等大廳／戰鬥相機先畫幾幀再 prewarm，避免與冷啟動 WebGL 初始化搶峰值
    var warmFrames = 0;
    var afterWarm = function() {
        warmFrames++;
        if (warmFrames < 8) {
            self.app.once('postrender', afterWarm);
            return;
        }
        self.app.once('postrender', step);
    };
    this.app.once('postrender', afterWarm);
};

CombatManager.prototype._prewarmTeamRings = function() {
    this._teamRingMats = {};
    var createRingMat = function(isEnemy, colors) {
        var canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256; 
        var ctx = canvas.getContext('2d'); var rgb = isEnemy ? '255, 50, 50' : '50, 200, 255'; 
        ctx.beginPath(); ctx.arc(128, 128, 110, 0, 2 * Math.PI); ctx.fillStyle = 'rgba(' + rgb + ', 0.15)'; ctx.fill();
        ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(' + rgb + ', 0.9)'; ctx.stroke();
        var tex = new pc.Texture(this.app.graphicsDevice, { format: pc.PIXELFORMAT_R8_G8_B8_A8, autoMipmap: true }); tex.setSource(canvas);
        var rMat = new pc.StandardMaterial(); rMat.opacityMap = tex; rMat.opacityMapChannel = 'a'; rMat.emissiveMap = tex;
        rMat.emissive.copy(isEnemy ? colors.redLight : colors.blueLight); 
        rMat.emissiveIntensity = 1.5; 
        rMat.blendType = pc.BLEND_NORMAL; rMat.depthWrite = false; rMat.useLighting = false; rMat.update();
        return rMat;
    }.bind(this);

    this._teamRingMats.enemy = createRingMat(true, this.colors);
    this._teamRingMats.ally = createRingMat(false, this.colors);
};

CombatManager.prototype._attachBlobShadows = function() {
    // 🌟 升級版貼圖:256 解析度、中心濃實區更大、邊緣快速羽化
    var canvas = document.createElement('canvas'); 
    canvas.width = 256; canvas.height = 256; 
    var ctx = canvas.getContext('2d');
    var grd = ctx.createRadialGradient(128, 128, 0, 128, 128, 128); 
    grd.addColorStop(0.0,  'rgba(8, 12, 20, 0.85)');   // 深墨偏冷,不是純黑
    grd.addColorStop(0.55, 'rgba(8, 12, 20, 0.80)');   // 中心一大塊維持濃實
    grd.addColorStop(0.78, 'rgba(8, 12, 20, 0.42)');   // 接近邊緣才開始掉
    grd.addColorStop(1.0,  'rgba(8, 12, 20, 0)');      // 快速羽化收掉
    ctx.fillStyle = grd; ctx.fillRect(0, 0, 256, 256);

    var tex = new pc.Texture(this.app.graphicsDevice, { format: pc.PIXELFORMAT_R8_G8_B8_A8, autoMipmap: true }); 
    tex.setSource(canvas); tex.upload(); 

    var mat = new pc.StandardMaterial(); 
    mat.diffuse.set(0, 0, 0, 1);
    mat.emissive.set(0, 0, 0, 1); 
    mat.useLighting = false; 
    mat.blendType = pc.BLEND_NORMAL; 
    mat.depthWrite = false; 
    mat.opacityMap = tex; 
    mat.opacityMapChannel = 'a'; 
    mat.update();

    this._attachBlobShadowsToMap(this.characterMap, mat);
    this._attachBlobShadowsToMap(this.skinTemplateMap, mat);
};

CombatManager.prototype._buildSkinTemplateMap = function() {
    var out = {};
    var raw = this.skinMapJson || '{}';
    var map = {};
    try {
        map = JSON.parse(raw);
    } catch (e) {
        console.warn('[CombatManager] skinMapJson 解析失敗，已忽略。', e);
    }

    for (var skinKey in map) {
        if (!map.hasOwnProperty(skinKey)) continue;
        var entityName = map[skinKey];
        if (!entityName) continue;

        var tmpl = null;
        if (this.skinLibraryRoot && this.skinLibraryRoot.findByName) {
            tmpl = this.skinLibraryRoot.findByName(entityName);
        }
        if (!tmpl && this.app && this.app.root) {
            tmpl = this.app.root.findByName(entityName);
        }
        if (!tmpl) {
            console.warn('[CombatManager] 找不到 skin template: ' + skinKey + ' -> ' + entityName);
            continue;
        }
        out[skinKey] = tmpl;
    }

    return out;
};

CombatManager.prototype._setTemplateMapsEnabled = function(maps, enabled) {
    var seen = [];
    for (var i = 0; i < maps.length; i++) {
        var map = maps[i] || {};
        for (var key in map) {
            if (!map.hasOwnProperty(key)) continue;
            var tmpl = map[key];
            if (!tmpl || seen.indexOf(tmpl) !== -1) continue;
            tmpl.enabled = enabled;
            seen.push(tmpl);
        }
    }
};

CombatManager.prototype._attachBlobShadowsToMap = function(map, mat) {
    if (!map) return;
    for (var key in map) {
        if (!map.hasOwnProperty(key)) continue;
        var tmpl = map[key];
        if (!tmpl || tmpl.findByName('BlobShadow_' + key)) continue;

        var shadow = new pc.Entity('BlobShadow_' + key);
        shadow.addComponent('render', { type: 'plane', castShadows: false, receiveShadows: false });
        shadow.render.material = mat;
        // 🌟 略橢圓(Z 略扁)+ 比角色腳掌大一圈,從俯視角露得出來
        shadow.setLocalScale(2.0, 1, 1.6);
        shadow.setLocalPosition(0, 0.02, 0);   // 壓到 TeamRing(0.05)之下
        tmpl.addChild(shadow);
    }
};

CombatManager.prototype._initPools = function() {
    var allBulletKeys = new Set(Object.keys(this.bulletMap));
    
    if (window.BrawlerConfig) {
        for (var bType in window.BrawlerConfig) {
            var conf = window.BrawlerConfig[bType];
            if (conf.comboOverrides) {
                conf.comboOverrides.forEach(function(step) {
                    if (step.bulletKey) allBulletKeys.add(step.bulletKey);
                    if (step.extraAttacks) {
                        step.extraAttacks.forEach(function(extra) {
                            if (extra.bulletKey) allBulletKeys.add(extra.bulletKey);
                        });
                    }
                });
            }
            // 🌟 修正：補上大招 (super) 的預熱掃描，解決首次開大卡頓
            if (conf.super) {
                if (conf.super.bulletKey) allBulletKeys.add(conf.super.bulletKey);
                if (conf.super.lobAreaBulletKey) allBulletKeys.add(conf.super.lobAreaBulletKey);
                if (conf.super.extraAttacks) {
                    conf.super.extraAttacks.forEach(function(extra) {
                        if (extra.bulletKey) allBulletKeys.add(extra.bulletKey);
                    });
                }
            }
        }
    }

    allBulletKeys.forEach(function(t) {
        this.bulletPools[t] = [];
        var bTmpl = this.bulletMap[t] || this.bulletTemplate; 
        if (bTmpl) {
            var size = (t === 'homing_bomb' || t === 'boss_zhangjiao') ? 8 : 30;
            for (var j = 0; j < size; j++) {
                var b = bTmpl.clone();
                b._isFx = true;   // imelee 會掛到角色下；材質掃描須跳過，避免 pool 刀光被 flash/gray/glow 永久污染
                b.enabled = false;
                bTmpl.parent.addChild(b);
                this._snapshotPooledFxMaterials(b);
                this.bulletPools[t].push(b);
            }
        }
    }.bind(this));

    var types = Object.keys(this.aoeMap);
    for (var i = 0; i < types.length; i++) {
        var t = types[i];
        this.aoePools[t] = [];
        var aTmpl = this.aoeMap[t];
        if (aTmpl) {
            for (var k = 0; k < 10; k++) {
                var a = aTmpl.clone();
                a._isFx = true;
                a.enabled = false;
                aTmpl.parent.addChild(a);
                this._snapshotPooledFxMaterials(a);
                this.aoePools[t].push(a);
            }
        }
    }
};

CombatManager.prototype.getPooledBullet = function(t) { 
    var pool = this.bulletPools[t]; if (!pool) return null; 
    for (var i = pool.length - 1; i >= 0; i--) { 
        if (!pool[i].parent) { pool.splice(i, 1); continue; }   // 🌟 清掉陪葬的屍體
        if (!pool[i].enabled) { 
            pool[i].setLocalScale(1, 1, 1); 
            pool[i]._cachedMeshes = null;
            this.restorePooledFxMaterials(pool[i]);
            return pool[i]; 
        } 
    }
    var tmpl = this.bulletMap[t] || this.bulletTemplate; if (!tmpl) return null; 
    var b = tmpl.clone();
    b._isFx = true;
    b.enabled = false; tmpl.parent.addChild(b);
    this._snapshotPooledFxMaterials(b);
    pool.push(b); return b; 
};

CombatManager.prototype.getPooledAoe = function(t) { 
    var pool = this.aoePools[t]; if (!pool) return null; 
    for (var i = 0; i < pool.length; i++) { 
        if (!pool[i].enabled) { 
            pool[i].setLocalScale(1, 1, 1); 
            pool[i]._cachedMeshes = null;
            this.restorePooledFxMaterials(pool[i]);
            return pool[i]; 
        } 
    } 
    var tmpl = this.aoeMap[t] || this.aoeTemplate; if (!tmpl) return null; 
    var a = tmpl.clone();
    a._isFx = true;
    a.enabled = false; tmpl.parent.addChild(a);
    this._snapshotPooledFxMaterials(a);
    pool.push(a); return a; 
};

CombatManager.prototype.getCharacterTemplate = function(modelKey, skinKey) {
    if (skinKey) {
        var skinTmpl = this.skinTemplateMap[skinKey];
        if (skinTmpl) return skinTmpl;
        console.warn('[CombatManager] 找不到 skin 模型: ' + skinKey + '，改用角色預設模型');
    }
    var tmpl = this.characterMap[modelKey];
    if (tmpl) return tmpl;
    console.warn('[CombatManager] 找不到角色模型: ' + modelKey + '，請在 CombatManager 接線 gameZhangBao / gameMinionMelee');
    return this.gameZhouYu;
};

CombatManager.prototype.findAnimEntity = function(node) {
    if (!node) return null; if (node.anim) return node;
    for (var i = 0; i < node.children.length; i++) { var res = this.findAnimEntity(node.children[i]); if (res) return res; } 
    return null;
};

CombatManager.prototype.checkCollision = function (x, z) {
    if (!this.app.gameModeManager || !this.app.gameModeManager.obstacles) return false;
    var r = 0.4; var obs = this.app.gameModeManager.obstacles;
    for (var i = 0; i < obs.length; i++) {
        var o = obs[i]; 
        var cx = Math.max(o.x - o.hw, Math.min(x, o.x + o.hw)); var cz = Math.max(o.z - o.hd, Math.min(z, o.z + o.hd));
        if (Math.pow(x - cx, 2) + Math.pow(z - cz, 2) < r * r) return true;
    } return false;
};

CombatManager.prototype.checkLOS = function (x1, z1, x2, z2) {
    if (!this.app.gameModeManager || !this.app.gameModeManager.obstacles) return true;
    var obs = this.app.gameModeManager.obstacles;
    for (var i = 0; i < obs.length; i++) { 
        var o = obs[i]; if (o.isWater) continue;
        if (this._lineIntersectsAABB(x1, z1, x2, z2, o.x - o.hw, o.z - o.hd, o.x + o.hw, o.z + o.hd)) return false; 
    } return true;
};

CombatManager.prototype._lineIntersectsAABB = function (x1, z1, x2, z2, minX, minZ, maxX, maxZ) {
    var dx = x2 - x1; var dz = z2 - z1; var tmin = 0, tmax = 1;
    if (Math.abs(dx) > 0.0001) { 
        var tx1 = (minX - x1) / dx; var tx2 = (maxX - x1) / dx; 
        tmin = Math.max(tmin, Math.min(tx1, tx2)); tmax = Math.min(tmax, Math.max(tx1, tx2)); 
    } else if (x1 < minX || x1 > maxX) return false;
    
    if (Math.abs(dz) > 0.0001) { 
        var tz1 = (minZ - z1) / dz; var tz2 = (maxZ - z1) / dz; 
        tmin = Math.max(tmin, Math.min(tz1, tz2)); tmax = Math.min(tmax, Math.max(tz1, tz2)); 
    } else if (z1 < minZ || z1 > maxZ) return false;
    return tmax >= tmin;
};

CombatManager.prototype.tintHealthAndRing = function(entity, isEnemy) {
    var hpFill = entity.findByName('HealthFill');
    if (hpFill) hpFill.enabled = false;
    var hpBg = entity.findByName('HealthBackground');
    if (hpBg) hpBg.enabled = false;
    
    var oldRing = entity.findByName('TeamRing');
    if (oldRing) oldRing.destroy();
    
    var ring = new pc.Entity('TeamRing'); 
    ring.addComponent('render', { type: 'plane', castShadows: false, receiveShadows: false });
    ring.setLocalScale(1.8, 1, 1.8); ring.setLocalPosition(0, 0.05, 0);
    
    ring.render.meshInstances[0].material = isEnemy ? this._teamRingMats.enemy : this._teamRingMats.ally; 
    entity.addChild(ring);
};

CombatManager.prototype._meshUnderFx = function(mi) {
    if (!mi) return false;
    var node = mi.node || (mi.mesh && mi.mesh.node) || mi._entity;
    for (var p = node; p; p = p.parent) {
        if (p._isFx) return true;
    }
    return false;
};

CombatManager.prototype._isTempMat = function(mat) {
    return mat === this.flashMat || mat === this.deathGrayMat ||
        mat === this.preAttackMat || mat === this.preAttackUrgentMat;
};

CombatManager.prototype._captureOriginalMat = function(mi) {
    if (!mi) return;
    if (!mi._originalMat || this._isTempMat(mi._originalMat)) {
        if (mi.material && !this._isTempMat(mi.material)) {
            mi._originalMat = mi.material;
        }
    }
};

CombatManager.prototype._restoreOriginalMat = function(mi) {
    if (!mi || !mi._originalMat || this._isTempMat(mi._originalMat)) return false;
    mi.material = mi._originalMat;
    return true;
};

CombatManager.prototype._purgeFxFromMeshCache = function(entity) {
    if (!entity || !entity._cachedMeshes || !entity._cachedMeshes.length) return;
    var clean = [];
    for (var i = 0; i < entity._cachedMeshes.length; i++) {
        if (!this._meshUnderFx(entity._cachedMeshes[i])) clean.push(entity._cachedMeshes[i]);
    }
    if (clean.length !== entity._cachedMeshes.length) {
        entity._cachedMeshes = clean;
    }
};

CombatManager.prototype._snapshotPooledFxMaterials = function(entity) {
    if (!entity) return;
    var rs = entity.findComponents('render');
    var models = entity.findComponents('model');
    var all = rs.concat(models);
    for (var i = 0; i < all.length; i++) {
        var mis = all[i].meshInstances || [];
        for (var j = 0; j < mis.length; j++) {
            var mi = mis[j];
            if (!mi) continue;
            // 只在乾淨狀態快照；已被 temp mat 污染時不覆寫既有 snapshot
            if (mi._poolMatSnapshot) continue;
            if (mi.material && !this._isTempMat(mi.material)) {
                mi._poolMatSnapshot = mi.material;
            }
        }
    }
};

CombatManager.prototype.restorePooledFxMaterials = function(entity) {
    if (!entity || !entity._isFx) return;
    var rs = entity.findComponents('render');
    var models = entity.findComponents('model');
    var all = rs.concat(models);
    for (var i = 0; i < all.length; i++) {
        var mis = all[i].meshInstances || [];
        for (var j = 0; j < mis.length; j++) {
            var mi = mis[j];
            if (!mi) continue;
            var snap = mi._poolMatSnapshot;
            if (snap && !this._isTempMat(snap)) {
                if (mi.material !== snap) mi.material = snap;
                mi._originalMat = snap;
                continue;
            }
            if (mi._originalMat && !this._isTempMat(mi._originalMat) && this._isTempMat(mi.material)) {
                mi.material = mi._originalMat;
            }
        }
    }
    entity._fadeMeshes = null;
    entity._cachedMeshes = null;
};

CombatManager.prototype._getValidMeshInstances = function(entity) {
    if (entity._cachedMeshes) {
        this._purgeFxFromMeshCache(entity);
        return entity._cachedMeshes;
    }
    
    entity._cachedMeshes = [];
    var rs = entity.findComponents('render');
    var models = entity.findComponents('model'); 
    var all = rs.concat(models); 
    
    for (var i = 0; i < all.length; i++) {
        var meshEnt = all[i].entity;
        // pool FX（imelee 刀光等）會 reparent 到角色下；mesh 常在子節點，故往上查 _isFx
        var skipFx = false;
        for (var p = meshEnt; p; p = p.parent) {
            if (p._isFx) { skipFx = true; break; }
        }
        if (skipFx) continue;
        var name = meshEnt.name;
        if (name.indexOf('TeamRing') !== -1 || name.indexOf('SuperRing') !== -1 || name.indexOf('BlobShadow') !== -1) continue;
        
        for (var j = 0; j < all[i].meshInstances.length; j++) {
            var mi = all[i].meshInstances[j];
            if (this._meshUnderFx(mi)) continue;
            this._captureOriginalMat(mi);
            entity._cachedMeshes.push(mi);
        }
    }
    return entity._cachedMeshes;
};

CombatManager.prototype.applyHitFlash = function(entity) {
    if (!entity) return; 
    var meshes = this._getValidMeshInstances(entity);
    for (var i = 0; i < meshes.length; i++) {
        if (this._meshUnderFx(meshes[i])) continue;
        this._captureOriginalMat(meshes[i]);
        meshes[i].material = this.flashMat;
    }
};

CombatManager.prototype.applyDeathGray = function(entity) {
    if (!entity || entity._destroyed || !this.deathGrayMat) return;
    var meshes = this._getValidMeshInstances(entity);
    for (var i = 0; i < meshes.length; i++) {
        var mi = meshes[i];
        if (this._meshUnderFx(mi)) continue;
        this._captureOriginalMat(mi);
        mi.material = this.deathGrayMat;
    }
};

CombatManager.prototype.clearDeathVisual = function(entity) {
    if (!entity || entity._destroyed) return;
    var meshes = this._getValidMeshInstances(entity);
    for (var i = 0; i < meshes.length; i++) {
        this._restoreOriginalMat(meshes[i]);
    }
};

CombatManager.prototype.applyPreAttackGlow = function(entity, urgent) {
    if (!entity) return;
    var mat = urgent ? this.preAttackUrgentMat : this.preAttackMat;
    if (!mat) mat = this.preAttackMat;
    var meshes = this._getValidMeshInstances(entity);
    for (var i = 0; i < meshes.length; i++) {
        var mi = meshes[i];
        if (!mi) continue;
        if (this._meshUnderFx(mi)) continue;
        // 死亡灰保留；hit flash／前段↔末段紅光可被蓋過
        if (mi.material === this.deathGrayMat) continue;
        if (mi.material === mat) continue;
        this._captureOriginalMat(mi);
        mi.material = mat;
    }
};

// 末段共用材質脈衝（多敵同步閃，成本低）
CombatManager.prototype.tickPreAttackGlowPulse = function (dt) {
    if (!this.preAttackUrgentMat) return;
    this._preAttackUrgentPulseT = (this._preAttackUrgentPulseT || 0) + dt;
    var wave = 0.5 + 0.5 * Math.sin(this._preAttackUrgentPulseT * 16);
    this.preAttackUrgentMat.emissiveIntensity = 2.6 + 2.2 * wave;
    this.preAttackUrgentMat.update();
};

CombatManager.prototype.clearRogueTargetMarker = function(entity) {
    // RogueTargetMarker 掛在 app.root（不在角色底下），destroy 角色不會帶走光圈
    if (entity) {
        var old = entity.findByName('RogueTargetMarker');
        if (old) old.destroy();
        if (entity._rogueTargetMarker) {
            if (entity._rogueTargetMarker.destroy) entity._rogueTargetMarker.destroy();
            entity._rogueTargetMarker = null;
        }
    }
    if (!this._rogueTargetMarkers || this._rogueTargetMarkers.length === 0) return;
    for (var i = this._rogueTargetMarkers.length - 1; i >= 0; i--) {
        var m = this._rogueTargetMarkers[i];
        if (!m) { this._rogueTargetMarkers.splice(i, 1); continue; }
        if (!entity || m.target === entity) {
            if (m.ring && m.ring.destroy) m.ring.destroy();
            this._rogueTargetMarkers.splice(i, 1);
        }
    }
};

CombatManager.prototype.applyRogueTargetMarker = function(entity) {
    if (!entity) return;
    this.clearRogueTargetMarker(entity);

    var ring = new pc.Entity('RogueTargetMarker');
    ring.addComponent('render', { type: 'plane', castShadows: false, receiveShadows: false });
    // ✅ 不掛在角色 entity 下：避免角色骨架/旋轉把 ring 轉成直立「招牌」
    // 改掛到 app.root，並在 update 中每幀跟隨目標位置，永遠貼地面
    // PlayCanvas 的 render:plane 本來就是「貼地」(XZ) 的，旋轉 90 反而會變直立招牌
    ring.setEulerAngles(0, 0, 0);
    ring.setPosition(entity.getPosition().x, 0.08, entity.getPosition().z);
    ring.setLocalScale(2.6, 1, 2.6);
    if (ring.render && ring.render.meshInstances && ring.render.meshInstances[0]) {
        ring.render.meshInstances[0].material = this.rogueTargetMat;
    }
    this.app.root.addChild(ring);
    entity._rogueTargetMarker = ring;
    this._rogueTargetMarkers = this._rogueTargetMarkers || [];
    this._rogueTargetMarkers.push({ target: entity, ring: ring });
};

CombatManager.prototype.update = function(dt) {
    this._updateSkyfall(dt);

    if (!this._rogueTargetMarkers || this._rogueTargetMarkers.length === 0) return;
    for (var i = this._rogueTargetMarkers.length - 1; i >= 0; i--) {
        var m = this._rogueTargetMarkers[i];
        // destroy 後的 entity 可能仍回傳 enabled=true，需用 parent/_destroyed 判斷
        var deadTarget = !m || !m.ring || !m.target || m.target._destroyed || !m.target.parent || !m.target.enabled;
        if (deadTarget) {
            if (m && m.ring && m.ring.destroy) m.ring.destroy();
            if (m && m.target) m.target._rogueTargetMarker = null;
            this._rogueTargetMarkers.splice(i, 1);
            continue;
        }
        var p = m.target.getPosition();
        m.ring.setPosition(p.x, 0.08, p.z);
        m.ring.setEulerAngles(0, 0, 0);
    }
};

CombatManager.prototype.setEntityOpacity = function(entity, targetOpacity) {
    if (!entity) return; 
    var meshes = this._getValidMeshInstances(entity);
    
    for (var i = 0; i < meshes.length; i++) {
        var mi = meshes[i];
        if (this._meshUnderFx(mi)) continue;
        if (targetOpacity >= 1.0) {
            this._restoreOriginalMat(mi);
        }
        else {
            this._captureOriginalMat(mi);
            if (!mi._originalMat) continue;
            if (!mi._transparentMat) {
                mi._transparentMat = mi._originalMat.clone(); 
                mi._transparentMat.blendType = pc.BLEND_NORMAL; 
            }
            if (mi._transparentMat.opacity !== targetOpacity) {
                mi._transparentMat.opacity = targetOpacity;
                mi._transparentMat.update();
            }
            mi.material = mi._transparentMat;
        }
    }
};

CombatManager.prototype.setEntityVisibility = function(entity, isVisible) {
    if (!entity) return;
    var rs = entity.findComponents('render'); for (var i = 0; i < rs.length; i++) { rs[i].enabled = isVisible; }
};

// calculateJumpTarget：舊跳躍系統已移除
// 子彈左右翻轉（僅外觀；不改飛行／命中方向）。config.bulletFlip === true 時 X scale 取負。
CombatManager.prototype._setBulletScale = function(entity, sx, sy, sz, flip) {
    if (!entity) return;
    var ax = Math.abs(sx);
    entity.setLocalScale(flip ? -ax : ax, sy, sz);
};

// 🌟 升級：fireProjectile 統一路由中心 (完整支援 imelee 與特效綁定)
CombatManager.prototype.fireProjectile = function(ownerType, ownerId, team, brawlerType, pos, angleRad, bulletType, distanceRatio, config, comboIndex) {
    // 智慧路由分流 (攔截特殊機制)
    if (bulletType === 'lob') { this._fireLob(ownerType, ownerId, team, brawlerType, pos, angleRad, distanceRatio, config); return; }
    if (bulletType === 'homing' || bulletType === 'super_homing_bomb') { this.executeSuperHomingBomb(ownerType, ownerId, team, brawlerType, pos, angleRad, config); return; }
    if (bulletType === 'pierce' || bulletType === 'super_pierce') { this.executeSuperPierce(ownerType, ownerId, team, brawlerType, pos, angleRad, config); return; }
    if (bulletType === 'boomerang') { this._fireBoomerang(ownerType, ownerId, team, brawlerType, pos, angleRad, distanceRatio, config); return; }

    // 🌟🌟🌟 新增：找出攻擊者實體 (為了讓近戰/imelee特效可以綁定在角色身上跟著滑步)
    var attackerEntity = null;
    if (bulletType === 'imelee') {
        if (ownerType === 'player' && this.app.playerController) {
            attackerEntity = this.app.playerController.player || this.app.playerController.entity; 
        } else if (ownerType === 'bot') {
            var botCtrl = this.app.root.findByName('BotManager') ? this.app.root.findByName('BotManager').script.botController : null;
            if (botCtrl) {
                var bot = botCtrl.bots.find(function(x) { return x.id === ownerId; });
                if (bot) attackerEntity = bot.entity;
            }
        }
    }

    // 標準多彈頭發射
    var forwardX = Math.sin(angleRad); var forwardZ = Math.cos(angleRad); 
    var rightX = Math.cos(angleRad); var rightZ = -Math.sin(angleRad);
    var pCount = config.parallelShots || 1; var spacing = config.parallelSpacing || 0.4;
    
    var bKey = config.bulletKey || brawlerType;
    var aoeKey = config.lobAreaBulletKey || brawlerType;
    var bulletFlip = !!config.bulletFlip;

    for (var i = 0; i < pCount; i++) {
        var b = this.getPooledBullet(bKey); 
        if (!b) continue; b.enabled = true;
        
        var offset = (i - (pCount - 1) / 2) * spacing;
        var bScale = config.bulletScale !== undefined ? config.bulletScale : 1.0;
        this._setBulletScale(b, bScale, bScale, bScale, bulletFlip);
        
        // 🌟🌟🌟 核心修改：如果是近戰/imelee，解除場景綁定，改綁在攻擊者身上！
        if (bulletType === 'imelee' && attackerEntity) {
            // 硬清 cache，避免 FX 殘留在 _cachedMeshes 被 glow/flash 掃到
            attackerEntity._cachedMeshes = null;
            b.reparent(attackerEntity);
            b.setLocalPosition(0, 0.8, 1.2); // 刀光放在玩家正前方
            b.setLocalEulerAngles(0, 0, 0);  // 方向與玩家一致
        } else {
            // 普通遠程子彈，確保綁回場景根目錄
            b.reparent(this.app.root);
            
            var startX = pos.x + forwardX * 0.6 + rightX * offset; 
            var startZ = pos.z + forwardZ * 0.6 + rightZ * offset;
            if (bulletType === 'wave') { 
                startX = pos.x + forwardX * 0.8 + rightX * offset; 
                startZ = pos.z + forwardZ * 0.8 + rightZ * offset; 
            }
            
            b.setPosition(startX, 0.5, startZ);
            var rotY = angleRad * (180 / Math.PI); if (config.keepTextUpright && forwardX < 0) rotY += 180; b.setEulerAngles(0, rotY, 0);
        }
        
        if (b.findComponents('render').length === 0 && b.findComponents('model').length === 0) {
            b.addComponent('render', { type: bulletType === 'wave' ? 'cylinder' : 'box' });
            this._setBulletScale(b, 0.3 * bScale, 0.3 * bScale, 0.3 * bScale, bulletFlip);
            if (bulletType === 'melee' || bulletType === 'imelee') { 
                var mat = new pc.StandardMaterial(); 
                mat.diffuse.copy(this.colors.redLight); 
                mat.emissive.copy(this.colors.redDark); 
                mat.update(); b.render.meshInstances[0].material = mat; 
            }
        }

        // 🌟 確保近戰/imelee的速度被強制歸零
        var speed = config.bulletSpeed || 25; var maxLife = config.bulletLifetime || 0.5;
        if (bulletType === 'imelee') { 
            speed = 0; 
            maxLife = config.bulletLifetime || 0.12; 
        } else if (bulletType === 'wave') { 
            speed = config.bulletSpeed || 12; 
            maxLife = config.bulletLifetime || 0.6; 
        }
        
        if (this.app.bulletManager) { 
            this.app.bulletManager.addBullet({ 
                entity: b, startX: pos.x, startZ: pos.z, dirX: forwardX, dirZ: forwardZ, speed: speed, damage: config.bulletDamage, 
                ownerType: ownerType, ownerId: ownerId, ownerTeam: team, maxLife: maxLife, type: bulletType, 
                aoeTemplate: this.aoeMap[aoeKey] || this.aoeTemplate,
                config: config,
                isSuper: !!config.isSuper,
                comboIndex: comboIndex,
                bulletFlip: bulletFlip
            }); 
        }
    }
};

CombatManager.prototype.getLobRange = function(config) {
    config = config || {};
    var minR = config.lobMinRange !== undefined ? config.lobMinRange : 1.0;
    var mode = config.lobDurationMode || 'byDistance';
    var lobSpeed = config.lobSpeed !== undefined ? config.lobSpeed : 12;
    var minDur = config.lobMinDuration !== undefined ? config.lobMinDuration : 0;
    var maxDur = config.lobMaxDuration !== undefined ? config.lobMaxDuration : 0;
    var fixedDur = config.lobDuration !== undefined ? config.lobDuration : 1.1;
    var rangeDur = maxDur > 0 ? maxDur : 1.0;
    var maxR = config.lobMaxRange !== undefined ? config.lobMaxRange : (mode === 'byDistance' ? lobSpeed * rangeDur : lobSpeed * fixedDur);
    if (maxR < minR) maxR = minR;
    return {
        min: minR,
        max: maxR,
        duration: mode === 'fixed' ? fixedDur : maxDur,
        minDuration: mode === 'fixed' ? fixedDur : minDur,
        maxDuration: mode === 'fixed' ? fixedDur : maxDur
    };
};

CombatManager.prototype._resolveLobFlight = function(config, actualRange, lobInfo) {
    var minR = lobInfo.min;
    var maxR = lobInfo.max;
    var distRatio = maxR > minR ? (actualRange - minR) / (maxR - minR) : 1.0;
    var mode = config.lobDurationMode || 'byDistance';
    var lobGravity = config.lobGravity !== undefined ? config.lobGravity : 28;

    if (mode === 'fixed') {
        var fixedDur = config.lobDuration !== undefined ? config.lobDuration : 1.1;
        var fixedH = config.lobHeight !== undefined ? config.lobHeight : (lobGravity * fixedDur * fixedDur / 8);
        return {
            duration: fixedDur,
            height: fixedH,
            travelSpeed: actualRange / fixedDur,
            gravity: lobGravity
        };
    }

    var lobSpeed = config.lobSpeed !== undefined ? config.lobSpeed : 12;
    var lobDur = actualRange / Math.max(lobSpeed, 0.01);
    var minDur = config.lobMinDuration;
    var maxDur = config.lobMaxDuration;
    if (minDur !== undefined && minDur > 0) lobDur = Math.max(lobDur, minDur);
    if (maxDur !== undefined && maxDur > 0) lobDur = Math.min(lobDur, maxDur);

    var lobH = lobGravity * lobDur * lobDur / 8;
    if (config.lobHeight !== undefined) {
        var hMinScale = config.lobHeightMinScale !== undefined ? config.lobHeightMinScale : 0.55;
        lobH = config.lobHeight * (hMinScale + (1.0 - hMinScale) * distRatio);
    } else if (config.lobHeightMax !== undefined && lobH > config.lobHeightMax) {
        lobH = config.lobHeightMax;
    }

    return {
        duration: lobDur,
        height: lobH,
        travelSpeed: actualRange / lobDur,
        gravity: lobGravity
    };
};

CombatManager.prototype._fireLob = function(ownerType, ownerId, team, brawlerType, pos, angleRad, distanceRatio, config) {
    var count = config.lobCount || 1;
    var bKey = config.bulletKey || brawlerType;
    var aoeKey = config.lobAreaBulletKey || brawlerType;
    var lobInfo = this.getLobRange(config);
    var bulletFlip = !!config.bulletFlip;

    for (var n = 0; n < count; n++) {
        var b = this.getPooledBullet(bKey); 
        if (!b) continue; b.enabled = true;

        var spreadAngle = angleRad;
        if (count > 1) spreadAngle = angleRad + (n - (count - 1) / 2) * 0.15;

        var startX = pos.x + Math.sin(spreadAngle) * 0.6;
        var startZ = pos.z + Math.cos(spreadAngle) * 0.6;
        var dirX = Math.sin(spreadAngle);
        var dirZ = Math.cos(spreadAngle);
        var actualRange;

        if (config.lobTargetX !== undefined && config.lobTargetZ !== undefined) {
            var tdx = config.lobTargetX - startX;
            var tdz = config.lobTargetZ - startZ;
            var rawDist = Math.sqrt(tdx * tdx + tdz * tdz);
            if (rawDist > 0.05) {
                dirX = tdx / rawDist;
                dirZ = tdz / rawDist;
                spreadAngle = Math.atan2(dirX, dirZ);
            }
            actualRange = pc.math.clamp(rawDist, lobInfo.min, lobInfo.max);
        } else {
            var ratio = pc.math.clamp(distanceRatio !== undefined ? distanceRatio : 1, 0, 1);
            actualRange = lobInfo.min + (lobInfo.max - lobInfo.min) * ratio;
        }

        b.setPosition(startX, 0.5, startZ);
        b.setEulerAngles(0, spreadAngle * (180 / Math.PI), 0);

        var bScale = config.bulletScale !== undefined ? config.bulletScale : 1.0;
        this._setBulletScale(b, bScale, bScale, bScale, bulletFlip);

        var flight = this._resolveLobFlight(config, actualRange, lobInfo);

        if (this.app.bulletManager) { 
            this.app.bulletManager.addBullet({ 
                entity: b, startX: startX, startZ: startZ, dirX: dirX, dirZ: dirZ, 
                speed: flight.travelSpeed, damage: config.bulletDamage || 0, ownerType: ownerType, ownerId: ownerId, ownerTeam: team, 
                maxLife: flight.duration, type: 'lob', lobHeight: flight.height, lobGravity: flight.gravity,
                lobBaseY: 0.5, lobYaw: spreadAngle,
                aoeTemplate: this.aoeMap[aoeKey] || this.aoeTemplate, 
                config: config,          
                isSuper: !!config.isSuper,
                bulletFlip: bulletFlip
            }); 
        }
    }
};

CombatManager.prototype._fireBoomerang = function(ownerType, ownerId, team, brawlerType, pos, angleRad, distanceRatio, config) {
    var bKey = config.bulletKey || brawlerType;
    var b = this.getPooledBullet(bKey);
    if (!b) return;
    b.enabled = true;

    b.reparent(this.app.root);
    var startX = pos.x + Math.sin(angleRad) * 0.6;
    var startZ = pos.z + Math.cos(angleRad) * 0.6;
    b.setPosition(startX, 0.5, startZ);
    b.setEulerAngles(0, angleRad * (180 / Math.PI), 0);

    var bScale = config.bulletScale !== undefined ? config.bulletScale : 1.0;
    var bulletFlip = !!config.bulletFlip;
    this._setBulletScale(b, bScale, bScale, bScale, bulletFlip);

    if (this.app.bulletManager) {
        this.app.bulletManager.addBullet({
            entity: b,
            startX: startX, startZ: startZ,
            dirX: Math.sin(angleRad), dirZ: Math.cos(angleRad),
            launchDirX: Math.sin(angleRad),   // 🌟 發射方向鎖定,去程弧線用
            launchDirZ: Math.cos(angleRad),
            speed: config.boomerangSpeed || 12,
            damage: config.bulletDamage,
            ownerType: ownerType, ownerId: ownerId, ownerTeam: team,
            maxLife: 5.0,   // 安全上限,正常會在飛回主人時提前回收
            type: 'boomerang',
            config: config,
            isSuper: !!config.isSuper,
            aoeTemplate: null,
            bulletFlip: bulletFlip
        });
    }
};

// 🌟 替換原有的 executeSuperGuanYu，這是乾淨的通用衝鋒引擎
CombatManager.prototype.executeSuperPierce = function(ownerType, ownerId, team, brawlerType, pos, angleRad, config) {
    var isSuperSkill = config.isSuper || (config.type && config.type.indexOf('super_') !== -1);
    var skillConf = isSuperSkill && config.super ? config.super : config;
    
    var bKey = skillConf.bulletKey || brawlerType;
    var template = this.getPooledBullet(bKey) || this.superGuanYuTemplate; 
    if (!template) return;
    
    template.enabled = true;
    template.setPosition(pos.x + Math.sin(angleRad) * 1.5, 0.5, pos.z + Math.cos(angleRad) * 1.5); 
    template.setEulerAngles(0, angleRad * (180 / Math.PI), 0);
    
    var bScale = skillConf.bulletScale !== undefined ? skillConf.bulletScale : 1.0;
    var bulletFlip = !!(skillConf.bulletFlip || config.bulletFlip);
    
    if (template.findComponents('render').length === 0 && template.findComponents('model').length === 0) {
        template.addComponent('render', { type: 'box' });
        var mat = new pc.StandardMaterial(); 
        var c = window.BrawlerConfig && window.BrawlerConfig[brawlerType] ? window.BrawlerConfig[brawlerType].color : { r: 1, g: 1, b: 1 };
        mat.diffuse.set(c.r, c.g, c.b, 1); 
        mat.emissive.set(c.r * 0.8, c.g * 0.8, c.b * 0.8, 1); 
        mat.blendType = pc.BLEND_ADDITIVE; 
        mat.update(); 
        template.render.meshInstances[0].material = mat; 
        this._setBulletScale(template, 5 * bScale, 0.5 * bScale, 1.5 * bScale, bulletFlip);
    } else {
        this._setBulletScale(template, bScale, bScale, bScale, bulletFlip);
    }
    
    if (this.app.bulletManager) { 
        this.app.bulletManager.addBullet({ 
            entity: template, 
            dirX: Math.sin(angleRad), 
            dirZ: Math.cos(angleRad), 
            speed: skillConf.speed || skillConf.bulletSpeed || 14, 
            damage: (config.bulletDamage || 400) * (skillConf.damageMultiplier || 1), 
            ownerType: ownerType, 
            ownerId: ownerId, 
            ownerTeam: team, 
            maxLife: skillConf.maxLife || skillConf.bulletLifetime || 1.8, 
            type: skillConf.type || 'super_pierce',
            isSuper: !!config.isSuper,     
            config: config,
            bulletFlip: bulletFlip
        }); 
    }
};

CombatManager.prototype.executeSuperZhouYuBurst = function(ownerType, ownerId, team, brawlerType, pos, centerX, centerZ, shotIndex, totalCount, superConf) {
    // 舊 API 保留空殼避免外部殘留呼叫；請改用 beginSuperSkyfall / super_skyfall
    console.warn('[CombatManager] executeSuperZhouYuBurst 已廢棄，請改用 super_skyfall');
};

// =============================================================================
// super_skyfall：預警鎖地 → 延遲爆炸／tick（配置 targetMode + timingMode）
//   targetMode: 'nearest' | 'aim_chain'
//   timingMode: 'simultaneous' | 'stagger_explode' | 'sequential_mark'  (C1/C2/C3)
// =============================================================================

/** 估算 skyfall 整段鎖定時長（秒），供 attackAnimTimer 對齊，避免 sequential 未完又開下一輪 */
CombatManager.prototype.estimateSkyfallLockDuration = function(conf) {
    if (!conf) return 0;
    var timingMode = conf.timingMode || 'simultaneous';
    var maxTargets = conf.maxTargets || conf.burstCount || 3;
    var warn = conf.warnDelay !== undefined ? conf.warnDelay
        : (conf.fireDelay !== undefined ? conf.fireDelay : 1.0);
    var burstInterval = conf.burstInterval !== undefined ? conf.burstInterval : 0.3;
    if (timingMode === 'sequential_mark') {
        // 每發：標點 → 等 warn 爆炸 → burstInterval 空隙 → 下一標；約 N*(warn+interval)
        return Math.max(1, maxTargets) * (warn + burstInterval);
    }
    if (timingMode === 'stagger_explode') {
        return warn + Math.max(0, maxTargets - 1) * burstInterval;
    }
    return warn;
};

CombatManager.prototype.hasActiveSkyfallFor = function(ownerType, ownerId) {
    if (!this._skyfallPending || this._skyfallPending.length === 0) return false;
    for (var i = 0; i < this._skyfallPending.length; i++) {
        var s = this._skyfallPending[i];
        if (s && s.ownerType === ownerType && s.ownerId === ownerId) return true;
    }
    return false;
};

CombatManager.prototype.beginSuperSkyfall = function(ownerType, ownerId, team, brawlerType, casterPos, aimAngle, distanceRatio, superConf, lockEntity) {
    if (!superConf) return;
    // 同一施放者未結束的 skyfall 進行中則拒收，避免 sequential_mark 疊加連放
    if (this.hasActiveSkyfallFor(ownerType, ownerId)) return;
    this._skyfallPending = this._skyfallPending || [];

    var conf = superConf;
    var targetMode = conf.targetMode || 'nearest';
    var timingMode = conf.timingMode || 'simultaneous';
    var maxTargets = conf.maxTargets || conf.burstCount || 3;
    var range = conf.range !== undefined ? conf.range : 12;
    var fireDelay = conf.warnDelay !== undefined ? conf.warnDelay
        : (conf.fireDelay !== undefined ? conf.fireDelay : 1.0);
    var burstInterval = conf.burstInterval !== undefined ? conf.burstInterval : 0.3;
    var radius = conf.lobAreaRadius !== undefined ? conf.lobAreaRadius : (conf.explodeRadius || 1.8);

    var hostiles = this._skyfallCollectHostiles(ownerType, ownerId, team);
    var cx = casterPos.x !== undefined ? casterPos.x : casterPos.getPosition().x;
    var cz = casterPos.z !== undefined ? casterPos.z : casterPos.getPosition().z;

    var marks = []; // { x, z } locked ground points
    var entityQueue = []; // for sequential_mark re-sample

    if (targetMode === 'aim_chain') {
        var lock = this._skyfallResolveAimLock(lockEntity, hostiles, cx, cz, aimAngle, range, distanceRatio);
        for (var a = 0; a < maxTargets; a++) {
            entityQueue.push(lock.entity || null);
            marks.push({ x: lock.x, z: lock.z });
        }
    } else {
        // nearest：範圍內最近 N 個
        var scored = [];
        for (var h = 0; h < hostiles.length; h++) {
            var hx = hostiles[h].x - cx;
            var hz = hostiles[h].z - cz;
            var d2 = hx * hx + hz * hz;
            if (d2 <= range * range) scored.push({ h: hostiles[h], d2: d2 });
        }
        scored.sort(function(A, B) { return A.d2 - B.d2; });
        var take = Math.min(maxTargets, scored.length);
        for (var n = 0; n < take; n++) {
            entityQueue.push(scored[n].h.entity || null);
            marks.push({ x: scored[n].h.x, z: scored[n].h.z });
        }
        // 範圍內無敵人：朝瞄準方向落 1 發，避免大招空放完全沒事
        if (marks.length === 0) {
            var fb = this._skyfallAimFallbackPoint(cx, cz, aimAngle, range, distanceRatio);
            entityQueue.push(null);
            marks.push(fb);
        }
    }

    if (marks.length === 0) return;

    var session = {
        ownerType: ownerType,
        ownerId: ownerId,
        team: team,
        brawlerType: brawlerType,
        conf: conf,
        targetMode: targetMode,
        timingMode: timingMode,
        fireDelay: fireDelay,
        burstInterval: burstInterval,
        radius: radius,
        entityQueue: entityQueue,
        marks: marks,
        markIndex: 0,
        strikes: []
    };

    if (timingMode === 'sequential_mark') {
        session.phase = 'wait_mark';
        session.phaseTimer = 0; // 立刻標第一發
        this._skyfallPending.push(session);
        return;
    }

    // C1 / C2：施放當下鎖全部落地點並顯示預警
    for (var i = 0; i < marks.length; i++) {
        var explodeAt = fireDelay;
        if (timingMode === 'stagger_explode') explodeAt = fireDelay + i * burstInterval;
        this._skyfallArmStrike(session, marks[i].x, marks[i].z, explodeAt);
    }
    this._skyfallPending.push(session);
};

CombatManager.prototype._skyfallCanHitTeam = function(ownerTeam, targetTeam) {
    if (this.app.gameMode === '3V3_BOUNTY' || this.app.gameMode === '3V3_KNOCKOUT' || this.app.gameMode === 'ROGUE') {
        if (ownerTeam === 'none' || targetTeam === 'none') return true;
        return ownerTeam !== targetTeam;
    }
    return true;
};

CombatManager.prototype._skyfallCollectHostiles = function(ownerType, ownerId, ownerTeam) {
    var out = [];
    var pCtrl = this.app.playerController;
    if (pCtrl && pCtrl.player && !pCtrl.isDead) {
        if (!(ownerType === 'player' && ownerId === 'player') && this._skyfallCanHitTeam(ownerTeam, this.app.myTeam)) {
            var pp = pCtrl.player.getPosition();
            out.push({ entity: pCtrl.player, id: 'player', x: pp.x, z: pp.z });
        }
    }
    var botRoot = this.app.root.findByName('BotManager');
    var botCtrl = botRoot && botRoot.script ? botRoot.script.botController : null;
    if (botCtrl && botCtrl.bots) {
        for (var i = 0; i < botCtrl.bots.length; i++) {
            var b = botCtrl.bots[i];
            if (!b || b.state !== 'alive' || !b.entity) continue;
            if (ownerType === 'bot' && ownerId === b.id) continue;
            if (!this._skyfallCanHitTeam(ownerTeam, b.team)) continue;
            var bp = b.entity.getPosition();
            out.push({ entity: b.entity, id: b.id, x: bp.x, z: bp.z });
        }
    }
    if (this.app.enemyManager && this.app.enemyManager.enemies) {
        for (var eid in this.app.enemyManager.enemies) {
            var e = this.app.enemyManager.enemies[eid];
            if (!e || e.hp <= 0 || e.s === 3 || !e.entity) continue;
            if (ownerId === eid) continue;
            if (!this._skyfallCanHitTeam(ownerTeam, e.team)) continue;
            var ep = e.entity.getPosition();
            out.push({ entity: e.entity, id: eid, x: ep.x, z: ep.z });
        }
    }
    return out;
};

CombatManager.prototype._skyfallAimFallbackPoint = function(cx, cz, aimAngle, range, distanceRatio) {
    var ratio = distanceRatio !== undefined ? Math.max(0.25, Math.min(1, distanceRatio)) : 0.65;
    var dist = range * ratio;
    return {
        x: cx + Math.sin(aimAngle || 0) * dist,
        z: cz + Math.cos(aimAngle || 0) * dist
    };
};

CombatManager.prototype._skyfallResolveAimLock = function(lockEntity, hostiles, cx, cz, aimAngle, range, distanceRatio) {
    if (lockEntity && !lockEntity._destroyed && lockEntity.parent) {
        var lp = lockEntity.getPosition();
        return { entity: lockEntity, x: lp.x, z: lp.z };
    }
    // 無 lock：扇形／最近敵；再不行落瞄準點
    var best = null;
    var bestDot = -999;
    var fx = Math.sin(aimAngle || 0);
    var fz = Math.cos(aimAngle || 0);
    for (var i = 0; i < hostiles.length; i++) {
        var hx = hostiles[i].x - cx;
        var hz = hostiles[i].z - cz;
        var len = Math.sqrt(hx * hx + hz * hz) || 1;
        if (len > range) continue;
        var dot = (hx / len) * fx + (hz / len) * fz;
        if (dot > 0.35 && dot > bestDot) {
            bestDot = dot;
            best = hostiles[i];
        }
    }
    if (best) return { entity: best.entity, x: best.x, z: best.z };
    if (hostiles.length > 0) {
        var scored = hostiles.slice().sort(function(A, B) {
            var da = (A.x - cx) * (A.x - cx) + (A.z - cz) * (A.z - cz);
            var db = (B.x - cx) * (B.x - cx) + (B.z - cz) * (B.z - cz);
            return da - db;
        });
        if (scored[0]) return { entity: scored[0].entity, x: scored[0].x, z: scored[0].z };
    }
    var fb = this._skyfallAimFallbackPoint(cx, cz, aimAngle, range, distanceRatio);
    return { entity: null, x: fb.x, z: fb.z };
};

CombatManager.prototype._skyfallSampleEntityPos = function(entity, fallback) {
    if (entity && !entity._destroyed && entity.parent && entity.enabled) {
        var p = entity.getPosition();
        return { x: p.x, z: p.z };
    }
    return { x: fallback.x, z: fallback.z };
};

CombatManager.prototype._skyfallCreateWarn = function(x, z, radius) {
    var ring = new pc.Entity('SkyfallWarn');
    ring._isFx = true;
    ring.addComponent('render', { type: 'plane', castShadows: false, receiveShadows: false });
    var mat = this.skyfallWarnMat;
    if (ring.render && ring.render.meshInstances && ring.render.meshInstances[0] && mat) {
        ring.render.meshInstances[0].material = mat;
    }
    var scale = Math.max(0.8, radius * 2);
    ring.setLocalScale(scale, 1, scale);
    ring.setPosition(x, 0.08, z);
    this.app.root.addChild(ring);
    return ring;
};

CombatManager.prototype._skyfallArmStrike = function(session, x, z, explodeIn) {
    var warn = this._skyfallCreateWarn(x, z, session.radius);
    session.strikes.push({
        x: x,
        z: z,
        timer: explodeIn,
        warn: warn,
        done: false
    });
};

CombatManager.prototype._skyfallSpawnImpact = function(x, z, session) {
    var conf = session.conf || {};
    var bm = this.app.bulletManager;
    if (!bm) return;

    var aoeKey = conf.lobAreaBulletKey || session.brawlerType || 'zhouyu';
    var template = this.aoeMap[aoeKey] || this.aoeTemplate;
    if (!template) return;

    var radius = session.radius;
    var duration = conf.lobAreaDuration !== undefined ? conf.lobAreaDuration : 0.35;
    var tickRate = conf.lobAreaTickRate !== undefined ? conf.lobAreaTickRate : 0.5;
    var tickDamage = conf.lobAreaDamage !== undefined ? conf.lobAreaDamage : 80;
    var explodeDamage = conf.explodeDamage !== undefined ? conf.explodeDamage : tickDamage;
    var oneShot = conf.oneShot === true || duration <= 0.4;

    if (conf.destroyBush && this.app.gameModeManager) {
        if (this.app.gameModeManager.destroyBushesInArea) this.app.gameModeManager.destroyBushesInArea(x, z, radius + 0.5);
        if (this.app.gameModeManager.destroyObstacle) this.app.gameModeManager.destroyObstacle(x, z, radius + 0.5);
    }

    var zone = template.clone();
    template.parent.addChild(zone);
    zone.enabled = true;
    zone._isFx = true;
    zone.setPosition(x, 0.05, z);

    var spawnScale = bm._getAoeSpawnScale
        ? bm._getAoeSpawnScale(template, radius)
        : { x: Math.max(0.2, radius * 2), y: Math.max(0.2, radius * 2), z: Math.max(0.2, radius * 2) };
    zone.setLocalScale(spawnScale.x, spawnScale.y, spawnScale.z);

    var particles = zone.findComponents('particlesystem');
    for (var i = 0; i < particles.length; i++) {
        var ps = particles[i];
        if (ps.emitterShape === pc.EMITTERSHAPE_BOX) {
            var ext = ps.emitterExtents; ext.x = 0.5; ext.z = 0.5; ps.emitterExtents = ext;
        } else if (ps.emitterShape === pc.EMITTERSHAPE_SPHERE || ps.emitterShape === pc.EMITTERSHAPE_CYLINDER) {
            ps.emitterRadius = 0.5;
        }
        ps.reset();
        ps.play();
    }

    bm.addDamageZone({
        entity: zone,
        x: x,
        z: z,
        radius: radius,
        duration: duration,
        damage: oneShot ? explodeDamage : tickDamage,
        tickRate: oneShot ? 0.15 : tickRate,
        tickTimer: oneShot ? 0.15 : 0,
        oneShot: oneShot,
        ownerType: session.ownerType,
        ownerId: session.ownerId,
        ownerTeam: session.team,
        dotConfig: conf.dotConfig,
        spawnScale: spawnScale
    });
};

CombatManager.prototype._updateSkyfall = function(dt) {
    if (!this._skyfallPending || this._skyfallPending.length === 0) return;

    for (var s = this._skyfallPending.length - 1; s >= 0; s--) {
        var session = this._skyfallPending[s];

        // C3：依序標點（可在標記當下重採樣 aim_chain／隊列 entity 現況位置，標完後不跟隨）
        if (session.timingMode === 'sequential_mark') {
            if (session.phase === 'wait_mark') {
                session.phaseTimer -= dt;
                if (session.phaseTimer <= 0) {
                    if (session.markIndex >= session.marks.length) {
                        session.phase = 'done_marking';
                    } else {
                        var idx = session.markIndex;
                        var fb = session.marks[idx];
                        var sampled = this._skyfallSampleEntityPos(session.entityQueue[idx], fb);
                        // aim_chain：每發都重採 lock entity（隊列裡通常同一把）
                        if (session.targetMode === 'aim_chain' && session.entityQueue[0]) {
                            sampled = this._skyfallSampleEntityPos(session.entityQueue[0], fb);
                        }
                        this._skyfallArmStrike(session, sampled.x, sampled.z, session.fireDelay);
                        session.markIndex++;
                        // 等上一發落地後再標下一發（逼走位）；burstInterval 為落點後的空隙
                        session.phase = 'wait_interval';
                        session.phaseTimer = session.fireDelay + session.burstInterval;
                    }
                }
            } else if (session.phase === 'wait_interval') {
                // 等上一發「爆完」再建下一標
                if (session.markIndex >= session.marks.length) {
                    session.phase = 'done_marking';
                } else {
                    session.phaseTimer -= dt;
                    if (session.phaseTimer <= 0) {
                        session.phase = 'wait_mark';
                        session.phaseTimer = 0;
                    }
                }
            }
        }

        for (var i = session.strikes.length - 1; i >= 0; i--) {
            var st = session.strikes[i];
            if (st.done) continue;
            st.timer -= dt;
            if (st.warn && st.warn.parent) {
                // 輕微脈衝，方便讀預警
                var pulse = 1 + 0.08 * Math.sin((session.fireDelay - Math.max(0, st.timer)) * 14);
                var base = Math.max(0.8, session.radius * 2);
                st.warn.setLocalScale(base * pulse, 1, base * pulse);
            }
            if (st.timer <= 0) {
                this._skyfallSpawnImpact(st.x, st.z, session);
                if (st.warn) {
                    if (st.warn.destroy) st.warn.destroy();
                    st.warn = null;
                }
                st.done = true;
                session.strikes.splice(i, 1);
            }
        }

        var markingDone = session.timingMode !== 'sequential_mark' || session.phase === 'done_marking' || session.markIndex >= session.marks.length;
        if (markingDone && session.strikes.length === 0) {
            this._skyfallPending.splice(s, 1);
        }
    }
};

CombatManager.prototype.clearSkyfallPending = function() {
    if (!this._skyfallPending) return;
    for (var s = 0; s < this._skyfallPending.length; s++) {
        var strikes = this._skyfallPending[s].strikes || [];
        for (var i = 0; i < strikes.length; i++) {
            if (strikes[i].warn && strikes[i].warn.destroy) strikes[i].warn.destroy();
        }
    }
    this._skyfallPending = [];
};

CombatManager.prototype.spawnDecoy = function(team, brawlerType, pos, angleRad) {
    var config = window.BrawlerConfig ? window.BrawlerConfig[brawlerType] : null; 
    var template = this.characterMap[config ? config.modelKey : brawlerType] || this.characterMap['caocao']; 
    if (!template) return null;
    
    var decoy = template.clone(); 
    decoy.setPosition(pos.x, 0, pos.z); decoy.setEulerAngles(0, angleRad * (180 / Math.PI), 0); 
    template.parent.addChild(decoy); decoy.enabled = true; 
    if (decoy.anim) decoy.anim.setFloat('speed', 0);
    
    this.tintHealthAndRing(decoy, (this.app.gameMode === '3V3_BOUNTY' && team === this.app.myTeam) || (this.app.gameMode === 'FFA' && team === 'none') ? false : true);
    return decoy;
};

CombatManager.prototype.executeSuperLiuBeiTree = function(ownerType, ownerId, team, brawlerType, pos, angleRad, superConf) {
    var treeEntity = this.spawnDecoy(team, 'liubei_tree', pos, angleRad);

    var zone;
    var auraRadius = superConf.auraRadius || 3.5;
    
    if (superConf.destroyBush && this.app.gameModeManager && this.app.gameModeManager.destroyBushesInArea) {
        this.app.gameModeManager.destroyBushesInArea(pos.x, pos.z, auraRadius + 0.5);
    }

    var template = this.aoeMap['liubei_tree'];
    var isCustomAoe = !!this.aoeLiuBeiTree;

    if (template) {
        zone = template.clone();
        template.parent.addChild(zone);
        zone.enabled = true;
        zone.setPosition(pos.x, 0.05, pos.z);
        
        if (isCustomAoe) {
            var originalScaleY = template.getLocalScale().y;
            zone.setLocalScale(auraRadius * 2, originalScaleY, auraRadius * 2);
        } else {
            zone.setLocalScale(auraRadius * 2, 0.1, auraRadius * 2);
            var render = zone.render || zone.findComponent('render');
            if (render && render.meshInstances && render.meshInstances.length > 0) {
                var mi = render.meshInstances[0];
                if (!mi._isClonedMaterial) {
                    mi.material = mi.material.clone();
                    mi._isClonedMaterial = true;
                }
                var aColor = superConf.auraColor || [0.2, 1.0, 0.4];
                mi.material.diffuse.copy(this._tempColor.set(aColor[0], aColor[1], aColor[2], 1));
                mi.material.emissive.copy(this._tempColor.set(aColor[0] * 0.5, aColor[1] * 0.8, aColor[2] * 0.5, 1)); 
                mi.material.emissiveIntensity = 1.5;
                mi.material.blendType = pc.BLEND_ADDITIVE;
                mi.material.opacity = superConf.auraOpacity || 0.3;
                mi.material.depthWrite = false;
                mi.material.update();
            }
        }
        
        var particles = zone.findComponents('particlesystem');
        for (var i = 0; i < particles.length; i++) {
            var ps = particles[i];
            if (ps.emitterShape === pc.EMITTERSHAPE_BOX) { 
                var ext = ps.emitterExtents;
                ext.x = 0.5; ext.z = 0.5;
                ps.emitterExtents = ext;
                if (ps.emitterExtentsInner) {
                    var extIn = ps.emitterExtentsInner;
                    extIn.x = 0.4; extIn.z = 0.4;
                    ps.emitterExtentsInner = extIn;
                }
            } else if (ps.emitterShape === pc.EMITTERSHAPE_SPHERE || ps.emitterShape === pc.EMITTERSHAPE_CYLINDER) { 
                ps.emitterRadius = 0.5;
                if (ps.emitterRadiusInner !== undefined) ps.emitterRadiusInner = 0.4; 
            }
            ps.reset(); 
            ps.play();
        }
    } 
    else {
        zone = new pc.Entity('Aura_LiuBeiTree');
        zone.addComponent('render', { type: 'cylinder', castShadows: false, receiveShadows: false });
        var fallbackMat = new pc.StandardMaterial();
        var fColor = superConf.auraColor || [0.2, 1.0, 0.4];
        fallbackMat.diffuse.copy(this._tempColor.set(fColor[0], fColor[1], fColor[2], 1));
        fallbackMat.emissive.copy(this._tempColor.set(fColor[0] * 0.5, fColor[1] * 0.8, fColor[2] * 0.5, 1)); 
        fallbackMat.emissiveIntensity = 1.5;
        fallbackMat.blendType = pc.BLEND_ADDITIVE;
        fallbackMat.opacity = superConf.auraOpacity || 0.3;
        fallbackMat.depthWrite = false;
        fallbackMat.update();
        zone.render.meshInstances[0].material = fallbackMat;
        zone.setLocalScale(auraRadius * 2, 0.1, auraRadius * 2);
        zone.setPosition(pos.x, 0.05, pos.z);
        this.app.root.addChild(zone);
    }

    var zoneData = { 
        entity: zone, x: pos.x, z: pos.z, radius: auraRadius, 
        duration: superConf.treeLifetime || 10.0, damage: superConf.healPerTick || 100, 
        tickRate: superConf.tickRate || 0.5, tickTimer: 0, 
        ownerType: ownerType, ownerId: ownerId, ownerTeam: team, isHeal: true 
    };

    if (this.app.bulletManager) {
        this.app.bulletManager.addDamageZone(zoneData);
        this.app.bulletManager.addDeployable({
            entity: treeEntity,
            team: team,
            hp: superConf.treeHealth || 2500,
            maxHp: superConf.treeHealth || 2500,
            radius: superConf.treePhysicalRadius || 1.2, 
            life: 0,
            maxLife: superConf.treeLifetime || 10.0,
            linkedZone: zoneData
        });
    }
};

CombatManager.prototype.executeSuperHomingBomb = function(ownerType, ownerId, team, brawlerType, pos, angleRad, config) {
    var skillConf = (config.isSuper && config.super) ? config.super : config;
    
    var bKey = skillConf.bulletKey || brawlerType || 'homing_bomb';
    var template = this.getPooledBullet(bKey); 
    if (!template) return;
    
    template.enabled = true;
    template.setPosition(pos.x, 0.5, pos.z); 
    template.setEulerAngles(0, angleRad * (180 / Math.PI), 0);
    
    var bScale = skillConf.bulletScale !== undefined ? skillConf.bulletScale : 1.0;
    var bulletFlip = !!(skillConf.bulletFlip || config.bulletFlip);
    this._setBulletScale(template, bScale, bScale, bScale, bulletFlip);
    
    if (template.findComponents('render').length === 0 && template.findComponents('model').length === 0) {
        template.addComponent('render', { type: 'box' }); 
        this._setBulletScale(template, 0.3 * bScale, 0.3 * bScale, 0.3 * bScale, bulletFlip);
    }
    
    var hasHealthNode = template.findByName('HealthFill') || template.findByName('HealthBackground');
    if (hasHealthNode || bKey === 'homing_bomb' || bKey === 'boss_zhangjiao') {
        var isEnemy = (this.app.gameMode === 'FFA') ? true : (team !== this.app.myTeam);
        this.tintHealthAndRing(template, isEnemy); 
        
        var hpFill = template.findByName('HealthFill'); if(hpFill) hpFill.enabled = false;
        var hpBg = template.findByName('HealthBackground'); if(hpBg) hpBg.enabled = false;
        
        var animNode = this.findAnimEntity(template);
        if (animNode && animNode.anim) animNode.anim.setFloat('speed', 1.0);
    }
    
    var aoeKey = skillConf.lobAreaBulletKey || brawlerType || 'zhangjiao_super';

    if (this.app.bulletManager) { 
        this.app.bulletManager.addBullet({ 
            entity: template, 
            startX: pos.x, 
            startZ: pos.z, 
            dirX: Math.sin(angleRad), 
            dirZ: Math.cos(angleRad), 
            speed: skillConf.lobSpeed || 10, 
            damage: 0, 
            maxLife: (skillConf.lobDuration || 0.8) + (skillConf.chaseTime || 2.0),
            ownerType: ownerType, 
            ownerId: ownerId, 
            ownerTeam: team, 
            type: 'super_homing_bomb', 
            isSuper: !!config.isSuper,
            config: config,
            aoeTemplate: this.aoeMap[aoeKey] || this.aoeTemplate,
            bulletFlip: bulletFlip
        }); 
    }
};