// ErdPanel.js：自製輕量 SVG ERD 渲染器（取代 Mermaid.js，降低打包體積約 3 MB）
// 功能：資料表方塊格狀排版 + FK 關係貝茲曲線 + 點擊方塊切換查詢 tab
window.ErdPanelComponent = {
  name: 'ErdPanel',
  props: { tables: Array },
  emits: ['select-table'],
  setup(props, { emit }) {
    const { ref, watch, onMounted, onUnmounted } = Vue
    const container = ref(null)

    const BOX_W = 168, BOX_H = 44, GAP_X = 120, GAP_Y = 80, PAD = 48

    // 以 sqrt(n) 欄格狀排列，回傳各資料表左上角座標 map
    function calcLayout(tables) {
      const cols = Math.max(1, Math.ceil(Math.sqrt(tables.length)))
      const posMap = {}
      tables.forEach((t, i) => {
        posMap[t.tableName] = {
          x: PAD + (i % cols) * (BOX_W + GAP_X),
          y: PAD + Math.floor(i / cols) * (BOX_H + GAP_Y)
        }
      })
      return { posMap, cols }
    }

    // 取得方塊最靠近目標的邊緣中心點，作為連線起終點
    function edgePt(pos, targetPos) {
      const cx = pos.x + BOX_W / 2, cy = pos.y + BOX_H / 2
      const tx = targetPos.x + BOX_W / 2, ty = targetPos.y + BOX_H / 2
      const dx = tx - cx, dy = ty - cy
      if (Math.abs(dx) >= Math.abs(dy)) {
        return dx > 0 ? { x: pos.x + BOX_W, y: cy } : { x: pos.x, y: cy }
      }
      return dy > 0 ? { x: cx, y: pos.y + BOX_H } : { x: cx, y: pos.y }
    }

    function renderErd() {
      if (!container.value) return
      const tables = props.tables || []

      if (tables.length === 0) {
        container.value.innerHTML = '<p style="color:#71717a;font-size:14px;margin:auto">尚未解析 DDL</p>'
        return
      }

      // 依深淺色模式選取色盤
      const isDark = document.documentElement.classList.contains('dark')
      const c = isDark
        ? { boxBg: '#27272a', stroke: '#6366f1', text: '#e4e4e7', link: '#818cf8', label: '#a5b4fc' }
        : { boxBg: '#ffffff', stroke: '#6366f1', text: '#18181b', link: '#6366f1', label: '#4f46e5' }

      const { posMap, cols } = calcLayout(tables)
      const rows = Math.ceil(tables.length / cols)
      const W = PAD * 2 + cols * BOX_W + Math.max(0, cols - 1) * GAP_X
      const H = PAD * 2 + rows * BOX_H + Math.max(0, rows - 1) * GAP_Y

      let lines = '', boxes = ''

      // 關係線（先畫，讓方塊壓在線段上方）
      const drawn = new Set()
      for (const t of tables) {
        const fp = posMap[t.tableName]
        if (!fp) continue
        for (const fk of t.foreignKeys) {
          const tp = posMap[fk.refTable]
          if (!tp) continue
          // 雙向 FK 只畫一條線
          const key = [t.tableName, fk.refTable].sort().join('\x00')
          if (drawn.has(key)) continue
          drawn.add(key)

          const p1 = edgePt(fp, tp), p2 = edgePt(tp, fp)
          const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2
          const isH = Math.abs(p2.x - p1.x) >= Math.abs(p2.y - p1.y)
          const ctrl1 = isH ? `${mx},${p1.y}` : `${p1.x},${my}`
          const ctrl2 = isH ? `${mx},${p2.y}` : `${p2.x},${my}`

          lines += `<path d="M${p1.x},${p1.y} C${ctrl1} ${ctrl2} ${p2.x},${p2.y}"
            fill="none" stroke="${c.link}" stroke-width="1.5" opacity="0.55" marker-end="url(#erd-arr)"/>`
          lines += `<text x="${mx}" y="${my - 5}" text-anchor="middle"
            font-size="10" font-family="ui-monospace,monospace" fill="${c.label}">${fk.column}</text>`
        }
      }

      // 資料表方塊
      for (const t of tables) {
        const pos = posMap[t.tableName]
        if (!pos) continue
        const label = t.tableName.length > 18 ? t.tableName.slice(0, 16) + '…' : t.tableName
        boxes += `<g class="erd-node" data-table="${t.tableName}" style="cursor:pointer">
          <rect x="${pos.x}" y="${pos.y}" width="${BOX_W}" height="${BOX_H}" rx="6"
            fill="${c.boxBg}" stroke="${c.stroke}" stroke-width="1.5"/>
          <text x="${pos.x + BOX_W / 2}" y="${pos.y + BOX_H / 2 + 5}"
            text-anchor="middle" font-size="13" font-weight="600" pointer-events="none"
            font-family="ui-sans-serif,system-ui,sans-serif" fill="${c.text}">${label}</text>
        </g>`
      }

      const hasFk = tables.some(t => t.foreignKeys.length > 0)
      const noFkNote = !hasFk
        ? `<text x="${W / 2}" y="${H - 12}" text-anchor="middle" font-size="11"
            fill="${isDark ? '#52525b' : '#a1a1aa'}">無外鍵關聯定義</text>`
        : ''

      container.value.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"
        xmlns="http://www.w3.org/2000/svg" style="display:block">
        <defs>
          <marker id="erd-arr" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0,8 3,0 6" fill="${c.link}" opacity="0.7"/>
          </marker>
        </defs>
        ${lines}${boxes}${noFkNote}
      </svg>`

      container.value.querySelectorAll('.erd-node').forEach(el => {
        el.addEventListener('click', () => emit('select-table', el.dataset.table))
      })
    }

    // 深淺色切換時重繪（SVG 使用 inline 顏色，不受 Tailwind dark class 自動影響）
    let observer = null
    onMounted(() => {
      renderErd()
      observer = new MutationObserver(renderErd)
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    })
    onUnmounted(() => { if (observer) observer.disconnect() })
    watch(() => props.tables, renderErd, { deep: true })

    return { container }
  },
  template: `
    <div class="flex flex-col gap-2">
      <div class="text-xs text-zinc-400 dark:text-zinc-500">點擊資料表節點可切換至對應查詢設定</div>
      <div ref="container"
           class="bg-[#FAFAF7] dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 min-h-48 overflow-auto flex items-start justify-center">
      </div>
    </div>
  `
}
