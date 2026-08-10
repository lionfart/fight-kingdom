/**
 * Fight Kingdom — thin i18n (Phase A)
 * Language is stored in localStorage `tk_lang`.
 * On first run (no saved language), infer from browser locale.
 */
(function (global) {
    var STORAGE_KEY = 'tk_lang';
    var DEFAULT = 'en';
    var SUPPORTED = { 'zh-TW': true, en: true, tr: true };

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

    function readStored() {
        try {
            var saved = localStorage.getItem(STORAGE_KEY);
            if (saved === 'en') return 'en';
            if (saved === 'zh-TW' || saved === 'zh') return 'zh-TW';
            if (saved === 'tr' || saved === 'tr-TR' || saved === 'tr-tr') return 'tr';
            if (saved && SUPPORTED[saved]) return saved;
        } catch (e) {}

        var inferred = inferInitialLang();
        try { localStorage.setItem(STORAGE_KEY, inferred); } catch (e2) {}
        return inferred;
    }

    lang = readStored();

    function interpolate(str, vars) {
        if (!vars || typeof str !== 'string') return str;
        return str.replace(/\{(\w+)\}/g, function (_, key) {
            return vars[key] != null ? String(vars[key]) : '{' + key + '}';
        });
    }

    function lookup(packName, key) {
        var pack = packs[packName];
        if (!pack) return null;
        if (Object.prototype.hasOwnProperty.call(pack, key)) return pack[key];
        return null;
    }

    var TKI18n = {
        STORAGE_KEY: STORAGE_KEY,
        DEFAULT: DEFAULT,
        SUPPORTED: ['zh-TW', 'en', 'tr'],

        register: function (locale, dict) {
            if (!locale || !dict || typeof dict !== 'object') return;
            // Merge so settings / hub / feature packs can register independently
            var prev = packs[locale];
            if (!prev) {
                packs[locale] = dict;
                return;
            }
            for (var k in dict) {
                if (Object.prototype.hasOwnProperty.call(dict, k)) prev[k] = dict[k];
            }
        },

        getLang: function () {
            return lang;
        },

        setLang: function (next) {
            if (!SUPPORTED[next]) return lang;
            var changed = next !== lang;
            lang = next;
            try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
            try {
                if (typeof document !== 'undefined' && document.documentElement) {
                    var htmlLang = lang === 'zh-TW' ? 'zh-Hant' : (lang === 'tr' ? 'tr' : 'en');
                    document.documentElement.setAttribute('lang', htmlLang);
                }
            } catch (e2) {}
            if (changed) {
                try {
                    if (typeof window !== 'undefined' && window.dispatchEvent) {
                        window.dispatchEvent(new CustomEvent('tk:langChanged', { detail: { lang: lang } }));
                    }
                } catch (e3) {}
            }
            return lang;
        },

        t: function (key, vars) {
            if (!key) return '';
            var text = lookup(lang, key);
            if (text == null && lang !== DEFAULT) text = lookup(DEFAULT, key);
            if (text == null) text = key;
            return interpolate(text, vars);
        },

        /** Pick string or { 'zh-TW'|zh, en } object by current lang. */
        pick: function (obj) {
            if (obj == null) return '';
            if (typeof obj === 'string' || typeof obj === 'number') return String(obj);
            if (typeof obj !== 'object') return '';
            if (obj[lang] != null) return String(obj[lang]);
            if (lang !== 'zh-TW' && obj.en != null) return String(obj.en);
            if (obj['zh-TW'] != null) return String(obj['zh-TW']);
            if (obj.zh != null) return String(obj.zh);
            return '';
        },

        isEn: function () {
            return lang === 'en' || lang === 'tr';
        },

        /** Convenience: pick zh vs en by current lang (strings or {zh,en}). */
        tx: function (zh, en) {
            if (zh != null && typeof zh === 'object') return TKI18n.pick(zh);
            if (lang === 'zh-TW' || lang === 'zh') return zh;
            return (en != null ? en : zh);
        }
    };

    // Apply html lang once at boot
    try {
        if (typeof document !== 'undefined' && document.documentElement) {
            document.documentElement.setAttribute('lang', lang === 'zh-TW' ? 'zh-Hant' : (lang === 'tr' ? 'tr' : 'en'));
        }
    } catch (e) {}

    global.TKI18n = TKI18n;

    // Late-bind packs if locale scripts ran before i18n.js
    if (global.__TK_LOCALE_ZH_TW__) {
        TKI18n.register('zh-TW', global.__TK_LOCALE_ZH_TW__);
        try { delete global.__TK_LOCALE_ZH_TW__; } catch (e4) { global.__TK_LOCALE_ZH_TW__ = null; }
    }
    if (global.__TK_LOCALE_EN__) {
        TKI18n.register('en', global.__TK_LOCALE_EN__);
        try { delete global.__TK_LOCALE_EN__; } catch (e5) { global.__TK_LOCALE_EN__ = null; }
    }
    if (global.__TK_LOCALE_TR__) {
        TKI18n.register('tr', global.__TK_LOCALE_TR__);
        try { delete global.__TK_LOCALE_TR__; } catch (e6) { global.__TK_LOCALE_TR__ = null; }
    }
})(typeof window !== 'undefined' ? window : this);
