begin;

update public.test_food_menus
set
  notes = null,
  is_seasonal = false,
  updated_at = now()
where code = 'SOUP_CRAB'
  and is_active = true;

do $$
declare
  v_count integer;
begin
  select count(*)
  into v_count
  from public.test_food_menus
  where code = 'SOUP_CRAB'
    and is_active = true
    and notes is null
    and is_seasonal = false;

  if v_count <> 1 then
    raise exception
      'TEST FOOD POSTCHECK: expected exactly one active Crab Soup without seasonal note, found %.',
      v_count;
  end if;
end;
$$;

commit;
