-- Add Gene and Jeri as Raven's Quill admins (Supabase stores phone in E.164: +13156810244, +13152228603)
-- Gene: (315) 681-0244
-- Jeri: (315) 222-8603
-- Run after they create accounts at marziale.tech; if they haven't yet, 0 rows inserted (no error)

INSERT INTO public.ravensquill_admins (user_id)
SELECT id FROM auth.users WHERE phone = '+13156810244'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.ravensquill_admins (user_id)
SELECT id FROM auth.users WHERE phone = '+13152228603'
ON CONFLICT (user_id) DO NOTHING;
