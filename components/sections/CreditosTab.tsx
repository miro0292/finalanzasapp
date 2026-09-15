"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { auth, db, Account, DailyExpense, DebtPlan, ScheduledPayment } from "@/lib/firebaseClient";
import { formatCOP } from "@/lib/format";
import { extractRows, pick } from "@/lib/excelImport";
import { currentBalance, totalGastadoDebtPlan, totalPagadoDebtPlan } from "@/lib/debtProgress";

const NAME_KEYS = ["nombre", "deuda", "concepto", "descripcion", "name", "creditor", "acreedor"];
const BALANCE_KEYS = ["balance", "saldo", "monto_original", "original_balance"];
const PAYMENT_KEYS = ["valor", "monto", "amount", "cuota", "payment", "pago"];
const RATE_KEYS = ["rate", "tasa", "interes", "interest"];
const DUE_DAY_KEYS = ["dia", "día", "dia_vencimiento", "due_day", "vencimiento"];

const NOMBRES_COMUNES = [
  "Tarjeta de crédito",
  "Crédito de vehículo",
  "Crédito de libre inversión",
  "Crédito hipotecario",
  "Crédito educativo",
  "Fondo de empleados",
];

function parseRate(raw: any): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(String(raw).replace(/[^0-9.-]/g, ""));
  if (!n) return null;
  const pct = n <= 1 ? n * 100 : n;
  return Math.round(pct * 100) / 100;
}

const LINKABLE_TYPES = ["tarjeta_credito", "credito"];

