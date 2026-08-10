var YBillboard = pc.createScript('yBillboard');

YBillboard.attributes.add('cameraEntity', {
    type: 'entity',
    title: '鏡頭（空白則自動找 Camera）'
});

YBillboard.attributes.add('yawOffset', {
    type: 'number',
    default: 0,
    title: 'Yaw 補正（美術正面不對鏡頭時用 ±90 / 180）'
});

YBillboard.prototype.initialize = function () {
    this._cam = this.cameraEntity || null;
    this._tmpPos = new pc.Vec3();
    this._tmpCam = new pc.Vec3();
};

YBillboard.prototype._getCamera = function () {
    if (this._cam && this._cam.enabled) return this._cam;
    this._cam = this.app.root.findByName('Camera');
    return this._cam;
};

YBillboard.prototype.update = function (dt) {
    if (!this.entity.enabled) return;

    var cam = this._getCamera();
    if (!cam) return;

    this.entity.getPosition(this._tmpPos);
    cam.getPosition(this._tmpCam);

    var dx = this._tmpCam.x - this._tmpPos.x;
    var dz = this._tmpCam.z - this._tmpPos.z;
    if ((dx * dx + dz * dz) < 1e-8) return;

    // 1. 計算面對鏡頭所需的 Y 軸旋轉弧度 (Yaw)
    var angleRad = Math.atan2(dx, dz);
    var angleDeg = angleRad * pc.math.RAD_TO_DEG;

    // 2. 套用旋轉：X 軸維持你設定的傾斜角度（例如 -30），Y 軸面對鏡頭加上你的 Yaw 補正
    var targetX = -30; // 在這裡固定你覺得好看的 X 軸傾斜角（例如 -30 或 -29）
    var targetY = angleDeg + (this.yawOffset || 0);
    
    this.entity.setEulerAngles(targetX, targetY, 0);
};
