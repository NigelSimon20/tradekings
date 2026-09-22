"use server";

import { revalidatePath } from "next/cache";

import { getRepository } from "@/lib/data";
import type { SheetSetupResult } from "@/lib/data/sheet-setup";

export interface SetupState {
  status: "idle" | "done" | "error";
  messages: string[];
}

/**
 * Prepares the Google Sheet from the app, so setting up does not need a
 * developer with a terminal. It only ever adds what is missing.
 */
export async function setUpSheetAction(): Promise<SetupState> {
  try {
    const result: SheetSetupResult = await getRepository().setUpStorage();
    revalidatePath("/", "layout");
    return { status: result.ok ? "done" : "error", messages: result.messages };
  } catch (error) {
    return { status: "error", messages: [(error as Error).message] };
  }
}
