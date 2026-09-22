create index if not exists idx_report_answers_section_question_id_desc
on public.report_answers (report_section_id, question_id, id desc);

create index if not exists idx_report_photos_section_id
on public.report_photos (report_section_id);

create index if not exists idx_report_photos_answer_id
on public.report_photos (answer_id);

create index if not exists idx_report_question_applicability_section_question
on public.report_question_applicability (report_section_id, question_id);

create index if not exists idx_issues_report_section_status
on public.issues (report_section_id, status);

create or replace function public.get_report_center_section_metrics(
  p_report_section_ids uuid[]
)
returns table (
  report_section_id uuid,
  report_id uuid,
  question_count integer,
  answer_count integer,
  photo_count integer,
  required_photo_count integer,
  required_photo_complete_count integer,
  issue_count integer,
  open_issue_count integer
)
language sql
security definer
set search_path = public
as $$
with input_sections as (
  select distinct
    ids.input_id as id
  from unnest(
    coalesce(
      p_report_section_ids,
      array[]::uuid[]
    )
  ) as ids(input_id)
),

selected_sections as (
  select
    rs.id,
    rs.report_id,
    rs.version_section_id,
    coalesce(
      rs.applicability_status,
      'active'
    ) as applicability_status
  from public.report_sections rs
  join input_sections i
    on i.id = rs.id
),

active_questions as (
  select
    ss.id as report_section_id,
    q.id as question_id,
    q.question_type,
    q.min_value,
    q.max_value,
    q.config::jsonb as config
  from selected_sections ss
  join public.questions q
    on q.version_section_id =
      ss.version_section_id
  where q.is_active = true
),

applicability_flags as (
  select
    rqa.report_section_id,
    rqa.question_id,
    rqa.is_applicable
  from public.report_question_applicability rqa
  join selected_sections ss
    on ss.id = rqa.report_section_id
),

applicability_exists as (
  select
    report_section_id,
    count(*) > 0 as has_snapshot
  from applicability_flags
  group by report_section_id
),

effective_questions as (
  select
    aq.*
  from active_questions aq
  join selected_sections ss
    on ss.id =
      aq.report_section_id
  left join applicability_exists ae
    on ae.report_section_id =
      aq.report_section_id
  left join applicability_flags af
    on af.report_section_id =
      aq.report_section_id
   and af.question_id =
      aq.question_id
  where ss.applicability_status <>
    'no_production'
    and (
      coalesce(
        ae.has_snapshot,
        false
      ) = false
      or af.is_applicable = true
    )
),

question_counts as (
  select
    report_section_id,
    count(*)::integer as question_count
  from effective_questions
  group by report_section_id
),

latest_answers as (
  select distinct on (
    ra.report_section_id,
    ra.question_id
  )
    ra.id,
    ra.report_section_id,
    ra.question_id,
    ra.answer_value::jsonb as answer_value
  from public.report_answers ra
  join selected_sections ss
    on ss.id =
      ra.report_section_id
  order by
    ra.report_section_id,
    ra.question_id,
    ra.id desc
),

answer_counts as (
  select
    ss.id as report_section_id,
    count(ra.id) filter (
      where ss.applicability_status <>
        'no_production'
        and (
          coalesce(
            ae.has_snapshot,
            false
          ) = false
          or af.is_applicable = true
        )
    )::integer as answer_count
  from selected_sections ss
  left join applicability_exists ae
    on ae.report_section_id =
      ss.id
  left join public.report_answers ra
    on ra.report_section_id =
      ss.id
  left join applicability_flags af
    on af.report_section_id =
      ra.report_section_id
   and af.question_id =
      ra.question_id
  group by
    ss.id,
    ss.applicability_status
),

photo_counts as (
  select
    rp.report_section_id,
    count(*)::integer as photo_count
  from public.report_photos rp
  join selected_sections ss
    on ss.id =
      rp.report_section_id
  group by rp.report_section_id
),

