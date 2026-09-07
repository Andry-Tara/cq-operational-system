begin;

do $$
declare
  v_existing_expression text;
begin

  -- Preserve the existing allowed-status rule exactly,
  -- then extend it with needs_correction.
  select
    pg_get_expr(
      c.conbin,
      c.conrelid
    )
  into
    v_existing_expression
  from pg_constraint c
  where
    c.conrelid =
      'public.report_sections'::regclass
    and c.conname =
      'report_sections_status_check'
    and c.contype =
      'c';


  if
    v_existing_expression
    is null
  then
    raise exception
      'Constraint report_sections_status_check not found';
  end if;


  alter table
    public.report_sections
  drop constraint
    report_sections_status_check;


  execute format(
    'alter table public.report_sections
       add constraint report_sections_status_check
       check (
         status = %L
         or (%s)
       )
       not valid',
    'needs_correction',
    v_existing_expression
  );


  alter table
    public.report_sections
  validate constraint
    report_sections_status_check;

end;
$$;

commit;
