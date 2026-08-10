// =============================================================================
// AuthManager — Supabase 帳號（Anonymous 優先，之後以 Google OAuth 綁定／登入）
// SDK：自動從 CDN 載入（不依賴 PlayCanvas External Scripts 設定）
// =============================================================================

var AuthManager = pc.createScript('authManager');

AuthManager.SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
AuthManager.CHECKOUT_INTENT_KEY = 'fk_auth_checkout_intent';
/** Yayınlandığı site kökü (OAuth / Checkout geri dönüşü) */
AuthManager.PUBLISH_EMBED_URL = window.location.origin + window.location.pathname;

AuthManager.attributes.add('supabaseUrl', {
    type: 'string',
    default: 'YOUR_SUPABASE_PROJECT_URL',
    title: 'Supabase Project URL'
});

AuthManager.attributes.add('publishableKey', {
    type: 'string',
    default: 'YOUR_SUPABASE_PUBLISHABLE_KEY',
    title: 'Supabase Publishable Key'
});

// OAuth geri dönüş adresi; kendi domaininizin kökü olmalıdır
AuthManager.attributes.add('emailRedirectUrl', {
    type: 'string',
    default: 'http://localhost:5173',
    title: 'Auth Redirect URL'
});

AuthManager.prototype.initialize = function () {
    this.app.authManager = this;

    this.client = null;
    this.session = null;
    this.user = null;
    this.ready = false;
    this._authListener = null;

    var self = this;
    this._ensureSupabaseSdk(function (err) {
        if (err) {
            console.warn('[Auth] Supabase SDK 未載入，離線模式', err.message || err);
            self.app.fire('auth:error', { reason: 'sdk_missing', error: err });
            return;
        }
        self._initClient();
    });
};

AuthManager.prototype._hasSdk = function () {
    return typeof window !== 'undefined'
        && window.supabase
        && typeof window.supabase.createClient === 'function';
};

AuthManager.prototype._ensureSupabaseSdk = function (cb) {
    if (this._hasSdk()) {
        cb(null);
        return;
    }

    if (typeof document === 'undefined') {
        cb(new Error('document unavailable'));
        return;
    }

    var self = this;
    var existing = document.getElementById('supabase-sdk-script');

    if (existing) {
        this._waitForSupabase(cb);
        return;
    }

    var script = document.createElement('script');
    script.id = 'supabase-sdk-script';
    script.src = AuthManager.SDK_URL;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = function () {
        if (self._hasSdk()) {
            cb(null);
            return;
        }
        self._waitForSupabase(function (waitErr) {
            cb(waitErr || new Error('SDK loaded but createClient missing'));
        });
    };
    script.onerror = function () {
        cb(new Error('Supabase SDK script load failed — check CDN / network'));
    };
    document.head.appendChild(script);
};

AuthManager.prototype._waitForSupabase = function (cb) {
    var attempts = 0;
    var tick = function () {
        if (this._hasSdk()) {
            cb(null);
            return;
        }
        attempts += 1;
        if (attempts > 80) {
            cb(new Error('Supabase SDK timeout after script load'));
            return;
        }
        setTimeout(tick.bind(this), 100);
    }.bind(this);
    tick();
};

AuthManager.prototype._normalizePlaycanvasPublishUrl = function (origin, path) {
    if (!origin || !path) return '';
    if (path.indexOf('/e/p/') === 0) {
        var e = origin + path;
        return e.charAt(e.length - 1) === '/' ? e : (e + '/');
    }
    if (path.indexOf('/p/') === 0 && path.indexOf('/e/') !== 0) {
        var p = origin + '/e' + path;
        return p.charAt(p.length - 1) === '/' ? p : (p + '/');
    }
    return '';
};

AuthManager.prototype._defaultPublishEmbedUrl = function () {
    var configured = (this.emailRedirectUrl && this.emailRedirectUrl.trim()) || '';
    if (configured) return configured;
    return AuthManager.PUBLISH_EMBED_URL;
};

/**
 * OAuth redirectTo：oyunun barındığı sayfanın kendisi olmalıdır.
 * (PlayCanvas'ten bağımsız; kendi domainimizde çalışır.)
 */
