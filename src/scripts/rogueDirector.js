// ═══════════════════════════════════════════════════════════════
// 🎲 RogueDirector — 群雄集結(Roguelike 單機模式)Phase 1
//
// 循環:波次 → 全滅 → 三選一(招募/強化)→ 下一波
//       → 第 maxWaves 波打倒張角通關 → 凱旋 或 乘勝追擊(無盡)
// ═══════════════════════════════════════════════════════════════
var RogueDirector = pc.createScript('rogueDirector');

RogueDirector.OPENING_REROLL_COST = 100;

// 帳號經驗（結算用；Level 不影響戰鬥）
RogueDirector.XP_PER_WAVE = 12;
RogueDirector.XP_VICTORY = 80;
RogueDirector.XP_PER_KILL = 1;
RogueDirector.XP_PER_ENDLESS_WAVE = 6;
RogueDirector.XP_ENDLESS_CAP = 120;

RogueDirector.attributes.add('maxWaves', { type: 'number', default: 15, title: '通關波數' });
RogueDirector.attributes.add('bossEvery', { type: 'number', default: 3, title: 'Boss 每幾波' });
RogueDirector.attributes.add('squadCap', { type: 'number', default: 4, title: '武將編制上限' });
RogueDirector.attributes.add('maxEnemies', { type: 'number', default: 6, title: '單波敵人上限(同屏)' });
RogueDirector.attributes.add('budgetBase', { type: 'number', default: 4, title: '常規波預算基數' });
RogueDirector.attributes.add('budgetPerWave', { type: 'number', default: 1.5, title: '每波預算成長' });
RogueDirector.attributes.add('budgetEndlessPerWave', { type: 'number', default: 2.0, title: '乘勝追擊每波預算成長' });
RogueDirector.attributes.add('hpScalePerWave', { type: 'number', default: 0.05, title: '每波敵方血量成長' });
RogueDirector.attributes.add('dmgScalePerWave', { type: 'number', default: 0.12, title: '每波敵方傷害成長' });
RogueDirector.attributes.add('minEnemiesBeforeAffix', { type: 'number', default: 3, title: '至少幾隻敵人才開始買詞綴' });
RogueDirector.attributes.add('endlessHpRamp', { type: 'number', default: 1.02, title: '乘勝追擊每波額外血量倍率' });
RogueDirector.attributes.add('endlessDmgRamp', { type: 'number', default: 1.04, title: '乘勝追擊每波額外傷害倍率' });
RogueDirector.attributes.add('endlessThreatRotateWaves', { type: 'number', default: 2, title: '無盡威脅模板每幾波輪換' });
RogueDirector.attributes.add('coinsPerWave', { type: 'number', default: 5, title: '每波低保軍餉' });
RogueDirector.attributes.add('bossBonusCoins', { type: 'number', default: 25, title: 'Boss 波額外軍餉' });
RogueDirector.attributes.add('victoryCoins', { type: 'number', default: 100, title: '通關軍餉大獎' });
RogueDirector.attributes.add('endlessCoinDecay', { type: 'number', default: 0.9, title: '乘勝追擊軍餉衰減' });
RogueDirector.attributes.add('cardMaxDmg', { type: 'number', default: 8, title: '傷害卡抽取上限' });
RogueDirector.attributes.add('cardMaxHp', { type: 'number', default: 6, title: '血量卡抽取上限' });
RogueDirector.attributes.add('cardMaxSpd', { type: 'number', default: 4, title: '移速卡抽取上限' });
RogueDirector.attributes.add('cardMaxReload', { type: 'number', default: 4, title: '裝填卡抽取上限' });

RogueDirector.loc = function (v) {
    if (v == null) return '';
    if (typeof v === 'string' || typeof v === 'number') return String(v);
    if (window.TKI18n && typeof window.TKI18n.pick === 'function') return window.TKI18n.pick(v);
    if (typeof v === 'object') return String(v.zh || v['zh-TW'] || v.en || '');
    return '';
};

RogueDirector.t = function (key, vars) {
    if (window.TKI18n && typeof window.TKI18n.t === 'function') return window.TKI18n.t(key, vars);
    return key;
};

RogueDirector.isEn = function () {
    var lang = window.TKI18n && window.TKI18n.getLang ? window.TKI18n.getLang() : '';
    return lang === 'en' || lang === 'tr';
};

// ── 初始化 ──────────────────────────────────────────────────────
RogueDirector.prototype.initialize = function() {
    this.app.rogueDirector = this;

    this.active = false;
    this.wave = 0;
    this.waveStatus = 'idle';          // idle | playing | choosing | victory_choice | over
    this.isEndless = false;
    this.isTutorialRun = false;        // 🎓 教學局（wave 腳本化，無大廳 modal）
    this._currentEndlessThreat = null;
    this._clearCheckTimer = 0;
    this._earnedCoins = 0;             // 本局累計(顯示用)
    this._unbankedCoins = 0;           // 尚未發放到 progressionManager 的部分
    this._earnedXp = 0;                // 本局已結算經驗(顯示用)
    this._rogueKills = 0;
    this._roguePerfectCount = 0;
    this._rogueKillPopCount = 0;
    this._xpBankedWaves = 0;
    this._xpBankedKills = 0;
    this._xpVictoryGranted = false;
    this._endlessXpGranted = 0;
    this._reviveCount = 0;
    this._specialBag = null;
    this._bossBag = null;

    // 🎯 波次勝利條件 (預設 clear)
    this._winMode = 'clear';           // clear | survive | kill_target | reach
    this._targetEnemyId = '';
    this._targetEnemyName = '';
    this._goalPos = null;
    this._goalRadius = 2.2;
    this._goalHoldTime = 0;
    this._goalHoldLeft = 0;
    this._goalEntity = null;

    // squad: [{ botId, bType, name, faction, dead }]
    this.squad = [];
    this._activatedSynergies = {};
    this._cardCounts = {};   // 🎲 各強化卡已抽次數
    this._draftMode = 'wave'; // opening | wave

    this._buildStaticData();
    this._injectStyles();

    this._pendingResumeCheckpoint = null;
    this._visibilityPaused = false;
    this._prevTimeScaleForVis = 1;

    this.app.on('game:start', this._onGameStart, this);
    this.app.on('rogue:begin', this._beginRun, this);
    this.app.on('score:death', this._onDeath, this);
    this.app.on('rogue:resonanceActivated', this._onResonanceActivated, this);

    this._ensureWordSystem();
    this._ensureCheckpointManager();
    this._bindLifecycleHooks();

    this.on('destroy', function() {
        this.app.off('game:start', this._onGameStart, this);
        this.app.off('rogue:begin', this._beginRun, this);
        this.app.off('score:death', this._onDeath, this);
        this.app.off('rogue:resonanceActivated', this._onResonanceActivated, this);
        this._unbindLifecycleHooks();
        if (this.app.tutorialDirector && this.app.tutorialDirector._cleanup) {
            this.app.tutorialDirector._cleanup();
        }
        this._removeDom();
    }, this);
};

RogueDirector.prototype._buildStaticData = function() {
    this.factionOf = {
        caocao: 'wei', zhangliao: 'wei',
        guanyu: 'shu', zhangfei: 'shu', liubei: 'shu',
        zhouyu: 'wu', sunquan: 'wu',
        diaochan: 'qun', lubu: 'qun', zhangjiao: 'qun', zhangbao: 'qun',
    };
    this.factionLabel = { wei: '魏', shu: '蜀', wu: '吳', qun: '群' };
    this.factionColor = { wei: '#1E88E5', shu: '#43A047', wu: '#E53935', qun: '#FBC02D' };

    this.synergies = {
        shu: { name: { zh: '桃園結義', en: 'Peach Garden' }, shortName: { zh: '桃園結義', en: 'Peach Garden' }, need: 2, desc: { zh: '血量 +30%，傷害 +10%', en: '+30% HP, +10% damage' }, buff: { hpMul: 1.30, dmgMul: 1.1 } },
        wei: { name: { zh: '虎豹騎', en: 'Tiger Cavalry' }, shortName: { zh: '虎豹騎', en: 'Tiger Cavalry' }, need: 2, desc: { zh: '傷害 +20%，移速 +20%', en: '+20% damage, +20% move speed' }, buff: { dmgMul: 1.2, speedMul: 1.2 } },
        wu:  { name: { zh: '江東水師', en: 'Jiangdong Fleet' }, shortName: { zh: '江東水師', en: 'Jiangdong Fleet' }, need: 2, desc: { zh: '血量 +15%，傷害 +15%，裝填 +40%', en: '+15% HP, +15% damage, +40% reload' }, buff: { hpMul: 1.15, dmgMul: 1.15, reloadMul: 1.40 } },
        qun: { name: { zh: '亂世梟雄', en: 'Chaos Warlords' }, shortName: { zh: '亂世梟雄', en: 'Chaos Warlords' }, need: 2, desc: { zh: '傷害 +40%', en: '+40% damage' }, buff: { dmgMul: 1.4 } }
    };

    this.affixes = [
        { key: 'tough', name: { zh: '堅甲', en: 'Ironclad' }, cost: 2, hpScale: 1.6, sizeScale: 1.4 },
        { key: 'fierce', name: { zh: '勇悍', en: 'Fierce' }, cost: 1, dmgScale: 1.4, sizeScale: 1.2 },
        { key: 'swift', name: { zh: '迅捷', en: 'Swift' }, cost: 1, speedScale: 1.35 },
        { key: 'rage', name: { zh: '嗜血', en: 'Bloodlust' }, cost: 2, dmgScale: 1.25, speedScale: 1.2 },
        { key: 'giant', name: { zh: '巨軀', en: 'Colossal' }, cost: 1, hpScale: 1.3, sizeScale: 1.35 },
        // 護盾：maxHP×shieldPct；生成時由 BotController 掛盾 + 顯示「護盾」詞綴（持盾免暈）
        { key: 'shield', name: { zh: '護盾', en: 'Shield' }, cost: 2, shieldPct: 0.20 },
        // 必中：無視閃避；命中時強制破盾並直扣 HP
        { key: 'trueStrike', name: { zh: '必中', en: 'True Strike' }, cost: 2, trueStrike: true }
    ];

    // 無盡段：威脅模板（詞綴組合輪換，取代隨機單掛）
    this.endlessThreats = [
        { key: 'iron_tide', name: { zh: '鐵潮', en: 'Iron Tide' }, minWave: 16, affixes: ['tough', 'shield'],
            desc: { zh: '高血持盾 — 需破盾／穿盾', en: 'Tanky shields — break or pierce' } },
        { key: 'gale', name: { zh: '疾風', en: 'Gale' }, minWave: 16, affixes: ['swift', 'trueStrike'],
            desc: { zh: '高速必中 — 破盾直傷；守系可反震／疊鱗', en: 'Fast true-strike — shield-break damage; Fort can counter' } },
        { key: 'fury', name: { zh: '狂暴', en: 'Fury' }, minWave: 18, affixes: ['rage', 'fierce'], dmgScaleMul: 1.12,
            desc: { zh: '高傷嗜血 — 敵方輸出極高，需控場或速清', en: 'High damage bloodlust — control or clear fast' } },
        { key: 'behemoth', name: { zh: '巨獸', en: 'Behemoth' }, minWave: 20, affixes: ['giant', 'tough', 'shield'],
            desc: { zh: '巨軀肉盾 — 需集火／AOE', en: 'Giant meatshield — focus fire / AoE' } }
    ];

    this.budgetMinions = [
        { type: 'minion_melee',  cost: 1 },
        { type: 'minion_ranged', cost: 1 },
        { type: 'minion_CB',     cost: 2 }
    ];
    this.budgetGenerals = [
        { type: 'zhangfei', cost: 30 },
        { type: 'guanyu',   cost: 30 },
        { type: 'zhangliao', cost: 30 },
        { type: 'zhangjiao',   cost: 30 },
        { type: 'lubu',     cost: 30 }
    ];

    this.specialPool = [
        // ── specialPool / bossPool 可用參數速查（方便關卡配置）────────────────────
        // WaveScript（每個 pool item）：
        // - name: 顯示名稱
        // - announce: 進波次時的提示文字（gmm announcer）
        // - rule: 'clear' | 'survive' | 'kill_target' | 'reach'
        // - intro: { duration?: number, action?: 'attack', aim?: 'player'|'fixed', aimAngle?: number(度), focus?: {x,z} }
        // - allyPassive: boolean（友軍是否被標成 passive：不參戰/不主動攻擊，由 BotController 解讀）
        // - allyHold: boolean（友軍韁繩：貼近玩家，不打野；由 BotController 解讀）
        // - surviveTime: number（rule='survive' 時有效）
        // - target: { type?: string, count?: number }（rule='kill_target'：挑指定類型作為過關目標）
        // - goal: { placement?: 'north'|'south'|'east'|'west'|'center'|'centre'|'scatter'|Array,
        //           x?: number, z?: number, distance?: number, spacing?: number, radius?: number, holdTime?: number }
        //
        // enemies[]（每個敵人/武將 entry，會被 _buildScriptPlan 轉成 spawn opts）：
        // - type: brawlerType（例如 'guanyu' / 'zhangfei' / 'minion_melee' / 'boss_zhangjiao'）
        // - count: number（預設 1）
        // - placement: 'scatter'|'ring'|'north'|'south'|'east'|'west'|'center'|'centre'|Array（自訂座標列表）
        // - distance: number（生成距離；ring 的半徑；或方位距離）
        // - spacing: number（同方位多隻的間距）
        // - hpScale / dmgScale / speedScale / sizeScale: number（倍率）
        // - deadly: boolean（dmgScale=999 快速測試用）
        // - shieldPct: number（最大護盾＝maxHP×比例；也可由 affixes「護盾」詞綴 cost 購入）
        // - affixName: string（名字前綴）
        // - canSuper: boolean（允許大招；也可用 superEvery 隱式允許）
        // - superEvery: number（每 N 秒強制放大招）
        // - attackEvery: number（每 N 秒才允許觸發一次普攻：節流型）
        // - lockCombo: number（鎖定只用第 N 招 comboOverrides）
        // - stationary: boolean（站樁不動）
        // - noRegen / noBasicAttack / noDodge: boolean（行為積木）
        // - aimMode: 'fixed'（固定方位攻擊；不鎖玩家）
        // - aimAngle: number（度；配合 aimMode='fixed'）
        // - duelAi: boolean（單挑用：smartCombo 非順序選招 + 射程甜區壓力走位）
        // - allyRole: 'vanguard'|'guardian'|'tactician'（友軍職能；敵方後排可搭配 tactician 風箏）
        // - formation: 'bodyguard'|'backline'（敵方編隊：護衛擋前／後排躲後）
        // - partnerType: string（編隊夥伴的 brawlerType，例如貂蟬↔呂布）
        // - formationBackDist: number（backline 躲在夥伴後方的距離）
        {
            name: '怒吼陣', announce: '怒吼陣',
            rule: 'kill_target',
            intro: { duration: 2.5 },
            target: { type: 'zhangfei', count: 1 },
            enemies: [{ type: 'zhangfei', count: 8, placement: 'ring', distance: 8, sizeScale: 1.35, lockCombo: 2, attackEvery: 7, hpScale: 0.6, noRegen: true, speedScale: 0.8 }]
        },
        {
            name: '刀雨', announce: '刀雨襲來',
            rule: 'reach',
            intro: { duration: 2.5, focus: { x: 0, z: 25 }, teleportAllies: true },
            goal: { placement: 'centre', distance: 0, radius: 2.2, holdTime: 0.5 },
            allyPassive: true,
            enemies: [
                { type: 'guanyu', count: 4, placement: 'ring', distance: 4, stationary: true, superEvery: 4, canSuper: true, noBasicAttack: true, noDodge: true },
                { type: 'guanyu', count: 4, placement: 'ring', distance: 8, stationary: true, superEvery: 8, canSuper: true, noBasicAttack: true, noDodge: true }
            ]
        },
        {
            name: '桃園結義', announce: '桃園結義',
            rule: 'clear',
            enemies: [
                { type: 'liubei', placement: 'east', distance: 6, allyRole: 'guardian', canSuper: true, noRegen: true, speedScale: 1.35, sizeScale: 1.25, hpScale: 1.15 },
                { type: 'guanyu', placement: 'west', distance: 6, allyRole: 'vanguard', formation: 'bodyguard', partnerType: 'zhangfei', speedScale: 0.85, attackEvery: 6, lockCombo: 2, noRegen: true, dmgScale: 1.35, sizeScale: 1.3 },
                { type: 'zhangfei', placement: 'north', distance: 5, allyRole: 'guardian', canSuper: true, superEvery: 7, speedScale: 0.55, noBasicAttack: true, noRegen: true, hpScale: 2.1, sizeScale: 1.35, shieldPct: 0.15 }
            ]
        },
        {
            name: '貂蟬連環計', announce: '貂蟬連環計',
            rule: 'clear',
            enemies: [
                // 呂布擋在前方壓制；貂蟬躲後高傷風箏——靠 formation 強制演出
                {
                    type: 'lubu', placement: 'north', distance: 7,
                    formation: 'bodyguard', partnerType: 'diaochan',
                    allyRole: 'vanguard', canSuper: true, superEvery: 9,
                    noRegen: true, hpScale: 1.65, dmgScale: 1.25, speedScale: 1.1, sizeScale: 1.45,
                    affixName: '連環·前鋒'
                },
                {
                    type: 'diaochan', placement: 'north', distance: 14,
                    formation: 'backline', partnerType: 'lubu', formationBackDist: 7,
                    allyRole: 'tactician', canSuper: false,
                    noRegen: true, hpScale: 0.55, dmgScale: 1.7, speedScale: 0.9, sizeScale: 1.15,
                    affixName: '連環·後陣'
                },
                { type: 'minion_melee', count: 2, placement: 'east', distance: 9, hpScale: 0.7, noRegen: true, speedScale: 1.1 },
                { type: 'minion_melee', count: 2, placement: 'west', distance: 9, hpScale: 0.7, noRegen: true, speedScale: 1.1 }
            ]
        },
        {
            name: '鐵壁弓陣', announce: '鐵壁弓陣',
            rule: 'clear',
            enemies: [
                { type: 'minion_melee', count: 5, placement: 'north', distance: 6, spacing: 2.2, hpScale: 1.4, shieldPct: 0.25, speedScale: 0.7, noRegen: true, affixName: '盾牆' },
                { type: 'minion_ranged', count: 3, placement: 'north', distance: 12, spacing: 2.4, hpScale: 0.75, dmgScale: 1.35, noRegen: true },
                { type: 'minion_CB', count: 3, placement: 'north', distance: 14, hpScale: 0.8, dmgScale: 1.25, noRegen: true }
            ]
        },
        {
            name: '黃巾潮', announce: '黃巾潮至',
            rule: 'survive',
            surviveTime: 28,
            enemies: [
                { type: 'minion_melee', count: 4, placement: 'ring', distance: 9, hpScale: 1.3, speedScale: 1.25, noRegen: true },
                { type: 'minion_ranged', count: 2, placement: 'ring', distance: 12, hpScale: 1.3, dmgScale: 1.15, noRegen: true },
                { type: 'zhangbao', placement: 'north', distance: 11, canSuper: true, hpScale: 2.0, dmgScale: 1.15, sizeScale: 1.25, noRegen: true, affixName: '潮頭' }
            ]
        },
        {
            name: '張遼夜襲', announce: '張遼夜襲',
            rule: 'kill_target',
            intro: { duration: 2.0 },
            target: { type: 'zhangliao', count: 1 },
            enemies: [
                { type: 'zhangliao', placement: 'west', distance: 10, canSuper: true, noRegen: true, hpScale: 1.15, dmgScale: 1.35, speedScale: 1.35, sizeScale: 1.2, affixName: '止啼' },
                { type: 'minion_melee', count: 3, placement: 'ring', distance: 8, hpScale: 0.65, speedScale: 1.3, noRegen: true },
                { type: 'minion_CB', count: 2, placement: 'east', distance: 11, spacing: 2.5, hpScale: 0.7, noRegen: true }
            ]
        },
        {
            name: '周瑜烈火', announce: '周瑜烈火',
            rule: 'clear',
            enemies: [
                {
                    type: 'zhouyu', placement: 'north', distance: 13,
                    formation: 'backline', partnerType: 'minion_melee', formationBackDist: 5,
                    allyRole: 'tactician', canSuper: true, superEvery: 10,
                    noRegen: true, hpScale: 0.85, dmgScale: 1.4, sizeScale: 1.15, affixName: '火攻'
                },
                { type: 'minion_melee', count: 3, placement: 'north', distance: 7, spacing: 2.3, formation: 'bodyguard', partnerType: 'zhouyu', hpScale: 1.15, shieldPct: 0.15, noRegen: true },
                { type: 'minion_ranged', count: 2, placement: 'east', distance: 11, spacing: 2.5, hpScale: 0.7, dmgScale: 1.2, noRegen: true }
            ]
        },
        {
            name: '孟德奸雄', announce: '孟德親征',
            rule: 'clear',
            enemies: [
                { type: 'caocao', placement: 'center', distance: 0, canSuper: true, noRegen: true, hpScale: 1.35, dmgScale: 1.25, sizeScale: 1.25, shieldPct: 0.2, affixName: '魏王' },
                { type: 'minion_CB', count: 3, placement: 'ring', distance: 8, hpScale: 0.75, dmgScale: 1.15, noRegen: true },
                { type: 'minion_melee', count: 2, placement: 'ring', distance: 6, hpScale: 0.9, noRegen: true }
            ]
        },
        {
            name: '江東討伐', announce: '單挑 · 孫權',
            rule: 'clear',
            intro: { duration: 2.8, focus: { x: 0, z: 10 }, teleportAllies: true },
            allyPassive: true,
            allyHold: { x: 0, z: -8 },
            enemies: [
                {
                    type: 'sunquan', count: 1, placement: 'center', distance: 0,
                    canSuper: true, noRegen: true, trueStrike: true,
                    hpScale: 2.4, dmgScale: 1.35, sizeScale: 1.55, speedScale: 0.85,
                    superEvery: 14,
                    duelAi: true,
                    affixName: '必中'
                }
            ]
        }
    ];
    this.bossPool = [
        // bossPool 的 item 結構同 specialPool（同樣吃 rule/intro/target/goal/enemies[] 等）
        {
            name: '大賢良師 張角', announce: '大賢良師 張角',
            rule: 'clear',
            enemies: [
                { type: 'boss_zhangjiao', count: 1, placement: 'center', canSuper: true, hpScale: 1.5, dmgScale: 1.25, sizeScale: 1.55, affixName: '天公將軍', shieldPct: 0.20, trueStrike: true },
                { type: 'minion_melee', count: 4, placement: 'scatter' },
                { type: 'minion_ranged', count: 4, placement: 'scatter' },
                { type: 'minion_CB', count: 4, placement: 'scatter' }
            ]
        }
    ];
};

RogueDirector.prototype._resetShuffleBags = function() {
    this._specialBag = [];
    this._bossBag = [];
};

RogueDirector.prototype._shuffleInPlace = function(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
};

// Shuffle bag draw: each script appears once per cycle.
RogueDirector.prototype._drawFromBag = function(pool, bagKey) {
    if (!pool || pool.length === 0) return null;
    if (!this[bagKey]) this[bagKey] = [];
    var bag = this[bagKey];
    if (bag.length === 0) {
        for (var i = 0; i < pool.length; i++) bag.push(i);
        this._shuffleInPlace(bag);
    }
    var idx = bag.pop();
    return pool[idx] || null;
};

// ── 生命週期 ────────────────────────────────────────────────────
RogueDirector.prototype._onGameStart = function(data) {
    var mode = String((data && data.mode) || this.app.gameMode || '').toUpperCase();
    this.active = (mode === 'ROGUE');
    this._removeDom();
    this._visibilityPaused = false;
    if (!this.active) {
        this.isTutorialRun = false;
        this._pendingResumeCheckpoint = null;
        return;
    }

    // Hub 續玩：app._rogueResumeCheckpoint 由 characterSelect 注入
    this._pendingResumeCheckpoint = null;
    var resumeCp = this.app._rogueResumeCheckpoint || null;
    var Api = this._checkpointApi();
    if (resumeCp && Api && Api.isValid(resumeCp)) {
        this._pendingResumeCheckpoint = resumeCp;
    } else if (resumeCp) {
        this.app._rogueResumeCheckpoint = null;
    }

    this._ensureTutorialDirector();
    this.isTutorialRun = this._shouldStartTutorialRun(data);
    if (this._pendingResumeCheckpoint) {
        // 續玩不走教學局
        this.isTutorialRun = false;
        this.app._forceTutorialRun = false;
        this.app._pendingTutorialRun = false;
    }
    if (this.isTutorialRun) {
        this.app._pendingTutorialRun = true;
        if (data) {
            data.brawler = (window.TutorialConfig && window.TutorialConfig.heroBrawlerType) || 'guanyu';
        }
        // 未指定入口時：強制演武=大廳；否則視為 Rogue 內首次教學
        if (!this.app._tutorialEntry) {
            this.app._tutorialEntry = this.app._forceTutorialRun ? 'lobby_help' : 'rogue_inline';
        }
    }

    this.app.myTeam = 'blue';
    this.wave = 0;
    this.waveStatus = 'idle';
    this.isEndless = false;
    this._currentEndlessThreat = null;
    this._earnedCoins = 0;
    this._unbankedCoins = 0;
    this._earnedXp = 0;
    this._rogueKills = 0;
    this._roguePerfectCount = 0;
    this._rogueKillPopCount = 0;
    this._xpBankedWaves = 0;
    this._xpBankedKills = 0;
    this._xpVictoryGranted = false;
    this._endlessXpGranted = 0;
    this._reviveCount = 0;
    this.squad = [];
    this._activatedSynergies = {};
    this._cardCounts = {};
    this._draftMode = 'wave';
    this._openingRerollCount = 0;
    this._wavesSinceR = 0;
    this._wavesSinceSigUpgrade = 0;
    this._wavesSinceUnseenCard = 0;
    this._wavesSinceRefineOffer = 0;
    this._wavesSinceResoRefineOffer = 0;
    this._offeredWordIds = {};
    this._resetShuffleBags();
    this._ensureWordSystem();
    // 續玩時由 _restoreFromCheckpoint import，勿先 reset 蓋掉
    if (!this._pendingResumeCheckpoint && this.app.wordSystem && this.app.wordSystem.resetRun) {
        this.app.wordSystem.resetRun();
    }
    // 🎓 教學局：標記 opening 已完成，避免正常 2 抽開場
    if (this.isTutorialRun && this.app.wordSystem) {
        this.app.wordSystem._openingDone = true;
        this.app.wordSystem._openingStep = 99;
    }
    this._winMode = 'clear';
    this._targetEnemyId = '';
    this._clearGoal();
    this._buildHud();
};

RogueDirector.prototype._shouldStartTutorialRun = function(data) {
    if (this.app._forceTutorialRun || this.app._pendingTutorialRun) return true;
    return false;
};

RogueDirector.prototype._ensureTutorialDirector = function() {
    if (this.app.tutorialDirector) return this.app.tutorialDirector;
    if (typeof TutorialDirector === 'undefined') return null;
    var td = Object.create(TutorialDirector.prototype);
    td.app = this.app;
    td.entity = this.entity;
    TutorialDirector.prototype.initialize.call(td);
    return td;
};

