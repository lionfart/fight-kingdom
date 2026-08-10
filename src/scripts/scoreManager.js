var ScoreManager = pc.createScript('scoreManager');

// PvP bot 競技場顯示名（內建於 scoreManager，避免 brawlerConfig 同步遺失 helper）
var BOT_ARENA_NAMES = {
    lubu: { zh: '奉先弒天', en: 'Fengxian Ascendant' },
    guanyu: { zh: '武聖弒神', en: 'Saint Godslayer' },
    caocao: { zh: '魔王孟德', en: 'Demon Lord Mengde' },
    zhangliao: { zh: '文遠夜襲', en: 'Wenyuan Night Raid' },
    zhangjiao: { zh: '黃天業火', en: 'Yellow Heaven Inferno' },
    zhouyu: { zh: '臥龍幽冥', en: 'Nether Strategist' },
    sunquan: { zh: '江東霸業', en: 'Jiangdong Hegemony' },
    zhangfei: { zh: '萬人敵狂', en: 'Peerless Fury' },
    diaochan: { zh: '閉月傾城', en: 'Moonveil Enchantress' },
    liubei: { zh: '仁德昭烈', en: 'Benevolent Zhaolie' }
};

ScoreManager.t = function (key, vars) {
    if (window.TKI18n && typeof window.TKI18n.t === 'function') return window.TKI18n.t(key, vars);
    return key;
};
ScoreManager.prototype.t = function (key, vars) {
    return ScoreManager.t(key, vars);
};
ScoreManager.prototype._pickText = function (v) {
    if (v == null) return '';
    if (typeof v === 'string' || typeof v === 'number') return String(v);
    if (window.TKI18n && typeof window.TKI18n.pick === 'function') return window.TKI18n.pick(v);
    var lang = (window.TKI18n && window.TKI18n.getLang && window.TKI18n.getLang()) || 'zh-TW';
    if (lang === 'en') return String(v.en || v.zh || '');
    return String(v.zh || v.en || '');
};

ScoreManager.prototype.getBotArenaName = function (bType) {
    if (BOT_ARENA_NAMES[bType]) return this._pickText(BOT_ARENA_NAMES[bType]);
    if (window.BrawlerConfig && BrawlerConfig.botArenaNames && BrawlerConfig.botArenaNames[bType]) {
        return this._pickText(BrawlerConfig.botArenaNames[bType]);
    }
    var cfg = window.BrawlerConfig && window.BrawlerConfig[bType];
    if (cfg && cfg.select && cfg.select.zh) return cfg.select.zh;
    return 'Bot_' + (bType || '?');
};

ScoreManager.prototype.getBrawlerZhName = function (bType) {
    var BC = window.BrawlerConfig;
    if (BC && BC.getDisplayName) return BC.getDisplayName(bType);
    if (BC && BC.getDisplayZh) return BC.getDisplayZh(bType);
    var cfg = BC && BC[bType];
    if (cfg && cfg.displayZh) return cfg.displayZh;
    if (cfg && cfg.select && cfg.select.zh) return cfg.select.zh;
    if (cfg && cfg.name) return cfg.name;
    return this.t('score.name.unknown');
};

ScoreManager.prototype.getBotScoreName = function (bType) {
    return this.getBotArenaName(bType) + ' (' + this.getBrawlerZhName(bType) + ')';
};

ScoreManager.prototype.resolvePlayerName = function (data) {
    if (data && data.playerName) return data.playerName;
    if (data && data.name) return data.name;
    if (this.app.networkManager && this.app.networkManager.playerName && this.app.networkManager.playerName !== 'Unknown') {
        return this.app.networkManager.playerName;
    }
    var pm = this.app.progressionManager;
    if (pm && pm.data && pm.data.displayName) return pm.data.displayName;
    if (typeof localStorage !== 'undefined') {
        var saved = localStorage.getItem('fk_player_name');
        if (saved) return saved;
    }
    return 'Player';
};

ScoreManager.prototype._lookupDisplayName = function (id) {
    if (id === 'player') return this.resolvePlayerName();
    if (this.app.botController && this.app.botController.bots) {
        var bots = this.app.botController.bots;
        for (var i = 0; i < bots.length; i++) {
            if (bots[i].id === id) return this.getBotScoreName(bots[i].brawlerType);
        }
    }
    var isBot = id.indexOf('bot') !== -1 || id.indexOf('pve') !== -1;
    return (isBot ? 'Bot_' : 'Fighter_') + id;
};

ScoreManager.attributes.add('fontName', { type: 'string', default: "'Anton', 'Impact', sans-serif", title: '字體名稱' });
ScoreManager.attributes.add('fontWeight', { type: 'string', default: 'normal', title: '標準粗細 (normal, 900)' });

ScoreManager.attributes.add('killBannerColorPlayer', { type: 'rgba', default: [0.2, 0.9, 0.3, 1], title: '擊殺看板: 自己殺敵顏色' });
ScoreManager.attributes.add('killBannerColorEnemy', { type: 'rgba', default: [1.0, 0.3, 0.3, 1], title: '擊殺看板: 自己被殺顏色' });
ScoreManager.attributes.add('killBannerColorOther', { type: 'rgba', default: [1.0, 0.8, 0.2, 1], title: '擊殺看板: 其他人互殺顏色' });

ScoreManager.attributes.add('scoreColorBlue', { type: 'rgba', default: [0.2, 0.6, 1, 1], title: '藍隊分數顏色' });
ScoreManager.attributes.add('scoreColorRed', { type: 'rgba', default: [1, 0.2, 0.2, 1], title: '紅隊分數顏色' });

