var WeaponTrail = pc.createScript('weaponTrail');

WeaponTrail.attributes.add('baseNode',  { type: 'entity', title: '主武器刀柄 (Base 1)' });
WeaponTrail.attributes.add('tipNode',   { type: 'entity', title: '主武器刀尖 (Tip 1)' });
WeaponTrail.attributes.add('baseNode2', { type: 'entity', title: '副武器刀柄 (Base 2)' });
WeaponTrail.attributes.add('tipNode2',  { type: 'entity', title: '副武器刀尖 (Tip 2)' });

WeaponTrail.attributes.add('trailColor',     { type: 'rgb', title: '刀光顏色（外暈）', default: [0.3, 0.6, 1.0] });
WeaponTrail.attributes.add('coreColor',      { type: 'rgb', title: '核心顏色（白熱）', default: [1.0, 1.0, 1.0] });
WeaponTrail.attributes.add('trailIntensity', { type: 'number', default: 2.0, title: '發光強度' });
WeaponTrail.attributes.add('widthScale',     { type: 'number', default: 0.6, title: '刀光寬度倍率 (越小越瘦)' });
WeaponTrail.attributes.add('coreWidth',      { type: 'number', default: 0.25, title: '白熱核心寬度 (0~1)' });
WeaponTrail.attributes.add('isAdditive',     { type: 'boolean', default: true, title: '使用疊加發光 (Additive)' });

WeaponTrail.attributes.add('smoothSegments', { type: 'number', default: 6, title: '弧線平滑段數 (越高越順)' });
WeaponTrail.attributes.add('tailSharpness',  { type: 'number', default: 3.0, title: '尾部收尖程度 (1=圓尾, 5=尖尾)' });
WeaponTrail.attributes.add('trailTexture',   { type: 'asset', assetType: 'texture', title: '紋理遮罩(選填，走 opacity R 通道)' });
WeaponTrail.attributes.add('alphaTest',      { type: 'number', default: 0.0, min: 0.0, max: 0.95, title: '硬邊切邊閾值 (0=關, 0.3~0.5=賽璐璐硬邊)' });

