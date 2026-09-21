import { notFound } from "next/navigation";

import { ContractForm, type ContractFormDefaults } from "@/components/contracts/contract-form";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { RULE_SETS } from "@/lib/config/rules";
import { formatDate } from "@/lib/date/dates";
import { getConfig } from "@/lib/config/env";
import { todayIn } from "@/lib/date/dates";
import { defaultEndDate, renewalStartDate } from "@/lib/rules/terms";
import { getContractById } from "@/lib/services/contracts";

export const dynamic = "force-dynamic";

/**
 * Captures a new contract. With `?renewFrom=<contract id>` the form opens as a
 * renewal: the employee details carry over and the dates follow on from the
 * contract being renewed.
 */
export default async function NewContractPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const renewFrom = typeof params.renewFrom === "string" ? params.renewFrom : "";
  const config = getConfig();
  const today = todayIn(config.timezone);

  let limitWarning: string | null = null;
  let defaults: ContractFormDefaults = {
    company: "Trade Kings",
    workerType: "Blue Collar",
    contractType: "New",
    renewalStatus: "Pending",
    startDate: today,
    endDate: defaultEndDate("Trade Kings", "Blue Collar", today),
  };

  if (renewFrom) {
    const previous = await getContractById(renewFrom);
    if (!previous) notFound();

    const startDate = renewalStartDate(previous.endDate ?? today) || today;
    const ruleSet = RULE_SETS[previous.computed.ruleSetId];

    // Renewing past a contract limit, or inside the casual waiting period, is a
    // decision HR should make deliberately — so it is said plainly up front.
    if (previous.computed.limitStatus === "LIMIT_REACHED" || previous.computed.limitStatus === "LIMIT_EXCEEDED") {
      limitWarning =
        previous.computed.rehireStatus === "NOT_ELIGIBLE" && previous.computed.rehireEligibleDate
          ? `${previous.employeeName} has completed ${previous.computed.contractCount} of the ${ruleSet.maxContracts} casual contracts allowed. The next eligible rehire date is ${formatDate(previous.computed.rehireEligibleDate)}.`
          : `${previous.employeeName} is on contract ${previous.computed.contractCount} of the ${ruleSet.maxContracts} allowed under the ${ruleSet.label} rules. A further fixed-term renewal goes beyond the limit.`;
    } else if (previous.computed.limitStatus === "APPROACHING_LIMIT") {
      limitWarning = `This will be contract ${previous.computed.contractCount + 1} of the ${ruleSet.maxContracts} allowed for ${previous.employeeName}.`;
    }
    defaults = {
      ...previous,
      id: undefined,
      contractType: previous.computed.rehireStatus === "ELIGIBLE" ? "Rehire" : "Renewal",
      contractNumber: null,
      renewalStatus: "Pending",
      notes: "",
      startDate,
      endDate: defaultEndDate(previous.company, previous.workerType, startDate),
    };
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={renewFrom ? "Renew contract" : "Add contract"}
        description={
          renewFrom
            ? "The employee details carry over. Check the dates before saving."
            : "Capturing a contract here writes a new row to the contract database."
        }
      />
      {limitWarning ? (
        <Alert
          tone={limitWarning.includes("beyond the limit") || limitWarning.includes("rehire date") ? "critical" : "warning"}
          title="Contract limit"
        >
          {limitWarning}
        </Alert>
      ) : null}

      <ContractForm defaults={defaults} mode="create" />
    </div>
  );
}
