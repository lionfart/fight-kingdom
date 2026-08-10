// ═══════════════════════════════════════════════════════════════
// DevModeTest — 跨 mode 戰鬥回歸 + 問題記錄
//
// 掛到任意常駐 Entity（如 GameManager）腳本：devModeTest
// Console：
//   DevModeTest.runAllModes()     // 模擬各 mode 跑斷言，失敗寫入報告
//   DevModeTest.run()             // 只測目前實際 mode
//   DevModeTest.probe()           // 對當前對局做 live 健康檢查
//   DevModeTest.note('問題描述')  // 手動記一筆（遊玩時發現 bug）
//   DevModeTest.watch(true)       // 開始攔截 console.error/warn
//   DevModeTest.report()          // 印出累積問題
//   DevModeTest.exportReport()    // 下載 JSON
//   DevModeTest.clear()           // 清空記錄
//   DevModeTest.perf(true)        // 開始 subsystem + 引擎／GPU／drawCalls 計時
//   DevModeTest.perf(true, {miniStats:true})  // 額外開 pc.MiniStats（若有）
//   DevModeTest.perf(false)       // 停止
//   DevModeTest.perfReport()      // 立刻印出目前視窗統計（含 engine table）
// URL：?devTest=1 進遊戲後自動 runAllModes + watch
//      ?perf=1    進遊戲後自動開 PerfProbe
// ═══════════════════════════════════════════════════════════════
var DevModeTestScript = pc.createScript('devModeTest');

DevModeTestScript.prototype.initialize = function() {
    this.app.devModeTest = this;
    DevModeTest._bindApp(this.app);
    if (typeof window !== 'undefined') {
        window.DevModeTest = DevModeTest;
        window.PerfProbe = PerfProbe;
        if (DevModeTest._shouldAutoRun()) {
            var self = this;
            setTimeout(function() {
                DevModeTest.watch(true);
                DevModeTest.runAllModes();
            }, 800);
        }
        if (PerfProbe._shouldAutoStart()) {
            setTimeout(function() {
                PerfProbe.start({ hud: true, logMs: 2000 });
            }, 600);
        }
    }
};

