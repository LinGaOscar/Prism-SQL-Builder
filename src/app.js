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
            offset: offset.value
          })
        }
        // 單表模式：使用原有 buildSelect
        return window.buildSelect({
          tableName: selectedTable.value,
          columns: selectedColumns.value,
          where: where.value,
          orderBy: orderBy.value,
          limit: limit.value,
          offset: offset.value
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
          selectedTable: selectedTable.value,
          selectedColumns: selectedColumns.value,
          where: where.value,
          orderBy: orderBy.value,
          limit: limit.value,
          offset: offset.value
        }
      }

      // 自動存入 localStorage（500ms debounce 避免過於頻繁寫入）
      let lsTimer = null
      watch([rawDdl, selectedTable, selectedColumns, where, orderBy, limit, offset], () => {
        clearTimeout(lsTimer)
        lsTimer = setTimeout(() => {
          window.lsStorage.lsSave(getSerializableState())
        }, 500)
      }, { deep: true })

      // 頁面載入時，嘗試從 localStorage 還原上次工作狀態
      onMounted(() => {
        if (window.lsStorage.lsHasData()) {
          const saved = window.lsStorage.lsLoad()
          rawDdl.value = saved.rawDdl || ''
          if (saved.rawDdl) {
            const result = window.parseDDL(saved.rawDdl)
            tables.value = result
            selectedTable.value = saved.selectedTable || (result[0]?.tableName || '')
            selectedColumns.value = saved.selectedColumns || []
            where.value = saved.where || []
            orderBy.value = saved.orderBy || []
            limit.value = saved.limit || 0
            offset.value = saved.offset || 0
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
          if (state.rawDdl) {
            const result = window.parseDDL(state.rawDdl)
            tables.value = result
            selectedTable.value = state.selectedTable || ''
            selectedColumns.value = state.selectedColumns || []
            where.value = state.where || []
            orderBy.value = state.orderBy || []
            limit.value = state.limit || 0
            offset.value = state.offset || 0
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
        if (state.rawDdl) {
          const result = window.parseDDL(state.rawDdl)
          tables.value = result
          selectedTable.value = state.selectedTable || ''
          selectedColumns.value = state.selectedColumns || []
          where.value = state.where || []
          orderBy.value = state.orderBy || []
          limit.value = state.limit || 0
          offset.value = state.offset || 0
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

      return {
        rawDdl, tables, selectedTable, selectedColumns,
        parseError, sqlOutput,
        where, orderBy, limit, offset,
        currentTableColumns, currentTable,
        joins, joinMode, joinColumns,
        activeTab,
        fileHandle, showMigratePrompt, saveStatus,
        fsSupported: window.fsStorage.isSupported,
        handleParse,
        setSelectedTable,
        goToTable,
        setSelectedColumns(cols) { selectedColumns.value = cols },
        saveToFile, openFromFile, exportFile, importFromInput,
        confirmMigrate, dismissMigrate
      }
    },
    template: `
      <div class="max-w-6xl mx-auto p-6 flex flex-col gap-6">
        <!-- localStorage 遷移提示 toast -->
        <div v-if="showMigratePrompt"
             class="fixed top-4 right-4 bg-gray-800 border border-indigo-500 rounded-lg p-4 shadow-xl z-50 max-w-sm">
          <p class="text-sm text-gray-200 mb-3">偵測到上次的工作狀態，已自動還原。<br>是否儲存為 .md 檔以便下次直接開啟？</p>
          <div class="flex gap-2">
            <button @click="confirmMigrate" class="text-sm px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white">儲存為 .md</button>
            <button @click="dismissMigrate" class="text-sm px-3 py-1 rounded border border-gray-600 text-gray-400 hover:text-gray-200">略過</button>
          </div>
        </div>

        <!-- Header -->
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-white">Prism SQL Builder</h1>
            <p class="text-gray-400 text-sm mt-1">貼入 DDL，視覺化產生 SQL 查詢</p>
          </div>
          <div class="flex items-center gap-2">
            <!-- FSA 支援時顯示開啟/儲存；不支援時顯示匯入/匯出 -->
            <template v-if="fsSupported">
              <button @click="openFromFile" class="text-sm px-3 py-1.5 rounded border border-gray-600 hover:border-gray-400 text-gray-300">開啟</button>
              <button @click="saveToFile" class="text-sm px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white">
                {{ fileHandle ? '儲存' : '另存新檔' }}
              </button>
            </template>
            <template v-else>
              <label class="text-sm px-3 py-1.5 rounded border border-gray-600 hover:border-gray-400 text-gray-300 cursor-pointer">
                匯入
                <input type="file" accept=".md,.txt" class="hidden" @change="importFromInput" />
              </label>
              <button @click="exportFile" class="text-sm px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white">匯出</button>
            </template>
            <span v-if="saveStatus" class="text-xs text-green-400">{{ saveStatus }}</span>
          </div>
        </div>

        <!-- DDL 輸入區 -->
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">DDL 輸入</label>
          <textarea
            v-model="rawDdl"
            rows="6"
            placeholder="貼入 CREATE TABLE ... 語法"
            class="w-full bg-gray-800 text-gray-100 rounded p-3 text-sm font-mono border border-gray-700 focus:outline-none focus:border-indigo-500 resize-y">
          </textarea>
          <div class="flex items-center gap-3 mt-2">
            <button @click="handleParse"
                    class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded font-medium transition-colors">
              解析 DDL
            </button>
            <span v-if="parseError" class="text-red-400 text-sm">{{ parseError }}</span>
          </div>
        </div>

        <!-- Tab 切換列（選了 table 才顯示） -->
        <div v-if="tables.length > 0" class="flex border-b border-gray-700 gap-1">
          <button v-for="tab in [['query','SELECT / JOIN'],['dml','DML 模板'],['erd','ERD 關聯圖']]" :key="tab[0]"
                  @click="activeTab = tab[0]"
                  :class="[
                    'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                    activeTab === tab[0]
                      ? 'border-indigo-500 text-indigo-400'
                      : 'border-transparent text-gray-500 hover:text-gray-300'
                  ]">
            {{ tab[1] }}
          </button>
        </div>

        <!-- SELECT / JOIN 查詢頁籤內容 -->
        <div v-show="activeTab === 'query'">
          <!-- JOIN 模式開關（選了 table 才顯示） -->
          <div class="flex items-center gap-3 mb-3" v-if="selectedTable">
            <label class="flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none">
              <input type="checkbox" v-model="joinMode" class="accent-indigo-500" />
              啟用 JOIN 多表查詢
            </label>
          </div>

          <!-- 主工作區：Table 選擇 + SQL 預覽 -->
          <div v-if="tables.length > 0" class="grid grid-cols-2 gap-6" style="min-height: 400px">
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
              <div class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">JOIN 設定</div>
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
    `
  })

  app.mount('#app')
})()
