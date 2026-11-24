import { requireInstructor } from "@/lib/auth/dal";
import { getStudyMaterials } from "@/lib/actions/study-materials";
import StudyMaterialEditor from "./study-material-editor";

export default async function StudyMaterialAdminPage() {
  // Batch 105: instructors see the list too (Download + Copy link only).
  const staff = await requireInstructor();
  const canEdit = staff.role === "cfi";
  const slots = await getStudyMaterials();

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Study material</h1>
      <p className="mb-6 max-w-2xl text-sm text-slate-500">
        Up to 8 study notes -- slide decks, notes, videos -- as an upload (ZIP,
        PowerPoint, Word or PDF, up to 50MB) or a link. Students see them all on
        their Study Notes page. Pick a dashboard box (1-4) to also show an item
        on the student dashboard next to the matching exam: 1 Basic Licence (PG),
        2 PPG, 3 DTO Radio, 4 PPT/PPC.
      </p>
      <p className="mb-4 max-w-2xl text-sm text-slate-500">
        🔗 <strong>Copy link</strong> next to a note copies a link you can paste in a WhatsApp or email. It opens
        after the student logs in.
      </p>
      <StudyMaterialEditor slots={slots} canEdit={canEdit} />
    </div>
  );
}
