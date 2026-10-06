# Step 3 persistence checklist

Milestone state: **local and device-mode preview pass; cloud preview pending**

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
| Warning says the workspace is synthetic, private and resettable | Pass | Pass in device mode; cloud mode pending |
| Warning says not to enter real personal or operational data | Pass | Pass in device mode; cloud mode pending |
| Demo contains 12 fictional people, including three CFIs | Pass | Pass in device mode; cloud mode pending |
| Demo contains six fictional aircraft, including restricted, grounded and maintenance examples | Pass | Pass in device mode; cloud mode pending |
| Non-synthetic or authoritative snapshots are rejected | Pass — automated | Pending |

## Persistence and integration

| Check | Local result | Cloud preview |
| --- | --- | --- |
| CFI training-status change survives a reload | Pass | Pending |
| Persisted CFI status appears in Pilot / Ops | Pass | Pending |
| Non-current status requires visible CFI intervention in the risk review | Pass | Pending |
| CFI aircraft authorisation survives a reload and changes eligibility | Covered by shared-state and Step 1 tests | Pending |
| Engineering defect/restriction survives a reload and appears in Aircraft context | Covered by shared-state and Step 1 tests | Pending |
| Engineering Grounded/Maintenance survives a reload and blocks selection | Covered by shared-state and Step 1 tests | Pending |
| Admin access-role change survives a reload | Covered by shared-state test | Pending |
| Reset restores the original fictional template | Pass — automated | Pending |

## Isolation and cloud behavior

| Check | Cloud preview |
| --- | --- |
| Preview displays `PRIVATE SYNTHETIC DEMO · CLOUD SAVED` | Pending |
| A second private identity cannot read the first workspace | Pending |
| Concurrent stale revision is rejected instead of silently overwriting newer state | Pending |
| Cloud failure falls back to clearly labelled private device storage | Pending |
| Browser console has no errors on the critical path | Pass in device mode; cloud mode pending |

## Responsive regression

| Check | Desktop | Mobile |
| --- | --- | --- |
| New warning/reset panel does not overflow | Pass | Pending |
| Login actions remain visible and usable | Pass | Pending |
| CFI, Engineering, Admin and Ops dashboards retain frozen workflow | Pass on tested CFI/Ops path | Pending |

## Device-mode preview record

- Verification date: 6 October 2026
- Verified application commit: `7d3b90dbe80d2051f04a1bdeef59ccf5dfc2d382`
- Vercel preview: [stable prototype-branch preview](https://saferoute-academy-git-academy-engineering-cfi-4aa47c-saferoute1.vercel.app/)
- Visible persistence state: `PRIVATE SYNTHETIC DEMO · SAVED ON THIS DEVICE`
- Browser-console result on tested CFI path: no warnings or errors
- Cloud completion gate: not passed

## Completion record

Fill only after cloud activation:

- Verification date:
- Verified application commit:
- Vercel preview deployment:
- Supabase migration applied:
- Production unchanged:
- Step 3 outcome:
