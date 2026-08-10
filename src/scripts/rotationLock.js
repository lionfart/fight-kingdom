var RotationLock = pc.createScript('rotationLock');

// 開放屬性，讓你在編輯器可以微調血條的固定角度（預設為全平躺 0, 0, 0）
RotationLock.attributes.add('lockedAngles', { type: 'vec3', default: [0, 0, 0], title: 'Locked Angles' });

RotationLock.prototype.update = function(dt) {
    // 每一幀強制將自己的「世界坐標旋轉角度」重置為鎖定值
    // 這樣就能完全無視父節點 (角色) 的轉動
    this.entity.setEulerAngles(this.lockedAngles.x, this.lockedAngles.y, this.lockedAngles.z);
};