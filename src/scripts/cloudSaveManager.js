// =============================================================================
// CloudSaveManager — Supabase 雲端存檔同步
// 策略：local-first；啟動時與雲端合併；進度較高優先；有風險時彈窗確認
// =============================================================================

var CloudSaveManager = pc.createScript('cloudSaveManager');

CloudSaveManager.CONFIRM_SCORE_GAP = 0.15;   // 分數接近（15% 內）且確實不同 → 可能需確認
CloudSaveManager.MIN_SCORE_TO_CONFIRM = 500;
CloudSaveManager.UPLOAD_DEBOUNCE_MS = 2000;

CloudSaveManager.computeScore = function (data) {
    if (!data) return 0;
    var unlocks = (data.unlockedCharacters && data.unlockedCharacters.length) || 0;
    var games = (data.stats && data.stats.totalGames) || 0;
    return (data.accountLevel || 1) * 1000
        + (data.accountXP || 0)
        + (data.coins || 0)
        + unlocks * 500
        + (data.rogueCleared ? 2000 : 0)
        + games * 10;
};

CloudSaveManager.isNewPlayer = function (data) {
    if (!data) return true;
    var games = (data.stats && data.stats.totalGames) || 0;
    var level = data.accountLevel || 1;
    var coins = data.coins || 0;
    return games === 0 && level <= 1 && coins === 0 && !data.rogueCleared;
};

CloudSaveManager._unlockKey = function (data) {
    var list = (data && data.unlockedCharacters) ? data.unlockedCharacters.slice() : [];
    list.sort();
    return list.join(',');
};

CloudSaveManager.savesAreEquivalent = function (local, cloud) {
    if (!local || !cloud) return false;
    if ((local.accountLevel || 1) !== (cloud.accountLevel || 1)) return false;
    if ((local.accountXP || 0) !== (cloud.accountXP || 0)) return false;
    if ((local.coins || 0) !== (cloud.coins || 0)) return false;
    if (!!local.rogueCleared !== !!cloud.rogueCleared) return false;
    if (!!local.tutorialDone !== !!cloud.tutorialDone) return false;
    if (CloudSaveManager._unlockKey(local) !== CloudSaveManager._unlockKey(cloud)) return false;

    var ls = local.stats || {};
    var cs = cloud.stats || {};
    if ((ls.totalGames || 0) !== (cs.totalGames || 0)) return false;
    if ((ls.totalWins || 0) !== (cs.totalWins || 0)) return false;
    if ((ls.totalKills || 0) !== (cs.totalKills || 0)) return false;
    if ((ls.totalDamage || 0) !== (cs.totalDamage || 0)) return false;
    return true;
};

CloudSaveManager.prototype.initialize = function () {
    this.app.cloudSaveManager = this;

    this._pm = null;
    this._authReady = false;
    this._synced = false;
    this._syncedUserId = null;
    this._preferCloudOnAccountLogin = false;
    this._uploadTimer = null;
    this._uploadPending = false;
    this._syncing = false;

    var self = this;
    this.app.on('auth:ready', this._onAuthReady, this);
    this.app.on('auth:error', this._onAuthError, this);
    this.app.on('auth:stateChanged', this._onAuthStateChanged, this);
    this.app.on('auth:emailLinked', this._onAuthIdentityChanged, this);

    if (typeof document !== 'undefined') {
        this._onVisibility = function () {
            if (!document.hidden) return;
            self.flushUpload();
        };
        document.addEventListener('visibilitychange', this._onVisibility);
    }

    setTimeout(function () {
        if (!self._synced) self._finishSyncLocalOnly('auth_timeout');
    }, 12000);
};

CloudSaveManager.prototype.destroy = function () {
    this.app.off('auth:ready', this._onAuthReady, this);
    this.app.off('auth:error', this._onAuthError, this);
    this.app.off('auth:stateChanged', this._onAuthStateChanged, this);
    this.app.off('auth:emailLinked', this._onAuthIdentityChanged, this);
    if (this._onVisibility) {
        document.removeEventListener('visibilitychange', this._onVisibility);
    }
    if (this._uploadTimer) clearTimeout(this._uploadTimer);
};