ScoreManager.prototype.initialize = function () {
    this._gameState = 'select'; 
    this._currentMode = 'FFA'; 
    this._scores = {};
    this._uiScreen = null;
    this._uiGameOverPanel = null;
    this.gameTime = 180; 
    this.app.scoreManager = this;
    this._isPortrait = window.innerWidth < window.innerHeight;

    this.playerKillStreak = 0;
    this._rogueKillCount = 0;

    this._colorTimerRed = new pc.Color(1, 0.2, 0.2);
    this._colorTimerWhite = new pc.Color(1, 1, 1);
    this._lastTimerSec = -1;

    // 🌟 寶石爭奪戰專用分數變數
    this._bountyBlueGems = 0;
    this._bountyRedGems = 0;
    this._bountyScoreFrozen = false;
    this._bountyFrozenBlue = 0;
    this._bountyFrozenRed = 0;

    if (!document.getElementById('streak-neon-style')) {
        var style = document.createElement('style');
        style.id = 'streak-neon-style';
        style.innerHTML = `
            @keyframes neonRainbow { 0% { color: #b333ff; } 25% { color: #ff3333; } 50% { color: #33ff33; } 75% { color: #3399ff; } 100% { color: #b333ff; } }
        `;
        document.head.appendChild(style);
    }

    if (!document.getElementById('live-hud-style')) {
        var hudStyle = document.createElement('style');
        hudStyle.id = 'live-hud-style';
        hudStyle.innerHTML = `
            /* ═══ 三國風 HUD 設計語言（含蓄派）═══
               底:深墨 #1a1410 / 主邊:暗金 #c9a25a / 點綴:朱紅 #a83232 / 文字:米白 #f0e6d2 */

            /* 一體化計分牌匾 */
            #live-score-bar {
                position: fixed; top: 10px; left: 50%; transform: translateX(-50%);
                z-index: 4000; pointer-events: none; user-select: none;
                font-family: 'Anton','Microsoft JhengHei',sans-serif;
                display: flex; align-items: stretch;
                background: linear-gradient(180deg, #221a12 0%, #15100b 100%);
                border: 1px solid #c9a25a;
                border-radius: 4px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(201,162,90,0.25);
                /* 斜切角令牌感 */
                clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 10px 100%, 0 50%);
                padding: 0 4px;
            }

            /* 三格通用 */
            .ls-cell {
                display: flex; align-items: center; justify-content: center;
                padding: 6px 14px; position: relative; line-height: 1;
            }
            /* 金色分隔豎線 */
            .ls-cell + .ls-cell::before {
                content: ''; position: absolute; left: 0; top: 18%; height: 64%;
                width: 1px; background: linear-gradient(180deg, transparent, #c9a25a, transparent);
            }

            /* 雙隊分數格 */
            .ls-team {
                font-size: 30px; line-height: 1; color: #f0e6d2; min-width: 30px; text-align: center;
                text-shadow: 0 1px 2px #000;
                transition: transform 0.1s ease; display: flex; align-items: center; justify-content: center; gap: 7px;
            }
            .ls-team.mine .ls-num { color: #6db8e8; }
            .ls-team.enemy .ls-num { color: #d8635f; }
            .ls-team.lead .ls-num { animation: lsLeadPulse 1.4s ease-in-out infinite; }
            .ls-team.behind { opacity: 0.55; }
            .ls-team.bump { animation: lsBump 0.35s cubic-bezier(0.175,0.885,0.32,1.5); }

            /* CSS 金色寶石（菱形，取代 emoji） */
            .ls-gem-ico {
                width: 13px; height: 13px; flex-shrink: 0;
                background: linear-gradient(135deg, #f5d27a, #b8862f);
                transform: rotate(45deg);
                box-shadow: inset 0 0 0 1px rgba(255,255,255,0.4), 0 0 4px rgba(201,162,90,0.5);
            }

            /* 計時器中格（gameModeManager 會填字進 #hud-timer-slot） */
            #hud-timer-slot {
                font-size: 26px; color: #f0e6d2; letter-spacing: 1px; min-width: 62px; text-align: center;
                text-shadow: 0 1px 2px #000; line-height: 1; display: flex; align-items: center; justify-content: center;
            }
            #hud-timer-slot.urgent { color: #e85a4a; animation: timerUrgentTxt 0.6s ease-in-out infinite; }
            @keyframes timerUrgentTxt { 0%,100% { transform: scale(1); } 50% { transform: scale(1.1); } }

            /* FFA 牌匾（時間 + 排名 + 擊殺，純文字無 emoji） */
            .ls-ffa-rank { font-size: 22px; color: #f5d27a; }
            .ls-ffa-sep { color: #c9a25a; margin: 0 8px; font-size: 16px; }
            .ls-ffa-ko { font-size: 22px; color: #f0e6d2; }
            .ls-ffa-cell.bump { animation: lsBump 0.35s cubic-bezier(0.175,0.885,0.32,1.5); }
            .ls-ffa-cell.lead-you .ls-ffa-rank { animation: lsLeadPulse 1.4s ease-in-out infinite; }

            @keyframes lsBump { 0% { transform: scale(1); } 45% { transform: scale(1.3); } 100% { transform: scale(1); } }
            @keyframes lsLeadPulse {
                0%,100% { text-shadow: 0 0 5px rgba(245,210,122,0.4); }
                50% { text-shadow: 0 0 14px rgba(245,210,122,0.95); }
            }

            /* 擊殺報告 kill feed（三國風，縮小，去Bot前綴在JS處理） */
            #kill-feed {
                position: fixed; top: 56px; right: 10px; z-index: 3900;
                display: flex; flex-direction: column; gap: 4px; align-items: flex-end;
                pointer-events: none; font-family: 'Anton','Microsoft JhengHei',sans-serif;
            }
            .kf-row {
                display: flex; align-items: center; gap: 6px;
                background: linear-gradient(180deg, #221a12 0%, #15100b 100%);
                border: 1px solid rgba(201,162,90,0.5);
                border-radius: 3px; padding: 3px 9px;
                font-size: 13px; color: #f0e6d2; white-space: nowrap;
                text-shadow: 0 1px 1px #000;
                animation: kfSlideIn 0.3s cubic-bezier(0.175,0.885,0.32,1.5);
                transition: opacity 0.4s ease, transform 0.4s ease;
            }
            .kf-row.mine-kill { border-color: #f5d27a; box-shadow: 0 0 8px rgba(245,210,122,0.35); }
            .kf-row.mine-death { border-color: #a83232; box-shadow: 0 0 8px rgba(168,50,50,0.4); }
            .kf-attacker { color: #f0e6d2; }
            .kf-arrow { color: #c9a25a; font-size: 14px; }
            .kf-victim { color: #9a8f7a; }
            .kf-row.fade { opacity: 0; transform: translateX(24px); }
            @keyframes kfSlideIn { 0% { opacity: 0; transform: translateX(34px); } 100% { opacity: 1; transform: translateX(0); } }

            @media (orientation: portrait) {
                .ls-team { font-size: 24px; }
                #hud-timer-slot { font-size: 21px; min-width: 52px; }
                .ls-cell { padding: 5px 11px; }
                .ls-ffa-rank, .ls-ffa-ko { font-size: 18px; }
                #kill-feed { top: 50px; right: 7px; }
                .kf-row { font-size: 11px; padding: 3px 7px; }
            }
        `;
        document.head.appendChild(hudStyle);
    }

    if (!document.getElementById('fk-brawl-font')) {
        var fontLink = document.createElement('link');
        fontLink.id = 'fk-brawl-font';
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Anton&display=swap';
        document.head.appendChild(fontLink);
    }

    this._dynamicFont = new pc.CanvasFont(this.app, {
        color: new pc.Color(1, 1, 1),
        fontName: this.fontName, fontWeight: this.fontWeight, fontSize: 64,
        outlineColor: new pc.Color(0, 0, 0), outlineThickness: 4 
    });
    this._knownCharsNormal = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,:;|!()?_-=⚔️👑💔💥🔥💎DMG勝利失利平局回營我軍敵軍排行榜戰報波次擊殺傷害連殺任務失敗完成稱王限時內集滿寶石守滿秒殲滅敵隊先奪勝突破關卡守住領先剩全場最佳[]# ";
    this._dynamicFont.createTextures(this._knownCharsNormal);

    this._initScreen();

    // 🌟 kill feed 改用 DOM，不再建 PlayCanvas banner pool
    this._killFeedRows = [];   // { el, life, maxLife }
    this._killFeedMax = 5;

    this.app.on('game:startMode', this._onGameStart, this);
    this.app.on('game:start', this._onGameStart, this);
    this.app.on('network:enemyMoved', this._onNetworkEnemy, this);

    this.app.on('score:kill', this._onKill, this);
    this.app.on('score:death', this._onDeath, this);
    this.app.on('score:damage', this._onDamage, this);
    this.app.on('game:killFeed', this._onKillFeed, this);

    this.app.on('network:syncTimer', function(serverTime) {
        if (Math.abs(this.gameTime - serverTime) > 1.0) this.gameTime = serverTime;
    }, this);

    this.app.on('knockout:updateScore', this._onKnockoutScoreUpdate, this);

    // 保留監聽接口，以防其他系統主動推播
    this.app.on('bounty:updateTeamGems', this._onBountyScoreUpdate, this);

    this.onResize = function() {
        var newIsPortrait = window.innerWidth < window.innerHeight;
        if (this._isPortrait !== newIsPortrait) {
            this._isPortrait = newIsPortrait;
            if (this._gameState === 'playing') this._initLiveScoreUI(); 
            else if (this._gameState === 'gameover') this.endGame(true); 
        }
    }.bind(this);
    window.addEventListener('resize', this.onResize);
    
    this.on('destroy', function() {
        window.removeEventListener('resize', this.onResize);
        if (this._dynamicFont) this._dynamicFont.destroy();
        var dom = document.getElementById('streak-dom');
        if (dom) dom.remove();
    }, this);
};

// ── MVP（STAR PLAYER）計算：全場最強，不分隊 ───────────────────────────────────
ScoreManager.prototype._computeMvp = function() {
    var best = null;
    var bestScore = -1;
    for (var id in this._scores) {
        var d = this._scores[id];
        // 綜合分：人頭為主，傷害輔助，連殺加成
        var score = (d.kills * 100) + (d.damage * 0.05) + (d.maxStreak * 30);
        if (score > bestScore) {
            bestScore = score;
            best = { id: id, data: d };
        }
    }
    return best;
};
 
// ── 注入結算 + 共用 UI theme（只注入一次） ─────────────────────────────────────
ScoreManager.prototype._ensureEndScreenStyle = function() {
    if (window.UiTheme) {
        UiTheme.inject();
        return;
    }
    if (document.getElementById('end-screen-style')) return;
    var style = document.createElement('style');
    style.id = 'end-screen-style';
    style.innerHTML = '#dom-end-screen{position:fixed;inset:0;z-index:6000;background:#000;}';
    document.head.appendChild(style);
};
 
