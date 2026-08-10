var GameSettings = pc.createScript('gameSettings');

// 遊戲內設定選單（齒輪）。三國令牌風。
// - 全模式：相機視角切換、音樂開關、Back to Menu
// - 單人(PVE/單機)額外：暫停/繼續
// 多人模式不顯示暫停（server 仍在跑，暫停無意義）。
// Phase A：語言切換（預設 zh-TW；字串來自 localeZhTw.js / localeEn.js）

GameSettings.QUALITY_STORAGE_KEY = 'tk_graphics_quality';
// low／mid 同解析度；low 靠關平行光影子省 GPU（勿再降 0.75——iOS 上採樣易假 lag）
GameSettings.QUALITY_LEVELS = { low: 1.0, mid: 1.0, high: 1.5 };
GameSettings.QUALITY_ORDER = ['low', 'mid', 'high'];

GameSettings.AIM_MODE_STORAGE_KEY = 'tk_aim_mode';
GameSettings.AIM_MODE_ORDER = ['simple', 'manual'];
GameSettings.AIM_MODE_DEFAULT = 'simple';

GameSettings.resolveAimMode = function () {
    var saved = null;
    try { saved = localStorage.getItem(GameSettings.AIM_MODE_STORAGE_KEY); } catch (e) {}
    if (saved === 'manual' || saved === 'simple') return saved;
    return GameSettings.AIM_MODE_DEFAULT;
};

GameSettings.aimModeLabel = function (id) {
    return GameSettings.t('settings.aimMode.' + id) || id;
};

GameSettings.isManualAimMode = function () {
    return GameSettings.resolveAimMode() === 'manual';
};

/**
 * Ensure TKI18n exists (stub if i18n.js missing).
 * String packs live in localeZhTw.js / localeEn.js / localeTr.js — do not duplicate here.
 */
GameSettings._ensureI18n = function () {
    if (window.TKI18n) return;
    var STORAGE_KEY = 'tk_lang';
    var DEFAULT = 'en';
    var packs = Object.create(null);
    var lang = DEFAULT;

    function inferInitialLang() {
        var navLang = '';
        try {
            if (navigator && navigator.languages && navigator.languages.length && navigator.languages[0]) {
                navLang = navigator.languages[0];
            } else {
                navLang = (navigator && (navigator.language || navigator.userLanguage || navigator.browserLanguage)) || '';
            }
        } catch (e) {}
        navLang = String(navLang || '').toLowerCase();
        if (navLang.indexOf('zh') === 0 || navLang.indexOf('zh-') !== -1 || navLang.indexOf('zh_') !== -1) return 'zh-TW';
        if (navLang.indexOf('tr') === 0 || navLang.indexOf('tr-') !== -1 || navLang.indexOf('tr_') !== -1) return 'tr';
        return 'en';
    }

    try {
        var saved = localStorage.getItem(STORAGE_KEY);
        if (saved === 'en') lang = 'en';
        else if (saved === 'zh-TW' || saved === 'zh') lang = 'zh-TW';
        else if (saved === 'tr' || saved === 'tr-TR') lang = 'tr';
        else if (!saved) {
            lang = inferInitialLang();
            try { localStorage.setItem(STORAGE_KEY, lang); } catch (e2) {}
        }
    } catch (e) {}
    window.TKI18n = {
        STORAGE_KEY: STORAGE_KEY,
        DEFAULT: DEFAULT,
        SUPPORTED: ['zh-TW', 'en', 'tr'],
        register: function (locale, dict) {
            if (!locale || !dict) return;
            var prev = packs[locale];
            if (!prev) { packs[locale] = dict; return; }
            for (var k in dict) {
                if (Object.prototype.hasOwnProperty.call(dict, k)) prev[k] = dict[k];
            }
        },
        getLang: function () { return lang; },
        setLang: function (next) {
            if (next !== 'zh-TW' && next !== 'en' && next !== 'tr') return lang;
            var changed = next !== lang;
            lang = next;
            try { localStorage.setItem(STORAGE_KEY, lang); } catch (e1) {}
            if (changed) {
                try { window.dispatchEvent(new CustomEvent('tk:langChanged', { detail: { lang: lang } })); } catch (e2) {}
            }
            return lang;
        },
        t: function (key, vars) {
            if (!key) return '';
            var pack = packs[lang] || {};
            var text = Object.prototype.hasOwnProperty.call(pack, key) ? pack[key] : null;
            if (text == null && lang !== DEFAULT) {
                pack = packs[DEFAULT] || {};
                text = Object.prototype.hasOwnProperty.call(pack, key) ? pack[key] : null;
            }
            if (text == null) text = key;
            if (!vars) return text;
            return String(text).replace(/\{(\w+)\}/g, function (_, k) {
                return vars[k] != null ? String(vars[k]) : '{' + k + '}';
            });
        },
        isEn: function () { return lang === 'en' || lang === 'tr'; }
    };
    // Late-bind locale packs if they ran before this stub
    if (window.__TK_LOCALE_ZH_TW__) {
        window.TKI18n.register('zh-TW', window.__TK_LOCALE_ZH_TW__);
        try { delete window.__TK_LOCALE_ZH_TW__; } catch (e3) { window.__TK_LOCALE_ZH_TW__ = null; }
    }
    if (window.__TK_LOCALE_EN__) {
        window.TKI18n.register('en', window.__TK_LOCALE_EN__);
        try { delete window.__TK_LOCALE_EN__; } catch (e4) { window.__TK_LOCALE_EN__ = null; }
    }
    if (window.__TK_LOCALE_TR__) {
        window.TKI18n.register('tr', window.__TK_LOCALE_TR__);
        try { delete window.__TK_LOCALE_TR__; } catch (e5) { window.__TK_LOCALE_TR__ = null; }
    }
};

GameSettings.t = function (key, vars) {
    GameSettings._ensureI18n();
    if (window.TKI18n && typeof window.TKI18n.t === 'function') {
        return window.TKI18n.t(key, vars);
    }
    return key;
};

