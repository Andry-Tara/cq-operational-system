begin;

-- ============================================================
-- QA FOOD STANDARD
-- Per-question notes + menu photo evidence metadata
-- ============================================================

alter table public.qa_food_assessments
  add column if not exists visual_note text;

alter table public.qa_food_assessments
  add column if not exists serving_method_note text;

alter table public.qa_food_assessments
  add column if not exists plating_note text;

alter table public.qa_food_assessments
  add column if not exists aroma_note text;

alter table public.qa_food_assessments
  add column if not exists ingredients_note text;

alter table public.qa_food_assessments
  add column if not exists portion_note text;

alter table public.qa_food_assessments
  add column if not exists temperature_note text;

alter table public.qa_food_assessments
  add column if not exists taste_note text;

alter table public.qa_food_assessments
  add column if not exists texture_note text;


alter table public.qa_food_evidence
  add column if not exists original_filename text;

alter table public.qa_food_evidence
  add column if not exists mime_type text;

alter table public.qa_food_evidence
  add column if not exists file_size bigint;

alter table public.qa_food_evidence
  add column if not exists sort_order integer
    not null
    default 10;


alter table public.qa_food_evidence
  drop constraint if exists
  qa_food_evidence_file_size_chk;

alter table public.qa_food_evidence
  add constraint
  qa_food_evidence_file_size_chk
  check (
    file_size is null
    or file_size >= 0
  );


alter table public.qa_food_evidence
  drop constraint if exists
  qa_food_evidence_sort_order_chk;

alter table public.qa_food_evidence
  add constraint
  qa_food_evidence_sort_order_chk
  check (
    sort_order >= 0
  );


create index if not exists
qa_food_evidence_item_sort_idx
on public.qa_food_evidence (
  item_id,
  sort_order,
  created_at
);


-- ============================================================
-- Every NOT_STANDARD answer requires its OWN reason / note.
--
-- Service time is automatic and does not require manual notes.
-- ============================================================

create or replace function
public.prepare_qa_food_assessment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_service_status text;
begin
  select
    i.service_status
  into
    v_service_status
  from public.qa_food_session_items i
  where i.id = new.item_id;

  if v_service_status is null then
    raise exception
      'Mark Served before completing the QA Food assessment.';
  end if;


  -- Visual
  if new.visual_status = 'NOT_STANDARD'
     and nullif(
       btrim(
         coalesce(
           new.visual_note,
           ''
         )
       ),
       ''
     ) is null then
    raise exception
      'Visual / Presentation reason is required.';
  end if;

  if new.visual_status = 'STANDARD' then
    new.visual_note := null;
  end if;


  -- Serving method
  if new.serving_method_status = 'NOT_STANDARD'
     and nullif(
       btrim(
         coalesce(
           new.serving_method_note,
           ''
         )
       ),
       ''
     ) is null then
    raise exception
      'Serving Method reason is required.';
  end if;

  if new.serving_method_status = 'STANDARD' then
    new.serving_method_note := null;
  end if;


  -- Plating
  if new.plating_status = 'NOT_STANDARD'
     and nullif(
       btrim(
         coalesce(
           new.plating_note,
           ''
         )
       ),
       ''
     ) is null then
    raise exception
      'Plating & Garnish reason is required.';
  end if;

  if new.plating_status = 'STANDARD' then
    new.plating_note := null;
  end if;


  -- Aroma
  if new.aroma_status = 'NOT_STANDARD'
     and nullif(
       btrim(
         coalesce(
           new.aroma_note,
           ''
         )
       ),
       ''
     ) is null then
    raise exception
      'Aroma reason is required.';
  end if;

  if new.aroma_status = 'STANDARD' then
    new.aroma_note := null;
  end if;


  -- Ingredients
  if new.ingredients_status = 'NOT_STANDARD'
     and nullif(
       btrim(
         coalesce(
           new.ingredients_note,
           ''
         )
       ),
       ''
     ) is null then
    raise exception
      'Ingredients reason is required.';
  end if;

  if new.ingredients_status = 'STANDARD' then
    new.ingredients_note := null;
  end if;


  -- Portion
  if new.portion_status = 'NOT_STANDARD'
     and nullif(
       btrim(
         coalesce(
           new.portion_note,
           ''
         )
       ),
       ''
     ) is null then
    raise exception
      'Portion reason is required.';
  end if;

  if new.portion_status = 'STANDARD' then
    new.portion_note := null;
  end if;


  -- Temperature
  if new.temperature_status = 'NOT_STANDARD'
     and nullif(
       btrim(
         coalesce(
           new.temperature_note,
           ''
         )
       ),
       ''
     ) is null then
    raise exception
      'Temperature reason is required.';
  end if;

  if new.temperature_status = 'STANDARD' then
    new.temperature_note := null;
  end if;


  -- Taste
  if new.taste_status = 'NOT_STANDARD'
     and nullif(
       btrim(
         coalesce(
           new.taste_note,
           ''
         )
       ),
       ''
     ) is null then
    raise exception
      'Taste reason is required.';
  end if;

  if new.taste_status = 'STANDARD' then
    new.taste_note := null;
  end if;


  -- Texture
  if new.texture_status = 'NOT_STANDARD'
     and nullif(
       btrim(
         coalesce(
           new.texture_note,
           ''
         )
       ),
       ''
     ) is null then
    raise exception
      'Texture reason is required.';
  end if;

  if new.texture_status = 'STANDARD' then
    new.texture_note := null;
  end if;


  -- Old global notes are intentionally no longer used.
  new.notes := null;


  new.result_status :=
    case
      when v_service_status = 'LATE'
        or new.visual_status = 'NOT_STANDARD'
        or new.serving_method_status = 'NOT_STANDARD'
        or new.plating_status = 'NOT_STANDARD'
        or new.aroma_status = 'NOT_STANDARD'
        or new.ingredients_status = 'NOT_STANDARD'
        or new.portion_status = 'NOT_STANDARD'
        or new.temperature_status = 'NOT_STANDARD'
        or new.taste_status = 'NOT_STANDARD'
        or new.texture_status = 'NOT_STANDARD'
      then 'NEEDS_CORRECTION'
      else 'PASS'
    end;

  return new;
end;
$$;


revoke all
on function public.prepare_qa_food_assessment()
from public, anon, authenticated;


commit;
