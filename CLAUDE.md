# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

**Prism** 是一個離線 SQL Query Builder，核心設計原則：

- 單一自含 HTML 檔案，零安裝、零依賴
- 匯入 `.sql` DDL 檔 → 視覺化選欄 → 自動產生 SQL
- 所有運算在瀏覽器本地執行，資料不離開本機
- **僅支援 Chrome / Edge**（依賴 File System Access API）

## 開發環境

開發時開啟 `index.html`（需 HTTP 伺服器以啟用 FSA 安全上下文）：

```
# VS Code Live Server（推薦，支援 HMR）
# 或 PowerShell 快速啟動
npx serve .
```

### Tailwind CSS（獨立執行檔）

Tailwind CSS 輸入：`storage/input.css`，輸出：`storage/tailwind.css`。

```powershell
# Windows：下載獨立執行檔（存放於專案根目錄，已加入 .gitignore）
Invoke-WebRequest -Uri 'https://github.com/tailwindlabs/tailwindcss/releases/latest/download/tailwindcss-windows-x64.exe' -OutFile tailwindcss.exe

# macOS（Apple Silicon）
curl -sL https://github.com/tailwindlabs/tailwindcss/releases/latest/download/tailwindcss-macos-arm64 -o tailwindcss && chmod +x tailwindcss

# macOS（Intel）
curl -sL https://github.com/tailwindlabs/tailwindcss/releases/latest/download/tailwindcss-macos-x64 -o tailwindcss && chmod +x tailwindcss

# 每次新增 Tailwind class 後重新產生
./tailwindcss -i ./storage/input.css -o ./storage/tailwind.css --minify

# 開發期間持續監聽
./tailwindcss -i ./storage/input.css -o ./storage/tailwind.css --watch
```

### 建置指令

```bat
# Windows（Tailwind + 打包一次完成）
build.bat

# 或分步執行（Windows）
./tailwindcss.exe -i ./storage/input.css -o ./storage/tailwind.css --minify
pwsh ./scripts/build.ps1

# macOS 分步執行
./tailwindcss -i ./storage/input.css -o ./storage/tailwind.css --minify
pwsh ./scripts/build.ps1
```

- **本地**：輸出至 `prism.html`
- **CI（GitHub Actions）**：輸出至 `dist/index.html`，自動部署至 GitHub Pages

`vendor/`、`prism.html`、`storage/tailwind.css` 均為本地生成物，不 commit。

### DDL Parser 測試

`src/parser/testcases.js` 維護完整測試案例，在瀏覽器 console 執行即可驗證：

```js
// 開啟 index.html 後於 console 執行
window.parseDDL(`CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100))`)
```

## 技術棧

| 用途 | 技術 | 開發載入 | 發布 |
|------|------|---------|------|
| 響應式 UI | Vue 3 Global Build | CDN (unpkg) | vendor inline |
| 樣式 | Tailwind CSS v4 | `tailwind.css` 外部檔 | inline |
| ERD 圖表 | 自製 SVG 渲染器（ErdPanel.js） | `<script src>` | inline |
| DDL 解析 | 自製 Parser（IIFE） | `<script src>` | inline |
| 目錄持久化 | IndexedDB | — | — |

所有模組皆為 IIFE，透過 `window.*` 全域暴露，無 ESM import。

## 架構設計

### 模組載入順序（index.html 與 build.ps1 需保持一致）

```
Vue
  → parser/ddl-parser.js          (window.parseDDL)
  → storage/idb-handles.js        (window.idbHandles)
  → storage/file-system.js        (window.fsStorage)
  → storage/md-format.js          (window.mdFormat)
  → builder/select-builder.js     (window.buildSelect)
  → builder/join-builder.js       (window.joinBuilder)
  → builder/dml-builder.js        (window.dmlBuilder)
  → components/JoinBuilder.js     (window.JoinBuilderComponent)
  → components/DmlPanel.js        (window.DmlPanelComponent)
  → components/TablePanel.js      (window.TablePanelComponent)
  → components/SqlPreview.js      (window.SqlPreviewComponent)
  → components/ConditionBuilder.js (window.ConditionBuilderComponent)
  → components/SortLimitPanel.js  (window.SortLimitPanelComponent)
  → components/ErdPanel.js        (window.ErdPanelComponent)
  → app.js                        (Vue app.mount)
```

