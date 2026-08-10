// Shared DOM touch helpers — load before inputManager / characterSelect in PlayCanvas.
var UiTouch = {
    INTERACTIVE_SELECTOR:
        'button, a, input, textarea, select, label, option, ' +
        '[role="button"], [data-ui-interactive], [contenteditable="true"]',

    ROOT_SELECTOR:
        '#fk-ui-root, #profile-overlay, #pf-legal-overlay, #cloud-save-modal, ' +
        '#rogue-hud, #rogue-card-overlay, #rogue-overlay, #join-prompt-overlay, #create-prompt-overlay, ' +
        '#help-overlay, #prog-bar, #unlock-confirm, #dom-end-screen, #ffa-death-choice, ' +
        '#gs-overlay, #gs-gear, #super-btn, #lock-cycle-btn, .ui-panel, .rg-card, .rg-chip, .csm-box, .unlock-dialog',

    isInteractiveTarget: function (target) {
        if (!target || !target.closest) return false;
        return !!target.closest(this.INTERACTIVE_SELECTOR + ', ' + this.ROOT_SELECTOR);
    },

    isIOS: function () {
        if (typeof navigator === 'undefined') return false;
        if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return true;
        return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    },

    /** Add to Home Screen / installed web app — 禁止跨路徑 location.replace */
    isStandalone: function () {
        var check = function (win) {
            if (!win) return false;
            try {
                if (win.navigator && win.navigator.standalone === true) return true;
                if (typeof win.matchMedia === 'function') {
                    if (win.matchMedia('(display-mode: standalone)').matches) return true;
                    if (win.matchMedia('(display-mode: fullscreen)').matches) return true;
                }
            } catch (e) { /* ignore */ }
            return false;
        };
        try {
            if (typeof window === 'undefined') return false;
            if (check(window)) return true;
            // iframe 內 display-mode 常只在 top 為 true（主畫面冷啟動）
            if (window.top && window.top !== window.self) {
                try {
                    void window.top.location.hostname;
                    if (check(window.top)) return true;
                } catch (eTop) { /* cross-origin */ }
            }
        } catch (e) { /* ignore */ }
        return false;
    },

    /** 移除 PlayCanvas 空 start_url 的 manifest，避免「安裝應用」開到 JSON */
    stripBrokenManifest: function () {
        var strip = function (doc) {
            if (!doc || !doc.querySelectorAll) return;
            var nodes = doc.querySelectorAll('link[rel="manifest"]');
            for (var i = 0; i < nodes.length; i++) {
                if (nodes[i].parentNode) nodes[i].parentNode.removeChild(nodes[i]);
            }
        };
        try {
            strip(document);
            if (window.top && window.top !== window.self) {
                try {
                    void window.top.location.hostname;
                    strip(window.top.document);
                } catch (eTop) { /* cross-origin */ }
            }
        } catch (e) { /* ignore */ }
    },

    _ensureStyle: function () {
        if (document.getElementById('ui-touch-style')) return;
        var st = document.createElement('style');
        st.id = 'ui-touch-style';
        st.innerHTML =
            'button, a, input, textarea, select, label, [role="button"], [data-ui-interactive]{' +
            'touch-action:manipulation;-webkit-tap-highlight-color:transparent;}' +
            '#profile-overlay label.pf-consent{cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;}';
        document.head.appendChild(st);
    },

    // Unified tap: works for mouse + touch without double-fire.
    bindTap: function (el, fn, opts) {
        if (!el || !fn) return;
        this._ensureStyle();
        opts = opts || {};
        var debounceMs = (opts.debounceMs != null) ? opts.debounceMs : 400;
        var lastFire = 0;
        var fire = function (e) {
            if (opts.stopPropagation !== false && e) {
                e.stopPropagation();
            }
            if (opts.preventDefault !== false && e) {
                e.preventDefault();
            }
            var now = Date.now();
            if (now - lastFire < debounceMs) return;
            lastFire = now;
            fn(e);
        };

        if (window.PointerEvent && opts.preferPointer !== false) {
            el.addEventListener('pointerup', function (e) {
                if (e.pointerType === 'mouse' && e.button !== 0) return;
                fire(e);
            });
            return;
        }

        el.addEventListener('click', fire);
        el.addEventListener('touchend', fire, { passive: false });
    },

    bindInput: function (input) {
        if (!input) return;
        this._ensureStyle();
        var self = this;

        input.addEventListener('touchstart', function (e) {
            e.stopPropagation();
        }, { passive: true });

        input.addEventListener('touchend', function (e) {
            e.stopPropagation();
            e.preventDefault();
            input.focus();
            setTimeout(function () { input.focus(); }, 0);
        }, { passive: false });

        input.addEventListener('focus', function () {
            self.markRoot(input);
        });
    },

    bindCheckbox: function (checkbox, label) {
        if (!checkbox) return;
        this._ensureStyle();
        var box = label || checkbox;
        var debounceMs = this.isIOS() ? 120 : 400;
        this.bindTap(box, function (e) {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        }, { debounceMs: debounceMs });
    },

    markRoot: function (el) {
        if (!el || !el.closest) return;
        // 只標記真正的 overlay，不要把 #rogue-hud 整塊打成 interactive（會讓搖杆誤判）
        var root = el.closest('[id$="-overlay"], #fk-ui-root, #prog-bar, #cloud-save-modal');
        if (root) root.setAttribute('data-ui-interactive', '');
    }
};

if (typeof window !== 'undefined') {
    window.UiTouch = UiTouch;
}
