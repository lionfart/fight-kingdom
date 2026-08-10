// 全域角色設定 - 不需要掛到任何 Entity
// =============================================================================
// BrawlerConfig 設計師欄位速查（僅列 gameplay 實際會讀的鍵）
// 位置：root＝角色根層；step＝comboOverrides[]；super＝大招；extra＝extraAttacks[]
// 合併：step / super / extra 經 Object.assign 覆寫 root 同名欄位
// =============================================================================
//
// --- 角色基底（root）---
// health                 最大生命
// speed                  移動速度
// ammo                   彈匣容量
// reloadTime             換彈秒數
// shootCooldown          攻擊間隔／動作鎖定（常被 step 覆寫）
// superChargeNeeded      大招充能需求
// scale                  模型縮放
// modelKey               characterMap 模板鍵（變身／誘餌等）
// isMecha                機甲形態（回血／還原）
// autoDrainRate          機甲每秒流失 maxHp 比例
// name / displayZh / displayEn  內部名／顯示名
// color                  {r,g,b} 後備子彈色等
// allyRole               vanguard | guardian | tactician
// signatureCard          本命卡 id
// unlockTier / unlockCost / unlockLevel / unlockRogue  解鎖
// burnSplash / emberDetonate  火系被動套件（見下）
// emptyAmmoPunch         空彈近戰覆寫
// comboOverrides[]       連段表（無則用 root 攻擊欄）
// super{}                大招
// bossAttackModes[]      Boss 依距離選招
// modeRecoverTime        Boss 招間不可出手秒數
//
// --- 翻滾 Dash（root）---
// dashDist / dashSpeed / dashMaxDuration / dashEasePower
// dashInvuln / dashRechargeTime / dashAnimTrigger（預設 roll）
//
// --- 攻擊／連段（step | super | extra | 無 combo 時 root）---
// animTrigger            動畫 trigger（attack1/2/3…）
// attackPattern / type   彈道類型（見 Pattern）
// bulletKey              子彈池／外觀鍵
// bulletDamage / damage  命中傷害
// fireDelay              出彈前搖（秒）
// shootCooldown          本段冷卻／攻擊鎖定
// burstCount / burstInterval  連發次數／間隔
// spreadCount / projectileCount  扇形／散射彈數
// spreadAngle            散射總角（度）
// parallelShots / parallelSpacing  平行多彈／橫向間距
// extraAttacks[]         同段延遲追加攻擊
// autoStepRange          有目標時自動滑步距離上限
// hitStopDuration        命中卡幀
// textScaleMultiplier    傷害數字縮放
// cameraShake            鏡頭震動（大招可設；不設則 player 預設 0.45，設 0 關閉）
// hideWeaponProp         攻擊期間藏武器
// useTrail               false＝關刀光拖尾
// trailDuration / trailEmitTime / trailDelay  拖尾參數
// keepTextUpright        朝左時子彈 yaw+180
//
// --- Pattern（attackPattern / type）---
// normal | spread | burst | wave | flamethrower(=wave)
// melee | imelee | dash | lob | explode | boomerang
// pierce | super_pierce | homing | super_homing_bomb
// super_skyfall | super_zhouyu_burst(舊→skyfall)
// super_enhanced_attack | super_decoy | super_transform
// super_whirlwind | super_zhangfei_roar | super_liubei_tree
//
// --- 子彈視覺／物理 ---
// bulletSpeed / speed       飛行速度（pierce 可用 speed）
// bulletLifetime / maxLife   存活秒數
// bulletHitRadius / hitRadius / minHitRadius  命中半徑／內圈
// bulletScale               子彈縮放
// bulletFlip                左右翻外觀（不改飛行方向）★
// destroyBush               清草叢
// knockbackDist / flinchAmount  擊退／顫動
// damageMultiplier          pierce 傷害倍率
// coneAngle                 imelee 扇形總角（度）
// dashOffset / dashHitRadius  dash 判定前移／半徑
// maxScale / baseHitRadius / maxHitRadius  wave 縮放與半徑
//
// --- Lob 拋物 ---
// lobSpeed / lobDuration / lobDurationMode(byDistance|fixed)
// lobMinRange / lobMaxRange / lobMinDuration / lobMaxDuration
// lobGravity / lobHeight / lobHeightMinScale / lobHeightMax
// lobCount / lobAreaBulletKey
// lobAreaRadius / lobAreaDuration / lobAreaDamage / lobAreaTickRate
// explodeRadius / explodeDamage
//
// --- Homing ---
// chaseTime / chaseSpeed
//
// --- Boomerang ---
// boomerangDistance / boomerangSpeed / boomerangSpin
// boomerangCatchDist / boomerangCurve / boomerangCurveDir(1右|-1左)
//
// --- Sweep（imelee；sweepConfig 內）---
// sweepFrom / sweepTo / snapDist / snapRatio / fadeStart / easePower
// scaleFrom / endScale
//
// --- Rush（rushConfig 內）---
// rushSpeed / rushDistance / windupTime / recoverTime / pierce
//
// --- 移動輔助 ---
// whiffStep / whiffStepSpeed / whiffStepMaxDuration / whiffStepEasePower
//
// --- 狀態／控制 ---
// stunDuration / snareDuration / snareMultiplier
// dotConfig: { type, duration, tickRate, damagePerTick }
//   type 例：burn | flame | inferno | bleed | seep | hemorrhage
//
// --- 火系被動（root）---
// burnSplash: splashPct / splashRadius / cooldownMs / aoeKey
// emberDetonate: remainingPct / splashPct / splashRadius / cooldownMs / aoeKey
//
// --- Super 專屬 ---
// type / desc / descEn
// stealthDuration / speedMultiplier / decoyLifetime   （decoy）
// transformTo / transformCycle[] / shareHealth        （transform）
// targetMode / timingMode / maxTargets / range / warnDelay  （skyfall）
// treeHealth / treeLifetime / treePhysicalRadius       （liubei_tree）
// auraRadius / auraColor / auraOpacity / healPerTick / tickRate
//
// --- 視覺雜項 ★ ---
// animMirror             攻擊期間模型 X 鏡像
// animAngleOffset        攻擊身體額外 yaw（度）
// hitFx                  命中特效：slash | blunt | magic
// afterimage             dash/rush 身體殘影（true 開啟）
// afterimageInterval / afterimageLifetime / afterimageOpacity / afterimageColor
// 範例：{ animTrigger:'attack1', bulletFlip:true, animMirror:true, ... }
//
// --- Boss 選招項 ---
// minRange / maxRange / id  （另含一般攻擊欄）
//
// --- 選角／文案（UI）---
// select.{ zh,en,title,titleEn,faction,role,roleEn,range,previewScale,... }
// description / descriptionEn / attackDesc / attackDescEn
// skins[]: key, label, previewEntity, unlockCost, unlockLevel, unlockRogueWave, sku, description*
//
// --- 備註 ---
// 無 comboOverrides 時整份 root 當攻擊設定
// extraAttacks 不觸發本命 proc；執行期欄位 isSuper / isExtraBullet 勿手寫依賴
// 檔案有寫但程式未讀：growSpeed、shootingSpeedMultiplier 等 — 勿依賴
// =============================================================================
var BrawlerConfig = {
    zhouyu: { 
        name: 'ZhouYu',
        select: { zh: '周瑜', en: 'Zhou Yu', title: '美周郎', titleEn: 'The Handsome Zhou', faction: 'wu', role: '範圍', roleEn: 'AoE', range: 'ranged', atk: 90 },
        unlockTier: 0, unlockCost: 0, unlockLevel: 1,
        health: 3600,            
        speed: 3.5,
        ammo: 3,
        reloadTime: 2.8,     
        shootCooldown: 0.4,
        color: { r: 0.25, g: 0.10, b: 0.15 },
        description: '江東大都督。擅長大範圍連環爆破，靠點燃與濺射機制讓敵人在火海中無處可躲。',
        descriptionEn: 'Jiangdong’s pyromaniac commander. A master of area denial who triggers massive chain explosions through ignite and splash mechanics.',
        attackDesc: '三段火計齊射：點燃敵人；命中已灼熱目標時濺射，並可引爆餘燼。',
        attackDescEn: 'Three-hit fire volleys: ignite foes; splash on burning targets and detonate embers.',
        allyRole: 'tactician',
        signatureCard: 'sig_zhouyu_burn',
        skins: [
            { key: 'zhouyu_skin_01', label: 'Skin 1', previewEntity: 'showmodernZY',
              unlockCost: 3000, unlockLevel: 5, unlockRogueWave: 20,
              sku: 'skin_zhouyu_origin',
              description: '40歲的我還算是美少女嗎？我有的是心火盛。',
              descriptionEn: 'Am I still a pretty young girl at 40? All I have got is an excess of internal heat.' }
        ],
        // 命中已帶火系 DoT 的目標 → 依本次命中傷害濺射（不消耗灼燒）
        burnSplash: {
            splashPct: 0.22,
            splashRadius: 2.0,
            cooldownMs: 1200,
            aoeKey: 'zhouyu'
        },
        // 引爆身上火系 DoT → 部分即時 + 小範圍濺射（base；通用餘燼本命可強化）
        emberDetonate: {
            remainingPct: 0.45,
            splashPct: 0.25,
            splashRadius: 2.2,
            cooldownMs: 1800,
            aoeKey: 'zhouyu'
        },
        
        comboOverrides: [
            { 
                animTrigger: 'attack1', bulletKey: 'zhouyu', attackPattern: 'normal', 
                bulletDamage: 250,        
                bulletSpeed: 15, bulletLifetime: 0.7, bulletHitRadius: 1.0, fireDelay: 0.5,
                shootCooldown: 0.7, whiffStep: 0.0, bulletScale: 1.3,
                snareDuration: 1, snareMultiplier: 0.5,
                dotConfig: { type: 'burn', duration: 3.5, tickRate: 1.0, damagePerTick: 52 },
            },
            { 
                animTrigger: 'attack2', bulletKey: 'zhouyu', attackPattern: 'spread', 
                bulletDamage: 250,        
                bulletSpeed: 15, bulletLifetime: 0.7, bulletHitRadius: 1.0, bulletScale: 1.3,
                spreadCount: 3, spreadAngle: 30, shootCooldown: 0.7, fireDelay: 0.5, whiffStep: 0.0,
                snareDuration: 1, snareMultiplier: 0.5, 
                dotConfig: { type: 'burn', duration: 3.5, tickRate: 1.0, damagePerTick: 52 },
                
            },
            { 
                animTrigger: 'attack3', bulletKey: 'zhouyu', attackPattern: 'spread', 
                bulletDamage: 250,        
                bulletSpeed: 15, bulletLifetime: 0.7, bulletHitRadius: 1.0, bulletScale: 2, knockbackDist: 0.5,
                spreadCount: 3, spreadAngle: 35, shootCooldown: 0.7, fireDelay: 0.4,
                snareDuration: 1, snareMultiplier: 0.5,
                dotConfig: { type: 'burn', duration: 3.5, tickRate: 1.0, damagePerTick: 52 }, 
                extraAttacks: [
                    {
                        bulletKey: 'zhouyu', attackPattern: 'spread', bulletDamage: 100,        
                        bulletSpeed: 15, bulletLifetime: 0.7, bulletHitRadius: 1.0, bulletScale: 1.5, knockbackDist: 0.5,
                        spreadCount: 3, spreadAngle: 35, shootCooldown: 0.7, fireDelay: 0.6,
                    } 
                ]      
            }
        ],
        superChargeNeeded: 3500,
        super: {
             type: 'super_enhanced_attack', bulletKey: 'zhouyu', attackPattern: 'burst', 
            burstCount: 5, burstInterval: 0.02, stunDuration: 0.5, 
            bulletDamage: 250, bulletScale: 1.5, bulletSpeed: 15, bulletLifetime: 0.7, bulletHitRadius: 1.2,
            shootCooldown: 0.6, textScaleMultiplier: 1.6, fireDelay: 1.2,  knockbackDist: 1.5,             destroyBush: true,
            desc: '瞬間爆發五連火彈，擊暈並擊退前方敵人，可燒毀草叢。',
            descEn: 'Five-shot fire burst—stun and knock back foes ahead; clears brush.'
        }
    },


    caocao: { 
        name: 'CaoCao',
        select: { zh: '曹操', en: 'Cao Cao', title: '亂世奸雄', titleEn: 'Hero of Chaos', faction: 'wei', role: '輸出', roleEn: 'Damage', range: 'ranged', atk: 84 },
        unlockTier: 1, unlockCost: 1200, unlockLevel: 3,
        health: 3300,             
        speed: 3.5,
        ammo: 3, 
        reloadTime: 2.4,  
        shootCooldown: 0.4, 
        bulletSpeed: 16,
        bulletLifetime: 1.0,
        bulletHitRadius: 1.5,
        attackPattern: 'burst',
        burstCount: 4, burstInterval: 0.08, spreadAngle: 3,
        color: { r: 0.95, g: 0.75, b: 0.20 },
        description: '不讓戰場有片刻冷卻的亂世奸雄。越打越燙的疊加型射手，火力隨命中次數升級，用極致的燃燒傷害融化前排。',
        descriptionEn: 'The ruthless hero of chaos who never lets the battlefield cool. A stacking shooter whose firepower ramps up with every hit, melting the frontline with extreme burn damage.',
        attackDesc: '三段齊射疊燃：灼燒 → 烈焰 → 煉獄，越打越燙。',
        attackDescEn: 'Three volleys stack fire: Burn → Blaze → Inferno—hotter each hit.',
        allyRole: 'guardian',
        signatureCard: 'sig_caocao_burn',
        
        comboOverrides: [
            {   
                animTrigger: 'attack1', attackPattern: 'burst', burstCount: 1, projectileCount: 3, spreadAngle: 20,
                burstInterval: 0.08, bulletDamage: 100, fireDelay: 0.2, shootCooldown: 0.4,  
                dotConfig: { type: 'burn', duration: 3.5, tickRate: 0.9, damagePerTick: 48 }, 
            },
            { 
                burstCount: 1, bulletDamage: 100, projectileCount: 3, spreadAngle: 20,
                shootCooldown: 0.7, animTrigger: 'attack2', fireDelay: 0.6, textScaleMultiplier: 1.0,
                dotConfig: { type: 'flame', duration: 3.5, tickRate: 0.9, damagePerTick: 46 }, 
            },
            { 
                projectileCount: 3, spreadAngle: 20, burstCount: 2, bulletDamage: 150, 
                shootCooldown: 1.5, textScaleMultiplier: 1.5, animTrigger: 'attack3', 
                fireDelay: 1.3, knockbackDist: 0.5,
                dotConfig: { type: 'inferno', duration: 4.0, tickRate: 0.85, damagePerTick: 44 },
            } 
        ],
        superChargeNeeded: 3500,
        super: { 
            type: 'super_decoy', stealthDuration: 3.0, speedMultiplier: 1.5, textScaleMultiplier: 1.5,
            decoyLifetime: 3.0, explodeRadius: 5, explodeDamage: 800, destroyBush: true,
            // 爆炸特效模板（對應 CombatManager.aoeMap key）
            lobAreaBulletKey: 'aoeTemplate',
            desc: '進入隱身狀態並大幅提升跑速，同時在原地留下一個會造成巨大範圍傷害的爆炸誘餌。',
            descEn: 'Vanish at blazing speed, leaving an explosive decoy that devastates the area.'
        }
    },

    guanyu: { 
        name: 'GuanYu',
        select: { zh: '關羽', en: 'Guan Yu', title: '武聖', titleEn: 'God of War', faction: 'shu', role: '坦克', roleEn: 'Tank', range: 'melee', atk: 78 },
        unlockTier: 0, unlockCost: 0, unlockLevel: 1,
        health: 7000,             
        speed: 3.2,
        ammo: 3,
        reloadTime: 2.5,  
        shootCooldown: 0.4,
        dashDist: 3.5,         // 距離：縮短，避免飛到天邊
        dashSpeed: 14,         // 速度：放慢，讓視覺跟得上
        dashMaxDuration: 0.30, // 上限：放寬，確保 0.25s (3.5/14) 能完整跑完
        dashInvuln: 0.35,      // 無敵時間：直接寫死 0.35s (包含 0.1s 寬限期)
        dashEasePower: 2.5,     // 平滑度：降低數值，讓加減速曲線更自然
        color: { r: 0.60, g: 0.20, b: 0.10 },
        description: '提著青龍偃月刀的蜀漢武聖。全能型突進坦克，自帶緩速、衝鋒與範圍暈眩，一旦被他貼身就絕無生路。',
        descriptionEn: 'The God of War wielding the legendary crescent blade. An all-rounder vanguard tank with slows, dashes, and AoE stuns—lethal the moment he closes the gap.',
        attackDesc: '近戰三連：橫掃緩速、衝刺穿陣、重劈擊暈。',
        attackDescEn: 'Melee trio: sweeping slow, piercing dash, finishing stun cleave.',
        allyRole: 'vanguard',
        signatureCard: 'sig_guanyu_stun',   // 🌟 本命卡：威震（全軍攻％ + 分段震懾）
        skins: [
            { key: 'guanyu_skin_01', label: 'Skin 1', previewEntity: 'showmodernGY',
              unlockCost: 2500, unlockLevel: 4, unlockRogueWave: 15,
              sku: 'skin_guanyu_origin',
              description: '52 歲。深水埗屋邨保安。三十年巡樓，冇人叫過佢一聲名。覺醒前嘅佢——膝頭痛、腰痛、日日夜更。但呢個先係真正嘅阿關。未有令人透唔到氣嘅阿關。',
              descriptionEn: '52 years old. Estate security guard in Sham Shui Po. Thirty years of night shifts. Nobody ever called him by name. This is the real Mr Kwan before the battlefield that follows him everywhere. Bad knees, bad back, invisible. But real.' }
        ],

        comboOverrides: [
            { 
            animTrigger: 'attack1', bulletKey: 'punch_heavy', attackPattern: 'imelee', 
            bulletDamage: 300, bulletHitRadius: 4.5, coneAngle: 160, 
            fireDelay: 0.2,         
            shootCooldown: 0.7, whiffStep: 0.0,
            snareDuration: 0.4, snareMultiplier: 0.15,
            trailDuration: 0.1, 
            trailEmitTime: 0.35,
            trailDelay: 0.35,
            extraAttacks: [
                    {
                        bulletKey: 'guanyu', attackPattern: 'melee', bulletDamage: 100,       
                        bulletSpeed: 8, bulletLifetime: 0.4, bulletHitRadius: 1.0, knockbackDist: 0.5,
                        fireDelay: 0.2, snareDuration: 0.4, snareMultiplier: 0.15,
            
                    } 
            ]
        },
        { 
       
            animTrigger: 'attack2', bulletKey: 'punch_heavy', attackPattern: 'dash', 
            bulletDamage: 500, bulletScale: 1.6,
            bulletLifetime: 0.8, dashHitRadius: 2.8, dashOffset: 0,
            sweepConfig: { sweepFrom: -90, sweepTo: 90, snapDist: 2.0, snapRatio: 0.3, fadeStart: 0.55 },
            fireDelay: 0.2, shootCooldown: 0.7,
               
            rushConfig: { rushSpeed: 16.0, rushDistance: 4, windupTime: 0.15, recoverTime: 0.1, pierce: true },
            trailDuration: 0.1, 
            trailEmitTime: 0.5,
            trailDelay: 0.1,
        },
        { 
         
            animTrigger: 'attack3', bulletKey: 'slash_Sheavy', attackPattern: 'imelee', 
            bulletDamage: 800, bulletScale: 1.4, coneAngle: 180, bulletLifetime: 0.35, bulletHitRadius: 5.0,
            fireDelay: 0.6, shootCooldown: 1.3, autoStepRange: 2.0, whiffStep: 0.5,
            textScaleMultiplier: 1.5, knockbackDist: 1.0, stunDuration: 1.2,
            trailDuration: 0.1, 
            trailEmitTime: 0.7,
            trailDelay: 0.5,
            sweepConfig: { axis: 'x', startAngle: 10, endAngle: -10, ease: 'easeIn', easePower: 1}              
        }
    ],
        superChargeNeeded: 4000, 
        super: { 
            attackPattern:'super_pierce', type: 'super_pierce', bulletKey: 'sguanyu', 
            speed: 12.0, maxLife: 1, bulletDamage: 800, hitRadius: 3.5, fireDelay: 1.0, shootCooldown: 1.5,
            textScaleMultiplier: 1.8, destroyBush: true, knockbackDist: 1.5, 
            trailDuration: 0.1, 
            trailEmitTime: 0.7,
            trailDelay: 0.5,
            desc: '青龍突進貫穿敵陣，造成高額傷害並燒毀沿途草叢。',
            descEn: 'Dragon pierce through the line—heavy damage and brush cleared along the path.'
        }
    },

    zhangjiao: { 
        name: 'ZhangJiao',
        select: { zh: '張角', en: 'Zhang Jiao', title: '大賢良師', titleEn: 'Great Teacher', faction: 'qun', role: '輸出', roleEn: 'Damage', range: 'ranged', atk: 82 },
        unlockTier: 3, unlockCost: 12000, unlockLevel: 13,
        health: 3800,             
        speed: 3.5,
        ammo: 3,                 
        reloadTime: 2.5,  
        shootCooldown: 0.8,
        color: { r: 0.50, g: 0.20, b: 0.70 },
        description: '掀起黃巾狂潮的大賢良師。標準的陣地戰法師，靠召喚物與自動追蹤法術淹沒對手，極度考驗走位與距離控制。',
        descriptionEn: 'The Great Teacher who sparked the Yellow Turban tide. A zoning mage who drowns enemies in summons and homing spells, heavily reliant on spacing and positioning.',
        attackDesc: '以符咒驅動召喚與遠程法術，讓黃巾浪潮代為攻擊。',
        attackDescEn: 'Drive summons and ranged rites with sigils—the Yellow Turban tide strikes for you.',
        allyRole: 'tactician',
        skins: [
            { key: 'zhangjiao_skin_01', label: 'Skin 1', previewEntity: 'showmodernZJ',
              unlockCost: 3500, unlockLevel: 6, unlockRogueWave: 25,
              sku: 'skin_zhangjiao_origin',
              description: '58 歲。每個星期一晚深夜開直播。 佢唔係專業輔導員。只係一個願意聽嘅人。 做咗好多年。幫過好多人渡過最難嘅夜晚。',
              descriptionEn: '58 years old. Every Monday night, a late-night livestream. Not a therapist—just someone willing to listen. Years of this. Helped countless people through their darkest nights.' }
        ],
        comboOverrides: [
            { 
                animTrigger: 'attack1', bulletKey: 'zhangjiao', attackPattern: 'super_homing_bomb', 
                bulletDamage: 0, lobSpeed: 10, lobHeight: 1.5, lobDuration: 0.4, fireDelay: 0.4,
                spreadCount: 2, spreadAngle: 20, chaseSpeed: 4.2, chaseTime: 1.5, explodeRadius: 1.8, 
                explodeDamage: 240, shootCooldown: 0.6, 
            },
            { 
                animTrigger: 'attack2', bulletKey: 'zhangjiao', attackPattern: 'super_homing_bomb', 
                bulletDamage: 0, lobSpeed: 10, lobHeight: 1.5, lobDuration: 0.4, fireDelay: 0.4,
                spreadCount: 3, spreadAngle: 35, chaseSpeed: 4.2, chaseTime: 1.5, explodeRadius: 1.8, 
                explodeDamage: 240, shootCooldown: 0.6, 
            },
            { 
                animTrigger: 'attack3', bulletKey: 'zhangjiao', attackPattern: 'super_homing_bomb', 
                bulletDamage: 0, lobSpeed: 7, lobHeight: 2.5, lobDuration: 0.6, fireDelay: 0.9,
                chaseSpeed: 3.8, chaseTime: 2.0, explodeRadius: 2.8, 
                explodeDamage: 700, bulletScale: 2, shootCooldown: 1.2, textScaleMultiplier: 1.5, knockbackDist: 2.5, 
                snareDuration: 1.2, snareMultiplier: 0.5
            }
        ],
        superChargeNeeded: 3600, 
        super: {
           type: 'super_enhanced_attack', attackPattern: 'super_homing_bomb', bulletKey: 'zhangjiao', lobSpeed: 10, lobHeight: 2.5, 
            lobDuration: 0.6, fireDelay: 0.8, shootCooldown: 1.2,
            chaseSpeed: 4.5, chaseTime: 2.5, explodeRadius: 4, bulletScale: 2.5, textScaleMultiplier: 1.5,
            explodeDamage: 850, snareDuration: 1.2, snareMultiplier: 0.5, knockbackDist: 2.5, destroyBush: true,
            // 大招爆炸使用更強的張角爆炸模板
            lobAreaBulletKey: 'aoeTemplate',
            desc: '召喚一顆巨大且極具毀滅性的追蹤靈體，引發大範圍爆炸並強烈緩速倖存者。',
            descEn: 'Summon a colossal seeking spirit—massive blast that slows survivors.'
        }
    },


    // 吳 · 孫權（模板，數值／招式稍後調整）
    sunquan: {
        name: 'SunQuan',
        select: { zh: '孫權', en: 'Sun Quan', title: '江東霸主', titleEn: 'Lord of Jiangdong', faction: 'wu', role: '指揮', roleEn: 'Command', range: 'ranged', atk: 85 },
        unlockTier: 2, unlockCost: 5500, unlockLevel: 8,
        health: 4000,
        speed: 3.4,
        ammo: 3,
        reloadTime: 2.5,
        shootCooldown: 0.4,
        color: { r: 0.85, g: 0.20, b: 0.18 },
        description: '穩紮穩打的江東之主。作為控場核心，他以重矢點射與環狀彈幕封鎖走位，強迫對手跟著他的節奏打。',
        descriptionEn: 'The steady Lord of Wu. A control-focused leader who pins down foes with heavy bolts and ring barrages, forcing them to fight at his pace.',
        attackDesc: '沉穩遠程調度：重矢點射、扇形散射，終段環狀彈幕壓制周圍。',
        attackDescEn: 'Steady ranged command: heavy bolts, fan spreads, then a ring barrage to lock the area.',
        allyRole: 'tactician',

        comboOverrides: [
            {
                animTrigger: 'attack1', bulletKey: 'sunquan', attackPattern: 'normal',
                bulletDamage: 350,  knockbackDist: 2,
                bulletSpeed: 12, bulletLifetime: 1.2, bulletHitRadius: 3, fireDelay: 0.45,
                shootCooldown: 0.65, whiffStep: 0.0, bulletScale: 1.2, knockbackDist: 1.5, 
            },
            {
                animTrigger: 'attack2', bulletKey: 'sunquan', attackPattern: 'spread',
                bulletDamage: 350,
                bulletSpeed: 16, bulletLifetime: 0.7, bulletHitRadius: 1.5, bulletScale: 1.2,
                spreadCount: 3, spreadAngle: 28, shootCooldown: 0.7, fireDelay: 0.5, whiffStep: 0.0, knockbackDist: 1.5, 
            },
            {
                animTrigger: 'attack3', bulletKey: 'sunquan', attackPattern: 'spread',
                bulletDamage: 300,
                bulletSpeed: 16, bulletLifetime: 0.75, bulletHitRadius: 2, bulletScale: 1.5, knockbackDist: 0.4,
                spreadCount: 6, spreadAngle: 360, shootCooldown: 1.4, fireDelay: 1.2, whiffStep: 0.0, knockbackDist: 1.5, 
            }
        ],
        superChargeNeeded: 3500,
        super: {
            type: 'super_skyfall',        // 必須，舊的 super_zhouyu_burst 已廢棄
            targetMode: 'nearest',        // 或 'aim_chain'
            timingMode: 'stagger_explode',// 'simultaneous' | 'stagger_explode' | 'sequential_mark'
            maxTargets: 6,                // 取代 burstCount
            range: 12,
            warnDelay: 1.2,               // 預警圈顯示到爆炸的時間（優先於 fireDelay）
            burstInterval: 0.15,
            lobAreaRadius: 2.5,           // 同時決定預警圈直徑 = radius*2
            lobAreaBulletKey: 'zhouyu',   // 爆炸特效（不是預警圈）
            lobAreaDuration: 0.6,
            lobAreaDamage: 400,
            lobAreaTickRate: 0.15,
            shootCooldown: 1.4,
            destroyBush: true,
            dotConfig: { type: 'burn', duration: 4.0, tickRate: 1.0, damagePerTick: 100 },
            desc: '天降火雨鎖定多名敵人，爆炸後持續灼燒並可燒毀草叢。',
            descEn: 'Skyfall fire marks multiple foes—blasts burn on and clear brush.'
        }
    },

    lubu: { 
        name: 'Lu Bu', 
        select: { zh: '呂布', en: 'Lu Bu', title: '飛將', titleEn: 'Flying General', faction: 'qun', role: '近戰', roleEn: 'Melee', range: 'melee', atk: 96 },
        unlockTier: 3, unlockCost: 10000, unlockLevel: 11,
        health: 6000,             
        speed: 4.0,               
        ammo: 3,
        reloadTime: 2.2,
        shootCooldown: 0.3,          
        color: { r: 0.85, g: 0.20, b: 0.60 }, 
        description: '戰力天花板的無雙飛將。純粹的近戰爆發機器，極限貼身輸出且重擊附帶流血，捲入他的旋風就只有死路一條。',
        descriptionEn: 'The undisputed apex warrior. A pure melee burst machine with bleeding heavy strikes—get caught in his whirlwind, and there is no way out.',
        attackDesc: '方天畫戟近戰連斬，重擊可附帶流血。',
        attackDescEn: 'Halberd melee combos; heavy hits can apply bleed.',
        allyRole: 'vanguard',
        
        comboOverrides: [
            { 
                animTrigger: 'attack3', attackPattern: 'imelee', bulletKey: 'punch_heavy',
                bulletDamage: 350, coneAngle: 120, bulletHitRadius: 3, 
                fireDelay: 0.2, shootCooldown: 0.4, autoStepRange: 2.5,
                trailDuration: 0.1, 
                trailEmitTime: 0.4, 
            },
            { 
                animTrigger: 'attack2', attackPattern: 'imelee', bulletKey: 'punch_heavy',
                bulletDamage: 400, coneAngle: 140, bulletHitRadius: 4, 
                fireDelay: 0.2, shootCooldown: 0.4, 
                autoStepRange: 1.5, whiffStep: 1.0, knockbackDist: 1.0,
                trailDuration: 0.1, 
                trailEmitTime: 0.4,  
            },
            { 
                animTrigger: 'attack1', attackPattern: 'imelee', bulletKey: 'punch_heavy', trailDelay: 0.2,
                bulletDamage: 500, coneAngle: 360, fireDelay: 0.4, shootCooldown: 1.2, autoStepRange: 2.0,        
                whiffStep: 1.5, bulletHitRadius: 4, textScaleMultiplier: 1.5,
                trailDuration: 0.1, 
                trailEmitTime: 1,   
                sweepConfig: { axis: 'x', startAngle: 10, endAngle: -10, ease: 'easeIn', easePower: 3},
                extraAttacks: [
                    {
                        bulletKey: 'lubu', attackPattern: 'imelee', coneAngle: 360, trailDuration: 0.2,
                        bulletDamage: 550,  fireDelay: 0.6, bulletHitRadius: 4, textScaleMultiplier: 1.5, 
                        bulletLifetime: 0.3, bulletScale: 1.5,
                        dotConfig: { type: 'bleed', duration: 3.0, tickRate: 1.0, damagePerTick: 80 }
                    }                
                ]    
             },
        ],
        superChargeNeeded: 5000,
        super: {
            type: 'super_whirlwind', bulletHitRadius: 2.5, bulletDamage: 400, hideWeaponProp: true,
            burstCount: 10, burstInterval: 0.08, bulletSpeed: 16, bulletLifetime: 0.3, useTrail: false,
            textScaleMultiplier: 1.5, shootCooldown: 1.2, knockbackDist: 0.5, destroyBush: true,
            desc: '化身殺戮旋風，在極短時間內對周圍敵人進行高達 10 次的連續毀滅打擊。',
            descEn: 'Become a killing whirlwind—10 crushing blows in an instant.'
        }
    },

    zhangfei: {
        name: 'ZhangFei',
        select: { zh: '張飛', en: 'Zhang Fei', title: '萬人敵', titleEn: 'Peerless', faction: 'shu', role: '坦克', roleEn: 'Tank', range: 'melee', atk: 76 },
        unlockTier: 1, unlockCost: 1800, unlockLevel: 4,
        health: 7500,             
        speed: 3.0,               
        ammo: 3,                  
        reloadTime: 3.0,  
        shootCooldown: 0.3,
        color: { r: 0.85, g: 0.20, b: 0.20 }, 
        description: '嗓門與力氣一樣大的破陣先鋒。靠蠻力強開團的重裝鬥士，大招連續咆哮能輕易撕裂敵方陣型。',
        descriptionEn: 'A line-breaker with a voice as loud as his raw strength. A heavy brawler built to force team fights, using his roaring Super to shatter enemy formations.',
        attackDesc: '近戰重矛連擊，以蠻力壓制近身敵人。',
        attackDescEn: 'Heavy spear melee combos—raw force up close.',
        allyRole: 'vanguard',
        signatureCard: 'sig_zhangfei_snare',
        
        comboOverrides: [
            { 
                animTrigger: 'attack1', attackPattern: 'imelee', bulletKey: 'punch_heavy',
                bulletDamage: 400, fireDelay: 0.4, coneAngle: 120,
                trailDuration: 0.1, 
                trailEmitTime: 0.6,
                shootCooldown: 0.6, bulletHitRadius: 3.0, whiffStep: 1.5,
                autoStepRange: 1.5, snareDuration: 1.5, snareMultiplier: 0.7, 
            },
            { 
                animTrigger: 'attack2',  attackPattern: 'imelee', bulletKey: 'punch_heavy',
                bulletDamage: 550, fireDelay: 0.4, coneAngle: 140, shootCooldown: 0.6, bulletHitRadius: 4, 
                autoStepRange: 1.5, whiffStep: 1.5,
                trailDuration: 0.1, 
                trailEmitTime: 0.6,
                //trailDelay: 0.55,
            },
            { 
                // 🌟 第3hit：短促咆哮波（壓縮段數／壽命，讓 Perfect Dodge i-frame≈0.55s 能蓋住）
                animTrigger: 'attack3', attackPattern: 'flamethrower', bulletKey: 'sonic',
                burstCount: 4, burstInterval: 0.08, bulletDamage: 200, bulletSpeed: 12,
                bulletLifetime: 0.3, bulletHitRadius: 1.8, hideWeaponProp: true, useTrail: false,
                fireDelay: 0.45, shootCooldown: 1.2,
                knockbackDist: 1.0,        // 強擊退撞飛
                textScaleMultiplier: 1.5,
                maxScale: 2.2, baseHitRadius: 1.5, maxHitRadius: 2.2,
            },
        ],
        superChargeNeeded: 5000,
        super: { 
            type: 'super_zhangfei_roar', attackPattern: 'flamethrower', bulletKey: 'sonic', bulletLifetime: 0.35,
            bulletDamage: 210, bulletSpeed: 15, stunDuration: 1.0,
            burstCount: 5, burstInterval: 0.08, bulletHitRadius: 2.0, growSpeed: 4.5,
            fireDelay: 0.5, knockbackDist: 0.5, hideWeaponProp: true, textScaleMultiplier: 1.5,
            maxScale: 2.0, baseHitRadius: 2.0, maxHitRadius: 2.4, destroyBush: true, useTrail: false,
            desc: '發出震耳欲聾的 4 連發狂獅咆哮，摧毀前方草叢並對敵人造成暈眩與擊退。',
            descEn: 'Four deafening lion roars—clear brush, stun and knock foes back.'
        }
    },

    diaochan: {
        name: 'DiaoChan',
        select: { zh: '貂蟬', en: 'Diao Chan', title: '閉月', titleEn: 'Moon Eclipse', faction: 'qun', role: '狙擊', roleEn: 'Sniper', range: 'ranged', atk: 88 },
        unlockTier: 3, unlockCost: 15000, unlockLevel: 15,
        health: 3000,             
        speed: 3.8,              
        ammo: 2,                 
        reloadTime: 3.5,         
        shootCooldown: 1.5,      
        bulletSpeed: 18,         
        bulletLifetime: 1.8,     
        bulletDamage: 400,       
        bulletHitRadius: 2.0,
        attackPattern: 'explode',
        fireDelay: 0.6,          
        explodeRadius: 3.0,      
        explodeDamage: 900,     
        color: { r: 0.9, g: 0.1, b: 0.4 }, 
        description: '隱藏在絕美外表下的重裝狙擊手。射速極慢且彈藥匱乏，但單發爆破傷害足以直接摧毀敵方防線。',
        descriptionEn: 'A heavy sniper hiding behind a breathtaking facade. Ammo is scarce and fire rate is extremely slow, but a single explosive shot is enough to demolish enemy lines.',
        attackDesc: '超遠距爆破彈：射速慢、彈藥少，命中後範圍爆炸。',
        attackDescEn: 'Ultra-long explosive shots—slow, scarce ammo, AoE blast on impact.',
        allyRole: 'tactician',
        superChargeNeeded: 5000,
        super: { 
            type: 'super_transform', transformTo: 'diaochan_lubu',
            desc: '變身成呂布，化成眾人的恐懼，獲得極高血量與瘋狂的近戰連擊能力。',
            descEn: 'Transform into Lu Bu—terror incarnate with massive HP and furious melee combos.'
        }
    },

    diaochan_lubu: {
        name: 'Lu Bu (Mecha)',
        modelKey: 'diaochan_lubu',  
        scale: 1.3,            
        health: 9000,             
        speed: 4.0,             
        ammo: 1,                 
        reloadTime: 3.6,         
        shootCooldown: 1.6,       
        bulletSpeed: 15,
        bulletLifetime: 0.3,
        bulletDamage: 300,        
        bulletHitRadius: 1.5,    
        attackPattern: 'melee',
        bulletKey: 'punch_light',
        fireDelay: 0.4,       
        isMecha: true,              
        autoStepRange: 3.5,      
        whiffStep: 3.5,
        description: '貂蟬所化之呂布機甲型態。血量如山、七連拳狂轟近戰，但機體過熱會不斷流失生命——趁勢打穿，勿戀戰。',
        descriptionEn: 'Diao Chan’s Lu Bu mecha form. Mountainous HP and a seven-hit melee frenzy, but the frame drains life—strike hard, don’t linger.',
        attackDesc: '七連近戰重拳，極速貼身輸出。',
        attackDescEn: 'Seven-hit melee punches—blazing close-range damage.',
        extraAttacks: [
            { attackPattern: 'melee', bulletKey: 'punch_light', bulletDamage: 300, bulletSpeed: 15, bulletLifetime: 0.3, fireDelay: 0.55 },
            { attackPattern: 'melee', bulletKey: 'punch_light', bulletDamage: 300, bulletSpeed: 15, bulletLifetime: 0.3, fireDelay: 0.7 },
            { attackPattern: 'melee', bulletKey: 'punch_light', bulletDamage: 300, bulletSpeed: 15, bulletLifetime: 0.3, fireDelay: 0.85 },
            { attackPattern: 'melee', bulletKey: 'punch_light', bulletDamage: 300, bulletSpeed: 15, bulletLifetime: 0.3, fireDelay: 1.0 },
            { attackPattern: 'melee', bulletKey: 'punch_light', bulletDamage: 300, bulletSpeed: 15, bulletLifetime: 0.3, fireDelay: 1.15 },
            { attackPattern: 'melee', bulletKey: 'punch_light', bulletDamage: 300, bulletSpeed: 15, bulletLifetime: 0.3, fireDelay: 1.3 },              
        ],              
        textScaleMultiplier: 1.5,
        autoDrainRate: 0.09      
    },

    liubei: { 
        name: 'LiuBei',
        select: { zh: '劉備', en: 'Liu Bei', title: '梟雄', titleEn: 'Ambitious Lord', faction: 'shu', role: '鬥士', roleEn: 'Fighter', range: 'melee', atk: 72 },                  
        unlockTier: 2, unlockCost: 5000, unlockLevel: 7,
        health: 5000,             
        speed: 3.8, 
        ammo: 3,                 
        reloadTime: 2.4,   
        shootCooldown: 0.4,
         dashDist: 3.5,         // 距離：縮短，避免飛到天邊
        dashSpeed: 14,         // 速度：放慢，讓視覺跟得上
        dashMaxDuration: 0.30, // 上限：放寬，確保 0.25s (3.5/14) 能完整跑完
        dashInvuln: 0.35,      // 無敵時間：直接寫死 0.35s (包含 0.1s 寬限期)
        dashEasePower: 2.5,     // 平滑度：降低數值，讓加減速曲線更自然
        color: { r: 0.20, g: 0.80, b: 0.20 }, 
        description: '滿口仁義，下手卻比誰都快的梟雄。高機動刺客，依賴雙段衝刺切入戰場，一套重劈帶走目標後還能迅速脫戰。',
        descriptionEn: 'An ambitious lord whose strikes are faster than his words of benevolence. A high-mobility assassin who dashes in, secures the kill with a heavy cleave, and rockets to safety.',
        attackDesc: '雙刀突進連斬：兩段衝刺切入，終段重劈可流血擊退。',
        attackDescEn: 'Twin-blade dash combos: two rushes in, finish with a bleed knockback cleave.',
        allyRole: 'guardian',
        signatureCard: 'sig_liubei_bleed',
        
        comboOverrides: [
            {   
                // 🌟 第一段:快速衝刺切入(輕快、接近用)
                animTrigger: 'attack1', bulletKey: 'liubei', attackPattern: 'dash', 
                bulletDamage: 350,
                bulletLifetime: 0.15, shootCooldown: 0.35,
                dashHitRadius: 2.5, dashOffset: 0.5,
                bulletScale: 1.2,
                rushConfig: { rushSpeed: 22.0, rushDistance: 2.8, windupTime: 0, recoverTime: 0.05, pierce: true },
                afterimage: true, afterimageInterval: 0.05, afterimageLifetime: 0.22, afterimageOpacity: 0.45,
            }, 
            { 
                // 🌟 第二段:再一次衝刺(輕快、銜接用)
                animTrigger: 'attack2', bulletKey: 'liubei', attackPattern: 'dash',
                bulletDamage: 400, bulletScale: 1.3,
                bulletLifetime: 0.15, shootCooldown: 0.5, 
                dashHitRadius: 2.5, dashOffset: 0.5, 
                rushConfig: { rushSpeed: 22.0, rushDistance: 3.0, windupTime: 0, recoverTime: 0.05, pierce: true },
                afterimage: true, afterimageInterval: 0.05, afterimageLifetime: 0.22, afterimageOpacity: 0.45,
            },
            { 
                  // 🌟 第三段:衝刺突進 + 落地終結重劈(慢、重、爽 — 一套的高潮)
                animTrigger: 'attack3', bulletKey: 'slash_heavy', attackPattern: 'imelee', 
                bulletDamage: 900, bulletScale: 1.4, coneAngle: 140, bulletHitRadius: 3.5, bulletLifetime: 0.3,
                fireDelay: 0.25, shootCooldown: 0.9,
                textScaleMultiplier: 1.5,     // 🌟 大傷害數字 — 成就感
                knockbackDist: 1.5,           // 🌟 劈飛 — 衝擊反饋
                dotConfig: { type: 'bleed', duration: 3.0, tickRate: 1.0, damagePerTick: 80 },
                // 🌟 衝進去後停下來劈(pierce: false 衝到面前就停,不穿過)
                rushConfig: { rushSpeed: 24.0, rushDistance: 3.2, windupTime: 0, recoverTime: 0.12, pierce: false },
                afterimage: true, afterimageInterval: 0.045, afterimageLifetime: 0.2, afterimageOpacity: 0.4,
            }
        ],
        superChargeNeeded: 3800,
        super: { 
            type: 'super_enhanced_attack', attackPattern: 'spread', bulletKey: 'liubei',
            bulletDamage: 300, spreadCount: 5, spreadAngle: 65, 
            bulletSpeed: 15, bulletLifetime: 0.4, bulletHitRadius: 1.5, destroyBush: true,
            shootCooldown: 0.5, fireDelay: 0, // 逃命技絕不能有前搖
            whiffStep: -5.0,                  // 🌟 核心：瞬間向後飛退 5 個單位
            knockbackDist: 1.5,               // 把面前的敵人往前推開
            snareDuration: 2.0, snareMultiplier: 0.3, // 落地附帶強烈緩速，確保徹底脫戰
            desc: '緊急迴避：向前方扇形發射緩速網，並利用強大後座力讓自己瞬間向後飛退脫離險境。',
            descEn: 'Emergency escape: fan of slow nets forward, then rocket backward out of danger.'
                        
            //type: 'super_liubei_tree', treeHealth: 7500, treeLifetime: 3.2, auraRadius: 3.5, healPerTick: 800, tickRate: 1.5, treePhysicalRadius: 2, treeScale: [1, 1, 1], auraColor: [0.2, 1.0, 0.4], auraOpacity: 1,
            //desc: '桃園結義，為待在光環範圍內的友軍持續恢復大量生命值。'
        }   
    },

    zhangliao: { 
        name: 'ZhangLiao',
        select: { zh: '張遼', en: 'Zhang Liao', title: '止啼', titleEn: 'Silencer', faction: 'wei', role: '輸出', roleEn: 'Damage', range: 'melee', atk: 88 },
        unlockTier: 2, unlockCost: 4500, unlockLevel: 6,
        health: 4800,             
        speed: 3.8,
        ammo: 3,
        reloadTime: 2.2,  
        shootCooldown: 0.4,
        color: { r: 0.60, g: 0.20, b: 0.10 },
        description: '令人聞風喪膽的突擊手。擅長利用突進斬斷敵方連技，並搭配去回雙重傷害的飛刀收割殘血。',
        descriptionEn: 'The terror of Xiaoyaojin. An aggressive rusher who interrupts enemy combos with dash cleaves and finishes off stragglers with returning boomerang blades.',
        attackDesc: '首段突進重斬破防，後段弧線飛刀去回雙傷。',
        attackDescEn: 'Opening dash cleave breaks guard; curved blades hit outbound and return.',
        allyRole: 'vanguard',
        
        comboOverrides: [
            { 
                animTrigger: 'attack1', bulletKey: 'slash_Sheavy', attackPattern: 'imelee', 
                bulletDamage: 550, fireDelay: 0.15, bulletHitRadius: 3.5, coneAngle: 140, dashOffset: 1, bulletLifetime: 0.3,
                shootCooldown: 0.6, whiffStep: 3.5, knockbackDist: 1.5, trailDelay: 0.11,
            },
            { 
                animTrigger: 'attack2', bulletKey: 'zhangliao',  attackPattern: 'boomerang', hideWeaponProp: true, whiffStep: -1.5,
                useTrail: false,
                bulletDamage: 450,
                boomerangDistance: 6.0,       // 飛多遠掉頭(去程最遠距離)
                boomerangSpeed: 12,           // 飛行速度
                bulletHitRadius: 1.2,         // 命中半徑
                boomerangSpin: 1080,           // 自轉速度(度/秒,視覺用)
                boomerangCatchDist: 1.0,      // 飛回到離主人多近就回收
                boomerangCurve: 1.5,      // 去程弧線往側邊鼓多遠(0 = 直線,越大越彎)
                boomerangCurveDir: -1,     // 1 = 往右甩,-1 = 往左甩
            },
            { 
                animTrigger: 'attack3', bulletKey: 'zhangliao',  attackPattern: 'boomerang', hideWeaponProp: true, whiffStep: -2.0,
                useTrail: false,
                bulletDamage: 500,
                boomerangDistance: 8.0,       // 飛多遠掉頭(去程最遠距離)
                boomerangSpeed: 12,           // 飛行速度
                bulletHitRadius: 1.2,         // 命中半徑
                boomerangSpin: 1080,           // 自轉速度(度/秒,視覺用)
                boomerangCatchDist: 1.0,      // 飛回到離主人多近就回收
                boomerangCurve: 2.5,      // 去程弧線往側邊鼓多遠(0 = 直線,越大越彎)
                boomerangCurveDir: 1,     // 1 = 往右甩,-1 = 往左甩
            }
        ],
        superChargeNeeded: 3500, 
        super: { 
            type: 'super_enhanced_attack', bulletKey: 'slash_Sheavy', attackPattern: 'imelee', stunDuration: 0.5, 
            bulletDamage: 900, bulletScale: 1.5, knockbackDist: 1.5, coneAngle: 120, bulletHitRadius: 2.0, bulletLifetime: 0.3,
            shootCooldown: 0.6, fireDelay: 0.15, whiffStep: 4.0, textScaleMultiplier: 1.5, destroyBush: true,
            desc: '以極快速度向前突進，可擊斷敵人的連技。',
            descEn: 'Blitz forward at blinding speed—interrupt enemy combos.'
        }
    },

    // ── 玩家專用：Yellow Bros（Rogue 通關解鎖）────────────────────────────────────────
    zhangbao: {
        name: 'Yellow Bros',
        modelKey: 'playerminion_melee',
        select: { zh: '黃巾兄弟', en: 'Yellow Bros', title: '黃天當立', titleEn: 'Yellow Heaven Rises', faction: 'qun', role: '變形', roleEn: 'Transform', range: 'melee', atk: 80, previewScale: 1.8, previewUseOrigScale: true },
        unlockTier: 'rogue',
        unlockRogue: true,
        unlockCost: 0,
        health: 4500,
        speed: 3.6,
        ammo: 3,
        reloadTime: 2.0,
        shootCooldown: 0.5,
        bulletSpeed: 20,
        bulletLifetime: 0.15,
        bulletDamage: 280,
        bulletHitRadius: 2.0,
        attackPattern: 'melee',
        color: { r: 0.85, g: 0.75, b: 0.15 },
        description: '三人一體的黃巾兄弟。能透過大招自由切換近戰、投擲與弓箭三種形態，適應並反制各種戰況。',
        descriptionEn: 'Three brothers fighting as one. Uses the Super to cycle freely between melee, throw, and bow forms, adapting to counter any battlefield situation.',
        attackDesc: '近戰形態：貼身連斬開闢前線。',
        attackDescEn: 'Melee form: close-range cleaves to hold the front.',
        comboOverrides: [
            {
                animTrigger: 'attack1', bulletKey: 'slash_Sheavy', attackPattern: 'imelee', 
                bulletDamage: 400, fireDelay: 0.5, bulletHitRadius: 2.5, coneAngle: 100, dashOffset: 1, bulletLifetime: 0.35,
                shootCooldown: 1.05, whiffStep: 3.5, knockbackDist: 1.5, trailDelay: 0.11,
            },
            {
                animTrigger: 'attack2', bulletKey: 'slash_light', attackPattern: 'melee',
                bulletDamage: 880, fireDelay: 0.8, bulletHitRadius: 3.2, bulletLifetime: 0.2, bulletSpeed: 5,
                shootCooldown: 1.4, whiffStep: 1.2,
            },
            {
                animTrigger: 'attack3', bulletKey: 'slash_heavy', attackPattern: 'melee',
                bulletDamage: 1150, fireDelay: 1.0, bulletScale: 1.2, bulletHitRadius: 3.2, bulletLifetime: 0.25, bulletSpeed: 6,
                shootCooldown: 2.2, whiffStep: 1.5, stunDuration: 1.0,
            },
        ],
        superChargeNeeded: 1,
        super: {
            type: 'super_transform',
            shareHealth: true,
            transformTo: 'zhangbao_throw',
            transformCycle: ['zhangbao_throw', 'zhangbao_bow', 'zhangbao'],
            shootCooldown: 0.6,
            fireDelay: 0,
            desc: '變換黃巾軍兵器：投擲 → 弓箭 → 近戰，三形態共用血條。',
            descEn: 'Swap Turban arms: Throw → Bow → Melee. Three forms, one health bar.',
        },
    },

    zhangbao_throw: {
        name: 'Yellow Bros (Throw)',
        modelKey: 'playerminion_ranged',
        displayZh: '張寶',
        displayEn: 'Zhang Bao',
        health: 4500,
        speed: 3.5,
        ammo: 3,
        reloadTime: 2.0,
        attackPattern: 'lob',
        color: { r: 0.85, g: 0.75, b: 0.15 },
        description: '黃巾兄弟・投擲形態。改以拋物線投彈壓制中距，適合拉開身位後再砸進敵群。',
        descriptionEn: 'Yellow Bros—throw form. Lobbed bombs control mid-range; create space, then drop them into the pack.',
        attackDesc: '拋物線投彈，落點範圍傷害。',
        attackDescEn: 'Lobbed bombs with splash damage on landing.',
        comboOverrides: [
            {
                animTrigger: 'attack1', bulletKey: 'zhouyuL', attackPattern: 'lob',
                lobMinRange: 1.5, lobMaxRange: 7.0,
                lobDurationMode: 'byDistance', lobSpeed: 12, lobGravity: 28,
                lobHeight: 2.4, lobHeightMinScale: 0.55,
                fireDelay: 1.07, explodeRadius: 3.0, lobAreaRadius: 3.0,
                lobAreaBulletKey: 'aoeTemplate',
                lobAreaDuration: 0.2, lobAreaDamage: 1300, shootCooldown: 2.2,
            },
        ],
    },

    zhangbao_bow: {
        name: 'Yellow Bros (Bow)',
        modelKey: 'playerminion_CB',
        displayZh: '張寶',
        displayEn: 'Zhang Bao',
        health: 4500,
        speed: 3.7,
        ammo: 3,
        reloadTime: 1.8,
        attackPattern: 'burst',
        color: { r: 0.85, g: 0.75, b: 0.15 },
        description: '黃巾兄弟・弓箭形態。遠距連射牽制敵線，把戰場節奏拉回己方射程優勢。',
        descriptionEn: 'Yellow Bros—bow form. Ranged volleys pin the line and pull the fight back into your reach advantage.',
        attackDesc: '遠距弓箭連射，壓制敵線。',
        attackDescEn: 'Ranged bow volleys to pin the enemy line.',
        comboOverrides: [
            {
                animTrigger: 'attack1', bulletKey: 'caocao', attackPattern: 'normal',
                bulletSpeed: 16, fireDelay: 0.65, bulletDamage: 450, bulletHitRadius: 1.2, bulletLifetime: 1.1,
                shootCooldown: 2.45,
                 extraAttacks:[
                { attackPattern: 'normal', bulletKey: 'caocao', bulletDamage: 450, bulletSpeed: 16, bulletLifetime: 1.1, fireDelay: 1.3 },
                { attackPattern: 'normal', bulletKey: 'caocao', bulletDamage: 450, bulletSpeed: 16, bulletLifetime: 1.1, fireDelay: 1.95 }
                ]
            },
        ],
    },

    minion_melee: 
    { name: 'Yellow Turban',
    displayZh: '黃巾巨漢',
    displayEn: 'Yellow Turban Brute',
    health: 1500, speed: 3, ammo: 3, 
    reloadTime: 1.5, shootCooldown: 1.5, 
    bulletSpeed: 20, bulletLifetime: 0.1, 
    bulletDamage: 25, bulletHitRadius: 2.2, 
    attackPattern: 'melee', 
    color: { r: 0.8, g: 0.2, b: 0.2 },
    description: '黃巾巨漢。近身揮砍的前線肉盾，替張角與同袍頂住第一波衝擊。',
    descriptionEn: 'Yellow Turban Brute. A frontline melee shield who absorbs the first clash for Zhang Jiao’s flock.',
    comboOverrides: [
            { 
                animTrigger: 'attack1', bulletKey: 'slash_light', attackPattern: 'melee', 
                bulletDamage: 200, fireDelay: 0.9, bulletHitRadius: 3.5, bulletLifetime: 0.2, bulletSpeed: 4,
                shootCooldown: 1.7, whiffStep: 1.5,
            },
            { 
                animTrigger: 'attack2', bulletKey: 'slash_light', attackPattern: 'melee', 
                bulletDamage: 220, fireDelay: 1.2, bulletHitRadius: 3.5, bulletLifetime: 0.2, bulletSpeed: 4,
                shootCooldown: 1.7, whiffStep: 1.5,
            },
            { 
                animTrigger: 'attack3', bulletKey: 'slash_heavy', attackPattern: 'melee', 
                bulletDamage: 300, fireDelay: 0.6, bulletScale: 1.2, bulletHitRadius: 2, bulletLifetime: 0.2, bulletSpeed: 7,
                shootCooldown: 2.5, whiffStep: 1.5, stunDuration: 1.5,
            },
            ]
    
    },
    
    minion_ranged: 
    { name: 'Turban Thrower', displayZh: '黃巾擲卒', displayEn: 'Yellow Turban Thrower', health: 1200, speed: 3, ammo: 3,
    reloadTime: 1.5,
    color: { r: 0.8, g: 0.2, b: 0.2 },
    description: '黃巾擲卒。以拋物投彈騷擾中距，逼對手離開舒適走位。',
    descriptionEn: 'Yellow Turban Thrower. Lobs disrupt mid-range and shove foes out of safe footing.',
    
    comboOverrides: [
            { 
                animTrigger: 'attack1',  bulletKey: 'zhouyuL', attackPattern: 'lob',
                lobMinRange: 2.0, lobMaxRange: 7.0,
                lobDurationMode: 'byDistance', lobSpeed: 12, lobGravity: 28,
                lobHeight: 2.2, lobHeightMinScale: 0.5,
                fireDelay: 1.07, explodeRadius: 1.8, lobAreaRadius: 1.8,
                // 小兵投擲落點 AOE：用箭矢/通用 AOE（可自行替換）
                lobAreaBulletKey: 'aoeTemplate',
                lobAreaDuration: 0.2, lobAreaDamage: 200, shootCooldown: 2.5, 
            },
    ]
    },      

    minion_CB: 
    { name: 'Turban Archer', displayZh: '黃巾銳弓', displayEn: 'Yellow Turban Archer', health: 1000, speed: 3, ammo: 3,
    reloadTime: 1.5,
    color: { r: 0.8, g: 0.2, b: 0.2 },
    description: '黃巾銳弓。點射牽制遠距目標，為黃巾浪潮補上遠火支援。',
    descriptionEn: 'Yellow Turban Archer. Pinpoint fire harasses at range and backs the Turban tide with arrows.',
    
    comboOverrides: [
            { 
                animTrigger: 'attack1',  bulletKey: 'caocao', attackPattern: 'burst',
                burstCount: 3, burstInterval: 1.0,
                bulletSpeed: 14,  fireDelay: 0.7, bulletDamage: 100, bulletHitRadius: 1, bulletLifetime: 1.2,
                shootCooldown: 2.45, 
            },
    ]
    },
    
    boss_zhangjiao: {
        name: 'BOSS ZHANG JIAO', displayZh: '張角', displayEn: 'Zhang Jiao', scale: 1.3, health: 8000, speed: 4.2,
        ammo: 99, reloadTime: 0,
        shootCooldown: 1.8, animTrigger: 'attack3',
        bulletSpeed: 15, bulletLifetime: 1.2, fireDelay: 0.7,
        bulletDamage: 400, bulletHitRadius: 0.5,
        attackPattern: 'spread', spreadCount: 5, spreadAngle: 45,
        bulletKey: 'arcane_sigil',
        shootingSpeedMultiplier: 0.8,
        // 招與招之間呼吸空檔：不可出手，可走位壓迫（橫移）
        modeRecoverTime: 0.8,
        color: { r: 0.5, g: 0.1, b: 0.8 },
        description: 'Boss 張角。壓迫型遠程法師——中距扇形符矢、遠距天降火雨、近距毒焰儀式，依距離切換殺著。',
        descriptionEn: 'Boss Zhang Jiao. A pressure mage—mid-range sigil fans, distant skyfall fire, close-range poison rite, picking tools by distance.',
        // 依距離智能選招；每招獨立前搖 / 冷卻 / 對齊的距離帶
        // animTrigger 4/5/6 為 Boss 專用（玩家張角不用）
        bossAttackModes: [
            {
                id: 'thunder_fan',
                animTrigger: 'attack4',
                attackPattern: 'spread', spreadCount: 5, spreadAngle: 45,
                bulletKey: 'arcane_sigil',
                bulletDamage: 400, bulletSpeed: 15, bulletLifetime: 1.2, bulletHitRadius: 0.5,
                fireDelay: 1.2, shootCooldown: 1.9,
                minRange: 0, maxRange: 12
            },
            {
                id: 'heaven_fall',
                animTrigger: 'attack6',
                type: 'super_skyfall',
                attackPattern: 'super_skyfall',
                targetMode: 'aim_chain',
                timingMode: 'sequential_mark',
                maxTargets: 6,
                range: 12,
                warnDelay: 1.2,
                burstInterval: 0.45,
                lobAreaRadius: 2.5,
                lobAreaBulletKey: 'zhouyu',
                lobAreaDuration: 0.6,
                lobAreaDamage: 400,
                lobAreaTickRate: 0.15,
                destroyBush: true,
                dotConfig: { type: 'burn', duration: 4.0, tickRate: 1.0, damagePerTick: 100 },
                fireDelay: 0.35,
                // sequential 約 6*(1.2+0.45)≈9.9s；鎖定由 estimateSkyfallLockDuration 覆蓋
                shootCooldown: 2.2,
                minRange: 5, maxRange: 12
            },
            {
                id: 'poison_rite',
                animTrigger: 'attack5',
                attackPattern: 'flamethrower', bulletKey: 'sonic',
                burstCount: 3, burstInterval: 0.1, bulletDamage: 500, bulletSpeed: 12,
                bulletLifetime: 0.3, bulletHitRadius: 1.8, hideWeaponProp: true, useTrail: false,
                fireDelay: 2.0, shootCooldown: 3.2,
                knockbackDist: 1.0,
                textScaleMultiplier: 1.5,
                minRange: 0, maxRange: 5.5
            }
        ]
    }
};

