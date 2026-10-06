# Step 3 milestone — persistent private demo workspaces

Status: **implementation complete; cloud activation pending**

Branch: `academy-engineering-cfi-prototype`

Implementation commit: `7d3b90dbe80d2051f04a1bdeef59ccf5dfc2d382`

Branch preview: [academy-engineering-cfi-prototype](https://saferoute-academy-git-academy-engineering-cfi-4aa47c-saferoute1.vercel.app/)

Production and `main`: unchanged; no production promotion is authorised by this milestone

## Purpose

Step 3 replaces the reset-on-reload flight-school prototype with a persistent, isolated workspace foundation. It is designed to let independent CFIs and invited school reviewers test the complete CFI → Pilot/FRAT and Engineering → Pilot/FRAT workflows without entering real operational records.

## Tester model

### Independent CFIs

- Enter through **Independent CFI / Training Trial**.
- Receive a private, resettable fictional flight school containing 12 people, three CFIs and six aircraft.
- Can test training status, sign-off and type-authorisation changes without needing a real school to sponsor them.
- Their changes persist, but remain explicitly synthetic and non-authoritative.

### Reviewing flight schools

- The database model supports a separate `school_review` organisation boundary for each school.
- Initial school testing uses the same synthetic dataset or carefully prepared pseudonymous scenarios—never live maintenance, medical, training or dispatch records.
- Shared invitations and enforced user roles are Step 4. Until then, a school workspace must not be presented as a multi-user operational system.

## Completed implementation

- Added a versioned synthetic demo-school template with fictional people, accounts, aircraft, defects, restrictions and maintenance states.
- Added persistence across reloads for people, fleet, access roles and the visible admin activity list.
- Added a one-click reset path back to the original demo template.
- Added a repository boundary that selects cloud persistence only when both public beta database settings are present, otherwise using private browser storage.
- Added organisation, membership, workspace-state and append-only service audit tables in a Supabase migration.
- Added organisation-bound row-level read policies and service functions for creation and optimistic revision-controlled saves.
- Rejected real/authoritative workspace states in the application repository and in database constraints/functions.
- Kept CFI and Engineering updates connected to Pilot / Ops and the Step 1 FRAT rules.
- Kept all beta/demo labels, added visible synthetic-data warnings, and expressly told testers not to enter real information.
- Added persistence and safety-boundary automated tests.

## Privacy and security boundary

This milestone is intentionally not approval to collect real data.

- The seed people, email addresses, aircraft, medical summaries, training records and defects are fabricated.
- The beta state is marked `synthetic`, `authoritative: false` and `resettable: true`.
- Database access is scoped through organisation membership and row-level security.
- Direct client mutation of protected tables is revoked; writes use checked database functions.
- The preview may use anonymous private beta identities only to create isolated demo workspaces. Proper named authentication, invitations and role enforcement are Step 4.
- The save-event table proves that revisions were created, but it is not yet the full human-readable operational audit trail. That is Step 5.

Before any real personal or operational data is considered, SafeRoute still needs named authentication, least-privilege roles, school agreements and privacy notices, defined retention/deletion, incident handling, backups, and an explicit decision about regulatory-record responsibilities.

## Verification completed on 6 October 2026

- `npm test`: **32 passed, 0 failed**.
- `npm run lint`: passed with no findings.
- `npm run build`: passed; the previously triaged main-bundle advisory remains.
- `npm audit --omit=dev`: **0 vulnerabilities**.
- Local browser test: a fictional CFI status change saved, survived a full reload, appeared in Pilot / Ops, and triggered the expected CFI-intervention context.
- Local browser console: no warnings or errors on the tested path.
- Grounded and Maintenance aircraft remained blocked; missing type authorisation remained blocked.
- The Vercel branch preview deployed the new independent-CFI entry, 12-person/six-aircraft fictional workspace and device-persistence fallback; its tested CFI path produced no browser-console warnings or errors.

## Remaining activation gate

The code and migration are ready, but this milestone cannot be marked complete until:

1. A beta Supabase project is selected or created.
2. Anonymous sign-in is enabled for the private demo phase.
3. `supabase/migrations/202610060001_step3_demo_workspaces.sql` is applied.
4. `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are added to the prototype-branch Vercel Preview environment only.
5. The branch preview is deployed and the cloud checks in the Step 3 checklist pass.
6. The production domain and `main` are verified unchanged.

The local/device fallback is useful for development and one-device testing, but it is not the shared database required to close Step 3.

## Exit criteria

- Every new tester receives an isolated private synthetic workspace.
- CFI, Engineering, Admin and Pilot / Ops changes survive reloads in the branch preview.
- Changes made in one isolated workspace cannot be read from another.
- Reset restores the fictional template without crossing organisation boundaries.
- The Step 1 safety blockers and auto-fill behavior still pass.
- No real or authoritative state can be persisted through the supported client path.
- Automated, desktop, mobile and browser-console checks pass on the Vercel preview.
- `main` and production remain unchanged.

Only after all criteria pass should Step 3 be marked complete and Step 4 authentication/roles begin.
