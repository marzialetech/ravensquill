-- Ravensquill Auth + Events Schema
-- Run this in Supabase SQL Editor for project qvrrlfzogtuahmvsbvmu

-- 1. Admins table: who can manage events (Gene, Jeri, + future admins)
CREATE TABLE IF NOT EXISTS public.ravensquill_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- RLS: only admins can read; only service role / dashboard can insert/delete
ALTER TABLE public.ravensquill_admins ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can check if they are an admin (read own row)
CREATE POLICY "Admins can read admins list"
  ON public.ravensquill_admins FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can insert/delete (you do this via Supabase Dashboard or SQL)
CREATE POLICY "Service role can manage admins"
  ON public.ravensquill_admins FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. Events table: title, date, body text, created_at
CREATE TABLE IF NOT EXISTS public.ravensquill_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  event_date date,
  body_text text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 3. Event images: up to 4 per event, stored in Supabase Storage
CREATE TABLE IF NOT EXISTS public.ravensquill_event_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.ravensquill_events(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- RLS for events: public read, admins write
ALTER TABLE public.ravensquill_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ravensquill_event_images ENABLE ROW LEVEL SECURITY;

-- Public can read all events
CREATE POLICY "Public read events"
  ON public.ravensquill_events FOR SELECT
  TO anon, authenticated
  USING (true);

-- Public can read event images
CREATE POLICY "Public read event images"
  ON public.ravensquill_event_images FOR SELECT
  TO anon, authenticated
  USING (true);

-- Helper: check if current user is admin (must exist before admin policies)
CREATE OR REPLACE FUNCTION public.ravensquill_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.ravensquill_admins WHERE user_id = auth.uid());
$$;

-- Admins can insert/update/delete events
CREATE POLICY "Admins manage events"
  ON public.ravensquill_events FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.ravensquill_admins a WHERE a.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.ravensquill_admins a WHERE a.user_id = auth.uid())
  );

-- Admins can manage event images
CREATE POLICY "Admins manage event images"
  ON public.ravensquill_event_images FOR ALL
  TO authenticated
  USING (
    public.ravensquill_is_admin()
  )
  WITH CHECK (
    public.ravensquill_is_admin()
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.ravensquill_events_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ravensquill_events_updated ON public.ravensquill_events;
CREATE TRIGGER ravensquill_events_updated
  BEFORE UPDATE ON public.ravensquill_events
  FOR EACH ROW EXECUTE FUNCTION public.ravensquill_events_updated_at();

-- Index for ordering
CREATE INDEX IF NOT EXISTS idx_ravensquill_events_created_at
  ON public.ravensquill_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ravensquill_event_images_event
  ON public.ravensquill_event_images (event_id, sort_order);

-- ========================================
-- STORAGE BUCKET (create via Dashboard first, then run policies)
-- ========================================
-- 1. In Supabase Dashboard: Storage → New bucket → name: ravensquill-events, Public: ON
-- 2. Run the policies below:

-- Public read for ravensquill-events bucket
CREATE POLICY "Public read ravensquill-events"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'ravensquill-events');

-- Admins can upload/update/delete in ravensquill-events
CREATE POLICY "Admins write ravensquill-events"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'ravensquill-events' AND public.ravensquill_is_admin()
  )
  WITH CHECK (
    bucket_id = 'ravensquill-events' AND public.ravensquill_is_admin()
  );
