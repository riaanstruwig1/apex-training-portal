import { requireAdminOrCFI } from "@/lib/auth/dal";
import { getFormsProcedures } from "@/lib/actions/forms-procedures";
import FormsProceduresEditor from "./forms-procedures-editor";

export default async function FormsProceduresAdminPage() {
  await requireAdminOrCFI();
  const slots = await getFormsProcedures();

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Forms &amp; procedures</h1>
      <p className="mb-6 max-w-2xl text-sm text-slate-500">
        Shared downloads shown to every student and pilot -- images, PDFs,
        PowerPoint presentations or ZIP files, up to 50MB each. Starts with
        10 slots; add more as needed.
      </p>
      <FormsProceduresEditor slots={slots} />
    </div>
  );
}
