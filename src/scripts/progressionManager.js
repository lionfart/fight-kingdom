// =============================================================================
// ProgressionManager — 3CBattle 養成系統核心資料層
// 職責：管理 localStorage 的玩家養成資料（軍餉/等級/解鎖），提供 API 給其他系統。
// 設計：所有 localStorage 存取只在這裡發生（封裝）。其他系統呼叫 app.progressionManager.xxx()。
//       之後若加 Supabase 備份，只改這裡內部，其他系統不用動。
// 這次範圍：資料讀寫 + 軍餉 + 等級/經驗 + 角色解鎖。（每日任務/登入之後再加）
// =============================================================================

var ProgressionManager = pc.createScript('progressionManager');

// localStorage 的 key（改版時可加版本號做遷移）
ProgressionManager.STORAGE_KEY = 'fk_progression_v2';   // Fight Kingdom
ProgressionManager.LEGACY_STORAGE_KEY = '3cb_progression_v2';   // Tap Kingdom 遺留資料

// ── 經驗/等級曲線：升到下一級所需經驗 = BASE * level ──
ProgressionManager.XP_BASE = 100;   // Lv1→2 需 100，Lv2→3 需 200… 遞增

// ⚠️ 正式預設：僅起步 T0。Tutorial／測試勿再塞張飛。
ProgressionManager.DEV_DEFAULT_UNLOCKS = ['guanyu', 'zhouyu'];

ProgressionManager.prototype.initialize = function() {
    this.app.progressionManager = this;

    this.data = null;
    this._loaded = false;
    this._readyFired = false;

    this._load();   // 開場先讀 localStorage

    // 有雲端同步時等 cloudSave:synced；否則立刻就緒
    if (this.app.cloudSaveManager) {
        this.app.cloudSaveManager.onProgressionLoaded(this);
    } else {
        this._fireReady();
    }
};

ProgressionManager.prototype._fireReady = function() {
    if (this._readyFired) return;
    this._readyFired = true;
    this.app.fire('progression:ready', this.data);
};

// cloudSaveManager 合併完成後套用（不觸發雲端上傳迴圈）
ProgressionManager.prototype.applyExternalData = function(parsed) {
    if (!parsed) return;
    this.data = this._migrate(parsed);
    this._saveLocalOnly();
    this.app.fire('progression:coinsChanged', this.data.coins);
    this.app.fire('progression:xpChanged', { xp: this.data.accountXP, level: this.data.accountLevel });
};

// ── 預設資料（新玩家初始狀態）─────────────────────────────────────────────────
ProgressionManager.prototype._defaultData = function() {
    return {
        version: 1,
        playerId: this._generateId(),
        displayName: '',
        createdAt: Date.now(),

        // 養成核心
        accountLevel: 1,
        accountXP: 0,
        coins: 0,                    // 軍餉

        // 解鎖（空的，等 tutorial 選第一個）
        // 解鎖（開發期預設給幾個；tutorial 做好後改回 []）
        unlockedCharacters: ProgressionManager.DEV_DEFAULT_UNLOCKS.slice(),

        // 流程旗標
        tutorialDone: false,
        rogueCleared: false,

        // Rogue 本機最佳（上傳雲端後可供全服王者榜）
        rogueBestWave: 0,
        rogueBestBrawler: '',
        rogueBestAt: 0,
        rogueLastBuild: null,

        // 統計（給之後的成就/個人檔案）
        stats: { totalGames: 0, totalWins: 0, totalKills: 0, totalDamage: 0 },

        // 每角色統計（最常玩角色用）：{ guanyu: { games, wins }, ... }
        characterStats: {}
    };
};

ProgressionManager.prototype._generateId = function() {
    return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 8);
};

