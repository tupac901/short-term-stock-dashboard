# 短线投研仪表盘

这是一个面向短线和波段研究的全栈 Web MVP。当前版本包含多用户登录、股票池、短线策略模板、综合评分、CSV 导出、提醒事件和日线级回测。

当前实现使用样例 A 股行情数据源，所有行情读取都经过统一适配器。后续可以在 `backend/app/services/data_sources/` 下替换或新增 AkShare、Tushare、同花顺导出或 Public Equity Investing 辅助数据源。

## 功能范围

- 登录 / 注册
- 个人股票池
- 短线策略模板：强势突破、回踩反弹、低位异动
- 短线评分：技术面、资金面、风险扣分、基本面排雷
- 评分排行榜和 CSV 导出
- 基础提醒配置和事件
- 日线级回测

不包含自动交易、券商下单、真实实盘账户连接、收费订阅。

## 后端

```powershell
cd backend
python -m pip install -e ".[dev]"
uvicorn app.main:create_app --factory --reload --port 8000
```

测试：

```powershell
cd backend
python -m pytest -v
```

## 前端

```powershell
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

测试和构建：

```powershell
cd frontend
npm test -- --run
npm run build
```

打开：

```text
http://127.0.0.1:5173
```

默认页面会自动使用示例账号信息。点击“登录 / 注册”，再创建研究配置、运行短线评分和日线回测。

## 公网部署

本项目已经配置为单服务部署：后端 FastAPI 同时托管 API 和前端静态页面。

### Render

1. 把项目推送到 GitHub。
2. 在 Render 新建 Blueprint，选择这个仓库。
3. Render 会读取 `render.yaml`，用 Docker 构建并启动服务。
4. 部署完成后，访问 Render 分配的公网域名。

### Docker

```powershell
docker build -t short-term-stock-dashboard .
docker run --rm -p 8000:8000 short-term-stock-dashboard
```

部署到云服务器时，把 `8000` 端口通过反向代理绑定到你的域名即可。
