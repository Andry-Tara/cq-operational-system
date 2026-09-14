"use client";

import {
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { useRouter } from "next/navigation";

export type Translation = {
  locale: string;
  display_name?: string;
  description?: string | null;
  question_text?: string;
  help_text?: string | null;
  label?: string;
};

export type Option = {
  id: string;
  value: string;
  label: string;
  sort_order: number;
  is_failure: boolean;
  translations: Translation[];
};

export type Question = {
  id: string;
  version_section_id: string;
  question_group_id: string | null;
  code: string;
  question_text: string;
  help_text: string | null;
  question_type: string;
  is_required: boolean;
  unit: string | null;
  min_value: number | null;
  max_value: number | null;
  placeholder: string | null;
  sort_order: number;
  is_active: boolean;
  translations: Translation[];
  options: Option[];
};

export type Group = {
  id: string;
  version_section_id: string;
  code: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  translations: Translation[];
  questions: Question[];
};

export type Section = {
  id: string;
  section_id: string;
  display_name: string;
  description: string | null;
  sort_order: number;
  is_required: boolean;
  is_active: boolean;
  translations: Translation[];
  groups: Group[];
  questions: Question[];
};

export type BuilderData = {
  version: {
    id: string;
    version_number: number;
    status: string;
    notes: string | null;
  };
  form: {
    id: string;
    code: string;
    name: string;
  };
  sections: Section[];
};

type SaveResult = {
  saving: boolean;
  message: string;
  error: string;
};

const initialSave: SaveResult = {
  saving: false,
  message: "",
  error: "",
};

const primaryButtonClass =
  "inline-flex min-h-10 items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500/30 disabled:cursor-not-allowed disabled:opacity-60";

const secondaryButtonClass =
  "inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400/20 disabled:cursor-not-allowed disabled:opacity-60";

function useSave(url: string) {
  const router = useRouter();
  const [state, setState] = useState(initialSave);

  async function save(body: Record<string, unknown>) {
    if (state.saving) return;

    setState({ saving: true, message: "", error: "" });

    try {
      const response = await fetch(url, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "Unable to save.");
      }

      setState({ saving: false, message: "Saved", error: "" });
      router.refresh();
    } catch (error) {
      setState({
        saving: false,
        message: "",
        error: error instanceof Error ? error.message : "Unable to save.",
      });
    }
  }

  return {
    state,
    save,
    restore: () => setState(initialSave),
  };
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
      <span>
        {label}
        {required ? <span className="ml-1 text-red-600">*</span> : null}
      </span>
      {children}
      {hint ? <span className="text-xs font-normal text-slate-400">{hint}</span> : null}
    </label>
  );
}

function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-red-300 focus:ring-4 focus:ring-red-50 ${props.className ?? ""}`}
    />
  );
}

function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-24 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-red-300 focus:ring-4 focus:ring-red-50 ${props.className ?? ""}`}
    />
  );
}

function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 shadow-sm outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-50 ${props.className ?? ""}`}
    />
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <span className="relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span className="absolute inset-0 rounded-full bg-slate-200 transition peer-checked:bg-red-600" />
        <span className="absolute left-1 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
      <span>
        <span className="block text-sm font-semibold text-slate-800">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-5 text-slate-400">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

function SaveBar({
  state,
  onSave,
  onRestore,
  label = "Save changes",
}: {
  state: SaveResult;
  onSave: () => void;
  onRestore: () => void;
  label?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        className={primaryButtonClass}
        onClick={onSave}
        disabled={state.saving}
      >
        {state.saving ? "Saving..." : label}
      </button>

      {state.message ? (
        <span className="text-sm font-medium text-emerald-600">{state.message}</span>
      ) : null}

      {state.error ? (
        <>
          <span className="text-sm font-medium text-red-600">{state.error}</span>
          <button
            type="button"
            className="text-sm font-semibold text-slate-600 underline underline-offset-4"
            onClick={onRestore}
          >
            Reset status
          </button>
        </>
      ) : null}
    </div>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
        active
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
          : "bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function questionTypeLabel(type: string) {
  switch (type) {
    case "yes_no":
      return "Yes / No";
    case "temperature":
      return "Temperature";
    default:
      return type.replaceAll("_", " ");
  }
}

function QuestionTypePill({ type }: { type: string }) {
  const temperature = type === "temperature";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
        temperature
          ? "bg-sky-50 text-sky-700 ring-sky-200"
          : "bg-indigo-50 text-indigo-700 ring-indigo-200"
      }`}
    >
      {questionTypeLabel(type)}
    </span>
  );
}

