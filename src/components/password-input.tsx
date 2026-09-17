"use client";

import { useState } from "react";

/** A password <input> with a show/hide toggle button, so someone can check
 * what they typed before submitting. Accepts every normal <input> prop
 * (id, name, value/onChange, required, minLength, autoComplete, className,
 * ...) and passes them straight through -- works as a controlled input
 * (signup form) or an uncontrolled one (login, accept-invite). */
export default function PasswordInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={`${className ?? ""} pr-10`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        // Keep this out of the form's own Tab order -- it's a convenience
        // toggle, not a field to fill in.
        tabIndex={-1}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
      >
        {visible ? (
          // Eye with a slash -- click to hide.
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
            <path
              d="M3 3l14 14M9.35 9.35a2 2 0 002.72 2.72M6.6 6.7C4.7 7.9 3.3 9.6 2.5 10c1.4 2.6 4.4 5.5 7.5 5.5 1.2 0 2.4-.4 3.5-1.1M9 4.6c.3 0 .7-.1 1-.1 3.1 0 6.1 2.9 7.5 5.5-.4.7-1 1.6-1.7 2.4"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          // Plain eye -- click to show.
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
            <path
              d="M2.5 10S5.5 4.5 10 4.5 17.5 10 17.5 10 14.5 15.5 10 15.5 2.5 10 2.5 10z"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <circle cx="10" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        )}
      </button>
    </div>
  );
}
