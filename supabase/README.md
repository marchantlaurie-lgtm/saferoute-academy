# SafeRoute Step 3 database activation

This directory contains the database migration for private synthetic beta workspaces.

Apply `migrations/202610060001_step3_demo_workspaces.sql` to a beta-only Supabase project, enable anonymous sign-ins, then set these variables in the Vercel **Preview** environment for the prototype branch:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Do not add these settings to Production as part of Step 3. Do not place the Supabase service-role key in Vite or Vercel client variables.

The migration accepts synthetic, non-authoritative demo state only. It creates organisation membership and row-level isolation, but Step 4 is still required before named users, invitations or enforced role-specific access are offered.
