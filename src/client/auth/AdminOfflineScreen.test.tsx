import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { copy } from "../copy/field";
import { AdminOfflineScreen } from "./AdminOfflineScreen";

afterEach(cleanup);

describe("AdminOfflineScreen", () => {
  it("shows the title, the body and a Réessayer button that calls onRetry", () => {
    const onRetry = vi.fn();
    render(<AdminOfflineScreen checking={false} onRetry={onRetry} />);
    expect(screen.getByText(copy.adminOffline.title)).toBeTruthy();
    expect(screen.getByText(copy.adminOffline.body)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: copy.adminOffline.retry }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("disables the button and says Vérification… while checking", () => {
    render(<AdminOfflineScreen checking onRetry={() => {}} />);
    const button = screen.getByRole("button", { name: copy.adminOffline.checking });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
  });
});
