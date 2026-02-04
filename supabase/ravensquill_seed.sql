-- Seed first event: Learn to Crochet
-- Run AFTER: 1) ravensquill_schema.sql, 2) Creating storage bucket, 3) Uploading events-crochet.png
--
-- Steps:
-- 1. In Supabase Dashboard → Storage → ravensquill-events bucket
-- 2. Upload assets/events-crochet.png as "crochet-poster.png" (root of bucket)
-- 3. Run the INSERT below

-- Only seed if no events exist yet
INSERT INTO public.ravensquill_events (title, event_date, body_text)
SELECT 'Learn to Crochet', '2026-02-15', 'Join us for a beginner-friendly crochet workshop at The Raven''s Quill. All materials provided. Space is limited!'
WHERE NOT EXISTS (SELECT 1 FROM public.ravensquill_events LIMIT 1);

INSERT INTO public.ravensquill_event_images (event_id, storage_path, sort_order)
SELECT e.id, 'crochet-poster.png', 0
FROM public.ravensquill_events e
WHERE e.title = 'Learn to Crochet'
  AND NOT EXISTS (SELECT 1 FROM public.ravensquill_event_images WHERE event_id = e.id)
ORDER BY e.created_at DESC
LIMIT 1;
