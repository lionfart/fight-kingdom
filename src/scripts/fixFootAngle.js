var FixFootAngle = pc.createScript('fixFootAngle');

FixFootAngle.attributes.add('leftBoneName', { type: 'string', default: 'LeftUpLeg', title: '左腿/腳骨骼名稱' });
FixFootAngle.attributes.add('rightBoneName', { type: 'string', default: 'RightUpLeg', title: '右腿/腳骨骼名稱' });
FixFootAngle.attributes.add('leftOffset', { type: 'vec3', default: [0, -15, 0], title: '左側修正角度 (X, Y, Z)' });
FixFootAngle.attributes.add('rightOffset', { type: 'vec3', default: [0, 15, 0], title: '右側修正角度 (X, Y, Z)' });

// 新增：設定 Anim State Graph 中的跑步 State 名稱
FixFootAngle.attributes.add('runStateName', { type: 'string', default: 'Run', title: '跑步 State 名稱' });

FixFootAngle.prototype.initialize = function() {
    this.leftBone = this.entity.findByName(this.leftBoneName);
    this.rightBone = this.entity.findByName(this.rightBoneName);
};

FixFootAngle.prototype.postUpdate = function(dt) {
    // 1. 檢查目前動畫是否為跑步狀態，若不是則直接跳出
    if (this.entity.anim && this.entity.anim.baseLayer) {
        if (this.entity.anim.baseLayer.activeState !== this.runStateName) {
            return;
        }
    }

    // 2. 僅在跑步時執行角度修正
    if (this.leftBone) {
        this.leftBone.rotateLocal(this.leftOffset.x, this.leftOffset.y, this.leftOffset.z);
    }
    if (this.rightBone) {
        this.rightBone.rotateLocal(this.rightOffset.x, this.rightOffset.y, this.rightOffset.z);
    }
};