import { addDoc, collection } from "firebase/firestore";
import { db, Debt, DebtPlan } from "@/lib/firebaseClient";

// Copia una sola vez cada crédito (de la pestaña oculta Créditos) a Deudas
// fijas, para que el usuario no tenga que volver a escribirlos. Es
// idempotente: si ya existe una deuda fija con ese nombre, no la duplica.
export async function ensureCreditosMigradosADeudas(
  uid: string,
  debts: Debt[],
  debtPlans: DebtPlan[]
): Promise<boolean> {
  const yaExisten = new Set(debts.map((d) => d.name));
  const faltantes = debtPlans.filter((p) => !yaExisten.has(p.name));
  if (faltantes.length === 0) return false;

  const col = collection(db, "users", uid, "debts");
  await Promise.all(
    faltantes.map((p) =>
      addDoc(col, {
        name: p.name,
        amount: p.monthly_payment,
        due_day: p.due_day ?? 1,
        max_pay_day: p.max_pay_day,
        account_id: p.account_id,
        category: "crédito",
        active: true,
        original_balance: p.original_balance,
        interest_rate: p.interest_rate,
        created_at: new Date().toISOString(),
      })
    )
  );
  return true;
}
