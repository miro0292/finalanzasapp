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
} from "@/lib/firebaseClient";
import { formatCOP, currentMonthLabel } from "@/lib/format";
import { accountLabel } from "@/components/AccountSelect";
import { useIsDarkMode } from "@/lib/theme";

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
  const isDark = useIsDarkMode();
  const totalFixed = debts
    .filter((f) => f.active)
    .reduce((a, r) => a + Number(r.amount), 0);
  const totalDaily = dailyExpenses.reduce((a, r) => a + Number(r.amount), 0);
  const totalIncome = income.reduce((a, r) => a + Number(r.amount), 0);
  const totalSavings = savings.reduce((a, r) => a + Number(r.amount), 0);
  const balance = totalIncome - totalFixed - totalDaily - totalSavings;

  const todayStr = new Date().toISOString().slice(0, 10);
  const monthKey = todayStr.slice(0, 7);
  const pagosDelMes = scheduledPayments
    .filter((p) => p.status === "pendiente" && p.due_date.startsWith(monthKey))
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  const SOURCE_LABEL: Record<string, string> = {
    fija: "Deuda fija",
    excel: "Excel",
    ia: "IA",
    manual: "Manual",
  };

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
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={isDark ? "#34322C" : "#DEDACD"}
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: isDark ? "#A9A395" : "#8A8578" }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: isDark ? "#A9A395" : "#8A8578" }}
                width={40}
              />
              <Tooltip formatter={(v: number) => formatCOP(v)} />
              <Bar
                dataKey="valor"
                fill={isDark ? "#F2EFE7" : "#1B2A4A"}
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <p className="text-sm text-stone mb-2">Calendario de pagos del mes</p>
        {pagosDelMes.length === 0 ? (
          <p className="text-sm text-stone">
            No tienes pagos pendientes este mes.
          </p>
        ) : (
          <div className="ledger-card rounded-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-stone text-left border-b border-line">
                  <th className="px-4 py-2 font-normal">Concepto</th>
                  <th className="px-4 py-2 font-normal">Fecha</th>
                  <th className="px-4 py-2 font-normal">Cuenta</th>
                  <th className="px-4 py-2 font-normal text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {pagosDelMes.map((p) => {
                  const diffDays =
                    (Date.parse(p.due_date) - Date.parse(todayStr)) / 86400000;
                  const vencido = diffDays < 0;
                  const urgente = !vencido && diffDays <= 3;
                  return (
                    <tr key={p.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-2">
                        {p.debt_name}
                        <span className="text-xs text-stone">
                          {" "}
                          · {SOURCE_LABEL[p.source] || p.source}
                        </span>
                      </td>
                      <td
                        className={`px-4 py-2 ${
                          vencido ? "text-coral" : urgente ? "text-gold" : ""
                        }`}
                      >
                        {p.due_date}
                      </td>
                      <td className="px-4 py-2 text-stone">
                        {accountLabel(accounts, p.account_id)}
                      </td>
                      <td className="px-4 py-2 text-right amount">
                        {formatCOP(p.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
