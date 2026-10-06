export const WORKSPACE_SCHEMA_VERSION = 1;
export const DEMO_TEMPLATE_VERSION = 1;
export const DEFAULT_DEMO_WORKSPACE_NAME = "SafeRoute Demo Flight School";

export const DEMO_OPS_PEOPLE = [
  { id:"p1", name:"Jordan Reyes", role:"Student — PPL", hrs90:14.2, currency:"Medical current (Class 3, exp. 8mo)", medical:"Current — 8 months remaining", lastFlight:"28 Sep 2026", clubCurrency:"Current", nextCheck:"18 Nov 2026", trainingStatus:"current", pendingSignoff:false, aircraftAuth:["Cessna 172S","Cessna 152"], lastCheck:"18 May 2026" },
  { id:"p2", name:"Alicia Chen", role:"Student — Instrument", hrs90:6.5, currency:"Medical current (Class 3, exp. 5mo)", medical:"Current — 5 months remaining", lastFlight:"22 Sep 2026", clubCurrency:"Expires in 12 days", nextCheck:"18 Oct 2026", trainingStatus:"due", pendingSignoff:true, aircraftAuth:["Cessna 172N"], lastCheck:"18 Apr 2026" },
  { id:"p3", name:"Marcus Webb", role:"CFI", hrs90:42.0, currency:"Flight review & medical current", medical:"Current", lastFlight:"05 Oct 2026", clubCurrency:"Current", nextCheck:"12 Feb 2027", trainingStatus:"current", pendingSignoff:false, aircraftAuth:["Cessna 172S","Cessna 172N","Piper PA-28-181","Cessna 152","Diamond DA40"], lastCheck:"12 Aug 2026" },
  { id:"p4", name:"Sarah Kim", role:"Student — Solo", hrs90:3.1, currency:"Medical current (Class 3, exp. 11mo)", medical:"Current — 11 months remaining", lastFlight:"31 Aug 2026", clubCurrency:"Expired — checkout required", nextCheck:"OVERDUE", trainingStatus:"noncurrent", pendingSignoff:false, aircraftAuth:["Cessna 152"], lastCheck:"14 Mar 2026" },
  { id:"p5", name:"Mateo Alvarez", role:"Student — PPL", hrs90:18.7, currency:"Medical current (Class 3, exp. 14mo)", medical:"Current — 14 months remaining", lastFlight:"03 Oct 2026", clubCurrency:"Current", nextCheck:"09 Jan 2027", trainingStatus:"current", pendingSignoff:false, aircraftAuth:["Cessna 172S","Cessna 172N"], lastCheck:"09 Jul 2026" },
  { id:"p6", name:"Priya Shah", role:"Student — Commercial", hrs90:28.4, currency:"Medical current (Class 2, exp. 6mo)", medical:"Current — 6 months remaining", lastFlight:"04 Oct 2026", clubCurrency:"Current", nextCheck:"22 Dec 2026", trainingStatus:"current", pendingSignoff:false, aircraftAuth:["Cessna 172S","Cessna 172N","Diamond DA40"], lastCheck:"22 Jun 2026" },
  { id:"p7", name:"Ben Carter", role:"Student — PPL", hrs90:2.4, currency:"Medical current (Class 3, exp. 9mo)", medical:"Current — 9 months remaining", lastFlight:"19 Aug 2026", clubCurrency:"Check due soon", nextCheck:"20 Oct 2026", trainingStatus:"due", pendingSignoff:false, aircraftAuth:["Cessna 152"], lastCheck:"20 Apr 2026" },
  { id:"p8", name:"Grace Liu", role:"Student — Instrument", hrs90:11.9, currency:"Medical current (Class 3, exp. 4mo)", medical:"Current — 4 months remaining", lastFlight:"30 Sep 2026", clubCurrency:"Current", nextCheck:"02 Feb 2027", trainingStatus:"current", pendingSignoff:true, aircraftAuth:["Cessna 172S","Diamond DA40"], lastCheck:"02 Aug 2026" },
  { id:"p9", name:"Noah Williams", role:"CFI", hrs90:56.3, currency:"Flight review & medical current", medical:"Current", lastFlight:"06 Oct 2026", clubCurrency:"Current", nextCheck:"16 Mar 2027", trainingStatus:"current", pendingSignoff:false, aircraftAuth:["Cessna 172S","Cessna 172N","Cessna 152","Piper PA-28-181"], lastCheck:"16 Sep 2026" },
  { id:"p10", name:"Elena Rossi", role:"CFI / CFII", hrs90:61.8, currency:"Flight review & medical current", medical:"Current", lastFlight:"05 Oct 2026", clubCurrency:"Current", nextCheck:"28 Feb 2027", trainingStatus:"current", pendingSignoff:false, aircraftAuth:["Cessna 172S","Cessna 172N","Cessna 152","Diamond DA40"], lastCheck:"28 Aug 2026" },
  { id:"p11", name:"Omar Haddad", role:"Student — Pre-solo", hrs90:8.2, currency:"Medical current (Class 3, exp. 15mo)", medical:"Current — 15 months remaining", lastFlight:"29 Sep 2026", clubCurrency:"Current — supervised only", nextCheck:"24 Nov 2026", trainingStatus:"current", pendingSignoff:false, aircraftAuth:["Cessna 152"], lastCheck:"24 Sep 2026" },
  { id:"p12", name:"Taylor Brooks", role:"Student — Commercial", hrs90:22.6, currency:"Medical current (Class 2, exp. 7mo)", medical:"Current — 7 months remaining", lastFlight:"01 Oct 2026", clubCurrency:"Expired — checkout required", nextCheck:"OVERDUE", trainingStatus:"noncurrent", pendingSignoff:false, aircraftAuth:["Cessna 172S","Piper PA-28-181"], lastCheck:"02 Mar 2026" },
];

