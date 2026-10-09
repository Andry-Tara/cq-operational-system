begin;

-- ============================================================
-- QA FOOD STANDARD — SCORING + FINALIZE V1
--
-- Locked rule:
--   10 menus x 10 points = 100
--
-- Per menu:
--   Service Time / SLA       1
--   Visual / Presentation    1
--   Serving Method           1
--   Plating & Garnish        1
--   Aroma                    1
--   Ingredients              1
--   Portion                  1
--   Temperature              1
--   Taste                    1
--   Texture                  1
--
-- STANDARD / ON TIME = 1
-- NOT_STANDARD / LATE = 0
-- ============================================================


-- ============================================================
-- 1. SESSION SCORE SNAPSHOT
-- ============================================================

alter table public.qa_food_sessions
  add column if not exists qa_number text;

alter table public.qa_food_sessions
  add column if not exists score integer;

alter table public.qa_food_sessions
  add column if not exists max_score integer
    not null
    default 100;

alter table public.qa_food_sessions
  add column if not exists scoring_snapshot jsonb
    not null
    default '{}'::jsonb;

alter table public.qa_food_sessions
  add column if not exists finalized_by uuid
    references auth.users(id)
    on delete restrict;


alter table public.qa_food_sessions
  drop constraint if exists qa_food_sessions_score_chk;

alter table public.qa_food_sessions
  add constraint qa_food_sessions_score_chk
  check (
    score is null
    or score between 0 and 100
  );


alter table public.qa_food_sessions
  drop constraint if exists qa_food_sessions_max_score_chk;

alter table public.qa_food_sessions
  add constraint qa_food_sessions_max_score_chk
  check (
    max_score = 100
  );


create unique index if not exists
qa_food_sessions_qa_number_key
on public.qa_food_sessions (qa_number)
where qa_number is not null;


-- ============================================================
-- 2. FINALIZE FUNCTION
-- ============================================================

