/**
 * DDL Parser 核心模組
 *
 * 將 CREATE TABLE SQL 語法解析為結構化的 TableSchema[]。
 * 設計為單一 IIFE，掛載到 window.parseDDL，確保可 inline 進 HTML 使用。
 *
 * 支援方言：MySQL 5.7+（反引號識別符、AUTO_INCREMENT）
 *           PostgreSQL 12+（雙引號識別符、SERIAL）
 */
(function () {

  /**
   * 移除 SQL 中的單行與區塊註解，避免干擾後續解析。
   * 注意：不處理字串字面值內的假 -- 或 /*，
   * 但一般 DDL 不會在預設值字串中放註解，可接受此簡化。
   * @param {string} sql
   * @returns {string}
   */
  function removeComments(sql) {
    // 移除 /* ... */ 區塊註解（含跨行）
    sql = sql.replace(/\/\*[\s\S]*?\*\//g, '');
    // 移除 -- 單行註解
    sql = sql.replace(/--[^\n]*/g, '');
    return sql;
  }

  /**
   * 從 SQL 文字中識別符周圍可能有的引號（反引號/雙引號）或無引號，
   * 統一回傳純識別符字串。
   * 業務背景：MySQL 慣用反引號，PostgreSQL 慣用雙引號，
   *           無引號識別符在兩者皆合法。
   * @param {string} str - 待解析字串，游標在起始位置
   * @returns {{ name: string, rest: string }} name 為識別符，rest 為剩餘字串
   */
  function parseIdentifier(str) {
    str = str.trimStart();
    let name = '';
    let rest = str;

    if (str[0] === '[') {
      // MSSQL 方括號識別符，例如 [table_name] 或 [column_name]
      const end = str.indexOf(']', 1);
      name = str.slice(1, end);
      rest = str.slice(end + 1);
    } else if (str[0] === '`') {
      // MySQL 反引號識別符
      const end = str.indexOf('`', 1);
      name = str.slice(1, end);
      rest = str.slice(end + 1);
    } else if (str[0] === '"') {
      // PostgreSQL / ANSI 雙引號識別符
      const end = str.indexOf('"', 1);
      name = str.slice(1, end);
      rest = str.slice(end + 1);
    } else {
      // 無引號識別符：到空白或括號或逗號為止
      const m = str.match(/^([A-Za-z_]\w*)/);
      if (m) {
        name = m[1];
        rest = str.slice(m[1].length);
      }
    }
    return { name, rest };
  }

  /**
   * 移除識別符外層引號。
   * @param {string} name
   * @returns {string}
   */
  function stripIdentifierQuotes(name) {
    return name.replace(/^[`"\[]|[`"\]]$/g, '');
  }

  /**
   * 解析可能含 schema 前綴的完整識別符，例如 dbo.Users、[dbo].[Users]、"public"."users"。
   * @param {string} str
   * @returns {{ name: string, rest: string }}
   */
  function parseQualifiedIdentifier(str) {
    const parts = [];
    let rest = str;

    while (true) {
      const parsed = parseIdentifier(rest);
      if (!parsed.name) break;

      parts.push(parsed.name);
      rest = parsed.rest.trimStart();

      if (rest[0] !== '.') break;
      rest = rest.slice(1);
    }

    return { name: parts.join('.'), rest };
  }

  /**
   * 從 CREATE TABLE 之後的括號 body 文字中，
   * 提取匹配成對括號的完整內容（不含最外層括號）。
   * 業務背景：CREATE TABLE body 可能含巢狀括號，例如 DEFAULT (CURRENT_TIMESTAMP)
   *           或 CHECK (col > 0)，需要計數器而非單純 indexOf。
   * @param {string} sql - 從第一個 '(' 之前開始的字串
   * @returns {{ body: string, rest: string }|null}
   */
  function extractParenBody(sql) {
    const start = sql.indexOf('(');
    if (start === -1) return null;

    let depth = 0;
    let i = start;
    while (i < sql.length) {
      if (sql[i] === '(') depth++;
      else if (sql[i] === ')') {
        depth--;
        if (depth === 0) {
          return {
            body: sql.slice(start + 1, i),
            rest: sql.slice(i + 1)
          };
        }
      }
      i++;
    }
    return null; // 括號未閉合，忽略此 CREATE TABLE
  }

  /**
   * 將 CREATE TABLE body 分割成各個定義行（欄位或約束）。
   * 業務背景：每一行以逗號分隔，但 DEFAULT (expr) 或 CHECK(expr)
   *           內的括號可能含逗號，需逐字元計數而非直接 split(',')。
   * @param {string} body
   * @returns {string[]}
   */
  function splitBodyLines(body) {
    const lines = [];
    let depth = 0;
    let current = '';

    for (let i = 0; i < body.length; i++) {
      const ch = body[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;

      if (ch === ',' && depth === 0) {
        const trimmed = current.trim();
        if (trimmed) lines.push(trimmed);
        current = '';
      } else {
        current += ch;
      }
    }
    const trimmed = current.trim();
    if (trimmed) lines.push(trimmed);
    return lines;
  }

  /**
   * 解析單一欄位定義行，回傳 ColumnDef。
   * 業務背景：欄位行格式為
   *   [引號]名稱[引號]  型別[(長度)]  [NOT NULL]  [DEFAULT 值]
   *   [AUTO_INCREMENT]  [PRIMARY KEY]  [其他約束...]
   * @param {string} line
   * @returns {import('./types').ColumnDef|null}
   */
  function parseColumnLine(line) {
    // 取得欄位名稱
    const { name, rest: afterName } = parseIdentifier(line);
    if (!name) return null;

    const upper = afterName.trimStart().toUpperCase();

    // 取得型別：到空白、逗號、括號開始為止，然後如果有 (n) 一併納入
    const typeMatch = afterName.trimStart().match(
      /^([A-Za-z_]\w*(?:\s*\([^)]*\))?)/
    );
    if (!typeMatch) return null;
    const type = typeMatch[1].trim();

    const rest = afterName.trimStart().slice(typeMatch[1].length);
    const restUpper = rest.toUpperCase();

    // nullable：有 NOT NULL 則為 false
    const nullable = !/\bNOT\s+NULL\b/.test(restUpper);

    // isPrimaryKey：行內 PRIMARY KEY 關鍵字
    const isPrimaryKey = /\bPRIMARY\s+KEY\b/.test(restUpper);

    // isAutoIncrement：MySQL AUTO_INCREMENT 或 PostgreSQL SERIAL 型別
    const isAutoIncrement =
      /\bAUTO_INCREMENT\b/.test(restUpper) ||
      /^SERIAL\b/.test(type.toUpperCase()) ||
      /^BIGSERIAL\b/.test(type.toUpperCase()) ||
      /^SMALLSERIAL\b/.test(type.toUpperCase());

    // DEFAULT 值提取
    // 支援兩種情形：DEFAULT (expr) 括號內含空白/逗號，以及 DEFAULT simpleVal
    let defaultValue = null;
    const defaultMatch = rest.match(/\bDEFAULT\s+(\((?:[^()]*|\((?:[^()]*)\))*\)|'[^']*'|[^\s,]+)/i);
    if (defaultMatch) {
      defaultValue = defaultMatch[1];
    }

    // MySQL 行內 COMMENT 'xxx' 提取
    let comment = null;
    const commentMatch = rest.match(/\bCOMMENT\s+'((?:[^'\\]|\\.)*)'/i);
    if (commentMatch) {
      comment = commentMatch[1];
    }

    return {
      name,
      type,
      nullable,
      isPrimaryKey,
      defaultValue,
      isAutoIncrement,
      comment
    };
  }

  /**
   * 解析 PRIMARY KEY (col1, col2) 表級約束，回傳欄位名稱陣列。
   * 業務背景：複合主鍵常見於關聯表（junction table），
   *           例如 order_items 以 (order_id, product_id) 作複合 PK。
   * @param {string} line
   * @returns {string[]}
   */
  function parsePrimaryKeyLine(line) {
    const m = line.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
    if (!m) return [];
    return m[1].split(',').map(s => {
      const { name } = parseIdentifier(s.trim());
      return name;
    }).filter(Boolean);
  }

  /**
   * 解析 FOREIGN KEY (col) REFERENCES tbl(ref) 表級外鍵約束。
   * 業務背景：FK 用於 JOIN 推薦功能，告知 UI 哪些欄位可自動帶入 JOIN 條件。
   * @param {string} line
   * @returns {import('./types').ForeignKey|null}
   */
  function parseForeignKeyLine(line) {
    // FOREIGN KEY (`col`) REFERENCES `tbl` (`ref`)
    const m = line.match(
      /FOREIGN\s+KEY\s*\(\s*([`"\[]?[\w]+[`"\]]?)\s*\)\s*REFERENCES\s+((?:[`"\[]?[\w]+[`"\]]?\s*\.\s*)?[`"\[]?[\w]+[`"\]]?)\s*\(\s*([`"\[]?[\w]+[`"\]]?)\s*\)/i
    );
    if (!m) return null;

    return {
      column: stripIdentifierQuotes(m[1]),
      refTable: m[2].split('.').map(s => stripIdentifierQuotes(s.trim())).join('.'),
      refColumn: stripIdentifierQuotes(m[3])
    };
  }

  /**
   * 主解析函式：將完整 DDL SQL 字串解析為 TableSchema 陣列。
   * 輸入空字串或無 CREATE TABLE 時回傳 []，不拋出例外。
   * @param {string} sql
   * @returns {import('./types').TableSchema[]}
   */
  function parseDDL(sql) {
    if (!sql || !sql.trim()) return [];

    sql = removeComments(sql);

    const tables = [];

    // 尋找所有 CREATE TABLE [IF NOT EXISTS] name (...)
    // 識別符支援反引號、雙引號、方括號、無引號，以及 schema.table 前綴
    const createTableRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?/gi;
    let match;

    while ((match = createTableRe.exec(sql)) !== null) {
      const parsedTableName = parseQualifiedIdentifier(sql.slice(createTableRe.lastIndex));
      const tableName = parsedTableName.name;
      if (!tableName) continue;

      // 從匹配位置之後找括號 body
      const fromParen = parsedTableName.rest;
      const extracted = extractParenBody(fromParen);
      if (!extracted) continue;

      const { body } = extracted;
      const lines = splitBodyLines(body);

      const columns = [];
      const primaryKeys = [];
      const foreignKeys = [];

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        const lineUpper = line.toUpperCase().trimStart();

        // 表級 PRIMARY KEY 約束
        if (/^PRIMARY\s+KEY\b/.test(lineUpper)) {
          const pks = parsePrimaryKeyLine(line);
          primaryKeys.push(...pks);
          continue;
        }

        // 表級 FOREIGN KEY 約束
        if (/^(?:CONSTRAINT\s+\S+\s+)?FOREIGN\s+KEY\b/.test(lineUpper)) {
          const fk = parseForeignKeyLine(line);
          if (fk) foreignKeys.push(fk);
          continue;
        }

        // 跳過 UNIQUE、INDEX、KEY（非欄位定義）
        if (/^(?:UNIQUE|INDEX|KEY)\b/.test(lineUpper)) {
          continue;
        }

        // 跳過 CONSTRAINT ... UNIQUE 等表級約束
        if (/^CONSTRAINT\b/.test(lineUpper) && !/^CONSTRAINT.*FOREIGN\s+KEY\b/.test(lineUpper)) {
          continue;
        }

        // 解析為欄位定義
        const col = parseColumnLine(line);
        if (col) {
          columns.push(col);
          // 行內 PRIMARY KEY 也要加入 primaryKeys 清單
          if (col.isPrimaryKey) {
            primaryKeys.push(col.name);
          }
        }
      }

      // 將表級 primaryKeys 同步回對應 column 的 isPrimaryKey 旗標
      for (const col of columns) {
        if (primaryKeys.includes(col.name)) {
          col.isPrimaryKey = true;
        }
      }

      tables.push({ tableName, columns, primaryKeys, foreignKeys });
    }

    return tables;
  }

  /**
   * 從 DDL 文字推斷 SQL 方言，供匯入後自動切換右上角選單。
   * 優先順序：MSSQL > Oracle > PostgreSQL > MySQL（預設）。
   * 業務背景：使用者匯入不同來源的 DDL 時，分頁語法（LIMIT/OFFSET vs FETCH NEXT）
   *           與型別對應差異較大，自動偵測可避免手動切換錯誤。
   * @param {string} sql
   * @returns {'mysql'|'postgresql'|'mssql'|'oracle'}
   */
  function detectDialect(sql) {
    const upper = sql.toUpperCase();
    // MSSQL：方括號識別符、IDENTITY、NVARCHAR、DATETIME2、UNIQUEIDENTIFIER
    if (
      /\[[A-Za-z_][\w ]*\]/.test(sql) ||
      /\bIDENTITY\s*\(/.test(upper) ||
      /\bNVARCHAR\b/.test(upper) ||
      /\bDATETIME2\b/.test(upper) ||
      /\bUNIQUEIDENTIFIER\b/.test(upper)
    ) return 'mssql';
    // Oracle：VARCHAR2、NUMBER(、CLOB、NVARCHAR2
    if (
      /\bVARCHAR2\s*\(/.test(upper) ||
      /\bNUMBER\s*\(/.test(upper) ||
      /\bCLOB\b/.test(upper) ||
      /\bNVARCHAR2\b/.test(upper)
    ) return 'oracle';
    // PostgreSQL：SERIAL 系列、JSONB
    if (/\b(?:BIGSERIAL|SMALLSERIAL|SERIAL)\b/.test(upper) || /\bJSONB\b/.test(upper)) {
      return 'postgresql';
    }
    return 'mysql';
  }

  // 掛載到 window，供 HTML inline 後全域使用
  window.parseDDL = parseDDL;
  window.detectDialect = detectDialect;

})();
