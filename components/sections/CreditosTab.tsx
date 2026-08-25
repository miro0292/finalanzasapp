"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { auth, db, DebtPlan, ScheduledPayment } from "@/lib/firebaseClient";
import { formatCOP } from "@/lib/format";
import { extractRows, pick } from "@/lib/excelImport";

const NAME_KEYS = ["nombre", "deuda", "concepto", "descripcion", "name", "creditor", "acreedor"];
const BALANCE_KEYS = ["balance", "saldo", "monto_original", "original_balance"];
const PAYMENT_KEYS = ["valor", "monto", "amount", "cuota", "payment", "pago"];
const RATE_KEYS = ["rate", "tasa", "interes", "interest"];

const NOMBRES_COMUNES = [
  "Tarjeta de crédito",
  "Crédito de vehículo",
  "Crédito de libre inversión",
  "Crédito hipotecario",
  "Crédito educativo",
  "Fondo de empleados",
];

function totalPagado(scheduledPayments: ScheduledPayment[], name: string) {
  return scheduledPayments
    .filter((sp) => sp.status === "pagado" && sp.debt_name === name)
    .reduce((a, r) => a + Number(r.amount), 0);
}

function parseRate(raw: any): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(String(raw).replace(/[^0-9.-]/g, ""));
  if (!n) return null;
  const pct = n <= 1 ? n * 100 : n;
  return Math.round(pct * 100) / 100;
}

