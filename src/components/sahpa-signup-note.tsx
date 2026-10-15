/** NOTE shown at student sign-up and on the SAHPA-number gate: how to join SAHPA. */
export const SAHPA_APPLY_URL = "https://members.sahpa.co.za/membership/application";

export default function SahpaSignupNote() {
  return (
    <div className="rounded-lg border-2 border-red-300 bg-red-50 p-4 text-sm text-slate-800">
      <p className="font-semibold text-red-800">NOTE: SAHPA membership is required</p>
      <p className="mt-1">
        As part of SA CAA Regulations, you need to complete the necessary documentation. We made it as simple as
        possible.
      </p>
      <p className="mt-2 font-semibold">Step 1:</p>
      <ul className="list-disc space-y-0.5 pl-5">
        <li>
          Log on to the SAHPA website,{" "}
          <a href="https://www.sahpa.co.za/" target="_blank" rel="noopener noreferrer" className="font-medium text-red-700 underline">
            https://www.sahpa.co.za/
          </a>
        </li>
        <li>Click on the &quot;Apply for membership&quot; tab</li>
        <li>Select &quot;Student member&quot; on the dropdown list</li>
        <li>
          <strong>DO NOT press &quot;Send Reference&quot;!</strong> Leave the Ref no out!
        </li>
        <li>Select Next and complete the application.</li>
      </ul>
      <p className="mt-2">
        Pay the <strong>R440</strong> sign-up fee.
      </p>
      <a
        href={SAHPA_APPLY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-block rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
      >
        Sign up with SAHPA &rarr;
      </a>
    </div>
  );
}
