import { clsx } from "clsx";
import type { ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// twMerge's default font-size group doesn't know app.css's --text-* tokens
// (display/brand/title/heading/body-field/body/label/meta/overline), so it reads
// `text-meta` beside `text-success` as two colours and drops one (GH #136).
// Registering them as their own font-size group lets a size token and a
// colour coexist, while `extend` (not `override`) keeps Tailwind's own
// `xs…9xl` scale merging as before. That new group also conflicts with
// Tailwind's own `leading-*` group, so a `--text-*` token must not follow a
// `leading-` class in the same merge or it drops it (utils.test.ts pins this).
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display",
            "brand",
            "title",
            "heading",
            "body-field",
            "body",
            "label",
            "meta",
            "overline",
          ],
        },
      ],
    },
  },
});

/** Merges conditional class lists and resolves conflicting Tailwind utilities.
 *  Every vendored shadcn component expects this name at this path. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
