// DASH 攻擊身體殘影（Mortis 風格剪影）。plain global，不需掛 Editor script。
var DashAfterimage = {
    _active: null,
    _maxActive: 16,
    _hookedApp: null,

    _ensure: function (app) {
        if (!this._active) this._active = [];
        if (app && this._hookedApp !== app) {
            this._hookedApp = app;
            var self = this;
            app.on('update', function (dt) { self.update(dt); });
        }
    },

    /** 從技能設定組出殘影參數；無 afterimage 則回 null */
    confFromAtk: function (atkConf, fallbackColor) {
        if (!atkConf || !atkConf.afterimage) return null;
        return {
            interval: atkConf.afterimageInterval !== undefined ? atkConf.afterimageInterval : 0.05,
            lifetime: atkConf.afterimageLifetime !== undefined ? atkConf.afterimageLifetime : 0.22,
            opacity: atkConf.afterimageOpacity !== undefined ? atkConf.afterimageOpacity : 0.45,
            color: atkConf.afterimageColor || fallbackColor || { r: 0.3, g: 0.85, b: 0.4 }
        };
    },

    stamp: function (app, sourceEntity, opts) {
        if (!app || !sourceEntity || sourceEntity._destroyed || !sourceEntity.parent) return;
        this._ensure(app);
        opts = opts || {};

        while (this._active.length >= this._maxActive) {
            this._recycle(this._active[0]);
        }

        var ghost = sourceEntity.clone();
        ghost.name = 'DashAfterimage';

        var i, comps;
        comps = ghost.findComponents('script');
        for (i = 0; i < comps.length; i++) comps[i].enabled = false;
        comps = ghost.findComponents('anim');
        for (i = 0; i < comps.length; i++) comps[i].enabled = false;
        comps = ghost.findComponents('collision');
        for (i = 0; i < comps.length; i++) comps[i].enabled = false;
        comps = ghost.findComponents('rigidbody');
        for (i = 0; i < comps.length; i++) comps[i].enabled = false;
        comps = ghost.findComponents('particlesystem');
        for (i = 0; i < comps.length; i++) comps[i].enabled = false;

        var wp = sourceEntity.getPosition();
        var wr = sourceEntity.getRotation();
        var ws = sourceEntity.getLocalScale();
        app.root.addChild(ghost);
        ghost.setPosition(wp.x, wp.y, wp.z);
        ghost.setRotation(wr);
        ghost.setLocalScale(ws.x, ws.y, ws.z);

        var opacity = opts.opacity !== undefined ? opts.opacity : 0.45;
        var color = opts.color || { r: 0.3, g: 0.85, b: 0.4 };
        var mats = [];
        var renders = ghost.findComponents('render');
        var models = ghost.findComponents('model');
        var all = renders.concat(models);
        for (var r = 0; r < all.length; r++) {
            var mis = all[r].meshInstances || [];
            for (var m = 0; m < mis.length; m++) {
                var mi = mis[m];
                if (!mi || !mi.material) continue;
                var node = mi.node;
                var skipFx = false;
                for (var p = node; p; p = p.parent) {
                    if (p._isFx) { skipFx = true; break; }
                }
                if (skipFx) {
                    if (node && node.enabled !== undefined) node.enabled = false;
                    continue;
                }
                var mat = mi.material.clone();
                mat.blendType = pc.BLEND_NORMAL;
                mat.opacity = opacity;
                mat.depthWrite = false;
                mat.useLighting = false;
                if (mat.emissive) {
                    mat.emissive.set(color.r, color.g, color.b);
                    mat.emissiveIntensity = 1.4;
                }
                mat.update();
                mi.material = mat;
                mats.push(mat);
            }
        }

        this._active.push({
            entity: ghost,
            mats: mats,
            life: 0,
            maxLife: opts.lifetime !== undefined ? opts.lifetime : 0.22,
            startOpacity: opacity
        });
    },

    /** rush 期間：累計 timer，到間隔就 stamp；回傳更新後 timer */
    accumulate: function (app, sourceEntity, conf, timer, dt) {
        if (!conf || !sourceEntity) return 0;
        timer = (timer || 0) + dt;
        var interval = conf.interval > 0 ? conf.interval : 0.05;
        while (timer >= interval) {
            timer -= interval;
            this.stamp(app, sourceEntity, conf);
        }
        return timer;
    },

    update: function (dt) {
        if (!this._active || this._active.length === 0) return;
        for (var i = this._active.length - 1; i >= 0; i--) {
            var g = this._active[i];
            g.life += dt;
            var t = g.maxLife > 0 ? (g.life / g.maxLife) : 1;
            if (t >= 1) {
                this._recycle(g);
                continue;
            }
            var op = g.startOpacity * (1 - t);
            for (var m = 0; m < g.mats.length; m++) {
                g.mats[m].opacity = op;
                g.mats[m].update();
            }
        }
    },

    _recycle: function (g) {
        if (!g) return;
        var idx = this._active.indexOf(g);
        if (idx >= 0) this._active.splice(idx, 1);
        if (g.mats) {
            for (var i = 0; i < g.mats.length; i++) {
                if (g.mats[i] && g.mats[i].destroy) g.mats[i].destroy();
            }
            g.mats = null;
        }
        if (g.entity && !g.entity._destroyed) g.entity.destroy();
    },

    clearAll: function () {
        if (!this._active) return;
        while (this._active.length > 0) this._recycle(this._active[0]);
    }
};

if (typeof module !== 'undefined') module.exports = DashAfterimage;
