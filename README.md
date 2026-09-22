# Team Apex Portal

A student & instructor training folio for Apex Adventures / EPIC Aviation:
flight logbook, exercise-by-exercise progress with instructor sign-off,
section-gated progression, and online theory exams -- all built from the DTO
Procedures Manual.

This is **Phase 1** (training folio + exams) plus **Stage 1 of Phase 2**
(public sign-up for Students and Pilots, with an Admin/Office Manager
verification gate before an account goes live). The rest of Phase 2 -- the
full Pilot dashboard, licence-application document generation, and more --
is scoped in `team-apex-portal-sow.docx` but not built yet. See
[Roadmap](#roadmap--whats-not-here-yet) below.

## Stack, and why

- **Next.js 16** (App Router, Server Actions, TypeScript, Tailwind). Note:
  this Next.js release renamed `middleware.ts` → `proxy.ts` and changed a
  few other conventions — if you or another AI assistant adds code here later,
  don't assume training-data familiarity with "standard" Next.js covers this
  version; skim `node_modules/next/dist/docs/` first (an `AGENTS.md` in this
  repo says the same).
- **SQLite** (via Drizzle ORM + Node's built-in `node:sqlite`), one file at
  `data/apex-portal.db`. Chosen over Postgres for now because it's genuinely
  enough at this scale (one DTO, tens of students) and needs no separate
  database service to run or pay for. **Two other options were tried and
  dropped**, both for the same reason: Prisma's CLI needs to download Rust
  engine binaries from `binaries.prisma.sh`, and `better-sqlite3` needs a
  native binary compiled for your exact Node version (on a new-enough Node,
  or a restricted network, neither can complete) — both failed in practice
  during development. Node's own `node:sqlite` needs nothing external at
  all, at the cost of being labeled "experimental" by Node itself (it's been
  reliable in testing here; the API is what changes, not stability). See
  `src/db/node-sqlite-proxy.ts` for the small adapter that lets Drizzle talk
  to it. If the school outgrows SQLite, Drizzle supports Postgres with the
  same query code — swap `src/db/schema.ts` from `sqlite-core` to `pg-core`
  column types, swap `src/db/index.ts` for `drizzle-orm/node-postgres` (or
  similar), and point `DATABASE_URL` at a Postgres instance (e.g. Neon or
  Supabase).
- No `drizzle-kit studio` / GUI database browser is wired up, for the same
  binary-driver reason — `src/db/migrate.ts` runs migrations directly
  instead of via `drizzle-kit migrate`. To look inside the database, use any
  SQLite browser app (e.g. "DB Browser for SQLite") on `data/apex-portal.db`
  directly — it's a normal SQLite file.
- **Custom auth** (signed session cookies via `jose`, passwords hashed with
  `bcryptjs`) rather than NextAuth — NextAuth's Next-16-compatible release is
  still in beta and pulled in dependency conflicts. This follows the pattern
  Next's own docs recommend for a from-scratch setup (see
  `node_modules/next/dist/docs/01-app/02-guides/authentication.md`).

## Getting started

Run this from a plain local folder — **not** one synced by OneDrive, Google
Drive, Dropbox, etc. `npm install` writes tens of thousands of small files;
a sync client fighting with npm over them is a common source of failed or
frozen installs. Copying the project to e.g. `C:\dev\apex-portal` first is
worth doing even if it feels like an extra step — this is only your local
testing copy, not where the real thing ends up living (see "Deploying"
below for that).

```bash
npm install
cp .env.example .env        # then edit SESSION_SECRET (see below)
npm run db:migrate          # creates data/apex-portal.db
npm run db:seed             # seeds an instructor account, a demo student,
                             # and the syllabus (see below)
npm run dev
```

Open http://localhost:3000. The seed script prints login credentials for:

- **Instructor**: `riaan@epic-aviation.co.za` — change this email and the
  password immediately (there's no self-service password change page yet;
  edit the database directly with a SQLite browser app, or ask me to add a
  password-change page).
- **Demo student**: `demo.student@example.com` — delete this once you have
  real students, or leave it as a sandbox to click around in.
- **Demo Office Manager (Admin)**: `admin@epic-aviation.co.za` — reviews and
  approves/rejects new sign-ups at **Admin → Verification queue** (a CFI can
  do this too, from the same link in their own nav).

New students and pilots can also sign themselves up at `/signup` (linked
from the login page) instead of being added by the CFI. A sign-up sits as
**pending** until an Instructor/CFI or Admin approves it from the
verification queue -- they can't log in before that. Uploaded documents (ID
copies, CAA licences, profile pictures) are saved to `data/uploads/`, next
to `data/apex-portal.db` -- same "never in the zip, copy it forward when you
update" treatment, see Section 2 of `START-HERE.md`.

**Before deploying anywhere real**, generate a proper `SESSION_SECRET`
(`openssl rand -base64 32`) and put it in your production environment — the
one in `.env.example` is a placeholder and signs sessions with a secret
anyone can read on GitHub.

## The syllabus (sections & exercises)

The seed data groups DTO Manual **Appendix A**'s Exercises 1–18C into five
sections (Ground Handling & Basics → Core Flight Skills → Circuit, Landings
& First Solo → Advanced Handling → Navigation). **This grouping is my
proposed read of the manual, not something the manual itself specifies** —
it lists exercises flat, without sections. A student can't start a section
until every exercise in the previous one is signed off, so get this grouping
right (or adjust it) before real students start using it.