create or replace function public.finalize_qa_food_session_v1(
  p_session_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.qa_food_sessions%rowtype;

  v_outlet_code text;

  v_active_count integer := 0;
  v_assessed_count integer := 0;
  v_assessment_count integer := 0;

  v_score integer := 0;
  v_points_lost integer := 0;

  v_standard_menu_count integer := 0;
  v_needs_correction_count integer := 0;

  v_on_time_count integer := 0;
  v_late_count integer := 0;

  v_menu_scores jsonb := '[]'::jsonb;
  v_criterion_summary jsonb := '{}'::jsonb;
  v_snapshot jsonb := '{}'::jsonb;

  v_qa_number text;
  v_result_status text;
begin

  if p_session_id is null then
    raise exception
      'QA Food session id is required.';
  end if;

  if p_actor_user_id is null then
    raise exception
      'QA Food actor user id is required.';
  end if;


  select *
    into v_session
  from public.qa_food_sessions
  where id = p_session_id
  for update;


  if not found then
    raise exception
      'QA Food session was not found.';
  end if;


  if v_session.created_by is distinct from p_actor_user_id then
    raise exception
      'Only the session owner can finalize this QA Food assessment.';
  end if;


  -- Idempotent response.
  if v_session.status = 'FINALIZED' then
    return jsonb_build_object(
      'id',
      v_session.id,

      'qa_number',
      v_session.qa_number,

      'status',
      v_session.status,

      'result_status',
      v_session.result_status,

      'score',
      v_session.score,

      'max_score',
      v_session.max_score,

      'scoring_snapshot',
      v_session.scoring_snapshot,

      'finalized_at',
      v_session.finalized_at
    );
  end if;


  if v_session.status <> 'OPEN' then
    raise exception
      'Only OPEN QA Food sessions can be finalized.';
  end if;


  if v_session.target_menu_count <> 10 then
    raise exception
      'QA Food Standard requires exactly 10 target menus.';
  end if;


  select count(*)
    into v_active_count
  from public.qa_food_session_items i
  where i.session_id = p_session_id
    and i.state <> 'VOIDED';


  if v_active_count <> 10 then
    raise exception
      'QA Food Standard requires exactly 10 active menus. Current: %.',
      v_active_count;
  end if;


  select count(*)
    into v_assessed_count
  from public.qa_food_session_items i
  where i.session_id = p_session_id
    and i.state = 'ASSESSED';


  if v_assessed_count <> 10 then
    raise exception
      'All 10 QA Food menus must be assessed before finalization. Current assessed: %.',
      v_assessed_count;
  end if;


  select count(*)
    into v_assessment_count
  from public.qa_food_session_items i
  join public.qa_food_assessments a
    on a.item_id = i.id
  where i.session_id = p_session_id
    and i.state <> 'VOIDED';


  if v_assessment_count <> 10 then
    raise exception
      'All 10 QA Food menus must have assessment records.';
  end if;


  -- ==========================================================
  -- SESSION SCORE
  -- ==========================================================

  with scored as (
    select
      i.id,
      i.sequence_no,
      i.menu_name_snapshot,
      i.service_status,
      a.result_status,

      (
        case
          when i.service_status = 'STANDARD'
            then 1
          else 0
        end
        +
        case
          when a.visual_status = 'STANDARD'
            then 1
          else 0
        end
        +
        case
          when a.serving_method_status = 'STANDARD'
            then 1
          else 0
        end
        +
        case
          when a.plating_status = 'STANDARD'
            then 1
          else 0
        end
        +
        case
          when a.aroma_status = 'STANDARD'
            then 1
          else 0
        end
        +
        case
          when a.ingredients_status = 'STANDARD'
            then 1
          else 0
        end
        +
        case
          when a.portion_status = 'STANDARD'
            then 1
          else 0
        end
        +
        case
          when a.temperature_status = 'STANDARD'
            then 1
          else 0
        end
        +
        case
          when a.taste_status = 'STANDARD'
            then 1
          else 0
        end
        +
        case
          when a.texture_status = 'STANDARD'
            then 1
          else 0
        end
      )::integer as menu_score

    from public.qa_food_session_items i

    join public.qa_food_assessments a
      on a.item_id = i.id

    where i.session_id = p_session_id
      and i.state <> 'VOIDED'
  )

  select
    coalesce(
      sum(menu_score),
      0
    )::integer,

    count(*) filter (
      where menu_score = 10
    )::integer,

    count(*) filter (
      where menu_score < 10
    )::integer,

    count(*) filter (
      where service_status = 'STANDARD'
    )::integer,

    count(*) filter (
      where service_status = 'LATE'
    )::integer

  into
    v_score,
    v_standard_menu_count,
    v_needs_correction_count,
    v_on_time_count,
    v_late_count

  from scored;


  v_points_lost :=
    100 - v_score;


  -- ==========================================================
  -- MENU SCORE SNAPSHOT
  -- ==========================================================

  with scored as (
    select
      i.id,
      i.sequence_no,
      i.menu_name_snapshot,
      i.service_seconds,
      i.service_status,
      a.result_status,

      (
        case when i.service_status = 'STANDARD' then 1 else 0 end +
        case when a.visual_status = 'STANDARD' then 1 else 0 end +
        case when a.serving_method_status = 'STANDARD' then 1 else 0 end +
        case when a.plating_status = 'STANDARD' then 1 else 0 end +
        case when a.aroma_status = 'STANDARD' then 1 else 0 end +
        case when a.ingredients_status = 'STANDARD' then 1 else 0 end +
        case when a.portion_status = 'STANDARD' then 1 else 0 end +
        case when a.temperature_status = 'STANDARD' then 1 else 0 end +
        case when a.taste_status = 'STANDARD' then 1 else 0 end +
        case when a.texture_status = 'STANDARD' then 1 else 0 end
      )::integer as menu_score

    from public.qa_food_session_items i

    join public.qa_food_assessments a
      on a.item_id = i.id

    where i.session_id = p_session_id
      and i.state <> 'VOIDED'
  )

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'item_id',
          id,

          'sequence_no',
          sequence_no,

          'menu_name',
          menu_name_snapshot,

          'score',
          menu_score,

          'max_score',
          10,

          'points_lost',
          10 - menu_score,

          'service_seconds',
          service_seconds,

          'service_status',
          service_status,

          'result_status',
          case
            when menu_score = 10
              then 'PASS'
            else 'NEEDS_CORRECTION'
          end
        )
        order by sequence_no
      ),
      '[]'::jsonb
    )

  into v_menu_scores

  from scored;


  -- ==========================================================
  -- CRITERION SUMMARY
  -- ==========================================================

  select
    jsonb_build_object(

      'service_time',
      jsonb_build_object(
        'achieved',
        sum(
          case
            when i.service_status = 'STANDARD'
              then 1
            else 0
          end
        ),
        'lost',
        10 -
        sum(
          case
            when i.service_status = 'STANDARD'
              then 1
            else 0
          end
        )
      ),

      'visual',
      jsonb_build_object(
        'achieved',
        sum(case when a.visual_status = 'STANDARD' then 1 else 0 end),
        'lost',
        10 - sum(case when a.visual_status = 'STANDARD' then 1 else 0 end)
      ),

      'serving_method',
      jsonb_build_object(
        'achieved',
        sum(case when a.serving_method_status = 'STANDARD' then 1 else 0 end),
        'lost',
        10 - sum(case when a.serving_method_status = 'STANDARD' then 1 else 0 end)
      ),

      'plating',
      jsonb_build_object(
        'achieved',
        sum(case when a.plating_status = 'STANDARD' then 1 else 0 end),
        'lost',
        10 - sum(case when a.plating_status = 'STANDARD' then 1 else 0 end)
      ),

      'aroma',
      jsonb_build_object(
        'achieved',
        sum(case when a.aroma_status = 'STANDARD' then 1 else 0 end),
        'lost',
        10 - sum(case when a.aroma_status = 'STANDARD' then 1 else 0 end)
      ),

      'ingredients',
      jsonb_build_object(
        'achieved',
        sum(case when a.ingredients_status = 'STANDARD' then 1 else 0 end),
        'lost',
        10 - sum(case when a.ingredients_status = 'STANDARD' then 1 else 0 end)
      ),

      'portion',
      jsonb_build_object(
        'achieved',
        sum(case when a.portion_status = 'STANDARD' then 1 else 0 end),
        'lost',
        10 - sum(case when a.portion_status = 'STANDARD' then 1 else 0 end)
      ),

      'temperature',
      jsonb_build_object(
        'achieved',
        sum(case when a.temperature_status = 'STANDARD' then 1 else 0 end),
        'lost',
        10 - sum(case when a.temperature_status = 'STANDARD' then 1 else 0 end)
      ),

      'taste',
      jsonb_build_object(
        'achieved',
        sum(case when a.taste_status = 'STANDARD' then 1 else 0 end),
        'lost',
        10 - sum(case when a.taste_status = 'STANDARD' then 1 else 0 end)
      ),

      'texture',
      jsonb_build_object(
        'achieved',
        sum(case when a.texture_status = 'STANDARD' then 1 else 0 end),
        'lost',
        10 - sum(case when a.texture_status = 'STANDARD' then 1 else 0 end)
      )
    )

  into v_criterion_summary

  from public.qa_food_session_items i

  join public.qa_food_assessments a
    on a.item_id = i.id

  where i.session_id = p_session_id
    and i.state <> 'VOIDED';


  select upper(o.code)
    into v_outlet_code
  from public.outlets o
  where o.id = v_session.outlet_id;


  if v_outlet_code is null then
    raise exception
      'QA Food outlet could not be resolved.';
  end if;


  v_qa_number :=
    coalesce(
      v_session.qa_number,

      'QAF-' ||
      v_outlet_code ||
      '-' ||
      replace(
        v_session.business_date::text,
        '-',
        ''
      ) ||
      '-' ||
      upper(
        substr(
          replace(
            p_session_id::text,
            '-',
            ''
          ),
          1,
          6
        )
      )
    );


  v_result_status :=
    case
      when v_score = 100
        then 'PASS'
      else 'NEEDS_CORRECTION'
    end;


  v_snapshot :=
    jsonb_build_object(
      'scoring_version',
      1,

      'max_score',
      100,

      'score',
      v_score,

      'points_lost',
      v_points_lost,

      'menu_count',
      10,

      'standard_menu_count',
      v_standard_menu_count,

      'needs_correction_count',
      v_needs_correction_count,

      'on_time_count',
      v_on_time_count,

      'late_count',
      v_late_count,

      'menu_scores',
      v_menu_scores,

      'criterion_summary',
      v_criterion_summary
    );


  update public.qa_food_sessions
  set
    qa_number =
      v_qa_number,

    status =
      'FINALIZED',

    result_status =
      v_result_status,

    score =
      v_score,

    max_score =
      100,

    scoring_snapshot =
      v_snapshot,

    finalized_at =
      now(),

    finalized_by =
      p_actor_user_id

  where id =
    p_session_id;


  insert into public.qa_food_events (
    session_id,
    item_id,
    event_type,
    actor_user_id,
    payload
  )
  values (
    p_session_id,
    null,
    'SESSION_FINALIZED',
    p_actor_user_id,
    v_snapshot
  );


  return jsonb_build_object(
    'id',
    p_session_id,

    'qa_number',
    v_qa_number,

    'status',
    'FINALIZED',

    'result_status',
    v_result_status,

    'score',
    v_score,

    'max_score',
    100,

    'scoring_snapshot',
    v_snapshot,

    'finalized_at',
    now()
  );
end;
$$;


revoke all
on function public.finalize_qa_food_session_v1(uuid, uuid)
from public, anon, authenticated;


grant execute
on function public.finalize_qa_food_session_v1(uuid, uuid)
to service_role;


commit;
