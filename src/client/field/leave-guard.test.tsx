/**
 * The leave guard, context half and pure half both (GH #83, widened for
 * spec-gh-74).
 *
 * `shouldAsk` used to be covered without a DOM, in `leave-guard.test.ts`. It
 * moved here (and that file was deleted) once `leave-guard.tsx` started
 * rendering the AlertDialog itself: the module now pulls in the vendored
 * `@/ui/alert-dialog`, which the "unit" vitest project has neither the `@`
 * alias nor a DOM for, so importing anything from `./leave-guard` — even just
 * `shouldAsk` — has to happen from the "dom" project instead (`.test.tsx`,
 * `vitest.config.ts`).
 *
 * The rest of the plumbing — `LeaveGuardProvider`, `useRegisterDirty`'s two
 * effects, and `leave` — was reachable only through JSX and so untested, as
 * the module's own header used to say (GH #66 review deferral). Deleting
 * either effect body, or `leave`'s dirty check, left the guard permanently
 * clean (or permanently silent) and CI green; it does not any more.
 *
 * `VisitScreen` and `AddProspectScreen` are lazy, Dexie-backed and form-heavy,
 * so the contract is tested here against a minimal component and the two real
 * call sites are pinned by a source assertion at the bottom of this file.
 */
import { readFileSync } from "node:fs";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { copy } from "../copy";
import { LeaveGuardProvider, shouldAsk, useLeaveGuard, useRegisterDirty } from "./leave-guard";

describe("shouldAsk", () => {
  // I/O matrix, spec-gh-66.
  it("asks when the form is dirty and the tap goes elsewhere", () => {
    expect(shouldAsk({ dirty: true, to: "/tournee", current: "/tournee/abc123" })).toBe(true);
  });

  it("navigates straight away when the form is untouched", () => {
    expect(shouldAsk({ dirty: false, to: "/tournee", current: "/tournee/nouveau" })).toBe(false);
  });

  it("never asks when the tap is already the current tab, dirty or not", () => {
    expect(shouldAsk({ dirty: true, to: "/tournee", current: "/tournee" })).toBe(false);
    expect(shouldAsk({ dirty: false, to: "/tournee", current: "/tournee" })).toBe(false);
  });

  it("never asks on a tab that reads as current under isCurrentTab's subtree rule", () => {
    // Ajouter draws as current on a nested add route too (tabs.test.ts), so
    // tapping it there must not open the dialog even though the pathname
    // itself isn't the exact string "/tournee/nouveau".
    expect(shouldAsk({ dirty: true, to: "/tournee/nouveau", current: "/tournee/nouveau/" })).toBe(
      false,
    );
  });
});

/** Reports what `FieldTabs` would read off the context on a tab tap. */
function GuardState() {
  return <p data-testid="dirty">{String(useLeaveGuard().dirty)}</p>;
}

/** The contract every field form signs: one `useRegisterDirty` call, fed by
 * `formState.isDirty`. */
function Form({ isDirty }: { isDirty: boolean }) {
  useRegisterDirty(isDirty);
  return null;
}

function Screen() {
  const [mounted, setMounted] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  return (
    <LeaveGuardProvider>
      {mounted && <Form isDirty={isDirty} />}
      <GuardState />
      <button type="button" onClick={() => setIsDirty(true)}>
        type-something
      </button>
      <button type="button" onClick={() => setMounted(false)}>
        leave-screen
      </button>
    </LeaveGuardProvider>
  );
}

const dirty = () => screen.getByTestId("dirty").textContent;

describe("useRegisterDirty", () => {
  it("starts clean and follows the form's own isDirty", async () => {
    const user = userEvent.setup();
    render(<Screen />);
    expect(dirty()).toBe("false");

    await user.click(screen.getByRole("button", { name: "type-something" }));
    expect(dirty()).toBe("true");
  });

  it("clears the flag when the form unmounts", async () => {
    const user = userEvent.setup();
    render(<Screen />);

    await user.click(screen.getByRole("button", { name: "type-something" }));
    expect(dirty()).toBe("true");

    // Leaving by any route — a confirmed tab tap, the back button, a save's
    // own navigate() — must not leave a stale "dirty" behind.
    await user.click(screen.getByRole("button", { name: "leave-screen" }));
    expect(dirty()).toBe("false");
  });

  // Not behavioural coverage — the two screens are lazy, Dexie-backed and
  // form-heavy, and mounting them to prove one hook call would be slow and
  // brittle. This is a reminder that the call site still exists at all, so
  // dropping the hook from a screen during the #67 sweep is noticed. Whether
  // it is called on the right value is what the cases above decide.
  it.each(["VisitScreen.tsx", "AddProspectScreen.tsx"])("still calls the hook in %s", (file) => {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    // Whitespace-tolerant and blind to the variable's name: Prettier may
    // re-wrap the call and the sweep may rename `form`.
    expect(source).toMatch(/useRegisterDirty\(\s*\w+\.formState\.isDirty\s*\)/);
  });
});

/** What the strip and the update banner call instead of navigating/updating directly (#74). */
function LeaveButton({ proceed }: { proceed: () => void }) {
  const { leave } = useLeaveGuard();
  return (
    <button type="button" onClick={() => leave(proceed)}>
      leave
    </button>
  );
}

describe("leave", () => {
  it("runs proceed at once when the form is clean", async () => {
    const user = userEvent.setup();
    const proceed = vi.fn();
    render(
      <LeaveGuardProvider>
        <LeaveButton proceed={proceed} />
      </LeaveGuardProvider>,
    );

    await user.click(screen.getByRole("button", { name: "leave" }));

    expect(proceed).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("holds proceed behind the dialog when dirty, and runs it on Quitter", async () => {
    const user = userEvent.setup();
    const proceed = vi.fn();
    render(
      <LeaveGuardProvider>
        <Form isDirty={true} />
        <LeaveButton proceed={proceed} />
      </LeaveGuardProvider>,
    );

    await user.click(screen.getByRole("button", { name: "leave" }));

    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(proceed).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: copy.nav.leaveGuard.leave }));
    expect(proceed).toHaveBeenCalledOnce();
  });

  it("never runs proceed when the dialog is cancelled", async () => {
    const user = userEvent.setup();
    const proceed = vi.fn();
    render(
      <LeaveGuardProvider>
        <Form isDirty={true} />
        <LeaveButton proceed={proceed} />
      </LeaveGuardProvider>,
    );

    await user.click(screen.getByRole("button", { name: "leave" }));
    await user.click(screen.getByRole("button", { name: copy.nav.leaveGuard.cancel }));

    expect(proceed).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("runs proceed at once outside a provider", async () => {
    const user = userEvent.setup();
    const proceed = vi.fn();
    render(<LeaveButton proceed={proceed} />);

    await user.click(screen.getByRole("button", { name: "leave" }));

    expect(proceed).toHaveBeenCalledOnce();
  });
});
