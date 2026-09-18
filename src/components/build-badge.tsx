import { VERSION, DEPLOYED_AT, COMMIT } from "@/lib/build-info";

export function BuildBadge({ className = "" }: { className?: string }) {
  const dateStr = DEPLOYED_AT.toLocaleString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <p className={`text-center text-xs text-slate-400 ${className}`}>
      {VERSION} &middot; deployed {dateStr} &middot; {COMMIT}
    </p>
  );
}