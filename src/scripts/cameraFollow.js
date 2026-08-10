var CameraFollow = pc.createScript('cameraFollow');

// ==========================================
// 1. Editor 可見設定 (全面開放數值調整)
// ==========================================
CameraFollow.attributes.add('startMode', { 
    type: 'string', 
    default: 'ActionRPG', 
    title: '遊戲開始預設模式',
    description: '名稱必須與下方清單中的 modeName 一致'
});

CameraFollow.attributes.add('smoothSpeed', { type: 'number', default: 12, title: '移動平滑速度' });
CameraFollow.attributes.add('transitionSpeed', { type: 'number', default: 5, title: '模式切換平滑速度' });

// 🌟 核心升級：JSON 陣列屬性，讓你在 Editor 自由增刪改模式
CameraFollow.attributes.add('modeSettings', {
    type: 'json',
    title: '鏡頭模式參數清單',
    schema: [
        { name: 'modeName', type: 'string', title: '模式名稱', default: 'NewMode' },
        { name: 'height', type: 'number', title: '基礎高度', default: 12.0 },
        { name: 'offsetZ', type: 'number', title: 'Z軸後退', default: 8.0 },
        { name: 'lookAngle', type: 'number', title: '俯視角度', default: -45.0 },
        { name: 'landscapeFov', type: 'number', title: '橫向 FOV', default: 50.0 },
        { name: 'portraitFov', type: 'number', title: '直向 FOV', default: 60.0 },
        { name: 'dynHeight', type: 'number', title: '向下看: 高度增加', default: 1.0 },
        { name: 'dynAngle', type: 'number', title: '向下看: 角度變化', default: -4.0 },
        { name: 'dynOffsetZ', type: 'number', title: '向下看: Z軸後退', default: -1.0 },
        { name: 'ptHeightMult', type: 'number', title: '手機版: 高度拉遠倍率', default: 1.2 },
        { name: 'ptOffsetMult', type: 'number', title: '手機版: Z軸拉遠倍率', default: 1.1 }
    ],
    array: true,
    // 預設給予四種模式，Parse 後就會出現在 Editor 裡
    default: [
        // 1. 中距離動作 (最佳化平衡，預留翻滾與看見 AOE 紅圈的空間)
        { modeName: 'ActionRPG', height: 11.5, offsetZ: 8.5, lookAngle: -43.0, landscapeFov: 50.0, portraitFov: 65.0, dynHeight: 1.5, dynAngle: -6.0, dynOffsetZ: -1.0, ptHeightMult: 1.2, ptOffsetMult: 1.15, lookAheadMax: 5.0 }, 
        
        // 2. 近戰迫力 (比原本稍微拉高與加寬，確保左右不會被偷襲)
        { modeName: 'WhiteCat', height: 7.5, offsetZ: 7.0, lookAngle: -35.0, landscapeFov: 50.0, portraitFov: 60.0, dynHeight: 1.0, dynAngle: -4.0, dynOffsetZ: -0.5, ptHeightMult: 1.15, ptOffsetMult: 1.1, lookAheadMax: 3.0 },
        
        // 3. 遠距射擊 (高度大幅拉伸，防止被畫面外的遠程攻擊狙擊)
        { modeName: 'BrawlStars', height: 16.0, offsetZ: 10.0, lookAngle: -52.0, landscapeFov: 50.0, portraitFov: 66.0, dynHeight: 2.0, dynAngle: -8.0, dynOffsetZ: -1.5, ptHeightMult: 1.25, ptOffsetMult: 1.2, lookAheadMax: 5.5 },
        
        // 4. 上帝戰術 (略降高度、略增 offset，角色可讀性與俯瞰感平衡)
        { modeName: 'MOBA', height: 22.0, offsetZ: 7.5, lookAngle: -65.0, landscapeFov: 55.0, portraitFov: 72.0, dynHeight: 0.5, dynAngle: -2.0, dynOffsetZ: -0.5, ptHeightMult: 1.15, ptOffsetMult: 1.1, lookAheadMax: 2.5 }
    ]
});

