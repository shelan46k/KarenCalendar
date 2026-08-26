# Karen Calendar — 高效管理

單頁 Web 應用（SPA），介面部署在 **GitHub Pages**，任務資料透過 **GitHub REST API** 讀寫到你的 **另一個 Private Repo**。

Token、帳號、Repo 名稱**不會**寫進程式碼，只存在使用者瀏覽器的 `localStorage`。

---

## 目錄

1. [你會建立什麼](#1-你會建立什麼)
2. [本機開發](#2-本機開發)
3. [步驟 A：建立「資料」私有儲存庫](#3-步驟-a建立資料私有儲存庫)
4. [步驟 B：建立 GitHub Personal Access Token](#4-步驟-b建立-github-personal-access-token)
5. [步驟 C：上傳並部署前端到 GitHub Pages](#5-步驟-c上傳並部署前端到-github-pages)
6. [步驟 D：第一次開啟網站並登入](#6-步驟-d第一次開啟網站並登入)
7. [資料格式說明](#7-資料格式說明)
8. [功能對照](#8-功能對照)
9. [常見問題](#9-常見問題)
10. [安全提醒](#10-安全提醒)

---

## 1. 你會建立什麼

請準備 **兩個** GitHub 儲存庫（Repo）：

| Repo | 公開與否 | 用途 |
|------|----------|------|
| `KarenCalendar`（本專案） | **Public**（Pages 免費方案通常需要）或依你的方案 | 放前端程式碼，用 GitHub Pages 當網站 |
| `Karen-calendar-data`（名稱自訂） | **Private（私有）** | 只放 `tasks.json`，當雲端資料庫 |

```text
┌─────────────────────┐         GitHub REST API          ┌──────────────────────┐
│  GitHub Pages 網站  │  ── GET/PUT contents/tasks.json ─▶ │  Private Data Repo   │
│  （本專案建置結果）  │         （帶你的 PAT）              │  tasks.json          │
└─────────────────────┘                                   └──────────────────────┘
         ▲
         │ Token / owner / repo 存在瀏覽器 localStorage
         │ （不進 git、不進程式碼）
```

---

## 2. 本機開發

需要先安裝 [Node.js 20+](https://nodejs.org/)。

```bash
cd KarenCalendar
npm install
npm run dev
```

瀏覽器開啟終端機顯示的網址（通常是 `http://localhost:5173/KarenCalendar/`）。

注意：因為設定了 GitHub Pages 的 `base: '/KarenCalendar/'`，本機也要帶這個路徑。

若你的前端 Repo **不叫** `KarenCalendar`，請同時修改：

- `vite.config.js` 的 `base`
- `vite.config.js` 裡 PWA `start_url` / `scope`

改成 `'/你的Repo名稱/'`。

建置正式檔：

```bash
npm run build
npm run preview
```

---

## 3. 步驟 A：建立「資料」私有儲存庫

1. 登入 [GitHub](https://github.com) → 右上角 **+** → **New repository**。
2. Repository name 例如：`Karen-calendar-data`。
3. 選擇 **Private**。
4. 可勾選 **Add a README file**（方便建立第一個 commit）。
5. 按 **Create repository**。

### （建議）放一份空白／範例資料

在資料 Repo 新增檔案 `tasks.json`：

1. 進入該 Repo → **Add file** → **Create new file**。
2. 檔名輸入：`tasks.json`。
3. 貼上以下內容（或複製本專案 `templates/tasks.sample.json`）：

```json
{
  "version": 1,
  "tasks": [],
  "keyPlans": [],
  "reviews": {}
}
```

4. 按 **Commit changes**。

> 若你完全不建檔也沒關係：App 第一次讀取若發現檔案不存在，會自動用 API **建立**空白 `tasks.json`。

---

## 4. 步驟 B：建立 GitHub Personal Access Token

Token 就像「只給這個網站用的鑰匙」，用來讀寫你的私有資料 Repo。

### 建議：Fine-grained token（較安全）

1. 打開：[https://github.com/settings/tokens?type=beta](https://github.com/settings/tokens?type=beta)  
   路徑：GitHub 右上角頭像 → **Settings** → 左側最下方 **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**。
2. **Token name**：例如 `karen-calendar-data`。
3. **Expiration**：建議 90 天或自訂，並設行事曆提醒更新。
4. **Resource owner**：選你的帳號。
5. **Repository access**：選 **Only select repositories** → 只勾選資料 Repo。
6. **Permissions** → **Repository permissions**：
   - **Contents**：設為 **Read and write**（讀寫 `tasks.json` 必需）
   - 其他維持 No access 即可
7. 按 **Generate token**，立刻複製字串（只會顯示一次）。

也可用預填連結：  
https://github.com/settings/personal-access-tokens/new?name=karen-calendar-data&contents=write

### 備選：Classic token

1. [https://github.com/settings/tokens](https://github.com/settings/tokens) → **Generate new token (classic)**。
2. 勾選 scope：`repo`（包含私有 Repo 讀寫）。
3. 產生後複製。

> Classic 的 `repo` 範圍較大（可存取你所有私有 Repo），不如 Fine-grained 精準，但較容易設定。

---

## 5. 步驟 C：上傳並部署前端到 GitHub Pages

### C-1. 建立前端 Repo 並上傳程式碼

在 GitHub 新建一個 Repo，名稱建議：`KarenCalendar`（需與 `vite.config.js` 的 `base` 一致）。

本機執行（請替換成你的帳號）：

```bash
cd KarenCalendar
git init
git add .
git commit -m "Initial commit: Karen Calendar SPA"
git branch -M main
git remote add origin https://github.com/你的帳號/KarenCalendar.git
git push -u origin main
```

### C-2. 開啟 GitHub Pages（用 Actions 部署）

本專案已附上 `.github/workflows/deploy-pages.yml`。

1. 打開前端 Repo 頁面 → **Settings** → 左側 **Pages**。
2. **Build and deployment** → **Source** 選 **GitHub Actions**。
3. 回到 **Actions** 分頁，等待 workflow **Deploy to GitHub Pages** 跑完（推送 `main` 會自動觸發）。
4. 成功後網址通常是：

```text
https://你的帳號.github.io/KarenCalendar/
```

### C-3. 若 Actions 失敗常見原因

- Pages Source 還沒改成 GitHub Actions。
- Repo 名稱與 `base: '/KarenCalendar/'` 不一致 → 改 `vite.config.js` 後重新 push。
- 第一次需在 Actions 允許 workflow 執行（點 Enable / Approve）。

---

## 6. 步驟 D：第一次開啟網站並登入

1. 用手機或電腦打開 Pages 網址。
2. 會出現全螢幕「解鎖」設定視窗，填入：

| 欄位 | 範例 |
|------|------|
| Personal Access Token | 步驟 B 複製的 token |
| Owner | 你的 GitHub 使用者名稱 |
| Repo Name | `Karen-calendar-data` |
| 資料檔案路徑 | `tasks.json`（預設） |

3. 按 **驗證並進入**。成功後設定寫入 `localStorage`，並載入主畫面。
4. 右上角 **登出 / 清除 Token** 可清除本機設定（不會刪 GitHub 上的資料）。

### 加入主畫面（PWA）

- **iPhone Safari**：分享 →「加入主畫面」。
- **Android Chrome**：選單 →「安裝應用程式」或「加入主畫面」。

---

## 7. 資料格式說明

實際寫入私有 Repo 的 `tasks.json` 為：

```json
{
  "version": 1,
  "tasks": [
    {
      "id": "uuid-v4",
      "title": "處理郵件",
      "date": "2026-01-01",
      "timeSlot": "09:00",
      "status": "done"
    }
  ],
  "keyPlans": [
    {
      "id": "uuid-v4",
      "month": "2026-01",
      "title": "訪談 8 家大型客戶",
      "status": "todo"
    }
  ],
  "reviews": {
    "2026-01": {
      "achievements": "成果文字…",
      "reflections": "反思文字…"
    }
  }
}
```

`status` 僅允許：`done`｜`in_progress`｜`todo`。

若舊檔案是「純陣列」`[ {...}, ... ]`，App 讀取時會自動相容並在下次儲存時升級成上述物件格式。

---

## 8. 功能對照

### 左側

- 迷你月曆（切換年月、點日期連動右側週視圖）
- 今日／本月計劃統計
- Donut 本月完成率
- 本月重點計劃（可編輯標題、點圖示切換狀態）
- 本月覆盤（成果／反思，1.5 秒 debounce 後同步）

### 右側

- 週切換（上一週／本週／下一週）
- 每日完成率進度條
- 06:00～05:00（隔天）時段表
- 點格子新增／編輯任務
- 狀態圖示樂觀更新（立即變色，背景 PUT）
- 拖曳任務到其他日期／時段

### 同步機制

- 讀取：`GET /repos/{owner}/{repo}/contents/{path}`，解 base64，記住 `sha`
- 寫入：`PUT` 帶新 content + `sha` + commit message
- 文字輸入：1.5 秒 debounce
- 狀態切換／拖曳：樂觀 UI + 立即排程寫入
- 若 `sha` 衝突會自動重抓後重試一次

---

## 9. 常見問題

**Q: 驗證失敗 404？**  
A: Repo 名稱打錯，或 Token 沒有該私有 Repo 權限。

**Q: 驗證失敗 401？**  
A: Token 過期或複製不完整，請重新產生。

**Q: 網站是白屏／資源 404？**  
A: 多半是 `base` 路徑與 Repo 名稱不符，檢查 `vite.config.js`。

**Q: 手機打不開 API？**  
A: 確認用 https 的 Pages 網址；Token 仍在該瀏覽器 localStorage（換瀏覽器要重登）。

**Q: 可以多人同時編輯嗎？**  
A: 以最後寫入為準；已做簡易 sha 衝突重試，但仍建議單人使用或錯開編輯。

---

## 10. 安全提醒

- **不要**把 Token 貼到 issue、截圖公開區，或 commit 進 git。
- **不要**把資料 Repo 改成 Public（否則 tasks 內容可被任何人讀取）。
- 前端 Pages Repo 即使是 Public，也只含程式碼，不含 Token。
- 筆電若借給別人，請先按「登出 / 清除 Token」。
- Token 外洩時：到 GitHub Token 設定頁立刻 **Revoke**，再產生新的。

---

## 技術棧

- Vue 3 + Vite + Tailwind CSS
- PWA（`vite-plugin-pwa` + manifest）
- 純前端，無自架後端
