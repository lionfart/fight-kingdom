// ═══════════════════════════════════════════════════════════════
// WordConfig — Rogue word cards (Phase 2)
// faction = tactical school (Might / Fort / Swift / Arcane)
// exclusiveGroup + crossExclusive: flat vs scaling mutual exclusion
// ═══════════════════════════════════════════════════════════════
var WordConfig = {
    maxCards: 4,
    openingPicks: 2,
    upgradeBonusPerLevel: 0.5,
    rarityWeights: { N: 1, R: 0.32, SR: 0.10, SSR: 0.04 },
    pityWavesWithoutR: 4,
    // 波間選卡：可抽種類公平組卡後的安全網（精煉／未見新詞）
    pitySoftWaves: 3,
    pityHardWaves: 5,
    pitySoftChance: 0.7,
    // 波間本命覺醒：非每波必出；連續未出後保底
    signatureUpgradeChance: 0.28,
    signatureUpgradePityWaves: 5,

    // 術系符咒系：必須先擁有符咒，其餘術系觸發/散布卡才會出現在池內
    shuProcRoot: 'shu_sigil_n',
    // 守系護盾根：必須先有銅牆鐵壁，逆鱗／破釜才會進池（破甲打敵盾不閘）
    tiShieldRoot: 'ti_iron_wall_r',

    // 學派共鳴：≥2 張可計數同派 → 自動獲得該派完整收尾（與實體卡同效果）
    // entityCardIds 不計入共鳴進度；先有實體再共鳴 → 吸收還格
    schoolFinishers: {
        shu: { label: { zh: '續燃', en: 'Afterburn' }, effectKey: 'fireSustain', entityCardIds: [] },
        wu:  { label: { zh: '破綻', en: 'Breach' }, effectKey: 'breachWindow', entityCardIds: ['wu_breach_n'] },
        ti:  { label: { zh: '逆鱗', en: 'Scale' }, effectKey: 'scaleCounter', entityCardIds: ['ti_scale_n'] },
        su:  { label: { zh: '風返', en: 'Wind Return' }, effectKey: 'windReturn', entityCardIds: ['su_wind_return_n'] }
    },
    // 無實體卡的收尾（續燃）：共鳴／符咒精煉共用
    finisherEffects: {
        fireSustain: {
            // burnDmgMul：Lv0=1（不加傷）；精煉後 × effectScale
            pve: { extendSec: 0.35, icdMs: 800, burnDmgMul: 1 },
            pvp: { extendSec: 0.25, icdMs: 1000, burnDmgMul: 1 }
        }
    },
    // 符咒精煉 ≥ 此等級解鎖續燃（0=持有即有；1=第一次精煉）
    fireSustainSigilMinLevel: 1,
    // 共鳴收尾精煉無上限（Infinity）
    maxFinisherRefine: Infinity,

    // Groups that cannot coexist (e.g. flat dmg vs scaling dmg)
    crossExclusive: [
        ['dmg_flat', 'dmg_scaling'],
        ['proc_flat', 'proc_scaling'],
        ['surv_mitigation_flat', 'surv_hp_scaling'],
        ['surv_hp_flat', 'surv_hp_scaling']
    ],

    factions: {
        wu:  { label: { zh: '武', en: 'Might' }, seal: '武', sub: '', color: '#b0342a', edge: '#e08a7a' },
        ti:  { label: { zh: '守', en: 'Fort' }, seal: '守', sub: '', color: '#2b6ba3', edge: '#8fb8d8' },
        su:  { label: { zh: '疾', en: 'Swift' }, seal: '疾', sub: '', color: '#3f7d4a', edge: '#8fc199' },
        shu: { label: { zh: '術', en: 'Arcane' }, seal: '術', sub: '', color: '#7a4f9e', edge: '#b79bd0' }
    },

    cards: {
        wu_break_n: {
            id: 'wu_break_n', name: { zh: '突破', en: 'Breach' }, faction: 'wu', line: 'damage',
            rarity: 'N', cost: 1, type: 'fixed', power: 17,
            exclusiveGroup: 'dmg_flat',
            crossExclusive: ['dmg_scaling'],
            readableTag: 'red-pierce',
            growthCore: true,
            cardDesc: { zh: '全軍加傷；精煉解鎖對盾／破盾加成', en: 'Army damage up; refine unlocks vs-shield / shield-break bonuses' },
            breakTiers: [
                { desc: { zh: '+12% 全軍傷害', en: '+12% army damage' }, pve: { dmgMul: 1.12 }, pvp: { dmgMul: 1.08 } },
                { desc: { zh: '+12% 全軍 · 對護盾 +15%', en: '+12% army · +15% vs shields' }, pve: { dmgMul: 1.12, bonusVsShield: 0.15 }, pvp: { dmgMul: 1.08, bonusVsShield: 0.10 } },
                { desc: { zh: '+12% 全軍 · 對盾 +15% · 破盾 +18%', en: '+12% army · +15% vs shields · +18% on break' }, pve: { dmgMul: 1.12, bonusVsShield: 0.15, onShieldBreakDmgPct: 0.18 }, pvp: { dmgMul: 1.08, bonusVsShield: 0.10, onShieldBreakDmgPct: 0.10 } }
            ],
            pve: { dmgMul: 1.12 }, pvp: { dmgMul: 1.08 }
        },
        wu_combo_n: {
            id: 'wu_combo_n', name: { zh: '連段', en: 'Combo' }, faction: 'wu', line: 'damage',
            rarity: 'N', cost: 1, type: 'scaling', power: 10,
            exclusiveGroup: 'dmg_scaling',
            crossExclusive: ['dmg_flat'],
            readableTag: 'red-squad',
            pve: { perAlly: { dmgMul: 0.05 } }, pvp: { perAlly: { dmgMul: 0.04 } }
        },
        ti_wall_n: {
            id: 'ti_wall_n', name: { zh: '鐵壁', en: 'Iron Wall' }, faction: 'ti', line: 'survival',
            rarity: 'N', cost: 1, type: 'fixed', power: 16,
            exclusiveGroup: 'surv_mitigation_flat',
            readableTag: 'blue-shield',
            pve: { damageTakenMul: 0.90 }, pvp: { damageTakenMul: 0.92 }
        },
        ti_shield_n: {
            id: 'ti_shield_n', name: { zh: '壁壘', en: 'Bulwark' }, faction: 'ti', line: 'survival',
            rarity: 'N', cost: 1, type: 'fixed', power: 15,
            exclusiveGroup: 'surv_hp_flat',
            crossExclusive: ['surv_hp_scaling'],
            readableTag: 'blue-hp',
            pve: { hpMul: 1.10 }, pvp: { hpMul: 1.08 }
        },
        ti_formation_n: {
            id: 'ti_formation_n', name: { zh: '陣型', en: 'Formation' }, faction: 'ti', line: 'survival',
            rarity: 'N', cost: 1, type: 'scaling', power: 10,
            exclusiveGroup: 'surv_hp_scaling',
            crossExclusive: ['surv_hp_flat'],
            readableTag: 'blue-squad',
            pve: { perAlly: { hpMul: 0.06 } }, pvp: { perAlly: { hpMul: 0.05 } }
        },
        su_rapid_n: {
            id: 'su_rapid_n', name: { zh: '速射', en: 'Rapid Fire' }, faction: 'su', line: 'speed',
            rarity: 'N', cost: 1, type: 'fixed', power: 15,
            readableTag: 'green-reload',
            cardDesc: { zh: '裝填與回避回充加速；精煉至 3 級：彈匣與回避上限各 +1', en: 'Faster reload & dodge recharge; Lv3: +1 ammo & dodge charge' },
            // level 0/1/2 → 第三檔（精煉 2＝Lv3）解鎖資源上限
            rapidTiers: [
                { reloadMul: 1.22, dashRechargeMul: 1.22, ammoBonus: 0, dashChargesBonus: 0, desc: { zh: '裝填／回避回充 +22%', en: 'Reload / dash recharge +22%' } },
                { reloadMul: 1.26, dashRechargeMul: 1.26, ammoBonus: 0, dashChargesBonus: 0, desc: { zh: '裝填／回避回充 +26%', en: 'Reload / dash recharge +26%' } },
                { reloadMul: 1.26, dashRechargeMul: 1.26, ammoBonus: 1, dashChargesBonus: 1, desc: { zh: '回充 +26%；彈匣與回避上限各 +1', en: 'Recharge +26%; +1 ammo & dash charge' } }
            ],
            pve: { reloadMul: 1.22, dashRechargeMul: 1.22 },
            pvp: { reloadMul: 1.15, dashRechargeMul: 1.15 }
        },
        su_veil_n: {
            id: 'su_veil_n', name: { zh: '風幕', en: 'Wind Veil' }, faction: 'su', line: 'speed',
            rarity: 'N', cost: 1, type: 'fixed', power: 14,
            readableTag: 'green-dodge',
            pve: { dodgeChance: 0.10, speedMul: 1.05 },
            pvp: { dodgeChance: 0.08, speedMul: 1.04 }
        },
        shu_sigil_n: {
            id: 'shu_sigil_n', name: { zh: '符咒', en: 'Sigil' }, faction: 'shu', line: 'dot',
            rarity: 'N', cost: 1, type: 'fixed', power: 16,
            exclusiveGroup: 'proc_flat',
            crossExclusive: ['proc_scaling'],
            readableTag: 'purple-sigil',
            growthCore: true,
            cardDesc: { zh: '術系核心：精煉擴展段數與散射；精煉可解鎖續燃（不另佔手牌）', en: 'Arcane core: refine extends hits & spread; refine unlocks Afterburn (no extra card slot)' },
            // Lv1→2→3：首段1枚 → 首二段各1枚 → 首二段各2枚（單發約75%）；大招不發符
            procTriggerTiers: [
                { maxComboIndex: 0, spreadCount: 1, damagePctMul: 1.0, desc: { zh: '首段連擊：1 枚符彈 + 灼燒', en: 'First combo hit: 1 sigil bolt + burn' } },
                { maxComboIndex: 1, spreadCount: 1, damagePctMul: 1.0, desc: { zh: '首、二段連擊：各 1 枚符彈 · 續燃', en: 'Hits 1–2: 1 sigil each · Afterburn' } },
                { maxComboIndex: 1, spreadCount: 2, damagePctMul: 0.75, spreadAngle: 16, desc: { zh: '首、二段：各 2 枚散射 · 續燃', en: 'Hits 1–2: 2-bolt spread each · Afterburn' } }
            ],
            pve: {
                onBasicProc: {
                    trigger: 'first_in_combo',
                    bulletKey: 'arcane_sigil',
                    attackPattern: 'normal',
                    damagePct: 0.38,
                    bulletSpeed: 22,
                    spreadAngle: 14,
                    dotConfig: { type: 'burn', duration: 2.5, tickRate: 0.5, damagePerTick: 45 }
                }
            },
            pvp: {
                onBasicProc: {
                    trigger: 'first_in_combo',
                    bulletKey: 'arcane_sigil',
                    attackPattern: 'normal',
                    damagePct: 0.30,
                    bulletSpeed: 20,
                    spreadAngle: 12,
                    dotConfig: { type: 'burn', duration: 2.0, tickRate: 0.5, damagePerTick: 32 }
                }
            }
        },
        // 已併入符咒精煉，不再進抽卡池（舊局遷移時會轉成符咒等級）
        shu_echo_n: {
            id: 'shu_echo_n', name: { zh: '追符', en: 'Echo Sigil' }, faction: 'shu', line: 'dot',
            rarity: 'N', cost: 1, type: 'fixed', power: 12,
            retired: true,
            requiresCard: 'shu_sigil_n',
            readableTag: 'purple-echo',
            cardDesc: { zh: '（已併入符咒精煉）', en: '(Merged into Sigil refine)' },
            procTriggerTiers: [
                { maxComboIndex: 1, desc: { zh: '首、二段連擊皆發符', en: 'Hits 1–2 both fire sigils' } },
                { maxComboIndex: 2, desc: { zh: '三段連擊皆發符', en: 'All three combo hits fire sigils' } },
                { maxComboIndex: 2, superProc: true, desc: { zh: '三段連擊＋大招皆發符', en: 'All combo hits + Super fire sigils' } }
            ]
        },
        shu_volley_n: {
            id: 'shu_volley_n', name: { zh: '散符', en: 'Volley Sigil' }, faction: 'shu', line: 'dot',
            rarity: 'N', cost: 1, type: 'fixed', power: 13,
            retired: true,
            requiresCard: 'shu_sigil_n',
            exclusiveGroup: 'shu_proc_spread',
            readableTag: 'purple-volley',
            cardDesc: { zh: '（已併入符咒精煉）', en: '(Merged into Sigil refine)' },
            procSpreadCount: 2,
            procSpreadMax: 3,
            procSpreadAngle: 16
        },
        shu_chain_n: {
            id: 'shu_chain_n', name: { zh: '連環火花', en: 'Chain Spark' }, faction: 'shu', line: 'dot',
            rarity: 'N', cost: 1, type: 'scaling', power: 10,
            requiresCard: 'shu_sigil_n',
            exclusiveGroup: 'proc_scaling',
            crossExclusive: ['proc_flat'],
            readableTag: 'purple-squad',
            cardDesc: { zh: '每名友軍 +6% 符咒觸發傷害', en: '+6% sigil proc damage per ally' },
            pve: { perAlly: { procDamagePct: 0.06 } },
            pvp: { perAlly: { procDamagePct: 0.05 } }
        },

        // ── Phase 2 R cards ─────────────────────────────────────
        ti_iron_wall_r: {
            id: 'ti_iron_wall_r', name: { zh: '銅牆鐵壁', en: 'Bronze Rampart' }, faction: 'ti', line: 'survival',
            rarity: 'N', cost: 1, type: 'fixed', power: 18,
            readableTag: 'blue-shield-r',
            pvpEligible: true,
            growthCore: true,
            cardDesc: { zh: '全隊獲得護盾上限；精煉提升盾量與全隊傷害', en: 'Team shield cap; refine raises shield & team damage' },
            benevolenceTiers: [
                { desc: { zh: '全隊護盾上限 25%', en: 'Team shield cap 25%' }, pve: { shieldMaxPct: 0.25 }, pvp: { shieldMaxPct: 0.18 } },
                { desc: { zh: '全隊盾上限 28% · 全隊傷害 +4%', en: 'Team shield 28% · team damage +4%' }, pve: { shieldMaxPct: 0.28, dmgMul: 1.04 }, pvp: { shieldMaxPct: 0.20, dmgMul: 1.03 } },
                { desc: { zh: '全隊盾上限 30% · 全隊傷害 +6%', en: 'Team shield 30% · team damage +6%' }, pve: { shieldMaxPct: 0.30, dmgMul: 1.06 }, pvp: { shieldMaxPct: 0.22, dmgMul: 1.05 } }
            ],
            pve: { shieldMaxPct: 0.25 },
            pvp: { shieldMaxPct: 0.18 }
        },
        wu_pierce_r: {
            id: 'wu_pierce_r', name: { zh: '破甲', en: 'Armor Break' }, faction: 'wu', line: 'damage',
            rarity: 'R', cost: 2, type: 'fixed', power: 18,
            readableTag: 'red-pierce-r',
            pvpEligible: true,
            retired: true,
            cardDesc: { zh: '（已併入突破精煉）', en: '(Merged into Breach refine)' },
            pve: { bonusVsShield: 0.27, onShieldBreakDmgPct: 0.10 },
            pvp: { bonusVsShield: 0.13, onShieldBreakDmgPct: 0.06 }
        },
        wu_hamstring_r: {
            id: 'wu_hamstring_r', name: { zh: '斷筋', en: 'Hamstring' }, faction: 'wu', line: 'damage',
            rarity: 'R', cost: 2, type: 'fixed', power: 16,
            exclusiveGroup: 'crit_core_r',
            readableTag: 'red-crit-r',
            pve: { critChance: 0.12 },
            pvp: { critChance: 0.08 },
            onCrit: { snareDuration: 2.0, snareMultiplier: 0.7 }
        },
        su_mirage_r: {
            id: 'su_mirage_r', name: { zh: '幻影鋒', en: 'Mirage Edge' }, faction: 'su', line: 'speed',
            rarity: 'R', cost: 2, type: 'fixed', power: 17,
            exclusiveGroup: 'crit_core_r',
            readableTag: 'green-mirage-r',
            pvpEligible: true,
            pve: { dodgeChance: 0.14, critChance: 0.12 },
            pvp: { dodgeChance: 0.10, critChance: 0.08 }
        },
        shu_focus_r: {
            id: 'shu_focus_r', name: { zh: '凝神符', en: 'Focus Sigil' }, faction: 'shu', line: 'dot',
            rarity: 'R', cost: 2, type: 'fixed', power: 14,
            exclusiveGroup: 'crit_core_r',
            readableTag: 'purple-crit-r',
            pve: { critChance: 0.15, critMul: 1.5 },
            pvp: { critChance: 0.10, critMul: 1.35 }
        },

        // ── Trigger / aura cards ─────────────────────────────────
        wu_slayer_r: {
            id: 'wu_slayer_r', name: { zh: '獵首', en: 'Slayer' }, faction: 'wu', line: 'damage',
            rarity: 'R', cost: 2, type: 'fixed', power: 17,
            readableTag: 'red-execute-r',
            pvpEligible: true,
            cardDesc: { zh: '對血量低於 25% 的敵人 +55% 傷害（每目標 8 秒冷卻）', en: '+55% damage vs foes below 25% HP (8s CD per target)' },
            pve: { execute: { threshold: 0.25, bonusDmg: 0.55, cooldownMs: 8000 } },
            pvp: { execute: { threshold: 0.25, bonusDmg: 0.28, cooldownMs: 8000 } }
        },
        wu_carnage_n: {
            id: 'wu_carnage_n', name: { zh: '殺戮', en: 'Carnage' }, faction: 'wu', line: 'damage',
            rarity: 'N', cost: 1, type: 'fixed', power: 14,
            readableTag: 'red-kill-n',
            cardDesc: { zh: '擊殺重置普攻，+12% 傷害（最多 3 層）', en: 'Kill resets Basic; +12% damage (max 3 stacks)' },
            pve: { onKill: { refreshBasicAttack: true, dmgStack: 0.12, maxStacks: 3 } },
            pvp: { onKill: { refreshBasicAttack: true, dmgStack: 0.08, maxStacks: 3 } }
        },
        // 蓄勢（原血怒）：近敵蓄力；滿層加傷＋有三段連擊時打出第三段
        wu_bloodrage_n: {
            id: 'wu_bloodrage_n', name: { zh: '蓄勢', en: 'Poise' }, faction: 'wu', line: 'damage',
            rarity: 'N', cost: 1, type: 'fixed', power: 14,
            readableTag: 'red-poise-n',
            growthCore: true,
            cardDesc: { zh: '蓄力滿層改寫下一擊為連擊第三段；精煉解除距離／迴避限制', en: 'Full poise rewrites next hit as combo 3rd; refine lifts range/dodge limits' },
            poiseTiers: [
                { requireNearEnemy: true, dodgeClears: true, desc: { zh: '近敵蓄勢；迴避取消', en: 'Windup near foes; dash cancels' } },
                { requireNearEnemy: false, dodgeClears: true, desc: { zh: '遠距可蓄；迴避仍取消', en: 'Windup at range; dash still cancels' } },
                { requireNearEnemy: false, dodgeClears: false, desc: { zh: '遠距可蓄；迴避不清', en: 'Windup at range; dash keeps stacks' } }
            ],
            pve: {
                poiseCharge: {
                    maxSec: 1.5, peakBonus: 0.28, combatRange: 10,
                    softSec: 0.4
                }
            },
            pvp: {
                poiseCharge: {
                    maxSec: 1.6, peakBonus: 0.20, combatRange: 10,
                    softSec: 0.45
                }
            }
        },
        // 破釜：盾碎反震 — 守系
        ti_pot_n: {
            id: 'ti_pot_n', name: { zh: '破釜', en: 'Broken Pot' }, faction: 'ti', line: 'survival',
            rarity: 'N', cost: 1, type: 'fixed', power: 14,
            exclusiveGroup: 'shield_break_offense',
            readableTag: 'blue-pot-n',
            requiresCard: 'ti_iron_wall_r',
            cardDesc: { zh: '護盾被打穿時，對破盾者造成相當於護盾上限的傷害（受全軍加成影響）', en: 'When shield is broken, deal damage equal to shield cap to the breaker (scales with army buffs)' },
            pve: { shieldBreakRetaliation: { shieldMaxPct: 0.45 } },
            pvp: { shieldBreakRetaliation: { shieldMaxPct: 0.30 } }
        },
        wu_berserk_n: {
            id: 'wu_berserk_n', name: { zh: '破釜', en: 'Broken Pot' }, faction: 'ti', line: 'survival',
            rarity: 'N', cost: 1, type: 'fixed', power: 14,
            retired: true,
            requiresCard: 'ti_iron_wall_r',
            cardDesc: { zh: '（已改為 ti_pot_n）', en: '(Moved to ti_pot_n)' },
            pve: { shieldBreakBurst: { nextHitDmgBonus: 0.40, windowMs: 2500 } },
            pvp: { shieldBreakBurst: { nextHitDmgBonus: 0.28, windowMs: 2000 } }
        },
        // 破綻：控場／火／流血窗口消耗增傷（學派收尾實體；不計入共鳴進度）
        wu_breach_n: {
            id: 'wu_breach_n', name: { zh: '破綻', en: 'Opening' }, faction: 'wu', line: 'damage',
            rarity: 'N', cost: 1, type: 'fixed', power: 15,
            readableTag: 'red-breach-n',
            pvpEligible: true,
            schoolFinisher: true,
            cardDesc: { zh: '敵人被暈、強緩速、灼燒或流血時露出破綻；下一擊額外傷害後消耗', en: 'Stun, heavy slow, burn, or bleed exposes a breach; next hit deals bonus then consumes it' },
            pve: {
                breachWindow: {
                    durationMs: 2000,
                    bonusDmg: 0.30,
                    applyCooldownMs: 1250,
                    strongSnareMaxMult: 0.50,
                    markOnDot: ['burn', 'flame', 'inferno', 'bleed', 'seep', 'hemorrhage']
                }
            },
            pvp: {
                breachWindow: {
                    durationMs: 1600,
                    bonusDmg: 0.22,
                    applyCooldownMs: 1250,
                    strongSnareMaxMult: 0.50,
                    markOnDot: ['burn', 'flame', 'inferno', 'bleed', 'seep', 'hemorrhage']
                }
            }
        },
        // 逆鱗：盾吸收 → 下一擊加攻（守系收尾；需先有銅牆才進池）
        ti_scale_n: {
            id: 'ti_scale_n', name: { zh: '逆鱗', en: 'Scale' }, faction: 'ti', line: 'survival',
            rarity: 'N', cost: 1, type: 'fixed', power: 15,
            readableTag: 'blue-scale-n',
            pvpEligible: true,
            schoolFinisher: true,
            requiresCard: 'ti_iron_wall_r',
            cardDesc: { zh: '護盾每擋一次傷害疊 1 鱗（最多 3）；下一擊依層數加傷並全消耗', en: 'Each shield block adds 1 scale (max 3); next hit spends all for bonus damage' },
            pve: { scaleCounter: { perStackBonus: 0.25, maxStacks: 3, minAbsorb: 1 } },
            pvp: { scaleCounter: { perStackBonus: 0.18, maxStacks: 3, minAbsorb: 1 } }
        },
        // 風返：翻滾強化下一擊；Perfect 另回 1 回避
        su_wind_return_n: {
            id: 'su_wind_return_n', name: { zh: '風返', en: 'Wind Return' }, faction: 'su', line: 'speed',
            rarity: 'N', cost: 1, type: 'fixed', power: 15,
            readableTag: 'green-wind-n',
            pvpEligible: true,
            schoolFinisher: true,
            cardDesc: { zh: '翻滾後下一擊加傷；Perfect Dodge 額外回復 1 次回避', en: 'After roll, next hit hits harder; Perfect Dodge restores 1 dodge charge' },
            pve: { windReturn: { nextHitDmgBonus: 0.25, perfectDashRestore: 1 } },
            pvp: { windReturn: { nextHitDmgBonus: 0.18, perfectDashRestore: 1 } }
        },
        // 連鎖收割：擊殺傳染斬殺印
        wu_chain_harvest_n: {
            id: 'wu_chain_harvest_n', name: { zh: '連鎖', en: 'Chain Harvest' }, faction: 'wu', line: 'damage',
            rarity: 'N', cost: 1, type: 'fixed', power: 14,
            readableTag: 'red-chain-n',
            cardDesc: { zh: '擊殺後附近敵人短暫帶斬殺印，命中額外傷害', en: 'On kill, nearby foes briefly gain execute mark for bonus on hit' },
            pve: { chainHarvest: { radius: 4.5, bonusDmg: 0.35, durationMs: 2800, maxTargets: 4 } },
            pvp: { chainHarvest: { radius: 3.5, bonusDmg: 0.22, durationMs: 2200, maxTargets: 3 } }
        },
        // 餘燼爆裂（已併入通用 SR 本命 sig_zhouyu_ember；保留 id 供舊存檔 migrate）
        shu_ember_r: {
            id: 'shu_ember_r', name: { zh: '餘燼爆裂', en: 'Ember Burst' }, faction: 'shu', line: 'dot',
            rarity: 'R', cost: 2, type: 'fixed', power: 17,
            readableTag: 'purple-ember-r',
            pvpEligible: false,
            retired: true,
            cardDesc: { zh: '已併入通用本命「餘燼」', en: 'Merged into shared signature Ember' },
            pve: { emberDetonate: { remainingPct: 0.60, splashPct: 0.35, splashRadius: 2.75, cooldownMs: 2000, aoeKey: 'zhouyu' } },
            pvp: { emberDetonate: { remainingPct: 0.50, splashPct: 0.28, splashRadius: 2.5, cooldownMs: 2200, aoeKey: 'zhouyu' } }
        },
        ti_benevolence_r: {
            id: 'ti_benevolence_r', name: { zh: '仁德', en: 'Benevolence' }, faction: 'ti', line: 'survival',
            rarity: 'R', cost: 2, type: 'fixed', power: 16,
            readableTag: 'blue-aura-r',
            pvpEligible: true,
            growthCore: true,
            cardDesc: { zh: '8 公尺內友軍減傷；造成傷害時自吸；精煉解鎖全軍加攻', en: 'Allies in 8m take less damage; self lifesteal on hits; refine unlocks army damage' },
            benevolenceTiers: [
                { desc: { zh: '友軍 -12% 受傷 · 自吸 1%', en: 'Allies −12% damage taken · 1% lifesteal' }, pve: { aura: { radius: 8, damageTakenMul: 0.88, affects: 'allies' }, lifestealPct: 0.01 }, pvp: { aura: { radius: 8, damageTakenMul: 0.90, affects: 'allies' }, lifestealPct: 0.008 } },
                { desc: { zh: '友軍 -12% 受傷 · 自吸 1.5% · 全軍 +6%', en: 'Allies −12% taken · 1.5% lifesteal · army +6%' }, pve: { aura: { radius: 8, damageTakenMul: 0.88, affects: 'allies' }, lifestealPct: 0.015, dmgMul: 1.06 }, pvp: { aura: { radius: 8, damageTakenMul: 0.90, affects: 'allies' }, lifestealPct: 0.012, dmgMul: 1.05 } },
                { desc: { zh: '友軍 -12% 受傷 · 自吸 2% · 全軍 +10%', en: 'Allies −12% taken · 2% lifesteal · army +10%' }, pve: { aura: { radius: 8, damageTakenMul: 0.88, affects: 'allies' }, lifestealPct: 0.02, dmgMul: 1.10 }, pvp: { aura: { radius: 8, damageTakenMul: 0.90, affects: 'allies' }, lifestealPct: 0.016, dmgMul: 1.08 } }
            ],
            pve: { aura: { radius: 8, damageTakenMul: 0.88, affects: 'allies' }, lifestealPct: 0.01 },
            pvp: { aura: { radius: 8, damageTakenMul: 0.90, affects: 'allies' }, lifestealPct: 0.008 }
        },

        // ═══════════════════════════════════════════════════════════
        // 效果卡 (Effect cards) — 階段一
        // 與上方數值卡的差異:帶 effectType / trigger / tiers,會在命中時
        // 觸發 stun/burn/knockback 等效果(由 wordSystem 注入 combatManager)。
        // rarity SSR = 綁角色本命(signature),用該角色攻擊模式專屬質變軸;
        // rarity SR  = 通用本命卡,用機率質變軸,任何攻擊模式的角色可用。
        // swapGroup 相同者可互換(如 onhit_cc 控制類:stun/snare/freeze)。
        // ═══════════════════════════════════════════════════════════

        // 關羽本命:雷暈(SSR,段數質變 — combo 型專屬)
        sig_guanyu_stun: {
            id: 'sig_guanyu_stun', name: { zh: '雷暈', en: 'Thunder Stun' }, faction: 'wu', line: 'control',
            rarity: 'SSR', cost: 0,
            cardType: 'effect',            // ← 區別於數值卡
            effectType: 'stun',
            category: 'A',                 // 命中附加狀態
            swapGroup: 'onhit_cc',         // 控制類:可與 snare/freeze 互換
            signature: 'guanyu',           // 綁定關羽
            pvpEligible: true,
            cardDesc: { zh: '連段特定段擊暈敵人（非整場鎖死）', en: 'Stun on specific combo hits (not a full lock)' },
            // 段數質變：末段 → 第二段起 → 首末段（不再 every_hit，避免連暈鎖死）
            tiers: [
                { trigger: 'last_in_combo',  pve: { stunDuration: 0.85 }, pvp: { stunDuration: 0.65 }, desc: { zh: '末段擊暈 0.85 秒', en: 'Finisher stun 0.85s' } },
                { trigger: 'from_second',    pve: { stunDuration: 0.7 },  pvp: { stunDuration: 0.55 }, desc: { zh: '第二連擊起擊暈 0.7 秒', en: 'Stun from 2nd hit 0.7s' } },
                { trigger: 'first_and_last', pve: { stunDuration: 0.65 }, pvp: { stunDuration: 0.5 },  desc: { zh: '首段與末段擊暈 0.65 秒（大招不附帶）', en: '1st & finisher stun 0.65s (not on Super)' } }
            ]
        },

        // 通用本命:霆擊(SR,機率質變 — 任何攻擊模式可用,含單發型如貂蟬)
        gen_stun_chance: {
            id: 'gen_stun_chance', name: { zh: '霆擊', en: 'Thunderstrike' }, faction: 'wu', line: 'control',
            rarity: 'SR', cost: 2,
            cardType: 'effect',
            effectType: 'stun',
            category: 'A',
            swapGroup: 'onhit_cc',         // 同組 → 可替換 SSR 雷暈
            signature: null,               // 通用,非綁定
            pvpEligible: true,
            cardDesc: { zh: '攻擊有機率擊暈敵人', en: 'Attacks have a chance to stun' },
            // 機率軸：忌 Lv3 100% 每下必暈；上限壓在半數左右＋短時長
            tiers: [
                { trigger: 'chance', chance: 0.22, pve: { stunDuration: 0.7 }, pvp: { stunDuration: 0.5 }, desc: { zh: '22% 機率擊暈 0.7 秒', en: '22% chance stun 0.7s' } },
                { trigger: 'chance', chance: 0.38, pve: { stunDuration: 0.65 }, pvp: { stunDuration: 0.5 }, desc: { zh: '38% 機率擊暈 0.65 秒', en: '38% chance stun 0.65s' } },
                { trigger: 'chance', chance: 0.52, pve: { stunDuration: 0.55 }, pvp: { stunDuration: 0.45 }, desc: { zh: '52% 機率擊暈 0.55 秒', en: '52% chance stun 0.55s' } }
            ]
        },

        // ── 控制系通用 SR（onhit_cc）
        // 定位：比暈眩更長、更穩的減速覆蓋；Lv3 幾乎必中且大幅降速，適合追擊/風箏
        gen_snare_chance: {
            id: 'gen_snare_chance', name: { zh: '泥沼', en: 'Mire' }, faction: 'su', line: 'control',
            rarity: 'SR', cost: 2,
            cardType: 'effect',
            effectType: 'snare',
            category: 'A',
            swapGroup: 'onhit_cc',
            signature: null,
            pvpEligible: true,
            cardDesc: { zh: '攻擊高機率大幅減速（長持續、高覆蓋）', en: 'High chance of heavy slow (long duration, high uptime)' },
            tiers: [
                { trigger: 'chance', chance: 0.45, pve: { snareDuration: 1.8, snareMultiplier: 0.48 }, pvp: { snareDuration: 1.4, snareMultiplier: 0.52 }, desc: { zh: '45% 機率減速 1.8 秒（-52% 移速）', en: '45% chance slow 1.8s (−52% move)' } },
                { trigger: 'chance', chance: 0.70, pve: { snareDuration: 2.0, snareMultiplier: 0.42 }, pvp: { snareDuration: 1.6, snareMultiplier: 0.46 }, desc: { zh: '70% 機率減速 2 秒（-58% 移速）', en: '70% chance slow 2s (−58% move)' } },
                { trigger: 'chance', chance: 1.00, pve: { snareDuration: 2.2, snareMultiplier: 0.35 }, pvp: { snareDuration: 1.8, snareMultiplier: 0.40 }, desc: { zh: '必中大幅減速 2.2 秒（-65% 移速）', en: 'Guaranteed heavy slow 2.2s (−65% move)' } }
            ]
        },

        // 張飛本命:獅吼(SSR,首段質變 — 開場就黏住敵人)
        sig_zhangfei_snare: {
            id: 'sig_zhangfei_snare', name: { zh: '獅吼', en: 'Lion Roar' }, faction: 'wu', line: 'control',
            rarity: 'SSR', cost: 0,
            cardType: 'effect',
            effectType: 'snare',
            category: 'A',
            swapGroup: 'onhit_cc',
            signature: 'zhangfei',
            pvpEligible: true,
            cardDesc: { zh: '首段必中長時間大幅減速', en: '1st hit always applies long heavy slow' },
            tiers: [
                { trigger: 'first_in_combo', pve: { snareDuration: 2.2, snareMultiplier: 0.45 }, pvp: { snareDuration: 1.6, snareMultiplier: 0.50 }, desc: { zh: '首段減速 2.2 秒（-55% 移速）', en: '1st-hit slow 2.2s (−55% move)' } },
                { trigger: 'from_second',    pve: { snareDuration: 2.0, snareMultiplier: 0.40 }, pvp: { snareDuration: 1.5, snareMultiplier: 0.45 }, desc: { zh: '第二段起減速 2 秒', en: 'Slow from 2nd hit 2s' } },
                { trigger: 'every_hit',      pve: { snareDuration: 1.8, snareMultiplier: 0.35 }, pvp: { snareDuration: 1.3, snareMultiplier: 0.40 }, desc: { zh: '全部攻擊皆大幅減速', en: 'All attacks heavy slow' } }
            ]
        },

        // ── 持續傷害系通用 SR（onhit_dot）────────────────────────
        // 暫退役：與角色自帶火／流血搶本命槽、同 type 不疊、無收尾聯動，實務無人選。
        // 定義保留供後續重做成有意義的通用軸（或改波間卡）。
        gen_burn_chance: {
            id: 'gen_burn_chance', name: { zh: '燒符', en: 'Burn Sigil' }, faction: 'shu', line: 'dot',
            rarity: 'SR', cost: 2,
            cardType: 'effect',
            effectType: 'dot',
            category: 'A',
            swapGroup: 'onhit_dot',
            signature: null,
            retired: true,
            pvpEligible: false,
            cardDesc: { zh: '（暫退役）攻擊有機率附加灼燒', en: '(Retired) Chance to apply burn' },
            tiers: [
                { trigger: 'chance', chance: 0.25, pve: { dotConfig: { type: 'burn', duration: 3.0, tickRate: 1.0, damagePerTick: 55 } }, pvp: { dotConfig: { type: 'burn', duration: 2.5, tickRate: 1.0, damagePerTick: 40 } }, desc: { zh: '25% 機率灼燒', en: '25% chance burn' } },
                { trigger: 'chance', chance: 0.55, pve: { dotConfig: { type: 'burn', duration: 3.5, tickRate: 1.0, damagePerTick: 60 } }, pvp: { dotConfig: { type: 'burn', duration: 2.5, tickRate: 1.0, damagePerTick: 45 } }, desc: { zh: '55% 機率灼燒', en: '55% chance burn' } },
                { trigger: 'chance', chance: 0.85, pve: { dotConfig: { type: 'burn', duration: 3.5, tickRate: 0.9, damagePerTick: 65 } }, pvp: { dotConfig: { type: 'burn', duration: 2.5, tickRate: 1.0, damagePerTick: 50 } }, desc: { zh: '85% 機率強灼燒', en: '85% chance strong burn' } }
            ]
        },
        gen_bleed_chance: {
            id: 'gen_bleed_chance', name: { zh: '血印', en: 'Blood Mark' }, faction: 'wu', line: 'dot',
            rarity: 'SR', cost: 2,
            cardType: 'effect',
            effectType: 'dot',
            category: 'A',
            swapGroup: 'onhit_dot',
            signature: null,
            retired: true,
            pvpEligible: false,
            cardDesc: { zh: '（暫退役）攻擊有機率附加流血', en: '(Retired) Chance to apply bleed' },
            tiers: [
                { trigger: 'chance', chance: 0.25, pve: { dotConfig: { type: 'bleed', duration: 3.0, tickRate: 1.0, damagePerTick: 45 } }, pvp: { dotConfig: { type: 'bleed', duration: 2.5, tickRate: 1.0, damagePerTick: 35 } }, desc: { zh: '25% 機率流血', en: '25% chance bleed' } },
                { trigger: 'chance', chance: 0.55, pve: { dotConfig: { type: 'bleed', duration: 3.5, tickRate: 1.0, damagePerTick: 50 } }, pvp: { dotConfig: { type: 'bleed', duration: 2.5, tickRate: 1.0, damagePerTick: 40 } }, desc: { zh: '55% 機率流血', en: '55% chance bleed' } },
                { trigger: 'chance', chance: 0.85, pve: { dotConfig: { type: 'bleed', duration: 3.5, tickRate: 0.9, damagePerTick: 55 } }, pvp: { dotConfig: { type: 'bleed', duration: 2.5, tickRate: 1.0, damagePerTick: 45 } }, desc: { zh: '85% 機率強流血', en: '85% chance strong bleed' } }
            ]
        },

        // 周瑜本命:業火(SSR) — 強化灼熱濺射的傷害與範圍
        sig_zhouyu_burn: {
            id: 'sig_zhouyu_burn', name: { zh: '業火', en: 'Hellfire' }, faction: 'wu', line: 'dot',
            rarity: 'SSR', cost: 0,
            cardType: 'effect',
            effectType: 'burn_splash',
            category: 'A',
            swapGroup: 'onhit_dot',
            signature: 'zhouyu',
            pvpEligible: true,
            cardDesc: { zh: '命中灼熱敵人時濺射火焰', en: 'Hitting burning foes splashes fire' },
            tiers: [
                { trigger: 'every_hit', desc: { zh: '灼熱濺射 28%・範圍 2.5', en: 'Burn splash 28% · radius 2.5' },
                    pve: { burnSplash: { splashPct: 0.28, splashRadius: 2.5 } },
                    pvp: { burnSplash: { splashPct: 0.24, splashRadius: 2.3 } } },
                { trigger: 'every_hit', desc: { zh: '灼熱濺射 34%・範圍 2.9', en: 'Burn splash 34% · radius 2.9' },
                    pve: { burnSplash: { splashPct: 0.34, splashRadius: 2.9 } },
                    pvp: { burnSplash: { splashPct: 0.28, splashRadius: 2.6 } } },
                { trigger: 'every_hit', desc: { zh: '灼熱濺射 40%・範圍 3.4', en: 'Burn splash 40% · radius 3.4' },
                    pve: { burnSplash: { splashPct: 0.40, splashRadius: 3.4 } },
                    pvp: { burnSplash: { splashPct: 0.32, splashRadius: 3.0 } } }
            ]
        },

        // 通用 SR 本命：餘燼 — 賦予／強化火系引爆（有 base emberDetonate 則升級；否則賦予）
        // id 仍用 sig_zhouyu_ember 以相容舊存檔；signature:null = 任何 onhit_dot 角色可選
        sig_zhouyu_ember: {
            id: 'sig_zhouyu_ember', name: { zh: '餘燼', en: 'Ember' }, faction: 'shu', line: 'dot',
            rarity: 'SR', cost: 0,
            cardType: 'effect',
            effectType: 'ember_detonate',
            category: 'A',
            swapGroup: 'onhit_dot',
            signature: null,
            pvpEligible: true,
            cardDesc: { zh: '通用本命：引爆目標身上的火系灼燒，造成即時傷害與濺射', en: 'Shared signature: detonate fire burn for instant damage & splash' },
            tiers: [
                { trigger: 'every_hit', desc: { zh: '引爆 52%・濺射 28%・範圍 2.5', en: 'Detonate 52% · splash 28% · radius 2.5' },
                    pve: { emberDetonate: { remainingPct: 0.52, splashPct: 0.28, splashRadius: 2.5, cooldownMs: 1700, aoeKey: 'zhouyu' } },
                    pvp: { emberDetonate: { remainingPct: 0.48, splashPct: 0.24, splashRadius: 2.3, cooldownMs: 1900, aoeKey: 'zhouyu' } } },
                { trigger: 'every_hit', desc: { zh: '引爆 58%・濺射 32%・範圍 2.9', en: 'Detonate 58% · splash 32% · radius 2.9' },
                    pve: { emberDetonate: { remainingPct: 0.58, splashPct: 0.32, splashRadius: 2.9, cooldownMs: 1600, aoeKey: 'zhouyu' } },
                    pvp: { emberDetonate: { remainingPct: 0.52, splashPct: 0.28, splashRadius: 2.6, cooldownMs: 1800, aoeKey: 'zhouyu' } } },
                { trigger: 'every_hit', desc: { zh: '引爆 65%・濺射 36%・範圍 3.2', en: 'Detonate 65% · splash 36% · radius 3.2' },
                    pve: { emberDetonate: { remainingPct: 0.65, splashPct: 0.36, splashRadius: 3.2, cooldownMs: 1500, aoeKey: 'zhouyu' } },
                    pvp: { emberDetonate: { remainingPct: 0.58, splashPct: 0.32, splashRadius: 2.9, cooldownMs: 1700, aoeKey: 'zhouyu' } } }
            ]
        },

        // 曹操本命:奸火(SSR) — 強化自身異火 DoT（不取代 brawler 三段異火）
        sig_caocao_burn: {
            id: 'sig_caocao_burn', name: { zh: '奸火', en: 'Treacherous Fire' }, faction: 'wei', line: 'dot',
            rarity: 'SSR', cost: 0,
            cardType: 'effect',
            effectType: 'fire_dot_enhance',
            category: 'A',
            swapGroup: 'onhit_dot',
            signature: 'caocao',
            pvpEligible: true,
            cardDesc: { zh: '強化齊射異火的傷害與持續', en: 'Empower volley Inferno damage and duration' },
            tiers: [
                { trigger: 'every_hit', desc: { zh: '異火傷害 +20%', en: 'Inferno damage +20%' },
                    pve: { fireDotEnhance: { damageMul: 1.20, durationMul: 1.05 } },
                    pvp: { fireDotEnhance: { damageMul: 1.15, durationMul: 1.03 } } },
                { trigger: 'every_hit', desc: { zh: '異火傷害 +35%', en: 'Inferno damage +35%' },
                    pve: { fireDotEnhance: { damageMul: 1.35, durationMul: 1.10 } },
                    pvp: { fireDotEnhance: { damageMul: 1.28, durationMul: 1.06 } } },
                { trigger: 'every_hit', desc: { zh: '異火傷害 +50%', en: 'Inferno damage +50%' },
                    pve: { fireDotEnhance: { damageMul: 1.50, durationMul: 1.15 } },
                    pvp: { fireDotEnhance: { damageMul: 1.40, durationMul: 1.10 } } }
            ]
        },

        // 劉備本命:雙股(SSR,末段質變 — 呼應第三段重劈流血)
        sig_liubei_bleed: {
            id: 'sig_liubei_bleed', name: { zh: '雙股', en: 'Twin Blades' }, faction: 'wu', line: 'dot',
            rarity: 'SSR', cost: 0,
            cardType: 'effect',
            effectType: 'dot',
            category: 'A',
            swapGroup: 'onhit_dot',
            signature: 'liubei',
            pvpEligible: true,
            cardDesc: { zh: '重劈終結使敵人大量流血', en: 'Heavy finisher causes massive bleed' },
            tiers: [
                { trigger: 'last_in_combo',  pve: { dotConfig: { type: 'bleed', duration: 3.5, tickRate: 1.0, damagePerTick: 85 } }, pvp: { dotConfig: { type: 'bleed', duration: 2.8, tickRate: 1.0, damagePerTick: 65 } }, desc: { zh: '末段重劈流血（高傷）', en: 'Finisher heavy bleed (high damage)' } },
                { trigger: 'from_second',    pve: { dotConfig: { type: 'seep', duration: 3.5, tickRate: 0.95, damagePerTick: 72 } }, pvp: { dotConfig: { type: 'seep', duration: 2.8, tickRate: 1.0, damagePerTick: 56 } }, desc: { zh: '第二段起滲血', en: 'Seeping bleed from 2nd hit' } },
                { trigger: 'every_hit',
                    pve: { dotConfigByComboIndex: [
                        { type: 'bleed', duration: 3.5, tickRate: 1.0, damagePerTick: 58 },
                        { type: 'seep', duration: 3.5, tickRate: 0.95, damagePerTick: 55 },
                        { type: 'hemorrhage', duration: 4.0, tickRate: 0.9, damagePerTick: 52 }
                    ]},
                    pvp: { dotConfigByComboIndex: [
                        { type: 'bleed', duration: 2.8, tickRate: 1.0, damagePerTick: 46 },
                        { type: 'seep', duration: 2.8, tickRate: 1.0, damagePerTick: 44 },
                        { type: 'hemorrhage', duration: 3.0, tickRate: 1.0, damagePerTick: 42 }
                    ]},
                    desc: { zh: '三重流血疊加（流血・滲血・潰血）', en: 'Triple bleed stack (bleed · seep · hemorrhage)' } }
            ]
        }
    }
};

