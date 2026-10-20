# SafeRoute Academy

SafeRoute Academy is a React + Vite aviation safety and training prototype for exploring flight-school and flying-club workflows. It demonstrates how pilot training/currency records and aircraft engineering status can inform pre-flight risk assessment using PAVE (Pilot, Aircraft, enVironment, External pressures) and a Flight Risk Assessment Tool (FRAT).

**Status: demo / prototype for workflow evaluation and tester feedback.** The club workspaces use simulated records and browser-session-only changes; they are not official operational records or a production club-management system.

## Project links

- [Public tester app](https://www.saferouteacademy.app/)
- [Public repository and current main branch](https://github.com/marchantlaurie-lgtm/saferoute-academy)
- [Merged PR #1 — Academy Ops prototype: Admin, CFI, Engineering and FRAT integration](https://github.com/marchantlaurie-lgtm/saferoute-academy/pull/1)
- [Vercel branch preview](https://saferoute-academy-git-academy-engineering-cfi-4aa47c-saferoute1.vercel.app)
- [Vercel project](https://vercel.com/saferoute1/saferoute-academy)
- [Tester feedback form](https://marchantlaurie-lgtm.github.io/Saferoute-feedback/saferoute_academy_feedback_form.html)

PR #1 is merged and its prototype capabilities are present in `main`. Its original description includes pre-merge wording about leaving main unchanged and remaining draft; that wording records the development stage at the time, rather than the current merge state. Merging the code does not change its demo/prototype status.

## Current prototype capabilities

| Workspace | Demonstrated capabilities |
| --- | --- |
| Club Admin | Club-wide training, fleet and access overview; session-only role and account-status changes; safeguards against removing or suspending the final active admin; locked beta safety policies and recent prototype activity. |
| CFI / Training | Review pilot currency and checks, record a check/sign-off, and change aircraft-type authorisations. Changes update the shared pilot record used by Pilot / Ops in the same session. |
| Engineering | Review aircraft states, defects, restrictions and maintenance context; change aircraft availability and demonstrate return to service. An open grounding / “do not fly” defect must be closed before a serviceable state can be recorded. Changes update Pilot / Ops in the same session. |
| Pilot / Ops and PAVE/FRAT | Select a pilot and eligible aircraft, then start an assessment with record-derived context from the shared CFI and Engineering data. |

CFI sign-off and Engineering return-to-service authority remain in their specialist workspaces. Club Admin provides oversight and system access; it does not replace those specialist actions.

The Ops/FRAT integration:

- Blocks grounded or in-maintenance aircraft, any open grounding / “do not fly” defect, missing aircraft-type authorisation and non-current training records, rather than treating these prohibitions as ordinary score increases.
- Prefills record-backed answers for recent flying hours, last-flight recency, training/check status and aircraft defects, with source context and Academy-versus-pilot answer labels.
- Shows the simulated aircraft's recorded defects and restrictions, plus advisories for approaching checks, pending sign-off and scheduled maintenance due soon. Maintenance due soon does not independently add FRAT points.
- Leaves sleep, IMSAFE, aircraft familiarity, weather and external pressures for pilot input.

## Demo limitations and tester access

The flight-school/club login is a workspace selector demonstrating a planned integration, not a live organisation login. Club users, pilots, instructors and fleet records are fabricated examples. Workspace changes are held only for the current browser session; no real club records or durable operational audit trail are connected to these workflows. Production permission controls and immutable instructor audit records remain future work.

The prototype's selection gates, role controls, sign-offs and return-to-service actions demonstrate workflow behaviour; they do not establish real-world permissions, pilot eligibility or aircraft airworthiness.

**External testers should use [www.saferouteacademy.app](https://www.saferouteacademy.app/).** The workspace selector, Club Admin, CFI / Training, Engineering and Pilot / Ops demo are publicly accessible there without a username or password. This was rechecked on 20 October 2026. The separate Vercel branch-preview URL may still require Vercel team sign-in and is not the recommended tester route.

Suggested tester focus: Club Admin access controls and authority boundaries; CFI currency, sign-off and authorisation changes; Engineering states, defects and restrictions; propagation into Ops/FRAT; and the clarity of red blockers, amber advisories and pilot-entered fields.

## Verification state

A fresh functional and data audit was completed on 20 October 2026:

- `npm test` — 28 passing tests; `npm run lint` and `npm run build` successful.
- Public tester access verified without username/password prompts for Club Admin, CFI / Training, Engineering and Pilot / Ops.
- Final-active-admin safeguard verified in Club Admin.
- CFI sign-off propagation into Pilot / Ops and the Academy-prefilled FRAT verified end to end.
- Engineering grounding-defect protection verified: return to service stays locked until the grounding defect is closed, and Pilot / Ops independently blocks conflicting aircraft records.
- Ops-launched FRAT now returns to Pilot / Ops, and a visible return control is retained when a tester continues into the main Academy application.
- Session-relative demo dates replace fixed dates so due-soon and recency labels do not become internally inconsistent.
- Mobile header and weather-map/sidebar layering checked at a 375-pixel viewport.

The build still reports a non-blocking JavaScript chunk-size warning. These checks validate the current prototype workflows; they are not a production-airworthiness, regulatory-compliance or security certification.

## Repository structure

| Path | Purpose |
| --- | --- |
| `src/App.jsx` | Main application, prototype workspaces, shared session state and FRAT interface. |
| `src/lib/academy-frat.js` | Academy-derived FRAT answers, context, advisories and eligibility gates. |
| `src/lib/club-admin.js` | Club role/status updates, last-admin safeguards and overview summaries. |
| `src/lib/` | Supporting weather, airfield, icing and FRAT-control logic. |
| `src/components/uk-weather-map.jsx` | UK weather-map component. |
| `src/main.jsx`, `src/*.css`, `src/assets/`, `public/` | Application entry point, styling and assets. |
| `test/` | Node test suites for the extracted logic. |
| `package.json`, `vite.config.js`, `eslint.config.js` | Development scripts, Vite and lint configuration. |

## Local development

```sh
npm ci
npm run dev
```

Available verification and preview commands:

```sh
npm test
npm run lint
npm run build
npm run preview
```

`npm run preview` serves the local production build after `npm run build`; it does not change the prototype's functional status. The application reads `VITE_BACKEND_URL` when supplied and otherwise uses the backend URL configured in `src/App.jsx`. The club workspaces described above remain simulated session-only workflows.
