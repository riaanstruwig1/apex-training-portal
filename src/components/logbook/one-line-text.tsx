"use client";

import { useState } from "react";

/**
 * 19 Oct 2026 (Riaan: "collapse the comments to one line, with the option to
 * hover over it to see the rest -- the logbook looks too big on screen").
 * Shows long logbook text (comments, flight tasks / exercises) on one line,
 * cut off with "...". Hovering shows the full text; clicking (or tapping on
 * a phone, where there's no hover) opens it in full, click again to fold.
 */
export default function OneLineText({
  text,
  quoted = false,
  className = "",
}: {
  text: string | null | undefined;
  quoted?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  const shown = quoted ? `“${text}”` : text;
  return (
    <button
      type="button"
      title={open ? "Click to fold" : text}
      onClick={() => setOpen((o) => !o)}
      className={`block max-w-[14rem] cursor-pointer text-left ${
        open ? "whitespace-pre-wrap break-words" : "truncate"
      } ${className}`}
    >
      {shown}
    </button>
  );
}
