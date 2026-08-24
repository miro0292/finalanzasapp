"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Account,
  DailyExpense,
  Debt,
  IncomeRow,
  SavingsRow,
  ScheduledPayment,
} from "@/lib/supabaseClient";
import { formatCOP, currentMonthLabel } from "@/lib/format";
import { accountLabel } from "@/components/AccountSelect";

export default function ResumenTab({
  accounts,
  debts,
  dailyExpenses,
  income,
  savings,
  scheduledPayments,
}: {
  accounts: Account[];
  debts: Debt[];
  dailyExpenses: DailyExpense[];
  income: IncomeRow[];
  savings: SavingsRow[];
  scheduledPayments: ScheduledPayment[];
}) {
  const totalFixed = debts
    .filter((f) => f.active)
    .reduce((a, r) => a + Number(r.amount), 0);
  const totalDaily = dailyExpenses.reduce((a, r) => a + Number(r.amount), 0);
  const totalIncome = income.reduce((a, r) => a + Number(r.amount), 0);
  const totalSavings = savings.reduce((a, r) => a + Number(r.amount), 0);
  const balance = totalIncome - totalFixed - totalDaily - totalSavings;

  const today = new Date().getDate();
  const proximosPagos = debts
    .filter((f) => f.active && f.due_day >= today)
    .sort((a, b) => a.due_day - b.due_day)
    .slice(0, 4);

  const pendientesExcel = scheduledPayments
    .filter((p) => p.status === "pendiente")
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 4);

  const chartData = [
    { name: "Ingresos", valor: totalIncome },
    { name: "Fijos", valor: totalFixed },
    { name: "Hormiga", valor: totalDaily },
    { name: "Ahorro", valor: totalSavings },
  ];

  return (
    <div className="py-4 space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-stone">
          {currentMonthLabel()}
        </p>
        <h2 className="font-display text-2xl">Resumen del mes</h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card label="Ingresos" value={totalIncome} color="text-sage" />
        <Card label="Deudas fijas" value={totalFixed} color="text-ink" />
        <Card label="Gastos hormiga" value={totalDaily} color="text-coral" />
        <Card label="Ahorrado" value={totalSavings} color="text-gold" />
      </div>

      <div className="ledger-card rounded-sm p-4">
        <p className="text-sm text-stone mb-1">Balance disponible</p>
        <p
          className={`amount text-3xl ${
            balance >= 0 ? "text-sage" : "text-coral"
          }`}
        >
          {formatCOP(balance)}
        </p>
        <p className="text-xs text-stone mt-1">
          Ingresos menos deudas fijas, hormiga y ahorro del mes.
        </p>
      </div>

      <div className="ledger-card rounded-sm p-4">
        <p className="text-sm text-stone mb-3">Distribución del mes</p>
        <div style={{ width: "100%", height: 200 }}>
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#DEDACD" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#8A8578" }} />
              <YAxis tick={{ fontSize: 11, fill: "#8A8578" }} width={40} />
              <Tooltip formatter={(v: number) => formatCOP(v)} />
              <Bar dataKey="valor" fill="#1B2A4A" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <p className="text-sm text-stone mb-2">Próximos pagos fijos</p>
        {proximosPagos.length === 0 ? (
          <p className="text-sm text-stone">
            No tienes pagos fijos pendientes este mes.
          </p>
        ) : (
          <ul className="space-y-2">
            {proximosPagos.map((p) => (
              <li
                key={p.id}
                className="flex justify-between ledger-card rounded-sm px-4 py-3"
              >
                <span className="text-sm">
                  {p.name} · día {p.due_day} · {accountLabel(accounts, p.account_id)}
                </span>
                <span className="amount text-sm">{formatCOP(p.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {pendientesExcel.length > 0 && (
        <div>
          <p className="text-sm text-stone mb-2">Próximos pagos programados</p>
          <ul className="space-y-2">
            {pendientesExcel.map((p) => (
              <li
                key={p.id}
                className="flex justify-between ledger-card rounded-sm px-4 py-3"
              >
                <span className="text-sm">
                  {p.debt_name} · {p.due_date}
                </span>
                <span className="amount text-sm">{formatCOP(p.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Card({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="ledger-card rounded-sm p-4">
      <p className="text-xs text-stone mb-1">{label}</p>
      <p className={`amount text-lg ${color}`}>{formatCOP(value)}</p>
    </div>
  );
}
