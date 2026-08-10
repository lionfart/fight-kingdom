var InputManager = pc.createScript('inputManager');

// --- 參數設定 ---
InputManager.attributes.add('tapTime', { type: 'number', default: 0.2, title: '最大點擊時間 (秒)' });
InputManager.attributes.add('doubleTapTime', { type: 'number', default: 0.25, title: '鍵盤雙擊翻滾時間 (秒)' });
InputManager.attributes.add('dragDeadZone', { type: 'number', default: 8, title: '極限起步死區 (px)' });
InputManager.attributes.add('virtualRange', { type: 'number', default: 70, title: '虛擬搖桿靈敏半徑 (px)' });

InputManager.UI_SELECTOR =
    'button, a, input, textarea, select, label, option, ' +
    '[role="button"], [data-ui-interactive], [contenteditable="true"], ' +
    '#fk-ui-root, #profile-overlay, #pf-legal-overlay, #cloud-save-modal, ' +
    '#rogue-hud, #rogue-card-overlay, #rogue-overlay, #join-prompt-overlay, #create-prompt-overlay, ' +
    '#help-overlay, #prog-bar, #unlock-confirm, #dom-end-screen, #ffa-death-choice, ' +
    '#gs-overlay, #gs-gear, #super-btn, #lock-cycle-btn, .ui-panel, .rg-card, .rg-chip, .csm-box, .unlock-dialog';

InputManager.prototype._isUiTouchTarget = function (target) {
    if (window.UiTouch && window.UiTouch.isInteractiveTarget) {
        return window.UiTouch.isInteractiveTarget(target);
    }
    if (!target || !target.closest) return false;
    return !!target.closest(InputManager.UI_SELECTOR);
};

/** 開場 preview／宣傳／選卡鎖定：禁止移動與攻擊指令 */
InputManager.prototype._isCombatInputBlocked = function () {
    var gs = this.app.gameState;
    return !!this._inputLocked || gs === 'intro' || gs === 'promo';
};

InputManager.prototype._clearCombatInput = function () {
    this._resetTouchState();
    this.moveX = 0;
    this.moveZ = 0;
    this._rawMoveX = 0;
    this._rawMoveZ = 0;
    this._smoothMoveX = 0;
    this._smoothMoveZ = 0;
    this.attackCommand = null;
};

InputManager.prototype.initialize = function () {
    this.moveX = 0;
    this.moveZ = 0;
    this.attackCommand = null;

    // 🌟 回歸單手操作系統：所有輸入皆由這根手指完成
    this._primaryTouchId = null;
    this._touchState = 'idle'; // 'idle', 'checking', 'moving'

    this._originX = 0; 
    this._originY = 0; 
    this._currentX = 0;
    this._currentY = 0;
    this._startTime = 0;
    this._posHistory = []; 
    
    this._isGameActive = false; 
    this._inputLocked = false;
    this._isSuperReady = false; 
    this.app.inputManager = this;

    this._rawMoveX = 0;
    this._rawMoveZ = 0;
    this._smoothMoveX = 0;
    this._smoothMoveZ = 0;
    this._lerpSpeed = 20; 

    this.lastKey = null;
    this.lastKeyTime = 0;

    this._historyGuardOn = false;
    this._gestureGuardOn = false;
    this._spaceGuardOn = false;
    this._onPopState = null;
    this._onGestureStart = null;
    this._onSpaceKeyDown = null;
    this._onEdgeCapture = null;
    this._onNavigate = null;
    this._lastBackAt = 0;
    this._backHandledAt = 0;
    this._backConfirmMs = 2000;

    this._createProceduralUI();

    this._appEventHandlers = {
        'game:start': function() {
            this._isGameActive = true;
            // SP 鍵：未滿不顯示；若開局已滿（罕見）則由 setSuperReady 同步顯示
            this._syncSuperBtnPresentation();
            this._syncLockCycleBtnPresentation();
            this._setGameplayTouchGuard(true);
        }.bind(this),
        'game:end': function() {
            this._isGameActive = false;
            this.setSuperReady(false);
            this._syncLockCycleBtnPresentation();
            this._setGameplayTouchGuard(false);
            this._clearCombatInput();
        }.bind(this),
        'game:introStart': function() {
            // 開場 3 秒 preview：清掉殘留點擊，避免倒數中出招；換鎖鍵一併隱藏
            this._clearCombatInput();
            this._syncLockCycleBtnPresentation();
        }.bind(this),
        'rogue:inputLock': function(locked) {
            // 🎲 選強化卡期間鎖定輸入:清空觸控／攻擊／移動,避免解凍後 stale 方向殘留
            this._inputLocked = !!locked;
            if (locked) this._clearCombatInput();
            this._syncLockCycleBtnPresentation();
            // 鎖定期間同步無敵；解鎖給短暫 grace，避免殘彈在解鎖當幀打死玩家
            var pCtrl = this.app.playerController;
            if (pCtrl) {
                if (locked) {
                    pCtrl._invincible = true;
                    pCtrl.invincibleTimer = Math.max(pCtrl.invincibleTimer || 0, 999);
                } else {
                    pCtrl._invincible = true;
                    pCtrl.invincibleTimer = 0.45; // 覆蓋鎖定時的長計時，只保留短暫 grace
                }
            }
        }.bind(this),
        'aim:setMode': function() {
            this._syncLockCycleBtnPresentation();
            this._refreshLockCycleBtnLabel();
        }.bind(this),
        'tk:langChanged': function() {
            this._refreshLockCycleBtnLabel();
        }.bind(this)
    };
    for (var evt in this._appEventHandlers) this.app.on(evt, this._appEventHandlers[evt]);

    this._handlers = {
        touchstart: this._onTouchStart.bind(this),
        touchmove: this._onTouchMove.bind(this),
        touchend: this._onTouchEnd.bind(this),
        contextmenu: function(e) { e.preventDefault(); }
    };

    // iPhone／平板：即使 PlayCanvas touch 裝置旗標異常也掛 window 觸控
    var wantTouch = !!(this.app.touch) || ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    this._touchListening = wantTouch;
    if (wantTouch) {
        window.addEventListener('touchstart', this._handlers.touchstart, { passive: false });
        window.addEventListener('touchmove', this._handlers.touchmove, { passive: false });
        window.addEventListener('touchend', this._handlers.touchend, false);
        window.addEventListener('touchcancel', this._handlers.touchend, false); 
    }
    if (this.app.mouse) {
        this.app.mouse.on(pc.EVENT_MOUSEDOWN, this._onMouseDown, this);
        this.app.mouse.disableContextMenu();
    }
    window.addEventListener('contextmenu', this._handlers.contextmenu);

    // 全遊戲：邊緣／系統返回需連滑兩次才離開（Android 用 hash 哨兵）
    this._setHistoryGuard(true);

    this.on('destroy', function () {
        this._setGameplayTouchGuard(false);
        this._setHistoryGuard(false);
        if (this._touchListening) {
            window.removeEventListener('touchstart', this._handlers.touchstart);
            window.removeEventListener('touchmove', this._handlers.touchmove);
            window.removeEventListener('touchend', this._handlers.touchend);
            window.removeEventListener('touchcancel', this._handlers.touchend);
        }
        if (this.app.mouse) this.app.mouse.off(pc.EVENT_MOUSEDOWN, this._onMouseDown, this);
        window.removeEventListener('contextmenu', this._handlers.contextmenu);
        for (var evt in this._appEventHandlers) this.app.off(evt, this._appEventHandlers[evt]);
        this._destroyProceduralUI();
    }, this);
};