### 核心資料流

```
.sql 檔案匯入（追加模式，支援多檔）
    ↓ parseDDL() → TableSchema[]
Vue 3 app.js（所有 reactive state 集中管理）
    ↓ 使用者操作（欄位勾選 / 條件設定 / JOIN / 方言切換）
buildSelect() / joinBuilder.buildJoinSql() / dmlBuilder.*()
    ↓ computed sqlOutput
SQL 預覽區即時更新
```

### 狀態持久化策略

| 資料 | 儲存位置 | 說明 |
|------|---------|------|
| DDL + savedQueries | `.md` 檔（FSA 或手動匯出） | 主要業務資料 |
| 目錄 handle | IndexedDB（idb-handles.js） | 跨 session 記憶儲存目錄 |
| Query History | localStorage（`prism_query_history`） | 暫態，最多 50 筆，複製 SQL 時自動寫入 |
| 主題偏好 | localStorage（`prism_theme`） | 非業務資料，允許 localStorage |

**自動儲存**：rawDdl 或 savedQueries 變更後 1.5 秒寫入（需先設定儲存目錄）。

### DDL Parser 設計

- Regex + 狀態機解析 `CREATE TABLE`，支援 MySQL / PostgreSQL / MSSQL / Oracle
- `window.parseDDL(sql)` 回傳 `TableSchema[]`；型別定義見 `src/parser/types.js`（`TableSchema`、`ColumnDef`、`ForeignKey`）
- `window.detectDialect(sql)` 分析 SQL 關鍵字並回傳方言字串，由 `handleParse` / `handleAppend` 呼叫以自動切換 `dialect` ref
- MSSQL schema-qualified 表名（`[dbo].[table]` 或 `dbo.table`）解析為 `schema.table` 格式；ALTER TABLE 語句同樣支援此格式
- `ALTER TABLE ... ADD CONSTRAINT ... PRIMARY KEY / FOREIGN KEY` 語句在主 CREATE TABLE 解析完成後後處理，補回主鍵與外鍵關係
- 追加模式：多個 `.sql` 檔可累加（依 tableName 去重，已存在的不覆蓋）
- 無 textarea 輸入，**僅支援檔案匯入**

### SQL 方言支援

`dialect` ref 控制分頁語法差異：`mysql` / `postgresql` / `mssql` / `oracle`

### SQL 格式化（SqlPreview.js）

`formatSql()` 展開多欄 SELECT、多條件 WHERE（AND）、多排序 ORDER BY，每項獨立一行。由 `pretty` ref 切換，複製內容跟隨格式化狀態。

### 儲存格式（.md）

DDL 與 savedQueries 以 code block 結構序列化，人類可讀且適合版控。`mdFormat.serialize()` / `mdFormat.deserialize()` 負責轉換。

## 關鍵邊界條件（DDL Parser）

- 複合主鍵 `PRIMARY KEY (col1, col2)`
- 行內 vs 表級約束混用
- 欄位預設值含括號，例如 `DEFAULT (CURRENT_TIMESTAMP)`
- 帶引號的識別符，例如 `` `table_name` `` 或 `"table_name"`
- ALTER TABLE 中的 schema-qualified 表名（如 `[dbo].[OrderDetail]`）：ALTER TABLE 後處理 regex 必須能匹配含空白的複雜表名

## UI 慣例

- 可捲動面板（TablePanel 表格清單、欄位清單、SqlPreview）統一使用 `max-height: 480px` + `custom-scrollbar` class，套用於最外層容器 div，**不在內層 ul 另加捲動**
