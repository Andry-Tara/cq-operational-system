begin;

-- ============================================================
-- LOCALIZATION SCHEMA FOUNDATION
-- ============================================================

alter table public.outlets
  add column if not exists default_locale text not null default 'en';

alter table public.outlets
  drop constraint if exists outlets_default_locale_chk;

alter table public.outlets
  add constraint outlets_default_locale_chk
  check (default_locale in ('en', 'id-ID'));

alter table public.reports
  add column if not exists locale_snapshot text null;

alter table public.reports
  drop constraint if exists reports_locale_snapshot_chk;

alter table public.reports
  add constraint reports_locale_snapshot_chk
  check (
    locale_snapshot is null
    or locale_snapshot in ('en', 'id-ID')
  );

create table if not exists public.question_translations (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null
    references public.questions(id)
    on delete cascade,
  locale text not null,
  question_text text not null,
  help_text text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint question_translations_locale_chk
    check (locale in ('en', 'id-ID')),
  constraint question_translations_question_text_not_blank_chk
    check (btrim(question_text) <> ''),
  constraint question_translations_question_locale_key
    unique (question_id, locale)
);

create trigger question_translations_set_updated_at
before update on public.question_translations
for each row execute function public.set_updated_at();

create table if not exists public.form_version_section_translations (
  id uuid primary key default gen_random_uuid(),
  version_section_id uuid not null
    references public.form_version_sections(id)
    on delete cascade,
  locale text not null,
  display_name text not null,
  description text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint form_version_section_translations_locale_chk
    check (locale in ('en', 'id-ID')),
  constraint form_version_section_translations_display_name_not_blank_chk
    check (btrim(display_name) <> ''),
  constraint form_version_section_translations_section_locale_key
    unique (version_section_id, locale)
);

create trigger form_version_section_translations_set_updated_at
before update on public.form_version_section_translations
for each row execute function public.set_updated_at();

-- question_options already exists in production. Its canonical columns are:
-- value, label, sort_order, and is_failure. Preserve that contract.
alter table public.question_options
  add column if not exists updated_at timestamptz not null default now();

alter table public.question_options
  drop constraint if exists question_options_value_not_blank_chk;

alter table public.question_options
  add constraint question_options_value_not_blank_chk
  check (btrim(value) <> '');

alter table public.question_options
  drop constraint if exists question_options_label_not_blank_chk;

alter table public.question_options
  add constraint question_options_label_not_blank_chk
  check (btrim(label) <> '');

drop trigger if exists question_options_set_updated_at
on public.question_options;

create trigger question_options_set_updated_at
before update on public.question_options
for each row execute function public.set_updated_at();

create index if not exists question_options_question_sort_order_idx
  on public.question_options (question_id, sort_order, id);

create table if not exists public.question_option_translations (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null
    references public.question_options(id)
    on delete cascade,
  locale text not null,
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint question_option_translations_locale_chk
    check (locale in ('en', 'id-ID')),
  constraint question_option_translations_label_not_blank_chk
    check (btrim(label) <> ''),
  constraint question_option_translations_option_locale_key
    unique (option_id, locale)
);

create trigger question_option_translations_set_updated_at
before update on public.question_option_translations
for each row execute function public.set_updated_at();

drop policy if exists question_options_admin_all
on public.question_options;

drop policy if exists question_options_select
on public.question_options;

drop policy if exists question_options_insert_admin
on public.question_options;

drop policy if exists question_options_update_admin
on public.question_options;

drop policy if exists question_options_delete_admin
on public.question_options;

alter table public.question_translations enable row level security;
alter table public.form_version_section_translations enable row level security;
alter table public.question_options enable row level security;
alter table public.question_option_translations enable row level security;

create policy question_translations_select
on public.question_translations
for select to authenticated
using (
  exists (
    select 1
    from public.questions q
    join public.form_version_sections fvs
      on fvs.id = q.version_section_id
    where q.id = question_translations.question_id
      and public.has_section_access_any_outlet(fvs.section_id, 'view')
  )
);

