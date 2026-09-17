import AcceptInviteForm from "./accept-invite-form";

export default async function AcceptInvitePage(
  props: PageProps<"/accept-invite/[token]">
) {
  const { token } = await props.params;

  return (
    <main className="flex min-h-screen flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Welcome to Apex
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Set a password to activate your account
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <AcceptInviteForm token={token} />
        </div>
      </div>
    </main>
  );
}
