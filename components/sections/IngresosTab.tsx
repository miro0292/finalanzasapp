"use client";

import { useState } from "react";
import { supabase, Account, IncomeRow } from "@/lib/supabaseClient";
import { formatCOP, todayISO } from "@/lib/format";
import AccountSelect, { accountLabel } from "@/components/AccountSelect";

export default function IngresosTab({
  items,
  accounts,
  onChange,
}: {
  items: IncomeRow[];
  accounts: Account[];
  onChange: () => void;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<"fijo" | "eventual">("fijo");
  const [expectedDay, setExpectedDay] = useState("");
  const [date, setDate] = useState(todayISO());
  const [accountId, setAccountId] = useState("");
  const [saving, setSaving] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !amount) return;
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from("income").insert({
      name,
      amount: Number(amount),
      kind,
      expected_day: kind === "fijo" && expectedDay ? Number(expectedDay) : null,
      received_on: date,
      account_id: accountId || null,
      user_id: userData.user?.id,
    });
    setName("");
    setAmount("");
    setExpectedDay("");
    setSaving(false);
    onChange();
  }

  async function remove(id: string) {
    await supabase.from("income").delete().eq("id", id);
    onChange();
  }

  return (
    <div className="py-4 space-y-6">
      <div>
        <h2 className="font-display text-xl mb-1">Ingresos</h2>
        <p className="text-sm text-stone">
          Tu salario, freelance u otros ingresos. Marca el día esperado si es
          recurrente, así la IA puede cuadrar tus pagos contra tus entradas.
        </p>
      </div>

      <form
        onSubmit={add}
        className="ledger-card rounded-sm p-4 grid grid-cols-2 gap-3"
      >
        <input
          placeholder="Fuente (Salario, proyecto…)"
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
          value={kind}
          onChange={(e) => setKind(e.target.value as "fijo" | "eventual")}
          className="border border-line bg-transparent px-3 py-2 rounded-sm text-sm"
        >
          <option value="fijo">Fijo (mensual)</option>
          <option value="eventual">Eventual</option>
        </select>
        {kind === "fijo" && (
          <input
            type="number"
            min={1}
            max={31}
            placeholder="Día esperado del mes"
            value={expectedDay}
            onChange={(e) => setExpectedDay(e.target.value)}
            className="border border-line bg-transparent px-3 py-2 rounded-sm text-sm"
          />
        )}
        <div className="col-span-2">
          <label className="block text-xs text-stone mb-1">
            ¿A qué cuenta entra?
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
          Registrar ingreso
        </button>
      </form>

      <ul className="space-y-2">
        {items.length === 0 && (
          <li className="text-sm text-stone">Aún no has registrado ingresos.</li>
        )}
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between ledger-card rounded-sm px-4 py-3"
          >
            <div>
              <p className="text-sm">{item.name}</p>
              <p className="text-xs text-stone">
                {item.received_on} · {item.kind}
                {item.expected_day ? ` (día ${item.expected_day})` : ""} ·{" "}
                {accountLabel(accounts, item.account_id)}
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