/** 教學結束（Rogue 入口）：清卡、回出生點、開正式 Rogue */
RogueDirector.prototype.startOfficialRunAfterTutorial = function() {
    var ov = document.getElementById('tutorial-complete-ov');
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    var tip = document.getElementById('tutorial-tip');
    if (tip && tip.parentNode) tip.parentNode.removeChild(tip);

    this.isTutorialRun = false;
    this.app._forceTutorialRun = false;
    this.app._pendingTutorialRun = false;
    this.app._tutorialEntry = null;
    if (this.app.tutorialDirector) {
        this.app.tutorialDirector.active = false;
        this.app.tutorialDirector._step = null;
    }

    this.app.timeScale = 1;
    this.app.fire('rogue:inputLock', false);

    var bCtrl = this._getBotCtrl();
    if (bCtrl) {
        bCtrl.cleanupByTeam('red');
        // 教學選卡若招募了友軍，其 team=玩家隊；只清紅隊會把友軍帶進正式局
        bCtrl.cleanupByTeam(this.app.myTeam || 'blue');
    }

    // 清教學累計幣與編制，正式局重來
    this.wave = 0;
    this.waveStatus = 'idle';
    this.isEndless = false;
    this._currentEndlessThreat = null;
    this._earnedCoins = 0;
    this._unbankedCoins = 0;
    this._earnedXp = 0;
    this._rogueKills = 0;
    this._roguePerfectCount = 0;
    this._rogueKillPopCount = 0;
    this._xpBankedWaves = 0;
    this._xpBankedKills = 0;
    this._xpVictoryGranted = false;
    this._endlessXpGranted = 0;
    this._reviveCount = 0;
    this.squad = [];
    this._activatedSynergies = {};
    this._cardCounts = {};
    this._draftMode = 'wave';
    this._openingRerollCount = 0;
    this._wavesSinceR = 0;
    this._wavesSinceSigUpgrade = 0;
    this._wavesSinceUnseenCard = 0;
    this._wavesSinceRefineOffer = 0;
    this._wavesSinceResoRefineOffer = 0;
    this._offeredWordIds = {};
    this._resetShuffleBags();
    this._winMode = 'clear';
    this._targetEnemyId = '';
    this._clearGoal();

    this._ensureWordSystem();
    if (this.app.wordSystem && this.app.wordSystem.resetRun) {
        this.app.wordSystem.resetRun();
    }

    var pc = this.app.playerController;
    if (pc && pc.resetForOfficialRogue) {
        pc.resetForOfficialRogue();
    }

    this._updateHud();
    this._beginRun();
};

RogueDirector.prototype._beginRun = function() {
    if (!this.active) return;

    // 斷點續玩
    if (this._pendingResumeCheckpoint) {
        var cp = this._pendingResumeCheckpoint;
        this._pendingResumeCheckpoint = null;
        this.app._rogueResumeCheckpoint = null;
        this._restoreFromCheckpoint(cp);
        // 續玩後寫一次最新狀態（restart_wave / choosing 皆可）
        this._saveCheckpoint();
        return;
    }

    // 🎓 教學局：跳過開場選卡，直接進 wave 腳本（敵人由 tutorialDirector 分段生成）
    if (this.isTutorialRun) {
        this._draftMode = 'wave';
        this._startNextWave();
        return;
    }
    if (this._useWordSystem() && !this.app.wordSystem.isOpeningDone()) {
        this._draftMode = 'opening';
        this.waveStatus = 'choosing';
        this.app.fire('rogue:inputLock', true); // 選卡 UI 出現前先鎖移動／攻擊（無敵由 inputLock 同步）
        var self = this;
        setTimeout(function() { self._showCards(); }, 400);
        this._saveCheckpoint();
        return;
    }
    this._draftMode = 'wave';
    this._startNextWave();
};

RogueDirector.prototype._ensureWordSystem = function() {
    if (this.app.wordSystem) return;
    if (!window.WordConfig || typeof WordSystem === 'undefined') return;
    var ws = Object.create(WordSystem.prototype);
    ws.app = this.app;
    WordSystem.prototype.initialize.call(ws);
    this.app.wordSystem = ws;
};

RogueDirector.prototype._ensureCheckpointManager = function() {
    if (this.app.rogueCheckpointManager) return this.app.rogueCheckpointManager;
    if (typeof RogueCheckpointManager === 'undefined') return null;
    var cm = Object.create(RogueCheckpointManager.prototype);
    cm.app = this.app;
    RogueCheckpointManager.prototype.initialize.call(cm);
    return cm;
};

RogueDirector.prototype._checkpointApi = function() {
    if (typeof RogueCheckpointManager !== 'undefined') return RogueCheckpointManager;
    // 腳本資產尚未掛載時的最小 fallback（與 rogueCheckpointManager.js 同 key）
    if (!RogueDirector._CheckpointFallback) {
        RogueDirector._CheckpointFallback = {
            STORAGE_KEY: 'tk_rogue_checkpoint_v1',
            CHECKPOINT_VERSION: 1,
            TTL_MS: 72 * 60 * 60 * 1000,
            resolveResumePhase: function(waveStatus) {
                if (waveStatus === 'choosing') return 'choosing';
                if (waveStatus === 'playing') return 'restart_wave';
                if (waveStatus === 'idle') return 'between_waves';
                return null;
            },
            canSaveStatus: function(rd) {
                if (!rd || !rd.active || rd.isTutorialRun) return false;
                var st = rd.waveStatus;
                return st === 'idle' || st === 'playing' || st === 'choosing';
            },
            isValid: function(data) {
                if (!data || data.checkpointVersion !== 1) return false;
                if (!data.savedAt || (Date.now() - data.savedAt) > this.TTL_MS) return false;
                if (!data.resumePhase || !data.hero || data.wave == null) return false;
                return true;
            },
            saveRaw: function(data) {
                try {
                    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
                    return true;
                } catch (e) { return false; }
            },
            clear: function() {
                try { localStorage.removeItem(this.STORAGE_KEY); } catch (e) { /* ignore */ }
            },
            loadValid: function() {
                try {
                    var raw = localStorage.getItem(this.STORAGE_KEY);
                    if (!raw) return null;
                    var data = JSON.parse(raw);
                    if (!this.isValid(data)) { this.clear(); return null; }
                    return data;
                } catch (e) { return null; }
            }
        };
    }
    return RogueDirector._CheckpointFallback;
};

RogueDirector.prototype._bindLifecycleHooks = function() {
    if (typeof document === 'undefined') return;
    var self = this;
    this._onVisibilityChange = function() {
        self._handleVisibilityChange();
    };
    this._onPageHide = function() {
        if (self.active && !self.isTutorialRun) self._saveCheckpoint();
    };
    document.addEventListener('visibilitychange', this._onVisibilityChange);
    if (typeof window !== 'undefined') {
        window.addEventListener('pagehide', this._onPageHide);
    }
};

RogueDirector.prototype._unbindLifecycleHooks = function() {
    if (typeof document !== 'undefined' && this._onVisibilityChange) {
        document.removeEventListener('visibilitychange', this._onVisibilityChange);
    }
    if (typeof window !== 'undefined' && this._onPageHide) {
        window.removeEventListener('pagehide', this._onPageHide);
    }
    this._onVisibilityChange = null;
    this._onPageHide = null;
};

RogueDirector.prototype._handleVisibilityChange = function() {
    if (!this.active || this.isTutorialRun) return;
    if (typeof document === 'undefined') return;

    var gs = this.app.gameSettings;
    var manualPaused = !!(gs && gs._isPaused);

    if (document.hidden) {
        if (!this._visibilityPaused && !manualPaused) {
            this._visibilityPaused = true;
            this._prevTimeScaleForVis = this.app.timeScale || 1;
            this.app.timeScale = 0;
        }
        this._saveCheckpoint();
        return;
    }

    // Returning to foreground
    if (this._visibilityPaused) {
        this._visibilityPaused = false;
        if (!(gs && gs._isPaused)) {
            this.app.timeScale = this._prevTimeScaleForVis || 1;
        }
    }
};

RogueDirector.prototype._clonePlain = function(obj) {
    if (!obj) return {};
    try { return JSON.parse(JSON.stringify(obj)); } catch (e) { return {}; }
};

RogueDirector.prototype._collectCheckpoint = function() {
    var Api = this._checkpointApi();
    if (!Api || !Api.canSaveStatus(this)) return null;

    var phase = Api.resolveResumePhase(this.waveStatus);
    if (!phase) return null;

    var pc = this.app.playerController;
    var hero = (pc && pc.brawlerType) || '';
    var skin = (pc && pc.selectedSkinKey) || (this.app._rogueResumeCheckpoint && this.app._rogueResumeCheckpoint.skin) || '';
    var playerName = this.app.playerName || '';
    if (!playerName && this.app.progressionManager && this.app.progressionManager.getDisplayName) {
        playerName = this.app.progressionManager.getDisplayName() || '';
    }

    var squad = [];
    for (var i = 0; i < (this.squad || []).length; i++) {
        var m = this.squad[i];
        squad.push({
            bType: m.bType || '',
            name: m.name || '',
            faction: m.faction || '',
            dead: !!m.dead
        });
    }

    var wordRun = null;
    if (this._useWordSystem() && this.app.wordSystem && this.app.wordSystem.exportRunState) {
        wordRun = this.app.wordSystem.exportRunState();
    }

    var build = null;
    if (this.app.rogueBuildShare && this.app.rogueBuildShare.collectSnapshot) {
        build = this.app.rogueBuildShare.collectSnapshot(this);
    } else if (this.app.wordSystem && this.app.wordSystem.exportBuildSnapshot) {
        build = this.app.wordSystem.exportBuildSnapshot(this, {});
    }

    var buildV = (typeof WordSystem !== 'undefined' && WordSystem.BUILD_VERSION)
        ? WordSystem.BUILD_VERSION
        : 1;

    return {
        checkpointVersion: Api.CHECKPOINT_VERSION || 1,
        runVersion: buildV,
        savedAt: Date.now(),
        resumePhase: phase,
        wave: this.wave || 0,
        waveStatus: this.waveStatus,
        isEndless: !!this.isEndless,
        _draftMode: this._draftMode || 'wave',
        _unbankedCoins: this._unbankedCoins || 0,
        _earnedCoins: this._earnedCoins || 0,
        _earnedXp: this._earnedXp || 0,
        _rogueKills: this._rogueKills || 0,
        _roguePerfectCount: this._roguePerfectCount || 0,
        _rogueKillPopCount: this._rogueKillPopCount || 0,
        _xpBankedWaves: this._xpBankedWaves || 0,
        _xpBankedKills: this._xpBankedKills || 0,
        _xpVictoryGranted: !!this._xpVictoryGranted,
        _endlessXpGranted: this._endlessXpGranted || 0,
        _reviveCount: this._reviveCount || 0,
        _openingRerollCount: this._openingRerollCount || 0,
        _wavesSinceR: this._wavesSinceR || 0,
        _wavesSinceSigUpgrade: this._wavesSinceSigUpgrade || 0,
        _wavesSinceUnseenCard: this._wavesSinceUnseenCard || 0,
        _wavesSinceRefineOffer: this._wavesSinceRefineOffer || 0,
        _wavesSinceResoRefineOffer: this._wavesSinceResoRefineOffer || 0,
        _offeredWordIds: this._clonePlain(this._offeredWordIds),
        _cardCounts: this._clonePlain(this._cardCounts),
        _activatedSynergies: this._clonePlain(this._activatedSynergies),
        _specialBag: (this._specialBag && this._specialBag.slice) ? this._specialBag.slice() : [],
        _bossBag: (this._bossBag && this._bossBag.slice) ? this._bossBag.slice() : [],
        squad: squad,
        hero: hero,
        skin: skin,
        playerName: playerName,
        wordRun: wordRun,
        build: build
    };
};

RogueDirector.prototype._saveCheckpoint = function() {
    this._ensureCheckpointManager();
    var Api = this._checkpointApi();
    if (!Api || !Api.saveRaw) return false;
    var data = this._collectCheckpoint();
    if (!data) return false;
    return Api.saveRaw(data);
};

RogueDirector.prototype._clearCheckpoint = function() {
    this._ensureCheckpointManager();
    var Api = this._checkpointApi();
    if (Api && Api.clear) Api.clear();
    this.app._rogueResumeCheckpoint = null;
    this._pendingResumeCheckpoint = null;
};

RogueDirector.prototype._respawnSquadFromCheckpoint = function(squadSnap) {
    this.squad = [];
    if (!squadSnap || !squadSnap.length) return;
    var bCtrl = this._getBotCtrl();
    if (!bCtrl) {
        // Keep logical squad even if bots cannot spawn yet
        for (var i = 0; i < squadSnap.length; i++) {
            var m0 = squadSnap[i];
            this.squad.push({
                botId: null,
                bType: m0.bType,
                name: m0.name || this._zhName(m0.bType),
                faction: m0.faction || this.factionOf[m0.bType],
                dead: !!m0.dead
            });
        }
        return;
    }

    for (var j = 0; j < squadSnap.length; j++) {
        var m = squadSnap[j];
        if (!m || !m.bType) continue;
        if (m.dead) {
            this.squad.push({
                botId: null,
                bType: m.bType,
                name: m.name || this._zhName(m.bType),
                faction: m.faction || this.factionOf[m.bType],
                dead: true
            });
            continue;
        }
        var pos = this._getAllySpawnPos();
        var bot = bCtrl.spawnBotAt(m.bType, pos.x, pos.z, { isAlly: true });
        this.squad.push({
            botId: bot ? bot.id : null,
            bType: m.bType,
            name: m.name || this._zhName(m.bType),
            faction: m.faction || this.factionOf[m.bType],
            dead: false
        });
    }
};

RogueDirector.prototype._applyCheckpointFields = function(cp) {
    this.wave = cp.wave || 0;
    this.waveStatus = cp.waveStatus || 'idle';
    this.isEndless = !!cp.isEndless;
    this._draftMode = cp._draftMode || 'wave';
    this._unbankedCoins = cp._unbankedCoins || 0;
    this._earnedCoins = cp._earnedCoins || 0;
    this._earnedXp = cp._earnedXp || 0;
    this._rogueKills = cp._rogueKills || 0;
    this._roguePerfectCount = cp._roguePerfectCount || 0;
    this._rogueKillPopCount = cp._rogueKillPopCount || 0;
    this._xpBankedWaves = cp._xpBankedWaves || 0;
    this._xpBankedKills = cp._xpBankedKills || 0;
    this._xpVictoryGranted = !!cp._xpVictoryGranted;
    this._endlessXpGranted = cp._endlessXpGranted || 0;
    this._reviveCount = cp._reviveCount || 0;
    this._openingRerollCount = cp._openingRerollCount || 0;
    this._wavesSinceR = cp._wavesSinceR || 0;
    this._wavesSinceSigUpgrade = cp._wavesSinceSigUpgrade || 0;
    this._wavesSinceUnseenCard = cp._wavesSinceUnseenCard || 0;
    this._wavesSinceRefineOffer = cp._wavesSinceRefineOffer || 0;
    this._wavesSinceResoRefineOffer = cp._wavesSinceResoRefineOffer || 0;
    this._offeredWordIds = this._clonePlain(cp._offeredWordIds);
    this._cardCounts = this._clonePlain(cp._cardCounts);
    this._activatedSynergies = this._clonePlain(cp._activatedSynergies);
    this._specialBag = (cp._specialBag && cp._specialBag.slice) ? cp._specialBag.slice() : [];
    this._bossBag = (cp._bossBag && cp._bossBag.slice) ? cp._bossBag.slice() : [];
};

RogueDirector.prototype._restoreFromCheckpoint = function(cp) {
    if (!cp) return false;
    var self = this;

    // Clean battlefield before respawn
    var bCtrl = this._getBotCtrl();
    if (bCtrl) {
        bCtrl.cleanupByTeam('red');
        bCtrl.cleanupByTeam(this.app.myTeam || 'blue');
    }

    this._applyCheckpointFields(cp);

    this._ensureWordSystem();
    if (cp.wordRun && this.app.wordSystem && this.app.wordSystem.importRunState) {
        this.app.wordSystem.importRunState(cp.wordRun, this);
    }

    this._respawnSquadFromCheckpoint(cp.squad);
    if (this._useWordSystem() && this.app.wordSystem) {
        if (this.app.wordSystem.onSquadChanged) this.app.wordSystem.onSquadChanged(this);
        else if (this.app.wordSystem.syncArmyCombatStats) this.app.wordSystem.syncArmyCombatStats(this, true);
    } else {
        this._reapplyPersistentArmyBuffs();
    }

    this._updateHud();
    this.app.fire('rogue:inputLock', false);

    var phase = cp.resumePhase || 'between_waves';

    if (phase === 'choosing') {
        this.waveStatus = 'choosing';
        this.app.fire('rogue:inputLock', true);
        setTimeout(function() { self._showCards(); }, 400);
        return true;
    }

    if (phase === 'restart_wave') {
        // Keep build/coins; restart current wave number
        var w = this.wave || 1;
        this.wave = Math.max(0, w - 1);
        this.waveStatus = 'idle';
        this._startNextWave();
        return true;
    }

    // between_waves: advance into next wave from saved wave index
    this.waveStatus = 'idle';
    this._startNextWave();
    return true;
};

RogueDirector.prototype._useWordSystem = function() {
    this._ensureWordSystem();
    return !!(this.app.wordSystem && this.app.wordSystem.isActive && this.app.wordSystem.isActive());
};

// ── 波次推進 ────────────────────────────────────────────────────
RogueDirector.prototype._startNextWave = function() {
    this.wave++;
    this.waveStatus = 'playing';
    this._clearCheckTimer = 1.0;
    if (this._useWordSystem() && this.app.wordSystem) {
        this.app.wordSystem.syncArmyCombatStats(this, true);
    }
    // 先推進數字（WAVE/coins），目標文字會在決定規則後再更新一次
    this._updateHud();
    this._saveCheckpoint();

    var isMilestoneBoss = (this.wave > 0 && this.wave % this.maxWaves === 0);
    var isSpecial = (this.wave % this.bossEvery === 0) && !isMilestoneBoss;
    // 首次打到 maxWaves 且尚未無盡 → 通關用 boss；無盡中每 maxWaves 循環也出 bossPool
    var isFinalClear = (!this.isEndless && this.wave === this.maxWaves);

    var script = null;
    // 🎓 教學第一波：固定腳本；敵人不在此生成（由 tutorialDirector 分段 spawn）
    if (this.isTutorialRun && this.wave === 1 && window.TutorialConfig && window.TutorialConfig.waveScript) {
        script = window.TutorialConfig.waveScript;
    } else if (isMilestoneBoss && this.bossPool.length > 0) {
        script = this._drawFromBag(this.bossPool, '_bossBag');
    } else if (isSpecial && this.specialPool.length > 0) {
        script = this._drawFromBag(this.specialPool, '_specialBag');
    }
    this._waveScript = script;
    this._surviveLeft = (script && script.rule === 'survive') ? (script.surviveTime || 25) : 0;
    this._winMode = script && script.rule ? script.rule : 'clear';
    this._targetEnemyId = '';
    this._targetEnemyName = '';
    this._clearGoal();
    this._applyAllyPassive(script && script.allyPassive, script && script.allyHold);

    this._currentEndlessThreat = null;
    if (this.isEndless && this.wave > this.maxWaves) {
        this._currentEndlessThreat = this._pickEndlessThreat(this.wave);
    }

    var gmm = this.app.gameModeManager;
    if (gmm && gmm._showAnnouncer) {
        var title = script ? (script.announce || script.name)
                           : (isMilestoneBoss ? RogueDirector.t('rogue.wave.finalBoss') : (isSpecial ? RogueDirector.t('rogue.wave.boss', { n: this.wave }) : RogueDirector.t('rogue.wave.n', { n: this.wave })));
        if (title && typeof title === 'object') {
            title = (window.TutorialConfig && TutorialConfig.loc) ? TutorialConfig.loc(title)
                : (window.TKI18n && TKI18n.pick) ? TKI18n.pick(title)
                : (title.zh || title.en || '');
        }
        var annSub = '';
        if (this._currentEndlessThreat) {
            var thN = RogueDirector.loc(this._currentEndlessThreat.name);
            title = thN + ' · ' + RogueDirector.t('rogue.wave.n', { n: this.wave });
            annSub = RogueDirector.loc(this._currentEndlessThreat.desc) || '';
        }
        gmm._showAnnouncer(title, annSub);
        setTimeout(function() { if (gmm._hideAnnouncer) gmm._hideAnnouncer(); }, annSub ? 2400 : 1800);
    }
    if (this._currentEndlessThreat) {
        var th = this._currentEndlessThreat;
        this._showRogueBanner(RogueDirector.loc(th.name), RogueDirector.loc(th.desc) || '', 'mission', 2800);
    }

    var bCtrl = this._getBotCtrl();
    if (!bCtrl) return;
    bCtrl.cleanupByTeam('red');

    var plan = [];
    var spawned = [];
    if (!(this.isTutorialRun && this.wave === 1)) {
        plan = script ? this._buildScriptPlan(script) : this._generateWave(this.wave, isSpecial || isMilestoneBoss, isFinalClear);
        if (this._currentEndlessThreat && !script) {
            this._applyEndlessThreatToPlan(plan, this._currentEndlessThreat);
        }
        for (var i = 0; i < plan.length; i++) {
            var sb = bCtrl.spawnBotAt(plan[i].type, plan[i].x, plan[i].z, plan[i].opts);
            if (sb) spawned.push(sb);
        }
    }

    if (script && script.rule === 'kill_target') {
        this._pickKillTarget(script, spawned);
    }

    if (script && script.rule === 'reach') {
        this._setupReachGoal(script);
    }

    // 🔧 reach/kill_target 的細節（目標名/站住秒數）在上面才決定，這裡再更新 HUD 讓「過關條件」正確
    this._updateHud();

    // 🎓 教學第一波不做 wave intro（避免與操作步驟搶鏡頭）
    if (script && script.intro && !(this.isTutorialRun && this.wave === 1)) this._playWaveIntro(script.intro);
};

RogueDirector.prototype._pickKillTarget = function(script, spawnedBots) {
    if (!script || !script.target || !spawnedBots || spawnedBots.length === 0) return;
    var tType = script.target.type;
    var candidates = [];
    for (var i = 0; i < spawnedBots.length; i++) {
        var b = spawnedBots[i];
        if (!b || b.team !== 'red') continue;
        if (!tType || b.brawlerType === tType) candidates.push(b);
    }
    if (candidates.length === 0) return;
    var pick = candidates[Math.floor(Math.random() * candidates.length)];
    this._targetEnemyId = pick.id;
    pick.name = '★ ' + (pick.name || pick.brawlerType);
    this._targetEnemyName = pick.name;
    if (pick.entity) pick.entity.name = pick.id;
    if (this.app.combatManager && this.app.combatManager.applyRogueTargetMarker && pick.entity) {
        this.app.combatManager.applyRogueTargetMarker(pick.entity);
    }
    this._showRogueBanner(RogueDirector.t('rogue.banner.assassinate'), pick.name.replace('★ ', ''), 'mission', 2200);
};

RogueDirector.prototype._setupReachGoal = function(script) {
    if (!script || !script.goal) return;
    var g = script.goal;
    this._goalRadius = (g.radius !== undefined) ? g.radius : 2.2;
    this._goalHoldTime = (g.holdTime !== undefined) ? g.holdTime : 3.0;
    this._goalHoldLeft = this._goalHoldTime;
    this._goalPos = this._resolveGoalPos(g);
    this._spawnGoalMarker();
    this._showRogueBanner(RogueDirector.t('rogue.banner.occupy'), RogueDirector.t('rogue.banner.holdSec', { n: Math.ceil(this._goalHoldTime) }), 'mission', 2200);
};

RogueDirector.prototype._resolveGoalPos = function(goal) {
    var gmm = this.app.gameModeManager;
    var cx = gmm ? (gmm.mapCenterX || 0) : 0;
    var cz = gmm ? (gmm.mapCenterZ || 0) : 0;
    if (goal.x !== undefined && goal.z !== undefined) {
        var gx = cx + goal.x, gz = cz + goal.z;
        if (gmm && gmm._nudgeOutOfObstacles) {
            var p = gmm._nudgeOutOfObstacles(gx, gz);
            gx = p.x; gz = p.z;
        }
        return { x: gx, z: gz };
    }
    var placement = goal.placement || 'south';
    var spots = this._getScriptSpots(placement, 1, goal.distance, goal.spacing);
    return spots && spots[0] ? spots[0] : { x: cx, z: cz + 10 };
};

RogueDirector.prototype._spawnGoalMarker = function() {
    this._clearGoalMarkerOnly();
    if (!this._goalPos) return;
    var gmm = this.app.gameModeManager;
    var parent = (gmm && gmm.entity) ? gmm.entity : this.entity;
    var e = new pc.Entity('RogueGoal');
    e.addComponent('render', { type: 'plane', castShadows: false, receiveShadows: false });
    e.setPosition(this._goalPos.x, 0.06, this._goalPos.z);
    // 用世界座標對齊地面，避免 parent 旋轉造成 marker 直立
    // PlayCanvas 的 render:plane 本來就是「貼地」(XZ) 的，旋轉 90 反而會變直立招牌
    e.setEulerAngles(0, 0, 0);
    // 與 ROGUE 目標同款金色 ring，提升辨識度（地圖偏綠也清楚）
    e.setLocalScale(this._goalRadius * 2.4, 1, this._goalRadius * 2.4);
    var cm = this.app.combatManager;
    var mat = (cm && cm.rogueTargetMat) ? cm.rogueTargetMat : null;
    if (e.render && e.render.meshInstances && e.render.meshInstances[0]) {
        if (mat) e.render.meshInstances[0].material = mat;
    }
    parent.addChild(e);
    this._goalEntity = e;
};

RogueDirector.prototype._clearGoalMarkerOnly = function() {
    if (this._goalEntity) {
        this._goalEntity.destroy();
        this._goalEntity = null;
    }
};

RogueDirector.prototype._clearGoal = function() {
    this._clearGoalMarkerOnly();
    this._goalPos = null;
    this._goalRadius = 2.2;
    this._goalHoldTime = 0;
    this._goalHoldLeft = 0;
};

RogueDirector.prototype._playWaveIntro = function(intro) {
    var self = this;
    var dur = intro.duration || 2.5;
    var gmm = this.app.gameModeManager;
    var cx = gmm ? (gmm.mapCenterX || 0) : 0;
    var cz = gmm ? (gmm.mapCenterZ || 0) : 0;

    var tx = cx + (intro.focus ? intro.focus.x : 0);
    var tz = cz + (intro.focus ? intro.focus.z : 0);
    if (gmm && gmm._nudgeOutOfObstacles) {
        var safe = gmm._nudgeOutOfObstacles(tx, tz);
        tx = safe.x; tz = safe.z;
    }

    var pCtrl = this.app.playerController;
    if (pCtrl && pCtrl.player) {
        pCtrl.player.setPosition(tx, 0, tz);
        pCtrl._invincible = true;
        pCtrl.invincibleTimer = Math.max(pCtrl.invincibleTimer || 0, dur + 0.3);
    }

    this.app.fire('rogue:inputLock', true);
    var bCtrl = this._getBotCtrl();
    if (bCtrl) bCtrl.triggerIntroRoar(dur, intro.action, intro.aim, intro.aimAngle);

    // Optional: teleport living squad allies near the intro start point (keeps reach missions meaningful).
    if (intro.teleportAllies && bCtrl && this.squad && this.squad.length) {
        for (var si = 0; si < this.squad.length; si++) {
            var mem = this.squad[si];
            if (!mem || mem.dead) continue;
            var bot = null;
            for (var bi = 0; bi < bCtrl.bots.length; bi++) {
                if (bCtrl.bots[bi] && bCtrl.bots[bi].id === mem.botId) { bot = bCtrl.bots[bi]; break; }
            }
            if (!bot || bot.state !== 'alive' || !bot.entity || !bot.entity.enabled) continue;

            var pA = this._findNearbySafePos(tx, tz, 2.4);
            var ax = pA.x, az = pA.z;
            bot.entity.setPosition(ax, 0, az);
            bot.invincibleTimer = Math.max(bot.invincibleTimer || 0, dur + 0.3);
        }
    }

    setTimeout(function() {
        // 解鎖後的無敵 grace 由 inputManager rogue:inputLock(false) 統一處理，勿強制清零
        self.app.fire('rogue:inputLock', false);
    }, dur * 1000);
};

