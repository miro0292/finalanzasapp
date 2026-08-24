import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type AccountType =
  | "tarjeta_credito"
  | "ahorros"
  | "credito"
  | "billetera";

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  credit_limit: number | null;
  balance: number | null;
  cutoff_day: number | null;
  payment_day: number | null;
};

export type Debt = {
  id: string;
  name: string;
  amount: number;
  due_day: number;
  max_pay_day: number | null;
  account_id: string | null;
  category: string;
  active: boolean;
};

export type DailyExpense = {
  id: string;
  name: string;
  amount: number;
  category: string;
  account_id: string | null;
  spent_on: string;
};

export type IncomeRow = {
  id: string;
  name: string;
  amount: number;
  kind: "fijo" | "eventual";
  expected_day: number | null;
  account_id: string | null;
  received_on: string;
};

export type SavingsRow = {
  id: string;
  name: string;
  amount: number;
  goal_amount: number | null;
  account_id: string | null;
  moved_on: string;
};

export type ScheduledPayment = {
  id: string;
  debt_name: string;
  due_date: string;
  amount: number;
  account_id: string | null;
  status: "pendiente" | "pagado";
  notes: string | null;
  source: "manual" | "excel" | "ia";
};

export type Suggestion = {
  tipo: "reprogramar_deuda" | "crear_meta_ahorro" | "mover_pago_programado";
  titulo: string;
  detalle: string;
  datos: Record<string, any>;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  suggestion: Suggestion | null;
  suggestion_status: "pending" | "confirmed" | "dismissed" | null;
  created_at: string;
};
