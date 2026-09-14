begin;

create or replace function public.update_draft_question_settings(
  p_form_version_id uuid,
  p_question_id uuid,
  p_is_required boolean,
  p_is_active boolean,
  p_evidence_mode text,
  p_applicability_type text,
  p_facility_key text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_facility_key text :=
    nullif(btrim(p_facility_key), '');
begin
  if auth.uid() is null then
    raise exception
      'Authenticated caller is required.'
      using errcode = '28000';
  end if;

  perform public.assert_draft_form_version_access(
    p_form_version_id
  );

  if p_is_required is null
     or p_is_active is null
     or p_evidence_mode is null
     or p_evidence_mode not in (
       'always',
       'on_issue',
       'none'
     )
     or p_applicability_type is null
     or p_applicability_type not in (
       'global',
       'facility'
     ) then
    raise exception
      'Invalid question settings.'
      using errcode = '22023';
  end if;

  if p_applicability_type = 'facility'
     and v_facility_key is null then
    raise exception
      'Facility key is required for facility applicability.'
      using errcode = '22023';
  end if;

  if p_applicability_type = 'global' then
    v_facility_key := null;
  end if;

  if p_applicability_type = 'facility'
     and not exists (
       select 1
       from public.form_versions fv
       join public.forms f
         on f.id = fv.form_id
       join public.facility_definitions fd
         on fd.organization_id =
            f.organization_id
       where fv.id = p_form_version_id
         and fd.code = v_facility_key
         and fd.is_active = true
     ) then
    raise exception
      'Facility definition is not active for this form organization.'
      using errcode = '22023';
  end if;

  update public.questions q
  set
    is_required = p_is_required,
    is_active = p_is_active,
    config =
      (
        coalesce(
          q.config,
          '{}'::jsonb
        )
        - 'evidence_mode'
        - 'applicability'
      )
      ||
      jsonb_build_object(
        'evidence_mode',
        p_evidence_mode
      )
      ||
      jsonb_build_object(
        'applicability',
        case
          when
            p_applicability_type =
            'facility'
          then
            jsonb_build_object(
              'type',
              'facility',
              'facility_key',
              v_facility_key
            )
          else
            jsonb_build_object(
              'type',
              'global'
            )
        end
      )
  from public.form_version_sections fvs
  where q.id = p_question_id
    and q.version_section_id = fvs.id
    and fvs.form_version_id =
        p_form_version_id;

  if not found then
    raise exception
      'Question was not found in this form version.'
      using errcode = '22023';
  end if;
end;
$$;

revoke all on function
  public.update_draft_question_settings(
    uuid,
    uuid,
    boolean,
    boolean,
    text,
    text,
    text
  )
from public;

revoke all on function
  public.update_draft_question_settings(
    uuid,
    uuid,
    boolean,
    boolean,
    text,
    text,
    text
  )
from anon;

grant execute on function
  public.update_draft_question_settings(
    uuid,
    uuid,
    boolean,
    boolean,
    text,
    text,
    text
  )
to authenticated;

commit;