RogueDirector.prototype._buildScriptPlan = function(script) {
    var plan = [];
    var globalHp = 1 + (this.wave - 1) * this.hpScalePerWave;
    var globalDmg = 1 + (this.wave - 1) * this.dmgScalePerWave;
    if (this.isEndless && this.wave > this.maxWaves) {
        var endlessExtra = this.wave - this.maxWaves;
        globalHp *= Math.pow(this.endlessHpRamp, endlessExtra);
        globalDmg *= Math.pow(this.endlessDmgRamp, endlessExtra);
    }
    var endlessThreat = this._currentEndlessThreat;
    if (endlessThreat && endlessThreat.dmgScaleMul) {
        globalDmg *= endlessThreat.dmgScaleMul;
    }
    for (var e = 0; e < script.enemies.length; e++) {
        var entry = script.enemies[e];
        var count = entry.count || 1;
        var spots = this._getScriptSpots(entry.placement || 'scatter', count, entry.distance, entry.spacing);
        for (var i = 0; i < count; i++) {
            var opts = {
                hpScale: (entry.hpScale || 1) * globalHp,
                dmgScale: entry.deadly ? 999 : (entry.dmgScale || 1) * globalDmg,
                speedScale: entry.speedScale,
                sizeScale: entry.sizeScale,
                affixName: entry.affixName,
                canSuper: !!(entry.canSuper || entry.superEvery),
                lockCombo: entry.lockCombo,
                stationary: entry.stationary,
                superEvery: entry.superEvery,
                attackEvery: entry.attackEvery,
                noRegen: entry.noRegen,
                noBasicAttack: entry.noBasicAttack,
                noDodge: entry.noDodge,
                aimMode: entry.aimMode,
                aimAngle: entry.aimAngle,
                allyRole: entry.allyRole,
                shieldPct: entry.shieldPct,
                formation: entry.formation,
                partnerType: entry.partnerType,
                formationBackDist: entry.formationBackDist,
                trueStrike: !!entry.trueStrike,
                duelAi: !!entry.duelAi,
                smartCombo: !!entry.smartCombo
            };
            if (opts.trueStrike) {
                if (!opts.affixNames) opts.affixNames = [];
                var tsLabel = RogueDirector.loc({ zh: '必中', en: 'True Strike' });
                if (opts.affixNames.indexOf(tsLabel) < 0) opts.affixNames.push(tsLabel);
            }
            if (endlessThreat) {
                this._applyThreatAffixesToOpts(opts, endlessThreat);
            }
            plan.push({ type: entry.type, x: spots[i].x, z: spots[i].z, opts: opts });
        }
    }
    return plan;
};

RogueDirector.prototype._applyAffixToOpts = function(opts, af) {
    if (!opts || !af) return;
    if (af.hpScale) opts.hpScale = (opts.hpScale || 1) * af.hpScale;
    if (af.dmgScale) opts.dmgScale = (opts.dmgScale || 1) * af.dmgScale;
    if (af.speedScale) opts.speedScale = (opts.speedScale || 1) * af.speedScale;
    if (af.sizeScale) opts.sizeScale = (opts.sizeScale || 1) * af.sizeScale;
    if (af.shieldPct) opts.shieldPct = Math.max(opts.shieldPct || 0, af.shieldPct);
    if (af.trueStrike) opts.trueStrike = true;
    if (!opts.affixNames) opts.affixNames = [];
    var afLabel = RogueDirector.loc(af.name);
    if (afLabel && opts.affixNames.indexOf(afLabel) < 0) opts.affixNames.push(afLabel);
};

RogueDirector.prototype._getAffixByKey = function(key) {
    for (var i = 0; i < this.affixes.length; i++) {
        if (this.affixes[i].key === key) return this.affixes[i];
    }
    return null;
};

/** 無盡段：依波次輪換威脅模板（詞綴組合） */
RogueDirector.prototype._pickEndlessThreat = function(wave) {
    if (!this.isEndless || wave <= this.maxWaves) return null;
    var list = this.endlessThreats || [];
    var eligible = [];
    for (var i = 0; i < list.length; i++) {
        if (wave >= (list[i].minWave || (this.maxWaves + 1))) eligible.push(list[i]);
    }
    if (!eligible.length) return null;
    var rotate = this.endlessThreatRotateWaves || 2;
    if (rotate < 1) rotate = 1;
    var idx = Math.floor((wave - this.maxWaves - 1) / rotate) % eligible.length;
    return eligible[idx];
};

RogueDirector.prototype._applyThreatAffixesToOpts = function(opts, threat) {
    if (!opts || !threat) return;
    if (threat.name && !opts.affixName) opts.affixName = RogueDirector.loc(threat.name);
    var keys = threat.affixes || [];
    for (var i = 0; i < keys.length; i++) {
        var af = this._getAffixByKey(keys[i]);
        if (af) this._applyAffixToOpts(opts, af);
    }
};

RogueDirector.prototype._applyEndlessThreatToPlan = function(plan, threat) {
    if (!plan || !threat) return;
    for (var i = 0; i < plan.length; i++) {
        if (plan[i].opts) this._applyThreatAffixesToOpts(plan[i].opts, threat);
    }
};

RogueDirector.prototype._spendAffixBudget = function(opts, budget, maxCount) {
    var spent = 0;
    var count = 0;
    var guard = 0;
    // 高波／無盡：優先買必中
    var preferTrueStrike = this.isEndless || this.wave >= this.maxWaves || (this.wave % this.maxWaves === 0);
    if (preferTrueStrike && !opts.trueStrike) {
        var ts = this._getAffixByKey('trueStrike');
        if (ts && ts.cost <= budget) {
            this._applyAffixToOpts(opts, ts);
            spent += ts.cost;
            count++;
        }
    }
    while (count < maxCount && budget > spent && guard < 50) {
        guard++;
        var remaining = budget - spent;
        var buyable = [];
        for (var i = 0; i < this.affixes.length; i++) {
            var cand = this.affixes[i];
            if (cand.cost > remaining) continue;
            if (cand.shieldPct && (opts.shieldPct || 0) > 0) continue;
            if (cand.trueStrike && opts.trueStrike) continue;
            buyable.push(cand);
        }
        if (buyable.length === 0) break;
        var af = buyable[Math.floor(Math.random() * buyable.length)];
        this._applyAffixToOpts(opts, af);
        spent += af.cost;
        count++;
    }
    return spent;
};

RogueDirector.prototype._getScriptSpots = function(placement, count, distance, spacing) {
    if (placement === 'scatter') return this._getEnemySpots(count);
    var gmm = this.app.gameModeManager;
    var cx = gmm ? (gmm.mapCenterX || 0) : 0;
    var cz = gmm ? (gmm.mapCenterZ || 0) : 0;
    var avg = gmm ? (gmm.arenaSx + gmm.arenaSz) / 2 : 1;
    if (!avg || avg <= 0) avg = 1;
    var spots = [];
    var i, p;
    var D = (distance !== undefined) ? distance : 12;
    var SP = (spacing !== undefined) ? spacing : 3;
    D *= avg; SP *= avg;

    if (Array.isArray(placement)) {
        for (i = 0; i < count; i++) {
            var o = placement[i % placement.length];
            p = { x: cx + o.x * avg, z: cz + o.z * avg };
            if (gmm && gmm._nudgeOutOfObstacles) p = gmm._nudgeOutOfObstacles(p.x, p.z);
            spots.push(p);
        }
        return spots;
    }
    for (i = 0; i < count; i++) {
        var off = (i - (count - 1) / 2) * SP;
        if (placement === 'north')      p = { x: cx + off, z: cz - D };
        else if (placement === 'south') p = { x: cx + off, z: cz + D };
        else if (placement === 'east')  p = { x: cx + D, z: cz + off };
        else if (placement === 'west')  p = { x: cx - D, z: cz + off };
        else if (placement === 'center')p = { x: cx + (Math.random() - 0.5) * 3, z: cz + (Math.random() - 0.5) * 3 };
        else {
            var ringR = (distance !== undefined) ? distance : 9;
            ringR *= avg;
            var ang = (i / count) * Math.PI * 2;
            p = { x: cx + Math.cos(ang) * ringR, z: cz + Math.sin(ang) * ringR };
        }
        if (gmm && gmm._nudgeOutOfObstacles) p = gmm._nudgeOutOfObstacles(p.x, p.z);
        spots.push(p);
    }
    return spots;
};

RogueDirector.prototype._applyAllyPassive = function(passive, hold) {
    var bCtrl = this._getBotCtrl();
    if (!bCtrl) return;
    var holdPos = null;
    if (passive && hold) {
        var gmm = this.app.gameModeManager;
        holdPos = { x: (gmm ? gmm.mapCenterX || 0 : 0) + hold.x, z: (gmm ? gmm.mapCenterZ || 0 : 0) + hold.z };
    }
    for (var i = 0; i < this.squad.length; i++) {
        bCtrl.setBotPassive(this.squad[i].botId, !!passive, holdPos);
    }
};

RogueDirector.prototype._generateWave = function(n, isBoss, isFinal) {
    var plan = [];
    var hpScale = 1 + (n - 1) * this.hpScalePerWave;
    var dmgScale = 1 + (n - 1) * this.dmgScalePerWave;
    if (this.isEndless && n > this.maxWaves) {
        var endlessExtra = n - this.maxWaves;
        hpScale *= Math.pow(this.endlessHpRamp, endlessExtra);
        dmgScale *= Math.pow(this.endlessDmgRamp, endlessExtra);
        if (this._currentEndlessThreat && this._currentEndlessThreat.dmgScaleMul) {
            dmgScale *= this._currentEndlessThreat.dmgScaleMul;
        }
    }

    if (isBoss || isFinal) {
        var bcount = 3;
        var bspots = this._getEnemySpots(bcount + 1);
        for (var bi = 0; bi < bcount; bi++) {
            plan.push({ type: 'minion_melee', x: bspots[bi].x, z: bspots[bi].z, opts: { hpScale: hpScale, dmgScale: dmgScale, noRegen: true } });
        }
        var bs = bspots[bcount];
        plan.push({
            type: 'boss_zhangjiao', x: bs.x, z: bs.z,
            opts: {
                hpScale: hpScale * (isFinal ? 1.5 : 1.15),
                dmgScale: dmgScale * (isFinal ? 1.25 : 1.0),
                sizeScale: isFinal ? 1.15 : 1.0,
                canSuper: true,
                noRegen: true,
                trueStrike: true,
                affixName: isFinal ? '天公將軍' : '必中',
                affixNames: ['必中']
            }
        });
        return plan;
    }

    var arch = this._pickWaveArchetype(n);
    plan = this._buildArchetypePlan(arch, n, hpScale, dmgScale);
    return plan && plan.length ? plan : this._buildArchetypePlan('mixed', n, hpScale, dmgScale);
};

RogueDirector.prototype._pickWaveArchetype = function(n) {
    var pool = ['swarm', 'mixed', 'ranged_line'];
    if (n >= 3) pool.push('shield_wall', 'hunters');
    if (n >= 5) pool.push('pincer');
    if (n >= 7) pool.push('elite_escort', 'skirmish');
    if (n >= 10) pool.push('general_pressure', 'assassin_wedge');
    if (this.isEndless && n > this.maxWaves) {
        // 無盡：提高精英威脅權重
        pool.push('elite_escort', 'general_pressure', 'assassin_wedge', 'general_pressure', 'assassin_wedge');
    }
    return pool[Math.floor(Math.random() * pool.length)];
};

RogueDirector.prototype._pushEnemies = function(plan, type, count, spots, startIdx, opts) {
    for (var i = 0; i < count; i++) {
        var s = spots[(startIdx + i) % spots.length];
        plan.push({ type: type, x: s.x, z: s.z, opts: opts });
    }
};

RogueDirector.prototype._cloneOpts = function(base, extra) {
    var o = {
        hpScale: base.hpScale,
        dmgScale: base.dmgScale,
        speedScale: base.speedScale,
        sizeScale: base.sizeScale,
        shieldPct: base.shieldPct,
        noRegen: base.noRegen,
        canSuper: base.canSuper,
        affixName: base.affixName,
        affixNames: base.affixNames ? base.affixNames.slice() : undefined,
        trueStrike: base.trueStrike,
        formation: base.formation,
        partnerType: base.partnerType,
        formationBackDist: base.formationBackDist,
        allyRole: base.allyRole
    };
    if (extra) {
        for (var k in extra) {
            if (extra[k] !== undefined) o[k] = extra[k];
        }
    }
    return o;
};

RogueDirector.prototype._waveBudget = function(n) {
    var perWave = (this.isEndless && n > this.maxWaves) ? this.budgetEndlessPerWave : this.budgetPerWave;
    return this.budgetBase + (n - 1) * perWave;
};

RogueDirector.prototype._generalWaveCost = function(n) {
    if (n >= 10) return 12;
    if (n >= 7) return 16;
    return 999;
};

RogueDirector.prototype._unitCost = function(type, n) {
    if (this._isGeneral(type)) return this._generalWaveCost(n);
    for (var i = 0; i < this.budgetMinions.length; i++) {
        if (this.budgetMinions[i].type === type) return this.budgetMinions[i].cost;
    }
    return 1;
};

/** 依 budget／maxEnemies 從 ideal 配方縮編數量（由後往前削） */
RogueDirector.prototype._fitSlotCounts = function(slots, budget, maxEnemies, n) {
    if (!slots.length || budget <= 0 || maxEnemies <= 0) return { groups: [], spent: 0 };
    var counts = [];
    var i, totalCost = 0, totalCount = 0;
    for (i = 0; i < slots.length; i++) {
        counts[i] = Math.max(0, slots[i].ideal || 0);
        totalCost += counts[i] * this._unitCost(slots[i].type, n);
        totalCount += counts[i];
    }
    while ((totalCost > budget || totalCount > maxEnemies) && totalCount > 0) {
        var reduced = false;
        for (i = slots.length - 1; i >= 0; i--) {
            if (counts[i] > 0) {
                counts[i]--;
                totalCost -= this._unitCost(slots[i].type, n);
                totalCount--;
                reduced = true;
                break;
            }
        }
        if (!reduced) break;
    }
    if (totalCount === 0) {
        var c0 = this._unitCost(slots[0].type, n);
        if (budget >= c0 && maxEnemies >= 1) {
            counts[0] = 1;
            totalCost = c0;
        }
    }
    var groups = [], spent = 0;
    for (i = 0; i < slots.length; i++) {
        if (counts[i] > 0) {
            groups.push({ type: slots[i].type, count: counts[i], opts: slots[i].opts });
            spent += counts[i] * this._unitCost(slots[i].type, n);
        }
    }
    return { groups: groups, spent: spent };
};

RogueDirector.prototype._buildPlanFromRecipe = function(recipe, budget, maxEnemies, n) {
    var plan = [];
    var spent = 0;
    var count = 0;
    var spots = this._getEnemySpots(maxEnemies);
    var spotIdx = 0;
    var leaders = recipe.leaders || [];
    var li;

    for (li = 0; li < leaders.length; li++) {
        if (count >= maxEnemies) break;
        var lc = this._unitCost(leaders[li].type, n);
        if (spent + lc > budget) continue;
        var ls = spots[spotIdx++];
        plan.push({ type: leaders[li].type, x: ls.x, z: ls.z, opts: leaders[li].opts });
        spent += lc;
        count++;
    }

    var slots = recipe.slots || [];
    var filtered = [];
    for (var s = 0; s < slots.length; s++) {
        if (slots[s].waveMin && n < slots[s].waveMin) continue;
        filtered.push(slots[s]);
    }
    var fitted = this._fitSlotCounts(filtered, budget - spent, maxEnemies - count, n);
    for (var g = 0; g < fitted.groups.length; g++) {
        var grp = fitted.groups[g];
        this._pushEnemies(plan, grp.type, grp.count, spots, spotIdx, grp.opts);
        spotIdx += grp.count;
    }
    spent += fitted.spent;
    return { plan: plan, spent: spent };
};

RogueDirector.prototype._spendAffixBudgetOnPlan = function(plan, budget) {
    if (!plan || !plan.length || !(budget > 0)) return budget;
    var guard = 0;
    while (budget > 0 && guard < 200) {
        guard++;
        var progressed = false;
        for (var i = 0; i < plan.length; i++) {
            if (!plan[i].opts) continue;
            var affixCount = (plan[i].opts.affixNames || []).length;
            if (affixCount >= 2) continue;
            var spent = this._spendAffixBudget(plan[i].opts, budget, 1);
            if (spent > 0) {
                budget -= spent;
                progressed = true;
            }
        }
        if (!progressed) break;
    }
    return budget;
};

RogueDirector.prototype._getArchetypeRecipe = function(arch, n, base, hpScale, dmgScale, gType, g2) {
    var recipe = { leaders: [], slots: [] };
    if (arch === 'swarm') {
        recipe.slots = [
            { type: 'minion_melee', ideal: 5, opts: this._cloneOpts(base, { hpScale: hpScale * 0.85, speedScale: 1.15 }) },
            { type: 'minion_ranged', ideal: 1, waveMin: 4, opts: this._cloneOpts(base, { hpScale: hpScale * 0.75, dmgScale: dmgScale * 1.1 }) }
        ];
        return recipe;
    }
    if (arch === 'ranged_line') {
        recipe.slots = [
            { type: 'minion_ranged', ideal: 3, opts: this._cloneOpts(base, { hpScale: hpScale * 0.8, dmgScale: dmgScale * 1.15 }) },
            { type: 'minion_CB', ideal: 2, opts: this._cloneOpts(base, { hpScale: hpScale * 0.85 }) },
            { type: 'minion_melee', ideal: 1, opts: this._cloneOpts(base, { hpScale: hpScale * 1.1, shieldPct: 0.15, speedScale: 0.85 }) }
        ];
        return recipe;
    }
    if (arch === 'shield_wall') {
        recipe.slots = [
            { type: 'minion_melee', ideal: 3, opts: this._cloneOpts(base, { hpScale: hpScale * 1.25, shieldPct: 0.22, speedScale: 0.75, affixName: '盾牆' }) },
            { type: 'minion_ranged', ideal: 2, opts: this._cloneOpts(base, { hpScale: hpScale * 0.7, dmgScale: dmgScale * 1.2 }) }
        ];
        return recipe;
    }
    if (arch === 'hunters') {
        recipe.slots = [
            { type: 'minion_melee', ideal: 2, opts: this._cloneOpts(base, { speedScale: 1.35, dmgScale: dmgScale * 1.15, hpScale: hpScale * 0.8 }) },
            { type: 'minion_CB', ideal: 2, opts: this._cloneOpts(base, { speedScale: 1.2, hpScale: hpScale * 0.85 }) },
            { type: 'minion_ranged', ideal: 2, opts: this._cloneOpts(base, { hpScale: hpScale * 0.75 }) }
        ];
        return recipe;
    }
    if (arch === 'pincer') {
        recipe.slots = [
            { type: 'minion_melee', ideal: 2, opts: this._cloneOpts(base, { speedScale: 1.2 }) },
            { type: 'minion_ranged', ideal: 2, opts: this._cloneOpts(base, { dmgScale: dmgScale * 1.15 }) },
            { type: 'minion_CB', ideal: 2, opts: this._cloneOpts(base, { dmgScale: dmgScale * 1.1 }) }
        ];
        return recipe;
    }
    if (arch === 'skirmish') {
        recipe.slots = [
            { type: 'minion_melee', ideal: 2, opts: this._cloneOpts(base, { speedScale: 1.4, hpScale: hpScale * 0.75, dmgScale: dmgScale * 1.2, affixName: '游擊' }) },
            { type: 'minion_ranged', ideal: 2, opts: this._cloneOpts(base, { speedScale: 1.15, hpScale: hpScale * 0.7 }) },
            { type: 'minion_CB', ideal: 1, opts: this._cloneOpts(base, { speedScale: 1.25, hpScale: hpScale * 0.8 }) }
        ];
        return recipe;
    }
    if (arch === 'elite_escort') {
        recipe.leaders = [{
            type: gType,
            opts: this._cloneOpts(base, {
                hpScale: hpScale * 1.15, dmgScale: dmgScale * 1.2, sizeScale: 1.2,
                canSuper: true, noRegen: true, affixName: '將領'
            })
        }];
        recipe.slots = [
            { type: 'minion_melee', ideal: 2, opts: this._cloneOpts(base, { hpScale: hpScale * 0.85 }) },
            { type: 'minion_ranged', ideal: 2, opts: this._cloneOpts(base, { hpScale: hpScale * 0.75, dmgScale: dmgScale * 1.1 }) }
        ];
        return recipe;
    }
    if (arch === 'general_pressure') {
        recipe.leaders = [{
            type: gType,
            opts: this._cloneOpts(base, {
                formation: 'bodyguard', partnerType: g2 === gType ? 'minion_ranged' : g2,
                hpScale: hpScale * 1.25, dmgScale: dmgScale * 1.15, sizeScale: 1.25,
                canSuper: true, noRegen: true, affixName: '先鋒'
            })
        }];
        if (g2 !== gType) {
            recipe.leaders.push({
                type: g2,
                opts: this._cloneOpts(base, {
                    formation: 'backline', partnerType: gType, formationBackDist: 6,
                    allyRole: 'tactician', hpScale: hpScale * 0.9, dmgScale: dmgScale * 1.3,
                    sizeScale: 1.15, canSuper: true, noRegen: true, affixName: '後陣'
                })
            });
            recipe.slots = [
                { type: 'minion_melee', ideal: 2, opts: this._cloneOpts(base, { hpScale: hpScale * 0.8 }) }
            ];
        } else {
            recipe.slots = [
                { type: 'minion_ranged', ideal: 2, opts: this._cloneOpts(base, { hpScale: hpScale * 0.75 }) },
                { type: 'minion_melee', ideal: 2, opts: this._cloneOpts(base, {
                    formation: 'bodyguard', partnerType: gType, hpScale: hpScale * 0.9, shieldPct: 0.15
                }) }
            ];
        }
        return recipe;
    }
    if (arch === 'assassin_wedge') {
        recipe.leaders = [{
            type: 'zhangliao',
            opts: this._cloneOpts(base, {
                hpScale: hpScale * 1.05, dmgScale: dmgScale * 1.35, speedScale: 1.4,
                sizeScale: 1.15, canSuper: true, noRegen: true, affixName: '奇襲'
            })
        }];
        recipe.slots = [
            { type: 'minion_melee', ideal: 3, opts: this._cloneOpts(base, { speedScale: 1.3, hpScale: hpScale * 0.7 }) },
            { type: 'minion_CB', ideal: 1, opts: this._cloneOpts(base, { hpScale: hpScale * 0.8 }) }
        ];
        return recipe;
    }
    // mixed（預設）
    recipe.slots = [
        { type: 'minion_melee', ideal: 2, opts: this._cloneOpts(base, {}) },
        { type: 'minion_ranged', ideal: 2, opts: this._cloneOpts(base, {}) },
        { type: 'minion_CB', ideal: Math.min(2, Math.max(1, Math.floor(n / 5))), waveMin: 5, opts: this._cloneOpts(base, {}) }
    ];
    return recipe;
};

RogueDirector.prototype._buildArchetypePlan = function(arch, n, hpScale, dmgScale) {
    var budget = this._waveBudget(n);
    var base = { hpScale: hpScale, dmgScale: dmgScale, noRegen: n >= 8 || (this.isEndless && n > this.maxWaves) };
    var generals = ['guanyu', 'zhangfei', 'zhangliao', 'zhouyu', 'caocao', 'lubu'];
    var gType = generals[Math.floor(Math.random() * generals.length)];
    var g2 = generals[Math.floor(Math.random() * generals.length)];
    var recipe = this._getArchetypeRecipe(arch, n, base, hpScale, dmgScale, gType, g2);
    var built = this._buildPlanFromRecipe(recipe, budget, this.maxEnemies, n);
    var remaining = budget - built.spent;
    if (built.plan.length >= this.minEnemiesBeforeAffix && !(this.isEndless && n > this.maxWaves)) {
        this._spendAffixBudgetOnPlan(built.plan, remaining);
    }
    return built.plan;
};

RogueDirector.prototype._generateBudgetWave = function(n, hpScale, dmgScale) {
    var plan = [];
    var perWave = (this.isEndless && n > this.maxWaves) ? this.budgetEndlessPerWave : this.budgetPerWave;
    var budget = this.budgetBase + (n - 1) * perWave;

    var picks = [];
    var generalBought = false;
    var guard = 0;
    while (budget > 0 && picks.length < this.maxEnemies && guard < 200) {
        guard++;
        var buyable = [];
        for (var m = 0; m < this.budgetMinions.length; m++) {
            if (this.budgetMinions[m].cost <= budget) buyable.push(this.budgetMinions[m]);
        }
        // 中後期才把武將列入可買（並調低有效花費）
        var generalCost = n >= 10 ? 12 : (n >= 7 ? 16 : 999);
        if (!generalBought && budget >= generalCost) {
            for (var g = 0; g < this.budgetGenerals.length; g++) {
                buyable.push({ type: this.budgetGenerals[g].type, cost: generalCost });
            }
        }
        if (buyable.length === 0) break;
        var pick = buyable[Math.floor(Math.random() * buyable.length)];
        budget -= pick.cost;
        if (this._isGeneral(pick.type)) generalBought = true;
        picks.push({ type: pick.type, opts: { hpScale: hpScale, dmgScale: dmgScale } });
    }

    if (picks.length >= this.minEnemiesBeforeAffix && !(this.isEndless && n > this.maxWaves)) {
        var affixGuard = 0;
        while (budget > 0 && affixGuard < 200) {
            affixGuard++;
            var progressed = false;
            for (var pi = 0; pi < picks.length; pi++) {
                var affixCount = (picks[pi].opts.affixNames || []).length;
                if (affixCount >= 2) continue;
                var spent = this._spendAffixBudget(picks[pi].opts, budget, 1);
                if (spent > 0) {
                    budget -= spent;
                    progressed = true;
                }
            }
            if (!progressed) break;
        }
    }

    var spots = this._getEnemySpots(picks.length);
    for (var i = 0; i < picks.length; i++) {
        plan.push({ type: picks[i].type, x: spots[i].x, z: spots[i].z, opts: picks[i].opts });
    }
    return plan;
};

RogueDirector.prototype._isGeneral = function(type) {
    for (var i = 0; i < this.budgetGenerals.length; i++) {
        if (this.budgetGenerals[i].type === type) return true;
    }
    return false;
};

RogueDirector.prototype._getEnemySpots = function(count) {
    var gmm = this.app.gameModeManager;
    var spots = [];
    var pveSpawns = (gmm && gmm.pveEnemySpawns && gmm.pveEnemySpawns.length > 0) ? gmm.pveEnemySpawns : null;
    var cx = gmm ? (gmm.mapCenterX || 0) : 0;
    var cz = gmm ? (gmm.mapCenterZ || 0) : 0;
    var avg = gmm ? (gmm.arenaSx + gmm.arenaSz) / 2 : 1;
    if (!avg || avg <= 0) avg = 1;

    for (var i = 0; i < count; i++) {
        var p;
        if (pveSpawns) {
            var base = pveSpawns[Math.floor(Math.random() * pveSpawns.length)];
            p = { x: base.x + (Math.random() - 0.5) * 2.5, z: base.z + (Math.random() - 0.5) * 2.5 };
        } else {
            var ang = (i / count) * Math.PI * 2 + Math.random() * 0.6;
            var r = (8 + Math.random() * 3) * avg;
            p = { x: cx + Math.cos(ang) * r, z: cz + Math.sin(ang) * r };
        }
        if (gmm && gmm._nudgeOutOfObstacles) p = gmm._nudgeOutOfObstacles(p.x, p.z);
        spots.push(p);
    }
    return spots;
};

// ── 主迴圈:全滅檢查 ────────────────────────────────────────────
RogueDirector.prototype.update = function(dt) {
    if (!this.active || this.waveStatus !== 'playing') return;
    if (this.app.gameState !== 'playing') return;

    if (this._surviveLeft > 0) {
        this._surviveLeft -= dt;
        // Cache DOM refs and only update once per displayed second.
        if (!this._hudWaveEl) this._hudWaveEl = document.getElementById('rg-hud-wave');
        var sec = Math.ceil(this._surviveLeft);
        if (sec !== this._hudLastWaveSec) {
            this._hudLastWaveSec = sec;
            var surviveWaveText = RogueDirector.t('rogue.hud.waveSurvive', { n: this.wave, sec: sec });
            if (!this._hudCache) this._hudCache = {};
            this._hudCache.waveText = surviveWaveText;
            if (this._hudWaveEl) this._hudWaveEl.textContent = surviveWaveText;
        }
        if (this._surviveLeft <= 0) {
            this._surviveLeft = 0;
            var bc = this._getBotCtrl();
            if (bc) bc.cleanupByTeam('red', true);
            this._onWaveCleared();
            return;
        }
    }

    // 🏁 到達出口：站住 holdTime 秒即可通關
    if (this._winMode === 'reach' && this._goalPos && this._goalHoldTime > 0) {
        var pCtrl = this.app.playerController;
        var player = pCtrl ? pCtrl.player : null;
        if (player && player.enabled && !pCtrl.isDead) {
            var pp = player.getPosition();
            var dx = pp.x - this._goalPos.x;
            var dz = pp.z - this._goalPos.z;
            var inside = (dx * dx + dz * dz) <= (this._goalRadius * this._goalRadius);
            if (inside) {
                this._goalHoldLeft -= dt;
                if (!this._hudWaveEl) this._hudWaveEl = document.getElementById('rg-hud-wave');
                var sec2 = Math.max(0, Math.ceil(this._goalHoldLeft));
                if (sec2 !== this._hudLastWaveSec) {
                    this._hudLastWaveSec = sec2;
                    var holdWaveText = RogueDirector.t('rogue.hud.hold', { n: this.wave, sec: sec2 });
                    if (!this._hudCache) this._hudCache = {};
                    this._hudCache.waveText = holdWaveText;
                    if (this._hudWaveEl) this._hudWaveEl.textContent = holdWaveText;
                }
                if (this._goalHoldLeft <= 0) {
                    var bc2 = this._getBotCtrl();
                    if (bc2) bc2.cleanupByTeam('red', true);
                    this._onWaveCleared();
                    return;
                }
            } else {
                this._goalHoldLeft = this._goalHoldTime;
                // Reset so UI updates immediately when re-entering the zone.
                this._hudLastWaveSec = null;
            }
        }
    }

    this._clearCheckTimer -= dt;
    if (this._clearCheckTimer > 0) return;
    this._clearCheckTimer = 0.4;

    // 🎓 教學步驟尚未進入清場段時不判過關（避免木人死後提早結束）
    var td = this.app.tutorialDirector;
    if (this.isTutorialRun && td && td.allowsWaveClear && !td.allowsWaveClear()) return;

    var bCtrl = this._getBotCtrl();
    if (!bCtrl) return;

    var enemyAlive = false, enemySeen = false;
    for (var i = 0; i < bCtrl.bots.length; i++) {
        var b = bCtrl.bots[i];
        if (b.team !== 'red') continue;
        enemySeen = true;
        if (b.state === 'alive') { enemyAlive = true; break; }
    }
    if (enemySeen && !enemyAlive) this._onWaveCleared();
};