var DevModeTest = {
    STORAGE_KEY: 'tapKingdom_devModeTest_issues',
    MODES: ['ROGUE', 'PVE', 'FFA', '3V3_BOUNTY', '3V3_KNOCKOUT'],
    _app: null,
    _watching: false,
    _origWarn: null,
    _origError: null,
    _sessionId: null,

    _bindApp: function(app) {
        this._app = app;
        if (!this._sessionId) this._sessionId = 's_' + Date.now().toString(36);
    },

    _getApp: function() {
        if (this._app) return this._app;
        if (typeof pc !== 'undefined' && pc.Application && pc.Application.getApplication) {
            return pc.Application.getApplication();
        }
        return null;
    },

    _shouldAutoRun: function() {
        try {
            var q = (typeof location !== 'undefined' && location.search) ? location.search : '';
            return /[?&]devTest=1(?:&|$)/.test(q) || /[?&]devTest=all(?:&|$)/.test(q);
        } catch (e) {
            return false;
        }
    },

    // ── Issue log ──────────────────────────────────────────────
    _loadIssues: function() {
        try {
            var raw = localStorage.getItem(this.STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    },

    _saveIssues: function(list) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
        } catch (e) { /* ignore quota */ }
    },

    _pushIssue: function(issue) {
        var list = this._loadIssues();
        list.push(issue);
        if (list.length > 200) list = list.slice(-200);
        this._saveIssues(list);
        return issue;
    },

    _currentModeLabel: function(forced) {
        if (forced) return String(forced).toUpperCase();
        var app = this._getApp();
        var m = (app && (app.gameMode || (app.gameModeManager && app.gameModeManager.currentMode))) || 'UNKNOWN';
        return String(m).toUpperCase();
    },

    /** 手動記問題：遊玩時發現 bug 就打 DevModeTest.note('描述') */
    note: function(message, extra) {
        var issue = {
            id: 'n_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 999),
            at: new Date().toISOString(),
            session: this._sessionId,
            mode: this._currentModeLabel(),
            source: 'manual',
            severity: 'issue',
            message: String(message || ''),
            extra: extra || null
        };
        this._pushIssue(issue);
        console.warn('[DevModeTest] 已記錄:', issue.mode, issue.message);
        return issue;
    },

    _recordFail: function(mode, suite, name, detail) {
        var issue = {
            id: 'f_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 999),
            at: new Date().toISOString(),
            session: this._sessionId,
            mode: String(mode || 'UNKNOWN').toUpperCase(),
            source: 'assert',
            severity: 'fail',
            suite: suite || '',
            name: name || '',
            message: detail || name || 'assertion failed'
        };
        this._pushIssue(issue);
        return issue;
    },

    clear: function() {
        this._saveIssues([]);
        console.log('[DevModeTest] 問題記錄已清空');
    },

    report: function() {
        var list = this._loadIssues();
        var byMode = {};
        for (var i = 0; i < list.length; i++) {
            var m = list[i].mode || 'UNKNOWN';
            if (!byMode[m]) byMode[m] = [];
            byMode[m].push(list[i]);
        }
        console.log('%c[DevModeTest] 問題報告 (' + list.length + ')', 'color:#c9a25a;font-weight:bold');
        console.table(list.map(function(x) {
            return {
                mode: x.mode,
                source: x.source,
                severity: x.severity,
                suite: x.suite || '',
                message: x.message,
                at: x.at
            };
        }));
        return { total: list.length, byMode: byMode, issues: list };
    },

    exportReport: function() {
        var data = {
            exportedAt: new Date().toISOString(),
            session: this._sessionId,
            issues: this._loadIssues()
        };
        var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'tap-kingdom-dev-report-' + Date.now() + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        console.log('[DevModeTest] 已下載報告');
        return data;
    },

    /** 攔截 console.warn / error，遊玩時自動記問題 */
    watch: function(on) {
        if (on === false) {
            if (this._watching) {
                if (this._origWarn) console.warn = this._origWarn;
                if (this._origError) console.error = this._origError;
                this._watching = false;
                console.log('[DevModeTest] watch OFF');
            }
            return;
        }
        if (this._watching) return;
        var self = this;
        this._origWarn = console.warn.bind(console);
        this._origError = console.error.bind(console);
        console.warn = function() {
            self._origWarn.apply(console, arguments);
            self._pushIssue({
                id: 'w_' + Date.now().toString(36),
                at: new Date().toISOString(),
                session: self._sessionId,
                mode: self._currentModeLabel(),
                source: 'console.warn',
                severity: 'warn',
                message: Array.prototype.slice.call(arguments).map(String).join(' ')
            });
        };
        console.error = function() {
            self._origError.apply(console, arguments);
            self._pushIssue({
                id: 'e_' + Date.now().toString(36),
                at: new Date().toISOString(),
                session: self._sessionId,
                mode: self._currentModeLabel(),
                source: 'console.error',
                severity: 'error',
                message: Array.prototype.slice.call(arguments).map(String).join(' ')
            });
        };
        this._watching = true;
        console.log('[DevModeTest] watch ON — console.warn/error 會寫入報告');
    },

    // ── Tiny assert runner ─────────────────────────────────────
    _runSuite: function(mode, suiteName, fn) {
        var results = { mode: mode, suite: suiteName, pass: 0, fail: 0, skips: 0, fails: [] };
        var self = this;
        var t = {
            assert: function(cond, name, detail) {
                if (cond) {
                    results.pass++;
                    return;
                }
                results.fail++;
                results.fails.push(name);
                self._recordFail(mode, suiteName, name, detail || name);
                console.error('[DevModeTest] FAIL [' + mode + '/' + suiteName + '] ' + name + (detail ? ' — ' + detail : ''));
            },
            eq: function(a, b, name) {
                t.assert(a === b, name, 'expected ' + b + ', got ' + a);
            },
            approx: function(a, b, name) {
                t.assert(Math.abs(a - b) < 0.001, name, 'expected ~' + b + ', got ' + a);
            },
            skip: function(reason) {
                results.skips++;
                console.log('[DevModeTest] SKIP [' + mode + '/' + suiteName + '] ' + reason);
            }
        };
        try {
            fn(t);
        } catch (e) {
            t.assert(false, 'suite_exception', (e && e.message) || String(e));
        }
        return results;
    },

    _withMode: function(mode, fn) {
        var app = this._getApp();
        if (!app) return fn(null);
        var prev = app.gameMode;
        var gm = app.gameModeManager;
        var prevGm = gm ? gm.currentMode : null;
        app.gameMode = mode;
        if (gm) gm.currentMode = mode;
        try {
            return fn(app);
        } finally {
            app.gameMode = prev;
            if (gm) gm.currentMode = prevGm;
        }
    },

    // ── Suites ─────────────────────────────────────────────────
    _suiteConfig: function(t) {
        t.assert(!!window.BrawlerConfig, 'BrawlerConfig loaded');
        t.assert(!!window.WordConfig, 'WordConfig loaded');
        t.assert(!!window.BrawlerConfig.zhouyu, 'zhouyu config exists');
        t.assert(!!window.BrawlerConfig.caocao, 'caocao config exists');
        var zy = window.BrawlerConfig.zhouyu;
        t.assert(!!zy.burnSplash, 'zhouyu.burnSplash exists');
        t.assert(!!zy.emberDetonate, 'zhouyu.emberDetonate exists');
        t.assert(!!(zy.comboOverrides && zy.comboOverrides[0] && zy.comboOverrides[0].dotConfig), 'zhouyu hit1 has burn');
        t.assert(!(zy.comboOverrides[1] && zy.comboOverrides[1].dotConfig), 'zhouyu hit2 has no fire stack');
        t.assert(!(zy.comboOverrides[2] && zy.comboOverrides[2].dotConfig), 'zhouyu hit3 has no fire stack');
        var cards = window.WordConfig.cards;
        t.assert(!!cards.sig_zhouyu_burn, 'sig_zhouyu_burn exists');
        t.assert(!!cards.sig_zhouyu_ember, 'sig_zhouyu_ember exists');
        t.assert(cards.sig_zhouyu_ember.signature == null, '餘燼 is universal SR (signature null)');
        t.assert(!!cards.sig_caocao_burn, 'sig_caocao_burn exists');
        t.assert(!!cards.gen_burn_chance && cards.gen_burn_chance.retired === true, '燒符 retired');
        t.assert(!!cards.gen_bleed_chance && cards.gen_bleed_chance.retired === true, '血印 retired');
        t.assert(!!cards.shu_ember_r && cards.shu_ember_r.retired === true, 'shu_ember_r retired');
        t.assert(!window.BrawlerConfig.caocao.emberDetonate, 'caocao has no base emberDetonate');
        t.assert(cards.wu_bloodrage_n && cards.wu_bloodrage_n.name === '蓄勢', '血怒→蓄勢');
        t.assert(!!cards.wu_bloodrage_n.pve.poiseCharge, '蓄勢 has poiseCharge');
        t.assert(cards.wu_berserk_n && cards.wu_berserk_n.name === '破釜', '狂暴→破釜');
        t.assert(cards.wu_berserk_n.faction === 'ti', '破釜是守系');
        t.assert(!!cards.wu_berserk_n.pve.shieldBreakBurst, '破釜 has shieldBreakBurst');
        t.assert(cards.wu_berserk_n.requiresCard === 'ti_iron_wall_r', '破釜 requires 銅牆');
        t.assert(!!cards.ti_scale_n && cards.ti_scale_n.schoolFinisher, '逆鱗 finisher');
        t.assert(cards.ti_scale_n.requiresCard === 'ti_iron_wall_r', '逆鱗 requires 銅牆');
        t.assert(WordConfig.tiShieldRoot === 'ti_iron_wall_r', 'tiShieldRoot constant');
        t.assert(!cards.wu_pierce_r.requiresCard, '破甲不需銅牆');
        t.assert(!!cards.su_wind_return_n && cards.su_wind_return_n.schoolFinisher, '風返 finisher');
        t.assert(WordConfig.pitySoftWaves === 3, '軟保底 3 波');
        t.assert(WordConfig.pityHardWaves === 5, '硬保底 5 波');
        t.assert(WordConfig.pitySoftChance > 0, '軟保底機率');
        t.assert(WordConfig.pityWavesUnseenCard == null, '舊單檔未見保底已移除');
        t.assert(!!cards.wu_chain_harvest_n, '連鎖 exists');
        t.assert(!!cards.su_rapid_n.rapidTiers && cards.su_rapid_n.rapidTiers.length >= 3, '速射 rapidTiers');
        t.assert(!!window.WordConfig.schoolFinishers, 'schoolFinishers map');
        t.assert(!!window.WordConfig.finisherEffects.fireSustain, '續燃 finisherEffects');
    },

    _suiteWordResonance: function(t) {
        if (!window.WordSystem || !window.WordConfig) {
            t.skip('WordSystem missing');
            return;
        }
        var app = this._getApp() || {};
        var ws = app.wordSystem;
        if (!ws) {
            // 無 live instance：用原型方法測靜態計數邏輯不可行，改測 config 契約
            t.assert(WordConfig.schoolFinishers.wu.entityCardIds.indexOf('wu_breach_n') >= 0, '破綻 is wu finisher entity');
            t.assert(WordConfig.schoolFinishers.shu.entityCardIds.length === 0, '續燃無實體卡');
            t.assert(!!WordConfig.cards.wu_breach_n.schoolFinisher, '破綻 schoolFinisher flag');
            return;
        }
        ws.resetRun();
        t.eq(ws.countSchoolCards('shu'), 0, 'empty school count');
        ws._owned.push('shu_sigil_n');
        ws._owned.push('shu_chain_n');
        t.eq(ws.countSchoolCards('shu'), 2, '2 shu countable');
        var stats = ws.computeCombatStats(null);
        t.assert(!!stats.fireSustain, '2 shu → fireSustain resonance');
        t.assert(!!stats.activeResonances.shu, 'activeResonances.shu');

        ws.resetRun();
        ws._owned.push('ti_iron_wall_r');
        ws._owned.push('ti_scale_n');
        t.eq(ws.countSchoolCards('ti'), 1, '逆鱗不計入共鳴進度');
        var stats2 = ws.computeCombatStats(null);
        t.assert(!stats2.activeResonances || !stats2.activeResonances.ti, '單銅牆+逆鱗不共鳴');
        t.assert(!!stats2.scaleCounter, '實體逆鱗仍有效果');

        ws._owned.push('ti_shield_n');
        ws._syncResonanceAbsorb(null);
        t.assert(!ws.hasCard('ti_scale_n'), '共鳴吸收逆鱗還格');
        t.assert((ws._finisherLevels.ti || 0) >= 1, '吸收後 finisherLevel+');
        var stats3 = ws.computeCombatStats(null);
        t.assert(!!stats3.scaleCounter, '共鳴後仍有逆鱗效果');
        t.assert(!!stats3.activeResonances.ti, '守共鳴啟動');

        // 破釜屬守、計入共鳴進度
        ws.resetRun();
        ws._owned.push('wu_berserk_n');
        ws._owned.push('ti_iron_wall_r');
        t.eq(ws.countSchoolCards('ti'), 2, '破釜+銅牆＝2 守可計數');
        var potStats = ws.computeCombatStats(null);
        t.assert(!!potStats.activeResonances.ti, '破釜可觸發守共鳴');
        t.assert(!!potStats.scaleCounter, '守共鳴給逆鱗');

        if (typeof ws.getBuildSlotSnapshot === 'function') {
            ws._lastBuffs = potStats;
            ws._sigResolved = true;
            ws._sigCardId = null; // 無效果本命 → 手牌 5
            var snap = ws.getBuildSlotSnapshot(null);
            t.eq(snap.max, 5, '無本命時 slot max = 5');
            t.eq(snap.filled, 2, '2 filled slots');
            t.eq(snap.slots.length, 5, 'always render max slots');
            t.assert(snap.badges.length >= 1, 'resonance badge in snapshot');
            var parts = ws.formatBuildDetailParts(null);
            t.assert(parts.some(function(p) { return p.indexOf('共鳴') >= 0; }), 'detail includes 共鳴');

            // 有效果本命 → 手牌 4
            ws._sigCardId = 'sig_zhouyu_ember';
            ws._syncSignatureRuntime && ws._syncSignatureRuntime();
            t.eq(ws.getMaxHandCards(), 4, '有效果本命時 max = 4');
        }

        // 共鳴吸收後：以普通「精煉 逆鱗」升級，desc 對齊 finisherLevel
        ws.resetRun();
        ws._owned.push('ti_wall_n');
        ws._owned.push('ti_shield_n');
        ws._owned.push('ti_scale_n');
        ws._syncResonanceAbsorb(null);
        ws.computeCombatStats(null);
        t.assert(!ws.hasCard('ti_scale_n'), '共鳴吸收逆鱗還格');
        t.assert(ws.getFinisherLevel('ti') >= 1, '吸收後 finisherLevel≥1');
        t.assert(ws.canUpgradeCard('ti_scale_n', null), '吸收後仍可普通精煉逆鱗');
        var upParts = ws.formatUpgradeCardParts(ws.getCardDef('ti_scale_n'), ws.getUpgradeLevel('ti_scale_n'), null);
        t.assert(upParts.detail.indexOf(String(ws.getUpgradeLevel('ti_scale_n'))) >= 0 ||
            upParts.detail.indexOf('精煉至') >= 0, '精煉 desc 含等級');
        var virt = ws.getVirtualFinisherRefineIds();
        t.assert(virt.indexOf('ti_scale_n') >= 0, '虛擬精煉列表含逆鱗');
        t.assert(ws.upgradeCard('ti_scale_n', null), '普通精煉逆鱗成功');
        var lvAfter = ws.getUpgradeLevel('ti_scale_n');
        t.assert(lvAfter >= 2, '精煉後等級上升');

        // 無實體續燃：普通「精煉 續燃」，不再要共鳴專卡
        ws.resetRun();
        ws._owned.push('shu_sigil_n');
        ws._owned.push('shu_chain_n');
        ws.computeCombatStats(null);
        t.assert(ws.canRefineSlotlessFinisher('shu'), '術共鳴可精煉續燃');
        t.assert(ws.upgradeResonanceFinisher('shu', null), '精煉續燃成功');
        t.eq(ws._finisherLevels.shu, 1, 'finisherLevel=1');
        t.assert(ws.getUpgradeableResonanceFactions().indexOf('shu') >= 0, '仍在可精煉列表');

        // 銅牆前置：破釜／逆鱗皆需銅牆
        ws.resetRun();
        t.assert(!ws._cardMeetsPrerequisites('wu_berserk_n'), '無銅牆不可選破釜');
        t.assert(!ws._cardMeetsPrerequisites('ti_scale_n'), '無銅牆不可選逆鱗');
        ws._owned.push('ti_iron_wall_r');
        t.assert(ws._cardMeetsPrerequisites('ti_scale_n'), '有銅牆可選逆鱗');
        t.assert(ws._cardMeetsPrerequisites('wu_berserk_n'), '有銅牆可選破釜');

        // 共鳴已給破綻後，實體破綻卡不再進池（只走精煉）
        ws.resetRun();
        ws._owned.push('wu_break_n');
        ws._owned.push('wu_combo_n');
        ws.computeCombatStats(null);
        t.assert(!!ws.getResonanceProgress('wu').active, '武共鳴啟動');
        t.assert(ws._isSchoolFinisherGranted('wu'), '破綻已由共鳴取得');
        var pool = ws._buildPool(true, {});
        t.assert(pool.indexOf('wu_breach_n') < 0, '共鳴後池中無普通破綻');
        t.assert(ws.canUpgradeCard('wu_breach_n', null), '仍可精煉破綻');
        t.assert(ws.getVirtualFinisherRefineIds().indexOf('wu_breach_n') >= 0, '共鳴破綻在虛擬精煉池');
        // 純共鳴續燃可精煉
        ws.resetRun();
        ws._owned.push('shu_sigil_n');
        ws._owned.push('shu_chain_n');
        ws.computeCombatStats(null);
        t.assert(ws.canRefineSlotlessFinisher('shu'), '純共鳴可精煉續燃');
    },

    _suiteNextHitMods: function(t) {
        if (!window.CombatResolver) {
            t.skip('CombatResolver missing');
            return;
        }
        var CR = CombatResolver;
        var unit = { id: 'test_unit' };
        CR.grantNextHitMod(unit, 0.25, { source: 'windReturn' });
        t.assert(unit._nextHitMods && unit._nextHitMods.bonusDmg === 0.25, 'grant nextHitMod');
        t.assert(CR.isNextHitModArmed(unit), 'armed for UI');
        t.assert(CR.buildStatusIcons(unit).indexOf('⏫') >= 0, 'status has ⏫');
        var consumed = CR.consumeNextHitMod(unit, {});
        t.eq(consumed, 0.25, 'consume nextHitMod');
        t.assert(!unit._nextHitMods, 'cleared after consume');
        t.assert(!CR.isNextHitModArmed(unit), 'not armed after consume');
        CR.grantNextHitMod(unit, 0.25, { source: 'poiseCharge' });
        CR.clearNextHitMod(unit, 'poiseCharge');
        t.assert(!unit._nextHitMods, 'clear by source');

        var foe = { id: 'foe', _breachMark: { until: Date.now() + 5000 }, _chainHarvestMark: { until: Date.now() + 5000, bonusDmg: 0.35 } };
        var icons = CR.buildStatusIcons(foe);
        t.assert(icons.indexOf('破') >= 0, 'status has 破');
        t.assert(icons.indexOf('斬') >= 0, 'status has 斬');
    },

    _suiteModeMapping: function(t, mode) {
        var app = this._getApp();
        if (!window.CombatResolver || !CombatResolver.getMode) {
            t.skip('CombatResolver missing');
            return;
        }
        var mapped = CombatResolver.getMode(app);
        if (mode === 'ROGUE') t.eq(mapped, 'rogue', 'ROGUE maps to rogue');
        else if (mode === 'FFA' || mode === '3V3_BOUNTY' || mode === '3V3_KNOCKOUT') {
            // 3V3_* 目前 getMode 回 pve（非 FFA/BOUNTY 別名）；記為已知行為，只硬斷 FFA
            if (mode === 'FFA') t.eq(mapped, 'pvp', 'FFA maps to pvp');
            else t.assert(mapped === 'pve' || mapped === 'pvp', 'team mode maps to pve|pvp', 'got ' + mapped);
        } else if (mode === 'PVE') t.eq(mapped, 'pve', 'PVE maps to pve');
    },

    _suiteZhouyuSplash: function(t, mode) {
        if (!window.CombatResolver) {
            t.skip('CombatResolver missing');
            return;
        }
        var CR = CombatResolver;
        var app = this._getApp() || {};
        // mock app 最小欄位
        if (!app.playerController) {
            app.playerController = { brawlerType: 'zhouyu' };
        }
        var prevType = app.playerController.brawlerType;
        app.playerController.brawlerType = 'zhouyu';

        var cold = { id: 'bot_cold', team: 'red', activeStates: {} };
        var hot = {
            id: 'bot_hot',
            team: 'red',
            activeStates: {
                burn: { duration: 3, tickRate: 1, damagePerTick: 50 }
            }
        };

        t.assert(CR.hasFireDot(hot) === true, 'hasFireDot true when burning');
        t.assert(CR.hasFireDot(cold) === false, 'hasFireDot false when clean');
        t.assert(CR.hadFireDotBeforeHit(cold, { _hadFireDotBeforeHit: false }) === false, 'first-hit flag blocks splash gate');
        t.assert(CR.hadFireDotBeforeHit(hot, { _hadFireDotBeforeHit: true }) === true, 'pre-burn flag allows splash gate');

        var splashHits = [];
        var realDeal = CR._dealFireSplash;
        CR._dealFireSplash = function(a, attackerId, primary, dmg, radius) {
            splashHits.push({ dmg: dmg, radius: radius, primary: primary && primary.id });
        };
        var realFx = CR._spawnEmberAoeFx;
        CR._spawnEmberAoeFx = function() {};

        try {
            app._burnSplashCooldowns = {};
            // 第一發：命中前無灼燒 → 不應濺射
            CR.tryBurnSplash(app, 'player', 'player', cold, 250, {
                _hadFireDotBeforeHit: false
            });
            t.eq(splashHits.length, 0, 'first hit does not splash');

            // 第二發：命中前已有灼燒
            splashHits.length = 0;
            app._burnSplashCooldowns = {};
            CR.tryBurnSplash(app, 'player', 'player', hot, 300, {
                _hadFireDotBeforeHit: true
            });
            t.eq(splashHits.length, 1, 'pre-burn hit does splash');
            if (splashHits[0]) {
                var cfg = CR.resolveBurnSplash(app, 'player', 'player');
                var expect = Math.max(1, Math.round(300 * (cfg.splashPct || 0.22)));
                t.eq(splashHits[0].dmg, expect, 'splash dmg = hit * splashPct');
                t.eq(splashHits[0].radius, cfg.splashRadius, 'splash radius from kit');
            }

            // CD 內不重複
            splashHits.length = 0;
            CR.tryBurnSplash(app, 'player', 'player', hot, 300, {
                _hadFireDotBeforeHit: true
            });
            t.eq(splashHits.length, 0, 'splash respects per-target cooldown');
        } finally {
            CR._dealFireSplash = realDeal;
            CR._spawnEmberAoeFx = realFx;
            app.playerController.brawlerType = prevType;
        }
    },

    _suiteZhouyuEmber: function(t) {
        if (!window.CombatResolver) {
            t.skip('CombatResolver missing');
            return;
        }
        var CR = CombatResolver;
        var app = this._getApp() || {};
        if (!app.playerController) app.playerController = { brawlerType: 'zhouyu' };
        var prevType = app.playerController.brawlerType;
        app.playerController.brawlerType = 'zhouyu';

        var target = {
            id: 'bot_ember',
            team: 'red',
            activeStates: {
                burn: { duration: 3, tickRate: 1, damagePerTick: 100 }
            }
        };
        var realDeal = CR._dealEmberSplash;
        var realFx = CR._spawnEmberAoeFx;
        CR._dealEmberSplash = function() {};
        CR._spawnEmberAoeFx = function() {};
        try {
            app._emberCooldowns = {};
            // 本發才剛上火 → 不引爆
            var bonus0 = CR.tryEmberDetonate(app, 'player', 'player', target, {
                _hadFireDotBeforeHit: false
            });
            t.eq(bonus0, 0, 'ember blocked on first-apply hit');
            t.assert(!!target.activeStates.burn, 'burn still present after blocked ember');

            app._emberCooldowns = {};
            var bonus = CR.tryEmberDetonate(app, 'player', 'player', target, {
                _hadFireDotBeforeHit: true
            });
            var cfg = CR.resolveEmberDetonate(app, 'player', 'player');
            var remain = Math.round(100 * Math.ceil(3 / 1));
            var expect = Math.max(1, Math.round(remain * (cfg.remainingPct || 0.45)));
            t.eq(bonus, expect, 'ember main dmg = remaining * remainingPct');
            t.assert(!target.activeStates.burn, 'ember consumes burn');
        } finally {
            CR._dealEmberSplash = realDeal;
            CR._spawnEmberAoeFx = realFx;
            app.playerController.brawlerType = prevType;
        }
    },

    // 曹操無 base ember：裝備通用餘燼本命後應能引爆
    _suiteCaocaoEmberGrant: function(t) {
        if (!window.CombatResolver || !window.WordConfig) {
            t.skip('CombatResolver/WordConfig missing');
            return;
        }
        var CR = CombatResolver;
        var app = this._getApp() || {};
        if (!app.playerController) app.playerController = { brawlerType: 'caocao' };
        var prevType = app.playerController.brawlerType;
        var prevWs = app.wordSystem;
        app.playerController.brawlerType = 'caocao';

        var emberCard = window.WordConfig.cards.sig_zhouyu_ember;
        var realDeal = CR._dealEmberSplash;
        var realFx = CR._spawnEmberAoeFx;
        CR._dealEmberSplash = function() {};
        CR._spawnEmberAoeFx = function() {};
        try {
            app.wordSystem = null;
            t.assert(!CR.resolveEmberDetonate(app, 'player', 'player'), 'caocao without sig has no ember');

            app.wordSystem = {
                getSignatureKitStat: function(brawlerType, field) {
                    if (brawlerType !== 'caocao' || field !== 'emberDetonate') return null;
                    return emberCard.tiers[0].pve.emberDetonate;
                }
            };
            var granted = CR.resolveEmberDetonate(app, 'player', 'player');
            t.assert(!!granted, 'caocao with 餘燼 gains emberDetonate');
            t.eq(granted.remainingPct, 0.52, 'granted remainingPct from 餘燼 Lv1');

            var target = {
                id: 'bot_cc_ember',
                team: 'red',
                activeStates: { burn: { duration: 3, tickRate: 1, damagePerTick: 100 } }
            };
            app._emberCooldowns = {};
            var bonus = CR.tryEmberDetonate(app, 'player', 'player', target, {
                _hadFireDotBeforeHit: true
            });
            t.eq(bonus, Math.round(300 * 0.52), 'caocao ember detonates with granted cfg');
            t.assert(!target.activeStates.burn, 'caocao ember consumes burn');
        } finally {
            CR._dealEmberSplash = realDeal;
            CR._spawnEmberAoeFx = realFx;
            app.playerController.brawlerType = prevType;
            app.wordSystem = prevWs;
        }
    },

    _suiteSignaturePool: function(t, mode) {
        var app = this._getApp();
        var ws = app && app.wordSystem;
        if (!ws) {
            t.skip('wordSystem not ready');
            return;
        }
        if (typeof ws.getSignaturePool !== 'function') {
            t.skip('getSignaturePool missing');
            return;
        }
        var prevBase = ws._sigBaseBrawler;
        ws._sigBaseBrawler = 'zhouyu';
        try {
            var pool = ws.getSignaturePool();
            t.assert(pool.indexOf('sig_zhouyu_burn') >= 0, 'zhouyu pool has 業火 SSR');
            t.assert(pool.indexOf('sig_zhouyu_ember') >= 0, 'zhouyu pool has 餘燼 SR');
            t.assert(pool.indexOf('gen_burn_chance') < 0, 'retired 燒符 not in pool');
            t.assert(pool.indexOf('gen_bleed_chance') < 0, 'retired 血印 not in pool');
            t.assert(pool.indexOf('shu_ember_r') < 0, 'retired ember R not in pool');
        } finally {
            ws._sigBaseBrawler = prevBase;
        }

        ws._sigBaseBrawler = 'caocao';
        try {
            var poolCc = ws.getSignaturePool();
            t.assert(poolCc.indexOf('sig_caocao_burn') >= 0, 'caocao pool has 奸火 SSR');
            t.assert(poolCc.indexOf('sig_zhouyu_ember') >= 0, 'caocao pool has universal 餘燼');
            t.assert(poolCc.indexOf('gen_burn_chance') < 0, 'caocao pool has no 燒符');
        } finally {
            ws._sigBaseBrawler = prevBase;
        }

        if (mode !== 'ROGUE' && typeof ws.autoEquipSignatureForMatch === 'function') {
            t.assert(true, 'autoEquipSignatureForMatch available for non-rogue');
        }
    },

    _suiteLiveProbe: function(t) {
        var app = this._getApp();
        if (!app) {
            t.skip('no app');
            return;
        }
        var mode = this._currentModeLabel();
        t.assert(!!mode && mode !== 'UNKNOWN', 'mode label readable', mode);

        var pc = app.playerController;
        if (!pc || !pc.brawlerType) {
            t.skip('player not selected yet');
            return;
        }
        t.assert(!!window.BrawlerConfig[pc.brawlerType], 'selected brawler has config', pc.brawlerType);

        if (pc.brawlerType === 'zhouyu') {
            t.assert(!!pc.config || !!pc.baseConfig, 'zhouyu runtime config present');
            var bc = pc.baseConfig || window.BrawlerConfig.zhouyu;
            t.assert(!!bc.burnSplash, 'live zhouyu has burnSplash');
            t.assert(!!bc.emberDetonate, 'live zhouyu has emberDetonate');
        }

        var bots = app.botController && app.botController.bots;
        if (bots) {
            var alive = 0;
            for (var i = 0; i < bots.length; i++) {
                if (bots[i].state === 'alive') alive++;
            }
            t.assert(alive >= 0, 'bots array readable (alive=' + alive + ')');
        }
    },

    // ── Public runners ─────────────────────────────────────────
    runMode: function(mode) {
        var self = this;
        var summary = { mode: mode, suites: [], pass: 0, fail: 0 };
        this._withMode(mode, function() {
            var suites = [
                ['config', function(t) { self._suiteConfig(t); }],
                ['modeMapping', function(t) { self._suiteModeMapping(t, mode); }],
                ['zhouyuSplash', function(t) { self._suiteZhouyuSplash(t, mode); }],
                ['zhouyuEmber', function(t) { self._suiteZhouyuEmber(t, mode); }],
                ['caocaoEmberGrant', function(t) { self._suiteCaocaoEmberGrant(t); }],
                ['signaturePool', function(t) { self._suiteSignaturePool(t, mode); }],
                ['wordResonance', function(t) { self._suiteWordResonance(t); }],
                ['nextHitMods', function(t) { self._suiteNextHitMods(t); }]
            ];
            for (var i = 0; i < suites.length; i++) {
                var r = self._runSuite(mode, suites[i][0], suites[i][1]);
                summary.suites.push(r);
                summary.pass += r.pass;
                summary.fail += r.fail;
            }
        });
        return summary;
    },

    runAllModes: function() {
        console.log('%c[DevModeTest] runAllModes…', 'color:#c9a25a;font-weight:bold');
        var all = [];
        var totalPass = 0;
        var totalFail = 0;
        for (var i = 0; i < this.MODES.length; i++) {
            var s = this.runMode(this.MODES[i]);
            all.push(s);
            totalPass += s.pass;
            totalFail += s.fail;
            console.log(
                '[DevModeTest] ' + s.mode + ' → pass=' + s.pass + ' fail=' + s.fail
            );
        }
        console.log(
            '%c[DevModeTest] 完成 pass=' + totalPass + ' fail=' + totalFail +
            (totalFail ? '（失敗已寫入報告，DevModeTest.report()）' : ''),
            totalFail ? 'color:#e04848;font-weight:bold' : 'color:#5cb85c;font-weight:bold'
        );
        return { pass: totalPass, fail: totalFail, modes: all };
    },

    run: function() {
        var mode = this._currentModeLabel();
        console.log('[DevModeTest] run current mode:', mode);
        return this.runMode(mode);
    },

    probe: function() {
        var mode = this._currentModeLabel();
        console.log('[DevModeTest] live probe:', mode);
        return this._runSuite(mode, 'liveProbe', this._suiteLiveProbe.bind(this));
    },

    /**
     * Subsystem 效能探測（含引擎／GPU／drawCalls）。
     *   DevModeTest.perf(true)                         開始（HUD + 每 2s console）
     *   DevModeTest.perf(true, {hud:false})            只要 console
     *   DevModeTest.perf(true, {miniStats:true})       額外開 pc.MiniStats
     *   DevModeTest.perf(false)                        停止
     *   DevModeTest.perf()                             印目前狀態／最後一筆
     */
    perf: function(on, opts) {
        if (on === true || on === 1 || on === 'on' || on === 'start') {
            return PerfProbe.start(opts || { hud: true, logMs: 2000 });
        }
        if (on === false || on === 0 || on === 'off' || on === 'stop') {
            return PerfProbe.stop();
        }
        return PerfProbe.report();
    },

    perfReport: function() {
        return PerfProbe.report();
    }
};

