"use client";

import { useState } from "react";
import { addDoc, collection, deleteDoc, doc } from "firebase/firestore";
import { auth, db, Account, SavingsRow } from "@/lib/firebaseClient";
import { formatCOP, todayISO } from "@/lib/format";
import AccountSelect, { accountLabel } from "@/components/AccountSelect";

export default function AhorrosTab({
  items,
  accounts,
  onChange,
}: {
  items: SavingsRow[];
  accounts: Account[];
  onChange: () => void;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [goal, setGoal] = useState("");
  const [date, setDate] = useState(todayISO());
  const [accountId, setAccountId] = useState("");
  const [saving, setSaving] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !amount) return;
    setSaving(true);
    const uid = auth.currentUser!.uid;
    await addDoc(collection(db, "users", uid, "savings"), {
      name,
      amount: Number(amount),
      goal_amount: goal ? Number(goal) : null,
      moved_on: date,
      account_id: accountId || null,
      created_at: new Date().toISOString(),
    });
    setName("");
    setAmount("");
    setGoal("");
    setSaving(false);
    onChange();
  }

  async function remove(id: string) {
    const uid = auth.currentUser!.uid;
    await deleteDoc(doc(db, "users", uid, "savings", id));
    onChange();
  }

  const total = items.reduce((a, r) => a + Number(r.amount), 0);

  return (
    <div className="py-4 space-y-6">
      <div>
        <h2 className="font-display text-xl mb-1">Ahorros</h2>
        <p className="text-sm text-stone">
          Total acumulado:{" "}
          <span className="amount text-ink">{formatCOP(total)}</span>
        </p>
      </div>

      <form
        onSubmit={add}
        className="ledger-card rounded-sm p-4 grid grid-cols-2 gap-3"
      >
        <input
          placeholder="Meta o motivo (Viaje, emergencia…)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="col-span-2 border border-line bg-transparent px-3 py-2 rounded-sm text-sm"
          required
        />
        <input
          type="number"
          step="0.01"
          placeholder="Cuánto ahorraste"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="border border-line bg-transparent px-3 py-2 rounded-sm text-sm"
          required
        />
        <input
          type="number"
          step="0.01"
          placeholder="Meta total (opcional)"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          className="border border-line bg-transparent px-3 py-2 rounded-sm text-sm"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border border-line bg-transparent px-3 py-2 rounded-sm text-sm"
        />
        <AccountSelect
          accounts={accounts}
          value={accountId}
          onChange={setAccountId}
        />
        <button
          type="submit"
          disabled={saving}
          className="col-span-2 bg-ink text-paper py-2 rounded-sm text-sm disabled:opacity-60"
        >
          Registrar ahorro
        </button>
      </form>

      <ul className="space-y-2">
        {items.length === 0 && (
          <li className="text-sm text-stone">Aún no has registrado ahorros.</li>
        )}
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between ledger-card rounded-sm px-4 py-3"
          >
            <div>
              <p className="text-sm">{item.name}</p>
              <p className="text-xs text-stone">
                {item.moved_on} · {accountLabel(accounts, item.account_id)}
                {item.goal_amount
                  ? ` · meta ${formatCOP(item.goal_amount)}`
                  : ""}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="amount text-sm text-sage">
                {formatCOP(item.amount)}
              </span>
              <button
                onClick={() => remove(item.id)}
                className="text-xs text-stone hover:text-coral"
              >
                Eliminar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
