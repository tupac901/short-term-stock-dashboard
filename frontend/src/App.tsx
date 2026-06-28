import {
  Activity,
  Bell,
  CandlestickChart,
  Download,
  LineChart,
  Lock,
  Play,
  Radar,
  Target,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ApiClient } from "./api/client";
import type { BacktestResult, ScoreRun, StockPool, StockScore, Strategy, StrategyTemplate } from "./types";

const defaultSymbols = "600519,000001,300750,002594,601318";

type Candle = {
  day: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const marketTape = [
  ["上证指数", "2987.42", "+0.72%"],
  ["深证成指", "9412.31", "+1.18%"],
  ["创业板指", "1848.09", "-0.26%"],
  ["北证50", "812.77", "+0.44%"],
];

function makeCandles(score?: StockScore): Candle[] {
  const base = score?.close ?? 28;
  const trend = score ? (score.total_score - 50) / 170 : 0.04;
  return Array.from({ length: 36 }, (_, index) => {
    const wave = Math.sin(index / 2.6) * base * 0.018;
    const drift = index * trend;
    const open = base * (0.92 + index * 0.002) + wave + drift;
    const close = open + Math.cos(index / 2.1) * base * 0.025 + trend * 2.4;
    const high = Math.max(open, close) + base * (0.012 + (index % 4) * 0.004);
    const low = Math.min(open, close) - base * (0.011 + (index % 3) * 0.004);
    return {
      day: `${index + 1}`,
      open: Number(open.toFixed(2)),
      close: Number(close.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      volume: Math.round(80 + Math.abs(close - open) * 18 + (index % 7) * 18),
    };
  });
}

function CandleChart({ score }: { score?: StockScore }) {
  const candles = makeCandles(score);
  const min = Math.min(...candles.map((item) => item.low));
  const max = Math.max(...candles.map((item) => item.high));
  const width = 860;
  const height = 330;
  const chartTop = 18;
  const chartHeight = 220;
  const volumeTop = 262;
  const scaleY = (value: number) => chartTop + ((max - value) / (max - min || 1)) * chartHeight;
  const slot = width / candles.length;

  return (
    <svg className="kline-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="K线图">
      {Array.from({ length: 5 }, (_, index) => (
        <line
          key={`grid-${index}`}
          x1="0"
          x2={width}
          y1={chartTop + index * 55}
          y2={chartTop + index * 55}
          className="chart-grid"
        />
      ))}
      {candles.map((candle, index) => {
        const x = index * slot + slot / 2;
        const rising = candle.close >= candle.open;
        const yOpen = scaleY(candle.open);
        const yClose = scaleY(candle.close);
        const bodyTop = Math.min(yOpen, yClose);
        const bodyHeight = Math.max(3, Math.abs(yClose - yOpen));
        return (
          <g key={candle.day}>
            <line x1={x} x2={x} y1={scaleY(candle.high)} y2={scaleY(candle.low)} className={rising ? "candle-up" : "candle-down"} />
            <rect
              x={x - slot * 0.28}
              y={bodyTop}
              width={slot * 0.56}
              height={bodyHeight}
              className={rising ? "candle-up-fill" : "candle-down-fill"}
            />
            <rect
              x={x - slot * 0.3}
              y={volumeTop + 44 - Math.min(44, candle.volume / 5)}
              width={slot * 0.6}
              height={Math.min(44, candle.volume / 5)}
              className={rising ? "volume-up" : "volume-down"}
            />
          </g>
        );
      })}
      <text x="8" y="18" className="axis-label">{max.toFixed(2)}</text>
      <text x="8" y="238" className="axis-label">{min.toFixed(2)}</text>
      <text x="8" y="318" className="axis-label">VOL</text>
    </svg>
  );
}

export default function App() {
  const api = useMemo(() => new ApiClient(), []);
  const [email, setEmail] = useState("demo@example.com");
  const [password, setPassword] = useState("StrongPass123");
  const [loggedIn, setLoggedIn] = useState(false);
  const [templates, setTemplates] = useState<StrategyTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("strong_breakout");
  const [symbols, setSymbols] = useState(defaultSymbols);
  const [pool, setPool] = useState<StockPool | null>(null);
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [scoreRun, setScoreRun] = useState<ScoreRun | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [backtest, setBacktest] = useState<BacktestResult | null>(null);
  const [message, setMessage] = useState("连接行情终端，等待登录。");
  const [busy, setBusy] = useState(false);

  async function runAction(action: () => Promise<void>, fallback: string) {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : fallback);
    } finally {
      setBusy(false);
    }
  }

  async function login() {
    await runAction(async () => {
      setMessage("正在登录...");
      await api.registerAndLogin(email, password, "短线交易员");
      const nextTemplates = await api.templates();
      setTemplates(nextTemplates);
      setSelectedTemplate(nextTemplates[0]?.key ?? "strong_breakout");
      setLoggedIn(true);
      setMessage("登录成功，策略模板已载入。");
    }, "登录失败");
  }

  async function createResearchSetup() {
    await runAction(async () => {
      const stockSymbols = symbols.split(/[,，\s]+/).map((item) => item.trim()).filter(Boolean);
      const nextPool = await api.createPool("同花顺风格短线池", stockSymbols);
      const template = templates.find((item) => item.key === selectedTemplate) ?? templates[0];
      const nextStrategy = await api.createStrategy(template.name, template.key, template.weights);
      setPool(nextPool);
      setStrategy(nextStrategy);
      setMessage(`已创建 ${nextPool.symbols.length} 只股票的短线池。`);
    }, "创建研究配置失败");
  }

  async function runScore() {
    if (!pool || !strategy) return;
    await runAction(async () => {
      const nextRun = await api.runScore(pool.id, strategy.current_version_id);
      setScoreRun(nextRun);
      setSelectedSymbol(nextRun.scores[0]?.symbol ?? "");
      setMessage("短线评分完成，K线和排行榜已更新。");
    }, "评分失败");
  }

  async function runBacktest() {
    if (!pool || !strategy) return;
    await runAction(async () => {
      setBacktest(await api.runBacktest(pool.id, strategy.current_version_id));
      setMessage("日线回测完成。");
    }, "回测失败");
  }

  const topScores = scoreRun?.scores ?? [];
  const selectedScore = topScores.find((item) => item.symbol === selectedSymbol) ?? topScores[0];
  const change = selectedScore ? selectedScore.total_score - 50 : 0;

  return (
    <main className="terminal-shell">
      <header className="terminal-header">
        <div className="brand-block">
          <span className="brand-mark">短</span>
          <div>
            <h1>短线股票决策终端</h1>
            <p>黑红行情盘 · K线 · 量价评分 · 风险排雷</p>
          </div>
        </div>
        <div className="market-tape">
          {marketTape.map(([name, value, pct]) => (
            <span key={name} className={pct.startsWith("+") ? "quote-up" : "quote-down"}>
              <b>{name}</b> {value} {pct}
            </span>
          ))}
        </div>
        <div className={loggedIn ? "login-state online" : "login-state"}>
          <Activity size={16} /> {loggedIn ? "已登录" : "未登录"}
        </div>
      </header>

      <section className="terminal-grid">
        <aside className="left-rail panel">
          <h2><Lock size={16} /> 账户</h2>
          <label>邮箱<input value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>密码<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <button onClick={login} disabled={busy}><Lock size={16} /> 登录 / 注册</button>

          <h2><Target size={16} /> 股票池</h2>
          <textarea value={symbols} onChange={(event) => setSymbols(event.target.value)} />
          <label>策略模板
            <select value={selectedTemplate} onChange={(event) => setSelectedTemplate(event.target.value)}>
              {templates.map((template) => <option key={template.key} value={template.key}>{template.name}</option>)}
            </select>
          </label>
          <button disabled={!loggedIn || busy} onClick={createResearchSetup}><Radar size={16} /> 创建研究配置</button>
          <button disabled={!pool || !strategy || busy} onClick={runScore}><Play size={16} /> 运行短线评分</button>
          <button disabled={!scoreRun || busy} onClick={runBacktest}><LineChart size={16} /> 日线回测</button>
          {scoreRun && <a className="button-link" href={`/api/scoring/runs/${scoreRun.id}/export.csv`}><Download size={16} /> 导出 CSV</a>}
          <p className="console-line">{message}</p>
        </aside>

        <section className="quote-board">
          <div className="quote-strip panel">
            <div>
              <span>当前标的</span>
              <strong>{selectedScore ? `${selectedScore.name} ${selectedScore.symbol}` : "--"}</strong>
            </div>
            <div>
              <span>最新价</span>
              <strong className={change >= 0 ? "quote-up" : "quote-down"}>{selectedScore?.close ?? "--"}</strong>
            </div>
            <div>
              <span>综合分</span>
              <strong className={change >= 0 ? "quote-up" : "quote-down"}>{selectedScore?.total_score ?? "--"}</strong>
            </div>
            <div>
              <span>成交额</span>
              <strong>{selectedScore ? `${(selectedScore.amount / 100000000).toFixed(1)}亿` : "--"}</strong>
            </div>
            <div>
              <span>回测收益</span>
              <strong className={(backtest?.total_return ?? 0) >= 0 ? "quote-up" : "quote-down"}>
                {backtest ? `${(backtest.total_return * 100).toFixed(2)}%` : "--"}
              </strong>
            </div>
          </div>

          <div className="main-chart panel">
            <div className="panel-title">
              <h2><CandlestickChart size={18} /> 日K线</h2>
              <div className="period-tabs"><span>日线</span><span>周线</span><span>月线</span><span>分钟</span></div>
            </div>
            <CandleChart score={selectedScore} />
          </div>

          <div className="bottom-grid">
            <section className="rank-panel panel">
              <div className="panel-title">
                <h2><TrendingUp size={18} /> 短线评分排行</h2>
                <span>{topScores.length} 只</span>
              </div>
              <table>
                <thead>
                  <tr><th>代码</th><th>名称</th><th>综合</th><th>技术</th><th>资金</th><th>风险</th></tr>
                </thead>
                <tbody>
                  {topScores.map((score) => (
                    <tr
                      key={score.symbol}
                      className={score.symbol === selectedScore?.symbol ? "selected-row" : ""}
                      onClick={() => setSelectedSymbol(score.symbol)}
                    >
                      <td>{score.symbol}</td>
                      <td>{score.name}</td>
                      <td className={score.total_score >= 60 ? "quote-up" : "quote-down"}>{score.total_score}</td>
                      <td>{score.technical_score}</td>
                      <td>{score.capital_score}</td>
                      <td>{score.risks.join("、")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="factor-panel panel">
              <div className="panel-title">
                <h2><Bell size={18} /> 因子拆解</h2>
                <span>{strategy?.name ?? "未选择策略"}</span>
              </div>
              <div className="bar-mini">
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={selectedScore ? [
                    { name: "综合", value: selectedScore.total_score },
                    { name: "技术", value: selectedScore.technical_score },
                    { name: "资金", value: selectedScore.capital_score },
                    { name: "基本", value: selectedScore.fundamental_score },
                    { name: "风险", value: selectedScore.risk_penalty },
                  ] : []}>
                    <CartesianGrid stroke="#242a31" />
                    <XAxis dataKey="name" stroke="#7e8793" />
                    <YAxis stroke="#7e8793" />
                    <Tooltip contentStyle={{ background: "#11151a", border: "1px solid #333b45", color: "#e6edf3" }} />
                    <Bar dataKey="value" fill="#e14242" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="signal-box">
                <b>入选原因</b>
                <p>{selectedScore?.reasons.join("、") ?? "运行评分后显示"}</p>
                <b>风险提示</b>
                <p>{selectedScore?.risks.join("、") ?? "运行评分后显示"}</p>
              </div>
            </section>
          </div>
        </section>
      </section>
    </main>
  );
}
