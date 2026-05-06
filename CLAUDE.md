# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

**Prism** 是一個離線 SQL Query Builder，核心設計原則：

- 單一自含 HTML 檔案，零安裝、零依賴
- 使用者貼入 DDL → 視覺化選欄 → 自動產生 SQL
- 所有運算在瀏覽器本地執行，資料不離開本機

## 開發環境

無需 build 流程。直接用瀏覽器開啟 HTML 檔案即可運行：

```
# 本地開發
start index.html          # Windows
open index.html           # macOS

# 或用 VS Code Live Server 取得 HMR 效果
```

測試 DDL Parser 邏輯時，可在瀏覽器 console 直接呼叫模組函式。

## 技術棧

| 用途 | 技術 | 載入方式 |
|------|------|----------|
| 響應式 UI | Vue 3 | CDN → 發布時 inline |
| 樣式 | Tailwind CSS | CDN → 發布時 inline |
| ERD 圖表 | Mermaid.js | CDN → 發布時 inline |
| DDL 解析 | 自製 Parser | 內嵌 JS |

> **發布原則**：將所有 CDN 函式庫 inline 進單一 HTML，確保完全離線可用。

## 架構設計

### 核心模組分層

```
DDL Parser (Regex + State Machine)
    ↓ 解析結果: TableSchema[]
Vue 3 App (reactive state)
    ↓ 使用者操作
SQL Builder (pure functions)
    ↓ 產出
SQL Output
```

### DDL Parser 設計

- 以 Regex + 狀態機解析 `CREATE TABLE` 語法
- 支援 MySQL 5.7+ / PostgreSQL 12+
- 需處理：PRIMARY KEY、FOREIGN KEY、UNIQUE、INDEX
- 欄位型別映射：INT、BIGINT、VARCHAR、TEXT、TIMESTAMP、BOOLEAN、DECIMAL、JSON

### 儲存策略

- 主要：File System Access API（讀寫本機 `.md` 格式檔案）
- Fallback：手動匯入/匯出（`<input type="file">` + `Blob` 下載）

## 建置順序（8 階段）

| 階段 | 項目 |
|------|------|
| 1 | DDL Parser 核心（Table / Column / FK 解析） |
| 2 | SELECT UI + 即時 SQL 預覽 |
| 3 | WHERE / ORDER BY / LIMIT 條件設定 |
| 4 | JOIN 多表查詢（FK 推薦 + Alias 處理） |
| 5 | DML 模板（INSERT / UPDATE / DELETE） |
| 6 | ERD 關聯圖（Mermaid.js 互動節點） |
| 7 | 資料儲存（File System Access API + 降級匯出入） |
| 8 | 離線打包與跨瀏覽器驗證 |

## 離線打包

發布時將所有 CDN 函式庫下載後 inline 進 HTML：

```bash
curl -o vue.global.js https://unpkg.com/vue@3/dist/vue.global.prod.js
curl -o tailwind.js https://cdn.tailwindcss.com
curl -o mermaid.min.js https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js
```

將下載內容分別貼入對應 `<script>` 標籤。inline 後體積約 1–2 MB，Mermaid 建議延遲載入以加快初始開啟速度。

## 儲存格式

以 `.md` 檔儲存，DDL 與查詢設定以 code block 結構存放，人類可讀且適合版控。換電腦時複製 `.md` 檔 → 重新選擇即可還原。

File System Access API 僅支援 Chrome / Edge；Firefox 自動降級為手動匯出入。

## 關鍵邊界條件（DDL Parser）

- 複合主鍵 `PRIMARY KEY (col1, col2)`
- 行內 vs 表級約束混用
- 欄位預設值含括號，例如 `DEFAULT (CURRENT_TIMESTAMP)`
- 帶引號的識別符，例如 `` `table_name` `` 或 `"table_name"`
