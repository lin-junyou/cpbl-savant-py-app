# CPBL 進階數據爬蟲與分析

爬取 [stats.cpbl.com.tw](https://stats.cpbl.com.tw/)（中華職棒進階數據網）所有可公開取得的資料，輸出 CSV + SQLite，並提供球員比較與簡易預測模型。

## 抓到了什麼

| 表 / 檔案 | 列數 | 說明 |
|---|---:|---|
| `players` | 448 | 全聯盟球員（一/二軍）基本資料：身高/體重、出生日期、慣用手、註冊歷程、學校、國籍 |
| `player_season` | 398 | 每位球員的 2026 年球季統計 + 百分位 PR |
| `pitch_tracking` | 346 | 投手每球種的均速/最大球速、轉速 |
| `season_pr_table` | 564 | 完整 PR 排行榜（一/二軍 × 打/投） |
| `rankings_pr_table_batter/pitcher` | 305/259 | 排行榜頁完整 PR 表 |
| `rankings_batted_ball_*` | 279/236 | 飛/滾/平飛球比例、拉/中/推打比例 |
| `rankings_exit_velocity_*` | 279/236 | 擊球初速、發射角度、甜蜜點%、最遠距離 |
| `rankings_pitch_tracking` | 473 | 各投手 × 球種統計 |
| `schedule` | 170 | 賽程/比分/勝敗投/球場 |
| `data/raw/games/*.json.gz` | 159 | 單場 play-by-play（含 Trackman 完整追蹤） |
| `data/raw/player_logs/*.json.gz` | 442 | 每位球員 pitch-by-pitch 追蹤資料 |
| `game_hitters` | 3909 | per-game 打者表現（每場×每位打者） |
| `game_pitchers` | 1491 | per-game 投手表現（含 ERA、WHIP、IP） |
| `inning_scores` | 2875 | 每局得分（一/二軍） |
| `trackman_pitches` | 48685 | pitch-by-pitch Trackman（球速/轉速/位置） |

* SQLite：`data/db/cpbl.sqlite`（1.1 MB）
* CSV：`data/csv/`（1.2 MB，14 個檔）
* 原始 JSON / HTML：`data/raw/`（354 MB，含 Trackman 軌跡資料）

## 專案結構

```
cpbl/
├── scraper/
│   ├── api.py              # /api/proxy/v1/... 後端封裝
│   ├── common.py           # HTTP session、JSON-LD / RSC 解析
│   ├── rsc_query.py        # 抓取 react-query 反水合資料
│   ├── parse_listing.py    # /players 清單頁
│   ├── parse_player.py     # /players/<id> 詳細頁
│   ├── scrape_players.py   # 全量球員爬蟲
│   ├── scrape_rankings.py  # 排行榜（4 endpoint × 2 division）
│   ├── scrape_schedule.py  # 賽程 + 單場詳情
│   └── build_game_tables.py# 從 game-detail 抽 per-game 表
├── analysis/
│   ├── compare.py          # CLI 球員比較工具（含雷達圖）
│   ├── predict.py          # xwOBA + 鎮重預測模型 + 散佈圖
│   ├── trackman.py         # Trackman 球路分析（球種、好球帶熱圖）
│   └── out/                # 比較圖、預測 CSV、熱圖
└── data/
    ├── csv/                # 14 個 CSV 檔
    ├── db/cpbl.sqlite      # SQLite
    └── raw/                # 原始 HTML / JSON / 比賽記錄
```

## 怎麼用

```bash
source venv/bin/activate
pip install requests beautifulsoup4 pandas tqdm matplotlib

# 重新抓取所有球員（全量）
python scraper/scrape_players.py

# 只抓前 5 位（debug 用）
python scraper/scrape_players.py --limit 5

# 排行榜 + 賽程
python scraper/scrape_rankings.py
python scraper/scrape_schedule.py --start 2026-03-01 --end 2026-11-30
```

### 球員比較

```bash
# 兩位球員側欄比較 + 雷達圖
python analysis/compare.py 0000001318 0000000935

# 用名字模糊比對
python analysis/compare.py --name 朱育賢 王柏融 魔鷹

# 排行榜（一軍打者 wOBA 前 10，限 80 PA 以上）
python analysis/compare.py --top 10 --role batter --division first --minpa 80 --metric woba
```

### xwOBA + 預測

```bash
# 看一軍打者的「真實能力」+ 投影 wOBA
python analysis/predict.py --top 20 --role batter --division first --minpa 50

# 加散佈圖（顯示誰被高估/低估）
python analysis/predict.py --plot --top 15 --minpa 50

# 單一球員
python analysis/predict.py --player 0000001318
```

### Trackman 球路分析

```bash
# 投手球種分布、平均球速/轉速
python analysis/trackman.py 0000007062

# 加上好球帶熱圖
python analysis/trackman.py 0000007062 --plot

# 比較多位投手
python analysis/trackman.py 0000007062 0000005151

# 打者的角度（看到什麼球種、揮空率）
python analysis/trackman.py --batter 0000000929

# 重建 trackman_pitches 表（從 raw game files）
python analysis/trackman.py --rebuild 0000007062
```

### Per-game 表

```bash
# 從 159 場比賽展開出 game_hitters / game_pitchers / inning_scores 表
python scraper/build_game_tables.py
```

## API endpoint 反向工程

CPBL 使用 Next.js App Router + react-query SSR。資料來源：
1. **HTML 內嵌**：JSON-LD `<script>` + `__next_f.push()` RSC stream（含 dehydrated react-query）
2. **後端 API**：`https://stats.cpbl.com.tw/api/proxy/v1/...`

| Endpoint | 用途 |
|---|---|
| `/v1/leaderboards/pr-table` | 完整 PR 表 |
| `/v1/leaderboards/batted-ball` | 擊球分佈 |
| `/v1/leaderboards/exit-velocity` | 擊球初速統計 |
| `/v1/leaderboards/pitch-tracking` | 球種追蹤 |
| `/v1/games/schedule/<YYYY-MM-DD>` | 當日賽程 |
| `/v1/games/<gameId>` | 單場 play-by-play + Trackman |
| `/v1/players/autocomplete` | 球員搜尋 |

注意：API 只回 2026 年資料，沒有歷史。空字串、`0`、`null` 參數要從 query 中移除，否則回 `UNKNOWN_HTTP_ERROR`。

## 限制

* 站僅有 2026 球季資料（新站）；無歷年比較
* 球員詳細頁的 `season-pr-table` 只包含合格球員（PA 不足者沒有進階數據）
* 預測模型受限於只有半季資料，請當作「真實能力估計」而非未來預測
* Trackman 軌跡資料量大（每球員 30-40 KB gzip），原始檔保留以利進一步分析