// ── 主函式：建立並播放 3V3 DOM 結算 ───────────────────────────────────────────
ScoreManager.prototype._showDomEndScreen3v3 = function(resultText, titleColor, myStats, enemyStats, myScore, enemyScore) {
    this._ensureEndScreenStyle();
 
    // 移除舊的（避免 resize 重建殘留）
    var old = document.getElementById('dom-end-screen');
    if (old) old.remove();
 
    var root = document.createElement('div');
    root.id = 'dom-end-screen';
    root.className = 'tk-overlay';
    root.setAttribute('data-ui-interactive', '');

    // 🌟 阻斷觸控/滾輪事件冒泡，避免被遊戲全域 preventDefault 攔截（修手機無法 scroll）
    var stopProp3v3 = function(e) { e.stopPropagation(); };
    root.addEventListener('touchstart', stopProp3v3, { passive: true });
    root.addEventListener('touchmove', stopProp3v3, { passive: true });
    root.addEventListener('touchend', stopProp3v3, { passive: true });
    root.addEventListener('wheel', stopProp3v3, { passive: true });

    var tc = 'rgb(' + Math.round(titleColor.r*255) + ',' + Math.round(titleColor.g*255) + ',' + Math.round(titleColor.b*255) + ')';
    var isBounty = (this._currentMode === '3V3_BOUNTY');
    var scoreIcon = isBounty ? '💎' : '⚔️';
 
    // 階段 1：結果大字
    var title = document.createElement('div');
    title.className = 'es-title';
    title.style.color = tc;
    title.innerText = resultText;
    root.appendChild(title);
 
    // 比分小條
    var scoreLine = document.createElement('div');
    scoreLine.className = 'es-score-line';
    scoreLine.innerText = (isBounty ? '💎 ' : '⚔ ') + myScore + '   -   ' + enemyScore + (isBounty ? ' 💎' : ' ⚔');
    root.appendChild(scoreLine);
 
    // 階段 2：STAR PLAYER 卡片
    var mvp = this._computeMvp();
    var mvpCard = null;
    if (mvp) {
        mvpCard = document.createElement('div');
        mvpCard.className = 'es-mvp-card tk-panel';
        var d = mvp.data;
        mvpCard.innerHTML =
            '<div class="es-mvp-label">' + this.t('score.end.mvp') + '</div>' +
            '<div class="es-mvp-name">' + this._escapeHtml(d.name) + '</div>' +
            '<div class="es-mvp-stats">' + this._formatMvpStats(d.kills, d.maxStreak, d.damage) + '</div>';
        root.appendChild(mvpCard);
    }
 
    // 階段 3：雙隊板
    var boardWrap = document.createElement('div');
    boardWrap.className = 'es-board-wrap';
 
    var self = this;
    var mvpId = mvp ? mvp.id : null;
    var buildCol = function(title, stats, headerClass, score) {
        var col = document.createElement('div');
        col.className = 'es-team-col';
        var header = document.createElement('div');
        header.className = 'es-team-header ' + headerClass;
        header.innerText = title + '   [ ' + scoreIcon + ' ' + score + ' ]';
        col.appendChild(header);
 
        for (var i = 0; i < Math.min(stats.length, 5); i++) {
            var s = stats[i];
            var row = document.createElement('div');
            row.className = 'es-row' + (s.id === 'player' ? ' mine-row' : '');
            row._delay = i;  // 用於 stagger
            var mvpTag = (s.id === mvpId) ? '<span class="es-mvp-tag">⭐</span>' : '';
            row.innerHTML =
                '<span class="es-rname">' + self._escapeHtml(s.data.name) + mvpTag + '</span>' +
                '<span class="es-rstat">' + self._formatRowStats(s.data.kills, s.data.deaths, s.data.damage) + '</span>';
            col.appendChild(row);
        }
        return col;
    };
 
    boardWrap.appendChild(buildCol(this.t('score.end.team.ally'), myStats, 'mine', myScore));
    boardWrap.appendChild(buildCol(this.t('score.end.team.enemy'), enemyStats, 'enemy', enemyScore));
    root.appendChild(boardWrap);

    // 🌟 本場獲得獎勵
    if (this._lastRewards) {
        var rewardBar3 = document.createElement('div');
        rewardBar3.className = 'es-reward-bar';
        rewardBar3.innerHTML =
            '<span class="es-reward-coins">🪙 +' + this._lastRewards.coins + '</span>' +
            '<span class="es-reward-xp">' + this.t('score.end.xp', { n: this._lastRewards.xp }) + '</span>';
        root.appendChild(rewardBar3);
        setTimeout(function() { rewardBar3.style.opacity = '1'; }, 2000);
    }

    // 按鈕
    var btn = document.createElement('button');
    btn.className = 'es-btn tk-btn tk-btn-primary';
    btn.innerText = this.t('score.end.home');
    var goMenu = function(e) { 
        if (e) { e.preventDefault(); e.stopPropagation(); }
        window.location.reload(); 
    };
    window.UiTouch.bindTap(btn, goMenu);
    root.appendChild(btn);
 
    document.body.appendChild(root);
 
    // ── 播放節奏 ──────────────────────────────────────────────────────────────
    requestAnimationFrame(function() {
        root.classList.add('show');
        // 階段 1：標題彈出 + camera shake
        title.classList.add('pop');
        if (self.app) self.app.fire('camera:shake', self._endIsVictory ? 0.4 : 0.2);
        // 比分淡入
        scoreLine.style.opacity = '1';
 
        // 階段 2：MVP（CSS 已設 0.9s 延遲）
        if (mvpCard) mvpCard.classList.add('pop');
 
        // 階段 3：逐行滑入（從 2.5s 開始，每行錯開）
        var rows = root.querySelectorAll('.es-row');
        rows.forEach(function(r, idx) {
            setTimeout(function() { r.classList.add('slide'); }, 2500 + idx * 70);
        });
 
        // 按鈕最後出現
        setTimeout(function() { btn.classList.add('show'); }, 2500 + rows.length * 70 + 300);
    });
};
 
// ── FFA / PVE 單人結算（DOM 新風格，對齊 3v3）─────────────────────────────────
ScoreManager.prototype._showDomEndScreenSolo = function(mode, resultText, titleColor, allStats, myRank) {
    this._ensureEndScreenStyle();

    var old = document.getElementById('dom-end-screen');
    if (old) old.remove();

    var root = document.createElement('div');
    root.id = 'dom-end-screen';
    root.className = 'tk-overlay';
    root.setAttribute('data-ui-interactive', '');

    // 🌟 阻斷觸控/滾輪事件冒泡，避免被遊戲全域 preventDefault 攔截（修手機無法 scroll）
    var stopProp = function(e) { e.stopPropagation(); };
    root.addEventListener('touchstart', stopProp, { passive: true });
    root.addEventListener('touchmove', stopProp, { passive: true });
    root.addEventListener('touchend', stopProp, { passive: true });
    root.addEventListener('wheel', stopProp, { passive: true });

    var tc = 'rgb(' + Math.round(titleColor.r*255) + ',' + Math.round(titleColor.g*255) + ',' + Math.round(titleColor.b*255) + ')';
    var self = this;

    // 階段 1：結果大字
    var title = document.createElement('div');
    title.className = 'es-title';
    title.style.color = tc;
    title.innerText = resultText;
    root.appendChild(title);

    if (mode === 'PVE') {
        // ── PVE：個人戰績卡 ──
        var pd = this._scores['player'] ? this._scores['player'] : { kills:0, deaths:0, damage:0, maxStreak:0 };
        var gmm = this.app.gameModeManager;
        var curWave = (gmm && gmm.currentWave) ? gmm.currentWave : 0;
        var maxWave = (gmm && gmm.maxWaves) ? gmm.maxWaves : 3;

        var card = document.createElement('div');
        card.className = 'es-mvp-card tk-panel';
        card.innerHTML =
            '<div class="es-mvp-label">' + this.t('score.end.report') + '</div>' +
            '<div class="es-solo-stats">' +
            '<div class="es-stat-box"><div class="es-stat-num">' + curWave + '/' + maxWave + '</div><div class="es-stat-lbl">' + this.t('score.stat.wave') + '</div></div>' +
            '<div class="es-stat-box"><div class="es-stat-num">' + pd.kills + '</div><div class="es-stat-lbl">' + this.t('score.stat.kills') + '</div></div>' +
            '<div class="es-stat-box"><div class="es-stat-num">' + Math.floor(pd.damage) + '</div><div class="es-stat-lbl">' + this.t('score.stat.damage') + '</div></div>' +
            '<div class="es-stat-box"><div class="es-stat-num">' + pd.maxStreak + '</div><div class="es-stat-lbl">' + this.t('score.stat.streak') + '</div></div>' +
            '</div>';
        root.appendChild(card);
    } else {
        // ── FFA：STAR PLAYER + 單欄排行榜 ──
        var mvp = this._computeMvp();
        var mvpId = mvp ? mvp.id : null;
        if (mvp) {
            var mvpCard = document.createElement('div');
            mvpCard.className = 'es-mvp-card tk-panel';
            var md = mvp.data;
            mvpCard.innerHTML =
                '<div class="es-mvp-label">' + this.t('score.end.mvp') + '</div>' +
                '<div class="es-mvp-name">' + this._escapeHtml(md.name) + '</div>' +
                '<div class="es-mvp-stats">' + this._formatMvpStats(md.kills, md.maxStreak, md.damage) + '</div>';
            root.appendChild(mvpCard);
        }

        var board = document.createElement('div');
        board.className = 'es-board-wrap';
        var col = document.createElement('div');
        col.className = 'es-team-col es-solo-col';
        var header = document.createElement('div');
        header.className = 'es-team-header es-solo-header';
        header.innerText = this.t('score.end.ranking');
        col.appendChild(header);

        for (var i = 0; i < Math.min(allStats.length, 8); i++) {
            var s = allStats[i];
            var isMe = (s.id === 'player');
            var row = document.createElement('div');
            row.className = 'es-row' + (isMe ? ' mine-row' : '');
            var rankLabel = (i === 0) ? '👑' : '#' + (i + 1);
            var mvpTag = (s.id === mvpId) ? '<span class="es-mvp-tag">⭐</span>' : '';
            row.innerHTML =
                '<span class="es-rank-badge">' + rankLabel + '</span>' +
                '<span class="es-rname">' + this._escapeHtml(s.data.name) + mvpTag + '</span>' +
                '<span class="es-rstat">' + self._formatRowStats(s.data.kills, s.data.deaths, s.data.damage) + '</span>';
            col.appendChild(row);
        }
        board.appendChild(col);
        root.appendChild(board);
    }

    // 🌟 本場獲得獎勵
    if (this._lastRewards) {
        var rewardBar = document.createElement('div');
        rewardBar.className = 'es-reward-bar';
        rewardBar.innerHTML =
            '<span class="es-reward-coins">🪙 +' + this._lastRewards.coins + '</span>' +
            '<span class="es-reward-xp">' + this.t('score.end.xp', { n: this._lastRewards.xp }) + '</span>';
        root.appendChild(rewardBar);
        setTimeout(function() { rewardBar.style.opacity = '1'; }, 1800);
    }

    // 按鈕
    var btn = document.createElement('button');
    btn.className = 'es-btn tk-btn tk-btn-primary';
    btn.innerText = this.t('score.end.home');
    var goMenu = function(e) { if (e) { e.preventDefault(); e.stopPropagation(); } window.location.reload(); };
    window.UiTouch.bindTap(btn, goMenu);
    root.appendChild(btn);

    document.body.appendChild(root);

    // 播放節奏
    requestAnimationFrame(function() {
        root.classList.add('show');
        title.classList.add('pop');
        if (self.app) self.app.fire('camera:shake', self._endIsVictory ? 0.4 : 0.2);

        var card = root.querySelector('.es-mvp-card');
        if (card) card.classList.add('pop');

        var rows = root.querySelectorAll('.es-row');
        rows.forEach(function(r, idx) {
            setTimeout(function() { r.classList.add('slide'); }, 2200 + idx * 70);
        });

        setTimeout(function() { btn.classList.add('show'); }, 2200 + rows.length * 70 + 300);
    });
};