AuthManager.prototype._getEmailRedirectUrl = function () {
    var configured = this._defaultPublishEmbedUrl();
    if (typeof window === 'undefined' || !window.location || !window.location.origin) {
        return configured;
    }
    var origin = window.location.origin;
    var path = window.location.pathname || '/';
    if (path.indexOf('/index.html') === path.length - 11) {
        path = path.slice(0, -11);
    }
    if (path.charAt(path.length - 1) !== '/') path += '/';
    return origin + path;
};

/** 登入成功後的美觀網址（可清 hash 後導回） */
AuthManager.prototype._getPrettyPublishUrl = function () {
    return this._defaultPublishEmbedUrl();
};
/**
 * Google 禁止在 iframe 內開 accountchooser（會 403）。
 * Publish 的 /p/ 網址把遊戲嵌在 iframe → 必須用 top 導向。
 */
AuthManager.prototype._redirectToOAuthUrl = function (url) {
    if (!url || typeof window === 'undefined') return;
    try {
        if (window.top && window.top !== window.self) {
            window.top.location.href = url;
            return;
        }
    } catch (e) {
        console.warn('[Auth] Cannot access window.top, falling back', e);
    }
    window.location.href = url;
};

/** 公開：OAuth／Stripe Checkout 回跳基準網址（無 query） */
AuthManager.prototype.getRedirectBaseUrl = function () {
    return this._getEmailRedirectUrl();
};

AuthManager.prototype._hasAuthCallbackInUrl = function () {
    if (typeof window === 'undefined') return false;
    var href = window.location.href;
    var search = window.location.search || '';
    var hash = window.location.hash || '';
    return href.indexOf('code=') !== -1
        || href.indexOf('access_token=') !== -1
        || href.indexOf('token_hash=') !== -1
        || search.indexOf('code=') !== -1
        || hash.indexOf('access_token=') !== -1;
};

AuthManager.prototype._logAuthCallbackError = function () {
    if (typeof window === 'undefined') return;
    var hash = window.location.hash ? window.location.hash.slice(1) : '';
    var params = new URLSearchParams(hash || window.location.search);
    var err = params.get('error');
    var errCode = params.get('error_code');
    var errDesc = params.get('error_description');
    if (err || errCode) {
        console.warn('[Auth] OAuth callback error:', errCode, errDesc || err);
        this.app.fire('auth:error', {
            reason: 'oauth_callback_failed',
            code: errCode,
            description: errDesc
        });
    }
};

AuthManager.prototype._cleanAuthCallbackFromUrl = function () {
    if (typeof window === 'undefined') return;
    var pretty = this._getPrettyPublishUrl();

    if (!window.history || !window.history.replaceState) return;
    var clean = pretty || (window.location.origin + window.location.pathname);
    try {
        var target = new URL(clean, window.location.href);
        var dest = target.origin + target.pathname + (target.search || '');
        window.history.replaceState({}, document.title, dest);
    } catch (e2) {
        window.history.replaceState({}, document.title, clean);
    }
};

AuthManager.prototype._setCheckoutIntent = function () {
    try {
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(AuthManager.CHECKOUT_INTENT_KEY, '1');
        }
    } catch (e) { /* ignore */ }
};

/** 若購買流程曾要求綁定後開結帳，消費一次並回傳 true */
AuthManager.prototype.consumeCheckoutIntent = function () {
    try {
        if (typeof sessionStorage === 'undefined') return false;
        if (sessionStorage.getItem(AuthManager.CHECKOUT_INTENT_KEY) !== '1') return false;
        sessionStorage.removeItem(AuthManager.CHECKOUT_INTENT_KEY);
        return true;
    } catch (e) {
        return false;
    }
};

AuthManager.prototype.clearCheckoutIntent = function () {
    try {
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem(AuthManager.CHECKOUT_INTENT_KEY);
        }
    } catch (e) { /* ignore */ }
};