CameraFollow.attributes.add('introFrontHeight', { type: 'number', default: 2.8, title: '開場正面鏡頭高度' });
CameraFollow.attributes.add('introFrontDistance', { type: 'number', default: 3.2, title: '開場正面距離（離角色多遠）' });
CameraFollow.attributes.add('introFrontAimHeight', { type: 'number', default: 1.75, title: '開場正面注視高度（臉部）' });
CameraFollow.attributes.add('introFrontFov', { type: 'number', default: 36, title: '開場正面 FOV' });
CameraFollow.attributes.add('introPullHeight', { type: 'number', default: 6.2, title: '開場拉遠高度' });
CameraFollow.attributes.add('introPullDistance', { type: 'number', default: 5.5, title: '開場拉遠距離' });
CameraFollow.attributes.add('introPullAimHeight', { type: 'number', default: 1.45, title: '開場拉遠注視高度' });
// 舊欄位保留相容（若 Editor 仍有值會當距離後備）
CameraFollow.attributes.add('introFrontOffsetZ', { type: 'number', default: 3.2, title: '[舊] 開場正面 Z 偏移' });
CameraFollow.attributes.add('introFrontAngle', { type: 'number', default: 8, title: '[舊] 開場正面俯角' });
CameraFollow.attributes.add('introPullOffsetZ', { type: 'number', default: 5.5, title: '[舊] 開場拉遠 Z 偏移' });
CameraFollow.attributes.add('introPullAngle', { type: 'number', default: -28, title: '[舊] 開場拉遠俯角' });


CameraFollow.prototype.initialize = function () {
    this.target = null;
    this.camera = this.entity.camera;
    this.isPortrait = false;
    this._wasInIntro = false;
    
    // 預分配變數，減少 GC 壓力
    this._currentAimOffset = new pc.Vec3(0, 0, 0);
    this._tempTargetPos = new pc.Vec3();
    this._targetAimOffset = new pc.Vec3();
    this._cleanCamPos = new pc.Vec3();

    this._introStartPos = new pc.Vec3(0, 26, 0);       
    this._introStartRot = new pc.Vec3(-80, 0, 0);
    this._introCamScratch = { x: 0, y: 0, z: 0, aimX: 0, aimY: 1.75, aimZ: 0, pitch: 0, useGameplayRot: false, fov: 50 };

    this._dynamicBoundsCalculated = false;
    this._camBounds = { minX: -11.5, maxX: 11.5, minZ: -10.0, maxZ: 10.0 };
    this._mapCenter = new pc.Vec3(0, 0, 0); 

    // ==========================================
    // 2. 將 Editor 的陣列資料轉換為易讀的字典
    // ==========================================
    this._modeConfigs = {};
    this.modesList = []; 
    
    for (var i = 0; i < this.modeSettings.length; i++) {
        var setting = this.modeSettings[i];
        this._modeConfigs[setting.modeName] = setting;
        this.modesList.push(setting.modeName);
    }

    // 防呆：如果清單是空的，或是預設名稱打錯，給予安全設定
    // 🌟 優先讀玩家記住的視角選擇；沒有才用 Editor 預設 startMode
    var savedMode = null;
    try { savedMode = localStorage.getItem('fk_camera_mode'); } catch (e) {}
    this.cameraMode = (savedMode && this._modeConfigs[savedMode]) ? savedMode : this.startMode;
    if (!this._modeConfigs[this.cameraMode] && this.modesList.length > 0) {
        this.cameraMode = this.modesList[0];
    }
    this._currentConfig = this._modeConfigs[this.cameraMode];
    
    // 初始化目標數值
    this._targetHeight = this._currentConfig.height;
    this._targetOffsetZ = this._currentConfig.offsetZ;
    this._targetLookAngle = this._currentConfig.lookAngle;
    this._targetFov = this._currentConfig.landscapeFov; 

    this._activeHeight = this._targetHeight;
    this._activeOffsetZ = this._targetOffsetZ;
    this._currentLookAngle = this._targetLookAngle;
    
    this._offsetSmoothness = 4.0;
    this._applyModeBehaviorFromConfig(this._currentConfig);

    // 🌟 相機切換已移至遊戲內 Settings menu（gameSettings），不再建右上角按鈕
    this.app.cameraFollow = this;

    this.app.on('singleplayer:playerCreated', this._onPlayerCreated, this);
    this.app.on('camera:startIntro', this.snapIntroCamera, this);
    this.app.on('camera:setMode', this.setCameraMode, this); 
    this.app.on('camera:cycleMode', this.cycleCameraMode, this);   // 🌟 後備事件
    this.app.graphicsDevice.on('resizecanvas', this._onResize, this);
    this._onResize();

    this.on('destroy', function() {
        this.app.off('singleplayer:playerCreated', this._onPlayerCreated, this);
        this.app.off('camera:startIntro', this.snapIntroCamera, this);
        this.app.off('camera:setMode', this.setCameraMode, this);
        this.app.off('camera:cycleMode', this.cycleCameraMode, this);
        this.app.graphicsDevice.off('resizecanvas', this._onResize, this);
        if (this.btn && this.btn.parentNode) this.btn.parentNode.removeChild(this.btn);
    }, this);
};