// PvP bot 競技場顯示名（與 scoreManager.BOT_ARENA_NAMES 同步）
BrawlerConfig.botArenaNames = {
    lubu: { zh: '奉先弒天', en: 'Fengxian Ascendant' },
    guanyu: { zh: '武聖弒神', en: 'Saint Godslayer' },
    caocao: { zh: '魔王孟德', en: 'Demon Lord Mengde' },
    zhangliao: { zh: '文遠夜襲', en: 'Wenyuan Night Raid' },
    zhangjiao: { zh: '黃天業火', en: 'Yellow Heaven Inferno' },
    zhouyu: { zh: '臥龍幽冥', en: 'Nether Strategist' },
    sunquan: { zh: '江東霸業', en: 'Jiangdong Hegemony' },
    zhangfei: { zh: '萬人敵狂', en: 'Peerless Fury' },
    diaochan: { zh: '閉月傾城', en: 'Moonveil Enchantress' },
    liubei: { zh: '仁德昭烈', en: 'Benevolent Zhaolie' }
};

BrawlerConfig._isEn = function () {
    return !!(window.TKI18n && typeof window.TKI18n.getLang === 'function' && window.TKI18n.getLang() === 'en');
};

BrawlerConfig.getDisplayZh = function (bType) {
    var cfg = BrawlerConfig[bType];
    if (!cfg) return 'Unknown';
    if (cfg.displayZh) return cfg.displayZh;
    if (cfg.select && cfg.select.zh) return cfg.select.zh;
    return cfg.name || bType;
};

