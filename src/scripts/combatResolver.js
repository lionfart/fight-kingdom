// ═══════════════════════════════════════════════════════════════
// CombatResolver — 護盾 / 破盾 / 暴擊 命中解析
// 掛到 Entity；initialize 後 window.CombatResolver / app.combatResolver 可用
// ═══════════════════════════════════════════════════════════════
var CombatResolver = pc.createScript('combatResolver');

CombatResolver.SHIELD_REGEN_DELAY_MS = 3000;
CombatResolver.SHIELD_REGEN_RATE = 0.20;
CombatResolver.HP_REGEN_RATE = 0.13;
CombatResolver.CRIT_CHANCE_CAP = 0.60;
CombatResolver.PVP_CRIT_MUL_CAP = 1.22;
CombatResolver.DEFAULT_CRIT_MUL = 1.5;

/** 扇形第 index 發的瞄準角（弧度）。全圓（≥359.5°）用 count 等分，避免首尾同向重疊。 */
CombatResolver.getSpreadAngle = function(aimAngle, spreadAngleDeg, index, count) {
    if (!count || count <= 1) return aimAngle;
    var deg = spreadAngleDeg || 0;
    var tRad = deg * Math.PI / 180;
    if (tRad <= 0) return aimAngle;
    if (Math.abs(deg) >= 359.5) {
        return aimAngle + (tRad / count) * index;
    }
    return aimAngle - tRad / 2 + (tRad / (count - 1)) * index;
};

CombatResolver.prototype.initialize = function() {
    this.app.combatResolver = CombatResolver;
    if (typeof window !== 'undefined') window.CombatResolver = CombatResolver;
};

// ── Mode ───────────────────────────────────────────────────────
CombatResolver.getMode = function(app) {
    var mode = String((app && app.gameMode) || '').toUpperCase();
    if (mode === 'ROGUE') return 'rogue';
    if (mode === 'FFA' || mode === 'PVP' || mode === 'GEMGRAB' || mode === 'BOUNTY') return 'pvp';
    return 'pve';
};

CombatResolver._emptyAttackerStats = function() {
    return {
        critChance: 0,
        critMul: CombatResolver.DEFAULT_CRIT_MUL,
        bonusVsShield: 0,
        onShieldBreakDmgPct: 0,
        onCritEffects: [],
        emberDetonate: null,
        fireSustain: null,
        scaleCounter: null,
        windReturn: null,
        poiseCharge: null,
        shieldBreakBurst: null,
        shieldBreakRetaliation: null,
        chainHarvest: null,
        lifestealPct: 0,
        dmgMul: 1
    };
};

CombatResolver._emptyArmyStats = function() {
    return {
        critChance: 0,
        critMul: CombatResolver.DEFAULT_CRIT_MUL,
        bonusVsShield: 0,
        onShieldBreakDmgPct: 0,
        shieldMaxPct: 0,
        dodgeChance: 0,
        procAllyDamagePct: 0,
        basicProcs: [],
        onCritEffects: [],
        execute: null,
        onKill: null,
        hpLostScaling: null,
        onLowHpTriggers: [],
        auras: [],
        breachWindow: null,
        emberDetonate: null,
        fireSustain: null,
        scaleCounter: null,
        windReturn: null,
        poiseCharge: null,
        shieldBreakBurst: null,
        shieldBreakRetaliation: null,
        chainHarvest: null,
        lifestealPct: 0,
        dmgMul: 1,
        dashRechargeMul: 1,
        ammoBonus: 0,
        dashChargesBonus: 0,
        activeResonances: {}
    };
};

// ── Shield unit helpers ────────────────────────────────────────
CombatResolver._readShieldHP = function(unit) {
    if (!unit) return 0;
    return Math.max(0, unit.shieldHP || 0);
};

CombatResolver._readShieldMax = function(unit) {
    if (!unit) return 0;
    return Math.max(0, unit.shieldMax || 0);
};

CombatResolver._writeShield = function(unit, hp, max) {
    if (!unit) return;
    if (max !== undefined && max !== null) unit.shieldMax = Math.max(0, Math.round(max));
    if (hp !== undefined && hp !== null) {
        var cap = unit.shieldMax || 0;
        unit.shieldHP = Math.max(0, Math.min(Math.round(hp), cap));
    }
};

CombatResolver.getMaxHP = function(unit) {
    if (!unit) return 0;
    if (unit.maxHealth !== undefined) return unit.maxHealth;
    if (unit.maxHp !== undefined) return unit.maxHp;
    if (unit.maxHP !== undefined) return unit.maxHP;
    return 0;
};

CombatResolver.hasShieldTag = function(unit) {
    return CombatResolver._readShieldHP(unit) > 0;
};

CombatResolver.grantShieldPct = function(unit, pct, fill) {
    if (!unit || !pct || pct <= 0) return;
    var maxHp = CombatResolver.getMaxHP(unit);
    if (maxHp <= 0) return;
    var newMax = Math.round(maxHp * pct);
    CombatResolver._writeShield(unit, fill ? newMax : CombatResolver._readShieldHP(unit), newMax);
};

CombatResolver.refreshShieldToMax = function(unit) {
    if (!unit) return;
    var max = CombatResolver._readShieldMax(unit);
    if (max > 0) CombatResolver._writeShield(unit, max, max);
};

CombatResolver.applyShieldAbsorb = function(unit, damage, hitMeta) {
    if (!unit || damage <= 0) return { hpDamage: damage, absorbed: 0, shieldBroken: false };
    hitMeta = hitMeta || {};
    // 必中／破盾：直打血量；若原本有盾則清盾並觸發破釜／破盾爆發
    if (hitMeta.trueStrike || hitMeta.pierceShield) {
        var shieldBefore = CombatResolver._readShieldHP(unit);
        var hadShield = shieldBefore > 0;
        if (hadShield) CombatResolver._writeShield(unit, 0, unit.shieldMax);
        return {
            hpDamage: damage,
            absorbed: 0,
            shieldBroken: hadShield,
            pierced: true,
            shieldStripped: hadShield
        };
    }
    var shieldBefore = CombatResolver._readShieldHP(unit);
    if (shieldBefore <= 0) return { hpDamage: damage, absorbed: 0, shieldBroken: false };

    var absorbed = Math.min(damage, shieldBefore);
    var remaining = damage - absorbed;
    var shieldAfter = shieldBefore - absorbed;
    CombatResolver._writeShield(unit, shieldAfter, unit.shieldMax);

    return {
        hpDamage: remaining,
        absorbed: absorbed,
        shieldBroken: shieldBefore > 0 && shieldAfter <= 0
    };
};

// 下一擊修飾（逆鱗／風返／蓄勢／破釜共用）
CombatResolver.grantNextHitMod = function(unit, bonusDmg, meta) {
    if (!unit || !(bonusDmg > 0)) return;
    meta = meta || {};
    if (!unit._nextHitMods) unit._nextHitMods = { bonusDmg: 0, sources: {} };
    var src = meta.source || 'default';
    var prev = unit._nextHitMods.sources[src] || 0;
    if (bonusDmg > prev) {
        unit._nextHitMods.bonusDmg = (unit._nextHitMods.bonusDmg - prev) + bonusDmg;
        unit._nextHitMods.sources[src] = bonusDmg;
    }
    if (meta.expiresAt) unit._nextHitMods.expiresAt = meta.expiresAt;
};

CombatResolver.consumeNextHitMod = function(unit, hitMeta) {
    if (!unit || !unit._nextHitMods) return 0;
    var mods = unit._nextHitMods;
    if (mods.expiresAt && Date.now() > mods.expiresAt) {
        unit._nextHitMods = null;
        return 0;
    }
    var bonus = mods.bonusDmg || 0;
    unit._nextHitMods = null;
    if (hitMeta && bonus > 0) hitMeta.nextHitModConsumed = bonus;
    return bonus;
};

