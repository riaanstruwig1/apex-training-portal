import Link from "next/link";

const TABS = [
  { href: "/instructor/sq", label: "Overview", key: "overview" },
  { href: "/instructor/sq/safety", label: "Safety (SO)", key: "safety" },
  { href: "/instructor/sq/quality", label: "Quality (QA)", key: "quality" },
  { href: "/instructor/sq/actions", label: "Actions & findings", key: "actions" },
  { href: "/instructor/sq/sirsl", label: "SIRSL", key: "sirsl" },
];

export default function SqSubnav({ active }: { active: string }) {
  return (
    <nav className="print-hide mb-5 flex flex-wrap gap-2">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
            active === t.key ? "border-red-600 bg-red-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-red-400"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