export default function CreditosTab({
  items,
  scheduledPayments,
  dailyExpenses,
  accounts,
  onChange,
}: {
  items: DebtPlan[];
  scheduledPayments: ScheduledPayment[];
  dailyExpenses: DailyExpense[];
  accounts: Account[];
  onChange: () => void;
}) {
  const linkableAccounts = accounts.filter((a) => LINKABLE_TYPES.includes(a.type));

  const [name, setName] = useState("");
  const [originalBalance, setOriginalBalance] = useState("");
  const [monthlyPayment, setMonthlyPayment] = useState("");
  const [rate, setRate] = useState("");
  const [dueDay, setDueDay] = useState("1");
  const [maxPayDay, setMaxPayDay] = useState("");
  const [linkedAccountId, setLinkedAccountId] = useState("");
  const [saving, setSaving] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editBalance, setEditBalance] = useState("");
  const [editPayment, setEditPayment] = useState("");
  const [editRate, setEditRate] = useState("");
  const [editDueDay, setEditDueDay] = useState("1");
  const [editMaxPayDay, setEditMaxPayDay] = useState("");
  const [editLinkedAccountId, setEditLinkedAccountId] = useState("");
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
      due_day: Number(dueDay),
      max_pay_day: maxPayDay ? Number(maxPayDay) : null,
      account_id: linkedAccountId || null,
      order: items.length + 1,
      created_at: new Date().toISOString(),
    });
    setName("");
    setOriginalBalance("");
    setMonthlyPayment("");
    setRate("");
    setDueDay("1");
    setMaxPayDay("");
    setLinkedAccountId("");
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
    setEditDueDay(item.due_day ? String(item.due_day) : "1");
    setEditMaxPayDay(item.max_pay_day ? String(item.max_pay_day) : "");
    setEditLinkedAccountId(item.account_id || "");
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
      due_day: Number(editDueDay),
      max_pay_day: editMaxPayDay ? Number(editMaxPayDay) : null,
      account_id: editLinkedAccountId || null,
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
      let sinDia = 0;

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

          const rawDueDay = pick(keys, DUE_DAY_KEYS);
          const due_day = rawDueDay ? Number(String(rawDueDay).replace(/[^0-9]/g, "")) : 1;
          if (!rawDueDay) sinDia++;

          return {
            name: String(rawName),
            original_balance,
            monthly_payment,
            interest_rate: parseRate(pick(keys, RATE_KEYS)),
            due_day: due_day >= 1 && due_day <= 31 ? due_day : 1,
            max_pay_day: null,
            account_id: null,
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
        setImportMsg(
          `Se importaron ${toInsert.length} créditos.` +
            (sinDia
              ? ` ${sinDia} quedaron con día de vencimiento 1 por defecto — ajústalo en cada uno.`
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

  const sorted = [...items].sort((a, b) => a.order - b.order);

  const totalOriginal = items.reduce((a, r) => a + Number(r.original_balance), 0);
  const totalActual = items.reduce(
    (a, r) => a + currentBalance(r, scheduledPayments, dailyExpenses),
    0
  );
  const progresoGlobal =
    totalOriginal > 0
      ? Math.max(0, Math.min(100, ((totalOriginal - totalActual) / totalOriginal) * 100))
      : 0;

  const pendientes = items.filter(
    (p) => currentBalance(p, scheduledPayments, dailyExpenses) > 0
  );
  const avalancha = [...pendientes].sort(
    (a, b) => (b.interest_rate ?? -1) - (a.interest_rate ?? -1)
  );
  const bolaDeNieve = [...pendientes].sort(
    (a, b) =>
      currentBalance(a, scheduledPayments, dailyExpenses) -
      currentBalance(b, scheduledPayments, dailyExpenses)
  );

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

      {pendientes.length > 1 && (
        <div className="ledger-card rounded-sm p-4">
          <p className="text-sm text-stone mb-3">
            Orden sugerido para enfocar tus pagos extra
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-stone mb-2">
                Avalancha — mayor tasa primero (menos intereses en total)
              </p>
              <ol className="text-sm space-y-1 list-decimal list-inside">
                {avalancha.map((p) => (
                  <li key={p.id}>
                    {p.name}
                    <span className="text-xs text-stone">
                      {" "}
                      · {p.interest_rate ? `${p.interest_rate}%` : "sin tasa"}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <p className="text-xs text-stone mb-2">
                Bola de nieve — menor saldo primero (motivación rápida)
              </p>
              <ol className="text-sm space-y-1 list-decimal list-inside">
                {bolaDeNieve.map((p) => (
                  <li key={p.id}>
                    {p.name}
                    <span className="text-xs text-stone">
                      {" "}
                      · {formatCOP(currentBalance(p, scheduledPayments, dailyExpenses))}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
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
        <div>
          <label className="block text-xs text-stone mb-1">Día de vencimiento</label>
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
            ¿Es la tarjeta/cupo de alguna cuenta? (opcional)
          </label>
          <select
            value={linkedAccountId}
            onChange={(e) => setLinkedAccountId(e.target.value)}
            className="w-full border border-line bg-transparent px-3 py-2 rounded-sm text-sm"
          >
            <option value="">Sin vincular</option>
            {linkableAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
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
                <div>
                  <label className="block text-xs text-stone mb-1">Día de vencimiento</label>
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
                    ¿Es la tarjeta/cupo de alguna cuenta? (opcional)
                  </label>
                  <select
                    value={editLinkedAccountId}
                    onChange={(e) => setEditLinkedAccountId(e.target.value)}
                    className="w-full border border-line bg-transparent px-3 py-2 rounded-sm text-sm"
                  >
                    <option value="">Sin vincular</option>
                    {linkableAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
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

          const pagado = totalPagadoDebtPlan(scheduledPayments, item.name);
          const gastado = totalGastadoDebtPlan(dailyExpenses, item);
          const saldoActual = currentBalance(item, scheduledPayments, dailyExpenses);

          const todayStr = new Date().toISOString().slice(0, 10);
          const monthKey = todayStr.slice(0, 7);
          const cuotaDelMes = scheduledPayments.find(
            (sp) => sp.debt_name === item.name && sp.due_date.startsWith(monthKey)
          );
          const vencida =
            !!cuotaDelMes && cuotaDelMes.status === "pendiente" && cuotaDelMes.due_date < todayStr;
          const urgente =
            !!cuotaDelMes &&
            cuotaDelMes.status === "pendiente" &&
            !vencida &&
            (Date.parse(cuotaDelMes.due_date) - Date.parse(todayStr)) / 86400000 <= 3;

          const progreso =
            item.original_balance > 0
              ? ((item.original_balance - saldoActual) / item.original_balance) * 100
              : 0;
          const progresoBarra = Math.max(0, Math.min(100, progreso));
          const mesesRestantes =
            item.monthly_payment > 0 && saldoActual > 0
              ? Math.ceil(saldoActual / item.monthly_payment)
              : null;

          let mensaje: string;
          let mensajeColor: string;
          if (saldoActual <= 0) {
            mensaje = "¡Liquidado! Ya no debes nada de esto.";
            mensajeColor = "text-sage";
          } else if (gastado > 0 && saldoActual >= item.original_balance) {
            mensaje = "Este periodo has gastado más de lo que has pagado.";
            mensajeColor = "text-coral";
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

          const cuentaVinculada = accounts.find((a) => a.id === item.account_id);

          return (
            <li key={item.id} className="ledger-card rounded-sm px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {item.name}
                  {cuentaVinculada && (
                    <span className="text-xs text-stone font-normal">
                      {" "}
                      · vinculada a {cuentaVinculada.name}
                    </span>
                  )}
                </p>
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
                  className={`h-full ${progreso < 0 ? "bg-coral" : "bg-sage"}`}
                  style={{ width: `${progresoBarra}%` }}
                />
              </div>
              <p className="text-xs text-stone">
                {formatCOP(pagado)} pagados de {formatCOP(item.original_balance)}
                {gastado > 0 ? ` · ${formatCOP(gastado)} gastados con la tarjeta` : ""}
                {mesesRestantes !== null
                  ? ` · ~${mesesRestantes} meses restantes al ritmo actual`
                  : ""}
                {item.interest_rate ? ` · ${item.interest_rate}% interés` : ""}
                {item.due_day ? ` · vence día ${item.due_day}` : ""}
              </p>
              {vencida && (
                <p className="text-xs text-coral">La cuota de este mes ya venció</p>
              )}
              {urgente && (
                <p className="text-xs text-gold">La cuota de este mes vence pronto</p>
              )}
              <p className={`text-xs ${mensajeColor}`}>{mensaje}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