// ═══════════════════════════════════════════════════════════════
// PerfProbe — game script wrap + app.stats 引擎／GPU／drawCalls
// 正式局預設關閉；僅 DevModeTest.perf(true) 或 ?perf=1 啟動
// ═══════════════════════════════════════════════════════════════
var PerfProbe = {
    active: false,
    _wrapped: false,
    _onUpdate: null,
    _hud: null,
    _logMs: 2000,
    _hudMs: 500,
    _lastLogAt: 0,
    _lastHudAt: 0,
    _windowStart: 0,
    _frameCount: 0,
    _frameDtSum: 0,
    _frameDtMax: 0,
    _frameDts: null,
    _sys: null,
    _lastSnapshot: null,
    _showHud: true,
    _wantMiniStats: false,
    _miniStats: null,
    _engineAcc: null,
    _vconsoleWarned: false,

    _now: function() {
        return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    },

    _shouldAutoStart: function() {
        try {
            var q = (typeof location !== 'undefined' && location.search) ? location.search : '';
            return /[?&]perf=1(?:&|$)/.test(q) || /[?&]perf=true(?:&|$)/.test(q);
        } catch (e) {
            return false;
        }
    },

    _targets: function() {
        return [
            { key: 'bot', label: 'bot', proto: typeof BotController !== 'undefined' ? BotController.prototype : null },
            { key: 'bullet', label: 'bullet', proto: typeof BulletManager !== 'undefined' ? BulletManager.prototype : null },
            { key: 'floatUI', label: 'floatUI', proto: typeof FloatingUIManager !== 'undefined' ? FloatingUIManager.prototype : null },
            { key: 'player', label: 'player', proto: typeof PlayerController !== 'undefined' ? PlayerController.prototype : null },
            { key: 'enemy', label: 'enemy', proto: typeof EnemyManager !== 'undefined' ? EnemyManager.prototype : null },
            { key: 'mode', label: 'mode', proto: typeof GameModeManager !== 'undefined' ? GameModeManager.prototype : null },
            { key: 'score', label: 'score', proto: typeof ScoreManager !== 'undefined' ? ScoreManager.prototype : null },
            { key: 'rogue', label: 'rogue', proto: typeof RogueDirector !== 'undefined' ? RogueDirector.prototype : null },
            { key: 'input', label: 'input', proto: typeof InputManager !== 'undefined' ? InputManager.prototype : null },
            { key: 'cam', label: 'cam', proto: typeof CameraFollow !== 'undefined' ? CameraFollow.prototype : null },
            { key: 'gem', label: 'gem', proto: typeof GemManager !== 'undefined' ? GemManager.prototype : null },
            { key: 'combat', label: 'combat', proto: typeof CombatManager !== 'undefined' ? CombatManager.prototype : null }
        ];
    },

    _ensureSys: function() {
        if (this._sys) return;
        this._sys = {};
        var list = this._targets();
        for (var i = 0; i < list.length; i++) {
            this._sys[list[i].key] = { sum: 0, max: 0, calls: 0 };
        }
    },

    _resetEngineAcc: function() {
        this._engineAcc = {
            n: 0,
            frameMsSum: 0,
            frameMsMax: 0,
            cpuUpdateSum: 0,
            cpuRenderSum: 0,
            gpuMsSum: 0,
            gpuMsN: 0,
            drawsSum: 0,
            drawsMax: 0,
            trisSum: 0,
            shadersSum: 0
        };
    },

    _resetWindow: function() {
        this._ensureSys();
        this._windowStart = this._now();
        this._frameCount = 0;
        this._frameDtSum = 0;
        this._frameDtMax = 0;
        this._frameDts = [];
        this._resetEngineAcc();
        for (var k in this._sys) {
            if (!Object.prototype.hasOwnProperty.call(this._sys, k)) continue;
            this._sys[k].sum = 0;
            this._sys[k].max = 0;
            this._sys[k].calls = 0;
        }
    },

    _add: function(key, ms) {
        var s = this._sys[key];
        if (!s) return;
        s.sum += ms;
        s.calls += 1;
        if (ms > s.max) s.max = ms;
    },

    _num: function(v) {
        return (typeof v === 'number' && isFinite(v)) ? v : null;
    },

    /** 容錯讀取 PlayCanvas app.stats 各版本欄位 */
    _readEngineSample: function() {
        var app = DevModeTest._getApp();
        var out = {
            frameMs: null,
            cpuUpdate: null,
            cpuRender: null,
            gpuMs: null,
            draws: null,
            tris: null,
            shaders: null
        };
        if (!app || !app.stats) return out;
        var st = app.stats;
        var fr = st.frame || {};

        out.frameMs = this._num(fr.ms);
        if (out.frameMs == null) out.frameMs = this._num(fr.frameTime);
        if (out.frameMs == null) out.frameMs = this._num(fr.time);

        out.cpuUpdate = this._num(fr.updateTime);
        if (out.cpuUpdate == null) out.cpuUpdate = this._num(fr.update);
        if (out.cpuUpdate == null) out.cpuUpdate = this._num(fr.cpuUpdate);

        out.cpuRender = this._num(fr.renderTime);
        if (out.cpuRender == null) out.cpuRender = this._num(fr.render);
        if (out.cpuRender == null) out.cpuRender = this._num(fr.cpuRender);

        out.gpuMs = this._num(fr.gpuMs);
        if (out.gpuMs == null) out.gpuMs = this._num(fr.gpuTime);
        if (out.gpuMs == null) out.gpuMs = this._num(fr.gpu);
        // 部分版本把 GPU 計時放在 graphicsDevice
        if (out.gpuMs == null && app.graphicsDevice) {
            var gd = app.graphicsDevice;
            out.gpuMs = this._num(gd._gpuFrameTime);
            if (out.gpuMs == null) out.gpuMs = this._num(gd.gpuFrameTime);
        }

        var dc = st.drawCalls;
        if (typeof dc === 'number') out.draws = dc;
        else if (dc && typeof dc === 'object') {
            out.draws = this._num(dc.total);
            if (out.draws == null) out.draws = this._num(dc.drawCalls);
            if (out.draws == null) out.draws = this._num(dc.opaque);
        }
        if (out.draws == null) out.draws = this._num(st.drawCalls);

        var misc = st.misc || {};
        out.shaders = this._num(st.shaders) || this._num(misc.shaders) || this._num(fr.shaders);

        // triangles：常見路徑 scene / mesh / misc
        out.tris = this._num(st.triangles);
        if (out.tris == null && st.scene) out.tris = this._num(st.scene.meshInstances) || this._num(st.scene.triangles);
        if (out.tris == null) out.tris = this._num(misc.triangles) || this._num(fr.triangles);

        return out;
    },

    _sampleEngine: function() {
        var s = this._readEngineSample();
        var acc = this._engineAcc;
        if (!acc) {
            this._resetEngineAcc();
            acc = this._engineAcc;
        }
        acc.n++;
        if (s.frameMs != null) {
            acc.frameMsSum += s.frameMs;
            if (s.frameMs > acc.frameMsMax) acc.frameMsMax = s.frameMs;
        }
        if (s.cpuUpdate != null) acc.cpuUpdateSum += s.cpuUpdate;
        if (s.cpuRender != null) acc.cpuRenderSum += s.cpuRender;
        if (s.gpuMs != null) {
            acc.gpuMsSum += s.gpuMs;
            acc.gpuMsN++;
        }
        if (s.draws != null) {
            acc.drawsSum += s.draws;
            if (s.draws > acc.drawsMax) acc.drawsMax = s.draws;
        }
        if (s.tris != null) acc.trisSum += s.tris;
        if (s.shaders != null) acc.shadersSum += s.shaders;
    },

    _detectVConsole: function() {
        try {
            if (typeof window !== 'undefined' && window.VConsole) return true;
            if (typeof document !== 'undefined' && document.querySelector) {
                if (document.querySelector('#__vconsole') || document.querySelector('.vc-switch')) return true;
            }
        } catch (e) { /* ignore */ }
        return false;
    },

    _readPostFx: function() {
        var app = DevModeTest._getApp();
        var out = { bloom: null, ssao: null, taa: null, dof: null, found: false };
        if (!app || !app.root) return out;
        try {
            var cam = app.root.findByName('Camera');
            if (!cam && app.root.findComponents) {
                var cams = app.root.findComponents('camera');
                if (cams && cams.length) cam = cams[0].entity;
            }
            if (!cam || !cam.script) return out;
            var cf = cam.script.cameraFrame || cam.script.CameraFrame;
            // ESM script 名稱可能是 cameraFrame
            if (!cf && cam.script._scripts) {
                for (var i = 0; i < cam.script._scripts.length; i++) {
                    var sc = cam.script._scripts[i];
                    if (sc && (sc.__scriptType && sc.__scriptType.__name === 'cameraFrame')) {
                        cf = sc;
                        break;
                    }
                    if (sc && sc.bloom != null && sc.ssao != null) {
                        cf = sc;
                        break;
                    }
                }
            }
            if (!cf) return out;
            out.found = true;
            if (cf.bloom) out.bloom = !!cf.bloom.enabled || (this._num(cf.bloom.intensity) > 0);
            if (cf.ssao) {
                var t = cf.ssao.type;
                out.ssao = !!(t && String(t) !== 'none' && String(t) !== 'None' && t !== 0);
            }
            if (cf.taa) out.taa = !!cf.taa.enabled;
            if (cf.dof) out.dof = !!cf.dof.enabled;
        } catch (e2) { /* ignore */ }
        return out;
    },

    _wrapAll: function() {
        var self = this;
        var list = this._targets();
        for (var i = 0; i < list.length; i++) {
            var t = list[i];
            if (!t.proto || typeof t.proto.update !== 'function') continue;
            if (t.proto.update._perfWrapped) continue;
            (function(key, proto) {
                var orig = proto.update;
                proto.update = function(dt) {
                    if (!self.active) return orig.call(this, dt);
                    var t0 = self._now();
                    try {
                        return orig.call(this, dt);
                    } finally {
                        self._add(key, self._now() - t0);
                    }
                };
                proto.update._perfWrapped = true;
                proto.update._perfOrig = orig;
            })(t.key, t.proto);
        }
        this._wrapped = true;
    },

    _counts: function() {
        var app = DevModeTest._getApp();
        var bots = 0;
        var bullets = 0;
        var zones = 0;
        var bars = 0;
        var enemies = 0;
        if (app) {
            if (app.botController && app.botController.bots) bots = app.botController.bots.length;
            if (app.bulletManager) {
                if (app.bulletManager.bullets) bullets = app.bulletManager.bullets.length;
                if (app.bulletManager.damageZones) zones = app.bulletManager.damageZones.length;
            }
            if (app.floatingUIManager && app.floatingUIManager.bars) {
                for (var id in app.floatingUIManager.bars) {
                    if (Object.prototype.hasOwnProperty.call(app.floatingUIManager.bars, id)) bars++;
                }
            }
            if (app.enemyManager && app.enemyManager.enemies) {
                for (var eid in app.enemyManager.enemies) {
                    if (Object.prototype.hasOwnProperty.call(app.enemyManager.enemies, eid)) enemies++;
                }
            }
        }
        return { bots: bots, bullets: bullets, zones: zones, bars: bars, enemies: enemies };
    },

    _avgAcc: function(sum, n) {
        if (!(n > 0)) return null;
        return sum / n;
    },

    _snapshot: function() {
        var elapsed = Math.max(0.001, (this._now() - this._windowStart) / 1000);
        var fps = this._frameCount / elapsed;

        // 權威 frame 時間：優先 app.stats.frame.ms，否則用有效 dt 平均
        var acc = this._engineAcc || { n: 0, frameMsSum: 0, frameMsMax: 0 };
        var statsFrameAvg = this._avgAcc(acc.frameMsSum, acc.n);
        var dtAvgMs = this._frameCount > 0 ? (this._frameDtSum / this._frameCount) * 1000 : 0;
        var avgFrameMs = (statsFrameAvg != null && statsFrameAvg > 0) ? statsFrameAvg : dtAvgMs;
        var maxFrameMs = Math.max(acc.frameMsMax || 0, this._frameDtMax * 1000);

        var dts = this._frameDts || [];
        var onePctLow = fps;
        if (dts.length >= 20) {
            var sorted = dts.slice().sort(function(a, b) { return b - a; });
            var n = Math.max(1, Math.ceil(sorted.length * 0.01));
            var sum = 0;
            for (var i = 0; i < n; i++) sum += sorted[i];
            var worstAvg = sum / n;
            onePctLow = worstAvg > 0 ? (1 / worstAvg) : 0;
        }

        var systems = [];
        var measuredSum = 0;
        var worstKey = '';
        var worstAvgMs = -1;
        for (var k in this._sys) {
            if (!Object.prototype.hasOwnProperty.call(this._sys, k)) continue;
            var s = this._sys[k];
            var avgMs = this._frameCount > 0 ? (s.sum / this._frameCount) : 0;
            measuredSum += s.sum;
            systems.push({
                key: k,
                avgMs: +avgMs.toFixed(3),
                maxMs: +s.max.toFixed(3),
                calls: s.calls,
                totalMs: +s.sum.toFixed(2)
            });
            if (avgMs > worstAvgMs) {
                worstAvgMs = avgMs;
                worstKey = k;
            }
        }
        systems.sort(function(a, b) { return b.avgMs - a.avgMs; });

        var scriptsMs = this._frameCount > 0 ? (measuredSum / this._frameCount) : 0;
        var otherMs = Math.max(0, avgFrameMs - scriptsMs);
        // other 明顯大於 scripts → 成本在引擎／GPU／未量測區
        var hint = (otherMs > Math.max(1.5, scriptsMs * 2)) ? 'OTHER' : (worstKey || 'script');

        var cpuUpdate = this._avgAcc(acc.cpuUpdateSum, acc.n);
        var cpuRender = this._avgAcc(acc.cpuRenderSum, acc.n);
        var gpuMs = this._avgAcc(acc.gpuMsSum, acc.gpuMsN);
        var draws = this._avgAcc(acc.drawsSum, acc.n);
        var tris = this._avgAcc(acc.trisSum, acc.n);
        var shaders = this._avgAcc(acc.shadersSum, acc.n);

        var engine = {
            frameMs: avgFrameMs != null ? +avgFrameMs.toFixed(2) : null,
            frameMsMax: +maxFrameMs.toFixed(2),
            cpuUpdate: cpuUpdate != null ? +cpuUpdate.toFixed(2) : null,
            cpuRender: cpuRender != null ? +cpuRender.toFixed(2) : null,
            gpuMs: gpuMs != null ? +gpuMs.toFixed(2) : null,
            draws: draws != null ? Math.round(draws) : null,
            drawsMax: acc.drawsMax || null,
            tris: tris != null ? Math.round(tris) : null,
            shaders: shaders != null ? Math.round(shaders) : null
        };

        var counts = this._counts();
        var postFx = this._readPostFx();
        var vconsole = this._detectVConsole();

        var snap = {
            at: new Date().toISOString(),
            mode: DevModeTest._currentModeLabel(),
            frames: this._frameCount,
            secs: +elapsed.toFixed(2),
            fps: +fps.toFixed(1),
            avgFrameMs: +avgFrameMs.toFixed(2),
            maxFrameMs: +maxFrameMs.toFixed(2),
            onePctLowFps: +onePctLow.toFixed(1),
            scriptsMs: +scriptsMs.toFixed(2),
            otherMs: +otherMs.toFixed(2),
            measuredMsPerFrame: +scriptsMs.toFixed(2),
            worst: worstKey,
            hint: hint,
            engine: engine,
            postFx: postFx,
            vconsole: vconsole,
            counts: counts,
            systems: systems
        };
        this._lastSnapshot = snap;
        return snap;
    },

    _fmtOpt: function(v, digits) {
        if (v == null || v !== v) return 'n/a';
        if (digits == null) return String(v);
        return Number(v).toFixed(digits);
    },

    _formatPostFx: function(pf) {
        if (!pf || !pf.found) return 'postFx=?';
        return 'postFx=' +
            (pf.bloom ? 'bloom' : '-') +
            (pf.ssao ? '+ssao' : '') +
            (pf.taa ? '+taa' : '') +
            (pf.dof ? '+dof' : '');
    },

    _formatLine: function(snap) {
        var eng = snap.engine || {};
        var top = snap.systems.slice(0, 4).map(function(s) {
            return s.key + '=' + s.avgMs.toFixed(1);
        }).join(' ');
        var c = snap.counts;
        var line = '[Perf] fps=' + snap.fps +
            ' frame=' + this._fmtOpt(eng.frameMs, 1) + 'ms' +
            ' scripts=' + this._fmtOpt(snap.scriptsMs, 1) +
            ' other=' + this._fmtOpt(snap.otherMs, 1) +
            ' gpu=' + this._fmtOpt(eng.gpuMs, 1) +
            ' draws=' + this._fmtOpt(eng.draws, 0) +
            ' | cpuU=' + this._fmtOpt(eng.cpuUpdate, 1) +
            ' cpuR=' + this._fmtOpt(eng.cpuRender, 1) +
            ' | ' + top +
            ' | bots=' + c.bots +
            ' bullets=' + c.bullets +
            ' bars=' + c.bars +
            ' | worst=' + snap.worst +
            ' hint=' + snap.hint +
            ' | ' + this._formatPostFx(snap.postFx);
        if (snap.vconsole) line += ' | WARN=vConsole';
        return line;
    },

    _ensureHud: function() {
        if (this._hud || typeof document === 'undefined') return;
        var el = document.createElement('div');
        el.id = 'tk-perf-probe';
        el.style.cssText = [
            'position:fixed', 'left:8px', 'bottom:8px', 'z-index:99999',
            'padding:8px 10px', 'background:rgba(0,0,0,0.72)', 'color:#f0e6d2',
            'font:12px/1.35 Consolas,Menlo,monospace', 'border:1px solid #c9a25a',
            'border-radius:4px', 'pointer-events:none', 'white-space:pre',
            'max-width:92vw'
        ].join(';');
        document.body.appendChild(el);
        this._hud = el;
    },

    _removeHud: function() {
        if (this._hud && this._hud.parentNode) this._hud.parentNode.removeChild(this._hud);
        this._hud = null;
    },

    _updateHud: function(snap) {
        if (!this._showHud) return;
        this._ensureHud();
        if (!this._hud) return;
        var eng = snap.engine || {};
        var lines = [];
        lines.push(
            'PERF  fps ' + snap.fps +
            '  frame ' + this._fmtOpt(eng.frameMs, 1) + 'ms' +
            '  max ' + this._fmtOpt(eng.frameMsMax, 1) +
            '  1% ' + snap.onePctLowFps
        );
        lines.push(
            'split scripts ' + this._fmtOpt(snap.scriptsMs, 1) +
            '  other ' + this._fmtOpt(snap.otherMs, 1) +
            '  hint ' + snap.hint
        );
        lines.push(
            'engine gpu ' + this._fmtOpt(eng.gpuMs, 1) +
            '  draws ' + this._fmtOpt(eng.draws, 0) +
            '  cpuU ' + this._fmtOpt(eng.cpuUpdate, 1) +
            '  cpuR ' + this._fmtOpt(eng.cpuRender, 1)
        );
        if (eng.tris != null || eng.shaders != null) {
            lines.push('geo   tris ' + this._fmtOpt(eng.tris, 0) + '  shaders ' + this._fmtOpt(eng.shaders, 0));
        }
        lines.push(this._formatPostFx(snap.postFx) + (snap.vconsole ? '  WARN:vConsole' : ''));
        lines.push(
            'load  bots ' + snap.counts.bots +
            '  bullets ' + snap.counts.bullets +
            '  bars ' + snap.counts.bars +
            '  enemies ' + snap.counts.enemies
        );
        lines.push('scripts worst=' + snap.worst + ' (ms/frame)');
        var n = Math.min(5, snap.systems.length);
        for (var i = 0; i < n; i++) {
            var s = snap.systems[i];
            if (s.avgMs < 0.05 && s.maxMs < 0.2) continue;
            lines.push(
                (s.key + '          ').slice(0, 8) +
                s.avgMs.toFixed(2) + ' avg   ' +
                s.maxMs.toFixed(2) + ' max'
            );
        }
        this._hud.textContent = lines.join('\n');
    },

    _startMiniStats: function() {
        if (this._miniStats) return true;
        var app = DevModeTest._getApp();
        if (!app) {
            console.warn('[PerfProbe] MiniStats：找不到 app');
            return false;
        }
        var Mini = null;
        if (typeof pc !== 'undefined' && pc.MiniStats) Mini = pc.MiniStats;
        if (!Mini && typeof window !== 'undefined' && window.pc && window.pc.MiniStats) Mini = window.pc.MiniStats;
        if (!Mini) {
            console.warn('[PerfProbe] 此建置沒有 pc.MiniStats，略過（仍有 app.stats 數字）');
            return false;
        }
        try {
            this._miniStats = new Mini(app);
            console.log('[PerfProbe] MiniStats ON');
            return true;
        } catch (e) {
            console.warn('[PerfProbe] MiniStats 啟動失敗:', e && e.message ? e.message : e);
            this._miniStats = null;
            return false;
        }
    },

    _stopMiniStats: function() {
        if (!this._miniStats) return;
        try {
            if (typeof this._miniStats.destroy === 'function') this._miniStats.destroy();
            else if (typeof this._miniStats.enabled !== 'undefined') this._miniStats.enabled = false;
        } catch (e) { /* ignore */ }
        this._miniStats = null;
    },

    _onAppUpdate: function(dt) {
        if (!this.active) return;

        // 修正 avg=0：忽略無效／暫停幀（dt<=0 或異常巨大的 tab 恢復幀）
        if (!(dt > 0) || dt > 1.0) {
            return;
        }

        this._frameCount++;
        this._frameDtSum += dt;
        if (dt > this._frameDtMax) this._frameDtMax = dt;
        if (this._frameDts.length < 600) this._frameDts.push(dt);
        else this._frameDts[this._frameCount % 600] = dt;

        this._sampleEngine();

        var now = this._now();
        if (now - this._lastHudAt >= this._hudMs) {
            this._lastHudAt = now;
            this._updateHud(this._snapshot());
        }
        if (now - this._lastLogAt >= this._logMs) {
            this._lastLogAt = now;
            var snap = this._snapshot();
            console.log(this._formatLine(snap));
            if (snap.vconsole && !this._vconsoleWarned) {
                this._vconsoleWarned = true;
                console.warn('[PerfProbe] 偵測到 vConsole — 會放大掉幀與量測噪音，測效能時建議關閉');
            }
            this._resetWindow();
            this._lastLogAt = this._now();
            this._lastHudAt = this._lastLogAt;
        }
    },

    start: function(opts) {
        opts = opts || {};
        this._showHud = opts.hud !== false;
        this._wantMiniStats = !!opts.miniStats;
        this._logMs = (opts.logMs > 500) ? opts.logMs : 2000;
        this._hudMs = (opts.hudMs > 100) ? opts.hudMs : 500;
        this._vconsoleWarned = false;

        this._wrapAll();
        this._ensureSys();
        this._resetWindow();
        this.active = true;
        this._lastLogAt = this._now();
        this._lastHudAt = this._now();

        var app = DevModeTest._getApp();
        if (app && !this._onUpdate) {
            this._onUpdate = this._onAppUpdate.bind(this);
            app.on('update', this._onUpdate);
        }

        if (this._showHud) this._ensureHud();
        if (this._wantMiniStats) this._startMiniStats();

        if (this._detectVConsole()) {
            console.warn('[PerfProbe] 偵測到 vConsole — 測 lag 時建議關閉再對照');
        }

        console.log('%c[PerfProbe] ON — 每 ' + (this._logMs / 1000) + 's 印一次；看 hint=OTHER vs scripts', 'color:#c9a25a;font-weight:bold');
        console.log('[PerfProbe] DevModeTest.perfReport() 立刻看表；miniStats: DevModeTest.perf(true,{miniStats:true})');
        return {
            active: true,
            hud: this._showHud,
            logMs: this._logMs,
            miniStats: !!this._miniStats
        };
    },

    stop: function() {
        this.active = false;
        var app = DevModeTest._getApp();
        if (app && this._onUpdate) {
            app.off('update', this._onUpdate);
            this._onUpdate = null;
        }
        this._stopMiniStats();
        this._removeHud();
        var last = this._lastSnapshot;
        console.log('%c[PerfProbe] OFF', 'color:#c9a25a;font-weight:bold');
        if (last) console.log(this._formatLine(last));
        return { active: false, last: last };
    },

    report: function() {
        var snap = this.active ? this._snapshot() : this._lastSnapshot;
        if (!snap) {
            console.log('[PerfProbe] 尚無資料。先 DevModeTest.perf(true) 再打一會 Rogue。');
            return null;
        }
        console.log('%c[PerfProbe] report', 'color:#c9a25a;font-weight:bold');
        console.log(this._formatLine(snap));
        console.log('[PerfProbe] engine', snap.engine);
        console.log('[PerfProbe] postFx', snap.postFx, 'vconsole=', snap.vconsole, 'hint=', snap.hint);
        console.table(snap.systems);
        if (snap.engine) {
            console.table([{
                frameMs: snap.engine.frameMs,
                scriptsMs: snap.scriptsMs,
                otherMs: snap.otherMs,
                gpuMs: snap.engine.gpuMs,
                cpuUpdate: snap.engine.cpuUpdate,
                cpuRender: snap.engine.cpuRender,
                draws: snap.engine.draws,
                tris: snap.engine.tris,
                shaders: snap.engine.shaders,
                hint: snap.hint
            }]);
        }
        return snap;
    }
};

if (typeof window !== 'undefined') {
    window.DevModeTest = DevModeTest;
    window.PerfProbe = PerfProbe;
}
