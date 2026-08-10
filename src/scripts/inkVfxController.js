var InkVfxController = pc.createScript('inkVfxController');

InkVfxController.attributes.add('stepDistance', {
    type: 'number',
    default: 1.2,
    title: '每隔多遠印一個墨跡'
});

InkVfxController.prototype.initialize = function () {
    // 預生成三種不同筆觸紋理（確定性種子，每次執行結果相同）
    this.strokeTextures = [
        this._generateSharpStrokeTexture(0),
        this._generateSharpStrokeTexture(1),
        this._generateSharpStrokeTexture(2)
    ];
    var swirlTex = this._generateSwirlTexture();

    // ==========================================
    // 🎨 建立印章池（12 個，三種紋理輪流分配）
    // ==========================================
    this.stepDecals = [];
    var POOL_SIZE = 12;
    for (var i = 0; i < POOL_SIZE; i++) {
        var decal = new pc.Entity('InkStepDecal_' + i);
        decal.addComponent('render', { type: 'plane' });

        var mat = new pc.StandardMaterial();
        mat.useLighting = false;
        mat.diffuse = new pc.Color(0.03, 0.03, 0.05);
        mat.opacityMap = this.strokeTextures[i % 3];
        mat.blendType = pc.BLEND_NORMAL;
        mat.depthWrite = false;
        mat.update();

        decal.render.material = mat;
        decal.enabled = false;
        this.app.root.addChild(decal);

        this.stepDecals.push({
            entity: decal,
            material: mat,
            life: 0,
            maxLife: 0.7,
            baseScaleX: 0.5,
            baseScaleZ: 0.5
        });
    }

    this.accumulatedDist = 0;
    this.footSide = 1;   // +1 右腳 / -1 左腳，每步交替
    this.lastSpeed = 0;

    // ==========================================
    // 🌪️ 翻滾爆發粒子系統（原樣保留）
    // ==========================================
    var alphaCurve = new pc.Curve([0, 1, 1, 0]);
    var rollScaleCurve = new pc.Curve([0, 1.0, 1, 2.5]);
    var rollVelocityCurve = new pc.Curve([0, 8, 1, 0]);

    this.rollEmitter = new pc.Entity('RollInkEmitter');
    this.entity.addChild(this.rollEmitter);
    this.rollEmitter.setLocalPosition(0, 0.5, 0);

    this.rollEmitter.addComponent('particlesystem', {
        numParticles: 6,
        lifetime: 0.3,
        rate: 0.01,
        colorMap: swirlTex,
        localSpace: false,
        loop: false,
        blendType: pc.BLEND_NORMAL,
        alphaGraph: alphaCurve,
        scaleGraph: rollScaleCurve,
        radialSpeedGraph: rollVelocityCurve,
        emitterShape: pc.EMITTERSHAPE_SPHERE,
        emitterRadius: 0.1
    });
    this.rollEmitter.particlesystem.stop();

    this.lastPos = this.entity.getPosition().clone();
    this.entity.on('action:roll', this.playRollVfx, this);
};

InkVfxController.prototype.update = function (dt) {
    var currentPos = this.entity.getPosition();
    var dx = currentPos.x - this.lastPos.x;
    var dz = currentPos.z - this.lastPos.z;
    var dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 0.01) {
        this.accumulatedDist += dist;
        this.lastSpeed = dist / Math.max(dt, 0.001);

        if (this.accumulatedDist >= this.stepDistance) {
            this.accumulatedDist = 0;
            this._stampFootprint(currentPos, dx, dz, this.lastSpeed);
        }
    } else {
        this.lastSpeed = 0;
    }

    // ==========================================
    // 三段式水墨動畫：滲透擴張 → 持色 → 漸隱消散
    // ==========================================
    for (var i = 0; i < this.stepDecals.length; i++) {
        var d = this.stepDecals[i];
        if (!d.entity.enabled) continue;

        d.life -= dt;
        if (d.life <= 0) {
            d.entity.enabled = false;
            continue;
        }

        // t：壽命進度 0（剛蓋下）→ 1（即將消失）
        var t = 1.0 - (d.life / d.maxLife);

        // ① 前 20%：擴張（模擬墨水滲入紙張）85% → 100% 大小
        var expandFactor = 0.85 + Math.min(t / 0.2, 1.0) * 0.15;

        // ② 前 40%：全不透明保持
        // ③ 後 60%：二次方曲線漸隱（比線性更自然，接近乾涸加速的感覺）
        var opacity;
        if (t < 0.4) {
            opacity = 1.0;
        } else {
            var fp = (t - 0.4) / 0.6;    // 0 → 1
            opacity = 1.0 - fp * fp;      // 二次方淡出
        }

        d.entity.setLocalScale(
            d.baseScaleX * expandFactor,
            1,
            d.baseScaleZ * expandFactor
        );
        d.material.opacity = Math.max(0, opacity);
        d.material.update();
    }

    this.lastPos.copy(currentPos);
};

