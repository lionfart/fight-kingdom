// ═══════════════════════════════════════════════════════════════
// PromoDirector v2 — 宣傳拍攝（Hook → 玩法 → 爽點 → 賣點 → CTA）
// Hub「宣傳拍攝」或 ?promo=1&variant=A|B|C
// ═══════════════════════════════════════════════════════════════
var PromoDirector = pc.createScript('promoDirector');

PromoDirector.prototype.initialize = function() {
    this.app.promoDirector = this;
    this.active = false;
    this._elapsed = 0;
    this._startWall = 0;
    this._beatIndex = -1;
    this._beat = null;
    this._beats = [];
    this._showSubs = true;
    this._showFrame = true;
    this._ended = false;
    this._actionCooldown = 0;
    this._overlayUntil = 0;
    this._heroSwapList = null;
    this._heroSwapIdx = 0;
    this._heroSwapNext = 0;
    this._slowmoActive = false;
    this._baseTimeScale = 1;
    this._shakePulseAt = -1;
    this._camScratch = {
        x: 0, y: 0, z: 0, aimX: 0, aimY: 1.5, aimZ: 0,
        fov: 40, useGameplayRot: false, pitch: -35
    };
    this._zoomPunch = 0;
    this._actionCycleIdx = 0;
    this._duelBotId = null;
    this._root = null;
    this._bootstrapped = !this.entity || !this.entity.script || !this.entity.script.promoDirector;

    this.app.on('promo:begin', this._onPromoBegin, this);
    this.app.on('game:introStart', this._onIntroStart, this);
    this.app.on('update', this._onAppUpdate, this);

    if (!this._bootstrapped && typeof this.on === 'function') {
        this.on('destroy', this._cleanup, this);
    }

    this._urlAuto = false;
    this._urlVariant = null;
    try {
        var q = (window.location.search || '').toLowerCase();
        this._urlAuto = q.indexOf('promo=1') !== -1 || q.indexOf('promo=true') !== -1;
        var m = /(?:\?|&)variant=([a-c])/.exec(q);
        if (m) this._urlVariant = m[1].toUpperCase();
    } catch (e) {}
};

