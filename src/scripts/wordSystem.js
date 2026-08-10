// ═══════════════════════════════════════════════════════════════
// WordSystem — Trial 1 詞卡邏輯（裝備、縮放、buff 計算）
// 掛到 PlayCanvas Entity；initialize 後 this.app.wordSystem 可用
// ═══════════════════════════════════════════════════════════════
var WordSystem = pc.createScript('wordSystem');

WordSystem.BUFF_KEYS = ['dmgMul', 'hpMul', 'speedMul', 'reloadMul', 'damageTakenMul', 'dotMul', 'ccDurationMul'];

// 詞卡「副題線」→ UI 顯示用屬性名（不是魏蜀吳群國籍）
WordSystem.LINE_LABELS = {
    damage: 'DMG',
    survival: 'SURV',
    speed: 'SPD',
    dot: 'DOT',
    control: 'CC'
};

// 同系 DOT 不同 type 可並存 tick；UI 用家族判斷顯示圖示
WordSystem.FIRE_DOT_TYPES = { burn: 1, flame: 1, inferno: 1 };
WordSystem.BLEED_DOT_TYPES = { bleed: 1, seep: 1, hemorrhage: 1, poison: 1 };

WordSystem.hasActiveFireDot = function(states) {
    if (!states) return false;
    for (var k in states) {
        if (states[k] && WordSystem.FIRE_DOT_TYPES[k]) return true;
    }
    return false;
};

WordSystem.hasActiveBleedDot = function(states) {
    if (!states) return false;
    for (var k in states) {
        if (states[k] && WordSystem.BLEED_DOT_TYPES[k]) return true;
    }
    return false;
};

WordSystem.prototype.initialize = function() {
    this.app.wordSystem = this;
    this.resetRun();
};

WordSystem.prototype.resetRun = function() {
    this._owned = [];
    this._levels = {};
    this._openingStep = 0;
    this._openingDone = false;
    this._lastBuffs = this._identityBuffs();
    if (this.app) this.app._executeCooldowns = {};
    // 🌟 本命卡槽：第一波才決定，之後只升級不換
    this._sigCardId = null;      // 裝在本命槽的卡 id（可能 SSR/SR，或 null=沒選本命）
    this._sigTier = 0;           // 本命卡當前 tier（0=Lv1）
    this._sigResolved = false;   // 第一波本命選擇是否已定案（選任何卡都算,之後永久關閉本命）
    this._sigPityDone = false;   // 首次 Boss 通關保底是否已評估
    this._sigBossPityDue = false; // Boss 保底：下次波間必出本命覺醒（不靜默跳級）
    this._sigBaseBrawler = this._currentBrawlerType();
    this._sigShownBlacklist = {};  // 開場重抽：已展示過的本命卡 id → 本局不再出現
    this._sigChanceCacheKey = null;
    this._sigChanceCachePass = false;
    // 共鳴收尾：faction → refine level（實體被吸收或共鳴後精煉）
    this._finisherLevels = {};
    this._resonanceActive = {};
    this._resonanceActivePrev = {};
};

WordSystem.prototype._identityBuffs = function() {
    return {
        dmgMul: 1, hpMul: 1, speedMul: 1, reloadMul: 1,
        damageTakenMul: 1, dotMul: 1, ccDurationMul: 1,
        critChance: 0, critMul: 1.5, bonusVsShield: 0, onShieldBreakDmgPct: 0, shieldMaxPct: 0,
        dodgeChance: 0, procAllyDamagePct: 0, basicProcs: [], onCritEffects: [],
        procTriggerUnlocks: null, procSpreadCount: 1, procSpreadAngle: 14,
        execute: null, onKill: null, hpLostScaling: null, onLowHpTriggers: [], auras: [],
        breachWindow: null, emberDetonate: null,
        fireSustain: null, scaleCounter: null, windReturn: null, poiseCharge: null,
        shieldBreakBurst: null, shieldBreakRetaliation: null, chainHarvest: null,
        lifestealPct: 0,
        dashRechargeMul: 1, ammoBonus: 0, dashChargesBonus: 0,
        activeResonances: {}
    };
};

// ═══════════════════════════════════════════════════════════
// 本命卡 build 管理
//   第一波：本命池（角色 SSR + 同 swapGroup SR），不足補普通卡。
//   重抽：本輪展示過的效果本命 id 加入黑名單；池空則全普通卡。
//   選效果本命 → 波間只出該張升級卡；選普通卡當本命 → 波間無本命。
//   裝了效果本命（rogue 內）→ 完全接管該效果，config 原生值讓位。
// ═══════════════════════════════════════════════════════════

WordSystem.prototype._currentBrawlerType = function() {
    var pc = this.app && this.app.playerController;
    return (pc && pc.brawlerType) || null;
};

// 當前裝備的本命卡定義（null = 沒裝本命）
WordSystem.prototype._sigDef = function() {
    if (!this._sigCardId || !window.WordConfig) return null;
    return window.WordConfig.cards[this._sigCardId] || null;
};

// 本命卡是否為效果卡（vs 普通卡當本命）
WordSystem.prototype._sigIsEffect = function() {
    var d = this._sigDef();
    return !!(d && d.cardType === 'effect');
};

// 本命卡 tier 上限（效果卡 = tiers 長度；普通卡沿用一般升級，這裡回 0 代表不走本命 tier）
WordSystem.prototype._sigMaxTier = function() {
    var d = this._sigDef();
    if (d && d.tiers) return d.tiers.length - 1;
    return 0;
};

// 第一波本命卡池：角色 SSR 本命 + 同 swapGroup 的通用 SR 本命
WordSystem.prototype.getSignaturePool = function() {
    var out = [];
    if (!window.WordConfig || !window.BrawlerConfig) return out;
    var bType = this._sigBaseBrawler || this._currentBrawlerType();
    var bc = bType && window.BrawlerConfig[bType];
    var sigId = bc && bc.signatureCard;
    var sigDef = sigId && window.WordConfig.cards[sigId];

    if (sigDef) out.push(sigId);                    // 角色 SSR 本命
    // 同 swapGroup 的通用 SR 本命（如餘燼）+ 角色專屬 SR 本命
    var group = sigDef && sigDef.swapGroup;
    var cards = window.WordConfig.cards;
    for (var id in cards) {
        var d = cards[id];
        if (!d || d.cardType !== 'effect' || d.retired) continue;
        if (id === sigId) continue;
        if (d.rarity === 'SR' && d.signature === bType) {
            out.push(id);
            continue;
        }
        if (d.rarity === 'SR' && d.signature == null && (!group || d.swapGroup === group)) {
            out.push(id);
        }
    }
    return out;
};

// 開場本命池（排除重抽黑名單）
WordSystem.prototype.getOpeningSignaturePool = function() {
    var pool = this.getSignaturePool();
    var out = [];
    for (var i = 0; i < pool.length; i++) {
        if (!this._sigShownBlacklist[pool[i]]) out.push(pool[i]);
    }
    return out;
};

WordSystem.prototype.isSignatureEffectCardId = function(cardId) {
    var d = this.getCardDef(cardId);
    return !!(d && d.cardType === 'effect');
};

// 開場重抽：將本輪已展示的效果本命卡加入黑名單
WordSystem.prototype.blacklistOfferedSignatures = function(cardIds) {
    if (!cardIds) return;
    for (var i = 0; i < cardIds.length; i++) {
        if (this.isSignatureEffectCardId(cardIds[i])) {
            this._sigShownBlacklist[cardIds[i]] = true;
        }
    }
};

WordSystem.prototype.getSignatureTier = function() {
    return this._sigTier || 0;
};

WordSystem.prototype.getSignatureCardId = function() {
    return this._sigCardId;
};

WordSystem.prototype.canOfferSignatureUpgrade = function() {
    return this._sigCanUpgrade();
};

// 波間本命覺醒：機率出現 + 連續未出保底（非每波必出）
WordSystem.prototype.shouldOfferSignatureUpgrade = function(rd) {
    if (!this.canOfferSignatureUpgrade()) return false;
    // Boss 保底：強制出覺醒卡讓玩家親手升級，避免靜默跳過中間等級
    if (this._sigBossPityDue && (this._sigTier || 0) < 1) return true;
    var cfg = window.WordConfig || {};
    var pityNeed = cfg.signatureUpgradePityWaves || 5;
    var wavesSince = (rd && rd._wavesSinceSigUpgrade) ? rd._wavesSinceSigUpgrade : 0;
    if (wavesSince >= pityNeed) return true;
    var chance = cfg.signatureUpgradeChance;
    if (chance === undefined) chance = 0.28;
    return Math.random() < chance;
};

WordSystem.prototype.formatSignatureUpgradeParts = function() {
    var def = this._sigDef();
    if (!def || !def.tiers) return { headline: '', detail: '' };
    var next = (this._sigTier || 0) + 1;
    var tierDef = def.tiers[next];
    if (!tierDef) return { headline: '', detail: '' };
    return {
        headline: this.t('rogue.sig.awaken', { name: this._cardName(def), n: next + 1 }),
        detail: this._locText(tierDef.desc) || this._cardDesc(def) || ''
    };
};

// 選定本命卡（第一波）→ 進本命槽
// 第一波選 SSR/SR 效果本命卡 → 進本命槽（走效果卡質變）
WordSystem.prototype.chooseSignatureCard = function(cardId, rd) {
    this._sigCardId = cardId;
    this._sigTier = 0;
    this._sigResolved = true;
    this._syncSignatureRuntime();
    this.reapplyBuffs && this.reapplyBuffs(rd);
    this._bumpOpeningStep();   // 本命選擇佔一次開局 pick(統一在此推進,外部不再呼叫)
    return true;
};

// 第一波選了普通卡當本命（選項 Y）→ 普通卡進本命槽 + 正常加入 owned（吃 refine 升級）
// 之後永久關閉本命卡系統。
WordSystem.prototype.pickPlainAsSignature = function(cardId, rd) {
    this._sigResolved = true;
    this._sigCardId = cardId;          // 記錄槽內是這張普通卡（升級/保底用）
    this._sigTier = 0;
    this._syncSignatureRuntime();       // 普通卡非 effect → _signatureCard 會是 null（不接管命中效果）
    return this.completeOpeningPick(cardId, rd);   // completeOpeningPick 內已推進 step,不再額外 bump
};

// 第一波 reroll 放棄 → 那局起無本命，永久關閉
WordSystem.prototype.declineSignatureCard = function() {
    this._sigResolved = true;
    this._sigCardId = null;
    this._syncSignatureRuntime();
};

// PvP / FFA：選角後自動裝 Lv1 SSR 本命（不走開場 draft）
WordSystem.prototype.autoEquipSignatureForMatch = function(brawlerType) {
    var gm = this.app && this.app.gameModeManager;
    var mode = (gm && gm.currentMode) || (this.app && this.app.gameMode) || '';
    if (String(mode).toUpperCase() === 'ROGUE') return;

    this._sigBaseBrawler = brawlerType;
    this._sigCardId = null;
    this._sigTier = 0;
    this._sigResolved = false;
    this._syncSignatureRuntime();

    var bc = window.BrawlerConfig && window.BrawlerConfig[brawlerType];
    var sigId = bc && bc.signatureCard;
    var def = sigId && window.WordConfig && window.WordConfig.cards[sigId];
    if (!def || def.retired || def.cardType !== 'effect') {
        this._sigResolved = true;
        return;
    }

    this._sigCardId = sigId;
    this._sigTier = 0;
    this._sigResolved = true;
    this._syncSignatureRuntime();
};

// 第一波是否還在「本命選擇」階段（未定案才出本命池）
WordSystem.prototype.isSignatureDraftPending = function() {
    return !this._sigResolved;
};

// 本命卡是否還能升級（未達 max）
WordSystem.prototype._sigCanUpgrade = function() {
    return this._sigIsEffect() && this._sigTier < this._sigMaxTier();
};

// 升級本命卡（抽到升級卡時呼叫）
WordSystem.prototype.upgradeSignatureCard = function(rd) {
    if (!this._sigCanUpgrade()) return false;
    this._sigTier++;
    if ((this._sigTier || 0) >= 1) this._sigBossPityDue = false;
    this._syncSignatureRuntime();
    this.reapplyBuffs && this.reapplyBuffs(rd);
    return true;
};

// Boss 波通關保底：未達 Lv2 時標記「下次波間必出覺醒卡」，不靜默升級。
WordSystem.prototype.onBossWaveCleared = function(rd) {
    if (this._sigPityDone) return;
    if (!this._sigIsEffect()) {
        this._sigPityDone = true;
        return;
    }
    this._sigPityDone = true;
    if (this._sigCanUpgrade() && (this._sigTier || 0) < 1) {
        this._sigBossPityDue = true;
    }
};

// 相容舊呼叫點（不再靜默升級）
WordSystem.prototype.trySignaturePity = function(rd) {
    return false;
};

// 把本命槽狀態同步到注入用的 runtime 欄位（_signatureCard / _sigTierLevel）
WordSystem.prototype._syncSignatureRuntime = function() {
    this._signatureCard = this._sigIsEffect() ? this._sigDef() : null;
    this._sigTierLevel = this._sigTier || 0;
};

// trigger 是否在此 comboIndex 觸發（段數軸 + 機率軸共用）
// comboIndex：0=attack1, 1=attack2, 2=attack3(末段)；-1 = super
WordSystem.prototype._triggerMatches = function(trigger, comboIndex, chance) {
    if (comboIndex === -1) {
        // 大招：僅 every_hit 或純機率軸（水淹「全攻擊」）
        if (trigger === 'every_hit') return true;
        if (trigger === 'chance') return Math.random() < (chance || 0);
        return false;
    }
    switch (trigger) {
        case 'first_in_combo': return comboIndex === 0;
        case 'second_in_combo': return comboIndex === 1;
        case 'last_in_combo':  return comboIndex === 2;
        case 'from_second':    return comboIndex >= 1;
        case 'every_hit':      return true;
        case 'first_and_last': return comboIndex === 0 || comboIndex === 2;
        case 'chance':         return Math.random() < (chance || 0);
        default:               return false;
    }
};

WordSystem.prototype._ruleWhoMatches = function(who, ownerKind) {
    who = who || 'self';
    if (who === 'self') return ownerKind === 'player';
    if (who === 'ally') return ownerKind === 'ally';
    if (who === 'team') return ownerKind === 'player' || ownerKind === 'ally';
    return false;
};

WordSystem.prototype._stunRulePasses = function(rule, comboIndex) {
    if (!rule) return false;
    if (!this._triggerMatches(rule.trigger, comboIndex, rule.chance)) return false;
    // 段數觸發另帶機率（如第2招 40%）
    if (rule.trigger !== 'chance' && rule.chance !== undefined && rule.chance < 1) {
        return Math.random() < rule.chance;
    }
    return true;
};

// 機率軸：同一命中多欄位查詢時共用一次擲骰
WordSystem.prototype._sigTriggerPass = function(tier, comboIndex) {
    if (!tier) return false;
    if (tier.trigger !== 'chance') {
        return this._triggerMatches(tier.trigger, comboIndex, tier.chance);
    }
    var card = this._signatureCard;
    var key = (card ? card.id : '') + '|' + (this._sigTierLevel || 0) + '|' + comboIndex;
    if (this._sigChanceCacheKey !== key) {
        this._sigChanceCacheKey = key;
        this._sigChanceCachePass = Math.random() < (tier.chance || 0);
    }
    return this._sigChanceCachePass;
};

// 本命暈解析。ownerKind: 'player' | 'ally'
// 回傳：undefined=不干預 | 0=接管但無暈 | >0=暈秒數
WordSystem.prototype.resolveSignatureStun = function(ownerKind, comboIndex, baseStun) {
    var card = this._signatureCard;
    if (!card || card.cardType !== 'effect') return undefined;
    if (card.effectType !== 'stun') return undefined;

    var tier = card.tiers && card.tiers[this._sigTierLevel || 0];
    if (!tier) return 0;

    var mode = this._getMode();
    if (mode === 'rogue') mode = 'pve';
    var bucket = tier[mode] || {};
    var defaultDur = (bucket.stunDuration !== undefined) ? bucket.stunDuration : 0.5;

    if (tier.stunRules && tier.stunRules.length) {
        var applicable = false;
        var best = 0;
        for (var i = 0; i < tier.stunRules.length; i++) {
            var rule = tier.stunRules[i];
            if (!this._ruleWhoMatches(rule.who, ownerKind)) continue;
            applicable = true;
            if (!this._stunRulePasses(rule, comboIndex)) continue;
            var dur;
            if (rule.useBaseStun) dur = (baseStun > 0) ? baseStun : defaultDur;
            else if (rule.duration !== undefined) dur = rule.duration;
            else dur = defaultDur;
            if (dur > best) best = dur;
        }
        // 此攻擊者沒有對應規則（如威震 Lv1 的友軍）→ 不干預
        if (!applicable) return undefined;
        return best;
    }

    // 舊格式：僅玩家，整卡單一 trigger
    if (ownerKind !== 'player') return undefined;
    if (!this._sigTriggerPass(tier, comboIndex)) return 0;
    return (bucket.stunDuration !== undefined) ? bucket.stunDuration : 0;
};

