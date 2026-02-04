-- Allow jm@marziale.tech as admin (in addition to ravensquill_admins table)
CREATE OR REPLACE FUNCTION public.ravensquill_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.ravensquill_admins WHERE user_id = auth.uid())
     OR (SELECT email FROM auth.users WHERE id = auth.uid()) = 'jm@marziale.tech';
$$;

-- Update events policy to use the function (so owner email is included)
DROP POLICY IF EXISTS "Admins manage events" ON public.ravensquill_events;
CREATE POLICY "Admins manage events"
  ON public.ravensquill_events FOR ALL
  TO authenticated
  USING (public.ravensquill_is_admin())
  WITH CHECK (public.ravensquill_is_admin());
