import { toast } from "sonner";
import { ApiError } from "../../api";
import { copy } from "../../copy";

/** A 409 `last_admin` has its own sentence; anything else leaves the screen as it was. */
export function failureToast(error: unknown) {
  toast.error(
    error instanceof ApiError && error.code === "last_admin"
      ? copy.agents.lastAdmin
      : copy.agents.toast.failed,
  );
}
