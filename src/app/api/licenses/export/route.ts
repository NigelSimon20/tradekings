import { failure } from "@/lib/api/respond";
import { csvFilename } from "@/lib/reports/csv";
import { filterLicenses, parseLicenseFilters, sortLicensesByUrgency } from "@/lib/licenses/filters";
import { guardLicenseApi } from "@/lib/services/auth";
import { licensesToCsv, loadLicenses } from "@/lib/services/licenses";

/** The license register as CSV, with the same filters as the register page. */
export async function GET(request: Request): Promise<Response> {
  const denied = await guardLicenseApi("exportLicenses");
  if (denied) return denied;

  const { licenses, today, error } = await loadLicenses();
  if (error) return failure(error, 503);
  const filters = parseLicenseFilters(Object.fromEntries(new URL(request.url).searchParams));
  const rows = sortLicensesByUrgency(filterLicenses(licenses, filters));

  return new Response(licensesToCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${csvFilename("license-register", today)}"`,
      "cache-control": "no-store, no-cache, must-revalidate, private",
    },
  });
}