/** 遊玩中禁止 Safari 橡皮筋／頁面捲動／捏合縮放搶手勢（history 守衛獨立於全遊戲） */
InputManager.prototype._setGameplayTouchGuard = function(on) {
    var root = document.documentElement;
    var body = document.body;
    var canvas = this.app.graphicsDevice && this.app.graphicsDevice.canvas;
    if (!root || !body) return;
    if (on) {
        root.style.touchAction = 'none';
        root.style.overflow = 'hidden';
        body.style.touchAction = 'none';
        body.style.overflow = 'hidden';
        if (canvas) {
            canvas.style.touchAction = 'none';
            canvas.style.webkitUserSelect = 'none';
            canvas.style.userSelect = 'none';
            canvas.style.webkitTouchCallout = 'none';
        }
        this._setGestureZoomGuard(true);
        this._setSpaceKeyGuard(true);
    } else {
        root.style.touchAction = '';
        root.style.overflow = '';
        body.style.touchAction = '';
        body.style.overflow = '';
        if (canvas) {
            canvas.style.touchAction = '';
            canvas.style.webkitUserSelect = '';
            canvas.style.userSelect = '';
            canvas.style.webkitTouchCallout = '';
        }
        this._setGestureZoomGuard(false);
        this._setSpaceKeyGuard(false);
    }
};

/** 對戰中擋 Space 捲動頁面（鍵盤備援普攻）；手動鎖定時擋 Tab 搶焦點 */
InputManager.prototype._setSpaceKeyGuard = function(on) {
    if (on) {
        if (this._spaceGuardOn) return;
        this._spaceGuardOn = true;
        this._onSpaceKeyDown = function(e) {
            if (!e) return;
            var code = e.code || '';
            var key = e.key || '';
            if (code === 'Space' || key === ' ' || key === 'Spacebar') {
                if (e.cancelable) e.preventDefault();
            }
            if ((code === 'Tab' || key === 'Tab') && this._isManualAimMode && this._isManualAimMode()) {
                if (e.cancelable) e.preventDefault();
            }
        }.bind(this);
        window.addEventListener('keydown', this._onSpaceKeyDown, { passive: false });
    } else {
        if (!this._spaceGuardOn) return;
        this._spaceGuardOn = false;
        if (this._onSpaceKeyDown) {
            window.removeEventListener('keydown', this._onSpaceKeyDown);
            this._onSpaceKeyDown = null;
        }
    }
};

/** 對戰中擋 iOS 雙指縮放 */
InputManager.prototype._setGestureZoomGuard = function(on) {
    if (on) {
        if (this._gestureGuardOn) return;
        this._gestureGuardOn = true;
        this._onGestureStart = function(e) {
            if (e && e.cancelable) e.preventDefault();
        };
        window.addEventListener('gesturestart', this._onGestureStart, { passive: false });
        window.addEventListener('gesturechange', this._onGestureStart, { passive: false });
    } else {
        if (!this._gestureGuardOn) return;
        this._gestureGuardOn = false;
        if (this._onGestureStart) {
            window.removeEventListener('gesturestart', this._onGestureStart);
            window.removeEventListener('gesturechange', this._onGestureStart);
            this._onGestureStart = null;
        }
    }
};

/** 取得可寫入 history 的視窗：同網域優先用 top（PlayCanvas /p/ iframe） */
InputManager.prototype._histWin = function() {
    try {
        if (window.top && window.top !== window.self) {
            void window.top.location.hostname;
            return window.top;
        }
    } catch (e) { /* cross-origin */ }
    return window;
};