CloudSaveManager.prototype.onProgressionLoaded = function (pm) {
    this._pm = pm;
    if (this._synced) {
        pm._fireReady();
        return;
    }
    this._trySync();
};

CloudSaveManager.prototype._onAuthReady = function () {
    this._authReady = true;
    var auth = this.app.authManager;
    var uid = auth && auth.getUserId();
    try {
        if (typeof sessionStorage !== 'undefined'
            && sessionStorage.getItem('tk_prefer_cloud') === '1'
            && auth && auth.isAnonymous && !auth.isAnonymous()) {
            this._preferCloudOnAccountLogin = true;
            sessionStorage.removeItem('tk_prefer_cloud');
        }
    } catch (e) { /* ignore */ }
    if (this._synced && this._syncedUserId && uid && this._syncedUserId !== uid) {
        this._resyncForUserChange();
        return;
    }
    this._trySync();
};

CloudSaveManager.prototype._onAuthError = function () {
    this._finishSyncLocalOnly('auth_error');
};

/** Google 登入後 userId 變更 → 重拉該帳號雲端存檔 */
CloudSaveManager.prototype._onAuthStateChanged = function (payload) {
    var auth = this.app.authManager;
    var uid = (payload && payload.userId) || (auth && auth.getUserId());
    if (!uid) return;
    if (this._syncedUserId && this._syncedUserId === uid) return;
    if (this._synced && this._syncedUserId && this._syncedUserId !== uid) {
        console.log('[CloudSave] userId 變更，重新同步', this._syncedUserId, '→', uid);
        this._resyncForUserChange();
    }
};

CloudSaveManager.prototype._onAuthIdentityChanged = function () {
    var auth = this.app.authManager;
    var uid = auth && auth.getUserId();
    if (!uid) return;
    if (auth.isAnonymous && auth.isAnonymous()) return;
    // 綁定／登入 Google：強制再拉雲端
    console.log('[CloudSave] 帳號已連結 Google，重新同步');
    this._resyncForUserChange();
};

CloudSaveManager.prototype._resyncForUserChange = function () {
    this._synced = false;
    this._syncing = false;
    this._authReady = true;
    this._preferCloudOnAccountLogin = true;
    this._trySync();
};

CloudSaveManager.prototype._trySync = function () {
    if (this._synced || this._syncing) return;
    if (!this._pm || !this._authReady) return;
    this._doSync();
};

CloudSaveManager.prototype._doSync = function () {
    var self = this;
    var auth = this.app.authManager;
    var userId = auth && auth.getUserId();
    var client = auth && auth.getClient();

    if (!userId || !client) {
        this._finishSyncLocalOnly('no_user');
        return;
    }

    this._syncing = true;
    var localData = this._pm.getData();
    var preferCloud = !!this._preferCloudOnAccountLogin && auth.isAnonymous && !auth.isAnonymous();
    this._preferCloudOnAccountLogin = false;
    console.log('[CloudSave] 開始同步 user=', userId, 'anonymous=', !!(auth.isAnonymous && auth.isAnonymous()), 'preferCloud=', preferCloud);

    client.from('player_saves')
        .select('save_data, display_name, updated_at')
        .eq('user_id', userId)
        .maybeSingle()
        .then(function (result) {
            if (result.error) {
                console.warn('[CloudSave] 讀取失敗', result.error);
                self._finishSyncLocalOnly('fetch_error');
                return;
            }

            var row = result.data;
            if (!row || !row.save_data || Object.keys(row.save_data).length === 0) {
                console.log('[CloudSave] 無雲端存檔，上傳本地');
                self._syncedUserId = userId;
                self._applyAndFinish(localData, true);
                return;
            }

            var cloudData = row.save_data;
            // Google 帳號登入：優先套用該帳號雲端進度（仍合併 rogue 最高紀錄）
            if (preferCloud && !CloudSaveManager.isNewPlayer(cloudData)) {
                console.log('[CloudSave] Google 帳號登入，採用雲端存檔');
                CloudSaveManager.mergeRogueBestFields(cloudData, localData);
                self._syncedUserId = userId;
                self._applyAndFinish(cloudData, true);
                return;
            }

            self._resolveConflict(localData, cloudData, row.display_name).then(function (winner) {
                CloudSaveManager.mergeRogueBestFields(winner, localData);
                CloudSaveManager.mergeRogueBestFields(winner, cloudData);
                self._syncedUserId = userId;
                self._applyAndFinish(winner, true);
            });
        })
        .catch(function (e) {
            console.warn('[CloudSave] 同步例外', e);
            self._finishSyncLocalOnly('sync_exception');
        });
};

