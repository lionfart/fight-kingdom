var CustomHitVfx = pc.createScript('customHitVfx');

CustomHitVfx.attributes.add('poolSize', { type: 'number', default: 20,  title: '快取池大小' });
CustomHitVfx.attributes.add('vfxScale', { type: 'number', default: 1.4, title: '爆破大小' });
CustomHitVfx.attributes.add('slashTemplate', { type: 'entity', title: '斬擊模板（Editor 設好 disabled）' });
CustomHitVfx.attributes.add('bluntTemplate', { type: 'entity', title: '打擊模板（Editor 設好 disabled）' });
CustomHitVfx.attributes.add('magicTemplate', { type: 'entity', title: '魔法模板（Editor 設好 disabled）' });
CustomHitVfx.attributes.add('entityLife', { type: 'number', default: 0.42, title: 'Entity 特效存活秒數' });
CustomHitVfx.attributes.add('entityHeavyLife', { type: 'number', default: 0.55, title: 'Entity 重擊存活秒數' });

// ═══════════════════════════════════════════════════════════════════════════════
// 設計概念
//   三種命中特效，各有自己的「形狀語言」與時間節奏：
//   - slash（斬擊）：一道弧形月牙劃過 + 開場閃光 + 少量碎屑
//   - blunt（打擊）：強閃光 + 圓形衝擊環 + 放射狀衝擊線（對稱、無方向）
//   - magic（魔法）：柔和光暈 + 符文環 + 彩色火花（additive 發光感）
//   打擊感的關鍵是「節奏」：閃光先出 → 主體接棒 → 碎屑最後散開，不是全部同時。
//   Editor 可拖入 slash/blunt/magic 模板 entity（預設 disabled）；有模板用模板，沒有則走下方程式生成。
// ═══════════════════════════════════════════════════════════════════════════════

CustomHitVfx.prototype._getTemplate = function(hitType) {
    if (hitType === 'slash') return this.slashTemplate;
    if (hitType === 'magic') return this.magicTemplate;
    return this.bluntTemplate;
};

CustomHitVfx.prototype._hideTemplate = function(template) {
    if (template) template.enabled = false;
};

CustomHitVfx.prototype._initEntityPools = function() {
    this.entityPools = { slash: [], blunt: [], magic: [] };
    var types = ['slash', 'blunt', 'magic'];
    for (var t = 0; t < types.length; t++) {
        var hitType = types[t];
        var template = this._getTemplate(hitType);
        if (!template) continue;
        this._hideTemplate(template);
        var tplScale = template.getLocalScale();
        for (var i = 0; i < this.poolSize; i++) {
            var clone = template.clone();
            clone.name = 'HitFxTpl_' + hitType + '_' + i;
            clone.enabled = false;
            this.app.root.addChild(clone);
            this.entityPools[hitType].push({
                root: clone,
                isEntity: true,
                tplScale: { x: tplScale.x, y: tplScale.y, z: tplScale.z },
                life: 0,
                maxLife: this.entityLife,
                type: hitType,
                scaleMult: 1.0,
                rot: 0
            });
        }
    }
};

CustomHitVfx.prototype._pickEntityVfx = function(hitType) {
    var pool = this.entityPools && this.entityPools[hitType];
    if (!pool || pool.length === 0) return null;
    for (var i = 0; i < pool.length; i++) {
        if (!pool[i].root.enabled) return pool[i];
    }
    return null;
};

CustomHitVfx.prototype._restartEntityVfx = function(root) {
    if (!root) return;
    var sprites = root.findComponents('sprite');
    for (var i = 0; i < sprites.length; i++) {
        sprites[i].frame = 0;
        if (sprites[i].playing !== undefined) sprites[i].playing = true;
    }
    var anims = root.findComponents('anim');
    for (var j = 0; j < anims.length; j++) {
        var layer = anims[j].baseLayer;
        if (layer && layer.activeState) layer.activeState.time = 0;
    }
    if (root.script) {
        for (var key in root.script) {
            var s = root.script[key];
            if (s && typeof s.onVfxPlay === 'function') s.onVfxPlay();
        }
    }
};