CombatResolver.clearNextHitMod = function(unit, source) {
    if (!unit || !unit._nextHitMods) return;
    if (!source) {
        unit._nextHitMods = null;
        return;
    }
    var prev = unit._nextHitMods.sources && unit._nextHitMods.sources[source];
    if (!prev) return;
    unit._nextHitMods.bonusDmg = Math.max(0, (unit._nextHitMods.bonusDmg || 0) - prev);
    delete unit._nextHitMods.sources[source];
    if (!(unit._nextHitMods.bonusDmg > 0)) unit._nextHitMods = null;
};

/** 短暫加攻就緒（蓄勢／逆鱗／破釜／風返）→ UI 顯示 ⏫ */
CombatResolver.isNextHitModArmed = function(unit) {
    if (!unit) return false;
    if (CombatResolver.hasScaleCounterReady(unit)) return true;
    if (CombatResolver.isPoiseChargeReady(unit)) return true;
    if (!unit._nextHitMods) return false;
    if (unit._nextHitMods.expiresAt && Date.now() > unit._nextHitMods.expiresAt) {
        unit._nextHitMods = null;
        return false;
    }
    return (unit._nextHitMods.bonusDmg || 0) > 0;
};

CombatResolver.isPoiseChargeReady = function(unit) {
    if (!unit || !unit._combatStats || !unit._combatStats.poiseCharge) return false;
    var cfg = unit._combatStats.poiseCharge;
    return (unit._poiseChargeSec || 0) > (cfg.softSec || 0.4);
};

CombatResolver.getScaleCounterStacks = function(unit) {
    if (!unit) return 0;
    return Math.max(0, unit._scaleCounterStacks || 0);
};

CombatResolver.hasScaleCounterReady = function(unit) {
    return CombatResolver.getScaleCounterStacks(unit) > 0;
};

CombatResolver.addScaleCounterStack = function(unit, cfg) {
    if (!unit || !cfg) return;
    var maxStacks = cfg.maxStacks || 3;
    var stacks = unit._scaleCounterStacks || 0;
    if (stacks < maxStacks) unit._scaleCounterStacks = stacks + 1;
};

CombatResolver.consumeScaleCounterStacks = function(unit, hitMeta) {
    if (!unit || !unit._combatStats || !unit._combatStats.scaleCounter) return 0;
    var stacks = unit._scaleCounterStacks || 0;
    if (stacks <= 0) return 0;
    unit._scaleCounterStacks = 0;
    var per = unit._combatStats.scaleCounter.perStackBonus
        || unit._combatStats.scaleCounter.nextHitDmgBonus || 0.25;
    var bonus = per * stacks;
    if (hitMeta && bonus > 0) hitMeta.scaleCounterConsumed = { stacks: stacks, bonus: bonus };
    return bonus;
};

CombatResolver.hasBreachMark = function(unit) {
    if (!unit || !unit._breachMark || !unit._breachMark.until) return false;
    if (Date.now() > unit._breachMark.until) {
        unit._breachMark = null;
        return false;
    }
    return true;
};

CombatResolver.hasChainHarvestMark = function(unit) {
    if (!unit || !unit._chainHarvestMark || !unit._chainHarvestMark.until) return false;
    if (Date.now() > unit._chainHarvestMark.until) {
        unit._chainHarvestMark = null;
        return false;
    }
    return true;
};

/** 組頭上狀態字串：暈燒血 + 破／斬 + ⏫ */
CombatResolver.buildStatusIcons = function(unit) {
    var s = '';
    if (!unit) return s;
    if (unit.stunTimer > 0 && unit._initialStunDuration >= 0.5) s += '💫';
    if (window.WordSystem) {
        if (WordSystem.hasActiveBleedDot(unit.activeStates)) s += '☠️';
        if (WordSystem.hasActiveFireDot(unit.activeStates)) s += '🔥';
    }
    if (CombatResolver.hasBreachMark(unit)) s += '破';
    if (CombatResolver.hasChainHarvestMark(unit)) s += '斬';
    if (CombatResolver.isNextHitModArmed(unit)) s += '⏫';
    return s;
};

// ── Regen (OOC) ────────────────────────────────────────────────
CombatResolver.tickShieldRegen = function(unit, dt) {
    if (!unit || dt <= 0) return;
    var max = CombatResolver._readShieldMax(unit);
    if (max <= 0) return;
    var cur = CombatResolver._readShieldHP(unit);
    if (cur >= max) return;

    var lastDmg = unit.lastDamageTime || 0;
    if ((Date.now() - lastDmg) <= CombatResolver.SHIELD_REGEN_DELAY_MS) return;

    var next = Math.min(max, cur + max * CombatResolver.SHIELD_REGEN_RATE * dt);
    CombatResolver._writeShield(unit, next, max);
};

CombatResolver.syncShieldMaxFromPct = function(unit, shieldMaxPct, fillNew) {
    if (!unit) return;
    if (!shieldMaxPct || shieldMaxPct <= 0) {
        CombatResolver._writeShield(unit, 0, 0);
        unit.shieldMaxPct = 0;
        return;
    }
    unit.shieldMaxPct = shieldMaxPct;
    var maxHp = CombatResolver.getMaxHP(unit);
    if (maxHp <= 0) return;
    var newMax = Math.round(maxHp * shieldMaxPct);
    var oldMax = CombatResolver._readShieldMax(unit);
    var cur = CombatResolver._readShieldHP(unit);
    if (fillNew || newMax > oldMax) cur = newMax;
    else cur = Math.min(cur, newMax);
    CombatResolver._writeShield(unit, cur, newMax);
};

// ── Attacker stats ─────────────────────────────────────────────
CombatResolver.getAttackerStats = function(app, attackerId, attackerType) {
    var stats = CombatResolver._emptyAttackerStats();
    if (!app || !attackerId) return stats;

    if (attackerId === 'player' && app.playerController && app.playerController._combatStats) {
        return CombatResolver._mergeAttackerStats(stats, app.playerController._combatStats);
    }

    if (attackerType === 'bot' || attackerId.indexOf('ally_') === 0 || attackerId.indexOf('rogue_') === 0 || attackerId.indexOf('bot_') === 0 || attackerId.indexOf('pve_bot_') === 0) {
        var bCtrl = app.botController;
        if (bCtrl && bCtrl.bots) {
            for (var i = 0; i < bCtrl.bots.length; i++) {
                var bot = bCtrl.bots[i];
                if (bot.id === attackerId) {
                    if (bot._combatStats) return CombatResolver._mergeAttackerStats(stats, bot._combatStats);
                    break;
                }
            }
        }
    }

    return stats;
};

CombatResolver._getUnit = function(app, unitId, unitType) {
    if (!app || !unitId) return null;

    var isPlayer = unitType === 'player'
        || unitId === 'player'
        || (app.myId && unitId === app.myId)
        || (app.socketId && unitId === app.socketId);
    if (isPlayer) return app.playerController || null;

    var bCtrl = app.botController;
    if (!bCtrl || !bCtrl.bots) return null;
    for (var i = 0; i < bCtrl.bots.length; i++) {
        var bot = bCtrl.bots[i];
        if (bot && bot.id === unitId) return bot;
    }
    return null;
};

CombatResolver._getUnitId = function(unit) {
    if (!unit) return null;
    if (unit.id) return unit.id;
    if (unit.player && !unit.id) return 'player';
    return null;
};

