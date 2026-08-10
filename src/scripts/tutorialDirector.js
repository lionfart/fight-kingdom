// ═══════════════════════════════════════════════════════════════
// TutorialDirector — Rogue 教學局步驟機（無大廳 modal）
// 入口：!tutorialDone 進 ROGUE 自動開；或 app._forceTutorialRun = true
// 可由 rogueDirector._ensureTutorialDirector 程式化掛載（不必 Editor 接線）
// ═══════════════════════════════════════════════════════════════
var TutorialDirector = pc.createScript('tutorialDirector');

TutorialDirector.prototype.initialize = function() {
    this.app.tutorialDirector = this;
    this.active = false;
    this.stepIndex = -1;
    this._step = null;
    this._progress = 0;
    this._moveOrigin = null;
    this._phaseBSpawned = false;
    this._phaseARespawnAt = 0;
    this._tipEl = null;
    this._styleId = 'tutorial-style-v3';
    this.tutorialEntry = 'rogue_inline'; // rogue_inline | lobby_help
    this._bootstrapped = !this.entity || !this.entity.script || !this.entity.script.tutorialDirector;

    this.app.on('game:start', this._onGameStart, this);
    this.app.on('rogue:begin', this._onRogueBegin, this);
    this.app.on('tutorial:attack', this._onAttack, this);
    this.app.on('tutorial:dash', this._onDash, this);
    this.app.on('tutorial:super', this._onSuper, this);
    this.app.on('tutorial:perfectDodge', this._onPerfect, this);
    this.app.on('tutorial:waveCleared', this._onWaveCleared, this);
    this.app.on('tutorial:cardPicked', this._onCardPicked, this);
    // Object.create 掛載時引擎不會呼叫 script.update，改聽 app update
    this.app.on('update', this._onAppUpdate, this);

    // this.on('destroy') 需要 EventHandler 建構；bootstrap 實例沒有，改走 _cleanup
    if (!this._bootstrapped && typeof this.on === 'function') {
        this.on('destroy', this._cleanup, this);
    }
};

TutorialDirector.prototype._cleanup = function() {
    this.app.off('game:start', this._onGameStart, this);
    this.app.off('rogue:begin', this._onRogueBegin, this);
    this.app.off('tutorial:attack', this._onAttack, this);
    this.app.off('tutorial:dash', this._onDash, this);
    this.app.off('tutorial:super', this._onSuper, this);
    this.app.off('tutorial:perfectDodge', this._onPerfect, this);
    this.app.off('tutorial:waveCleared', this._onWaveCleared, this);
    this.app.off('tutorial:cardPicked', this._onCardPicked, this);
    this.app.off('update', this._onAppUpdate, this);
    this._removeTip();
    this._removeSkipBtn();
    if (this.app.tutorialDirector === this) this.app.tutorialDirector = null;
};

TutorialDirector.prototype._onAppUpdate = function(dt) {
    this.update(dt);
};

TutorialDirector.prototype._cfg = function() {
    return window.TutorialConfig || null;
};

TutorialDirector.prototype._isMobile = function() {
    return !!(this.app.touch) || ('ontouchstart' in window);
};

TutorialDirector.prototype.shouldForceTutorialRun = function(mode) {
    mode = String(mode || '').toUpperCase();
    if (mode !== 'ROGUE') return false;
    if (this.app._forceTutorialRun) return true;
    if (window.TutorialConfig && window.TutorialConfig.autoStart === false) return false;
    var pm = this.app.progressionManager;
    return !!(pm && pm.isTutorialDone && !pm.isTutorialDone());
};

TutorialDirector.prototype._onGameStart = function(data) {
    if (!data || String(data.mode || '').toUpperCase() !== 'ROGUE') return;
    if (!this.shouldForceTutorialRun('ROGUE')) return;
    this.app._pendingTutorialRun = true;
    data.brawler = (this._cfg() && this._cfg().heroBrawlerType) || 'guanyu';
};

TutorialDirector.prototype._onRogueBegin = function() {
    var rd = this.app.rogueDirector;
    if (!rd || !rd.isTutorialRun) {
        this.active = false;
        this._removeSkipBtn();
        return;
    }
    // 入口：大廳演武 / 強制重跑 → lobby_help；Roguelike 首次自動 → rogue_inline
    if (this.app._tutorialEntry === 'lobby_help' || this.app._tutorialEntry === 'rogue_inline') {
        this.tutorialEntry = this.app._tutorialEntry;
    } else if (this.app._forceTutorialRun) {
        this.tutorialEntry = 'lobby_help';
    } else {
        this.tutorialEntry = 'rogue_inline';
    }
    this._injectStyles();
    this.active = true;
    this.stepIndex = -1;
    this._progress = 0;
    this._moveOrigin = null;
    this._phaseBSpawned = false;
    this._phaseARespawnAt = 0;
    this._showSkipBtn();
    this._advanceStep();
};

TutorialDirector.prototype.allowsWaveClear = function() {
    if (!this.active) return true;
    return !!(this._step && this._step.complete && this._step.complete.type === 'waveClear');
};

TutorialDirector.prototype._steps = function() {
    var cfg = this._cfg();
    return (cfg && cfg.steps) ? cfg.steps : [];
};

TutorialDirector.prototype._advanceStep = function() {
    var steps = this._steps();
    this.stepIndex++;
    this._progress = 0;
    if (this.stepIndex >= steps.length) {
        this._finishTutorial(true);
        return;
    }
    this._step = steps[this.stepIndex];
    this._enterStep(this._step);
};

