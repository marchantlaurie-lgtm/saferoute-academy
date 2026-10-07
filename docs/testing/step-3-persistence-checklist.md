# Step 3 persistence checklist

Milestone state: **complete — cloud preview passed 6 October 2026**

Run this checklist against the `academy-engineering-cfi-prototype` preview only. Do not use production and do not enter real information.

## Automated gate

| Check | Result |
| --- | --- |
| `npm test` | Pass — 32/32 |
| `npm run lint` | Pass |
| `npm run build` | Pass — existing main-bundle advisory only |
| `npm audit --omit=dev` | Pass — 0 vulnerabilities |

## Synthetic workspace boundary

| Check | Local result | Cloud preview |
| --- | --- | --- |
| Warning says the workspace is synthetic, private and resettable | Pass | Pass |
| Warning says not to enter real personal or operational data | Pass | Pass |
| Demo contains 12 fictional people, including three CFIs | Pass | Pass |
| Demo contains six fictional aircraft, including restricted, grounded and maintenance examples | Pass | Pass |
| Non-synthetic or authoritative snapshots are rejected | Pass — automated | Pass — live RPC rejection |

## Persistence and integration

| Check | Local result | Cloud preview |
| --- | --- | --- |
| CFI training-status change survives a reload | Pass | Pass |
| Persisted CFI status appears in Pilot / Ops | Pass | Pass |
| Non-current status requires visible CFI intervention in the risk review | Pass | Pass |
| CFI aircraft authorisation survives a reload and changes eligibility | Pass — shared-state and Step 1 tests | Pass — repository path verified |
| Engineering defect/restriction survives a reload and appears in Aircraft context | Pass — shared-state and Step 1 tests | Pass — repository path verified |
| Engineering Grounded/Maintenance survives a reload and blocks selection | Pass — shared-state and Step 1 tests | Pass — repository path verified |
| Admin access-role change survives a reload | Pass — shared-state test | Pass — repository path verified |
| Reset restores the original fictional template | Pass — automated | Pass — cloud save path verified |

## Isolation and cloud behavior

| Check | Cloud preview |
| --- | --- |
| Preview displays `PRIVATE SYNTHETIC DEMO · CLOUD SAVED` | Pass |
| A second private identity cannot read the first workspace | Pass — live two-identity check returned zero cross-workspace rows |
| Concurrent stale revision is rejected instead of silently overwriting newer state | Pass — live RPC check |
| Cloud failure falls back to clearly labelled private device storage | Pass — implementation path and device-mode preview verified |
| Browser console has no errors on the critical path | Pass |
| Supabase internal automatic-RLS helper is unavailable to public API roles | Pass — anonymous and authenticated checks both returned `false` |
| Supabase security advisor | Pass — 0 errors; 8 expected controlled-beta warnings recorded in the milestone |

## Responsive regression

| Check | Desktop | Mobile |
| --- | --- | --- |
| New warning/reset panel does not overflow | Pass | Pass — 390 × 844, document width 390px |
| Login actions remain visible and usable | Pass | Pass — 390 × 844 |
| CFI, Engineering, Admin and Ops dashboards retain frozen workflow | Pass on tested CFI/Ops path | Pass — Step 2 mobile baseline retained; Step 3 entry panel verified |

## Device-mode preview record

- Verification date: 6 October 2026
- Verified application commit: `7d3b90dbe80d2051f04a1bdeef59ccf5dfc2d382`
- Vercel preview: [stable prototype-branch preview](https://saferoute-academy-git-academy-engineering-cfi-4aa47c-saferoute1.vercel.app/)
- Visible persistence state: `PRIVATE SYNTHETIC DEMO · SAVED ON THIS DEVICE`
- Browser-console result on tested CFI path: no warnings or errors
- Cloud completion gate: passed

## Completion record

- Verification date: 6 October 2026
- Verified application commit: `7d3b90dbe80d2051f04a1bdeef59ccf5dfc2d382`
- Verified database hardening commit: `5334b9ce6d8e6ba710d9dd22daa67d7be34a51ff`
- Vercel preview deployment: `GZsE3DkSBUqebhP9pnq8gabE1GJc` — [exact deployment](https://saferoute-academy-fdlv9on6i-saferoute1.vercel.app/) and [stable branch preview](https://saferoute-academy-git-academy-engineering-cfi-4aa47c-saferoute1.vercel.app/)
- Supabase migrations applied: `202610060001_step3_demo_workspaces.sql` and `202610060002_harden_auto_rls_helper.sql`
- Production unchanged: Pass — original session-only demo remains at [production](https://saferoute-academy.vercel.app/); `main` remains `54f0a86908c46226d6174f986d098cc4d9afa1c0`
- Step 3 outcome: **Complete — private synthetic workspaces persist in the cloud, remain isolated, and preserve the Step 1 safety behavior.**
