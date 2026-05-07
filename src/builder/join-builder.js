// join-builder.js：JOIN 查詢建構工具
// 提供兩個功能：
//   1. suggestJoins - 依 FK 定義自動推薦 JOIN 關聯，減少手動比對欄位的時間
//   2. buildJoinSql - 產生含 JOIN 的完整 SELECT SQL，自動處理多表欄位重名問題
(function () {

  /**
   * 從 tables（TableSchema[]）找出與指定 baseTable 有 FK 關聯的建議 JOIN。
   * 業務背景：FK 定義了資料表間的自然關聯，可自動推薦 JOIN 條件，
   *           減少工程師手動查找欄位對應關係的時間。
   * @param {import('../parser/types').TableSchema[]} tables
   * @param {string} baseTableName
   * @returns {{ fromTable: string, fromCol: string, toTable: string, toCol: string, type: string }[]}
   */
  function suggestJoins(tables, baseTableName) {
    const suggestions = []
    for (const t of tables) {
      for (const fk of t.foreignKeys) {
        // base table 持有 FK → 對外關聯（例如 orders.user_id → users.id）
        if (t.tableName === baseTableName) {
          suggestions.push({ fromTable: t.tableName, fromCol: fk.column, toTable: fk.refTable, toCol: fk.refColumn, type: 'LEFT' })
        }
        // 其他 table 的 FK 指向 base table → 被參考關聯（例如 orders → users，users 為 base）
        if (fk.refTable === baseTableName) {
          suggestions.push({ fromTable: baseTableName, fromCol: fk.refColumn, toTable: t.tableName, toCol: fk.column, type: 'LEFT' })
        }
      }
    }
    // 去重：同一對 table 只出現一次，避免雙向 FK 產生重複建議
    const seen = new Set()
    return suggestions.filter(s => {
      const key = [s.fromTable, s.toTable].sort().join('|')
      if (seen.has(key)) return false
      seen.add(key); return true
    })
  }

  /**
   * 產生包含 JOIN 的完整 SELECT SQL。
   * 多表欄位重名時自動加 table.column 前綴，避免 SQL 執行時的 ambiguous column 錯誤。
   * @param {{ baseTable: string, joins: JoinDef[], columns: { table: string, column: string }[], where: any[], orderBy: any[], limit: number, offset: number }} params
   * @returns {string}
   */
  /**
   * 依方言產生分頁子句（與 select-builder.js 邏輯一致）。
   * 業務背景：JOIN 查詢同樣需要支援多方言分頁，集中在各 builder 內維護避免引入共用依賴。
   */
  function buildLimitClause(limit, offset, dialect) {
    if (!limit || limit <= 0) return ''
    switch (dialect) {
      case 'mssql':
        return `\nOFFSET ${offset || 0} ROWS FETCH NEXT ${limit} ROWS ONLY`
      case 'oracle':
        return `\nOFFSET ${offset || 0} ROWS FETCH FIRST ${limit} ROWS ONLY`
      default:
        let sql = `\nLIMIT ${limit}`
        if (offset && offset > 0) sql += ` OFFSET ${offset}`
        return sql
    }
  }

  function buildJoinSql({ baseTable, joins, columns, where, orderBy, limit, offset, dialect }) {
    // 統計所有欄位出現次數，重名欄位需加 table 前綴才能區分來源
    const colCount = {}
    columns.forEach(c => { colCount[c.column] = (colCount[c.column] || 0) + 1 })

    const selectCols = columns.length === 0
      ? '*'
      : columns.map(c =>
          colCount[c.column] > 1 ? `${c.table}.${c.column}` : c.column
        ).join(', ')

    let sql = `SELECT ${selectCols}\nFROM ${baseTable}`

    // 依序輸出每個 JOIN 子句
    for (const j of joins) {
      sql += `\n${j.type} JOIN ${j.toTable} ON ${j.fromTable}.${j.fromCol} = ${j.toTable}.${j.toCol}`
    }

    // WHERE 子句：IS NULL / IS NOT NULL 不需值，其餘格式為 column operator value
    if (where && where.length > 0) {
      const conditions = where.map(c => {
        if (c.operator === 'IS NULL') return `${c.column} IS NULL`
        if (c.operator === 'IS NOT NULL') return `${c.column} IS NOT NULL`
        return `${c.column} ${c.operator} ${c.value}`
      })
      sql += `\nWHERE ${conditions.join(' AND ')}`
    }

    // ORDER BY 子句
    if (orderBy && orderBy.length > 0) {
      sql += `\nORDER BY ${orderBy.map(o => `${o.column} ${o.direction}`).join(', ')}`
    }

    // 依方言輸出分頁子句
    const limitClause = buildLimitClause(limit, offset, dialect || 'mysql')
    if (limitClause) sql += limitClause

    return sql
  }

  window.joinBuilder = { suggestJoins, buildJoinSql }
})()
