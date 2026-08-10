var ToonShader = pc.createScript('toonShader');

// ==========================================
// 🛠️ 卡通渲染與防破圖描邊設定 (最終藝術控制版)
// ==========================================
ToonShader.attributes.add('outlineColor', { type: 'rgb', default: [0, 0, 0], title: 'Outline Color' });
ToonShader.attributes.add('outlineThickness', { type: 'number', default: 0.015, title: 'Thickness (實體厚度)' }); 
// 🗑️ 原本這裡有 depthBias 這個 attribute,已移除:現在 outline 的 depth bias 邏輯改寫死在 setupOutlineMaterial()
// 用 slopeDepthBias(-1)取代,原本的 depthBias 數值在 WebGPU 下會被截斷成 0,是死欄位,詳見 setupOutlineMaterial 裡的註解

// 🎨 光影與色彩控制
ToonShader.attributes.add('vibranceFactor', { type: 'number', default: 1.4, title: 'Vibrance (整體鮮豔度)' }); 
ToonShader.attributes.add('shadowBrightness', { type: 'number', default: 0.3, min: 0.0, max: 1.0, step: 0.01, title: 'Shadow Brightness (陰影亮度)' }); 
ToonShader.attributes.add('colorTint', { type: 'rgb', default: [1, 1, 1], title: 'Color Tint (整體疊加調色)' }); 
ToonShader.attributes.add('brightnessBoost', { type: 'number', default: 0.0, title: 'Emissive Boost (發光增幅)' }); 

// 🧪 WebGPU 噪點排查用暫時開關 (確認兇手後可整段刪除)
ToonShader.attributes.add('debugDisableOutline', { type: 'boolean', default: false, title: 'DEBUG: 停用 Outline (排查用)' });
ToonShader.attributes.add('debugDisableToonChunk', { type: 'boolean', default: false, title: 'DEBUG: 停用 Toon 光影 Chunk (排查用)' });
ToonShader.attributes.add('debugForceFlatToonValue', { type: 'boolean', default: false, title: 'DEBUG: Toon Chunk 換成寫死常數 (排查用)' });

ToonShader.prototype.initialize = function() {
    this._clonedMaterials = [];
    this._processedComponents = []; 
    
    // 綁定動態更新
    this.on('attr:vibranceFactor', this.updateUniforms, this);
    this.on('attr:shadowBrightness', this.updateUniforms, this);
    this.on('attr:outlineThickness', this.updateUniforms, this);
    this.on('attr:colorTint', this.updateMaterials, this);
    this.on('attr:outlineColor', this.updateMaterials, this);
    this.on('attr:brightnessBoost', this.updateMaterials, this); 
    this.customToonChunk = `
    uniform float uVibranceFactor;
    uniform float uShadowBrightness;

    float getLightDiffuse(vec3 worldNormal, vec3 viewDir, vec3 lightDir) {
        vec3 N = normalize(worldNormal);
        float NdotL = dot(N, lightDir);
        float lightIntensity = NdotL * 0.5 + 0.5;

        float toonStep = smoothstep(0.37, 0.46, lightIntensity) * 0.35 +
                         smoothstep(0.65, 0.68, lightIntensity) * 0.35 + uShadowBrightness;

        toonStep *= uVibranceFactor;
        toonStep = clamp(toonStep, 0.0, 1.0);
        return toonStep;
    }
`;

    // 🔧 WGSL 版本(WebGPU 用):語法依 playcanvas/engine 原始碼確認(uniform 宣告/uniform.xxx 取值語法、getLightDiffuse 簽名)
    // 公式刻意維持跟上面 GLSL 版本完全一致(未取負號),對齊目前 WebGL 下已經正確的視覺結果
    this.customToonChunkWGSL = `
uniform uVibranceFactor: f32;
uniform uShadowBrightness: f32;

fn getLightDiffuse(worldNormal: vec3f, viewDir: vec3f, lightDir: vec3f) -> f32 {
    let N = normalize(worldNormal);
    let NdotL = dot(N, lightDir);
    let lightIntensity = NdotL * 0.5 + 0.5;

    var toonStep = smoothstep(0.37, 0.46, lightIntensity) * 0.35 +
                     smoothstep(0.65, 0.68, lightIntensity) * 0.35 + uniform.uShadowBrightness;

    toonStep = toonStep * uniform.uVibranceFactor;
    toonStep = clamp(toonStep, 0.0, 1.0);
    return toonStep;
}
`;

    // 🧪 排查用:完全不依賴 uniform、寫死回傳值的版本(用來排除 uniform 綁定造成噪點的可能)
    this.customToonChunkFlatGLSL = `
    float getLightDiffuse(vec3 worldNormal, vec3 viewDir, vec3 lightDir) {
        return 0.7;
    }
`;
    this.customToonChunkFlatWGSL = `
fn getLightDiffuse(worldNormal: vec3f, viewDir: vec3f, lightDir: vec3f) -> f32 {
    return 0.7;
}
`;
                                                                                                                                                                                                         
    // 🧪 排查用:在 WebGPU 下印出 engine 內建的 WGSL 版 lightDiffuseLambertPS,作為改寫覆寫版本的參考範本
    if (this.app.graphicsDevice.isWebGPU) {
        try {
            var wgslChunks = pc.ShaderChunks.get(this.app.graphicsDevice, pc.SHADERLANGUAGE_WGSL);
           
        } catch (e) {

        }
    }

    if (!this.debugDisableOutline) {
        this.setupOutlineMaterial();
    }
    this.initialScan(); 
};