AuthManager.prototype._initClient = function () {
    var self = this;
    try {
        this.client = window.supabase.createClient(this.supabaseUrl, this.publishableKey, {
            auth: {
                detectSessionInUrl: true,
                persistSession: true,
                autoRefreshToken: true
            }
        });
    } catch (e) {
        console.warn('[Auth] createClient 失敗', e);
        this.app.fire('auth:error', { reason: 'client_init_failed', error: e });
        return;
    }

    this._logAuthCallbackError();
    this._oauthCallbackPending = this._hasAuthCallbackInUrl();

    this._authListener = this.client.auth.onAuthStateChange(function (event, session) {
        self.session = session;
        self.user = session ? session.user : null;

        var isGoogleSession = !!(session && session.user && !self._sessionIsAnonymous(session));

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED'
            || event === 'INITIAL_SESSION') {
            // OAuth 回跳：必須等非匿名 session 再 ready／清 URL（避免先用匿名 sync 雲端）
            if (self._oauthCallbackPending) {
                if (isGoogleSession) {
                    self._oauthCallbackPending = false;
                    self._setSession(session);
                    if (!self.ready) self._markReady();
                    // 先讓 cloudSave 用正確 userId 拉檔，再導回 /e/p/
                    setTimeout(function () {
                        self._cleanAuthCallbackFromUrl();
                    }, 1200);
                }
            } else if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')
                && !self.ready && session) {
                self._markReady();
            }
        }

        self.app.fire('auth:stateChanged', {
            event: event,
            session: session,
            userId: self.getUserId(),
            isAnonymous: self.isAnonymous()
        });

        if (self.user && !self.isAnonymous()) {
            self.app.fire('auth:emailLinked', { email: self.user.email || '' });
        }
    });

    this.client.auth.getSession().then(function (result) {
        if (result.error) {
            console.warn('[Auth] getSession 失敗', result.error);
        }

        // OAuth hash 處理中：不要用可能過期的匿名 session 直接 ready
        if (self._oauthCallbackPending) {
            setTimeout(function () {
                if (self.ready || !self._oauthCallbackPending) return;
                self.client.auth.getSession().then(function (retry) {
                    if (retry.data && retry.data.session
                        && !self._sessionIsAnonymous(retry.data.session)) {
                        self._oauthCallbackPending = false;
                        self._setSession(retry.data.session);
                        self._markReady();
                        setTimeout(function () { self._cleanAuthCallbackFromUrl(); }, 1200);
                        return;
                    }
                    if (!self.ready) {
                        console.warn('[Auth] OAuth callback 逾時無 Google session，改 Anonymous');
                        self._oauthCallbackPending = false;
                        self._signInAnonymous();
                    }
                });
            }, 2500);
            return;
        }

        if (result.data && result.data.session) {
            self._setSession(result.data.session);
            self._markReady();
            return;
        }

        return self._signInAnonymous();
    }).catch(function (e) {
        console.warn('[Auth] 初始化例外', e);
        self.app.fire('auth:error', { reason: 'init_exception', error: e });
    });
};

AuthManager.prototype._sessionIsAnonymous = function (session) {
    if (!session || !session.user) return true;
    var u = session.user;
    if (u.is_anonymous === true) return true;
    if (u.app_metadata && u.app_metadata.provider === 'anonymous') return true;
    if (!u.email && u.identities && u.identities.length === 1
        && u.identities[0].provider === 'anonymous') {
        return true;
    }
    // 有 Google identity 即非匿名
    if (u.identities) {
        for (var i = 0; i < u.identities.length; i++) {
            if (u.identities[i] && u.identities[i].provider === 'google') return false;
        }
    }
    if (u.email) return false;
    return !u.email && !u.phone;
};

AuthManager.prototype._signInAnonymous = function () {
    var self = this;
    return this.client.auth.signInAnonymously().then(function (result) {
        if (result.error) {
            console.warn('[Auth] Anonymous 登入失敗', result.error);
            self.app.fire('auth:error', { reason: 'anonymous_failed', error: result.error });
            return;
        }
        if (result.data && result.data.session) {
            self._setSession(result.data.session);
        }
        self._markReady();
    });
};

AuthManager.prototype._setSession = function (session) {
    this.session = session;
    this.user = session ? session.user : null;
};