// ── 載入：從 localStorage 讀，沒有就初始化新玩家 ─────────────────────────────────
ProgressionManager.prototype._load = function() {
    var raw = null;
    try {
        raw = localStorage.getItem(ProgressionManager.STORAGE_KEY);
        if (!raw) {
            // 舊版 (Tap Kingdom) 存檔 varsa taşı
            raw = localStorage.getItem(ProgressionManager.LEGACY_STORAGE_KEY);
            if (raw) {
                localStorage.setItem(ProgressionManager.STORAGE_KEY, raw);
                localStorage.removeItem(ProgressionManager.LEGACY_STORAGE_KEY);
            }
        }
    } catch (e) {
        // localStorage 不可用（隱私模式等）→ 用記憶體資料，不持久化
        console.warn('[Progression] localStorage 不可用，使用記憶體資料');
        this.data = this._defaultData();
        this._loaded = true;
        return;
    }

    if (!raw) {
        // 全新玩家
        this.data = this._defaultData();
        this._save();
        this._loaded = true;
        return;
    }

    try {
        var parsed = JSON.parse(raw);
        // 合併預設值，補上舊資料可能缺的欄位（向前相容）
        this.data = this._migrate(parsed);
        this._loaded = true;
    } catch (e) {
        // 資料壞了 → 重置（保險起見，避免整個養成系統卡死）
        console.warn('[Progression] 資料解析失敗，重置為新玩家', e);
        this.data = this._defaultData();
        this._save();
        this._loaded = true;
    }
};

// ── 遷移/補欄位：舊存檔缺的欄位用預設補上（避免 undefined 崩潰）────────────────
ProgressionManager.prototype._migrate = function(parsed) {
    var def = this._defaultData();
    // 淺層補欄位
    for (var key in def) {
        if (parsed[key] === undefined) parsed[key] = def[key];
    }
    // stats 子欄位也補
    if (parsed.stats) {
        for (var sk in def.stats) {
            if (parsed.stats[sk] === undefined) parsed.stats[sk] = def.stats[sk];
        }
    } else {
        parsed.stats = def.stats;
    }
    // 保留原 playerId / createdAt（不要被預設覆蓋）
    if (parsed.rogueCleared && parsed.unlockedCharacters.indexOf('zhangbao') === -1) {
        parsed.unlockedCharacters.push('zhangbao');
    }
    parsed.unlockedCharacters = this._filterPlayableUnlocks(parsed.unlockedCharacters);
    if (!Array.isArray(parsed.unlockedSkins)) parsed.unlockedSkins = [];
    return parsed;
};

ProgressionManager.prototype._isPlayableBrawler = function(bType) {
    return !!(window.BrawlerConfig && window.BrawlerConfig.isPlayable && window.BrawlerConfig.isPlayable(bType));
};

ProgressionManager.prototype._filterPlayableUnlocks = function(list) {
    if (!list || !list.length) return list || [];
    var out = [];
    for (var i = 0; i < list.length; i++) {
        if (this._isPlayableBrawler(list[i])) out.push(list[i]);
    }
    return out;
};

// ── 儲存：寫回 localStorage（+ 排程雲端同步）──────────────────────────────────
ProgressionManager.prototype._saveLocalOnly = function() {
    try {
        localStorage.setItem(ProgressionManager.STORAGE_KEY, JSON.stringify(this.data));
        return true;
    } catch (e) {
        console.warn('[Progression] 儲存失敗', e);
        return false;
    }
};

ProgressionManager.prototype._save = function() {
    if (!this._saveLocalOnly()) return false;
    if (this.app.cloudSaveManager) {
        this.app.cloudSaveManager.scheduleUpload();
    }
    return true;
};

ProgressionManager.prototype.setDisplayName = function(name) {
    if (!this.data || !name) return;
    this.data.displayName = name;
    this._save();
};

// =============================================================================
// 公開 API（給 characterSelect / scoreManager / tutorial 呼叫）
// =============================================================================

// ── 軍餉 ──────────────────────────────────────────────────────────────────────
ProgressionManager.prototype.getCoins = function() {
    return this.data ? this.data.coins : 0;
};

