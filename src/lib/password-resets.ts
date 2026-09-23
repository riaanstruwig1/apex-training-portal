import "server-only";
import { isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

export type PasswordResetRequest = {
  id: string;
  name: string;
  email: string;
  role: string;
  requestedAt: Date;
};

/** Queue backing /admin/password-resets (V22 rollout item 11, 23 Sep 2026)
 * -- same "list everything pending, oldest first" shape as
 * getPendingApplicants in src/lib/verification.ts. */
export async function getPasswordResetRequests(): Promise<PasswordResetRequest[]> {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      requestedAt: users.passwordResetRequestedAt,
    })
    .from(users)
    .where(isNotNull(users.passwordResetRequestedAt));

  return rows
    .filter((r) => r.requestedAt !== null)
    .map((r) => ({ ...r, requestedAt: r.requestedAt as Date }))
    .sort((a, b) => a.requestedAt.getTime() - b.requestedAt.getTime());
}

export async function countPasswordResetRequests(): Promise<number> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(isNotNull(users.passwordResetRequestedAt));
  return rows.length;
}
