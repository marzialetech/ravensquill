-- Add Gene and Jeri as Raven's Quill admins (run in Supabase SQL Editor after they create accounts)
-- Gene: (315) 681-0244 → +13156810244
-- Jeri: (315) 222-8603 → +13152228603
--
-- OR create accounts first: cd scripts && npm install && SUPABASE_SERVICE_ROLE_KEY=xxx node create-gene-jeri-accounts.js

INSERT INTO public.ravensquill_admins (user_id)
SELECT id FROM auth.users WHERE phone = '+13156810244'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.ravensquill_admins (user_id)
SELECT id FROM auth.users WHERE phone = '+13152228603'
ON CONFLICT (user_id) DO NOTHING;