BrawlerConfig.isPlayable = function (bType) {
    var cfg = BrawlerConfig[bType];
    return !!(cfg && cfg.select && cfg.select.faction);
};

/** Character Pass 覆蓋的付費池（T1–T3）；T0 免費、Rogue 成就除外 */
BrawlerConfig.isCoveredByCharacterPass = function (bType) {
    var cfg = BrawlerConfig[bType];
    if (!cfg || !BrawlerConfig.isPlayable(bType)) return false;
    var t = cfg.unlockTier;
    return t === 1 || t === 2 || t === 3;
};

BrawlerConfig.getCharacterPassRoster = function () {
    var out = [];
    for (var key in BrawlerConfig) {
        if (!Object.prototype.hasOwnProperty.call(BrawlerConfig, key)) continue;
        if (typeof BrawlerConfig[key] !== 'object' || !BrawlerConfig[key]) continue;
        if (BrawlerConfig.isCoveredByCharacterPass(key)) out.push(key);
    }
    return out;
};

BrawlerConfig.getDisplayName = function (bType, options) {
    options = options || {};
    var cfg = BrawlerConfig[bType];
    if (!cfg) return 'Unknown';
    if (options.botArena && BrawlerConfig.botArenaNames && BrawlerConfig.botArenaNames[bType]) {
        return BrawlerConfig.botArenaNames[bType];
    }
    if (BrawlerConfig._isEn()) {
        if (cfg.displayEn) return cfg.displayEn;
        if (cfg.select && cfg.select.en) return cfg.select.en;
    }
    return BrawlerConfig.getDisplayZh(bType);
};

