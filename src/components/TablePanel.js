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
        <h3 class="text-[11px] font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-2">資料表</h3>
        <div v-if="tables.length === 0" class="text-zinc-400 dark:text-zinc-500 text-sm">尚未解析 DDL</div>
        <ul>
          <li v-for="t in tables" :key="t.tableName"
              @click="selectTable(t.tableName)"
              :class="[
                'px-3 py-2 rounded-r cursor-pointer text-sm mb-0.5 transition-colors border-l-2',
                selectedTable === t.tableName
                  ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-500'
                  : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 border-transparent'
              ]">
            {{ t.tableName }}
          </li>
        </ul>
      </div>
      <!-- 右側：欄位列表 -->
      <div class="flex-1 min-w-0">
        <div v-if="!currentTable" class="text-zinc-400 dark:text-zinc-500 text-sm">請選擇資料表</div>
        <div v-else>
          <div class="flex items-center gap-2 mb-2">
            <h3 class="text-[11px] font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500 flex-1">欄位</h3>
            <button @click="selectAll" class="text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors">全選</button>
            <button @click="clearAll" class="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">清除</button>
          </div>
          <ul>
            <li v-for="col in currentTable.columns" :key="col.name"
                class="flex items-center gap-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded px-1 -mx-1 transition-colors group">
              <input type="checkbox"
                     :id="'col-' + col.name"
                     :value="col.name"
                     :checked="selectedColumns.includes(col.name)"
                     @change="toggleColumn(col.name)"
                     class="accent-indigo-500 cursor-pointer" />
              <label :for="'col-' + col.name" class="text-sm text-zinc-800 dark:text-zinc-200 cursor-pointer flex-1 min-w-0">
                {{ col.name }}
                <span class="text-zinc-400 dark:text-zinc-500 text-xs ml-1">{{ col.type }}</span>
                <span v-if="col.comment"
                      class="text-[11px] text-zinc-400 dark:text-zinc-500 ml-1.5 italic truncate"
                      :title="col.comment">{{ col.comment }}</span>
              </label>
              <span v-if="col.isPrimaryKey"
                    class="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">PK</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  `
}
