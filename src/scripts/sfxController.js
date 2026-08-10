var SfxController = pc.createScript('sfxController');

SfxController.attributes.add('minInterval', { type: 'number', default: 0.04, title: '同 slot 最小間隔(秒)' });
SfxController.attributes.add('masterVolume', { type: 'number', default: 2.0, title: 'SFX 主音量（可 >1 放大）' });

SfxController.SLOT_DEFS = [
    { slot: 'hit_slash', file: 'hit_slash.wav', volume: 1.0 },
    { slot: 'hit_blunt', file: 'hit_blunt.wav', volume: 1.0 },
    { slot: 'hit_magic', file: 'hit_magic.wav', volume: 1.0 },
    { slot: 'hit_heavy', file: 'hit_heavy.wav', volume: 1.15 },
    { slot: 'swing', file: 'swing.wav', volume: 0.9 },
    { slot: 'dash', file: 'dash.wav', volume: 0.95 },
    { slot: 'super_cast', file: 'super_cast.wav', volume: 1.1 },
    { slot: 'ui_click', file: 'ui_click.wav', volume: 0.7, minInterval: 0.08 },
    { slot: 'ui_confirm', file: 'ui_confirm.wav', volume: 0.85 },
    { slot: 'ui_deny', file: 'ui_deny.wav', volume: 0.8 },
    { slot: 'coin', file: 'coin.wav', volume: 0.85, minInterval: 0.1 },
    { slot: 'gem', file: 'gem.wav', volume: 0.85, minInterval: 0.1 },
    { slot: 'level_up', file: 'level_up.wav', volume: 1.0 },
    { slot: 'unlock', file: 'unlock.wav', volume: 1.0 },
    { slot: 'victory', file: 'victory.wav', volume: 1.1 },
    { slot: 'defeat', file: 'defeat.wav', volume: 1.0 },
    { slot: 'death', file: 'death.wav', volume: 0.95 },
    { slot: 'perfect_dodge', file: 'perfect_dodge.wav', volume: 0.9 },
    { slot: 'card_pick', file: 'card_pick.wav', volume: 0.85 },
    { slot: 'revive', file: 'revive.wav', volume: 0.95 }
];

SfxController.prototype.initialize = function() {
    this._lastPlay = {};
    this._slotMinInterval = {};
    var defs = SfxController.SLOT_DEFS;
    for (var i = 0; i < defs.length; i++) {
        if (defs[i].minInterval) this._slotMinInterval[defs[i].slot] = defs[i].minInterval;
    }
    this._ensureSlots();

    this.app.on('fx:hit', this._onHit, this);
    this.app.on('tutorial:attack', this._onAttack, this);
    this.app.on('tutorial:dash', this._onDash, this);
    this.app.on('tutorial:super', this._onSuper, this);
    this.app.on('tutorial:perfectDodge', this._onPerfectDodge, this);
    this.app.on('tutorial:cardPicked', this._onCardPick, this);
    this.app.on('progression:levelUp', this._onLevelUp, this);
    this.app.on('progression:characterUnlocked', this._onUnlock, this);
    this.app.on('progression:skinUnlocked', this._onUnlock, this);
    this.app.on('entitlement:purchaseSuccess', this._onUnlock, this);
    this.app.on('entitlement:redeemSuccess', this._onUnlock, this);
    this.app.on('sfx:ui', this._onUiClick, this);
    this.app.on('sfx:uiConfirm', this._onUiConfirm, this);
    this.app.on('sfx:uiDeny', this._onUiDeny, this);
    this.app.on('sfx:coin', this._onCoin, this);
    this.app.on('sfx:gem', this._onGem, this);
    this.app.on('sfx:victory', this._onVictory, this);
    this.app.on('sfx:defeat', this._onDefeat, this);
    this.app.on('sfx:death', this._onDeath, this);
    this.app.on('sfx:revive', this._onRevive, this);

    if (this.app.assets) {
        this.app.assets.on('load', this._ensureSlots, this);
    }

    this.on('destroy', function() {
        this.app.off('fx:hit', this._onHit, this);
        this.app.off('tutorial:attack', this._onAttack, this);
        this.app.off('tutorial:dash', this._onDash, this);
        this.app.off('tutorial:super', this._onSuper, this);
        this.app.off('tutorial:perfectDodge', this._onPerfectDodge, this);
        this.app.off('tutorial:cardPicked', this._onCardPick, this);
        this.app.off('progression:levelUp', this._onLevelUp, this);
        this.app.off('progression:characterUnlocked', this._onUnlock, this);
        this.app.off('progression:skinUnlocked', this._onUnlock, this);
        this.app.off('entitlement:purchaseSuccess', this._onUnlock, this);
        this.app.off('entitlement:redeemSuccess', this._onUnlock, this);
        this.app.off('sfx:ui', this._onUiClick, this);
        this.app.off('sfx:uiConfirm', this._onUiConfirm, this);
        this.app.off('sfx:uiDeny', this._onUiDeny, this);
        this.app.off('sfx:coin', this._onCoin, this);
        this.app.off('sfx:gem', this._onGem, this);
        this.app.off('sfx:victory', this._onVictory, this);
        this.app.off('sfx:defeat', this._onDefeat, this);
        this.app.off('sfx:death', this._onDeath, this);
        this.app.off('sfx:revive', this._onRevive, this);
        if (this.app.assets) this.app.assets.off('load', this._ensureSlots, this);
    }, this);
};

