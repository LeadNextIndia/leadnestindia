-- =====================================================================
-- Phase 4: Saved views (named filter presets, per user, per tenant)
--
-- HOW TO RUN
-- Supabase Dashboard → SQL Editor → paste this file → Run
-- =====================================================================


CREATE TABLE IF NOT EXISTS public.saved_views (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id)      ON DELETE CASCADE,
  name       text        NOT NULL,
  filter     jsonb       NOT NULL DEFAULT '{"conditions":[]}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saved_views_unique_name_per_user UNIQUE (tenant_id, user_id, name)
);

ALTER TABLE public.saved_views ENABLE ROW LEVEL SECURITY;

-- Owner can read/update/delete their own; superadmin sees all
DROP POLICY IF EXISTS sv_select ON public.saved_views;
CREATE POLICY sv_select ON public.saved_views FOR SELECT
  USING (
    public.is_superadmin(auth.uid())
    OR (user_id = auth.uid() AND public.tenant_role(auth.uid(), tenant_id) IS NOT NULL)
  );

DROP POLICY IF EXISTS sv_insert ON public.saved_views;
CREATE POLICY sv_insert ON public.saved_views FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND public.tenant_role(auth.uid(), tenant_id) IS NOT NULL
  );

DROP POLICY IF EXISTS sv_update ON public.saved_views;
CREATE POLICY sv_update ON public.saved_views FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS sv_delete ON public.saved_views;
CREATE POLICY sv_delete ON public.saved_views FOR DELETE
  USING (user_id = auth.uid() OR public.is_superadmin(auth.uid()));
