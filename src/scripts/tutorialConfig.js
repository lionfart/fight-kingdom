/**
 * Fight Kingdom — 教學模式企劃資料（討論定稿 v1）
 * Phase B：玩家可見字串為 { zh, en }；以 TutorialConfig.loc / TKI18n.pick 取值。
 * 預設 zh；缺 en 時回退 zh。
 */
var TutorialConfig = {

    autoStart: true,
    isTutorialRunKey: 'tutorial_run',
    heroBrawlerType: 'guanyu',

    completionRewards: {
        coins: 150,
        xp: 80
    },

    lobbyGate: {
        title: { zh: '初出茅廬', en: 'First Steps' },
        body: {
            zh: '戰場兇險，先隨軍師練幾招再出征。約 3 分鐘，可跳過。',
            en: 'The field is fierce. Train a few moves with your advisor first — about 3 minutes, skippable.'
        },
        btnStart: { zh: '開始教學', en: 'Start tutorial' },
        btnSkip: { zh: '我已熟悉，跳過', en: 'I know this — skip' },
        btnSkipShort: { zh: '略過', en: 'Skip' },
        skipRewards: { coins: 30, xp: 20 }
    },

    waveScript: {
        name: { zh: '教學：初陣', en: 'Tutorial: First Clash' },
        announce: { zh: '軍師演武 — 初陣破敵', en: 'Advisor drill — break the first line' },
        rule: 'clear',
        skipOpeningDraft: true,
        suppressRecruitCards: true,
        intro: { duration: 2.0, action: 'attack', aim: 'player' },
        enemies: [
            {
                type: 'minion_melee',
                count: 1,
                placement: 'north',
                distance: 6,
                hpScale: 0.35,
                dmgScale: 0.25,
                speedScale: 0.6,
                canSuper: false,
                attackEvery: 5,
                noRegen: true
            },
            {
                type: 'minion_melee',
                count: 2,
                placement: 'ring',
                distance: 7,
                hpScale: 0.3,
                dmgScale: 0.2,
                speedScale: 0.65,
                canSuper: false,
                noRegen: true,
                _tutorialPhase: 'after_controls'
            }
        ]
    },

    steps: [
        {
            id: 'move',
            title: { zh: '拖曳走位', en: 'Drag to move' },
            body: { zh: '按住螢幕拖曳，角色會朝該方向移動。', en: 'Hold and drag — your fighter moves that way.' },
            bodyPc: { zh: '以 WASD 移動角色。', en: 'Use WASD to move.' },
            anchor: 'joystick',
            complete: { type: 'moveDistance', value: 2.0 },
            inputLock: false
        },
        {
            id: 'attack',
            title: { zh: '輕點攻擊', en: 'Tap to attack' },
            body: { zh: '輕點空白處普攻：依走位鎖定敵人（黃圈）。交戰中迴避不換鎖。設定可改「手動鎖定」並用換鎖鍵切目標。', en: 'Tap empty space to attack — locks by movement (yellow ring). While engaged, dodge keeps the same foe. Settings → Manual lock + cycle button to switch targets.' },
            bodyPc: { zh: '滑鼠左鍵普攻：依走位鎖定敵人（黃圈）。交戰中迴避不換鎖。設定可改手動鎖定（Tab 換鎖）。', en: 'Left-click to attack — locks by movement (yellow ring). Settings → Manual lock (Tab to cycle).' },
            anchor: 'screen_center',
            complete: { type: 'attackHit', value: 1 }
        },
        {
            id: 'ammo_count',
            title: { zh: '子彈數', en: 'Ammo count' },
            body: { zh: '畫面上的子彈點會顯示剩餘彈藥；打空後會自動裝填，避免空槍硬拚。', en: 'Ammo pips show remaining shots. When empty, reload starts automatically.' },
            bodyPc: { zh: '請留意剩餘彈藥；打空後會自動裝填。', en: 'Watch your remaining ammo; auto-reload starts when empty.' },
            anchor: 'screen_center',
            complete: { type: 'button', label: { zh: '了解子彈', en: 'Got ammo' } }
        },
        {
            id: 'dash',
            title: { zh: '快滑翻滾', en: 'Swipe to dodge' },
            body: { zh: '快速滑動一下可翻滾閃避（共 2 次充能）。', en: 'Quick-swipe to roll (2 charges).' },
            bodyPc: { zh: '快速雙按 W/A/S/D 翻滾；可按住兩鍵斜向翻滾。', en: 'Double-tap W/A/S/D to roll; hold two keys for diagonal.' },
            anchor: 'screen_center',
            complete: { type: 'dash', value: 1 },
            grantSuperCharge: false
        },
        {
            id: 'dodge_count',
            title: { zh: '迴避數', en: 'Dodge charges' },
            body: { zh: '迴避有充能上限，連續翻滾後會進入回復；保留至少 1 次可應對紅光攻擊。', en: 'Dodges are charge-based. Keep at least one charge for dangerous wind-ups.' },
            bodyPc: { zh: '翻滾屬於充能技能；用完需等待回復。', en: 'Dodge uses charges and needs time to recover.' },
            anchor: 'screen_center',
            complete: { type: 'button', label: { zh: '了解迴避', en: 'Got dodge' } }
        },
        {
            id: 'super',
            title: { zh: '必殺技', en: 'Super' },
            body: { zh: '氣滿後點右下角 SP 施放必殺。', en: 'When charged, tap SP (bottom-right) to unleash your super.' },
            bodyPc: { zh: '氣滿後滑鼠右鍵施放必殺。', en: 'When charged, right-click to unleash your super.' },
            anchor: 'sp_button',
            complete: { type: 'super', value: 1 },
            grantSuperCharge: true
        },
        {
            id: 'spawn_phase_a',
            title: { zh: '敵軍來襲', en: 'Enemy incoming' },
            body: { zh: '注意紅光！敵人蓄力時快滑翻滾，可完美閃避。', en: 'Watch the red glow! Roll during the wind-up for a perfect dodge.' },
            anchor: 'banner',
            complete: { type: 'auto', delay: 2.0 },
            spawnWavePhase: 'phase_a'
        },
        {
            id: 'perfect_dodge',
            title: { zh: '完美閃避', en: 'Perfect dodge' },
            body: { zh: '紅光期間翻滾成功，反擊可暈眩敵人。再試一次！', en: 'Roll during the glow to stun on counter. Try again!' },
            anchor: 'enemy_glow',
            complete: { type: 'perfectDodge', value: 1, optional: false },
            hint: 'minion_melee 紅光較長，適合練習'
        },
        {
            id: 'clear_wave',
            title: { zh: '殲滅敵軍', en: 'Clear the foes' },
            body: { zh: '殲滅所有敵軍即可過關。', en: 'Defeat every enemy to clear the wave.' },
            anchor: 'hud_objective',
            complete: { type: 'waveClear' },
            spawnWavePhase: 'phase_b'
        },
        {
            id: 'opening_card',
            title: { zh: '軍師獻策', en: 'Advisor’s counsel' },
            body: { zh: '選一張計策強化本局。點卷軸預覽，再按確認。', en: 'Pick a stratagem. Tap a scroll to preview, then confirm.' },
            anchor: 'rogue_cards',
            complete: { type: 'cardConfirmed', value: 1 },
            simplifiedDraft: true
        },
        {
            id: 'complete',
            title: { zh: '教學完成', en: 'Tutorial complete' },
            body: {
                zh: '你已掌握基礎！群雄集結中可招募友軍、收集計策、挑戰更強波次。',
                en: 'Basics locked in! In Rogue, recruit allies, gather stratagems, and face tougher waves.'
            },
            anchor: 'fullscreen',
            complete: {
                type: 'button',
                label: { zh: '進入群雄集結', en: 'Enter Rogue' }
            }
        }
    ],

    contextualTips: [
        { id: 'tip_super_charge', title: { zh: '蓄氣', en: 'Charge' }, body: { zh: '對敵造成傷害可蓄必殺，滿後 SP 會發光。', en: 'Deal damage to charge your super — SP glows when ready.' }, anchor: 'super_ring' },
        { id: 'tip_dash_empty', title: { zh: '翻滾冷卻', en: 'Dodge cooldown' }, body: { zh: '翻滾用盡後需等待回復。', en: 'Out of rolls — wait to recharge.' }, anchor: 'dodge_ui' },
        { id: 'tip_rogue_objective_clear', title: { zh: '過關條件', en: 'Clear' }, body: { zh: '殲滅所有敵軍。', en: 'Defeat all enemies.' }, anchor: 'hud_objective' },
        { id: 'tip_rogue_objective_survive', title: { zh: '堅守陣地', en: 'Hold the line' }, body: { zh: '撐到倒數結束即過關。', en: 'Survive until the timer ends.' }, anchor: 'hud_objective' },
        { id: 'tip_rogue_objective_kill', title: { zh: '斬將', en: 'Slay the mark' }, body: { zh: '擊殺標記 ★ 的敵將即可過關。', en: 'Kill the ★ marked champion.' }, anchor: 'hud_objective' },
        { id: 'tip_rogue_objective_reach', title: { zh: '佔領要地', en: 'Seize the ground' }, body: { zh: '進入光圈並站穩數秒即過關。', en: 'Stand in the circle for a few seconds.' }, anchor: 'goal_zone' },
        { id: 'tip_rogue_draft', title: { zh: '波後犒賞', en: 'Wave reward' }, body: { zh: '每波結束三選一，確認後才生效。', en: 'After each wave, pick one — confirm to apply.' }, anchor: 'rogue_cards' },
        { id: 'tip_rogue_recruit', title: { zh: '招募友軍', en: 'Recruit' }, body: { zh: '招募的武將會跟隨作戰，編制上限 4 人。', en: 'Recruits fight beside you (squad cap 4).' }, anchor: 'rogue_cards' },
        { id: 'tip_rogue_synergy_shu', title: { zh: '桃園結義', en: 'Peach Garden' }, body: { zh: '蜀陣營 2 人：血量 +30%，傷害 +10%。', en: '2 Shu: +30% HP, +10% damage.' }, anchor: 'toast' },
        { id: 'tip_rogue_synergy_wei', title: { zh: '虎豹騎', en: 'Tiger Cavalry' }, body: { zh: '魏陣營 2 人：血量 +20%，傷害 +20%。', en: '2 Wei: +20% HP, +20% damage.' }, anchor: 'toast' },
        { id: 'tip_rogue_synergy_qun', title: { zh: '亂世梟雄', en: 'Warlords' }, body: { zh: '群陣營 2 人：傷害 +40%。', en: '2 Qun: +40% damage.' }, anchor: 'toast' },
        { id: 'tip_rogue_coins', title: { zh: '軍餉', en: 'Coin' }, body: { zh: '擊殺與過波獲得，可復活陣亡友軍。', en: 'Earn from kills and clears — spend to revive allies.' }, anchor: 'rogue_coins' },
        { id: 'tip_rogue_revive', title: { zh: '陣亡可復活', en: 'Revive' }, body: { zh: '點擊灰化頭像，花 20 金幣可喚回。', en: 'Tap a greyed portrait — 20 coin to revive.' }, anchor: 'squad_chip' },
        { id: 'tip_rogue_quit', title: { zh: '鳴金收兵', en: 'Withdraw' }, body: { zh: '安全撤退可帶走已入帳軍餉。', en: 'Safe retreat keeps banked coin.' }, anchor: 'quit_dialog' },
        { id: 'tip_rogue_death', title: { zh: '兵敗身死', en: 'Fallen' }, body: { zh: '群雄集結中陣亡即本局結束。', en: 'In Rogue, death ends the run.' }, anchor: 'fullscreen' },
        { id: 'tip_perfect', title: { zh: '完美閃避', en: 'Perfect dodge' }, body: { zh: '紅光時翻滾成功！反擊可暈眩敵人。', en: 'Rolled on the glow — counter can stun.' }, anchor: 'center' },
        { id: 'tip_bush', title: { zh: '草叢隱蔽', en: 'Brush' }, body: { zh: '草叢內對叢外隱形；攻擊會短暫現形。', en: 'Hidden in brush vs outside; attacking reveals you briefly.' }, anchor: 'player' },
        { id: 'tip_unlock', title: { zh: '解鎖武將', en: 'Unlock fighters' }, body: { zh: '消耗軍餉或達等級可解鎖武將。', en: 'Spend coin or reach levels to unlock fighters.' }, anchor: 'roster_card' },
        { id: 'tip_camera', title: { zh: '視角模式', en: 'Camera' }, body: { zh: '標準／近戰／開闊／俯瞰，依習慣切換。', en: 'Standard / Close / Wide / Top-down — pick your view.' }, anchor: 'settings_camera' }
    ],

    pvpBriefings: {
        '3V3_BOUNTY': {
            title: { zh: '奪寶致勝', en: 'Seize the gems' },
            body: { zh: '收集寶石，先達 15 顆的隊伍需再守住 15 秒即勝。', en: 'Collect gems. First to 15 must hold the lead for 15 seconds.' }
        },
        '3V3_KNOCKOUT': {
            title: { zh: '背水一戰', en: 'No retreat' },
            body: { zh: '每回合 60 秒，全滅敵隊得 1 分，三戰兩勝。', en: '60s rounds. Wipe the enemy for a point — best of three.' }
        },
        'FFA': {
            title: { zh: '剩者為王', en: 'Last one standing' },
            body: { zh: '僅一條命，死亡可結算或觀戰至結束。', en: 'One life. On death, finish now or spectate to the end.' }
        }
    },

    ui: {
        gotIt: { zh: '知道了', en: 'Got it' },
        confirm: { zh: '確認', en: 'Confirm' },
        skipAria: { zh: '略過教學', en: 'Skip tutorial' }
    },

    storage: {
        tipsSeen: 'tk_tutorial_tips_seen',
        done: 'fk_tutorial_done'
    }
};

/** Resolve string or { zh, en } for current lang. */
TutorialConfig.loc = function (v) {
    if (v == null) return '';
    if (typeof v === 'string' || typeof v === 'number') return String(v);
    if (window.TKI18n && typeof window.TKI18n.pick === 'function') return window.TKI18n.pick(v);
    if (typeof v === 'object') {
        if (v.zh != null) return String(v.zh);
        if (v['zh-TW'] != null) return String(v['zh-TW']);
        if (v.en != null) return String(v.en);
    }
    return '';
};

window.TutorialConfig = TutorialConfig;