// ==========================================
// 🌟 相機模式循環切換（由 gameSettings 的 VIEW ANGLE 呼叫）
// ==========================================
CameraFollow.prototype._applyModeBehaviorFromConfig = function(cfg) {
    cfg = cfg || this._currentConfig;
    if (!cfg) return;
    this._lookAheadMax = (cfg.lookAheadMax !== undefined && cfg.lookAheadMax > 0) ? cfg.lookAheadMax : 4.0;
};

CameraFollow.prototype.cycleCameraMode = function() {
    if (!this.modesList || this.modesList.length === 0) return;
    var currentIdx = this.modesList.indexOf(this.cameraMode);
    if (currentIdx === -1) currentIdx = 0;
    currentIdx = (currentIdx + 1) % this.modesList.length;
    var nextMode = this.modesList[currentIdx];
    this.setCameraMode(nextMode);
    return nextMode;
};

CameraFollow.prototype._calculateDynamicBounds = function() {
    if (this._dynamicBoundsCalculated) return;
    var gm = this.app.gameModeManager;
    if (!gm) return;

    if (gm.mapMinX !== undefined && gm.mapMaxX !== undefined) {
        this._camBounds.minX = gm.mapMinX;
        this._camBounds.maxX = gm.mapMaxX;
        this._camBounds.minZ = gm.mapMinZ;
        this._camBounds.maxZ = gm.mapMaxZ;
        this._mapCenter.set(gm.mapCenterX || 0, 0, gm.mapCenterZ || 0);
    } else {
        return;
    }

    this._introStartPos.set(this._mapCenter.x, 26, this._mapCenter.z);
    this._dynamicBoundsCalculated = true;
};

CameraFollow.prototype._smoothstep = function(t) {
    t = pc.math.clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
};

CameraFollow.prototype._getTargetFacingYaw = function() {
    if (!this.target) return 0;
    var pCtrl = this.app.playerController;
    if (pCtrl && pCtrl.player === this.target && pCtrl._facingAngle !== undefined) {
        return pCtrl._facingAngle;
    }
    return this.target.getEulerAngles().y;
};

// 鏡頭放在角色「面向的前方」，再 lookAt 回臉部（與 gameplay 鏡頭在後方對稱）
CameraFollow.prototype._applyIntroCamera = function(cam) {
    this.entity.setPosition(cam.x, cam.y, cam.z);
    if (cam.useGameplayRot) {
        this.entity.setEulerAngles(cam.pitch, 0, 0);
    } else {
        this.entity.lookAt(cam.aimX, cam.aimY, cam.aimZ);
    }
    if (this.camera) this.camera.fov = cam.fov;
};

