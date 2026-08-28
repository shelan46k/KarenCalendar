# iPhone 捷徑直寫 GitHub（Karen Calendar）

本指南說明如何讓 **iOS 捷徑**在行事曆事件發生時，直接把「日程」寫進 Karen Calendar 使用的 `tasks.json`，網頁重新讀取後即可看到與 iPhone 相同的開始／結束時間（精確到分鐘／秒）。

---

## 你現在可以開始了嗎？

| 項目 | 狀態 |
|------|------|
| Karen 支援 `startAt` / `endAt` | ✅ 本機已完成 |
| GitHub Pages 線上版 | ⚠️ 需 commit + push 後才會更新 |
| 捷徑本身 | 📱 要在 iPhone「捷徑 App」手動建立（無法從 repo 一鍵匯入） |

**建議順序：**

1. 先把 Karen 程式 push 到 GitHub（讓 Pages 也是新版）
2. 在 iPhone 建立「測試用捷徑」（手動執行，確認能寫入 GitHub）
3. 測試成功後，再包成「行程結束時」自動化

---

## 整體流程

```
iPhone 行事曆事件
    ↓（自動化：當行程開始／結束）
捷徑
    1. GET tasks.json（含 sha）
    2. 解碼 Base64 → 解析 JSON
    3. 追加一筆 schedule 任務（含 startAt / endAt）
    4. PUT 回 GitHub（帶 sha）
    ↓
Karen Calendar 網頁「重新讀取」
```

Karen 與捷徑共用同一個私有 GitHub 儲存庫與 `tasks.json`，無需 iCloud API。

---

## 事前準備

### 1. 確認 Karen 的 GitHub 設定

在 Karen Calendar 設定畫面記下（與捷徑必須一致）：

| 項目 | 範例 |
|------|------|
| Owner | `shelan46k` |
| Repo | `KarenCalendar` |
| Path | `tasks.json` |
| Token | 具 **Contents 讀寫** 權限的 PAT |

### 2. 建立 GitHub Personal Access Token（給捷徑用）

1. GitHub → **Settings** → **Developer settings** → **Personal access tokens**
2. 建議使用 **Fine-grained token**
3. Repository access：選你的私有 repo
4. Permissions：**Contents** → **Read and write**
5. 產生後複製 token（只顯示一次）

> 安全提醒：Token 會存在捷徑裡，與 Karen 存在瀏覽器 localStorage 的風險相同。勿分享捷徑、勿截圖含 token 的畫面。

### 3. 時間格式（重要）

Karen 現支援 **分鐘級**時間。捷徑請寫入：

- `startAt`：`YYYY-MM-DDTHH:mm:ss`（本地時間，**不要**加 `Z` 或 `+08:00`）
- `endAt`：同上

