import type { RuleSet } from "@/lib/config/rules";

/** The plain-English rules for one group of employees, as a bulleted list. */
export function RuleSummary({ ruleSet }: { ruleSet: RuleSet }) {
  return (
    <ul className="space-y-2 text-sm text-slate-600">
      {ruleSet.summary.map((rule) => (
        <li key={rule} className="flex gap-2">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-600" aria-hidden />
          {rule}
        </li>
      ))}
    </ul>
  );
}
