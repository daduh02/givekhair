import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveAdminReportScope } from "@/server/lib/reports";
import type { ReportsRole } from "@/server/lib/reports";

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function GET(
  _request: Request,
  { params }: { params: { exportLogId: string } }
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || !userId || !role || !["CHARITY_ADMIN", "FINANCE", "PLATFORM_ADMIN"].includes(role)) {
    return forbidden();
  }

  const scope = await resolveAdminReportScope({
    userId,
    role: role as ReportsRole,
  });

  const log = await db.reportExportLog.findUnique({
    where: { id: params.exportLogId },
    include: { artifact: true },
  });

  if (!log || !log.artifact) {
    return NextResponse.json({ error: "Export artifact not found." }, { status: 404 });
  }

  const allowed =
    role === "PLATFORM_ADMIN" ||
    role === "FINANCE" ||
    (log.charityId ? scope.scopedCharityIds.includes(log.charityId) : log.exportedById === userId);

  if (!allowed) {
    return forbidden();
  }

  const fileName = log.fileName ?? `report-export-${log.id}.csv`;

  return new NextResponse(log.artifact.content, {
    headers: {
      "Content-Type": log.contentType ?? "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "X-Export-Generated-At": log.createdAt.toISOString(),
      ...(log.checksumSha256 ? { "X-Export-SHA256": log.checksumSha256 } : {}),
    },
  });
}