ToonShader.prototype.initialScan = function() {
    var renders = this.entity.findComponents("render");
    var models = this.entity.findComponents("model");
    
    var processComp = function(comp) {
        var ent = comp.entity;
        if (ent.name === "ToonOutline_Generated") return;
        
        if (comp.meshInstances) {
            for (var i = 0; i < comp.meshInstances.length; i++) {
                var meshInst = comp.meshInstances[i];
                var origMat = meshInst.material;
                
                if (origMat && !origMat.isToonModified && origMat !== this.outlineMaterial) {
    var toonMat = origMat.clone();

    // 🧪 排查用:勾選後跳過 chunk 覆寫,材質退回 engine 預設光影(其餘色彩/去高光邏輯照跑)
    if (!this.debugDisableToonChunk) {
        toonMat.shaderChunksVersion = "2.16";
        if (this.debugForceFlatToonValue) {
            // 🧪 排查用:寫死常數,完全不讀任何 uniform
            toonMat.getShaderChunks(pc.SHADERLANGUAGE_GLSL).set('lightDiffuseLambertPS', this.customToonChunkFlatGLSL);
            toonMat.getShaderChunks(pc.SHADERLANGUAGE_WGSL).set('lightDiffuseLambertPS', this.customToonChunkFlatWGSL);
        } else {
            toonMat.getShaderChunks(pc.SHADERLANGUAGE_GLSL).set('lightDiffuseLambertPS', this.customToonChunk);
            // 🔧 補上 WGSL 版本:避免 WebGPU 下因為只有 GLSL override 而觸發不穩定的自動轉譯路徑(engine useWGSL 判斷邏輯)
            toonMat.getShaderChunks(pc.SHADERLANGUAGE_WGSL).set('lightDiffuseLambertPS', this.customToonChunkWGSL);
        }
    }

    toonMat.ambient = new pc.Color(0.2, 0.2, 0.2);

    // 🎯 色彩控制：暫存原本的 Diffuse 色彩
    toonMat._baseDiffuse = origMat.diffuse.clone();
    toonMat.diffuse = new pc.Color(
        toonMat._baseDiffuse.r * this.colorTint.r,
        toonMat._baseDiffuse.g * this.colorTint.g,
        toonMat._baseDiffuse.b * this.colorTint.b
    );

    // 發光貼圖保護機制
    toonMat._baseEmissive = origMat.emissive.clone();
    var boost = this.brightnessBoost;
    toonMat.emissive = new pc.Color(
        toonMat._baseEmissive.r + boost,
        toonMat._baseEmissive.g + boost,
        toonMat._baseEmissive.b + boost
    );

    // ==========================================
    // 🚫 徹底拔除高光 / 反光 (防止表面隨機光點)
    // ==========================================
    // 1. 切回非金屬路徑，否則 metalness 模式下 specular 數值無效
    toonMat.useMetalness = false;

    // 2. 歸零數值並鎖定 (specularTint 確保用純黑而非貼圖)
    toonMat.specular = new pc.Color(0, 0, 0);
    toonMat.specularTint = true;
    toonMat.shininess = 0;
    toonMat.metalness = 0;

    // 3. 清除會餵回反光值的貼圖
    toonMat.specularMap = null;
    toonMat.glossMap = null;
    toonMat.metalnessMap = null;

    // 4. 關閉環境反射 (skybox / cubemap / sphereMap)
    toonMat.useSkybox = false;
    toonMat.reflectivity = 0;
    toonMat.cubeMap = null;
    toonMat.sphereMap = null;

    // 綁定光影 Uniforms
    toonMat.setParameter('uVibranceFactor', this.vibranceFactor);
    toonMat.setParameter('uShadowBrightness', this.shadowBrightness);

    toonMat.clearVariants();
    toonMat.update();
    toonMat.isToonModified = true;
    meshInst.material = toonMat;

    this._clonedMaterials.push(toonMat);
}
            }
        }
        
        // 🧪 排查用:勾選後完全跳過 outline 生成(不建立 entity,不套用 outlineMaterial 的 vertex shader hack)
        if (this.debugDisableOutline) return;

        var outlineChild = ent.findByName("ToonOutline_Generated");
        if (!outlineChild) outlineChild = this.createOutline(comp, ent);
        
        if (outlineChild) {
            this._processedComponents.push({ source: comp, outlineEntity: outlineChild });
        }
    }.bind(this);

    for (var i = 0; i < renders.length; i++) processComp(renders[i]);
    for (var i = 0; i < models.length; i++) processComp(models[i]);
};

