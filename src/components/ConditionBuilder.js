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
        <span class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">WHERE 條件</span>
        <button @click="addCondition"
                class="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300">
          + 新增條件
        </button>
      </div>
      <div v-if="where.length === 0" class="text-gray-400 dark:text-gray-600 text-xs">無條件（回傳所有資料）</div>
      <div v-for="(cond, idx) in where" :key="idx"
           class="flex items-center gap-2 mb-2">
        <span class="text-gray-400 dark:text-gray-500 text-xs w-6 text-right">{{ idx === 0 ? 'WHERE' : 'AND' }}</span>
        <!-- 欄位選擇 -->
        <select :value="cond.column"
                @change="updateCondition(idx, 'column', $event.target.value)"
                class="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm rounded px-2 py-1 border border-gray-300 dark:border-gray-700 flex-1">
          <option v-for="col in columns" :key="col.name" :value="col.name">{{ col.name }}</option>
        </select>
        <!-- 運算子 -->
        <select :value="cond.operator"
                @change="updateCondition(idx, 'operator', $event.target.value)"
                class="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm rounded px-2 py-1 border border-gray-300 dark:border-gray-700">
          <option v-for="op in OPERATORS" :key="op" :value="op">{{ op }}</option>
        </select>
        <!-- 值輸入（IS NULL / IS NOT NULL 不顯示，這兩個運算子語義上不需要值） -->
        <input v-if="!['IS NULL','IS NOT NULL'].includes(cond.operator)"
               :value="cond.value"
               @input="updateCondition(idx, 'value', $event.target.value)"
               placeholder="值"
               class="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm rounded px-2 py-1 border border-gray-300 dark:border-gray-700 flex-1" />
        <span v-else class="flex-1"></span>
        <!-- 刪除條件 -->
        <button @click="removeCondition(idx)"
                class="text-gray-400 dark:text-gray-600 hover:text-red-600 dark:hover:text-red-400 text-sm px-1">✕</button>
      </div>
    </div>
  `
}
