import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../ui/pagination";
import { cn } from "../lib/utils";
import { pageItems } from "./pagination";

/**
 * The shared 25-row pager (GH #175 primitives, extracted from Visites' own
 * `VisitsPager` for #179): "Précédent", page numbers with an ellipsis past a
 * handful, "Suivant". `labels` carries the caller's own French strings —
 * Visites and Prospects each read from their own `copy.ts` entry, sharing the
 * same shape. `className` is cn-merged onto the vendored `Pagination`'s own
 * `mx-auto`/`w-full`/`justify-center` — Visites centres it under a full-width
 * feed, Prospects sits it at the right of a range/pager row instead.
 */
export function Pager({
  page,
  total,
  onChange,
  labels,
  className,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
  labels: {
    previous: string;
    next: string;
    morePages: string;
    pageLabel: (page: number) => string;
    nav: string;
  };
  className?: string;
}) {
  return (
    <Pagination aria-label={labels.nav} className={cn(className)}>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            label={labels.previous}
            disabled={page <= 1}
            onClick={() => onChange(Math.max(1, page - 1))}
          />
        </PaginationItem>
        {pageItems(page, total).map((item, i) =>
          item === "ellipsis" ? (
            <PaginationItem key={`ellipsis-${i}`}>
              <PaginationEllipsis label={labels.morePages} />
            </PaginationItem>
          ) : (
            <PaginationItem key={item}>
              <PaginationLink
                isActive={item === page}
                aria-label={labels.pageLabel(item)}
                onClick={() => onChange(item)}
              >
                {item}
              </PaginationLink>
            </PaginationItem>
          ),
        )}
        <PaginationItem>
          <PaginationNext
            label={labels.next}
            disabled={page >= total}
            onClick={() => onChange(Math.min(total, page + 1))}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
