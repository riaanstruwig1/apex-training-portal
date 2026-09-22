import { requireCFI } from "@/lib/auth/dal";
import { getStudyMaterials } from "@/lib/actions/study-materials";
import StudyMaterialEditor from "./study-material-editor";

export default async function StudyMaterialAdminPage() {
  await requireCFI();
  const slots = await getStudyMaterials();

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Study material</h1>
      <p className="mb-6 max-w-2xl text-sm text-slate-500">
        Up to 8 downloads shown to every student alongside their exams --
        notes, slide decks, or other course material. ZIP, PowerPoint, Word
        or PDF files, up to 50MB each.
      </p>
      <StudyMaterialEditor slots={slots} />
    </div>
  );
}