範例：

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "與客戶開會",
  "kind": "schedule",
  "startAt": "2026-08-28T09:17:00",
  "endAt": "2026-08-28T10:45:00",
  "source": "ios-shortcut"
}
```

`kind` 固定用 `"schedule"`（日程，無狀態）。`date` / `timeSlot` / `duration` 可省略，Karen 載入時會自動從 `startAt` / `endAt` 推算。

---

## 快速版：捷徑動作順序（照加）

在 iPhone **捷徑 App → ＋ → 新增動作**，依序加入以下區塊。先用手動執行測試，成功後再接自動化。

### 0. 設定（字典，放在最前面）

**字典** 名稱 `Config`：

| 鍵 | 值（改成你的） |
|----|----------------|
| token | `ghp_xxxx…` |
| owner | `shelan46k` |
| repo | `KarenCalendar` |
| path | `tasks.json` |

> Token 建議单独建一支「只给捷徑用」的 PAT，不要和 Karen 浏览器里用的混用，方便日后撤销。

---

### 1. 接收行程（自動化用）

若此捷徑只给**自動化**用：

- 點捷徑名稱下方 **ⓘ** → 開啟「在分享表單中顯示」可選
- 自動化會傳入 **行程** 變數 → 捷徑第一個可用變數通常叫 `行程` 或 `Calendar Event`

若**手動測試**：先加 **「要求輸入」→ 文字**，假裝標題；日期用 **「目前的日期」** 代替。

---

### 2. 格式化時間

對 **行程** 取屬性（或「取得行程詳細資料」）：

1. **格式化日期**
   - 日期：`行程` 的 **開始日期**
   - 格式：**自訂** → `yyyy-MM-dd'T'HH:mm:ss`
   - 結果命名：`StartAt`

2. 再來一次 **格式化日期**
   - 日期：`行程` 的 **結束日期**
   - 格式：同上
   - 結果命名：`EndAt`

3. **文字**
   - `行程` 的 **標題** → 命名 `Title`

4. **產生 UUID**（若沒有此動作，用「雜湊」標題+StartAt 代替）→ 命名 `TaskId`

---

### 3. GET tasks.json

1. **文字**（組 URL）：

   ```
   https://api.github.com/repos/OWNER/REPO/contents/PATH
   ```

   實務上請用 **合併文字**，把 `Config` 的 owner / repo / path 填進去，例如：

   ```
   https://api.github.com/repos/
   [Config 的 owner]
   /
   [Config 的 repo]
   /contents/
   [Config 的 path]
   ```

2. **字典** `Headers`：

   | 鍵 | 值 |
   |----|-----|
   | Accept | application/vnd.github+json |
   | Authorization | Bearer [Config 的 token] |
   | X-GitHub-Api-Version | 2022-11-28 |

   > Authorization 用「文字」：`Bearer ` + Config.token

3. **取得 URL 內容**
   - URL：上一步
   - 方法：**GET**
   - 標頭：`Headers`
   - 命名結果：`FileResponse`

4. **取得字典值** `FileResponse` → `content` → **Base64 解碼** → **從輸入取得字典**（若已是文字則 **取得來自文字的 JSON**）→ 命名 `Store`

5. **取得字典值** `FileResponse` → `sha` → 命名 `FileSha`

**若 GET 回 404（檔案尚不存在）：**

- `Store` 改用手動 **字典**：`version=1`, `tasks=[]`, `todos=[]`, `keyPlans=[]`, `reviews={}`
- `FileSha` 留空，PUT 時**不要**帶 `sha` 鍵

---

### 4. 組新任務並追加（含去重）

1. **字典** `NewTask`：

   | 鍵 | 值 |
   |----|-----|
   | id | TaskId |
   | title | Title |
   | kind | schedule |
   | startAt | StartAt |
   | endAt | EndAt |
   | source | ios-shortcut |

2. **取得字典值** `Store` → `tasks`（沒有則用空清單 `[]`）

3. **過濾** 清單：`每一項` 的 **字典值 id** ≠ `TaskId`  
   （避免同一事件重複寫入）

4. **加入到清單** 尾端：`NewTask`

5. **設定字典值** `Store` → 鍵 `tasks` → 值：更新後清單

6. 若 `Store` 沒有 `version`：**設定字典值** → `version` = `1`

7. **取得來自字典的文字**（或「製作 JSON」）→ `Store` → 命名 `JsonText`

---

### 5. PUT 回 GitHub

1. **Base64 編碼** `JsonText` → `EncodedContent`

2. **字典** `PutBody`：

   | 鍵 | 值 |
   |----|-----|
   | message | Add schedule from iOS |
   | content | EncodedContent |
   | sha | FileSha |

   > 404 新建檔案時，**刪掉 sha 這一項**（或加「如果 FileSha 有值才設定 sha」）

3. **取得 URL 內容**（同 GET 的 URL）
   - 方法：**PUT**
   - 標頭：`Headers` + 加 `Content-Type` = `application/json`
   - 要求本文：`PutBody`

4. **如果** 狀態碼是 409 或 422 → **等 2 秒** → 回到步驟 3 重 GET（最多重試 2 次）

---

### 6. 手動測試

1. 在捷徑 App 按 **▶ 執行**
2. 到 Karen 網頁按 **重新讀取**
3. 週曆 → 篩選 **日程** → 應看到粉色區塊，時間為分鐘級

---

### 7. 包成自動化

1. **自動化** → **新增** → **行程** → **結束時**（建議先只用「結束時」，避免開始+結束寫兩筆）
2. 可限定行事曆
3. 動作：**執行捷徑** → 選這支
4. 關閉 **執行前先詢問**
5. 關閉 **執行時通知**（可選，減少打擾）

---

## 捷徑詳細步驟

以下以「**當行事曆行程結束時**，把該行程寫入 GitHub」為例。若要在開始時寫入，把自動化觸發改成「行程開始」即可。

### 步驟 A：建立捷徑變數（文字）

在捷徑開頭新增 **文字**，內容改為你的設定（之後步驟會引用）：

```
GITHUB_TOKEN=ghp_你的token
GITHUB_OWNER=shelan46k
GITHUB_REPO=KarenCalendar
GITHUB_PATH=tasks.json
```

或改用 **字典** 動作存四個鍵：`token`、`owner`、`repo`、`path`（較好維護）。

---

### 步驟 B：從行事曆取得事件

自動化傳入的 **行程** 變數通常包含：

- 標題（Title）
- 開始日期（Start Date）
- 結束日期（End Date）

在捷徑中：

1. **取得行程詳細資料**（或直接使用「行程」變數的屬性）
2. **格式化日期** × 2：
   - 輸入：開始日期
   - 格式：自訂 → `yyyy-MM-dd'T'HH:mm:ss`
   - 重複對結束日期
3. 將結果存成 `StartAt`、`EndAt` 文字

> iPhone 行事曆本身就是本地時間；不要用「轉換時區」除非你知道事件是 UTC。

---

### 步驟 C：產生 UUID

1. **文字** → `550e8400-e29b-41d4-a716-446655440000` 這種格式
2. 或使用 **產生 UUID**（若你的 iOS 版本有）→ 存成 `TaskId`

---

### 步驟 D：GET 現有 tasks.json

1. **文字**：組 URL  
   `https://api.github.com/repos/{owner}/{repo}/contents/{path}`  
   把 `{owner}` `{repo}` `{path}` 換成你的值。

