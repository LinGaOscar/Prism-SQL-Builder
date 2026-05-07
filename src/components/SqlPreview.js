// SqlPreview：顯示即時產生的 SQL，並提供一鍵複製功能
// 複製後短暫顯示「已複製！」提示，1.5 秒後還原，避免使用者誤以為按鈕故障
window.SqlPreviewComponent = {
  name: 'SqlPreview',
  props: { sql: String },
  setup(props) {
    const { ref } = Vue
    const copyLabel = ref('複製')

    async function copySql() {
      if (!props.sql) return
      await navigator.clipboard.writeText(props.sql)
      copyLabel.value = '已複製！'
      setTimeout(() => { copyLabel.value = '複製' }, 1500)
    }

    return { copyLabel, copySql }
  },
  template: `
    <div class="flex flex-col h-full">
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-[11px] font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500">SQL 預覽</h3>
        <button @click="copySql"
                :disabled="!sql"
                class="text-xs px-3 py-1.5 rounded-md bg-zinc-900 dark:bg-white hover:bg-zinc-700 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 transition-colors font-medium disabled:opacity-30 disabled:cursor-not-allowed">
          {{ copyLabel }}
        </button>
      </div>
      <pre class="flex-1 bg-[#FAFAF7] dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 text-sm font-code text-emerald-800 dark:text-emerald-400 overflow-auto whitespace-pre-wrap leading-relaxed">{{ sql || '-- 請選擇資料表與欄位' }}</pre>
    </div>
  `
}
