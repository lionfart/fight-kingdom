// =============================================================================
// AnalyticsManager — GameAnalytics bridge (opt-in consent, CDN SDK)
// Listens to existing app.fire events; no combat-loop instrumentation.
//
// Setup (Editor):
// 1. Create / sync this script asset (preload).
// 2. Add script `analyticsManager` on the same root entity as authManager.
// 3. Paste Game Key + Secret Key from https://gameanalytics.com (HTML5 game).
// 4. Players opt in via Settings → Share play data (default off).
// =============================================================================

var AnalyticsManager = pc.createScript('analyticsManager');

AnalyticsManager.SDK_URL = 'https://cdn.jsdelivr.net/npm/gameanalytics@5/dist/GameAnalytics.min.js';
AnalyticsManager.SCRIPT_ID = 'gameanalytics-sdk-script';
AnalyticsManager.CONSENT_KEY = 'tk_analytics_consent';
AnalyticsManager.PASS_AMOUNT_CENTS = 699;
AnalyticsManager.PASS_SKU = 'character_pass';

AnalyticsManager.attributes.add('gameKey', {
    type: 'string',
    default: '',
    title: 'GameAnalytics Game Key'
});

AnalyticsManager.attributes.add('secretKey', {
    type: 'string',
    default: '',
    title: 'GameAnalytics Secret Key'
});

AnalyticsManager.attributes.add('buildVersion', {
    type: 'string',
    default: '0.1.0',
    title: 'Build Version'
});

AnalyticsManager.attributes.add('enabled', {
    type: 'boolean',
    default: false,
    title: 'Enabled (Fight Kingdom: devre dışı — kendi GameAnalytics hesabı olmadan açmayın)'
});

AnalyticsManager.prototype.initialize = function () {
    this.app.analyticsManager = this;

    this._sdkReady = false;
    this._initializing = false;
    this._queue = [];
    this._matchCtx = null;
    this._consent = this._readConsent();

    this._bindGameEvents();

    if (this.enabled && this._consent) {
        this._ensureSdkAndInit();
    } else if (!this.enabled) {
        console.log('[Analytics] Disabled — GameAnalytics devre dışı (Fight Kingdom)');
    }
};

AnalyticsManager.prototype.destroy = function () {
    this._unbindGameEvents();
    if (this.app.analyticsManager === this) {
        this.app.analyticsManager = null;
    }
};

// ── Consent ─────────────────────────────────────────────────────────────────

AnalyticsManager.prototype.hasConsent = function () {
    return !!this._consent;
};

AnalyticsManager.prototype.setConsent = function (allowed) {
    var next = !!allowed;
    if (next === this._consent) {
        this._writeConsent(next);
        this._syncSubmissionFlag();
        return;
    }
    this._consent = next;
    this._writeConsent(next);

    if (next) {
        this._ensureSdkAndInit();
    } else {
        this._syncSubmissionFlag();
        this._queue.length = 0;
        console.log('[Analytics] Consent off — event submission stopped');
    }
};

/** Browser console: app.analyticsManager.getDebugStatus() */
AnalyticsManager.prototype.getDebugStatus = function () {
    return {
        enabled: !!this.enabled,
        consent: !!this._consent,
        hasKeys: !!(this.gameKey && this.secretKey),
        gameKeyLen: this.gameKey ? String(this.gameKey).length : 0,
        sdkReady: !!this._sdkReady,
        initializing: !!this._initializing,
        queueLen: this._queue ? this._queue.length : 0,
        gaGlobal: !!this._getGA(),
        userId: this._resolveUserId()
    };
};

AnalyticsManager.prototype._readConsent = function () {
    try {
        return localStorage.getItem(AnalyticsManager.CONSENT_KEY) === '1';
    } catch (e) {
        return false;
    }
};
AnalyticsManager.prototype._writeConsent = function (allowed) {
    try {
        localStorage.setItem(AnalyticsManager.CONSENT_KEY, allowed ? '1' : '0');
    } catch (e) {}
};

// ── Public track helpers ─────────────────────────────────────────────────────

AnalyticsManager.prototype.isReady = function () {
    return !!(this._sdkReady && this.enabled && this._consent);
};

AnalyticsManager.prototype.trackDesign = function (eventId, value) {
    this._enqueueOrRun(function (GA) {
        if (value == null || value === undefined || isNaN(Number(value))) {
            GA.addDesignEvent(eventId);
        } else {
            GA.addDesignEvent(eventId, Number(value));
        }
    });
};