TutorialDirector.prototype._enterStep = function(step) {
    if (!step) return;
    // 最後一步直接進結算 UI（依入口分流）
    if (step.id === 'complete') {
        this._finishTutorial(true);
        return;
    }
    // 攻擊步驟之外清掉演武木樁，避免開場就看到 12000 血怪掛場
    if (!step.spawn) this._cleanupTutorialDummies();
    // 完美閃避完成後解除無敵，讓清場可擊殺
    if (step.complete && step.complete.type === 'waveClear') {
        this._setPhaseAImmortal(false);
    }

    var mobile = this._isMobile();
    var loc = (window.TutorialConfig && TutorialConfig.loc) ? TutorialConfig.loc : function (v) {
        return (v && v.zh) ? v.zh : (v || '');
    };
    var bodyRaw = mobile ? step.body : (step.bodyPc || step.body);
    var body = loc(bodyRaw);
    var title = loc(step.title);
    var withBtn = !!(step.complete && step.complete.type === 'button');
    var dismissible = !withBtn; // 選卡等步驟可關提示，避免檔到確認鈕
    var tipOpts = {
        dismissible: dismissible,
        // 搖杆／走位教學：提示改置頂，避免擋住拇指拖曳區
        top: !!(step.anchor === 'joystick' || (step.complete && step.complete.type === 'cardConfirmed'))
    };
    this._showTip(title, body, withBtn, tipOpts);

    if (step.grantSuperCharge) this._grantFullSuper();
    if (step.spawn) this._spawnDummy(step.spawn);
    if (step.spawnWavePhase === 'phase_a') this._spawnPhaseA();
    if (step.spawnWavePhase === 'phase_b') this._spawnPhaseB();

    if (step.complete && step.complete.type === 'moveDistance') {
        var pc = this.app.playerController;
        this._moveOrigin = (pc && pc.player) ? pc.player.getPosition().clone() : null;
    }

    if (step.complete && step.complete.type === 'auto') {
        var self = this;
        var hold = step;
        setTimeout(function() {
            if (self._step === hold) self._completeCurrent();
        }, (step.complete.delay || 1) * 1000);
    }

    if (step.complete && step.complete.type === 'cardConfirmed') {
        this.requestCardDraft();
    }
};

TutorialDirector.prototype._grantFullSuper = function() {
    var pc = this.app.playerController;
    if (!pc) return;
    pc.superCharge = pc.maxSuperCharge || 5000;
    if (this.app.inputManager && this.app.inputManager.setSuperReady) {
        this.app.inputManager.setSuperReady(true);
    }
};

TutorialDirector.prototype._getBotCtrl = function() {
    if (this.app.botController) return this.app.botController;
    var gmm = this.app.gameModeManager;
    if (gmm && gmm._getBotCtrl) return gmm._getBotCtrl();
    return null;
};

TutorialDirector.prototype._spawnDummy = function(spawn) {
    var bCtrl = this._getBotCtrl();
    if (!bCtrl || !bCtrl.spawnBotAt) return;
    this._cleanupTutorialDummies();
    var pc = this.app.playerController;
    var px = 0, pz = 0;
    if (pc && pc.player) {
        var p = pc.player.getPosition();
        px = p.x; pz = p.z;
    }
    var dist = spawn.distance || 5;
    // 正常血量顯示 + immortal：可打出傷害數字，但不會死（不再用 hpScale:8 → 12000）
    bCtrl.spawnBotAt('minion_melee', px, pz + dist, {
        hpScale: 1,
        dmgScale: 0.05,
        speedScale: 0.3,
        canSuper: false,
        noBasicAttack: true,
        noRegen: true,
        stationary: true,
        immortal: true,
        tutorialDummy: true,
        affixName: '演武木人'
    });
};

TutorialDirector.prototype._cleanupTutorialDummies = function() {
    var bCtrl = this._getBotCtrl();
    if (!bCtrl || !bCtrl.bots) return;
    for (var i = bCtrl.bots.length - 1; i >= 0; i--) {
        var bot = bCtrl.bots[i];
        if (!bot || !bot._tutorialDummy) continue;
        if (bot.state === 'alive' && bCtrl._beginDeathVanish) {
            bot.health = 0;
            bCtrl._beginDeathVanish(bot, true);
        }
    }
};

TutorialDirector.prototype._countAliveRed = function() {
    var bCtrl = this._getBotCtrl();
    if (!bCtrl || !bCtrl.bots) return 0;
    var n = 0;
    for (var i = 0; i < bCtrl.bots.length; i++) {
        var bot = bCtrl.bots[i];
        if (bot && bot.state === 'alive' && bot.team === 'red' && !bot._tutorialDummy) n++;
    }
    return n;
};

TutorialDirector.prototype._setPhaseAImmortal = function(on) {
    var bCtrl = this._getBotCtrl();
    if (!bCtrl || !bCtrl.bots) return;
    for (var i = 0; i < bCtrl.bots.length; i++) {
        var bot = bCtrl.bots[i];
        if (!bot || bot._tutorialDummy) continue;
        if (bot.team === 'red') bot._tutorialImmortal = !!on;
    }
};

TutorialDirector.prototype._spawnPhaseA = function() {
    var cfg = this._cfg();
    var script = cfg && cfg.waveScript;
    if (!script || !script.enemies) return;
    var bCtrl = this._getBotCtrl();
    var rd = this.app.rogueDirector;
    if (!bCtrl || !rd || !rd._buildScriptPlan) return;

    this._cleanupTutorialDummies();
    bCtrl.cleanupByTeam('red');
    var plan = rd._buildScriptPlan({
        enemies: script.enemies.filter(function(e) { return !e._tutorialPhase; })
    });
    for (var i = 0; i < plan.length; i++) {
        var opts = Object.assign({}, plan[i].opts || {}, { immortal: true });
        bCtrl.spawnBotAt(plan[i].type, plan[i].x, plan[i].z, opts);
    }
    this._setPhaseAImmortal(true);
    rd.waveStatus = 'playing';
    rd._clearCheckTimer = 1.0;
    this._phaseARespawnAt = 0;
};

TutorialDirector.prototype._spawnPhaseB = function() {
    if (this._phaseBSpawned) return;
    this._phaseBSpawned = true;
    var cfg = this._cfg();
    var script = cfg && cfg.waveScript;
    if (!script || !script.enemies) return;
    var bCtrl = this._getBotCtrl();
    var rd = this.app.rogueDirector;
    if (!bCtrl || !rd || !rd._buildScriptPlan) return;

    var plan = rd._buildScriptPlan({
        enemies: script.enemies.filter(function(e) { return e._tutorialPhase === 'after_controls'; })
    });
    for (var i = 0; i < plan.length; i++) {
        bCtrl.spawnBotAt(plan[i].type, plan[i].x, plan[i].z, plan[i].opts);
    }
};

