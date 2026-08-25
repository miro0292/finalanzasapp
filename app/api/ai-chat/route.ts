import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `Eres el asesor financiero personal dentro de la app "Cuaderno". Hablas en español, directo y breve, sin relleno.

Tienes acceso a los datos financieros reales del usuario en el mensaje (cuentas, deudas fijas, gastos hormiga recientes, ingresos, ahorros y pagos programados). Úsalos para dar consejo concreto: qué pagar primero, con qué cuenta, qué tan justo anda de dinero antes de su próximo ingreso, y en qué está gastando de más.

Cuando el usuario te pida (o cuando tenga sentido) mover la fecha de un pago, crear una meta de ahorro para un antojo/gusto que quiere darse, o reprogramar un pago del Excel importado, usa la herramienta "proponer_accion" para dejar la sugerencia lista y que el usuario la confirme con un clic — nunca digas que ya hiciste el cambio, porque tú solo lo propones. Si el usuario solo quiere consejo (sin acción concreta), responde en texto normal sin usar la herramienta. Puedes llamar "proponer_accion" varias veces en la misma respuesta si hay varios cambios independientes que proponer — cada llamada se le muestra al usuario como una tarjeta separada que confirma o descarta por su cuenta.

Para "reprogramar_deuda" usa el id exacto de la deuda que te paso. Para "mover_pago_programado" usa el id exacto del pago programado. Para "crear_meta_ahorro" no necesitas id, es una fila nueva.

Cuando el usuario pida un "plan del mes" o algo equivalente (organizar todos sus pagos, orden más eficiente para pagar sus deudas): revisa TODAS sus deudas fijas activas y pagos programados pendientes, compáralos contra sus ingresos (fechas y montos) y su cupo/saldo disponible en cada cuenta, y responde con un resumen en texto explicando el orden recomendado de pago y por qué. Usa "proponer_accion" solo para los cambios de fecha que de verdad convenga mover — no propongas una tarjeta por cada deuda si la mayoría está bien como está.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "proponer_accion",
    description:
      "Propone un cambio concreto y accionable a los datos financieros del usuario, para que él lo confirme o descarte desde la interfaz. No uses esto para simple consejo en texto.",
    input_schema: {
      type: "object",
      properties: {
        tipo: {
          type: "string",
          enum: [
            "reprogramar_deuda",
            "crear_meta_ahorro",
            "mover_pago_programado",
          ],
        },
        titulo: {
          type: "string",
          description:
            "Resumen corto y accionable, ej: 'Mover pago de Internet al día 10'",
        },
        detalle: {
          type: "string",
          description: "Explicación breve de por qué se sugiere esto",
        },
        datos: {
          type: "object",
          description:
            "reprogramar_deuda: {debt_id, new_due_day, new_max_pay_day}. crear_meta_ahorro: {nombre, monto_meta, monto_sugerido}. mover_pago_programado: {scheduled_payment_id, new_due_date}.",
        },
      },
      required: ["tipo", "titulo", "detalle", "datos"],
    },
  },
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, context } = body;
    // messages: [{ role: 'user'|'assistant', content: string }, ...] historial reciente
    // context: { accounts, debts, dailyExpenses, income, savings, scheduledPayments }

    const contextBlock = `Datos financieros actuales del usuario (JSON):\n${JSON.stringify(
      context
    )}`;

    const claudeMessages: Anthropic.MessageParam[] = [
      { role: "user", content: contextBlock },
      { role: "assistant", content: "Entendido, tengo el contexto financiero actual." },
      ...messages.map((m: any) => ({ role: m.role, content: m.content })),
    ];

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages: claudeMessages,
    });

    let text = "";
    const suggestions: any[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        text += block.text;
      } else if (block.type === "tool_use" && block.name === "proponer_accion") {
        suggestions.push({ ...(block.input as object), status: "pending" });
      }
    }

    if (!text && suggestions.length) {
      text = suggestions.map((s) => s.titulo).join("\n");
    }

    return NextResponse.json({ text, suggestions });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Error al hablar con el asistente" },
      { status: 500 }
    );
  }
}