// HTML 轉義（防玩家名字裡的特殊字元破壞排版）
ScoreManager.prototype._escapeHtml = function(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
};

ScoreManager.prototype._isVictoryResult = function(resultText) {
    if (this._endIsVictory) return true;
    if (!resultText) return false;
    return /勝利|完成|第一名|Victory|Win|1st|First/i.test(String(resultText));
};

ScoreManager.prototype._getMissionText = function() {
    var gmm = this.app.gameModeManager;
    if (this._currentMode === '3V3_BOUNTY') {
        if (gmm && gmm.isCountdownActive) {
            var secs = Math.ceil(gmm.matchCountdown);
            var myTeam = this.app.myTeam || 'blue';
            // 領先隊：守住；落後隊：截殺奪寶
            if (gmm.countdownTeam === myTeam) {
                return this.t('hud.mission.bounty.hold', { secs: secs });
            }
            return this.t('hud.mission.bounty.steal', { secs: secs });
        }
        var need = (gmm && gmm.targetGemsToWin) ? gmm.targetGemsToWin : 15;
        var sec = (gmm && gmm.countdownSeconds) ? gmm.countdownSeconds : 15;
        return this.t('hud.mission.bounty.default', { need: need, sec: sec });
    }
    if (this._currentMode === '3V3_KNOCKOUT') {
        var wins = (gmm && gmm.targetWins) ? gmm.targetWins : 3;
        return this.t('hud.mission.knockout', { wins: wins });
    }
    if (this._currentMode === 'FFA') return this.t('hud.mission.ffa');
    if (this._currentMode === 'PVE') return this.t('hud.mission.pve');
    return '';
};

ScoreManager.prototype._updateMissionBar = function() {
    if (this._currentMode === 'ROGUE' || this._gameState !== 'playing') return;
    var text = this._getMissionText();
    if (!text) {
        if (this._missionWrap) this._missionWrap.style.display = 'none';
        return;
    }
    if (!this._missionEl) return;
    if (this._missionWrap) this._missionWrap.style.display = 'flex';
    this._missionEl.textContent = text;
};

ScoreManager.prototype._removeMissionBar = function() {
    if (this._missionWrap) {
        this._missionWrap.remove();
        this._missionWrap = null;
        this._missionEl = null;
    }
};

ScoreManager.prototype._initMissionBar = function() {
    this._removeMissionBar();
    var text = this._getMissionText();
    if (!text) return;

    var wrap = document.createElement('div');
    wrap.className = 'tk-hud-mission-wrap';
    wrap.id = 'hud-mission-wrap';

    var obj = document.createElement('div');
    obj.id = 'hud-mission-obj';
    obj.className = 'tk-mission-bar';
    obj.textContent = text;

    wrap.appendChild(obj);
    document.body.appendChild(wrap);
    this._missionWrap = wrap;
    this._missionEl = obj;
};

ScoreManager.prototype._formatDamage = function (damage) {
    return Math.floor(damage || 0).toLocaleString('en-US');
};

ScoreManager.prototype._formatMvpStats = function (kills, maxStreak, damage) {
    return this.t('score.fmt.mvp', { k: kills, s: maxStreak, d: this._formatDamage(damage) });
};

ScoreManager.prototype._formatRowStats = function (kills, deaths, damage) {
    return this.t('score.fmt.row', { k: kills, d: deaths, dmg: this._formatDamage(damage) });
};

// kill feed 短名稱：玩家取括號前暱稱
ScoreManager.prototype._kfShortName = function(name) {
    if (!name) return '';
    var s = String(name);
    var paren = s.indexOf(' (');
    if (paren > 0) s = s.substring(0, paren);
    if (s.length > 12) s = s.substring(0, 12);
    return s;
};

ScoreManager.prototype._isRogueMode = function() {
    return this._currentMode === 'ROGUE' || this.app.gameMode === 'ROGUE';
};

ScoreManager.prototype._resolveRogueUnitName = function(id) {
    if (!id) return this.t('score.name.unknown');
    var resolved = this._resolveId(id);
    if (resolved === 'player') return this.app.playerName || this.t('score.name.player');

    var bCtrl = this.app.botController;
    if (bCtrl && bCtrl.bots) {
        for (var i = 0; i < bCtrl.bots.length; i++) {
            var bot = bCtrl.bots[i];
            if (bot.id === resolved) return this.getBrawlerZhName(bot.brawlerType);
        }
    }

    if (resolved.indexOf('rogue_') === 0 || resolved.indexOf('ally_') === 0 || resolved.indexOf('pve_bot_') === 0) {
        var parts = resolved.split('_');
        if (parts.length >= 2 && window.BrawlerConfig && window.BrawlerConfig[parts[1]]) {
            return this.getBrawlerZhName(parts[1]);
        }
    }

    var rd = this.app.rogueDirector;
    if (rd && rd.squad) {
        for (var j = 0; j < rd.squad.length; j++) {
            if (rd.squad[j].botId === resolved) return rd.squad[j].name || this.getBrawlerZhName(rd.squad[j].bType);
        }
    }

    return resolved.substring(0, 8);
};

ScoreManager.prototype._resolveKillFeedName = function(id) {
    var resolved = this._resolveId(id);
    if (this._isRogueMode()) {
        return this._kfShortName(this._resolveRogueUnitName(resolved));
    }
    if (this._scores[resolved] && this._scores[resolved].name) {
        return this._kfShortName(this._scores[resolved].name);
    }
    if (resolved === 'player') return this._kfShortName(this.app.playerName || this.t('score.name.player'));
    return this._kfShortName(resolved);
};

ScoreManager.prototype._ensureFontChars = function (text, targetFont) {
    if (!text) return;
    targetFont = targetFont || this._dynamicFont;
    var missing = false;
    var chars = Array.from(text); 
    for (var i = 0; i < chars.length; i++) {
        if (this._knownCharsNormal.indexOf(chars[i]) === -1) {
            this._knownCharsNormal += chars[i];
            missing = true;
        }
    }
    if (missing && this._gameState !== 'playing') {
        targetFont.createTextures(this._knownCharsNormal);
    }
};

