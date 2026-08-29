import { useState, useEffect } from "react";

const BACKEND = "https://saferoute-backend-production.up.railway.app";

// ── Weather helpers ───────────────────────────────────────────────────────────
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
  return { dir: m[1], spd: parseInt(m[2]), gust: m[4] ? parseInt(m[4]) : null };
}

function parseMetarVis(metar) {
  if (!metar) return null;
  if (metar.includes("9999")) return 10000;
  const m = metar.match(/\s(\d{4})\s/);
  return m ? parseInt(m[1]) : null;
}

// Parse TAF for convective forecast in next 6 hours
function parseTAFThreats(tafs) {
  if (!tafs || !tafs.length) return [];
  const taf = tafs[0] || "";
  const threats = [];
  if (/TSRA|TSGR|\+TS|TS[A-Z]/.test(taf)) threats.push({ icon:"⛈", text:"Thunderstorms forecast in TAF", color:"#FF3B3B" });
  else if (/CB/.test(taf)) threats.push({ icon:"🌩", text:"Cumulonimbus forecast in TAF", color:"#FF8C00" });
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
    const vis = parseMetarVis(metar);
    if (vis) out.push(`${vis>=10000?"10km+":vis+"m"} vis`);
    const cb  = /CB/.test(metar) ? "CB" : /TCU/.test(metar) ? "TCU" : null;
    if (cb) out.push(cb);
    if (/TSRA|\+TS|TS[A-Z]/.test(metar)) out.push("THUNDERSTORM");
    else if (/\bTS\b/.test(metar)) out.push("TS");
    if (/\bRA\b/.test(metar)) out.push("Rain");
    if (/\bFG\b/.test(metar)) out.push("Fog");
    if (/\bBR\b/.test(metar)) out.push("Mist");
    const clouds = [...metar.matchAll(/(FEW|SCT|BKN|OVC)(\d{3})/g)];
    if (clouds.length) out.push(clouds.map(c=>`${c[1]} ${parseInt(c[2])*100}ft`).join(" "));
  }
  const temp = parseMetarTemp(metar);
  if (temp !== null) out.push(`${temp}°C`);
  return out.join(" · ") || metar.slice(0, 60);
}

function calcDensityAltitude(elevFt, tempC, altimInHg = 29.92) {
  const pressureAlt = elevFt + (29.92 - altimInHg) * 1000;
  const isaTemp = 15 - (elevFt / 1000) * 1.98;
  return Math.round(pressureAlt + 120 * (tempC - isaTemp));
}