CombatResolver._mergeAttackerStats = function(base, extra) {
    if (!extra) return base;
    var out = {
        critChance: extra.critChance || 0,
        critMul: extra.critMul || CombatResolver.DEFAULT_CRIT_MUL,
        bonusVsShield: extra.bonusVsShield || 0,
        onShieldBreakDmgPct: extra.onShieldBreakDmgPct || 0,
        shieldMaxPct: extra.shieldMaxPct || 0,
        dodgeChance: extra.dodgeChance || 0,
        procAllyDamagePct: extra.procAllyDamagePct || 0,
        basicProcs: extra.basicProcs ? extra.basicProcs.slice() : [],
        onCritEffects: extra.onCritEffects ? extra.onCritEffects.slice() : [],
        execute: extra.execute ? Object.assign({}, extra.execute) : null,
        onKill: extra.onKill ? Object.assign({}, extra.onKill) : null,
        hpLostScaling: extra.hpLostScaling ? Object.assign({}, extra.hpLostScaling) : null,
        onLowHpTriggers: extra.onLowHpTriggers ? extra.onLowHpTriggers.slice() : [],
        auras: extra.auras ? extra.auras.slice() : [],
        breachWindow: extra.breachWindow ? Object.assign({}, extra.breachWindow) : null,
        emberDetonate: extra.emberDetonate ? Object.assign({}, extra.emberDetonate) : null,
        fireSustain: extra.fireSustain ? Object.assign({}, extra.fireSustain) : null,
        scaleCounter: extra.scaleCounter ? Object.assign({}, extra.scaleCounter) : null,
        windReturn: extra.windReturn ? Object.assign({}, extra.windReturn) : null,
        poiseCharge: extra.poiseCharge ? Object.assign({}, extra.poiseCharge) : null,
        shieldBreakBurst: extra.shieldBreakBurst ? Object.assign({}, extra.shieldBreakBurst) : null,
        shieldBreakRetaliation: extra.shieldBreakRetaliation ? Object.assign({}, extra.shieldBreakRetaliation) : null,
        chainHarvest: extra.chainHarvest ? Object.assign({}, extra.chainHarvest) : null,
        lifestealPct: extra.lifestealPct || 0,
        dmgMul: extra.dmgMul || 1,
        dashRechargeMul: extra.dashRechargeMul || 1,
        ammoBonus: extra.ammoBonus || 0,
        dashChargesBonus: extra.dashChargesBonus || 0,
        activeResonances: extra.activeResonances ? Object.assign({}, extra.activeResonances) : {}
    };
    if (out.breachWindow && extra.breachWindow && extra.breachWindow.markOnDot) {
        out.breachWindow.markOnDot = extra.breachWindow.markOnDot.slice();
    }
    return out;
};

CombatResolver.applyArmyCombatStats = function(app, armyStats) {
    if (!app || !armyStats) return;
    armyStats = armyStats || CombatResolver._emptyArmyStats();

    var fillShield = !!armyStats._fillShield;
    var mode = CombatResolver.getMode(app);
    var fillOnPct = fillShield || (mode === 'pvp');

    if (app.playerController && !app.playerController.isDead) {
        app.playerController._combatStats = CombatResolver._mergeAttackerStats(CombatResolver._emptyAttackerStats(), armyStats);
        CombatResolver.syncShieldMaxFromPct(app.playerController, armyStats.shieldMaxPct || 0, fillOnPct);
        CombatResolver._notifyShieldUI(app, app.playerController.player);
    }

    var bCtrl = app.botController;
    if (!bCtrl || !bCtrl.bots) return;
    for (var i = 0; i < bCtrl.bots.length; i++) {
        var bot = bCtrl.bots[i];
        if (bot.team !== (app.myTeam || 'blue') || bot.state !== 'alive') continue;
        bot._combatStats = CombatResolver._mergeAttackerStats(CombatResolver._emptyAttackerStats(), armyStats);
        CombatResolver.syncShieldMaxFromPct(bot, armyStats.shieldMaxPct || 0, fillOnPct);
        CombatResolver._notifyShieldUI(app, bot.entity);
    }
};

CombatResolver.refreshArmyShields = function(app) {
    if (!app) return;
    if (app.playerController && !app.playerController.isDead) {
        CombatResolver.refreshShieldToMax(app.playerController);
        CombatResolver._notifyShieldUI(app, app.playerController.player);
    }
    var bCtrl = app.botController;
    if (!bCtrl || !bCtrl.bots) return;
    for (var i = 0; i < bCtrl.bots.length; i++) {
        var bot = bCtrl.bots[i];
        if (bot.team !== (app.myTeam || 'blue') || bot.state !== 'alive') continue;
        CombatResolver.refreshShieldToMax(bot);
        CombatResolver._notifyShieldUI(app, bot.entity);
    }
};

CombatResolver.spawnShieldOnUnit = function(unit, shieldPct, fill) {
    if (!unit || !shieldPct || shieldPct <= 0) return;
    unit.shieldMaxPct = shieldPct;
    CombatResolver.grantShieldPct(unit, shieldPct, fill !== false);
};

// ── Crit ───────────────────────────────────────────────────────
CombatResolver.rollCrit = function(attackerStats, ctx) {
    ctx = ctx || {};
    if (ctx.isDotTick || ctx.skipCrit) return { mul: 1, isCrit: false };

    var chance = attackerStats ? (attackerStats.critChance || 0) : 0;
    if (chance > CombatResolver.CRIT_CHANCE_CAP) chance = CombatResolver.CRIT_CHANCE_CAP;
    if (chance <= 0) return { mul: 1, isCrit: false };

    if (Math.random() >= chance) return { mul: 1, isCrit: false };

    var mul = (attackerStats && attackerStats.critMul) ? attackerStats.critMul : CombatResolver.DEFAULT_CRIT_MUL;
    if (ctx.mode === 'pvp' && mul > CombatResolver.PVP_CRIT_MUL_CAP) mul = CombatResolver.PVP_CRIT_MUL_CAP;
    return { mul: mul, isCrit: true };
};

CombatResolver._applyOnCritEffects = function(hitMeta, attackerStats) {
    if (!hitMeta || !attackerStats || !attackerStats.onCritEffects) return hitMeta;
    hitMeta = hitMeta || {};
    for (var i = 0; i < attackerStats.onCritEffects.length; i++) {
        var fx = attackerStats.onCritEffects[i];
        if (!fx) continue;
        if (fx.snareDuration) {
            hitMeta.snareDuration = Math.max(hitMeta.snareDuration || 0, fx.snareDuration);
            if (fx.snareMultiplier !== undefined) hitMeta.snareMultiplier = fx.snareMultiplier;
        }
        if (fx.stunDuration) hitMeta.stunDuration = Math.max(hitMeta.stunDuration || 0, fx.stunDuration);
    }
    return hitMeta;
};

CombatResolver.FIRE_DOT_TYPES = { burn: 1, flame: 1, inferno: 1 };

CombatResolver.hasFireDot = function(targetUnit) {
    if (!targetUnit || !targetUnit.activeStates) return false;
    for (var k in targetUnit.activeStates) {
        if (targetUnit.activeStates[k] && CombatResolver.FIRE_DOT_TYPES[k]) return true;
    }
    return false;
};

CombatResolver.hadFireDotBeforeHit = function(targetUnit, hitMeta) {
    if (hitMeta && hitMeta._hadFireDotBeforeHit !== undefined) return !!hitMeta._hadFireDotBeforeHit;
    return CombatResolver.hasFireDot(targetUnit);
};