WeaponTrail.prototype.initialize = function () {
    this.isEmitting = false;
    this.trailLifetime = 0.15;

    this.weapons = [];
    if (this.baseNode && this.tipNode)   this.weapons.push({ base: this.baseNode,  tip: this.tipNode,  points: [] });
    if (this.baseNode2 && this.tipNode2) this.weapons.push({ base: this.baseNode2, tip: this.tipNode2, points: [] });

    // 🌟 Billboard：取得鏡頭，讓刀光寬度永遠面對鏡頭（解決某些揮舞角度 trail 塌掉看不見）
    this._camEntity = null;
    this._camRight = new pc.Vec3();
    this._camUp = new pc.Vec3();
    this._tmpDir = new pc.Vec3();

    this.material = new pc.StandardMaterial();
    this.material.useLighting = false;
    this.material.useSkybox = false;
    this.material.blendType = this.isAdditive ? pc.BLEND_ADDITIVEALPHA : pc.BLEND_NORMAL;
    this.material.depthWrite = false;
    this.material.depthTest = true;
    this.material.cull = pc.CULLFACE_NONE;

    // 🌟 紋理機制（新方案 / 取代舊的 emissiveMap 染色路線）
    //   ❌ 已棄用：emissiveMap = 圖 + emissive 染色。失敗原因：純色 emissive 會把灰階花紋乘掉，
    //              發光材質下明暗差肉眼分不出，三張圖看起來都一樣（連 emissive=1,1,1 都只剩純白）。
    //   ✅ 現行：花紋走 opacityMap 的「R(灰階)」通道 → 用「形狀/透明度」呈現差異
    //              (鱗片鏤空、飛白斷裂、白心輪廓)。顏色純靠單色 emissive 染，乾淨不過曝。
    //              不再使用 emissiveMap。
    this.material.vertexColors = true;          // 頂點色只走 alpha 做拖尾淡出
    this.material.diffuse = new pc.Color(0, 0, 0);
    this.material.emissive = new pc.Color(this.trailColor.r, this.trailColor.g, this.trailColor.b);
    this.material.emissiveIntensity = this.trailIntensity;
    // 透明度同時受「頂點色 alpha(拖尾淡出)」與「貼圖 opacityMap(形狀花紋)」相乘
    this.material.opacityVertexColor = true;
    this.material.opacityVertexColorChannel = 'a';
    if (this.alphaTest > 0) this.material.alphaTest = this.alphaTest;

    this.trailNode = new pc.GraphNode();
    this.mesh = new pc.Mesh(this.app.graphicsDevice);
    this.mesh.clear(true, false); // 動態 mesh
    this.meshInstance = new pc.MeshInstance(this.mesh, this.material, this.trailNode);

    var layer = this.app.scene.layers.getLayerById(pc.LAYERID_WORLD);
    layer.addMeshInstances([this.meshInstance]);
    this.app.root.addChild(this.trailNode);

    this._state = 'idle';
    this._waitTimer = 0;
    this._emitTimer = 0;

    this.entity.on('trail:play', this.play, this);
    this.entity.on('trail:interrupt', this.interrupt, this);

    // 🌟 縱向軟邊遮罩 (opacityMap)：沒填外部貼圖時，讓刀帶上下兩邊柔和淡出
    var fadeCanvas = document.createElement('canvas');
    fadeCanvas.width = 4; fadeCanvas.height = 128;
    var fadeCtx = fadeCanvas.getContext('2d');
    var grad = fadeCtx.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0.0,  'rgba(255,255,255,0.0)');
    grad.addColorStop(0.20, 'rgba(255,255,255,0.7)');
    grad.addColorStop(0.5,  'rgba(255,255,255,1.0)');
    grad.addColorStop(0.80, 'rgba(255,255,255,0.7)');
    grad.addColorStop(1.0,  'rgba(255,255,255,0.0)');
    fadeCtx.fillStyle = grad;
    fadeCtx.fillRect(0, 0, 4, 128);

    this._fadeTex = new pc.Texture(this.app.graphicsDevice, {
        format: pc.PIXELFORMAT_R8_G8_B8_A8, autoMipmap: false,
        addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE
    });
    this._fadeTex.setSource(fadeCanvas);

    if (this.trailTexture && this.trailTexture.resource) {
        // ✅ 新方案：圖只當形狀遮罩，讀「R(灰階)」通道。
        //    白(亮)=不透明，黑(暗)=透明 → 鱗片洞/飛白斷裂自然顯現。
        //    顏色完全由上面的單色 emissive(trailColor) 染，不碰 emissiveMap。
        this.material.emissiveMap = null;
        this.material.opacityMap = this.trailTexture.resource;
        this.material.opacityMapChannel = 'r';
    } else {
        // 沒圖：用程式生成的軟邊遮罩(它的細節在 alpha)
        this.material.emissiveMap = null;
        this.material.opacityMap = this._fadeTex;
        this.material.opacityMapChannel = 'a';
    }
    this.material.opacityMapUv = 0;

    this.material.update();




    this.on('destroy', function () {
        layer.removeMeshInstances([this.meshInstance]);
        this.trailNode.destroy();
        this.mesh.destroy();
        if (this._fadeTex) this._fadeTex.destroy();
    }, this);

    this.on('disable', function () {
        this.interrupt();
        this._clearAllPoints();
        this.meshInstance.visible = false;
        if (this.mesh && this.mesh.vertexBuffer) this.mesh.clear(true, false);
    }, this);
};

WeaponTrail.prototype._clearAllPoints = function () {
    for (var w = 0; w < this.weapons.length; w++) this.weapons[w].points = [];
};

WeaponTrail.prototype.play = function (atkConf) {
    atkConf = atkConf || {};
    if (atkConf.useTrail === false) return;

    // 🌟 職責拆分：trailDuration = 殘影壽命(尾巴長度)，trailEmitTime = 取樣窗口(對齊揮砍動作)
    this.trailLifetime = atkConf.trailDuration !== undefined ? atkConf.trailDuration : 0.12;
    this._waitTimer = atkConf.trailDelay !== undefined ? atkConf.trailDelay : 0;
    this._emitTimer = atkConf.trailEmitTime !== undefined
        ? atkConf.trailEmitTime
        : (atkConf.fireDelay || 0) + this.trailLifetime - this._waitTimer; // 沒填時维持舊行為

    if (this._waitTimer > 0) {
        this._state = 'waiting';
    } else {
        this._state = 'emitting';
        this.startTrail();
    }
};

WeaponTrail.prototype.interrupt = function () {
    this._state = 'idle';
    this.stopTrail();
};

