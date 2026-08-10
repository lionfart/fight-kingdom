var FloatingDamageManager = pc.createScript('floatingDamageManager');

// ==========================================
// 🌟 控制面板：在 PlayCanvas Editor 中自由調整
// ==========================================
FloatingDamageManager.attributes.add('fontSizeNormal', { type: 'number', default: 28, title: '字體大小 (一般)' });
FloatingDamageManager.attributes.add('fontSizeCrit', { type: 'number', default: 36, title: '字體大小 (受擊/暴擊/文字狀態)' });

FloatingDamageManager.attributes.add('colorNormal', { type: 'rgba', default: [1, 1, 1, 1], title: '字體顏色 (一般)' }); 
FloatingDamageManager.attributes.add('colorCrit', { type: 'rgba', default: [1, 0.2, 0.2, 1], title: '字體顏色 (受擊/暴擊/文字狀態)' }); 

FloatingDamageManager.attributes.add('startYOffset', { type: 'number', default: 1.5, title: '起始高度 (Y軸偏移)' });
FloatingDamageManager.attributes.add('floatSpeed', { type: 'number', default: 2.0, title: '向上飄浮速度' });
FloatingDamageManager.attributes.add('maxScale', { type: 'number', default: 1.6, title: '最大膨脹比例 (Pop Scale)' });
FloatingDamageManager.attributes.add('duration', { type: 'number', default: 0.8, title: '存活時間 (秒)' });

FloatingDamageManager.attributes.add('outlineThickness', { type: 'number', default: 1.0, title: '黑邊粗細 (Pixel)', description: '設為 1 較精緻，設為 0 則完全無邊框' });
FloatingDamageManager.attributes.add('fontWeight', { 
    type: 'number', 
    default: 900, 
    title: '字體粗細 (Font Weight)', 
    description: '400=一般, 700=粗體, 900=極粗' 
});

FloatingDamageManager.prototype.initialize = function() {
    this.cameraEntity = this.app.root.findByName('Camera');
    
    // 🌟 Bug 4 Fix: 將 screenPos 移入 initialize，每個實例獨立擁有，消除多實例衝突隱患
    this.screenPos = new pc.Vec3(); 
    
    // ==========================================
    // 🌟 真正的物件池建立 (Object Pool)
    // ==========================================
    this.poolSize = 50; // 預先準備 50 個漂浮文字標籤
    this.textPool = [];

    if (!document.getElementById('fk-brawl-font')) {
        var fontLink = document.createElement('link');
        fontLink.id = 'fk-brawl-font';
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Anton&display=swap';
        document.head.appendChild(fontLink);
    }

    var t = this.outlineThickness;
    var shadowCSS = 'none'; 
    
    if (t > 0) {
        shadowCSS = `${t}px ${t}px 0px #000, -${t}px -${t}px 0px #000, ${t}px -${t}px 0px #000, -${t}px ${t}px 0px #000, 0px ${t + 1.5}px 0px #000`;
    }

    var style = document.createElement('style');
    style.innerHTML = `
        .damage-text {
            position: absolute;
            font-family: 'Anton', 'Impact', 'Arial Black', sans-serif;
            text-shadow: ${shadowCSS}; 
            pointer-events: none; 
            user-select: none;
            z-index: 50;
            transform-origin: center center;
            font-weight: ${this.fontWeight}; /* 🌟 Bug 2 Fix: 正確套用 Editor 的粗細設定 */
            will-change: transform, opacity, left, top;
            letter-spacing: 1px; 
        }
    `;
    document.head.appendChild(style);

    this.container = document.createElement('div');
    this.container.id = 'damage-container';
    this.container.style.position = 'absolute';
    this.container.style.top = '0';
    this.container.style.left = '0';
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    this.container.style.pointerEvents = 'none';
    this.container.style.overflow = 'hidden';
    document.body.appendChild(this.container);

    // 🌟 預先創造 50 個 DOM 元素並放進池子裡休眠
    for (var i = 0; i < this.poolSize; i++) {
        var el = document.createElement('div');
        el.className = 'damage-text';
        el.style.display = 'none';
        this.container.appendChild(el);
        
        this.textPool.push({
            el: el,
            active: false, // 標記為未啟用
            originalWorldPos: new pc.Vec3(), // 🌟 新增：用來進行鄰近合併判定的靜態座標
            worldPos: new pc.Vec3(),         // 會隨時間向上飄動的動態座標
            currentValue: 0,                 // 🌟 新增：記錄實際數字，避免從 DOM 反解析
            life: 0,
            maxLife: this.duration,
            baseScale: 1.0,
            speed: 0
        });
    }

    this.app.on('ui:floatingDamage', this.spawnDamage, this);

    this.on('destroy', function() {
        this.app.off('ui:floatingDamage', this.spawnDamage, this);
        if (this.container) this.container.remove();
    });
};