// ── Airfield database ─────────────────────────────────────────────────────────
const AIRFIELDS = {
  KDVT: {
    name:"Deer Valley Airport", city:"Phoenix, AZ", elevation:1478,
    class:"Class D", type:"Towered", runways:["07L/25R — 4,500ft","07R/25L — 8,208ft"],
    region:"phoenix", weather_icao:"KDVT",
    hazards:[
      { id:"DA",      phase:["takeoff","departure"],   sev:"critical", icon:"🌡",
        title:"Extreme Density Altitude",
        why:"This is the #1 cause of student accidents at Phoenix-area fields.",
        detail:"Phoenix summer temps exceed 45°C regularly. DA at KDVT can exceed 4,500ft from a 1,478ft field. Your aircraft's POH numbers are at sea level, 15°C standard conditions — they do not apply here. Takeoff roll can be 40-60% longer. Climb rate will be significantly reduced. Calculate performance every flight. Do not guess." },
      { id:"PARALLEL",phase:["takeoff","landing"],     sev:"critical", icon:"⚠",
        title:"Parallel Runway Confusion",
        why:"Students regularly accept the wrong runway or line up incorrectly.",
        detail:"KDVT has parallel runways 07L/25R and 07R/25L. Read back your runway assignment every time. Before lining up, read the runway number painted on the surface and confirm it matches your clearance. If you are ever unsure which runway you are on, tell ATC before proceeding." },
      { id:"PATTERN", phase:["pattern"],               sev:"high",    icon:"✈",
        title:"Extremely Busy Pattern — Multi-School Traffic",
        why:"High collision risk environment.",
        detail:"KDVT handles over 500 operations per day — one of the busiest GA airports in the USA. Multiple schools operate simultaneously, meaning students at different skill levels share the pattern. Announce every position, make standard radio calls, and never assume the pattern is clear. Check for traffic before every turn." },
      { id:"MULTICOM",phase:["pattern","all"],         sev:"high",    icon:"📻",
        title:"Non-Standard Radio Calls / Non-Native Readbacks",
        why:"Miscommunication risk in multi-school environment.",
        detail:"KDVT hosts international students from multiple schools who may not be native English speakers. ATC readbacks may be unclear or incomplete. If you hear an ambiguous readback from another aircraft, do not assume ATC has it under control — maintain visual awareness. If your own readback is questioned, don't rush — read back slowly and correctly." },
      { id:"DUST",    phase:["all"],                   sev:"high",    icon:"🌪",
        title:"Haboob / Dust Storm",
        why:"Can reduce visibility to zero in minutes with no warning.",
        detail:"A haboob is a wall of dust that can be 1,500ft high and move at 30-50kt. If you see a brown wall on the horizon, land immediately at the nearest suitable airport and tie down. Do not try to outrun a haboob — it has caught faster aircraft. After a haboob, do not attempt to take off until visibility is confirmed clear." },
      { id:"WIND",    phase:["takeoff","landing"],     sev:"medium",  icon:"💨",
        title:"Afternoon Wind Shift & Dust Devils",
        why:"Unpredictable crosswinds can exceed student limits quickly.",
        detail:"Phoenix afternoon convective heating creates strong, variable surface winds from around 14:00 local. Dust devils — small rotating vortices — are common in summer and can cause sudden control inputs. Plan flights in the morning. If you see a dust devil near the runway, go around." },
    ],
    atcNotes:"Tower 132.075 · Ground 121.8 · ATIS 134.975\nExpect sequencing in busy periods — comply with all extend-downwind instructions. Report any parallel runway confusion immediately.",
    cfiNotes:"Deer Valley's parallel runways are the #1 student confusion point. Reinforce runway readback every flight. DA briefing is non-negotiable before every summer flight — use the calculator below before engine start.",
  },

  KFFZ: {
    name:"Falcon Field Airport", city:"Mesa, AZ", elevation:1394,
    class:"Class D", type:"Towered", runways:["04L/22R — 3,799ft","04R/22L — 5,101ft"],
    region:"phoenix", weather_icao:"KFFZ",
    hazards:[
      { id:"DA",      phase:["takeoff","departure"],   sev:"critical", icon:"🌡",
        title:"Extreme Density Altitude + Short Runway Trap",
        why:"Short runway combined with high DA is a documented accident cause.",
        detail:"Runway 04L is only 3,799ft — short even in normal conditions. In summer heat with DA exceeding 4,000ft, takeoff roll and obstacle clearance performance are dramatically reduced. Students should use 04R/22L (5,101ft) by default in summer unless specifically briefed by CFI. Calculate takeoff distance before every flight. If numbers don't work, don't go." },
      { id:"CLASS_B", phase:["departure","all"],       sev:"critical", icon:"📡",
        title:"Phoenix Sky Harbor Class B Proximity",
        why:"Inadvertent Class B entry is a certificate-action offence.",
        detail:"Phoenix Sky Harbor Class B airspace shelf begins at 2,000ft MSL in some sectors near KFFZ. When departing east, you can reach Class B altitude quickly. Do not climb above your assigned altitude without an explicit Class B clearance from Phoenix Approach. Squawk your assigned code. If in doubt, stay lower and ask." },
      { id:"PARALLEL",phase:["takeoff","landing"],     sev:"high",    icon:"⚠",
        title:"Parallel Runway Confusion",
        why:"Two runways, same heading — wrong one accepted regularly.",
        detail:"Same parallel runway risk as KDVT. Read the runway number painted on the surface before every lineup. Read back your clearance. Do not rush ATC." },
      { id:"DUST",    phase:["all"],                   sev:"high",    icon:"🌪",
        title:"Haboob Risk",
        detail:"Same Phoenix haboob hazard as all valley fields. Land immediately at first sign of approaching dust wall." },
      { id:"BIRDS",   phase:["takeoff","landing"],     sev:"medium",  icon:"🦅",
        title:"Raptor Bird Activity",
        detail:"Hawks and other raptors common near Falcon Field. Report bird activity to tower. Bird strikes on departure have been documented at KFFZ." },
    ],
    atcNotes:"Tower 132.85 · Ground 121.9 · Phoenix Approach 124.0 (departing east)\nConfirm runway assignment before every lineup. Phoenix Class B begins at varying altitudes — check ATIS and confirm with ATC.",
    cfiNotes:"Short runway 04L is the key trap at Falcon — reinforce runway selection in hot weather. Class B proximity is the second critical brief. POH performance review before every summer flight is non-negotiable.",
  },

  KCHD: {
    name:"Chandler Municipal Airport", city:"Chandler, AZ", elevation:1243,
    class:"Class D", type:"Towered", runways:["04L/22R — 4,900ft","04R/22L — 5,600ft"],
    region:"phoenix", weather_icao:"KCHD",
    hazards:[
      { id:"DA",      phase:["takeoff","departure"],   sev:"critical", icon:"🌡",
        title:"Extreme Density Altitude",
        detail:"At 1,243ft with Phoenix summer heat, DA regularly exceeds 4,500ft. Performance calculations mandatory — sea-level POH data does not apply." },
      { id:"AIRSPACE",phase:["all"],                   sev:"critical", icon:"📡",
        title:"Williams Gateway (KIWA) Class C — Immediately Adjacent",
        why:"KIWA Class C shelf begins very close to KCHD traffic patterns.",
        detail:"Phoenix-Mesa Gateway (KIWA) Class C airspace starts immediately east of KCHD. An eastbound departure can penetrate KIWA's Class C shelf within seconds of takeoff. Establish contact with Williams Gateway Approach 119.5 before climbing eastbound. If you don't have two-way communication, do not enter Class C." },
      { id:"MULTI",   phase:["pattern","all"],         sev:"high",    icon:"📻",
        title:"Multi-School Operations / Non-Native Readbacks",
        detail:"Multiple flight schools operate at KCHD simultaneously. International students and non-native English speakers are common. Monitor radio carefully, do not assume ATC instructions heard by others are correctly read back." },
      { id:"DUST",    phase:["all"],                   sev:"high",    icon:"🌪",
        title:"Haboob Risk",
        detail:"Standard Phoenix haboob hazard. Land and tie down immediately at first sign of approaching dust wall." },
    ],
    atcNotes:"Tower 132.35 · Ground 121.9 · Williams Gateway Approach 119.5 (eastbound departures)\nDo not depart eastbound without establishing contact with Williams Gateway Approach.",
    cfiNotes:"KIWA Class C proximity is the defining hazard at Chandler — students have entered Class C inadvertently on eastbound departures. Brief the airspace boundary explicitly before every flight.",
  },

  KIWA: {
    name:"Phoenix-Mesa Gateway Airport", city:"Mesa, AZ", elevation:1382,
    class:"Class C", type:"Towered", runways:["12L/30R — 10,401ft","12R/30L — 10,201ft"],
    region:"phoenix", weather_icao:"KIWA",
    hazards:[
      { id:"CLASS_C", phase:["all"],                   sev:"critical", icon:"📡",
        title:"Class C — Two-Way Communication Required",
        why:"This is the most commonly misunderstood airspace rule for student pilots.",
        detail:"You MUST establish two-way radio communication with KIWA Approach BEFORE entering Class C airspace — this means ATC must use your callsign in response. 'N12345, standby' counts as contact. 'Traffic, standby' does NOT. Do not enter Class C until you hear your full callsign acknowledged." },
      { id:"DA",      phase:["takeoff","departure"],   sev:"critical", icon:"🌡",
        title:"Extreme Density Altitude",
        detail:"Long runways can create false security. Even with 10,000ft available, a 4,500ft DA significantly reduces climb performance. Calculate before every summer flight." },
      { id:"JETS",    phase:["pattern","landing"],     sev:"high",    icon:"✈",
        title:"Jet Traffic — Wake Turbulence Risk",
        why:"Airline training jets share runways with GA training aircraft.",
        detail:"KIWA hosts Lufthansa and CAE airline training in jets alongside GA training. Wake turbulence from a departing jet can flip a light training aircraft. Stay above the jet's flight path on approach, touch down past the jet's touchdown point, and add wake turbulence separation as instructed by ATC." },
      { id:"MULTI",   phase:["all"],                   sev:"high",    icon:"📻",
        title:"Multi-School / Non-Native Readbacks",
        detail:"KIWA hosts international training programmes. Non-native English readbacks are common. Monitor radio carefully and confirm ATC instructions are correctly acknowledged by all traffic." },
    ],
    atcNotes:"Approach 119.5 · Tower 118.7 · Ground 121.9\nMandatory Class C contact before entering. Wake turbulence separation from jets — ask ATC if unsure.",
    cfiNotes:"KIWA is excellent for introducing Class C operations. Focus the brief on the two-way communication requirement — many students think hearing ATC is enough. Wake turbulence from airline training jets is a real risk worth a specific brief.",
  },

  KVRB: {
    name:"Vero Beach Regional Airport", city:"Vero Beach, FL", elevation:24,
    class:"Class D", type:"Towered", runways:["04/22 — 7,314ft","11L/29R — 4,000ft","11R/29L — 3,301ft"],
    region:"florida", weather_icao:"KVRB",
    hazards:[
      { id:"BIRDS",   phase:["takeoff","landing","pattern"],sev:"critical",icon:"🦅",
        title:"Severe Bird Strike Risk — Atlantic Flyway",
        why:"Multiple documented strikes per year at this field.",
        detail:"Vero Beach sits on the Atlantic Flyway — a major migratory bird corridor. Vultures, pelicans, egrets, and osprey are common on and around the field. Scan final approach and departure paths carefully. Report all bird activity to tower. If you see birds on or near the runway, ask ATC to check the runway before you land. Bird strikes have caused engine failures here." },
      { id:"CB",      phase:["all"],                   sev:"critical", icon:"⛈",
        title:"Afternoon Thunderstorms — Rapid Development",
        why:"Florida CB activity is some of the fastest-developing in the world.",
        detail:"The Florida pattern in summer: clear mornings, cumulus building by 11:00, storms by 13:00-14:00. Storms can go from clear sky to lightning in 20 minutes. Rule of thumb: if you wouldn't start a flight now, don't continue one. Check the TAF before every departure. If TSRA is forecast within your planned flight window, delay or cancel." },
      { id:"SHORT",   phase:["takeoff","landing"],     sev:"high",    icon:"🛬",
        title:"Short Training Runways",
        why:"Student landing technique can be marginal on these runway lengths.",
        detail:"Runway 11R/29L is 3,301ft — very short for student training. Know your aircraft's demonstrated takeoff and landing distances, add a 50% safety factor, and compare to available runway. If your numbers are marginal, use the longer runway. Never accept a shorter runway just because ATC offers it." },
      { id:"HEAT",    phase:["all"],                   sev:"high",    icon:"🌡",
        title:"Heat & Humidity — Pilot Performance",
        detail:"Cockpit temperatures in Florida summer can exceed 50°C before engine start. Hydrate before every flight. Heat stress reduces decision-making ability before physical symptoms appear. Brief with your CFI: know your personal limits and know when to cut a flight short." },
      { id:"MOA",     phase:["departure","all"],       sev:"high",    icon:"📡",
        title:"MOA and Restricted Area Proximity",
        detail:"Several MOAs and restricted areas operate near VRB, including R-2910 complex. Check current NOTAM status before every flight. MOAs may be active without prior notice. If in doubt, ask ATC for MOA status before departing." },
      { id:"CROSSING",phase:["pattern","all"],         sev:"medium",  icon:"📻",
        title:"Multi-School Pattern / Crossing Operations",
        detail:"Multiple flight schools operate at VRB including Skyborne. With aircraft at different skill levels sharing the pattern, expect non-standard spacing. Announce clearly, look before every turn, and never assume you are the only aircraft in the pattern." },
    ],
    atcNotes:"Tower 119.4 · Ground 121.9 · CTAF 119.4 (when tower closed)\nReport all bird activity. When tower is closed, use CTAF and announce all positions clearly.",
    cfiNotes:"Bird strike risk at VRB is genuinely serious — not just a checklist item. Reinforce lookout scans on every approach. The 13:00 rule for summer afternoon flights should be non-negotiable. Brief the MOA status check before every cross-country departure.",
  },

  KFXE: {
    name:"Fort Lauderdale Executive Airport", city:"Fort Lauderdale, FL", elevation:13,
    class:"Class D", type:"Towered", runways:["09/27 — 4,000ft","13/31 — 6,001ft"],
    region:"florida", weather_icao:"KFXE",
    hazards:[
      { id:"CLASS_B", phase:["all"],                   sev:"critical", icon:"📡",
        title:"FLL Class B — Do Not Climb Above 1,200ft Without Clearance",
        why:"Students have received certificate enforcement actions for inadvertent Class B entry here.",
        detail:"Fort Lauderdale-Hollywood (KFLL) Class B airspace begins at 1,200ft MSL directly above KFXE. This is not a suggestion — it is a hard altitude limit. Do not climb above 1,200ft without an explicit Class B clearance from Miami Approach. There is no grace period. If you inadvertently enter Class B, tell ATC immediately and cooperate fully." },
      { id:"CB",      phase:["all"],                   sev:"critical", icon:"⛈",
        title:"Afternoon Thunderstorms — Rapid Development",
        detail:"South Florida CB development is among the fastest in the world. Check TAF before departure. If TSRA is forecast in your flight window, do not go. Ground lightning alerts will close the ramp — plan to be back by 13:00 in summer." },
      { id:"TRAFFIC", phase:["pattern","all"],         sev:"high",    icon:"✈",
        title:"Extremely High Traffic — Multi-School Parallel Ops",
        why:"Pattern saturation is a real risk at KFXE.",
        detail:"KFXE handles very high training volumes. Multiple schools operate simultaneously with aircraft at all skill levels. Extended downwind instructions are common — comply without delay. Never rush a clearance. Radio congestion can mask other traffic — keep your head on a swivel." },
      { id:"MULTI",   phase:["pattern","all"],         sev:"high",    icon:"📻",
        title:"Non-Native English Readbacks",
        detail:"KFXE hosts many international students. Readbacks may be unclear or incomplete. Do not assume ATC instructions have been correctly acknowledged. Monitor all traffic calls carefully." },
      { id:"SEA",     phase:["takeoff","landing"],     sev:"high",    icon:"💨",
        title:"Atlantic Sea Breeze Crosswind Shifts",
        detail:"Atlantic sea breeze creates afternoon crosswind shifts that can rotate 90 degrees within an hour. Check ATIS before every leg — not just before first departure. Crosswind can quickly approach or exceed student limits in afternoon." },
    ],
    atcNotes:"Tower 128.025 · Ground 121.9 · Miami Approach 124.15\nDo NOT climb above 1,200ft without explicit Class B clearance. Class B altitude is the #1 enforcement issue at this field.",
    cfiNotes:"Class B altitude discipline is the defining brief at FXE — say it explicitly every flight: 'We do not climb above 1,200ft without a clearance.' The multi-school environment means radio congestion is common — brief radio technique and lookout scanning.",
  },

  KPMP: {
    name:"Pompano Beach Airpark", city:"Pompano Beach, FL", elevation:19,
    class:"Class D", type:"Towered", runways:["15/33 — 3,600ft","06/24 — 2,800ft"],
    region:"florida", weather_icao:"KPMP",
    hazards:[
      { id:"CLASS_B", phase:["all"],                   sev:"critical", icon:"📡",
        title:"FLL Class B — Floor as Low as 1,000ft",
        why:"KPMP sits directly under the tightest part of FLL's Class B.",
        detail:"The FLL Class B floor at KPMP can be as low as 1,000ft MSL — lower than at KFXE. Some sectors start at 900ft. You must know the exact Class B floor in your departure direction before taxiing. Confirm on ATIS and with ATC before climbing. Students have received enforcement actions here." },
      { id:"SHORT",   phase:["takeoff","landing"],     sev:"critical", icon:"🛬",
        title:"2,800ft Runway — Extremely Short",
        why:"Runway 06/24 is one of the shortest in regular commercial training use.",
        detail:"Runway 06/24 is 2,800ft — marginal even in a Cessna 172 with standard technique. A 10kt tailwind component on 06/24 could make landing distance unacceptable. Calculate your numbers. If the runway is wet, add 15%. If you are fast over the threshold, go around — do not try to save a landing on 2,800ft." },
      { id:"PATTERN", phase:["pattern"],               sev:"high",    icon:"✈",
        title:"Non-Standard Pattern Geometry",
        detail:"KPMP's pattern is constrained by the Class B floor and runway layout. The pattern is non-standard. Study the airport diagram and receive a thorough CFI brief before first solo here. Do not accept a pattern entry that would require you to climb into Class B." },
      { id:"CB",      phase:["all"],                   sev:"high",    icon:"⛈",
        title:"Afternoon Thunderstorms",
        detail:"South Florida CB — plan morning flights, ground by 13:00 in summer. Check TAF for TSRA forecast." },
      { id:"MULTI",   phase:["pattern","all"],         sev:"high",    icon:"📻",
        title:"Multi-School Ops / Non-Native Readbacks",
        detail:"High volume of international students. Monitor radio carefully. Confirm all clearances." },
    ],
    atcNotes:"Tower 134.95 · Ground 121.9 · Miami Approach 124.15\nClass B floor varies by sector — confirm before every departure. Short runway — go-around always available, use it.",
    cfiNotes:"Pompano is known as one of Florida's 'gotcha' fields. Do not send students solo here without thorough local area familiarisation. Short runway, Class B floor, and non-standard pattern are a combined hazard that requires specific briefing.",
  },

  KFPR: {
    name:"Treasure Coast International", city:"Fort Pierce, FL", elevation:25,
    class:"Class D", type:"Towered", runways:["14/32 — 4,000ft","09/27 — 6,492ft"],
    region:"florida", weather_icao:"KFPR",
    hazards:[
      { id:"BIRDS",   phase:["takeoff","landing","pattern"],sev:"high",icon:"🦅",
        title:"Atlantic Flyway Bird Strike Risk",
        detail:"Fort Pierce on the Atlantic coast is in the migration corridor. Vultures, egrets, and migratory birds are common. Scan finals and departures carefully. Report sightings to tower." },
      { id:"CB",      phase:["all"],                   sev:"high",    icon:"⛈",
        title:"Afternoon Thunderstorms — Sea Breeze Convergence",
        detail:"Indian River County sees sea breeze convergence between Atlantic and Gulf — concentrated storm development. Plan to land by 13:00 in summer. Check TAF for TSRA." },
      { id:"MOA",     phase:["departure"],             sev:"high",    icon:"📡",
        title:"Avon Park MOA / Restricted Areas",
        detail:"Avon Park MOA is active west of KFPR. R-2901 complex to the east can be active. Check NOTAM status before all cross-country departures. When active, a clearance is required — entry without clearance is a violation." },
      { id:"MULTI",   phase:["pattern","all"],         sev:"medium",  icon:"📻",
        title:"Multi-School Pattern Ops",
        detail:"Multiple schools including Skyborne based at KFPR. Announce all positions. Monitor radio for crossing traffic." },
    ],
    atcNotes:"Tower 126.0 · Ground 121.9 · Palm Beach Approach for area transitions\nCheck MOA/TFR status before all departures.",
    cfiNotes:"KFPR is generally a well-organised training environment. Key student focus: MOA awareness and weather decision-making for afternoon operations. Good field for introducing cross-country planning.",
  },

  KTMB: {
    name:"Miami Executive Airport (Tamiami)", city:"Miami, FL", elevation:8,
    class:"Class D", type:"Towered", runways:["09L/27R — 5,000ft","09R/27L — 4,007ft","13/31 — 3,897ft"],
    region:"florida", weather_icao:"KTMB",
    hazards:[
      { id:"CLASS_B", phase:["all"],                   sev:"critical", icon:"📡",
        title:"Miami Class B — Multi-Sector, Complex Geometry",
        why:"Miami's Class B has different floors in different directions from KTMB.",
        detail:"Miami International (KMIA) Class B has multiple sectors with different floor altitudes around KTMB. There is no single altitude limit — it depends which direction you are flying. Brief the specific Class B geometry for every flight. Miami Approach 125.5 (northbound), 119.75 (southbound)." },
      { id:"BIRDS",   phase:["takeoff","landing"],     sev:"critical", icon:"🦅",
        title:"Everglades Wildlife — Extremely High Bird Activity",
        why:"Adjacent to Everglades — one of the most biodiverse areas in North America.",
        detail:"KTMB is immediately adjacent to Everglades National Park. Vultures, anhingas, ospreys, egrets, and herons are common on and around the field. Bird strike rates at Tamiami are among the highest in Florida. Scan every approach and departure carefully. Report all wildlife to tower." },
      { id:"CB",      phase:["all"],                   sev:"critical", icon:"⛈",
        title:"Afternoon Thunderstorms — Everglades Convergence",
        detail:"Sea breeze convergence between Biscayne Bay and the Everglades concentrates storm activity near KTMB. Storms develop faster here than most Florida fields. Ground by 12:30 in summer. Check TAF for TSRA." },
      { id:"ADIZ",    phase:["all"],                   sev:"high",    icon:"🔒",
        title:"Florida ADIZ — Offshore Flight Restriction",
        why:"Students attempting coastal scenic flights regularly violate this.",
        detail:"The Florida Air Defense Identification Zone (ADIZ) begins 12nm offshore. If you cross the ADIZ without a DVFR flight plan and proper transponder code, expect intercept by military aircraft. Do not fly over the ocean without a specific CFI brief on ADIZ procedures." },
      { id:"MULTI",   phase:["pattern","all"],         sev:"high",    icon:"📻",
        title:"High Traffic + Non-Native Readbacks",
        detail:"KTMB has very high training volumes with international students. Radio discipline and visual lookout are critical. Never assume pattern is clear." },
    ],
    atcNotes:"Tower 132.075 · Ground 121.9 · Miami Approach 125.5 (N), 119.75 (S)\nKnow Class B floor for your departure direction before taxiing. ADIZ begins 12nm offshore.",
    cfiNotes:"Tamiami's Class B geometry is complex — brief it sector by sector for each planned flight. Everglades bird risk is genuine and high. ADIZ is a documented student trap for scenic coastal flights.",
  },

  KDAB: {
    name:"Daytona Beach International", city:"Daytona Beach, FL", elevation:34,
    class:"Class C", type:"Towered", runways:["07L/25R — 10,500ft","07R/25L — 3,200ft","16/34 — 6,002ft"],
    region:"florida", weather_icao:"KDAB",
    hazards:[
      { id:"CLASS_C", phase:["all"],                   sev:"high",    icon:"📡",
        title:"Class C — Communication Requirement",
        detail:"KDAB is Class C. You must establish two-way communication with Daytona Approach before entering the 5nm inner ring. Embry-Riddle operations generate constant traffic at all levels — ATC is professional and busy." },
      { id:"ERAU",    phase:["pattern","all"],         sev:"high",    icon:"✈",
        title:"Embry-Riddle High-Density Training Traffic",
        why:"Students at all skill levels share the same airspace.",
        detail:"KDAB is home to ERAU — one of the world's largest aviation universities. Expect a mix of ab initio students and advanced multi-engine training sharing the same pattern. Be patient, maintain lookout scan, and do not assume other pilots have your level of experience." },
      { id:"SHORT",   phase:["takeoff","landing"],     sev:"high",    icon:"🛬",
        title:"Short Runway 07R — 3,200ft",
        detail:"07R/25L is only 3,200ft — know your aircraft's performance before accepting this runway. 07L/25R at 10,500ft is available for most training ops." },
      { id:"CB",      phase:["all"],                   sev:"high",    icon:"⛈",
        title:"Atlantic Coast Thunderstorms",
        detail:"Atlantic sea breeze CB development. Check TAF. Plan morning flights in summer." },
    ],
    atcNotes:"Approach 124.0 · Tower 126.0 · Ground 121.9\nClass C — mandatory contact before entering airspace. ERAU traffic means ATC is always busy — listen carefully.",
    cfiNotes:"KDAB is excellent for Class C introduction — professional environment. Focus on communication requirements and traffic awareness in the ERAU environment.",
  },
};

