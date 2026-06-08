// TablePanel：左側資料表列表 + 右側欄位勾選
// JOIN 模式改為垂直分組列表，統一捲動比橫向卡片更易用
window.TablePanelComponent = {
  name: 'TablePanel',
  props: {
    tables: Array,
    selectedTable: String,
    selectedColumns: Array,
    joinMode: Boolean,
    joins: Array
  },
  emits: ['select-table', 'update-columns'],
  setup(props, { emit }) {
    const { computed } = Vue

    const currentTable = computed(() =>
      props.tables.find(t => t.tableName === props.selectedTable) || null
    )

    const displayTables = computed(() => {
      if (!props.joinMode || !props.joins || props.joins.length === 0) {
        return currentTable.value ? [currentTable.value] : []
      }
      const allTables = [props.selectedTable, ...props.joins.map(j => j.toTable)]
      return allTables.map(tName => props.tables.find(x => x.tableName === tName)).filter(Boolean)
    })

    // 計算哪些欄位是 JOIN ON 條件的 FK 欄位，用於 badge 顯示
    const fkColumns = computed(() => {
      const set = new Set()
      if (!props.joinMode || !props.joins) return set
      props.joins.forEach(j => {
        const fromTable = j.fromTable || props.selectedTable
        if (j.fromCol) set.add(`${fromTable}.${j.fromCol}`)
        if (j.toCol) set.add(`${j.toTable}.${j.toCol}`)
      })
      return set
    })

    function selectTable(tableName) {
      emit('select-table', tableName)
      emit('update-columns', [])
    }

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
      const cols = [...props.selectedColumns]
      tbl.columns.forEach(c => {
        const val = getColValue(tblName, c.name)
        if (!cols.includes(val)) cols.push(val)
      })
      emit('update-columns', cols)
    }

    function clearAll(tblName) {
      const tbl = props.tables.find(t => t.tableName === tblName)
      if (!tbl) return
      const vals = new Set(tbl.columns.map(c => getColValue(tblName, c.name)))
      emit('update-columns', props.selectedColumns.filter(c => !vals.has(c)))
    }

    function clearAllColumns() {
      emit('update-columns', [])
    }

    function getTableSelectedCount(tblName) {
      return props.selectedColumns.filter(c => c.startsWith(tblName + '.')).length
    }

    return {
      displayTables, selectTable, toggleColumn,
      selectAll, clearAll, clearAllColumns,
      getColValue, fkColumns, getTableSelectedCount
    }
  },
  template: `
    <div class="flex gap-4">
      <!-- 左側：Table 列表 -->
      <div class="w-40 shrink-0 flex flex-col">
        <h3 class="text-[11px] font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-2">資料表</h3>
        <div v-if="tables.length === 0" class="text-zinc-400 dark:text-zinc-500 text-sm">尚未解析 DDL</div>
        <ul name="table-list"
            class="overflow-y-auto custom-scrollbar border-r border-zinc-100 dark:border-zinc-800"
            style="max-height: max(360px, calc(100vh - 480px));">
          <li v-for="t in tables" :key="t.tableName"
              @click="selectTable(t.tableName)"
              :class="[
                'px-3 py-2 rounded-l cursor-pointer text-sm mb-0.5 transition-colors border-l-2',
                selectedTable === t.tableName
                  ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-500'
                  : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 border-transparent'
              ]">
            {{ t.tableName }}
          </li>
        </ul>
      </div>

      <!-- JOIN 模式：垂直分組列表，所有表統一捲動，方便連續勾選 -->
      <div v-if="joinMode && displayTables.length > 1"
           name="column-list-join"
           class="flex-1 min-w-0 flex flex-col rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden"
           style="max-height: max(360px, calc(100vh - 480px));">

        <!-- 全局 header：總選取數 + 全部清除 -->
        <div class="flex items-center justify-between px-3 py-2 bg-zinc-100 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
          <span class="text-[11px] text-zinc-500 dark:text-zinc-400">
            已選 <span class="font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">{{ selectedColumns.length }}</span> 欄
          </span>
          <button v-if="selectedColumns.length > 0"
                  @click="clearAllColumns"
                  class="text-[11px] text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 transition-colors">
            全部清除
          </button>
        </div>

        <!-- 各表分組：overflow-y 捲動 -->
        <div class="overflow-y-auto custom-scrollbar flex-1 divide-y divide-zinc-100 dark:divide-zinc-800">
          <div v-for="tbl in displayTables" :key="tbl.tableName">

            <!-- 表名 header（sticky） -->
            <div class="sticky top-0 z-10 flex items-center gap-1.5 px-3 py-2
                        bg-zinc-50 dark:bg-zinc-900
                        border-b border-zinc-200 dark:border-zinc-700">
              <span class="text-[11px] font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex-1 truncate">
                {{ tbl.tableName }}
              </span>
              <!-- 已選欄位數 badge -->
              <span v-if="getTableSelectedCount(tbl.tableName) > 0"
                    class="text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full
                           bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 shrink-0">
                {{ getTableSelectedCount(tbl.tableName) }}
              </span>
              <button @click="selectAll(tbl.tableName)"
                      class="text-[11px] text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-300
                             px-1.5 py-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0">
                全選
              </button>
              <button @click="clearAll(tbl.tableName)"
                      class="text-[11px] text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400
                             px-1.5 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-950 transition-colors shrink-0">
                清除
              </button>
            </div>

            <!-- 欄位列表 -->
            <ul class="py-0.5">
              <li v-for="col in tbl.columns" :key="col.name"
                  @click="toggleColumn(tbl.tableName, col.name)"
                  :class="[
                    'flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-all duration-100 border-l-2',
                    selectedColumns.includes(getColValue(tbl.tableName, col.name))
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-500'
                      : 'border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                  ]">
                <input type="checkbox"
                       :checked="selectedColumns.includes(getColValue(tbl.tableName, col.name))"
                       @change.stop="toggleColumn(tbl.tableName, col.name)"
                       @click.stop
                       class="accent-indigo-500 cursor-pointer shrink-0" />
                <span class="flex-1 min-w-0 flex items-baseline gap-2">
                  <span class="text-xs font-mono text-zinc-800 dark:text-zinc-100 leading-snug">{{ col.name }}</span>
                  <span class="text-[10px] text-zinc-400 dark:text-zinc-500 shrink-0 leading-snug">{{ col.type }}</span>
                </span>
                <!-- FK join key badge -->
                <span v-if="fkColumns.has(getColValue(tbl.tableName, col.name))"
                      class="join-fk-badge shrink-0">FK</span>
                <!-- PK badge -->
                <span v-if="col.isPrimaryKey"
                      class="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0
                             bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400
                             border border-amber-200 dark:border-amber-800 tracking-wide">PK</span>
              </li>
            </ul>

          </div>
        </div>
      </div>

      <!-- 一般模式：單表垂直列表 -->
      <div v-else
           name="column-list"
           class="flex-1 min-w-0 pr-2 overflow-y-auto custom-scrollbar"
           style="max-height: max(360px, calc(100vh - 480px));">
        <div v-if="displayTables.length === 0" class="text-zinc-400 dark:text-zinc-500 text-sm">請選擇資料表</div>
        <div v-else class="space-y-4">
          <div v-for="tbl in displayTables" :key="tbl.tableName">
            <div class="flex items-center gap-2 mb-2 sticky top-0 bg-zinc-50 dark:bg-[#111111] z-10 py-1">
              <h3 class="text-[11px] font-medium uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex-1">
                {{ tbl.tableName }}
              </h3>
              <button @click="selectAll(tbl.tableName)"
                      class="text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors bg-white dark:bg-zinc-800 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 shadow-sm">全選</button>
              <button @click="clearAll(tbl.tableName)"
                      class="text-xs text-zinc-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors bg-white dark:bg-zinc-800 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 shadow-sm">清除</button>
            </div>
            <ul class="pr-1">
              <li v-for="col in tbl.columns" :key="col.name"
                  class="flex items-center gap-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 rounded px-2 -mx-2 transition-colors group cursor-pointer"
                  @click.self="toggleColumn(tbl.tableName, col.name)">
                <input type="checkbox"
                       :id="'col-' + tbl.tableName + '-' + col.name"
                       :checked="selectedColumns.includes(getColValue(tbl.tableName, col.name))"
                       @change="toggleColumn(tbl.tableName, col.name)"
                       class="accent-indigo-500 cursor-pointer" />
                <label :for="'col-' + tbl.tableName + '-' + col.name"
                       class="text-sm text-zinc-800 dark:text-zinc-200 cursor-pointer flex-1 min-w-0 flex items-center gap-2">
                  <span>{{ col.name }}</span>
                  <span class="text-zinc-400 dark:text-zinc-500 text-[10px]">{{ col.type }}</span>
                  <span v-if="col.comment"
                        class="text-[11px] text-zinc-400 dark:text-zinc-500 italic truncate ml-auto"
                        :title="col.comment">{{ col.comment }}</span>
                </label>
                <span v-if="col.isPrimaryKey"
                      class="text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0
                             bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400
                             border border-amber-200 dark:border-amber-800">PK</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  `
}
