export const BETA_GUIDE_UPDATED = "20 October 2026";

export const QUICK_START_GUIDES = [
  {
    id: "pilot-ops",
    icon: "🧑‍✈️",
    title: "Students & Pilots",
    purpose: "Use the Academy airfield tools independently, or test how a fictional school record can support aircraft selection and a PAVE/FRAT review.",
    steps: [
      "Choose Personal for the airfield, weather, icing-awareness, E6B and standalone FRAT tools.",
      "For the integrated demo, choose Flight School / Club and then Pilot / Ops Login; no username or password is required.",
      "Select a fictional pilot first and review the role, 90-day hours and currency summary.",
      "Select an aircraft. Green aircraft are serviceable, amber aircraft carry a restriction, and red or unauthorised aircraft cannot be selected.",
      "Read any CFI Action Required, authorisation or aircraft-defect blocker before continuing.",
      "Choose Start Pre-Flight Risk Assessment. Academy pre-fills only facts supported by the shared fictional records and shows their source.",
      "Complete the human-only PAVE questions, including sleep, IMSAFE, weather against personal minima, performance, fuel and external pressure.",
      "For any material factor, record a genuine risk control and then assess the residual condition that will actually remain.",
      "Use Back to return to Pilot / Ops, or Continue to SafeRoute Academy for the wider airfield and planning tools.",
      "Use Guide or Display at the lower right from any screen when you need help or a different appearance.",
    ],
    testFocus: [
      "Is it clear why a pilot or aircraft is available, restricted or blocked?",
      "Can you distinguish Academy auto-fill from pilot-entered judgement?",
      "Do the initial-risk, controls and residual-risk stages make sense without extra explanation?",
      "Does the workflow support a student, pilot or CFI decision without appearing to make it for them?",
    ],
    cautions: [
      "A completed FRAT does not establish currency, make an aircraft airworthy or authorise a flight.",
      "Use only the fictional records provided; do not enter real personal, medical or operational information.",
    ],
  },
  {
    id: "club-admin",
    icon: "🏛",
    title: "Club Admin",
    purpose: "Review the fictional organisation, access roles, overall readiness indicators and the boundary between administration and operational authority.",
    steps: [
      "Choose Flight School / Club and then Club Admin.",
      "Use All to see the directory grouped into Students, Instructors, Staff and Aircraft.",
      "Select Students, Instructors, Staff or Aircraft to hide every unrelated record type.",
      "Select a fictional person and review their account state and workspace roles.",
      "Use the role buttons to add or remove Pilot / Ops, Club Admin, CFI / Training or Engineering access.",
      "Use Active / Suspended to test access-state changes.",
      "Confirm that the final active Club Admin cannot be removed or suspended.",
      "Select Aircraft to review availability, maintenance context and open defects without entering the Engineering workspace.",
      "Confirm that Club Admin aircraft details are read-only and do not expose defect closure or return-to-service controls.",
      "Review Organisation / Test Settings and the locked safety policies.",
      "Review Recent Prototype Activity and note that it is a demonstration rather than an immutable production audit log.",
      "Log out and re-enter another workspace to confirm that access control remains separate from CFI or Engineering authority.",
    ],
    testFocus: [
      "Is the distinction between account access and operational authority clear?",
      "Can you quickly identify users or operational areas requiring attention?",
      "Do the directory filters make larger student, instructor, staff and aircraft lists easier to scan?",
      "Is the final-administrator safeguard understandable?",
      "Does the activity view provide useful oversight without overstating its status?",
    ],
    cautions: [
      "Admin actions do not change pilot currency, aircraft authorisations, defects or airworthiness.",
      "All changes are fictional and last only for the current browser session.",
    ],
  },
  {
    id: "cfi",
    icon: "🎓",
    title: "CFI / Training",
    purpose: "Review fictional student and pilot readiness, act on due or non-current training, and manage aircraft-type authorisations.",
    steps: [
      "Choose Flight School / Club and then CFI / Training.",
      "Scan the Current, Due Soon, Action Required and Awaiting Sign-off summary cards.",
      "Start with Needs Attention, which hides fully current records so the urgent roster remains easy to scan.",
      "Select Action Required, Due Soon, Awaiting Sign-off or Current to show only that category; select All to group everyone in fixed priority order.",
      "Select a student or pilot. Red records require intervention, amber records need attention soon, blue records await sign-off and green records are current.",
      "Review 90-day hours, last flight, club currency, next check, medical summary and last check.",
      "Under Aircraft Authorisations, select or clear fictional aircraft types.",
      "Use Record Check / Sign Off to make the selected record current and clear a pending sign-off.",
      "Use Mark Due Soon to create an advisory state, or Require Training to create an Action Required state.",
      "Log out, enter Pilot / Ops and confirm the updated status and aircraft permissions are applied.",
      "Start a FRAT and confirm training context is visible while human-only factors remain manual.",
    ],
    testFocus: [
      "Can a CFI immediately see who needs action and why?",
      "Do the filters and fixed red, amber, blue and green category colors keep a larger roster easy to scan?",
      "Is changing an aircraft authorisation understandable and appropriately serious?",
      "Does the resulting Pilot / Ops and FRAT behaviour match the CFI record?",
    ],
    cautions: [
      "These are fictional demonstration sign-offs, not regulatory endorsements or training records.",
      "The beta is publicly accessible and session-only; do not enter real student or pilot information.",
    ],
  },
  {
    id: "engineering",
    icon: "🔧",
    title: "Engineering",
    purpose: "Review fictional fleet status, report or close defects, and see the operational effect in Pilot / Ops and the FRAT.",
    steps: [
      "Choose Flight School / Club and then Engineering Login.",
      "Use the summary cards to scan serviceable, restricted and unavailable aircraft plus open defects.",
      "Select an aircraft and review its state, hours, maintenance information and audit trail.",
      "Use Update Aircraft State to choose Serviceable, Restricted, Maintenance or Unserviceable.",
      "Review each open defect and its restriction before changing the aircraft state.",
      "Confirm that a grounding or Do Not Fly defect locks Serviceable, Restricted and Return to Service.",
      "Close the fictional grounding defect, reassess the state, and then use Return to Service.",
      "Optionally add a clearly fictional discrepancy or record a fictional 100-hour inspection.",
      "Log out, enter Pilot / Ops and confirm the state and defect context have propagated.",
      "Where eligible, start a FRAT and confirm the Engineering record appears in the Aircraft section.",
    ],
    testFocus: [
      "Is the difference between Serviceable, Restricted, Maintenance and Unserviceable unambiguous?",
      "Does each defect give a pilot enough operational context?",
      "Are grounding defects treated as hard blockers rather than ordinary risk points?",
      "Does the Engineering-to-Pilot/FRAT hand-off behave as expected?",
    ],
    cautions: [
      "Return to Service is a fictional workflow control, not a regulatory maintenance release.",
      "Do not enter real registrations, defects, technical logs or maintenance information.",
    ],
  },
];

