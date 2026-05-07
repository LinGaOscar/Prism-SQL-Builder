// ErdPanel.js：ERD 關聯圖元件
// 業務背景：視覺化呈現資料表間的外鍵關聯，讓工程師快速理解多表結構，
//           再決定 JOIN 策略，點擊節點可直接跳回對應資料表的查詢設定。
window.ErdPanelComponent = {
  name: 'ErdPanel',
  props: {
    tables: Array   // TableSchema[]
  },
  emits: ['select-table'],
  setup(props, { emit }) {
    const { ref, watch, onMounted } = Vue
    const svgContainer = ref(null)
    const errMsg = ref('')
    let renderCount = 0

    /**
     * 從 TableSchema[] 產生 erDiagram 定義文字。
     * 業務背景：FK 定義了資料表的自然關聯，
     *           ERD 讓工程師快速理解多表關係再決定 JOIN 策略。
     */
    function buildErdDef(tables) {
      const lines = ['erDiagram']
      for (const t of tables) {
        for (const fk of t.foreignKeys) {
          lines.push(`  ${t.tableName} }o--|| ${fk.refTable} : "${fk.column}"`)
        }
      }
      return lines.join('\n')
    }

    async function renderErd() {
      if (!svgContainer.value) return
      errMsg.value = ''

      const hasFk = props.tables.some(t => t.foreignKeys.length > 0)
      if (!hasFk) {
        svgContainer.value.innerHTML = '<p class="text-gray-500 text-sm p-4">沒有外鍵關聯，無法繪製 ERD</p>'
        return
      }

      const def = buildErdDef(props.tables)
      const id = 'erd-' + (++renderCount)

      try {
        const { svg } = await mermaid.render(id, def)
        svgContainer.value.innerHTML = svg

        // 點擊 Table 節點 → emit select-table，讓父元件切換至對應查詢設定
        svgContainer.value.querySelectorAll('.er.entityBox, .node').forEach(el => {
          el.style.cursor = 'pointer'
          el.addEventListener('click', () => {
            // Mermaid ERD 的 label 在 .entityLabel 或直接是文字節點
            const label = el.querySelector('.entityLabel')?.textContent?.trim()
              || el.textContent?.trim()
            if (label && props.tables.some(t => t.tableName === label)) {
              emit('select-table', label)
            }
          })
        })
      } catch (e) {
        errMsg.value = 'ERD 繪製失敗：' + e.message
      }
    }

    // tables 變動時重新繪製（深度監聽，FK 異動也能觸發）
    watch(() => props.tables, renderErd, { deep: true })
    onMounted(renderErd)

    return { svgContainer, errMsg }
  },
  template: `
    <div class="flex flex-col gap-2">
      <div class="text-xs text-gray-500">點擊資料表節點可切換至對應查詢設定</div>
      <div v-if="errMsg" class="text-red-400 text-sm">{{ errMsg }}</div>
      <div ref="svgContainer"
           class="bg-gray-900 rounded p-4 min-h-48 overflow-auto flex items-start justify-center">
        <p class="text-gray-600 text-sm self-center">尚未解析 DDL</p>
      </div>
    </div>
  `
}
