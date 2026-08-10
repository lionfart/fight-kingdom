var RootMotionLock = pc.createScript('rootMotionLock');

RootMotionLock.attributes.add('boneName', { type: 'string', default: 'Hips', title: '根骨骼名稱' });
RootMotionLock.attributes.add('lockX', { type: 'boolean', default: true, title: '鎖定 X 軸 (左右)' });
RootMotionLock.attributes.add('lockY', { type: 'boolean', default: false, title: '鎖定 Y 軸 (上下)' });
RootMotionLock.attributes.add('lockZ', { type: 'boolean', default: true, title: '鎖定 Z 軸 (前後)' });
RootMotionLock.attributes.add('debugLog', { type: 'boolean', default: false, title: '除錯訊息' });

RootMotionLock.prototype.initialize = function() {
    this._hips = null;
    this._baseInRoot = new pc.Vec3();
    this._rootInvMat = new pc.Mat4();    // 矩陣快取池，嚴禁在 Update 內 new 物件
    this._haveBase = false;
    this._logTimer = 0;

    // 🌟 Update 用的暫存向量，全部預先建立，零 GC
    this._currInRoot = new pc.Vec3();
    this._targetInRoot = new pc.Vec3();
    this._targetWorldPos = new pc.Vec3();

    var bone = this.entity.findByName(this.boneName) ||
               this.entity.findOne(function(n) { return n.name && n.name.indexOf('Hips') >= 0; });

    if (bone) {
        this._hips = bone;

        // 🌟 核心：在第 0 幀，直接求出 Hips 距離「武將腳底板原點」的乾淨距離
        this._rootInvMat.copy(this.entity.getWorldTransform()).invert();
        this._rootInvMat.transformPoint(bone.getPosition(), this._baseInRoot);

        this._haveBase = true;
        if (this.debugLog) console.log('[RootLock] Root空間乾淨基準點:', this._baseInRoot.toString());
    } else if (this.debugLog) {
        console.log('[RootLock] 尋找骨骼失敗:', this.boneName);
    }
};

RootMotionLock.prototype.postUpdate = function(dt) {
    if (!this._hips || !this._haveBase) return;

    // 1. 實時取得武將 Root 實體的世界矩陣與其「逆矩陣」
    var rootWorldMat = this.entity.getWorldTransform();
    this._rootInvMat.copy(rootWorldMat).invert();

    // 2. 將 Hips 當下的「世界座標」，轉換為相對於「武將腳底板」的 Local 坐標
    var currWorldPos = this._hips.getPosition();
    this._rootInvMat.transformPoint(currWorldPos, this._currInRoot);

    if (this.debugLog) {
        this._logTimer += dt;
        if (this._logTimer >= 0.3) {
            this._logTimer = 0;
            console.log('[RootLock] 當前位移 (X左右/Y上下/Z前後):', this._currInRoot.toString());
        }
    }

    // 3. 在乾淨的 Root 坐標系中強行抹除位移（完全免疫 Blender 導出的 -90° 旋轉毒素）
    this._targetInRoot.set(
        this.lockX ? this._baseInRoot.x : this._currInRoot.x,
        this.lockY ? this._baseInRoot.y : this._currInRoot.y,
        this.lockZ ? this._baseInRoot.z : this._currInRoot.z
    );

    // 4. 將鎖死後的 Root 空間座標，重新映射回世界座標
    rootWorldMat.transformPoint(this._targetInRoot, this._targetWorldPos);

    // 5. 透過 PlayCanvas 底層注入世界座標，讓引擎自己去逆推那一堆歪七扭八的骨骼 Local 數值！
    this._hips.setPosition(this._targetWorldPos);
};