ProgressionManager.prototype.addCoins = function(amount) {
    if (!this.data || !amount) return this.getCoins();
    var add = Math.floor(amount);
    this.data.coins = Math.max(0, this.data.coins + add);
    this._save();
    this.app.fire('progression:coinsChanged', this.data.coins);
    if (add > 0) {
        try { this.app.fire('sfx:coin'); } catch (eSfx) { /* ignore */ }
    }
    return this.data.coins;
};

// 扣軍餉，成功回 true、不足回 false
ProgressionManager.prototype.spendCoins = function(amount) {
    if (!this.data || amount <= 0) return false;
    if (this.data.coins < amount) return false;
    this.data.coins -= Math.floor(amount);
    this._save();
    this.app.fire('progression:coinsChanged', this.data.coins);
    return true;
};

// ── 等級 / 經驗 ───────────────────────────────────────────────────────────────
ProgressionManager.prototype.getLevel = function() {
    return this.data ? this.data.accountLevel : 1;
};

ProgressionManager.prototype.getXP = function() {
    return this.data ? this.data.accountXP : 0;
};

// 升到下一級所需的總經驗
ProgressionManager.prototype.xpForNextLevel = function(level) {
    var lv = (level !== undefined) ? level : this.data.accountLevel;
    return ProgressionManager.XP_BASE * lv;
};

// 加經驗，自動處理升級（可能一次升多級）。回傳 { leveledUp, newLevel, levelsGained }
ProgressionManager.prototype.addXP = function(amount) {
    if (!this.data || amount <= 0) return { leveledUp: false, newLevel: this.data.accountLevel, levelsGained: 0 };

    this.data.accountXP += Math.floor(amount);
    var levelsGained = 0;

    // 連續升級判定
    while (this.data.accountXP >= this.xpForNextLevel(this.data.accountLevel)) {
        this.data.accountXP -= this.xpForNextLevel(this.data.accountLevel);
        this.data.accountLevel++;
        levelsGained++;
    }

    this._save();
    this.app.fire('progression:xpChanged', { xp: this.data.accountXP, level: this.data.accountLevel });

    if (levelsGained > 0) {
        this.app.fire('progression:levelUp', { newLevel: this.data.accountLevel, levelsGained: levelsGained });
    }

    return { leveledUp: levelsGained > 0, newLevel: this.data.accountLevel, levelsGained: levelsGained };
};

// ── 角色解鎖 ─────────────────────────────────────────────────────────────────
ProgressionManager.prototype._hasCharacterPass = function() {
    var em = this.app.entitlementManager;
    return !!(em && em.hasCharacterPass());
};

ProgressionManager.prototype._isUnlockedByPass = function(brawlerType) {
    if (!this._hasCharacterPass()) return false;
    if (window.BrawlerConfig && typeof window.BrawlerConfig.isCoveredByCharacterPass === 'function') {
        return window.BrawlerConfig.isCoveredByCharacterPass(brawlerType);
    }
    return false;
};

ProgressionManager.prototype.isUnlockedByPass = function(brawlerType) {
    return this._isUnlockedByPass(brawlerType);
};

ProgressionManager.prototype.isUnlocked = function(brawlerType) {
    if (!this.data) return false;
    if (this.data.unlockedCharacters.indexOf(brawlerType) !== -1) return true;
    return this._isUnlockedByPass(brawlerType);
};

ProgressionManager.prototype.isSoftUnlocked = function(brawlerType) {
    if (!this.data) return false;
    return this.data.unlockedCharacters.indexOf(brawlerType) !== -1;
};

ProgressionManager.prototype.getUnlockedList = function() {
    if (!this.data) return [];
    var list = this.data.unlockedCharacters.slice();
    if (this._hasCharacterPass() && window.BrawlerConfig && window.BrawlerConfig.getCharacterPassRoster) {
        var passList = window.BrawlerConfig.getCharacterPassRoster();
        for (var i = 0; i < passList.length; i++) {
            if (list.indexOf(passList[i]) === -1) list.push(passList[i]);
        }
    }
    return this._filterPlayableUnlocks(list);
};

