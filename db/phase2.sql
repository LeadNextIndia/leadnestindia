-- =====================================================================
-- Phase 2: Roles, tenant onboarding, and Row-Level Security
--
-- HOW TO RUN
-- 1. Open Supabase Dashboard → SQL Editor → New query
-- 2. Paste this entire file
-- 3. Click "Run"
--
-- BOOTSTRAP (do AFTER running this file, only once, to become superadmin)
-- 1. Supabase Dashboard → Authentication → Users → "Invite a user"
--    → enter your email (kirankumar.kendre@cashfree.com)
-- 2. Click the link in your inbox → set a password
-- 3. Run in SQL editor:
--    INSERT INTO public.superadmins (user_id)
--    SELECT id FROM auth.users WHERE email = 'kirankumar.kendre@cashfree.com'
--    ON CONFLICT (user_id) DO NOTHING;
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Tenants table (idempotent; likely already exists from Phase 1)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenants (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);


-- ---------------------------------------------------------------------
-- 2. tenant_users: add role + email columns; enforce (user_id, tenant_id) unique
-- ---------------------------------------------------------------------
ALTER TABLE public.tenant_users
  ADD COLUMN IF NOT EXISTS role  text NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS email text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenant_users_role_check'
  ) THEN
    ALTER TABLE public.tenant_users
      ADD CONSTRAINT tenant_users_role_check CHECK (role IN ('admin', 'user'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenant_users_user_tenant_key'
  ) THEN
    ALTER TABLE public.tenant_users
      ADD CONSTRAINT tenant_users_user_tenant_key UNIQUE (user_id, tenant_id);
  END IF;
END $$;

-- backfill email for any existing tenant_users rows
UPDATE public.tenant_users tu
   SET email = u.email
  FROM auth.users u
 WHERE tu.user_id = u.id
   AND tu.email IS NULL;


-- ---------------------------------------------------------------------
-- 3. Superadmins (platform founders)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.superadmins (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);


-- ---------------------------------------------------------------------
-- 4. Helper functions used by RLS policies
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_superadmin(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = uid);
$$;

CREATE OR REPLACE FUNCTION public.tenant_role(uid uuid, tid uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.tenant_users
   WHERE user_id = uid AND tenant_id = tid LIMIT 1;
$$;

-- looks up an auth.users row by email (used by admin API when adding existing users)
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_user_id_by_email(text) TO service_role;


-- ---------------------------------------------------------------------
-- 5. Trigger: when a new auth.users row is created via inviteUserByEmail
--    with tenant_id in metadata, auto-add them to tenant_users
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_invited_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tid   uuid;
  urole text;
BEGIN
  tid   := (NEW.raw_user_meta_data ->> 'tenant_id')::uuid;
  urole := COALESCE(NEW.raw_user_meta_data ->> 'role', 'user');

  IF tid IS NOT NULL THEN
    INSERT INTO public.tenant_users (user_id, tenant_id, role, email)
    VALUES (NEW.id, tid, urole, NEW.email)
    ON CONFLICT (user_id, tenant_id)
      DO UPDATE SET role = EXCLUDED.role, email = EXCLUDED.email;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_invite ON auth.users;
CREATE TRIGGER on_auth_user_created_invite
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_invited_user();


-- ---------------------------------------------------------------------
-- 6. Row-Level Security
--    Enable on all four tenanted tables and add policies.
-- ---------------------------------------------------------------------
ALTER TABLE public.tenants           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.superadmins       ENABLE ROW LEVEL SECURITY;

-- tenants: members see their own tenant, superadmins see all
DROP POLICY IF EXISTS tenants_select ON public.tenants;
CREATE POLICY tenants_select ON public.tenants FOR SELECT
  USING (
    public.is_superadmin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.tenant_users
       WHERE tenant_users.user_id = auth.uid()
         AND tenant_users.tenant_id = tenants.id
    )
  );

DROP POLICY IF EXISTS tenants_insert ON public.tenants;
CREATE POLICY tenants_insert ON public.tenants FOR INSERT
  WITH CHECK (public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS tenants_update ON public.tenants;
CREATE POLICY tenants_update ON public.tenants FOR UPDATE
  USING (public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS tenants_delete ON public.tenants;
CREATE POLICY tenants_delete ON public.tenants FOR DELETE
  USING (public.is_superadmin(auth.uid()));

-- tenant_users: members can see themselves and coworkers; only admins mutate
DROP POLICY IF EXISTS tu_select ON public.tenant_users;
CREATE POLICY tu_select ON public.tenant_users FOR SELECT
  USING (
    public.is_superadmin(auth.uid())
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.tenant_users me
       WHERE me.user_id = auth.uid()
         AND me.tenant_id = tenant_users.tenant_id
    )
  );

DROP POLICY IF EXISTS tu_insert ON public.tenant_users;
CREATE POLICY tu_insert ON public.tenant_users FOR INSERT
  WITH CHECK (
    public.is_superadmin(auth.uid())
    OR public.tenant_role(auth.uid(), tenant_id) = 'admin'
  );

DROP POLICY IF EXISTS tu_update ON public.tenant_users;
CREATE POLICY tu_update ON public.tenant_users FOR UPDATE
  USING (
    public.is_superadmin(auth.uid())
    OR public.tenant_role(auth.uid(), tenant_id) = 'admin'
  );

DROP POLICY IF EXISTS tu_delete ON public.tenant_users;
CREATE POLICY tu_delete ON public.tenant_users FOR DELETE
  USING (
    public.is_superadmin(auth.uid())
    OR public.tenant_role(auth.uid(), tenant_id) = 'admin'
  );

-- leads: any member reads/inserts; only admins (or superadmin) edit/delete
DROP POLICY IF EXISTS leads_select ON public.leads;
CREATE POLICY leads_select ON public.leads FOR SELECT
  USING (
    public.is_superadmin(auth.uid())
    OR public.tenant_role(auth.uid(), tenant_id) IS NOT NULL
  );

DROP POLICY IF EXISTS leads_insert ON public.leads;
CREATE POLICY leads_insert ON public.leads FOR INSERT
  WITH CHECK (
    public.is_superadmin(auth.uid())
    OR public.tenant_role(auth.uid(), tenant_id) IS NOT NULL
  );

DROP POLICY IF EXISTS leads_update ON public.leads;
CREATE POLICY leads_update ON public.leads FOR UPDATE
  USING (
    public.is_superadmin(auth.uid())
    OR public.tenant_role(auth.uid(), tenant_id) = 'admin'
  );

DROP POLICY IF EXISTS leads_delete ON public.leads;
CREATE POLICY leads_delete ON public.leads FOR DELETE
  USING (
    public.is_superadmin(auth.uid())
    OR public.tenant_role(auth.uid(), tenant_id) = 'admin'
  );

-- field_definitions: any member reads; only admins mutate
DROP POLICY IF EXISTS fd_select ON public.field_definitions;
CREATE POLICY fd_select ON public.field_definitions FOR SELECT
  USING (
    public.is_superadmin(auth.uid())
    OR public.tenant_role(auth.uid(), tenant_id) IS NOT NULL
  );

DROP POLICY IF EXISTS fd_all ON public.field_definitions;
CREATE POLICY fd_all ON public.field_definitions FOR ALL
  USING (
    public.is_superadmin(auth.uid())
    OR public.tenant_role(auth.uid(), tenant_id) = 'admin'
  )
  WITH CHECK (
    public.is_superadmin(auth.uid())
    OR public.tenant_role(auth.uid(), tenant_id) = 'admin'
  );

-- superadmins: only visible to superadmins
DROP POLICY IF EXISTS sa_select ON public.superadmins;
CREATE POLICY sa_select ON public.superadmins FOR SELECT
  USING (public.is_superadmin(auth.uid()));