// 本命 kit 數值：角色綁定卡僅對 signature 角色；通用卡（signature:null）僅對玩家當前角色
WordSystem.prototype.getSignatureKitStat = function(brawlerType, field) {
    var card = this._signatureCard;
    if (!card || !brawlerType) return null;
    if (card.signature) {
        if (card.signature !== brawlerType) return null;
    } else {
        var playerType = this._sigBaseBrawler || this._currentBrawlerType();
        if (!playerType || brawlerType !== playerType) return null;
    }
    var tier = card.tiers && card.tiers[this._sigTierLevel || 0];
    if (!tier) return null;
    var mode = this._getMode();
    if (mode === 'rogue') mode = 'pve';
    var bucket = tier[mode] || tier.pve || {};
    return bucket[field] || null;
};

// 本命卡對某效果欄位的覆蓋值。
// D 定案：裝了本命卡 → 完全接管該 effectType；不觸發回 null（明確「這段無效果」，覆蓋 config 原生）。
//   沒裝本命卡 → 回 undefined（不干預，命中端用 config 原值）。
WordSystem.prototype.getSignatureEffect = function(effectType, field, comboIndex) {
    var card = this._signatureCard;
    if (!card || card.cardType !== 'effect') return undefined;
    if (card.effectType !== effectType) return undefined;

    // stun 走 resolveSignatureStun（支援 stunRules / 友軍）
    if (effectType === 'stun' && field === 'stunDuration') {
        var v = this.resolveSignatureStun('player', comboIndex, 0);
        if (v === undefined) return undefined;
        return v > 0 ? v : null;
    }

    var tier = card.tiers && card.tiers[this._sigTierLevel || 0];
    if (!tier) return null;
    if (!this._sigTriggerPass(tier, comboIndex)) return null;
    var mode = this._getMode();
    if (mode === 'rogue') mode = 'pve';
    var bucket = tier[mode] || {};
    if (field === 'dotConfig' && bucket.dotConfigByComboIndex) {
        var arr = bucket.dotConfigByComboIndex;
        var idx = (comboIndex === -1) ? (arr.length - 1) : comboIndex;
        if (idx < 0) idx = 0;
        if (idx >= arr.length) idx = arr.length - 1;
        var dot = arr[idx];
        return dot ? Object.assign({}, dot) : null;
    }
    var val = bucket[field];
    return (val !== undefined) ? val : null;
};

WordSystem.prototype._getCombatResolver = function() {
    if (this.app && this.app.combatResolver) return this.app.combatResolver;
    if (typeof window !== 'undefined' && window.CombatResolver) return window.CombatResolver;
    return null;
};

WordSystem.prototype.syncArmyCombatStats = function(rd, fillIfMissing) {
    var stats = this.computeCombatStats(rd);
    if (fillIfMissing && stats.shieldMaxPct > 0) {
        var pc = this.app && this.app.playerController;
        if (pc && (!pc.shieldMax || pc.shieldMax <= 0)) stats._fillShield = true;
    }
    var CR = this._getCombatResolver();
    if (CR && CR.applyArmyCombatStats) CR.applyArmyCombatStats(this.app, stats);
    return stats;
};

WordSystem.prototype._getMode = function() {
    var CR = this._getCombatResolver();
    if (CR && CR.getMode) {
        return CR.getMode(this.app);
    }
    var mode = String(this.app.gameMode || '').toUpperCase();
    return mode === 'ROGUE' ? 'rogue' : 'pve';
};

WordSystem.prototype._getStatBlock = function(def, mode) {
    if (!def) return null;
    if (mode === 'pvp' && def.pvp) return def.pvp;
    return def.pve;
};

WordSystem.prototype.isActive = function() {
    return !!(window.WordConfig && window.WordConfig.cards);
};

WordSystem.prototype.isOpeningDone = function() {
    return this._openingDone;
};

WordSystem.prototype.getOpeningStep = function() {
    return this._openingStep;
};

WordSystem.prototype.getOwnedCards = function() {
    return this._owned.slice();
};

WordSystem.prototype.getCardDef = function(cardId) {
    return (window.WordConfig && window.WordConfig.cards) ? window.WordConfig.cards[cardId] : null;
};

WordSystem.prototype._cardName = function(def) {
    if (!def) return '';
    if (window.WordConfig && typeof window.WordConfig.getName === 'function') return window.WordConfig.getName(def);
    if (typeof def.name === 'string') return def.name;
    return (def.name && def.name.zh) || def.id || '';
};

WordSystem.prototype._cardDesc = function(def) {
    if (!def) return '';
    if (window.WordConfig && typeof window.WordConfig.getCardDesc === 'function') return window.WordConfig.getCardDesc(def);
    if (typeof def.cardDesc === 'string') return def.cardDesc;
    return (def.cardDesc && def.cardDesc.zh) || '';
};

WordSystem.prototype._locText = function(v) {
    if (window.WordConfig && typeof window.WordConfig.loc === 'function') return window.WordConfig.loc(v);
    if (v == null) return '';
    if (typeof v === 'string' || typeof v === 'number') return String(v);
    if (window.TKI18n && typeof window.TKI18n.pick === 'function') return window.TKI18n.pick(v);
    if (typeof v === 'object') {
        var lang = (window.TKI18n && window.TKI18n.getLang && window.TKI18n.getLang()) || 'zh-TW';
        if (lang === 'en') return String(v.en || v.zh || v['zh-TW'] || '');
        return String(v.zh || v['zh-TW'] || v.en || '');
    }
    return '';
};

WordSystem.t = function (key, vars) {
    if (window.TKI18n && typeof window.TKI18n.t === 'function') return window.TKI18n.t(key, vars);
    return key;
};

WordSystem.prototype.t = function (key, vars) {
    return WordSystem.t(key, vars);
};

WordSystem.prototype.getFactionMeta = function(factionKey) {
    return (window.WordConfig && window.WordConfig.factions) ? window.WordConfig.factions[factionKey] : null;
};

WordSystem.prototype.canAddCard = function() {
    return this._owned.length < this.getMaxHandCards();
};

/** 手牌上限：有效果本命時 4；未選／普通卡當本命時 5（補償本命槽） */
WordSystem.prototype.getMaxHandCards = function() {
    var base = (window.WordConfig && window.WordConfig.maxCards) ? window.WordConfig.maxCards : 4;
    if (this._sigIsEffect()) return base;
    if (this._sigResolved) return base + 1;
    return base;
};

WordSystem.prototype.hasCard = function(cardId) {
    return this._owned.indexOf(cardId) >= 0;
};

WordSystem.prototype.getUpgradeLevel = function(cardId) {
    var def = this.getCardDef(cardId);
    // 學派收尾：等級以 _finisherLevels 為準（手牌／共鳴吸收後共用）
    if (def && def.schoolFinisher && def.faction) {
        var fl = (this._finisherLevels && this._finisherLevels[def.faction]) || 0;
        var cl = this._levels[cardId] || 0;
        return Math.max(fl, cl);
    }
    return this._levels[cardId] || 0;
};

WordSystem.prototype._maxFinisherRefine = function() {
    return (window.WordConfig && window.WordConfig.maxFinisherRefine !== undefined)
        ? window.WordConfig.maxFinisherRefine : 2;
};

WordSystem.prototype.getFinisherLevel = function(faction) {
    return (this._finisherLevels && this._finisherLevels[faction]) || 0;
};

/** 共鳴吸收後仍可當「普通精煉」目標的收尾卡 id（不在手牌） */
WordSystem.prototype.getVirtualFinisherRefineIds = function() {
    var out = [];
    var sf = window.WordConfig && window.WordConfig.schoolFinishers;
    if (!sf) return out;
    for (var f in sf) {
        if (!this.canUpgradeResonanceFinisher(f)) continue;
        var ents = (sf[f] && sf[f].entityCardIds) || [];
        if (ents.length && !this.hasCard(ents[0])) out.push(ents[0]);
    }
    return out;
};

/** 無實體收尾（續燃）是否仍可用普通精煉卡升級 */
WordSystem.prototype.canRefineSlotlessFinisher = function(faction) {
    var meta = this._finisherMeta(faction);
    if (!meta) return false;
    var ents = meta.entityCardIds || [];
    if (ents.length) return false;
    return this.canUpgradeResonanceFinisher(faction);
};

// 精煉是否還有實質加成（滿級 / 無變化則 false）
WordSystem.prototype.canUpgradeCard = function(cardId, rd) {
    var def = this.getCardDef(cardId);
    if (!def) return false;

    // 收尾卡：手牌或共鳴吸收後的虛擬精煉（無精煉上限）
    if (def.schoolFinisher && def.faction) {
        if (this.hasCard(cardId)) return true;
        return this.canUpgradeResonanceFinisher(def.faction);
    }

    if (!this.hasCard(cardId)) return false;
    var level = this.getUpgradeLevel(cardId);
    var parts = this.formatUpgradeCardParts(def, level, rd);
    if (parts && parts.capped) return false;
    if (def.rapidTiers && level >= def.rapidTiers.length - 1) return false;
    if (def.breakTiers && level >= def.breakTiers.length - 1) return false;
    if (def.poiseTiers && level >= def.poiseTiers.length - 1) return false;
    if (def.poiseTiers && level < def.poiseTiers.length - 1) return true;
    if (def.benevolenceTiers && level >= def.benevolenceTiers.length - 1) return false;
    if (def.procTriggerUnlock && level >= 1) return false;
    var nowH = this.formatCardEffectHeadline(def, level, rd);
    var nextH = this.formatCardEffectHeadline(def, level + 1, rd);
    if (nowH && nextH && nowH === nextH) return false;
    return true;
};

WordSystem.prototype.getUpgradeableOwnedIds = function(rd) {
    var out = [];
    var seen = {};
    for (var i = 0; i < this._owned.length; i++) {
        var oid = this._owned[i];
        if (this.canUpgradeCard(oid, rd)) {
            out.push(oid);
            seen[oid] = true;
        }
    }
    // 共鳴吸收後：仍以實體收尾卡的「普通精煉」出現（不另出共鳴卡）
    var virt = this.getVirtualFinisherRefineIds();
    for (var v = 0; v < virt.length; v++) {
        if (!seen[virt[v]] && this.canUpgradeCard(virt[v], rd)) {
            out.push(virt[v]);
            seen[virt[v]] = true;
        }
    }
    return out;
};

/** 共鳴收尾是否仍可精煉（不佔手牌）——供虛擬普通精煉／無實體續燃共用 */
WordSystem.prototype.canUpgradeResonanceFinisher = function(faction) {
    var meta = this._finisherMeta(faction);
    if (!meta) return false;
    var prog = this.getResonanceProgress(faction);
    if (!prog.active && this.countSchoolCards(faction) < 2) {
        // 術系續燃也可由符咒精煉解鎖，解鎖後仍可再強化收尾層
        if (meta.effectKey === 'fireSustain') {
            var minLv = window.WordConfig.fireSustainSigilMinLevel;
            if (minLv === undefined) minLv = 1;
            if (!(this.hasCard('shu_sigil_n') && this.getUpgradeLevel('shu_sigil_n') >= minLv)) return false;
        } else {
            return false;
        }
    }
    // 實體收尾若仍佔手牌，改走該卡精煉（getUpgradeableOwnedIds），此處不重複
    var ents = meta.entityCardIds || [];
    for (var i = 0; i < ents.length; i++) {
        if (this.hasCard(ents[i])) return false;
    }
    return true;
};

WordSystem.prototype.getUpgradeableResonanceFactions = function() {
    var out = [];
    var sf = window.WordConfig && window.WordConfig.schoolFinishers;
    if (!sf) return out;
    for (var f in sf) {
        if (this.canUpgradeResonanceFinisher(f)) out.push(f);
    }
    return out;
};

WordSystem.prototype.formatResonanceUpgradeParts = function(faction) {
    var meta = this._finisherMeta(faction);
    if (!meta) return { headline: '', detail: '' };
    var lv = this.getFinisherLevel(faction);
    var next = lv + 1;
    var label = this._locText(meta.label) || faction;
    // 有實體卡時走實體卡描述（含正確精煉數值）；無實體（續燃）用收尾倍率描述
    var ents = meta.entityCardIds || [];
    if (ents.length) {
        var entDef = this.getCardDef(ents[0]);
        if (entDef) return this.formatUpgradeCardParts(entDef, lv, null);
    }
    var scaleNow = this._finisherEffectScale(faction);
    var scaleNext = 1 + next * ((window.WordConfig && window.WordConfig.upgradeBonusPerLevel) || 0.5);
    var headline = this.t('word.fx.finisherBoost', { label: label });
    var detail = this.t('word.fx.finisherRefine', { now: lv, next: next });
    if (meta.effectKey === 'fireSustain') {
        var fe = window.WordConfig.finisherEffects && window.WordConfig.finisherEffects.fireSustain;
        var fs = fe ? (fe.pve || fe) : null;
        var ext = fs && fs.extendSec ? fs.extendSec : 0.35;
        var softNow = scaleNow > 1 ? (0.7 + 0.3 * scaleNow) : 1;
        var softNext = scaleNext > 1 ? (0.7 + 0.3 * scaleNext) : 1;
        var extNow = Math.round(ext * softNow * 100) / 100;
        var extNext = Math.round(ext * softNext * 100) / 100;
        var burnPctNext = Math.round((scaleNext - 1) * 100);
        var burnPctNow = Math.round((scaleNow - 1) * 100);
        headline = this.t('word.fx.sustainRefine', { sec: extNext, n: burnPctNext });
        detail = this.t('word.fx.sustainRefineNow', { sec: extNow, n: burnPctNow, lv: next });
    }
    return { headline: headline, detail: detail };
};

WordSystem.prototype.upgradeResonanceFinisher = function(faction, rd) {
    if (!this.canUpgradeResonanceFinisher(faction)) return false;
    this._bumpFinisherLevel(faction);
    return this.reapplyBuffs(rd);
};

WordSystem.prototype.countAliveAllies = function(rd) {
    if (!rd || !rd.squad) return 0;
    var n = 0;
    for (var i = 0; i < rd.squad.length; i++) {
        if (!rd.squad[i].dead) n++;
    }
    return n;
};

/** 構築編制人數（含陣亡）— 結算／HUD 總加成用 */
WordSystem.prototype.countRosterAllies = function(rd) {
    if (!rd || !rd.squad) return 0;
    return rd.squad.length;
};

WordSystem.prototype._allyRoleOfMember = function(rd, member) {
    if (!member) return '';
    var bCtrl = rd && rd._getBotCtrl ? rd._getBotCtrl() : null;
    if (bCtrl && bCtrl.bots) {
        for (var b = 0; b < bCtrl.bots.length; b++) {
            var bot = bCtrl.bots[b];
            if (bot.id === member.botId) return bot._allyRole || '';
        }
    }
    var cfg = (member.bType && window.BrawlerConfig) ? window.BrawlerConfig[member.bType] : null;
    return (cfg && cfg.allyRole) || '';
};

WordSystem.prototype.countVanguardAllies = function(rd) {
    if (!rd || !rd.squad) return 0;
    var n = 0;
    for (var i = 0; i < rd.squad.length; i++) {
        if (rd.squad[i].dead) continue;
        if (this._allyRoleOfMember(rd, rd.squad[i]) === 'vanguard') n++;
    }
    return n;
};

/** 編制內先鋒數（含陣亡） */
WordSystem.prototype.countRosterVanguardAllies = function(rd) {
    if (!rd || !rd.squad) return 0;
    var n = 0;
    for (var i = 0; i < rd.squad.length; i++) {
        if (this._allyRoleOfMember(rd, rd.squad[i]) === 'vanguard') n++;
    }
    return n;
};

