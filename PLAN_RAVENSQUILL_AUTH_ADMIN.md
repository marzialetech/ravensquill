# Plan: Ravensquill Auth + Admin Events

## Overview

Enable cross-domain auth (marziale.tech ↔ ravensquill.marziale.tech) using existing Supabase project `qvrrlfzogtuahmvsbvmu`, and add an admin-only Events management UI for designated Raven's Quill admins.

---

## Context (from marzialetech.github.io)

| Item | Value |
|------|-------|
| Supabase project | `qvrrlfzogtuahmvsbvmu` (marziale-unified) |
| Auth method | GitHub OAuth |
| Admin check (projects) | Hardcoded `ADMIN_EMAIL = 'jm@marziale.tech'` in auth-guard.js |
| Redirect URLs | `https://marziale.tech`, `https://marziale.tech/**` |
| Session storage | Supabase default (localStorage) — **origin-specific** |

**Cross-subdomain challenge:** `marziale.tech` and `ravensquill.marziale.tech` are different origins. localStorage is not shared. We need cookie-based auth with `domain=.marziale.tech` for session sharing.

---

## Open Questions (please answer)

### Auth & Supabase

1. **Supabase redirect URLs**  
   Should we add `https://ravensquill.marziale.tech` and `https://ravensquill.marziale.tech/**` to Supabase Auth → URL Configuration → Redirect URLs?

2. **Account creation**  
   Users create accounts at marziale.tech (GitHub OAuth). Is that the only sign-up path, or should ravensquill also offer a "Log in" that redirects to marziale.tech for first-time users?

3. **Session sharing**  
   Supabase supports `persistSessionInCookie: true` with a custom storage key. For cross-subdomain, we need cookies with `domain=.marziale.tech`. Confirm: both sites will use the same Supabase project and anon key?

### Admin designation

4. **Who are Raven's Quill admins?**  
   - Only Gene & Jeri (by email)?  
   - Or a configurable list (e.g. Supabase table `ravensquill_admins`)?

5. **First admin setup**  
   How should the first admin(s) be added? Options:  
   - A) SQL in Supabase: `INSERT INTO ravensquill_admins (user_id, email) VALUES (...)`  
   - B) Hardcoded emails in ravensquill (like auth-guard.js)  
   - C) You add them manually in Supabase Dashboard

6. **Admin emails**  
   If using a table, do you have the emails for Gene & Jeri to seed? If hardcoding, please provide them.

### Events page content

7. **Existing Crochet poster**  
   Should the current Learn to Crochet image become the first "post" in the new feed, or remain a separate hero/banner above the feed?

8. **Post ordering**  
   Newest first or oldest first?

9. **Edit/delete**  
   Can admins edit and delete posts, or only add new ones?

10. **Post structure**  
    - Text (required) + 0–4 images (optional)?  
    - Any other fields: title, event date, location, link?

11. **Image storage**  
    - Supabase Storage bucket (e.g. `ravensquill-events`)?  
    - Max file size per image? (e.g. 2MB)

### UI/UX

12. **Admin UI location**  
   When an admin opens Events:  
   - A) See public feed + "Add post" / "Manage" button  
   - B) Toggle between "View" and "Edit" modes  
   - C) Separate "Manage Events" entry in the nav

13. **Login placement on Ravensquill**  
   "Near top right" — prefer:  
   - A) In the header bar (next to logo)  
   - B) In the store status area  
   - C) Floating button (like marziale.tech Login)

14. **Logged-out view**  
   Events page looks the same for everyone; only admins see management controls. Correct?

### Technical

15. **Ravensquill hosting**  
   Where is ravensquill.marziale.tech hosted? (e.g. GitHub Pages, Cloudflare Pages, Netlify) — affects CORS and cookie config.

16. **Ravensquill structure**  
   Is it still a single `index.html` with inline JS, or has it been split? (Affects where we add Supabase client.)

---

## Proposed Architecture (pending your answers)

### Phase 1: Cross-domain auth

1. Add ravensquill URLs to Supabase redirect URLs.
2. Initialize Supabase client on ravensquill with `persistSessionInCookie: true` and `cookieOptions: { domain: '.marziale.tech' }` (if supported).
3. Add login/logout UI near top-right of ravensquill.
4. On load: `getSession()` — if valid, user is logged in; if not, show "Log in" (links to marziale.tech or triggers OAuth with `redirectTo: current URL`).

### Phase 2: Admin designation

1. Create `ravensquill_admins` table: `(id, user_id UUID, email, created_at)`.
2. RLS: only admins can read; only you (or a super-admin) can insert/delete.
3. On ravensquill: after auth, check `user_id IN (SELECT user_id FROM ravensquill_admins)` → show admin UI if true.

### Phase 3: Events admin UI

1. Create `ravensquill_events` table: `(id, body_text, created_at, updated_at, created_by)`.
2. Create `ravensquill_event_images` table: `(id, event_id, url, sort_order)` — URLs point to Supabase Storage.
3. Storage bucket `ravensquill-events` with RLS: public read, authenticated admin write.
4. Events window: fetch posts, render as feed. If admin: show "Add post" form (text + up to 4 image uploads).

---

## Next steps

1. You answer the questions above.
2. We finalize the architecture and table schemas.
3. We implement Phase 1 (auth), then Phase 2 (admin check), then Phase 3 (Events CRUD).