GameSettings.qualityLabel = function (id) {
    return GameSettings.t('settings.quality.' + id) || id;
};

/** Kept for any external readers; mirrors zh defaults */
GameSettings.QUALITY_LABELS = { low: '低', mid: '中', high: '高' };

/** iOS／iPadOS only — used to skip heavy startup GPU work (e.g. shader prewarm). */
GameSettings.isMemoryConstrained = function () {
    if (window.UiTouch && typeof window.UiTouch.isIOS === 'function') {
        return window.UiTouch.isIOS();
    }
    if (typeof navigator === 'undefined') return false;
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent || '')) return true;
    return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
};

GameSettings.getDefaultQuality = function() {
    var ios = GameSettings.isMemoryConstrained();
    return ios ? 'mid' : 'high';
};

GameSettings.resolveQuality = function() {
    var saved = null;
    try { saved = localStorage.getItem(GameSettings.QUALITY_STORAGE_KEY); } catch (e) {}
    if (saved && GameSettings.QUALITY_LEVELS[saved] != null) return saved;
    return GameSettings.getDefaultQuality();
};

GameSettings.applyPixelRatio = function(app, qualityId) {
    if (!app || !app.graphicsDevice) return;
    var id = qualityId;
    if (!id || GameSettings.QUALITY_LEVELS[id] == null) id = GameSettings.resolveQuality();
    var level = GameSettings.QUALITY_LEVELS[id];
    var dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
    var ratio = Math.max(1.0, Math.min(level, dpr));
    app.graphicsDevice.maxPixelRatio = ratio;
    if (app.setCanvasResolution) app.setCanvasResolution(pc.RESOLUTION_AUTO);
    if (app.updateCanvasSize) app.updateCanvasSize();
};

/**
 * low：關 directional castShadows（省 shadow map bake／採樣；角色仍有 BlobShadow）
 * mid／high：開影子；大廳 realtime、對戰 cast-once（NONE + 必要時 THISFRAME refresh）
 */
GameSettings.applyShadowsForQuality = function(app, qualityId) {
    if (!app || !app.root || !app.root.findComponents) return;
    var id = qualityId;
    if (!id || GameSettings.QUALITY_LEVELS[id] == null) id = GameSettings.resolveQuality();
    var enable = id !== 'low';
    var inGame = !!(app.gameSettings && app.gameSettings._inGame);
    if (!inGame && typeof document !== 'undefined') {
        var ui = document.getElementById('fk-ui-root');
        if (ui && (ui.style.display === 'none' || ui.getAttribute('aria-hidden') === 'true')) {
            inGame = true;
        }
    }

    var lights = app.root.findComponents('light');
    for (var i = 0; i < lights.length; i++) {
        if (lights[i].type !== 'directional') continue;
        if (!enable) {
            lights[i].castShadows = false;
            continue;
        }
        lights[i].castShadows = true;
        lights[i].shadowUpdateMode = inGame ? pc.SHADOWUPDATE_NONE : pc.SHADOWUPDATE_REALTIME;
    }

    if (enable && inGame && app.gameModeManager && app.gameModeManager._refreshShadowMapOnce) {
        app.gameModeManager._refreshShadowMapOnce();
    }
};

/** 找戰鬥相機上的 cameraFrame（優先 cameraFollow 實體，避免抓到選角相機） */
GameSettings._findCameraFrame = function(app) {
    if (!app || !app.root) return null;
    var fromEntity = function(ent) {
        if (!ent || !ent.script) return null;
        if (ent.script.cameraFrame) return ent.script.cameraFrame;
        if (ent.script._scripts) {
            for (var i = 0; i < ent.script._scripts.length; i++) {
                var sc = ent.script._scripts[i];
                if (!sc) continue;
                if (sc.bloom != null && sc.ssao != null) return sc;
                if (sc.__scriptType && sc.__scriptType.__name === 'cameraFrame') return sc;
            }
        }
        return null;
    };
    try {
        if (app.cameraFollow && app.cameraFollow.entity) {
            var cfFollow = fromEntity(app.cameraFollow.entity);
            if (cfFollow) return cfFollow;
        }
        var named = app.root.findByName('Camera');
        var cfNamed = fromEntity(named);
        if (cfNamed) return cfNamed;
        if (app.root.findComponents) {
            var cams = app.root.findComponents('camera');
            var c;
            for (c = 0; c < cams.length; c++) {
                if (cams[c].entity && cams[c].entity.enabled) {
                    var cfOn = fromEntity(cams[c].entity);
                    if (cfOn) return cfOn;
                }
            }
            for (c = 0; c < cams.length; c++) {
                var cfAny = fromEntity(cams[c].entity);
                if (cfAny) return cfAny;
            }
        }
    } catch (e) { /* ignore */ }
    return null;
};

/**
 * 進局安全套用後處理：冷啟動整場先關 TAA/SSAO/DOF（history buffer 易整屏黑），
 * 不自動重開 TAA；玩家改畫質設定時才走 applyGraphicsQuality 完整路徑。
 */
GameSettings._applyPostFxSafeBoot = function(app, qualityId) {
    if (!app) return;
    var id = qualityId;
    if (!id || GameSettings.QUALITY_LEVELS[id] == null) id = GameSettings.resolveQuality();
    var cf = GameSettings._findCameraFrame(app);
    if (!cf) return;
    if (!GameSettings._postFxBackup) {
        GameSettings._postFxBackup = {
            bloom: !!(cf.bloom && cf.bloom.enabled),
            ssaoType: (cf.ssao && cf.ssao.type != null) ? cf.ssao.type : 'none',
            taa: !!(cf.taa && cf.taa.enabled),
            dof: !!(cf.dof && cf.dof.enabled)
        };
    }
    var b = GameSettings._postFxBackup;
    if (cf.taa) cf.taa.enabled = false;
    if (cf.ssao) cf.ssao.type = 'none';
    if (cf.dof) cf.dof.enabled = false;
    if (cf.bloom) cf.bloom.enabled = (id === 'low') ? false : !!b.bloom;
    if (app.updateCanvasSize) app.updateCanvasSize();
    if (app.resizeCanvas) app.resizeCanvas();
};

