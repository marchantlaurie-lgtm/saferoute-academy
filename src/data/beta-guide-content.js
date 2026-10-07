export const BETA_GUIDE_UPDATED = "7 October 2026";

export const QUICK_START_GUIDES = [
  {
    id: "pilot-ops",
    icon: "🧑‍✈️",
    title: "Pilot / Ops",
    purpose: "Select a fictional pilot and aircraft, see what Academy already knows, and complete an integrated PAVE/FRAT risk review.",
    steps: [
      "Open the beta, choose Flight School / Club, then Pilot / Ops Login.",
      "Read the Synthetic Private Demo notice. Use only the fictional records already provided.",
      "Select a pilot first. Review their 90-day hours, currency and role shown in the roster.",
      "Select an aircraft. Green aircraft are serviceable; yellow aircraft have restrictions or open defects; maintenance, grounded or unauthorised aircraft cannot be selected.",
      "Read any CFI Action Required, advisory or blocked message before continuing.",
      "Choose Start Pre-Flight Risk Assessment. Academy will pre-fill only record-backed answers and will show their source.",
      "Complete every Pilot, Aircraft, Environment and External Pressures question. Sleep, IMSAFE, weather against personal minima, performance, fuel and external pressure remain pilot-entered.",
      "Review the initial result, continue to Risk Controls, record a real control for each material factor, and enter the condition that will exist after that control.",
      "Open the Initial → Residual Summary. Treat it as decision support, not permission to fly.",
      "Use Back to return, Continue to SafeRoute Academy for airfield tools, or Log Out to choose another role.",
    ],
    testFocus: [
      "Is it obvious why an aircraft is available, restricted or blocked?",
      "Can you distinguish Academy auto-fill from pilot-entered answers?",
      "Do the controls and residual-risk stages make sense without explanation?",
      "Does the workflow support a pilot/CFI decision without appearing to make it for them?",
    ],
    cautions: [
      "A completed FRAT does not make an aircraft airworthy, restore pilot currency or authorise a flight.",
      "Do not enter real pilot, medical, aircraft, maintenance or operational information.",
    ],
  },
  {
    id: "club-admin",
    icon: "🏛",
    title: "Club Admin",
    purpose: "Review the fictional organisation, user access, overall readiness indicators and recent prototype activity.",
    steps: [
      "Open the beta, choose Flight School / Club, then Club Admin.",
      "Use the summary cards to scan active users, pilots requiring action, checks due soon, aircraft availability and open defects.",
      "Select a fictional user in Users & Access. Review their current status, workspace roles and any linked pilot record.",
      "Use the role buttons to add or remove Pilot / Ops, Club Admin, CFI / Training or Engineering access.",
      "Use the Active / Suspended control to test access-state changes. The demo protects the final active Club Admin from being removed or suspended.",
      "Review Organisation / Test Settings. Note that external invitations are disabled and this is not the official operational record.",
      "Review Recent Prototype Activity to see combined Admin and Engineering events.",
      "Log out and re-enter Club Admin to confirm that the fictional changes persist.",
    ],
    testFocus: [
      "Are the difference between access control and operational authority clear?",
      "Can you quickly identify users or operational areas needing attention?",
      "Are the safeguards around the last active administrator understandable?",
      "Does the activity view provide useful oversight without implying a production-grade audit log?",
    ],
    cautions: [
      "Admin role changes do not change pilot currency, CFI authorisation, defects or aircraft serviceability.",
      "Named identity enforcement and real invitations are planned for Step 4 and are not active in this beta.",
    ],
  },
  {
    id: "cfi",
    icon: "🎓",
    title: "CFI / Training",
    purpose: "Review fictional pilot readiness, act on due or non-current training, and manage aircraft-type authorisations.",
    steps: [
      "Open the beta, choose Flight School / Club, then Independent CFI / Training Trial.",
      "Scan the Current, Due Soon, Action Required and Awaiting Sign-off summary cards.",
      "Select a pilot. Yellow records need attention soon; red records require intervention. The highlighted field explains why.",
      "Review 90-day hours, last flight, club currency, next check, medical summary and last check.",
      "Under Aircraft Authorisations, select or clear fictional aircraft types to test what the pilot may choose in Pilot / Ops.",
      "Use Record Check / Sign Off to make the selected pilot current and clear a pending sign-off.",
      "Use Mark Due Soon to create an advisory state, or Require Training to create an Action Required state.",
      "Log out, enter Pilot / Ops, select the same pilot and confirm the updated training status and aircraft permissions are applied.",
      "Start a risk review and check that training/recency context is visible while human-only factors remain manual.",
    ],
    testFocus: [
      "Can a CFI immediately see who needs action and the exact reason?",
      "Are Current, Due Soon, Action Required and Awaiting Sign-off distinct enough?",
      "Is changing an aircraft authorisation understandable and appropriately serious?",
      "Does the resulting Pilot / Ops and FRAT behaviour match what you would expect?",
    ],
    cautions: [
      "These are fictional demonstration sign-offs, not regulatory endorsements or training records.",
      "The beta currently demonstrates the workflow; Step 4 will add identity-linked permissions and Step 5 a stronger audit trail.",
    ],
  },
  {
    id: "engineering",
    icon: "🔧",
    title: "Engineering",
    purpose: "Change fictional aircraft state, report or close defects, and see the effect in Pilot / Ops.",
    steps: [
      "Open the beta, choose Flight School / Club, then Engineering Login.",
      "Use the summary cards to scan serviceable, restricted and unavailable aircraft plus open defects.",
      "Select an aircraft from the Fleet list and review its type, hours, current state and maintenance information.",
      "Use Update Aircraft State to choose Serviceable, Restricted, Maintenance or Unserviceable.",
      "Review existing defects and their restriction text. Use Close only on a fictional defect you intend to test.",
      "Enter a clearly fictional discrepancy and choose Add to create a new reported defect.",
      "Use Record 100-Hour Complete to test the maintenance counter/history workflow, or Return to Service to restore the fictional aircraft.",
      "Review the aircraft Audit Trail for the actions you just performed.",
      "Log out, enter Pilot / Ops and confirm restricted aircraft show their context while maintenance or unserviceable aircraft are blocked.",
      "If appropriate, start a FRAT with a restricted aircraft and confirm the defect/restriction context appears in the Aircraft section.",
    ],
    testFocus: [
      "Is the difference between Serviceable, Restricted, Maintenance and Unserviceable unambiguous?",
      "Does a defect contain enough context for a pilot to understand the operational effect?",
      "Are blocked aircraft clearly unavailable rather than merely assigned extra risk points?",
      "Does the Engineering-to-Pilot/FRAT hand-off behave as expected?",
    ],
    cautions: [
      "Return to Service is a fictional workflow control and is not a regulatory maintenance release.",
      "Do not enter real defects, registrations, technical logs or maintenance information.",
    ],
  },
];