CombatResolver._getAttackerConfig = function(app, attackerId, attackerType) {
    var unit = CombatResolver._getUnit(app, attackerId, attackerType);
    if (!unit && attackerType === 'player' && app && app.playerController) unit = app.playerController;
    if (unit && unit.config) return unit.config;
    if (unit && unit.baseConfig) return unit.baseConfig;
    var brawlerType = unit && unit.brawlerType;
    if (!brawlerType && attackerType === 'player' && app && app.playerController) brawlerType = app.playerController.brawlerType;
    if (!brawlerType || !window.BrawlerConfig) return null;
    return window.BrawlerConfig[brawlerType] || null;
};

CombatResolver.getConditionalDmgMul = function(unit) {
    // Base dmgMul is already applied via applyAbsoluteWordBuffs / weapon config.
    // Only stack conditional kill-layer bonus here.
    if (!unit || !unit._combatStats) return 1;
    var ok = unit._combatStats.onKill;
    if (ok && ok.dmgStack > 0) {
        return 1 + (ok.dmgStack * (unit._wordKillDmgStacks || 0));
    }
    return 1;
};

CombatResolver._applyExecuteBonus = function(app, attackerId, attackerStats, targetUnit, damage) {
    if (!attackerStats || !attackerStats.execute || !targetUnit || !(damage > 0)) return damage;
    var ex = attackerStats.execute;
    var maxHp = CombatResolver.getMaxHP(targetUnit);
    var hp = targetUnit.health !== undefined ? targetUnit.health
        : (targetUnit.hp !== undefined ? targetUnit.hp : targetUnit.currentHealth);
    if (!(maxHp > 0) || !(hp >= 0)) return damage;
    if ((hp / maxHp) > (ex.threshold || 0.25)) return damage;

    var targetId = CombatResolver._getUnitId(targetUnit) || 'target';
    if (!app._executeCooldowns) app._executeCooldowns = {};
    var key = attackerId + '>' + targetId;
    if (app._executeCooldowns[key] && Date.now() < app._executeCooldowns[key]) return damage;
    if (ex.cooldownMs > 0) app._executeCooldowns[key] = Date.now() + ex.cooldownMs;

    return Math.round(damage * (1 + (ex.bonusDmg || 0)));
};

CombatResolver._applyBreachConsume = function(app, attackerStats, targetUnit, damage, hitMeta) {
    if (!targetUnit || !(damage > 0)) return damage;
    if (hitMeta && (hitMeta.isDotTick || hitMeta.isEmberSplash || hitMeta.isBurnSplash || hitMeta.skipBreach)) return damage;
    var mark = targetUnit._breachMark;
    if (!mark || !mark.until) return damage;
    if (Date.now() > mark.until) {
        targetUnit._breachMark = null;
        return damage;
    }
    var bonus = mark.bonusDmg;
    if (!(bonus > 0) && attackerStats && attackerStats.breachWindow) {
        bonus = attackerStats.breachWindow.bonusDmg || 0.30;
    }
    if (!(bonus > 0)) bonus = 0.30;
    damage = Math.round(damage * (1 + bonus));
    targetUnit._breachMark = null;
    if (hitMeta) hitMeta.breachConsumed = true;
    return damage;
};

CombatResolver.resolveBurnSplash = function(app, attackerId, attackerType) {
    var cfg = CombatResolver._getAttackerConfig(app, attackerId, attackerType);
    return cfg && cfg.burnSplash ? Object.assign({}, cfg.burnSplash) : null;
};

CombatResolver.resolveEmberDetonate = function(app, attackerId, attackerType) {
    var unit = CombatResolver._getUnit(app, attackerId, attackerType);
    if (unit && unit._combatStats && unit._combatStats.emberDetonate) {
        return Object.assign({}, unit._combatStats.emberDetonate);
    }
    var cfg = CombatResolver._getAttackerConfig(app, attackerId, attackerType);
    return cfg && cfg.emberDetonate ? Object.assign({}, cfg.emberDetonate) : null;
};

CombatResolver._dealFireSplash = function(app, attackerId, primaryUnit, splashDmg, radius) {
    if (!app || !app.botController || !app.botController.bots || !primaryUnit || !primaryUnit.entity) return;
    if (!(splashDmg > 0) || !(radius > 0)) return;
    var center = primaryUnit.entity.getPosition();
    var r2 = radius * radius;
    for (var i = 0; i < app.botController.bots.length; i++) {
        var bot = app.botController.bots[i];
        if (!bot || bot === primaryUnit || bot.state !== 'alive' || !bot.entity) continue;
        var pos = bot.entity.getPosition();
        var dx = pos.x - center.x;
        var dz = pos.z - center.z;
        if ((dx * dx + dz * dz) > r2) continue;
        if (app.botController && typeof app.botController.hitBot === 'function') {
            app.botController.hitBot(attackerId, bot, splashDmg, false, {
                isBurnSplash: true,
                attackerType: attackerId === 'player' ? 'player' : 'bot'
            });
        }
    }
};

CombatResolver.tryBurnSplash = function(app, attackerId, attackerType, targetUnit, damage, hitMeta) {
    if (!app || !targetUnit || !(damage > 0)) return 0;
    if (!CombatResolver.hadFireDotBeforeHit(targetUnit, hitMeta)) return 0;
    var cfg = CombatResolver.resolveBurnSplash(app, attackerId, attackerType);
    if (!cfg) return 0;

    var targetId = CombatResolver._getUnitId(targetUnit);
    if (!targetId) return 0;
    if (!app._burnSplashCooldowns) app._burnSplashCooldowns = {};
    var key = attackerId + '>' + targetId;
    if (app._burnSplashCooldowns[key] && Date.now() < app._burnSplashCooldowns[key]) return 0;
    app._burnSplashCooldowns[key] = Date.now() + (cfg.cooldownMs || 1200);

    var splashDmg = Math.max(1, Math.round(damage * (cfg.splashPct || 0.22)));
    CombatResolver._dealFireSplash(app, attackerId, targetUnit, splashDmg, cfg.splashRadius || 2.0);
    return splashDmg;
};

CombatResolver._refreshBasicAttack = function(app, unitId) {
    var unit = CombatResolver._getUnit(app, unitId);
    if (!unit) return;
    if (unit.reloadTimer !== undefined) unit.reloadTimer = 0;
    if (unit.shootCooldownTimer !== undefined) unit.shootCooldownTimer = 0;
    if (unit.attackCooldown !== undefined) unit.attackCooldown = 0;
};

