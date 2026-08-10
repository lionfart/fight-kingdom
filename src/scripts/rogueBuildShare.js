// =============================================================================
// RogueBuildShare — Rogue 構築分享（文字 / 圖片）
// =============================================================================
var RogueBuildShare = pc.createScript('rogueBuildShare');

RogueBuildShare.HTML2CANVAS_URL = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';

RogueBuildShare.prototype.initialize = function() {
    this.app.rogueBuildShare = this;
    this._html2canvasPromise = null;
};

RogueBuildShare.prototype.collectSnapshot = function(rd, meta) {
    meta = meta || {};
    if (rd) {
        if (meta.waves === undefined && typeof rd._getCompletedWaves === 'function') {
            meta.waves = rd._getCompletedWaves();
        }
        if (meta.endless === undefined) meta.endless = !!rd.isEndless;
        if (meta.coins === undefined) meta.coins = rd._earnedCoins || 0;
        if (meta.xp === undefined) meta.xp = rd._earnedXp || 0;
        if (meta.kills === undefined) meta.kills = rd._rogueKills || 0;
    }
    var ws = this.app.wordSystem;
    if (ws && ws.exportBuildSnapshot) {
        return ws.exportBuildSnapshot(rd, meta);
    }
    return {
        v: 1,
        hero: (rd && rd.app && rd.app.playerController && rd.app.playerController.brawlerType) || '',
        squad: [],
        waves: meta.waves || 0,
        endless: !!meta.endless,
        coins: meta.coins || 0,
        xp: meta.xp || 0,
        kills: meta.kills || 0,
        cards: [],
        buildParts: [],
        at: Date.now()
    };
};

RogueBuildShare.prototype._heroLabel = function(bType) {
    if (window.BrawlerConfig && window.BrawlerConfig.getDisplayZh) {
        return window.BrawlerConfig.getDisplayZh(bType) || bType;
    }
    return bType || '—';
};

RogueBuildShare.prototype._escapeHtml = function(s) {
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
};

RogueBuildShare.prototype.renderSlotsHtmlFromSnapshot = function(snap) {
    var slots = (window.WordSystem && WordSystem.buildDisplaySlotsFromSnapshot)
        ? WordSystem.buildDisplaySlotsFromSnapshot(snap) : [];
    var html = '';
    for (var i = 0; i < slots.length; i++) {
        var s = slots[i];
        if (s.empty) {
            html += '<div class="rg-slot rg-slot-empty" title="空構築槽"></div>';
        } else {
            var cls = 'rg-slot rg-slot-filled' + (s.isSignature ? ' rg-slot-sig' : '');
            var lv = (s.level > 0) ? ('+' + s.level) : '';
            html += '<div class="' + cls + '" style="--rg-slot-edge:' + (s.edge || '#c9a25a') +
                ';border-color:' + (s.edge || '#c9a25a') + ';" title="' + this._escapeHtml(s.name) + '">' +
                '<span class="rg-slot-name">' + this._escapeHtml(s.shortName) + '</span>' +
                (lv ? ('<span class="rg-slot-lv">' + lv + '</span>') : '') +
                '</div>';
        }
    }
    return html;
};

RogueBuildShare.prototype.renderPreviewHtml = function(snap) {
    if (!snap) return '';
    var self = this;
    var hero = this._escapeHtml(this._heroLabel(snap.hero));
    var waveLine = '第 ' + (snap.waves || 0) + ' 波' + (snap.endless ? '（無盡）' : '');
    var squadLine = '';
    if (snap.squad && snap.squad.length) {
        squadLine = '<div class="rbs-row">軍團：' + snap.squad.map(function(m) {
            return self._escapeHtml(m.name || m.bType || '?');
        }).join('、') + '</div>';
    }
    var slotsHtml = '<div class="rbs-slots">' + this.renderSlotsHtmlFromSnapshot(snap) + '</div>';
    var parts = snap.buildParts || [];
    var detailHtml = '';
    if (parts.length) {
        detailHtml = '<div class="rbs-detail">' + parts.map(function(p) {
            return '<div class="rbs-detail-line">' + self._escapeHtml(p) + '</div>';
        }).join('') + '</div>';
    }
    var staleNote = snap._staleCards ? '<div class="rbs-warn">部分卡牌版本較舊，僅供參考</div>' : '';
    return '<div class="rbs-preview">' +
        '<div class="rbs-row rbs-hero">主將：' + hero + ' · ' + waveLine + '</div>' +
        squadLine +
        slotsHtml +
        detailHtml +
        staleNote +
        ((snap.coins || snap.xp) ? ('<div class="rbs-row rbs-stats">🪙 ' + (snap.coins || 0) + ' · 經驗 +' + (snap.xp || 0) + '</div>') : '') +
        '</div>';
};