WeaponTrail.prototype.startTrail = function () {
    this._clearAllPoints();
    if (this.mesh && this.mesh.vertexBuffer) this.mesh.clear(true, false);
    this.isEmitting = true;
};

WeaponTrail.prototype.stopTrail = function () {
    this.isEmitting = false;
};

WeaponTrail.prototype.update = function (dt) {
    if (this._state === 'waiting') {
        this._waitTimer -= dt;
        if (this._waitTimer <= 0) { this._state = 'emitting'; this.startTrail(); }
    } else if (this._state === 'emitting') {
        this._emitTimer -= dt;
        if (this._emitTimer <= 0) { this._state = 'idle'; this.stopTrail(); }
    }

    var totalPoints = 0;

    for (var w = 0; w < this.weapons.length; w++) {
        var weapon = this.weapons[w];
        var pts = weapon.points;

        for (var i = pts.length - 1; i >= 0; i--) {
            pts[i].age += dt;
            if (pts[i].age > this.trailLifetime) pts.splice(i, 1);
        }

        if (this.isEmitting) {
            var newBase = weapon.base.getPosition();
            var shouldAdd = true;

            if (pts.length > 0) {
                var last = pts[pts.length - 1];
                var dx = newBase.x - last.basePos.x;
                var dy = newBase.y - last.basePos.y;
                var dz = newBase.z - last.basePos.z;
                // 門檻略放寬，過密的點對 Catmull-Rom 無益且耗效能
                if ((dx * dx + dy * dy + dz * dz) < 0.0009) shouldAdd = false;
            }

            if (shouldAdd) {
                pts.push({
                    basePos: newBase.clone(),
                    tipPos: weapon.tip.getPosition().clone(),
                    age: 0
                });
            }
        }
        totalPoints += pts.length;
    }

    if (totalPoints >= 2) {
        this.meshInstance.visible = true;
        this.rebuildMesh();
    } else {
        this.meshInstance.visible = false;
        if (this.mesh && this.mesh.vertexBuffer) this.mesh.clear(true, false);
    }
};

