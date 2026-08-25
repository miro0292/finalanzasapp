"use client";

import { Account } from "@/lib/firebaseClient";

const TYPE_LABEL: Record<string, string> = {
  tarjeta_credito: "Tarjeta de crédito",
  ahorros: "Cuenta de ahorros",
  credito: "Crédito",
  billetera: "Billetera digital",
};

export default function AccountSelect({
  accounts,
  value,
  onChange,
  className,
}: {
  accounts: Account[];
  value: string; // "" means efectivo
  onChange: (accountId: string) => void;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className || "border border-line bg-transparent px-3 py-2 rounded-sm text-sm"}
    >
      <option value="">Efectivo</option>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name} ({TYPE_LABEL[a.type] || a.type})
        </option>
      ))}
    </select>
  );
}

export function accountLabel(accounts: Account[], accountId: string | null) {
  if (!accountId) return "Efectivo";
  const acc = accounts.find((a) => a.id === accountId);
  return acc ? acc.name : "Efectivo";
}