/** slot.asset 在 Editor 常是 id（number），load() 必須吃 Asset 物件 */
SfxController.prototype._resolveAsset = function(assetOrId) {
    if (!assetOrId) return null;
    if (typeof assetOrId === 'object') return assetOrId;
    var assets = this.app.assets;
    if (!assets || !assets.get) return null;
    return assets.get(+assetOrId) || null;
};

SfxController.prototype._loadAssetIfNeeded = function(assetOrId) {
    var asset = this._resolveAsset(assetOrId);
    if (!asset || asset.resource || !this.app.assets) return;
    this.app.assets.load(asset);
};

SfxController.prototype._findAudioAsset = function(fileName) {
    var assets = this.app.assets;
    if (!assets) return null;

    var base = String(fileName || '').replace(/\.(wav|ogg|mp3)$/i, '');
    var candidates = [fileName, base, base + '.wav', base + '.ogg', base + '.mp3'];

    var tryName = function(name) {
        if (!name) return null;
        if (assets.find) {
            var found = assets.find(name);
            if (found && found.type === 'audio') return found;
        }
        return null;
    };

    var i;
    for (i = 0; i < candidates.length; i++) {
        var hit = tryName(candidates[i]);
        if (hit) return hit;
    }

    if (assets.list) {
        var list = assets.list();
        for (i = 0; i < list.length; i++) {
            var a = list[i];
            if (!a || a.type !== 'audio' || !a.name) continue;
            if (a.name === fileName || a.name === base) return a;
            var aBase = String(a.name).replace(/\.(wav|ogg|mp3)$/i, '');
            if (aBase === base) return a;
        }
    }
    return null;
};

SfxController.prototype._slotVolume = function(base) {
    var master = (this.masterVolume !== undefined && this.masterVolume !== null) ? this.masterVolume : 2;
    // PlayCanvas slot 可接受 >1 做增益；上限 4 避免爆音失真太兇
    return Math.max(0, Math.min(4, base * master));
};

SfxController.prototype._ensureSlots = function() {
    if (!this.entity.sound) return;

    var sound = this.entity.sound;
    if (sound.positional) sound.positional = false;
    sound.volume = 1;

    // 確保系統音量沒被設定面板預設靜音壓掉（SFX 預設要聽得到）
    if (this.app.systems && this.app.systems.sound && this.app.systems.sound.volume <= 0) {
        var gs = this.app.gameSettings;
        if (!gs || !gs._musicToggleTouched) {
            this.app.systems.sound.volume = 1;
        }
    }

    var defs = SfxController.SLOT_DEFS;
    for (var d = 0; d < defs.length; d++) {
        var def = defs[d];
        var existing = sound.slot(def.slot);

        // Editor 已配好的 slot：尊重 asset / volume，只補 overlap 與載入
        if (existing && existing.asset) {
            existing.overlap = true;
            this._loadAssetIfNeeded(existing.asset);
            continue;
        }

        var asset = this._findAudioAsset(def.file);
        if (!asset) continue;
        var vol = this._slotVolume(def.volume);

        if (!existing) {
            sound.addSlot(def.slot, {
                asset: asset,
                loop: false,
                autoPlay: false,
                overlap: true,
                volume: vol
            });
        } else {
            existing.asset = asset;
            if (existing.volume === undefined || existing.volume === null) existing.volume = vol;
            existing.overlap = true;
        }

        this._loadAssetIfNeeded(asset);
    }
};

SfxController.prototype._isMuted = function() {
    // 只在玩家主動關掉 Music 後才靜音
    var gs = this.app.gameSettings;
    if (gs && gs._musicToggleTouched && gs._isMusicOn === false) return true;
    return false;
};

SfxController.prototype._play = function(slotName) {
    if (this._isMuted() || !this.entity.sound) return;

    var now = Date.now() / 1000;
    var gap = this._slotMinInterval[slotName] || this.minInterval;
    var last = this._lastPlay[slotName] || 0;
    if (now - last < gap) return;
    this._lastPlay[slotName] = now;

    if (!this.entity.sound.slot(slotName)) {
        this._ensureSlots();
    }
    if (!this.entity.sound.slot(slotName)) return;

    this.entity.sound.play(slotName);
};

SfxController.prototype._onHit = function(pos, isHeavy, hitType) {
    var slot = 'hit_blunt';
    if (hitType === 'slash') slot = 'hit_slash';
    else if (hitType === 'magic') slot = 'hit_magic';

    this._play(slot);
    if (isHeavy) this._play('hit_heavy');
};

SfxController.prototype._onAttack = function() {
    this._play('swing');
};

SfxController.prototype._onDash = function() {
    this._play('dash');
};

SfxController.prototype._onSuper = function() {
    this._play('super_cast');
};

SfxController.prototype._onPerfectDodge = function() {
    this._play('perfect_dodge');
};

SfxController.prototype._onCardPick = function() {
    this._play('card_pick');
};

SfxController.prototype._onLevelUp = function() {
    this._play('level_up');
};

SfxController.prototype._onUnlock = function() {
    this._play('unlock');
};

SfxController.prototype._onUiClick = function() {
    this._play('ui_click');
};

SfxController.prototype._onUiConfirm = function() {
    this._play('ui_confirm');
};

SfxController.prototype._onUiDeny = function() {
    this._play('ui_deny');
};

SfxController.prototype._onCoin = function() {
    this._play('coin');
};

SfxController.prototype._onGem = function() {
    this._play('gem');
};

SfxController.prototype._onVictory = function() {
    this._play('victory');
};

SfxController.prototype._onDefeat = function() {
    this._play('defeat');
};

SfxController.prototype._onDeath = function() {
    this._play('death');
};

SfxController.prototype._onRevive = function() {
    this._play('revive');
};
