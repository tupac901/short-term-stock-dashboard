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
import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";

import { ApiClient } from "./api/client";
import type { BacktestResult, ScoreRun, StockPool, StockScore, Strategy, StrategyTemplate } from "./types";

const defaultSymbols = "600519,000001,300750,002594,601318";

type Candle = {
  time: Time;
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
  const trend = score ? (score.total_score - 50) / 180 : 0.04;
  const start = new Date("2026-01-02T00:00:00");
  return Array.from({ length: 80 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const wave = Math.sin(index / 2.8) * base * 0.018;
    const drift = index * trend;
    const open = base * (0.88 + index * 0.0018) + wave + drift;
    const close = open + Math.cos(index / 2.2) * base * 0.024 + trend * 2.2;
    const high = Math.max(open, close) + base * (0.012 + (index % 4) * 0.003);
    const low = Math.min(open, close) - base * (0.011 + (index % 3) * 0.003);
    return {
      time: date.toISOString().slice(0, 10) as Time,
      open: Number(open.toFixed(2)),
      close: Number(close.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      volume: Math.round(80 + Math.abs(close - open) * 20 + (index % 9) * 16),
    };
  });
}

function InteractiveKLine({ score }: { score?: StockScore }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#07090c" },
        textColor: "#9aa5b2",
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      },
      grid: {
        vertLines: { color: "#1a2028" },
        horzLines: { color: "#1a2028" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#d6dde7", labelBackgroundColor: "#a71c1c" },
        horzLine: { color: "#d6dde7", labelBackgroundColor: "#a71c1c" },
      },
      rightPriceScale: {
        borderColor: "#2a313a",
        scaleMargins: { top: 0.08, bottom: 0.25 },
      },
      timeScale: {
        borderColor: "#2a313a",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
        barSpacing: 9,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: true,
      },
    });
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#ff4d4f",
      downColor: "#25c26e",
      borderUpColor: "#ff4d4f",
      borderDownColor: "#25c26e",
      wickUpColor: "#ff8080",
      wickDownColor: "#48d991",
    });
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 },
    });
    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    return () => {
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const candles = makeCandles(score);
    candleSeriesRef.current?.setData(candles.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })));
    volumeSeriesRef.current?.setData(candles.map((item) => ({
      time: item.time,
      value: item.volume,
      color: item.close >= item.open ? "rgba(255, 77, 79, 0.5)" : "rgba(37, 194, 110, 0.45)",
    })));
    chartRef.current?.timeScale().fitContent();
  }, [score]);

  return (
    <div className="kline-wrap">
      <div ref={containerRef} className="interactive-kline" />
      <div className="kline-hint">拖动平移 · 滚轮缩放 · 十字光标查看价格</div>
    </div>
  );
}

export default function App() {
  const api = useMemo(() => new ApiClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      if (!email.trim() || !password.trim()) {
        setMessage("请输入邮箱和密码。首次使用会自动注册。");
        return;
      }
      if (password.length < 8) {
        setMessage("密码至少需要 8 位。");
        return;
      }
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
      setMessage("短线评分完成，交互K线和排行榜已更新。");
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
            <p>黑红行情盘 · 交互K线 · 量价评分 · 风险排雷</p>
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
          <label>邮箱<input value={email} placeholder="输入你的邮箱" onChange={(event) => setEmail(event.target.value)} /></label>
          <label>密码<input type="password" value={password} placeholder="至少 8 位密码" onChange={(event) => setPassword(event.target.value)} /></label>
          <button onClick={login} disabled={busy}><Lock size={16} /> 登录 / 首次自动注册</button>

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
            <InteractiveKLine score={selectedScore} />
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
