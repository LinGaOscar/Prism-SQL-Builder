# Prism SQL Builder

離線 SQL Query Builder。用 Chrome / Edge 開啟 `index.html`，匯入 DDL，視覺化選欄並即時產生 SQL。

**[線上試用 →](https://lingaoscar.github.io/Prism-SQL-Builder/)**

[![Deploy](https://github.com/LinGaOscar/Prism-SQL-Builder/actions/workflows/deploy.yml/badge.svg)](https://github.com/LinGaOscar/Prism-SQL-Builder/actions/workflows/deploy.yml)

---

## 特色

- **零安裝、零建置**：clone 後直接開啟 `index.html`，無需任何編譯步驟
- **完全離線**：所有邏輯在瀏覽器本地執行，資料不外傳
- **多方言支援**：MySQL / PostgreSQL / MSSQL / Oracle
- **檔案式儲存**：以 `.md` 保存 DDL 與查詢設定，適合搬移與版控
- **深淺色模式**：可切換深色 / 淺色

---

## 功能

| 功能 | 說明 |
|------|------|
| DDL 解析 | 支援 MySQL / PostgreSQL / MSSQL / Oracle `CREATE TABLE`，含 `[bracket]` 與 `schema.table` |
| SELECT 查詢 | 欄位勾選、WHERE 條件、ORDER BY、LIMIT / OFFSET |
| JOIN 查詢 | FK 自動推薦、INNER / LEFT / RIGHT JOIN、欄位衝突自動加 `table.column` 前綴 |
| DML 模板 | INSERT / UPDATE / DELETE，支援 named（`:col`）與 positional（`?`）佔位符 |
| ERD 關聯圖 | 自製 SVG 渲染器，點擊節點跳至查詢設定 |
| 查詢管理 | 同一 Schema 下可儲存多組查詢，命名後一鍵還原 |

---

## 使用方式

### 支援環境

建議使用 **Chrome 或 Edge**（File System Access API 所需）。其他瀏覽器可正常使用，但儲存功能降級為手動匯入/匯出 `.md` 檔。

### 開啟方式

```bash
# clone 後，用 VS Code Live Server 或任意 HTTP 伺服器開啟
npx serve .
# 接著用 Chrome / Edge 開啟 http://localhost:3000
```

> 直接雙擊 `index.html`（`file://` 協定）無法使用 File System Access API。需透過 HTTP 伺服器開啟。

---

## 資料儲存

App 啟動時顯示開始畫面，需主動選擇：

| 選項 | 說明 |
|------|------|
| 開啟 Schema 檔案 | 載入現有 `.md` 檔，後續直接覆寫儲存 |
| 選擇儲存位置 | 指定資料夾，往後儲存自動寫入 `{名稱}.md`，資料夾由 IndexedDB 記憶 |
| 先試試看 | 不設定儲存，手動匯出 |

`.md` 格式人類可讀，適合版控，換電腦複製檔案即可還原。

localStorage 只保存主題偏好，不保存 DDL 或查詢設定。

---

## DDL 支援重點

支援常見 `CREATE TABLE` 寫法：

```sql
CREATE TABLE users (
  id INT PRIMARY KEY,
  name VARCHAR(100) NOT NULL
);

CREATE TABLE [dbo].[orders] (
  id INT PRIMARY KEY,
  user_id INT,
  FOREIGN KEY (user_id) REFERENCES [dbo].[users](id)
);
```

已涵蓋：

- 反引號、雙引號、MSSQL 方括號識別符
- `CREATE TABLE IF NOT EXISTS`
- `schema.table` / `[schema].[table]`
- 行內與表級 `PRIMARY KEY`
- 表級 `FOREIGN KEY`
- `ALTER TABLE ... ADD CONSTRAINT ... PRIMARY KEY / FOREIGN KEY`
- `AUTO_INCREMENT`、`SERIAL`
- `DEFAULT (...)`
- 跳過 `UNIQUE`、`INDEX`、`KEY` 表級定義

---

## 專案結構

```
index.html          # 主入口，直接開啟即可用
vendor/
  vue.global.js     # Vue 3（已 commit，無需下載）
storage/
  input.css         # Tailwind 原始輸入（@import tailwindcss）
  tailwind.css      # 已產生並 commit，無需重新產生
src/
  parser/           # DDL Parser（Regex + 狀態機）
  builder/          # SQL Builder（SELECT / JOIN / DML）
  storage/          # File System API / IndexedDB / .md 格式
  components/       # Vue 3 元件
  app.js            # 應用程式入口
```

---

## CI / CD

push 至 `main` branch，GitHub Actions 直接部署整個目錄至 GitHub Pages，無建置步驟。

---

## 技術棧

| 用途 | 技術 |
|------|------|
| UI 框架 | Vue 3（`vendor/vue.global.js`，已 commit） |
| 樣式 | Tailwind CSS v4（`storage/tailwind.css`，已 commit） |
| ERD 圖表 | 自製輕量 SVG 渲染器（`src/components/ErdPanel.js`） |
| DDL 解析 | 自製 Parser（Regex + 狀態機） |

---

## 已知限制

- File System Access API 需要 Chrome / Edge；其他瀏覽器降級為手動匯入/匯出。
- DDL parser 以常見 `CREATE TABLE` 為主，非標準或高度方言化語法可能需要先簡化後匯入。