RogueBuildShare.prototype.showPreviewModal = function(snap, opts) {
    opts = opts || {};
    if (!snap || typeof document === 'undefined') return;
    var self = this;
    var old = document.getElementById('rbs-preview-overlay');
    if (old) old.remove();

    var body = this.renderPreviewHtml(snap);

    var ov = document.createElement('div');
    ov.id = 'rbs-preview-overlay';
    ov.className = 'tk-overlay';
    ov.setAttribute('data-ui-interactive', '');
    ov.innerHTML =
        '<div class="rg-panel tk-panel rbs-panel">' +
        '<div class="rg-panel-title tk-panel-title">' + (opts.title || '構築預覽') + '</div>' +
        '<div class="rbs-preview-wrap">' + body + '</div>' +
        '<div class="rg-panel-btns tk-panel-btns">' +
        '<button type="button" class="tk-btn tk-btn-gold" id="rbs-btn-share">分享構築</button>' +
        '<button type="button" class="tk-btn tk-btn-ghost" id="rbs-btn-close">關閉</button>' +
        '</div></div>';
    document.body.appendChild(ov);
    this._injectStyles();

    var close = function() { ov.remove(); };
    ov.querySelector('#rbs-btn-close').addEventListener('click', close);
    ov.querySelector('#rbs-btn-share').addEventListener('click', function() {
        self.shareSnapshot(snap, { uploadCloud: false }).then(function(res) {
            self._toast(res && res.ok ? '已分享／已複製' : '分享失敗');
        });
    });
    ov.addEventListener('click', function(e) {
        if (e.target === ov) close();
    });
};

RogueBuildShare.prototype._loadHtml2Canvas = function() {
    if (typeof html2canvas === 'function') return Promise.resolve(html2canvas);
    if (this._html2canvasPromise) return this._html2canvasPromise;
    var self = this;
    this._html2canvasPromise = new Promise(function(resolve, reject) {
        if (typeof document === 'undefined') { reject(new Error('no document')); return; }
        var s = document.createElement('script');
        s.src = RogueBuildShare.HTML2CANVAS_URL;
        s.onload = function() {
            if (typeof html2canvas === 'function') resolve(html2canvas);
            else reject(new Error('html2canvas load failed'));
        };
        s.onerror = function() { reject(new Error('html2canvas script error')); };
        document.head.appendChild(s);
    });
    return this._html2canvasPromise;
};

RogueBuildShare.prototype._buildShareCardDom = function(snap) {
    var self = this;
    var hero = this._heroLabel(snap.hero);
    var waveLine = '第 ' + (snap.waves || 0) + ' 波' + (snap.endless ? ' · 無盡' : '');
    var parts = snap.buildParts || [];
    var slotsHtml = this.renderSlotsHtmlFromSnapshot(snap);
    var card = document.createElement('div');
    card.id = 'rogue-share-card';
    card.innerHTML =
        '<div class="rbs-card-inner">' +
        '<div class="rbs-card-brand">FIGHT KINGDOM · 群雄集結</div>' +
        '<div class="rbs-card-hero">' + this._escapeHtml(hero) + '</div>' +
        '<div class="rbs-card-wave">' + this._escapeHtml(waveLine) + '</div>' +
        '<div class="rbs-card-slots">' + slotsHtml + '</div>' +
        '<div class="rbs-card-build">' + parts.map(function(p) {
            return '<div>' + self._escapeHtml(p) + '</div>';
        }).join('') + '</div>' +
        '</div>';
    card.style.cssText = 'position:fixed;left:-9999px;top:0;width:360px;padding:16px;' +
        'background:linear-gradient(180deg,#221a12,#0f0c08);border:2px solid #c9a25a;border-radius:12px;' +
        'color:#f5d27a;font-family:Microsoft JhengHei,sans-serif;box-sizing:border-box;';
    document.body.appendChild(card);
    return card;
};

RogueBuildShare.prototype._captureShareImage = function(snap) {
    var self = this;
    var card = this._buildShareCardDom(snap);
    return this._loadHtml2Canvas().then(function(h2c) {
        return h2c(card, { backgroundColor: '#0f0c08', scale: 2, logging: false });
    }).then(function(canvas) {
        return new Promise(function(resolve) {
            canvas.toBlob(function(blob) {
                if (card.parentNode) card.parentNode.removeChild(card);
                resolve(blob);
            }, 'image/png');
        });
    }).catch(function(err) {
        if (card.parentNode) card.parentNode.removeChild(card);
        console.warn('[RogueBuildShare] 圖片產生失敗', err);
        return null;
    });
};

RogueBuildShare.prototype._copyText = function(text) {
    if (!text) return Promise.resolve(false);
    if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).then(function() { return true; }).catch(function() { return false; });
    }
    try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return Promise.resolve(!!ok);
    } catch (e) {
        return Promise.resolve(false);
    }
};

RogueBuildShare.prototype._toast = function(msg) {
    var rd = this.app.rogueDirector;
    if (rd && typeof rd._showRogueBanner === 'function') {
        rd._showRogueBanner('構築', msg, 'info', 2200);
        return;
    }
    if (typeof console !== 'undefined') console.log('[RogueBuildShare]', msg);
};

