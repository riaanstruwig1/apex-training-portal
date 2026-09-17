"use client";

import { useState, useTransition } from "react";
import { updateExamQuestionContent } from "@/lib/actions/exams";

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
  onSaved,
}: {
  examId: string;
  question: Question;
  onSaved: () => void;
}) {
  const [prompt, setPrompt] = useState(question.prompt);
  const [optionText, setOptionText] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const o of question.options) {
      if (o.text !== null) initial[o.id] = o.text;
    }
    return initial;
  });
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setError(null);
    setSaved(false);
    const options = question.options
      .filter((o) => o.text !== null)
      .map((o) => ({ id: o.id, text: optionText[o.id] ?? "" }));

    startTransition(async () => {
      const result = await updateExamQuestionContent(question.id, examId, prompt, options);
      if (result && "error" in result) {
        setError(result.error);
      } else {
        setSaved(true);
        onSaved();
        setTimeout(() => setSaved(false), 2000);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div>
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
      <div className="space-y-2">
        {question.options.map((o) => (
          <div key={o.id} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                o.isCorrect ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
              }`}
              title={o.isCorrect ? "Marked correct (locked)" : undefined}
            >
              {o.label}
            </span>
            {o.text !== null ? (
              <input
                value={optionText[o.id] ?? ""}
                onChange={(e) => setOptionText((prev) => ({ ...prev, [o.id]: e.target.value }))}
                className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
            ) : (
              <span className="flex-1 text-xs italic text-slate-400">
                Image answer (not editable here)
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={handleSave}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {isPending ? "Saving..." : "Save"}
        </button>
        {saved && <span className="text-sm text-green-600">Saved.</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
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

  return (
    <div className="space-y-6">
      {sections.map((s) => (
        <section key={s.id} className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Section {s.code}: {s.name}
          </h2>
          {s.questions.map((q) => (
            <div key={q.id} className="rounded-xl border border-slate-200 bg-white p-4">
              {openId === q.id ? (
                <QuestionEditor examId={examId} question={q} onSaved={() => {}} />
              ) : (
                <button
                  type="button"
                  onClick={() => setOpenId(q.id)}
                  className="w-full text-left text-sm text-slate-800 hover:text-red-600"
                >
                  <span className="font-medium text-slate-500">{q.code}.</span> {q.prompt}
                </button>
              )}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