// ── Core resolve ───────────────────────────────────────────────
CombatResolver.resolveOutgoingHit = function(app, attackerId, attackerType, targetUnit, baseDamage, hitMeta) {
    hitMeta = hitMeta || {};
    var result = {
        baseDamage: baseDamage,
        damage: baseDamage,
        displayDamage: baseDamage,
        isCrit: false,
        shieldAbsorbed: 0,
        shieldBroken: false,
        hitMeta: hitMeta
    };

    if (!targetUnit || baseDamage <= 0 || hitMeta.isDotTick) {
        return result;
    }

    var mode = CombatResolver.getMode(app);
    var attackerStats = CombatResolver.getAttackerStats(app, attackerId, attackerType);
    var attackerUnit = CombatResolver._getUnit(app, attackerId, attackerType);
    var damage = baseDamage;

    if (attackerUnit && attackerUnit.trueStrike) {
        hitMeta.trueStrike = true;
        hitMeta.ignoreDodge = true;
        hitMeta.pierceShield = true;
    }

    var condMul = CombatResolver.getConditionalDmgMul(attackerUnit);
    if (condMul !== 1) damage = Math.round(damage * condMul);

    var crit = CombatResolver.rollCrit(attackerStats, { mode: mode, isDotTick: hitMeta.isDotTick });
    if (crit.isCrit) {
        damage = Math.round(damage * crit.mul);
        result.isCrit = true;
        hitMeta.isCombo = true;
        hitMeta.isCrit = true;
        hitMeta = CombatResolver._applyOnCritEffects(hitMeta, attackerStats);
    }

    if (!hitMeta.isShieldBreakRetaliation) {
        var scaleBonus = CombatResolver.consumeScaleCounterStacks(attackerUnit, hitMeta);
        if (scaleBonus > 0) damage = Math.round(damage * (1 + scaleBonus));

        var nextHitBonus = CombatResolver.consumeNextHitMod(attackerUnit, hitMeta);
        if (nextHitBonus > 0) damage = Math.round(damage * (1 + nextHitBonus));
    }

    damage = CombatResolver._applyExecuteBonus(app, attackerId, attackerStats, targetUnit, damage);
    damage = CombatResolver._applyBreachConsume(app, attackerStats, targetUnit, damage, hitMeta);
    damage = CombatResolver._applyChainMarkConsume(app, attackerStats, targetUnit, damage, hitMeta);

    if (CombatResolver.hasShieldTag(targetUnit) && attackerStats.bonusVsShield > 0) {
        damage = Math.round(damage * (1 + attackerStats.bonusVsShield));
    }

    var absorb = CombatResolver.applyShieldAbsorb(targetUnit, damage, hitMeta);
    damage = absorb.hpDamage;
    result.shieldAbsorbed = absorb.absorbed;
    result.shieldBroken = absorb.shieldBroken;
    result.displayDamage = absorb.absorbed + damage;

    if (absorb.absorbed > 0 || damage > 0) {
        CombatResolver._onDefenderHit(app, targetUnit, {
            absorbed: absorb.absorbed,
            hpDamage: damage,
            shieldBroken: absorb.shieldBroken
        });
    }

    if (absorb.shieldBroken && attackerStats.onShieldBreakDmgPct > 0) {
        var bonus = Math.round(result.displayDamage * attackerStats.onShieldBreakDmgPct);
        if (bonus > 0) {
            damage += bonus;
            result.displayDamage += bonus;
        }
    }

    result.damage = damage;
    result.hitMeta = hitMeta;
    hitMeta.shieldAbsorbed = absorb.absorbed;
    hitMeta.shieldBroken = absorb.shieldBroken;
    return result;
};

CombatResolver.applyFireSustainDotMul = function(app, attackerId, attackerType, dotConfig) {
    if (!dotConfig || !dotConfig.type || !CombatResolver.FIRE_DOT_TYPES[dotConfig.type]) return dotConfig;
    if (!app) return dotConfig;
    var unit = CombatResolver._getUnit(app, attackerId, attackerType);
    var mul = 1;
    if (unit && unit._combatStats && unit._combatStats.fireSustain && unit._combatStats.fireSustain.burnDmgMul) {
        mul = unit._combatStats.fireSustain.burnDmgMul;
    }
    if (!(mul > 1)) return dotConfig;
    var out = Object.assign({}, dotConfig);
    if (out.damagePerTick) {
        out.damagePerTick = Math.max(1, Math.round(out.damagePerTick * mul));
    }
    out._fireSustainDmgMul = mul;
    return out;
};

/** 子彈／火圈 DoT 統一入口（bulletManager）；目前等同續燃強化 */
CombatResolver.applyFireDotMods = function(app, attackerId, attackerType, dotConfig) {
    return CombatResolver.applyFireSustainDotMul(app, attackerId, attackerType, dotConfig);
};

CombatResolver.applyFireDotEnhance = CombatResolver.applyFireDotMods;

/**
 * 詞卡防禦屬性寫入單位（閃避等）。armyStats 已在 _combatStats，此處同步可讀欄位。
 */
CombatResolver.applyDefenseStats = function(unit, stats) {
    if (!unit || !stats) return;
    if (!unit._combatStats) unit._combatStats = CombatResolver._emptyAttackerStats();
    if (stats.dodgeChance !== undefined) {
        unit.dodgeChance = stats.dodgeChance;
        unit._combatStats.dodgeChance = stats.dodgeChance;
    }
    if (stats.lifestealPct !== undefined) {
        unit._combatStats.lifestealPct = stats.lifestealPct;
    }
    if (stats.auras) {
        unit._combatStats.auras = stats.auras.slice();
    }
    if (stats.damageTakenMul !== undefined) {
        unit._damageTakenMul = stats.damageTakenMul;
    }
};

CombatResolver.rollDodge = function(unit) {
    if (!unit) return false;
    var chance = 0;
    if (unit._combatStats && unit._combatStats.dodgeChance) chance = unit._combatStats.dodgeChance;
    else if (unit.dodgeChance) chance = unit.dodgeChance;
    if (!(chance > 0)) return false;
    if (chance > 0.75) chance = 0.75;
    return Math.random() < chance;
};

CombatResolver.showMissFloat = function(app, entity) {
    if (!app || !entity || !entity.getPosition) return;
    var col = (typeof pc !== 'undefined' && pc.Color) ? new pc.Color(0.7, 0.85, 1.0) : null;
    app.fire('ui:floatingDamage', entity.getPosition(), 'MISS', true, col, 0.65);
};

CombatResolver.tryDodgeIncoming = function(app, unit, entity, damage, hitMeta) {
    hitMeta = hitMeta || {};
    if (!unit || damage <= 0 || hitMeta.isHeal) return false;
    if (hitMeta.trueStrike || hitMeta.ignoreDodge || hitMeta.pierceShield) return false;
    if (hitMeta.isDotTick) return false;
    if (app && hitMeta.attackerId) {
        var atkType = hitMeta.attackerType || ((hitMeta.attackerId === 'player') ? 'player' : 'bot');
        var atk = CombatResolver._getUnit(app, hitMeta.attackerId, atkType);
        if (atk && atk.trueStrike) return false;
    }
    if (!CombatResolver.rollDodge(unit)) return false;
    CombatResolver.showMissFloat(app, entity);
    return true;
};

/**
 * 有效承傷倍率：光環／低血減傷。
 * 不含 _rogueBuffMults.damageTakenMul（玩家 hit 路徑另乘，避免雙重）。
 */
CombatResolver.getEffectiveDamageTakenMul = function(unit) {
    if (!unit) return 1;
    var mul = 1;
    if (unit._auraDamageTakenMul && unit._auraDamageTakenMul !== 1) {
        mul *= unit._auraDamageTakenMul;
    }
    var stats = unit._combatStats;
    if (stats && stats.onLowHpTriggers && stats.onLowHpTriggers.length) {
        var maxHp = CombatResolver.getMaxHP(unit);
        var hp = unit.health;
        if (maxHp > 0 && hp >= 0) {
            var ratio = hp / maxHp;
            for (var i = 0; i < stats.onLowHpTriggers.length; i++) {
                var t = stats.onLowHpTriggers[i];
                if (ratio <= (t.threshold || 0.4) && t.damageTakenMul && t.damageTakenMul !== 1) {
                    mul *= t.damageTakenMul;
                }
            }
        }
    }
    return mul;
};

