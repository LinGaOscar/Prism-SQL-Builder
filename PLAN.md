# Prism SQL Builder — 實作計劃

> 版本 1.0　2026-05-07  
> 依建置計劃書 8 階段依序執行

---

## Phase 0：文件探索（已完成）

### 確認的 API 清單

**Vue 3 CDN Global Build**
```js
const { createApp, ref, reactive, computed, watch } = Vue
createApp({ setup() { ... return { ... } } }).mount('#app')
```
- `ref(val)` → `.value` 存取；template 自動解包
- `setup()` 回傳的物件直接暴露給 template
- CDN URL：`https://unpkg.com/vue@3/dist/vue.global.prod.js`

**Mermaid.js erDiagram**
```js
mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' })
const { svg } = await mermaid.render('erd-id', 'erDiagram\n  A ||--o{ B : owns')
```
- 關係符號：`||--o{`（一對多）、`||--||`（一對一）、`}o--o{`（多對多）
- CDN URL：`https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js`

**File System Access API**
```js
if (!('showOpenFilePicker' in window)) { /* 降級 */ }
const [handle] = await window.showOpenFilePicker({ types: [{ accept: { 'text/markdown': ['.md'] } }] })
const file = await handle.getFile()
const text = await file.text()
const writable = await handle.createWritable()
await writable.write(text); await writable.close()
```

**Tailwind CSS（獨立執行檔，無需 npm）**
```bash
# 首次下載（Windows）
curl -LO https://github.com/tailwindlabs/tailwindcss/releases/latest/download/tailwindcss-windows-x64.exe
# 產生 CSS（input.css 內容：@import "tailwindcss";）
./tailwindcss-windows-x64.exe -i ./src/input.css -o ./tailwind.css --minify
```

---

## Phase 1：DDL Parser 核心

### 目標
建立 `src/parser/` 模組，解析 `CREATE TABLE` 語法，輸出結構化 `TableSchema[]`。

### 檔案清單
```
src/parser/types.js        # JSDoc 型別定義（TableSchema, ColumnDef, ForeignKey）
src/parser/ddl-parser.js   # 主解析器（Regex + 狀態機）
src/parser/testcases.js    # 測試情境與驗證執行器
```

### 資料結構（types.js）
```js
/**
 * @typedef {{ name: string, type: string, nullable: boolean, isPrimaryKey: boolean,
 *             defaultValue: string|null, isAutoIncrement: boolean }} ColumnDef
 * @typedef {{ column: string, refTable: string, refColumn: string }} ForeignKey
 * @typedef {{ tableName: string, columns: ColumnDef[], primaryKeys: string[],
 *             foreignKeys: ForeignKey[] }} TableSchema
 */
```

### 解析器核心邏輯（ddl-parser.js）
1. 以換行拆分，忽略 `--` 單行註解與 `/* */` 區塊註解
2. 偵測 `CREATE TABLE [IF NOT EXISTS] \`name\`` 進入 table scope
3. 括號計數器追蹤巢狀括號（DEFAULT 值含括號時不提前截斷）
4. 每列判斷：
   - `PRIMARY KEY (col1, col2)` → 表級主鍵
   - `FOREIGN KEY (col) REFERENCES tbl(ref)` → FK
   - 一般欄位 → 解析 name / type / NULL / DEFAULT / AUTO_INCREMENT
5. 識別符去除反引號與雙引號

### 邊界條件（必須通過）
| 情境 | 輸入範例 |
|------|---------|
| 複合主鍵 | `PRIMARY KEY (col1, col2)` |
| 行內主鍵 | `id INT PRIMARY KEY` |
| 帶括號預設值 | `created_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP)` |
| 反引號識別符 | `` `user_id` BIGINT NOT NULL `` |
| PG SERIAL | `id SERIAL PRIMARY KEY` |
| FK 定義 | `FOREIGN KEY (uid) REFERENCES users(id)` |

### 驗證清單
- [ ] `parseDDL(sql)` 回傳 `TableSchema[]`，含正確 columns / primaryKeys / foreignKeys
- [ ] testcases.js 中所有情境輸出符合預期（瀏覽器 console 執行）
- [ ] `parseDDL('')` 回傳 `[]`，不 throw

---

## Phase 2：SELECT UI + 即時 SQL 預覽

### 目標
建立主應用框架與 SELECT 查詢的完整使用者流程。

### 檔案清單
```
src/input.css                       # @import "tailwindcss"
src/builder/select-builder.js       # buildSelect(state) → SQL string（純函式）
src/components/TablePanel.js        # 欄位勾選面板（Vue 元件物件）
src/components/SqlPreview.js        # SQL 輸出區 + 複製按鈕
src/app.js                          # Vue createApp 入口，整合所有元件
index.html                          # 開發用主檔：CDN links + Tailwind link + <div id="app">
```

