# Beta tester guidance rebuild

Date addressed: 7 October 2026

Branch: `academy-engineering-cfi-prototype`

Production and `main`: unchanged

## Request

Replace the previous tester guidance with a complete, clear guide suitable for distributing the controlled beta. Provide one detailed **How To** guide and separate **Quick Start** guides for Pilot / Ops, Club Admin, CFI and Engineering testers.

## Completed work

- Added a persistent **Guide** control throughout the beta so help is available from the entry screen and every workspace.
- Added a full in-app How To guide covering access, navigation, the shared synthetic workspace, Pilot / Ops, PAVE/FRAT, Academy tools, Club Admin, CFI, Engineering, test scenarios, feedback, troubleshooting and beta limitations.
- Added four role-specific Quick Start guides:
  - Pilot / Ops
  - Club Admin
  - CFI
  - Engineering
- Added direct guide links that can be sent to individual testers. The link opens the appropriate guide over the beta while leaving the tester free to close it and use the app.
- Added matching standalone Markdown guides under `docs/guides/` so the instructions remain versioned alongside the beta implementation.
- Made the guide responsive for phones and available in both Light and Dark display modes.

## Safety and data boundaries retained

- The guidance identifies the beta as a private, controlled, synthetic demonstration.
- Testers are told to use fictional data only and not to enter real personal, medical, training, maintenance, defect, dispatch or contact information.
- The guidance explains that changes can be shared and persistent inside the synthetic workspace and that reset affects that workspace.
- It does not describe the beta as an authoritative aviation, maintenance, training or regulatory record.
- It distinguishes automated Academy/FRAT inputs from pilot-entered human factors and makes clear that the pilot and instructor retain responsibility for decisions.

## Direct guide routes

- Full How To: `?guide=full`
- Pilot / Ops Quick Start: `?guide=pilot-ops`
- Club Admin Quick Start: `?guide=club-admin`
- CFI Quick Start: `?guide=cfi`
- Engineering Quick Start: `?guide=engineering`

These query values are added to the existing branch-preview URL; testers do not need a separate application or account simply to read a guide.

## Verification

- Automated guide-content checks confirm that all four roles are present, each role contains steps, evaluation points and cautions, the key safety boundary is stated, and direct guide values resolve correctly.
- The complete application test suite passes: **38 tests, 0 failures**. The lint check and production build also pass.
- Desktop and phone-sized visual checks cover the full guide, the four Quick Starts, direct-link opening, closing the guide and Light/Dark presentation.
- Browser-console checks cover the tested guide paths.

## Evidence value

This record preserves the tester request, the resulting usability and safety response, the role-based test instructions and the verification boundary. Together with the dated source history and deployed preview, it provides evidence of structured product development, controlled external testing and documented iteration. It is supporting development evidence only; it is not, by itself, a legal conclusion or guarantee regarding an NIW petition.
