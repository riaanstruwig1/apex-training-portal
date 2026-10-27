"use client";

import { useActionState, useState } from "react";
import {
  loadWhatsAppGroups,
  sendGroupWishTest,
  updateGroupWishSettings,
  type BirthdaySettingsState,
  type GroupListState,
} from "@/lib/actions/birthdays";

/** Batch 82: birthday wish in the Team Apex WhatsApp group, on the day. */
export default function GroupWishForm({
  initial,
}: {
  initial: { chatId: string | null; groupName: string | null; enabled: boolean; templates: string[] };
}) {
  const [state, action, pending] = useActionState<BirthdaySettingsState, FormData>(updateGroupWishSettings, undefined);
  const [groupsState, loadAction, loading] = useActionState<GroupListState, FormData>(loadWhatsAppGroups, undefined);
  const [testState, testAction, testing] = useActionState<BirthdaySettingsState, FormData>(sendGroupWishTest, undefined);
  const [group, setGroup] = useState(initial.chatId ? `${initial.chatId}|${initial.groupName ?? ""}` : "");
  const wishes = [0, 1, 2, 3].map((i) => initial.templates[i] ?? "");

  const options = groupsState?.groups ?? [];
  const currentListed = options.some((g) => `${g.id}|${g.name}` === group);

  return (
    <div className="space-y-3">
      <form action={loadAction} className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
        >
          {loading ? "Loading groups..." : "Load my WhatsApp groups"}
        </button>
        {groupsState?.error && <span className="text-sm text-red-700">{groupsState.error}</span>}
        {groupsState?.groups && (
          <span className="text-xs text-slate-500">{groupsState.groups.length} group(s) found -- pick Team Apex below.</span>
        )}
      </form>

      <form action={action} className="space-y-3">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Group</span>
          <select
            name="group"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">-- no group chosen --</option>
            {group && !currentListed && (
              <option value={group}>{initial.groupName || initial.chatId} (saved)</option>
            )}
            {options.map((g) => (
              <option key={g.id} value={`${g.id}|${g.name}`}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="enabled" defaultChecked={initial.enabled} className="h-4 w-4" />
          Post a birthday wish in the group on each student&apos;s and pilot&apos;s birthday (random time 08:00-10:00)
        </label>
        <div className="space-y-2">
          <span className="block text-sm font-medium text-slate-700">
            Wishes (one is picked at random; <code className="rounded bg-slate-100 px-1">{"{name}"}</code> = first name or
            nickname)
          </span>
          {wishes.map((w, i) => (
            <textarea
              key={i}
              name={`wish${i + 1}`}
              defaultValue={w}
              rows={2}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder={`Wish ${i + 1} (optional)`}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {pending ? "Saving..." : "Save"}
          </button>
          <button
            type="submit"
            formAction={testAction}
            disabled={testing}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          >
            {testing ? "Sending..." : "Send a sample wish to me"}
          </button>
          {state?.saved && <span className="text-sm text-green-700">Saved.</span>}
          {state?.error && <span className="text-sm text-red-700">{state.error}</span>}
          {testState?.message && <span className="text-sm text-green-700">{testState.message}</span>}
          {testState?.error && <span className="text-sm text-red-700">{testState.error}</span>}
        </div>
      </form>
    </div>
  );
}
