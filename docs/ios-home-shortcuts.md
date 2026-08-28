# iPhone 主畫面捷徑：開始／結束計時

Karen Calendar **無法**在「同一個」主畫面 App 圖示上長按出選單（iOS 不支援 PWA shortcuts）。  
但你可以用 **iOS「捷徑」App** 建立 **兩個（或多個）主畫面圖示**，一鍵開啟 Karen 並自動執行計時動作。

---

## 事前準備

1. 已在 iPhone Safari **加入主畫面**（PWA），並 **登入過一次** GitHub 設定  
2. 已 **push 最新版** Karen 到 GitHub Pages（深層連結需線上版才有）

你的網址（依實際部署調整）：

```
https://shelan46k.github.io/KarenCalendar/
```

---

## 支援的網址參數

| 動作 | 網址 |
|------|------|
| 開始計時 | `https://shelan46k.github.io/KarenCalendar/?action=start-timer` |
| 結束計時（開啟分類選單） | `https://shelan46k.github.io/KarenCalendar/?action=end-timer` |

也接受別名：`?action=start`、`?action=end`、`?action=stop-timer` 等。

---

## 建立「開始計時」主畫面圖示

1. 開啟 iPhone **「捷徑」** App  
2. 右上角 **＋** → **新增動作**  
3. 搜尋並加入 **「打開 URL」**（Open URLs）  
4. 網址貼上：

   ```
   https://shelan46k.github.io/KarenCalendar/?action=start-timer
   ```

5. 點捷徑名稱，改為 **「Karen 開始計時」**  
6. 右上角 **完成**  
7. 在捷徑列表 **長按** 剛建立的捷徑 → **分享** → **加入主畫面**  
8. 可自訂圖示名稱（例如「開始計時 ❤️」）→ **加入**

之後點主畫面圖示：Karen 會開啟並 **自動開始計時**（若已在計時中則維持原狀）。

---

## 建立「結束計時」主畫面圖示

步驟同上，網址改為：

```
https://shelan46k.github.io/KarenCalendar/?action=end-timer
```

名稱例如 **「Karen 結束計時」**。

點圖示後 Karen 會開啟並 **跳出「選擇分類」對話框**——仍需點一個分類（或自訂文字）才會寫入行程並結束。  
（捷徑無法代替你選分類，這一步必須在 App 內完成。）

---

## 使用建議

| 情境 | 建議 |
|------|------|
| 快速開始一段工作 | 點「開始計時」圖示 |
| 做完要記錄 | 點「結束計時」→ 選分類 |
| 已在 Karen 裡 | 可直接用畫面上的按鈕，不必開捷徑 |
| 第一次使用 | 先開一次 Karen 主 App 完成登入 |

---

## 常見問題

**Q：捷徑開起來像 Safari 分頁，不是全螢幕 App？**  
A：請確認 Karen 已用 Safari「加入主畫面」。之後可從 Karen 主圖示進入；捷徑仍會開啟同一網址並執行動作。

**Q：結束計時能不能完全不開 App？**  
A：不行。結束必須選分類寫入 GitHub，至少需要開 App 點一下分類。

**Q：本機 `npm run dev` 可以測嗎？**  
A：可以，網址改成 `http://你的電腦IP:5173/KarenCalendar/?action=start-timer`（手機與電腦同一 Wi‑Fi）。

---

## 與 GitHub 捷徑文件的差別

- [`ios-shortcut-github.md`](./ios-shortcut-github.md)：行事曆事件 **自動寫入 GitHub**（較複雜）  
- **本文件**：Karen **網頁內建計時器** + 主畫面一鍵開始／結束（較簡單，推薦日常使用）
