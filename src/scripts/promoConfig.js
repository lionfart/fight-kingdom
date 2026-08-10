/**
 * Fight Kingdom — 宣傳拍攝分鏡 v2
 * Threads / Reels / Shorts 直式 9:16（約 16s）
 *
 * 結構：Hook(0-2) → 玩法(2-7) → 爽點(7-9.5) → 賣點(9.5-14) → CTA(14-16)
 * 改 activeVariant 或 URL ?promo=1&variant=B 切換 Hook。
 * notes / audioHints 僅給後製參考，runtime 不讀。
 */
var PromoConfig = {

    heroBrawlerType: 'lubu',
    mode: 'FFA',

    duration: 16,
    brandHold: 1.5,

    // 品牌對齊現況；賣點文案用口語
    brandTitle: 'FIGHT KINGDOM',
    brandTagline: '單手三國 · 免課金買斷',
    cta: 'FIGHT KINGDOM — 立即試玩',
    ctaUrl: '',

    showSubtitles: true,
    showSafeFrame: true,

    /**
     * cam: closeup | pull | follow | high | low | shakeZoom | brand
     * action: attack | super | dash | cycle | none
     * actionCycle: 當 action==='cycle' 時輪播，如 ['attack','dash']
     * duel: { opponent, distance, immortal, canSuper } — 清場只留一名武將單挑（duelAi）
     * overlay.style: impact | tag | highlight | brand | none
     */
    beats: [
        // HOOK
        {
            t: 0,
            cam: 'low',
            subtitle: '',
            action: 'attack',
            botsFight: true,
            overlay: { text: '單手就能打', style: 'impact', position: 'center', duration: 1.8 }
        },
        // 玩法：雙武將單挑（攻＋閃）
        {
            t: 2.0,
            cam: 'follow',
            subtitle: '',
            action: 'cycle',
            actionCycle: ['attack', 'dash', 'attack', 'dash', 'attack'],
            actionCycleInterval: 0.75,
            botsFight: true,
            showThumbHint: true,
            duel: {
                opponent: 'guanyu',
                distance: 5.5,
                immortal: true,
                canSuper: false
            },
            overlay: { text: '單手攻防 · 閃避反打', style: 'tag', position: 'bottom', duration: 2.3 }
        },
        // 單挑續段：換對手、鏡頭拉開
        {
            t: 4.5,
            cam: 'pull',
            subtitle: '',
            action: 'cycle',
            actionCycle: ['dash', 'attack', 'dash', 'attack', 'dash', 'attack'],
            actionCycleInterval: 0.7,
            botsFight: true,
            showAffixDraft: false,
            duel: {
                opponent: 'zhangfei',
                distance: 5.0,
                immortal: true,
                canSuper: false
            },
            overlay: { text: '武將對決 · 一觸即發', style: 'tag', position: 'top', duration: 2.3 }
        },
        // 爽點：大招
        {
            t: 7.0,
            cam: 'shakeZoom',
            subtitle: '',
            action: 'super',
            botsFight: true,
            slowmo: { start: 7.8, end: 8.5, factor: 0.35 },
            overlay: { text: '大招毀天滅地', style: 'impact', position: 'center', duration: 1.5 }
        },
        // 差異化
        {
            t: 9.5,
            cam: 'follow',
            subtitle: '',
            action: 'attack',
            botsFight: true,
            overlay: { text: '買斷制 · 零課金 · 零抽卡', style: 'highlight', position: 'center', duration: 2.3 }
        },
        // 多角色快切
        {
            t: 12.0,
            cam: 'pull',
            subtitle: '',
            action: 'attack',
            botsFight: true,
            heroSwap: ['zhangliao', 'diaochan', 'guanyu', 'zhangfei', 'zhangjiao'],
            heroSwapInterval: 0.65,
            overlay: { text: '多位三國武將', style: 'tag', position: 'bottom', duration: 1.8 }
        },
        // CTA
        {
            t: 14.0,
            cam: 'brand',
            subtitle: '',
            action: 'none',
            botsFight: false,
            brand: true,
            overlay: { text: '', style: 'brand' }
        }
    ],

    audioHints: {
        bgmBPM: 130,
        sfxCues: [
            { t: 0, sfx: 'sword_slash' },
            { t: 2.0, sfx: 'whoosh' },
            { t: 4.5, sfx: 'scroll_open' },
            { t: 7.0, sfx: 'super_charge' },
            { t: 7.8, sfx: 'super_hit_impact' },
            { t: 9.5, sfx: 'coin_rain' },
            { t: 14.0, sfx: 'drum_final' }
        ]
    },

    activeVariant: 'A',
    variants: {
        A: {
            heroBrawlerType: 'lubu',
            hookOverlay: '單手就能打'
        },
        B: {
            heroBrawlerType: 'diaochan',
            hookOverlay: '她變身了…',
            beats_override: [
                {
                    t: 0, cam: 'closeup', action: 'none', botsFight: false, subtitle: '',
                    overlay: { text: '她變身了…', style: 'impact', position: 'center', duration: 1.5 }
                },
                {
                    t: 1.5, cam: 'shakeZoom', action: 'super', botsFight: true, subtitle: '',
                    overlay: { text: '', style: 'none' }
                }
            ]
        },
        C: {
            heroBrawlerType: 'guanyu',
            hookOverlay: '仲課緊金？',
            beats_override: [
                {
                    t: 0, cam: 'high', action: 'attack', botsFight: true, subtitle: '',
                    overlay: { text: '仲課緊金？', style: 'impact', position: 'center', duration: 1.8 }
                },
                {
                    t: 2.0, cam: 'follow', action: 'attack', botsFight: true, subtitle: '',
                    showThumbHint: true,
                    overlay: { text: '買斷玩到尾 · 零抽卡', style: 'tag', position: 'bottom', duration: 2.3 }
                }
            ]
        }
    }
};

if (typeof window !== 'undefined') window.PromoConfig = PromoConfig;
