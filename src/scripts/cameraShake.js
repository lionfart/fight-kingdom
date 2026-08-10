var CameraShake = pc.createScript('cameraShake');

// Trauma 模型：事件疊加 trauma（0–1），振幅 = trauma^指數 × maxPower
// 指數 1 = power≈世界單位振幅（相容既有 camera:shake 呼叫）；>1 則輕擊更弱、重擊更強
CameraShake.attributes.add('defaultPower', { type: 'number', default: 0.3, title: '預設震動強度' });
CameraShake.attributes.add('decayRate', { type: 'number', default: 1.5, title: 'Trauma 每秒衰減', description: '數值越大，震動停得越快' });
CameraShake.attributes.add('maxPower', { type: 'number', default: 0.8, title: '最大位移振幅', description: 'trauma=1 時的位移上限；也是 power→trauma 的換算基準' });
CameraShake.attributes.add('traumaExponent', { type: 'number', default: 1.0, title: 'Trauma 指數', description: '振幅 = trauma^指數 × maxPower；1=線性（power≈振幅），2=平方' });
CameraShake.attributes.add('horizontalScale', { type: 'number', default: 1.0, title: '水平晃動比例 (X/Z)' });
CameraShake.attributes.add('verticalScale', { type: 'number', default: 0.25, title: '垂直晃動比例 (Y)', description: '俯視角下建議偏小，減少暈眩' });
CameraShake.attributes.add('frequency', { type: 'number', default: 38.0, title: '晃動頻率', description: '數值越大抖得越快；太大會像亂跳' });

CameraShake.prototype.initialize = function() {
    this.trauma = 0;
    this.isShaking = false;
    this._shakeTime = 0;
    this._offset = new pc.Vec3(0, 0, 0);

    // 場景若仍存舊版指數衰減預設(~6)，改成線性 trauma 建議值
    if (this.decayRate >= 5) this.decayRate = 1.5;

    this._seedX = Math.random() * 100;
    this._seedY = Math.random() * 100;
    this._seedZ = Math.random() * 100;

    this.app.cameraShake = this;
    this.app.on('camera:shake', this.triggerShake, this);

    this.on('destroy', function() {
        this.app.off('camera:shake', this.triggerShake, this);
        if (this.app.cameraShake === this) this.app.cameraShake = null;
    }, this);
};

/** 上一幀套用的位移（供 cameraFollow 扣回，避免 follow 吃進震動） */
CameraShake.prototype.getOffset = function() {
    return this._offset;
};

CameraShake.prototype._safeMaxPower = function() {
    return this.maxPower > 0.0001 ? this.maxPower : 0.8;
};

CameraShake.prototype.triggerShake = function(power) {
    var p = (power === undefined || power === null) ? this.defaultPower : power;
    if (p < 0) p = 0;

    var maxP = this._safeMaxPower();
    // 相容既有 camera:shake(power)：power≈maxPower 時一次加滿 trauma
    this.trauma = Math.min(1, this.trauma + p / maxP);

    if (!this.isShaking) {
        this._shakeTime = 0;
        this._seedX = Math.random() * 100;
        this._seedY = Math.random() * 100;
        this._seedZ = Math.random() * 100;
    }
    this.isShaking = true;
};

// postUpdate：follow 寫完乾淨位置後，再相對加上本幀 offset（不鎖死 basePos）
CameraShake.prototype.postUpdate = function(dt) {
    if (!this.isShaking && this.trauma <= 0) {
        this._offset.x = 0;
        this._offset.y = 0;
        this._offset.z = 0;
        return;
    }

    if (this.trauma > 0.001) {
        this._shakeTime += dt;
        var t = this._shakeTime;
        var f = this.frequency;
        var exp = this.traumaExponent > 0 ? this.traumaExponent : 1;
        var maxP = this._safeMaxPower();
        var shakeAmp = Math.pow(this.trauma, exp) * maxP;

        var nx = Math.sin((t * f + this._seedX)) * 0.6 + Math.sin((t * f * 0.47 + this._seedX)) * 0.4;
        var nz = Math.cos((t * f * 0.87 + this._seedZ)) * 0.6 + Math.cos((t * f * 0.61 + this._seedZ)) * 0.4;
        var ny = Math.sin((t * f * 1.13 + this._seedY));

        this._offset.x = nx * shakeAmp * this.horizontalScale;
        this._offset.z = nz * shakeAmp * this.horizontalScale;
        this._offset.y = ny * shakeAmp * this.verticalScale;

        var pos = this.entity.getPosition();
        this.entity.setPosition(
            pos.x + this._offset.x,
            pos.y + this._offset.y,
            pos.z + this._offset.z
        );

        this.trauma -= this.decayRate * dt;
        if (this.trauma < 0) this.trauma = 0;
    } else {
        this.isShaking = false;
        this.trauma = 0;
        this._shakeTime = 0;
        this._offset.x = 0;
        this._offset.y = 0;
        this._offset.z = 0;
    }
};
