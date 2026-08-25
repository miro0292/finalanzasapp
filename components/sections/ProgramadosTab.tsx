"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { auth, db, Account, ScheduledPayment } from "@/lib/firebaseClient";
import { formatCOP, todayISO } from "@/lib/format";
import AccountSelect, { accountLabel } from "@/components/AccountSelect";

// El Excel puede traer columnas con estos nombres (sin importar mayúsculas):
// nombre/deuda/concepto, fecha/vencimiento, valor/monto/amount
const NAME_KEYS = ["nombre", "deuda", "concepto", "descripcion", "name"];
const DATE_KEYS = ["fecha", "vencimiento", "fecha_pago", "due_date", "date"];
const AMOUNT_KEYS = ["valor", "monto", "amount", "cuota"];

export default function ProgramadosTab({
  items,
  accounts,
  onChange,
}: {
  items: ScheduledPayment[];
  accounts: Account[];
  onChange: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  // Formulario manual
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(todayISO());
  const [accountId, setAccountId] = useState("");
  const [saving, setSaving] = useState(false);

  async function addManual(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !amount) return;
    setSaving(true);
    const uid = auth.currentUser!.uid;
    await addDoc(collection(db, "users", uid, "scheduledPayments"), {
      debt_name: name,
      amount: Number(amount),
      due_date: dueDate,
      account_id: accountId || null,
      status: "pendiente",
      notes: null,
      source: "manual",
      created_at: new Date().toISOString(),
    });
    setName("");
    setAmount("");
    setSaving(false);
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
      const rows: any[] = extractRows(wb);

      const uid = auth.currentUser!.uid;

      const toInsert = rows
        .map((row) => {
          const keys = Object.keys(row).reduce((acc, k) => {
            acc[k.toLowerCase().trim()] = row[k];
            return acc;
          }, {} as Record<string, any>);

          const debt_name = pick(keys, NAME_KEYS);
          const rawDate = pick(keys, DATE_KEYS);
          const rawAmount = pick(keys, AMOUNT_KEYS);

          if (!debt_name || !rawDate || !rawAmount) return null;

          const due_date = toISODate(rawDate);
          const amount = Number(String(rawAmount).replace(/[^0-9.-]/g, ""));
          if (!due_date || !amount) return null;

          return {
            debt_name: String(debt_name),
            due_date,
            amount,
            account_id: null,
            status: "pendiente",
            notes: null,
            source: "excel",
            created_at: new Date().toISOString(),
          };
        })
        .filter(Boolean) as Record<string, any>[];

      if (toInsert.length === 0) {
        setImportMsg(
          "No se reconocieron filas. Asegúrate de tener columnas de nombre, fecha y valor."
        );
      } else {
        const col = collection(db, "users", uid, "scheduledPayments");
        await Promise.all(toInsert.map((row) => addDoc(col, row)));
        setImportMsg(`Se importaron ${toInsert.length} pagos programados.`);
        onChange();
      }
    } catch (err) {
      setImportMsg("No se pudo leer el archivo. Verifica que sea un Excel válido.");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function markPaid(item: ScheduledPayment) {
    const uid = auth.currentUser!.uid;
    await updateDoc(doc(db, "users", uid, "scheduledPayments", item.id), {
      status: item.status === "pagado" ? "pendiente" : "pagado",
    });
    onChange();
  }

  async function remove(id: string) {
    const uid = auth.currentUser!.uid;
    await deleteDoc(doc(db, "users", uid, "scheduledPayments", id));
    onChange();
  }

  const pendientes = items.filter((i) => i.status === "pendiente");
  const pagados = items.filter((i) => i.status === "pagado");

  return (
    <div className="py-4 space-y-6">
      <div>
        <h2 className="font-display text-xl mb-1">Pagos programados</h2>
        <p className="text-sm text-stone">
          Créditos y cuotas a largo plazo. Súbelos desde un Excel o
          agrégalos uno por uno — la IA los usa para darte mejores consejos.
        </p>
      </div>

      <div className="ledger-card rounded-sm p-4">
        <label className="block text-xs text-stone mb-2">
          Importar desde Excel (columnas: nombre, fecha, valor)
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
        onSubmit={addManual}
        className="ledger-card rounded-sm p-4 grid grid-cols-2 gap-3"
      >
        <input
          placeholder="Nombre (Crédito vehículo, cuota 3/12…)"
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
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="border border-line bg-transparent px-3 py-2 rounded-sm text-sm"
        />
        <AccountSelect
          accounts={accounts}
          value={accountId}
          onChange={setAccountId}
          className="col-span-2 border border-line bg-transparent px-3 py-2 rounded-sm text-sm"
        />
        <button
          type="submit"
          disabled={saving}
          className="col-span-2 bg-ink text-paper py-2 rounded-sm text-sm disabled:opacity-60"
        >
          Agregar pago programado
        </button>
      </form>

      <div>
        <p className="text-sm text-stone mb-2">Pendientes ({pendientes.length})</p>
        <ul className="space-y-2">
          {pendientes.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between ledger-card rounded-sm px-4 py-3"
            >
              <div>
                <p className="text-sm">{item.debt_name}</p>
                <p className="text-xs text-stone">
                  {item.due_date} · {accountLabel(accounts, item.account_id)}
                  {item.source === "excel" ? " · Excel" : ""}
                  {item.source === "ia" ? " · IA" : ""}
                  {item.source === "fija" ? " · Fija" : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="amount text-sm">{formatCOP(item.amount)}</span>
                <button
                  onClick={() => markPaid(item)}
                  className="text-xs text-stone hover:text-sage"
                >
                  Marcar pagado
                </button>
                <button
                  onClick={() => remove(item.id)}
                  className="text-xs text-stone hover:text-coral"
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
          {pendientes.length === 0 && (
            <li className="text-sm text-stone">No tienes pagos programados pendientes.</li>
          )}
        </ul>
      </div>

      {pagados.length > 0 && (
        <div>
          <p className="text-sm text-stone mb-2">Pagados ({pagados.length})</p>
          <ul className="space-y-2">
            {pagados.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between ledger-card rounded-sm px-4 py-3 opacity-70"
              >
                <p className="text-sm line-through">{item.debt_name}</p>
                <div className="flex items-center gap-3">
                  <span className="amount text-sm">{formatCOP(item.amount)}</span>
                  <button
                    onClick={() => markPaid(item)}
                    className="text-xs text-stone hover:text-gold"
                  >
                    Deshacer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function pick(row: Record<string, any>, keys: string[]) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== "") return row[k];
  }
  return null;
}

// Plantillas con título/instrucciones arriba de la tabla real hacen que la
// fila de encabezados no siempre sea la primera. Busca, en cada hoja del
// archivo, la primera fila que contenga al menos un encabezado de nombre y
// uno de valor reconocibles.
function extractRows(wb: XLSX.WorkBook): Record<string, any>[] {
  const HEADER_KEYS = [...NAME_KEYS, ...AMOUNT_KEYS];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const raw: any[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      blankrows: false,
    });

    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(raw.length, 30); i++) {
      const cells = raw[i].map((c) => String(c).toLowerCase().trim());
      const hasName = cells.some((c) => NAME_KEYS.includes(c));
      const hasAmount = cells.some((c) => AMOUNT_KEYS.includes(c));
      if (hasName && hasAmount) {
        headerRowIndex = i;
        break;
      }
    }
    if (headerRowIndex === -1) continue;

    const headers = raw[headerRowIndex].map((h) => String(h).toLowerCase().trim());
    const dataRows = raw.slice(headerRowIndex + 1);
    const rows = dataRows
      .map((r) => {
        const obj: Record<string, any> = {};
        headers.forEach((h, idx) => {
          if (h) obj[h] = r[idx];
        });
        return obj;
      })
      .filter((obj) => HEADER_KEYS.some((k) => obj[k] !== undefined && obj[k] !== ""));

    if (rows.length) return rows;
  }
  return [];
}

function toISODate(value: any): string | null {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}
