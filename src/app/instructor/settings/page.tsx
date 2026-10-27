import { requireCFI } from "@/lib/auth/dal";
import { getRadioCallScript, getStudentNotice } from "@/lib/settings";
import RadioScriptForm from "./radio-script-form";
import NoticeForm from "./notice-form";
import BirthdayForm from "./birthday-form";
import GroupWishForm from "./group-wish-form";
import { fmtMinute, getBirthdaySettings, getTodaysGroupWishPlan, getUpcomingBirthdays } from "@/lib/birthdays";
import { isWhatsAppConfigured } from "@/lib/whatsapp";

export default async function InstructorSettingsPage() {
  await requireCFI();

  const [radioCallScript, studentNotice, birthday, upcoming, wishPlan] = await Promise.all([
    getRadioCallScript(),
    getStudentNotice(),
    getBirthdaySettings(),
    getUpcomingBirthdays(30),
    getTodaysGroupWishPlan(),
  ]);

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">
          Applies to every student -- not per-student.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold text-slate-900">
          Student portal notification bar
        </h2>
        <p className="mb-3 text-sm text-slate-500">
          A one-line orange banner shown just under the header on every student page. Add a
          message and, optionally, a renameable button linking to a document or a web address.
        </p>
        <NoticeForm initial={studentNotice} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Birthday WhatsApp</h2>
        <p className="mb-3 text-sm text-slate-500">
          Every day at 08:00 the Hub WhatsApps the number(s) below a list of students and pilots
          with a birthday <strong>today</strong> and <strong>tomorrow</strong> (name, age and cell
          number). Nothing is sent on days without birthdays. Uses the date of birth on each
          person&apos;s profile.
        </p>
        <BirthdayForm
          initialTo={birthday.to}
          initialEnabled={birthday.enabled}
          whatsappReady={isWhatsAppConfigured()}
        />
        <div className="mt-4 border-t border-slate-100 pt-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Birthdays in the next 30 days
          </h3>
          {upcoming.length === 0 ? (
            <p className="text-sm text-slate-500">None.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {upcoming.map((b) => (
                <li key={b.userId} className="flex flex-wrap justify-between gap-2 py-1.5">
                  <span>
                    <span className="font-medium text-slate-900">{b.name}</span>{" "}
                    <span className="text-slate-500">
                      ({b.role}){b.turns > 0 && b.turns < 120 ? ` turns ${b.turns}` : ""}
                    </span>
                  </span>
                  <span className={b.inDays <= 1 ? "font-semibold text-red-700" : "text-slate-600"}>
                    {b.inDays === 0 ? "Today" : b.inDays === 1 ? "Tomorrow" : b.dateLabel}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {birthday.lastSentOn && (
            <p className="mt-2 text-xs text-slate-400">Last daily check done: {birthday.lastSentOn}</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Birthday wish in the Team Apex WhatsApp group</h2>
        <p className="mb-3 text-sm text-slate-500">
          On a student&apos;s or pilot&apos;s birthday the Hub posts one wish in the group, at a different random time
          between 08:00 and 10:00 each day. One message per person (a few minutes apart if several share the day). The
          list above for today and tomorrow carries on as before. The Hub&apos;s WhatsApp number must be a member of the
          group.
        </p>
        <GroupWishForm
          initial={{
            chatId: wishPlan.settings.chatId,
            groupName: wishPlan.settings.groupName,
            enabled: wishPlan.settings.enabled,
            templates: wishPlan.settings.templates,
          }}
        />
        <div className="mt-4 border-t border-slate-100 pt-3 text-sm">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Today</h3>
          {wishPlan.items.length === 0 ? (
            <p className="text-slate-500">No birthdays today.</p>
          ) : (
            <ul className="space-y-1">
              {wishPlan.items.map((it) => (
                <li key={it.person.userId} className="text-slate-700">
                  <span className="font-medium">{it.person.name}</span> --{" "}
                  {it.sent ? "wish sent" : wishPlan.settings.enabled && wishPlan.settings.chatId ? `wish at ${fmtMinute(it.minute)}` : "not sent (group wish is off)"}
                  <span className="block text-xs text-slate-500">&ldquo;{it.text}&rdquo;</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold text-slate-900">
          Standard radio call
        </h2>
        <p className="mb-3 text-sm text-slate-500">
          The radio call every student is taught to make during training.
          Shown at the bottom of every student&apos;s Dashboard, Training folio
          and Logbook pages.
        </p>
        <RadioScriptForm initialValue={radioCallScript ?? ""} />
      </section>
    </div>
  );
}