AuthManager.prototype._markReady = function () {
    if (this.ready) return;
    this.ready = true;
    console.log('[Auth] Ready — user:', this.getUserId(), 'anonymous:', this.isAnonymous(), 'email:', this.getEmail());
    this.app.fire('auth:ready', {
        userId: this.getUserId(),
        isAnonymous: this.isAnonymous()
    });
};

AuthManager.prototype.isReady = function () {
    return this.ready;
};

AuthManager.prototype.getUserId = function () {
    return this.user ? this.user.id : null;
};

AuthManager.prototype.isAnonymous = function () {
    if (!this.user) return true;
    if (this.user.is_anonymous === true) return true;
    if (this.user.is_anonymous === false) return false;
    if (this.user.email_confirmed_at) return false;
    if (this._hasGoogleIdentity()) return false;
    return !this.user.email && !this.user.phone;
};

AuthManager.prototype._hasGoogleIdentity = function () {
    var identities = this.user && this.user.identities;
    if (!identities || !identities.length) return false;
    for (var i = 0; i < identities.length; i++) {
        if (identities[i] && identities[i].provider === 'google') return true;
    }
    return false;
};

AuthManager.prototype.getClient = function () {
    return this.client;
};

AuthManager.prototype.getEmail = function () {
    return this.user && this.user.email ? this.user.email : '';
};

AuthManager.prototype.isEmailConfirmed = function () {
    return !!(this.user && this.user.email_confirmed_at);
};

AuthManager.prototype.getAccountLabel = function () {
    if (!this.ready || !this.client) return 'Offline';
    if (!this.isAnonymous()) return 'Linked';
    if (this.getEmail()) return 'Pending';
    return 'Guest';
};

/**
 * Guest 綁定 Google（保留同一 user UUID）。
 * opts.intent === 'checkout'：回跳後由 entitlementManager 自動開 Stripe。
 */
AuthManager.prototype.linkGoogle = function (opts) {
    var self = this;
    if (!this.client) {
        return Promise.resolve({ data: null, error: { message: 'invalid_request' } });
    }

    if (opts && opts.intent === 'checkout') {
        this._setCheckoutIntent();
    } else {
        this.clearCheckoutIntent();
    }

    var redirectTo = this._getEmailRedirectUrl();
    console.log('[Auth] Link Google redirectTo:', redirectTo, 'intent:', opts && opts.intent);

    return this.client.auth.linkIdentity({
        provider: 'google',
        options: {
            redirectTo: redirectTo,
            skipBrowserRedirect: true
        }
    }).then(function (result) {
        if (result.error) {
            console.warn('[Auth] linkIdentity failed', result.error);
            return result;
        }
        if (result.data && result.data.url) {
            try { sessionStorage.setItem('tk_prefer_cloud', '1'); } catch (e) { /* ignore */ }
            self._redirectToOAuthUrl(result.data.url);
        }
        return result;
    });
};

/** 跨裝置：用已綁定的 Google 帳號登入（會換成該帳號 UUID） */
AuthManager.prototype.signInWithGoogle = function () {
    var self = this;
    if (!this.client) {
        return Promise.resolve({ data: null, error: { message: 'invalid_request' } });
    }

    this.clearCheckoutIntent();
    var redirectTo = this._getEmailRedirectUrl();
    console.log('[Auth] Sign in Google redirectTo:', redirectTo);

    return this.client.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: redirectTo,
            skipBrowserRedirect: true
        }
    }).then(function (result) {
        if (result.error) {
            console.warn('[Auth] signInWithOAuth failed', result.error);
            return result;
        }
        self.app.fire('auth:signInRequested', { provider: 'google' });
        if (result.data && result.data.url) {
            try { sessionStorage.setItem('tk_prefer_cloud', '1'); } catch (e) { /* ignore */ }
            self._redirectToOAuthUrl(result.data.url);
        }
        return result;
    });
};

AuthManager.prototype.signOut = function () {
    var self = this;
    if (!this.client) return Promise.resolve();
    this.clearCheckoutIntent();
    return this.client.auth.signOut().then(function () {
        self.session = null;
        self.user = null;
        self.ready = false;
        self.app.fire('auth:signedOut');
    });
};
