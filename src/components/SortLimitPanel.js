// SortLimitPanel：ORDER BY 排序與 LIMIT / OFFSET 分頁設定元件
// 讓使用者可視覺化設定多欄排序方向及回傳筆數限制，直接影響 SQL 輸出
window.SortLimitPanelComponent = {
  name: 'SortLimitPanel',
  props: {
    columns: Array,   // ColumnDef[]
    orderBy: Array,   // [{ column, direction }]
    limit: Number,
    offset: Number
  },
  emits: ['update-order-by', 'update-limit', 'update-offset'],
  setup(props, { emit }) {
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
    return { addSort, removeSort, updateSort }
  },
  template: `
    <div class="flex flex-col gap-4">
      <!-- ORDER BY -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">ORDER BY</span>
          <button @click="addSort"
                  class="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300">
            + 新增排序
          </button>
        </div>
        <div v-if="orderBy.length === 0" class="text-gray-400 dark:text-gray-600 text-xs">無排序</div>
        <div v-for="(sort, idx) in orderBy" :key="idx"
             class="flex items-center gap-2 mb-2">
          <select :value="sort.column"
                  @change="updateSort(idx, 'column', $event.target.value)"
                  class="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm rounded px-2 py-1 border border-gray-300 dark:border-gray-700 flex-1">
            <option v-for="col in columns" :key="col.name" :value="col.name">{{ col.name }}</option>
          </select>
          <select :value="sort.direction"
                  @change="updateSort(idx, 'direction', $event.target.value)"
                  class="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm rounded px-2 py-1 border border-gray-300 dark:border-gray-700">
            <option value="ASC">ASC</option>
            <option value="DESC">DESC</option>
          </select>
          <button @click="removeSort(idx)"
                  class="text-gray-400 dark:text-gray-600 hover:text-red-600 dark:hover:text-red-400 text-sm px-1">✕</button>
        </div>
      </div>
      <!-- LIMIT / OFFSET：分頁控制；OFFSET 只在有設 LIMIT 時才有意義 -->
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2">
          <label class="text-xs text-gray-500 dark:text-gray-400">LIMIT</label>
          <input type="number" min="0"
                 :value="limit"
                 @input="$emit('update-limit', parseInt($event.target.value) || 0)"
                 placeholder="0 = 不限"
                 class="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm rounded px-2 py-1 border border-gray-300 dark:border-gray-700 w-24" />
        </div>
        <div class="flex items-center gap-2">
          <label class="text-xs text-gray-500 dark:text-gray-400">OFFSET</label>
          <input type="number" min="0"
                 :value="offset"
                 @input="$emit('update-offset', parseInt($event.target.value) || 0)"
                 placeholder="0"
                 class="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm rounded px-2 py-1 border border-gray-300 dark:border-gray-700 w-24" />
        </div>
      </div>
    </div>
  `
}
