-- =====================================================================
-- Phase 6: GST-compliant invoicing (paid feature)
--
-- HOW TO RUN: Supabase Dashboard → SQL Editor → paste → Run. Idempotent.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Tenant GST config (used as defaults on new invoices).
--    CGST/SGST are always split equally from gst_rate — for intra-state.
--    Superadmin still gates whether tenant can even use invoicing
--    (features.invoicing).
-- ---------------------------------------------------------------------
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS gstin           text,
  ADD COLUMN IF NOT EXISTS company_address text,
  ADD COLUMN IF NOT EXISTS state           text,
  ADD COLUMN IF NOT EXISTS state_code      text,      -- 2-digit GST state code, e.g. '27' for Maharashtra
  ADD COLUMN IF NOT EXISTS gst_rate        numeric NOT NULL DEFAULT 18,   -- total %, split as CGST + SGST
  ADD COLUMN IF NOT EXISTS default_hsn     text;


-- ---------------------------------------------------------------------
-- 2. Invoices table.
--    Seller info is snapshotted at generation time so future edits to
--    tenants.gstin / address don't rewrite historical invoices.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lead_id           uuid        REFERENCES public.leads(id) ON DELETE SET NULL,

  invoice_number    text        NOT NULL,
  invoice_date      date        NOT NULL DEFAULT current_date,

  -- Seller snapshot
  seller_name       text        NOT NULL,
  seller_address    text,
  seller_gstin      text,
  seller_state      text,
  seller_state_code text,

  -- Buyer
  buyer_name        text        NOT NULL,
  buyer_address     text,
  buyer_gstin       text,
  buyer_phone       text,
  buyer_email       text,
  buyer_state       text,
  buyer_state_code  text,

  -- Items as JSONB — [{ description, hsn, qty, rate, amount }]
  items             jsonb       NOT NULL DEFAULT '[]'::jsonb,

  -- Totals (all numeric, computed on the server at save time)
  subtotal          numeric     NOT NULL DEFAULT 0,
  gst_rate          numeric     NOT NULL DEFAULT 0,   -- total GST %, e.g. 18
  cgst_amount       numeric     NOT NULL DEFAULT 0,
  sgst_amount       numeric     NOT NULL DEFAULT 0,
  igst_amount       numeric     NOT NULL DEFAULT 0,   -- for inter-state (unused in MVP)
  total             numeric     NOT NULL DEFAULT 0,
  inter_state       boolean     NOT NULL DEFAULT false,

  notes             text,
  created_by        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT invoices_number_per_tenant_unique UNIQUE (tenant_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS invoices_tenant_idx     ON public.invoices (tenant_id, invoice_date DESC);
CREATE INDEX IF NOT EXISTS invoices_lead_idx       ON public.invoices (lead_id);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- SELECT: any tenant member or superadmin
DROP POLICY IF EXISTS inv_select ON public.invoices;
CREATE POLICY inv_select ON public.invoices FOR SELECT
  USING (
    public.is_superadmin(auth.uid())
    OR public.tenant_role(auth.uid(), tenant_id) IS NOT NULL
  );

-- INSERT / UPDATE / DELETE: admins in the tenant (or superadmin)
DROP POLICY IF EXISTS inv_write ON public.invoices;
CREATE POLICY inv_write ON public.invoices FOR ALL
  USING (
    public.is_superadmin(auth.uid())
    OR public.tenant_role(auth.uid(), tenant_id) = 'admin'
  )
  WITH CHECK (
    public.is_superadmin(auth.uid())
    OR public.tenant_role(auth.uid(), tenant_id) = 'admin'
  );
