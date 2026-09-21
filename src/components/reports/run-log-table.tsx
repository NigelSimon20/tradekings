import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { formatTimestamp } from "@/lib/date/dates";
import { TRIGGER_LABELS } from "@/lib/domain/meta";
import type { RunLogEntry } from "@/lib/domain/types";

export function RunLogTable({ runs, timezone }: { runs: RunLogEntry[]; timezone: string }) {
  if (!runs.length) {
    return (
      <EmptyState
        title="No runs recorded yet"
        description="System checks and weekly report sends are logged here and in the Google Sheet."
      />
    );
  }

  return (
    <TableWrap>
      <Table>
        <THead>
          <Tr className="hover:bg-transparent">
            <Th>Run at</Th>
            <Th>Type</Th>
            <Th>Started</Th>
            <Th className="text-right">Rows</Th>
            <Th className="text-right">Emails</Th>
            <Th>Result</Th>
          </Tr>
        </THead>
        <TBody>
          {runs.map((run) => (
            <Tr key={run.id}>
              <Td className="whitespace-nowrap">{formatTimestamp(run.runAt, timezone)}</Td>
              <Td>{run.type === "weekly-report" ? "Weekly report" : "System check"}</Td>
              <Td>{TRIGGER_LABELS[run.trigger] ?? run.trigger}</Td>
              <Td className="numeric text-right">{run.rowsChecked}</Td>
              <Td className="numeric text-right">
                {run.type === "weekly-report" ? `${run.emailsSent}/${run.recipients}` : "—"}
              </Td>
              <Td>
                {run.errors.length ? (
                  <Badge tone="critical" title={run.errors.join(" | ")}>
                    {run.errors.length} error{run.errors.length === 1 ? "" : "s"}
                  </Badge>
                ) : (
                  <span className="text-slate-600">{run.note || "OK"}</span>
                )}
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </TableWrap>
  );
}