ScoreManager.prototype._resolveId = function(id) {
    if (!id) return 'Unknown';
    if (this.app.myId && id === this.app.myId) return 'player';
    if (this.app.clientId && id === this.app.clientId) return 'player';
    if (this.app.socketId && id === this.app.socketId) return 'player';
    return id;
};

ScoreManager.prototype.getState = function () { return this._gameState; };

ScoreManager.prototype._onGameStart = function (data) {
    this._gameState = 'playing';
    var rawMode = (data && data.mode) || this.app.gameMode || 'FFA';
    var m = String(rawMode).trim().toUpperCase().replace(/\s+/g, '_');
    if (m === '3V3BOUNTY') m = '3V3_BOUNTY';
    if (m === '3V3KNOCKOUT') m = '3V3_KNOCKOUT';
    this._currentMode = m;
    this._scores = {}; 
    this.gameTime = 180; 
    
    this._knockoutBlueWins = 0;
    this._knockoutRedWins = 0;
    this._bountyBlueGems = 0; 
    this._bountyRedGems = 0;
    this._bountyScoreFrozen = false;
    this._bountyFrozenBlue = 0;
    this._bountyFrozenRed = 0;
    
    this._isMatchEnding = false; 
    this._rewardsGranted = false;   // 🌟 重置發獎旗標
    this.playerKillStreak = 0;
    this._rogueKillCount = 0;
    this._lastTimerSec = -1; 
    
    var dom = document.getElementById('streak-dom');
    if (dom) dom.remove();
    
    var brawlerType = data.brawler || data.hero || 'guanyu';
    this._playerBrawler = brawlerType;   // 🌟 記住本場玩家角色（給養成統計）
    var playerName = this.resolvePlayerName(data);
    this.app.playerName = playerName;
    this._ensureFontChars(playerName, this._dynamicFont); 

    var brawlerName = this.getBrawlerZhName(brawlerType);
    this._ensureFontChars(brawlerName, this._dynamicFont);
    
    this._scores['player'] = {
        name: playerName + ' (' + brawlerName + ')', 
        kills: 0, deaths: 0, damage: 0, 
        currentStreak: 0, maxStreak: 0, gems: 0,
        isPlayer: true, team: this.app.myTeam || 'none' 
    };
    
    if (this._uiGameOverPanel) {
        this._uiGameOverPanel.destroy();
        this._uiGameOverPanel = null;
    }

    // 清理上一局殘留的擊殺報告 DOM
    var oldFeed = document.getElementById('kill-feed');
    if (oldFeed) oldFeed.remove();
    this._killFeedRows = [];

    // 宣傳拍攝：不建計分 HUD
    if (this.app._promoCapture) return;

    this._initLiveScoreUI();
};

ScoreManager.prototype._onKnockoutScoreUpdate = function(blueWins, redWins) {
    this._knockoutBlueWins = blueWins;
    this._knockoutRedWins = redWins;
    this._updateLiveScore(); 
};

ScoreManager.prototype._onBountyScoreUpdate = function(blueGems, redGems) {
    if (this._isMatchEnding || this._bountyScoreFrozen || this._gameState === 'gameover') return;
    this._bountyBlueGems = blueGems;
    this._bountyRedGems = redGems;
    this._updateLiveScore();
};

/** 比賽進入結算：立刻鎖分，避免慢動作／announcer 期間死亡改寫最終分數 */
ScoreManager.prototype.beginMatchEnding = function() {
    if (this._isMatchEnding) return;
    this._isMatchEnding = true;
    if (this._currentMode === '3V3_BOUNTY') {
        this._bountyScoreFrozen = true;
        this._bountyFrozenBlue = this._bountyBlueGems;
        this._bountyFrozenRed = this._bountyRedGems;
    }
};

ScoreManager.prototype._initLiveScoreUI = function() {
    // 移除舊的 PlayCanvas 容器（若還存在）與舊 DOM
    if (this._liveScoreContainer) { this._liveScoreContainer.destroy(); this._liveScoreContainer = null; }
    var oldBar = document.getElementById('live-score-bar');
    if (oldBar) oldBar.remove();
    this._removeMissionBar();

    var bar = document.createElement('div');
    bar.id = 'live-score-bar';

    // 🎲 ROGUE:不使用 PVP 計分牌,戰績由 RogueDirector 自己的 HUD 顯示
    if (this._currentMode === 'ROGUE') {
        return;
    }

    if (this._currentMode === '3V3_BOUNTY' || this._currentMode === '3V3_KNOCKOUT') {
        var isBounty = (this._currentMode === '3V3_BOUNTY');
        var gemL = isBounty ? '<span class="ls-gem-ico"></span>' : '';
        var gemR = isBounty ? '<span class="ls-gem-ico"></span>' : '';
        bar.innerHTML =
            '<div class="ls-cell"><div class="ls-team mine" id="ls-mine">' + gemL + '<span class="ls-num">0</span></div></div>' +
            '<div class="ls-cell"><div id="hud-timer-slot">--:--</div></div>' +
            '<div class="ls-cell"><div class="ls-team enemy" id="ls-enemy"><span class="ls-num">0</span>' + gemR + '</div></div>';
    } else if (this._currentMode === 'PVE') {
        // PVE/Tutorial：波數進度 | 計時器 | 擊殺（三格對稱）
        bar.innerHTML =
            '<div class="ls-cell"><div class="ls-ffa-rank" id="ls-pve-wave">' + this.t('hud.wave.n', { n: 1 }) + '</div></div>' +
            '<div class="ls-cell"><div id="hud-timer-slot">--:--</div></div>' +
            '<div class="ls-cell ls-ffa-cell" id="ls-ffa-cell"><div class="ls-ffa-ko" id="ls-ffa-ko">' + this.t('hud.kills', { n: 0 }) + '</div></div>';
    } else {
        // FFA：排名 | 計時器 | 擊殺（三格對稱，對齊 3v3 視覺）
        bar.innerHTML =
            '<div class="ls-cell"><div class="ls-ffa-rank" id="ls-ffa-rank">' + this.t('hud.rank.dash') + '</div></div>' +
            '<div class="ls-cell"><div id="hud-timer-slot">--:--</div></div>' +
            '<div class="ls-cell ls-ffa-cell" id="ls-ffa-cell"><div class="ls-ffa-ko" id="ls-ffa-ko">' + this.t('hud.kills', { n: 0 }) + '</div></div>';
    }

    document.body.appendChild(bar);
    this._initMissionBar();

    // 記住上一次數值，供彈跳偵測
    this._lastMyScore = null;
    this._lastEnemyScore = null;
    this._lastFfaText = null;

    this._updateLiveScore();
};

// 觸發數字彈跳動畫
ScoreManager.prototype._bumpEl = function(el) {
    if (!el) return;
    el.classList.remove('bump');
    void el.offsetWidth;  // 強制 reflow 讓動畫重播
    el.classList.add('bump');
};

ScoreManager.prototype._calculateTeamWinner = function() {
    if (this._currentMode === '3V3_BOUNTY') {
        if (this._bountyBlueGems > this._bountyRedGems) return 'blue';
        if (this._bountyRedGems > this._bountyBlueGems) return 'red';
        
        // 寶石平手時，改比隊伍總擊殺數
        var blueKills = 0; var redKills = 0;
        for (var id in this._scores) {
            var team = (id === 'player') ? (this.app.myTeam || 'blue') : this._scores[id].team;
            if (team === 'blue') blueKills += this._scores[id].kills;
            else if (team === 'red') redKills += this._scores[id].kills;
        }
        if (blueKills > redKills) return 'blue';
        if (redKills > blueKills) return 'red';
        return 'draw';
    }

    var blueScore = 0; var redScore = 0;
    var pTeam = this.app.myTeam || 'blue';
    for (var id in this._scores) {
        var team = (id === 'player') ? pTeam : this._scores[id].team;
        if (team === 'blue') blueScore += this._scores[id].kills;
        else if (team === 'red') redScore += this._scores[id].kills;
    }
    if (blueScore > redScore) return 'blue';
    if (redScore > blueScore) return 'red';
    return 'draw';
};