RogueDirector.prototype._onWaveCleared = function() {
    this._surviveLeft = 0;
    this._applyAllyPassive(false);
    this._winMode = 'clear';
    this._targetEnemyId = '';
    this._clearGoal();

    // 🌟 波次通關的低保金幣降為 5 (大頭已經在擊殺時給予了)
    var isMilestoneBossClear = (this.wave > 0 && this.wave % this.maxWaves === 0);
    var isSpecialClear = (this.wave % this.bossEvery === 0);
    var earn = 5 + ((isMilestoneBossClear || isSpecialClear) ? this.bossBonusCoins : 0);
    if (this.isEndless && this.wave > this.maxWaves) {
        earn = Math.max(0, Math.round(earn * Math.pow(this.endlessCoinDecay, this.wave - this.maxWaves)));
    }
    this._earnedCoins += earn;
    this._unbankedCoins += earn;
    this._updateHud();

    var CR = (this.app && this.app.combatResolver) || (typeof window !== 'undefined' ? window.CombatResolver : null);
    if (CR && CR.refreshArmyShields) CR.refreshArmyShields(this.app);

    if (!this.isEndless && this.wave >= this.maxWaves) {
        this._onVictory();
        return;
    }

    // 🎓 教學局：清關後交給 tutorialDirector（不進一般波間選卡）
    if (this.isTutorialRun) {
        this.waveStatus = 'choosing';
        if (this.app.tutorialDirector && this.app.tutorialDirector.onTutorialWaveCleared) {
            this.app.tutorialDirector.onTutorialWaveCleared();
        } else {
            this.app.fire('tutorial:waveCleared');
        }
        return;
    }

    // 🌟 本命卡 Lv2 保底：Boss／特殊波通關後標記下次波間必出覺醒卡
    if ((isMilestoneBossClear || isSpecialClear) && this._useWordSystem() && this.app.wordSystem.onBossWaveCleared) {
        this.app.wordSystem.onBossWaveCleared(this);
    }

    this.waveStatus = 'choosing';
    this.app.fire('rogue:inputLock', true); // 波間選卡 UI 出現前先鎖移動／攻擊（無敵由 inputLock 同步）
    this._saveCheckpoint();
    var self = this;
    setTimeout(function() { self._showCards(); }, 700);
};

// ── 三選一卡池 ──────────────────────────────────────────────────
RogueDirector.prototype._buildCardOptions = function() {
    if (this._useWordSystem() && this._draftMode === 'opening') {
        return this._buildOpeningWordCards();
    }
    if (this._useWordSystem()) {
        return this._buildWaveWordCards();
    }
    return this._buildLegacyCardOptions();
};

// 🃏 開局選詞。第一次抽 = 本命卡池（角色 SSR + 通用 SR，不足補普通卡）。
RogueDirector.prototype._buildOpeningWordCards = function() {
    var self = this;
    var ws = this.app.wordSystem;
    var cards = [];

    // 🌟 第一次開局抽 + 尚未做本命選擇 → 本命卡池
    var isSignatureDraft = ws.isSignatureDraftPending && ws.isSignatureDraftPending();
    if (isSignatureDraft) {
        var sigPool = ws.getOpeningSignaturePool();
        var ids = sigPool.slice();
        // 不足 3 張 → 補普通卡（排除效果本命），本命卡排前面
        if (ids.length < 3) {
            var filler = ws.rollCardChoices(3 - ids.length, true, null, { excludeEffect: true }) || [];
            for (var f = 0; f < filler.length; f++) if (ids.indexOf(filler[f]) < 0) ids.push(filler[f]);
        }
        ids = ids.slice(0, 3);
        for (var i = 0; i < ids.length; i++) {
            var cid = ids[i];
            if (!this._offeredWordIds) this._offeredWordIds = {};
            this._offeredWordIds[cid] = true;
            var isSig = ws.isSignatureEffectCardId(cid);
            var oc = this._makeWordCard(cid, {
                apply: (function(id, sig) {
                    return function() {
                        if (sig) { ws.chooseSignatureCard(id, self); }
                        else { ws.pickPlainAsSignature(id, self); }
                    };
                })(cid, isSig)
            });
            if (oc) cards.push(oc);
        }
        return cards;
    }

    // 非本命輪：一般開局選詞（排除所有效果本命卡）
    var ids2 = ws.rollCardChoices(3, true, null, { excludeEffect: true });
    for (var j = 0; j < ids2.length; j++) {
        if (!this._offeredWordIds) this._offeredWordIds = {};
        this._offeredWordIds[ids2[j]] = true;
        var oc2 = this._makeWordCard(ids2[j], {
            apply: (function(cid) {
                return function() { ws.completeOpeningPick(cid, self); };
            })(ids2[j])
        });
        if (oc2) cards.push(oc2);
    }
    return cards;
};

// 🃏 波間：可抽種類公平組三選一（新詞／精煉／招募／本命覺醒）+ 軟3硬5保底
RogueDirector.prototype._buildWaveWordCards = function() {
    var self = this;
    var ws = this.app.wordSystem;
    var cfg = window.WordConfig || {};
    var cards = [];
    var usedIds = {};
    var offeredR = false;
    var offeredSigUpgrade = false;
    var offeredUnseen = false;
    var offeredRefine = false;
    var offeredResoRefine = false;

    // 本波開始前已出現過的詞卡（用於判定「本波是否出了未見詞」）
    var offeredBefore = {};
    if (this._offeredWordIds) {
        for (var obk in this._offeredWordIds) {
            if (this._offeredWordIds.hasOwnProperty(obk)) offeredBefore[obk] = true;
        }
    }

    var squadFull = this.squad.length >= this.squadCap;
    var recruitPool = this._getRecruitPool();
    var softW = cfg.pitySoftWaves != null ? cfg.pitySoftWaves : 3;
    var hardW = cfg.pityHardWaves != null ? cfg.pityHardWaves : 5;
    var softChance = cfg.pitySoftChance != null ? cfg.pitySoftChance : 0.7;
    var forceR = (this._wavesSinceR || 0) >= (cfg.pityWavesWithoutR || 4);

    var pityShouldFire = function(waves) {
        if (waves >= hardW) return true;
        if (waves >= softW) return Math.random() < softChance;
        return false;
    };

    var addWordCard = function(cardId) {
        if (!cardId || usedIds[cardId]) return false;
        if (!ws.canAddCard()) return false;
        usedIds[cardId] = true;
        var oc = self._makeWordCard(cardId, {
            apply: (function(cid) {
                return function() {
                    if (ws.addCard(cid, self)) { /* HUD updates */ }
                };
            })(cardId)
        });
        if (!oc) return false;
        cards.push(oc);
        return true;
    };

    var listUnseenWords = function() {
        var candidates = ws._buildPool(true, usedIds, { excludeEffect: true }) || [];
        var unseen = [];
        var offered = self._offeredWordIds || {};
        for (var i = 0; i < candidates.length; i++) {
            if (!offered[candidates[i]]) unseen.push(candidates[i]);
        }
        return unseen;
    };

    var listResoRefinePicks = function() {
        var candidates = [];
        var virt = ws.getVirtualFinisherRefineIds ? ws.getVirtualFinisherRefineIds() : [];
        for (var v = 0; v < virt.length; v++) {
            if (!usedIds['upgrade_' + virt[v]] && ws.canUpgradeCard(virt[v], self)) {
                candidates.push({ type: 'owned', id: virt[v] });
            }
        }
        var resoFacs = ws.getUpgradeableResonanceFactions ? ws.getUpgradeableResonanceFactions() : [];
        for (var rf = 0; rf < resoFacs.length; rf++) {
            var facId = resoFacs[rf];
            if (ws.canRefineSlotlessFinisher && ws.canRefineSlotlessFinisher(facId) &&
                !usedIds['upgrade_finisher_' + facId]) {
                candidates.push({ type: 'slotless', faction: facId });
            }
        }
        return candidates;
    };

    var listNormalRefinePicks = function() {
        var ownedUp = ws.getUpgradeableOwnedIds ? ws.getUpgradeableOwnedIds(self) : [];
        var virtSet = {};
        var virt = ws.getVirtualFinisherRefineIds ? ws.getVirtualFinisherRefineIds() : [];
        for (var v = 0; v < virt.length; v++) virtSet[virt[v]] = true;
        var candidates = [];
        for (var oi = 0; oi < (ownedUp || []).length; oi++) {
            var oid = ownedUp[oi];
            if (virtSet[oid]) continue; // 共鳴收尾走獨立種類
            if (!usedIds['upgrade_' + oid]) {
                candidates.push({ type: 'owned', id: oid });
            }
        }
        return candidates;
    };

    var pushRefineFromPick = function(pick) {
        if (!pick) return false;
        if (pick.type === 'slotless') {
            var fac = pick.faction;
            usedIds['upgrade_finisher_' + fac] = true;
            var meta = ws._finisherMeta ? ws._finisherMeta(fac) : null;
            var label = (meta && RogueDirector.loc(meta.label)) || fac;
            var facMeta = ws.getFactionMeta(fac);
            var upParts = ws.formatResonanceUpgradeParts(fac);
            var flv = ws.getFinisherLevel ? ws.getFinisherLevel(fac) : 0;
            var refinePrefix = RogueDirector.t('rogue.refine.prefix');
            cards.push({
                id: 'upgrade_finisher_' + fac,
                kind: 'refine',
                baseName: label,
                name: refinePrefix + label,
                effectBadge: 'DOT',
                school: ws.getSchoolLabel({ faction: fac }) || '',
                stat: upParts.headline,
                desc: upParts.detail,
                countText: RogueDirector.t('rogue.refine.count', { n: flv }),
                readableTag: '',
                color: facMeta ? facMeta.color : '#c9a25a',
                edge: facMeta ? facMeta.edge : '#c9a25a',
                apply: (function(f) {
                    return function() { ws.upgradeResonanceFinisher(f, self); };
                })(fac)
            });
            offeredRefine = true;
            offeredResoRefine = true;
            return true;
        }

        var upId = pick.id;
        usedIds['upgrade_' + upId] = true;
        var upDef = ws.getCardDef(upId);
        var upLv = ws.getUpgradeLevel(upId);
        var upFac = upDef ? ws.getFactionMeta(upDef.faction) : null;
        var upPartsOwned = upDef ? ws.formatUpgradeCardParts(upDef, upLv, self) : { headline: '', detail: '' };
        var isResoVirt = !!(upDef && upDef.schoolFinisher && !ws.hasCard(upId));
        var upName = upDef ? (window.WordConfig && WordConfig.getName ? WordConfig.getName(upDef) : upDef.id) : upId;
        var refinePrefix2 = RogueDirector.t('rogue.refine.prefix');
        cards.push({
            id: 'upgrade_' + upId,
            kind: 'refine',
            baseName: upName,
            name: refinePrefix2 + upName,
            effectBadge: ws.getEffectTypeLabel(upDef),
            school: upDef ? ws.getSchoolLabel(upDef) : '',
            stat: upPartsOwned.headline,
            desc: upPartsOwned.detail,
            countText: RogueDirector.t('rogue.refine.count', { n: upLv }),
            readableTag: upDef ? upDef.readableTag : '',
            color: upFac ? upFac.color : '#c9a25a',
            edge: upFac ? upFac.edge : '#c9a25a',
            apply: (function(id) {
                return function() { ws.upgradeCard(id, self); };
            })(upId)
        });
        offeredRefine = true;
        if (isResoVirt) offeredResoRefine = true;
        return true;
    };

    var addResoRefineCard = function() {
        var candidates = listResoRefinePicks();
        if (!candidates.length) return false;
        return pushRefineFromPick(candidates[Math.floor(Math.random() * candidates.length)]);
    };

    var addNormalRefineCard = function() {
        var candidates = listNormalRefinePicks();
        if (!candidates.length) return false;
        return pushRefineFromPick(candidates[Math.floor(Math.random() * candidates.length)]);
    };

    var addRefineCard = function() {
        // 相容：優先共鳴收尾，否則普通精煉
        if (addResoRefineCard()) return true;
        return addNormalRefineCard();
    };

    var addSigUpgradeCard = function() {
        if (usedIds['sig_upgrade']) return false;
        if (!ws.canOfferSignatureUpgrade()) return false;
        usedIds['sig_upgrade'] = true;
        var sigDef = ws.getCardDef(ws.getSignatureCardId());
        if (!sigDef) return false;
        var sigFac = ws.getFactionMeta(sigDef.faction) || { color: '#c9a25a', edge: '#c9a25a' };
        var sigTier = ws.getSignatureTier();
        var sigParts = ws.formatSignatureUpgradeParts();
        var sigName = (window.WordConfig && WordConfig.getName) ? WordConfig.getName(sigDef) : sigDef.id;
        var sigSealRaw = sigFac.label;
        var sigSealZh = (sigSealRaw && typeof sigSealRaw === 'object') ? sigSealRaw.zh : sigSealRaw;
        cards.push({
            id: 'sig_upgrade',
            kind: 'sig_upgrade',
            name: sigName,
            rarity: sigDef.rarity || 'SSR',
            effectBadge: ws.getEffectTypeLabel(sigDef),
            school: ws.getSchoolLabel(sigDef),
            factionSeal: (sigSealZh && String(sigSealZh).length === 1) ? String(sigSealZh) : '',
            stat: sigParts.headline,
            desc: sigParts.detail,
            countText: RogueDirector.t('rogue.sig.upgradeCount', { n: sigTier + 2 }),
            color: sigFac.color || '#c9a25a',
            edge: sigFac.edge || sigFac.color || '#c9a25a',
            apply: function() { ws.upgradeSignatureCard(self); }
        });
        offeredSigUpgrade = true;
        return true;
    };

    var addRecruitCard = function() {
        if (squadFull || recruitPool.length === 0) return false;
        var avail = [];
        for (var i = 0; i < recruitPool.length; i++) {
            if (!usedIds['recruit_' + recruitPool[i]]) avail.push(recruitPool[i]);
        }
        if (!avail.length) return false;
        var pick = avail[Math.floor(Math.random() * avail.length)];
        usedIds['recruit_' + pick] = true;
        cards.push(self._makeRecruitCard(pick));
        return true;
    };

    var addRandomWord = function() {
        if (!ws.canAddCard()) return false;
        var waveOpts = { excludeEffect: true, excludeIds: usedIds };
        var ids = ws.rollCardChoices(1, true, null, waveOpts);
        if (!ids.length) return false;
        return addWordCard(ids[0]);
    };

    // 本命：硬保底強制佔格；僅機率通過則進公平池
    var sigForce = false;
    var sigInPool = false;
    if (ws.canOfferSignatureUpgrade()) {
        var sigPityNeed = cfg.signatureUpgradePityWaves || 5;
        if (ws._sigBossPityDue && (ws._sigTier || 0) < 1) sigForce = true;
        else if ((this._wavesSinceSigUpgrade || 0) >= sigPityNeed) sigForce = true;
        else {
            var sigChance = cfg.signatureUpgradeChance;
            if (sigChance === undefined) sigChance = 0.28;
            if (Math.random() < sigChance) sigInPool = true;
        }
    }

    // 招募：空編制必出；否則本波 ~45% 允許進公平池
    var recruitForce = !squadFull && recruitPool.length > 0 && this.squad.length === 0;
    var recruitInPool = !squadFull && recruitPool.length > 0 && !recruitForce && Math.random() < 0.45;

    var hasResoRefinePool = listResoRefinePicks().length > 0;
    var hasNormalRefinePool = listNormalRefinePicks().length > 0;
    var hasRefinePool = hasResoRefinePool || hasNormalRefinePool;
    var hasUnseenPool = ws.canAddCard() && listUnseenWords().length > 0;
    var wantResoRefinePity = hasResoRefinePool && pityShouldFire(this._wavesSinceResoRefineOffer || 0);
    var wantRefinePity = hasRefinePool && pityShouldFire(this._wavesSinceRefineOffer || 0);
    var wantUnseenPity = hasUnseenPool && pityShouldFire(this._wavesSinceUnseenCard || 0);

    // 強制格（保底／空編制／R／本命硬保底）— 先佔位，避免被公平抽擠掉
    if (recruitForce && cards.length < 3) addRecruitCard();
    // 共鳴收尾精煉優先於普通精煉保底
    if (wantResoRefinePity && cards.length < 3) addResoRefineCard();
    else if (wantRefinePity && cards.length < 3) addRefineCard();
    if (wantUnseenPity && cards.length < 3) {
        var unseenList = listUnseenWords();
        if (unseenList.length) {
            addWordCard(unseenList[Math.floor(Math.random() * unseenList.length)]);
        }
    }
    if (sigForce && cards.length < 3) addSigUpgradeCard();
    if (forceR && ws.canAddCard() && cards.length < 3) {
        var rPick = ws.rollCardChoices(1, true, null, {
            forceRarity: 'R', excludeIds: usedIds, excludeEffect: true
        });
        if (rPick.length) addWordCard(rPick[0]);
    }

    var fillGuard = 0;
    while (cards.length < 3 && fillGuard < 20) {
        fillGuard++;
        var kinds = [];
        if (ws.canAddCard()) kinds.push('word');
        if (listResoRefinePicks().length > 0) kinds.push('reso_refine');
        if (listNormalRefinePicks().length > 0) kinds.push('refine');
        // 補滿三選一時：編制未滿必須能抽到招募（不依賴 recruitInPool 機率）
        if (!squadFull && recruitPool.length > 0) {
            var hasRecruitLeft = false;
            for (var ri = 0; ri < recruitPool.length; ri++) {
                if (!usedIds['recruit_' + recruitPool[ri]]) { hasRecruitLeft = true; break; }
            }
            if (hasRecruitLeft) kinds.push('recruit');
        }
        if (!usedIds['sig_upgrade'] && ws.canOfferSignatureUpgrade()) {
            kinds.push('sig');
        }
        if (!kinds.length) break;

        var placed = false;
        while (kinds.length && !placed) {
            var ki = Math.floor(Math.random() * kinds.length);
            var kind = kinds.splice(ki, 1)[0];
            if (kind === 'word') placed = addRandomWord();
            else if (kind === 'reso_refine') placed = addResoRefineCard();
            else if (kind === 'refine') placed = addNormalRefineCard();
            else if (kind === 'recruit') placed = addRecruitCard();
            else if (kind === 'sig') placed = addSigUpgradeCard();
        }
        if (!placed) break;
    }

    // 保底補滿 3 張：公平抽未湊齊時，依序補精煉／招募／覺醒／新詞
    var topUpGuard = 0;
    while (cards.length < 3 && topUpGuard < 16) {
        topUpGuard++;
        var progressed = false;
        if (addResoRefineCard()) { progressed = true; continue; }
        if (addNormalRefineCard()) { progressed = true; continue; }
        if (!squadFull && addRecruitCard()) { progressed = true; continue; }
        if (addSigUpgradeCard()) { progressed = true; continue; }
        if (addRandomWord()) { progressed = true; continue; }
        if (!progressed) break;
    }

    // 最終只留 3；強制格已在前面，天然保留
    cards = cards.slice(0, 3);
    offeredRefine = false;
    offeredResoRefine = false;
    offeredUnseen = false;
    offeredR = false;
    offeredSigUpgrade = false;
    for (var ci = 0; ci < cards.length; ci++) {
        var c = cards[ci];
        if (!c) continue;
        if (c.kind === 'refine') {
            offeredRefine = true;
            if (c.id && c.id.indexOf('upgrade_finisher_') === 0) {
                offeredResoRefine = true;
            } else if (c.id && c.id.indexOf('upgrade_') === 0) {
                var cid = c.id.slice('upgrade_'.length);
                var cdef = ws.getCardDef(cid);
                if (cdef && cdef.schoolFinisher && !ws.hasCard(cid)) offeredResoRefine = true;
            }
        }
        if (c.kind === 'sig_upgrade') offeredSigUpgrade = true;
        if (c.kind === 'word') {
            if (ws.isRareCard(c.id)) offeredR = true;
            if (!offeredBefore[c.id]) offeredUnseen = true;
            if (!self._offeredWordIds) self._offeredWordIds = {};
            self._offeredWordIds[c.id] = true;
        }
    }

    if (offeredR) this._wavesSinceR = 0;
    else this._wavesSinceR = (this._wavesSinceR || 0) + 1;

    if (offeredSigUpgrade) this._wavesSinceSigUpgrade = 0;
    else if (ws.canOfferSignatureUpgrade()) {
        this._wavesSinceSigUpgrade = (this._wavesSinceSigUpgrade || 0) + 1;
    }

    if (offeredRefine) this._wavesSinceRefineOffer = 0;
    else if (hasRefinePool) this._wavesSinceRefineOffer = (this._wavesSinceRefineOffer || 0) + 1;
    else this._wavesSinceRefineOffer = 0;

    if (offeredResoRefine) this._wavesSinceResoRefineOffer = 0;
    else if (hasResoRefinePool) this._wavesSinceResoRefineOffer = (this._wavesSinceResoRefineOffer || 0) + 1;
    else this._wavesSinceResoRefineOffer = 0;

    if (offeredUnseen) this._wavesSinceUnseenCard = 0;
    else if (hasUnseenPool) this._wavesSinceUnseenCard = (this._wavesSinceUnseenCard || 0) + 1;
    else this._wavesSinceUnseenCard = 0;

    // 空池補位：對齊 legacy「就地補給」，避免選卡 overlay 鎖死
    while (cards.length < 3) {
        (function(bonus) {
            cards.push({
                id: 'coins_' + cards.length, kind: 'coins', name: RogueDirector.t('rogue.coins.supply'),
                stat: RogueDirector.t('rogue.coins.stat', { n: bonus }), desc: RogueDirector.t('rogue.coins.desc'), color: '#f5d27a', edge: '#ffe9a8',
                apply: function() {
                    self._earnedCoins += bonus;
                    self._unbankedCoins += bonus;
                    self._updateHud();
                }
            });
        })(15);
    }

    return cards;
};

RogueDirector.prototype._makeWordCard = function(cardId, opts) {
    opts = opts || {};
    var ws = this.app.wordSystem;
    var def = ws.getCardDef(cardId);
    if (!def) return null;
    var fac = ws.getFactionMeta(def.faction) || { color: '#c9a25a', edge: '#c9a25a', badge: '?' };
    var lv = ws.hasCard(cardId) ? ws.getUpgradeLevel(cardId) : 0;
    var parts = ws.formatCardEffectParts(def, lv, this);
    var countText = '';
    if (def.faction && typeof ws.getResonanceProgress === 'function') {
        var rp = ws.getResonanceProgress(def.faction);
        var wouldCount = !ws._isFinisherCardId(cardId);
        if (wouldCount) {
            var after = rp.count + (ws.hasCard(cardId) ? 0 : 1);
            if (!rp.active && after >= 2 && rp.label) {
                countText = RogueDirector.t('rogue.reso.unlock', { n: rp.count, label: RogueDirector.loc(rp.label) || rp.label });
            } else if (rp.active && rp.label) {
                countText = rp.finisherLevel
                    ? RogueDirector.t('rogue.reso.activeRefine', { label: RogueDirector.loc(rp.label) || rp.label, lv: rp.finisherLevel })
                    : RogueDirector.t('rogue.reso.active', { label: RogueDirector.loc(rp.label) || rp.label });
            } else if (rp.count > 0) {
                countText = RogueDirector.t('rogue.reso.progress', { n: rp.count });
            }
        } else if (rp.active && rp.label) {
            countText = RogueDirector.t('rogue.reso.refineFree', { label: RogueDirector.loc(rp.label) || rp.label });
        }
    }

    return {
        id: cardId,
        kind: 'word',
        name: (window.WordConfig && WordConfig.getName) ? WordConfig.getName(def) : def.id,
        rarity: def.rarity || 'N',
        effectBadge: ws.getEffectTypeLabel(def),
        school: ws.getSchoolLabel(def),
        factionSeal: (function () {
            var raw = fac.label;
            var zh = (raw && typeof raw === 'object') ? raw.zh : raw;
            return (zh && String(zh).length === 1) ? String(zh) : '';
        })(),
        stat: parts.headline,
        desc: parts.detail,
        countText: countText,
        cardType: def.type || '',
        cost: def.cost,
        readableTag: def.readableTag || '',
        color: fac.color || '#c9a25a',
        edge: fac.edge || fac.color || '#c9a25a',
        apply: opts.apply || function() {}
    };
};

// 舊版卡池（無詞系統時 fallback）
RogueDirector.prototype._buildLegacyCardOptions = function() {
    var self = this;
    var cards = [];
    var aliveAllies = this.squad.filter(function(m) { return !m.dead; });
    var deadAllies = this.squad.filter(function(m) { return m.dead; });

    // 1) 招募:未滿編就可能出現
    var pool = this._getRecruitPool();
    var wantRecruit = (aliveAllies.length + deadAllies.length) < this.squadCap && pool.length > 0;
    if (wantRecruit) {
        var guaranteed = (this.squad.length === 0);
        var recruitCount = guaranteed ? Math.min(3 - cards.length, pool.length)
                                      : ((Math.random() < 0.55) ? 1 : 0);
        for (var r = 0; r < recruitCount && pool.length > 0; r++) {
            var pick = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
            cards.push(this._makeRecruitCard(pick));
        }
    }

    // 2) 全軍強化(武將 + 主角同吃同倍率)
    var squadUpgrades = this._squadUpgradeDefs();
    
    var availUpgrades = [];
    for (var ui = 0; ui < squadUpgrades.length; ui++) {
        if (!this._isCardMaxed(squadUpgrades[ui].id)) availUpgrades.push(squadUpgrades[ui]);
    }
    while (cards.length < 3 && availUpgrades.length > 0) {
        var u = availUpgrades.splice(Math.floor(Math.random() * availUpgrades.length), 1)[0];
        (function(uu) {
            var used = self._cardCounts[uu.id] || 0;
            var lim = self._cardLimitOf(uu.id);
            cards.push({
                id: uu.id, kind: 'legacy', name: uu.name,
                stat: uu.desc, desc: '', countText: RogueDirector.t('rogue.legacy.picked', { used: used, lim: lim }), color: '#c9a25a',
                edge: '#e8c878',
                apply: function() { self._buffWholeArmy(uu.buff); self._countCard(uu.id); }
            });
        })(u);
    }

    // 3) 補位:行軍籌糧(直接拿軍餉)
    while (cards.length < 3) {
        (function(bonus) {
            cards.push({
                id: 'coins_' + cards.length, kind: 'coins', name: RogueDirector.t('rogue.coins.supply'),
                stat: RogueDirector.t('rogue.coins.stat', { n: bonus }), desc: RogueDirector.t('rogue.coins.desc'), color: '#f5d27a', edge: '#ffe9a8',
                apply: function() {
                    self._earnedCoins += bonus;
                    self._unbankedCoins += bonus;
                    self._updateHud();
                }
            });
        })(15);
        if (cards.length >= 3) break;
    }

    return cards.slice(0, 3);
};

