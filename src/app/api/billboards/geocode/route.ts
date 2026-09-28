import { failure } from "@/lib/api/respond";
import { searchPlaces } from "@/lib/billboards/geocode/search";
import { guardBillboardApi } from "@/lib/services/auth";

/** Finds places by name for the billboard form's location picker. */
export async function GET(request: Request): Promise<Response> {
  const denied = await guardBillboardApi("editBillboards");
  if (denied) return denied;

  const text = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (text.length < 3) return failure("Type at least three letters to search.", 400);
  if (text.length > 200) return failure("That search is too long.", 400);

  try {
    return Response.json({ ok: true, results: await searchPlaces(text) });
  } catch (error) {
    return failure(error, 502);
  }
}