/** Kendi domainimizde PlayCanvas iframe yönlendirmesi gerekmez. */
InputManager.prototype._breakOutOfPublishIframe = function() {
    return false;
};

/** Android Chrome 會合併「同 URL」的 pushState；必須改 hash 才算真正上一層 */
InputManager.prototype._guardUrl = function(hash) {
    var w = this._histWin();
    return w.location.pathname + (w.location.search || '') + hash;
};

InputManager.prototype._pushHistorySentinel = function() {
    try {
        var w = this._histWin();
        var next = (w.location.hash === '#tk') ? '#tk2' : '#tk';
        w.history.pushState({ tapKingdomGuard: true }, '', this._guardUrl(next));
    } catch (err) { /* ignore */ }
};

InputManager.prototype._showBackToast = function(msg) {
    var old = document.getElementById('tk-back-toast');
    if (old) old.remove();
    var t = document.createElement('div');
    t.id = 'tk-back-toast';
    t.textContent = msg || '再滑一次離開';
    t.style.cssText =
        'position:fixed;top:18%;left:50%;transform:translateX(-50%);z-index:9500;' +
        'background:rgba(28,21,14,0.94);color:#ffe9a8;padding:12px 22px;border-radius:10px;' +
        'font-size:16px;font-family:"Microsoft JhengHei",sans-serif;letter-spacing:0.06em;' +
        'border:1px solid rgba(201,162,90,0.55);pointer-events:none;white-space:nowrap;';
    document.body.appendChild(t);
    setTimeout(function() { if (t.parentNode) t.remove(); }, 1800);
};

InputManager.prototype._handleBackAttempt = function() {
    if (!this._historyGuardOn) return false;
    var now = Date.now();
    if (this._backHandledAt && (now - this._backHandledAt) < 80) return true;
    this._backHandledAt = now;

    var windowMs = this._backConfirmMs || 2000;
    if (this._lastBackAt && (now - this._lastBackAt) < windowMs) {
        this._allowHistoryLeave();
        return true;
    }
    this._lastBackAt = now;
    this._pushHistorySentinel();
    this._showBackToast('再滑一次離開');
    return true;
};

/** 確認離開：卸守衛後退出本頁 */
InputManager.prototype._allowHistoryLeave = function() {
    var w = this._histWin();
    this._historyGuardOn = false;
    this._lastBackAt = 0;
    if (this._onPopState) {
        w.removeEventListener('popstate', this._onPopState);
        this._onPopState = null;
    }
    if (this._onEdgeCapture) {
        document.removeEventListener('touchstart', this._onEdgeCapture, true);
        this._onEdgeCapture = null;
    }
    if (this._onNavigate) {
        var nav = w.navigation || window.navigation;
        if (nav) {
            try { nav.removeEventListener('navigate', this._onNavigate); } catch (e) { /* ignore */ }
        }
        this._onNavigate = null;
    }
    try {
        var clean = w.location.pathname + (w.location.search || '');
        w.history.replaceState(null, '', clean);
    } catch (err) { /* ignore */ }
    try {
        w.history.back();
    } catch (err2) { /* ignore */ }
};

/**
 * 全遊戲攔截瀏覽器返回：第一次擋下 + toast，2 秒內再滑一次才離開。
 * 必須在頂層視窗操作 history（/p/ iframe 內無效）。
 */
