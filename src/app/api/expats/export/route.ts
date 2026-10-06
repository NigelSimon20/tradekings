import { failure } from "@/lib/api/respond";
import {
  filterActions,
  filterExpiries,
  filterPeople,
  parseActionFilters,
  parseExpiryFilters,
  parsePeopleFilters,
} from "@/lib/expats/filters";
import { xlsxResponse } from "@/lib/reports/xlsx";
import { guardExpatApi } from "@/lib/services/auth";
import { actionsWorkbook, expiriesWorkbook, loadExpats, peopleWorkbook } from "@/lib/services/expats";

/**
 * Excel downloads of the expat list, the master expiry view or the follow-ups,
 * with the same filters as the page — and with sensitive details left out
 * for anyone who may not see them.
 */
export async function GET(request: Request): Promise<Response> {
  const { user, denied } = await guardExpatApi("exportExpats");
  if (denied) return denied;

  const snapshot = await loadExpats(user);
  if (snapshot.error) return failure(snapshot.error, 503);
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams);
  const { today } = snapshot;

  switch (url.searchParams.get("list")) {
    case "expiries":
      return xlsxResponse(expiriesWorkbook(filterExpiries(snapshot.expiries, parseExpiryFilters(params), today)), `expat-expiries-${today}.xlsx`);
    case "actions": {
      const names = new Map(snapshot.people.map((row) => [row.expat.id, row.expat.fullName]));
      const nameOf = (id: string) => names.get(id) ?? id;
      return xlsxResponse(
        actionsWorkbook(filterActions(snapshot.actions, parseActionFilters(params), today, nameOf), nameOf),
        `expat-follow-ups-${today}.xlsx`,
      );
    }
    default:
      return xlsxResponse(peopleWorkbook(filterPeople(snapshot.people, parsePeopleFilters(params), today)), `expats-${today}.xlsx`);
  }
}
