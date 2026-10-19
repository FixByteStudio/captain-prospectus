/**
 * The field avatar and the account card it opens (GH #561, docs/design.md ›
 * Account card). The card is a native `popover="auto"`: light dismiss, Escape
 * and a second tap on the avatar close it with no JS, and no Radix menu ships
 * to the phone (ADR-0015). It is a labelled region, not `role="menu"`: it holds
 * radios and has no roving focus.
 *
 * It is `position: fixed` against the band rather than anchored to the avatar:
 * the avatar is always the last item of the band's row, at the right edge, and
 * CSS anchor positioning needs iOS 26.
 */
import { useId, useRef, useState } from "react";
import { LayoutGridIcon, MonitorIcon, MoonIcon, SunIcon, type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router";
import { copy } from "../copy/field";
import { initials } from "../format";
import { cn } from "../lib/utils";
import { applyThemeChoice, themeChoice, type ThemeChoice } from "../theme";
import { BUILD } from "../version";
import type { MeResponse } from "../../shared/schemas";
import { buttonVariants } from "@/ui/button-variants";
import { FieldRadioGroup, FieldRadioOption } from "@/ui/field-controls";
import { useLeaveGuard } from "./leave-guard";

const CHOICES: readonly { choice: ThemeChoice; label: string; icon: LucideIcon }[] = [
  { choice: "system", label: copy.accountCard.theme.system, icon: MonitorIcon },
  { choice: "light", label: copy.accountCard.theme.light, icon: SunIcon },
  { choice: "dark", label: copy.accountCard.theme.dark, icon: MoonIcon },
];

/** What the page shows now: read from `<html data-theme>` so the radios agree with it even when storage is blocked. */
const currentChoice = () => themeChoice(document.documentElement.dataset.theme);

/** A wrap point before « @ », so a long address breaks there rather than mid-word. */
function Email({ email }: { email: string }) {
  const at = email.indexOf("@");
  if (at < 0) return <>{email}</>;
  // Inline-blocks: a hyphen in the domain would otherwise be a later, preferred
  // break; each half still wraps inside itself if it alone outgrows the card.
  return (
    <>
      <span className="inline-block max-w-full">{email.slice(0, at)}</span>
      <wbr />
      <span className="inline-block max-w-full">{email.slice(at)}</span>
    </>
  );
}

function Divider() {
  return <hr className="bg-border -mx-1.5 my-1 h-px border-0" />;
}

export function AccountMenu({
  email,
  role,
  adminOnline,
}: {
  email: string;
  role: MeResponse["role"];
  /** `adminAccess(...).entry`: the dashboard is useless without the network. */
  adminOnline: boolean;
}) {
  const cardId = useId();
  const emailId = useId();
  const card = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { leave } = useLeaveGuard();
  const [choice, setChoice] = useState<ThemeChoice>(currentChoice);

  const pick = (next: ThemeChoice) => {
    applyThemeChoice(next, document.documentElement);
    setChoice(next);
  };

  const openDashboard = () => {
    // Closed first, so the leave dialog never opens under a light-dismiss layer.
    // Optional: happy-dom has no Popover API (the tests keep the card in the DOM).
    card.current?.hidePopover?.();
    leave(() => navigate("/admin"));
  };

  return (
    <>
      {/* 48px target around the 32px disc; -mr-2 keeps the disc on the band's
          16px margin. */}
      <button
        type="button"
        popoverTarget={cardId}
        aria-label={copy.nav.avatar(email)}
        className="focus-visible:ring-ring/50 -mr-2 flex size-touch shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-[3px]"
      >
        <span
          aria-hidden
          className="bg-primary text-primary-foreground ring-primary-edge flex size-8 items-center justify-center rounded-full text-xs font-bold ring-1 ring-inset"
        >
          {initials(email)}
        </span>
      </button>

      {/* No display utility on the card: the UA hides a closed popover with
          `display: none`, and any `flex`/`grid` here would show it. */}
      <div
        ref={card}
        id={cardId}
        popover="auto"
        role="region"
        aria-labelledby={emailId}
        onToggle={() => setChoice(currentChoice())}
        className={cn(
          "bg-popover text-popover-foreground border-border rounded-lg border p-1.5 shadow-md",
          "fixed inset-auto m-0 overflow-visible",
          "right-3 top-[calc(env(safe-area-inset-top,0px)+var(--spacing-band-height)+--spacing(1))]",
          "w-max max-w-[calc(100vw-24px)] min-w-52",
        )}
      >
        <p id={emailId} className="px-2.5 pt-2 text-xs font-semibold break-words">
          <Email email={email} />
        </p>
        <p className="text-muted-foreground px-2.5 pt-0.5 pb-2 text-xs">
          {copy.accountCard.role[role]}
        </p>
        <Divider />

        {adminOnline && (
          <>
            <button
              type="button"
              onClick={openDashboard}
              className={cn(
                buttonVariants({ variant: "ghost", size: "touch" }),
                "text-label my-0.5 w-full justify-start gap-2 px-2.5",
              )}
            >
              <LayoutGridIcon aria-hidden className="size-4" />
              {copy.accountCard.dashboard}
            </button>
            <Divider />
          </>
        )}

        <p className="text-overline text-muted-foreground px-2.5 pt-2 pb-1.5 uppercase">
          {copy.accountCard.appearance}
        </p>
        <FieldRadioGroup label={copy.accountCard.appearance} className="flex px-2.5 pb-2">
          {CHOICES.map(({ choice: value, label, icon: Icon }) => (
            <FieldRadioOption
              key={value}
              name={`${cardId}-theme`}
              value={value}
              checked={choice === value}
              onSelect={() => pick(value)}
              aria-label={label}
              className="size-12 justify-center gap-0 px-0"
            >
              <Icon aria-hidden className="size-4" />
            </FieldRadioOption>
          ))}
        </FieldRadioGroup>
        <Divider />

        <p className="text-meta text-muted-foreground px-2.5 pt-2 pb-1.5">
          {copy.accountCard.version(BUILD)}
        </p>
      </div>
    </>
  );
}