FloatingDamageManager.prototype._colorToCss = function(pcColor) {
    return 'rgba(' + Math.round(pcColor.r * 255) + ',' + Math.round(pcColor.g * 255) + ',' + Math.round(pcColor.b * 255) + ',' + pcColor.a + ')';
};

FloatingDamageManager.prototype.spawnDamage = function(worldPos, damage, isCrit, customColor, scaleMultiplier, isTrueCrit) {
    if (!this.cameraEntity || !this.cameraEntity.camera) return;

    var refDim = Math.min(window.innerWidth, window.innerHeight);
    var uiScale = Math.max(0.5, Math.min(1.4, refDim / 720));

    // 🌟 Bug 1 承接：計算最終倍率
    var mult = (scaleMultiplier !== undefined && scaleMultiplier !== null) ? scaleMultiplier : 1.0;
    var targetBaseScale = ((isCrit || customColor || isTrueCrit) ? 1.5 : 1.0) * mult;

    // ==========================================
    // 🌟 Bug 3 Fix：數字去重合併 (Damage Aggregation)
    // ==========================================
    if (typeof damage === 'number') {
        for (var j = 0; j < this.poolSize; j++) {
            var existing = this.textPool[j];
            // 尋找 0.15 秒內產生、且是數字的鄰近跳字
            if (existing.active && existing.life < 0.15 && typeof existing.currentValue === 'number') {
                var dx = existing.originalWorldPos.x - worldPos.x;
                var dz = existing.originalWorldPos.z - worldPos.z;
                
                // 距離小於 0.8 (0.64 是 0.8 的平方，省去開根號效能)
                if (dx * dx + dz * dz < 0.64) {
                    // 將傷害累加上去
                    existing.currentValue += damage;
                    existing.el.innerText = Math.round(existing.currentValue);
                    existing.life = 0; // 重置跳字動畫時間
                    
                    // 如果這一下是暴擊或連擊終結，將現有文字放大
                    if (targetBaseScale > existing.baseScale) {
                        existing.baseScale = targetBaseScale;
                    }
                    if (isTrueCrit) {
                        existing.isTrueCrit = true;
                        existing.el.style.color = '#FF4D00';
                    }
                    return; // 合併成功，直接結束函數，不消耗新 DOM！
                }
            }
        }
    }

    // 🌟 從物件池中尋找一個「休眠中 (active === false)」的文字
    var textObj = null;
    for (var i = 0; i < this.poolSize; i++) {
        if (!this.textPool[i].active) {
            textObj = this.textPool[i];
            break;
        }
    }

    // 如果 50 個全都在畫面上（機率極低），就直接放棄這次顯示，保護效能
    if (!textObj) return; 

    // 🌟 重新設定這個回收物件的屬性
    var el = textObj.el;
    
    if (typeof damage === 'string') {
        el.innerText = damage;
        textObj.currentValue = damage;
        if (damage === 'MISS') {
            el.style.color = '#90A4AE';
            el.style.fontSize = (this.fontSizeNormal * uiScale * 1.15) + 'px';
            el.style.fontWeight = '700';
            el.style.letterSpacing = '1px';
        }
    } else {
        el.innerText = Math.round(damage); 
        textObj.currentValue = damage; // 存數字以利後續合併
    }
    
    if (customColor) {
        el.style.color = this._colorToCss(customColor);
        el.style.fontSize = ((isCrit || isTrueCrit ? this.fontSizeCrit : this.fontSizeNormal) * uiScale) + 'px';
    }
    else if (typeof damage === 'string' && damage === 'MISS') {
        // styled above
    }
    else if (isTrueCrit) {
        el.style.color = '#FF4D00';
        el.style.fontSize = (this.fontSizeCrit * uiScale) + 'px';
    }
    else if (isCrit) {
        el.style.color = this._colorToCss(this.colorCrit);
        el.style.fontSize = (this.fontSizeCrit * uiScale) + 'px';
    }
    else {
        el.style.color = this._colorToCss(this.colorNormal);
        el.style.fontSize = (this.fontSizeNormal * uiScale) + 'px';
    }
    
    el.style.display = 'none';

    var randomOffsetX = (Math.random() - 0.5) * 0.8;
    var randomOffsetZ = (Math.random() - 0.5) * 0.8;

    // 🌟 啟動該物件
    textObj.active = true;
    textObj.life = 0;
    textObj.maxLife = this.duration;
    textObj.baseScale = targetBaseScale; // 🌟 Bug 1 套用倍率
    textObj.isTrueCrit = !!isTrueCrit;
    textObj.speed = this.floatSpeed + (Math.random() - 0.5) * 0.5;
    
    // 記錄基礎原點與飄浮原點
    textObj.originalWorldPos.set(worldPos.x, worldPos.y, worldPos.z);
    textObj.worldPos.set(worldPos.x + randomOffsetX, worldPos.y + this.startYOffset, worldPos.z + randomOffsetZ);
};

