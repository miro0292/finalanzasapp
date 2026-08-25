import { DailyExpense, DebtPlan, ScheduledPayment } from "@/lib/firebaseClient";

export function totalPagadoDebtPlan(scheduledPayments: ScheduledPayment[], name: string) {
  return scheduledPayments
    .filter((sp) => sp.status === "pagado" && sp.debt_name === name)
    .reduce((a, r) => a + Number(r.amount), 0);
}

// Compras hechas con la tarjeta/cuenta vinculada desde que se agregó el
// crédito a seguimiento (lo gastado antes de esa fecha ya está incluido en
// el saldo original que el usuario ingresó).
export function totalGastadoDebtPlan(dailyExpenses: DailyExpense[], plan: DebtPlan) {
  if (!plan.account_id) return 0;
  const desde = plan.created_at.slice(0, 10);
  return dailyExpenses
    .filter((e) => e.account_id === plan.account_id && e.spent_on >= desde)
    .reduce((a, r) => a + Number(r.amount), 0);
}

export function currentBalance(
  plan: DebtPlan,
  scheduledPayments: ScheduledPayment[],
  dailyExpenses: DailyExpense[] = []
) {
  const pagado = Math.min(
    totalPagadoDebtPlan(scheduledPayments, plan.name),
    plan.original_balance
  );
  const gastado = totalGastadoDebtPlan(dailyExpenses, plan);
  return plan.original_balance - pagado + gastado;
}
