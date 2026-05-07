(function () {
  const LS_KEY = 'prism_state'

  /**
   * 將目前 app state 存入 localStorage。
   * 業務背景：MVP 階段快速暫存，讓使用者重開瀏覽器後可還原上次工作狀態。
   */
  function lsSave(state) {
    localStorage.setItem(LS_KEY, JSON.stringify(state))
  }

  /** 讀取 localStorage 中的暫存 state，不存在時回傳 null。 */
  function lsLoad() {
    try {
      const raw = localStorage.getItem(LS_KEY)
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  }

  /** 清除 localStorage 暫存（遷移至 .md 檔後呼叫）。 */
  function lsClear() {
    localStorage.removeItem(LS_KEY)
  }

  /** 檢查 localStorage 是否有舊資料（DDL 非空即視為有效）。 */
  function lsHasData() {
    const s = lsLoad()
    return !!(s && s.rawDdl && s.rawDdl.trim())
  }

  window.lsStorage = { lsSave, lsLoad, lsClear, lsHasData }
})()
