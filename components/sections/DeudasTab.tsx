"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { auth, db, Account, Debt } from "@/lib/firebaseClient";
import { formatCOP } from "@/lib/format";
import AccountSelect, { accountLabel } from "@/components/AccountSelect";
import { extractRows, pick } from "@/lib/excelImport";

// El Excel puede traer columnas con estos nombres (sin importar mayúsculas):
// nombre/deuda/concepto/creditor/acreedor, valor/monto/cuota/payment/pago
const NAME_KEYS = ["nombre", "deuda", "concepto", "descripcion", "name", "creditor", "acreedor"];
const AMOUNT_KEYS = ["valor", "monto", "amount", "cuota", "payment", "pago"];
const DUE_DAY_KEYS = ["dia", "día", "dia_vencimiento", "due_day", "vencimiento"];

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

  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDueDay, setEditDueDay] = useState("1");
  const [editMaxPayDay, setEditMaxPayDay] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editAccountId, setEditAccountId] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMsg("");
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const rows: any[] = extractRows(wb, NAME_KEYS, AMOUNT_KEYS);

      const uid = auth.currentUser!.uid;
      let sinDia = 0;

      const toInsert = rows
        .map((row) => {
          const keys = Object.keys(row).reduce((acc, k) => {
            acc[k.toLowerCase().trim()] = row[k];
            return acc;
          }, {} as Record<string, any>);

          const rawName = pick(keys, NAME_KEYS);
          const rawAmount = pick(keys, AMOUNT_KEYS);
          if (!rawName || !rawAmount) return null;

          const amount = Number(String(rawAmount).replace(/[^0-9.-]/g, ""));
          if (!amount) return null;

          const rawDueDay = pick(keys, DUE_DAY_KEYS);
          const due_day = rawDueDay ? Number(String(rawDueDay).replace(/[^0-9]/g, "")) : 1;
          if (!rawDueDay) sinDia++;

          return {
            name: String(rawName),
            amount,
            due_day: due_day >= 1 && due_day <= 31 ? due_day : 1,
            max_pay_day: null,
            account_id: null,
            category: "servicios",
            active: true,
            created_at: new Date().toISOString(),
          };
        })
        .filter(Boolean) as Record<string, any>[];

      if (toInsert.length === 0) {
        setImportMsg(
          "No se reconocieron filas. Asegúrate de tener columnas de nombre y valor."
        );
      } else {
        const col = collection(db, "users", uid, "debts");
        await Promise.all(toInsert.map((row) => addDoc(col, row)));
        setImportMsg(
          `Se importaron ${toInsert.length} deudas fijas.` +
            (sinDia
              ? ` ${sinDia} quedaron con día de vencimiento 1 por defecto — ajústalo en cada una.`
              : "")
        );
        onChange();
      }
    } catch (err) {
      setImportMsg("No se pudo leer el archivo. Verifica que sea un Excel válido.");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

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

  function startEdit(item: Debt) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditAmount(String(item.amount));
    setEditDueDay(String(item.due_day));
    setEditMaxPayDay(item.max_pay_day ? String(item.max_pay_day) : "");
    setEditCategory(item.category);
    setEditAccountId(item.account_id || "");
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: string) {
    if (!editName || !editAmount) return;
    setEditSaving(true);
    const uid = auth.currentUser!.uid;
    await updateDoc(doc(db, "users", uid, "debts", id), {
      name: editName,
      amount: Number(editAmount),
      due_day: Number(editDueDay),
      max_pay_day: editMaxPayDay ? Number(editMaxPayDay) : null,
      account_id: editAccountId || null,
      category: editCategory,
    });
    setEditSaving(false);
    setEditingId(null);
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

      <div className="ledger-card rounded-sm p-4">
        <label className="block text-xs text-stone mb-2">
          Importar desde Excel (columnas: nombre o creditor, valor o payment)
        </label>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFile}
          disabled={importing}
          className="text-sm"
        />
        {importing && <p className="text-xs text-stone mt-2">Leyendo archivo…</p>}
        {importMsg && <p className="text-xs text-stone mt-2">{importMsg}</p>}
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

          if (editingId === item.id) {
            return (
              <li
                key={item.id}
                className="ledger-card rounded-sm p-4 grid grid-cols-2 gap-3"
              >
                <input
                  placeholder="Nombre"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  list="nombres-comunes"
                  className="col-span-2 border border-line bg-transparent px-3 py-2 rounded-sm text-sm"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Valor aproximado"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="border border-line bg-transparent px-3 py-2 rounded-sm text-sm"
                />
                <input
                  placeholder="Categoría"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
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
                    value={editDueDay}
                    onChange={(e) => setEditDueDay(e.target.value)}
                    className="w-full border border-line bg-transparent px-3 py-2 rounded-sm text-sm"
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
                    value={editMaxPayDay}
                    onChange={(e) => setEditMaxPayDay(e.target.value)}
                    className="w-full border border-line bg-transparent px-3 py-2 rounded-sm text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-stone mb-1">
                    ¿Con qué la pagas normalmente?
                  </label>
                  <AccountSelect
                    accounts={accounts}
                    value={editAccountId}
                    onChange={setEditAccountId}
                    className="w-full border border-line bg-transparent px-3 py-2 rounded-sm text-sm"
                  />
                </div>
                <div className="col-span-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => saveEdit(item.id)}
                    disabled={editSaving}
                    className="flex-1 bg-ink text-paper py-2 rounded-sm text-sm disabled:opacity-60"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="flex-1 border border-line py-2 rounded-sm text-sm"
                  >
                    Cancelar
                  </button>
                </div>
              </li>
            );
          }

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
                  onClick={() => startEdit(item)}
                  className="text-xs text-stone hover:text-ink"
                >
                  Editar
                </button>
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
