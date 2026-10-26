import { WifiOffIcon } from "lucide-react";
import { Band, BandBrand } from "../Band";
import { copy } from "../copy/field";
import { Spinner } from "@/ui/spinner";
import { buttonVariants } from "@/ui/button-variants";

/**
 * What a cache-sourced admin sees on `/admin/*` (ADR-0037, R6), and what an
 * admin sees when the admin chunk fails to load. Entry chunk only: it must
 * render without the admin chunk, so it imports nothing from `src/client/admin/`.
 * Static copy, no link to the field side.
 *
 * `unreached` is for a browser that reports a network while `/api/me` failed;
 * a failed chunk load always reads `offline` (the online flag proves nothing).
 */
export function AdminOfflineScreen({
  checking,
  onRetry,
  variant = "offline",
  stillFailing = false,
}: {
  checking: boolean;
  onRetry: () => void;
  variant?: "offline" | "unreached";
  /** The last « Réessayer » failed too: say so, so the press is not silent. */
  stillFailing?: boolean;
}) {
  const words =
    variant === "unreached"
      ? {
          title: copy.adminOffline.unreached.title,
          body: copy.adminOffline.unreached.body,
          still: copy.adminOffline.unreached.stillUnreached,
        }
      : {
          title: copy.adminOffline.title,
          body: copy.adminOffline.body,
          still: copy.adminOffline.stillOffline,
        };
  return (
    <>
      <Band>
        <BandBrand />
      </Band>
      <main className="px-4 pt-6 pb-page">
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-12 text-center">
          <span className="bg-secondary text-muted-foreground flex size-16 items-center justify-center rounded-xl">
            <WifiOffIcon aria-hidden className="size-7" />
          </span>
          <h1 className="text-heading">{words.title}</h1>
          <p className="text-muted-foreground">{words.body}</p>
          {stillFailing && !checking && (
            <p role="status" className="text-muted-foreground">
              {words.still}
            </p>
          )}
          <button
            type="button"
            className={buttonVariants({ size: "touch" })}
            disabled={checking}
            aria-busy={checking}
            onClick={onRetry}
          >
            {checking && <Spinner aria-hidden />}
            {checking ? copy.adminOffline.checking : copy.adminOffline.retry}
          </button>
        </div>
      </main>
    </>
  );
}