AnalyticsManager.prototype.trackProgression = function (status, p01, p02, p03, score) {
    this._enqueueOrRun(function (GA) {
        var Status = AnalyticsManager._progressionStatus(GA);
        var st = Status[status] != null ? Status[status] : status;
        if (score == null || score === undefined || isNaN(Number(score))) {
            GA.addProgressionEvent(st, p01 || '', p02 || '', p03 || '');
        } else {
            GA.addProgressionEvent(st, p01 || '', p02 || '', p03 || '', Number(score));
        }
    });
};

AnalyticsManager.prototype.trackBusiness = function (currency, amountCents, itemType, itemId, cartType) {
    this._enqueueOrRun(function (GA) {
        GA.addBusinessEvent(
            currency || 'USD',
            amountCents | 0,
            itemType || 'IAP',
            itemId || AnalyticsManager.PASS_SKU,
            cartType || 'Stripe'
        );
    });
};

AnalyticsManager.prototype.trackResource = function (flow, currency, amount, itemType, itemId) {
    this._enqueueOrRun(function (GA) {
        var Flow = AnalyticsManager._resourceFlow(GA);
        var ft = Flow[flow] != null ? Flow[flow] : flow;
        GA.addResourceEvent(ft, currency, Number(amount) || 0, itemType, itemId);
    });
};

// ── SDK load / init ──────────────────────────────────────────────────────────

AnalyticsManager.prototype._getGA = function () {
    if (typeof window === 'undefined') return null;
    if (window.gameanalytics && window.gameanalytics.GameAnalytics) {
        return window.gameanalytics.GameAnalytics;
    }
    if (window.GameAnalytics && typeof window.GameAnalytics.initialize === 'function') {
        return window.GameAnalytics;
    }
    return null;
};

AnalyticsManager.prototype._ensureSdkAndInit = function () {
    if (!this.enabled || !this._consent) return;
    if (!this.gameKey || !this.secretKey) {
        console.warn('[Analytics] Missing Game Key / Secret Key — set on analyticsManager attributes');
        return;
    }
    if (this._sdkReady || this._initializing) return;

    var self = this;
    this._initializing = true;
    this._ensureSdk(function (err) {
        self._initializing = false;
        if (err) {
            console.warn('[Analytics] SDK load failed', err.message || err);
            return;
        }
        self._initSdk();
    });
};

AnalyticsManager.prototype._ensureSdk = function (cb) {
    if (this._getGA()) {
        cb(null);
        return;
    }
    if (typeof document === 'undefined') {
        cb(new Error('document unavailable'));
        return;
    }

    var existing = document.getElementById(AnalyticsManager.SCRIPT_ID);
    if (existing) {
        this._waitForSdk(cb);
        return;
    }

    var self = this;
    var script = document.createElement('script');
    script.id = AnalyticsManager.SCRIPT_ID;
    script.src = AnalyticsManager.SDK_URL;
    script.async = true;
    script.onload = function () { self._waitForSdk(cb); };
    script.onerror = function () { cb(new Error('GameAnalytics script failed')); };
    document.head.appendChild(script);
};

AnalyticsManager.prototype._waitForSdk = function (cb) {
    var self = this;
    var tries = 0;
    var tick = function () {
        if (self._getGA()) {
            cb(null);
            return;
        }
        tries += 1;
        if (tries > 50) {
            cb(new Error('GameAnalytics global missing'));
            return;
        }
        setTimeout(tick, 50);
    };
    tick();
};

AnalyticsManager.prototype._initSdk = function () {
    var GA = this._getGA();
    if (!GA || this._sdkReady) return;

    try {
        // Info log helps verify first integration in Editor Launch console
        if (typeof GA.setEnabledInfoLog === 'function') {
            GA.setEnabledInfoLog(true);
        }
        GA.configureBuild(this.buildVersion || '0.1.0');
        GA.configureGameEngineVersion('playcanvas 2.x');
        GA.configureSdkGameEngineVersion('fightkingdom 0.1');
        if (typeof GA.configureAvailableResourceCurrencies === 'function') {
            GA.configureAvailableResourceCurrencies(['Coins', 'XP']);
        }
        if (typeof GA.configureAvailableResourceItemTypes === 'function') {
            GA.configureAvailableResourceItemTypes(['Reward', 'Character', 'Skin', 'Level']);
        }

        var uid = this._resolveUserId();
        if (uid) GA.configureUserId(uid);

        GA.initialize(this.gameKey, this.secretKey);
        this._sdkReady = true;
        this._syncSubmissionFlag();
        this._flushQueue();
        console.log('[Analytics] GameAnalytics ready', this.getDebugStatus());
    } catch (e) {
        console.warn('[Analytics] initialize failed', e);
    }
};

AnalyticsManager.prototype._syncSubmissionFlag = function () {
    var GA = this._getGA();
    if (!GA || typeof GA.setEnabledEventSubmission !== 'function') return;
    GA.setEnabledEventSubmission(!!(this.enabled && this._consent && this._sdkReady));
};