RogueDirector.prototype._getRecruitPool = function() {
    var playerType = this.app.playerController ? this.app.playerController.brawlerType : '';
    var recruited = {};
    for (var i = 0; i < this.squad.length; i++) recruited[this.squad[i].bType] = true;

    var pool = [];
    for (var key in this.factionOf) {
        if (key === playerType) continue;
        // 🌟 玩家專用角色：不進招募池
        if (key === 'zhangbao') continue;
        if (recruited[key]) continue;
        pool.push(key);
    }
    return pool;
};

RogueDirector.prototype._allyRoleLabel = function(role) {
    if (role === 'vanguard') return RogueDirector.t('rogue.role.vanguard');
    if (role === 'guardian') return RogueDirector.t('rogue.role.guardian');
    if (role === 'tactician') return RogueDirector.t('rogue.role.tactician');
    return '';
};

RogueDirector.prototype._zhName = function(bType) {
    if (window.BrawlerConfig && window.BrawlerConfig.getDisplayName) {
        return window.BrawlerConfig.getDisplayName(bType);
    }
    if (window.BrawlerConfig && window.BrawlerConfig.getDisplayZh) {
        return window.BrawlerConfig.getDisplayZh(bType);
    }
    var cfg = window.BrawlerConfig ? window.BrawlerConfig[bType] : null;
    if (cfg && cfg.displayZh) return cfg.displayZh;
    if (cfg && cfg.select && cfg.select.zh) return cfg.select.zh;
    var raw = (cfg && cfg.name) ? cfg.name : bType;
    return String(raw).replace(/([a-z])([A-Z])/g, '$1 $2').trim();
};

RogueDirector.prototype._makeRecruitCard = function(bType) {
    var self = this;
    var cfg = window.BrawlerConfig ? window.BrawlerConfig[bType] : null;
    var name = this._zhName(bType);
    var faction = this.factionOf[bType];
    var fLabel = this.factionLabel[faction] || '';
    var syn = this.synergies[faction];
    var roleHint = cfg && cfg.allyRole ? this._allyRoleLabel(cfg.allyRole) : '';
    var statLine = '';
    var detailLine = '';

    if (syn) {
        var playerType = this.app.playerController ? this.app.playerController.brawlerType : '';
        var playerFaction = this.factionOf[playerType];
        var cnt = (playerFaction === faction) ? 1 : 0;
        for (var i = 0; i < this.squad.length; i++) {
            if (this.squad[i].faction === faction) cnt++;
        }
        var shortSyn = RogueDirector.loc(syn.shortName || syn.name);
        statLine = RogueDirector.t('rogue.bond.line', { n: cnt, need: syn.need, name: shortSyn });
        detailLine = RogueDirector.t('rogue.bond.active', { desc: RogueDirector.loc(syn.desc) });
        if (cnt + 1 >= syn.need) {
            detailLine = RogueDirector.t('rogue.bond.ready', { desc: RogueDirector.loc(syn.desc) });
        }
    } else {
        statLine = RogueDirector.t('rogue.kind.joinArmy');
        detailLine = RogueDirector.t('rogue.kind.joinArmySub');
    }

    return {
        id: 'recruit_' + bType,
        kind: 'recruit',
        name: name,
        factionSeal: fLabel,
        roleHint: roleHint,
        stat: statLine,
        desc: detailLine,
        color: this.factionColor[faction] || '#c9a25a',
        edge: this.factionColor[faction] || '#c9a25a',
        apply: function() { self._recruit(bType); }
    };
};

// ── 卡片效果執行 ────────────────────────────────────────────────
RogueDirector.prototype._recruit = function(bType) {
    var bCtrl = this._getBotCtrl();
    if (!bCtrl) return;

    var pos = this._getAllySpawnPos();
    var bot = bCtrl.spawnBotAt(bType, pos.x, pos.z, { isAlly: true });
    if (!bot) return;

    var faction = this.factionOf[bType];
    var member = { botId: bot.id, bType: bType, name: this._zhName(bType), faction: faction, dead: false };
    this.squad.push(member);

    this._checkSynergy(faction);
    if (this._useWordSystem()) {
        this.app.wordSystem.onSquadChanged(this);
    } else {
        this._reapplyPersistentArmyBuffs();
    }
    this._updateHud();
};

RogueDirector.prototype._checkSynergy = function(faction) {
    var syn = this.synergies[faction];
    if (!syn || this._activatedSynergies[faction]) return;

    var playerType = this.app.playerController ? this.app.playerController.brawlerType : '';
    var playerFaction = this.factionOf[playerType];
    var playerCounts = (playerFaction === faction);

    var cnt = playerCounts ? 1 : 0;
    for (var i = 0; i < this.squad.length; i++) {
        if (this.squad[i].faction === faction) cnt++;
    }
    if (cnt < syn.need) return;

    this._activatedSynergies[faction] = true;

    var self = this;
    var col = this.factionColor[faction] || '#f5d27a';
    setTimeout(function() {
        self._showRogueBanner(RogueDirector.loc(syn.shortName || syn.name), RogueDirector.loc(syn.desc), 'bond', 2800, col);
    }, 400);
};

RogueDirector.prototype._squadUpgradeDefs = function() {
    return [
        { id: 'up_dmg', name: '礪刃', desc: '全軍傷害 +15%', buff: { dmgMul: 1.15 } },
        { id: 'up_hp', name: '鐵壁', desc: '全軍血量 +20%', buff: { hpMul: 1.20 } },
        { id: 'up_spd', name: '疾襲', desc: '全軍移速 +10%', buff: { speedMul: 1.10 } },
        { id: 'up_reload', name: '連射', desc: '全軍裝填 +25%', buff: { reloadMul: 1.25 } }
    ];
};

RogueDirector.prototype._mergeArmyBuffMults = function(target, source) {
    if (!source) return target || {};
    target = target || {};
    var keys = ['dmgMul', 'hpMul', 'speedMul', 'reloadMul', 'damageTakenMul', 'dotMul', 'ccDurationMul'];
    for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (source[k] && source[k] !== 1) target[k] = (target[k] || 1) * source[k];
    }
    return target;
};

RogueDirector.prototype._computePersistentArmyBuffs = function() {
    var combined = {};
    for (var fKey in this._activatedSynergies) {
        if (!this._activatedSynergies[fKey]) continue;
        var syn = this.synergies[fKey];
        if (syn && syn.buff) combined = this._mergeArmyBuffMults(combined, syn.buff);
    }
    var upgrades = this._squadUpgradeDefs();
    for (var u = 0; u < upgrades.length; u++) {
        var count = this._cardCounts[upgrades[u].id] || 0;
        for (var c = 0; c < count; c++) {
            combined = this._mergeArmyBuffMults(combined, upgrades[u].buff);
        }
    }
    for (var k in combined) return combined;
    return null;
};

RogueDirector.prototype._applyArmyMultBuffs = function(buff) {
    if (!buff) return;
    var bCtrl = this._getBotCtrl();
    if (bCtrl) {
        for (var i = 0; i < this.squad.length; i++) {
            bCtrl.buffBot(this.squad[i].botId, buff);
        }
    }
    this.app.fire('rogue:buffPlayer', buff);
};

RogueDirector.prototype._reapplyPersistentArmyBuffs = function() {
    this._applyArmyMultBuffs(this._computePersistentArmyBuffs());
};

RogueDirector.prototype._buffWholeArmy = function(buff) {
    this._applyArmyMultBuffs(buff);
    var newB = this.app.wordSystem ? this.app.wordSystem.computeBuffs(this) : null;
    if (newB) this.app.fire('rogue:extraBuffs', newB);
};

RogueDirector.prototype._applyAbsoluteWordBuffs = function(stats) {
    stats = stats || {};
    var pc = this.app.playerController;
    if (pc && pc.applyAbsoluteWordBuffs) pc.applyAbsoluteWordBuffs(stats);

    var bCtrl = this._getBotCtrl();
    if (bCtrl && bCtrl.applyAbsoluteWordBuffsToBot) {
        for (var i = 0; i < this.squad.length; i++) {
            if (this.squad[i].dead) continue;
            bCtrl.applyAbsoluteWordBuffsToBot(this.squad[i].botId, stats);
        }
    }

    var CR = (typeof window !== 'undefined' && window.CombatResolver) ? window.CombatResolver : null;
    if (CR && CR.applyArmyCombatStats) CR.applyArmyCombatStats(this.app, stats);
    this._reapplyPersistentArmyBuffs();
};

RogueDirector.prototype._buffAllAllies = function(buff) {
    var bCtrl = this._getBotCtrl();
    if (!bCtrl) return;
    for (var i = 0; i < this.squad.length; i++) {
        bCtrl.buffBot(this.squad[i].botId, buff);
    }
};

// ── 強化卡抽取上限 ──────────────────────────────────────────────
RogueDirector.prototype._cardLimitOf = function(cardId) {
    switch (cardId) {
        case 'up_dmg': return this.cardMaxDmg;
        case 'up_hp': return this.cardMaxHp;
        case 'up_spd': return this.cardMaxSpd;
        case 'up_reload': return this.cardMaxReload;
        default: return 999;
    }
};
RogueDirector.prototype._isCardMaxed = function(cardId) {
    var used = this._cardCounts[cardId] || 0;
    return used >= this._cardLimitOf(cardId);
};
RogueDirector.prototype._countCard = function(cardId) {
    this._cardCounts[cardId] = (this._cardCounts[cardId] || 0) + 1;
};

// ── 金幣復活 ────────────────────────────────────────────────────
RogueDirector.prototype._getReviveCost = function() {
    var wave = this.wave || 1;
    var n = this._reviveCount || 0;
    return Math.min(100, 25 + wave * 2 + n * 15);
};

RogueDirector.prototype._tryReviveWithCoins = function(botId) {
    var cost = this._getReviveCost();
    if (this._earnedCoins < cost) {
        this._toast(RogueDirector.t('rogue.revive.need', { n: cost }), false);
        return;
    }

    var member = null;
    for (var i = 0; i < this.squad.length; i++) {
        if (this.squad[i].botId === botId) { member = this.squad[i]; break; }
    }

    if (member && member.dead) {
        this._earnedCoins -= cost;
        this._unbankedCoins -= cost;
        if (this._unbankedCoins < 0) this._unbankedCoins = 0;
        this._reviveCount = (this._reviveCount || 0) + 1;

        this._rescue(member);
    }
};

RogueDirector.prototype._rescue = function(member) {
    var bCtrl = this._getBotCtrl();
    if (!bCtrl) return;
    var pCtrl = this.app.playerController;
    var pp = (pCtrl && pCtrl.player) ? pCtrl.player.getPosition() : null;
    var baseX = pp ? pp.x : 0;
    var baseZ = pp ? pp.z : 0;
    var pos = this._findNearbySafePos(baseX, baseZ, 2.4);
    if (bCtrl.reviveBot(member.botId, pos.x, pos.z)) {
        member.dead = false;
        if (this._useWordSystem()) this.app.wordSystem.onSquadChanged(this);
        this._showRogueBanner(RogueDirector.t('rogue.banner.rejoin', { name: member.name }), RogueDirector.t('rogue.banner.rejoinSub'), 'revive', 2200);
        try { this.app.fire('sfx:revive'); } catch (eSfx) { /* ignore */ }
        this._updateHud();
    }
};

RogueDirector.prototype._getAllySpawnPos = function() {
    var gmm = this.app.gameModeManager;
    var pCtrl = this.app.playerController;
    var px = 0, pz = 0;
    if (pCtrl && pCtrl.player) {
        var pp = pCtrl.player.getPosition();
        px = pp.x; pz = pp.z;
    } else if (gmm) {
        px = gmm.mapCenterX || 0; pz = (gmm.mapCenterZ || 0) + 25;
    }
    var ang = Math.random() * Math.PI * 2;
    var x = px + Math.cos(ang) * 2.4;
    var z = pz + Math.sin(ang) * 2.4;
    if (gmm && gmm._nudgeOutOfObstacles) {
        var p = gmm._nudgeOutOfObstacles(x, z);
        return p;
    }
    return { x: x, z: z };
};

// ── 死亡監聽 ────────────────────────────────────────────────────
RogueDirector.prototype._onDeath = function(deadEntityId) {
    if (!this.active || this.waveStatus === 'over') return;

    if (deadEntityId === 'player') {
        this._onRunOver();
        return;
    }

    // 🎯 指定目標擊殺：立刻通關（不需清場）
    if (this._winMode === 'kill_target' && this._targetEnemyId && deadEntityId === this._targetEnemyId) {
        var bcT = this._getBotCtrl();
        if (bcT) bcT.cleanupByTeam('red', true);
        this._onWaveCleared();
        return;
    }

    // 1. 友方陣亡檢查：提示可以花費金幣復活
    for (var i = 0; i < this.squad.length; i++) {
        if (this.squad[i].botId === deadEntityId && !this.squad[i].dead) {
            this.squad[i].dead = true;
            this._showRogueBanner(RogueDirector.t('rogue.banner.fallen', { name: this.squad[i].name }), RogueDirector.t('rogue.banner.reviveHint', { n: (this._getReviveCost ? this._getReviveCost() : 20) }), 'death', 3000);
            this._updateHud();
            return;
        }
    }

    // 2. 敵方擊殺即時給予軍餉 (動態計算 Cost)
    var bCtrl = this._getBotCtrl();
    if (bCtrl) {
        var deadBot = null;
        for (var j = 0; j < bCtrl.bots.length; j++) {
            if (bCtrl.bots[j].id === deadEntityId) { deadBot = bCtrl.bots[j]; break; }
        }
        
        if (deadBot && deadBot.team === 'red') {
            this._rogueKills = (this._rogueKills || 0) + 1;
            var reward = 1; 
            
            if (deadBot.isBoss || deadBot.config.scale > 1 || this._isGeneral(deadBot.brawlerType)) {
                reward = 30; 
            } else {
                for (var m = 0; m < this.budgetMinions.length; m++) {
                    if (this.budgetMinions[m].type === deadBot.brawlerType) {
                        reward = this.budgetMinions[m].cost;
                        break;
                    }
                }
            }
            
            this._earnedCoins += reward;
            this._unbankedCoins += reward;
            this._updateHud();
        }
    }
};

// ── 通關 / 乘勝追擊 / 結算 ──────────────────────────────────────
RogueDirector.prototype._notePerfectDodge = function() {
    this._roguePerfectCount = (this._roguePerfectCount || 0) + 1;
};

RogueDirector.prototype._noteKillPop = function() {
    this._rogueKillPopCount = (this._rogueKillPopCount || 0) + 1;
};

RogueDirector.prototype._getSettlementStats = function() {
    var combo = 0;
    var sm = this.app.scoreManager;
    if (sm && sm._scores && sm._scores.player) {
        combo = sm._scores.player.maxStreak || 0;
    }
    return {
        waves: this._getCompletedWaves(),
        kills: this._rogueKills || 0,
        combo: combo,
        perfect: this._roguePerfectCount || 0,
        killPop: this._rogueKillPopCount || 0
    };
};

RogueDirector.prototype._getSettlementHeroGlyph = function() {
    var bType = (this.app.playerController && this.app.playerController.brawlerType) || '';
    var cfg = (window.BrawlerConfig && bType) ? window.BrawlerConfig[bType] : null;
    if (!cfg || !cfg.select) {
        return { glyph: '?', name: '' };
    }
    var glyph = cfg.select.title || (cfg.select.zh ? cfg.select.zh.charAt(0) : '?');
    var name = (window.BrawlerConfig && BrawlerConfig.getDisplayName)
        ? BrawlerConfig.getDisplayName(bType) : (cfg.select.zh || '');
    return { glyph: glyph, name: name, charCount: Math.max(1, String(glyph || '').length) };
};

RogueDirector.prototype._renderBuildTotalsHtml = function(totals) {
    if (!totals) return '';
    var lines = Array.isArray(totals) ? totals : (totals.lines || []);
    var notes = (!Array.isArray(totals) && totals.notes) ? totals.notes : [];
    var label = (!Array.isArray(totals) && totals.label) ? totals.label : '';
    if (!lines.length && !notes.length && !label) return '';

    var self = this;
    var html = '<div class="rg-build-totals rg-settle-build-totals">';
    if (label) {
        html += '<div class="rg-build-totals-label">' + self._escapeHtml(label) + '</div>';
    }
    if (lines.length) {
        html += '<div class="rg-build-totals-table">';
        html += lines.map(function(line) {
            return '<div class="rg-settle-total-line">' + self._escapeHtml(line) + '</div>';
        }).join('');
        html += '</div>';
    }
    html += notes.map(function(note) {
        return '<div class="rg-build-totals-note">' + self._escapeHtml(note) + '</div>';
    }).join('');
    html += '</div>';
    return html;
};

RogueDirector.prototype._renderBuildSummaryBlockHtml = function() {
    var self = this;
    var summaryNames = [];
    if (this._useWordSystem() && this.app.wordSystem && this.app.wordSystem.formatBuildSummaryNames) {
        summaryNames = this.app.wordSystem.formatBuildSummaryNames(this);
        this._fullBuildLine = this.app.wordSystem.formatBuildHudLine(this);
    }
    if (!summaryNames.length && !this._fullBuildLine) return '';

    var compactInner = summaryNames.length
        ? summaryNames.map(function(n) { return self._escapeHtml(n); }).join(' · ')
        : this._escapeHtml(this._fullBuildLine);

    var totalsHtml = '';
    if (this._useWordSystem() && this.app.wordSystem && this.app.wordSystem.formatBuildSettlementTotals) {
        totalsHtml = this._renderBuildTotalsHtml(this.app.wordSystem.formatBuildSettlementTotals(this));
    }

    var detailHtml = '';
    if (this._useWordSystem() && this.app.wordSystem && this.app.wordSystem.formatBuildDetailParts) {
        var dParts = this.app.wordSystem.formatBuildDetailParts(this);
        if (dParts.length) {
            detailHtml = dParts.map(function(p) {
                return '<div class="rg-build-detail-line">' + self._escapeHtml(p) + '</div>';
            }).join('');
        }
    } else if (this._fullBuildLine) {
        detailHtml = this._escapeHtml(this._fullBuildLine);
    }

    return '<div class="rg-build-block rg-settle-build">' +
        '<div class="rg-settle-build-head">' +
        '<span class="rg-settle-build-label">' + RogueDirector.t('rogue.settle.build.label') + '</span>' +
        '<button type="button" class="rg-settle-share-link" id="rg-btn-share-build" title="' + RogueDirector.t('rogue.share.title') + '" aria-label="' + RogueDirector.t('rogue.share.title') + '">' + RogueDirector.t('rogue.share.title') + '</button>' +
        (detailHtml ? '<button type="button" class="rg-settle-build-toggle" id="rg-settle-build-toggle" data-rg-build-toggle="#rg-settle-build-detail" aria-expanded="false">' + RogueDirector.t('rogue.settle.build.expand') + '</button>' : '') +
        '</div>' +
        '<div class="rg-settle-build-compact">' + compactInner + '</div>' +
        totalsHtml +
        (detailHtml ? '<div class="rg-settle-build-detail rg-build-detail rg-build-detail-collapsible" id="rg-settle-build-detail">' + detailHtml + '</div>' : '') +
        '</div>';
};

RogueDirector.prototype._bindSettlementBuildExpand = function(ov) {
    if (!ov) return;
    var self = this;
    var toggles = ov.querySelectorAll('[data-rg-build-toggle]');
    for (var i = 0; i < toggles.length; i++) {
        (function(toggle) {
            var detailSel = toggle.getAttribute('data-rg-build-toggle');
            var detail = detailSel ? ov.querySelector(detailSel) : null;
            if (!detail) return;
            self._bindTap(toggle, function() {
                var open = !detail.classList.contains('show');
                if (open) detail.classList.add('show');
                else detail.classList.remove('show');
                toggle.textContent = open
                    ? RogueDirector.t('rogue.settle.build.collapse')
                    : RogueDirector.t('rogue.settle.build.expand');
                toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            });
        })(toggles[i]);
    }
};

RogueDirector.prototype._buildSettlementPanelHtml = function(opts) {
    opts = opts || {};
    var outcome = opts.outcome || 'defeat';
    var stats = this._getSettlementStats();
    var hero = this._getSettlementHeroGlyph();
    var titleAttr = outcome === 'defeat' ? ' style="color:#e85a4a;text-align:center;"' : ' style="text-align:center;"';
    var subKey = outcome === 'defeat' ? 'rogue.defeat.sub' : 'rogue.victory.sub';
    var subParams = {
        waves: stats.waves,
        kills: stats.kills,
        coins: this._earnedCoins,
        xp: (this._earnedXp || 0)
    };
    var statsHtml =
        '<div class="rg-settle-stats">' +
        '<div class="rg-settle-stat">' + RogueDirector.t('rogue.settle.stat.combo', { n: stats.combo }) + '</div>' +
        '<div class="rg-settle-stat">' + RogueDirector.t('rogue.settle.stat.perfect', { n: stats.perfect }) + '</div>' +
        '<div class="rg-settle-stat">' + RogueDirector.t('rogue.settle.stat.killPop', { n: stats.killPop }) + '</div>' +
        '</div>';
    var extra = opts.extraHtml || '';
    var buttons = opts.buttonsHtml || '';
    var hint = opts.hintHtml || '';

    return '<div class="rg-panel tk-panel rg-settle">' +
        '<div class="rg-settle-hero">' +
        '<div class="rg-settle-hero-glyph" style="--hero-chars:' + (hero.charCount || 1) + ';">' + this._escapeHtml(hero.glyph) + '</div>' +
        (hero.name ? '<div class="rg-settle-hero-name">' + this._escapeHtml(hero.name) + '</div>' : '') +
        '</div>' +
        '<div class="rg-panel-title tk-panel-title"' + titleAttr + '>' + RogueDirector.t(outcome === 'defeat' ? 'rogue.defeat.title' : 'rogue.victory.title') + '</div>' +
        '<div class="rg-panel-sub tk-panel-sub rg-settle-sub">' + RogueDirector.t(subKey, subParams) + '</div>' +
        statsHtml +
        this._renderBuildSummaryBlockHtml() +
        extra +
        '<div class="rg-panel-btns tk-panel-btns rg-settle-btns">' + buttons + '</div>' +
        hint +
        '</div>';
};

RogueDirector.prototype._openSettlementOverlay = function(opts) {
    var ov = document.createElement('div');
    ov.id = 'rogue-overlay';
    ov.className = 'tk-overlay';
    ov.setAttribute('data-ui-interactive', '');
    ov.innerHTML = this._buildSettlementPanelHtml(opts);
    document.body.appendChild(ov);
    this._bindShareButton(ov.querySelector('#rg-btn-share-build'));
    this._bindSettlementBuildExpand(ov);
    try {
        var outcome = (opts && opts.outcome) || 'defeat';
        this.app.fire(outcome === 'victory' ? 'sfx:victory' : 'sfx:defeat');
    } catch (eSfx) { /* ignore */ }
    return ov;
};

RogueDirector.prototype._resetRunState = function() {
    var bCtrl = this._getBotCtrl();
    if (bCtrl) {
        bCtrl.cleanupByTeam('red');
        bCtrl.cleanupByTeam(this.app.myTeam || 'blue');
    }

    this.wave = 0;
    this.waveStatus = 'idle';
    this.isEndless = false;
    this._currentEndlessThreat = null;
    this._earnedCoins = 0;
    this._unbankedCoins = 0;
    this._earnedXp = 0;
    this._rogueKills = 0;
    this._roguePerfectCount = 0;
    this._rogueKillPopCount = 0;
    this._xpBankedWaves = 0;
    this._xpBankedKills = 0;
    this._xpVictoryGranted = false;
    this._endlessXpGranted = 0;
    this._reviveCount = 0;
    this.squad = [];
    this._activatedSynergies = {};
    this._cardCounts = {};
    this._draftMode = 'wave';
    this._openingRerollCount = 0;
    this._wavesSinceR = 0;
    this._wavesSinceSigUpgrade = 0;
    this._wavesSinceUnseenCard = 0;
    this._wavesSinceRefineOffer = 0;
    this._wavesSinceResoRefineOffer = 0;
    this._offeredWordIds = {};
    this._resetShuffleBags();
    this._winMode = 'clear';
    this._targetEnemyId = '';
    this._clearGoal();

    this._ensureWordSystem();
    if (this.app.wordSystem && this.app.wordSystem.resetRun) {
        this.app.wordSystem.resetRun();
    }

    var sm = this.app.scoreManager;
    if (sm) {
        sm.playerKillStreak = 0;
        sm._rogueKillCount = 0;
        if (sm._scores && sm._scores.player) {
            sm._scores.player.kills = 0;
            sm._scores.player.currentStreak = 0;
            sm._scores.player.maxStreak = 0;
        }
    }

    var pc = this.app.playerController;
    if (pc && pc.resetForOfficialRogue) {
        pc.resetForOfficialRogue();
    } else if (pc && pc.isDead && pc._respawn) {
        pc._respawn();
    }
};

RogueDirector.prototype._restartRun = function() {
    var ov = document.getElementById('rogue-overlay');
    if (ov) ov.remove();
    this.app.timeScale = this._prevTimeScale || 1;
    this.app.fire('rogue:inputLock', false);
    this._resetRunState();
    this._buildHud();
    this._beginRun();
};

RogueDirector.prototype._onVictory = function() {
    this.waveStatus = 'victory_choice';
    this._clearCheckpoint();
    this._earnedCoins += this.victoryCoins;
    this._unbankedCoins += this.victoryCoins;
    this._bankCoins();
    this._bankXp();

    var pm = this.app.progressionManager;
    if (pm && typeof pm.setRogueCleared === 'function') {
        pm.setRogueCleared();
    }

    this._updateHud();

    var gmm = this.app.gameModeManager;
    if (gmm && gmm._showAnnouncer) gmm._showAnnouncer(RogueDirector.t('rogue.path.unlocked'), 'blue');

    var self = this;
    setTimeout(function() {
        if (gmm && gmm._hideAnnouncer) gmm._hideAnnouncer();
        self._showVictoryChoice();
    }, 2200);
};

RogueDirector.prototype._showVictoryChoice = function() {
    var self = this;
    this._prevTimeScale = this.app.timeScale || 1;
    this.app.timeScale = 0;
    this.app.fire('rogue:inputLock', true);

    var ov = this._openSettlementOverlay({
        outcome: 'victory',
        extraHtml: '<div class="rg-panel-sub tk-panel-sub" style="color:#f5d27a;margin-top:6px;text-align:center;">' + RogueDirector.t('rogue.victory.unlock') + '</div>',
        buttonsHtml:
            '<button class="rg-btn rg-btn-gold tk-btn tk-btn-gold rg-settle-btn-primary" id="rg-btn-endless">' + RogueDirector.t('rogue.victory.endless') + '</button>' +
            '<button class="rg-btn rg-btn-orange tk-btn tk-btn-orange" id="rg-btn-retry">' + RogueDirector.t('rogue.victory.retry') + '</button>' +
            '<button class="rg-btn rg-btn-ghost tk-btn tk-btn-ghost rg-settle-btn-ghost" id="rg-btn-home">' + RogueDirector.t('rogue.victory.home') + '</button>',
        hintHtml: '<div class="rg-panel-hint tk-panel-hint">' + RogueDirector.t('rogue.victory.hint') + '</div>'
    });

    this._bindTap(ov.querySelector('#rg-btn-home'), function() {
        ov.remove();
        self._finishRun();
    });
    this._bindTap(ov.querySelector('#rg-btn-retry'), function() {
        self._restartRun();
    });
    this._bindTap(ov.querySelector('#rg-btn-endless'), function() {
        ov.remove();
        self.app.timeScale = self._prevTimeScale || 1;
        self.app.fire('rogue:inputLock', false);
        self.isEndless = true;
        self._showRogueBanner(RogueDirector.t('rogue.banner.endless'), RogueDirector.t('rogue.banner.endlessSub'), 'mission', 2400);
        setTimeout(function() { self._startNextWave(); }, 800);
    });
};

RogueDirector.prototype._getCompletedWaves = function() {
    if (!this.wave || this.wave <= 0) return 0;
    if (this.waveStatus === 'playing') return Math.max(0, this.wave - 1);
    return this.wave;
};