InputManager.prototype._setHistoryGuard = function(on) {
    var root = document.documentElement;
    var body = document.body;
    if (on) {
        // OAuth 回跳處理中：先別 breakout／壓 #tk，等 auth 清完再啟用
        try {
            var oh = window.location.hash || '';
            if (oh.indexOf('access_token') !== -1 || oh.indexOf('refresh_token') !== -1) {
                var self = this;
                if (!this._historyGuardDeferred) {
                    this._historyGuardDeferred = true;
                    var resume = function() {
                        self._historyGuardDeferred = false;
                        self._setHistoryGuard(true);
                    };
                    this.app.once('auth:ready', resume);
                    setTimeout(resume, 4000);
                }
                return;
            }
        } catch (eOh) { /* ignore */ }

        if (this._breakOutOfPublishIframe()) return;
        if (this._historyGuardOn) return;

        // 主畫面 App：冷啟動不塞 #tk（易空白）；邊緣攔截仍開，稍後可再補哨兵
        var skipSentinel = !!(window.UiTouch && window.UiTouch.isStandalone && window.UiTouch.isStandalone());
        this._historyGuardOn = true;
        this._lastBackAt = 0;

        var w = this._histWin();

        if (root) root.style.overscrollBehavior = 'none';
        if (body) body.style.overscrollBehavior = 'none';

        this._onPopState = function() {
            this._handleBackAttempt();
        }.bind(this);

        this._onEdgeCapture = function(e) {
            if (!this._historyGuardOn) return;
            if (!e.touches || !e.touches.length) return;
            if (this._isEdgeSwipeTouch(e.touches[0].clientX) && e.cancelable) {
                e.preventDefault();
            }
        }.bind(this);
        document.addEventListener('touchstart', this._onEdgeCapture, { passive: false, capture: true });

        var nav = w.navigation || window.navigation;
        if (nav && typeof nav.addEventListener === 'function') {
            this._onNavigate = function(event) {
                if (!this._historyGuardOn) return;
                if (event.navigationType !== 'traverse') return;
                if (!event.canIntercept) return;
                var dest = event.destination && event.destination.url;
                if (!dest) return;
                var destUrl;
                try { destUrl = new URL(dest, w.location.href); } catch (err) { return; }
                var samePath = destUrl.origin === w.location.origin
                    && destUrl.pathname === w.location.pathname;
                if (!samePath) return;

                var now = Date.now();
                var windowMs = this._backConfirmMs || 2000;
                if (this._lastBackAt && (now - this._lastBackAt) < windowMs) {
                    this._historyGuardOn = false;
                    return;
                }
                event.intercept({
                    handler: function() {
                        this._handleBackAttempt();
                    }.bind(this)
                });
            }.bind(this);
            nav.addEventListener('navigate', this._onNavigate);
        }

        if (!skipSentinel) {
            if (w.location.hash !== '#tk' && w.location.hash !== '#tk2') {
                this._pushHistorySentinel();
            }
            this._pushHistorySentinel();
        }
        w.addEventListener('popstate', this._onPopState);
        w.__tkHistoryGuard = true;
    } else {
        if (!this._historyGuardOn && !this._onPopState && !this._onEdgeCapture) return;
        var hw = this._histWin();
        this._historyGuardOn = false;
        this._lastBackAt = 0;
        hw.__tkHistoryGuard = false;
        if (this._onPopState) {
            hw.removeEventListener('popstate', this._onPopState);
            this._onPopState = null;
        }
        if (this._onEdgeCapture) {
            document.removeEventListener('touchstart', this._onEdgeCapture, true);
            this._onEdgeCapture = null;
        }
        if (this._onNavigate) {
            var navOff = hw.navigation || window.navigation;
            if (navOff) {
                try { navOff.removeEventListener('navigate', this._onNavigate); } catch (e) { /* ignore */ }
            }
            this._onNavigate = null;
        }
        if (root) root.style.overscrollBehavior = '';
        if (body) body.style.overscrollBehavior = '';
        try {
            if (hw.location.hash === '#tk' || hw.location.hash === '#tk2'
                || (hw.history.state && hw.history.state.tapKingdomGuard)) {
                var cleanOff = hw.location.pathname + (hw.location.search || '');
                hw.history.replaceState(null, '', cleanOff);
            }
        } catch (err) { /* ignore */ }
        var toast = document.getElementById('tk-back-toast');
        if (toast) toast.remove();
    }
};

/** 左右邊緣觸點：擋 Safari／Chrome 邊緣導航手勢 */
InputManager.prototype._isEdgeSwipeTouch = function(clientX) {
    var w = window.innerWidth || 0;
    if (w <= 0) return false;
    var edge = Math.max(24, w * 0.12);
    return clientX < edge || clientX > w - edge;
};

// ==========================================
// 🎨 UI 自動生成引擎 (不變)
// ==========================================
InputManager.prototype._createProceduralUI = function() {
    var uiLayer = this.app.scene.layers.getLayerById(pc.LAYERID_UI);
    this.uiScreen = new pc.Entity('InputUIScreen');
    this.uiScreen.addComponent('screen', { referenceResolution: new pc.Vec2(1280, 720), scaleMode: pc.SCALEMODE_BLEND, scaleBlend: 0.5, resolutionUpdates: true, screenSpace: true });
    this.app.root.addChild(this.uiScreen);

    this.texBase = this._generateCircleTexture('', 'rgba(26, 20, 16, 0.55)', '#c9a25a');
    this.texNub = this._generateCircleTexture('', 'rgba(201, 162, 90, 0.85)', '#f5d27a');
    this.texSupBtnReady = this._generateCircleTexture('SP', 'rgba(255, 215, 0, 0.9)'); 
    this.texSupBtnNotReady = this._generateCircleTexture('SP', 'rgba(100, 100, 100, 0.3)'); 

    var createGroup = function(name, anchor, pivot) {
        var e = new pc.Entity(name); e.addComponent('element', { type: 'group', anchor: anchor || [0, 0, 0, 0], pivot: pivot || [0, 0], layers: [uiLayer.id] }); return e;
    };
    var createImg = function(name, size, texture) {
        var e = new pc.Entity(name); e.addComponent('element', { type: 'image', anchor: [0, 0, 0, 0], pivot: [0.5, 0.5], width: size, height: size, texture: texture, useInput: false, layers: [uiLayer.id] }); return e;
    };

    this.joyGroup = createGroup('JoyGroup');
    this.uiScreen.addChild(this.joyGroup);
    this.joyBase = createImg('JoyBase', 140, this.texBase); this.joyNub = createImg('JoyNub', 50, this.texNub);
    this.joyGroup.addChild(this.joyBase); this.joyGroup.addChild(this.joyNub); this.joyGroup.enabled = false;

    // 🌟 大招鍵改 DOM（三國風 + 精準觸控防誤按）
    this._createSuperButtonDOM();
    this._createLockCycleButtonDOM();
};