ToonShader.prototype.postUpdate = function(dt) {
    for (var i = 0; i < this._processedComponents.length; i++) {
        var data = this._processedComponents[i];
        var sourceComp = data.source;
        var outlineEnt = data.outlineEntity;
        
        var isActive = sourceComp.enabled && this.isEntityActive(sourceComp.entity);
        
        if (isActive) {
            if (!outlineEnt.enabled) outlineEnt.enabled = true; 
            this.syncSkin(sourceComp, outlineEnt);
        } else {
            if (outlineEnt.enabled) outlineEnt.enabled = false;
        }
    }
};

ToonShader.prototype.createOutline = function(sourceComp, parentEnt) {
    if (!sourceComp.meshInstances || sourceComp.meshInstances.length === 0) return null;
    
    var outlines = [];
    for (var i = 0; i < sourceComp.meshInstances.length; i++) {
        var origMesh = sourceComp.meshInstances[i];
        var outlineMesh = new pc.MeshInstance(origMesh.mesh, this.outlineMaterial, origMesh.node);
        if (origMesh.skinInstance) outlineMesh.skinInstance = origMesh.skinInstance;
        outlines.push(outlineMesh);
    }
    
    var outlineEntity = new pc.Entity("ToonOutline_Generated");
    parentEnt.addChild(outlineEntity);
    outlineEntity.addComponent("render", { 
        meshInstances: outlines,
        castShadows: false,    // 關閉投射陰影
        receiveShadows: false  // 關閉接收陰影
    });
    return outlineEntity;
};

ToonShader.prototype.syncSkin = function(sourceComp, outlineChild) {
    var sourceMeshes = sourceComp.meshInstances;
    var outlineRender = outlineChild.render || outlineChild.model;
    if (!outlineRender || !sourceMeshes) return;
    
    var outlineMeshes = outlineRender.meshInstances;
    if (!outlineMeshes || sourceMeshes.length !== outlineMeshes.length) return;
    
    for (var i = 0; i < sourceMeshes.length; i++) {
        if (sourceMeshes[i].skinInstance !== outlineMeshes[i].skinInstance) {
            outlineMeshes[i].skinInstance = sourceMeshes[i].skinInstance;
        }
    }
};

ToonShader.prototype.isEntityActive = function(entity) {
    var curr = entity;
    while (curr) {
        if (!curr.enabled) return false;
        curr = curr.parent;
    }
    return true;
};

