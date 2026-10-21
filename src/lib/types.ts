export type Fund = {
  id: number;
  code: string;
  name: string;
  type: string;
  company: string | null;
  risk_level: string | null;
  remark: string | null;
  created_at: string;
};

export type TradeType = 'buy' | 'sell' | 'dividend';

export type Transaction = {
  id: number;
  fund_id: number;
  trade_type: TradeType;
  trade_date: string;
  amount: number;
  shares: number;
  fee: number;
  remark: string | null;
  created_at: string;
};

/** 持仓聚合结果（不落库，由交易流水实时计算） */
export type Holding = {
  fund_id: number;
  code: string;
  name: string;
  type: string;
  company: string | null;
  risk_level: string | null;
  shares: number;
  buy_shares: number;
  sell_shares: number;
  buy_cost: number;
  sell_income: number;
  dividend_income: number;
  net_invested: number;
  avg_cost: number;
  last_trade_date: string | null;
  transaction_count: number;
};