// 三國風 DOM 大招鍵
InputManager.prototype._createSuperButtonDOM = function() {
    if (document.getElementById('super-btn-style')) {
        // 樣式已存在，只重建按鈕
    } else {
        var style = document.createElement('style');
        style.id = 'super-btn-style';
        style.innerHTML = `
            #super-btn {
                position: fixed; right: 28px; bottom: 90px; z-index: 4500;
                width: 92px; height: 92px; border-radius: 50%;
                display: none; align-items: center; justify-content: center;
                font-family: 'Anton','Impact',sans-serif; font-size: 30px; letter-spacing: 1px;
                color: #6b6b60; user-select: none; -webkit-user-select: none;
                touch-action: none; cursor: pointer;
                background: radial-gradient(circle at 50% 40%, #2a2018, #15100b);
                border: 2px solid #5a5046;
                box-shadow: 0 3px 8px rgba(0,0,0,0.6), inset 0 0 8px rgba(0,0,0,0.5);
                transition: transform 0.08s ease;
            }
            #super-btn.visible { display: flex; }
            #super-btn.ready {
                color: #f0e6d2;
                border-color: #f5d27a;
                background: radial-gradient(circle at 50% 40%, #4a3a1a, #2a1e0c);
                box-shadow: 0 0 18px rgba(245,210,122,0.6), 0 3px 8px rgba(0,0,0,0.6), inset 0 0 10px rgba(245,210,122,0.25);
                animation: superReadyPulse 1.1s ease-in-out infinite;
                text-shadow: 0 0 8px rgba(245,210,122,0.8);
            }
            #super-btn.pressed { transform: scale(0.9); }
            @keyframes superReadyPulse {
                0%,100% { box-shadow: 0 0 14px rgba(245,210,122,0.5), 0 3px 8px rgba(0,0,0,0.6), inset 0 0 10px rgba(245,210,122,0.25); }
                50% { box-shadow: 0 0 26px rgba(245,210,122,0.95), 0 3px 8px rgba(0,0,0,0.6), inset 0 0 10px rgba(245,210,122,0.35); }
            }
            @media (orientation: portrait) {
                #super-btn { width: 80px; height: 80px; font-size: 26px; right: 22px; bottom: 110px; }
            }
        `;
        document.head.appendChild(style);
    }

    var old = document.getElementById('super-btn');
    if (old) old.remove();

    var btn = document.createElement('div');
    btn.id = 'super-btn';
    btn.setAttribute('data-ui-interactive', '');
    btn.textContent = 'SP';
    document.body.appendChild(btn);
    this._superBtnDOM = btn;

    var self = this;
    // 防誤按：只在按鈕上 touchstart 才觸發，且 stopPropagation 不讓搖桿邏輯接手
    this._superTouchHandler = function(e) {
        if (!self._isSuperReady) return;          // 沒充能好，不反應
        if (self._isCombatInputBlocked()) return; // 開場／選卡禁止大招
        if (!self._isGameActive && !(self.app.playerController && self.app.playerController.isDead)) return;
        e.preventDefault();
        e.stopPropagation();                       // 🛑 阻止冒泡到 window，避免觸發搖桿
        btn.classList.add('pressed');
        self.attackCommand = { mode: 'auto', angle: 0, distance: 1.0, isSuper: true, timestamp: Date.now() };
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(40);
    };
    this._superTouchEnd = function(e) { btn.classList.remove('pressed'); };

    btn.addEventListener('touchstart', this._superTouchHandler, { passive: false });
    btn.addEventListener('touchend', this._superTouchEnd);
    btn.addEventListener('touchcancel', this._superTouchEnd);
    // 滑鼠（桌面測試用）
    btn.addEventListener('mousedown', this._superTouchHandler);
    btn.addEventListener('mouseup', this._superTouchEnd);
};

InputManager.prototype._lockCycleLabel = function() {
    if (window.TKI18n && typeof window.TKI18n.t === 'function') {
        return window.TKI18n.t('hud.lockCycle');
    }
    return '鎖';
};

InputManager.prototype._refreshLockCycleBtnLabel = function() {
    if (this._lockCycleBtnDOM) this._lockCycleBtnDOM.textContent = this._lockCycleLabel();
};

InputManager.prototype._isManualAimMode = function() {
    if (typeof GameSettings !== 'undefined' && typeof GameSettings.isManualAimMode === 'function') {
        return GameSettings.isManualAimMode();
    }
    try { return localStorage.getItem('tk_aim_mode') === 'manual'; } catch (e) {}
    return false;
};

/** 手動鎖定：換鎖鍵（SP 上方偏右，搖桿青銅色系） */
InputManager.prototype._createLockCycleButtonDOM = function() {
    if (!document.getElementById('lock-cycle-btn-style')) {
        var style = document.createElement('style');
        style.id = 'lock-cycle-btn-style';
        style.innerHTML =
            '#lock-cycle-btn {' +
            'position: fixed; right: 20px; bottom: 198px; z-index: 4500;' +
            'width: 56px; height: 56px; border-radius: 50%;' +
            'display: none; align-items: center; justify-content: center;' +
            "font-family: 'Anton','Impact','Microsoft JhengHei',sans-serif; font-size: 18px; letter-spacing: 1px;" +
            'color: #f5d27a; user-select: none; -webkit-user-select: none;' +
            'touch-action: none; cursor: pointer;' +
            'background: radial-gradient(circle at 50% 40%, rgba(26,20,16,0.75), rgba(26,20,16,0.55));' +
            'border: 2px solid #c9a25a;' +
            'box-shadow: 0 2px 6px rgba(0,0,0,0.45), inset 0 0 6px rgba(0,0,0,0.35);' +
            'transition: transform 0.08s ease;' +
            '}' +
            '#lock-cycle-btn.visible { display: flex; }' +
            '#lock-cycle-btn.pressed { transform: scale(0.9); }' +
            '@media (orientation: portrait) {' +
            '#lock-cycle-btn { width: 52px; height: 52px; font-size: 16px; right: 14px; bottom: 206px; }' +
            '}';
        document.head.appendChild(style);
    }

    var old = document.getElementById('lock-cycle-btn');
    if (old) old.remove();

    var btn = document.createElement('div');
    btn.id = 'lock-cycle-btn';
    btn.setAttribute('data-ui-interactive', '');
    btn.textContent = this._lockCycleLabel();
    document.body.appendChild(btn);
    this._lockCycleBtnDOM = btn;

    var self = this;
    this._lockCycleTouchHandler = function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (self._isCombatInputBlocked()) return;
        if (!self._isManualAimMode()) return;
        if (!self._isGameActive && !(self.app.playerController && self.app.playerController.isDead)) return;
        var pcCtrl = self.app.playerController;
        if (!pcCtrl || typeof pcCtrl.cycleAimLock !== 'function') return;
        pcCtrl.cycleAimLock();
        btn.classList.add('pressed');
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(20);
    };
    this._lockCycleTouchEnd = function() { btn.classList.remove('pressed'); };

    btn.addEventListener('touchstart', this._lockCycleTouchHandler, { passive: false });
    btn.addEventListener('touchend', this._lockCycleTouchEnd);
    btn.addEventListener('touchcancel', this._lockCycleTouchEnd);
    btn.addEventListener('mousedown', this._lockCycleTouchHandler);
    btn.addEventListener('mouseup', this._lockCycleTouchEnd);

    this._syncLockCycleBtnPresentation();
};