CloudSaveManager.prototype._resolveConflict = function (localData, cloudData) {
    if (CloudSaveManager.isNewPlayer(localData) && !CloudSaveManager.isNewPlayer(cloudData)) {
        return Promise.resolve(cloudData);
    }
    if (!CloudSaveManager.isNewPlayer(localData) && CloudSaveManager.isNewPlayer(cloudData)) {
        return Promise.resolve(localData);
    }
    if (CloudSaveManager.isNewPlayer(localData) && CloudSaveManager.isNewPlayer(cloudData)) {
        return Promise.resolve(localData);
    }

    if (CloudSaveManager.savesAreEquivalent(localData, cloudData)) {
        console.log('[CloudSave] 本地與雲端一致，跳過衝突');
        return Promise.resolve(localData);
    }

    var scoreLocal = CloudSaveManager.computeScore(localData);
    var scoreCloud = CloudSaveManager.computeScore(cloudData);

    if (this._needsUserConfirm(localData, cloudData, scoreLocal, scoreCloud)) {
        return this._showConflictModal(localData, cloudData, scoreLocal, scoreCloud);
    }

    return Promise.resolve(scoreLocal >= scoreCloud ? localData : cloudData);
};

CloudSaveManager.prototype._hasAsymmetricUnlocks = function (a, b) {
    var unlocksA = a.unlockedCharacters || [];
    var unlocksB = b.unlockedCharacters || [];
    var i;

    for (i = 0; i < unlocksA.length; i++) {
        if (unlocksB.indexOf(unlocksA[i]) === -1) return true;
    }
    for (i = 0; i < unlocksB.length; i++) {
        if (unlocksA.indexOf(unlocksB[i]) === -1) return true;
    }
    return false;
};

CloudSaveManager.prototype._needsUserConfirm = function (local, cloud, scoreLocal, scoreCloud) {
    if (CloudSaveManager.savesAreEquivalent(local, cloud)) return false;

    var scoreDiff = Math.abs(scoreLocal - scoreCloud);
    if (scoreDiff === 0) {
        // 分數相同但內容不同（例如角色統計）→ 不擋玩家，直接用本地
        return false;
    }

    if (this._hasAsymmetricUnlocks(local, cloud)) return true;
    if (!!local.rogueCleared !== !!cloud.rogueCleared) return true;

    var maxScore = Math.max(scoreLocal, scoreCloud, 1);
    var gap = scoreDiff / maxScore;
    if (gap <= CloudSaveManager.CONFIRM_SCORE_GAP
        && scoreLocal >= CloudSaveManager.MIN_SCORE_TO_CONFIRM
        && scoreCloud >= CloudSaveManager.MIN_SCORE_TO_CONFIRM) {
        return true;
    }

    return false;
};

CloudSaveManager.prototype._summaryLine = function (data, label) {
    var unlocks = (data.unlockedCharacters && data.unlockedCharacters.length) || 0;
    var games = (data.stats && data.stats.totalGames) || 0;
    return label + ': Lv' + (data.accountLevel || 1)
        + ' | ' + (data.coins || 0) + ' coins'
        + ' | ' + unlocks + ' chars'
        + ' | ' + games + ' games'
        + (data.rogueCleared ? ' | Rogue ✓' : '');
};

