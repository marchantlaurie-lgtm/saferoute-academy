# Step 2 frozen-interface regression checklist

Original freeze baseline: application UI at `1d9677a0f0a06c2f77b00d97be059f820a7838ca`

Verified exit baseline: application UI at `e0ad49259213fdbb227d0d01a7cec8c08b33fd38`

Milestone state: **exit pass complete**

Use the prototype-branch Vercel preview. Do not perform this checklist against production. Record a triage entry for every failure before changing the interface.

## Automated gate

| Check | Entry result | Exit result |
| --- | --- | --- |
| `npm test` | Pass — 27/27 | Pass — 27/27 |
| `npm run lint` | Pass | Pass |
| `npm run build` | Pass — existing bundle-size advisory only | Pass — same triaged advisory only |
| Vercel deployment status | Ready for baseline | Pass — exit baseline Ready |
| Browser console on critical path | No errors on baseline | Pass — no desktop or mobile errors |

## Account selection and labelling

| Check | Entry evidence | Exit result |
| --- | --- | --- |
| Personal and Flight School / Club choices are available | Baseline smoke passed | Pass |
| Flight-school route remains labelled demo/not live | Baseline smoke passed | Pass |
| Specialist workspaces remain labelled prototype/demo | Baseline smoke passed | Pass |
| Session-only and non-authoritative-record limitations remain visible | Baseline smoke passed | Pass |

## Personal Academy

| Check | Desktop exit | Mobile exit |
| --- | --- | --- |
| Region and airfield selection opens the expected Academy view | Pass | Pass |
| Airfield hazards and instructor notes remain readable | Pass | Pass |
| Weather availability/freshness messaging renders without overlap | Pass | Pass |
| E6B opens, accepts input, and returns to Academy | Pass | Pass |
| Standalone FRAT opens with every field manual | Pass | Pass |

## Pilot / Ops and Academy → FRAT

| Check | Entry evidence | Exit result |
| --- | --- | --- |
| Pilot and aircraft can be selected | Step 1 pass | Pass |
| Grounded and Maintenance aircraft cannot be selected | Step 1 pass | Pass |
| Missing aircraft-type authorisation blocks selection with CFI context | Step 1 pass | Pass |
| Jordan Reyes + N172SR produces four Academy auto-fills | Step 1 pass | Pass |
| Alicia Chen + N44TR shows due-soon, defect, restriction, and maintenance advisories | Step 1 pass | Pass |
| Sarah Kim + N721CT auto-fills lapsed/unsure with CFI intervention required | Step 1 pass | Pass |
| Sleep, IMSAFE, familiarity, performance, fuel, weather, and external pressures remain manual | Step 1 pass | Pass |
| Pilot override changes the entry label but preserves Academy source context | Step 1 pass | Pass |
| FRAT controls and residual-risk review remain usable | Automated coverage; visual exit pending | Pass |

## Shared in-session workspaces

| Check | Entry evidence | Exit result |
| --- | --- | --- |
| CFI sign-off immediately changes Pilot / Ops training state | Step 1 pass | Pass |
| CFI aircraft authorisation immediately changes Pilot / Ops eligibility | Step 1 pass | Pass |
| Engineering restriction/defect context immediately reaches the FRAT | Step 1 pass | Pass |
| Engineering Maintenance/Grounded state immediately blocks Pilot / Ops selection | Step 1 pass | Pass |
| Club Admin role/status safeguards remain enforced | Automated coverage; visual exit pending | Pass |
| Reload resets simulated changes and does not imply persistence | Expected prototype behavior | Pass — limitation remains explicit |

## Responsive and accessibility checks

| Check | Desktop exit | Mobile exit |
| --- | --- | --- |
| No horizontal document overflow at 1280 × 900 and 390 × 844 | Pass | Pass after STEP2-004 correction |
| Primary actions remain visible and usable | Pass | Pass |
| Status is conveyed with readable text, not color alone | Pass | Pass |
| Keyboard focus can reach primary controls in logical order | Pass | Pass |
| No browser-console errors occur on the critical path | Pass | Pass |

## Exit record

- Verification date: 6 October 2026
- Verified application commit: `e0ad49259213fdbb227d0d01a7cec8c08b33fd38`
- Preview deployment: [stable prototype-branch preview](https://saferoute-academy-git-academy-engineering-cfi-4aa47c-saferoute1.vercel.app/) — Ready
- Must-fix issues remaining: 0; STEP2-004 is closed and re-tested
- Deferred/accepted items: STEP2-001 deferred; STEP2-002 and STEP2-003 accepted prototype limitations
- Step 2 outcome: **Complete — frozen interface verified for Step 3 entry**