InputManager.prototype._requestCycleAimLock = function() {
    if (!this._isManualAimMode()) return false;
    if (this._isCombatInputBlocked()) return false;
    if (!this._isGameActive && !(this.app.playerController && this.app.playerController.isDead)) return false;
    var pcCtrl = this.app.playerController;
    if (!pcCtrl || typeof pcCtrl.cycleAimLock !== 'function') return false;
    return !!pcCtrl.cycleAimLock();
};

InputManager.prototype._syncLockCycleBtnPresentation = function() {
    if (!this._lockCycleBtnDOM) return;
    // intro／promo／選卡期間與戰鬥輸入一併隱藏
    var show = !!(this._isGameActive && this._isManualAimMode() && !this._isCombatInputBlocked());
    this._lockCycleBtnDOM.classList.toggle('visible', show);
};

InputManager.prototype._generateCircleTexture = function(text, colorStr, strokeStr) {
    var canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = colorStr; ctx.beginPath(); ctx.arc(64, 64, 58, 0, Math.PI * 2); ctx.fill();
    if (strokeStr) { ctx.strokeStyle = strokeStr; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(64, 64, 58, 0, Math.PI * 2); ctx.stroke(); }
    if (text) { ctx.fillStyle = '#f0e6d2'; ctx.font = 'bold 44px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 64, 64); }
    var tex = new pc.Texture(this.app.graphicsDevice, { width: 128, height: 128, format: pc.PIXELFORMAT_R8_G8_B8_A8, autoMipmap: true });
    tex.setSource(canvas); tex.upload(); return tex;
};

InputManager.prototype._destroyProceduralUI = function() {
    if (this.uiScreen) this.uiScreen.destroy();
    if (this.texBase) this.texBase.destroy(); if (this.texNub) this.texNub.destroy();
    if (this.texSupBtnReady) this.texSupBtnReady.destroy(); if (this.texSupBtnNotReady) this.texSupBtnNotReady.destroy();
    if (this._superBtnDOM && this._superBtnDOM.parentNode) this._superBtnDOM.parentNode.removeChild(this._superBtnDOM);
    this._superBtnDOM = null;
    if (this._lockCycleBtnDOM && this._lockCycleBtnDOM.parentNode) this._lockCycleBtnDOM.parentNode.removeChild(this._lockCycleBtnDOM);
    this._lockCycleBtnDOM = null;
};

InputManager.prototype._updateUIPosition = function(uiEntity, screenX, screenY) {
    if (!uiEntity || !this.uiScreen || !this.uiScreen.screen) return;
    var scale = this.uiScreen.screen.scale || 1;
    if (scale < 0.001) scale = 1;
    var canvas = this.app.graphicsDevice && this.app.graphicsDevice.canvas;
    var rect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    // iOS Safari：用 canvas 矩形對齊 client 座標，避免網址列縮放造成搖杆錯位
    uiEntity.setLocalPosition((screenX - rect.left) / scale, (rect.height - (screenY - rect.top)) / scale, 0);
};

InputManager.prototype.setSuperReady = function(isReady) {
    isReady = !!isReady;
    if (this._isSuperReady === isReady) {
        this._syncSuperBtnPresentation();
        return;
    }
    this._isSuperReady = isReady;
    this._syncSuperBtnPresentation();
};

// 僅在對戰中且氣滿時顯示 SP（位置不變）；未滿不佔位、不裝可點
InputManager.prototype._syncSuperBtnPresentation = function() {
    if (!this._superBtnDOM) return;
    var show = !!(this._isGameActive && this._isSuperReady);
    this._superBtnDOM.classList.toggle('visible', show);
    this._superBtnDOM.classList.toggle('ready', show);
};

// 控制大招鍵顯示（內部／結束對戰用；一般請走 setSuperReady）
InputManager.prototype._setSuperBtnVisible = function(visible) {
    if (this._superBtnDOM) this._superBtnDOM.classList.toggle('visible', visible);
};

InputManager.prototype.consumeAttackCommand = function() {
    if (this._isCombatInputBlocked()) {
        this.attackCommand = null;
        return null;
    }
    var cmd = this.attackCommand; this.attackCommand = null; 
    if (cmd && (Date.now() - cmd.timestamp > 350)) return null; 
    if (cmd && cmd.isSuper) this.setSuperReady(false);
    return cmd;
};

InputManager.prototype._resetTouchState = function() {
    this._primaryTouchId = null;
    this._touchState = 'idle';
    this._rawMoveX = 0;
    this._rawMoveZ = 0;
    this._nubOffsetX = 0;
    this._nubOffsetY = 0;
    this._posHistory = [];
    if (this.joyGroup) this.joyGroup.enabled = false;
};

// ==========================================
// 🕹️ 單手萬能操作系統 (Tap=普攻, Swipe=翻滾, Drag=走位)
// ==========================================
InputManager.prototype._onTouchStart = function (event) {
    // 守衛開啟時：左右邊緣一律 preventDefault（不限對戰；Android 仍可能不理系統手勢）
    if (this._historyGuardOn && event.touches && event.touches.length > 0) {
        var edgeTouch = event.touches[0];
        if (this._isEdgeSwipeTouch(edgeTouch.clientX) && event.cancelable) {
            event.preventDefault();
        }
    }

    if (this._isCombatInputBlocked()) return; // 開場／選卡：不攔截，放行 DOM 選卡
    if (this._isUiTouchTarget(event.target)) return;
    var isSpectating = this.app.playerController && this.app.playerController.isDead;
    if (!this._isGameActive && !isSpectating) return;
    if (event.cancelable) event.preventDefault();

    if (this._primaryTouchId === null && event.changedTouches.length > 0) {
        var t = event.changedTouches[0];

        // 啟動單手追蹤（大招已移到 DOM 按鈕自己接，這裡不再判定大招）
        this._primaryTouchId = t.identifier;
        this._originX = t.clientX; 
        this._originY = t.clientY;
        this._currentX = t.clientX;
        this._currentY = t.clientY;
        this._startTime = Date.now();
        this._touchState = 'checking'; // 剛按下去，還不知道是點擊還是移動
        this._posHistory = [{ x: t.clientX, y: t.clientY, t: this._startTime }];
    }
};

InputManager.prototype._onTouchMove = function (event) {
    if (this._isCombatInputBlocked()) return;
    if (this._touchState === 'idle') return;
    var isSpectating = this.app.playerController && this.app.playerController.isDead;
    if (!this._isGameActive && !isSpectating) return;

    // iOS 有時只更新 touches、changedTouches 不含主指；兩邊都查
    var t = null;
    var list = event.touches && event.touches.length ? event.touches : event.changedTouches;
    for (var i = 0; i < list.length; i++) {
        if (list[i].identifier === this._primaryTouchId) { t = list[i]; break; }
    }
    if (!t) {
        // 主指已消失（被系統取消／多指干擾）→ 清狀態，避免卡死方向
        this._resetTouchState();
        return;
    }
    event.preventDefault();

    this._currentX = t.clientX;
    this._currentY = t.clientY;

    if (this._touchState === 'checking' || this._touchState === 'moving') {
        this._posHistory.push({ x: this._currentX, y: this._currentY, t: Date.now() });
    }

    if (this._touchState === 'checking') {
        var dxStart = this._currentX - this._originX;
        var dyStart = this._currentY - this._originY;
        if (Math.sqrt(dxStart * dxStart + dyStart * dyStart) > this.dragDeadZone) {
            this._touchState = 'moving';
        }
    }

    if (this._touchState === 'moving') {
        var dxOrigin = this._currentX - this._originX;
        var dyOrigin = this._currentY - this._originY;
        var curDist = Math.sqrt(dxOrigin * dxOrigin + dyOrigin * dyOrigin);

        var clampedDx = dxOrigin;
        var clampedDy = dyOrigin;
        if (curDist > this.virtualRange) {
            var clampRatio = this.virtualRange / curDist;
            clampedDx = dxOrigin * clampRatio;
            clampedDy = dyOrigin * clampRatio;
        }

        this._nubOffsetX = clampedDx;
        this._nubOffsetY = clampedDy;
        this._rawMoveX = clampedDx / this.virtualRange;
        this._rawMoveZ = clampedDy / this.virtualRange;
    }
};

InputManager.prototype._onTouchEnd = function (event) {
    if (this._isCombatInputBlocked()) {
        // 鎖定期間若仍有殘留主指，清掉，避免解鎖後誤觸攻擊
        if (this._primaryTouchId !== null) this._clearCombatInput();
        return;
    }
    var isSpectating = this.app.playerController && this.app.playerController.isDead;
    if (!this._isGameActive && !isSpectating) return;

    if (event.type === 'touchcancel') {
        // iOS 來電／手勢中斷：一律清掉，避免方向卡死
        if (this._primaryTouchId !== null) {
            this._resetTouchState();
            this._rawMoveX = 0; this._rawMoveZ = 0;
        }
        if (!event.changedTouches || event.changedTouches.length === 0) return;
    }

    for (var i = 0; i < event.changedTouches.length; i++) {
        var t = event.changedTouches[i];

        if (t.identifier === this._primaryTouchId) {
            event.preventDefault();
            var now = Date.now();
            var elapsed = (now - this._startTime) / 1000;
            var isFlick = false;

            if (this.joyGroup) this.joyGroup.enabled = false;

            var flickFrame = null;
            for (var k = 0; k < this._posHistory.length; k++) {
                if (now - this._posHistory[k].t <= 250) { flickFrame = this._posHistory[k]; break; }
            }

            if (flickFrame) {
                var dxFlick = t.clientX - flickFrame.x;
                var dyFlick = t.clientY - flickFrame.y;
                if (Math.sqrt(dxFlick * dxFlick + dyFlick * dyFlick) > 25) {
                    isFlick = true;
                    this.app.fire('input:flick', Math.atan2(dxFlick, dyFlick));
                }
            }

            if (!isFlick && this._touchState === 'checking' && elapsed <= this.tapTime) {
                this.attackCommand = { mode: 'auto', angle: 0, distance: 1.0, isSuper: false, timestamp: now };
            }

            this._resetTouchState();
        }
    }
};

// ==========================================
// 🖱️ PC 與 更新迴圈
// ==========================================
InputManager.prototype._onMouseDown = function(event) {
    if (!this._isGameActive) return;
    if (this._isCombatInputBlocked()) return; // 開場 preview／選卡：禁止滑鼠攻擊
    var isLeft = event.button === pc.MOUSEBUTTON_LEFT;
    var isRight = event.button === pc.MOUSEBUTTON_RIGHT;
    if (isLeft || isRight) {
        if (isRight && !this._isSuperReady) return;
        this.attackCommand = { mode: 'auto', angle: 0, distance: 1.0, isSuper: isRight, timestamp: Date.now() };
    }
};

InputManager.prototype.update = function (dt) {
    // intro 結束後 gameState 變 playing 時要重新顯示換鎖鍵
    if (this._isGameActive) this._syncLockCycleBtnPresentation();

    if (this._isCombatInputBlocked()) {
        this.moveX = 0;
        this.moveZ = 0;
        this.attackCommand = null;
        return;
    }
    var isSpectating = this.app.playerController && this.app.playerController.isDead;
    if (!this._isGameActive && !isSpectating) { this.moveX = 0; this.moveZ = 0; return; }

    var now = Date.now();

    var cutoff = now - 350;
    while (this._posHistory.length > 0 && this._posHistory[0].t < cutoff) {
        this._posHistory.shift();
    }

    if (this._touchState === 'moving' && this.joyGroup && this.uiScreen && this.uiScreen.screen) {
        this.joyGroup.enabled = true;
        // 底盤固定在按下的位置（_originX/Y 不再變動）
        this._updateUIPosition(this.joyGroup, this._originX, this._originY);
        var scale = this.uiScreen.screen.scale;
        // 握把用 clamp 後的偏移，始終在底盤範圍內
        var nx = (this._nubOffsetX || 0) / scale;
        var ny = -((this._nubOffsetY || 0) / scale);
        this.joyNub.setLocalPosition(nx, ny, 0);
    } 

    // 大招鍵脈動已改由 DOM CSS animation (superReadyPulse) 處理，update 不再縮放

    var lerpFactor = 1.0 - Math.exp(-this._lerpSpeed * dt);
    this._smoothMoveX += (this._rawMoveX - this._smoothMoveX) * lerpFactor;
    this._smoothMoveZ += (this._rawMoveZ - this._smoothMoveZ) * lerpFactor;
    if (Math.abs(this._smoothMoveX) < 0.001) this._smoothMoveX = 0;
    if (Math.abs(this._smoothMoveZ) < 0.001) this._smoothMoveZ = 0;

    var kbX = 0; var kbZ = 0;
    if (this.app.keyboard) {
        if (this.app.keyboard.isPressed(pc.KEY_W)) kbZ -= 1; if (this.app.keyboard.isPressed(pc.KEY_S)) kbZ += 1;
        if (this.app.keyboard.isPressed(pc.KEY_A)) kbX -= 1; if (this.app.keyboard.isPressed(pc.KEY_D)) kbX += 1;
        
        var keys = [pc.KEY_W, pc.KEY_A, pc.KEY_S, pc.KEY_D];
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            if (this.app.keyboard.wasPressed(key)) {
                var nowSec = now / 1000;
                if (this.lastKey === key && (nowSec - this.lastKeyTime) < this.doubleTapTime) {
                    var rollAngle = 0;
                    if (kbX !== 0 || kbZ !== 0) {
                        rollAngle = Math.atan2(kbX, kbZ);
                    } else {
                        if (key === pc.KEY_W) rollAngle = Math.PI;
                        if (key === pc.KEY_S) rollAngle = 0;
                        if (key === pc.KEY_A) rollAngle = -Math.PI / 2;
                        if (key === pc.KEY_D) rollAngle = Math.PI / 2;
                    }
                    this.app.fire('input:flick', rollAngle); this.lastKey = null;
                } else { this.lastKey = key; this.lastKeyTime = nowSec; }
            }
        }

        // 鍵盤備援：Space 普攻、F 必殺（主操作仍為滑鼠）；Tab 手動換鎖
        if (this._isGameActive && !this._inputLocked) {
            if (this.app.keyboard.wasPressed(pc.KEY_SPACE)) {
                this.attackCommand = { mode: 'auto', angle: 0, distance: 1.0, isSuper: false, timestamp: now };
            }
            if (this.app.keyboard.wasPressed(pc.KEY_F) && this._isSuperReady) {
                this.attackCommand = { mode: 'auto', angle: 0, distance: 1.0, isSuper: true, timestamp: now };
            }
            if (this.app.keyboard.wasPressed(pc.KEY_TAB)) {
                this._requestCycleAimLock();
            }
        }
    }

    if (kbX !== 0 || kbZ !== 0) {
        var mag = Math.sqrt(kbX * kbX + kbZ * kbZ);
        this.moveX = kbX / mag; this.moveZ = kbZ / mag;
    } else {
        this.moveX = this._smoothMoveX; this.moveZ = this._smoothMoveZ;
    }
};