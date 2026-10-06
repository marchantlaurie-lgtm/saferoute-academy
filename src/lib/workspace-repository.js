import {
  cloneWorkspaceSnapshot,
  createDemoWorkspaceSnapshot,
  isSafeDemoWorkspaceSnapshot,
} from "../data/demo-workspace-template.js";

export const BROWSER_WORKSPACE_KEY = "saferoute.demo-workspace.v1";

function assertSyntheticWorkspace(snapshot) {
  if (!isSafeDemoWorkspaceSnapshot(snapshot)) {
    throw new Error("SafeRoute refused to persist a non-synthetic or malformed demo workspace.");
  }
}

function persistedState(snapshot) {
  return {
    schemaVersion:snapshot.schemaVersion,
    templateVersion:snapshot.templateVersion,
    dataMode:"synthetic",
    authoritative:false,
    resettable:true,
    people:cloneWorkspaceSnapshot(snapshot.people),
    aircraft:cloneWorkspaceSnapshot(snapshot.aircraft),
    users:cloneWorkspaceSnapshot(snapshot.users),
    adminAudit:cloneWorkspaceSnapshot(snapshot.adminAudit),
  };
}

export function loadBrowserWorkspaceSnapshot(storage, seed = createDemoWorkspaceSnapshot()) {
  if (!storage) return cloneWorkspaceSnapshot(seed);
  try {
    const raw = storage.getItem(BROWSER_WORKSPACE_KEY);
    if (!raw) return cloneWorkspaceSnapshot(seed);
    const parsed = JSON.parse(raw);
    return isSafeDemoWorkspaceSnapshot(parsed) ? parsed : cloneWorkspaceSnapshot(seed);
  } catch {
    return cloneWorkspaceSnapshot(seed);
  }
}

export function createBrowserWorkspaceRepository({ storage, seed = createDemoWorkspaceSnapshot() }) {
  let current = loadBrowserWorkspaceSnapshot(storage, seed);
  return {
    mode:"device",
    label:"PRIVATE SYNTHETIC DEMO · SAVED ON THIS DEVICE",
    async loadOrCreate() {
      return cloneWorkspaceSnapshot(current);
    },
    async save(snapshot) {
      assertSyntheticWorkspace(snapshot);
      current = {
        ...cloneWorkspaceSnapshot(snapshot),
        revision:(snapshot.revision || 0) + 1,
        updatedAt:new Date().toISOString(),
      };
      storage?.setItem(BROWSER_WORKSPACE_KEY, JSON.stringify(current));
      return cloneWorkspaceSnapshot(current);
    },
    async reset() {
      current = createDemoWorkspaceSnapshot({
        id:current.id,
        name:current.name,
        kind:current.kind,
      });
      storage?.setItem(BROWSER_WORKSPACE_KEY, JSON.stringify(current));
      return cloneWorkspaceSnapshot(current);
    },
  };
}

export function getWorkspaceBackendConfig(env = {}) {
  const url = env.VITE_SUPABASE_URL?.trim();
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function createSupabaseWorkspaceRepository({ url, anonKey, seed = createDemoWorkspaceSnapshot() }) {
  let supabasePromise = null;
  let current = null;

  async function client() {
    if (!supabasePromise) {
      supabasePromise = import("@supabase/supabase-js").then(({ createClient }) => createClient(url, anonKey, {
        auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:false },
      }));
    }
    return supabasePromise;
  }

  async function authenticatedUser() {
    const supabase = await client();
    const { data:{ session } } = await supabase.auth.getSession();
    if (session?.user) return session.user;
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    return data.user;
  }

  async function loadState(organisation) {
    const supabase = await client();
    const { data, error } = await supabase
      .from("saferoute_workspace_state")
      .select("state, revision, created_at, updated_at")
      .eq("organisation_id", organisation.id)
      .single();
    if (error) throw error;
    const snapshot = {
      ...data.state,
      id:organisation.id,
      name:organisation.name,
      kind:organisation.workspace_kind,
      revision:data.revision,
      createdAt:data.created_at,
      updatedAt:data.updated_at,
    };
    assertSyntheticWorkspace(snapshot);
    return snapshot;
  }

  return {
    mode:"cloud",
    label:"PRIVATE SYNTHETIC DEMO · CLOUD SAVED",
    async loadOrCreate() {
      const user = await authenticatedUser();
      const supabase = await client();
      const { data:existing, error:findError } = await supabase
        .from("saferoute_organisations")
        .select("id, name, workspace_kind")
        .eq("created_by", user.id)
        .eq("workspace_kind", seed.kind)
        .limit(1)
        .maybeSingle();
      if (findError) throw findError;

      let organisation = existing;
      if (!organisation) {
        const initialState = persistedState(seed);
        const { data, error } = await supabase.rpc("create_saferoute_demo_workspace", {
          p_name:seed.name,
          p_workspace_kind:seed.kind,
          p_initial_state:initialState,
        });
        if (error) throw error;
        organisation = { id:data, name:seed.name, workspace_kind:seed.kind };
      }
      current = await loadState(organisation);
      return cloneWorkspaceSnapshot(current);
    },
    async save(snapshot) {
      assertSyntheticWorkspace(snapshot);
      if (!current) throw new Error("Cloud workspace must be loaded before it can be saved.");
      const supabase = await client();
      const { data, error } = await supabase.rpc("save_saferoute_demo_workspace", {
        p_organisation_id:current.id,
        p_expected_revision:current.revision,
        p_state:persistedState(snapshot),
      });
      if (error) throw error;
      current = {
        ...cloneWorkspaceSnapshot(snapshot),
        id:current.id,
        name:current.name,
        kind:current.kind,
        revision:data.revision,
        createdAt:current.createdAt,
        updatedAt:data.updated_at,
      };
      return cloneWorkspaceSnapshot(current);
    },
    async reset() {
      if (!current) throw new Error("Cloud workspace must be loaded before it can be reset.");
      const resetSnapshot = createDemoWorkspaceSnapshot({
        id:current.id,
        name:current.name,
        kind:current.kind,
      });
      resetSnapshot.revision = current.revision;
      assertSyntheticWorkspace(resetSnapshot);
      const supabase = await client();
      const { data, error } = await supabase.rpc("save_saferoute_demo_workspace", {
        p_organisation_id:current.id,
        p_expected_revision:current.revision,
        p_state:persistedState(resetSnapshot),
      });
      if (error) throw error;
      current = {
        ...resetSnapshot,
        revision:data.revision,
        createdAt:current.createdAt,
        updatedAt:data.updated_at,
      };
      return cloneWorkspaceSnapshot(current);
    },
  };
}

export function createConfiguredWorkspaceRepository({ env = {}, storage, seed }) {
  const config = getWorkspaceBackendConfig(env);
  if (config) return createSupabaseWorkspaceRepository({ ...config, seed });
  return createBrowserWorkspaceRepository({ storage, seed });
}
