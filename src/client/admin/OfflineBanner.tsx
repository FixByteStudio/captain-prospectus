import { WifiOffIcon } from "lucide-react";
import { copy } from "../copy";
import { Alert, AlertTitle } from "../ui/alert";

/**
 * The admin shell's offline banner (GH #209, EXPERIENCE.md § State Patterns
 * "Offline · Admin"): one full-width Alert in the update-prompt's slot,
 * shown by `AdminLayout` in place of `updatePrompt` while `useOnline()` is
 * false — they never both apply, since a build cannot be fetched offline.
 * No retry button: the visits feeds' 15 s poll and TanStack's
 * refetch-on-reconnect bring every query current again once `online` fires.
 *
 * `AdminLayout` wraps this in an always-mounted `aria-live="polite"` region
 * (EXPERIENCE.md:216) — a region has to exist *before* the sentence lands in
 * it for most screen readers to announce it, so the live role lives one
 * level up and this Alert carries none of its own (`role="none"`), leaving
 * exactly one live region rather than two nested ones.
 */
export function OfflineBanner() {
  return (
    <Alert role="none" className="bg-secondary rounded-none border-x-0 border-t-0">
      <WifiOffIcon />
      {/* Alert's line-clamp-1 default would cut this sentence on a phone. */}
      <AlertTitle className="line-clamp-none">{copy.offline.banner}</AlertTitle>
    </Alert>
  );
}
