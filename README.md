# Fight Kingdom

PlayCanvas tabanlı 3D brawl oyunu (Tap Kingdom fork'u, rebrand edildi). Kendi Socket.IO multiplayer sunucusu ve Supabase backend'i ile bağımsız çalışır.

## Mimari

| Parça | Teknoloji | Adres |
|---|---|---|
| Client | PlayCanvas 2.21 + Vite | `npm run dev` → http://localhost:5173 |
| Multiplayer sunucusu | Node.js + Socket.IO | https://fight-kingdom-server.onrender.com |
| Backend / Auth / Kayıt | Supabase | https://byhyaxlxxlvuliytwxdf.supabase.co |

## Yerel geliştirme

```bash
npm install
npm run dev        # client
cd server && npm install && npm start   # multiplayer sunucusu (isteğe bağlı, Render'da da var)
```

## Deploy

### 1. Multiplayer sunucusu (Render) — tamamlandı

- Repo: https://github.com/lionfart/fight-kingdom (public, `main` dalı)
- Servis: `fight-kingdom-server` (https://fight-kingdom-server.onrender.com)
- `rootDir: server`, `npm install` + `npm start`, health check `/health`
- `server/` altındaki her push otomatik deploy tetikler (autoDeploy)

### 2. Client (öneri: Netlify / Cloudflare Pages / Vercel)

Statik host yeterli — `npm run build` çıktısı `dist/` klasörüdür.

Önerilen (Netlify):

```bash
npm run build
npx netlify deploy --prod --dir=dist
```

### 3. Supabase — tamamlandı

- Proje: `byhyaxlxxlvuliytwxdf` (region: eu-central-1)
- Şema: `supabase/migrations/001_fight_kingdom_schema.sql` (uygulandı)
- Tablolar: `player_saves`, `player_entitlements`, `rogue_build_shares`, `promo_codes`
- RPC: `get_rogue_global_best`, `get_rogue_leaderboard`, `redeem_promo_code` (yalnızca service_role)
- Email auth aktif; `SITE_URL` = http://localhost:5173, allow list: localhost:5173 + Render URL

Client tarafında kullanılan kimlikler (`src/data/scenes/untitled.json`, `src/data/config.json`, `src/scripts/authManager.js`):

```
supabaseUrl: https://byhyaxlxxlvuliytwxdf.supabase.co
publishableKey: sb_publishable_TiKgo9DtxArClELK348LJQ_-zNf5Flp
serverUrl: https://fight-kingdom-server.onrender.com
```

> Not: publishable key herkese açık olabilir (anon rolü). Gizli anahtarları (service_role, `sbp_...`) asla client'a koymayın.

## Oyun içi değişiklikler

- Stripe satın alma (`startCheckout`) devre dışı — coins-only mod
- GameAnalytics default kapalı
- PlayCanvas publish/playcanv.as bağımlılıkları kaldırıldı
- Rebrand: "Fight Kingdom" (locale, hub, loading logo, manifest, DOM id'leri)
- localStorage: `fk_progression_v2` (eski `3cb_progression_v2` otomatik taşınır), `fk_camera_mode`, `fk_tutorial_done`, `fk_player_name`, `fk_entitlement_hint_v1`

## Lisans

Orijinal oyun `[Wontfixit]` tarafından CC BY-NC 4.0 ile lisanslanmıştır — ticari kullanım için hak devri gerekir. Detay: `src/scripts/LICENSE.js`.