TutorialDirector.prototype._onAttack = function() { this._tickComplete('attackHit'); };
TutorialDirector.prototype._onDash = function() { this._tickComplete('dash'); };
TutorialDirector.prototype._onSuper = function() { this._tickComplete('super'); };
TutorialDirector.prototype._onPerfect = function() { this._tickComplete('perfectDodge'); };
TutorialDirector.prototype._onWaveCleared = function() { this._tickComplete('waveClear'); };
TutorialDirector.prototype._onCardPicked = function() { this._tickComplete('cardConfirmed'); };

TutorialDirector.prototype._tickComplete = function(type) {
    if (!this.active || !this._step || !this._step.complete) return;
    if (this._step.complete.type !== type) return;
    this._progress++;
    var need = this._step.complete.value || 1;
    if (this._progress >= need) this._completeCurrent();
};

TutorialDirector.prototype._completeCurrent = function() {
    if (!this._step) return;
    this._step = null;
    this._removeTip();
    var self = this;
    setTimeout(function() { self._advanceStep(); }, 280);
};

TutorialDirector.prototype.update = function(dt) {
    if (!this.active || !this._step) return;
    var step = this._step;

    // 完美閃避期間：若敵軍全滅（舊存檔／極端傷害），短暫後重生，避免永遠卡關
    if (step.complete && step.complete.type === 'perfectDodge') {
        if (this._countAliveRed() <= 0) {
            this._phaseARespawnAt = (this._phaseARespawnAt || 0) + dt;
            if (this._phaseARespawnAt >= 0.8) {
                this._phaseARespawnAt = 0;
                this._spawnPhaseA();
            }
        } else {
            this._phaseARespawnAt = 0;
            this._setPhaseAImmortal(true);
        }
    }

    if (!(step.complete && step.complete.type === 'moveDistance' && this._moveOrigin)) return;
    var pc = this.app.playerController;
    if (!pc || !pc.player) return;
    var p = pc.player.getPosition();
    var dx = p.x - this._moveOrigin.x;
    var dz = p.z - this._moveOrigin.z;
    if (Math.sqrt(dx * dx + dz * dz) >= (step.complete.value || 2)) this._completeCurrent();
};

TutorialDirector.prototype.onTutorialWaveCleared = function() {
    if (!this.active) return;
    this.app.fire('tutorial:waveCleared');
};

TutorialDirector.prototype.requestCardDraft = function() {
    var rd = this.app.rogueDirector;
    if (!rd || !rd._showCards) return;
    rd._draftMode = 'wave';
    rd.waveStatus = 'choosing';
    rd._showCards();
};

TutorialDirector.prototype._finishTutorial = function(success, opts) {
    opts = opts || {};
    var skipped = !!opts.skipped;
    this.active = false;
    this._removeTip();
    this._removeSkipBtn();
    var cfg = this._cfg();
    var rewards;
    if (skipped) {
        rewards = (cfg && cfg.lobbyGate && cfg.lobbyGate.skipRewards) || { coins: 30, xp: 20 };
    } else {
        rewards = (cfg && cfg.completionRewards) || { coins: 150, xp: 80 };
    }
    var pm = this.app.progressionManager;
    var markDone = !!(success || skipped);
    var isFirstClear = !!(markDone && pm && pm.isTutorialDone && !pm.isTutorialDone());
    var granted = { coins: 0, xp: 0, isFirst: isFirstClear, skipped: skipped };

    if (markDone && pm) {
        if (isFirstClear) {
            if (pm.grantMatchRewards) {
                pm.grantMatchRewards({
                    coins: rewards.coins || 0,
                    xp: rewards.xp || 0,
                    won: true,
                    kills: 0,
                    damage: 0,
                    brawler: (cfg && cfg.heroBrawlerType) || 'guanyu'
                });
            } else {
                if (pm.addCoins && rewards.coins) pm.addCoins(rewards.coins);
                if (pm.addXP && rewards.xp) pm.addXP(rewards.xp);
            }
            granted.coins = rewards.coins || 0;
            granted.xp = rewards.xp || 0;
        }
        if (pm.setTutorialDone) pm.setTutorialDone();
    }

    this.app._forceTutorialRun = false;
    this.app._pendingTutorialRun = false;
    if (this.app.rogueDirector) this.app.rogueDirector.isTutorialRun = false;
    this._showCompleteOverlay(success || skipped, granted);
};

TutorialDirector.prototype._skipTutorial = function() {
    if (!this.active) return;
    this._finishTutorial(true, { skipped: true });
};

TutorialDirector.prototype._showCompleteOverlay = function(success, granted) {
    granted = granted || {};
    var skipped = !!granted.skipped;
    var loc = (window.TutorialConfig && TutorialConfig.loc) ? TutorialConfig.loc : function (v) {
        return (typeof v === 'string') ? v : ((v && v.zh) || '');
    };
    var old = document.getElementById('tutorial-complete-ov');
    if (old) old.remove();
    var ov = document.createElement('div');
    ov.id = 'tutorial-complete-ov';
    ov.className = 'tut-overlay';
    ov.setAttribute('data-ui-interactive', '');

    var continueRogue = success && this.tutorialEntry === 'rogue_inline';
    var title = skipped
        ? loc({ zh: '已略過教學', en: 'Tutorial skipped' })
        : (success ? loc({ zh: '教學完成', en: 'Tutorial complete' }) : loc({ zh: '教學中止', en: 'Tutorial ended' }));
    var body;
    if (!success) {
        body = loc({
            zh: '可從操作說明再次進入軍師演武。',
            en: 'You can re-enter Advisor Drill from How to Play.'
        });
    } else if (granted.isFirst) {
        body = loc({ zh: '獲得', en: 'Rewards' }) + ' 🪙 ' + (granted.coins || 0) + ' · ' +
            loc({ zh: '經驗', en: 'XP' }) + ' ' + (granted.xp || 0) + '。';
        if (skipped) body += loc({ zh: '（略過獎勵）', en: ' (skip rewards)' });
    } else if (skipped) {
        body = loc({ zh: '已標記為熟悉操作。', en: 'Marked as familiar with controls.' });
    } else {
        body = loc({ zh: '演武完成（獎勵僅限首次）。', en: 'Drill complete (rewards for first clear only).' });
    }
    if (continueRogue) {
        body += '<br>' + loc({ zh: '可立即開始正式的群雄集結。', en: 'You can start the official Rogue run now.' });
    }

    var primaryId = continueRogue ? 'tut-btn-continue' : 'tut-btn-home';
    var primaryLabel = continueRogue
        ? loc({ zh: '繼續征戰', en: 'Continue' })
        : loc({ zh: '返回主選單', en: 'Back to menu' });
    var secondaryHtml = continueRogue
        ? '<button class="tut-btn tut-btn-ghost" id="tut-btn-home" style="margin-top:10px;">' + loc({ zh: '返回主選單', en: 'Back to menu' }) + '</button>'
        : '';

    ov.innerHTML =
        '<div class="tut-panel">' +
        '<div class="tut-panel-title">' + title + '</div>' +
        '<div class="tut-panel-body">' + body + '</div>' +
        '<button class="tut-btn" id="' + primaryId + '">' + primaryLabel + '</button>' +
        secondaryHtml +
        '</div>';
    document.body.appendChild(ov);
    this.app.fire('rogue:inputLock', true);
    this.app.timeScale = 0;

    var self = this;
    var bind = function(id, fn) {
        var el = ov.querySelector('#' + id);
        if (!el) return;
        var go = function(e) { if (e) e.preventDefault(); fn(); };
        el.addEventListener('click', go);
        el.addEventListener('touchstart', go, { passive: false });
    };
    bind('tut-btn-continue', function() {
        if (self.app.rogueDirector && self.app.rogueDirector.startOfficialRunAfterTutorial) {
            self.app.rogueDirector.startOfficialRunAfterTutorial();
        } else {
            location.reload();
        }
    });
    bind('tut-btn-home', function() { location.reload(); });
};

