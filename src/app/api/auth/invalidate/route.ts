import { redirect } from "next/navigation";
import { destroySession } from "@/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  await destroySession();
  redirect("/login");
}
