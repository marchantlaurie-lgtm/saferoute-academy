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

## Follow-up display refinement

Additional feedback received on 7 October 2026 identified three presentation issues in the new display modes:

1. The **Synthetic Private Demo** message did not appear optically centred because the reset control occupied only the right side of the banner.
2. Yellow **Due Soon** text did not have enough contrast against the yellow-tinted boxes in Light mode.
3. Red **Action Required** text did not have enough contrast against the red-tinted boxes in Light mode.

The notice now uses a balanced three-column desktop layout, keeping the warning copy centred independently of the reset control. On phone-width screens it becomes a centred single-column layout. Warning and danger states now use theme-specific backgrounds, borders and text colours, with substantially darker yellow and red lettering in Light mode while retaining bright lettering in Dark mode.

The revised CFI dashboard was visually checked in Light and Dark modes, including Due Soon and Action Required summary cards, pilot rows, status labels, record fields and action buttons. The centred notice and controls were also checked at a 390 × 844 viewport. The full 34-test suite, lint and production build passed, and the tested browser path reported no console warnings or errors.