ScoreManager.prototype._updateLiveScore = function() {
    if (this._gameState !== 'playing') return;

    if (this._currentMode === '3V3_KNOCKOUT' || this._currentMode === '3V3_BOUNTY') {
        var mineEl = document.getElementById('ls-mine');
        var enemyEl = document.getElementById('ls-enemy');
        if (!mineEl || !enemyEl) return;
        var mineNum = mineEl.querySelector('.ls-num');
        var enemyNum = enemyEl.querySelector('.ls-num');
        if (!mineNum || !enemyNum) return;

        var myVal, enemyVal;
        if (this._currentMode === '3V3_KNOCKOUT') {
            myVal = (this.app.myTeam === 'red') ? this._knockoutRedWins : this._knockoutBlueWins;
            enemyVal = (this.app.myTeam === 'red') ? this._knockoutBlueWins : this._knockoutRedWins;
        } else {
            myVal = (this.app.myTeam === 'red') ? this._bountyRedGems : this._bountyBlueGems;
            enemyVal = (this.app.myTeam === 'red') ? this._bountyBlueGems : this._bountyRedGems;
        }

        mineNum.textContent = myVal;
        enemyNum.textContent = enemyVal;

        // 數字增加 → 彈跳
        if (this._lastMyScore !== null && myVal > this._lastMyScore) this._bumpEl(mineEl);
        if (this._lastEnemyScore !== null && enemyVal > this._lastEnemyScore) this._bumpEl(enemyEl);
        this._lastMyScore = myVal; this._lastEnemyScore = enemyVal;

        // 領先脈動 / 落後變暗
        mineEl.classList.remove('lead', 'behind');
        enemyEl.classList.remove('lead', 'behind');
        if (myVal > enemyVal) { mineEl.classList.add('lead'); enemyEl.classList.add('behind'); }
        else if (enemyVal > myVal) { enemyEl.classList.add('lead'); mineEl.classList.add('behind'); }

    } else if (this._currentMode === 'PVE') {
        // PVE/Tutorial：顯示波數進度 WAVE X/maxWaves
        var koEl = document.getElementById('ls-ffa-ko');
        var waveEl = document.getElementById('ls-pve-wave');
        if (!koEl) return;
        var myKills = this._scores['player'] ? this._scores['player'].kills : 0;
        var gmm = this.app.gameModeManager;
        var curWave = (gmm && gmm.currentWave) ? gmm.currentWave : 1;
        var maxWave = (gmm && gmm.maxWaves) ? gmm.maxWaves : 3;
        if (curWave < 1) curWave = 1;
        if (waveEl) waveEl.textContent = this.t('hud.wave.progress', { n: curWave, max: maxWave });
        koEl.textContent = this.t('hud.kills', { n: myKills });
        var pveCellW = document.getElementById('ls-pve-wave');
        var pveKey = curWave + ':' + myKills;
        if (this._lastFfaText !== null && pveKey !== this._lastFfaText && pveCellW) this._bumpEl(pveCellW);
        this._lastFfaText = pveKey;

    } else {
        // FFA：算我的排名 + 擊殺
        var rankEl2 = document.getElementById('ls-ffa-rank');
        var koEl2 = document.getElementById('ls-ffa-ko');
        var ffaCell = document.getElementById('ls-ffa-cell');
        if (!rankEl2 || !koEl2) return;

        var myKillsFFA = this._scores['player'] ? this._scores['player'].kills : 0;
        var myRank = 1;
        for (var idFFA in this._scores) {
            if (idFFA === 'player') continue;
            if (this._scores[idFFA].kills > myKillsFFA) myRank++;
        }

        // 🌟 算總人數（含自己），顯示 RANK X/總數
        var totalPlayers = 0;
        for (var cntId in this._scores) totalPlayers++;
        if (totalPlayers < 1) totalPlayers = 1;
        rankEl2.textContent = this.t('hud.rank', { r: myRank, total: totalPlayers });
        koEl2.textContent = this.t('hud.kills', { n: myKillsFFA });

        var ffaKey = myRank + ':' + myKillsFFA;
        if (this._lastFfaText !== null && ffaKey !== this._lastFfaText && ffaCell) this._bumpEl(ffaCell);
        this._lastFfaText = ffaKey;

        // 第一名金色脈動
        if (ffaCell) ffaCell.classList.toggle('lead-you', myRank === 1 && myKillsFFA > 0);
    }

    this._updateMissionBar();
};

ScoreManager.prototype.registerBot = function (id, bType, team) {
    if (this._currentMode === 'ROGUE') return; // 🎲 ROGUE 不計分排名
    var name = this.getBotScoreName(bType);
    this._ensureFontChars(name);
    this._scores[id] = { name: name, kills: 0, deaths: 0, damage: 0, currentStreak: 0, maxStreak: 0, gems: 0, isPlayer: false, team: team || 'none', bType: bType };
};

ScoreManager.prototype._onNetworkEnemy = function(data) {
    var id = this._resolveId(data.id);
    if (id === 'player') return; 

    if (!this._scores[id]) {
        var brawlerName = this.getBrawlerZhName(data.b);
        var eName = data.name || 'Enemy'; 
        this._ensureFontChars(eName);
        this._scores[id] = { name: eName + ' (' + brawlerName + ')', kills: 0, deaths: 0, damage: 0, currentStreak: 0, maxStreak: 0, gems: 0, isPlayer: false, team: data.team || 'none' };
    } else {
        if (data.team) this._scores[id].team = data.team;
    }
};

ScoreManager.prototype._ensureScoreRecord = function(id) {
    if (!this._scores[id]) {
        var name = this._lookupDisplayName(id);
        this._ensureFontChars(name);
        this._scores[id] = { name: name, kills: 0, deaths: 0, damage: 0, currentStreak: 0, maxStreak: 0, gems: 0, isPlayer: false, team: 'none' };
    }
};

ScoreManager.prototype._onKill = function (evt) {
    if (this._gameState === 'gameover' || this._isMatchEnding) return; 
    var attackerId = (evt && typeof evt === 'object') ? evt.attackerId : evt;
    var victimId = (evt && typeof evt === 'object') ? evt.victimId : null;
    var id = this._resolveId(attackerId);
    this._ensureScoreRecord(id); 
    
    this._scores[id].kills++;
    this._scores[id].currentStreak++;
    if (this._scores[id].currentStreak > this._scores[id].maxStreak) {
        this._scores[id].maxStreak = this._scores[id].currentStreak;
    }
    this._updateLiveScore();

    if (id === 'player') {
        if (this._isRogueMode && this._isRogueMode()) {
            this._rogueKillCount++;

            // Rogue：無雙式擊破數（避免洗版：每 10 擊提示一次）
            if (this._rogueKillCount > 0 && (this._rogueKillCount % 10 === 0)) {
                this._showStreakDOM(this.t('score.streak.rogueHits', { n: this._rogueKillCount }), 1.0, 0.9, 0.4, false, 0.75);
            }

            // Rogue：連殺只算「武將」(不含黃巾小兵)
            var victimIsGeneral = true;
            if (victimId) {
                victimIsGeneral = true;
                var vResolved = this._resolveId(victimId);
                var bCtrl = this.app.botController;
                if (bCtrl && bCtrl.bots) {
                    for (var i = 0; i < bCtrl.bots.length; i++) {
                        if (bCtrl.bots[i].id === vResolved) {
                            var vt = bCtrl.bots[i].brawlerType || '';
                            victimIsGeneral = (vt.indexOf('minion_') !== 0);
                            break;
                        }
                    }
                }
            }

            if (victimIsGeneral) {
                this.playerKillStreak++;
                this._triggerKillStreakFX(this.playerKillStreak);
            }
        } else {
            this.playerKillStreak++;
            this._triggerKillStreakFX(this.playerKillStreak);
        }
    }
};

ScoreManager.prototype._onDeath = function (victimId) {
    if (this._gameState === 'gameover' || this._isMatchEnding) return;
    var id = this._resolveId(victimId);
    this._ensureScoreRecord(id); 
    
    this._scores[id].deaths++;
    this._scores[id].currentStreak = 0;
    if (id === 'player') this.playerKillStreak = 0;
};

ScoreManager.prototype._onDamage = function (attackerId, amount) {
    if (this._gameState === 'gameover' || this._isMatchEnding) return;
    var id = this._resolveId(attackerId);
    this._ensureScoreRecord(id); 
    this._scores[id].damage += amount;
    this._updateLiveScore();
};

ScoreManager.prototype._showStreakDOM = function(text, r, g, b, isLegendary, baseScale) {
    var old = document.getElementById('streak-dom');
    if (old) old.remove();

    var el = document.createElement('div');
    el.id = 'streak-dom';
    el.innerText = text;
    
    var baseCss = `
        position: fixed; top: 30%; left: 50%;
        transform: translate(-50%, -50%) scale(${baseScale * 0.3});
        font-family: 'Anton', 'Impact', sans-serif; font-size: clamp(48px, 8vw, 84px);
        font-weight: bold; font-style: italic; color: rgb(${Math.round(r*255)}, ${Math.round(g*255)}, ${Math.round(b*255)});
        text-shadow: 6px 6px 0 #000, -3px -3px 0 #000, 3px -3px 0 #000, -3px  3px 0 #000, 0px 10px 20px rgba(0,0,0,0.8);
        letter-spacing: 4px; white-space: nowrap; pointer-events: none; z-index: 5000; opacity: 0; text-align: center;
    `;
    if (isLegendary) baseCss += `animation: neonRainbow 1.5s infinite;`;
    
    el.style.cssText = baseCss;
    document.body.appendChild(el);

    requestAnimationFrame(function() {
        el.style.transition = 'transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.5), opacity 0.1s ease';
        el.style.transform = `translate(-50%, -50%) scale(${baseScale * 1.2})`;
        el.style.opacity = '1';

        setTimeout(function() {
            el.style.transition = 'transform 0.1s ease-out';
            el.style.transform = `translate(-50%, -50%) scale(${baseScale})`;
        }, 150);

        setTimeout(function() {
            el.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            el.style.opacity = '0';
            el.style.transform = `translate(-50%, -80%) scale(${baseScale * 0.9})`;
            setTimeout(function() { if (el.parentNode) el.remove(); }, 400);
        }, 1800);
    });
};

