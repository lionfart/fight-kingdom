var FloatingUIManager = pc.createScript('floatingUIManager');

FloatingUIManager.prototype.initialize = function() {
    this.app.floatingUIManager = this;
    this.cameraEntity = this.app.root.findByName('Camera');
    this.bars = {}; 

    this.container = document.createElement('div');
    this.container.id = 'floating-ui-container';
    this.container.style.position = 'absolute';
    this.container.style.top = '0';
    this.container.style.left = '0';
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    this.container.style.pointerEvents = 'none'; 
    this.container.style.overflow = 'visible';
    this.container.style.zIndex = '500';
    this.container.style.webkitUserSelect = 'none';
    this.container.style.userSelect = 'none';
    this.container.style.webkitTouchCallout = 'none';
    document.body.appendChild(this.container);

    if (!document.getElementById('fk-brawl-font')) {
        var fontLink = document.createElement('link');
        fontLink.id = 'fk-brawl-font';
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Anton&display=swap';
        document.head.appendChild(fontLink);
    }

    var style = document.getElementById('floating-ui-styles');
    if (!style) {
        style = document.createElement('style');
        style.id = 'floating-ui-styles';
        document.head.appendChild(style);
    }
    style.innerHTML = `
            /* 血條容器 — 維持簡單，靠配色統一；禁選字避免 Android 選到搜尋 */
    .hp-wrap { position: absolute; overflow: visible; transform: translate(-50%, -100%); will-change: transform; transition: opacity 0.1s ease-out;
        -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
    #floating-ui-container, #floating-ui-container * {
        -webkit-user-select: none !important; user-select: none !important; -webkit-touch-callout: none !important;
    }
    .hp-bar-stack { position: relative; display: flex; flex-direction: column; align-items: center; }

    .hp-shield-box { display: none !important; }

    .hp-fill.hp-fill-shield { background: linear-gradient(to bottom, #cfd8dc, #B0BEC5); }

    .hp-hp-sliver {
        position: relative; width: 65px; height: 3px; margin-top: 2px;
        background: rgba(0,0,0,0.65); border: 1px solid #000; border-radius: 2px;
        overflow: hidden; box-sizing: border-box; display: none;
    }
    .hp-hp-sliver-fill {
        position: absolute; top: 0; left: 0; height: 100%; width: 100%;
        transform-origin: left; will-change: transform; transition: transform 0.05s linear;
        border-radius: 1px;
    }
    .hp-hp-sliver-fill.me { background: linear-gradient(to bottom, #4aa8d8, #2070a0); }
    .hp-hp-sliver-fill.ally { background: linear-gradient(to bottom, #5cb85c, #2e7d2e); }
    .hp-hp-sliver-fill.enemy { background: linear-gradient(to bottom, #e04848, #a02020); }

 /* 底框：回到半透明黑（高對比，讓填充色跳出），黑邊為主 */
.hp-box { position: relative; width: 65px; height: 8px; background: rgba(0,0,0,0.72); border: 1px solid #000; border-radius: 3px; overflow: visible; box-shadow: 0 2px 4px rgba(0,0,0,0.6), inset 0 0 0 0.5px rgba(201,162,90,0.5); box-sizing: border-box; }

    .hp-trail { position: absolute; top: 0; left: 0; height: 100%; background: #f0e6d2; width: 100%; transform-origin: left; will-change: transform; border-radius: 2px; }
    .hp-fill { position: absolute; top: 0; left: 0; height: 100%; width: 100%; transform-origin: left; will-change: transform; transition: transform 0.05s linear; border-radius: 2px; }

    /* 🌟 文字：米白古紙色 */
    .hp-text { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -45%); z-index: 10; font-family: 'Anton', Impact, sans-serif; font-size: 12px; color: #f0e6d2; text-shadow: 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0px 2px 2px rgba(0,0,0,0.8); line-height: 1; pointer-events: none; letter-spacing: 0.5px; }

    /* 敵我三色：把螢光感調掉一點，但保持夠亮的對比 */
.hp-fill.ally { background: linear-gradient(to bottom, #5cb85c, #2e7d2e); }
.hp-fill.enemy { background: linear-gradient(to bottom, #e04848, #a02020); }
.hp-fill.me { background: linear-gradient(to bottom, #4aa8d8, #2070a0); }

    .hp-gem-tag {
        position: absolute; left: -28px; top: 50%; transform: translateY(-50%);
        font-family: 'Anton', Impact, sans-serif; font-size: 18px; color: #4dd0e1;
        text-shadow: 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0px 2px 5px rgba(0,0,0,0.9);
        z-index: 20; display: none; white-space: nowrap;
    }

    /* 名字標籤（血條上方） */
    .hp-name {
        position: relative; margin-bottom: 3px;
        font-family: "Microsoft JhengHei", "Anton", "Source Han Serif SC", serif;
        font-size: 11px; line-height: 1.15;
        white-space: nowrap; pointer-events: none; z-index: 25; letter-spacing: 0.3px;
        text-shadow: 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0px 2px 3px rgba(0,0,0,0.9);
        max-width: 140px;
        -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
    }
    .hp-affix { color: #f5d27a; font-size: 10px; }
    .hp-name-base.me { color: #6db8e8; }
    .hp-name-base.enemy { color: #e8a0a0; }
    .hp-name-base.ally { color: #aed581; }

    .hp-status-tag {
        position: absolute; left: 50%; bottom: 100%; transform: translate(-50%, -4px);
        font-family: 'Anton', Impact, sans-serif; 
        font-size: 15px;
        color: #FFFFFF;
        text-shadow: 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0px 2px 5px rgba(0,0,0,0.9);
        z-index: 30; display: none; white-space: nowrap; letter-spacing: 0.5px;
        pointer-events: none; will-change: transform;
        animation: statusPulse 0.5s infinite alternate;
    }
    @keyframes statusPulse {
        0% { transform: translate(-50%, -4px) scale(0.9); }
        100% { transform: translate(-50%, -4px) scale(1.1); }
    }

    .hp-ammo-container {
        position: absolute; top: calc(100% + 3px); left: 0; width: 100%; height: 4px;
        display: flex; justify-content: space-between; gap: 2px;
    }
    /* 🌟 彈藥格：用金，黑邊黑底襯托下跳得出來 */
   .hp-ammo-slot {
    flex-grow: 1; background: #d4a850; border: 0.5px solid #000; border-radius: 1px;
    transition: background 0.1s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.5);
}
.hp-ammo-slot.empty { background: rgba(0, 0, 0, 0.6); border: 0.5px solid rgba(0,0,0,0.8); }


    @keyframes ammoFlash {
        0% { background: #a83232; box-shadow: 0 0 4px #a83232; border: 0.5px solid #f0e6d2; }
        50% { background: rgba(26, 20, 16, 0.7); box-shadow: none; border: 0.5px solid rgba(0,0,0,0.8); }
        100% { background: #a83232; box-shadow: 0 0 4px #a83232; border: 0.5px solid #f0e6d2; }
    }
    .hp-ammo-slot.reloading { animation: ammoFlash 0.6s infinite ease-in-out; }

    .hp-dodge-container {
        position: absolute; top: calc(100% + 8px); left: 0; width: 100%; height: 4px;
        display: flex; justify-content: space-between; gap: 2px;
    }
    /* 🌟 閃避格：青 → 淡金/米白（呼應三國色票） */
   .hp-dodge-slot {
    flex-grow: 1; background: #3aa8c8; border: 0.5px solid #000; border-radius: 3px; 
    transition: background 0.1s ease, transform 0.1s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.5);
}
.hp-dodge-slot.empty { 
    background: rgba(0, 0, 0, 0.6); border: 0.5px solid rgba(0,0,0,0.8); 
    transform: scaleY(0.5);
}
    `;

    this.on('destroy', function() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }, this);
};