/**
 * 依畫質開關後處理。High 還原進遊戲時的 Inspector 設定。
 * low：關 bloom／SSAO／TAA／DOF
 * mid：保留 bloom（若原本有），關 SSAO／TAA／DOF
 * high：還原備份
 */
GameSettings.applyPostFxForQuality = function(app, qualityId) {
    var cf = GameSettings._findCameraFrame(app);
    if (!cf) return false;
    var id = qualityId;
    if (!id || GameSettings.QUALITY_LEVELS[id] == null) id = GameSettings.resolveQuality();

    if (!GameSettings._postFxBackup) {
        GameSettings._postFxBackup = {
            bloom: !!(cf.bloom && cf.bloom.enabled),
            ssaoType: (cf.ssao && cf.ssao.type != null) ? cf.ssao.type : 'none',
            taa: !!(cf.taa && cf.taa.enabled),
            dof: !!(cf.dof && cf.dof.enabled)
        };
    }
    var b = GameSettings._postFxBackup;

    if (id === 'low') {
        if (cf.bloom) cf.bloom.enabled = false;
        if (cf.ssao) cf.ssao.type = 'none';
        if (cf.taa) cf.taa.enabled = false;
        if (cf.dof) cf.dof.enabled = false;
    } else if (id === 'mid') {
        if (cf.bloom) cf.bloom.enabled = !!b.bloom;
        if (cf.ssao) cf.ssao.type = 'none';
        if (cf.taa) cf.taa.enabled = false;
        if (cf.dof) cf.dof.enabled = false;
    } else {
        if (cf.bloom) cf.bloom.enabled = !!b.bloom;
        if (cf.ssao) cf.ssao.type = b.ssaoType;
        if (cf.taa) cf.taa.enabled = !!b.taa;
        if (cf.dof) cf.dof.enabled = !!b.dof;
    }
    return true;
};

GameSettings.applyGraphicsQuality = function(app, qualityId) {
    GameSettings.applyPixelRatio(app, qualityId);
    GameSettings.applyPostFxForQuality(app, qualityId);
    GameSettings.applyShadowsForQuality(app, qualityId);
    try { app.fire('graphics:quality', qualityId); } catch (e) { /* ignore */ }
};

GameSettings.prototype.initialize = function() {
    this.app.gameSettings = this;
    this._isOpen = false;
    this._isPaused = false;
    this._isMusicOn = false;
    this._musicToggleTouched = false;
    this._inGame = false;

    GameSettings._ensureI18n();
    if (window.UiTouch && window.UiTouch.stripBrokenManifest) {
        window.UiTouch.stripBrokenManifest();
    }

    // 大廳冷啟動：先備份 Inspector 後處理，再強制關 TAA（避免 battle cam 預熱時 history 全黑）
    var qInit = GameSettings.resolveQuality();
    GameSettings.applyPixelRatio(this.app, qInit);
    var cfInit = GameSettings._findCameraFrame(this.app);
    if (cfInit && !GameSettings._postFxBackup) {
        GameSettings._postFxBackup = {
            bloom: !!(cfInit.bloom && cfInit.bloom.enabled),
            ssaoType: (cfInit.ssao && cfInit.ssao.type != null) ? cfInit.ssao.type : 'none',
            taa: !!(cfInit.taa && cfInit.taa.enabled),
            dof: !!(cfInit.dof && cfInit.dof.enabled)
        };
    }
    GameSettings.applyPostFxForQuality(this.app, qInit === 'low' ? 'low' : 'mid');
    GameSettings.applyShadowsForQuality(this.app, qInit);
    try { this.app.fire('graphics:quality', qInit); } catch (eQ) { /* ignore */ }
    if (this.app.systems.sound) this.app.systems.sound.volume = 0;

    this._injectStyle();
    this._createGearButton();
    this._createPanel();

    this._setGearVisible(true);
    this.app.on('game:start', this._onGameStart, this);
    this.app.on('game:introStart', this._onGameStart, this);
    this.app.on('lobby:matchFound', this._onGameStart, this);

    var self = this;
    this._onFsChange = function() {
        var fsv = document.getElementById('gs-fs-val');
        if (fsv) fsv.innerText = document.fullscreenElement ? GameSettings.t('settings.on') : GameSettings.t('settings.off');
    };
    document.addEventListener('fullscreenchange', this._onFsChange);

    this._onLangChanged = function() {
        self._refreshLabels();
    };
    window.addEventListener('tk:langChanged', this._onLangChanged);

    this.on('destroy', function() {
        this.app.off('game:start', this._onGameStart, this);
        this.app.off('game:introStart', this._onGameStart, this);
        this.app.off('lobby:matchFound', this._onGameStart, this);
        document.removeEventListener('fullscreenchange', this._onFsChange);
        window.removeEventListener('tk:langChanged', this._onLangChanged);
        if (this._gearBtn && this._gearBtn.parentNode) this._gearBtn.parentNode.removeChild(this._gearBtn);
        if (this._panel && this._panel.parentNode) this._panel.parentNode.removeChild(this._panel);
    }, this);
};

GameSettings.prototype._onGameStart = function() {
    this._inGame = true;
    this._setGearVisible(!this.app._promoCapture);
    // 進局：先安全關閉 TAA，數幀後再套完整畫質（避免無痕冷啟動整屏黑）
    var q = GameSettings.resolveQuality();
    GameSettings.applyPixelRatio(this.app, q);
    GameSettings._applyPostFxSafeBoot(this.app, q);
    GameSettings.applyShadowsForQuality(this.app, q);
    try { this.app.fire('graphics:quality', q); } catch (e) { /* ignore */ }
};

GameSettings.prototype._setGearVisible = function(visible) {
    if (this._gearBtn) this._gearBtn.style.display = visible ? 'flex' : 'none';
};

GameSettings.prototype._isMultiplayer = function() {
    return !!(this.app.networkManager && this.app.networkManager.socket && this.app.networkManager.socket.connected);
};

