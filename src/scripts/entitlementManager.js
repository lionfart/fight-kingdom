// =============================================================================
// EntitlementManager — Character Pass 等付費 entitlement（server 為準）
// Phase 1：RLS／Edge Function 拉取 + DEV 覆寫
// Phase 2：Stripe Checkout（create-checkout）+ 回跳輪詢
// =============================================================================

var EntitlementManager = pc.createScript('entitlementManager');

EntitlementManager.SKU_CHARACTER_PASS = 'character_pass';
EntitlementManager.HINT_KEY = 'fk_entitlement_hint_v1';
EntitlementManager.POLL_ATTEMPTS = 8;
EntitlementManager.POLL_MS = 1500;

EntitlementManager.prototype.initialize = function () {
    this.app.entitlementManager = this;

    this.characterPass = false;
    this._loaded = false;
    this._fetching = false;
    this._devOverride = null; // null | true | false — 僅本機測試
    this._checkoutBusy = false;
    this._redeemBusy = false;
    this._claimBusy = false;

    this._loadHint();

    var self = this;
    this.app.on('auth:ready', this._onAuthReady, this);
    this.app.on('auth:stateChanged', function () {
        self.refresh();
    }, this);
    this.app.on('auth:signedOut', this._onSignedOut, this);
    this.app.on('auth:emailLinked', this._onEmailLinked, this);

    if (this.app.authManager && this.app.authManager.isReady()) {
        this._onAuthReady();
    }

    this._handlePurchaseReturn();

    console.log('[Entitlement] Ready — setDevOverride / startCheckout（pc.app.entitlementManager）');
};

EntitlementManager.prototype.destroy = function () {
    this.app.off('auth:ready', this._onAuthReady, this);
    this.app.off('auth:signedOut', this._onSignedOut, this);
    this.app.off('auth:emailLinked', this._onEmailLinked, this);
};

EntitlementManager.prototype._onSignedOut = function () {
    this._devOverride = null;
    this._apply(false, { persistHint: false });
};

EntitlementManager.prototype.hasCharacterPass = function () {
    if (this._devOverride === true) return true;
    if (this._devOverride === false) return false;
    return !!this.characterPass;
};

EntitlementManager.prototype.isLoaded = function () {
    return this._loaded || this._devOverride !== null;
};

/** 本機測試用；傳 null 清除覆寫並重新拉 server */
EntitlementManager.prototype.setDevOverride = function (value) {
    if (value === null || value === undefined) {
        this._devOverride = null;
        this.refresh();
        return;
    }
    this._devOverride = !!value;
    this._loaded = true;
    this.app.fire('entitlement:changed', { characterPass: this.hasCharacterPass(), source: 'dev' });
};

EntitlementManager.prototype._loadHint = function () {
    try {
        var raw = localStorage.getItem(EntitlementManager.HINT_KEY);
        if (!raw) return;
        var parsed = JSON.parse(raw);
        if (parsed && parsed.characterPass) {
            this.characterPass = true;
        }
    } catch (e) { /* ignore */ }
};

EntitlementManager.prototype._saveHint = function (hasPass) {
    try {
        if (hasPass) {
            localStorage.setItem(EntitlementManager.HINT_KEY, JSON.stringify({
                characterPass: true,
                at: Date.now()
            }));
        } else {
            localStorage.removeItem(EntitlementManager.HINT_KEY);
        }
    } catch (e) { /* ignore */ }
};

EntitlementManager.prototype._apply = function (hasPass, opts) {
    opts = opts || {};
    var prev = this.hasCharacterPass();
    this.characterPass = !!hasPass;
    this._loaded = true;
    // 輪詢中若暫未拿到 Pass，不要清掉既有 hint（避免回跳期間 UI 閃爍）
    if (opts.persistHint !== false && this._devOverride === null) {
        if (hasPass || !opts.keepHintOnFalse) {
            this._saveHint(this.characterPass);
        }
    }
    var next = this.hasCharacterPass();
    if (prev !== next || opts.forceEvent) {
        this.app.fire('entitlement:changed', {
            characterPass: next,
            source: opts.source || 'server'
        });
    }
};

EntitlementManager.prototype.refresh = function (opts) {
    opts = opts || {};
    if (this._devOverride !== null) {
        this._loaded = true;
        this.app.fire('entitlement:changed', {
            characterPass: this.hasCharacterPass(),
            source: 'dev'
        });
        return Promise.resolve({ characterPass: this.hasCharacterPass() });
    }

    var auth = this.app.authManager;
    var client = auth && auth.getClient();
    var userId = auth && auth.getUserId();

    if (!client || !userId) {
        this._apply(false, { source: 'no_auth', persistHint: false });
        return Promise.resolve({ characterPass: false });
    }

    if (this._fetching) {
        return Promise.resolve({ characterPass: this.hasCharacterPass() });
    }

    this._fetching = true;
    var self = this;

    return this._fetchViaFunction(client)
        .catch(function () {
            return self._fetchViaTable(client, userId);
        })
        .then(function (hasPass) {
            self._fetching = false;
            self._apply(!!hasPass, {
                source: 'server',
                forceEvent: true,
                keepHintOnFalse: !!opts.keepHintOnFalse
            });
            return { characterPass: self.hasCharacterPass() };
        })
        .catch(function (err) {
            self._fetching = false;
            console.warn('[Entitlement] refresh failed', err);
            self._loaded = true;
            self.app.fire('entitlement:changed', {
                characterPass: self.hasCharacterPass(),
                source: 'error'
            });
            return { characterPass: self.hasCharacterPass() };
        });
};