PromoDirector.prototype._cleanup = function() {
    this.app.off('promo:begin', this._onPromoBegin, this);
    this.app.off('game:introStart', this._onIntroStart, this);
    this.app.off('update', this._onAppUpdate, this);
    this._restoreTimeScale();
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

/** 解析 variant → 最終 beats + hero */
PromoDirector.prototype._resolveRuntime = function() {
    var cfg = this._cfg() || {};
    var key = this._urlVariant || cfg.activeVariant || 'A';
    var variants = cfg.variants || {};
    var v = variants[key] || variants.A || {};
    var beats = (cfg.beats || []).slice();

    if (v.beats_override && v.beats_override.length) {
        var byT = {};
        for (var i = 0; i < beats.length; i++) byT[beats[i].t] = i;
        for (var j = 0; j < v.beats_override.length; j++) {
            var ob = v.beats_override[j];
            var idx = byT[ob.t];
            if (idx !== undefined) {
                beats[idx] = Object.assign({}, beats[idx], ob);
            } else {
                beats.push(ob);
            }
        }
        beats.sort(function(a, b) { return (a.t || 0) - (b.t || 0); });
    }

    // Hook overlay 文案覆寫（若 variant 有 hookOverlay）
    if (v.hookOverlay && beats[0] && beats[0].overlay) {
        beats[0] = Object.assign({}, beats[0], {
            overlay: Object.assign({}, beats[0].overlay, { text: v.hookOverlay })
        });
    }

    return {
        hero: v.heroBrawlerType || cfg.heroBrawlerType || 'lubu',
        beats: beats,
        variant: key
    };
};

PromoDirector.prototype.requestStartFromHub = function(selection) {
    var cfg = this._cfg() || {};
    var rt = this._resolveRuntime();
    this.app._promoCapture = true;
    this.app._promoVariant = rt.variant;
    selection = selection || {};
    selection.isMultiplayer = false;
    selection.mode = cfg.mode || 'FFA';
    selection.brawler = rt.hero;
    if (!selection.playerName) selection.playerName = 'Promo';
    return selection;
};

PromoDirector.prototype._onIntroStart = function() {
    if (!this.app._promoCapture) return;
    this.app.fire('promo:begin');
};

PromoDirector.prototype._onPromoBegin = function() {
    if (!this.app._promoCapture) return;
    if (this.active) return;

    var cfg = this._cfg() || {};
    var rt = this._resolveRuntime();
    this._beats = rt.beats;
    this.active = true;
    this._ended = false;
    this._elapsed = 0;
    this._startWall = Date.now() / 1000;
    this._beatIndex = -1;
    this._beat = null;
    this._actionCooldown = 0;
    this._overlayUntil = 0;
    this._heroSwapList = null;
    this._heroSwapIdx = 0;
    this._heroSwapNext = 0;
    this._shakePulseAt = -1;
    this._zoomPunch = 0;
    this._actionCycleIdx = 0;
    this._duelBotId = null;
    this._showSubs = cfg.showSubtitles !== false;
    this._showFrame = cfg.showSafeFrame !== false;
    this._baseTimeScale = this.app.timeScale || 1;
    this._slowmoActive = false;

    this.app.gameState = 'promo';
    this.app.fire('rogue:inputLock', true);

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
    this._hideExtras();
    this._advanceBeat(0);
    // v2：開局即戰鬥，直接放 bot
    this._releaseBots();
};

PromoDirector.prototype._onAppUpdate = function(dt) {
    if (!this.active || this._ended) return;
    var cfg = this._cfg() || {};
    var duration = (cfg.duration || 16) + (cfg.brandHold || 0);

    // 牆鐘時間軸（不受 slowmo timeScale 拉長整段 promo）
    this._elapsed = (Date.now() / 1000) - this._startWall;

    this._updateSlowmo();
    if (this._actionCooldown > 0) this._actionCooldown -= dt;
    if (this._zoomPunch > 0) this._zoomPunch = Math.max(0, this._zoomPunch - dt * 1.8);

    var beats = this._beats || [];
    var nextIdx = this._beatIndex + 1;
    while (nextIdx < beats.length && this._elapsed >= (beats[nextIdx].t || 0)) {
        this._advanceBeat(nextIdx);
        nextIdx = this._beatIndex + 1;
    }

    this._tickHeroSwap();
    this._tickAction();
    this._applyCam(dt);
    this._syncUi();
    this._syncOverlay();

    if (this._elapsed >= duration) {
        this._finish(false);
    }
};

PromoDirector.prototype._advanceBeat = function(idx) {
    var cfg = this._cfg() || {};
    var beats = this._beats || [];
    if (idx < 0 || idx >= beats.length) return;
    this._beatIndex = idx;
    this._beat = beats[idx];
    this._actionCooldown = 0;
    this._actionCycleIdx = 0;
    this._heroSwapList = null;

    var b = this._beat;

    // 字幕（v2 多半空，改走 overlay）
    if (this._subtitleEl) {
        var sub = b.subtitle || '';
        this._subtitleEl.textContent = sub;
        this._subtitleEl.style.opacity = (this._showSubs && sub) ? '1' : '0';
    }

    // Brand 結尾
    if (this._brandEl) {
        var showBrand = !!b.brand;
        this._brandEl.style.opacity = showBrand ? '1' : '0';
        if (showBrand) {
            var ploc = (window.PromoConfig && PromoConfig.loc) ? PromoConfig.loc : function (v) {
                return (typeof v === 'string') ? v : ((v && v.zh) || '');
            };
            this._brandTitleEl.textContent = ploc(cfg.brandTitle) || 'FIGHT KINGDOM';
            this._brandTagEl.textContent = ploc(cfg.brandTagline) || '';
            this._brandCtaEl.textContent = ploc(cfg.cta) || '';
        }
    }

    // Overlay
    this._showOverlay(b.overlay);

    // Thumb hint
    if (this._thumbEl) {
        this._thumbEl.style.opacity = b.showThumbHint ? '1' : '0';
    }

    // Affix draft 假 UI
    if (this._affixEl) {
        this._affixEl.style.opacity = b.showAffixDraft ? '1' : '0';
        if (b.showAffixDraft) this._pulseAffixPick();
    }

    // 單挑：清場只留一名對手武將（duelAi）
    if (b.duel) {
        this._ensureDuel(b.duel);
    }

    // Hero swap 排程
    if (b.heroSwap && b.heroSwap.length) {
        this._heroSwapList = b.heroSwap.slice();
        this._heroSwapIdx = 0;
        this._heroSwapNext = this._elapsed + (b.heroSwapInterval || 0.65);
        this._swapHero(this._heroSwapList[0]);
    }

    // shakeZoom 開場震一下
    if (b.cam === 'shakeZoom') {
        this.app.fire('camera:shake', 0.55);
        this._zoomPunch = 1;
        this._shakePulseAt = this._elapsed + 0.35;
    }

    if (b.botsFight) this._releaseBots();
    else if (!b.duel) this._pulseBotsIntro();
};

PromoDirector.prototype._showOverlay = function(ov) {
    if (!this._overlayEl) return;
    if (!ov || !ov.text || ov.style === 'none') {
        this._overlayEl.style.opacity = '0';
        this._overlayUntil = 0;
        return;
    }
    this._overlayEl.textContent = (window.PromoConfig && PromoConfig.loc)
        ? PromoConfig.loc(ov.text) : (ov.text || '');
    this._overlayEl.className = 'promo-ov promo-ov-' + (ov.style || 'tag') +
        ' promo-ov-pos-' + (ov.position || 'center');
    this._overlayEl.style.opacity = '1';
    var dur = (ov.duration !== undefined) ? ov.duration : 2;
    this._overlayUntil = this._elapsed + dur;
};

PromoDirector.prototype._syncOverlay = function() {
    if (!this._overlayEl) return;
    if (this._overlayUntil > 0 && this._elapsed >= this._overlayUntil) {
        this._overlayEl.style.opacity = '0';
        this._overlayUntil = 0;
    }
};

PromoDirector.prototype._updateSlowmo = function() {
    var b = this._beat;
    var sm = b && b.slowmo;
    var want = false;
    var factor = 1;
    if (sm && this._elapsed >= sm.start && this._elapsed < sm.end) {
        want = true;
        factor = sm.factor || 0.35;
    }
    if (want && !this._slowmoActive) {
        this._slowmoActive = true;
        this.app.timeScale = factor;
        this.app.fire('camera:shake', 0.45);
    } else if (!want && this._slowmoActive) {
        this._restoreTimeScale();
    }

    // shakeZoom 中段再補一震
    if (this._shakePulseAt > 0 && this._elapsed >= this._shakePulseAt) {
        this.app.fire('camera:shake', 0.35);
        this._shakePulseAt = -1;
    }
};

PromoDirector.prototype._restoreTimeScale = function() {
    this._slowmoActive = false;
    this.app.timeScale = this._baseTimeScale || 1;
};

PromoDirector.prototype._tickHeroSwap = function() {
    if (!this._heroSwapList || this._heroSwapList.length <= 1) return;
    if (this._elapsed < this._heroSwapNext) return;
    this._heroSwapIdx = (this._heroSwapIdx + 1) % this._heroSwapList.length;
    this._swapHero(this._heroSwapList[this._heroSwapIdx]);
    var interval = (this._beat && this._beat.heroSwapInterval) || 0.65;
    this._heroSwapNext = this._elapsed + interval;
};

PromoDirector.prototype._swapHero = function(type) {
    var pcCtrl = this.app.playerController;
    if (!pcCtrl || !type || !pcCtrl._onSelectBrawler) return;
    try {
        pcCtrl._onSelectBrawler(type);
        // 選角會再觸發 intro；宣傳中壓回 promo
        this.app.gameState = 'promo';
        this.app._promoCapture = true;
        var gmm = this.app.gameModeManager;
        if (gmm && gmm.introDiv) gmm.introDiv.style.display = 'none';
    } catch (e) {}
};

PromoDirector.prototype._pulseAffixPick = function() {
    if (!this._affixEl) return;
    var cards = this._affixEl.querySelectorAll('.promo-affix-card');
    for (var i = 0; i < cards.length; i++) cards[i].classList.remove('picked');
    var self = this;
    setTimeout(function() {
        if (!self._affixEl || !self._beat || !self._beat.showAffixDraft) return;
        var c = self._affixEl.querySelector('.promo-affix-card[data-pick="1"]');
        if (c) c.classList.add('picked');
    }, 900);
};

PromoDirector.prototype._pulseBotsIntro = function() {
    var bc = this.app.botController;
    if (bc && bc.triggerIntroRoar) bc.triggerIntroRoar(2.5, 'attack', 'player');
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

/** 清場後只留一名對手武將，對峙距離可調 */
PromoDirector.prototype._ensureDuel = function(duel) {
    duel = duel || {};
    var bc = this.app.botController;
    var pcCtrl = this.app.playerController;
    if (!bc || !pcCtrl || !pcCtrl.player || !bc.spawnBotAt) return;

    var opponent = duel.opponent || 'guanyu';
    var dist = (duel.distance !== undefined) ? duel.distance : 5.5;
    var p = pcCtrl.player.getPosition();
    var facing = (pcCtrl._facingAngle !== undefined) ? pcCtrl._facingAngle * Math.PI / 180 : 0;
    // 對手站在玩家面前
    var ox = p.x + Math.sin(facing) * dist;
    var oz = p.z + Math.cos(facing) * dist;

    // 清掉現有 bot（含上一場 duel）
    if (bc._cleanup) bc._cleanup();
    this._duelBotId = null;

    var bot = bc.spawnBotAt(opponent, ox, oz, {
        duelAi: true,
        smartCombo: true,
        canSuper: !!duel.canSuper,
        immortal: duel.immortal !== false,
        noRegen: false,
        botId: 'promo_duel_' + opponent,
        affixName: '單挑'
    });
    if (bot) {
        this._duelBotId = bot.id;
        bot._introTimer = 0;
        bot._introDone = true;
        // 面向玩家
        bot.aimAngle = Math.atan2(p.x - ox, p.z - oz);
        if (bot.entity) bot.entity.setEulerAngles(0, bot.aimAngle * 180 / Math.PI, 0);
    }

    // 單挑時短暫顯示血條，讓攻防可讀
    var fui = document.getElementById('floating-ui-container');
    if (fui) fui.style.opacity = '1';

    // 補玩家閃避次數，方便連續 dash
    if (pcCtrl.currentDashCharges !== undefined) {
        pcCtrl.currentDashCharges = Math.max(pcCtrl.currentDashCharges || 0, 3);
    }
    // 單挑期間避免主角先倒下
    if (pcCtrl.health !== undefined && pcCtrl.maxHealth) {
        pcCtrl.health = pcCtrl.maxHealth;
    }
};

PromoDirector.prototype._tickAction = function() {
    if (!this._beat) return;
    if (this._actionCooldown > 0) return;

    var act = this._beat.action;
    if (!act || act === 'none') return;

    // cycle：輪播 attack / dash
    if (act === 'cycle') {
        var cycle = this._beat.actionCycle || ['attack', 'dash'];
        if (!cycle.length) return;
        act = cycle[this._actionCycleIdx % cycle.length];
        this._actionCycleIdx++;
    }

    var pcCtrl = this.app.playerController;
    var input = this.app.inputManager;
    if (!pcCtrl || !input) return;

    if (pcCtrl.ammo !== undefined && pcCtrl.maxAmmo) pcCtrl.ammo = pcCtrl.maxAmmo;
    if (pcCtrl.health !== undefined && pcCtrl.maxHealth && pcCtrl.health < pcCtrl.maxHealth * 0.35) {
        pcCtrl.health = pcCtrl.maxHealth;
    }
    if (act === 'super' && pcCtrl.maxSuperCharge) {
        pcCtrl.superCharge = pcCtrl.maxSuperCharge;
    }
    if (pcCtrl.currentDashCharges !== undefined && pcCtrl.currentDashCharges <= 0) {
        pcCtrl.currentDashCharges = 2;
    }

    var angle = this._aimTowardNearestEnemy();
    var interval = this._beat.actionCycleInterval || 0.75;

    if (act === 'dash') {
        // 斜向閃避（不完全背對，比較有戲）
        var dashAngle = angle + (this._actionCycleIdx % 2 === 0 ? 0.9 : -0.9);
        if (pcCtrl._onFlickDodge) pcCtrl._onFlickDodge(dashAngle);
        this._actionCooldown = interval;
        return;
    }

    if (act === 'attack') {
        input.attackCommand = { mode: 'manual', angle: angle, distance: 1.0, isSuper: false };
        this._actionCooldown = interval;
        return;
    }

    if (act === 'super') {
        input.attackCommand = { mode: 'manual', angle: angle, distance: 1.0, isSuper: true };
        this._actionCooldown = 2.4;
        this.app.fire('camera:shake', 0.5);
        this._zoomPunch = Math.max(this._zoomPunch, 0.85);
    }
};

PromoDirector.prototype._aimTowardNearestEnemy = function() {
    var pcCtrl = this.app.playerController;
    if (!pcCtrl || !pcCtrl.player) {
        return (pcCtrl && pcCtrl._facingAngle !== undefined) ? pcCtrl._facingAngle * Math.PI / 180 : 0;
    }
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

PromoDirector.prototype.getPromoCamera = function(out) {
    return this._computeCam(this._elapsed, out || this._camScratch);
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
    } else if (mode === 'low') {
        // 低角度仰拍：鏡頭更低、更近
        out.x = pPos.x + faceX * (frontDist * 0.85);
        out.y = Math.max(0.55, frontH * 0.45);
        out.z = pPos.z + faceZ * (frontDist * 0.85);
        out.aimY = 1.55;
        out.fov = frontFov + 4;
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
    } else if (mode === 'shakeZoom') {
        var punch = this._zoomPunch || 0;
        var zoomDist = pc.math.lerp(pullDist * 0.7, frontDist * 0.55, punch);
        out.x = pPos.x + faceX * zoomDist;
        out.y = pc.math.lerp(pullH, frontH * 0.9, punch);
        out.z = pPos.z + faceZ * zoomDist;
        out.aimY = 1.5;
        out.fov = pc.math.lerp(gameplayFov, frontFov - 4, punch);
    } else if (mode === 'brand') {
        out.x = pPos.x + faceX * (frontDist * 1.15);
        out.y = frontH + 0.15;
        out.z = pPos.z + faceZ * (frontDist * 1.15);
        out.aimY = 1.7;
        out.fov = frontFov + 2;
    } else {
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

    var im = this.app.inputManager;
    if (im && im.joyGroup) im.joyGroup.enabled = false;
};

PromoDirector.prototype._hideExtras = function() {
    if (this._overlayEl) this._overlayEl.style.opacity = '0';
    if (this._thumbEl) this._thumbEl.style.opacity = '0';
    if (this._affixEl) this._affixEl.style.opacity = '0';
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
        '#promo-brand{position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);text-align:center;opacity:0;transition:opacity .4s;pointer-events:none;}',
        '#promo-brand-title{color:var(--tk-gold,#f5d27a);font-size:clamp(36px,9vw,64px);font-weight:900;letter-spacing:0.35em;text-shadow:0 4px 20px rgba(0,0,0,0.8);}',
        '#promo-brand-tag,#promo-brand-cta{margin-top:10px;color:var(--tk-text-muted,#d8ccb8);font-size:clamp(13px,3.2vw,18px);letter-spacing:0.12em;font-family:"Microsoft JhengHei",sans-serif;}',
        '#promo-controls{position:absolute;right:10px;top:10px;display:flex;flex-direction:column;gap:8px;pointer-events:auto;}',
        '#promo-controls button{pointer-events:auto;min-width:72px;padding:8px 12px;border-radius:8px;border:1px solid rgba(201,162,90,0.55);background:rgba(28,21,14,0.88);color:#ffe9a8;font-size:13px;font-weight:700;cursor:pointer;}',
        '#promo-hint{position:absolute;left:12px;bottom:12px;color:rgba(216,204,184,0.75);font-size:12px;font-family:"Microsoft JhengHei",sans-serif;letter-spacing:0.06em;pointer-events:none;}',
        '.promo-ov{position:absolute;left:50%;transform:translateX(-50%);max-width:88%;text-align:center;opacity:0;transition:opacity .2s;pointer-events:none;text-shadow:0 3px 16px rgba(0,0,0,0.9);}',
        '.promo-ov-pos-center{top:42%;}',
        '.promo-ov-pos-top{top:14%;}',
        '.promo-ov-pos-bottom{bottom:16%;top:auto;}',
        '.promo-ov-impact{font-size:clamp(28px,8vw,56px);font-weight:900;color:#fff;letter-spacing:0.12em;}',
        '.promo-ov-tag{font-size:clamp(15px,4vw,22px);font-weight:800;color:#ffe9a8;letter-spacing:0.08em;padding:8px 14px;border:1px solid rgba(201,162,90,0.5);background:rgba(14,12,9,0.55);border-radius:8px;font-family:"Microsoft JhengHei",sans-serif;}',
        '.promo-ov-highlight{font-size:clamp(18px,4.8vw,28px);font-weight:900;color:#241a08;letter-spacing:0.08em;padding:10px 18px;border-radius:10px;background:linear-gradient(180deg,#f5d27a,#c9a25a);font-family:"Microsoft JhengHei",sans-serif;}',
        '#promo-thumb{position:absolute;left:10%;bottom:14%;width:72px;height:72px;border-radius:50%;border:2px solid rgba(245,210,122,0.7);opacity:0;transition:opacity .25s;pointer-events:none;}',
        '#promo-thumb::after{content:"";position:absolute;left:50%;top:50%;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(245,210,122,0.85);animation:promoThumb 1.1s ease-in-out infinite;}',
        '@keyframes promoThumb{0%,100%{transform:translate(0,0) scale(1);}50%{transform:translate(10px,-14px) scale(0.85);}}',
        '#promo-affix{position:absolute;left:50%;top:52%;transform:translate(-50%,-50%);display:flex;gap:10px;opacity:0;transition:opacity .3s;pointer-events:none;}',
        '.promo-affix-card{width:88px;padding:12px 8px;border-radius:10px;background:linear-gradient(180deg,#2a2118,#171009);border:1px solid rgba(201,162,90,0.45);color:#ffe9a8;text-align:center;font-family:"Microsoft JhengHei",sans-serif;font-size:13px;font-weight:700;transition:transform .35s,border-color .35s,box-shadow .35s;}',
        '.promo-affix-card small{display:block;margin-top:6px;color:#9a8f7a;font-size:11px;font-weight:500;}',
        '.promo-affix-card.picked{transform:translateY(-12px) scale(1.08);border-color:#f5d27a;box-shadow:0 8px 24px rgba(201,162,90,0.35);}',
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
        '<div id="promo-ov" class="promo-ov"></div>' +
        '<div id="promo-thumb"></div>' +
        '<div id="promo-affix">' +
            '<div class="promo-affix-card">雷暈<small>觸電暈眩</small></div>' +
            '<div class="promo-affix-card" data-pick="1">狂斬<small>近戰暴擊</small></div>' +
            '<div class="promo-affix-card">吸血<small>擊殺回血</small></div>' +
        '</div>' +
        '<div id="promo-brand"><div id="promo-brand-title"></div><div id="promo-brand-tag"></div><div id="promo-brand-cta"></div></div>' +
        '<div id="promo-controls">' +
            '<button type="button" id="promo-btn-skip">跳過</button>' +
            '<button type="button" id="promo-btn-subs">字幕</button>' +
            '<button type="button" id="promo-btn-frame">安全框</button>' +
        '</div>' +
        '<div id="promo-hint">直式錄影：對齊金框 · Threads／Reels</div>' +
        '<div id="promo-end"><div id="promo-end-panel">' +
            '<h2>拍攝結束</h2>' +
            '<p>用系統螢幕錄影。可關字幕／安全框再錄一版乾淨成片。<br>變體：?promo=1&amp;variant=B</p>' +
            '<div id="promo-end-actions">' +
                '<button type="button" id="promo-btn-replay">重播</button>' +
                '<button type="button" id="promo-btn-hub">回主選單</button>' +
            '</div>' +
        '</div></div>';
    document.body.appendChild(root);
    this._root = root;
    this._frameEl = document.getElementById('promo-safe-frame');
    this._subtitleEl = document.getElementById('promo-subtitle');
    this._overlayEl = document.getElementById('promo-ov');
    this._thumbEl = document.getElementById('promo-thumb');
    this._affixEl = document.getElementById('promo-affix');
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
        if (window.UiTouch && UiTouch.bindTap) UiTouch.bindTap(el, fn);
        else el.addEventListener('click', fn);
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
        this._subtitleEl.style.opacity = (this._showSubs && sub) ? '1' : '0';
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
    this._restoreTimeScale();
    this.app.gameState = 'promo';
    this.app.fire('rogue:inputLock', true);
    this._pulseBotsIntro();
    this._hideExtras();
    if (this._overlayEl) this._overlayEl.style.opacity = '0';
    if (this._endEl) this._endEl.style.display = 'flex';
    if (this._subtitleEl) this._subtitleEl.style.opacity = '0';
};

PromoDirector.prototype._replay = function() {
    try {
        var url = new URL(window.location.href);
        url.searchParams.set('promo', '1');
        var v = this.app._promoVariant || (this._cfg() && this._cfg().activeVariant) || 'A';
        url.searchParams.set('variant', v);
        window.location.href = url.toString();
    } catch (e) {
        window.location.search = 'promo=1';
    }
};

PromoDirector.prototype.allowsBotAi = function() {
    return !!(this.active && this._beat && this._beat.botsFight);
};

if (typeof window !== 'undefined') window.PromoDirector = PromoDirector;
