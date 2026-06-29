export type StrategyWeights = {
  technical: number;
  capital: number;
  risk: number;
  fundamental: number;
};

export type StrategyTemplate = {
  key: string;
  name: string;
  description: string;
  weights: StrategyWeights;
};

export type StockPool = {
  id: number;
  name: string;
  scope: string;
  team_id: number | null;
  symbols: string[];
};

export type TonghuashunSyncResponse = {
  stock_pool: StockPool;
  symbols: string[];
  count: number;
  source: string;
};

export type Strategy = {
  id: number;
  name: string;
  template_key: string;
  current_version_id: number;
  weights: StrategyWeights;
};

export type StockScore = {
  symbol: string;
  name: string;
  total_score: number;
  technical_score: number;
  capital_score: number;
  fundamental_score: number;
  risk_penalty: number;
  reasons: string[];
  risks: string[];
  close: number;
  amount: number;
};

export type ScoreRun = {
  id: number;
  stock_pool_id: number;
  strategy_version_id: number;
  status: string;
  scores: StockScore[];
};

export type BacktestResult = {
  id: number;
  total_return: number;
  max_drawdown: number;
  win_rate: number;
  trade_count: number;
};