2. **取得 URL 內容**
   - URL：上一步文字
   - 方法：**GET**
   - 標頭（Headers）：
     - `Accept` = `application/vnd.github+json`
     - `Authorization` = `Bearer ghp_你的token`
     - `X-GitHub-Api-Version` = `2022-11-28`

3. **取得字典值**
   - 從回應取 `content`（Base64 字串）
   - 從回應取 `sha`（下次 PUT 必填）

4. **Base64 解碼** → 得到 JSON 文字

5. **從輸入取得字典**（解析 JSON）→ 存成 `Store`

---

### 步驟 E：追加新任務

1. **字典**（新 task）：

   | 鍵 | 值 |
   |----|-----|
   | id | TaskId |
   | title | 行程標題 |
   | kind | schedule |
   | startAt | StartAt |
   | endAt | EndAt |
   | source | ios-shortcut |

2. **取得字典值** `Store` → `tasks`（若不存在則用空清單）

3. **加入到清單** → 把新 task 加到 `tasks` 尾端

4. **設定字典值** → 把更新後的清單寫回 `Store.tasks`

5. （可選）若 `Store` 沒有 `version`，設 `version` = `1`

6. **從字典取得文字**（或「製作 JSON」）→ 整份 Store 變 JSON 字串

---

### 步驟 F：PUT 回 GitHub

1. **Base64 編碼** JSON 字串 → `EncodedContent`

2. **字典**（PUT body）：

   | 鍵 | 值 |
   |----|-----|
   | message | Add schedule from iOS |
   | content | EncodedContent |
   | sha | 步驟 D 取得的 sha |

3. **取得 URL 內容**
   - URL：同 GET
   - 方法：**PUT**
   - 標頭：同 GET，另加 `Content-Type` = `application/json`
   - 要求本文：PUT body 字典

4. 若回傳 **409 / 422**（sha 衝突，Karen 網頁同時也在寫）：
   - **重複步驟 D～F**（重新 GET 最新 sha 再 PUT）
   - 或在捷徑尾端加「如果失敗則等 2 秒再試一次」（最多 2～3 次）