// 直接解鎖（不扣錢）— 給 tutorial 首選 / 等級獎勵用
ProgressionManager.prototype.unlockCharacter = function(brawlerType) {
    if (!this.data || !brawlerType) return false;
    if (!this._isPlayableBrawler(brawlerType)) return false;
    if (this.isUnlocked(brawlerType)) return false;   // 已解鎖
    this.data.unlockedCharacters.push(brawlerType);
    this._save();
    this.app.fire('progression:characterUnlocked', brawlerType);
    return true;
};

// 從 BrawlerConfig 取解鎖條件
ProgressionManager.prototype.getUnlockInfo = function(brawlerType) {
    var cfg = (window.BrawlerConfig && window.BrawlerConfig[brawlerType]) ? window.BrawlerConfig[brawlerType] : {};
    return {
        cost: (cfg.unlockCost !== undefined) ? cfg.unlockCost : 1000,
        levelReq: (cfg.unlockLevel !== undefined) ? cfg.unlockLevel : 1,
        unlockRogue: !!cfg.unlockRogue,
        unlockTier: (cfg.unlockTier !== undefined) ? cfg.unlockTier : 1
    };
};

ProgressionManager.prototype.isRogueCleared = function() {
    return this.data ? !!this.data.rogueCleared : false;
};

ProgressionManager.prototype.setRogueCleared = function() {
    if (!this.data || this.data.rogueCleared) return false;
    this.data.rogueCleared = true;
    this.unlockCharacter('zhangbao');
    this._save();
    this.app.fire('progression:rogueCleared');
    return true;
};

ProgressionManager.prototype.getRogueBestWave = function() {
    return this.data ? (this.data.rogueBestWave || 0) : 0;
};

ProgressionManager.prototype.getRogueBestRecord = function() {
    if (!this.data) return { wave: 0, brawler: '', at: 0 };
    return {
        wave: this.data.rogueBestWave || 0,
        brawler: this.data.rogueBestBrawler || '',
        at: this.data.rogueBestAt || 0
    };
};

// 若 wave 高於紀錄則更新並存檔；可帶破紀錄時角色。回傳 { wave, isNew }
ProgressionManager.prototype.recordRogueBestWave = function(wave, brawlerType) {
    if (!this.data) return { wave: 0, isNew: false };
    var w = Math.max(0, Math.floor(wave || 0));
    var prev = this.data.rogueBestWave || 0;
    if (w <= prev) return { wave: prev, isNew: false };
    this.data.rogueBestWave = w;
    if (brawlerType) this.data.rogueBestBrawler = String(brawlerType);
    this.data.rogueBestAt = Date.now();
    this._save();
    this.app.fire('progression:rogueBestUpdated', {
        wave: w,
        brawler: this.data.rogueBestBrawler || '',
        at: this.data.rogueBestAt
    });
    return { wave: w, isNew: true };
};

ProgressionManager.prototype.setRogueLastBuild = function(snap) {
    if (!this.data || !snap) return;
    try {
        this.data.rogueLastBuild = JSON.parse(JSON.stringify(snap));
        this._saveLocalOnly();
    } catch (e) {
        this.data.rogueLastBuild = snap;
        this._saveLocalOnly();
    }
};

ProgressionManager.prototype.getRogueLastBuild = function() {
    return (this.data && this.data.rogueLastBuild) ? this.data.rogueLastBuild : null;
};

// 嘗試用軍餉購買解鎖。回傳 { success, reason }
ProgressionManager.prototype.tryPurchaseCharacter = function(brawlerType) {
    if (!this.data) return { success: false, reason: 'no_data' };
    if (this.isUnlocked(brawlerType)) return { success: false, reason: 'already_unlocked' };

    var info = this.getUnlockInfo(brawlerType);
    var cfg = (window.BrawlerConfig && window.BrawlerConfig[brawlerType]) ? window.BrawlerConfig[brawlerType] : {};

    if (cfg.unlockRogue) {
        if (!this.isRogueCleared()) return { success: false, reason: 'rogue_locked' };
        return this.unlockCharacter(brawlerType) ? { success: true, cost: 0 } : { success: false, reason: 'already_unlocked' };
    }

    // 等級門檻檢查
    if (this.data.accountLevel < info.levelReq) {
        return { success: false, reason: 'level_locked', levelReq: info.levelReq };
    }
    // 軍餉檢查
    if (this.data.coins < info.cost) {
        return { success: false, reason: 'not_enough_coins', cost: info.cost, have: this.data.coins };
    }

    // 扣錢 + 解鎖
    this.data.coins -= info.cost;
    this.data.unlockedCharacters.push(brawlerType);
    this._save();
    this.app.fire('progression:coinsChanged', this.data.coins);
    this.app.fire('progression:characterUnlocked', brawlerType);
    return { success: true, cost: info.cost };
};

