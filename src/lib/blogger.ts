import { getDb } from './db';

export type PortfolioSource = 'manual' | 'qieman';

export type TrackedPortfolio = {
  id: number;
  name: string;
  source: PortfolioSource;
  source_key: string | null;
  qieman_token: string | null;
  last_synced_at: string | null;
  remark: string | null;
  created_at: string;
};

export type BloggerTrade = {
  id: number;
  portfolio_id: number;
  portfolio_name: string;
  fund_code: string;
  fund_name: string;
  trade_type: 'buy' | 'sell';
  trade_date: string;
  weight: number | null;
  amount_desc: string | null;
  source: string;
  external_id: string | null;
  remark: string | null;
  created_at: string;
  /** 关联提示：该基金是否已在用户自选（funds 表）中 */
  owned: boolean;
};

export function getPortfolios(): Array<TrackedPortfolio & { trade_count: number }> {
  const db = getDb();
  return db
    .prepare(
      `SELECT p.*, COUNT(t.id) AS trade_count
       FROM tracked_portfolios p
       LEFT JOIN blogger_trades t ON t.portfolio_id = p.id
       GROUP BY p.id
       ORDER BY p.id`,
    )
    .all() as Array<TrackedPortfolio & { trade_count: number }>;
}

export function getPortfolio(id: number): TrackedPortfolio | undefined {
  const db = getDb();
  return db
    .prepare('SELECT * FROM tracked_portfolios WHERE id = ?')
    .get(id) as TrackedPortfolio | undefined;
}

  export function getBloggerTrades(
    portfolioId?: number,
  ): BloggerTrade[] {
    const db = getDb();
    const sql = `SELECT t.*, p.name AS portfolio_name,
                  CASE WHEN f.id IS NOT NULL THEN 1 ELSE 0 END AS owned
               FROM blogger_trades t
               JOIN tracked_portfolios p ON p.id = t.portfolio_id
               LEFT JOIN funds f ON f.code = t.fund_code`;
    const rawRows: unknown[] = portfolioId
      ? (db
          .prepare(`${sql} WHERE t.portfolio_id = ? ORDER BY t.trade_date DESC, t.id DESC`)
          .all(portfolioId) as unknown[])
      : (db
          .prepare(`${sql} ORDER BY t.trade_date DESC, t.id DESC`)
          .all() as unknown[]);
    type TradeRow = Omit<BloggerTrade, 'owned'> & { owned: 0 | 1 };
    return rawRows.map((raw) => {
      const r = raw as TradeRow;
      return { ...r, owned: r.owned === 1 };
    });
  }

export function insertManualTrade(input: {
  portfolio_id: number;
  fund_code: string;
  fund_name?: string | null;
  trade_type: 'buy' | 'sell';
  trade_date: string;
  weight?: number | null;
  amount_desc?: string | null;
  remark?: string | null;
}): BloggerTrade | undefined {
  const db = getDb();
  const portfolio = getPortfolio(input.portfolio_id);
  if (!portfolio) return undefined;

  // 基金名优先取自选库，避免手写不一致
  let fundName = input.fund_name?.trim() || '';
  const known = db
    .prepare('SELECT name FROM funds WHERE code = ?')
    .get(input.fund_code) as { name: string } | undefined;
  if (known) fundName = known.name;
  if (!fundName) return undefined;

  const r = db
    .prepare(
      `INSERT INTO blogger_trades (portfolio_id, fund_code, fund_name, trade_type, trade_date, weight, amount_desc, source, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', ?)`,
    )
    .run(
      input.portfolio_id,
      input.fund_code,
      fundName,
      input.trade_type,
      input.trade_date,
      input.weight ?? null,
      input.amount_desc ?? null,
      input.remark ?? null,
    );
  return db
    .prepare('SELECT * FROM blogger_trades WHERE id = ?')
    .get(Number(r.lastInsertRowid)) as BloggerTrade;
}

/**
 * 同步且慢「长赢指数投资计划」调仓记录（实验性）。
 * 接口路径由且慢前端 bundle 逆向确认：
 *   GET https://qieman.com/pmdj/v2/long-win/plan/adjustments?desc=true&prodCode={source_key}
 * 需要登录 token（浏览器 F12 提取 Authorization Bearer），匿名访问返回空 body。
 * 响应结构未在无凭据环境下验证，故做防御式解析并在失败时返回可读错误。
 */