photo_answer_ids as (
  select distinct
    rp.answer_id
  from public.report_photos rp
  join selected_sections ss
    on ss.id =
      rp.report_section_id
  where rp.answer_id is not null
),

required_photo_questions as (
  select
    eq.report_section_id,
    eq.question_id,
    la.id as answer_id,
    case
      when coalesce(
        eq.config ->> 'evidence_mode',
        ''
      ) = 'none'
        then false

      when coalesce(
        eq.config ->> 'evidence_mode',
        ''
      ) = 'on_issue'
        then
          case
            when eq.question_type = 'yes_no'
              then scalar.answer_value =
                'false'::jsonb

            when eq.question_type = 'temperature'
              and jsonb_typeof(
                scalar.answer_value
              ) = 'number'
              then (
                (
                  eq.min_value is not null
                  and (
                    scalar.answer_value #>> '{}'
                  )::numeric <
                    eq.min_value::numeric
                )
                or
                (
                  eq.max_value is not null
                  and (
                    scalar.answer_value #>> '{}'
                  )::numeric >
                    eq.max_value::numeric
                )
              )

            else false
          end

      else true
    end as photo_required
  from effective_questions eq
  left join latest_answers la
    on la.report_section_id =
      eq.report_section_id
   and la.question_id =
      eq.question_id
  left join lateral (
    select
      case
        when la.answer_value is not null
          and jsonb_typeof(
            la.answer_value
          ) = 'object'
          and la.answer_value ? 'value'
          then la.answer_value -> 'value'
        else la.answer_value
      end as answer_value
  ) scalar
    on true
),

required_photo_counts as (
  select
    report_section_id,
    count(*) filter (
      where photo_required = true
    )::integer as required_photo_count,
    count(*) filter (
      where photo_required = true
        and answer_id is not null
        and exists (
          select 1
          from photo_answer_ids pai
          where pai.answer_id =
            required_photo_questions.answer_id
        )
    )::integer as required_photo_complete_count
  from required_photo_questions
  group by report_section_id
),

issue_counts as (
  select
    ss.report_id,
    count(i.id)::integer as issue_count,
    count(i.id) filter (
      where lower(
        coalesce(
          i.status,
          ''
        )
      ) not in (
        'closed',
        'resolved',
        'completed'
      )
    )::integer as open_issue_count
  from selected_sections ss
  left join public.issues i
    on i.report_section_id =
      ss.id
  group by ss.report_id
)

select
  ss.id as report_section_id,
  ss.report_id,
  case
    when ss.applicability_status =
      'no_production'
      then 0
    else coalesce(
      qc.question_count,
      0
    )
  end::integer as question_count,
  case
    when ss.applicability_status =
      'no_production'
      then 0
    else coalesce(
      ac.answer_count,
      0
    )
  end::integer as answer_count,
  coalesce(
    pc.photo_count,
    0
  )::integer as photo_count,
  case
    when ss.applicability_status =
      'no_production'
      then 0
    else coalesce(
      rpc.required_photo_count,
      0
    )
  end::integer as required_photo_count,
  case
    when ss.applicability_status =
      'no_production'
      then 0
    else coalesce(
      rpc.required_photo_complete_count,
      0
    )
  end::integer as required_photo_complete_count,
  coalesce(
    ic.issue_count,
    0
  )::integer as issue_count,
  coalesce(
    ic.open_issue_count,
    0
  )::integer as open_issue_count
from selected_sections ss
left join question_counts qc
  on qc.report_section_id =
    ss.id
left join answer_counts ac
  on ac.report_section_id =
    ss.id
left join photo_counts pc
  on pc.report_section_id =
    ss.id
left join required_photo_counts rpc
  on rpc.report_section_id =
    ss.id
left join issue_counts ic
  on ic.report_id =
    ss.report_id
order by
  ss.report_id,
  ss.id;
$$;
