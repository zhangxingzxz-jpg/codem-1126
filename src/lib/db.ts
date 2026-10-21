import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'fund.db');

declare global {
  // eslint-disable-next-line no-var
  var __fundDb: Database.Database | undefined;
}

function initDb(): Database.Database {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS funds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT '混合',
      company TEXT,
      risk_level TEXT,
      remark TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fund_id INTEGER NOT NULL REFERENCES funds(id),
      trade_type TEXT NOT NULL CHECK (trade_type IN ('buy', 'sell', 'dividend')),
      trade_date TEXT NOT NULL,
      amount REAL NOT NULL,
      shares REAL NOT NULL DEFAULT 0,
      fee REAL NOT NULL DEFAULT 0,
      remark TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_fund ON transactions(fund_id);

    CREATE TABLE IF NOT EXISTS tracked_portfolios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      source TEXT NOT NULL CHECK (source IN ('manual', 'qieman')),
      source_key TEXT,
      qieman_token TEXT,
      last_synced_at TEXT,
      remark TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS blogger_trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      portfolio_id INTEGER NOT NULL REFERENCES tracked_portfolios(id) ON DELETE CASCADE,
      fund_code TEXT NOT NULL,
      fund_name TEXT NOT NULL,
      trade_type TEXT NOT NULL CHECK (trade_type IN ('buy', 'sell')),
      trade_date TEXT NOT NULL,
      weight REAL,
      amount_desc TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      external_id TEXT,
      remark TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_blogger_trades_portfolio ON blogger_trades(portfolio_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_blogger_trades_external ON blogger_trades(portfolio_id, external_id) WHERE external_id IS NOT NULL;
  `);

  seedBloggerDemo(db);

  seed(db);
  return db;
}

/** 首次启动时写入示例数据，便于直接看到效果 */
function seed(db: Database.Database): void {
  const count = (
    db.prepare('SELECT COUNT(*) AS c FROM funds').get() as { c: number }
  ).c;
  if (count > 0) return;

  const insertFund = db.prepare(
    `INSERT INTO funds (code, name, type, company, risk_level, remark)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const insertTx = db.prepare(
    `INSERT INTO transactions (fund_id, trade_type, trade_date, amount, shares, fee, remark)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  db.transaction(() => {
    const funds: Array<[string, string, string, string, string, string | null]> = [
      ['110022', '易方达消费行业股票', '股票', '易方达基金', '高', '长期持有'],
      ['000834', '大成纳斯达克100指数', '指数', '大成基金', '高', null],
      ['003838', '广发纯债债券A', '债券', '广发基金', '中低', null],
    ];
    const ids: number[] = [];
    for (const f of funds) {
      const r = insertFund.run(...f);
      ids.push(Number(r.lastInsertRowid));
    }

    const txs: Array<[number, 'buy' | 'sell' | 'dividend', string, number, number, number, string | null]> = [
      [ids[0], 'buy', '2025-01-10', 10000, 5000.0, 12.5, null],
      [ids[0], 'buy', '2025-04-15', 5000, 2400.0, 6.0, null],
      [ids[0], 'dividend', '2025-06-20', 320.0, 0, 0, '现金分红'],
      [ids[0], 'sell', '2025-09-02', 3000, 1450.0, 3.0, null],
      [ids[1], 'buy', '2025-02-08', 20000, 8800.0, 25.0, null],
      [ids[1], 'buy', '2025-07-21', 8000, 3700.0, 10.0, null],
      [ids[2], 'buy', '2025-03-05', 15000, 14850.0, 15.0, null],
    ];
    for (const t of txs) insertTx.run(...t);
  })();
}

/** 博主追踪示例数据：首次启动写入一个手动源示例 */
function seedBloggerDemo(db: Database.Database): void {
  const count = (
    db.prepare('SELECT COUNT(*) AS c FROM tracked_portfolios').get() as {
      c: number;
    }
  ).c;
  if (count > 0) return;
  const r = db
    .prepare(
      `INSERT INTO tracked_portfolios (name, source, source_key, remark)
       VALUES (?, ?, ?, ?)`,
    )
    .run('E大-长赢指数投资计划', 'manual', 'LONG_WIN', '示例数据，可删除后添加自己的博主');
  const pid = Number(r.lastInsertRowid);
  const insert = db.prepare(
    `INSERT INTO blogger_trades (portfolio_id, fund_code, fund_name, trade_type, trade_date, weight, amount_desc, source, remark)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', ?)`,
  );
  insert.run(pid, '000051', '华夏沪深300ETF联接A', 'buy', '2025-08-05', 3.0, '每份买入1000元', null);
  insert.run(pid, '162411', '华宝标普油气A', 'sell', '2025-09-15', null, '卖出全部持仓', '获利了结');
}

/** 获取全局单例连接（dev 热重载下复用，避免文件锁问题） */
export function getDb(): Database.Database {
  if (!globalThis.__fundDb) {
    globalThis.__fundDb = initDb();
  }
  return globalThis.__fundDb;
}
