// JoinBuilder.js：JOIN 多表查詢設定元件
// 功能：顯示 FK 自動推薦、管理已加入的 JOIN 列表（可改類型/刪除）、支援手動新增無 FK 的 JOIN
window.JoinBuilderComponent = {
  name: 'JoinBuilder',
  props: {
    tables: Array,    // TableSchema[] 所有已解析的資料表
    baseTable: String, // 主資料表名稱
    joins: Array      // 已加入的 JOIN 列表：[{ fromTable, fromCol, toTable, toCol, type }]
  },
  emits: ['update-joins'],
  setup(props, { emit }) {
    const { computed } = Vue
    // 支援三種標準 JOIN 類型；CROSS JOIN 較少用，不列入選項
    const JOIN_TYPES = ['INNER', 'LEFT', 'RIGHT']

    // 依 FK 推薦尚未加入的 JOIN，避免重複顯示已加入的關聯
    const suggestions = computed(() => {
      if (!props.baseTable || !props.tables) return []
      return window.joinBuilder.suggestJoins(props.tables, props.baseTable)
        .filter(s => !props.joins.some(j => j.toTable === s.toTable))
    })

    // 將建議直接加入 JOIN 列表
    function addSuggestion(s) {
      emit('update-joins', [...props.joins, { ...s }])
    }

    // 移除指定索引的 JOIN
    function removeJoin(idx) {
      emit('update-joins', props.joins.filter((_, i) => i !== idx))
    }

    // 更新指定 JOIN 的類型（INNER / LEFT / RIGHT）
    function updateJoinType(idx, type) {
      emit('update-joins', props.joins.map((j, i) => i === idx ? { ...j, type } : j))
    }

    // 手動新增：僅顯示尚未加入、且不是 baseTable 的資料表
    const availableTables = computed(() =>
      (props.tables || [])
        .map(t => t.tableName)
        .filter(n => n !== props.baseTable && !props.joins.some(j => j.toTable === n))
    )

    // 手動新增時預填 fromTable，fromCol / toCol 留空讓使用者自行填入
    function addManual(toTable) {
      if (!toTable) return
      emit('update-joins', [...props.joins, {
        fromTable: props.baseTable,
        fromCol: '',
        toTable,
        toCol: '',
        type: 'LEFT'
      }])
    }

    // 更新 JOIN 的 fromCol 或 toCol（field 為欄位名稱字串）
    function updateJoinCol(idx, field, val) {
      emit('update-joins', props.joins.map((j, i) => i === idx ? { ...j, [field]: val } : j))
    }

    return { JOIN_TYPES, suggestions, addSuggestion, removeJoin, updateJoinType, availableTables, addManual, updateJoinCol }
  },
  template: `
    <div class="flex flex-col gap-4">
      <!-- FK 推薦：依解析出的 FK 自動列出建議，一鍵加入省去手動查找 -->
      <div v-if="suggestions.length > 0">
        <div class="text-[11px] font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-2">建議 JOIN（依 FK）</div>
        <div v-for="s in suggestions" :key="s.toTable"
             class="flex items-center gap-2 mb-2 p-2 rounded-md bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-400">
          <span class="flex-1">{{ s.fromTable }}.{{ s.fromCol }} → {{ s.toTable }}.{{ s.toCol }}</span>
          <button @click="addSuggestion(s)"
                  class="text-xs px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap">+ 加入</button>
        </div>
      </div>

      <!-- 已加入的 JOIN 列表 -->
      <div>
        <div class="text-[11px] font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-2">JOIN 列表</div>
        <div v-if="joins.length === 0" class="text-zinc-400 dark:text-zinc-600 text-xs">尚未加入任何 JOIN</div>
        <div v-for="(j, idx) in joins" :key="idx"
             class="flex flex-wrap items-center gap-2 mb-2 p-2 rounded-md bg-white dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 w-full">
          <!-- JOIN 類型選擇 -->
          <select :value="j.type" @change="updateJoinType(idx, $event.target.value)"
                  class="bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs rounded-md px-2 py-1.5 border border-zinc-200 dark:border-zinc-700 focus:border-indigo-400 outline-none transition-colors shrink-0">
            <option v-for="t in JOIN_TYPES" :key="t" :value="t">{{ t }}</option>
          </select>
          <span class="text-zinc-500 dark:text-zinc-400 text-xs font-medium shrink-0">JOIN <span class="text-zinc-800 dark:text-zinc-200">{{ j.toTable }}</span> ON</span>
          <!-- ON 條件：fromCol = toCol，包成一組避免 = 號跨行斷開 -->
          <div class="flex items-center gap-2 flex-wrap">
            <input :value="j.fromCol" @input="updateJoinCol(idx, 'fromCol', $event.target.value)"
                   :placeholder="j.fromTable + '.col'"
                   class="bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs rounded-md px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-700 focus:border-indigo-400 outline-none transition-colors w-28 shrink-0" />
            <span class="text-zinc-400 dark:text-zinc-500 text-xs shrink-0">=</span>
            <input :value="j.toCol" @input="updateJoinCol(idx, 'toCol', $event.target.value)"
                   :placeholder="j.toTable + '.col'"
                   class="bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs rounded-md px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-700 focus:border-indigo-400 outline-none transition-colors w-28 shrink-0" />
          </div>
          <button @click="removeJoin(idx)"
                  class="text-zinc-300 dark:text-zinc-600 hover:text-red-500 text-xs px-2 ml-auto shrink-0 transition-colors">✕</button>
        </div>
      </div>

      <!-- 手動新增：從尚未加入的資料表選一個，ON 條件由使用者手動輸入 -->
      <div v-if="availableTables.length > 0" class="flex items-center gap-2">
        <span class="text-xs text-zinc-400 dark:text-zinc-500">手動加入：</span>
        <select @change="addManual($event.target.value); $event.target.value = ''"
                class="bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs rounded-md px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-700 focus:border-indigo-400 outline-none transition-colors">
          <option value="">選擇資料表…</option>
          <option v-for="t in availableTables" :key="t" :value="t">{{ t }}</option>
        </select>
      </div>
    </div>
  `
}
