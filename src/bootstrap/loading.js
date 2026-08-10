pc.script.createLoadingScreen(function (app) {
    function tkIsStandalone() {
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
            if (check(window)) return true;
            if (window.top && window.top !== window.self) {
                try {
                    void window.top.location.hostname;
                    if (check(window.top)) return true;
                } catch (eTop) { /* cross-origin */ }
            }
        } catch (e) { /* ignore */ }
        return false;
    }
    var standalone = tkIsStandalone();
    var inIframe = false;
    try { inIframe = !!(window.top && window.top !== window.self); } catch (eIf) { inIframe = true; }

    // PlayCanvas 產生的 manifest start_url 為 ""，Chrome「安裝應用」會開到 manifest.json。
    // 盡早移除 link[rel=manifest]，讓「加到主畫面」改釘目前頁面網址。
    try {
        var stripManifest = function (doc) {
            if (!doc || !doc.querySelectorAll) return;
            var nodes = doc.querySelectorAll('link[rel="manifest"]');
            for (var i = 0; i < nodes.length; i++) {
                if (nodes[i].parentNode) nodes[i].parentNode.removeChild(nodes[i]);
            }
        };
        stripManifest(document);
        try {
            if (window.top && window.top !== window.self) {
                void window.top.location.hostname;
                stripManifest(window.top.document);
            }
        } catch (eTopMan) { /* cross-origin */ }
    } catch (eMan) { /* ignore */ }

    // OAuth geri dönüş hash'ini koru; PlayCanvas'e özel yönlendirme yok (kendi domainimiz).
    var oauthHash = false;
    try {
        var hash0 = window.location.hash || '';
        oauthHash = hash0.indexOf('access_token') !== -1
            || hash0.indexOf('refresh_token') !== -1
            || hash0.indexOf('code=') !== -1
            || hash0.indexOf('error=') !== -1;
    } catch (eApps) { /* ignore */ }

    // 頂層 hash 哨兵：OAuth／standalone 冷啟動不要塞 #tk（主畫面 App 易空白）
    try {
        var histWin = window;
        try {
            if (window.top && window.top !== window.self) {
                void window.top.location.hostname;
                histWin = window.top;
            }
        } catch (e2) { histWin = window; }
        var h = histWin.location.hash || '';
        var oauthOnHist = h.indexOf('access_token') !== -1
            || h.indexOf('refresh_token') !== -1
            || h.indexOf('code=') !== -1;
        if (!standalone && !histWin.__tkHistoryEarly && !oauthOnHist) {
            histWin.__tkHistoryEarly = true;
            var base = histWin.location.pathname + (histWin.location.search || '');
            if (h !== '#tk' && h !== '#tk2') {
                histWin.history.pushState({ tapKingdomGuard: true }, '', base + '#tk');
            }
            histWin.history.pushState({ tapKingdomGuard: true }, '', base + '#tk2');
        }
        var root = document.documentElement;
        var body = document.body;
        if (root) root.style.overscrollBehavior = 'none';
        if (body) body.style.overscrollBehavior = 'none';
    } catch (e3) { /* ignore */ }

    // UiTheme tokens (loading runs before UiTheme.inject)
    var TK = {
        bronze: '#c9a25a',
        gold: '#f5d27a',
        text: '#e8dcc4',
        textSub: '#9a8f7a',
        sealInk: '#f3e4d0',
        fontSerif: '"Noto Serif TC","Songti TC",serif',
        fontBody: '"Microsoft JhengHei","PingFang TC",sans-serif',
        fontNum: '"Anton",sans-serif'
    };

    if (!document.getElementById('tk-splash-fonts')) {
        var fontLink = document.createElement('link');
        fontLink.id = 'tk-splash-fonts';
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@700;900&family=Anton&display=swap';
        document.head.appendChild(fontLink);
    }

    var wrapper = document.createElement('div');
    wrapper.id = 'application-splash-wrapper';
    document.body.appendChild(wrapper);

    // 暖機 reload 第二趟：用靜態「準備畫面」蓋住，避免 0% 重跑的體感
    var isWarmPass = false;
    try { isWarmPass = sessionStorage.getItem('tk_gl_warming') === '1'; } catch (eWarm0) {}

    // First-run language: if tk_lang is missing, infer from browser locale and persist.
    // This keeps loading screen copy consistent with character select.
    try {
        var tkSaved = localStorage.getItem('tk_lang');
        if (!tkSaved) {
            var navLang = '';
            try {
                if (navigator && navigator.languages && navigator.languages.length && navigator.languages[0]) {
                    navLang = navigator.languages[0];
                } else {
                    navLang = (navigator && (navigator.language || navigator.userLanguage || navigator.browserLanguage)) || '';
                }
            } catch (eNav) {}
            navLang = String(navLang || '').toLowerCase();
            var inferred = 'en';
            if (navLang.indexOf('zh') === 0 || navLang.indexOf('zh-') !== -1 || navLang.indexOf('zh_') !== -1) inferred = 'zh-TW';
            else if (navLang.indexOf('tr') === 0 || navLang.indexOf('tr-') !== -1 || navLang.indexOf('tr_') !== -1) inferred = 'tr';
            localStorage.setItem('tk_lang', inferred);
        }
    } catch (e) {}

    var splashLang = (function () {
        try { return localStorage.getItem('tk_lang'); } catch (e) { return 'en'; }
    })();
    if (splashLang !== 'en' && splashLang !== 'tr' && splashLang !== 'zh-TW' && splashLang !== 'zh') splashLang = 'en';
    var splashPick = function (zh, en) { return (splashLang === 'tr' || splashLang === 'en') ? en : zh; };

    // 頁面底色與 splash 一致，reload 空隙不閃白
    try {
        document.documentElement.style.backgroundColor = '#0e0c09';
        if (document.body) document.body.style.backgroundColor = '#0e0c09';
    } catch (eBg) { /* ignore */ }

    var bg = document.createElement('div');
    bg.id = 'splash-bg';
    wrapper.appendChild(bg);

    var splashTop = document.createElement('div');
    splashTop.id = 'splash-top';
    wrapper.appendChild(splashTop);

    var logoAsset = app.assets.find('logo.png');
    if (logoAsset) {
        var logoImg = document.createElement('img');
        logoImg.id = 'splash-logo-image';
        var applyLogo = function () { logoImg.src = logoAsset.getFileUrl(); };
        if (logoAsset.resource) { applyLogo(); }
        else { logoAsset.once('load', applyLogo); app.assets.load(logoAsset); }
        splashTop.appendChild(logoImg);
    } else {
        var logoText = document.createElement('h1');
        logoText.id = 'splash-logo-text';
        logoText.innerText = splashPick('FIGHT KINGDOM', 'FIGHT KINGDOM');
        splashTop.appendChild(logoText);
    }

    var splashMid = document.createElement('div');
    splashMid.id = 'splash-mid';
    wrapper.appendChild(splashMid);

    var sealLine = document.createElement('div');
    sealLine.id = 'splash-seal-line';
    sealLine.setAttribute('aria-live', 'polite');
    splashMid.appendChild(sealLine);

    var sealBtn = document.createElement('button');
    sealBtn.id = 'splash-seal';
    sealBtn.type = 'button';
    sealBtn.setAttribute('aria-label', splashPick('蓋印', 'Stamp'));
    var sealChar = document.createElement('span');
    sealChar.id = 'splash-seal-char';
    sealChar.innerText = splashPick('戰', 'WAR');
    sealBtn.appendChild(sealChar);
    splashMid.appendChild(sealBtn);

    var sealHint = document.createElement('div');
    sealHint.id = 'splash-seal-hint';
    sealHint.innerText = splashPick('覺醒待戰', 'Stamp to ready');
    splashMid.appendChild(sealHint);

    var splashBottom = document.createElement('div');
    splashBottom.id = 'splash-bottom';
    wrapper.appendChild(splashBottom);

    var statusRow = document.createElement('div');
    statusRow.id = 'splash-status-row';
    statusRow.innerHTML =
        '<span id="splash-loading-text">' +
        (isWarmPass ? splashPick('準備畫面', 'Preparing') : splashPick('載入中', 'Loading')) +
        '</span>' +
        '<span id="splash-percent">' + (isWarmPass ? '' : '0%') + '</span>';
    splashBottom.appendChild(statusRow);

    var container = document.createElement('div');
    container.id = 'progress-bar-container';
    splashBottom.appendChild(container);

    var bar = document.createElement('div');
    bar.id = 'progress-bar';
    if (isWarmPass) bar.style.width = '100%';
    container.appendChild(bar);

    var tip = document.createElement('div');
    tip.id = 'splash-tip';
    splashBottom.appendChild(tip);

    if (isWarmPass) {
        // 暖機第二趟仍顯示戰印／提示，長等待可蓋印打發時間（只低調進度條）
        wrapper.classList.add('tk-splash-warm');
    }

    // Fine grain via inline SVG (no external image)
    var noiseSvg = "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")";

    var css = [
        'body{background-color:#0e0c09;margin:0;}',

        '#application-splash-wrapper{',
        'position:absolute;top:0;left:0;height:100%;width:100%;',
        'background-color:#0e0c09;z-index:9999;overflow:hidden;',
        'display:flex;flex-direction:column;box-sizing:border-box;',
        'padding:max(16px,env(safe-area-inset-top,0px)) 20px max(20px,env(safe-area-inset-bottom,0px));',
        '}',

        /* 漆黑質感：深径向 + 微grain + 暗角（無背景圖） */
        '#splash-bg{position:absolute;top:0;left:0;width:100%;height:100%;z-index:0;',
        'background:',
        'radial-gradient(120% 90% at 50% 18%,#241b10 0%,#1c150e 42%,#0e0c09 78%,#070605 100%),',
        noiseSvg + ';',
        'background-blend-mode:normal,overlay;',
        '}',
        '#splash-bg::after{content:"";position:absolute;inset:0;pointer-events:none;',
        'background:radial-gradient(ellipse at center,transparent 42%,rgba(0,0,0,0.55) 100%);',
        '}',

        '#splash-top,#splash-mid,#splash-bottom{position:relative;z-index:10;width:100%;',
        'display:flex;flex-direction:column;align-items:center;}',
        '#splash-top{flex:0 0 auto;padding-top:8px;}',
        '#splash-mid{flex:1 1 auto;justify-content:center;gap:14px;min-height:0;}',
        '#splash-bottom{flex:0 0 auto;gap:10px;padding-bottom:4px;}',

        '#splash-logo-image{max-width:72%;max-height:120px;object-fit:contain;',
        'filter:drop-shadow(0 8px 14px rgba(0,0,0,0.75));',
        'animation:splashBreathe 2.4s ease-in-out infinite;}',
        '#splash-logo-text{margin:0;font-family:' + TK.fontSerif + ';font-weight:900;',
        'font-size:clamp(32px,5.5vw,48px);color:' + TK.gold + ';letter-spacing:6px;',
        'text-align:center;line-height:1;text-shadow:0 3px 12px rgba(0,0,0,0.85);',
        'animation:splashBreathe 2.4s ease-in-out infinite;}',
        '@keyframes splashBreathe{0%,100%{transform:scale(1);opacity:0.96;}50%{transform:scale(1.03);opacity:1;}}',

        '#splash-seal-line{min-height:2.6em;max-width:86%;padding:0 8px;text-align:center;',
        'font-family:' + TK.fontBody + ';font-size:16px;line-height:1.45;color:' + TK.textSub + ';',
        'text-shadow:0 1px 3px rgba(0,0,0,0.85);opacity:0;transition:opacity 0.25s ease;}',
        '#splash-seal-line.show{opacity:1;}',

        '#splash-seal{width:110px;height:110px;border:none;padding:0;cursor:pointer;',
        'border-radius:6px;flex-shrink:0;',
        'background:linear-gradient(160deg,#c23c30,#8e2419);',
        'display:flex;align-items:center;justify-content:center;',
        'font-family:' + TK.fontSerif + ';font-weight:900;font-size:52px;color:' + TK.sealInk + ';',
        'transform:rotate(-4deg);',
        'box-shadow:0 3px 10px rgba(176,52,42,0.5),inset 0 0 0 2px rgba(243,228,208,0.28);',
        'touch-action:manipulation;-webkit-tap-highlight-color:transparent;',
        'animation:splashSealIdle 2.4s ease-in-out infinite;}',
        '#splash-seal:active{transform:rotate(-4deg) scale(0.92);}',
        '#splash-seal.stamp{animation:csStamp 0.38s cubic-bezier(0.2,1.6,0.4,1);}',
        '@keyframes splashSealIdle{0%,100%{transform:rotate(-4deg) scale(1);}50%{transform:rotate(-4deg) scale(1.03);}}',
        '@keyframes csStamp{',
        '0%{transform:scale(1.9) rotate(-14deg);opacity:0;}',
        '60%{transform:scale(0.94) rotate(-3deg);opacity:1;}',
        '100%{transform:scale(1) rotate(-4deg);}',
        '}',

        '#splash-seal-char{display:inline-block;line-height:1;',
        'transform:scale(var(--seal-char-scale,1));',
        'transition:transform 0.18s cubic-bezier(0.2,1.4,0.4,1);',
        'will-change:transform;}',
        '#splash-seal-char.bounce-back{',
        'animation:sealCharBounce 0.55s cubic-bezier(0.34,1.56,0.64,1);}',
        '@keyframes sealCharBounce{',
        '0%{transform:scale(var(--seal-char-from,1.9));}',
        '55%{transform:scale(0.88);}',
        '78%{transform:scale(1.08);}',
        '100%{transform:scale(1);}',
        '}',

        '#splash-seal-hint{font-family:' + TK.fontBody + ';font-size:16px;letter-spacing:2px;',
        'text-align:center;color:' + TK.textSub + ';opacity:0.85;}',

        '#splash-status-row{display:flex;align-items:baseline;justify-content:space-between;',
        'width:88%;max-width:400px;box-sizing:border-box;}',
        '#splash-loading-text{font-family:' + TK.fontBody + ';color:' + TK.bronze + ';',
        'font-size:13px;letter-spacing:2px;}',
        '#splash-loading-text::after{content:"";animation:splashDots 1.4s steps(4,end) infinite;}',
        '@keyframes splashDots{0%{content:"";}25%{content:".";}50%{content:"..";}75%{content:"...";}}',
        '#splash-percent{font-family:' + TK.fontNum + ';letter-spacing:1px;',
        'color:' + TK.text + ';font-size:20px;min-width:48px;text-align:right;',
        'text-shadow:0 2px 4px rgba(0,0,0,0.8);}',

        '#progress-bar-container{width:88%;max-width:400px;height:8px;',
        'background:rgba(232,220,196,0.1);border-radius:4px;overflow:hidden;position:relative;',
        'border:1px solid rgba(201,162,90,0.45);}',
        '#progress-bar{width:0%;height:100%;position:relative;',
        'background:linear-gradient(90deg,' + TK.bronze + ',' + TK.gold + ');',
        'transition:width 0.2s ease-out;}',
        '#progress-bar::after{content:"";position:absolute;top:0;left:0;height:100%;width:40%;',
        'background:linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent);',
        'animation:splashShine 1.3s linear infinite;}',
        '@keyframes splashShine{0%{transform:translateX(-120%);}100%{transform:translateX(350%);}}',

        '#splash-tip{max-width:88%;min-height:18px;text-align:center;',
        'font-family:' + TK.fontBody + ';font-size:12px;line-height:1.45;color:' + TK.textSub + ';',
        'opacity:0;transition:opacity 0.45s ease;text-shadow:0 1px 3px rgba(0,0,0,0.9);}',

        /* 暖機第二趟：低調進度（不重跑 0%），戰印／提示照常可互動 */
        '#application-splash-wrapper.tk-splash-warm #splash-percent{display:none !important;}',
        '#application-splash-wrapper.tk-splash-warm #progress-bar{width:100% !important;',
        'animation:tkWarmPulse 1.2s ease-in-out infinite;}',
        '#application-splash-wrapper.tk-splash-warm #progress-bar::after{display:none;}',
        '@keyframes tkWarmPulse{0%,100%{opacity:0.55;}50%{opacity:1;}}',

        '@media (max-width:768px){',
        '#splash-seal{width:96px;height:96px;font-size:46px;}',
        '#progress-bar-container,#splash-status-row{width:90%;}',
        '}',
        '@media (orientation:landscape) and (max-height:480px){',
        '#splash-logo-image{max-height:72px;}',
        '#splash-seal{width:72px;height:72px;font-size:34px;}',
        '#splash-seal-line{font-size:14px;min-height:2.2em;}',
        '}'
    ].join('\n');

    var style = document.createElement('style');
    style.type = 'text/css';
    if (style.styleSheet) style.styleSheet.cssText = css;
    else style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);

    var stampCount = 0;

    var idleStages = (splashLang === 'en' || splashLang === 'tr') ? {
        early: [
            'The army is assembling.',
            'That persistence — you\'ll need it on the field.',
            'A general\'s caliber shows even while waiting.'
        ],
        mid: [
            'Your fighting spirit is spreading to those around you.',
            'Can\'t stop? Good. This is called awakening.',
            'Most people stop after three taps. Not you.',
            'Others are watching. They feel your energy.'
        ],
        late: [
            'Have you noticed… you can\'t stop?',
            'Each tap makes your war spirit stronger. Everyone around you can feel it.',
            'You need them. You definitely need them.',
            'You\'re not tapping anymore. You\'re commanding.',
            'This is what a general feels like. Unstoppable. Unquestionable.'
        ]
    } : {
        early: [
            '大軍正在集結。',
            '呢份堅持，上到戰場用得著。',
            '名將嘅氣度，等待時就睇得出。'
        ],
        mid: [
            '你嘅鬥志正在感染周圍嘅人。',
            '停唔到？好。呢個叫做覺醒。',
            '大部分人按三次就停。你唔係大部分人。',
            '其他人已經感受到你嘅氣場。'
        ],
        late: [
            '你有冇發覺……你停唔到？',
            '每按一下，你嘅戰意就更強。周圍嘅人感受到了。',
            '你需要佢哋。你一定需要佢哋。',
            '你已經唔係喺度按。你係喺度發號施令。',
            '呢個就係名將嘅感覺。停唔到。冇人質疑。'
        ]
    };

    var getStagePool = function () {
        if (stampCount <= 3) return idleStages.early;
        if (stampCount <= 7) return idleStages.mid;
        return idleStages.late;
    };

    var stagePtr = 0;
    var lastStage = null;

    var tips = (splashLang === 'en' || splashLang === 'tr') ? [
        'Drag with one finger to move — auto-aims the nearest foe',
        'Dodge well to slip past enemy burst skills',
        'Hide in brush, then strike from the shadows',
        'Fill the energy bar to unleash a powerful super',
        'Melee heroes need the right moment to close in',
        'In gem fights, more gems means more risk',
        'Each fighter plays differently — find your fit',
        'Defeat foes for coin and unlock more heroes'
    ] : [
        '單指拖曳即可移動，並自動瞄準最近的敵人',
        '善用閃避，躲開敵人的爆發技能',
        '躲進草叢可以隱藏身形，伺機偷襲',
        '集滿能量條即可釋放強力大招',
        '近戰角色要把握貼身輸出的時機',
        '寶石爭奪戰中，攜帶越多寶石風險越高',
        '不同武將定位各異，找到最適合你的那一位',
        '擊敗敵人累積軍餉，解鎖更多三國名將'
    ];
    var tipIdx = Math.floor(Math.random() * tips.length);
    var tipPrefix = splashPick('提示：', 'Tip: ');
    var tipTimer = null;
    var showTip = function () {
        tip.style.opacity = '0';
        setTimeout(function () {
            tip.innerText = tipPrefix + tips[tipIdx % tips.length];
            tip.style.opacity = '1';
            tipIdx++;
        }, 280);
    };
    showTip();
    tipTimer = setInterval(showTip, 3200);

    var dismissed = false;
    var stampCooldownUntil = 0;

    // 「按」字越按越大，滿級後回彈回初始大小
    var SEAL_CHAR_SCALES = [1, 1.18, 1.38, 1.62, 1.9];
    var sealCharLevel = 0;
    var sealCharBounceTimer = null;

    var setSealCharScale = function (scale) {
        sealChar.style.setProperty('--seal-char-scale', String(scale));
    };
    setSealCharScale(SEAL_CHAR_SCALES[0]);

    var growOrBounceSealChar = function () {
        if (sealCharBounceTimer) {
            clearTimeout(sealCharBounceTimer);
            sealCharBounceTimer = null;
        }
        sealChar.classList.remove('bounce-back');

        if (sealCharLevel >= SEAL_CHAR_SCALES.length - 1) {
            var from = SEAL_CHAR_SCALES[sealCharLevel];
            sealChar.style.setProperty('--seal-char-from', String(from));
            sealChar.style.transition = 'none';
            sealCharLevel = 0;
            setSealCharScale(SEAL_CHAR_SCALES[0]);
            void sealChar.offsetWidth;
            sealChar.classList.add('bounce-back');
            sealCharBounceTimer = setTimeout(function () {
                sealChar.classList.remove('bounce-back');
                sealChar.style.transition = '';
                sealCharBounceTimer = null;
            }, 560);
            return true;
        }

        sealCharLevel += 1;
        setSealCharScale(SEAL_CHAR_SCALES[sealCharLevel]);
        return false;
    };

    var hideSplash = function () {
        if (dismissed) return;
        dismissed = true;
        if (tipTimer) { clearInterval(tipTimer); tipTimer = null; }
        if (sealCharBounceTimer) { clearTimeout(sealCharBounceTimer); sealCharBounceTimer = null; }
        // 首次 layout／iframe：splash 收起時刷新 canvas，避免 0-size 或未重繪黑畫面
        try {
            if (app && app.updateCanvasSize) app.updateCanvasSize();
        } catch (eResize) { /* ignore */ }
        wrapper.style.transition = 'opacity 0.45s ease';
        wrapper.style.opacity = '0';
        setTimeout(function () {
            if (wrapper.parentElement) wrapper.parentElement.removeChild(wrapper);
            try {
                if (app && app.updateCanvasSize) app.updateCanvasSize();
            } catch (eResize2) { /* ignore */ }
        }, 450);
    };

    var playStamp = function () {
        sealBtn.classList.remove('stamp');
        void sealBtn.offsetWidth;
        sealBtn.classList.add('stamp');
        try {
            if (navigator.vibrate) navigator.vibrate(12);
        } catch (e) { /* ignore */ }
    };

    var nextIdleLine = function () {
        stampCount++;
        var pool = getStagePool();

        if (pool !== lastStage) {
            stagePtr = 0;
            lastStage = pool;
        }

        var line = pool[stagePtr % pool.length];
        stagePtr++;

        sealLine.classList.remove('show');
        void sealLine.offsetWidth;
        sealLine.innerText = line;
        sealLine.classList.add('show');
    };

    sealBtn.addEventListener('click', function (e) {
        if (e) e.preventDefault();
        if (dismissed) return;
        var now = Date.now();
        if (now < stampCooldownUntil) return;
        stampCooldownUntil = now + 120;
        playStamp();
        growOrBounceSealChar();
        nextIdleLine();
    });

    var setProgress = function (value) {
        if (isWarmPass) return; // 暖機趟不重跑 0%→100%
        value = Math.min(1, Math.max(0, value));
        var b = document.getElementById('progress-bar');
        var p = document.getElementById('splash-percent');
        if (b) b.style.width = (value * 100) + '%';
        if (p) p.innerText = Math.round(value * 100) + '%';
    };

    app.on('preload:progress', setProgress);
    // 無痕／冷啟動：splash 仍蓋住時靜默暖機 reload；第二趟用「準備畫面」低調過渡再進大廳。
    app.on('start', function () {
        try {
            if (sessionStorage.getItem('tk_gl_warming') === '1') {
                sessionStorage.removeItem('tk_gl_warming');
                hideSplash();
                return;
            }
            if (!sessionStorage.getItem('tk_gl_warmed')) {
                sessionStorage.setItem('tk_gl_warmed', '1');
                sessionStorage.setItem('tk_gl_warming', '1');
                // 不淡出 splash，維持墨色滿版再 reload，減少閃爍
                try {
                    document.documentElement.style.backgroundColor = '#0e0c09';
                    if (document.body) document.body.style.backgroundColor = '#0e0c09';
                    wrapper.style.opacity = '1';
                    wrapper.style.transition = 'none';
                } catch (eKeep) { /* ignore */ }
                window.location.reload();
                return;
            }
        } catch (eWarm) { /* private mode quirks — fall through */ }
        hideSplash();
    });
});
