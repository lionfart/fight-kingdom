// =============================================================================
// RogueCheckpointManager — Rogue 進行中斷點（local-only，不上雲）
// key: tk_rogue_checkpoint_v1；TTL 72h；版本不符則丟棄
// =============================================================================
var RogueCheckpointManager = pc.createScript('rogueCheckpointManager');

RogueCheckpointManager.STORAGE_KEY = 'tk_rogue_checkpoint_v1';
RogueCheckpointManager.CHECKPOINT_VERSION = 1;
RogueCheckpointManager.TTL_MS = 72 * 60 * 60 * 1000;

RogueCheckpointManager.prototype.initialize = function () {
    this.app.rogueCheckpointManager = this;
};

/** @returns {'choosing'|'between_waves'|'restart_wave'|null} */
RogueCheckpointManager.resolveResumePhase = function (waveStatus) {
    if (waveStatus === 'choosing') return 'choosing';
    if (waveStatus === 'playing') return 'restart_wave';
    if (waveStatus === 'idle') return 'between_waves';
    return null;
};

RogueCheckpointManager.canSaveStatus = function (rd) {
    if (!rd || !rd.active || rd.isTutorialRun) return false;
    var st = rd.waveStatus;
    if (st === 'over' || st === 'victory_choice') return false;
    if (st === 'idle' || st === 'playing' || st === 'choosing') return true;
    return false;
};

RogueCheckpointManager.isValid = function (data) {
    if (!data || typeof data !== 'object') return false;
    if (data.checkpointVersion !== RogueCheckpointManager.CHECKPOINT_VERSION) return false;
    if (!data.savedAt || typeof data.savedAt !== 'number') return false;
    if (Date.now() - data.savedAt > RogueCheckpointManager.TTL_MS) return false;
    var buildV = (typeof WordSystem !== 'undefined' && WordSystem.BUILD_VERSION)
        ? WordSystem.BUILD_VERSION
        : 1;
    if (data.runVersion != null && data.runVersion !== buildV) return false;
    if (!data.resumePhase) return false;
    if (!data.hero) return false;
    if (data.wave == null || data.wave < 0) return false;

    // Stale card ids → invalid (player should abandon)
    var cards = (data.wordRun && data.wordRun._owned) || (data.build && data.build.cards) || [];
    if (window.WordConfig && window.WordConfig.cards && cards.length) {
        for (var i = 0; i < cards.length; i++) {
            var id = typeof cards[i] === 'string' ? cards[i] : (cards[i] && cards[i].id);
            if (id && !window.WordConfig.cards[id]) return false;
        }
    }
    var sigId = data.wordRun && data.wordRun._sigCardId;
    if (sigId && window.WordConfig && window.WordConfig.cards && !window.WordConfig.cards[sigId]) {
        return false;
    }
    return true;
};

RogueCheckpointManager.saveRaw = function (data) {
    if (!data) return false;
    try {
        localStorage.setItem(RogueCheckpointManager.STORAGE_KEY, JSON.stringify(data));
        return true;
    } catch (e) {
        console.warn('[RogueCheckpoint] save failed', e);
        return false;
    }
};

RogueCheckpointManager.loadRaw = function () {
    try {
        var raw = localStorage.getItem(RogueCheckpointManager.STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        console.warn('[RogueCheckpoint] load failed', e);
        return null;
    }
};

RogueCheckpointManager.clear = function () {
    try {
        localStorage.removeItem(RogueCheckpointManager.STORAGE_KEY);
    } catch (e) { /* ignore */ }
};

RogueCheckpointManager.loadValid = function () {
    var data = RogueCheckpointManager.loadRaw();
    if (!RogueCheckpointManager.isValid(data)) {
        if (data) RogueCheckpointManager.clear();
        return null;
    }
    return data;
};

RogueCheckpointManager.hasValid = function () {
    return !!RogueCheckpointManager.loadValid();
};

RogueCheckpointManager.prototype.save = function (data) {
    return RogueCheckpointManager.saveRaw(data);
};
RogueCheckpointManager.prototype.load = function () {
    return RogueCheckpointManager.loadValid();
};
RogueCheckpointManager.prototype.clear = function () {
    RogueCheckpointManager.clear();
};
RogueCheckpointManager.prototype.hasValid = function () {
    return RogueCheckpointManager.hasValid();
};
RogueCheckpointManager.prototype.isValid = function (data) {
    return RogueCheckpointManager.isValid(data);
};
