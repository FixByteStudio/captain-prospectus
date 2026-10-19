/**
 * The card that takes the next-stop card's place when every stop has a visit
 * today — docs/design.md › Next-stop card, « All done ». It points to Carnet,
 * where the visited stops went: a muted line when there were stops, and the
 * button in both states.
 */
import { CheckIcon } from "lucide-react";
import { Link } from "react-router";
import { buttonVariants } from "@/ui/button-variants";
import { copy } from "../copy/field";

export function AllDoneCard({ total }: { total: number }) {
  return (
    <article className="bg-card border-border flex flex-col items-center rounded-xl border p-6 text-center">
      <span className="bg-tint-success text-success flex size-14 items-center justify-center rounded-full">
        <CheckIcon aria-hidden="true" className="size-7" />
      </span>
      <p className="mt-3 text-base font-semibold">
        {total === 0 ? copy.today.nothingLeft : copy.today.allDone}
      </p>
      {total > 0 && (
        <p className="text-muted-foreground mt-1 text-base">{copy.today.findInCarnet}</p>
      )}
      <Link
        to="/round/logbook"
        className={buttonVariants({ variant: "secondary", size: "touch", className: "mt-4" })}
      >
        {copy.today.openCarnet}
      </Link>
    </article>
  );
}
