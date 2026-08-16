import { redirect } from "next/navigation";
import { clearStaleSession } from "@/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await clearStaleSession();
  redirect(result === "cleared" ? "/login" : "/");
}
