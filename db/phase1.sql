-- =====================================================================
-- Phase 1: Baseline schema
--
-- Creates the base tables that Phase 2 (roles + RLS) later alters.
-- Idempotent — safe to run on both fresh and existing databases.
--
-- HOW TO RUN (on a fresh Supabase project — e.g. staging):
-- 1. Supabase Dashboard → SQL Editor → New query
-- 2. Paste this entire file → Run
-- 3. Then run db/phase2.sql, phase3.sql, phase4.sql, phase5.sql, phase6.sql
--    in order.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. tenants — customer companies
--    (Phase 2 also creates this idempotently; kept here for clarity.)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenants (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);


-- ---------------------------------------------------------------------
-- 2. tenant_users — membership (user ↔ tenant, with role)
--    Base columns only. Phase 2 adds role/email/constraints via ALTER.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_users (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tenant_id)
);


-- ---------------------------------------------------------------------
-- 3. field_definitions — per-tenant custom field catalogue
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.field_definitions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  key         text NOT NULL,
  label       text NOT NULL,
  type        text NOT NULL DEFAULT 'text',
  required    boolean NOT NULL DEFAULT false,
  options     jsonb,
  active      boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT field_definitions_type_check
    CHECK (type IN ('text', 'number', 'email', 'tel', 'date', 'select', 'textarea')),
  CONSTRAINT field_definitions_tenant_key UNIQUE (tenant_id, key)
);

CREATE INDEX IF NOT EXISTS field_definitions_tenant_active_idx
  ON public.field_definitions (tenant_id, active, sort_order);


-- ---------------------------------------------------------------------
-- 4. leads — the core business object
--    Base columns only. Later phases add assigned_to, follow_up_at, etc.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leads (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'new',
  custom_data  jsonb NOT NULL DEFAULT '{}'::jsonb,
  source       text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leads_status_check
    CHECK (status IN ('new', 'contacted', 'qualified', 'won', 'lost'))
);

CREATE INDEX IF NOT EXISTS leads_tenant_created_idx
  ON public.leads (tenant_id, created_at DESC);