RogueDirector.prototype._persistRogueBestWave = function() {
    var pm = this.app.progressionManager;
    if (!pm || typeof pm.recordRogueBestWave !== 'function') return;
    var bType = (this.app.playerController && this.app.playerController.brawlerType) || '';
    var result = pm.recordRogueBestWave(this._getCompletedWaves(), bType);
    if (result && result.isNew && this.app.rogueBuildShare) {
        var snap = this.app.rogueBuildShare.collectSnapshot(this);
        if (this.app.cloudSaveManager && this.app.cloudSaveManager.uploadRogueBuild) {
            this.app.cloudSaveManager.uploadRogueBuild(snap);
        }
    }
};

RogueDirector.prototype._renderBuildDetailBlockHtml = function() {
    var self = this;
    var summaryNames = [];
    if (this._useWordSystem() && this.app.wordSystem && this.app.wordSystem.formatBuildSummaryNames) {
        summaryNames = this.app.wordSystem.formatBuildSummaryNames(this) || [];
        this._fullBuildLine = this.app.wordSystem.formatBuildHudLine(this);
    }

    var compactInner = summaryNames.length
        ? summaryNames.map(function(n) { return self._escapeHtml(n); }).join(' · ')
        : (this._fullBuildLine ? this._escapeHtml(this._fullBuildLine) : '');

    var totalsHtml = '';
    if (this._useWordSystem() && this.app.wordSystem && this.app.wordSystem.formatBuildSettlementTotals) {
        totalsHtml = this._renderBuildTotalsHtml(this.app.wordSystem.formatBuildSettlementTotals(this));
    }

    var detailHtml = '';
    if (this._useWordSystem() && this.app.wordSystem && this.app.wordSystem.formatBuildDetailParts) {
        var dParts = this.app.wordSystem.formatBuildDetailParts(this);
        if (dParts.length) {
            detailHtml = dParts.map(function(p) {
                return '<div class="rg-build-detail-line">' + self._escapeHtml(p) + '</div>';
            }).join('');
        }
    } else if (this._fullBuildLine && !summaryNames.length) {
        // Legacy single-line build: show in compact only
        compactInner = compactInner || this._escapeHtml(this._fullBuildLine);
    }

    if (!compactInner && !totalsHtml && !detailHtml) return '';

    return '<div class="rg-build-block rg-hud-build-panel">' +
        '<div class="rg-settle-build-head">' +
        '<span class="rg-settle-build-label">' + RogueDirector.t('rogue.settle.build.label') + '</span>' +
        (detailHtml ? '<button type="button" class="rg-settle-build-toggle rg-hud-build-toggle" id="rg-hud-build-toggle" data-rg-build-toggle="#rg-hud-build-detail" aria-expanded="false">' + RogueDirector.t('rogue.settle.build.expand') + '</button>' : '') +
        '</div>' +
        (compactInner ? '<div class="rg-settle-build-compact">' + compactInner + '</div>' : '') +
        totalsHtml +
        (detailHtml ? '<div class="rg-settle-build-detail rg-build-detail rg-build-detail-collapsible" id="rg-hud-build-detail">' + detailHtml + '</div>' : '') +
        '</div>';
};

RogueDirector.prototype._bindShareButton = function(btn) {
    if (!btn) return;
    var self = this;
    this._bindTap(btn, function() {
        if (!self.app.rogueBuildShare) return;
        self.app.rogueBuildShare.shareFromDirector(self, { uploadCloud: false }).then(function(res) {
            if (res && res.ok && self.app.rogueBuildShare._toast) {
                self.app.rogueBuildShare._toast(RogueDirector.t('rogue.share.done'));
            }
        });
    });
};

RogueDirector.prototype._showBuildPanel = function() {
    if (!this.active || this.waveStatus === 'over' || this.waveStatus === 'choosing' || this.waveStatus === 'victory_choice') return;
    var self = this;
    var old = document.getElementById('rogue-overlay');
    if (old) return;

    this._prevTimeScale = this.app.timeScale || 1;
    this.app.timeScale = 0;
    this.app.fire('rogue:inputLock', true);

    var buildDetailHtml = this._renderBuildDetailBlockHtml();
    var ov = document.createElement('div');
    ov.id = 'rogue-overlay';
    ov.className = 'tk-overlay';
    ov.setAttribute('data-ui-interactive', '');
    ov.innerHTML =
        '<div class="rg-panel tk-panel">' +
        '<div class="rg-panel-title tk-panel-title">' + RogueDirector.t('rogue.build.title') + '</div>' +
        buildDetailHtml +
        '<div class="rg-panel-btns tk-panel-btns">' +
        '<button class="rg-btn rg-btn-orange tk-btn tk-btn-orange" id="rg-btn-quit-from-build">' + RogueDirector.t('rogue.build.quit') + '</button>' +
        '<button class="rg-btn rg-btn-ghost tk-btn tk-btn-ghost" id="rg-btn-close-build">' + RogueDirector.t('rogue.quit.cancel') + '</button>' +
        '</div></div>';
    document.body.appendChild(ov);

    this._bindSettlementBuildExpand(ov);
    this._bindTap(ov.querySelector('#rg-btn-close-build'), function() {
        ov.remove();
        self.app.timeScale = self._prevTimeScale || 1;
        self.app.fire('rogue:inputLock', false);
    });
    this._bindTap(ov.querySelector('#rg-btn-quit-from-build'), function() {
        ov.remove();
        self.app.timeScale = self._prevTimeScale || 1;
        self.app.fire('rogue:inputLock', false);
        self._showQuitConfirm();
    });
};

RogueDirector.prototype._onRunOver = function() {
    this.waveStatus = 'over';
    this._clearCheckpoint();
    this._bankCoins();
    this._bankXp();
    this._persistRogueBestWave();
    this.app.timeScale = 0.3;

    var self = this;
    setTimeout(function() {
        self.app.timeScale = 1.0;
        self._prevTimeScale = 1;
        self.app.fire('rogue:inputLock', true);

        var ov = self._openSettlementOverlay({
            outcome: 'defeat',
            buttonsHtml:
                '<button class="rg-btn rg-btn-gold tk-btn tk-btn-gold rg-settle-btn-primary" id="rg-btn-retry">' + RogueDirector.t('rogue.defeat.retry') + '</button>' +
                '<button class="rg-btn rg-btn-ghost tk-btn tk-btn-ghost rg-settle-btn-ghost" id="rg-btn-home">' + RogueDirector.t('rogue.defeat.home') + '</button>'
        });

        self._bindTap(ov.querySelector('#rg-btn-retry'), function() {
            self._restartRun();
        });
        self._bindTap(ov.querySelector('#rg-btn-home'), function() {
            self._finishRun();
        });
    }, 1200);
};

RogueDirector.prototype._finishRun = function() {
    this._clearCheckpoint();
    this._persistRogueBestWave();
    this._bankCoins();
    this._bankXp();
    location.reload();
};

RogueDirector.prototype._bankCoins = function() {
    if (this._unbankedCoins <= 0) return;
    var pm = this.app.progressionManager;
    if (pm) {
        if (typeof pm.addCoins === 'function') pm.addCoins(this._unbankedCoins);
        else if (typeof pm.grantCoins === 'function') pm.grantCoins(this._unbankedCoins);
    }
    this._unbankedCoins = 0;
};

/** 結算帳號經驗（增量發放，通關→無盡不會重複算） */
RogueDirector.prototype._bankXp = function() {
    if (this.isTutorialRun) return;

    var pm = this.app.progressionManager;
    if (!pm || typeof pm.addXP !== 'function') return;

    var maxW = this.maxWaves || 15;
    var waves = this._getCompletedWaves();
    var kills = this._rogueKills || 0;
    var bankedW = this._xpBankedWaves || 0;
    var bankedK = this._xpBankedKills || 0;
    var delta = 0;

    // 正規波：每波 XP_PER_WAVE（僅未結算的部分）
    var prevNormal = Math.min(bankedW, maxW);
    var curNormal = Math.min(waves, maxW);
    if (curNormal > prevNormal) {
        delta += (curNormal - prevNormal) * RogueDirector.XP_PER_WAVE;
    }

    // 通關獎：完成 maxWaves 後發一次
    if (!this._xpVictoryGranted && waves >= maxW) {
        delta += RogueDirector.XP_VICTORY;
        this._xpVictoryGranted = true;
    }

    // 無盡波：較慢成長 + 每局上限
    var prevEndless = Math.max(0, bankedW - maxW);
    var curEndless = Math.max(0, waves - maxW);
    if (curEndless > prevEndless) {
        var endlessDelta = (curEndless - prevEndless) * RogueDirector.XP_PER_ENDLESS_WAVE;
        var room = Math.max(0, RogueDirector.XP_ENDLESS_CAP - (this._endlessXpGranted || 0));
        endlessDelta = Math.min(endlessDelta, room);
        delta += endlessDelta;
        this._endlessXpGranted = (this._endlessXpGranted || 0) + endlessDelta;
    }

    // 擊殺輕量經驗
    if (kills > bankedK) {
        delta += (kills - bankedK) * RogueDirector.XP_PER_KILL;
    }

    this._xpBankedWaves = waves;
    this._xpBankedKills = kills;

    if (delta <= 0) return;
    pm.addXP(delta);
    this._earnedXp = (this._earnedXp || 0) + delta;
};

/** 本局預計總經驗（顯示用；與 _bankXp 公式一致） */
RogueDirector.prototype._calcRunXpTotal = function() {
    if (this.isTutorialRun) return this._earnedXp || 0;
    var maxW = this.maxWaves || 15;
    var waves = this._getCompletedWaves();
    var kills = this._rogueKills || 0;
    var normal = Math.min(waves, maxW) * RogueDirector.XP_PER_WAVE;
    var victory = waves >= maxW ? RogueDirector.XP_VICTORY : 0;
    var endless = Math.min(
        Math.max(0, waves - maxW) * RogueDirector.XP_PER_ENDLESS_WAVE,
        RogueDirector.XP_ENDLESS_CAP
    );
    return normal + victory + endless + kills * RogueDirector.XP_PER_KILL;
};

// ── 三選一 UI ───────────────────────────────────────────────────
RogueDirector.prototype._getOpeningCardTitle = function() {
    var ws = this.app.wordSystem;
    if (ws && ws.isSignatureDraftPending && ws.isSignatureDraftPending()) {
        return RogueDirector.t('rogue.draft.openingSig');
    }
    var step = ws.getOpeningStep() + 1;
    var need = (window.WordConfig && window.WordConfig.openingPicks) ? window.WordConfig.openingPicks : 2;
    return RogueDirector.t('rogue.draft.openingStep', { step: step, need: need });
};

RogueDirector.prototype._factionGlow = function(hex) {
    if (!hex || hex.charAt(0) !== '#') return 'rgba(245,210,122,0.55)';
    var h = hex.length === 4
        ? ('#' + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2) + hex.charAt(3) + hex.charAt(3))
        : hex;
    var r = parseInt(h.substr(1, 2), 16);
    var g = parseInt(h.substr(3, 2), 16);
    var b = parseInt(h.substr(5, 2), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return 'rgba(245,210,122,0.55)';
    return 'rgba(' + r + ',' + g + ',' + b + ',0.62)';
};

RogueDirector.prototype._escapeHtml = function(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
};

RogueDirector.prototype._lineLabelForCard = function(card) {
    if (!card || !card.effectBadge) return '';
    return RogueDirector.t('rogue.line.' + card.effectBadge) || card.effectBadge;
};

RogueDirector.prototype._rarityTierLabel = function(rarity) {
    var key = rarity ? String(rarity).toUpperCase() : 'N';
    var label = RogueDirector.t('rogue.rarity.' + key);
    if (label && label.indexOf('rogue.rarity.') !== 0) return label;
    return key;
};

RogueDirector.prototype._raritySilkClass = function(rarity) {
    var map = { N: 'rg-silk-n', R: 'rg-silk-r', SR: 'rg-silk-sr', SSR: 'rg-silk-ssr' };
    return map[rarity ? String(rarity).toUpperCase() : 'N'] || 'rg-silk-n';
};

RogueDirector.prototype._scrollDisplayName = function(c) {
    if (!c) return '';
    if (c.baseName) return c.baseName;
    if (c.kind === 'refine' && c.name) {
        var prefix = RogueDirector.t('rogue.refine.prefix');
        if (prefix && c.name.indexOf(prefix) === 0) return c.name.slice(prefix.length);
    }
    if (c.kind === 'sig_upgrade') {
        var ws = this.app.wordSystem;
        var def = ws ? ws.getCardDef(ws.getSignatureCardId()) : null;
        if (def) return (window.WordConfig && WordConfig.getName) ? WordConfig.getName(def) : def.id;
    }
    return c.name || '';
};

/** 強制取中文卡名（卷軸大字書法用） */
RogueDirector.prototype._scrollNameZh = function(c) {
    if (!c) return '';
    var def = this._scrollCardDef(c);
    if (def && def.name != null) {
        if (typeof def.name === 'string') return def.name;
        return String(def.name.zh || def.name['zh-TW'] || '');
    }
    if (c.kind === 'recruit') {
        var bType = (c.id && c.id.indexOf('recruit_') === 0) ? c.id.slice(8) : '';
        var cfg = (window.BrawlerConfig && bType) ? window.BrawlerConfig[bType] : null;
        if (cfg) {
            if (cfg.displayZh) return cfg.displayZh;
            if (cfg.select && cfg.select.zh) return cfg.select.zh;
        }
    }
    return this._scrollDisplayName(c);
};

/** 英文副標（橫式小字）；無 en 或與中文相同則空 */
RogueDirector.prototype._scrollNameEn = function(c) {
    if (!c) return '';
    var def = this._scrollCardDef(c);
    if (def && def.name && typeof def.name === 'object' && def.name.en) {
        return String(def.name.en);
    }
    if (c.kind === 'recruit') {
        var bType = (c.id && c.id.indexOf('recruit_') === 0) ? c.id.slice(8) : '';
        var cfg = (window.BrawlerConfig && bType) ? window.BrawlerConfig[bType] : null;
        if (cfg) {
            if (cfg.displayEn) return cfg.displayEn;
            if (cfg.select && cfg.select.en) return cfg.select.en;
        }
    }
    if (c.baseName && RogueDirector.isEn()) return String(c.baseName);
    var localized = this._scrollDisplayName(c);
    var zh = this._scrollNameZh(c);
    if (localized && localized !== zh) return localized;
    return '';
};

/** 卷軸大字：英文介面仍用中文直書；其餘語系用當前顯示名 */
RogueDirector.prototype._scrollArtName = function(c) {
    if (RogueDirector.isEn()) {
        var zh = this._scrollNameZh(c);
        if (zh) return zh;
    }
    return this._scrollDisplayName(c);
};

RogueDirector.prototype._scrollNameSize = function(name) {
    var n = name ? String(name).length : 2;
    if (n >= 5) return '34px';
    if (n >= 4) return '38px';
    return '42px';
};

RogueDirector.prototype._scrollCardDef = function(c) {
    if (!c || !this.app.wordSystem) return null;
    var ws = this.app.wordSystem;
    if (c.kind === 'word' && c.id) return ws.getCardDef(c.id);
    if (c.kind === 'refine' && c.id && c.id.indexOf('upgrade_finisher_') === 0) {
        var fac = c.id.slice('upgrade_finisher_'.length);
        var meta = ws._finisherMeta && ws._finisherMeta(fac);
        var ents = (meta && meta.entityCardIds) || [];
        return ents.length ? ws.getCardDef(ents[0]) : null;
    }
    if (c.kind === 'refine' && c.id && c.id.indexOf('upgrade_') === 0) return ws.getCardDef(c.id.slice(8));
    if (c.kind === 'sig_upgrade') return ws.getCardDef(ws.getSignatureCardId());
    return null;
};

RogueDirector.prototype._buildScrollMeta = function(c) {
    if (!c) return '';
    if (c.kind === 'recruit') {
        var fac = c.factionSeal || '';
        var role = c.roleHint || '';
        return (fac && role) ? (fac + ' · ' + role) : (fac || role || RogueDirector.t('rogue.kind.recruit'));
    }
    if (c.kind === 'legacy' || c.kind === 'coins') return RogueDirector.t('rogue.kind.armyBuff');

    var def = this._scrollCardDef(c);
    var school = c.school || '';
    // zh: 武/守/疾/術 印；en: 流派英文已在 line／kind 文案，不再疊中文印
    var schoolShort = RogueDirector.isEn() ? '' : (school.split('·')[0] || school);
    if (def && def.cardType === 'effect') {
        if (def.signature) {
            var hero = (window.BrawlerConfig && BrawlerConfig.getDisplayName)
                ? BrawlerConfig.getDisplayName(def.signature)
                : (this._zhName ? this._zhName(def.signature) : def.signature);
            var heroSig = RogueDirector.t('rogue.kind.heroSig', { hero: hero || def.signature });
            return schoolShort ? (schoolShort + ' · ' + heroSig) : heroSig;
        }
        var genSig = RogueDirector.t('rogue.kind.genericSig');
        return schoolShort ? (schoolShort + ' · ' + genSig) : genSig;
    }

    var line = this._lineLabelForCard(c);
    if (schoolShort && line) return schoolShort + ' · ' + line;
    return schoolShort || line || '';
};

RogueDirector.prototype._scrollRkLabel = function(c) {
    if (!c) return '';
    if (c.kind === 'recruit') return RogueDirector.t('rogue.kind.recruit');
    if (c.kind === 'refine') {
        var ws = this.app.wordSystem;
        var lv = 0;
        if (c.id && c.id.indexOf('upgrade_finisher_') === 0 && ws && ws.getFinisherLevel) {
            lv = ws.getFinisherLevel(c.id.slice('upgrade_finisher_'.length)) || 0;
        } else if (c.id && c.id.indexOf('upgrade_') === 0 && ws) {
            lv = ws.getUpgradeLevel(c.id.slice(8));
        }
        return RogueDirector.t('rogue.refine.lv', { n: lv + 1 });
    }
    if (c.kind === 'sig_upgrade') {
        var ws2 = this.app.wordSystem;
        var tier = ws2 ? ws2.getSignatureTier() : 0;
        return RogueDirector.t('rogue.kind.awakenLv', { n: tier + 2 });
    }
    if (c.kind === 'legacy' || c.kind === 'coins') return this._rarityTierLabel('N');
    return this._rarityTierLabel(c.rarity);
};

RogueDirector.prototype._scrollCardLabel = function(c) {
    if (!c) return '';
    if (c.kind === 'recruit') return RogueDirector.t('rogue.kind.recruitCard');
    if (c.kind === 'refine') return RogueDirector.t('rogue.kind.refineCard');
    if (c.kind === 'sig_upgrade') return RogueDirector.t('rogue.kind.upgradeCard');
    if (c.kind === 'legacy') return RogueDirector.t('rogue.kind.legacyCard');
    if (c.kind === 'coins') return RogueDirector.t('rogue.kind.supplyCard');
    var def = this._scrollCardDef(c);
    var r = c.rarity ? String(c.rarity).toUpperCase() : 'N';
    if (def && def.cardType === 'effect') return r + ' ' + (def.signature ? RogueDirector.t('rogue.kind.signature') : RogueDirector.t('rogue.kind.generic'));
    return r;
};

RogueDirector.prototype._scrollMingChar = function(c) {
    if (!c) return '';
    if (c.kind === 'sig_upgrade') return '昇';
    var ws = this.app.wordSystem;
    if (c.kind === 'word' && c.id && ws) {
        if (ws.isSignatureEffectCardId && ws.isSignatureEffectCardId(c.id)) return '命';
        var def = ws.getCardDef(c.id);
        if (def && def.cardType === 'effect' && def.signature && String(def.rarity).toUpperCase() === 'SSR') return '命';
    }
    return '';
};

RogueDirector.prototype._buildPopName = function(c) {
    var name = this._scrollDisplayName(c);
    if (c.kind === 'refine') return RogueDirector.t('rogue.kind.popRefine', { name: name });
    if (c.kind === 'sig_upgrade') return RogueDirector.t('rogue.kind.popAwaken', { name: name });
    return name;
};

RogueDirector.prototype._buildPopMeta = function(c) {
    var meta = this._buildScrollMeta(c);
    var rk = this._scrollRkLabel(c);
    if (rk && c.kind !== 'recruit') return meta + ' · ' + rk;
    return meta;
};

RogueDirector.prototype._buildPopUpgradeText = function(c) {
    if (!c) return '';
    var ws = this.app.wordSystem;
    if (c.kind === 'sig_upgrade' && ws) {
        var def = ws.getCardDef(ws.getSignatureCardId());
        var tier = ws.getSignatureTier() || 0;
        if (def && def.tiers) {
            var cur = def.tiers[tier];
            var nxt = def.tiers[tier + 1];
            if (cur && nxt) {
                return RogueDirector.t('rogue.sig.awakenPath', {
                now: RogueDirector.loc(cur.desc) || cur.desc || c.stat || '',
                next: RogueDirector.loc(nxt.desc) || nxt.desc || c.stat || ''
            });
            }
        }
        return c.countText || '';
    }
    if (c.kind === 'refine') {
        return c.countText ? RogueDirector.t('rogue.refine.progress', { text: c.countText }) : '';
    }
    return '';
};

RogueDirector.prototype._hexToRgba = function(hex, alpha) {
    var h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (!h || h.length !== 6 || isNaN(n)) return 'rgba(201,162,90,' + alpha + ')';
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
};

RogueDirector.prototype._buildOneCardHtml = function(c, idx) {
    var esc = this._escapeHtml.bind(this);
    if (!c) return '';
    var kind = c.kind || 'legacy';
    var edge = c.edge || c.color || '#c9a25a';
    var artName = this._scrollArtName(c);
    var enSub = RogueDirector.isEn() ? this._scrollNameEn(c) : '';
    if (enSub && enSub === artName) enSub = '';
    var nameSize = this._scrollNameSize(artName);
    var cardRarity = c.rarity || 'N';
    if (kind === 'refine') {
        var defR = this._scrollCardDef(c);
        if (defR && defR.rarity) cardRarity = defR.rarity;
    }
    var silkCls = kind === 'recruit' ? 'rg-silk-recruit' : this._raritySilkClass(cardRarity);
    if (kind === 'sig_upgrade') silkCls = 'rg-silk-ssr';
    var rkCls = 'rg-rk';
    if (RogueDirector.isEn()) rkCls += ' rg-rk-en';
    if (kind === 'recruit') rkCls += ' rg-rk-recruit';
    else if (kind === 'refine' || kind === 'sig_upgrade') rkCls += ' rg-rk-upgrade';

    var ming = this._scrollMingChar(c);
    var isSsrSilk = silkCls === 'rg-silk-ssr';
    var popName = this._buildPopName(c);
    var popMeta = this._buildPopMeta(c);
    var popH = c.stat || '';
    var popD = c.desc || '';
    var popUp = this._buildPopUpgradeText(c);
    var headline = c.stat || c.desc || c.name || '';
    var hasDetail = !!(popH || popD || popUp);

    var styleVars = '--rg-faction-edge:' + edge +
        ';--rg-frame:' + this._hexToRgba(edge, 0.58) +
        ';--rg-stroke:' + this._hexToRgba(edge, 0.72) +
        ';--rg-rk-bg:' + this._hexToRgba(edge, 0.28) +
        ';--rg-bigname-fill:' + this._hexToRgba(edge, 0.10) +
        ';--namesize:' + nameSize;

    var html =
        '<div class="rg-card rg-scroll-card rg-card-' + kind + (isSsrSilk ? ' rg-card-ssr' : '') + '" data-idx="' + idx + '"' +
        ' data-pop-name="' + esc(popName) + '"' +
        ' data-pop-meta="' + esc(popMeta) + '"' +
        ' data-pop-h="' + esc(popH) + '"' +
        ' data-pop-d="' + esc(popD) + '"' +
        ' data-pop-up="' + esc(popUp) + '"' +
        ' style="' + styleVars + '">' +
        '<div class="rg-rod"></div>' +
        '<div class="rg-silk ' + silkCls + (enSub ? ' rg-silk-bilingual' : '') + '">';

    if (ming || isSsrSilk) {
        html += '<div class="rg-silk-fx">';
        if (ming) html += '<div class="rg-ming">' + esc(ming) + '</div>';
        if (isSsrSilk) html += '<div class="rg-sheen"></div>';
        html += '</div>';
    }

    html += '<div class="rg-nameblock">' +
        '<div class="rg-bigname">' + esc(artName) + '</div>' +
        (enSub ? '<div class="rg-enname">' + esc(enSub) + '</div>' : '') +
        '</div>' +
        '<div class="' + rkCls + '">' + esc(this._scrollRkLabel(c)) + '</div>' +
        '<div class="rg-silk-mid">' +
        '<div class="rg-meta">' + esc(this._buildScrollMeta(c)) + '</div>' +
        '<div class="rg-headline">' + esc(headline) + '</div>' +
        '</div>' +
        (hasDetail
            ? '<div class="rg-hint rg-detail-btn" role="button">' +
                (RogueDirector.isEn() ? 'Tap for details ›' : '點擊看詳情 ›') + '</div>'
            : '<div class="rg-hint rg-hint-spacer">&nbsp;</div>') +
        '</div>' +
        '<div class="rg-rod"></div>' +
        '<div class="rg-card-label">' + esc(this._scrollCardLabel(c)) + '</div>' +
        '</div>';
    return html;
};

RogueDirector.prototype._buildCardOptionHtml = function(cards) {
    var html = '<div class="rg-cards">';
    for (var i = 0; i < cards.length; i++) {
        html += this._buildOneCardHtml(cards[i], i);
    }
    html += '</div>';
    return html;
};

RogueDirector.prototype._getOpeningRerollCost = function() {
    return (this._openingRerollCount || 0) === 0 ? 0 : RogueDirector.OPENING_REROLL_COST;
};

RogueDirector.prototype._tryPayOpeningReroll = function() {
    var cost = this._getOpeningRerollCost();
    if (cost > 0 && this._earnedCoins < cost) {
        this._toast(RogueDirector.t('rogue.draft.rerollNeed', { n: cost }), false);
        return false;
    }
    if (cost > 0) {
        this._earnedCoins -= cost;
        this._unbankedCoins -= cost;
        if (this._unbankedCoins < 0) this._unbankedCoins = 0;
        this._updateHud();
    }
    this._openingRerollCount = (this._openingRerollCount || 0) + 1;
    return true;
};

RogueDirector.prototype._updateOpeningRerollBtn = function(btn) {
    if (!btn) return;
    var cost = this._getOpeningRerollCost();
    btn.textContent = cost === 0 ? RogueDirector.t('rogue.draft.reroll') : RogueDirector.t('rogue.draft.rerollCost', { n: cost });
    var poor = cost > 0 && this._earnedCoins < cost;
    btn.disabled = poor;
    btn.classList.toggle('rg-reroll-disabled', poor);
    btn.classList.toggle('tk-btn-disabled', poor);
};

RogueDirector.prototype._updateConfirmBtn = function(btn, ctx) {
    if (!btn) return;
    var ok = ctx && ctx.selectedIdx >= 0 && !ctx.picked;
    btn.disabled = !ok;
    btn.classList.toggle('tk-btn-disabled', !ok);
};