ToonShader.prototype.setupOutlineMaterial = function() {
    // ==========================================
    // 🔧 Outline 改用 pc.ShaderMaterial 自製 shader(GLSL + WGSL 各一份,手寫、不依賴 engine 內部 chunk 文字)
    // 好處:不會因為 engine 版本升級導致 chunk 內部實作改變而silently壞掉(這正是之前 outline 相關 bug 的根源)
    // 蒙皮(SKIN)矩陣計算邏輯是照 playcanvas/engine 2.21.3 原始碼(skin.js)手動抄一份,直接寫死在這裡,不用 #include
    // ==========================================

    var vertexGLSL = `
attribute vec4 vertex_position;
attribute vec3 vertex_normal;

uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;
uniform float uOutlineThickness;

#ifdef SKIN
attribute vec4 vertex_boneWeights;
attribute vec4 vertex_boneIndices;
uniform highp sampler2D texture_poseMap;

void getBoneMatrixRow(const in int width, const in int index, out vec4 v1, out vec4 v2, out vec4 v3) {
    int v = index / width;
    int u = index % width;
    v1 = texelFetch(texture_poseMap, ivec2(u + 0, v), 0);
    v2 = texelFetch(texture_poseMap, ivec2(u + 1, v), 0);
    v3 = texelFetch(texture_poseMap, ivec2(u + 2, v), 0);
}

mat4 getSkinMatrix(const in vec4 indicesFloat, const in vec4 weights) {
    int width = textureSize(texture_poseMap, 0).x;
    ivec4 indices = ivec4(indicesFloat + 0.5) * 3;

    vec4 a1, a2, a3; getBoneMatrixRow(width, indices.x, a1, a2, a3);
    vec4 b1, b2, b3; getBoneMatrixRow(width, indices.y, b1, b2, b3);
    vec4 c1, c2, c3; getBoneMatrixRow(width, indices.z, c1, c2, c3);
    vec4 d1, d2, d3; getBoneMatrixRow(width, indices.w, d1, d2, d3);

    vec4 v1 = a1 * weights.x + b1 * weights.y + c1 * weights.z + d1 * weights.w;
    vec4 v2 = a2 * weights.x + b2 * weights.y + c2 * weights.z + d2 * weights.w;
    vec4 v3 = a3 * weights.x + b3 * weights.y + c3 * weights.z + d3 * weights.w;
    float one = dot(weights, vec4(1.0));

    return mat4(
        v1.x, v2.x, v3.x, 0.0,
        v1.y, v2.y, v3.y, 0.0,
        v1.z, v2.z, v3.z, 0.0,
        v1.w, v2.w, v3.w, one
    );
}
#endif

void main(void) {
    vec3 localPos = vertex_position.xyz + vertex_normal * uOutlineThickness;

    #ifdef SKIN
        mat4 modelMatrix = matrix_model * getSkinMatrix(vertex_boneIndices, vertex_boneWeights);
    #else
        mat4 modelMatrix = matrix_model;
    #endif

    vec4 worldPos = modelMatrix * vec4(localPos, 1.0);
    gl_Position = matrix_viewProjection * worldPos;
}
`;

    var fragmentGLSL = `
uniform vec3 uOutlineColorParam;
void main(void) {
    gl_FragColor = vec4(uOutlineColorParam, 1.0);
}
`;

    var vertexWGSL = `
attribute vertex_position: vec4f;
attribute vertex_normal: vec3f;

uniform matrix_model: mat4x4f;
uniform matrix_viewProjection: mat4x4f;
uniform uOutlineThickness: f32;

#ifdef SKIN
attribute vertex_boneWeights: vec4f;
attribute vertex_boneIndices: vec4f;
var texture_poseMap: texture_2d<uff>;

struct BoneMatrixRow {
    v1: vec4f,
    v2: vec4f,
    v3: vec4f,
}

fn getBoneMatrixRow(width: i32, index: i32) -> BoneMatrixRow {
    let v = index / width;
    let u = index % width;
    var result: BoneMatrixRow;
    result.v1 = textureLoad(texture_poseMap, vec2i(u + 0, v), 0);
    result.v2 = textureLoad(texture_poseMap, vec2i(u + 1, v), 0);
    result.v3 = textureLoad(texture_poseMap, vec2i(u + 2, v), 0);
    return result;
}

fn getSkinMatrix(indicesFloat: vec4f, weights: vec4f) -> mat4x4f {
    let width = i32(textureDimensions(texture_poseMap).x);
    // 🔧 修正:vertex_boneIndices 宣告成 vec4f(跟 engine 內建 chunk 一致),
    // engine 會自動偵測底層真實格式(TYPE_UINT8)並產生轉換過的裸名稱私有變數(_pcCopyInputs 自動呼叫)
    // 所以這裡的 indicesFloat 拿到的已經是轉換好的 float,+0.5 四捨五入是必要的(避免 float 轉 int 精度誤差)
    let indices = vec4i(indicesFloat + 0.5) * 3;

    let boneA = getBoneMatrixRow(width, indices.x);
    let boneB = getBoneMatrixRow(width, indices.y);
    let boneC = getBoneMatrixRow(width, indices.z);
    let boneD = getBoneMatrixRow(width, indices.w);

    let v1 = boneA.v1 * weights.x + boneB.v1 * weights.y + boneC.v1 * weights.z + boneD.v1 * weights.w;
    let v2 = boneA.v2 * weights.x + boneB.v2 * weights.y + boneC.v2 * weights.z + boneD.v2 * weights.w;
    let v3 = boneA.v3 * weights.x + boneB.v3 * weights.y + boneC.v3 * weights.z + boneD.v3 * weights.w;
    let one = dot(weights, vec4f(1.0, 1.0, 1.0, 1.0));

    return mat4x4f(
        v1.x, v2.x, v3.x, 0.0,
        v1.y, v2.y, v3.y, 0.0,
        v1.z, v2.z, v3.z, 0.0,
        v1.w, v2.w, v3.w, one
    );
}
#endif

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    let localPos = vertex_position.xyz + vertex_normal * uniform.uOutlineThickness;

    #ifdef SKIN
        let modelMatrix = uniform.matrix_model * getSkinMatrix(vertex_boneIndices, vertex_boneWeights);
    #else
        let modelMatrix = uniform.matrix_model;
    #endif

    let worldPos = modelMatrix * vec4f(localPos, 1.0);
    output.position = uniform.matrix_viewProjection * worldPos;
    return output;
}
`;

    var fragmentWGSL = `
uniform uOutlineColorParam: vec3f;

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;
    output.color = vec4f(uniform.uOutlineColorParam, 1.0);
    return output;
}
`;

    this.outlineMaterial = new pc.ShaderMaterial({
        uniqueName: 'ToonOutlineShader',
        vertexGLSL: vertexGLSL,
        fragmentGLSL: fragmentGLSL,
        vertexWGSL: vertexWGSL,
        fragmentWGSL: fragmentWGSL,
        attributes: {
            vertex_position: pc.SEMANTIC_POSITION,
            vertex_normal: pc.SEMANTIC_NORMAL
        }
    });

    this.outlineMaterial.cull = pc.CULLFACE_FRONT;
    // 🔧 depthBias 修正:原本 this.depthBias (預設 -0.002) 在 WebGPU 下會被 truncate 成整數 0(GPUDepthBias 規格是 i32),等於沒作用;
    // 數值太小在 WebGL 下大概率也接近無效(engine doc 建議常見值是 -0.1 這個量級)。改用 slopeDepthBias 更符合 outline 用途(依三角形斜率決定 offset)。
    this.outlineMaterial.depthBias = 0;
    this.outlineMaterial.slopeDepthBias = -1;

    this.outlineMaterial.setParameter('uOutlineThickness', this.outlineThickness);
    this.outlineMaterial.setParameter('uOutlineColorParam', [this.outlineColor.r, this.outlineColor.g, this.outlineColor.b]);
    this.outlineMaterial.update();
};