CloudSaveManager.prototype._showConflictModal = function (localData, cloudData, scoreLocal, scoreCloud) {
    var self = this;
    var recommended = scoreLocal >= scoreCloud ? 'local' : 'cloud';

    return new Promise(function (resolve) {
        if (typeof document === 'undefined') {
            resolve(recommended === 'local' ? localData : cloudData);
            return;
        }

        if (!document.getElementById('cloud-save-conflict-style')) {
            var st = document.createElement('style');
            st.id = 'cloud-save-conflict-style';
            st.innerHTML =
                '#cloud-save-modal{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.72);' +
                'display:flex;align-items:center;justify-content:center;font-family:"Microsoft JhengHei",sans-serif;}' +
                '#cloud-save-modal .csm-box{background:linear-gradient(180deg,#2a2018,#15100b);border:2px solid #c9a25a;' +
                'border-radius:12px;padding:24px 28px;max-width:420px;width:90%;color:#f0e6d0;box-shadow:0 8px 32px rgba(0,0,0,0.8);}' +
                '#cloud-save-modal h2{margin:0 0 12px;font-size:22px;color:#f5d27a;text-align:center;}' +
                '#cloud-save-modal p{margin:8px 0;font-size:14px;line-height:1.5;color:#ccc;}' +
                '#cloud-save-modal .csm-line{background:rgba(0,0,0,0.35);border-radius:6px;padding:10px 12px;margin:8px 0;font-size:13px;}' +
                '#cloud-save-modal .csm-rec{color:#7dcea0;font-size:12px;margin-bottom:14px;text-align:center;}' +
                '#cloud-save-modal .csm-btns{display:flex;gap:10px;margin-top:16px;}' +
                '#cloud-save-modal button{flex:1;padding:12px 8px;border-radius:8px;border:none;cursor:pointer;font-size:14px;font-weight:bold;}' +
                '#cloud-save-modal .csm-local{background:#2e6b3e;color:#fff;}' +
                '#cloud-save-modal .csm-cloud{background:#1e4a7a;color:#fff;}' +
                '#cloud-save-modal .csm-hint{text-align:center;font-size:11px;color:#888;margin-top:10px;}';
            document.head.appendChild(st);
        }

        var overlay = document.createElement('div');
        overlay.id = 'cloud-save-modal';
        overlay.innerHTML =
            '<div class="csm-box">' +
            '<h2>Save Conflict</h2>' +
            '<p>Progress found on this device and in the cloud. Which save should we keep?</p>' +
            '<div class="csm-line">' + self._summaryLine(localData, 'This Device') + '</div>' +
            '<div class="csm-line">' + self._summaryLine(cloudData, 'Cloud') + '</div>' +
            '<div class="csm-rec">Recommended: ' + (recommended === 'local' ? 'This Device' : 'Cloud') + ' (higher progress)</div>' +
            '<div class="csm-btns">' +
            '<button class="csm-local">Use This Device</button>' +
            '<button class="csm-cloud">Use Cloud</button>' +
            '</div>' +
            '<div class="csm-hint">You can link an account later to sync across devices.</div>' +
            '</div>';
        document.body.appendChild(overlay);

        var cleanup = function (choice) {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            resolve(choice === 'local' ? localData : cloudData);
        };

        var localBtn = overlay.querySelector('.csm-local');
        var cloudBtn = overlay.querySelector('.csm-cloud');
        window.UiTouch.markRoot(overlay);
        window.UiTouch.bindTap(localBtn, function () { cleanup('local'); });
        window.UiTouch.bindTap(cloudBtn, function () { cleanup('cloud'); });
    });
};

CloudSaveManager.prototype._applyAndFinish = function (data, upload) {
    if (this._pm && data) {
        this._pm.applyExternalData(data);
    }
    if (upload) {
        this.uploadNow();
    }
    this._finishSync('merged');
};

CloudSaveManager.prototype._finishSyncLocalOnly = function (reason) {
    console.log('[CloudSave] 本地模式 —', reason);
    this._finishSync('local_only');
};

