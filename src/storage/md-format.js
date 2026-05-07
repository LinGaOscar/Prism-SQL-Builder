(function () {
  /**
   * 將 app state 序列化為 .md 格式字串。
   * 業務背景：.md 格式人類可讀、適合版控，換電腦只需複製檔案即可還原。
   * 新格式含 dialect 欄位與 savedQueries 陣列，支援多組查詢設定共存同一 Schema 檔。
   */
  function serialize(state) {
    const { rawDdl, dialect, savedQueries } = state
    const jsonBlock = JSON.stringify({ savedQueries: savedQueries || [] }, null, 2)
    return `# Prism Schema\n\ndialect: ${dialect || 'mysql'}\n\n\`\`\`sql\n${rawDdl || ''}\n\`\`\`\n\n\`\`\`json\n${jsonBlock}\n\`\`\`\n`
  }

  /**
   * 從 .md 格式字串反序列化為 app state。
   * 回傳 { rawDdl, dialect, savedQueries } 或 null（格式錯誤時）。
   * 向下相容：舊格式 JSON block 含 selectedTable 等欄位（無 savedQueries），
   * 自動包裝成 savedQueries[0]，名稱設為「上次查詢」。
   */
  function deserialize(text) {
    try {
      const dialectMatch = text.match(/^dialect:\s*(\w+)/m)
      const sqlMatch = text.match(/```sql\n([\s\S]*?)\n```/)
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/)
      const dialect = dialectMatch ? dialectMatch[1] : 'mysql'
      const rawDdl = sqlMatch ? sqlMatch[1] : ''
      const parsed = jsonMatch ? JSON.parse(jsonMatch[1]) : {}
      // 向下相容：舊格式有 selectedTable 等欄位（無 savedQueries）
      if (!parsed.savedQueries && parsed.selectedTable) {
        const { savedQueries: _, ...legacyQuery } = parsed
        parsed.savedQueries = [{ name: '上次查詢', ...legacyQuery }]
      }
      return { rawDdl, dialect, savedQueries: parsed.savedQueries || [] }
    } catch { return null }
  }

  window.mdFormat = { serialize, deserialize }
})()
