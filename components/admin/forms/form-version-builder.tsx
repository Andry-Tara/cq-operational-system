"use client";

import {
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

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

function useSave(url: string) {
  const router = useRouter();
  const [state, setState] = useState(initialSave);

  async function save(body: Record<string, unknown>) {
    if (state.saving) return;

    setState({
      saving: true,
      message: "",
      error: "",
    });

    try {
      const response = await fetch(url, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "Unable to save.");
      }

      setState({
        saving: false,
        message: "Saved",
        error: "",
      });

      router.refresh();
    } catch (error) {
      setState({
        saving: false,
        message: "",
        error:
          error instanceof Error
            ? error.message
            : "Unable to save.",
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
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      {label}
      {children}
    </label>
  );
}

function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="min-h-9 rounded border border-slate-300 bg-white px-2 text-sm font-normal text-slate-900 shadow-sm outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-600"
    />
  );
}

function Textarea(
  props: TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return (
    <textarea
      {...props}
      className="min-h-20 rounded border border-slate-300 bg-white px-2 py-1 text-sm font-normal text-slate-900 shadow-sm outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-600"
    />
  );
}

function Select(
  props: SelectHTMLAttributes<HTMLSelectElement>,
) {
  return (
    <select
      {...props}
      className="min-h-9 rounded border border-slate-300 bg-white px-2 text-sm font-normal text-slate-900 shadow-sm outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-600"
    />
  );
}

function SaveBar({
  state,
  onSave,
  onRestore,
}: {
  state: SaveResult;
  onSave: () => void;
  onRestore: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        onClick={onSave}
        disabled={state.saving}
      >
        {state.saving ? "Saving..." : "Save"}
      </Button>

      {state.message && (
        <span className="text-sm text-emerald-700">
          {state.message}
        </span>
      )}

      {state.error && (
        <>
          <span className="text-sm text-red-700">
            {state.error}
          </span>

          <button
            type="button"
            className="text-sm underline"
            onClick={onRestore}
          >
            Restore
          </button>
        </>
      )}
    </div>
  );
}

function TranslationEditor({
  versionId,
  resourceType,
  resourceId,
  translations,
}: {
  versionId: string;
  resourceType:
    | "section"
    | "group"
    | "question"
    | "option";
  resourceId: string;
  translations: Translation[];
}) {
  const [locale, setLocale] =
    useState<"en" | "id-ID">("en");

  const current = translations.find(
    (item) => item.locale === locale,
  );

  const [values, setValues] = useState<Translation>(
    current ?? { locale },
  );

  const save = useSave(
    `/api/admin/form-versions/${versionId}/translations`,
  );

  const set = (key: string, value: string) =>
    setValues((old) => ({
      ...old,
      [key]: value,
    }));

  const payload =
    resourceType === "question"
      ? {
          questionText: values.question_text ?? "",
          helpText: values.help_text ?? null,
        }
      : resourceType === "option"
        ? {
            label: values.label ?? "",
          }
        : {
            displayName: values.display_name ?? "",
            description: values.description ?? null,
          };

  return (
    <div className="mt-3 border-l-2 border-slate-200 pl-3">
      <div className="mb-2 flex gap-1">
        {(
          [
            ["en", "English (EN)"],
            ["id-ID", "Indonesian (ID)"],
          ] as const
        ).map(([value, label]) => (
          <button
            type="button"
            key={value}
            className={`border-b-2 px-2 py-1 text-xs font-semibold ${
              locale === value
                ? "border-slate-800 text-slate-900"
                : "border-transparent text-slate-500"
            }`}
            onClick={() => {
              setLocale(value);
              setValues(
                translations.find(
                  (item) => item.locale === value,
                ) ?? { locale: value },
              );
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {resourceType === "option" ? (
        <Field label="Label">
          <Input
            value={values.label ?? ""}
            onChange={(event) =>
              set("label", event.target.value)
            }
          />
        </Field>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <Field
            label={
              resourceType === "question"
                ? "Question text"
                : "Display name"
            }
          >
            <Input
              value={
                resourceType === "question"
                  ? values.question_text ?? ""
                  : values.display_name ?? ""
              }
              onChange={(event) =>
                set(
                  resourceType === "question"
                    ? "question_text"
                    : "display_name",
                  event.target.value,
                )
              }
            />
          </Field>

          <Field
            label={
              resourceType === "question"
                ? "Help text"
                : "Description"
            }
          >
            <Textarea
              value={
                resourceType === "question"
                  ? values.help_text ?? ""
                  : values.description ?? ""
              }
              onChange={(event) =>
                set(
                  resourceType === "question"
                    ? "help_text"
                    : "description",
                  event.target.value || "",
                )
              }
            />
          </Field>
        </div>
      )}

      <div className="mt-2">
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
        />
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
  const [values, setValues] =
    useState<NewQuestionValues>(createEmptyQuestion());

  const [state, setState] =
    useState<SaveResult>(initialSave);

  const update = (
    key: keyof NewQuestionValues,
    value: string | boolean,
  ) => {
    setValues((old) => ({
      ...old,
      [key]: value,
    }));

    if (state.error || state.message) {
      setState(initialSave);
    }
  };

  async function addQuestion() {
    if (state.saving) return;

    if (
      !values.code.trim() ||
      !values.questionText.trim()
    ) {
      setState({
        saving: false,
        message: "",
        error:
          "Question code and question text are required.",
      });
      return;
    }

    const minValue =
      values.questionType === "temperature" &&
      values.minValue !== ""
        ? Number(values.minValue)
        : null;

    const maxValue =
      values.questionType === "temperature" &&
      values.maxValue !== ""
        ? Number(values.maxValue)
        : null;

    if (
      minValue !== null &&
      maxValue !== null &&
      minValue > maxValue
    ) {
      setState({
        saving: false,
        message: "",
        error:
          "Minimum value cannot be greater than maximum value.",
      });
      return;
    }

    setState({
      saving: true,
      message: "",
      error: "",
    });

    try {
      const response = await fetch(
        `/api/admin/form-versions/${versionId}/sections/${section.id}/questions`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            code: values.code.trim(),
            questionText: values.questionText.trim(),
            questionType: values.questionType,
            isRequired: values.isRequired,
            questionGroupId:
              values.questionGroupId || null,
            helpText:
              values.helpText.trim() || null,
            unit:
              values.questionType === "temperature"
                ? values.unit.trim() || null
                : null,
            minValue,
            maxValue,
          }),
        },
      );

      const result = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to add question.",
        );
      }

      setState({
        saving: false,
        message: "Question added.",
        error: "",
      });

      setValues(createEmptyQuestion());
      router.refresh();
    } catch (error) {
      setState({
        saving: false,
        message: "",
        error:
          error instanceof Error
            ? error.message
            : "Unable to add question.",
      });
    }
  }

  if (!open) {
    return (
      <div className="border-t border-dashed border-slate-300 pt-4">
        <Button
          type="button"
          onClick={() => {
            setOpen(true);
            setState(initialSave);
          }}
        >
          + Add Question
        </Button>
      </div>
    );
  }

  return (
    <div className="border border-dashed border-slate-400 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            New Question
          </p>

          <h3 className="mt-1 font-semibold text-slate-950">
            Add question to {section.display_name}
          </h3>
        </div>

        <button
          type="button"
          className="text-sm font-medium text-slate-600 underline"
          onClick={() => {
            setOpen(false);
            setValues(createEmptyQuestion());
            setState(initialSave);
          }}
        >
          Cancel
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Field label="Question code">
          <Input
            placeholder="CLS_EXT_002"
            value={values.code}
            onChange={(event) =>
              update("code", event.target.value)
            }
          />
        </Field>

        <Field label="Question type">
          <Select
            value={values.questionType}
            onChange={(event) =>
              update(
                "questionType",
                event.target.value as
                  | "yes_no"
                  | "temperature",
              )
            }
          >
            <option value="yes_no">Yes / No</option>
            <option value="temperature">
              Temperature
            </option>
          </Select>
        </Field>

        {section.groups.length > 0 && (
          <Field label="Question group">
            <Select
              value={values.questionGroupId}
              onChange={(event) =>
                update(
                  "questionGroupId",
                  event.target.value,
                )
              }
            >
              <option value="">
                No group / Section level
              </option>

              {section.groups.map((group) => (
                <option
                  key={group.id}
                  value={group.id}
                >
                  {group.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <div className="flex items-end">
          <label className="flex min-h-9 items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={values.isRequired}
              onChange={(event) =>
                update(
                  "isRequired",
                  event.target.checked,
                )
              }
            />
            Required
          </label>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Field label="Question text">
          <Textarea
            placeholder="Enter the question..."
            value={values.questionText}
            onChange={(event) =>
              update(
                "questionText",
                event.target.value,
              )
            }
          />
        </Field>

        <Field label="Help text">
          <Textarea
            placeholder="Optional instruction or guidance"
            value={values.helpText}
            onChange={(event) =>
              update("helpText", event.target.value)
            }
          />
        </Field>
      </div>

      {values.questionType === "temperature" && (
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <Field label="Unit">
            <Input
              placeholder="°C"
              value={values.unit}
              onChange={(event) =>
                update("unit", event.target.value)
              }
            />
          </Field>

          <Field label="Minimum">
            <Input
              type="number"
              step="any"
              placeholder="15"
              value={values.minValue}
              onChange={(event) =>
                update(
                  "minValue",
                  event.target.value,
                )
              }
            />
          </Field>

          <Field label="Maximum">
            <Input
              type="number"
              step="any"
              placeholder="35"
              value={values.maxValue}
              onChange={(event) =>
                update(
                  "maxValue",
                  event.target.value,
                )
              }
            />
          </Field>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={state.saving}
          onClick={addQuestion}
        >
          {state.saving
            ? "Adding..."
            : "Add Question"}
        </Button>

        <button
          type="button"
          className="text-sm font-medium text-slate-600 underline"
          disabled={state.saving}
          onClick={() => {
            setOpen(false);
            setValues(createEmptyQuestion());
            setState(initialSave);
          }}
        >
          Cancel
        </button>

        {state.message && (
          <span className="text-sm font-medium text-emerald-700">
            {state.message}
          </span>
        )}

        {state.error && (
          <span className="text-sm font-medium text-red-700">
            {state.error}
          </span>
        )}
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

  const [values, setValues] =
    useState(section);

  const update = (
    key: keyof Section,
    value: unknown,
  ) =>
    setValues((old) => ({
      ...old,
      [key]: value,
    }));

  return (
    <section className="border border-slate-300 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Section{" "}
            {String(sectionNumber).padStart(2, "0")}
          </p>

          <h2 className="mt-1 text-lg font-semibold text-slate-950">
            {values.display_name ||
              `Section ${sectionNumber}`}
          </h2>
        </div>

        <span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
          {values.is_active
            ? "Active"
            : "Inactive"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Field label="Display name">
          <Input
            value={values.display_name}
            onChange={(event) =>
              update(
                "display_name",
                event.target.value,
              )
            }
          />
        </Field>

        <Field label="Description">
          <Textarea
            value={values.description ?? ""}
            onChange={(event) =>
              update(
                "description",
                event.target.value || null,
              )
            }
          />
        </Field>

        <Field label="Sort order">
          <Input
            type="number"
            min={0}
            value={values.sort_order}
            onChange={(event) =>
              update(
                "sort_order",
                Number(event.target.value),
              )
            }
          />
        </Field>
      </div>

      <div className="mt-3 flex gap-5 text-sm">
        <label>
          <input
            type="checkbox"
            checked={values.is_required}
            onChange={(event) =>
              update(
                "is_required",
                event.target.checked,
              )
            }
          />{" "}
          Required
        </label>

        <label>
          <input
            type="checkbox"
            checked={values.is_active}
            onChange={(event) =>
              update(
                "is_active",
                event.target.checked,
              )
            }
          />{" "}
          Active
        </label>
      </div>

      <div className="mt-3">
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

      <TranslationEditor
        versionId={versionId}
        resourceType="section"
        resourceId={section.id}
        translations={section.translations}
      />

      <div className="mt-5 grid gap-4 border-t border-slate-200 pt-4">
        {section.groups.map((group) => (
          <GroupEditor
            key={group.id}
            versionId={versionId}
            group={group}
          />
        ))}

        {section.questions
          .filter(
            (question) =>
              !question.question_group_id,
          )
          .map((question) => (
            <QuestionEditor
              key={question.id}
              versionId={versionId}
              question={question}
            />
          ))}

        <AddQuestionEditor
          versionId={versionId}
          section={section}
        />
      </div>
    </section>
  );
}

function GroupEditor({
  versionId,
  group,
}: {
  versionId: string;
  group: Group;
}) {
  const save = useSave(
    `/api/admin/form-versions/${versionId}/groups/${group.id}`,
  );

  const [values, setValues] =
    useState(group);

  return (
    <div className="border border-slate-200 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Group · {group.code}
      </p>

      <div className="mt-2 grid gap-3 md:grid-cols-3">
        <Field label="Name">
          <Input
            value={values.name}
            onChange={(event) =>
              setValues({
                ...values,
                name: event.target.value,
              })
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
                sort_order: Number(
                  event.target.value,
                ),
              })
            }
          />
        </Field>

        <label className="self-end text-sm">
          <input
            type="checkbox"
            checked={values.is_active}
            onChange={(event) =>
              setValues({
                ...values,
                is_active:
                  event.target.checked,
              })
            }
          />{" "}
          Active
        </label>
      </div>

      <div className="mt-3">
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
      </div>

      <TranslationEditor
        versionId={versionId}
        resourceType="group"
        resourceId={group.id}
        translations={group.translations}
      />

      <div className="mt-4 grid gap-3 border-t border-slate-100 pt-3">
        {group.questions.map((question) => (
          <QuestionEditor
            key={question.id}
            versionId={versionId}
            question={question}
          />
        ))}
      </div>
    </div>
  );
}

function QuestionEditor({
  versionId,
  question,
}: {
  versionId: string;
  question: Question;
}) {
  const save = useSave(
    `/api/admin/form-versions/${versionId}/questions/${question.id}`,
  );

  const [values, setValues] =
    useState(question);

  const update = (
    key: keyof Question,
    value: unknown,
  ) =>
    setValues((old) => ({
      ...old,
      [key]: value,
    }));

  return (
    <div className="border border-slate-200 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Question · {question.code} ·{" "}
        {question.question_type}
      </p>

      <div className="mt-2 grid gap-3 md:grid-cols-2">
        <Field label="Question text">
          <Textarea
            value={values.question_text}
            onChange={(event) =>
              update(
                "question_text",
                event.target.value,
              )
            }
          />
        </Field>

        <Field label="Help text">
          <Textarea
            value={values.help_text ?? ""}
            onChange={(event) =>
              update(
                "help_text",
                event.target.value || null,
              )
            }
          />
        </Field>

        <Field label="Unit">
          <Input
            value={values.unit ?? ""}
            onChange={(event) =>
              update(
                "unit",
                event.target.value || null,
              )
            }
          />
        </Field>

        <Field label="Placeholder">
          <Input
            value={values.placeholder ?? ""}
            onChange={(event) =>
              update(
                "placeholder",
                event.target.value || null,
              )
            }
          />
        </Field>

        <Field label="Minimum">
          <Input
            type="number"
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

        <Field label="Sort order">
          <Input
            type="number"
            min={0}
            value={values.sort_order}
            onChange={(event) =>
              update(
                "sort_order",
                Number(event.target.value),
              )
            }
          />
        </Field>
      </div>

      <div className="mt-3 flex flex-wrap gap-5 text-sm">
        <label>
          <input
            type="checkbox"
            checked={values.is_required}
            onChange={(event) =>
              update(
                "is_required",
                event.target.checked,
              )
            }
          />{" "}
          Required
        </label>

        <label>
          <input
            type="checkbox"
            checked={values.is_active}
            onChange={(event) =>
              update(
                "is_active",
                event.target.checked,
              )
            }
          />{" "}
          Active
        </label>
      </div>

      <div className="mt-3">
        <SaveBar
          state={save.state}
          onSave={() =>
            save.save({
              questionText:
                values.question_text,
              helpText: values.help_text,
              isRequired:
                values.is_required,
              unit: values.unit,
              minValue: values.min_value,
              maxValue: values.max_value,
              placeholder:
                values.placeholder,
              sortOrder:
                values.sort_order,
              isActive: values.is_active,
            })
          }
          onRestore={save.restore}
        />
      </div>

      <TranslationEditor
        versionId={versionId}
        resourceType="question"
        resourceId={question.id}
        translations={question.translations}
      />

      <div className="mt-4 grid gap-2 border-t border-slate-100 pt-3">
        {question.options.length ? (
          question.options.map((option) => (
            <OptionEditor
              key={option.id}
              versionId={versionId}
              option={option}
            />
          ))
        ) : (
          <p className="text-sm text-slate-500">
            No options
          </p>
        )}
      </div>
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

  const [values, setValues] =
    useState(option);

  return (
    <div className="border border-slate-200 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Option · value: {option.value}
      </p>

      <div className="mt-2 grid gap-3 md:grid-cols-3">
        <Field label="Label">
          <Input
            value={values.label}
            onChange={(event) =>
              setValues({
                ...values,
                label: event.target.value,
              })
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
                sort_order: Number(
                  event.target.value,
                ),
              })
            }
          />
        </Field>

        <label className="self-end text-sm">
          <input
            type="checkbox"
            checked={values.is_failure}
            onChange={(event) =>
              setValues({
                ...values,
                is_failure:
                  event.target.checked,
              })
            }
          />{" "}
          Failure
        </label>
      </div>

      <div className="mt-3">
        <SaveBar
          state={save.state}
          onSave={() =>
            save.save({
              label: values.label,
              sortOrder: values.sort_order,
              isFailure:
                values.is_failure,
            })
          }
          onRestore={save.restore}
        />
      </div>

      <TranslationEditor
        versionId={versionId}
        resourceType="option"
        resourceId={option.id}
        translations={option.translations}
      />
    </div>
  );
}

export function FormVersionBuilder({
  data,
}: {
  data: BuilderData;
}) {
  const save = useSave(
    `/api/admin/form-versions/${data.version.id}`,
  );

  const [notes, setNotes] = useState(
    data.version.notes ?? "",
  );

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6 text-slate-900">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-sm text-slate-500">
            {data.form.code} · Version{" "}
            {data.version.version_number}
          </p>

          <h1 className="text-2xl font-semibold text-slate-950">
            {data.form.name}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <span className="rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">
            DRAFT
          </span>

          <a
            className="text-sm font-medium text-slate-700 underline"
            href="/protected/admin/forms"
          >
            Back to Forms
          </a>
        </div>
      </header>

      <section className="border border-slate-300 bg-white p-4">
        <h2 className="font-semibold text-slate-950">
          Version settings
        </h2>

        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
          <Field label="Notes">
            <Textarea
              value={notes}
              onChange={(event) =>
                setNotes(event.target.value)
              }
            />
          </Field>

          <div className="self-end">
            <SaveBar
              state={save.state}
              onSave={() =>
                save.save({
                  notes: notes || null,
                })
              }
              onRestore={save.restore}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">
            Sections
          </h2>

          <p className="text-sm text-slate-500">
            Canonical fields and localized draft
            content
          </p>
        </div>

        {data.sections.map(
          (section, index) => (
            <SectionEditor
              key={section.id}
              versionId={data.version.id}
              section={section}
              sectionNumber={index + 1}
            />
          ),
        )}
      </section>
    </main>
  );
}