CustomHitVfx.prototype._playEntityHit = function(pos, isHeavyHit, hitType, hitAngle) {
    var vfx = this._pickEntityVfx(hitType);
    if (!vfx) return false;

    vfx.life = 0;
    vfx.maxLife = isHeavyHit ? this.entityHeavyLife : this.entityLife;
    vfx.scaleMult = isHeavyHit ? 1.6 : 1.0;
    vfx.type = hitType;
    vfx.rot = (hitAngle !== undefined) ? hitAngle * (180 / Math.PI) : Math.random() * 360;

    var s = this.vfxScale * vfx.scaleMult;
    var ts = vfx.tplScale;
    vfx.root.setLocalScale(ts.x * s, ts.y * s, ts.z * s);
    vfx.root.setPosition(
        pos.x + (Math.random() - 0.5) * 0.1,
        pos.y + 0.35,
        pos.z + (Math.random() - 0.5) * 0.1
    );
    if (hitType === 'slash') {
        vfx.root.setEulerAngles(0, vfx.rot, 0);
    } else if (this.camera) {
        var camPos = this.camera.getPosition();
        this._applyYawBillboard(vfx, camPos);
    }

    this._restartEntityVfx(vfx.root);
    vfx.root.enabled = true;
    this.activeVfx.push(vfx);
    return true;
};

CustomHitVfx.prototype._playProceduralHit = function(pos, isHeavyHit, hitType, hitAngle) {
    var vfx = null;
    for (var i = 0; i < this.pool.length; i++) {
        if (!this.pool[i].root.enabled) { vfx = this.pool[i]; break; }
    }
    if (!vfx) return;

    vfx.life      = 0;
    vfx.maxLife   = isHeavyHit ? 0.5 : 0.38;
    vfx.scaleMult = isHeavyHit ? 1.6 : 1.0;
    vfx.type      = hitType;
    vfx.rot       = (hitAngle !== undefined) ? hitAngle * (180 / Math.PI) : Math.random() * 360;

    if (hitType === 'slash') {
        this._setupSlash(vfx, isHeavyHit);
    } else if (hitType === 'blunt') {
        this._setupBlunt(vfx, isHeavyHit);
    } else {
        this._setupMagic(vfx, isHeavyHit);
    }

    vfx.root.setPosition(
        pos.x + (Math.random() - 0.5) * 0.1,
        pos.y + 0.35,
        pos.z + (Math.random() - 0.5) * 0.1
    );
    vfx.root.enabled = true;
    this.activeVfx.push(vfx);
};