/** Rogue：每幀刷新友軍光環減傷到單位 _auraDamageTakenMul */
CombatResolver.tickAuras = function(app) {
    if (!app) return;
    var myTeam = app.myTeam || 'blue';
    var pc = app.playerController;
    if (pc) pc._auraDamageTakenMul = 1;

    var bots = (app.botController && app.botController.bots) ? app.botController.bots : [];
    var i;
    for (i = 0; i < bots.length; i++) {
        if (bots[i]) bots[i]._auraDamageTakenMul = 1;
    }

    var sources = [];
    if (pc && !pc.isDead && pc.player && pc._combatStats && pc._combatStats.auras && pc._combatStats.auras.length) {
        sources.push({
            pos: pc.player.getPosition(),
            auras: pc._combatStats.auras,
            team: myTeam
        });
    }
    for (i = 0; i < bots.length; i++) {
        var b = bots[i];
        if (!b || b.state !== 'alive' || b.team !== myTeam || !b.entity) continue;
        if (!b._combatStats || !b._combatStats.auras || !b._combatStats.auras.length) continue;
        sources.push({
            pos: b.entity.getPosition(),
            auras: b._combatStats.auras,
            team: b.team
        });
    }
    if (!sources.length) return;

    var applyMul = function(unit, takenMul) {
        if (!unit || !(takenMul < 1)) return;
        var cur = unit._auraDamageTakenMul;
        if (cur === undefined || cur === null) cur = 1;
        unit._auraDamageTakenMul = Math.min(cur, takenMul);
    };

    for (var s = 0; s < sources.length; s++) {
        var src = sources[s];
        for (var a = 0; a < src.auras.length; a++) {
            var aura = src.auras[a];
            if (!aura || !(aura.damageTakenMul < 1)) continue;
            var r = aura.radius || 8;
            var r2 = r * r;
            var taken = aura.damageTakenMul;

            if (pc && !pc.isDead && pc.player && (pc.team === src.team || myTeam === src.team)) {
                var pp = pc.player.getPosition();
                var dx = pp.x - src.pos.x;
                var dz = pp.z - src.pos.z;
                if (dx * dx + dz * dz <= r2) applyMul(pc, taken);
            }
            for (var bi = 0; bi < bots.length; bi++) {
                var bot = bots[bi];
                if (!bot || bot.state !== 'alive' || bot.team !== src.team || !bot.entity) continue;
                var bp = bot.entity.getPosition();
                var dx2 = bp.x - src.pos.x;
                var dz2 = bp.z - src.pos.z;
                if (dx2 * dx2 + dz2 * dz2 <= r2) applyMul(bot, taken);
            }
        }
    }
};

CombatResolver.tryLifestealHeal = function(app, attackerId, attackerType, damageDealt, hitMeta) {
    if (!app || !(damageDealt > 0)) return;
    if (hitMeta && (hitMeta.isDotTick || hitMeta.isEmberSplash || hitMeta.isBurnSplash || hitMeta.isHeal)) return;
    var atk = CombatResolver._getUnit(app, attackerId, attackerType);
    if (!atk || !atk._combatStats) return;
    var pct = atk._combatStats.lifestealPct || 0;
    if (!(pct > 0)) return;
    var heal = Math.max(1, Math.round(damageDealt * pct));
    if (!(heal > 0)) return;

    var isPlayer = (attackerId === 'player') || (atk === app.playerController);
    if (isPlayer) {
        var pCtrl = app.playerController;
        if (!pCtrl || pCtrl.isDead) return;
        var room = (pCtrl.maxHealth || 0) - (pCtrl.health || 0);
        if (room <= 0) return;
        heal = Math.min(heal, room);
        pCtrl._onPlayerHit(-heal, attackerId, false, undefined, { isHeal: true, skipFireSustain: true });
        if (pCtrl.player) {
            var healCol = (typeof pc !== 'undefined' && pc.Color) ? new pc.Color(0.2, 1, 0.4) : null;
            app.fire('ui:floatingDamage', pCtrl.player.getPosition(), '+' + heal, false, healCol);
        }
        return;
    }

    var bCtrl = app.botController;
    if (!bCtrl || !bCtrl.bots) return;
    for (var i = 0; i < bCtrl.bots.length; i++) {
        var bot = bCtrl.bots[i];
        if (!bot || (bot !== atk && bot.id !== attackerId)) continue;
        if (bot.state !== 'alive') return;
        var roomB = (bot.maxHealth || 0) - (bot.health || 0);
        if (roomB <= 0) return;
        heal = Math.min(heal, roomB);
        bCtrl.hitBot(i, -heal, attackerId, { isHeal: true, skipFireSustain: true });
        return;
    }
};

/** 玩家軍隊破綻設定（掛印用） */
CombatResolver._getArmyBreachWindow = function(app) {
    if (app && app.playerController && app.playerController._combatStats && app.playerController._combatStats.breachWindow) {
        return app.playerController._combatStats.breachWindow;
    }
    return null;
};

/** 是否為玩家敵軍（破綻／斬殺印目標） */
CombatResolver._isEnemyOfPlayer = function(app, targetUnit) {
    if (!app || !targetUnit) return false;
    var pc = app.playerController;
    if (pc) {
        if (targetUnit === pc) return false;
        var tid = CombatResolver._getUnitId(targetUnit);
        var pid = CombatResolver._getUnitId(pc);
        if (tid && pid && String(tid) === String(pid)) return false;
    }
    var myTeam = app.myTeam || (pc && pc.team) || 'blue';
    if (targetUnit.team !== undefined && targetUnit.team !== null) {
        return targetUnit.team !== myTeam;
    }
    return true;
};

CombatResolver._applyBreachMark = function(app, targetUnit, cfg) {
    if (!app || !targetUnit || !cfg) return;
    if (!CombatResolver._isEnemyOfPlayer(app, targetUnit)) return;
    var now = Date.now();
    var targetId = CombatResolver._getUnitId(targetUnit) || 'unknown';
    if (!app._breachApplyCd) app._breachApplyCd = {};
    if (now < (app._breachApplyCd[targetId] || 0)) return;
    targetUnit._breachMark = {
        until: now + (cfg.durationMs || 2000),
        bonusDmg: cfg.bonusDmg || 0.30
    };
    app._breachApplyCd[targetId] = now + (cfg.applyCooldownMs || 1250);
};

/** 暈／強緩速剛施加 → 掛破綻窗口 */
CombatResolver.onCrowdControlApplied = function(app, targetUnit, info) {
    if (!app || !targetUnit) return;
    var cfg = CombatResolver._getArmyBreachWindow(app);
    if (!cfg) return;

    var stunDur = (info && info.stunDuration) ? info.stunDuration : 0;
    var snareDur = (info && info.snareDuration) ? info.snareDuration : 0;
    var snareMult = (info && info.snareMultiplier !== undefined) ? info.snareMultiplier : 1;
    var strongSnare = snareDur > 0 && snareMult <= (cfg.strongSnareMaxMult !== undefined ? cfg.strongSnareMaxMult : 0.50);
    if (stunDur <= 0 && !strongSnare) return;
    CombatResolver._applyBreachMark(app, targetUnit, cfg);
};

/** 灼燒／流血等 DoT 剛施加 → 破綻擴 */
CombatResolver.onDotApplied = function(app, targetUnit, dotType) {
    if (!app || !targetUnit || !dotType) return;
    var cfg = CombatResolver._getArmyBreachWindow(app);
    if (!cfg || !cfg.markOnDot || !cfg.markOnDot.length) return;
    var ok = false;
    for (var i = 0; i < cfg.markOnDot.length; i++) {
        if (cfg.markOnDot[i] === dotType) { ok = true; break; }
    }
    if (!ok) return;
    CombatResolver._applyBreachMark(app, targetUnit, cfg);
};

/** 受擊 → 逆鱗疊層；破盾 → 破盾爆發 */
CombatResolver._onDefenderHit = function(app, defender, hit) {
    if (!defender || !hit) return;
    var stats = defender._combatStats;
    if (!stats) return;
    var totalHit = (hit.absorbed || 0) + (hit.hpDamage || 0);
    var minHit = stats.scaleCounter && (stats.scaleCounter.minHit !== undefined
        ? stats.scaleCounter.minHit
        : (stats.scaleCounter.minAbsorb !== undefined ? stats.scaleCounter.minAbsorb : 1));
    if (stats.scaleCounter && totalHit >= minHit) {
        CombatResolver.addScaleCounterStack(defender, stats.scaleCounter);
    }
    if (hit.shieldBroken && stats.shieldBreakBurst) {
        var sb = stats.shieldBreakBurst;
        CombatResolver.grantNextHitMod(defender, sb.nextHitDmgBonus || 0.40, {
            source: 'shieldBreakBurst',
            expiresAt: Date.now() + (sb.windowMs || 2500)
        });
    }
};

