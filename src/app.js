// app.js：Vue 3 主應用程式入口
// 整合 DDL 解析、欄位選擇、WHERE 條件、ORDER BY 排序、LIMIT 分頁、JOIN 多表查詢、DML 模板與 SQL 即時產生
(function () {
  const { createApp, ref, computed } = Vue

  const app = createApp({
    components: {
      TablePanel: window.TablePanelComponent,
      SqlPreview: window.SqlPreviewComponent,
      ConditionBuilder: window.ConditionBuilderComponent,
      SortLimitPanel: window.SortLimitPanelComponent,
      JoinBuilder: window.JoinBuilderComponent,
      DmlPanel: window.DmlPanelComponent
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

      return {
        rawDdl, tables, selectedTable, selectedColumns,
        parseError, sqlOutput,
        where, orderBy, limit, offset,
        currentTableColumns, currentTable,
        joins, joinMode, joinColumns,
        activeTab,
        handleParse,
        setSelectedTable,
        setSelectedColumns(cols) { selectedColumns.value = cols }
      }
    },
    template: `
      <div class="max-w-6xl mx-auto p-6 flex flex-col gap-6">
        <!-- Header -->
        <div>
          <h1 class="text-2xl font-bold text-white">Prism SQL Builder</h1>
          <p class="text-gray-400 text-sm mt-1">貼入 DDL，視覺化產生 SQL 查詢</p>
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
          <button v-for="tab in [['query','SELECT / JOIN'],['dml','DML 模板']]" :key="tab[0]"
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
      </div>
    `
  })

  app.mount('#app')
})()