CameraFollow.prototype._introFrontDistance = function() {
    var d = this.introFrontDistance;
    if (d === undefined || d <= 0) d = Math.abs(this.introFrontOffsetZ || 3.2);
    return Math.max(1.5, d);
};

CameraFollow.prototype._introPullDistance = function() {
    var d = this.introPullDistance;
    if (d === undefined || d <= 0) d = Math.abs(this.introPullOffsetZ || 5.5);
    return Math.max(2.0, d);
};

// 開場三階段：正面特寫（依面向 + lookAt 臉部）→ 微拉遠 → 遊戲視角
CameraFollow.prototype._computeIntroCamera = function(elapsed, pPos, out) {
    out = out || this._introCamScratch;
    var facingYaw = this._getTargetFacingYaw() * (Math.PI / 180);
    var faceX = Math.sin(facingYaw);
    var faceZ = Math.cos(facingYaw);
    var frontDist = this._introFrontDistance();
    var pullDist = this._introPullDistance();
    var frontAimY = (this.introFrontAimHeight !== undefined) ? this.introFrontAimHeight : 1.75;
    var pullAimY = (this.introPullAimHeight !== undefined) ? this.introPullAimHeight : 1.45;
    var frontH = this.introFrontHeight;
    var pullH = this.introPullHeight;
    var drift = Math.sin(elapsed * 1.15) * 0.08;

    var frontCamX = pPos.x + faceX * frontDist + (-faceZ) * drift;
    var frontCamZ = pPos.z + faceZ * frontDist + faceX * drift;
    var pullCamX = pPos.x + faceX * pullDist;
    var pullCamZ = pPos.z + faceZ * pullDist;

    var aimX = pPos.x;
    var aimZ = pPos.z;

    if (elapsed < 1.3) {
        out.x = frontCamX;
        out.y = frontH;
        out.z = frontCamZ;
        out.aimX = aimX;
        out.aimY = frontAimY;
        out.aimZ = aimZ;
        out.useGameplayRot = false;
        out.fov = this.introFrontFov;
    } else if (elapsed < 2.5) {
        var t = this._smoothstep((elapsed - 1.3) / 1.2);
        out.x = pc.math.lerp(frontCamX, pullCamX, t);
        out.y = pc.math.lerp(frontH, pullH, t);
        out.z = pc.math.lerp(frontCamZ, pullCamZ, t);
        out.aimX = aimX;
        out.aimY = pc.math.lerp(frontAimY, pullAimY, t);
        out.aimZ = aimZ;
        out.useGameplayRot = false;
        out.fov = pc.math.lerp(this.introFrontFov, this._targetFov, t * 0.35);
    } else {
        var t2 = this._smoothstep((elapsed - 2.5) / 0.9);
        var gx = pPos.x;
        var gy = this._targetHeight;
        var gz = pPos.z + this._targetOffsetZ;
        out.x = pc.math.lerp(pullCamX, gx, t2);
        out.y = pc.math.lerp(pullH, gy, t2);
        out.z = pc.math.lerp(pullCamZ, gz, t2);
        out.aimX = aimX;
        out.aimY = pc.math.lerp(pullAimY, 1.0, t2);
        out.aimZ = aimZ;
        out.useGameplayRot = t2 > 0.65;
        out.pitch = this._targetLookAngle;
        out.fov = pc.math.lerp(this.introFrontFov, this._targetFov, t2);
    }
    return out;
};