RogueDirector.prototype._populateCardOverlay = function(ov, cards, ctx) {
    var self = this;
    ctx.selectedIdx = (ctx.selectedIdx === undefined || ctx.selectedIdx === null) ? -1 : ctx.selectedIdx;
    var title = ctx.title || RogueDirector.t('rogue.draft.title');
    var buildStrip = '';
    if (this._useWordSystem() && this.app.wordSystem && this.app.wordSystem.getBuildSlotSnapshot) {
        var snap = this.app.wordSystem.getBuildSlotSnapshot(this);
        buildStrip = '<div class="rg-pick-build" aria-hidden="true">' +
            '<div class="rg-slots rg-pick-slots">' + this._renderBuildSlotsHtml(snap) + '</div>' +
            '<div class="rg-reso-row rg-pick-reso">' + this._renderResonanceBadgesHtml(snap) + '</div>' +
            '</div>';
    }
    var html = '<div class="rg-pick-wrap tk-overlay-wrap">' +
        '<div class="rg-title tk-overlay-title">' + title + '</div>' +
        buildStrip +
        '<div class="rg-pick-hint tk-overlay-hint">' + RogueDirector.t('rogue.draft.hint') + '</div>' +
        this._buildCardOptionHtml(cards);
    html += '<div class="rg-pick-actions">' +
        '<button type="button" class="rg-btn rg-btn-confirm tk-btn tk-btn-primary" id="rg-confirm-btn" disabled>' + RogueDirector.t('rogue.draft.confirm') + '</button>';
    if (ctx.showReroll) {
        html += '<button type="button" class="rg-btn rg-btn-reroll tk-btn tk-btn-ghost" id="rg-reroll-btn">' + RogueDirector.t('rogue.draft.rerollFree') + '</button>';
    }
    html += '</div></div>' +
        '<div class="rg-pop" id="rg-card-pop">' +
        '<div class="rg-pop-card">' +
        '<div class="rg-pop-name" id="rg-pop-name"></div>' +
        '<div class="rg-pop-meta" id="rg-pop-meta"></div>' +
        '<div class="rg-pop-h" id="rg-pop-h"></div>' +
        '<div class="rg-pop-d" id="rg-pop-d"></div>' +
        '<div class="rg-pop-up" id="rg-pop-up"></div>' +
        '<div class="rg-pop-close">' + RogueDirector.t('rogue.draft.popClose') + '</div>' +
        '</div></div>';
    ov.innerHTML = html;

    // iOS：長按卷軸大字易進系統選字；整層禁選
    ov.setAttribute('data-ui-interactive', '');
    if (!ov._rgNoSelectBound) {
        ov._rgNoSelectBound = true;
        ov.addEventListener('selectstart', function(e) { e.preventDefault(); });
        ov.addEventListener('gesturestart', function(e) { e.preventDefault(); });
    }

    var confirmBtn = ov.querySelector('#rg-confirm-btn');
    this._updateConfirmBtn(confirmBtn, ctx);
    this._bindTap(confirmBtn, function() {
        if (ctx.picked || ctx.selectedIdx < 0) return;
        self._commitCardPick(ov, ctx, ctx.selectedIdx);
    });

    if (ctx.showReroll) {
        var rerollBtn = ov.querySelector('#rg-reroll-btn');
        this._updateOpeningRerollBtn(rerollBtn);
        this._bindTap(rerollBtn, function() {
            if (ctx.picked) return;
            if (!self._tryPayOpeningReroll()) return;
            if (self._useWordSystem() && self.app.wordSystem && self.app.wordSystem.blacklistOfferedSignatures) {
                var offeredIds = [];
                for (var ri = 0; ri < ctx.cards.length; ri++) {
                    if (ctx.cards[ri].id) offeredIds.push(ctx.cards[ri].id);
                }
                self.app.wordSystem.blacklistOfferedSignatures(offeredIds);
            }
            ctx.selectedIdx = -1;
            ctx.cards = self._buildOpeningWordCards();
            self._populateCardOverlay(ov, ctx.cards, ctx);
            self._bindCardOverlayPicks(ov, ctx);
        });
    }
};

RogueDirector.prototype._showScrollCardPop = function(ov, el) {
    if (!ov || !el) return;
    var pop = ov.querySelector('#rg-card-pop');
    if (!pop) return;
    var nameEl = pop.querySelector('#rg-pop-name');
    var metaEl = pop.querySelector('#rg-pop-meta');
    var hEl = pop.querySelector('#rg-pop-h');
    var dEl = pop.querySelector('#rg-pop-d');
    var upEl = pop.querySelector('#rg-pop-up');
    if (nameEl) nameEl.textContent = el.getAttribute('data-pop-name') || '';
    if (metaEl) metaEl.textContent = el.getAttribute('data-pop-meta') || '';
    if (hEl) hEl.textContent = el.getAttribute('data-pop-h') || '';
    if (dEl) dEl.textContent = el.getAttribute('data-pop-d') || '';
    var up = el.getAttribute('data-pop-up') || '';
    if (upEl) {
        if (up) {
            upEl.textContent = up;
            upEl.style.display = 'block';
        } else {
            upEl.textContent = '';
            upEl.style.display = 'none';
        }
    }
    pop.classList.add('show');
};

RogueDirector.prototype._hideScrollCardPop = function(ov) {
    if (!ov) return;
    var pop = ov.querySelector('#rg-card-pop');
    if (pop) pop.classList.remove('show');
};

RogueDirector.prototype._commitCardPick = function(ov, ctx, idx) {
    var self = this;
    if (ctx.picked || idx < 0) return;
    ctx.picked = true;
    self._hideScrollCardPop(ov);

    var els = ov.querySelectorAll('.rg-card');
    for (var i = 0; i < els.length; i++) {
        if (parseInt(els[i].getAttribute('data-idx'), 10) === idx) {
            els[i].classList.add('rg-card-selected', 'rg-card-confirmed');
        } else {
            els[i].classList.add('rg-card-dismiss');
        }
    }

    var confirmBtn = ov.querySelector('#rg-confirm-btn');
    if (confirmBtn) confirmBtn.disabled = true;
    var rerollBtn = ov.querySelector('#rg-reroll-btn');
    if (rerollBtn) rerollBtn.disabled = true;

    setTimeout(function() {
        ov.remove();
        // 清掉選卡長按可能殘留的文字選取，避免落到角色名字觸發「搜尋」
        try {
            var sel = window.getSelection && window.getSelection();
            if (sel && sel.removeAllRanges) sel.removeAllRanges();
        } catch (err) {}
        self.app.timeScale = self._prevTimeScale || 1;
        self.app.fire('rogue:inputLock', false);
        if (ctx.cards[idx] && ctx.cards[idx].apply) ctx.cards[idx].apply();
        self._updateHud();
        // 🎓 教學局選卡後結束，不進下一波
        if (self.isTutorialRun) {
            self.app.fire('tutorial:cardPicked');
            return;
        }
        if (self._draftMode === 'opening' && self._useWordSystem() && !self.app.wordSystem.isOpeningDone()) {
            self.app.fire('rogue:inputLock', true); // 連抽下一張前保持鎖定
            setTimeout(function() { self._showCards(); }, 400);
            return;
        }
        if (self._draftMode === 'opening') {
            self._draftMode = 'wave';
            setTimeout(function() { self._startNextWave(); }, 500);
            return;
        }
        setTimeout(function() { self._startNextWave(); }, 500);
    }, 360);
};

RogueDirector.prototype._bindCardOverlayPicks = function(ov, ctx) {
    var self = this;
    var els = ov.querySelectorAll('.rg-card');
    var pop = ov.querySelector('#rg-card-pop');
    var popCard = pop ? pop.querySelector('.rg-pop-card') : null;
    var confirmBtn = ov.querySelector('#rg-confirm-btn');
    var detailBtns = ov.querySelectorAll('.rg-detail-btn');

    if (pop) {
        self._bindTap(pop, function() { self._hideScrollCardPop(ov); }, { stopPropagation: false });
    }
    if (popCard) {
        popCard.addEventListener('click', function(e) { e.stopPropagation(); });
        popCard.addEventListener('pointerdown', function(e) { e.stopPropagation(); });
    }

    for (var d = 0; d < detailBtns.length; d++) {
        (function(btn) {
            var card = btn.closest('.rg-card');
            self._bindTap(btn, function() {
                if (ctx.picked || !card) return;
                self._showScrollCardPop(ov, card);
            });
        })(detailBtns[d]);
    }

    for (var k = 0; k < els.length; k++) {
        (function(el) {
            self._bindTap(el, function(e) {
                if (e && e.target && e.target.closest && e.target.closest('.rg-detail-btn')) return;
                if (ctx.picked) return;
                self._hideScrollCardPop(ov);
                var idx = parseInt(el.getAttribute('data-idx'), 10);
                ctx.selectedIdx = idx;

                for (var i = 0; i < els.length; i++) {
                    els[i].classList.remove('rg-card-selected', 'rg-card-confirmed', 'rg-card-dismiss');
                }
                el.classList.add('rg-card-selected');
                self._updateConfirmBtn(confirmBtn, ctx);
            });
        })(els[k]);
    }
};

RogueDirector.prototype._showCards = function() {
    var self = this;
    var old = document.getElementById('rogue-overlay');
    if (old) old.remove();

    // 若清關／開場已提早停戰，保留當時的 _prevTimeScale，勿用 0 覆寫
    if (this.app.timeScale !== 0) {
        this._prevTimeScale = this.app.timeScale || 1;
    } else if (this._prevTimeScale === undefined || this._prevTimeScale === null) {
        this._prevTimeScale = 1;
    }
    this.app.timeScale = 0;
    this.app.fire('rogue:inputLock', true);
    this.waveStatus = 'choosing';

    var isOpening = this._draftMode === 'opening' && this._useWordSystem();
    if (isOpening) this._openingRerollCount = 0;
    this._saveCheckpoint();

    var cards = this._buildCardOptions();
    // 安全網：仍無卡可選時不解鎖失敗、直接進下一波
    if (!cards || !cards.length) {
        this.app.timeScale = this._prevTimeScale || 1;
        this.app.fire('rogue:inputLock', false);
        this._startNextWave();
        return;
    }

    var title = RogueDirector.t('rogue.draft.title');
    if (isOpening) title = this._getOpeningCardTitle();

    var ov = document.createElement('div');
    ov.id = 'rogue-overlay';
    ov.className = 'tk-overlay';
    ov.setAttribute('data-ui-interactive', '');
    document.body.appendChild(ov);

    var ctx = {
        picked: false,
        selectedIdx: -1,
        cards: cards,
        title: title,
        showReroll: isOpening
    };
    this._populateCardOverlay(ov, cards, ctx);
    this._bindCardOverlayPicks(ov, ctx);
};

RogueDirector.prototype._bindTap = function(el, fn) {
    if (!el || !fn) return;
    window.UiTouch.bindTap(el, fn);
};

// ── HUD(波次 / 軍餉 / 軍團名單)─────────────────────────────────
RogueDirector.prototype._buildHud = function() {
    var old = document.getElementById('rogue-hud');
    if (old) old.remove();
    var hud = document.createElement('div');
    hud.id = 'rogue-hud';
    hud.innerHTML =
        '<div class="rg-hud-row" id="rg-hud-row"><span id="rg-hud-wave">' + RogueDirector.t('rogue.wave.n', { n: 0 }) + '</span><span class="rg-hud-sep">·</span><span id="rg-hud-coins">🪙 0</span><span class="rg-hud-sep">·</span><span id="rg-hud-menu" class="rg-hud-menu"><span></span><span></span><span></span></span></div>' +
        '<div class="rg-hud-obj" id="rg-hud-obj">' + RogueDirector.t('rogue.hud.objective', { text: RogueDirector.t('rogue.hud.obj.none') }) + '</div>' +
        '<div class="rg-hud-squad" id="rg-hud-squad"></div>' +
        '<div class="rg-hud-build" id="rg-hud-build">' +
        '<div class="rg-slots" id="rg-hud-slots"></div>' +
        '<div class="rg-reso-row" id="rg-hud-reso"></div>' +
        '</div>';
    document.body.appendChild(hud);

    // Cache HUD DOM refs (avoid getElementById on every _updateHud).
    this._hudWaveEl = document.getElementById('rg-hud-wave');
    this._hudCoinsEl = document.getElementById('rg-hud-coins');
    this._hudObjEl = document.getElementById('rg-hud-obj');
    this._hudSquadEl = document.getElementById('rg-hud-squad');
    this._hudBuildEl = document.getElementById('rg-hud-build');
    this._hudSlotsEl = document.getElementById('rg-hud-slots');
    this._hudResoEl = document.getElementById('rg-hud-reso');
    this._hudRowEl = document.getElementById('rg-hud-row');
    this._hudCache = {};
    this._hudLastWaveSec = null;

    var self = this;
    this._bindTap(this._hudRowEl, function() { self._showQuitConfirm(); });
    if (this._hudBuildEl) {
        this._bindTap(this._hudBuildEl, function() { self._showBuildPanel(); });
    }

    // 🌟 陣亡頭像的點擊委派 (金幣復活)
    var squadDiv = this._hudSquadEl;
    if (squadDiv) {
        var handleSquadTap = function(e) {
            var target = e.target;
            while (target && target !== squadDiv) {
                if (target.classList && target.classList.contains('dead')) {
                    var botId = target.getAttribute('data-id');
                    if (botId) self._tryReviveWithCoins(botId);
                    break;
                }
                target = target.parentNode;
            }
        };
        this._bindTap(squadDiv, handleSquadTap);
    }
};

// 隨時結算確認彈窗
RogueDirector.prototype._showQuitConfirm = function() {
    if (!this.active || this.waveStatus === 'over' || this.waveStatus === 'choosing' || this.waveStatus === 'victory_choice') return;
    var self = this;
    var old = document.getElementById('rogue-overlay');
    if (old) return;

    this._prevTimeScale = this.app.timeScale || 1;
    this.app.timeScale = 0;
    this.app.fire('rogue:inputLock', true);

    var buildDetailHtml = this._renderBuildDetailBlockHtml();

    var ov = document.createElement('div');
    ov.id = 'rogue-overlay';
    ov.className = 'tk-overlay';
    ov.setAttribute('data-ui-interactive', '');
    ov.innerHTML =
        '<div class="rg-panel tk-panel">' +
        '<div class="rg-panel-title tk-panel-title">' + RogueDirector.t('rogue.quit.title') + '</div>' +
        '<div class="rg-panel-sub tk-panel-sub">' + RogueDirector.t('rogue.quit.sub', { coins: this._earnedCoins, xp: this._calcRunXpTotal() }) + '</div>' +
        buildDetailHtml +
        '<div class="rg-panel-btns tk-panel-btns">' +
        '<button class="rg-btn rg-btn-gold tk-btn tk-btn-gold" id="rg-quit-no">' + RogueDirector.t('rogue.quit.cancel') + '</button>' +
        '<button class="rg-btn rg-btn-red tk-btn tk-btn-danger" id="rg-quit-yes">' + RogueDirector.t('rogue.quit.leave') + '</button>' +
        '</div></div>';
    document.body.appendChild(ov);

    this._bindShareButton(ov.querySelector('#rg-btn-share-build'));
    this._bindTap(ov.querySelector('#rg-quit-yes'), function() {
        ov.remove();
        self._finishRun();
    });
    this._bindTap(ov.querySelector('#rg-quit-no'), function() {
        ov.remove();
        self.app.timeScale = self._prevTimeScale || 1;
        self.app.fire('rogue:inputLock', false);
    });
};

RogueDirector.prototype._updateHud = function() {
    if (!this._hudWaveEl) {
        this._hudWaveEl = document.getElementById('rg-hud-wave');
        this._hudCoinsEl = document.getElementById('rg-hud-coins');
        this._hudObjEl = document.getElementById('rg-hud-obj');
        this._hudSquadEl = document.getElementById('rg-hud-squad');
        this._hudBuildEl = document.getElementById('rg-hud-build');
        this._hudSlotsEl = document.getElementById('rg-hud-slots');
        this._hudResoEl = document.getElementById('rg-hud-reso');
    }
    if (!this._hudCache) this._hudCache = {};

    var waveText;
    if (this._surviveLeft > 0) {
        waveText = RogueDirector.t('rogue.hud.waveSurvive', { n: this.wave, sec: Math.ceil(this._surviveLeft) });
    } else if (this._winMode === 'reach' && this._goalHoldTime > 0 && this._goalHoldLeft < this._goalHoldTime) {
        waveText = RogueDirector.t('rogue.hud.hold', { n: this.wave, sec: Math.max(0, Math.ceil(this._goalHoldLeft)) });
    } else {
        waveText = this.isEndless
            ? RogueDirector.t('rogue.hud.waveEndless', { n: this.wave })
            : RogueDirector.t('rogue.hud.waveProgress', { n: this.wave, max: this.maxWaves });
    }
    if (this._hudCache.waveText !== waveText) {
        this._hudCache.waveText = waveText;
        if (this._hudWaveEl) this._hudWaveEl.textContent = waveText;
    }

    var coinsText = '🪙 ' + this._earnedCoins;
    if (this._hudCache.coinsText !== coinsText) {
        this._hudCache.coinsText = coinsText;
        if (this._hudCoinsEl) this._hudCoinsEl.textContent = coinsText;
    }

    var objText;
    if (this._winMode === 'clear') objText = RogueDirector.t('rogue.hud.obj.clear');
    else if (this._winMode === 'survive') objText = RogueDirector.t('rogue.hud.obj.surviveLeft', { n: Math.ceil(this._surviveLeft || 0) });
    else if (this._winMode === 'kill_target') objText = RogueDirector.t('rogue.hud.obj.killNamed', { name: this._targetEnemyName || RogueDirector.t('rogue.hud.obj.none') });
    else if (this._winMode === 'reach') objText = RogueDirector.t('rogue.hud.obj.reach', { n: Math.ceil(this._goalHoldTime || 0) });
    else objText = RogueDirector.t('rogue.hud.obj.none');
    var obj = RogueDirector.t('rogue.hud.objective', { text: objText });
    if (this._hudCache.objText !== obj) {
        this._hudCache.objText = obj;
        if (this._hudObjEl) this._hudObjEl.textContent = obj;
    }

    if (this._hudSquadEl) {
        var html = '';
        for (var i = 0; i < this.squad.length; i++) {
            var m = this.squad[i];
            var col = this.factionColor[m.faction] || '#ccc';
            if (m.dead) {
                var rCost = this._getReviveCost ? this._getReviveCost() : 20;
                html += '<span class="rg-chip dead" data-id="' + m.botId + '" style="border-color:' + col + '; cursor:pointer;" title="' + RogueDirector.t('rogue.hud.reviveTitle') + '">' + RogueDirector.t('rogue.hud.dead', { name: m.name, n: rCost }) + '</span>';
            } else {
                html += '<span class="rg-chip" style="border-color:' + col + ';">' + m.name + '</span>';
            }
        }
        if (this._hudCache.squadHtml !== html) {
            this._hudCache.squadHtml = html;
            this._hudSquadEl.innerHTML = html;
        }
    }

    if (this._hudBuildEl) {
        if (this._useWordSystem() && this.app.wordSystem && this.app.wordSystem.getBuildSlotSnapshot) {
            var snap = this.app.wordSystem.getBuildSlotSnapshot(this);
            this._fullBuildLine = this.app.wordSystem.formatBuildHudLine(this);
            var cacheKey = snap.filled + '/' + snap.max + '|' +
                snap.slots.map(function(s) {
                    return s.empty ? '_' : (s.id + ':' + (s.level || 0));
                }).join(',') + '|' +
                snap.badges.map(function(b) { return b.faction; }).join(',');
            if (this._hudCache.buildKey !== cacheKey) {
                this._hudCache.buildKey = cacheKey;
                if (!this._hudSlotsEl) this._hudSlotsEl = document.getElementById('rg-hud-slots');
                if (!this._hudResoEl) this._hudResoEl = document.getElementById('rg-hud-reso');
                if (this._hudSlotsEl) this._hudSlotsEl.innerHTML = this._renderBuildSlotsHtml(snap);
                if (this._hudResoEl) this._hudResoEl.innerHTML = this._renderResonanceBadgesHtml(snap);
            }
        } else {
            var bh = '';
            var icons = { up_dmg: '⚔️', up_hp: '🛡️', up_spd: '🐎', up_reload: '🏹' };
            var legacyParts = [];
            for (var key in this._cardCounts) {
                if (this._cardCounts[key] > 0 && icons[key]) {
                    legacyParts.push(icons[key] + '×' + this._cardCounts[key]);
                }
            }
            if (legacyParts.length) bh = 'Build: ' + legacyParts.join(' · ');
            if (this._hudCache.buildHtml !== bh) {
                this._hudCache.buildHtml = bh;
                this._hudBuildEl.textContent = bh;
            }
        }
    }
};

RogueDirector.prototype._renderBuildSlotsHtml = function(snap) {
    if (!snap || !snap.slots) return '';
    var html = '';
    for (var i = 0; i < snap.slots.length; i++) {
        var s = snap.slots[i];
        if (s.empty) {
            html += '<div class="rg-slot rg-slot-empty" title="空構築槽"></div>';
        } else {
            var lv = (s.level > 0) ? ('+' + s.level) : '';
            var sigCls = s.isSignature ? ' rg-slot-sig' : '';
            html += '<div class="rg-slot rg-slot-filled' + sigCls + '" style="--rg-slot-edge:' + (s.edge || '#c9a25a') +
                ';border-color:' + (s.edge || '#c9a25a') + ';" title="' + this._escapeHtml(s.name) + '">' +
                '<span class="rg-slot-name">' + this._escapeHtml(s.shortName) + '</span>' +
                (lv ? ('<span class="rg-slot-lv">' + lv + '</span>') : '') +
                '</div>';
        }
    }
    return html;
};

RogueDirector.prototype._renderResonanceBadgesHtml = function(snap) {
    if (!snap || !snap.badges || !snap.badges.length) return '';
    var html = '';
    for (var i = 0; i < snap.badges.length; i++) {
        var b = snap.badges[i];
        html += '<span class="rg-reso-badge" style="border-color:' + (b.edge || '#c9a25a') +
            ';color:' + (b.edge || '#f5d27a') + ';">' + this._escapeHtml(b.text) + '</span>';
    }
    return html;
};

RogueDirector.prototype._onResonanceActivated = function(newly) {
    if (!newly || !newly.length || !this.active) return;
    var facMeta = window.WordConfig && window.WordConfig.factions;
    var bits = [];
    var accent = '#c9a25a';
    for (var i = 0; i < newly.length; i++) {
        var n = newly[i];
        var school = RogueDirector.loc((facMeta && facMeta[n.faction] && facMeta[n.faction].label) || n.faction);
        bits.push(school + '·' + (n.label || ''));
        if (facMeta && facMeta[n.faction] && facMeta[n.faction].edge) accent = facMeta[n.faction].edge;
    }
    this._showRogueBanner(
        '共鳴發動',
        bits.join('、') + '（不佔格）',
        'info',
        2400,
        accent
    );
    this._updateHud();
};

RogueDirector.prototype._showRogueBanner = function(title, subtitle, tone, duration, accentColor) {
    duration = duration || 2200;
    tone = tone || 'info';
    var old = document.getElementById('rogue-banner');
    if (old) old.remove();

    var el = document.createElement('div');
    el.id = 'rogue-banner';
    el.className = 'rg-banner rg-banner-' + tone;
    if (accentColor) el.style.setProperty('--rg-accent', accentColor);

    var line = document.createElement('div');
    line.className = 'rg-banner-line';
    line.textContent = subtitle ? (title + ' · ' + subtitle) : title;
    el.appendChild(line);

    document.body.appendChild(el);
    requestAnimationFrame(function() { el.classList.add('show'); });

    setTimeout(function() {
        el.classList.remove('show');
        setTimeout(function() { if (el.parentNode) el.remove(); }, 220);
    }, duration);
};

RogueDirector.prototype._toast = function(msg, good) {
    var old = document.getElementById('rogue-toast');
    if (old) old.remove();
    var t = document.createElement('div');
    t.id = 'rogue-toast';
    t.className = good ? 'good' : 'bad';
    t.innerText = msg;
    document.body.appendChild(t);
    setTimeout(function() { if (t.parentNode) t.remove(); }, 2200);
};

RogueDirector.prototype._removeDom = function() {
    var ids = ['rogue-hud', 'rogue-overlay', 'rogue-toast', 'rogue-banner'];
    for (var i = 0; i < ids.length; i++) {
        var el = document.getElementById(ids[i]);
        if (el) el.remove();
    }
    this._hudWaveEl = null;
    this._hudCoinsEl = null;
    this._hudObjEl = null;
    this._hudSquadEl = null;
    this._hudBuildEl = null;
    this._hudSlotsEl = null;
    this._hudResoEl = null;
    this._hudRowEl = null;
    this._hudCache = null;
    this._hudLastWaveSec = null;
};

RogueDirector.prototype._getBotCtrl = function() {
    if (this.app.botController) return this.app.botController;
    var gmm = this.app.gameModeManager;
    return (gmm && gmm._getBotCtrl) ? gmm._getBotCtrl() : null;
};

RogueDirector.prototype._findNearbySafePos = function(centerX, centerZ, maxRadius) {
    maxRadius = (maxRadius !== undefined) ? maxRadius : 2.4;
    var gmm = this.app.gameModeManager;
    var cm = this.app.combatManager;

    // Prefer points very close to player, but expand outward if blocked.
    var rings = [0.0, 0.6, 1.2, 1.8, 2.4];
    for (var ri = 0; ri < rings.length; ri++) {
        var r = rings[ri];
        if (r > maxRadius + 0.001) continue;
        var samples = (r <= 0.01) ? 1 : 10;
        for (var si = 0; si < samples; si++) {
            var ang = (samples === 1) ? 0 : ((si / samples) * Math.PI * 2);
            var x = centerX + Math.cos(ang) * r;
            var z = centerZ + Math.sin(ang) * r;
            if (gmm && gmm._nudgeOutOfObstacles) {
                var nudged = gmm._nudgeOutOfObstacles(x, z);
                x = nudged.x; z = nudged.z;
            }
            if (cm && typeof cm.checkCollision === 'function' && cm.checkCollision(x, z)) continue;
            return { x: x, z: z };
        }
    }

    // Fallback: use safest spawn point if available.
    if (gmm && typeof gmm.getSafeSpawnPoint === 'function') {
        var spot = gmm.getSafeSpawnPoint('blue', 1);
        if (spot) return spot;
    }
    return { x: centerX, z: centerZ };
};

