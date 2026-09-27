import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScreenState } from "./ScreenState";

const LOAD_FAILED = "Impossible de charger les trucs.";
const LOADING = "Chargement des trucs…";

describe("ScreenState", () => {
  it("shows the skeleton, marked busy, while pending with no data", () => {
    render(
      <ScreenState
        data={undefined}
        isPending
        isError={false}
        isFetching
        onRetry={() => {}}
        loadFailed={LOAD_FAILED}
        skeleton={<p>Squelette</p>}
      >
        {(data: string) => <p>{data}</p>}
      </ScreenState>,
    );

    const skeleton = screen.getByText("Squelette");
    expect(skeleton).toBeTruthy();
    expect(skeleton.closest('[aria-busy="true"]')).not.toBeNull();
  });

  it("announces the loading string outside the aria-busy container, not inside it", () => {
    render(
      <ScreenState
        data={undefined}
        isPending
        isError={false}
        isFetching
        onRetry={() => {}}
        loadFailed={LOAD_FAILED}
        loading={LOADING}
        skeleton={<p>Squelette</p>}
      >
        {(data: string) => <p>{data}</p>}
      </ScreenState>,
    );

    const status = screen.getByRole("status");
    expect(status.textContent).toBe(LOADING);
    expect(status.closest('[aria-busy="true"]')).toBeNull();
  });

  it("says nothing once data or an error has arrived", () => {
    render(
      <ScreenState
        data={undefined}
        isPending={false}
        isError
        isFetching={false}
        onRetry={() => {}}
        loadFailed={LOAD_FAILED}
        loading={LOADING}
        skeleton={<p>Squelette</p>}
      >
        {(data: string) => <p>{data}</p>}
      </ScreenState>,
    );

    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("shows only the retry Alert when it fails with no data", () => {
    render(
      <ScreenState
        data={undefined}
        isPending={false}
        isError
        isFetching={false}
        onRetry={() => {}}
        loadFailed={LOAD_FAILED}
        skeleton={<p>Squelette</p>}
      >
        {(data: string) => <p>{data}</p>}
      </ScreenState>,
    );

    expect(screen.getByText(LOAD_FAILED)).toBeTruthy();
    expect(screen.queryByText("Squelette")).toBeNull();
  });

  it("shows the Alert above data kept from a previous fetch, retry disabled while fetching", () => {
    const onRetry = vi.fn();
    render(
      <ScreenState
        data="donnée gardée"
        isPending={false}
        isError
        isFetching
        onRetry={onRetry}
        loadFailed={LOAD_FAILED}
        skeleton={<p>Squelette</p>}
      >
        {(data: string) => <p>{data}</p>}
      </ScreenState>,
    );

    expect(screen.getByText(LOAD_FAILED)).toBeTruthy();
    expect(screen.getByText("donnée gardée")).toBeTruthy();
    const retry = screen.getByRole("button") as HTMLButtonElement;
    expect(retry.disabled).toBe(true);
  });

  it("enables retry once the fetch has settled, and refetches on click", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <ScreenState
        data={undefined}
        isPending={false}
        isError
        isFetching={false}
        onRetry={onRetry}
        loadFailed={LOAD_FAILED}
        skeleton={<p>Squelette</p>}
      >
        {(data: string) => <p>{data}</p>}
      </ScreenState>,
    );

    const retry = screen.getByRole("button") as HTMLButtonElement;
    expect(retry.disabled).toBe(false);

    await user.click(retry);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("treats a null answer the same as no answer yet, and never calls children(null)", () => {
    const children = vi.fn(() => <p>Ne devrait pas s'afficher</p>);
    render(
      <ScreenState<string | null>
        data={null}
        isPending={false}
        isError={false}
        isFetching={false}
        onRetry={() => {}}
        loadFailed={LOAD_FAILED}
        skeleton={<p>Squelette</p>}
      >
        {children}
      </ScreenState>,
    );

    expect(children).not.toHaveBeenCalled();
    expect(screen.queryByText("Ne devrait pas s'afficher")).toBeNull();
  });

  it("still shows the busy skeleton, not the empty children slot, while pending with a null answer", () => {
    render(
      <ScreenState<string | null>
        data={null}
        isPending
        isError={false}
        isFetching
        onRetry={() => {}}
        loadFailed={LOAD_FAILED}
        skeleton={<p>Squelette</p>}
      >
        {() => <p>Ne devrait pas s'afficher</p>}
      </ScreenState>,
    );

    expect(screen.getByText("Squelette")).toBeTruthy();
  });
});
