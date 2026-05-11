// app.js：Vue 3 主應用程式入口
// 整合 DDL 解析、欄位選擇、WHERE 條件、ORDER BY 排序、LIMIT 分頁、JOIN 多表查詢、DML 模板、ERD 關聯圖與 SQL 即時產生
// Phase 7 新增：File System Access API 儲存、.md 格式序列化（不使用 localStorage 暫存業務資料）
(function () {
  const { createApp, ref, computed, watch, onMounted } = Vue


  const app = createApp({
    components: {
      TablePanel: window.TablePanelComponent,
      SqlPreview: window.SqlPreviewComponent,
      ConditionBuilder: window.ConditionBuilderComponent,
      SortLimitPanel: window.SortLimitPanelComponent,
      JoinBuilder: window.JoinBuilderComponent,
      DmlPanel: window.DmlPanelComponent,
      ErdPanel: window.ErdPanelComponent
    },
    setup() {
      const rawDdl = ref('')
      const tables = ref([])
      const selectedTable = ref('')
      const selectedColumns = ref([])
      // DDL 輸入框錯誤訊息
      const parseError = ref('')

      // Phase 3 新增：WHERE 條件、排序、分頁狀態
      const where = ref([])
      const orderBy = ref([])
      const limit = ref(0)
      const offset = ref(0)

      // Phase 4 新增：JOIN 多表查詢狀態
      const joins = ref([])
      const joinMode = ref(false)  // 控制是否顯示 JOIN 設定區

      // Phase 5 新增：tab 切換，query = SELECT/JOIN 查詢，dml = DML 模板
      const activeTab = ref('query')

      // Phase 7 新增：儲存相關狀態
      const fileHandle = ref(null)         // FSA handle，儲存後持有，避免重複選檔
      const saveStatus = ref('')           // 短暫顯示「已儲存」或「儲存失敗」
      const saveDir     = ref(null)        // FileSystemDirectoryHandle | null，指定預設儲存目錄
      const saveDirName = ref('')          // 顯示用的目錄名稱（handle.name）
      const schemaName  = ref('prism-schema') // 儲存的檔名（不含副檔名）

      // 開始畫面：未主動進入 app 且尚無任何 DDL 時顯示
      const started  = ref(false)
      const skipMode = ref(false)   // 使用者選擇「試試看」時設為 true，阻止 onMounted 非同步還原 saveDir
      const showStart = computed(() => !started.value && !rawDdl.value.trim())

      // Phase 8 新增：方言切換與多組儲存查詢
      const dialect = ref('mysql')         // 'mysql' | 'postgresql' | 'mssql' | 'oracle'
      const savedQueries = ref([])         // [{ name, selectedTable, selectedColumns, where, orderBy, limit, offset, joins, joinMode }]
      const saveQueryName = ref('')        // 儲存查詢時的名稱輸入框
      const queryHistory = ref([])         // 複製時自動記錄，存 localStorage，最多 50 筆

      // 深色/淺色模式切換
      const isDark = ref(true)
      function toggleTheme() {
        isDark.value = !isDark.value
        if (isDark.value) {
          document.documentElement.classList.add('dark')
          localStorage.setItem('prism_theme', 'dark')
        } else {
          document.documentElement.classList.remove('dark')
          localStorage.setItem('prism_theme', 'light')
        }
      }

      // 解析 DDL，並自動偵測方言同步右上角選單
      function handleParse() {
        parseError.value = ''
        try {
          const result = window.parseDDL(rawDdl.value)
          tables.value = result
          selectedTable.value = result.length > 0 ? result[0].tableName : ''
          selectedColumns.value = []
          where.value = []
          orderBy.value = []
          dialect.value = window.detectDialect(rawDdl.value)
        } catch (e) {
          parseError.value = '解析失敗：' + e.message
        }
      }

      function normalizeTableName(name) {
        return String(name || '').trim().toLowerCase()
      }

      // 追加解析：將新 DDL 合併進現有 tables，依 tableName 去重（新增不覆蓋）
      function handleAppend(nextDdl = rawDdl.value) {
        parseError.value = ''
        try {
          const result = window.parseDDL(nextDdl)
          if (result.length === 0) {
            parseError.value = '追加失敗：檔案內沒有可解析的 CREATE TABLE'
            return
          }

          const existingNames = new Set(tables.value.map(t => normalizeTableName(t.tableName)))
          const newTables = result.filter(t => !existingNames.has(normalizeTableName(t.tableName)))
          if (newTables.length === 0) {
            parseError.value = '追加失敗：檔案內的資料表已存在'
            return
          }

          tables.value = [...tables.value, ...newTables]
          if (!selectedTable.value && tables.value.length > 0) {
            selectedTable.value = tables.value[0].tableName
          }
          rawDdl.value = [rawDdl.value.trim(), nextDdl.trim()].filter(Boolean).join('\n\n')
          dialect.value = window.detectDialect(nextDdl)
        } catch (e) {
          parseError.value = '解析失敗：' + e.message
        }
      }

      // 從 .sql 檔匯入 DDL：追加模式，允許多個 DDL 檔案一起使用 JOIN
      async function importSqlFile(event) {
        const file = event.target.files[0]
        if (!file) return
        const importedDdl = await file.text()
        // 若已有 tables 則追加，否則直接解析（首次匯入）
        if (tables.value.length > 0) {
          handleAppend(importedDdl)
        } else {
          rawDdl.value = importedDdl
          handleParse()
        }
        event.target.value = ''  // 允許重複選同一個檔案
      }

      // 切換 table 時同步清空條件、排序與 JOIN，避免殘留上一張表的設定
      function setSelectedTable(t) {
        selectedTable.value = t
        selectedColumns.value = []
        where.value = []
        orderBy.value = []
        joins.value = []
        joinMode.value = false
      }

      // 當前選中 table 的欄位定義，供 ConditionBuilder 與 SortLimitPanel 使用
      const currentTableColumns = computed(() =>
        tables.value.find(t => t.tableName === selectedTable.value)?.columns || []
      )

      // 當前選中的完整 TableSchema，供 DmlPanel 使用
      const currentTable = computed(() =>
        tables.value.find(t => t.tableName === selectedTable.value) || null
      )

      // JOIN 模式下所有參與 table 的欄位（帶 table 前綴），供欄位選取使用
      // 業務背景：多表查詢時欄位來自不同資料表，需標示來源才能正確組出 SQL
      const joinColumns = computed(() => {
        if (!joinMode.value || joins.value.length === 0) return []
        const allTables = [selectedTable.value, ...joins.value.map(j => j.toTable)]
        return allTables.flatMap(tName => {
          const t = tables.value.find(x => x.tableName === tName)
          return t ? t.columns.map(c => ({ table: tName, column: c.name })) : []
        })
      })

      function splitQualifiedColumn(value) {
        const lastDot = String(value || '').lastIndexOf('.')
        if (lastDot === -1) {
          return { table: selectedTable.value, column: value }
        }
        return {
          table: value.slice(0, lastDot),
          column: value.slice(lastDot + 1)
        }
      }

      // 即時產生 SQL（computed 自動追蹤所有相關 ref 變更）
      const sqlOutput = computed(() => {
        if (!selectedTable.value) return ''
        // JOIN 模式：使用 joinBuilder 組出含 JOIN 子句的完整 SQL
        if (joinMode.value && joins.value.length > 0) {
          const cols = selectedColumns.value.map(splitQualifiedColumn)
          return window.joinBuilder.buildJoinSql({
            baseTable: selectedTable.value,
            joins: joins.value,
            columns: cols,
            where: where.value,
            orderBy: orderBy.value,
            limit: limit.value,
            offset: offset.value,
            dialect: dialect.value
          })
        }
        // 單表模式：使用原有 buildSelect
        return window.buildSelect({
          tableName: selectedTable.value,
          columns: selectedColumns.value,
          where: where.value,
          orderBy: orderBy.value,
          limit: limit.value,
          offset: offset.value,
          dialect: dialect.value
        })
      })

      // 點擊 ERD 節點：切換至對應 table 並跳回查詢 tab
      function goToTable(tableName) {
        setSelectedTable(tableName)
        activeTab.value = 'query'
      }

      // 取得可序列化的 app state（供 lsStorage 與 mdFormat 使用）
      function getSerializableState() {
        return {
          rawDdl: rawDdl.value,
          dialect: dialect.value,
          savedQueries: savedQueries.value
        }
      }

      // 頁面載入時，套用儲存的主題偏好並嘗試從 IndexedDB 還原目錄 handle
      onMounted(async () => {
        // 載入 Query History（暫態資料，存 localStorage）
        // 相容舊版 history 條目（key 為 tableName），統一正規化為 selectedTable
        queryHistory.value = JSON.parse(localStorage.getItem('prism_query_history') || '[]')
          .map(h => h.selectedTable ? h : { ...h, selectedTable: h.tableName || '' })

        // 還原主題偏好（主題偏好不屬於業務資料，允許用 localStorage 儲存）
        const savedTheme = localStorage.getItem('prism_theme') || 'light'
        isDark.value = savedTheme === 'dark'
        if (isDark.value) document.documentElement.classList.add('dark')
        else document.documentElement.classList.remove('dark')

        // 從 IndexedDB 還原上次的儲存目錄
        // 必須在 await 後再次確認 skipMode，因為使用者可能在 await 期間點了「先試試看」
        try {
          const handle = await window.idbHandles.loadDirHandle()
          if (handle && !skipMode.value) {
            saveDir.value = handle
            saveDirName.value = handle.name
          }
        } catch (_) {}
      })

      // 自動儲存：DDL 或查詢清單變更時，若已設定儲存位置則延遲 1.5 秒寫入
      // 業務背景：避免每次細微操作都立即寫磁碟，同時確保使用者不需手動按儲存
      let _autoSaveTimer = null
      function scheduleAutoSave() {
        if (!saveDir.value && !fileHandle.value) return
        clearTimeout(_autoSaveTimer)
        _autoSaveTimer = setTimeout(() => saveToFile(), 1500)
      }
      watch(rawDdl, scheduleAutoSave)
      watch(savedQueries, scheduleAutoSave, { deep: true })

      // 儲存至 .md 檔；優先寫入指定目錄，其次使用既有 handle，最後開啟另存對話框
      async function saveToFile() {
        const content  = window.mdFormat.serialize(getSerializableState())
        const filename = (schemaName.value.trim() || 'prism-schema') + '.md'
        try {
          if (saveDir.value) {
            // 目錄模式：直接寫入指定資料夾，避免每次跳出儲存對話框
            const perm = await window.fsStorage.verifyDirPermission(saveDir.value)
            if (perm !== 'granted') {
              saveStatus.value = '需要資料夾存取權限'
              setTimeout(() => { saveStatus.value = '' }, 3000)
              return
            }
            await window.fsStorage.saveToDirectory(saveDir.value, filename, content)
          } else if (fileHandle.value) {
            await window.fsStorage.saveFile(fileHandle.value, content)
          } else {
            fileHandle.value = await window.fsStorage.saveAsFile(content, filename)
          }
          saveStatus.value = '已儲存'
          setTimeout(() => { saveStatus.value = '' }, 2000)
        } catch (e) {
          if (e.name !== 'AbortError') saveStatus.value = '儲存失敗'
          setTimeout(() => { saveStatus.value = '' }, 2000)
        }
      }

      /** 讓使用者選擇預設儲存目錄，並持久化到 IndexedDB */
      async function pickSaveDir() {
        try {
          const handle = await window.fsStorage.pickSaveDirectory()
          saveDir.value = handle
          saveDirName.value = handle.name
          await window.idbHandles.saveDirHandle(handle)
          started.value = true
        } catch (e) {
          if (e.name !== 'AbortError') alert('無法取得資料夾存取權限：' + e.message)
        }
      }

      /** 清除已設定的儲存位置 */
      async function clearSaveDir() {
        saveDir.value = null
        saveDirName.value = ''
        await window.idbHandles.clearDirHandle()
      }

      // 從 .md 檔開啟並還原狀態
      async function openFromFile() {
        try {
          const { handle, text } = await window.fsStorage.openFile()
          const state = window.mdFormat.deserialize(text)
          if (!state) { alert('檔案格式不正確'); return }
          fileHandle.value = handle
          rawDdl.value = state.rawDdl || ''
          dialect.value = state.dialect || 'mysql'
          savedQueries.value = state.savedQueries || []
          if (state.rawDdl) {
            const result = window.parseDDL(state.rawDdl)
            tables.value = result
            // 若有 savedQueries，自動載入第一組
            if (savedQueries.value.length > 0) {
              loadQuery(savedQueries.value[0])
            } else {
              selectedTable.value = result[0]?.tableName || ''
            }
          }
          started.value = true
        } catch (e) {
          if (e.name !== 'AbortError') alert('開啟失敗：' + e.message)
        }
      }

      // 降級匯出：觸發 .md 檔下載（Firefox 使用）
      function exportFile() {
        const content = window.mdFormat.serialize(getSerializableState())
        window.fsStorage.downloadFile(content)
      }

      // 降級匯入：從 file input 讀取 .md 檔並還原狀態
      async function importFromInput(event) {
        const file = event.target.files[0]
        if (!file) return
        const text = await file.text()
        const state = window.mdFormat.deserialize(text)
        if (!state) { alert('檔案格式不正確'); return }
        rawDdl.value = state.rawDdl || ''
        dialect.value = state.dialect || 'mysql'
        savedQueries.value = state.savedQueries || []
        if (state.rawDdl) {
          const result = window.parseDDL(state.rawDdl)
          tables.value = result
          if (savedQueries.value.length > 0) {
            loadQuery(savedQueries.value[0])
          } else {
            selectedTable.value = result[0]?.tableName || ''
          }
        }
      }

      // 「先試試看」：標記 skipMode 防止 onMounted async 還原 saveDir，並清除當前 session 儲存位置
      function skipStart() {
        skipMode.value = true
        saveDir.value = null
        saveDirName.value = ''
        started.value = true
      }

      // 將目前查詢狀態存入 savedQueries
      function saveCurrentQuery() {
        const name = saveQueryName.value.trim() || `查詢 ${savedQueries.value.length + 1}`
        const query = {
          name,
          selectedTable: selectedTable.value,
          selectedColumns: [...selectedColumns.value],
          where: [...where.value],
          orderBy: [...orderBy.value],
          limit: limit.value,
          offset: offset.value,
          joins: [...joins.value],
          joinMode: joinMode.value
        }
        savedQueries.value = [...savedQueries.value, query]
        saveQueryName.value = ''
      }

      // 將指定查詢設定還原至目前工作區
      function loadQuery(q) {
        selectedTable.value = q.selectedTable || ''
        selectedColumns.value = q.selectedColumns || []
        where.value = q.where || []
        orderBy.value = q.orderBy || []
        limit.value = q.limit || 0
        offset.value = q.offset || 0
        joins.value = q.joins || []
        joinMode.value = q.joinMode || false
      }

      // 從 savedQueries 刪除指定索引的查詢
      function deleteQuery(idx) {
        savedQueries.value = savedQueries.value.filter((_, i) => i !== idx)
      }

      // 複製 SQL 時自動記錄至 Query History（localStorage，最多 50 筆，新的在前）
      function addToHistory() {
        if (!sqlOutput.value) return
        const entry = {
          sql: sqlOutput.value,
          dialect: dialect.value,
          selectedTable: selectedTable.value,
          selectedColumns: [...selectedColumns.value],
          where: JSON.parse(JSON.stringify(where.value)),
          orderBy: JSON.parse(JSON.stringify(orderBy.value)),
          limit: limit.value,
          offset: offset.value,
          joins: JSON.parse(JSON.stringify(joins.value)),
          joinMode: joinMode.value,
          timestamp: Date.now()
        }
        const list = [entry, ...queryHistory.value].slice(0, 50)
        queryHistory.value = list
        localStorage.setItem('prism_query_history', JSON.stringify(list))
      }

      function clearHistory() {
        queryHistory.value = []
        localStorage.removeItem('prism_query_history')
      }

      // 時間戳轉為易讀格式，例如「今天 14:23」或「05/07 09:11」
      function formatHistoryTime(ts) {
        const d = new Date(ts)
        const now = new Date()
        const isToday = d.toDateString() === now.toDateString()
        const hm = d.toTimeString().slice(0, 5)
        return isToday ? `今天 ${hm}` : `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${hm}`
      }

      return {
        rawDdl, tables, selectedTable, selectedColumns,
        parseError, sqlOutput,
        where, orderBy, limit, offset,
        currentTableColumns, currentTable,
        joins, joinMode, joinColumns,
        activeTab,
        fileHandle, saveStatus,
        saveDir, saveDirName, schemaName,
        fsSupported: window.fsStorage.isSupported,
        dialect, savedQueries, saveQueryName,
        queryHistory,
        started, showStart,
        importSqlFile,
        setSelectedTable,
        goToTable,
        setSelectedColumns(cols) { selectedColumns.value = cols },
        saveToFile, openFromFile, exportFile, importFromInput,
        saveCurrentQuery, loadQuery, deleteQuery,
        addToHistory, clearHistory, formatHistoryTime,
        pickSaveDir, clearSaveDir,
        skipStart,
        isDark, toggleTheme
      }
    },
    template: `
      <div class="min-h-screen bg-zinc-50 dark:bg-[#111111]">

        <!-- 開始畫面：尚未載入任何 Schema 時顯示，強制使用者明確選擇工作模式 -->
        <div v-if="showStart"
             class="fixed inset-0 bg-zinc-50 dark:bg-[#111111] flex items-center justify-center z-40">
          <div class="w-full max-w-md px-6">
            <!-- Logo -->
            <div class="flex items-center gap-3 mb-10">
              <svg width="32" height="32" viewBox="0 0 28 28" fill="none">
                <polygon points="14,2 26,24 2,24" fill="none" stroke="url(#pg2)" stroke-width="1.5"/>
                <defs>
                  <linearGradient id="pg2" x1="2" y1="24" x2="26" y2="2" gradientUnits="userSpaceOnUse">
                    <stop stop-color="#6366f1"/>
                    <stop offset="0.5" stop-color="#8b5cf6"/>
                    <stop offset="1" stop-color="#ec4899"/>
                  </linearGradient>
                </defs>
              </svg>
              <div>
                <h1 class="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Prism</h1>
                <p class="text-xs text-zinc-400 tracking-wide">SQL Query Builder</p>
              </div>
            </div>

            <!-- 選項卡片 -->
            <div class="flex flex-col gap-3">
              <!-- 開啟現有 Schema -->
              <button @click="openFromFile"
                      class="group w-full text-left px-5 py-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-sm transition-all">
                <div class="flex items-center justify-between">
                  <div>
                    <div class="text-sm font-medium text-zinc-900 dark:text-zinc-100">開啟 Schema 檔案</div>
                    <div class="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">載入現有的 .md 檔案</div>
                  </div>
                  <span class="text-zinc-300 dark:text-zinc-600 group-hover:text-indigo-400 transition-colors text-lg">→</span>
                </div>
              </button>

              <!-- 指定目錄新建 -->
              <button @click="pickSaveDir()"
                      class="group w-full text-left px-5 py-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-sm transition-all">
                <div class="flex items-center justify-between">
                  <div>
                    <div class="text-sm font-medium text-zinc-900 dark:text-zinc-100">選擇儲存位置</div>
                    <div class="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">指定資料夾，新建 Schema</div>
                  </div>
                  <span class="text-zinc-300 dark:text-zinc-600 group-hover:text-indigo-400 transition-colors text-lg">→</span>
                </div>
              </button>

              <!-- 直接貼入 DDL（跳過存檔設定） -->
              <button @click="skipStart"
                      class="w-full text-center py-3 text-xs text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors">
                先試試看，不儲存
              </button>
            </div>

            <!-- 深淺色切換（開始畫面底部） -->
            <div class="mt-10 flex justify-center">
              <button @click="toggleTheme"
                      class="text-xs text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 transition-colors">
                {{ isDark ? '切換淺色模式' : '切換深色模式' }}
              </button>
            </div>
          </div>
        </div>

        <div class="max-w-6xl mx-auto px-6 py-8 flex flex-col gap-8">

        <!-- Header -->
        <header class="flex items-center justify-between pb-6 border-b border-zinc-200 dark:border-zinc-800">
          <div class="flex items-center gap-3">
            <!-- Prism 色彩稜柱圖示 -->
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <polygon points="14,2 26,24 2,24" fill="none" stroke="url(#pg)" stroke-width="1.5"/>
              <defs>
                <linearGradient id="pg" x1="2" y1="24" x2="26" y2="2" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#6366f1"/>
                  <stop offset="0.5" stop-color="#8b5cf6"/>
                  <stop offset="1" stop-color="#ec4899"/>
                </linearGradient>
              </defs>
            </svg>
            <div>
              <h1 class="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Prism</h1>
              <p class="text-xs text-zinc-400 dark:text-zinc-500 tracking-wide">SQL Query Builder</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <!-- 已載入的資料表數量：放在方言選單左邊，讓使用者快速掌握目前 schema 規模 -->
            <span v-if="tables.length > 0"
                  class="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 tabular-nums">
              {{ tables.length }} 張資料表
            </span>
            <!-- 方言選擇器：影響分頁語法（LIMIT vs OFFSET...FETCH） -->
            <select v-model="dialect"
                    class="text-xs px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors cursor-pointer">
              <option value="mysql">MySQL</option>
              <option value="postgresql">PostgreSQL</option>
              <option value="mssql">MSSQL</option>
              <option value="oracle">Oracle</option>
            </select>
            <!-- 深色/淺色模式切換按鈕 -->
            <button @click="toggleTheme"
                    class="w-8 h-8 flex items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-sm"
                    :title="isDark ? '切換淺色模式' : '切換深色模式'">
              {{ isDark ? '☀' : '🌙' }}
            </button>
            <!-- 儲存位置設定：讓使用者指定預設資料夾，避免每次另存都要手動選路徑 -->
            <div class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 text-xs">
              <span class="text-zinc-400 dark:text-zinc-500">儲存至</span>
              <template v-if="saveDirName">
                <span class="text-zinc-700 dark:text-zinc-300 font-medium max-w-[120px] truncate" :title="saveDirName">
                  {{ saveDirName }}
                </span>
                <span class="text-zinc-300 dark:text-zinc-600">/</span>
                <input v-model="schemaName"
                       class="w-24 bg-transparent text-zinc-700 dark:text-zinc-300 outline-none border-b border-dashed border-zinc-300 dark:border-zinc-600 focus:border-indigo-400 transition-colors"
                       placeholder="檔名" />
                <span class="text-zinc-400 dark:text-zinc-500">.md</span>
                <button @click="clearSaveDir"
                        class="ml-1 text-zinc-300 dark:text-zinc-600 hover:text-red-500 transition-colors">✕</button>
              </template>
              <template v-else>
                <button @click="pickSaveDir"
                        class="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition-colors font-medium">
                  選擇資料夾
                </button>
              </template>
            </div>
            <!-- FSA 支援時顯示開啟/儲存；不支援時顯示匯入/匯出 -->
            <template v-if="fsSupported">
              <button @click="openFromFile"
                      class="text-xs px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                開啟
              </button>
              <button @click="saveToFile"
                      class="text-xs px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition-colors font-medium">
                {{ fileHandle ? '儲存' : '另存新檔' }}
              </button>
            </template>
            <template v-else>
              <label class="text-xs px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer">
                匯入
                <input type="file" accept=".md,.txt" class="hidden" @change="importFromInput" />
              </label>
              <button @click="exportFile"
                      class="text-xs px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition-colors font-medium">
                匯出
              </button>
            </template>
            <!-- DDL 匯入/追加：移至此處，緊接在儲存按鈕右側 -->
            <label class="text-xs px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer">
              {{ tables.length > 0 ? '追加 .sql' : '匯入 .sql' }}
              <input type="file" accept=".sql,.txt" class="hidden" @change="importSqlFile" />
            </label>
            <span v-if="parseError" class="text-xs text-red-500">{{ parseError }}</span>
            <span v-if="saveStatus" class="text-xs text-green-700 dark:text-green-400">{{ saveStatus }}</span>
          </div>
        </header>

        <!-- Tab 切換列（選了 table 才顯示） -->
        <div v-if="tables.length > 0" class="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
          <button v-for="tab in [
            ['query', 'SELECT / JOIN', ''],
            ['dml', 'DML', '產生 INSERT / UPDATE / DELETE 語法'],
            ['erd', 'ERD', '視覺化檢視資料表關聯圖'],
            ['history', 'History', '']
          ]" :key="tab[0]"
                  @click="activeTab = tab[0]"
                  :title="tab[2]"
                  :class="[
                    'px-4 py-2.5 text-sm -mb-px border-b-2 transition-colors',
                    activeTab === tab[0]
                      ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 font-medium'
                      : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                  ]">
            {{ tab[1] }}
          </button>
        </div>

        <!-- SELECT / JOIN 查詢頁籤內容 -->
        <div v-show="activeTab === 'query'">
          <!-- 儲存目前查詢 -->
          <div v-if="selectedTable" class="flex items-center gap-2 mb-4">
            <input v-model="saveQueryName"
                   placeholder="為目前查詢命名…"
                   class="flex-1 text-xs px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-300 dark:placeholder:text-zinc-600 focus:border-indigo-400 transition-colors outline-none" />
            <button @click="saveCurrentQuery"
                    class="text-xs px-3 py-1.5 rounded-md border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors whitespace-nowrap">
              + 儲存查詢
            </button>
          </div>

          <!-- 已儲存查詢列表 -->
          <div v-if="savedQueries.length > 0" class="mb-5">
            <div class="text-[11px] font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-2">已儲存查詢</div>
            <div class="flex flex-wrap gap-1.5">
              <div v-for="(q, idx) in savedQueries" :key="idx"
                   class="flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs">
                <button @click="loadQuery(q)"
                        class="text-zinc-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                  {{ q.name }}
                </button>
                <button @click="deleteQuery(idx)"
                        class="w-4 h-4 flex items-center justify-center rounded-full text-zinc-300 dark:text-zinc-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors">
                  ✕
                </button>
              </div>
            </div>
          </div>

          <!-- 主工作區：左欄 Table/Column，右欄 SQL 預覽 + 所有條件設定 -->
          <div v-if="tables.length > 0" class="grid grid-cols-2 gap-6 items-start">

            <!-- 左欄：資料表清單 + 欄位勾選 -->
            <TablePanel
              :tables="tables"
              :selected-table="selectedTable"
              :selected-columns="selectedColumns"
              :join-mode="joinMode"
              :joins="joins"
              @select-table="setSelectedTable"
              @update-columns="setSelectedColumns"
            />

            <!-- 右欄：SQL 預覽 + JOIN 開關 + 所有查詢條件 -->
            <div class="flex flex-col gap-5">
              <!-- SQL 即時預覽 -->
              <SqlPreview :sql="sqlOutput" @copy="addToHistory" />

              <!-- 以下僅在選定資料表後顯示 -->
              <template v-if="selectedTable">
                <!-- JOIN 模式開關 -->
                <label class="inline-flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 cursor-pointer select-none hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors w-fit">
                  <input type="checkbox" v-model="joinMode" class="accent-indigo-500 cursor-pointer" />
                  啟用 JOIN 多表查詢
                </label>

                <!-- JOIN 設定（JOIN 模式開啟後顯示） -->
                <div v-if="joinMode">
                  <div class="text-[11px] font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3">JOIN 設定</div>
                  <JoinBuilder
                    :tables="tables"
                    :base-table="selectedTable"
                    :joins="joins"
                    @update-joins="joins = $event"
                  />
                </div>

                <!-- WHERE 條件 + 排序與分頁 -->
                <div :class="['grid gap-4', joinMode ? 'grid-cols-1' : 'grid-cols-2']">
                  <ConditionBuilder
                    :columns="joinMode && joins.length > 0 ? joinColumns.map(c => ({ name: c.table + '.' + c.column })) : currentTableColumns"
                    :where="where"
                    @update-where="where = $event"
                  />
                  <SortLimitPanel
                    :columns="joinMode && joins.length > 0 ? joinColumns.map(c => ({ name: c.table + '.' + c.column })) : currentTableColumns"
                    :order-by="orderBy"
                    :limit="limit"
                    :offset="offset"
                    @update-order-by="orderBy = $event"
                    @update-limit="limit = $event"
                    @update-offset="offset = $event"
                  />
                </div>
              </template>
            </div>

          </div>
        </div>

        <!-- DML 模板頁籤內容 -->
        <div v-show="activeTab === 'dml'" class="pt-4 flex flex-col gap-4">
          <p class="text-xs text-zinc-500 dark:text-zinc-400">
            <strong class="font-medium text-zinc-700 dark:text-zinc-300">💡 DML 操作說明：</strong>選擇資料表後，切換上方「INSERT / UPDATE / DELETE」模式與「佔位符風格（:name 或 ?）」，系統會自動產生對應的 SQL 語法模板，您可以直接複製使用於您的後端程式碼中。
          </p>
          <DmlPanel :table="currentTable" />
        </div>

        <!-- ERD 關聯圖頁籤內容 -->
        <div v-show="activeTab === 'erd'" class="pt-4 flex flex-col gap-4">
          <p class="text-xs text-zinc-500 dark:text-zinc-400">
            <strong class="font-medium text-zinc-700 dark:text-zinc-300">💡 ERD 操作說明：</strong>此處顯示資料表的 Foreign Key 關聯圖。您可以拖曳畫面來檢視完整的結構，或直接<strong class="text-indigo-600 dark:text-indigo-400">點擊資料表方塊</strong>，系統會為您自動切換至該資料表的查詢與操作介面。
          </p>
          <ErdPanel :tables="tables" :base-table="selectedTable" @select-table="setSelectedTable" />
        </div>

        <!-- Query History 頁籤內容：複製時自動記錄，最多 50 筆 -->
        <div v-show="activeTab === 'history'" class="pt-4">
          <div v-if="queryHistory.length === 0" class="text-xs text-zinc-400 dark:text-zinc-500 text-center py-8">
            尚無記錄，複製 SQL 後自動儲存
          </div>
          <div v-else>
            <div class="flex items-center justify-between mb-3">
              <span class="text-[11px] font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500">{{ queryHistory.length }} 筆記錄</span>
              <button @click="clearHistory"
                      class="text-[11px] text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                清除全部
              </button>
            </div>
            <div class="flex flex-col gap-2">
              <div v-for="(h, idx) in queryHistory" :key="idx"
                   class="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-3">
                <div class="flex items-center justify-between mb-1.5">
                  <div class="flex items-center gap-1.5">
                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 font-mono uppercase">{{ h.dialect }}</span>
                    <span class="text-[10px] text-zinc-400 dark:text-zinc-500">{{ h.selectedTable }}</span>
                  </div>
                  <span class="text-[10px] text-zinc-400 dark:text-zinc-500">{{ formatHistoryTime(h.timestamp) }}</span>
                </div>
                <pre class="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono truncate mb-2">{{ h.sql.split('\\n')[0] }}</pre>
                <div class="flex gap-2">
                  <button @click="loadQuery(h); activeTab = 'query'"
                          class="text-[11px] px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                    載入
                  </button>
                  <button @click="navigator.clipboard.writeText(h.sql)"
                          class="text-[11px] px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                    複製 SQL
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        </div>
      </div>
    `
  })

  app.mount('#app')
})()
