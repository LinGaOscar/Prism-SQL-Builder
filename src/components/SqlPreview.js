// SqlPreview：顯示即時產生的 SQL，提供格式化切換與一鍵複製
// 格式化僅展開輸出排版，不修改 SQL 語意；複製內容跟隨當前顯示模式
window.SqlPreviewComponent = {
  name: 'SqlPreview',
  props: { sql: String },
  emits: ['copy'],
  setup(props, { emit }) {
    const { ref, computed } = Vue
    const copyLabel = ref('複製')
    const pretty = ref(false)

    /**
     * SQL 後處理格式化：展開多欄 SELECT、多條件 WHERE、多排序 ORDER BY。
     * 以逐行處理方式保留現有換行結構，僅對特定子句做縮排展開。
     * 業務背景：單行 SQL 難以 code review；格式化版本方便貼入 PR 或需求文件。
     */
    function formatSql(sql) {
      if (!sql || sql.trimStart().startsWith('--')) return sql
      return sql.split('\n').flatMap(line => {
        const upper = line.trimStart().toUpperCase()

        // SELECT：多欄位時每欄一行，縮排兩格
        if (upper.startsWith('SELECT ') && line.includes(',')) {
          const cols = line.trimStart().slice(7).split(',').map(c => c.trim()).filter(Boolean)
          return ['SELECT', ...cols.map((c, i) => `  ${c}${i < cols.length - 1 ? ',' : ''}`)]
        }

        // WHERE：多條件時每條 AND 獨立一行，縮排兩格
        if (upper.startsWith('WHERE ')) {
          const parts = line.trimStart().slice(6).split(/ AND /i)
          if (parts.length > 1) {
            return ['WHERE', `  ${parts[0].trim()}`, ...parts.slice(1).map(p => `  AND ${p.trim()}`)]
          }
        }

        // ORDER BY：多排序欄位時每項一行
        if (upper.startsWith('ORDER BY ') && line.includes(',')) {
          const sorts = line.trimStart().slice(9).split(',').map(s => s.trim()).filter(Boolean)
          return ['ORDER BY', ...sorts.map((s, i) => `  ${s}${i < sorts.length - 1 ? ',' : ''}`)]
        }

        return [line]
      }).join('\n')
    }

    const displaySql = computed(() =>
      props.sql && pretty.value ? formatSql(props.sql) : (props.sql || '')
    )

    async function copySql() {
      if (!displaySql.value) return
      await navigator.clipboard.writeText(displaySql.value)
      copyLabel.value = '已複製！'
      setTimeout(() => { copyLabel.value = '複製' }, 1500)
      emit('copy')
    }

    return { copyLabel, copySql, pretty, displaySql }
  },
  template: `
    <div class="flex flex-col h-full">
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <h3 class="text-[11px] font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500">SQL 預覽</h3>
          <button @click="pretty = !pretty"
                  :class="pretty
                    ? 'border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950'
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'"
                  class="text-[11px] px-2 py-0.5 rounded border transition-colors">
            格式化
          </button>
        </div>
        <button @click="copySql"
                :disabled="!sql"
                class="text-xs px-3 py-1.5 rounded-md bg-zinc-900 dark:bg-white hover:bg-zinc-700 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 transition-colors font-medium disabled:opacity-30 disabled:cursor-not-allowed">
          {{ copyLabel }}
        </button>
      </div>
      <pre name="sql-preview" class="flex-1 bg-[#FAFAF7] dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 text-sm font-code text-emerald-800 dark:text-emerald-400 overflow-auto whitespace-pre-wrap leading-relaxed custom-scrollbar" style="max-height: max(200px, calc(100vh - 680px));">{{ displaySql || '-- 請選擇資料表與欄位' }}</pre>
    </div>
  `
}
