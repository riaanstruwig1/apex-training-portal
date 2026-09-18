import Link from "next/link";
import Image from "next/image";
import { logout } from "@/lib/actions/auth";
import { BuildBadge } from "@/components/build-badge";

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-1 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-4 text-white">
      {count}
    </span>
  );
}

export default function NavHeader({
  name,
  roleLabel,
  links,
  apexNumber,
  sahpaNumber,
}: {
  name: string;
  roleLabel: string;
  links: { href: string; label: string; badge?: number }[];
  apexNumber?: string | null;
  sahpaNumber?: string | null;
}) {
  const idLine = [
    apexNumber ? `Apex No. ${apexNumber}` : null,
    sahpaNumber ? `SACAA No. ${sahpaNumber}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <Image
              src="/apex-logo.png"
              alt="Apex Adventures"
              width={1095}
              height={1028}
              priority
              className="h-7 w-auto shrink-0 sm:h-9"
            />
            <span className="whitespace-nowrap font-semibold tracking-tight text-slate-900">
              Team Apex Portal
            </span>
          </Link>
          <nav className="hidden flex-wrap gap-4 sm:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center text-sm ${
                  (link.badge ?? 0) > 0
                    ? "font-semibold text-red-600 hover:text-red-700"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {link.label}
                <NavBadge count={link.badge ?? 0} />
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Image
            src="/sahpa-logo.png"
            alt="SAHPA"
            title="SAHPA"
            width={382}
            height={400}
            className="hidden h-8 w-auto rounded sm:block"
          />
          <div className="hidden text-right text-sm sm:block">
            <div className="font-medium text-slate-900">{name}</div>
            <div className="text-xs text-slate-500">
              {roleLabel}
              {idLine ? ` · ${idLine}` : ""}
            </div>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
      <nav className="flex flex-wrap gap-4 border-t border-slate-100 px-4 py-2 sm:hidden">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center text-sm ${
              (link.badge ?? 0) > 0 ? "font-semibold text-red-600" : "text-slate-600"
            }`}
          >
            {link.label}
            <NavBadge count={link.badge ?? 0} />
          </Link>
        ))}
      </nav>
      <BuildBadge className="border-t border-slate-100 px-4 py-1" />
    </header>
  );
}