BrawlerConfig.getSelectTitle = function (bType) {
    var cfg = BrawlerConfig[bType];
    if (!cfg || !cfg.select) return '';
    if (BrawlerConfig._isEn() && cfg.select.titleEn) return cfg.select.titleEn;
    return cfg.select.title || '';
};

BrawlerConfig.getSelectRole = function (bType) {
    var cfg = BrawlerConfig[bType];
    if (!cfg || !cfg.select) return '';
    if (BrawlerConfig._isEn() && cfg.select.roleEn) return cfg.select.roleEn;
    return cfg.select.role || '';
};

BrawlerConfig.getDescription = function (bType, skinKey) {
    var cfg = BrawlerConfig[bType];
    if (!cfg) return '';
    var skin = skinKey ? BrawlerConfig.getSkinDef(skinKey) : null;
    if (skin) {
        if (BrawlerConfig._isEn() && skin.descriptionEn) return skin.descriptionEn;
        if (skin.description) return skin.description;
    }
    if (BrawlerConfig._isEn() && cfg.descriptionEn) return cfg.descriptionEn;
    return cfg.description || '';
};

BrawlerConfig.getAttackDesc = function (bType, skinKey) {
    var cfg = BrawlerConfig[bType];
    if (!cfg) return '';
    var skin = skinKey ? BrawlerConfig.getSkinDef(skinKey) : null;
    if (skin) {
        if (BrawlerConfig._isEn() && skin.attackDescEn) return skin.attackDescEn;
        if (skin.attackDesc) return skin.attackDesc;
    }
    if (BrawlerConfig._isEn() && cfg.attackDescEn) return cfg.attackDescEn;
    return cfg.attackDesc || '';
};

