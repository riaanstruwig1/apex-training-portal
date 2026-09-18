"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateExamMeta, deleteExam, type ExamMetaInput } from "@/lib/actions/exams";

type Exam = {
  id: string;
  title: string;
  subtitle: string | null;
  category: "pg" | "ppg" | "ppt" | "rt" | "";
  passPercent: number;
  timeLimitMinutes: number | null;
  retryCooldownDays: number | null;
  mustPassSections: string | null;
};

const CATEGORY_OPTIONS: { value: ExamMetaInput["category"]; label: string }[] = [
  { value: "", label: "None" },
  { value: "pg", label: "PG Exam" },
  { value: "ppg", label: "PPG Exam" },
  { value: "ppt", label: "PPT Exam" },
  { value: "rt", label: "SAHPA RT Exam" },
];

export default function ExamMetaEditor({ exam }: { exam: Exam }) {
  const router = useRouter();
  const [title, setTitle] = useState(exam.title);
  const [subtitle, setSubtitle] = useState(exam.subtitle ?? "");
  const [category, setCategory] = useState<ExamMetaInput["category"]>(exam.category);
  const [passPercent, setPassPercent] = useState(String(exam.passPercent));
  const [timeLimit, setTimeLimit] = useState(
    exam.timeLimitMinutes != null ? String(exam.timeLimitMinutes) : ""
  );
  const [retryCooldown, setRetryCooldown] = useState(
    exam.retryCooldownDays != null ? String(exam.retryCooldownDays) : ""
  );
  const [mustPass, setMustPass] = useState(exam.mustPassSections ?? "");
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateExamMeta(exam.id, {
        title,
        subtitle,
        category,
        passPercent: Number(passPercent),
        timeLimitMinutes: timeLimit.trim() ? Number(timeLimit) : null,
        retryCooldownDays: retryCooldown.trim() ? Number(retryCooldown) : null,
        mustPassSections: mustPass,
      });
      if (result && "error" in result) {
        setError(result.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  }

  function handleDelete() {
    if (
      !confirm(
        `Delete "${exam.title}" completely? This removes every student's attempts at it too. This can't be undone.`
      )
    )
      return;
    startDeleteTransition(async () => {
      await deleteExam(exam.id);
      router.push("/instructor/exams");
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Exam settings</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
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
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Time limit (minutes, blank = none)
          </label>
          <input
            type="number"
            min={1}
            value={timeLimit}
            onChange={(e) => setTimeLimit(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Retry cooldown after a fail (days, blank = none)
          </label>
          <input
            type="number"
            min={1}
            value={retryCooldown}
            onChange={(e) => setRetryCooldown(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Section codes that must be passed in full (comma-separated, e.g. &quot;E&quot;)
          </label>
          <input
            value={mustPass}
            onChange={(e) => setMustPass(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={isPending}
            onClick={handleSave}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {isPending ? "Saving..." : "Save settings"}
          </button>
          {saved && <span className="text-sm text-green-600">Saved.</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
        <button
          type="button"
          disabled={isDeleting}
          onClick={handleDelete}
          className="text-sm text-slate-400 hover:text-red-600 disabled:opacity-60"
        >
          {isDeleting ? "Deleting..." : "Delete this exam"}
        </button>
      </div>
    </div>
  );
}
