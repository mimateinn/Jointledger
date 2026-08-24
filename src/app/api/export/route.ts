import { NextResponse } from "next/server";
import { getSessionUser } from "@/auth/session";
import { createDrizzleStore } from "@/db/drizzle-store";
import { EXPORT_FILENAME, exportBookXlsx } from "@/import/book-export";
import { getCurrentMembership } from "@/lib/current-book";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return json(401, { error: "unauthorized" });
  }

  const membership = await getCurrentMembership(user);
  if (!membership) {
    return json(403, { error: "forbidden" });
  }

  const bytes = await exportBookXlsx(createDrizzleStore(), membership.book.id);
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${EXPORT_FILENAME}"`,
      "Cache-Control": "no-store",
    },
  });
}
