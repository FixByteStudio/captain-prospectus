/**
 * The card that takes the next-stop card's place when every stop has a visit
 * today — docs/design.md › Next-stop card, « All done ». Carnet's sentence and
 * button arrive with entry 8 (#496).
 */
import { CheckIcon } from "lucide-react";
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
    </article>
  );
}
