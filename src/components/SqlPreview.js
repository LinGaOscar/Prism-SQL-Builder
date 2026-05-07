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
        <h3 class="text-xs font-semibold uppercase tracking-wider text-gray-400">SQL 預覽</h3>
        <button @click="copySql"
                :disabled="!sql"
                class="text-xs px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          {{ copyLabel }}
        </button>
      </div>
      <pre class="flex-1 bg-gray-900 rounded p-4 text-sm text-green-400 font-mono overflow-auto whitespace-pre-wrap">{{ sql || '-- 請選擇資料表與欄位' }}</pre>
    </div>
  `
}
