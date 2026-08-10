var UvScroll = pc.createScript('uvScroll');

// 🌟 控制面板：讓主公在編輯器中自由調整流動方向與速度
UvScroll.attributes.add('speedU', { type: 'number', default: 0.0, title: 'Speed U (橫向流速)', description: '正數向左，負數向右' });
UvScroll.attributes.add('speedV', { type: 'number', default: -0.5, title: 'Speed V (直向流速)', description: '正數向下，負數向上 (火焰通常設為負數)' });

UvScroll.prototype.initialize = function() {
    this.offset = new pc.Vec2(0, 0);
    this.material = null;

    // 1. 尋找掛載此腳本的實體身上的 Render 或 Model 組件
    var renders = this.entity.findComponents('render');
    if (renders.length === 0) {
        renders = this.entity.findComponents('model');
    }

    if (renders.length > 0 && renders[0].meshInstances.length > 0) {
        // 🚨 核心防護：必須 clone() 複製材質！
        // 如果不複製，場上所有的周瑜火海（甚至是其他共用材質的物件）都會被連動加速！
        this.material = renders[0].meshInstances[0].material.clone();
        renders[0].meshInstances[0].material = this.material;
    }
};

UvScroll.prototype.update = function(dt) {
    if (!this.material) return;

    // 2. 隨時間推移增加 UV 偏移量
    this.offset.x += this.speedU * dt;
    this.offset.y += this.speedV * dt;

    // 3. 數值重置防護 (防止時間過久導致浮點數溢位破圖)
    if (this.offset.x > 1) this.offset.x -= 1;
    if (this.offset.x < -1) this.offset.x += 1;
    if (this.offset.y > 1) this.offset.y -= 1;
    if (this.offset.y < -1) this.offset.y += 1;

    // 4. 將偏移量同步寫入材質的所有貼圖通道
    var needsUpdate = false;
    
    if (this.material.diffuseMap) {
        this.material.diffuseMapOffset = this.offset;
        needsUpdate = true;
    }
    if (this.material.emissiveMap) {
        // 發光貼圖也必須跟著滾動
        this.material.emissiveMapOffset = this.offset;
        needsUpdate = true;
    }
    if (this.material.opacityMap) {
        // 透明度貼圖 (火焰邊緣的Alpha) 也必須跟著滾動
        this.material.opacityMapOffset = this.offset;
        needsUpdate = true;
    }

    // 5. 提交材質更新
    if (needsUpdate) {
        this.material.update();
    }
};