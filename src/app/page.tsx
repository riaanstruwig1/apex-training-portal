import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/dal";

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");
  // Every role's home base. Missing a role here sends that account to
  // /instructor, which then bounces non-staff straight back out -- a
  // same-tab redirect loop, not just a wrong landing page.
  if (session.role === "student") redirect("/student");
  if (session.role === "pilot") redirect("/pilot");
  if (session.role === "admin") redirect("/admin");
  redirect("/instructor"); // cfi, instructor
}
