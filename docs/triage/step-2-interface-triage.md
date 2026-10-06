# Step 2 interface triage log

Status: **closed on 6 October 2026**

Original baseline: `1d9677a0f0a06c2f77b00d97be059f820a7838ca`

Verified exit baseline: `e0ad49259213fdbb227d0d01a7cec8c08b33fd38`

## Classification rules

- **Must fix before Step 3** — breaks a critical frozen workflow, creates misleading safety behavior, removes a required blocker, or prevents representative desktop/mobile use.
- **Fix during freeze if low risk** — reproducible usability, accessibility, wording, or compatibility issue with a contained correction.
- **Defer** — does not block the frozen beta workflow and is better handled by a named later milestone.
- **Accepted prototype limitation** — deliberate behavior of the simulated, session-only beta and clearly disclosed in the interface.

## Current findings

| ID | Finding | Classification | Disposition |
| --- | --- | --- | --- |
| STEP2-001 | The production build emits a Vite advisory because the main application bundle is slightly above 500 kB before gzip. | Defer | Performance/code-splitting work after the data architecture is stable; the build succeeds and the current interface remains functional. |
| STEP2-002 | CFI, Engineering, Admin, pilot, and aircraft changes reset on reload. | Accepted prototype limitation | Persistence is explicitly deferred to Step 3 and the interface labels the data as simulated/session-only. |
| STEP2-003 | Authentication, permissions, and audit records are simulated rather than authoritative. | Accepted prototype limitation | These are later milestones in the agreed beta sequence and remain clearly labelled. |
| STEP2-004 | At 390px width, the Personal Academy top toolbar extended 47px beyond the viewport, causing horizontal document overflow. | Must fix before Step 3 | Closed on 6 October 2026. The mobile toolbar now uses compact, labelled icon actions and tighter spacing while retaining the visible `BETA` and live-status labels. Desktop layout is unchanged. Re-tested at 390 × 844 with no overflow or console errors. |

## Must-fix queue

No **Must fix before Step 3** issue remains open. STEP2-004 was found during the exit regression, fixed, and re-tested.

## Freeze exception — STEP2-004

- **Why the frozen interface could not support the required behavior:** the existing fixed-width mobile toolbar controls exceeded the available viewport width and caused horizontal document scrolling.
- **Smallest user-visible change:** retain every toolbar action and status, but use compact icon labels for Change location and Feedback on mobile, remove the decorative aircraft tile at mobile width, and reduce mobile-only spacing. Accessible names and hover titles preserve the full action labels.
- **Regression impact:** Personal Academy responsive-layout, primary-action, readable-status, and keyboard-focus rows only. Flight School / Club and desktop layouts are unchanged.
- **Decision:** approved as a responsive defect correction allowed by the Step 2 freeze rules; implemented and verified on 6 October 2026.

## New finding template

Copy this row into the current-findings table before implementing a UI correction:

| ID | Finding | Classification | Disposition |
| --- | --- | --- | --- |
| STEP2-NNN | Reproduction and user impact | Classification | Fix, defer, or accepted rationale; include the target milestone where relevant |

For a freeze exception, also record:

- Why the frozen interface cannot support the required behavior.
- The smallest proposed user-visible change.
- Which regression rows are affected.
- The approving decision and date.