EntitlementManager.prototype._fetchViaFunction = function (client) {
    if (!client.functions || typeof client.functions.invoke !== 'function') {
        return Promise.reject(new Error('no_functions'));
    }
    return client.functions.invoke('get-entitlements').then(function (result) {
        if (result.error) throw result.error;
        var data = result.data;
        if (data && typeof data.characterPass === 'boolean') {
            return data.characterPass;
        }
        throw new Error('bad_function_payload');
    });
};

EntitlementManager.prototype._fetchViaTable = function (client, userId) {
    return client.from('player_entitlements')
        .select('sku')
        .eq('user_id', userId)
        .eq('sku', EntitlementManager.SKU_CHARACTER_PASS)
        .maybeSingle()
        .then(function (result) {
            if (result.error) throw result.error;
            return !!(result.data && result.data.sku);
        });
};

/**
 * Stripe Checkout — Fight Kingdom sürümünde DEVRE DIŞI.
 * Tüm karakterler coin (軍餉) ile açılabilir; satın alma sonradan eklenebilir.
 */
EntitlementManager.prototype.startCheckout = function () {
    console.warn('[Entitlement] Stripe checkout disabled in Fight Kingdom build');
    return Promise.resolve({
        error: 'disabled',
        message: 'Purchases are not available in this build yet.'
    });
};

/** 導向 Stripe；失敗時回傳 error 物件 */
EntitlementManager.prototype.redirectToCheckout = function () {
    var self = this;
    return this.startCheckout().then(function (result) {
        if (result.url) {
            self._navigateTopLevel(result.url);
            return result;
        }
        return result;
    });
};

/**
 * Publish /p/ 在 iframe 內；Stripe Checkout 無法嵌在 iframe（白頁）。
 * 必須用頂層視窗開啟。
 */
EntitlementManager.prototype._navigateTopLevel = function (url) {
    if (!url || typeof window === 'undefined') return;
    var auth = this.app.authManager;
    if (auth && typeof auth._redirectToOAuthUrl === 'function') {
        auth._redirectToOAuthUrl(url);
        return;
    }
    try {
        if (window.top && window.top !== window.self) {
            window.top.location.href = url;
            return;
        }
    } catch (e) { /* ignore */ }
    window.location.href = url;
};

EntitlementManager.prototype._handlePurchaseReturn = function () {
    if (typeof window === 'undefined') return;
    var params = new URLSearchParams(window.location.search || '');
    var purchase = params.get('purchase');
    if (!purchase) return;

    var self = this;
    var clean = function () {
        params.delete('purchase');
        params.delete('session_id');
        var q = params.toString();
        var base = window.location.origin + window.location.pathname;
        var next = q ? (base + '?' + q) : base;
        try {
            window.history.replaceState({}, document.title, next);
        } catch (e) { /* ignore */ }
    };

    if (purchase === 'cancel') {
        clean();
        this.app.fire('entitlement:purchaseCancelled');
        return;
    }

    if (purchase === 'success') {
        clean();
        this.app.fire('entitlement:purchasePending');
        this._pollUntilOwned().then(function (owned) {
            self.app.fire(owned ? 'entitlement:purchaseSuccess' : 'entitlement:purchasePendingTimeout');
        });
    }
};

EntitlementManager.prototype._pollUntilOwned = function () {
    var self = this;
    var attempt = 0;
    this._purchasePolling = true;

    var tick = function () {
        return self.refresh({ keepHintOnFalse: true }).then(function (res) {
            if (res && res.characterPass) {
                self._purchasePolling = false;
                return true;
            }
            attempt += 1;
            if (attempt >= EntitlementManager.POLL_ATTEMPTS) {
                self._purchasePolling = false;
                return false;
            }
            return new Promise(function (resolve) {
                setTimeout(function () {
                    resolve(tick());
                }, EntitlementManager.POLL_MS);
            });
        });
    };

    return tick();
};

/**
 * Redeem one-time promo code.
 * Returns Promise<{ characterPass } | { error, message }>.
 */
