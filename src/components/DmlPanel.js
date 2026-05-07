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
      await navigator.clipboard.writeText(sql.value)
      copyLabel.value = '已複製！'
      setTimeout(() => { copyLabel.value = '複製' }, 1500)
    }

    return { dmlMode, placeholderStyle, sql, copyLabel, copySql }
  },
  template: `
    <div class="flex flex-col gap-4">
      <!-- DML 模式切換 + 佔位符風格 -->
      <div class="flex items-center gap-4 flex-wrap">
        <div class="flex rounded overflow-hidden border border-gray-700">
          <button v-for="m in ['INSERT','UPDATE','DELETE']" :key="m"
                  @click="dmlMode = m"
                  :class="[
                    'px-4 py-1.5 text-sm font-medium',
                    dmlMode === m
                      ? (m === 'DELETE' ? 'bg-red-700 text-white' : 'bg-indigo-600 text-white')
                      : 'text-gray-400 hover:bg-gray-700'
                  ]">
            {{ m }}
          </button>
        </div>
        <div class="flex items-center gap-2 text-sm text-gray-400">
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
          <span class="text-xs font-semibold uppercase tracking-wider text-gray-400">{{ dmlMode }} 模板</span>
          <button @click="copySql" :disabled="!sql"
                  class="text-xs px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {{ copyLabel }}
          </button>
        </div>
        <pre :class="[
          'bg-gray-900 rounded p-4 text-sm font-mono overflow-auto whitespace-pre-wrap',
          dmlMode === 'DELETE' ? 'text-red-400' : 'text-green-400'
        ]">{{ sql || '-- 請先選擇資料表' }}</pre>
      </div>
    </div>
  `
}
