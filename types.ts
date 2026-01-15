
export type AssetType = 'Stock' | 'Property' | 'Business' | 'Cash';
export type LiabilityType = 'Loan' | 'Debt';
export type TransactionType = 'Income' | 'Expense';

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  value: number;
  change: string;
  emoji: string;
}

export interface Liability {
  id: string;
  name: string;
  type: LiabilityType;
  value: number;
  rate: string;
  emoji: string;
}

export interface Transaction {
  id: string;
  date: string;
  desc: string;
  amount: number;
  type: TransactionType;
  category: string;
}

export interface Message {
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

export interface FinancialMetrics {
  totalAssets: number;
  totalDebt: number;
  netWorth: number;
  debtRatio: number;
  cashflow: number;
}
