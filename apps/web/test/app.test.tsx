import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "../src/app/App";
import { useAuthStore } from "../src/stores/auth.store";

describe("web admin frontend", () => {
  it("renders the login page", async () => {
    window.history.pushState(null, "", "/login");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Login" })).toBeInTheDocument();
  });

  it("renders the authenticated admin shell", async () => {
    window.history.pushState(null, "", "/");
    useAuthStore.getState().signIn({
      accessToken: "test-token",
      user: {
        id: "1",
        username: "admin",
        displayName: "Super Administrator",
        language: "en",
        forcePasswordChange: false
      },
      permissionCodes: ["*"]
    });

    render(<App />);

    expect(await screen.findByText("Web Admin Base")).toBeInTheDocument();
    expect(await screen.findByText("User management")).toBeInTheDocument();
    expect(await screen.findByLabelText("Current organization")).toBeInTheDocument();
  });

  it("renders personal settings with tab and theme controls", async () => {
    window.history.pushState(null, "", "/account/settings");
    useAuthStore.getState().signIn({
      accessToken: "test-token",
      user: {
        id: "1",
        username: "admin",
        displayName: "Super Administrator",
        language: "en",
        forcePasswordChange: false
      },
      permissionCodes: ["*"]
    });

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Personal settings" })).toBeInTheDocument();
    expect(screen.getByText("Theme color")).toBeInTheDocument();
  });
});