function TranslationEditor({
  versionId,
  resourceType,
  resourceId,
  translations,
}: {
  versionId: string;
  resourceType: "section" | "group" | "question" | "option";
  resourceId: string;
  translations: Translation[];
}) {
  const [locale, setLocale] = useState<"en" | "id-ID">("en");
  const current = translations.find((item) => item.locale === locale);
  const [values, setValues] = useState<Translation>(current ?? { locale });
  const save = useSave(`/api/admin/form-versions/${versionId}/translations`);

  const set = (key: string, value: string) =>
    setValues((old) => ({ ...old, [key]: value }));

  const payload =
    resourceType === "question"
      ? {
          questionText: values.question_text ?? "",
          helpText: values.help_text ?? null,
        }
      : resourceType === "option"
        ? { label: values.label ?? "" }
        : {
            displayName: values.display_name ?? "",
            description: values.description ?? null,
          };

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
      <div className="mb-4 inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {(
          [
            ["en", "EN · English"],
            ["id-ID", "ID · Bahasa Indonesia"],
          ] as const
        ).map(([value, label]) => (
          <button
            type="button"
            key={value}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              locale === value
                ? "bg-red-50 text-red-700"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            }`}
            onClick={() => {
              setLocale(value);
              setValues(
                translations.find((item) => item.locale === value) ?? {
                  locale: value,
                },
              );
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {resourceType === "option" ? (
        <Field label="Localized label">
          <Input
            value={values.label ?? ""}
            onChange={(event) => set("label", event.target.value)}
          />
        </Field>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label={resourceType === "question" ? "Question text" : "Display name"}>
            <Input
              value={
                resourceType === "question"
                  ? values.question_text ?? ""
                  : values.display_name ?? ""
              }
              onChange={(event) =>
                set(
                  resourceType === "question" ? "question_text" : "display_name",
                  event.target.value,
                )
              }
            />
          </Field>

          <Field label={resourceType === "question" ? "Help text" : "Description"}>
            <Textarea
              value={
                resourceType === "question"
                  ? values.help_text ?? ""
                  : values.description ?? ""
              }
              onChange={(event) =>
                set(
                  resourceType === "question" ? "help_text" : "description",
                  event.target.value,
                )
              }
            />
          </Field>
        </div>
      )}

      <div className="mt-4">
        <SaveBar
          state={save.state}
          onSave={() =>
            save.save({
              resourceType,
              resourceId,
              locale,
              ...payload,
            })
          }
          onRestore={save.restore}
          label="Save translation"
        />
      </div>
    </div>
  );
}

type NewSectionValues = {
  code: string;
  displayName: string;
  description: string;
  areaCode: "" | "STORE" | "PRODUCTION";
  isRequired: boolean;
  isActive: boolean;
};

function createEmptySection(): NewSectionValues {
  return {
    code: "",
    displayName: "",
    description: "",
    areaCode: "",
    isRequired: true,
    isActive: true,
  };
}

function AddSectionEditor({ versionId }: { versionId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<NewSectionValues>(createEmptySection());
  const [state, setState] = useState<SaveResult>(initialSave);

  const update = (
    key: keyof NewSectionValues,
    value: string | boolean,
  ) => {
    setValues((old) => ({ ...old, [key]: value }));
    if (state.error || state.message) setState(initialSave);
  };

  async function addSection() {
    if (state.saving) return;

    if (!values.code.trim() || !values.displayName.trim()) {
      setState({
        saving: false,
        message: "",
        error: "Section code and display name are required.",
      });
      return;
    }

    setState({ saving: true, message: "", error: "" });

    try {
      const response = await fetch(
        `/api/admin/form-versions/${versionId}/sections`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            code: values.code.trim().toUpperCase(),
            displayName: values.displayName.trim(),
            description: values.description.trim() || null,
            areaCode: values.areaCode || null,
            isRequired: values.isRequired,
            isActive: values.isActive,
          }),
        },
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "Unable to add section.");
      }

      setValues(createEmptySection());
      setState(initialSave);
      setOpen(false);
      router.refresh();
    } catch (error) {
      setState({
        saving: false,
        message: "",
        error: error instanceof Error ? error.message : "Unable to add section.",
      });
    }
  }

  if (!open) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          className={primaryButtonClass}
          onClick={() => {
            setOpen(true);
            setState(initialSave);
          }}
        >
          + Add Section
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-red-100 bg-gradient-to-b from-red-50/70 to-white p-5 shadow-sm md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-600">
            New section
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">
            Add a section to this draft
          </h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            The section is created as a canonical form section and attached to this
            draft version automatically.
          </p>
        </div>

        <button
          type="button"
          className={secondaryButtonClass}
          disabled={state.saving}
          onClick={() => {
            setOpen(false);
            setValues(createEmptySection());
            setState(initialSave);
          }}
        >
          Cancel
        </button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Field
          label="Section code"
          required
          hint="Stable internal identifier, for example DINING_ROOM."
        >
          <Input
            placeholder="DINING_ROOM"
            value={values.code}
            onChange={(event) => update("code", event.target.value.toUpperCase())}
          />
        </Field>

        <Field label="Display name" required>
          <Input
            placeholder="Dining Room"
            value={values.displayName}
            onChange={(event) => update("displayName", event.target.value)}
          />
        </Field>

        <Field label="Description">
          <Textarea
            placeholder="Describe what this section covers..."
            value={values.description}
            onChange={(event) => update("description", event.target.value)}
          />
        </Field>

        <Field
          label="Operational area"
          hint="Optional. For Central Kitchen, assign Warehouse or Production when relevant."
        >
          <Select
            value={values.areaCode}
            onChange={(event) =>
              update(
                "areaCode",
                event.target.value as "" | "STORE" | "PRODUCTION",
              )
            }
          >
            <option value="">Not assigned</option>
            <option value="STORE">Warehouse</option>
            <option value="PRODUCTION">Production</option>
          </Select>
        </Field>
      </div>

      <div className="mt-5 flex flex-wrap gap-x-8 gap-y-4 rounded-2xl border border-slate-100 bg-white p-4">
        <Toggle
          checked={values.isRequired}
          onChange={(checked) => update("isRequired", checked)}
          label="Required"
          description="Questions in this section should be completed."
        />

        <Toggle
          checked={values.isActive}
          onChange={(checked) => update("isActive", checked)}
          label="Active"
          description="Section is available in the operational form."
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={primaryButtonClass}
          disabled={state.saving}
          onClick={addSection}
        >
          {state.saving ? "Adding..." : "Add Section"}
        </button>

        {state.error ? (
          <span className="text-sm font-medium text-red-600">{state.error}</span>
        ) : null}
      </div>
    </div>
  );
}

type NewQuestionValues = {
  code: string;
  questionText: string;
  questionType: "yes_no" | "temperature";
  questionGroupId: string;
  isRequired: boolean;
  helpText: string;
  unit: string;
  minValue: string;
  maxValue: string;
};

function createEmptyQuestion(): NewQuestionValues {
  return {
    code: "",
    questionText: "",
    questionType: "yes_no",
    questionGroupId: "",
    isRequired: false,
    helpText: "",
    unit: "",
    minValue: "",
    maxValue: "",
  };
}

function AddQuestionEditor({
  versionId,
  section,
}: {
  versionId: string;
  section: Section;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<NewQuestionValues>(createEmptyQuestion());
  const [state, setState] = useState<SaveResult>(initialSave);

  const update = (
    key: keyof NewQuestionValues,
    value: string | boolean,
  ) => {
    setValues((old) => ({ ...old, [key]: value }));
    if (state.error || state.message) setState(initialSave);
  };

  async function addQuestion() {
    if (state.saving) return;

    if (!values.code.trim() || !values.questionText.trim()) {
      setState({
        saving: false,
        message: "",
        error: "Question code and question text are required.",
      });
      return;
    }

    const minValue =
      values.questionType === "temperature" && values.minValue !== ""
        ? Number(values.minValue)
        : null;
    const maxValue =
      values.questionType === "temperature" && values.maxValue !== ""
        ? Number(values.maxValue)
        : null;

    if (minValue !== null && maxValue !== null && minValue > maxValue) {
      setState({
        saving: false,
        message: "",
        error: "Minimum value cannot be greater than maximum value.",
      });
      return;
    }

    setState({ saving: true, message: "", error: "" });

    try {
      const response = await fetch(
        `/api/admin/form-versions/${versionId}/sections/${section.id}/questions`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            code: values.code.trim(),
            questionText: values.questionText.trim(),
            questionType: values.questionType,
            isRequired: values.isRequired,
            questionGroupId: values.questionGroupId || null,
            helpText: values.helpText.trim() || null,
            unit:
              values.questionType === "temperature"
                ? values.unit.trim() || null
                : null,
            minValue,
            maxValue,
          }),
        },
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "Unable to add question.");
      }

      setState({ saving: false, message: "Question added.", error: "" });
      setValues(createEmptyQuestion());
      router.refresh();
    } catch (error) {
      setState({
        saving: false,
        message: "",
        error:
          error instanceof Error ? error.message : "Unable to add question.",
      });
    }
  }

  if (!open) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          className={primaryButtonClass}
          onClick={() => {
            setOpen(true);
            setState(initialSave);
          }}
        >
          + Add Question
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-red-100 bg-gradient-to-b from-red-50/60 to-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-600">
            New question
          </p>
          <h4 className="mt-1 text-base font-semibold text-slate-950">
            Add question to {section.display_name}
          </h4>
          <p className="mt-1 text-sm text-slate-500">
            Choose the answer type and fill only the fields that are relevant.
          </p>
        </div>

        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() => {
            setOpen(false);
            setValues(createEmptyQuestion());
            setState(initialSave);
          }}
        >
          Cancel
        </button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Field label="Question code" required>
          <Input
            placeholder="CLS_EXT_002"
            value={values.code}
            onChange={(event) => update("code", event.target.value)}
          />
        </Field>

        <Field label="Question type" required>
          <Select
            value={values.questionType}
            onChange={(event) =>
              update(
                "questionType",
                event.target.value as "yes_no" | "temperature",
              )
            }
          >
            <option value="yes_no">Yes / No</option>
            <option value="temperature">Temperature</option>
          </Select>
        </Field>

        {section.groups.length > 0 ? (
          <Field label="Question group">
            <Select
              value={values.questionGroupId}
              onChange={(event) =>
                update("questionGroupId", event.target.value)
              }
            >
              <option value="">No group / Section level</option>
              {section.groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <div className="flex items-end rounded-xl border border-slate-100 bg-white px-4 py-3">
          <Toggle
            checked={values.isRequired}
            onChange={(checked) => update("isRequired", checked)}
            label="Required"
            description="User must answer this question before submitting."
          />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Field label="Question text" required>
          <Textarea
            placeholder="Enter the question shown to users..."
            value={values.questionText}
            onChange={(event) => update("questionText", event.target.value)}
          />
        </Field>

        <Field label="Help text">
          <Textarea
            placeholder="Optional instruction or guidance"
            value={values.helpText}
            onChange={(event) => update("helpText", event.target.value)}
          />
        </Field>
      </div>

      {values.questionType === "temperature" ? (
        <div className="mt-4 grid gap-4 rounded-2xl border border-sky-100 bg-sky-50/60 p-4 md:grid-cols-3">
          <Field label="Unit">
            <Input
              placeholder="°C"
              value={values.unit}
              onChange={(event) => update("unit", event.target.value)}
            />
          </Field>

          <Field label="Minimum">
            <Input
              type="number"
              step="any"
              placeholder="15"
              value={values.minValue}
              onChange={(event) => update("minValue", event.target.value)}
            />
          </Field>

          <Field label="Maximum">
            <Input
              type="number"
              step="any"
              placeholder="35"
              value={values.maxValue}
              onChange={(event) => update("maxValue", event.target.value)}
            />
          </Field>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={primaryButtonClass}
          disabled={state.saving}
          onClick={addQuestion}
        >
          {state.saving ? "Adding..." : "Add Question"}
        </button>

        {state.message ? (
          <span className="text-sm font-medium text-emerald-600">
            {state.message}
          </span>
        ) : null}

        {state.error ? (
          <span className="text-sm font-medium text-red-600">{state.error}</span>
        ) : null}
      </div>
    </div>
  );
}

function SectionEditor({
  versionId,
  section,
  sectionNumber,
}: {
  versionId: string;
  section: Section;
  sectionNumber: number;
}) {
  const save = useSave(
    `/api/admin/form-versions/${versionId}/sections/${section.id}`,
  );
  const [values, setValues] = useState(section);
  const [open, setOpen] = useState(true);
  const [translationOpen, setTranslationOpen] = useState(false);

  const update = (key: keyof Section, value: unknown) =>
    setValues((old) => ({ ...old, [key]: value }));

  const questionCount =
    section.questions.length +
    section.groups.reduce((total, group) => total + group.questions.length, 0);

  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 md:px-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex rounded-lg bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700 ring-1 ring-inset ring-red-100">
              Section {String(sectionNumber).padStart(2, "0")}
            </span>
            <StatusPill active={values.is_active} />
            <span className="text-xs font-medium text-slate-400">
              {questionCount} question{questionCount === 1 ? "" : "s"}
            </span>
          </div>

          <h3 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">
            {values.display_name || `Section ${sectionNumber}`}
          </h3>

          {values.description ? (
            <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-500">
              {values.description}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          aria-expanded={open}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg font-semibold text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-800"
          onClick={() => setOpen((value) => !value)}
          title={open ? "Collapse section" : "Expand section"}
        >
          {open ? "⌃" : "⌄"}
        </button>
      </div>

      {open ? (
        <div className="space-y-6 p-5 md:p-6">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 md:p-5">
            <div className="mb-4">
              <p className="text-sm font-semibold text-slate-900">Section settings</p>
              <p className="mt-1 text-xs text-slate-500">
                Edit the base section content, ordering, and visibility.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_1.6fr_160px]">
              <Field label="Display name" required>
                <Input
                  value={values.display_name}
                  onChange={(event) =>
                    update("display_name", event.target.value)
                  }
                />
              </Field>

              <Field label="Description">
                <Textarea
                  className="min-h-10"
                  value={values.description ?? ""}
                  onChange={(event) =>
                    update("description", event.target.value || null)
                  }
                />
              </Field>

              <Field label="Sort order">
                <Input
                  type="number"
                  min={0}
                  value={values.sort_order}
                  onChange={(event) =>
                    update("sort_order", Number(event.target.value))
                  }
                />
              </Field>
            </div>

            <div className="mt-5 flex flex-wrap gap-x-8 gap-y-4 border-t border-slate-200 pt-5">
              <Toggle
                checked={values.is_required}
                onChange={(checked) => update("is_required", checked)}
                label="Required"
                description="Questions in this section should be completed."
              />

              <Toggle
                checked={values.is_active}
                onChange={(checked) => update("is_active", checked)}
                label="Active"
                description="This section is visible in the operational form."
              />
            </div>

            <div className="mt-5">
              <SaveBar
                state={save.state}
                onSave={() =>
                  save.save({
                    displayName: values.display_name,
                    description: values.description,
                    sortOrder: values.sort_order,
                    isRequired: values.is_required,
                    isActive: values.is_active,
                  })
                }
                onRestore={save.restore}
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition hover:bg-slate-50"
              aria-expanded={translationOpen}
              onClick={() => setTranslationOpen((value) => !value)}
            >
              <span>
                <span className="block text-sm font-semibold text-slate-900">
                  Localized content
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  English and Indonesian section labels · EN · ID
                </span>
              </span>
              <span className="text-lg font-semibold text-slate-400">
                {translationOpen ? "⌃" : "⌄"}
              </span>
            </button>

            {translationOpen ? (
              <div className="border-t border-slate-100 p-4">
                <TranslationEditor
                  versionId={versionId}
                  resourceType="section"
                  resourceId={section.id}
                  translations={section.translations}
                />
              </div>
            ) : null}
          </div>

          <div className="border-t border-slate-100 pt-6">
            <div className="mb-4">
              <h4 className="text-base font-semibold text-slate-950">
                Questions ({questionCount})
              </h4>
              <p className="mt-1 text-sm text-slate-500">
                Expand a question only when you need to edit it.
              </p>
            </div>

            <div className="mb-4">
              <AddQuestionEditor versionId={versionId} section={section} />
            </div>

            <div className="grid gap-3">
              {section.groups.map((group) => (
                <GroupEditor
                  key={group.id}
                  versionId={versionId}
                  group={group}
                />
              ))}

              {section.questions
                .filter((question) => !question.question_group_id)
                .map((question, index) => (
                  <QuestionEditor
                    key={question.id}
                    versionId={versionId}
                    question={question}
                    index={index}
                  />
                ))}

              {questionCount === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-8 text-center">
                  <p className="text-sm font-semibold text-slate-700">
                    No questions in this section yet.
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    Use “Add Question” to create the first question.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function GroupEditor({
  versionId,
  group,
}: {
  versionId: string;
  group: Group;
}) {
  const save = useSave(`/api/admin/form-versions/${versionId}/groups/${group.id}`);
  const [values, setValues] = useState(group);
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/40">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
              Group · {group.code}
            </span>
            <StatusPill active={values.is_active} />
            <span className="text-xs font-medium text-slate-400">
              {group.questions.length} question{group.questions.length === 1 ? "" : "s"}
            </span>
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-900">{values.name}</p>
        </div>

        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "⌃" : "⌄"}
        </button>
      </div>

      {open ? (
        <div className="space-y-4 border-t border-slate-200 bg-white p-4">
          <div className="grid gap-4 md:grid-cols-[1fr_160px_auto]">
            <Field label="Name">
              <Input
                value={values.name}
                onChange={(event) =>
                  setValues({ ...values, name: event.target.value })
                }
              />
            </Field>

            <Field label="Sort order">
              <Input
                type="number"
                min={0}
                value={values.sort_order}
                onChange={(event) =>
                  setValues({
                    ...values,
                    sort_order: Number(event.target.value),
                  })
                }
              />
            </Field>

            <div className="flex items-end pb-1">
              <Toggle
                checked={values.is_active}
                onChange={(checked) =>
                  setValues({ ...values, is_active: checked })
                }
                label="Active"
              />
            </div>
          </div>

          <SaveBar
            state={save.state}
            onSave={() =>
              save.save({
                name: values.name,
                sortOrder: values.sort_order,
                isActive: values.is_active,
              })
            }
            onRestore={save.restore}
          />

          <TranslationEditor
            versionId={versionId}
            resourceType="group"
            resourceId={group.id}
            translations={group.translations}
          />

          <div className="grid gap-3 border-t border-slate-100 pt-4">
            {group.questions.map((question, index) => (
              <QuestionEditor
                key={question.id}
                versionId={versionId}
                question={question}
                index={index}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function QuestionEditor({
  versionId,
  question,
  index,
}: {
  versionId: string;
  question: Question;
  index?: number;
}) {
  const save = useSave(
    `/api/admin/form-versions/${versionId}/questions/${question.id}`,
  );
  const router = useRouter();
  const [values, setValues] = useState(question);
  const [open, setOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [duplicating, setDuplicating] = useState(false);
  const [duplicateMessage, setDuplicateMessage] = useState("");
  const [duplicateError, setDuplicateError] = useState("");
  const [moving, setMoving] = useState<"up" | "down" | null>(null);
  const [moveMessage, setMoveMessage] = useState("");
  const [moveError, setMoveError] = useState("");

  const update = (key: keyof Question, value: unknown) =>
    setValues((old) => ({ ...old, [key]: value }));

  const isTemperature = values.question_type === "temperature";

  async function moveQuestion(direction: "up" | "down") {
    if (moving) return;

    setMoving(direction);
    setMoveMessage("");
    setMoveError("");

    try {
      const response = await fetch(
        `/api/admin/form-versions/${versionId}/questions/${question.id}/move`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ direction }),
        },
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "Unable to move question.");
      }

      setMoveMessage(
        direction === "up"
          ? "Question moved up."
          : "Question moved down.",
      );
      router.refresh();
    } catch (error) {
      setMoveError(
        error instanceof Error
          ? error.message
          : "Unable to move question.",
      );
    } finally {
      setMoving(null);
    }
  }

  async function duplicateQuestion() {
    if (duplicating) return;

    setDuplicating(true);
    setDuplicateMessage("");
    setDuplicateError("");

    try {
      const response = await fetch(
        `/api/admin/form-versions/${versionId}/questions/${question.id}/duplicate`,
        { method: "POST" },
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "Unable to duplicate question.");
      }

      setDuplicateMessage("Question duplicated.");
      router.refresh();
    } catch (error) {
      setDuplicateError(
        error instanceof Error
          ? error.message
          : "Unable to duplicate question.",
      );
    } finally {
      setDuplicating(false);
    }
  }

  async function deleteQuestion() {
    if (deleting) return;

    setDeleting(true);
    setDeleteError("");

    try {
      const response = await fetch(
        `/api/admin/form-versions/${versionId}/questions/${question.id}/delete`,
        { method: "DELETE" },
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "Unable to delete question.");
      }

      setDeleteOpen(false);
      router.refresh();
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : "Unable to delete question.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-4 text-left"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        {typeof index === "number" ? (
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">
            {index + 1}
          </span>
        ) : null}

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-slate-950">
              {values.question_text || values.code}
            </span>
            <QuestionTypePill type={values.question_type} />
            {values.is_required ? (
              <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                Required
              </span>
            ) : null}
          </span>

          <span className="mt-1 block text-xs font-medium text-slate-400">
            {values.code} · Sort {values.sort_order}
          </span>
        </span>

        <StatusPill active={values.is_active} />
        <span className="ml-1 text-lg font-semibold text-slate-400">
          {open ? "⌃" : "⌄"}
        </span>
      </button>

      {open ? (
        <div className="space-y-5 border-t border-slate-100 bg-slate-50/30 p-4 md:p-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Question text" required>
              <Textarea
                value={values.question_text}
                onChange={(event) =>
                  update("question_text", event.target.value)
                }
              />
            </Field>

            <Field label="Help text">
              <Textarea
                value={values.help_text ?? ""}
                onChange={(event) =>
                  update("help_text", event.target.value || null)
                }
              />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-[1fr_180px]">
            <Field label="Placeholder">
              <Input
                value={values.placeholder ?? ""}
                onChange={(event) =>
                  update("placeholder", event.target.value || null)
                }
              />
            </Field>

            <Field label="Sort order">
              <Input
                type="number"
                min={0}
                value={values.sort_order}
                onChange={(event) =>
                  update("sort_order", Number(event.target.value))
                }
              />
            </Field>
          </div>

          {isTemperature ? (
            <div className="grid gap-4 rounded-2xl border border-sky-100 bg-sky-50/70 p-4 md:grid-cols-3">
              <Field label="Unit" hint="Example: °C">
                <Input
                  value={values.unit ?? ""}
                  onChange={(event) =>
                    update("unit", event.target.value || null)
                  }
                />
              </Field>

              <Field label="Minimum">
                <Input
                  type="number"
                  step="any"
                  value={values.min_value ?? ""}
                  onChange={(event) =>
                    update(
                      "min_value",
                      event.target.value === ""
                        ? null
                        : Number(event.target.value),
                    )
                  }
                />
              </Field>

              <Field label="Maximum">
                <Input
                  type="number"
                  step="any"
                  value={values.max_value ?? ""}
                  onChange={(event) =>
                    update(
                      "max_value",
                      event.target.value === ""
                        ? null
                        : Number(event.target.value),
                    )
                  }
                />
              </Field>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-x-8 gap-y-4 rounded-2xl border border-slate-100 bg-white p-4">
            <Toggle
              checked={values.is_required}
              onChange={(checked) => update("is_required", checked)}
              label="Required"
              description="Answer is mandatory before submit."
            />

            <Toggle
              checked={values.is_active}
              onChange={(checked) => update("is_active", checked)}
              label="Active"
              description="Question is visible to operational users."
            />
          </div>

          <SaveBar
            state={save.state}
            onSave={() =>
              save.save({
                questionText: values.question_text,
                helpText: values.help_text,
                isRequired: values.is_required,
                unit: isTemperature ? values.unit : null,
                minValue: isTemperature ? values.min_value : null,
                maxValue: isTemperature ? values.max_value : null,
                placeholder: values.placeholder,
                sortOrder: values.sort_order,
                isActive: values.is_active,
              })
            }
            onRestore={save.restore}
          />

          <div className="border-t border-slate-100 pt-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
              Localized question content
            </p>
            <TranslationEditor
              versionId={versionId}
              resourceType="question"
              resourceId={question.id}
              translations={question.translations}
            />
          </div>

          {question.options.length > 0 ? (
            <div className="grid gap-2 border-t border-slate-100 pt-5">
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                Options
              </p>
              {question.options.map((option) => (
                <OptionEditor
                  key={option.id}
                  versionId={versionId}
                  option={option}
                />
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Question order
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Move this question within the same section and question group.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={moving !== null}
                onClick={() => moveQuestion("up")}
              >
                {moving === "up" ? "Moving..." : "↑ Move up"}
              </button>

              <button
                type="button"
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={moving !== null}
                onClick={() => moveQuestion("down")}
              >
                {moving === "down" ? "Moving..." : "↓ Move down"}
              </button>

              {moveMessage ? (
                <span className="text-sm font-medium text-emerald-600">
                  {moveMessage}
                </span>
              ) : null}

              {moveError ? (
                <span className="text-sm font-medium text-red-600">
                  {moveError}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Duplicate question
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Create a full copy in the same section and question group.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={duplicating}
                onClick={duplicateQuestion}
              >
                {duplicating ? "Duplicating..." : "Duplicate question"}
              </button>

              {duplicateMessage ? (
                <span className="text-sm font-medium text-emerald-600">
                  {duplicateMessage}
                </span>
              ) : null}

              {duplicateError ? (
                <span className="text-sm font-medium text-red-600">
                  {duplicateError}
                </span>
              ) : null}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-5">
            {!deleteOpen ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Delete question
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Permanently remove this question from the current draft.
                  </p>
                </div>

                <button
                  type="button"
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                  onClick={() => {
                    setDeleteOpen(true);
                    setDeleteError("");
                  }}
                >
                  Delete question
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-red-200 bg-red-50/70 p-4">
                <p className="text-sm font-semibold text-red-900">
                  Delete this question?
                </p>
                <p className="mt-1 text-sm leading-6 text-red-700">
                  “{values.question_text || values.code}” will be permanently removed
                  from this draft version.
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="inline-flex min-h-10 items-center justify-center rounded-xl bg-red-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={deleting}
                    onClick={deleteQuestion}
                  >
                    {deleting ? "Deleting..." : "Delete Question"}
                  </button>

                  <button
                    type="button"
                    className={secondaryButtonClass}
                    disabled={deleting}
                    onClick={() => {
                      setDeleteOpen(false);
                      setDeleteError("");
                    }}
                  >
                    Cancel
                  </button>

                  {deleteError ? (
                    <span className="text-sm font-medium text-red-700">
                      {deleteError}
                    </span>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function OptionEditor({
  versionId,
  option,
}: {
  versionId: string;
  option: Option;
}) {
  const save = useSave(
    `/api/admin/form-versions/${versionId}/options/${option.id}`,
  );
  const [values, setValues] = useState(option);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
          Option · {option.value}
        </p>
        {values.is_failure ? (
          <span className="rounded-full bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700">
            Failure option
          </span>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_160px_auto]">
        <Field label="Label">
          <Input
            value={values.label}
            onChange={(event) =>
              setValues({ ...values, label: event.target.value })
            }
          />
        </Field>

        <Field label="Sort order">
          <Input
            type="number"
            min={0}
            value={values.sort_order}
            onChange={(event) =>
              setValues({
                ...values,
                sort_order: Number(event.target.value),
              })
            }
          />
        </Field>

        <div className="flex items-end pb-1">
          <Toggle
            checked={values.is_failure}
            onChange={(checked) =>
              setValues({ ...values, is_failure: checked })
            }
            label="Failure"
          />
        </div>
      </div>

      <div className="mt-4">
        <SaveBar
          state={save.state}
          onSave={() =>
            save.save({
              label: values.label,
              sortOrder: values.sort_order,
              isFailure: values.is_failure,
            })
          }
          onRestore={save.restore}
        />
      </div>

      <div className="mt-4">
        <TranslationEditor
          versionId={versionId}
          resourceType="option"
          resourceId={option.id}
          translations={option.translations}
        />
      </div>
    </div>
  );
}

export function FormVersionBuilder({ data }: { data: BuilderData }) {
  const save = useSave(`/api/admin/form-versions/${data.version.id}`);
  const [notes, setNotes] = useState(data.version.notes ?? "");

  return (
    <main className="min-h-screen bg-slate-50/70 px-4 py-6 text-slate-900 md:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-600">
                {data.form.code}
              </p>
              <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700 ring-1 ring-inset ring-red-100">
                DRAFT
              </span>
            </div>

            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
              Edit Form — {data.form.name}
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Build and organize this draft version. Sections and questions can be
              expanded only when you need to edit them.
            </p>
          </div>

          <a href="/protected/admin/forms" className={secondaryButtonClass}>
            ← Back to Forms
          </a>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-red-600">
                Version settings
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">
                Draft configuration
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Version {data.version.version_number} · changes are saved to this draft.
              </p>
            </div>

            <span className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 ring-1 ring-inset ring-amber-200">
              Version {data.version.version_number}
            </span>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <Field label="Notes">
              <Textarea
                value={notes}
                placeholder="Add a note for this form version..."
                onChange={(event) => setNotes(event.target.value)}
              />
            </Field>

            <SaveBar
              state={save.state}
              onSave={() => save.save({ notes: notes || null })}
              onRestore={save.restore}
              label="Save notes"
            />
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3 px-1">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-red-600">
                Form structure
              </p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">Sections</h2>
              <p className="mt-1 text-sm text-slate-500">
                {data.sections.length} section{data.sections.length === 1 ? "" : "s"} in this
                draft.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500 shadow-sm">
              Canonical + localized content
            </div>
          </div>

          <AddSectionEditor versionId={data.version.id} />

          {data.sections.map((section, index) => (
            <SectionEditor
              key={section.id}
              versionId={data.version.id}
              section={section}
              sectionNumber={index + 1}
            />
          ))}
        </section>
      </div>
    </main>
  );
}
