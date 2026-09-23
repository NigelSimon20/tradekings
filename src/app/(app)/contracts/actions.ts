"use server";

import { revalidatePath } from "next/cache";

import type { ContractFormState } from "@/lib/domain/form-state";
import { parseContractForm } from "@/lib/domain/schema";
import { can } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/services/auth";
import { createContract, updateContract } from "@/lib/services/contracts";

/**
 * Creates or updates a contract row. The same action serves both forms: a
 * hidden `id` field decides which path is taken.
 */
export async function saveContractAction(
  _previous: ContractFormState,
  formData: FormData,
): Promise<ContractFormState> {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "editContracts")) {
    return {
      status: "error",
      message: "Your account does not have permission to change contracts.",
      errors: {},
    };
  }

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
    // The sheet records who made the change, now that people sign in as
    // themselves rather than sharing one password.
    const actor = user.email || user.name;
    const saved = existingId
      ? await updateContract(existingId, parsed.values, actor)
      : await createContract(parsed.values, actor);

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