// Catmull-Rom 插值（向量），用於補幀讓弧線平滑
WeaponTrail._catmull = function (p0, p1, p2, p3, t, out) {
    var t2 = t * t, t3 = t2 * t;
    out.x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
    out.y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
    out.z = 0.5 * ((2 * p1.z) + (-p0.z + p2.z) * t +
        (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 +
        (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3);
    return out;
};

WeaponTrail.prototype._getCamera = function() {
    if (this._camEntity && this._camEntity.camera) return this._camEntity;
    var cam = this.app.root.findByName('Camera');
    if (!cam || !cam.camera) {
        var cams = this.app.root.findComponents('camera');
        if (cams && cams.length > 0) cam = cams[0].entity;
    }
    this._camEntity = cam;
    return cam;
};

WeaponTrail.prototype.rebuildMesh = function () {
    var validTrails = [];
    for (var w = 0; w < this.weapons.length; w++) {
        if (this.weapons[w].points.length >= 2) validTrails.push(this.weapons[w].points);
    }
    if (validTrails.length === 0) {
        if (this.meshInstance) this.meshInstance.visible = false;  // 🌟 加這行
        if (this.mesh.vertexBuffer) this.mesh.clear(true, false);
        return;
    }

    var seg = Math.max(1, Math.floor(this.smoothSegments));
    var coreW = pc.math.clamp(this.coreWidth, 0.02, 0.95);

    // 🌟 Billboard：取得鏡頭的 right / up 向量（鏡頭只有俯角不旋轉，向量穩定）
    // 刀光寬度將沿鏡頭 right 展開，永遠面對鏡頭，不會因揮舞角度而塌掉
    var cam = this._getCamera();
    var useBillboard = false;
    if (cam) {
        // 取鏡頭視線方向(forward)。寬度 = forward × 軌跡方向 的外積，
        // 這樣寬度「垂直於軌跡」又「面對鏡頭」，旋轉任何角度都不會塌。
        this._camFwd = this._camFwd || new pc.Vec3();
        this._camFwd.copy(cam.forward);
        this._camFwd.normalize();
        useBillboard = true;
    }

    // 動態收集
    var positions = [];
    var uvs = [];
    var colors = [];
    var indices = [];
    var vStart = 0;
    var tmpA = new pc.Vec3(), tmpB = new pc.Vec3();

    for (var t = 0; t < validTrails.length; t++) {
        var pts = validTrails[t];
        var n = pts.length;

        // 先把每個原始採樣展開成「平滑後的脊線陣列」
        // ribs: [{ base, tip, ageRatio }]
        var ribs = [];
        for (var i = 0; i < n - 1; i++) {
            var b0 = pts[Math.max(0, i - 1)];
            var b1 = pts[i];
            var b2 = pts[i + 1];
            var b3 = pts[Math.min(n - 1, i + 2)];

            var steps = (i === n - 2) ? seg : seg; // 每段都補 seg 份
            for (var s = 0; s < steps; s++) {
                var localT = s / steps;
                var basePos = WeaponTrail._catmull(b0.basePos, b1.basePos, b2.basePos, b3.basePos, localT, new pc.Vec3());
                var tipPos  = WeaponTrail._catmull(b0.tipPos,  b1.tipPos,  b2.tipPos,  b3.tipPos,  localT, new pc.Vec3());
                var ageRatio = pc.math.lerp(b1.age, b2.age, localT) / this.trailLifetime;
                ribs.push({ base: basePos, tip: tipPos, ageRatio: ageRatio });
            }
        }
        // 補最後一根脊
        ribs.push({ base: pts[n - 1].basePos.clone(), tip: pts[n - 1].tipPos.clone(), ageRatio: pts[n - 1].age / this.trailLifetime });

        var m = ribs.length;
        if (m < 2) continue;

        for (var k = 0; k < m; k++) {
            var rib = ribs[k];
            var ar = pc.math.clamp(rib.ageRatio, 0, 1);

            // 🌟 新月形寬度：頭端快速張開、整體飽滿、尾端可調收尖
            var headFromNewest = k / (m - 1);
            var headFactor = Math.pow(pc.math.clamp(headFromNewest * 4.0, 0, 1), 0.6); // 最新3~4根快速張開
            // tailSharpness 越大，尾端收得越快越尖；用 (1-headFromNewest) 當尾端進度
            var tailProgress = 1.0 - headFromNewest;             // 0=刀鋒, 1=最尾
            var tailFactor = Math.pow(1.0 - tailProgress, this.tailSharpness * 0.5);
            var shrink = Math.max(0.0, tailFactor) * Math.max(0.02, headFactor) * this.widthScale;

            // 整體沿弧線的透明度（拖尾淡出）
            // ⚠️ 這個 alpha 會跟 opacityMap(貼圖細絲) 相乘。若淡出太陡，貼圖的飛白絲會被壓成一片。
            //    所以用較平緩的曲線 + 一個下限(floor)，讓中段仍保留貼圖細節，只有最尾端才真正消失。
            var fade = 1.0 - Math.pow(ar, 1.6);          // 比原本(0.8)更平緩，中段更亮
            var alpha = 0.25 + 0.75 * pc.math.clamp(fade, 0, 1); // floor 0.25：中段不被洗白
            // 最尾端(ar→1)強制收到 0，確保拖尾還是會消失
            alpha *= pc.math.clamp((1.0 - ar) * 3.0, 0.0, 1.0);
            alpha *= pc.math.clamp(headFromNewest * 6.0, 0.0, 1.0); // 刀鋒前緣稍微淡入

            var midX = (rib.base.x + rib.tip.x) * 0.5;
            var midY = (rib.base.y + rib.tip.y) * 0.5;
            var midZ = (rib.base.z + rib.tip.z) * 0.5;

            var bX, bY, bZ, tX, tY, tZ;

            if (useBillboard) {
                // 🌟 正確 Billboard：寬度方向 = 鏡頭視線(forward) × 軌跡行進方向
                //    → 寬度永遠「垂直於軌跡」(不會平行塌掉) 且「面對鏡頭」
                // 軌跡方向：用相鄰 rib 的中點差(端點用單側)
                var nbr = (k < m - 1) ? ribs[k + 1] : ribs[k - 1];
                var sign = (k < m - 1) ? 1 : -1;
                var nbrMidX = (nbr.base.x + nbr.tip.x) * 0.5;
                var nbrMidY = (nbr.base.y + nbr.tip.y) * 0.5;
                var nbrMidZ = (nbr.base.z + nbr.tip.z) * 0.5;
                var dirX = (nbrMidX - midX) * sign;
                var dirY = (nbrMidY - midY) * sign;
                var dirZ = (nbrMidZ - midZ) * sign;
                // 正規化軌跡方向
                var dlen = Math.sqrt(dirX*dirX + dirY*dirY + dirZ*dirZ);
                if (dlen > 0.00001) { dirX/=dlen; dirY/=dlen; dirZ/=dlen; }

                // 外積 widthDir = forward × dir
                var fwd = this._camFwd;
                var wx = fwd.y * dirZ - fwd.z * dirY;
                var wy = fwd.z * dirX - fwd.x * dirZ;
                var wz = fwd.x * dirY - fwd.y * dirX;
                var wlen = Math.sqrt(wx*wx + wy*wy + wz*wz);
                if (wlen > 0.00001) { wx/=wlen; wy/=wlen; wz/=wlen; }
                else { wx = 1; wy = 0; wz = 0; } // 退化保護

                // 寬度大小 = base→tip 距離(保留武器長度) × shrink
                var dxw = rib.tip.x - rib.base.x;
                var dyw = rib.tip.y - rib.base.y;
                var dzw = rib.tip.z - rib.base.z;
                var halfW = Math.sqrt(dxw*dxw + dyw*dyw + dzw*dzw) * 0.5 * shrink;

                bX = midX - wx * halfW; bY = midY - wy * halfW; bZ = midZ - wz * halfW;
                tX = midX + wx * halfW; tY = midY + wy * halfW; tZ = midZ + wz * halfW;
            } else {
                // 後備：找不到鏡頭時，沿用原本 base→tip 展開
                bX = midX + (rib.base.x - midX) * shrink;
                bY = midY + (rib.base.y - midY) * shrink;
                bZ = midZ + (rib.base.z - midZ) * shrink;
                tX = midX + (rib.tip.x - midX) * shrink;
                tY = midY + (rib.tip.y - midY) * shrink;
                tZ = midZ + (rib.tip.z - midZ) * shrink;
            }

            // 每根脊線 4 個頂點：base邊緣 / 核心下 / 核心上 / tip邊緣
            // 用 coreW 把中間做成白熱核心，外側為帶色外暈
            var cb = 0.5 - coreW * 0.5; // 核心下界 (0~1)
            var ct = 0.5 + coreW * 0.5; // 核心上界

            function lerpP(x0, y0, z0, x1, y1, z1, f, arr) {
                arr[0] = x0 + (x1 - x0) * f;
                arr[1] = y0 + (y1 - y0) * f;
                arr[2] = z0 + (z1 - z0) * f;
            }
            var p = [0, 0, 0];

            // 4 條沿寬度的取樣比例
            var fracs = [0.0, cb, ct, 1.0];
            for (var f = 0; f < 4; f++) {
                lerpP(bX, bY, bZ, tX, tY, tZ, fracs[f], p);
                positions.push(p[0], p[1], p[2]);

                // U 沿刀身長度(脊線進度)鋪開，V 沿寬度
                // emissiveMap 用 V 取顏色(外暈→核心→外暈)，opacityMap 用 V 做軟邊
                var u = k / (m - 1);
                uvs.push(u, fracs[f]);

                // 顏色由 emissiveMap 決定，頂點色 RGB 留白，只用 alpha 控拖尾淡出
                colors.push(1, 1, 1, alpha);
            }
        }

        // 生成索引：每根脊 4 點 → 與下一根組 3 個四邊形(6 三角)
        for (var k2 = 0; k2 < m - 1; k2++) {
            var a = vStart + k2 * 4;
            var bIdx = vStart + (k2 + 1) * 4;
            for (var q = 0; q < 3; q++) {
                indices.push(a + q, a + q + 1, bIdx + q);
                indices.push(a + q + 1, bIdx + q + 1, bIdx + q);
            }
        }
        vStart += m * 4;
    }

    if (positions.length === 0) {
        // 先關可見再清 buffer，避免渲染器拿到沒有 vertex_position 的空 buffer 報錯
        if (this.meshInstance) this.meshInstance.visible = false;
        if (this.mesh.vertexBuffer) this.mesh.clear(true, false);
        return;
    }

    this.mesh.clear(true, false);
    this.mesh.setPositions(positions);
    this.mesh.setUvs(0, uvs);
    this.mesh.setColors(colors);
    this.mesh.setIndices(indices);
    this.mesh.update(pc.PRIMITIVE_TRIANGLES);
    if (this.meshInstance) this.meshInstance.visible = true;
};