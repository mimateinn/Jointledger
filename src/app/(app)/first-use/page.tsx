import { redirect } from "next/navigation";
import { getSessionUser } from "@/auth/session";
import { getCurrentMembership } from "@/lib/current-book";
import { FirstUseForm } from "./first-use-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "開始" };

export default async function FirstUsePage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  const membership = await getCurrentMembership(user);
  if (membership) {
    redirect("/overview");
  }
  return <FirstUseForm />;
}