ScoreManager.prototype._triggerKillStreakFX = function(streakCount) {
    var rd = this.app.rogueDirector;
    if (rd && rd.active && typeof rd._noteKillPop === 'function') {
        rd._noteKillPop();
    }
    // Rogue & PvP share bilingual streak keys (PvP previously hard-coded English only)
    var levels = [
        { count: 1, key: 'score.streak.1', r: 0.9, g: 0.9, b: 0.9, scale: 1.0 },
        { count: 2, key: 'score.streak.2', r: 1.0, g: 0.84, b: 0.0, scale: 1.1 },
        { count: 3, key: 'score.streak.3', r: 1.0, g: 0.55, b: 0.0, scale: 1.2 },
        { count: 4, key: 'score.streak.4', r: 1.0, g: 0.1, b: 0.1, scale: 1.3 },
        { count: 5, key: 'score.streak.5', r: 0.7, g: 0.2, b: 0.9, scale: 1.5 }
    ];

    var level = levels[Math.min(streakCount, levels.length) - 1];
    if (!level) return;

    var shake = Math.min(streakCount * 0.1, 0.5);
    this.app.fire('camera:shake', shake);

    var isLegendary = (streakCount >= 5);
    this._showStreakDOM(this.t(level.key), level.r, level.g, level.b, isLegendary, level.scale);
};

ScoreManager.prototype._onKillFeed = function (attackerId, victimId) {
    if (this._gameState === 'gameover' || this._isMatchEnding) return;

    var aId = this._resolveId(attackerId);
    var vId = this._resolveId(victimId);

    var attackerName = this._resolveKillFeedName(attackerId);
    var victimName = this._resolveKillFeedName(victimId);
    var isPlayerAttacker = (aId === 'player'); 
    var isPlayerVictim = (vId === 'player');

    // 容器
    var feed = document.getElementById('kill-feed');
    if (!feed) {
        feed = document.createElement('div');
        feed.id = 'kill-feed';
        document.body.appendChild(feed);
    }

    var row = document.createElement('div');
    row.className = 'kf-row';
    if (isPlayerAttacker) row.classList.add('mine-kill');
    else if (isPlayerVictim) row.classList.add('mine-death');

    row.innerHTML =
        '<span class="kf-attacker">' + this._escapeHtml(attackerName) + '</span>' +
        '<span class="kf-icon" aria-hidden="true">⚔</span>' +
        '<span class="kf-victim">' + this._escapeHtml(victimName) + '</span>';

    feed.appendChild(row);   // 新的在下方（最新）
    this._killFeedRows.push({ el: row, life: 0, maxLife: 4.0 });

    // 超過上限移除最舊
    while (this._killFeedRows.length > this._killFeedMax) {
        var old = this._killFeedRows.shift();
        if (old.el && old.el.parentNode) old.el.parentNode.removeChild(old.el);
    }
};

// 🌟 結算發放養成獎勵（軍餉/經驗）。won = 是否勝利。用旗標防重複發。
ScoreManager.prototype._grantProgressionRewards = function(won) {
    if (this._rewardsGranted) return;   // 一場只發一次
    this._rewardsGranted = true;

    var pm = this.app.progressionManager;
    if (!pm) return;

    var pd = this._scores['player'] ? this._scores['player'] : { kills: 0, damage: 0 };
    var kills = pd.kills || 0;
    var damage = pd.damage || 0;

    // ── 正式發放（Phase 0：約為舊測試寬鬆值的 45%）──
    // 軍餉：完成 23 + 勝利 +27 + 每擊殺 +4
    var coins = 23 + (won ? 27 : 0) + kills * 4;
    // 經驗：完成 14 + 勝利 +14 + 每擊殺 +2
    var xp = 14 + (won ? 14 : 0) + kills * 2;

    pm.grantMatchRewards({ coins: coins, xp: xp, won: won, kills: kills, damage: damage, brawler: this._playerBrawler });

    // 記住這場獎勵，給結算畫面顯示
    this._lastRewards = { coins: coins, xp: xp };
};

ScoreManager.prototype.endGame = function (forceOrWinner) {
    if (this._gameState === 'gameover' && forceOrWinner !== true && typeof forceOrWinner !== 'string') return;
    this._gameState = 'gameover';
    
    this._forcedWinner = (typeof forceOrWinner === 'string') ? forceOrWinner : null;

    var announcer = document.getElementById('knockout-announcer');
    if (announcer) announcer.style.display = 'none';
    
    var dom = document.getElementById('streak-dom');
    if (dom) dom.remove();

    // 移除 DOM 計分條與擊殺報告
    var scoreBar = document.getElementById('live-score-bar');
    if (scoreBar) scoreBar.remove();
    this._removeMissionBar();
    var killFeed = document.getElementById('kill-feed');
    if (killFeed) killFeed.remove();
    this._killFeedRows = [];
    if (this._liveScoreContainer) { this._liveScoreContainer.destroy(); this._liveScoreContainer = null; }

    if (this._uiGameOverPanel) {
        this._uiGameOverPanel.destroy(); this._uiGameOverPanel = null;
    }

    var sortFn = function(a, b) {
        if (b.data.kills !== a.data.kills) return b.data.kills - a.data.kills;
        if (b.data.damage !== a.data.damage) return b.data.damage - a.data.damage;
        return a.data.deaths - b.data.deaths;
    };

    var is3v3 = (this._currentMode === '3V3_BOUNTY' || this._currentMode === '3V3_KNOCKOUT');

    this._uiGameOverPanel = new pc.Entity('GameOverPanel');
    this._uiGameOverPanel.addComponent('element', {
        type: pc.ELEMENTTYPE_IMAGE, anchor: [0.5, 0.5, 0.5, 0.5], pivot: [0.5, 0.5], width: 1040, height: 750, color: new pc.Color(0.05, 0.05, 0.08), opacity: 0.95, useInput: true
    });
    this._uiScreen.addChild(this._uiGameOverPanel);

    var resultText = this.t('score.result.matchOver');
    var titleColor = new pc.Color(1, 0.84, 0);
    var self = this;
    var playerWon = false;
    this._endIsVictory = false;

    if (is3v3) {
        var myTeamStats = []; var enemyTeamStats = []; 
        var pTeam = this.app.myTeam || 'blue';
        
        var myTeamScore = 0; 
        var enemyTeamScore = 0;
        
        if (this._currentMode === '3V3_KNOCKOUT') {
            myTeamScore = (pTeam === 'red') ? this._knockoutRedWins : this._knockoutBlueWins;
            enemyTeamScore = (pTeam === 'red') ? this._knockoutBlueWins : this._knockoutRedWins;
        } else if (this._currentMode === '3V3_BOUNTY') {
            var blueGems = this._bountyScoreFrozen ? this._bountyFrozenBlue : this._bountyBlueGems;
            var redGems = this._bountyScoreFrozen ? this._bountyFrozenRed : this._bountyRedGems;
            myTeamScore = (pTeam === 'red') ? redGems : blueGems;
            enemyTeamScore = (pTeam === 'red') ? blueGems : redGems;
        }

        for (var id in this._scores) {
            var data = this._scores[id];
            var t = data.team;
            if (id === 'player') t = pTeam;

            if (t === pTeam) myTeamStats.push({ id: id, data: data }); 
            else if (t !== 'none') enemyTeamStats.push({ id: id, data: data }); 
        }
        myTeamStats.sort(sortFn); enemyTeamStats.sort(sortFn);

        // 🌟 決定勝負文字（移到結算畫面呼叫之前，否則永遠顯示 MATCH FINISHED）
        if (this._forcedWinner) {
            if (this._forcedWinner === pTeam) { resultText = this.t('score.result.win'); titleColor = new pc.Color(0.2, 0.9, 0.3); playerWon = true; }
            else if (this._forcedWinner === 'draw') { resultText = this.t('score.result.draw'); titleColor = new pc.Color(0.8, 0.8, 0.8); }
            else { resultText = this.t('score.result.lose'); titleColor = new pc.Color(1, 0.2, 0.2); }
        }
        else if (myTeamScore > enemyTeamScore) { resultText = this.t('score.result.win'); titleColor = new pc.Color(0.2, 0.9, 0.3); playerWon = true; }
        else if (myTeamScore < enemyTeamScore) { resultText = this.t('score.result.lose'); titleColor = new pc.Color(1, 0.2, 0.2); }
        else if (myTeamScore === enemyTeamScore && myTeamScore > 0) { resultText = this.t('score.result.draw'); titleColor = new pc.Color(0.8, 0.8, 0.8); }

        this._endIsVictory = playerWon;
        this._grantProgressionRewards(playerWon);
        this._fireEndSfx(playerWon, this._forcedWinner === 'draw' || (myTeamScore === enemyTeamScore && myTeamScore > 0 && !this._forcedWinner));

        this._showDomEndScreen3v3(resultText, titleColor, myTeamStats, enemyTeamStats, myTeamScore, enemyTeamScore);
        return;
    } 
    else {
        // 🌟 FFA / PVE：改用 DOM 新風格結算（對齊 3v3 視覺）
        var allStats = [];
        for (var id in this._scores) allStats.push({ id: id, data: this._scores[id] });
        allStats.sort(sortFn);

        var myRank = -1;
        for (var i = 0; i < allStats.length; i++) {
            if (allStats[i].id === 'player') { myRank = i + 1; break; }
        }

        if (this._currentMode === 'PVE') {
            var pCtrl = this.app.playerController;
            var pveWon = !(pCtrl && pCtrl.isDead);
            if (pCtrl && pCtrl.isDead) { resultText = this.t('score.result.fail'); titleColor = new pc.Color(1, 0.2, 0.2); }
            else { resultText = this.t('score.result.win'); titleColor = new pc.Color(0.2, 0.9, 0.3); }
            this._endIsVictory = pveWon;
            this._grantProgressionRewards(pveWon);
            this._fireEndSfx(pveWon, false);
            this._showDomEndScreenSolo('PVE', resultText, titleColor, allStats, myRank);
        } else {
            if (myRank === 1) { resultText = this.t('score.result.ffa.first'); titleColor = new pc.Color(0.2, 0.9, 0.3); playerWon = true; }
            else if (myRank <= 3) { resultText = this.t('score.result.ffa.top3'); titleColor = new pc.Color(0.2, 0.6, 1.0); }
            else { resultText = this.t('score.result.ffa.place', { n: myRank }); titleColor = new pc.Color(1, 0.4, 0.4); }
            this._endIsVictory = playerWon;
            this._grantProgressionRewards(playerWon);
            this._fireEndSfx(playerWon, false);
            this._showDomEndScreenSolo('FFA', resultText, titleColor, allStats, myRank);
        }

        // DOM 結算自帶面板，移除剛建立的空 PlayCanvas panel
        if (this._uiGameOverPanel) { this._uiGameOverPanel.destroy(); this._uiGameOverPanel = null; }
        return;
    }
};