CameraFollow.prototype.snapIntroCamera = function() {
    if (!this.target) return;
    var gmm = this.app.gameModeManager;
    var introDur = (typeof GameModeManager !== 'undefined' && GameModeManager.INTRO_DURATION)
        ? GameModeManager.INTRO_DURATION : 4.5;
    var elapsed = gmm ? (introDur - gmm._introTimer) : 0;
    var pPos = this.target.getPosition();
    var cam = this._computeIntroCamera(Math.max(0, elapsed), pPos);
    this._applyIntroCamera(cam);
    this._activeHeight = this._targetHeight;
    this._activeOffsetZ = this._targetOffsetZ;
    this._currentLookAngle = this._targetLookAngle;
};

CameraFollow.prototype.retargetPlayer = function(entity) {
    if (!entity) return;
    this.target = entity;
};

CameraFollow.prototype.snapToPlayer = function(entity) {
    if (!entity) return;
    this.target = entity;

    // 以當前 camera mode（含直橫屏倍率）的目標參數對齊，而非固定標準視角
    this._activeHeight = this._targetHeight;
    this._activeOffsetZ = this._targetOffsetZ;
    this._currentLookAngle = this._targetLookAngle;
    if (this.camera) this.camera.fov = this._targetFov;

    if (this.app.gameState === 'intro' || this.app.gameState === 'promo') {
        if (this.app.gameState === 'intro') this.snapIntroCamera();
        return;
    }

    var startPos = entity.getPosition();
    this.entity.setPosition(startPos.x, this._activeHeight, startPos.z + this._activeOffsetZ);
    this.entity.setEulerAngles(this._currentLookAngle, 0, 0);
};

CameraFollow.prototype._onPlayerCreated = function(entity, options) {
    options = options || {};
    if (options.isTransform) this.retargetPlayer(entity);
    else this.snapToPlayer(entity);
};

CameraFollow.prototype.setCameraMode = function(modeName) {
    if (this._modeConfigs[modeName]) {
        this.cameraMode = modeName;
        this._currentConfig = this._modeConfigs[modeName];
        this._onResize(); 
        console.log("📷 已切換鏡頭模式至:", modeName);
        // 🌟 記住玩家的視角選擇（game 前 game 中皆然，下次進來沿用）
        try { localStorage.setItem('fk_camera_mode', modeName); } catch (e) {}
    } else {
        console.warn('Camera mode not found:', modeName);
    }
};

CameraFollow.prototype._onResize = function() {
    if (!this.camera) return;
    var width = this.app.graphicsDevice.width;
    var height = this.app.graphicsDevice.height;
    var aspect = width / height;

    var cfg = this._currentConfig;

    if (aspect < 1.0) {
        this.isPortrait = true;
        this._targetFov = cfg.portraitFov;
        this.camera.horizontalFov = false; 
        this._targetHeight = cfg.height * (cfg.ptHeightMult !== undefined ? cfg.ptHeightMult : 1.0); 
        this._targetOffsetZ = cfg.offsetZ * (cfg.ptOffsetMult !== undefined ? cfg.ptOffsetMult : 1.0);
    } else {
        this.isPortrait = false;
        this._targetFov = cfg.landscapeFov;
        this.camera.horizontalFov = false;
        this._targetHeight = cfg.height;
        this._targetOffsetZ = cfg.offsetZ;
    }
    
    this._targetLookAngle = cfg.lookAngle;
    this._applyModeBehaviorFromConfig(cfg);

    if (!this.target) {
        this._activeHeight = this._targetHeight;
        this._activeOffsetZ = this._targetOffsetZ;
        this._currentLookAngle = this._targetLookAngle;
        if (this.camera) this.camera.fov = this._targetFov;
    }
};

/** 扣掉 cameraShake 上一幀 offset，避免 follow lerp 吃進震動位移 */
CameraFollow.prototype._readCleanCamPos = function() {
    if (!this._cleanCamPos) this._cleanCamPos = new pc.Vec3();
    this._cleanCamPos.copy(this.entity.getPosition());
    var shake = this.app.cameraShake;
    if (shake && shake.getOffset) {
        var o = shake.getOffset();
        this._cleanCamPos.x -= o.x;
        this._cleanCamPos.y -= o.y;
        this._cleanCamPos.z -= o.z;
    }
    return this._cleanCamPos;
};

