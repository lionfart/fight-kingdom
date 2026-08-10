-- =============================================================================
-- Fight Kingdom — Supabase şema (tümü tek dosya)
-- Yeni (boş) Supabase projesinde SQL Editor'da çalıştırın.
-- Kapsar: player_saves, player_entitlements, rogue_build_shares, promo_codes
--         + RPC: get_rogue_global_best, get_rogue_leaderboard, redeem_promo_code
-- =============================================================================

-- ─────────────────────────────────────────────────────────────
-- 1) player_saves — bulut kayıt (cloudSaveManager)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.player_saves (
    user_id uuid primary key references auth.users (id) on delete cascade,
    display_name text not null default '',
    save_data jsonb not null default '{}'::jsonb,
    save_version int not null default 1,
    rogue_best_wave int not null default 0,
    rogue_best_brawler text,
    rogue_best_at timestamptz,
    updated_at timestamptz not null default now()
);

alter table public.player_saves enable row level security;

drop policy if exists "player_saves_select_own" on public.player_saves;
create policy "player_saves_select_own"
    on public.player_saves for select
    to authenticated
    using (auth.uid() = user_id);

drop policy if exists "player_saves_insert_own" on public.player_saves;
create policy "player_saves_insert_own"
    on public.player_saves for insert
    to authenticated
    with check (auth.uid() = user_id);

drop policy if exists "player_saves_update_own" on public.player_saves;
create policy "player_saves_update_own"
    on public.player_saves for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- upsert(onConflict: user_id) için güncellemede updated_at tazele
create or replace function public.touch_player_save()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists player_saves_touch on public.player_saves;
create trigger player_saves_touch
    before update on public.player_saves
    for each row execute function public.touch_player_save();

-- ─────────────────────────────────────────────────────────────
-- 2) player_entitlements — satın alma hakları (ileride Stripe)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.player_entitlements (
    user_id uuid not null references auth.users (id) on delete cascade,
    sku text not null,
    source text,
    stripe_session_id text,
    granted_at timestamptz not null default now(),
    primary key (user_id, sku)
);

create unique index if not exists player_entitlements_stripe_session_id_key
    on public.player_entitlements (stripe_session_id)
    where stripe_session_id is not null;

alter table public.player_entitlements enable row level security;

drop policy if exists "Users can read own entitlements" on public.player_entitlements;
create policy "Users can read own entitlements"
    on public.player_entitlements
    for select
    to authenticated
    using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- 3) rogue_build_shares — Rogue yapı paylaşımı + kısa kod
-- ─────────────────────────────────────────────────────────────
create table if not exists public.rogue_build_shares (
    id uuid primary key default gen_random_uuid(),
    short_code text not null unique,
    user_id uuid references auth.users (id) on delete set null,
    display_name text,
    snapshot jsonb not null,
    wave int not null default 0,
    brawler text,
    endless boolean not null default false,
    created_at timestamptz not null default now()
);

create index if not exists rogue_build_shares_wave_idx
    on public.rogue_build_shares (wave desc, created_at desc);

alter table public.rogue_build_shares enable row level security;

drop policy if exists "rogue_build_shares_select_public" on public.rogue_build_shares;
create policy "rogue_build_shares_select_public"
    on public.rogue_build_shares for select
    using (true);

drop policy if exists "rogue_build_shares_insert_own" on public.rogue_build_shares;
create policy "rogue_build_shares_insert_own"
    on public.rogue_build_shares for insert
    with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- 4) promo_codes — tek kullanımlık kodlar
-- ─────────────────────────────────────────────────────────────
create table if not exists public.promo_codes (
    code text primary key,
    sku text not null default 'character_pass',
    redeemed_by uuid references auth.users (id) on delete set null,
    redeemed_at timestamptz,
    expires_at timestamptz,
    note text,
    created_at timestamptz not null default now()
);

create index if not exists promo_codes_unredeemed_idx
    on public.promo_codes (created_at desc)
    where redeemed_by is null;

alter table public.promo_codes enable row level security;

