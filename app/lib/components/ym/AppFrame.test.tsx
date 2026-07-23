import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter, usePathname } from "next/navigation";
import { authClient } from "@/app/lib/auth/client";
import { useAppStore } from "@/app/lib/app-store";
import { AppFrame } from "./AppFrame";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
}));

vi.mock("@/app/lib/auth/client", () => ({
  authClient: {
    signOut: vi.fn(),
  },
}));

vi.mock("@/app/lib/app-store", () => ({
  useAppStore: vi.fn(),
}));

describe("AppFrame", () => {
  const push = vi.fn();
  const clearStore = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as ReturnType<typeof vi.fn>).mockReturnValue({ push });
    (useAppStore as ReturnType<typeof vi.fn>).mockReturnValue({ clearStore });
    (authClient.signOut as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  it("renders children inside the frame", () => {
    (usePathname as ReturnType<typeof vi.fn>).mockReturnValue("/");
    render(
      <AppFrame>
        <div>Child Content</div>
      </AppFrame>
    );
    expect(screen.getByText("Child Content")).toBeInTheDocument();
  });

  it("on pathname / shows Settings button and navigates to /settings", async () => {
    const user = userEvent.setup();
    (usePathname as ReturnType<typeof vi.fn>).mockReturnValue("/");
    render(
      <AppFrame>
        <div>Child</div>
      </AppFrame>
    );

    const button = screen.getByRole("button", { name: "Settings" });
    await user.click(button);
    expect(push).toHaveBeenCalledWith("/settings");
  });

  it("on pathname /settings shows Home button and navigates to /", async () => {
    const user = userEvent.setup();
    (usePathname as ReturnType<typeof vi.fn>).mockReturnValue("/settings");
    render(
      <AppFrame>
        <div>Child</div>
      </AppFrame>
    );

    const button = screen.getByRole("button", { name: "Home" });
    await user.click(button);
    expect(push).toHaveBeenCalledWith("/");
  });

  it("sign out awaits signOut, then calls clearStore, then navigates to /, in order", async () => {
    const user = userEvent.setup();
    (usePathname as ReturnType<typeof vi.fn>).mockReturnValue("/");
    render(
      <AppFrame>
        <div>Child</div>
      </AppFrame>
    );

    const signOutButton = screen.getByRole("button", { name: "Sign Out" });
    await user.click(signOutButton);

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/");
    });

    const signOutOrder = (authClient.signOut as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
    const clearStoreOrder = clearStore.mock.invocationCallOrder[0];
    const pushOrder = push.mock.invocationCallOrder[0];

    expect(signOutOrder).toBeLessThan(clearStoreOrder);
    expect(clearStoreOrder).toBeLessThan(pushOrder);
  });
});
