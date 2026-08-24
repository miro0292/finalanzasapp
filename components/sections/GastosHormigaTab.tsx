"use client";

import { useState } from "react";
import { supabase, Account, DailyExpense } from "@/lib/supabaseClient";
import { formatCOP, todayISO } from "@/lib/format";
import AccountSelect, { accountLabel } from "@/components/AccountSelect";

export default function GastosHormigaTab({
  items,
  accounts,
  onChange,
}: {
  items: DailyExpense[];
  accounts: Account[];
  onChange: () => void;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("hormiga");
  const [date, setDate] = useState(todayISO());
  const [accountId, setAccountId] = useState("");
  const [saving, setSaving] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !amount) return;
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from("daily_expenses").insert({
      name,
      amount: Number(amount),
      category,
      spent_on: date,
      account_id: accountId || null,
      user_id: userData.user?.id,
    });
    setName("");
    setAmount("");
    setSaving(false);
    onChange();
  }

  async function remove(id: string) {
    await supabase.from("daily_expenses").delete().eq("id", id);
    onChange();
  }

  return (
    <div className="py-4 space-y-6">
      <div>
        <h2 className="font-display text-xl mb-1">Gastos diarios (hormiga)</h2>
        <p className="text-sm text-stone">
          Cafés, domicilios, antojos — todo lo pequeño que suma.
        </p>
      </div>

      <form
        onSubmit={add}
        className="ledger-card rounded-sm p-4 grid grid-cols-2 gap-3"
      >
        <input
          placeholder="¿En qué gastaste?"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="col-span-2 border border-line bg-transparent px-3 py-2 rounded-sm text-sm"
          required
        />
        <input
          type="number"
          step="0.01"
          placeholder="Valor"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="border border-line bg-transparent px-3 py-2 rounded-sm text-sm"
          required
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border border-line bg-transparent px-3 py-2 rounded-sm text-sm"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="border border-line bg-transparent px-3 py-2 rounded-sm text-sm"
        >
          <option value="hormiga">Hormiga (varios)</option>
          <option value="comida">Comida / domicilios</option>
          <option value="transporte">Transporte</option>
          <option value="ocio">Ocio</option>
          <option value="otro">Otro</option>
        </select>
        <div>
          <label className="block text-xs text-stone mb-1 col-span-2">
            ¿Con qué pagaste?
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
          Registrar gasto
        </button>
      </form>

      <ul className="space-y-2">
        {items.length === 0 && (
          <li className="text-sm text-stone">Aún no has registrado gastos diarios.</li>
        )}
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between ledger-card rounded-sm px-4 py-3"
          >
            <div>
              <p className="text-sm">{item.name}</p>
              <p className="text-xs text-stone">
                {item.spent_on} · {item.category} ·{" "}
                {accountLabel(accounts, item.account_id)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="amount text-sm text-coral">
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