### index.html 結構
```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <title>Prism SQL Builder</title>
  <link rel="stylesheet" href="./tailwind.css">
</head>
<body class="bg-gray-950 text-gray-100 min-h-screen">
  <div id="app"></div>
  <script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
  <script type="module" src="./src/app.js"></script>
</body>
</html>
```

### app.js 核心 state
```js
const { createApp, ref, reactive, computed } = Vue
// state: { rawDdl, tables, selectedTable, selectedColumns, sqlOutput }
```

### select-builder.js 介面
```js
// buildSelect({ tableName, columns, alias? }) → 'SELECT col1, col2 FROM table'
export function buildSelect(state) { ... }
```

### 使用者流程
1. DDL 輸入框（textarea）→ 貼入 DDL
2. 點擊「解析」→ 呼叫 `parseDDL`，更新 tables
3. 從左側 Table 列表選擇一個 Table
4. 勾選欄位（checkbox，全選 / 清除快捷鍵）
5. SQL Preview 區即時顯示 SELECT 語句
6. 「複製」按鈕使用 `navigator.clipboard.writeText`

### 驗證清單
- [ ] 貼入 DDL → 解析 → 出現 Table 列表
- [ ] 勾選欄位 → SQL 即時更新（無需按鈕）
- [ ] 全選 → SQL 含所有欄位；取消全選 → `SELECT *`
- [ ] 複製按鈕有視覺回饋（按鈕文字暫時變為「已複製」）
- [ ] `tailwind.css` 已生成（執行 tailwind CLI 後）

---

## Phase 3：WHERE / ORDER BY / LIMIT

### 目標
在 SELECT 語句後附加完整篩選條件。

### 檔案清單
```
src/components/ConditionBuilder.js   # WHERE 條件列表元件
src/components/SortLimitPanel.js     # ORDER BY + LIMIT UI
```
同時修改：`src/builder/select-builder.js`（擴充 WHERE / ORDER / LIMIT 參數）

### 資料結構
```js
// WHERE condition
{ column: 'status', operator: 'IN', value: "'active','pending'" }
// 支援運算子：=  !=  >  >=  <  <=  LIKE  IN  IS NULL  IS NOT NULL

// ORDER BY
[{ column: 'created_at', direction: 'DESC' }]

// LIMIT / OFFSET
{ limit: 20, offset: 0 }
```

### buildSelect 擴充後簽名
```js
buildSelect({ tableName, columns, where, orderBy, limit, offset }) → string
```

### 驗證清單
- [ ] 多條件 AND 串接正確
- [ ] `IS NULL` / `IS NOT NULL` 不產生 `= NULL`
- [ ] LIMIT 0 時不輸出 LIMIT 子句
- [ ] ORDER BY 空陣列時不輸出 ORDER BY

---

## Phase 4：JOIN 多表查詢

### 目標
依 FK 自動推薦 JOIN 路徑，支援手動補充，產生多表 SELECT。

### 檔案清單
```
src/builder/join-builder.js         # FK 推薦邏輯 + buildJoinSql()
src/components/JoinBuilder.js       # JOIN 設定 UI
```

### join-builder.js 介面
```js
// 從 tables（TableSchema[]）自動找出 FK 關聯
export function suggestJoins(tables, selectedTableName) → JoinSuggestion[]
// { fromTable, fromCol, toTable, toCol, type: 'INNER'|'LEFT'|'RIGHT' }

export function buildJoinSql({ baseTable, joins, columns }) → string
// 自動處理 alias：相同欄位名加 table_prefix
```

### 驗證清單
- [ ] 兩表有 FK → 自動出現推薦 JOIN
- [ ] 多表欄位重名時自動加 `table.column` 前綴
- [ ] 手動新增無 FK 的 JOIN 條件
- [ ] JOIN 類型下拉（INNER / LEFT / RIGHT）正確反映 SQL

---

## Phase 5：DML 模板

### 目標
依欄位型別與約束產生 INSERT / UPDATE / DELETE 模板。

### 檔案清單
```
src/builder/dml-builder.js         # buildInsert / buildUpdate / buildDelete（純函式）
src/components/DmlPanel.js         # DML 模式切換 UI
```

### 邏輯規則
| 操作 | 邏輯 |
|------|------|
| INSERT | 排除 AUTO_INCREMENT/SERIAL 欄位；NOT NULL 欄位標注 `/* required */` |
| UPDATE | WHERE 條件固定為 PK；其餘欄位為佔位符 |
| DELETE | 僅 `DELETE FROM t WHERE pk = :pk` + 紅色警示文字 |
| 佔位符風格 | 可切換 `:name`（named）或 `?`（positional）|

### 驗證清單
- [ ] INSERT 不含 `id`（AUTO_INCREMENT）
- [ ] UPDATE WHERE 正確使用 PK 欄位
- [ ] 複合 PK 的 UPDATE / DELETE 產生多條件 AND

---

## Phase 6：ERD 關聯圖

### 目標
從 FK 資料自動產生 Mermaid erDiagram，支援點擊節點跳至查詢設定。