// ── Severity config ───────────────────────────────────────────────────────────
const SEV = {
  critical:{ color:"#FF3B3B", bg:"rgba(255,59,59,0.15)",  border:"rgba(255,59,59,0.45)",  label:"CRITICAL", dot:"🔴" },
  high:    { color:"#FF8C00", bg:"rgba(255,140,0,0.15)",  border:"rgba(255,140,0,0.45)",  label:"HIGH",     dot:"🟠" },
  medium:  { color:"#FFD700", bg:"rgba(255,215,0,0.15)",  border:"rgba(255,215,0,0.45)",  label:"MEDIUM",   dot:"🟡" },
  low:     { color:"#00C896", bg:"rgba(0,200,150,0.15)",  border:"rgba(0,200,150,0.45)",  label:"LOW",      dot:"🟢" },
};

const PHASES = [
  {id:"all",label:"ALL PHASES"},
  {id:"pattern",label:"PATTERN"},
  {id:"takeoff",label:"TAKEOFF"},
  {id:"landing",label:"LANDING"},
  {id:"departure",label:"DEPARTURE"},
];

function useWindowWidth() {
  const [w,setW] = useState(typeof window!=="undefined"?window.innerWidth:1024);
  useEffect(()=>{ const fn=()=>setW(window.innerWidth); window.addEventListener("resize",fn); return ()=>window.removeEventListener("resize",fn); },[]);
  return w;
}