// ── Skin 解鎖 ─────────────────────────────────────────────────────────────────
ProgressionManager.prototype._getSkinDef = function(skinKey) {
    if (!skinKey || !window.BrawlerConfig || !window.BrawlerConfig.getSkinDef) return null;
    return window.BrawlerConfig.getSkinDef(skinKey);
};

ProgressionManager.prototype._hasSkinEntitlement = function(skin) {
    if (!skin || !skin.sku) return false;
    var em = this.app.entitlementManager;
    if (!em) return false;
    if (typeof em.hasSku === 'function' && em.hasSku(skin.sku)) return true;
    if (typeof em.hasOriginPass === 'function' && em.hasOriginPass()) {
        if (window.BrawlerConfig.isSkinCoveredByOriginPass && window.BrawlerConfig.isSkinCoveredByOriginPass(skin.key)) {
            return true;
        }
    }
    return false;
};

ProgressionManager.prototype.getSkinUnlockInfo = function(skinKey) {
    var skin = this._getSkinDef(skinKey);
    if (!skin) {
        return { cost: 0, levelReq: 1, rogueWave: 0, mission: '', sku: '', defaultUnlocked: false };
    }
    return {
        cost: (skin.unlockCost !== undefined) ? skin.unlockCost : 0,
        levelReq: (skin.unlockLevel !== undefined) ? skin.unlockLevel : 1,
        rogueWave: skin.unlockRogueWave || 0,
        mission: skin.unlockMission || '',
        sku: skin.sku || '',
        defaultUnlocked: !!skin.defaultUnlocked
    };
};

ProgressionManager.prototype.isSkinUnlocked = function(skinKey) {
    if (!skinKey) return true;
    if (!this.data) return false;

    var skin = this._getSkinDef(skinKey);
    if (!skin) return false;
    if (skin.defaultUnlocked) return true;
    if (this.data.unlockedSkins.indexOf(skinKey) !== -1) return true;
    if (this._hasSkinEntitlement(skin)) return true;

    var info = this.getSkinUnlockInfo(skinKey);
    if (info.rogueWave > 0 && this.getRogueBestWave() >= info.rogueWave) return true;
    if (info.mission && typeof this.isMissionComplete === 'function' && this.isMissionComplete(info.mission)) {
        return true;
    }
    return false;
};

ProgressionManager.prototype.unlockSkin = function(skinKey) {
    if (!this.data || !skinKey) return false;
    if (this.isSkinUnlocked(skinKey)) return false;
    if (!this._getSkinDef(skinKey)) return false;
    this.data.unlockedSkins.push(skinKey);
    this._save();
    this.app.fire('progression:skinUnlocked', skinKey);
    return true;
};

