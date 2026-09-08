import { useState, useEffect } from "react";

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
  KPIE:{ name:"St Pete-Clearwater International Airport", city:"Clearwater, FL", elevation:11, class:"Class C", type:"Towered", runways:["18/36 — 8,800ft","07/25 — 4,800ft"], region:"florida", weather_icao:"KPIE",
    hazards:[
      {id:"CLASS_C",phase:["all"],sev:"critical",icon:"📡",title:"Class C Airspace — Mandatory Contact Before Entry",why:"Class C requires two-way radio contact before entry — a clearance is not required but contact is.",detail:"KPIE is Class C airspace from surface to 3,200ft MSL, with a shelf from 1,200ft to 3,200ft extending 10nm. You must establish two-way communication with St Pete-Clearwater Approach before entering Class C. Squawk your assigned code."},
      {id:"AIRLINE",phase:["all"],sev:"high",icon:"✈",title:"Commercial and Charter Traffic Mix",why:"Scheduled airline and charter operations share the field with training traffic.",detail:"KPIE handles commercial airline, charter, and cargo traffic alongside training aircraft. Be alert to wake turbulence on departure and arrival. Monitor approach and tower frequencies carefully for commercial traffic sequencing."},
      {id:"CLASS_B",phase:["departure","all"],sev:"high",icon:"📡",title:"Tampa Class B Immediately Adjacent",why:"Tampa International's Class B begins just east of KPIE.",detail:"Departing north or east from KPIE brings you immediately towards Tampa International's Class B airspace. Co-ordinate with St Pete-Clearwater Approach before any northbound or eastbound departure climb."},
      {id:"CB",phase:["all"],sev:"high",icon:"⛈",title:"Tampa Bay Afternoon Thunderstorms",detail:"Tampa Bay is statistically the most lightning-active region in the USA. Sea breeze convergence creates rapidly developing CB. Ground by 13:00 in summer."},
    ],
    atcNotes:"Tower 120.6 · Ground 121.6 · Clearance 125.025\nSt Pete-Clearwater Approach 124.9 · ATIS 124.6",
    cfiNotes:"KPIE is good for introducing Class C procedures. Key lessons: mandatory contact before entry, transponder requirements, and commercial traffic awareness. Watch the Tampa Class B to the east on departure.",
  },
  KVDF:{ name:"Tampa Executive Airport (Vandenberg)", city:"Tampa, FL", elevation:14, class:"Class D", type:"Towered", runways:["09/27 — 3,500ft","18/36 — 3,200ft"], region:"florida", weather_icao:"KVDF",
    hazards:[
      {id:"CLASS_B",phase:["all"],sev:"critical",icon:"📡",title:"Tampa International Class B — Inside the Lateral Boundary",why:"KVDF sits inside Tampa's Class B outer boundary requiring careful altitude management.",detail:"KVDF operates inside Tampa International's Class B lateral boundary. Strict altitude restrictions apply — the Class B shelf begins at 1,500ft MSL in this sector. KVDF Tower co-ordinates with Tampa Approach. Do not climb without explicit clearance."},
      {id:"SHORT",phase:["takeoff","landing"],sev:"high",icon:"🛬",title:"Short Runways — Performance Planning Required",why:"Both runways are short for a busy training environment.",detail:"Runway 09/27 is 3,500ft and 18/36 is 3,200ft. In summer heat and humidity, density altitude will reduce performance. Always calculate actual take-off and landing distances. A go-around decision must be made early."},
      {id:"AIRSPACE",phase:["all"],sev:"high",icon:"📡",title:"Complex Overlapping Airspace",why:"KVDF sits in one of Florida's most complex airspace environments.",detail:"Tampa International to the northwest, MacDill AFB Class C/P-50 restricted area to the south, and St Pete-Clearwater Class C to the west. Know your airspace chart thoroughly before flying in this area."},
      {id:"CB",phase:["all"],sev:"high",icon:"⛈",title:"Tampa Bay Thunderstorm Convergence",detail:"Tampa Bay sea breeze convergence creates rapid CB development. Ground all training by 13:00 in summer months."},
    ],
    atcNotes:"Tower 119.1 · Ground 121.6 · Tampa Approach 119.9\nP-50 (MacDill) — check NOTAM before southbound flight.",
    cfiNotes:"KVDF is complex airspace — excellent for advanced students but not appropriate for early solos without specific Class B/airspace briefing. The MacDill P-50 restricted area to the south must be pre-briefed.",
  },
  KCLW:{ name:"Clearwater Airpark", city:"Clearwater, FL", elevation:71, class:"Uncontrolled", type:"Non-Towered", runways:["16/34 — 3,000ft"], region:"florida", weather_icao:"KPIE",
    hazards:[
      {id:"NONTOW",phase:["all"],sev:"critical",icon:"📻",title:"Non-Towered Inside Class C Airspace",why:"Unusual combination — uncontrolled field inside St Pete-Clearwater Class C.",detail:"KCLW is a non-towered field located within the St Pete-Clearwater Class C airspace. You must contact St Pete-Clearwater Approach and receive a Class C clearance before operating in and out of KCLW. CTAF 122.8 — but ATC contact is mandatory."},
      {id:"SHORT",phase:["takeoff","landing"],sev:"critical",icon:"🛬",title:"Very Short Single Runway — 3,000ft Only",why:"One of the shortest runways in the Tampa Bay training area.",detail:"Runway 16/34 is only 3,000ft. In summer heat with any density altitude penalty this is operationally demanding. Performance calculations are essential. A go-around must be initiated early — overrun risk is real."},
      {id:"CLASS_B",phase:["departure"],sev:"high",icon:"📡",title:"Tampa Class B to the East",why:"Northbound or eastbound departures trend towards Tampa Class B.",detail:"Departing north or east climbs into the Tampa International Class B airspace shelf. Maintain strict altitude awareness and confirm your co-ordination with Clearwater Approach before any non-standard departure routing."},
      {id:"CB",phase:["all"],sev:"high",icon:"⛈",title:"Tampa Bay Thunderstorms",detail:"Tampa Bay sea breeze convergence. Ground all flights by 13:00 in summer. No tower to give weather warnings — you are responsible for your own weather awareness."},
    ],
    atcNotes:"CTAF 122.8 — Non-towered BUT inside Class C.\nMandatory: contact St Pete-Clearwater Approach 124.9 before entry/exit.\nNo tower weather service — monitor independently.",
    cfiNotes:"KCLW is excellent for teaching the combination of non-towered procedures AND Class C requirements simultaneously. Students must understand that CTAF self-announce alone is not sufficient here — ATC contact is mandatory. Short runway demands disciplined approach technique.",
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

  // ── UK TRAINING AIRFIELDS ────────────────────────────────────────────────
  EGTE:{ name:"Exeter Airport", city:"Exeter, UK", elevation:102, class:"Class D", type:"Towered", runways:["08/26 — 6,834ft","13/31 — 3,294ft"], region:"uk", weather_icao:"EGTE",
    hazards:[
      {id:"TERRAIN",phase:["all"],sev:"high",icon:"⛰",title:"Dartmoor Terrain — Immediate West",why:"Dartmoor rises to 2,038ft immediately west of EGTE.",detail:"Dartmoor National Park begins within 5nm west of Exeter. High ground up to 2,038ft (High Willhays) is inside the Exeter CTA/CTR boundary. In reduced visibility or low cloud, westbound departures carry a CFIT risk. Know your MSA in all sectors before departure in marginal VMC."},
      {id:"ICING",phase:["all"],sev:"high",icon:"❄",title:"Icing Risk — Dartmoor Orographic Lift",why:"Orographic cloud on Dartmoor brings significant icing in winter.",detail:"Dartmoor forces moist airflow upward, generating orographic cloud with serious icing potential in autumn and winter. Even in VMC at field level, icing conditions can exist on the western approaches. Check SIGMET and icing forecasts before winter operations."},
      {id:"SEA_FRET",phase:["all"],sev:"high",icon:"🌫",title:"Sea Fret — Rapid Visibility Reduction",why:"Estuary location causes sudden sea fret formation.",detail:"Exeter sits close to the Exe estuary. Sea fret (coastal fog) can form and reduce visibility rapidly — from CAVOK to 200m in 20 minutes in certain easterly airflow conditions. Monitor METAR trends and TAF carefully."},
      {id:"BIRD",phase:["takeoff","landing"],sev:"medium",icon:"🦅",title:"Bird Activity — Exe Estuary",detail:"The Exe estuary is a major bird habitat. Waders and wildfowl are common on approaches over the estuary."},
    ],
    atcNotes:"Tower 119.8 · Ground 121.9 · Approach 128.975\nDartmoor terrain to the west — confirm MSA before westbound departures.",
    cfiNotes:"Exeter is Skyborne's home base. Dartmoor terrain to the west is the key hazard — brief MSA sectors specifically. Sea fret can close the field very quickly in easterly flow.",
  },
  EGBP:{ name:"Cotswold Airport (Kemble)", city:"Kemble, UK", elevation:433, class:"Uncontrolled", type:"Non-Towered", runways:["08/26 — 6,001ft","18/36 — 3,051ft"], region:"uk", weather_icao:"EGBP",
    hazards:[
      {id:"NONTOW",phase:["all"],sev:"high",icon:"📻",title:"Non-Towered — A/G Radio Only",why:"No ATC — self-announce on A/G frequency.",detail:"Kemble has no ATC — only an Air/Ground (A/G) radio operator who provides information but cannot give clearances or instructions. Self-announce all positions. A/G cannot sequence traffic. All separation is pilot responsibility."},
      {id:"GLIDER",phase:["pattern","all"],sev:"high",icon:"🛩",title:"Glider and Powered Glider Operations",why:"Kemble is an active glider site with unpowered aircraft sharing the circuit.",detail:"Cotswold Airport has active glider operations. Gliders have no ATC transponder requirement and may not be on radio. They have right of way over powered aircraft. Maintain lookout above, below and at pattern altitude. Ask A/G about glider activity before joining."},
      {id:"AIRSPACE",phase:["all"],sev:"medium",icon:"📡",title:"Brize Norton MATZ/CTA Proximity",why:"RAF Brize Norton MATZ is immediately north of Kemble.",detail:"RAF Brize Norton operates a Military Air Traffic Zone (MATZ) immediately to the north. Northbound departures from Kemble may penetrate the MATZ. Contact Brize Norton on 124.275 if routing north."},
    ],
    atcNotes:"A/G Radio 118.9 — No ATC, information only.\nBrize Norton MATZ to north — 124.275 if routing northbound.",
    cfiNotes:"Kemble is good for introducing non-towered UK operations and the A/G radio concept. The MATZ awareness lesson is important — students often don't understand the difference between CAS and MATZ.",
  },
  EGBJ:{ name:"Gloucestershire Airport", city:"Staverton, UK", elevation:101, class:"Class D", type:"Towered", runways:["09/27 — 5,046ft","04/22 — 3,287ft"], region:"uk", weather_icao:"EGBJ",
    hazards:[
      {id:"TERRAIN",phase:["departure","all"],sev:"high",icon:"⛰",title:"Cotswold Escarpment — Eastern Terrain",why:"The Cotswold scarp rises to 1,000ft+ immediately east.",detail:"The Cotswold escarpment rises sharply east of Gloucestershire. Eastbound departures encounter rising terrain quickly. In low cloud or reduced VMC, eastbound routing requires terrain awareness. Check MSA for eastern sectors."},
      {id:"ICING",phase:["all"],sev:"high",icon:"❄",title:"Orographic Icing — Cotswold Uplift",detail:"Moist westerly airflow forced over the Cotswolds generates significant icing potential in winter and autumn. Check SIGMET before departure."},
      {id:"SEA_FRET",phase:["all"],sev:"high",icon:"🌫",title:"Severn Valley Fog",why:"Severn estuary fog can rapidly reduce visibility.",detail:"The Severn estuary funnels moisture inland causing radiation and advection fog in the valley. Gloucestershire is susceptible to rapid visibility reduction especially at dawn and dusk in autumn/winter."},
      {id:"BIRD",phase:["takeoff","landing"],sev:"medium",icon:"🦅",title:"Severn Valley Bird Activity",detail:"Proximity to Severn estuary and Berkeley Vale wetlands brings significant bird activity."},
    ],
    atcNotes:"Tower 122.9 · Approach 128.55 · ATIS 127.475",
    cfiNotes:"Staverton is a busy training field. Cotswold terrain to the east is the key brief. Severn fog can close the field quickly in autumn/winter — weather decision making is a key training topic here.",
  },
  EGBK:{ name:"Sywell Aerodrome", city:"Northampton, UK", elevation:429, class:"Uncontrolled", type:"Non-Towered", runways:["03/21 — 3,609ft","10/28 — 2,999ft"], region:"uk", weather_icao:"EGBK",
    hazards:[
      {id:"NONTOW",phase:["all"],sev:"high",icon:"📻",title:"Non-Towered — AFIS",why:"AFIS provides information only — no ATC clearances.",detail:"Sywell has an Aerodrome Flight Information Service (AFIS). AFIS gives information but cannot issue clearances or instructions. All separation is pilot responsibility. Self-announce on AFIS frequency 122.7."},
      {id:"TRAFFIC",phase:["pattern","all"],sev:"high",icon:"✈",title:"High Training Volume — Multiple Schools",why:"Sywell is a busy training aerodrome with multiple schools sharing the pattern.",detail:"Multiple flight training organisations operate at Sywell. The circuit can be busy with mixed traffic at different skill levels. Announce all positions clearly. Do not assume the pattern is empty."},
      {id:"BIRD",phase:["takeoff","landing"],sev:"medium",icon:"🦅",title:"Rural Wildlife — Bird Activity",detail:"Agricultural land surrounds Sywell. Lapwings, corvids and raptors are common on and near the runways."},
    ],
    atcNotes:"AFIS 122.7 — Information only, not ATC.\nAll separation is pilot responsibility.",
    cfiNotes:"Sywell is a good introduction to AFIS operations — the distinction between AFIS (information) and ATC (instructions) is a key teaching point. High traffic volume means lookout discipline is critical.",
  },
  EGHN:{ name:"Isle of Wight Airport (Sandown)", city:"Sandown, Isle of Wight", elevation:55, class:"Uncontrolled", type:"Non-Towered", runways:["05/23 — 2,952ft","14/32 — 1,968ft"], region:"uk", weather_icao:"EGHN",
    hazards:[
      {id:"WATER",phase:["departure","all"],sev:"critical",icon:"🌊",title:"Over-Water Flight — Solent Crossing",why:"All approaches require over-water flight across the Solent.",detail:"Sandown Airport is on the Isle of Wight — all arrivals and departures involve over-water flight across the Solent. Students must carry a life jacket and brief ditching procedures before every flight. Check Solent weather and sea state. The Solent is busy with commercial shipping — low-level over-water flying requires increased situational awareness."},
      {id:"SHORT",phase:["takeoff","landing"],sev:"critical",icon:"🛬",title:"Very Short Runways — 14/32 at 1,968ft",why:"1,968ft is extremely short and requires disciplined technique.",detail:"Runway 14/32 is only 1,968ft. This is very short for most touring aircraft. Runway 05/23 at 2,952ft is the primary runway. Calculate performance carefully for all runways. A go-around on 14/32 requires immediate climb to avoid terrain."},
      {id:"NONTOW",phase:["all"],sev:"high",icon:"📻",title:"Non-Towered Airport",detail:"No ATC. Self-announce all positions on CTAF 123.5."},
      {id:"SEA_FRET",phase:["all"],sev:"high",icon:"🌫",title:"Sea Fret — Rapid Visibility Reduction",detail:"Island location means sea fret can form very rapidly. The Solent may be VMC while the island is IMC. Check TAF and METAR trends carefully."},
    ],
    atcNotes:"A/G 123.5 — Information only.\nSolent crossing — life jackets mandatory.",
    cfiNotes:"Sandown is an important life jacket and over-water briefing opportunity. Students should formally brief ditching procedures before every sortie. The short runway demands precise technique.",
  },
  EGKA:{ name:"Shoreham Airport (Brighton City)", city:"Shoreham-by-Sea, UK", elevation:7, class:"Class D", type:"Towered", runways:["02/20 — 3,927ft","07/25 — 2,598ft"], region:"uk", weather_icao:"EGKA",
    hazards:[
      {id:"SEA",phase:["takeoff","landing"],sev:"high",icon:"🌊",title:"English Channel — Over-Water Approaches",why:"Coastal location means approaches over the sea from the south.",detail:"Shoreham is immediately adjacent to the English Channel. Southerly approaches are over water. Northerly departures immediately enter the South Downs. Life jacket carriage is advisable for any southerly routing. Sea fret can reduce visibility rapidly."},
      {id:"TERRAIN",phase:["departure","all"],sev:"high",icon:"⛰",title:"South Downs — Immediate Northern Terrain",why:"South Downs rise to 800ft immediately north of Shoreham.",detail:"The South Downs AONB rises to 800ft immediately north of Shoreham. Northbound departures climb into rising terrain. In low cloud, northbound departures require specific terrain awareness. MSA north of the field is significantly higher than the circuit altitude."},
      {id:"SHORT",phase:["takeoff","landing"],sev:"high",icon:"🛬",title:"Short Runway 07/25 — 2,598ft",detail:"Runway 07/25 is 2,598ft. Know your aircraft's performance. Use runway 02/20 (3,927ft) as the primary runway."},
      {id:"AIRSPACE",phase:["all"],sev:"high",icon:"📡",title:"Gatwick Class D / London TMA",why:"Gatwick's CTA begins close overhead.",detail:"Gatwick Airport's Class D CTA begins at 2,500ft directly overhead Shoreham. The London TMA overlies the area. Do not climb above 2,500ft without explicit Gatwick Approach clearance."},
    ],
    atcNotes:"Tower 123.15 · Approach 123.15 · ATIS 132.4\nGatwick CTA from 2,500ft — do not climb without clearance.",
    cfiNotes:"Shoreham is a good teaching field for coastal operations, over-water awareness, and CAS boundary management. South Downs terrain to the north needs specific briefing.",
  },
  EGHR:{ name:"Chichester/Goodwood Aerodrome", city:"Goodwood, West Sussex", elevation:110, class:"Uncontrolled", type:"Non-Towered", runways:["24/06 — 2,713ft","10/28 — 1,837ft","14/32 — 1,637ft"], region:"uk", weather_icao:"EGHR",
    hazards:[
      {id:"SHORT",phase:["takeoff","landing"],sev:"critical",icon:"🛬",title:"Very Short Runways — Multiple Options",why:"All runways are short and demand disciplined technique.",detail:"Goodwood has three short runways — the longest is 2,713ft. Runway 10/28 at 1,837ft and 14/32 at 1,637ft are extremely short. Know your aircraft's demonstrated distances before accepting any runway. Soft/wet grass surface adds significant landing roll."},
      {id:"NONTOW",phase:["all"],sev:"high",icon:"📻",title:"Non-Towered — AFIS",detail:"Goodwood has AFIS on 122.45. AFIS provides information only — not ATC. All separation is pilot responsibility."},
      {id:"AIRSPACE",phase:["all"],sev:"high",icon:"📡",title:"Solent CTA and Gatwick CTA",detail:"Goodwood sits between the Solent CTA to the south and Gatwick's CTA to the north. Climbing above circuit altitude in either direction requires care. Know the CTA floor for your departure direction."},
      {id:"GRASS",phase:["takeoff","landing"],sev:"high",icon:"🌧",title:"Grass Surface — Performance Reduction",why:"Wet or long grass significantly increases stopping distance.",detail:"All runways at Goodwood are grass. In wet conditions, landing roll can increase by 60% or more. Add significant safety margins to demonstrated landing distance. Check ATIS for grass condition reports."},
    ],
    atcNotes:"AFIS 122.45 — Information only.\nCheck grass condition before landing.",
    cfiNotes:"Goodwood is classic UK grass strip training. Key lessons: performance on grass, AFIS operations, and CAS awareness. Very short runways demand accurate technique — this is not a field for early solo students.",
  },
  EGLF:{ name:"Farnborough Airport", city:"Farnborough, UK", elevation:238, class:"Class D", type:"Towered", runways:["06/24 — 8,008ft","11/29 — 4,166ft"], region:"uk", weather_icao:"EGLF",
    hazards:[
      {id:"AIRSHOW",phase:["all"],sev:"critical",icon:"✈",title:"Farnborough Airshow — Biennial Closure",why:"Every 2 years EGLF closes for the international airshow with extensive TFRs.",detail:"Farnborough hosts the biennial SBAC airshow — one of the world's largest aviation events. The airport closes to normal traffic and an extensive TFR covers the region. Check NOTAMs before any flight near Farnborough in July of even-numbered years."},
      {id:"AIRSPACE",phase:["all"],sev:"high",icon:"📡",title:"London TMA — Complex Layered Airspace",why:"Farnborough sits under London's complex TMA.",detail:"EGLF is inside the London TMA. The airspace above and around Farnborough is layered with restrictions. Departures require specific co-ordination with Farnborough LARS (124.325). Brief the airspace structure before every flight."},
      {id:"BIZ",phase:["pattern","landing"],sev:"high",icon:"✈",title:"Business Jet Traffic",why:"EGLF is a major business aviation hub.",detail:"Farnborough handles significant business jet traffic. Wake turbulence from large jets is a real hazard for training aircraft sharing the pattern. Maintain separation and request wake turbulence spacing from ATC."},
    ],
    atcNotes:"Tower 130.05 · Ground 121.75 · LARS 124.325\nLondon TMA — specific departure co-ordination required.",
    cfiNotes:"Farnborough is an advanced training environment. London TMA airspace awareness and business jet wake turbulence are the key briefs. Airshow TFR check is a mandatory NOTAM lesson.",
  },
  EGBO:{ name:"Wolverhampton Halfpenny Green Airport", city:"Bobbington, UK", elevation:283, class:"Uncontrolled", type:"Non-Towered", runways:["04/22 — 4,501ft","10/28 — 3,524ft","16/34 — 2,257ft"], region:"uk", weather_icao:"EGBO",
    hazards:[
      {id:"NONTOW",phase:["all"],sev:"high",icon:"📻",title:"Non-Towered — AFIS",detail:"AFIS on 123.0. Information only — not ATC. All separation is pilot responsibility. Self-announce all positions."},
      {id:"GLIDER",phase:["pattern","all"],sev:"high",icon:"🛩",title:"Glider and Microlight Operations",detail:"Halfpenny Green hosts active glider and microlight operations alongside conventional training. Gliders have priority and may not be on radio. Maintain lookout at all altitudes."},
      {id:"AIRSPACE",phase:["departure","all"],sev:"medium",icon:"📡",title:"Birmingham CTA Proximity",why:"Birmingham's Class D begins relatively close to the north.",detail:"Birmingham Airport's Class D CTA begins at low levels to the northeast. Check Birmingham Approach (118.05) before northbound or northeastbound departures if climbing above local circuit altitude."},
    ],
    atcNotes:"AFIS 123.0 — Information only.\nCheck Birmingham CTA before northbound departures.",
    cfiNotes:"Halfpenny Green is a good West Midlands training aerodrome. Mixed operations with gliders and microlights demand specific briefing. AFIS concept and CTA boundary awareness are the teaching priorities.",
  },
  EGCB:{ name:"Manchester Barton Aerodrome", city:"Eccles, Manchester", elevation:73, class:"Uncontrolled", type:"Non-Towered", runways:["09/27 — 3,051ft","13/31 — 1,969ft","18/36 — 2,461ft"], region:"uk", weather_icao:"EGCB",
    hazards:[
      {id:"NONTOW",phase:["all"],sev:"high",icon:"📻",title:"Non-Towered Inside Manchester CTA",why:"Uncontrolled field inside complex Class D CTA.",detail:"Barton is a non-towered aerodrome within the Manchester Class D Control Zone. Departures and arrivals require co-ordination with Manchester Approach (119.4) for CTA transits. Self-announce on AFIS 122.7 for aerodrome traffic — but ATC clearance is needed to enter/exit the CTA."},
      {id:"CTA",phase:["departure","arrival"],sev:"critical",icon:"📡",title:"Manchester Class D CTA — ATC Clearance Required",why:"Manchester's CTA surrounds Barton — you cannot leave without a clearance.",detail:"Manchester Airport's Class D CTA extends to low levels around Barton. Any departure that climbs above 1,500ft ALT or routes beyond the local area requires a Manchester Approach clearance. Contact Manchester on 119.4 before departure."},
      {id:"SHORT",phase:["takeoff","landing"],sev:"high",icon:"🛬",title:"Short Runways — Grass Surface",detail:"Runways range from 1,969ft to 3,051ft on grass. Performance planning is essential. Wet grass significantly increases landing roll."},
    ],
    atcNotes:"AFIS 122.7 (aerodrome info) · Manchester Approach 119.4 (CTA clearances)\nMandatory: contact Manchester Approach before leaving the local area.",
    cfiNotes:"Barton is one of the most educationally complex training aerodromes in the UK — non-towered field inside Class D CTA. The lesson: two separate radio calls are needed (AFIS for aerodrome, Manchester for CTA transit). An excellent real-world airspace lesson."},
  EGNH:{ name:"Blackpool Airport", city:"Blackpool, UK", elevation:34, class:"Class D", type:"Towered", runways:["10/28 — 6,001ft","13/31 — 4,997ft"], region:"uk", weather_icao:"EGNH",
    hazards:[
      {id:"SEA_FRET",phase:["all"],sev:"critical",icon:"🌫",title:"Irish Sea Sea Fret — Rapid Closure",why:"Coastal position makes Blackpool extremely susceptible to sea fret.",detail:"Blackpool sits immediately adjacent to the Irish Sea. Sea fret (haar/coastal fog) can reduce visibility from clear to 100m within 15 minutes in onshore wind conditions. Diversion planning is mandatory — always carry enough fuel for an alternate. Check TREND forecasts and back-bearing conditions."},
      {id:"ICING",phase:["all"],sev:"high",icon:"❄",title:"Winter Icing — Maritime Airflow",why:"Irish Sea maritime airflow creates persistent icing risk in winter.",detail:"Moist maritime air from the Irish Sea creates significant airframe icing risk from October to April. Even in VMC, icing conditions can exist at low levels. Check icing SIGMET and AIRMET before all winter operations."},
      {id:"BIRD",phase:["takeoff","landing"],sev:"high",icon:"🦅",title:"Coastal Bird Activity",detail:"Blackpool's coastal location brings significant gull, wader and waterfowl activity. Report all bird strikes and hazardous activity to the tower."},
    ],
    atcNotes:"Tower 119.95 · Ground 121.75 · Approach 135.95\nSea fret risk — always plan diversion and carry alternate fuel.",
    cfiNotes:"Blackpool's sea fret is operationally significant and not just a textbook hazard — brief it as a real scenario. Diversion planning and alternate fuel carriage are essential disciplines here."},
  EGPD:{ name:"Aberdeen Airport", city:"Aberdeen, UK", elevation:215, class:"Class D", type:"Towered", runways:["16/34 — 6,001ft","11/29 — 4,757ft"], region:"uk", weather_icao:"EGPD",
    hazards:[
      {id:"ICING",phase:["all"],sev:"critical",icon:"❄",title:"Severe Icing Risk — North Sea Maritime",why:"Aberdeen is one of the UK's highest-risk icing environments.",detail:"Aberdeen's North Sea exposure and northern latitude create severe airframe icing conditions for much of the year (October to May). Icing can occur at low levels in maritime airflow. SIGMET monitoring is essential. De-icing facilities are available but student aircraft are not certified for flight in icing conditions."},
      {id:"SEA_FRET",phase:["all"],sev:"high",icon:"🌫",title:"Haar (Sea Fret) — North Sea",why:"Aberdeen is the UK's most haar-prone airport.",detail:"Aberdeen sees frequent haar (North Sea sea fret) that can reduce visibility to 50-100m with almost no warning. Haar can persist for days. Always carry fuel for an alternate and check regional forecasts carefully."},
      {id:"OIL",phase:["all"],sev:"high",icon:"🚁",title:"Offshore Helicopter Traffic — North Sea Operations",why:"Aberdeen is a major North Sea oil helicopter hub.",detail:"EGPD handles very high helicopter traffic for North Sea oil platforms. Helicopters operate at low level on instrument approaches and may not always follow standard VFR traffic patterns. Maintain vigilant lookout and follow all ATC instructions precisely."},
    ],
    atcNotes:"Tower 118.1 · Ground 121.7 · Approach 120.4\nHeavy helicopter traffic — maintain lookout at all altitudes.",
    cfiNotes:"Aberdeen is an advanced training environment for Scottish weather operations. Haar and icing are genuinely hazardous here. A clear diversion planning and alternate fuel brief is essential before every winter flight."},
  EGQL:{ name:"RAF Leuchars (St Andrews)", city:"St Andrews, Fife", elevation:38, class:"Class D", type:"Towered", runways:["09/27 — 9,006ft","18/36 — 4,498ft"], region:"uk", weather_icao:"EGQL",
    hazards:[
      {id:"MILITARY",phase:["all"],sev:"critical",icon:"📡",title:"Military Aerodrome — Strict Procedures",why:"RAF Leuchars operates under military ATC with specific civil visiting procedures.",detail:"Leuchars is an active military station. Prior Permission Required (PPR) for all civil visits. Military aircraft operate alongside civil traffic. Follow all ATC instructions precisely and do not deviate from cleared routes without permission."},
      {id:"SEA_FRET",phase:["all"],sev:"high",icon:"🌫",title:"North Sea Haar",detail:"East coast location — North Sea haar can form rapidly and reduce visibility significantly. Always plan an alternate."},
      {id:"ICING",phase:["all"],sev:"high",icon:"❄",title:"Scottish Winter Icing",detail:"Scottish maritime airflow — significant icing risk October to April. Check SIGMET before winter operations."},
    ],
    atcNotes:"Military ATC — contact in advance. PPR required for all civil flights.\nTower 118.625 · Approach 126.5",
    cfiNotes:"Leuchars is an excellent military/civil co-operation teaching environment. PPR process and military procedure awareness are the key lessons. Haar and icing are real Scottish hazards."},
  EGBE:{ name:"Coventry Airport", city:"Coventry, UK", elevation:267, class:"Class D", type:"Towered", runways:["05/23 — 6,020ft","18/36 — 3,281ft"], region:"uk", weather_icao:"EGBE",
    hazards:[
      {id:"AIRSPACE",phase:["all"],sev:"high",icon:"📡",title:"Birmingham CTA — Close Proximity",why:"Birmingham Airport's CTA begins close to Coventry.",detail:"Birmingham's Class D CTA is immediately adjacent. Northbound departures and arrivals from some directions route through or near Birmingham CTA. Contact Birmingham Approach (118.05) if routing northbound above circuit altitude."},
      {id:"BIRD",phase:["takeoff","landing"],sev:"medium",icon:"🦅",title:"Central England Bird Activity",detail:"Agricultural land surrounds Coventry. Corvids, lapwings and raptors are common."},
      {id:"ICING",phase:["all"],sev:"medium",icon:"❄",title:"Winter Icing — Midlands",detail:"Midlands winter weather can bring significant icing potential in maritime airflow. Check SIGMET and icing AIRMET before winter operations."},
    ],
    atcNotes:"Tower 124.8 · Approach 119.25 · ATIS 113.475\nBirmingham CTA to north — contact Birmingham Approach before northbound departures.",
    cfiNotes:"Coventry is a well-equipped training field with good runway length. Birmingham CTA proximity is the key airspace lesson."},
  EGBW:{ name:"Wellesbourne Mountford Aerodrome", city:"Wellesbourne, Warwickshire", elevation:159, class:"Uncontrolled", type:"Non-Towered", runways:["18/36 — 4,416ft","11/29 — 3,209ft"], region:"uk", weather_icao:"EGBW",
    hazards:[
      {id:"NONTOW",phase:["all"],sev:"high",icon:"📻",title:"Non-Towered — AFIS",detail:"Wellesbourne has AFIS on 124.025. Information only — not ATC. All separation is pilot responsibility. Self-announce all positions."},
      {id:"TRAFFIC",phase:["pattern","all"],sev:"high",icon:"✈",title:"High Volume Training Traffic",why:"Wellesbourne is one of the UK's busiest training aerodromes.",detail:"Multiple training schools operate at Wellesbourne generating high circuit traffic. Announce all positions clearly. Do not assume the circuit is empty. Visual lookout is critical."},
      {id:"AIRSPACE",phase:["departure"],sev:"medium",icon:"📡",title:"Birmingham CTA Proximity",detail:"Birmingham CTA to the northwest. Check Birmingham Approach (118.05) before northwest departures if climbing above local area."},
    ],
    atcNotes:"AFIS 124.025 — Information only.\nHigh training volume — announce all circuit positions.",
    cfiNotes:"Wellesbourne is a high-volume training aerodrome. Circuit discipline and lookout are the priorities. AFIS concept is important — students must understand they cannot receive ATC clearances here."},
  EGNJ:{ name:"Humberside Airport", city:"Humberside, UK", elevation:121, class:"Class D", type:"Towered", runways:["08/26 — 7,218ft","03/21 — 4,898ft"], region:"uk", weather_icao:"EGNJ",
    hazards:[
      {id:"SEA_FRET",phase:["all"],sev:"high",icon:"🌫",title:"North Sea Haar / Sea Fret",why:"East coast location — North Sea haar is frequent.",detail:"Humberside's east coast location makes it susceptible to North Sea haar. Visibility can drop to 200m rapidly in onshore easterly conditions. Always plan an alternate and carry diversion fuel. Check TREND forecasts."},
      {id:"ICING",phase:["all"],sev:"high",icon:"❄",title:"Winter Icing — North Sea Maritime",detail:"Maritime airflow from the North Sea brings icing risk October to April. Check SIGMET before winter operations."},
      {id:"BIRD",phase:["takeoff","landing"],sev:"high",icon:"🦅",title:"Humber Estuary Bird Activity",why:"Humber estuary is a major RAMSAR wetland site.",detail:"The Humber estuary is internationally designated for birdlife. Large flocks of waders, ducks and geese are common on approach and departure paths especially during migration. Report all bird activity to ATC."},
    ],
    atcNotes:"Tower 124.675 · Approach 119.125 · ATIS 116.6\nBird activity significant — report to ATC.",
    cfiNotes:"Humberside is good for introducing sea fret and North Sea icing hazards. The Humber bird activity is genuinely significant — brief it before every sortie."},
  EGNO:{ name:"Warton Aerodrome (BAE Systems)", city:"Warton, Lancashire", elevation:55, class:"Class D", type:"Towered", runways:["08/26 — 7,999ft","14/32 — 4,593ft"], region:"uk", weather_icao:"EGNO",
    hazards:[
      {id:"MILITARY",phase:["all"],sev:"critical",icon:"📡",title:"BAE Systems Test & Military Operations — PPR Required",why:"Warton is an active military aircraft test and production facility.",detail:"Warton is the main BAE Systems test and production site for Typhoon and other military aircraft. Very strict PPR process for all visiting aircraft. Test flying operations take priority. Military-standard ATC procedures apply. Do not attempt to visit without prior permission and specific clearance."},
      {id:"SEA_FRET",phase:["all"],sev:"high",icon:"🌫",title:"Ribble Estuary Sea Fret",detail:"Coastal location adjacent to Ribble estuary — sea fret can form rapidly. Always plan alternate."},
      {id:"ICING",phase:["all"],sev:"high",icon:"❄",title:"Lancashire Coastal Icing",detail:"Irish Sea maritime airflow brings significant icing risk in winter. Check SIGMET before operations."},
    ],
    atcNotes:"Military/test ATC — PPR required for all visits.\nTower 130.8 · Approach 130.8",
    cfiNotes:"Warton is primarily an educational visit — the PPR process and military/civil interface are the key lessons. Not suitable for general training use without specific liaison with BAE Systems.",
  },
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

// Colourises raw METAR tokens
function coloriseMetar(metar) {
  if (!metar) return null;
  return metar.split(" ").map((tok, i) => {
    let color = "#6688AA";
    if (i===0) color="#00B4FF";
    else if (/^\d{6}Z$/.test(tok)) color="#556677";
    else if (/^(\d{3}|VRB)\d{2,3}(G\d{2,3})?KT$/.test(tok)) color="#FFD700";
    else if (tok==="9999"||tok==="CAVOK"||/^\d{4}$/.test(tok)) color="#00C896";
    else if (/TSRA|TSGR|\+TS/.test(tok)) color="#FF3B3B";
    else if (/\+RA|\+SN|FZRA|FZDZ/.test(tok)) color="#FF8C00";
    else if (/\b(RA|SN|DZ|SH)\b/.test(tok)) color="#FFD700";
    else if (/\b(FG|BR|HZ)\b/.test(tok)) color="#AA88FF";
    else if (/\b(SQ|DS|SS)\b/.test(tok)) color="#FF3B3B";
    else if (/^(FEW|SCT|BKN|OVC)\d{3}(CB|TCU)?$/.test(tok)) {
      if (tok.includes("CB")) color="#FF3B3B";
      else if (tok.includes("TCU")) color="#FF8C00";
      else if (tok.startsWith("BKN")||tok.startsWith("OVC")) color="#FFD700";
      else color="#00C896";
    }
    else if (tok==="SKC"||tok==="NCD"||tok==="NSC") color="#00C896";
    else if (/^M?\d{2}\/M?\d{2}$/.test(tok)) color="#FF8C00";
    else if (/^[AQ]\d{4}$/.test(tok)) color="#00B4FF";
    else if (/^R\d{2}/.test(tok)) color="#AA88FF";
    return <span key={i} style={{color,marginRight:4,display:"inline-block"}}>{tok}</span>;
  });
}

function parseTAFGroups(taf) {
  if (!taf) return [];
  const lines = taf.replace(/\s+(BECMG|TEMPO|FM\d{6}|PROB\d{2})/g,"\n$1").split("\n");
  return lines.map((line,i)=>{
    let label = i===0?"BASE":null, labelColor="#00B4FF";
    if (/^BECMG/.test(line)){label="BECOMING";labelColor="#FFD700";}
    else if (/^TEMPO/.test(line)){label="TEMPO";labelColor="#FF8C00";}
    else if (/^FM/.test(line)){label="FROM";labelColor="#00C896";}
    else if (/^PROB/.test(line)){label="PROB";labelColor="#FF3B3B";}
    return {label,labelColor,line:line.trim(),hasCB:/TSRA|CB|\+TS/.test(line)};
  }).filter(g=>g.line.length>2);
}

function WeatherStrip({ liveWx, wxLoad }) {
  const [wxTab,setWxTab] = useState("metar");
  if (wxLoad) return <div style={{background:"#0A1828",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"12px 16px",marginBottom:14,fontSize:10,color:"#6688AA",fontFamily:"'DM Mono',monospace"}}>Loading live weather…</div>;
  if (!liveWx) return <div style={{background:"#0A1828",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"12px 16px",marginBottom:14,fontSize:10,color:"#6688AA",fontFamily:"'DM Mono',monospace"}}>No live weather data available.</div>;
  const tafThreats = parseTAFThreats(liveWx.tafs);
  const tafGroups  = parseTAFGroups(liveWx.tafs?.[0]);
  const hasCB      = liveWx.metar && /TSRA|CB|\+TS/.test(liveWx.metar);
  const hasTAF     = liveWx.tafs && liveWx.tafs[0] && liveWx.tafs[0].length > 10;
  return (
    <div style={{background:"#0A1828",border:"1px solid rgba(0,180,255,0.2)",borderRadius:10,marginBottom:14,overflow:"hidden"}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px 8px"}}>
        <div style={{fontSize:10,fontFamily:"'DM Mono',monospace",color:"#00B4FF",letterSpacing:"0.12em",fontWeight:"bold"}}>🌤 LIVE WEATHER</div>
        <span style={{fontSize:8,fontFamily:"'DM Mono',monospace",color:"#FF3B3B"}}>● LIVE</span>
      </div>
      {/* Plain English summary */}
      <div style={{padding:"0 16px 10px"}}>
        <div style={{background:"rgba(255,255,255,0.05)",borderRadius:7,padding:"10px 14px",marginBottom:10}}>
          <div style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#445566",marginBottom:5,letterSpacing:"0.1em"}}>CURRENT CONDITIONS</div>
          <div style={{fontSize:13,color:"#FFFFFF",fontWeight:"500",lineHeight:1.7}}>{interpretMetarShort(liveWx.metar)}</div>
          {hasCB && <div style={{marginTop:7,fontSize:11,color:"#FF3B3B",fontWeight:"bold",background:"rgba(255,59,59,0.1)",border:"1px solid rgba(255,59,59,0.3)",borderRadius:4,padding:"5px 8px"}}>⛈  ACTIVE THUNDERSTORM / CB IN CURRENT METAR</div>}
        </div>
        {tafThreats.length>0 && (
          <div style={{background:"rgba(255,140,0,0.08)",border:"1px solid rgba(255,140,0,0.3)",borderRadius:7,padding:"9px 12px",marginBottom:6}}>
            <div style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#FF8C00",marginBottom:5,letterSpacing:"0.1em"}}>⚠ FORECAST HAZARDS (TAF)</div>
            {tafThreats.map((t,i)=><div key={i} style={{fontSize:12,color:t.color,marginBottom:3,fontWeight:"500"}}>{t.icon}  {t.text}</div>)}
          </div>
        )}
      </div>
      {/* Raw data tabs */}
      <div style={{display:"flex",borderTop:"1px solid rgba(255,255,255,0.07)",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
        {[["metar","METAR"], ...(hasTAF?[["taf","TAF FORECAST"]]:[])] .map(([tid,label])=>(
          <button key={tid} onClick={()=>setWxTab(tid)} style={{background:wxTab===tid?"rgba(0,180,255,0.08)":"none",border:"none",cursor:"pointer",padding:"7px 14px",fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:"0.08em",color:wxTab===tid?"#00B4FF":"#FFFFFF",borderBottom:wxTab===tid?"2px solid #00B4FF":"2px solid transparent",marginBottom:"-1px"}}>
            {label}
          </button>
        ))}
      </div>
      {/* METAR colourised */}
      {wxTab==="metar" && (
        <div style={{padding:"12px 16px 14px"}}>
          <div style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#445566",marginBottom:8,letterSpacing:"0.1em"}}>RAW METAR</div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,lineHeight:2.2,display:"flex",flexWrap:"wrap"}}>{coloriseMetar(liveWx.metar)}</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:"8px 18px",marginTop:12,paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.06)"}}>
            {[["#00B4FF","Station / QNH"],["#FFD700","Wind / BKN cloud"],["#00C896","Visibility / FEW cloud"],["#FF3B3B","Thunderstorm / CB"],["#FF8C00","Heavy wx / Temp"],["#AA88FF","Fog / Mist / RVR"]].map(([c,l])=>(
              <span key={l} style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:c,display:"flex",alignItems:"center",gap:5}}>
                <span style={{width:7,height:7,borderRadius:"50%",background:c,display:"inline-block",flexShrink:0}}/>
                {l}
              </span>
            ))}
          </div>
        </div>
      )}
      {/* TAF parsed */}
      {wxTab==="taf" && hasTAF && (
        <div style={{padding:"12px 16px 14px"}}>
          <div style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#445566",marginBottom:8,letterSpacing:"0.1em"}}>TAF — PARSED BY PERIOD</div>
          {tafGroups.map((g,i)=>(
            <div key={i} style={{marginBottom:7,padding:"9px 12px",borderRadius:6,background:g.hasCB?"rgba(255,59,59,0.08)":"rgba(255,255,255,0.03)",border:`1px solid ${g.hasCB?"rgba(255,59,59,0.3)":"rgba(255,255,255,0.07)"}`,borderLeft:`3px solid ${g.labelColor}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                {g.label&&<span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:g.labelColor,fontWeight:"bold",letterSpacing:"0.1em"}}>{g.label}</span>}
                {g.hasCB&&<span style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#FF3B3B",background:"rgba(255,59,59,0.1)",border:"1px solid rgba(255,59,59,0.3)",padding:"1px 6px",borderRadius:2}}>⛈ CB/TS</span>}
              </div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"#A0BCCC",lineHeight:1.8,wordBreak:"break-all"}}>{g.line}</div>
            </div>
          ))}
        </div>
      )}
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

export default function App() {
  const width = useWindowWidth();
  const isMobile = width<640;
  const isDesktop = width>=1024;
  const [showWelcome, setShowWelcome] = useState(true);
  const [region,setRegion] = useState("florida");
  const [selected,setSelected] = useState("KVRB");
  const [query,setQuery] = useState("KVRB");
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
          {(region==="florida"?floridaFields:region==="phoenix"?phoenixFields:ukFields).map(([code,a])=>{
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

  if (showWelcome) {
    return (
      <div style={{minHeight:"100vh",background:"#050D18",fontFamily:"'Inter',sans-serif",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Inter:wght@300;400;500;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0;}`}</style>
        <div style={{textAlign:"center",marginBottom:40}}>
          <div style={{fontSize:48,marginBottom:12}}>✈</div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:28,fontWeight:"bold",color:"#FFFFFF",letterSpacing:"0.05em",marginBottom:8}}>SAFEROUTE ACADEMY</div>
          <div style={{fontSize:14,color:"#00B4FF",fontWeight:600,letterSpacing:"0.1em",marginBottom:12}}>STUDENT PILOT SAFETY INTELLIGENCE</div>
          <div style={{fontSize:13,color:"#8899AA",maxWidth:380,lineHeight:1.7,margin:"0 auto"}}>Select your training region to get airfield-specific hazard intelligence, live weather, and safety briefings.</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:14,width:"100%",maxWidth:360}}>
          {[
            {id:"florida", flag:"🌴", label:"Florida", desc:"22 airfields · Atlantic Flyway · CB country"},
            {id:"phoenix",  flag:"☀",  label:"Phoenix / Arizona", desc:"11 airfields · Density altitude · Haboob risk"},
            {id:"uk",       flag:"🇬🇧", label:"United Kingdom", desc:"17 airfields · Sea fret · Icing · Class D/G"},
          ].map(r=>(
            <button key={r.id} onClick={()=>{ setRegion(r.id); if(r.id==="uk") selectAirfield("EGTE"); else if(r.id==="phoenix") selectAirfield("KDVT"); else selectAirfield("KVRB"); setShowWelcome(false); }}
              style={{background:"#0A1628",border:"2px solid rgba(0,180,255,0.25)",borderRadius:12,padding:"18px 22px",cursor:"pointer",textAlign:"left",transition:"all 0.2s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(0,180,255,0.7)";e.currentTarget.style.background="#0D1E32";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(0,180,255,0.25)";e.currentTarget.style.background="#0A1628";}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:28}}>{r.flag}</span>
                <div>
                  <div style={{fontSize:16,fontWeight:700,color:"#FFFFFF",marginBottom:3}}>{r.label}</div>
                  <div style={{fontSize:11,color:"#8899AA"}}>{r.desc}</div>
                </div>
                <span style={{marginLeft:"auto",color:"#00B4FF",fontSize:18}}>›</span>
              </div>
            </button>
          ))}
        </div>
        <div style={{marginTop:32,fontSize:11,color:"#334455",textAlign:"center",lineHeight:1.8}}>
          saferouteacademy.app · Beta · For educational use only<br/>Not a substitute for official weather briefing or CFI instruction
        </div>
      </div>
    );
  }

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
          {airfield.region!=="uk" && <DAWidget airfield={airfield} liveWx={liveWx}/>}
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
