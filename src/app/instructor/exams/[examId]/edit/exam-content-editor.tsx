"use client";

import { useState, useTransition } from "react";
import {
  updateExamQuestionFull,
  createExamQuestion,
  deleteExamQuestion,
  createExamSection,
  updateExamSection,
  deleteExamSection,
} from "@/lib/actions/exams";

type Option = {
  id: string;
  label: string;
  text: string | null;
  image: string | null;
  isCorrect: boolean;
};

type Question = {
  id: string;
  code: string;
  prompt: string;
  marks: number;
  options: Option[];
};

type Section = {
  id: string;
  code: string;
  name: string;
  questions: Question[];
};

function QuestionEditor({
  examId,
  question,
  onClose,
}: {
  examId: string;
  question: Question;
  onClose: () => void;
}) {
  const [prompt, setPrompt] = useState(question.prompt);
  const [marks, setMarks] = useState(String(question.marks));
  const [optionText, setOptionText] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const o of question.options) {
      if (o.text !== null) initial[o.id] = o.text;
    }
    return initial;
  });
  const [correctId, setCorrectId] = useState(
    question.options.find((o) => o.isCorrect)?.id ?? ""
  );
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    setError(null);
    const options = question.options.map((o) => ({
      id: o.id,
      text: o.text !== null ? optionText[o.id] ?? "" : null,
      isCorrect: o.id === correctId,
    }));

    startTransition(async () => {
      const result = await updateExamQuestionFull(question.id, examId, {
        prompt,
        marks: Number(marks),
        options,
      });
      if (result && "error" in result) {
        setError(result.error);
      } else {
        onClose();
      }
    });
  }

  function handleDelete() {
    if (!confirm(`Delete question ${question.code}? This can't be undone.`)) return;
    startDeleteTransition(async () => {
      await deleteExamQuestion(question.id, examId);
      onClose();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Question {question.code}
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="w-24">
          <label className="mb-1 block text-xs font-medium text-slate-500">Marks</label>
          <input
            type="number"
            min={0.5}
            step={0.5}
            value={marks}
            onChange={(e) => setMarks(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div className="space-y-2">
        {question.options.map((o) => (
          <label key={o.id} className="flex items-center gap-2">
            <input
              type="radio"
              name={`correct-${question.id}`}
              checked={correctId === o.id}
              onChange={() => setCorrectId(o.id)}
              title="Mark as the correct answer"
            />
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
              {o.label}
            </span>
            {o.text !== null ? (
              <input
                value={optionText[o.id] ?? ""}
                onChange={(e) =>
                  setOptionText((prev) => ({ ...prev, [o.id]: e.target.value }))
                }
                className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
            ) : (
              <span className="flex-1 text-xs italic text-slate-400">
                Image answer ({o.image}) &mdash; text not editable here
              </span>
            )}
          </label>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={isPending}
            onClick={handleSave}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {isPending ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Cancel
          </button>
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
        <button
          type="button"
          disabled={isDeleting}
          onClick={handleDelete}
          className="text-sm text-slate-400 hover:text-red-600 disabled:opacity-60"
        >
          {isDeleting ? "Deleting..." : "Delete question"}
        </button>
      </div>
    </div>
  );
}

function NewQuestionForm({
  examId,
  sectionId,
  onDone,
}: {
  examId: string;
  sectionId: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [prompt, setPrompt] = useState("");
  const [marks, setMarks] = useState("1");
  const [optionText, setOptionText] = useState(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-500 hover:border-red-400 hover:text-red-600"
      >
        + Add question
      </button>
    );
  }

  function handleAdd() {
    setError(null);
    startTransition(async () => {
      const result = await createExamQuestion(sectionId, examId, {
        code,
        prompt,
        marks: Number(marks),
        options: optionText.map((text, i) => ({ text, isCorrect: i === correctIndex })),
      });
      if (result && "error" in result) {
        setError(result.error);
      } else {
        setCode("");
        setPrompt("");
        setMarks("1");
        setOptionText(["", "", "", ""]);
        setCorrectIndex(0);
        setOpen(false);
        onDone();
      }
    });
  }

  const labels = ["A", "B", "C", "D"];

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex gap-3">
        <div className="w-28">
          <label className="mb-1 block text-xs font-medium text-slate-500">Code</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. B.9"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-500">Question</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="w-24">
          <label className="mb-1 block text-xs font-medium text-slate-500">Marks</label>
          <input
            type="number"
            min={0.5}
            step={0.5}
            value={marks}
            onChange={(e) => setMarks(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div className="space-y-2">
        {optionText.map((text, i) => (
          <label key={i} className="flex items-center gap-2">
            <input
              type="radio"
              name={`new-correct-${sectionId}`}
              checked={correctIndex === i}
              onChange={() => setCorrectIndex(i)}
              title="Mark as the correct answer"
            />
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
              {labels[i]}
            </span>
            <input
              value={text}
              onChange={(e) =>
                setOptionText((prev) => prev.map((t, j) => (j === i ? e.target.value : t)))
              }
              className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={handleAdd}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {isPending ? "Adding..." : "Add question"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          Cancel
        </button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  );
}

function SectionHeader({
  examId,
  section,
  onRefresh,
}: {
  examId: string;
  section: Section;
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState(section.code);
  const [name, setName] = useState(section.name);
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await updateExamSection(section.id, examId, code, name);
      if (result && "error" in result) {
        setError(result.error);
      } else {
        setEditing(false);
        onRefresh();
      }
    });
  }

  function handleDelete() {
    if (
      !confirm(
        `Delete section ${section.code} (${section.name}) and all ${section.questions.length} of its questions? This can't be undone.`
      )
    )
      return;
    startDeleteTransition(async () => {
      await deleteExamSection(section.id, examId);
      onRefresh();
    });
  }

  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
        />
        <button
          type="button"
          disabled={isPending}
          onClick={handleSave}
          className="rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-xs text-slate-500 hover:text-slate-700"
        >
          Cancel
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-sm font-semibold uppercase tracking-wide text-slate-500 hover:text-red-600"
      >
        Section {section.code}: {section.name}
      </button>
      <button
        type="button"
        disabled={isDeleting}
        onClick={handleDelete}
        className="text-xs text-slate-400 hover:text-red-600 disabled:opacity-60"
      >
        {isDeleting ? "Deleting..." : "Delete section"}
      </button>
    </div>
  );
}

function NewSectionForm({ examId, onDone }: { examId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-500 hover:border-red-400 hover:text-red-600"
      >
        + Add section
      </button>
    );
  }

  function handleAdd() {
    setError(null);
    startTransition(async () => {
      const result = await createExamSection(examId, code, name);
      if (result && "error" in result) {
        setError(result.error);
      } else {
        setCode("");
        setName("");
        setOpen(false);
        onDone();
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Code, e.g. G"
        className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
      />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Section name"
        className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
      />
      <button
        type="button"
        disabled={isPending}
        onClick={handleAdd}
        className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
      >
        {isPending ? "Adding..." : "Add"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-sm text-slate-500 hover:text-slate-700"
      >
        Cancel
      </button>
      {error && <span className="w-full text-sm text-red-600">{error}</span>}
    </div>
  );
}

export default function ExamContentEditor({
  examId,
  sections,
}: {
  examId: string;
  sections: Section[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  // Every action here calls revalidatePath server-side, so Next refetches
  // this page's data and passes fresh `sections` props automatically --
  // all that's needed on this end is to close whichever editor was open.
  function refresh() {
    setOpenId(null);
  }

  return (
    <div className="space-y-6">
      {sections.map((s) => (
        <section key={s.id} className="space-y-2">
          <SectionHeader examId={examId} section={s} onRefresh={refresh} />
          {s.questions.map((q) => (
            <div key={q.id} className="rounded-xl border border-slate-200 bg-white p-4">
              {openId === q.id ? (
                <QuestionEditor
                  examId={examId}
                  question={q}
                  onClose={refresh}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setOpenId(q.id)}
                  className="w-full text-left text-sm text-slate-800 hover:text-red-600"
                >
                  <span className="font-medium text-slate-500">{q.code}.</span> {q.prompt}
                  <span className="ml-2 text-xs text-slate-400">({q.marks} marks)</span>
                </button>
              )}
            </div>
          ))}
          <NewQuestionForm examId={examId} sectionId={s.id} onDone={refresh} />
        </section>
      ))}
      {sections.length === 0 && (
        <p className="text-sm text-slate-500">
          No sections yet &mdash; add one to start building this exam.
        </p>
      )}
      <NewSectionForm examId={examId} onDone={refresh} />
    </div>
  );
}