// ── Density Altitude Widget ───────────────────────────────────────────────────
function DAWidget({ airfield, liveWx }) {
  const liveTemp = liveWx ? parseMetarTemp(liveWx.metar) : null;
  const liveAlt  = liveWx ? parseMetarAltimeter(liveWx.metar) : null;
  const [tempC,  setTempC]  = useState(liveTemp ?? 25);
  const [altim,  setAltim]  = useState(liveAlt  ?? 29.92);
  const [useLive,setUseLive]= useState(!!liveTemp);

  useEffect(() => {
    if (liveTemp !== null) { setTempC(liveTemp); setUseLive(true); }
    if (liveAlt  !== null) setAltim(liveAlt);
  }, [liveTemp, liveAlt]);

  const da = calcDensityAltitude(airfield.elevation, tempC, altim);
  const isPhoenix = airfield.region === "phoenix";
  const [daColor, daLabel, daRisk] =
    da > 5000 ? ["#FF3B3B", "EXTREME", "Recalculate ALL performance. Expect significantly reduced climb & extended takeoff roll."] :
    da > 3500 ? ["#FF8C00", "HIGH",    "Significant performance loss. Review POH numbers at field elevation before engine start."] :
    da > 2000 ? ["#FFD700", "MODERATE","Performance affected. Recalculate takeoff roll and climb rate."] :
                ["#00C896", "NORMAL",  "Standard performance expected. Continue with normal planning."];

  return (
    <div style={{background:"#0A1828",border:`2px solid ${daColor}55`,borderRadius:10,padding:"16px 18px",marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{fontSize:10,fontFamily:"'DM Mono',monospace",color:"#00B4FF",letterSpacing:"0.12em",fontWeight:"bold"}}>⬆ DENSITY ALTITUDE</div>
        {useLive && <span style={{fontSize:8,fontFamily:"'DM Mono',monospace",color:"#00C896",background:"rgba(0,200,150,0.15)",border:"1px solid rgba(0,200,150,0.4)",padding:"2px 7px",borderRadius:3}}>● LIVE METAR</span>}
        {!useLive && <span style={{fontSize:8,fontFamily:"'DM Mono',monospace",color:"#FFD700",background:"rgba(255,215,0,0.1)",border:"1px solid rgba(255,215,0,0.3)",padding:"2px 7px",borderRadius:3}}>MANUAL</span>}
      </div>

      <div style={{display:"flex",gap:16,marginBottom:14,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:130}}>
          <div style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#556677",marginBottom:5,letterSpacing:"0.1em"}}>OUTSIDE AIR TEMP (°C)</div>
          <input type="range" min={-10} max={55} value={tempC}
            onChange={e=>{setTempC(parseInt(e.target.value));setUseLive(false);}}
            style={{width:"100%",accentColor:"#00B4FF"}}/>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:16,color:"#FFFFFF",fontWeight:"bold"}}>{tempC}°C</span>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#445566"}}>{(tempC*9/5+32).toFixed(0)}°F</span>
          </div>
        </div>
        <div style={{flex:1,minWidth:130}}>
          <div style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#556677",marginBottom:5,letterSpacing:"0.1em"}}>ALTIMETER (inHg)</div>
          <input type="range" min={28.00} max={31.00} step={0.01} value={altim}
            onChange={e=>{setAltim(parseFloat(e.target.value));setUseLive(false);}}
            style={{width:"100%",accentColor:"#00B4FF"}}/>
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
          <span>Pressure alt: {Math.round(airfield.elevation+(29.92-altim)*1000).toLocaleString()}ft</span>
          <span>ISA dev: {(tempC-(15-(airfield.elevation/1000)*1.98)).toFixed(1)}°C</span>
        </div>
      </div>
      {isPhoenix && da > 3000 && (
        <div style={{marginTop:10,padding:"8px 12px",background:"rgba(255,59,59,0.1)",border:"1px solid rgba(255,59,59,0.3)",borderRadius:6,fontSize:11,color:"#FF8C00",lineHeight:1.5}}>
          ⚠ Phoenix summer advisory: review POH climb gradient and obstacle clearance before departure. Consider early morning flight when DA is lower.
        </div>
      )}
    </div>
  );
}

