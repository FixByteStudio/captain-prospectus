/**
 * The update banner's "Mettre à jour" goes through the leave guard (#74).
 *
 * The banner is shared: the field shell renders it inside `LeaveGuardProvider`,
 * the admin shell renders it with no provider at all. So the same button must
 * ask over a dirty field form and still update at once on the admin side.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UpdatePrompt } from "./Band";
import { copy } from "./copy";
import { LeaveGuardProvider, useRegisterDirty } from "./field/leave-guard";
import type { PwaState } from "./pwa";

/** Stands in for VisitScreen / AddProspectScreen's own dirty registration. */
function DirtyForm() {
  useRegisterDirty(true);
  return null;
}

function waitingBuild(): PwaState {
  return { needRefresh: true, offlineReady: true, update: vi.fn(), dismiss: vi.fn() };
}

describe("UpdatePrompt", () => {
  it("asks before updating over a dirty field form, then updates on Quitter", async () => {
    const user = userEvent.setup();
    const pwa = waitingBuild();
    render(
      <LeaveGuardProvider>
        <DirtyForm />
        <UpdatePrompt pwa={pwa} />
      </LeaveGuardProvider>,
    );

    await user.click(screen.getByRole("button", { name: copy.update.apply }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(pwa.update).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: copy.nav.leaveGuard.leave }));
    expect(pwa.update).toHaveBeenCalledOnce();
  });

  it("never asks to dismiss, even over a dirty form", async () => {
    const user = userEvent.setup();
    const pwa = waitingBuild();
    render(
      <LeaveGuardProvider>
        <DirtyForm />
        <UpdatePrompt pwa={pwa} />
      </LeaveGuardProvider>,
    );

    await user.click(screen.getByRole("button", { name: copy.update.dismiss }));

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(pwa.dismiss).toHaveBeenCalledOnce();
  });

  it("updates at once on the admin side, which has no provider", async () => {
    const user = userEvent.setup();
    const pwa = waitingBuild();
    render(<UpdatePrompt pwa={pwa} />);

    await user.click(screen.getByRole("button", { name: copy.update.apply }));

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(pwa.update).toHaveBeenCalledOnce();
  });
});
