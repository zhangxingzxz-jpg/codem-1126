import { getDb } from './db';
import type { Holding } from './types';

type RawRow = {
  fund_id: number;
  code: string;
  name: string;
  type: string;
  company: string | null;
  risk_level: string | null;
  buy_shares: number;
  sell_shares: number;
  buy_cost: number;
  sell_income: number;
  dividend_income: number;
  last_trade_date: string | null;
  transaction_count: number;
};

/**
 * 持仓计算口径：
 * - 持仓份额 = Σ买入份额 - Σ卖出份额
 * - 累计净投入 = Σ(买入金额+买入费率) - Σ(卖出金额-卖出费率) - Σ(分红金额-分红费率)
 * - 持仓成本（元/份）= 净投入 / 持仓份额（份额 > 0 时）
 */
export function getHoldings(): Holding[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT
         f.id AS fund_id, f.code, f.name, f.type, f.company, f.risk_level,
         COALESCE(SUM(CASE WHEN t.trade_type = 'buy' THEN t.shares ELSE 0 END), 0) AS buy_shares,
         COALESCE(SUM(CASE WHEN t.trade_type = 'sell' THEN t.shares ELSE 0 END), 0) AS sell_shares,
         COALESCE(SUM(CASE WHEN t.trade_type = 'buy' THEN t.amount + t.fee ELSE 0 END), 0) AS buy_cost,
         COALESCE(SUM(CASE WHEN t.trade_type = 'sell' THEN t.amount - t.fee ELSE 0 END), 0) AS sell_income,
         COALESCE(SUM(CASE WHEN t.trade_type = 'dividend' THEN t.amount - t.fee ELSE 0 END), 0) AS dividend_income,
         MAX(t.trade_date) AS last_trade_date,
         COUNT(t.id) AS transaction_count
       FROM funds f
       LEFT JOIN transactions t ON t.fund_id = f.id
       GROUP BY f.id
       ORDER BY f.code`,
    )
    .all() as RawRow[];

  return rows.map((r) => {
    const shares = round4(r.buy_shares - r.sell_shares);
    const net_invested = round2(
      r.buy_cost - r.sell_income - r.dividend_income,
    );
    return {
      fund_id: r.fund_id,
      code: r.code,
      name: r.name,
      type: r.type,
      company: r.company,
      risk_level: r.risk_level,
      shares,
      buy_shares: r.buy_shares,
      sell_shares: r.sell_shares,
      buy_cost: r.buy_cost,
      sell_income: r.sell_income,
      dividend_income: r.dividend_income,
      net_invested,
      avg_cost: shares > 0 ? round4(net_invested / shares) : 0,
      last_trade_date: r.last_trade_date,
      transaction_count: r.transaction_count,
    };
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