// ── Weather Strip ─────────────────────────────────────────────────────────────
function WeatherStrip({ liveWx, wxLoad }) {
  if (wxLoad) return (
    <div style={{background:"#0A1828",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"12px 16px",marginBottom:14,fontSize:10,color:"#334455",fontFamily:"'DM Mono',monospace"}}>
      Loading live weather…
    </div>
  );
  if (!liveWx) return (
    <div style={{background:"#0A1828",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"12px 16px",marginBottom:14,fontSize:10,color:"#334455",fontFamily:"'DM Mono',monospace"}}>
      No live weather data available for this field.
    </div>
  );

  const tafThreats = parseTAFThreats(liveWx.tafs);
  const hasCB = liveWx.metar && /TSRA|CB|\+TS/.test(liveWx.metar);

  return (
    <div style={{background:"#0A1828",border:"1px solid rgba(0,180,255,0.2)",borderRadius:10,padding:"14px 16px",marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontSize:10,fontFamily:"'DM Mono',monospace",color:"#00B4FF",letterSpacing:"0.12em",fontWeight:"bold"}}>🌤 LIVE WEATHER</div>
        <span style={{fontSize:8,fontFamily:"'DM Mono',monospace",color:"#FF3B3B"}}>● LIVE</span>
      </div>

      {/* Current METAR summary */}
      <div style={{background:"rgba(255,255,255,0.04)",borderRadius:6,padding:"10px 12px",marginBottom:10}}>
        <div style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#445566",marginBottom:4,letterSpacing:"0.1em"}}>CURRENT CONDITIONS (METAR)</div>
        <div style={{fontSize:13,color:"#FFFFFF",fontWeight:"500",lineHeight:1.6}}>{interpretMetarShort(liveWx.metar)}</div>
        {hasCB && <div style={{marginTop:6,fontSize:11,color:"#FF3B3B",fontWeight:"bold"}}>⛈ ACTIVE THUNDERSTORM / CB DETECTED IN METAR</div>}
      </div>

      {/* TAF forecast threats */}
      {tafThreats.length > 0 && (
        <div style={{background:"rgba(255,59,59,0.08)",border:"1px solid rgba(255,59,59,0.3)",borderRadius:6,padding:"10px 12px",marginBottom:10}}>
          <div style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#FF8C00",marginBottom:6,letterSpacing:"0.1em"}}>⚠ FORECAST HAZARDS (TAF)</div>
          {tafThreats.map((t,i)=>(
            <div key={i} style={{fontSize:12,color:t.color,marginBottom:3,fontWeight:"500"}}>{t.icon}  {t.text}</div>
          ))}
        </div>
      )}

      {/* Raw METAR */}
      <div style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#334455",lineHeight:1.6,wordBreak:"break-all"}}>
        {liveWx.metar}
      </div>
      {liveWx.tafs?.[0] && (
        <div style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#223344",lineHeight:1.6,wordBreak:"break-all",marginTop:4}}>
          TAF: {liveWx.tafs[0].slice(0,200)}
        </div>
      )}
    </div>
  );
}

