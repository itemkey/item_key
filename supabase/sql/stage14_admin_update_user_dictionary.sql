-- Stage 14: admin update for public user dictionaries

create or replace function public.ik_admin_update_user_dict(
  p_title text,
  p_words jsonb,
  p_dict_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_dict public.ik_public_dicts%rowtype;
  v_title text;
  v_next_ver int;
  v_prev_ver_id bigint;
  v_ver_id bigint;
begin
  if v_actor is null then
    raise exception 'auth required';
  end if;

  if not (public.ik_has_role('owner', v_actor) or public.ik_has_role('admin', v_actor) or public.ik_is_tech_admin(v_actor)) then
    raise exception 'admin required';
  end if;

  if p_dict_id is null or p_dict_id <= 0 then
    raise exception 'dict_id required';
  end if;

  if jsonb_typeof(p_words) <> 'array' then
    raise exception 'words must be json array';
  end if;

  select *
    into v_dict
  from public.ik_public_dicts d
  where d.id = p_dict_id
    and d.dict_type = 'user'
  for update;

  if not found then
    raise exception 'user dict not found';
  end if;

  v_prev_ver_id := v_dict.current_version_id;
  v_title := btrim(coalesce(p_title, v_dict.title));
  if v_title = '' then
    v_title := v_dict.title;
  end if;

  select coalesce(max(version), 0) + 1
    into v_next_ver
  from public.ik_public_dict_versions
  where dict_id = v_dict.id;

  insert into public.ik_public_dict_versions(dict_id, version, status, created_by)
  values (v_dict.id, v_next_ver, 'published', v_actor)
  returning id into v_ver_id;

  insert into public.ik_public_dict_words(dict_version_id, en, ru, en_key, ru_key, pair_key)
  select
    v_ver_id,
    s.en,
    s.ru,
    s.en_key,
    s.ru_key,
    s.pair_key
  from (
    select distinct on (pair_key)
      btrim(coalesce(x->>'en', '')) as en,
      btrim(coalesce(x->>'ru', '')) as ru,
      public.ik_norm_space_lower(coalesce(x->>'en', '')) as en_key,
      public.ik_norm_space_lower(coalesce(x->>'ru', '')) as ru_key,
      public.ik_norm_space_lower(coalesce(x->>'en', '')) || '|' || public.ik_norm_space_lower(coalesce(x->>'ru', '')) as pair_key
    from jsonb_array_elements(coalesce(p_words, '[]'::jsonb)) x
    where btrim(coalesce(x->>'en', '')) <> ''
      and btrim(coalesce(x->>'ru', '')) <> ''
    order by pair_key
  ) s;

  update public.ik_public_dicts
  set current_version_id = v_ver_id,
      title = v_title,
      title_key = public.ik_title_key(v_title),
      updated_at = now()
  where id = v_dict.id;

  if v_prev_ver_id is not null then
    update public.ik_public_dict_versions
    set status = 'archived'
    where id = v_prev_ver_id;
  end if;

  return jsonb_build_object('ok', true, 'dict_id', v_dict.id, 'version', v_next_ver, 'version_id', v_ver_id);
end;
$$;

revoke all on function public.ik_admin_update_user_dict(text, jsonb, bigint) from public;
grant execute on function public.ik_admin_update_user_dict(text, jsonb, bigint) to authenticated;
