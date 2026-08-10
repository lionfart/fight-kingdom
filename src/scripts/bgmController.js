var BgmController = pc.createScript('bgmController');

BgmController.prototype.initialize = function() {
    this.bgmPlaying = false;
    this._ensureBgmSlot();

    this.app.on('game:playBgm', this.playBGM, this);
    this.app.on('game:stopBgm', this.stopBGM, this);

    if (this.app.assets) {
        this.app.assets.on('load', this._ensureBgmSlot, this);
    }

    this.on('destroy', function() {
        this.app.off('game:playBgm', this.playBGM, this);
        this.app.off('game:stopBgm', this.stopBGM, this);
        if (this.app.assets) this.app.assets.off('load', this._ensureBgmSlot, this);
    }, this);
};

BgmController.prototype._isMusicEnabled = function() {
    var gs = this.app.gameSettings;
    // 無設定時不擋；有設定時只尊重玩家的 Music 開關（不再綁 Character Pass）
    if (!gs) return true;
    return !!gs._isMusicOn;
};

BgmController.prototype._resolveAsset = function(assetOrId) {
    if (!assetOrId) return null;
    if (typeof assetOrId === 'object') return assetOrId;
    var assets = this.app.assets;
    if (!assets || !assets.get) return null;
    return assets.get(+assetOrId) || null;
};

BgmController.prototype._findBgmAsset = function() {
    var assets = this.app.assets;
    if (!assets) return null;

    var names = ['battle_loop.wav', 'battle_loop.ogg', 'battle_loop.mp3'];
    for (var n = 0; n < names.length; n++) {
        if (assets.find) {
            var found = assets.find(names[n]);
            if (found && found.type === 'audio') return found;
        }
    }

    if (assets.list) {
        var list = assets.list();
        for (var i = 0; i < list.length; i++) {
            var a = list[i];
            if (!a || a.type !== 'audio') continue;
            if (a.name === 'battle_loop.wav' || a.name === 'battle_loop.ogg' || a.name === 'battle_loop.mp3') {
                return a;
            }
        }
    }
    return null;
};

BgmController.prototype._ensureBgmSlot = function() {
    if (!this.entity.sound) return;

    var sound = this.entity.sound;
    if (sound.positional) sound.positional = false;

    var asset = this._findBgmAsset();
    if (!asset) return;

    if (!sound.slot('bgm')) {
        sound.addSlot('bgm', {
            asset: asset,
            loop: true,
            autoPlay: false,
            overlap: false,
            volume: 0.45
        });
    } else {
        var slot = sound.slot('bgm');
        slot.asset = asset;
        slot.loop = true;
        slot.volume = 0.45;
    }

    var resolved = this._resolveAsset(asset);
    if (resolved && !resolved.resource && this.app.assets) {
        this.app.assets.load(resolved);
    }
};

BgmController.prototype.playBGM = function() {
    if (this.bgmPlaying) return;
    if (!this._isMusicEnabled()) return;
    if (!this.entity.sound) return;

    this._ensureBgmSlot();
    if (!this.entity.sound.slot('bgm')) return;

    this.entity.sound.play('bgm');
    this.bgmPlaying = true;
};

BgmController.prototype.stopBGM = function() {
    if (!this.bgmPlaying) return;

    if (this.entity.sound) {
        this.entity.sound.stop('bgm');
    }
    this.bgmPlaying = false;
};
