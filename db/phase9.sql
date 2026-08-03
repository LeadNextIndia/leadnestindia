-- =====================================================================
-- Phase 9: Configurable Lead Modules
--
-- Adds:
--   1. lead_modules      — one row per configurable module per tenant
--                          (e.g. "Lead", "Walk-in", "Online Inquiry")
--   2. module_fields     — per-module override of the tenant's field catalog
--                          (label override + visibility + ordering)
--   3. leads.module_key  — which module a lead belongs to (default 'lead')
--
-- Design notes:
--   - `field_definitions` remains the tenant-wide catalog. `module_fields`
--     controls per-module presentation. Absence of a (module, field) row
--     means the field is hidden for that module.
--   - `leads.module_key` is denormalised text (not FK) so deleting a module
--     doesn't cascade to leads. Callers reassign leads before deleting.
--   - Exactly one `is_default=true` module per tenant (partial unique index).
--   - The `multi_modules` feature flag lives inside tenants.features JSONB,
--     merged with defaults in lib/features.ts — no schema change here.
--
-- HOW TO RUN
-- 1. Supabase Dashboard → SQL Editor → New query
-- 2. Paste this file → Run
-- 3. Verify: `SELECT slug, is_default FROM lead_modules;` — every tenant
--    should have exactly one row with slug='lead' and is_default=true.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. lead_modules
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_modules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  slug        text NOT NULL,
  singular    text NOT NULL,
  plural      text NOT NULL,
  icon        text,
  sort_order  integer NOT NULL DEFAULT 0,
  is_default  boolean NOT NULL DEFAULT false,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_modules_slug_check
    CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT lead_modules_tenant_slug_key UNIQUE (tenant_id, slug)
);

-- Exactly one default module per tenant.
CREATE UNIQUE INDEX IF NOT EXISTS lead_modules_one_default_per_tenant
  ON public.lead_modules (tenant_id) WHERE is_default;

CREATE INDEX IF NOT EXISTS lead_modules_tenant_active_idx
  ON public.lead_modules (tenant_id, active, sort_order);


-- ---------------------------------------------------------------------
-- 2. module_fields
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.module_fields (
  module_id          uuid NOT NULL REFERENCES public.lead_modules(id) ON DELETE CASCADE,
  field_id           uuid NOT NULL REFERENCES public.field_definitions(id) ON DELETE CASCADE,
  label_override     text,
  required_override  boolean,
  sort_order         integer NOT NULL DEFAULT 0,
  visible            boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (module_id, field_id)
);

CREATE INDEX IF NOT EXISTS module_fields_module_idx
  ON public.module_fields (module_id, sort_order);


-- ---------------------------------------------------------------------
-- 3. leads.module_key
-- ---------------------------------------------------------------------
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS module_key text NOT NULL DEFAULT 'lead';

CREATE INDEX IF NOT EXISTS leads_tenant_module_created_idx
  ON public.leads (tenant_id, module_key, created_at DESC);


-- ---------------------------------------------------------------------
-- 4. Backfill: create the default "lead" module for every tenant
-- ---------------------------------------------------------------------
INSERT INTO public.lead_modules (tenant_id, slug, singular, plural, is_default, sort_order)
SELECT id, 'lead', 'Lead', 'Leads', true, 0
FROM public.tenants
ON CONFLICT (tenant_id, slug) DO NOTHING;


-- ---------------------------------------------------------------------
-- 5. Backfill: attach every active field_definition to that default module
--    Copies sort_order; leaves label_override / required_override NULL so
--    the module inherits current labels + required flags.
-- ---------------------------------------------------------------------
INSERT INTO public.module_fields (module_id, field_id, sort_order, visible)
SELECT m.id, f.id, COALESCE(f.sort_order, 0), COALESCE(f.active, true)
FROM public.lead_modules m
JOIN public.field_definitions f ON f.tenant_id = m.tenant_id
WHERE m.is_default
ON CONFLICT (module_id, field_id) DO NOTHING;


-- ---------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------
ALTER TABLE public.lead_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lm_select ON public.lead_modules;
CREATE POLICY lm_select ON public.lead_modules FOR SELECT
  USING (
    public.is_superadmin(auth.uid())
    OR public.tenant_role(auth.uid(), tenant_id) IS NOT NULL
  );

DROP POLICY IF EXISTS lm_write_admin ON public.lead_modules;
CREATE POLICY lm_write_admin ON public.lead_modules
  FOR ALL
  USING (
    public.is_superadmin(auth.uid())
    OR public.tenant_role(auth.uid(), tenant_id) = 'admin'
  )
  WITH CHECK (
    public.is_superadmin(auth.uid())
    OR public.tenant_role(auth.uid(), tenant_id) = 'admin'
  );

ALTER TABLE public.module_fields ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mf_select ON public.module_fields;
CREATE POLICY mf_select ON public.module_fields FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.lead_modules lm
       WHERE lm.id = module_fields.module_id
         AND (
           public.is_superadmin(auth.uid())
           OR public.tenant_role(auth.uid(), lm.tenant_id) IS NOT NULL
         )
    )
  );

DROP POLICY IF EXISTS mf_write_admin ON public.module_fields;
CREATE POLICY mf_write_admin ON public.module_fields
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.lead_modules lm
       WHERE lm.id = module_fields.module_id
         AND (
           public.is_superadmin(auth.uid())
           OR public.tenant_role(auth.uid(), lm.tenant_id) = 'admin'
         )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lead_modules lm
       WHERE lm.id = module_fields.module_id
         AND (
           public.is_superadmin(auth.uid())
           OR public.tenant_role(auth.uid(), lm.tenant_id) = 'admin'
         )
    )
  );
