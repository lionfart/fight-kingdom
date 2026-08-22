// ═══════════════════════════════════════════════════════════════
// UiTheme — 全遊戲 DOM UI 主題（characterSelect_mockup 漆器青銅調）
// Load before scoreManager / rogueDirector / gameSettings / characterSelect
// ═══════════════════════════════════════════════════════════════
var UiTheme = {
    STYLE_ID: 'ui-theme-style',
    VERSION: 39,

    injectFonts: function() {
        if (document.getElementById('ui-theme-fonts')) return;
        var link = document.createElement('link');
        link.id = 'ui-theme-fonts';
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@700;900&family=Anton&display=swap';
        document.head.appendChild(link);
    },

    inject: function() {
        this.injectFonts();
        var existing = document.getElementById(this.STYLE_ID);
        if (existing && existing.getAttribute('data-v') === String(this.VERSION)) return;
        if (existing) existing.remove();
        var st = document.createElement('style');
        st.id = this.STYLE_ID;
        st.setAttribute('data-v', String(this.VERSION));
        st.textContent = this._buildCss();
        document.head.appendChild(st);
    },

    _buildCss: function() {
        return this._tokensAndShared() + this._hudCss() + this._announcerCss() + this._rosterCss() +
            this._hubCss() + this._settingsCss() + this._lobbyCss() + this._lobbyCssV2() + this._endScreenCss();
    },

    _tokensAndShared: function() {
        return '' +
        ':root{' +
        '--tk-ink:#0e0c09;--tk-lacquer:#1c150e;--tk-bronze:#c9a25a;--tk-gold:#f5d27a;' +
        '--tk-gold-soft:#f5d27a;--tk-gold-text:#ffe9a8;--tk-seal:#b0342a;' +
        '--tk-text:#e8dcc4;--tk-text-muted:#d8ccb8;--tk-text-sub:#9a8f7a;' +
        '--tk-faction-wei:#1E88E5;--tk-faction-shu:#43A047;--tk-faction-wu:#E53935;--tk-faction-qun:#FBC02D;' +
        '--tk-team-blue:#1E88E5;--tk-team-red:#E53935;' +
        '--tk-announcer-intro-title:clamp(28px,7vw,84px);' +
        '--tk-announcer-intro-count:clamp(70px,24.5vw,245px);' +
        '--tk-announcer-intro-battle:clamp(56px,17.5vw,175px);' +
        '--tk-announcer-round:clamp(20px,3.85vw,36px);' +
        '--tk-announcer-result:clamp(25px,5.6vw,56px);' +
        '--tk-overlay-bg:radial-gradient(120% 90% at 50% 0%,#241b10 0%,rgba(14,12,9,0.97) 62%);' +
        '--tk-panel-bg:linear-gradient(180deg,rgba(34,26,18,0.96),rgba(21,16,11,0.98));' +
        '--tk-panel-border:2px solid rgba(201,162,90,0.55);' +
        '--tk-panel-glow:0 12px 40px rgba(0,0,0,0.65),inset 0 0 0 1px rgba(201,162,90,0.12);' +
        '--tk-font-serif:"Noto Serif TC","Songti TC",serif;' +
        '--tk-font-display:var(--tk-font-serif);' +
        '--tk-font-body:"Microsoft JhengHei","PingFang TC",sans-serif;' +
        '--tk-font-num:"Anton",sans-serif;' +
        '--tk-anim-pop:cubic-bezier(0.175,0.885,0.32,1.5);' +
        '--tk-sat:env(safe-area-inset-top,0px);--tk-sab:env(safe-area-inset-bottom,0px);' +
        '}' +

        '.tk-serif{font-family:var(--tk-font-serif);}' +
        '.tk-num{font-family:var(--tk-font-num);letter-spacing:1px;}' +

        '.tk-overlay{background:var(--tk-overlay-bg);color:var(--tk-text);' +
        'font-family:var(--tk-font-body);}' +
        'body > .tk-overlay,#mc-lb-overlay,#rbs-preview-overlay{position:fixed;inset:0;z-index:8000;' +
        'display:flex;align-items:center;justify-content:center;pointer-events:auto;' +
        'padding:max(20px,env(safe-area-inset-top)) 16px max(20px,env(safe-area-inset-bottom));' +
        'box-sizing:border-box;overflow-y:auto;-webkit-overflow-scrolling:touch;}' +
        '.tk-overlay-wrap{margin:auto 0;width:100%;display:flex;flex-direction:column;align-items:center;gap:16px;flex-shrink:0;}' +
        '.tk-overlay-title{color:var(--tk-gold);font-family:var(--tk-font-serif);font-weight:900;' +
        'font-size:clamp(18px,4.5vw,28px);letter-spacing:3px;text-align:center;' +
        'text-shadow:0 2px 8px rgba(0,0,0,0.8);flex-shrink:0;}' +
        '.tk-overlay-hint{color:var(--tk-text-sub);font-size:12px;font-family:var(--tk-font-body);letter-spacing:0.5px;flex-shrink:0;}' +

        '.tk-panel{background:var(--tk-panel-bg);border:var(--tk-panel-border);border-radius:14px;' +
        'box-shadow:var(--tk-panel-glow);text-align:center;color:var(--tk-text);}' +
        '.tk-panel-title{color:var(--tk-gold);font-family:var(--tk-font-serif);font-weight:900;' +
        'font-size:clamp(20px,4vw,26px);letter-spacing:2px;text-shadow:0 2px 6px rgba(0,0,0,0.8);margin-bottom:8px;}' +
        '.tk-panel-sub{color:var(--tk-text-sub);font-size:15px;font-family:var(--tk-font-body);margin-bottom:20px;}' +
        '.tk-panel-btns{display:flex;flex-direction:column;gap:10px;}' +
        '.tk-panel-hint{color:var(--tk-text-sub);font-size:12px;font-family:var(--tk-font-body);margin-top:14px;}' +

        '.tk-card{position:relative;cursor:pointer;overflow:hidden;' +
        'background:linear-gradient(180deg,#2a2118,#171009);' +
        'border:1.5px solid rgba(232,220,196,0.18);border-radius:12px;' +
        'box-shadow:0 4px 12px rgba(0,0,0,0.45);' +
        'border-left:4px solid var(--tk-accent,var(--tk-bronze));}' +
        '.tk-card.tk-card-rare{border-color:rgba(245,210,122,0.65);' +
        'box-shadow:0 0 20px rgba(245,210,122,0.28),0 4px 12px rgba(0,0,0,0.5);}' +
        '.tk-card-selected{border-color:var(--tk-gold) !important;' +
        'box-shadow:0 0 0 1px var(--tk-gold),0 6px 18px rgba(0,0,0,0.65),0 0 18px rgba(245,210,122,0.35) !important;}' +

        '.tk-card-name{color:var(--tk-gold);font-family:var(--tk-font-serif);font-weight:900;' +
        'text-shadow:0 2px 6px rgba(0,0,0,0.8);}' +
        '.tk-card-stat{color:var(--tk-gold-text);font-family:var(--tk-font-body);font-weight:bold;}' +
        '.tk-card-desc{color:var(--tk-text-sub);font-family:var(--tk-font-body);word-break:break-word;line-height:1.45;}' +
        '.tk-card-foot{color:var(--tk-text-sub);font-family:var(--tk-font-body);border-top:1px solid rgba(201,162,90,0.25);}' +

        '.tk-badge{font-size:9px;padding:2px 7px;border-radius:3px;letter-spacing:1px;' +
        'font-family:var(--tk-font-body);border:1px solid rgba(201,162,90,0.45);' +
        'color:var(--tk-bronze);background:rgba(201,162,90,0.1);}' +
        '.tk-badge-rarity-n{background:rgba(232,220,196,0.06);color:var(--tk-text-muted);border-color:rgba(232,220,196,0.15);}' +
        '.tk-badge-rarity-r{background:linear-gradient(180deg,#f5d27a,#c9a25a);color:#241a08;border-color:#f5d27a;}' +

        '.tk-input{width:100%;padding:14px 12px;font-size:clamp(18px,3vw,24px);font-family:var(--tk-font-body);' +
        'background:rgba(14,12,9,0.75);color:var(--tk-gold);border:1px solid rgba(201,162,90,0.45);border-radius:10px;' +
        'box-shadow:inset 0 3px 8px rgba(0,0,0,0.7);text-align:center;box-sizing:border-box;outline:none;' +
        'letter-spacing:2px;}' +
        '.tk-input::placeholder{color:rgba(201,162,90,0.35);}' +

        '.tk-btn{border:none;border-radius:12px;cursor:pointer;transition:transform 0.08s ease,box-shadow 0.08s ease;}' +
        '.tk-btn-primary{padding:14px 44px;background:linear-gradient(180deg,#2e6b3e,#1f4a2c);color:#fff;' +
        'font-family:var(--tk-font-body);font-size:clamp(16px,3.2vw,20px);font-weight:bold;letter-spacing:1px;' +
        'box-shadow:0 4px 0 #145523,0 6px 14px rgba(0,0,0,0.45);}' +
        '.tk-btn-primary:active{transform:translateY(3px);box-shadow:0 1px 0 #145523;}' +
        '.tk-btn-gold{padding:14px 0;background:linear-gradient(180deg,#f5d27a,#c9a25a 55%,#a8823f);color:#241a08;' +
        'font-family:var(--tk-font-serif);font-weight:900;font-size:clamp(18px,3.4vw,22px);' +
        'letter-spacing:8px;text-indent:8px;text-align:center;' +
        'box-shadow:0 4px 0 #6e5424,0 8px 18px rgba(201,162,90,0.35),inset 0 1px 0 rgba(255,255,255,0.45);}' +
        '.tk-btn-gold:active{transform:translateY(3px);box-shadow:0 1px 0 #6e5424;}' +
        '.tk-btn-danger{padding:12px 0;background:linear-gradient(180deg,#c23c30,#8e2419);color:#f3e4d0;' +
        'font-family:var(--tk-font-body);font-size:17px;font-weight:bold;letter-spacing:1px;' +
        'box-shadow:0 4px 0 #5a1810,0 6px 12px rgba(0,0,0,0.45);}' +
        '.tk-btn-danger:active{transform:translateY(3px);box-shadow:0 1px 0 #5a1810;}' +
        '.tk-btn-secondary{padding:14px 16px;background:rgba(201,162,90,0.08);color:var(--tk-gold-text);' +
        'font-family:var(--tk-font-body);font-size:clamp(15px,3vw,18px);' +
        'border:1px solid rgba(201,162,90,0.45);box-shadow:0 3px 0 rgba(0,0,0,0.4);}' +
        '.tk-btn-secondary:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(0,0,0,0.4);}' +
        '.tk-btn-ghost{padding:12px 16px;background:none;color:var(--tk-text-sub);' +
        'font-family:var(--tk-font-body);font-size:clamp(14px,2.8vw,17px);' +
        'border:1px solid rgba(201,162,90,0.35);border-radius:8px;box-shadow:none;}' +
        '.tk-btn-ghost:active{transform:translateY(1px);background:rgba(201,162,90,0.08);}' +
        '.tk-btn-blue{padding:12px 0;background:linear-gradient(180deg,#42A5F5,#1565C0);color:#fff;' +
        'font-family:var(--tk-font-body);font-size:17px;font-weight:bold;box-shadow:0 4px 0 #0d47a1;}' +
        '.tk-btn-blue:active{transform:translateY(3px);box-shadow:0 1px 0 #0d47a1;}' +
        '.tk-btn-orange{padding:12px 0;background:linear-gradient(180deg,#fb8c00,#e65100);color:#fff;' +
        'font-family:var(--tk-font-body);font-size:17px;font-weight:bold;box-shadow:0 4px 0 #bf360c;}' +
        '.tk-btn-orange:active{transform:translateY(3px);box-shadow:0 1px 0 #bf360c;}' +
        '.tk-btn-block{width:100%;display:block;box-sizing:border-box;}' +
        '.tk-btn-flex{flex:1;min-width:0;}' +
        '.tk-btn-flex-2{flex:2;min-width:0;}' +
        '.tk-btn:disabled,.tk-btn.tk-btn-disabled{opacity:0.45;cursor:not-allowed;}' +

        '.tk-coin{width:16px;height:16px;border-radius:50%;flex-shrink:0;' +
        'background:radial-gradient(circle at 35% 30%,#ffe9a8,#c9a25a 70%);' +
        'box-shadow:inset 0 0 0 2px rgba(0,0,0,0.25);}' +

        '@keyframes tkFade{from{opacity:0;}to{opacity:1;}}' +
        '@keyframes tkCardIn{from{opacity:0;transform:translateY(18px);}to{opacity:1;transform:none;}}' +
        '@keyframes tkTitlePop{0%{transform:scale(0.92);opacity:0;}100%{transform:scale(1);opacity:1;}}';
    },

    _announcerCss: function() {
        return '' +
        '@keyframes tkAnnouncerPop{0%{transform:translate(-50%,-50%) scale(0.3);opacity:0;}' +
        '40%{transform:translate(-50%,-50%) scale(1.08);opacity:1;}' +
        '100%{transform:translate(-50%,-50%) scale(1);opacity:1;}}' +
        '@keyframes tkAlertPulse{0%{transform:translateX(-50%) scale(1);}' +
        '50%{transform:translateX(-50%) scale(1.08);}100%{transform:translateX(-50%) scale(1);}}' +

        '#brawl-intro-text.tk-announcer-intro{position:absolute;top:40%;left:50%;transform:translate(-50%,-50%);' +
        'pointer-events:none;z-index:9999;display:none;text-align:center;width:100%;box-sizing:border-box;' +
        'padding:0 16px;word-wrap:break-word;line-height:1.15;margin:0;' +
        'font-family:var(--tk-font-serif);font-weight:900;letter-spacing:4px;' +
        'text-shadow:0 4px 12px rgba(0,0,0,0.85),0 0 24px rgba(0,0,0,0.5);}' +
        '#brawl-intro-text.tk-announcer-intro-title{color:var(--tk-gold);font-size:var(--tk-announcer-intro-title);}' +
        '#brawl-intro-text.tk-announcer-intro-count{color:var(--tk-gold);font-family:var(--tk-font-num);letter-spacing:2px;font-size:var(--tk-announcer-intro-count);}' +
        '#brawl-intro-text.tk-announcer-intro-battle{color:var(--tk-seal);letter-spacing:6px;font-size:var(--tk-announcer-intro-battle);}' +

        '#knockout-announcer.tk-announcer-overlay{position:absolute;top:0;left:0;width:100%;height:100%;' +
        'display:flex;flex-direction:column;justify-content:center;align-items:center;' +
        'background:rgba(14,12,9,0.72);z-index:800;pointer-events:none;opacity:0;transition:opacity 0.3s ease;}' +
        '#announcer-round.tk-announcer-round{width:92vw;max-width:900px;text-align:center;box-sizing:border-box;' +
        'padding:0 12px;line-height:1.15;word-break:keep-all;overflow-wrap:anywhere;' +
        'font-family:var(--tk-font-serif);font-weight:900;font-size:var(--tk-announcer-round);' +
        'color:var(--tk-text);text-shadow:0 3px 10px rgba(0,0,0,0.85);margin-bottom:12px;letter-spacing:3px;' +
        'transform:scale(0.88);transition:transform 0.5s var(--tk-anim-pop);}' +
        '#announcer-result.tk-announcer-result{width:92vw;max-width:900px;text-align:center;box-sizing:border-box;' +
        'padding:0 12px;line-height:1.1;word-break:keep-all;overflow-wrap:anywhere;' +
        'font-family:var(--tk-font-serif);font-weight:900;font-size:var(--tk-announcer-result);letter-spacing:4px;' +
        'text-shadow:0 4px 14px rgba(0,0,0,0.9);transform:scale(0.88);transition:transform 0.5s var(--tk-anim-pop);}' +
        '#announcer-result.tk-announcer-team-blue{color:var(--tk-team-blue);}' +
        '#announcer-result.tk-announcer-team-red{color:var(--tk-team-red);}' +
        '#announcer-result.tk-announcer-draw{color:var(--tk-gold);}' +

        '.tk-banner{position:fixed;top:46px;left:50%;transform:translateX(-50%) scale(0.96);' +
        'z-index:6500;max-width:min(88vw,520px);pointer-events:none;opacity:0;display:none;' +
        'background:linear-gradient(180deg,#221a12,#15100b);border:1px solid var(--tk-banner-accent,var(--tk-gold));' +
        'border-radius:8px;padding:4px 12px;box-shadow:0 2px 10px rgba(0,0,0,0.55);' +
        'transition:opacity 0.2s ease,transform 0.2s ease;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
        '.tk-banner.show{display:block;opacity:1;transform:translateX(-50%) scale(1);}' +
        '.tk-banner-line{font-family:var(--tk-font-body);font-size:13px;font-weight:700;letter-spacing:0.3px;' +
        'color:var(--tk-banner-text,var(--tk-gold));line-height:1.25;text-shadow:1px 1px 0 rgba(0,0,0,0.85);}' +
        '.tk-banner-team-blue{--tk-banner-accent:var(--tk-team-blue);--tk-banner-text:var(--tk-team-blue);}' +
        '.tk-banner-team-red{--tk-banner-accent:var(--tk-team-red);--tk-banner-text:var(--tk-team-red);}';
    },

    _hudCss: function() {
        return '' +
        '#prog-bar{position:fixed;top:8px;right:10px;z-index:5500;display:flex;align-items:center;gap:10px;' +
        'background:linear-gradient(180deg,#221a12,#15100b);border:1px solid rgba(201,162,90,0.55);border-radius:8px;' +
        'padding:6px 12px;font-family:var(--tk-font-num),var(--tk-font-body);box-shadow:0 2px 10px rgba(0,0,0,0.6);user-select:none;}' +
        '#prog-bar .pb-coins{display:flex;align-items:center;gap:6px;color:var(--tk-gold);font-size:14px;}' +
        '#prog-bar .pb-pass{font-size:10px;letter-spacing:1px;color:#1a1208;background:linear-gradient(135deg,var(--tk-gold),var(--tk-bronze));' +
        'padding:2px 6px;border-radius:3px;font-weight:700;line-height:1.2;}' +
        '#prog-bar .pb-sep{width:1px;height:22px;background:linear-gradient(180deg,transparent,var(--tk-bronze),transparent);}' +
        '#prog-bar .pb-lvl-wrap{display:flex;flex-direction:column;gap:2px;min-width:84px;}' +
        '#prog-bar .pb-lvl-top{display:flex;justify-content:space-between;align-items:baseline;}' +
        '#prog-bar .pb-lvl{color:var(--tk-gold);font-size:14px;font-family:var(--tk-font-body);}' +
        '#prog-bar .pb-rogue{color:var(--tk-bronze);font-size:13px;letter-spacing:1px;}' +
        '#prog-bar .pb-xp-txt{color:var(--tk-text-sub);font-size:10px;font-family:monospace;}' +
        '#prog-bar .pb-xp-track{height:5px;background:rgba(232,220,196,0.1);border-radius:3px;overflow:hidden;}' +
        '#prog-bar .pb-xp-fill{height:100%;background:linear-gradient(90deg,var(--tk-bronze),var(--tk-gold));border-radius:3px;transition:width 0.4s ease;}' +
        '#prog-bar .pb-coins.bump{animation:pbBump 0.4s ease;}' +
        '#prog-bar .pb-cloud{font-size:14px;line-height:1;opacity:0.85;}' +
        '#prog-bar .pb-cloud.offline{opacity:0.45;}' +
        '@keyframes pbBump{0%{transform:scale(1);}40%{transform:scale(1.25);color:#fff;}100%{transform:scale(1);}}' +

        '#profile-overlay{position:fixed;inset:0;z-index:7000;background:rgba(14,12,9,0.82);' +
        'display:flex;align-items:center;justify-content:center;font-family:var(--tk-font-body);' +
        'padding:calc(12px + var(--tk-sat)) 12px calc(12px + var(--tk-sab));box-sizing:border-box;}' +
        '.pf-card{background:var(--tk-panel-bg);border:var(--tk-panel-border);border-radius:0;' +
        'padding:18px 20px 16px;width:min(360px,92vw);box-shadow:var(--tk-panel-glow);position:relative;color:var(--tk-text);' +
        'max-height:100%;overflow-y:auto;-webkit-overflow-scrolling:touch;}' +
        '.pf-close{position:absolute;top:8px;right:10px;background:none;border:none;color:var(--tk-text-sub);font-size:22px;cursor:pointer;line-height:1;z-index:2;}' +
        '.pf-head{display:flex;align-items:flex-start;gap:12px;padding-bottom:10px;margin-bottom:10px;' +
        'border-bottom:1px solid rgba(201,162,90,0.28);}' +
        '.pf-seal{width:40px;height:40px;flex-shrink:0;border-radius:0;transform:rotate(-4deg);' +
        'background:linear-gradient(160deg,var(--tk-bronze),rgba(0,0,0,0.45));' +
        'display:flex;align-items:center;justify-content:center;font-family:var(--tk-font-serif);font-weight:900;' +
        'font-size:20px;color:#f3e4d0;box-shadow:0 2px 8px rgba(0,0,0,0.4),inset 0 0 0 1px rgba(243,228,208,0.25);}' +
        '.pf-head-main{flex:1;min-width:0;padding-right:18px;}' +
        '.pf-head-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}' +
        '.pf-name{color:var(--tk-text);font-family:var(--tk-font-serif);font-weight:900;font-size:20px;line-height:1.15;}' +
        '.pf-pass-badge{font-size:9px;letter-spacing:1px;font-weight:700;color:#1a1208;' +
        'background:linear-gradient(135deg,var(--tk-gold),var(--tk-bronze));padding:2px 6px;border-radius:0;line-height:1.2;}' +
        '.pf-lvl{color:var(--tk-gold);font-size:12px;margin-top:2px;}' +
        '.pf-xpbar{height:4px;background:rgba(232,220,196,0.12);border-radius:0;overflow:hidden;margin-top:6px;width:100%;}' +
        '.pf-xpfill{height:100%;background:linear-gradient(90deg,var(--tk-bronze),var(--tk-gold));}' +
        '.pf-metrics{display:flex;flex-wrap:wrap;gap:6px 0;justify-content:space-between;margin-bottom:8px;}' +
        '.pf-metric{flex:1 1 18%;min-width:52px;text-align:center;padding:2px 0;}' +
        '.pf-metric-num{display:block;color:var(--tk-text);font-family:var(--tk-font-num);font-size:18px;line-height:1.1;}' +
        '.pf-metric-lbl{display:block;color:var(--tk-text-sub);font-size:10px;letter-spacing:0.5px;margin-top:2px;}' +
        '.pf-metric-hi .pf-metric-num{color:var(--tk-gold);}' +
        '.pf-meta{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 6px;font-size:12px;color:var(--tk-text-sub);' +
        'padding:6px 0 8px;margin-bottom:2px;border-bottom:1px solid rgba(201,162,90,0.2);}' +
        '.pf-meta b{color:var(--tk-gold);font-family:var(--tk-font-serif);font-weight:900;}' +
        '.pf-meta-sep{opacity:0.5;}' +
        '.pf-section-label{color:var(--tk-bronze);font-size:11px;letter-spacing:1.5px;margin-bottom:4px;}' +
        '.pf-pass,.pf-account{margin-top:10px;padding-top:10px;border-top:1px solid rgba(201,162,90,0.22);}' +
        '.pf-pass-line{font-size:11px;color:var(--tk-text-sub);line-height:1.4;}' +
        '.pf-pass-line a{color:var(--tk-bronze);}' +
        '.pf-account-hint,.pf-disclaimer{color:var(--tk-text-sub);font-size:11px;line-height:1.35;margin:0 0 6px;}' +
        '.pf-account-msg{font-size:12px;line-height:1.35;margin-top:6px;color:var(--tk-text-muted);}' +
        '.pf-account-msg.linked{color:#7dcea0;}.pf-account-msg.pending{color:var(--tk-gold);}' +
        '.pf-account-msg.offline{color:#b08080;}.pf-account-msg.error{color:#e57373;}' +
        '.pf-email-input{width:100%;box-sizing:border-box;padding:8px 10px;border-radius:0;' +
        'border:1px solid rgba(201,162,90,0.45);background:rgba(14,12,9,0.5);color:var(--tk-text);font-size:14px;margin-bottom:6px;outline:none;}' +
        '.pf-btn-row{display:flex;gap:8px;margin-bottom:4px;}' +
        '.pf-btn-row .pf-link-btn,.pf-btn-row .pf-signin-btn{flex:1;margin-bottom:0;}' +
        '.pf-link-btn,.pf-signin-btn{width:100%;padding:10px;border-radius:0;font-size:14px;font-weight:bold;cursor:pointer;font-family:inherit;margin-bottom:6px;}' +
        '.pf-link-btn{border:none;color:#241a08;background:linear-gradient(180deg,#f5d27a,#c9a25a 55%,#a8823f);box-shadow:0 2px 0 #6e5424;}' +
        '.pf-signin-btn{background:transparent;color:var(--tk-bronze);border:1px solid rgba(201,162,90,0.5);}' +
        '.pf-account-divider{text-align:center;color:var(--tk-text-sub);font-size:11px;margin:8px 0 6px;}' +
        '.pf-redeem-row{display:flex;gap:8px;align-items:center;margin-bottom:2px;}' +
        '.pf-redeem-input{flex:1;min-width:0;box-sizing:border-box;padding:8px 10px;border-radius:0;' +
        'border:1px solid rgba(201,162,90,0.45);background:rgba(14,12,9,0.5);color:var(--tk-text);font-size:14px;outline:none;text-transform:uppercase;}' +
        '.pf-redeem-row .pf-signin-btn{width:auto;margin-bottom:0;padding:9px 14px;flex-shrink:0;}' +
        '.pf-consent{display:flex;align-items:center;gap:4px;color:var(--tk-text-muted);font-size:11px;line-height:1.35;' +
        'margin-bottom:6px;cursor:pointer;min-height:44px;padding:4px 0;touch-action:manipulation;-webkit-tap-highlight-color:transparent;}' +
        '.pf-consent-hit{display:flex;align-items:center;justify-content:center;flex-shrink:0;width:44px;height:44px;}' +
        '.pf-consent-hit input[type="checkbox"]{width:22px;height:22px;min-width:22px;min-height:22px;margin:0;cursor:pointer;}' +
        '.pf-consent-text{flex:1;min-width:0;padding:6px 0;}' +
        '.pf-legal-footer{color:var(--tk-text-sub);font-size:10px;line-height:1.35;margin:6px 0 0;text-align:center;}' +
        '.pf-legal-link{background:none;border:none;padding:0;color:var(--tk-bronze);cursor:pointer;font-size:10px;text-decoration:underline;font-family:inherit;}' +
        '#pf-legal-overlay{position:fixed;inset:0;z-index:8000;background:rgba(14,12,9,0.88);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;}' +
        '.pf-legal-card{background:var(--tk-panel-bg);border:var(--tk-panel-border);border-radius:0;' +
        'max-width:520px;width:100%;max-height:80vh;overflow:hidden;position:relative;box-shadow:var(--tk-panel-glow);}' +
        '.pf-legal-body{padding:24px 28px 28px;overflow-y:auto;max-height:80vh;color:var(--tk-text-muted);font-size:13px;line-height:1.55;}' +
        '.pf-legal-body h2{color:var(--tk-gold);font-family:var(--tk-font-serif);margin:0 0 8px;font-size:22px;}' +
        '.pf-legal-body h3{color:var(--tk-bronze);margin:16px 0 6px;font-size:15px;}' +
        '.pf-legal-updated{color:var(--tk-text-sub);font-size:12px;margin-bottom:12px;}' +
        '.pf-legal-list{margin:8px 0 0 18px;padding:0;}.pf-legal-list li{margin-bottom:8px;}' +
        '.pf-legal-body a{color:var(--tk-bronze);}' +
        '.pf-legal-close{position:absolute;top:10px;right:12px;background:none;border:none;color:var(--tk-text-sub);font-size:24px;cursor:pointer;z-index:1;}' +
        '.pf-link-btn:disabled,.pf-signin-btn:disabled{opacity:0.55;cursor:default;}' +
        '@media (orientation:portrait){.pf-card{padding:14px 14px 12px;width:min(340px,94vw);}' +
        '.pf-name{font-size:18px;}.pf-metric-num{font-size:16px;}.pf-seal{width:36px;height:36px;font-size:18px;}}' +

        '#live-score-bar{position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:4000;pointer-events:none;' +
        'user-select:none;font-family:var(--tk-font-num),var(--tk-font-body);display:flex;align-items:stretch;' +
        'background:linear-gradient(180deg,#221a12,#15100b);border:1px solid var(--tk-bronze);border-radius:4px;' +
        'box-shadow:0 2px 10px rgba(0,0,0,0.6),inset 0 0 0 1px rgba(201,162,90,0.25);' +
        'clip-path:polygon(10px 0,calc(100% - 10px) 0,100% 50%,calc(100% - 10px) 100%,10px 100%,0 50%);padding:0 4px;}' +
        '.ls-cell{display:flex;align-items:center;justify-content:center;padding:6px 14px;position:relative;line-height:1;}' +
        '.ls-cell + .ls-cell::before{content:"";position:absolute;left:0;top:18%;height:64%;width:1px;' +
        'background:linear-gradient(180deg,transparent,var(--tk-bronze),transparent);}' +
        '.ls-team{font-size:30px;line-height:1;color:var(--tk-text);min-width:30px;text-align:center;' +
        'text-shadow:0 1px 2px #000;transition:transform 0.1s ease;display:flex;align-items:center;justify-content:center;gap:7px;}' +
        '.ls-team.mine .ls-num{color:var(--tk-team-blue);}.ls-team.enemy .ls-num{color:var(--tk-team-red);}' +
        '.ls-team.lead .ls-num{animation:lsLeadPulse 1.4s ease-in-out infinite;}.ls-team.behind{opacity:0.55;}' +
        '.ls-team.bump,.ls-ffa-cell.bump{animation:lsBump 0.35s cubic-bezier(0.175,0.885,0.32,1.5);}' +
        '.ls-gem-ico{width:13px;height:13px;flex-shrink:0;background:linear-gradient(135deg,var(--tk-gold),#b8862f);' +
        'transform:rotate(45deg);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.4),0 0 4px rgba(201,162,90,0.5);}' +
        '#hud-timer-slot{font-size:26px;color:var(--tk-text);letter-spacing:1px;min-width:62px;text-align:center;' +
        'text-shadow:0 1px 2px #000;line-height:1;display:flex;align-items:center;justify-content:center;}' +
        '#hud-timer-slot.urgent{color:#e85a4a;animation:timerUrgentTxt 0.6s ease-in-out infinite;}' +
        '@keyframes timerUrgentTxt{0%,100%{transform:scale(1);}50%{transform:scale(1.1);}}' +
        '.ls-ffa-rank{font-size:22px;color:var(--tk-gold);}.ls-ffa-sep{color:var(--tk-bronze);margin:0 8px;font-size:16px;}' +
        '.ls-ffa-ko{font-size:22px;color:var(--tk-text);}.ls-ffa-cell.lead-you .ls-ffa-rank{animation:lsLeadPulse 1.4s ease-in-out infinite;}' +
        '@keyframes lsBump{0%{transform:scale(1);}45%{transform:scale(1.3);}100%{transform:scale(1);}}' +
        '@keyframes lsLeadPulse{0%,100%{text-shadow:0 0 5px rgba(245,210,122,0.4);}50%{text-shadow:0 0 14px rgba(245,210,122,0.95);}}' +

        '.tk-hud-mission-wrap{position:fixed;top:52px;left:50%;transform:translateX(-50%);z-index:3999;' +
        'pointer-events:none;max-width:min(88vw,520px);display:flex;justify-content:center;}' +
        '#hud-mission-obj.tk-mission-bar{background:rgba(0,0,0,0.55);border:1px solid rgba(201,162,90,0.45);border-radius:8px;' +
        'padding:4px 12px;color:var(--tk-gold);font-family:var(--tk-font-body);font-size:13px;font-weight:700;' +
        'letter-spacing:0.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' +
        'text-shadow:1px 1px 0 rgba(0,0,0,0.85);line-height:1.25;}' +

        '#kill-feed{position:fixed;top:82px;right:10px;z-index:3900;display:flex;flex-direction:column;gap:4px;' +
        'align-items:flex-end;pointer-events:none;font-family:var(--tk-font-body);}' +
        '.kf-row{display:flex;align-items:center;gap:6px;background:linear-gradient(180deg,#221a12,#15100b);' +
        'border:1px solid rgba(201,162,90,0.5);border-radius:3px;padding:3px 9px;font-size:13px;color:var(--tk-text);' +
        'white-space:nowrap;text-shadow:0 1px 1px #000;animation:kfSlideIn 0.3s cubic-bezier(0.175,0.885,0.32,1.5);' +
        'transition:opacity 0.4s ease,transform 0.4s ease;}' +
        '.kf-row.mine-kill{border-color:var(--tk-gold);box-shadow:0 0 8px rgba(245,210,122,0.35);}' +
        '.kf-row.mine-death{border-color:#a83232;box-shadow:0 0 8px rgba(168,50,50,0.4);}' +
        '.kf-attacker{color:var(--tk-text);}.kf-victim{color:var(--tk-text-sub);}' +
        '.kf-icon{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;flex-shrink:0;' +
        'font-size:11px;line-height:1;color:var(--tk-bronze);}' +
        '.kf-row.fade{opacity:0;transform:translateX(24px);}' +
        '@keyframes kfSlideIn{0%{opacity:0;transform:translateX(34px);}100%{opacity:1;transform:translateX(0);}}' +

        '@media (orientation:portrait){#prog-bar{top:6px;right:7px;padding:5px 9px;gap:7px;}' +
        '#prog-bar .pb-coins{font-size:13px;}#prog-bar .pb-lvl{font-size:13px;}#prog-bar .pb-lvl-wrap{min-width:70px;}' +
        '.ls-team{font-size:24px;}#hud-timer-slot{font-size:21px;min-width:52px;}.ls-cell{padding:5px 11px;}' +
        '.ls-ffa-rank,.ls-ffa-ko{font-size:18px;}#kill-feed{top:76px;right:7px;}.kf-row{font-size:11px;padding:3px 7px;}' +
        '.tk-hud-mission-wrap{top:48px;max-width:94vw;}#hud-mission-obj.tk-mission-bar{font-size:12px;padding:3px 10px;}}';
    },

    _rosterCss: function() {
        return '' +
        '.cs-nameplate{display:flex;align-items:center;gap:12px;flex-shrink:0;}' +
        '.cs-seal{width:44px;height:44px;flex-shrink:0;border-radius:6px;' +
        'background:linear-gradient(160deg,var(--cs-faction-color,var(--tk-bronze)),rgba(0,0,0,0.42));' +
        'display:flex;align-items:center;justify-content:center;' +
        'font-family:var(--tk-font-serif);font-weight:900;font-size:24px;color:#f3e4d0;transform:rotate(-4deg);' +
        'box-shadow:0 3px 10px rgba(0,0,0,0.45),inset 0 0 0 2px rgba(243,228,208,0.28);}' +
        '.cs-seal.stamp{animation:csStamp 0.38s cubic-bezier(0.2,1.6,0.4,1);}' +
        '@keyframes csStamp{0%{transform:scale(1.9) rotate(-14deg);opacity:0;}60%{transform:scale(0.94) rotate(-3deg);opacity:1;}100%{transform:scale(1) rotate(-4deg);}}' +
        '.cs-name{font-family:var(--tk-font-serif);font-weight:900;font-size:32px;color:var(--tk-gold);line-height:1.05;text-shadow:0 2px 8px rgba(0,0,0,0.8);}' +
        '.cs-title{font-size:12px;color:var(--tk-text-sub);letter-spacing:3px;margin-top:3px;}' +
        '.cs-tags{display:flex;gap:6px;margin-left:auto;}' +
        '.cs-tag{font-size:11px;padding:3px 9px;border-radius:3px;letter-spacing:2px;border:1px solid rgba(201,162,90,0.45);color:var(--tk-bronze);}' +
        '.cs-stats{display:flex;flex-direction:column;gap:5px;flex-shrink:0;}' +
        '.cs-stat{display:flex;align-items:center;gap:10px;font-size:12px;}' +
        '.cs-stat b{width:2.4em;color:var(--tk-text-sub);letter-spacing:2px;flex-shrink:0;font-weight:700;}' +
        '.cs-track{flex:1;height:7px;background:rgba(232,220,196,0.1);border-radius:4px;overflow:hidden;}' +
        '.cs-fill{height:100%;border-radius:4px;width:0;background:linear-gradient(90deg,var(--tk-bronze),var(--tk-gold));transition:width 0.45s cubic-bezier(0.3,1,0.4,1);}' +
        '.cs-stat span{width:3.4em;text-align:right;color:var(--tk-text);font-family:var(--tk-font-num);font-size:12px;}' +
        '.cs-abilities{display:flex;flex-direction:column;gap:5px;flex-shrink:0;}' +
        '.cs-ab{display:flex;align-items:center;gap:9px;font-size:12.5px;color:var(--tk-text);line-height:1.35;}' +
        '.cs-ab-icon{width:24px;height:24px;flex-shrink:0;border-radius:4px;display:flex;align-items:center;justify-content:center;' +
        'font-size:14px;font-weight:900;font-family:var(--tk-font-serif);border:1px solid rgba(201,162,90,0.6);color:var(--tk-gold);background:rgba(201,162,90,0.12);}' +
        '.cs-ab.super .cs-ab-icon{background:var(--tk-seal);border-color:#d0574a;color:#f3e4d0;}' +
        '.cs-skin-picker{display:flex;flex-direction:column;gap:6px;margin:10px 0 2px;flex-shrink:0;}' +
        '.cs-skin-label{display:block;font-size:11px;letter-spacing:2px;color:var(--tk-text-sub);text-transform:uppercase;}' +
        '.cs-skin-select{width:100%;padding:10px 12px;border-radius:10px;box-sizing:border-box;outline:none;' +
        'background:linear-gradient(180deg,rgba(34,26,18,0.96),rgba(21,16,11,0.98));color:var(--tk-gold);' +
        'border:1px solid rgba(201,162,90,0.45);box-shadow:inset 0 2px 6px rgba(0,0,0,0.45);' +
        'font-size:14px;font-family:var(--tk-font-body);letter-spacing:0.3px;appearance:none;-webkit-appearance:none;}' +
        '.cs-skin-select:focus{border-color:var(--tk-gold);box-shadow:0 0 0 1px rgba(245,210,122,0.28),inset 0 2px 6px rgba(0,0,0,0.45);}' +
        '.cs-skin-select option{background:#1b140d;color:var(--tk-gold);}' +
        '.cs-skin-lock{display:none;flex-direction:column;gap:8px;padding:10px 12px;border-radius:10px;' +
        'border:1px solid rgba(232,90,74,0.45);background:rgba(40,16,12,0.55);}' +
        '.cs-skin-lock.is-visible{display:flex;}' +
        '.cs-skin-lock-label{font-size:13px;color:#f0c8c0;line-height:1.45;}' +
        '.cs-skin-unlock-btn{align-self:flex-start;padding:8px 14px;font-size:13px;}' +
        '#btn-play.cs-play{font-family:var(--tk-font-serif);font-weight:900;font-size:22px;letter-spacing:12px;text-indent:12px;color:#241a08;' +
        'border:none;border-radius:12px;background:linear-gradient(180deg,#f5d27a,#c9a25a 55%,#a8823f);' +
        'box-shadow:0 4px 0 #6e5424,0 8px 18px rgba(201,162,90,0.35),inset 0 1px 0 rgba(255,255,255,0.5);}' +
        '#btn-play.cs-play:active{transform:translateY(3px);box-shadow:0 1px 0 #6e5424;}' +
        '#btn-play.cs-play{position:relative;overflow:hidden;}' +
        '#btn-play.cs-play::after{content:"";position:absolute;top:0;left:-60%;width:36%;height:100%;' +
        'background:linear-gradient(105deg,rgba(255,255,255,0) 0%,rgba(255,255,255,0.38) 50%,rgba(255,255,255,0) 100%);' +
        'transform:skewX(-20deg);animation:csSheen 3.4s ease-in-out infinite;}' +
        '#btn-play.cs-play.cs-play-locked{letter-spacing:8px;text-indent:8px;color:#f3e4d0;' +
        'background:linear-gradient(180deg,#7a4a3a,#5a2e24 55%,#3e1e18);' +
        'box-shadow:0 4px 0 #2a1410,0 8px 18px rgba(0,0,0,0.35),inset 0 1px 0 rgba(255,255,255,0.12);}' +
        '#btn-play.cs-play.cs-play-locked:active{box-shadow:0 1px 0 #2a1410;}' +
        '#btn-play.cs-play.cs-play-locked::after{animation:none;opacity:0;}' +
        '@keyframes csSheen{0%,58%{left:-60%;}88%,100%{left:135%;}}' +

        '@media (max-width:768px) and (orientation:portrait){' +
        '#step-brawler{display:flex;flex-direction:column;min-height:0;justify-content:flex-end;}' +
        '.cs-name{font-size:26px;}.cs-seal{width:38px;height:38px;font-size:20px;}.cs-ab{font-size:12px;}}';
    },

    _hubCss: function() {
        return '' +
        /* ── Hub topbar + back ── */
        '.hub-topbar{display:none;align-items:center;flex-shrink:0;margin-bottom:12px;min-height:32px;}' +
        '.ui-panel[data-step="network"] .hub-topbar{display:none !important;}' +
        '.ui-panel:not([data-step="network"]) .hub-topbar{display:flex;}' +
        '.tk-btn-back{background:none;border:1px solid rgba(201,162,90,0.4);border-radius:8px;' +
        'color:var(--tk-text-sub);font-size:13px;padding:6px 14px;cursor:pointer;font-family:var(--tk-font-body);' +
        'letter-spacing:1px;transition:background 0.15s ease,border-color 0.15s ease;}' +
        '.tk-btn-back:active{background:rgba(201,162,90,0.1);border-color:rgba(201,162,90,0.55);color:var(--tk-text);}' +
        '.hub-topbar{gap:10px;margin-bottom:10px;}' +
        '.hub-topbar .ui-title{margin:0 0 0 auto;font-size:17px;letter-spacing:8px;text-indent:8px;opacity:0.95;}' +
        '.hub-version{background:none;border:1px solid rgba(201,162,90,0.4);border-radius:8px;' +
        'color:rgba(201,162,90,0.9);font-size:11px;padding:4px 10px;cursor:pointer;' +
        'font-family:var(--tk-font-num);letter-spacing:1px;flex-shrink:0;' +
        'transition:background 0.15s ease,border-color 0.15s ease;}' +
        '.hub-version:active{background:rgba(201,162,90,0.12);border-color:rgba(201,162,90,0.6);color:var(--tk-gold);}' +

        /* ── Hub homepage ── */
        '.hub-step{justify-content:center;gap:16px;}' +
        '.hub-hero{text-align:center;margin-bottom:4px;flex-shrink:0;}' +
        '.hub-brand{font-family:var(--tk-font-serif);font-weight:900;font-size:clamp(32px,5.5vw,48px);' +
        'color:var(--tk-gold);letter-spacing:6px;line-height:1;text-shadow:0 3px 12px rgba(0,0,0,0.85);}' +
        '.hub-tagline{color:var(--tk-text-sub);font-size:13px;letter-spacing:3px;margin-top:8px;}' +
        '.hub-name-label{display:block;color:var(--tk-text-sub);font-size:12px;letter-spacing:2px;margin-bottom:6px;}' +
        '.hub-name{text-align:center;letter-spacing:2px;}' +
        '.hub-actions{display:flex;flex-direction:column;gap:10px;flex-shrink:0;}' +
        '.hub-entry{display:flex;align-items:center;gap:12px;width:100%;padding:14px 14px 14px 12px;' +
        'border-radius:12px;cursor:pointer;text-align:left;border:1.5px solid rgba(232,220,196,0.12);' +
        'background:linear-gradient(180deg,#2a2118,#171009);transition:transform 0.12s ease,border-color 0.15s ease;}' +
        '.hub-entry:active{transform:scale(0.98);border-color:rgba(201,162,90,0.45);}' +
        '.hub-entry-kanji{width:40px;height:40px;flex-shrink:0;border-radius:8px;display:flex;align-items:center;justify-content:center;' +
        'font-family:var(--tk-font-serif);font-weight:900;font-size:22px;color:#f3e4d0;' +
        'background:linear-gradient(160deg,#c23c30,#8e2419);box-shadow:0 2px 8px rgba(176,52,42,0.4);}' +
        '.hub-entry-kanji-multi{background:linear-gradient(160deg,#1565c0,#0d47a1);box-shadow:0 2px 8px rgba(21,101,192,0.4);}' +
        '.hub-entry-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;}' +
        '.hub-entry-title{font-family:var(--tk-font-serif);font-weight:900;font-size:clamp(18px,2.8vw,22px);color:var(--tk-gold);letter-spacing:2px;}' +
        '.hub-entry-desc{font-size:12px;color:var(--tk-text-sub);letter-spacing:0.5px;}' +
        '.hub-entry-arrow{font-size:22px;color:rgba(201,162,90,0.45);flex-shrink:0;}' +

        /* ── Mode step header ── */
        '.hub-step-head{flex-shrink:0;margin-bottom:4px;}' +
        '.hub-step-title{font-family:var(--tk-font-serif);font-weight:900;font-size:clamp(20px,3.2vw,26px);' +
        'color:var(--tk-gold);letter-spacing:3px;}' +
        '.hub-step-sub{font-size:12px;color:var(--tk-text-sub);letter-spacing:2px;margin-top:4px;}' +
        '.mode-card-featured{border-color:rgba(201,162,90,0.5);' +
        'background:linear-gradient(135deg,#2f2418 0%,#1a140e 60%,#171009 100%);' +
        'box-shadow:0 0 18px rgba(201,162,90,0.14);}' +
        '.mode-card-featured .mc-title{font-size:21px;}' +
        '.mode-card-featured .mc-kanji{display:inline-block;font-family:var(--tk-font-serif);font-weight:900;' +
        'font-size:11px;color:var(--tk-bronze);border:1px solid rgba(201,162,90,0.4);padding:2px 6px;border-radius:3px;' +
        'margin-left:8px;vertical-align:middle;letter-spacing:1px;}' +
        '.ui-panel[data-step="network"] .ui-title{display:none;}' +
        '.ui-panel[data-step="network"]{width:min(100%,560px);' +
        'background:linear-gradient(90deg,rgba(14,12,9,0) 0%,rgba(24,18,11,0.9) 20%,rgba(14,12,9,0.96) 60%);}' +
        '.ui-panel[data-step="network"] .hub-step{max-width:400px;margin:0 auto;width:100%;}' +

        '@media (max-width:768px) and (orientation:portrait){' +
        '.hub-brand{font-size:clamp(28px,8vw,40px);letter-spacing:4px;}' +
        '.hub-entry{padding:12px;}.hub-entry-kanji{width:36px;height:36px;font-size:20px;}' +
        '.hub-step-head{text-align:center;}}';
    },

    _settingsCss: function() {
        return '' +
        '.tk-modal-overlay{position:fixed;inset:0;z-index:5500;display:none;align-items:center;justify-content:center;' +
        'background:var(--tk-overlay-bg);-webkit-tap-highlight-color:transparent;animation:tkFade 0.2s ease;}' +
        '.tk-modal-overlay.open{display:flex;}' +

        '#gs-gear{position:fixed;top:12px;left:12px;z-index:4500;width:46px;height:46px;border-radius:0;' +
        'background:rgba(10,8,6,0.6);border:1px solid rgba(184,148,90,0.4);' +
        'box-shadow:none;color:var(--tk-gold);font-size:21px;' +
        'font-family:var(--tk-font-serif);font-weight:900;cursor:pointer;' +
        'display:flex;align-items:center;justify-content:center;user-select:none;-webkit-tap-highlight-color:transparent;' +
        'clip-path:polygon(6px 0,100% 0,calc(100% - 6px) 100%,0 100%);}' +
        '#gs-gear:active{transform:scale(0.9);}' +

        '#gs-panel.tk-panel{border-radius:0;box-shadow:none;}' +
        '#gs-panel{padding:18px 16px 14px;min-width:260px;width:min(340px,88vw);max-width:88vw;' +
        'max-height:min(78vh,640px);overflow:visible;' +
        'display:flex;flex-direction:column;gap:8px;text-align:left;' +
        'background:linear-gradient(180deg,#221a12,#15100b);border:1px solid rgba(184,148,90,0.45);}' +
        '.gs-title{margin:0 0 2px;border-bottom:1px solid rgba(184,148,90,0.28);padding-bottom:10px;' +
        'font-size:20px;letter-spacing:0.12em;}' +

        '.gs-group{display:flex;flex-direction:column;gap:0;padding:0;' +
        'background:rgba(11,9,7,0.5);border:1px solid rgba(184,148,90,0.22);border-radius:0;overflow:visible;}' +
        '.gs-group > .tk-settings-row{border:0;border-bottom:1px solid rgba(239,230,212,0.08);' +
        'background:transparent;border-radius:0;}' +
        '.gs-group > .tk-settings-row:last-child{border-bottom:0;}' +

        '.tk-settings-row{display:flex;align-items:center;justify-content:space-between;gap:10px;' +
        'padding:10px 12px;border-radius:0;min-height:42px;box-sizing:border-box;' +
        'background:rgba(239,230,212,0.04);border:1px solid rgba(239,230,212,0.08);color:var(--tk-text);' +
        'font-size:15px;font-family:var(--tk-font-body);cursor:pointer;user-select:none;letter-spacing:0.04em;}' +
        '.tk-settings-row:active{background:rgba(184,148,90,0.14);}' +
        '.tk-settings-row .gs-val{color:var(--tk-gold);font-size:14px;flex-shrink:0;}' +
        '.tk-settings-row.tk-settings-primary{border-color:rgba(46,107,62,0.55);color:#aee0ae;background:rgba(46,107,62,0.08);}' +
        '.tk-settings-row.tk-settings-danger{border-color:rgba(194,60,48,0.55);color:#e08585;background:rgba(194,60,48,0.08);}' +
        '.tk-settings-row.tk-btn-disabled{opacity:0.38;pointer-events:none;filter:grayscale(0.6);}' +

        '.gs-advanced{display:flex;flex-direction:column;gap:0;}' +
        '.gs-advanced-toggle{display:flex;align-items:center;justify-content:space-between;' +
        'padding:9px 12px;min-height:40px;box-sizing:border-box;cursor:pointer;user-select:none;' +
        'color:var(--tk-text-sub);font-size:13px;letter-spacing:0.1em;' +
        'background:none;border:1px solid rgba(184,148,90,0.28);border-radius:0;}' +
        '.gs-advanced-toggle:active{background:rgba(184,148,90,0.1);color:var(--tk-text);}' +
        '.gs-advanced-toggle::after{content:"▼";font-size:10px;color:var(--tk-bronze);transition:transform 0.15s ease;}' +
        '.gs-advanced.open .gs-advanced-toggle::after{transform:rotate(180deg);}' +
        '.gs-advanced-body{display:none;flex-direction:column;gap:0;margin-top:6px;' +
        'background:rgba(11,9,7,0.5);border:1px solid rgba(184,148,90,0.22);border-radius:0;}' +
        '.gs-advanced.open .gs-advanced-body{display:flex;}' +
        '.gs-advanced-body > .tk-settings-row{border:0;border-bottom:1px solid rgba(239,230,212,0.08);' +
        'background:transparent;border-radius:0;}' +
        '.gs-advanced-body > .tk-settings-row:last-of-type{border-bottom:0;}' +

        '.gs-actions{display:flex;flex-direction:column;gap:6px;margin-top:2px;}' +

        '.tk-dropdown{position:relative;width:118px;z-index:1;flex-shrink:0;}' +
        '.tk-dropdown:has(.tk-dropdown-list.open){z-index:7000;}' +
        '.tk-dropdown-current{background:rgba(14,12,9,0.85);color:var(--tk-gold);border:1px solid rgba(184,148,90,0.4);' +
        'border-radius:0;font-size:14px;padding:5px 10px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;}' +
        '.tk-dropdown-current::after{content:"▼";font-size:10px;color:var(--tk-bronze);margin-left:6px;}' +
        '.tk-dropdown-list{display:none;position:absolute;top:100%;right:0;width:100%;' +
        'background:rgba(14,12,9,0.96);border:1px solid rgba(184,148,90,0.4);border-radius:0;margin-top:3px;z-index:7000;overflow:hidden;}' +
        '.tk-dropdown-list.open{display:block;}' +
        '.tk-dropdown-option{padding:9px 10px;color:var(--tk-text);font-size:14px;cursor:pointer;text-align:center;' +
        'border-bottom:1px solid rgba(184,148,90,0.16);}' +
        '.tk-dropdown-option:last-child{border-bottom:none;}' +
        '.tk-dropdown-option:hover{background:rgba(184,148,90,0.14);}' +
        '.tk-dropdown-option:active{background:rgba(184,148,90,0.18);}' +
        '.tk-settings-close{margin-top:2px;color:var(--tk-text-sub);font-size:13px;letter-spacing:0.1em;' +
        'text-align:center;cursor:pointer;padding:8px;}' +
        '.tk-settings-close:active{color:var(--tk-text);}' +
        '.gs-homescreen-guide{display:none;margin:0;padding:10px 12px;border:0;border-top:1px solid rgba(239,230,212,0.08);' +
        'background:rgba(28,21,14,0.45);color:var(--tk-text-sub);font-size:12.5px;line-height:1.5;white-space:pre-line;letter-spacing:0.04em;border-radius:0;}' +
        '.gs-homescreen-guide.open{display:block;}' +

        '@media (orientation:portrait){#gs-gear{width:42px;height:42px;font-size:22px;}.gs-title{font-size:18px;}.tk-settings-row{font-size:14px;padding:9px 11px;}}';
    },

    _lobbyCss: function() {
        return '' +
        '#fk-ui-root{position:absolute;inset:0;height:100dvh;pointer-events:none;overflow:hidden;' +
        'font-family:var(--tk-font-body);color:var(--tk-text);z-index:100;}' +

        '#cs-vignette{position:absolute;inset:0;pointer-events:none;' +
        'background:radial-gradient(120% 90% at 50% 0%,rgba(36,27,16,0) 0%,rgba(14,12,9,0.45) 72%,rgba(14,12,9,0.78) 100%);}' +

        '#cs-bigname{position:absolute;top:5%;right:calc(min(46%,560px) - 44px);writing-mode:vertical-rl;' +
        'pointer-events:none;user-select:none;display:none;' +
        'font-family:var(--tk-font-serif);font-weight:900;line-height:0.95;letter-spacing:6px;' +
        'color:transparent;-webkit-text-stroke:1.5px rgba(201,162,90,0.42);' +
        'font-size:clamp(80px,13vw,170px);}' +

        '.ui-panel{position:absolute;right:0;top:0;width:min(46%,560px);height:100%;' +
        'background:linear-gradient(90deg,rgba(14,12,9,0) 0%,rgba(20,15,10,0.88) 16%,rgba(14,12,9,0.97) 45%);' +
        'pointer-events:auto;display:flex;flex-direction:column;' +
        'padding:28px 28px 24px 68px;box-sizing:border-box;}' +

        '.ui-title{color:var(--tk-gold);font-family:var(--tk-font-serif);font-weight:900;' +
        'font-size:clamp(22px,3.6vw,32px);letter-spacing:3px;margin-bottom:16px;flex-shrink:0;' +
        'text-shadow:0 2px 8px rgba(0,0,0,0.8);}' +

        '.step-container{display:none;width:100%;flex:1;min-height:0;flex-direction:column;gap:12px;' +
        'animation:tkLobbyIn 0.3s ease;justify-content:flex-start;box-sizing:border-box;}' +
        '#step-network{justify-content:center;gap:14px;}' +
        '@keyframes tkLobbyIn{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:none;}}' +

        '.lobby-actions,.lobby-actions-row{display:flex;flex-direction:column;gap:10px;flex-shrink:0;}' +
        '.lobby-actions-row{flex-direction:row;}' +
        '.btn-container{display:flex;gap:10px;flex-shrink:0;margin-top:auto;padding-top:8px;}' +

        '.mode-grid{display:flex;flex-direction:column;gap:10px;flex:1;min-height:0;overflow-y:auto;}' +
        '.mode-card{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:12px;cursor:pointer;' +
        'min-height:64px;flex-shrink:0;background:linear-gradient(160deg,#241c12 0%,#171009 100%);' +
        'border:1.5px solid rgba(201,162,90,0.22);transition:transform 0.12s ease,border-color 0.2s ease;}' +
        '.mode-card:active{transform:scale(0.98);border-color:rgba(201,162,90,0.5);}' +
        '.mode-card .mc-seal{width:44px;height:44px;flex-shrink:0;border-radius:8px;' +
        'display:flex;align-items:center;justify-content:center;' +
        'font-family:var(--tk-font-serif);font-weight:900;font-size:22px;color:#f3e4d0;' +
        'box-shadow:inset 0 0 0 2px rgba(243,228,208,0.22),0 3px 8px rgba(0,0,0,0.4);transform:rotate(-3deg);}' +
        '.mode-card .mc-body{flex:1;min-width:0;}' +
        '.mode-card .mc-title{font-size:19px;color:var(--tk-gold);font-family:var(--tk-font-serif);font-weight:900;letter-spacing:2px;}' +
        '.mode-card .mc-desc{font-size:12.5px;color:var(--tk-text-sub);margin-top:2px;}' +
        '.mode-card .mc-best{font-size:12px;color:var(--tk-bronze);margin-top:3px;letter-spacing:0.5px;line-height:1.35;}' +
        '.mode-card .mc-best-global:empty,.mode-card .mc-best-local:empty{display:none;}' +
        '.mode-card .mc-best-line1{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
        '.mode-card .mc-best-name{color:#e8d5a8;font-weight:700;}' +
        '.mode-card .mc-best-line2{font-size:11px;color:rgba(180,150,110,0.75);margin-top:1px;}' +
        '.mode-card .mc-best-local{margin-top:2px;opacity:0.85;}' +
        '.mode-card .mc-lb-open-btn{padding:4px 10px;font-size:11px;min-height:0;margin-top:6px;position:relative;z-index:2;}' +
        '.mc-lb-modal{max-width:min(96vw,440px);max-height:min(85vh,560px);display:flex;flex-direction:column;}' +
        '.mc-lb-list{overflow-y:auto;flex:1;min-height:0;margin:8px 0;text-align:left;scrollbar-width:none;-ms-overflow-style:none;}' +
        '.mc-lb-list::-webkit-scrollbar{display:none;}' +
        '.mc-lb-item{padding:8px 0;border-bottom:1px solid rgba(201,162,90,0.15);}' +
        '.mc-lb-item:last-child{border-bottom:none;}' +
        '.mc-lb-item-head{font-size:13px;color:#e8dcc8;line-height:1.4;}' +
        '.mc-lb-rank{color:#c9a25a;font-weight:700;}' +
        '.mc-lb-name{color:#f5d27a;font-weight:700;}' +
        '.mc-lb-slots{margin-top:6px;min-height:34px;}' +
        '.mc-lb-slot-row{display:flex;gap:4px;justify-content:flex-start;flex-wrap:wrap;}' +
        '.mc-lb-slot-row .rg-slot{width:38px;height:30px;border-radius:5px;box-sizing:border-box;' +
        'display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:8px;color:#f0e6d2;}' +
        '.mc-lb-slot-row .rg-slot-empty{border:1.5px dashed rgba(154,143,122,0.55);background:rgba(0,0,0,0.35);}' +
        '.mc-lb-slot-row .rg-slot-filled{border:1.5px solid var(--rg-slot-edge,#c9a25a);background:rgba(0,0,0,0.55);}' +
        '.mc-lb-slot-row .rg-slot-sig{box-shadow:0 0 5px rgba(245,210,122,0.4);}' +
        '.mc-lb-slot-row .rg-slot-name{max-width:34px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
        '.mc-lb-slot-row .rg-slot-lv{font-size:7px;color:#f5d27a;}' +
        '.mc-lb-loading,.mc-lb-nobuild,.mc-lb-empty{font-size:11px;color:rgba(180,150,110,0.75);}' +
        '.mode-card .mc-arrow{font-size:22px;color:rgba(201,162,90,0.45);flex-shrink:0;}' +
        '.mc-green .mc-seal{background:linear-gradient(160deg,#3c6b40,#24472a);}' +
        '.mc-blue .mc-seal{background:linear-gradient(160deg,#2b5c8f,#1a3a5e);}' +
        '.mc-orange .mc-seal{background:linear-gradient(160deg,#9a6524,#6e4415);}' +
        '.mc-red .mc-seal{background:linear-gradient(160deg,#8e3128,#5f1e17);}' +

        '.brawler-grid{display:flex;gap:9px;overflow-x:auto;overflow-y:hidden;flex-shrink:0;padding:8px 2px 6px;scrollbar-width:none;}' +
        '.brawler-grid::-webkit-scrollbar{display:none;}' +
        '.b-card{position:relative;flex:0 0 64px;height:84px;border-radius:9px;cursor:pointer;overflow:hidden;' +
        'background:linear-gradient(180deg,#2a2118,#171009);border:1.5px solid rgba(232,220,196,0.12);' +
        'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;' +
        'transition:transform 0.15s ease,border-color 0.15s ease,box-shadow 0.15s ease;}' +
        '.b-card .c-bg{position:absolute;left:0;right:0;bottom:0;height:34%;pointer-events:none;opacity:0.8;}' +
        '.b-card .c-glyph{font-family:var(--tk-font-serif);font-size:26px;font-weight:900;color:var(--tk-text);line-height:1;z-index:1;}' +
        '.b-card .c-name{font-size:9.5px;color:var(--tk-text-sub);letter-spacing:1px;z-index:1;font-family:var(--tk-font-num);text-transform:uppercase;}' +
        '.b-card.selected{transform:translateY(-5px);border-color:var(--tk-gold);' +
        'box-shadow:0 0 0 1px var(--tk-gold),0 6px 16px rgba(0,0,0,0.7),0 0 18px rgba(245,210,122,0.35);}' +
        '.b-card.locked{filter:saturate(0.4);}.b-card.locked .c-glyph,.b-card.locked .c-name{opacity:0.35;}' +
        '.c-lock{position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;background:rgba(0,0,0,0.45);}' +
        '.c-lock-icon{width:20px;height:20px;border-radius:3px;font-size:11px;font-weight:900;background:rgba(0,0,0,0.6);' +
        'border:1px solid rgba(154,143,122,0.5);color:var(--tk-text-sub);display:flex;align-items:center;justify-content:center;font-family:var(--tk-font-serif);}' +
        '.c-lock-price{font-size:9px;color:var(--tk-bronze);font-family:var(--tk-font-num);}' +
        '.c-pass-badge{position:absolute;top:4px;right:4px;z-index:2;font-size:8px;letter-spacing:0.5px;font-weight:700;' +
        'color:#1a1208;background:linear-gradient(135deg,var(--tk-gold),var(--tk-bronze));padding:2px 5px;border-radius:2px;}' +
        '#fk-ui-root.ios-ui .b-card,#fk-ui-root.ios-ui .brawler-grid{' +
        'touch-action:manipulation;-webkit-tap-highlight-color:transparent;}' +

        '.room-info-box{background:var(--tk-panel-bg);border:var(--tk-panel-border);border-radius:12px;padding:16px;text-align:center;flex-shrink:0;}' +
        '.room-info-label{color:var(--tk-text-sub);font-size:13px;letter-spacing:2px;}' +
        '.room-code-display{font-size:clamp(36px,6vw,52px);letter-spacing:6px;margin:6px 0;color:var(--tk-gold);' +
        'font-family:var(--tk-font-serif);font-weight:900;text-shadow:0 2px 8px rgba(0,0,0,0.8);}' +
        '.room-mode-label{color:var(--tk-text-sub);font-size:14px;}' +
        '.player-list{background:rgba(14,12,9,0.5);border:1px solid rgba(201,162,90,0.22);border-radius:12px;' +
        'padding:10px;flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px;min-height:160px;}' +
        '.player-item{padding:12px 14px;font-size:17px;color:var(--tk-text);border-radius:10px;display:flex;' +
        'justify-content:space-between;align-items:center;border:1px solid rgba(232,220,196,0.1);background:rgba(232,220,196,0.04);}' +
        '.player-item.is-me{border-color:var(--tk-bronze);background:rgba(201,162,90,0.12);}' +
        '.room-wait{color:var(--tk-text-sub);text-align:center;font-size:15px;}' +

        '.overlay-screen{position:absolute;inset:0;background:var(--tk-overlay-bg);display:none;justify-content:center;' +
        'align-items:center;pointer-events:auto;flex-direction:column;z-index:200;}' +
        '#mc-lb-overlay.overlay-screen{z-index:300;}' +
        '.overlay-text{font-size:clamp(28px,6vw,48px);text-align:center;margin-bottom:28px;' +
        'color:var(--tk-gold);font-family:var(--tk-font-serif);font-weight:900;letter-spacing:3px;' +
        'text-shadow:0 2px 8px rgba(0,0,0,0.8);}' +
        '.tk-prompt-box{padding:28px;min-width:240px;max-width:400px;width:80%;display:flex;flex-direction:column;gap:14px;position:relative;text-align:center;}' +
        '.tk-prompt-title{color:var(--tk-gold);font-family:var(--tk-font-serif);font-weight:900;font-size:clamp(20px,4vw,28px);}' +
        '.join-error{color:#e57373;font-size:15px;min-height:20px;}' +

        '#instruction-wrapper.tk-panel,#instruction-wrapper.help-panel-v2{display:flex;flex-direction:column;align-items:stretch;width:min(92vw,420px);max-width:420px;padding:28px 22px 22px;position:relative;text-align:left;gap:0;border-radius:0;box-shadow:none;}' +
        '#instruction-content{display:flex;flex-direction:column;gap:18px;width:100%;}' +
        '.changelog-panel.tk-panel{display:flex;flex-direction:column;align-items:stretch;width:min(92vw,420px);max-width:420px;' +
        'max-height:82vh;padding:28px 22px 22px;position:relative;text-align:left;gap:0;border-radius:0;box-shadow:none;overflow:hidden;}' +
        '.changelog-head{border-bottom:1px solid rgba(201,162,90,0.25);padding-bottom:12px;margin-bottom:14px;padding-right:40px;}' +
        '.changelog-title{font-family:var(--tk-font-serif);font-weight:900;font-size:22px;color:var(--tk-gold);letter-spacing:2px;}' +
        '.changelog-current{font-size:12px;color:var(--tk-text-sub);margin-top:6px;letter-spacing:1px;}' +
        '.changelog-body{display:flex;flex-direction:column;gap:18px;overflow-y:auto;padding-right:4px;}' +
        '.changelog-entry{position:relative;}' +
        '.changelog-entry.is-current{border-left:3px solid var(--tk-gold);padding-left:12px;}' +
        '.changelog-entry-head{display:flex;align-items:baseline;gap:10px;margin-bottom:8px;}' +
        '.changelog-ver{font-family:var(--tk-font-serif);font-weight:900;font-size:17px;color:var(--tk-gold);letter-spacing:1px;}' +
        '.changelog-latest{font-size:10px;font-weight:800;letter-spacing:0.15em;color:#171009;' +
        'background:linear-gradient(180deg,#f5d27a,#c9a25a);border-radius:4px;padding:2px 6px;}' +
        '.changelog-date{font-size:12px;color:var(--tk-text-muted);margin-left:auto;letter-spacing:1px;}' +
        '.changelog-items{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px;}' +
        '.changelog-items li{font-size:13px;color:var(--tk-text-muted);line-height:1.5;letter-spacing:0.3px;}' +
        '.changelog-empty{color:var(--tk-text-muted);font-size:13px;text-align:center;padding:20px 0;}' +
        '.help-hero{text-align:center;padding:8px 4px 4px;}' +
        '.help-hero-kicker{font-size:11px;letter-spacing:0.18em;color:rgba(201,162,90,0.75);margin-bottom:6px;}' +
        '.help-hero-title{font-family:var(--tk-font-serif);font-weight:900;font-size:28px;color:var(--tk-gold);margin-bottom:8px;}' +
        '.help-hero-sub{font-size:13px;color:var(--tk-text-sub);line-height:1.45;margin-bottom:16px;}' +
        '.help-controls{border-top:1px solid rgba(201,162,90,0.22);padding-top:14px;}' +

        '.help-controls-head{font-size:12px;letter-spacing:0.12em;color:rgba(201,162,90,0.8);margin-bottom:10px;}' +
        '.help-ctrl-block{background:rgba(14,12,9,0.5);border-radius:0;padding:14px 16px;border:1px solid rgba(201,162,90,0.2);}' +
        '.help-ctrl-label{font-family:var(--tk-font-serif);font-weight:900;font-size:16px;margin-bottom:4px;}' +
        '.help-ctrl-desc{font-size:12px;color:var(--tk-text-sub);margin:0 0 12px;}' +
        '.help-ctrl-pc{border-top:3px solid var(--tk-faction-wei);}' +
        '.help-ctrl-pc .help-ctrl-label,.help-ctrl-pc .instruction-detail>span:first-child{color:var(--tk-faction-wei);}' +
        '.help-ctrl-mobile{border-top:3px solid var(--tk-faction-wu);}' +
        '.help-ctrl-mobile .help-ctrl-label,.help-ctrl-mobile .instruction-detail>span:first-child{color:var(--tk-faction-wu);}' +
        '.help-alt-toggle{width:100%;margin-top:10px;padding:10px;border-radius:0;cursor:pointer;font-size:13px;' +
        'background:rgba(232,220,196,0.06);color:var(--tk-text-sub);border:1px solid rgba(201,162,90,0.25);font-family:var(--tk-font-body);}' +
        '.help-alt-toggle.open{border-color:rgba(201,162,90,0.45);color:var(--tk-gold);}' +
        '.help-controls-alt{margin-top:10px;}' +
        '.instruction-detail{font-size:13px;color:var(--tk-text-muted);margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:12px;}' +
        '.instruction-detail>span:last-child{text-align:right;color:var(--tk-text);}' +
        '.flex-align-center{align-items:center;}.wasd-cluster{display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0;}.wasd-row{display:flex;gap:4px;}' +
        'kbd{background:linear-gradient(180deg,#fff,#e0e0e0);color:#111;border-radius:0;padding:4px 8px;font-weight:bold;font-size:12px;box-shadow:0 3px 0 #999;}' +
        '.close-btn{position:absolute;top:12px;right:12px;background:linear-gradient(160deg,#c23c30,#8e2419);' +
        'border:none;border-radius:0;width:36px;height:36px;color:#f3e4d0;font-weight:bold;cursor:pointer;box-shadow:0 3px 0 #5a1810;}' +
        '.close-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #5a1810;}' +

        '.unlock-dialog.tk-panel{border-radius:0;box-shadow:none;' +
        'background:linear-gradient(180deg,#221a12,#15100b);border:1px solid rgba(184,148,90,0.45);}' +
        '.unlock-dialog{padding:22px 24px 18px;min-width:240px;max-width:min(340px,88vw);text-align:center;}' +
        '.ud-title{color:var(--tk-text-sub);font-size:12px;letter-spacing:0.18em;margin-bottom:10px;}' +
        '.ud-name{color:var(--tk-gold);font-family:var(--tk-font-serif);font-weight:900;font-size:26px;' +
        'margin-bottom:6px;letter-spacing:0.08em;}' +
        '.ud-cost{color:var(--tk-gold);font-size:22px;margin-bottom:16px;font-family:var(--tk-font-num);}' +
        '.ud-btns{display:flex;gap:8px;}' +
        '.ud-btn{flex:1;padding:12px 0;min-height:44px;border:none;border-radius:0;font-size:14px;' +
        'cursor:pointer;font-family:var(--tk-font-body);letter-spacing:0.08em;}' +
        '.ud-cancel{background:none;color:var(--tk-text-sub);border:1px solid rgba(184,148,90,0.3);}' +
        '.ud-cancel:active{background:rgba(184,148,90,0.1);color:var(--tk-text);}' +
        '.ud-confirm{background:linear-gradient(178deg,#2e6b3e,#1f4a2c);color:#f3e4d0;border:1px solid rgba(110,180,120,0.35);box-shadow:none;}' +
        '.ud-confirm:active{filter:brightness(1.08);}' +
        '#unlock-confirm.tk-modal-overlay{z-index:8000;}' +

        '#unlock-toast{position:fixed;top:20%;left:50%;transform:translateX(-50%);z-index:8500;' +
        'max-width:min(88vw,420px);padding:12px 18px;pointer-events:none;text-align:center;' +
        'font-family:var(--tk-font-body);font-size:15px;font-weight:700;letter-spacing:0.06em;' +
        'color:var(--tk-text);border-radius:0;box-shadow:none;' +
        'background:linear-gradient(180deg,#221a12,#15100b);border:1px solid rgba(184,148,90,0.45);}' +
        '#unlock-toast.ok{border-color:rgba(110,180,120,0.55);color:#c8ecc8;' +
        'background:linear-gradient(180deg,#1a2a1a,#101810);}' +
        '#unlock-toast.fail{border-color:rgba(232,90,74,0.55);color:#f0c0b8;' +
        'background:linear-gradient(180deg,#2a1612,#18100e);}' +

        '@media (max-width:768px) and (orientation:portrait){' +
        '.ui-panel{width:100%;height:auto;max-height:82%;top:auto;bottom:0;' +
        'padding:12px 14px calc(16px + var(--tk-sab));' +
        'background:linear-gradient(180deg,rgba(14,12,9,0) 0%,rgba(20,15,10,0.85) 11%,rgba(14,12,9,0.97) 30%);' +
        'border:none;border-radius:0;box-shadow:none;}' +
        '.ui-panel.lobby-mode{height:75%;}.ui-title{font-size:22px;text-align:center;}' +
        '.step-container:not(.tk-network-step){gap:8px;background:rgba(14,12,9,0.75);border-radius:14px;padding:12px;' +
        'border:1px solid rgba(201,162,90,0.2);}' +
        '.overlay-text{font-size:32px;}.tk-prompt-box{width:90%;padding:20px;}' +
        '#cs-bigname{top:calc(var(--tk-sat) + 54px);right:8px;font-size:clamp(64px,17vw,130px);-webkit-text-stroke-width:1.2px;}' +
        '#instruction-wrapper.tk-panel,#instruction-wrapper.help-panel-v2{width:92%;max-width:400px;padding:40px 14px 16px;}' +
        '.changelog-panel.tk-panel{width:92%;max-width:400px;padding:40px 14px 16px;}' +
        '.help-hero-title{font-size:24px;}.help-ctrl-desc{display:none;}}' +

        '@media (max-height:500px) and (orientation:landscape){' +
        '.ui-panel{padding:14px 18px 14px 52px;width:min(50%,520px);}.ui-title{font-size:20px;}' +
        '.mode-card{min-height:56px;}.tk-prompt-box{padding:14px;}' +
        '#instruction-wrapper.help-panel-v2{max-height:90vh;overflow:auto;}' +
        '.changelog-panel.tk-panel{max-height:90vh;overflow:auto;}}';
    },

    /* Mode C：全屏角色 + 底部抽屜（mockup-C.html，後載入覆蓋 _lobbyCss） */
    _lobbyCssV2: function() {
        return '' +
        /* gear／prog-bar 在 body，不在 #fk-ui-root — 頂線變數必須掛 :root */
        ':root{--hub-top:max(8px,var(--tk-sat));--hub-chrome-h:44px;' +
        '--hub-edge:max(10px,env(safe-area-inset-left,0px));' +
        '--hub-edge-r:max(10px,env(safe-area-inset-right,0px));}' +

        '#fk-ui-root{' +
        '--gold:#f0cf87;--bronze:#b8945a;--seal:#a8413a;' +
        '--txt:#efe6d4;--sub:#8f8776;--dim:#6d6353;' +
        '--serif:var(--tk-font-serif);--sans:var(--tk-font-body);' +
        '--sat:var(--tk-sat);--sab:var(--tk-sab);' +
        'position:fixed;inset:0;height:100dvh;z-index:100;' +
        'font-family:var(--sans);color:var(--txt);pointer-events:none;overflow:hidden;}' +

        /* Hub／選角：禁長按 copy／選字（含 bio、按鈕、input；仍可點擊輸入名稱） */
        '#fk-ui-root,#fk-ui-root *,' +
        '#prog-bar,#prog-bar *,#gs-gear,' +
        '#profile-overlay,#profile-overlay *,' +
        '#pf-legal-overlay,#pf-legal-overlay *,' +
        '#unlock-confirm,#unlock-confirm *,#unlock-toast,' +
        '.tk-modal-overlay,.tk-modal-overlay *{' +
        '-webkit-user-select:none !important;user-select:none !important;' +
        '-webkit-touch-callout:none !important;}' +

        /* 選角／主選單：中心透明透出 3D；mode／room 仍實心黑底 */
        '#cs-vignette{position:absolute;inset:0;pointer-events:none;z-index:1;' +
        'background:radial-gradient(120% 90% at 50% 0%,rgba(36,27,16,0) 0%,rgba(14,12,9,.45) 72%,rgba(14,12,9,.78) 100%);}' +
        '#fk-ui-root:not([data-stage=\"brawler\"]):not([data-stage=\"network\"]) #cs-vignette{background:#080605;}' +
        '#fk-ui-root:not([data-stage=\"brawler\"]) #cs-bigname{display:none !important;}' +

        '#cs-stage::before{content:\"\";position:absolute;left:50%;top:34%;width:74%;height:52%;' +
        'transform:translate(-50%,-50%);pointer-events:none;' +
        'background:radial-gradient(closest-side,rgba(255,206,124,.22),transparent 72%);}' +
        '#cs-stage{position:absolute;inset:0;z-index:0;display:flex;' +
        'align-items:flex-end;justify-content:center;pointer-events:none;overflow:hidden;}' +
        '#cs-stage svg{height:78%;width:auto;display:block;}' +

        /* 選角大字：右面直書（沿用改版前設定） */
        '#cs-bigname{position:absolute;top:calc(var(--sat) + 58px);right:10px;left:auto;transform:none;z-index:1;' +
        'writing-mode:vertical-rl;font-family:var(--serif);font-weight:900;' +
        'font-size:clamp(64px,15vw,140px);line-height:.95;letter-spacing:6px;' +
        'color:transparent;-webkit-text-stroke:1.5px rgba(201,162,90,.42);' +
        'pointer-events:none;user-select:none;white-space:nowrap;}' +

        '.ui-panel{position:absolute;inset:0;right:auto;top:auto;width:auto;height:auto;z-index:2;display:flex;' +
        'flex-direction:column;pointer-events:none;background:none;padding:0;border:0;box-shadow:none;}' +
        '.ui-panel > *{pointer-events:auto;}' +
        /* 蓋過舊 _hubCss / _lobbyCss 的右欄寬度（否則橫向永遠困在左邊） */
        '.ui-panel[data-step=\"network\"],.ui-panel[data-step=\"brawler\"],' +
        '.ui-panel[data-step=\"mode\"],.ui-panel[data-step=\"room\"],.ui-panel.lobby-mode{' +
        'position:absolute !important;inset:0 !important;left:0 !important;right:0 !important;' +
        'top:0 !important;bottom:0 !important;width:auto !important;max-width:none !important;' +
        'height:auto !important;max-height:none !important;padding:0 !important;background:none !important;}' +
        '.ui-panel[data-step=\"network\"] .hub-step,.ui-panel[data-step=\"network\"] #step-network{' +
        'max-width:none !important;width:100% !important;margin:0 !important;height:100%;box-sizing:border-box;}' +

        /* 步驟標題隱藏；頂列 chrome 對齊；返回位由 data-back 動態切換 */
        '.hub-topbar{display:none !important;}' +
        '.ui-title{display:none !important;}' +
        '.tk-btn-back{background:rgba(10,8,6,.6);border:1px solid rgba(184,148,90,.4);border-radius:0;' +
        'color:var(--sub);font-size:12.5px;padding:0 15px;height:var(--hub-chrome-h);min-height:var(--hub-chrome-h);' +
        'box-sizing:border-box;cursor:pointer;' +
        'font-family:var(--sans);letter-spacing:.08em;display:inline-flex;align-items:center;' +
        'clip-path:polygon(6px 0,100% 0,calc(100% - 6px) 100%,0 100%);}' +
        '.tk-btn-back:active{background:rgba(184,148,90,.14);color:var(--txt);}' +
        /* 返回預設 top-left（齒輪旁）；prog-bar 佔右上。位址由 data-back 動態切換 */
        '.ui-panel > #btn-hub-back{position:fixed;z-index:4501;pointer-events:auto;' +
        'top:var(--hub-top) !important;left:calc(var(--hub-edge) + var(--hub-chrome-h) + 10px);' +
        'right:auto;bottom:auto;display:inline-flex;}' +
        '.ui-panel[data-back=\"top-left\"] > #btn-hub-back{' +
        'top:var(--hub-top) !important;left:calc(var(--hub-edge) + var(--hub-chrome-h) + 10px);' +
        'right:auto;bottom:auto;}' +
        '.ui-panel[data-back=\"top-right\"] > #btn-hub-back{' +
        'top:var(--hub-top) !important;right:var(--hub-edge-r);left:auto;bottom:auto;}' +
        '.ui-panel[data-back=\"bottom-right\"] > #btn-hub-back{' +
        'top:auto !important;left:auto;right:var(--hub-edge-r);' +
        'bottom:calc(max(11px,var(--sab)) + 62px);height:auto;min-height:var(--hub-chrome-h);}' +
        '.ui-panel[data-back=\"none\"] > #btn-hub-back,' +
        '.ui-panel[data-step=\"network\"] > #btn-hub-back{display:none;}' +

        '.cs-showcase{flex:1;min-height:0;position:relative;pointer-events:none;}' +

        /* 底部 sheet：頂緣漸層淡出（無硬邊直線） */
        '.cs-sheet{flex-shrink:0;border-top:0;' +
        'background:linear-gradient(180deg,rgba(10,8,6,0) 0%,' +
        'rgba(9,7,5,.28) 18%,rgba(9,7,5,.74) 48%,rgba(8,6,5,.97) 78%);' +
        'padding:8px 13px max(11px,var(--sab));}' +

        /* 設定／進度條／返回：只統一頂線；進度條維持右上原位 */
        '#gs-gear{top:var(--hub-top) !important;left:var(--hub-edge) !important;' +
        'background:rgba(10,8,6,.6);border:1px solid rgba(184,148,90,.4);border-radius:0;' +
        'box-shadow:none;color:var(--gold);width:var(--hub-chrome-h);height:var(--hub-chrome-h);' +
        'min-height:var(--hub-chrome-h);box-sizing:border-box;' +
        'clip-path:polygon(6px 0,100% 0,calc(100% - 6px) 100%,0 100%);}' +
        '.unlock-dialog.tk-panel,.unlock-dialog{border-radius:0 !important;box-shadow:none !important;}' +
        '.ud-btn{border-radius:0 !important;}' +
        '#unlock-toast{border-radius:0 !important;box-shadow:none !important;}' +
        '#instruction-wrapper.tk-panel,#instruction-wrapper.help-panel-v2{border-radius:0 !important;box-shadow:none !important;}' +
        '.help-ctrl-block,.help-alt-toggle,.close-btn,#help-overlay kbd{border-radius:0 !important;}' +
        '#prog-bar{top:var(--hub-top) !important;right:var(--hub-edge-r) !important;' +

        'left:auto !important;transform:none !important;' +
        'background:rgba(10,8,6,.6);border:1px solid rgba(184,148,90,.4);border-radius:0;' +
        'box-shadow:none;padding:6px 12px;box-sizing:border-box;' +
        'clip-path:polygon(6px 0,100% 0,calc(100% - 6px) 100%,0 100%);}' +
        '#prog-bar .pb-xp-track{border-radius:0;background:rgba(239,230,212,.1);}' +
        '#prog-bar .pb-xp-fill{border-radius:0;}' +
        '#prog-bar .pb-pass{border-radius:0;}' +
        /* 蓋過舊 portrait top:6px；主選單：標題靠上；表單頂緣約在由下往上 40% */
        '@media (orientation:portrait){' +
        '#prog-bar{top:var(--hub-top) !important;right:max(7px,env(safe-area-inset-right,0px)) !important;}' +
        '#step-network{justify-content:flex-start !important;gap:0 !important;position:relative;' +
        'padding-top:calc(var(--hub-top) + var(--hub-chrome-h) + 10px) !important;' +
        'padding-bottom:0 !important;}' +
        '#step-network .hub-hero{flex-shrink:0;margin:0;}' +
        '#step-network .hub-form{position:absolute;left:18px;right:18px;top:65%;' +
        'width:auto;max-width:420px;margin:0 auto;box-sizing:border-box;}' +
        '}' +

        /* 直向：名牌列 = 角色 | 垂直 stats；出陣在 sheet 最底（與模式一致） */
        '.cs-head{display:flex;align-items:center;gap:10px;padding:10px 0 8px;flex-shrink:0;}' +
        '.cs-nameplate{display:flex;align-items:center;gap:10px;flex:1;min-width:0;padding:0;}' +
        '.cs-nameplate-main{flex:1;min-width:0;}' +
        '.cs-seal{width:38px;height:38px;flex:0 0 38px;display:flex;align-items:center;' +
        'justify-content:center;font-family:var(--serif);font-weight:900;font-size:19px;' +
        'color:#f2e6d2;border-radius:0;box-shadow:inset 0 0 0 1.5px rgba(242,230,210,.26);' +
        'clip-path:polygon(0 0,calc(100% - 6px) 0,100% 6px,100% 100%,6px 100%,0 calc(100% - 6px));}' +
        '.cs-name{font-family:var(--serif);font-weight:900;font-size:21px;color:var(--gold);' +
        'line-height:1.05;letter-spacing:.06em;}' +
        '.cs-title{font-size:9.5px;color:var(--sub);letter-spacing:.2em;margin-top:2px;}' +
        '.cs-quick-stats{margin-left:auto;display:flex;flex-direction:column;gap:1px;' +
        'align-items:flex-end;flex-shrink:0;}' +
        '.cs-qstat{display:flex;align-items:baseline;gap:5px;line-height:1.25;}' +
        '.cs-qstat b{font-weight:700;color:var(--sub);font-size:9.5px;letter-spacing:.04em;' +
        'font-family:var(--sans);min-width:2.4em;}' +
        '.cs-qstat b::after{content:\":\";}' +
        '.cs-qstat span{color:var(--gold);font-size:12px;font-weight:700;' +
        'font-variant-numeric:tabular-nums;min-width:2.6em;text-align:right;}' +
        '#step-brawler .cs-brawler-actions{margin-top:9px;flex-shrink:0;}' +

        '.cs-tabs{display:flex;margin:0 -13px 9px;border-bottom:1px solid rgba(184,148,90,.16);}' +
        '.cs-tabs button{flex:1;padding:0;min-height:44px;font-size:12.5px;background:none;' +
        'border:0;cursor:pointer;color:#7d735f;font-family:var(--serif);font-weight:700;' +
        'letter-spacing:.12em;border-bottom:2px solid transparent;}' +
        '.cs-tabs button.on{color:var(--gold);border-bottom-color:var(--gold);}' +
        '.cs-pane{display:none;min-height:96px;}' +
        '.cs-pane.on{display:block;}' +
        '.cs-bio{font-size:12.5px;line-height:1.55;color:var(--txt);padding:2px 0 8px;' +
        'max-height:112px;overflow-y:auto;-webkit-overflow-scrolling:touch;}' +
        '.cs-abilities{margin-top:2px;padding-top:8px;border-top:1px solid rgba(184,148,90,.12);}' +

        '.brawler-grid{display:flex;gap:7px;overflow-x:auto;padding:2px 0 7px;' +
        'scrollbar-width:none;-webkit-overflow-scrolling:touch;}' +
        '.brawler-grid::-webkit-scrollbar{display:none;}' +
        '.b-card{position:relative;flex:0 0 68px;height:84px;cursor:pointer;overflow:hidden;' +
        'display:block;background:linear-gradient(180deg,#241b12,#120c07);' +
        'border:1px solid rgba(239,230,212,.14);border-radius:0;' +
        'clip-path:polygon(0 0,calc(100% - 6px) 0,100% 6px,100% 100%,6px 100%,0 calc(100% - 6px));' +
        'transition:border-color .14s ease;transform:none;box-shadow:none;}' +
        '.b-card .c-bg{position:absolute;left:0;right:0;bottom:0;height:36%;pointer-events:none;opacity:.7;}' +
        '.b-card .c-glyph{position:absolute;inset:0 0 16px;display:flex;align-items:center;' +
        'justify-content:center;font-family:var(--serif);font-size:26px;font-weight:900;' +
        'color:#d8cdb6;z-index:1;line-height:1;}' +
        '.b-card .c-name{position:absolute;left:0;right:0;bottom:0;text-align:center;font-size:10px;' +
        'padding:2px 2px 3px;color:#f0e6d2;font-family:var(--serif);font-weight:700;z-index:1;' +
        'background:linear-gradient(180deg,transparent,rgba(6,4,3,.92) 42%);' +
        'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;letter-spacing:0;text-transform:none;}' +
        '.b-card.selected{transform:none;border-color:var(--gold);' +
        'box-shadow:0 0 0 1px var(--gold),0 0 12px rgba(240,207,135,.28);}' +
        '.b-card.selected .c-glyph{color:#f7ecd6;}' +
        '.b-card.locked{filter:saturate(.35);}' +
        '.b-card.locked .c-glyph,.b-card.locked .c-name{opacity:1;}' +
        '.c-lock{position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;' +
        'align-items:center;justify-content:center;gap:2px;background:rgba(0,0,0,.5);}' +
        '.c-lock-icon{font-size:12px;color:var(--sub);font-family:var(--serif);' +
        'width:auto;height:auto;border:0;background:none;border-radius:0;}' +
        '.c-lock-price{font-size:9.5px;color:var(--bronze);}' +
        '.c-pass-badge{position:absolute;top:2px;right:2px;z-index:2;font-size:8px;font-weight:700;' +
        'color:#1a1208;background:linear-gradient(135deg,var(--gold),var(--bronze));padding:1px 4px;border-radius:0;}' +

        '.cs-stat{display:flex;align-items:center;gap:7px;font-size:11px;color:var(--sub);margin-bottom:5px;}' +
        '.cs-stat b{width:2em;font-weight:400;}' +
        '.cs-track{flex:1;height:5px;background:rgba(239,230,212,.1);overflow:hidden;border-radius:0;}' +
        '.cs-fill{height:100%;background:linear-gradient(90deg,var(--bronze),var(--gold));' +
        'transition:width .34s cubic-bezier(.2,.7,.3,1);}' +
        '.cs-stat span{width:3.4em;text-align:right;color:var(--txt);font-size:11px;}' +
        '.cs-ab{display:flex;gap:7px;font-size:11.5px;line-height:1.35;align-items:flex-start;margin-bottom:5px;}' +
        '.cs-ab-icon{width:20px;height:20px;flex:0 0 20px;display:flex;align-items:center;' +
        'justify-content:center;font-family:var(--serif);font-size:11px;font-weight:900;' +
        'border:1px solid rgba(184,148,90,.5);color:var(--gold);background:rgba(184,148,90,.1);border-radius:0;}' +
        '.cs-ab.super .cs-ab-icon{background:var(--seal);border-color:#c05a50;color:#f2e6d2;}' +

        '.cs-skin-select{width:100%;padding:10px;min-height:44px;background:rgba(11,9,7,.8);' +
        'color:var(--gold);border:1px solid rgba(184,148,90,.4);font-size:13px;border-radius:0;' +
        'font-family:var(--sans);outline:none;appearance:none;-webkit-appearance:none;}' +
        '.cs-skin-lock{display:none;flex-direction:column;gap:7px;padding:9px 11px;margin-top:7px;' +
        'border:1px solid rgba(232,90,74,.42);background:rgba(40,16,12,.5);border-radius:0;}' +
        '.cs-skin-lock.is-visible{display:flex;}' +
        '.cs-skin-lock-label{font-size:12px;color:#f0c8c0;line-height:1.4;}' +

        '.btn-container{margin-top:9px;}' +
        '.mode-sheet-actions{display:flex;flex-direction:column;gap:8px;}' +
        '.tk-btn{border:0;cursor:pointer;font-family:var(--sans);}' +
        '#btn-play.cs-play,#btn-mode-confirm.cs-play,#btn-start-tutorial.cs-play{display:block;width:100%;padding:14px 0;min-height:50px;' +
        'font-family:var(--serif);font-weight:900;font-size:19px;letter-spacing:.3em;text-indent:.3em;' +
        'color:#2a1d08;background:linear-gradient(178deg,#f6d689,#dcb669 52%,#a8823f);border-radius:0;' +
        'clip-path:polygon(12px 0,100% 0,calc(100% - 12px) 100%,0 100%);' +
        'box-shadow:inset 0 1px 0 rgba(255,247,225,.5),inset 0 -2px 0 rgba(0,0,0,.28);}' +
        '#btn-play.cs-play:active,#btn-mode-confirm.cs-play:active,#btn-start-tutorial.cs-play:active{filter:brightness(.94);}' +
        '#btn-play.cs-play-locked{background:linear-gradient(178deg,#7a4a3a,#4a251d);color:#e8d5c8;}' +

        '.mode-deck{position:absolute;inset:0;z-index:1;overflow:hidden;pointer-events:auto;}' +
        '.mode-slide{position:absolute;inset:0;display:flex;flex-direction:column;' +
        'justify-content:flex-end;padding:0 16px 8px;opacity:0;pointer-events:none;' +
        'transition:opacity .26s ease;background:none;border:0;border-radius:0;min-height:0;cursor:pointer;}' +
        '.mode-slide.on{opacity:1;pointer-events:auto;}' +
        /* 模式色塊上下漸層淡出（避免頂部硬邊直線） */
        '.mode-slide .mc-bg{position:absolute;inset:0;z-index:-1;' +
        '-webkit-mask-image:linear-gradient(180deg,transparent 0%,#000 14%,#000 78%,transparent 100%);' +
        'mask-image:linear-gradient(180deg,transparent 0%,#000 14%,#000 78%,transparent 100%);}' +

        /* 模式頁：topbar 浮在全屏 deck 上，色塊可從螢幕頂漸層淡出（無硬邊） */
        '.ui-panel[data-step=\"mode\"]{position:absolute !important;inset:0 !important;}' +
        '.ui-panel[data-step=\"mode\"] .hub-topbar{position:absolute;left:0;right:0;top:0;z-index:6;' +
        'background:transparent;pointer-events:none;}' +
        '.ui-panel[data-step=\"mode\"] .hub-topbar > *{pointer-events:auto;}' +
        '.ui-panel[data-step=\"mode\"] #step-mode{position:absolute;inset:0;height:100% !important;' +
        'width:100% !important;display:flex;flex-direction:column;}' +
        '.ui-panel[data-step=\"mode\"] #step-mode .cs-showcase{flex:1;min-height:0;}' +
        '.ui-panel[data-step=\"mode\"] #step-mode .mode-deck{inset:0;}' +

        '.mode-slide .mc-kanji{position:absolute;left:50%;top:36%;transform:translate(-50%,-50%);' +
        'font-family:var(--serif);font-weight:900;font-size:clamp(130px,42vw,220px);line-height:.8;' +
        'color:transparent;-webkit-text-stroke:2px rgba(240,207,135,.15);pointer-events:none;}' +
        '.mode-slide .mc-tag{align-self:flex-start;font-family:var(--serif);font-weight:900;' +
        'font-size:9.5px;letter-spacing:.16em;color:#241a08;padding:3px 10px;margin-bottom:7px;' +
        'background:linear-gradient(178deg,#f0cf87,#b8903f);' +
        'clip-path:polygon(4px 0,100% 0,calc(100% - 4px) 100%,0 100%);}' +
        '.mode-slide .mc-title{font-family:var(--serif);font-weight:900;font-size:31px;' +
        'color:#fdf6e8;letter-spacing:.1em;line-height:1.04;paint-order:stroke;' +
        '-webkit-text-stroke:3.2px rgba(5,3,2,.9);}' +
        '.mode-slide .mc-desc{font-size:12px;color:#c3b79c;margin-top:4px;line-height:1.45;}' +
        '.mc-meta{display:flex;gap:5px;margin-top:7px;flex-wrap:wrap;}' +
        '.mc-chip{display:inline-flex;align-items:center;font-size:9.5px;letter-spacing:.06em;' +
        'padding:2px 7px;color:#d6c9ac;background:rgba(0,0,0,.5);' +
        'border:1px solid rgba(184,148,90,.35);}' +
        '.mc-chip.hi{color:#241a08;background:linear-gradient(178deg,#f0cf87,#c99a45);' +
        'border-color:#f0cf87;font-weight:700;}' +
        '.mc-best{margin-top:7px;font-size:10.5px;color:var(--bronze);display:flex;' +
        'align-items:center;gap:6px;flex-wrap:wrap;}' +
        '.mc-best b{color:var(--gold);font-family:var(--serif);}' +
        '.mc-lb-open-btn{margin-left:auto;padding:6px 13px;min-height:44px;font-size:10.5px;' +
        'background:rgba(184,148,90,.08);border:1px solid rgba(184,148,90,.35);' +
        'color:var(--gold);cursor:pointer;font-family:var(--sans);}' +
        '.mode-nav{position:absolute;top:44%;transform:translateY(-50%);width:38px;height:66px;' +
        'display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:5;' +
        'color:rgba(240,207,135,.45);font-size:26px;background:none;border:0;font-family:var(--serif);}' +
        '.mode-nav.prev{left:0;}.mode-nav.next{right:0;}' +
        '.mode-dots{display:flex;justify-content:center;gap:6px;padding:8px 0 6px;}' +
        '.mode-dots i{width:6px;height:6px;background:rgba(184,148,90,.3);cursor:pointer;' +
        'transform:rotate(45deg);transition:background .18s ease;display:block;}' +
        '.mode-dots i.on{background:var(--gold);box-shadow:0 0 8px rgba(240,207,135,.5);}' +
        '#room-buttons{display:flex;gap:8px;margin-top:8px;}' +
        '#room-buttons .tk-btn{flex:1;padding:10px 0;min-height:44px;font-size:12.5px;' +
        '.arena-deck{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:10px;flex-wrap:wrap;}' +
        '.arena-pick-label{font-size:11px;color:#c3b79c;letter-spacing:.12em;margin-right:2px;}' +
        '.arena-card{position:relative;padding:7px 14px;min-height:44px;border:1px solid rgba(184,148,90,.35);' +
        'border-radius:8px;background:linear-gradient(180deg,rgba(32,26,18,.92),rgba(16,12,9,.92));' +
        'cursor:pointer;transition:border-color .15s,box-shadow .15s,transform .1s;}' +
        '.arena-card:hover{border-color:var(--gold,#d8b04c);transform:translateY(-1px);}' +
        '.arena-card.on{border-color:var(--gold,#d8b04c);box-shadow:0 0 12px rgba(240,207,135,.35),inset 0 0 8px rgba(240,207,135,.12);}' +
        '.arena-card-name{display:block;font-family:var(--serif);font-weight:900;font-size:14px;color:#e8dcc0;line-height:1.1;}' +
        '.arena-card.on .arena-card-name{color:var(--gold,#f0cf87);}' +
        '.arena-card-size{display:block;font-size:10px;color:#8f8268;margin-top:2px;}' +
        'background:rgba(184,148,90,.07);border:1px solid rgba(184,148,90,.34);color:var(--gold);}' +

        '#step-network{display:none;flex-direction:column;justify-content:center;' +
        'height:100%;padding:0 18px;gap:13px;}' +
        '#step-network.on{display:flex;}' +
        '.hub-brand{font-family:var(--serif);font-weight:900;font-size:clamp(32px,10vw,50px);' +
        'color:var(--gold);letter-spacing:.14em;text-align:center;line-height:1;' +
        'text-shadow:0 3px 14px rgba(0,0,0,.8);}' +
        '.hub-tagline{color:var(--sub);font-size:10.5px;letter-spacing:.3em;text-align:center;margin-top:7px;}' +
        '.hub-name-label{display:block;color:var(--sub);font-size:10px;letter-spacing:.2em;margin-bottom:5px;}' +
        '.tk-input{width:100%;padding:12px;min-height:46px;background:rgba(11,9,7,.8);' +
        'color:var(--gold);border:1px solid rgba(184,148,90,.4);text-align:center;border-radius:0;' +
        'font-size:16px;letter-spacing:.1em;font-family:var(--sans);outline:none;box-shadow:none;}' +
        '.hub-entry{display:flex;align-items:center;gap:11px;width:100%;padding:13px;min-height:60px;' +
        'cursor:pointer;text-align:left;background:linear-gradient(160deg,#221a11,#140e08);' +
        'border:1px solid rgba(184,148,90,.24);border-radius:0;' +
        'clip-path:polygon(0 0,calc(100% - 11px) 0,100% 11px,100% 100%,11px 100%,0 calc(100% - 11px));}' +
        '.hub-entry-kanji{width:38px;height:38px;flex:0 0 38px;display:flex;align-items:center;' +
        'justify-content:center;font-family:var(--serif);font-weight:900;font-size:20px;color:#f2e6d2;' +
        'background:linear-gradient(160deg,#a4514a,#6d2f28);border-radius:0;}' +
        '.hub-entry-kanji-multi{background:linear-gradient(160deg,#2f6389,#1d4058);}' +
        '.hub-entry-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;}' +
        '.hub-entry-title{font-family:var(--serif);font-weight:900;font-size:17px;' +
        'color:var(--gold);letter-spacing:.08em;}' +
        '.hub-entry-desc{font-size:10.5px;color:var(--sub);}' +
        '.hub-entry-arrow{font-size:19px;color:rgba(184,148,90,.42);}' +
        '.tk-btn-ghost{width:100%;padding:11px;min-height:44px;background:none;' +
        'border:1px solid rgba(184,148,90,.3);color:var(--sub);font-size:12.5px;cursor:pointer;border-radius:0;}' +

        '#step-room-lobby{display:none;flex-direction:column;height:100%;padding:0 14px;}' +
        '#step-room-lobby.on{display:flex;}' +
        '.room-info-box{text-align:center;padding:16px 0 12px;flex-shrink:0;' +
        'background:none;border:0;border-radius:0;}' +
        '.room-info-label{color:var(--sub);font-size:10px;letter-spacing:.22em;}' +
        '.room-code-display{font-family:var(--serif);font-weight:900;' +
        'font-size:clamp(40px,13vw,58px);letter-spacing:.18em;color:var(--gold);margin:5px 0;' +
        'text-shadow:0 3px 12px rgba(0,0,0,.8);}' +
        '.room-mode-label{color:var(--sub);font-size:12px;}' +
        '.player-list{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:6px;' +
        'padding:9px;background:rgba(11,9,7,.5);border:1px solid rgba(184,148,90,.2);border-radius:0;}' +
        '.player-item{padding:11px 12px;min-height:44px;font-size:14px;display:flex;' +
        'justify-content:space-between;align-items:center;background:rgba(239,230,212,.04);' +
        'border:1px solid rgba(239,230,212,.08);border-radius:0;}' +
        '.player-item.is-me{border-color:var(--bronze);background:rgba(184,148,90,.12);}' +
        '.room-wait{color:var(--sub);text-align:center;font-size:13px;padding:7px;}' +
        '#step-room-lobby .btn-container{display:flex;flex-direction:column;gap:8px;' +
        'padding:10px 0 max(11px,var(--sab));flex-shrink:0;margin-top:0;}' +
        '.tk-btn-orange{padding:12px 0;min-height:46px;font-size:14px;color:#2a1d08;' +
        'background:linear-gradient(178deg,#d99a4e,#b06f2c);border:0;cursor:pointer;border-radius:0;}' +
        '.tk-btn-danger{padding:13px 0;min-height:48px;font-size:16px;font-family:var(--serif);' +
        'font-weight:900;letter-spacing:.2em;color:#f3e4d0;' +
        'background:linear-gradient(178deg,#ad5c51,#81342b);border:0;cursor:pointer;border-radius:0;' +
        'clip-path:polygon(11px 0,100% 0,calc(100% - 11px) 100%,0 100%);}' +

        '#step-brawler,#step-mode{flex-direction:column;height:100%;gap:0;}' +
        '#step-brawler.on,#step-mode.on{display:flex;}' +
        '.hub-form{display:flex;flex-direction:column;gap:13px;}' +
        '.hub-actions{display:flex;flex-direction:column;gap:10px;}' +

        /* Landscape：對齊 mockup — 全屏用滿；蓋過舊 max-height:500px 右欄規則 */
        '@media (orientation:landscape){' +
        '.ui-panel,.ui-panel[data-step=\"network\"],.ui-panel[data-step=\"brawler\"],' +
        '.ui-panel[data-step=\"mode\"],.ui-panel[data-step=\"room\"],.ui-panel.lobby-mode{' +
        'position:absolute !important;inset:0 !important;left:0 !important;right:0 !important;' +
        'top:0 !important;bottom:0 !important;width:auto !important;max-width:none !important;' +
        'height:auto !important;max-height:none !important;padding:0 !important;background:none !important;}' +
        '#gs-gear{top:var(--hub-top) !important;left:var(--hub-edge) !important;}' +
        '.ui-panel > #btn-hub-back{top:var(--hub-top);}' +
        '.ui-panel[data-back=\"bottom-right\"] > #btn-hub-back{' +
        'top:auto;bottom:calc(max(10px,var(--sab)) + 58px);}' +

        /* 主選單：左品牌 + 右表單（用滿寬） */
        '#step-network{flex-direction:row !important;align-items:center;justify-content:center;' +
        'gap:clamp(20px,4vw,48px);height:100% !important;min-height:0;padding:16px 4vw;' +
        'max-width:none !important;margin:0 !important;width:100% !important;box-sizing:border-box;}' +
        '#step-network .hub-hero{flex:1 1 42%;min-width:0;display:flex;flex-direction:column;' +
        'align-items:center;justify-content:center;text-align:center;}' +
        '#step-network .hub-brand{font-size:clamp(40px,7vw,64px);}' +
        '#step-network .hub-form{flex:1 1 48%;min-width:280px;max-width:460px;width:100%;' +
        'display:flex;flex-direction:column;gap:12px;}' +
        '#step-room-lobby{max-width:820px;margin:0 auto;width:100%;padding:0 18px;height:100%;box-sizing:border-box;}' +

        /* 選角：上 3D、下 sheet；名牌+垂直stats+出陣同一行（DOM 出陣在底，grid 拉到首列） */
        '#step-brawler{flex-direction:column !important;width:100%;height:100%;}' +
        '#step-brawler .cs-showcase{flex:1;min-height:0;}' +
        '#cs-bigname{left:auto;right:12px;top:calc(var(--sat) + 56px);transform:none;' +
        'writing-mode:vertical-rl;font-size:clamp(56px,12vw,120px);letter-spacing:6px;' +
        '-webkit-text-stroke:1.4px rgba(201,162,90,.4);}' +
        '#step-brawler .cs-sheet{display:grid !important;grid-template-columns:1fr auto 200px;' +
        'grid-template-rows:auto auto minmax(0,1fr);gap:6px 14px;align-items:center;' +
        'width:100% !important;flex-shrink:0;height:auto !important;max-height:48%;' +
        'overflow-x:hidden;overflow-y:auto;box-sizing:border-box;padding:6px 18px max(10px,var(--sab));' +
        'border-top:0;border-left:0;' +
        'background:linear-gradient(180deg,rgba(10,8,6,0) 0%,rgba(9,7,5,.22) 20%,rgba(9,7,5,.7) 48%,rgba(8,6,5,.96) 78%);}' +
        '#step-brawler .cs-head{display:contents;}' +
        '#step-brawler .cs-nameplate{grid-column:1;grid-row:1;min-width:0;}' +
        '#step-brawler .cs-quick-stats{grid-column:2;grid-row:1;margin-left:0;flex-direction:column;' +
        'align-items:flex-end;gap:2px;}' +
        '#step-brawler .cs-qstat span{font-size:13px;}' +
        '#step-brawler .cs-brawler-actions{grid-column:3;grid-row:1;margin-top:0;width:200px;max-width:28vw;' +
        'justify-self:stretch;align-self:center;}' +
        '#step-brawler #btn-play.cs-play{min-height:48px;font-size:17px;padding:12px 8px;}' +
        '#step-brawler .cs-tabs{grid-column:1/-1;grid-row:2;margin:0;}' +
        '#step-brawler .cs-panes{grid-column:1/-1;grid-row:3;min-width:0;min-height:0;}' +
        '#step-brawler .cs-pane{min-height:0;}' +
        '#step-brawler .cs-bio{max-height:72px;}' +
        '#step-brawler .b-card{flex:0 0 64px;height:78px;}' +
        '#step-brawler .b-card .c-glyph{font-size:24px;}' +
        '#step-brawler .b-card .c-name{font-size:9.5px;}' +

        /* 模式：全屏輪播；底欄 dots + 出戰 */
        '#step-mode{flex-direction:column !important;position:relative;width:100%;height:100%;}' +
        '#step-mode .cs-showcase{flex:1;min-height:0;position:relative;width:100%;}' +
        '#step-mode .mode-deck{position:absolute;inset:0;}' +
        '#step-mode .mode-slide{padding:0 56px 12px 24px;justify-content:flex-end;align-items:flex-start;' +
        'text-align:left;box-sizing:border-box;}' +
        '#step-mode .mode-slide.on{opacity:1;pointer-events:auto;}' +
        '#step-mode .mode-slide .mc-tag{align-self:flex-start;}' +
        '#step-mode .mode-slide .mc-title{font-size:clamp(26px,4vw,36px);-webkit-text-stroke-width:2.4px;}' +
        '#step-mode .mode-slide .mc-kanji{font-size:clamp(100px,20vw,180px);top:40%;left:46%;}' +
        '#step-mode .mode-slide .mc-desc{max-width:min(520px,55%);}' +
        '#step-mode .mode-nav{top:46%;}' +
        '#step-mode .cs-sheet{display:flex !important;flex-direction:row;align-items:center;justify-content:flex-end;' +
        'gap:12px;flex-wrap:wrap;width:100% !important;flex-shrink:0;height:auto !important;position:relative;' +
        'padding:6px 18px max(10px,var(--sab));border-top:0;border-left:0;' +
        'background:linear-gradient(180deg,rgba(10,8,6,0) 0%,rgba(8,6,5,.35) 40%,rgba(8,6,5,.88) 100%);}' +
        '#step-mode .mode-dots{position:absolute;left:50%;transform:translateX(-50%);' +
        'padding:0;pointer-events:auto;}' +
        '#step-mode .mode-sheet-actions{width:auto;flex:0 0 auto;}' +
        '#step-mode #btn-mode-confirm.cs-play{width:auto;min-width:220px;flex:0 0 auto;' +
        'padding:12px 32px;min-height:48px;font-size:17px;margin:0;}' +
        '#step-mode #room-buttons{width:100%;order:3;margin-top:0;}' +
        '}' +

        /* 舊 _lobbyCss 短橫向規則會把 panel 縮成 50% — 必須再蓋一次 */
        '@media (max-height:500px) and (orientation:landscape){' +
        '.ui-panel,.ui-panel[data-step=\"network\"],.ui-panel[data-step=\"brawler\"],' +
        '.ui-panel[data-step=\"mode\"],.ui-panel[data-step=\"room\"],.ui-panel.lobby-mode{' +
        'position:absolute !important;inset:0 !important;width:auto !important;max-width:none !important;' +
        'height:auto !important;max-height:none !important;padding:0 !important;}' +
        '}' +

        '@media (max-width:768px) and (orientation:portrait){' +
        '.ui-panel{width:auto;height:auto;max-height:none;top:0;bottom:0;inset:0;' +
        'padding:0;background:none;border:none;border-radius:0;box-shadow:none;}' +
        '.step-container:not(.tk-network-step){gap:0;background:none;border-radius:0;padding:0;border:0;}' +
        '#cs-bigname{top:calc(var(--sat) + 54px);right:8px;left:auto;transform:none;' +
        'writing-mode:vertical-rl;font-size:clamp(64px,17vw,130px);-webkit-text-stroke-width:1.2px;}' +
        '}';
    },

    _endScreenCss: function() {
        return '' +
        '#dom-end-screen{position:fixed;inset:0;z-index:6000;' +
        'display:flex;flex-direction:column;align-items:center;justify-content:flex-start;' +
        'opacity:0;transition:opacity 0.3s ease;pointer-events:auto;overflow-y:auto;' +
        '-webkit-overflow-scrolling:touch;touch-action:pan-y;overscroll-behavior:contain;padding:4vh 0;}' +
        '#dom-end-screen.show{opacity:1;}' +

        '.es-title{font-family:var(--tk-font-serif);font-weight:900;font-size:clamp(44px,10vw,110px);' +
        'letter-spacing:4px;margin-top:2vh;text-shadow:0 4px 16px rgba(0,0,0,0.9);' +
        'transform:scale(0.2);opacity:0;color:var(--tk-gold);}' +
        '.es-title.pop{animation:esTitlePop 0.55s var(--tk-anim-pop) forwards;}' +
        '@keyframes esTitlePop{0%{transform:scale(0.2) rotate(-4deg);opacity:0;}60%{transform:scale(1.08);opacity:1;}100%{transform:scale(1);opacity:1;}}' +

        '.es-mvp-card{margin-top:3vh;padding:18px 40px;transform:scale(0);opacity:0;}' +
        '.es-mvp-card.pop{animation:esMvpPop 0.5s var(--tk-anim-pop) 0.9s forwards;}' +
        '@keyframes esMvpPop{0%{transform:scale(0);opacity:0;}70%{transform:scale(1.06);opacity:1;}100%{transform:scale(1);opacity:1;}}' +
        '.es-mvp-label{font-size:clamp(16px,3.2vw,26px);color:var(--tk-bronze);letter-spacing:4px;font-family:var(--tk-font-body);}' +
        '.es-mvp-name{font-size:clamp(24px,5vw,40px);color:var(--tk-gold);font-family:var(--tk-font-serif);font-weight:900;margin:4px 0;}' +
        '.es-mvp-stats{font-size:clamp(14px,2.4vw,20px);color:var(--tk-text-muted);letter-spacing:1px;}' +

        '.es-board-wrap{display:flex;gap:24px;margin-top:3.5vh;flex-wrap:wrap;justify-content:center;width:92%;max-width:1000px;}' +
        '.es-team-col{flex:1;min-width:280px;}' +
        '.es-team-header{font-family:var(--tk-font-serif);font-weight:900;font-size:clamp(17px,3vw,24px);' +
        'color:var(--tk-text);padding:10px;border-radius:10px 10px 0 0;text-align:center;letter-spacing:2px;}' +
        '.es-team-header.mine{background:linear-gradient(90deg,#1565c0,#1e88e5);}' +
        '.es-team-header.enemy{background:linear-gradient(90deg,#8e2419,#c23c30);}' +

        '.es-row{display:flex;align-items:center;justify-content:space-between;padding:9px 14px;margin-top:4px;border-radius:8px;' +
        'background:rgba(232,220,196,0.05);font-family:var(--tk-font-body);transform:translateX(-40px);opacity:0;}' +
        '.es-row.mine-row{background:rgba(201,162,90,0.12);border:1px solid rgba(201,162,90,0.35);}' +
        '.es-row.slide{animation:esRowSlide 0.35s ease-out forwards;}' +
        '@keyframes esRowSlide{0%{transform:translateX(-40px);opacity:0;}100%{transform:translateX(0);opacity:1;}}' +
        '.es-row .es-rname{font-size:clamp(15px,2.4vw,19px);color:var(--tk-text);}' +
        '.es-row .es-rstat{font-size:clamp(13px,2vw,16px);color:var(--tk-text-sub);}' +
        '.es-row .es-mvp-tag{color:var(--tk-gold);font-size:0.8em;margin-left:6px;}' +
        '.es-btn{margin-top:4vh;opacity:0;}.es-btn.show{opacity:1;}' +
        '.es-score-line{font-size:clamp(20px,4vw,32px);color:var(--tk-text);margin-top:8px;text-shadow:0 2px 6px rgba(0,0,0,0.8);opacity:0;transition:opacity 0.3s ease 0.5s;}' +
        '.es-reward-bar{margin-top:2.5vh;padding:12px 28px;border-radius:12px;display:flex;gap:24px;' +
        'font-family:var(--tk-font-body);opacity:0;transition:opacity 0.4s ease;' +
        'background:rgba(245,210,122,0.12);border:1px solid rgba(201,162,90,0.5);}' +
        '.es-reward-coins{color:var(--tk-gold);font-size:clamp(18px,3vw,24px);}' +
        '.es-reward-xp{color:var(--tk-team-blue);font-size:clamp(18px,3vw,24px);}' +

        '.es-solo-col{max-width:520px;margin:0 auto;}' +
        '.es-solo-header{background:linear-gradient(90deg,#a8823f,#f5d27a) !important;color:#241a08 !important;}' +
        '.es-rank-badge{font-size:clamp(16px,2.4vw,19px);color:var(--tk-bronze);min-width:38px;text-align:center;font-family:var(--tk-font-num);}' +
        '.es-solo-stats{display:flex;gap:14px;justify-content:center;margin-top:6px;flex-wrap:wrap;}' +
        '.es-stat-box{min-width:76px;padding:10px 14px;border-radius:10px;background:rgba(232,220,196,0.05);border:1px solid rgba(201,162,90,0.3);}' +
        '.es-stat-num{font-size:clamp(22px,4.5vw,36px);color:var(--tk-text);font-family:var(--tk-font-num);line-height:1;}' +
        '.es-stat-lbl{font-size:clamp(11px,2vw,13px);color:var(--tk-bronze);letter-spacing:2px;margin-top:4px;}';
    }
};
