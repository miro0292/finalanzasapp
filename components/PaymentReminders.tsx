"use client";

import { useEffect } from "react";
import { Debt } from "@/lib/firebaseClient";
import { formatCOP } from "@/lib/format";

// Recordatorio local: se ejecuta cuando abres la app y avisa si hay pagos
// fijos que vencen en los próximos 3 días. Para avisos aunque la app esté
// cerrada se necesita push real desde el servidor (ver README, sección
// "Notificaciones push reales").
export default function PaymentReminders({
  fixedExpenses,
}: {
  fixedExpenses: Debt[];
}) {
  useEffect(() => {
    if (!("Notification" in window)) return;

    async function check() {
      if (Notification.permission === "default") {
        await Notification.requestPermission();
      }
      if (Notification.permission !== "granted") return;

      const today = new Date().getDate();
      const proximos = fixedExpenses.filter((f) => {
        if (!f.active) return false;
        const diff = f.due_day - today;
        return diff >= 0 && diff <= 3;
      });

      const yaNotificado = sessionStorage.getItem("recordatorios-hoy");
      if (proximos.length && !yaNotificado) {
        new Notification("Pagos próximos", {
          body: proximos
            .map((p) => `${p.name}: ${formatCOP(p.amount)} (día ${p.due_day})`)
            .join(" · "),
          icon: "/icons/icon-192.png",
        });
        sessionStorage.setItem("recordatorios-hoy", "1");
      }
    }

    check();
  }, [fixedExpenses]);

  return null;
}
