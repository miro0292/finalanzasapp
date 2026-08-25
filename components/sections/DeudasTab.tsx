"use client";

import { useState } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { auth, db, Account, Debt } from "@/lib/firebaseClient";
import { formatCOP } from "@/lib/format";
import AccountSelect, { accountLabel } from "@/components/AccountSelect";

const NOMBRES_COMUNES = [
  "Arriendo",
  "Administración",
  "Internet",
  "Celular",
  "Luz",
  "Agua",
  "Gas",
  "Acueducto",
  "Netflix",
  "Spotify",
  "Gimnasio",
  "Seguro",
  "Crédito",
  "Tarjeta de crédito",
  "TV / Cable",
];

export default function DeudasTab({
  items,
  accounts,
  onChange,
}: {
  items: Debt[];
  accounts: Account[];
  onChange: () => void;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState("1");
  const [maxPayDay, setMaxPayDay] = useState("");
  const [category, setCategory] = useState("servicios");
  const [accountId, setAccountId] = useState("");
  const [saving, setSaving] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !amount) return;
    setSaving(true);
    const uid = auth.currentUser!.uid;
    await addDoc(collection(db, "users", uid, "debts"), {
      name,
      amount: Number(amount),
      due_day: Number(dueDay),
      max_pay_day: maxPayDay ? Number(maxPayDay) : null,
      account_id: accountId || null,
      category,
      active: true,
      created_at: new Date().toISOString(),
    });
    setName("");
    setAmount("");
    setDueDay("1");
    setMaxPayDay("");
    setSaving(false);
    onChange();
  }

  async function remove(id: string) {
    const uid = auth.currentUser!.uid;
    await deleteDoc(doc(db, "users", uid, "debts", id));
    onChange();
  }

  async function toggleActive(item: Debt) {
    const uid = auth.currentUser!.uid;
    await updateDoc(doc(db, "users", uid, "debts", item.id), { active: !item.active });
    onChange();
  }

  const today = new Date().getDate();

  return (
    <div className="py-4 space-y-6">
      <div>
        <h2 className="font-display text-xl mb-1">Deudas y cuentas fijas</h2>
        <p className="text-sm text-stone">
          Acueducto, luz, internet, arriendo, tarjetas… lo que pagas cada mes.
        </p>
      </div>

      <form
        onSubmit={add}
        className="ledger-card rounded-sm p-4 grid grid-cols-2 gap-3"
      >
        <input
          placeholder="Nombre (Acueducto, Internet…)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          list="nombres-comunes"
          className="col-span-2 border border-line bg-transparent px-3 py-2 rounded-sm text-sm"
          required
        />
        <datalist id="nombres-comunes">
          {NOMBRES_COMUNES.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <input
          type="number"
          step="0.01"
          placeholder="Valor aproximado"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="border border-line bg-transparent px-3 py-2 rounded-sm text-sm"
          required
        />
        <input
          placeholder="Categoría"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="border border-line bg-transparent px-3 py-2 rounded-sm text-sm"
        />
        <div>
          <label className="block text-xs text-stone mb-1">
            Día de vencimiento
          </label>
          <input
            type="number"
            min={1}
            max={31}
            value={dueDay}
            onChange={(e) => setDueDay(e.target.value)}
            className="w-full border border-line bg-transparent px-3 py-2 rounded-sm text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-xs text-stone mb-1">
            Día máximo de pago (opcional)
          </label>
          <input
            type="number"
            min={1}
            max={31}
            placeholder="Antes de recargo"
            value={maxPayDay}
            onChange={(e) => setMaxPayDay(e.target.value)}
            className="w-full border border-line bg-transparent px-3 py-2 rounded-sm text-sm"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-stone mb-1">
            ¿Con qué la pagas normalmente?
          </label>
          <AccountSelect
            accounts={accounts}
            value={accountId}
            onChange={setAccountId}
            className="w-full border border-line bg-transparent px-3 py-2 rounded-sm text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="col-span-2 bg-ink text-paper py-2 rounded-sm text-sm disabled:opacity-60"
        >
          Agregar deuda fija
        </button>
      </form>

      <ul className="space-y-2">
        {items.length === 0 && (
          <li className="text-sm text-stone">Aún no tienes deudas fijas registradas.</li>
        )}
        {items.map((item) => {
          const vencida = item.active && item.due_day < today;
          const urgente =
            item.active && item.due_day >= today && item.due_day - today <= 3;
          return (
            <li
              key={item.id}
              className="flex items-center justify-between ledger-card rounded-sm px-4 py-3"
            >
              <div>
                <p className={`text-sm ${!item.active ? "line-through text-stone" : ""}`}>
                  {item.name}
                </p>
                <p className="text-xs text-stone">
                  Vence día {item.due_day}
                  {item.max_pay_day ? ` · máximo día ${item.max_pay_day}` : ""}
                  {" · "}
                  {accountLabel(accounts, item.account_id)}
                </p>
                {vencida && (
                  <p className="text-xs text-coral mt-0.5">Ya venció este mes</p>
                )}
                {urgente && !vencida && (
                  <p className="text-xs text-gold mt-0.5">Vence pronto</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="amount text-sm">{formatCOP(item.amount)}</span>
                <button
                  onClick={() => toggleActive(item)}
                  className="text-xs text-stone hover:text-sage"
                >
                  {item.active ? "Pausar" : "Activar"}
                </button>
                <button
                  onClick={() => remove(item.id)}
                  className="text-xs text-stone hover:text-coral"
                >
                  Eliminar
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