TutorialDirector.prototype._injectStyles = function() {
    var old = document.getElementById(this._styleId);
    if (old) return;
    // 清掉舊版 style
    var legacyIds = ['tutorial-style-v1', 'tutorial-style-v2', 'tutorial-style-v3'];
    for (var i = 0; i < legacyIds.length; i++) {
        var legacy = document.getElementById(legacyIds[i]);
        if (legacy) legacy.remove();
    }
    var st = document.createElement('style');
    st.id = this._styleId;
    st.textContent =
        '#tutorial-tip{position:fixed;left:50%;bottom:18%;transform:translateX(-50%);z-index:9200;' +
        'max-width:min(92vw,420px);padding:14px 16px 12px;border-radius:0;box-sizing:border-box;' +
        'clip-path:polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,10px 100%,0 calc(100% - 10px));' +
        'background:rgba(12,10,8,0.88);border:1px solid rgba(220,180,100,0.45);' +
        'color:#f3e6d0;font-family:var(--tk-font-body),system-ui,sans-serif;text-align:center;' +
        'box-shadow:0 8px 28px rgba(0,0,0,0.45);pointer-events:none;}' +
        '#tutorial-tip.tut-tip-top{bottom:auto;top:max(12px,env(safe-area-inset-top,0px));}' +
        '#tutorial-tip .tut-title{font-weight:800;font-size:17px;color:#f0d080;margin-bottom:6px;}' +
        '#tutorial-tip .tut-body{font-size:14px;line-height:1.45;opacity:0.95;}' +
        '#tutorial-tip .tut-btn,#tutorial-tip .tut-dismiss,#tutorial-tip .tut-x{pointer-events:auto;}' +
        '#tutorial-tip .tut-btn{margin-top:10px;padding:8px 18px;border-radius:0;border:0;' +
        'clip-path:polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px));' +
        'background:linear-gradient(180deg,#e8c56a,#c9942e);color:#2a1a08;font-weight:800;cursor:pointer;}' +
        '#tutorial-tip .tut-dismiss{margin-top:10px;padding:7px 14px;border-radius:0;border:1px solid rgba(220,180,100,0.4);' +
        'background:transparent;color:#f0d080;font-size:13px;font-weight:700;cursor:pointer;letter-spacing:1px;}' +
        '#tutorial-tip .tut-x{position:absolute;top:6px;right:8px;width:28px;height:28px;border:0;border-radius:0;' +
        'background:transparent;color:#9a8f7a;font-size:18px;line-height:28px;cursor:pointer;}' +
        '#tutorial-skip-btn{position:fixed;top:max(12px,env(safe-area-inset-top,0px));' +
        'right:max(12px,env(safe-area-inset-right,0px));z-index:9210;pointer-events:auto;' +
        'padding:8px 14px;border-radius:0;border:1px solid rgba(220,180,100,0.45);' +
        'background:rgba(12,10,8,0.82);color:#f0d080;font-size:13px;font-weight:700;' +
        'font-family:var(--tk-font-body),system-ui,sans-serif;cursor:pointer;letter-spacing:1px;' +
        'box-shadow:0 4px 16px rgba(0,0,0,0.35);}' +
        '#tutorial-skip-btn:active{opacity:0.85;}' +
        '.tut-overlay{position:fixed;inset:0;z-index:9500;display:flex;align-items:center;justify-content:center;' +
        'background:rgba(0,0,0,0.62);}' +
        '.tut-panel{background:rgba(16,12,10,0.94);border:1px solid rgba(220,180,100,0.4);border-radius:0;' +
        'clip-path:polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px));' +
        'padding:22px 24px;max-width:90vw;width:360px;text-align:center;color:#f3e6d0;}' +
        '.tut-panel-title{font-size:22px;font-weight:900;color:#f0d080;margin-bottom:10px;}' +
        '.tut-panel-body{font-size:14px;line-height:1.5;margin-bottom:16px;}' +
        '.tut-btn{padding:10px 20px;border-radius:0;border:0;cursor:pointer;' +
        'background:linear-gradient(180deg,#e8c56a,#c9942e);color:#2a1a08;font-weight:800;}' +
        '.tut-btn-ghost{background:transparent;border:1px solid rgba(220,180,100,0.45);color:#f0d080;}';
    document.head.appendChild(st);
};