create policy question_translations_insert_admin
on public.question_translations
for insert to authenticated
with check (
  exists (
    select 1
    from public.questions q
    join public.form_version_sections fvs
      on fvs.id = q.version_section_id
    join public.form_versions fv
      on fv.id = fvs.form_version_id
    join public.forms f
      on f.id = fv.form_id
    where q.id = question_translations.question_id
      and public.is_org_admin(f.organization_id)
  )
);

create policy question_translations_update_admin
on public.question_translations
for update to authenticated
using (
  exists (
    select 1
    from public.questions q
    join public.form_version_sections fvs
      on fvs.id = q.version_section_id
    join public.form_versions fv
      on fv.id = fvs.form_version_id
    join public.forms f
      on f.id = fv.form_id
    where q.id = question_translations.question_id
      and public.is_org_admin(f.organization_id)
  )
)
with check (
  exists (
    select 1
    from public.questions q
    join public.form_version_sections fvs
      on fvs.id = q.version_section_id
    join public.form_versions fv
      on fv.id = fvs.form_version_id
    join public.forms f
      on f.id = fv.form_id
    where q.id = question_translations.question_id
      and public.is_org_admin(f.organization_id)
  )
);

create policy question_translations_delete_admin
on public.question_translations
for delete to authenticated
using (
  exists (
    select 1
    from public.questions q
    join public.form_version_sections fvs
      on fvs.id = q.version_section_id
    join public.form_versions fv
      on fv.id = fvs.form_version_id
    join public.forms f
      on f.id = fv.form_id
    where q.id = question_translations.question_id
      and public.is_org_admin(f.organization_id)
  )
);

create policy form_version_section_translations_select
on public.form_version_section_translations
for select to authenticated
using (
  exists (
    select 1
    from public.form_version_sections fvs
    where fvs.id = form_version_section_translations.version_section_id
      and public.has_section_access_any_outlet(fvs.section_id, 'view')
  )
);

create policy form_version_section_translations_insert_admin
on public.form_version_section_translations
for insert to authenticated
with check (
  exists (
    select 1
    from public.form_version_sections fvs
    join public.form_versions fv
      on fv.id = fvs.form_version_id
    join public.forms f
      on f.id = fv.form_id
    where fvs.id = form_version_section_translations.version_section_id
      and public.is_org_admin(f.organization_id)
  )
);

create policy form_version_section_translations_update_admin
on public.form_version_section_translations
for update to authenticated
using (
  exists (
    select 1
    from public.form_version_sections fvs
    join public.form_versions fv
      on fv.id = fvs.form_version_id
    join public.forms f
      on f.id = fv.form_id
    where fvs.id = form_version_section_translations.version_section_id
      and public.is_org_admin(f.organization_id)
  )
)
with check (
  exists (
    select 1
    from public.form_version_sections fvs
    join public.form_versions fv
      on fv.id = fvs.form_version_id
    join public.forms f
      on f.id = fv.form_id
    where fvs.id = form_version_section_translations.version_section_id
      and public.is_org_admin(f.organization_id)
  )
);

create policy form_version_section_translations_delete_admin
on public.form_version_section_translations
for delete to authenticated
using (
  exists (
    select 1
    from public.form_version_sections fvs
    join public.form_versions fv
      on fv.id = fvs.form_version_id
    join public.forms f
      on f.id = fv.form_id
    where fvs.id = form_version_section_translations.version_section_id
      and public.is_org_admin(f.organization_id)
  )
);

create policy question_options_select
on public.question_options
for select to authenticated
using (
  exists (
    select 1
    from public.questions q
    join public.form_version_sections fvs
      on fvs.id = q.version_section_id
    where q.id = question_options.question_id
      and public.has_section_access_any_outlet(fvs.section_id, 'view')
  )
);

