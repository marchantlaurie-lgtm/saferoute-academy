# CFI beta feedback — logout navigation and display appearance

Date addressed: 7 October 2026

Branch: `academy-engineering-cfi-prototype`

Production and `main`: unchanged

## Feedback received

1. A CFI could not identify a reliable way to leave a workspace and return to the Flight School / Club role-selection screen.
2. A CFI requested an Apple iOS-style display choice for System, Light and Dark appearance.

## Change completed

- Replaced the subdued workspace back control with a clearly labelled, high-contrast **Log out** action in Pilot / Ops, CFI, Engineering and Club Admin headers.
- Kept a persistent **Log out** action available when a Pilot / Ops tester continues into the Academy, location selection, E6B or FRAT workflow.
- Every school-session logout returns to the role-selection screen containing Pilot / Ops, Club Admin, Independent CFI / Training Trial and Engineering.
- Added a persistent **Display** settings button throughout the app.
- Added System, Light and Dark choices in an iOS-style three-option selector.
- System follows the device colour-scheme setting; explicit Light or Dark selections remain fixed.
- The appearance choice is stored only on the tester's current device and does not enter the shared aviation-data workspace.
- Added theme-aware colours across the Academy and demo workspaces, including separate accessible accent colours for light backgrounds.
- Corrected the CFI and Engineering record grids so they collapse to one column on phones instead of causing horizontal scrolling.

## Verification

- Automated appearance tests cover supported choices, invalid-value fallback and System behaviour.
- All existing Academy, FRAT, Club Admin and persistence tests remain in the full test run.
- Desktop visual checks passed in Light and Dark modes.
- The appearance choice survived a full reload.
- CFI logout returned to the Flight School / Club role-selection screen.
- The Pilot / Ops logout remained visible after continuing into the wider Academy and returned to the same role-selection screen.
- At 390 × 844, the CFI dashboard had no horizontal document overflow and the logout/display controls remained available.
- Browser-console check on the tested paths reported no warnings or errors.

This is a controlled-beta usability response. It does not start Step 4 authentication/roles and does not authorise production promotion.
