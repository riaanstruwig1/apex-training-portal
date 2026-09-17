import { requireCFI } from "@/lib/auth/dal";
import { getRadioCallScript } from "@/lib/settings";
import RadioScriptForm from "./radio-script-form";

export default async function InstructorSettingsPage() {
  await requireCFI();

  const radioCallScript = await getRadioCallScript();

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">
          Applies to every student -- not per-student.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold text-slate-900">
          Standard radio call
        </h2>
        <p className="mb-3 text-sm text-slate-500">
          The radio call every student is taught to make during training.
          Shown at the bottom of every student&apos;s Dashboard, Training folio
          and Logbook pages.
        </p>
        <RadioScriptForm initialValue={radioCallScript ?? ""} />
      </section>
    </div>
  );
}
