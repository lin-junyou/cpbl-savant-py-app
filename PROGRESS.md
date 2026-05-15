# CPBL Savant — 進度紀錄（2026-05-15）

## 怎麼啟動

```bash
# 後端 (FastAPI)
cd /Users/ljy/Desktop/cpbl
source venv/bin/activate
uvicorn web.api.app:app --host 127.0.0.1 --port 8000

# 前端 (Next.js, 另一個 terminal)
cd /Users/ljy/Desktop/cpbl/web/frontend
npm run dev          # http://localhost:3000
```

兩個 server 已留在背景；若 reboot 後沒了，照上面重新啟動。

---

## 已完成清單（59 個 tasks）

### 資料層（已穩定）
- 爬蟲：448 球員、165 場比賽、48,685 筆 Trackman 球路
- SQLite `data/db/cpbl.sqlite` 16 個表 60,953 筆資料
- CSV 鏡像 `data/csv/`
- 詳細欄位文件見 `README.md`

### 後端 API（FastAPI）— `web/api/app.py`
~30 個 endpoints，主要分類：
- `/api/players/*` — bio、locations、spray、movement、contact、zone-stats、zone-woba、pitch-stats、game-logs、recent-form、velocity-decline、batted-ball-profile、count-states、run-value、pitch-grades、pitch-physics、contact-profile、plate-discipline、spin-distribution
- `/api/leaderboards/*`、`/api/league-leaders`
- `/api/stadiums`、`/api/stadiums/{name}/{spray,park-factors,distributions,hr-analysis,density}`、`/api/stadiums/comparison`
- `/api/teams/{code}`、`/api/standings`
- `/api/schedule`、`/api/games/{id}`、`/api/trajectory/{id}`
- `/api/matchup`、`/api/predict/xwoba`

### 前端頁面（Next.js + Shadcn + D3 + Three.js）— `web/frontend/src/app/`
- `/` — 首頁含 League Leaders mini widgets
- `/players` — 球員清單 + 篩選
- `/players/[id]` — 球員 profile（Savant 風格，**8 個 tabs**：總覽 / Arsenal 或 Quality / 配球紀律 PD / 球路位置 / 3D 好球帶 / 擊球落點 / 場次紀錄）
- `/teams` + `/teams/[code]` — 球隊頁
- `/standings` — 戰績榜（含 Pythagorean）
- `/matchup` — 投打對戰工具
- `/leaderboards` — 排行榜
- `/compare` — 球員 PR 並列對比
- `/predict` — xwOBA 預測模型 + scatter
- `/stadiums` + `/stadiums/[name]` — 球場頁（**7 個 tabs**：總覽+Park Factors / 散點 / 熱密度 / 3D 球場 / HR 分析 / 數值分佈 / 跨球場比較）
- `/games`、`/games/[id]`、`/games/calendar`、`/games/live`
- `/watchlist` — localStorage 收藏

### 視覺化元件 — `web/frontend/src/components/charts/`
~20 個 D3/Three 元件：
- 2D：StrikeZone、SprayChart、PitchMovement、Trajectory、PercentileBar、Histogram、ReleasePoint、ExitLaunchScatter、ZoneHeatmap、HotColdZone、PitchOutcomes、SpinDirection、ArmAngle、GameLogs、PlateDiscipline、RunValue、RecentForm、VelocityDecline、BattedBallPie、CountStates、PitchGrades、PitchPhysics、ContactProfile、ParkFactors、StadiumDensity、HRAnalysis、StadiumComparison
- 3D（Three.js）：StrikeZone3D（含 Savant 棒球貼圖 + 動畫）、SpinningBall3D（沿轉軸旋轉）、Stadium3D（球場 + 拋物線弧）

### 全 Trackman 欄位 100% 視覺化覆蓋
（含 extension、VAA、HAA、zone_speed_kph、hit_spin_rate、contact_x/y/z、land_hang_time）

---

## 還沒做的（可隨時接續）

### 已知小 bug
- 無

### 還可加的功能（依優先序）
1. **Pitch Tunneling** 球路隧道視覺化（多球種前 3m 軌跡疊加）— task #52 (deleted, 可重開)
2. **Game Recap** /games/[id] 加自動摘要
3. **日期範圍 / 球場 / 球種全域 filter** — task #57 (deleted)
4. **Mobile RWD 細節調整**
5. **Dark mode toggle**
6. **球員照片 lazy loading**
7. **季後賽 game_kind 支援**（目前 API 只 A/D 有資料）
8. **多年資料**（CPBL 進階站只有 2026，不可得）
9. **生產部署**（目前只 localhost）
10. **每日自動 scraper cron**

### 資料缺口（不可補）
- Active Spin %（需 Trackman gyroscope，CPBL 不公開）
- Sprint Speed / 跑壘（Trackman 沒提供）
- 多年歷史資料

---

## 重要檔案位置

```
cpbl/
├── data/db/cpbl.sqlite              # 主資料庫
├── data/raw/                        # 原始 HTML/JSON 快取（354 MB）
├── data/csv/                        # CSV 鏡像
├── scraper/                         # 爬蟲 Python
├── analysis/                        # CLI 工具（compare、predict、trackman）
├── web/api/app.py                   # FastAPI 全部 endpoints
├── web/frontend/src/app/            # Next.js 路由
├── web/frontend/src/components/charts/  # 視覺化元件
├── web/frontend/public/textures/ball.jpg # MLB Savant 棒球貼圖
└── PROGRESS.md                      # 本檔案
```

## 常用 URL（記得先啟動兩個 server）

- 首頁：http://localhost:3000
- 投手範例（威能帝）：http://localhost:3000/players/0000007062?tab=arsenal
- 打者範例（張育成）：http://localhost:3000/players/0000006888?tab=overview
- 球場範例：http://localhost:3000/stadiums/新莊
- 比賽 3D 軌跡：http://localhost:3000/games/2026-A-91
- 戰績：http://localhost:3000/standings
- 預測：http://localhost:3000/predict
- API docs：http://127.0.0.1:8000/docs

晚安 🌙