CombatResolver._scaleDotConfig = function(dotConfig, mul) {
    if (!dotConfig || !mul || mul === 1) return dotConfig;
    var out = Object.assign({}, dotConfig);
    if (out.damagePerTick) out.damagePerTick = Math.round(out.damagePerTick * mul);
    return out;
};

/**
 * 術系符咒觸發段數：
 * - 新：triggerUnlocks.maxComboIndex（0=僅首段 …；comboIndex=-1 大招需 superProc）
 * - 舊：first_in_combo / from_second / last_in_combo 旗標
 */
CombatResolver._procTriggerMatches = function(proc, comboIndex) {
    if (!proc) return false;
    if (proc.triggerUnlocks) {
        var u = proc.triggerUnlocks;
        if (u.maxComboIndex !== undefined && u.maxComboIndex !== null) {
            if (comboIndex === -1) return !!u.superProc;
            return comboIndex >= 0 && comboIndex <= u.maxComboIndex;
        }
        if (comboIndex === -1) return !!u.superProc;
        if (u.first_in_combo && comboIndex === 0) return true;
        if (u.from_second && comboIndex >= 1) return true;
        if (u.last_in_combo && comboIndex === 2) return true;
        return false;
    }
    if (comboIndex === -1) return false;
    if (proc.trigger === 'first_in_combo') return comboIndex === 0;
    if (proc.trigger === 'from_second') return comboIndex >= 1;
    if (proc.trigger === 'last_in_combo') return comboIndex === 2;
    if (proc.trigger === 'every_hit') return true;
    return comboIndex === 0;
};

/**
 * 普攻／大招出彈時附加詞卡符彈（shu_sigil 等 onBasicProc）。
 * 由 playerController / botController 在 _spawnProjectiles 呼叫；缺此函式則符咒完全不發射。
 */
CombatResolver.tryFireBasicProcs = function(app, ownerType, ownerId, team, brawlerType, atkConf, angle, distance, comboIndex) {
    if (!app || !app.combatManager || !atkConf) return;
    if (atkConf.isExtraBullet || atkConf.isWordProc) return;

    var stats = CombatResolver.getAttackerStats(app, ownerId, ownerType);
    var procs = stats && stats.basicProcs;
    if (!procs || !procs.length) return;

    var pos = null;
    if (ownerType === 'player') {
        var pc = app.playerController;
        if (pc && pc.player) pos = pc.player.getPosition();
    } else {
        var unit = CombatResolver._getUnit(app, ownerId, ownerType);
        if (unit && unit.entity) pos = unit.entity.getPosition();
    }
    if (!pos) return;

    var baseDmg = atkConf.bulletDamage || atkConf.damage || 100;
    var allyMul = 1 + (stats.procAllyDamagePct || 0);
    var dist = (distance !== undefined && distance !== null) ? distance : 1.0;
    var ci = (comboIndex !== undefined && comboIndex !== null) ? comboIndex : 0;

    for (var i = 0; i < procs.length; i++) {
        var proc = procs[i];
        if (!CombatResolver._procTriggerMatches(proc, ci)) continue;

        var dmg = Math.max(1, Math.round(baseDmg * (proc.damagePct || 0.35) * allyMul));
        var spreadCount = proc.spreadCount || 1;
        if (spreadCount < 1) spreadCount = 1;
        var spreadAngle = proc.spreadAngle || 14;
        var pattern = proc.attackPattern || 'normal';

        var conf = {
            bulletKey: proc.bulletKey || 'arcane_sigil',
            attackPattern: pattern,
            type: pattern,
            bulletDamage: dmg,
            bulletSpeed: proc.bulletSpeed,
            bulletLifetime: proc.bulletLifetime,
            isWordProc: true
        };
        if (proc.dotConfig) {
            var dot = Object.assign({}, proc.dotConfig);
            if (stats.dotMul && stats.dotMul !== 1) {
                dot = CombatResolver._scaleDotConfig(dot, stats.dotMul);
            }
            conf.dotConfig = CombatResolver.applyFireSustainDotMul(app, ownerId, ownerType, dot);
        }

        for (var s = 0; s < spreadCount; s++) {
            var a = CombatResolver.getSpreadAngle(angle, spreadAngle, s, spreadCount);
            app.combatManager.fireProjectile(
                ownerType, ownerId, team, brawlerType,
                pos, a, pattern, dist, conf, ci
            );
        }
    }
};

CombatResolver.tryFireSustain = function(app, attackerUnit, targetUnit, hitMeta) {
    if (!attackerUnit || !targetUnit || !attackerUnit._combatStats) return;
    if (hitMeta && (hitMeta.isDotTick || hitMeta.isEmberSplash || hitMeta.isBurnSplash || hitMeta.skipFireSustain)) return;
    var fs = attackerUnit._combatStats.fireSustain;
    if (!fs || !(fs.extendSec > 0)) return;
    if (!CombatResolver.hasFireDot(targetUnit)) return;

    var now = Date.now();
    var aid = CombatResolver._getUnitId(attackerUnit) || 'atk';
    var tid = CombatResolver._getUnitId(targetUnit) || 'tgt';
    if (!app._fireSustainCd) app._fireSustainCd = {};
    var key = aid + '>' + tid;
    if (now < (app._fireSustainCd[key] || 0)) return;
    app._fireSustainCd[key] = now + (fs.icdMs || 800);

    if (!targetUnit.activeStates) return;
    var burnMul = fs.burnDmgMul || 1;
    for (var k in targetUnit.activeStates) {
        if (!CombatResolver.FIRE_DOT_TYPES[k]) continue;
        var st = targetUnit.activeStates[k];
        if (!st) continue;
        st.duration = (st.duration || 0) + fs.extendSec;
        if (burnMul > 1 && st.damagePerTick) {
            var prevMul = st._fireSustainDmgMul || 1;
            if (burnMul !== prevMul) {
                st.damagePerTick = Math.max(1, Math.round(st.damagePerTick * (burnMul / prevMul)));
                st._fireSustainDmgMul = burnMul;
            }
        }
    }
    if (hitMeta) hitMeta.fireSustainExtended = fs.extendSec;
};

CombatResolver._applyChainMarkConsume = function(app, attackerStats, targetUnit, damage, hitMeta) {
    if (!targetUnit || damage <= 0) return damage;
    if (hitMeta && (hitMeta.isDotTick || hitMeta.skipChain)) return damage;
    var mark = targetUnit._chainHarvestMark;
    if (!mark || !mark.until) return damage;
    if (Date.now() > mark.until) {
        targetUnit._chainHarvestMark = null;
        return damage;
    }
    var bonus = mark.bonusDmg || 0.35;
    damage = Math.round(damage * (1 + bonus));
    targetUnit._chainHarvestMark = null;
    if (hitMeta) hitMeta.chainHarvestConsumed = true;
    return damage;
};

CombatResolver.onUnitKill = function(app, killerId, victimId) {
    if (!app || !killerId || !victimId) return;
    var killer = CombatResolver._getUnit(app, killerId);
    if (!killer || !killer._combatStats) return;

    var ok = killer._combatStats.onKill;
    if (ok) {
        if (ok.refreshBasicAttack) CombatResolver._refreshBasicAttack(app, killerId);
        if (ok.dmgStack > 0) {
            var stacks = killer._wordKillDmgStacks || 0;
            var maxStacks = ok.maxStacks || 3;
            if (stacks < maxStacks) {
                killer._wordKillDmgStacks = stacks + 1;
            }
        }
    }

    var ch = killer._combatStats.chainHarvest;
    if (ch && ch.bonusDmg > 0) {
        CombatResolver._spreadChainHarvest(app, killer, victimId, ch);
    }
};