-- ─────────────────────────────────────────────────────────────
-- 5) RPC: get_rogue_global_best — tüm sunucunun en iyi Rogue dalgası
--    (cloudSaveManager.fetchGlobalRogueBest tarafından çağrılır)
-- ─────────────────────────────────────────────────────────────
create or replace function public.get_rogue_global_best()
returns table (
    display_name text,
    rogue_best_wave int,
    rogue_best_brawler text,
    rogue_best_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
    select ps.display_name, ps.rogue_best_wave, ps.rogue_best_brawler, ps.rogue_best_at
    from public.player_saves ps
    where ps.rogue_best_wave > 0
    order by ps.rogue_best_wave desc, ps.rogue_best_at asc nulls last
    limit 1;
$$;

revoke all on function public.get_rogue_global_best() from public;
grant execute on function public.get_rogue_global_best() to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 6) RPC: get_rogue_leaderboard — sıralama (build kodlarıyla)
-- ─────────────────────────────────────────────────────────────
create or replace function public.get_rogue_leaderboard(row_limit int default 10)
returns table (
    display_name text,
    rogue_best_wave int,
    rogue_best_brawler text,
    rogue_best_at timestamptz,
    build_short_code text
)
language sql
stable
security definer
set search_path = public
as $$
    select
        ps.display_name,
        ps.rogue_best_wave,
        ps.rogue_best_brawler,
        ps.rogue_best_at,
        (
            select rbs.short_code
            from public.rogue_build_shares rbs
            where rbs.user_id = ps.user_id
              and rbs.wave = ps.rogue_best_wave
            order by rbs.created_at desc
            limit 1
        ) as build_short_code
    from public.player_saves ps
    where ps.rogue_best_wave > 0
    order by ps.rogue_best_wave desc, ps.rogue_best_at asc nulls last
    limit greatest(1, least(coalesce(row_limit, 10), 50));
$$;

revoke all on function public.get_rogue_leaderboard(int) from public;
grant execute on function public.get_rogue_leaderboard(int) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 7) RPC: redeem_promo_code — kod kullanımı (service-role)
-- ─────────────────────────────────────────────────────────────
create or replace function public.redeem_promo_code(p_code text, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_code text;
    v_row public.promo_codes%rowtype;
    v_owned boolean;
begin
    v_code := upper(trim(coalesce(p_code, '')));
    if length(v_code) < 4 then
        return jsonb_build_object('success', false, 'error', 'invalid_code');
    end if;

    select * into v_row
    from public.promo_codes
    where code = v_code
    for update;

    if not found then
        return jsonb_build_object('success', false, 'error', 'invalid_code');
    end if;

    if v_row.redeemed_by is not null then
        return jsonb_build_object('success', false, 'error', 'already_redeemed');
    end if;

    if v_row.expires_at is not null and v_row.expires_at < now() then
        return jsonb_build_object('success', false, 'error', 'expired');
    end if;

    select exists (
        select 1 from public.player_entitlements
        where user_id = p_user_id and sku = v_row.sku
    ) into v_owned;

    if v_owned then
        return jsonb_build_object('success', false, 'error', 'already_owned');
    end if;

    update public.promo_codes
    set redeemed_by = p_user_id,
        redeemed_at = now()
    where code = v_code;

    insert into public.player_entitlements (user_id, sku, source)
    values (p_user_id, v_row.sku, 'promo_code')
    on conflict (user_id, sku) do nothing;

    return jsonb_build_object(
        'success', true,
        'sku', v_row.sku,
        'characterPass', v_row.sku = 'character_pass'
    );
end;
$$;

revoke all on function public.redeem_promo_code(text, uuid) from public;
grant execute on function public.redeem_promo_code(text, uuid) to service_role;

-- ─────────────────────────────────────────────────────────────
-- 8) Google OAuth: Auth → Settings → Providers → Google  aktifleştirin
--    ve "Redirect URLs" alanına oyun adresinizi ekleyin.
-- ─────────────────────────────────────────────────────────────
