import { useState, useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const BACKEND = "https://saferoute-backend-production.up.railway.app";

async function fetchLiveWeather(icao) {
  try {
    const res = await fetch(`${BACKEND}/weather/${icao}`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

function parseMetarTemp(metar) {
  if (!metar) return null;
  const m = metar.match(/\s(M?\d{2})\/(M?\d{2})\s/);
  if (!m) return null;
  const t = m[1];
  return t.startsWith("M") ? -parseInt(t.slice(1)) : parseInt(t);
}
function parseMetarAltimeter(metar) {
  if (!metar) return 29.92;
  const m = metar.match(/A(\d{4})/);
  return m ? parseInt(m[1]) / 100 : 29.92;
}
function parseMetarDewpoint(metar) {
  if (!metar) return null;
  const m = metar.match(/\s(M?\d{2})\/(M?\d{2})\s/);
  if (!m) return null;
  const d = m[2];
  return d.startsWith("M") ? -parseInt(d.slice(1)) : parseInt(d);
}
function parseMetarWind(metar) {
  if (!metar) return null;
  const m = metar.match(/(\d{3}|VRB)(\d{2,3})(G(\d{2,3}))?KT/);
  if (!m) return null;
  return { dir:m[1], spd:parseInt(m[2]), gust:m[4]?parseInt(m[4]):null };
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
function interpretMetarShort(metar) {
  if (!metar) return "No data";
  const out = [];
  const wind = parseMetarWind(metar);
  if (wind) out.push(`${wind.dir==="VRB"?"VRB":wind.dir+"°"} ${wind.spd}kt${wind.gust?` G${wind.gust}kt`:""}`);
  if (metar.includes("CAVOK")) out.push("CAVOK");
  else {
    if (/TSRA|\+TS/.test(metar)) out.push("THUNDERSTORM");
    else if (/\bTS\b/.test(metar)) out.push("TS");
    if (/\bRA\b/.test(metar)) out.push("Rain");
    if (/\bFG\b/.test(metar)) out.push("Fog");
    if (/\bBR\b/.test(metar)) out.push("Mist");
    const clouds = [...metar.matchAll(/(FEW|SCT|BKN|OVC)(\d{3})/g)];
    if (clouds.length) out.push(clouds.map(c=>`${c[1]} ${parseInt(c[2])*100}ft`).join(" "));
  }
  const temp = parseMetarTemp(metar);
  if (temp !== null) out.push(`${temp}°C`);
  return out.join(" · ") || metar.slice(0,60);
}
function calcDensityAltitude(elevFt, tempC, altimInHg=29.92) {
  const pressureAlt = elevFt + (29.92-altimInHg)*1000;
  const isaTemp = 15-(elevFt/1000)*1.98;
  return Math.round(pressureAlt+120*(tempC-isaTemp));
}

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
    cfiNotes:"KDAB is excellent for Class C introduction. Focus on communication requirements and traffic awareness in the ERAU environment.",
  },
  KVRB:{ name:"Vero Beach Regional Airport", city:"Vero Beach, FL", elevation:24, class:"Class D", type:"Towered", runways:["04/22 — 7,314ft","11L/29R — 4,000ft","11R/29L — 3,301ft"], region:"florida", weather_icao:"KVRB",
    hazards:[
      {id:"BIRDS",phase:["takeoff","landing","pattern"],sev:"critical",icon:"🦅",title:"Severe Bird Strike Risk — Atlantic Flyway",why:"Multiple documented strikes per year at this field.",detail:"Vero Beach sits on the Atlantic Flyway — a major migratory bird corridor. Vultures, pelicans, egrets, and osprey are common on and around the field. Scan final approach and departure paths carefully. Report all bird activity to tower. Bird strikes have caused engine failures here."},
      {id:"CB",phase:["all"],sev:"critical",icon:"⛈",title:"Afternoon Thunderstorms — Rapid Development",why:"Florida CB activity is some of the fastest-developing in the world.",detail:"The Florida pattern in summer: clear mornings, cumulus building by 11:00, storms by 13:00-14:00. Storms can go from clear sky to lightning in 20 minutes. Check the TAF before every departure. If TSRA is forecast within your planned flight window, delay or cancel."},
      {id:"SHORT",phase:["takeoff","landing"],sev:"high",icon:"🛬",title:"Short Training Runways",detail:"Runway 11R/29L is 3,301ft — very short for student training. Know your aircraft's demonstrated distances and add a 50% safety factor."},
      {id:"CROSSING",phase:["pattern","all"],sev:"medium",icon:"📻",title:"Multi-School Pattern / Crossing Operations",detail:"Multiple flight schools operate at VRB including Skyborne. With aircraft at different skill levels sharing the pattern, expect non-standard spacing. Announce clearly, look before every turn."},
    ],
    atcNotes:"Tower 119.4 · Ground 121.9 · CTAF 119.4 (when tower closed)",
    cfiNotes:"Bird strike risk at VRB is genuinely serious. The 13:00 rule for summer afternoon flights should be non-negotiable. Brief the MOA status check before every cross-country departure.",
  },
  KFXE:{ name:"Fort Lauderdale Executive Airport", city:"Fort Lauderdale, FL", elevation:13, class:"Class D", type:"Towered", runways:["09/27 — 4,000ft","13/31 — 6,001ft"], region:"florida", weather_icao:"KFXE",
    hazards:[
      {id:"CLASS_B",phase:["all"],sev:"critical",icon:"📡",title:"FLL Class B — Do Not Climb Above 1,200ft Without Clearance",why:"Students have received certificate enforcement actions for inadvertent Class B entry here.",detail:"Fort Lauderdale-Hollywood Class B airspace begins at 1,200ft MSL directly above KFXE. Do not climb above 1,200ft without an explicit Class B clearance from Miami Approach. Enforcement actions have been taken here."},
      {id:"CB",phase:["all"],sev:"critical",icon:"⛈",title:"Afternoon Thunderstorms — Rapid Development",detail:"South Florida CB development is among the fastest in the world. Check TAF. Ground by 13:00 in summer."},
      {id:"TRAFFIC",phase:["pattern","all"],sev:"high",icon:"✈",title:"Extremely High Traffic — Multi-School Parallel Ops",detail:"KFXE handles very high training volumes. Multiple schools operate simultaneously. Extended downwind instructions are common. Never rush a clearance."},
      {id:"MULTI",phase:["pattern","all"],sev:"high",icon:"📻",title:"Non-Native English Readbacks",detail:"KFXE hosts many international students. Readbacks may be unclear or incomplete. Monitor all traffic calls carefully."},
    ],
    atcNotes:"Tower 128.025 · Ground 121.9 · Miami Approach 124.15\nDo NOT climb above 1,200ft without explicit Class B clearance.",
    cfiNotes:"Class B altitude discipline is the defining brief at FXE — say it explicitly every flight: 'We do not climb above 1,200ft without a clearance.'",
  },
  KPMP:{ name:"Pompano Beach Airpark", city:"Pompano Beach, FL", elevation:19, class:"Class D", type:"Towered", runways:["15/33 — 3,600ft","06/24 — 2,800ft"], region:"florida", weather_icao:"KPMP",
    hazards:[
      {id:"CLASS_B",phase:["all"],sev:"critical",icon:"📡",title:"FLL Class B — Floor as Low as 1,000ft",why:"KPMP sits directly under the tightest part of FLL's Class B.",detail:"The FLL Class B floor at KPMP can be as low as 1,000ft MSL. Know the exact Class B floor in your departure direction before taxiing. Students have received enforcement actions here."},
      {id:"SHORT",phase:["takeoff","landing"],sev:"critical",icon:"🛬",title:"2,800ft Runway — Extremely Short",why:"One of the shortest in regular commercial training use.",detail:"Runway 06/24 is 2,800ft — marginal even in a Cessna 172 with standard technique. Calculate your numbers. If the runway is wet, add 15%. If you are fast over the threshold, go around."},
      {id:"PATTERN",phase:["pattern"],sev:"high",icon:"✈",title:"Non-Standard Pattern Geometry",detail:"KPMP's pattern is constrained by the Class B floor and runway layout. Study the airport diagram and receive a thorough CFI brief before first solo here."},
      {id:"CB",phase:["all"],sev:"high",icon:"⛈",title:"Afternoon Thunderstorms",detail:"South Florida CB — plan morning flights, ground by 13:00 in summer. Check TAF."},
    ],
    atcNotes:"Tower 134.95 · Ground 121.9 · Miami Approach 124.15\nClass B floor varies by sector — confirm before every departure.",
    cfiNotes:"Pompano is known as one of Florida's 'gotcha' fields. Short runway, Class B floor, non-standard pattern — all need specific briefing.",
  },
  KFPR:{ name:"Treasure Coast International", city:"Fort Pierce, FL", elevation:25, class:"Class D", type:"Towered", runways:["14/32 — 4,000ft","09/27 — 6,492ft"], region:"florida", weather_icao:"KFPR",
    hazards:[
      {id:"BIRDS",phase:["takeoff","landing","pattern"],sev:"high",icon:"🦅",title:"Atlantic Flyway Bird Strike Risk",detail:"Fort Pierce on the Atlantic coast is in the migration corridor. Vultures, egrets, and migratory birds are common. Scan finals and departures carefully."},
      {id:"CB",phase:["all"],sev:"high",icon:"⛈",title:"Afternoon Thunderstorms — Sea Breeze Convergence",detail:"Indian River County sees sea breeze convergence between Atlantic and Gulf. Plan to land by 13:00 in summer. Check TAF for TSRA."},
      {id:"MOA",phase:["departure"],sev:"high",icon:"📡",title:"Avon Park MOA / Restricted Areas",detail:"Avon Park MOA is active west of KFPR. Check NOTAM status before all cross-country departures."},
      {id:"MULTI",phase:["pattern","all"],sev:"medium",icon:"📻",title:"Multi-School Pattern Ops",detail:"Multiple schools including Skyborne based at KFPR. Announce all positions."},
    ],
    atcNotes:"Tower 126.0 · Ground 121.9\nCheck MOA/TFR status before all departures.",
    cfiNotes:"KFPR is a well-organised training environment. Key focus: MOA awareness and weather decision-making.",
  },
  KTMB:{ name:"Miami Executive Airport (Tamiami)", city:"Miami, FL", elevation:8, class:"Class D", type:"Towered", runways:["09L/27R — 5,000ft","09R/27L — 4,007ft","13/31 — 3,897ft"], region:"florida", weather_icao:"KTMB",
    hazards:[
      {id:"CLASS_B",phase:["all"],sev:"critical",icon:"📡",title:"Miami Class B — Multi-Sector Complex Geometry",why:"Miami's Class B has different floors in different directions from KTMB.",detail:"Miami Class B has multiple sectors with different floor altitudes. There is no single altitude limit — it depends which direction you are flying. Miami Approach 125.5 (northbound), 119.75 (southbound)."},
      {id:"BIRDS",phase:["takeoff","landing"],sev:"critical",icon:"🦅",title:"Everglades Wildlife — Extremely High Bird Activity",why:"Adjacent to Everglades — one of the most biodiverse areas in North America.",detail:"KTMB is immediately adjacent to Everglades National Park. Bird strike rates at Tamiami are among the highest in Florida. Scan every approach and departure carefully."},
      {id:"CB",phase:["all"],sev:"critical",icon:"⛈",title:"Afternoon Thunderstorms — Everglades Convergence",detail:"Sea breeze convergence between Biscayne Bay and the Everglades concentrates storm activity near KTMB. Ground by 12:30 in summer."},
      {id:"ADIZ",phase:["all"],sev:"high",icon:"🔒",title:"Florida ADIZ — Offshore Flight Restriction",detail:"The Florida ADIZ begins 12nm offshore. Do not fly over the ocean without a DVFR flight plan and CFI brief on ADIZ procedures."},
    ],
    atcNotes:"Tower 132.075 · Ground 121.9 · Miami Approach 125.5 (N), 119.75 (S)",
    cfiNotes:"Tamiami's Class B geometry is complex — brief it sector by sector. Everglades bird risk is genuine and high.",
  },
  KSRQ:{ name:"Sarasota-Bradenton International", city:"Sarasota, FL", elevation:30, class:"Class C", type:"Towered", runways:["14/32 — 9,500ft","04/22 — 5,006ft"], region:"florida", weather_icao:"KSRQ",
    hazards:[
      {id:"CLASS_C",phase:["all"],sev:"high",icon:"📡",title:"Class C Operations",detail:"SRQ is Class C. Two-way communication with Sarasota Approach required before entering the Class C surface area."},
      {id:"CB",phase:["all"],sev:"high",icon:"⛈",title:"Gulf Coast Afternoon Thunderstorms",detail:"Tampa Bay/Gulf sea breeze. Check TAF. Ground by 13:00 in summer."},
      {id:"BIRDS",phase:["takeoff","landing"],sev:"high",icon:"🦅",title:"Gulf Coast Bird Activity",detail:"Sarasota Bay wetlands adjacent. Wading birds and seabirds common on approach paths."},
    ],
    atcNotes:"Approach 119.15 · Tower 118.05 · Ground 121.9",
    cfiNotes:"SRQ is ideal for Class C introduction — less complex than Miami/FLL, professional environment.",
  },
  KFMY:{ name:"Page Field", city:"Fort Myers, FL", elevation:17, class:"Class D", type:"Towered", runways:["05/23 — 6,397ft","13/31 — 4,116ft"], region:"florida", weather_icao:"KFMY",
    hazards:[
      {id:"CB",phase:["all"],sev:"critical",icon:"⛈",title:"Afternoon Thunderstorms — Gulf & Atlantic Convergence",why:"Fort Myers sits between Gulf and Atlantic sea breezes — storms concentrate here.",detail:"Southwest Florida is one of the most thunderstorm-prone areas in the US. Sea breeze from both Gulf and Atlantic coasts converge near Fort Myers creating intense afternoon CB activity. June-September: be on the ground by 13:00 local."},
      {id:"BIRDS",phase:["takeoff","landing","pattern"],sev:"high",icon:"🦅",title:"Bird Strike Risk — Caloosahatchee River Corridor",detail:"Page Field sits adjacent to the Caloosahatchee River. Wading birds, osprey, vultures and egrets are common on and near the runway."},
      {id:"RSWS",phase:["departure","all"],sev:"high",icon:"📡",title:"KRSW Class C Proximity",detail:"Southwest Florida International Class C airspace is immediately north of KFMY. Northbound departures can enter Class C within seconds of takeoff. Establish contact with Fort Myers Approach before climbing northbound."},
      {id:"MULTI",phase:["pattern","all"],sev:"medium",icon:"📻",title:"Multi-School Pattern Operations",detail:"Multiple training schools based at KFMY including Paragon Flight. Announce all pattern positions."},
    ],
    atcNotes:"Tower 119.4 · Ground 121.9 · Fort Myers Approach 124.0\nRSW Class C to the north — confirm clearance before climbing northbound.",
    cfiNotes:"KFMY has intersecting runways — reinforce runway crossing discipline. Gulf/Atlantic convergence makes afternoon weather particularly fast-developing.",
  },
  KGNV:{ name:"Gainesville Regional Airport", city:"Gainesville, FL", elevation:152, class:"Class C", type:"Towered", runways:["10/28 — 7,503ft","07/25 — 3,002ft"], region:"florida", weather_icao:"KGNV",
    hazards:[
      {id:"CLASS_C",phase:["all"],sev:"high",icon:"📡",title:"Class C Operations",detail:"KGNV is Class C. Establish two-way communication with Gainesville Approach before entering."},
      {id:"SHORT",phase:["takeoff","landing"],sev:"high",icon:"🛬",title:"Short Runway 07/25 — 3,002ft",detail:"Runway 07/25 is 3,002ft — very short. Know your demonstrated distances before accepting this runway. Runway 10/28 at 7,503ft is the primary training runway."},
      {id:"CB",phase:["all"],sev:"high",icon:"⛈",title:"North Florida Thunderstorms",detail:"Gainesville sees both Gulf and Atlantic weather. Afternoon CB activity June-September. Check TAF."},
      {id:"BIRDS",phase:["takeoff","landing"],sev:"medium",icon:"🦅",title:"Paynes Prairie Wildlife Corridor",detail:"Paynes Prairie wildlife preserve is adjacent. Sandhill cranes, wading birds and raptors are common."},
    ],
    atcNotes:"Approach 124.15 · Tower 118.5 · Ground 121.9",
    cfiNotes:"KGNV is a good Class C introduction field. Short runway 07/25 needs specific briefing.",
  },
  KVNC:{ name:"Venice Municipal Airport", city:"Venice, FL", elevation:18, class:"Class D", type:"Towered", runways:["05/23 — 5,000ft","13/31 — 3,580ft"], region:"florida", weather_icao:"KVNC",
    hazards:[
      {id:"BIRDS",phase:["takeoff","landing","pattern"],sev:"critical",icon:"🦅",title:"Severe Bird Strike Risk — Gulf Coast Flyway",why:"Venice has documented multiple bird strikes including engine FOD.",detail:"Venice Airport is surrounded by Gulf Coast wetlands and is on a major migratory bird route. Vultures are particularly common and have caused engine FOD. Scan all approaches and departures aggressively."},
      {id:"CB",phase:["all"],sev:"high",icon:"⛈",title:"Gulf Coast Afternoon Thunderstorms",detail:"Gulf sea breeze CB development — rapid in summer. Check TAF for TSRA forecast."},
      {id:"CROSS",phase:["takeoff","landing"],sev:"high",icon:"🛬",title:"Intersecting Runway Operations",detail:"Runways 05/23 and 13/31 intersect. Confirm runway crossing clearances carefully."},
    ],
    atcNotes:"Tower 119.05 · Ground 121.9\nIntersecting runways — confirm all crossing clearances.",
    cfiNotes:"Venice has a high bird strike record. Intersecting runways need specific crossing discipline briefing.",
  },
  KBOW:{ name:"Bartow Executive Airport", city:"Bartow, FL", elevation:125, class:"Class D", type:"Towered", runways:["09L/27R — 5,000ft","09R/27L — 5,001ft"], region:"florida", weather_icao:"KBOW",
    hazards:[
      {id:"PARALLEL",phase:["takeoff","landing"],sev:"critical",icon:"⚠",title:"Parallel Runway Confusion — Equal Length",why:"Both runways nearly identical — wrong runway acceptance is documented.",detail:"KBOW has parallel runways of almost equal length. Students frequently confuse 09L/27R and 09R/27L. Read the runway number on the pavement before every lineup. Confirm with CFI."},
      {id:"CB",phase:["all"],sev:"high",icon:"⛈",title:"Central Florida Afternoon Thunderstorms",detail:"Central Florida inland heat convection — storms develop rapidly. Morning flights preferred in summer."},
      {id:"MULTI",phase:["pattern","all"],sev:"high",icon:"📻",title:"High Volume Multi-School Operations",why:"Bartow is a major training hub.",detail:"KBOW hosts very high training volumes — multiple schools operate simultaneously on parallel runways. Radio discipline and visual lookout are critical."},
    ],
    atcNotes:"Tower 123.8 · Ground 121.9\nParallel runway ops — confirm assigned runway before every lineup.",
    cfiNotes:"Bartow's equal-length parallel runways are a known student confusion point. Reinforce runway readback discipline every flight.",
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
    cfiNotes:"PGD is a good primary training field — long runway, professional ATC. Charlotte convergence zone weather needs specific briefing.",
  },
  KSPG:{ name:"Albert Whitted Airport", city:"St Petersburg, FL", elevation:7, class:"Class D", type:"Towered", runways:["07/25 — 3,326ft","18/36 — 2,864ft"], region:"florida", weather_icao:"KSPG",
    hazards:[
      {id:"CLASS_B",phase:["all"],sev:"critical",icon:"📡",title:"Tampa Class B — Immediate Proximity",why:"Tampa International Class B shelf begins very close overhead.",detail:"KSPG is directly under Tampa International's Class B airspace. The Class B floor begins at 1,200ft MSL directly above the field. Do not climb above your ATC-assigned altitude without explicit Class B clearance from Tampa Approach."},
      {id:"SHORT",phase:["takeoff","landing"],sev:"critical",icon:"🛬",title:"Very Short Runways — Water on All Sides",why:"Both runways are short with Tampa Bay at multiple ends.",detail:"Runway 18/36 is only 2,864ft with Tampa Bay at both ends. Runway 07/25 is 3,326ft. Stabilised approach is mandatory. Any fast approach leaves very limited margin."},
      {id:"CB",phase:["all"],sev:"high",icon:"⛈",title:"Tampa Bay Thunderstorm Convergence",detail:"Tampa Bay is a known thunderstorm convergence zone. Ground by 12:30 in summer."},
    ],
    atcNotes:"Tower 124.1 · Ground 121.9 · Tampa Approach 119.9\nClass B begins at 1,200ft — do not climb without clearance.",
    cfiNotes:"Albert Whitted is challenging — Class B overhead, short runways, water surroundings. Not suitable for early solo without thorough briefing on all three hazards.",
  },
  KIMM:{ name:"Immokalee Regional Airport", city:"Immokalee, FL", elevation:37, class:"Uncontrolled", type:"Non-Towered", runways:["09/27 — 5,000ft","18/36 — 4,999ft","13/31 — 3,200ft"], region:"florida", weather_icao:"KIMM",
    hazards:[
      {id:"NONTOW",phase:["all"],sev:"critical",icon:"📻",title:"Non-Towered — Self-Announce Required",why:"No ATC — all separation is pilot responsibility.",detail:"KIMM has no control tower. All pilots must self-announce on CTAF 122.8. Announce at every standard reporting point: 10nm inbound, downwind, base, final, and clear of runway."},
      {id:"CB",phase:["all"],sev:"critical",icon:"⛈",title:"Southwest Florida Thunderstorms + No Tower Warning",why:"No tower means no weather alerts — you must self-brief.",detail:"At a non-towered field, there is no ATC to warn you about developing weather. You are responsible for your own weather awareness. Monitor weather radar on ForeFlight/Garmin Pilot. Set a personal 13:00 turn-around rule in summer."},
      {id:"AGRIC",phase:["pattern","all"],sev:"high",icon:"✈",title:"Agricultural / Crop-Dusting Traffic",detail:"Immokalee area has active agricultural aviation operating at very low altitude. Maintain vigilant lookout below pattern altitude."},
    ],
    atcNotes:"CTAF 122.8 — No tower.\nNo ATC weather service — monitor weather independently.",
    cfiNotes:"KIMM is excellent for introducing non-towered operations. Key lesson: all separation is pilot responsibility. Weather self-briefing discipline is critical.",
  },
  KDED:{ name:"DeLand Municipal Airport", city:"DeLand, FL", elevation:79, class:"Uncontrolled", type:"Non-Towered", runways:["12/30 — 5,000ft","05/23 — 3,702ft"], region:"florida", weather_icao:"KDED",
    hazards:[
      {id:"JUMP",phase:["all"],sev:"critical",icon:"🪂",title:"Active Parachute Drop Zone — CRITICAL",why:"DeLand is one of the busiest skydiving drop zones in the USA.",detail:"KDLED is home to Skydive DeLand — one of the world's busiest skydiving operations. Jumpers and jump aircraft are in the air continuously during operating hours. Jumpers have no radio and are in freefall at speeds exceeding 120mph. Do not operate here without a thorough CFI brief on skydive operations."},
      {id:"NONTOW",phase:["all"],sev:"high",icon:"📻",title:"Non-Towered — Jump Aircraft Priority",detail:"No ATC. CTAF 122.9. Jump aircraft announce exit altitude and jumper count. All other traffic must accommodate."},
      {id:"CB",phase:["all"],sev:"high",icon:"⛈",title:"Central Florida Thunderstorms",detail:"Central Florida afternoon CB — check TAF, morning flights preferred."},
    ],
    atcNotes:"CTAF 122.9 — No tower.\nSkydive DeLand actively operating — monitor jump aircraft calls continuously.",
    cfiNotes:"DeLand is the most important non-towered skydiving airport in Florida for student awareness. Do not send students here without a comprehensive parachute operations brief.",
  },
  KZPH:{ name:"Zephyrhills Municipal Airport", city:"Zephyrhills, FL", elevation:90, class:"Uncontrolled", type:"Non-Towered", runways:["05/23 — 5,001ft","18/36 — 4,002ft"], region:"florida", weather_icao:"KZPH",
    hazards:[
      {id:"JUMP",phase:["all"],sev:"critical",icon:"🪂",title:"Active Parachute Operations",why:"ZPH is a major skydiving centre — jumpers in freefall have no radio.",detail:"Zephyrhills is home to Skydive City — a major drop zone. Jump aircraft operate continuously. Monitor CTAF 122.8 for jump aircraft departure and jumper-in-air announcements."},
      {id:"NONTOW",phase:["all"],sev:"high",icon:"📻",title:"Non-Towered Airport",detail:"No ATC. Self-announce all positions on CTAF 122.8."},
      {id:"CB",phase:["all"],sev:"high",icon:"⛈",title:"Central Florida Thunderstorms",detail:"Tampa Bay/central Florida CB — afternoon storms common. Check TAF."},
    ],
    atcNotes:"CTAF 122.8 — No tower.\nSkydive City actively operating — monitor jump aircraft calls.",
    cfiNotes:"Same brief as DeLand — skydiving operations are the defining hazard.",
  },
  KTIX:{ name:"Space Coast Regional Airport", city:"Titusville, FL", elevation:34, class:"Class D", type:"Towered", runways:["18/36 — 7,295ft","09/27 — 4,001ft"], region:"florida", weather_icao:"KTIX",
    hazards:[
      {id:"KSC",phase:["all"],sev:"critical",icon:"📡",title:"Kennedy Space Center — Launch TFRs",why:"KSC is directly adjacent — launch TFRs activate with short notice.",detail:"Titusville is immediately west of Kennedy Space Center. Launch TFRs can extend to FL180 and activate within hours. Check NOTAMs before every flight. This is not academic — enforcement actions have been taken against pilots who entered active KSC TFRs."},
      {id:"CB",phase:["all"],sev:"high",icon:"⛈",title:"Space Coast Thunderstorms",detail:"Atlantic coast CB plus sea breeze effects near KSC. Check TAF."},
      {id:"BIRDS",phase:["takeoff","landing"],sev:"high",icon:"🦅",title:"Merritt Island Wildlife Refuge",detail:"Merritt Island NWR is adjacent — one of the most diverse wildlife refuges in the eastern USA. Birds common on and near runways at all times."},
    ],
    atcNotes:"Tower 120.5 · Ground 121.9\nCheck KSC launch NOTAM before every flight — TFR to FL180 possible.",
    cfiNotes:"TIX is excellent for cross-country training with long runway. KSC TFR awareness is the critical brief — check it every flight.",
  },
  KAPF:{ name:"Naples Municipal Airport", city:"Naples, FL", elevation:8, class:"Class D", type:"Towered", runways:["05/23 — 5,000ft","14/32 — 5,000ft"], region:"florida", weather_icao:"KAPF",
    hazards:[
      {id:"CB",phase:["all"],sev:"critical",icon:"⛈",title:"Southwest Florida Thunderstorm Capital",why:"Naples area has some of the highest CB frequency in the USA.",detail:"Southwest Florida is among the most thunderstorm-active regions in the world. Naples sees near-daily afternoon storms June-September. Check TAF before every departure. 13:00 ground rule is non-negotiable."},
      {id:"BIRDS",phase:["takeoff","landing"],sev:"high",icon:"🦅",title:"Everglades / Gulf Coast Bird Activity",detail:"Naples is between the Gulf and Everglades — extremely high bird activity. Vultures common on runways. Report all wildlife to tower."},
      {id:"CROSS",phase:["takeoff","landing"],sev:"high",icon:"🛬",title:"Intersecting Runway Operations",detail:"Runways 05/23 and 14/32 intersect. Confirm all crossing clearances. Never cross active runway without explicit ATC clearance."},
    ],
    atcNotes:"Tower 120.95 · Ground 121.9 · Fort Myers Approach 119.9",
    cfiNotes:"Naples has high bird activity and some of Florida's worst afternoon CB development. Both hazards need specific daily briefing.",
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
    cfiNotes:"Deer Valley's parallel runways are the #1 student confusion point. DA briefing is non-negotiable before every summer flight.",
  },
  KFFZ:{ name:"Falcon Field Airport", city:"Mesa, AZ", elevation:1394, class:"Class D", type:"Towered", runways:["04L/22R — 3,799ft","04R/22L — 5,101ft"], region:"phoenix", weather_icao:"KFFZ",
    hazards:[
      {id:"DA",phase:["takeoff","departure"],sev:"critical",icon:"🌡",title:"Extreme Density Altitude + Short Runway Trap",why:"Short runway combined with high DA is a documented accident cause.",detail:"Runway 04L is only 3,799ft — short even in normal conditions. In summer heat with DA exceeding 4,000ft, takeoff roll and obstacle clearance performance are dramatically reduced. Students should use 04R/22L (5,101ft) by default in summer."},
      {id:"CLASS_B",phase:["departure","all"],sev:"critical",icon:"📡",title:"Phoenix Sky Harbor Class B Proximity",why:"Inadvertent Class B entry is a certificate-action offence.",detail:"Phoenix Sky Harbor Class B airspace shelf begins at 2,000ft MSL in some sectors near KFFZ. Do not climb above your assigned altitude without an explicit Class B clearance from Phoenix Approach."},
      {id:"PARALLEL",phase:["takeoff","landing"],sev:"high",icon:"⚠",title:"Parallel Runway Confusion",detail:"Same parallel runway risk as KDVT. Read the runway number on the surface before every lineup."},
      {id:"DUST",phase:["all"],sev:"high",icon:"🌪",title:"Haboob Risk",detail:"Same Phoenix haboob hazard as all valley fields. Land immediately at first sign of approaching dust wall."},
    ],
    atcNotes:"Tower 132.85 · Ground 121.9 · Phoenix Approach 124.0 (departing east)",
    cfiNotes:"Short runway 04L is the key trap at Falcon — reinforce runway selection in hot weather. Class B proximity is the second critical brief.",
  },
  KCHD:{ name:"Chandler Municipal Airport", city:"Chandler, AZ", elevation:1243, class:"Class D", type:"Towered", runways:["04L/22R — 4,900ft","04R/22L — 5,600ft"], region:"phoenix", weather_icao:"KCHD",
    hazards:[
      {id:"DA",phase:["takeoff","departure"],sev:"critical",icon:"🌡",title:"Extreme Density Altitude",detail:"At 1,243ft with Phoenix summer heat, DA regularly exceeds 4,500ft. Performance calculations mandatory."},
      {id:"AIRSPACE",phase:["all"],sev:"critical",icon:"📡",title:"Williams Gateway (KIWA) Class C — Immediately Adjacent",why:"KIWA Class C shelf begins very close to KCHD traffic patterns.",detail:"Phoenix-Mesa Gateway Class C starts immediately east of KCHD. An eastbound departure can penetrate KIWA's Class C shelf within seconds of takeoff. Establish contact with Williams Gateway Approach 119.5 before climbing eastbound."},
      {id:"MULTI",phase:["pattern","all"],sev:"high",icon:"📻",title:"Multi-School / Non-Native Readbacks",detail:"Multiple flight schools operate at KCHD simultaneously. International students and non-native English speakers are common."},
      {id:"DUST",phase:["all"],sev:"high",icon:"🌪",title:"Haboob Risk",detail:"Standard Phoenix haboob hazard. Land and tie down immediately."},
    ],
    atcNotes:"Tower 132.35 · Ground 121.9 · Williams Gateway Approach 119.5 (eastbound departures)",
    cfiNotes:"KIWA Class C proximity is the defining hazard at Chandler — students have entered Class C inadvertently on eastbound departures.",
  },
  KIWA:{ name:"Phoenix-Mesa Gateway Airport", city:"Mesa, AZ", elevation:1382, class:"Class C", type:"Towered", runways:["12L/30R — 10,401ft","12R/30L — 10,201ft"], region:"phoenix", weather_icao:"KIWA",
    hazards:[
      {id:"CLASS_C",phase:["all"],sev:"critical",icon:"📡",title:"Class C — Two-Way Communication Required",why:"This is the most commonly misunderstood airspace rule for student pilots.",detail:"You MUST establish two-way radio communication with KIWA Approach BEFORE entering Class C airspace — this means ATC must use your callsign in response. 'N12345, standby' counts. 'Traffic, standby' does NOT."},
      {id:"DA",phase:["takeoff","departure"],sev:"critical",icon:"🌡",title:"Extreme Density Altitude",detail:"Long runways can create false security. Even with 10,000ft available, a 4,500ft DA significantly reduces climb performance."},
      {id:"JETS",phase:["pattern","landing"],sev:"high",icon:"✈",title:"Jet Traffic — Wake Turbulence Risk",why:"Airline training jets share runways with GA training aircraft.",detail:"KIWA hosts Lufthansa and CAE airline training in jets alongside GA training. Wake turbulence from a departing jet can flip a light training aircraft. Stay above the jet's flight path on approach."},
      {id:"MULTI",phase:["all"],sev:"high",icon:"📻",title:"Multi-School / Non-Native Readbacks",detail:"KIWA hosts international training programmes. Non-native English readbacks are common. Monitor radio carefully."},
    ],
    atcNotes:"Approach 119.5 · Tower 118.7 · Ground 121.9\nMandatory Class C contact before entering. Wake turbulence separation from jets — ask ATC if unsure.",
    cfiNotes:"KIWA is excellent for introducing Class C operations. Focus the brief on the two-way communication requirement and wake turbulence from airline training jets.",
  },
  KGYR:{ name:"Phoenix Goodyear Airport", city:"Goodyear, AZ", elevation:968, class:"Class D", type:"Towered", runways:["03/21 — 8,500ft","21L/03R — 7,800ft"], region:"phoenix", weather_icao:"KGYR",
    hazards:[
      {id:"DA",phase:["takeoff","departure"],sev:"critical",icon:"🌡",title:"Extreme Density Altitude",detail:"Phoenix heat at 968ft elevation — DA can exceed 4,500ft in summer. Long runways give false security — climb performance is the critical constraint."},
      {id:"MILITARY",phase:["all"],sev:"high",icon:"📡",title:"Luke AFB MOA and Restricted Areas",why:"Luke Air Force Base is immediately adjacent with active military training airspace.",detail:"Luke AFB is immediately north of KGYR. Luke's MOA and Restricted Areas are frequently active with F-35 training. Do not depart northbound without checking Luke Restricted Area status."},
      {id:"DUST",phase:["all"],sev:"high",icon:"🌪",title:"Haboob / Dust Storm",detail:"Standard Phoenix haboob risk. Land immediately and tie down at first sign of approaching dust wall."},
      {id:"MULTI",phase:["pattern","all"],sev:"high",icon:"📻",title:"Multi-School / Non-Native Readbacks",detail:"Multiple international training programmes at GYR. Non-native English readbacks common."},
    ],
    atcNotes:"Tower 133.4 · Ground 121.9 · Luke Approach 124.5\nConfirm Luke restricted area status before northbound departures.",
    cfiNotes:"Goodyear's Luke AFB adjacency is the key brief — reinforce restricted area boundaries before every flight.",
  },
  KSDL:{ name:"Scottsdale Airport", city:"Scottsdale, AZ", elevation:1510, class:"Class D", type:"Towered", runways:["03/21 — 8,249ft","21L/03R — 7,800ft"], region:"phoenix", weather_icao:"KSDL",
    hazards:[
      {id:"DA",phase:["takeoff","departure"],sev:"critical",icon:"🌡",title:"Extreme Density Altitude — Elevated Field",detail:"At 1,510ft with Phoenix summer heat, DA can exceed 5,000ft. The highest-elevation major training airport in the Phoenix metro. Recalculate all performance data."},
      {id:"CLASS_B",phase:["all"],sev:"critical",icon:"📡",title:"Phoenix Sky Harbor Class B — Overhead",why:"Scottsdale sits directly under a Phoenix Class B shelf.",detail:"Sky Harbor Class B airspace shelf begins at 3,000ft MSL over KSDL — closer than it sounds given the 1,510ft field elevation. Northbound and westbound departures can reach Class B altitude quickly."},
      {id:"FAST",phase:["pattern","all"],sev:"high",icon:"✈",title:"Fast-Paced Environment — Advanced Traffic",why:"Scottsdale attracts more experienced pilots — pace is faster than typical training fields.",detail:"KSDL has a mix of high-performance piston, turboprop, and jet traffic alongside training aircraft. Pattern pace is faster than fields like KDVT. Good progression field for advanced students."},
      {id:"DUST",phase:["all"],sev:"high",icon:"🌪",title:"Haboob Risk",detail:"Standard Phoenix haboob hazard. Land and tie down immediately."},
    ],
    atcNotes:"Tower 132.1 · Ground 121.9 · Phoenix Approach 124.0\nClass B begins at 3,000ft — confirm before climbing.",
    cfiNotes:"SDL is a good progression field for students ready for a more complex environment. Not recommended for early solo students.",
  },
  KPRC:{ name:"Ernest A. Love Field (Prescott)", city:"Prescott, AZ", elevation:5045, class:"Class D", type:"Towered", runways:["03L/21R — 7,550ft","03R/21L — 4,847ft","12/30 — 4,000ft"], region:"phoenix", weather_icao:"KPRC",
    hazards:[
      {id:"DA",phase:["takeoff","departure"],sev:"critical",icon:"🌡",title:"HIGH ELEVATION — 5,045ft — Density Altitude Extreme",why:"Prescott is one of the highest training airports in Arizona.",detail:"At 5,045ft elevation, DA is significant even in mild weather. In summer (OAT 30°C+), DA can exceed 8,000ft. Aircraft have crashed at Prescott after failing to achieve safe climb rates. Calculate takeoff and climb performance carefully."},
      {id:"TERRAIN",phase:["departure","all"],sev:"critical",icon:"⛰",title:"Mountainous Terrain — All Quadrants",why:"Prescott is surrounded by the Bradshaw and Mingus mountains.",detail:"Prescott sits in a valley surrounded by mountains. Departures to west and south encounter rising terrain quickly. In low cloud or reduced visibility, CFIT risk is significant. Do not depart in marginal VMC without thorough terrain awareness."},
      {id:"THUNDER",phase:["all"],sev:"high",icon:"⛈",title:"Arizona Monsoon — Mountain Thunderstorms",detail:"Monsoon season (July-September): afternoon CB develops rapidly on surrounding mountains. Morning flights only in monsoon season."},
    ],
    atcNotes:"Tower 119.9 · Ground 121.9\nMountain terrain — know your departure procedure and minimum safe altitudes.",
    cfiNotes:"Prescott is an advanced training environment. Density altitude at 5,045ft is critical. Embry-Riddle operates here — high training volume.",
  },
  KFLG:{ name:"Flagstaff Pulliam Airport", city:"Flagstaff, AZ", elevation:7014, class:"Class D", type:"Towered", runways:["03/21 — 8,800ft","15/33 — 6,999ft"], region:"phoenix", weather_icao:"KFLG",
    hazards:[
      {id:"DA",phase:["takeoff","departure"],sev:"critical",icon:"🌡",title:"EXTREME ELEVATION — 7,014ft",why:"At 7,014ft, DA can exceed 10,000ft in summer — aircraft performance is drastically reduced.",detail:"In summer, DA regularly exceeds 9,000-10,000ft. A Cessna 172 that normally climbs at 700fpm may climb at 300fpm or less. Takeoff roll can be double the sea-level distance. Do not operate at KFLG without thoroughly understanding high-altitude performance."},
      {id:"TERRAIN",phase:["departure","all"],sev:"critical",icon:"⛰",title:"San Francisco Peaks — Terrain in All Directions",detail:"Humphreys Peak (12,633ft) is visible from KFLG — 5,619ft above field elevation. Departures in all directions encounter terrain. Know published departure procedures."},
      {id:"WINTER",phase:["all"],sev:"high",icon:"❄",title:"Winter Operations — Snow and Ice",detail:"Flagstaff receives significant winter snowfall. Runway contamination, aircraft icing, and limited de-icing facilities are factors."},
      {id:"THUNDER",phase:["all"],sev:"high",icon:"⛈",title:"Monsoon Thunderstorms — Mountain Enhanced",detail:"Summer monsoon with mountain-enhanced CB. Afternoon storms are severe and fast-developing at 7,000ft."},
    ],
    atcNotes:"Tower 118.65 · Ground 121.9\nHigh elevation — brief performance carefully before every flight.",
    cfiNotes:"Flagstaff is an advanced training environment not suitable for early students. Do not use Cessna 172 sea-level POH data here — it is not applicable.",
  },
  KBXK:{ name:"Buckeye Municipal Airport", city:"Buckeye, AZ", elevation:1033, class:"Uncontrolled", type:"Non-Towered", runways:["07/25 — 7,000ft","17/35 — 5,200ft"], region:"phoenix", weather_icao:"KGYR",
    hazards:[
      {id:"NONTOW",phase:["all"],sev:"high",icon:"📻",title:"Non-Towered Airport",detail:"No ATC. Self-announce all positions on CTAF 122.8."},
      {id:"DA",phase:["takeoff","departure"],sev:"critical",icon:"🌡",title:"Extreme Density Altitude — Phoenix Area",detail:"Buckeye Phoenix-area heat — DA can exceed 5,000ft in summer. Long runway gives false security."},
      {id:"MILITARY",phase:["all"],sev:"critical",icon:"📡",title:"Luke AFB MOA — Direct Proximity",why:"Buckeye is immediately adjacent to Luke's active military training airspace.",detail:"Luke AFB Restricted Areas and MOAs are immediately north and west of KBXK. F-35 training aircraft operate at high speed. Do not depart northbound or westbound without confirming Luke airspace status."},
      {id:"DUST",phase:["all"],sev:"high",icon:"🌪",title:"Haboob Risk",detail:"Western Phoenix desert location — high haboob risk. Land and tie down immediately."},
    ],
    atcNotes:"CTAF 122.8 — No tower.\nLuke MOA immediately adjacent — confirm status before northbound or westbound departures.",
    cfiNotes:"Buckeye's combination of non-towered operations and Luke military airspace makes it an excellent advanced training field.",
  },
  KCGZ:{ name:"Casa Grande Municipal Airport", city:"Casa Grande, AZ", elevation:1464, class:"Uncontrolled", type:"Non-Towered", runways:["05/23 — 5,201ft","18/36 — 4,802ft"], region:"phoenix", weather_icao:"KCGZ",
    hazards:[
      {id:"NONTOW",phase:["all"],sev:"high",icon:"📻",title:"Non-Towered Airport",detail:"No ATC. Self-announce all positions on CTAF 122.8. All separation is pilot responsibility."},
      {id:"DA",phase:["takeoff","departure"],sev:"high",icon:"🌡",title:"Density Altitude — Desert Valley",detail:"Casa Grande summer heat at 1,464ft elevation — DA can exceed 5,000ft. Recalculate performance."},
      {id:"DUST",phase:["all"],sev:"high",icon:"🌪",title:"Haboob Risk",detail:"Desert location — haboob risk. Land and tie down immediately at first sign of dust wall."},
    ],
    atcNotes:"CTAF 122.8 — No tower.",
    cfiNotes:"CGZ is a useful non-towered field for self-announce practice away from the Phoenix metro.",
  },
  KSOW:{ name:"Show Low Regional Airport", city:"Show Low, AZ", elevation:6415, class:"Class D", type:"Towered", runways:["06/24 — 7,400ft"], region:"phoenix", weather_icao:"KSOW",
    hazards:[
      {id:"DA",phase:["takeoff","departure"],sev:"critical",icon:"🌡",title:"HIGH ELEVATION — 6,415ft",detail:"Show Low sits at 6,415ft on the Mogollon Rim. DA in summer can exceed 9,000ft. Performance calculations are critical — sea-level data is not applicable."},
      {id:"TERRAIN",phase:["departure","all"],sev:"critical",icon:"⛰",title:"Mogollon Rim Terrain",detail:"The Mogollon Rim drops 2,000ft immediately south of Show Low. Terrain awareness in all directions is essential."},
      {id:"THUNDER",phase:["all"],sev:"high",icon:"⛈",title:"Mountain Monsoon Thunderstorms",detail:"White Mountains monsoon season — severe afternoon CB. Morning flights only July-September."},
    ],
    atcNotes:"Tower 123.0 · Ground 121.9",
    cfiNotes:"Show Low is an excellent high-altitude cross-country destination for advanced students. Density altitude and Mogollon Rim terrain are the essential briefs.",
  },

  // ── UNITED KINGDOM ───────────────────────────────────────────────────────
  // NOTE: coordinates carried on AIRFIELDS entries elsewhere in the app assume
  // US-style fields (no lat/lon here since the existing schema doesn't use
  // them for rendering) — elevation values below are reference-quality for
  // scaffolding. Confirm against the current UK AIP before this is used for
  // real student briefings, same caveat as raised earlier for the standalone
  // uk-airfields.js file.
  EGBP:{ name:"Kemble (Cotswold Airport)", city:"Kemble, Gloucestershire", elevation:433, class:"Class G", type:"Uncontrolled", runways:["08/26 — 2,000m"], region:"uk", weather_icao:"EGBP",
    hazards:[
      {id:"NONTOW",phase:["all"],sev:"high",icon:"📻",title:"Uncontrolled — Radio Discipline Required",why:"No ATC — all separation is pilot responsibility.",detail:"Kemble is a busy uncontrolled field. Make blind calls at all reporting points and listen out continuously on the A/G frequency. Do not assume other traffic has heard your call."},
      {id:"GLIDER",phase:["pattern","all"],sev:"medium",icon:"🪂",title:"Glider & Parachute Activity Nearby",why:"Shared local airspace with gliding and parachute operations.",detail:"Check NOTAMs for active parachute drop zones and glider launch sites before flight. Gliders may not be radio-equipped."},
      {id:"CLOUD",phase:["all"],sev:"high",icon:"☁",title:"Low Cloud Base — Common in Winter",why:"UK weather brings frequent low cloud and reduced visibility, especially Oct–Mar.",detail:"Check the actual TAF/METAR cloud base before flight. Use the cloud base tool in the weather panel as a planning aid, not a substitute for the actual report."},
    ],
    atcNotes:"Kemble A/G 122.995\nNo ATC — self-announce all positions.",
    cfiNotes:"Kemble is a good introduction to uncontrolled UK fields. Radio discipline and lookout are the defining briefs here.",
  },
  EGTE:{ name:"Exeter Airport", city:"Exeter, Devon", elevation:102, class:"Class D", type:"Towered", runways:["08/26 — 2,894m"], region:"uk", weather_icao:"EGTE",
    hazards:[
      {id:"CLASS_D",phase:["all"],sev:"high",icon:"🗼",title:"Class D — Clearance Required",why:"Exeter is controlled airspace — you need clearance to enter.",detail:"Establish two-way communication with Exeter Approach before entering the Class D zone. Do not enter without an explicit clearance."},
      {id:"COAST",phase:["all"],sev:"medium",icon:"🌊",title:"Coastal Weather — Fast-Changing Visibility",why:"Sea fog and haze can form quickly on the South Devon coast.",detail:"Check the actual METAR trend before and during flight, not just at departure. Coastal visibility can deteriorate faster than inland forecasts suggest."},
    ],
    atcNotes:"Exeter Approach 128.98 · Tower 119.8",
    cfiNotes:"Good Class D introduction field. Coastal weather changes fast — reinforce in-flight weather monitoring.",
  },
  EGHH:{ name:"Bournemouth Airport", city:"Bournemouth, Dorset", elevation:38, class:"Class D", type:"Towered", runways:["08/26 — 2,073m"], region:"uk", weather_icao:"EGHH",
    hazards:[
      {id:"CLASS_D",phase:["all"],sev:"high",icon:"🗼",title:"Class D — Clearance Required",why:"Bournemouth is controlled airspace.",detail:"Establish two-way communication with Bournemouth Approach before entering the Class D zone."},
      {id:"TRAFFIC",phase:["pattern","all"],sev:"medium",icon:"✈",title:"Mixed Traffic — GA and Commercial",why:"Shared with scheduled and charter commercial traffic.",detail:"Expect sequencing behind larger aircraft. Follow ATC instructions precisely and be ready for extended patterns."},
    ],
    atcNotes:"Bournemouth Approach 119.475 · Tower 125.6",
    cfiNotes:"Good introduction to a mixed GA/commercial traffic environment.",
  },
  EGBJ:{ name:"Gloucestershire Airport (Staverton)", city:"Staverton, Gloucestershire", elevation:101, class:"Class G", type:"Uncontrolled (ATZ)", runways:["09/27 — 1,246m","04/22 — 786m"], region:"uk", weather_icao:"EGBJ",
    hazards:[
      {id:"NONTOW",phase:["all"],sev:"high",icon:"📻",title:"ATZ — Radio Recommended, Not Mandatory Everywhere",detail:"Staverton has an ATZ with a Flight Information Service. Listen out and make position calls even where not strictly required."},
      {id:"CROSS",phase:["takeoff","landing"],sev:"medium",icon:"🛬",title:"Intersecting Runways",detail:"09/27 and 04/22 intersect. Confirm which runway is in use and expect circuit direction to vary."},
    ],
    atcNotes:"Staverton Radio 122.9",
    cfiNotes:"Good field for practising radio discipline in a Flight Information Service environment.",
  },
  EGTK:{ name:"Oxford Airport (Kidlington)", city:"Kidlington, Oxfordshire", elevation:270, class:"Class D", type:"Towered", runways:["01/19 — 1,506m","10/28 — 1,206m"], region:"uk", weather_icao:"EGTK",
    hazards:[
      {id:"CLASS_D",phase:["all"],sev:"high",icon:"🗼",title:"Class D — Clearance Required",detail:"Establish two-way communication with Oxford Approach before entering the zone."},
      {id:"TRAINING",phase:["pattern","all"],sev:"medium",icon:"✈",title:"High-Density Flight Training",why:"Oxford hosts a major flight training organisation.",detail:"Expect heavy circuit traffic and multiple training aircraft operating simultaneously. Maintain a strict lookout scan."},
    ],
    atcNotes:"Oxford Approach 125.325 · Tower 133.42",
    cfiNotes:"Busy Class D training environment — good for building radio and pattern discipline under load.",
  },
  EGTC:{ name:"Cranfield Airport", city:"Cranfield, Bedfordshire", elevation:358, class:"Class D", type:"Towered", runways:["04/22 — 1,808m"], region:"uk", weather_icao:"EGTC",
    hazards:[
      {id:"CLASS_D",phase:["all"],sev:"high",icon:"🗼",title:"Class D — Clearance Required",detail:"Establish two-way communication with Cranfield Approach before entering the zone."},
      {id:"UNI",phase:["pattern","all"],sev:"medium",icon:"✈",title:"University Flight Training Operations",detail:"Cranfield hosts university-affiliated flight training — expect structured but busy circuit traffic."},
    ],
    atcNotes:"Cranfield Approach 123.15 · Tower 134.22",
    cfiNotes:"Well-organised Class D field, good progression step from an uncontrolled airfield.",
  },
  EGKA:{ name:"Shoreham Airport", city:"Shoreham-by-Sea, West Sussex", elevation:7, class:"Class D", type:"Towered", runways:["02/20 — 1,000m","07/25 — 796m"], region:"uk", weather_icao:"EGKA",
    hazards:[
      {id:"CLASS_D",phase:["all"],sev:"high",icon:"🗼",title:"Class D — Clearance Required",detail:"Establish two-way communication with Shoreham Tower before entering the zone."},
      {id:"COAST",phase:["all"],sev:"medium",icon:"🌊",title:"Coastal Fog Risk",why:"Low-lying coastal field prone to sea fret.",detail:"Sea fret can form quickly along the South Coast. Monitor actual METAR closely, especially in spring and autumn."},
      {id:"SHORT",phase:["takeoff","landing"],sev:"medium",icon:"🛬",title:"Short Secondary Runway",detail:"07/25 is short at 796m — know your aircraft's performance before accepting it."},
    ],
    atcNotes:"Shoreham Tower 123.15",
    cfiNotes:"Coastal fog awareness is the standout brief here — reinforce checking trends, not just current conditions.",
  },
  EGBW:{ name:"Wellesbourne Mountford Airfield", city:"Wellesbourne, Warwickshire", elevation:154, class:"Class G", type:"Uncontrolled", runways:["18/36 — 1,097m","05/23 — 741m"], region:"uk", weather_icao:"EGBW",
    hazards:[
      {id:"NONTOW",phase:["all"],sev:"high",icon:"📻",title:"Uncontrolled — Self-Announce",detail:"No ATC. Make blind calls at all standard reporting points on the A/G frequency."},
      {id:"MULTI",phase:["pattern","all"],sev:"medium",icon:"📻",title:"Multiple Flying Schools",detail:"Several schools operate from Wellesbourne. Expect non-standard spacing — announce clearly, look before every turn."},
    ],
    atcNotes:"Wellesbourne A/G 124.025\nNo ATC — self-announce all positions.",
    cfiNotes:"Good uncontrolled field for reinforcing radio discipline in a busy multi-school pattern.",
  },
  EGHI:{ name:"Southampton Airport", city:"Southampton, Hampshire", elevation:44, class:"Class D", type:"Towered", runways:["02/20 — 1,723m"], region:"uk", weather_icao:"EGHI",
    hazards:[
      {id:"CLASS_D",phase:["all"],sev:"high",icon:"🗼",title:"Class D — Clearance Required",detail:"Establish two-way communication with Southampton Approach before entering the zone."},
      {id:"TRAFFIC",phase:["pattern","all"],sev:"medium",icon:"✈",title:"Scheduled Commercial Traffic",detail:"Shared with scheduled airline services. Expect to be sequenced behind larger aircraft."},
    ],
    atcNotes:"Southampton Approach 128.85 · Tower 118.2",
    cfiNotes:"Good introduction to mixed GA/commercial Class D operations.",
  },
  EGLK:{ name:"Blackbushe Airport", city:"Camberley, Hampshire", elevation:325, class:"Class G", type:"Uncontrolled (ATZ)", runways:["07/25 — 1,384m"], region:"uk", weather_icao:"EGLK",
    hazards:[
      {id:"NONTOW",phase:["all"],sev:"high",icon:"📻",title:"ATZ with Flight Information Service",detail:"Listen out and make position calls; no mandatory clearance but active traffic advisory service available."},
      {id:"BUSY",phase:["pattern","all"],sev:"medium",icon:"✈",title:"Busy Business Aviation Traffic",detail:"Blackbushe sees significant business jet and turboprop traffic alongside GA training — expect faster-moving aircraft in the pattern."},
    ],
    atcNotes:"Blackbushe Radio 122.3",
    cfiNotes:"Mixed traffic speeds are the key brief — reinforce lookout and pattern spacing awareness.",
  },
  EGHC:{ name:"Land's End Airport", city:"St Just, Cornwall", elevation:386, class:"Class G", type:"Uncontrolled (ATZ)", runways:["07/25 — 664m","13/31 — 605m"], region:"uk", weather_icao:"EGHC",
    hazards:[
      {id:"NONTOW",phase:["all"],sev:"high",icon:"📻",title:"Uncontrolled — Self-Announce",detail:"No ATC. Make blind calls at all standard reporting points."},
      {id:"COAST",phase:["all"],sev:"high",icon:"🌊",title:"Exposed Coastal Location — Rapid Weather Changes",why:"Extreme southwest tip of the UK, fully exposed to Atlantic weather.",detail:"Weather at Land's End can change very quickly due to its exposed coastal position. Wind and visibility should be monitored closely before and during flight."},
      {id:"SHORT",phase:["takeoff","landing"],sev:"medium",icon:"🛬",title:"Short Runways",detail:"Both runways are under 700m — know your aircraft's performance margins."},
    ],
    atcNotes:"Land's End A/G 120.25",
    cfiNotes:"Exposed coastal weather is the defining hazard — not a field for early solo cross-country without a thorough weather brief.",
  },
  EGFH:{ name:"Swansea Airport", city:"Swansea, Wales", elevation:299, class:"Class G", type:"Uncontrolled (ATZ)", runways:["04/22 — 1,190m"], region:"uk", weather_icao:"EGFH",
    hazards:[
      {id:"NONTOW",phase:["all"],sev:"high",icon:"📻",title:"ATZ with Flight Information Service",detail:"Listen out and make position calls on the A/G frequency."},
      {id:"TERRAIN",phase:["departure","all"],sev:"medium",icon:"⛰",title:"Rising Terrain to the North",detail:"South Wales terrain rises inland. Be aware of minimum safe altitudes on northbound routings, especially in poor visibility."},
    ],
    atcNotes:"Swansea Radio 119.7",
    cfiNotes:"Good field for introducing terrain awareness in a Welsh coastal-to-inland transition.",
  },
  EGNX:{ name:"East Midlands Airport", city:"Castle Donington, Leicestershire", elevation:306, class:"Class D", type:"Towered", runways:["09/27 — 2,894m"], region:"uk", weather_icao:"EGNX",
    hazards:[
      {id:"CLASS_D",phase:["all"],sev:"high",icon:"🗼",title:"Class D — Clearance Required",detail:"Establish two-way communication with East Midlands Approach before entering the zone."},
      {id:"CARGO",phase:["pattern","all"],sev:"medium",icon:"✈",title:"Heavy Cargo and Commercial Traffic",why:"Major overnight cargo hub.",detail:"East Midlands is a significant freight hub with heavy aircraft movements. Expect to be sequenced carefully, including wake turbulence separation from larger jets."},
    ],
    atcNotes:"East Midlands Approach 134.175 · Tower 124.0",
    cfiNotes:"Good exposure to procedural separation from heavy commercial traffic, including wake turbulence awareness.",
  },
  EGBB:{ name:"Birmingham Airport", city:"Birmingham, West Midlands", elevation:327, class:"Class D", type:"Towered", runways:["15/33 — 3,052m"], region:"uk", weather_icao:"EGBB",
    hazards:[
      {id:"CLASS_D",phase:["all"],sev:"critical",icon:"🗼",title:"Major Class D Airport — Complex Clearance Environment",why:"Birmingham is a busy commercial airport — not typically used for ab-initio training.",detail:"Establish two-way communication with Birmingham Approach well before the zone boundary. Expect complex sequencing instructions among heavy commercial traffic. This field is better suited to advanced or radio-procedure training than early solo work."},
      {id:"TRAFFIC",phase:["pattern","all"],sev:"high",icon:"✈",title:"High-Volume Commercial Traffic",detail:"Significant scheduled and charter traffic. GA aircraft are a small minority of movements here."},
    ],
    atcNotes:"Birmingham Approach 118.05 · Tower 118.3",
    cfiNotes:"Reserve Birmingham for advanced radio procedure and complex-airspace training — not a first-solo environment.",
  },
  EGSC:{ name:"Cambridge Airport", city:"Cambridge, Cambridgeshire", elevation:47, class:"Class D", type:"Towered", runways:["05/23 — 1,997m"], region:"uk", weather_icao:"EGSC",
    hazards:[
      {id:"CLASS_D",phase:["all"],sev:"high",icon:"🗼",title:"Class D — Clearance Required",detail:"Establish two-way communication with Cambridge Approach before entering the zone."},
      {id:"BUSY",phase:["pattern","all"],sev:"medium",icon:"✈",title:"Business Aviation Traffic",detail:"Significant business jet movements alongside GA training. Expect a range of aircraft speeds in the pattern."},
    ],
    atcNotes:"Cambridge Approach 123.6 · Tower 122.2",
    cfiNotes:"Good mixed-traffic Class D environment for building confidence with faster aircraft sharing the circuit.",
  },
  EGSX:{ name:"North Weald Airfield", city:"North Weald, Essex", elevation:321, class:"Class G", type:"Uncontrolled (ATZ)", runways:["02/20 — 1,401m"], region:"uk", weather_icao:"EGSX",
    hazards:[
      {id:"NONTOW",phase:["all"],sev:"high",icon:"📻",title:"ATZ with Flight Information Service",detail:"Listen out and make position calls on the A/G frequency."},
      {id:"HISTORIC",phase:["pattern","all"],sev:"low",icon:"✈",title:"Historic/Warbird Aircraft Activity",detail:"North Weald hosts historic and warbird aircraft — some with limited radio or non-standard circuit patterns. Maintain a strong visual lookout."},
    ],
    atcNotes:"North Weald A/G 123.525",
    cfiNotes:"Good field for reinforcing see-and-avoid discipline given the mix of aircraft types and speeds.",
  },
  EGMC:{ name:"Southend Airport", city:"Southend-on-Sea, Essex", elevation:49, class:"Class D", type:"Towered", runways:["05/23 — 1,856m"], region:"uk", weather_icao:"EGMC",
    hazards:[
      {id:"CLASS_D",phase:["all"],sev:"high",icon:"🗼",title:"Class D — Clearance Required",detail:"Establish two-way communication with Southend Approach before entering the zone."},
      {id:"THAMES",phase:["all"],sev:"medium",icon:"📡",title:"Proximity to London TMA / Thames Estuary Airspace",why:"Southend sits close to complex London-area controlled airspace.",detail:"Be aware of the boundaries of surrounding controlled airspace, particularly on routes towards London. Confirm clearances precisely."},
    ],
    atcNotes:"Southend Approach 130.775 · Tower 128.95",
    cfiNotes:"Good field for introducing students to operating near complex London-area airspace.",
  },
  EGKB:{ name:"Biggin Hill Airport", city:"Biggin Hill, Kent", elevation:599, class:"Class D", type:"Towered", runways:["03/21 — 1,802m"], region:"uk", weather_icao:"EGKB",
    hazards:[
      {id:"CLASS_D",phase:["all"],sev:"high",icon:"🗼",title:"Class D — Clearance Required",detail:"Establish two-way communication with Biggin Approach before entering the zone."},
      {id:"LONDON",phase:["all"],sev:"high",icon:"📡",title:"Close to London Airspace",why:"Biggin Hill sits close to London TMA and Gatwick/Heathrow zones.",detail:"Confirm routing and altitude restrictions carefully — this is a complex airspace environment close to some of the busiest controlled airspace in Europe."},
    ],
    atcNotes:"Biggin Approach 129.4 · Tower 134.8",
    cfiNotes:"Excellent field for advanced students building confidence operating near London's complex airspace.",
  },
  EGLF:{ name:"Fairoaks Airport", city:"Chobham, Surrey", elevation:80, class:"Class G", type:"Uncontrolled (ATZ)", runways:["06/24 — 823m"], region:"uk", weather_icao:"EGLF",
    hazards:[
      {id:"NONTOW",phase:["all"],sev:"high",icon:"📻",title:"ATZ with Flight Information Service",detail:"Listen out and make position calls on the A/G frequency."},
      {id:"SHORT",phase:["takeoff","landing"],sev:"medium",icon:"🛬",title:"Short Runway",detail:"823m runway — know your aircraft's performance margins, especially in wet conditions."},
    ],
    atcNotes:"Fairoaks Radio 123.425",
    cfiNotes:"Good short-field practice location close to complex Southeast airspace.",
  },
  EGTB:{ name:"Wycombe Air Park", city:"Booker, Buckinghamshire", elevation:520, class:"Class G", type:"Uncontrolled (ATZ)", runways:["06/24 — 823m","01/19 — 561m"], region:"uk", weather_icao:"EGTB",
    hazards:[
      {id:"NONTOW",phase:["all"],sev:"high",icon:"📻",title:"ATZ with Flight Information Service",detail:"Listen out and make position calls on the A/G frequency."},
      {id:"GLIDER",phase:["pattern","all"],sev:"medium",icon:"🪂",title:"Gliding and Parachute Operations",detail:"Wycombe has active gliding and parachute operations. Check NOTAMs before flight."},
    ],
    atcNotes:"Wycombe Radio 126.55",
    cfiNotes:"Good field for reinforcing lookout discipline given shared use with gliders and parachutists.",
  },
  EGCC:{ name:"Manchester Airport", city:"Manchester, Greater Manchester", elevation:257, class:"Class D", type:"Towered", runways:["05L/23R — 3,048m","05R/23L — 3,048m"], region:"uk", weather_icao:"EGCC",
    hazards:[
      {id:"CLASS_D",phase:["all"],sev:"critical",icon:"🗼",title:"Major Airport — Not for Ab-Initio Training",why:"Manchester is one of the busiest airports in the UK.",detail:"Manchester handles very high volumes of scheduled commercial traffic. This is a procedural/radio-exposure destination for advanced students, not a routine training field."},
    ],
    atcNotes:"Manchester Approach 118.575 · Tower 118.625",
    cfiNotes:"Use only for advanced radio-procedure exposure with thorough pre-flight briefing — not for routine circuit training.",
  },
  EGCB:{ name:"City Airport Manchester (Barton)", city:"Eccles, Greater Manchester", elevation:75, class:"Class G", type:"Uncontrolled (ATZ)", runways:["08/26 — 610m","14/32 — 555m"], region:"uk", weather_icao:"EGCB",
    hazards:[
      {id:"NONTOW",phase:["all"],sev:"high",icon:"📻",title:"ATZ with Flight Information Service",detail:"Listen out and make position calls on the A/G frequency."},
      {id:"SHORT",phase:["takeoff","landing"],sev:"high",icon:"🛬",title:"Short Grass/Paved Runways",why:"Runways under 650m — some of the shortest in regular training use.",detail:"Know your aircraft's demonstrated short-field performance before accepting these runways. Add a safety margin, particularly if grass is wet."},
      {id:"PROXIMITY",phase:["all"],sev:"medium",icon:"📡",title:"Proximity to Manchester Class D",detail:"Barton sits close to Manchester's controlled airspace. Confirm boundaries carefully before departure."},
    ],
    atcNotes:"Barton Radio 120.25",
    cfiNotes:"Good short-field training location — reinforce demonstrated performance numbers, not book figures.",
  },
  EGNJ:{ name:"Humberside Airport", city:"Kirmington, Lincolnshire", elevation:32, class:"Class D", type:"Towered", runways:["02/20 — 1,857m"], region:"uk", weather_icao:"EGNJ",
    hazards:[
      {id:"CLASS_D",phase:["all"],sev:"high",icon:"🗼",title:"Class D — Clearance Required",detail:"Establish two-way communication with Humberside Approach before entering the zone."},
      {id:"COAST",phase:["all"],sev:"medium",icon:"🌊",title:"Coastal/Estuary Weather",detail:"Proximity to the Humber Estuary can bring fast-changing visibility. Check actual METAR trend."},
    ],
    atcNotes:"Humberside Approach 118.55 · Tower 124.75",
    cfiNotes:"Straightforward Class D field, good for building confidence with estuary weather awareness.",
  },
  EGPF:{ name:"Glasgow Airport", city:"Paisley, Scotland", elevation:26, class:"Class D", type:"Towered", runways:["05/23 — 2,658m"], region:"uk", weather_icao:"EGPF",
    hazards:[
      {id:"CLASS_D",phase:["all"],sev:"critical",icon:"🗼",title:"Major Airport — Not for Ab-Initio Training",detail:"Glasgow is a busy commercial hub. Use for advanced radio-procedure exposure only, with a thorough pre-flight brief."},
    ],
    atcNotes:"Glasgow Approach 119.1 · Tower 118.8",
    cfiNotes:"Advanced students only — complex commercial traffic environment.",
  },
  EGPN:{ name:"Dundee Airport", city:"Dundee, Scotland", elevation:15, class:"Class D", type:"Towered", runways:["09/27 — 1,400m"], region:"uk", weather_icao:"EGPN",
    hazards:[
      {id:"CLASS_D",phase:["all"],sev:"medium",icon:"🗼",title:"Class D — Clearance Required",detail:"Establish two-way communication with Dundee Approach before entering the zone."},
      {id:"TERRAIN",phase:["departure","all"],sev:"medium",icon:"⛰",title:"Rising Terrain to the North",detail:"Terrain rises quickly north of Dundee towards the Angus glens. Be aware of minimum safe altitudes on northbound routes."},
    ],
    atcNotes:"Dundee Approach/Tower 122.9",
    cfiNotes:"Quieter Class D field — good for a calmer controlled-airspace introduction before busier fields.",
  },
  EGPK:{ name:"Prestwick Airport", city:"Prestwick, Scotland", elevation:65, class:"Class D", type:"Towered", runways:["12/30 — 2,987m"], region:"uk", weather_icao:"EGPK",
    hazards:[
      {id:"CLASS_D",phase:["all"],sev:"high",icon:"🗼",title:"Class D — Clearance Required",detail:"Establish two-way communication with Prestwick Approach before entering the zone."},
      {id:"CARGO",phase:["pattern","all"],sev:"medium",icon:"✈",title:"Cargo and Training Traffic",detail:"Prestwick handles cargo operations and hosts flight training. Expect a mix of traffic types and speeds."},
    ],
    atcNotes:"Prestwick Approach 126.2 · Tower 118.15",
    cfiNotes:"Reasonable step up in complexity — long runway with mixed commercial and training traffic.",
  },
  EGNS:{ name:"Isle of Man Airport (Ronaldsway)", city:"Ballasalla, Isle of Man", elevation:52, class:"Class D", type:"Towered", runways:["08/26 — 1,970m","03/21 — 1,187m"], region:"uk", weather_icao:"EGNS",
    hazards:[
      {id:"CLASS_D",phase:["all"],sev:"high",icon:"🗼",title:"Class D — Clearance Required",detail:"Establish two-way communication with Ronaldsway Approach before entering the zone."},
      {id:"SEA",phase:["all"],sev:"high",icon:"🌊",title:"Island Location — Overwater Routing Awareness",why:"Any cross-country to/from the Isle of Man involves overwater flight.",detail:"Overwater flight planning, life jacket requirements, and diversion options need specific briefing before any Ronaldsway cross-country."},
    ],
    atcNotes:"Ronaldsway Approach 120.85 · Tower 118.9",
    cfiNotes:"Overwater routing brief is essential and specific to this field — do not treat it as a standard mainland Class D.",
  },
  EGHQ:{ name:"Newquay Airport (Cornwall)", city:"Newquay, Cornwall", elevation:468, class:"Class D", type:"Towered", runways:["12/30 — 2,744m"], region:"uk", weather_icao:"EGHQ",
    hazards:[
      {id:"CLASS_D",phase:["all"],sev:"medium",icon:"🗼",title:"Class D — Clearance Required",detail:"Establish two-way communication with Newquay Approach before entering the zone."},
      {id:"COAST",phase:["all"],sev:"high",icon:"🌊",title:"Exposed Coastal Weather",why:"North Cornwall coast is exposed to fast-moving Atlantic weather systems.",detail:"Weather can change quickly here. Check actual METAR trend closely before and during flight, not just the forecast."},
    ],
    atcNotes:"Newquay Approach 125.475 · Tower 133.4",
    cfiNotes:"Coastal weather awareness is the standout brief — reinforce trend-checking over single-report reliance.",
  },
  EGLM:{ name:"White Waltham Airfield", city:"White Waltham, Berkshire", elevation:133, class:"Class G", type:"Uncontrolled (ATZ)", runways:["03/21 — 823m","07/25 — 796m"], region:"uk", weather_icao:"EGLM",
    hazards:[
      {id:"NONTOW",phase:["all"],sev:"high",icon:"📻",title:"ATZ with Flight Information Service",detail:"Listen out and make position calls on the A/G frequency."},
      {id:"GRASS",phase:["takeoff","landing"],sev:"medium",icon:"🛬",title:"Grass Runways",detail:"All runways are grass — performance and braking differ from paved surfaces, especially when wet."},
    ],
    atcNotes:"White Waltham Radio 122.6",
    cfiNotes:"Good grass-field introduction — reinforce the performance differences from paved-runway training.",
  },
  EGSG:{ name:"Stapleford Aerodrome", city:"Stapleford Tawney, Essex", elevation:190, class:"Class G", type:"Uncontrolled (ATZ)", runways:["04/22 — 793m"], region:"uk", weather_icao:"EGSG",
    hazards:[
      {id:"NONTOW",phase:["all"],sev:"high",icon:"📻",title:"ATZ with Flight Information Service",detail:"Listen out and make position calls on the A/G frequency."},
      {id:"MULTI",phase:["pattern","all"],sev:"medium",icon:"📻",title:"Busy Multi-School Circuit",detail:"Multiple schools operate from Stapleford. Expect non-standard spacing — announce clearly, look before every turn."},
    ],
    atcNotes:"Stapleford Radio 122.8",
    cfiNotes:"Busy uncontrolled circuit — good for reinforcing lookout and radio discipline under load.",
  },
};

// Lat/lon reference for all fields — used only to center the weather map.
// Approximate values for scaffolding; not used for any performance or
// navigation calculation, so precision requirements here are low.
const FIELD_COORDS = {
  // Florida
  KDAB:[29.1799,-81.0581], KVRB:[27.6556,-80.4178], KFXE:[26.1973,-80.1707], KPMP:[26.2470,-80.1113],
  KFPR:[27.4950,-80.3661], KTMB:[25.6479,-80.4328], KSRQ:[27.3954,-82.5544], KFMY:[26.5864,-81.8631],
  KGNV:[29.6900,-82.2718], KVNC:[27.0719,-82.4401], KBOW:[27.9436,-81.7834], KLAL:[27.9889,-82.0181],
  KPGD:[26.9200,-81.9906], KSPG:[27.7658,-82.6270], KIMM:[26.4326,-81.3953], KDED:[29.0722,-81.2839],
  KZPH:[28.2283,-82.1561], KTIX:[28.5150,-80.7998], KAPF:[26.1526,-81.7752],
  // Arizona
  KDVT:[33.6883,-112.0827], KFFZ:[33.4106,-111.7278], KCHD:[33.2691,-111.8107], KIWA:[33.3078,-111.6555],
  KGYR:[33.4225,-112.3755], KSDL:[33.6229,-111.9106], KPRC:[34.6546,-112.4196], KFLG:[35.1385,-111.6710],
  KBXK:[33.4522,-112.6879], KCGZ:[32.9548,-111.7679], KSOW:[34.2653,-110.0052],
  // UK
  EGBP:[51.6660,-2.0567], EGTE:[50.7344,-3.4139], EGHH:[50.7800,-1.8425], EGBJ:[51.8942,-2.1672],
  EGTK:[51.8369,-1.3200], EGTC:[52.0719,-0.6169], EGKA:[50.8356,-0.2972], EGBW:[52.1922,-1.6142],
  EGHI:[50.9503,-1.3567], EGLK:[51.3236,-0.8478], EGHC:[50.1028,-5.6706], EGFH:[51.6053,-4.0678],
  EGNX:[52.8311,-1.3281], EGBB:[52.4539,-1.7480], EGSC:[52.2050,0.1750], EGSX:[51.7222,0.1547],
  EGMC:[51.5714,0.6956], EGKB:[51.3308,0.0325], EGLF:[51.3486,-0.5583], EGTB:[51.6111,-0.8206],
  EGCC:[53.3537,-2.2750], EGCB:[53.4694,-2.3800], EGNJ:[53.5744,-0.3508], EGPF:[55.8719,-4.4331],
  EGPN:[56.4525,-3.0258], EGPK:[55.5094,-4.5867], EGNS:[54.0833,-4.6239], EGHQ:[50.4406,-4.9958],
  EGLM:[51.5083,-0.7794], EGSG:[51.6486,0.1544],
};

const SEV = {
  critical:{ color:"#FF3B3B", bg:"rgba(255,59,59,0.15)", border:"rgba(255,59,59,0.45)", label:"CRITICAL" },
  high:    { color:"#FF8C00", bg:"rgba(255,140,0,0.15)", border:"rgba(255,140,0,0.45)", label:"HIGH" },
  medium:  { color:"#FFD700", bg:"rgba(255,215,0,0.15)", border:"rgba(255,215,0,0.45)", label:"MEDIUM" },
  low:     { color:"#00C896", bg:"rgba(0,200,150,0.15)", border:"rgba(0,200,150,0.45)", label:"LOW" },
};

const PHASES = [{id:"all",label:"ALL PHASES"},{id:"pattern",label:"PATTERN"},{id:"takeoff",label:"TAKEOFF"},{id:"landing",label:"LANDING"},{id:"departure",label:"DEPARTURE"}];

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

function DAWidget({ airfield, liveWx }) {
  const liveTemp = liveWx?parseMetarTemp(liveWx.metar):null;
  const liveAlt  = liveWx?parseMetarAltimeter(liveWx.metar):null;
  const [tempC,setTempC] = useState(liveTemp??25);
  const [altim,setAltim] = useState(liveAlt??29.92);
  const [useLive,setUseLive] = useState(!!liveTemp);
  useEffect(()=>{ if(liveTemp!==null){setTempC(liveTemp);setUseLive(true);} if(liveAlt!==null)setAltim(liveAlt); },[liveTemp,liveAlt]);
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

// ── UK cloud base + icing widget ────────────────────────────────────────
// Replaces DAWidget for UK-region airfields. Density altitude matters far
// less in the UK's climate than the two things the Met Office itself flags
// as the real risk drivers for UK GA: low cloud/VMC compliance and icing.
// Both estimates below are standard rule-of-thumb approximations from a
// single surface reading — not a substitute for the actual TAF/METAR or the
// F214/F215 charts. That caveat is shown in the widget itself, not just here.

function calcCloudBase(tempC, dewpointC, elevFt) {
  const spread = tempC - dewpointC;
  const aglFt = Math.max(0, spread * 400); // ~1000ft AGL per 2.5°C spread
  return Math.round(aglFt + elevFt); // returns AMSL
}

function calcFreezingLevel(tempC, elevFt) {
  if (tempC <= 0) return elevFt; // already at/below freezing at the surface
  return Math.round(elevFt + tempC * 500); // ~1000ft per 2°C, standard lapse rate
}

function UkWeatherWidget({ airfield, liveWx }) {
  const liveTemp = liveWx?parseMetarTemp(liveWx.metar):null;
  const liveDew  = liveWx?parseMetarDewpoint(liveWx.metar):null;
  const [tempC,setTempC] = useState(liveTemp??15);
  const [dewC,setDewC] = useState(liveDew??10);
  const [useLive,setUseLive] = useState(!!liveTemp);

  useEffect(()=>{
    if(liveTemp!==null){setTempC(liveTemp);setUseLive(true);}
    if(liveDew!==null){setDewC(liveDew);}
  },[liveTemp,liveDew]);

  const cloudBaseAmsl = calcCloudBase(tempC, dewC, airfield.elevation);
  const cloudBaseAgl = Math.max(0, cloudBaseAmsl - airfield.elevation);
  const freezingLevel = calcFreezingLevel(tempC, airfield.elevation);
  const icingRisk = tempC<=0 ? "LIKELY" : (freezingLevel < cloudBaseAmsl+2000 ? "POSSIBLE" : "LOW");
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
      <div style={{fontSize:7,color:"#556677",marginTop:7,lineHeight:1.4}}>Estimates only, from standard rule-of-thumb approximations. Always confirm against the actual TAF/METAR and F214/F215 charts before flight — this tool does not model carburettor icing.</div>
    </div>
  );
}

// ── UK radar/cloud map widget ───────────────────────────────────────────
// Free, keyless RainViewer API — https://www.rainviewer.com/api.html.
// Not a substitute for the Met Office Aviation Briefing Service (MAVIS);
// this is a quick visual, with a link out to MAVIS for the regulated
// products (TAFs, SIGMETs, F214/F215 charts).

const RAINVIEWER_API_URL = "https://api.rainviewer.com/public/weather-maps.json";

function MapWidget({ airfield, icao }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const radarLayerRef = useRef(null);
  const [frames, setFrames] = useState([]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const coords = FIELD_COORDS[icao] || [39.8, -98.6]; // fallback: rough US center

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
    if (!mapContainerRef.current) return;
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }

    const map = L.map(mapContainerRef.current, {
      center: coords,
      zoom: 7,
      minZoom: 4,
      maxZoom: 12,
      scrollWheelZoom: false,
      doubleClickZoom: true,
      touchZoom: true,
      zoomControl: true,
    });
    // Let scroll-wheel zoom take over only once the user has clicked into the
    // map — avoids hijacking page scroll on first hover, but still allows
    // wheel zoom once they've engaged with it.
    map.on('click', () => map.scrollWheelZoom.enable());
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> | Radar: <a href="https://www.rainviewer.com/">RainViewer</a>',
      maxZoom: 12,
    }).addTo(map);
    L.marker(coords).addTo(map).bindPopup(`${airfield.name} (${icao})`).openPopup();
    mapRef.current = map;

    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [icao]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !frames.length) return;
    const frame = frames[frameIndex];
    if (!frame) return;
    const tileUrl = `https://tilecache.rainviewer.com${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;
    if (radarLayerRef.current) map.removeLayer(radarLayerRef.current);
    const layer = L.tileLayer(tileUrl, { opacity: 0.7, zIndex: 10, maxZoom: 12 });
    layer.addTo(map);
    radarLayerRef.current = layer;
  }, [frames, frameIndex]);

  useEffect(() => {
    if (!isPlaying || !frames.length) return;
    const interval = setInterval(() => setFrameIndex(p => (p + 1) % frames.length), 600);
    return () => clearInterval(interval);
  }, [isPlaying, frames.length]);

  const currentFrameTime = frames[frameIndex] ? new Date(frames[frameIndex].time * 1000).toUTCString() : null;

  return (
    <div style={{background:"#0A1828",border:"1px solid rgba(0,180,255,0.2)",borderRadius:10,padding:"16px 18px",marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{fontSize:10,fontFamily:"'DM Mono',monospace",color:"#00B4FF",letterSpacing:"0.12em",fontWeight:"bold"}}>🗺 WEATHER MAP</div>
        {currentFrameTime && <span style={{fontSize:8,fontFamily:"'DM Mono',monospace",color:"#8899AA"}}>{currentFrameTime}</span>}
      </div>
      <div ref={mapContainerRef} style={{height:280,width:"100%",borderRadius:8,overflow:"hidden",position:"relative"}}/>
      <div style={{fontSize:9,color:"#556677",marginTop:6}}>Click the map to enable scroll-wheel zoom, or use the +/− buttons. This map is capped at zoom level 12, matching RainViewer's radar tile limit.</div>
      {loadError && <div style={{fontSize:10,color:"#FF8C00",marginTop:8}}>{loadError}</div>}
      {!loadError && frames.length>0 && (
        <div style={{display:"flex",alignItems:"center",gap:10,marginTop:10}}>
          <button onClick={()=>setIsPlaying(p=>!p)} style={{background:"rgba(0,180,255,0.15)",border:"1px solid rgba(0,180,255,0.4)",borderRadius:5,padding:"5px 12px",color:"#00B4FF",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:10}}>{isPlaying?"⏸":"▶"}</button>
          <input type="range" min={0} max={frames.length-1} value={frameIndex} onChange={e=>{setIsPlaying(false);setFrameIndex(Number(e.target.value));}} style={{flex:1,accentColor:"#00B4FF"}}/>
        </div>
      )}
      <div style={{fontSize:9,color:"#556677",marginTop:10,lineHeight:1.5}}>
        Radar from <a href="https://www.rainviewer.com/" target="_blank" rel="noreferrer" style={{color:"#00B4FF"}}>RainViewer</a>. Not a substitute for the Met Office Aviation Briefing Service — check <a href="https://mavis.metoffice.gov.uk/" target="_blank" rel="noreferrer" style={{color:"#00B4FF"}}>MAVIS</a> for regulated TAFs, SIGMETs, and F215 charts before flight.
      </div>
    </div>
  );
}

function WeatherStrip({ liveWx, wxLoad }) {
  if (wxLoad) return <div style={{background:"#0A1828",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"12px 16px",marginBottom:14,fontSize:10,color:"#334455",fontFamily:"'DM Mono',monospace"}}>Loading live weather…</div>;
  if (!liveWx) return <div style={{background:"#0A1828",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"12px 16px",marginBottom:14,fontSize:10,color:"#334455",fontFamily:"'DM Mono',monospace"}}>No live weather data available for this field.</div>;
  const tafThreats = parseTAFThreats(liveWx.tafs);
  const hasCB = liveWx.metar && /TSRA|CB|\+TS/.test(liveWx.metar);
  return (
    <div style={{background:"#0A1828",border:"1px solid rgba(0,180,255,0.2)",borderRadius:10,padding:"14px 16px",marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontSize:10,fontFamily:"'DM Mono',monospace",color:"#00B4FF",letterSpacing:"0.12em",fontWeight:"bold"}}>🌤 LIVE WEATHER</div>
        <span style={{fontSize:8,fontFamily:"'DM Mono',monospace",color:"#FF3B3B"}}>● LIVE</span>
      </div>
      <div style={{background:"rgba(255,255,255,0.04)",borderRadius:6,padding:"10px 12px",marginBottom:10}}>
        <div style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#445566",marginBottom:4,letterSpacing:"0.1em"}}>CURRENT CONDITIONS (METAR)</div>
        <div style={{fontSize:13,color:"#FFFFFF",fontWeight:"500",lineHeight:1.6}}>{interpretMetarShort(liveWx.metar)}</div>
        {hasCB && <div style={{marginTop:6,fontSize:11,color:"#FF3B3B",fontWeight:"bold"}}>⛈ ACTIVE THUNDERSTORM / CB DETECTED IN METAR</div>}
      </div>
      {tafThreats.length>0 && (
        <div style={{background:"rgba(255,59,59,0.08)",border:"1px solid rgba(255,59,59,0.3)",borderRadius:6,padding:"10px 12px",marginBottom:10}}>
          <div style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#FF8C00",marginBottom:6,letterSpacing:"0.1em"}}>⚠ FORECAST HAZARDS (TAF)</div>
          {tafThreats.map((t,i)=><div key={i} style={{fontSize:12,color:t.color,marginBottom:3,fontWeight:"500"}}>{t.icon}  {t.text}</div>)}
        </div>
      )}
      <div style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#C0D4E8",lineHeight:1.6,wordBreak:"break-all"}}>{liveWx.metar}</div>
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

function WelcomeScreen({ onSelect }) {
  const options = [
    { id:"florida", label:"FLORIDA", icon:"🌴", desc:"22 training airfields across Florida — Class B/C/D operations, thunderstorm patterns, bird strike corridors, skydiving fields." },
    { id:"phoenix", label:"PHOENIX / ARIZONA", icon:"☀", desc:"13 training airfields across the Phoenix area and Arizona — density altitude, haboobs, high terrain, military airspace." },
    { id:"uk", label:"UNITED KINGDOM", icon:"🇬🇧", desc:"29 training airfields across the UK — Class D/G operations, cloud base & icing, coastal weather, live radar." },
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

export default function App() {
  const width = useWindowWidth();
  const isMobile = width<640;
  const isDesktop = width>=1024;
  const [region,setRegion] = useState("florida");
  const [selected,setSelected] = useState("KVRB");
  const [query,setQuery] = useState("KVRB");
  const [showWelcome,setShowWelcome] = useState(true);
  const [suggestions,setSuggestions] = useState([]);
  const [phase,setPhase] = useState("all");
  const [expanded,setExpanded] = useState({});
  const [menuOpen,setMenuOpen] = useState(false);
  const [tab,setTab] = useState("hazards");
  const [liveWx,setLiveWx] = useState(null);
  const [wxLoad,setWxLoad] = useState(false);
  const [briefing,setBrief] = useState("");
  const [briefLoad,setBriefLoad] = useState(false);
  const airfield = AIRFIELDS[selected];

  function handleSearch(val) {
    setQuery(val.toUpperCase());
    const up = val.toUpperCase().trim();
    if (up.length < 1) { setSuggestions([]); return; }
    const matches = Object.entries(AIRFIELDS).filter(([code,a]) =>
      code.includes(up) ||
      a.name.toUpperCase().includes(up) ||
      a.city.toUpperCase().includes(up)
    ).slice(0, 6);
    setSuggestions(matches);
  }

  function selectAirfield(code) {
    setSelected(code);
    setQuery(code);
    setSuggestions([]);
    if (isMobile) setMenuOpen(false);
  }

  const REGION_DEFAULT_AIRFIELD = { florida:"KVRB", phoenix:"KDVT", uk:"EGBP" };

  function chooseRegion(r) {
    setRegion(r);
    const def = REGION_DEFAULT_AIRFIELD[r];
    setSelected(def);
    setQuery(def);
    setShowWelcome(false);
  }

  useEffect(()=>{ setLiveWx(null);setWxLoad(true);setBrief("");setExpanded({});
    fetchLiveWeather(airfield.weather_icao).then(wx=>{setLiveWx(wx);setWxLoad(false);}).catch(()=>setWxLoad(false));
  },[selected]);

  const filteredHazards = airfield.hazards
    .filter(h=>phase==="all"||h.phase.includes(phase)||h.phase.includes("all"))
    .sort((a,b)=>({critical:4,high:3,medium:2,low:1}[b.sev]||0)-({critical:4,high:3,medium:2,low:1}[a.sev]||0));

  async function generateBriefing() {
    setBriefLoad(true);setBrief("");
    const liveTemp = liveWx?parseMetarTemp(liveWx.metar):null;
    const liveAlt  = liveWx?parseMetarAltimeter(liveWx.metar):null;
    const da = liveTemp!==null?calcDA(airfield.elevation,liveTemp,liveAlt??29.92):null;
    const tafThreats = parseTAFThreats(liveWx?.tafs);
    const wxText = [liveWx?.metar?`METAR: ${liveWx.metar}`:"No METAR available.",liveWx?.tafs?.[0]?`TAF: ${liveWx.tafs[0].slice(0,300)}`:"",da!==null?`Current Density Altitude: ${da.toLocaleString()}ft`:"",tafThreats.length?`Forecast hazards: ${tafThreats.map(t=>t.text).join(", ")}`:""].filter(Boolean).join("\n");
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

  function fieldsForRegion(r) {
    if (r==="florida") return floridaFields;
    if (r==="phoenix") return phoenixFields;
    return ukFields;
  }

  const sidebar = (
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden",background:"#06101C"}}>
      <div style={{padding:"14px 12px 10px",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>

        {/* Search input */}
        <div style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#445566",letterSpacing:"0.15em",marginBottom:8}}>SEARCH AIRFIELD</div>
        <div style={{position:"relative",marginBottom:10}}>
          <input
            value={query}
            onChange={e=>handleSearch(e.target.value)}
            placeholder="ICAO code or name…"
            style={{width:"100%",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(0,180,255,0.3)",borderRadius:7,padding:"10px 12px",color:"#FFFFFF",fontSize:13,fontFamily:"'DM Mono',monospace",outline:"none",letterSpacing:"0.05em"}}
          />
          {/* Suggestions dropdown */}
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

        {/* Current airfield info */}
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

        {/* Quick access by region */}
        <div style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#445566",letterSpacing:"0.12em",marginBottom:6}}>QUICK ACCESS</div>
        <div style={{display:"flex",gap:6,marginBottom:8}}>
          {["florida","phoenix","uk"].map(r=>(
            <button key={r} onClick={()=>setRegion(r)} style={{flex:1,padding:"5px 4px",borderRadius:5,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:9,background:region===r?"rgba(0,180,255,0.18)":"rgba(255,255,255,0.04)",border:`1px solid ${region===r?"rgba(0,180,255,0.4)":"rgba(255,255,255,0.07)"}`,color:region===r?"#00B4FF":"#8899AA"}}>{r==="florida"?"🌴 FLORIDA":r==="phoenix"?"☀ PHOENIX":"🇬🇧 UK"}</button>
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

      {/* Phase filter */}
      <div style={{padding:"10px 12px",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
        <div style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#445566",letterSpacing:"0.12em",marginBottom:7}}>FLIGHT PHASE</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
          {PHASES.map(p=>(
            <button key={p.id} onClick={()=>setPhase(p.id)} style={{fontSize:8,fontFamily:"'DM Mono',monospace",letterSpacing:"0.06em",padding:"4px 8px",borderRadius:4,cursor:"pointer",background:phase===p.id?"rgba(0,180,255,0.18)":"rgba(255,255,255,0.04)",border:`1px solid ${phase===p.id?"rgba(0,180,255,0.4)":"rgba(255,255,255,0.07)"}`,color:phase===p.id?"#00B4FF":"#FFFFFF"}}>{p.label}</button>
          ))}
        </div>
      </div>
    </div>
  );

  if (showWelcome) return <WelcomeScreen onSelect={chooseRegion}/>;

  return (
    <div style={{minHeight:"100vh",background:"#050D18",fontFamily:"'Inter',sans-serif",color:"#D0DCE8",display:"flex",flexDirection:"column"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Inter:wght@300;400;500;600;700&family=Bebas+Neue&display=swap');*{box-sizing:border-box;margin:0;padding:0;}::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-track{background:#08121E;}::-webkit-scrollbar-thumb{background:#1A3050;border-radius:2px;}input[type=range]{-webkit-appearance:none;height:5px;border-radius:3px;background:rgba(255,255,255,0.12);}input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:#00B4FF;cursor:pointer;border:2px solid #050D18;}button{touch-action:manipulation;}`}</style>
      <div style={{background:"rgba(3,10,22,0.97)",borderBottom:"1px solid rgba(0,180,255,0.2)",padding:`0 ${isMobile?12:20}px`,display:"flex",alignItems:"center",gap:10,height:56,backdropFilter:"blur(12px)",position:"sticky",top:0,zIndex:100,flexShrink:0}}>
        {!isDesktop&&<button onClick={()=>setMenuOpen(o=>!o)} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:7,padding:"7px 10px",color:"#8899AA",cursor:"pointer",fontSize:14}}>☰</button>}
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <div style={{width:28,height:28,background:"linear-gradient(135deg,#0055DD,#00B4FF)",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>✈</div>
          <div style={{display:"flex",flexDirection:"column",lineHeight:1}}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:isMobile?17:21,letterSpacing:"0.15em",color:"#FFFFFF"}}>SAFEROUTE <span style={{color:"#00B4FF"}}>ACADEMY</span></div>
            {!isMobile&&<div style={{fontFamily:"'DM Mono',monospace",fontSize:7,color:"#334455",letterSpacing:"0.15em",marginTop:1}}>STUDENT PILOT SAFETY INTELLIGENCE</div>}
          </div>
          <span style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#00C896",background:"rgba(0,200,150,0.12)",border:"1px solid rgba(0,200,150,0.35)",padding:"2px 6px",borderRadius:3,letterSpacing:"0.1em"}}>BETA</span>
        </div>
        <div style={{flex:1}}/>
        <button onClick={()=>setShowWelcome(true)} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:6,padding:"6px 10px",color:"#8899AA",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:"0.05em",marginRight:10}}>⟲ CHANGE LOCATION</button>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:wxLoad?"#FFD700":"#00C896"}}>● {wxLoad?"LOADING":"LIVE"}</span>
      </div>
      <div style={{flex:1,display:"flex",overflow:"hidden",height:"calc(100vh - 56px)"}}>
        {isDesktop?<div style={{width:270,flexShrink:0,overflow:"auto",borderRight:"1px solid rgba(255,255,255,0.06)"}}>{sidebar}</div>:menuOpen&&(
          <div style={{position:"fixed",inset:0,zIndex:200,display:"flex"}}>
            <div onClick={()=>setMenuOpen(false)} style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.7)"}}/>
            <div style={{position:"relative",width:280,height:"100%",overflow:"auto",borderRight:"1px solid rgba(0,180,255,0.2)"}}>{sidebar}</div>
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
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {["critical","high","medium"].map(s=>{const count=airfield.hazards.filter(h=>h.sev===s).length;if(!count)return null;const sc=SEV[s];return <div key={s} style={{textAlign:"center",background:sc.bg,border:`1px solid ${sc.border}`,borderRadius:6,padding:"6px 12px"}}><div style={{fontFamily:"'DM Mono',monospace",fontSize:18,color:sc.color,fontWeight:"bold",lineHeight:1}}>{count}</div><div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:sc.color,marginTop:2}}>{s.toUpperCase()}</div></div>;})}
              </div>
            </div>
          </div>
          <WeatherStrip liveWx={liveWx} wxLoad={wxLoad}/>
          {airfield.region==="uk" ? <UkWeatherWidget airfield={airfield} liveWx={liveWx}/> : <DAWidget airfield={airfield} liveWx={liveWx}/>}
          <MapWidget airfield={airfield} icao={selected}/>
          <div style={{display:"flex",borderBottom:"2px solid rgba(255,255,255,0.06)",marginBottom:14,overflowX:"auto",gap:2}}>
            {[["hazards",`HAZARDS (${filteredHazards.length})`],["atc","ATC & AIRSPACE"],["cfi","CFI NOTES"],["brief","AI BRIEF"]].map(([tid,label])=>(
              <button key={tid} onClick={()=>setTab(tid)} style={{background:tab===tid?"rgba(0,180,255,0.08)":"none",border:"none",cursor:"pointer",padding:"10px 16px",fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:"0.08em",whiteSpace:"nowrap",color:tab===tid?"#00B4FF":"#FFFFFF",borderBottom:tab===tid?"2px solid #00B4FF":"2px solid transparent",transition:"all 0.15s",marginBottom:"-2px"}}>{label}</button>
            ))}
          </div>
          {tab==="hazards"&&<div>
            <div style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#445566",letterSpacing:"0.15em",marginBottom:10}}>{filteredHazards.length} HAZARD{filteredHazards.length!==1?"S":""} FOR {selected} · TAP ANY CARD TO EXPAND</div>
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
            {!briefing&&!briefLoad&&<div style={{textAlign:"center",padding:"40px 20px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10}}>
              <div style={{fontSize:48,marginBottom:14}}>✈</div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:"#334455",marginBottom:6}}>STUDENT PRE-FLIGHT BRIEFING</div>
              <div style={{fontSize:11,color:"#223344",marginBottom:20}}>AI-generated briefing for {airfield.name} using live weather + hazard data</div>
              <button onClick={generateBriefing} style={{background:"rgba(0,180,255,0.18)",border:"1px solid rgba(0,180,255,0.4)",borderRadius:8,padding:"13px 32px",color:"#00B4FF",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:12,letterSpacing:"0.1em",fontWeight:"bold"}}>GENERATE BRIEFING →</button>
            </div>}
            {briefLoad&&<div style={{textAlign:"center",padding:"40px",background:"rgba(0,20,40,0.6)",border:"1px solid rgba(0,180,255,0.15)",borderRadius:10}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:13,color:"#00B4FF",marginBottom:8}}>Generating student briefing…</div>
              <div style={{fontSize:11,color:"#334455"}}>Analysing hazards · live METAR · TAF forecast · airspace</div>
            </div>}
            {briefing&&<div style={{background:"rgba(0,15,35,0.8)",border:"1px solid rgba(0,180,255,0.18)",borderRadius:10,padding:"20px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#00B4FF",letterSpacing:"0.12em",fontWeight:"bold"}}>★ CFI AI SAFETY BRIEFING — {selected}</div>
                <button onClick={generateBriefing} style={{background:"rgba(0,180,255,0.1)",border:"1px solid rgba(0,180,255,0.3)",borderRadius:5,padding:"5px 12px",color:"#00B4FF",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:9}}>↻ REGENERATE</button>
              </div>
              <pre style={{fontSize:12,color:"#C0D8F0",lineHeight:1.9,whiteSpace:"pre-wrap",fontFamily:"'Inter',sans-serif"}}>{briefing}</pre>
              <div style={{marginTop:14,paddingTop:12,borderTop:"1px solid rgba(255,255,255,0.05)",fontSize:9,color:"#223344",fontFamily:"'DM Mono',monospace"}}>AI-GENERATED USING LIVE METAR/TAF DATA · FOR EDUCATIONAL PURPOSES ONLY · NOT A SUBSTITUTE FOR CFI INSTRUCTION</div>
            </div>}
          </div>}
        </div>
      </div>
    </div>
  );
}
