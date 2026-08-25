"use client";

import { useState } from "react";
import { addDoc, collection, deleteDoc, doc } from "firebase/firestore";
import {
  auth,
  db,
  Account,
  AccountType,
  DailyExpense,
  DebtPlan,
  ScheduledPayment,
} from "@/lib/firebaseClient";
import { formatCOP } from "@/lib/format";
import { currentBalance } from "@/lib/debtProgress";

const TYPES: { value: AccountType; label: string }[] = [
  { value: "tarjeta_credito", label: "Tarjeta de crédito" },
  { value: "ahorros", label: "Cuenta de ahorros" },
  { value: "credito", label: "Crédito" },
  { value: "billetera", label: "Billetera digital (Nequi, Daviplata…)" },
];

export default function CuentasTab({
  items,
  debtPlans,
  scheduledPayments,
  dailyExpenses,
  onChange,
}: {
  items: Account[];
  debtPlans: DebtPlan[];
  scheduledPayments: ScheduledPayment[];
  dailyExpenses: DailyExpense[];
  onChange: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("billetera");
  const [creditLimit, setCreditLimit] = useState("");
  const [balance, setBalance] = useState("");
  const [cutoffDay, setCutoffDay] = useState("");
  const [paymentDay, setPaymentDay] = useState("");
  const [rate, setRate] = useState("");
  const [saving, setSaving] = useState(false);

  const isCardOrCredit = type === "tarjeta_credito" || type === "credito";

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name) return;
    setSaving(true);
    const uid = auth.currentUser!.uid;
    await addDoc(collection(db, "users", uid, "accounts"), {
      name,
      type,
      credit_limit: creditLimit ? Number(creditLimit) : null,
      balance: balance ? Number(balance) : 0,
      cutoff_day: isCardOrCredit && cutoffDay ? Number(cutoffDay) : null,
      payment_day: isCardOrCredit && paymentDay ? Number(paymentDay) : null,
      interest_rate: isCardOrCredit && rate ? Number(rate) : null,
      created_at: new Date().toISOString(),
    });
    setName("");
    setCreditLimit("");
    setBalance("");
    setCutoffDay("");
    setPaymentDay("");
    setRate("");
    setSaving(false);
    onChange();
  }

  async function remove(id: string) {
    const uid = auth.currentUser!.uid;
    await deleteDoc(doc(db, "users", uid, "accounts", id));
    onChange();
  }

  return (
    <div className="py-4 space-y-6">
      <div>
        <h2 className="font-display text-xl mb-1">Tus cuentas y productos</h2>
        <p className="text-sm text-stone">
          Tarjetas, créditos, ahorros y billeteras. Aquí queda la trazabilidad
          de con qué pagas cada cosa.
        </p>
      </div>

      <form
        onSubmit={add}
        className="ledger-card rounded-sm p-4 grid grid-cols-2 gap-3"
      >
        <input
          placeholder="Nombre (Nequi, Visa Bancolombia…)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="col-span-2 border border-line bg-transparent px-3 py-2 rounded-sm text-sm"
          required
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as AccountType)}
          className="col-span-2 border border-line bg-transparent px-3 py-2 rounded-sm text-sm"
        >
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <input
          type="number"
          step="0.01"
          placeholder="Saldo o cupo disponible (opcional)"
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          className="col-span-2 border border-line bg-transparent px-3 py-2 rounded-sm text-sm"
        />
        {isCardOrCredit && (
          <>
            <input
              type="number"
              step="0.01"
              placeholder="Cupo total (opcional)"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              className="col-span-2 border border-line bg-transparent px-3 py-2 rounded-sm text-sm"
            />
            <input
              type="number"
              min={1}
              max={31}
              placeholder="Día de corte"
              value={cutoffDay}
              onChange={(e) => setCutoffDay(e.target.value)}
              className="border border-line bg-transparent px-3 py-2 rounded-sm text-sm"
            />
            <input
              type="number"
              min={1}
              max={31}
              placeholder="Día de pago"
              value={paymentDay}
              onChange={(e) => setPaymentDay(e.target.value)}
              className="border border-line bg-transparent px-3 py-2 rounded-sm text-sm"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Tasa de interés % (opcional)"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="col-span-2 border border-line bg-transparent px-3 py-2 rounded-sm text-sm"
            />
          </>
        )}
        <button
          type="submit"
          disabled={saving}
          className="col-span-2 bg-ink text-paper py-2 rounded-sm text-sm disabled:opacity-60"
        >
          Agregar cuenta
        </button>
      </form>

      <ul className="space-y-2">
        {items.length === 0 && (
          <li className="text-sm text-stone">
            Aún no tienes cuentas registradas. Agrega tus tarjetas, billeteras
            o cuentas de ahorro.
          </li>
        )}
        {items.map((item) => {
          const linkedPlan = debtPlans.find((p) => p.account_id === item.id);
          const cupoDisponible = linkedPlan
            ? (item.credit_limit ?? 0) -
              currentBalance(linkedPlan, scheduledPayments, dailyExpenses)
            : null;

          return (
            <li key={item.id} className="ledger-card rounded-sm px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-stone">
                    {TYPES.find((t) => t.value === item.type)?.label}
                    {item.cutoff_day
                      ? ` · corte día ${item.cutoff_day}`
                      : ""}
                    {item.payment_day ? ` · pago día ${item.payment_day}` : ""}
                    {item.interest_rate ? ` · ${item.interest_rate}% interés` : ""}
                    {linkedPlan ? ` · cupo automático (${linkedPlan.name})` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {cupoDisponible !== null ? (
                    <span className="amount text-sm">{formatCOP(cupoDisponible)}</span>
                  ) : (
                    item.balance !== null && (
                      <span className="amount text-sm">{formatCOP(item.balance)}</span>
                    )
                  )}
                  <button
                    onClick={() => remove(item.id)}
                    className="text-xs text-stone hover:text-coral"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