export async function syncQiemanPortfolio(p: TrackedPortfolio): Promise<{
  inserted: number;
  skipped: number;
}> {
  if (!p.source_key) throw new Error('该组合缺少 source_key（prodCode）');
  if (!p.qieman_token) throw new Error('未配置且慢登录 token，无法自动拉取');

  const url = `https://qieman.com/pmdj/v2/long-win/plan/adjustments?desc=true&prodCode=${encodeURIComponent(p.source_key)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      Referer: 'https://qieman.com/',
      Accept: 'application/json',
      Authorization: `Bearer ${p.qieman_token}`,
    },
    cache: 'no-store',
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error('且慢接口鉴权失败（HTTP ' + res.status + '），请更新 token');
  }
  const text = await res.text();
  if (!text) {
    throw new Error(
      '且慢接口返回空响应：token 无效或接口要求登录态。请在浏览器登录且慢后从 F12 提取 Authorization 中的 Bearer token',
    );
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('且慢接口返回非 JSON：' + text.slice(0, 120));
  }

  const adjustments = extractArray(data, [
    'items',
    'adjustments',
    'data',
    'list',
  ]);
  if (!Array.isArray(adjustments) || adjustments.length === 0) {
    throw new Error(
      '未能从且慢响应中解析调仓列表，结构可能已变更。响应片段：' +
        JSON.stringify(data).slice(0, 160),
    );
  }

  const db = getDb();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO blogger_trades
       (portfolio_id, fund_code, fund_name, trade_type, trade_date, weight, source, external_id)
     VALUES (?, ?, ?, ?, ?, ?, 'qieman', ?)`,
  );
  let inserted = 0;
  let skipped = 0;

  for (const adj of adjustments) {
    const record = adj as Record<string, unknown>;
    const adjId = str(record.adjustmentId ?? record.id ?? record.adjustId);
    const date = str(record.adjustDate ?? record.date ?? record.tradeDate);
    const items = extractArray(record, [
      'items',
      'adjustmentItems',
      'targets',
      'changes',
      'details',
    ]) as unknown[];
    if (!adjId || !date || !Array.isArray(items)) continue;

    for (const raw of items) {
      const item = raw as Record<string, unknown>;
      const fundCode = str(
        item.fundCode ?? item.fund_code ?? item.code ?? item.fundId,
      );
      const fundName =
        str(item.fundName ?? item.fund_name ?? item.name) || fundCode;
      if (!fundCode) continue;

      const prev = num(item.previousPercent ?? item.previousWeight ?? item.prevWeight);
      const target = num(
        item.targetPercent ?? item.targetWeight ?? item.percent ?? item.weight,
      );
      let tradeType: 'buy' | 'sell' | null = null;
      if (item.tradeType && str(item.tradeType)) {
        const t = str(item.tradeType)!.toLowerCase();
        if (t.includes('buy') || t.includes('purchase')) tradeType = 'buy';
        else if (t.includes('sell') || t.includes('redeem')) tradeType = 'sell';
      }
      if (!tradeType && (prev !== null || target !== null)) {
        if (target === null || target <= 0) tradeType = 'sell';
        else if (prev === null || target > prev) tradeType = 'buy';
        else if (target < prev) tradeType = 'sell';
      }
      if (!tradeType) continue;

      const externalId = `${adjId}:${fundCode}:${tradeType}`;
      const r = insert.run(
        p.id,
        fundCode,
        fundName,
        tradeType,
        date,
        target,
        externalId,
      );
      if (r.changes > 0) inserted++;
      else skipped++;
    }
  }

  db.prepare(
    `UPDATE tracked_portfolios SET last_synced_at = datetime('now', 'localtime') WHERE id = ?`,
  ).run(p.id);
  return { inserted, skipped };
}

function extractArray(
  data: unknown,
  keys: string[],
): unknown[] | null {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    for (const k of keys) {
      if (Array.isArray(record[k])) return record[k] as unknown[];
    }
  }
  return null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' || typeof v === 'number' ? String(v) : null;
}

function num(v: unknown): number | null {
  return typeof v === 'number' ? v : null;
}
