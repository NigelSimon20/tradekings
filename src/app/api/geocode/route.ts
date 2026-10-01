import { failure } from "@/lib/api/respond";
import { searchPlaces } from "@/lib/billboards/geocode/search";
import { canBillboards, canLicenses } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/services/auth";

/**
 * Finds places by name for the location picker — on billboards and on license
 * assets, so anyone who can place either may search.
 */
export async function GET(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return failure("Not signed in.", 401);
  if (!canBillboards(user, "editBillboards") && !canLicenses(user, "manageAssets")) {
    return failure("Your account does not have permission to do that.", 403);
  }

  const text = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (text.length < 3) return failure("Type at least three letters to search.", 400);
  if (text.length > 200) return failure("That search is too long.", 400);

  try {
    return Response.json({ ok: true, results: await searchPlaces(text) });
  } catch (error) {
    return failure(error, 502);
  }
}
