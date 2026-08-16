import { redirect } from "next/navigation";
import { getSessionUser } from "@/auth/session";
import { userCount } from "@/app/actions/auth";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "登入" };

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) {
    redirect("/");
  }
  const empty = (await userCount()) === 0;
  return <LoginForm emptySystem={empty} />;
}
