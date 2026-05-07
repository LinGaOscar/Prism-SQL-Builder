// buildSelect：將選取的欄位、條件、排序與分頁設定組成完整 SELECT SQL
// columns 空陣列時輸出 SELECT *，方便快速預覽全表
// where 支援 IS NULL / IS NOT NULL 等不需值的運算子，避免輸出 = NULL 語法錯誤
// dialect 參數決定分頁語法：mysql/postgresql 用 LIMIT...OFFSET，mssql/oracle 用 OFFSET...FETCH

/**
 * 依方言產生分頁子句。
 * 業務背景：不同資料庫分頁語法差異顯著，MSSQL / Oracle 需要 OFFSET...FETCH 語法，
 * 且 MSSQL 的 OFFSET...FETCH 必須搭配 ORDER BY 才合法。
 */
function buildLimitClause(limit, offset, dialect) {
  if (!limit || limit <= 0) return ''
  switch (dialect) {
    case 'mssql':
      // MSSQL 用 OFFSET...FETCH（需要 ORDER BY，若無則需呼叫端自行補上）
      return `\nOFFSET ${offset || 0} ROWS FETCH NEXT ${limit} ROWS ONLY`
    case 'oracle':
      return `\nOFFSET ${offset || 0} ROWS FETCH FIRST ${limit} ROWS ONLY`
    default:
      // mysql / postgresql 通用語法
      let sql = `\nLIMIT ${limit}`
      if (offset && offset > 0) sql += ` OFFSET ${offset}`
      return sql
  }
}

window.buildSelect = function buildSelect({ tableName, columns, where, orderBy, limit, offset, dialect }) {
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

  // 依方言輸出分頁子句
  const limitClause = buildLimitClause(limit, offset, dialect || 'mysql')
  if (limitClause) lines.push(limitClause.trimStart())

  return lines.join('\n')
}