CloudSaveManager.prototype._finishSync = function (mode) {
    if (this._synced) return;
    this._synced = true;
    this._syncing = false;
    this.app.fire('cloudSave:synced', { mode: mode });
    if (this._pm && this._pm._fireReady) {
        this._pm._fireReady();
    }
};

CloudSaveManager.prototype.scheduleUpload = function () {
    var self = this;
    this._uploadPending = true;
    if (this._uploadTimer) clearTimeout(this._uploadTimer);
    this._uploadTimer = setTimeout(function () {
        self._uploadTimer = null;
        if (self._uploadPending) self.uploadNow();
    }, CloudSaveManager.UPLOAD_DEBOUNCE_MS);
};

CloudSaveManager.prototype.flushUpload = function () {
    if (this._uploadTimer) {
        clearTimeout(this._uploadTimer);
        this._uploadTimer = null;
    }
    if (this._uploadPending) this.uploadNow();
};

CloudSaveManager.prototype._displayNameOf = function (data) {
    var displayName = (data && data.displayName) || '';
    try {
        var legacyName = localStorage.getItem('fk_player_name');
        if (legacyName && !displayName) displayName = legacyName;
    } catch (e) { /* ignore */ }
    return displayName;
};

// 衝突合併時保留兩邊較高的 rogue 紀錄（含角色／時間）
CloudSaveManager.mergeRogueBestFields = function (winner, other) {
    if (!winner) return winner;
    var ww = winner.rogueBestWave || 0;
    var ow = (other && other.rogueBestWave) || 0;
    if (ow > ww) {
        winner.rogueBestWave = ow;
        winner.rogueBestBrawler = other.rogueBestBrawler || '';
        winner.rogueBestAt = other.rogueBestAt || 0;
    } else if (ow === ww && ow > 0) {
        var wa = winner.rogueBestAt || 0;
        var oa = other.rogueBestAt || 0;
        if (oa > 0 && (wa === 0 || oa < wa)) {
            winner.rogueBestBrawler = other.rogueBestBrawler || winner.rogueBestBrawler || '';
            winner.rogueBestAt = oa;
        }
        if (!winner.rogueBestBrawler && other.rogueBestBrawler) {
            winner.rogueBestBrawler = other.rogueBestBrawler;
        }
    }
    return winner;
};

CloudSaveManager.prototype.uploadNow = function () {
    var auth = this.app.authManager;
    var pm = this._pm || this.app.progressionManager;
    if (!auth || !auth.getClient() || !auth.getUserId() || !pm) return;

    var userId = auth.getUserId();
    var data = pm.getData();
    if (!data) return;

    var displayName = this._displayNameOf(data);
    var bestAt = data.rogueBestAt || 0;
    var client = auth.getClient();
    var baseRow = {
        user_id: userId,
        display_name: displayName,
        save_data: data,
        save_version: 1
    };
    var fullRow = {
        user_id: userId,
        display_name: displayName,
        save_data: data,
        save_version: 1,
        rogue_best_wave: data.rogueBestWave || 0,
        rogue_best_brawler: data.rogueBestBrawler || '',
        rogue_best_at: bestAt > 0 ? new Date(bestAt).toISOString() : null
    };

    this._uploadPending = false;
    var self = this;

    var finishOk = function () {
        self.app.fire('cloudSave:uploaded');
    };
    var failPending = function (err) {
        console.warn('[CloudSave] 上傳失敗', err);
        self._uploadPending = true;
    };

    client.from('player_saves').upsert(fullRow, { onConflict: 'user_id' }).then(function (result) {
        if (!result.error) {
            finishOk();
            return;
        }
        // Schema 尚未加欄位時退回舊 upsert，避免整段存檔掛掉
        var msg = (result.error.message || '') + '';
        if (msg.indexOf('rogue_best') === -1) {
            failPending(result.error);
            return;
        }
        console.warn('[CloudSave] rogue 榜欄位尚未就緒，改用基本存檔上傳');
        return client.from('player_saves').upsert(baseRow, { onConflict: 'user_id' }).then(function (retry) {
            if (retry.error) failPending(retry.error);
            else finishOk();
        });
    }).catch(function (e) {
        failPending(e);
    });
};

