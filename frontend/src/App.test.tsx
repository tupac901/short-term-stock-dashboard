import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import App, { makeCandles } from "./App";

describe("App", () => {
  it("renders the short-term stock dashboard shell", () => {
    render(<App />);
    expect(screen.getByText("短线股票决策终端")).toBeInTheDocument();
    expect(screen.getByText("分时")).toBeInTheDocument();
    expect(screen.getByText("1分钟")).toBeInTheDocument();
    expect(screen.getByText("日K")).toBeInTheDocument();
  });

  it("does not generate future dates for monthly candles", () => {
    const candles = makeCandles(undefined, "month");
    const last = String(candles[candles.length - 1].time);
    const today = new Date().toISOString().slice(0, 10);
    expect(last <= today).toBe(true);
  });
});
