// buildSelect：將選取的欄位與資料表名稱組成 SELECT SQL
// columns 空陣列時輸出 SELECT *，方便快速預覽全表
window.buildSelect = function buildSelect({ tableName, columns }) {
  const cols = columns.length > 0 ? columns.join(', ') : '*'
  return `SELECT ${cols}\nFROM ${tableName}`
}
