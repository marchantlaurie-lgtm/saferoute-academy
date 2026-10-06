create extension if not exists pgcrypto;

create table if not exists public.saferoute_organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  workspace_kind text not null check (workspace_kind in ('independent_cfi', 'school_review')),
  data_mode text not null default 'synthetic' check (data_mode in ('synthetic', 'pseudonymous')),
  is_authoritative boolean not null default false check (is_authoritative = false),
  resettable boolean not null default true,
  template_version integer not null default 1 check (template_version > 0),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists saferoute_one_private_workspace_per_creator_kind
on public.saferoute_organisations (created_by, workspace_kind);

create table if not exists public.saferoute_memberships (
  organisation_id uuid not null references public.saferoute_organisations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  roles text[] not null default array['pilot']::text[],
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  primary key (organisation_id, user_id),
  check (roles <@ array['pilot', 'cfi', 'engineering', 'admin']::text[])
);

create table if not exists public.saferoute_workspace_state (
  organisation_id uuid primary key references public.saferoute_organisations(id) on delete cascade,
  state jsonb not null,
  revision bigint not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (state ->> 'dataMode' = 'synthetic'),
  check (state ->> 'authoritative' = 'false'),
  check (jsonb_typeof(state -> 'people') = 'array'),
  check (jsonb_typeof(state -> 'aircraft') = 'array'),
  check (jsonb_typeof(state -> 'users') = 'array'),
  check (jsonb_typeof(state -> 'adminAudit') = 'array')
);

create table if not exists public.saferoute_audit_events (
  id bigint generated always as identity primary key,
  organisation_id uuid not null references public.saferoute_organisations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

alter table public.saferoute_organisations enable row level security;
alter table public.saferoute_memberships enable row level security;
alter table public.saferoute_workspace_state enable row level security;
alter table public.saferoute_audit_events enable row level security;

create or replace function public.saferoute_is_active_member(p_organisation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.saferoute_memberships membership
    where membership.organisation_id = p_organisation_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  );
$$;

revoke all on function public.saferoute_is_active_member(uuid) from public;
grant execute on function public.saferoute_is_active_member(uuid) to authenticated;

grant select on public.saferoute_organisations to authenticated;
grant select on public.saferoute_memberships to authenticated;
grant select on public.saferoute_workspace_state to authenticated;
grant select on public.saferoute_audit_events to authenticated;

drop policy if exists "Members can read their SafeRoute organisations" on public.saferoute_organisations;
create policy "Members can read their SafeRoute organisations"
on public.saferoute_organisations for select
to authenticated
using (public.saferoute_is_active_member(id));

drop policy if exists "Members can read memberships in their organisations" on public.saferoute_memberships;
create policy "Members can read memberships in their organisations"
on public.saferoute_memberships for select
to authenticated
using (public.saferoute_is_active_member(organisation_id));

drop policy if exists "Members can read their synthetic workspace" on public.saferoute_workspace_state;
create policy "Members can read their synthetic workspace"
on public.saferoute_workspace_state for select
to authenticated
using (public.saferoute_is_active_member(organisation_id));

drop policy if exists "Members can read their workspace audit" on public.saferoute_audit_events;
create policy "Members can read their workspace audit"
on public.saferoute_audit_events for select
to authenticated
using (public.saferoute_is_active_member(organisation_id));

create or replace function public.create_saferoute_demo_workspace(
  p_name text,
  p_workspace_kind text,
  p_initial_state jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_organisation_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required';
  end if;
  if p_workspace_kind not in ('independent_cfi', 'school_review') then
    raise exception 'Unsupported SafeRoute workspace kind';
  end if;
  if p_name is null or char_length(trim(p_name)) = 0 then
    raise exception 'A SafeRoute workspace name is required';
  end if;
  if p_initial_state ->> 'dataMode' is distinct from 'synthetic'
     or p_initial_state ->> 'authoritative' is distinct from 'false' then
    raise exception 'Step 3 accepts synthetic, non-authoritative demo data only';
  end if;

  insert into public.saferoute_organisations (
    name, workspace_kind, data_mode, is_authoritative, resettable, template_version, created_by
  ) values (
    left(trim(p_name), 120), p_workspace_kind, 'synthetic', false, true,
    coalesce((p_initial_state ->> 'templateVersion')::integer, 1), v_user_id
  ) returning id into v_organisation_id;

  insert into public.saferoute_memberships (organisation_id, user_id, roles)
  values (v_organisation_id, v_user_id, array['pilot', 'cfi', 'engineering', 'admin']::text[]);

  insert into public.saferoute_workspace_state (organisation_id, state)
  values (v_organisation_id, p_initial_state);

  insert into public.saferoute_audit_events (organisation_id, actor_id, action, metadata)
  values (v_organisation_id, v_user_id, 'demo_workspace_created', jsonb_build_object('workspace_kind', p_workspace_kind));

  return v_organisation_id;
end;
$$;

revoke all on function public.create_saferoute_demo_workspace(text, text, jsonb) from public;
grant execute on function public.create_saferoute_demo_workspace(text, text, jsonb) to authenticated;

create or replace function public.save_saferoute_demo_workspace(
  p_organisation_id uuid,
  p_expected_revision bigint,
  p_state jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_revision bigint;
  v_updated_at timestamptz;
begin
  if v_user_id is null or not public.saferoute_is_active_member(p_organisation_id) then
    raise exception 'SafeRoute workspace access denied';
  end if;
  if p_state ->> 'dataMode' is distinct from 'synthetic'
     or p_state ->> 'authoritative' is distinct from 'false' then
    raise exception 'Step 3 accepts synthetic, non-authoritative demo data only';
  end if;

  update public.saferoute_workspace_state
  set state = p_state,
      revision = revision + 1,
      updated_at = now()
  where organisation_id = p_organisation_id
    and revision = p_expected_revision
  returning revision, updated_at into v_revision, v_updated_at;

  if not found then
    raise exception 'SafeRoute workspace changed elsewhere; reload before saving again';
  end if;

  update public.saferoute_organisations
  set updated_at = v_updated_at
  where id = p_organisation_id;

  insert into public.saferoute_audit_events (organisation_id, actor_id, action, metadata)
  values (p_organisation_id, v_user_id, 'demo_workspace_saved', jsonb_build_object('revision', v_revision));

  return jsonb_build_object('revision', v_revision, 'updated_at', v_updated_at);
end;
$$;

revoke all on function public.save_saferoute_demo_workspace(uuid, bigint, jsonb) from public;
grant execute on function public.save_saferoute_demo_workspace(uuid, bigint, jsonb) to authenticated;

revoke insert, update, delete on public.saferoute_organisations from anon, authenticated;
revoke insert, update, delete on public.saferoute_memberships from anon, authenticated;
revoke insert, update, delete on public.saferoute_workspace_state from anon, authenticated;
revoke insert, update, delete on public.saferoute_audit_events from anon, authenticated;

comment on table public.saferoute_workspace_state is
  'Step 3 synthetic demo state only. Real or authoritative aviation records are intentionally rejected.';