WordConfig.allCardIds = (function() {
    var ids = [];
    for (var k in WordConfig.cards) ids.push(k);
    return ids;
})();

WordConfig.loc = function (v) {
    if (v == null) return '';
    if (typeof v === 'string' || typeof v === 'number') return String(v);
    if (window.TKI18n && typeof window.TKI18n.pick === 'function') return window.TKI18n.pick(v);
    if (typeof v === 'object') {
        var lang = (window.TKI18n && window.TKI18n.getLang && window.TKI18n.getLang()) || 'zh-TW';
        if (lang === 'en' || lang === 'tr') return String(v.en || v.zh || v['zh-TW'] || '');
        return String(v.zh || v['zh-TW'] || v.en || '');
    }
    return '';
};

WordConfig.getName = function (defOrId) {
    var def = typeof defOrId === 'string'
        ? (WordConfig.cards && WordConfig.cards[defOrId])
        : defOrId;
    if (!def) return typeof defOrId === 'string' ? defOrId : '';
    return WordConfig.loc(def.name) || def.id || '';
};

WordConfig.getCardDesc = function (defOrId) {
    var def = typeof defOrId === 'string'
        ? (WordConfig.cards && WordConfig.cards[defOrId])
        : defOrId;
    if (!def) return '';
    return WordConfig.loc(def.cardDesc) || '';
};

WordConfig.getFactionLabel = function (factionKey) {
    var fac = WordConfig.factions && WordConfig.factions[factionKey];
    if (!fac) return factionKey || '';
    return WordConfig.loc(fac.label) || factionKey || '';
};

/** Card seal glyph — always Chinese character for art */
WordConfig.getFactionSeal = function (factionKey) {
    var fac = WordConfig.factions && WordConfig.factions[factionKey];
    if (!fac) return '';
    if (fac.seal) return fac.seal;
    var lab = fac.label;
    if (typeof lab === 'string') return lab;
    return (lab && lab.zh) || '';
};

WordConfig.getFinisherLabel = function (factionKey) {
    var fin = WordConfig.schoolFinishers && WordConfig.schoolFinishers[factionKey];
    if (!fin) return '';
    return WordConfig.loc(fin.label) || '';
};
