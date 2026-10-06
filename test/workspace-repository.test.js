import test from "node:test";
import assert from "node:assert/strict";
import { createDemoWorkspaceSnapshot } from "../src/data/demo-workspace-template.js";
import {
  BROWSER_WORKSPACE_KEY,
  createBrowserWorkspaceRepository,
  getWorkspaceBackendConfig,
  loadBrowserWorkspaceSnapshot,
} from "../src/lib/workspace-repository.js";

function memoryStorage() {
  const values=new Map();
  return {
    getItem:key=>values.has(key)?values.get(key):null,
    setItem:(key,value)=>values.set(key,String(value)),
    removeItem:key=>values.delete(key),
  };
}

test("the demo template is a useful-sized synthetic and non-authoritative school", () => {
  const workspace=createDemoWorkspaceSnapshot({now:"2026-10-06T12:00:00.000Z"});
  assert.equal(workspace.dataMode,"synthetic");
  assert.equal(workspace.authoritative,false);
  assert.equal(workspace.resettable,true);
  assert.equal(workspace.people.length,12);
  assert.equal(workspace.aircraft.length,6);
  assert.ok(workspace.people.some(person=>person.role.includes("CFI")));
  assert.ok(workspace.aircraft.some(aircraft=>aircraft.status==="grounded"));
  assert.ok(workspace.aircraft.some(aircraft=>aircraft.status==="maintenance"));
});

test("device repository persists shared demo changes across reloads", async () => {
  const storage=memoryStorage();
  const first=createBrowserWorkspaceRepository({storage,seed:createDemoWorkspaceSnapshot()});
  const changed=await first.loadOrCreate();
  changed.people[0].trainingStatus="noncurrent";
  changed.aircraft[0].status="maintenance";
  const saved=await first.save(changed);

  assert.equal(saved.revision,1);
  assert.ok(storage.getItem(BROWSER_WORKSPACE_KEY));

  const second=createBrowserWorkspaceRepository({storage,seed:createDemoWorkspaceSnapshot()});
  const reloaded=await second.loadOrCreate();
  assert.equal(reloaded.people[0].trainingStatus,"noncurrent");
  assert.equal(reloaded.aircraft[0].status,"maintenance");
});

test("reset restores the synthetic template without changing workspace identity", async () => {
  const storage=memoryStorage();
  const repository=createBrowserWorkspaceRepository({storage,seed:createDemoWorkspaceSnapshot({id:"workspace-1",name:"Private CFI Demo"})});
  const changed=await repository.loadOrCreate();
  changed.people=[];
  await repository.save(changed);

  const reset=await repository.reset();
  assert.equal(reset.id,"workspace-1");
  assert.equal(reset.name,"Private CFI Demo");
  assert.equal(reset.people.length,12);
  assert.equal(reset.dataMode,"synthetic");
});

test("malformed or non-synthetic stored data is not loaded", () => {
  const storage=memoryStorage();
  storage.setItem(BROWSER_WORKSPACE_KEY,JSON.stringify({schemaVersion:1,dataMode:"real",authoritative:true}));
  const loaded=loadBrowserWorkspaceSnapshot(storage,createDemoWorkspaceSnapshot());
  assert.equal(loaded.dataMode,"synthetic");
  assert.equal(loaded.authoritative,false);
  assert.equal(loaded.people.length,12);
});

test("cloud persistence activates only when both public Supabase settings exist", () => {
  assert.equal(getWorkspaceBackendConfig({}),null);
  assert.equal(getWorkspaceBackendConfig({VITE_SUPABASE_URL:"https://example.supabase.co"}),null);
  assert.deepEqual(getWorkspaceBackendConfig({
    VITE_SUPABASE_URL:" https://example.supabase.co ",
    VITE_SUPABASE_ANON_KEY:" public-anon-key ",
  }),{url:"https://example.supabase.co",anonKey:"public-anon-key"});
});
