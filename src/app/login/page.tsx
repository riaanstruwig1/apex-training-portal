import Link from "next/link";
import Image from "next/image";
import LoginForm from "./login-form";
import { BuildBadge } from "@/components/build-badge";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Image
            src="/apex-logo.png"
            alt="Apex Adventures"
            width={1095}
            height={1028}
            priority
            className="mx-auto h-20 w-auto sm:h-24"
          />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
            Team Apex Portal
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Sign in to your instructor, student or pilot account
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <LoginForm />
        </div>
        <p className="mt-4 text-center text-sm text-slate-500">
          New student or pilot?{" "}
          <Link href="/signup" className="font-medium text-red-600 hover:text-red-700">
            Sign up
          </Link>
        </p>
        <BuildBadge className="mt-6" />
      </div>
    </main>
  );
}