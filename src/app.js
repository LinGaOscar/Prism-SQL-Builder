// app.js：Vue 3 主應用程式入口
// 整合 DDL 解析、欄位選擇、WHERE 條件、ORDER BY 排序、LIMIT 分頁、JOIN 多表查詢、DML 模板、ERD 關聯圖與 SQL 即時產生
// Phase 7 新增：localStorage 暫存、File System Access API 儲存、.md 格式序列化
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
      const showMigratePrompt = ref(false) // 是否顯示 localStorage 遷移提示
      const saveStatus = ref('')           // 短暫顯示「已儲存」或「儲存失敗」

      // Phase 8 新增：方言切換與多組儲存查詢
      const dialect = ref('mysql')         // 'mysql' | 'postgresql' | 'mssql' | 'oracle'
      const savedQueries = ref([])         // [{ name, selectedTable, selectedColumns, where, orderBy, limit, offset, joins, joinMode }]
      const saveQueryName = ref('')        // 儲存查詢時的名稱輸入框

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

      // 解析 DDL
      function handleParse() {
        parseError.value = ''
        try {
          const result = window.parseDDL(rawDdl.value)
          tables.value = result
          selectedTable.value = result.length > 0 ? result[0].tableName : ''
          selectedColumns.value = []
          where.value = []
          orderBy.value = []
        } catch (e) {
          parseError.value = '解析失敗：' + e.message
        }
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

      // 即時產生 SQL（computed 自動追蹤所有相關 ref 變更）
      const sqlOutput = computed(() => {
        if (!selectedTable.value) return ''
        // JOIN 模式：使用 joinBuilder 組出含 JOIN 子句的完整 SQL
        if (joinMode.value && joins.value.length > 0) {
          const cols = selectedColumns.value.map(s => {
            const parts = s.split('.')
            // "table.column" 格式拆解，純欄位名稱則歸屬 baseTable
            return parts.length === 2 ? { table: parts[0], column: parts[1] } : { table: selectedTable.value, column: s }
          })
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

      // 自動存入 localStorage（500ms debounce 避免過於頻繁寫入）
      let lsTimer = null
      watch([rawDdl, dialect, selectedTable, selectedColumns, where, orderBy, limit, offset, savedQueries], () => {
        clearTimeout(lsTimer)
        lsTimer = setTimeout(() => {
          window.lsStorage.lsSave(getSerializableState())
        }, 500)
      }, { deep: true })

      // 頁面載入時，嘗試從 localStorage 還原上次工作狀態，並套用儲存的主題
      onMounted(() => {
        const savedTheme = localStorage.getItem('prism_theme') || 'dark'
        isDark.value = savedTheme === 'dark'
        if (isDark.value) document.documentElement.classList.add('dark')
        else document.documentElement.classList.remove('dark')

        if (window.lsStorage.lsHasData()) {
          const saved = window.lsStorage.lsLoad()
          rawDdl.value = saved.rawDdl || ''
          dialect.value = saved.dialect || 'mysql'
          savedQueries.value = saved.savedQueries || []
          if (saved.rawDdl) {
            const result = window.parseDDL(saved.rawDdl)
            tables.value = result
            // 若有 savedQueries，自動載入第一組
            if (savedQueries.value.length > 0) {
              loadQuery(savedQueries.value[0])
            } else {
              selectedTable.value = result[0]?.tableName || ''
            }
          }
          showMigratePrompt.value = true  // 提示使用者是否遷移至 .md 檔
        }
      })

      // 儲存至 .md 檔（已有 handle 直接寫入，否則開啟另存對話框）
      async function saveToFile() {
        const content = window.mdFormat.serialize(getSerializableState())
        try {
          if (fileHandle.value) {
            await window.fsStorage.saveFile(fileHandle.value, content)
          } else {
            fileHandle.value = await window.fsStorage.saveAsFile(content)
          }
          saveStatus.value = '已儲存'
          setTimeout(() => { saveStatus.value = '' }, 2000)
        } catch (e) {
          if (e.name !== 'AbortError') saveStatus.value = '儲存失敗'
          setTimeout(() => { saveStatus.value = '' }, 2000)
        }
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

      // 遷移確認：儲存為 .md 後清除 localStorage
      async function confirmMigrate() {
        await saveToFile()
        window.lsStorage.lsClear()
        showMigratePrompt.value = false
      }

      function dismissMigrate() {
        showMigratePrompt.value = false
      }

      // 將目前查詢狀態存入 savedQueries 並立即寫入 localStorage
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
        window.lsStorage.lsSave(getSerializableState())
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

      return {
        rawDdl, tables, selectedTable, selectedColumns,
        parseError, sqlOutput,
        where, orderBy, limit, offset,
        currentTableColumns, currentTable,
        joins, joinMode, joinColumns,
        activeTab,
        fileHandle, showMigratePrompt, saveStatus,
        fsSupported: window.fsStorage.isSupported,
        dialect, savedQueries, saveQueryName,
        handleParse,
        setSelectedTable,
        goToTable,
        setSelectedColumns(cols) { selectedColumns.value = cols },
        saveToFile, openFromFile, exportFile, importFromInput,
        confirmMigrate, dismissMigrate,
        saveCurrentQuery, loadQuery, deleteQuery,
        isDark, toggleTheme
      }
    },
    template: `
      <div class="min-h-screen bg-zinc-50 dark:bg-[#111111]">
        <div class="max-w-6xl mx-auto px-6 py-8 flex flex-col gap-8">

        <!-- localStorage 遷移提示 toast -->
        <div v-if="showMigratePrompt"
             class="fixed top-5 right-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-5 shadow-lg z-50 max-w-xs">
          <p class="text-sm text-zinc-700 dark:text-zinc-300 mb-4 leading-relaxed">偵測到上次的工作狀態，已自動還原。<br>是否儲存為 .md 檔？</p>
          <div class="flex gap-2">
            <button @click="confirmMigrate" class="text-xs px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">儲存為 .md</button>
            <button @click="dismissMigrate" class="text-xs px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">略過</button>
          </div>
        </div>

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
            <span v-if="saveStatus" class="text-xs text-green-700 dark:text-green-400">{{ saveStatus }}</span>
          </div>
        </header>

        <!-- DDL 輸入區 -->
        <div class="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
          <div class="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800">
            <span class="text-[11px] font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500">DDL</span>
            <div class="flex items-center gap-2">
              <button @click="handleParse"
                      class="text-xs px-3 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition-colors font-medium">
                解析
              </button>
              <span v-if="parseError" class="text-xs text-red-500">{{ parseError }}</span>
            </div>
          </div>
          <textarea
            v-model="rawDdl"
            rows="7"
            placeholder="貼入 CREATE TABLE ... 語法"
            class="w-full bg-transparent text-zinc-800 dark:text-zinc-200 px-4 py-3 text-sm font-code border-none outline-none resize-y placeholder:text-zinc-300 dark:placeholder:text-zinc-600">
          </textarea>
        </div>

        <!-- Tab 切換列（選了 table 才顯示） -->
        <div v-if="tables.length > 0" class="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
          <button v-for="tab in [['query','SELECT / JOIN'],['dml','DML'],['erd','ERD']]" :key="tab[0]"
                  @click="activeTab = tab[0]"
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

          <!-- JOIN 模式開關（選了 table 才顯示） -->
          <div class="flex items-center gap-3 mb-4" v-if="selectedTable">
            <label class="inline-flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 cursor-pointer select-none hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">
              <input type="checkbox" v-model="joinMode" class="accent-indigo-500 cursor-pointer" />
              啟用 JOIN 多表查詢
            </label>
          </div>

          <!-- 主工作區：Table 選擇 + SQL 預覽 -->
          <div v-if="tables.length > 0" class="grid grid-cols-2 gap-6" style="min-height:420px">
            <TablePanel
              :tables="tables"
              :selected-table="selectedTable"
              :selected-columns="selectedColumns"
              @select-table="setSelectedTable"
              @update-columns="setSelectedColumns"
            />
            <SqlPreview :sql="sqlOutput" />
          </div>

          <!-- 條件設定區（選了 table 才顯示） -->
          <div v-if="selectedTable" class="grid grid-cols-2 gap-6 mt-6">
            <!-- JOIN 設定：跨越兩欄，只在 JOIN 模式下顯示 -->
            <div v-if="joinMode && selectedTable" class="col-span-2">
              <div class="text-[11px] font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3">JOIN 設定</div>
              <JoinBuilder
                :tables="tables"
                :base-table="selectedTable"
                :joins="joins"
                @update-joins="joins = $event"
              />
            </div>
            <ConditionBuilder
              :columns="currentTableColumns"
              :where="where"
              @update-where="where = $event"
            />
            <SortLimitPanel
              :columns="currentTableColumns"
              :order-by="orderBy"
              :limit="limit"
              :offset="offset"
              @update-order-by="orderBy = $event"
              @update-limit="limit = $event"
              @update-offset="offset = $event"
            />
          </div>
        </div>

        <!-- DML 模板頁籤內容 -->
        <div v-show="activeTab === 'dml'" class="pt-4">
          <DmlPanel :table="currentTable" />
        </div>

        <!-- ERD 關聯圖頁籤內容 -->
        <div v-show="activeTab === 'erd'" class="pt-4">
          <ErdPanel
            :tables="tables"
            @select-table="goToTable"
          />
        </div>

        </div>
      </div>
    `
  })

  app.mount('#app')
})()
