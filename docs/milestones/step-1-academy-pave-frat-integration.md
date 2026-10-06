# Step 1 milestone — Academy → PAVE/FRAT integration

Status: complete on `academy-engineering-cfi-prototype`  
Scope: controlled, simulated beta only; no production data or authoritative operational records

## Completed behavior

- The Pilot section auto-fills valid 90-day hours, time since last flight, and CFI training/check status from the shared in-session Academy record.
- Overdue/non-current training maps to **Lapsed or unsure** and displays a separate **CFI intervention required** warning. The FRAT remains available as a decision-support review; completing it does not authorise the flight.
- The Aircraft section auto-fills known open defects and restrictions from the shared in-session Engineering record, including the defect identifier and operational restriction.
- Grounded and maintenance aircraft cannot be selected for a FRAT.
- Aircraft types absent from the selected pilot's CFI authorisation record cannot be selected. A CFI must record the checkout/authorisation first.
- Due-soon training, pending sign-off, and scheduled maintenance are advisory unless the underlying record directly changes a scored PAVE answer.
- Sleep, IMSAFE, aircraft familiarity, performance, fuel, weather relative to personal minima, and external pressures remain pilot-entered.
- Each answer is visibly marked **Academy auto-fill**, **Pilot entered**, or **Pilot input required**. Overriding an auto-fill retains the Academy source context.
- The flight-school workflow and integrated FRAT retain the demo/prototype and simulated-data labelling.

## Guardrails verified

- Missing, invalid, or future-dated Academy values are not silently converted into auto-filled answers; the affected field stays manual and a confirmation advisory is shown.
- Closed Engineering defects do not add risk, including records whose status uses different letter casing.
- A due-soon maintenance interval does not create a separate FRAT score.
- The existing CFI and Engineering workspaces continue to update the same browser-session records consumed by Pilot / Ops.

## Acceptance scenarios

| Scenario | Expected result |
| --- | --- |
| Jordan Reyes + N172SR | Four Academy answers auto-filled; human-only PAVE factors remain manual. |
| Alicia Chen + N44TR | Due-soon training and `DEF-0047` / Day VFR restriction are visible and scored; scheduled maintenance remains advisory. |
| Sarah Kim + N721CT | Flight-review field auto-fills as lapsed/unsure with a CFI-action warning; FRAT is review support, not flight authorisation. |
| Any pilot + N9DA | Aircraft is visibly grounded and cannot be selected. |
| Pilot without the selected type in `aircraftAuth` | Aircraft cannot be selected until the shared CFI record is updated. |
| Pilot overrides an Academy answer | Answer changes to Pilot entered while the Academy source detail remains visible. |

## Verification commands

Run from the repository root:

```text
npm test
npm run lint
npm run build
```

The Vercel branch preview must also be checked through the flight-school Pilot / Ops path at desktop and mobile widths before Step 2 starts.

## Explicitly deferred

Persistent storage, real authentication and role enforcement, immutable auditing, and a separate closed-beta deployment are later milestones in the agreed sequence. This Step 1 implementation remains in-memory and session-only.
