// buildSelect：將選取的欄位、條件、排序與分頁設定組成完整 SELECT SQL
// columns 空陣列時輸出 SELECT *，方便快速預覽全表
// where 支援 IS NULL / IS NOT NULL 等不需值的運算子，避免輸出 = NULL 語法錯誤
window.buildSelect = function buildSelect({ tableName, columns, where, orderBy, limit, offset }) {
  const cols = columns.length > 0 ? columns.join(', ') : '*'
  const lines = [`SELECT ${cols}`, `FROM ${tableName}`]

  // WHERE 子句：多條件以 AND 串接
  if (where && where.length > 0) {
    const conditions = where.map(({ column, operator, value }) => {
      // IS NULL / IS NOT NULL 不需要值，直接輸出欄位名稱與運算子
      if (operator === 'IS NULL' || operator === 'IS NOT NULL') {
        return `${column} ${operator}`
      }
      return `${column} ${operator} ${value}`
    })
    lines.push('WHERE ' + conditions.join(' AND '))
  }

  // ORDER BY 子句：空陣列時完全省略
  if (orderBy && orderBy.length > 0) {
    const sorts = orderBy.map(({ column, direction }) => `${column} ${direction}`)
    lines.push('ORDER BY ' + sorts.join(', '))
  }

  // LIMIT / OFFSET：limit 為 0 或 null 時不輸出；OFFSET 只在有 LIMIT 時才附加
  if (limit && limit > 0) {
    const limitLine = offset && offset > 0
      ? `LIMIT ${limit} OFFSET ${offset}`
      : `LIMIT ${limit}`
    lines.push(limitLine)
  }

  return lines.join('\n')
}