// 全服 Rogue 最高層（需先在 Supabase 建欄位 + get_rogue_global_best RPC）
CloudSaveManager.prototype.fetchGlobalRogueBest = function () {
    var auth = this.app.authManager;
    var client = auth && auth.getClient();
    if (!client) return Promise.resolve(null);

    return client.rpc('get_rogue_global_best').then(function (result) {
        if (result.error) {
            console.warn('[CloudSave] 全服 rogue 榜讀取失敗', result.error);
            return null;
        }
        var rows = result.data;
        var row = Array.isArray(rows) ? rows[0] : rows;
        if (!row || !(row.rogue_best_wave > 0)) return null;
        var atMs = 0;
        if (row.rogue_best_at) {
            var parsed = Date.parse(row.rogue_best_at);
            if (!isNaN(parsed)) atMs = parsed;
        }
        return {
            displayName: row.display_name || '無名',
            wave: row.rogue_best_wave || 0,
            brawler: row.rogue_best_brawler || '',
            at: atMs
        };
    }).catch(function (e) {
        console.warn('[CloudSave] 全服 rogue 榜例外', e);
        return null;
    });
};

CloudSaveManager.prototype._rogueBuildShortCode = function() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var code = '';
    for (var i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

CloudSaveManager.prototype.uploadRogueBuild = function(snapshot) {
    var auth = this.app.authManager;
    var client = auth && auth.getClient();
    var userId = auth && auth.getUserId && auth.getUserId();
    if (!client || !userId || !snapshot) return Promise.resolve(null);

    var pm = this.app.progressionManager;
    var displayName = '無名';
    if (pm) {
        if (typeof pm.getDisplayName === 'function') displayName = pm.getDisplayName() || displayName;
        else if (pm.data && pm.data.displayName) displayName = pm.data.displayName;
    }

    var row = {
        short_code: this._rogueBuildShortCode(),
        user_id: userId,
        display_name: displayName,
        snapshot: snapshot,
        wave: snapshot.waves || 0,
        brawler: snapshot.hero || '',
        endless: !!snapshot.endless
    };

    return client.from('rogue_build_shares').insert(row).select('id, short_code').single().then(function(result) {
        if (result.error) {
            console.warn('[CloudSave] rogue build 上傳失敗', result.error);
            return null;
        }
        return {
            id: result.data.id,
            shortCode: result.data.short_code
        };
    }).catch(function(e) {
        console.warn('[CloudSave] rogue build 上傳例外', e);
        return null;
    });
};

CloudSaveManager.prototype.fetchRogueBuild = function(shortCode) {
    var auth = this.app.authManager;
    var client = auth && auth.getClient();
    if (!client || !shortCode) return Promise.resolve(null);
    var code = String(shortCode).trim().toUpperCase();

    return client.from('rogue_build_shares')
        .select('snapshot, display_name, wave, brawler, endless, created_at, short_code')
        .eq('short_code', code)
        .maybeSingle()
        .then(function(result) {
            if (result.error || !result.data) return null;
            var row = result.data;
            var snap = row.snapshot || {};
            snap.playerName = snap.playerName || row.display_name || '';
            snap.waves = snap.waves || row.wave || 0;
            snap.hero = snap.hero || row.brawler || '';
            snap.endless = snap.endless !== undefined ? snap.endless : !!row.endless;
            snap._cloudCode = row.short_code;
            return snap;
        }).catch(function(e) {
            console.warn('[CloudSave] fetchRogueBuild 例外', e);
            return null;
        });
};

CloudSaveManager.prototype.fetchRogueLeaderboard = function(limit) {
    var auth = this.app.authManager;
    var client = auth && auth.getClient();
    if (!client) return Promise.resolve([]);

    return client.rpc('get_rogue_leaderboard', { row_limit: limit || 10 }).then(function(result) {
        if (result.error) {
            console.warn('[CloudSave] leaderboard 讀取失敗', result.error);
            return [];
        }
        return result.data || [];
    }).catch(function() {
        return [];
    });
};
