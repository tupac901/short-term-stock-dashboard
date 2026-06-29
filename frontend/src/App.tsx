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
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";

import { ApiClient } from "./api/client";
import type { BacktestResult, ScoreRun, StockPool, StockScore, Strategy, StrategyTemplate } from "./types";

const defaultSymbols = "600519,000001,300750,002594,601318";

export function parseTonghuashunSymbols(input: string): string[] {
  const matches = input.toUpperCase().match(/\d{6}/g) ?? [];
  return Array.from(new Set(matches));
}

const periods = [
  { key: "timeline", label: "分时", count: 120, stepMinutes: 1, barSpacing: 6 },
  { key: "1m", label: "1分钟", count: 180, stepMinutes: 1, barSpacing: 5 },
  { key: "5m", label: "5分钟", count: 160, stepMinutes: 5, barSpacing: 6 },
  { key: "15m", label: "15分钟", count: 130, stepMinutes: 15, barSpacing: 7 },
  { key: "30m", label: "30分钟", count: 110, stepMinutes: 30, barSpacing: 8 },
  { key: "60m", label: "60分钟", count: 90, stepMinutes: 60, barSpacing: 9 },
  { key: "day", label: "日K", count: 120, stepDays: 1, barSpacing: 8 },
  { key: "week", label: "周K", count: 100, stepDays: 7, barSpacing: 8 },
  { key: "month", label: "月K", count: 80, stepDays: 30, barSpacing: 9 },
] as const;

type PeriodKey = typeof periods[number]["key"];

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

function makeTime(index: number, period: (typeof periods)[number]): Time {
  const now = new Date();
  if ("stepMinutes" in period) {
    const end = new Date(now);
    end.setSeconds(0, 0);
    end.setMinutes(end.getMinutes() - (period.count - 1 - index) * period.stepMinutes);
    return Math.floor(end.getTime() / 1000) as UTCTimestamp;
  }
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() - (period.count - 1 - index) * period.stepDays);
  return end.toISOString().slice(0, 10) as Time;
}

