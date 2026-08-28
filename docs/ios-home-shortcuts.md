# iPhone 主畫面捷徑：開始／結束計時

Karen Calendar **無法**在「同一個」主畫面 App 圖示上長按出選單（iOS 不支援 PWA shortcuts）。

但可以建立 **多個主畫面圖示**，每個都是 **全螢幕網頁 App**（不是 Safari 分頁）。

---

## ⚠️ 不要用「捷徑 App → 打開 URL」

iOS「捷徑」的 **「打開 URL」** 會在 **Safari 分頁** 開啟，**不會**進入加到主畫面的 PWA 全螢幕模式。  
所以若用捷徑 App 建立主畫面圖示，每次點都會像開網頁一樣。

**正確做法：用 Safari「加入主畫面」**（見下方步驟）。

---

## 事前準備

1. 已在 iPhone **Safari** 開過 Karen，並 **登入過一次** GitHub 設定  
2. 線上版已部署最新程式

你的網址（依實際部署調整）：

```
https://shelan46k.github.io/KarenCalendar/
```

---

## 推薦：Safari 加入主畫面（全螢幕 App）

### 開始計時圖示

1. 用 **Safari** 開啟（不要用捷徑 App）：

   ```
   https://shelan46k.github.io/KarenCalendar/launch/start-timer.html
   ```

2. 點下方 **分享**（方框＋箭頭）
3. 選 **加入主畫面**
4. 名稱改為 **「開始計時」** → **加入**

### 結束計時圖示

1. Safari 開啟：

   ```
   https://shelan46k.github.io/KarenCalendar/launch/end-timer.html
   ```

2. **分享** → **加入主畫面**
3. 名稱 **「結束計時」** → **加入**

之後點這些圖示會 **全螢幕開 Karen**（與主 App 相同），並自動開始計時或跳出結束分類選單。

---

## 備用：直接網址參數

若入口頁無法使用，也可在 Safari 開啟後「加入主畫面」：

| 動作 | 網址 |
|------|------|
| 開始計時 | `https://shelan46k.github.io/KarenCalendar/?action=start-timer` |
| 結束計時 | `https://shelan46k.github.io/KarenCalendar/?action=end-timer` |

> iOS 有時會忽略網址參數，**優先使用上方 `/launch/` 入口頁**。

---

## 主畫面會有哪些圖示？

| 圖示 | 用途 |
|------|------|
| Karen Calendar | 一般開啟（主 App） |
| 開始計時 | 一鍵開始 |
| 結束計時 | 一鍵結束（仍需選分類） |

可保留主 App 圖示，另外再加兩個計時專用圖示。

---

## 使用建議

| 情境 | 建議 |
|------|------|
| 快速開始 | 點「開始計時」圖示 |
| 做完要記錄 | 點「結束計時」→ 選分類 |
| 已在 Karen 裡 | 直接用畫面上的按鈕 |

---

## 常見問題

**Q：為什麼捷徑 App 建立的圖示會一直開 Safari？**  
A：這是 iOS 限制。請刪除捷徑 App 建立的主畫面圖示，改用 Safari「加入主畫面」。

**Q：結束計時能不能完全不開 App？**  
A：不行。結束必須選分類寫入 GitHub，至少要在 App 內點一下分類。

**Q：已用捷徑 App 加過主畫面，要怎麼改？**  
A：長按刪除舊圖示，改依上方 Safari 步驟重新加入。

---

## 與 GitHub 捷徑文件的差別

- [`ios-shortcut-github.md`](./ios-shortcut-github.md)：行事曆事件 **自動寫入 GitHub**（較複雜）  
- **本文件**：Karen **網頁內建計時器** + 主畫面一鍵開始／結束（推薦日常使用）
