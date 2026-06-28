import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import App from "./App";

describe("App", () => {
  it("renders the short-term stock dashboard shell", () => {
    render(<App />);
    expect(screen.getByText("短线投研仪表盘")).toBeInTheDocument();
  });
});