export default function CreditosTab({
  items,
  scheduledPayments,
  onChange,
}: {
  items: DebtPlan[];
  scheduledPayments: ScheduledPayment[];
  onChange: () => void;
}) {
  const [name, setName] = useState("");
  const [originalBalance, setOriginalBalance] = useState("");
  const [monthlyPayment, setMonthlyPayment] = useState("");
  const [rate, setRate] = useState("");
  const [saving, setSaving] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editBalance, setEditBalance] = useState("");
  const [editPayment, setEditPayment] = useState("");
  const [editRate, setEditRate] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !originalBalance || !monthlyPayment) return;
    setSaving(true);
    const uid = auth.currentUser!.uid;
    await addDoc(collection(db, "users", uid, "debtPlans"), {
      name,
      original_balance: Number(originalBalance),
      monthly_payment: Number(monthlyPayment),
      interest_rate: rate ? Number(rate) : null,
      order: items.length + 1,
      created_at: new Date().toISOString(),
    });
    setName("");
    setOriginalBalance("");
    setMonthlyPayment("");
    setRate("");
    setSaving(false);
    onChange();
  }

  async function remove(id: string) {
    const uid = auth.currentUser!.uid;
    await deleteDoc(doc(db, "users", uid, "debtPlans", id));
    onChange();
  }

  function startEdit(item: DebtPlan) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditBalance(String(item.original_balance));
    setEditPayment(String(item.monthly_payment));
    setEditRate(item.interest_rate ? String(item.interest_rate) : "");
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: string) {
    if (!editName || !editBalance || !editPayment) return;
    setEditSaving(true);
    const uid = auth.currentUser!.uid;
    await updateDoc(doc(db, "users", uid, "debtPlans", id), {
      name: editName,
      original_balance: Number(editBalance),
      monthly_payment: Number(editPayment),
      interest_rate: editRate ? Number(editRate) : null,
    });
    setEditSaving(false);
    setEditingId(null);
    onChange();
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMsg("");
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const rows: any[] = extractRows(wb, NAME_KEYS, BALANCE_KEYS);

      const uid = auth.currentUser!.uid;

      const toInsert = rows
        .map((row, i) => {
          const keys = Object.keys(row).reduce((acc, k) => {
            acc[k.toLowerCase().trim()] = row[k];
            return acc;
          }, {} as Record<string, any>);

          const rawName = pick(keys, NAME_KEYS);
          const rawBalance = pick(keys, BALANCE_KEYS);
          if (!rawName || !rawBalance) return null;

          const original_balance = Number(String(rawBalance).replace(/[^0-9.-]/g, ""));
          if (!original_balance) return null;

          const rawPayment = pick(keys, PAYMENT_KEYS);
          const monthly_payment = rawPayment
            ? Number(String(rawPayment).replace(/[^0-9.-]/g, ""))
            : 0;

          return {
            name: String(rawName),
            original_balance,
            monthly_payment,
            interest_rate: parseRate(pick(keys, RATE_KEYS)),
            order: items.length + i + 1,
            created_at: new Date().toISOString(),
          };
        })
        .filter(Boolean) as Record<string, any>[];

      if (toInsert.length === 0) {
        setImportMsg(
          "No se reconocieron filas. Asegúrate de tener columnas de nombre y saldo."
        );
      } else {
        const col = collection(db, "users", uid, "debtPlans");
        await Promise.all(toInsert.map((row) => addDoc(col, row)));
        setImportMsg(`Se importaron ${toInsert.length} créditos.`);
        onChange();
      }
    } catch (err) {
      setImportMsg("No se pudo leer el archivo. Verifica que sea un Excel válido.");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const sorted = [...items].sort((a, b) => a.order - b.order);

  const totalOriginal = items.reduce((a, r) => a + Number(r.original_balance), 0);
  const totalPagadoGlobal = items.reduce(
    (a, r) => a + Math.min(totalPagado(scheduledPayments, r.name), r.original_balance),
    0
  );
  const totalActual = totalOriginal - totalPagadoGlobal;
  const progresoGlobal = totalOriginal > 0 ? (totalPagadoGlobal / totalOriginal) * 100 : 0;

  return (
    <div className="py-4 space-y-6">
      <div>
        <h2 className="font-display text-xl mb-1">Créditos</h2>
        <p className="text-sm text-stone">
          El saldo de cada crédito baja solo cuando marcas sus pagos como
          "pagado" en Programados.
        </p>
      </div>

      {items.length > 0 && (
        <div className="ledger-card rounded-sm p-4">
          <p className="text-sm text-stone mb-1">Saldo total pendiente</p>
          <p className="amount text-2xl text-ink">{formatCOP(totalActual)}</p>
          <p className="text-xs text-stone mt-1">
            de {formatCOP(totalOriginal)} originales · {progresoGlobal.toFixed(0)}% pagado
          </p>
          <div className="w-full h-2 bg-line rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-sage"
              style={{ width: `${Math.min(100, progresoGlobal)}%` }}
            />
          </div>
        </div>
      )}

      <div className="ledger-card rounded-sm p-4">
        <label className="block text-xs text-stone mb-2">
          Importar desde Excel (columnas: nombre o creditor, balance o saldo, valor o payment)
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
          placeholder="Nombre (Tarjeta Visa, Crédito vehículo…)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          list="nombres-creditos"
          className="col-span-2 border border-line bg-transparent px-3 py-2 rounded-sm text-sm"
          required
        />
        <datalist id="nombres-creditos">
          {NOMBRES_COMUNES.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <input
          type="number"
          step="0.01"
          placeholder="Saldo actual del crédito"
          value={originalBalance}
          onChange={(e) => setOriginalBalance(e.target.value)}
          className="border border-line bg-transparent px-3 py-2 rounded-sm text-sm"
          required
        />
        <input
          type="number"
          step="0.01"
          placeholder="Pago mensual"
          value={monthlyPayment}
          onChange={(e) => setMonthlyPayment(e.target.value)}
          className="border border-line bg-transparent px-3 py-2 rounded-sm text-sm"
          required
        />
        <input
          type="number"
          step="0.01"
          placeholder="Tasa de interés % (opcional)"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          className="col-span-2 border border-line bg-transparent px-3 py-2 rounded-sm text-sm"
        />
        <button
          type="submit"
          disabled={saving}
          className="col-span-2 bg-ink text-paper py-2 rounded-sm text-sm disabled:opacity-60"
        >
          Agregar crédito
        </button>
      </form>

      <ul className="space-y-2">
        {items.length === 0 && (
          <li className="text-sm text-stone">
            Aún no tienes créditos registrados. Agrégalos uno por uno o
            impórtalos desde tu Excel.
          </li>
        )}
        {sorted.map((item) => {
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
                  className="col-span-2 border border-line bg-transparent px-3 py-2 rounded-sm text-sm"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Saldo original"
                  value={editBalance}
                  onChange={(e) => setEditBalance(e.target.value)}
                  className="border border-line bg-transparent px-3 py-2 rounded-sm text-sm"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Pago mensual"
                  value={editPayment}
                  onChange={(e) => setEditPayment(e.target.value)}
                  className="border border-line bg-transparent px-3 py-2 rounded-sm text-sm"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Tasa de interés % (opcional)"
                  value={editRate}
                  onChange={(e) => setEditRate(e.target.value)}
                  className="col-span-2 border border-line bg-transparent px-3 py-2 rounded-sm text-sm"
                />
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

          const pagado = Math.min(
            totalPagado(scheduledPayments, item.name),
            item.original_balance
          );
          const saldoActual = item.original_balance - pagado;
          const progreso =
            item.original_balance > 0 ? (pagado / item.original_balance) * 100 : 0;
          const mesesRestantes =
            item.monthly_payment > 0 ? Math.ceil(saldoActual / item.monthly_payment) : null;

          let mensaje: string;
          let mensajeColor: string;
          if (saldoActual <= 0) {
            mensaje = "¡Liquidado! Ya no debes nada de esto.";
            mensajeColor = "text-sage";
          } else if (progreso >= 75) {
            mensaje = `Ya casi lo logras — vas en ${progreso.toFixed(0)}%.`;
            mensajeColor = "text-sage";
          } else if (pagado > 0) {
            mensaje = `Vas bien, llevas el ${progreso.toFixed(0)}% pagado.`;
            mensajeColor = "text-gold";
          } else {
            mensaje = "Sin pagos registrados todavía.";
            mensajeColor = "text-stone";
          }

          return (
            <li key={item.id} className="ledger-card rounded-sm px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{item.name}</p>
                <div className="flex items-center gap-3">
                  <span className="amount text-sm">{formatCOP(saldoActual)}</span>
                  <button
                    onClick={() => startEdit(item)}
                    className="text-xs text-stone hover:text-ink"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => remove(item.id)}
                    className="text-xs text-stone hover:text-coral"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
              <div className="w-full h-2 bg-line rounded-full overflow-hidden">
                <div
                  className="h-full bg-sage"
                  style={{ width: `${Math.min(100, progreso)}%` }}
                />
              </div>
              <p className="text-xs text-stone">
                {formatCOP(pagado)} pagados de {formatCOP(item.original_balance)}
                {mesesRestantes !== null && saldoActual > 0
                  ? ` · ~${mesesRestantes} meses restantes al ritmo actual`
                  : ""}
                {item.interest_rate ? ` · ${item.interest_rate}% interés` : ""}
              </p>
              <p className={`text-xs ${mensajeColor}`}>{mensaje}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