WordSystem.prototype._upgradeBonusPerLevel = function() {
    return (window.WordConfig && window.WordConfig.upgradeBonusPerLevel !== undefined)
        ? window.WordConfig.upgradeBonusPerLevel : 0.5;
};

WordSystem.prototype._effectScaleForLevel = function(level) {
    return 1 + (level || 0) * this._upgradeBonusPerLevel();
};

WordSystem.prototype._effectScale = function(cardId) {
    var def = this.getCardDef(cardId);
    // 成長核心（如符咒）：強度由精煉階決定，不再套用通用 upgradeBonus 乘算
    if (def && def.growthCore) return 1;
    // 收尾卡：與共鳴層共用等級
    if (def && def.schoolFinisher && def.faction) {
        return this._effectScaleForLevel(this.getUpgradeLevel(cardId));
    }
    return this._effectScaleForLevel(this._levels[cardId] || 0);
};

// 戰術系標籤（武·猛將）— 與武將魏蜀吳群國籍無關
WordSystem.prototype.getSchoolLabel = function(def) {
    if (!def) return '';
    var fac = this.getFactionMeta(def.faction);
    if (!fac) return '';
    var label = (window.WordConfig && WordConfig.getFactionSeal)
        ? WordConfig.getFactionSeal(def.faction)
        : this._locText(fac.label);
    // 副標已移除,只顯示單字流派印(武/守/疾/術)
    return fac.sub ? (label + '·' + fac.sub) : label;
};

// 屬性類型（傷害 / 生存 / 移速…）
WordSystem.prototype.getEffectTypeLabel = function(def) {
    if (!def || !def.line) return 'WORD';
    return WordSystem.LINE_LABELS[def.line] || 'WORD';
};

WordSystem.prototype._procTriggerTierAt = function(def, level) {
    if (!def || !def.procTriggerTiers || def.procTriggerTiers.length === 0) return null;
    var idx = level || 0;
    if (idx >= def.procTriggerTiers.length) idx = def.procTriggerTiers.length - 1;
    return def.procTriggerTiers[idx];
};

// 單行效果(HUD build / 精煉行共用)
WordSystem.prototype.formatCardEffectLine = function(def, level, rd) {
    if (!def) return '';
    var procTier = this._procTriggerTierAt(def, level);
    if (procTier) return this._locText(procTier.desc) || this._cardDesc(def) || this._cardName(def);
    if (def.procTriggerUnlock) {
        return this._cardDesc(def) || this._cardName(def);
    }
    if (def.procSpreadCount) {
        var spread = Math.min(def.procSpreadMax || 3, def.procSpreadCount + (level || 0));
        return this.t('word.detail.spread', { n: spread });
    }
    var block = this._getStatBlock(def, this._getMode());
    if (!block) return this._cardDesc(def) || '';

    var scale = this._effectScaleForLevel(level);
    var allies = rd ? this.countAliveAllies(rd) : 0;
    var vanguards = rd ? this.countVanguardAllies(rd) : 0;

    if (block.onBasicProc) {
        var procPct = Math.round((block.onBasicProc.damagePct || 0.35) * 100 * scale);
        return '首段連擊：+' + procPct + '% 法術彈 + 灼燒';
    }
    if (block.execute) {
        var exPct = Math.round((block.execute.bonusDmg || 0) * 100 * scale);
        var exThr = Math.round((block.execute.threshold || 0.25) * 100);
        return '對殘血(' + exThr + '% 以下)+' + exPct + '% 傷害';
    }
    if (block.onKill && block.onKill.refreshBasicAttack) {
        var stkPct = Math.round((block.onKill.dmgStack || 0) * 100 * scale);
        return this.t('word.fx.killResetLine', { n: stkPct, m: block.onKill.maxStacks || 3 });
    }
    if (block.hpLostScaling) {
        var per = Math.round(block.hpLostScaling.dmgPerStep * 100 * scale);
        var capPct = Math.round((block.hpLostScaling.cap || 0) * 100);
        return '每損失 10% 血 +' + per + '% 傷害(上限 +' + capPct + '%)';
    }
    if (block.onLowHp) {
        var lowDmg = Math.round(((block.onLowHp.dmgMul || 1) - 1) * 100 * scale);
        var lowThr = Math.round((block.onLowHp.threshold || 0.4) * 100);
        return '血量低於 ' + lowThr + '%：+' + lowDmg + '% 傷害';
    }
    if (block.aura && block.aura.damageTakenMul) {
        var dr = Math.round((1 - block.aura.damageTakenMul) * 100 * scale);
        return (block.aura.radius || 8) + ' 公尺內友軍 -' + dr + '% 受傷';
    }
    if (block.perAlly && block.perAlly.procDamagePct) {
        var perAllyPct = Math.round(block.perAlly.procDamagePct * 100 * scale);
        if (allies > 0) {
            return this.t('word.fx.procDmg', { n: Math.round(block.perAlly.procDamagePct * allies * 100 * scale) }) +
                ' (' + allies + ')';
        }
        return this.t('word.fx.perAllyProc', { n: perAllyPct });
    }
    if (block.dodgeChance && block.speedMul) {
        return this.t('word.fx.dodge', { n: Math.round(block.dodgeChance * 100 * scale) }) +
            ', ' + this.t('word.fx.spd', { n: Math.round((block.speedMul - 1) * 100 * scale) });
    }

    if (block.dmgMul) return this.t('word.fx.armyDmg', { n: Math.round((block.dmgMul - 1) * 100 * scale) });
    if (block.hpMul) return this.t('word.fx.armyHp', { n: Math.round((block.hpMul - 1) * 100 * scale) });
    if (block.speedMul) return this.t('word.fx.spd', { n: Math.round((block.speedMul - 1) * 100 * scale) });
    if (block.reloadMul) return this.t('word.fx.reload', { n: Math.round((block.reloadMul - 1) * 100 * scale) });
    if (block.damageTakenMul) return this.t('word.fx.taken', { n: Math.round((1 - block.damageTakenMul) * 100 * scale) });
    if (block.dotMul) return this.t('word.fx.dot', { n: Math.round((block.dotMul - 1) * 100 * scale) });
    if (block.ccDurationMul) return this.t('word.fx.cc', { n: Math.round((block.ccDurationMul - 1) * 100 * scale) });
    if (block.shieldMaxPct) return this.t('word.fx.shield', { n: Math.round(block.shieldMaxPct * 100 * scale) });
    if (block.bonusVsShield) return this.t('word.fx.vsShield', { n: Math.round(block.bonusVsShield * 100 * scale) });
    if (block.critChance && block.dodgeChance) {
        return this.t('word.fx.dodgeCrit', { n: Math.round(block.dodgeChance * 100 * scale), m: Math.round(block.critChance * 100 * scale) });
    }
    if (block.critChance) return this.t('word.fx.crit', { n: Math.round(block.critChance * 100 * scale) });
    if (block.dodgeChance) return this.t('word.fx.dodge', { n: Math.round(block.dodgeChance * 100 * scale) });

    if (block.perAlly && block.perAlly.dmgMul) {
        var d = Math.round(block.perAlly.dmgMul * allies * 100 * scale);
        return this.t('word.fx.allyDmg', { n: d, a: allies });
    }
    if (block.perAlly && block.perAlly.hpMul) {
        var h = Math.round(block.perAlly.hpMul * allies * 100 * scale);
        return this.t('word.fx.allyHp', { n: h, a: allies });
    }
    if (block.perAlly && block.perAlly.dotMul) {
        var dt = Math.round(block.perAlly.dotMul * allies * 100 * scale);
        return this.t('word.fx.allyDot', { n: dt, a: allies });
    }
    if (block.perAllyRole && block.perAllyRole.vanguard && block.perAllyRole.vanguard.speedMul) {
        var s = Math.round(block.perAllyRole.vanguard.speedMul * vanguards * 100 * scale);
        return this.t('word.fx.vangSpd', { n: s, a: vanguards });
    }
    if (block.poiseCharge) {
        var poLinePct = Math.round((block.poiseCharge.peakBonus || 0.28) * 100 * scale);
        var poLineR = block.poiseCharge.combatRange || 10;
        return this.t('word.fx.poiseLine', { r: poLineR, n: poLinePct });
    }
    return this._cardDesc(def) || '';
};

