// DmlPanel.js：DML 模板產生面板元件
// 提供 INSERT / UPDATE / DELETE 三種模板，支援 named / positional 兩種佔位符風格
window.DmlPanelComponent = {
  name: 'DmlPanel',
  props: {
    table: Object   // TableSchema | null
  },
  setup(props) {
    const { ref, computed } = Vue
    const dmlMode = ref('INSERT')           // 'INSERT' | 'UPDATE' | 'DELETE'
    const placeholderStyle = ref('named')   // 'named' | 'positional'
    const copyLabel = ref('複製')

    // 根據目前模式與佔位符風格即時產生 SQL 模板
    const sql = computed(() => {
      if (!props.table) return ''
      const b = window.dmlBuilder
      if (dmlMode.value === 'INSERT') return b.buildInsert(props.table, placeholderStyle.value)
      if (dmlMode.value === 'UPDATE') return b.buildUpdate(props.table, placeholderStyle.value)
      if (dmlMode.value === 'DELETE') return b.buildDelete(props.table, placeholderStyle.value)
      return ''
    })

    // 複製 SQL 到剪貼簿，並短暫顯示「已複製！」提示
    async function copySql() {
      if (!sql.value) return
      try {
        await navigator.clipboard.writeText(sql.value)
        copyLabel.value = '已複製！'
      } catch {
        copyLabel.value = '複製失敗'
      }
      setTimeout(() => { copyLabel.value = '複製' }, 1500)
    }

    return { dmlMode, placeholderStyle, sql, copyLabel, copySql }
  },
  template: `
    <div class="flex flex-col gap-4">
      <!-- DML 模式切換 + 佔位符風格 -->
      <div class="flex items-center gap-4 flex-wrap">
        <div class="flex rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700">
          <button v-for="m in ['INSERT','UPDATE','DELETE']" :key="m"
                  @click="dmlMode = m"
                  :class="[
                    'px-4 py-1.5 text-xs font-medium transition-colors',
                    dmlMode === m
                      ? (m === 'DELETE' ? 'bg-red-600 text-white' : 'bg-indigo-600 text-white')
                      : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  ]">
            {{ m }}
          </button>
        </div>
        <div class="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span>佔位符：</span>
          <label class="flex items-center gap-1 cursor-pointer">
            <input type="radio" v-model="placeholderStyle" value="named" class="accent-indigo-500" /> :name
          </label>
          <label class="flex items-center gap-1 cursor-pointer">
            <input type="radio" v-model="placeholderStyle" value="positional" class="accent-indigo-500" /> ?
          </label>
        </div>
      </div>

      <!-- SQL 輸出 -->
      <div class="flex flex-col">
        <div class="flex justify-between items-center mb-2">
          <span class="text-[11px] font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500">{{ dmlMode }} 模板</span>
          <button @click="copySql" :disabled="!sql"
                  class="text-xs px-3 py-1.5 rounded-md bg-zinc-900 dark:bg-white hover:bg-zinc-700 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 transition-colors font-medium disabled:opacity-30 disabled:cursor-not-allowed">
            {{ copyLabel }}
          </button>
        </div>
        <pre :class="[
          'flex-1 rounded-lg border p-4 text-sm font-code overflow-auto whitespace-pre-wrap leading-relaxed',
          dmlMode === 'DELETE'
            ? 'bg-red-50 dark:bg-zinc-900 border-red-200 dark:border-zinc-800 text-red-700 dark:text-red-400'
            : 'bg-[#FAFAF7] dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-emerald-800 dark:text-emerald-400'
        ]">{{ sql || '-- 請先選擇資料表' }}</pre>
      </div>
    </div>
  `
}
