// TablePanel：左側顯示資料表列表，右側顯示欄位勾選清單
// 切換資料表時自動清空欄位選擇，避免跨表欄位名稱衝突
window.TablePanelComponent = {
  name: 'TablePanel',
  props: {
    tables: Array,           // TableSchema[]
    selectedTable: String,
    selectedColumns: Array,
    joinMode: Boolean,
    joins: Array
  },
  emits: ['select-table', 'update-columns'],
  setup(props, { emit }) {
    const { computed } = Vue

    // 目前選中的 table schema
    const currentTable = computed(() =>
      props.tables.find(t => t.tableName === props.selectedTable) || null
    )

    // 若啟用 JOIN，則顯示主表 + 所有已 JOIN 的表；否則只顯示主表
    const displayTables = computed(() => {
      if (!props.joinMode || !props.joins || props.joins.length === 0) {
        return currentTable.value ? [currentTable.value] : []
      }
      const allTables = [props.selectedTable, ...props.joins.map(j => j.toTable)]
      return allTables.map(tName => props.tables.find(x => x.tableName === tName)).filter(Boolean)
    })

    function selectTable(tableName) {
      emit('select-table', tableName)
      emit('update-columns', [])  // 切換 table 時清空欄位選擇
    }

    // 取得在 selectedColumns 中的實際值
    function getColValue(tblName, colName) {
      return props.joinMode ? `${tblName}.${colName}` : colName
    }

    function toggleColumn(tblName, colName) {
      const val = getColValue(tblName, colName)
      const cols = [...props.selectedColumns]
      const idx = cols.indexOf(val)
      if (idx === -1) cols.push(val)
      else cols.splice(idx, 1)
      emit('update-columns', cols)
    }

    function selectAll(tblName) {
      const tbl = props.tables.find(t => t.tableName === tblName)
      if (!tbl) return
      let cols = [...props.selectedColumns]
      tbl.columns.forEach(c => {
        const val = getColValue(tblName, c.name)
        if (!cols.includes(val)) cols.push(val)
      })
      emit('update-columns', cols)
    }

    function clearAll(tblName) {
      let cols = [...props.selectedColumns]
      const tbl = props.tables.find(t => t.tableName === tblName)
      if (!tbl) return
      tbl.columns.forEach(c => {
        const val = getColValue(tblName, c.name)
        const idx = cols.indexOf(val)
        if (idx !== -1) cols.splice(idx, 1)
      })
      emit('update-columns', cols)
    }

    return { displayTables, selectTable, toggleColumn, selectAll, clearAll, getColValue }
  },
  template: `
    <div class="flex gap-4 h-full">
      <!-- 左側：Table 列表 -->
      <div class="w-48 shrink-0">
        <h3 class="text-[11px] font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-2">資料表</h3>
        <div v-if="tables.length === 0" class="text-zinc-400 dark:text-zinc-500 text-sm">尚未解析 DDL</div>
        <ul class="overflow-y-auto" style="max-height: calc(100vh - 350px);">
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
      <div class="flex-1 min-w-0 overflow-y-auto pr-2" style="max-height: calc(100vh - 350px);">
        <div v-if="displayTables.length === 0" class="text-zinc-400 dark:text-zinc-500 text-sm">請選擇資料表</div>
        <div v-else class="space-y-4">
          <div v-for="tbl in displayTables" :key="tbl.tableName">
            <div class="flex items-center gap-2 mb-2 sticky top-0 bg-zinc-50 dark:bg-[#111111] z-10 py-1">
              <h3 class="text-[11px] font-medium uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex-1">
                {{ tbl.tableName }}
              </h3>
              <button @click="selectAll(tbl.tableName)" class="text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors bg-white dark:bg-zinc-800 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 shadow-sm">全選</button>
              <button @click="clearAll(tbl.tableName)" class="text-xs text-zinc-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors bg-white dark:bg-zinc-800 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 shadow-sm">清除</button>
            </div>
            <ul>
              <li v-for="col in tbl.columns" :key="col.name"
                  class="flex items-center gap-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 rounded px-2 -mx-2 transition-colors group cursor-pointer"
                  @click.self="toggleColumn(tbl.tableName, col.name)">
                <input type="checkbox"
                       :id="'col-' + tbl.tableName + '-' + col.name"
                       :value="getColValue(tbl.tableName, col.name)"
                       :checked="selectedColumns.includes(getColValue(tbl.tableName, col.name))"
                       @change="toggleColumn(tbl.tableName, col.name)"
                       class="accent-indigo-500 cursor-pointer" />
                <label :for="'col-' + tbl.tableName + '-' + col.name" class="text-sm text-zinc-800 dark:text-zinc-200 cursor-pointer flex-1 min-w-0 flex items-center gap-2">
                  <span>{{ col.name }}</span>
                  <span class="text-zinc-400 dark:text-zinc-500 text-[10px]">{{ col.type }}</span>
                  <span v-if="col.comment"
                        class="text-[11px] text-zinc-400 dark:text-zinc-500 italic truncate ml-auto"
                        :title="col.comment">{{ col.comment }}</span>
                </label>
                <span v-if="col.isPrimaryKey"
                      class="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 shrink-0">PK</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  `
}
