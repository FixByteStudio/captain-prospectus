import type { ReactNode } from "react";
import { Link } from "react-router";
import { Building2Icon, SearchXIcon } from "lucide-react";
import { copy } from "../../copy";
import { Button } from "../../ui/button";

/**
 * The two empty states — docs/design.md › Prospects: an icon tile, a title,
 * one sentence and one button. A search that matched nothing names the search
 * in its sentence, since `q` folds ASCII case only and a missing accent is the
 * likely cause (docs/api.md).
 */
export function EmptyState({
  filtered,
  q,
  onClear,
}: {
  filtered: boolean;
  q?: string;
  onClear: () => void;
}) {
  if (!filtered) {
    return (
      <Tile icon={<Building2Icon aria-hidden="true" />}>
        <p className="text-foreground font-medium">{copy.prospects.empty}</p>
        <Button asChild size="sm">
          <Link to="/admin/import">{copy.prospects.importCta}</Link>
        </Button>
      </Tile>
    );
  }

  return (
    <Tile icon={<SearchXIcon aria-hidden="true" />}>
      <p className="text-foreground font-medium">{copy.prospects.noMatch}</p>
      <p>{q ? copy.prospects.noMatchSearch(q) : copy.prospects.noMatchFilters}</p>
      <Button variant="outline" size="sm" onClick={onClear}>
        {copy.prospects.clearFilters}
      </Button>
    </Tile>
  );
}

function Tile({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="text-muted-foreground flex flex-col items-start gap-3 px-3.5 py-10">
      <span className="bg-secondary grid size-10 place-items-center rounded-lg">{icon}</span>
      {children}
    </div>
  );
}