AnalyticsManager.prototype._resolveUserId = function () {
    var auth = this.app.authManager;
    if (auth && typeof auth.getUserId === 'function') {
        var id = auth.getUserId();
        if (id) return String(id);
    }
    return null;
};

AnalyticsManager.prototype._enqueueOrRun = function (fn) {
    if (!this.enabled || !this._consent) return;
    if (!this._sdkReady) {
        if (!this.gameKey || !this.secretKey) return;
        this._queue.push(fn);
        this._ensureSdkAndInit();
        return;
    }
    var GA = this._getGA();
    if (!GA) return;
    try {
        fn(GA);
    } catch (e) {
        console.warn('[Analytics] event failed', e);
    }
};

AnalyticsManager.prototype._flushQueue = function () {
    var GA = this._getGA();
    if (!GA || !this._sdkReady) return;
    var q = this._queue.splice(0, this._queue.length);
    for (var i = 0; i < q.length; i++) {
        try {
            q[i](GA);
        } catch (e) {
            console.warn('[Analytics] queued event failed', e);
        }
    }
};

AnalyticsManager._progressionStatus = function (GA) {
    if (window.gameanalytics && window.gameanalytics.EGAProgressionStatus) {
        return window.gameanalytics.EGAProgressionStatus;
    }
    return { Start: 1, Complete: 2, Fail: 3 };
};

AnalyticsManager._resourceFlow = function (GA) {
    if (window.gameanalytics && window.gameanalytics.EGAResourceFlowType) {
        return window.gameanalytics.EGAResourceFlowType;
    }
    return { Source: 1, Sink: 2 };
};

AnalyticsManager._sanitizePart = function (value, fallback) {
    var s = String(value == null ? '' : value);
    s = s.replace(/[^A-Za-z0-9_\-]/g, '');
    if (!s) s = fallback || 'Unknown';
    if (s.length > 32) s = s.substring(0, 32);
    return s;
};

// ── Event bindings ───────────────────────────────────────────────────────────

AnalyticsManager.prototype._bindGameEvents = function () {
    var app = this.app;
    app.on('game:start', this._onGameStart, this);
    app.on('progression:matchRewards', this._onMatchRewards, this);
    app.on('progression:levelUp', this._onLevelUp, this);
    app.on('progression:characterUnlocked', this._onCharacterUnlocked, this);
    app.on('progression:skinUnlocked', this._onSkinUnlocked, this);
    app.on('progression:rogueCleared', this._onRogueCleared, this);
    app.on('rogue:begin', this._onRogueBegin, this);
    app.on('entitlement:purchaseSuccess', this._onPurchaseSuccess, this);
    app.on('entitlement:purchaseCancelled', this._onPurchaseCancelled, this);
    app.on('auth:ready', this._onAuthReady, this);
    app.on('auth:signedOut', this._onSignedOut, this);
    app.on('tutorial:attack', this._onTutorialAttack, this);
    app.on('tutorial:dash', this._onTutorialDash, this);
    app.on('tutorial:super', this._onTutorialSuper, this);
    app.on('tutorial:perfectDodge', this._onTutorialPerfect, this);
    app.on('tutorial:waveCleared', this._onTutorialWave, this);
    app.on('tutorial:cardPicked', this._onTutorialCard, this);
};

AnalyticsManager.prototype._unbindGameEvents = function () {
    var app = this.app;
    app.off('game:start', this._onGameStart, this);
    app.off('progression:matchRewards', this._onMatchRewards, this);
    app.off('progression:levelUp', this._onLevelUp, this);
    app.off('progression:characterUnlocked', this._onCharacterUnlocked, this);
    app.off('progression:skinUnlocked', this._onSkinUnlocked, this);
    app.off('progression:rogueCleared', this._onRogueCleared, this);
    app.off('rogue:begin', this._onRogueBegin, this);
    app.off('entitlement:purchaseSuccess', this._onPurchaseSuccess, this);
    app.off('entitlement:purchaseCancelled', this._onPurchaseCancelled, this);
    app.off('auth:ready', this._onAuthReady, this);
    app.off('auth:signedOut', this._onSignedOut, this);
    app.off('tutorial:attack', this._onTutorialAttack, this);
    app.off('tutorial:dash', this._onTutorialDash, this);
    app.off('tutorial:super', this._onTutorialSuper, this);
    app.off('tutorial:perfectDodge', this._onTutorialPerfect, this);
    app.off('tutorial:waveCleared', this._onTutorialWave, this);
    app.off('tutorial:cardPicked', this._onTutorialCard, this);
};

