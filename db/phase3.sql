-- =====================================================================
-- Phase 3: Field definitions, per-tenant feature flags
--
-- HOW TO RUN
-- Supabase Dashboard → SQL Editor → paste this file → Run
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Field definitions (custom fields per tenant)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.field_definitions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  key        text        NOT NULL,
  label      text        NOT NULL,
  type       text        NOT NULL DEFAULT 'text'
               CHECK (type IN ('text','number','email','tel','date','select','textarea')),
  required   boolean     NOT NULL DEFAULT false,
  options    jsonb,
  active     boolean     NOT NULL DEFAULT true,
  sort_order integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT field_definitions_tenant_key_key UNIQUE (tenant_id, key)
);

-- RLS
ALTER TABLE public.field_definitions ENABLE ROW LEVEL SECURITY;

-- Superadmins can do everything; tenant members can read
DROP POLICY IF EXISTS fd_select ON public.field_definitions;
CREATE POLICY fd_select ON public.field_definitions FOR SELECT
  USING (
    public.is_superadmin(auth.uid())
    OR public.tenant_role(auth.uid(), tenant_id) IS NOT NULL
  );

DROP POLICY IF EXISTS fd_all ON public.field_definitions;
CREATE POLICY fd_all ON public.field_definitions
  FOR ALL
  USING  (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));


-- ---------------------------------------------------------------------
-- 2. Per-tenant feature flags on the tenants table
--    Controls which sidebar pages are visible to company users/admins.
-- ---------------------------------------------------------------------
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS features jsonb NOT NULL
    DEFAULT '{"team":true,"export":true,"settings":false}';


-- ---------------------------------------------------------------------
-- 3. Backfill created_at on legacy tables
--    field_definitions and tenant_users may pre-date the current schema
--    (CREATE TABLE IF NOT EXISTS did not add missing columns).
-- ---------------------------------------------------------------------
ALTER TABLE public.field_definitions
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.tenant_users
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
