# Team Apex Portal — Setup & Restart Guide

Keep this file. Every time you get a new zip from me, follow the
"Updating to a new version" section below — it covers everything
you need, in order, so you don't hit the errors we ran into today.

---

## 1. First time ever setting this up on a computer

Do this once, the very first time you unzip the app on a new
computer (or a new folder).

1. Unzip the file. You'll get a folder called `apex-portal`.
2. Open a terminal (Command Prompt) **inside that folder**.
   - Easiest way: in File Explorer, open the `apex-portal` folder,
     click in the address bar, type `cmd`, press Enter.
3. Install the app's dependencies:
   ```
   npm install
   ```
   This takes a minute or two. Wait for it to finish completely.
4. Create the `.env` file (this holds a private security key —
   it's never included in the zip, so you make it once per folder):
   ```
   echo SESSION_SECRET=8f3a1c9d2e7b4f6a0c5d8e1f3a7b9c2d4e6f8a0b1c3d5e7f9a1b3c5d7e9f0a2b > .env
   ```
5. Set up the database:
   ```
   npm run db:migrate
   npm run db:seed
   ```
6. Start the app:
   ```
   npm run dev
   ```
7. Open your browser to: http://localhost:3000/login

Login details (from the seed step):
- Instructor: `riaan@epic-aviation.co.za` / `ChangeMe123!`
- Demo student: `demo.student@example.com` / `DemoStudent123!`
- Demo Office Manager (Admin): `admin@epic-aviation.co.za` / `DemoAdmin123!`

---

## 2. Updating to a new version (every time I send you a new zip)

**Important:** your real data — every student you've added, every
logged flight, every sign-off, every uploaded document (ID copies,
CAA licences, profile pictures) — lives in the `data` folder,
inside your current `apex-portal` folder (the database file plus a
`data\uploads` folder). That folder is never included in the zip I
send you. If you skip Step 3 below, your new folder starts blank —
no real students, no uploaded documents, only the demo accounts.
So don't skip Step 3.

**Step 1 — Stop the old server properly.**
Click into the terminal window that's running `npm run dev` and
press `Ctrl + C`. Wait until you see the plain `C:\...>` prompt
again before doing anything else. Don't just close the window —
close it properly with Ctrl+C first, or a leftover process can
cause confusing errors later.

**Step 2 — Unzip the new version into a brand-new folder.**
Don't unzip on top of the old folder. Give the new folder a
different name so you always know which version you're running —
e.g. `apex-portal-v3`. (The zip itself is named with a version
number too — see the bottom of this file.)

**Step 3 — Copy over your `.env` file AND your database.**
From your OLD `apex-portal` folder, copy these two things into the
NEW folder:
- The `.env` file (sits in the main folder)
- The whole `data` folder (contains `apex-portal.db` — your real
  students and flights — and `data\uploads` — every document
  anyone has uploaded through sign-up)

If this is genuinely your first time ever running the app (no real
data yet), you can skip copying `data` — a fresh one will be
created for you instead.

**Step 4 — Open a terminal in the NEW folder and run, in order:**
```
npm install
npm run db:migrate
npm run dev
```
`npm install` picks up anything new the app needs. `npm run
db:migrate` safely updates your database to understand any new
features — it's smart enough to skip anything already applied, and
it never deletes your existing data, so it's always safe to run.

Don't run `npm run db:seed` here — that's only for a brand-new,
empty database (Section 1). Running it again is harmless (it won't
wipe anything), but it also won't bring back students who were only
ever in an old folder you didn't copy `data` from.

**Step 5 — Open http://localhost:3000/login in your browser.**
Use a normal (non-incognito) window if you can, so your browser
extensions don't inject noisy warnings into the dev console.

Log in with your own instructor account, same as always. If you
copied Step 3 correctly, every student you'd already added will
still be there.

---

## 3. Troubleshooting — what an error usually means

| What you see | What it means | Fix |
|---|---|---|
| `'next' is not recognized...` | You skipped `npm install` in this folder | Run `npm install` |
| `no such table: ...` | You skipped `npm run db:migrate` | Run `npm run db:migrate` |
| `SESSION_SECRET is missing or too short` | No `.env` file in this folder | Do step 4 in Section 1 |
| "Incorrect email or password" even though you're sure it's right | This folder's database has no accounts in it yet (a brand-new empty database) | If this is a fresh first-time setup, run `npm run db:seed`. If you were updating to a new version and forgot to copy your `data` folder over (Section 2, Step 3), stop the server, copy `data\apex-portal.db` from your old folder into this one, and restart |
| Red "Issues" badge, "hydration mismatch", mentions a browser extension | Harmless — a browser extension (password manager, ad blocker, etc.) touching the page. Doesn't affect the app. | Ignore it, or test in an incognito window with extensions off |
| "This page couldn't load — a server error occurred" | The dev server hit a real error | Check the terminal window running `npm run dev` — the actual error is printed there. Send me a screenshot of that. |

**Golden rule:** if anything looks broken and you're not sure why —
stop the server with Ctrl+C, wait for the prompt, then run
`npm run dev` again. A lot of weird behavior is just a server that
needs a clean restart.

---

Version: see the zip filename (e.g. `apex-training-portal-v1.zip`).
Each update I send you will bump that number, so you can always
tell which one you're running.
