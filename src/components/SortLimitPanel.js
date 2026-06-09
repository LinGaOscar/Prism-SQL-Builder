// SortLimitPanel：ORDER BY 排序與 LIMIT / OFFSET 分頁設定元件
// 讓使用者可視覺化設定多欄排序方向及回傳筆數限制，直接影響 SQL 輸出
window.SortLimitPanelComponent = {
  name: 'SortLimitPanel',
  props: {
    columns: Array,   // ColumnDef[]
    orderBy: Array,   // [{ column, direction }]
    limit: Number,
    offset: Number,
    dialect: String   // 'mysql' | 'postgresql' | 'mssql' | 'oracle'
  },
  emits: ['update-order-by', 'update-limit', 'update-offset', 'update-dialect'],
  setup(props, { emit }) {
    const DIALECTS = [['mysql','MySQL'],['postgresql','PG'],['mssql','MSSQL'],['oracle','Oracle']]
    function addSort() {
      const first = props.columns[0]?.name || ''
      emit('update-order-by', [...props.orderBy, { column: first, direction: 'ASC' }])
    }
    function removeSort(idx) {
      emit('update-order-by', props.orderBy.filter((_, i) => i !== idx))
    }
    function updateSort(idx, field, val) {
      emit('update-order-by', props.orderBy.map((s, i) =>
        i === idx ? { ...s, [field]: val } : s
      ))
    }
    return { addSort, removeSort, updateSort, DIALECTS }
  },
  template: `
    <div class="flex flex-col gap-4">
      <!-- ORDER BY -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-[11px] font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500">ORDER BY</span>
          <button @click="addSort"
                  class="text-xs px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            + 新增排序
          </button>
        </div>
        <div v-if="orderBy.length === 0" class="text-zinc-400 dark:text-zinc-600 text-xs">無排序</div>
        <div v-for="(sort, idx) in orderBy" :key="idx"
             class="flex items-center gap-2 mb-2">
          <select :value="sort.column"
                  @change="updateSort(idx, 'column', $event.target.value)"
                  class="bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs rounded-md px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-700 focus:border-indigo-400 outline-none transition-colors flex-1 min-w-0">
            <option v-for="col in columns" :key="col.name" :value="col.name">{{ col.name }}</option>
          </select>
          <select :value="sort.direction"
                  @change="updateSort(idx, 'direction', $event.target.value)"
                  class="bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs rounded-md px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-700 focus:border-indigo-400 outline-none transition-colors shrink-0">
            <option value="ASC">ASC</option>
            <option value="DESC">DESC</option>
          </select>
          <button @click="removeSort(idx)"
                  class="text-zinc-300 dark:text-zinc-600 hover:text-red-500 text-xs px-1 transition-colors">✕</button>
        </div>
      </div>
      <!-- LIMIT / OFFSET 與方言：分頁語法因資料庫而異，三者放同一列強調關聯性 -->
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div class="flex items-center gap-2">
          <label class="text-xs text-zinc-500 dark:text-zinc-400">LIMIT</label>
          <input type="number" min="0"
                 :value="limit"
                 @input="$emit('update-limit', parseInt($event.target.value) || 0)"
                 placeholder="0 = 不限"
                 class="bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs rounded-md px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-700 focus:border-indigo-400 outline-none transition-colors w-24" />
        </div>
        <div class="flex items-center gap-2">
          <label class="text-xs text-zinc-500 dark:text-zinc-400">OFFSET</label>
          <input type="number" min="0"
                 :value="offset"
                 @input="$emit('update-offset', parseInt($event.target.value) || 0)"
                 placeholder="0"
                 class="bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs rounded-md px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-700 focus:border-indigo-400 outline-none transition-colors w-24" />
        </div>
        <!-- 方言選擇器：僅影響分頁語法，與 LIMIT/OFFSET 並排以提示關聯 -->
        <div class="flex rounded-md overflow-hidden border border-zinc-200 dark:border-zinc-700 text-[11px] font-medium ml-auto shrink-0">
          <button v-for="d in DIALECTS" :key="d[0]"
                  @click="$emit('update-dialect', d[0])"
                  :class="['px-2.5 py-1.5 transition-colors border-r border-zinc-200 dark:border-zinc-700 last:border-r-0',
                           dialect === d[0]
                             ? 'bg-indigo-600 text-white'
                             : 'bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700']">
            {{ d[1] }}
          </button>
        </div>
      </div>
    </div>
  `
}