GameSettings.prototype._injectStyle = function() {
    if (window.UiTheme) UiTheme.inject();
};

GameSettings.prototype._createGearButton = function() {
    var btn = document.createElement('div');
    btn.id = 'gs-gear';
    btn.innerText = GameSettings.t('settings.gear');
    var self = this;
    var open = function(e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        self.openMenu();
    };
    btn.addEventListener('click', open);
    btn.addEventListener('touchstart', open, { passive: false });
    document.body.appendChild(btn);
    this._gearBtn = btn;
};

GameSettings.prototype._createPanel = function() {
    var overlay = document.createElement('div');
    overlay.id = 'gs-overlay';
    overlay.className = 'tk-modal-overlay';

    var stop = function(e) { e.stopPropagation(); };
    overlay.addEventListener('touchstart', stop, { passive: true });
    overlay.addEventListener('touchmove', stop, { passive: true });

    var panel = document.createElement('div');
    panel.id = 'gs-panel';
    panel.className = 'tk-panel';
    panel.innerHTML = this._buildPanelHtml();
    overlay.appendChild(panel);

    var self = this;

    overlay.addEventListener('click', function(e) {
        // Clicks inside custom dropdowns are owned by those controls (desktop mouse fix)
        if (e.target && e.target.closest) {
            if (e.target.closest('.tk-dropdown-option, .tk-dropdown-current, .tk-dropdown-list, .tk-dropdown')) {
                return;
            }
        }
        var camList = document.getElementById('gs-camera-list');
        var qList = document.getElementById('gs-quality-list');
        var langList = document.getElementById('gs-lang-list');
        var aimList = document.getElementById('gs-aim-list');
        var closedDropdown = false;
        if (camList && camList.classList.contains('open')) {
            camList.classList.remove('open');
            closedDropdown = true;
        }
        if (qList && qList.classList.contains('open')) {
            qList.classList.remove('open');
            closedDropdown = true;
        }
        if (langList && langList.classList.contains('open')) {
            langList.classList.remove('open');
            closedDropdown = true;
        }
        if (aimList && aimList.classList.contains('open')) {
            aimList.classList.remove('open');
            closedDropdown = true;
        }
        if (closedDropdown) return;
        if (e.target === overlay) this.closeMenu();
    }.bind(this));

    document.body.appendChild(overlay);
    this._panel = overlay;

    var bind = function(id, fn) {
        var el = document.getElementById(id);
        if (!el) return;
        var h = function(e) { if (e) { e.preventDefault(); e.stopPropagation(); } fn(); };
        if (window.UiTouch && window.UiTouch.bindTap) {
            window.UiTouch.bindTap(el, h, { debounceMs: 250 });
        } else {
            el.addEventListener('click', h);
            el.addEventListener('touchstart', h, { passive: false });
        }
    };

    this._populateCameraSelect();
    this._populateQualitySelect();
    this._populateAimModeSelect();
    this._populateLangSelect();

    var bindDropdownToggle = function(currentId, listId, otherListIds) {
        var currentBtn = document.getElementById(currentId);
        if (!currentBtn) return;
        var toggleList = function(e) {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            var list = document.getElementById(listId);
            for (var i = 0; i < otherListIds.length; i++) {
                var other = document.getElementById(otherListIds[i]);
                if (other) other.classList.remove('open');
            }
            if (list) list.classList.toggle('open');
        };
        if (window.UiTouch && window.UiTouch.bindTap) {
            window.UiTouch.bindTap(currentBtn, toggleList, { debounceMs: 200 });
        } else {
            currentBtn.addEventListener('click', toggleList);
            currentBtn.addEventListener('touchstart', toggleList, { passive: false });
        }
    };
    bindDropdownToggle('gs-lang-current', 'gs-lang-list', ['gs-camera-list', 'gs-quality-list', 'gs-aim-list']);
    bindDropdownToggle('gs-camera-current', 'gs-camera-list', ['gs-lang-list', 'gs-quality-list', 'gs-aim-list']);
    bindDropdownToggle('gs-quality-current', 'gs-quality-list', ['gs-lang-list', 'gs-camera-list', 'gs-aim-list']);
    bindDropdownToggle('gs-aim-current', 'gs-aim-list', ['gs-lang-list', 'gs-camera-list', 'gs-quality-list']);

    bind('gs-fullscreen', function() { self._toggleFullscreen(); });
    bind('gs-music', function() { self._toggleMusic(); });
    bind('gs-analytics', function() { self._toggleAnalytics(); });
    bind('gs-reset-tips', function() { self._resetTutorialTips(); });
    bind('gs-homescreen', function() { self._toggleHomescreenGuide(); });
    bind('gs-pause', function() { self._togglePause(); });
    bind('gs-leave', function() { self._backToMenu(); });
    bind('gs-close', function() { self.closeMenu(); });
    bind('gs-advanced-toggle', function() { self._toggleAdvanced(); });
};

