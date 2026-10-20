import { timingSafeEqual } from "node:crypto";
import { cronKey } from "@/lib/cron-key";
import { runDailyBirthdayCheck } from "@/lib/birthdays";

/** Called every few minutes by the scheduler in src/instrumentation-node.ts
 * (batch 78). Sends the daily birthday WhatsApp once a day at/after 08:00
 * SA time -- see lib/birthdays.ts. Not for browsers: needs the internal key. */
export async function POST(req: Request) {
  const expected = cronKey("birthdays");
  const given = req.headers.get("x-cron-key") ?? "";
  if (
    !expected ||
    given.length !== expected.length ||
    !timingSafeEqual(Buffer.from(given), Buffer.from(expected))
  ) {
    return Response.json({ error: "Not allowed" }, { status: 403 });
  }
  const result = await runDailyBirthdayCheck();
  if (result.status === "sent") {
    console.log(
      `[birthdays] sent to ${result.recipients} recipient(s), ${result.birthdays} birthday(s)` +
        (result.failures.length ? `; failures: ${result.failures.join("; ")}` : "")
    );
  }
  return Response.json(result);
}