CustomHitVfx.prototype.initialize = function() {
    this.pool      = [];
    this.activeVfx = [];

    this.camera      = this.app.root.findByName('Camera') || (this.app.systems.camera.cameras[0] && this.app.systems.camera.cameras[0].entity);
    this._tempCamPos = new pc.Vec3();
    this._tempVfxPos = new pc.Vec3();

    // ── 貼圖快取 ──────────────────────────────────────────────────────────────
    this._arcTextures   = [];
    this._sparkTextures = [];
    this._flashTex      = this._createFlashCircle();
    this._ringTex       = this._createRingTexture();
    this._burstTex      = this._createBurstTexture();
    this._runeTex       = this._createRuneTexture();
    for (var i = 0; i < 4; i++) {
        this._arcTextures.push(this._createArcTexture());
        this._sparkTextures.push(this._createSparkTexture());
    }

    // ── 材質 ──────────────────────────────────────────────────────────────────
    this.inkMaterial = new pc.StandardMaterial();
    this.inkMaterial.blendType    = pc.BLEND_NORMAL;
    this.inkMaterial.depthWrite   = false;
    this.inkMaterial.cull         = pc.CULLFACE_NONE;
    this.inkMaterial.useLighting  = false;
    this.inkMaterial.diffuse      = new pc.Color(1, 1, 1);
    this.inkMaterial.opacityMapChannel = 'a';

    this.glowMaterial = new pc.StandardMaterial();
    this.glowMaterial.blendType    = pc.BLEND_ADDITIVEALPHA;
    this.glowMaterial.depthWrite   = false;
    this.glowMaterial.cull         = pc.CULLFACE_NONE;
    this.glowMaterial.useLighting  = false;
    this.glowMaterial.emissive     = new pc.Color(1, 1, 1);
    this.glowMaterial.opacityMapChannel = 'a';

    this.inkMaterial.opacityMap  = this._flashTex;
    this.inkMaterial.update();
    this.glowMaterial.opacityMap = this._flashTex;
    this.glowMaterial.update();

    // ── 物件池初始化 ───────────────────────────────────────────────────────────
    this._initEntityPools();
    for (var j = 0; j < this.poolSize; j++) {
        this.pool.push(this._createVfxEntity(j));
    }

    this.app.on('fx:hit', this.playHit, this);
    this.on('destroy', function() {
        this.app.off('fx:hit', this.playHit, this);
        if (this.entityPools) {
            var types = ['slash', 'blunt', 'magic'];
            for (var ti = 0; ti < types.length; ti++) {
                var ep = this.entityPools[types[ti]];
                if (!ep) continue;
                for (var ei = 0; ei < ep.length; ei++) {
                    if (ep[ei].root && ep[ei].root.destroy) ep[ei].root.destroy();
                }
            }
        }
        this._arcTextures.forEach(function(t)   { if (t) t.destroy(); });
        this._sparkTextures.forEach(function(t) { if (t) t.destroy(); });
        if (this._flashTex)    this._flashTex.destroy();
        if (this._ringTex)     this._ringTex.destroy();
        if (this._burstTex)    this._burstTex.destroy();
        if (this._runeTex)     this._runeTex.destroy();
        if (this.inkMaterial)  this.inkMaterial.destroy();
        if (this.glowMaterial) this.glowMaterial.destroy();
    }, this);
};

// ═══════════════════════════════════════════════════════════════════════════════
// 貼圖生成
// ═══════════════════════════════════════════════════════════════════════════════

CustomHitVfx.prototype._makeTex = function(canvas, mip) {
    var tex = new pc.Texture(this.app.graphicsDevice, {
        format: pc.PIXELFORMAT_R8_G8_B8_A8, autoMipmap: mip !== false
    });
    tex.setSource(canvas);
    tex.upload();
    return tex;
};

// 圓形閃光（柔和放射漸層）
CustomHitVfx.prototype._createFlashCircle = function() {
    var canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    var ctx = canvas.getContext('2d');
    var g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0,    'rgba(255,255,255,1)');
    g.addColorStop(0.4,  'rgba(255,255,255,0.7)');
    g.addColorStop(1,    'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return this._makeTex(canvas, false);
};

// 弧形月牙（斬擊主體）：一道有粗細變化、兩端收尖的彎弧
CustomHitVfx.prototype._createArcTexture = function() {
    var canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    var ctx = canvas.getContext('2d');
    var cx = 128, cy = 150;
    var radius = 95 + Math.random() * 15;
    var startA = Math.PI * (1.15 + Math.random() * 0.1);
    var endA   = Math.PI * (1.85 + Math.random() * 0.1);

    // 沿弧線畫漸變寬度的帶子：中段最寬、兩端收尖
    var steps = 40;
    for (var i = 0; i < steps; i++) {
        var t  = i / (steps - 1);
        var a  = startA + (endA - startA) * t;
        var taper = Math.sin(t * Math.PI);          // 0→1→0，兩端細中間粗
        var w  = 2 + taper * 16;
        var px = cx + Math.cos(a) * radius;
        var py = cy + Math.sin(a) * radius;
        var alpha = 0.25 + taper * 0.75;
        ctx.beginPath();
        ctx.arc(px, py, w * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,' + alpha.toFixed(3) + ')';
        ctx.fill();
    }
    return this._makeTex(canvas, true);
};