AnalyticsManager.prototype._currentMode = function () {
    var gmm = this.app.gameModeManager;
    if (gmm && gmm.currentMode) return gmm.currentMode;
    if (this._matchCtx && this._matchCtx.mode) return this._matchCtx.mode;
    return 'Unknown';
};

AnalyticsManager.prototype._onGameStart = function (selection) {
    var mode = AnalyticsManager._sanitizePart(
        (selection && selection.mode) || this._currentMode(),
        'Unknown'
    );
    var brawler = AnalyticsManager._sanitizePart(
        selection && (selection.brawler || selection.brawlerType),
        'Unknown'
    );
    this._matchCtx = {
        mode: mode,
        brawler: brawler,
        isMultiplayer: !!(selection && selection.isMultiplayer)
    };

    this.trackDesign('Match:Start:' + mode + ':' + brawler);
    this.trackProgression('Start', 'Match', mode, brawler);
};

AnalyticsManager.prototype._onMatchRewards = function (payload) {
    var mode = AnalyticsManager._sanitizePart(this._currentMode(), 'Unknown');
    var brawler = AnalyticsManager._sanitizePart(
        (payload && payload.brawler) || (this._matchCtx && this._matchCtx.brawler),
        'Unknown'
    );
    var won = !!(payload && payload.won);
    var outcome = won ? 'Won' : 'Lost';
    var coins = (payload && payload.coins) || 0;
    var kills = (payload && payload.kills) || 0;

    this.trackDesign('Match:End:' + mode + ':' + outcome, coins);
    this.trackProgression(won ? 'Complete' : 'Fail', 'Match', mode, brawler, kills);

    if (coins > 0) {
        this.trackResource('Source', 'Coins', coins, 'Reward', 'MatchEnd');
    }
    if (payload && payload.xp > 0) {
        this.trackResource('Source', 'XP', payload.xp, 'Reward', 'MatchEnd');
    }

    this._matchCtx = null;
};

AnalyticsManager.prototype._onLevelUp = function (payload) {
    var level = payload && payload.newLevel != null ? payload.newLevel : 0;
    this.trackDesign('Progression:LevelUp', level);
    this.trackProgression('Complete', 'AccountLevel', String(level), '');
};

AnalyticsManager.prototype._onCharacterUnlocked = function (brawlerType) {
    var id = AnalyticsManager._sanitizePart(brawlerType, 'Unknown');
    this.trackDesign('Unlock:Character:' + id);
};

AnalyticsManager.prototype._onSkinUnlocked = function (skinKey) {
    var id = AnalyticsManager._sanitizePart(skinKey, 'Unknown');
    this.trackDesign('Unlock:Skin:' + id);
};

AnalyticsManager.prototype._onRogueBegin = function () {
    this.trackDesign('Rogue:Begin');
    this.trackProgression('Start', 'Rogue', 'Run', '');
};

AnalyticsManager.prototype._onRogueCleared = function () {
    this.trackDesign('Rogue:Cleared');
    this.trackProgression('Complete', 'Rogue', 'Run', '');
};

AnalyticsManager.prototype._onPurchaseSuccess = function () {
    this.trackBusiness('USD', AnalyticsManager.PASS_AMOUNT_CENTS, 'IAP', AnalyticsManager.PASS_SKU, 'Stripe');
    this.trackDesign('IAP:Success:' + AnalyticsManager.PASS_SKU);
};

AnalyticsManager.prototype._onPurchaseCancelled = function () {
    this.trackDesign('IAP:Cancel:' + AnalyticsManager.PASS_SKU);
};

AnalyticsManager.prototype._onAuthReady = function (info) {
    var uid = (info && info.userId) || this._resolveUserId();
    if (uid && this._sdkReady) {
        var GA = this._getGA();
        if (GA && typeof GA.setExtUserId === 'function') {
            try { GA.setExtUserId(String(uid)); } catch (e) {}
        }
    }
    var kind = info && info.isAnonymous === false ? 'Linked' : 'Guest';
    this.trackDesign('Auth:Ready:' + kind);
};

AnalyticsManager.prototype._onSignedOut = function () {
    this.trackDesign('Auth:SignedOut');
};

AnalyticsManager.prototype._onTutorialAttack = function () { this.trackDesign('Tutorial:Attack'); };
AnalyticsManager.prototype._onTutorialDash = function () { this.trackDesign('Tutorial:Dash'); };
AnalyticsManager.prototype._onTutorialSuper = function () { this.trackDesign('Tutorial:Super'); };
AnalyticsManager.prototype._onTutorialPerfect = function () { this.trackDesign('Tutorial:PerfectDodge'); };
AnalyticsManager.prototype._onTutorialWave = function () { this.trackDesign('Tutorial:WaveCleared'); };
AnalyticsManager.prototype._onTutorialCard = function () { this.trackDesign('Tutorial:CardPicked'); };
