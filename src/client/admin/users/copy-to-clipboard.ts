import { toast } from "sonner";

/** Copies a one-time secret and says so; a refused clipboard is told apart from a copy. */
export async function copyToClipboard(value: string, said: { copied: string; copyFailed: string }) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    toast.error(said.copyFailed);
    return;
  }
  toast.success(said.copied);
}
