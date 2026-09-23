import { guardApi } from "@/lib/services/auth";
import { failure } from "@/lib/api/respond";
import { contractsToCsv, csvFilename } from "@/lib/reports/csv";
import { loadSnapshot } from "@/lib/services/contracts";

/**
 * Downloads the database as CSV — the same export attached to the HR report.
 * `?history=1` includes superseded contract rows.
 */
export async function GET(request: Request): Promise<Response> {
  const denied = await guardApi("exportData");
  if (denied) return denied;

  try {
    const includeHistory = new URL(request.url).searchParams.get("history") === "1";
    const { contracts, latest, today } = await loadSnapshot();
    const rows = includeHistory ? contracts : latest;

    return new Response(contractsToCsv(rows), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${csvFilename("contract-database", today)}"`,
      },
    });
  } catch (error) {
    return failure(error);
  }
}
