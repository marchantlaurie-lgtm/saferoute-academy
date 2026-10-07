# Step 3 milestone — persistent private demo workspaces

Status: **complete — cloud preview verified 6 October 2026**

Branch: `academy-engineering-cfi-prototype`

Implementation commit: `7d3b90dbe80d2051f04a1bdeef59ccf5dfc2d382`

Database hardening commit: `5334b9ce6d8e6ba710d9dd22daa67d7be34a51ff`

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
- Activated the migrations in the beta-only Supabase project in West EU (Ireland), including removal of public API access to Supabase's internal automatic-RLS helper.
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
- The beta Supabase project and anonymous private-beta identities were activated without exposing a service-role key.
- Public database settings were added only to the Vercel Preview environment for `academy-engineering-cfi-prototype`; Production remained excluded.
- The final Vercel deployment `GZsE3DkSBUqebhP9pnq8gabE1GJc` was Ready and displayed `PRIVATE SYNTHETIC DEMO · CLOUD SAVED`.
- A CFI training-status change survived a full reload and appeared in Pilot / Ops with the required instructor-intervention context.
- A separate two-identity integration check proved that each identity could see only its own workspace, a stale revision was rejected, and a non-synthetic/authoritative state was rejected.
- The final database privilege check returned `false` for both anonymous and authenticated execution of `public.rls_auto_enable()`.
- The Supabase security advisor reported **0 errors**. Its eight remaining warnings are expected for the intentionally callable checked RPCs, anonymous beta identities behind row-level security, and unused password protection while the beta uses anonymous authentication.
- Responsive verification at 390 × 844 showed no horizontal overflow and retained the synthetic-data warning, cloud-save label, reset action and all login choices.
- The final preview's tested CFI path produced no browser-console warnings or errors.
- The production domain still displayed its original session-only demo wording, and remote `main` remained at `54f0a86908c46226d6174f986d098cc4d9afa1c0`.

## Controlled-beta boundary after completion

Step 3 completion means the shared persistence foundation is ready for controlled testing. It does not turn the preview into a production operational record system.

- Keep distribution limited to invited testers while anonymous sign-in is used.
- Continue to use fictional data only.
- CAPTCHA/abuse controls are a precondition for broad or public distribution of the anonymous beta URL.
- Named accounts, invitations and enforced role-specific permissions remain Step 4.
- The immutable human-readable operational audit trail remains Step 5.

## Exit criteria

- Every new tester receives an isolated private synthetic workspace.
- CFI, Engineering, Admin and Pilot / Ops changes survive reloads in the branch preview.
- Changes made in one isolated workspace cannot be read from another.
- Reset restores the fictional template without crossing organisation boundaries.
- The Step 1 safety blockers and auto-fill behavior still pass.
- No real or authoritative state can be persisted through the supported client path.
- Automated, desktop, mobile and browser-console checks pass on the Vercel preview.
- `main` and production remain unchanged.

All Step 3 criteria passed. Step 3 is a discrete completed milestone; Step 4 may begin only as a separate authorised piece of work.
