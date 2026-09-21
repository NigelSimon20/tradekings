"use server";

import { revalidatePath } from "next/cache";

import type { ContractFormState } from "@/lib/domain/form-state";
import { parseContractForm } from "@/lib/domain/schema";
import { createContract, updateContract } from "@/lib/services/contracts";

/**
 * Creates or updates a contract row. The same action serves both forms: a
 * hidden `id` field decides which path is taken.
 */
export async function saveContractAction(
  _previous: ContractFormState,
  formData: FormData,
): Promise<ContractFormState> {
  const parsed = parseContractForm(formData);

  if (!parsed.ok || !parsed.values) {
    return {
      status: "error",
      message: "Check the highlighted fields and try again.",
      errors: parsed.errors,
    };
  }

  const existingId = String(formData.get("id") ?? "").trim();

  try {
    const saved = existingId
      ? await updateContract(existingId, parsed.values)
      : await createContract(parsed.values);

    revalidatePath("/", "layout");

    return {
      status: "success",
      message: existingId
        ? "Contract updated. The calculated fields have been refreshed."
        : `Contract ${saved.id} created.`,
      errors: {},
      contractId: saved.id,
    };
  } catch (error) {
    return {
      status: "error",
      message: (error as Error).message,
      errors: {},
    };
  }
}