GameSettings.prototype._buildPanelHtml = function() {
    var t = GameSettings.t;
    return '' +
        '<div class="gs-title tk-panel-title" data-i18n="settings.title">' + t('settings.title') + '</div>' +
        '<div class="gs-group">' +
            '<div class="gs-select-row tk-settings-row"><span data-i18n="settings.language">' + t('settings.language') + '</span> ' +
                '<div class="gs-dropdown tk-dropdown" id="gs-lang-dropdown">' +
                    '<div class="gs-dropdown-current tk-dropdown-current" id="gs-lang-current">' + t('settings.loading') + '</div>' +
                    '<div class="gs-dropdown-list tk-dropdown-list" id="gs-lang-list"></div>' +
                '</div>' +
            '</div>' +
            '<div class="gs-select-row tk-settings-row"><span data-i18n="settings.camera">' + t('settings.camera') + '</span> ' +
                '<div class="gs-dropdown tk-dropdown" id="gs-camera-dropdown">' +
                    '<div class="gs-dropdown-current tk-dropdown-current" id="gs-camera-current">' + t('settings.loading') + '</div>' +
                    '<div class="gs-dropdown-list tk-dropdown-list" id="gs-camera-list"></div>' +
                '</div>' +
            '</div>' +
            '<div class="gs-select-row tk-settings-row"><span data-i18n="settings.quality">' + t('settings.quality') + '</span> ' +
                '<div class="gs-dropdown tk-dropdown" id="gs-quality-dropdown">' +
                    '<div class="gs-dropdown-current tk-dropdown-current" id="gs-quality-current">' + t('settings.loading') + '</div>' +
                    '<div class="gs-dropdown-list tk-dropdown-list" id="gs-quality-list"></div>' +
                '</div>' +
            '</div>' +
            '<div class="gs-select-row tk-settings-row"><span data-i18n="settings.aimMode">' + t('settings.aimMode') + '</span> ' +
                '<div class="gs-dropdown tk-dropdown" id="gs-aim-dropdown">' +
                    '<div class="gs-dropdown-current tk-dropdown-current" id="gs-aim-current">' + t('settings.loading') + '</div>' +
                    '<div class="gs-dropdown-list tk-dropdown-list" id="gs-aim-list"></div>' +
                '</div>' +
            '</div>' +
            '<div class="gs-btn tk-settings-row" id="gs-fullscreen"><span data-i18n="settings.fullscreen">' + t('settings.fullscreen') + '</span> <span class="gs-val" id="gs-fs-val">' + t('settings.off') + '</span></div>' +
            '<div class="gs-btn tk-settings-row" id="gs-music"><span data-i18n="settings.music">' + t('settings.music') + '</span> <span class="gs-val" id="gs-music-val">' + t('settings.off') + '</span></div>' +
            '<div class="gs-btn tk-settings-row" id="gs-analytics"><span data-i18n="settings.analytics">' + t('settings.analytics') + '</span> <span class="gs-val" id="gs-analytics-val">' + t('settings.off') + '</span></div>' +
        '</div>' +
        '<div class="gs-advanced" id="gs-advanced">' +
            '<div class="gs-advanced-toggle" id="gs-advanced-toggle" data-i18n="settings.advanced">' + t('settings.advanced') + '</div>' +
            '<div class="gs-advanced-body">' +
                '<div class="gs-btn tk-settings-row" id="gs-reset-tips" data-i18n="settings.resetTips">' + t('settings.resetTips') + '</div>' +
                '<div class="gs-btn tk-settings-row" id="gs-homescreen" data-i18n="settings.homescreen">' + t('settings.homescreen') + '</div>' +
                '<div class="gs-homescreen-guide" id="gs-homescreen-guide" aria-live="polite"></div>' +
            '</div>' +
        '</div>' +
        '<div class="gs-actions">' +
            '<div class="gs-btn gs-primary tk-settings-row tk-settings-primary" id="gs-pause" style="display:none;"><span data-i18n-pause-label="1">' + t('settings.pause') + '</span> <span class="gs-val" id="gs-pause-val"></span></div>' +
            '<div class="gs-btn gs-danger tk-settings-row tk-settings-danger" id="gs-leave" data-i18n="settings.leave">' + t('settings.leave') + '</div>' +
        '</div>' +
        '<div class="gs-close tk-settings-close" id="gs-close" data-i18n="settings.close">' + t('settings.close') + '</div>';
};

GameSettings.prototype._refreshLabels = function() {
    if (this._gearBtn) this._gearBtn.innerText = GameSettings.t('settings.gear');

    var map = {
        'settings.title': '.gs-title',
        'settings.advanced': '#gs-advanced-toggle',
        'settings.resetTips': '#gs-reset-tips',
        'settings.homescreen': '#gs-homescreen',
        'settings.leave': '#gs-leave',
        'settings.close': '#gs-close'
    };
    for (var key in map) {
        if (!Object.prototype.hasOwnProperty.call(map, key)) continue;
        var el = this._panel && this._panel.querySelector(map[key]);
        if (el) el.innerText = GameSettings.t(key);
    }

    var langSpan = this._panel && this._panel.querySelector('[data-i18n="settings.language"]');
    if (langSpan) langSpan.textContent = GameSettings.t('settings.language');
    var camSpan = this._panel && this._panel.querySelector('[data-i18n="settings.camera"]');
    if (camSpan) camSpan.textContent = GameSettings.t('settings.camera');
    var qSpan = this._panel && this._panel.querySelector('[data-i18n="settings.quality"]');
    if (qSpan) qSpan.textContent = GameSettings.t('settings.quality');
    var aimSpan = this._panel && this._panel.querySelector('[data-i18n="settings.aimMode"]');
    if (aimSpan) aimSpan.textContent = GameSettings.t('settings.aimMode');

    var fsLabel = this._panel && this._panel.querySelector('#gs-fullscreen [data-i18n="settings.fullscreen"]');
    if (fsLabel) fsLabel.textContent = GameSettings.t('settings.fullscreen');
    var musicLabel = this._panel && this._panel.querySelector('#gs-music [data-i18n="settings.music"]');
    if (musicLabel) musicLabel.textContent = GameSettings.t('settings.music');
    var analyticsLabel = this._panel && this._panel.querySelector('#gs-analytics [data-i18n="settings.analytics"]');
    if (analyticsLabel) analyticsLabel.textContent = GameSettings.t('settings.analytics');

    this._populateCameraSelect();
    this._populateQualitySelect();
    this._populateAimModeSelect();
    this._populateLangSelect();

    var fsv = document.getElementById('gs-fs-val');
    if (fsv) fsv.innerText = document.fullscreenElement ? GameSettings.t('settings.on') : GameSettings.t('settings.off');
    var mv = document.getElementById('gs-music-val');
    if (mv) mv.innerText = this._isMusicOn ? GameSettings.t('settings.on') : GameSettings.t('settings.off');
    this._syncAnalyticsVal();

    var pauseLabel = document.querySelector('#gs-pause [data-i18n-pause-label]');
    var pv = document.getElementById('gs-pause-val');
    if (pauseLabel) {
        pauseLabel.textContent = this._isPaused ? GameSettings.t('settings.resume') : GameSettings.t('settings.pause');
    }
    if (pv) pv.innerText = this._isPaused ? GameSettings.t('settings.paused') : '';

    this._syncHomescreenRow();
};

