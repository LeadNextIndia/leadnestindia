-- =====================================================================
-- Phase 10: Configurable statuses per module
--
-- Replaces the hardcoded ('new','contacted','qualified','won','lost')
-- CHECK constraint on `leads.status` with a metadata-driven per-module
-- status list. This is the foundation for Phase 11 (workflows).
--
-- Design:
--   - Each lead_module gets a list of statuses (key, label, color, order,
--     is_default, is_terminal). Exactly one default per module — new
--     records land in that status.
--   - `leads.status` stays as free-text at the DB layer; validation now
--     happens application-side against the module's status list. Dropping
--     the CHECK constraint means we can now support arbitrary tenant-
--     defined states without DDL.
--   - Backfill: the default 'lead' module for every tenant gets the five
--     legacy statuses seeded, preserving current UX exactly.
--
-- HOW TO RUN
-- 1. Supabase Dashboard → SQL Editor → New query
-- 2. Paste this file → Run
-- 3. Verify: `SELECT module_id, key, label FROM module_statuses;`
--    Every phase9-migrated tenant should have 5 rows for its default module.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. module_statuses
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.module_statuses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id    uuid NOT NULL REFERENCES public.lead_modules(id) ON DELETE CASCADE,
  key          text NOT NULL,
  label        text NOT NULL,
  color        text NOT NULL DEFAULT 'gray',
  sort_order   integer NOT NULL DEFAULT 0,
  is_default   boolean NOT NULL DEFAULT false,
  is_terminal  boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT module_statuses_key_check
    CHECK (key ~ '^[a-z0-9]+(_[a-z0-9]+)*$'),
  CONSTRAINT module_statuses_color_check
    CHECK (color IN ('gray','blue','indigo','amber','green','red','purple','pink','teal')),
  CONSTRAINT module_statuses_module_key_key UNIQUE (module_id, key)
);

-- Exactly one default status per module.
CREATE UNIQUE INDEX IF NOT EXISTS module_statuses_one_default_per_module
  ON public.module_statuses (module_id) WHERE is_default;

CREATE INDEX IF NOT EXISTS module_statuses_module_sort_idx
  ON public.module_statuses (module_id, sort_order);


-- ---------------------------------------------------------------------
-- 2. Drop the hardcoded CHECK constraint on leads.status
--    (Phase 1 pinned the enum in SQL; we now validate app-side.)
-- ---------------------------------------------------------------------
ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_status_check;


-- ---------------------------------------------------------------------
-- 3. Backfill: seed the five legacy statuses on every tenant's default module
-- ---------------------------------------------------------------------
WITH default_modules AS (
  SELECT id AS module_id FROM public.lead_modules WHERE is_default
)
INSERT INTO public.module_statuses (module_id, key, label, color, sort_order, is_default, is_terminal)
SELECT dm.module_id, s.key, s.label, s.color, s.sort_order, s.is_default, s.is_terminal
FROM default_modules dm
CROSS JOIN (VALUES
  ('new',        'New',        'blue',   0, true,  false),
  ('contacted',  'Contacted',  'amber',  1, false, false),
  ('qualified',  'Qualified',  'indigo', 2, false, false),
  ('won',        'Won',        'green',  3, false, true),
  ('lost',       'Lost',       'red',    4, false, true)
) AS s(key, label, color, sort_order, is_default, is_terminal)
ON CONFLICT (module_id, key) DO NOTHING;


-- ---------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------
ALTER TABLE public.module_statuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ms_select ON public.module_statuses;
CREATE POLICY ms_select ON public.module_statuses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.lead_modules lm
       WHERE lm.id = module_statuses.module_id
         AND (
           public.is_superadmin(auth.uid())
           OR public.tenant_role(auth.uid(), lm.tenant_id) IS NOT NULL
         )
    )
  );

-- Writes are superadmin-only (matching the module_fields policy shape).
DROP POLICY IF EXISTS ms_write_superadmin ON public.module_statuses;
CREATE POLICY ms_write_superadmin ON public.module_statuses
  FOR ALL
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));
