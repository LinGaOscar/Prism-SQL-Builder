// app.js：Vue 3 主應用程式入口
// 整合 DDL 解析、欄位選擇、SQL 即時產生三大功能
(function () {
  const { createApp, ref, computed } = Vue

  const app = createApp({
    components: {
      TablePanel: window.TablePanelComponent,
      SqlPreview: window.SqlPreviewComponent
    },
    setup() {
      const rawDdl = ref('')
      const tables = ref([])
      const selectedTable = ref('')
      const selectedColumns = ref([])
      // DDL 輸入框錯誤訊息
      const parseError = ref('')

      // 解析 DDL
      function handleParse() {
        parseError.value = ''
        try {
          const result = window.parseDDL(rawDdl.value)
          tables.value = result
          selectedTable.value = result.length > 0 ? result[0].tableName : ''
          selectedColumns.value = []
        } catch (e) {
          parseError.value = '解析失敗：' + e.message
        }
      }

      // 即時產生 SQL（computed 自動追蹤 selectedTable 與 selectedColumns 變更）
      const sqlOutput = computed(() => {
        if (!selectedTable.value) return ''
        return window.buildSelect({
          tableName: selectedTable.value,
          columns: selectedColumns.value
        })
      })

      return {
        rawDdl, tables, selectedTable, selectedColumns,
        parseError, sqlOutput,
        handleParse,
        setSelectedTable(t) { selectedTable.value = t },
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
      </div>
    `
  })

  app.mount('#app')
})()