// 選卡卡片:主行(headline)+ 補充(detail) — i18n via t()/_locText
// i18n-fx-stamp: 2026-07-24-rapid-detail-t
WordSystem.prototype.formatCardEffectParts = function(def, level, rd) {
    if (!def) return { headline: '', detail: '' };
    // 效果本命／通用本命：用當前 tier 文案
    if (def.cardType === 'effect' && def.tiers && def.tiers.length) {
        var tIdx = level || 0;
        if (tIdx >= def.tiers.length) tIdx = def.tiers.length - 1;
        var t = def.tiers[tIdx];
        return {
            headline: (t && t.desc) ? this._locText(t.desc) : (this._cardDesc(def) || this._cardName(def)),
            detail: this._cardDesc(def)
        };
    }
    var procTier = this._procTriggerTierAt(def, level);
    if (procTier) {
        var sustainHint = '';
        if (def.id === 'shu_sigil_n') {
            var minLv = (window.WordConfig && window.WordConfig.fireSustainSigilMinLevel !== undefined)
                ? window.WordConfig.fireSustainSigilMinLevel : 1;
            if ((level || 0) >= minLv) sustainHint = this.t('word.fx.sustainOn');
            else sustainHint = this.t('word.fx.sustainOff');
        }
        return {
            headline: this._locText(procTier.desc) || this._cardDesc(def) || this._cardName(def),
            detail: (level > 0
                ? this.t('word.detail.refineLv', { n: level })
                : this.t('word.detail.refineExpand')) + sustainHint
        };
    }
    if (def.rapidTiers) {
        var rIdx = level || 0;
        if (rIdx >= def.rapidTiers.length) rIdx = def.rapidTiers.length - 1;
        var rt = def.rapidTiers[rIdx];
        return {
            headline: (rt && rt.desc) ? this._locText(rt.desc) : (this._cardDesc(def) || this._cardName(def)),
            detail: rIdx < def.rapidTiers.length - 1
                ? this.t('word.detail.refineReload')
                : this.t('word.capped.max')
        };
    }
    if (def.breakTiers) {
        var bIdx = level || 0;
        if (bIdx >= def.breakTiers.length) bIdx = def.breakTiers.length - 1;
        var bt = def.breakTiers[bIdx];
        return {
            headline: (bt && bt.desc) ? this._locText(bt.desc) : (this._cardDesc(def) || this._cardName(def)),
            detail: bIdx < def.breakTiers.length - 1
                ? this.t('word.detail.refineShield')
                : this.t('word.capped.max')
        };
    }
    if (def.poiseTiers) {
        var pIdx = level || 0;
        if (pIdx >= def.poiseTiers.length) pIdx = def.poiseTiers.length - 1;
        var pt = def.poiseTiers[pIdx];
        var poBlock = this._getStatBlock(def, this._getMode());
        var poPct = poBlock && poBlock.poiseCharge
            ? Math.round((poBlock.poiseCharge.peakBonus || 0.28) * 100) : 28;
        return {
            headline: (pt && pt.desc) ? this._locText(pt.desc) : this.t('word.fx.poisePeak', { n: poPct }),
            detail: this.t('word.fx.poiseDetailShort', { n: poPct })
        };
    }
    if (def.benevolenceTiers) {
        var bnIdx = level || 0;
        if (bnIdx >= def.benevolenceTiers.length) bnIdx = def.benevolenceTiers.length - 1;
        var bnt = def.benevolenceTiers[bnIdx];
        return {
            headline: (bnt && bnt.desc) ? this._locText(bnt.desc) : (this._cardDesc(def) || this._cardName(def)),
            detail: bnIdx < def.benevolenceTiers.length - 1
                ? this.t('word.detail.refineGeneric')
                : this.t('word.capped.max')
        };
    }
    if (def.procTriggerUnlock) {
        var trigDetail = {
            from_second: this.t('word.fx.trigFromSecond'),
            last_in_combo: this.t('word.fx.trigLastHit')
        };
        return {
            headline: this._cardDesc(def) || this._cardName(def),
            detail: trigDetail[def.procTriggerUnlock] || ''
        };
    }
    if (def.procSpreadCount) {
        var lv = level || 0;
        var spread = Math.min(def.procSpreadMax || 3, def.procSpreadCount + lv);
        return {
            headline: this.t('word.detail.spread', { n: spread }),
            detail: lv > 0
                ? this.t('word.fx.spreadRefine', { n: lv })
                : this.t('word.fx.spreadCap', { n: def.procSpreadMax || 3 })
        };
    }
    var block = this._getStatBlock(def, this._getMode());
    if (!block) {
        var fallback = this._cardDesc(def);
        if (!fallback) return { headline: '', detail: '' };
        var splitAt = fallback.indexOf('（');
        if (splitAt > 0 && splitAt < 48) {
            return { headline: fallback.slice(0, splitAt), detail: fallback.slice(splitAt + 1).replace(/）$/, '') };
        }
        return { headline: fallback, detail: '' };
    }

    var scale = this._effectScaleForLevel(level);
    var allies = rd ? this.countAliveAllies(rd) : 0;
    var vanguards = rd ? this.countVanguardAllies(rd) : 0;
    // scaling 卡:選卡當下看不到實際值,提示會隨編制成長(不寫死滿編數字,保留彈性)
    var scalingHint = def.type === 'scaling' ? this.t('word.detail.scaling') : '';

    if (block.onBasicProc) {
        var procPct = Math.round((block.onBasicProc.damagePct || 0.35) * 100 * scale);
        return {
            headline: this.t('word.fx.basicProc', { n: procPct }),
            detail: this.t('word.fx.basicProcDetail')
        };
    }
    if (block.execute) {
        var exPct = Math.round((block.execute.bonusDmg || 0) * 100 * scale);
        var exThr = Math.round((block.execute.threshold || 0.25) * 100);
        var cdSec = Math.round((block.execute.cooldownMs || 8000) / 1000);
        return {
            headline: this.t('word.fx.execute', { n: exPct }),
            detail: this.t('word.fx.executeDetail', { thr: exThr, sec: cdSec })
        };
    }
    if (block.breachWindow) {
        var brPct = Math.round((block.breachWindow.bonusDmg || 0.3) * 100 * scale);
        var brSec = Math.round((block.breachWindow.durationMs || 2000) / 100) / 10;
        var hasDot = !!(block.breachWindow.markOnDot && block.breachWindow.markOnDot.length);
        return {
            headline: this.t('word.fx.breach', { n: brPct }),
            detail: this.t('word.fx.breachDetail', {
                sec: brSec,
                conds: this.t(hasDot ? 'word.fx.breachCondsFull' : 'word.fx.breachCondsBasic')
            })
        };
    }
    if (block.scaleCounter) {
        var scPer = Math.round((block.scaleCounter.perStackBonus || block.scaleCounter.nextHitDmgBonus || 0.25) * 100 * scale);
        var scMax = block.scaleCounter.maxStacks || 3;
        return {
            headline: this.t('word.fx.scale', { n: scPer }),
            detail: this.t('word.fx.scaleDetail', { n: scMax })
        };
    }
    if (block.windReturn) {
        var wrPct = Math.round((block.windReturn.nextHitDmgBonus || 0.25) * 100 * scale);
        return {
            headline: this.t('word.fx.windReturn', { n: wrPct }),
            detail: this.t('word.fx.windReturnDetail')
        };
    }
    if (block.poiseCharge) {
        var poPct2 = Math.round((block.poiseCharge.peakBonus || 0.28) * 100 * scale);
        var poSec = block.poiseCharge.maxSec || 1.5;
        var soft = block.poiseCharge.softSec || 0.4;
        return {
            headline: this.t('word.fx.poisePeak', { n: poPct2 }),
            detail: this.t('word.fx.poiseDetail', { sec: poSec, soft: soft })
        };
    }
    if (block.shieldBreakRetaliation) {
        var srPct = Math.round((block.shieldBreakRetaliation.shieldMaxPct || 0.45) * 100);
        return {
            headline: this.t('word.fx.shieldRetaliate', { n: srPct }),
            detail: this.t('word.fx.shieldRetaliateDetail')
        };
    }
    if (block.shieldBreakBurst) {
        var sbPct = Math.round((block.shieldBreakBurst.nextHitDmgBonus || 0.4) * 100 * scale);
        return {
            headline: this.t('word.fx.shieldBurst', { n: sbPct }),
            detail: this.t('word.fx.shieldBurstDetail')
        };
    }
    if (block.chainHarvest) {
        var chPct = Math.round((block.chainHarvest.bonusDmg || 0.35) * 100 * scale);
        return {
            headline: this.t('word.fx.chainHarvest', { n: chPct }),
            detail: this.t('word.fx.chainHarvestDetail')
        };
    }
    if (block.emberDetonate) {
        var emPct = Math.round((block.emberDetonate.remainingPct || 0.6) * 100);
        var spPct = Math.round((block.emberDetonate.splashPct || 0.35) * 100);
        return {
            headline: this.t('word.fx.ember', { n: emPct }),
            detail: this.t('word.fx.emberDetail', { n: spPct })
        };
    }
    if (block.onKill && block.onKill.refreshBasicAttack) {
        var stkPct = Math.round((block.onKill.dmgStack || 0) * 100 * scale);
        return {
            headline: this.t('word.fx.killReset', { n: stkPct }),
            detail: this.t('word.fx.killResetDetail', { n: block.onKill.maxStacks || 3 })
        };
    }
    if (block.hpLostScaling) {
        var perStep = Math.round(block.hpLostScaling.dmgPerStep * 100 * scale);
        var capPct = Math.round((block.hpLostScaling.cap || 0) * 100);
        return {
            headline: this.t('word.fx.hpLost', { n: capPct }),
            detail: this.t('word.fx.hpLostDetail', { n: perStep })
        };
    }
    if (block.onLowHp) {
        var lowDmg = Math.round(((block.onLowHp.dmgMul || 1) - 1) * 100 * scale);
        var lowThr = Math.round((block.onLowHp.threshold || 0.4) * 100);
        var taken = block.onLowHp.damageTakenMul ? Math.round((block.onLowHp.damageTakenMul - 1) * 100 * scale) : 0;
        return {
            headline: this.t('word.fx.lowHp', { thr: lowThr, n: lowDmg }),
            detail: taken > 0 ? this.t('word.fx.lowHpCost', { n: taken }) : ''
        };
    }
    if (block.aura && block.aura.damageTakenMul) {
        var dr = Math.round((1 - block.aura.damageTakenMul) * 100 * scale);
        var auraR = block.aura.radius || 8;
        var lsDetail = (block.lifestealPct > 0)
            ? this.t('word.fx.lifestealSelf', { n: Math.round(block.lifestealPct * 1000) / 10 })
            : '';
        return {
            headline: this.t('word.fx.auraDr', { n: dr }),
            detail: this.t('word.fx.auraDetail', { r: auraR }) + (lsDetail ? ' · ' + lsDetail : '')
        };
    }
    if (block.perAlly && block.perAlly.procDamagePct) {
        var perProc = Math.round(block.perAlly.procDamagePct * 100 * scale);
        if (allies > 0) {
            return {
                headline: this.t('word.fx.procDmg', { n: Math.round(block.perAlly.procDamagePct * allies * 100 * scale) }),
                detail: this.t('word.fx.alliesNow', { n: allies })
            };
        }
        return { headline: this.t('word.fx.perAllyProc', { n: perProc }), detail: scalingHint };
    }
    if (block.dodgeChance && block.speedMul) {
        return {
            headline: this.t('word.fx.dodge', { n: Math.round(block.dodgeChance * 100 * scale) }),
            detail: this.t('word.fx.spd', { n: Math.round((block.speedMul - 1) * 100 * scale) })
        };
    }

    if (block.dmgMul) return { headline: this.t('word.fx.armyDmg', { n: Math.round((block.dmgMul - 1) * 100 * scale) }), detail: scalingHint };
    if (block.hpMul) return { headline: this.t('word.fx.armyHp', { n: Math.round((block.hpMul - 1) * 100 * scale) }), detail: scalingHint };
    if (block.speedMul) return { headline: this.t('word.fx.spd', { n: Math.round((block.speedMul - 1) * 100 * scale) }), detail: scalingHint };
    if (block.reloadMul) return { headline: this.t('word.fx.reload', { n: Math.round((block.reloadMul - 1) * 100 * scale) }), detail: scalingHint };
    if (block.damageTakenMul) return { headline: this.t('word.fx.taken', { n: Math.round((1 - block.damageTakenMul) * 100 * scale) }), detail: scalingHint };
    if (block.dotMul) return { headline: this.t('word.fx.dot', { n: Math.round((block.dotMul - 1) * 100 * scale) }), detail: scalingHint };
    if (block.ccDurationMul) return { headline: this.t('word.fx.cc', { n: Math.round((block.ccDurationMul - 1) * 100 * scale) }), detail: scalingHint };
    if (block.shieldMaxPct) return { headline: this.t('word.fx.shield', { n: Math.round(block.shieldMaxPct * 100 * scale) }), detail: '' };
    if (block.bonusVsShield) {
        var brk = block.onShieldBreakDmgPct ? Math.round(block.onShieldBreakDmgPct * 100 * scale) : 0;
        return {
            headline: this.t('word.fx.vsShield', { n: Math.round(block.bonusVsShield * 100 * scale) }),
            detail: brk > 0 ? this.t('word.fx.vsShield', { n: brk }) : ''
        };
    }
    if (block.critChance && block.dodgeChance) {
        return {
            headline: this.t('word.fx.crit', { n: Math.round(block.critChance * 100 * scale) }),
            detail: this.t('word.fx.dodge', { n: Math.round(block.dodgeChance * 100 * scale) })
        };
    }
    if (block.critChance && block.critMul) {
        var CR = this._getCombatResolver();
        var baseCrit = (CR && CR.DEFAULT_CRIT_MUL) ? CR.DEFAULT_CRIT_MUL : 1.5;
        var mergedCrit = 1 + (baseCrit - 1) + (block.critMul - 1) * scale;
        var mergedStr = (Math.round(mergedCrit * 100) / 100).toFixed(1);
        return {
            headline: this.t('word.fx.crit', { n: Math.round(block.critChance * 100 * scale) }),
            detail: this.t('word.fx.critMul', { from: baseCrit, to: mergedStr })
        };
    }
    // 爆擊 + 減速(hamstring):補上原本漏顯示的減速效果
    if (block.critChance) {
        var snareDetail = '';
        if (def.onCrit && def.onCrit.snareDuration) {
            var snarePct = Math.round((1 - (def.onCrit.snareMultiplier || 0.7)) * 100);
            snareDetail = this.t('word.fx.critSnare', { n: snarePct, sec: def.onCrit.snareDuration });
        }
        return { headline: this.t('word.fx.crit', { n: Math.round(block.critChance * 100 * scale) }), detail: snareDetail };
    }
    if (block.dodgeChance) return { headline: this.t('word.fx.dodge', { n: Math.round(block.dodgeChance * 100 * scale) }), detail: '' };

    if (block.perAlly && block.perAlly.dmgMul) {
        var dRate = Math.round(block.perAlly.dmgMul * 100 * scale);
        if (allies > 0) {
            return {
                headline: this.t('word.fx.armyDmg', { n: Math.round(block.perAlly.dmgMul * allies * 100 * scale) }),
                detail: this.t('word.fx.alliesNow', { n: allies })
            };
        }
        return { headline: this.t('word.fx.perAllyDmg', { n: dRate }), detail: scalingHint };
    }
    if (block.perAlly && block.perAlly.hpMul) {
        var hRate = Math.round(block.perAlly.hpMul * 100 * scale);
        if (allies > 0) {
            return {
                headline: this.t('word.fx.armyHp', { n: Math.round(block.perAlly.hpMul * allies * 100 * scale) }),
                detail: this.t('word.fx.alliesNow', { n: allies })
            };
        }
        return { headline: this.t('word.fx.perAllyHp', { n: hRate }), detail: scalingHint };
    }
    if (block.perAlly && block.perAlly.dotMul) {
        if (allies > 0) {
            return {
                headline: this.t('word.fx.dot', { n: Math.round(block.perAlly.dotMul * allies * 100 * scale) }),
                detail: this.t('word.fx.alliesNow', { n: allies })
            };
        }
        return { headline: this.t('word.fx.perAllyDot', { n: Math.round(block.perAlly.dotMul * 100 * scale) }), detail: scalingHint };
    }
    if (block.perAllyRole && block.perAllyRole.vanguard && block.perAllyRole.vanguard.speedMul) {
        if (vanguards > 0) {
            return {
                headline: this.t('word.fx.spd', { n: Math.round(block.perAllyRole.vanguard.speedMul * vanguards * 100 * scale) }),
                detail: this.t('word.fx.vangsNow', { n: vanguards })
            };
        }
        return {
            headline: this.t('word.fx.perVangSpd', { n: Math.round(block.perAllyRole.vanguard.speedMul * 100 * scale) }),
            detail: scalingHint
        };
    }

    return { headline: this._cardDesc(def), detail: '' };
};

WordSystem.prototype.formatCardEffectHeadline = function(def, level, rd) {
    return this.formatCardEffectParts(def, level, rd).headline;
};

WordSystem.prototype.formatCardEffectDetail = function(def, level, rd) {
    return this.formatCardEffectParts(def, level, rd).detail;
};

WordSystem.prototype.formatUpgradeCardParts = function(def, level, rd) {
    if (!def) return { headline: '', detail: '', capped: false };
    var name = this._cardName(def);
    if (def.procTriggerTiers) {
        var nowT = this._procTriggerTierAt(def, level);
        var nextT = this._procTriggerTierAt(def, level + 1);
        if (!nextT || !nowT || nowT.desc === nextT.desc) {
            return { headline: nowT ? this._locText(nowT.desc) : name, detail: this.t('word.capped.segments'), capped: true };
        }
        return {
            headline: this._locText(nextT.desc),
            detail: this.t('word.detail.nowRefine', { now: this._locText(nowT.desc), n: level + 1 }),
            capped: false
        };
    }
    if (def.breakTiers) {
        var nowB = def.breakTiers[Math.min(level || 0, def.breakTiers.length - 1)];
        var nextB = def.breakTiers[Math.min((level || 0) + 1, def.breakTiers.length - 1)];
        if (!nextB || !nowB || ((level || 0) >= def.breakTiers.length - 1)) {
            return { headline: nowB ? this._locText(nowB.desc) : name, detail: this.t('word.capped.max'), capped: true };
        }
        return {
            headline: this._locText(nextB.desc),
            detail: this.t('word.detail.nowRefine', { now: this._locText(nowB.desc), n: level + 1 }),
            capped: false
        };
    }
    if (def.poiseTiers) {
        var nowP = def.poiseTiers[Math.min(level || 0, def.poiseTiers.length - 1)];
        var nextP = def.poiseTiers[Math.min((level || 0) + 1, def.poiseTiers.length - 1)];
        if (!nextP || !nowP || ((level || 0) >= def.poiseTiers.length - 1)) {
            return { headline: nowP ? this._locText(nowP.desc) : name, detail: this.t('word.capped.max'), capped: true };
        }
        return {
            headline: this._locText(nextP.desc),
            detail: this.t('word.detail.nowRefine', { now: this._locText(nowP.desc), n: level + 1 }),
            capped: false
        };
    }
    if (def.benevolenceTiers) {
        var nowBn = def.benevolenceTiers[Math.min(level || 0, def.benevolenceTiers.length - 1)];
        var nextBn = def.benevolenceTiers[Math.min((level || 0) + 1, def.benevolenceTiers.length - 1)];
        if (!nextBn || !nowBn || ((level || 0) >= def.benevolenceTiers.length - 1)) {
            return { headline: nowBn ? this._locText(nowBn.desc) : name, detail: this.t('word.capped.max'), capped: true };
        }
        return {
            headline: this._locText(nextBn.desc),
            detail: this.t('word.detail.nowRefine', { now: this._locText(nowBn.desc), n: level + 1 }),
            capped: false
        };
    }
    if (def.rapidTiers) {
        var nowR = def.rapidTiers[Math.min(level || 0, def.rapidTiers.length - 1)];
        var nextR = def.rapidTiers[Math.min((level || 0) + 1, def.rapidTiers.length - 1)];
        if (!nextR || !nowR || ((level || 0) >= def.rapidTiers.length - 1)) {
            return { headline: nowR ? this._locText(nowR.desc) : name, detail: this.t('word.capped.max'), capped: true };
        }
        return {
            headline: this._locText(nextR.desc),
            detail: this.t('word.detail.nowRefine', { now: this._locText(nowR.desc), n: level + 1 }),
            capped: false
        };
    }
    if (def.procSpreadCount) {
        var now = Math.min(def.procSpreadMax || 3, def.procSpreadCount + level);
        var next = Math.min(def.procSpreadMax || 3, def.procSpreadCount + level + 1);
        if (now >= next) {
            return { headline: this.t('word.capped.spread', { n: now }), detail: '', capped: true };
        }
        return {
            headline: this.t('word.detail.spread', { n: next }),
            detail: this.t('word.detail.nowSimple', { now: '×' + now, n: level + 1 }),
            capped: false
        };
    }
    if (def.procTriggerUnlock) {
        return { headline: this._cardDesc(def) || name, detail: this.t('word.fx.segExpand'), capped: false };
    }
    var nowH = this.formatCardEffectHeadline(def, level, rd);
    var nextH = this.formatCardEffectHeadline(def, level + 1, rd);
    if (!nowH || !nextH) return { headline: this.t('word.fx.refineBoost'), detail: '', capped: false };
    return {
        headline: nextH,
        detail: this.t('word.detail.nowSimple', { now: nowH, n: level + 1 }),
        capped: false
    };
};

// HUD 構築行的精簡後綴
WordSystem.prototype.formatHudBuildPart = function(def, level, rd) {
    if (!def) return '';
    var line = this.formatCardEffectLine(def, level, rd);
    if (typeof line !== 'string') line = this._locText(line);
    line = String(line || '');
    if (!line) return this._cardName(def);

    var compact = line
        .replace(' 全軍傷害', '')
        .replace(' 全軍血量', '')
        .replace(' Army Damage', '')
        .replace(' Army HP', '')
        .replace(' 受傷', '')
        .replace(' Damage Taken', '')
        .replace(' 移速', '')
        .replace(' Move Speed', '')
        .replace(' 裝填', '')
        .replace(' Reload', '')
        .replace(/（\d+ 友軍）/, '')
        .replace(/\(\d+ 友軍\)/, '')
        .replace(/\(\d+ allies\)/i, '')
        .replace(/\(\d+ 先鋒\)/, '')
        .replace(/\(\d+ vanguards?\)/i, '')
        .replace(' 持續傷害', '')
        .replace(' DoT', '')
        .replace(' 控制時間', '')
        .replace(' CC Duration', '');

    return this._cardName(def) + ' ' + compact;
};

WordSystem.prototype.formatBuildHudLine = function(rd) {
    var parts = this.formatBuildDetailParts(rd);
    if (!parts.length) return '';
    return this.t('rogue.build.hudPrefix') + parts.join(' · ');
};

/** 構築詳情片段（手牌＋不佔格共鳴收尾） */
WordSystem.prototype.formatBuildDetailParts = function(rd) {
    var parts = [];
    for (var i = 0; i < this._owned.length; i++) {
        var id = this._owned[i];
        var def = this.getCardDef(id);
        if (!def) continue;
        parts.push(this.formatHudBuildPart(def, this.getUpgradeLevel(id), rd));
    }
    var reso = (this._lastBuffs && this._lastBuffs.activeResonances) || this._resonanceActive || {};
    var sf = window.WordConfig && window.WordConfig.schoolFinishers;
    var facMeta = window.WordConfig && window.WordConfig.factions;
    for (var f in reso) {
        if (!reso[f]) continue;
        var label = this._locText((typeof reso[f] === 'string') ? reso[f] : (sf && sf[f] && sf[f].label) || f);
        var school = this._locText((facMeta && facMeta[f] && facMeta[f].label) ? facMeta[f].label : f);
        var lv = (this._finisherLevels && this._finisherLevels[f]) || 0;
        var extra = lv > 0 ? ('精煉' + lv) : '不佔格';
        parts.push('共鳴·' + label + '（' + school + '·' + extra + '）');
    }
    // 符咒精煉解鎖的續燃（無術共鳴時仍要顯示）
    if (!reso.shu && this.hasCard('shu_sigil_n')) {
        var minLv = (window.WordConfig && window.WordConfig.fireSustainSigilMinLevel !== undefined)
            ? window.WordConfig.fireSustainSigilMinLevel : 1;
        if (this.getUpgradeLevel('shu_sigil_n') >= minLv) {
            parts.push('續燃（符咒精煉·不佔格）');
        }
    }
    return parts;
};

