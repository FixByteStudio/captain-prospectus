/**
 * "Sans votre position…" with « Réessayer » — docs/design.md, "Next-stop
 * card" and "Carte". One line for both screens; each caller keeps its own
 * placement (under the header on Tournée, a card over the map on Carte).
 */
import { copy } from "../copy";

export function PositionDenied({
  onRetry,
  className,
}: {
  onRetry: () => void;
  className?: string;
}) {
  return (
    <p className={className}>
      {copy.today.positionDenied}{" "}
      <button type="button" onClick={onRetry} className="text-foreground underline">
        {copy.today.retryPosition}
      </button>
    </p>
  );
}
