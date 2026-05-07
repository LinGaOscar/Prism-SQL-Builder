(function () {
  /**
   * 將 app state 序列化為 .md 格式字串。
   * 業務背景：.md 格式人類可讀、適合版控，換電腦只需複製檔案即可還原。
   */
  function serialize(state) {
    const { rawDdl, selectedTable, selectedColumns, where, orderBy, limit, offset } = state
    const queryState = JSON.stringify({ selectedTable, selectedColumns, where, orderBy, limit, offset }, null, 2)
    return `# Prism Schema\n\n\`\`\`sql\n${rawDdl || ''}\n\`\`\`\n\n\`\`\`json\n${queryState}\n\`\`\`\n`
  }

  /**
   * 從 .md 格式字串反序列化為 app state。
   * 回傳 { rawDdl, ...queryState } 或 null（格式錯誤時）。
   */
  function deserialize(text) {
    try {
      const sqlMatch = text.match(/```sql\n([\s\S]*?)\n```/)
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/)
      const rawDdl = sqlMatch ? sqlMatch[1] : ''
      const queryState = jsonMatch ? JSON.parse(jsonMatch[1]) : {}
      return { rawDdl, ...queryState }
    } catch { return null }
  }

  window.mdFormat = { serialize, deserialize }
})()