TutorialDirector.prototype._showSkipBtn = function() {
    this._removeSkipBtn();
    var cfg = this._cfg();
    var loc = (window.TutorialConfig && TutorialConfig.loc) ? TutorialConfig.loc : function (v) {
        return (typeof v === 'string') ? v : ((v && v.zh) || '');
    };
    var label = loc((cfg && cfg.lobbyGate && cfg.lobbyGate.btnSkipShort) || { zh: '略過', en: 'Skip' });
    var aria = loc((cfg && cfg.ui && cfg.ui.skipAria) || { zh: '略過教學', en: 'Skip tutorial' });
    var btn = document.createElement('button');
    btn.id = 'tutorial-skip-btn';
    btn.type = 'button';
    btn.setAttribute('data-ui-interactive', '');
    btn.setAttribute('aria-label', aria);
    btn.textContent = label;
    var self = this;
    var go = function(e) {
        if (e) e.preventDefault();
        self._skipTutorial();
    };
    btn.addEventListener('click', go);
    btn.addEventListener('touchstart', go, { passive: false });
    document.body.appendChild(btn);
    this._skipBtnEl = btn;
};

TutorialDirector.prototype._removeSkipBtn = function() {
    if (this._skipBtnEl && this._skipBtnEl.parentNode) {
        this._skipBtnEl.parentNode.removeChild(this._skipBtnEl);
    }
    this._skipBtnEl = null;
    var el = document.getElementById('tutorial-skip-btn');
    if (el && el.parentNode) el.parentNode.removeChild(el);
};

TutorialDirector.prototype._showTip = function(title, body, withButton, opts) {
    opts = opts || {};
    this._removeTip();
    var el = document.createElement('div');
    el.id = 'tutorial-tip';
    // 不要整塊標 interactive：否則 InputManager 會把提示區觸控當 UI、搖杆無法起步
    if (opts.top) el.classList.add('tut-tip-top');
    el.innerHTML = '<div class="tut-title"></div><div class="tut-body"></div>';
    el.querySelector('.tut-title').textContent = title || '';
    el.querySelector('.tut-body').textContent = body || '';

    var self = this;
    var dismiss = function(e) {
        if (e) e.preventDefault();
        self._removeTip();
    };

    if (opts.dismissible) {
        var x = document.createElement('button');
        x.className = 'tut-x';
        x.type = 'button';
        x.setAttribute('aria-label', '關閉提示');
        x.textContent = '×';
        x.addEventListener('click', dismiss);
        x.addEventListener('touchstart', dismiss, { passive: false });
        el.appendChild(x);

        var dismissBtn = document.createElement('button');
        dismissBtn.className = 'tut-dismiss';
        dismissBtn.type = 'button';
        dismissBtn.textContent = (window.TutorialConfig && TutorialConfig.loc)
            ? TutorialConfig.loc((this._cfg() && this._cfg().ui && this._cfg().ui.gotIt) || { zh: '知道了', en: 'Got it' })
            : '知道了';
        dismissBtn.addEventListener('click', dismiss);
        dismissBtn.addEventListener('touchstart', dismiss, { passive: false });
        el.appendChild(dismissBtn);
    }

    if (withButton) {
        var btn = document.createElement('button');
        btn.className = 'tut-btn';
        var doneLabel = (this._step && this._step.complete && this._step.complete.label);
        btn.textContent = (window.TutorialConfig && TutorialConfig.loc)
            ? TutorialConfig.loc(doneLabel || ((this._cfg() && this._cfg().ui && this._cfg().ui.confirm) || { zh: '確認', en: 'Confirm' }))
            : (doneLabel || '確認');
        var go = function(e) {
            if (e) e.preventDefault();
            self._tickComplete('button');
        };
        btn.addEventListener('click', go);
        btn.addEventListener('touchstart', go, { passive: false });
        el.appendChild(btn);
    }
    document.body.appendChild(el);
    this._tipEl = el;
};

TutorialDirector.prototype._removeTip = function() {
    if (this._tipEl && this._tipEl.parentNode) this._tipEl.parentNode.removeChild(this._tipEl);
    this._tipEl = null;
    var el = document.getElementById('tutorial-tip');
    if (el && el.parentNode) el.parentNode.removeChild(el);
};

window.TutorialDirector = TutorialDirector;