BrawlerConfig.getSuperDesc = function (bType, skinKey) {
    var cfg = BrawlerConfig[bType];
    if (!cfg) return '';
    var skin = skinKey ? BrawlerConfig.getSkinDef(skinKey) : null;
    if (skin) {
        if (BrawlerConfig._isEn() && skin.superDescEn) return skin.superDescEn;
        if (skin.superDesc) return skin.superDesc;
        if (skin.super) {
            if (BrawlerConfig._isEn() && skin.super.descEn) return skin.super.descEn;
            if (skin.super.desc) return skin.super.desc;
        }
    }
    if (!cfg.super) return '';
    if (BrawlerConfig._isEn() && cfg.super.descEn) return cfg.super.descEn;
    return cfg.super.desc || '';
};

BrawlerConfig.SKU_ORIGIN_PASS = 'origin_pass';

BrawlerConfig.findSkinEntry = function (skinKey) {
    if (!skinKey) return null;
    for (var bType in BrawlerConfig) {
        if (!Object.prototype.hasOwnProperty.call(BrawlerConfig, bType)) continue;
        var cfg = BrawlerConfig[bType];
        if (!cfg || !Array.isArray(cfg.skins)) continue;
        for (var i = 0; i < cfg.skins.length; i++) {
            var s = cfg.skins[i];
            if (typeof s === 'string' && s === skinKey) {
                return { brawlerType: bType, skin: { key: s } };
            }
            if (s && s.key === skinKey) return { brawlerType: bType, skin: s };
        }
    }
    return null;
};