// ==========================================
// 👣 蓋下步風墨跡印章
// ==========================================
InkVfxController.prototype._stampFootprint = function (pos, dx, dz, speed) {
    // 找空閒印章；全滿時驅逐壽命比例最低（最接近消失）的
    var decalObj = null;
    var minRatio = Infinity;
    for (var i = 0; i < this.stepDecals.length; i++) {
        var d = this.stepDecals[i];
        if (!d.entity.enabled) { decalObj = d; break; }
        var r = d.life / d.maxLife;
        if (r < minRatio) { minRatio = r; decalObj = d; }
    }
    if (!decalObj) return;

    var len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.0001) return;

    // 正規化移動向量，計算垂直方向（左右腳偏移用）
    var ndx = dx / len;
    var ndz = dz / len;
    var px = -ndz;                          // 垂直向量 X
    var pz = ndx;                           // 垂直向量 Z
    var side = this.footSide * 0.12;        // 約 12 cm 側偏
    this.footSide *= -1;                    // 下一步換腳

    // 速度越快：印章越大，且沿移動方向拉長（模擬快速行走的墨跡殘留）
    var sf = Math.min(speed / 8.0, 1.0);
    decalObj.baseScaleX = 0.25 + sf * 0.15;                    // 垂直寬度 0.25–0.40
    decalObj.baseScaleZ = decalObj.baseScaleX * (1.0 + sf);    // 移動方向長度 1x–2x

    // 隨機壽命 0.5–0.9 秒（讓各腳印殘留時間略有不同，避免整齊消失感）
    decalObj.maxLife = 0.5 + Math.random() * 0.4;
    decalObj.life    = decalObj.maxLife;

    // 位置：左右腳偏移 + 微量隨機抖動
    decalObj.entity.setPosition(
        pos.x + px * side + (Math.random() - 0.5) * 0.06,
        0.02,
        pos.z + pz * side + (Math.random() - 0.5) * 0.06
    );

    // 朝向移動方向，加上 ±15° 隨機偏轉（讓每步稍有差異，非機械重複）
    var angle = Math.atan2(dx, dz) * pc.math.RAD_TO_DEG;
    decalObj.entity.setEulerAngles(0, angle + 180 + (Math.random() - 0.5) * 30, 0);

    decalObj.material.opacity = 1.0;
    decalObj.material.update();
    decalObj.entity.enabled = true;
};

InkVfxController.prototype.playRollVfx = function () {
    if (this.rollEmitter && this.rollEmitter.particlesystem) {
        this.rollEmitter.particlesystem.reset();
        this.rollEmitter.particlesystem.play();
    }
};

// ==========================================
// 🎨 改進版筆觸紋理：三個變體各具特色
//    主墨滴橢圓 + 飛墨弧線 + 散落墨點
//    使用確定性種子隨機，遊戲每次執行外觀相同
// ==========================================
InkVfxController.prototype._generateSharpStrokeTexture = function (variant) {
    var canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 256);

    // Golden-ratio 推進的確定性偽隨機（基於 variant 起始種子）
    var rng = (function () {
        var s = variant * 0.5 + 0.1;
        return function () {
            s += 0.6180339887498949;
            var x = Math.sin(s * 12.9898 + 78.233) * 43758.5453;
            return x - Math.floor(x);  // 取小數部分 → [0, 1)
        };
    }());

    // ─── 主墨滴（橢圓漸層，三種變體形狀不同）──────────────────
    // v0: 短寬橢圓  v1: 中等  v2: 高窄橢圓
    var bH = 48 + variant * 10;      // 高度 48 / 58 / 68
    var bW = 28 - variant * 4;       // 寬度 28 / 24 / 20
    var cy = 128 + variant * 6;      // 中心略往下偏
    var g = ctx.createRadialGradient(128, cy - 10, 5, 128, cy, bH);
    g.addColorStop(0,    'rgba(255,255,255,1.0)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.80)');
    g.addColorStop(1.0,  'rgba(255,255,255,0.0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(128, cy, bW, bH, 0, 0, Math.PI * 2);
    ctx.fill();

    // ─── 飛墨筆觸（從墨滴往外的弧線，v0→3條 v1→4條 v2→5條）──
    ctx.lineCap = 'round';
    var ns = 3 + variant;
    for (var i = 0; i < ns; i++) {
        var sx  = 128 + (rng() - 0.5) * 45;
        var sy  = cy - bH * 0.4 + rng() * bH * 0.3;
        var ex  = 128 + (rng() - 0.5) * 110;
        var ey  = cy + bH * 0.5 + rng() * 65;
        var cpx = (sx + ex) / 2 + (rng() - 0.5) * 40;
        var cpy = (sy + ey) / 2 + (rng() - 0.5) * 30;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(cpx, cpy, ex, ey);
        ctx.lineWidth = 1.5 + rng() * 5;
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.3 + rng() * 0.55) + ')';
        ctx.stroke();
    }

    // ─── 散落墨點（v0→4個 v1→6個 v2→8個）──────────────────────
    var nd = 4 + variant * 2;
    for (var j = 0; j < nd; j++) {
        var dotX = 128 + (rng() - 0.5) * 140;
        var dotY = 55  + rng() * 160;
        var dotR = 1.0 + rng() * 4.5;
        ctx.beginPath();
        ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,' + (0.25 + rng() * 0.6) + ')';
        ctx.fill();
    }

    var tex = new pc.Texture(this.app.graphicsDevice, {
        width: 256, height: 256, format: pc.PIXELFORMAT_R8_G8_B8_A8
    });
    tex.setSource(canvas);
    return tex;
};

// ==========================================
// 🎨 翻滾狂草紋理（原樣保留）
// ==========================================
InkVfxController.prototype._generateSwirlTexture = function () {
    var canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 256);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineCap = 'round';
    ctx.filter = 'blur(0.5px)';
    for (var i = 0; i < 6; i++) {
        ctx.lineWidth = Math.random() * 12 + 5;
        ctx.beginPath();
        var startX = 128 + (Math.random() - 0.5) * 40;
        var startY = 50 + Math.random() * 40;
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(200, 128, 128 + (Math.random() - 0.5) * 60, 200 - Math.random() * 40);
        ctx.stroke();
    }
    var tex = new pc.Texture(this.app.graphicsDevice, {
        width: 256, height: 256, format: pc.PIXELFORMAT_R8_G8_B8_A8
    });
    tex.setSource(canvas);
    return tex;
};