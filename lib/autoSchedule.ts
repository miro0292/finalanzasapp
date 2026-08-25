import { addDoc, collection } from "firebase/firestore";
import { db, Debt, ScheduledPayment } from "@/lib/firebaseClient";

function lastDayOfMonth(year: number, monthIndex0: number) {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

// Crea el pago programado de este mes para cada deuda fija activa que
// todavía no lo tenga. Es idempotente: revisa lo que ya existe antes de
// crear, así que se puede llamar en cada carga del Dashboard sin duplicar.
export async function ensureMonthlyScheduledPayments(
  uid: string,
  debts: Debt[],
  scheduledPayments: ScheduledPayment[]
): Promise<boolean> {
  const now = new Date();
  const year = now.getFullYear();
  const monthIndex0 = now.getMonth();
  const monthKey = `${year}-${String(monthIndex0 + 1).padStart(2, "0")}`;

  const yaExisten = new Set(
    scheduledPayments
      .filter((sp) => sp.source === "fija" && sp.due_date.startsWith(monthKey))
      .map((sp) => sp.debt_name)
  );

  const faltantes = debts.filter((d) => d.active && !yaExisten.has(d.name));
  if (faltantes.length === 0) return false;

  const col = collection(db, "users", uid, "scheduledPayments");
  await Promise.all(
    faltantes.map((d) => {
      const day = Math.min(d.due_day, lastDayOfMonth(year, monthIndex0));
      const due_date = `${monthKey}-${String(day).padStart(2, "0")}`;
      return addDoc(col, {
        debt_name: d.name,
        amount: d.amount,
        due_date,
        account_id: d.account_id,
        status: "pendiente",
        notes: null,
        source: "fija",
        created_at: new Date().toISOString(),
      });
    })
  );
  return true;
}
