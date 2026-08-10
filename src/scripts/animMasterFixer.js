var AnimMasterFixer = pc.createScript('animMasterFixer');

AnimMasterFixer.attributes.add('animEntity', { type: 'entity', title: 'Anim Entity (掛載模型的節點)' });
AnimMasterFixer.attributes.add('rootBoneName', { type: 'string', default: 'Hips', title: 'Root Bone Name' });
AnimMasterFixer.attributes.add('debugMode', { type: 'boolean', default: false, title: '開啟除錯訊息 (Console)' });

AnimMasterFixer.prototype.initialize = function() {
    this.rootBone = null;
    this.initialPos = new pc.Vec3();
    this.currentState = '';

    // 效能優化：預先建立變數
    this.identityQuat = new pc.Quat();
    this.tempQuat = new pc.Quat();
    this.currentOffsetQuat = new pc.Quat();
    this.tempVec = new pc.Vec3(); // 新增：用來運算修正後的位移向量

    // 【狀態設定字典】
    this.stateSettings = {
        'MAttack1': {
            boneRotOffset: new pc.Vec3(-90, 0, 0), 
            lockTranslation: true
        },
        'Midle': {
            boneRotOffset: new pc.Vec3(-90, 0, 0), 
            lockTranslation: true
        },
         'Mroll': {
            boneRotOffset: new pc.Vec3(-90, 0, 0),
            lockTranslation: true
        },
        'Mrun': {
            boneRotOffset: new pc.Vec3(-90, 0, 0),
            lockTranslation: true
        },
        'MAttack2': {
            boneRotOffset: new pc.Vec3(-90, 0, 0),
            lockTranslation: true
        },
         'MAttack3': {
            boneRotOffset: new pc.Vec3(-90, 0, 0),
            lockTranslation: true
        },
        'Special_Dash': {
            lockTranslation: false 
        },
        'ActorCore_Attack': {
            boneRotOffset: new pc.Vec3(0, 180, 0),
            lockTranslation: false 
        }
    };

    // 預先轉換四元數
    for (var key in this.stateSettings) {
        var settings = this.stateSettings[key];
        if (settings.boneRotOffset) {
            settings.quat = new pc.Quat().setFromEulerAngles(
                settings.boneRotOffset.x,
                settings.boneRotOffset.y,
                settings.boneRotOffset.z
            );
        } else {
            settings.quat = this.identityQuat.clone();
        }
    }
};

AnimMasterFixer.prototype.postUpdate = function(dt) {
    if (!this.animEntity || !this.animEntity.anim) return;

    if (!this.rootBone) {
        this.rootBone = this.animEntity.findByName(this.rootBoneName);
        if (this.rootBone) {
            this.initialPos.copy(this.rootBone.getLocalPosition());
        } else {
            return; 
        }
    }

    var layers = this.animEntity.anim.layers;
    var activeState = null;
    var previousState = null;
    var progress = 0;
    var isTransitioning = false;

    // 掃描狀態機
    for (var i = layers.length - 1; i >= 0; i--) {
        var layer = layers[i];
        if (this.stateSettings[layer.activeState] || (layer.transitioning && this.stateSettings[layer.previousState])) {
            activeState = layer.activeState;
            if (layer.transitioning) {
                isTransitioning = true;
                previousState = layer.previousState;
                progress = layer.transitionProgress;
            }
            break;
        }
    }

    if (!activeState) {
        var baseLayer = this.animEntity.anim.baseLayer;
        activeState = baseLayer.activeState;
        if (baseLayer.transitioning) {
            isTransitioning = true;
            previousState = baseLayer.previousState;
            progress = baseLayer.transitionProgress;
        }
    }

    if (activeState !== this.currentState) {
        this.currentState = activeState;
    }

    // 計算過渡旋轉
    var targetSettings = this.stateSettings[activeState];
    var targetQuat = (targetSettings && targetSettings.quat) ? targetSettings.quat : this.identityQuat;

    if (isTransitioning) {
        var prevSettings = this.stateSettings[previousState];
        var prevQuat = (prevSettings && prevSettings.quat) ? prevSettings.quat : this.identityQuat;
        this.currentOffsetQuat.slerp(prevQuat, targetQuat, progress);
    } else {
        this.currentOffsetQuat.copy(targetQuat);
    }

    // --------------------------------------------------------
    // 【核心修正 1：骨骼角度覆寫】
    var rawQuat = this.rootBone.getLocalRotation();
    this.tempQuat.copy(this.currentOffsetQuat).mul(rawQuat);
    this.rootBone.setLocalRotation(this.tempQuat);

    // 【核心修正 2：骨骼位移向量校正】
    var rawPos = this.rootBone.getLocalPosition();
    // 把讀取到的錯誤位移，也用同一個角度轉回來！
    this.currentOffsetQuat.transformVector(rawPos, this.tempVec);

    var shouldLock = true;
    if (targetSettings && targetSettings.lockTranslation === false) {
        shouldLock = false;
    }

    if (shouldLock) {
        // 鎖定 X/Z 位移，但高度 (Y) 使用我們「剛算出來的正確高度 (tempVec.y)」
        this.rootBone.setLocalPosition(this.initialPos.x, this.tempVec.y, this.initialPos.z);
    } else {
        // 放行位移，完全使用轉正後的座標
        this.rootBone.setLocalPosition(this.tempVec.x, this.tempVec.y, this.tempVec.z);
    }
    // --------------------------------------------------------
};