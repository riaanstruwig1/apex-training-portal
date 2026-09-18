/**
 * Version/date info shown on the login screen and in the nav footer so
 * Riaan can glance at the live site and confirm it's running the latest
 * changes, without needing to check Railway or GitHub.
 *
 * VERSION is bumped by hand each time a batch of changes ships (matching
 * the v16/v17/v20-style numbering already used for the delivered zips).
 * DEPLOYED_AT is captured automatically the moment this server process
 * starts -- which happens on every deploy, since Railway restarts the
 * app each time -- so the date never needs manual updating.
 */

export const VERSION = "v21";

export const DEPLOYED_AT = new Date();

// Railway sets this automatically at build time; falls back to "local" for
// `npm run dev` on a laptop, where there's no Railway build to read it from.
export const COMMIT = process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? "local";