/**
 * DDL Parser 型別定義
 * 此檔案僅作 JSDoc 型別宣告，不含任何執行邏輯。
 * 供編輯器補全與文件生成使用。
 */

/**
 * @typedef {Object} ColumnDef
 * 代表資料表中的一個欄位定義
 * @property {string} name - 欄位名稱
 * @property {string} type - 欄位型別，例如 INT、VARCHAR(255)、TIMESTAMP 等
 * @property {boolean} nullable - 是否允許 NULL；有 NOT NULL 約束時為 false
 * @property {boolean} isPrimaryKey - 是否為主鍵（行內或表級 PRIMARY KEY 皆設為 true）
 * @property {string|null} defaultValue - DEFAULT 預設值字串；無預設值時為 null
 * @property {boolean} isAutoIncrement - 是否自動遞增（MySQL AUTO_INCREMENT 或 PostgreSQL SERIAL）
 */

/**
 * @typedef {Object} ForeignKey
 * 代表一條外鍵約束關係
 * @property {string} column - 本表參照欄位名稱
 * @property {string} refTable - 被參照的目標資料表名稱
 * @property {string} refColumn - 被參照的目標欄位名稱
 */

/**
 * @typedef {Object} TableSchema
 * 代表一張完整的資料表結構，由 parseDDL 解析後回傳
 * @property {string} tableName - 資料表名稱
 * @property {ColumnDef[]} columns - 所有欄位定義陣列
 * @property {string[]} primaryKeys - 主鍵欄位名稱陣列（支援複合主鍵）
 * @property {ForeignKey[]} foreignKeys - 外鍵約束陣列
 */