FloatingUIManager.prototype._escapeHtml = function(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

FloatingUIManager.prototype._buildNameHtml = function(baseName, relation, affixNames) {
    var colorClass = relation === 'me' ? 'me' : (relation === 'enemy' ? 'enemy' : 'ally');
    var affixHtml = '';
    if (affixNames && affixNames.length) {
        var safeAffixes = [];
        for (var i = 0; i < affixNames.length; i++) {
            safeAffixes.push(this._escapeHtml(affixNames[i]));
        }
        affixHtml = '<span class="hp-affix">' + safeAffixes.join('·') + '·</span>';
    }
    return '<div class="hp-name">' + affixHtml + '<span class="hp-name-base ' + colorClass + '">' + this._escapeHtml(baseName) + '</span></div>';
};

FloatingUIManager.prototype.registerUI = function(entity, name, maxHp, relation, playerName, affixNames) {
    if (!entity || !entity.getGuid) return;
    var id = entity.getGuid();
    if (this.bars[id]) return; 

    var isMe = relation === 'me';
    var colorClass = isMe ? 'me' : (relation === 'enemy' ? 'enemy' : 'ally');

    var wrap = document.createElement('div');
    wrap.className = 'hp-wrap';

    var displayBase = (playerName && String(playerName).trim()) ? playerName
        : ((name && String(name).trim()) ? name : '');
    var nameHtml = '';
    if (displayBase) {
        nameHtml = this._buildNameHtml(displayBase, colorClass, affixNames);
    }

    wrap.innerHTML =
        '<div class="hp-bar-stack">' +
        nameHtml +
        '<div class="hp-box">' +
        '<div class="hp-trail"></div>' +
        '<div class="hp-fill ' + colorClass + '"></div>' +
        '<div class="hp-text">' + Math.ceil(maxHp) + '</div>' +
        '</div>' +
        '<div class="hp-hp-sliver"><div class="hp-hp-sliver-fill ' + colorClass + '"></div></div>' +
        '</div>' +
        '<div class="hp-status-tag"></div>' +
        '<div class="hp-gem-tag"></div>' +
        '<div class="hp-ammo-container"></div>' +
        '<div class="hp-dodge-container"></div>';
    this.container.appendChild(wrap);

    this.bars[id] = {
        entity: entity,
        wrap: wrap,
        fillEl: wrap.querySelector('.hp-fill'),
        trailEl: wrap.querySelector('.hp-trail'),
        sliverEl: wrap.querySelector('.hp-hp-sliver'),
        sliverFillEl: wrap.querySelector('.hp-hp-sliver-fill'),
        textEl: wrap.querySelector('.hp-text'),
        colorClass: colorClass,
        gemEl: wrap.querySelector('.hp-gem-tag'), 
        ammoEl: wrap.querySelector('.hp-ammo-container'), 
        dodgeEl: wrap.querySelector('.hp-dodge-container'), 
        statusEl: wrap.querySelector('.hp-status-tag'),
        maxHp: maxHp,
        currentHp: maxHp,
        trailHp: maxHp,
        maxShield: 0,
        currentShield: 0,
        delayTimer: 0,
        yOffset: 3.0,
        lastMaxAmmo: -1,
        lastMaxDodge: -1,
        // 效能：快取 render、dirty style
        renders: entity.findComponents('render'),
        _rendersEntity: entity,
        _lastDisplay: undefined,
        _lastOpacity: undefined,
        _lastTx: undefined,
        _lastTy: undefined
    };
};

FloatingUIManager.prototype._getBarRenders = function(bar) {
    if (!bar.entity) return [];
    var needRefresh = !bar.renders || bar._rendersEntity !== bar.entity;
    if (!needRefresh && bar.renders.length > 0) {
        var r0 = bar.renders[0];
        if (!r0 || !r0.entity) needRefresh = true;
    }
    if (needRefresh) {
        bar.renders = bar.entity.findComponents('render');
        bar._rendersEntity = bar.entity;
    }
    return bar.renders;
};

FloatingUIManager.prototype._setBarDisplay = function(bar, display) {
    if (bar._lastDisplay === display) return;
    bar._lastDisplay = display;
    bar.wrap.style.display = display;
};

FloatingUIManager.prototype._setBarOpacity = function(bar, opacity) {
    if (bar._lastOpacity === opacity) return;
    bar._lastOpacity = opacity;
    bar.wrap.style.opacity = opacity;
};

FloatingUIManager.prototype._setBarTransform = function(bar, screenX, screenY) {
    // 0.5px 取整：夠細不抖，又能跳過無意義 style 寫入
    var rx = Math.round(screenX * 2) / 2;
    var ry = Math.round(screenY * 2) / 2;
    if (bar._lastTx === rx && bar._lastTy === ry) return;
    bar._lastTx = rx;
    bar._lastTy = ry;
    bar.wrap.style.transform = 'translate(calc(-50% + ' + rx + 'px), calc(-100% + ' + ry + 'px))';
};

FloatingUIManager.prototype._refreshBarDisplay = function(bar) {
    if (!bar || !bar.fillEl) return;
    var hasShield = bar.maxShield > 0 && bar.currentShield > 0;

    if (hasShield) {
        bar.fillEl.className = 'hp-fill hp-fill-shield';
        bar.trailEl.style.display = 'none';
        var shieldRatio = Math.min(1, bar.currentShield / bar.maxShield);
        bar.fillEl.style.transform = 'scaleX(' + shieldRatio + ')';
        if (bar.sliverEl) bar.sliverEl.style.display = 'block';
        if (bar.sliverFillEl) {
            var hpRatio = bar.maxHp > 0 ? Math.min(1, bar.currentHp / bar.maxHp) : 0;
            bar.sliverFillEl.style.transform = 'scaleX(' + hpRatio + ')';
        }
        bar.textEl.innerText = Math.ceil(bar.currentShield);
    } else {
        bar.fillEl.className = 'hp-fill ' + bar.colorClass;
        bar.trailEl.style.display = '';
        if (bar.sliverEl) bar.sliverEl.style.display = 'none';
        var fillRatio = bar.maxHp > 0 ? Math.min(1, bar.currentHp / bar.maxHp) : 0;
        bar.fillEl.style.transform = 'scaleX(' + fillRatio + ')';
        var trailRatio = bar.maxHp > 0 ? Math.min(1, bar.trailHp / bar.maxHp) : 0;
        bar.trailEl.style.transform = 'scaleX(' + trailRatio + ')';
        bar.textEl.innerText = Math.ceil(bar.currentHp);
    }
};

// 🌟 更新血條上限(角色最大生命改變時呼叫,例如 ROGUE 強化卡加血,避免 fill 撐出容器)
FloatingUIManager.prototype.updateMaxHealth = function(entity, newMaxHp) {
    if (!entity || !entity.getGuid) return;
    var bar = this.bars[entity.getGuid()];
    if (!bar || !newMaxHp || newMaxHp <= 0) return;
    bar.maxHp = newMaxHp;
    if (bar.currentHp > newMaxHp) bar.currentHp = newMaxHp;
    if (bar.trailHp > newMaxHp) bar.trailHp = newMaxHp;
    if (bar.maxShield <= 0 || bar.currentShield <= 0) {
        var fillRatio = Math.min(1, bar.currentHp / bar.maxHp);
        bar.fillEl.style.transform = 'scaleX(' + fillRatio + ')';
        bar.trailEl.style.transform = 'scaleX(' + Math.min(1, bar.trailHp / bar.maxHp) + ')';
        bar.textEl.innerText = Math.ceil(bar.currentHp);
    }
    this._refreshBarDisplay(bar);
};

FloatingUIManager.prototype.updateHealth = function(entity, hp) {
    if (!entity || !entity.getGuid) return;
    var id = entity.getGuid();
    var bar = this.bars[id];
    if (!bar) return;

    var newHp = Math.max(0, hp);
    
    if (newHp < bar.currentHp) {
        bar.delayTimer = 0.25; 
    } else if (newHp > bar.currentHp) {
        bar.trailHp = newHp; 
    }
    bar.currentHp = newHp;

    if (bar.maxShield > 0 && bar.currentShield > 0) {
        this._refreshBarDisplay(bar);
        return;
    }

    var fillRatio = Math.min(1, bar.currentHp / bar.maxHp);
    bar.fillEl.style.transform = 'scaleX(' + fillRatio + ')';
    bar.textEl.innerText = Math.ceil(bar.currentHp);
};

FloatingUIManager.prototype.updateShield = function(entity, shieldHp, shieldMax) {
    if (!entity || !entity.getGuid) return;
    var bar = this.bars[entity.getGuid()];
    if (!bar) return;

    bar.currentShield = Math.max(0, shieldHp || 0);
    bar.maxShield = Math.max(0, shieldMax || 0);
    this._refreshBarDisplay(bar);
};

// 🌟 狀態更新 API
FloatingUIManager.prototype.updateStatus = function(entity, text, colorHex) {
    if (!entity || !entity.getGuid) return;
    var id = entity.getGuid();
    var bar = this.bars[id];
    if (!bar) return;

    if (text && text.trim() !== "") {
        bar.statusEl.innerText = text;
        if (colorHex) bar.statusEl.style.color = colorHex;
        if (bar.statusEl.style.display !== 'block') {
            bar.statusEl.style.display = 'block';
        }
    } else {
        if (bar.statusEl.style.display !== 'none') {
            bar.statusEl.style.display = 'none';
        }
    }
};

FloatingUIManager.prototype.updateGems = function(entity, gemCount) {
    if (!entity || !entity.getGuid) return;
    var id = entity.getGuid();
    var bar = this.bars[id];
    if (!bar) return;

    if (gemCount > 0) {
        bar.gemEl.innerText = "💎 " + gemCount;
        bar.gemEl.style.display = 'block';
    } else {
        bar.gemEl.style.display = 'none';
    }
};

FloatingUIManager.prototype.updateAmmo = function(entity, currentAmmo, maxAmmo, isReloading) {
    if (!entity || !entity.getGuid) return;
    var id = entity.getGuid();
    var bar = this.bars[id];
    if (!bar) return;

    if (bar.lastMaxAmmo !== maxAmmo) {
        bar.lastMaxAmmo = maxAmmo;
        var html = '';
        for (var i = 0; i < maxAmmo; i++) {
            html += '<div class="hp-ammo-slot"></div>';
        }
        bar.ammoEl.innerHTML = html;
        bar.ammoSlots = bar.ammoEl.querySelectorAll('.hp-ammo-slot'); 
    }

    if (bar.ammoSlots) {
        for (var j = 0; j < bar.lastMaxAmmo; j++) {
            if (j < currentAmmo) {
                bar.ammoSlots[j].classList.remove('empty');
                bar.ammoSlots[j].classList.remove('reloading');
            } else {
                bar.ammoSlots[j].classList.add('empty');
                if (isReloading) {
                    bar.ammoSlots[j].classList.add('reloading');
                } else {
                    bar.ammoSlots[j].classList.remove('reloading');
                }
            }
        }
    }
};

FloatingUIManager.prototype.updateDodge = function(entity, currentDodge, maxDodge) {
    if (!entity || !entity.getGuid) return;
    var id = entity.getGuid();
    var bar = this.bars[id];
    if (!bar) return;

    if (bar.lastMaxDodge !== maxDodge) {
        bar.lastMaxDodge = maxDodge;
        var html = '';
        for (var i = 0; i < maxDodge; i++) {
            html += '<div class="hp-dodge-slot"></div>';
        }
        bar.dodgeEl.innerHTML = html;
        bar.dodgeSlots = bar.dodgeEl.querySelectorAll('.hp-dodge-slot'); 
    }

    if (bar.dodgeSlots) {
        for (var j = 0; j < bar.lastMaxDodge; j++) {
            if (j < currentDodge) {
                bar.dodgeSlots[j].classList.remove('empty');
            } else {
                bar.dodgeSlots[j].classList.add('empty');
            }
        }
    }
};

FloatingUIManager.prototype.removeUI = function(entity) {
    if (!entity || !entity.getGuid) return;
    var id = entity.getGuid();
    var bar = this.bars[id];
    if (bar) {
        if (bar.wrap.parentNode) bar.wrap.parentNode.removeChild(bar.wrap);
        delete this.bars[id];
    }
};

FloatingUIManager.prototype.update = function(dt) {
    if (this.app.scoreManager && this.app.scoreManager.getState() === 'gameover') {
        if (this.container.style.display !== 'none') {
            this.container.style.display = 'none';
        }
        return; 
    } else {
        if (this.container.style.display === 'none') {
            this.container.style.display = 'block';
        }
    }

    if (!this.cameraEntity || !this.cameraEntity.camera) return;
    var camera = this.cameraEntity.camera;
    // Reuse temp vectors to avoid per-frame allocations (GC spikes on mobile).
    if (!this._tmpScreenPos) this._tmpScreenPos = new pc.Vec3();
    if (!this._tmpWorldPos) this._tmpWorldPos = new pc.Vec3();
    var screenPos = this._tmpScreenPos;
    var worldPos = this._tmpWorldPos;

    for (var id in this.bars) {
        var bar = this.bars[id];

        if (!bar.entity || !bar.entity.parent || !bar.entity.enabled) {
            this._setBarDisplay(bar, 'none');
            continue;
        }

        var renders = this._getBarRenders(bar);
        var isHiddenByLogic = false;
        if (renders.length > 0) {
            var anyVisible = false;
            for (var i = 0; i < renders.length; i++) {
                if (renders[i].enabled) {
                    anyVisible = true;
                    break;
                }
            }
            if (!anyVisible) isHiddenByLogic = true;
        }

        if (isHiddenByLogic) {
            this._setBarDisplay(bar, 'none');
            continue;
        } else {
            this._setBarDisplay(bar, 'block');
        }

        if (bar.trailHp > bar.currentHp) {
            if (bar.delayTimer > 0) {
                bar.delayTimer -= dt;
            } else {
                bar.trailHp = pc.math.lerp(bar.trailHp, bar.currentHp, dt * 10);
                if (bar.trailHp - bar.currentHp < 1) bar.trailHp = bar.currentHp;
                if (bar.maxShield <= 0 || bar.currentShield <= 0) {
                    var trailRatio = bar.trailHp / bar.maxHp;
                    bar.trailEl.style.transform = 'scaleX(' + trailRatio + ')';
                }
            }
        }

        var pos = bar.entity.getPosition();
        worldPos.set(pos.x, pos.y + bar.yOffset, pos.z);
        camera.worldToScreen(worldPos, screenPos);

        if (screenPos.z < 0) {
            this._setBarOpacity(bar, '0');
        } else {
            this._setBarOpacity(bar, '1');
            this._setBarTransform(bar, screenPos.x, screenPos.y);
        }
    }
};