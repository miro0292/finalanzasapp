"use client";

import { useCallback, useEffect, useState } from "react";
import { signOut, type User } from "firebase/auth";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import {
  auth,
  db,
  Account,
  Debt,
  DailyExpense,
  IncomeRow,
  SavingsRow,
  ScheduledPayment,
} from "@/lib/firebaseClient";
import ResumenTab from "./sections/ResumenTab";
import CuentasTab from "./sections/CuentasTab";
import DeudasTab from "./sections/DeudasTab";
import GastosHormigaTab from "./sections/GastosHormigaTab";
import IngresosTab from "./sections/IngresosTab";
import AhorrosTab from "./sections/AhorrosTab";
import ProgramadosTab from "./sections/ProgramadosTab";
import ChatTab from "./sections/ChatTab";
import PaymentReminders from "./PaymentReminders";
import ThemeToggle from "./ThemeToggle";
import { useInactivityLogout } from "@/lib/useInactivityLogout";

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

function mapDocs<T>(snap: { docs: { id: string; data: () => any }[] }): T[] {
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
}

export default function Dashboard({ user }: { user: User }) {
  useInactivityLogout();
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
    const uid = user.uid;
    const col = (name: string) => collection(db, "users", uid, name);
    const [acc, deb, d, i, s, sp] = await Promise.all([
      getDocs(query(col("accounts"), orderBy("created_at", "asc"))),
      getDocs(query(col("debts"), orderBy("due_day", "asc"))),
      getDocs(query(col("dailyExpenses"), orderBy("spent_on", "desc"), limit(200))),
      getDocs(query(col("income"), orderBy("received_on", "desc"), limit(200))),
      getDocs(query(col("savings"), orderBy("moved_on", "desc"), limit(200))),
      getDocs(query(col("scheduledPayments"), orderBy("due_date", "asc"), limit(300))),
    ]);
    setAccounts(mapDocs<Account>(acc));
    setDebts(mapDocs<Debt>(deb));
    setDailyExpenses(mapDocs<DailyExpense>(d));
    setIncome(mapDocs<IncomeRow>(i));
    setSavings(mapDocs<SavingsRow>(s));
    setScheduledPayments(mapDocs<ScheduledPayment>(sp));
    setLoading(false);
  }, [user.uid]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  return (
    <div className="min-h-screen pb-24">
      <PaymentReminders fixedExpenses={debts} />
      <header className="flex items-center justify-between px-5 pt-6 pb-4 max-w-3xl mx-auto">
        <div>
          <h1 className="font-display text-2xl text-ink">Cuaderno</h1>
          <p className="text-xs text-stone">{user.email}</p>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            onClick={() => signOut(auth)}
            className="text-xs text-stone hover:text-coral underline underline-offset-4"
          >
            Salir
          </button>
        </div>
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
