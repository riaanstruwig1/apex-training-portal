import { groupByCategory } from "@/lib/forms-categories";
import type { FormsProcedureSlot } from "@/lib/actions/forms-procedures";

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Students' and pilots' Forms & procedures list, grouped under the five
 * categories in Riaan's order (batch 84). Empty categories are left out. */
export default function FormsProceduresList({ slots }: { slots: FormsProcedureSlot[] }) {
  const groups = groupByCategory(slots.filter((s) => s.filename)).filter((g) => g.items.length > 0);
  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        Nothing here yet.
      </div>
    );
  }
  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <section key={g.key}>
          <h2 className="text-base font-semibold text-slate-900">{g.label}</h2>
          {g.note && <p className="text-xs text-slate-500">{g.note}</p>}
          <div className="mt-3 space-y-3">
            {g.items.map((item) => (
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
        </section>
      ))}
    </div>
  );
}
