import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

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
  interest_rate: number | null;
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
  source: "manual" | "excel" | "ia" | "fija";
};

export type DebtPlan = {
  id: string;
  name: string;
  original_balance: number;
  monthly_payment: number;
  interest_rate: number | null;
  order: number;
  account_id: string | null;
  created_at: string;
};

export type Suggestion = {
  tipo: "reprogramar_deuda" | "crear_meta_ahorro" | "mover_pago_programado";
  titulo: string;
  detalle: string;
  datos: Record<string, any>;
  status: "pending" | "confirmed" | "dismissed";
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  suggestions: Suggestion[];
  created_at: string;
};
