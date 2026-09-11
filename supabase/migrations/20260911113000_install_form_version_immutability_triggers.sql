begin;

-- ============================================================
-- INSTALL FORM VERSION IMMUTABILITY TRIGGERS
--
-- Corrective forward migration. Function bodies are installed by
-- the preceding migration and are intentionally not redefined here.
-- ============================================================

drop trigger if exists form_versions_prevent_direct_update
on public.form_versions;

create trigger form_versions_prevent_direct_update
before update on public.form_versions
for each row
execute function public.prevent_form_version_update();

drop trigger if exists form_versions_prevent_non_draft_delete
on public.form_versions;

create trigger form_versions_prevent_non_draft_delete
before delete on public.form_versions
for each row
execute function public.prevent_published_form_version_delete();

drop trigger if exists form_version_sections_enforce_draft
on public.form_version_sections;

create trigger form_version_sections_enforce_draft
before insert or update or delete on public.form_version_sections
for each row
execute function public.enforce_form_version_content_draft();

drop trigger if exists form_version_section_translations_enforce_draft
on public.form_version_section_translations;

create trigger form_version_section_translations_enforce_draft
before insert or update or delete on public.form_version_section_translations
for each row
execute function public.enforce_form_version_content_draft();

drop trigger if exists question_groups_enforce_draft
on public.question_groups;

create trigger question_groups_enforce_draft
before insert or update or delete on public.question_groups
for each row
execute function public.enforce_form_version_content_draft();

drop trigger if exists question_group_translations_enforce_draft
on public.question_group_translations;

create trigger question_group_translations_enforce_draft
before insert or update or delete on public.question_group_translations
for each row
execute function public.enforce_form_version_content_draft();

drop trigger if exists questions_enforce_draft
on public.questions;

create trigger questions_enforce_draft
before insert or update or delete on public.questions
for each row
execute function public.enforce_form_version_content_draft();

drop trigger if exists question_translations_enforce_draft
on public.question_translations;

create trigger question_translations_enforce_draft
before insert or update or delete on public.question_translations
for each row
execute function public.enforce_form_version_content_draft();

drop trigger if exists question_rules_enforce_draft
on public.question_rules;

create trigger question_rules_enforce_draft
before insert or update or delete on public.question_rules
for each row
execute function public.enforce_form_version_content_draft();

drop trigger if exists question_options_enforce_draft
on public.question_options;

create trigger question_options_enforce_draft
before insert or update or delete on public.question_options
for each row
execute function public.enforce_form_version_content_draft();

drop trigger if exists question_option_translations_enforce_draft
on public.question_option_translations;

create trigger question_option_translations_enforce_draft
before insert or update or delete on public.question_option_translations
for each row
execute function public.enforce_form_version_content_draft();

commit;