CameraFollow.prototype._clampCameraPosition = function(desiredX, desiredZ) {
    var bounds = this._camBounds;
    var camMinX = bounds.minX + 1.0;
    var camMaxX = bounds.maxX - 1.0;
    var camMinZ = bounds.minZ + 2.0;
    var camMaxZ = bounds.maxZ + this._activeOffsetZ;

    if (camMinX > camMaxX) { var midX = (camMinX + camMaxX) / 2; camMinX = midX; camMaxX = midX; }
    if (camMinZ > camMaxZ) { var midZ = (camMinZ + camMaxZ) / 2; camMinZ = midZ; camMaxZ = midZ; }

    return {
        x: pc.math.clamp(desiredX, camMinX, camMaxX),
        z: pc.math.clamp(desiredZ, camMinZ, camMaxZ)
    };
};

CameraFollow.prototype.update = function (dt) {
    this._calculateDynamicBounds();

    // 宣傳拍攝鏡頭由 promoDirector 每幀套用
    if (this.app.gameState === 'promo') {
        this._wasInIntro = true;
        return;
    }

    if (this.app.gameState === 'intro') {
        var gmmIntro = this.app.gameModeManager;
        if (gmmIntro) {
            var introDur = (typeof GameModeManager !== 'undefined' && GameModeManager.INTRO_DURATION)
                ? GameModeManager.INTRO_DURATION : 4.5;
            var elapsedIntro = introDur - gmmIntro._introTimer;
            var pPosIntro = this.target ? this.target.getPosition() : this._mapCenter;
            var camIntro = this._computeIntroCamera(Math.max(0, elapsedIntro), pPosIntro);
            this._applyIntroCamera(camIntro);
        }
        this._wasInIntro = true;
        return;
    }

    var transitionFactor = 1.0 - Math.exp(-this.transitionSpeed * dt);
    this._activeHeight = pc.math.lerp(this._activeHeight, this._targetHeight, transitionFactor);
    this._activeOffsetZ = pc.math.lerp(this._activeOffsetZ, this._targetOffsetZ, transitionFactor);
    if (this.camera) this.camera.fov = pc.math.lerp(this.camera.fov, this._targetFov, transitionFactor);

    if (!this.target) return;
    var pController = this.app.playerController || (this.target.script ? this.target.script.playerController : null);
    var input = this.app.inputManager;

    if (pController && pController.isDead) {
        var currentPos = this._readCleanCamPos();
        var targetX = currentPos.x;
        var targetZ = currentPos.z;

        var spectatorPos = null;
        if (pController._getSpectatorTarget) {
            spectatorPos = pController._getSpectatorTarget();
        }

        if (spectatorPos) {
            targetX = spectatorPos.x;
            targetZ = spectatorPos.z + this._activeOffsetZ;
        } else {
            var moveX = input ? input.moveX : 0;
            var moveZ = input ? input.moveZ : 0;
            targetX = currentPos.x + moveX * 15.0 * dt;
            targetZ = currentPos.z + moveZ * 15.0 * dt;
        }

        var clamped = this._clampCameraPosition(targetX, targetZ);
        var camFactor = 1.0 - Math.exp(-this.smoothSpeed * dt);
        this.entity.setPosition(
            pc.math.lerp(currentPos.x, clamped.x, camFactor),
            pc.math.lerp(currentPos.y, this._activeHeight, camFactor),
            pc.math.lerp(currentPos.z, clamped.z, camFactor)
        );
        this.entity.setEulerAngles(this._targetLookAngle, 0, 0);
        return;
    }

    if (!this.target.enabled) return;
    if (this._wasInIntro) {
        var pSnap = this.target.getPosition();
        this.entity.setPosition(pSnap.x, this._activeHeight, pSnap.z + this._activeOffsetZ);
        this.entity.setEulerAngles(this._targetLookAngle, 0, 0);
        if (this.camera) this.camera.fov = this._targetFov;
        this._currentAimOffset.set(0, 0, 0);
        this._wasInIntro = false;
    }
    
    this._tempTargetPos.copy(this.target.getPosition()); 
    var currentPos = this._readCleanCamPos();
    this._targetAimOffset.set(0, 0, 0);

    if (input) {
        if (input.isAiming && input.aimDistance > 0.2) {
            var strength = pc.math.clamp((input.aimDistance - 0.2) / 0.8, 0, 1);
            strength = strength * strength; 
            this._targetAimOffset.x = Math.sin(input.aimAngle) * this._lookAheadMax * strength;
            this._targetAimOffset.z = Math.cos(input.aimAngle) * this._lookAheadMax * strength;
        } 
        else {
            var moveMag = Math.sqrt(input.moveX * input.moveX + input.moveZ * input.moveZ);
            if (moveMag > 0.3) { 
                var normX = input.moveX / moveMag;
                var normZ = input.moveZ / moveMag;
                var moveStrength = pc.math.clamp((moveMag - 0.3) / 0.7, 0, 1);
                moveStrength = moveStrength * moveStrength; 
                this._targetAimOffset.x = normX * (this._lookAheadMax * 0.6) * moveStrength;
                this._targetAimOffset.z = normZ * (this._lookAheadMax * 0.6) * moveStrength;
            }
        }
    }

    if (this._targetAimOffset.z > 0) this._targetAimOffset.z *= 1.6; 
    else if (this._targetAimOffset.z < 0) this._targetAimOffset.z *= 0.6; 

    var aimFactor = 1.0 - Math.exp(-this._offsetSmoothness * dt);
    this._currentAimOffset.x = pc.math.lerp(this._currentAimOffset.x, this._targetAimOffset.x, aimFactor);
    this._currentAimOffset.z = pc.math.lerp(this._currentAimOffset.z, this._targetAimOffset.z, aimFactor);

    this._tempTargetPos.x += this._currentAimOffset.x;
    this._tempTargetPos.z += this._currentAimOffset.z;

    var aimMag = Math.sqrt(
        this._currentAimOffset.x * this._currentAimOffset.x +
        this._currentAimOffset.z * this._currentAimOffset.z
    );
    var maxAimMag = this._lookAheadMax * 1.6;
    var downRatio = maxAimMag > 0 ? pc.math.clamp(aimMag / maxAimMag, 0, 1) : 0;
    
    var cfg = this._currentConfig;
    var finalHeight = pc.math.lerp(this._activeHeight, this._activeHeight + (cfg.dynHeight || 0), downRatio);
    var finalLookAngle = pc.math.lerp(this._targetLookAngle, this._targetLookAngle + (cfg.dynAngle || 0), downRatio);
    var finalOffsetZ = pc.math.lerp(this._activeOffsetZ, this._activeOffsetZ + (cfg.dynOffsetZ || 0), downRatio);

    var desiredX = this._tempTargetPos.x;
    var desiredZ = this._tempTargetPos.z + finalOffsetZ;

    var finalClamped = this._clampCameraPosition(desiredX, desiredZ);

    var camFactorUpdate = 1.0 - Math.exp(-this.smoothSpeed * dt);
    this.entity.setPosition(
        pc.math.lerp(currentPos.x, finalClamped.x, camFactorUpdate),
        pc.math.lerp(currentPos.y, finalHeight, camFactorUpdate),
        pc.math.lerp(currentPos.z, finalClamped.z, camFactorUpdate)
    );
    
    var angleFactor = 1.0 - Math.exp(-this.transitionSpeed * dt);
    this._currentLookAngle = pc.math.lerp(this._currentLookAngle, finalLookAngle, angleFactor);
    this.entity.setEulerAngles(this._currentLookAngle, 0, 0);
};