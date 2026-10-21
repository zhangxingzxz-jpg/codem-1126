import { z } from 'zod';

export const FUND_TYPES = ['股票', '混合', '债券', '货币', '指数', 'QDII'] as const;

export const fundSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, '基金代码须为 6 位数字'),
  name: z.string().trim().min(1, '基金名称不能为空').max(100),
  type: z.enum(FUND_TYPES).default('混合'),
  company: z.string().trim().max(100).optional().nullable(),
  risk_level: z.string().trim().max(20).optional().nullable(),
  remark: z.string().trim().max(500).optional().nullable(),
});

export type FundInput = z.infer<typeof fundSchema>;

export const transactionSchema = z.object({
  fund_id: z.number({ invalid_type_error: 'fund_id 须为整数' }).int().positive(),
  trade_type: z.enum(['buy', 'sell', 'dividend']),
  trade_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '交易日期须为 YYYY-MM-DD'),
  amount: z.number().nonnegative('金额不能为负'),
  shares: z.number().nonnegative('份额不能为负').default(0),
  fee: z.number().nonnegative('费率不能为负').default(0),
  remark: z.string().trim().max(500).optional().nullable(),
});

export type TransactionInput = z.infer<typeof transactionSchema>;
