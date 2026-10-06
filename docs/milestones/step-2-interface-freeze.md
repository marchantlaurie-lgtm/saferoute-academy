# Step 2 milestone — interface freeze

Status: **complete on 6 October 2026**

Original application UI baseline: `1d9677a0f0a06c2f77b00d97be059f820a7838ca` on `academy-engineering-cfi-prototype`

Verified exit baseline: `e0ad49259213fdbb227d0d01a7cec8c08b33fd38` on `academy-engineering-cfi-prototype`

Preview baseline: [academy-engineering-cfi-prototype](https://saferoute-academy-git-academy-engineering-cfi-4aa47c-saferoute1.vercel.app/)  
Production: unchanged; no promotion is authorised by this milestone

Documentation-only commits do not move the application UI baseline. The exit baseline replaces the original baseline only because the approved STEP2-004 responsive defect correction changed the mobile toolbar presentation.

## Purpose

Step 2 stops interface expansion long enough to establish a stable beta contract for the persistent-data work in Step 3. It protects the workflows already demonstrated in Step 1 while allowing defects and accessibility problems to be corrected.

## Frozen interface scope

The freeze covers:

- Account-type selection and all beta/demo labelling.
- Personal Academy navigation, airfield intelligence, weather displays, E6B, and standalone FRAT access.
- Flight School / Club login and workspace selection.
- Pilot / Ops pilot and aircraft selection.
- CFI / Training, Engineering, and Club Admin workspaces.
- Academy → PAVE/FRAT auto-fill, advisories, blockers, pilot overrides, controls, and residual-risk review.
- Existing responsive behavior at desktop and mobile widths.

## Changes allowed during the freeze

- Fix a reproducible defect that breaks or misrepresents a frozen workflow.
- Correct safety-significant wording or behavior.
- Correct accessibility, responsive-layout, or browser-compatibility problems.
- Add or strengthen tests and diagnostic coverage.
- Make non-visible preparation for Step 3 when it preserves the frozen interface contract.
- Update documentation and the triage record.

## Changes requiring an explicit freeze exception

- New screens, dashboards, navigation areas, roles, or workspaces.
- New FRAT questions, scoring thresholds, or risk categories.
- New visible data fields or major changes to page layout.
- Feature ideas that are not required to correct a verified defect.
- Any production deployment or promotion.

An exception must state the problem, why the current interface cannot support the required behavior, the smallest proposed change, and the regression impact. It must be recorded in the Step 2 triage log before implementation.

## Entry verification

Completed on 6 October 2026:

- `npm test`: **27 passed, 0 failed**.
- `npm run lint`: passed with no findings.
- `npm run build`: passed; the existing bundle-size advisory is triaged as non-blocking.
- Step 1 desktop/mobile and shared-session acceptance evidence remains valid for the frozen application commit.
- No open issue is currently classified **Must fix before Step 3**.

## Exit criteria

All exit criteria were met on 6 October 2026:

1. Every item in the [Step 2 regression checklist](../testing/step-2-regression-checklist.md) has an exit result at desktop and mobile widths where applicable.
2. Every finding appears in the [Step 2 interface triage log](../triage/step-2-interface-triage.md).
3. All **Must fix before Step 3** items are closed and re-tested.
4. Deferred items have an owner milestone or an explicit accepted-prototype rationale.
5. The final prototype-branch Vercel preview is Ready and passes the frozen critical path without browser-console errors.
6. This document is updated from **active** to **complete**, with the final commit and verification date.

## Exit verification

- The complete frozen critical path passed on desktop at 1280 × 900 and mobile at 390 × 844.
- Academy → FRAT auto-fill, advisories, aircraft-state blockers, type-authorisation intervention, pilot overrides, manual human-factor fields, controls, and residual risk all passed.
- CFI and Engineering changes propagated immediately across the shared in-session data model; Club Admin safeguards passed; reload reset the disclosed simulated state.
- Personal Academy navigation, hazard and CFI content, weather, E6B, and standalone FRAT passed.
- STEP2-004, a 47px mobile toolbar overflow, was the only must-fix finding. Its mobile-only compact-toolbar correction retained every action, accessible label, `BETA` label, and live-status text. Desktop layout remained unchanged.
- `npm test` passed 27/27, lint passed, and the production build passed with only deferred STEP2-001.
- The verified exit-baseline Vercel deployment is Ready and its desktop/mobile critical paths produced no browser-console errors.
- Production and `main` were not changed.

## Relationship to Step 3

Step 3 may now begin. Its persistent-database foundation should sit behind this frozen interface unless a documented data-model conflict requires a new exception. Authentication and role enforcement remain the following milestone in the agreed sequence.
