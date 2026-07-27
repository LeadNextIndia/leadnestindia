-- =====================================================================
-- Phase 7: Multi-feature foundation
--
-- Adds:
--   1. tenants.display_name + tenants.background_path (Feature 1 — branding)
--   2. support_tickets                                 (Feature 4)
--   3. user_creation_requests                          (Feature 5)
--   4. user_column_prefs                               (Feature 2)
--   5. audit_log                                       (cross-cutting)
--   6. Storage bucket "branding" + RLS policies        (Feature 1 — image uploads)
--
-- HOW TO RUN
-- 1. Supabase Dashboard → SQL Editor → New query
-- 2. Paste this entire file → Run
-- 3. Verify: `SELECT id FROM storage.buckets WHERE id='branding';` returns 1 row
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Branding columns on tenants
-- ---------------------------------------------------------------------
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS display_name     text,
  ADD COLUMN IF NOT EXISTS background_path  text;


-- ---------------------------------------------------------------------
-- 2. support_tickets — customer support requests (Feature 4)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  subject      text NOT NULL,
  body         text NOT NULL,
  priority     text NOT NULL DEFAULT 'normal',
  status       text NOT NULL DEFAULT 'open',
  resolved_at  timestamptz,
  resolved_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_tickets_priority_check
    CHECK (priority IN ('low','normal','high','urgent')),
  CONSTRAINT support_tickets_status_check
    CHECK (status IN ('open','in_progress','resolved','closed'))
);

CREATE INDEX IF NOT EXISTS support_tickets_tenant_idx
  ON public.support_tickets (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx
  ON public.support_tickets (status, created_at DESC);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS st_select ON public.support_tickets;
CREATE POLICY st_select ON public.support_tickets FOR SELECT
  USING (
    public.is_superadmin(auth.uid())
    OR public.tenant_role(auth.uid(), tenant_id) IS NOT NULL
  );

DROP POLICY IF EXISTS st_insert ON public.support_tickets;
CREATE POLICY st_insert ON public.support_tickets FOR INSERT
  WITH CHECK (
    public.tenant_role(auth.uid(), tenant_id) IS NOT NULL
  );

DROP POLICY IF EXISTS st_update ON public.support_tickets;
CREATE POLICY st_update ON public.support_tickets FOR UPDATE
  USING (public.is_superadmin(auth.uid()));


-- ---------------------------------------------------------------------
-- 3. user_creation_requests — admins ask superadmin to add a user (Feature 5)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_creation_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  requested_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name            text NOT NULL,
  email           text NOT NULL,
  mobile          text,
  requested_role  text NOT NULL DEFAULT 'user',
  status          text NOT NULL DEFAULT 'pending',
  reviewed_at     timestamptz,
  reviewed_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  review_notes    text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ucr_role_check   CHECK (requested_role IN ('admin','user')),
  CONSTRAINT ucr_status_check CHECK (status IN ('pending','approved','rejected'))
);

CREATE INDEX IF NOT EXISTS ucr_status_idx
  ON public.user_creation_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS ucr_tenant_idx
  ON public.user_creation_requests (tenant_id, created_at DESC);

ALTER TABLE public.user_creation_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ucr_select ON public.user_creation_requests;
CREATE POLICY ucr_select ON public.user_creation_requests FOR SELECT
  USING (
    public.is_superadmin(auth.uid())
    OR public.tenant_role(auth.uid(), tenant_id) = 'admin'
  );

DROP POLICY IF EXISTS ucr_insert ON public.user_creation_requests;
CREATE POLICY ucr_insert ON public.user_creation_requests FOR INSERT
  WITH CHECK (
    public.tenant_role(auth.uid(), tenant_id) = 'admin'
  );

DROP POLICY IF EXISTS ucr_update ON public.user_creation_requests;
CREATE POLICY ucr_update ON public.user_creation_requests FOR UPDATE
  USING (public.is_superadmin(auth.uid()));


-- ---------------------------------------------------------------------
-- 4. user_column_prefs — per-user column selection per view (Feature 2)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_column_prefs (
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  view_key        text NOT NULL,
  visible_fields  text[] NOT NULL DEFAULT '{}',
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tenant_id, view_key)
);

ALTER TABLE public.user_column_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ucp_all ON public.user_column_prefs;
CREATE POLICY ucp_all ON public.user_column_prefs FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ---------------------------------------------------------------------
-- 5. audit_log — sensitive-action trail (approvals, setting changes, etc.)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
  id             bigserial PRIMARY KEY,
  actor_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id      uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  action         text NOT NULL,
  target_type    text,
  target_id      text,
  metadata       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_created_idx
  ON public.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_tenant_idx
  ON public.audit_log (tenant_id, created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_select ON public.audit_log;
CREATE POLICY audit_select ON public.audit_log FOR SELECT
  USING (public.is_superadmin(auth.uid()));

-- inserts happen through service-role client only (no INSERT policy = closed)


-- ---------------------------------------------------------------------
-- 6. Storage bucket "branding" + RLS policies on storage.objects
--    Path convention: <tenant_id>/background.<ext>
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('branding', 'branding', false)
ON CONFLICT (id) DO NOTHING;

-- Read: any tenant member (of the tenant folder) OR superadmin.
DROP POLICY IF EXISTS branding_read ON storage.objects;
CREATE POLICY branding_read ON storage.objects FOR SELECT
  USING (
    bucket_id = 'branding'
    AND (
      public.is_superadmin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.tenant_users tu
         WHERE tu.user_id = auth.uid()
           AND tu.tenant_id::text = (storage.foldername(name))[1]
      )
    )
  );

-- Write / delete: admin of that tenant only.
DROP POLICY IF EXISTS branding_write ON storage.objects;
CREATE POLICY branding_write ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'branding'
    AND EXISTS (
      SELECT 1 FROM public.tenant_users tu
       WHERE tu.user_id = auth.uid()
         AND tu.role = 'admin'
         AND tu.tenant_id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS branding_update ON storage.objects;
CREATE POLICY branding_update ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'branding'
    AND EXISTS (
      SELECT 1 FROM public.tenant_users tu
       WHERE tu.user_id = auth.uid()
         AND tu.role = 'admin'
         AND tu.tenant_id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS branding_delete ON storage.objects;
CREATE POLICY branding_delete ON storage.objects FOR DELETE
  USING (
    bucket_id = 'branding'
    AND EXISTS (
      SELECT 1 FROM public.tenant_users tu
       WHERE tu.user_id = auth.uid()
         AND tu.role = 'admin'
         AND tu.tenant_id::text = (storage.foldername(name))[1]
    )
  );