export const FULL_GUIDE_SECTIONS = [
  {
    id: "before-you-start",
    title: "1. Before you start",
    paragraphs: [
      "SafeRoute Academy is a public functional beta for aviation-safety education and workflow testing. It is not an operational flight-school system or an authoritative aviation record.",
    ],
    items: [
      "Do not enter real names, contact details, medical information, licence data, aircraft registrations, defects or maintenance information.",
      "The Flight School / Club records are fictional and reset when the page is reloaded; changes last only for the current browser session.",
      "The public tester workspaces do not require a username or password.",
      "Use Feedback to report unclear wording, unsafe assumptions, missing information or awkward workflow.",
    ],
  },
  {
    id: "access-navigation",
    title: "2. Access and navigation",
    paragraphs: [
      "Personal opens the general Academy tools. Flight School / Club opens the shared fictional records used by Pilot / Ops, Club Admin, CFI / Training and Engineering.",
    ],
    items: [
      "Use the workspace Log Out button to return to role selection.",
      "An Ops-launched FRAT returns to Pilot / Ops when Back is selected.",
      "Continue to SafeRoute Academy opens the wider tools and keeps a visible Pilot / Ops return control.",
      "Guide opens this help from every screen; Display selects System, Light or Dark mode for this device.",
      "Change Location opens the region selector; the mobile menu opens the airfield sidebar above the weather map.",
    ],
  },
  {
    id: "students-pilots",
    title: "3. Students and pilots",
    paragraphs: [
      "Students and pilots can use Academy independently or explore how school records might support a structured pre-flight review.",
    ],
    items: [
      "Select a region and airfield, then review weather status, local threats, airspace notes and CFI prompts.",
      "Compare the weather against personal minima and current official products; Academy does not make the go/no-go decision.",
      "Use the E6B tools for planning calculations and cross-check critical results against the POH/AFM.",
      "In Pilot / Ops, select the pilot before the aircraft so authorisation and currency gates can be applied.",
      "Treat every red blocker as requiring the appropriate CFI, Engineering or operational action outside the FRAT score.",
    ],
  },
  {
    id: "frat",
    title: "4. PAVE/FRAT risk review",
    paragraphs: [
      "The FRAT follows PAVE: Pilot, Aircraft, enVironment and External Pressures. It records initial risk, controls and residual risk; it never makes or authorises the flight decision.",
    ],
    items: [
      "Academy Auto-Fill marks answers supported by shared fictional records and shows their source.",
      "Sleep, IMSAFE, weather, performance, fuel, familiarity and external pressures remain pilot-entered.",
      "Changing an auto-filled answer records a pilot override while preserving the source context.",
      "A note records review but does not reduce risk; a real control must change the condition before the residual score is lowered.",
      "A green result is not a clearance, airworthiness finding or substitute for PIC/CFI judgement.",
    ],
  },
  {
    id: "weather-tools",
    title: "5. Weather, icing and performance",
    paragraphs: [
      "Academy combines current-feed status with training-oriented estimates, but it is not an approved weather briefing service.",
    ],
    items: [
      "METAR panels label live, retained, stale, nearby-station and unavailable data.",
      "Radar and Icing / Freezing Level are selectable weather-display tabs for every region.",
      "US icing awareness includes the surface estimate, selected altitude, official advisory intersection and nearby PIREPs when available.",
      "Freezing levels are estimates from surface observations and may miss inversions or multiple layers.",
      "Use AviationWeather.gov / Flight Service in the US and MAVIS in the UK for official products and a complete briefing.",
      "Density-altitude and cloud-base tools support planning but do not replace POH/AFM calculations.",
    ],
  },
  {
    id: "cfi-workspace",
    title: "6. CFI / Training workspace",
    paragraphs: [
      "The CFI view is organised around who needs attention, why, and what fictional action changes the shared readiness record.",
    ],
    items: [
      "Summary cards separate Current, Due Soon, Action Required and Awaiting Sign-off.",
      "Needs Attention is the default roster filter and hides fully current records.",
      "Each category filter hides the other categories; All groups records in red, amber, blue and green priority order without duplicate cards.",
      "The selected record shows recency, currency, medical summary and the next/last check dates.",
      "Aircraft Authorisations controls which aircraft types the selected pilot can choose in Pilot / Ops.",
      "Record Check / Sign Off makes the fictional record current; Require Training creates a hard operational blocker.",
      "These actions are demonstrations, not instructor endorsements, logbook entries or regulatory records.",
    ],
  },
  {
    id: "engineering-workspace",
    title: "7. Engineering workspace",
    paragraphs: [
      "Engineering demonstrates how state and defect context control aircraft selection and inform the Aircraft part of PAVE.",
    ],
    items: [
      "Maintenance and unserviceable aircraft are blocked from selection.",
      "A grounding or Do Not Fly defect remains a hard blocker even if an aircraft state becomes inconsistent.",
      "Serviceable and Restricted cannot be selected until the grounding defect is closed.",
      "Closing a defect clears the current squawk only when no other open defect remains.",
      "The audit list is session-only prototype history, not an approved technical log.",
    ],
  },
  {
    id: "club-admin-workspace",
    title: "8. Club Admin workspace",
    paragraphs: [
      "Club Admin demonstrates oversight and access control while keeping CFI and Engineering authority separate.",
    ],
    items: [
      "The selectable directory tiles show All, Students, Instructors, Staff or Aircraft and hide unrelated records when a category is selected.",
      "All groups each fictional account and aircraft once in a consistent section.",
      "People records show account status and assigned workspace roles.",
      "Aircraft records provide read-only fleet, maintenance and defect oversight; operational changes remain in Engineering.",
      "Role changes affect demo access only and do not alter operational records.",
      "The final active Club Admin cannot be removed or suspended.",
      "Locked safety policies summarise the gates enforced by the prototype.",
      "Recent Prototype Activity is informative and session-only.",
    ],
  },
  {
    id: "recommended-tests",
    title: "9. Recommended end-to-end tests",
    paragraphs: [
      "The most useful feedback comes from following a change into the next workspace and checking whether the consequence is clear.",
    ],
    items: [
      "CFI → Pilot: change an aircraft-type authorisation and confirm Pilot / Ops responds immediately.",
      "CFI → FRAT: sign off a non-current pilot, then confirm the training context is updated.",
      "Engineering → Pilot: close N9DA's grounding defect, return it to service, and confirm it becomes selectable only afterwards.",
      "Engineering → FRAT: use a restricted aircraft and confirm its defect/restriction context appears.",
      "Admin safeguard: try to remove or suspend the final active Club Admin.",
      "FRAT integrity: override an auto-fill, record controls and compare initial with residual risk.",
    ],
  },
  {
    id: "limits-feedback",
    title: "10. Limits and feedback",
    paragraphs: [
      "Feedback is most valuable when it states what you expected, what happened and why the difference matters operationally.",
    ],
    items: [
      "Report any wording that could imply regulatory approval, airworthiness, currency or flight authorisation.",
      "Include the workspace, fictional pilot/aircraft and action when describing a workflow issue.",
      "Include device/browser and Display setting for layout or contrast problems.",
      "Reloading resets all Flight School / Club demo changes.",
      "Academy does not provide live NOTAM ingestion, an official briefing, authentication, durable records or a production audit trail.",
    ],
  },
];

export const GUIDE_IDS = ["full", ...QUICK_START_GUIDES.map(guide => guide.id)];

export function normaliseGuideId(value) {
  return GUIDE_IDS.includes(value) ? value : "full";
}
