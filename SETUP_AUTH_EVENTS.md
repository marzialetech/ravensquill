# Ravensquill Auth + Events Setup

## 1. Supabase Dashboard (project `qvrrlfzogtuahmvsbvmu`)

### Auth → URL Configuration → Redirect URLs
Add:
- `https://ravensquill.marziale.tech`
- `https://ravensquill.marziale.tech/**`

### SQL Editor
Run the contents of `supabase/ravensquill_schema.sql`.

### Storage
1. Go to **Storage** → **New bucket**
2. Name: `ravensquill-events`
3. **Public bucket**: ON (so event images are publicly readable)
4. Create

The storage policies are in the schema SQL (they reference `storage.objects`).

## 2. Add Admins

After Gene and Jeri create accounts (see step 4), add them as admins. In Supabase SQL Editor:

```sql
-- Get their user_id from Authentication → Users (after they sign up)
INSERT INTO public.ravensquill_admins (user_id)
VALUES ('USER_UUID_HERE');
```

Repeat for each admin.

## 3. Seed First Event (Learn to Crochet)

1. In **Storage** → `ravensquill-events`, upload `assets/events-crochet.png` as `crochet-poster.png` (or any path).
2. Run the seed SQL from `supabase/ravensquill_seed.sql` (adjust the `storage_path` if you used a different filename).

## 4. Phone Auth for Gene & Jeri (at marziale.tech)

To let Gene and Jeri create accounts via phone:

1. **Supabase** → **Authentication** → **Providers** → enable **Phone**
2. Configure an SMS provider (Twilio, MessageBird, Vonage, or TextLocal) in the Phone provider settings
3. The login window on marziale.tech now has both GitHub and phone options; no separate page needed

Once they sign up, they’ll appear in **Authentication** → **Users**. Use their `id` (UUID) in the `INSERT` from step 2.

**Alternative:** If you skip phone auth, they can use **GitHub OAuth** (already enabled).

## 5. Cross-Domain Session (marziale.tech ↔ ravensquill)

By default, Supabase uses `localStorage`, which is origin-specific. Logging in at marziale.tech does not automatically log them in at ravensquill.marziale.tech.

**Current behavior:** Users log in separately on each site. The same Supabase account works on both; they just need to log in once per site (or per browser session).

**Future improvement:** To share sessions across subdomains, both sites would need to use cookie-based storage with `domain=.marziale.tech`. That requires custom storage adapters and may hit cookie size limits. For now, separate logins are acceptable.

## 6. Storage Limits (Free Tier)

- **1 GB** storage
- **10 GB** bandwidth/month

~50 posts with a few images each should fit. The app auto-deletes the oldest posts when the total exceeds 50.
