# Supabase — Character Pass entitlements

## Phase 1 setup

1. In Supabase **SQL Editor**, run [`migrations/001_player_entitlements.sql`](migrations/001_player_entitlements.sql).
2. (Optional) Deploy Edge Function:
   ```bash
   supabase functions deploy get-entitlements
   ```
   Client falls back to direct table read via RLS if the function is missing.
3. In PlayCanvas Editor, add script **`entitlementManager`** to the same root entity that has `authManager` / `progressionManager`.

## Manual test grant

```sql
insert into public.player_entitlements (user_id, sku, source)
values ('YOUR_AUTH_USER_UUID', 'character_pass', 'manual')
on conflict (user_id, sku) do nothing;
```

Then reload the game (or call `app.entitlementManager.refresh()`).

## Local DEV without DB

In browser console:

```js
app.entitlementManager.setDevOverride(true)   // pretend Pass owned
app.entitlementManager.setDevOverride(null)   // clear; re-fetch server
```