ScoreManager.prototype._fireEndSfx = function(won, isDraw) {
    if (isDraw) return;
    try {
        this.app.fire(won ? 'sfx:victory' : 'sfx:defeat');
    } catch (eSfx) { /* ignore */ }
};

ScoreManager.prototype.update = function (dt) {
    if (this.app._promoCapture || this.app.gameState === 'promo') return;
    if (this._gameState === 'playing' && this.app.gameState !== 'intro') {

        // 🌟 核心修正：實時輪詢場上所有人的寶石總數！
        if (this._currentMode === '3V3_BOUNTY' && !this._isMatchEnding && !this._bountyScoreFrozen) {
            var currentBlueGems = 0;
            var currentRedGems = 0;

            // 1. 抓取玩家的寶石
            var pCtrl = this.app.playerController;
            if (pCtrl && !pCtrl.isDead) {
                var pGems = pCtrl.gemCount || 0;
                if (this.app.myTeam === 'blue') currentBlueGems += pGems;
                else if (this.app.myTeam === 'red') currentRedGems += pGems;
            }

            // 2. 抓取本機 AI 的寶石
            var botCtrl = this.app.botController;
            if (botCtrl && botCtrl.bots) {
                var bots = botCtrl.bots;
                for (var i = 0; i < bots.length; i++) {
                    if (bots[i].state === 'alive') {
                        var bGems = bots[i].gemCount || 0;
                        if (bots[i].team === 'blue') currentBlueGems += bGems;
                        else if (bots[i].team === 'red') currentRedGems += bGems;
                    }
                }
            }

            // 3. 抓取遠端玩家的寶石 (如果有連線的話)
            var enemyMgr = this.app.enemyManager;
            if (enemyMgr) {
                for (var eid in enemyMgr.enemies) {
                    var enemy = enemyMgr.enemies[eid];
                    if (enemy.hp > 0 && enemy.s !== 3) {
                        var eGems = enemy.gemCount || 0;
                        if (enemy.team === 'blue') currentBlueGems += eGems;
                        else if (enemy.team === 'red') currentRedGems += eGems;
                    }
                }
            }

            // 如果計算出來的數字跟目前記的不一樣，立刻更新 UI！
            if (this._bountyBlueGems !== currentBlueGems || this._bountyRedGems !== currentRedGems) {
                this._bountyBlueGems = currentBlueGems;
                this._bountyRedGems = currentRedGems;
                this._updateLiveScore(); // 呼叫更新文字
                
                // 同步告訴 GameModeManager 檢查是否要觸發 15 秒倒數
                if (this.app.gameModeManager) {
                    this.app.gameModeManager._onUpdateTeamGems(currentBlueGems, currentRedGems);
                }
            }
            this._updateMissionBar();
        }

        if (this.app.gameModeManager && this.app.gameModeManager.isMatchOver && !this._isMatchEnding) {
            this.beginMatchEnding();
            // 🌟 凍結即時計分，避免結算前數字還在跳被翻盤
            // PVP 模式由 gameModeManager 用正確勝者呼叫 endGame，這裡不重複呼叫
            // 只有 PVE（gameModeManager 不呼叫 endGame）才由這裡兜底
            if (this._currentMode === 'PVE') {
                var self = this;
                setTimeout(function() {
                    if (self.app.gameModeManager) self.app.gameModeManager._hideAnnouncer();
                    self.endGame(true);
                }, 3500);
            }
            return;
        }
    }

    if (this._killFeedRows && this._killFeedRows.length) {
        for (var i = this._killFeedRows.length - 1; i >= 0; i--) {
            var kf = this._killFeedRows[i];
            kf.life += dt;
            if (kf.life >= kf.maxLife) {
                if (kf.el) kf.el.classList.add('fade');   // 觸發淡出
                if (kf.life >= kf.maxLife + 0.45) {        // 淡出完成後移除
                    if (kf.el && kf.el.parentNode) kf.el.parentNode.removeChild(kf.el);
                    this._killFeedRows.splice(i, 1);
                }
            }
        }
    }
};

ScoreManager.prototype._initScreen = function () {
    var screens = this.app.root.findComponents('screen');
    if (screens.length > 0) this._uiScreen = screens[0].entity;
    else {
        this._uiScreen = new pc.Entity('ScoreScreen');
        this._uiScreen.addComponent('screen', { referenceResolution: new pc.Vec2(1280, 720), scaleBlend: 0.5, scaleMode: pc.SCALEMODE_BLEND, screenSpace: true });
        this.app.root.addChild(this._uiScreen);
    }
};

ScoreManager.prototype._createTextUI = function (name, opts, parent) {
    var targetFont = opts.font || this._dynamicFont; 
    if (opts.text) this._ensureFontChars(opts.text, targetFont); 
    
    var entity = new pc.Entity(name);
    var anchor = opts.anchor ? new pc.Vec4(opts.anchor[0], opts.anchor[1], opts.anchor[2], opts.anchor[3]) : new pc.Vec4(0.5, 0.5, 0.5, 0.5);
    var pivot = opts.pivot ? new pc.Vec2(opts.pivot[0], opts.pivot[1]) : new pc.Vec2(0.5, 0.5);

    entity.addComponent('element', {
        type: pc.ELEMENTTYPE_TEXT, anchor: anchor, pivot: pivot, 
        width: opts.width || 600, height: opts.height || 80, 
        fontSize: opts.fontSize || 20, color: opts.color || new pc.Color(1, 1, 1),
        text: opts.text || '', alignment: opts.alignment || new pc.Vec2(0.5, 0.5), font: targetFont
    });
    
    (parent || this._uiScreen).addChild(entity); return entity;
};