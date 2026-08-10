var CharacterSelect = pc.createScript('characterSelect');

CharacterSelect.attributes.add('modelGuanYu', { type: 'entity', title: 'Model GuanYu' });
CharacterSelect.attributes.add('modelZhangJiao', { type: 'entity', title: 'Model ZhangJiao' });
CharacterSelect.attributes.add('modelCaoCao', { type: 'entity', title: 'Model CaoCao' });
CharacterSelect.attributes.add('modelZhouYu', { type: 'entity', title: 'Model ZhouYu' });
CharacterSelect.attributes.add('modelSunQuan', { type: 'entity', title: 'Model SunQuan' });
CharacterSelect.attributes.add('modelLuBu', { type: 'entity', title: 'Model LuBu' });
CharacterSelect.attributes.add('modelZhangFei', { type: 'entity', title: 'Model ZhangFei' });
CharacterSelect.attributes.add('modelDiaoChan', { type: 'entity', title: 'Model DiaoChan' });
CharacterSelect.attributes.add('modelLiuBei', { type: 'entity', title: 'Model LiuBei' });
CharacterSelect.attributes.add('modelZhangLiao', { type: 'entity', title: 'Model ZhangLiao' }); 
CharacterSelect.attributes.add('modelZhangBao', { type: 'entity', title: 'Model ZhangBao (playerminion_melee)' });
CharacterSelect.attributes.add('skinPreviewRoot', { type: 'entity', title: 'Skin Preview Root' });

CharacterSelect.attributes.add('previewScale', { type: 'number', default: 3.5, title: 'Preview Scale' });
CharacterSelect.attributes.add('charRotationY', { type: 'number', default: 180, title: 'Character Rotation Y' });

CharacterSelect.attributes.add('selectCameraPortrait', { type: 'entity', title: 'Select Camera (大廳選角)' });
CharacterSelect.attributes.add('battleCamera', { type: 'entity', title: 'Battle Camera (遊戲相機)' });
CharacterSelect.attributes.add('camPortraitPos', { type: 'vec3', default: [0, 3.5, -15], title: 'Portrait Camera Pos (無 Select Camera 時 fallback)' });
CharacterSelect.attributes.add('camPortraitRot', { type: 'vec3', default: [-8, 0, 0], title: 'Portrait Camera Rot (fallback)' });
CharacterSelect.attributes.add('maxPixelRatioCap', { type: 'number', default: 1.0, title: 'Max Pixel Ratio Cap' });

CharacterSelect.GAME_NAME = 'Fight Kingdom';
CharacterSelect.SUPPORT_EMAIL = 'YOUR_EMAIL@example.com';   // ← 改成你的聯絡信箱
CharacterSelect.PRIVACY_UPDATED = '2026-08-10';

