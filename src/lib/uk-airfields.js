// uk-airfields.js
// UK training airfield data for Academy's UK tab.
//
// Airfield shape (for reference, no TS types in this project):
// { icao, name, lat, lon, country: 'US' | 'UK', region, elevationFt }

// NOTE: lat/lon and elevation below are approximate reference values for
// scaffolding the UI and testing the pipeline — confirm each against the
// current UK AIP (ENR/AD sections) before this goes anywhere near a real
// student-facing briefing. Elevation especially affects the cloud base AGL
// calc, so it needs to be right, not just close.

export const UK_AIRFIELDS = [
  { icao: 'EGBP', name: 'Kemble (Cotswold)', lat: 51.6660, lon: -2.0567, country: 'UK', region: 'Gloucestershire', elevationFt: 433 },
  { icao: 'EGTE', name: 'Exeter', lat: 50.7344, lon: -3.4139, country: 'UK', region: 'Devon', elevationFt: 102 },
  { icao: 'EGHH', name: 'Bournemouth', lat: 50.7800, lon: -1.8425, country: 'UK', region: 'Dorset', elevationFt: 38 },
  { icao: 'EGBJ', name: 'Gloucestershire (Staverton)', lat: 51.8942, lon: -2.1672, country: 'UK', region: 'Gloucestershire', elevationFt: 101 },
  { icao: 'EGTK', name: 'Oxford (Kidlington)', lat: 51.8369, lon: -1.3200, country: 'UK', region: 'Oxfordshire', elevationFt: 270 },
  { icao: 'EGTC', name: 'Cranfield', lat: 52.0719, lon: -0.6169, country: 'UK', region: 'Bedfordshire', elevationFt: 358 },
  { icao: 'EGKA', name: 'Shoreham', lat: 50.8356, lon: -0.2972, country: 'UK', region: 'West Sussex', elevationFt: 7 },
  { icao: 'EGBW', name: 'Wellesbourne Mountford', lat: 52.1922, lon: -1.6142, country: 'UK', region: 'Warwickshire', elevationFt: 154 },
  { icao: 'EGHI', name: 'Southampton', lat: 50.9503, lon: -1.3567, country: 'UK', region: 'Hampshire', elevationFt: 44 },
  { icao: 'EGLK', name: 'Blackbushe', lat: 51.3236, lon: -0.8478, country: 'UK', region: 'Hampshire', elevationFt: 325 },
  { icao: 'EGHC', name: "Land's End", lat: 50.1028, lon: -5.6706, country: 'UK', region: 'Cornwall', elevationFt: 386 },
  { icao: 'EGFH', name: 'Swansea', lat: 51.6053, lon: -4.0678, country: 'UK', region: 'Wales', elevationFt: 299 },
  { icao: 'EGNX', name: 'East Midlands', lat: 52.8311, lon: -1.3281, country: 'UK', region: 'Leicestershire', elevationFt: 306 },
  { icao: 'EGBB', name: 'Birmingham', lat: 52.4539, lon: -1.7480, country: 'UK', region: 'West Midlands', elevationFt: 327 },
  { icao: 'EGSC', name: 'Cambridge', lat: 52.2050, lon: 0.1750, country: 'UK', region: 'Cambridgeshire', elevationFt: 47 },
  { icao: 'EGSX', name: 'North Weald', lat: 51.7222, lon: 0.1547, country: 'UK', region: 'Essex', elevationFt: 321 },
  { icao: 'EGMC', name: 'Southend', lat: 51.5714, lon: 0.6956, country: 'UK', region: 'Essex', elevationFt: 49 },
  { icao: 'EGKB', name: 'Biggin Hill', lat: 51.3308, lon: 0.0325, country: 'UK', region: 'Kent', elevationFt: 599 },
  { icao: 'EGLF', name: 'Fairoaks', lat: 51.3486, lon: -0.5583, country: 'UK', region: 'Surrey', elevationFt: 80 },
  { icao: 'EGTB', name: 'Wycombe Air Park', lat: 51.6111, lon: -0.8206, country: 'UK', region: 'Buckinghamshire', elevationFt: 520 },
  { icao: 'EGCC', name: 'Manchester', lat: 53.3537, lon: -2.2750, country: 'UK', region: 'Greater Manchester', elevationFt: 257 },
  { icao: 'EGCB', name: 'City Airport Manchester (Barton)', lat: 53.4694, lon: -2.3800, country: 'UK', region: 'Greater Manchester', elevationFt: 75 },
  { icao: 'EGNJ', name: 'Humberside', lat: 53.5744, lon: -0.3508, country: 'UK', region: 'Lincolnshire', elevationFt: 32 },
  { icao: 'EGPF', name: 'Glasgow', lat: 55.8719, lon: -4.4331, country: 'UK', region: 'Scotland', elevationFt: 26 },
  { icao: 'EGPN', name: 'Dundee', lat: 56.4525, lon: -3.0258, country: 'UK', region: 'Scotland', elevationFt: 15 },
  { icao: 'EGPK', name: 'Prestwick', lat: 55.5094, lon: -4.5867, country: 'UK', region: 'Scotland', elevationFt: 65 },
  { icao: 'EGNS', name: 'Isle of Man (Ronaldsway)', lat: 54.0833, lon: -4.6239, country: 'UK', region: 'Isle of Man', elevationFt: 52 },
  { icao: 'EGHQ', name: 'Newquay (Cornwall)', lat: 50.4406, lon: -4.9958, country: 'UK', region: 'Cornwall', elevationFt: 468 },
  { icao: 'EGLM', name: 'White Waltham', lat: 51.5083, lon: -0.7794, country: 'UK', region: 'Berkshire', elevationFt: 133 },
  { icao: 'EGSG', name: 'Stapleford', lat: 51.6486, lon: 0.1544, country: 'UK', region: 'Essex', elevationFt: 190 },
];
