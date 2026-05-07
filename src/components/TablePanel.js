// TablePanel：左側顯示資料表列表，右側顯示欄位勾選清單
// 切換資料表時自動清空欄位選擇，避免跨表欄位名稱衝突
window.TablePanelComponent = {
  name: 'TablePanel',
  props: {
    tables: Array,           // TableSchema[]
    selectedTable: String,
    selectedColumns: Array
  },
  emits: ['select-table', 'update-columns'],
  setup(props, { emit }) {
    const { computed } = Vue

    // 目前選中的 table schema
    const currentTable = computed(() =>
      props.tables.find(t => t.tableName === props.selectedTable) || null
    )

    function selectTable(tableName) {
      emit('select-table', tableName)
      emit('update-columns', [])  // 切換 table 時清空欄位選擇
    }

    function toggleColumn(colName) {
      const cols = [...props.selectedColumns]
      const idx = cols.indexOf(colName)
      if (idx === -1) cols.push(colName)
      else cols.splice(idx, 1)
      emit('update-columns', cols)
    }

    function selectAll() {
      if (!currentTable.value) return
      emit('update-columns', currentTable.value.columns.map(c => c.name))
    }

    function clearAll() {
      emit('update-columns', [])
    }

    return { currentTable, selectTable, toggleColumn, selectAll, clearAll }
  },
  template: `
    <div class="flex gap-4 h-full">
      <!-- 左側：Table 列表 -->
      <div class="w-48 shrink-0">
        <h3 class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">資料表</h3>
        <div v-if="tables.length === 0" class="text-gray-500 text-sm">尚未解析 DDL</div>
        <ul>
          <li v-for="t in tables" :key="t.tableName"
              @click="selectTable(t.tableName)"
              :class="[
                'px-3 py-2 rounded cursor-pointer text-sm mb-1',
                selectedTable === t.tableName
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700'
              ]">
            {{ t.tableName }}
          </li>
        </ul>
      </div>
      <!-- 右側：欄位列表 -->
      <div class="flex-1 min-w-0">
        <div v-if="!currentTable" class="text-gray-500 text-sm">請選擇資料表</div>
        <div v-else>
          <div class="flex items-center gap-2 mb-2">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-gray-400 flex-1">欄位</h3>
            <button @click="selectAll" class="text-xs text-indigo-400 hover:text-indigo-300">全選</button>
            <button @click="clearAll" class="text-xs text-gray-400 hover:text-gray-300">清除</button>
          </div>
          <ul>
            <li v-for="col in currentTable.columns" :key="col.name"
                class="flex items-center gap-2 py-1">
              <input type="checkbox"
                     :id="'col-' + col.name"
                     :value="col.name"
                     :checked="selectedColumns.includes(col.name)"
                     @change="toggleColumn(col.name)"
                     class="accent-indigo-500 cursor-pointer" />
              <label :for="'col-' + col.name" class="text-sm text-gray-200 cursor-pointer flex-1">
                {{ col.name }}
                <span class="text-gray-500 text-xs ml-1">{{ col.type }}</span>
              </label>
              <span v-if="col.isPrimaryKey" class="text-xs text-yellow-500">PK</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  `
}
