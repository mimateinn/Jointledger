export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/auth/session";
import { AppChrome } from "@/components/app-chrome";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  return <AppChrome displayName={user.displayName}>{children}</AppChrome>;
}