// 衝擊環（打擊用，斷續的圓環更有衝擊感）
CustomHitVfx.prototype._createRingTexture = function() {
    var canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    var ctx = canvas.getContext('2d');
    var cx = 128, cy = 128, r = 100;
    ctx.strokeStyle = 'rgba(255,255,255,1)';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    var seg = 14;
    for (var i = 0; i < seg; i++) {
        if (Math.random() < 0.12) continue;
        var s = (i / seg) * Math.PI * 2;
        var e = ((i + 0.8) / seg) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r + (Math.random() - 0.5) * 5, s, e);
        ctx.stroke();
    }
    return this._makeTex(canvas, true);
};

// 放射衝擊線（打擊用，從中心往外的尖刺線條，強調「炸開」）
CustomHitVfx.prototype._createBurstTexture = function() {
    var canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    var ctx = canvas.getContext('2d');
    var cx = 128, cy = 128;
    var spikes = 10 + Math.floor(Math.random() * 4);
    for (var i = 0; i < spikes; i++) {
        var a   = (i / spikes) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
        var len = 70 + Math.random() * 45;
        var w   = 3 + Math.random() * 4;
        var tx  = cx + Math.cos(a) * len;
        var ty  = cy + Math.sin(a) * len;
        var g = ctx.createLinearGradient(cx, cy, tx, ty);
        g.addColorStop(0,   'rgba(255,255,255,1)');
        g.addColorStop(1,   'rgba(255,255,255,0)');
        ctx.strokeStyle = g;
        ctx.lineWidth = w;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * 12, cy + Math.sin(a) * 12);
        ctx.lineTo(tx, ty);
        ctx.stroke();
    }
    return this._makeTex(canvas, true);
};

// 符文環（魔法用，雙圈 + 細刻度，帶神秘感）
CustomHitVfx.prototype._createRuneTexture = function() {
    var canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    var ctx = canvas.getContext('2d');
    var cx = 128, cy = 128;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, 95, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 78, 0, Math.PI * 2); ctx.stroke();
    // 外圈刻度
    var ticks = 24;
    ctx.lineWidth = 3;
    for (var i = 0; i < ticks; i++) {
        var a = (i / ticks) * Math.PI * 2;
        var r1 = 95, r2 = 108;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
        ctx.stroke();
    }
    return this._makeTex(canvas, true);
};

// 火花/碎屑（共用，往外噴的小亮點）
CustomHitVfx.prototype._createSparkTexture = function() {
    var canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    var ctx = canvas.getContext('2d');
    var cx = 128, cy = 128;
    var dir = Math.random() * Math.PI * 2;
    for (var i = 0; i < 14; i++) {
        var a    = dir + (Math.random() - 0.5) * Math.PI * 1.4;
        var dist = 25 + Math.random() * 80;
        var size = 2 + Math.random() * 5;
        var x = cx + Math.cos(a) * dist;
        var y = cy + Math.sin(a) * dist;
        // 拉長的火花：往外方向稍微拖尾
        var g = ctx.createRadialGradient(x, y, 0, x, y, size * 2);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, size * 2, 0, Math.PI * 2);
        ctx.fill();
    }
    return this._makeTex(canvas, true);
};