### 檔案清單
```
src/components/ErdPanel.js         # ERD 面板，使用 mermaid.render()
```

### 實作細節
```js
// 從 TableSchema[] 產生 erDiagram 文字
function buildErdDefinition(tables) {
  let def = 'erDiagram\n'
  tables.forEach(t => {
    t.foreignKeys.forEach(fk => {
      def += `  ${t.tableName} }o--|| ${fk.refTable} : "${fk.column}"\n`
    })
  })
  return def
}

// 渲染
mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' })
const { svg } = await mermaid.render('erd-diagram', buildErdDefinition(tables))
// 將 svg 注入 DOM
```

- Table 節點 click → 更新 `selectedTable`（切換至查詢設定 tab）
- 無 FK 定義時顯示「沒有外鍵關聯」提示

### 驗證清單
- [ ] 有 FK 的 DDL → ERD 正確顯示表與關聯線
- [ ] 無 FK 的 DDL → 顯示提示，不報錯
- [ ] 點擊 Table 名稱 → 切換至該 Table 查詢頁

---

## Phase 7：資料儲存

### 目標
實作 File System Access API 存檔，Firefox 自動降級，並完成 localStorage 遷移。

### 檔案清單
```
src/storage/file-system.js         # FSA API 封裝
src/storage/local-storage.js       # localStorage 讀寫 + 遷移邏輯
```

### file-system.js 介面
```js
export const isSupported = 'showOpenFilePicker' in window

export async function openFile() {
  const [handle] = await window.showOpenFilePicker({
    types: [{ description: 'Prism 設定檔', accept: { 'text/markdown': ['.md'] } }]
  })
  return { handle, text: await (await handle.getFile()).text() }
}

export async function saveFile(handle, content) {
  const writable = await handle.createWritable()
  await writable.write(content); await writable.close()
}

export async function saveAsFile(content, suggestedName = 'prism-schema.md') {
  const handle = await window.showSaveFilePicker({
    suggestedName,
    types: [{ description: 'Prism 設定檔', accept: { 'text/markdown': ['.md'] } }]
  })
  await saveFile(handle, content); return handle
}
```

### 儲存格式（.md）
```markdown
# Prism Schema

\`\`\`sql
CREATE TABLE users ( ... );
\`\`\`

\`\`\`json
{ "selectedTable": "users", "selectedColumns": ["id","name"], "where": [] }
\`\`\`
```

### 降級（Firefox）
- `isSupported === false` → 「匯出」觸發 `Blob` 下載；「匯入」用 `<input type="file">`

### localStorage 遷移
- 首次開啟偵測到 localStorage 有資料 → 顯示「偵測到舊資料，是否匯出為 .md？」
- 匯出成功後清除 localStorage

### 驗證清單
- [ ] Chrome：可開啟、修改、儲存 .md 檔，重開後還原狀態
- [ ] Firefox：匯出下載 .md；匯入 .md 還原狀態
- [ ] localStorage 有資料時顯示遷移提示

---

## Phase 8：離線打包與驗證

### 目標
將所有外部依賴 inline 進單一 `prism.html`，確保完全離線可用。

### 步驟

**1. 下載函式庫**
```bash
curl -o vue.global.js https://unpkg.com/vue@3/dist/vue.global.prod.js
curl -o mermaid.min.js https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js
# Tailwind 已由 CLI 產生 tailwind.css
```

**2. 合併 src/ 模組**（手動或腳本）
- 將 `src/parser/`, `src/builder/`, `src/storage/`, `src/components/`, `src/app.js`
  依序合併為一段 `<script>` 區塊（移除 `import/export`）

**3. prism.html 結構**
```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <title>Prism SQL Builder</title>
  <style>/* === Tailwind CSS === */[tailwind.css 內容]</style>
</head>
<body class="bg-gray-950 text-gray-100 min-h-screen">
  <div id="app"></div>
  <script>/* === Vue 3 === */[vue.global.js 內容]</script>
  <script>/* === Mermaid.js（延遲載入） === */</script>
  <script>[合併後的 src/ 內容]</script>
</body>
</html>
```

**4. 驗證清單**
- [ ] 斷開網路後用 Chrome 開啟 prism.html，所有功能正常
- [ ] Edge 開啟正常
- [ ] Firefox 開啟正常（File System API 降級為匯出入）
- [ ] 單檔大小 < 3 MB
- [ ] 完整 DDL → SELECT / JOIN / DML / ERD 流程可走完

---

## 執行注意事項

1. **模組相依順序**：Phase 1 完成後才能進行 Phase 2；Phase 2 的 select-builder 在 Phase 3 擴充
2. **Tailwind 每次新增 class 後需重跑 CLI**（或用 `--watch` 模式）
3. **每個 Phase 完成後在瀏覽器 console 手動驗證**，再進入下一階段
4. **Phase 8 前，index.html 用 CDN 連結開發；Phase 8 才 inline**
