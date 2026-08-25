import { DebtPlan, ScheduledPayment } from "@/lib/firebaseClient";

export function totalPagadoDebtPlan(scheduledPayments: ScheduledPayment[], name: string) {
  return scheduledPayments
    .filter((sp) => sp.status === "pagado" && sp.debt_name === name)
    .reduce((a, r) => a + Number(r.amount), 0);
}

export function currentBalance(plan: DebtPlan, scheduledPayments: ScheduledPayment[]) {
  const pagado = Math.min(
    totalPagadoDebtPlan(scheduledPayments, plan.name),
    plan.original_balance
  );
  return plan.original_balance - pagado;
}