BrawlerConfig.getSkinDef = function (skinKey) {
    var entry = BrawlerConfig.findSkinEntry(skinKey);
    return entry ? entry.skin : null;
};

BrawlerConfig.isSkinCoveredByOriginPass = function (skinKey) {
    return !!BrawlerConfig.findSkinEntry(skinKey);
};

BrawlerConfig._emptyAmmoPunchDefaults = {
    animTrigger: 'punch',
    bulletKey: 'punch_heavy',
    attackPattern: 'imelee',
    bulletHitRadius: 2.8,
    coneAngle: 180,
    bulletDamage: 50,
    bulletLifetime: 0.28,
    fireDelay: 0.12,
    shootCooldown: 0.38,
    hideWeaponProp: true,
    useTrail: false,
    knockbackDist: 0.85,
    textScaleMultiplier: 1.35,
};

BrawlerConfig.getEmptyAmmoPunchConf = function (brawlerType) {
    var cfg = brawlerType ? BrawlerConfig[brawlerType] : null;
    var perChar = (cfg && cfg.emptyAmmoPunch) ? cfg.emptyAmmoPunch : {};
    return Object.assign({}, BrawlerConfig._emptyAmmoPunchDefaults, perChar, {
        isEmptyAmmoFallback: true,
        isWordProc: true
    });
};

window.BrawlerConfig = BrawlerConfig;