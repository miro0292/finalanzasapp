// Cambia locale/currency aquí si no usas pesos colombianos.
const LOCALE = "es-CO";
const CURRENCY = "COP";

export function formatCOP(value: number) {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: CURRENCY,
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function currentMonthLabel() {
  return new Intl.DateTimeFormat("es-CO", {
    month: "long",
    year: "numeric",
  }).format(new Date());
}
