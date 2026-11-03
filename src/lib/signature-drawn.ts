import "server-only";

/** Batch 90: turns the signature pad's PNG data URL (form field
 * `signatureDrawn`) into a File, so it is saved exactly like an uploaded
 * signature image. Null when nothing was drawn or the data isn't a PNG. */
export function drawnSignatureFile(raw: FormDataEntryValue | null): File | null {
  const s = typeof raw === "string" ? raw : "";
  const m = s.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return null;
  const bytes = Buffer.from(m[1], "base64");
  if (bytes.length < 100 || bytes.length > 2 * 1024 * 1024) return null;
  if (bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return null; // PNG signature
  return new File([new Uint8Array(bytes)], "signature.png", { type: "image/png" });
}