// ═══════════════════════════════════════════════════════════════════════════════
// Entity 結構：每個 vfx 有 4 個通用圖層，按類型賦予不同貼圖與行為
//   layerFlash / layerMain / layerSub / layerSpark
// ═══════════════════════════════════════════════════════════════════════════════
CustomHitVfx.prototype._createVfxEntity = function(index) {
    var root = new pc.Entity('HitFx_' + index);
    var self = this;

    var makeLayer = function(name) {
        var ent = new pc.Entity(name);
        ent.addComponent('render', { type: 'plane' });
        ent.render.material = self.glowMaterial;   // 預設發光材質，需要時可換
        root.addChild(ent);
        return ent;
    };

    var flash = makeLayer('Flash');
    var main  = makeLayer('Main');   // 弧光 / 衝擊環 / 符文環
    var sub   = makeLayer('Sub');    // 第二道弧 / 放射線 / 內圈
    var spark = makeLayer('Spark');  // 火花碎屑

    root.enabled = false;
    this.app.root.addChild(root);

    return {
        root: root,
        flash: flash, flashMesh: flash.render.meshInstances[0],
        main:  main,  mainMesh:  main.render.meshInstances[0],
        sub:   sub,   subMesh:   sub.render.meshInstances[0],
        spark: spark, sparkMesh: spark.render.meshInstances[0],
        life: 0, maxLife: 0.4,
        type: 'slash',
        scaleMult: 1.0,
        rot: 0
    };
};

// ═══════════════════════════════════════════════════════════════════════════════
// 播放
//   playHit(pos, isHeavyHit, hitType, hitAngle)
//   hitType: 'slash' | 'blunt' | 'magic'（由 bulletManager 傳入；預設 slash）
// ═══════════════════════════════════════════════════════════════════════════════
CustomHitVfx.prototype.playHit = function(pos, isHeavyHit, hitType, hitAngle) {
    hitType = (hitType === 'slash' || hitType === 'magic') ? hitType : 'blunt';
    if (this._getTemplate(hitType) && this._playEntityHit(pos, isHeavyHit, hitType, hitAngle)) return;
    this._playProceduralHit(pos, isHeavyHit, hitType, hitAngle);
};

CustomHitVfx.prototype._pick = function(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
};

// ── 斬擊：弧光月牙為主角，閃光開場，少量火花 ────────────────────────────────
CustomHitVfx.prototype._setupSlash = function(vfx, heavy) {
    var arcCol   = heavy ? [1.0, 0.85, 0.5] : [0.85, 0.95, 1.0];   // 重擊偏金、普通偏冷白
    var flashCol = heavy ? [1.0, 0.7, 0.3]  : [0.9, 0.95, 1.0];

    vfx.flashMesh.setParameter('texture_opacityMap', this._flashTex);
    vfx.flashMesh.setParameter('material_emissive', flashCol);

    vfx.mainMesh.setParameter('texture_opacityMap', this._pick(this._arcTextures));
    vfx.mainMesh.setParameter('material_emissive', arcCol);

    vfx.subMesh.setParameter('texture_opacityMap', this._pick(this._arcTextures));
    vfx.subMesh.setParameter('material_emissive', arcCol);

    vfx.sparkMesh.setParameter('texture_opacityMap', this._pick(this._sparkTextures));
    vfx.sparkMesh.setParameter('material_emissive', arcCol);
};

// ── 打擊：強閃光 + 衝擊環 + 放射線，圓形對稱無方向 ──────────────────────────
CustomHitVfx.prototype._setupBlunt = function(vfx, heavy) {
    var col      = heavy ? [1.0, 0.9, 0.6] : [1.0, 1.0, 0.95];
    var flashCol = heavy ? [1.0, 0.85, 0.5] : [1.0, 1.0, 0.9];

    vfx.flashMesh.setParameter('texture_opacityMap', this._flashTex);
    vfx.flashMesh.setParameter('material_emissive', flashCol);

    vfx.mainMesh.setParameter('texture_opacityMap', this._ringTex);   // 衝擊環
    vfx.mainMesh.setParameter('material_emissive', col);

    vfx.subMesh.setParameter('texture_opacityMap', this._burstTex);   // 放射衝擊線
    vfx.subMesh.setParameter('material_emissive', col);

    vfx.sparkMesh.setParameter('texture_opacityMap', this._pick(this._sparkTextures));
    vfx.sparkMesh.setParameter('material_emissive', col);
};