FloatingDamageManager.prototype.update = function(dt) {
    if (!this.cameraEntity || !this.cameraEntity.camera) return;

    var winWidth = window.innerWidth;
    var winHeight = window.innerHeight;

    for (var i = 0; i < this.poolSize; i++) {
        var txt = this.textPool[i];
        
        // 🌟 只更新正在啟用中的文字
        if (!txt.active) continue;

        txt.life += dt;

        // 🌟 生命週期結束，將其設為休眠，隱藏而不刪除！
        if (txt.life >= txt.maxLife) {
            txt.active = false;
            txt.el.style.display = 'none';
            continue;
        }

        var progress = txt.life / txt.maxLife; 
        var scale = txt.baseScale;
        var opacity = 1.0;

        if (progress < 0.15) {
            var popProgress = progress / 0.15; 
            scale = txt.baseScale * (0.5 + popProgress * (this.maxScale - 0.5)); 
        } else {
            var fadeProgress = (progress - 0.15) / 0.85; 
            scale = txt.baseScale * (this.maxScale - fadeProgress * (this.maxScale - 0.8)); 
            
            if (fadeProgress > 0.6) {
                opacity = 1.0 - ((fadeProgress - 0.6) / 0.4);
            }
        }

        txt.worldPos.y += dt * txt.speed;

        this.cameraEntity.camera.worldToScreen(txt.worldPos, this.screenPos);

        if (this.screenPos.z < 0 || this.screenPos.x < -150 || this.screenPos.y < -150 || this.screenPos.x > winWidth + 150 || this.screenPos.y > winHeight + 150) {
            txt.el.style.display = 'none';
        } else {
            txt.el.style.display = 'block';
            txt.el.style.left = this.screenPos.x + 'px';
            txt.el.style.top = this.screenPos.y + 'px';
            txt.el.style.transform = `translate(-50%, -50%) scale(${scale})`;
            txt.el.style.opacity = opacity;
        }
    }
};