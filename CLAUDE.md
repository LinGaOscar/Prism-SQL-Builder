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

```powershell
# 首次：下載獨立執行檔（存放於專案根目錄，已加入 .gitignore）
Invoke-WebRequest -Uri 'https://github.com/tailwindlabs/tailwindcss/releases/latest/download/tailwindcss-windows-x64.exe' -OutFile tailwindcss.exe

# 每次新增 Tailwind class 後重新產生
./tailwindcss.exe -i ./src/input.css -o ./tailwind.css --minify

# 開發期間持續監聽
./tailwindcss.exe -i ./src/input.css -o ./tailwind.css --watch
```

### 建置指令

```bat
# Windows（Tailwind + 打包一次完成）
build.bat

# 或分步執行
./tailwindcss.exe -i ./src/input.css -o ./tailwind.css --minify
pwsh ./scripts/build.ps1
```

- **本地**：輸出至 `prism.html`
- **CI（GitHub Actions）**：輸出至 `dist/index.html`，自動部署至 GitHub Pages

`vendor/`、`prism.html`、`tailwind.css` 均為本地生成物，不 commit。

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
| ERD 圖表 | Mermaid.js | CDN (jsdelivr) | vendor inline |
| DDL 解析 | 自製 Parser（IIFE） | `<script src>` | inline |
| 目錄持久化 | IndexedDB | — | — |

所有模組皆為 IIFE，透過 `window.*` 全域暴露，無 ESM import。

## 架構設計

### 模組載入順序（index.html 與 build.ps1 需保持一致）

```
Vue → Mermaid
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
| 主題偏好 | localStorage | 非業務資料，允許 localStorage |

**自動儲存**：rawDdl 或 savedQueries 變更後 1.5 秒寫入（需先設定儲存目錄）。

### DDL Parser 設計

- Regex + 狀態機解析 `CREATE TABLE`，支援 MySQL 5.7+ / PostgreSQL 12+
- 追加模式：多個 `.sql` 檔可累加（依 tableName 去重，已存在的不覆蓋）
- 無 textarea 輸入，**僅支援檔案匯入**

### SQL 方言支援

`dialect` ref 控制分頁語法差異：`mysql` / `postgresql` / `mssql` / `oracle`

### 儲存格式（.md）

DDL 與 savedQueries 以 code block 結構序列化，人類可讀且適合版控。`mdFormat.serialize()` / `mdFormat.deserialize()` 負責轉換。

## 關鍵邊界條件（DDL Parser）

- 複合主鍵 `PRIMARY KEY (col1, col2)`
- 行內 vs 表級約束混用
- 欄位預設值含括號，例如 `DEFAULT (CURRENT_TIMESTAMP)`
- 帶引號的識別符，例如 `` `table_name` `` 或 `"table_name"`
