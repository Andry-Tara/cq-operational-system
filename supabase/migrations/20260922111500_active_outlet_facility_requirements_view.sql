begin;

create or replace view
public.active_outlet_facility_requirements
with (
  security_invoker = true
)
as

select distinct
  o.organization_id,
  ofa.outlet_id,
  ofa.form_id,
  ofa.form_version_id,

  fd.id
    as facility_id,

  fd.code
    as facility_code

from public.outlet_form_assignments ofa

join public.outlets o
  on o.id =
     ofa.outlet_id
 and o.is_active =
     true

join public.form_version_sections fvs
  on fvs.form_version_id =
     ofa.form_version_id
 and fvs.is_active =
     true

join public.questions q
  on q.version_section_id =
     fvs.id
 and q.is_active =
     true

join public.facility_definitions fd
  on fd.organization_id =
     o.organization_id

 and upper(
       btrim(
         fd.code
       )
     ) =
     upper(
       btrim(
         coalesce(
           q.config #>>
             '{applicability,facility_key}',
           ''
         )
       )
     )

 and fd.is_active =
     true

where ofa.is_active =
      true

  and lower(
        btrim(
          coalesce(
            q.config #>>
              '{applicability,type}',
            ''
          )
        )
      ) =
      'facility'

  and btrim(
        coalesce(
          q.config #>>
            '{applicability,facility_key}',
          ''
        )
      ) <>
      '';

revoke all
on public.active_outlet_facility_requirements
from anon, authenticated;

grant select
on public.active_outlet_facility_requirements
to service_role;

commit;