/** 結算畫面：只顯示詞綴／卡名（不含技術描述） */
WordSystem.prototype.formatBuildSummaryNames = function(rd) {
    var names = [];
    for (var i = 0; i < this._owned.length; i++) {
        var id = this._owned[i];
        var def = this.getCardDef(id);
        if (!def) continue;
        names.push(this._cardName(def));
    }
    var reso = (this._lastBuffs && this._lastBuffs.activeResonances) || this._resonanceActive || {};
    var sf = window.WordConfig && window.WordConfig.schoolFinishers;
    for (var f in reso) {
        if (!reso[f]) continue;
        var label = this._locText((typeof reso[f] === 'string') ? reso[f] : (sf && sf[f] && sf[f].label) || f);
        if (label) names.push(label);
    }
    if (!reso.shu && this.hasCard('shu_sigil_n')) {
        var minLv = (window.WordConfig && window.WordConfig.fireSustainSigilMinLevel !== undefined)
            ? window.WordConfig.fireSustainSigilMinLevel : 1;
        if (this.getUpgradeLevel('shu_sigil_n') >= minLv) {
            names.push('續燃');
        }
    }
    return names;
};

/** 結算／HUD：字卡 + 編制人數 + 羈絆／舊強化卡 */
WordSystem.prototype.computeSettlementCombatStats = function(rd) {
    var opts = {
        allyCount: this.countRosterAllies(rd),
        vanguardCount: this.countRosterVanguardAllies(rd)
    };
    var result = this.computeCombatStats(rd, opts);
    if (rd && typeof rd._computePersistentArmyBuffs === 'function') {
        var extra = rd._computePersistentArmyBuffs();
        if (extra) {
            var keys = ['dmgMul', 'hpMul', 'speedMul', 'reloadMul', 'damageTakenMul', 'dotMul', 'ccDurationMul'];
            for (var i = 0; i < keys.length; i++) {
                var k = keys[i];
                if (extra[k] && extra[k] !== 1) {
                    result[k] = (result[k] || 1) * extra[k];
                }
            }
        }
    }
    if (result.dmgMul < 0.1) result.dmgMul = 0.1;
    if (result.hpMul < 0.1) result.hpMul = 0.1;
    if (result.damageTakenMul < 0.1) result.damageTakenMul = 0.1;
    return result;
};

WordSystem.prototype._formatActiveBondNames = function(rd) {
    var names = [];
    if (!rd || !rd._activatedSynergies || !rd.synergies) return names;
    for (var f in rd._activatedSynergies) {
        if (!rd._activatedSynergies[f]) continue;
        var syn = rd.synergies[f];
        if (!syn) continue;
        var label = this._locText(syn.shortName || syn.name) || f;
        if (label) names.push(label);
    }
    return names;
};

/** 玩家目前殺戮疊層（達成條件後的實際層數） */
WordSystem.prototype._getKillDmgStacks = function(rd) {
    var pc = (rd && rd.app && rd.app.playerController) || (this.app && this.app.playerController);
    if (!pc) return 0;
    var n = pc._wordKillDmgStacks || 0;
    return n > 0 ? n : 0;
};

WordSystem.prototype._blockLooksSituational = function(block) {
    if (!block) return false;
    // onKill／殺戮已列入永久加成列，不重複進情境籤
    return !!(block.execute || block.hpLostScaling || block.onLowHp ||
        block.breachWindow || block.emberDetonate || block.fireSustain ||
        block.scaleCounter || block.windReturn || block.poiseCharge ||
        block.shieldBreakBurst || block.shieldBreakRetaliation || block.chainHarvest ||
        block.onBasicProc);
};

WordSystem.prototype._formatSituationalChipNames = function(rd, buffs) {
    var names = [];
    var seen = {};
    var push = function(name) {
        if (!name || seen[name]) return;
        seen[name] = true;
        names.push(name);
    };
    var mode = this._getMode();
    for (var i = 0; i < this._owned.length; i++) {
        var id = this._owned[i];
        var def = this.getCardDef(id);
        if (!def) continue;
        var block = this._getStatBlock(def, mode);
        var situational = this._blockLooksSituational(block);
        if (!situational && def.poiseTiers) situational = true;
        if (!situational && def.procTriggerTiers) situational = true;
        if (!situational && def.breakTiers) situational = true;
        if (situational) push(this._cardName(def));
    }
    // 續燃等共鳴收尾：實體卡已被吸收時不在 owned 裡
    if (buffs && buffs.fireSustain) {
        var sf = window.WordConfig && window.WordConfig.schoolFinishers && window.WordConfig.schoolFinishers.shu;
        var ents = (sf && sf.entityCardIds) || [];
        var hasEntity = false;
        for (var e = 0; e < ents.length; e++) {
            if (this.hasCard(ents[e])) { hasEntity = true; break; }
        }
        if (!hasEntity) push(this.t('word.totals.chip.fireSustain'));
    }
    return names;
};

/**
 * Settlement / HUD army totals.
 * Returns { label, lines, notes } or null.
 */
WordSystem.prototype.formatBuildSettlementTotals = function(rd) {
    var buffs = this.computeSettlementCombatStats(rd) || this._identityBuffs();
    var lines = [];
    var notes = [];

    var pct = function(v) { return Math.round(v * 100); };
    var pushStatIf = function(cond, key, vars) {
        if (!cond) return;
        lines.push(WordSystem.t(key, vars));
    };

    // 殺戮：達成擊殺疊層後，把實際加成併入傷害 %（不列「每層 +n%／可疊 m 次」）
    var dmgMul = buffs.dmgMul || 1;
    if (buffs.onKill && buffs.onKill.dmgStack > 0) {
        var killStacks = this._getKillDmgStacks(rd);
        if (killStacks > 0) {
            var maxSt = buffs.onKill.maxStacks || 3;
            if (killStacks > maxSt) killStacks = maxSt;
            dmgMul *= (1 + buffs.onKill.dmgStack * killStacks);
        }
    }

    pushStatIf(dmgMul && dmgMul !== 1, 'word.fx.armyDmg', { n: pct(dmgMul - 1) });
    pushStatIf(buffs.hpMul && buffs.hpMul !== 1, 'word.fx.armyHp', { n: pct((buffs.hpMul || 1) - 1) });
    pushStatIf(buffs.speedMul && buffs.speedMul !== 1, 'word.fx.spd', { n: pct((buffs.speedMul || 1) - 1) });
    pushStatIf(buffs.reloadMul && buffs.reloadMul !== 1, 'word.fx.reload', { n: pct((buffs.reloadMul || 1) - 1) });
    pushStatIf(buffs.damageTakenMul && buffs.damageTakenMul !== 1, 'word.fx.taken', { n: pct(1 - (buffs.damageTakenMul || 1)) });
    pushStatIf(buffs.shieldMaxPct && buffs.shieldMaxPct > 0, 'word.fx.shield', { n: pct(buffs.shieldMaxPct || 0) });
    pushStatIf(buffs.critChance && buffs.critChance > 0, 'word.fx.crit', { n: pct(buffs.critChance || 0) });
    var baseCritMul = 1.5;
    var CR = this._getCombatResolver();
    if (CR && CR.DEFAULT_CRIT_MUL) baseCritMul = CR.DEFAULT_CRIT_MUL;
    if (buffs.critMul && Math.abs((buffs.critMul || baseCritMul) - baseCritMul) > 0.001) {
        var critStr = (Math.round(buffs.critMul * 100) / 100).toFixed(1);
        lines.push(WordSystem.t('word.fx.critMul', { from: baseCritMul, to: critStr }));
    }
    pushStatIf(buffs.dodgeChance && buffs.dodgeChance > 0, 'word.fx.dodge', { n: pct(buffs.dodgeChance || 0) });
    pushStatIf(buffs.bonusVsShield && buffs.bonusVsShield > 0, 'word.fx.vsShield', { n: pct(buffs.bonusVsShield || 0) });
    pushStatIf(buffs.dotMul && buffs.dotMul !== 1, 'word.fx.dot', { n: pct((buffs.dotMul || 1) - 1) });
    pushStatIf(buffs.ccDurationMul && buffs.ccDurationMul !== 1, 'word.fx.cc', { n: pct((buffs.ccDurationMul || 1) - 1) });

    if (buffs.auras && buffs.auras.length) {
        var bestAura = null;
        for (var a = 0; a < buffs.auras.length; a++) {
            var aura = buffs.auras[a];
            if (!aura || !(aura.damageTakenMul < 1)) continue;
            if (!bestAura || aura.damageTakenMul < bestAura.damageTakenMul) bestAura = aura;
        }
        if (bestAura) {
            lines.push(WordSystem.t('word.fx.auraDrLine', {
                n: pct(1 - bestAura.damageTakenMul),
                r: bestAura.radius || 8
            }));
        }
    }

    var bondNames = this._formatActiveBondNames(rd);
    if (bondNames.length) {
        notes.push(WordSystem.t('word.totals.bonds', { names: bondNames.join(' · ') }));
    }
    var situNames = this._formatSituationalChipNames(rd, buffs);
    if (situNames.length) {
        notes.push(WordSystem.t('word.totals.situational', { names: situNames.join(' · ') }));
    }

    if (!lines.length && !notes.length) return null;
    return {
        label: WordSystem.t('word.totals.label'),
        lines: lines,
        notes: notes
    };
};

// ── Rogue 構築分享：快照 / 代碼 ─────────────────────────────────────
WordSystem.BUILD_VERSION = 1;
WordSystem.CODE_PREFIX = 'v1.';

