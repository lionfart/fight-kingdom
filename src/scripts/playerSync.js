var PlayerSync = pc.createScript('playerSync');

PlayerSync.prototype.initialize = function() {
    this.syncRate = 1 / 20; // 每秒 20 次 (Tick Rate)
    this.timer = 0;
    this.lastState = -1;    // 記錄上一次的狀態，避免重複發送陣亡
};

PlayerSync.prototype.update = function(dt) {
    // 從全域變數取得主將的狀態 (不需要綁在同一個 Entity 上)
    var ctrl = this.app.playerController;
    if (!ctrl || !ctrl.player) return;

    // 如果主將陣亡，發送一次「陣亡代碼 (3)」後就停止發報
    if (ctrl.isDead) {
        if (this.lastState !== 3) {
            this._sendMinifiedPacket(ctrl, 3);
            this.lastState = 3;
        }
        return;
    }

    // 正常運作時的計時器
    this.timer += dt;
    if (this.timer >= this.syncRate) {
        this.timer = 0;

        // 動作代碼判定
        var s = 0; // 0 = idle
        if (ctrl._attackAnimTimer > 0) s = 2; // 2 = attack
        else if (Math.abs(this.app.inputManager.moveX) > 0.01 || Math.abs(this.app.inputManager.moveZ) > 0.01) s = 1; // 1 = run

        this._sendMinifiedPacket(ctrl, s);
        this.lastState = s;
    }
};

// 🔐 核心機密：封包極致壓縮與發送
PlayerSync.prototype._sendMinifiedPacket = function(ctrl, stateCode) {
    var pos = ctrl.player.getPosition();

    // 🗡️ 極致優化：直接傳送英雄字串名稱 ('colt', 'bibi'...)，廢除所有數字轉換 if/else！
    this.app.fire('network:syncPlayer', {
        b: ctrl.brawlerType,
        skinKey: ctrl.selectedSkinKey || '',
        x: Number(pos.x.toFixed(2)),
        z: Number(pos.z.toFixed(2)),
        r: Number(ctrl._facingAngle.toFixed(1)),
        s: stateCode
    });
};