EntitlementManager.prototype.redeemCode = function (code) {
    var auth = this.app.authManager;
    var client = auth && auth.getClient();
    var trimmed = (code || '').trim();
    var normalizedCode = trimmed.toUpperCase();

    var mapRedeemError = function (errCode, fallback) {
        if (errCode === 'invalid_code') return '兌換碼無效。';
        if (errCode === 'already_redeemed') return '此兌換碼已被使用。';
        if (errCode === 'expired') return '兌換碼已過期。';
        if (errCode === 'already_owned') return '你已擁有武將通行證。';
        if (errCode === 'email_required') return '請先用 Google 綁定再兌換。';
        if (errCode === 'missing_code') return '請輸入兌換碼。';
        return fallback || '兌換失敗，請稍後再試。';
    };

    if (!auth || !client) {
        return Promise.resolve({ error: 'no_auth', message: '尚未登入。' });
    }
    if (!trimmed) {
        return Promise.resolve({ error: 'missing_code', message: 'Please enter a code.' });
    }
    if (this.hasCharacterPass()) {
        return Promise.resolve({ error: 'already_owned', message: 'Character Pass already owned.' });
    }
    if (auth.isAnonymous() || !auth.getEmail()) {
        return Promise.resolve({
            error: 'email_required',
            message: 'Please link email before redeeming.'
        });
    }
    if (this._redeemBusy) {
        return Promise.resolve({ error: 'busy', message: 'Redeeming...' });
    }

    this._redeemBusy = true;
    var self = this;

    return client.functions.invoke('redeem-code', {
        body: { code: normalizedCode }
    }).then(function (result) {
        self._redeemBusy = false;
        if (result.error) {
            var invokeCode = result.error.code || result.error.name || 'invoke_failed';
            var invokeMsg = result.error.message || String(result.error);
            return {
                error: invokeCode,
                message: mapRedeemError(invokeCode, invokeMsg)
            };
        }
        var data = result.data || {};
        if (data.error) {
            return {
                error: data.error,
                message: mapRedeemError(data.error, data.message || data.error)
            };
        }
        if (data.characterPass) {
            self._apply(true, { source: 'promo_code', forceEvent: true });
            self.app.fire('entitlement:redeemSuccess', { source: 'promo_code' });
            return { characterPass: true };
        }
        return { error: 'unknown', message: '兌換失敗，請稍後再試。' };
    }).catch(function (err) {
        self._redeemBusy = false;
        console.warn('[Entitlement] redeemCode', err);
        var rawMessage = (err && err.message) ? err.message : String(err);
        var errCode = (err && (err.code || err.name)) || 'exception';
        return { error: errCode, message: mapRedeemError(errCode, rawMessage) };
    });
};

/** Pass coverage for this brawler (T1-T3; excludes T0/Rogue). */
EntitlementManager.prototype.isCoveredByCharacterPass = function (brawlerType) {
    if (window.BrawlerConfig && typeof window.BrawlerConfig.isCoveredByCharacterPass === 'function') {
        return window.BrawlerConfig.isCoveredByCharacterPass(brawlerType);
    }
    var cfg = window.BrawlerConfig && window.BrawlerConfig[brawlerType];
    if (!cfg) return false;
    var t = cfg.unlockTier;
    return t === 1 || t === 2 || t === 3;
};

EntitlementManager.prototype._onAuthReady = function () {
    this.refresh();
    this._resumeCheckoutIfNeeded();
};

EntitlementManager.prototype._onEmailLinked = function () {
    this.refresh();
    this._resumeCheckoutIfNeeded();
    this.claimTestPass();
};

/**
 * Test kampanyası: Google bağlanınca sunucudan benzersiz TKPASS kodu talep et.
 * Kod e-posta ile gönderilir; oyuncu kodu Kullanıcı Arayüzü'nde girer.
 * Idempotent — aynı hesap için yalnızca tek kod üretilir.
 */
EntitlementManager.prototype.claimTestPass = function () {
    var auth = this.app.authManager;
    var client = auth && auth.getClient();
    if (!client || !auth || auth.isAnonymous() || !auth.getEmail()) {
        return Promise.resolve(null);
    }
    if (this._claimBusy) {
        return Promise.resolve(null);
    }
    if (typeof client.functions !== 'object' || typeof client.functions.invoke !== 'function') {
        return Promise.resolve(null);
    }

    this._claimBusy = true;
    var self = this;

    return client.functions.invoke('claim-test-pass').then(function (result) {
        self._claimBusy = false;
        if (result.error) {
            console.warn('[Entitlement] claimTestPass invoke failed', result.error);
            return null;
        }
        var data = result.data || {};
        if (data.error) {
            console.warn('[Entitlement] claimTestPass error', data.error, data.message || '');
            return null;
        }
        self.app.fire('entitlement:testPassClaimed', {
            code: data.code || '',
            sent: !!data.sent
        });
        return data;
    }).catch(function (err) {
        self._claimBusy = false;
        console.warn('[Entitlement] claimTestPass', err);
        return null;
    });
};

/** Google 綁定回跳後：若購買流程有留下 intent，自動開 Stripe */
EntitlementManager.prototype._resumeCheckoutIfNeeded = function () {
    var auth = this.app.authManager;
    if (!auth || typeof auth.consumeCheckoutIntent !== 'function') return;
    if (!auth.consumeCheckoutIntent()) return;
    if (auth.isAnonymous() || !auth.getEmail()) return;
    if (this.hasCharacterPass()) return;
    if (typeof window !== 'undefined') {
        var params = new URLSearchParams(window.location.search || '');
        if (params.get('purchase')) return; // 已在 Stripe 回跳流程
    }
    console.log('[Entitlement] Resuming checkout after Google link');
    this.redirectToCheckout();
};