CombatResolver._spreadChainHarvest = function(app, killer, victimId, cfg) {
    var bCtrl = app.botController;
    if (!bCtrl || !bCtrl.bots) return;
    var victim = null;
    for (var i = 0; i < bCtrl.bots.length; i++) {
        if (bCtrl.bots[i].id === victimId) { victim = bCtrl.bots[i]; break; }
    }
    if (!victim || !victim.entity) return;
    var vPos = victim.entity.getPosition();
    var r2 = (cfg.radius || 4.5) * (cfg.radius || 4.5);
    var until = Date.now() + (cfg.durationMs || 2800);
    var marked = 0;
    var maxT = cfg.maxTargets || 4;
    for (var j = 0; j < bCtrl.bots.length; j++) {
        var bot = bCtrl.bots[j];
        if (bot.state !== 'alive' || bot.id === victimId) continue;
        var killerTeam = killer.team || (app.myTeam || 'blue');
        if (bot.team === killerTeam) continue;
        if (victim.team && bot.team !== victim.team) continue;
        var bp = bot.entity.getPosition();
        var dx = bp.x - vPos.x;
        var dz = bp.z - vPos.z;
        if (dx * dx + dz * dz > r2) continue;
        bot._chainHarvestMark = { until: until, bonusDmg: cfg.bonusDmg || 0.35 };
        marked++;
        if (marked >= maxT) break;
    }
};

CombatResolver._estimateDotRemaining = function(state) {
    if (!state) return 0;
    var tick = state.tickRate || 0.5;
    if (tick <= 0) tick = 0.5;
    var ticksLeft = Math.max(1, Math.ceil((state.duration || 0) / tick));
    return Math.round((state.damagePerTick || 0) * ticksLeft);
};

// 挑出目標身上最強的火系 DoT（不限掛傷來源：隊友灼燒也可引爆）
CombatResolver._pickFireDot = function(targetUnit) {
    if (!targetUnit || !targetUnit.activeStates) return null;
    var bestKey = null;
    var bestRemain = 0;
    for (var k in targetUnit.activeStates) {
        if (!CombatResolver.FIRE_DOT_TYPES[k]) continue;
        var st = targetUnit.activeStates[k];
        if (!st) continue;
        var remain = CombatResolver._estimateDotRemaining(st);
        if (remain > bestRemain) {
            bestRemain = remain;
            bestKey = k;
        }
    }
    if (!bestKey) return null;
    return { key: bestKey, remaining: bestRemain };
};

// 命中後呼叫：消耗火系灼燒 → 主目標加傷 + 濺射（不遞迴進 resolveOutgoingHit）
CombatResolver.tryEmberDetonate = function(app, attackerId, attackerType, targetUnit, hitMeta) {
    if (!app || !targetUnit || !hitMeta) return 0;
    if (hitMeta.isDotTick || hitMeta.isEmberSplash || hitMeta.isBurnSplash || hitMeta.isWordProc || hitMeta._emberDone) return 0;

    var cfg = CombatResolver.resolveEmberDetonate(app, attackerId, attackerType);
    if (!cfg) return 0;

    var targetId = CombatResolver._getUnitId(targetUnit);
    if (!targetId) return 0;
    var now = Date.now();
    if (!app._emberCooldowns) app._emberCooldowns = {};
    var cdKey = attackerId + '>' + targetId;
    if (app._emberCooldowns[cdKey] && now < app._emberCooldowns[cdKey]) return 0;

    var pick = CombatResolver._pickFireDot(targetUnit);
    if (!pick || pick.remaining <= 0) return 0;
    if (!CombatResolver.hadFireDotBeforeHit(targetUnit, hitMeta)) return 0;

    delete targetUnit.activeStates[pick.key];
    app._emberCooldowns[cdKey] = now + (cfg.cooldownMs || 2000);
    hitMeta._emberDone = true;

    var mainDmg = Math.max(1, Math.round(pick.remaining * (cfg.remainingPct || 0.60)));
    var splashDmg = Math.max(1, Math.round(mainDmg * (cfg.splashPct || 0.35)));
    var radius = cfg.splashRadius || 2.75;

    CombatResolver._spawnEmberAoeFx(app, targetUnit, radius, cfg);
    CombatResolver._dealEmberSplash(app, attackerId, targetUnit, splashDmg, radius);
    return mainDmg;
};

// 濺射視覺：複用 aoeMap（預設周瑜火圈），純特效不走傷害 zone
CombatResolver._spawnEmberAoeFx = function(app, primaryUnit, radius, cfg) {
    if (!app || !app.combatManager || !primaryUnit || !primaryUnit.entity) return;
    var aoeKey = (cfg && cfg.aoeKey) || 'zhouyu';
    var template = (app.combatManager.aoeMap && app.combatManager.aoeMap[aoeKey]) || app.combatManager.aoeTemplate;
    if (!template || !template.parent) return;
    try {
        var pos = primaryUnit.entity.getPosition();
        var zone = template.clone();
        template.parent.addChild(zone);
        zone.enabled = true;
        zone.setPosition(pos.x, 0.05, pos.z);
        var spawnScale;
        if (app.bulletManager && typeof app.bulletManager._getAoeSpawnScale === 'function') {
            spawnScale = app.bulletManager._getAoeSpawnScale(template, radius);
        } else {
            var s = Math.max(0.2, radius * 2);
            spawnScale = { x: s, y: s, z: s };
        }
        zone.setLocalScale(spawnScale.x, spawnScale.y, spawnScale.z);
        var particles = zone.findComponents('particlesystem');
        for (var i = 0; i < particles.length; i++) {
            particles[i].reset();
            particles[i].play();
        }
        // 掛進 damageZones 但 damage=0 + visualOnly，只負責縮放淡出與銷毀
        if (app.bulletManager && typeof app.bulletManager.addDamageZone === 'function') {
            app.bulletManager.addDamageZone({
                entity: zone,
                x: pos.x,
                z: pos.z,
                radius: radius,
                duration: 0.35,
                damage: 0,
                tickRate: 1,
                tickTimer: 1,
                oneShot: true,
                visualOnly: true,
                spawnScale: spawnScale
            });
        } else {
            setTimeout(function() { if (zone && !zone._destroyed) zone.destroy(); }, 400);
        }
    } catch (e) { /* ignore fx errors */ }
};

CombatResolver._dealEmberSplash = function(app, attackerId, primaryUnit, splashDmg, radius) {
    CombatResolver._dealFireSplash(app, attackerId, primaryUnit, splashDmg, radius);
};

CombatResolver.markEmberProcAvailable = function(unit) {
    if (unit) unit._emberProcAvailable = true;
};

CombatResolver._notifyShieldUI = function(app, entity) {
    if (!app || !app.floatingUIManager || !entity) return;
    if (typeof app.floatingUIManager.updateShield === 'function') {
        var unit = null;
        if (app.playerController && app.playerController.player === entity) unit = app.playerController;
        if (!unit && app.botController && app.botController.bots) {
            for (var i = 0; i < app.botController.bots.length; i++) {
                if (app.botController.bots[i].entity === entity) { unit = app.botController.bots[i]; break; }
            }
        }
        if (unit) app.floatingUIManager.updateShield(entity, unit.shieldHP || 0, unit.shieldMax || 0);
    }
};

if (typeof window !== 'undefined') window.CombatResolver = CombatResolver;