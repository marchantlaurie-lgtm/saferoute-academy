# SafeRoute Academy controlled beta — complete How To guide

Updated: 7 October 2026

Beta link: [Open SafeRoute Academy with the full guide](https://saferoute-academy-git-academy-engineering-cfi-4aa47c-saferoute1.vercel.app/?guide=full)

## 1. Purpose and boundaries

SafeRoute Academy is a controlled functional beta for evaluating aviation-safety workflows. It is not an operational flight-school system, an authoritative record or a substitute for official information and professional judgement.

The Flight School / Club area uses one shared, resettable fictional flight school. This lets a tester make a fictional Engineering or CFI change and then see the effect from Pilot / Ops. Because the workspace is shared, changes may be visible to other invited testers.

Do not enter real:

- names, email addresses or contact details;
- medical, licensing or training information;
- aircraft registrations, defects, restrictions or technical-log information;
- maintenance releases, inspections or engineering records;
- flight plans, live operations or other personal/operational data.

Do not use the beta to release an aircraft, establish legal currency, complete a regulatory sign-off or make a real go/no-go decision. Avoid **Reset Demo Data** unless the test coordinator asks you to use it, because reset affects the shared fictional workspace.

## 2. Opening the beta

The opening screen offers two paths:

- **Personal** — the existing Academy airfield, weather, hazard, E6B and standalone FRAT tools.
- **Flight School / Club** — the shared fictional organisation and its Pilot / Ops, Club Admin, CFI / Training and Engineering workspaces.

Choose **Flight School / Club** for the integrated beta. No account or password is currently required; named authentication and enforced role permissions are planned for Step 4.

Common controls:

- **Log Out** returns from a role workspace to the role-selection screen.
- A floating **Log Out** remains available after Pilot / Ops continues into the wider Academy.
- **Guide** opens the full guide and role Quick Starts from any screen.
- **Display** selects System, Light or Dark appearance on the current device.
- **Back** returns from FRAT or E6B to Academy.
- **Change Location** returns to the Academy region selector.

## 3. Shared fictional workspace

Pilot, aircraft, access, CFI and Engineering screens are different views of the same synthetic workspace:

- CFI changes can alter pilot status and aircraft-type authorisation in Pilot / Ops.
- Engineering changes can alter aircraft availability and the context shown in Pilot / Ops and FRAT.
- Club Admin changes access roles/status but do not create CFI or Engineering authority.
- **Cloud Saved** means the fictional workspace was saved successfully.
- **Saving Changes** means an update is being written.
- **Save Needs Attention** means a persistence problem was reported and should be included in feedback.

## 4. Pilot / Ops

1. Choose **Pilot / Ops Login**.
2. Read the Synthetic Private Demo notice.
3. Select a fictional pilot. The card shows role, 90-day hours and currency summary.
4. Select an aircraft after selecting the pilot.

Aircraft presentation:

- Green — serviceable.
- Yellow — restricted or carrying open defect context.
- Red — maintenance or grounded/unserviceable and blocked.
- **CFI Authorisation Required** — the pilot is not authorised for that aircraft type and it is blocked.

A non-current pilot may open a structured risk review with a **CFI Intervention Required** warning, but completing that review does not restore currency or authorise the flight.

Choose **Start Pre-Flight Risk Assessment** for the integrated pilot/aircraft FRAT. Choose **Continue to SafeRoute Academy** to explore airfield, weather, threat and planning tools without starting the integrated review.

## 5. PAVE/FRAT

The FRAT follows PAVE: Pilot, Aircraft, enVironment and External Pressures. It has three stages.

### Stage 1 — Initial Risk

Answer every question. Labels distinguish:

- **Academy Auto-Fill** — a record-backed answer from the selected fictional pilot/aircraft.
- **Pilot Entered** — an answer selected by the tester.
- **Pilot Input Required** — unanswered human judgement.

Auto-fill can include 90-day hours, time since last flight, training/check status and aircraft defect/restriction context. Sleep, IMSAFE, weather against personal minima, performance, fuel and external pressure remain manual. Changing an auto-fill records a pilot override while leaving the Academy source visible.

The initial Green/Yellow/Red result is an accumulated risk range, not permission to fly.

### Stage 2 — Risk Controls

Factors scoring 2 or 3 generate control cards. For each factor:

1. choose one or more controls that will genuinely be applied, or retain the risk;
2. add notes when useful;
3. select the condition that will actually exist after the control.

A note can document review but does not automatically reduce risk. Do not lower the residual score unless the control genuinely changes the factor.

### Stage 3 — Residual Risk

Review the locked initial answer, the recorded controls and the residual answer side by side. Use **Edit Controls**, **Edit Initial Assessment** or **Start Over** if revision is needed. The result supports the PIC/CFI conversation and never makes the decision.

## 6. Academy airfield and planning tools

Choose a region/airfield or search by ICAO/name. The sidebar contains regional shortcuts and a flight-phase filter.

The Academy page includes:

- airfield/runway/class summary and recorded threat counts;
- live-weather status, METAR/TAF context and explicit stale/retained/nearby/unavailable labels;
- density-altitude support for US fields;
- cloud-base and icing-awareness support for UK fields;
- radar or icing-awareness weather layers;
- expandable **Threats**;
- **ATC & Airspace** briefing notes;
- **CFI Notes**;
- **W-A-N-T**: Weather, Aircraft/performance, NOTAM reminder and Threats;
- an optional AI narrative summary;
- the E6B flight computer;
- the standalone FRAT.

Academy does not ingest live NOTAMs. Use the linked official service. Weather, maps, performance estimates and the AI summary require independent verification and do not replace official briefing, the POH/AFM or CFI/operator review.

## 7. Club Admin

Club Admin demonstrates oversight and access control, not operational sign-off.

- Summary cards show users, pilot attention, due checks, aircraft availability and defects.
- **Users & Access** lists fictional accounts, status and assigned roles.
- Selecting a user shows the linked pilot record when one exists.
- **Workspace Access** adds/removes Pilot / Ops, Club Admin, CFI / Training and Engineering demo roles.
- **Active / Suspend** changes the fictional access state.
- The final active Club Admin cannot be removed or suspended.
- Organisation/Test Settings shows the beta limits and locked safety policies.
- Recent Prototype Activity combines Admin and Engineering events for oversight; it is not an immutable production audit log.

## 8. CFI / Training

The CFI workspace is organised around who needs attention and why.

- Summary cards separate Current, Due Soon, Action Required and Awaiting Sign-off.
- Yellow/red pilot rows highlight attention state.
- Selecting a pilot shows the exact problem field.
- Details include 90-day hours, last flight, club currency, next check, medical summary and last check.
- Aircraft Authorisations toggles the fictional types available to that pilot in Pilot / Ops.
- **Record Check / Sign Off** returns the fictional record to Current and clears pending sign-off.
- **Mark Due Soon** creates an advisory.
- **Require Training** creates Action Required and feeds the shared Pilot / Ops/FRAT context.

These are demo actions, not regulatory endorsements, logbook entries or official training records.

## 9. Engineering

Engineering demonstrates how aircraft state and defect context control Pilot / Ops and inform PAVE Aircraft.

- Summary cards show serviceable, restricted, unavailable and open-defect counts.
- The Fleet list shows state and hours to scheduled maintenance.
- Aircraft State offers Serviceable, Restricted, Maintenance and Unserviceable.
- Maintenance fields show hours remaining, annual/inspection due and last 100-hour.
- Defects show identifier, description, status and restriction.
- **Add** reports a fictional discrepancy.
- **Close** closes a fictional defect.
- **Record 100-Hour Complete** updates the fictional maintenance entry.
- **Return to Service** changes the demo state to Serviceable; it is not a regulatory maintenance release.
- Audit Trail shows recent local aircraft changes.

Maintenance/unserviceable aircraft are blocked in Pilot / Ops. Restricted aircraft can be selected only when otherwise eligible and carry their context into FRAT.

## 10. Recommended end-to-end tests

1. Engineering → Pilot: restrict an aircraft, add a fictional defect, then confirm Pilot / Ops and FRAT show the context.
2. Engineering block: set Maintenance/Unserviceable and confirm selection is blocked.
3. CFI authorisation: remove a type and confirm Pilot / Ops blocks it.
4. CFI currency: move a pilot from Due Soon to Require Training and check the Pilot / Ops/FRAT response.
5. CFI recovery: Record Check / Sign Off and confirm Current returns.
6. Admin oversight: change a fictional user's role/status and review safeguards/activity.
7. FRAT integrity: override an auto-fill, record controls and compare initial/residual results.

## 11. Feedback and troubleshooting

Good feedback states:

- role and fictional record selected;
- what you were trying to do;
- what you expected;
- what occurred;
- why the difference matters operationally;
- device/browser and Light/Dark/System mode if presentation is involved.

Report any wording that could imply airworthiness, legal currency, regulatory sign-off or flight authorisation when the beta has not established it.

If changes do not appear to save, wait for **Cloud Saved**. If **Save Needs Attention** remains, report the screen/action rather than repeatedly re-entering data. If another tester changed a shared record, coordinate or choose another fictional record—never substitute real data.

## 12. Not yet included

- named authentication and enforced identity/role permissions;
- real school invitations or isolated organisation workspaces;
- authoritative maintenance, training or regulatory records;
- immutable identity-linked audit history;
- live NOTAM ingestion;
- production privacy, backup, recovery and operational support;
- any guarantee that a Green result means a flight is safe, legal or authorised.
