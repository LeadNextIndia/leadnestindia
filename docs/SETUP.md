# Setup

Everything you need to get LeadNestIndia running locally (or fresh in production).

---

## 1. Prerequisites

- **Node.js 20.11.0** — the project pins this via `.nvmrc`
  ```bash
  nvm use   # picks up .nvmrc
  ```
  If you get build failures, first verify: `node --version` should print `v20.11.0`. Newer Node versions may work but haven't been tested; Supabase is deprecating Node 20 so we'll bump to 22 soon.
- **npm** (bundled with Node)
- **A Supabase project** — free tier works fine

---

## 2. Clone + install

```bash
git clone <this-repo>
cd leadnestindia
npm install
```

---

## 3. Create a Supabase project

1. Go to <https://supabase.com/dashboard> → **New project**
2. Note down these values from **Project Settings → API**:
   - Project URL (`NEXT_PUBLIC_SUPABASE_URL`)
   - `anon` public key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - `service_role` secret key (`SUPABASE_SERVICE_ROLE_KEY`) — **treat as sensitive**, this bypasses RLS

---

## 4. Configure environment

Create `.env.local` in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

Never commit `.env.local` — it's already in `.gitignore`.

---

## 5. Configure Supabase Auth URLs

Supabase Dashboard → **Authentication → URL Configuration**:

- **Site URL:** `http://localhost:3000` (or your production URL)
- **Redirect URLs (Additional):** add `http://localhost:3000/auth/callback`

Without these, the invite email links won't come back to the app correctly.

---

## 6. Run the migrations

Supabase Dashboard → **SQL Editor → New query**. Paste each file in order and click **Run**:

| File | Contents |
|---|---|
| `db/phase2.sql` | Roles + RLS + invite trigger |
| `db/phase3.sql` | Custom fields + tenant feature flags + backfills |
| `db/phase4.sql` | Saved filter views |
| `db/phase5.sql` | Lead assignment + follow-ups + activity |
| `db/phase6.sql` | GST invoicing |

All files are idempotent (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE … ADD COLUMN IF NOT EXISTS`) — safe to re-run.

**If you started from scratch (fresh Supabase):** run all 5 in order.
**If you're an existing user:** run any newer phase files you haven't run yet.

---

## 7. Bootstrap yourself as superadmin

Only needed once, after your first sign-in.

1. Start the app (`npm run dev`)
2. Go to <http://localhost:3000/login> → click **"Forgot / first time?"** → enter your email
3. Check your inbox for the reset link → set your password
4. Come back to Supabase SQL Editor and run:
   ```sql
   INSERT INTO public.superadmins (user_id)
   SELECT id FROM auth.users WHERE email = 'your@email.com'
   ON CONFLICT (user_id) DO NOTHING;
   ```

Sign out and back in — you should now see the **Superadmin** item in the sidebar.

---

## 8. Run the dev server

```bash
npm run dev
```

Open <http://localhost:3000>. Turbopack rebuild is near-instant on file save.

---

## 9. Try the flow

- **As superadmin:** `/superadmin` → **Onboard company** → creates a tenant + sends the first admin an invite
- Check that admin's inbox → click the link → land at `/auth/set-password` → set password → `/dashboard`
- **As that admin:** `/dashboard/team` → invite a teammate as `user`
- **Any user:** create a lead, edit it, assign it, add a follow-up date

To try the paid features, go back as superadmin: `/superadmin/tenants/[id]` → toggle **Analytics** / **Invoicing** / **Notes & activity** on for that tenant → save.

---

## 10. Verify a build

Before pushing changes, run:

```bash
npx tsc --noEmit    # type check
npm run lint        # eslint
npm run build       # full production build
```

All three should pass with no output beyond the standard success lines.

---

## Deploying to production

### Vercel (recommended for Next.js)
1. Push to a Git remote (GitHub / GitLab / Bitbucket)
2. Vercel → **New Project** → import the repo
3. **Environment Variables:** paste the three from `.env.local`
4. Deploy

### Post-deployment
- Update Supabase → Auth → URL Configuration:
  - **Site URL:** your production URL
  - **Redirect URLs:** add `<prod-url>/auth/callback`
- Re-check the invite flow end-to-end after DNS is live

### Custom domain
Add the domain in Vercel; Supabase URL config picks up the same domain automatically once you update it there.

---

## Troubleshooting

### "invalid credentials" after clicking an invite link
The invite email came from Supabase's built-in "Invite user" (which uses OTP), but the callback expects PKCE. Two fixes:
1. Use the app's Team invite (`/dashboard/team`) or Onboard flow (`/superadmin`) instead — both use PKCE via `inviteUserByEmail`.
2. Or ensure `app/auth/callback/route.ts` handles both `?code=` (PKCE) and `?token_hash=&type=` (OTP) — it does, as of Phase 2.

### "Schema not ready — column X does not exist"
Some migration didn't apply. Re-run the relevant `db/phaseN.sql` file. If a column is missing on an existing table, the fix is `ALTER TABLE … ADD COLUMN IF NOT EXISTS` (not `CREATE TABLE`) — see [`ARCHITECTURE.md`](./ARCHITECTURE.md#legacy-tables).

### Build fails with "Target signature provides too few arguments"
An App Router **page** is using the route-handler signature `(req, ctx)`. Pages take `{ params }` as props (params is a `Promise`). See [`ARCHITECTURE.md`](./ARCHITECTURE.md#nextjs-16--react-19-patterns) #5.

### "Scripts inside React components are never executed on the client"
Inline `<script>` in a component. Use `next/script` with `strategy="beforeInteractive"` inside `<body>`. See `app/layout.tsx`.

### Dark mode flashes wrong theme on refresh
Missing the pre-hydration script in `app/layout.tsx`. It must be inside `<body>` before `{children}`.

### `useSearchParams` build failure
Wrap the component using it in `<Suspense>` at the page level. See `app/login/page.tsx` for the pattern.

---

## Useful commands

```bash
npm run dev            # dev server on localhost:3000
npm run build          # production build
npm start              # run the built server
npm run lint           # eslint

npx tsc --noEmit       # type check without emitting

# Dump the live schema from Supabase (source-of-truth vs. db/SCHEMA.md)
supabase db dump --schema public > current_schema.sql
```

---

## Further reading

- [`README.md`](../README.md) — project overview + docs index
- [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) — tech decisions + patterns
- [`docs/FEATURES.md`](./FEATURES.md) — every feature with file references
- [`docs/API.md`](./API.md) — REST endpoint reference
- [`db/SCHEMA.md`](../db/SCHEMA.md) — ER diagram + table reference
