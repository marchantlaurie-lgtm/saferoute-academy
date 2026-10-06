# Step 2 interface triage log

Status: **open for the active interface freeze**  
Baseline: `1d9677a0f0a06c2f77b00d97be059f820a7838ca`

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

## Must-fix queue

No issue is classified **Must fix before Step 3** at freeze entry.

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
