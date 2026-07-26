-- =====================================================================
-- Phase 5: Assignment, follow-ups, activity timeline
--
-- HOW TO RUN: Supabase Dashboard → SQL Editor → paste → Run.
-- Safe to re-run (idempotent).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Assignment + follow-up columns on leads
-- ---------------------------------------------------------------------
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS assigned_to  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS follow_up_at timestamptz;

CREATE INDEX IF NOT EXISTS leads_assigned_to_idx  ON public.leads (assigned_to);
CREATE INDEX IF NOT EXISTS leads_follow_up_at_idx ON public.leads (follow_up_at);


-- ---------------------------------------------------------------------
-- 2. Activity timeline (notes + auto-logged events)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_activity (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lead_id    uuid        NOT NULL REFERENCES public.leads(id)   ON DELETE CASCADE,
  user_id    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  kind       text        NOT NULL
               CHECK (kind IN ('note','status_change','assigned','follow_up_set','edited','created')),
  body       text,
  metadata   jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_activity_lead_idx
  ON public.lead_activity (lead_id, created_at DESC);

ALTER TABLE public.lead_activity ENABLE ROW LEVEL SECURITY;

-- SELECT: any tenant member can read activity for their tenant
DROP POLICY IF EXISTS la_select ON public.lead_activity;
CREATE POLICY la_select ON public.lead_activity FOR SELECT
  USING (
    public.is_superadmin(auth.uid())
    OR public.tenant_role(auth.uid(), tenant_id) IS NOT NULL
  );

-- INSERT: any tenant member can add a note (server enforces the note kind)
DROP POLICY IF EXISTS la_insert ON public.lead_activity;
CREATE POLICY la_insert ON public.lead_activity FOR INSERT
  WITH CHECK (
    public.is_superadmin(auth.uid())
    OR public.tenant_role(auth.uid(), tenant_id) IS NOT NULL
  );

-- DELETE: authors delete their own notes; admins delete any activity in their tenant
DROP POLICY IF EXISTS la_delete ON public.lead_activity;
CREATE POLICY la_delete ON public.lead_activity FOR DELETE
  USING (
    public.is_superadmin(auth.uid())
    OR user_id = auth.uid()
    OR public.tenant_role(auth.uid(), tenant_id) = 'admin'
  );
