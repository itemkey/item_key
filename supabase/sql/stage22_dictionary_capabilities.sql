-- Stage 22: dictionary capabilities matrix (role-based)
-- Safe to run multiple times.

create or replace function public.ik_dictionary_capabilities()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_is_tech_admin boolean := false;
  v_is_owner boolean := false;
  v_is_admin boolean := false;
  v_is_moderator boolean := false;
  v_can_open_admin_console boolean := false;
  v_can_review_publish_requests boolean := false;
  v_can_manage_system_dicts boolean := false;
  v_can_manage_user_dicts boolean := false;
begin
  if v_user is not null then
    v_is_tech_admin := public.ik_is_tech_admin(v_user);
    v_is_owner := public.ik_has_role('owner', v_user);
    v_is_admin := public.ik_has_role('admin', v_user);
    v_is_moderator := public.ik_has_role('moderator', v_user);
  end if;

  v_can_open_admin_console := (v_is_tech_admin or v_is_owner or v_is_admin or v_is_moderator);
  v_can_review_publish_requests := v_can_open_admin_console;
  v_can_manage_system_dicts := (v_is_tech_admin or v_is_owner or v_is_admin);
  v_can_manage_user_dicts := (v_is_tech_admin or v_is_owner or v_is_admin);

  return jsonb_build_object(
    'user_id', v_user,
    'is_authenticated', (v_user is not null),
    'is_tech_admin', v_is_tech_admin,
    'is_owner', v_is_owner,
    'is_admin', v_is_admin,
    'is_moderator', v_is_moderator,
    'can_open_admin_console', v_can_open_admin_console,
    'can_review_publish_requests', v_can_review_publish_requests,
    'can_manage_system_dicts', v_can_manage_system_dicts,
    'can_manage_user_dicts', v_can_manage_user_dicts,
    'can_submit_publish_request', (v_user is not null)
  );
end;
$$;

revoke all on function public.ik_dictionary_capabilities() from public;
grant execute on function public.ik_dictionary_capabilities() to authenticated;
