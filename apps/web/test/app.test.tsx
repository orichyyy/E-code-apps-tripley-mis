import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "../src/app/App";

describe("web app shell", () => {
  it("renders the admin foundation route", async () => {
    render(<App />);

    expect(await screen.findByText("Admin Foundation")).toBeInTheDocument();
  });
});
