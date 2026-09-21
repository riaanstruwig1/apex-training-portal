"use client";

/** Triggers the browser's own print dialog -- the printable portfolio pages
 * (Notes4 item 22) rely on print CSS (globals.css) rather than a generated
 * file, so "printing" just means asking the browser to do it. Saving as PDF
 * is whatever the browser's print dialog already offers (every browser's
 * print dialog has a "Save as PDF" destination), so no separate download
 * flow is needed. */
export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print-hide rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
    >
      Print / save as PDF
    </button>
  );
}