ProgressionManager.prototype.tryPurchaseSkin = function(skinKey) {
    if (!this.data) return { success: false, reason: 'no_data' };
    if (this.isSkinUnlocked(skinKey)) return { success: false, reason: 'already_unlocked' };

    var info = this.getSkinUnlockInfo(skinKey);
    if (!info.cost && !info.rogueWave && !info.mission && !info.sku) {
        return { success: false, reason: 'no_unlock_path' };
    }

    if (info.rogueWave > 0 && this.getRogueBestWave() >= info.rogueWave) {
        return this.unlockSkin(skinKey) ? { success: true, cost: 0 } : { success: false, reason: 'already_unlocked' };
    }

    if (!info.cost) {
        return { success: false, reason: 'coins_locked' };
    }

    if (this.data.accountLevel < info.levelReq) {
        return { success: false, reason: 'level_locked', levelReq: info.levelReq };
    }
    if (this.data.coins < info.cost) {
        return { success: false, reason: 'not_enough_coins', cost: info.cost, have: this.data.coins };
    }

    this.data.coins -= info.cost;
    this.data.unlockedSkins.push(skinKey);
    this._save();
    this.app.fire('progression:coinsChanged', this.data.coins);
    this.app.fire('progression:skinUnlocked', skinKey);
    return { success: true, cost: info.cost };
};

// ── Tutorial 狀態 ─────────────────────────────────────────────────────────────
ProgressionManager.prototype.isTutorialDone = function() {
    return this.data ? !!this.data.tutorialDone : false;
};

ProgressionManager.prototype.setTutorialDone = function() {
    if (!this.data) return;
    this.data.tutorialDone = true;
    this._save();
};

// ── 統計（每場結束記錄）──────────────────────────────────────────────────────
ProgressionManager.prototype.recordGameResult = function(result) {
    if (!this.data || !result) return;
    var s = this.data.stats;
    s.totalGames += 1;
    if (result.won) s.totalWins += 1;
    if (result.kills) s.totalKills += result.kills;
    if (result.damage) s.totalDamage += Math.floor(result.damage);

    // 每角色統計
    if (result.brawler) {
        if (!this.data.characterStats) this.data.characterStats = {};
        var cs = this.data.characterStats;
        if (!cs[result.brawler]) cs[result.brawler] = { games: 0, wins: 0 };
        cs[result.brawler].games += 1;
        if (result.won) cs[result.brawler].wins += 1;
    }

    this._save();
};

// 回傳最常玩角色 { brawler, games, wins } 或 null
ProgressionManager.prototype.getMostPlayedCharacter = function() {
    if (!this.data || !this.data.characterStats) return null;
    var best = null, bestGames = 0;
    for (var k in this.data.characterStats) {
        if (this.data.characterStats[k].games > bestGames) {
            bestGames = this.data.characterStats[k].games;
            best = { brawler: k, games: this.data.characterStats[k].games, wins: this.data.characterStats[k].wins };
        }
    }
    return best;
};

// 勝率（百分比整數）
ProgressionManager.prototype.getWinRate = function() {
    if (!this.data || this.data.stats.totalGames === 0) return 0;
    return Math.round((this.data.stats.totalWins / this.data.stats.totalGames) * 100);
};

// ── 一次結算發獎（給 scoreManager 結束時呼叫）─────────────────────────────────
// payload: { coins, xp, won, kills, damage, brawler }
ProgressionManager.prototype.grantMatchRewards = function(payload) {
    if (!this.data || !payload) return null;
    var result = { coinsAdded: 0, xpResult: null };

    if (payload.coins) result.coinsAdded = payload.coins, this.addCoins(payload.coins);
    if (payload.xp) result.xpResult = this.addXP(payload.xp);

    this.recordGameResult({ won: payload.won, kills: payload.kills, damage: payload.damage, brawler: payload.brawler });

    this.app.fire('progression:matchRewards', {
        coins: payload.coins || 0,
        xp: payload.xp || 0,
        won: !!payload.won,
        kills: payload.kills || 0,
        damage: payload.damage || 0,
        brawler: payload.brawler || null
    });
    return result;
};

// ── 取得完整資料（唯讀用途，例如 UI 顯示）──────────────────────────────────────
ProgressionManager.prototype.getData = function() {
    return this.data;
};

// ── 重置（debug / 設定裡的「清除進度」用）─────────────────────────────────────
ProgressionManager.prototype.resetAll = function() {
    this.data = this._defaultData();
    this._save();
    if (this.app.cloudSaveManager) {
        this.app.cloudSaveManager.uploadNow();
    }
    this.app.fire('progression:ready', this.data);
};