// ── 魔法：柔光暈 + 符文環 + 彩色火花，發光感最強 ───────────────────────────
CustomHitVfx.prototype._setupMagic = function(vfx, heavy) {
    // 魔法用較飽和的顏色（這裡用紫/青，可依你的元素改）
    var col      = heavy ? [0.7, 0.4, 1.0] : [0.4, 0.8, 1.0];
    var flashCol = heavy ? [0.85, 0.6, 1.0] : [0.6, 0.9, 1.0];

    vfx.flashMesh.setParameter('texture_opacityMap', this._flashTex);
    vfx.flashMesh.setParameter('material_emissive', flashCol);

    vfx.mainMesh.setParameter('texture_opacityMap', this._runeTex);   // 符文環
    vfx.mainMesh.setParameter('material_emissive', col);

    vfx.subMesh.setParameter('texture_opacityMap', this._flashTex);   // 內層光暈
    vfx.subMesh.setParameter('material_emissive', flashCol);

    vfx.sparkMesh.setParameter('texture_opacityMap', this._pick(this._sparkTextures));
    vfx.sparkMesh.setParameter('material_emissive', col);
};

// ═══════════════════════════════════════════════════════════════════════════════
// 更新：依類型套用不同的時間曲線
// ═══════════════════════════════════════════════════════════════════════════════
CustomHitVfx.prototype._applyYawBillboard = function(vfx, camPos) {
    var pos = this._tempVfxPos.copy(vfx.root.getPosition());
    var dx = camPos.x - pos.x;
    var dz = camPos.z - pos.z;
    if (dx * dx + dz * dz < 0.0001) return;
    var yaw = Math.atan2(dx, dz) * pc.math.RAD_TO_DEG;
    vfx.root.setEulerAngles(0, yaw, 0);
};

CustomHitVfx.prototype.update = function(dt) {
    if (!this.camera) return;
    var camPos = this._tempCamPos.copy(this.camera.getPosition());

    for (var i = this.activeVfx.length - 1; i >= 0; i--) {
        var vfx = this.activeVfx[i];
        vfx.life += dt;

        if (vfx.life >= vfx.maxLife) {
            vfx.root.enabled = false;
            this.activeVfx.splice(i, 1);
            continue;
        }

        var p    = vfx.life / vfx.maxLife;
        var base = this.vfxScale * vfx.scaleMult;

        if (vfx.isEntity) {
            if (vfx.type !== 'slash') this._applyYawBillboard(vfx, camPos);
            continue;
        }

        this._applyYawBillboard(vfx, camPos);

        // 共用：開場閃光（所有類型都有，0~0.22 快出快收）
        this._updateFlash(vfx, p, base);

        if (vfx.type === 'slash') {
            this._updateSlash(vfx, p, base);
        } else if (vfx.type === 'blunt') {
            this._updateBlunt(vfx, p, base);
        } else {
            this._updateMagic(vfx, p, base);
        }
    }
};

// 共用閃光：開頭瞬間最大最亮，極速收縮淡出
CustomHitVfx.prototype._updateFlash = function(vfx, p, base) {
    var alpha = 0, scale = 0;
    var fadeT = 0.22;
    if (p < fadeT) {
        var fp = p / fadeT;
        alpha = 1.0 - fp * fp;
        scale = base * pc.math.lerp(1.5, 0.3, fp * fp);
    }
    vfx.flash.setLocalEulerAngles(90, 0, 0);
    vfx.flash.setLocalScale(scale, scale, 1);
    vfx.flashMesh.setParameter('material_opacity', alpha);
};