GameSettings.prototype.openMenu = function() {
    this._isOpen = true;
    this._panel.classList.add('open');

    var pauseBtn = document.getElementById('gs-pause');
    var leaveBtn = document.getElementById('gs-leave');
    if (pauseBtn) {
        var pauseUsable = this._inGame && !this._isMultiplayer();
        pauseBtn.style.display = this._isMultiplayer() ? 'none' : 'flex';
        pauseBtn.classList.toggle('tk-btn-disabled', !pauseUsable);
        pauseBtn.classList.toggle('gs-disabled', !pauseUsable);
    }
    if (leaveBtn) {
        leaveBtn.classList.toggle('tk-btn-disabled', !this._inGame);
        leaveBtn.classList.toggle('gs-disabled', !this._inGame);
    }

    var mv = document.getElementById('gs-music-val');
    if (mv) mv.innerText = this._isMusicOn ? GameSettings.t('settings.on') : GameSettings.t('settings.off');

    var fsv = document.getElementById('gs-fs-val');
    if (fsv) fsv.innerText = document.fullscreenElement ? GameSettings.t('settings.on') : GameSettings.t('settings.off');

    this._syncAnalyticsVal();
    this._syncCameraSelect();
    this._syncQualitySelect();
    this._syncAimModeSelect();
    this._syncLangSelect();
    this._syncHomescreenRow();
};

GameSettings.prototype.closeMenu = function() {
    this._isOpen = false;
    this._panel.classList.remove('open');
    var guide = document.getElementById('gs-homescreen-guide');
    if (guide) guide.classList.remove('open');
    var advanced = document.getElementById('gs-advanced');
    if (advanced) advanced.classList.remove('open');
};

GameSettings.prototype._toggleAdvanced = function() {
    var advanced = document.getElementById('gs-advanced');
    if (!advanced) return;
    advanced.classList.toggle('open');
    if (!advanced.classList.contains('open')) {
        var guide = document.getElementById('gs-homescreen-guide');
        if (guide) guide.classList.remove('open');
    }
};

GameSettings.prototype._isStandaloneApp = function() {
    return !!(window.UiTouch && window.UiTouch.isStandalone && window.UiTouch.isStandalone());
};

GameSettings.prototype._homescreenGuideText = function() {
    if (this._isStandaloneApp()) return GameSettings.t('settings.homescreen.done');
    if (window.UiTouch && window.UiTouch.isIOS && window.UiTouch.isIOS()) {
        return GameSettings.t('settings.homescreen.ios');
    }
    var ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
    if (/Android/i.test(ua)) return GameSettings.t('settings.homescreen.android');
    var touch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (touch) return GameSettings.t('settings.homescreen.android');
    return GameSettings.t('settings.homescreen.other');
};

GameSettings.prototype._syncHomescreenRow = function() {
    var btn = document.getElementById('gs-homescreen');
    var guide = document.getElementById('gs-homescreen-guide');
    if (!btn) return;
    if (this._isStandaloneApp()) {
        btn.innerText = GameSettings.t('settings.homescreen.done');
        btn.classList.add('tk-btn-disabled', 'gs-disabled');
        if (guide) {
            guide.textContent = GameSettings.t('settings.homescreen.done');
            guide.classList.remove('open');
        }
    } else {
        btn.innerText = GameSettings.t('settings.homescreen');
        btn.classList.remove('tk-btn-disabled', 'gs-disabled');
        if (guide && guide.classList.contains('open')) {
            guide.textContent = this._homescreenGuideText();
        }
    }
};

GameSettings.prototype._toggleHomescreenGuide = function() {
    if (this._isStandaloneApp()) return;
    if (window.UiTouch && window.UiTouch.stripBrokenManifest) {
        window.UiTouch.stripBrokenManifest();
    }
    var guide = document.getElementById('gs-homescreen-guide');
    if (!guide) return;
    var open = !guide.classList.contains('open');
    if (open) {
        guide.textContent = this._homescreenGuideText();
        guide.classList.add('open');
    } else {
        guide.classList.remove('open');
    }
};

GameSettings.MODE_LABEL_KEYS = {
    ActionRPG: 'settings.camera.ActionRPG',
    WhiteCat: 'settings.camera.WhiteCat',
    BrawlStars: 'settings.camera.BrawlStars',
    MOBA: 'settings.camera.MOBA'
};

GameSettings.MODE_LABELS = {
    ActionRPG: '標準',
    WhiteCat: '近戰',
    BrawlStars: '開闊',
    MOBA: '俯瞰'
};

GameSettings.modeLabel = function (id) {
    var key = GameSettings.MODE_LABEL_KEYS[id];
    return key ? GameSettings.t(key) : (GameSettings.MODE_LABELS[id] || id);
};

GameSettings.prototype._getCameraFollow = function() {
    if (this.app.cameraFollow) return this.app.cameraFollow;
    var cam = this.app.root.findByName('Camera');
    if (cam && cam.script && cam.script.cameraFollow) return cam.script.cameraFollow;
    return null;
};

GameSettings.prototype._populateCameraSelect = function() {
    var list = document.getElementById('gs-camera-list');
    if (!list) return;

    var cf = this._getCameraFollow();
    var modes = (cf && cf.modesList && cf.modesList.length) ? cf.modesList
        : ['ActionRPG', 'WhiteCat', 'BrawlStars', 'MOBA'];

    list.innerHTML = '';
    var self = this;

    for (var i = 0; i < modes.length; i++) {
        var id = modes[i];
        var opt = document.createElement('div');
        opt.className = 'gs-dropdown-option tk-dropdown-option';
        opt.innerText = GameSettings.modeLabel(id);
        opt.setAttribute('data-value', id);
        this._bindDropdownOption(opt, (function(modeId) {
            return function () {
                list.classList.remove('open');
                self._setCameraMode(modeId);
                var current = document.getElementById('gs-camera-current');
                if (current) current.innerText = GameSettings.modeLabel(modeId);
            };
        })(id));
        list.appendChild(opt);
    }
    this._syncCameraSelect();
};

