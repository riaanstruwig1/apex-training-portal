/**
 * A small profile-picture thumbnail, served through the same authenticated
 * /api/uploads/[userId]/[filename] route used for document links (owner +
 * cfi/admin/instructor can fetch it -- see that route's own comment). Falls
 * back to a plain initial-letter circle when there's no picture on file, so
 * callers don't need their own conditional.
 */
export default function Avatar({
  userId,
  filename,
  name,
  size = 40,
}: {
  userId: string;
  filename: string | null | undefined;
  name: string;
  size?: number;
}) {
  const dimension = `${size}px`;
  if (!filename) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-500"
        style={{ width: dimension, height: dimension, fontSize: size * 0.4 }}
      >
        {name.trim().charAt(0).toUpperCase() || "?"}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- served from our
    // own authenticated route, not a static/optimizable Next.js asset.
    <img
      src={`/api/uploads/${userId}/${filename}`}
      alt={`${name}'s profile picture`}
      width={size}
      height={size}
      className="shrink-0 rounded-full border border-slate-200 object-cover"
      style={{ width: dimension, height: dimension }}
    />
  );
}