// 斬擊：弧光是主角，沿揮砍方向出現後快速淡出；第二道弧錯開角度
CustomHitVfx.prototype._updateSlash = function(vfx, p, base) {
    // 主弧：0.02 後出現，沿長度方向略微拉伸
    var arcA = p < 0.04 ? p / 0.04 : 1.0 - Math.pow((p - 0.04) / 0.96, 1.8);
    var sx = base * 1.3 * (1.0 + p * 0.15);
    var sy = base * 1.1;
    vfx.main.setLocalEulerAngles(90, 0, vfx.rot);
    vfx.main.setLocalScale(sx, sy, 1);
    vfx.mainMesh.setParameter('material_opacity', Math.max(0, arcA));

    // 副弧：稍晚、較淡、角度錯開，增加層次
    var subA = p < 0.08 ? 0 : Math.max(0, arcA * 0.6);
    vfx.sub.setLocalEulerAngles(90, 0, vfx.rot + 18);
    vfx.sub.setLocalScale(base * 1.0, base * 0.85, 1);
    vfx.subMesh.setParameter('material_opacity', subA);

    // 火花：斬擊後往外散
    this._updateSpark(vfx, p, base, 0.06, vfx.rot + 10);
};

// 打擊：閃光後衝擊環擴張 + 放射線爆開，對稱無方向
CustomHitVfx.prototype._updateBlunt = function(vfx, p, base) {
    // 衝擊環：快速擴張、邊擴邊淡
    var ringA = 0, ringS = 0;
    if (p < 0.65) {
        var rp = p / 0.65;
        ringA = 1.0 - rp * rp;
        ringS = base * (0.3 + 1.2 * Math.sin(rp * Math.PI * 0.5));
    }
    vfx.main.setLocalEulerAngles(90, 0, 0);
    vfx.main.setLocalScale(ringS, ringS, 1);
    vfx.mainMesh.setParameter('material_opacity', Math.max(0, ringA));

    // 放射衝擊線：開頭爆出，很快收掉（強調瞬間衝擊）
    var burstA = 0, burstS = 0;
    if (p < 0.3) {
        var bp = p / 0.3;
        burstA = 1.0 - bp;
        burstS = base * (0.8 + 0.6 * bp);
    }
    vfx.sub.setLocalEulerAngles(90, 0, vfx.rot);
    vfx.sub.setLocalScale(burstS, burstS, 1);
    vfx.subMesh.setParameter('material_opacity', Math.max(0, burstA));

    this._updateSpark(vfx, p, base, 0.04, vfx.rot);
};

// 魔法：符文環旋轉浮現 + 內層光暈脈動，發光感強
CustomHitVfx.prototype._updateMagic = function(vfx, p, base) {
    // 符文環：浮現後緩慢旋轉、略微擴張，淡出較慢（魔法餘韻）
    var runeA = p < 0.1 ? p / 0.1 : 1.0 - Math.pow((p - 0.1) / 0.9, 1.5);
    var runeS = base * (0.8 + p * 0.5);
    vfx.main.setLocalEulerAngles(90, 0, vfx.rot + p * 120);  // 邊旋轉
    vfx.main.setLocalScale(runeS, runeS, 1);
    vfx.mainMesh.setParameter('material_opacity', Math.max(0, runeA));

    // 內層光暈：脈動
    var glowA = (1.0 - p) * (0.6 + 0.4 * Math.sin(p * Math.PI * 3));
    var glowS = base * (0.6 + p * 0.8);
    vfx.sub.setLocalEulerAngles(90, 0, 0);
    vfx.sub.setLocalScale(glowS, glowS, 1);
    vfx.subMesh.setParameter('material_opacity', Math.max(0, glowA));

    this._updateSpark(vfx, p, base, 0.05, vfx.rot);
};

// 共用火花：指定起始時間後往外擴散淡出
CustomHitVfx.prototype._updateSpark = function(vfx, p, base, startT, rot) {
    var a = 0, s = 0;
    if (p > startT) {
        var sp = (p - startT) / (1 - startT);
        a = 1.0 - Math.pow(sp, 1.5);
        s = base * (0.5 + 0.6 * Math.sqrt(sp));
    }
    vfx.spark.setLocalEulerAngles(90, 0, rot);
    vfx.spark.setLocalScale(s, s, 1);
    vfx.sparkMesh.setParameter('material_opacity', Math.max(0, a));
};