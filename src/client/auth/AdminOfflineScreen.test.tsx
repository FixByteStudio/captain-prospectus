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

  it("says it is still offline after a failed retry, but not while checking", () => {
    const { rerender } = render(
      <AdminOfflineScreen checking={false} onRetry={() => {}} stillFailing />,
    );
    expect(screen.getByText(copy.adminOffline.stillOffline)).toBeTruthy();
    rerender(<AdminOfflineScreen checking onRetry={() => {}} stillFailing />);
    expect(screen.queryByText(copy.adminOffline.stillOffline)).toBeNull();
  });

  it("words the online-but-unreached variant without saying offline", () => {
    render(
      <AdminOfflineScreen checking={false} onRetry={() => {}} variant="unreached" stillFailing />,
    );
    expect(screen.getByText(copy.adminOffline.unreached.title)).toBeTruthy();
    expect(screen.getByText(copy.adminOffline.unreached.body)).toBeTruthy();
    expect(screen.getByText(copy.adminOffline.unreached.stillUnreached)).toBeTruthy();
    expect(screen.queryByText(copy.adminOffline.title)).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
