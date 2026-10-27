import FormsProceduresList from "@/components/forms-procedures-list";
import { requirePilot } from "@/lib/auth/dal";
import { getFormsProcedures } from "@/lib/actions/forms-procedures";

export default async function PilotFormsProceduresPage() {
  await requirePilot();
  const items = (await getFormsProcedures()).filter((s) => s.filename);

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Forms &amp; procedures</h1>
      <p className="mb-6 max-w-2xl text-sm text-slate-500">
        Documents and forms your CFI or Admin has made available.
      </p>
      <FormsProceduresList slots={items} />
    </div>
  );
}