create policy question_options_insert_admin
on public.question_options
for insert to authenticated
with check (
  exists (
    select 1
    from public.questions q
    join public.form_version_sections fvs
      on fvs.id = q.version_section_id
    join public.form_versions fv
      on fv.id = fvs.form_version_id
    join public.forms f
      on f.id = fv.form_id
    where q.id = question_options.question_id
      and public.is_org_admin(f.organization_id)
  )
);

create policy question_options_update_admin
on public.question_options
for update to authenticated
using (
  exists (
    select 1
    from public.questions q
    join public.form_version_sections fvs
      on fvs.id = q.version_section_id
    join public.form_versions fv
      on fv.id = fvs.form_version_id
    join public.forms f
      on f.id = fv.form_id
    where q.id = question_options.question_id
      and public.is_org_admin(f.organization_id)
  )
)
with check (
  exists (
    select 1
    from public.questions q
    join public.form_version_sections fvs
      on fvs.id = q.version_section_id
    join public.form_versions fv
      on fv.id = fvs.form_version_id
    join public.forms f
      on f.id = fv.form_id
    where q.id = question_options.question_id
      and public.is_org_admin(f.organization_id)
  )
);

create policy question_options_delete_admin
on public.question_options
for delete to authenticated
using (
  exists (
    select 1
    from public.questions q
    join public.form_version_sections fvs
      on fvs.id = q.version_section_id
    join public.form_versions fv
      on fv.id = fvs.form_version_id
    join public.forms f
      on f.id = fv.form_id
    where q.id = question_options.question_id
      and public.is_org_admin(f.organization_id)
  )
);

create policy question_option_translations_select
on public.question_option_translations
for select to authenticated
using (
  exists (
    select 1
    from public.question_options qo
    join public.questions q
      on q.id = qo.question_id
    join public.form_version_sections fvs
      on fvs.id = q.version_section_id
    where qo.id = question_option_translations.option_id
      and public.has_section_access_any_outlet(fvs.section_id, 'view')
  )
);

create policy question_option_translations_insert_admin
on public.question_option_translations
for insert to authenticated
with check (
  exists (
    select 1
    from public.question_options qo
    join public.questions q
      on q.id = qo.question_id
    join public.form_version_sections fvs
      on fvs.id = q.version_section_id
    join public.form_versions fv
      on fv.id = fvs.form_version_id
    join public.forms f
      on f.id = fv.form_id
    where qo.id = question_option_translations.option_id
      and public.is_org_admin(f.organization_id)
  )
);

create policy question_option_translations_update_admin
on public.question_option_translations
for update to authenticated
using (
  exists (
    select 1
    from public.question_options qo
    join public.questions q
      on q.id = qo.question_id
    join public.form_version_sections fvs
      on fvs.id = q.version_section_id
    join public.form_versions fv
      on fv.id = fvs.form_version_id
    join public.forms f
      on f.id = fv.form_id
    where qo.id = question_option_translations.option_id
      and public.is_org_admin(f.organization_id)
  )
)
with check (
  exists (
    select 1
    from public.question_options qo
    join public.questions q
      on q.id = qo.question_id
    join public.form_version_sections fvs
      on fvs.id = q.version_section_id
    join public.form_versions fv
      on fv.id = fvs.form_version_id
    join public.forms f
      on f.id = fv.form_id
    where qo.id = question_option_translations.option_id
      and public.is_org_admin(f.organization_id)
  )
);

create policy question_option_translations_delete_admin
on public.question_option_translations
for delete to authenticated
using (
  exists (
    select 1
    from public.question_options qo
    join public.questions q
      on q.id = qo.question_id
    join public.form_version_sections fvs
      on fvs.id = q.version_section_id
    join public.form_versions fv
      on fv.id = fvs.form_version_id
    join public.forms f
      on f.id = fv.form_id
    where qo.id = question_option_translations.option_id
      and public.is_org_admin(f.organization_id)
  )
);

grant select, insert, update, delete
on public.question_translations,
   public.form_version_section_translations,
   public.question_options,
   public.question_option_translations
to authenticated;

commit;
