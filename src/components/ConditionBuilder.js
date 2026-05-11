// ConditionBuilder：WHERE 條件列表元件
// 讓使用者視覺化新增／刪除／修改查詢條件，支援常見 SQL 比較與 NULL 判斷運算子
window.ConditionBuilderComponent = {
  name: 'ConditionBuilder',
  props: {
    columns: Array,   // ColumnDef[]（當前選中 table 的欄位）
    where: Array      // [{ column, operator, value }]
  },
  emits: ['update-where'],
  setup(props, { emit }) {
    const { ref } = Vue

    // 支援的運算子清單；IS NULL / IS NOT NULL 不需使用者輸入值
    const OPERATORS = ['=', '!=', '>', '>=', '<', '<=', 'LIKE', 'IN', 'IS NULL', 'IS NOT NULL']

    function addCondition() {
      const first = props.columns[0]?.name || ''
      emit('update-where', [...props.where, { column: first, operator: '=', value: '' }])
    }

    function removeCondition(idx) {
      const updated = props.where.filter((_, i) => i !== idx)
      emit('update-where', updated)
    }

    function updateCondition(idx, field, val) {
      const updated = props.where.map((c, i) =>
        i === idx ? { ...c, [field]: val } : c
      )
      emit('update-where', updated)
    }

    return { OPERATORS, addCondition, removeCondition, updateCondition }
  },
  template: `
    <div>
      <div class="flex items-center justify-between mb-2">
        <span class="text-[11px] font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500">WHERE 條件</span>
        <button @click="addCondition"
                class="text-xs px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
          + 新增條件
        </button>
      </div>
      <div v-if="where.length === 0" class="text-zinc-400 dark:text-zinc-600 text-xs">無條件（回傳所有資料）</div>
      <div v-for="(cond, idx) in where" :key="idx"
           class="flex items-center gap-2 mb-2">
        <span class="text-zinc-400 dark:text-zinc-500 text-xs w-10 text-right shrink-0">{{ idx === 0 ? 'WHERE' : 'AND' }}</span>
        <!-- 欄位選擇 -->
        <select :value="cond.column"
                @change="updateCondition(idx, 'column', $event.target.value)"
                class="bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs rounded-md px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-700 focus:border-indigo-400 outline-none transition-colors flex-1 min-w-0">
          <option v-for="col in columns" :key="col.name" :value="col.name">{{ col.name }}</option>
        </select>
        <!-- 運算子 -->
        <select :value="cond.operator"
                @change="updateCondition(idx, 'operator', $event.target.value)"
                class="bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs rounded-md px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-700 focus:border-indigo-400 outline-none transition-colors shrink-0">
          <option v-for="op in OPERATORS" :key="op" :value="op">{{ op }}</option>
        </select>
        <!-- 值輸入（IS NULL / IS NOT NULL 不顯示，這兩個運算子語義上不需要值） -->
        <input v-if="!['IS NULL','IS NOT NULL'].includes(cond.operator)"
               :value="cond.value"
               @input="updateCondition(idx, 'value', $event.target.value)"
               placeholder="值"
               class="bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs rounded-md px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-700 focus:border-indigo-400 outline-none transition-colors flex-1 min-w-0" />
        <span v-else class="flex-1"></span>
        <!-- 刪除條件 -->
        <button @click="removeCondition(idx)"
                class="text-zinc-300 dark:text-zinc-600 hover:text-red-500 text-xs px-1 transition-colors">✕</button>
      </div>
    </div>
  `
}
