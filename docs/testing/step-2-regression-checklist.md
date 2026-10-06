# Step 2 frozen-interface regression checklist

Baseline: application UI at `1d9677a0f0a06c2f77b00d97be059f820a7838ca`  
Milestone state: **entry checks recorded; full exit pass pending**

Use the prototype-branch Vercel preview. Do not perform this checklist against production. Record a triage entry for every failure before changing the interface.

## Automated gate

| Check | Entry result | Exit result |
| --- | --- | --- |
| `npm test` | Pass — 27/27 | Pending |
| `npm run lint` | Pass | Pending |
| `npm run build` | Pass — existing bundle-size advisory only | Pending |
| Vercel deployment status | Ready for baseline | Pending |
| Browser console on critical path | No errors on baseline | Pending |

## Account selection and labelling

| Check | Entry evidence | Exit result |
| --- | --- | --- |
| Personal and Flight School / Club choices are available | Baseline smoke passed | Pending |
| Flight-school route remains labelled demo/not live | Baseline smoke passed | Pending |
| Specialist workspaces remain labelled prototype/demo | Baseline smoke passed | Pending |
| Session-only and non-authoritative-record limitations remain visible | Baseline smoke passed | Pending |

## Personal Academy

| Check | Desktop exit | Mobile exit |
| --- | --- | --- |
| Region and airfield selection opens the expected Academy view | Pending | Pending |
| Airfield hazards and instructor notes remain readable | Pending | Pending |
| Weather availability/freshness messaging renders without overlap | Pending | Pending |
| E6B opens, accepts input, and returns to Academy | Pending | Pending |
| Standalone FRAT opens with every field manual | Pending | Pending |

## Pilot / Ops and Academy → FRAT

| Check | Entry evidence | Exit result |
| --- | --- | --- |
| Pilot and aircraft can be selected | Step 1 pass | Pending |
| Grounded and Maintenance aircraft cannot be selected | Step 1 pass | Pending |
| Missing aircraft-type authorisation blocks selection with CFI context | Step 1 pass | Pending |
| Jordan Reyes + N172SR produces four Academy auto-fills | Step 1 pass | Pending |
| Alicia Chen + N44TR shows due-soon, defect, restriction, and maintenance advisories | Step 1 pass | Pending |
| Sarah Kim + N721CT auto-fills lapsed/unsure with CFI intervention required | Step 1 pass | Pending |
| Sleep, IMSAFE, familiarity, performance, fuel, weather, and external pressures remain manual | Step 1 pass | Pending |
| Pilot override changes the entry label but preserves Academy source context | Step 1 pass | Pending |
| FRAT controls and residual-risk review remain usable | Automated coverage; visual exit pending | Pending |

## Shared in-session workspaces

| Check | Entry evidence | Exit result |
| --- | --- | --- |
| CFI sign-off immediately changes Pilot / Ops training state | Step 1 pass | Pending |
| CFI aircraft authorisation immediately changes Pilot / Ops eligibility | Step 1 pass | Pending |
| Engineering restriction/defect context immediately reaches the FRAT | Step 1 pass | Pending |
| Engineering Maintenance/Grounded state immediately blocks Pilot / Ops selection | Step 1 pass | Pending |
| Club Admin role/status safeguards remain enforced | Automated coverage; visual exit pending | Pending |
| Reload resets simulated changes and does not imply persistence | Expected prototype behavior | Pending |

## Responsive and accessibility checks

| Check | Desktop exit | Mobile exit |
| --- | --- | --- |
| No horizontal document overflow at 1280 × 900 and 390 × 844 | Pending | Pending |
| Primary actions remain visible and usable | Pending | Pending |
| Status is conveyed with readable text, not color alone | Pending | Pending |
| Keyboard focus can reach primary controls in logical order | Pending | Pending |
| No browser-console errors occur on the critical path | Pending | Pending |

## Exit record

Complete this section only after the full exit pass:

- Verification date: Pending
- Verified commit: Pending
- Preview deployment: Pending
- Must-fix issues remaining: Pending
- Deferred/accepted items: Pending
- Step 2 outcome: Pending
