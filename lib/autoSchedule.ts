import { addDoc, collection } from "firebase/firestore";
import { db, Debt, DebtPlan, ScheduledPayment } from "@/lib/firebaseClient";

function lastDayOfMonth(year: number, monthIndex0: number) {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

// Crea el pago programado de este mes para cada deuda fija y cada crédito
// (con día de vencimiento definido) que todavía no lo tenga. Es idempotente:
// revisa lo que ya existe (de cualquier origen) antes de crear, así que se
// puede llamar en cada carga del Dashboard sin duplicar.
export async function ensureMonthlyScheduledPayments(
  uid: string,
  debts: Debt[],
  debtPlans: DebtPlan[],
  scheduledPayments: ScheduledPayment[]
): Promise<boolean> {
  const now = new Date();
  const year = now.getFullYear();
  const monthIndex0 = now.getMonth();
  const monthKey = `${year}-${String(monthIndex0 + 1).padStart(2, "0")}`;

  const yaExisten = new Set(
    scheduledPayments
      .filter((sp) => sp.due_date.startsWith(monthKey))
      .map((sp) => sp.debt_name)
  );

  const dueDateFor = (day: number) => {
    const clamped = Math.min(day, lastDayOfMonth(year, monthIndex0));
    return `${monthKey}-${String(clamped).padStart(2, "0")}`;
  };

  const faltantesFijas = debts.filter((d) => d.active && !yaExisten.has(d.name));
  const faltantesCreditos = debtPlans.filter(
    (p) => p.due_day && !yaExisten.has(p.name)
  );

  if (faltantesFijas.length === 0 && faltantesCreditos.length === 0) return false;

  const col = collection(db, "users", uid, "scheduledPayments");
  await Promise.all([
    ...faltantesFijas.map((d) =>
      addDoc(col, {
        debt_name: d.name,
        amount: d.amount,
        due_date: dueDateFor(d.due_day),
        account_id: d.account_id,
        status: "pendiente",
        notes: null,
        source: "fija",
        created_at: new Date().toISOString(),
      })
    ),
    ...faltantesCreditos.map((p) =>
      addDoc(col, {
        debt_name: p.name,
        amount: p.monthly_payment,
        due_date: dueDateFor(p.due_day as number),
        account_id: p.account_id,
        status: "pendiente",
        notes: null,
        source: "credito",
        created_at: new Date().toISOString(),
      })
    ),
  ]);
  return true;
}