// ── 樣式（共用 tk theme + rogue 專用佈局）──────────────────────
RogueDirector.prototype._injectStyles = function() {
    if (typeof UiTheme !== 'undefined') UiTheme.inject();
    if (document.getElementById('rogue-style-v17')) return;
    ['rogue-style', 'rogue-style-v2', 'rogue-style-v3', 'rogue-style-v4', 'rogue-style-v5', 'rogue-style-v6', 'rogue-style-v7', 'rogue-style-v8', 'rogue-style-v9', 'rogue-style-v10', 'rogue-style-v11', 'rogue-style-v12', 'rogue-style-v13', 'rogue-style-v14', 'rogue-style-v15', 'rogue-style-v16'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.remove();
    });
    var rogueScrollFonts = document.getElementById('rogue-scroll-fonts');
    if (rogueScrollFonts) rogueScrollFonts.remove();
    var st = document.createElement('style');
    st.id = 'rogue-style-v17';
    st.innerHTML =
        '#rogue-hud{position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:900;' +
        'display:flex;flex-direction:column;align-items:center;max-width:96vw;' +
        'font-family:"Anton","Microsoft JhengHei",sans-serif;pointer-events:none;' +
        '-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;}' +
        '#rogue-hud .rg-hud-row{display:inline-flex;align-items:center;flex-wrap:nowrap;gap:8px;' +
        'max-width:96vw;box-sizing:border-box;white-space:nowrap;pointer-events:auto;cursor:pointer;' +
        'background:linear-gradient(180deg,#221a12,#15100b);border:1px solid rgba(201,162,90,0.45);border-radius:12px;' +
        'padding:5px 14px;color:var(--tk-gold,#f5d27a);font-size:17px;box-shadow:0 2px 10px rgba(0,0,0,0.6);}' +
        '#rogue-hud #rg-hud-wave,#rogue-hud #rg-hud-coins{white-space:nowrap;}' +
        '#rogue-hud #rg-hud-wave{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;max-width:72vw;}' +
        '#rogue-hud #rg-hud-coins{flex-shrink:0;}' +
        '#rogue-hud .rg-hud-sep{color:#9a8f7a;flex-shrink:0;}' +
        '#rogue-hud .rg-hud-obj{margin-top:6px;max-width:88vw;pointer-events:none;' +
        'background:rgba(0,0,0,0.55);border:1px solid rgba(201,162,90,0.45);border-radius:8px;' +
        'padding:4px 12px;color:#f5d27a;font-size:13px;letter-spacing:0.2px;' +
        'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' +
        'text-shadow:1px 1px 0 rgba(0,0,0,0.85);}' +
        '#rogue-hud .rg-hud-menu{display:inline-flex;flex-direction:column;justify-content:center;gap:3px;' +
        'width:16px;height:12px;flex-shrink:0;opacity:0.85;}' +
        '#rogue-hud .rg-hud-menu span{display:block;height:2px;background:#9a8f7a;border-radius:1px;}' +
        '#rogue-hud .rg-hud-squad{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;justify-content:center;max-width:80vw;pointer-events:auto;}' +
        '#rogue-hud .rg-chip{background:rgba(0,0,0,0.65);border:1px solid #888;border-radius:10px;' +
        'padding:2px 9px;color:#f0e6d2;font-size:13px;}' +
        '#rogue-hud .rg-chip.dead{opacity:0.55;filter:grayscale(1);transition:transform 0.1s;}' +
        '#rogue-hud .rg-chip.dead:active{transform:scale(0.92);}' +
        '#rogue-hud .rg-hud-build{margin-top:5px;max-width:92vw;pointer-events:auto;cursor:pointer;' +
        'display:flex;flex-direction:column;align-items:center;gap:4px;}' +
        '#rogue-hud .rg-slots{display:flex;gap:5px;justify-content:center;flex-wrap:nowrap;}' +
        '#rogue-hud .rg-slot{width:44px;height:36px;border-radius:6px;box-sizing:border-box;' +
        'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'font-family:"Microsoft JhengHei","Anton",sans-serif;font-size:11px;line-height:1.1;' +
        'text-shadow:1px 1px 0 rgba(0,0,0,0.85);}' +
        '#rogue-hud .rg-slot-empty{border:1.5px dashed rgba(154,143,122,0.55);' +
        'background:rgba(0,0,0,0.35);}' +
        '#rogue-hud .rg-slot-filled{border:1.5px solid var(--rg-slot-edge,#c9a25a);' +
        'background:linear-gradient(180deg,rgba(34,26,18,0.92),rgba(12,10,8,0.92));color:#f0e6d2;}' +
        '#rogue-hud .rg-slot-sig{box-shadow:0 0 6px rgba(245,210,122,0.45);}' +
        '#rogue-hud .rg-slot-name{max-width:40px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
        '#rogue-hud .rg-slot-lv{font-size:9px;color:#f5d27a;opacity:0.9;}' +
        '#rogue-hud .rg-reso-row{display:flex;gap:4px;flex-wrap:wrap;justify-content:center;min-height:0;}' +
        '#rogue-hud .rg-reso-badge{font-size:10px;padding:1px 7px;border-radius:8px;' +
        'border:1px solid #c9a25a;background:rgba(0,0,0,0.55);letter-spacing:0.3px;}' +
        '.rg-count{color:#9a8f7a;font-size:11px;font-family:"Microsoft JhengHei",sans-serif;margin-top:5px;' +
        'border-top:1px solid rgba(255,204,40,0.25);padding-top:4px;}' +

        '#rogue-overlay{position:fixed;inset:0;z-index:7500;' +
        'display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:0;' +
        'animation:tkFade 0.25s ease;' +
        'overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;' +
        'padding:max(20px,env(safe-area-inset-top)) 12px max(20px,env(safe-area-inset-bottom));box-sizing:border-box;' +
        'min-height:100dvh;' +
        '-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;}' +
        '#rogue-overlay *,#rogue-overlay *::before,#rogue-overlay *::after{' +
        '-webkit-user-select:none !important;user-select:none !important;-webkit-touch-callout:none !important;}' +
        '.rg-pick-build{display:flex;flex-direction:column;align-items:center;gap:4px;margin:2px 0 8px;' +
        'pointer-events:none;}' +
        '.rg-pick-slots{display:flex;gap:5px;justify-content:center;flex-wrap:nowrap;}' +
        '.rg-pick-slots .rg-slot{width:40px;height:32px;border-radius:6px;box-sizing:border-box;' +
        'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'font-family:"Microsoft JhengHei","Anton",sans-serif;font-size:10px;line-height:1.1;' +
        'text-shadow:1px 1px 0 rgba(0,0,0,0.85);}' +
        '.rg-pick-slots .rg-slot-empty{border:1.5px dashed rgba(154,143,122,0.55);background:rgba(0,0,0,0.35);}' +
        '.rg-pick-slots .rg-slot-filled{border:1.5px solid var(--rg-slot-edge,#c9a25a);' +
        'background:linear-gradient(180deg,rgba(34,26,18,0.92),rgba(12,10,8,0.92));color:#f0e6d2;}' +
        '.rg-pick-slots .rg-slot-sig{box-shadow:0 0 6px rgba(245,210,122,0.45);}' +
        '.rg-pick-slots .rg-slot-name{max-width:36px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
        '.rg-pick-slots .rg-slot-lv{font-size:8px;color:#f5d27a;opacity:0.9;}' +
        '.rg-pick-reso{display:flex;gap:4px;flex-wrap:wrap;justify-content:center;min-height:0;}' +
        '.rg-pick-reso .rg-reso-badge{font-size:10px;padding:1px 7px;border-radius:8px;' +
        'border:1px solid #c9a25a;background:rgba(0,0,0,0.55);letter-spacing:0.3px;color:#f5d27a;}' +
        '.rg-pick-hint{letter-spacing:1px;}' +
        '.rg-pick-wrap{margin:0 auto !important;}' +
        '.rg-pick-actions{display:flex;gap:10px;width:min(96vw,340px);justify-content:center;align-items:stretch;margin-top:2px;}' +
        '.rg-btn-confirm,.rg-btn-reroll{flex:1;min-width:0;max-width:none;margin-top:0;}' +
        '#rogue-overlay #rg-confirm-btn{background:linear-gradient(178deg,#f6d689,#dcb669 52%,#a8823f) !important;' +
        'color:#2a1d08 !important;border:0 !important;}' +
        '#rogue-overlay #rg-confirm-btn:disabled{opacity:0.42;filter:grayscale(0.25);}' +
        '#rogue-overlay #rg-reroll-btn{background:rgba(184,148,90,.08) !important;color:#f0cf87 !important;' +
        'border:1px solid rgba(184,148,90,.45) !important;' +
        'box-shadow:none !important;}' +
        '#rogue-overlay #rg-reroll-btn:active{background:rgba(184,148,90,.16) !important;}' +
        '#rogue-overlay #rg-reroll-btn.rg-reroll-disabled{opacity:0.42;}' +
        '#rogue-overlay button.tk-btn:not(.rg-build-share-btn):not(.rg-settle-btn-ghost){border-radius:0 !important;clip-path:polygon(0 0,calc(100% - 11px) 0,100% 11px,100% 100%,11px 100%,0 calc(100% - 11px));letter-spacing:1px !important;text-indent:0 !important;font-size:17px !important;line-height:1 !important;}' +
        '#rogue-overlay #rg-quit-no,#rogue-overlay #rg-quit-yes{padding:13px 0 !important;}' +
        /* 同面板按鈕色階分離：取消＝次要描邊，離開＝危警示紅 */ +
        '#rogue-overlay #rg-quit-no{background:rgba(184,148,90,.08) !important;color:#f0cf87 !important;' +
        'border:1px solid rgba(184,148,90,.45) !important;box-shadow:none !important;}' +
        '#rogue-overlay #rg-quit-yes{background:linear-gradient(178deg,#ad5c51,#81342b) !important;' +
        'color:#f3e4d0 !important;border:0 !important;}' +
        '#rogue-overlay #rg-btn-close-build{background:rgba(184,148,90,.08) !important;color:#f0cf87 !important;' +
        'border:1px solid rgba(184,148,90,.45) !important;box-shadow:none !important;}' +
        '#rogue-overlay #rg-btn-quit-from-build{background:linear-gradient(178deg,#ad5c51,#81342b) !important;' +
        'color:#f3e4d0 !important;border:0 !important;}' +
        '#rogue-overlay #rg-btn-home{background:linear-gradient(178deg,#4a5668,#2f3744) !important;' +
        'color:#e6edf7 !important;border:1px solid rgba(190,205,225,0.35) !important;box-shadow:0 3px 0 rgba(18,22,28,0.65) !important;}' +
        '#rogue-overlay #rg-btn-endless{background:linear-gradient(178deg,#ad5c51,#81342b) !important;' +
        'color:#f3e4d0 !important;border:0 !important;}' +

        '.rg-cards{display:flex;flex-direction:row;align-items:flex-start;justify-content:center;' +
        'gap:clamp(6px,2.5vw,12px);padding:0 4px;width:100%;max-width:min(96vw,400px);}' +
        '.rg-scroll-card{position:relative;flex:1;max-width:118px;min-width:0;display:flex;flex-direction:column;' +
        'cursor:pointer;transition:transform 0.14s ease;touch-action:manipulation;' +
        '-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;' +
        'animation:tkCardIn 0.35s cubic-bezier(0.175,0.885,0.32,1.275) backwards;}' +
        '.rg-scroll-card:nth-child(2){animation-delay:0.08s;}' +
        '.rg-scroll-card:nth-child(3){animation-delay:0.16s;}' +
        '.rg-scroll-card:active:not(.rg-card-selected):not(.rg-card-dismiss){transform:translateY(-3px);}' +
        '.rg-card-selected{transform:scale(1.04) translateY(-4px);z-index:2;' +
        'filter:drop-shadow(0 6px 14px rgba(245,210,122,0.28));}' +
        '.rg-card-confirmed{animation:rgCardSelect 0.36s cubic-bezier(0.2,0.9,0.3,1.15) forwards !important;}' +
        '.rg-card-dismiss{animation:rgCardDismiss 0.28s ease forwards !important;pointer-events:none;opacity:0.45;}' +
        '@keyframes rgCardSelect{0%{transform:scale(1);}100%{transform:scale(1.04) translateY(-4px);opacity:1;}}' +
        '@keyframes rgCardDismiss{to{transform:translateY(8px);opacity:0;}}' +

        '.rg-rod{width:100%;height:12px;border-radius:6px;flex-shrink:0;position:relative;z-index:3;' +
        'background:linear-gradient(180deg,#4a3a22,#2a2013 60%,#1a130a);' +
        'box-shadow:inset 0 1px 0 rgba(201,162,90,0.4),0 1px 3px rgba(0,0,0,0.6);}' +
        '.rg-rod::before,.rg-rod::after{content:"";position:absolute;top:1px;bottom:1px;width:7px;border-radius:4px;' +
        'background:linear-gradient(180deg,#6b5230,#3a2c18);}' +
        '.rg-rod::before{left:-3px;}.rg-rod::after{right:-3px;}' +

        '.rg-silk{width:100%;height:400px;position:relative;overflow:hidden;' +
        'border-left:2px solid var(--frame,rgba(201,162,90,0.4));border-right:2px solid var(--frame,rgba(201,162,90,0.4));' +
        'display:grid;grid-template-rows:204px auto 1fr auto;align-content:stretch;' +
        'justify-items:center;padding:12px 5px 8px;box-sizing:border-box;' +
        '-webkit-user-select:none;user-select:none;}' +
        '.rg-bigname{grid-row:1;position:relative;z-index:2;writing-mode:vertical-rl;text-orientation:upright;' +
        'font-family:var(--tk-font-serif);font-weight:900;' +
        'line-height:0.98;letter-spacing:2px;color:transparent;-webkit-text-stroke:1.5px var(--stroke,rgba(201,162,90,0.6));' +
        'height:204px;max-height:204px;white-space:nowrap;overflow:hidden;' +
        'display:flex;align-items:center;justify-content:center;align-self:start;' +
        'font-size:var(--namesize,40px);pointer-events:none;' +
        '-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;}' +
        '.rg-nameblock{grid-row:1;position:relative;z-index:2;height:204px;max-height:204px;width:100%;' +
        'display:flex;flex-direction:column;align-items:center;justify-content:center;align-self:start;' +
        'box-sizing:border-box;pointer-events:none;}' +
        '.rg-nameblock .rg-bigname{grid-row:auto;align-self:center;height:auto;max-height:204px;flex:1 1 auto;min-height:0;}' +
        '.rg-silk-bilingual .rg-nameblock .rg-bigname{max-height:176px;}' +
        '.rg-enname{flex:0 0 auto;writing-mode:horizontal-tb;text-orientation:mixed;' +
        'font-family:var(--tk-font-body,sans-serif);font-weight:600;font-size:10px;line-height:1.2;' +
        'letter-spacing:0.2px;color:rgba(232,220,196,0.88);text-align:center;' +
        'max-width:100%;padding:2px 1px 0;box-sizing:border-box;' +
        'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
        '.rg-rk{grid-row:2;position:relative;z-index:2;align-self:center;font-family:var(--tk-font-serif);font-weight:900;font-size:13px;' +
        'margin-top:8px;' +
        'padding:2px 12px;border-radius:3px;letter-spacing:2px;line-height:1.2;white-space:nowrap;pointer-events:none;}' +
        '.rg-rk-en{font-size:11px;letter-spacing:0.5px;padding:2px 8px;}' +
        '.rg-silk-mid{grid-row:3;display:flex;flex-direction:column;justify-content:center;align-items:center;' +
        'gap:6px;min-height:0;width:100%;padding:4px 0;box-sizing:border-box;}' +
        '.rg-meta{position:relative;z-index:2;font-size:9.5px;color:#9a8f7a;letter-spacing:1px;text-align:center;' +
        'max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;pointer-events:none;}' +
        '.rg-headline{position:relative;z-index:2;font-size:11.5px;color:#e8dcc4;text-align:center;line-height:1.35;' +
        'padding:0 2px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;' +
        'max-height:4.05em;width:100%;pointer-events:none;}' +
        '.rg-hint{grid-row:4;position:relative;z-index:2;align-self:end;font-size:8.5px;color:rgba(201,162,90,0.55);' +
        'letter-spacing:0.5px;min-height:14px;margin-top:auto;}' +
        '.rg-detail-btn{cursor:pointer;color:rgba(245,210,122,0.72);padding:2px 0;touch-action:manipulation;}' +
        '.rg-detail-btn:active{color:#ffe9a8;}' +

        '.rg-silk-fx{position:absolute;inset:0;z-index:3;pointer-events:none;overflow:hidden;}' +

        '.rg-silk-n{--frame:rgba(232,220,196,0.2);--stroke:rgba(217,203,176,0.5);' +
        'background:linear-gradient(180deg,#241d15,#191309);}' +
        '.rg-silk-n .rg-bigname{-webkit-text-stroke-width:1px;color:rgba(217,203,176,0.1);}' +
        '.rg-silk-n .rg-rk{background:rgba(232,220,196,0.06);color:#9a8f7a;border:1px solid rgba(232,220,196,0.15);}' +
        '.rg-silk-r{--frame:rgba(201,162,90,0.5);--stroke:rgba(201,162,90,0.7);' +
        'background:linear-gradient(180deg,#281f13,#1a130a);}' +
        '.rg-silk-r .rg-bigname{color:rgba(201,162,90,0.07);}' +
        '.rg-silk-r .rg-rk{background:linear-gradient(180deg,#d8b878,#a8823f);color:#241a08;}' +
        '.rg-silk-sr{--frame:rgba(245,210,122,0.65);--stroke:rgba(245,210,122,0.85);' +
        'background:linear-gradient(180deg,#2b2113,#1c140b);box-shadow:inset 0 0 20px rgba(245,210,122,0.08);}' +
        '.rg-silk-sr .rg-rk{background:linear-gradient(180deg,#f5d27a,#c9a25a);color:#241a08;box-shadow:0 0 6px rgba(245,210,122,0.4);}' +
        '.rg-silk-ssr{--frame:rgba(255,233,168,0.85);--stroke:rgba(255,233,168,0.95);' +
        'background:linear-gradient(180deg,#3a2c18 0%,#251a0d 60%,#1a1108 100%);animation:rgSilkBreath 3s ease-in-out infinite;}' +
        '@keyframes rgSilkBreath{0%,100%{box-shadow:inset 0 0 18px rgba(245,210,122,0.1);}' +
        '50%{box-shadow:inset 0 0 26px rgba(245,210,122,0.22);}}' +
        '.rg-silk-ssr .rg-bigname{-webkit-text-stroke-width:1.7px;filter:drop-shadow(0 0 6px rgba(245,210,122,0.4));}' +
        '.rg-silk-ssr .rg-rk{background:linear-gradient(180deg,#ffe9a8,#f5d27a 50%,#c9a25a);color:#241a08;' +
        'box-shadow:0 0 10px rgba(245,210,122,0.6);}' +
        '.rg-scroll-card:has(.rg-silk-ssr) > .rg-rod,.rg-card-ssr > .rg-rod{background:linear-gradient(180deg,#7a5e32,#4a3820 60%,#2a2013);}' +
        '.rg-ming{position:absolute;top:4px;right:4px;z-index:5;width:24px;height:24px;' +
        'background:linear-gradient(160deg,#c23c30,#8e2419);border-radius:3px;' +
        'display:flex;align-items:center;justify-content:center;font-family:var(--tk-font-serif);' +
        'font-weight:900;font-size:13px;color:#f3e4d0;transform:rotate(-5deg);' +
        'box-shadow:inset 0 0 0 1px rgba(243,228,208,0.32),0 2px 5px rgba(176,52,42,0.5);}' +
        '.rg-sheen{position:absolute;inset:0;z-index:1;pointer-events:none;overflow:hidden;}' +
        '.rg-sheen::after{content:"";position:absolute;top:0;left:-70%;width:45%;height:100%;' +
        'background:linear-gradient(105deg,transparent,rgba(255,233,168,0.4),transparent);' +
        'transform:skewX(-20deg);animation:rgSilkSheen 3.8s ease-in-out infinite;}' +
        '@keyframes rgSilkSheen{0%,55%{left:-70%;}86%,100%{left:160%;}}' +
        '.rg-silk-recruit{--frame:var(--rg-frame,rgba(120,150,190,0.55));--stroke:var(--rg-stroke,rgba(120,150,190,0.6));' +
        'background:linear-gradient(180deg,#281f13,#1a130a);}' +
        '.rg-silk-recruit .rg-bigname{color:var(--rg-bigname-fill,rgba(120,150,190,0.08));' +
        '-webkit-text-stroke-color:var(--rg-stroke,rgba(120,150,190,0.6));}' +
        '.rg-rk-recruit{background:var(--rg-rk-bg,rgba(43,107,163,0.3));color:var(--rg-faction-edge,#8fb8d8);' +
        'border:1px solid var(--rg-frame,rgba(120,150,190,0.4));}' +
        '.rg-rk-upgrade{font-size:11px;padding:2px 8px;}' +
        '.rg-card-label{font-size:9.5px;color:#9a8f7a;text-align:center;margin-top:5px;letter-spacing:1px;}' +

        '.rg-pop{position:fixed;inset:0;z-index:7600;background:rgba(8,6,4,0.82);' +
        'display:none;align-items:center;justify-content:center;padding:24px;cursor:pointer;}' +
        '.rg-pop.show{display:flex;}' +
        '.rg-pop-card{background:linear-gradient(180deg,rgba(34,26,18,0.98),rgba(21,16,11,0.99));' +
        'border:2px solid rgba(201,162,90,0.55);border-radius:14px;padding:22px 24px;max-width:320px;width:100%;' +
        'box-shadow:0 12px 40px rgba(0,0,0,0.7),0 0 24px rgba(245,210,122,0.15);text-align:center;cursor:default;}' +
        '.rg-pop-name{font-family:var(--tk-font-serif);font-weight:900;font-size:28px;color:#ffe9a8;margin-bottom:4px;}' +
        '.rg-pop-meta{font-size:12px;color:#9a8f7a;letter-spacing:1px;margin-bottom:14px;}' +
        '.rg-pop-h{font-size:15px;color:#ffe9a8;font-weight:700;margin-bottom:8px;line-height:1.5;}' +
        '.rg-pop-d{font-size:13px;color:#e8dcc4;line-height:1.6;margin-bottom:12px;}' +
        '.rg-pop-up{font-size:12.5px;color:#c9a25a;border-top:1px solid rgba(201,162,90,0.25);' +
        'padding-top:12px;line-height:1.6;display:none;}' +
        '.rg-pop-close{font-size:11px;color:#9a8f7a;margin-top:14px;letter-spacing:2px;}' +

        '.rg-panel{padding:28px 32px;min-width:280px;max-width:88vw;margin:auto;}' +
        '.rg-settle{text-align:center;}' +
        '.rg-settle-hero{margin:0 0 10px;}' +
        '.rg-settle-hero-glyph{font-family:var(--tk-font-serif,"Noto Serif TC",serif);font-weight:900;' +
        'font-size:clamp(18px,calc(240px/var(--hero-chars,4)),42px);line-height:1;color:rgba(245,210,122,0.42);' +
        'text-shadow:0 6px 24px rgba(0,0,0,0.75);letter-spacing:clamp(1px,calc(12px/var(--hero-chars,4)),4px);' +
        'white-space:nowrap;max-width:100%;overflow:hidden;}' +
        '.rg-settle-hero-name{font-family:var(--tk-font-serif,"Noto Serif TC",serif);font-weight:900;' +
        'font-size:15px;color:#9a8f7a;letter-spacing:3px;margin-top:4px;}' +
        '.rg-settle-sub{text-align:center;line-height:1.5;}' +
        '.rg-settle-stats{display:flex;flex-direction:column;gap:6px;margin:12px 0 14px;align-items:center;}' +
        '.rg-settle-stat{font-family:"Microsoft JhengHei",sans-serif;font-size:15px;color:#e8dcc4;letter-spacing:0.3px;}' +
        '.rg-settle-build{text-align:left;}' +
        '.rg-settle-build-head{display:flex;align-items:center;justify-content:flex-start;gap:8px;margin-bottom:6px;flex-wrap:wrap;}' +
        '.rg-settle-build-label{font-size:11px;color:#9a8f7a;letter-spacing:2px;text-transform:uppercase;}' +
        '.rg-settle-share-link{margin-left:auto;background:none;border:none;color:#9a8f7a;font-size:12px;cursor:pointer;' +
        'font-family:"Microsoft JhengHei",sans-serif;text-decoration:underline;text-underline-offset:2px;padding:2px 0;}' +
        '.rg-settle-build-toggle{background:none;border:none;color:#c9a25a;font-size:12px;cursor:pointer;' +
        'padding:6px 10px;margin-left:auto;font-family:"Microsoft JhengHei",sans-serif;' +
        'pointer-events:auto;touch-action:manipulation;-webkit-tap-highlight-color:transparent;position:relative;z-index:2;}' +
        '.rg-settle-share-link + .rg-settle-build-toggle{margin-left:0;}' +
        '.rg-settle-build-compact,.rg-settle-build-totals,.rg-build-totals,.rg-settle-build-detail{' +
        'width:100%;box-sizing:border-box;}' +
        '.rg-settle-build-compact{color:#f5d27a;font-size:15px;line-height:1.5;font-family:"Microsoft JhengHei",sans-serif;' +
        'padding:10px 12px;background:rgba(201,162,90,0.08);border:1px solid rgba(201,162,90,0.22);border-radius:8px;}' +
        '.rg-settle-build-detail,.rg-build-detail-collapsible{display:none !important;margin-top:8px;}' +
        '.rg-settle-build-detail.show,.rg-build-detail-collapsible.show{display:block !important;}' +
        '.rg-settle-build-totals,.rg-build-totals{margin-top:8px;margin-bottom:0;padding:0;background:rgba(79,66,42,0.24);' +
        'border:1px solid rgba(154,143,122,0.2);border-radius:8px;text-align:left;overflow:hidden;}' +
        '.rg-build-totals-label{display:block;width:100%;box-sizing:border-box;font-size:12px;color:#e8dcc4;letter-spacing:1px;' +
        'padding:8px 12px;background:rgba(201,162,90,0.12);border-bottom:1px solid rgba(154,143,122,0.22);}' +
        '.rg-build-totals-table{padding:8px 12px;}' +
        '.rg-settle-total-line{font-size:12px;color:#d8c7a5;line-height:1.45;}' +
        '.rg-settle-total-line + .rg-settle-total-line{margin-top:3px;}' +
        '.rg-build-totals-note{font-size:11px;color:#9a8f7a;line-height:1.45;padding:6px 12px 8px;' +
        'border-top:1px solid rgba(154,143,122,0.15);}' +
        '.rg-settle-btns{gap:8px;}' +
        '.rg-settle-btn-ghost{font-size:14px !important;opacity:0.9;padding:8px 0 !important;min-height:auto !important;' +
        'clip-path:none !important;background:none !important;border:none !important;box-shadow:none !important;' +
        'color:#9a8f7a !important;text-decoration:underline;text-underline-offset:3px;}' +
        '.rg-build-block{position:relative;margin:4px 0 14px;}' +
        '.rg-build-share-btn{position:absolute;top:50%;right:6px;transform:translateY(-50%);z-index:1;width:28px;height:28px;padding:0;' +
        'display:flex;align-items:center;justify-content:center;touch-action:manipulation;}' +
        '.rg-build-detail{color:#c9a25a;font-size:12.5px;line-height:1.6;font-family:"Microsoft JhengHei",sans-serif;' +
        'padding:10px 12px;background:rgba(201,162,90,0.08);border:1px solid rgba(201,162,90,0.22);' +
        'border-radius:8px;width:100%;box-sizing:border-box;word-break:break-word;text-align:left;}' +
        '.rg-build-detail-line{padding:2px 0;border-bottom:1px solid rgba(201,162,90,0.12);}' +
        '.rg-build-detail-line:last-child{border-bottom:none;}' +

        '#rogue-toast{position:fixed;top:18%;left:50%;transform:translateX(-50%);z-index:8500;' +
        'color:#fff;padding:12px 24px;border-radius:0;font-size:17px;' +
        'clip-path:polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,10px 100%,0 calc(100% - 10px));' +
        'font-family:"Microsoft JhengHei";pointer-events:none;animation:tkFade 0.2s ease;}' +
        '#rogue-toast.good{background:rgba(40,110,45,0.95);border:1px solid #5cb85c;}' +
        '#rogue-toast.bad{background:rgba(120,40,40,0.95);border:1px solid #e85a4a;}' +

        '#rogue-banner{position:fixed;top:46px;left:50%;transform:translateX(-50%) scale(0.96);' +
        'z-index:6500;max-width:88vw;pointer-events:none;opacity:0;' +
        'background:linear-gradient(180deg,#221a12,#15100b);border:1px solid var(--rg-accent,#c9a25a);' +
        'border-radius:0;padding:4px 12px;box-shadow:0 2px 10px rgba(0,0,0,0.55);' +
        'clip-path:polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px));' +
        'transition:opacity 0.2s ease,transform 0.2s ease;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
        '#rogue-banner.show{opacity:1;transform:translateX(-50%) scale(1);}' +
        '#rogue-banner .rg-banner-line{font-family:"Anton","Microsoft JhengHei",sans-serif;' +
        'font-size:13px;letter-spacing:0.3px;color:#f5d27a;line-height:1.25;' +
        'text-shadow:1px 1px 0 rgba(0,0,0,0.85);}' +
        '#rogue-banner.rg-banner-death{border-color:#c62828;}' +
        '#rogue-banner.rg-banner-death .rg-banner-line{color:#ef9a9a;}' +
        '#rogue-banner.rg-banner-revive{border-color:#2e7d32;}' +
        '#rogue-banner.rg-banner-revive .rg-banner-line{color:#a5d6a7;}' +
        '#rogue-banner.rg-banner-bond .rg-banner-line{color:var(--rg-accent,#f5d27a);}' +

        '@media (orientation:landscape){' +
        '#rogue-overlay{padding:max(24px,env(safe-area-inset-top)) 28px max(24px,env(safe-area-inset-bottom));}' +
        '.rg-cards{max-width:min(94vw,420px);gap:clamp(10px,2.8vw,16px);}}' +

        '@media (orientation:portrait){' +
        '#rogue-hud{top:calc(8px + var(--tk-sat,0px));max-width:94vw;}' +
        '#rogue-hud .rg-hud-row{gap:6px;padding:4px 10px;font-size:clamp(13px,3.6vw,17px);}' +
        '#rogue-hud #rg-hud-wave{max-width:68vw;}' +
        '#rogue-hud .rg-hud-obj{font-size:12px;padding:3px 10px;max-width:94vw;}' +
        '#rogue-overlay{padding:max(16px,env(safe-area-inset-top)) 12px max(16px,env(safe-area-inset-bottom));}' +
        '.rg-cards{max-width:min(96vw,420px);gap:clamp(5px,2vw,10px);}' +
        '.rg-scroll-card{max-width:clamp(100px,28vw,118px);}' +
        '.rg-silk{height:400px;grid-template-rows:192px auto 1fr auto;}' +
        '.rg-bigname{height:192px;max-height:192px;}' +
        '.rg-nameblock{height:192px;max-height:192px;}' +
        '.rg-silk-bilingual .rg-nameblock .rg-bigname{max-height:166px;}}' +
        '@media (orientation:landscape) and (max-height:520px){' +
        '#rogue-overlay{padding:16px 18px;}' +
        '.rg-silk{height:290px;grid-template-rows:156px auto 1fr auto;padding:10px 5px 7px;}' +
        '.rg-bigname{height:156px;max-height:156px;}' +
        '.rg-nameblock{height:156px;max-height:156px;}' +
        '.rg-silk-bilingual .rg-nameblock .rg-bigname{max-height:132px;}' +
        '.rg-pop-name{word-break:break-word;line-height:1.2;}}';
    document.head.appendChild(st);
};