RogueBuildShare.prototype.shareSnapshot = function(snap, opts) {
    opts = opts || {};
    if (!snap) return Promise.resolve({ ok: false });
    var self = this;

    var uploadPromise = Promise.resolve(null);
    if (opts.uploadCloud === true && this.app.cloudSaveManager && this.app.cloudSaveManager.uploadRogueBuild) {
        uploadPromise = this.app.cloudSaveManager.uploadRogueBuild(snap);
    }

    return uploadPromise.then(function(cloud) {
        var ws = self.app.wordSystem;
        var text = (ws && ws.formatBuildShareText)
            ? ws.formatBuildShareText(snap, {})
            : JSON.stringify(snap);

        return self._captureShareImage(snap).then(function(blob) {
            if (navigator.share) {
                var shareData = { title: 'Fight Kingdom Build', text: text };
                if (blob && navigator.canShare) {
                    try {
                        var file = new File([blob], 'rogue-build.png', { type: 'image/png' });
                        if (navigator.canShare({ files: [file] })) {
                            shareData.files = [file];
                        }
                    } catch (e) { /* ignore */ }
                }
                return navigator.share(shareData).then(function() {
                    return { ok: true, cloud: cloud };
                }).catch(function() {
                    return self._copyText(text).then(function(copied) {
                        return { ok: copied, cloud: cloud, fallback: 'clipboard' };
                    });
                });
            }
            return self._copyText(text).then(function(copied) {
                return { ok: copied, cloud: cloud, fallback: 'clipboard' };
            });
        });
    });
};

RogueBuildShare.prototype.shareFromDirector = function(rd, opts) {
    var snap = this.collectSnapshot(rd, opts && opts.meta);
    return this.shareSnapshot(snap, opts);
};

RogueBuildShare.prototype._injectStyles = function() {
    if (document.getElementById('rbs-share-style')) return;
    var st = document.createElement('style');
    st.id = 'rbs-share-style';
    st.textContent =
        '.rbs-panel{max-width:min(96vw,420px);}' +
        '.rbs-preview-wrap{text-align:left;margin:8px 0;}' +
        '.rbs-row{color:#e8dcc8;font-size:14px;margin:4px 0;font-family:Microsoft JhengHei,sans-serif;}' +
        '.rbs-hero{color:#f5d27a;font-size:15px;}' +
        '.rbs-slots{display:flex;gap:5px;justify-content:center;flex-wrap:wrap;margin:8px 0;}' +
        '.rbs-slots .rg-slot{width:40px;height:32px;border-radius:6px;box-sizing:border-box;' +
        'display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:9px;color:#f0e6d2;}' +
        '.rbs-slots .rg-slot-empty{border:1.5px dashed rgba(154,143,122,0.55);background:rgba(0,0,0,0.35);}' +
        '.rbs-slots .rg-slot-filled{border:1.5px solid var(--rg-slot-edge,#c9a25a);background:rgba(0,0,0,0.55);}' +
        '.rbs-slots .rg-slot-sig{box-shadow:0 0 6px rgba(245,210,122,0.45);}' +
        '.rbs-slots .rg-slot-name{max-width:36px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
        '.rbs-slots .rg-slot-lv{font-size:8px;color:#f5d27a;opacity:0.9;}' +
        '.rbs-detail{color:#c9a25a;font-size:12.5px;line-height:1.55;margin-top:6px;}' +
        '.rbs-detail-line{padding:2px 0;border-bottom:1px solid rgba(201,162,90,0.12);}' +
        '.rbs-warn{color:#e85a4a;font-size:12px;margin-top:6px;}' +
        '.rbs-card-brand{font-size:12px;opacity:0.85;margin-bottom:6px;}' +
        '.rbs-card-hero{font-size:22px;font-weight:bold;margin-bottom:4px;}' +
        '.rbs-card-wave{font-size:14px;margin-bottom:10px;}' +
        '.rbs-card-slots{display:flex;gap:4px;justify-content:center;margin-bottom:8px;}' +
        '.rbs-card-slots .rg-slot{width:38px;height:30px;border-radius:5px;box-sizing:border-box;' +
        'display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:8px;color:#f0e6d2;}' +
        '.rbs-card-slots .rg-slot-empty{border:1.5px dashed rgba(154,143,122,0.55);background:rgba(0,0,0,0.35);}' +
        '.rbs-card-slots .rg-slot-filled{border:1.5px solid var(--rg-slot-edge,#c9a25a);background:rgba(0,0,0,0.55);}' +
        '.rbs-card-slots .rg-slot-sig{box-shadow:0 0 5px rgba(245,210,122,0.4);}' +
        '.rbs-card-build{font-size:12px;line-height:1.5;color:#e8dcc8;}';
    document.head.appendChild(st);
};
