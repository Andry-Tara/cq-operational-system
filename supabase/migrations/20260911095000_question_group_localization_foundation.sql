begin;

-- ============================================================
-- QUESTION GROUP LOCALIZATION FOUNDATION
-- ============================================================

create table if not exists public.question_group_translations (
  id uuid primary key default gen_random_uuid(),
  question_group_id uuid not null
    references public.question_groups(id)
    on delete cascade,
  locale text not null,
  display_name text not null,
  description text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint question_group_translations_locale_chk
    check (locale in ('en', 'id-ID')),
  constraint question_group_translations_display_name_not_blank_chk
    check (btrim(display_name) <> ''),
  constraint question_group_translations_group_locale_key
    unique (question_group_id, locale)
);

create trigger question_group_translations_set_updated_at
before update on public.question_group_translations
for each row execute function public.set_updated_at();

alter table public.question_group_translations enable row level security;

create policy question_group_translations_select
on public.question_group_translations
for select to authenticated
using (
  exists (
    select 1
    from public.question_groups qg
    join public.form_version_sections fvs
      on fvs.id = qg.version_section_id
    where qg.id = question_group_translations.question_group_id
      and public.has_section_access_any_outlet(
        fvs.section_id,
        'view'
      )
  )
);

create policy question_group_translations_insert_admin
on public.question_group_translations
for insert to authenticated
with check (
  exists (
    select 1
    from public.question_groups qg
    join public.form_version_sections fvs
      on fvs.id = qg.version_section_id
    join public.form_versions fv
      on fv.id = fvs.form_version_id
    join public.forms f
      on f.id = fv.form_id
    where qg.id = question_group_translations.question_group_id
      and public.is_org_admin(f.organization_id)
  )
);

create policy question_group_translations_update_admin
on public.question_group_translations
for update to authenticated
using (
  exists (
    select 1
    from public.question_groups qg
    join public.form_version_sections fvs
      on fvs.id = qg.version_section_id
    join public.form_versions fv
      on fv.id = fvs.form_version_id
    join public.forms f
      on f.id = fv.form_id
    where qg.id = question_group_translations.question_group_id
      and public.is_org_admin(f.organization_id)
  )
)
with check (
  exists (
    select 1
    from public.question_groups qg
    join public.form_version_sections fvs
      on fvs.id = qg.version_section_id
    join public.form_versions fv
      on fv.id = fvs.form_version_id
    join public.forms f
      on f.id = fv.form_id
    where qg.id = question_group_translations.question_group_id
      and public.is_org_admin(f.organization_id)
  )
);

create policy question_group_translations_delete_admin
on public.question_group_translations
for delete to authenticated
using (
  exists (
    select 1
    from public.question_groups qg
    join public.form_version_sections fvs
      on fvs.id = qg.version_section_id
    join public.form_versions fv
      on fv.id = fvs.form_version_id
    join public.forms f
      on f.id = fv.form_id
    where qg.id = question_group_translations.question_group_id
      and public.is_org_admin(f.organization_id)
  )
);

grant select, insert, update, delete
on public.question_group_translations
to authenticated;

commit;