Adjust it any time from **Instructor → Manage syllabus**: rename sections,
reorder them, add/remove exercises. The seed only runs once against an empty
database, so re-running `npm run db:seed` won't reset your edits (it uses
`onConflictDoNothing` on the exercise `code`, and section names aren't
unique-constrained — if you need to start over, delete `data/apex-portal.db`
and re-run `db:migrate` + `db:seed`).

Theory topics (DTO Manual Appendix B/C — meteorology, air law, human
performance, etc.) aren't modeled yet; the folio currently tracks practical
exercises only, per Appendix A. Worth a follow-up if you want theory
sign-off tracked the same way.

## Shopify sync

Per the SOW, students register through Shopify and get tagged "Student".
That webhook receiver is built (`src/app/api/webhooks/shopify/customer/route.ts`)
but **not yet wired up in Shopify** — you'll need to:

1. Set `SHOPIFY_WEBHOOK_SECRET` in your environment to a secret you choose.
2. In Shopify Admin → Settings → Notifications → Webhooks, add a webhook:
   - Topic: `customers/update` (add `customers/create` too)
   - URL: `https://<your-domain>/api/webhooks/shopify/customer`
   - Format: JSON
   - Use the same secret as `SHOPIFY_WEBHOOK_SECRET`

When Shopify sends a customer tagged "Student", the portal creates an
invited account automatically. **There's no email sending configured**, so
nothing is emailed to the student yet — go to **Instructor → Students** and
click "Get invite link" next to their name to grab the link and send it
yourself (WhatsApp, email, whatever). Wiring up an actual email send (e.g.
via Resend) once this needs to run unattended is a small, contained
follow-up.

Until the webhook is configured, use **Instructor → Add student** to create
accounts manually — same invite-link flow either way.

## Deploying

This needs a host that keeps a persistent filesystem for the SQLite file —
serverless platforms (Vercel's default deploy) wipe the filesystem between
invocations, so **plain Vercel will not work as-is**. Options:

- **A small VPS or a host with a persistent volume** (e.g. Railway, Fly.io
  with a volume, or a $5 DigitalOcean droplet) — run `npm run build && npm start`,
  keep `data/` on the persistent volume, back it up periodically (it's one file).
- **Move to Postgres** (Neon, Supabase) and deploy anywhere including Vercel
  — see the stack note above; this is the path to take if the school scales
  past what a single SQLite file comfortably handles, or if you want
  Vercel's zero-maintenance hosting specifically.

Either way, set these environment variables in production:

| Variable | Purpose |
|---|---|
| `SESSION_SECRET` | Signs session cookies. Generate with `openssl rand -base64 32`. |
| `DATABASE_URL` | Path to the SQLite file (defaults to `./data/apex-portal.db`) or, after a Postgres migration, a connection string. |
| `SHOPIFY_WEBHOOK_SECRET` | Shared secret from the Shopify webhook config, above. |
| `NEXT_PUBLIC_APP_URL` | Your real domain, e.g. `https://portal.apexadventures.co.za` — used to build invite links. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Optional. Outbound email (currently just the decline-notification to a pilot). Unset = emails are silently skipped, nothing else is affected. See `.env.example` for a Gmail App Password walkthrough. |
| `SMTP_FROM` | Optional, defaults to `SMTP_USER`. |

## Roadmap / what's not here yet

- **Theory topic tracking** (Appendix B/C) — currently only practical
  exercises (Appendix A) are tracked.
- **Self-service password reset / change** — currently only the initial
  invite-link flow (and the sign-up form) sets a password.
- **Automatic email delivery** — invite links are still manual copy/send,
  and the new sign-up/verification flow has no outbound email either (no
  "your application was approved" notification yet, no 30-day SACAA-expiry
  reminders) — an open item in the Phase 2 SOW.
- **Multiple aircraft types / endorsement tracks** (HG, Tandem, Class A/B/C,
  Instructor grades) — the data model supports adding these (a `Section` /
  `Exercise` is generic), but only the core PPG ab-initio track (Exercises
  1–18C) is seeded, per our scoping conversation.
- **The rest of Phase 2** (see `team-apex-portal-sow.docx`) — Stage 1 (this
  build) covers the Admin role, sign-up, and verification gate only. Still
  to come: the full Pilot dashboard (progress tracker, logbook, printable
  records), the medical-declaration form, the personal document library, and
  licence-application document generation (CA 62-16 auto-populate, etc.).

## Project structure

```
src/
  db/
    schema.ts        Drizzle schema (users, students, sections, exercises,
                      progress, flight log entries)
    seed.ts           Seeds instructor + demo student + syllabus
  lib/
    auth/             Session cookies (session.ts) and the Data Access
                      Layer (dal.ts) that pages/actions use to check who's
                      signed in
    actions/          Server Actions (login, student CRUD, sign-off,
                      logbook, syllabus editing)
    progress.ts       Section-gating logic (single source of truth, used by
                      both instructor and student views)
    logbook.ts        Logbook queries/summaries
  app/
    login/            Login page
    accept-invite/[token]/   Where a student sets their password
    instructor/       Instructor dashboard, student folios, syllabus admin
    student/          Student dashboard, folio (read-only), logbook
    api/webhooks/shopify/customer/   Shopify "Student" tag webhook
  proxy.ts             Route protection (Next 16's replacement for middleware.ts)
```
