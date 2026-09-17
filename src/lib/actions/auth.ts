"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as z from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, deleteSession } from "@/lib/auth/session";

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email({ error: "Enter a valid email address." }),
  password: z.string().min(1, { error: "Enter your password." }),
});

export type LoginState =
  | { error: string }
  | undefined;

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { email, password } = parsed.data;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Same generic error whether the email doesn't exist or the password is
  // wrong -- don't leak which one it was.
  if (!user || !user.passwordHash) {
    return { error: "Incorrect email or password." };
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    return { error: "Incorrect email or password." };
  }

  if (user.accountStatus === "pending_verification") {
    return {
      error:
        "Your application is still pending verification by an instructor or admin. You'll be able to log in once it's approved.",
    };
  }
  if (user.accountStatus === "rejected") {
    return {
      error:
        "This application wasn't approved. Contact Apex Adventures if you think that's wrong.",
    };
  }
  if (user.accountStatus === "suspended") {
    return { error: "This account is suspended. Contact Apex Adventures." };
  }

  await createSession(
    user.id,
    user.role as "cfi" | "instructor" | "student" | "pilot" | "admin"
  );

  redirect(
    user.role === "student"
      ? "/student"
      : user.role === "pilot"
        ? "/pilot"
        : user.role === "admin"
          ? "/admin"
          : "/instructor"
  );
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
