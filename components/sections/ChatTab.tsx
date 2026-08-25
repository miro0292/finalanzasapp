"use client";

import { useEffect, useRef, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import {
  auth,
  db,
  Account,
  Debt,
  DailyExpense,
  IncomeRow,
  SavingsRow,
  ScheduledPayment,
  ChatMessage,
  Suggestion,
} from "@/lib/firebaseClient";
import { formatCOP } from "@/lib/format";

type Props = {
  accounts: Account[];
  debts: Debt[];
  dailyExpenses: DailyExpense[];
  income: IncomeRow[];
  savings: SavingsRow[];
  scheduledPayments: ScheduledPayment[];
  onChange: () => void;
};

export default function ChatTab(props: Props) {
  const { accounts, debts, dailyExpenses, income, savings, scheduledPayments, onChange } = props;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadHistory() {
    const uid = auth.currentUser!.uid;
    const snap = await getDocs(
      query(
        collection(db, "users", uid, "chatMessages"),
        orderBy("created_at", "asc"),
        limit(50)
      )
    );
    setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChatMessage)));
    setLoadingHistory(false);
  }

  async function send(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);

    const uid = auth.currentUser!.uid;
    const col = collection(db, "users", uid, "chatMessages");

    const userMsg = {
      role: "user" as const,
      content: text,
      suggestions: [] as ChatMessage["suggestions"],
      created_at: new Date().toISOString(),
    };
    const insertedRef = await addDoc(col, userMsg);
    const inserted: ChatMessage = { id: insertedRef.id, ...userMsg };

    const newMessages = [...messages, inserted];
    setMessages(newMessages);

    try {
      const recentHistory = newMessages.slice(-12).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: recentHistory,
          context: { accounts, debts, dailyExpenses, income, savings, scheduledPayments },
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const assistantMsg = {
        role: "assistant" as const,
        content: data.text || "",
        suggestions: (data.suggestions || []) as ChatMessage["suggestions"],
        created_at: new Date().toISOString(),
      };
      const assistantRef = await addDoc(col, assistantMsg);

      setMessages((prev) => [...prev, { id: assistantRef.id, ...assistantMsg }]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: "No pude conectarme con el asistente. Intenta de nuevo.",
          suggestions: [],
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  async function resolveSuggestion(
    msg: ChatMessage,
    index: number,
    action: "confirmed" | "dismissed"
  ) {
    const target = msg.suggestions[index];
    if (!target) return;

    const updatedSuggestions = msg.suggestions.map((s, i) =>
      i === index ? { ...s, status: action } : s
    );

    const uid = auth.currentUser!.uid;
    await updateDoc(doc(db, "users", uid, "chatMessages", msg.id), {
      suggestions: updatedSuggestions,
    });

    if (action === "confirmed") {
      await applySuggestion(target);
      onChange();
    }

    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, suggestions: updatedSuggestions } : m))
    );
  }

  async function applySuggestion(s: Suggestion) {
    const uid = auth.currentUser!.uid;
    const d = s.datos || {};
    if (s.tipo === "reprogramar_deuda" && d.debt_id) {
      const update: any = {};
      if (d.new_due_day) update.due_day = d.new_due_day;
      if (d.new_max_pay_day) update.max_pay_day = d.new_max_pay_day;
      if (Object.keys(update).length) {
        await updateDoc(doc(db, "users", uid, "debts", d.debt_id), update);
      }
    } else if (s.tipo === "crear_meta_ahorro") {
      await addDoc(collection(db, "users", uid, "savings"), {
        name: d.nombre || s.titulo,
        amount: 0,
        goal_amount: d.monto_meta || null,
        moved_on: new Date().toISOString().slice(0, 10),
        account_id: null,
        created_at: new Date().toISOString(),
      });
    } else if (s.tipo === "mover_pago_programado" && d.scheduled_payment_id) {
      const update: any = {};
      if (d.new_due_date) update.due_date = d.new_due_date;
      if (Object.keys(update).length) {
        await updateDoc(
          doc(db, "users", uid, "scheduledPayments", d.scheduled_payment_id),
          update
        );
      }
    }
  }

  const PLAN_PROMPT =
    "Genera un plan completo de este mes: revisa mis deudas fijas y pagos programados activos, dime el orden más eficiente para pagarlos según mis ingresos, y propón los cambios de fecha que realmente hagan falta.";

  return (
    <div className="py-4 flex flex-col h-[calc(100vh-220px)]">
      <div>
        <h2 className="font-display text-xl mb-1">Chat con tu asesor</h2>
        <p className="text-sm text-stone mb-3">
          Pregunta lo que quieras: si te alcanza para un antojo, cómo cuadrar
          tus pagos con tu próximo ingreso, o pídele que reprograme algo.
        </p>
        <button
          onClick={() => send(PLAN_PROMPT)}
          disabled={sending}
          className="text-xs border border-line px-3 py-1.5 rounded-sm hover:border-gold hover:text-ink disabled:opacity-60 mb-3"
        >
          Generar plan del mes
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {loadingHistory && <p className="text-sm text-stone">Cargando conversación…</p>}
        {!loadingHistory && messages.length === 0 && (
          <p className="text-sm text-stone">
            Empieza escribiendo, por ejemplo: "¿Me alcanza para salir a cine
            este fin de semana?"
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "text-right" : "text-left"}>
            <div
              className={`inline-block max-w-[85%] rounded-sm px-3 py-2 text-sm text-left ${
                m.role === "user"
                  ? "bg-ink text-paper"
                  : "ledger-card"
              }`}
            >
              <p className="whitespace-pre-line">{m.content}</p>
            </div>
            {(m.suggestions || []).map((s, idx) => (
              <div
                key={idx}
                className="ledger-card rounded-sm p-3 mt-2 max-w-[85%] inline-block text-left border-l-4 border-gold"
              >
                <p className="text-sm font-medium">{s.titulo}</p>
                <p className="text-xs text-stone mt-1">{s.detalle}</p>
                {s.status === "pending" ? (
                  <div className="flex gap-3 mt-2">
                    <button
                      onClick={() => resolveSuggestion(m, idx, "confirmed")}
                      className="text-xs bg-sage text-paper px-3 py-1.5 rounded-sm"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => resolveSuggestion(m, idx, "dismissed")}
                      className="text-xs text-stone hover:text-coral"
                    >
                      Descartar
                    </button>
                  </div>
                ) : (
                  <p className="text-xs mt-2 text-stone">
                    {s.status === "confirmed" ? "✓ Confirmado y aplicado" : "Descartado"}
                  </p>
                )}
              </div>
            ))}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 pt-3 border-t border-line mt-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Escribe tu pregunta…"
          className="flex-1 border border-line bg-transparent px-3 py-2 rounded-sm text-sm"
        />
        <button
          onClick={() => send()}
          disabled={sending}
          className="bg-ink text-paper px-4 py-2 rounded-sm text-sm disabled:opacity-60"
        >
          {sending ? "…" : "Enviar"}
        </button>
      </div>
    </div>
  );
}