WordSystem._b64urlEncode = function(str) {
    return btoa(unescape(encodeURIComponent(str)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

WordSystem._b64urlDecode = function(s) {
    var pad = s.length % 4;
    if (pad) s += '===='.slice(0, 4 - pad);
    return decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
};

/** Rogue 斷點：匯出本局詞卡 run 狀態（可還原） */
WordSystem.prototype.exportRunState = function() {
    var cloneObj = function(o) {
        if (!o) return {};
        try { return JSON.parse(JSON.stringify(o)); } catch (e) { return {}; }
    };
    return {
        _owned: (this._owned || []).slice(),
        _levels: cloneObj(this._levels),
        _openingStep: this._openingStep || 0,
        _openingDone: !!this._openingDone,
        _sigCardId: this._sigCardId || null,
        _sigTier: this._sigTier || 0,
        _sigResolved: !!this._sigResolved,
        _sigPityDone: !!this._sigPityDone,
        _sigBossPityDue: !!this._sigBossPityDue,
        _sigBaseBrawler: this._sigBaseBrawler || null,
        _sigShownBlacklist: cloneObj(this._sigShownBlacklist),
        _finisherLevels: cloneObj(this._finisherLevels),
        _resonanceActive: cloneObj(this._resonanceActive),
        _resonanceActivePrev: cloneObj(this._resonanceActivePrev)
    };
};

/** Rogue 斷點：還原本局詞卡 run 狀態；成功後應呼叫 syncArmyCombatStats */
WordSystem.prototype.importRunState = function(data, rd) {
    if (!data) return false;
    this.resetRun();
    this._owned = (data._owned && data._owned.slice) ? data._owned.slice() : [];
    this._levels = {};
    if (data._levels) {
        for (var k in data._levels) {
            if (Object.prototype.hasOwnProperty.call(data._levels, k)) {
                this._levels[k] = data._levels[k];
            }
        }
    }
    this._openingStep = data._openingStep || 0;
    this._openingDone = !!data._openingDone;
    this._sigCardId = data._sigCardId || null;
    this._sigTier = data._sigTier || 0;
    this._sigResolved = !!data._sigResolved;
    this._sigPityDone = !!data._sigPityDone;
    this._sigBossPityDue = !!data._sigBossPityDue;
    this._sigBaseBrawler = data._sigBaseBrawler || this._currentBrawlerType();
    this._sigShownBlacklist = {};
    if (data._sigShownBlacklist) {
        for (var b in data._sigShownBlacklist) {
            if (Object.prototype.hasOwnProperty.call(data._sigShownBlacklist, b)) {
                this._sigShownBlacklist[b] = data._sigShownBlacklist[b];
            }
        }
    }
    this._finisherLevels = {};
    if (data._finisherLevels) {
        for (var f in data._finisherLevels) {
            if (Object.prototype.hasOwnProperty.call(data._finisherLevels, f)) {
                this._finisherLevels[f] = data._finisherLevels[f];
            }
        }
    }
    this._resonanceActive = {};
    if (data._resonanceActive) {
        for (var r in data._resonanceActive) {
            if (Object.prototype.hasOwnProperty.call(data._resonanceActive, r)) {
                this._resonanceActive[r] = data._resonanceActive[r];
            }
        }
    }
    this._resonanceActivePrev = {};
    if (data._resonanceActivePrev) {
        for (var p in data._resonanceActivePrev) {
            if (Object.prototype.hasOwnProperty.call(data._resonanceActivePrev, p)) {
                this._resonanceActivePrev[p] = data._resonanceActivePrev[p];
            }
        }
    }
    if (rd && typeof this.syncArmyCombatStats === 'function') {
        this.syncArmyCombatStats(rd, true);
    }
    return true;
};

WordSystem.prototype.exportBuildSnapshot = function(rd, meta) {
    meta = meta || {};
    var hero = meta.hero || '';
    if (!hero && rd && rd.app && rd.app.playerController) {
        hero = rd.app.playerController.brawlerType || '';
    }
    var squad = [];
    if (rd && rd.squad) {
        for (var i = 0; i < rd.squad.length; i++) {
            var m = rd.squad[i];
            squad.push({
                bType: m.bType || '',
                name: m.name || '',
                faction: m.faction || '',
                dead: !!m.dead
            });
        }
    }
    var cards = [];
    for (var c = 0; c < this._owned.length; c++) {
        var id = this._owned[c];
        var def = this.getCardDef(id);
        cards.push({
            id: id,
            level: this.getUpgradeLevel(id),
            name: def ? this._cardName(def) : id
        });
    }
    var signature = null;
    if (this._sigCardId) {
        var sigDef = this.getCardDef(this._sigCardId);
        signature = {
            id: this._sigCardId,
            level: this._sigIsEffect() ? (this._sigTier || 0) : this.getUpgradeLevel(this._sigCardId),
            isEffect: this._sigIsEffect(),
            name: sigDef ? sigDef.name : this._sigCardId
        };
    }
    var finishers = {};
    if (this._finisherLevels) {
        for (var f in this._finisherLevels) {
            if (this._finisherLevels[f]) finishers[f] = this._finisherLevels[f];
        }
    }
    var legacyUpgrades = {};
    if (rd && rd._cardCounts) {
        for (var k in rd._cardCounts) {
            if (rd._cardCounts[k] > 0) legacyUpgrades[k] = rd._cardCounts[k];
        }
    }
    var playerName = meta.playerName || '';
    if (!playerName && rd && rd.app && rd.app.progressionManager) {
        var pm = rd.app.progressionManager;
        if (typeof pm.getDisplayName === 'function') playerName = pm.getDisplayName();
        else if (pm.data && pm.data.displayName) playerName = pm.data.displayName;
    }

    return {
        v: WordSystem.BUILD_VERSION,
        hero: hero,
        squad: squad,
        waves: meta.waves || 0,
        endless: !!meta.endless,
        coins: meta.coins || 0,
        xp: meta.xp || 0,
        kills: meta.kills || 0,
        cards: cards,
        signature: signature,
        displaySlots: this.buildDisplaySlots(),
        finishers: finishers,
        buildParts: this.formatBuildDetailParts(rd),
        legacyUpgrades: legacyUpgrades,
        playerName: playerName,
        at: meta.at || Date.now()
    };
};

WordSystem.prototype.formatBuildShareText = function(snap, extra) {
    extra = extra || {};
    if (!snap) return '';
    var hero = snap.hero || '';
    if (window.BrawlerConfig && window.BrawlerConfig.getDisplayName) {
        hero = window.BrawlerConfig.getDisplayName(snap.hero) || hero;
    } else if (window.BrawlerConfig && window.BrawlerConfig.getDisplayZh) {
        hero = window.BrawlerConfig.getDisplayZh(snap.hero) || hero;
    }
    var waveLine = '第 ' + (snap.waves || 0) + ' 波';
    if (snap.endless) waveLine += '（無盡）';
    var squadNames = [];
    if (snap.squad && snap.squad.length) {
        for (var i = 0; i < snap.squad.length; i++) {
            squadNames.push(snap.squad[i].name || snap.squad[i].bType || '?');
        }
    }
    var lines = [
        '【FIGHT KINGDOM】群雄集結 Build',
        (snap.playerName ? (snap.playerName + ' · ') : '') + '主將：' + (hero || '—') + ' · ' + waveLine
    ];
    if (squadNames.length) lines.push('軍團：' + squadNames.join('、'));
    var parts = snap.buildParts || [];
    if (!parts.length && snap.cards && snap.cards.length) {
        parts = snap.cards.map(function(c) {
            return c.name + (c.level > 0 ? ('+' + c.level) : '');
        });
    }
    if (parts.length) lines.push('構築：' + parts.join(' · '));
    if (snap.coins || snap.xp) {
        lines.push('戰果：🪙 ' + (snap.coins || 0) + ' · 經驗 +' + (snap.xp || 0));
    }
    return lines.join('\n');
};

WordSystem.encodeBuildCode = function(snap) {
    if (!snap) return '';
    try {
        var payload = {
            v: snap.v || WordSystem.BUILD_VERSION,
            hero: snap.hero,
            squad: snap.squad,
            waves: snap.waves,
            endless: snap.endless,
            cards: snap.cards,
            signature: snap.signature,
            displaySlots: snap.displaySlots,
            finishers: snap.finishers,
            buildParts: snap.buildParts,
            legacyUpgrades: snap.legacyUpgrades,
            playerName: snap.playerName,
            at: snap.at
        };
        return WordSystem.CODE_PREFIX + WordSystem._b64urlEncode(JSON.stringify(payload));
    } catch (e) {
        return '';
    }
};

WordSystem.decodeBuildCode = function(code) {
    if (!code || typeof code !== 'string') return { ok: false, error: 'empty' };
    code = code.trim();
    if (code.indexOf(WordSystem.CODE_PREFIX) !== 0) {
        return { ok: false, error: 'prefix' };
    }
    try {
        var raw = WordSystem._b64urlDecode(code.slice(WordSystem.CODE_PREFIX.length));
        var snap = JSON.parse(raw);
        if (!snap || !snap.v) return { ok: false, error: 'version' };
        if (snap.v > WordSystem.BUILD_VERSION) {
            return { ok: false, error: 'too_new', snap: snap };
        }
        if (snap.cards) {
            for (var i = 0; i < snap.cards.length; i++) {
                var id = snap.cards[i].id;
                if (id && window.WordConfig && window.WordConfig.cards && !window.WordConfig.cards[id]) {
                    snap._staleCards = (snap._staleCards || 0) + 1;
                }
            }
        }
        return { ok: true, snap: snap };
    } catch (e) {
        return { ok: false, error: 'parse' };
    }
};

WordSystem.prototype._makeSlotFromCardId = function(id, opts) {
    opts = opts || {};
    var def = this.getCardDef(id);
    var fac = def && window.WordConfig && window.WordConfig.factions[def.faction];
    var level = opts.level !== undefined ? opts.level : this.getUpgradeLevel(id);
    var name = def ? this._cardName(def) : id;
    return {
        empty: false,
        id: id,
        name: name,
        shortName: name ? String(name).slice(0, 4) : '?',
        faction: def ? def.faction : '',
        edge: (fac && fac.edge) || '#c9a25a',
        color: (fac && fac.color) || '#c9a25a',
        level: level,
        isSignature: !!opts.isSignature
    };
};

WordSystem.prototype.buildDisplaySlots = function() {
    var DISPLAY_MAX = 5;
    var slots = [];
    if (this._sigIsEffect() && this._sigCardId) {
        slots.push(this._makeSlotFromCardId(this._sigCardId, {
            isSignature: true,
            level: this._sigTier || 0
        }));
        for (var i = 0; i < 4; i++) {
            var id = this._owned[i];
            slots.push(id ? this._makeSlotFromCardId(id) : { empty: true });
        }
    } else {
        for (var j = 0; j < DISPLAY_MAX; j++) {
            var oid = this._owned[j];
            if (!oid) slots.push({ empty: true });
            else slots.push(this._makeSlotFromCardId(oid, { isSignature: oid === this._sigCardId }));
        }
    }
    while (slots.length < DISPLAY_MAX) slots.push({ empty: true });
    return slots.slice(0, DISPLAY_MAX);
};

WordSystem._slotFromSnapCard = function(card, isSignature) {
    if (!card || !card.id) return { empty: true };
    var def = window.WordConfig && window.WordConfig.cards && window.WordConfig.cards[card.id];
    var fac = def && window.WordConfig.factions[def.faction];
    var name = card.name || (def && window.WordConfig.getName ? window.WordConfig.getName(def) : (def ? def.id : card.id));
    if (def && window.WordConfig && window.WordConfig.getName) name = window.WordConfig.getName(def);
    else if (!name || typeof name === 'object') name = card.id;
    return {
        empty: false,
        id: card.id,
        name: name,
        shortName: String(name).slice(0, 4),
        faction: def ? def.faction : '',
        edge: (fac && fac.edge) || '#c9a25a',
        color: (fac && fac.color) || '#c9a25a',
        level: card.level || 0,
        isSignature: !!isSignature
    };
};

WordSystem.buildDisplaySlotsFromSnapshot = function(snap) {
    if (!snap) return [];
    if (snap.displaySlots && snap.displaySlots.length) return snap.displaySlots;
    var DISPLAY_MAX = 5;
    var slots = [];
    var sig = snap.signature;
    var cards = snap.cards || [];
    if (sig && sig.isEffect) {
        slots.push(WordSystem._slotFromSnapCard(sig, true));
        for (var i = 0; i < 4; i++) {
            slots.push(cards[i] ? WordSystem._slotFromSnapCard(cards[i], false) : { empty: true });
        }
    } else {
        for (var j = 0; j < DISPLAY_MAX; j++) {
            if (!cards[j]) slots.push({ empty: true });
            else slots.push(WordSystem._slotFromSnapCard(cards[j], sig && cards[j].id === sig.id));
        }
    }
    while (slots.length < DISPLAY_MAX) slots.push({ empty: true });
    return slots.slice(0, DISPLAY_MAX);
};

WordSystem.prototype.getBuildSlotSnapshot = function(rd) {
    var slots = this.buildDisplaySlots();
    var filled = 0;
    for (var fi = 0; fi < slots.length; fi++) {
        if (!slots[fi].empty) filled++;
    }
    var badges = [];
    var reso = (this._lastBuffs && this._lastBuffs.activeResonances) || {};
    var sf = window.WordConfig && window.WordConfig.schoolFinishers;
    var facMeta = window.WordConfig && window.WordConfig.factions;
    for (var f in reso) {
        if (!reso[f]) continue;
        var label = (typeof reso[f] === 'string') ? reso[f] : (sf && sf[f] && sf[f].label) || f;
        var fm = facMeta && facMeta[f];
        badges.push({
            faction: f,
            label: label,
            text: '共鳴·' + label,
            color: (fm && fm.color) || '#c9a25a',
            edge: (fm && fm.edge) || '#c9a25a'
        });
    }
    return {
        slots: slots,
        filled: filled,
        max: 5,
        badges: badges
    };
};

/** 與上一次比較，回傳新發動的共鳴 [{faction,label}] */
WordSystem.prototype._diffNewlyActivatedResonance = function(activeMap) {
    activeMap = activeMap || {};
    var prev = this._resonanceActivePrev || {};
    var newly = [];
    var sf = window.WordConfig && window.WordConfig.schoolFinishers;
    for (var f in activeMap) {
        if (!activeMap[f]) continue;
        if (prev[f]) continue;
        var label = (typeof activeMap[f] === 'string') ? activeMap[f]
            : (sf && sf[f] && sf[f].label) || f;
        newly.push({ faction: f, label: label });
    }
    this._resonanceActivePrev = {};
    for (var k in activeMap) {
        if (activeMap[k]) this._resonanceActivePrev[k] = true;
    }
    return newly;
};

// 精煉行:舊值 → 新值
WordSystem.prototype.formatUpgradeLine = function(def, level, rd) {
    if (!def) return '';
    var now = this.formatCardEffectLine(def, level, rd);
    var next = this.formatCardEffectLine(def, level + 1, rd);
    if (!now || !next) return this.t('word.fx.refineBoost');
    return now + ' → ' + next;
};

// Legacy multi-line (unused in UI); keep for tooltips
WordSystem.prototype.formatCardEffectText = function(def, level, rd) {
    return this.formatCardEffectLine(def, level, rd);
};

WordSystem.prototype.formatCardEffectShort = function(def, level, rd) {
    return this.formatCardEffectLine(def, level, rd);
};

WordSystem.prototype._applyStatBlock = function(result, block, effectScale, allyCount, vanguardCount) {
    if (!block) return;

    if (block.dmgMul) result.dmgMul *= (1 + (block.dmgMul - 1) * effectScale);
    if (block.hpMul) result.hpMul *= (1 + (block.hpMul - 1) * effectScale);
    if (block.speedMul) result.speedMul *= (1 + (block.speedMul - 1) * effectScale);
    if (block.reloadMul) result.reloadMul *= (1 + (block.reloadMul - 1) * effectScale);
    if (block.dashRechargeMul) result.dashRechargeMul *= (1 + (block.dashRechargeMul - 1) * effectScale);
    if (block.ammoBonus) result.ammoBonus += Math.round((block.ammoBonus || 0) * effectScale) || (block.ammoBonus || 0);
    if (block.dashChargesBonus) result.dashChargesBonus += Math.round(block.dashChargesBonus || 0);
    if (block.damageTakenMul) result.damageTakenMul *= (1 + (block.damageTakenMul - 1) * effectScale);
    if (block.dotMul) result.dotMul *= (1 + (block.dotMul - 1) * effectScale);
    if (block.ccDurationMul) result.ccDurationMul *= (1 + (block.ccDurationMul - 1) * effectScale);

    if (block.perAlly) {
        if (block.perAlly.dmgMul) result.dmgMul += block.perAlly.dmgMul * allyCount * effectScale;
        if (block.perAlly.hpMul) result.hpMul += block.perAlly.hpMul * allyCount * effectScale;
        if (block.perAlly.dotMul) result.dotMul += block.perAlly.dotMul * allyCount * effectScale;
    }
    if (block.perAllyRole && block.perAllyRole.vanguard && block.perAllyRole.vanguard.speedMul) {
        result.speedMul += block.perAllyRole.vanguard.speedMul * vanguardCount * effectScale;
    }

    if (block.critChance) result.critChance += block.critChance * effectScale;
    if (block.critMul) result.critMul = 1 + (result.critMul - 1 + (block.critMul - 1) * effectScale);
    if (block.bonusVsShield) result.bonusVsShield += block.bonusVsShield * effectScale;
    if (block.onShieldBreakDmgPct) result.onShieldBreakDmgPct += block.onShieldBreakDmgPct * effectScale;
    if (block.shieldMaxPct) result.shieldMaxPct = Math.max(result.shieldMaxPct, block.shieldMaxPct * effectScale);
    if (block.dodgeChance) result.dodgeChance += block.dodgeChance * effectScale;

    if (block.perAlly) {
        if (block.perAlly.procDamagePct) result.procAllyDamagePct += block.perAlly.procDamagePct * allyCount * effectScale;
    }
};

WordSystem.prototype._collectBasicProcs = function(result, block, effectScale) {
    if (!block || !block.onBasicProc) return;
    if (!result.basicProcs) result.basicProcs = [];
    var proc = block.onBasicProc;
    var copy = {
        trigger: proc.trigger || 'first_in_combo',
        bulletKey: proc.bulletKey || 'arcane_sigil',
        attackPattern: proc.attackPattern || 'normal',
        damagePct: (proc.damagePct || 0.35) * effectScale,
        bulletSpeed: proc.bulletSpeed,
        bulletLifetime: proc.bulletLifetime
    };
    if (proc.dotConfig) {
        copy.dotConfig = Object.assign({}, proc.dotConfig);
        if (copy.dotConfig.damagePerTick) {
            copy.dotConfig.damagePerTick = Math.round(copy.dotConfig.damagePerTick * effectScale);
        }
    }
    if (proc.spreadAngle) copy.spreadAngle = proc.spreadAngle;
    result.basicProcs.push(copy);
};

WordSystem.prototype._collectProcModifiers = function(result, def, level) {
    if (!def) return;
    if (def.procTriggerTiers) {
        var tier = this._procTriggerTierAt(def, level);
        if (tier) {
            if (!result.procTriggerUnlocks) result.procTriggerUnlocks = {};
            var maxIdx = tier.maxComboIndex !== undefined ? tier.maxComboIndex : 0;
            if (result.procMaxComboIndex === undefined || maxIdx > result.procMaxComboIndex) {
                result.procMaxComboIndex = maxIdx;
            }
            if (tier.superProc) result.procSuperProc = true;
            if (tier.spreadCount) {
                result.procSpreadCount = Math.max(result.procSpreadCount || 1, tier.spreadCount);
            }
            if (tier.spreadAngle) result.procSpreadAngle = tier.spreadAngle;
            if (tier.damagePctMul) {
                var mul = tier.damagePctMul;
                if (!result.procDamagePctMul || mul < result.procDamagePctMul) {
                    result.procDamagePctMul = mul;
                }
            }
        }
    }
    if (def.procTriggerUnlock) {
        if (!result.procTriggerUnlocks) result.procTriggerUnlocks = { first_in_combo: true };
        result.procTriggerUnlocks[def.procTriggerUnlock] = true;
    }
    if (def.procSpreadCount) {
        var spread = def.procSpreadCount + (level || 0);
        var max = def.procSpreadMax || 3;
        if (spread > max) spread = max;
        result.procSpreadCount = Math.max(result.procSpreadCount || 1, spread);
        if (def.procSpreadAngle) result.procSpreadAngle = def.procSpreadAngle;
    }
};

WordSystem.prototype._finalizeBasicProcs = function(result) {
    if (!result.basicProcs || result.basicProcs.length === 0) return;
    var unlocks = result.procTriggerUnlocks || {};
    if (result.procMaxComboIndex !== undefined && result.procMaxComboIndex !== null) {
        unlocks.maxComboIndex = result.procMaxComboIndex;
        unlocks.superProc = !!result.procSuperProc;
    } else {
        if (!unlocks.first_in_combo) unlocks.first_in_combo = true;
    }
    var spread = result.procSpreadCount || 1;
    var spreadAngle = result.procSpreadAngle || 14;
    var dmgMul = result.procDamagePctMul || 1;
    for (var i = 0; i < result.basicProcs.length; i++) {
        result.basicProcs[i].triggerUnlocks = unlocks;
        result.basicProcs[i].spreadCount = spread;
        if (!result.basicProcs[i].spreadAngle) result.basicProcs[i].spreadAngle = spreadAngle;
        if (dmgMul !== 1) {
            result.basicProcs[i].damagePct = (result.basicProcs[i].damagePct || 0) * dmgMul;
        }
    }
};

WordSystem.prototype._collectTriggerStats = function(result, block, effectScale) {
    if (!block) return;

    if (block.execute) {
        var ex = block.execute;
        if (!result.execute || (ex.bonusDmg || 0) > (result.execute.bonusDmg || 0)) {
            result.execute = {
                threshold: ex.threshold || 0.25,
                bonusDmg: (ex.bonusDmg || 0) * effectScale,
                cooldownMs: ex.cooldownMs || 0
            };
        }
    }

    if (block.onKill) {
        var ok = block.onKill;
        if (!result.onKill) result.onKill = { refreshBasicAttack: false, dmgStack: 0, maxStacks: 0 };
        if (ok.refreshBasicAttack) result.onKill.refreshBasicAttack = true;
        result.onKill.dmgStack += (ok.dmgStack || 0) * effectScale;
        result.onKill.maxStacks = Math.max(result.onKill.maxStacks || 0, ok.maxStacks || 3);
    }

    if (block.breachWindow) {
        var bw = block.breachWindow;
        if (!result.breachWindow || (bw.bonusDmg || 0) > (result.breachWindow.bonusDmg || 0)) {
            result.breachWindow = {
                durationMs: bw.durationMs || 2000,
                bonusDmg: (bw.bonusDmg || 0.30) * effectScale,
                applyCooldownMs: bw.applyCooldownMs || 1250,
                strongSnareMaxMult: bw.strongSnareMaxMult !== undefined ? bw.strongSnareMaxMult : 0.50,
                markOnDot: bw.markOnDot ? bw.markOnDot.slice() : null
            };
        } else if (bw.markOnDot && result.breachWindow && !result.breachWindow.markOnDot) {
            result.breachWindow.markOnDot = bw.markOnDot.slice();
        }
    }

    if (block.emberDetonate) {
        var em = block.emberDetonate;
        if (!result.emberDetonate || (em.remainingPct || 0) > (result.emberDetonate.remainingPct || 0)) {
            result.emberDetonate = {
                remainingPct: em.remainingPct || 0.60,
                splashPct: em.splashPct || 0.35,
                splashRadius: em.splashRadius || 2.75,
                cooldownMs: em.cooldownMs || 2000,
                aoeKey: em.aoeKey || 'zhouyu'
            };
        }
    }

    if (block.hpLostScaling) {
        var hs = block.hpLostScaling;
        if (!result.hpLostScaling) {
            result.hpLostScaling = { step: hs.step || 0.10, dmgPerStep: 0, cap: 0 };
        }
        result.hpLostScaling.dmgPerStep += (hs.dmgPerStep || 0) * effectScale;
        result.hpLostScaling.cap += (hs.cap || 0) * effectScale;
    }

    if (block.onLowHp) {
        var low = block.onLowHp;
        result.onLowHpTriggers.push({
            threshold: low.threshold || 0.40,
            dmgMul: 1 + ((low.dmgMul || 1) - 1) * effectScale,
            damageTakenMul: low.damageTakenMul
                ? 1 + ((low.damageTakenMul || 1) - 1) * effectScale
                : 1
        });
    }

    if (block.aura) {
        var aura = block.aura;
        var takenMul = aura.damageTakenMul || 1;
        if (takenMul < 1) {
            takenMul = 1 - (1 - takenMul) * effectScale;
        }
        result.auras.push({
            radius: aura.radius || 8,
            damageTakenMul: takenMul,
            affects: aura.affects || 'allies'
        });
    }

    if (block.fireSustain) {
        var fs = block.fireSustain;
        var soft = effectScale > 1 ? (0.7 + 0.3 * effectScale) : 1;
        var extend = (fs.extendSec || 0.35) * soft;
        var burnMul = (fs.burnDmgMul !== undefined ? fs.burnDmgMul : 1) * effectScale;
        var prevFs = result.fireSustain;
        if (!prevFs || extend > (prevFs.extendSec || 0) || burnMul > (prevFs.burnDmgMul || 1)) {
            result.fireSustain = {
                extendSec: Math.max(extend, (prevFs && prevFs.extendSec) || 0),
                icdMs: fs.icdMs || (prevFs && prevFs.icdMs) || 800,
                burnDmgMul: Math.max(burnMul, (prevFs && prevFs.burnDmgMul) || 1)
            };
        }
    }

    if (block.scaleCounter) {
        var sc = block.scaleCounter;
        var perStack = (sc.perStackBonus || sc.nextHitDmgBonus || 0.25) * effectScale;
        var maxStacks = sc.maxStacks || 3;
        if (!result.scaleCounter || perStack > (result.scaleCounter.perStackBonus || 0)) {
            result.scaleCounter = {
                perStackBonus: perStack,
                maxStacks: maxStacks,
                minHit: sc.minHit !== undefined ? sc.minHit : (sc.minAbsorb !== undefined ? sc.minAbsorb : 1)
            };
        }
    }

    if (block.windReturn) {
        var wr = block.windReturn;
        var wrBonus = (wr.nextHitDmgBonus || 0.25) * effectScale;
        if (!result.windReturn || wrBonus > (result.windReturn.nextHitDmgBonus || 0)) {
            result.windReturn = {
                nextHitDmgBonus: wrBonus,
                perfectDashRestore: wr.perfectDashRestore || 1
            };
        }
    }

    if (block.poiseCharge) {
        var pc = block.poiseCharge;
        var peak = (pc.peakBonus || 0.28) * effectScale;
        if (!result.poiseCharge || peak > (result.poiseCharge.peakBonus || 0)) {
            result.poiseCharge = {
                maxSec: pc.maxSec || 1.5,
                peakBonus: peak,
                combatRange: pc.combatRange || 10,
                softSec: pc.softSec || 0.4
            };
        }
    }

    if (block.shieldBreakBurst) {
        var sb = block.shieldBreakBurst;
        var sbBonus = (sb.nextHitDmgBonus || 0.40) * effectScale;
        if (!result.shieldBreakBurst || sbBonus > (result.shieldBreakBurst.nextHitDmgBonus || 0)) {
            result.shieldBreakBurst = {
                nextHitDmgBonus: sbBonus,
                windowMs: sb.windowMs || 2500
            };
        }
    }

    if (block.shieldBreakRetaliation) {
        var sr = block.shieldBreakRetaliation;
        var srPct = sr.shieldMaxPct || 0.40;
        if (!result.shieldBreakRetaliation || srPct > (result.shieldBreakRetaliation.shieldMaxPct || 0)) {
            result.shieldBreakRetaliation = { shieldMaxPct: srPct };
        }
    }

    if (block.lifestealPct) {
        result.lifestealPct = Math.max(result.lifestealPct || 0, block.lifestealPct);
    }

    if (block.chainHarvest) {
        var ch = block.chainHarvest;
        var chBonus = (ch.bonusDmg || 0.35) * effectScale;
        if (!result.chainHarvest || chBonus > (result.chainHarvest.bonusDmg || 0)) {
            result.chainHarvest = {
                radius: ch.radius || 4.5,
                bonusDmg: chBonus,
                durationMs: ch.durationMs || 2800,
                maxTargets: ch.maxTargets || 4
            };
        }
    }
};

WordSystem.prototype._collectOnCritEffects = function(result, def, effectScale) {
    if (!def || !def.onCrit) return;
    if (!result.onCritEffects) result.onCritEffects = [];
    var fx = {};
    if (def.onCrit.snareDuration) fx.snareDuration = def.onCrit.snareDuration * effectScale;
    if (def.onCrit.snareMultiplier !== undefined) fx.snareMultiplier = def.onCrit.snareMultiplier;
    if (def.onCrit.stunDuration) fx.stunDuration = def.onCrit.stunDuration * effectScale;
    if (fx.snareDuration || fx.stunDuration) result.onCritEffects.push(fx);
};

// ── 學派共鳴／收尾 ───────────────────────────────────────────
WordSystem.prototype._finisherMeta = function(faction) {
    var sf = window.WordConfig && window.WordConfig.schoolFinishers;
    return (sf && sf[faction]) || null;
};

WordSystem.prototype._isFinisherCardId = function(cardId) {
    var def = this.getCardDef(cardId);
    if (def && def.schoolFinisher) return true;
    var sf = window.WordConfig && window.WordConfig.schoolFinishers;
    if (!sf) return false;
    for (var f in sf) {
        var ids = sf[f].entityCardIds || [];
        for (var i = 0; i < ids.length; i++) {
            if (ids[i] === cardId) return true;
        }
    }
    return false;
};

/** 該派收尾是否已由共鳴（或不佔格層）取得 — 有則池中不再出實體收尾卡 */
WordSystem.prototype._isSchoolFinisherGranted = function(faction) {
    if (!faction) return false;
    var prog = this.getResonanceProgress(faction);
    if (prog && prog.active) return true;
    if (this.countSchoolCards(faction) >= 2) return true;
    // 術系續燃也可由符咒精煉解鎖（無實體卡，此路徑主要擋其他派實體）
    if (this._resonanceActive && this._resonanceActive[faction]) return true;
    return false;
};

WordSystem.prototype.countSchoolCards = function(faction, opts) {
    opts = opts || {};
    var n = 0;
    for (var i = 0; i < this._owned.length; i++) {
        var id = this._owned[i];
        var def = this.getCardDef(id);
        if (!def || def.faction !== faction) continue;
        if (opts.excludeFinishers !== false && this._isFinisherCardId(id)) continue;
        n++;
    }
    return n;
};

WordSystem.prototype.getResonanceProgress = function(faction) {
    var count = this.countSchoolCards(faction);
    var active = !!(this._resonanceActive && this._resonanceActive[faction]);
    var meta = this._finisherMeta(faction);
    return {
        count: count,
        need: 2,
        active: active || count >= 2,
        label: meta ? (window.WordConfig && WordConfig.loc ? WordConfig.loc(meta.label) : meta.label) : '',
        finisherLevel: (this._finisherLevels && this._finisherLevels[faction]) || 0
    };
};

WordSystem.prototype._finisherEffectScale = function(faction) {
    var lv = (this._finisherLevels && this._finisherLevels[faction]) || 0;
    return 1 + lv * ((window.WordConfig && window.WordConfig.upgradeBonusPerLevel) || 0.5);
};

WordSystem.prototype._bumpFinisherLevel = function(faction) {
    if (!this._finisherLevels) this._finisherLevels = {};
    this._finisherLevels[faction] = (this._finisherLevels[faction] || 0) + 1;
};

WordSystem.prototype._removeOwnedCard = function(cardId) {
    var idx = this._owned.indexOf(cardId);
    if (idx < 0) return false;
    this._owned.splice(idx, 1);
    return true;
};

WordSystem.prototype._mergeFinisherFromBlock = function(result, block, effectScale) {
    if (!block) return;
    this._collectTriggerStats(result, block, effectScale || 1);
};

WordSystem.prototype._applySchoolResonanceEffects = function(result, mode) {
    if (!window.WordConfig || !window.WordConfig.schoolFinishers) return;
    var m = mode || this._getMode();
    if (m === 'rogue') m = 'pve';
    var sf = window.WordConfig.schoolFinishers;
    if (!result.activeResonances) result.activeResonances = {};
    this._resonanceActive = this._resonanceActive || {};

    for (var faction in sf) {
        var meta = sf[faction];
        var countable = this.countSchoolCards(faction);
        var hasEntity = false;
        var entityIds = meta.entityCardIds || [];
        for (var e = 0; e < entityIds.length; e++) {
            if (this.hasCard(entityIds[e])) hasEntity = true;
        }
        var resonate = countable >= 2;
        this._resonanceActive[faction] = resonate;
        if (resonate) result.activeResonances[faction] = (window.WordConfig && WordConfig.loc ? WordConfig.loc(meta.label) : meta.label) || faction;

        // 續燃：共鳴 或 符咒精煉達標
        if (meta.effectKey === 'fireSustain') {
            var wantSustain = resonate;
            if (!wantSustain && this.hasCard('shu_sigil_n')) {
                var minLv = window.WordConfig.fireSustainSigilMinLevel;
                if (minLv === undefined) minLv = 1;
                if (this.getUpgradeLevel('shu_sigil_n') >= minLv) wantSustain = true;
            }
            if (wantSustain) {
                var fe = window.WordConfig.finisherEffects && window.WordConfig.finisherEffects.fireSustain;
                var fsBlock = fe ? (fe[m] || fe.pve) : null;
                if (fsBlock) {
                    this._mergeFinisherFromBlock(result, { fireSustain: fsBlock }, this._finisherEffectScale(faction));
                }
            }
            continue;
        }

        // 其他收尾：共鳴且手牌無實體時，從實體卡定義注入（實體在手則已由 owned 收集）
        if (resonate && !hasEntity && entityIds.length) {
            var entDef = this.getCardDef(entityIds[0]);
            var entBlock = this._getStatBlock(entDef, mode);
            if (entBlock) this._mergeFinisherFromBlock(result, entBlock, this._finisherEffectScale(faction));
        } else if (hasEntity && (this._finisherLevels[faction] || 0) > 0) {
            // 實體在手但曾精煉過共鳴層：用 finisher level 再疊一檔（效果已在 owned；scale 已含 card level）
            // 若實體已被吸收則走 resonate && !hasEntity
        }
    }
};

WordSystem.prototype._syncResonanceAbsorb = function(rd) {
    if (!window.WordConfig || !window.WordConfig.schoolFinishers) return false;
    var changed = false;
    var sf = window.WordConfig.schoolFinishers;
    for (var faction in sf) {
        if (this.countSchoolCards(faction) < 2) continue;
        var entityIds = sf[faction].entityCardIds || [];
        for (var i = 0; i < entityIds.length; i++) {
            var eid = entityIds[i];
            if (!this.hasCard(eid)) continue;
            // 把手牌精煉層併入共鳴層，再 +1（吸收還格的精煉）
            var prior = Math.max(this.getFinisherLevel(faction), this._levels[eid] || 0);
            this._removeOwnedCard(eid);
            if (this._levels[eid] !== undefined) delete this._levels[eid];
            if (!this._finisherLevels) this._finisherLevels = {};
            this._finisherLevels[faction] = prior + 1;
            changed = true;
        }
    }
    return changed;
};

WordSystem.prototype._breakTierAt = function(def, level, mode) {
    if (!def || !def.breakTiers || !def.breakTiers.length) return null;
    var idx = level || 0;
    if (idx >= def.breakTiers.length) idx = def.breakTiers.length - 1;
    var tier = def.breakTiers[idx];
    if (!tier) return null;
    var m = mode || this._getMode();
    if (m === 'rogue') m = 'pve';
    return tier[m] || tier.pve || null;
};

WordSystem.prototype._poiseTierAt = function(def, level) {
    if (!def || !def.poiseTiers || !def.poiseTiers.length) return null;
    var idx = level || 0;
    if (idx >= def.poiseTiers.length) idx = def.poiseTiers.length - 1;
    return def.poiseTiers[idx];
};

WordSystem.prototype._benevolenceTierAt = function(def, level, mode) {
    if (!def || !def.benevolenceTiers || !def.benevolenceTiers.length) return null;
    var idx = level || 0;
    if (idx >= def.benevolenceTiers.length) idx = def.benevolenceTiers.length - 1;
    var tier = def.benevolenceTiers[idx];
    if (!tier) return null;
    var m = mode || this._getMode();
    if (m === 'rogue') m = 'pve';
    return tier[m] || tier.pve || null;
};

WordSystem.prototype._applyBreakTiers = function(result, def, level, mode) {
    var block = this._breakTierAt(def, level, mode);
    if (!block) return;
    this._applyStatBlock(result, block, 1, 0, 0);
};

WordSystem.prototype._applyPoiseTiers = function(result, def, level) {
    var tier = this._poiseTierAt(def, level);
    if (!result.poiseCharge) return;
    if (!tier) {
        result.poiseCharge.requireNearEnemy = true;
        result.poiseCharge.dodgeClears = true;
        return;
    }
    result.poiseCharge.requireNearEnemy = tier.requireNearEnemy !== false;
    result.poiseCharge.dodgeClears = tier.dodgeClears !== false;
};

WordSystem.prototype._applyBenevolenceTiers = function(result, def, level, mode, allyCount, vanguardCount) {
    var block = this._benevolenceTierAt(def, level, mode);
    if (!block) return;
    this._applyStatBlock(result, block, 1, allyCount || 0, vanguardCount || 0);
    this._collectTriggerStats(result, block, 1);
};

WordSystem.prototype._applyRapidTiers = function(result, def, level) {
    if (!def || !def.rapidTiers || !def.rapidTiers.length) return;
    var idx = level || 0;
    if (idx >= def.rapidTiers.length) idx = def.rapidTiers.length - 1;
    var tier = def.rapidTiers[idx];
    if (!tier) return;
    if (tier.reloadMul) result.reloadMul *= tier.reloadMul;
    if (tier.dashRechargeMul) result.dashRechargeMul *= tier.dashRechargeMul;
    if (tier.ammoBonus) result.ammoBonus += tier.ammoBonus;
    if (tier.dashChargesBonus) result.dashChargesBonus += tier.dashChargesBonus;
};

WordSystem.prototype.computeBuffs = function(rd) {
    return this.computeCombatStats(rd);
};

WordSystem.prototype._applySignatureArmyBuff = function(result, mode) {
    if (!result || !this._sigIsEffect()) return;
    var def = this._sigDef();
    if (!def || !def.tiers) return;
    var tier = def.tiers[this._sigTier || 0];
    if (!tier) return;
    var m = mode || this._getMode();
    if (m === 'rogue') m = 'pve';
    var block = tier[m] || tier.pve;
    if (!block) return;
    // 本命 tier 數值已是最終檔，不再乘精煉 effectScale
    if (block.dmgMul) result.dmgMul *= block.dmgMul;
    if (block.hpMul) result.hpMul *= block.hpMul;
    if (block.speedMul) result.speedMul *= block.speedMul;
    if (block.reloadMul) result.reloadMul *= block.reloadMul;
};

WordSystem.prototype.computeCombatStats = function(rd, opts) {
    var result = this._identityBuffs();
    result.onCritEffects = [];
    if (!window.WordConfig || !window.WordConfig.cards) return result;

    opts = opts || {};
    var mode = this._getMode();
    var allyCount = (opts.allyCount !== undefined) ? opts.allyCount : this.countAliveAllies(rd);
    var vanguardCount = (opts.vanguardCount !== undefined) ? opts.vanguardCount : this.countVanguardAllies(rd);
    var cap = 0.6;
    var dodgeCap = 0.65;
    var CR = this._getCombatResolver();
    if (CR && CR.CRIT_CHANCE_CAP) cap = CR.CRIT_CHANCE_CAP;
    if (CR && CR.DODGE_CHANCE_CAP) dodgeCap = CR.DODGE_CHANCE_CAP;

    for (var i = 0; i < this._owned.length; i++) {
        var cardId = this._owned[i];
        var def = this.getCardDef(cardId);
        var block = this._getStatBlock(def, mode);
        if (!def) continue;
        var scale = this._effectScale(cardId);
        var upLv = this.getUpgradeLevel(cardId);
        if (def.rapidTiers) {
            this._applyRapidTiers(result, def, upLv);
        } else if (def.breakTiers) {
            this._applyBreakTiers(result, def, upLv, mode);
        } else if (def.benevolenceTiers) {
            this._applyBenevolenceTiers(result, def, upLv, mode, allyCount, vanguardCount);
        } else if (block) {
            this._applyStatBlock(result, block, scale, allyCount, vanguardCount);
            this._collectBasicProcs(result, block, scale);
            this._collectTriggerStats(result, block, scale);
        }
        if (def.poiseTiers && block && block.poiseCharge) {
            if (def.breakTiers || def.benevolenceTiers || def.rapidTiers) {
                this._collectTriggerStats(result, block, scale);
            }
            this._applyPoiseTiers(result, def, upLv);
        }
        this._collectProcModifiers(result, def, upLv);
        this._collectOnCritEffects(result, def, scale);
    }

    // 本命槽光環（如威震全軍攻％）— 不在 owned 裡，需另加
    this._applySignatureArmyBuff(result, mode);

    // 學派共鳴收尾（不佔格）
    this._applySchoolResonanceEffects(result, mode);

    this._finalizeBasicProcs(result);

    if (result.critChance > cap) result.critChance = cap;
    if (result.dodgeChance > dodgeCap) result.dodgeChance = dodgeCap;
    if (result.dmgMul < 0.1) result.dmgMul = 0.1;
    if (result.hpMul < 0.1) result.hpMul = 0.1;
    if (result.damageTakenMul < 0.1) result.damageTakenMul = 0.1;
    return result;
};

WordSystem.prototype._buffDelta = function(oldB, newB) {
    var delta = {};
    var mulKeys = ['dmgMul', 'hpMul', 'speedMul', 'reloadMul', 'damageTakenMul', 'dotMul', 'ccDurationMul', 'critMul'];
    for (var i = 0; i < mulKeys.length; i++) {
        var k = mulKeys[i];
        var o = (oldB && oldB[k] !== undefined) ? oldB[k] : 1;
        var n = (newB && newB[k] !== undefined) ? newB[k] : 1;
        if (Math.abs(n - o) > 0.0001) delta[k] = n / o;
    }
    return delta;
};

WordSystem.prototype._shieldPctIncreased = function(oldB, newB) {
    var o = (oldB && oldB.shieldMaxPct) ? oldB.shieldMaxPct : 0;
    var n = (newB && newB.shieldMaxPct) ? newB.shieldMaxPct : 0;
    return n > o + 0.0001;
};

WordSystem.prototype._migrateRetiredShuCards = function() {
    var bump = 0;
    var owned = this._owned || [];
    var next = [];
    for (var i = 0; i < owned.length; i++) {
        var id = owned[i];
        if (id === 'shu_echo_n') { bump = Math.max(bump, 1); continue; }
        if (id === 'shu_volley_n') { bump = Math.max(bump, 2); continue; }
        if (id === 'shu_ember_r') { continue; }
        next.push(id);
    }
    if (next.length === owned.length && bump === 0) return;
    this._owned = next;
    if (bump > 0 && this.hasCard('shu_sigil_n')) {
        this._levels.shu_sigil_n = Math.max(this._levels.shu_sigil_n || 0, bump);
    }
};

WordSystem.prototype._migrateRetiredCards = function() {
    var owned = this._owned || [];
    var changed = false;
    var next = [];
    for (var i = 0; i < owned.length; i++) {
        var id = owned[i];
        if (id === 'wu_pierce_r') {
            changed = true;
            var hasBreak = this.hasCard('wu_break_n');
            if (!hasBreak && next.indexOf('wu_break_n') < 0) {
                next.push('wu_break_n');
            }
            this._levels.wu_break_n = Math.min(2, (this._levels.wu_break_n || 0) + 1);
            continue;
        }
        if (id === 'wu_berserk_n') {
            changed = true;
            if (!this.hasCard('ti_pot_n')) {
                next.push('ti_pot_n');
            }
            continue;
        }
        next.push(id);
    }
    if (changed) this._owned = next;
};

WordSystem.prototype.reapplyBuffs = function(rd) {
    this._migrateRetiredShuCards();
    this._migrateRetiredCards();
    var newB = this.computeCombatStats(rd);
    var fillShield = this._shieldPctIncreased(this._lastBuffs, newB);
    this._lastBuffs = newB;

    if (rd && rd._applyAbsoluteWordBuffs) {
        newB._fillShield = fillShield;
        rd._applyAbsoluteWordBuffs(newB);
    } else {
        var delta = this._buffDelta(this._lastBuffs, newB);
        var hasDelta = false;
        for (var k in delta) { hasDelta = true; break; }
        if (hasDelta && rd && rd._buffWholeArmy) rd._buffWholeArmy(delta);
        newB._fillShield = fillShield;
        var CR = this._getCombatResolver();
        if (CR && CR.applyArmyCombatStats) CR.applyArmyCombatStats(this.app, newB);
    }

    this.app.fire('rogue:extraBuffs', newB);
    var newly = this._diffNewlyActivatedResonance(newB.activeResonances);
    if (newly.length && this.app && this.app.fire) {
        this.app.fire('rogue:resonanceActivated', newly);
    }
    return newB;
};

WordSystem.prototype._getOwnedExclusiveGroups = function() {
    var groups = {};
    for (var i = 0; i < this._owned.length; i++) {
        var def = this.getCardDef(this._owned[i]);
        if (!def) continue;
        if (def.exclusiveGroup) groups[def.exclusiveGroup] = true;
        if (def.crossExclusive) {
            for (var c = 0; c < def.crossExclusive.length; c++) groups[def.crossExclusive[c]] = true;
        }
    }
    var pairs = (window.WordConfig && window.WordConfig.crossExclusive) ? window.WordConfig.crossExclusive : [];
    for (var p = 0; p < pairs.length; p++) {
        var pair = pairs[p];
        for (var o = 0; o < this._owned.length; o++) {
            var od = this.getCardDef(this._owned[o]);
            if (!od || !od.exclusiveGroup) continue;
            if (od.exclusiveGroup === pair[0]) groups[pair[1]] = true;
            if (od.exclusiveGroup === pair[1]) groups[pair[0]] = true;
        }
    }
    return groups;
};

WordSystem.prototype._cardConflictsWithOwned = function(cardId) {
    var def = this.getCardDef(cardId);
    if (!def) return true;
    var ownedGroups = this._getOwnedExclusiveGroups();
    if (def.exclusiveGroup && ownedGroups[def.exclusiveGroup]) return true;
    if (def.crossExclusive) {
        for (var i = 0; i < def.crossExclusive.length; i++) {
            if (ownedGroups[def.crossExclusive[i]]) return true;
        }
    }
    if (def.exclusiveGroup) {
        var pairs = (window.WordConfig && window.WordConfig.crossExclusive) ? window.WordConfig.crossExclusive : [];
        for (var p = 0; p < pairs.length; p++) {
            if (pairs[p].indexOf(def.exclusiveGroup) < 0) continue;
            for (var g = 0; g < pairs[p].length; g++) {
                if (pairs[p][g] !== def.exclusiveGroup && ownedGroups[pairs[p][g]]) return true;
            }
        }
    }
    return false;
};

WordSystem.prototype._cardMeetsPrerequisites = function(cardId) {
    var def = this.getCardDef(cardId);
    if (!def) return false;
    if (def.requiresCard && !this.hasCard(def.requiresCard)) return false;
    if (def.requiresCards) {
        for (var i = 0; i < def.requiresCards.length; i++) {
            if (!this.hasCard(def.requiresCards[i])) return false;
        }
    }
    return true;
};

WordSystem.prototype.addCard = function(cardId, rd) {
    if (!this.getCardDef(cardId)) return false;
    if (!this._cardMeetsPrerequisites(cardId)) return false;
    if (this.hasCard(cardId)) return false;

    var def = this.getCardDef(cardId);
    // 已共鳴時再抽到收尾實體卡 → 精煉不佔格
    if (def && def.schoolFinisher && def.faction) {
        var prog = this.getResonanceProgress(def.faction);
        if (prog.active || this.countSchoolCards(def.faction) >= 2) {
            this._bumpFinisherLevel(def.faction);
            return this.reapplyBuffs(rd);
        }
    }

    if (!this.canAddCard()) return false;
    this._owned.push(cardId);
    this._syncResonanceAbsorb(rd);
    return this.reapplyBuffs(rd);
};

WordSystem.prototype.upgradeCard = function(cardId, rd) {
    var def = this.getCardDef(cardId);
    if (!def) return false;
    if (!this.canUpgradeCard(cardId, rd)) return false;

    // 收尾卡：手牌／虛擬精煉都推進共鳴層（desc／數值同源）
    if (def.schoolFinisher && def.faction) {
        this._bumpFinisherLevel(def.faction);
        if (this.hasCard(cardId)) {
            this._levels[cardId] = this.getFinisherLevel(def.faction);
        }
        return this.reapplyBuffs(rd);
    }

    if (!this.hasCard(cardId)) return false;
    this._levels[cardId] = (this._levels[cardId] || 0) + 1;
    return this.reapplyBuffs(rd);
};

WordSystem.prototype.onSquadChanged = function(rd) {
    return this.reapplyBuffs(rd);
};

// 本命選擇也要推進開局步數(本命佔一次開局選擇)
WordSystem.prototype._bumpOpeningStep = function() {
    this._openingStep++;
    var need = (window.WordConfig && window.WordConfig.openingPicks) ? window.WordConfig.openingPicks : 2;
    if (this._openingStep >= need) this._openingDone = true;
};

WordSystem.prototype.completeOpeningPick = function(cardId, rd) {
    if (!this.addCard(cardId, rd)) return false;
    this._openingStep++;
    var need = (window.WordConfig && window.WordConfig.openingPicks) ? window.WordConfig.openingPicks : 2;
    if (this._openingStep >= need) this._openingDone = true;
    return true;
};

WordSystem.prototype._shuffle = function(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
};

WordSystem.prototype._buildPool = function(excludeOwned, excludeIds, opts) {
    excludeOwned = !!excludeOwned;
    excludeIds = excludeIds || {};
    opts = opts || {};
    var pool = [];
    var ids = window.WordConfig.allCardIds || [];
    for (var i = 0; i < ids.length; i++) {
        var id = ids[i];
        if (excludeOwned && this.hasCard(id)) continue;
        if (excludeIds[id]) continue;
        var defPool = this.getCardDef(id);
        if (defPool && defPool.retired) continue;
        if (!this._cardMeetsPrerequisites(id)) continue;
        if (this._cardConflictsWithOwned(id)) continue;
        // 共鳴已給該派收尾時，不再出實體收尾卡（升階只走精煉卡，避免雙出）
        if (defPool && defPool.schoolFinisher && defPool.faction &&
            this._isSchoolFinisherGranted(defPool.faction)) {
            continue;
        }
        if (opts.excludeEffect) {
            var defEx = this.getCardDef(id);
            if (defEx && defEx.cardType === 'effect') continue;
        }
        pool.push(id);
    }
    return pool;
};

WordSystem.prototype.getRarityWeight = function(rarity) {
    var weights = (window.WordConfig && window.WordConfig.rarityWeights)
        ? window.WordConfig.rarityWeights
        : { N: 1, R: 0.32, SR: 0.10, SSR: 0.04 };
    if (rarity && weights[rarity] !== undefined) return weights[rarity];
    return weights.N !== undefined ? weights.N : 1;
};

WordSystem.prototype.getCardDraftWeight = function(cardId) {
    var def = this.getCardDef(cardId);
    var w = this.getRarityWeight(def && def.rarity);
    if (!def) return w;
    if (def.draftWeightMul) w *= def.draftWeightMul;
    if (def.offerBoostIfOwned && def.offerBoostIfOwned.length) {
        for (var i = 0; i < def.offerBoostIfOwned.length; i++) {
            if (this.hasCard(def.offerBoostIfOwned[i])) {
                w *= (def.offerBoostMul || 3);
                break;
            }
        }
    }
    return w;
};

WordSystem.prototype._pickWeightedIds = function(pool, count) {
    count = count || 1;
    var out = [];
    var remaining = pool.slice();

    while (out.length < count && remaining.length > 0) {
        var totalW = 0;
        var wList = [];
        for (var i = 0; i < remaining.length; i++) {
            var w = this.getCardDraftWeight(remaining[i]);
            if (w < 0) w = 0;
            wList.push(w);
            totalW += w;
        }
        if (totalW <= 0) {
            out.push(remaining[0]);
            remaining.splice(0, 1);
            continue;
        }
        var roll = Math.random() * totalW;
        var acc = 0;
        var pickIdx = 0;
        for (var j = 0; j < remaining.length; j++) {
            acc += wList[j];
            if (roll <= acc) { pickIdx = j; break; }
        }
        out.push(remaining[pickIdx]);
        remaining.splice(pickIdx, 1);
    }
    return out;
};

WordSystem.prototype.rollCardChoices = function(count, excludeOwned, fixedPool, opts) {
    opts = opts || {};
    count = count || 3;
    var pool = fixedPool ? fixedPool.slice() : this._buildPool(excludeOwned, opts.excludeIds, opts);

    if (opts.forceRarity) {
        var forced = [];
        for (var f = 0; f < pool.length; f++) {
            var fdef = this.getCardDef(pool[f]);
            if (fdef && fdef.rarity === opts.forceRarity) forced.push(pool[f]);
        }
        if (forced.length > 0) pool = forced;
    }

    return this._pickWeightedIds(pool, count);
};

WordSystem.prototype.isRareCard = function(cardId) {
    var def = this.getCardDef(cardId);
    return !!(def && def.rarity === 'R');
};

WordSystem.prototype.getRecruitBonusLines = function(bType, rd) {
    var lines = [];
    if (!window.BrawlerConfig || !window.BrawlerConfig[bType]) return lines;
    var cfg = window.BrawlerConfig[bType];
    var role = cfg.allyRole || '';

    for (var i = 0; i < this._owned.length; i++) {
        var def = this.getCardDef(this._owned[i]);
        if (!def) continue;
        var lv = this.getUpgradeLevel(this._owned[i]);
        if (def.type === 'scaling') {
            lines.push(this._cardName(def) + ': ' + this.formatCardEffectLine(def, lv, rd));
        }
        if (def.pve && def.pve.perAllyRole && def.pve.perAllyRole.vanguard && role === 'vanguard') {
            lines.push('Vanguard boost: ' + this._cardName(def));
        }
    }
    return lines;
};