---

### 步驟 G：建立自動化

1. **捷徑 App** → **自動化** → **新增**
2. 選 **行程** → **結束時**（或「開始時」）
3. 可篩選特定行事曆
4. 動作：**執行捷徑** → 選剛建立的捷徑
5. 關閉「執行前先詢問」（才會全自動）

---

## 進階：避免重複寫入

若自動化在「開始」與「結束」各跑一次，可能產生兩筆。常見做法：

1. **只在結束時寫入**（紀錄「剛做完的事」）
2. 用 `id` = 行事曆事件的 **唯一識別碼**（若捷徑能取得），PUT 前檢查 `tasks` 是否已有相同 `id`
3. 在 title 加前綴並用 **尋找文字** 過濾重複（較簡陋）

Karen 目前以 `id` 去重；捷徑端可先 **過濾清單** 排除相同 `id` 再追加。

---

## 進階：同時寫 iCloud 與 GitHub

可以保留現有「寫 iCloud 行事曆」的捷徑，後面再接 **執行此 GitHub 捷徑**（或合併成一支）。Karen 網頁只讀 GitHub，不讀 iCloud。

---

## 測試檢查清單

- [ ] GET 能讀到 `tasks.json`，且有 `sha`
- [ ] 解碼後 JSON 含 `tasks` 陣列
- [ ] 新項目含 `startAt` / `endAt` 分鐘不為 `:00` 時，Karen 週曆區塊高度正確
- [ ] 網頁按「重新讀取」看得到新日程（粉色區塊）
- [ ] 篩選「日程」只顯示 schedule
- [ ] 與 Karen 同時編輯時，409 重試能成功

---

## API 參考（與 Karen 原始碼一致）

```
GET  https://api.github.com/repos/{owner}/{repo}/contents/{path}
PUT  https://api.github.com/repos/{owner}/{repo}/contents/{path}
```

Headers：

```
Accept: application/vnd.github+json
Authorization: Bearer {token}
X-GitHub-Api-Version: 2022-11-28
Content-Type: application/json   （僅 PUT）
```

PUT Body：

```json
{
  "message": "Add schedule from iOS",
  "content": "{base64 編碼的整份 JSON}",
  "sha": "{GET 回傳的 sha}"
}
```

---

## 常見問題

**Q：為什麼一定要分鐘，不能只用整點 `timeSlot`？**  
iPhone 行事曆事件常是 9:17–10:45 這類時間；若只寫 `09:00` ＋ 2 小時，Karen 顯示會與手機不符。

**Q：凌晨 2 點的事件會在哪一天？**  
Karen 週曆以 **06:00–隔日 05:59** 為一日。06:00 前的 `startAt` 會歸在前一天的欄位（與週曆格線一致）。

**Q：能否寫入「計劃」而非日程？**  
可以設 `kind: "plan"` 並加 `status: "todo"`，但捷徑通常只同步行事曆紀錄，建議維持 `schedule`。

**Q：Karen 需要改程式嗎？**  
需要 **支援 `startAt` / `endAt`** 的版本（本 repo 已支援）。舊資料只有 `timeSlot` 仍相容。

**Q：捷徑 PUT 成功但 Karen 看不到？**  
1. 確認 Karen 的 owner / repo / path 與捷徑相同  
2. 按「重新讀取」  
3. 週曆切到正確的那週  
4. 篩選改為「全部」或「日程」

**Q：Base64 解碼後 JSON 乱码？**  
GitHub 回傳的 `content` 可能含換行；解碼前可用「取代文字」把換行換成空字串。

**Q：能否用 iCloud 行事曆現有捷徑改？**  
可以。在原本寫 iCloud 的捷徑**最後**加「執行捷徑」呼叫這支 GitHub 捷徑，兩邊都保留。

## 相關檔案

- 資料格式：`templates/tasks.sample.json`
- GitHub 同步：`src/lib/github.js`
- 時間正規化：`src/lib/utils.js` → `normalizeTask()`