GameSettings.prototype._syncCameraSelect = function() {
    var currentDisplay = document.getElementById('gs-camera-current');
    if (!currentDisplay) return;

    var cf = this._getCameraFollow();
    var currentMode = null;
    if (cf && cf.cameraMode) currentMode = cf.cameraMode;
    if (!currentMode) { try { currentMode = localStorage.getItem('fk_camera_mode'); } catch (e) {} }

    if (!currentMode) {
        var modes = (cf && cf.modesList && cf.modesList.length) ? cf.modesList : ['ActionRPG'];
        currentMode = modes[0];
    }

    currentDisplay.innerText = GameSettings.modeLabel(currentMode);
};

GameSettings.prototype._setCameraMode = function(modeName) {
    if (!modeName) return;
    var cf = this._getCameraFollow();
    if (cf && cf.setCameraMode) {
        cf.setCameraMode(modeName);
    } else {
        try { localStorage.setItem('fk_camera_mode', modeName); } catch (e) {}
        this.app.fire('camera:setMode', modeName);
    }
};

GameSettings.prototype._populateQualitySelect = function() {
    var list = document.getElementById('gs-quality-list');
    if (!list) return;

    list.innerHTML = '';
    var self = this;
    var order = GameSettings.QUALITY_ORDER;

    for (var i = 0; i < order.length; i++) {
        var id = order[i];
        var opt = document.createElement('div');
        opt.className = 'gs-dropdown-option tk-dropdown-option';
        opt.innerText = GameSettings.qualityLabel(id);
        opt.setAttribute('data-value', id);
        this._bindDropdownOption(opt, (function(qualityId) {
            return function () {
                list.classList.remove('open');
                self._setQuality(qualityId);
                var current = document.getElementById('gs-quality-current');
                if (current) current.innerText = GameSettings.qualityLabel(qualityId);
            };
        })(id));
        list.appendChild(opt);
    }
    this._syncQualitySelect();
};

GameSettings.prototype._syncQualitySelect = function() {
    var currentDisplay = document.getElementById('gs-quality-current');
    if (!currentDisplay) return;
    var quality = GameSettings.resolveQuality();
    currentDisplay.innerText = GameSettings.qualityLabel(quality);
};

GameSettings.prototype._setQuality = function(qualityId) {
    if (!qualityId || GameSettings.QUALITY_LEVELS[qualityId] == null) return;
    try { localStorage.setItem(GameSettings.QUALITY_STORAGE_KEY, qualityId); } catch (e) {}
    GameSettings.applyGraphicsQuality(this.app, qualityId);
};

GameSettings.prototype._populateAimModeSelect = function() {
    var list = document.getElementById('gs-aim-list');
    if (!list) return;

    list.innerHTML = '';
    var self = this;
    var order = GameSettings.AIM_MODE_ORDER;

    for (var i = 0; i < order.length; i++) {
        var id = order[i];
        var opt = document.createElement('div');
        opt.className = 'gs-dropdown-option tk-dropdown-option';
        opt.innerText = GameSettings.aimModeLabel(id);
        opt.setAttribute('data-value', id);
        this._bindDropdownOption(opt, (function(modeId) {
            return function () {
                list.classList.remove('open');
                self._setAimMode(modeId);
                var current = document.getElementById('gs-aim-current');
                if (current) current.innerText = GameSettings.aimModeLabel(modeId);
            };
        })(id));
        list.appendChild(opt);
    }
    this._syncAimModeSelect();
};

GameSettings.prototype._syncAimModeSelect = function() {
    var currentDisplay = document.getElementById('gs-aim-current');
    if (!currentDisplay) return;
    currentDisplay.innerText = GameSettings.aimModeLabel(GameSettings.resolveAimMode());
};

GameSettings.prototype._setAimMode = function(modeId) {
    if (modeId !== 'simple' && modeId !== 'manual') return;
    try { localStorage.setItem(GameSettings.AIM_MODE_STORAGE_KEY, modeId); } catch (e) {}
    try { this.app.fire('aim:setMode', modeId); } catch (e2) { /* ignore */ }
};

/** Bind dropdown option — pointerdown first so desktop mouse works before overlay click. */
GameSettings.prototype._bindDropdownOption = function (opt, onPick) {
    if (!opt || !onPick) return;
    var fired = 0;
    var run = function (e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        var now = Date.now();
        if (now - fired < 280) return;
        fired = now;
        onPick(e);
    };
    // pointerdown/mousedown beat overlay click on desktop
    if (window.PointerEvent) {
        opt.addEventListener('pointerdown', function (e) {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            run(e);
        });
    } else {
        opt.addEventListener('mousedown', run);
        opt.addEventListener('touchstart', run, { passive: false });
    }
    opt.addEventListener('click', run);
};

GameSettings.prototype._populateLangSelect = function() {
    var list = document.getElementById('gs-lang-list');
    if (!list) return;

    list.innerHTML = '';
    var self = this;
    var options = [
        { id: 'zh-TW', key: 'settings.lang.zh' },
        { id: 'en', key: 'settings.lang.en' },
        { id: 'tr', key: 'settings.lang.tr' }
    ];

    for (var i = 0; i < options.length; i++) {
        var optDef = options[i];
        var opt = document.createElement('div');
        opt.className = 'gs-dropdown-option tk-dropdown-option';
        opt.innerText = GameSettings.t(optDef.key);
        opt.setAttribute('data-value', optDef.id);
        this._bindDropdownOption(opt, (function (langId) {
            return function () {
                list.classList.remove('open');
                self._setLang(langId);
            };
        })(optDef.id));
        list.appendChild(opt);
    }
    this._syncLangSelect();
};