/** Hub strings live in localeZhTw.js / localeEn.js — only ensure TKI18n is up. */
CharacterSelect._ensureI18n = function () {
    if (window.GameSettings && typeof GameSettings._ensureI18n === 'function') {
        GameSettings._ensureI18n();
        return;
    }
    if (window.TKI18n) return;
    // Minimal stub if neither i18n nor gameSettings loaded yet
    var STORAGE_KEY = 'tk_lang';
    var DEFAULT = 'en';
    var packs = Object.create(null);
    var lang = DEFAULT;
    try {
        var saved = localStorage.getItem(STORAGE_KEY);
        if (saved === 'zh-TW' || saved === 'zh') lang = 'zh-TW';
        else if (saved === 'en') lang = 'en';
        else if (saved === 'tr' || saved === 'tr-TR') lang = 'tr';
        else if (!saved) {
            var navLang = '';
            try {
                if (navigator && navigator.languages && navigator.languages.length && navigator.languages[0]) {
                    navLang = navigator.languages[0];
                } else {
                    navLang = (navigator && (navigator.language || navigator.userLanguage || navigator.browserLanguage)) || '';
                }
            } catch (e2) {}
            navLang = String(navLang || '').toLowerCase();
            if (navLang.indexOf('zh') !== -1) lang = 'zh-TW';
            else if (navLang.indexOf('tr') === 0 || navLang.indexOf('tr-') !== -1 || navLang.indexOf('tr_') !== -1) lang = 'tr';
            else lang = 'en';
            try { localStorage.setItem(STORAGE_KEY, lang); } catch (e3) {}
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

CharacterSelect.t = function (key, vars) {
    CharacterSelect._ensureI18n();
    if (window.TKI18n && typeof window.TKI18n.t === 'function') {
        return window.TKI18n.t(key, vars);
    }
    return key;
};

CharacterSelect.modeLabel = function (modeId) {
    var id = modeId || '3V3_BOUNTY';
    if (id === '3V3_BOUNTY' || id === '3V3 BOUNTY') return CharacterSelect.t('hub.mode.bounty.title');
    if (id === '3V3_KNOCKOUT' || id === '3V3 KNOCKOUT') return CharacterSelect.t('hub.mode.knockout.title');
    if (id === 'FFA') return CharacterSelect.t('hub.mode.ffa.title');
    if (id === 'ROGUE' || id === 'PVE_ROGUE') return CharacterSelect.t('hub.mode.rogue.title');
    return String(id).replace(/_/g, ' ');
};

CharacterSelect.prototype.initialize = function() {
    CharacterSelect._ensureI18n();
    this.app.characterSelect = this;
    // 畫質：優先走 GameSettings（解析度 + 後處理；玩家可在設定改）
    // maxPixelRatioCap Editor 屬性保留但不覆蓋玩家選擇
    if (typeof GameSettings !== 'undefined' && GameSettings.applyGraphicsQuality) {
        GameSettings.applyGraphicsQuality(this.app, GameSettings.resolveQuality());
    } else if (typeof GameSettings !== 'undefined' && GameSettings.applyPixelRatio) {
        GameSettings.applyPixelRatio(this.app, GameSettings.resolveQuality());
    } else {
        var fallback = (window.UiTouch && window.UiTouch.isIOS && window.UiTouch.isIOS()) ? 1.0 : 1.5;
        var dpr = window.devicePixelRatio || 1;
        this.app.graphicsDevice.maxPixelRatio = Math.max(0.75, Math.min(fallback, dpr));
        this.app.setCanvasResolution(pc.RESOLUTION_AUTO);
        if (this.app.updateCanvasSize) this.app.updateCanvasSize();
    }
    this.selectedBrawler = 'guanyu';
    this.currentState = 'network';
    
    this.selection = { isMultiplayer: false, brawler: 'guanyu', skinKey: '', mode: '3V3_BOUNTY', playerName: 'Player' };
    this.currentRoomId = null;
    this.isRoomHost = false;
    this._pendingRoomAction = null;
    this._pendingRoomCode = '';
    this.isMusicOn = false;

    // 🌟 角色選單資料:全部衍生自 BrawlerConfig.select(單一來源,不再手抄一份)
    //    只有帶 select 區塊的 config 條目會進選角名單(minion/boss/變身型態自動排除)
    this.factionColors = { wei: '#1E88E5', shu: '#43A047', wu: '#E53935', qun: '#FBC02D' };
    this.brawlerData = {};
    this._rosterMaxHp = 0;
    this._rosterMaxDps = 0;
    this._rosterSpdMin = 99; this._rosterSpdMax = 0;
    for (var bk in window.BrawlerConfig) {
        var bc = window.BrawlerConfig[bk];
        if (!bc || !bc.select || !bc.select.faction) continue;
        this.brawlerData[bk] = {
            name: bc.name,
            zh: bc.select.zh || bc.name,
            en: bc.select.en || '',
            title: bc.select.title || '',
            titleEn: bc.select.titleEn || '',
            faction: bc.select.faction,
            role: bc.select.role || '',
            roleEn: bc.select.roleEn || '',
            range: bc.select.range || '',
            color: this.factionColors[bc.select.faction] || '#999',
            previewScale: bc.select.previewScale, previewUseOrigScale: bc.select.previewUseOrigScale
        };
        if (bc.health > this._rosterMaxHp) this._rosterMaxHp = bc.health;
        if (bc.speed < this._rosterSpdMin) this._rosterSpdMin = bc.speed;
        if (bc.speed > this._rosterSpdMax) this._rosterSpdMax = bc.speed;
        var dps = this._computeReferenceDps(bc);
        if (dps > this._rosterMaxDps) this._rosterMaxDps = dps;
    }
    // 選角網格順序：關羽 → 周瑜 → 其餘沿用 BrawlerConfig 原序
    this._rosterOrder = ['guanyu', 'zhouyu'];
    for (var ro in this.brawlerData) {
        if (this._rosterOrder.indexOf(ro) >= 0) continue;
        this._rosterOrder.push(ro);
    }

    this.models = {
        'guanyu': this.modelGuanYu, 'zhangjiao': this.modelZhangJiao, 'caocao': this.modelCaoCao,
        'zhangliao': this.modelZhangLiao, 'zhouyu': this.modelZhouYu, 'sunquan': this.modelSunQuan,
        'lubu': this.modelLuBu, 'zhangfei': this.modelZhangFei,
        'diaochan': this.modelDiaoChan, 'liubei': this.modelLiuBei,
        'zhangbao': this.modelZhangBao
    };
    this.skinPreviewModels = this._buildSkinPreviewMap();

    this.origScales = {};
    for (var key in this.models) {
        if (this.models[key]) {
            this.origScales[key] = this.models[key].getLocalScale().clone();
            this.models[key].enabled = false;
        }
    }
    for (var skinKey in this.skinPreviewModels) {
        if (this.skinPreviewModels[skinKey]) {
            this.origScales[skinKey] = this.skinPreviewModels[skinKey].getLocalScale().clone();
            this.skinPreviewModels[skinKey].enabled = false;
        }
    }

    // 🌟 相機：一顆選角相機（Editor 構圖所見即所得）+ 戰鬥相機。
    //    有拖 selectCameraPortrait → 大廳 3D 只開選角相機；否則 fallback 搬動 battle 相機。
    this.hubCam = (this.selectCameraPortrait && this.selectCameraPortrait.camera) ? this.selectCameraPortrait : null;
    this.useSelectCam = !!this.hubCam;
    this.mainCamera = this.battleCamera || this.app.root.findByName('Camera');

    if (this.useSelectCam) {
        var battlePri = (this.mainCamera && this.mainCamera.camera) ? this.mainCamera.camera.priority : 0;
        this.hubCam.camera.priority = battlePri + 1;
        this.hubCam.enabled = false;
        // 實體保持啟用；component 預設關。3D 大廳開 hubCam；mode／room 再開戰鬥相機預熱。
        if (this.mainCamera) {
            this.mainCamera.enabled = true;
            if (this.mainCamera.camera) this.mainCamera.camera.enabled = false;
        }
    } else if (this.mainCamera) {
        // fallback:沿用舊的存還原 + 墨褐清屏
        this.origCamPos = this.mainCamera.getLocalPosition().clone();
        this.origCamRot = this.mainCamera.getLocalEulerAngles().clone();
        if (this.mainCamera.camera) {
            this.origClearColor = this.mainCamera.camera.clearColor.clone();
            this.mainCamera.camera.clearColor = new pc.Color(0.13, 0.10, 0.06);
        }
    }

    this.onResize = function() {
        if (this.currentState === 'hidden') return;
        if (this.useSelectCam) {
            if (this.currentState === 'brawler' || this.currentState === 'network') this._updateHubCamera();
            return;
        }
        if (!this.mainCamera) return;
        this.mainCamera.setLocalPosition(this.camPortraitPos.x, this.camPortraitPos.y, this.camPortraitPos.z);
        this.mainCamera.setLocalEulerAngles(this.camPortraitRot.x, this.camPortraitRot.y, this.camPortraitRot.z);
    }.bind(this);

    window.addEventListener('resize', this.onResize);
    this.onResize();

    this._setupShadows();

    // 字體由 UiTheme.injectFonts() 統一載入(Anton + Noto Serif TC)

    this._buildDOMUI();
    this._disableHubTextChrome(this.uiRoot);
    this.showNetworkSelection();

    this._ensurePromoDirector();
    this._maybeAutoStartPromo();
    this._maybePromptRogueResume();

    // 🌟 初始選中：確保是已解鎖角色（否則 preview 不顯示）
    var pmInit = this.app.progressionManager;
    if (pmInit && !pmInit.isUnlocked(this.selectedBrawler)) {
        var unlocked0 = pmInit.getUnlockedList();
        if (unlocked0.length > 0) this.selectedBrawler = unlocked0[0];
    }
    this._selectCharacter(this.selectedBrawler);

    this.app.on('lobby:matchmakingStatus', this._onMatchmakingStatus, this);
    this.app.on('lobby:matchFound', this._onMatchFound, this);

    // 🌟 progressionManager 就緒時重繪角色網格（解決載入順序問題）
    var selfInit = this;
    if (this.app.progressionManager) {
        // 已就緒，初始選角已在上面處理
    } else {
        this.app.once('progression:ready', function() {
            var ul = selfInit.app.progressionManager.getUnlockedList();
            if (ul.length > 0 && !selfInit.app.progressionManager.isUnlocked(selfInit.selectedBrawler)) {
                selfInit._selectCharacter(ul[0]);
            }
            if (selfInit.currentState === 'brawler') selfInit._renderBrawlerGrid();
        });
    }
    this.app.on('lobby:roomCreated', this._onRoomCreated, this);
    this.app.on('lobby:roomJoined', this._onRoomJoined, this);
    this.app.on('lobby:roomUpdate', this._onRoomUpdate, this);
    this.app.on('lobby:roomError', this._onRoomError, this);
    this.app.on('progression:rogueCleared', function() {
        if (selfInit.currentState === 'brawler') selfInit._renderBrawlerGrid();
    });
    this.app.on('progression:skinUnlocked', function() {
        if (selfInit.currentState !== 'brawler') return;
        var bt = selfInit.selectedBrawler || selfInit.selection.brawler;
        if (bt) selfInit._refreshSkinOptions(bt);
        selfInit._refreshSkinLockUi();
    });
    this.app.on('progression:rogueBestUpdated', function() {
        if (selfInit.currentState !== 'brawler') return;
        var bt = selfInit.selectedBrawler || selfInit.selection.brawler;
        if (bt) selfInit._refreshSkinOptions(bt);
        selfInit._refreshSkinLockUi();
    });
    this.app.on('progression:coinsChanged', function() {
        if (selfInit.currentState !== 'brawler') return;
        selfInit._refreshSkinLockUi();
    });

    this._onLangChanged = function() {
        if (selfInit.currentState === 'hidden') return;
        selfInit._refreshHubLabels();
        if (selfInit.currentState === 'brawler') {
            selfInit._renderBrawlerGrid();
            if (selfInit.selectedBrawler) {
                selfInit._updateCharInfo(selfInit.selectedBrawler);
                selfInit._refreshSkinOptions(selfInit.selectedBrawler);
                selfInit._refreshSkinLockUi();
            }
            selfInit._refreshPlayButton();
        }
        if (selfInit.currentState === 'mode') selfInit._refreshRogueBestUi();
        var helpOv = document.getElementById('help-overlay');
        if (helpOv && helpOv.style.display === 'flex') {
            var ic = document.getElementById('instruction-content');
            if (ic) ic.innerHTML = selfInit._generateInstructionContent();
        }
        var pf = document.getElementById('profile-overlay');
        if (pf) selfInit._showProfile();
        var lb = document.getElementById('mc-lb-overlay');
        if (lb) selfInit._showRogueLeaderboardModal();
    };
    window.addEventListener('tk:langChanged', this._onLangChanged);

    this.on('destroy', function() {
        window.removeEventListener('resize', this.onResize);
        window.removeEventListener('tk:langChanged', this._onLangChanged);
    }, this);

    // 🌟 建立養成資訊列（軍餉/等級/經驗），常駐頂部
    this._buildProgressionBar();
    this._maybePromptTutorialFirstEntry();
};

// ── 養成資訊列：軍餉 + 等級 + 經驗條 ──────────────────────────────────────────
CharacterSelect.prototype._buildProgressionBar = function() {
    var self = this;
    var pm = this.app.progressionManager;

    // 注入樣式（一次）
    // #prog-bar 樣式由 UiTheme 提供

    var old = document.getElementById('prog-bar');
    if (old) old.remove();

    var bar = document.createElement('div');
    bar.id = 'prog-bar';
    bar.style.cursor = 'pointer';
    bar.innerHTML =
        '<div class="pb-coins" id="pb-coins"><span>🪙</span><span id="pb-coins-val">0</span></div>' +
        '<div class="pb-pass" id="pb-pass" title="' + CharacterSelect.t('hub.pass.tooltip') + '" style="display:none">PASS</div>' +
        '<div class="pb-sep"></div>' +
        '<div class="pb-lvl-wrap">' +
        '<div class="pb-lvl-top"><span class="pb-lvl" id="pb-lvl">Lv1</span><span class="pb-xp-txt" id="pb-xp-txt">0/100</span></div>' +
        '<div class="pb-xp-track"><div class="pb-xp-fill" id="pb-xp-fill" style="width:0%"></div></div>' +
        '</div>' +
        '<span style="color:#9a8f7a;font-size:13px;margin-left:2px;">▾</span>';
    document.body.appendChild(bar);
    this._disableHubTextChrome(bar);

    // 點擊展開完整 profile
    var openProfile = function(e) { if (e) { e.preventDefault(); e.stopPropagation(); } self._showProfile(); };
    bar.setAttribute('data-ui-interactive', '');
    window.UiTouch.bindTap(bar, openProfile);

    this._refreshProgressionBar();

    // 雲端帳號狀態
    var refreshCloud = function () { self._refreshCloudStatus(); };
    this.app.on('auth:ready', refreshCloud);
    this.app.on('auth:error', refreshCloud);
    this.app.on('auth:stateChanged', refreshCloud);
    this.app.on('auth:emailLinkRequested', refreshCloud);
    this.app.on('auth:emailLinked', refreshCloud);
    this.app.on('cloudSave:synced', refreshCloud);
    this.app.on('cloudSave:uploaded', refreshCloud);
    refreshCloud();

    // 監聽養成事件自動更新
    var refresh = function() { self._refreshProgressionBar(); };
    this.app.on('progression:coinsChanged', function() {
        self._refreshProgressionBar();
        var c = document.getElementById('pb-coins');
        if (c) { c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }
    });
    this.app.on('progression:xpChanged', refresh);
    this.app.on('progression:levelUp', refresh);
    this.app.on('progression:ready', refresh);
    this.app.on('progression:rogueBestUpdated', function() { self._refreshRogueBestUi(); });
    this.app.on('cloudSave:synced', function() { self._refreshRogueBestUi(true); });
    this.app.on('cloudSave:uploaded', function() { self._refreshRogueBestUi(true); });
    this.app.on('entitlement:changed', function() {
        self._refreshProgressionBar();
        if (self.currentState === 'brawler') self._renderBrawlerGrid();
        self._refreshPlayButton();
    });
    this.app.on('entitlement:purchaseSuccess', function () {
        self._showUnlockToast(CharacterSelect.t('hub.pass.enabled'), true);
        self._refreshProgressionBar();
        if (self.currentState === 'brawler') self._renderBrawlerGrid();
        self._refreshPlayButton();
    });
    this.app.on('entitlement:redeemSuccess', function () {
        self._showUnlockToast(CharacterSelect.t('hub.pass.redeemOkToast'), true);
        self._refreshProgressionBar();
        if (self.currentState === 'brawler') self._renderBrawlerGrid();
        self._refreshPlayButton();
    });
    this.app.on('entitlement:purchaseCancelled', function () {
        self._showUnlockToast(CharacterSelect.t('hub.pass.cancelled'), false);
    });
    this.app.on('entitlement:purchasePending', function () {
        self._showUnlockToast(CharacterSelect.t('hub.pass.pending'), true);
    });
    this.app.on('entitlement:purchasePendingTimeout', function () {
        self._showUnlockToast(CharacterSelect.t('hub.pass.pendingTimeout'), false);
    });

    // 若 pm 還沒就緒，ready 時再刷一次
    if (!pm) this.app.once('progression:ready', refresh);
};

CharacterSelect.prototype._formatRogueBestTime = function(atMs) {
    if (!atMs) return '';
    var d = new Date(atMs);
    if (isNaN(d.getTime())) return '';
    var mm = ('0' + (d.getMonth() + 1)).slice(-2);
    var dd = ('0' + d.getDate()).slice(-2);
    var hh = ('0' + d.getHours()).slice(-2);
    var mi = ('0' + d.getMinutes()).slice(-2);
    return mm + '/' + dd + ' ' + hh + ':' + mi;
};

CharacterSelect.prototype._brawlerLabel = function(bType) {
    if (!bType) return '';
    if (window.BrawlerConfig && typeof window.BrawlerConfig.getDisplayName === 'function') {
        return window.BrawlerConfig.getDisplayName(bType);
    }
    if (window.BrawlerConfig && typeof window.BrawlerConfig.getDisplayZh === 'function') {
        return window.BrawlerConfig.getDisplayZh(bType);
    }
    return bType;
};

CharacterSelect.prototype._escHtml = function(s) {
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
};

CharacterSelect.prototype._loadRogueCheckpoint = function() {
    if (typeof RogueCheckpointManager !== 'undefined' && RogueCheckpointManager.loadValid) {
        return RogueCheckpointManager.loadValid();
    }
    // Fallback if script asset not yet attached to scene
    try {
        var raw = localStorage.getItem('tk_rogue_checkpoint_v1');
        if (!raw) return null;
        var data = JSON.parse(raw);
        if (!data || data.checkpointVersion !== 1) return null;
        if (!data.savedAt || (Date.now() - data.savedAt) > 72 * 60 * 60 * 1000) return null;
        if (!data.hero || data.wave == null) return null;
        return data;
    } catch (e) {
        return null;
    }
};

CharacterSelect.prototype._clearRogueCheckpoint = function() {
    if (typeof RogueCheckpointManager !== 'undefined' && RogueCheckpointManager.clear) {
        RogueCheckpointManager.clear();
    } else {
        try { localStorage.removeItem('tk_rogue_checkpoint_v1'); } catch (e) { /* ignore */ }
    }
    if (this.app) this.app._rogueResumeCheckpoint = null;
};

CharacterSelect.prototype._refreshRogueResumeBtn = function() {
    var btn = document.getElementById('btn-rogue-resume');
    if (!btn) return;
    var cp = this._loadRogueCheckpoint();
    btn.style.display = cp ? '' : 'none';
};

CharacterSelect.prototype._maybePromptRogueResume = function() {
    if (this._rogueResumePromptShown) return;
    var cp = this._loadRogueCheckpoint();
    if (!cp) {
        this._refreshRogueResumeBtn();
        return;
    }
    // 避免與教學首進提示疊加：稍後再彈
    var self = this;
    setTimeout(function() {
        if (self._rogueResumePromptShown) return;
        if (document.getElementById('tutorial-first-overlay')) {
            setTimeout(function() { self._maybePromptRogueResume(); }, 800);
            return;
        }
        if (document.getElementById('rogue-resume-overlay')) return;
        self._rogueResumePromptShown = true;
        self._showRogueResumeModal(cp);
    }, 600);
};

CharacterSelect.prototype._showRogueResumeModal = function(cp) {
    cp = cp || this._loadRogueCheckpoint();
    if (!cp) {
        this._refreshRogueResumeBtn();
        return;
    }
    var old = document.getElementById('rogue-resume-overlay');
    if (old) old.remove();

    var t = CharacterSelect.t;
    var hero = this._brawlerLabel(cp.hero) || cp.hero || '—';
    var waveN = cp.wave || 0;
    if (cp.resumePhase === 'restart_wave' && waveN < 1) waveN = 1;
    var endless = cp.isEndless ? t('hub.rogue.resume.endless') : '';
    var bodyKey = cp.resumePhase === 'restart_wave'
        ? 'hub.rogue.resume.bodyMidWave'
        : 'hub.rogue.resume.body';
    var body = t(bodyKey, { hero: hero, n: waveN, endless: endless });

    var ov = document.createElement('div');
    ov.id = 'rogue-resume-overlay';
    ov.setAttribute('data-ui-interactive', '');
    ov.style.cssText = [
        'position:fixed',
        'inset:0',
        'z-index:9800',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'background:rgba(0,0,0,0.62)'
    ].join(';');
    ov.innerHTML =
        '<div style="width:min(92vw,420px);background:rgba(16,12,10,0.95);border:1px solid rgba(220,180,100,0.45);border-radius:16px;padding:22px 20px;color:#f3e6d0;text-align:center;font-family:var(--tk-font-body),system-ui,sans-serif;">' +
        '<div style="font-size:22px;font-weight:900;color:#f0d080;margin-bottom:10px;">' + t('hub.rogue.resume.title') + '</div>' +
        '<div style="font-size:14px;line-height:1.5;margin-bottom:16px;">' + this._escHtml(body) + '</div>' +
        '<button type="button" id="btn-rogue-resume-go" style="width:100%;padding:10px 12px;border:0;border-radius:10px;background:linear-gradient(180deg,#e8c56a,#c9942e);color:#2a1a08;font-weight:800;cursor:pointer;">' + t('hub.rogue.resume.continue') + '</button>' +
        '<button type="button" id="btn-rogue-resume-abandon" style="width:100%;margin-top:10px;padding:10px 12px;border:1px solid rgba(220,180,100,0.45);border-radius:10px;background:transparent;color:#f0d080;font-weight:700;cursor:pointer;">' + t('hub.rogue.resume.abandon') + '</button>' +
        '</div>';
    document.body.appendChild(ov);

    var self = this;
    var bindTap = function(id, fn) {
        var el = document.getElementById(id);
        if (!el) return;
        if (window.UiTouch && window.UiTouch.bindTap) window.UiTouch.bindTap(el, fn);
        else el.addEventListener('click', fn);
    };
    bindTap('btn-rogue-resume-go', function(e) {
        if (e && e.preventDefault) e.preventDefault();
        var cur = document.getElementById('rogue-resume-overlay');
        if (cur && cur.parentNode) cur.parentNode.removeChild(cur);
        self._startRogueFromCheckpoint(cp);
    });
    bindTap('btn-rogue-resume-abandon', function(e) {
        if (e && e.preventDefault) e.preventDefault();
        self._clearRogueCheckpoint();
        self._refreshRogueResumeBtn();
        var cur = document.getElementById('rogue-resume-overlay');
        if (cur && cur.parentNode) cur.parentNode.removeChild(cur);
    });
};

CharacterSelect.prototype._startRogueFromCheckpoint = function(cp) {
    if (!cp) return;
    this.app._rogueResumeCheckpoint = cp;
    this.app._forceTutorialRun = false;
    this.app._pendingTutorialRun = false;
    this.app._tutorialEntry = null;

    this.selection.isMultiplayer = false;
    this.selection.mode = 'ROGUE';
    this.selection.brawler = cp.hero || this.selectedBrawler || 'guanyu';
    this.selection.skinKey = cp.skin || '';
    this.selectedBrawler = this.selection.brawler;

    if (cp.playerName) {
        this.selection.playerName = cp.playerName;
        this.app.playerName = cp.playerName;
        if (this.nameInput) this.nameInput.value = cp.playerName;
    }

    this.currentState = 'hidden';
    this._startGame();
};

CharacterSelect.prototype._refreshRogueBestUi = function(forceFetch) {
    this._refreshRogueResumeBtn();
    var pm = this.app.progressionManager;
    var local = pm && pm.getRogueBestRecord ? pm.getRogueBestRecord() : { wave: pm ? pm.getRogueBestWave() : 0, brawler: '', at: 0 };

    var localEl = document.getElementById('mc-pve-rogue-local');
    if (localEl) {
        localEl.textContent = local.wave > 0 ? CharacterSelect.t('hub.rogue.myBest', { n: local.wave }) : '';
    }

    var globalEl = document.getElementById('mc-pve-rogue-global');
    if (!globalEl) return;

    var csm = this.app.cloudSaveManager;
    if (!csm || typeof csm.fetchRogueLeaderboard !== 'function') {
        if (this._globalRogueBestCache && !forceFetch) {
            this._renderGlobalRogueBest(this._globalRogueBestCache);
        } else if (csm && typeof csm.fetchGlobalRogueBest === 'function') {
            var self = this;
            if (!this._fetchingGlobalRogue) {
                this._fetchingGlobalRogue = true;
                csm.fetchGlobalRogueBest().then(function(rec) {
                    self._fetchingGlobalRogue = false;
                    self._globalRogueBestCache = rec;
                    self._renderGlobalRogueBest(rec);
                });
            }
        } else {
            globalEl.innerHTML = '';
        }
        return;
    }

    if (this._rogueLeaderboardCache && !forceFetch) {
        this._renderGlobalRogueBestFromLb(this._rogueLeaderboardCache[0]);
        return;
    }

    var self = this;
    if (this._fetchingGlobalRogue) return;
    this._fetchingGlobalRogue = true;

    csm.fetchRogueLeaderboard(10).then(function(rows) {
        self._fetchingGlobalRogue = false;
        self._rogueLeaderboardCache = rows || [];
        if (self._rogueLeaderboardCache.length) {
            self._renderGlobalRogueBestFromLb(self._rogueLeaderboardCache[0]);
        } else {
            return csm.fetchGlobalRogueBest().then(function(rec) {
                self._globalRogueBestCache = rec;
                self._renderGlobalRogueBest(rec);
            });
        }
    });
};

CharacterSelect.prototype._renderGlobalRogueBestFromLb = function(row) {
    var globalEl = document.getElementById('mc-pve-rogue-global');
    if (!globalEl) return;
    if (!row || !(row.rogue_best_wave > 0)) {
        globalEl.innerHTML = '';
        return;
    }

    var name = this._escHtml(row.display_name || CharacterSelect.t('hub.rogue.anon'));
    var hero = this._escHtml(this._brawlerLabel(row.rogue_best_brawler));
    var line1 = CharacterSelect.t('hub.rogue.champion', { name: '<span class="mc-best-name">' + name + '</span>' });
    if (hero) line1 += ' · ' + hero;
    line1 += ' · ' + CharacterSelect.t('hub.rogue.wave', { n: row.rogue_best_wave });

    globalEl.innerHTML = '<div class="mc-best-line1">' + line1 + '</div>';
};

CharacterSelect.prototype._showRogueLeaderboardModal = function() {
    var self = this;
    var t = CharacterSelect.t;
    var openModal = function(rows, loading) {
        if (typeof document === 'undefined') return;
        var old = document.getElementById('mc-lb-overlay');
        if (old) old.remove();

        var listHtml = '';
        if (loading) {
            listHtml = '<div class="mc-lb-empty">' + t('hub.lb.loading') + '</div>';
        } else if (!rows || !rows.length) {
            listHtml = '<div class="mc-lb-empty">' + t('hub.lb.empty') + '</div>';
        } else {
            for (var i = 0; i < rows.length; i++) {
                var r = rows[i];
                if (!(r.rogue_best_wave > 0)) continue;
                var name = self._escHtml(r.display_name || t('hub.rogue.anon'));
                var hero = self._escHtml(self._brawlerLabel(r.rogue_best_brawler));
                var code = r.build_short_code || '';
                listHtml += '<div class="mc-lb-item">' +
                    '<div class="mc-lb-item-head">' +
                    '<span class="mc-lb-rank">' + (i + 1) + '.</span> ' +
                    '<span class="mc-lb-name">' + name + '</span>' +
                    (hero ? (' · ' + hero) : '') +
                    ' · ' + t('hub.rogue.wave', { n: r.rogue_best_wave }) +
                    '</div>' +
                    '<div class="mc-lb-slots"' + (code ? (' data-build-code="' + self._escHtml(code) + '"') : '') + '>' +
                    (code ? '<span class="mc-lb-loading">' + t('hub.lb.buildLoading') + '</span>' : '') +
                    '</div></div>';
            }
            if (!listHtml) listHtml = '<div class="mc-lb-empty">' + t('hub.lb.empty') + '</div>';
        }

        var ov = document.createElement('div');
        ov.id = 'mc-lb-overlay';
        ov.className = 'overlay-screen tk-overlay';
        ov.style.display = 'flex';
        ov.setAttribute('data-ui-interactive', '');
        ov.innerHTML =
            '<div class="rg-panel tk-panel mc-lb-modal">' +
            '<div class="rg-panel-title tk-panel-title">' + t('hub.lb.title') + '</div>' +
            '<div class="mc-lb-list">' + listHtml + '</div>' +
            '<div class="rg-panel-btns tk-panel-btns">' +
            '<button type="button" class="tk-btn tk-btn-ghost" id="mc-lb-close">' + t('hub.lb.close') + '</button>' +
            '</div></div>';
        var host = self.uiRoot || document.body;
        host.appendChild(ov);

        var close = function() { ov.remove(); };
        var closeBtn = ov.querySelector('#mc-lb-close');
        if (closeBtn && window.UiTouch && window.UiTouch.bindTap) {
            window.UiTouch.bindTap(closeBtn, close);
        } else if (closeBtn) {
            closeBtn.addEventListener('click', close);
        }
        ov.addEventListener('click', function(e) {
            if (e.target === ov) close();
        });

        if (loading) return;

        var slotEls = ov.querySelectorAll('.mc-lb-slots[data-build-code]');
        var csm = self.app.cloudSaveManager;
        var rbs = self.app.rogueBuildShare;
        if (!csm || !rbs) return;
        for (var j = 0; j < slotEls.length; j++) {
            (function(el) {
                var shortCode = el.getAttribute('data-build-code');
                if (!shortCode) return;
                csm.fetchRogueBuild(shortCode).then(function(snap) {
                    if (!snap) {
                        el.innerHTML = '<span class="mc-lb-nobuild">' + CharacterSelect.t('hub.lb.buildUnavailable') + '</span>';
                        return;
                    }
                    el.innerHTML = '<div class="mc-lb-slot-row">' + rbs.renderSlotsHtmlFromSnapshot(snap) + '</div>';
                });
            })(slotEls[j]);
        }
    };

    if (this._rogueLeaderboardCache && this._rogueLeaderboardCache.length) {
        openModal(this._rogueLeaderboardCache, false);
        return;
    }

    openModal(null, true);

    var csm = this.app.cloudSaveManager;
    if (!csm || typeof csm.fetchRogueLeaderboard !== 'function') {
        openModal([], false);
        return;
    }
    csm.fetchRogueLeaderboard(10).then(function(rows) {
        self._rogueLeaderboardCache = rows || [];
        openModal(self._rogueLeaderboardCache, false);
    }).catch(function() {
        openModal([], false);
    });
};

CharacterSelect.prototype._openCloudRogueBuild = function(shortCode) {
    var csm = this.app.cloudSaveManager;
    var rbs = this.app.rogueBuildShare;
    if (!csm || !rbs || !shortCode) return;
    csm.fetchRogueBuild(shortCode).then(function(snap) {
        if (!snap) {
            if (rbs._toast) rbs._toast(CharacterSelect.t('hub.lb.buildNotFound'));
            return;
        }
        rbs.showPreviewModal(snap, { title: CharacterSelect.t('hub.lb.buildPreviewTitle') });
    });
};

CharacterSelect.prototype._renderGlobalRogueBest = function(rec) {
    var globalEl = document.getElementById('mc-pve-rogue-global');
    if (!globalEl) return;
    if (!rec || !(rec.wave > 0)) {
        globalEl.innerHTML = '';
        return;
    }

    var name = this._escHtml(rec.displayName || CharacterSelect.t('hub.rogue.anon'));
    var hero = this._escHtml(this._brawlerLabel(rec.brawler));
    var timeStr = this._formatRogueBestTime(rec.at);
    var line1 = CharacterSelect.t('hub.rogue.champion', { name: '<span class="mc-best-name">' + name + '</span>' });
    if (hero) line1 += ' · ' + hero;
    line1 += ' · ' + CharacterSelect.t('hub.rogue.wave', { n: rec.wave });

    var html = '<div class="mc-best-line1">' + line1 + '</div>';
    if (timeStr) html += '<div class="mc-best-line2">' + timeStr + '</div>';
    globalEl.innerHTML = html;
};

CharacterSelect.prototype._refreshProgressionBar = function() {
    var pm = this.app.progressionManager;
    if (!pm) return;
    var coinsEl = document.getElementById('pb-coins-val');
    var lvlEl = document.getElementById('pb-lvl');
    var xpTxtEl = document.getElementById('pb-xp-txt');
    var xpFillEl = document.getElementById('pb-xp-fill');
    if (!coinsEl) return;

    var lvl = pm.getLevel();
    var xp = pm.getXP();
    var xpNeed = pm.xpForNextLevel(lvl);

    coinsEl.textContent = pm.getCoins();
    if (lvlEl) lvlEl.textContent = 'Lv' + lvl;
    if (xpTxtEl) xpTxtEl.textContent = xp + '/' + xpNeed;
    if (xpFillEl) xpFillEl.style.width = Math.min(100, (xp / xpNeed) * 100) + '%';

    var passEl = document.getElementById('pb-pass');
    if (passEl) {
        var em = this.app.entitlementManager;
        var hasPass = !!(em && em.hasCharacterPass());
        passEl.style.display = hasPass ? '' : 'none';
        passEl.title = hasPass ? CharacterSelect.t('hub.pass.tooltipActive') : CharacterSelect.t('hub.pass.tooltip');
    }

    this._refreshRogueBestUi();
};

CharacterSelect.prototype._refreshCloudStatus = function () {
    var el = document.getElementById('pb-cloud');
    if (!el) return; // 雲端狀態已移入 profile 彈窗,資源列不再有此圖示

    var auth = this.app.authManager;
    if (!auth || !auth.isReady()) {
        el.textContent = '☁️';
        el.title = 'Cloud: Offline';
        el.classList.add('offline');
        return;
    }

    el.classList.remove('offline');
    var label = auth.getAccountLabel();
    if (label === 'Linked') {
        el.textContent = '🔗';
        el.title = 'Account linked — ' + auth.getEmail();
    } else if (label === 'Pending') {
        el.textContent = '⏳';
        el.title = 'Account pending — ' + auth.getEmail();
    } else {
        el.textContent = '☁️';
        el.title = 'Guest save — tap profile to link Google';
    }
};

CharacterSelect.prototype._getAccountSectionHtml = function () {
    var t = CharacterSelect.t;
    var auth = this.app.authManager;
    var clearBtn =
        '<button type="button" class="pf-signin-btn" id="pf-clear-local-btn">' + t('hub.auth.clearLocal') + '</button>' +
        '<div class="pf-account-hint">' + t('hub.auth.clearLocalHint') + '</div>';

    if (!auth || !auth.isReady()) {
        return '<div class="pf-account">' +
            '<div class="pf-section-label">' + t('hub.auth.section') + '</div>' +
            '<div class="pf-account-msg offline">' + t('hub.auth.offline') + '</div>' +
            clearBtn +
            '<div class="pf-account-msg" id="pf-account-msg"></div></div>';
    }

    var email = auth.getEmail();
    if (!auth.isAnonymous()) {
        return '<div class="pf-account">' +
            '<div class="pf-section-label">' + t('hub.auth.section') + '</div>' +
            '<div class="pf-account-msg linked">' + t('hub.auth.linked', { email: this._escapeProfileHtml(email || 'Google') }) + '</div>' +
            '<div class="pf-btn-row" style="margin-top:8px">' +
            '<button type="button" class="pf-signin-btn" id="pf-signout-btn">' + t('hub.auth.signOut') + '</button>' +
            '<button type="button" class="pf-signin-btn" id="pf-clear-local-btn">' + t('hub.auth.clearLocal') + '</button>' +
            '</div>' +
            '<div class="pf-account-hint">' + t('hub.auth.clearLocalHintLinked') + '</div>' +
            '<div class="pf-account-msg" id="pf-account-msg"></div></div>';
    }

    return '<div class="pf-account">' +
        '<div class="pf-section-label">' + t('hub.auth.section') + '</div>' +
        '<div class="pf-account-hint">' + t('hub.auth.bindHint') + '</div>' +
        '<label class="pf-consent"><span class="pf-consent-hit"><input type="checkbox" id="pf-consent-check"></span>' +
        '<span class="pf-consent-text">' + t('hub.auth.consent') + '</span></label>' +
        '<div class="pf-btn-row">' +
        '<button type="button" class="pf-link-btn" id="pf-google-link-btn">' + t('hub.auth.linkGoogle') + '</button>' +
        '<button type="button" class="pf-signin-btn" id="pf-google-signin-btn">' + t('hub.auth.signInGoogle') + '</button>' +
        '</div>' +
        clearBtn +
        '<p class="pf-legal-footer">' + t('hub.auth.legalFooter', {
            terms: '<button type="button" class="pf-legal-link" data-legal="terms">' + t('hub.auth.legalTerms') + '</button>',
            privacy: '<button type="button" class="pf-legal-link" data-legal="privacy">' + t('hub.auth.legalPrivacy') + '</button>'
        }) + '</p>' +
        '<div class="pf-account-msg" id="pf-account-msg"></div></div>';
};

CharacterSelect.prototype._getLegalDocumentHtml = function (type) {
    var game = CharacterSelect.GAME_NAME;
    var email = CharacterSelect.SUPPORT_EMAIL;
    var updated = CharacterSelect.PRIVACY_UPDATED;

    if (type === 'terms') {
        return '<h2>Terms of Service</h2><p class="pf-legal-updated">Last updated: ' + updated + '</p>' +
            '<p>By linking your Google account to <strong>' + game + '</strong>, you agree to the following:</p>' +
            '<ol class="pf-legal-list">' +
            '<li><strong>Account Responsibility</strong> — You are responsible for maintaining access to the Google account linked to your game account.</li>' +
            '<li><strong>Game Data</strong> — Your game progress is tied to the linked Google account. We are not responsible for data loss due to loss of Google account access.</li>' +
            '<li><strong>Purchases / Digital Content</strong> — The Character Pass is a one-time digital unlock of paid brawlers (T1–T3). Access is granted after successful payment and is tied to your linked account. Yellow Turbans (Rogue unlock) is not included. Refunds are handled according to Stripe&apos;s policies and applicable law; contact <a href="mailto:' + email + '">' + email + '</a> for purchase support.</li>' +
            '<li><strong>Acceptable Use</strong> — You agree not to exploit, cheat, or abuse the game or its services in any way.</li>' +
            '<li><strong>Service Availability</strong> — We strive to keep the game available at all times but do not guarantee uninterrupted service.</li>' +
            '<li><strong>Limitation of Liability</strong> — The game is provided &quot;as is.&quot; We are not liable for any damages arising from your use of the game.</li>' +
            '<li><strong>Termination</strong> — We reserve the right to terminate accounts that violate these terms.</li>' +
            '<li><strong>Contact</strong> — For questions, reach us at <a href="mailto:' + email + '">' + email + '</a>.</li>' +
            '</ol>';
    }

    return '<h2>Privacy Policy</h2><p class="pf-legal-updated">Last updated: ' + updated + '</p>' +
        '<h3>1. Information We Collect</h3>' +
        '<p>We collect only the following when you voluntarily link your Google account:</p>' +
        '<ul class="pf-legal-list"><li><strong>Email address</strong> — from Google, for account and purchase receipts</li>' +
        '<li><strong>Game progress data</strong> — your in-game save data</li>' +
        '<li><strong>Purchase entitlements</strong> — whether you own digital unlocks such as the Character Pass (not your full card number)</li></ul>' +
        '<h3>2. How We Use Your Information</h3>' +
        '<p>Your information is used for account recovery, cloud save, Google sign-in, and delivering purchased unlocks.</p>' +
        '<p>We <strong>do not</strong> use your email for advertising or third-party marketing profiles.</p>' +
        '<p>If you enable <strong>Share play data</strong> in Settings, we send anonymous gameplay events (for example match start/end, progression, and purchase outcomes) to <strong>GameAnalytics</strong> so we can improve balance and retention. You can turn this off anytime. Email is never sent to GameAnalytics.</p>' +
        '<h3>3. Payments</h3>' +
        '<p>Card payments are processed by <strong>Stripe</strong>. We do not store full payment card numbers. Stripe may process payment data under its own privacy policy.</p>' +
        '<h3>4. How We Store Your Data</h3>' +
        '<p>Data is stored using <strong>Supabase</strong> over encrypted connections (HTTPS/TLS). Authentication may involve Google as an identity provider.</p>' +
        '<h3>5. Data Retention</h3>' +
        '<p>Data is kept while your account is active. Request deletion at any time: <a href="mailto:' + email + '">' + email + '</a> (processed within 30 days).</p>' +
        '<h3>6. Your Rights</h3>' +
        '<p>You may request access, correction, deletion, or restriction of your data by contacting us.</p>' +
        '<h3>7. Children\'s Privacy</h3>' +
        '<p>This game is not directed at children under 13. We do not knowingly collect personal information from children.</p>' +
        '<h3>8. Contact</h3>' +
        '<p>Questions? Email <a href="mailto:' + email + '">' + email + '</a></p>';
};

CharacterSelect.prototype._showLegalModal = function (type) {
    var self = this;
    var old = document.getElementById('pf-legal-overlay');
    if (old) old.remove();

    var overlay = document.createElement('div');
    overlay.id = 'pf-legal-overlay';
    overlay.setAttribute('data-ui-interactive', '');
    overlay.innerHTML =
        '<div class="pf-legal-card">' +
        '<button class="pf-legal-close" id="pf-legal-close">✕</button>' +
        '<div class="pf-legal-body">' + this._getLegalDocumentHtml(type) + '</div>' +
        '</div>';
    document.body.appendChild(overlay);
    this._disableHubTextChrome(overlay);

    var close = function () { overlay.remove(); };
    window.UiTouch.markRoot(overlay);
    window.UiTouch.bindTap(overlay.querySelector('#pf-legal-close'), close);
    window.UiTouch.bindTap(overlay, function (e) { if (e && e.target === overlay) close(); }, { preventDefault: false });
};

CharacterSelect.prototype._clearLocalStorageAndReload = function () {
    var auth = this.app.authManager;
    var finish = function () {
        try { localStorage.clear(); } catch (e1) { /* ignore */ }
        try { sessionStorage.clear(); } catch (e2) { /* ignore */ }
        window.location.reload();
    };

    if (auth && typeof auth.signOut === 'function' && auth.getClient && auth.getClient()) {
        return auth.signOut().then(finish, finish);
    }
    finish();
    return Promise.resolve();
};

CharacterSelect.prototype._bindAccountSection = function (overlay) {
    var self = this;
    var UT = window.UiTouch;
    var linkBtn = overlay.querySelector('#pf-google-link-btn');
    var signInBtn = overlay.querySelector('#pf-google-signin-btn');
    var signOutBtn = overlay.querySelector('#pf-signout-btn');
    var clearBtn = overlay.querySelector('#pf-clear-local-btn');
    var msg = overlay.querySelector('#pf-account-msg');
    var consent = overlay.querySelector('#pf-consent-check');
    var consentLabel = overlay.querySelector('.pf-consent');

    UT.markRoot(overlay);
    if (consentLabel) UT.markRoot(consentLabel);

    var legalLinks = overlay.querySelectorAll('.pf-legal-link');
    var i;
    for (i = 0; i < legalLinks.length; i++) {
        (function (btn) {
            UT.bindTap(btn, function (e) {
                if (e) { e.preventDefault(); e.stopPropagation(); }
                self._showLegalModal(btn.getAttribute('data-legal'));
            });
        })(legalLinks[i]);
    }

    var validateConsent = function () {
        if (consent && !consent.checked) {
            if (msg) {
                msg.textContent = CharacterSelect.t('hub.auth.needConsent');
                msg.className = 'pf-account-msg error';
            }
            return false;
        }
        return true;
    };

    var startGoogle = function (btn, mode, e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        var auth = self.app.authManager;
        if (!auth || !btn) return;
        if (!validateConsent()) return;

        var label = btn.textContent;
        btn.disabled = true;
        btn.textContent = CharacterSelect.t('hub.auth.openingGoogle');

        var req = mode === 'signin'
            ? auth.signInWithGoogle()
            : auth.linkGoogle();

        req.then(function (result) {
            if (result && result.error) {
                btn.disabled = false;
                btn.textContent = label;
                if (msg) {
                    var errMsg = result.error.message || CharacterSelect.t('hub.auth.googleFail');
                    if (mode === 'link' && /already|identity|linked/i.test(errMsg)) {
                        errMsg = CharacterSelect.t('hub.auth.googleAlreadyLinked');
                    }
                    msg.textContent = errMsg;
                    msg.className = 'pf-account-msg error';
                }
                return;
            }
            btn.disabled = false;
            btn.textContent = label;
            if (msg) {
                msg.textContent = CharacterSelect.t('hub.auth.completeAuth');
                msg.className = 'pf-account-msg pending';
            }
        });
    };

    if (linkBtn) {
        UT.bindTap(linkBtn, function (e) { startGoogle(linkBtn, 'link', e); });
    }
    if (signInBtn) {
        UT.bindTap(signInBtn, function (e) { startGoogle(signInBtn, 'signin', e); });
    }

    if (signOutBtn) {
        UT.bindTap(signOutBtn, function (e) {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            var auth = self.app.authManager;
            if (!auth || typeof auth.signOut !== 'function') return;
            signOutBtn.disabled = true;
            auth.signOut().then(function () {
                window.location.reload();
            }, function () {
                signOutBtn.disabled = false;
                if (msg) {
                    msg.textContent = CharacterSelect.t('hub.auth.signOutFail');
                    msg.className = 'pf-account-msg error';
                }
            });
        });
    }

    if (clearBtn) {
        UT.bindTap(clearBtn, function (e) {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            var ok = window.confirm(CharacterSelect.t('hub.auth.clearConfirm'));
            if (!ok) return;
            clearBtn.disabled = true;
            if (msg) {
                msg.textContent = CharacterSelect.t('hub.auth.clearing');
                msg.className = 'pf-account-msg pending';
            }
            self._clearLocalStorageAndReload();
        });
    }
};

// ── 完整玩家檔案（點養成列展開）──────────────────────────────────────────────
CharacterSelect.prototype._showProfile = function() {
    var self = this;
    var pm = this.app.progressionManager;
    if (!pm) return;

    var old = document.getElementById('profile-overlay');
    if (old) old.remove();

    var d = pm.getData();
    var name = (d.displayName && d.displayName.length) ? d.displayName : (this.nameInput ? this.nameInput.value || 'Player' : 'Player');
    var lvl = pm.getLevel(), xp = pm.getXP(), xpNeed = pm.xpForNextLevel(lvl);
    var winRate = pm.getWinRate();
    var fav = pm.getMostPlayedCharacter();
    var unlockedCount = pm.getUnlockedList().length;
    var totalChars = 0;
    for (var k in this.brawlerData) totalChars++;

    var favName = '—';
    var favDetail = '';
    var t = CharacterSelect.t;
    if (fav) {
        favName = this._brawlerLabel(fav.brawler) || fav.brawler;
        favDetail = t('hub.profile.gamesSuffix', { n: fav.games });
    }

    var em = this.app.entitlementManager;
    var hasPass = !!(em && em.hasCharacterPass());
    var monogram = String(name).charAt(0) || '?';
    var rogueBest = pm.getRogueBestWave() || '—';
    var xpPct = Math.min(100, (xp / xpNeed) * 100);

    var overlay = document.createElement('div');
    overlay.id = 'profile-overlay';
    overlay.setAttribute('data-ui-interactive', '');
    overlay.innerHTML =
        '<div class="pf-card">' +
        '<button type="button" class="pf-close" id="pf-close">✕</button>' +
        '<div class="pf-head">' +
        '<div class="pf-seal" aria-hidden="true">' + this._escapeProfileHtml(monogram) + '</div>' +
        '<div class="pf-head-main">' +
        '<div class="pf-head-row">' +
        '<div class="pf-name">' + this._escapeProfileHtml(name) + '</div>' +
        (hasPass ? '<span class="pf-pass-badge">' + t('hub.pass.badge') + '</span>' : '') +
        '</div>' +
        '<div class="pf-lvl">Lv ' + lvl + ' · ' + xp + '/' + xpNeed + '</div>' +
        '<div class="pf-xpbar"><div class="pf-xpfill" style="width:' + xpPct + '%"></div></div>' +
        '</div></div>' +
        '<div class="pf-metrics">' +
        '<div class="pf-metric"><span class="pf-metric-num">' + d.stats.totalGames + '</span><span class="pf-metric-lbl">' + t('hub.profile.metric.games') + '</span></div>' +
        '<div class="pf-metric pf-metric-hi"><span class="pf-metric-num">' + winRate + '%</span><span class="pf-metric-lbl">' + t('hub.profile.metric.winRate') + '</span></div>' +
        '<div class="pf-metric"><span class="pf-metric-num">' + d.stats.totalWins + '</span><span class="pf-metric-lbl">' + t('hub.profile.metric.wins') + '</span></div>' +
        '<div class="pf-metric"><span class="pf-metric-num">' + d.stats.totalKills + '</span><span class="pf-metric-lbl">' + t('hub.profile.metric.kills') + '</span></div>' +
        '<div class="pf-metric pf-metric-hi"><span class="pf-metric-num">' + rogueBest + '</span><span class="pf-metric-lbl">' + t('hub.profile.metric.rogue') + '</span></div>' +
        '</div>' +
        '<div class="pf-meta">' +
        '<span>' + t('hub.profile.mostPlayed') + ' <b>' + this._escapeProfileHtml(favName) + '</b>' + (favDetail ? ' · ' + favDetail : '') + '</span>' +
        '<span class="pf-meta-sep">·</span>' +
        '<span>' + t('hub.profile.unlocked') + ' <b>' + unlockedCount + '/' + totalChars + '</b></span>' +
        '</div>' +
        this._getPassSectionHtml() +
        this._getAccountSectionHtml() +
        '</div>';
    document.body.appendChild(overlay);
    this._disableHubTextChrome(overlay);

    this._bindPassSection(overlay);
    this._bindAccountSection(overlay);

    var close = function() { overlay.remove(); };
    window.UiTouch.markRoot(overlay);
    window.UiTouch.bindTap(document.getElementById('pf-close'), close);
    window.UiTouch.bindTap(overlay, function(e) { if (e && e.target === overlay) close(); }, { preventDefault: false });
};

CharacterSelect.prototype._escapeProfileHtml = function(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
};

CharacterSelect.prototype._getPassSectionHtml = function() {
    var t = CharacterSelect.t;
    var em = this.app.entitlementManager;
    var auth = this.app.authManager;
    var hasPass = !!(em && em.hasCharacterPass());
    var email = CharacterSelect.SUPPORT_EMAIL;
    var needsLink = !auth || auth.isAnonymous() || !auth.getEmail();

    if (hasPass) {
        return '<div class="pf-pass">' +
            '<div class="pf-pass-line">' + t('hub.pass.ownedLine') +
            '<a href="mailto:' + email + '">' + t('hub.pass.support') + '</a></div></div>';
    }

    var hint = needsLink ? t('hub.pass.hintNeedLink') : t('hub.pass.hintBuy');

    return '<div class="pf-pass">' +
        '<div class="pf-section-label">' + t('hub.pass.title') + '</div>' +
        '<div class="pf-account-hint">' + hint + '</div>' +
        '<button type="button" class="pf-link-btn" id="pf-pass-cta">' + t('hub.pass.cta') + '</button>' +
        '<div class="pf-account-divider">' + t('hub.pass.orRedeem') + '</div>' +
        '<div class="pf-redeem-row">' +
        '<input type="text" class="pf-redeem-input" id="pf-redeem-input" placeholder="TKPASS-XXXXXX" autocomplete="off" autocapitalize="characters" spellcheck="false">' +
        '<button type="button" class="pf-signin-btn" id="pf-redeem-btn">' + t('hub.pass.redeem') + '</button>' +
        '</div>' +
        '<div class="pf-account-msg" id="pf-pass-msg"></div></div>';
};

CharacterSelect.prototype._bindPassSection = function(overlay) {
    var self = this;
    var btn = overlay.querySelector('#pf-pass-cta');
    var redeemBtn = overlay.querySelector('#pf-redeem-btn');
    var redeemInput = overlay.querySelector('#pf-redeem-input');
    if (!btn && !redeemBtn) return;

    var requireGoogle = function(msg, actionLabel) {
        if (msg) {
            msg.textContent = CharacterSelect.t('hub.pass.needGoogle', { action: actionLabel });
            msg.className = 'pf-account-msg pending';
        }
        var linkBtn = overlay.querySelector('#pf-google-link-btn');
        if (linkBtn && typeof linkBtn.scrollIntoView === 'function') {
            try { linkBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) { /* ignore */ }
        }
    };

    if (btn) {
        window.UiTouch.bindTap(btn, function() {
            var msg = overlay.querySelector('#pf-pass-msg');
            var em = self.app.entitlementManager;
            var auth = self.app.authManager;
            if (!em) {
                if (msg) {
                    msg.textContent = CharacterSelect.t('hub.pass.notReady');
                    msg.className = 'pf-account-msg error';
                }
                return;
            }
            if (auth && (auth.isAnonymous() || !auth.getEmail())) {
                if (msg) {
                    msg.textContent = CharacterSelect.t('hub.pass.linkingCheckout');
                    msg.className = 'pf-account-msg pending';
                }
                btn.disabled = true;
                auth.linkGoogle({ intent: 'checkout' }).then(function (result) {
                    btn.disabled = false;
                    if (result && result.error) {
                        if (msg) {
                            var errMsg = result.error.message || CharacterSelect.t('hub.pass.linkFail');
                            if (/already|identity|linked/i.test(errMsg)) {
                                errMsg = CharacterSelect.t('hub.pass.googleAlreadyLinked');
                            }
                            msg.textContent = errMsg;
                            msg.className = 'pf-account-msg error';
                        }
                    }
                });
                return;
            }
            if (msg) {
                msg.textContent = CharacterSelect.t('hub.pass.openingCheckout');
                msg.className = 'pf-account-msg pending';
            }
            btn.disabled = true;
            em.redirectToCheckout().then(function (result) {
                btn.disabled = false;
                if (result && result.url) return;
                if (msg) {
                    msg.textContent = (result && result.message) ? result.message : CharacterSelect.t('hub.pass.checkoutFail');
                    msg.className = 'pf-account-msg error';
                }
            });
        });
    }

    if (redeemBtn && redeemInput) {
        var doRedeem = function() {
            var msg = overlay.querySelector('#pf-pass-msg');
            var em = self.app.entitlementManager;
            var auth = self.app.authManager;
            var code = redeemInput.value || '';

            if (!em) {
                if (msg) {
                    msg.textContent = CharacterSelect.t('hub.pass.notReady');
                    msg.className = 'pf-account-msg error';
                }
                return;
            }
            if (auth && (auth.isAnonymous() || !auth.getEmail())) {
                requireGoogle(msg, CharacterSelect.t('hub.pass.redeemAction'));
                return;
            }
            if (msg) {
                msg.textContent = CharacterSelect.t('hub.pass.redeeming');
                msg.className = 'pf-account-msg pending';
            }
            redeemBtn.disabled = true;
            em.redeemCode(code).then(function (result) {
                redeemBtn.disabled = false;
                if (result && result.characterPass) {
                    if (msg) {
                        msg.textContent = CharacterSelect.t('hub.pass.redeemOk');
                        msg.className = 'pf-account-msg linked';
                    }
                    setTimeout(function () {
                        overlay.remove();
                        self._showProfile();
                    }, 600);
                    return;
                }
                if (msg) {
                    msg.textContent = (result && result.message) ? result.message : CharacterSelect.t('hub.pass.redeemFail');
                    msg.className = 'pf-account-msg error';
                }
            });
        };

        window.UiTouch.bindTap(redeemBtn, doRedeem);
        redeemInput.addEventListener('keydown', function (e) {
            if (e && e.key === 'Enter') {
                e.preventDefault();
                doRedeem();
            }
        });
    }
};

/** 選角：preview 模型開投影；燈光 REALTIME。進戰鬥後由 _startGame 切回 cast-once。 */
CharacterSelect.prototype._setupShadows = function() {
    var self = this;
    this._setPreviewCastShadows = function(entity, cast) {
        if (!entity) return;
        var renders = entity.findComponents('render');
        for (var i = 0; i < renders.length; i++) {
            renders[i].castShadows = cast;
            if (renders[i].meshInstances) {
                for (var m = 0; m < renders[i].meshInstances.length; m++) {
                    renders[i].meshInstances[m].castShadow = cast;
                }
            }
        }
        var models = entity.findComponents('model');
        for (var j = 0; j < models.length; j++) {
            models[j].castShadows = cast;
            if (models[j].meshInstances) {
                for (var n = 0; n < models[j].meshInstances.length; n++) {
                    models[j].meshInstances[n].castShadow = cast;
                }
            }
        }
    };

    var wire = function(ent) {
        if (!ent) return;
        self._setPreviewCastShadows(ent, true);
        ent.on('childinsert', function(child) { self._setPreviewCastShadows(child, true); });
    };
    for (var key in this.models) wire(this.models[key]);
    for (var skinKey in this.skinPreviewModels) wire(this.skinPreviewModels[skinKey]);

    this._setHubShadowRealtime(true);
};

CharacterSelect.prototype.postInitialize = function() {
    var self = this;
    // GameSettings.initialize 可能在之後把 shadow 設成 NONE／關閉；大廳再套一次
    this._applyHubShadows();
    this.app.on('graphics:quality', function() {
        if (self.currentState !== 'hidden' && self.app.gameSettings && !self.app.gameSettings._inGame) {
            self._applyHubShadows();
        }
    });
};

CharacterSelect.prototype._applyHubShadows = function() {
    if (this.currentState === 'hidden') return;
    this._setHubShadowRealtime(true);
};

/** 戰鬥相機 entity／component 是否參與渲染（大廳 3D 關掉以免搶 shadow frustum） */
CharacterSelect.prototype._setBattleCameraRender = function(on) {
    if (!this.mainCamera) return;
    this.mainCamera.enabled = on;
    if (this.mainCamera.camera) this.mainCamera.camera.enabled = on;
};

/** true＝選角 realtime；false＝戰鬥 cast-once（SHADOWUPDATE_NONE，之後靠 THISFRAME 重 bake） */
CharacterSelect.prototype._setHubShadowRealtime = function(realtime) {
    var lights = this.app.root.findComponents('light');
    for (var k = 0; k < lights.length; k++) {
        if (lights[k].type !== 'directional') continue;
        lights[k].castShadows = true;
        lights[k].shadowUpdateMode = realtime ? pc.SHADOWUPDATE_REALTIME : pc.SHADOWUPDATE_NONE;
    }
};

CharacterSelect.prototype._buildDOMUI = function() {
    if (window.UiTheme) UiTheme.inject();
    // 🌟 本畫面所有 CSS 由 UiTheme(ui-theme-style)單一來源提供,此處不再注入樣式
    //    改樣式請去 uiTheme.js,不要在這裡加 <style>

    CharacterSelect._ensureI18n();
    var t = CharacterSelect.t;

    this.uiRoot = document.createElement('div');
    this.uiRoot.id = 'fk-ui-root';
    this.uiRoot.setAttribute('data-ui-interactive', '');
    if (window.UiTouch && window.UiTouch.isIOS && window.UiTouch.isIOS()) {
        this.uiRoot.classList.add('ios-ui');
    }
    
    this.uiRoot.innerHTML = `
        <div id="cs-vignette"></div>
        <div id="cs-bigname"></div>
        <div class="ui-panel" id="main-ui-panel">
            <button type="button" class="tk-btn-back" id="btn-hub-back">${t('hub.back')}</button>
            <div class="hub-topbar"><div class="ui-title" id="ui-title"></div></div>
            
            <div id="step-network" class="step-container tk-network-step hub-step">
                <div class="hub-hero">
                    <div class="hub-brand" id="hub-brand">${t('hub.brand')}</div>
                    <div class="hub-tagline" id="hub-tagline">${t('hub.tagline')}</div>
                </div>
                <div class="hub-form">
                    <div>
                        <label class="hub-name-label" for="player-name-input" id="hub-name-label">${t('hub.name.label')}</label>
                        <input type="text" id="player-name-input" class="tk-input hub-name" placeholder="${t('hub.name.placeholder')}" maxlength="10">
                    </div>
                    <div class="hub-actions">
                        <button type="button" class="hub-entry" id="btn-single">
                            <span class="hub-entry-kanji">征</span>
                            <span class="hub-entry-body">
                                <span class="hub-entry-title" id="hub-solo-title">${t('hub.entry.solo.title')}</span>
                                <span class="hub-entry-desc" id="hub-solo-desc">${t('hub.entry.solo.desc')}</span>
                            </span>
                            <span class="hub-entry-arrow">›</span>
                        </button>
                        <button type="button" class="hub-entry" id="btn-multi">
                            <span class="hub-entry-kanji hub-entry-kanji-multi">戰</span>
                            <span class="hub-entry-body">
                                <span class="hub-entry-title" id="hub-multi-title">${t('hub.entry.multi.title')}</span>
                                <span class="hub-entry-desc" id="hub-multi-desc">${t('hub.entry.multi.desc')}</span>
                            </span>
                            <span class="hub-entry-arrow">›</span>
                        </button>
                        <button type="button" class="tk-btn tk-btn-ghost tk-btn-block" id="btn-open-help">${t('hub.help.open')}</button>
                    </div>
                </div>
            </div>
            
                        <div id="step-brawler" class="step-container">
                <div class="cs-showcase"></div>
                <div class="cs-sheet">
                    <div class="cs-head">
                        <div class="cs-nameplate">
                            <div class="cs-seal" id="cs-seal">？</div>
                            <div class="cs-nameplate-main">
                                <div class="cs-name" id="cs-name">—</div>
                                <div class="cs-title" id="cs-title"></div>
                            </div>
                        </div>
                        <div class="cs-quick-stats" id="cs-quick-stats">
                            <div class="cs-qstat"><b id="cs-lbl-hp">${t('hub.stat.hp')}</b><span id="cs-v-hp">—</span></div>
                            <div class="cs-qstat"><b>DPS</b><span id="cs-v-atk">—</span></div>
                            <div class="cs-qstat"><b id="cs-lbl-spd">${t('hub.stat.spd')}</b><span id="cs-v-spd">—</span></div>
                        </div>
                    </div>

                    <div class="cs-tabs" id="cs-tabs">
                        <button type="button" data-pane="roster" class="on" id="cs-tab-roster">${t('hub.tab.roster')}</button>
                        <button type="button" data-pane="stats" id="cs-tab-stats">${t('hub.tab.stats')}</button>
                        <button type="button" data-pane="skin" id="cs-tab-skin">${t('hub.tab.skin')}</button>
                    </div>

                    <div class="cs-panes">
                        <div class="cs-pane on" data-pane="roster">
                            <div class="brawler-grid" id="brawler-grid"></div>
                        </div>
                        <div class="cs-pane" data-pane="stats">
                            <div class="cs-bio" id="cs-bio">—</div>
                            <div class="cs-abilities">
                                <div class="cs-ab super"><div class="cs-ab-icon">絕</div><div><span id="cs-ab-super">—</span></div></div>
                                <div class="cs-ab"><div class="cs-ab-icon">擊</div><div><span id="cs-ab-atk"></span></div></div>
                            </div>
                        </div>
                        <div class="cs-pane" data-pane="skin">
                            <div class="cs-skin-picker">
                                <label for="cs-skin-select" class="cs-skin-label" id="cs-skin-label"></label>
                                <select id="cs-skin-select" class="cs-skin-select"></select>
                                <div class="cs-skin-lock" id="cs-skin-lock">
                                    <div class="cs-skin-lock-label" id="cs-skin-lock-label"></div>
                                    <button type="button" class="tk-btn tk-btn-ghost cs-skin-unlock-btn" id="btn-unlock-skin" style="display:none;"></button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="btn-container cs-brawler-actions">
                        <button class="tk-btn cs-play tk-btn-block" id="btn-play">${t('hub.play')}</button>
                    </div>
                </div>
            </div>
            
            <div id="step-mode" class="step-container">
                <div class="cs-showcase">
                    <div class="mode-deck" id="mode-deck">
                        <button class="mode-nav prev" id="mode-prev" type="button">‹</button>
                        <button class="mode-nav next" id="mode-next" type="button">›</button>

                        <div class="mode-slide on" id="btn-mode-pve">
                            <div class="mc-bg" style="background:radial-gradient(80% 58% at 50% 30%,#436b4566,#16241a 60%,#080605 100%)"></div>
                            <div class="mc-kanji">雄</div>
                            <span class="mc-tag" id="mc-rogue-tag">${t('hub.mode.rogue.tag')}</span>
                            <div class="mc-title" id="mc-rogue-title">${t('hub.mode.rogue.title')}</div>
                            <div class="mc-desc" id="mc-rogue-desc">${t('hub.mode.rogue.desc')}</div>
                            <div class="mc-best" id="mc-pve-rogue-best">
                                <div class="mc-best-global" id="mc-pve-rogue-global"></div>
                                <div class="mc-best-local" id="mc-pve-rogue-local"></div>
                                <button type="button" class="mc-lb-open-btn" id="btn-rogue-leaderboard">${t('hub.mode.rogue.leaderboard')}</button>
                                <button type="button" class="mc-lb-open-btn" id="btn-rogue-resume" style="display:none;margin-top:8px;background:linear-gradient(180deg,#e8c56a,#c9942e);color:#2a1a08;border:0;">${t('hub.rogue.resume.btn')}</button>
                            </div>
                        </div>

                        <div class="mode-slide" id="btn-mode-3v3">
                            <div class="mc-bg" style="background:radial-gradient(80% 58% at 50% 30%,#33628a66,#111a24 60%,#080605 100%)"></div>
                            <div class="mc-kanji">金</div>
                            <span class="mc-tag" id="mc-bounty-tag">${t('hub.mode.bounty.tag')}</span>
                            <div class="mc-title" id="mc-bounty-title">${t('hub.mode.bounty.title')}</div>
                            <div class="mc-desc" id="mc-bounty-desc">${t('hub.mode.bounty.desc')}</div>
                        </div>

                        <div class="mode-slide" id="btn-mode-knockout">
                            <div class="mc-bg" style="background:radial-gradient(80% 58% at 50% 30%,#8e623466,#241a0c 60%,#080605 100%)"></div>
                            <div class="mc-kanji">決</div>
                            <span class="mc-tag" id="mc-ko-tag">${t('hub.mode.knockout.tag')}</span>
                            <div class="mc-title" id="mc-ko-title">${t('hub.mode.knockout.title')}</div>
                            <div class="mc-desc" id="mc-ko-desc">${t('hub.mode.knockout.desc')}</div>
                        </div>

                        <div class="mode-slide" id="btn-mode-ffa">
                            <div class="mc-bg" style="background:radial-gradient(80% 58% at 50% 30%,#8a3b3366,#241010 60%,#080605 100%)"></div>
                            <div class="mc-kanji">亂</div>
                            <span class="mc-tag" id="mc-ffa-tag">${t('hub.mode.ffa.tag')}</span>
                            <div class="mc-title" id="mc-ffa-title">${t('hub.mode.ffa.title')}</div>
                            <div class="mc-desc" id="mc-ffa-desc">${t('hub.mode.ffa.desc')}</div>
                        </div>
                    </div>
                </div>
                <div class="cs-sheet">
                    <div class="mode-dots" id="mode-dots"></div>
                    <div class="mode-sheet-actions">
                        <button type="button" class="tk-btn cs-play" id="btn-mode-confirm">${t('hub.mode.confirm')}</button>
                    </div>
                    <div id="room-buttons">
                        <button class="tk-btn" id="btn-show-create">${t('hub.room.create')}</button>
                        <button class="tk-btn" id="btn-show-join">${t('hub.room.join')}</button>
                    </div>
                </div>
            </div>

                        <div id="step-room-lobby" class="step-container">
                <div class="room-info-box">
                    <div class="room-info-label" id="room-code-label">${t('hub.room.codeLabel')}</div>
                    <div class="room-code-display" id="display-room-code">----</div>
                    <div class="room-mode-label" id="display-room-mode">${t('hub.room.modeLabel', { mode: CharacterSelect.modeLabel('3V3_BOUNTY') })}</div>
                </div>
                
                <div class="player-list" id="room-player-list"></div>

                <div class="btn-container room-lobby-actions">
                    <button type="button" class="tk-btn room-lobby-btn room-lobby-secondary" id="btn-switch-team">${t('hub.room.switchTeam')}</button>
                    <button type="button" class="tk-btn room-lobby-btn room-lobby-primary" id="btn-start-room" style="display:none;">${t('hub.room.start')}</button>
                    <div id="room-wait-text" class="room-wait" style="display:none;">${t('hub.room.waitHost')}</div>
                    <button type="button" class="tk-btn room-lobby-btn room-lobby-ghost" id="btn-leave-room">${t('hub.room.leave')}</button>
                </div>
            </div>

        </div>
        
        <div id="help-overlay" class="overlay-screen">
            <div id="instruction-wrapper" class="tk-panel help-panel-v2">
                <button class="close-btn" id="btn-close-help">X</button>
                <div id="instruction-content"></div>
            </div>
        </div>

        <div id="matchmaking-overlay" class="overlay-screen">
            <div id="match-text" class="overlay-text">${t('hub.match.searching')}</div>
            <button class="tk-btn tk-btn-ghost" id="btn-cancel-match" style="width: 250px;">${t('hub.match.cancel')}</button>
        </div>

        <div id="join-prompt-overlay" class="overlay-screen">
            <div class="tk-panel tk-prompt-box join-prompt-box">
                <div class="tk-prompt-title" id="join-prompt-title">${t('hub.room.joinTitle')}</div>
                <input type="text" id="room-code-input" class="tk-input" placeholder="e.g. A1B2" maxlength="6">
                <div class="join-error" id="join-error-msg"></div>
                <div class="join-prompt-actions">
                    <button type="button" class="tk-btn tk-btn-ghost tk-btn-flex" id="btn-cancel-join">${t('hub.room.cancel')}</button>
                    <button type="button" class="tk-btn tk-btn-primary tk-btn-flex" id="btn-confirm-join">${t('hub.room.joinConfirm')}</button>
                </div>
            </div>
        </div>

        <div id="create-prompt-overlay" class="overlay-screen">
            <div class="tk-panel tk-prompt-box create-prompt-box">
                <div class="tk-prompt-title" id="create-prompt-title">${t('hub.room.createTitle')}</div>
                <div class="create-mode-list">
                    <button type="button" class="tk-btn room-mode-pick room-mode-bounty" id="btn-create-bounty">
                        <span class="room-mode-kanji" aria-hidden="true">金</span>
                        <span class="room-mode-pick-title" id="btn-create-bounty-label">${t('hub.mode.bounty.title')}</span>
                    </button>
                    <button type="button" class="tk-btn room-mode-pick room-mode-knockout" id="btn-create-knockout">
                        <span class="room-mode-kanji" aria-hidden="true">決</span>
                        <span class="room-mode-pick-title" id="btn-create-knockout-label">${t('hub.mode.knockout.title')}</span>
                    </button>
                    <button type="button" class="tk-btn room-mode-pick room-mode-ffa" id="btn-create-ffa">
                        <span class="room-mode-kanji" aria-hidden="true">亂</span>
                        <span class="room-mode-pick-title" id="btn-create-ffa-label">${t('hub.mode.ffa.title')}</span>
                    </button>
                </div>
                <button type="button" class="tk-btn tk-btn-ghost" id="btn-cancel-create">${t('hub.room.cancel')}</button>
            </div>
        </div>
    `;
    document.body.appendChild(this.uiRoot);

    this._bindDOMEvents();
    this._bindDragToScroll(); 
};

/** Refresh static Hub chrome after language change (dynamic panels rebuild separately). */
CharacterSelect.prototype._refreshHubLabels = function() {
    var t = CharacterSelect.t;
    var setTxt = function(id, key, vars) {
        var el = document.getElementById(id);
        if (el) el.textContent = t(key, vars);
    };
    setTxt('btn-hub-back', 'hub.back');
    setTxt('hub-brand', 'hub.brand');
    setTxt('hub-tagline', 'hub.tagline');
    setTxt('hub-name-label', 'hub.name.label');
    var nameInput = document.getElementById('player-name-input');
    if (nameInput) nameInput.placeholder = t('hub.name.placeholder');
    setTxt('hub-solo-title', 'hub.entry.solo.title');
    setTxt('hub-solo-desc', 'hub.entry.solo.desc');
    setTxt('hub-multi-title', 'hub.entry.multi.title');
    setTxt('hub-multi-desc', 'hub.entry.multi.desc');
    setTxt('btn-open-help', 'hub.help.open');
    setTxt('cs-lbl-hp', 'hub.stat.hp');
    setTxt('cs-lbl-spd', 'hub.stat.spd');
    setTxt('cs-tab-roster', 'hub.tab.roster');
    setTxt('cs-tab-stats', 'hub.tab.stats');
    setTxt('cs-tab-skin', 'hub.tab.skin');
    setTxt('cs-skin-label', 'hub.form.label');
    setTxt('btn-mode-confirm', 'hub.mode.confirm');
    setTxt('mc-rogue-tag', 'hub.mode.rogue.tag');
    setTxt('mc-rogue-title', 'hub.mode.rogue.title');
    setTxt('mc-rogue-desc', 'hub.mode.rogue.desc');
    setTxt('btn-rogue-leaderboard', 'hub.mode.rogue.leaderboard');
    setTxt('btn-rogue-resume', 'hub.rogue.resume.btn');
    setTxt('mc-bounty-tag', 'hub.mode.bounty.tag');
    setTxt('mc-bounty-title', 'hub.mode.bounty.title');
    setTxt('mc-bounty-desc', 'hub.mode.bounty.desc');
    setTxt('mc-ko-tag', 'hub.mode.knockout.tag');
    setTxt('mc-ko-title', 'hub.mode.knockout.title');
    setTxt('mc-ko-desc', 'hub.mode.knockout.desc');
    setTxt('mc-ffa-tag', 'hub.mode.ffa.tag');
    setTxt('mc-ffa-title', 'hub.mode.ffa.title');
    setTxt('mc-ffa-desc', 'hub.mode.ffa.desc');
    setTxt('btn-show-create', 'hub.room.create');
    setTxt('btn-show-join', 'hub.room.join');
    setTxt('room-code-label', 'hub.room.codeLabel');
    setTxt('btn-switch-team', 'hub.room.switchTeam');
    setTxt('btn-start-room', 'hub.room.start');
    setTxt('room-wait-text', 'hub.room.waitHost');
    setTxt('btn-leave-room', 'hub.room.leave');
    setTxt('btn-cancel-match', 'hub.match.cancel');
    setTxt('join-prompt-title', 'hub.room.joinTitle');
    setTxt('btn-cancel-join', 'hub.room.cancel');
    setTxt('btn-confirm-join', 'hub.room.joinConfirm');
    setTxt('create-prompt-title', 'hub.room.createTitle');
    setTxt('btn-create-bounty-label', 'hub.mode.bounty.title');
    setTxt('btn-create-knockout-label', 'hub.mode.knockout.title');
    setTxt('btn-create-ffa-label', 'hub.mode.ffa.title');
    setTxt('btn-cancel-create', 'hub.room.cancel');

    var modeEl = document.getElementById('display-room-mode');
    if (modeEl) {
        modeEl.textContent = t('hub.room.modeLabel', { mode: CharacterSelect.modeLabel(this.selection && this.selection.mode) });
    }
    var matchText = document.getElementById('match-text');
    if (matchText && this.currentState !== 'matchmaking') {
        matchText.textContent = t('hub.match.searching');
    }

    if (this.domTitle) {
        if (this.currentState === 'network') this.domTitle.innerText = t('hub.step.network');
        else if (this.currentState === 'brawler') this.domTitle.innerText = t('hub.step.brawler');
        else if (this.currentState === 'mode') {
            this.domTitle.innerText = t('hub.step.mode');
            this._setBigName(t('hub.bigname.mode'));
        } else if (this.currentState === 'room_lobby') this.domTitle.innerText = t('hub.step.lobby');
    }

    this._refreshPlayButton();
    this._refreshProgressionBar();
};

CharacterSelect.prototype._isTouchPrimary = function() {
    if (window.matchMedia) {
        if (window.matchMedia('(pointer: coarse)').matches) return true;
        if (window.matchMedia('(hover: none)').matches) return true;
    }
    return !!(('ontouchstart' in window) && navigator.maxTouchPoints > 0 && window.innerWidth < 900);
};

CharacterSelect.prototype._buildPcControlsHtml = function() {
    var t = CharacterSelect.t;
    return '' +
        '<div class="help-ctrl-block help-ctrl-pc">' +
        '<div class="help-ctrl-label">' + t('hub.help.labelPc') + '</div>' +
        '<p class="help-ctrl-desc">' + t('hub.help.pc.desc') + '</p>' +
        '<div class="instruction-detail flex-align-center"><span>' + t('hub.help.move') + '</span>' +
        '<div class="wasd-cluster"><div class="wasd-row"><kbd>W</kbd></div>' +
        '<div class="wasd-row"><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></div></div></div>' +
        '<div class="instruction-detail"><span>' + t('hub.help.atk') + '</span><span>' + t('hub.help.pc.atkHint') + '</span></div>' +
        '<div class="instruction-detail"><span>' + t('hub.help.super') + '</span><span>' + t('hub.help.pc.superHint') + '</span></div>' +
        '<div class="instruction-detail"><span>' + t('hub.help.dash') + '</span><span>' + t('hub.help.pc.dashHint') + '</span></div>' +
        '<div class="instruction-detail"><span>' + t('hub.help.lock') + '</span><span>' + t('hub.help.pc.lockHint') + '</span></div>' +
        '</div>';
};

CharacterSelect.prototype._buildMobileControlsHtml = function() {
    var t = CharacterSelect.t;
    return '' +
        '<div class="help-ctrl-block help-ctrl-mobile">' +
        '<div class="help-ctrl-label">' + t('hub.help.labelMobile') + '</div>' +
        '<p class="help-ctrl-desc">' + t('hub.help.mobile.desc') + '</p>' +
        '<div class="instruction-detail"><span>' + t('hub.help.move') + '</span><span>' + t('hub.help.mobile.moveHint') + '</span></div>' +
        '<div class="instruction-detail"><span>' + t('hub.help.atk') + '</span><span>' + t('hub.help.mobile.atkHint') + '</span></div>' +
        '<div class="instruction-detail"><span>' + t('hub.help.dash') + '</span><span>' + t('hub.help.mobile.dashHint') + '</span></div>' +
        '<div class="instruction-detail"><span>' + t('hub.help.super') + '</span><span>' + t('hub.help.mobile.superHint') + '</span></div>' +
        '<div class="instruction-detail"><span>' + t('hub.help.lock') + '</span><span>' + t('hub.help.mobile.lockHint') + '</span></div>' +
        '</div>';
};

CharacterSelect.prototype._generateInstructionContent = function() {
    var t = CharacterSelect.t;
    var touch = this._isTouchPrimary();
    var primary = touch ? this._buildMobileControlsHtml() : this._buildPcControlsHtml();
    var alt = touch ? this._buildPcControlsHtml() : this._buildMobileControlsHtml();
    var altLabel = touch ? t('hub.help.togglePc') : t('hub.help.toggleMobile');

    return '' +
        '<div class="help-hero">' +
        '<div class="help-hero-kicker">' + t('hub.help.tutorial.kicker') + '</div>' +
        '<div class="help-hero-title">' + t('hub.help.tutorial.title') + '</div>' +
        '<div class="help-hero-sub">' + t('hub.help.tutorial.sub') + '</div>' +
        '<button type="button" class="tk-btn cs-play tk-btn-block" id="btn-start-tutorial">' + t('hub.help.tutorial.cta') + '</button>' +
        '</div>' +
        '<div class="help-controls">' +
        '<div class="help-controls-head">' + t('hub.help.controlsHead') + '</div>' +
        '<div class="help-controls-primary">' + primary + '</div>' +
        '<button type="button" class="help-alt-toggle" id="btn-help-alt" aria-expanded="false">' + altLabel + '</button>' +
        '<div class="help-controls-alt" id="help-controls-alt" hidden>' + alt + '</div>' +
        '</div>';
};

CharacterSelect.prototype._bindDragToScroll = function() {
    var self = this;
    var grid = this.bGrid;
    var isDown = false;
    var startY;
    var scrollTop;
    var dragWalk = 0;

    var startDrag = function(e) {
        isDown = true;
        self._isDragging = false;
        dragWalk = 0;
        var pageX = e.pageX || (e.touches && e.touches[0].pageX);
        startY = pageX - grid.offsetLeft;
        scrollTop = grid.scrollLeft;
    };

    var endDrag = function() {
        isDown = false;
        if (Math.abs(dragWalk) <= 5) {
            self._isDragging = false;
        } else {
            self._isDragging = true;
            setTimeout(function() { self._isDragging = false; }, 50);
        }
    };

    var moveDrag = function(e) {
        if (!isDown) return;
        var pageX = e.pageX || (e.touches && e.touches[0].pageX);
        var y = pageX - grid.offsetLeft;
        dragWalk = (y - startY) * 1.5;
        if (Math.abs(dragWalk) > 5) { self._isDragging = true; }
        grid.scrollLeft = scrollTop - dragWalk;
    };

    grid.addEventListener('mousedown', startDrag);
    grid.addEventListener('mouseleave', endDrag);
    grid.addEventListener('mouseup', endDrag);
    grid.addEventListener('mousemove', moveDrag);
    grid.addEventListener('touchstart', startDrag, { passive: true });
    grid.addEventListener('touchend', endDrag);
    grid.addEventListener('touchcancel', endDrag);
    grid.addEventListener('touchmove', moveDrag, { passive: true });
};

CharacterSelect.prototype._bindDOMEvents = function() {
    var self = this;
    
    this.domTitle = document.getElementById('ui-title');
    this.stepNet = document.getElementById('step-network');
    this.stepBrawler = document.getElementById('step-brawler');
    this.stepMode = document.getElementById('step-mode');
    this.stepRoomLobby = document.getElementById('step-room-lobby');
    this.uiPanel = document.getElementById('main-ui-panel'); 
    
    this.nameInput = document.getElementById('player-name-input');
    this.bGrid = document.getElementById('brawler-grid');
    this.skinSelect = document.getElementById('cs-skin-select');
    this.skinLockPanel = document.getElementById('cs-skin-lock');
    this.skinLockLabel = document.getElementById('cs-skin-lock-label');
    this.skinUnlockBtn = document.getElementById('btn-unlock-skin');
    this.matchOverlay = document.getElementById('matchmaking-overlay');
    this.matchText = document.getElementById('match-text');

    this.joinPromptOverlay = document.getElementById('join-prompt-overlay');
    this.roomCodeInput = document.getElementById('room-code-input');
    this.joinErrorMsg = document.getElementById('join-error-msg');

    this.createPromptOverlay = document.getElementById('create-prompt-overlay');
    
    this.helpOverlay = document.getElementById('help-overlay');
    this.instructionContent = document.getElementById('instruction-content');

    var savedName = localStorage.getItem('fk_player_name');
    if (savedName) {
        this.nameInput.value = savedName;
        this.selection.playerName = savedName;
        this.app.playerName = savedName;
    }

    var bindInputTouch = function(input) {
        window.UiTouch.bindInput(input);
    };
    bindInputTouch(this.nameInput);
    bindInputTouch(this.roomCodeInput);

    var bindButton = function(id, callback) {
        var btn = document.getElementById(id);
        if (!btn) return;
        window.UiTouch.bindTap(btn, function(e) {
            self.app.fire('game:playBgm');
            try { self.app.fire('sfx:ui'); } catch (eSfx) { /* ignore */ }
            callback(e);
        });
    };

    bindButton('btn-open-help', function() { 
        self.instructionContent.innerHTML = self._generateInstructionContent();
        self.helpOverlay.style.display = 'flex'; 
    });
    bindButton('btn-close-help', function() { self.helpOverlay.style.display = 'none'; });

    // 軍師演武／裝置對照：內容每次重繪，用 overlay 委派
    if (this.helpOverlay && !this._helpDelegated) {
        this._helpDelegated = true;
        var onHelpTap = function(e) {
            var t = e.target;
            if (!t) return;
            if (t.id === 'btn-start-tutorial' || (t.closest && t.closest('#btn-start-tutorial'))) {
                if (e.cancelable) e.preventDefault();
                self.helpOverlay.style.display = 'none';
                self.app._forceTutorialRun = true;
                self.app._tutorialEntry = 'lobby_help';
                self.selection.isMultiplayer = false;
                self.selection.mode = 'ROGUE';
                self.selection.brawler = (window.TutorialConfig && window.TutorialConfig.heroBrawlerType) || 'guanyu';
                self.selection.skinKey = '';
                self.selectedBrawler = self.selection.brawler;
                self.currentState = 'hidden';
                self._startGame();
                return;
            }
            if (t.id === 'btn-help-alt' || (t.closest && t.closest('#btn-help-alt'))) {
                if (e.cancelable) e.preventDefault();
                var alt = document.getElementById('help-controls-alt');
                var btn = document.getElementById('btn-help-alt');
                if (!alt || !btn) return;
                var open = alt.hasAttribute('hidden');
                if (open) alt.removeAttribute('hidden');
                else alt.setAttribute('hidden', '');
                btn.setAttribute('aria-expanded', open ? 'true' : 'false');
                btn.classList.toggle('open', open);
            }
        };
        this.helpOverlay.addEventListener('click', onHelpTap);
        this.helpOverlay.addEventListener('touchstart', onHelpTap, { passive: false });
    }

    bindButton('btn-single', function() { 
        self.selection.isMultiplayer = false; 
        document.getElementById('room-buttons').style.display = 'none'; 
        document.getElementById('btn-mode-pve').style.display = '';
        self.showModeSelection();
        self._syncModeDeck(0);
    });
    bindButton('btn-multi', function() { 
        self.selection.isMultiplayer = true; 
        document.getElementById('room-buttons').style.display = 'flex'; 
        document.getElementById('btn-mode-pve').style.display = 'none';
        self.showModeSelection();
        self._syncModeDeck(0);
    });

    // 🌟 頂部統一返回鍵(network 步由 CSS 自動隱藏)
    bindButton('btn-hub-back', function() {
        if (self.currentState === 'brawler') {
            if (self._pendingRoomAction === 'join_room') {
                self._pendingRoomAction = null;
                self._pendingRoomCode = '';
                self.showModeSelection();
                self._syncModeDeck();
                self.joinPromptOverlay.style.display = 'flex';
            } else if (self._pendingRoomAction === 'create_room') {
                self._pendingRoomAction = null;
                self.showModeSelection();
                self._syncModeDeck();
                self.createPromptOverlay.style.display = 'flex';
            } else {
                self.showModeSelection();
                self._syncModeDeck();
            }
            return;
        }
        else if (self.currentState === 'mode') { self.showNetworkSelection(); }
        else if (self.currentState === 'room_lobby') {
            self.app.fire('network:cancelMatchmaking');
            self.currentRoomId = null;
            self.isRoomHost = false;
            self.showModeSelection();
            self._syncModeDeck();
        }
    });
    
    var onModePve = function(e) {
        if (e && e.target && e.target.closest && e.target.closest('#btn-rogue-leaderboard')) return;
        self._pendingRoomAction = null;
        self._pendingRoomCode = '';
        self.selection.mode = 'ROGUE';
        self.selection.isMultiplayer = false;
        self.showBrawlerSelection();
    };
    var onMode3v3 = function() {
        self._pendingRoomAction = null;
        self._pendingRoomCode = '';
        self.selection.mode = '3V3_BOUNTY';
        self.showBrawlerSelection();
    };
    var onModeKnockout = function() {
        self._pendingRoomAction = null;
        self._pendingRoomCode = '';
        self.selection.mode = '3V3_KNOCKOUT';
        self.showBrawlerSelection();
    };
    var onModeFfa = function() {
        self._pendingRoomAction = null;
        self._pendingRoomCode = '';
        self.selection.mode = 'FFA';
        self.showBrawlerSelection();
    };

    bindButton('btn-mode-pve', onModePve);
    bindButton('btn-rogue-leaderboard', function(e) {
        if (e && e.stopPropagation) e.stopPropagation();
        self._showRogueLeaderboardModal();
    });
    bindButton('btn-rogue-resume', function(e) {
        if (e && e.stopPropagation) e.stopPropagation();
        self._showRogueResumeModal();
    });

    if (this.stepMode && !this._rogueLbDelegated) {
        this._rogueLbDelegated = true;
        this.stepMode.addEventListener('click', function(e) {
            var t = e.target;
            if (!t || !t.closest) return;
            if (t.closest('#btn-rogue-resume')) {
                if (e.cancelable) e.preventDefault();
                if (e.stopPropagation) e.stopPropagation();
                self._showRogueResumeModal();
                return;
            }
            if (!t.closest('#btn-rogue-leaderboard')) return;
            if (e.cancelable) e.preventDefault();
            if (e.stopPropagation) e.stopPropagation();
            self._showRogueLeaderboardModal();
        });
    }

    bindButton('btn-mode-3v3', onMode3v3);
    bindButton('btn-mode-knockout', onModeKnockout); 
    bindButton('btn-mode-ffa', onModeFfa);

    self._modeConfirmById = {
        'btn-mode-pve': onModePve,
        'btn-mode-3v3': onMode3v3,
        'btn-mode-knockout': onModeKnockout,
        'btn-mode-ffa': onModeFfa
    };
    bindButton('btn-mode-confirm', function() {
        var slides = self._getVisibleModeSlides();
        var slide = slides[self._modeDeckIndex || 0];
        if (!slide) return;
        var fn = self._modeConfirmById[slide.id];
        if (fn) fn();
    });

    bindButton('btn-play', function() { self._onPlayButton(); });
    if (this.skinSelect) {
        this.skinSelect.addEventListener('change', function() {
            self.selection.skinKey = self.skinSelect.value || '';
            self._refreshPreviewModel();
            self._refreshSkinLockUi();
            if (self.selectedBrawler) self._updateCharInfo(self.selectedBrawler);
        });
    }
    if (this.skinUnlockBtn) {
        bindButton('btn-unlock-skin', function() {
            var skinKey = self.selection.skinKey || '';
            if (skinKey) self._tryUnlockSkin(skinKey);
        });
    }

    bindButton('btn-cancel-match', function() {
        self.matchOverlay.style.display = 'none';
        self.currentState = 'brawler';
        self.showBrawlerSelection();
        self.app.fire('network:cancelMatchmaking'); 
    });

    bindButton('btn-show-create', function() { self.createPromptOverlay.style.display = 'flex'; });
    bindButton('btn-cancel-create', function() { self.createPromptOverlay.style.display = 'none'; });
    
    bindButton('btn-create-bounty', function() { 
        self.createPromptOverlay.style.display = 'none'; 
        self.selection.mode = '3V3_BOUNTY';
        self._pendingRoomAction = 'create_room';
        self._pendingRoomCode = '';
        self.showBrawlerSelection();
    });
    bindButton('btn-create-knockout', function() { 
        self.createPromptOverlay.style.display = 'none'; 
        self.selection.mode = '3V3_KNOCKOUT';
        self._pendingRoomAction = 'create_room';
        self._pendingRoomCode = '';
        self.showBrawlerSelection();
    });
    bindButton('btn-create-ffa', function() { 
        self.createPromptOverlay.style.display = 'none'; 
        self.selection.mode = 'FFA';
        self._pendingRoomAction = 'create_room';
        self._pendingRoomCode = '';
        self.showBrawlerSelection();
    });

    bindButton('btn-show-join', function() { self.roomCodeInput.value = ''; self.joinErrorMsg.innerText = ''; self.joinPromptOverlay.style.display = 'flex'; });
    bindButton('btn-cancel-join', function() { self.joinPromptOverlay.style.display = 'none'; });
    bindButton('btn-confirm-join', function() {
        // Keep server-issued casing. Some room IDs may be case-sensitive.
        var code = (self.roomCodeInput.value || '').replace(/\s+/g, '').trim();
        if (code.length < 4) { self.joinErrorMsg.innerText = CharacterSelect.t('hub.room.invalidCode'); return; }
        self.joinPromptOverlay.style.display = 'none';
        self._pendingRoomAction = 'join_room';
        self._pendingRoomCode = code;
        self.showBrawlerSelection();
    });

    bindButton('btn-leave-room', function() {
        self.app.fire('network:cancelMatchmaking');
        self.currentRoomId = null;
        self.isRoomHost = false;
        self._pendingRoomAction = null;
        self._pendingRoomCode = '';
        self.showModeSelection();
        self._syncModeDeck();
    });

    bindButton('btn-start-room', function() {
        if (self.isRoomHost && self.currentRoomId) { self.app.fire('network:startRoomGame', self.currentRoomId); }
    });

    bindButton('btn-switch-team', function() { self.app.fire('network:switchTeam'); });

    this._bindPaneTabs();
    this._bindModeDeck();

};

/** Mode C：選角分頁（roster / stats / skin）只切 .on，不改 style.display */
CharacterSelect.prototype._showCsPane = function(pane) {
    var tabs = document.querySelectorAll('#cs-tabs button');
    var panes = document.querySelectorAll('#step-brawler .cs-pane');
    var i;
    for (i = 0; i < tabs.length; i++) {
        if (tabs[i].getAttribute('data-pane') === pane) tabs[i].classList.add('on');
        else tabs[i].classList.remove('on');
    }
    for (i = 0; i < panes.length; i++) {
        if (panes[i].getAttribute('data-pane') === pane) panes[i].classList.add('on');
        else panes[i].classList.remove('on');
    }
};

CharacterSelect.prototype._bindPaneTabs = function() {
    var self = this;
    var tabs = document.querySelectorAll('#cs-tabs button');
    var i;
    for (i = 0; i < tabs.length; i++) {
        (function(btn) {
            if (!window.UiTouch || !window.UiTouch.bindTap) return;
            window.UiTouch.bindTap(btn, function() {
                self._showCsPane(btn.getAttribute('data-pane'));
            });
        })(tabs[i]);
    }
    this._showCsPane('roster');
};

CharacterSelect.prototype._renderBrawlerGrid = function() {
    this.bGrid.innerHTML = '';
    var self = this;
    var pm = this.app.progressionManager;

    for (var i = 0; i < this._rosterOrder.length; i++) {
        var key = this._rosterOrder[i];
        var data = this.brawlerData[key];
        if (!data) continue;

        // 🌟 解鎖狀態（沒有 progressionManager 時一律當已解鎖,避免擋住開發）
        var unlocked = pm ? pm.isUnlocked(key) : true;

        var card = document.createElement('div');
        card.className = 'b-card' + (this.selectedBrawler === key ? ' selected' : '') + (unlocked ? '' : ' locked');
        card.setAttribute('data-id', key);

        var lockOverlay = '';
        if (!unlocked) {
            var info = pm ? pm.getUnlockInfo(key) : { cost: 0, levelReq: 1, unlockRogue: false };
            var priceText;
            if (info.unlockRogue) {
                priceText = (pm && pm.isRogueCleared()) ? CharacterSelect.t('hub.unlock.rogueDone') : 'ROGUE';
            } else {
                var canBuy = pm && pm.getLevel() >= info.levelReq;
                priceText = canBuy ? ('🪙' + info.cost) : ('Lv' + info.levelReq);
            }
            lockOverlay =
                '<div class="c-lock">' +
                '<div class="c-lock-icon">鎖</div>' +
                '<div class="c-lock-price">' + priceText + '</div>' +
                '</div>';
        } else if (pm && pm.isSoftUnlocked && !pm.isSoftUnlocked(key) && pm.isUnlockedByPass && pm.isUnlockedByPass(key)) {
            lockOverlay = '<div class="c-pass-badge">PASS</div>';
        }

        var label = self._brawlerLabel(key) || data.zh || data.name;
        var glyphSrc = data.zh || label || '?';
        card.innerHTML =
            '<div class="c-bg" style="background: linear-gradient(to top, ' + data.color + 'CC -60%, transparent);"></div>' +
            '<div class="c-glyph">' + glyphSrc.charAt(0) + '</div>' +
            '<div class="c-name">' + label + '</div>' +
            lockOverlay;

        var isIOS = window.UiTouch && window.UiTouch.isIOS && window.UiTouch.isIOS();
        if (isIOS) {
            card.setAttribute('role', 'button');
        }

        var onCardClick = function(e) {
            if (self._isDragging) return;
            if (e) { e.preventDefault(); e.stopPropagation(); }
            var clickedCard = e.currentTarget;
            var id = clickedCard.getAttribute('data-id');

            // 未解鎖也可 preview；出陣鎖在 play 鈕
            document.querySelectorAll('.b-card').forEach(function(c){ c.classList.remove('selected'); });
            clickedCard.classList.add('selected');
            self._selectCharacter(id);
        };

        var tapOpts = isIOS ? { debounceMs: 120 } : undefined;
        window.UiTouch.bindTap(card, onCardClick, tapOpts);

        if (isIOS && window.PointerEvent) {
            card.addEventListener('pointerdown', function(e) {
                if (self._isDragging) return;
                if (e.pointerType === 'mouse' && e.button !== 0) return;
                document.querySelectorAll('.b-card').forEach(function(c) { c.classList.remove('selected'); });
                card.classList.add('selected');
            });
        }

        this.bGrid.appendChild(card);
    }
};

// 🌟 嘗試解鎖角色（出陣鈕／dispatchOrder 在未解鎖時呼叫）
CharacterSelect.prototype._tryUnlockCharacter = function(brawlerType) {
    var pm = this.app.progressionManager;
    if (!pm) return;

    var data = this.brawlerData[brawlerType];
    var info = pm.getUnlockInfo(brawlerType);
    var name = this._brawlerLabel(brawlerType) || (data ? data.name : brawlerType);

    if (info.unlockRogue) {
        if (pm.isRogueCleared()) {
            var rogueResult = pm.tryPurchaseCharacter(brawlerType);
            if (rogueResult.success) {
                this._showUnlockToast(CharacterSelect.t('hub.unlock.success', { name: name }), true);
                this._selectCharacter(brawlerType);
                this._renderBrawlerGrid();
                this._refreshPlayButton();
            }
        } else {
            this._showUnlockToast(CharacterSelect.t('hub.unlock.needRogue', { name: name }), false);
        }
        return;
    }

    // 等級不夠
    if (pm.getLevel() < info.levelReq) {
        this._showUnlockToast(CharacterSelect.t('hub.unlock.needLevel', { n: info.levelReq, name: name }), false);
        return;
    }
    // 軍餉不夠
    if (pm.getCoins() < info.cost) {
        this._showUnlockToast(CharacterSelect.t('hub.unlock.needCoins', { cost: info.cost, have: pm.getCoins() }), false);
        return;
    }

    // 確認購買
    this._showUnlockConfirm(brawlerType, name, info.cost);
};

// 解鎖確認彈窗
CharacterSelect.prototype._showUnlockConfirm = function(brawlerType, name, cost) {
    var self = this;
    var t = CharacterSelect.t;
    var old = document.getElementById('unlock-confirm');
    if (old) old.remove();

    var overlay = document.createElement('div');
    overlay.id = 'unlock-confirm';
    overlay.className = 'tk-modal-overlay open';
    overlay.style.zIndex = '8000';
    overlay.setAttribute('data-ui-interactive', '');

    overlay.innerHTML =
        '<div class="unlock-dialog tk-panel">' +
        '<div class="ud-title">' + t('hub.unlock.confirmTitle') + '</div>' +
        '<div class="ud-name">' + name + '</div>' +
        '<div class="ud-cost">🪙 ' + cost + '</div>' +
        '<div class="ud-btns">' +
        '<button class="ud-btn ud-cancel">' + t('hub.unlock.cancel') + '</button>' +
        '<button class="ud-btn ud-confirm">' + t('hub.unlock.confirm') + '</button>' +
        '</div></div>';

    document.body.appendChild(overlay);
    this._disableHubTextChrome(overlay);

    var close = function() { overlay.remove(); };
    window.UiTouch.markRoot(overlay);
    window.UiTouch.bindTap(overlay.querySelector('.ud-cancel'), close);

    var doConfirm = function(e) {
        if (e) e.preventDefault();
        var pm = self.app.progressionManager;
        var result = pm.tryPurchaseCharacter(brawlerType);
        close();
        if (result.success) {
            self._showUnlockToast(CharacterSelect.t('hub.unlock.success', { name: name }), true);
            self._selectCharacter(brawlerType);
            self._renderBrawlerGrid();
            self._refreshPlayButton();
        } else {
            self._showUnlockToast(CharacterSelect.t('hub.unlock.fail'), false);
        }
    };
    window.UiTouch.bindTap(overlay.querySelector('.ud-confirm'), doConfirm);
};

// 解鎖提示 toast
CharacterSelect.prototype._showUnlockToast = function(msg, success) {
    var old = document.getElementById('unlock-toast');
    if (old) old.remove();
    var t = document.createElement('div');
    t.id = 'unlock-toast';
    t.className = success ? 'ok' : 'fail';
    t.innerText = msg;
    document.body.appendChild(t);
    try { this.app.fire(success ? 'sfx:uiConfirm' : 'sfx:uiDeny'); } catch (eSfx) { /* ignore */ }
    setTimeout(function(){ if (t.parentNode) t.remove(); }, 2000);
};

// 宣傳拍攝：程式化掛載 promoDirector（不必 Editor 接線；入口僅 ?promo=1）
CharacterSelect.prototype._ensurePromoDirector = function() {
    if (this.app.promoDirector) return this.app.promoDirector;
    if (typeof PromoDirector === 'undefined') return null;
    var pd = Object.create(PromoDirector.prototype);
    pd.app = this.app;
    pd.entity = this.entity;
    PromoDirector.prototype.initialize.call(pd);
    return pd;
};

CharacterSelect.prototype._startPromoCapture = function() {
    var pd = this._ensurePromoDirector();
    this.selection = (pd && pd.requestStartFromHub)
        ? pd.requestStartFromHub(this.selection)
        : Object.assign({}, this.selection, {
            isMultiplayer: false,
            mode: (window.PromoConfig && window.PromoConfig.mode) || 'FFA',
            brawler: (window.PromoConfig && window.PromoConfig.heroBrawlerType) || 'lubu'
        });
    this.app._promoCapture = true;
    this.selectedBrawler = this.selection.brawler;
    this.currentState = 'hidden';
    this._startGame();
};

CharacterSelect.prototype._maybeAutoStartPromo = function() {
    var self = this;
    var pd = this._ensurePromoDirector();
    var want = (pd && pd.wantsUrlAutoStart && pd.wantsUrlAutoStart());
    if (!want) {
        try {
            var q = (window.location.search || '').toLowerCase();
            want = q.indexOf('promo=1') !== -1 || q.indexOf('promo=true') !== -1;
        } catch (e) {}
    }
    if (!want) return;
    // 等一幀讓 Hub DOM／其他 manager 就緒
    setTimeout(function() { self._startPromoCapture(); }, 400);
};

// 🌟 鏤空直排書法大字(mockup 簽名元素):各步驟共用,傳 null 隱藏
CharacterSelect.prototype._setBigName = function(txt) {
    var el = document.getElementById('cs-bigname');
    if (!el) return;
    if (txt) { el.textContent = txt; el.style.display = 'block'; }
    else { el.style.display = 'none'; }
};

/** Hub 返回鍵錨點：none | top-left | top-right | bottom-right（CSS data-back；預設 top-left 避開右上進度條） */
CharacterSelect.prototype._setBackSlot = function(slot) {
    if (!this.uiPanel) return;
    this.uiPanel.setAttribute('data-back', slot || 'top-left');
};

/** 禁長按 copy／選字選單（CSS 為主；此處擋 contextmenu／copy，避免部分 WebView 仍跳出） */
CharacterSelect.prototype._disableHubTextChrome = function(root) {
    if (!root || root._tkNoTextChrome) return;
    root._tkNoTextChrome = true;
    var stop = function(e) { e.preventDefault(); };
    root.addEventListener('contextmenu', stop, true);
    root.addEventListener('copy', stop, true);
    root.addEventListener('cut', stop, true);
    root.addEventListener('selectstart', function(e) {
        var tag = e.target && e.target.tagName;
        // input 仍可放 caret／打字；其餘文字一律不可選
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
    }, true);
};

/** Hub 舞台：brawler＝3D+角色；network＝3D 背景（無角色）；其餘實心黑底 */
CharacterSelect.prototype._setHubStage = function(stage) {
    if (this.uiRoot) this.uiRoot.setAttribute('data-stage', stage || 'network');

    var showCam = (stage === 'brawler' || stage === 'network');
    var showChar = (stage === 'brawler');
    if (this.useSelectCam) {
        if (showCam) this._updateHubCamera();
        else {
            this.hubCam.enabled = false;
            if (this.hubCam.camera) this.hubCam.camera.enabled = false;
            // mode／room：CSS 實心黑底；戰鬥相機在底下渲染以預熱 GPU／cameraFrame
            this._setBattleCameraRender(true);
        }
    }

    if (!showChar) {
        this._hideAllPreviewModels();
    } else {
        this._refreshPreviewModel();
    }
};

CharacterSelect.prototype.showNetworkSelection = function() {
    this.currentState = 'network';
    this.domTitle.innerText = CharacterSelect.t('hub.step.network');
    this._setBigName(null);
    this.uiPanel.setAttribute('data-step', 'network');
    this.uiPanel.classList.remove('lobby-mode');
    this.stepNet.style.display = 'flex'; this.stepBrawler.style.display = 'none';
    this.stepMode.style.display = 'none'; this.stepRoomLobby.style.display = 'none';
    if (this.createPromptOverlay) this.createPromptOverlay.style.display = 'none';
    this._setBackSlot('none');
    this._setHubStage('network');
};

// 🌟 大廳 3D：只啟用一顆選角相機（構圖由 Editor 決定；直／橫向同一顆）
CharacterSelect.prototype._updateHubCamera = function() {
    if (!this.useSelectCam) return;
    if (this.currentState !== 'brawler' && this.currentState !== 'network') {
        this.hubCam.enabled = false;
        if (this.hubCam.camera) this.hubCam.camera.enabled = false;
        this._setBattleCameraRender(true);
        return;
    }
    this.hubCam.enabled = true;
    if (this.hubCam.camera) this.hubCam.camera.enabled = true;
    this._setBattleCameraRender(false);
    this._applyHubShadows();
};

CharacterSelect.prototype.showBrawlerSelection = function() {
    this.currentState = 'brawler';
    if (this._pendingRoomAction === 'create_room') {
        this.domTitle.innerText = CharacterSelect.t('hub.step.brawlerRoomCreate');
    } else if (this._pendingRoomAction === 'join_room') {
        this.domTitle.innerText = CharacterSelect.t('hub.step.brawlerRoomJoin');
    } else {
        this.domTitle.innerText = CharacterSelect.t('hub.step.brawler');
    }
    this.uiPanel.setAttribute('data-step', 'brawler');
    this.uiPanel.classList.remove('lobby-mode');
    this.stepNet.style.display = 'none'; this.stepBrawler.style.display = 'flex';
    this.stepMode.style.display = 'none'; this.stepRoomLobby.style.display = 'none';
    if (this.createPromptOverlay) this.createPromptOverlay.style.display = 'none';
    this._setBackSlot('top-left');
    this._setHubStage('brawler');
    this._renderBrawlerGrid();
    this._updateCharInfo(this.selectedBrawler);
    this._refreshSkinOptions(this.selectedBrawler);
    this._refreshPlayButton();
    this._showCsPane('roster');
};

CharacterSelect.prototype._getVisibleModeSlides = function() {
    var ids = this._modeSlideIds || ['btn-mode-pve', 'btn-mode-3v3', 'btn-mode-knockout', 'btn-mode-ffa'];
    var out = [];
    var i, el;
    for (i = 0; i < ids.length; i++) {
        el = document.getElementById(ids[i]);
        if (!el) continue;
        if (el.style.display === 'none') continue;
        out.push(el);
    }
    return out;
};

CharacterSelect.prototype._syncModeDeck = function(preferredIndex) {
    var slides = this._getVisibleModeSlides();
    var dots = document.getElementById('mode-dots');
    var idx = typeof preferredIndex === 'number' ? preferredIndex : (this._modeDeckIndex || 0);
    if (idx < 0) idx = 0;
    if (idx >= slides.length) idx = Math.max(0, slides.length - 1);
    this._modeDeckIndex = idx;

    var allIds = this._modeSlideIds || [];
    var i, el, on;
    for (i = 0; i < allIds.length; i++) {
        el = document.getElementById(allIds[i]);
        if (!el) continue;
        on = slides[idx] && el.id === slides[idx].id;
        if (on) el.classList.add('on');
        else el.classList.remove('on');
    }

    if (dots) {
        dots.innerHTML = '';
        for (i = 0; i < slides.length; i++) {
            el = document.createElement('i');
            if (i === idx) el.className = 'on';
            el.setAttribute('data-idx', String(i));
            dots.appendChild(el);
            if (window.UiTouch && window.UiTouch.bindTap) {
                (function(dotEl, dotIndex, owner) {
                    window.UiTouch.bindTap(dotEl, function() { owner._goModeSlide(dotIndex); });
                })(el, i, this);
            }
        }
    }
};

CharacterSelect.prototype._goModeSlide = function(index) {
    var slides = this._getVisibleModeSlides();
    if (!slides.length) return;
    var n = slides.length;
    var idx = ((index % n) + n) % n;
    this._syncModeDeck(idx);
};

CharacterSelect.prototype._bindModeDeck = function() {
    var self = this;
    this._modeSlideIds = ['btn-mode-pve', 'btn-mode-3v3', 'btn-mode-knockout', 'btn-mode-ffa'];
    this._modeDeckIndex = 0;

    if (window.UiTouch && window.UiTouch.bindTap) {
        var prev = document.getElementById('mode-prev');
        var next = document.getElementById('mode-next');
        if (prev) window.UiTouch.bindTap(prev, function() { self._goModeSlide((self._modeDeckIndex || 0) - 1); });
        if (next) window.UiTouch.bindTap(next, function() { self._goModeSlide((self._modeDeckIndex || 0) + 1); });
    }

    var deck = document.getElementById('mode-deck');
    if (deck && !this._modeDeckSwipeBound) {
        this._modeDeckSwipeBound = true;
        var sx = 0;
        deck.addEventListener('touchstart', function(e) {
            if (!e.touches || !e.touches.length) return;
            sx = e.touches[0].clientX;
        }, false);
        deck.addEventListener('touchend', function(e) {
            if (!e.changedTouches || !e.changedTouches.length) return;
            var dx = e.changedTouches[0].clientX - sx;
            if (Math.abs(dx) > 44) self._goModeSlide((self._modeDeckIndex || 0) + (dx < 0 ? 1 : -1));
        }, false);
    }

    this._syncModeDeck(0);
};

CharacterSelect.prototype.showModeSelection = function() {
    this.currentState = 'mode';
    this.domTitle.innerText = CharacterSelect.t('hub.step.mode');
    this._setBigName(CharacterSelect.t('hub.bigname.mode'));
    this.uiPanel.setAttribute('data-step', 'mode');
    this.uiPanel.classList.remove('lobby-mode');
    this.stepNet.style.display = 'none'; this.stepBrawler.style.display = 'none';
    this.stepMode.style.display = 'flex'; this.stepRoomLobby.style.display = 'none';
    if (this.createPromptOverlay) this.createPromptOverlay.style.display = 'none';
    this._setBackSlot('top-left');
    this._setHubStage('mode');
    this._refreshRogueBestUi();
};

CharacterSelect.prototype.showRoomLobby = function() {
    this.currentState = 'room_lobby';
    this.domTitle.innerText = CharacterSelect.t('hub.step.lobby');
    this._setBigName(null);
    this.uiPanel.setAttribute('data-step', 'room');
    this.uiPanel.classList.add('lobby-mode');
    this.stepNet.style.display = 'none'; this.stepBrawler.style.display = 'none';
    this.stepMode.style.display = 'none'; this.stepRoomLobby.style.display = 'flex';
    this.matchOverlay.style.display = 'none';
    if (this.createPromptOverlay) this.createPromptOverlay.style.display = 'none';
    this._setBackSlot('top-left');
    this._setHubStage('room');
};

CharacterSelect.prototype._isSelectedUnlocked = function() {
    var pm = this.app.progressionManager;
    if (!pm) return true;
    return pm.isUnlocked(this.selectedBrawler || this.selection.brawler);
};

// 出陣鈕：已解鎖＝「出陣」；未解鎖＝「未解鎖」（點下去走購買／確認）
CharacterSelect.prototype._refreshPlayButton = function() {
    var btn = document.getElementById('btn-play');
    if (!btn) return;
    var unlocked = this._isSelectedUnlocked();
    var label;
    if (!unlocked) {
        label = CharacterSelect.t('hub.play.locked');
    } else if (this._pendingRoomAction === 'create_room') {
        label = CharacterSelect.t('hub.play.createRoom');
    } else if (this._pendingRoomAction === 'join_room') {
        label = CharacterSelect.t('hub.play.joinRoom');
    } else {
        label = CharacterSelect.t('hub.play');
    }
    btn.innerText = label;
    if (unlocked) btn.classList.remove('cs-play-locked');
    else btn.classList.add('cs-play-locked');
};

CharacterSelect.prototype._onPlayButton = function() {
    if (!this._isSelectedUnlocked()) {
        this._tryUnlockCharacter(this.selectedBrawler || this.selection.brawler);
        return;
    }
    if (this._pendingRoomAction === 'create_room') {
        this.dispatchOrder('create_room');
        return;
    }
    if (this._pendingRoomAction === 'join_room') {
        this.dispatchOrder('join_room', this._pendingRoomCode || '');
        return;
    }
    this.dispatchOrder('matchmaking');
};

CharacterSelect.prototype.dispatchOrder = function(actionType, roomCode) {
    // 🌟 防護：未解鎖不能進遊戲（開解鎖流程，不再偷偷換角）
    var pm = this.app.progressionManager;
    if (pm && !pm.isUnlocked(this.selection.brawler)) {
        this._tryUnlockCharacter(this.selection.brawler);
        return;
    }

    var finalName = this.nameInput.value.trim();
    if (finalName === '') finalName = 'Fighter_' + Math.floor(Math.random() * 9999);
    finalName = finalName.toUpperCase();
    
    localStorage.setItem('fk_player_name', finalName);
    this.selection.playerName = finalName;
    if (typeof this.selection.skinKey !== 'string') this.selection.skinKey = '';
    if (pm) {
        var activeSkin = this.selection.skinKey || '';
        if (activeSkin && !pm.isSkinUnlocked(activeSkin)) {
            this.selection.skinKey = '';
            if (this.skinSelect) this.skinSelect.value = '';
        }
    }
    this.app.playerName = finalName;
    if (this.app.progressionManager) this.app.progressionManager.setDisplayName(finalName);

    if (this.selection.isMultiplayer) {
        if (actionType === 'matchmaking') {
            this.currentState = 'matchmaking';
            this.matchOverlay.style.display = 'flex';
            this.matchText.innerText = CharacterSelect.t('hub.match.connecting'); 
            document.getElementById('btn-cancel-match').style.display = 'block';
            this.app.fire('network:requestJoin', this.selection);
        } 
        else if (actionType === 'create_room') {
            this.matchOverlay.style.display = 'flex';
            this.matchText.innerText = CharacterSelect.t('hub.room.creating'); 
            document.getElementById('btn-cancel-match').style.display = 'none';
            this.app.fire('network:createRoom', this.selection);
        }
        else if (actionType === 'join_room') {
            this.matchOverlay.style.display = 'flex';
            this.matchText.innerText = CharacterSelect.t('hub.room.joining'); 
            document.getElementById('btn-cancel-match').style.display = 'none';
            this.app.fire('network:joinRoom', this.selection, roomCode);
        }
    } else {
        // 新開 Rogue：清掉舊斷點，避免與「繼續」混淆
        if (String(this.selection.mode || '').toUpperCase() === 'ROGUE' && !this.app._rogueResumeCheckpoint) {
            this._clearRogueCheckpoint();
        }
        this.currentState = 'hidden';
        this._startGame(); 
    }
};

CharacterSelect.prototype._applyPreviewScale = function(entity, brawlerType) {
    if (!entity) return;
    var meta = this.brawlerData[brawlerType] || {};
    var scaleMul = meta.previewScale !== undefined ? meta.previewScale : this.previewScale;
    var scaleKey = entity._skinPreviewKey || brawlerType;
    var orig = this.origScales[scaleKey] || this.origScales[brawlerType];

    if (meta.previewUseOrigScale && orig) {
        entity.setLocalScale(orig.x * scaleMul, orig.y * scaleMul, orig.z * scaleMul);
    } else {
        entity.setLocalScale(scaleMul, scaleMul, scaleMul);
    }
};

CharacterSelect.prototype._buildSkinPreviewMap = function() {
    var out = {};
    if (!window.BrawlerConfig) return out;

    for (var brawlerType in window.BrawlerConfig) {
        var cfg = window.BrawlerConfig[brawlerType];
        var skins = cfg && cfg.skins;
        if (!Array.isArray(skins)) continue;

        for (var i = 0; i < skins.length; i++) {
            var skin = skins[i];
            if (!skin || typeof skin === 'string' || !skin.key || !skin.previewEntity) continue;

            var entity = null;
            if (this.skinPreviewRoot && this.skinPreviewRoot.findByName) {
                entity = this.skinPreviewRoot.findByName(skin.previewEntity);
            }
            if (!entity && this.app && this.app.root) {
                entity = this.app.root.findByName(skin.previewEntity);
            }
            if (!entity) continue;

            entity._skinPreviewKey = skin.key;
            out[skin.key] = entity;
        }
    }

    return out;
};

CharacterSelect.prototype._getActivePreviewModel = function() {
    var skinKey = this.selection.skinKey || '';
    if (skinKey && this.skinPreviewModels[skinKey]) return this.skinPreviewModels[skinKey];
    return this.models[this.selectedBrawler || this.selection.brawler];
};

CharacterSelect.prototype._hideAllPreviewModels = function() {
    for (var key in this.models) {
        if (this.models[key]) this.models[key].enabled = false;
    }
    for (var skinKey in this.skinPreviewModels) {
        if (this.skinPreviewModels[skinKey]) this.skinPreviewModels[skinKey].enabled = false;
    }
};

CharacterSelect.prototype._refreshPreviewModel = function() {
    var brawlerType = this.selectedBrawler || this.selection.brawler;
    this._hideAllPreviewModels();

    if (this.currentState !== 'brawler') return;

    var activeModel = this._getActivePreviewModel();
    if (!activeModel) return;

    activeModel.enabled = true;

    if (this._setPreviewCastShadows) {
        this._setPreviewCastShadows(activeModel, true);
    }

    this._applyPreviewScale(activeModel, brawlerType);
    activeModel.setLocalEulerAngles(0, this.charRotationY, 0);
    if (activeModel.anim) activeModel.anim.setTrigger('attack');
};

CharacterSelect.prototype._getSkinOptions = function(brawlerType) {
    var cfg = (window.BrawlerConfig && window.BrawlerConfig[brawlerType]) || {};
    var skins = cfg.skins;
    if (!Array.isArray(skins) || skins.length === 0) return [];
    var list = [];
    for (var i = 0; i < skins.length; i++) {
        var s = skins[i];
        if (typeof s === 'string') {
            list.push({ key: s, label: s, previewEntity: s });
            continue;
        }
        if (!s || !s.key) continue;
        list.push({ key: s.key, label: s.label || s.name || s.key, previewEntity: s.previewEntity || '' });
    }
    return list;
};

CharacterSelect.prototype._refreshSkinOptions = function(brawlerType) {
    if (!this.skinSelect) return;
    var t = CharacterSelect.t;
    var pm = this.app.progressionManager;
    var label = document.getElementById('cs-skin-label');
    if (label) label.textContent = t('hub.form.label');
    var options = this._getSkinOptions(brawlerType);
    var prev = this.selection.skinKey || '';
    this.skinSelect.innerHTML = '';

    var defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = t('hub.form.awakened');
    this.skinSelect.appendChild(defaultOpt);

    for (var i = 0; i < options.length; i++) {
        var opt = document.createElement('option');
        opt.value = options[i].key;
        var locked = pm ? !pm.isSkinUnlocked(options[i].key) : false;
        opt.textContent = t('hub.form.origin') + (locked ? (' — ' + t('hub.form.locked')) : '');
        this.skinSelect.appendChild(opt);
    }

    var valid = false;
    if (prev) {
        for (var j = 0; j < options.length; j++) {
            if (options[j].key === prev) { valid = true; break; }
        }
    }
    this.selection.skinKey = valid ? prev : '';
    this.skinSelect.value = this.selection.skinKey;
    this._refreshSkinLockUi();
};

CharacterSelect.prototype._refreshSkinLockUi = function() {
    var panel = this.skinLockPanel;
    var labelEl = this.skinLockLabel;
    var btn = this.skinUnlockBtn;
    if (!panel || !labelEl) return;

    var skinKey = this.selection.skinKey || '';
    var pm = this.app.progressionManager;
    var t = CharacterSelect.t;

    if (!skinKey || !pm || pm.isSkinUnlocked(skinKey)) {
        panel.classList.remove('is-visible');
        if (btn) btn.style.display = 'none';
        return;
    }

    var info = pm.getSkinUnlockInfo(skinKey);
    var lines = [t('hub.form.origin') + ' — ' + t('hub.form.locked')];
    var canBuyCoins = info.cost > 0;

    if (info.rogueWave > 0 && pm.getRogueBestWave() < info.rogueWave) {
        lines.push(t('hub.form.rogueWaveReq', { n: info.rogueWave }));
    }
    if (canBuyCoins) {
        if (pm.getLevel() < info.levelReq) {
            lines.push(t('hub.unlock.needLevel', { n: info.levelReq, name: t('hub.form.origin') }));
        } else {
            lines.push('🪙 ' + info.cost);
        }
    }

    labelEl.textContent = lines.join('\n');
    panel.classList.add('is-visible');

    if (!btn) return;
    var showBtn = canBuyCoins && pm.getLevel() >= info.levelReq;
    if (showBtn) {
        btn.style.display = 'inline-block';
        btn.textContent = t('hub.form.unlockOrigin') + ' (🪙 ' + info.cost + ')';
    } else {
        btn.style.display = 'none';
    }
};

CharacterSelect.prototype._tryUnlockSkin = function(skinKey) {
    var pm = this.app.progressionManager;
    if (!pm || !skinKey) return;

    var t = CharacterSelect.t;
    var name = t('hub.form.origin');
    var info = pm.getSkinUnlockInfo(skinKey);

    if (info.rogueWave > 0 && pm.getRogueBestWave() < info.rogueWave) {
        this._showUnlockToast(t('hub.form.rogueWaveReq', { n: info.rogueWave }), false);
        return;
    }

    if (!info.cost) {
        this._showUnlockToast(t('hub.unlock.fail'), false);
        return;
    }

    if (pm.getLevel() < info.levelReq) {
        this._showUnlockToast(t('hub.unlock.needLevel', { n: info.levelReq, name: name }), false);
        return;
    }
    if (pm.getCoins() < info.cost) {
        this._showUnlockToast(t('hub.unlock.needCoins', { cost: info.cost, have: pm.getCoins() }), false);
        return;
    }

    this._showSkinUnlockConfirm(skinKey, name, info.cost);
};

CharacterSelect.prototype._showSkinUnlockConfirm = function(skinKey, name, cost) {
    var self = this;
    var t = CharacterSelect.t;
    var old = document.getElementById('unlock-confirm');
    if (old) old.remove();

    var overlay = document.createElement('div');
    overlay.id = 'unlock-confirm';
    overlay.className = 'tk-modal-overlay open';
    overlay.style.zIndex = '8000';
    overlay.setAttribute('data-ui-interactive', '');

    overlay.innerHTML =
        '<div class="unlock-dialog tk-panel">' +
        '<div class="ud-title">' + t('hub.form.skinUnlockTitle') + '</div>' +
        '<div class="ud-name">' + name + '</div>' +
        '<div class="ud-cost">🪙 ' + cost + '</div>' +
        '<div class="ud-btns">' +
        '<button class="ud-btn ud-cancel">' + t('hub.unlock.cancel') + '</button>' +
        '<button class="ud-btn ud-confirm">' + t('hub.unlock.confirm') + '</button>' +
        '</div></div>';

    document.body.appendChild(overlay);
    this._disableHubTextChrome(overlay);

    var close = function() { overlay.remove(); };
    window.UiTouch.markRoot(overlay);
    window.UiTouch.bindTap(overlay.querySelector('.ud-cancel'), close);

    var doConfirm = function(e) {
        if (e) e.preventDefault();
        var pm = self.app.progressionManager;
        var result = pm.tryPurchaseSkin(skinKey);
        close();
        if (result.success) {
            self._showUnlockToast(t('hub.unlock.success', { name: name }), true);
            self._refreshSkinOptions(self.selectedBrawler || self.selection.brawler);
            self._refreshPreviewModel();
            self._refreshSkinLockUi();
        } else {
            self._showUnlockToast(t('hub.unlock.fail'), false);
        }
    };
    window.UiTouch.bindTap(overlay.querySelector('.ud-confirm'), doConfirm);
};

CharacterSelect.prototype._selectCharacter = function(brawlerType) {
    // 未解鎖也可 preview；能否出陣由 play 鈕／dispatchOrder 把關
    this.selectedBrawler = brawlerType;
    this.selection.brawler = brawlerType;
    this._refreshSkinOptions(brawlerType);
    this._refreshPreviewModel();

    this._updateCharInfo(brawlerType);
    this._refreshPlayButton();
};

// 🌟 更新選角資訊(v2):名牌/印章/數值條/技能 chip
//    HP 以名單最高血量正規化；速度以名單區間正規化；DPS = 一套普攻估計總傷 / 循環時間
CharacterSelect.prototype._estimateHitDamage = function(hitConf, rootCfg) {
    var dmg = hitConf.bulletDamage || rootCfg.bulletDamage || 0;
    if (hitConf.explodeDamage) dmg = Math.max(dmg, hitConf.explodeDamage);
    var pattern = hitConf.attackPattern || rootCfg.attackPattern || '';
    var proj = hitConf.projectileCount || hitConf.spreadCount || 1;
    var burst = 1;
    if ((pattern === 'burst' || pattern === 'flamethrower') && hitConf.burstCount) {
        burst = hitConf.burstCount;
    }
    dmg *= proj * burst;
    if (hitConf.extraAttacks) {
        for (var e = 0; e < hitConf.extraAttacks.length; e++) {
            dmg += this._estimateHitDamage(hitConf.extraAttacks[e], rootCfg);
        }
    }
    return dmg;
};

CharacterSelect.prototype._estimateHitCycleTime = function(hitConf, rootCfg) {
    var t = (hitConf.fireDelay || rootCfg.fireDelay || 0) + (hitConf.shootCooldown || rootCfg.shootCooldown || 0.4);
    var pattern = hitConf.attackPattern || rootCfg.attackPattern || '';
    var burst = 1;
    if ((pattern === 'burst' || pattern === 'flamethrower') && hitConf.burstCount) {
        burst = hitConf.burstCount;
    }
    if (burst > 1) {
        t += (burst - 1) * (hitConf.burstInterval || rootCfg.burstInterval || 0.08);
    }
    return t;
};

CharacterSelect.prototype._computeReferenceDps = function(cfg) {
    if (!cfg) return 0;
    var totalDmg = 0;
    var cycleTime = 0;
    var combo = cfg.comboOverrides;
    if (combo && combo.length) {
        for (var i = 0; i < combo.length; i++) {
            var hit = Object.assign({}, cfg, combo[i]);
            totalDmg += this._estimateHitDamage(hit, cfg);
            cycleTime += this._estimateHitCycleTime(hit, cfg);
        }
        cycleTime += cfg.reloadTime || 0;
    } else {
        totalDmg = this._estimateHitDamage(cfg, cfg);
        var shots = cfg.ammo || 1;
        cycleTime = ((cfg.fireDelay || 0) + (cfg.shootCooldown || 0.4)) * shots + (cfg.reloadTime || 0);
        totalDmg *= shots;
    }
    return cycleTime > 0 ? totalDmg / cycleTime : 0;
};

CharacterSelect.prototype._updateCharInfo = function(brawlerType) {
    var cfg = (window.BrawlerConfig && window.BrawlerConfig[brawlerType]) || {};
    var meta = this.brawlerData[brawlerType] || {};
    var BC = window.BrawlerConfig;
    var isEn = !!(BC && BC._isEn && BC._isEn());

    var set = function(id, txt) { var el = document.getElementById(id); if (el) el.innerText = txt; };

    var displayName = (BC && BC.getDisplayName) ? BC.getDisplayName(brawlerType)
        : (isEn && meta.en ? meta.en : (meta.zh || meta.name || brawlerType));
    var title = (BC && BC.getSelectTitle) ? BC.getSelectTitle(brawlerType)
        : (isEn && meta.titleEn ? meta.titleEn : (meta.title || ''));

    set('cs-name', displayName);
    // 雕空大字維持漢字（對外語玩家更有三國感；面板名／稱號仍跟語系）
    if (this.currentState === 'brawler') this._setBigName(meta.zh || (cfg.select && cfg.select.zh) || '');
    set('cs-title', title);

    // 勢力印章 + 蓋章動效（朱印色 = faction token；印文維持漢字）
    var sealChar = { wei: '魏', shu: '蜀', wu: '吳', qun: '群' }[meta.faction] || '？';
    var seal = document.getElementById('cs-seal');
    if (seal) {
        seal.innerText = sealChar;
        var fColor = this.factionColors[meta.faction] || '#c9a25a';
        seal.style.setProperty('--cs-faction-color', fColor);
        seal.setAttribute('data-faction', meta.faction || '');
        seal.classList.remove('stamp'); void seal.offsetWidth; seal.classList.add('stamp');
    }

    // 名牌旁數字屬性（無 bar）
    var hp = cfg.health || 0;
    var spd = cfg.speed || 0;
    var dps = Math.round(this._computeReferenceDps(cfg));
    set('cs-v-hp', hp || '—');
    set('cs-v-atk', dps || '—');
    set('cs-v-spd', spd ? (Math.round(spd * 10) / 10) : '—');

    // 簡介分頁：背景 + 技能（可依 skin 覆寫；無則退回角色預設）
    var skinKey = this.selection.skinKey || '';
    var bio = (BC && BC.getDescription) ? BC.getDescription(brawlerType, skinKey)
        : (isEn && cfg.descriptionEn ? cfg.descriptionEn : (cfg.description || ''));
    set('cs-bio', bio || CharacterSelect.t('hub.abil.tbd'));

    var superDesc = (BC && BC.getSuperDesc) ? BC.getSuperDesc(brawlerType, skinKey)
        : ((cfg.super && cfg.super.desc) ? cfg.super.desc : '');
    var atkDesc = (BC && BC.getAttackDesc) ? BC.getAttackDesc(brawlerType, skinKey)
        : ((isEn && cfg.attackDescEn) ? cfg.attackDescEn : (cfg.attackDesc || ''));
    set('cs-ab-super', superDesc || CharacterSelect.t('hub.abil.tbd'));
    set('cs-ab-atk', atkDesc || CharacterSelect.t('hub.abil.tbd'));
};

// 數值條動畫:歸零 → 充能
CharacterSelect.prototype._setStatBar = function(fillId, valId, pct, valText) {
    var f = document.getElementById(fillId), v = document.getElementById(valId);
    if (f) {
        f.style.transition = 'none'; f.style.width = '0';
        void f.offsetWidth;
        f.style.transition = ''; f.style.width = pct + '%';
    }
    if (v) v.innerText = valText;
};

CharacterSelect.prototype._maybePromptTutorialFirstEntry = function() {
    var self = this;
    var pm = this.app.progressionManager;
    if (!pm || typeof pm.isTutorialDone !== 'function') {
        this.app.once('progression:ready', function() {
            self._maybePromptTutorialFirstEntry();
        });
        return;
    }
    if (pm.isTutorialDone()) return;

    var seenKey = 'tk_tutorial_first_prompt_seen_v1';
    if (localStorage.getItem(seenKey) === '1') return;
    localStorage.setItem(seenKey, '1');

    this._showTutorialFirstPrompt();
};

CharacterSelect.prototype._showTutorialFirstPrompt = function() {
    var old = document.getElementById('tutorial-first-overlay');
    if (old) old.remove();

    var ov = document.createElement('div');
    ov.id = 'tutorial-first-overlay';
    ov.setAttribute('data-ui-interactive', '');
    ov.style.cssText = [
        'position:fixed',
        'inset:0',
        'z-index:9800',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'background:rgba(0,0,0,0.62)'
    ].join(';');

    var t = CharacterSelect.t;
    ov.innerHTML =
        '<div style="width:min(92vw,420px);background:rgba(16,12,10,0.95);border:1px solid rgba(220,180,100,0.45);border-radius:16px;padding:22px 20px;color:#f3e6d0;text-align:center;font-family:var(--tk-font-body),system-ui,sans-serif;">' +
        '<div style="font-size:22px;font-weight:900;color:#f0d080;margin-bottom:10px;">' + t('hub.tutorialFirst.title') + '</div>' +
        '<div style="font-size:14px;line-height:1.5;margin-bottom:16px;">' + t('hub.tutorialFirst.body') + '</div>' +
        '<button type="button" id="btn-first-tutorial-start" style="width:100%;padding:10px 12px;border:0;border-radius:10px;background:linear-gradient(180deg,#e8c56a,#c9942e);color:#2a1a08;font-weight:800;cursor:pointer;">' + t('hub.tutorialFirst.start') + '</button>' +
        '<button type="button" id="btn-first-tutorial-skip" style="width:100%;margin-top:10px;padding:10px 12px;border:1px solid rgba(220,180,100,0.45);border-radius:10px;background:transparent;color:#f0d080;font-weight:700;cursor:pointer;">' + t('hub.tutorialFirst.skip') + '</button>' +
        '</div>';
    document.body.appendChild(ov);

    var self = this;
    var bindTap = function(id, fn) {
        var el = document.getElementById(id);
        if (!el) return;
        if (window.UiTouch && window.UiTouch.bindTap) {
            window.UiTouch.bindTap(el, fn);
        } else {
            el.addEventListener('click', fn);
        }
    };

    bindTap('btn-first-tutorial-start', function(e) {
        if (e && e.preventDefault) e.preventDefault();
        var cur = document.getElementById('tutorial-first-overlay');
        if (cur && cur.parentNode) cur.parentNode.removeChild(cur);
        self.app._forceTutorialRun = true;
        self.app._tutorialEntry = 'lobby_help';
        self.selection.isMultiplayer = false;
        self.selection.mode = 'ROGUE';
        self.selection.brawler = (window.TutorialConfig && window.TutorialConfig.heroBrawlerType) || 'guanyu';
        self.selection.skinKey = '';
        self.selectedBrawler = self.selection.brawler;
        self.currentState = 'hidden';
        self._startGame();
    });

    bindTap('btn-first-tutorial-skip', function(e) {
        if (e && e.preventDefault) e.preventDefault();
        var cur = document.getElementById('tutorial-first-overlay');
        if (cur && cur.parentNode) cur.parentNode.removeChild(cur);
    });
};

CharacterSelect.prototype._startGame = function() {
    if (this.uiRoot) this.uiRoot.style.display = 'none';
    var pb = document.getElementById('prog-bar');   // 🌟 進遊戲隱藏養成列
    if (pb) pb.style.display = 'none';
    var pfo = document.getElementById('profile-overlay');   // 🌟 關閉檔案彈窗
    if (pfo) pfo.remove();
    for (var key in this.models) {
        if (this.models[key]) {
            this.models[key].enabled = false;
            if (this.origScales[key]) this.models[key].setLocalScale(this.origScales[key]);
            this.models[key].setLocalEulerAngles(0, 0, 0); 
        }
    }

    if (this.useSelectCam) {
        this.hubCam.enabled = false;
        if (this.hubCam.camera) this.hubCam.camera.enabled = false;
    } else if (this.mainCamera) {
        // fallback:還原被搬動/改色的唯一相機
        this.mainCamera.setLocalPosition(this.origCamPos);
        this.mainCamera.setLocalEulerAngles(this.origCamRot);
        if (this.mainCamera.camera && this.origClearColor) this.mainCamera.camera.clearColor = this.origClearColor;
    }
    // 權威戰鬥相機：優先 cameraFollow 實體（避免 battleCamera 屬性未接／名稱衝突）
    var battleCam = (this.app.cameraFollow && this.app.cameraFollow.entity) || this.mainCamera;
    if (battleCam) {
        this.mainCamera = battleCam;
        battleCam.enabled = true;
        if (battleCam.camera) battleCam.camera.enabled = true;
    }
    if (this.app.updateCanvasSize) this.app.updateCanvasSize();
    if (this.app.resizeCanvas) this.app.resizeCanvas();
    // ==========================================
    // 選角結束：關掉 realtime，立刻 THISFRAME bake
    this._setHubShadowRealtime(false);
    if (this.app.gameModeManager && this.app.gameModeManager._refreshShadowMapOnce) {
        this.app.gameModeManager._refreshShadowMapOnce();
    }

    if (!this.selection.isMultiplayer) {
        if (this.app.networkManager) {
            this.app.networkManager._onCancelMatchmaking();
        }
    }
    this.app.fire('game:start', this.selection);
};

CharacterSelect.prototype._onMatchmakingStatus = function(data) {
    if (this.currentState !== 'matchmaking') return;
    var t = CharacterSelect.t;
    this.matchText.innerHTML = t('hub.match.progress', { n: data.players }) +
        '<br><span style="font-size:32px; color:#AAA; font-family: \'Microsoft JhengHei\', sans-serif;">' +
        t('hub.match.team', { team: data.team }) + '</span>';
};

CharacterSelect.prototype._onMatchFound = function(data) {
    if (this.currentState === 'hidden') return; 
    if (data && data.mode) this.selection.mode = data.mode; 
    
    this.matchOverlay.style.display = 'flex'; 
    this.matchText.innerHTML = CharacterSelect.t('hub.match.found');
    this.matchText.style.color = "#4CAF50";
    
    var cancelBtn = document.getElementById('btn-cancel-match');
    if (cancelBtn) cancelBtn.style.display = 'none';
    
    var self = this;
    setTimeout(function() {
        self.currentState = 'hidden';
        self._startGame(); 
        self.app.fire('network:clientReady'); 
    }, 1500);
};

CharacterSelect.prototype._onRoomCreated = function(data) {
    this.currentRoomId = data.roomId;
    this.isRoomHost = true;
    this._pendingRoomAction = null;
    this._pendingRoomCode = '';
    if (data.mode) this.selection.mode = data.mode;

    document.getElementById('display-room-code').innerText = data.roomId;
    document.getElementById('display-room-mode').innerText = CharacterSelect.t('hub.room.modeLabel', {
        mode: CharacterSelect.modeLabel(data.mode || '3V3_BOUNTY')
    });
    document.getElementById('btn-start-room').style.display = 'block';
    document.getElementById('room-wait-text').style.display = 'none';
    this.showRoomLobby();
};

CharacterSelect.prototype._onRoomJoined = function(data) {
    this.currentRoomId = data.roomId;
    this.isRoomHost = false;
    this._pendingRoomAction = null;
    this._pendingRoomCode = '';
    if (data.mode) this.selection.mode = data.mode;

    document.getElementById('display-room-code').innerText = data.roomId;
    document.getElementById('display-room-mode').innerText = CharacterSelect.t('hub.room.modeLabel', {
        mode: CharacterSelect.modeLabel(data.mode || '3V3_BOUNTY')
    });
    document.getElementById('btn-start-room').style.display = 'none';
    document.getElementById('room-wait-text').style.display = 'block';
    this.showRoomLobby();
};

CharacterSelect.prototype._onRoomUpdate = function(data) {
    var listContainer = document.getElementById('room-player-list');
    listContainer.innerHTML = '';
    
    for (var i = 0; i < data.players.length; i++) {
        var p = data.players[i];
        var brawlerData = this.brawlerData[p.brawler] || { name: p.brawler, color: '#FFF' };
        
        var isMe = (p.id === this.app.socketId);
        var team = (p.team === 'red' || p.team === 'blue') ? p.team : 'none';
        
        var item = document.createElement('div');
        item.className = 'player-item team-' + team + (isMe ? ' is-me' : '') + (p.isHost ? ' is-host' : '');
        
        var brawlerLabel = this._brawlerLabel(p.brawler) || brawlerData.name;
        var hostMark = p.isHost ? '<span class="player-host-mark" aria-hidden="true">主</span>' : '';
        item.innerHTML =
            '<div class="player-item-main">' +
                hostMark +
                '<span class="player-item-name">' + (p.name || '') + '</span>' +
                (isMe ? '<span class="player-item-you">YOU</span>' : '') +
            '</div>' +
            '<span class="player-item-brawler" style="color:' + (brawlerData.color || 'var(--gold)') + ';">' + brawlerLabel + '</span>';
        listContainer.appendChild(item);
    }
};

CharacterSelect.prototype._onRoomError = function(message) {
    this.matchOverlay.style.display = 'none';
    if (this._pendingRoomAction === 'create_room' || this._pendingRoomAction === 'join_room') {
        this._showUnlockToast(message, false);
        this.showBrawlerSelection();
        return;
    }
    this.showModeSelection();
    this.joinErrorMsg.innerText = message;
    this.joinPromptOverlay.style.display = 'flex';
};