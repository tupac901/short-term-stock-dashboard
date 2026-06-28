import { Activity, BarChart3, Download, LineChart, Play, ShieldAlert, Target } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ApiClient } from "./api/client";
import type { BacktestResult, ScoreRun, StockPool, Strategy, StrategyTemplate } from "./types";

const defaultSymbols = "600519,000001,300750,002594,601318";

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
  const [backtest, setBacktest] = useState<BacktestResult | null>(null);
  const [message, setMessage] = useState("");

  async function login() {
    setMessage("正在登录...");
    await api.registerAndLogin(email, password, "短线交易员");
    setTemplates(await api.templates());
    setLoggedIn(true);
    setMessage("已登录，可以创建股票池和策略。");
  }

  async function createResearchSetup() {
    const stockSymbols = symbols.split(/[,，\s]+/).map((item) => item.trim()).filter(Boolean);
    const nextPool = await api.createPool("今日短线池", stockSymbols);
    const template = templates.find((item) => item.key === selectedTemplate) ?? templates[0];
    const nextStrategy = await api.createStrategy(template.name, template.key, template.weights);
    setPool(nextPool);
    setStrategy(nextStrategy);
    setMessage(`已创建 ${nextPool.symbols.length} 只股票的短线池。`);
  }

  async function runScore() {
    if (!pool || !strategy) return;
    setScoreRun(await api.runScore(pool.id, strategy.current_version_id));
    setMessage("评分完成，排行榜已更新。");
  }

  async function runBacktest() {
    if (!pool || !strategy) return;
    setBacktest(await api.runBacktest(pool.id, strategy.current_version_id));
    setMessage("日线回测完成。");
  }

  const topScores = scoreRun?.scores ?? [];

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>短线投研仪表盘</h1>
          <p>量价、资金活跃、风险扣分优先，基本面用于排雷。</p>
        </div>
        <div className="status-pill"><Activity size={16} /> {loggedIn ? "研究会话已连接" : "等待登录"}</div>
      </header>

      <section className="workspace">
        <aside className="control-panel">
          <section>
            <h2>账户</h2>
            <label>邮箱<input value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label>密码<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            <button onClick={login}><ShieldAlert size={16} /> 登录 / 注册</button>
          </section>

          <section>
            <h2>股票池</h2>
            <textarea value={symbols} onChange={(event) => setSymbols(event.target.value)} />
            <label>策略模板
              <select value={selectedTemplate} onChange={(event) => setSelectedTemplate(event.target.value)}>
                {templates.map((template) => <option key={template.key} value={template.key}>{template.name}</option>)}
              </select>
            </label>
            <button disabled={!loggedIn} onClick={createResearchSetup}><Target size={16} /> 创建研究配置</button>
          </section>

          <section className="actions">
            <button disabled={!pool || !strategy} onClick={runScore}><Play size={16} /> 运行短线评分</button>
            <button disabled={!scoreRun} onClick={runBacktest}><LineChart size={16} /> 日线回测</button>
            {scoreRun && <a className="button-link" href={`http://127.0.0.1:8000/api/scoring/runs/${scoreRun.id}/export.csv`}><Download size={16} /> 导出 CSV</a>}
          </section>
          <p className="message">{message}</p>
        </aside>

        <section className="results">
          <div className="metric-grid">
            <div><span>股票池</span><strong>{pool?.symbols.length ?? 0}</strong></div>
            <div><span>策略</span><strong>{strategy?.name ?? "-"}</strong></div>
            <div><span>Top 分数</span><strong>{topScores[0]?.total_score ?? "-"}</strong></div>
            <div><span>回测收益</span><strong>{backtest ? `${(backtest.total_return * 100).toFixed(2)}%` : "-"}</strong></div>
          </div>

          <section className="chart-panel">
            <h2><BarChart3 size={18} /> 综合分排行榜</h2>
            <div className="chart">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topScores.slice(0, 8)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="symbol" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="total_score" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="table-panel">
            <h2>评分明细</h2>
            <table>
              <thead>
                <tr><th>代码</th><th>名称</th><th>综合</th><th>技术</th><th>资金</th><th>原因</th><th>风险</th></tr>
              </thead>
              <tbody>
                {topScores.map((score) => (
                  <tr key={score.symbol}>
                    <td>{score.symbol}</td>
                    <td>{score.name}</td>
                    <td>{score.total_score}</td>
                    <td>{score.technical_score}</td>
                    <td>{score.capital_score}</td>
                    <td>{score.reasons.join("、")}</td>
                    <td>{score.risks.join("、")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </section>
      </section>
    </main>
  );
}
