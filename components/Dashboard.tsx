"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  supabase,
  Account,
  Debt,
  DailyExpense,
  IncomeRow,
  SavingsRow,
  ScheduledPayment,
} from "@/lib/supabaseClient";
import ResumenTab from "./sections/ResumenTab";
import CuentasTab from "./sections/CuentasTab";
import DeudasTab from "./sections/DeudasTab";
import GastosHormigaTab from "./sections/GastosHormigaTab";
import IngresosTab from "./sections/IngresosTab";
import AhorrosTab from "./sections/AhorrosTab";
import ProgramadosTab from "./sections/ProgramadosTab";
import ChatTab from "./sections/ChatTab";
import PaymentReminders from "./PaymentReminders";

const TABS = [
  { id: "resumen", label: "Resumen" },
  { id: "cuentas", label: "Cuentas" },
  { id: "deudas", label: "Deudas fijas" },
  { id: "hormiga", label: "Gastos hormiga" },
  { id: "ingresos", label: "Ingresos" },
  { id: "ahorros", label: "Ahorros" },
  { id: "programados", label: "Programados" },
  { id: "chat", label: "Chat IA" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function Dashboard({ session }: { session: Session }) {
  const [tab, setTab] = useState<TabId>("resumen");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [dailyExpenses, setDailyExpenses] = useState<DailyExpense[]>([]);
  const [income, setIncome] = useState<IncomeRow[]>([]);
  const [savings, setSavings] = useState<SavingsRow[]>([]);
  const [scheduledPayments, setScheduledPayments] = useState<ScheduledPayment[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [acc, deb, d, i, s, sp] = await Promise.all([
      supabase.from("accounts").select("*").order("created_at", { ascending: true }),
      supabase.from("debts").select("*").order("due_day", { ascending: true }),
      supabase
        .from("daily_expenses")
        .select("*")
        .order("spent_on", { ascending: false })
        .limit(200),
      supabase
        .from("income")
        .select("*")
        .order("received_on", { ascending: false })
        .limit(200),
      supabase
        .from("savings")
        .select("*")
        .order("moved_on", { ascending: false })
        .limit(200),
      supabase
        .from("scheduled_payments")
        .select("*")
        .order("due_date", { ascending: true })
        .limit(300),
    ]);
    setAccounts((acc.data as Account[]) || []);
    setDebts((deb.data as Debt[]) || []);
    setDailyExpenses((d.data as DailyExpense[]) || []);
    setIncome((i.data as IncomeRow[]) || []);
    setSavings((s.data as SavingsRow[]) || []);
    setScheduledPayments((sp.data as ScheduledPayment[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  return (
    <div className="min-h-screen pb-24">
      <PaymentReminders fixedExpenses={debts} />
      <header className="flex items-center justify-between px-5 pt-6 pb-4 max-w-3xl mx-auto">
        <div>
          <h1 className="font-display text-2xl text-ink">Cuaderno</h1>
          <p className="text-xs text-stone">{session.user.email}</p>
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          className="text-xs text-stone hover:text-coral underline underline-offset-4"
        >
          Salir
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-5">
        {loading ? (
          <p className="text-stone text-sm py-10">Cargando tus datos…</p>
        ) : (
          <>
            {tab === "resumen" && (
              <ResumenTab
                accounts={accounts}
                debts={debts}
                dailyExpenses={dailyExpenses}
                income={income}
                savings={savings}
                scheduledPayments={scheduledPayments}
              />
            )}
            {tab === "cuentas" && (
              <CuentasTab items={accounts} onChange={loadAll} />
            )}
            {tab === "deudas" && (
              <DeudasTab items={debts} accounts={accounts} onChange={loadAll} />
            )}
            {tab === "hormiga" && (
              <GastosHormigaTab
                items={dailyExpenses}
                accounts={accounts}
                onChange={loadAll}
              />
            )}
            {tab === "ingresos" && (
              <IngresosTab items={income} accounts={accounts} onChange={loadAll} />
            )}
            {tab === "ahorros" && (
              <AhorrosTab items={savings} accounts={accounts} onChange={loadAll} />
            )}
            {tab === "programados" && (
              <ProgramadosTab
                items={scheduledPayments}
                accounts={accounts}
                onChange={loadAll}
              />
            )}
            {tab === "chat" && (
              <ChatTab
                accounts={accounts}
                debts={debts}
                dailyExpenses={dailyExpenses}
                income={income}
                savings={savings}
                scheduledPayments={scheduledPayments}
                onChange={loadAll}
              />
            )}
          </>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-paper border-t border-line">
        <div className="max-w-3xl mx-auto flex overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 min-w-[92px] py-3 text-xs whitespace-nowrap ${
                tab === t.id
                  ? "text-ink border-t-2 border-gold font-medium"
                  : "text-stone border-t-2 border-transparent"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