ToonShader.prototype.updateUniforms = function() {
    if (this.outlineMaterial) {
        this.outlineMaterial.setParameter('uOutlineThickness', this.outlineThickness);
    }
    for (var i = 0; i < this._clonedMaterials.length; i++) {
        var mat = this._clonedMaterials[i];
        mat.setParameter('uVibranceFactor', this.vibranceFactor);
        mat.setParameter('uShadowBrightness', this.shadowBrightness);
    }
};

ToonShader.prototype.updateMaterials = function() {
    if (this.outlineMaterial) {
        this.outlineMaterial.setParameter('uOutlineColorParam', [this.outlineColor.r, this.outlineColor.g, this.outlineColor.b]);
        this.outlineMaterial.update();
    }
    for (var i = 0; i < this._clonedMaterials.length; i++) {
        var mat = this._clonedMaterials[i];
        
        // 🎯 動態更新 Diffuse 顏色疊加
        if (mat._baseDiffuse) {
            mat.diffuse = new pc.Color(
                mat._baseDiffuse.r * this.colorTint.r,
                mat._baseDiffuse.g * this.colorTint.g,
                mat._baseDiffuse.b * this.colorTint.b
            );
        }

        var boost = this.brightnessBoost;
        if (mat._baseEmissive) {
            mat.emissive = new pc.Color(
                mat._baseEmissive.r + boost, 
                mat._baseEmissive.g + boost, 
                mat._baseEmissive.b + boost
            );
        }
        mat.update();
    }
};

ToonShader.prototype.onDestroy = function() {
    for (var i = 0; i < this._processedComponents.length; i++) {
        var outlineEnt = this._processedComponents[i].outlineEntity;
        if (outlineEnt) outlineEnt.destroy();
    }
    this._processedComponents = [];

    for (var j = 0; j < this._clonedMaterials.length; j++) {
        if (this._clonedMaterials[j]) this._clonedMaterials[j].destroy();
    }
    this._clonedMaterials = [];

    if (this.outlineMaterial) {
        this.outlineMaterial.destroy();
        this.outlineMaterial = null;
    }
};