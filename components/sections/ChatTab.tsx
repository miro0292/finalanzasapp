"use client";

import { useEffect, useRef, useState } from "react";
import {
  supabase,
  Account,
  Debt,
  DailyExpense,
  IncomeRow,
  SavingsRow,
  ScheduledPayment,
  ChatMessage,
  Suggestion,
} from "@/lib/supabaseClient";
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
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(50);
    setMessages((data as ChatMessage[]) || []);
    setLoadingHistory(false);
  }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    const { data: inserted } = await supabase
      .from("chat_messages")
      .insert({ role: "user", content: text, user_id: userId })
      .select()
      .single();

    const newMessages = [...messages, inserted as ChatMessage];
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

      const { data: assistantRow } = await supabase
        .from("chat_messages")
        .insert({
          role: "assistant",
          content: data.text || "",
          suggestion: data.suggestion || null,
          suggestion_status: data.suggestion ? "pending" : null,
          user_id: userId,
        })
        .select()
        .single();

      setMessages((prev) => [...prev, assistantRow as ChatMessage]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: "No pude conectarme con el asistente. Intenta de nuevo.",
          suggestion: null,
          suggestion_status: null,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  async function resolveSuggestion(
    msg: ChatMessage,
    action: "confirmed" | "dismissed"
  ) {
    await supabase
      .from("chat_messages")
      .update({ suggestion_status: action })
      .eq("id", msg.id);

    if (action === "confirmed" && msg.suggestion) {
      await applySuggestion(msg.suggestion);
      onChange();
    }

    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, suggestion_status: action } : m))
    );
  }

  async function applySuggestion(s: Suggestion) {
    const d = s.datos || {};
    if (s.tipo === "reprogramar_deuda" && d.debt_id) {
      const update: any = {};
      if (d.new_due_day) update.due_day = d.new_due_day;
      if (d.new_max_pay_day) update.max_pay_day = d.new_max_pay_day;
      if (Object.keys(update).length) {
        await supabase.from("debts").update(update).eq("id", d.debt_id);
      }
    } else if (s.tipo === "crear_meta_ahorro") {
      const { data: userData } = await supabase.auth.getUser();
      await supabase.from("savings").insert({
        name: d.nombre || s.titulo,
        amount: 0,
        goal_amount: d.monto_meta || null,
        moved_on: new Date().toISOString().slice(0, 10),
        user_id: userData.user?.id,
      });
    } else if (s.tipo === "mover_pago_programado" && d.scheduled_payment_id) {
      const update: any = {};
      if (d.new_due_date) update.due_date = d.new_due_date;
      if (Object.keys(update).length) {
        await supabase
          .from("scheduled_payments")
          .update(update)
          .eq("id", d.scheduled_payment_id);
      }
    }
  }

  return (
    <div className="py-4 flex flex-col h-[calc(100vh-220px)]">
      <div>
        <h2 className="font-display text-xl mb-1">Chat con tu asesor</h2>
        <p className="text-sm text-stone mb-3">
          Pregunta lo que quieras: si te alcanza para un antojo, cómo cuadrar
          tus pagos con tu próximo ingreso, o pídele que reprograme algo.
        </p>
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
            {m.suggestion && (
              <div className="ledger-card rounded-sm p-3 mt-2 max-w-[85%] inline-block text-left border-l-4 border-gold">
                <p className="text-sm font-medium">{m.suggestion.titulo}</p>
                <p className="text-xs text-stone mt-1">{m.suggestion.detalle}</p>
                {m.suggestion_status === "pending" || !m.suggestion_status ? (
                  <div className="flex gap-3 mt-2">
                    <button
                      onClick={() => resolveSuggestion(m, "confirmed")}
                      className="text-xs bg-sage text-paper px-3 py-1.5 rounded-sm"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => resolveSuggestion(m, "dismissed")}
                      className="text-xs text-stone hover:text-coral"
                    >
                      Descartar
                    </button>
                  </div>
                ) : (
                  <p className="text-xs mt-2 text-stone">
                    {m.suggestion_status === "confirmed"
                      ? "✓ Confirmado y aplicado"
                      : "Descartado"}
                  </p>
                )}
              </div>
            )}
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
          onClick={send}
          disabled={sending}
          className="bg-ink text-paper px-4 py-2 rounded-sm text-sm disabled:opacity-60"
        >
          {sending ? "…" : "Enviar"}
        </button>
      </div>
    </div>
  );
}