export function makeCandles(score: StockScore | undefined, periodKey: PeriodKey): Candle[] {
  const period = periods.find((item) => item.key === periodKey) ?? periods[6];
  const base = score?.close ?? 28;
  const scoreTrend = score ? (score.total_score - 50) / 200 : 0.03;
  const periodNoise = "stepMinutes" in period ? 0.009 : 0.022;
  const periodTrend = "stepMinutes" in period ? scoreTrend * 0.35 : scoreTrend;

  return Array.from({ length: period.count }, (_, index) => {
    const wave = Math.sin(index / 3.2) * base * periodNoise;
    const pulse = Math.cos(index / 8.5) * base * periodNoise * 0.7;
    const drift = index * periodTrend;
    const open = base * (0.9 + index * 0.0012) + wave + drift;
    const close = open + Math.cos(index / 2.4) * base * periodNoise * 1.9 + pulse;
    const high = Math.max(open, close) + base * (periodNoise * 0.55 + (index % 4) * periodNoise * 0.12);
    const low = Math.min(open, close) - base * (periodNoise * 0.52 + (index % 3) * periodNoise * 0.12);
    return {
      time: makeTime(index, period),
      open: Number(open.toFixed(2)),
      close: Number(close.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      volume: Math.round(60 + Math.abs(close - open) * 22 + (index % 9) * 15),
    };
  });
}

function movingAverage(candles: Candle[], windowSize: number) {
  return candles
    .map((item, index) => {
      if (index < windowSize - 1) return null;
      const slice = candles.slice(index - windowSize + 1, index + 1);
      const value = slice.reduce((sum, candle) => sum + candle.close, 0) / windowSize;
      return { time: item.time, value: Number(value.toFixed(2)) };
    })
    .filter((item): item is { time: Time; value: number } => item !== null);
}

function InteractiveKLine({
  score,
  period,
}: {
  score?: StockScore;
  period: PeriodKey;
}) {
  const [hoverInfo, setHoverInfo] = useState<string>("移动鼠标查看K线价格");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ma5Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ma10Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ma20Ref = useRef<ISeriesApi<"Line"> | null>(null);

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
        barSpacing: 8,
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
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });
    const ma5 = chart.addSeries(LineSeries, { color: "#ffd166", lineWidth: 1, priceLineVisible: false });
    const ma10 = chart.addSeries(LineSeries, { color: "#4dabf7", lineWidth: 1, priceLineVisible: false });
    const ma20 = chart.addSeries(LineSeries, { color: "#d783ff", lineWidth: 1, priceLineVisible: false });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    ma5Ref.current = ma5;
    ma10Ref.current = ma10;
    ma20Ref.current = ma20;

    const handleCrosshairMove = (param: MouseEventParams<Time>) => {
      const seriesData = param.seriesData.get(candleSeries) as
        | { open: number; high: number; low: number; close: number }
        | undefined;
      if (!seriesData) {
        setHoverInfo("移动鼠标查看K线价格");
        return;
      }
      const pct = ((seriesData.close - seriesData.open) / seriesData.open) * 100;
      setHoverInfo(
        `开 ${seriesData.open.toFixed(2)}  高 ${seriesData.high.toFixed(2)}  低 ${seriesData.low.toFixed(2)}  收 ${seriesData.close.toFixed(2)}  涨跌 ${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`,
      );
    };
    chart.subscribeCrosshairMove(handleCrosshairMove);

    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      ma5Ref.current = null;
      ma10Ref.current = null;
      ma20Ref.current = null;
    };
  }, []);

  useEffect(() => {
    const candles = makeCandles(score, period);
    const periodConfig = periods.find((item) => item.key === period) ?? periods[6];
    candleSeriesRef.current?.setData(candles.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })));
    volumeSeriesRef.current?.setData(candles.map((item) => ({
      time: item.time,
      value: item.volume,
      color: item.close >= item.open ? "rgba(255, 77, 79, 0.5)" : "rgba(37, 194, 110, 0.45)",
    })));
    ma5Ref.current?.setData(movingAverage(candles, 5));
    ma10Ref.current?.setData(movingAverage(candles, 10));
    ma20Ref.current?.setData(movingAverage(candles, 20));
    chartRef.current?.timeScale().applyOptions({
      barSpacing: periodConfig.barSpacing,
      timeVisible: "stepMinutes" in periodConfig,
    });
    chartRef.current?.timeScale().fitContent();
  }, [score, period]);

  return (
    <div className="kline-wrap">
      <div className="ma-legend">
        <span className="ma5">MA5</span>
        <span className="ma10">MA10</span>
        <span className="ma20">MA20</span>
        <span className="hover-info">{hoverInfo}</span>
      </div>
      <div ref={containerRef} className="interactive-kline" />
      <div className="kline-hint">拖动平移 · 滚轮缩放 · 十字光标查看高开低收</div>
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
  const [thsImportText, setThsImportText] = useState("");
  const [thsUsername, setThsUsername] = useState("");
  const [thsPassword, setThsPassword] = useState("");
  const [thsCookies, setThsCookies] = useState("");
  const [pool, setPool] = useState<StockPool | null>(null);
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [scoreRun, setScoreRun] = useState<ScoreRun | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [backtest, setBacktest] = useState<BacktestResult | null>(null);
  const [message, setMessage] = useState("连接行情终端，等待登录。");
  const [busy, setBusy] = useState(false);
  const [period, setPeriod] = useState<PeriodKey>("day");
  const [watchEnabled, setWatchEnabled] = useState(false);
  const [lastRefresh, setLastRefresh] = useState("");

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

  function importTonghuashunSymbols() {
    const imported = parseTonghuashunSymbols(thsImportText);
    if (imported.length === 0) {
      setMessage("没有识别到同花顺自选股代码，请粘贴包含 6 位代码的文本。");
      return;
    }
    const merged = Array.from(new Set([...parseTonghuashunSymbols(symbols), ...imported]));
    setSymbols(merged.join(","));
    setMessage(`已从同花顺自选文本识别 ${imported.length} 只，当前股票池 ${merged.length} 只。`);
  }

  async function syncTonghuashunApp() {
    await runAction(async () => {
      if (!loggedIn) {
        setMessage("请先登录本系统账户，再同步同花顺 APP 自选股。");
        return;
      }
      if (!thsCookies.trim() && (!thsUsername.trim() || !thsPassword.trim())) {
        setMessage("请输入同花顺账号密码，或粘贴同花顺 Cookie 后再同步。");
        return;
      }
      const result = await api.syncTonghuashunWatchlist({
        username: thsUsername.trim() || undefined,
        password: thsPassword || undefined,
        cookies: thsCookies.trim() || undefined,
      });
      const nextTemplates = templates.length > 0 ? templates : await api.templates();
      if (templates.length === 0) setTemplates(nextTemplates);
      const template = nextTemplates.find((item) => item.key === selectedTemplate) ?? nextTemplates[0];
      if (!template) {
        setMessage("同花顺自选股已同步，但策略模板加载失败，暂时无法运行盯盘评分。");
        return;
      }
      const nextStrategy = strategy ?? await api.createStrategy(template.name, template.key, template.weights);
      const nextRun = await api.runScore(result.stock_pool.id, nextStrategy.current_version_id);
      setPool(result.stock_pool);
      setStrategy(nextStrategy);
      setSymbols(result.symbols.join(","));
      setScoreRun(nextRun);
      setSelectedSymbol(nextRun.scores[0]?.symbol ?? "");
      setLastRefresh(new Date().toLocaleTimeString());
      setMessage(`已直接同步同花顺 APP 自选股 ${result.count} 只，并已完成首次盯盘评分。`);
    }, "同花顺 APP 自选股同步失败");
  }

  async function runScore() {
    if (!pool || !strategy) return;
    await runAction(async () => {
      const nextRun = await api.runScore(pool.id, strategy.current_version_id);
      setScoreRun(nextRun);
      setSelectedSymbol(nextRun.scores[0]?.symbol ?? "");
      setLastRefresh(new Date().toLocaleTimeString());
      setMessage("短线评分完成，K线周期和排行榜已更新。");
    }, "评分失败");
  }

  async function runBacktest() {
    if (!pool || !strategy) return;
    await runAction(async () => {
      setBacktest(await api.runBacktest(pool.id, strategy.current_version_id));
      setMessage("日线回测完成。");
    }, "回测失败");
  }

  useEffect(() => {
    if (!watchEnabled || !pool || !strategy || busy) return;
    const interval = window.setInterval(() => {
      runScore();
    }, 15000);
    return () => window.clearInterval(interval);
  }, [watchEnabled, pool, strategy, busy]);

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
            <p>黑红行情盘 · 同花顺式K线周期 · 量价评分 · 风险排雷</p>
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
          <label>同花顺手机自选粘贴区
            <textarea
              value={thsImportText}
              placeholder="从手机同花顺分享/复制自选股后粘贴到这里，例如：贵州茅台 600519、平安银行 000001"
              onChange={(event) => setThsImportText(event.target.value)}
            />
          </label>
          <button type="button" onClick={importTonghuashunSymbols}><Target size={16} /> 识别并加入股票池</button>
          <label>同花顺账号
            <input
              value={thsUsername}
              placeholder="手机号 / 同花顺账号"
              onChange={(event) => setThsUsername(event.target.value)}
            />
          </label>
          <label>同花顺密码
            <input
              type="password"
              value={thsPassword}
              placeholder="仅用于本次同步，不保存"
              onChange={(event) => setThsPassword(event.target.value)}
            />
          </label>
          <label>同花顺 Cookie
            <textarea
              value={thsCookies}
              placeholder="可选：如果账号密码同步失败，粘贴浏览器里的同花顺 Cookie"
              onChange={(event) => setThsCookies(event.target.value)}
            />
          </label>
          <button type="button" disabled={!loggedIn || busy} onClick={syncTonghuashunApp}>
            <Activity size={16} /> 直接同步同花顺APP自选
          </button>
          <textarea value={symbols} onChange={(event) => setSymbols(event.target.value)} />
          <button
            type="button"
            disabled={!pool || !strategy}
            onClick={() => setWatchEnabled((enabled) => !enabled)}
          >
            <Activity size={16} /> {watchEnabled ? "停止实时盯盘" : "开启实时盯盘"}
          </button>
          {lastRefresh && <p className="watch-status">最后刷新：{lastRefresh} · 每 15 秒自动刷新</p>}
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
              <h2><CandlestickChart size={18} /> K线分析</h2>
              <div className="period-tabs">
                {periods.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={period === item.key ? "active-period" : ""}
                    onClick={() => setPeriod(item.key)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <InteractiveKLine score={selectedScore} period={period} />
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
