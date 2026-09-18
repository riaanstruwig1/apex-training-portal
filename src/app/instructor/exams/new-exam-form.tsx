"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createExam, type ExamMetaInput } from "@/lib/actions/exams";

const CATEGORY_OPTIONS: { value: ExamMetaInput["category"]; label: string }[] = [
  { value: "", label: "None yet" },
  { value: "pg", label: "PG Exam" },
  { value: "ppg", label: "PPG Exam" },
  { value: "ppt", label: "PPT Exam" },
  { value: "rt", label: "SAHPA RT Exam" },
];

export default function NewExamForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [category, setCategory] = useState<ExamMetaInput["category"]>("");
  const [passPercent, setPassPercent] = useState("85");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
      >
        + New exam
      </button>
    );
  }

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const result = await createExam({
        title,
        subtitle,
        category,
        passPercent: Number(passPercent),
        timeLimitMinutes: null,
        retryCooldownDays: null,
        mustPassSections: "",
      });
      if (result && "error" in result) {
        setError(result.error);
      } else if (result) {
        router.push(`/instructor/exams/${result.examId}/edit`);
      }
    });
  }

  return (
    <div className="mb-6 space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. PPT Basic Licence Theory Test"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Subtitle</label>
          <input
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Counts toward
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ExamMetaInput["category"])}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Pass %</label>
          <input
            type="number"
            min={1}
            max={100}
            value={passPercent}
            onChange={(e) => setPassPercent(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <p className="text-xs text-slate-400">
        You can add the time limit, retry cooldown, and questions once the exam is created.
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={isPending || !title.trim()}
          onClick={handleCreate}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {isPending ? "Creating..." : "Create exam"}
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

