-- Supabase may install this event-trigger helper when automatic RLS is enabled.
-- It is an internal database helper and does not need to be callable through
-- the public API roles used by the SafeRoute beta.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end
$$;
