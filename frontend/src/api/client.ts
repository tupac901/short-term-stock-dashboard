import type { BacktestResult, ScoreRun, StockPool, Strategy, StrategyTemplate, StrategyWeights } from "../types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export class ApiClient {
  token = "";

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers);
    headers.set("Content-Type", "application/json");
    if (this.token) headers.set("Authorization", `Bearer ${this.token}`);
    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return response.json() as Promise<T>;
  }

  async registerAndLogin(email: string, password: string, name: string) {
    await this.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name })
    }).catch(() => undefined);
    const token = await this.request<{ access_token: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    this.token = token.access_token;
  }

  templates() {
    return this.request<StrategyTemplate[]>("/api/strategies/templates");
  }

  createPool(name: string, symbols: string[]) {
    return this.request<StockPool>("/api/stock-pools", {
      method: "POST",
      body: JSON.stringify({ name, scope: "personal", symbols })
    });
  }

  createStrategy(name: string, templateKey: string, weights: StrategyWeights) {
    return this.request<Strategy>("/api/strategies", {
      method: "POST",
      body: JSON.stringify({ name, template_key: templateKey, weights })
    });
  }

  runScore(stockPoolId: number, strategyVersionId: number) {
    return this.request<ScoreRun>("/api/scoring/runs", {
      method: "POST",
      body: JSON.stringify({ stock_pool_id: stockPoolId, strategy_version_id: strategyVersionId })
    });
  }

  runBacktest(stockPoolId: number, strategyVersionId: number) {
    return this.request<BacktestResult>("/api/backtests", {
      method: "POST",
      body: JSON.stringify({
        stock_pool_id: stockPoolId,
        strategy_version_id: strategyVersionId,
        start_date: "2026-01-01",
        end_date: "2026-03-31",
        rebalance_frequency: "weekly",
        max_positions: 3,
        fee_rate: 0.001
      })
    });
  }
}