GameSettings.prototype._syncLangSelect = function() {
    var currentDisplay = document.getElementById('gs-lang-current');
    if (!currentDisplay) return;
    var lang = (window.TKI18n && window.TKI18n.getLang) ? window.TKI18n.getLang() : 'en';
    currentDisplay.innerText = GameSettings.t(lang === 'en' ? 'settings.lang.en' : (lang === 'tr' ? 'settings.lang.tr' : 'settings.lang.zh'));
};

GameSettings.prototype._setLang = function(langId) {
    GameSettings._ensureI18n();
    if (window.TKI18n && typeof window.TKI18n.setLang === 'function') {
        window.TKI18n.setLang(langId);
    } else {
        try { localStorage.setItem('tk_lang', langId); } catch (e) {}
    }
    this._refreshLabels();
    this._syncLangSelect();
};

GameSettings.prototype._toggleFullscreen = function() {
    var fsv = document.getElementById('gs-fs-val');
    if (!document.fullscreenElement) {
        if (document.body.requestFullscreen) {
            document.body.requestFullscreen().catch(function(err){ console.log(err.message); });
        }
        if (fsv) fsv.innerText = GameSettings.t('settings.on');
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
        if (fsv) fsv.innerText = GameSettings.t('settings.off');
    }
};

GameSettings.prototype._toggleMusic = function() {
    this._musicToggleTouched = true;
    this._isMusicOn = !this._isMusicOn;
    if (this.app.systems.sound) this.app.systems.sound.volume = this._isMusicOn ? 1 : 0;
    if (this._isMusicOn) {
        try { this.app.fire('game:playBgm'); } catch (eBgm) { /* ignore */ }
    } else {
        try { this.app.fire('game:stopBgm'); } catch (eStop) { /* ignore */ }
    }
    var mv = document.getElementById('gs-music-val');
    if (mv) mv.innerText = this._isMusicOn ? GameSettings.t('settings.on') : GameSettings.t('settings.off');
};

GameSettings.prototype._hasAnalyticsConsent = function() {
    var am = this.app.analyticsManager;
    if (am && typeof am.hasConsent === 'function') return !!am.hasConsent();
    try {
        return localStorage.getItem('tk_analytics_consent') === '1';
    } catch (e) {
        return false;
    }
};

GameSettings.prototype._syncAnalyticsVal = function() {
    var av = document.getElementById('gs-analytics-val');
    if (av) av.innerText = this._hasAnalyticsConsent() ? GameSettings.t('settings.on') : GameSettings.t('settings.off');
};

GameSettings.prototype._toggleAnalytics = function() {
    var next = !this._hasAnalyticsConsent();
    var am = this.app.analyticsManager;

    // Manager 未掛場景時：UI 仍可寫 localStorage，但永遠不會送 GA — 必須擋下來並提示
    if (!am || typeof am.setConsent !== 'function') {
        console.warn('[Analytics] app.analyticsManager missing — add analyticsManager script to root entity');
        this._showToast(GameSettings.t('settings.toast.analyticsMissing'));
        return;
    }

    if (next && (!am.gameKey || !am.secretKey)) {
        console.warn('[Analytics] Missing Game Key / Secret Key on analyticsManager attributes');
        this._showToast(GameSettings.t('settings.toast.analyticsKeys'));
        return;
    }

    am.setConsent(next);
    this._syncAnalyticsVal();

    if (next) {
        var self = this;
        setTimeout(function () {
            if (am.isReady && am.isReady()) {
                console.log('[Analytics] SDK ready — events will send');
            } else {
                console.warn('[Analytics] Consent on but SDK not ready yet', am.getDebugStatus ? am.getDebugStatus() : null);
            }
        }, 1500);
    }
};

GameSettings.prototype._showToast = function(msg) {
    var old = document.getElementById('gs-toast');
    if (old) old.remove();
    var t = document.createElement('div');
    t.id = 'gs-toast';
    t.innerText = msg;
    t.style.cssText = 'position:fixed;top:20%;left:50%;transform:translateX(-50%);z-index:9000;' +
        'background:rgba(120,40,40,0.95);color:#fff;padding:14px 26px;border-radius:10px;' +
        'font-size:18px;font-family:"Microsoft JhengHei",sans-serif;border:1px solid #e85a4a;pointer-events:none;';
    document.body.appendChild(t);
    setTimeout(function() { if (t.parentNode) t.remove(); }, 2000);
};

GameSettings.prototype._resetTutorialTips = function() {
    var key = (window.TutorialConfig && window.TutorialConfig.storage && window.TutorialConfig.storage.tipsSeen)
        ? window.TutorialConfig.storage.tipsSeen
        : 'tk_tutorial_tips_seen';
    try { localStorage.removeItem(key); } catch (e) {}
    var btn = document.getElementById('gs-reset-tips');
    if (btn) {
        var done = GameSettings.t('settings.resetTips.done');
        var resetLabel = GameSettings.t('settings.resetTips');
        btn.innerText = done;
        setTimeout(function() { btn.innerText = resetLabel; }, 1200);
    }
};

GameSettings.prototype._togglePause = function() {
    if (this._isMultiplayer()) return;

    this._isPaused = !this._isPaused;
    this.app.timeScale = this._isPaused ? 0 : 1;

    var pv = document.getElementById('gs-pause-val');
    var pauseLabel = document.querySelector('#gs-pause [data-i18n-pause-label]');
    if (this._isPaused) {
        if (pv) pv.innerText = GameSettings.t('settings.paused');
        if (pauseLabel) pauseLabel.textContent = GameSettings.t('settings.resume');
    } else {
        if (pv) pv.innerText = '';
        if (pauseLabel) pauseLabel.textContent = GameSettings.t('settings.pause');
    }

    if (!this._isPaused) this.closeMenu();
};

GameSettings.prototype._backToMenu = function() {
    this.app.timeScale = 1;

    if (this._isMultiplayer() && this.app.networkManager) {
        this.app.fire('network:cancelMatchmaking');
    }

    window.location.reload();
};
