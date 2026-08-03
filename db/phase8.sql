-- =====================================================================
-- Phase 8: Split Dashboard from Leads, editable field labels, layout builder
--
-- Adds:
--   1. tenants.layout_config      — reserved for Phase 8 page-builder JSON
--   2. Two new feature-flag keys used by app code (via lib/features.ts):
--        - features.dashboard    (default: true)
--        - features.field_labels (default: false)
--      These flags live inside the existing tenants.features JSONB column;
--      no schema change needed for them.
--
-- HOW TO RUN
-- 1. Supabase Dashboard → SQL Editor → paste this file → Run
-- =====================================================================

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS layout_config jsonb;

-- Backfill: give every existing tenant the "dashboard" flag = true so their
-- experience is unchanged after deploy. New tenants also default via
-- lib/features.ts::withDefaults().
UPDATE public.tenants
   SET features = COALESCE(features, '{}'::jsonb) || '{"dashboard": true}'::jsonb
 WHERE features IS NULL
    OR NOT (features ? 'dashboard');