// ── Hazard Card ───────────────────────────────────────────────────────────────
function HazardCard({ h, expanded, onToggle }) {
  const sc = SEV[h.sev];
  return (
    <div onClick={onToggle} style={{
      background: expanded ? sc.bg : "rgba(15,25,40,0.9)",
      border:`1px solid ${expanded ? sc.border : "rgba(255,255,255,0.1)"}`,
      borderRadius:9, marginBottom:8, cursor:"pointer", overflow:"hidden",
      transition:"all 0.2s", boxShadow: expanded ? `0 0 20px ${sc.bg}` : "none",
    }}>
      <div style={{padding:"13px 15px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:36,height:36,background:sc.bg,border:`1px solid ${sc.border}`,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>
            {h.icon}
          </div>
          <div>
            <div style={{fontSize:13,color:"#FFFFFF",fontWeight:600,lineHeight:1.3}}>{h.title}</div>
            <div style={{fontSize:9,color:"#556677",fontFamily:"'DM Mono',monospace",marginTop:2,letterSpacing:"0.08em"}}>
              {h.phase.join(" · ").toUpperCase()}
            </div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
          <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:sc.color,background:sc.bg,border:`1px solid ${sc.border}`,padding:"3px 8px",borderRadius:3,fontWeight:"bold"}}>{sc.label}</span>
          <span style={{color:sc.color,fontSize:14,fontWeight:"bold"}}>{expanded?"▾":"›"}</span>
        </div>
      </div>
      {expanded && (
        <div style={{padding:"0 15px 14px 15px",borderTop:`1px solid ${sc.border}55`}}>
          {h.why && (
            <div style={{fontSize:11,color:sc.color,fontWeight:"600",fontStyle:"italic",marginBottom:8,marginTop:10,padding:"6px 10px",background:sc.bg,borderRadius:5,borderLeft:`3px solid ${sc.color}`}}>
              Why this matters: {h.why}
            </div>
          )}
          <div style={{fontSize:12,color:"#C0D0E0",lineHeight:1.8,marginTop:h.why?0:10}}>
            {h.detail}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const width     = useWindowWidth();
  const isMobile  = width < 640;
  const isDesktop = width >= 1024;

  const [region,   setRegion]  = useState("florida");
  const [selected, setSelected]= useState("KVRB");
  const [phase,    setPhase]   = useState("all");
  const [expanded, setExpanded]= useState({});
  const [menuOpen, setMenuOpen]= useState(false);
  const [tab,      setTab]     = useState("hazards");
  const [liveWx,   setLiveWx]  = useState(null);
  const [wxLoad,   setWxLoad]  = useState(false);
  const [briefing, setBrief]   = useState("");
  const [briefLoad,setBriefLoad]=useState(false);

  const airfield = AIRFIELDS[selected];

  useEffect(() => {
    setLiveWx(null); setWxLoad(true); setBrief(""); setExpanded({});
    fetchLiveWeather(airfield.weather_icao)
      .then(wx => { setLiveWx(wx); setWxLoad(false); })
      .catch(() => setWxLoad(false));
  }, [selected]);

  const filteredHazards = airfield.hazards
    .filter(h => phase==="all" || h.phase.includes(phase) || h.phase.includes("all"))
    .sort((a,b) => ({critical:4,high:3,medium:2,low:1}[b.sev]||0) - ({critical:4,high:3,medium:2,low:1}[a.sev]||0));

  async function generateBriefing() {
    setBriefLoad(true); setBrief("");
    const liveTemp = liveWx ? parseMetarTemp(liveWx.metar) : null;
    const liveAlt  = liveWx ? parseMetarAltimeter(liveWx.metar) : null;
    const da = liveTemp !== null ? calcDensityAltitude(airfield.elevation, liveTemp, liveAlt??29.92) : null;
    const tafThreats = parseTAFThreats(liveWx?.tafs);
    const wxText = [
      liveWx?.metar ? `METAR: ${liveWx.metar}` : "No METAR available.",
      liveWx?.tafs?.[0] ? `TAF: ${liveWx.tafs[0].slice(0,300)}` : "",
      da !== null ? `Current Density Altitude: ${da.toLocaleString()}ft` : "",
      tafThreats.length ? `Forecast hazards: ${tafThreats.map(t=>t.text).join(", ")}` : "",
    ].filter(Boolean).join("\n");

    try {
      const res = await fetch(`${BACKEND}/routebrief`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          dep:selected, dest:selected, alts:[], aircraft:"Training aircraft (single-engine piston)",
          threats:airfield.hazards.map(h=>`${h.title} (${h.sev.toUpperCase()})`),
          liveWeather:wxText
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setBrief(data.briefing || "Unable to generate briefing.");
    } catch { setBrief("Unable to generate briefing. Check your connection."); }
    setBriefLoad(false);
  }

  const floridaFields = Object.entries(AIRFIELDS).filter(([,a])=>a.region==="florida");
  const phoenixFields = Object.entries(AIRFIELDS).filter(([,a])=>a.region==="phoenix");
  const group = region==="florida" ? floridaFields : phoenixFields;

  const sidebar = (
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden",background:"#06101C"}}>
      <div style={{padding:"14px 12px 10px",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
        <div style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#445566",letterSpacing:"0.15em",marginBottom:10}}>SELECT TRAINING FIELD</div>
        <div style={{display:"flex",gap:6,marginBottom:10}}>
          {["florida","phoenix"].map(r=>(
            <button key={r} onClick={()=>setRegion(r)} style={{
              flex:1, padding:"7px 6px", borderRadius:6, cursor:"pointer",
              fontFamily:"'DM Mono',monospace", fontSize:10, letterSpacing:"0.08em",
              background: region===r ? "rgba(0,180,255,0.2)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${region===r ? "rgba(0,180,255,0.5)" : "rgba(255,255,255,0.08)"}`,
              color: region===r ? "#00B4FF" : "#556677",
            }}>{r.toUpperCase()}</button>
          ))}
        </div>
        {group.map(([code,a])=>{
          const critCount = a.hazards.filter(h=>h.sev==="critical").length;
          return (
            <div key={code} onClick={()=>{setSelected(code);if(isMobile)setMenuOpen(false);}} style={{
              padding:"10px 11px", borderRadius:8, marginBottom:5, cursor:"pointer",
              background: selected===code ? "rgba(0,180,255,0.12)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${selected===code ? "rgba(0,180,255,0.45)" : "rgba(255,255,255,0.07)"}`,
            }}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontFamily:"'DM Mono',monospace",fontSize:14,color:"#00B4FF",fontWeight:"bold"}}>{code}</span>
                    <span style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#445566",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",padding:"1px 5px",borderRadius:2}}>{a.class}</span>
                  </div>
                  <div style={{fontSize:10,color:"#8899AA",marginTop:2}}>{a.name}</div>
                </div>
                {critCount > 0 && <span style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#FF3B3B",background:"rgba(255,59,59,0.12)",border:"1px solid rgba(255,59,59,0.3)",padding:"2px 6px",borderRadius:3,flexShrink:0}}>⚠ {critCount} CRIT</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Phase filter */}
      <div style={{padding:"10px 12px",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
        <div style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#445566",letterSpacing:"0.12em",marginBottom:7}}>FLIGHT PHASE</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
          {PHASES.map(p=>(
            <button key={p.id} onClick={()=>setPhase(p.id)} style={{
              fontSize:8, fontFamily:"'DM Mono',monospace", letterSpacing:"0.06em",
              padding:"4px 8px", borderRadius:4, cursor:"pointer",
              background: phase===p.id ? "rgba(0,180,255,0.18)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${phase===p.id ? "rgba(0,180,255,0.4)" : "rgba(255,255,255,0.07)"}`,
              color: phase===p.id ? "#00B4FF" : "#556677",
            }}>{p.label}</button>
          ))}
        </div>
      </div>
      <div style={{flex:1}}/>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:"#050D18",fontFamily:"'Inter',sans-serif",color:"#D0DCE8",display:"flex",flexDirection:"column"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Inter:wght@300;400;500;600;700&family=Bebas+Neue&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:3px;} ::-webkit-scrollbar-track{background:#08121E;} ::-webkit-scrollbar-thumb{background:#1A3050;border-radius:2px;}
        input[type=range]{-webkit-appearance:none;height:5px;border-radius:3px;background:rgba(255,255,255,0.12);}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:#00B4FF;cursor:pointer;border:2px solid #050D18;}
        button{touch-action:manipulation;}
      `}</style>

      {/* Header */}
      <div style={{
        background:"rgba(3,10,22,0.97)", borderBottom:"1px solid rgba(0,180,255,0.2)",
        padding:`0 ${isMobile?12:20}px`, display:"flex", alignItems:"center", gap:10,
        height:56, backdropFilter:"blur(12px)", position:"sticky", top:0, zIndex:100, flexShrink:0,
      }}>
        {!isDesktop && (
          <button onClick={()=>setMenuOpen(o=>!o)} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:7,padding:"7px 10px",color:"#8899AA",cursor:"pointer",fontSize:14}}>☰</button>
        )}
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <div style={{width:28,height:28,background:"linear-gradient(135deg,#0055DD,#00B4FF)",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>✈</div>
          <div style={{display:"flex",flexDirection:"column",lineHeight:1}}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:isMobile?17:21,letterSpacing:"0.15em",color:"#FFFFFF"}}>
              SAFEROUTE <span style={{color:"#00B4FF"}}>ACADEMY</span>
            </div>
            {!isMobile && <div style={{fontFamily:"'DM Mono',monospace",fontSize:7,color:"#334455",letterSpacing:"0.15em",marginTop:1}}>STUDENT PILOT SAFETY INTELLIGENCE</div>}
          </div>
          <span style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#00C896",background:"rgba(0,200,150,0.12)",border:"1px solid rgba(0,200,150,0.35)",padding:"2px 6px",borderRadius:3,letterSpacing:"0.1em"}}>BETA</span>
        </div>
        <div style={{flex:1}}/>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {!isMobile && <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#334455"}}>{selected}</span>}
          <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:wxLoad?"#FFD700":"#00C896"}}>● {wxLoad?"LOADING":"LIVE"}</span>
        </div>
      </div>

      {/* Body */}
      <div style={{flex:1,display:"flex",overflow:"hidden",height:"calc(100vh - 56px)"}}>
        {/* Sidebar */}
        {isDesktop ? (
          <div style={{width:270,flexShrink:0,overflow:"auto",borderRight:"1px solid rgba(255,255,255,0.06)"}}>{sidebar}</div>
        ) : menuOpen && (
          <div style={{position:"fixed",inset:0,zIndex:200,display:"flex"}}>
            <div onClick={()=>setMenuOpen(false)} style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.7)"}}/>
            <div style={{position:"relative",width:280,height:"100%",overflow:"auto",borderRight:"1px solid rgba(0,180,255,0.2)"}}>{sidebar}</div>
          </div>
        )}

        {/* Main */}
        <div style={{flex:1,overflow:"auto",padding:isMobile?"12px 12px 80px":"18px 22px"}}>

          {/* Airport header */}
          <div style={{
            background:"linear-gradient(135deg, rgba(0,30,60,0.9), rgba(0,15,35,0.9))",
            border:"1px solid rgba(0,180,255,0.25)", borderRadius:10,
            padding:isMobile?"14px 16px":"18px 22px", marginBottom:14,
          }}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:4}}>
                  <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:isMobile?26:32,letterSpacing:"0.1em",color:"#FFFFFF"}}>{selected}</span>
                  <span style={{fontSize:14,color:"#8BCCF0",fontWeight:500}}>{airfield.name}</span>
                </div>
                <div style={{fontSize:11,color:"#556677",marginBottom:8}}>
                  {airfield.city}  ·  <span style={{color:"#00B4FF",fontWeight:600}}>{airfield.class}</span>  ·  {airfield.type}  ·  Elevation <span style={{color:"#FFD700",fontWeight:600}}>{airfield.elevation.toLocaleString()}ft</span>
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                  {airfield.runways.map(r=>(
                    <span key={r} style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#8899AA",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:4,padding:"3px 8px"}}>{r}</span>
                  ))}
                </div>
              </div>
              {/* Hazard summary badges */}
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {["critical","high","medium"].map(s=>{
                  const count = airfield.hazards.filter(h=>h.sev===s).length;
                  if (!count) return null;
                  const sc = SEV[s];
                  return <div key={s} style={{textAlign:"center",background:sc.bg,border:`1px solid ${sc.border}`,borderRadius:6,padding:"6px 12px"}}>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:18,color:sc.color,fontWeight:"bold",lineHeight:1}}>{count}</div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:sc.color,marginTop:2}}>{s.toUpperCase()}</div>
                  </div>;
                })}
              </div>
            </div>
          </div>

          {/* Live weather */}
          <WeatherStrip liveWx={liveWx} wxLoad={wxLoad}/>

          {/* Density altitude */}
          <DAWidget airfield={airfield} liveWx={liveWx}/>

          {/* Tabs */}
          <div style={{display:"flex",borderBottom:"2px solid rgba(255,255,255,0.06)",marginBottom:14,overflowX:"auto",gap:2}}>
            {[["hazards",`HAZARDS (${filteredHazards.length})`],["atc","ATC & AIRSPACE"],["cfi","CFI NOTES"],["brief","AI BRIEF"]].map(([tid,label])=>(
              <button key={tid} onClick={()=>setTab(tid)} style={{
                background: tab===tid ? "rgba(0,180,255,0.08)" : "none",
                border:"none", cursor:"pointer", padding:"10px 16px",
                fontFamily:"'DM Mono',monospace", fontSize:10, letterSpacing:"0.08em", whiteSpace:"nowrap",
                color: tab===tid ? "#00B4FF" : "#445566",
                borderBottom: tab===tid ? "2px solid #00B4FF" : "2px solid transparent",
                transition:"all 0.15s", marginBottom:"-2px",
              }}>{label}</button>
            ))}
          </div>

          {/* Hazards */}
          {tab==="hazards" && (
            <div>
              <div style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#445566",letterSpacing:"0.15em",marginBottom:10}}>
                {filteredHazards.length} HAZARD{filteredHazards.length!==1?"S":""} FOR {selected} · TAP ANY CARD TO EXPAND
              </div>
              {filteredHazards.map(h=>(
                <HazardCard key={h.id} h={h} expanded={!!expanded[h.id]} onToggle={()=>setExpanded(e=>({...e,[h.id]:!e[h.id]}))}/>
              ))}
            </div>
          )}

          {/* ATC */}
          {tab==="atc" && (
            <div style={{background:"rgba(0,20,45,0.8)",border:"1px solid rgba(0,180,255,0.2)",borderRadius:10,padding:"18px 20px"}}>
              <div style={{fontSize:10,fontFamily:"'DM Mono',monospace",color:"#00B4FF",letterSpacing:"0.15em",marginBottom:12,fontWeight:"bold"}}>📡 ATC & AIRSPACE NOTES</div>
              <pre style={{fontSize:13,color:"#C0D4E8",lineHeight:1.9,whiteSpace:"pre-wrap",fontFamily:"'Inter',sans-serif"}}>{airfield.atcNotes}</pre>
            </div>
          )}

          {/* CFI */}
          {tab==="cfi" && (
            <div style={{background:"rgba(0,40,25,0.6)",border:"1px solid rgba(0,200,150,0.25)",borderRadius:10,padding:"18px 20px"}}>
              <div style={{fontSize:10,fontFamily:"'DM Mono',monospace",color:"#00C896",letterSpacing:"0.15em",marginBottom:12,fontWeight:"bold"}}>📋 CFI BRIEFING NOTES</div>
              <p style={{fontSize:13,color:"#C0D4E8",lineHeight:1.9}}>{airfield.cfiNotes}</p>
            </div>
          )}

          {/* AI Brief */}
          {tab==="brief" && (
            <div>
              {!briefing && !briefLoad && (
                <div style={{textAlign:"center",padding:"40px 20px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10}}>
                  <div style={{fontSize:48,marginBottom:14}}>✈</div>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:"#334455",marginBottom:6}}>STUDENT PRE-FLIGHT BRIEFING</div>
                  <div style={{fontSize:11,color:"#223344",marginBottom:20}}>AI-generated briefing for {airfield.name} using live weather + hazard data</div>
                  <button onClick={generateBriefing} style={{background:"rgba(0,180,255,0.18)",border:"1px solid rgba(0,180,255,0.4)",borderRadius:8,padding:"13px 32px",color:"#00B4FF",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:12,letterSpacing:"0.1em",fontWeight:"bold"}}>
                    GENERATE BRIEFING →
                  </button>
                </div>
              )}
              {briefLoad && (
                <div style={{textAlign:"center",padding:"40px",background:"rgba(0,20,40,0.6)",border:"1px solid rgba(0,180,255,0.15)",borderRadius:10}}>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:13,color:"#00B4FF",marginBottom:8}}>Generating student briefing…</div>
                  <div style={{fontSize:11,color:"#334455"}}>Analysing hazards · live METAR · TAF forecast · airspace</div>
                </div>
              )}
              {briefing && (
                <div style={{background:"rgba(0,15,35,0.8)",border:"1px solid rgba(0,180,255,0.18)",borderRadius:10,padding:"20px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#00B4FF",letterSpacing:"0.12em",fontWeight:"bold"}}>★ CFI AI SAFETY BRIEFING — {selected}</div>
                    <button onClick={generateBriefing} style={{background:"rgba(0,180,255,0.1)",border:"1px solid rgba(0,180,255,0.3)",borderRadius:5,padding:"5px 12px",color:"#00B4FF",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:9}}>↻ REGENERATE</button>
                  </div>
                  <pre style={{fontSize:12,color:"#C0D8F0",lineHeight:1.9,whiteSpace:"pre-wrap",fontFamily:"'Inter',sans-serif"}}>{briefing}</pre>
                  <div style={{marginTop:14,paddingTop:12,borderTop:"1px solid rgba(255,255,255,0.05)",fontSize:9,color:"#223344",fontFamily:"'DM Mono',monospace"}}>
                    AI-GENERATED USING LIVE METAR/TAF DATA · FOR EDUCATIONAL PURPOSES ONLY · NOT A SUBSTITUTE FOR CFI INSTRUCTION OR OFFICIAL WEATHER BRIEFING
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