export const DEMO_OPS_AIRCRAFT = [
  { id:"a1", tail:"N172SR", type:"Cessna 172S", status:"airworthy", squawk:null, last100:"12 days ago", airframeHours:4218.6, nextMaintenanceHours:37.2, annualDue:"14 Jan 2027", defects:[], maintenanceHistory:["100-hour inspection completed 24 Sep 2026","Oil & filter change 24 Sep 2026"], audit:[{time:"24 Sep 2026 15:20",text:"Returned to service after 100-hour inspection"}] },
  { id:"a2", tail:"N44TR", type:"Cessna 172N", status:"restricted", squawk:"Right nav light intermittent — deferred (minor)", last100:"45 days ago", airframeHours:3184.7, nextMaintenanceHours:8.4, annualDue:"02 Dec 2026", defects:[{id:"DEF-0047",text:"Right nav light intermittent",status:"Deferred",restriction:"Day VFR only"}], maintenanceHistory:["50-hour inspection completed 22 Aug 2026"], audit:[{time:"04 Oct 2026 09:15",text:"DEF-0047 assessed — aircraft restricted to Day VFR"}] },
  { id:"a3", tail:"N9DA", type:"Piper PA-28-181", status:"grounded", squawk:"Engine oil analysis pending — DO NOT FLY", last100:"6 days ago", airframeHours:5520.1, nextMaintenanceHours:94.0, annualDue:"21 Mar 2027", defects:[{id:"DEF-0051",text:"Engine oil analysis pending",status:"Work in progress",restriction:"Aircraft grounded"}], maintenanceHistory:["100-hour inspection completed 30 Sep 2026"], audit:[{time:"05 Oct 2026 17:42",text:"Aircraft grounded pending engine oil analysis"}] },
  { id:"a4", tail:"N721CT", type:"Cessna 152", status:"airworthy", squawk:null, last100:"3 days ago", airframeHours:7642.3, nextMaintenanceHours:47.8, annualDue:"08 Feb 2027", defects:[], maintenanceHistory:["50-hour inspection completed 03 Oct 2026"], audit:[{time:"03 Oct 2026 11:10",text:"50-hour inspection completed — returned to service"}] },
  { id:"a5", tail:"N818DA", type:"Diamond DA40", status:"airworthy", squawk:null, last100:"18 days ago", airframeHours:2261.9, nextMaintenanceHours:61.3, annualDue:"19 Apr 2027", defects:[], maintenanceHistory:["100-hour inspection completed 18 Sep 2026"], audit:[{time:"18 Sep 2026 14:05",text:"Returned to service after scheduled inspection"}] },
  { id:"a6", tail:"N305SP", type:"Cessna 172S", status:"maintenance", squawk:"Scheduled magneto inspection in progress", last100:"99 days ago", airframeHours:6089.4, nextMaintenanceHours:0, annualDue:"30 Nov 2026", defects:[{id:"DEF-0054",text:"Scheduled magneto inspection",status:"Work in progress",restriction:"Aircraft unavailable during maintenance"}], maintenanceHistory:["Entered scheduled maintenance 06 Oct 2026"], audit:[{time:"06 Oct 2026 08:30",text:"Aircraft placed in Maintenance for scheduled magneto inspection"}] },
];

export const DEMO_CLUB_USERS = [
  ...DEMO_OPS_PEOPLE.map(person=>({
    id:`u-${person.id}`,
    personId:person.id,
    name:person.name,
    email:`${person.name.toLowerCase().replace(/[^a-z]+/g,".").replace(/^\.|\.$/g,"")}@example.test`,
    status:"active",
    roles:person.role.includes("CFI")?["pilot","cfi"]:["pilot"],
  })),
  { id:"u-engineering", personId:null, name:"Evelyn Carter", email:"evelyn.carter@example.test", status:"active", roles:["engineering"] },
].map(user=>user.personId==="p3"?{...user,roles:["pilot","cfi","admin"]}:user);

export const DEMO_ADMIN_AUDIT = [
  { time:"06 Oct 2026 09:00", source:"Club Admin", text:"Functional beta access review opened" },
  { time:"05 Oct 2026 17:45", source:"Club Admin", text:"Prototype safety policies confirmed as enforced" },
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createDemoWorkspaceSnapshot({
  id = "local-private-demo",
  name = DEFAULT_DEMO_WORKSPACE_NAME,
  kind = "independent_cfi",
  now = new Date().toISOString(),
} = {}) {
  return {
    schemaVersion:WORKSPACE_SCHEMA_VERSION,
    templateVersion:DEMO_TEMPLATE_VERSION,
    id,
    name,
    kind,
    dataMode:"synthetic",
    authoritative:false,
    resettable:true,
    revision:0,
    createdAt:now,
    updatedAt:now,
    people:clone(DEMO_OPS_PEOPLE),
    aircraft:clone(DEMO_OPS_AIRCRAFT),
    users:clone(DEMO_CLUB_USERS),
    adminAudit:clone(DEMO_ADMIN_AUDIT),
  };
}

export function cloneWorkspaceSnapshot(snapshot) {
  return clone(snapshot);
}

export function isSafeDemoWorkspaceSnapshot(value) {
  return !!value &&
    value.schemaVersion === WORKSPACE_SCHEMA_VERSION &&
    value.dataMode === "synthetic" &&
    value.authoritative === false &&
    Array.isArray(value.people) &&
    Array.isArray(value.aircraft) &&
    Array.isArray(value.users) &&
    Array.isArray(value.adminAudit);
}
