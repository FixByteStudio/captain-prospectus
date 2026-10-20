import { WifiOffIcon } from "lucide-react";
import { Band, BandBrand } from "../Band";
import { copy } from "../copy/field";
import { Spinner } from "@/ui/spinner";
import { buttonVariants } from "@/ui/button-variants";

/**
 * What a cache-sourced admin sees on `/admin/*` (ADR-0037, R6). Entry chunk
 * only: it must render without the admin chunk, so it imports nothing from
 * `src/client/admin/`. Static copy, no link to the field side.
 */
export function AdminOfflineScreen({
  checking,
  onRetry,
}: {
  checking: boolean;
  onRetry: () => void;
}) {
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
          <h1 className="text-heading">{copy.adminOffline.title}</h1>
          <p className="text-muted-foreground">{copy.adminOffline.body}</p>
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
