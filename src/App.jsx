import { useState, useEffect, useRef, useCallback } from "react";
import "leaflet/dist/leaflet.css";
import {
  interpretMetarShort,
  isMetarUsableForCalculations,
  parseMetarAltimeter,
  parseMetarDewpoint,
  parseMetarTemp,
  parsePeriodSummary,
  parseTAFPeriods,
} from "./lib/aviation-weather.js";
import {
  classifyIcingAwareness,
  estimateFreezingLevel,
  hasVisibleMoistureSignal,
  isNegativeIcingIntensity,
} from "./lib/icing.js";
import { buildOpsFratSeed, evaluateFratEligibility } from "./lib/academy-frat.js";
import {
  buildClubAdminSummary,
  CLUB_ACCESS_ROLES,
  toggleClubUserRole,
  toggleClubUserStatus,
} from "./lib/club-admin.js";
import { canControlReduce, FRAT_RETAIN_CONTROL, hasRecordedControl } from "./lib/frat-controls.js";
import { createDemoWorkspaceSnapshot, DEFAULT_DEMO_WORKSPACE_NAME } from "./data/demo-workspace-template.js";
import {
  createConfiguredWorkspaceRepository,
  loadBrowserWorkspaceSnapshot,
} from "./lib/workspace-repository.js";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "https://saferoute-backend-production.up.railway.app";

async function fetchLiveWeather(icao) {
  try {
    const res = await fetch(`${BACKEND}/weather/${icao}`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function fetchIcingData(icao, latitude, longitude) {
  try {
    const query = new URLSearchParams({ lat:String(latitude), lon:String(longitude) });
    const res = await fetch(`${BACKEND}/icing/${icao}?${query}`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

function parseTAFThreats(tafs) {
  if (!tafs || !tafs.length) return [];
  const taf = tafs[0] || "";
  const threats = [];
  if (/TSRA|TSGR|\+TS/.test(taf)) threats.push({ icon:"⛈", text:"Thunderstorms forecast in TAF", color:"#FF3B3B" });
  else if (/\bCB\b/.test(taf)) threats.push({ icon:"🌩", text:"Cumulonimbus forecast in TAF", color:"#FF8C00" });
  if (/BKN0[01]\d|OVC0[01]\d/.test(taf)) threats.push({ icon:"🌫", text:"Low cloud ceiling forecast", color:"#FF8C00" });
  if (/PROB\d+.*TS|TEMPO.*TS/.test(taf)) threats.push({ icon:"⛈", text:"Probable thunderstorms in TAF", color:"#FF8C00" });
  if (/LLWS|WS\d/.test(taf)) threats.push({ icon:"💨", text:"Low-level windshear in TAF", color:"#FF3B3B" });
  return threats;
}

const FAA_SE_CURRENT = {
  label: "FAA Chart Supplement Southeast",
  cycle: "3 Sep–29 Oct 2026",
  url: "https://aeronav.faa.gov/Upload_313-d/supplements/CS_SE_20260903.pdf",
};
const FAA_SW_CURRENT = {
  label: "FAA Chart Supplement Southwest",
  cycle: "3 Sep–29 Oct 2026",
  url: "https://aeronav.faa.gov/Upload_313-d/supplements/CS_SW_20260903.pdf",
};
const FAA_CHART_SUPPLEMENT_SEARCH = "https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dafd/search/";
const UK_AIP = "https://nats-uk.ead-it.com/cms-nats/opencms/en/Publications/AIP/";

const AIRFIELDS = {
  // ── FLORIDA ──────────────────────────────────────────────────────────────
  KDAB:{ name:"Daytona Beach International", city:"Daytona Beach, FL", elevation:34, class:"Class C", type:"Towered", runways:["07L/25R — 10,500ft","07R/25L — 3,200ft","16/34 — 6,002ft"], region:"florida", weather_icao:"KDAB",
    hazards:[
      {id:"CLASS_C",phase:["all"],sev:"high",icon:"📡",title:"Class C Operations",why:"Mandatory two-way communication before entering.",detail:"KDAB is Class C. You must establish two-way communication with Daytona Approach before entering the 5nm inner ring. Embry-Riddle operations generate constant traffic at all levels — ATC is professional and busy."},
      {id:"ERAU",phase:["pattern","all"],sev:"high",icon:"✈",title:"Embry-Riddle High-Density Training Traffic",why:"Students at all skill levels share the same airspace.",detail:"KDAB is home to ERAU — one of the world's largest aviation universities. Expect a mix of ab initio students and advanced multi-engine training sharing the same pattern. Be patient, maintain lookout scan, and do not assume other pilots have your level of experience."},
      {id:"SHORT",phase:["takeoff","landing"],sev:"high",icon:"🛬",title:"Short Runway 07R — 3,200ft",detail:"07R/25L is only 3,200ft — know your aircraft's performance before accepting this runway."},
      {id:"CB",phase:["all"],sev:"high",icon:"⛈",title:"Atlantic Coast Thunderstorms",detail:"Atlantic sea breeze CB development. Check TAF. Plan morning flights in summer."},
    ],
    atcNotes:"Approach 124.0 · Tower 126.0 · Ground 121.9\nClass C — mandatory contact before entering airspace.",
    cfiNotes:"KDAB is excellent for Class C introduction. Focus on communication requirements and traffic awareness in the ERAU environment. Always confirm: have you checked NOTAMs before departure?",
  },
  KVRB:{ name:"Vero Beach Regional Airport", city:"Vero Beach, FL", elevation:24, class:"Class D", type:"Towered (part-time)", runways:["12R/30L — 7,314ft","12L/30R — 3,505ft","04/22 — 4,974ft"], region:"florida", weather_icao:"KVRB", source:FAA_SE_CURRENT,
    hazards:[
      {id:"BIRDS",phase:["takeoff","landing","pattern"],sev:"critical",icon:"🦅",title:"Severe Bird Strike Risk — Atlantic Flyway",why:"Multiple documented strikes per year at this field.",detail:"Vero Beach sits on the Atlantic Flyway — a major migratory bird corridor. Vultures, pelicans, egrets, and osprey are common on and around the field. Scan final approach and departure paths carefully. Report all bird activity to tower. Bird strikes have caused engine failures here."},
      {id:"CB",phase:["all"],sev:"critical",icon:"⛈",title:"Afternoon Thunderstorms — Rapid Development",why:"Florida CB activity is some of the fastest-developing in the world.",detail:"The Florida pattern in summer: clear mornings, cumulus building by 11:00, storms by 13:00-14:00. Storms can go from clear sky to lightning in 20 minutes. Check the TAF before every departure. If TSRA is forecast within your planned flight window, delay or cancel."},
      {id:"SHORT",phase:["takeoff","landing"],sev:"high",icon:"🛬",title:"Short Training Runway",detail:"Runway 12L/30R is 3,505ft. Calculate takeoff and landing performance for the actual conditions and apply the margins required by your POH/AFM, operator, and instructor."},
      {id:"CROSSING",phase:["pattern","all"],sev:"medium",icon:"📻",title:"Multi-School Pattern / Crossing Operations",detail:"Multiple flight schools operate at VRB including Skyborne. With aircraft at different skill levels sharing the pattern, expect non-standard spacing. Announce clearly, look before every turn."},
    ],
    atcNotes:"CTAF/Tower 126.3 · Ground 127.45 · ATIS 120.575 · Clearance 134.975\nClass D during published tower hours; Class E when the tower is closed. Confirm current hours, frequencies, and NOTAMs.",
    cfiNotes:"Bird activity and fast-developing summer convection deserve explicit pre-flight review. Set weather decision points from current official observations, forecasts, radar, personal minimums, and school policy rather than a fixed clock rule. Confirm current NOTAMs and nearby special-use airspace status.",
  },
  KFXE:{ name:"Fort Lauderdale Executive Airport", city:"Fort Lauderdale, FL", elevation:13, class:"Class D", type:"Towered", runways:["09/27 — 4,000ft","13/31 — 6,001ft"], region:"florida", weather_icao:"KFXE",
    hazards:[
      {id:"CLASS_B",phase:["all"],sev:"critical",icon:"📡",title:"FLL Class B — Do Not Climb Above 1,200ft Without Clearance",why:"Students have received certificate enforcement actions for inadvertent Class B entry here.",detail:"Fort Lauderdale-Hollywood Class B airspace begins at 1,200ft MSL directly above KFXE. Do not climb above 1,200ft without an explicit Class B clearance from Miami Approach. Enforcement actions have been taken here."},
      {id:"CB",phase:["all"],sev:"critical",icon:"⛈",title:"Afternoon Thunderstorms — Rapid Development",detail:"South Florida CB development is among the fastest in the world. Check TAF. Ground by 13:00 in summer."},
      {id:"TRAFFIC",phase:["pattern","all"],sev:"high",icon:"✈",title:"Extremely High Traffic — Multi-School Parallel Ops",detail:"KFXE handles very high training volumes. Multiple schools operate simultaneously. Extended downwind instructions are common. Never rush a clearance."},
      {id:"MULTI",phase:["pattern","all"],sev:"high",icon:"📻",title:"Non-Native English Readbacks",detail:"KFXE hosts many international students. Readbacks may be unclear or incomplete. Monitor all traffic calls carefully."},
    ],
    atcNotes:"Tower 128.025 · Ground 121.9 · Miami Approach 124.15\nDo NOT climb above 1,200ft without explicit Class B clearance.",
    cfiNotes:"Class B altitude discipline is the defining brief at FXE — say it explicitly every flight: 'We do not climb above 1,200ft without a clearance.' Always confirm: have you checked NOTAMs before departure?",
  },
  KPMP:{ name:"Pompano Beach Airpark", city:"Pompano Beach, FL", elevation:19, class:"Class D", type:"Towered (part-time)", runways:["15/33 — 4,918ft","06/24 — 4,001ft","10/28 — 3,687ft"], region:"florida", weather_icao:"KPMP", source:FAA_SE_CURRENT,
    hazards:[
      {id:"CLASS_B",phase:["all"],sev:"critical",icon:"📡",title:"FLL Class B — Floor as Low as 1,000ft",why:"KPMP sits directly under the tightest part of FLL's Class B.",detail:"The FLL Class B floor at KPMP can be as low as 1,000ft MSL. Know the exact Class B floor in your departure direction before taxiing. Students have received enforcement actions here."},
      {id:"SHORT",phase:["takeoff","landing"],sev:"high",icon:"🛬",title:"Runway Length and Weight Restrictions",why:"The three runways have different published dimensions and operating limitations.",detail:"Runways 15/33, 06/24, and 10/28 are 4,918ft, 4,001ft, and 3,687ft respectively. Calculate performance for the assigned runway and check current Chart Supplement limitations and NOTAMs."},
      {id:"PATTERN",phase:["pattern"],sev:"high",icon:"✈",title:"Non-Standard Pattern Geometry",detail:"KPMP's pattern is constrained by the Class B floor and runway layout. Study the airport diagram and receive a thorough CFI brief before first solo here."},
      {id:"CB",phase:["all"],sev:"high",icon:"⛈",title:"Afternoon Thunderstorms",detail:"South Florida CB — plan morning flights, ground by 13:00 in summer. Check TAF."},
    ],
    atcNotes:"CTAF/Tower 125.4 · Ground 121.9 · ATIS 120.55 · Miami Approach 119.7 (4,000ft and below)\nClass D during published tower hours; Class G when closed. Confirm the Class B floor by sector.",
    cfiNotes:"Pompano is known as one of Florida's 'gotcha' fields. Short runway, Class B floor, non-standard pattern — all need specific briefing. Always confirm: have you checked NOTAMs before departure?",
  },
  KLNA:{ name:"Palm Beach County Park Airport (Lantana)", city:"Lantana, FL", elevation:14, class:"Uncontrolled", type:"Non-Towered", runways:["10/28 — 3,489ft","16/34 — 3,421ft","04/22 — 3,256ft"], region:"florida", weather_icao:"KLNA", source:FAA_SE_CURRENT,
    hazards:[
      {id:"TRAINING",phase:["pattern","all"],sev:"high",icon:"✈",title:"Extensive Flight Training — Multiple Runways in Use",why:"The current Chart Supplement identifies extensive training with multiple runways operating.",detail:"Build a complete traffic picture before entering the pattern. Aircraft may be using different intersecting runways, so make precise CTAF calls, listen for runway designators, and maintain an active visual scan."},
      {id:"HOLD",phase:["taxi"],sev:"high",icon:"⚠",title:"Non-Standard Hold-Short Markings",why:"The published markings on Taxiway P between Runways 10/28 and 16/34 are non-standard.",detail:"Use the current airport diagram, slow the taxi pace, positively identify each runway and hold position, and stop whenever the marking or traffic situation is uncertain."},
      {id:"TGL",phase:["pattern","takeoff","landing"],sev:"high",icon:"🛬",title:"No Touch-and-Go Landings on Runway 10/28",detail:"Touch-and-go landings are not permitted on Runway 10/28. Select another runway when appropriate or plan a full-stop landing and taxi-back operation."},
      {id:"SHORT",phase:["takeoff","landing"],sev:"medium",icon:"📏",title:"Three Short Intersecting Runways",detail:"All three runways are between 3,256ft and 3,489ft, with published trees, brush, or a building near several approaches. Calculate performance for the actual runway, aircraft, and conditions."},
      {id:"NOISE",phase:["departure","pattern"],sev:"low",icon:"🔇",title:"Noise-Sensitive Airport",detail:"Runway 04/22 is the preferred noise-abatement runway when conditions permit. Review current airport guidance and avoid unnecessary low-altitude flight over noise-sensitive areas."},
    ],
    atcNotes:"CTAF/UNICOM 122.7 · AWOS-3PT 119.925 · Palm Beach Approach/Departure 125.2 · Clearance 127.35\nNon-towered. Helicopters use right traffic to all runways. Confirm current runway activity and NOTAMs.",
    cfiNotes:"Lantana is especially valuable for students learning to build a traffic picture at a busy non-towered airport. Brief simultaneous runway use, the Taxiway P hold-short anomaly, the Runway 10/28 touch-and-go restriction, runway performance, and clear go-around or exit options.",
  },
  KHWO:{ name:"North Perry Airport", city:"Hollywood, FL", elevation:9, class:"Class D", type:"Towered (part-time)", runways:["10R/28L — 3,463ft","01R/19L — 3,260ft","10L/28R — 3,241ft","01L/19R — 3,000ft"], region:"florida", weather_icao:"KHWO", source:FAA_SE_CURRENT,
    hazards:[
      {id:"TRAINING",phase:["pattern","all"],sev:"critical",icon:"✈",title:"High-Volume Student and Banner-Tow Traffic",why:"The current Chart Supplement specifically reports high volumes of student flying and banner-towing activity.",detail:"Expect large speed differences, frequent pattern entries and departures, and banner-tow aircraft operating nearby. Listen continuously, maintain a disciplined visual scan, and allow extra spacing rather than compressing the pattern."},
      {id:"PARALLEL",phase:["taxi","takeoff","landing"],sev:"high",icon:"⚠",title:"Four Short Runways with Similar Designators",why:"Two north-south and two east-west runways create multiple left/right designators in a compact area.",detail:"Read back and verify the complete runway designator before taxi, crossing, lineup, and landing. Use the current airport diagram and confirm the pavement marking before entering a runway."},
      {id:"DISPLACED",phase:["takeoff","landing"],sev:"high",icon:"🛬",title:"Displaced Thresholds and Published Obstacles",detail:"Several runway ends have displaced thresholds, with buildings or trees published near approaches. Use declared or published distances as applicable and calculate performance for the assigned runway and actual conditions."},
      {id:"TOWER",phase:["all"],sev:"high",icon:"📡",title:"Part-Time Class D — Class G When Closed",detail:"North Perry is Class D during published 1200–0200Z tower hours and Class G when the tower is closed. Confirm tower status and apply the correct controlled or non-towered procedures."},
      {id:"BIRDS",phase:["takeoff","landing","pattern"],sev:"medium",icon:"🦅",title:"Bird Activity",detail:"Bird activity is published on and around the airport. Scan the runway environment, final approach, and departure path and report significant activity."},
    ],
    atcNotes:"CTAF/Tower 132.1 or Tower 134.3 · Ground 120.45 · ATIS 135.475 · Miami Approach/Departure 128.6\nClass D during published 1200–0200Z tower hours; Class G when closed. Confirm current status, frequencies, and NOTAMs.",
    cfiNotes:"North Perry is a strong advanced-student environment for runway-identification discipline, short-runway performance, tower-status transitions, and managing mixed student and banner-tow traffic. Set clear workload and traffic limits before entering the pattern.",
  },
  KFPR:{ name:"Treasure Coast International (Fort Pierce)", city:"Fort Pierce, FL", elevation:23, class:"Class D", type:"Towered (part-time)", runways:["10R/28L — 6,492ft","14/32 — 4,755ft","10L/28R — 4,000ft"], region:"florida", weather_icao:"KFPR", source:FAA_SE_CURRENT,
    hazards:[
      {id:"TRAINING",phase:["pattern","all"],sev:"high",icon:"✈",title:"Extensive Flight Training On and Near the Airport",why:"The current Chart Supplement identifies extensive training activity within 20 miles below 6,000ft.",detail:"Expect concentrated training traffic in the pattern and surrounding practice area. VFR training aircraft outside the Class D publish intentions on 123.3; monitor the current frequencies and maintain an active visual scan."},
      {id:"BIRDS",phase:["takeoff","landing","pattern"],sev:"high",icon:"🦅",title:"Numerous Birds and Wildlife",detail:"The current Chart Supplement reports numerous flocks of birds and wildlife on and around the airport. Scan the runway environment, final approach, and departure path and report activity to ATC."},
      {id:"PARALLEL",phase:["taxi","takeoff","landing"],sev:"high",icon:"⚠",title:"Parallel Runway Identification",why:"The airport has closely named 10L/28R and 10R/28L runways with different dimensions and uses.",detail:"Confirm the full runway designator before crossing, lineup, and landing. Runway 10L/28R is the published VFR training runway; right traffic applies to 10R and 28R."},
      {id:"CB",phase:["all"],sev:"high",icon:"⛈",title:"Atlantic Coast Convection",detail:"Sea-breeze convergence can produce rapidly changing conditions. Use current observations, TAFs, radar, an official briefing, and defined personal or operator weather limits."},
    ],
    atcNotes:"CTAF/Tower 128.2 · Ground/GCO 119.55 · ATIS 134.825 · Palm Beach Approach/Departure 132.8\nClass D during published 1200–0200Z tower hours; Class G when closed. Confirm current hours, frequencies, and NOTAMs.",
    cfiNotes:"Fort Pierce is a high-volume training environment with parallel-runway identification, wildlife, and part-time tower status as the principal briefing points. Include the 123.3 practice-area advisory frequency and current tower status in the lesson brief.",
  },
  KOBE:{ name:"Okeechobee County Airport", city:"Okeechobee, FL", elevation:34, class:"Uncontrolled", type:"Non-Towered", runways:["05/23 — 5,000ft","14/32 — 4,001ft"], region:"florida", weather_icao:"KOBE", source:FAA_SE_CURRENT,
    hazards:[
      {id:"BIRDS",phase:["takeoff","landing","pattern"],sev:"high",icon:"🦅",title:"Cranes and Bird Activity",detail:"The current Chart Supplement identifies a bird hazard, including cranes, on and around the airport. Scan the runway, approach, and departure areas carefully."},
      {id:"ULTRALIGHT",phase:["pattern","all"],sev:"high",icon:"✈",title:"Ultralight Activity",why:"Ultralights may be difficult to see and may operate with different speed and pattern characteristics.",detail:"Expect ultralight activity on and around the airport. Make clear CTAF calls, listen for other traffic, and maintain a vigilant visual scan."},
      {id:"SURFACE",phase:["taxi","takeoff","landing"],sev:"medium",icon:"⚠",title:"Runway 14/32 Surface and Marking Condition",detail:"The Chart Supplement reports longitudinal and transverse cracking throughout Runway 14/32 and poor-condition runway markings. Confirm current conditions and NOTAMs before use."},
      {id:"GLIDER",phase:["pattern","all"],sev:"medium",icon:"🪂",title:"Non-Powered Flight Not Authorized in the Pattern",detail:"Non-powered flight within the traffic pattern is not authorized. Review the current airport remarks and coordinate any unusual operation with airport management."},
    ],
    atcNotes:"CTAF/UNICOM 123.0 · AWOS-3 118.675 · Miami Center Approach/Departure 132.25\nNon-towered. Runway 05 is the published calm-wind runway; confirm current conditions and NOTAMs.",
    cfiNotes:"Okeechobee combines a non-towered pattern with cranes, ultralights, and a documented Runway 14/32 surface/marking concern. Brief aircraft visibility, runway choice, performance, current NOTAMs, and CTAF discipline.",
  },
  X59:{ name:"Valkaria Airport", city:"Valkaria, FL", elevation:26, class:"Uncontrolled", type:"Non-Towered", runways:["10/28 — 4,000ft","14/32 — 4,000ft"], region:"florida", weather_icao:"KMLB", source:FAA_SE_CURRENT,
    hazards:[
      {id:"PARAGLIDER",phase:["pattern","all"],sev:"high",icon:"🪂",title:"Extensive Powered-Paraglider Operations",why:"Powered paragliders may be slow-moving and difficult to acquire visually.",detail:"The current Chart Supplement calls for caution due to extensive powered-paraglider operations. Make clear CTAF calls and maintain a deliberate visual scan throughout the pattern and airport vicinity."},
      {id:"PATTERN_LIMIT",phase:["pattern","takeoff","landing"],sev:"high",icon:"✈",title:"Touch-and-Go Restriction When the Pattern Is Busy",detail:"Touch-and-go operations are prohibited when three or more aircraft are in the traffic pattern. Count and identify traffic before planning a circuit, and convert to a full-stop landing when required."},
      {id:"INTERSECT",phase:["taxi","takeoff","landing"],sev:"medium",icon:"⚠",title:"Intersecting 4,000ft Runways",detail:"Runways 10/28 and 14/32 intersect. Confirm runway occupancy, make precise CTAF calls, and check current wind, lighting, surface condition, and NOTAMs."},
    ],
    atcNotes:"CTAF/AUNICOM 122.725 · AWOS-3PT 119.525 · Orlando Approach/Departure 126.025\nNon-towered. Academy weather uses nearby KMLB, not an on-airport coded observation.",
    cfiNotes:"Valkaria's defining lesson is traffic management around extensive powered-paraglider activity and the published no-touch-and-go rule once three or more aircraft are in the pattern. Brief intersecting-runway awareness and current NOTAMs.",
  },
  X26:{ name:"Sebastian Municipal Airport", city:"Sebastian, FL", elevation:22, class:"Uncontrolled", type:"Non-Towered", runways:["05/23 — 4,023ft","10/28 — 3,199ft"], region:"florida", weather_icao:"KVRB", source:FAA_SE_CURRENT,
    hazards:[
      {id:"PARACHUTE",phase:["pattern","all"],sev:"critical",icon:"🪂",title:"Extensive Parachute Operations",why:"The current Chart Supplement specifically advises avoiding overflight during parachute operations.",detail:"Parachute jumping is extensive. Monitor CTAF, identify jump-aircraft calls and the drop-zone status, maintain visual awareness, and avoid overflying the airport during active parachute operations."},
      {id:"INTERSECT",phase:["taxi","takeoff","landing"],sev:"high",icon:"⚠",title:"Intersecting Runways and Right-Traffic Patterns",detail:"Runways 05/23 and 10/28 intersect. Right traffic applies to Runways 23 and 28. Verify the active runway, pattern direction, traffic, and runway occupancy before entering or crossing."},
      {id:"TREES",phase:["takeoff","landing"],sev:"medium",icon:"🌳",title:"Trees Near Runway Approaches and Transition Surfaces",detail:"Trees are published near each runway end, with trees and brush in the Runway 05/23 transition surfaces. Use current performance data and maintain a stabilized approach."},
      {id:"NOISE",phase:["departure","pattern"],sev:"low",icon:"🔇",title:"Noise-Abatement Procedures",detail:"Noise-abatement procedures are in effect. Review the current airport guidance before operating in the pattern."},
    ],
    atcNotes:"CTAF 123.05 · AWOS-3PT 118.125\nNon-towered. Academy weather uses nearby KVRB, not an on-airport coded observation. Confirm parachute activity and current NOTAMs.",
    cfiNotes:"Sebastian requires a specific parachute-operations brief before pattern work or transit. Include drop-zone avoidance, intersecting runways, right-traffic directions, noise procedures, and a clear plan for discontinuing the operation if traffic or jump activity is uncertain.",
  },
  KTMB:{ name:"Miami Executive Airport (Tamiami)", city:"Miami, FL", elevation:8, class:"Class D", type:"Towered", runways:["09L/27R — 5,003ft","09R/27L — 6,000ft","13/31 — 4,001ft"], region:"florida", weather_icao:"KTMB",
    hazards:[
      {id:"CLASS_B",phase:["all"],sev:"critical",icon:"📡",title:"Miami Class B — Multi-Sector Complex Geometry",why:"Miami's Class B has different floors in different directions from KTMB.",detail:"Miami Class B has multiple sectors with different floor altitudes. There is no single altitude limit — it depends which direction you are flying. Miami Approach 125.5 (northbound), 119.75 (southbound)."},
      {id:"BIRDS",phase:["takeoff","landing"],sev:"critical",icon:"🦅",title:"Everglades Wildlife — Extremely High Bird Activity",why:"Adjacent to Everglades — one of the most biodiverse areas in North America.",detail:"KTMB is immediately adjacent to Everglades National Park. Bird strike rates at Tamiami are among the highest in Florida. Scan every approach and departure carefully."},
      {id:"CB",phase:["all"],sev:"critical",icon:"⛈",title:"Afternoon Thunderstorms — Everglades Convergence",detail:"Sea breeze convergence between Biscayne Bay and the Everglades concentrates storm activity near KTMB. Ground by 12:30 in summer."},
      {id:"ADIZ",phase:["all"],sev:"high",icon:"🔒",title:"Florida ADIZ — Offshore Flight Restriction",detail:"The Florida ADIZ begins 12nm offshore. Do not fly over the ocean without a DVFR flight plan and CFI brief on ADIZ procedures."},
    ],
    atcNotes:"Tower 132.075 · Ground 121.9 · Miami Approach 125.5 (N), 119.75 (S)",
    cfiNotes:"Tamiami's Class B geometry is complex — brief it sector by sector. Everglades bird risk is genuine and high. Always confirm: have you checked NOTAMs before departure?",
  },
  KSRQ:{ name:"Sarasota-Bradenton International", city:"Sarasota, FL", elevation:30, class:"Class C", type:"Towered", runways:["14/32 — 9,500ft","04/22 — 5,006ft"], region:"florida", weather_icao:"KSRQ",
    hazards:[
      {id:"CLASS_C",phase:["all"],sev:"high",icon:"📡",title:"Class C Operations",detail:"SRQ is Class C. Two-way communication with Sarasota Approach required before entering the Class C surface area."},
      {id:"CB",phase:["all"],sev:"high",icon:"⛈",title:"Gulf Coast Afternoon Thunderstorms",detail:"Tampa Bay/Gulf sea breeze. Check TAF. Ground by 13:00 in summer."},
      {id:"BIRDS",phase:["takeoff","landing"],sev:"high",icon:"🦅",title:"Gulf Coast Bird Activity",detail:"Sarasota Bay wetlands adjacent. Wading birds and seabirds common on approach paths."},
    ],
    atcNotes:"Approach 119.15 · Tower 118.05 · Ground 121.9",
    cfiNotes:"SRQ is ideal for Class C introduction — less complex than Miami/FLL, professional environment. Always confirm: have you checked NOTAMs before departure?",
  },
  KFMY:{ name:"Page Field", city:"Fort Myers, FL", elevation:17, class:"Class D", type:"Towered", runways:["05/23 — 6,397ft","13/31 — 4,116ft"], region:"florida", weather_icao:"KFMY",
    hazards:[
      {id:"CB",phase:["all"],sev:"critical",icon:"⛈",title:"Afternoon Thunderstorms — Gulf & Atlantic Convergence",why:"Fort Myers sits between Gulf and Atlantic sea breezes — storms concentrate here.",detail:"Southwest Florida is one of the most thunderstorm-prone areas in the US. Sea breeze from both Gulf and Atlantic coasts converge near Fort Myers creating intense afternoon CB activity. June-September: be on the ground by 13:00 local."},
      {id:"BIRDS",phase:["takeoff","landing","pattern"],sev:"high",icon:"🦅",title:"Bird Strike Risk — Caloosahatchee River Corridor",detail:"Page Field sits adjacent to the Caloosahatchee River. Wading birds, osprey, vultures and egrets are common on and near the runway."},
      {id:"RSWS",phase:["departure","all"],sev:"high",icon:"📡",title:"KRSW Class C Proximity",detail:"Southwest Florida International Class C airspace is immediately north of KFMY. Northbound departures can enter Class C within seconds of takeoff. Establish contact with Fort Myers Approach before climbing northbound."},
      {id:"MULTI",phase:["pattern","all"],sev:"medium",icon:"📻",title:"Multi-School Pattern Operations",detail:"Multiple training schools based at KFMY including Paragon Flight. Announce all pattern positions."},
    ],
    atcNotes:"Tower 119.4 · Ground 121.9 · Fort Myers Approach 124.0\nRSW Class C to the north — confirm clearance before climbing northbound.",
    cfiNotes:"KFMY has intersecting runways — reinforce runway crossing discipline. Gulf/Atlantic convergence makes afternoon weather particularly fast-developing. Always confirm: have you checked NOTAMs before departure?",
  },
  KGNV:{ name:"Gainesville Regional Airport", city:"Gainesville, FL", elevation:151, class:"Class D", type:"Towered (part-time)", runways:["11/29 — 7,504ft","07/25 — 4,158ft"], region:"florida", weather_icao:"KGNV", source:FAA_SE_CURRENT,
    hazards:[
      {id:"CLASS_D",phase:["all"],sev:"high",icon:"📡",title:"Part-Time Class D Operations",detail:"KGNV is Class D during published tower hours and Class E when the tower is closed. Confirm the current operating status and use the published procedures for the time of flight."},
      {id:"SHORT",phase:["takeoff","landing"],sev:"medium",icon:"🛬",title:"Shorter Runway 07/25 — 4,158ft",detail:"Runway 07/25 is 4,158ft versus 7,504ft for 11/29. Calculate performance for the actual runway and conditions before accepting an assignment."},
      {id:"CB",phase:["all"],sev:"high",icon:"⛈",title:"North Florida Thunderstorms",detail:"Gainesville sees both Gulf and Atlantic weather. Afternoon CB activity June-September. Check TAF."},
      {id:"BIRDS",phase:["takeoff","landing"],sev:"medium",icon:"🦅",title:"Paynes Prairie Wildlife Corridor",detail:"Paynes Prairie wildlife preserve is adjacent. Sandhill cranes, wading birds and raptors are common."},
    ],
    atcNotes:"CTAF/Tower 119.55 · Ground 121.7 · ATIS 127.15 · Jacksonville Approach 118.175 (10,000ft and below)\nClass D during published tower hours; Class E when closed.",
    cfiNotes:"KGNV is useful for part-time Class D training. Brief the change to Class E when the tower closes and compare performance for 4,158ft runway 07/25 with the longer 11/29. Confirm current NOTAMs.",
  },
  KVNC:{ name:"Venice Municipal Airport", city:"Venice, FL", elevation:18, class:"Class D", type:"Towered", runways:["05/23 — 5,000ft","13/31 — 5,640ft"], region:"florida", weather_icao:"KVNC",
    hazards:[
      {id:"BIRDS",phase:["takeoff","landing","pattern"],sev:"critical",icon:"🦅",title:"Severe Bird Strike Risk — Gulf Coast Flyway",why:"Venice has documented multiple bird strikes including engine FOD.",detail:"Venice Airport is surrounded by Gulf Coast wetlands and is on a major migratory bird route. Vultures are particularly common and have caused engine FOD. Scan all approaches and departures aggressively."},
      {id:"CB",phase:["all"],sev:"high",icon:"⛈",title:"Gulf Coast Afternoon Thunderstorms",detail:"Gulf sea breeze CB development — rapid in summer. Check TAF for TSRA forecast."},
      {id:"CROSS",phase:["takeoff","landing"],sev:"high",icon:"🛬",title:"Intersecting Runway Operations",detail:"Runways 05/23 and 13/31 intersect. Confirm runway crossing clearances carefully."},
    ],
    atcNotes:"Tower 119.05 · Ground 121.9\nIntersecting runways — confirm all crossing clearances.",
    cfiNotes:"Venice has a high bird strike record. Intersecting runways need specific crossing discipline briefing. Always confirm: have you checked NOTAMs before departure?",
  },
  KBOW:{ name:"Bartow Executive Airport", city:"Bartow, FL", elevation:125, class:"Class D", type:"Towered (part-time)", runways:["05/23 — 5,001ft","09L/27R — 5,000ft","09R/27L — 4,416ft"], region:"florida", weather_icao:"KBOW", source:FAA_SE_CURRENT,
    hazards:[
      {id:"PARALLEL",phase:["takeoff","landing"],sev:"critical",icon:"⚠",title:"Parallel Runway Identification",why:"The parallel designators require an explicit runway check before lineup and landing.",detail:"KBOW has parallel runways 09L/27R (5,000ft) and 09R/27L (4,416ft), plus 05/23. Read back the complete designator and verify the pavement marking and airport diagram before lineup or landing."},
      {id:"CB",phase:["all"],sev:"high",icon:"⛈",title:"Central Florida Afternoon Thunderstorms",detail:"Central Florida inland heat convection — storms develop rapidly. Morning flights preferred in summer."},
      {id:"MULTI",phase:["pattern","all"],sev:"high",icon:"📻",title:"High Volume Multi-School Operations",why:"Bartow is a major training hub.",detail:"KBOW hosts very high training volumes — multiple schools operate simultaneously on parallel runways. Radio discipline and visual lookout are critical."},
    ],
    atcNotes:"CTAF/Tower 121.2 · Ground 121.9 · AWOS 123.775 · Tampa Approach 120.65 / 119.9\nClass D during published tower hours; Class G when closed. Confirm the full runway designator.",
    cfiNotes:"Bartow's parallel runways require disciplined readbacks and visual runway verification. Include the shorter 09R/27L and the intersecting 05/23 in the airport-diagram brief. Confirm current NOTAMs.",
  },
  KLAL:{ name:"Lakeland Linder Regional", city:"Lakeland, FL", elevation:142, class:"Class D", type:"Towered", runways:["09/27 — 8,500ft","05/23 — 5,001ft","18/36 — 3,700ft"], region:"florida", weather_icao:"KLAL",
    hazards:[
      {id:"CB",phase:["all"],sev:"high",icon:"⛈",title:"Central Florida Thunderstorms",detail:"Lakeland sits in central Florida's afternoon CB zone. Check TAF. Morning operations preferred in summer."},
      {id:"COMPLEX",phase:["all"],sev:"high",icon:"🛬",title:"Complex Multi-Runway Airport",detail:"KLAL has three runways at different angles. Study the airport diagram before arrival."},
      {id:"SUNFUN",phase:["all"],sev:"high",icon:"✈",title:"Sun 'n Fun Airshow — Annual TFR",why:"KLAL hosts one of the largest airshows in the USA annually.",detail:"KLAL hosts Sun 'n Fun each spring. Check NOTAMs before any flight near Lakeland in April. TFRs are active during event periods."},
    ],
    atcNotes:"Tower 124.15 · Ground 121.9\nCheck NOTAMs for Sun 'n Fun TFR each spring.",
    cfiNotes:"Lakeland is a solid training field. Three-runway complex needs diagram study. Sun 'n Fun TFR is a teachable moment for NOTAM checking.",
  },
  KPGD:{ name:"Punta Gorda Airport", city:"Punta Gorda, FL", elevation:26, class:"Class D", type:"Towered", runways:["04/22 — 8,001ft","15/33 — 5,000ft"], region:"florida", weather_icao:"KPGD",
    hazards:[
      {id:"CB",phase:["all"],sev:"critical",icon:"⛈",title:"Charlotte County Thunderstorm Convergence Zone",why:"Punta Gorda sits in one of Florida's most active CB convergence areas.",detail:"Charlotte Harbor creates a local sea breeze convergence zone that concentrates afternoon CB activity. Storms develop faster here than surrounding areas. 13:00 ground rule is essential in summer."},
      {id:"BIRDS",phase:["takeoff","landing"],sev:"high",icon:"🦅",title:"Peace River Wildlife Corridor",detail:"Peace River corridor brings large bird populations near KPGD. Wading birds and vultures common on runway."},
    ],
    atcNotes:"Tower 124.0 · Ground 121.9 · Fort Myers Approach",
    cfiNotes:"PGD is a good primary training field — long runway, professional ATC. Charlotte convergence zone weather needs specific briefing. Always confirm: have you checked NOTAMs before departure?",
  },
  KSPG:{ name:"Albert Whitted Airport", city:"St Petersburg, FL", elevation:7, class:"Class D", type:"Towered", runways:["07/25 — 3,326ft","18/36 — 2,864ft"], region:"florida", weather_icao:"KSPG",
    hazards:[
      {id:"CLASS_B",phase:["all"],sev:"critical",icon:"📡",title:"Tampa Class B — Immediate Proximity",why:"Tampa International Class B shelf begins very close overhead.",detail:"KSPG is directly under Tampa International's Class B airspace. The Class B floor begins at 1,200ft MSL directly above the field. Do not climb above your ATC-assigned altitude without explicit Class B clearance from Tampa Approach."},
      {id:"SHORT",phase:["takeoff","landing"],sev:"critical",icon:"🛬",title:"Very Short Runways — Water on All Sides",why:"Both runways are short with Tampa Bay at multiple ends.",detail:"Runway 18/36 is only 2,864ft with Tampa Bay at both ends. Runway 07/25 is 3,326ft. Stabilised approach is mandatory. Any fast approach leaves very limited margin."},
      {id:"CB",phase:["all"],sev:"high",icon:"⛈",title:"Tampa Bay Thunderstorm Convergence",detail:"Tampa Bay is a known thunderstorm convergence zone. Ground by 12:30 in summer."},
    ],
    atcNotes:"Tower 124.1 · Ground 121.9 · Tampa Approach 119.9\nClass B begins at 1,200ft — do not climb without clearance.",
    cfiNotes:"Albert Whitted combines nearby Class B airspace, short runways, and water surroundings. Assess solo suitability under the applicable instructor/operator policy and brief all three hazards. Confirm current NOTAMs before departure.",
  },
  // ── TAMPA BAY ADDITIONS ───────────────────────────────────────────────────
  KPIE:{ name:"St Pete-Clearwater International Airport", city:"Clearwater, FL", elevation:11, class:"Class D", type:"Towered (part-time)", runways:["18/36 — 9,730ft","04/22 — 6,000ft"], region:"florida", weather_icao:"KPIE", source:FAA_SE_CURRENT,
    hazards:[
      {id:"CLASS_D",phase:["all"],sev:"high",icon:"📡",title:"Part-Time Class D — Status Changes When Tower Closes",why:"The published surface-airspace and communication procedures change outside tower hours.",detail:"KPIE is Class D during published tower hours and Class E when the tower is closed. Check the current Chart Supplement and NOTAMs, and use the published CTAF/tower frequency for the operating status."},
      {id:"AIRLINE",phase:["all"],sev:"high",icon:"✈",title:"Commercial and Charter Traffic Mix",why:"Scheduled airline and charter operations share the field with training traffic.",detail:"KPIE handles commercial airline, charter, and cargo traffic alongside training aircraft. Be alert to wake turbulence on departure and arrival. Monitor approach and tower frequencies carefully for commercial traffic sequencing."},
      {id:"CLASS_B",phase:["departure","all"],sev:"high",icon:"📡",title:"Tampa Class B Immediately Adjacent",why:"Tampa International's Class B begins just east of KPIE.",detail:"Departing north or east from KPIE brings you immediately towards Tampa International's Class B airspace. Co-ordinate with St Pete-Clearwater Approach before any northbound or eastbound departure climb."},
      {id:"CB",phase:["all"],sev:"high",icon:"⛈",title:"Tampa Bay Afternoon Thunderstorms",detail:"Sea-breeze convergence can produce rapidly developing convection. Use current observations, TAFs, radar, an official briefing, and defined personal or operator weather limits."},
    ],
    atcNotes:"CTAF/Tower 118.3 or 128.4 · Ground 121.9 · Clearance 120.6 · ATIS 134.5\nTampa Approach/Departure 125.3. Class D during published tower hours; Class E when closed.",
    cfiNotes:"KPIE is useful for controlled-airport, wake-turbulence, and part-time-tower training. Brief the current tower status, adjacent Tampa Class B, assigned runway, frequencies, and NOTAMs before the flight.",
  },
  KVDF:{ name:"Tampa Executive Airport", city:"Tampa, FL", elevation:21, class:"Class G", type:"Non-Towered", runways:["05/23 — 5,000ft","18/36 — 3,219ft"], region:"florida", weather_icao:"KVDF", source:FAA_SE_CURRENT,
    hazards:[
      {id:"CLASS_B",phase:["all"],sev:"critical",icon:"📡",title:"Tampa International Class B — Nearby Shelf",why:"KVDF lies beneath complex Tampa-area controlled airspace requiring careful altitude and route planning.",detail:"KVDF has no control tower. Review the current sectional and Tampa Class B shelf before flight, monitor the published CTAF, and contact Tampa Approach when required for the planned operation."},
      {id:"SHORT",phase:["takeoff","landing"],sev:"high",icon:"🛬",title:"Shorter Runway 18/36 — Performance Planning Required",why:"Runway 18/36 is substantially shorter than 05/23.",detail:"Runway 05/23 is 5,000ft and 18/36 is 3,219ft. Calculate takeoff and landing performance for actual temperature, wind, surface, weight, and runway conditions."},
      {id:"AIRSPACE",phase:["all"],sev:"high",icon:"📡",title:"Complex Overlapping Airspace",why:"KVDF sits in one of Florida's most complex airspace environments.",detail:"Tampa International to the northwest, MacDill AFB Class C/P-50 restricted area to the south, and St Pete-Clearwater Class C to the west. Know your airspace chart thoroughly before flying in this area."},
      {id:"CB",phase:["all"],sev:"high",icon:"⛈",title:"Tampa Bay Thunderstorm Convergence",detail:"Tampa Bay sea breeze convergence creates rapid CB development. Ground all training by 13:00 in summer."},
    ],
    atcNotes:"CTAF/UNICOM 122.7 · Tampa Approach 119.9 · AWOS 121.125\nNon-towered. Obtain clearance delivery through Tampa Approach and confirm current airspace, frequencies, and NOTAMs.",
    cfiNotes:"KVDF combines non-towered procedures with complex Tampa-area airspace. Review solo suitability under the applicable instructor/operator policy, and include nearby special-use airspace and current NOTAMs in the brief.",
  },
  KCLW:{ name:"Clearwater Executive Airport", city:"Clearwater, FL", elevation:71, class:"Uncontrolled", type:"Non-Towered", runways:["16/34 — 4,108ft"], region:"florida", weather_icao:"KPIE", source:FAA_SE_CURRENT,
    hazards:[
      {id:"LIMITS",phase:["taxi","pattern","takeoff","landing"],sev:"high",icon:"📻",title:"Published Operating Limits — Full-Stop Landings Only",why:"The current Chart Supplement publishes operating-hour and circuit restrictions that affect training use.",detail:"Landings and takeoffs are permitted only during the published 1200–0400Z period. Full-stop landings only; touch-and-go operations are not permitted. Confirm current times and NOTAMs before dispatch."},
      {id:"DISPLACED",phase:["takeoff","landing"],sev:"high",icon:"🛬",title:"Displaced Thresholds and Trees",why:"The 4,108ft runway has substantial displaced thresholds and published obstacles.",detail:"Runway 16 has a 357ft displaced threshold; Runway 34 has an 846ft displaced threshold, trees, and right traffic. Use current published distances and calculate performance for the actual conditions and aircraft."},
      {id:"CB",phase:["all"],sev:"high",icon:"⛈",title:"Tampa Bay Thunderstorms",detail:"Sea-breeze convergence can produce rapidly developing convection. The field is non-towered, so use current observations, radar, TAFs, and an official weather briefing."},
    ],
    atcNotes:"CTAF/UNICOM 123.0 · AWOS-3P 119.225 · Tampa Approach/Departure 125.3\nNon-towered. Confirm current communications, published operating times, restrictions, and NOTAMs.",
    cfiNotes:"KCLW is useful for teaching non-towered procedures and disciplined performance planning. Brief the full-stop-only restriction, displaced thresholds, right traffic for Runway 34, published operating period, and current NOTAMs.",
  },
  KIMM:{ name:"Immokalee Regional Airport", city:"Immokalee, FL", elevation:37, class:"Uncontrolled", type:"Non-Towered", runways:["09/27 — 5,000ft","18/36 — 4,550ft"], region:"florida", weather_icao:"KRSW",
    hazards:[
      {id:"NONTOW",phase:["all"],sev:"critical",icon:"📻",title:"Non-Towered — Self-Announce Required",why:"No ATC — all separation is pilot responsibility.",detail:"KIMM has no control tower. All pilots must self-announce on CTAF 122.8. Announce at every standard reporting point: 10nm inbound, downwind, base, final, and clear of runway."},
      {id:"CB",phase:["all"],sev:"critical",icon:"⛈",title:"Southwest Florida Thunderstorms + No Tower Warning",why:"No tower means no weather alerts — you must self-brief.",detail:"At a non-towered field, there is no ATC to warn you about developing weather. You are responsible for your own weather awareness. Monitor weather radar on ForeFlight/Garmin Pilot. Set a personal 13:00 turn-around rule in summer."},
      {id:"AGRIC",phase:["pattern","all"],sev:"high",icon:"✈",title:"Agricultural / Crop-Dusting Traffic",detail:"Immokalee area has active agricultural aviation operating at very low altitude. Maintain vigilant lookout below pattern altitude."},
    ],
    atcNotes:"CTAF 122.8 — No tower.\nNo ATC weather service — monitor weather independently.",
    cfiNotes:"KIMM is excellent for introducing non-towered operations. Key lesson: all separation is pilot responsibility. Weather self-briefing discipline is critical. Always confirm: have you checked NOTAMs before departure?",
  },
  KDED:{ name:"DeLand Municipal Airport", city:"DeLand, FL", elevation:79, class:"Uncontrolled", type:"Non-Towered", runways:["12/30 — 6,001ft","05/23 — 4,300ft"], region:"florida", weather_icao:"KDED",
    hazards:[
      {id:"JUMP",phase:["all"],sev:"critical",icon:"🪂",title:"Active Parachute Drop Zone — CRITICAL",why:"DeLand is one of the busiest skydiving drop zones in the USA.",detail:"KDED is home to Skydive DeLand — one of the world's busiest skydiving operations. Jumpers and jump aircraft are in the air continuously during operating hours. Jumpers have no radio and are in freefall at speeds exceeding 120mph. Do not operate here without a thorough CFI brief on skydive operations."},
      {id:"NONTOW",phase:["all"],sev:"high",icon:"📻",title:"Non-Towered — Jump Aircraft Priority",detail:"No ATC. CTAF 122.9. Jump aircraft announce exit altitude and jumper count. All other traffic must accommodate."},
      {id:"CB",phase:["all"],sev:"high",icon:"⛈",title:"Central Florida Thunderstorms",detail:"Central Florida afternoon CB — check TAF, morning flights preferred."},
    ],
    atcNotes:"CTAF 122.9 — No tower.\nSkydive DeLand actively operating — monitor jump aircraft calls continuously.",
    cfiNotes:"DeLand is an important non-towered skydiving environment for student awareness. Review current parachute operations, published procedures, CTAF practices, and NOTAMs before approving student operations there.",
  },
  KZPH:{ name:"Zephyrhills Municipal Airport", city:"Zephyrhills, FL", elevation:90, class:"Uncontrolled", type:"Non-Towered", runways:["05/23 — 5,001ft","01/19 — 6,201ft"], region:"florida", weather_icao:"KZPH",
    hazards:[
      {id:"JUMP",phase:["all"],sev:"critical",icon:"🪂",title:"Active Parachute Operations",why:"ZPH is a major skydiving centre — jumpers in freefall have no radio.",detail:"Zephyrhills is home to Skydive City — a major drop zone. Jump aircraft operate continuously. Monitor CTAF 122.8 for jump aircraft departure and jumper-in-air announcements."},
      {id:"NONTOW",phase:["all"],sev:"high",icon:"📻",title:"Non-Towered Airport",detail:"No ATC. Self-announce all positions on CTAF 122.8."},
      {id:"CB",phase:["all"],sev:"high",icon:"⛈",title:"Central Florida Thunderstorms",detail:"Tampa Bay/central Florida CB — afternoon storms common. Check TAF."},
    ],
    atcNotes:"CTAF 122.8 — No tower.\nSkydive City actively operating — monitor jump aircraft calls.",
    cfiNotes:"Same brief as DeLand — skydiving operations are the defining hazard. Always confirm: have you checked NOTAMs before departure?",
  },
  KTIX:{ name:"Space Coast Regional Airport", city:"Titusville, FL", elevation:34, class:"Class D", type:"Towered", runways:["18/36 — 7,319ft","09/27 — 5,000ft"], region:"florida", weather_icao:"KTIX",
    hazards:[
      {id:"KSC",phase:["all"],sev:"critical",icon:"📡",title:"Kennedy Space Center — Launch TFRs",why:"KSC is directly adjacent — launch TFRs activate with short notice.",detail:"Titusville is immediately west of Kennedy Space Center. Launch TFRs can extend to FL180 and activate within hours. Check NOTAMs before every flight. This is not academic — enforcement actions have been taken against pilots who entered active KSC TFRs."},
      {id:"CB",phase:["all"],sev:"high",icon:"⛈",title:"Space Coast Thunderstorms",detail:"Atlantic coast CB plus sea breeze effects near KSC. Check TAF."},
      {id:"BIRDS",phase:["takeoff","landing"],sev:"high",icon:"🦅",title:"Merritt Island Wildlife Refuge",detail:"Merritt Island NWR is adjacent — one of the most diverse wildlife refuges in the eastern USA. Birds common on and near runways at all times."},
    ],
    atcNotes:"Tower 120.5 · Ground 121.9\nCheck KSC launch NOTAM before every flight — TFR to FL180 possible.",
    cfiNotes:"TIX is excellent for cross-country training with long runway. KSC TFR awareness is the critical brief — check it every flight. Always confirm: have you checked NOTAMs before departure?",
  },
  KAPF:{ name:"Naples Municipal Airport", city:"Naples, FL", elevation:8, class:"Class D", type:"Towered", runways:["05/23 — 5,000ft","14/32 — 5,000ft"], region:"florida", weather_icao:"KAPF",
    hazards:[
      {id:"CB",phase:["all"],sev:"critical",icon:"⛈",title:"Frequent Southwest Florida Thunderstorms",why:"Summer convection is frequent and can develop rapidly in southwest Florida.",detail:"Naples commonly experiences afternoon thunderstorms from June through September. Use current observations, TAFs, radar, official briefings, and defined personal or operator weather limits rather than a fixed clock rule."},
      {id:"BIRDS",phase:["takeoff","landing"],sev:"high",icon:"🦅",title:"Everglades / Gulf Coast Bird Activity",detail:"Naples is between the Gulf and Everglades — extremely high bird activity. Vultures common on runways. Report all wildlife to tower."},
      {id:"CROSS",phase:["takeoff","landing"],sev:"high",icon:"🛬",title:"Intersecting Runway Operations",detail:"Runways 05/23 and 14/32 intersect. Confirm all crossing clearances. Never cross active runway without explicit ATC clearance."},
    ],
    atcNotes:"Tower 120.95 · Ground 121.9 · Fort Myers Approach 119.9",
    cfiNotes:"Naples has high bird activity and some of Florida's worst afternoon CB development. Both hazards need specific daily briefing. Always confirm: have you checked NOTAMs before departure?",
  },

  // ── ARIZONA ───────────────────────────────────────────────────────────────
  KDVT:{ name:"Deer Valley Airport", city:"Phoenix, AZ", elevation:1478, class:"Class D", type:"Towered", runways:["07L/25R — 4,500ft","07R/25L — 8,208ft"], region:"phoenix", weather_icao:"KDVT",
    hazards:[
      {id:"DA",phase:["takeoff","departure"],sev:"critical",icon:"🌡",title:"Extreme Density Altitude",why:"This is the #1 cause of student accidents at Phoenix-area fields.",detail:"Phoenix summer temps exceed 45°C regularly. DA at KDVT can exceed 4,500ft from a 1,478ft field. Your aircraft POH numbers are at sea level, 15°C standard conditions — they do not apply here. Calculate performance every flight. Do not guess."},
      {id:"PARALLEL",phase:["takeoff","landing"],sev:"critical",icon:"⚠",title:"Parallel Runway Confusion",why:"Students regularly accept the wrong runway or line up incorrectly.",detail:"KDVT has parallel runways 07L/25R and 07R/25L. Read back your runway assignment every time. Before lining up, read the runway number painted on the surface and confirm it matches your clearance."},
      {id:"PATTERN",phase:["pattern"],sev:"high",icon:"✈",title:"Extremely Busy Pattern — Multi-School Traffic",why:"High collision risk environment.",detail:"KDVT handles over 500 operations per day — one of the busiest GA airports in the USA. Multiple schools operate simultaneously. Announce every position, make standard radio calls, and never assume the pattern is clear."},
      {id:"MULTI",phase:["pattern","all"],sev:"high",icon:"📻",title:"Non-Standard Radio Calls / Non-Native Readbacks",why:"Miscommunication risk in multi-school environment.",detail:"KDVT hosts international students who may not be native English speakers. Readbacks may be unclear. If you hear an ambiguous readback, maintain visual awareness. Read back slowly and correctly."},
      {id:"DUST",phase:["all"],sev:"high",icon:"🌪",title:"Haboob / Dust Storm",why:"Can reduce visibility to zero in minutes with no warning.",detail:"A haboob is a wall of dust that can be 1,500ft high and move at 30-50kt. Land immediately and tie down. Do not try to outrun a haboob."},
    ],
    atcNotes:"Tower 132.075 · Ground 121.8 · ATIS 134.975\nExpect sequencing in busy periods. Report parallel runway confusion immediately.",
    cfiNotes:"Deer Valley's parallel runways require explicit runway verification. Include density altitude and aircraft performance in every warm-weather brief, using current conditions and POH/AFM data. Confirm current NOTAMs.",
  },
  KFFZ:{ name:"Falcon Field Airport", city:"Mesa, AZ", elevation:1394, class:"Class D", type:"Towered", runways:["04L/22R — 3,799ft","04R/22L — 5,101ft"], region:"phoenix", weather_icao:"KFFZ",
    hazards:[
      {id:"DA",phase:["takeoff","departure"],sev:"critical",icon:"🌡",title:"Extreme Density Altitude + Short Runway Trap",why:"Short runway combined with high DA is a documented accident cause.",detail:"Runway 04L is only 3,799ft — short even in normal conditions. In summer heat with DA exceeding 4,000ft, takeoff roll and obstacle clearance performance are dramatically reduced. Students should use 04R/22L (5,101ft) by default in summer."},
      {id:"CLASS_B",phase:["departure","all"],sev:"critical",icon:"📡",title:"Phoenix Sky Harbor Class B Proximity",why:"Inadvertent Class B entry is a certificate-action offence.",detail:"Phoenix Sky Harbor Class B airspace shelf begins at 2,000ft MSL in some sectors near KFFZ. Do not climb above your assigned altitude without an explicit Class B clearance from Phoenix Approach."},
      {id:"PARALLEL",phase:["takeoff","landing"],sev:"high",icon:"⚠",title:"Parallel Runway Confusion",detail:"Same parallel runway risk as KDVT. Read the runway number on the surface before every lineup."},
      {id:"DUST",phase:["all"],sev:"high",icon:"🌪",title:"Haboob Risk",detail:"Same Phoenix haboob hazard as all valley fields. Land immediately at first sign of approaching dust wall."},
    ],
    atcNotes:"Tower 132.85 · Ground 121.9 · Phoenix Approach 124.0 (departing east)",
    cfiNotes:"Short runway 04L is the key trap at Falcon — reinforce runway selection in hot weather. Class B proximity is the second critical brief. Always confirm: have you checked NOTAMs before departure?",
  },
  KCHD:{ name:"Chandler Municipal Airport", city:"Chandler, AZ", elevation:1243, class:"Class D", type:"Towered", runways:["04L/22R — 4,900ft","04R/22L — 5,600ft"], region:"phoenix", weather_icao:"KCHD",
    hazards:[
      {id:"DA",phase:["takeoff","departure"],sev:"critical",icon:"🌡",title:"Extreme Density Altitude",detail:"At 1,243ft with Phoenix summer heat, DA regularly exceeds 4,500ft. Performance calculations mandatory."},
      {id:"AIRSPACE",phase:["all"],sev:"critical",icon:"📡",title:"Williams Gateway (KIWA) Class C — Immediately Adjacent",why:"KIWA Class C shelf begins very close to KCHD traffic patterns.",detail:"Phoenix-Mesa Gateway Class C starts immediately east of KCHD. An eastbound departure can penetrate KIWA's Class C shelf within seconds of takeoff. Establish contact with Williams Gateway Approach 119.5 before climbing eastbound."},
      {id:"MULTI",phase:["pattern","all"],sev:"high",icon:"📻",title:"Multi-School / Non-Native Readbacks",detail:"Multiple flight schools operate at KCHD simultaneously. International students and non-native English speakers are common."},
      {id:"DUST",phase:["all"],sev:"high",icon:"🌪",title:"Haboob Risk",detail:"Standard Phoenix haboob hazard. Land and tie down immediately."},
    ],
    atcNotes:"Tower 132.35 · Ground 121.9 · Williams Gateway Approach 119.5 (eastbound departures)",
    cfiNotes:"KIWA Class C proximity is the defining hazard at Chandler — students have entered Class C inadvertently on eastbound departures. Always confirm: have you checked NOTAMs before departure?",
  },
  KIWA:{ name:"Phoenix-Mesa Gateway Airport", city:"Mesa, AZ", elevation:1382, class:"Class C", type:"Towered", runways:["12L/30R — 10,401ft","12R/30L — 10,201ft","10/28 — 9,301ft"], region:"phoenix", weather_icao:"KIWA",
    hazards:[
      {id:"CLASS_C",phase:["all"],sev:"critical",icon:"📡",title:"Class C — Two-Way Communication Required",why:"This is the most commonly misunderstood airspace rule for student pilots.",detail:"You MUST establish two-way radio communication with KIWA Approach BEFORE entering Class C airspace — this means ATC must use your callsign in response. 'N12345, standby' counts. 'Traffic, standby' does NOT."},
      {id:"DA",phase:["takeoff","departure"],sev:"critical",icon:"🌡",title:"Extreme Density Altitude",detail:"Long runways can create false security. Even with 10,000ft available, a 4,500ft DA significantly reduces climb performance."},
      {id:"JETS",phase:["pattern","landing"],sev:"high",icon:"✈",title:"Jet Traffic — Wake Turbulence Risk",why:"Airline training jets share runways with GA training aircraft.",detail:"KIWA hosts Lufthansa and CAE airline training in jets alongside GA training. Wake turbulence from a departing jet can flip a light training aircraft. Stay above the jet's flight path on approach."},
      {id:"MULTI",phase:["all"],sev:"high",icon:"📻",title:"Multi-School / Non-Native Readbacks",detail:"KIWA hosts international training programmes. Non-native English readbacks are common. Monitor radio carefully."},
    ],
    atcNotes:"Approach 119.5 · Tower 118.7 · Ground 121.9\nMandatory Class C contact before entering. Wake turbulence separation from jets — ask ATC if unsure.",
    cfiNotes:"KIWA is excellent for introducing Class C operations. Focus the brief on the two-way communication requirement and wake turbulence from airline training jets. Always confirm: have you checked NOTAMs before departure?",
  },
  KGYR:{ name:"Phoenix Goodyear Airport", city:"Goodyear, AZ", elevation:968, class:"Class D", type:"Towered", runways:["03/21 — 8,500ft"], region:"phoenix", weather_icao:"KGYR",
    hazards:[
      {id:"DA",phase:["takeoff","departure"],sev:"critical",icon:"🌡",title:"Extreme Density Altitude",detail:"Phoenix heat at 968ft elevation — DA can exceed 4,500ft in summer. Long runways give false security — climb performance is the critical constraint."},
      {id:"MILITARY",phase:["all"],sev:"high",icon:"📡",title:"Luke AFB MOA and Restricted Areas",why:"Luke Air Force Base is immediately adjacent with active military training airspace.",detail:"Luke AFB is immediately north of KGYR. Luke's MOA and Restricted Areas are frequently active with F-35 training. Do not depart northbound without checking Luke Restricted Area status."},
      {id:"DUST",phase:["all"],sev:"high",icon:"🌪",title:"Haboob / Dust Storm",detail:"Standard Phoenix haboob risk. Land immediately and tie down at first sign of approaching dust wall."},
      {id:"MULTI",phase:["pattern","all"],sev:"high",icon:"📻",title:"Multi-School / Non-Native Readbacks",detail:"Multiple international training programmes at GYR. Non-native English readbacks common."},
    ],
    atcNotes:"Tower 133.4 · Ground 121.9 · Luke Approach 124.5\nConfirm Luke restricted area status before northbound departures.",
    cfiNotes:"Goodyear's Luke AFB adjacency is the key brief — reinforce restricted area boundaries before every flight. Always confirm: have you checked NOTAMs before departure?",
  },
  KSDL:{ name:"Scottsdale Airport", city:"Scottsdale, AZ", elevation:1510, class:"Class D", type:"Towered", runways:["03/21 — 8,501ft"], region:"phoenix", weather_icao:"KSDL",
    hazards:[
      {id:"DA",phase:["takeoff","departure"],sev:"critical",icon:"🌡",title:"Extreme Density Altitude — Elevated Field",detail:"At 1,510ft with Phoenix summer heat, DA can exceed 5,000ft. The highest-elevation major training airport in the Phoenix metro. Recalculate all performance data."},
      {id:"CLASS_B",phase:["all"],sev:"critical",icon:"📡",title:"Phoenix Sky Harbor Class B — Overhead",why:"Scottsdale sits directly under a Phoenix Class B shelf.",detail:"Sky Harbor Class B airspace shelf begins at 3,000ft MSL over KSDL — closer than it sounds given the 1,510ft field elevation. Northbound and westbound departures can reach Class B altitude quickly."},
      {id:"FAST",phase:["pattern","all"],sev:"high",icon:"✈",title:"Fast-Paced Environment — Advanced Traffic",why:"Scottsdale attracts more experienced pilots — pace is faster than typical training fields.",detail:"KSDL has a mix of high-performance piston, turboprop, and jet traffic alongside training aircraft. Pattern pace is faster than fields like KDVT. Good progression field for advanced students."},
      {id:"DUST",phase:["all"],sev:"high",icon:"🌪",title:"Haboob Risk",detail:"Standard Phoenix haboob hazard. Land and tie down immediately."},
    ],
    atcNotes:"Tower 132.1 · Ground 121.9 · Phoenix Approach 124.0\nClass B begins at 3,000ft — confirm before climbing.",
    cfiNotes:"SDL is a useful progression field for pilots ready for a more complex environment. Assess solo suitability using the student's demonstrated proficiency, current conditions, and the applicable instructor/operator policy. Confirm current NOTAMs.",
  },
  KPRC:{ name:"Ernest A. Love Field (Prescott)", city:"Prescott, AZ", elevation:5045, class:"Class D", type:"Towered", runways:["03L/21R — 7,550ft","03R/21L — 4,847ft","12/30 — 4,000ft"], region:"phoenix", weather_icao:"KPRC",
    hazards:[
      {id:"DA",phase:["takeoff","departure"],sev:"critical",icon:"🌡",title:"HIGH ELEVATION — 5,045ft — Density Altitude Extreme",why:"Prescott is one of the highest training airports in Arizona.",detail:"At 5,045ft elevation, DA is significant even in mild weather. In summer (OAT 30°C+), DA can exceed 8,000ft. Aircraft have crashed at Prescott after failing to achieve safe climb rates. Calculate takeoff and climb performance carefully."},
      {id:"TERRAIN",phase:["departure","all"],sev:"critical",icon:"⛰",title:"Mountainous Terrain — All Quadrants",why:"Prescott is surrounded by the Bradshaw and Mingus mountains.",detail:"Prescott sits in a valley surrounded by mountains. Departures to west and south encounter rising terrain quickly. In low cloud or reduced visibility, CFIT risk is significant. Do not depart in marginal VMC without thorough terrain awareness."},
      {id:"THUNDER",phase:["all"],sev:"high",icon:"⛈",title:"Arizona Monsoon — Mountain Thunderstorms",detail:"Monsoon season (July-September): afternoon CB develops rapidly on surrounding mountains. Morning flights only in monsoon season."},
    ],
    atcNotes:"Tower 119.9 · Ground 121.9\nMountain terrain — know your departure procedure and minimum safe altitudes.",
    cfiNotes:"Prescott is an advanced training environment. Density altitude at 5,045ft is critical. Embry-Riddle operates here — high training volume. Always confirm: have you checked NOTAMs before departure?",
  },
  KFLG:{ name:"Flagstaff Pulliam Airport", city:"Flagstaff, AZ", elevation:7014, class:"Class D", type:"Towered", runways:["03/21 — 8,800ft"], region:"phoenix", weather_icao:"KFLG",
    hazards:[
      {id:"DA",phase:["takeoff","departure"],sev:"critical",icon:"🌡",title:"EXTREME ELEVATION — 7,014ft",why:"At 7,014ft, DA can exceed 10,000ft in summer — aircraft performance is drastically reduced.",detail:"In summer, DA regularly exceeds 9,000-10,000ft. A Cessna 172 that normally climbs at 700fpm may climb at 300fpm or less. Takeoff roll can be double the sea-level distance. Do not operate at KFLG without thoroughly understanding high-altitude performance."},
      {id:"TERRAIN",phase:["departure","all"],sev:"critical",icon:"⛰",title:"San Francisco Peaks — Terrain in All Directions",detail:"Humphreys Peak (12,633ft) is visible from KFLG — 5,619ft above field elevation. Departures in all directions encounter terrain. Know published departure procedures."},
      {id:"WINTER",phase:["all"],sev:"high",icon:"❄",title:"Winter Operations — Snow and Ice",detail:"Flagstaff receives significant winter snowfall. Runway contamination, aircraft icing, and limited de-icing facilities are factors."},
      {id:"THUNDER",phase:["all"],sev:"high",icon:"⛈",title:"Monsoon Thunderstorms — Mountain Enhanced",detail:"Summer monsoon with mountain-enhanced CB. Afternoon storms are severe and fast-developing at 7,000ft."},
    ],
    atcNotes:"Tower 118.65 · Ground 121.9\nHigh elevation — brief performance carefully before every flight.",
    cfiNotes:"Flagstaff is an advanced high-elevation training environment. Assess student readiness carefully and use the aircraft's POH/AFM performance data for the actual pressure altitude, temperature, weight, wind, and runway conditions. Confirm current NOTAMs.",
  },
  KBXK:{ name:"Buckeye Municipal Airport", city:"Buckeye, AZ", elevation:1033, class:"Uncontrolled", type:"Non-Towered", runways:["17/35 — 5,500ft"], region:"phoenix", weather_icao:"KGYR",
    hazards:[
      {id:"NONTOW",phase:["all"],sev:"high",icon:"📻",title:"Non-Towered Airport",detail:"No ATC. Self-announce all positions on CTAF 122.8."},
      {id:"DA",phase:["takeoff","departure"],sev:"critical",icon:"🌡",title:"Extreme Density Altitude — Phoenix Area",detail:"Buckeye Phoenix-area heat — DA can exceed 5,000ft in summer. Long runway gives false security."},
      {id:"MILITARY",phase:["all"],sev:"critical",icon:"📡",title:"Luke AFB MOA — Direct Proximity",why:"Buckeye is immediately adjacent to Luke's active military training airspace.",detail:"Luke AFB Restricted Areas and MOAs are immediately north and west of KBXK. F-35 training aircraft operate at high speed. Do not depart northbound or westbound without confirming Luke airspace status."},
      {id:"DUST",phase:["all"],sev:"high",icon:"🌪",title:"Haboob Risk",detail:"Western Phoenix desert location — high haboob risk. Land and tie down immediately."},
    ],
    atcNotes:"CTAF 122.8 — No tower.\nLuke MOA immediately adjacent — confirm status before northbound or westbound departures.",
    cfiNotes:"Buckeye's combination of non-towered operations and Luke military airspace makes it an excellent advanced training field. Always confirm: have you checked NOTAMs before departure?",
  },
  KCGZ:{ name:"Casa Grande Municipal Airport", city:"Casa Grande, AZ", elevation:1464, class:"Uncontrolled", type:"Non-Towered", runways:["05/23 — 5,200ft"], region:"phoenix", weather_icao:"KCGZ",
    hazards:[
      {id:"NONTOW",phase:["all"],sev:"high",icon:"📻",title:"Non-Towered Airport",detail:"No ATC. Self-announce all positions on CTAF 122.8. All separation is pilot responsibility."},
      {id:"DA",phase:["takeoff","departure"],sev:"high",icon:"🌡",title:"Density Altitude — Desert Valley",detail:"Casa Grande summer heat at 1,464ft elevation — DA can exceed 5,000ft. Recalculate performance."},
      {id:"DUST",phase:["all"],sev:"high",icon:"🌪",title:"Haboob Risk",detail:"Desert location — haboob risk. Land and tie down immediately at first sign of dust wall."},
    ],
    atcNotes:"CTAF 122.8 — No tower.",
    cfiNotes:"CGZ is a useful non-towered field for self-announce practice away from the Phoenix metro. Always confirm: have you checked NOTAMs before departure?",
  },
  KSOW:{ name:"Show Low Regional Airport", city:"Show Low, AZ", elevation:6415, class:"Class D", type:"Towered", runways:["07/25 — 7,200ft","04/22 — 3,920ft"], region:"phoenix", weather_icao:"KSOW",
    hazards:[
      {id:"DA",phase:["takeoff","departure"],sev:"critical",icon:"🌡",title:"HIGH ELEVATION — 6,415ft",detail:"Show Low sits at 6,415ft on the Mogollon Rim. DA in summer can exceed 9,000ft. Performance calculations are critical — sea-level data is not applicable."},
      {id:"TERRAIN",phase:["departure","all"],sev:"critical",icon:"⛰",title:"Mogollon Rim Terrain",detail:"The Mogollon Rim drops 2,000ft immediately south of Show Low. Terrain awareness in all directions is essential."},
      {id:"THUNDER",phase:["all"],sev:"high",icon:"⛈",title:"Mountain Monsoon Thunderstorms",detail:"White Mountains monsoon season — severe afternoon CB. Morning flights only July-September."},
    ],
    atcNotes:"Tower 123.0 · Ground 121.9",
    cfiNotes:"Show Low is an excellent high-altitude cross-country destination for advanced students. Density altitude and Mogollon Rim terrain are the essential briefs. Always confirm: have you checked NOTAMs before departure?",
  },

  // ── UNITED KINGDOM ────────────────────────────────────────────────────────
  EGBP:{ name:"Kemble (Cotswold Airport)", city:"Kemble, Gloucestershire", elevation:433, class:"Class G", type:"Uncontrolled", runways:["08/26 — 2,000m"], region:"uk", weather_icao:"EGBJ",
    hazards:[
      {id:"NONTOW",phase:["all"],sev:"high",icon:"📻",title:"Uncontrolled — Radio Discipline Required",why:"No ATC — all separation is pilot responsibility.",detail:"Kemble is a busy uncontrolled field. Make blind calls at all reporting points and listen out continuously on the A/G frequency. Do not assume other traffic has heard your call."},
      {id:"GLIDER",phase:["pattern","all"],sev:"medium",icon:"🪂",title:"Glider & Parachute Activity Nearby",why:"Shared local airspace with gliding and parachute operations.",detail:"Check NOTAMs for active parachute drop zones and glider launch sites before flight. Gliders may not be radio-equipped."},
      {id:"CLOUD",phase:["all"],sev:"high",icon:"☁",title:"Low Cloud Base — Common in Winter",why:"UK weather brings frequent low cloud and reduced visibility, especially Oct–Mar.",detail:"Check the actual TAF/METAR cloud base before flight. Use the cloud base tool in the weather panel as a planning aid, not a substitute for the actual report."},
    ],
    atcNotes:"Kemble A/G 122.995\nNo ATC — self-announce all positions.",
    cfiNotes:"Kemble is a good introduction to uncontrolled UK fields. Radio discipline and lookout are the defining briefs here. Always confirm: have you checked NOTAMs before departure?",
  },
  EGTE:{ name:"Exeter Airport", city:"Exeter, Devon", elevation:102, class:"Class D", type:"Towered", runways:["08/26 — 2,894m"], region:"uk", weather_icao:"EGTE",
    hazards:[
      {id:"CLASS_D",phase:["all"],sev:"high",icon:"🗼",title:"Class D — Clearance Required",why:"Exeter is controlled airspace — you need clearance to enter.",detail:"Establish two-way communication with Exeter Approach before entering the Class D zone. Do not enter without an explicit clearance."},
      {id:"COAST",phase:["all"],sev:"medium",icon:"🌊",title:"Coastal Weather — Fast-Changing Visibility",why:"Sea fog and haze can form quickly on the South Devon coast.",detail:"Check the actual METAR trend before and during flight, not just at departure. Coastal visibility can deteriorate faster than inland forecasts suggest."},
    ],
    atcNotes:"Exeter Approach 128.98 · Tower 119.8",
    cfiNotes:"Good Class D introduction field. Coastal weather changes fast — reinforce in-flight weather monitoring. Always confirm: have you checked NOTAMs before departure?",
  },
  EGHH:{ name:"Bournemouth Airport", city:"Bournemouth, Dorset", elevation:38, class:"Class D", type:"Towered", runways:["08/26 — 2,073m"], region:"uk", weather_icao:"EGHH",
    hazards:[
      {id:"CLASS_D",phase:["all"],sev:"high",icon:"🗼",title:"Class D — Clearance Required",why:"Bournemouth is controlled airspace.",detail:"Establish two-way communication with Bournemouth Approach before entering the Class D zone."},
      {id:"TRAFFIC",phase:["pattern","all"],sev:"medium",icon:"✈",title:"Mixed Traffic — GA and Commercial",why:"Shared with scheduled and charter commercial traffic.",detail:"Expect sequencing behind larger aircraft. Follow ATC instructions precisely and be ready for extended patterns."},
    ],
    atcNotes:"Bournemouth Approach 119.475 · Tower 125.6",
    cfiNotes:"Good introduction to a mixed GA/commercial traffic environment. Always confirm: have you checked NOTAMs before departure?",
  },
  EGBJ:{ name:"Gloucestershire Airport (Staverton)", city:"Staverton, Gloucestershire", elevation:101, class:"Class G", type:"ATZ — Full ATC Service (Tower)", runways:["09/27 — 1,246m","04/22 — 786m"], region:"uk", weather_icao:"EGBJ",
    hazards:[
      {id:"FULLATC",phase:["all"],sev:"medium",icon:"📻",title:"Full ATC Service Despite Class G",why:"Staverton sits outside controlled airspace but provides a full ATC service with positive control inside the ATZ, not a basic advisory service.",detail:"Radio contact with Gloster Tower is required, not merely recommended — ATC exercises positive control over all aircraft within the ATZ (2nm radius up to 2,000ft QFE). Establish contact before entering the ATZ and follow taxi/departure instructions as you would at any towered field."},
      {id:"CROSS",phase:["takeoff","landing"],sev:"medium",icon:"🛬",title:"Intersecting Runways",detail:"09/27 and 04/22 intersect. Confirm which runway is in use and expect circuit direction to vary."},
    ],
    atcNotes:"Gloster Tower 122.9 · Gloster Approach 128.555 · ATIS 127.475",
    cfiNotes:"Good field for reinforcing standard towered-airfield radio discipline — despite being Class G, Staverton runs full positive ATC control, not a Flight Information Service, so treat calls and clearances accordingly. Always confirm: have you checked NOTAMs before departure?",
  },
  EGTK:{ name:"Oxford Airport (Kidlington)", city:"Kidlington, Oxfordshire", elevation:270, class:"Class D", type:"Towered", runways:["01/19 — 1,506m","10/28 — 1,206m"], region:"uk", weather_icao:"EGTK",
    hazards:[
      {id:"CLASS_D",phase:["all"],sev:"high",icon:"🗼",title:"Class D — Clearance Required",detail:"Establish two-way communication with Oxford Approach before entering the zone."},
      {id:"TRAINING",phase:["pattern","all"],sev:"medium",icon:"✈",title:"High-Density Flight Training",why:"Oxford hosts a major flight training organisation.",detail:"Expect heavy circuit traffic and multiple training aircraft operating simultaneously. Maintain a strict lookout scan."},
    ],
    atcNotes:"Oxford Approach 125.325 · Tower 133.42",
    cfiNotes:"Busy Class D training environment — good for building radio and pattern discipline under load. Always confirm: have you checked NOTAMs before departure?",
  },
  EGTC:{ name:"Cranfield Airport", city:"Cranfield, Bedfordshire", elevation:358, class:"Class D", type:"Towered", runways:["04/22 — 1,808m"], region:"uk", weather_icao:"EGTC",
    hazards:[
      {id:"CLASS_D",phase:["all"],sev:"high",icon:"🗼",title:"Class D — Clearance Required",detail:"Establish two-way communication with Cranfield Approach before entering the zone."},
      {id:"UNI",phase:["pattern","all"],sev:"medium",icon:"✈",title:"University Flight Training Operations",detail:"Cranfield hosts university-affiliated flight training — expect structured but busy circuit traffic."},
    ],
    atcNotes:"Cranfield Approach 123.15 · Tower 134.22",
    cfiNotes:"Well-organised Class D field, good progression step from an uncontrolled airfield. Always confirm: have you checked NOTAMs before departure?",
  },
  EGKA:{ name:"Shoreham Airport", city:"Shoreham-by-Sea, West Sussex", elevation:7, class:"Class D", type:"Towered", runways:["02/20 — 1,000m","07/25 — 796m"], region:"uk", weather_icao:"EGKA",
    hazards:[
      {id:"CLASS_D",phase:["all"],sev:"high",icon:"🗼",title:"Class D — Clearance Required",detail:"Establish two-way communication with Shoreham Tower before entering the zone."},
      {id:"COAST",phase:["all"],sev:"medium",icon:"🌊",title:"Coastal Fog Risk",why:"Low-lying coastal field prone to sea fret.",detail:"Sea fret can form quickly along the South Coast. Monitor actual METAR closely, especially in spring and autumn."},
      {id:"SHORT",phase:["takeoff","landing"],sev:"medium",icon:"🛬",title:"Short Secondary Runway",detail:"07/25 is short at 796m — know your aircraft's performance before accepting it."},
    ],
    atcNotes:"Shoreham Tower 123.15",
    cfiNotes:"Coastal fog awareness is the standout brief here — reinforce checking trends, not just current conditions. Always confirm: have you checked NOTAMs before departure?",
  },
  EGBW:{ name:"Wellesbourne Mountford Airfield", city:"Wellesbourne, Warwickshire", elevation:154, class:"Class G", type:"ATZ — AFIS (Aerodrome Flight Information Service)", runways:["18/36 — 1,097m","05/23 — 741m"], region:"uk", weather_icao:"EGBB",
    hazards:[
      {id:"AFIS",phase:["all"],sev:"medium",icon:"📻",title:"AFIS, Not Basic Self-Announce",detail:"Wellesbourne runs a genuine AFIS with a licensed AFISO. Special calls at specific points are mandatory, and if the AFISO advises a different circuit direction or action than requested, follow their advice."},
      {id:"MULTI",phase:["pattern","all"],sev:"medium",icon:"📻",title:"Multiple Flying Schools",detail:"Several schools operate from Wellesbourne. Expect non-standard spacing — announce clearly, look before every turn."},
    ],
    atcNotes:"Wellesbourne Information 124.025",
    cfiNotes:"Good field for reinforcing radio discipline in a busy multi-school pattern with genuine AFIS — not a self-announce field, and mandatory special calls apply. Always confirm: have you checked NOTAMs before departure?",
  },
  EGHI:{ name:"Southampton Airport", city:"Southampton, Hampshire", elevation:44, class:"Class D", type:"Towered", runways:["02/20 — 1,723m"], region:"uk", weather_icao:"EGHI",
    hazards:[
      {id:"CLASS_D",phase:["all"],sev:"high",icon:"🗼",title:"Class D — Clearance Required",detail:"Establish two-way communication with Southampton Approach before entering the zone."},
      {id:"TRAFFIC",phase:["pattern","all"],sev:"medium",icon:"✈",title:"Scheduled Commercial Traffic",detail:"Shared with scheduled airline services. Expect to be sequenced behind larger aircraft."},
    ],
    atcNotes:"Southampton Approach 128.85 · Tower 118.2",
    cfiNotes:"Good introduction to mixed GA/commercial Class D operations. Always confirm: have you checked NOTAMs before departure?",
  },
  EGLK:{ name:"Blackbushe Airport", city:"Camberley, Hampshire", elevation:325, class:"Class G", type:"ATZ — AFIS (Aerodrome Flight Information Service)", runways:["07/25 — 1,384m"], region:"uk", weather_icao:"EGLF",
    hazards:[
      {id:"AFIS",phase:["all"],sev:"medium",icon:"📻",title:"AFIS — Not a Basic Advisory Service",why:"Blackbushe runs a genuine AFIS, not simple self-announce radio — ground movement requires ATSU approval.",detail:"Contact Blackbushe Information before entering the ATZ. Aircraft may not taxi or commence any ground movement — including after vacating the runway or refuelling — without approval from the ATSU."},
      {id:"BUSY",phase:["pattern","all"],sev:"medium",icon:"✈",title:"Busy Business Aviation Traffic",detail:"Blackbushe sees significant business jet and turboprop traffic alongside GA training — expect faster-moving aircraft in the pattern."},
    ],
    atcNotes:"Blackbushe Information 122.305",
    cfiNotes:"Mixed traffic speeds and genuine AFIS ground-movement rules are the key brief — this is not a self-announce field. Always confirm: have you checked NOTAMs before departure?",
  },
  EGHC:{ name:"Land's End Airport", city:"St Just, Cornwall", elevation:386, class:"Class G", type:"ATZ — Full ATC Service (Tower)", runways:["07/25 — 664m","13/31 — 605m"], region:"uk", weather_icao:"EGHC",
    hazards:[
      {id:"FULLATC",phase:["all"],sev:"medium",icon:"📻",title:"Full ATC Despite Class G",why:"Land's End runs a real control tower with a duty ATCO — not a basic advisory service.",detail:"Land's End Tower issues genuine clearances — engine start, taxi, and runway use all require ATC permission, the same as any towered field. Radio contact is required, not merely recommended."},
      {id:"COAST",phase:["all"],sev:"high",icon:"🌊",title:"Exposed Coastal Location — Rapid Weather Changes",why:"Extreme southwest tip of the UK, fully exposed to Atlantic weather.",detail:"Weather at Land's End can change very quickly due to its exposed coastal position. Wind and visibility should be monitored closely before and during flight."},
      {id:"SHORT",phase:["takeoff","landing"],sev:"medium",icon:"🛬",title:"Short Runways",detail:"Both runways are under 700m — know your aircraft's performance margins."},
    ],
    atcNotes:"Land's End Tower 120.255",
    cfiNotes:"Exposed coastal weather is the defining hazard — not a field for early solo cross-country without a thorough weather brief. Note this is full ATC, not self-announce. Always confirm: have you checked NOTAMs before departure?",
  },
  EGFH:{ name:"Swansea Airport", city:"Swansea, Wales", elevation:299, class:"Class G", type:"Uncontrolled (ATZ)", runways:["04/22 — 1,190m"], region:"uk", weather_icao:"EGFF",
    hazards:[
      {id:"NOWX",phase:["all"],sev:"low",icon:"🌦",title:"No On-Field METAR — Nearest Station is Cardiff",why:"Swansea does not publish its own METAR.",detail:"Live weather shown for this field is Cardiff Airport (EGFF), roughly 55km away — treat it as a regional reference, not exact on-field conditions. Confirm actual conditions by other means before flight."},
      {id:"NONTOW",phase:["all"],sev:"high",icon:"📻",title:"ATZ — Self-Announce",detail:"Listen out and make position calls on the A/G frequency."},
      {id:"TERRAIN",phase:["departure","all"],sev:"medium",icon:"⛰",title:"Rising Terrain to the North",detail:"South Wales terrain rises inland. Be aware of minimum safe altitudes on northbound routings, especially in poor visibility."},
    ],
    atcNotes:"Swansea Radio 119.7",
    cfiNotes:"Good field for introducing terrain awareness in a Welsh coastal-to-inland transition. Point out that live weather here is a Cardiff substitute, not an on-field reading. Always confirm: have you checked NOTAMs before departure?",
  },
  EGNX:{ name:"East Midlands Airport", city:"Castle Donington, Leicestershire", elevation:306, class:"Class D", type:"Towered", runways:["09/27 — 2,894m"], region:"uk", weather_icao:"EGNX",
    hazards:[
      {id:"CLASS_D",phase:["all"],sev:"high",icon:"🗼",title:"Class D — Clearance Required",detail:"Establish two-way communication with East Midlands Approach before entering the zone."},
      {id:"CARGO",phase:["pattern","all"],sev:"medium",icon:"✈",title:"Heavy Cargo and Commercial Traffic",why:"Major overnight cargo hub.",detail:"East Midlands is a significant freight hub with heavy aircraft movements. Expect to be sequenced carefully, including wake turbulence separation from larger jets."},
    ],
    atcNotes:"East Midlands Approach 134.175 · Tower 124.0",
    cfiNotes:"Good exposure to procedural separation from heavy commercial traffic, including wake turbulence awareness. Always confirm: have you checked NOTAMs before departure?",
  },
  EGBB:{ name:"Birmingham Airport", city:"Birmingham, West Midlands", elevation:327, class:"Class D", type:"Towered", runways:["15/33 — 3,052m"], region:"uk", weather_icao:"EGBB",
    hazards:[
      {id:"CLASS_D",phase:["all"],sev:"critical",icon:"🗼",title:"Major Class D Airport — Complex Clearance Environment",why:"Birmingham is a busy commercial airport — not typically used for ab-initio training.",detail:"Establish two-way communication with Birmingham Approach well before the zone boundary. Expect complex sequencing instructions among heavy commercial traffic. This field is better suited to advanced or radio-procedure training than early solo work."},
      {id:"TRAFFIC",phase:["pattern","all"],sev:"high",icon:"✈",title:"High-Volume Commercial Traffic",detail:"Significant scheduled and charter traffic. GA aircraft are a small minority of movements here."},
    ],
    atcNotes:"Birmingham Approach 118.05 · Tower 118.3",
    cfiNotes:"Reserve Birmingham for advanced radio procedure and complex-airspace training — not a first-solo environment. Always confirm: have you checked NOTAMs before departure?",
  },
  EGSC:{ name:"Cambridge Airport", city:"Cambridge, Cambridgeshire", elevation:47, class:"Class D", type:"Towered", runways:["05/23 — 1,997m"], region:"uk", weather_icao:"EGSC",
    hazards:[
      {id:"CLASS_D",phase:["all"],sev:"high",icon:"🗼",title:"Class D — Clearance Required",detail:"Establish two-way communication with Cambridge Approach before entering the zone."},
      {id:"BUSY",phase:["pattern","all"],sev:"medium",icon:"✈",title:"Business Aviation Traffic",detail:"Significant business jet movements alongside GA training. Expect a range of aircraft speeds in the pattern."},
    ],
    atcNotes:"Cambridge Approach 123.6 · Tower 122.2",
    cfiNotes:"Good mixed-traffic Class D environment for building confidence with faster aircraft sharing the circuit. Always confirm: have you checked NOTAMs before departure?",
  },
  EGSX:{ name:"North Weald Airfield", city:"North Weald, Essex", elevation:321, class:"Class G", type:"Uncontrolled (ATZ)", runways:["02/20 — 1,401m"], region:"uk", weather_icao:"EGSS",
    hazards:[
      {id:"NOWX",phase:["all"],sev:"low",icon:"🌦",title:"No On-Field METAR — Nearest Station is Stansted",why:"North Weald does not publish its own METAR.",detail:"Live weather shown for this field is London Stansted (EGSS), roughly 19km away — treat it as a regional reference, not exact on-field conditions. Confirm actual conditions by other means before flight."},
      {id:"NONTOW",phase:["all"],sev:"high",icon:"📻",title:"ATZ — Self-Announce",detail:"Listen out and make position calls on the A/G frequency."},
      {id:"HISTORIC",phase:["pattern","all"],sev:"low",icon:"✈",title:"Historic/Warbird Aircraft Activity",detail:"North Weald hosts historic and warbird aircraft — some with limited radio or non-standard circuit patterns. Maintain a strong visual lookout."},
    ],
    atcNotes:"North Weald A/G 123.525",
    cfiNotes:"Good field for reinforcing see-and-avoid discipline given the mix of aircraft types and speeds. Point out that live weather here is a Stansted substitute, not an on-field reading. Always confirm: have you checked NOTAMs before departure?",
  },
  EGMC:{ name:"Southend Airport", city:"Southend-on-Sea, Essex", elevation:49, class:"Class D", type:"Towered", runways:["05/23 — 1,856m"], region:"uk", weather_icao:"EGMC",
    hazards:[
      {id:"CLASS_D",phase:["all"],sev:"high",icon:"🗼",title:"Class D — Clearance Required",detail:"Establish two-way communication with Southend Approach before entering the zone."},
      {id:"THAMES",phase:["all"],sev:"medium",icon:"📡",title:"Proximity to London TMA / Thames Estuary Airspace",why:"Southend sits close to complex London-area controlled airspace.",detail:"Be aware of the boundaries of surrounding controlled airspace, particularly on routes towards London. Confirm clearances precisely."},
    ],
    atcNotes:"Southend Approach 130.775 · Tower 128.95",
    cfiNotes:"Good field for introducing students to operating near complex London-area airspace. Always confirm: have you checked NOTAMs before departure?",
  },
  EGKB:{ name:"Biggin Hill Airport", city:"Biggin Hill, Kent", elevation:599, class:"Class D", type:"Towered", runways:["03/21 — 1,802m"], region:"uk", weather_icao:"EGKB",
    hazards:[
      {id:"CLASS_D",phase:["all"],sev:"high",icon:"🗼",title:"Class D — Clearance Required",detail:"Establish two-way communication with Biggin Approach before entering the zone."},
      {id:"LONDON",phase:["all"],sev:"high",icon:"📡",title:"Close to London Airspace",why:"Biggin Hill sits close to London TMA and Gatwick/Heathrow zones.",detail:"Confirm routing and altitude restrictions carefully — this is a complex airspace environment close to some of the busiest controlled airspace in Europe."},
    ],
    atcNotes:"Biggin Approach 129.4 · Tower 134.8",
    cfiNotes:"Excellent field for advanced students building confidence operating near London's complex airspace. Always confirm: have you checked NOTAMs before departure?",
  },
  EGTF:{ name:"Fairoaks Airport", city:"Chobham, Surrey", elevation:80, class:"Class D", type:"AFIS within Heathrow CTR (special Local Flying Area)", runways:["06/24 — 813m"], region:"uk", weather_icao:"EGLL",
    hazards:[
      {id:"CLASSD",phase:["all"],sev:"high",icon:"📡",title:"Sits Inside Heathrow's Class D CTR",why:"Fairoaks is entirely within the London (Heathrow) Control Zone, with a special Local Flying Area (LFA) permitting operation up to 1,500ft QNH without individual Heathrow clearance.",detail:"All arrivals/departures must stay within the defined LFA and use the mandated southerly corridor unless IFR. Do not assume normal Class D clearance procedures apply outside the LFA — a real understanding of the special procedures is essential before flying here."},
      {id:"AFIS",phase:["all"],sev:"medium",icon:"📻",title:"AFIS, Not Basic Self-Announce",detail:"Contact Fairoaks Information before entering the ATZ — a licensed AFISO provides traffic and airfield information, not just a basic advisory radio."},
      {id:"NOWX",phase:["all"],sev:"low",icon:"🌦",title:"No On-Field METAR — Nearest Station is Heathrow",why:"Fairoaks does not publish its own METAR.",detail:"Live weather shown for this field is Heathrow (EGLL), roughly 15km away — treat it as a regional reference, not exact on-field conditions."},
      {id:"SHORT",phase:["takeoff","landing"],sev:"medium",icon:"🛬",title:"Short Runway",detail:"813m runway — know your aircraft's performance margins, especially in wet conditions."},
    ],
    atcNotes:"Fairoaks Information 123.43",
    cfiNotes:"Fairoaks involves specialised LFA procedures inside Heathrow's CTR. Assess pilot readiness under the applicable instructor/operator policy and brief the current AIP procedures. Live weather shown here is from Heathrow, not an on-field observation; confirm current NOTAMs.",
  },
  EGLF:{ name:"Farnborough Airport", city:"Farnborough, Hampshire", elevation:238, class:"Class D", type:"Towered — Full ATC (CTR since 2019/2020 airspace change)", runways:["06/24 — 2,440m"], region:"uk", weather_icao:"EGLF",
    hazards:[
      {id:"CLASSD",phase:["all"],sev:"high",icon:"🗼",title:"Class D CTR — Clearance Required",why:"Farnborough's Class D CTR/CTA structure was introduced by an approved airspace change in 2019/2020, replacing what was previously a much less formal Class G environment.",detail:"Establish two-way communication with Farnborough Radar/LARS well before the CTR boundary and obtain an explicit clearance — do not assume open access to this airspace on the basis of older charts or references."},
      {id:"BIZJET",phase:["pattern","all"],sev:"high",icon:"✈",title:"Heavy Business Jet Traffic",why:"Farnborough is a major executive/business aviation hub.",detail:"Expect a high proportion of business jets and turboprops, often significantly faster than light training aircraft. Wake turbulence awareness matters here."},
      {id:"ARRESTER",phase:["landing"],sev:"medium",icon:"⚠",title:"Runway Arrester Wires",detail:"The runway starter extensions can have arrester wires deployed at any time — do not use these sections for landing."},
      {id:"CLASSA",phase:["departure","all"],sev:"high",icon:"📡",title:"Class A London TMA Immediately Above",detail:"Class A airspace begins at 3,500ft in the London TMA overhead. Altitude discipline is essential — there is no margin for error climbing out."},
    ],
    atcNotes:"Farnborough Tower 122.5 · Approach/Radar 134.355 · Director 130.055 · LARS 125.25 · ATIS 128.405",
    cfiNotes:"Not a routine training field — reserve for advanced radio-procedure exposure. Emphasise that this is genuine Class D controlled airspace with mandatory clearance, not an informal Class G environment. Always confirm: have you checked NOTAMs before departure?",
  },
  EGTB:{ name:"Wycombe Air Park", city:"Booker, Buckinghamshire", elevation:520, class:"Class G", type:"Uncontrolled (ATZ)", runways:["06/24 — 823m","01/19 — 561m"], region:"uk", weather_icao:"EGLL",
    hazards:[
      {id:"NONTOW",phase:["all"],sev:"high",icon:"📻",title:"ATZ with Flight Information Service",detail:"Listen out and make position calls on the A/G frequency."},
      {id:"GLIDER",phase:["pattern","all"],sev:"medium",icon:"🪂",title:"Gliding and Parachute Operations",detail:"Wycombe has active gliding and parachute operations. Check NOTAMs before flight."},
    ],
    atcNotes:"Wycombe Radio 126.55",
    cfiNotes:"Good field for reinforcing lookout discipline given shared use with gliders and parachutists. Always confirm: have you checked NOTAMs before departure?",
  },
  EGCC:{ name:"Manchester Airport", city:"Manchester, Greater Manchester", elevation:257, class:"Class D", type:"Towered", runways:["05L/23R — 3,048m","05R/23L — 3,048m"], region:"uk", weather_icao:"EGCC",
    hazards:[
      {id:"CLASS_D",phase:["all"],sev:"critical",icon:"🗼",title:"Major Airport — Not for Ab-Initio Training",why:"Manchester is one of the busiest airports in the UK.",detail:"Manchester handles very high volumes of scheduled commercial traffic. This is a procedural/radio-exposure destination for advanced students, not a routine training field."},
    ],
    atcNotes:"Manchester Approach 118.575 · Tower 118.625",
    cfiNotes:"Use only for advanced radio-procedure exposure with thorough pre-flight briefing — not for routine circuit training. Always confirm: have you checked NOTAMs before departure?",
  },
  EGCB:{ name:"City Airport Manchester (Barton)", city:"Eccles, Greater Manchester", elevation:75, class:"Class G", type:"ATZ — AFIS (Aerodrome Flight Information Service)", runways:["08/26 — 610m","14/32 — 555m"], region:"uk", weather_icao:"EGCC",
    hazards:[
      {id:"AFIS",phase:["all"],sev:"medium",icon:"📻",title:"AFIS, Not Basic Self-Announce",detail:"Barton runs a genuine AFIS — contact Barton Information before entering the ATZ rather than treating this as a purely self-announce field."},
      {id:"SHORT",phase:["takeoff","landing"],sev:"high",icon:"🛬",title:"Short Grass/Paved Runways",why:"Runways under 650m — some of the shortest in regular training use.",detail:"Know your aircraft's demonstrated short-field performance before accepting these runways. Add a safety margin, particularly if grass is wet."},
      {id:"PROXIMITY",phase:["all"],sev:"medium",icon:"📡",title:"Proximity to Manchester Class D",detail:"Barton sits close to Manchester's controlled airspace. Confirm boundaries carefully before departure."},
    ],
    atcNotes:"Barton Information 120.25",
    cfiNotes:"Good short-field training location — reinforce demonstrated performance numbers, not book figures. Note the genuine AFIS service here, not self-announce. Always confirm: have you checked NOTAMs before departure?",
  },
  EGNJ:{ name:"Humberside Airport", city:"Kirmington, Lincolnshire", elevation:32, class:"Class D", type:"Towered", runways:["02/20 — 1,857m"], region:"uk", weather_icao:"EGNJ",
    hazards:[
      {id:"CLASS_D",phase:["all"],sev:"high",icon:"🗼",title:"Class D — Clearance Required",detail:"Establish two-way communication with Humberside Approach before entering the zone."},
      {id:"COAST",phase:["all"],sev:"medium",icon:"🌊",title:"Coastal/Estuary Weather",detail:"Proximity to the Humber Estuary can bring fast-changing visibility. Check actual METAR trend."},
    ],
    atcNotes:"Humberside Approach 118.55 · Tower 124.75",
    cfiNotes:"Straightforward Class D field, good for building confidence with estuary weather awareness. Always confirm: have you checked NOTAMs before departure?",
  },
  EGPF:{ name:"Glasgow Airport", city:"Paisley, Scotland", elevation:26, class:"Class D", type:"Towered", runways:["05/23 — 2,658m"], region:"uk", weather_icao:"EGPF",
    hazards:[
      {id:"CLASS_D",phase:["all"],sev:"critical",icon:"🗼",title:"Major Airport — Not for Ab-Initio Training",detail:"Glasgow is a busy commercial hub. Use for advanced radio-procedure exposure only, with a thorough pre-flight brief."},
    ],
    atcNotes:"Glasgow Approach 119.1 · Tower 118.8",
    cfiNotes:"Advanced students only — complex commercial traffic environment. Always confirm: have you checked NOTAMs before departure?",
  },
  EGPN:{ name:"Dundee Airport", city:"Dundee, Scotland", elevation:15, class:"Class D", type:"Towered", runways:["09/27 — 1,400m"], region:"uk", weather_icao:"EGPN",
    hazards:[
      {id:"CLASS_D",phase:["all"],sev:"medium",icon:"🗼",title:"Class D — Clearance Required",detail:"Establish two-way communication with Dundee Approach before entering the zone."},
      {id:"TERRAIN",phase:["departure","all"],sev:"medium",icon:"⛰",title:"Rising Terrain to the North",detail:"Terrain rises quickly north of Dundee towards the Angus glens. Be aware of minimum safe altitudes on northbound routes."},
    ],
    atcNotes:"Dundee Approach/Tower 122.9",
    cfiNotes:"Quieter Class D field — good for a calmer controlled-airspace introduction before busier fields. Always confirm: have you checked NOTAMs before departure?",
  },
  EGPK:{ name:"Prestwick Airport", city:"Prestwick, Scotland", elevation:65, class:"Class D", type:"Towered", runways:["12/30 — 2,987m"], region:"uk", weather_icao:"EGPK",
    hazards:[
      {id:"CLASS_D",phase:["all"],sev:"high",icon:"🗼",title:"Class D — Clearance Required",detail:"Establish two-way communication with Prestwick Approach before entering the zone."},
      {id:"CARGO",phase:["pattern","all"],sev:"medium",icon:"✈",title:"Cargo and Training Traffic",detail:"Prestwick handles cargo operations and hosts flight training. Expect a mix of traffic types and speeds."},
    ],
    atcNotes:"Prestwick Approach 126.2 · Tower 118.15",
    cfiNotes:"Reasonable step up in complexity — long runway with mixed commercial and training traffic. Always confirm: have you checked NOTAMs before departure?",
  },
  EGNS:{ name:"Isle of Man Airport (Ronaldsway)", city:"Ballasalla, Isle of Man", elevation:52, class:"Class D", type:"Towered", runways:["08/26 — 1,970m","03/21 — 1,187m"], region:"uk", weather_icao:"EGNS",
    hazards:[
      {id:"CLASS_D",phase:["all"],sev:"high",icon:"🗼",title:"Class D — Clearance Required",detail:"Establish two-way communication with Ronaldsway Approach before entering the zone."},
      {id:"SEA",phase:["all"],sev:"high",icon:"🌊",title:"Island Location — Overwater Routing Awareness",why:"Any cross-country to/from the Isle of Man involves overwater flight.",detail:"Overwater flight planning, life jacket requirements, and diversion options need specific briefing before any Ronaldsway cross-country."},
    ],
    atcNotes:"Ronaldsway Approach 120.85 · Tower 118.9",
    cfiNotes:"Overwater routing brief is essential and specific to this field — do not treat it as a standard mainland Class D. Always confirm: have you checked NOTAMs before departure?",
  },
  EGHQ:{ name:"Newquay Airport (Cornwall)", city:"Newquay, Cornwall", elevation:468, class:"Class D", type:"Towered", runways:["12/30 — 2,744m"], region:"uk", weather_icao:"EGHQ",
    hazards:[
      {id:"CLASS_D",phase:["all"],sev:"medium",icon:"🗼",title:"Class D — Clearance Required",detail:"Establish two-way communication with Newquay Approach before entering the zone."},
      {id:"COAST",phase:["all"],sev:"high",icon:"🌊",title:"Exposed Coastal Weather",why:"North Cornwall coast is exposed to fast-moving Atlantic weather systems.",detail:"Weather can change quickly here. Check actual METAR trend closely before and during flight, not just the forecast."},
    ],
    atcNotes:"Newquay Approach 125.475 · Tower 133.4",
    cfiNotes:"Coastal weather awareness is the standout brief — reinforce trend-checking over single-report reliance. Always confirm: have you checked NOTAMs before departure?",
  },
  EGLM:{ name:"White Waltham Airfield", city:"White Waltham, Berkshire", elevation:133, class:"Class G", type:"Uncontrolled (ATZ)", runways:["03/21 — 823m","07/25 — 796m"], region:"uk", weather_icao:"EGLL",
    hazards:[
      {id:"NONTOW",phase:["all"],sev:"high",icon:"📻",title:"ATZ with Flight Information Service",detail:"Listen out and make position calls on the A/G frequency."},
      {id:"GRASS",phase:["takeoff","landing"],sev:"medium",icon:"🛬",title:"Grass Runways",detail:"All runways are grass — performance and braking differ from paved surfaces, especially when wet."},
    ],
    atcNotes:"White Waltham Radio 122.6",
    cfiNotes:"Good grass-field introduction — reinforce the performance differences from paved-runway training. Always confirm: have you checked NOTAMs before departure?",
  },
  EGSG:{ name:"Stapleford Aerodrome", city:"Stapleford Tawney, Essex", elevation:190, class:"Class G", type:"Uncontrolled (ATZ)", runways:["04/22 — 793m"], region:"uk", weather_icao:"EGSS",
    hazards:[
      {id:"NONTOW",phase:["all"],sev:"high",icon:"📻",title:"ATZ with Flight Information Service",detail:"Listen out and make position calls on the A/G frequency."},
      {id:"MULTI",phase:["pattern","all"],sev:"medium",icon:"📻",title:"Busy Multi-School Circuit",detail:"Multiple schools operate from Stapleford. Expect non-standard spacing — announce clearly, look before every turn."},
    ],
    atcNotes:"Stapleford Radio 122.8",
    cfiNotes:"Busy uncontrolled circuit — good for reinforcing lookout and radio discipline under load. Always confirm: have you checked NOTAMs before departure?",
  },

  // ── TEXAS ────────────────────────────────────────────────────────────────
  // NOTE: elevations, runways, and airspace class verified against public FAA
  // data (Sep 2026). Where an exact current tower/ground/approach frequency
  // could not be independently verified, atcNotes says so explicitly rather
  // than presenting an invented number — always confirm the current frequency
  // in the Chart Supplement / your EFB before flight.
  KFTW:{ name:"Fort Worth Meacham International", city:"Fort Worth, TX", elevation:710, class:"Class D", type:"Towered", runways:["16/34 — 7,502ft","17/35 — 4,005ft"], region:"texas", weather_icao:"KFTW",
    hazards:[
      {id:"MILITARY",phase:["all"],sev:"critical",icon:"🛩",title:"NAS JRB Fort Worth (Carswell) — Adjacent Military Jet Traffic",why:"Active-duty fighter jets operate from a joint-reserve base a few miles away.",detail:"Naval Air Station Joint Reserve Base Fort Worth (Carswell Field) is close by and hosts F-16 fighter operations. Expect fast military traffic and be ready for TFRs or altitude restrictions during exercises. Monitor NOTAMs before flight."},
      {id:"CLASS_B",phase:["departure","all"],sev:"high",icon:"📡",title:"DFW Class B Proximity",why:"Dallas-Fort Worth International's Class B shelf is close to the east.",detail:"Do not climb above your assigned altitude without an explicit Class B clearance from DFW Approach if routing east. Confirm the current Class B floor for your position before departure."},
      {id:"CB",phase:["all"],sev:"critical",icon:"⛈",title:"North Texas Severe Thunderstorms",why:"North Texas sits in an active severe-weather corridor, including spring hail and tornado risk.",detail:"Spring and early summer bring fast-developing supercells with hail and damaging wind, not just rain. Check TAF and radar closely — this isn't simple afternoon convection, some of these storms are genuinely severe. Do not fly toward a developing cell."},
      {id:"DA",phase:["takeoff","departure"],sev:"medium",icon:"🌡",title:"Summer Heat — Density Altitude",detail:"Texas summer heat at 710ft field elevation can push density altitude to 2,500–3,000ft+ on hot afternoons. Recalculate performance rather than assuming sea-level numbers."},
    ],
    atcNotes:"Class D — confirm current Tower/Ground frequencies in the Chart Supplement before flight.\nDFW Class B to the east — confirm floor before any eastbound climb.",
    cfiNotes:"Meacham's proximity to Carswell military jet traffic and the DFW Class B shelf are the two defining briefs here — both need specific airspace awareness before solo.",
  },
  KFWS:{ name:"Fort Worth Spinks", city:"Fort Worth (Burleson), TX", elevation:700, class:"Class D", type:"Towered", runways:["18R/36L — 6,002ft","18L/36R — 3,660ft (turf)"], region:"texas", weather_icao:"KFWS",
    hazards:[
      {id:"MULTI",phase:["pattern","all"],sev:"high",icon:"📻",title:"High-Volume Multi-School Training Field",why:"Spinks hosts a major Part 141 training campus alongside other schools.",detail:"Spinks sees very high training volumes with multiple schools operating simultaneously. Announce every position clearly and never assume the pattern is clear."},
      {id:"CB",phase:["all"],sev:"critical",icon:"⛈",title:"North Texas Severe Thunderstorms",detail:"Same North Texas severe-weather corridor as Meacham and Alliance — spring hail/supercell risk, not just routine afternoon showers. Check TAF and radar before every flight."},
      {id:"TURF",phase:["takeoff","landing"],sev:"medium",icon:"🛬",title:"Turf Secondary Runway",detail:"18L/36R is turf, not paved. Confirm current surface condition before use, especially after rain."},
      {id:"DA",phase:["takeoff","departure"],sev:"medium",icon:"🌡",title:"Summer Heat — Density Altitude",detail:"Texas summer heat at 700ft elevation can meaningfully reduce performance on hot afternoons. Recalculate, don't assume."},
    ],
    atcNotes:"Class D — confirm current Tower/Ground frequencies in the Chart Supplement before flight.",
    cfiNotes:"Spinks is a high-volume training environment — radio discipline and lookout under load are the key brief, alongside standard North Texas storm awareness.",
  },
  KAFW:{ name:"Perot Field Fort Worth Alliance", city:"Fort Worth, TX", elevation:723, class:"Class C", type:"Towered", runways:["16L/34R — 11,000ft","16R/34L — 11,125ft"], region:"texas", weather_icao:"KAFW",
    hazards:[
      {id:"CLASS_C",phase:["all"],sev:"high",icon:"📡",title:"Class C Operations",detail:"Alliance is Class C. Establish two-way communication with Alliance Approach before entering — confirm ATC has used your callsign back to you, not just acknowledged traffic."},
      {id:"CARGO",phase:["pattern","all"],sev:"high",icon:"✈",title:"Heavy Cargo Jet Traffic — Wake Turbulence",why:"Alliance is a major FedEx Express and Amazon Air hub.",detail:"Expect large freighter aircraft sharing the pattern and runways. Wake turbulence from a departing heavy jet can be dangerous to a light training aircraft — maintain spacing and be alert to ATC wake turbulence cautions."},
      {id:"CB",phase:["all"],sev:"critical",icon:"⛈",title:"North Texas Severe Thunderstorms",detail:"Same severe-weather corridor as the rest of North Texas — check TAF/radar for supercell and hail risk, not just routine convection."},
    ],
    atcNotes:"Class C — confirm current Approach/Tower frequencies in the Chart Supplement before flight.",
    cfiNotes:"Alliance is a genuinely unusual training environment — Class C procedures alongside heavy freighter wake turbulence. Not a first-solo field.",
  },
  KT67:{ name:"Hicks Airfield", city:"Fort Worth (Tarrant County), TX", elevation:855, class:"Uncontrolled", type:"Non-Towered", runways:["14/32 — 3,740ft"], region:"texas", weather_icao:"KAFW",
    hazards:[
      {id:"NONTOW",phase:["all"],sev:"high",icon:"📻",title:"Non-Towered — Self-Announce Required",why:"No ATC — all separation is pilot responsibility.",detail:"Hicks has no control tower and no weather station of its own — the closest METAR is Alliance (KAFW), about 6nm away, so treat that reading as a nearby reference, not exact on-field conditions. Self-announce at every standard reporting point."},
      {id:"AIRSPACE",phase:["all"],sev:"high",icon:"📡",title:"Every DFW Airspace Type Within 30 Minutes",why:"Hicks sits close to Class D, Class C, and Class B airspace in quick succession.",detail:"Meacham (Class D), Alliance (Class C), and DFW (Class B) are all within a short flight. This makes Hicks a popular training base, but it also means airspace discipline is critical from the first solo cross-country onward."},
      {id:"CB",phase:["all"],sev:"critical",icon:"⛈",title:"North Texas Severe Thunderstorms",detail:"No tower means no one is watching the weather for you here. Self-brief carefully — spring hail/supercell risk is real in this area."},
      {id:"DA",phase:["takeoff","departure"],sev:"medium",icon:"🌡",title:"Summer Heat — Density Altitude",detail:"At 855ft field elevation, Texas summer heat can push density altitude noticeably higher than sea-level POH numbers assume."},
    ],
    atcNotes:"No tower — self-announce on the local CTAF/A/G frequency; confirm the current frequency in the Chart Supplement.",
    cfiNotes:"Hicks (FAA LID T67, not an assigned ICAO identifier) is an excellent low-traffic non-towered introduction, with fast access to every controlled-airspace type nearby for later lessons.",
  },
  KGTU:{ name:"Georgetown Municipal (Executive) Airport", city:"Georgetown, TX", elevation:790, class:"Class D", type:"Towered (part-time — reverts non-towered after hours)", runways:["11/29 — 4,100ft","18/36 — 5,004ft"], region:"texas", weather_icao:"KGTU",
    hazards:[
      {id:"MULTI",phase:["pattern","all"],sev:"high",icon:"📻",title:"Major Multi-School Training Hub",why:"Georgetown hosts several large accelerated flight-training programs.",detail:"Georgetown is one of the busiest training airports in central Texas, with multiple schools running high-volume operations simultaneously. Expect a very active pattern and announce every position precisely."},
      {id:"PARTTIME",phase:["all"],sev:"medium",icon:"🗼",title:"Part-Time Tower — Confirm Operating Hours",why:"The tower does not operate 24 hours — the field reverts to non-towered procedures after hours.",detail:"Confirm current tower hours before flight. Outside those hours, Georgetown operates as an uncontrolled field — self-announce procedures apply and you must contact Austin Approach for IFR clearance delivery when the tower is closed."},
      {id:"CB",phase:["all"],sev:"critical",icon:"⛈",title:"Central Texas Severe Thunderstorms",why:"Central Texas sees intense, fast-developing convection, sometimes with damaging hail.",detail:"Check TAF and radar closely before and during flight — Hill Country convergence can develop storms quickly."},
      {id:"WILDLIFE",phase:["all"],sev:"medium",icon:"🦌",title:"Deer On and Near the Airport",detail:"Deer activity has been documented on and around the airfield. Scan the runway environment carefully, especially at dawn/dusk."},
    ],
    atcNotes:"Ground (IFR clearance delivery when tower closed): 119.125. Confirm current Tower frequency in the Chart Supplement.",
    cfiNotes:"Georgetown's training volume is the defining brief — reinforce precise, concise radio calls given how much traffic shares the pattern.",
  },
  KHYI:{ name:"San Marcos Regional Airport", city:"San Marcos, TX", elevation:594, class:"Class D", type:"Towered", runways:["08/26 — 6,330ft","13/31 — 5,601ft","17/35 — 5,214ft"], region:"texas", weather_icao:"KHYI",
    hazards:[
      {id:"BIRDS",phase:["takeoff","landing"],sev:"high",icon:"🦅",title:"Documented Bird and Wildlife Activity",why:"Bird and wildlife activity on and around the airport is noted in official airport remarks.",detail:"San Marcos has documented bird and wildlife activity on and near the airfield. Scan approach and departure paths carefully."},
      {id:"MULTI",phase:["pattern","all"],sev:"high",icon:"📻",title:"Major Multi-School Training Hub",why:"San Marcos hosts several large training organisations.",detail:"Multiple flight schools operate here at high volume. Expect a busy pattern and non-standard spacing — announce clearly and look before every turn."},
      {id:"CB",phase:["all"],sev:"critical",icon:"⛈",title:"Central Texas Severe Thunderstorms",detail:"Same Hill Country convergence risk as Georgetown/Austin — check TAF and radar carefully, storms here can develop fast."},
      {id:"SURFACE",phase:["takeoff","landing"],sev:"low",icon:"🛬",title:"Irregular Surface Noted",detail:"Official airport remarks note irregular surface areas. Standard precaution: taxi and roll at a sensible speed and report anything unusual to the FBO."},
    ],
    atcNotes:"Ground (IFR clearance delivery when tower closed): 120.125. Confirm current Tower frequency in the Chart Supplement.",
    cfiNotes:"San Marcos combines high training traffic with documented bird activity — both need a specific brief before first solo here.",
  },
  KAUS:{ name:"Austin-Bergstrom International", city:"Austin, TX", elevation:541, class:"Class C", type:"Towered", runways:["18R/36L — 12,250ft","18L/36R — 9,000ft"], region:"texas", weather_icao:"KAUS",
    hazards:[
      {id:"CLASS_C",phase:["all"],sev:"high",icon:"📡",title:"Class C — Busy Commercial + GA Traffic",why:"Austin-Bergstrom is a full commercial airline airport with GA sharing the same airspace.",detail:"Establish two-way communication with Austin Approach before entering the Class C surface area. Expect sequencing behind airline traffic and precise ATC instructions."},
      {id:"BIRDS",phase:["takeoff","landing"],sev:"high",icon:"🦅",title:"Documented Bird Activity",why:"Bird activity on and near the airport is noted in official airport remarks.",detail:"Scan approach and departure paths carefully — this is a documented, not hypothetical, hazard at this field."},
      {id:"NOISE",phase:["departure"],sev:"medium",icon:"🔇",title:"Noise Abatement Departure Procedures",detail:"Noise abatement procedures are active. Departures are generally expected to climb as soon as practical to 4,000ft or above and follow assigned runway/heading instructions precisely."},
      {id:"CB",phase:["all"],sev:"critical",icon:"⛈",title:"Central Texas Severe Thunderstorms",detail:"Same central Texas convective risk as Georgetown/San Marcos — check TAF and radar, storms can develop quickly."},
    ],
    atcNotes:"Class C, busy commercial airport — confirm current Approach/Tower frequencies in the Chart Supplement before flight.",
    cfiNotes:"Bergstrom is a good advanced-student introduction to Class C amid heavy commercial traffic — not a routine training field for early solo.",
  },
  KSGR:{ name:"Sugar Land Regional Airport", city:"Sugar Land (Houston), TX", elevation:81, class:"Class D", type:"Towered", runways:["17/35 — 8,000ft"], region:"texas", weather_icao:"KSGR",
    hazards:[
      {id:"MULTI",phase:["pattern","all"],sev:"high",icon:"📻",title:"Major Multi-School Training Hub",why:"Sugar Land hosts a large accelerated flight-training programme alongside corporate traffic.",detail:"Expect a high-volume pattern with training aircraft sharing the field with business jets and turboprops. Announce clearly and expect to be sequenced behind faster traffic."},
      {id:"TRAFFIC",phase:["pattern","all"],sev:"medium",icon:"✈",title:"Mixed Corporate Jet / Training Traffic",detail:"Corporate jets and turboprops share this single long runway with training aircraft — expect a wide range of approach speeds in the pattern."},
      {id:"CB",phase:["all"],sev:"critical",icon:"⛈",title:"Gulf Coast Thunderstorms and Humidity",why:"Houston's Gulf Coast humidity fuels fast-developing afternoon convection, and the region sees tropical-system remnants in season.",detail:"Check TAF and radar closely, particularly in summer/early autumn when tropical moisture can bring heavy rain and low ceilings with little warning."},
      {id:"FOG",phase:["all"],sev:"medium",icon:"🌫",title:"Gulf Coast Morning Fog/Haze",detail:"Houston's humidity produces frequent early-morning fog and haze, especially in cooler months. Check the actual METAR trend before a dawn departure, not just the forecast."},
    ],
    atcNotes:"Class D — confirm current Tower/Ground frequencies in the Chart Supplement before flight.",
    cfiNotes:"Sugar Land's mixed corporate/training traffic on a single runway is the key brief — reinforce pattern spacing awareness.",
  },
  KDWH:{ name:"David Wayne Hooks Memorial Airport", city:"Houston (Tomball), TX", elevation:152, class:"Class D", type:"Towered (part-time — reverts non-towered after hours)", runways:["17R/35L — 7,009ft","17L/35R — 3,447ft","17W/35W — 2,530ft (water)"], region:"texas", weather_icao:"KDWH",
    hazards:[
      {id:"BUSIEST",phase:["pattern","all"],sev:"critical",icon:"📻",title:"Busiest General Aviation Airport in Texas",why:"Hooks is one of the busiest GA airports in the entire United States.",detail:"Extremely high traffic volume — announce every position precisely and never assume the pattern or runway is clear, even when cleared."},
      {id:"PARTTIME",phase:["all"],sev:"high",icon:"🗼",title:"Part-Time Tower — Confirm Operating Hours",why:"The tower does not operate 24 hours — the field reverts to non-towered procedures after hours.",detail:"Confirm current tower hours before flight. When the tower is closed, contact Houston Approach for IFR clearance delivery and use standard self-announce procedures."},
      {id:"SEAPLANE",phase:["all"],sev:"medium",icon:"🌊",title:"Water Runway — Mixed Seaplane Operations",why:"Hooks has a dedicated water runway (17W/35W) alongside its paved runways.",detail:"Be aware seaplane operations may be sharing the traffic pattern with conventional fixed-wing aircraft. Confirm current activity before flight."},
      {id:"CB",phase:["all"],sev:"critical",icon:"⛈",title:"Gulf Coast Thunderstorms and Humidity",detail:"Same Gulf Coast convective risk as the rest of the Houston area — check TAF/radar closely, especially in summer and hurricane season."},
    ],
    atcNotes:"Class D (part-time tower) — confirm current Tower/Ground frequencies and hours in the Chart Supplement before flight.",
    cfiNotes:"Hooks' sheer traffic volume plus the part-time tower and water-runway seaplane mix make this a genuinely advanced training environment — brief all three carefully.",
  },
  KLVJ:{ name:"Pearland Regional Airport", city:"Pearland (Houston), TX", elevation:44, class:"Uncontrolled", type:"Non-Towered", runways:["14/32 — 4,313ft"], region:"texas", weather_icao:"KLVJ",
    hazards:[
      {id:"NONTOW",phase:["all"],sev:"high",icon:"📻",title:"Non-Towered — Self-Announce Required",why:"No ATC — all separation is pilot responsibility.",detail:"Pearland has no control tower. Self-announce at every standard reporting point on the local CTAF frequency."},
      {id:"CB",phase:["all"],sev:"critical",icon:"⛈",title:"Gulf Coast Thunderstorms and Humidity",detail:"No tower means no one is watching the weather for you here — self-brief carefully given Houston's fast-developing Gulf Coast convection."},
      {id:"FOG",phase:["all"],sev:"medium",icon:"🌫",title:"Gulf Coast Morning Fog/Haze",detail:"Check the actual METAR trend before an early departure — Houston-area humidity produces frequent morning fog."},
    ],
    atcNotes:"No tower — self-announce on the local CTAF frequency; confirm the current frequency in the Chart Supplement.",
    cfiNotes:"Good non-towered introduction south of Houston — reinforce self-briefing discipline given the lack of a tower to catch developing weather.",
  },
  KIWS:{ name:"West Houston Airport", city:"Houston (Katy), TX", elevation:111, class:"Uncontrolled", type:"Non-Towered", runways:["15/33 — 3,953ft"], region:"texas", weather_icao:"KSGR",
    hazards:[
      {id:"NONTOW",phase:["all"],sev:"high",icon:"📻",title:"Non-Towered — Self-Announce Required",detail:"No control tower. Self-announce at every standard reporting point on the local CTAF frequency."},
      {id:"HOURS",phase:["pattern","all"],sev:"low",icon:"🕐",title:"Touch-and-Go Curfew",detail:"Touch-and-go circuits are restricted between 2200 and 0600 local. Plan pattern work accordingly."},
      {id:"CB",phase:["all"],sev:"critical",icon:"⛈",title:"Gulf Coast Thunderstorms and Humidity",detail:"Same Houston-area convective risk as Sugar Land/Hooks/Pearland — self-brief carefully, no tower here to flag developing weather."},
      {id:"FOG",phase:["all"],sev:"medium",icon:"🌫",title:"Gulf Coast Morning Fog/Haze",detail:"Check the actual METAR trend before an early departure, not just the forecast."},
    ],
    atcNotes:"No tower — self-announce on the local CTAF frequency; confirm the current frequency in the Chart Supplement.",
    cfiNotes:"West Houston's touch-and-go curfew is a distinctive local rule worth pointing out early — easy for a student to overlook.",
  },
  KCFD:{ name:"Coulter Field", city:"Bryan (Bryan–College Station), TX", elevation:367, class:"Uncontrolled", type:"Non-Towered", runways:["15/33 — 4,000ft"], region:"texas", weather_icao:"KCFD",
    hazards:[
      {id:"JUMP",phase:["all"],sev:"high",icon:"🪂",title:"Documented Parachute Operations",why:"Coulter Field has a long-documented history of parachute jump activity dating to the 1950s.",detail:"Confirm current parachute operations and NOTAM status before flight — jumpers in freefall have no radio and may not be visible until close. Do not assume the field is jump-free without checking."},
      {id:"NONTOW",phase:["all"],sev:"high",icon:"📻",title:"Non-Towered — Self-Announce Required",detail:"No control tower. Self-announce at every standard reporting point on the local CTAF frequency."},
      {id:"CB",phase:["all"],sev:"critical",icon:"⛈",title:"Central Texas Severe Thunderstorms",detail:"Central Texas convective risk applies here too — self-brief carefully, no tower to flag developing weather."},
    ],
    atcNotes:"No tower — self-announce on the local CTAF frequency; confirm the current frequency in the Chart Supplement.",
    cfiNotes:"Coulter's parachute history is the standout local brief — treat it as active until you've specifically confirmed otherwise via NOTAMs.",
  },
  KCLL:{ name:"Easterwood Field", city:"College Station, TX", elevation:321, class:"Class D", type:"Towered (part-time — reverts Class E after hours)", runways:["17/35 — 7,000ft","11/29 — 5,158ft"], region:"texas", weather_icao:"KCLL",
    hazards:[
      {id:"PARTTIME",phase:["all"],sev:"medium",icon:"🗼",title:"Part-Time Tower — Confirm Operating Hours",why:"Airspace reverts from Class D to Class E when the tower is closed.",detail:"Confirm current tower hours before flight. Outside those hours, standard uncontrolled procedures apply — self-announce and expect no ATC service."},
      {id:"MILITARY",phase:["all"],sev:"medium",icon:"🚁",title:"Military Helicopter Rapid-Refuel Operations",why:"Easterwood hosts scheduled military helicopter rapid-refuel activity on the south ramp.",detail:"Rapid-refuel helicopter operations run on the south ramp during published hours. Expect additional rotary traffic and follow any published procedures for proceeding to that ramp area."},
      {id:"UNI",phase:["pattern","all"],sev:"medium",icon:"✈",title:"Texas A&M University Flight Operations",why:"Easterwood serves Texas A&M's aviation program alongside general traffic.",detail:"Expect a mix of university training flights, GA traffic, and occasional scheduled/charter service. Maintain standard lookout discipline in the pattern."},
      {id:"CB",phase:["all"],sev:"critical",icon:"⛈",title:"Central Texas Severe Thunderstorms",detail:"Same Central Texas convective risk as Coulter Field nearby — check TAF and radar carefully, storms here can develop fast."},
    ],
    atcNotes:"Class D (part-time tower) — confirm current Tower/Ground frequencies and hours in the Chart Supplement before flight.",
    cfiNotes:"Easterwood's part-time tower and the south-ramp military helicopter activity are the two things students most often miss on first visit — brief both before solo.",
  },

  // ── SOUTHERN CALIFORNIA / LA BASIN ───────────────────────────────────────
  // Elevation/runway/class data verified against SkyVector (FAA NASR-sourced
  // remarks) plus at least one additional non-Wikipedia aviation source per
  // field. Region theme: extremely dense multi-airport Class B/C/D airspace
  // stacking, marine layer fog, and terrain transitions — distinct from any
  // existing Academy region.
  KVNY:{ name:"Van Nuys Airport", city:"Van Nuys, CA", elevation:802, class:"Class D", type:"Towered", runways:["16R/34L — 8,001ft","16L/34R — 4,013ft"], region:"socal", weather_icao:"KVNY",
    hazards:[
      {id:"BUSIEST",phase:["pattern","all"],sev:"high",icon:"✈",title:"One of the Busiest GA Airports in the World",why:"Van Nuys' two parallel runways average very high annual movements.",detail:"Extremely high traffic density with parallel runway operations. Listen carefully, expect fast-paced ATC instructions, and never assume the pattern is clear."},
      {id:"CLASSB",phase:["all"],sev:"high",icon:"📡",title:"Under LAX Class B Shelf",why:"Van Nuys sits within the dense LA Basin Class B/C airspace complex.",detail:"Confirm current Class B shelf altitudes before any climb — this is one of the most heavily stacked airspace environments in US general aviation."},
      {id:"BIRD",phase:["all"],sev:"medium",icon:"🦅",title:"Bird Abatement Operations",detail:"Bird abatement activity may occur between the runways when the tower is open. Maintain vigilance for wildlife on and near the movement area."},
    ],
    atcNotes:"Van Nuys Tower 119.3 — self-announce on this frequency when tower closed.",
    cfiNotes:"Van Nuys is an excellent introduction to high-density Class D operations under a Class B shelf — not a first-lesson field, but outstanding for radio discipline once basics are solid.",
  },
  KCNO:{ name:"Chino Airport", city:"Chino, CA", elevation:650, class:"Class D", type:"Towered", runways:["3/21 — 4,919ft","8L/26R — 4,858ft","8R/26L — 7,000ft"], region:"socal", weather_icao:"KCNO",
    hazards:[
      {id:"BIRD",phase:["all"],sev:"medium",icon:"🦅",title:"Documented Bird and Wildlife Activity",why:"Official airport remarks note birds and wildlife on and around the field.",detail:"Scan approach and departure paths carefully — this is a documented, not hypothetical, hazard at this field."},
      {id:"MULTI",phase:["pattern","all"],sev:"medium",icon:"📻",title:"Non-Standard Traffic Patterns",why:"Chino uses right traffic on several runways, unusual for a field this size.",detail:"Confirm current pattern direction for your assigned runway before entering — right-hand patterns apply on 08R/26L, 26L, and 21."},
      {id:"WARBIRD",phase:["pattern","all"],sev:"low",icon:"✈",title:"Warbird and Historic Aircraft Traffic",detail:"Chino is home to significant historic/warbird aircraft collections. Expect unusual aircraft types and speeds sharing the pattern."},
    ],
    atcNotes:"Chino Tower — confirm current frequency in the Chart Supplement. Clearance delivery when tower closed: SoCal Approach 800-448-3724.",
    cfiNotes:"Chino's non-standard right-traffic runways are the standout local brief — easy for a student to default to left traffic out of habit.",
  },
  KEMT:{ name:"San Gabriel Valley Airport (El Monte)", city:"El Monte, CA", elevation:296, class:"Class D", type:"Towered", runways:["01/19 — 3,995ft"], region:"socal", weather_icao:"KEMT",
    hazards:[
      {id:"BIRD",phase:["all"],sev:"high",icon:"🦅",title:"Heavy Bird Activity Documented",why:"Official airport remarks specifically flag heavy bird activity on and around the field.",detail:"This is a documented heavy bird-activity field, not a generic caution — scan continuously on approach and departure."},
      {id:"CHANNEL",phase:["departure","all"],sev:"medium",icon:"🛬",title:"Remain Over Paved Channel on Climb-Out",detail:"Published procedure requires remaining over the paved channel on climb-out to the south and north — confirm this before departure, it's not optional guidance."},
      {id:"NOISE",phase:["departure"],sev:"low",icon:"🔇",title:"Noise Abatement Procedures",detail:"Active noise abatement procedures apply — contact the airport manager for current details before repeated pattern work."},
    ],
    atcNotes:"El Monte Tower — confirm current frequency in the Chart Supplement. SoCal Approach provides departure control on 125.5 during tower hours, 121.2 otherwise.",
    cfiNotes:"El Monte's documented heavy bird activity and mandatory channel climb-out are the two things to brief specifically — don't let a student treat this as a routine Class D.",
  },
  KFUL:{ name:"Fullerton Municipal Airport", city:"Fullerton, CA", elevation:96, class:"Class D", type:"Towered", runways:["6/24 — 3,121ft"], region:"socal", weather_icao:"KFUL",
    hazards:[
      {id:"NOISE",phase:["departure"],sev:"medium",icon:"🔇",title:"Strict Noise Abatement Procedures",why:"Fullerton is surrounded by residential development with active noise enforcement.",detail:"R/W 06 is the preferred takeoff runway for noise reasons — follow the railroad tracks east with no turns below 1,000ft AGL. R/W 24 departures climb to 700ft AGL before turning."},
      {id:"TOWER",phase:["all"],sev:"low",icon:"🗼",title:"Nearby Lighted Obstacle",detail:"A 750ft lighted tower sits 1.75 miles west of the airport on a 285° heading — relevant on westbound routings."},
      {id:"VIS",phase:["taxi","all"],sev:"low",icon:"👁",title:"Limited Tower Visibility on Some Taxiways",detail:"Portions of Taxiway A are not visible from the tower — expect to be asked to report position in these areas."},
    ],
    atcNotes:"Fullerton Tower — confirm current frequency in the Chart Supplement. Clearance delivery when tower closed: SoCal Approach 800-448-3724.",
    cfiNotes:"Fullerton's noise abatement procedures are specific and enforced — students need to know the exact departure profile, not just 'be quiet.'",
  },
  KRAL:{ name:"Riverside Municipal Airport", city:"Riverside, CA", elevation:818, class:"Class D", type:"Towered", runways:["9/27 — 5,401ft","16/34 — 2,850ft"], region:"socal", weather_icao:"KRAL",
    hazards:[
      {id:"POWERLINES",phase:["departure","all"],sev:"high",icon:"⚠",title:"Numerous Power Lines North of the Field",why:"Documented power lines 1,780-2,887ft north of R/W 16 threshold, at or below 80ft AGL.",detail:"Be specifically aware of low-hanging power line infrastructure north of the field — this is a documented, mapped hazard, not a generic caution."},
      {id:"VIS",phase:["taxi","landing"],sev:"medium",icon:"👁",title:"Limited Tower Visibility on Some Surfaces",detail:"Departures on runways 09 and 27 are not visible to aircraft at the other end of the runway. Portions of taxiways and the south end of R/W 34 are not visible from the tower."},
      {id:"NOISE",phase:["departure"],sev:"low",icon:"🔇",title:"Active Noise Management Procedures",detail:"R/W 27 departures turn right 10° after departure for noise management, assuming course after reaching 1,500ft MSL."},
    ],
    atcNotes:"Riverside Tower — confirm current frequency in the Chart Supplement. Clearance delivery when tower closed: SoCal Approach 800-448-3724.",
    cfiNotes:"The documented power line hazard north of the field is the standout local brief — this is mapped and specific, not generic caution.",
  },
  KHHR:{ name:"Jack Northrop Field / Hawthorne Municipal Airport", city:"Hawthorne, CA", elevation:65, class:"Class D", type:"Towered", runways:["7/25 — 4,884ft"], region:"socal", weather_icao:"KHHR",
    hazards:[
      {id:"RESTRICT",phase:["pattern","all"],sev:"medium",icon:"🕐",title:"Restricted Touch-and-Go Hours",detail:"Touch-and-go, stop-and-go, and low approach operations (including helicopters) are limited to 1000-1700 local daily. No pattern operations or full-stop taxi-back Mon-Fri 2200-0800, or weekends 2200-1000."},
      {id:"NOISE",phase:["all"],sev:"medium",icon:"🔇",title:"Active Noise Abatement — Muffler Required",detail:"All piston aircraft must be equipped with a muffler system. Formation takeoffs are not authorized."},
      {id:"CLASSB",phase:["all"],sev:"high",icon:"📡",title:"Dense LA Basin Airspace",detail:"Sits within the complex, heavily stacked Los Angeles Class B/C airspace environment — confirm current shelf altitudes before any climb."},
    ],
    atcNotes:"Hawthorne Tower — confirm current frequency in the Chart Supplement. Clearance delivery when tower closed: SoCal Approach 800-448-3724.",
    cfiNotes:"Hawthorne's restricted pattern-work hours are easy to overlook — confirm current times before planning a lesson block here.",
  },
  KTOA:{ name:"Zamperini Field (Torrance)", city:"Torrance, CA", elevation:103, class:"Class D", type:"Towered", runways:["11L/29R — 5,001ft","11R/29L — 3,000ft"], region:"socal", weather_icao:"KTOA",
    hazards:[
      {id:"LANDING_FEE",phase:["landing"],sev:"low",icon:"💰",title:"Per-Landing Fee Program",why:"Torrance operates a landing fee program intended to manage touch-and-go volume.",detail:"Landings are billed per flight based on aircraft weight, not per day — pattern work here is genuinely more expensive than at nearby fields. Confirm current fee structure before planning repeated circuits."},
      {id:"NOGO",phase:["pattern","all"],sev:"medium",icon:"🚫",title:"No Touch-and-Go or Stop-and-Go Operations",detail:"Touch-and-go and stop-and-go operations are not permitted at Torrance. Plan full-stop landings only."},
      {id:"BIRD",phase:["all"],sev:"medium",icon:"🦅",title:"Numerous Bird Flocks Documented",detail:"Official remarks note numerous flocks of birds on and around the airport — maintain a strong visual scan."},
      {id:"CLOSED",phase:["departure"],sev:"low",icon:"🕐",title:"Closed to Departures Overnight",detail:"Airport closed to departures 2200-0700 weekdays and 2200-0800 weekends/holidays."},
    ],
    atcNotes:"Torrance Tower — confirm current frequency in the Chart Supplement. Clearance delivery when tower closed: SoCal Approach 800-448-3724.",
    cfiNotes:"Torrance's landing-fee program and no-touch-and-go rule are unusual and worth specifically briefing before a lesson here — this isn't a typical training pattern field despite being Class D.",
  },
  KSMO:{ name:"Santa Monica Municipal Airport", city:"Santa Monica, CA", elevation:169, class:"Class D", type:"Towered", runways:["3/21 — 3,500ft"], region:"socal", weather_icao:"KSMO",
    hazards:[
      {id:"NOISE",phase:["all"],sev:"high",icon:"🔇",title:"Strict Noise Ordinance — Jets/Stage II Prohibited",why:"Santa Monica enforces one of the strictest noise ordinances of any US GA airport.",detail:"Pure jet and Stage II aircraft (with or without hushkits) are prohibited outright. No touch-and-go, stop-and-go, or low approach permitted on weekends/holidays, or weekdays before 0700."},
      {id:"DEPROUTE",phase:["departure"],sev:"medium",icon:"🛫",title:"Mandatory Departure Routing",detail:"R/W 21 departures turn left 10° over the SMO VOR then right 225°. Northbound departures: no right turns before reaching the shoreline. R/W 03 departures: no turns prior to the 405 Freeway, 1 mile east."},
      {id:"WEIGHT",phase:["all"],sev:"low",icon:"📋",title:"PPR Required for Heavier Aircraft",detail:"Prior permission required for aircraft over 60,000lbs certified max landing weight."},
      {id:"CLOSURE",phase:["all"],sev:"medium",icon:"⚠",title:"Scheduled Airport Closure",why:"Santa Monica City Council has voted to close the airport.",detail:"Santa Monica Municipal Airport is scheduled to close permanently on December 31, 2028, under an agreement between the city and the FAA. Confirm current operational status before planning any flight here as that date approaches."},
    ],
    atcNotes:"Santa Monica Tower — confirm current frequency in the Chart Supplement.",
    cfiNotes:"Santa Monica's noise ordinance is genuinely one of the strictest in US GA — an excellent real-world lesson in how a single airport's rules can differ sharply from its neighbors.",
  },
  KCRQ:{ name:"McClellan-Palomar Airport", city:"Carlsbad, CA", elevation:331, class:"Class D", type:"Towered", runways:["6/24 — 4,897ft"], region:"socal", weather_icao:"KCRQ",
    hazards:[
      {id:"CURFEW",phase:["all"],sev:"medium",icon:"🕐",title:"Voluntary Noise Curfew",detail:"Voluntary curfew: jets 2200-0700 local, propeller aircraft 0000-0600 local (emergency/lifeguard/law enforcement excepted)."},
      {id:"MIXED",phase:["pattern","all"],sev:"medium",icon:"✈",title:"Mixed Commercial and GA Traffic",why:"Carlsbad has limited scheduled airline service alongside heavy GA/charter use.",detail:"Expect to be sequenced with commercial arrivals/departures — this isn't a pure GA training field."},
      {id:"MARINE",phase:["all"],sev:"medium",icon:"🌫",title:"Coastal Marine Layer",detail:"North San Diego County coastal marine layer can bring low ceilings and reduced visibility, especially in morning hours — check actual conditions, not just the forecast."},
    ],
    atcNotes:"Carlsbad Tower — confirm current frequency in the Chart Supplement.",
    cfiNotes:"Carlsbad combines commercial-traffic sequencing with a real coastal marine layer pattern — a good bridge field before more complex coastal ops.",
  },
  KSDM:{ name:"Brown Field Municipal Airport", city:"San Diego, CA", elevation:526, class:"Class D", type:"Towered", runways:["8L/26R — 7,972ft","8R/26L — 3,180ft"], region:"socal", weather_icao:"KSDM",
    hazards:[
      {id:"BORDER",phase:["all"],sev:"high",icon:"🌐",title:"One Mile from the US-Mexico Border",why:"Brown Field's boundary sits approximately one mile north of the international border.",detail:"Maintain precise position awareness — this is genuinely close to an international border, with associated airspace and procedural considerations. Confirm current requirements before flight."},
      {id:"PARACHUTE",phase:["all"],sev:"high",icon:"🪂",title:"Parachute Operations On and Near the Field",detail:"Parachute jumping occurs on the airport and up to 3 miles east. Jumpers in freefall have no radio."},
      {id:"TERRAIN",phase:["departure","all"],sev:"medium",icon:"⛰",title:"Rising Terrain to the East",detail:"High terrain (3,566ft MSL) lies 6 miles east of the airport. Be especially alert departing R/W 08L at night due to rising terrain."},
    ],
    atcNotes:"Brown Field Tower — confirm current frequency in the Chart Supplement.",
    cfiNotes:"Brown Field's border proximity and active parachute operations are both genuinely unique among Academy fields — brief both specifically before first visit.",
  },
  KPOC:{ name:"Brackett Field", city:"La Verne, CA", elevation:1013, class:"Class D", type:"Towered", runways:["8R/26L — 4,840ft"], region:"socal", weather_icao:"KPOC",
    hazards:[
      {id:"TERRAIN",phase:["departure","all"],sev:"medium",icon:"⛰",title:"Rapidly Rising Terrain to the Northwest",detail:"Documented rapidly rising terrain approximately 1 mile west-northwest of the airport — be specifically aware on departures in that direction."},
      {id:"BIRD",phase:["all"],sev:"medium",icon:"🦅",title:"Birds and Wildlife in the Vicinity",detail:"Official remarks note birds and wildlife in the vicinity of the airport."},
      {id:"NOISE",phase:["all"],sev:"low",icon:"🔇",title:"Active Noise Abatement Procedures",detail:"Noise abatement procedures are in effect — contact the airport manager for current details."},
    ],
    atcNotes:"Brackett Tower — confirm current frequency in the Chart Supplement. Clearance delivery when tower closed: SoCal Approach 800-448-3724.",
    cfiNotes:"Brackett's terrain rising to the northwest is the standout local brief for this San Gabriel Valley field.",
  },
  L35:{ name:"Big Bear City Airport", city:"Big Bear City, CA", elevation:6752, class:"Class G", type:"Non-Towered", runways:["8/26 — 5,850ft"], region:"socal", weather_icao:"KL35",
    hazards:[
      {id:"DA",phase:["takeoff","departure"],sev:"critical",icon:"🌡",title:"Extreme Density Altitude at High Elevation",why:"Big Bear sits at 6,752ft field elevation, one of the highest public airports in California — density altitude here can exceed 9,000ft on a warm summer day.",detail:"Documented example: a summer METAR of 25°C at this field produces a density altitude of roughly 9,019ft — over 2,200ft above field elevation. Recalculate performance for actual conditions every time, never assume sea-level numbers apply."},
      {id:"TERRAIN",phase:["all"],sev:"high",icon:"⛰",title:"Mountains in All Quadrants",detail:"Mountains surround the field in every direction, with peak hazard lights southeast, south, and northwest. Know your minimum safe altitudes for every direction of flight."},
      {id:"NOISE",phase:["all"],sev:"medium",icon:"🔇",title:"Extreme Noise Sensitive Area",detail:"Avoid overflying the high school 1 mile east at all times. On takeoff, make a 10° left turn at the runway end to avoid housing to the east and the elementary school to the west."},
      {id:"NONTOW",phase:["all"],sev:"medium",icon:"📻",title:"Non-Towered — Self-Announce Required",detail:"No control tower. Self-announce at every standard reporting point on CTAF."},
    ],
    atcNotes:"No tower — self-announce on CTAF/UNICOM 122.725.",
    cfiNotes:"Big Bear is the standout density-altitude teaching field for this region — genuinely more extreme than anything in the Phoenix region, with real documented performance numbers to work through with a student. Confirmed real training destination: DuBois Aviation (based at Chino, KCNO) runs a dedicated mountain-flying/high-DA proficiency course with a checkout here, and several other SoCal schools (including Van Nuys-based operators) fly training routes specifically to Big Bear for density-altitude instruction.",
  },
  KSEE:{ name:"Gillespie Field", city:"El Cajon, CA", elevation:387, class:"Class D", type:"Towered (part-time — reverts non-towered after hours)", runways:["09L/27R — 5,342ft","09R/27L — 2,738ft (closed sunset-sunrise)","17/35 — 4,145ft"], region:"socal", weather_icao:"KSEE",
    hazards:[
      {id:"PARTTIME",phase:["all"],sev:"medium",icon:"🗼",title:"Part-Time Tower — Confirm Operating Hours",why:"Tower operates 0700-2100 local — outside those hours the field reverts to non-towered self-announce procedures.",detail:"Confirm current tower hours before flight. When the tower is closed, aircraft must self-announce on CTAF prior to landing or departure — contact SOCAL Approach for IFR clearance delivery."},
      {id:"TERRAIN",phase:["pattern","all"],sev:"high",icon:"⛰",title:"893ft Mountain Affects Traffic Pattern Altitude",why:"A documented 893ft AGL mountain sits 2.1nm ENE of the field, directly affecting published pattern altitudes on R/W 27R.",detail:"R/W 27R uses 1,588ft (1,200ft AGL) right traffic sunrise-sunset specifically due to this terrain, dropping to 1,388ft (1,000ft AGL) left traffic sunset-sunrise. R/W 27R's centerline is in close alignment with this terrain — use of the LOC/DME approach is highly recommended rather than a straight-in visual."},
      {id:"WILDLIFE",phase:["all"],sev:"low",icon:"🐺",title:"Coyotes and Birds On and Near the Airport",detail:"Documented coyote and bird activity on and in the vicinity of the airfield — maintain a strong visual scan, particularly around dawn/dusk."},
      {id:"NOISE",phase:["departure"],sev:"medium",icon:"🔇",title:"Noise Abatement — Jet/Turbine Departures Discouraged at Night",detail:"R/W 17 is the preferred noise-abatement departure runway when the tower is closed. Turbine and jet departures are strongly discouraged 2200-0700, and noise-sensitive areas surround the field on all sides."},
    ],
    atcNotes:"Gillespie Tower 120.7 · Ground 121.7 · ATIS 125.45 · Clearance 125.1 · SOCAL Approach/Departure 124.35 — confirm tower hours (0700-2100 local) before flight.",
    cfiNotes:"Gillespie is San Diego County's primary GA training hub (SunState Academy of Aviation, Golden State Flying Club, and Plus One Flyers all base aircraft here) — the terrain-driven pattern altitude split on R/W 27R is the standout local brief, easy for a student to fly the wrong pattern altitude if not specifically taught.",
  },
  KMYF:{ name:"Montgomery-Gibbs Executive Airport", city:"San Diego, CA", elevation:427, class:"Class D", type:"Towered (part-time — reverts non-towered after hours)", runways:["10L/28R — 4,598ft","10R/28L — 3,401ft","05/23 — 3,400ft"], region:"socal", weather_icao:"KMYF",
    hazards:[
      {id:"PARTTIME",phase:["all"],sev:"medium",icon:"🗼",title:"Part-Time Tower — Confirm Operating Hours",why:"Tower operates 0600-2100 local — outside those hours the field reverts to non-towered self-announce procedures.",detail:"Confirm current tower hours before flight. Contact SOCAL Approach for IFR clearance delivery when the tower is closed."},
      {id:"CLASSB",phase:["all"],sev:"high",icon:"📡",title:"Directly Under San Diego Class B Shelf",why:"Montgomery-Gibbs sits close to San Diego International's Class B airspace.",detail:"Confirm current Class B shelf altitudes before any climb — this is a genuinely complex, stacked airspace environment shared with nearby Gillespie Field's own Class D."},
      {id:"MILITARY",phase:["all"],sev:"medium",icon:"🛩",title:"Military Jet Traffic Near Mission Bay VORTAC",detail:"Be alert to military jet aircraft in the vicinity of the airport and 4.7nm NW near the Mission Bay VORTAC — this is a documented, specific caution, not generic military awareness."},
      {id:"NOISE",phase:["all"],sev:"high",icon:"🔇",title:"Extreme Noise-Sensitive Areas — Monitored dB Limits",why:"Areas west and south of the airport are documented as extreme noise-sensitive, with active noise monitoring.",detail:"Maximum noise limit is 70dB over residential areas 2330-0630, and 88dB 0630-2330. No jet touch-and-go operations are permitted. Aircraft with high noise levels are requested to use R/W 10L/28R."},
      {id:"WILDLIFE",phase:["all"],sev:"low",icon:"🐺",title:"Birds and Coyotes On and Near the Airport",detail:"Documented bird activity on and in the vicinity of the airfield, with coyote activity specifically noted on runways and taxiways."},
    ],
    atcNotes:"Montgomery Tower 119.2 · Ground 118.225 · ATIS 126.9 · Clearance 123.725 · SOCAL Approach 124.35 — confirm tower hours (0600-2100 local) before flight.",
    cfiNotes:"Montgomery-Gibbs' very first use was flight training and it remains a major training hub (Flex Air and Plus One Flyers both base substantial fleets here) — the extreme noise-sensitive area with monitored dB limits is a genuinely distinctive local brief worth covering before a student's first visit.",
  },
  KCCB:{ name:"Cable Airport", city:"Upland, CA", elevation:1443, class:"Uncontrolled", type:"Non-Towered", runways:["06/24 — 3,863ft"], region:"socal", weather_icao:"KCCB",
    hazards:[
      {id:"NONTOW",phase:["all"],sev:"medium",icon:"📻",title:"Non-Towered — Self-Announce Required",detail:"No control tower. Self-announce at every standard reporting point on CTAF/UNICOM. Contact SOCAL Approach for IFR clearance delivery."},
      {id:"NARROW",phase:["landing"],sev:"high",icon:"⚠",title:"R/W 24 — Narrow Usable Approach Corridor",why:"Documented FAA remarks specifically restrict R/W 24's usable approach to a narrow corridor.",detail:"R/W 24 is unusable beyond 5° left or 2° right of centerline. A fence with red lights sits 50ft from the threshold, and the approach to the displaced threshold crosses a road. This is a genuinely tight, specific approach — not generic caution."},
      {id:"CLASSC",phase:["all"],sev:"medium",icon:"📡",title:"Adjacent to Ontario's Class C Airspace",why:"Cable sits close to Ontario International's (KONT) Class C shelf, which is also in this Academy's SoCal region.",detail:"Be wary of ONT's Class C airspace when operating in the pattern or transiting the area — confirm current shelf altitudes."},
      {id:"DA",phase:["takeoff","departure"],sev:"medium",icon:"🌡",title:"Density Altitude — Inland Empire Heat",why:"At 1,443ft field elevation in the Inland Empire, summer heat meaningfully affects performance.",detail:"Recalculate performance for actual conditions on warm days — pattern altitude here is 800ft AGL (2,243ft MSL), and reduced climb performance matters more than at coastal SoCal fields."},
    ],
    atcNotes:"CTAF/UNICOM 123.0 · SOCAL Approach 125.5/349.0 · Clearance delivery via SOCAL Approach 800-448-3724.",
    cfiNotes:"Cable is a genuine, busy Inland Empire training hub — CableAir School of Flight, Foothill Flying Club, and Cable Air Flight School are all based here. The narrow R/W 24 approach corridor is the standout local brief, easy to fly outside of on a student's first visit if not specifically covered.",
  },
  KSNA:{ name:"John Wayne Airport (Orange County)", city:"Santa Ana, CA", elevation:56, class:"Class C", type:"Towered (part-time secondary runway)", runways:["02L/20R — 5,700ft","02R/20L — 2,886ft (unavailable when tower closed)"], region:"socal", weather_icao:"KSNA",
    hazards:[
      {id:"CLASSC",phase:["all"],sev:"high",icon:"📡",title:"Class C Under the LAX Class B Shelf",why:"John Wayne's Class C airspace partially underlies Los Angeles' Class B — a genuinely layered, complex environment.",detail:"Establish two-way communication with SOCAL Approach before entering the Class C surface area. Confirm current Class B shelf altitudes for any climb — this is one of the busiest, most complex airspace stacks in the country."},
      {id:"BUSY",phase:["pattern","all"],sev:"high",icon:"✈",title:"Very High Commercial Traffic Volume",why:"John Wayne handles over 300,000 annual operations and 11M+ passengers — genuinely airline-level traffic density.",detail:"Expect to be sequenced behind and alongside airline traffic on every approach and departure. This is not a routine GA pattern — precise, prompt radio work is essential."},
      {id:"PARTTIME_RWY",phase:["all"],sev:"medium",icon:"🗼",title:"Secondary Runway Unavailable When Tower Closed",why:"Tower operates 0615-2300 local — R/W 02R/20L is not available outside those hours.",detail:"Confirm current tower hours before planning a late arrival or early departure. Only R/W 02L/20R remains usable when the tower is closed."},
      {id:"NOISE",phase:["departure"],sev:"medium",icon:"🔇",title:"Strict Noise Abatement — Specific Departure/Arrival Angles",detail:"Published departure and arrival angles reduce overflight of the parallel runway and surrounding noise-sensitive communities. Brief these specific procedures before taxi — this is a genuinely strict, actively-enforced noise environment."},
      {id:"PATTERN_ALT",phase:["pattern"],sev:"low",icon:"📏",title:"Pattern Altitude Varies by Runway and Aircraft Type",detail:"R/W 02L/20R: 1,000ft AGL for small aircraft, 1,500ft AGL for turbine aircraft over 12,500lbs. R/W 02R/20L: 800ft AGL for small singles, 1,000ft AGL for twins. Confirm the correct altitude for your aircraft and assigned runway."},
    ],
    atcNotes:"John Wayne Tower 119.9 · SOCAL Approach/Departure handles Class C — confirm current frequencies in the Chart Supplement. Tower hours 0615-2300 local.",
    cfiNotes:"John Wayne is a genuinely advanced training environment, not a first Class C exposure — Orange County Flight Center was founded here in 1981 specifically to train students 'right there with the airliners,' and Royal Aviation has operated here since 1976. The noise abatement procedures and layered Class C/B airspace are the standout local briefs.",
  },

  // ── COLORADO / FRONT RANGE ────────────────────────────────────────────────
  // Elevation/runway/class data verified against SkyVector (FAA NASR-sourced
  // remarks) plus at least one additional non-Wikipedia aviation source per
  // field. Region theme: genuine high-altitude performance planning and
  // mountain-proximity awareness — every field here sits at 4,600ft+ MSL,
  // materially higher baseline than any existing Academy region.
  KAPA:{ name:"Centennial Airport", city:"Denver (Englewood), CO", elevation:5884, class:"Class D", type:"Towered", runways:["17L/35R — 10,000ft","17R/35L — 7,001ft","10/28 — 4,800ft"], region:"colorado", weather_icao:"KAPA",
    hazards:[
      {id:"DA",phase:["takeoff","departure"],sev:"high",icon:"🌡",title:"High-Elevation Density Altitude",why:"Centennial sits at 5,884ft field elevation — density altitude regularly exceeds 8,000ft on warm afternoons.",detail:"The airport itself displays density altitude readouts at several locations on the field. Recalculate performance for actual conditions every flight, especially in summer."},
      {id:"PARALLEL",phase:["landing","takeoff"],sev:"high",icon:"⚠",title:"Close-Spaced Parallel Runways",detail:"Ensure proper runway alignment — 17L/35R and 17R/35L are close-spaced parallel runways, a documented source of confusion."},
      {id:"BUSY",phase:["pattern","all"],sev:"medium",icon:"✈",title:"One of the Busiest GA Airports in the US",detail:"Centennial sees very high training and business-aviation volume. Expect fast-paced ATC and precise radio discipline requirements."},
      {id:"POWERLINES",phase:["all"],sev:"medium",icon:"⚠",title:"Large Power Lines South of the Field",detail:"Multiple large power lines approximately 3nm south of runways 35R/35L — relevant to southbound departure/arrival planning."},
    ],
    atcNotes:"Centennial Tower — confirm current frequency in the Chart Supplement.",
    cfiNotes:"Centennial is the natural flagship field for this region — genuinely high training volume combined with real density altitude planning from day one.",
  },
  KBJC:{ name:"Rocky Mountain Metropolitan Airport", city:"Denver (Broomfield), CO", elevation:5673, class:"Class D", type:"Towered", runways:["12L/30R — 9,000ft","12R/30L — 7,002ft","3/21 — 3,600ft"], region:"colorado", weather_icao:"KBJC",
    hazards:[
      {id:"MTNWAVE",phase:["all"],sev:"high",icon:"💨",title:"Spring Mountain Wave Winds",why:"Rocky Mountain Metro sits on a mesa exposed to Front Range mountain wave effects.",detail:"Spring conditions can produce significant mountain-wave-induced turbulence and gusty winds hammering the field. Check current conditions closely, not just the forecast."},
      {id:"DA",phase:["takeoff","departure"],sev:"high",icon:"🌡",title:"High-Elevation Density Altitude",detail:"5,673ft field elevation — recalculate performance for actual conditions, especially on warm days."},
      {id:"BIRD",phase:["all"],sev:"medium",icon:"🦅",title:"Wildlife and Standley Lake Avoidance Area",detail:"Birds and wildlife documented near the runways. An avoidance area exists over nearby Standley Lake below 8,000ft MSL — confirm current boundaries."},
      {id:"STORM",phase:["all"],sev:"medium",icon:"⛈",title:"Summer Thunderstorm Activity",detail:"Front Range afternoon thunderstorms build quickly in summer — check TAF and radar closely, not just morning conditions."},
    ],
    atcNotes:"Rocky Mountain Metro Tower 118.6 — tower operates 0600-2200; outside those hours, use CTAF and published lighting procedures.",
    cfiNotes:"Good alternative to Centennial for the same density-altitude teaching value with somewhat lower traffic complexity — the mountain wave brief is genuinely important here given the mesa location.",
  },
  KFNL:{ name:"Northern Colorado Regional Airport", city:"Fort Collins/Loveland, CO", elevation:5020, class:"Class D", type:"Towered (remote tower)", runways:["15/33 — 8,500ft","6/24 — 2,189ft"], region:"colorado", weather_icao:"KFNL",
    hazards:[
      {id:"REMOTE",phase:["all"],sev:"medium",icon:"🗼",title:"Remote/Mobile Tower — Visual Limitations",why:"FNL's tower setup does not have radar and relies on visual observation, with some positions not always in direct sight.",detail:"Controllers will likely ask you to report specific positions given the remote tower configuration. Do not assume the same visual coverage as a conventional tower."},
      {id:"DA",phase:["takeoff","departure"],sev:"medium",icon:"🌡",title:"High-Elevation Density Altitude",detail:"5,020ft field elevation — recalculate performance for actual conditions."},
      {id:"RMNP",phase:["all"],sev:"low",icon:"⛰",title:"Rocky Mountain National Park Nearby",detail:"The field sits close to Rocky Mountain National Park terrain to the west — relevant for westbound scenic/cross-country routing awareness."},
    ],
    atcNotes:"NoCo Tower 118.4 · Ground 121.65 — confirm current status, this is a remote/mobile tower operation.",
    cfiNotes:"FNL's remote-tower setup is a genuinely unusual and useful teaching point — students should understand this isn't a conventional staffed tower with full visual coverage.",
  },
  KCOS:{ name:"Colorado Springs Airport", city:"Colorado Springs, CO", elevation:6187, class:"Class C", type:"Towered", runways:["17L/35R — 13,500ft","17R/35L — 11,022ft","13/31 — 8,270ft"], region:"colorado", weather_icao:"KCOS",
    hazards:[
      {id:"MILITARY",phase:["all"],sev:"high",icon:"🛩",title:"Intensive USAF Student Training Nearby",why:"Colorado Springs shares its operational environment with intensive Air Force student training activity, extending toward Pueblo.",detail:"Expect military traffic including large transport aircraft (C-17/C-5 class). Portions of some taxiways and runway are blocked from tower view when military aircraft occupy certain surfaces — listen carefully."},
      {id:"DA",phase:["takeoff","departure"],sev:"high",icon:"🌡",title:"High-Elevation Density Altitude",why:"6,187ft field elevation is genuinely high for a Class C airport.",detail:"Recalculate performance for actual conditions — this is significantly higher than most Class C fields most students will encounter."},
      {id:"BIRD",phase:["all"],sev:"medium",icon:"🦅",title:"Waterfowl and Migratory Bird Activity",detail:"Documented waterfowl and migratory bird activity on and around the airport."},
      {id:"CLASSC",phase:["all"],sev:"high",icon:"📡",title:"Class C — Two-Way Communication Required",detail:"Establish two-way communication with Colorado Springs Approach before entering the Class C surface area."},
    ],
    atcNotes:"Colorado Springs Approach/Tower — confirm current frequency in the Chart Supplement.",
    cfiNotes:"Colorado Springs combines genuine Class C procedures with real military traffic and high-elevation performance — a strong advanced-student field, not a first Class C exposure.",
  },
  KBDU:{ name:"Boulder Municipal Airport", city:"Boulder, CO", elevation:5288, class:"Class G", type:"Non-Towered", runways:["8/26 — 4,100ft","8G/26G — 4,100ft (turf)"], region:"colorado", weather_icao:"KBDU",
    hazards:[
      {id:"GLIDER",phase:["pattern","all"],sev:"high",icon:"🪂",title:"Active Glider Operations — Yield Required",why:"Boulder hosts significant glider activity, with published rules requiring powered aircraft to yield.",detail:"Powered aircraft must yield to gliders on final approach or initiate a go-around for adequate spacing. Simultaneous approach/departure on runways 8/26 and 8G/26G is not authorized. Glider activity occurs daily sunrise-to-sunset southeast of the field between 6,300-9,000ft — recommend avoidance and extreme caution transiting this area."},
      {id:"NONTOW",phase:["all"],sev:"medium",icon:"📻",title:"Non-Towered — Self-Announce Required",detail:"No control tower. Self-announce at every standard reporting point on CTAF."},
      {id:"DA",phase:["takeoff","departure"],sev:"medium",icon:"🌡",title:"High-Elevation Density Altitude",detail:"5,288ft field elevation — recalculate performance for actual conditions."},
      {id:"WATERFOWL",phase:["all"],sev:"low",icon:"🦆",title:"Waterfowl on and Near the Airport",detail:"Documented waterfowl activity, with Hayden Lake adjacent to the runway."},
    ],
    atcNotes:"No tower — self-announce on CTAF; confirm current frequency in the Chart Supplement. Clearance delivery: Denver Approach.",
    cfiNotes:"Boulder's active glider operations are the standout local brief — a genuinely different traffic-mixing scenario from anything else in this region.",
  },
  KLXV:{ name:"Lake County Airport (Leadville)", city:"Leadville, CO", elevation:9933, class:"Class G", type:"Non-Towered", runways:["16/34 — 6,400ft"], region:"colorado", weather_icao:"KLXV",
    hazards:[
      {id:"DA_EXTREME",phase:["takeoff","departure"],sev:"critical",icon:"🌡",title:"One of the Highest Public Airports in North America",why:"Leadville sits at 9,933ft field elevation — genuinely one of the highest paved public-use airports on the continent.",detail:"Density altitude here can exceed 12,000-13,000ft on a warm summer afternoon. This is the single most extreme performance-planning environment in the entire Academy database — many light aircraft are operating at or near their absolute performance limits here. Do not attempt this field without a thorough weight-and-balance and performance review specific to actual conditions."},
      {id:"TERRAIN",phase:["all"],sev:"high",icon:"⛰",title:"Surrounded by High Rockies Terrain",why:"Leadville sits in a mountain valley near Colorado's highest peaks (Mount Elbert and Mount Massive, both over 14,000ft).",detail:"Terrain awareness is critical in every direction. Mountain wave turbulence and rapidly changing conditions are genuine hazards, not textbook abstractions, at this field."},
      {id:"NONTOW",phase:["all"],sev:"medium",icon:"📻",title:"Non-Towered — Self-Announce Required",detail:"No control tower. Self-announce at every standard reporting point on CTAF."},
      {id:"SURFACE",phase:["taxi","all"],sev:"low",icon:"🛬",title:"Surface Condition Cautions",detail:"Some taxiway/ramp areas have documented potholes and loose aggregate. Runway edges have soft shoulders — taxi and roll at sensible speed."},
    ],
    atcNotes:"No tower — self-announce on CTAF; confirm current frequency in the Chart Supplement. Clearance delivery: Denver ARTCC.",
    cfiNotes:"Leadville is the standout extreme-altitude teaching field for the whole Academy platform — genuinely more demanding than Big Bear (SoCal) or anything in Phoenix. Advanced students only, with thorough pre-flight performance planning as the entire point of the lesson. Confirmed real training destination: a local Leadville Flying Club now offers on-field instruction, and Leadville is also a standard stop on mountain-flying courses run by multiple Denver-area schools (including Independence Aviation, American Flight Schools, and Arapahoe Flying Club).",
  },
  KEIK:{ name:"Erie Municipal Airport", city:"Erie, CO", elevation:5119, class:"Class G", type:"Non-Towered", runways:["16/34 — 4,700ft"], region:"colorado", weather_icao:"KEIK", source:FAA_SW_CURRENT,
    hazards:[
      {id:"NONTOW",phase:["all"],sev:"medium",icon:"📻",title:"Non-Towered — Self-Announce Required",detail:"No control tower. Self-announce at every standard reporting point on CTAF."},
      {id:"DA",phase:["takeoff","departure"],sev:"medium",icon:"🌡",title:"High-Elevation Density Altitude",detail:"5,119ft field elevation — recalculate performance for actual conditions."},
      {id:"DITCH",phase:["takeoff","landing"],sev:"low",icon:"⚠",title:"Documented Terrain Features Near Runway Ends",detail:"Documented ditches and a road within 1,350ft of the runway threshold on both sides — be aware on rejected takeoff or short landing scenarios."},
    ],
    atcNotes:"CTAF/UNICOM 123.0 · AWOS 133.825 · Denver Approach 125.125\nNon-towered. Confirm current frequencies and NOTAMs before flight.",
    cfiNotes:"A straightforward non-towered Front Range field for reinforcing self-announce discipline alongside the region's standard density-altitude planning.",
  },
  KLMO:{ name:"Vance Brand Airport", city:"Longmont, CO", elevation:5055, class:"Class G", type:"Non-Towered", runways:["11/29 — 4,799ft"], region:"colorado", weather_icao:"KLMO", source:FAA_SW_CURRENT,
    hazards:[
      {id:"PARACHUTE",phase:["all"],sev:"high",icon:"🪂",title:"Parachute Operations On and Near the Field",detail:"Parachute jumping occurs on and in the vicinity of the airport, primarily south of the runway. Avoid overflying mid-field."},
      {id:"ULTRALIGHT",phase:["pattern","all"],sev:"medium",icon:"✈",title:"Ultralight and Helicopter Activity",detail:"Documented ultralight and helicopter activity on and around the airport — expect a wider mix of aircraft types and speeds than a typical GA field."},
      {id:"NONTOW",phase:["all"],sev:"medium",icon:"📻",title:"Non-Towered — Self-Announce Required",detail:"No control tower. Self-announce at every standard reporting point on CTAF."},
      {id:"DA",phase:["takeoff","departure"],sev:"medium",icon:"🌡",title:"High-Elevation Density Altitude",detail:"5,055ft field elevation — recalculate performance for actual conditions."},
    ],
    atcNotes:"CTAF/UNICOM 122.975 · AWOS 120.0 · Denver Approach 125.125\nNon-towered. Confirm current frequencies and NOTAMs before flight.",
    cfiNotes:"Longmont's active parachute operations combined with ultralight/helicopter mix make this a genuinely busy non-towered environment — good lookout-discipline reinforcement.",
  },
  KGXY:{ name:"Greeley-Weld County Airport", city:"Greeley, CO", elevation:4697, class:"Class G", type:"Non-Towered", runways:["17/35 — 10,000ft","10/28 — 5,801ft"], region:"colorado", weather_icao:"KGXY", source:FAA_SW_CURRENT,
    hazards:[
      {id:"OILRIGS",phase:["all"],sev:"medium",icon:"⚠",title:"Oil Drilling Rigs On and Near the Airport",why:"Greeley sits in an active oil/gas extraction area.",detail:"Documented drilling rigs up to 120ft tall on and in the vicinity of the airport — a genuinely unusual obstacle hazard for a training field. Confirm current rig locations via NOTAMs."},
      {id:"CROSSWIND",phase:["landing","takeoff"],sev:"medium",icon:"💨",title:"Runway Selection Depends on Crosswind Component",detail:"Runway 17/35 is preferred when the crosswind component on 10/28 exceeds 12kt. Runway 35 is preferred when wind is below 5kt, and is the preferred runway for touch-and-go work."},
      {id:"DA",phase:["takeoff","departure"],sev:"medium",icon:"🌡",title:"High-Elevation Density Altitude",detail:"4,697ft field elevation — still meaningfully affects performance on warm days, recalculate rather than assume."},
      {id:"BIRD",phase:["all"],sev:"low",icon:"🦅",title:"Wildlife and Bird Activity",detail:"Documented wildlife and bird activity on and around the airport."},
    ],
    atcNotes:"CTAF/UNICOM 122.7 · AWOS 135.175 · Denver Approach 134.85 · Clearance Delivery 126.65\nNon-towered. Confirm current frequencies and NOTAMs before flight.",
    cfiNotes:"Greeley's oil rig obstacles are a genuinely distinctive local hazard worth specifically briefing — not something students will have encountered at other Academy fields.",
  },
  KPUB:{ name:"Pueblo Memorial Airport", city:"Pueblo, CO", elevation:4729, class:"Class D", type:"Towered (part-time)", runways:["08R/26L — 10,498ft","17/35 — 8,310ft","08L/26R — 4,690ft"], region:"colorado", weather_icao:"KPUB", source:FAA_SW_CURRENT,
    hazards:[
      {id:"TRAINING",phase:["pattern","all"],sev:"medium",icon:"✈",title:"High-Volume Flight Training Traffic",why:"Pueblo hosts documented high-volume DA-20 training aircraft operations sunrise-to-sunset on weekdays.",detail:"Expect heavy, concentrated training traffic during daylight hours Monday-Friday. Listen carefully and maintain precise pattern discipline."},
      {id:"CLOSEDRWY",phase:["landing","all"],sev:"medium",icon:"⚠",title:"Visible Closed Former Runway — Do Not Use",why:"A former runway (12/30) has been closed since at least the early 1990s but its asphalt remnant remains clearly visible from the air.",detail:"A diagonal band of old asphalt runs from near the end of R/W 17 toward 26L — this can be confused for an active runway from the air, especially by pilots unfamiliar with the field. It is not shown on current charts and must never be used."},
      {id:"MILITARY",phase:["all"],sev:"medium",icon:"🛩",title:"USAF Student Training Corridor",detail:"Pueblo shares the same intensive USAF student training corridor as nearby Colorado Springs — expect military traffic awareness to matter here too."},
      {id:"DA",phase:["takeoff","departure"],sev:"medium",icon:"🌡",title:"High-Elevation Density Altitude",detail:"4,729ft field elevation — recalculate performance for actual conditions."},
      {id:"RAPID",phase:["all"],sev:"low",icon:"⛽",title:"Rapid Refuel Operations",detail:"Rapid refuel operations are available during FBO hours with prior notice — relevant for cross-country planning."},
    ],
    atcNotes:"CTAF/Tower 119.1 · Ground 121.9 · ATIS 125.25 · Clearance 120.9\nDenver Approach 120.1 during published hours; Denver Center 128.375 when closed. Class D during tower hours, Class E when closed.",
    cfiNotes:"Pueblo's genuinely documented high training volume (explicitly noted for DA-20 traffic) makes this an authentic, realistic busy-pattern training environment.",
  },
  KCFO:{ name:"Colorado Air and Space Port (formerly Front Range Airport)", city:"Denver (Watkins), CO", elevation:5515, class:"Class D", type:"Towered", runways:["8/26 — 8,002ft","17/35 — 8,000ft"], region:"colorado", weather_icao:"KCFO",
    hazards:[
      {id:"MILITARY",phase:["all"],sev:"medium",icon:"🛩",title:"USAF Training Activity Caution",detail:"Same regional caution as Colorado Springs/Pueblo applies — intensive USAF student training activity in the vicinity."},
      {id:"NOISE",phase:["all"],sev:"low",icon:"🔇",title:"Noise Sensitive Areas",detail:"Noise sensitive areas exist southeast, south, and southwest of the airport — avoid flight below 1,000ft over populated areas."},
      {id:"DA",phase:["takeoff","departure"],sev:"medium",icon:"🌡",title:"High-Elevation Density Altitude",detail:"5,515ft field elevation — recalculate performance for actual conditions."},
      {id:"RENAME",phase:["all"],sev:"low",icon:"ℹ",title:"Recently Renamed Airport",why:"This field was formerly known as Front Range Airport.",detail:"Charts, references, and older materials may still show 'Front Range Airport' — confirm you're looking at current information under the Colorado Air and Space Port name."},
    ],
    atcNotes:"Colorado Air and Space Port Tower — confirm current frequency in the Chart Supplement.",
    cfiNotes:"Good long-runway option close to the Denver metro area with lower traffic complexity than Centennial — the recent renaming is worth flagging so students aren't confused by older references to 'Front Range.'",
  },
};

const FIELD_COORDS = {
  KDAB:[29.1799,-81.0581], KVRB:[27.6556,-80.4178], KFXE:[26.1973,-80.1707], KPMP:[26.2470,-80.1113],
  KLNA:[26.5930,-80.0850], KHWO:[26.0013,-80.2407], KFPR:[27.4975,-80.3727],
  KOBE:[27.2665,-80.8503], X59:[27.9608,-80.5583], X26:[27.8133,-80.4957],
  KTMB:[25.6479,-80.4328], KSRQ:[27.3954,-82.5544], KFMY:[26.5864,-81.8631],
  KGNV:[29.6900,-82.2718], KVNC:[27.0719,-82.4401], KBOW:[27.9436,-81.7834], KLAL:[27.9889,-82.0181],
  KPGD:[26.9200,-81.9906], KSPG:[27.7658,-82.6270],
  KPIE:[27.9102,-82.6874], KVDF:[27.9575,-82.5269], KCLW:[27.9767,-82.7573],
  KIMM:[26.4326,-81.3953], KDED:[29.0722,-81.2839],
  KZPH:[28.2283,-82.1561], KTIX:[28.5150,-80.7998], KAPF:[26.1526,-81.7752],
  KDVT:[33.6883,-112.0827], KFFZ:[33.4106,-111.7278], KCHD:[33.2691,-111.8107], KIWA:[33.3078,-111.6555],
  KGYR:[33.4225,-112.3755], KSDL:[33.6229,-111.9106], KPRC:[34.6546,-112.4196], KFLG:[35.1385,-111.6710],
  KBXK:[33.4522,-112.6879], KCGZ:[32.9548,-111.7679], KSOW:[34.2653,-110.0052],
  EGBP:[51.6660,-2.0567], EGTE:[50.7344,-3.4139], EGHH:[50.7800,-1.8425], EGBJ:[51.8942,-2.1672],
  EGTK:[51.8369,-1.3200], EGTC:[52.0719,-0.6169], EGKA:[50.8356,-0.2972], EGBW:[52.1922,-1.6142],
  EGHI:[50.9503,-1.3567], EGLK:[51.3236,-0.8478], EGHC:[50.1028,-5.6706], EGFH:[51.6053,-4.0678],
  EGNX:[52.8311,-1.3281], EGBB:[52.4539,-1.7480], EGSC:[52.2050,0.1750], EGSX:[51.7222,0.1547],
  EGMC:[51.5714,0.6956], EGKB:[51.3308,0.0325], EGTF:[51.3486,-0.5583], EGLF:[51.2753,-0.7775], EGTB:[51.6111,-0.8206],
  EGCC:[53.3537,-2.2750], EGCB:[53.4694,-2.3800], EGNJ:[53.5744,-0.3508], EGPF:[55.8719,-4.4331],
  EGPN:[56.4525,-3.0258], EGPK:[55.5094,-4.5867], EGNS:[54.0833,-4.6239], EGHQ:[50.4406,-4.9958],
  EGLM:[51.5083,-0.7794], EGSG:[51.6486,0.1544],
  // Texas
  KFTW:[32.819778,-97.362444], KFWS:[32.56528,-97.30806], KAFW:[32.99028,-97.31944], KT67:[32.91222,-97.40111],
  KGTU:[30.678808,-97.679383], KHYI:[29.89278,-97.86306], KAUS:[30.1945,-97.66983],
  KSGR:[29.62222,-95.65667], KDWH:[30.06194,-95.55278], KLVJ:[29.52139,-95.24222], KIWS:[29.81833,-95.67250],
  KCFD:[30.71556,-96.33139], KCLL:[30.58861,-96.36389],
  // SoCal
  KVNY:[34.2098,-118.4900], KCNO:[33.9748,-117.6365], KEMT:[34.0860,-118.0348], KFUL:[33.8720,-117.9798],
  KRAL:[33.9518,-117.4452], KHHR:[33.9228,-118.3350], KTOA:[33.8033,-118.3397], KSMO:[34.0158,-118.4513],
  KCRQ:[33.1283,-117.2800], KSDM:[32.5723,-116.9802], KPOC:[34.0917,-117.7818], L35:[34.2638,-116.8560],
  KSEE:[32.8262,-116.9724], KMYF:[32.8157,-117.1396], KCCB:[34.1117,-117.6875], KSNA:[33.6756,-117.8683],
  // Colorado / Front Range
  KAPA:[39.5702,-104.8493], KBJC:[39.9088,-105.1172], KFNL:[40.4518,-105.0113], KCOS:[38.8058,-104.7008],
  KBDU:[40.0393,-105.2262], KLXV:[39.2195,-106.3165], KEIK:[40.0102,-105.0480], KLMO:[40.1643,-105.1637],
  KGXY:[40.4375,-104.6332], KPUB:[38.2900,-104.4980], KCFO:[39.7842,-104.5377],
};

const SEV = {
  critical:{ color:"#FF3B3B", bg:"rgba(255,59,59,0.15)", border:"rgba(255,59,59,0.45)", label:"CRITICAL" },
  high:    { color:"#FF8C00", bg:"rgba(255,140,0,0.15)", border:"rgba(255,140,0,0.45)", label:"HIGH" },
  medium:  { color:"#FFD700", bg:"rgba(255,215,0,0.15)", border:"rgba(255,215,0,0.45)", label:"MEDIUM" },
  low:     { color:"#00C896", bg:"rgba(0,200,150,0.15)", border:"rgba(0,200,150,0.45)", label:"LOW" },
};

const PHASES = [{id:"all",label:"ALL PHASES"},{id:"taxi",label:"TAXI"},{id:"pattern",label:"PATTERN"},{id:"takeoff",label:"TAKEOFF"},{id:"landing",label:"LANDING"},{id:"departure",label:"DEPARTURE"}];

function useWindowWidth() {
  const [w,setW] = useState(typeof window!=="undefined"?window.innerWidth:1024);
  useEffect(()=>{ const fn=()=>setW(window.innerWidth); window.addEventListener("resize",fn); return ()=>window.removeEventListener("resize",fn); },[]);
  return w;
}

function calcDA(elevFt, tempC, altimInHg=29.92) {
  const pa = elevFt+(29.92-altimInHg)*1000;
  const isa = 15-(elevFt/1000)*1.98;
  return Math.round(pa+120*(tempC-isa));
}

// ── E6B calculations ─────────────────────────────────────────────────────
// True airspeed from CAS + pressure altitude + OAT, using the standard
// "2% per 1,000ft of density altitude" approximation — this is what a real
// E6B slide rule effectively computes, since density altitude captures both
// the pressure and temperature effects together. Reuses calcDA (passing
// altimeter=29.92 so calcDA returns pressure altitude + temp deviation,
// i.e. density altitude directly) for consistency with the rest of the app.
function calcTAS(casKt, pressureAltFt, oatC) {
  const da = calcDA(pressureAltFt, oatC, 29.92);
  return casKt * (1 + 0.02 * (da / 1000));
}

// Wind triangle: true course + true airspeed + wind (direction wind is FROM,
// speed) → wind correction angle, true heading, groundspeed. Standard
// trigonometric solution — returns null if the wind speed exceeds what's
// resolvable at that airspeed/course combination (asin out of domain).
function calcWindTriangle(trueCourseDeg, tasKt, windDirDeg, windSpdKt) {
  const toRad = d => (d * Math.PI) / 180;
  const toDeg = r => (r * 180) / Math.PI;
  const angleDiff = toRad(windDirDeg - trueCourseDeg);
  const ratio = (windSpdKt * Math.sin(angleDiff)) / tasKt;
  if (ratio > 1 || ratio < -1 || tasKt <= 0) return null;
  const wcaRad = Math.asin(ratio);
  const wcaDeg = toDeg(wcaRad);
  const trueHeading = (trueCourseDeg + wcaDeg + 360) % 360;
  const groundspeed = tasKt * Math.cos(wcaRad) - windSpdKt * Math.cos(angleDiff);
  return { wca: wcaDeg, trueHeading, groundspeed };
}

function DAWidget({ airfield, liveWx }) {
  const metarUsable = isMetarUsableForCalculations(liveWx);
  const liveTemp = metarUsable?parseMetarTemp(liveWx.metar):null;
  const liveAlt  = metarUsable?parseMetarAltimeter(liveWx.metar):null;
  const [tempC,setTempC] = useState(liveTemp??25);
  const [altim,setAltim] = useState(liveAlt??29.92);
  const [useLive,setUseLive] = useState(!!liveTemp);
  const da = calcDA(airfield.elevation,tempC,altim);
  const [daColor,daLabel,daRisk] = da>5000?["#FF3B3B","EXTREME","Recalculate ALL performance. Significant reductions in climb rate and extended takeoff roll."]:da>3500?["#FF8C00","HIGH","Significant performance loss. Review POH numbers at field elevation before engine start."]:da>2000?["#FFD700","MODERATE","Performance affected. Recalculate takeoff roll and climb rate."]:["#00C896","NORMAL","Standard performance expected. Continue with normal planning."];
  return (
    <div style={{background:"#0A1828",border:`2px solid ${daColor}55`,borderRadius:10,padding:"16px 18px",marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{fontSize:10,fontFamily:"'DM Mono',monospace",color:"#00B4FF",letterSpacing:"0.12em",fontWeight:"bold"}}>⬆ DENSITY ALTITUDE</div>
        <span style={{fontSize:8,fontFamily:"'DM Mono',monospace",color:useLive?"#00C896":"#FFD700",background:useLive?"rgba(0,200,150,0.15)":"rgba(255,215,0,0.1)",border:`1px solid ${useLive?"rgba(0,200,150,0.4)":"rgba(255,215,0,0.3)"}`,padding:"2px 7px",borderRadius:3}}>{useLive?"● LIVE METAR":"MANUAL"}</span>
      </div>
      <div style={{display:"flex",gap:16,marginBottom:14,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:130}}>
          <div style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#556677",marginBottom:5,letterSpacing:"0.1em"}}>OUTSIDE AIR TEMP (°C)</div>
          <input type="range" min={-10} max={55} value={tempC} onChange={e=>{setTempC(parseInt(e.target.value));setUseLive(false);}} style={{width:"100%",accentColor:"#00B4FF"}}/>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:16,color:"#FFFFFF",fontWeight:"bold"}}>{tempC}°C</span>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#445566"}}>{(tempC*9/5+32).toFixed(0)}°F</span>
          </div>
        </div>
        <div style={{flex:1,minWidth:130}}>
          <div style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#556677",marginBottom:5,letterSpacing:"0.1em"}}>ALTIMETER (inHg)</div>
          <input type="range" min={28.00} max={31.00} step={0.01} value={altim} onChange={e=>{setAltim(parseFloat(e.target.value));setUseLive(false);}} style={{width:"100%",accentColor:"#00B4FF"}}/>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:16,color:"#FFFFFF",fontWeight:"bold",marginTop:4}}>{altim.toFixed(2)}"</div>
        </div>
      </div>
      <div style={{background:"rgba(0,0,0,0.4)",borderRadius:8,padding:"14px 16px",border:`1px solid ${daColor}44`,textAlign:"center"}}>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#445566",letterSpacing:"0.15em",marginBottom:4}}>DENSITY ALTITUDE</div>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:36,color:daColor,fontWeight:"bold",lineHeight:1}}>{da.toLocaleString()} ft</div>
        <div style={{fontSize:11,color:daColor,fontWeight:"bold",marginTop:6,letterSpacing:"0.05em"}}>{daLabel} RISK</div>
        <div style={{fontSize:11,color:"#8899AA",marginTop:6,lineHeight:1.5}}>{daRisk}</div>
        <div style={{display:"flex",justifyContent:"center",gap:16,marginTop:8,fontSize:9,fontFamily:"'DM Mono',monospace",color:"#445566"}}>
          <span>Field: {airfield.elevation.toLocaleString()}ft</span>
          <span>ISA dev: {(tempC-(15-(airfield.elevation/1000)*1.98)).toFixed(1)}°C</span>
        </div>
      </div>
    </div>
  );
}

function calcCloudBase(tempC, dewpointC, elevFt) {
  const spread = tempC - dewpointC;
  const aglFt = Math.max(0, spread * 400);
  return Math.round(aglFt + elevFt);
}

function UkWeatherWidget({ airfield, liveWx }) {
  const metarUsable = isMetarUsableForCalculations(liveWx);
  const liveTemp = metarUsable?parseMetarTemp(liveWx.metar):null;
  const liveDew  = metarUsable?parseMetarDewpoint(liveWx.metar):null;
  const [tempC,setTempC] = useState(liveTemp??15);
  const [dewC,setDewC] = useState(liveDew??10);
  const [useLive,setUseLive] = useState(!!liveTemp);
  const cloudBaseAmsl = calcCloudBase(tempC, dewC, airfield.elevation);
  const cloudBaseAgl = Math.max(0, cloudBaseAmsl - airfield.elevation);
  const freezingLevel = estimateFreezingLevel(tempC, airfield.elevation);
  const icingRisk = tempC<=0 ? "LIKELY" : (freezingLevel < cloudBaseAmsl+2000 ? "POSSIBLE" : "NOT INDICATED");
  const riskColor = icingRisk==="LIKELY" ? "#FF3B3B" : icingRisk==="POSSIBLE" ? "#FFD700" : "#00C896";
  return (
    <div style={{background:"#0A1828",border:`2px solid ${riskColor}55`,borderRadius:8,padding:"11px 13px",marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:9}}>
        <div style={{fontSize:8,fontFamily:"'DM Mono',monospace",color:"#00B4FF",letterSpacing:"0.1em",fontWeight:"bold"}}>☁ CLOUD BASE & ICING</div>
        <span style={{fontSize:7,fontFamily:"'DM Mono',monospace",color:useLive?"#00C896":"#FFD700",background:useLive?"rgba(0,200,150,0.15)":"rgba(255,215,0,0.15)",border:`1px solid ${useLive?"rgba(0,200,150,0.4)":"rgba(255,215,0,0.3)"}`,padding:"2px 5px",borderRadius:3}}>{useLive?"● LIVE METAR":"MANUAL"}</span>
      </div>
      <div style={{display:"flex",gap:11,marginBottom:10,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:100}}>
          <div style={{fontSize:7,fontFamily:"'DM Mono',monospace",color:"#556677",marginBottom:4,letterSpacing:"0.08em"}}>TEMPERATURE (°C)</div>
          <input type="range" min={-10} max={35} value={tempC} onChange={e=>{setTempC(parseInt(e.target.value));setUseLive(false);}} style={{width:"100%",accentColor:"#00B4FF"}}/>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:"#FFFFFF",fontWeight:"bold",marginTop:3}}>{tempC}°C</div>
        </div>
        <div style={{flex:1,minWidth:100}}>
          <div style={{fontSize:7,fontFamily:"'DM Mono',monospace",color:"#556677",marginBottom:4,letterSpacing:"0.08em"}}>DEWPOINT (°C)</div>
          <input type="range" min={-15} max={30} value={dewC} onChange={e=>{setDewC(parseInt(e.target.value));setUseLive(false);}} style={{width:"100%",accentColor:"#8899AA"}}/>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:"#FFFFFF",fontWeight:"bold",marginTop:3}}>{dewC}°C</div>
        </div>
      </div>
      <div style={{background:"rgba(0,0,0,0.4)",borderRadius:6,padding:"10px 12px",border:`1px solid ${riskColor}44`,textAlign:"center"}}>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:7,color:"#445566",letterSpacing:"0.12em",marginBottom:3}}>ESTIMATED CLOUD BASE</div>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:25,color:"#FFFFFF",fontWeight:"bold",lineHeight:1}}>{cloudBaseAgl.toLocaleString()} ft AGL</div>
        <div style={{fontSize:8,color:"#8899AA",marginTop:3}}>({cloudBaseAmsl.toLocaleString()}ft AMSL)</div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:8,paddingTop:7,borderTop:"1px solid rgba(255,255,255,0.08)",textAlign:"left"}}>
          <span style={{fontSize:8,color:"#8899AA"}}>Freezing level: <b style={{color:"#C0D0E0"}}>~{freezingLevel.toLocaleString()}ft AMSL</b></span>
          <span style={{fontSize:8,fontFamily:"'DM Mono',monospace",color:riskColor,fontWeight:"bold"}}>ICING: {icingRisk}</span>
        </div>
      </div>
      <div style={{fontSize:7,color:"#556677",marginTop:7,lineHeight:1.4}}>Estimates only. Always confirm against the actual TAF/METAR and F214/F215 charts before flight.</div>
    </div>
  );
}

function formatIcingLevel(level) {
  if (!level) return "not reported";
  if (level === "FZL") return "the freezing level";
  if (level === "SFC") return "the surface";
  const hundreds = Number(level);
  return Number.isFinite(hundreds) ? `${(hundreds * 100).toLocaleString()}ft MSL` : level;
}

function IcingPanel({ airfield, icao, liveWx }) {
  const defaultAltitude = Math.min(17500, Math.ceil((airfield.elevation + 3000) / 500) * 500);
  const [plannedAltitude, setPlannedAltitude] = useState(defaultAltitude);
  const [icingData, setIcingData] = useState(null);
  const coords = FIELD_COORDS[icao];
  const [icingLoad, setIcingLoad] = useState(airfield.region !== "uk" && !!coords);
  const [icingError, setIcingError] = useState(false);
  const metarRetained = liveWx?.metarStatus === "last-known-good";
  const metarTooOld = liveWx?.metarStatus === "stale";
  const metarUnavailable = !liveWx?.metar || liveWx?.metarStatus === "unavailable";
  const metarUsable = isMetarUsableForCalculations(liveWx);
  const tempC = metarUsable ? parseMetarTemp(liveWx.metar) : null;
  const freezingLevel = estimateFreezingLevel(tempC, airfield.elevation);
  const visibleMoisture = hasVisibleMoistureSignal(metarUsable ? liveWx.metar : "", liveWx?.tafs || []);
  const advisoryActive = (icingData?.advisories || []).length > 0;
  const positivePireps = (icingData?.pireps || []).filter(report =>
    report.layers?.some(layer => layer.intensity && !isNegativeIcingIntensity(layer.intensity))
  );
  const negativePireps = (icingData?.pireps || []).filter(report =>
    report.layers?.some(layer => isNegativeIcingIntensity(layer.intensity))
  );
  const calculatedStatus = classifyIcingAwareness({
    plannedAltitudeFt:plannedAltitude,
    freezingLevelFt:freezingLevel,
    visibleMoisture,
    advisoryActive,
    positivePirepCount:positivePireps.length,
  });
  const status = advisoryActive || positivePireps.length > 0
    ? calculatedStatus
    : metarTooOld
      ? "ESTIMATE UNAVAILABLE — METAR TOO OLD"
      : metarUnavailable
        ? "ESTIMATE UNAVAILABLE — NO CURRENT METAR"
        : calculatedStatus;
  const statusColor = status === "OFFICIAL ADVISORY ACTIVE" || status === "ICING REPORTED NEARBY"
    ? "#FF3B3B"
    : status === "POTENTIAL" ? "#FFD700" : status.startsWith("ESTIMATE UNAVAILABLE") ? "#8899AA" : "#00C896";
  const officialUrl = airfield.region === "uk"
    ? "https://mavis.metoffice.gov.uk/"
    : "https://aviationweather.gov/gfa/#ice";
  const officialLabel = airfield.region === "uk" ? "OPEN MET OFFICE MAVIS" : "OPEN FAA GFA ICING";

  useEffect(() => {
    let cancelled = false;
    if (airfield.region === "uk" || !coords) {
      return () => { cancelled = true; };
    }
    fetchIcingData(icao, coords[0], coords[1]).then(data => {
      if (cancelled) return;
      setIcingData(data);
      setIcingError(!data);
      setIcingLoad(false);
    });
    return () => { cancelled = true; };
  }, [airfield.region, coords, icao]);

  return (
    <div style={{background:"#0A1828",border:`1px solid ${statusColor}55`,borderRadius:10,padding:"16px 18px",marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:12}}>
        <div style={{fontSize:10,fontFamily:"'DM Mono',monospace",color:"#00B4FF",letterSpacing:"0.12em",fontWeight:"bold"}}>❄ ICING / FREEZING LEVEL</div>
        <span style={{fontSize:8,fontFamily:"'DM Mono',monospace",color:statusColor,border:`1px solid ${statusColor}66`,background:`${statusColor}18`,padding:"3px 7px",borderRadius:4,fontWeight:"bold"}}>{status}</span>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:8,marginBottom:12}}>
        <div style={{background:"rgba(0,0,0,0.3)",borderRadius:7,padding:"10px 12px"}}>
          <div style={{fontSize:8,color:"#556677",fontFamily:"'DM Mono',monospace",letterSpacing:"0.08em",marginBottom:4}}>{metarTooOld?"STALE METAR — ESTIMATE DISABLED":metarRetained?"LAST-VALID METAR ESTIMATE":"METAR-BASED ESTIMATE"}</div>
          <div style={{fontSize:21,color:"#FFFFFF",fontWeight:"bold"}}>{freezingLevel === null ? "—" : `~${freezingLevel.toLocaleString()}ft`}</div>
          <div style={{fontSize:8,color:"#8899AA",marginTop:3}}>{metarTooOld?"Stale observation excluded":metarUnavailable?"No current METAR":freezingLevel === null?"METAR temperature missing":"MSL · surface lapse-rate estimate"}</div>
        </div>
        <div style={{background:"rgba(0,0,0,0.3)",borderRadius:7,padding:"10px 12px"}}>
          <div style={{fontSize:8,color:"#556677",fontFamily:"'DM Mono',monospace",letterSpacing:"0.08em",marginBottom:4}}>PLANNED ALTITUDE</div>
          <div style={{fontSize:21,color:"#FFFFFF",fontWeight:"bold"}}>{plannedAltitude.toLocaleString()}ft</div>
          <div style={{fontSize:8,color:"#8899AA",marginTop:3}}>MSL · selectable below</div>
        </div>
        <div style={{background:"rgba(0,0,0,0.3)",borderRadius:7,padding:"10px 12px"}}>
          <div style={{fontSize:8,color:"#556677",fontFamily:"'DM Mono',monospace",letterSpacing:"0.08em",marginBottom:4}}>VISIBLE-MOISTURE SIGNAL</div>
          <div style={{fontSize:14,color:visibleMoisture?"#FFD700":"#00C896",fontWeight:"bold",marginTop:5}}>{visibleMoisture?"INDICATED":"NOT INDICATED"}</div>
          <div style={{fontSize:8,color:"#8899AA",marginTop:5}}>{metarTooOld?"Current TAF only · stale METAR excluded":metarUnavailable?"Current TAF only · METAR unavailable":metarRetained?"Last-valid METAR and current TAF":"Current METAR and TAF only"}</div>
        </div>
      </div>

      <div style={{marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:8,fontSize:8,color:"#556677",fontFamily:"'DM Mono',monospace",marginBottom:5}}><span>FIELD {airfield.elevation.toLocaleString()}ft</span><span>17,500ft MSL</span></div>
        <input aria-label="Planned altitude for icing comparison" type="range" min={Math.max(0,Math.floor(airfield.elevation/500)*500)} max={17500} step={500} value={plannedAltitude} onChange={event=>setPlannedAltitude(Number(event.target.value))} style={{width:"100%",accentColor:statusColor}}/>
      </div>

      {airfield.region !== "uk" && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:8,marginBottom:12}}>
          <div style={{background:"rgba(0,0,0,0.25)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:7,padding:"10px 12px"}}>
            <div style={{fontSize:8,color:"#556677",fontFamily:"'DM Mono',monospace",letterSpacing:"0.08em",marginBottom:6}}>G-AIRMET ZULU · SELECTED AIRFIELD</div>
            {icingLoad ? <div style={{fontSize:10,color:"#8899AA"}}>Checking official advisory…</div> : advisoryActive ? (
              (icingData.advisories || []).map((advisory,index)=><div key={`${advisory.validTime}-${index}`} style={{fontSize:10,color:"#FF8C00",lineHeight:1.55,fontWeight:"bold"}}>{advisory.severity || "MOD"} icing · {formatIcingLevel(advisory.base)} to {formatIcingLevel(advisory.top)}</div>)
            ) : <div style={{fontSize:10,color:icingError?"#8899AA":"#00C896",lineHeight:1.5}}>{icingError?"Official advisory feed unavailable.":"No current G-AIRMET icing area intersects this airfield."}</div>}
            {icingData?.validTime && <div style={{fontSize:8,color:"#556677",marginTop:5}}>Snapshot valid {new Date(icingData.validTime).toLocaleString([], {timeZone:"UTC",hour:"2-digit",minute:"2-digit",day:"numeric",month:"short",timeZoneName:"short"})}</div>}
          </div>
          <div style={{background:"rgba(0,0,0,0.25)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:7,padding:"10px 12px"}}>
            <div style={{fontSize:8,color:"#556677",fontFamily:"'DM Mono',monospace",letterSpacing:"0.08em",marginBottom:6}}>ICING PIREPS · 100 NM / 6 HOURS</div>
            {icingLoad ? <div style={{fontSize:10,color:"#8899AA"}}>Checking recent pilot reports…</div> : (
              <>
                <div style={{fontSize:10,color:positivePireps.length?"#FF8C00":"#C0D4E8",lineHeight:1.5}}>{positivePireps.length} positive · {negativePireps.length} negative</div>
                {positivePireps.slice(0,3).map((report,index)=><div key={`${report.observedAt}-${index}`} style={{fontSize:9,color:"#C0D4E8",lineHeight:1.5,marginTop:4}}>{report.layers.map(layer=>`${layer.intensity}${layer.type?` ${layer.type}`:""}`).join(" / ")} · {report.flightLevelFt?`${report.flightLevelFt.toLocaleString()}ft`:"altitude not reported"}{report.distanceNm!==null?` · ${report.distanceNm} NM`:""}</div>)}
                {!icingError && !positivePireps.length && <div style={{fontSize:8,color:"#556677",marginTop:5,lineHeight:1.4}}>No positive icing reports returned. Absence of PIREPs is not evidence of no icing.</div>}
                {icingError && <div style={{fontSize:8,color:"#8899AA",marginTop:5}}>Official PIREP feed unavailable.</div>}
              </>
            )}
          </div>
        </div>
      )}

      <a href={officialUrl} target="_blank" rel="noreferrer" style={{display:"inline-block",background:"rgba(0,180,255,0.15)",border:"1px solid rgba(0,180,255,0.4)",borderRadius:6,padding:"7px 13px",color:"#00B4FF",fontFamily:"'DM Mono',monospace",fontSize:9,textDecoration:"none",fontWeight:"bold",marginBottom:10}}>{officialLabel} →</a>
      <div style={{fontSize:8,color:"#556677",lineHeight:1.5}}>Training awareness only. The freezing level is estimated from one surface observation and can miss inversions or multiple freezing layers. Icing requires below-freezing temperatures and visible moisture; use the full official forecast, advisories, PIREPs, aircraft limitations, and an approved weather briefing. “Not indicated locally” never means “no icing.”</div>
    </div>
  );
}

function WeatherLayerWidget({ airfield, icao, liveWx }) {
  const [layer, setLayer] = useState("radar");
  return (
    <>
      <div style={{display:"flex",gap:5,marginBottom:8,position:"relative",zIndex:1}} role="tablist" aria-label="Weather display">
        {[["radar","🗺 RADAR"],["icing","❄ ICING / FREEZING LEVEL"]].map(([id,label])=><button key={id} role="tab" aria-selected={layer===id} onClick={()=>setLayer(id)} style={{background:layer===id?"rgba(0,180,255,0.18)":"rgba(255,255,255,0.04)",border:`1px solid ${layer===id?"rgba(0,180,255,0.45)":"rgba(255,255,255,0.08)"}`,borderRadius:6,padding:"7px 12px",color:layer===id?"#00B4FF":"#8899AA",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:9,fontWeight:"bold",letterSpacing:"0.05em"}}>{label}</button>)}
      </div>
      {layer === "radar" ? <MapWidget airfield={airfield} icao={icao}/> : <IcingPanel key={icao} airfield={airfield} icao={icao} liveWx={liveWx}/>}
    </>
  );
}

const RAINVIEWER_API_URL = "https://api.rainviewer.com/public/weather-maps.json";

function MapWidget({ airfield, icao }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const radarLayerRef = useRef(null);
  const [frames, setFrames] = useState([]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [leaflet, setLeaflet] = useState(null);
  const coords = FIELD_COORDS[icao] || [39.8, -98.6];
  const latitude = coords[0];
  const longitude = coords[1];

  useEffect(() => {
    let cancelled = false;
    import("leaflet")
      .then(module => { if (!cancelled) setLeaflet(module.default); })
      .catch(() => { if (!cancelled) setLoadError("Could not load the weather map."); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(RAINVIEWER_API_URL)
      .then(res => { if (!res.ok) throw new Error(`RainViewer returned ${res.status}`); return res.json(); })
      .then(data => {
        if (cancelled) return;
        const past = data.radar?.past ?? [];
        if (!past.length) { setLoadError("No radar frames available right now."); return; }
        setFrames(past);
        setFrameIndex(past.length - 1);
      })
      .catch(err => { if (!cancelled) setLoadError(err.message || "Could not load weather map."); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || !leaflet) return;
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    const map = leaflet.map(mapContainerRef.current, { center:[latitude,longitude], zoom:7, minZoom:4, maxZoom:12, scrollWheelZoom:false, doubleClickZoom:true, touchZoom:true, zoomControl:true });
    map.on('click', () => map.scrollWheelZoom.enable());
    leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution:'&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> | Radar: <a href="https://www.rainviewer.com/">RainViewer</a>', maxZoom:12 }).addTo(map);
    leaflet.marker([latitude,longitude]).addTo(map).bindPopup(`${airfield.name} (${icao})`);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; radarLayerRef.current = null; };
  }, [airfield.name, icao, latitude, leaflet, longitude]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !frames.length || !leaflet) return;
    const frame = frames[frameIndex];
    if (!frame) return;
    const tileUrl = `https://tilecache.rainviewer.com${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;
    if (radarLayerRef.current) map.removeLayer(radarLayerRef.current);
    const layer = leaflet.tileLayer(tileUrl, { opacity:0.7, zIndex:10, maxZoom:12 });
    layer.addTo(map);
    radarLayerRef.current = layer;
  }, [frames, frameIndex, icao, leaflet]);

  useEffect(() => {
    if (!isPlaying || !frames.length) return;
    const interval = setInterval(() => setFrameIndex(p => (p+1) % frames.length), 600);
    return () => clearInterval(interval);
  }, [isPlaying, frames.length]);

  const currentFrameTime = frames[frameIndex] ? new Date(frames[frameIndex].time * 1000).toUTCString() : null;

  return (
    <div style={{background:"#0A1828",border:"1px solid rgba(0,180,255,0.2)",borderRadius:10,padding:"16px 18px",marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{fontSize:10,fontFamily:"'DM Mono',monospace",color:"#00B4FF",letterSpacing:"0.12em",fontWeight:"bold"}}>🗺 WEATHER MAP</div>
        {currentFrameTime && <span style={{fontSize:8,fontFamily:"'DM Mono',monospace",color:"#8899AA"}}>{currentFrameTime}</span>}
      </div>
      <div ref={mapContainerRef} style={{height:280,width:"100%",borderRadius:8,overflow:"hidden",position:"relative",zIndex:0}}/>
      <div style={{fontSize:9,color:"#556677",marginTop:6}}>Click the map to enable scroll-wheel zoom. Capped at zoom 12 (RainViewer radar tile limit).</div>
      {loadError && <div style={{fontSize:10,color:"#FF8C00",marginTop:8}}>{loadError}</div>}
      {!loadError && frames.length>0 && (
        <div style={{display:"flex",alignItems:"center",gap:10,marginTop:10}}>
          <button onClick={()=>setIsPlaying(p=>!p)} style={{background:"rgba(0,180,255,0.15)",border:"1px solid rgba(0,180,255,0.4)",borderRadius:5,padding:"5px 12px",color:"#00B4FF",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:10}}>{isPlaying?"⏸":"▶"}</button>
          <input type="range" min={0} max={frames.length-1} value={frameIndex} onChange={e=>{setIsPlaying(false);setFrameIndex(Number(e.target.value));}} style={{flex:1,accentColor:"#00B4FF"}}/>
        </div>
      )}
      <div style={{fontSize:9,color:"#556677",marginTop:10,lineHeight:1.5}}>
        {airfield.region === "uk" ? <>
          Radar from <a href="https://www.rainviewer.com/" target="_blank" rel="noreferrer" style={{color:"#00B4FF"}}>RainViewer</a>. Not a substitute for the Met Office Aviation Briefing Service — check <a href="https://mavis.metoffice.gov.uk/" target="_blank" rel="noreferrer" style={{color:"#00B4FF"}}>MAVIS</a> for regulated TAFs, SIGMETs, and F215 charts before flight.
        </> : <>
          Radar from <a href="https://www.rainviewer.com/" target="_blank" rel="noreferrer" style={{color:"#00B4FF"}}>RainViewer</a>. For official US aviation weather and a complete briefing, use <a href="https://aviationweather.gov/" target="_blank" rel="noreferrer" style={{color:"#00B4FF"}}>AviationWeather.gov</a> and <a href="https://www.1800wxbrief.com/" target="_blank" rel="noreferrer" style={{color:"#00B4FF"}}>Flight Service</a>.
        </>}
      </div>
    </div>
  );
}

// ── TAF Display Component ─────────────────────────────────────────────────
function TAFDisplay({ tafs }) {
  if (!tafs || !tafs.length) return (
    <div style={{fontSize:11,color:"#334455",fontFamily:"'DM Mono',monospace",padding:"12px 0"}}>No TAF available for this field.</div>
  );
  const tafRaw = tafs[0];
  const periods = parseTAFPeriods(tafRaw);
  const periodColors = { BASE:"#00B4FF", BECMG:"#00C896", TEMPO:"#FFD700", "PROB TEMPO":"#FF8C00", PROB:"#FF8C00", FROM:"#8899AA", PERIOD:"#8899AA" };

  return (
    <div>
      {periods.map((p,i)=>{
        const hasCB = /\b(?:FEW|SCT|BKN|OVC)\d{3}CB\b|\bTSRA\b|(?:^|\s)\+TS\b/.test(p.raw);
        const color = periodColors[p.type] || "#8899AA";
        return (
          <div key={i} style={{display:"flex",gap:10,marginBottom:8,padding:"10px 12px",background:"rgba(0,0,0,0.3)",borderRadius:7,borderLeft:`3px solid ${hasCB?"#FF3B3B":color}`}}>
            <div style={{flexShrink:0,minWidth:80}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:hasCB?"#FF3B3B":color,fontWeight:"bold",letterSpacing:"0.08em"}}>{p.type}</div>
              {hasCB && <div style={{fontSize:9,color:"#FF3B3B",marginTop:3}}>⛈ CB/TS</div>}
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:12,color:"#FFFFFF",fontWeight:500,lineHeight:1.6}}>{parsePeriodSummary(p.raw)}</div>
              <div style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#334455",marginTop:4,lineHeight:1.5,wordBreak:"break-all"}}>{p.raw.slice(0,120)}{p.raw.length>120?"…":""}</div>
            </div>
          </div>
        );
      })}
      <div style={{fontSize:8,color:"#334455",marginTop:8,lineHeight:1.5,fontFamily:"'DM Mono',monospace"}}>TAF IS A FORECAST — NOT A CURRENT OBSERVATION. ALWAYS OBTAIN AN OFFICIAL WEATHER BRIEFING BEFORE FLIGHT.</div>
    </div>
  );
}

function WeatherStrip({ liveWx, wxLoad, requestedIcao, weatherIcao }) {
  const [wxTab, setWxTab] = useState("metar");
  if (wxLoad) return <div style={{background:"#0A1828",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"12px 16px",marginBottom:14,fontSize:10,color:"#334455",fontFamily:"'DM Mono',monospace"}}>Loading live weather…</div>;
  if (!liveWx) return <div style={{background:"#0A1828",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"12px 16px",marginBottom:14,fontSize:10,color:"#334455",fontFamily:"'DM Mono',monospace"}}>No live weather data available for this field.</div>;
  const metarStatus = liveWx.metarStatus || (liveWx.metar ? "current" : "unavailable");
  const metarRetained = metarStatus === "last-known-good";
  const metarTooOld = metarStatus === "stale";
  const metarUnavailable = metarStatus === "unavailable";
  const metarAge = Number.isFinite(liveWx.metarAgeMinutes) ? liveWx.metarAgeMinutes : null;
  const ageLabel = metarAge === null
    ? null
    : metarAge < 90
      ? `${metarAge} minutes`
      : metarAge < 2880
        ? `${Math.round(metarAge / 60)} hours`
        : `${Math.round(metarAge / 1440)} days`;
  const observedLabel = liveWx.metarObservedAt
    ? new Date(liveWx.metarObservedAt).toLocaleString([], {timeZone:"UTC",hour:"2-digit",minute:"2-digit",day:"numeric",month:"short",timeZoneName:"short"})
    : null;
  const tafThreats = parseTAFThreats(liveWx.tafs);
  const hasCB = !metarTooOld && liveWx.metar && /\b(?:FEW|SCT|BKN|OVC)\d{3}CB\b|\bTSRA\b|(?:^|\s)\+TS\b/.test(liveWx.metar);
  const usesNearbyStation = requestedIcao !== weatherIcao;
  return (
    <div style={{background:"#0A1828",border:"1px solid rgba(0,180,255,0.2)",borderRadius:10,padding:"14px 16px",marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontSize:10,fontFamily:"'DM Mono',monospace",color:"#00B4FF",letterSpacing:"0.12em",fontWeight:"bold"}}>🌤 LIVE WEATHER</div>
        <span style={{fontSize:8,fontFamily:"'DM Mono',monospace",color:metarRetained||metarTooOld||metarUnavailable?"#FFD700":"#00C896"}}>{metarRetained?"◷ LAST VALID METAR":metarTooOld?"⚠ STALE METAR":metarUnavailable?"⚠ METAR UNAVAILABLE":"● LIVE"}</span>
      </div>
      {usesNearbyStation && <div style={{background:"rgba(255,215,0,0.08)",border:"1px solid rgba(255,215,0,0.28)",borderRadius:6,padding:"8px 10px",marginBottom:10,fontSize:10,color:"#FFD700",lineHeight:1.5}}>⚠ Weather shown is from nearby station <b>{weatherIcao}</b>, not an on-airport observation for {requestedIcao}. Allow for local differences.</div>}
      {metarRetained && <div style={{background:"rgba(255,215,0,0.08)",border:"1px solid rgba(255,215,0,0.28)",borderRadius:6,padding:"8px 10px",marginBottom:10,fontSize:10,color:"#FFD700",lineHeight:1.5}}>⚠ The current METAR feed is temporarily unavailable. Academy is showing the last valid observation{observedLabel?` from ${observedLabel}`:""} and will recheck the official feed.</div>}
      {metarTooOld && <div style={{background:"rgba(255,59,59,0.08)",border:"1px solid rgba(255,59,59,0.35)",borderRadius:6,padding:"8px 10px",marginBottom:10,fontSize:10,color:"#FF8C00",lineHeight:1.5}}>⚠ The latest METAR is {ageLabel?`${ageLabel} old`:"not time-verifiable"}{observedLabel?` (${observedLabel})`:""}. It is shown for context only; Academy has disabled METAR-dependent calculations.</div>}
      {metarUnavailable && <div style={{background:"rgba(255,215,0,0.08)",border:"1px solid rgba(255,215,0,0.28)",borderRadius:6,padding:"8px 10px",marginBottom:10,fontSize:10,color:"#FFD700",lineHeight:1.5}}>⚠ No current or retained METAR is available. METAR-dependent estimates are unavailable; use the TAF and official weather sources while Academy retries the feed.</div>}
      {/* Weather sub-tabs */}
      <div style={{display:"flex",gap:2,marginBottom:12,borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
        {[["metar","METAR"],["taf","TAF FORECAST"]].map(([tid,label])=>(
          <button key={tid} onClick={()=>setWxTab(tid)} style={{background:"none",border:"none",cursor:"pointer",padding:"6px 12px",fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:"0.08em",color:wxTab===tid?"#00B4FF":"#556677",borderBottom:wxTab===tid?"2px solid #00B4FF":"2px solid transparent",marginBottom:"-1px",transition:"all 0.15s"}}>{label}</button>
        ))}
      </div>
      {wxTab==="metar" && (
        <div>
          <div style={{background:"rgba(255,255,255,0.04)",borderRadius:6,padding:"10px 12px",marginBottom:10}}>
            <div style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#445566",marginBottom:4,letterSpacing:"0.1em"}}>{metarTooOld?"STALE CONDITIONS — CONTEXT ONLY":metarRetained?"LAST VALID CONDITIONS":"CURRENT CONDITIONS"}</div>
            {/* CHANGE 2: METAR interpretation text now white */}
            <div style={{fontSize:13,color:metarUnavailable?"#8899AA":"#FFFFFF",fontWeight:"500",lineHeight:1.6}}>{metarUnavailable?"METAR temporarily unavailable.":interpretMetarShort(liveWx.metar)}</div>
            {hasCB && <div style={{marginTop:6,fontSize:11,color:"#FF3B3B",fontWeight:"bold"}}>⛈ ACTIVE THUNDERSTORM / CB DETECTED IN METAR</div>}
          </div>
          {tafThreats.length>0 && (
            <div style={{background:"rgba(255,59,59,0.08)",border:"1px solid rgba(255,59,59,0.3)",borderRadius:6,padding:"10px 12px",marginBottom:10}}>
              <div style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#FF8C00",marginBottom:6,letterSpacing:"0.1em"}}>⚠ FORECAST HAZARDS (TAF)</div>
              {tafThreats.map((t,i)=><div key={i} style={{fontSize:12,color:t.color,marginBottom:3,fontWeight:"500"}}>{t.icon}  {t.text}</div>)}
            </div>
          )}
          {!metarUnavailable && <div style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#FFFFFF",lineHeight:1.6,wordBreak:"break-all"}}>{liveWx.metar}</div>}
        </div>
      )}
      {wxTab==="taf" && <TAFDisplay tafs={liveWx.tafs}/>}
    </div>
  );
}

function HazardCard({ h, expanded, onToggle }) {
  const sc = SEV[h.sev];
  return (
    <div onClick={onToggle} style={{background:expanded?sc.bg:"rgba(15,25,40,0.9)",border:`1px solid ${expanded?sc.border:"rgba(255,255,255,0.1)"}`,borderRadius:9,marginBottom:8,cursor:"pointer",overflow:"hidden",transition:"all 0.2s",boxShadow:expanded?`0 0 20px ${sc.bg}`:"none"}}>
      <div style={{padding:"13px 15px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:36,height:36,background:sc.bg,border:`1px solid ${sc.border}`,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>{h.icon}</div>
          <div>
            <div style={{fontSize:13,color:"#FFFFFF",fontWeight:600,lineHeight:1.3}}>{h.title}</div>
            <div style={{fontSize:9,color:"#556677",fontFamily:"'DM Mono',monospace",marginTop:2,letterSpacing:"0.08em"}}>{h.phase.join(" · ").toUpperCase()}</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
          <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:sc.color,background:sc.bg,border:`1px solid ${sc.border}`,padding:"3px 8px",borderRadius:3,fontWeight:"bold"}}>{sc.label}</span>
          <span style={{color:sc.color,fontSize:14,fontWeight:"bold"}}>{expanded?"▾":"›"}</span>
        </div>
      </div>
      {expanded && (
        <div style={{padding:"0 15px 14px 15px",borderTop:`1px solid ${sc.border}55`}}>
          {h.why && <div style={{fontSize:11,color:sc.color,fontWeight:"600",fontStyle:"italic",marginBottom:8,marginTop:10,padding:"6px 10px",background:sc.bg,borderRadius:5,borderLeft:`3px solid ${sc.color}`}}>Why this matters: {h.why}</div>}
          <div style={{fontSize:12,color:"#C0D0E0",lineHeight:1.8,marginTop:h.why?0:10}}>{h.detail}</div>
        </div>
      )}
    </div>
  );
}

// ── Flight School / Club Ops System — SIMULATED DEMO ONLY ────────────────
// There is no real backend or API behind this. It exists purely to
// demonstrate a planned integration: a flight school's own ops system
// (student/instructor currency, aircraft airworthiness and squawks) feeding
// directly into the pre-flight risk-assessment process. Every value below
// is fabricated example data, clearly labelled as such everywhere it
// appears — never presented as if it were a real live feed.

const INITIAL_DEMO_WORKSPACE = createDemoWorkspaceSnapshot();
const MOCK_OPS_PEOPLE = INITIAL_DEMO_WORKSPACE.people;
const MOCK_OPS_AIRCRAFT = INITIAL_DEMO_WORKSPACE.aircraft;

function AccountTypeScreen({ onSelect }) {
  return (
    <div style={{minHeight:"100vh",background:"#050D18",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px",fontFamily:"'Inter',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Inter:wght@300;400;500;600;700&family=Bebas+Neue&display=swap');*{box-sizing:border-box;}`}</style>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
        <div style={{width:34,height:34,background:"linear-gradient(135deg,#0055DD,#00B4FF)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17}}>✈</div>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:30,letterSpacing:"0.15em",color:"#FFFFFF"}}>SAFEROUTE <span style={{color:"#00B4FF"}}>ACADEMY</span></div>
      </div>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#556677",letterSpacing:"0.15em",marginBottom:40}}>STUDENT PILOT SAFETY INTELLIGENCE</div>
      <div style={{fontSize:12,fontFamily:"'DM Mono',monospace",color:"#8899AA",letterSpacing:"0.12em",marginBottom:18}}>HOW ARE YOU USING SAFEROUTE ACADEMY?</div>
      <div style={{display:"flex",gap:18,flexWrap:"wrap",justifyContent:"center",maxWidth:700}}>
        <button onClick={()=>onSelect("personal")} style={{width:280,textAlign:"left",background:"rgba(0,180,255,0.06)",border:"1px solid rgba(0,180,255,0.25)",borderRadius:12,padding:"24px 22px",cursor:"pointer"}}
          onMouseEnter={e=>{e.currentTarget.style.background="rgba(0,180,255,0.14)";e.currentTarget.style.borderColor="rgba(0,180,255,0.5)";}}
          onMouseLeave={e=>{e.currentTarget.style.background="rgba(0,180,255,0.06)";e.currentTarget.style.borderColor="rgba(0,180,255,0.25)";}}>
          <div style={{fontSize:30,marginBottom:12}}>🧑‍✈️</div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:14,color:"#00B4FF",fontWeight:"bold",letterSpacing:"0.08em",marginBottom:8}}>PERSONAL</div>
          <div style={{fontSize:12,color:"#8899AA",lineHeight:1.6}}>Use SafeRoute Academy on your own — airfield intel, live weather, the E6B, and the FRAT tool, exactly as it works today.</div>
        </button>
        <button onClick={()=>onSelect("flightschool")} style={{width:280,textAlign:"left",background:"rgba(255,180,0,0.06)",border:"1px solid rgba(255,180,0,0.25)",borderRadius:12,padding:"24px 22px",cursor:"pointer"}}
          onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,180,0,0.14)";e.currentTarget.style.borderColor="rgba(255,180,0,0.5)";}}
          onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,180,0,0.06)";e.currentTarget.style.borderColor="rgba(255,180,0,0.25)";}}>
          <div style={{fontSize:30,marginBottom:12}}>🏫</div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:14,color:"#FFD700",fontWeight:"bold",letterSpacing:"0.08em",marginBottom:8}}>FLIGHT SCHOOL / CLUB</div>
          <div style={{fontSize:12,color:"#8899AA",lineHeight:1.6}}>Preview a planned integration — an ops system feeding student/instructor currency and aircraft status directly into the FRAT.</div>
          <div style={{marginTop:10,fontSize:9,fontFamily:"'DM Mono',monospace",color:"#FFD700",letterSpacing:"0.06em"}}>⚠ DEMO — NOT A LIVE SYSTEM</div>
        </button>
      </div>
    </div>
  );
}

function DemoDataNotice({ persistenceState, onReset, detail }) {
  const saveText=persistenceState?.status==="saving"?"Saving changes…":persistenceState?.status==="error"?"Save needs attention":persistenceState?.label||"PRIVATE SYNTHETIC DEMO";
  return (
    <div style={{background:"rgba(255,180,0,0.08)",border:"1px solid rgba(255,180,0,0.3)",borderRadius:8,padding:"10px 12px",fontSize:10.5,color:"#FFD700",lineHeight:1.5,marginBottom:18}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start",flexWrap:"wrap"}}>
        <div><b>⚠ SYNTHETIC PRIVATE DEMO</b> — {detail||"This resettable workspace contains fictional people, aircraft and records only."}<br/><span style={{color:"#C9B56A"}}>Do not enter real personal, medical, training, maintenance or operational information.</span></div>
        {onReset&&<button onClick={onReset} style={{background:"rgba(255,255,255,0.055)",border:"1px solid rgba(255,215,0,0.28)",borderRadius:6,padding:"6px 8px",color:"#FFD700",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:8,whiteSpace:"nowrap"}}>↺ RESET DEMO DATA</button>}
      </div>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:persistenceState?.status==="error"?"#FF8F8F":"#8FA09A",letterSpacing:"0.06em",marginTop:7}}>{saveText}</div>
      {persistenceState?.error&&<div style={{fontSize:9,color:"#FF9A9A",marginTop:5}}>{persistenceState.error}</div>}
    </div>
  );
}

function FlightSchoolLoginScreen({ onLogin, onBack, persistenceState, onReset, workspaceName=DEFAULT_DEMO_WORKSPACE_NAME }) {
  const secondaryButton = {
    width:"100%",background:"rgba(0,180,255,0.08)",border:"1px solid rgba(0,180,255,0.28)",borderRadius:8,padding:"12px",
    color:"#00B4FF",fontWeight:"bold",fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace",letterSpacing:"0.04em",marginTop:9
  };
  return (
    <div style={{minHeight:"100vh",background:"#050D18",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px",fontFamily:"'Inter',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Inter:wght@300;400;500;600;700&family=Bebas+Neue&display=swap');*{box-sizing:border-box;}`}</style>
      <div style={{width:"100%",maxWidth:380}}>
        <button onClick={onBack} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:7,padding:"7px 12px",color:"#8899AA",cursor:"pointer",fontSize:13,marginBottom:24}}>← BACK</button>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:"0.1em",color:"#FFFFFF",marginBottom:4}}>🏫 FLIGHT SCHOOL / CLUB LOGIN</div>
        <div style={{fontSize:11,color:"#8899AA",lineHeight:1.6,marginBottom:20}}>Independent CFIs and invited school reviewers can explore the same resettable fictional flight school. Choose the role you want to test.</div>
        <DemoDataNotice persistenceState={persistenceState} onReset={onReset}/>
        <button onClick={()=>onLogin(workspaceName,"ops")} style={{width:"100%",background:"linear-gradient(135deg,#FFD700,#FFB800)",border:"none",borderRadius:8,padding:"14px",color:"#050D18",fontWeight:"bold",fontSize:14,cursor:"pointer",fontFamily:"'DM Mono',monospace",letterSpacing:"0.05em"}}>PILOT / OPS LOGIN</button>
        <div style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#445566",letterSpacing:"0.1em",margin:"18px 0 4px"}}>SPECIALIST WORKSPACES</div>
        <button onClick={()=>onLogin(workspaceName,"admin")} style={secondaryButton}>🏛 CLUB ADMIN</button>
        <button onClick={()=>onLogin(workspaceName,"cfi")} style={secondaryButton}>🎓 INDEPENDENT CFI / TRAINING TRIAL</button>
        <button onClick={()=>onLogin(workspaceName,"engineering")} style={secondaryButton}>🔧 ENGINEERING LOGIN</button>
      </div>
    </div>
  );
}

function OpsPersonCard({ person, selected, onSelect }) {
  return (
    <button onClick={()=>onSelect(person)} style={{width:"100%",textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center",background:selected?"rgba(0,180,255,0.14)":"rgba(255,255,255,0.03)",border:`1px solid ${selected?"rgba(0,180,255,0.5)":"rgba(255,255,255,0.08)"}`,borderRadius:8,padding:"11px 14px",cursor:"pointer",marginBottom:8}}>
      <div>
        <div style={{fontSize:13,color:"#FFFFFF",fontWeight:600}}>{person.name}</div>
        <div style={{fontSize:10,color:"#8899AA",marginTop:2}}>{person.role} · {person.hrs90}hrs/90d · {person.currency}</div>
      </div>
      {selected && <div style={{color:"#00B4FF",fontSize:16}}>✓</div>}
    </button>
  );
}

function OpsAircraftCard({ ac, person, selected, onSelect }) {
  const unavailable = ac.status === "grounded" || ac.status === "maintenance";
  const unauthorised = !!person && !(person.aircraftAuth || []).includes(ac.type);
  const disabled = unavailable || unauthorised;
  const restricted = ac.status === "restricted";
  const stateText = unavailable ? (ac.status==="maintenance"?"MAINTENANCE":"GROUNDED") : restricted ? "RESTRICTED" : "SERVICEABLE";
  const stateColor = unavailable || unauthorised ? "#FF6B6B" : restricted || ac.squawk ? "#FFD700" : "#00C896";
  return (
    <button disabled={disabled} onClick={()=>!disabled && onSelect(ac)} style={{width:"100%",textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center",background:disabled?"rgba(255,59,59,0.06)":selected?"rgba(0,180,255,0.14)":"rgba(255,255,255,0.03)",border:`1px solid ${disabled?"rgba(255,59,59,0.35)":selected?"rgba(0,180,255,0.5)":"rgba(255,255,255,0.08)"}`,borderRadius:8,padding:"11px 14px",cursor:disabled?"not-allowed":"pointer",marginBottom:8,opacity:disabled?0.75:1}}>
      <div>
        <div style={{fontSize:13,color:"#FFFFFF",fontWeight:600}}>{ac.tail} <span style={{color:"#8899AA",fontWeight:400}}>· {ac.type}</span></div>
        <div style={{fontSize:10,color:stateColor,marginTop:2}}>
          {unavailable ? <>🔴 {stateText} — blocked from FRAT selection{ac.squawk?` · ${ac.squawk}`:""}</> : unauthorised ? `🔴 CFI AUTHORISATION REQUIRED — ${person.name} is not authorised for this type` : <>{restricted||ac.squawk?"🟡":"🟢"} {stateText}{ac.squawk?` — ${ac.squawk}`:" — no open defects"} · {ac.nextMaintenanceHours!=null?`${ac.nextMaintenanceHours} hrs to scheduled maintenance`:`Last 100hr: ${ac.last100}`}</>}
        </div>
      </div>
      {selected && !disabled && <div style={{color:"#00B4FF",fontSize:16}}>✓</div>}
    </button>
  );
}

function OpsDashboardScreen({ orgName, onStartBriefing, onContinueToApp, onBack, people=MOCK_OPS_PEOPLE, aircraftList=MOCK_OPS_AIRCRAFT, persistenceState, onReset }) {
  const [person, setPerson] = useState(null);
  const [aircraft, setAircraft] = useState(null);
  const eligibility = evaluateFratEligibility(person, aircraft);
  const canStart = !!person && !!aircraft && eligibility.allowed;

  function selectPerson(nextPerson) {
    setPerson(nextPerson);
    if (aircraft && !(nextPerson.aircraftAuth || []).includes(aircraft.type)) setAircraft(null);
  }

  return (
    <div style={{minHeight:"100vh",background:"#050D18",fontFamily:"'Inter',sans-serif",color:"#D0DCE8"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Inter:wght@300;400;500;600;700&family=Bebas+Neue&display=swap');*{box-sizing:border-box;margin:0;padding:0;}`}</style>
      <div style={{background:"rgba(3,10,22,0.97)",borderBottom:"1px solid rgba(255,180,0,0.2)",padding:"0 20px",display:"flex",alignItems:"center",gap:10,height:56,position:"sticky",top:0,zIndex:100}}>
        <button onClick={onBack} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:7,padding:"7px 12px",color:"#8899AA",cursor:"pointer",fontSize:14}}>← BACK</button>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:"0.1em",color:"#FFFFFF",marginLeft:6}}>🏫 {orgName || "OPS SYSTEM"} — DEMO</div>
      </div>
      <div style={{maxWidth:640,margin:"0 auto",padding:"22px 18px 60px"}}>
        <DemoDataNotice persistenceState={persistenceState} onReset={onReset} detail="This roster and fleet are fabricated examples illustrating the Academy integration."/>

        <div style={{fontSize:11,fontFamily:"'DM Mono',monospace",color:"#00B4FF",letterSpacing:"0.1em",marginBottom:10}}>SELECT PILOT</div>
        {people.map(p=><OpsPersonCard key={p.id} person={p} selected={person?.id===p.id} onSelect={selectPerson}/>)}

        <div style={{fontSize:11,fontFamily:"'DM Mono',monospace",color:"#00B4FF",letterSpacing:"0.1em",margin:"22px 0 10px"}}>SELECT AIRCRAFT</div>
        {aircraftList.map(a=><OpsAircraftCard key={a.id} ac={a} person={person} selected={aircraft?.id===a.id} onSelect={setAircraft}/>)}

        {person && !aircraft && <div style={{background:"rgba(0,180,255,0.06)",border:"1px solid rgba(0,180,255,0.2)",borderRadius:8,padding:"9px 11px",fontSize:10,color:"#8DCBEA",lineHeight:1.5}}>Only serviceable aircraft types currently authorised on {person.name}'s shared CFI record can be selected. Synthetic Engineering and CFI changes apply immediately and persist in this private demo workspace.</div>}

        {person?.trainingStatus === "noncurrent" && <div style={{background:"rgba(255,59,59,0.09)",border:"1px solid rgba(255,59,59,0.38)",borderRadius:8,padding:"10px 12px",fontSize:10.5,color:"#FF9A9A",lineHeight:1.55,marginTop:10}}><b>CFI ACTION REQUIRED — {person.clubCurrency || "training / check status is not current"}</b><br/>The FRAT remains available for structured review and will auto-fill the flight-review field as lapsed or unsure. Completing a FRAT does not authorise the flight.</div>}

        {eligibility.blockers.map(blocker=><div key={blocker.code} style={{background:"rgba(255,59,59,0.09)",border:"1px solid rgba(255,59,59,0.38)",borderRadius:8,padding:"10px 12px",fontSize:10.5,color:"#FF9A9A",lineHeight:1.55,marginTop:10}}><b>BLOCKED — {blocker.title}</b><br/>{blocker.detail}</div>)}

        <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:24}}>
          <button disabled={!canStart} onClick={()=>canStart && onStartBriefing(person,aircraft)} style={{width:"100%",background:canStart?"linear-gradient(135deg,#00B4FF,#0090DD)":"rgba(255,255,255,0.06)",border:"none",borderRadius:8,padding:"13px",color:canStart?"#050D18":"#556677",fontWeight:"bold",fontSize:13,cursor:canStart?"pointer":"not-allowed",fontFamily:"'DM Mono',monospace",letterSpacing:"0.05em"}}>
            🛡 {person?.trainingStatus === "noncurrent" && person && aircraft ? `START RISK REVIEW — CFI INTERVENTION REQUIRED (${person.name.split(" ")[0]} / ${aircraft.tail})` : `START PRE-FLIGHT RISK ASSESSMENT ${person&&aircraft?`— ${person.name.split(" ")[0]} / ${aircraft.tail}`:"(select pilot & aircraft)"}`}
          </button>
          <button onClick={onContinueToApp} style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,padding:"11px",color:"#8899AA",fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Continue to SafeRoute Academy →</button>
        </div>
      </div>
    </div>
  );
}


function DemoWorkspaceHeader({ icon, title, orgName, onBack, accent="#00B4FF" }) {
  return (
    <div style={{background:"rgba(3,10,22,0.97)",borderBottom:`1px solid ${accent}33`,padding:"0 20px",display:"flex",alignItems:"center",gap:10,height:56,position:"sticky",top:0,zIndex:100}}>
      <button onClick={onBack} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:7,padding:"7px 12px",color:"#8899AA",cursor:"pointer",fontSize:14}}>← LOG OUT</button>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:"0.1em",color:"#FFFFFF",marginLeft:6}}>{icon} {title}</div>
      <div style={{flex:1}}/>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#667788"}}>{orgName || "DEMO FLIGHT SCHOOL"} · DEMO</div>
    </div>
  );
}

function ClubAdminDashboardScreen({ orgName, people, aircraftList, users, setUsers, adminAudit, setAdminAudit, onBack, persistenceState, onReset }) {
  const [selectedId,setSelectedId] = useState(users[0]?.id || null);
  const [notice,setNotice] = useState(null);
  const selectedUser = users.find(user=>user.id===selectedId) || users[0];
  const linkedPilot = people.find(person=>person.id===selectedUser?.personId);
  const summary = buildClubAdminSummary(people,aircraftList,users);
  const roleLabels = Object.fromEntries(CLUB_ACCESS_ROLES.map(role=>[role.id,role.label]));
  const activity = [
    ...adminAudit,
    ...aircraftList.flatMap(aircraft=>(aircraft.audit||[]).map(event=>({...event,source:`Engineering · ${aircraft.tail}`}))),
  ].slice(0,8);

  function recordAdminEvent(text) {
    setAdminAudit(previous=>[{time:new Date().toLocaleString("en-GB"),source:"Club Admin",text},...previous]);
  }

  function changeRole(role) {
    const result=toggleClubUserRole(users,selectedUser.id,role);
    if(!result.changed) {
      setNotice({tone:"error",text:result.reason});
      return;
    }
    const adding=!selectedUser.roles.includes(role);
    setUsers(result.users);
    setNotice({tone:"success",text:`${roleLabels[role]} access ${adding?"granted to":"removed from"} ${selectedUser.name}.`});
    recordAdminEvent(`${roleLabels[role]} access ${adding?"granted to":"removed from"} ${selectedUser.name}`);
  }

  function changeStatus() {
    const result=toggleClubUserStatus(users,selectedUser.id);
    if(!result.changed) {
      setNotice({tone:"error",text:result.reason});
      return;
    }
    const nextStatus=selectedUser.status==="active"?"suspended":"active";
    setUsers(result.users);
    setNotice({tone:"success",text:`${selectedUser.name} marked ${nextStatus}.`});
    recordAdminEvent(`${selectedUser.name} marked ${nextStatus}`);
  }

  const statusMeta={
    current:{label:"CURRENT",color:"#00C896"},
    due:{label:"DUE SOON",color:"#FFD700"},
    noncurrent:{label:"ACTION REQUIRED",color:"#FF5B5B"},
  };

  return (
    <div style={{minHeight:"100vh",background:"#050D18",fontFamily:"'Inter',sans-serif",color:"#D0DCE8"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Inter:wght@300;400;500;600;700&family=Bebas+Neue&display=swap');*{box-sizing:border-box;}button{touch-action:manipulation;}`}</style>
      <DemoWorkspaceHeader icon="🏛" title="CLUB ADMIN" orgName={orgName} onBack={onBack} accent="#A78BFA"/>
      <div style={{maxWidth:1180,margin:"0 auto",padding:"22px 18px 60px"}}>
        <DemoDataNotice persistenceState={persistenceState} onReset={onReset} detail="Access changes persist in this private demo. Club Admin oversight remains separate from CFI and Engineering authority."/>

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:10,marginBottom:18}}>
          {[
            ["👥","Active users",summary.activeUsers,"#A78BFA"],
            ["🔴","Pilots requiring action",summary.attentionPilots,"#FF5B5B"],
            ["🟡","Checks due soon",summary.dueSoonPilots,"#FFD700"],
            ["✈","Aircraft available",summary.availableAircraft,"#00C896"],
            ["⛔","Aircraft unavailable",summary.unavailableAircraft,"#FF6B6B"],
            ["🛠","Open defects",summary.openDefects,"#00B4FF"],
          ].map(([icon,label,value,color])=><div key={label} style={{background:"rgba(255,255,255,0.035)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"14px"}}><div style={{fontSize:9,color:"#778899",fontFamily:"'DM Mono',monospace"}}>{icon} {label.toUpperCase()}</div><div style={{fontSize:27,color,fontWeight:700,marginTop:4}}>{value}</div>{label==="Aircraft available"&&summary.restrictedAircraft>0&&<div style={{fontSize:9,color:"#FFD700",marginTop:2}}>{summary.restrictedAircraft} restricted</div>}</div>)}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16,alignItems:"start",marginBottom:18}}>
          <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"14px"}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#A78BFA",letterSpacing:"0.1em",marginBottom:10}}>USERS & ACCESS</div>
            {users.map(user=>{
              const selected=user.id===selectedId;
              return <button key={user.id} onClick={()=>{setSelectedId(user.id);setNotice(null);}} style={{width:"100%",textAlign:"left",background:selected?"rgba(167,139,250,0.13)":"rgba(255,255,255,0.025)",border:`1px solid ${selected?"rgba(167,139,250,0.45)":"rgba(255,255,255,0.07)"}`,borderRadius:8,padding:"10px 11px",marginBottom:8,cursor:"pointer",color:"#FFFFFF",opacity:user.status==="suspended"?0.62:1}}>
                <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center"}}><strong style={{fontSize:11.5}}>{user.name}</strong><span style={{fontSize:8,color:user.status==="active"?"#00C896":"#FF7C7C",fontFamily:"'DM Mono',monospace"}}>{user.status.toUpperCase()}</span></div>
                <div style={{fontSize:9,color:"#778899",marginTop:4,lineHeight:1.4}}>{user.roles.map(role=>roleLabels[role]).join(" · ") || "No workspace access"}</div>
              </button>;
            })}
          </div>

          {selectedUser&&<div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"16px"}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",alignItems:"flex-start"}}>
              <div><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:"0.07em",color:"#FFFFFF"}}>{selectedUser.name}</div><div style={{fontSize:10,color:"#778899",marginTop:2}}>{selectedUser.email}</div></div>
              <button onClick={changeStatus} style={{background:selectedUser.status==="active"?"rgba(0,200,150,0.1)":"rgba(255,91,91,0.1)",border:`1px solid ${selectedUser.status==="active"?"rgba(0,200,150,0.35)":"rgba(255,91,91,0.35)"}`,color:selectedUser.status==="active"?"#00C896":"#FF7C7C",borderRadius:7,padding:"8px 10px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:9}}>{selectedUser.status==="active"?"● ACTIVE — SUSPEND ACCESS":"● SUSPENDED — RESTORE ACCESS"}</button>
            </div>

            {linkedPilot&&<div style={{marginTop:14,background:"rgba(0,180,255,0.055)",border:"1px solid rgba(0,180,255,0.15)",borderRadius:8,padding:"10px 11px",display:"flex",justifyContent:"space-between",gap:10,alignItems:"center"}}><div><div style={{fontSize:8,color:"#667788",fontFamily:"'DM Mono',monospace"}}>LINKED PILOT RECORD</div><div style={{fontSize:11,color:"#FFFFFF",marginTop:3}}>{linkedPilot.role} · {linkedPilot.hrs90} hrs / 90d</div></div><div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:statusMeta[linkedPilot.trainingStatus].color}}>{statusMeta[linkedPilot.trainingStatus].label}</div></div>}
            {!linkedPilot&&<div style={{marginTop:14,background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,padding:"10px 11px",fontSize:10,color:"#778899"}}>No pilot record is linked to this Engineering-only demo account.</div>}

            <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#A78BFA",letterSpacing:"0.1em",margin:"20px 0 9px"}}>WORKSPACE ACCESS</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:8}}>
              {CLUB_ACCESS_ROLES.map(role=>{
                const enabled=selectedUser.roles.includes(role.id);
                return <button key={role.id} onClick={()=>changeRole(role.id)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,textAlign:"left",background:enabled?"rgba(167,139,250,0.13)":"rgba(255,255,255,0.025)",border:`1px solid ${enabled?"rgba(167,139,250,0.45)":"rgba(255,255,255,0.08)"}`,borderRadius:7,padding:"9px 10px",color:enabled?"#E4DBFF":"#778899",cursor:"pointer",fontSize:10}}><span>{role.label}</span><span style={{color:enabled?"#A78BFA":"#445566"}}>{enabled?"✓":"+"}</span></button>;
              })}
            </div>
            <div style={{fontSize:9.5,color:"#778899",lineHeight:1.55,marginTop:10}}>These controls manage access only. They do not change pilot currency, aircraft authorisations, defect status or airworthiness.</div>
            {notice&&<div style={{marginTop:12,background:notice.tone==="error"?"rgba(255,91,91,0.1)":"rgba(0,200,150,0.08)",border:`1px solid ${notice.tone==="error"?"rgba(255,91,91,0.35)":"rgba(0,200,150,0.28)"}`,borderRadius:7,padding:"9px 10px",fontSize:10,color:notice.tone==="error"?"#FF9A9A":"#7CE0C0"}}>{notice.text}</div>}
          </div>}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16}}>
          <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"15px"}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#A78BFA",letterSpacing:"0.1em",marginBottom:11}}>ORGANISATION / TEST SETTINGS</div>
            {[
              ["Organisation",orgName||"Demo Flight School","#FFFFFF"],
              ["Environment","FUNCTIONAL DEMO / TEST","#FFD700"],
              ["Data storage",persistenceState?.label||"OPENING PRIVATE DEMO","#FFD700"],
              ["External invitations","DISABLED","#8899AA"],
              ["Official operational record","NO — PROTOTYPE ONLY","#FF7C7C"],
            ].map(([label,value,color])=><div key={label} style={{display:"flex",justifyContent:"space-between",gap:12,padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.055)",fontSize:10}}><span style={{color:"#778899"}}>{label}</span><strong style={{color,textAlign:"right",fontFamily:"'DM Mono',monospace",fontSize:9}}>{value}</strong></div>)}
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#667788",letterSpacing:"0.08em",margin:"15px 0 8px"}}>SAFETY POLICIES — LOCKED FOR TESTING</div>
            {["Serviceable aircraft required","Pilot type authorisation required","Current training record required"].map(policy=><div key={policy} style={{fontSize:10,color:"#A9C8BE",marginTop:6}}>🔒 <span style={{color:"#00C896"}}>ENFORCED</span> · {policy}</div>)}
          </div>

          <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"15px"}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#A78BFA",letterSpacing:"0.1em",marginBottom:11}}>RECENT PROTOTYPE ACTIVITY</div>
            {activity.map((event,index)=><div key={`${event.time}-${index}`} style={{padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.055)"}}><div style={{display:"flex",justifyContent:"space-between",gap:8,fontFamily:"'DM Mono',monospace",fontSize:8,color:"#556677"}}><span>{event.source}</span><span>{event.time}</span></div><div style={{fontSize:10.5,color:"#AAB8C6",marginTop:4,lineHeight:1.45}}>{event.text}</div></div>)}
            <div style={{fontSize:9.5,color:"#667788",lineHeight:1.55,marginTop:11}}>Read-only oversight view. A production beta would use immutable, identity-linked audit records.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EngineeringDashboardScreen({ orgName, aircraftList, setAircraftList, onBack, persistenceState, onReset }) {
  const [selectedId,setSelectedId] = useState(aircraftList[0]?.id || null);
  const [newDefect,setNewDefect] = useState("");
  const aircraft = aircraftList.find(a=>a.id===selectedId) || aircraftList[0];

  function mutateAircraft(fn, auditText) {
    setAircraftList(prev=>prev.map(ac=>{
      if(ac.id!==selectedId) return ac;
      const next=fn(ac);
      return {...next,audit:[{time:new Date().toLocaleString("en-GB",{dateStyle:"medium",timeStyle:"short"}),text:auditText},...(ac.audit||[])]};
    }));
  }

  function changeState(status) {
    const labels={airworthy:"SERVICEABLE",restricted:"RESTRICTED",maintenance:"MAINTENANCE",grounded:"UNSERVICEABLE"};
    mutateAircraft(ac=>({...ac,status}),`Aircraft state changed to ${labels[status]}`);
  }

  function addDefect() {
    const text=newDefect.trim();
    if(!text) return;
    mutateAircraft(ac=>{
      const defects=[...(ac.defects||[]),{id:`DEF-${String(48+(ac.defects?.length||0)).padStart(4,"0")}`,text,status:"Reported",restriction:"Under engineering assessment"}];
      return {...ac,defects,squawk:ac.squawk||text};
    },`New defect reported: ${text}`);
    setNewDefect("");
  }

  function closeDefect(id) {
    mutateAircraft(ac=>{
      const defects=(ac.defects||[]).map(d=>d.id===id?{...d,status:"Closed"}:d);
      const open=defects.find(d=>d.status!=="Closed");
      return {...ac,defects,squawk:open?.text||null};
    },`${id} closed after engineering action`);
  }

  function recordInspection() {
    mutateAircraft(ac=>({...ac,last100:"Today",nextMaintenanceHours:100,maintenanceHistory:[`100-hour inspection completed ${new Date().toLocaleDateString("en-GB")}`,...(ac.maintenanceHistory||[])]}),"100-hour inspection recorded complete");
  }

  const counts={
    serviceable:aircraftList.filter(a=>a.status==="airworthy").length,
    restricted:aircraftList.filter(a=>a.status==="restricted").length,
    unavailable:aircraftList.filter(a=>a.status==="grounded"||a.status==="maintenance").length,
    defects:aircraftList.reduce((n,a)=>n+(a.defects||[]).filter(d=>d.status!=="Closed").length,0)
  };
  const stateMeta={
    airworthy:{label:"SERVICEABLE",color:"#00C896",icon:"🟢"},
    restricted:{label:"SERVICEABLE WITH RESTRICTIONS",color:"#FFD700",icon:"🟡"},
    maintenance:{label:"MAINTENANCE",color:"#FF8C42",icon:"🟠"},
    grounded:{label:"UNSERVICEABLE / GROUNDED",color:"#FF5B5B",icon:"🔴"},
  };

  return (
    <div style={{minHeight:"100vh",background:"#050D18",fontFamily:"'Inter',sans-serif",color:"#D0DCE8"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Inter:wght@300;400;500;600;700&family=Bebas+Neue&display=swap');*{box-sizing:border-box;}button{touch-action:manipulation;}`}</style>
      <DemoWorkspaceHeader icon="🔧" title="ENGINEERING" orgName={orgName} onBack={onBack} accent="#FF8C42"/>
      <div style={{maxWidth:1180,margin:"0 auto",padding:"22px 18px 60px"}}>
        <DemoDataNotice persistenceState={persistenceState} onReset={onReset} detail="Fictional fleet changes persist and update the Pilot / Ops view so the workflow can be tested end-to-end."/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginBottom:18}}>
          {[
            ["🟢","Serviceable",counts.serviceable,"#00C896"],
            ["🟡","Restricted",counts.restricted,"#FFD700"],
            ["🔴","Unavailable",counts.unavailable,"#FF5B5B"],
            ["🛠","Open defects",counts.defects,"#00B4FF"],
          ].map(([icon,label,value,color])=><div key={label} style={{background:"rgba(255,255,255,0.035)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"14px"}}><div style={{fontSize:10,color:"#778899",fontFamily:"'DM Mono',monospace"}}>{icon} {label.toUpperCase()}</div><div style={{fontSize:28,color,fontWeight:700,marginTop:4}}>{value}</div></div>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"minmax(250px,0.8fr) minmax(0,2fr)",gap:16,alignItems:"start"}}>
          <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"14px"}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#FF8C42",letterSpacing:"0.1em",marginBottom:10}}>FLEET</div>
            {aircraftList.map(ac=>{
              const meta=stateMeta[ac.status]||stateMeta.airworthy;
              return <button key={ac.id} onClick={()=>setSelectedId(ac.id)} style={{width:"100%",textAlign:"left",background:selectedId===ac.id?"rgba(255,140,66,0.12)":"rgba(255,255,255,0.025)",border:`1px solid ${selectedId===ac.id?"rgba(255,140,66,0.42)":"rgba(255,255,255,0.07)"}`,borderRadius:8,padding:"11px",marginBottom:8,cursor:"pointer",color:"#FFFFFF"}}>
                <div style={{display:"flex",justifyContent:"space-between",gap:8}}><strong>{ac.tail}</strong><span style={{color:meta.color,fontSize:10}}>{meta.icon} {meta.label}</span></div>
                <div style={{fontSize:10,color:"#778899",marginTop:3}}>{ac.type} · {ac.nextMaintenanceHours} hrs to maint.</div>
              </button>;
            })}
          </div>
          {aircraft && <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"16px"}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",alignItems:"flex-start"}}>
              <div><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:30,letterSpacing:"0.08em",color:"#FFFFFF"}}>{aircraft.tail}</div><div style={{fontSize:12,color:"#8899AA"}}>{aircraft.type} · {aircraft.airframeHours?.toLocaleString()} airframe hrs</div></div>
              <div style={{background:`${stateMeta[aircraft.status].color}16`,border:`1px solid ${stateMeta[aircraft.status].color}55`,borderRadius:8,padding:"9px 12px",fontFamily:"'DM Mono',monospace",fontSize:10,color:stateMeta[aircraft.status].color}}>{stateMeta[aircraft.status].icon} {stateMeta[aircraft.status].label}</div>
            </div>

            <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#667788",letterSpacing:"0.1em",margin:"22px 0 8px"}}>UPDATE AIRCRAFT STATE</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
              {[["airworthy","🟢 SERVICEABLE"],["restricted","🟡 RESTRICTED"],["maintenance","🟠 MAINTENANCE"],["grounded","🔴 UNSERVICEABLE"]].map(([id,label])=><button key={id} onClick={()=>changeState(id)} style={{background:aircraft.status===id?"rgba(0,180,255,0.14)":"rgba(255,255,255,0.04)",border:`1px solid ${aircraft.status===id?"rgba(0,180,255,0.45)":"rgba(255,255,255,0.1)"}`,borderRadius:6,padding:"8px 10px",color:"#D0DCE8",cursor:"pointer",fontSize:10,fontFamily:"'DM Mono',monospace"}}>{label}</button>)}
            </div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:9,marginTop:18}}>
              <div style={{background:"rgba(0,180,255,0.06)",border:"1px solid rgba(0,180,255,0.15)",borderRadius:8,padding:"11px"}}><div style={{fontSize:9,color:"#667788"}}>NEXT SCHEDULED MAINT.</div><div style={{fontSize:18,color:aircraft.nextMaintenanceHours<10?"#FFD700":"#FFFFFF",marginTop:3}}>{aircraft.nextMaintenanceHours} hrs</div></div>
              <div style={{background:"rgba(0,180,255,0.06)",border:"1px solid rgba(0,180,255,0.15)",borderRadius:8,padding:"11px"}}><div style={{fontSize:9,color:"#667788"}}>ANNUAL / INSPECTION DUE</div><div style={{fontSize:15,color:"#FFFFFF",marginTop:5}}>{aircraft.annualDue}</div></div>
              <div style={{background:"rgba(0,180,255,0.06)",border:"1px solid rgba(0,180,255,0.15)",borderRadius:8,padding:"11px"}}><div style={{fontSize:9,color:"#667788"}}>LAST 100-HOUR</div><div style={{fontSize:15,color:"#FFFFFF",marginTop:5}}>{aircraft.last100}</div></div>
            </div>

            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"22px 0 8px"}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#FF8C42",letterSpacing:"0.1em"}}>DEFECTS / WORK IN PROGRESS</div>
            </div>
            {(aircraft.defects||[]).length===0 && <div style={{fontSize:11,color:"#00C896",padding:"10px 0"}}>✓ No recorded defects</div>}
            {(aircraft.defects||[]).map(d=><div key={d.id} style={{background:"rgba(255,255,255,0.035)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"10px 11px",marginBottom:7}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:8}}><div><strong style={{fontSize:11,color:"#FFFFFF"}}>{d.id}</strong><div style={{fontSize:11,color:"#C5D0DC",marginTop:3}}>{d.text}</div><div style={{fontSize:9,color:"#8899AA",marginTop:3}}>{d.status} · {d.restriction}</div></div>{d.status!=="Closed"&&<button onClick={()=>closeDefect(d.id)} style={{alignSelf:"center",background:"rgba(0,200,150,0.1)",border:"1px solid rgba(0,200,150,0.3)",color:"#00C896",borderRadius:6,padding:"6px 8px",cursor:"pointer",fontSize:9}}>CLOSE</button>}</div>
            </div>)}
            <div style={{display:"flex",gap:7,marginTop:9}}>
              <input value={newDefect} onChange={e=>setNewDefect(e.target.value)} placeholder="Enter new defect / discrepancy..." style={{flex:1,minWidth:0,background:"#071321",border:"1px solid rgba(255,255,255,0.12)",borderRadius:7,padding:"9px 10px",color:"#FFFFFF",outline:"none"}}/>
              <button onClick={addDefect} style={{background:"rgba(255,140,66,0.14)",border:"1px solid rgba(255,140,66,0.4)",color:"#FFAA65",borderRadius:7,padding:"9px 11px",cursor:"pointer",fontWeight:700}}>ADD</button>
            </div>

            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:18}}>
              <button onClick={recordInspection} style={{background:"rgba(0,180,255,0.12)",border:"1px solid rgba(0,180,255,0.35)",color:"#00B4FF",borderRadius:7,padding:"9px 11px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:10}}>RECORD 100-HOUR COMPLETE</button>
              <button onClick={()=>changeState("airworthy")} style={{background:"rgba(0,200,150,0.12)",border:"1px solid rgba(0,200,150,0.35)",color:"#00C896",borderRadius:7,padding:"9px 11px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:10}}>RETURN TO SERVICE</button>
            </div>

            <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#667788",letterSpacing:"0.1em",margin:"22px 0 8px"}}>AUDIT TRAIL</div>
            {(aircraft.audit||[]).slice(0,5).map((a,i)=><div key={i} style={{fontSize:10,color:"#9AA8B7",padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,0.05)"}}><span style={{color:"#556677"}}>{a.time}</span> · {a.text}</div>)}
          </div>}
        </div>
      </div>
    </div>
  );
}

function CfiDashboardScreen({ orgName, people, setPeople, aircraftList, onBack, persistenceState, onReset }) {
  const [selectedId,setSelectedId] = useState(people[0]?.id || null);
  const person=people.find(p=>p.id===selectedId) || people[0];
  const types=[...new Set(aircraftList.map(a=>a.type))];
  const statusMeta={
    current:{label:"CURRENT",color:"#00C896",icon:"🟢"},
    due:{label:"DUE SOON",color:"#FFD700",icon:"🟡"},
    noncurrent:{label:"ACTION REQUIRED",color:"#FF5B5B",icon:"🔴"},
  };
  const counts={
    current:people.filter(p=>p.trainingStatus==="current").length,
    due:people.filter(p=>p.trainingStatus==="due").length,
    noncurrent:people.filter(p=>p.trainingStatus==="noncurrent").length,
    signoff:people.filter(p=>p.pendingSignoff).length,
  };
  function updatePerson(patch){
    setPeople(prev=>prev.map(p=>p.id===selectedId?{...p,...patch}:p));
  }
  function completeCheck(){
    updatePerson({trainingStatus:"current",pendingSignoff:false,clubCurrency:"Current",lastCheck:new Date().toLocaleDateString("en-GB"),nextCheck:"06 Apr 2027"});
  }
  function toggleAuth(type){
    const has=(person.aircraftAuth||[]).includes(type);
    updatePerson({aircraftAuth:has?(person.aircraftAuth||[]).filter(x=>x!==type):[...(person.aircraftAuth||[]),type]});
  }
  return (
    <div style={{minHeight:"100vh",background:"#050D18",fontFamily:"'Inter',sans-serif",color:"#D0DCE8"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Inter:wght@300;400;500;600;700&family=Bebas+Neue&display=swap');*{box-sizing:border-box;}button{touch-action:manipulation;}`}</style>
      <DemoWorkspaceHeader icon="🎓" title="CFI / TRAINING" orgName={orgName} onBack={onBack} accent="#00B4FF"/>
      <div style={{maxWidth:1180,margin:"0 auto",padding:"22px 18px 60px"}}>
        <DemoDataNotice persistenceState={persistenceState} onReset={onReset} detail="Fictional CFI changes persist and update the pilot record used by the Pilot / Ops workspace."/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginBottom:18}}>
          {[
            ["🟢","Current",counts.current,"#00C896",false],
            ["🟡","Due soon",counts.due,"#FFD700",false],
            ["🔴","Action required",counts.noncurrent,"#FF5B5B",true],
            ["🔵","Awaiting sign-off",counts.signoff,"#00B4FF",false],
          ].map(([icon,label,value,color,urgent])=><div key={label} style={{background:urgent?"rgba(255,91,91,0.12)":"rgba(255,255,255,0.035)",border:`1px solid ${urgent?"rgba(255,91,91,0.5)":"rgba(255,255,255,0.08)"}`,borderRadius:10,padding:"14px",boxShadow:urgent&&value>0?"0 0 0 1px rgba(255,91,91,0.08), 0 0 18px rgba(255,91,91,0.08)":"none"}}><div style={{fontSize:10,color:urgent?"#FF7C7C":"#778899",fontFamily:"'DM Mono',monospace",fontWeight:urgent?700:400}}>{icon} {label.toUpperCase()}</div><div style={{fontSize:28,color,fontWeight:700,marginTop:4}}>{value}</div></div>)}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"minmax(250px,0.8fr) minmax(0,2fr)",gap:16,alignItems:"start"}}>
          <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"14px"}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#00B4FF",letterSpacing:"0.1em",marginBottom:10}}>PILOTS REQUIRING ATTENTION</div>
            {people.map(p=>{
              const meta=statusMeta[p.trainingStatus]||statusMeta.current;
              const urgent=p.trainingStatus==="noncurrent";
              const selected=selectedId===p.id;
              return <button key={p.id} onClick={()=>setSelectedId(p.id)} style={{width:"100%",textAlign:"left",background:urgent?(selected?"rgba(255,91,91,0.19)":"rgba(255,91,91,0.10)"):(selected?"rgba(0,180,255,0.12)":"rgba(255,255,255,0.025)"),border:`1px solid ${urgent?"rgba(255,91,91,0.55)":selected?"rgba(0,180,255,0.42)":"rgba(255,255,255,0.07)"}`,borderRadius:8,padding:"11px",marginBottom:8,cursor:"pointer",color:"#FFFFFF",boxShadow:urgent?"inset 3px 0 0 #FF5B5B":"none"}}>
                <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center"}}><strong>{p.name}</strong><span style={{color:meta.color,fontSize:10,fontWeight:urgent?800:500,background:urgent?"rgba(255,91,91,0.14)":"transparent",border:urgent?"1px solid rgba(255,91,91,0.45)":"1px solid transparent",borderRadius:5,padding:urgent?"4px 6px":"0"}}>{meta.icon} {meta.label}</span></div>
                <div style={{fontSize:10,color:urgent?"#FF9A9A":"#778899",marginTop:3}}>{p.role} · {p.hrs90} hrs / 90d{urgent?` · ${p.clubCurrency}`:""}</div>
              </button>;
            })}
          </div>

          {person && <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"16px"}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
              <div><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:29,letterSpacing:"0.07em",color:"#FFFFFF"}}>{person.name}</div><div style={{fontSize:12,color:"#8899AA"}}>{person.role}</div></div>
              <div style={{background:person.trainingStatus==="noncurrent"?"rgba(255,91,91,0.16)":`${statusMeta[person.trainingStatus].color}16`,border:`1px solid ${person.trainingStatus==="noncurrent"?"rgba(255,91,91,0.6)":statusMeta[person.trainingStatus].color+"55"}`,borderRadius:8,padding:"9px 12px",fontFamily:"'DM Mono',monospace",fontSize:10,color:statusMeta[person.trainingStatus].color,fontWeight:person.trainingStatus==="noncurrent"?800:500,boxShadow:person.trainingStatus==="noncurrent"?"0 0 16px rgba(255,91,91,0.1)":"none"}}>{statusMeta[person.trainingStatus].icon} {statusMeta[person.trainingStatus].label}</div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:9,marginTop:18}}>
              {[["90-DAY HOURS",person.hrs90],["LAST FLIGHT",person.lastFlight],["CLUB CURRENCY",person.clubCurrency],["NEXT CHECK",person.nextCheck],["MEDICAL",person.medical],["LAST CHECK",person.lastCheck]].map(([label,value])=>{
                const text=String(value??"").toLowerCase();
                const isCritical =
                  (label==="CLUB CURRENCY" && (text.includes("expired") || text.includes("non-current") || text.includes("not current"))) ||
                  (label==="NEXT CHECK" && text.includes("overdue")) ||
                  (label==="MEDICAL" && (text.includes("expired") || text.includes("not current")));
                const isWarning = !isCritical && (
                  (label==="CLUB CURRENCY" && (text.includes("due") || text.includes("expires in") || text.includes("expiring"))) ||
                  (label==="NEXT CHECK" && (text.includes("due") || text.includes("soon"))) ||
                  (label==="MEDICAL" && (text.includes("expires in") || text.includes("expiring")))
                );
                return <div key={label} style={{background:isCritical?"rgba(255,91,91,0.14)":isWarning?"rgba(255,215,0,0.10)":"rgba(0,180,255,0.055)",border:`1px solid ${isCritical?"rgba(255,91,91,0.58)":isWarning?"rgba(255,215,0,0.42)":"rgba(0,180,255,0.14)"}`,borderRadius:8,padding:"10px",boxShadow:isCritical?"inset 3px 0 0 #FF5B5B":"none"}}>
                  <div style={{fontSize:8,color:isCritical?"#FF8F8F":isWarning?"#FFD75A":"#667788",fontFamily:"'DM Mono',monospace",fontWeight:(isCritical||isWarning)?700:400}}>{label}</div>
                  <div style={{fontSize:12,color:isCritical?"#FFB0B0":isWarning?"#FFE38A":"#FFFFFF",marginTop:4,lineHeight:1.35,fontWeight:isCritical?700:400}}>{isCritical?"🔴 ":isWarning?"🟡 ":""}{value}</div>
                </div>;
              })}
            </div>

            <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#00B4FF",letterSpacing:"0.1em",margin:"22px 0 8px"}}>AIRCRAFT AUTHORISATIONS</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
              {types.map(type=>{
                const authorised=(person.aircraftAuth||[]).includes(type);
                return <button key={type} onClick={()=>toggleAuth(type)} style={{background:authorised?"rgba(0,200,150,0.11)":"rgba(255,255,255,0.035)",border:`1px solid ${authorised?"rgba(0,200,150,0.35)":"rgba(255,255,255,0.1)"}`,borderRadius:7,padding:"8px 10px",color:authorised?"#00C896":"#778899",cursor:"pointer",fontSize:10}}>{authorised?"✓ ":""}{type}</button>;
              })}
            </div>

            <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#00B4FF",letterSpacing:"0.1em",margin:"22px 0 8px"}}>CFI ACTIONS</div>
            {person.pendingSignoff && <div style={{background:"rgba(0,180,255,0.08)",border:"1px solid rgba(0,180,255,0.25)",borderRadius:8,padding:"10px 12px",fontSize:10.5,color:"#7DD8FF",marginBottom:10}}>🔵 A completed training item is awaiting CFI sign-off.</div>}
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <button onClick={completeCheck} style={{background:"rgba(0,200,150,0.12)",border:"1px solid rgba(0,200,150,0.35)",color:"#00C896",borderRadius:7,padding:"9px 11px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:10}}>✓ RECORD CHECK / SIGN OFF</button>
              <button onClick={()=>updatePerson({trainingStatus:"due",clubCurrency:"Check due soon"})} style={{background:"rgba(255,215,0,0.1)",border:"1px solid rgba(255,215,0,0.3)",color:"#FFD700",borderRadius:7,padding:"9px 11px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:10}}>MARK DUE SOON</button>
              <button onClick={()=>updatePerson({trainingStatus:"noncurrent",clubCurrency:"Expired — instructor check required"})} style={{background:"rgba(255,91,91,0.1)",border:"1px solid rgba(255,91,91,0.3)",color:"#FF7C7C",borderRadius:7,padding:"9px 11px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:10}}>REQUIRE TRAINING</button>
            </div>
            <div style={{marginTop:18,padding:"11px 12px",background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,fontSize:10,color:"#8899AA",lineHeight:1.55}}>These actions are saved to synthetic demo records only. Step 4 will add identity-linked permission enforcement; Step 5 will add the immutable operational audit trail.</div>
          </div>}
        </div>
      </div>
    </div>
  );
}

function WelcomeScreen({ onSelect }) {
  const count = region => Object.values(AIRFIELDS).filter(airfield => airfield.region === region).length;
  const options = [
    { id:"florida", label:"FLORIDA", icon:"🌴", desc:`${count("florida")} training airfields across Florida — Class B/C/D operations, thunderstorm patterns, bird strike corridors, skydiving fields, Tampa Bay.` },
    { id:"phoenix", label:"PHOENIX / ARIZONA", icon:"☀", desc:`${count("phoenix")} training airfields across the Phoenix area and Arizona — density altitude, haboobs, high terrain, military airspace.` },
    { id:"texas", label:"TEXAS", icon:"🤠", desc:`${count("texas")} training airfields across Fort Worth, Austin, and Houston — Class B/C/D operations, severe thunderstorms, military jet traffic, Gulf Coast fog.` },
    { id:"socal", label:"SOUTHERN CALIFORNIA", icon:"🏙", desc:`${count("socal")} training airfields across the LA Basin and San Diego County — extremely dense multi-airport Class B/C/D stacking, marine layer fog, and terrain transitions from sea level to 6,752ft.` },
    { id:"colorado", label:"COLORADO / FRONT RANGE", icon:"⛰", desc:`${count("colorado")} training airfields along the Front Range corridor — genuine high-altitude performance planning, mountain wave turbulence, and terrain awareness, every field at 4,600ft+ MSL.` },
    { id:"uk", label:"UNITED KINGDOM", icon:"🇬🇧", desc:`${count("uk")} training airfields across the UK — Class D/G operations, cloud base & icing, coastal weather, live radar.` },
  ];
  return (
    <div style={{minHeight:"100vh",background:"#050D18",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px",fontFamily:"'Inter',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Inter:wght@300;400;500;600;700&family=Bebas+Neue&display=swap');*{box-sizing:border-box;}`}</style>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
        <div style={{width:34,height:34,background:"linear-gradient(135deg,#0055DD,#00B4FF)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17}}>✈</div>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:30,letterSpacing:"0.15em",color:"#FFFFFF"}}>SAFEROUTE <span style={{color:"#00B4FF"}}>ACADEMY</span></div>
      </div>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#556677",letterSpacing:"0.15em",marginBottom:40}}>STUDENT PILOT SAFETY INTELLIGENCE</div>
      <div style={{fontSize:12,fontFamily:"'DM Mono',monospace",color:"#8899AA",letterSpacing:"0.12em",marginBottom:18}}>WHERE ARE YOU TRAINING?</div>
      <div style={{display:"flex",gap:16,flexWrap:"wrap",justifyContent:"center",maxWidth:900}}>
        {options.map(o=>(
          <button key={o.id} onClick={()=>onSelect(o.id)} style={{width:260,textAlign:"left",background:"rgba(0,180,255,0.06)",border:"1px solid rgba(0,180,255,0.25)",borderRadius:12,padding:"22px 20px",cursor:"pointer",transition:"all 0.15s"}}
            onMouseEnter={e=>{e.currentTarget.style.background="rgba(0,180,255,0.14)";e.currentTarget.style.borderColor="rgba(0,180,255,0.5)";}}
            onMouseLeave={e=>{e.currentTarget.style.background="rgba(0,180,255,0.06)";e.currentTarget.style.borderColor="rgba(0,180,255,0.25)";}}>
            <div style={{fontSize:28,marginBottom:10}}>{o.icon}</div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:14,color:"#00B4FF",fontWeight:"bold",letterSpacing:"0.08em",marginBottom:8}}>{o.label}</div>
            <div style={{fontSize:12,color:"#8899AA",lineHeight:1.6}}>{o.desc}</div>
          </button>
        ))}
      </div>
      <div style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#334455",marginTop:36,letterSpacing:"0.1em"}}>YOU CAN SWITCH LOCATIONS ANY TIME FROM THE APP</div>
    </div>
  );
}

// ── Flight Risk Assessment Tool (FRAT) ───────────────────────────────────
// Structured around the FAA Safety Team's PAVE checklist (Pilot, Aircraft,
// enVironment, External pressures) — the same framework the FAA's own FRAT
// follows (faa.gov/general/flight-risk-assessment-tool-frat-faa-safety-team;
// FAA-H-8083-2 Risk Management Handbook). The FAA's own tool is an
// interactive worksheet without a published fixed point scale, so the
// specific questions and scoring below are the Academy's own — built using
// widely-recognized, standard risk factors within the real PAVE structure,
// not a reproduction of any single official worksheet. CFIs/students should
// treat the thresholds as a starting point, adjustable to their own or their
// instructor's standard.

const FRAT_SECTIONS = [
  {
    id: "pilot", title: "PILOT", icon: "🧑‍✈️", color: "#00B4FF",
    questions: [
      { q: "Flight time in the last 90 days", options: [
        ["More than 20 hours", 0], ["10–20 hours", 1], ["3–10 hours", 2], ["Less than 3 hours", 3],
      ], mitigations: ["Fly with a CFI or suitably qualified instructor", "Complete a dual proficiency flight before the planned flight", "Simplify the route, conditions, or mission to match current experience"]},
      { q: "Hours of sleep last night", options: [
        ["8+ hours", 0], ["6–8 hours", 1], ["4–6 hours", 2], ["Less than 4 hours", 3],
      ], mitigations: ["Delay departure and obtain adequate rest", "Reschedule or cancel the flight", "Remove the deadline and reassess fitness later"]},
      { q: "Time since your last flight", options: [
        ["Within 7 days", 0], ["7–14 days", 1], ["15–30 days", 2], ["More than 30 days", 3],
      ], mitigations: ["Complete a proficiency flight with a CFI", "Conduct refresher training and pattern practice first", "Use a simpler aircraft, route, or set of conditions"]},
      { q: "Honest IMSAFE self-check", options: [
        ["Fit and well", 0], ["Minor stress or tiredness", 1], ["Notable stress, illness, or medication", 2], ["Would not fly if fully honest with myself", 3],
      ], mitigations: ["Delay or cancel until genuinely fit to fly", "Seek appropriate aeromedical advice about illness or medication", "Remove the external pressure and reassess fitness honestly"]},
      { q: "Flight review / dual instruction currency", options: [
        ["Current, recent dual within 90 days", 0], ["Current, no recent dual", 1], ["Approaching currency limits", 2], ["Lapsed or unsure", 3],
      ], mitigations: ["Confirm records and applicable currency requirements", "Complete the required review or dual instruction", "Fly with a CFI only under appropriate and lawful conditions"]},
    ],
  },
  {
    id: "aircraft", title: "AIRCRAFT", icon: "✈", color: "#00C896",
    questions: [
      { q: "Familiarity with this specific aircraft", options: [
        ["Very familiar, fly it regularly", 0], ["Familiar", 1], ["Limited recent experience", 2], ["New to me or rarely flown", 3],
      ], mitigations: ["Choose an aircraft you know well", "Complete an aircraft checkout or dual familiarisation", "Simplify the flight while building type familiarity"]},
      { q: "Known squawks / inoperative equipment", options: [
        ["None", 0], ["Minor, doesn't affect this flight", 1], ["Some, relevant to this flight", 2], ["Significant — affects safety margins", 3],
      ], mitigations: ["Have the defect corrected and the aircraft returned to service", "Select a different airworthy aircraft", "Confirm any deferral and operational effect with authorised maintenance or the operator"], nonReducingMitigations: ["Confirm any deferral and operational effect with authorised maintenance or the operator"]},
      { q: "Performance margin at departure/destination", link:{label:"→ Check current density altitude", action:"da"}, options: [
        ["Comfortable margin", 0], ["Adequate", 1], ["Tight", 2], ["Marginal or not yet checked", 3],
      ], mitigations: ["Reduce weight or load within legal and safe limits", "Depart in cooler conditions", "Use a longer runway or more suitable airport", "Recalculate using the current POH/AFM data before deciding"]},
      { q: "Fuel reserve planning", options: [
        ["Beyond legal minimums", 0], ["Standard reserves", 1], ["Minimum legal reserves", 2], ["Tight, little margin", 3],
      ], mitigations: ["Add fuel or plan an earlier fuel stop", "Shorten or change the route", "Delay until adequate fuel and reserves are assured"]},
    ],
  },
  {
    id: "environment", title: "ENVIRONMENT", icon: "🌦", color: "#FFD700",
    questions: [
      { q: "Weather relative to your personal minimums", options: [
        ["Well above", 0], ["Above", 1], ["Close to minimums", 2], ["At or below", 3],
      ], mitigations: ["Delay for forecast improvement", "Change the route or destination", "Cancel rather than exceed personal minimums", "Review the plan with a CFI or appropriately qualified pilot"], nonReducingMitigations: ["Review the plan with a CFI or appropriately qualified pilot"]},
      { q: "Forecast crosswind component", options: [
        ["Well within comfort", 0], ["Within limits", 1], ["Near personal limit", 2], ["At or near aircraft limit", 3],
      ], mitigations: ["Use a more favourable runway or alternate airport", "Delay for lower wind", "Take dual instruction within safe and applicable limits"]},
      { q: "Airport familiarity", options: [
        ["Home base / very familiar", 0], ["Visited before", 1], ["New, but towered/well-served", 2], ["New, non-towered or complex", 3],
      ], mitigations: ["Complete a detailed briefing using current airport information", "Fly with an instructor or pilot familiar with the airport", "Choose a simpler or familiar alternate airport"]},
      { q: "Terrain and airspace complexity", options: [
        ["Simple, flat, familiar", 0], ["Some complexity", 1], ["Significant terrain or airspace", 2], ["High terrain and complex/unfamiliar airspace", 3],
      ], mitigations: ["Reroute to avoid the most complex terrain or airspace", "Operate in daylight and improved conditions", "Brief with a CFI or pilot with relevant local experience", "Choose a more suitable airport or route"], nonReducingMitigations: ["Brief with a CFI or pilot with relevant local experience"]},
      { q: "Timing", options: [
        ["Day, VMC throughout", 0], ["Some night or marginal VMC", 1], ["Night or IMC portions", 2], ["Night and weather concerns combined", 3],
      ], mitigations: ["Delay for daylight or better weather", "Reroute to avoid combined night and weather exposure", "Review or conduct the flight with an appropriately qualified instructor"], nonReducingMitigations: ["Review or conduct the flight with an appropriately qualified instructor"]},
    ],
  },
  {
    id: "external", title: "EXTERNAL PRESSURES", icon: "⏳", color: "#FF8C42",
    questions: [
      { q: "Schedule flexibility", options: [
        ["Fully flexible — can delay or cancel freely", 0], ["Some flexibility", 1], ["Limited flexibility", 2], ["Must complete as planned", 3],
      ], mitigations: ["Set firm delay and cancellation criteria before departure", "Remove or reschedule the deadline", "Use alternative transportation"]},
      { q: "Passengers or others expecting this flight", options: [
        ["None, or very understanding", 0], ["Some expectation", 1], ["Firm expectation", 2], ["High-stakes event (wedding, work, etc.)", 3],
      ], mitigations: ["Explain the no-go criteria and set expectations now", "Arrange alternative transportation", "Remove the passenger or event pressure from the flight decision"]},
      { q: "Financial pressure (rental cost, deposits, etc.)", options: [
        ["None", 0], ["Minor", 1], ["Moderate", 2], ["Significant", 3],
      ], mitigations: ["Treat fees or deposits as a sunk cost", "Confirm cancellation or rebooking options", "Set aside a contingency so cost cannot drive the decision"]},
      { q: "Alternative transportation if you don't fly", options: [
        ["Yes, easy", 0], ["Yes, with some effort", 1], ["Difficult", 2], ["None", 3],
      ], mitigations: ["Arrange ground or commercial transportation", "Arrange lodging and reschedule", "Create a realistic non-flying fallback before departure"]},
    ],
  },
];

const FRAT_MAX = FRAT_SECTIONS.reduce((sum, s) => sum + s.questions.length * 3, 0);
const FRAT_MATERIAL_SCORE = 2;
const FRAT_QUESTION_ENTRIES = FRAT_SECTIONS.flatMap(section =>
  section.questions.map((question, index) => ({
    key: `${section.id}_${index}`,
    section,
    question,
  }))
);

function fratRiskLevel(score) {
  const pct = score / FRAT_MAX;
  if (pct <= 0.33) return { level: "GREEN", color: "#00C896", label: "Lower accumulated risk",
    review: "Complete the normal PIC / CFI review",
    detail: "The combined score is in the lower range, but it is not a clearance to fly. Review the highest individual factors, current conditions, and any limits that a simple score cannot capture." };
  if (pct <= 0.59) return { level: "YELLOW", color: "#FFD700", label: "Further review recommended",
    review: "Resolve or review the remaining material factors",
    detail: "Material risk remains. Work through the highest-scoring factors, apply specific controls where they genuinely change the situation, and involve a CFI or operator when appropriate before making the flight decision." };
  return { level: "RED", color: "#FF3B3B", label: "Further review strongly recommended",
    review: "Do not let schedule or cost pressure drive the decision",
    detail: "The assessment still contains substantial accumulated risk. Delay, cancel, or obtain appropriate CFI / operator review unless effective controls genuinely change the conditions; the score itself never authorises the flight." };
}

function fratAnswerLabel(question, value) {
  return question.options.find(([, points]) => points === value)?.[0] || "Not answered";
}

function FRATFlow({ stage }) {
  const steps = [
    ["assessment", "1", "INITIAL RISK"],
    ["controls", "2", "RISK CONTROLS"],
    ["review", "3", "RESIDUAL RISK"],
  ];
  const activeIndex = steps.findIndex(([id]) => id === stage);
  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:7,marginBottom:18}}>
      {steps.map(([id, number, label], index) => {
        const active = id === stage;
        const complete = index < activeIndex;
        return (
          <div key={id} style={{display:"flex",alignItems:"center",gap:7,padding:"8px 9px",borderRadius:7,background:active?"rgba(0,180,255,0.13)":complete?"rgba(0,200,150,0.08)":"rgba(255,255,255,0.03)",border:`1px solid ${active?"rgba(0,180,255,0.45)":complete?"rgba(0,200,150,0.25)":"rgba(255,255,255,0.08)"}`}}>
            <span style={{width:20,height:20,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontFamily:"'DM Mono',monospace",fontSize:9,fontWeight:"bold",color:active?"#050D18":complete?"#00C896":"#667788",background:active?"#00B4FF":complete?"rgba(0,200,150,0.12)":"rgba(255,255,255,0.05)"}}>{complete?"✓":number}</span>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:8,letterSpacing:"0.06em",color:active?"#FFFFFF":complete?"#00C896":"#667788"}}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function FRATQuestion({ q, options, value, onChange, color, isPrefilled, academyContext, link, onLinkClick }) {
  const hasAnswer = value !== undefined;
  const entryLabel = isPrefilled ? "🔗 ACADEMY AUTO-FILL" : hasAnswer ? "✎ PILOT ENTERED" : "✎ PILOT INPUT REQUIRED";
  const entryColor = isPrefilled ? "#FFD700" : hasAnswer ? "#7DD8FF" : "#667788";
  return (
    <div style={{marginBottom:16}}>
      <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:8,flexWrap:"wrap"}}>
        <div style={{fontSize:12,color:"#D0DCE8",lineHeight:1.4}}>{q}</div>
        <div style={{fontSize:8,fontFamily:"'DM Mono',monospace",color:entryColor,background:isPrefilled?"rgba(255,180,0,0.12)":"rgba(0,180,255,0.07)",border:`1px solid ${isPrefilled?"rgba(255,180,0,0.35)":"rgba(0,180,255,0.18)"}`,borderRadius:4,padding:"2px 6px",flexShrink:0,letterSpacing:"0.04em"}}>{entryLabel}</div>
        {link && (
          <button onClick={()=>onLinkClick(link.action)} style={{background:"none",border:"none",padding:0,color:"#00B4FF",fontSize:10.5,fontFamily:"'DM Mono',monospace",cursor:"pointer",textDecoration:"underline",flexShrink:0}}>{link.label}</button>
        )}
      </div>
      {academyContext && <div style={{background:"rgba(255,180,0,0.055)",border:"1px solid rgba(255,180,0,0.18)",borderRadius:6,padding:"8px 10px",marginBottom:8,fontSize:10,color:"#B8A974",lineHeight:1.5}}><span style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#FFD700",letterSpacing:"0.06em"}}>{academyContext.source.toUpperCase()}</span><br/>{academyContext.detail}{!isPrefilled && hasAnswer && <><br/><span style={{color:"#7DD8FF"}}>Pilot override recorded; Academy context remains visible.</span></>}</div>}
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {options.map(([label,pts],i)=>(
          <button key={i} onClick={()=>onChange(pts)} style={{
            display:"flex",alignItems:"center",justifyContent:"space-between",textAlign:"left",
            background:value===pts?`${color}22`:"rgba(255,255,255,0.03)",
            border:`1px solid ${value===pts?color:"rgba(255,255,255,0.08)"}`,
            borderRadius:7,padding:"9px 12px",cursor:"pointer",
            color:value===pts?"#FFFFFF":"#8899AA",fontSize:11.5,
          }}>
            <span>{label}</span>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:value===pts?color:"#445566",marginLeft:10,flexShrink:0}}>+{pts}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function FRATSection({ section, answers, onAnswer, prefillKeys, academyContexts, onLinkClick }) {
  return (
    <E6BCard title={section.title} icon={section.icon}>
      {section.questions.map((item,i)=>{
        const key = `${section.id}_${i}`;
        return (
          <FRATQuestion key={i} q={item.q} options={item.options} color={section.color}
            value={answers[key]} isPrefilled={!!prefillKeys?.[key]}
            academyContext={academyContexts?.[key]}
            link={item.link} onLinkClick={onLinkClick}
            onChange={(pts)=>onAnswer(key, pts)} />
        );
      })}
    </E6BCard>
  );
}

function FRATScoreBox({ answeredCount, totalQuestions, allAnswered, risk, score, reset, title="ASSESSMENT STATUS", onContinue }) {
  return (
    <div style={{background:risk?`${risk.color}15`:"rgba(255,255,255,0.03)",border:`1px solid ${risk?risk.color:"rgba(255,255,255,0.1)"}55`,borderRadius:10,padding:"16px 18px",marginBottom:20}}>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:risk?.color||"#556677",letterSpacing:"0.12em",marginBottom:9}}>{title}</div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:allAnswered?10:0}}>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#8899AA",letterSpacing:"0.08em"}}>PROGRESS: {answeredCount}/{totalQuestions} ANSWERED</div>
        {allAnswered && <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:risk.color,fontWeight:"bold"}}>SCORE {score}/{FRAT_MAX}</div>}
      </div>
      {!allAnswered && (
        <div style={{height:6,background:"rgba(255,255,255,0.08)",borderRadius:3,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${(answeredCount/totalQuestions)*100}%`,background:"#00B4FF",borderRadius:3}}/>
        </div>
      )}
      {allAnswered && (
        <>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
            <div style={{width:14,height:14,borderRadius:"50%",background:risk.color,flexShrink:0}}/>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:"0.08em",color:risk.color}}>{risk.level} — {risk.label}</div>
          </div>
          <div style={{fontSize:11.5,color:"#B0BCC8",lineHeight:1.6}}>{risk.detail}</div>
          {onContinue && <button onClick={onContinue} style={{width:"100%",marginTop:14,background:"linear-gradient(135deg,#00B4FF,#008FE0)",border:"none",borderRadius:7,padding:"11px 14px",color:"#04101C",cursor:"pointer",fontSize:11,fontWeight:"bold",fontFamily:"'DM Mono',monospace",letterSpacing:"0.06em"}}>CONTINUE TO RISK CONTROLS →</button>}
        </>
      )}
      {reset && <button onClick={reset} style={{marginTop:12,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:6,padding:"6px 12px",color:"#8899AA",cursor:"pointer",fontSize:10,fontFamily:"'DM Mono',monospace"}}>↺ START OVER</button>}
    </div>
  );
}

function MitigationCard({ factor, initialPoints, control, residualValue, onToggleAction, onNoteChange, onResidualChange }) {
  const { section, question } = factor;
  const actions = control?.actions || [];
  const note = control?.note || "";
  const recorded = hasRecordedControl(control);
  const canReduce = canControlReduce(question, control);
  const choices = [...question.mitigations, FRAT_RETAIN_CONTROL];
  return (
    <div style={{background:"rgba(255,255,255,0.025)",border:`1px solid ${section.color}33`,borderRadius:10,padding:"17px 18px",marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start",marginBottom:12}}>
        <div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:section.color,letterSpacing:"0.12em",marginBottom:5}}>{section.icon} {section.title}</div>
          <div style={{fontSize:13,color:"#FFFFFF",fontWeight:600,lineHeight:1.4}}>{question.q}</div>
          <div style={{fontSize:10.5,color:"#8899AA",marginTop:4,lineHeight:1.5}}>Initial: {fratAnswerLabel(question, initialPoints)}</div>
        </div>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:initialPoints===3?"#FF6B6B":"#FFD700",border:`1px solid ${initialPoints===3?"rgba(255,59,59,0.35)":"rgba(255,215,0,0.3)"}`,background:initialPoints===3?"rgba(255,59,59,0.09)":"rgba(255,215,0,0.07)",borderRadius:5,padding:"4px 7px",flexShrink:0}}>+{initialPoints}</div>
      </div>

      <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#AAB8C6",letterSpacing:"0.08em",marginBottom:8}}>SELECT ONE OR MORE REAL CONTROLS</div>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {choices.map(action => {
          const selected = actions.includes(action);
          const retain = action === FRAT_RETAIN_CONTROL;
          return (
            <button key={action} onClick={()=>onToggleAction(action)} style={{display:"flex",alignItems:"flex-start",gap:9,textAlign:"left",background:selected?(retain?"rgba(255,215,0,0.09)":`${section.color}18`):"rgba(255,255,255,0.025)",border:`1px solid ${selected?(retain?"rgba(255,215,0,0.35)":section.color):"rgba(255,255,255,0.08)"}`,borderRadius:7,padding:"9px 11px",color:selected?"#FFFFFF":"#8899AA",fontSize:11,cursor:"pointer",lineHeight:1.45}}>
              <span style={{width:15,height:15,borderRadius:3,border:`1px solid ${selected?(retain?"#FFD700":section.color):"#556677"}`,background:selected?(retain?"#FFD700":section.color):"transparent",color:"#05101A",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:"bold",flexShrink:0,marginTop:1}}>{selected?"✓":""}</span>
              <span>{action}</span>
            </button>
          );
        })}
      </div>

      <label style={{display:"block",fontFamily:"'DM Mono',monospace",fontSize:9,color:"#AAB8C6",letterSpacing:"0.08em",margin:"13px 0 6px"}}>CONTROL NOTES / CUSTOM MITIGATION</label>
      <textarea value={note} onChange={event=>onNoteChange(event.target.value)} placeholder="Record what will actually change before the flight…" rows={3} style={{width:"100%",resize:"vertical",background:"rgba(0,0,0,0.25)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:7,padding:"9px 10px",color:"#FFFFFF",fontFamily:"'Inter',sans-serif",fontSize:11.5,lineHeight:1.5,outline:"none"}}/>

      <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#AAB8C6",letterSpacing:"0.08em",margin:"14px 0 4px"}}>REASSESS AFTER THE CONTROL IS ACTUALLY APPLIED</div>
      <div style={{fontSize:10,color:"#667788",lineHeight:1.5,marginBottom:8}}>Choose the condition that will genuinely exist after mitigation. Selecting a control does not automatically reduce the score.</div>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {question.options.map(([label, points]) => {
          const reductionBlocked = points < initialPoints && !canReduce;
          const disabled = !recorded || reductionBlocked;
          return (
            <button key={points} disabled={disabled} onClick={()=>onResidualChange(points)} style={{display:"flex",justifyContent:"space-between",gap:10,textAlign:"left",background:residualValue===points?`${section.color}20`:"rgba(255,255,255,0.025)",border:`1px solid ${residualValue===points?section.color:"rgba(255,255,255,0.08)"}`,borderRadius:7,padding:"8px 10px",color:disabled?"#3F4D5A":residualValue===points?"#FFFFFF":"#8899AA",fontSize:11,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.65:1}}>
              <span>{label}</span><span style={{fontFamily:"'DM Mono',monospace",fontSize:9,flexShrink:0}}>+{points}</span>
            </button>
          );
        })}
      </div>
      {!recorded && <div style={{fontSize:10,color:"#FFD700",marginTop:8,lineHeight:1.5}}>Record a control (or state that none is effective) before entering the residual assessment.</div>}
      {recorded && !canReduce && <div style={{fontSize:10,color:"#FFD700",marginTop:8,lineHeight:1.5}}>This selection supports review but does not change the underlying factor on its own, so it cannot reduce this factor's residual score.</div>}
    </div>
  );
}

function FRATComparison({ initialScore, residualScore, initialRisk, residualRisk }) {
  const delta = residualScore - initialScore;
  const resultCards = [
    ["INITIAL RISK", initialScore, initialRisk],
    ["RESIDUAL RISK", residualScore, residualRisk],
  ];
  return (
    <div style={{marginBottom:18}}>
      <div style={{display:"flex",alignItems:"stretch",gap:9,flexWrap:"wrap"}}>
        {resultCards.map(([title, score, risk], index) => (
          <div key={title} style={{flex:"1 1 210px",background:`${risk.color}12`,border:`1px solid ${risk.color}55`,borderRadius:9,padding:"14px 15px"}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#8899AA",letterSpacing:"0.12em",marginBottom:7}}>{title}</div>
            <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",gap:8}}>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:23,color:risk.color,letterSpacing:"0.08em"}}>{risk.level}</div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:risk.color}}>{score}/{FRAT_MAX}</div>
            </div>
            <div style={{fontSize:10.5,color:"#B0BCC8",marginTop:3}}>{risk.label}</div>
            {index===1 && <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:delta<0?"#00C896":delta>0?"#FF6B6B":"#8899AA",marginTop:8}}>{delta<0?`−${Math.abs(delta)} points after controls`:delta>0?`+${delta} points after reassessment`:"No score change"}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function FRATFinalReview({ materialFactors, initialAnswers, controls, residualAnswers, initialScore, residualScore, onBackToControls, onEditInitial, onReset }) {
  const initialRisk = fratRiskLevel(initialScore);
  const residualRisk = fratRiskLevel(residualScore);
  return (
    <>
      <div style={{background:`${residualRisk.color}10`,border:`1px solid ${residualRisk.color}55`,borderRadius:10,padding:"17px 18px",marginBottom:16}}>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:residualRisk.color,letterSpacing:"0.12em",marginBottom:7}}>FINAL RISK REVIEW</div>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:"0.08em",color:residualRisk.color,marginBottom:5}}>{residualRisk.label}</div>
        <div style={{fontSize:12,color:"#D0DCE8",lineHeight:1.65}}>{residualRisk.detail}</div>
        <div style={{fontSize:10.5,color:residualRisk.color,fontWeight:600,marginTop:9}}>{residualRisk.review}</div>
      </div>
      <FRATComparison initialScore={initialScore} residualScore={residualScore} initialRisk={initialRisk} residualRisk={residualRisk}/>

      <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#8899AA",letterSpacing:"0.1em",margin:"20px 0 9px"}}>CONTROL RECORD</div>
      {materialFactors.length===0 && <div style={{background:"rgba(0,200,150,0.06)",border:"1px solid rgba(0,200,150,0.2)",borderRadius:8,padding:"12px 13px",fontSize:11,color:"#A9C8BE",lineHeight:1.6,marginBottom:14}}>No individual factor scored 2 or 3, so no material-factor control was generated. The residual score remains the same; normal pre-flight review still applies.</div>}
      {materialFactors.map(factor => {
        const initialValue = initialAnswers[factor.key];
        const residualValue = residualAnswers[factor.key] ?? initialValue;
        const control = controls[factor.key] || { actions: [], note: "" };
        return (
          <div key={factor.key} style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:8,padding:"13px 14px",marginBottom:9}}>
            <div style={{fontSize:12,color:"#FFFFFF",fontWeight:600,marginBottom:7}}>{factor.question.q}</div>
            <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto minmax(0,1fr)",gap:8,alignItems:"center",fontSize:10.5}}>
              <div style={{color:"#8899AA"}}><span style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#556677"}}>INITIAL</span><br/>{fratAnswerLabel(factor.question, initialValue)} <span style={{color:"#FFD700"}}>+{initialValue}</span></div>
              <div style={{color:"#556677"}}>→</div>
              <div style={{color:"#D0DCE8"}}><span style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#556677"}}>RESIDUAL</span><br/>{fratAnswerLabel(factor.question, residualValue)} <span style={{color:residualValue<initialValue?"#00C896":residualValue>initialValue?"#FF6B6B":"#FFD700"}}>+{residualValue}</span></div>
            </div>
            <div style={{marginTop:9,paddingTop:8,borderTop:"1px solid rgba(255,255,255,0.06)",fontSize:10.5,color:"#8FA1B2",lineHeight:1.55}}>
              <b style={{color:"#B9C7D4"}}>Controls:</b> {control.actions.join("; ") || "Custom control recorded"}{control.note?.trim() && <><br/><b style={{color:"#B9C7D4"}}>Notes:</b> {control.note.trim()}</>}
            </div>
          </div>
        );
      })}

      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:18}}>
        <button onClick={onBackToControls} style={{flex:"1 1 170px",background:"rgba(0,180,255,0.1)",border:"1px solid rgba(0,180,255,0.3)",borderRadius:7,padding:"10px 12px",color:"#00B4FF",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:10}}>← EDIT CONTROLS</button>
        <button onClick={onEditInitial} style={{flex:"1 1 170px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:7,padding:"10px 12px",color:"#AAB8C6",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:10}}>EDIT INITIAL ASSESSMENT</button>
        <button onClick={onReset} style={{flex:"1 1 120px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:7,padding:"10px 12px",color:"#778899",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:10}}>↺ START OVER</button>
      </div>
    </>
  );
}

function FRATScreen({ onClose, opsPrefill, onOpenDA, answers, setAnswers, prefillKeys, setPrefillKeys, initialAnswers, setInitialAnswers, controls, setControls, residualAnswers, setResidualAnswers, reviewComplete, setReviewComplete }) {
  const academySeed = buildOpsFratSeed(opsPrefill);
  const totalQuestions = FRAT_SECTIONS.reduce((sum,s)=>sum+s.questions.length,0);
  const answeredCount = Object.keys(answers).length;
  const score = Object.values(answers).reduce((sum,v)=>sum+v,0);
  const allAnswered = answeredCount === totalQuestions;
  const risk = allAnswered ? fratRiskLevel(score) : null;
  const stage = initialAnswers ? (reviewComplete ? "review" : "controls") : "assessment";
  const initialScore = initialAnswers ? Object.values(initialAnswers).reduce((sum,value)=>sum+value,0) : 0;
  const materialFactors = initialAnswers ? FRAT_QUESTION_ENTRIES.filter(({key}) => initialAnswers[key] >= FRAT_MATERIAL_SCORE) : [];
  const residualScore = initialAnswers ? FRAT_QUESTION_ENTRIES.reduce((sum,{key}) => sum + (residualAnswers[key] ?? initialAnswers[key]), 0) : 0;
  const completedControls = materialFactors.filter(({key}) => hasRecordedControl(controls[key]) && Object.prototype.hasOwnProperty.call(residualAnswers,key)).length;
  const allControlsComplete = !!initialAnswers && completedControls === materialFactors.length;

  function onAnswer(key, pts) {
    setAnswers(prev => ({ ...prev, [key]: pts }));
    setPrefillKeys(prev => { const next = {...prev}; delete next[key]; return next; }); // user override clears the auto-fill tag
  }
  function reset() {
    const seed = buildOpsFratSeed(opsPrefill);
    setAnswers(seed.answers);
    setPrefillKeys(seed.keys);
    setInitialAnswers(null);
    setControls({});
    setResidualAnswers({});
    setReviewComplete(false);
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function beginControls() {
    if (!allAnswered) return;
    setInitialAnswers({...answers});
    setControls({});
    setResidualAnswers({});
    setReviewComplete(false);
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function editInitial() {
    setInitialAnswers(null);
    setControls({});
    setResidualAnswers({});
    setReviewComplete(false);
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function toggleAction(key, action) {
    const current = controls[key] || { actions: [], note: "" };
    let nextActions;
    if (action === FRAT_RETAIN_CONTROL) {
      nextActions = current.actions.includes(action) ? [] : [FRAT_RETAIN_CONTROL];
    } else {
      const withoutRetain = current.actions.filter(item => item !== FRAT_RETAIN_CONTROL);
      nextActions = withoutRetain.includes(action) ? withoutRetain.filter(item => item !== action) : [...withoutRetain, action];
    }
    const nextControl = {...current,actions:nextActions};
    const question = FRAT_QUESTION_ENTRIES.find(entry => entry.key===key)?.question;
    setControls(prev => ({...prev,[key]:nextControl}));
    if (!hasRecordedControl(nextControl)) {
      setResidualAnswers(prev => { const next = {...prev}; delete next[key]; return next; });
    } else if (question && !canControlReduce(question,nextControl)) {
      setResidualAnswers(prev => ({...prev,[key]:initialAnswers[key]}));
    }
    setReviewComplete(false);
  }
  function setControlNote(key, note) {
    const nextControl = {actions:controls[key]?.actions||[],note};
    const question = FRAT_QUESTION_ENTRIES.find(entry => entry.key===key)?.question;
    setControls(prev => ({...prev,[key]:nextControl}));
    if (!hasRecordedControl(nextControl)) {
      setResidualAnswers(prev => { const next = {...prev}; delete next[key]; return next; });
    } else if (question && !canControlReduce(question,nextControl)) {
      setResidualAnswers(prev => ({...prev,[key]:initialAnswers[key]}));
    }
    setReviewComplete(false);
  }
  function setResidualAnswer(key, value) {
    setResidualAnswers(prev => ({...prev,[key]:value}));
    setReviewComplete(false);
  }

  return (
    <div style={{minHeight:"100vh",background:"#050D18",fontFamily:"'Inter',sans-serif",color:"#D0DCE8"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Inter:wght@300;400;500;600;700&family=Bebas+Neue&display=swap');*{box-sizing:border-box;margin:0;padding:0;}`}</style>
      <div style={{background:"rgba(3,10,22,0.97)",borderBottom:"1px solid rgba(0,180,255,0.2)",padding:"0 20px",display:"flex",alignItems:"center",gap:10,height:56,position:"sticky",top:0,zIndex:100}}>
        <button onClick={onClose} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:7,padding:"7px 12px",color:"#8899AA",cursor:"pointer",fontSize:14}}>← BACK</button>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:"0.12em",color:"#FFFFFF",marginLeft:6}}>🛡 FLIGHT RISK ASSESSMENT{opsPrefill ? " — DEMO" : ""}</div>
      </div>
      <div style={{maxWidth:640,margin:"0 auto",padding:"22px 18px 60px"}}>
        <FRATFlow stage={stage}/>
        <div style={{fontSize:12,color:"#8899AA",marginBottom:16,lineHeight:1.6}}>Structured around the FAA's PAVE checklist (Pilot, Aircraft, enVironment, External pressures). The workflow records initial risk, specific controls, and residual risk; it supports the PIC / CFI decision and never makes the go/no-go decision.</div>

        {stage==="assessment" && opsPrefill && (opsPrefill.person || opsPrefill.aircraft) && (
          <div style={{background:"rgba(255,180,0,0.08)",border:"1px solid rgba(255,180,0,0.3)",borderRadius:8,padding:"11px 13px",fontSize:11,color:"#FFD700",lineHeight:1.6,marginBottom:16}}>
            🔗 <b>{opsPrefill.person?.name}{opsPrefill.person && opsPrefill.aircraft ? " / " : ""}{opsPrefill.aircraft?.tail}</b> — {Object.keys(prefillKeys).length} answer{Object.keys(prefillKeys).length===1?"":"s"} below auto-filled from shared simulated Academy records. Anything you change yourself is marked as pilot-entered while the source context stays visible.<br/><span style={{color:"#C0A95C"}}>Sleep, IMSAFE, weather, performance, fuel and external-pressure answers remain manual.</span>
          </div>
        )}

        {stage==="assessment" && academySeed.advisories.map(advisory=>{
          const requiresAction = advisory.level === "action";
          return <div key={advisory.id} style={{background:requiresAction?"rgba(255,59,59,0.09)":"rgba(255,215,0,0.055)",border:`1px solid ${requiresAction?"rgba(255,59,59,0.38)":"rgba(255,215,0,0.22)"}`,borderRadius:8,padding:"10px 12px",fontSize:10.5,color:requiresAction?"#FF9A9A":"#C8B76E",lineHeight:1.55,marginBottom:9}}><b style={{color:requiresAction?"#FF7C7C":"#FFD700"}}>{requiresAction?"🔴 ACTION REQUIRED":"🟡 ADVISORY"} — {advisory.title}</b><br/>{advisory.detail}</div>;
        })}

        {stage==="assessment" && <>
          <FRATScoreBox answeredCount={answeredCount} totalQuestions={totalQuestions} allAnswered={allAnswered} risk={risk} score={score} reset={reset}/>
          {FRAT_SECTIONS.map(section=>(
            <FRATSection key={section.id} section={section} answers={answers} onAnswer={onAnswer} prefillKeys={prefillKeys} academyContexts={academySeed.contexts} onLinkClick={(action)=>{ if(action==="da") onOpenDA?.(); }} />
          ))}
          <FRATScoreBox answeredCount={answeredCount} totalQuestions={totalQuestions} allAnswered={allAnswered} risk={risk} score={score} reset={reset} title="INITIAL RISK RESULT" onContinue={allAnswered?beginControls:null}/>
        </>}

        {stage==="controls" && <>
          <FRATScoreBox answeredCount={totalQuestions} totalQuestions={totalQuestions} allAnswered risk={fratRiskLevel(initialScore)} score={initialScore} title="INITIAL ASSESSMENT — LOCKED"/>
          <div style={{background:"rgba(0,180,255,0.06)",border:"1px solid rgba(0,180,255,0.2)",borderRadius:8,padding:"12px 13px",fontSize:11,color:"#9DB2C5",lineHeight:1.6,marginBottom:16}}>
            <b style={{color:"#D0E2F2"}}>{materialFactors.length} material factor{materialFactors.length===1?"":"s"}</b> scored 2 or 3. Record a real control and then reassess the condition that will exist after that control is applied. Initial answers stay locked for comparison.
          </div>
          <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",marginBottom:10}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#8899AA",letterSpacing:"0.1em"}}>CONTROL PROGRESS {completedControls}/{materialFactors.length}</div>
            <button onClick={editInitial} style={{background:"none",border:"none",padding:0,color:"#00B4FF",fontFamily:"'DM Mono',monospace",fontSize:9,cursor:"pointer",textDecoration:"underline"}}>EDIT INITIAL ANSWERS</button>
          </div>
          {materialFactors.length===0 && <div style={{background:"rgba(0,200,150,0.06)",border:"1px solid rgba(0,200,150,0.2)",borderRadius:8,padding:"13px",fontSize:11,color:"#A9C8BE",lineHeight:1.6,marginBottom:14}}>No individual answer scored 2 or 3. There are no generated material-factor controls, but the final review will still preserve the initial and residual result.</div>}
          {materialFactors.map(factor=><MitigationCard key={factor.key} factor={factor} initialPoints={initialAnswers[factor.key]} control={controls[factor.key]} residualValue={residualAnswers[factor.key]} onToggleAction={action=>toggleAction(factor.key,action)} onNoteChange={note=>setControlNote(factor.key,note)} onResidualChange={value=>setResidualAnswer(factor.key,value)}/>)}
          <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:9,padding:"14px 15px",marginTop:18}}>
            <div style={{fontSize:10.5,color:"#8899AA",lineHeight:1.55,marginBottom:10}}>{allControlsComplete?"Every material factor has a recorded control and residual assessment.":`Complete ${materialFactors.length-completedControls} remaining factor${materialFactors.length-completedControls===1?"":"s"} to produce the final comparison.`}</div>
            <button disabled={!allControlsComplete} onClick={()=>{setReviewComplete(true);window.scrollTo({top:0,behavior:"smooth"});}} style={{width:"100%",background:allControlsComplete?"linear-gradient(135deg,#00C896,#00A879)":"rgba(255,255,255,0.06)",border:"none",borderRadius:7,padding:"11px 14px",color:allControlsComplete?"#04120E":"#556677",cursor:allControlsComplete?"pointer":"not-allowed",fontSize:11,fontWeight:"bold",fontFamily:"'DM Mono',monospace",letterSpacing:"0.06em"}}>VIEW INITIAL → RESIDUAL SUMMARY →</button>
          </div>
        </>}

        {stage==="review" && <FRATFinalReview materialFactors={materialFactors} initialAnswers={initialAnswers} controls={controls} residualAnswers={residualAnswers} initialScore={initialScore} residualScore={residualScore} onBackToControls={()=>{setReviewComplete(false);window.scrollTo({top:0,behavior:"smooth"});}} onEditInitial={editInitial} onReset={reset}/>}

        <div style={{fontSize:9,color:"#46596A",fontFamily:"'DM Mono',monospace",marginTop:22,lineHeight:1.65}}>Educational risk-awareness and decision-support tool — not an FAA-approved SMS, not a determination of airworthiness, and not a substitute for the PIC's judgement, a CFI's assessment, official weather and flight-planning information, or an operator's formal risk-management process. <a href="https://www.faa.gov/general/flight-risk-assessment-tool-frat-faa-safety-team" target="_blank" rel="noreferrer" style={{color:"#5D829E"}}>FAA Safety Team FRAT guidance</a>.</div>
      </div>
    </div>
  );
}

// ── E6B flight computer screen ──────────────────────────────────────────
function LabeledNumberInput({ label, value, onChange, suffix }) {
  return (
    <div style={{flex:1,minWidth:130}}>
      <div style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#556677",marginBottom:5,letterSpacing:"0.08em"}}>{label}</div>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <input
          type="number"
          value={value}
          onChange={e=>onChange(e.target.value)}
          style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(0,180,255,0.25)",borderRadius:6,padding:"9px 10px",color:"#FFFFFF",fontSize:14,fontFamily:"'DM Mono',monospace",outline:"none"}}
        />
        {suffix && <span style={{fontSize:10,color:"#556677",fontFamily:"'DM Mono',monospace",flexShrink:0}}>{suffix}</span>}
      </div>
    </div>
  );
}

function E6BResultBox(props) {
  const { label, value, color="#00B4FF" } = props;
  return (
    <div style={{background:"rgba(0,0,0,0.35)",border:`1px solid ${color}44`,borderRadius:8,padding:"12px 14px",textAlign:"center",flex:1,minWidth:110}}>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#556677",letterSpacing:"0.1em",marginBottom:4}}>{label}</div>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:20,color,fontWeight:"bold"}}>{value}</div>
    </div>
  );
}

function E6BCard({ title, icon, children }) {
  return (
    <div style={{background:"rgba(0,180,255,0.05)",border:"1px solid rgba(0,180,255,0.2)",borderRadius:10,padding:"18px 20px",marginBottom:16}}>
      <div style={{fontSize:11,fontFamily:"'DM Mono',monospace",color:"#00B4FF",letterSpacing:"0.12em",fontWeight:"bold",marginBottom:14}}>{icon} {title}</div>
      {children}
    </div>
  );
}

function WindTASCard() {
  const [tc, setTc] = useState("360");
  const [tas, setTas] = useState("110");
  const [wd, setWd] = useState("270");
  const [ws, setWs] = useState("15");

  const tcN = parseFloat(tc), tasN = parseFloat(tas), wdN = parseFloat(wd), wsN = parseFloat(ws);
  const valid = [tcN, tasN, wdN, wsN].every(n => !isNaN(n));
  const result = valid ? calcWindTriangle(tcN, tasN, wdN, wsN) : null;

  return (
    <E6BCard title="WIND CORRECTION & GROUNDSPEED" icon="🧭">
      <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:14}}>
        <LabeledNumberInput label="TRUE COURSE" value={tc} onChange={setTc} suffix="°" />
        <LabeledNumberInput label="TRUE AIRSPEED" value={tas} onChange={setTas} suffix="kt" />
        <LabeledNumberInput label="WIND FROM" value={wd} onChange={setWd} suffix="°" />
        <LabeledNumberInput label="WIND SPEED" value={ws} onChange={setWs} suffix="kt" />
      </div>
      {result ? (
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <E6BResultBox label="WIND CORR. ANGLE" value={`${result.wca>=0?"+":""}${result.wca.toFixed(1)}°`} />
          <E6BResultBox label="TRUE HEADING" value={`${result.trueHeading.toFixed(0).padStart(3,"0")}°`} color="#00C896" />
          <E6BResultBox label="GROUNDSPEED" value={`${result.groundspeed.toFixed(0)} kt`} color="#FFD700" />
        </div>
      ) : (
        <div style={{fontSize:11,color:"#FF8C00",fontFamily:"'DM Mono',monospace"}}>
          {valid ? "Wind speed exceeds what's resolvable at this airspeed/course — check your numbers." : "Enter all four values."}
        </div>
      )}
      <div style={{fontSize:9,color:"#556677",marginTop:12,lineHeight:1.5}}>Wind FROM direction, standard wind-triangle trigonometric solution. True heading — apply magnetic variation separately for your compass heading.</div>
    </E6BCard>
  );
}

function TASCard() {
  const [cas, setCas] = useState("120");
  const [pa, setPa] = useState("5000");
  const [oat, setOat] = useState("15");

  const casN = parseFloat(cas), paN = parseFloat(pa), oatN = parseFloat(oat);
  const valid = [casN, paN, oatN].every(n => !isNaN(n));
  const tas = valid ? calcTAS(casN, paN, oatN) : null;

  return (
    <E6BCard title="TRUE AIRSPEED" icon="✈">
      <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:14}}>
        <LabeledNumberInput label="CALIBRATED AIRSPEED" value={cas} onChange={setCas} suffix="kt" />
        <LabeledNumberInput label="PRESSURE ALTITUDE" value={pa} onChange={setPa} suffix="ft" />
        <LabeledNumberInput label="OUTSIDE AIR TEMP" value={oat} onChange={setOat} suffix="°C" />
      </div>
      {tas !== null && (
        <E6BResultBox label="TRUE AIRSPEED" value={`${tas.toFixed(0)} kt`} color="#00C896" />
      )}
      <div style={{fontSize:9,color:"#556677",marginTop:12,lineHeight:1.5}}>Uses the standard density-altitude approximation (≈2% per 1,000ft of density altitude) — the same method a mechanical E6B computes.</div>
    </E6BCard>
  );
}

function TimeSpeedDistanceCard() {
  const [solveFor, setSolveFor] = useState("distance"); // "time" | "speed" | "distance"
  const [time, setTime] = useState("30");    // minutes
  const [speed, setSpeed] = useState("120"); // kt
  const [distance, setDistance] = useState("60"); // nm

  const timeN = parseFloat(time), speedN = parseFloat(speed), distN = parseFloat(distance);

  let computed = null, label = "", unit = "";
  if (solveFor === "distance" && !isNaN(timeN) && !isNaN(speedN)) {
    computed = speedN * (timeN / 60); label = "DISTANCE"; unit = "nm";
  } else if (solveFor === "speed" && !isNaN(timeN) && !isNaN(distN) && timeN > 0) {
    computed = distN / (timeN / 60); label = "SPEED"; unit = "kt";
  } else if (solveFor === "time" && !isNaN(speedN) && !isNaN(distN) && speedN > 0) {
    computed = (distN / speedN) * 60; label = "TIME"; unit = "min";
  }

  return (
    <E6BCard title="TIME · SPEED · DISTANCE" icon="⏱">
      <div style={{display:"flex",gap:6,marginBottom:14}}>
        {["time","speed","distance"].map(f=>(
          <button key={f} onClick={()=>setSolveFor(f)} style={{flex:1,padding:"6px 8px",borderRadius:5,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:"0.06em",background:solveFor===f?"rgba(0,180,255,0.18)":"rgba(255,255,255,0.04)",border:`1px solid ${solveFor===f?"rgba(0,180,255,0.4)":"rgba(255,255,255,0.07)"}`,color:solveFor===f?"#00B4FF":"#8899AA"}}>SOLVE FOR {f.toUpperCase()}</button>
        ))}
      </div>
      <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:14}}>
        {solveFor !== "time" && <LabeledNumberInput label="TIME" value={time} onChange={setTime} suffix="min" />}
        {solveFor !== "speed" && <LabeledNumberInput label="SPEED" value={speed} onChange={setSpeed} suffix="kt" />}
        {solveFor !== "distance" && <LabeledNumberInput label="DISTANCE" value={distance} onChange={setDistance} suffix="nm" />}
      </div>
      {computed !== null ? (
        <E6BResultBox label={label} value={`${computed.toFixed(1)} ${unit}`} color="#FFD700" />
      ) : (
        <div style={{fontSize:11,color:"#FF8C00",fontFamily:"'DM Mono',monospace"}}>Enter the other two values.</div>
      )}
    </E6BCard>
  );
}

function E6BScreen({ onClose }) {
  return (
    <div style={{minHeight:"100vh",background:"#050D18",fontFamily:"'Inter',sans-serif",color:"#D0DCE8"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Inter:wght@300;400;500;600;700&family=Bebas+Neue&display=swap');*{box-sizing:border-box;margin:0;padding:0;}input[type=number]::-webkit-inner-spin-button{opacity:0.5;}`}</style>
      <div style={{background:"rgba(3,10,22,0.97)",borderBottom:"1px solid rgba(0,180,255,0.2)",padding:"0 20px",display:"flex",alignItems:"center",gap:10,height:56,position:"sticky",top:0,zIndex:100}}>
        <button onClick={onClose} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:7,padding:"7px 12px",color:"#8899AA",cursor:"pointer",fontSize:14}}>← BACK</button>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:"0.12em",color:"#FFFFFF",marginLeft:6}}>🧮 E6B FLIGHT COMPUTER</div>
      </div>
      <div style={{maxWidth:640,margin:"0 auto",padding:"22px 18px 60px"}}>
        <div style={{fontSize:12,color:"#8899AA",marginBottom:20,lineHeight:1.6}}>Standard flight-planning calculations, worked the same way a mechanical E6B does. Results update as you type.</div>
        <WindTASCard />
        <TASCard />
        <TimeSpeedDistanceCard />
        <div style={{fontSize:9,color:"#334455",fontFamily:"'DM Mono',monospace",marginTop:20,lineHeight:1.6}}>Educational planning tool — always cross-check critical numbers against your POH/AFM and official flight-planning materials before flight.</div>
      </div>
    </div>
  );
}

export default function App() {
  const width = useWindowWidth();
  const isMobile = width<640;
  const isDesktop = width>=1024;
  const initialWorkspaceRef = useRef(null);
  if (!initialWorkspaceRef.current) {
    const seed = createDemoWorkspaceSnapshot();
    initialWorkspaceRef.current = loadBrowserWorkspaceSnapshot(
      typeof window!=="undefined" ? window.localStorage : null,
      seed,
    );
  }
  const initialWorkspace = initialWorkspaceRef.current;
  const workspaceRepositoryRef = useRef(null);
  const persistenceReadyRef = useRef(false);
  const lastWorkspaceSignatureRef = useRef(null);
  const saveChainRef = useRef(Promise.resolve());
  const [region,setRegion] = useState("florida");
  const [selected,setSelected] = useState("KVRB");
  const [query,setQuery] = useState("KVRB");
  const [showWelcome,setShowWelcome] = useState(true);
  const [showE6B,setShowE6B] = useState(false);
  const [showFRAT,setShowFRAT] = useState(false);
  const [accountType,setAccountType] = useState(null); // null | "personal" | "flightschool"
  const [opsLoggedIn,setOpsLoggedIn] = useState(false);
  const [orgName,setOrgName] = useState("");
  const [opsPrefill,setOpsPrefill] = useState(null); // { person, aircraft } | null
  const [showOpsDashboard,setShowOpsDashboard] = useState(false);
  const [opsWorkspace,setOpsWorkspace] = useState(null); // "ops" | "admin" | "cfi" | "engineering"
  const [workspaceMeta,setWorkspaceMeta] = useState(()=>({
    id:initialWorkspace.id,
    name:initialWorkspace.name,
    kind:initialWorkspace.kind,
    schemaVersion:initialWorkspace.schemaVersion,
    templateVersion:initialWorkspace.templateVersion,
    dataMode:"synthetic",
    authoritative:false,
    resettable:true,
    revision:initialWorkspace.revision || 0,
    createdAt:initialWorkspace.createdAt,
    updatedAt:initialWorkspace.updatedAt,
  }));
  const [persistenceState,setPersistenceState] = useState({
    mode:"loading",
    label:"OPENING PRIVATE SYNTHETIC DEMO",
    status:"loading",
    error:null,
  });
  const [opsPeople,setOpsPeople] = useState(()=>initialWorkspace.people);
  const [opsAircraftList,setOpsAircraftList] = useState(()=>initialWorkspace.aircraft);
  const [opsUsers,setOpsUsers] = useState(()=>initialWorkspace.users);
  const [opsAdminAudit,setOpsAdminAudit] = useState(()=>initialWorkspace.adminAudit);
  const [fratAnswers,setFratAnswers] = useState({});
  const [fratPrefillKeys,setFratPrefillKeys] = useState({});
  const [fratInitialAnswers,setFratInitialAnswers] = useState(null);
  const [fratControls,setFratControls] = useState({});
  const [fratResidualAnswers,setFratResidualAnswers] = useState({});
  const [fratReviewComplete,setFratReviewComplete] = useState(false);
  const [suggestions,setSuggestions] = useState([]);
  const [phase,setPhase] = useState("all");
  const [expanded,setExpanded] = useState({});
  const [menuOpen,setMenuOpen] = useState(false);
  const [tab,setTab] = useState("hazards");
  const [liveWx,setLiveWx] = useState(null);
  const [wxLoad,setWxLoad] = useState(true);
  const [briefing,setBrief] = useState("");
  const [briefLoad,setBriefLoad] = useState(false);
  const airfield = AIRFIELDS[selected];

  const applyWorkspaceSnapshot = useCallback((snapshot)=>{
    setWorkspaceMeta({
      id:snapshot.id,
      name:snapshot.name,
      kind:snapshot.kind,
      schemaVersion:snapshot.schemaVersion,
      templateVersion:snapshot.templateVersion,
      dataMode:"synthetic",
      authoritative:false,
      resettable:true,
      revision:snapshot.revision || 0,
      createdAt:snapshot.createdAt,
      updatedAt:snapshot.updatedAt,
    });
    setOpsPeople(snapshot.people);
    setOpsAircraftList(snapshot.aircraft);
    setOpsUsers(snapshot.users);
    setOpsAdminAudit(snapshot.adminAudit);
  },[]);

  const workspaceSignature = useCallback((snapshot)=>JSON.stringify({
    people:snapshot.people,
    aircraft:snapshot.aircraft,
    users:snapshot.users,
    adminAudit:snapshot.adminAudit,
  }),[]);

  useEffect(()=>{
    let cancelled=false;
    const seed=createDemoWorkspaceSnapshot({
      id:initialWorkspace.id,
      name:initialWorkspace.name,
      kind:initialWorkspace.kind,
    });
    const storage=typeof window!=="undefined"?window.localStorage:null;
    let repository=createConfiguredWorkspaceRepository({env:import.meta.env,storage,seed});
    workspaceRepositoryRef.current=repository;

    async function openWorkspace() {
      try {
        const snapshot=await repository.loadOrCreate();
        if(cancelled) return;
        applyWorkspaceSnapshot(snapshot);
        lastWorkspaceSignatureRef.current=workspaceSignature(snapshot);
        persistenceReadyRef.current=true;
        setPersistenceState({mode:repository.mode,label:repository.label,status:"saved",error:null});
      } catch (error) {
        if(cancelled) return;
        repository=createConfiguredWorkspaceRepository({env:{},storage,seed:initialWorkspace});
        workspaceRepositoryRef.current=repository;
        const snapshot=await repository.loadOrCreate();
        if(cancelled) return;
        applyWorkspaceSnapshot(snapshot);
        lastWorkspaceSignatureRef.current=workspaceSignature(snapshot);
        persistenceReadyRef.current=true;
        setPersistenceState({
          mode:repository.mode,
          label:repository.label,
          status:"saved",
          error:`Cloud save unavailable; using the private device fallback. ${error.message}`,
        });
      }
    }

    openWorkspace();
    return ()=>{cancelled=true;};
  },[applyWorkspaceSnapshot,initialWorkspace,workspaceSignature]);

  useEffect(()=>{
    if(!persistenceReadyRef.current || !workspaceRepositoryRef.current) return;
    const snapshot={
      ...workspaceMeta,
      people:opsPeople,
      aircraft:opsAircraftList,
      users:opsUsers,
      adminAudit:opsAdminAudit,
    };
    const signature=workspaceSignature(snapshot);
    if(signature===lastWorkspaceSignatureRef.current) return;

    setPersistenceState(previous=>({...previous,status:"saving",error:null}));
    const timer=window.setTimeout(()=>{
      saveChainRef.current=saveChainRef.current
        .then(()=>workspaceRepositoryRef.current.save(snapshot))
        .then(saved=>{
          lastWorkspaceSignatureRef.current=workspaceSignature(saved);
          setWorkspaceMeta(previous=>({...previous,revision:saved.revision,updatedAt:saved.updatedAt}));
          setPersistenceState(previous=>({...previous,status:"saved",error:null}));
        })
        .catch(error=>setPersistenceState(previous=>({...previous,status:"error",error:error.message})));
    },300);
    return ()=>window.clearTimeout(timer);
  },[opsAdminAudit,opsAircraftList,opsPeople,opsUsers,workspaceMeta,workspaceSignature]);

  async function resetDemoWorkspace() {
    if(!workspaceRepositoryRef.current) return;
    if(typeof window!=="undefined" && !window.confirm("Reset this private synthetic workspace to the original SafeRoute demo data?")) return;
    setPersistenceState(previous=>({...previous,status:"saving",error:null}));
    try {
      const snapshot=await workspaceRepositoryRef.current.reset();
      applyWorkspaceSnapshot(snapshot);
      lastWorkspaceSignatureRef.current=workspaceSignature(snapshot);
      setPersistenceState(previous=>({...previous,status:"saved",error:null}));
    } catch (error) {
      setPersistenceState(previous=>({...previous,status:"error",error:error.message}));
    }
  }

  function handleSearch(val) {
    setQuery(val.toUpperCase());
    const up = val.toUpperCase().trim();
    if (up.length < 1) { setSuggestions([]); return; }
    const matches = Object.entries(AIRFIELDS).filter(([code,a]) =>
      code.includes(up) || a.name.toUpperCase().includes(up) || a.city.toUpperCase().includes(up)
    ).slice(0, 6);
    setSuggestions(matches);
  }

  function selectAirfield(code) {
    if (code !== selected) {
      setLiveWx(null);
      setWxLoad(true);
      setBrief("");
      setExpanded({});
    }
    setSelected(code);
    setQuery(code);
    setSuggestions([]);
    if (isMobile) setMenuOpen(false);
  }

  const REGION_DEFAULT_AIRFIELD = { florida:"KVRB", phoenix:"KDVT", uk:"EGBP", texas:"KFTW", socal:"KVNY", colorado:"KAPA" };

  function chooseRegion(r) {
    setRegion(r);
    const def = REGION_DEFAULT_AIRFIELD[r];
    if (def !== selected) {
      setLiveWx(null);
      setWxLoad(true);
      setBrief("");
      setExpanded({});
    }
    setSelected(def);
    setQuery(def);
    setShowWelcome(false);
  }

  const weatherIcao = airfield.weather_icao;
  useEffect(()=>{
    let cancelled = false;
    fetchLiveWeather(weatherIcao).then(wx=>{
      if (cancelled) return;
      setLiveWx(wx);
      setWxLoad(false);
    });
    return () => { cancelled = true; };
  },[weatherIcao]);

  const filteredHazards = airfield.hazards
    .filter(h=>phase==="all"||h.phase.includes(phase)||h.phase.includes("all"))
    .sort((a,b)=>({critical:4,high:3,medium:2,low:1}[b.sev]||0)-({critical:4,high:3,medium:2,low:1}[a.sev]||0));

  // ── WANT briefing data — built from real, already-fetched app data rather
  // than left entirely to the AI, so Weather/Aircraft/NOTAM-reminder/Threats
  // are accurate and deterministic. The AI summary underneath ties it
  // together in plain language but isn't the source of these facts.
  const briefMetarUsable = isMetarUsableForCalculations(liveWx);
  const briefLiveTemp = briefMetarUsable ? parseMetarTemp(liveWx.metar) : null;
  const briefLiveDew  = briefMetarUsable ? parseMetarDewpoint(liveWx.metar) : null;
  const briefLiveAlt  = briefMetarUsable ? parseMetarAltimeter(liveWx.metar) : null;
  const briefTafThreats = parseTAFThreats(liveWx?.tafs);

  let aircraftPerf = null;
  if (briefLiveTemp !== null) {
    if (airfield.region === "uk") {
      const dew = briefLiveDew ?? briefLiveTemp - 5;
      const cbAmsl = calcCloudBase(briefLiveTemp, dew, airfield.elevation);
      const cbAgl = Math.max(0, cbAmsl - airfield.elevation);
      const freezingLevel = estimateFreezingLevel(briefLiveTemp, airfield.elevation);
      const icingRisk = briefLiveTemp<=0 ? "LIKELY" : (freezingLevel < cbAmsl+2000 ? "POSSIBLE" : "NOT INDICATED");
      aircraftPerf = { kind:"uk", cbAgl, cbAmsl, freezingLevel, icingRisk, hasDew: briefLiveDew !== null };
    } else {
      const da = calcDA(airfield.elevation, briefLiveTemp, briefLiveAlt ?? 29.92);
      const daRisk = da>5000?"EXTREME":da>3500?"HIGH":da>2000?"MODERATE":"NORMAL";
      aircraftPerf = { kind:"da", da, daRisk };
    }
  }

  const briefTopHazards = [...airfield.hazards]
    .filter(h=>h.sev==="critical"||h.sev==="high")
    .sort((a,b)=>(a.sev==="critical"?0:1)-(b.sev==="critical"?0:1))
    .slice(0,6);

  const notamLink = airfield.region==="uk"
    ? "https://www.nats.aero/ais"
    : "https://notams.aim.faa.gov/notamSearch/";

  async function generateBriefing() {
    setBriefLoad(true);setBrief("");
    const metarUsable = isMetarUsableForCalculations(liveWx);
    const liveTemp = metarUsable?parseMetarTemp(liveWx.metar):null;
    const liveAlt  = metarUsable?parseMetarAltimeter(liveWx.metar):null;
    const da = liveTemp!==null?calcDA(airfield.elevation,liveTemp,liveAlt??29.92):null;
    const tafThreats = parseTAFThreats(liveWx?.tafs);
    const metarText = metarUsable
      ? `METAR: ${liveWx.metar}`
      : liveWx?.metar
        ? `STALE METAR — CONTEXT ONLY, DO NOT USE FOR CURRENT CALCULATIONS: ${liveWx.metar}`
        : "No METAR available.";
    const wxText = [metarText,liveWx?.tafs?.[0]?`TAF: ${liveWx.tafs[0].slice(0,300)}`:"",da!==null?`Current Density Altitude: ${da.toLocaleString()}ft`:"",tafThreats.length?`Forecast hazards: ${tafThreats.map(t=>t.text).join(", ")}`:""].filter(Boolean).join("\n");
    try {
      const res = await fetch(`${BACKEND}/routebrief`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({dep:selected,dest:selected,alts:[],aircraft:"Training aircraft (single-engine piston)",threats:airfield.hazards.map(h=>`${h.title} (${h.sev.toUpperCase()})`),liveWeather:wxText})});
      if(!res.ok) throw new Error("Failed");
      const data = await res.json();
      setBrief(data.briefing||"Unable to generate briefing.");
    } catch { setBrief("Unable to generate briefing. Check your connection."); }
    setBriefLoad(false);
  }

  const floridaFields = Object.entries(AIRFIELDS).filter(([,a])=>a.region==="florida");
  const phoenixFields = Object.entries(AIRFIELDS).filter(([,a])=>a.region==="phoenix");
  const ukFields = Object.entries(AIRFIELDS).filter(([,a])=>a.region==="uk");
  const texasFields = Object.entries(AIRFIELDS).filter(([,a])=>a.region==="texas");
  const socalFields = Object.entries(AIRFIELDS).filter(([,a])=>a.region==="socal");
  const coloradoFields = Object.entries(AIRFIELDS).filter(([,a])=>a.region==="colorado");

  function fieldsForRegion(r) {
    if (r==="florida") return floridaFields;
    if (r==="phoenix") return phoenixFields;
    if (r==="texas") return texasFields;
    if (r==="socal") return socalFields;
    if (r==="colorado") return coloradoFields;
    return ukFields;
  }

  const sidebar = (
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden",background:"#06101C"}}>
      <div style={{padding:"14px 12px 10px",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
        <div style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#445566",letterSpacing:"0.15em",marginBottom:8}}>SEARCH AIRFIELD</div>
        <div style={{position:"relative",marginBottom:10}}>
          <input value={query} onChange={e=>handleSearch(e.target.value)} placeholder="ICAO code or name…"
            style={{width:"100%",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(0,180,255,0.3)",borderRadius:7,padding:"10px 12px",color:"#FFFFFF",fontSize:13,fontFamily:"'DM Mono',monospace",outline:"none",letterSpacing:"0.05em"}}/>
          {suggestions.length > 0 && (
            <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:300,background:"#0D1E32",border:"1px solid rgba(0,180,255,0.3)",borderRadius:7,marginTop:4,overflow:"hidden",boxShadow:"0 8px 24px rgba(0,0,0,0.5)"}}>
              {suggestions.map(([code,a])=>{
                const critCount = a.hazards.filter(h=>h.sev==="critical").length;
                return (
                  <div key={code} onMouseDown={()=>selectAirfield(code)} style={{padding:"10px 14px",cursor:"pointer",borderBottom:"1px solid rgba(255,255,255,0.05)",transition:"background 0.1s"}}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(0,180,255,0.1)"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div>
                        <span style={{fontFamily:"'DM Mono',monospace",fontSize:14,color:"#00B4FF",fontWeight:"bold",marginRight:8}}>{code}</span>
                        <span style={{fontSize:11,color:"#8BCCF0"}}>{a.name}</span>
                        <div style={{fontSize:9,color:"#445566",marginTop:2}}>{a.city} · {a.class}</div>
                      </div>
                      {critCount>0&&<span style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#FF3B3B",background:"rgba(255,59,59,0.12)",border:"1px solid rgba(255,59,59,0.3)",padding:"2px 6px",borderRadius:3,flexShrink:0}}>⚠ {critCount}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {airfield && (
          <div style={{background:"rgba(0,180,255,0.08)",border:"1px solid rgba(0,180,255,0.2)",borderRadius:7,padding:"10px 12px",marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:15,color:"#00B4FF",fontWeight:"bold"}}>{selected}</div>
                <div style={{fontSize:11,color:"#FFFFFF",marginTop:2}}>{airfield.name}</div>
                <div style={{fontSize:9,color:"#8899AA",marginTop:2}}>{airfield.city}</div>
                <div style={{fontSize:9,color:"#445566",marginTop:2}}>{airfield.class} · {airfield.type} · {airfield.elevation.toLocaleString()}ft</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:3,alignItems:"flex-end"}}>
                {["critical","high"].map(s=>{
                  const c=airfield.hazards.filter(h=>h.sev===s).length;
                  if(!c) return null;
                  const sc=SEV[s];
                  return <span key={s} style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:sc.color,background:sc.bg,border:`1px solid ${sc.border}`,padding:"2px 6px",borderRadius:3}}>{c} {s.toUpperCase()}</span>;
                })}
              </div>
            </div>
          </div>
        )}
        <div style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#445566",letterSpacing:"0.12em",marginBottom:6}}>QUICK ACCESS</div>
        <div style={{display:"flex",gap:6,marginBottom:8}}>
          {["florida","phoenix","texas","socal","colorado","uk"].map(r=>(
            <button key={r} onClick={()=>setRegion(r)} style={{flex:1,padding:"5px 3px",borderRadius:5,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:8,background:region===r?"rgba(0,180,255,0.18)":"rgba(255,255,255,0.04)",border:`1px solid ${region===r?"rgba(0,180,255,0.4)":"rgba(255,255,255,0.07)"}`,color:region===r?"#00B4FF":"#8899AA"}}>{r==="florida"?"🌴FL":r==="phoenix"?"☀AZ":r==="texas"?"🤠TX":r==="socal"?"🏙CA":r==="colorado"?"⛰CO":"🇬🇧UK"}</button>
          ))}
        </div>
        <div style={{overflowY:"auto",maxHeight:220}}>
          {fieldsForRegion(region).map(([code,a])=>{
            const critCount=a.hazards.filter(h=>h.sev==="critical").length;
            return (
              <div key={code} onClick={()=>selectAirfield(code)} style={{padding:"7px 10px",borderRadius:6,marginBottom:3,cursor:"pointer",background:selected===code?"rgba(0,180,255,0.12)":"rgba(255,255,255,0.02)",border:`1px solid ${selected===code?"rgba(0,180,255,0.35)":"rgba(255,255,255,0.05)"}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:selected===code?"#00B4FF":"#FFFFFF",fontWeight:"bold",marginRight:6}}>{code}</span>
                  <span style={{fontSize:9,color:"#556677"}}>{a.name.split(" ").slice(0,2).join(" ")}</span>
                </div>
                {critCount>0&&<span style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#FF3B3B",background:"rgba(255,59,59,0.1)",border:"1px solid rgba(255,59,59,0.25)",padding:"1px 5px",borderRadius:2}}>⚠{critCount}</span>}
              </div>
            );
          })}
        </div>
      </div>
      <div style={{padding:"10px 12px",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
        <div style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#445566",letterSpacing:"0.12em",marginBottom:7}}>FLIGHT PHASE</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
          {PHASES.map(p=>(
            <button key={p.id} onClick={()=>setPhase(p.id)} style={{fontSize:8,fontFamily:"'DM Mono',monospace",letterSpacing:"0.06em",padding:"4px 8px",borderRadius:4,cursor:"pointer",background:phase===p.id?"rgba(0,180,255,0.18)":"rgba(255,255,255,0.04)",border:`1px solid ${phase===p.id?"rgba(0,180,255,0.4)":"rgba(255,255,255,0.07)"}`,color:phase===p.id?"#00B4FF":"#FFFFFF"}}>{p.label}</button>
          ))}
        </div>
      </div>
      <div style={{padding:"12px"}}>
        <button onClick={()=>setShowE6B(true)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:"linear-gradient(135deg,rgba(255,215,0,0.16),rgba(255,180,0,0.1))",border:"1px solid rgba(255,215,0,0.4)",borderRadius:8,padding:"12px 10px",color:"#FFD700",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:"bold",letterSpacing:"0.08em"}}>
          🧮 E6B FLIGHT COMPUTER
        </button>
        <button onClick={()=>setShowFRAT(true)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:"linear-gradient(135deg,rgba(0,180,255,0.16),rgba(0,150,255,0.1))",border:"1px solid rgba(0,180,255,0.4)",borderRadius:8,padding:"12px 10px",color:"#00B4FF",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:"bold",letterSpacing:"0.08em",marginTop:8}}>
          🛡 FLIGHT RISK ASSESSMENT
        </button>
      </div>
    </div>
  );

  if (accountType === null) return <AccountTypeScreen onSelect={setAccountType}/>;
  if (accountType === "flightschool" && !opsLoggedIn) return <FlightSchoolLoginScreen
    onLogin={(org,workspace)=>{setOrgName(org);setOpsWorkspace(workspace||"ops");setOpsLoggedIn(true);setShowOpsDashboard((workspace||"ops")==="ops");}}
    onBack={()=>setAccountType(null)}
    persistenceState={persistenceState}
    onReset={resetDemoWorkspace}
    workspaceName={workspaceMeta.name}
  />;
  if (accountType === "flightschool" && opsLoggedIn && opsWorkspace === "admin") return <ClubAdminDashboardScreen
    orgName={orgName}
    people={opsPeople}
    aircraftList={opsAircraftList}
    users={opsUsers}
    setUsers={setOpsUsers}
    adminAudit={opsAdminAudit}
    setAdminAudit={setOpsAdminAudit}
    persistenceState={persistenceState}
    onReset={resetDemoWorkspace}
    onBack={()=>{setOpsLoggedIn(false);setOpsWorkspace(null);setShowOpsDashboard(false);}}
  />;
  if (accountType === "flightschool" && opsLoggedIn && opsWorkspace === "engineering") return <EngineeringDashboardScreen
    orgName={orgName}
    aircraftList={opsAircraftList}
    setAircraftList={setOpsAircraftList}
    persistenceState={persistenceState}
    onReset={resetDemoWorkspace}
    onBack={()=>{setOpsLoggedIn(false);setOpsWorkspace(null);setShowOpsDashboard(false);}}
  />;
  if (accountType === "flightschool" && opsLoggedIn && opsWorkspace === "cfi") return <CfiDashboardScreen
    orgName={orgName}
    people={opsPeople}
    setPeople={setOpsPeople}
    aircraftList={opsAircraftList}
    persistenceState={persistenceState}
    onReset={resetDemoWorkspace}
    onBack={()=>{setOpsLoggedIn(false);setOpsWorkspace(null);setShowOpsDashboard(false);}}
  />;
  if (accountType === "flightschool" && opsLoggedIn && opsWorkspace === "ops" && showOpsDashboard) return <OpsDashboardScreen orgName={orgName}
    people={opsPeople}
    aircraftList={opsAircraftList}
    persistenceState={persistenceState}
    onReset={resetDemoWorkspace}
    onStartBriefing={(person,aircraft)=>{
      if (!evaluateFratEligibility(person,aircraft).allowed) return;
      setOpsPrefill({person,aircraft});
      const seed = buildOpsFratSeed({person,aircraft});
      setFratAnswers(seed.answers); setFratPrefillKeys(seed.keys);
      setFratInitialAnswers(null); setFratControls({}); setFratResidualAnswers({}); setFratReviewComplete(false);
      setShowOpsDashboard(false);setShowWelcome(false);setShowFRAT(true);
    }}
    onContinueToApp={()=>setShowOpsDashboard(false)}
    onBack={()=>{setOpsLoggedIn(false);setOpsWorkspace(null);setShowOpsDashboard(false);}} />;
  if (showWelcome) return <WelcomeScreen onSelect={chooseRegion}/>;
  if (showE6B) return <E6BScreen onClose={()=>{setShowE6B(false);setMenuOpen(false);}}/>;
  if (showFRAT) return <FRATScreen
    onClose={()=>{setShowFRAT(false);setOpsPrefill(null);setMenuOpen(false);}}
    opsPrefill={opsPrefill}
    answers={fratAnswers} setAnswers={setFratAnswers}
    prefillKeys={fratPrefillKeys} setPrefillKeys={setFratPrefillKeys}
    initialAnswers={fratInitialAnswers} setInitialAnswers={setFratInitialAnswers}
    controls={fratControls} setControls={setFratControls}
    residualAnswers={fratResidualAnswers} setResidualAnswers={setFratResidualAnswers}
    reviewComplete={fratReviewComplete} setReviewComplete={setFratReviewComplete}
    onOpenDA={()=>{setShowFRAT(false);setMenuOpen(false);}} />;

  return (
    <div style={{minHeight:"100vh",background:"#050D18",fontFamily:"'Inter',sans-serif",color:"#D0DCE8",display:"flex",flexDirection:"column"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Inter:wght@300;400;500;600;700&family=Bebas+Neue&display=swap');*{box-sizing:border-box;margin:0;padding:0;}::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-track{background:#08121E;}::-webkit-scrollbar-thumb{background:#1A3050;border-radius:2px;}input[type=range]{-webkit-appearance:none;height:5px;border-radius:3px;background:rgba(255,255,255,0.12);}input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:#00B4FF;cursor:pointer;border:2px solid #050D18;}button{touch-action:manipulation;}`}</style>
      <div style={{background:"rgba(3,10,22,0.97)",borderBottom:"1px solid rgba(0,180,255,0.2)",padding:`0 ${isMobile?8:20}px`,display:"flex",alignItems:"center",gap:isMobile?6:10,height:56,backdropFilter:"blur(12px)",position:"sticky",top:0,zIndex:100,flexShrink:0}}>
        {!isDesktop&&<button onClick={()=>setMenuOpen(o=>!o)} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:7,padding:"7px 10px",color:"#8899AA",cursor:"pointer",fontSize:14}}>☰</button>}
        <div style={{display:"flex",alignItems:"center",gap:isMobile?5:9,minWidth:0}}>
          {!isMobile&&<div style={{width:28,height:28,background:"linear-gradient(135deg,#0055DD,#00B4FF)",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>✈</div>}
          <div style={{display:"flex",flexDirection:"column",lineHeight:1}}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:isMobile?15:21,letterSpacing:isMobile?"0.08em":"0.15em",color:"#FFFFFF",whiteSpace:"nowrap"}}>SAFEROUTE <span style={{color:"#00B4FF"}}>ACADEMY</span></div>
            {!isMobile&&<div style={{fontFamily:"'DM Mono',monospace",fontSize:7,color:"#334455",letterSpacing:"0.15em",marginTop:1}}>STUDENT PILOT SAFETY INTELLIGENCE</div>}
          </div>
          <span style={{fontFamily:"'DM Mono',monospace",fontSize:isMobile?7:8,color:"#00C896",background:"rgba(0,200,150,0.12)",border:"1px solid rgba(0,200,150,0.35)",padding:isMobile?"1px 4px":"2px 6px",borderRadius:3,letterSpacing:"0.1em"}}>BETA</span>
        </div>
        <div style={{flex:1}}/>
        <button aria-label="Change location" title="Change location" onClick={()=>setShowWelcome(true)} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:6,padding:isMobile?"6px 8px":"6px 10px",color:"#8899AA",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:"0.05em",marginRight:isMobile?0:6}}>{isMobile?"⟲":"⟲ CHANGE LOCATION"}</button>
        <a aria-label="Send feedback" title="Send feedback" href="https://marchantlaurie-lgtm.github.io/Saferoute-feedback/saferoute_academy_feedback_form.html" target="_blank" rel="noreferrer" style={{background:"rgba(0,180,255,0.1)",border:"1px solid rgba(0,180,255,0.3)",borderRadius:6,padding:isMobile?"6px 8px":"6px 10px",color:"#00B4FF",fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:"0.05em",textDecoration:"none",marginRight:isMobile?0:10}}>{isMobile?"✉":"✉ FEEDBACK"}</a>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:wxLoad?"#FFD700":"#00C896"}}>● {wxLoad?"LOADING":"LIVE"}</span>
      </div>
      <div style={{flex:1,display:"flex",overflow:"hidden",height:"calc(100vh - 56px)"}}>
        {isDesktop?<div style={{width:270,flexShrink:0,overflow:"auto",borderRight:"1px solid rgba(255,255,255,0.06)"}}>{sidebar}</div>:menuOpen&&(
          <div style={{position:"fixed",inset:0,zIndex:3000,display:"flex",isolation:"isolate"}}>
            <div onClick={()=>setMenuOpen(false)} style={{position:"absolute",inset:0,zIndex:0,background:"rgba(0,0,0,0.7)"}}/>
            <div style={{position:"relative",zIndex:1,width:280,height:"100%",overflow:"auto",background:"#06101C",borderRight:"1px solid rgba(0,180,255,0.2)",boxShadow:"12px 0 30px rgba(0,0,0,0.55)"}}>{sidebar}</div>
          </div>
        )}
        <div style={{flex:1,overflow:"auto",padding:isMobile?"12px 12px 80px":"18px 22px"}}>
          <div style={{background:"linear-gradient(135deg,rgba(0,30,60,0.9),rgba(0,15,35,0.9))",border:"1px solid rgba(0,180,255,0.25)",borderRadius:10,padding:isMobile?"14px 16px":"18px 22px",marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:4}}>
                  <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:isMobile?26:32,letterSpacing:"0.1em",color:"#FFFFFF"}}>{selected}</span>
                  <span style={{fontSize:14,color:"#8BCCF0",fontWeight:500}}>{airfield.name}</span>
                </div>
                <div style={{fontSize:11,color:"#556677",marginBottom:8}}>{airfield.city}  ·  <span style={{color:"#00B4FF",fontWeight:600}}>{airfield.class}</span>  ·  {airfield.type}  ·  Elevation <span style={{color:"#FFD700",fontWeight:600}}>{airfield.elevation.toLocaleString()}ft</span></div>
                <div style={{display:"flex",flexWrap:"wrap",gap:5}}>{airfield.runways.map(r=><span key={r} style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#8899AA",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:4,padding:"3px 8px"}}>{r}</span>)}</div>
                <div style={{fontSize:8.5,color:airfield.source?"#00C896":"#FFD700",marginTop:7,lineHeight:1.5}}>
                  {airfield.source ? <>✓ Verified against <a href={airfield.source.url} target="_blank" rel="noreferrer" style={{color:"#00B4FF"}}>{airfield.source.label}</a> · {airfield.source.cycle}</> : <>Reference training summary — verify runways, frequencies, airspace, hours, and NOTAMs in the current <a href={airfield.region==="uk"?UK_AIP:FAA_CHART_SUPPLEMENT_SEARCH} target="_blank" rel="noreferrer" style={{color:"#00B4FF"}}>{airfield.region==="uk"?"UK AIP":"FAA Chart Supplement"}</a> before flight.</>}
                </div>
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {["critical","high","medium"].map(s=>{const count=airfield.hazards.filter(h=>h.sev===s).length;if(!count)return null;const sc=SEV[s];return <div key={s} style={{textAlign:"center",background:sc.bg,border:`1px solid ${sc.border}`,borderRadius:6,padding:"6px 12px"}}><div style={{fontFamily:"'DM Mono',monospace",fontSize:18,color:sc.color,fontWeight:"bold",lineHeight:1}}>{count}</div><div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:sc.color,marginTop:2}}>{s.toUpperCase()}</div></div>;})}
              </div>
            </div>
          </div>
          <WeatherStrip liveWx={liveWx} wxLoad={wxLoad} requestedIcao={selected} weatherIcao={weatherIcao}/>
          {airfield.region==="uk" ? <UkWeatherWidget key={`${selected}:${liveWx?.metar||"loading"}`} airfield={airfield} liveWx={liveWx}/> : <DAWidget key={`${selected}:${liveWx?.metar||"loading"}`} airfield={airfield} liveWx={liveWx}/>}
          <WeatherLayerWidget airfield={airfield} icao={selected} liveWx={liveWx}/>
          <div style={{display:"flex",borderBottom:"2px solid rgba(255,255,255,0.06)",marginBottom:14,overflowX:"auto",gap:2}}>
            {[["hazards",`THREATS (${filteredHazards.length})`],["atc","ATC & AIRSPACE"],["cfi","CFI NOTES"],["brief","W-A-N-T BRIEF"]].map(([tid,label])=>(
              <button key={tid} onClick={()=>setTab(tid)} style={{background:tab===tid?"rgba(0,180,255,0.08)":"none",border:"none",cursor:"pointer",padding:"10px 16px",fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:"0.08em",whiteSpace:"nowrap",color:tab===tid?"#00B4FF":"#FFFFFF",borderBottom:tab===tid?"2px solid #00B4FF":"2px solid transparent",transition:"all 0.15s",marginBottom:"-2px"}}>{label}</button>
            ))}
          </div>
          {tab==="hazards"&&<div>
            <div style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#445566",letterSpacing:"0.15em",marginBottom:10}}>{filteredHazards.length} THREAT{filteredHazards.length!==1?"S":""} FOR {selected} · TAP ANY CARD TO EXPAND</div>
            {filteredHazards.map(h=><HazardCard key={h.id} h={h} expanded={!!expanded[h.id]} onToggle={()=>setExpanded(e=>({...e,[h.id]:!e[h.id]}))}/>)}
          </div>}
          {tab==="atc"&&<div style={{background:"rgba(0,20,45,0.8)",border:"1px solid rgba(0,180,255,0.2)",borderRadius:10,padding:"18px 20px"}}>
            <div style={{fontSize:10,fontFamily:"'DM Mono',monospace",color:"#00B4FF",letterSpacing:"0.15em",marginBottom:12,fontWeight:"bold"}}>📡 ATC & AIRSPACE NOTES</div>
            <pre style={{fontSize:13,color:"#C0D4E8",lineHeight:1.9,whiteSpace:"pre-wrap",fontFamily:"'Inter',sans-serif"}}>{airfield.atcNotes}</pre>
          </div>}
          {tab==="cfi"&&<div style={{background:"rgba(0,40,25,0.6)",border:"1px solid rgba(0,200,150,0.25)",borderRadius:10,padding:"18px 20px"}}>
            <div style={{fontSize:10,fontFamily:"'DM Mono',monospace",color:"#00C896",letterSpacing:"0.15em",marginBottom:12,fontWeight:"bold"}}>📋 CFI BRIEFING NOTES</div>
            <p style={{fontSize:13,color:"#C0D4E8",lineHeight:1.9}}>{airfield.cfiNotes}</p>
          </div>}
          {tab==="brief"&&<div>
            <div style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#445566",letterSpacing:"0.15em",marginBottom:12}}>PRE-FLIGHT BRIEFING · W-A-N-T · {selected}</div>

            {/* W — WEATHER */}
            <div style={{background:"rgba(0,180,255,0.05)",border:"1px solid rgba(0,180,255,0.2)",borderRadius:10,padding:"16px 18px",marginBottom:12}}>
              <div style={{fontSize:11,fontFamily:"'DM Mono',monospace",color:"#00B4FF",letterSpacing:"0.1em",fontWeight:"bold",marginBottom:10}}>🌦 W — WEATHER</div>
              {wxLoad && <div style={{fontSize:11,color:"#556677"}}>Loading live weather…</div>}
              {!wxLoad && !liveWx && <div style={{fontSize:11,color:"#556677"}}>No live weather data available for this field.</div>}
              {!wxLoad && liveWx && <>
                <div style={{fontSize:13,color:"#FFFFFF",lineHeight:1.6,marginBottom:8}}>{interpretMetarShort(liveWx.metar)}</div>
                {briefTafThreats.length>0 ? (
                  <div style={{display:"flex",flexDirection:"column",gap:4}}>
                    {briefTafThreats.map((t,i)=><div key={i} style={{fontSize:12,color:t.color,fontWeight:"500"}}>{t.icon} {t.text}</div>)}
                  </div>
                ) : <div style={{fontSize:11,color:"#556677"}}>No significant forecast hazards flagged in the current TAF.</div>}
              </>}
            </div>

            {/* A — AIRCRAFT & PERFORMANCE */}
            <div style={{background:"rgba(0,180,255,0.05)",border:"1px solid rgba(0,180,255,0.2)",borderRadius:10,padding:"16px 18px",marginBottom:12}}>
              <div style={{fontSize:11,fontFamily:"'DM Mono',monospace",color:"#00B4FF",letterSpacing:"0.1em",fontWeight:"bold",marginBottom:10}}>✈ A — AIRCRAFT & PERFORMANCE</div>
              {!aircraftPerf && <div style={{fontSize:11,color:"#556677"}}>Live temperature not available — check the performance tools once weather loads.</div>}
              {aircraftPerf?.kind==="da" && (
                <div style={{fontSize:13,color:"#FFFFFF",lineHeight:1.7}}>
                  Density altitude: <b style={{color:aircraftPerf.daRisk==="EXTREME"?"#FF3B3B":aircraftPerf.daRisk==="HIGH"?"#FF8C00":aircraftPerf.daRisk==="MODERATE"?"#FFD700":"#00C896"}}>{aircraftPerf.da.toLocaleString()}ft ({aircraftPerf.daRisk})</b>
                  <div style={{fontSize:11,color:"#8899AA",marginTop:4}}>Recalculate takeoff/climb performance rather than assuming sea-level POH numbers — see the full calculator above.</div>
                </div>
              )}
              {aircraftPerf?.kind==="uk" && (
                <div style={{fontSize:13,color:"#FFFFFF",lineHeight:1.7}}>
                  Estimated cloud base: <b>{aircraftPerf.cbAgl.toLocaleString()}ft AGL</b> · Icing risk: <b style={{color:aircraftPerf.icingRisk==="LIKELY"?"#FF3B3B":aircraftPerf.icingRisk==="POSSIBLE"?"#FFD700":"#00C896"}}>{aircraftPerf.icingRisk}</b>
                  <div style={{fontSize:11,color:"#8899AA",marginTop:4}}>{aircraftPerf.hasDew?"":"Dewpoint estimated — not directly reported in this METAR. "}Estimate only — confirm against the actual TAF/METAR and F214/F215 charts.</div>
                </div>
              )}
              <div style={{fontSize:11,color:"#8899AA",marginTop:12,paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.06)",lineHeight:1.6}}>Performance is only part of this section — before flight, also check <b style={{color:"#C0D4E8"}}>aircraft status</b>, the <b style={{color:"#C0D4E8"}}>tech log</b>, and any <b style={{color:"#C0D4E8"}}>MEL (Minimum Equipment List)</b> items with your instructor or dispatcher.</div>
            </div>

            {/* N — NOTAMS */}
            <div style={{background:"rgba(0,180,255,0.05)",border:"1px solid rgba(0,180,255,0.2)",borderRadius:10,padding:"16px 18px",marginBottom:12}}>
              <div style={{fontSize:11,fontFamily:"'DM Mono',monospace",color:"#00B4FF",letterSpacing:"0.1em",fontWeight:"bold",marginBottom:10}}>📋 N — NOTAMS</div>
              <div style={{fontSize:12,color:"#C0D4E8",lineHeight:1.6,marginBottom:10}}>This app doesn't pull live NOTAMs. Check current NOTAMs for {selected} — and any alternates — before every flight.</div>
              <a href={notamLink} target="_blank" rel="noreferrer" style={{display:"inline-block",background:"rgba(0,180,255,0.15)",border:"1px solid rgba(0,180,255,0.4)",borderRadius:6,padding:"7px 14px",color:"#00B4FF",fontFamily:"'DM Mono',monospace",fontSize:10,textDecoration:"none",fontWeight:"bold"}}>{airfield.region==="uk"?"OPEN NATS AIS →":"OPEN FAA NOTAM SEARCH →"}</a>
            </div>

            {/* T — THREATS */}
            <div style={{background:"rgba(0,180,255,0.05)",border:"1px solid rgba(0,180,255,0.2)",borderRadius:10,padding:"16px 18px",marginBottom:16}}>
              <div style={{fontSize:11,fontFamily:"'DM Mono',monospace",color:"#00B4FF",letterSpacing:"0.1em",fontWeight:"bold",marginBottom:10}}>⚠ T — THREATS</div>
              {briefTopHazards.length===0 && <div style={{fontSize:11,color:"#556677"}}>No critical/high hazards recorded for this field — see the HAZARDS tab for the full list.</div>}
              {briefTopHazards.length>0 && (
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {briefTopHazards.map(h=>{
                    const sc = SEV[h.sev];
                    return (
                      <div key={h.id} style={{display:"flex",alignItems:"flex-start",gap:8}}>
                        <span style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:sc.color,background:sc.bg,border:`1px solid ${sc.border}`,padding:"2px 6px",borderRadius:3,flexShrink:0,marginTop:2}}>{sc.label}</span>
                        <div style={{fontSize:12,color:"#C0D4E8",lineHeight:1.5}}><b style={{color:"#FFFFFF"}}>{h.title}</b>{h.why?` — ${h.why}`:""}</div>
                      </div>
                    );
                  })}
                </div>
              )}
              {airfield.hazards.length > briefTopHazards.length && <div style={{fontSize:10,color:"#556677",marginTop:8}}>See the HAZARDS tab for the full list, including medium/low items.</div>}
            </div>

            {/* AI Summary */}
            {!briefing&&!briefLoad&&<div style={{textAlign:"center",padding:"30px 20px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"#334455",marginBottom:6}}>AI SUMMARY</div>
              <div style={{fontSize:11,color:"#223344",marginBottom:16}}>Generate a plain-language narrative pulling the above together</div>
              <button onClick={generateBriefing} style={{background:"rgba(0,180,255,0.18)",border:"1px solid rgba(0,180,255,0.4)",borderRadius:8,padding:"11px 26px",color:"#00B4FF",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:"0.1em",fontWeight:"bold"}}>GENERATE AI SUMMARY →</button>
            </div>}
            {briefLoad&&<div style={{textAlign:"center",padding:"30px",background:"rgba(0,20,40,0.6)",border:"1px solid rgba(0,180,255,0.15)",borderRadius:10}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:"#00B4FF",marginBottom:6}}>Generating summary…</div>
              <div style={{fontSize:10,color:"#334455"}}>Analysing hazards · live METAR · TAF forecast · airspace</div>
            </div>}
            {briefing&&<div style={{background:"rgba(0,15,35,0.8)",border:"1px solid rgba(0,180,255,0.18)",borderRadius:10,padding:"18px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#00B4FF",letterSpacing:"0.1em",fontWeight:"bold"}}>★ AI SUMMARY</div>
                <button onClick={generateBriefing} style={{background:"rgba(0,180,255,0.1)",border:"1px solid rgba(0,180,255,0.3)",borderRadius:5,padding:"5px 12px",color:"#00B4FF",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:9}}>↻ REGENERATE</button>
              </div>
              <pre style={{fontSize:12,color:"#C0D8F0",lineHeight:1.8,whiteSpace:"pre-wrap",fontFamily:"'Inter',sans-serif"}}>{briefing}</pre>
              <div style={{marginTop:12,paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.05)",fontSize:9,color:"#223344",fontFamily:"'DM Mono',monospace"}}>W-A-N-T ABOVE IS BUILT FROM LIVE APP DATA · THIS SUMMARY IS AI-GENERATED · FOR EDUCATIONAL PURPOSES ONLY · NOT A SUBSTITUTE FOR CFI INSTRUCTION</div>
            </div>}
          </div>}
        </div>
      </div>
    </div>
  );
}