// ── PromoDirector（獨立檔註冊後可移除此段）──
if (typeof PromoDirector === 'undefined') {
var PromoDirector = pc.createScript('promoDirector');

PromoDirector.prototype.initialize = function() {
    this.app.promoDirector = this;
    this.active = false;
    this._elapsed = 0;
    this._beatIndex = -1;
    this._beat = null;
    this._showSubs = true;
    this._showFrame = true;
    this._ended = false;
    this._actionCooldown = 0;
    this._camScratch = {
        x: 0, y: 0, z: 0, aimX: 0, aimY: 1.5, aimZ: 0,
        fov: 40, useGameplayRot: false, pitch: -35
    };
    this._root = null;
    this._bootstrapped = !this.entity || !this.entity.script || !this.entity.script.promoDirector;

    this.app.on('promo:begin', this._onPromoBegin, this);
    this.app.on('game:introStart', this._onIntroStart, this);
    this.app.on('update', this._onAppUpdate, this);

    if (!this._bootstrapped && typeof this.on === 'function') {
        this.on('destroy', this._cleanup, this);
    }

    // URL 自動進拍攝（等 Hub 就緒後由 characterSelect 觸發也可）
    this._urlAuto = false;
    try {
        var q = (window.location.search || '').toLowerCase();
        this._urlAuto = q.indexOf('promo=1') !== -1 || q.indexOf('promo=true') !== -1;
    } catch (e) {}
};

PromoDirector.prototype._cleanup = function() {
    this.app.off('promo:begin', this._onPromoBegin, this);
    this.app.off('game:introStart', this._onIntroStart, this);
    this.app.off('update', this._onAppUpdate, this);
    this._teardownUi();
    if (this.app.promoDirector === this) this.app.promoDirector = null;
};

PromoDirector.prototype._cfg = function() {
    return window.PromoConfig || null;
};

PromoDirector.prototype.wantsUrlAutoStart = function() {
    return !!this._urlAuto;
};

PromoDirector.prototype.isActive = function() {
    return !!this.active;
};

/** characterSelect 呼叫：標記並開局 */
PromoDirector.prototype.requestStartFromHub = function(selection) {
    var cfg = this._cfg() || {};
    this.app._promoCapture = true;
    selection = selection || {};
    selection.isMultiplayer = false;
    selection.mode = cfg.mode || 'FFA';
    selection.brawler = cfg.heroBrawlerType || 'guanyu';
    if (!selection.playerName) selection.playerName = 'Promo';
    return selection;
};

PromoDirector.prototype._onIntroStart = function() {
    if (!this.app._promoCapture) return;
    // 攔截一般開場，改跑宣傳分鏡
    this.app.fire('promo:begin');
};

PromoDirector.prototype._onPromoBegin = function() {
    if (!this.app._promoCapture) return;
    if (this.active) return;

    var cfg = this._cfg() || {};
    this.active = true;
    this._ended = false;
    this._elapsed = 0;
    this._beatIndex = -1;
    this._beat = null;
    this._actionCooldown = 0;
    this._showSubs = cfg.showSubtitles !== false;
    this._showFrame = cfg.showSafeFrame !== false;

    this.app.gameState = 'promo';
    this.app.fire('rogue:inputLock', true);

    // 關掉一般 intro UI
    var gmm = this.app.gameModeManager;
    if (gmm) {
        gmm._introTimer = 0;
        gmm.introStep = -1;
        if (gmm.introDiv) gmm.introDiv.style.display = 'none';
        if (gmm._introFadeEl) gmm._introFadeEl.style.opacity = '0';
    }

    this._hideGameplayHud(true);
    this._injectStyles();
    this._ensureUi();
    this._advanceBeat(0);
    this._pulseBotsIntro();
};

PromoDirector.prototype._onAppUpdate = function(dt) {
    if (!this.active || this._ended) return;
    var cfg = this._cfg() || {};
    var duration = (cfg.duration || 18) + (cfg.brandHold || 0);

    this._elapsed += dt;
    if (this._actionCooldown > 0) this._actionCooldown -= dt;

    // 推進 beat
    var beats = cfg.beats || [];
    var nextIdx = this._beatIndex + 1;
    while (nextIdx < beats.length && this._elapsed >= (beats[nextIdx].t || 0)) {
        this._advanceBeat(nextIdx);
        nextIdx = this._beatIndex + 1;
    }

    this._tickAction();
    this._applyCam(dt);
    this._syncUi();

    if (this._elapsed >= duration) {
        this._finish(false);
    }
};

PromoDirector.prototype._advanceBeat = function(idx) {
    var cfg = this._cfg() || {};
    var beats = cfg.beats || [];
    if (idx < 0 || idx >= beats.length) return;
    this._beatIndex = idx;
    this._beat = beats[idx];
    this._actionCooldown = 0;

    if (this._subtitleEl) {
        var sub = (this._beat && this._beat.subtitle) ? this._beat.subtitle : '';
        this._subtitleEl.textContent = sub;
        this._subtitleEl.style.opacity = (this._showSubs && sub) ? '1' : '0';
        if (this._beat && this._beat.brand) {
            this._subtitleEl.classList.add('promo-sub-brand');
        } else {
            this._subtitleEl.classList.remove('promo-sub-brand');
        }
    }

    if (this._brandEl) {
        var showBrand = !!(this._beat && this._beat.brand);
        this._brandEl.style.opacity = showBrand ? '1' : '0';
        if (showBrand) {
            this._brandTitleEl.textContent = cfg.brandTitle || 'FIGHT KINGDOM';
            this._brandTagEl.textContent = cfg.brandTagline || '';
            this._brandCtaEl.textContent = cfg.cta || '';
        }
    }

    // 非戰鬥段：bot 定身吼；戰鬥段讓 AI 跑
    if (this._beat && this._beat.botsFight) {
        this._releaseBots();
    } else {
        this._pulseBotsIntro();
    }
};

PromoDirector.prototype._pulseBotsIntro = function() {
    var bc = this.app.botController;
    if (bc && bc.triggerIntroRoar) {
        bc.triggerIntroRoar(2.5, 'attack', 'player');
    }
};

PromoDirector.prototype._releaseBots = function() {
    var bc = this.app.botController;
    if (!bc || !bc.bots) return;
    for (var i = 0; i < bc.bots.length; i++) {
        var bot = bc.bots[i];
        if (!bot) continue;
        bot._introTimer = 0;
        bot._introDone = true;
    }
};

PromoDirector.prototype._tickAction = function() {
    if (!this._beat || !this._beat.action || this._beat.action === 'none') return;
    if (this._actionCooldown > 0) return;

    var pcCtrl = this.app.playerController;
    var input = this.app.inputManager;
    if (!pcCtrl || !input) return;

    // 拍攝期間補彈／能量，避免中段放空
    if (pcCtrl.ammo !== undefined && pcCtrl.maxAmmo) pcCtrl.ammo = pcCtrl.maxAmmo;
    if (this._beat.action === 'super' && pcCtrl.maxSuperCharge) {
        pcCtrl.superCharge = pcCtrl.maxSuperCharge;
    }

    var angle = this._aimTowardNearestEnemy();
    if (this._beat.action === 'attack' || this._beat.action === 'dash') {
        input.attackCommand = { mode: 'manual', angle: angle, distance: 1.0, isSuper: false };
        this._actionCooldown = 0.85;
    } else if (this._beat.action === 'super') {
        input.attackCommand = { mode: 'manual', angle: angle, distance: 1.0, isSuper: true };
        this._actionCooldown = 2.2;
    }
};

PromoDirector.prototype._aimTowardNearestEnemy = function() {
    var pcCtrl = this.app.playerController;
    if (!pcCtrl || !pcCtrl.player) return (pcCtrl && pcCtrl._facingAngle !== undefined) ? pcCtrl._facingAngle * Math.PI / 180 : 0;
    var p = pcCtrl.player.getPosition();
    var best = null;
    var bestD = Infinity;
    var bc = this.app.botController;
    if (bc && bc.bots) {
        for (var i = 0; i < bc.bots.length; i++) {
            var b = bc.bots[i];
            if (!b || b.state !== 'alive' || !b.entity) continue;
            var bp = b.entity.getPosition();
            var dx = bp.x - p.x;
            var dz = bp.z - p.z;
            var d = dx * dx + dz * dz;
            if (d < bestD) { bestD = d; best = bp; }
        }
    }
    if (!best) return (pcCtrl._facingAngle || 0) * Math.PI / 180;
    return Math.atan2(best.x - p.x, best.z - p.z);
};

/** 供 cameraFollow 每幀讀取 */
PromoDirector.prototype.getPromoCamera = function(out) {
    out = out || this._camScratch;
    return this._computeCam(this._elapsed, out);
};

PromoDirector.prototype._applyCam = function(dt) {
    var camFollow = this.app.cameraFollow;
    if (!camFollow || !camFollow.entity) return;
    var cam = this._computeCam(this._elapsed, this._camScratch);
    camFollow.entity.setPosition(cam.x, cam.y, cam.z);
    if (cam.useGameplayRot) {
        camFollow.entity.setEulerAngles(cam.pitch, 0, 0);
    } else {
        camFollow.entity.lookAt(cam.aimX, cam.aimY, cam.aimZ);
    }
    if (camFollow.camera) camFollow.camera.fov = cam.fov;
};

PromoDirector.prototype._computeCam = function(elapsed, out) {
    out = out || this._camScratch;
    var camFollow = this.app.cameraFollow;
    var target = camFollow && camFollow.target;
    var pPos = target ? target.getPosition() : new pc.Vec3(0, 0, 0);
    var facingYaw = 0;
    if (camFollow && camFollow._getTargetFacingYaw) {
        facingYaw = camFollow._getTargetFacingYaw() * (Math.PI / 180);
    }
    var faceX = Math.sin(facingYaw);
    var faceZ = Math.cos(facingYaw);
    var mode = (this._beat && this._beat.cam) || 'follow';

    var frontDist = (camFollow && camFollow._introFrontDistance) ? camFollow._introFrontDistance() : 3.2;
    var pullDist = (camFollow && camFollow._introPullDistance) ? camFollow._introPullDistance() : 5.5;
    var frontH = (camFollow && camFollow.introFrontHeight !== undefined) ? camFollow.introFrontHeight : 1.85;
    var pullH = (camFollow && camFollow.introPullHeight !== undefined) ? camFollow.introPullHeight : 2.4;
    var frontFov = (camFollow && camFollow.introFrontFov !== undefined) ? camFollow.introFrontFov : 32;
    var gameplayFov = (camFollow && camFollow._targetFov) ? camFollow._targetFov : 42;
    var gameplayH = (camFollow && camFollow._targetHeight) ? camFollow._targetHeight : 12;
    var gameplayZ = (camFollow && camFollow._targetOffsetZ) ? camFollow._targetOffsetZ : -14;

    out.useGameplayRot = false;
    out.aimX = pPos.x;
    out.aimZ = pPos.z;

    if (mode === 'closeup') {
        var drift = Math.sin(elapsed * 1.1) * 0.06;
        out.x = pPos.x + faceX * frontDist + (-faceZ) * drift;
        out.y = frontH;
        out.z = pPos.z + faceZ * frontDist + faceX * drift;
        out.aimY = 1.75;
        out.fov = frontFov;
    } else if (mode === 'pull') {
        out.x = pPos.x + faceX * pullDist;
        out.y = pullH;
        out.z = pPos.z + faceZ * pullDist;
        out.aimY = 1.45;
        out.fov = pc.math.lerp(frontFov, gameplayFov, 0.35);
    } else if (mode === 'high') {
        out.x = pPos.x;
        out.y = gameplayH * 1.15;
        out.z = pPos.z + gameplayZ * 0.85;
        out.aimY = 1.0;
        out.useGameplayRot = true;
        out.pitch = (camFollow && camFollow._targetLookAngle) ? camFollow._targetLookAngle : -40;
        out.fov = gameplayFov;
    } else if (mode === 'brand') {
        out.x = pPos.x + faceX * (frontDist * 1.15);
        out.y = frontH + 0.15;
        out.z = pPos.z + faceZ * (frontDist * 1.15);
        out.aimY = 1.7;
        out.fov = frontFov + 2;
    } else {
        // follow — 遊戲視角
        out.x = pPos.x;
        out.y = gameplayH;
        out.z = pPos.z + gameplayZ;
        out.aimY = 1.0;
        out.useGameplayRot = true;
        out.pitch = (camFollow && camFollow._targetLookAngle) ? camFollow._targetLookAngle : -35;
        out.fov = gameplayFov;
    }
    return out;
};

PromoDirector.prototype._hideGameplayHud = function(hide) {
    var ids = ['live-score-bar', 'gs-gear', 'mission-bar', 'brawl-intro-text'];
    for (var i = 0; i < ids.length; i++) {
        var el = document.getElementById(ids[i]);
        if (el) el.style.display = hide ? 'none' : '';
    }
    var fui = document.getElementById('floating-ui-container');
    if (fui) fui.style.opacity = hide ? '0' : '1';

    var gs = this.app.gameSettings;
    if (gs && gs._setGearVisible) gs._setGearVisible(!hide);
    else if (gs && gs._gearBtn) gs._gearBtn.style.display = hide ? 'none' : 'flex';

    // 隱藏搖桿視覺
    var im = this.app.inputManager;
    if (im && im.joyGroup) im.joyGroup.enabled = !hide ? im.joyGroup.enabled : false;
};

PromoDirector.prototype._injectStyles = function() {
    if (document.getElementById('promo-capture-style')) return;
    if (window.UiTheme && UiTheme.inject) UiTheme.inject();
    var s = document.createElement('style');
    s.id = 'promo-capture-style';
    s.textContent = [
        '#promo-capture-root{position:fixed;inset:0;z-index:7500;pointer-events:none;font-family:"Noto Serif TC","Microsoft JhengHei",serif;}',
        '#promo-safe-frame{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:min(100vw,56.25vh);height:min(100vh,177.78vw);box-shadow:0 0 0 9999px rgba(0,0,0,0.45);border:1px solid rgba(201,162,90,0.35);pointer-events:none;transition:opacity .2s;}',
        '#promo-subtitle{position:absolute;left:50%;bottom:18%;transform:translateX(-50%);max-width:80%;text-align:center;color:var(--tk-gold-text,#ffe9a8);font-size:clamp(22px,5.5vw,40px);font-weight:900;letter-spacing:0.18em;text-shadow:0 2px 12px rgba(0,0,0,0.85);opacity:0;transition:opacity .25s;}',
        '#promo-subtitle.promo-sub-brand{bottom:28%;font-size:clamp(28px,7vw,52px);letter-spacing:0.28em;}',
        '#promo-brand{position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);text-align:center;opacity:0;transition:opacity .4s;pointer-events:none;}',
        '#promo-brand-title{color:var(--tk-gold,#f5d27a);font-size:clamp(36px,9vw,64px);font-weight:900;letter-spacing:0.35em;text-shadow:0 4px 20px rgba(0,0,0,0.8);}',
        '#promo-brand-tag,#promo-brand-cta{margin-top:10px;color:var(--tk-text-muted,#d8ccb8);font-size:clamp(13px,3.2vw,18px);letter-spacing:0.2em;font-family:"Microsoft JhengHei",sans-serif;}',
        '#promo-controls{position:absolute;right:10px;top:10px;display:flex;flex-direction:column;gap:8px;pointer-events:auto;}',
        '#promo-controls button{pointer-events:auto;min-width:72px;padding:8px 12px;border-radius:8px;border:1px solid rgba(201,162,90,0.55);background:rgba(28,21,14,0.88);color:#ffe9a8;font-size:13px;font-weight:700;cursor:pointer;}',
        '#promo-hint{position:absolute;left:12px;bottom:12px;color:rgba(216,204,184,0.75);font-size:12px;font-family:"Microsoft JhengHei",sans-serif;letter-spacing:0.06em;pointer-events:none;}',
        '#promo-end{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(14,12,9,0.72);pointer-events:auto;}',
        '#promo-end-panel{background:linear-gradient(180deg,#2a2118,#171009);border:1px solid rgba(201,162,90,0.5);border-radius:14px;padding:28px 24px;text-align:center;max-width:320px;width:86%;}',
        '#promo-end-panel h2{margin:0 0 8px;color:#f5d27a;font-size:22px;letter-spacing:0.2em;}',
        '#promo-end-panel p{margin:0 0 18px;color:#d8ccb8;font-size:14px;line-height:1.5;font-family:"Microsoft JhengHei",sans-serif;}',
        '#promo-end-actions{display:flex;flex-direction:column;gap:10px;}',
        '#promo-end-actions button{padding:12px;border-radius:10px;border:none;font-weight:800;cursor:pointer;font-size:15px;}',
        '#promo-btn-replay{background:linear-gradient(180deg,#f5d27a,#c9a25a 55%,#a8823f);color:#241a08;}',
        '#promo-btn-hub{background:transparent;border:1px solid rgba(201,162,90,0.45)!important;color:#ffe9a8;}'
    ].join('');
    document.head.appendChild(s);
};

PromoDirector.prototype._ensureUi = function() {
    if (this._root) return;
    var root = document.createElement('div');
    root.id = 'promo-capture-root';
    root.innerHTML =
        '<div id="promo-safe-frame"></div>' +
        '<div id="promo-subtitle"></div>' +
        '<div id="promo-brand"><div id="promo-brand-title"></div><div id="promo-brand-tag"></div><div id="promo-brand-cta"></div></div>' +
        '<div id="promo-controls">' +
            '<button type="button" id="promo-btn-skip">跳過</button>' +
            '<button type="button" id="promo-btn-subs">字幕</button>' +
            '<button type="button" id="promo-btn-frame">安全框</button>' +
        '</div>' +
        '<div id="promo-hint">直式錄影：對齊金框 · Threads／Reels</div>' +
        '<div id="promo-end"><div id="promo-end-panel">' +
            '<h2>拍攝結束</h2>' +
            '<p>可用系統螢幕錄影重播成片。字幕與安全框可在拍攝時開關。</p>' +
            '<div id="promo-end-actions">' +
                '<button type="button" id="promo-btn-replay">重播</button>' +
                '<button type="button" id="promo-btn-hub">回主選單</button>' +
            '</div>' +
        '</div></div>';
    document.body.appendChild(root);
    this._root = root;
    this._frameEl = document.getElementById('promo-safe-frame');
    this._subtitleEl = document.getElementById('promo-subtitle');
    this._brandEl = document.getElementById('promo-brand');
    this._brandTitleEl = document.getElementById('promo-brand-title');
    this._brandTagEl = document.getElementById('promo-brand-tag');
    this._brandCtaEl = document.getElementById('promo-brand-cta');
    this._endEl = document.getElementById('promo-end');
    this._hintEl = document.getElementById('promo-hint');

    var self = this;
    var bind = function(id, fn) {
        var el = document.getElementById(id);
        if (!el) return;
        if (window.UiTouch && UiTouch.bindTap) {
            UiTouch.bindTap(el, fn);
        } else {
            el.addEventListener('click', fn);
        }
    };
    bind('promo-btn-skip', function() { self._finish(true); });
    bind('promo-btn-subs', function() {
        self._showSubs = !self._showSubs;
        self._syncUi();
    });
    bind('promo-btn-frame', function() {
        self._showFrame = !self._showFrame;
        self._syncUi();
    });
    bind('promo-btn-replay', function() { self._replay(); });
    bind('promo-btn-hub', function() { window.location.reload(); });
};

PromoDirector.prototype._syncUi = function() {
    if (this._frameEl) this._frameEl.style.opacity = this._showFrame ? '1' : '0';
    if (this._hintEl) this._hintEl.style.opacity = this._showFrame ? '1' : '0';
    if (this._subtitleEl) {
        var sub = (this._beat && this._beat.subtitle) ? this._beat.subtitle : '';
        this._subtitleEl.style.opacity = (this._showSubs && sub && !(this._beat && this._beat.brand)) ? '1' : '0';
    }
};

PromoDirector.prototype._teardownUi = function() {
    if (this._root && this._root.parentNode) this._root.parentNode.removeChild(this._root);
    this._root = null;
};

PromoDirector.prototype._finish = function(skipped) {
    if (this._ended) return;
    this._ended = true;
    this.active = false;
    this.app.gameState = 'promo';
    this.app.fire('rogue:inputLock', true);
    this._pulseBotsIntro();
    if (this._endEl) this._endEl.style.display = 'flex';
    if (this._subtitleEl) this._subtitleEl.style.opacity = '0';
};

PromoDirector.prototype._replay = function() {
    // 最穩：帶 promo=1 重載
    try {
        var url = new URL(window.location.href);
        url.searchParams.set('promo', '1');
        window.location.href = url.toString();
    } catch (e) {
        window.location.search = 'promo=1';
    }
};

/** 是否允許 bot AI（戰鬥分鏡） */
PromoDirector.prototype.allowsBotAi = function() {
    return !!(this.active && this._beat && this._beat.botsFight);
};

window.PromoDirector = PromoDirector;
}
