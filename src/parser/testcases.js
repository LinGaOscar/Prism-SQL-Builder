/**
 * DDL Parser 測試執行器
 *
 * 在瀏覽器 console 中執行：直接貼入此檔案內容，或用
 *   <script src="src/parser/ddl-parser.js"></script>
 *   <script src="src/parser/testcases.js"></script>
 * 載入後自動執行所有測試，印出 PASS / FAIL。
 *
 * 前提：window.parseDDL 已存在（由 ddl-parser.js 掛載）。
 */
(function () {

  // ─── 測試工具函式 ──────────────────────────────────────────────

  let passCount = 0;
  let failCount = 0;

  /**
   * 斷言輔助：比較實際值與預期值（JSON 深比較）
   * @param {string} testName
   * @param {*} actual
   * @param {*} expected
   */
  function assert(testName, actual, expected) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a === e) {
      console.log('%c PASS %c ' + testName, 'color:green;font-weight:bold', 'color:inherit');
      passCount++;
    } else {
      console.error('%c FAIL %c ' + testName, 'color:red;font-weight:bold', 'color:inherit');
      console.error('  期望:', e);
      console.error('  實際:', a);
      failCount++;
    }
  }

  // ─── 測試案例 ──────────────────────────────────────────────────

  // TC-01：空輸入應回傳 []
  assert(
    'TC-01 空輸入',
    parseDDL(''),
    []
  );

  // TC-02：空白字串應回傳 []
  assert(
    'TC-02 空白字串',
    parseDDL('   \n\t  '),
    []
  );

  // TC-03：MySQL 範例 — 反引號識別符、AUTO_INCREMENT、行內 PK
  assert(
    'TC-03 MySQL 基本欄位（反引號 + AUTO_INCREMENT）',
    parseDDL(
      'CREATE TABLE `users` (' +
      '  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,' +
      '  `name` VARCHAR(100) NOT NULL,' +
      '  `email` VARCHAR(255)' +
      ');'
    ),
    [{
      tableName: 'users',
      columns: [
        { name: 'id',    type: 'INT',          nullable: false, isPrimaryKey: true,  defaultValue: null, isAutoIncrement: true  },
        { name: 'name',  type: 'VARCHAR(100)',  nullable: false, isPrimaryKey: false, defaultValue: null, isAutoIncrement: false },
        { name: 'email', type: 'VARCHAR(255)',  nullable: true,  isPrimaryKey: false, defaultValue: null, isAutoIncrement: false }
      ],
      primaryKeys: ['id'],
      foreignKeys: []
    }]
  );

  // TC-04：MySQL 複合主鍵（表級 PRIMARY KEY）
  assert(
    'TC-04 MySQL 複合主鍵',
    parseDDL(
      'CREATE TABLE `order_items` (' +
      '  `order_id` INT NOT NULL,' +
      '  `product_id` INT NOT NULL,' +
      '  `qty` INT NOT NULL,' +
      '  PRIMARY KEY (`order_id`, `product_id`)' +
      ');'
    ),
    [{
      tableName: 'order_items',
      columns: [
        { name: 'order_id',   type: 'INT', nullable: false, isPrimaryKey: true,  defaultValue: null, isAutoIncrement: false },
        { name: 'product_id', type: 'INT', nullable: false, isPrimaryKey: true,  defaultValue: null, isAutoIncrement: false },
        { name: 'qty',        type: 'INT', nullable: false, isPrimaryKey: false, defaultValue: null, isAutoIncrement: false }
      ],
      primaryKeys: ['order_id', 'product_id'],
      foreignKeys: []
    }]
  );

  // TC-05：PostgreSQL 範例 — 雙引號識別符、SERIAL
  assert(
    'TC-05 PostgreSQL SERIAL + 雙引號',
    parseDDL(
      'CREATE TABLE "products" (' +
      '  "id" SERIAL PRIMARY KEY,' +
      '  "title" TEXT NOT NULL,' +
      '  "price" DECIMAL(10,2)' +
      ');'
    ),
    [{
      tableName: 'products',
      columns: [
        { name: 'id',    type: 'SERIAL',        nullable: true,  isPrimaryKey: true,  defaultValue: null, isAutoIncrement: true  },
        { name: 'title', type: 'TEXT',           nullable: false, isPrimaryKey: false, defaultValue: null, isAutoIncrement: false },
        { name: 'price', type: 'DECIMAL(10,2)',  nullable: true,  isPrimaryKey: false, defaultValue: null, isAutoIncrement: false }
      ],
      primaryKeys: ['id'],
      foreignKeys: []
    }]
  );

  // TC-06：帶括號的預設值 DEFAULT (CURRENT_TIMESTAMP)
  assert(
    'TC-06 DEFAULT (CURRENT_TIMESTAMP)',
    parseDDL(
      'CREATE TABLE events (' +
      '  id INT NOT NULL,' +
      '  created_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP)' +
      ');'
    ),
    [{
      tableName: 'events',
      columns: [
        { name: 'id',         type: 'INT',       nullable: false, isPrimaryKey: false, defaultValue: null,                isAutoIncrement: false },
        { name: 'created_at', type: 'TIMESTAMP',  nullable: true,  isPrimaryKey: false, defaultValue: '(CURRENT_TIMESTAMP)', isAutoIncrement: false }
      ],
      primaryKeys: [],
      foreignKeys: []
    }]
  );

  // TC-07：FOREIGN KEY 表級約束
  assert(
    'TC-07 FOREIGN KEY',
    parseDDL(
      'CREATE TABLE orders (' +
      '  id INT NOT NULL PRIMARY KEY,' +
      '  user_id INT NOT NULL,' +
      '  FOREIGN KEY (user_id) REFERENCES users(id)' +
      ');'
    ),
    [{
      tableName: 'orders',
      columns: [
        { name: 'id',      type: 'INT', nullable: false, isPrimaryKey: true,  defaultValue: null, isAutoIncrement: false },
        { name: 'user_id', type: 'INT', nullable: false, isPrimaryKey: false, defaultValue: null, isAutoIncrement: false }
      ],
      primaryKeys: ['id'],
      foreignKeys: [{ column: 'user_id', refTable: 'users', refColumn: 'id' }]
    }]
  );

  // TC-08：IF NOT EXISTS 應正常解析
  assert(
    'TC-08 CREATE TABLE IF NOT EXISTS',
    parseDDL(
      'CREATE TABLE IF NOT EXISTS tags (' +
      '  id INT PRIMARY KEY,' +
      '  label VARCHAR(50) NOT NULL' +
      ');'
    ),
    [{
      tableName: 'tags',
      columns: [
        { name: 'id',    type: 'INT',         nullable: true,  isPrimaryKey: true,  defaultValue: null, isAutoIncrement: false },
        { name: 'label', type: 'VARCHAR(50)',  nullable: false, isPrimaryKey: false, defaultValue: null, isAutoIncrement: false }
      ],
      primaryKeys: ['id'],
      foreignKeys: []
    }]
  );

  // TC-09：單行註解與區塊註解應被移除
  assert(
    'TC-09 移除 SQL 註解',
    parseDDL(
      '-- 這是使用者資料表\n' +
      'CREATE TABLE /* 主表 */ users (\n' +
      '  id INT PRIMARY KEY -- 主鍵\n' +
      ');'
    ),
    [{
      tableName: 'users',
      columns: [
        { name: 'id', type: 'INT', nullable: true, isPrimaryKey: true, defaultValue: null, isAutoIncrement: false }
      ],
      primaryKeys: ['id'],
      foreignKeys: []
    }]
  );

  // TC-10：UNIQUE / INDEX / KEY 行應被跳過，不產生欄位
  assert(
    'TC-10 跳過 UNIQUE / INDEX / KEY 行',
    parseDDL(
      'CREATE TABLE `sessions` (' +
      '  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,' +
      '  `token` VARCHAR(64) NOT NULL,' +
      '  UNIQUE KEY `uq_token` (`token`),' +
      '  INDEX `idx_token` (`token`)' +
      ');'
    ),
    [{
      tableName: 'sessions',
      columns: [
        { name: 'id',    type: 'BIGINT',       nullable: false, isPrimaryKey: true,  defaultValue: null, isAutoIncrement: true  },
        { name: 'token', type: 'VARCHAR(64)',   nullable: false, isPrimaryKey: false, defaultValue: null, isAutoIncrement: false }
      ],
      primaryKeys: ['id'],
      foreignKeys: []
    }]
  );

  // TC-11：多張資料表同時解析
  const multiTableResult = parseDDL(
    'CREATE TABLE a (id INT PRIMARY KEY);' +
    'CREATE TABLE b (id INT PRIMARY KEY, a_id INT, FOREIGN KEY (a_id) REFERENCES a(id));'
  );
  assert('TC-11 多張資料表數量', multiTableResult.length, 2);
  assert('TC-11 第一張表名稱', multiTableResult[0].tableName, 'a');
  assert('TC-11 第二張表名稱', multiTableResult[1].tableName, 'b');
  assert('TC-11 FK 數量', multiTableResult[1].foreignKeys.length, 1);

  // TC-12：DEFAULT 簡單字面值（數字、字串）
  assert(
    'TC-12 DEFAULT 簡單值',
    parseDDL(
      "CREATE TABLE settings (flag BOOLEAN DEFAULT 0, note TEXT DEFAULT 'none');"
    ),
    [{
      tableName: 'settings',
      columns: [
        { name: 'flag', type: 'BOOLEAN', nullable: true, isPrimaryKey: false, defaultValue: '0',      isAutoIncrement: false },
        { name: 'note', type: 'TEXT',    nullable: true, isPrimaryKey: false, defaultValue: "'none'", isAutoIncrement: false }
      ],
      primaryKeys: [],
      foreignKeys: []
    }]
  );

  // ─── 結果統計 ──────────────────────────────────────────────────
  console.log(
    '\n%c DDL Parser 測試結果：' + passCount + ' PASS / ' + failCount + ' FAIL ',
    failCount === 0
      ? 'background:green;color:white;font-weight:bold;padding:2px 8px'
      : 'background:red;color:white;font-weight:bold;padding:2px 8px'
  );

})();
