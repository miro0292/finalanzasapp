# Cuaderno — control de gastos personal

App web (PWA, instalable en el celular) con: cuentas/productos (tarjetas,
créditos, ahorros, billeteras), deudas fijas con fecha de vencimiento y
fecha máxima de pago, gastos e ingresos ligados a la cuenta con la que
pagaste, importación de pagos programados desde Excel, y un chat con IA
que te aconseja y te propone cambios que tú confirmas con un clic.

## 1. Crear el proyecto en Firebase (gratis)

1. Ve a https://console.firebase.google.com → crea o abre tu proyecto
   (ej. "my-finanzas-app").
2. **Build → Authentication → Get started** → pestaña **Sign-in method**
   → habilita el proveedor **Correo electrónico/contraseña**.
3. **Build → Firestore Database → Create database** → modo producción,
   elige la región más cercana.
4. Dentro de Firestore, pestaña **Reglas**, reemplaza el contenido por el
   de `firestore.rules` (en la raíz de este proyecto) y dale **Publicar**.
   Esto asegura que cada usuario solo pueda leer/escribir sus propios
   datos.
5. **Project settings** (ícono de engranaje) → sección **Tus apps** → si no
   tienes una app web, créala (ícono `</>`) → copia el objeto `firebaseConfig`
   que te muestra (lo vas a necesitar en el paso siguiente).

## 2. Configurar el proyecto localmente

Necesitas [Node.js](https://nodejs.org) 18+.

```bash
cd finanzas-app
npm install
cp .env.local.example .env.local
```

Llena `.env.local` con los valores de `firebaseConfig` (paso 1.5) y tu
`ANTHROPIC_API_KEY` (consíguela en https://console.anthropic.com).

```bash
npm run dev
```

Abre http://localhost:3000, crea tu usuario, y empieza por la pestaña
**Cuentas** para registrar tus tarjetas, billeteras (Nequi, Daviplata) y
cuentas de ahorro — el resto de pestañas las usa para el selector "¿con
qué pagaste?".

## 3. Publicarla en internet (Vercel — gratis)

1. Sube el proyecto a un repositorio de GitHub.
2. En https://vercel.com → **Add New Project** → conecta el repo.
3. Agrega las mismas variables de entorno de tu `.env.local` (las seis de
   Firebase más `ANTHROPIC_API_KEY`).
4. **Deploy**. Obtienes una URL pública tipo `https://tu-app.vercel.app`.

## 4. Instalarla en tu celular

- **Android (Chrome)**: menú (⋮) → "Instalar app".
- **iPhone (Safari)**: compartir → "Añadir a pantalla de inicio".

## 5. Ajustes después del despliegue

Pídeme el cambio en el chat, reemplazas el archivo, y subes con
`git add . && git commit -m "cambio" && git push` — Vercel despliega solo.
También puedes editar archivos directo en GitHub.com sin instalar nada.

## 6. Cómo importar tus deudas a largo plazo desde Excel

En la pestaña **Programados**, sube un Excel (.xlsx) o CSV con columnas
que contengan, en cualquier orden y sin importar mayúsculas:

- Nombre: `nombre`, `deuda`, `concepto` o `descripcion`
- Fecha: `fecha`, `vencimiento` o `fecha_pago`
- Valor: `valor`, `monto` o `cuota`

La app reconoce esas columnas automáticamente y crea un pago programado
por cada fila. El chat de IA los usa como contexto para sus recomendaciones.

## 7. El chat con IA

En la pestaña **Chat IA** puedes preguntar cosas como "¿me alcanza para un
antojo este fin de semana?" o "reprograma el pago de Internet para el
día 10". El asistente ve tus cuentas, deudas, gastos, ingresos, ahorros y
pagos programados en cada mensaje.

Cuando el cambio es accionable (mover una fecha, crear una meta de
ahorro para un gusto), el asistente lo deja como una **propuesta** con
botones "Confirmar" / "Descartar" — nada se modifica hasta que tú des
clic en Confirmar.

## 8. Notificaciones

La app avisa (notificación del navegador) al abrirla si hay deudas fijas
que vencen en los próximos 3 días. Para push real con la app cerrada se
necesita un servidor programado (Supabase Edge Function + `web-push` +
llaves VAPID) que revise `debts` y `scheduled_payments` — es un paso
aparte que armamos cuando quieras, porque requiere su propia prueba.

## Estructura del proyecto

```
app/                    → páginas y rutas (Next.js App Router)
  api/ai-chat            → endpoint del chat con Claude (tool-calling)
components/             → UI (login, dashboard, cada pestaña)
  sections/               → Resumen, Cuentas, Deudas, Hormiga, Ingresos,
                            Ahorros, Programados, Chat IA
lib/                    → cliente de Firebase, tipos, formato de moneda
firestore.rules         → reglas de seguridad de Firestore
public/manifest.json    → configuración de la PWA
public/sw.js            → service worker (offline + push)
```