export const FULL_GUIDE_SECTIONS = [
  {
    id: "before-you-start",
    title: "1. Before you start",
    paragraphs: [
      "SafeRoute Academy is a controlled functional beta for usability and workflow testing. It is not an operational flight-school system and must not be treated as an authoritative aviation record.",
      "The Flight School / Club area uses a shared, resettable fictional school. Changes can persist and may be seen by other invited testers, which allows an Engineering or CFI change to be checked from Pilot / Ops.",
    ],
    items: [
      "Do not enter real names, contact details, medical details, licence information, aircraft registrations, defects, maintenance information or live operational data.",
      "Do not use the beta to release an aircraft, sign a regulatory record, establish legal currency or make a real go/no-go decision.",
      "Avoid Reset Demo Data unless the test coordinator has asked you to use it; resetting affects the shared fictional workspace.",
      "Use the in-app Feedback control to report unclear wording, unsafe assumptions, missing information or awkward workflow.",
    ],
  },
  {
    id: "access-navigation",
    title: "2. Opening the beta and moving around",
    paragraphs: [
      "The first screen asks how you are using SafeRoute Academy. Personal opens the existing airfield, weather, E6B and FRAT tools. Flight School / Club opens the integrated fictional school used for role-based testing.",
    ],
    items: [
      "Choose Flight School / Club to reach Pilot / Ops, Club Admin, Independent CFI / Training Trial and Engineering.",
      "Use Log Out in a role workspace to return to this role-selection screen. A floating Log Out remains available after Pilot / Ops continues into the wider Academy.",
      "Use Display at the lower right to choose System, Light or Dark appearance. The preference is saved only on the current device.",
      "Use Guide at the lower right to reopen this guide from any screen.",
      "Back returns from FRAT or E6B to the previous Academy area; Change Location returns to the Academy region selector.",
    ],
  },
  {
    id: "shared-workspace",
    title: "3. Understanding the shared fictional workspace",
    paragraphs: [
      "Pilot, aircraft, access, CFI and Engineering screens are different views of the same synthetic workspace. This is the central concept the beta is testing.",
    ],
    items: [
      "CFI changes can alter pilot training status and aircraft-type authorisation in Pilot / Ops.",
      "Engineering changes can alter aircraft availability, restriction context and FRAT aircraft information.",
      "Club Admin access changes persist but do not grant operational sign-off or engineering authority.",
      "Cloud Saved means the fictional workspace was saved successfully. Saving Changes means an update is being written. Save Needs Attention means the app has reported a persistence problem.",
      "The current beta does not yet identify each tester by a named login. Step 4 is intended to add authentication and enforced role-specific access.",
    ],
  },
  {
    id: "pilot-ops-workspace",
    title: "4. Pilot / Ops workspace",
    paragraphs: [
      "Pilot / Ops demonstrates how shared school records can shape aircraft selection and pre-flight risk review without allowing a FRAT score to override a prohibition.",
    ],
    items: [
      "Select a pilot first. Their card shows role, 90-day hours and currency summary.",
      "Then select an aircraft. Serviceable aircraft appear green; restrictions or open defects appear yellow; maintenance and grounded aircraft are red and blocked.",
      "An aircraft type missing from the pilot's CFI authorisations is blocked and marked CFI Authorisation Required.",
      "A non-current pilot can open a structured risk review with a clear CFI Intervention Required warning, but completing it does not restore currency or authorise flight.",
      "Start Pre-Flight Risk Assessment opens the integrated FRAT for the selected pilot/aircraft pair.",
      "Continue to SafeRoute Academy opens the wider location, weather, hazards, E6B and standalone FRAT tools.",
    ],
  },
  {
    id: "frat",
    title: "5. PAVE/FRAT risk review",
    paragraphs: [
      "The FRAT is structured around PAVE: Pilot, Aircraft, enVironment and External Pressures. It records an initial assessment, specific controls and a residual assessment. It supports judgement; it never makes or authorises the flight decision.",
    ],
    items: [
      "Stage 1 — Initial Risk: answer every question. Academy Auto-Fill identifies facts taken from the shared records; Pilot Entered identifies your selections.",
      "Record-backed items may include 90-day hours, time since last flight, training/check status and known aircraft defects or restrictions.",
      "Sleep, IMSAFE, weather relative to personal minima, performance, fuel, airport/route judgement and external pressures remain manual.",
      "Changing an auto-filled answer records a pilot override while leaving the Academy source context visible.",
      "Stage 2 — Risk Controls: for each factor scoring 2 or 3, choose one or more genuine controls or state that the risk is retained. A note by itself may document review but cannot automatically reduce the risk.",
      "After recording a valid control, enter the condition that will actually exist after the control. Do not lower the residual score unless the control genuinely changes the factor.",
      "Stage 3 — Residual Risk: compare the locked initial assessment with the residual result and recorded controls. Green, Yellow and Red describe accumulated risk ranges, not clearances to fly.",
      "Start Over returns to the original shared-data auto-fill. Edit Initial Assessment unlocks the first-stage answers and clears later control work.",
    ],
  },
  {
    id: "academy-tools",
    title: "6. Academy airfield, weather and planning tools",
    paragraphs: [
      "The wider Academy can be entered through Personal or through Continue to SafeRoute Academy in Pilot / Ops. It is educational decision support and must be cross-checked against current official sources.",
    ],
    items: [
      "Choose a region and airfield, or search by ICAO code/name. The sidebar also provides regional shortcuts and a flight-phase filter.",
      "The airfield header summarises location, airspace class, runway information and recorded threat counts.",
      "Live Weather shows the current feed state and labels stale, retained, nearby-station or unavailable observations. Do not treat stale or nearby data as an on-airport current observation.",
      "US airfields show density-altitude support; UK airfields show cloud-base/icing awareness. These are estimates and do not replace POH/AFM performance work or official weather products.",
      "The weather layer provides radar or icing-awareness context depending on region. Map imagery and estimates require independent verification.",
      "Threats contains expandable local hazard cards. ATC & Airspace and CFI Notes provide briefing prompts, not current clearances or authoritative instructions.",
      "W-A-N-T organises Weather, Aircraft/performance, NOTAM reminder and Threats. Academy does not ingest live NOTAMs; use the linked official service.",
      "The optional AI summary turns the displayed data into narrative form. It may be useful for discussion but is not the source of the underlying facts.",
      "E6B provides wind/TAS, true-airspeed and time-speed-distance calculations. Cross-check critical results against the POH/AFM and official planning material.",
    ],
  },
  {
    id: "club-admin-workspace",
    title: "7. Club Admin workspace",
    paragraphs: [
      "Club Admin is an oversight and access-control demonstration. It deliberately separates account access from CFI and Engineering authority.",
    ],
    items: [
      "Summary cards show active users, pilots requiring action, checks due soon, available/unavailable aircraft and open defects.",
      "Users & Access lists each fictional account, status and assigned workspace roles.",
      "Selecting a user shows their linked pilot record when one exists. Engineering-only accounts may have no pilot record.",
      "Workspace Access adds or removes demo roles. Active / Suspend changes the user's demo access state.",
      "The final active Club Admin cannot be removed or suspended, preventing the fictional organisation from losing all administrators.",
      "Organisation / Test Settings makes the environment limits visible, including disabled external invitations and the non-authoritative record status.",
      "Recent Prototype Activity combines Admin and Engineering events for oversight. It is not yet an immutable, identity-linked production audit log.",
    ],
  },
  {
    id: "cfi-workspace",
    title: "8. CFI / Training workspace",
    paragraphs: [
      "The CFI workspace is designed around the question: which pilots need attention, why, and what action changes their readiness record?",
    ],
    items: [
      "Summary cards separate Current, Due Soon, Action Required and Awaiting Sign-off.",
      "The pilot list highlights yellow and red records. Select a pilot to see the exact field causing the status.",
      "The detail view shows 90-day hours, last flight, club currency, next check, medical summary and last check.",
      "Aircraft Authorisations toggles the aircraft types the selected pilot can choose in Pilot / Ops.",
      "Record Check / Sign Off makes the fictional record current, clears pending sign-off and records the current date as the last check.",
      "Mark Due Soon creates an advisory state. Require Training creates an Action Required state and feeds the shared Pilot / Ops/FRAT context.",
      "These actions are demonstrations only and are not instructor endorsements, logbook entries or regulatory records.",
    ],
  },
  {
    id: "engineering-workspace",
    title: "9. Engineering workspace",
    paragraphs: [
      "Engineering demonstrates how aircraft state and defect context can control Pilot / Ops selection and inform the Aircraft part of PAVE.",
    ],
    items: [
      "Summary cards show serviceable, restricted and unavailable aircraft plus the number of open defects.",
      "The Fleet list displays each aircraft's current state and hours remaining to scheduled maintenance.",
      "Update Aircraft State applies Serviceable, Restricted, Maintenance or Unserviceable immediately to the shared fictional record.",
      "Maintenance information shows hours remaining, annual/inspection due information and the last 100-hour entry.",
      "Defects / Work in Progress lists the defect identifier, description, status and restriction. Add reports a fictional discrepancy; Close closes a selected fictional defect.",
      "Record 100-Hour Complete updates the fictional inspection entry and resets hours remaining. Return to Service changes the state to Serviceable.",
      "The local Audit Trail shows recent changes for that aircraft. Step 5 is intended to replace this prototype history with a stronger identity-linked audit trail.",
      "Maintenance or unserviceable aircraft are blocked from FRAT selection. Restricted aircraft may be selected only when otherwise eligible, with their context carried into the review.",
    ],
  },
  {
    id: "tester-scenarios",
    title: "10. Recommended end-to-end tests",
    paragraphs: [
      "The most useful feedback comes from completing a whole workflow and then describing where the hand-off felt unclear or unrealistic.",
    ],
    items: [
      "Engineering → Pilot: mark an aircraft Restricted, add a fictional defect, then confirm Pilot / Ops and the FRAT display the restriction context.",
      "Engineering block: mark an aircraft Maintenance or Unserviceable and confirm it cannot be selected in Pilot / Ops.",
      "CFI authorisation: remove a pilot's aircraft-type authorisation and confirm that type is blocked in Pilot / Ops.",
      "CFI currency: mark a pilot Due Soon, then Require Training, and check the yellow/red presentation and FRAT training context.",
      "CFI recovery: Record Check / Sign Off and confirm the shared pilot returns to Current.",
      "Admin oversight: change a fictional user's roles/status and confirm the safeguard and activity messages make sense.",
      "FRAT integrity: override one Academy auto-fill, complete the three stages, and confirm the source, override and initial/residual comparison remain understandable.",
    ],
  },
  {
    id: "feedback-troubleshooting",
    title: "11. Feedback and troubleshooting",
    paragraphs: [
      "Feedback is most valuable when it describes what you expected, what happened and why the difference matters operationally.",
    ],
    items: [
      "Use Feedback in the Academy header. For role workspaces, note the role, selected fictional pilot/aircraft and the action you were attempting.",
      "Report any wording that could imply regulatory approval, airworthiness, currency or authorisation when the beta has not established it.",
      "If changes appear not to save, wait for Cloud Saved. If Save Needs Attention remains visible, report the screen and action rather than entering the data again repeatedly.",
      "If the layout is hard to read, include the device/browser and whether System, Light or Dark display was selected.",
      "If a shared record was changed by another tester, choose another fictional record or coordinate the test; do not replace it with real data.",
      "If you become lost, use Log Out to return to role selection or reload the link to return to the opening choice.",
    ],
  },
  {
    id: "not-in-beta",
    title: "12. What this beta does not yet provide",
    paragraphs: [
      "The beta intentionally proves the shared-data workflow before claiming production readiness.",
    ],
    items: [
      "No named user authentication or enforced real-world identity/role permissions yet.",
      "No real school invitations or independent organisation workspaces.",
      "No authoritative maintenance release, technical log, training sign-off or regulatory record.",
      "No immutable identity-linked audit trail yet.",
      "No live NOTAM ingestion and no replacement for official weather, briefing or flight-planning services.",
      "No guarantee that a green FRAT result means a flight is safe, legal or authorised.",
      "No production privacy, backup, recovery and operational-support commitment yet.",
    ],
  },
];

export const GUIDE_IDS = ["full", ...QUICK_START_GUIDES.map(guide => guide.id)];

export function normaliseGuideId(value) {
  return GUIDE_IDS.includes(value) ? value : "full";
}
