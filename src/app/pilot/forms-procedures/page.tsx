import { requirePilot } from "@/lib/auth/dal";
import { getFormsProcedures } from "@/lib/actions/forms-procedures";

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function PilotFormsProceduresPage() {
  await requirePilot();
  const items = (await getFormsProcedures()).filter((s) => s.filename);

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Forms &amp; procedures</h1>
      <p className="mb-6 max-w-2xl text-sm text-slate-500">
        Documents and forms your CFI or Admin has made available.
      </p>
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          Nothing here yet.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <a
              key={item.id}
              href={`/api/forms-procedures/${item.filename}`}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 hover:border-red-300"
            >
              <div>
                <div className="text-sm font-medium text-slate-900">{item.title}</div>
                <div className="text-xs text-slate-500">{formatBytes(item.fileSize)}</div>
              </div>
              <span className="text-sm font-medium text-red-600">Download</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
