# Manual: desplegar "Cuaderno" a producción con Claude Code en VS Code

Esta guía asume que partes de cero: tienes el código (`finanzas-app.zip`)
pero nada instalado todavía. Al final tendrás la app corriendo en una URL
pública y sabrás cómo pedirle cambios a Claude Code directamente sobre tu
proyecto real.

---

## 0. Qué vas a instalar (una sola vez)

| Herramienta | Para qué | Dónde conseguirla |
|---|---|---|
| Visual Studio Code | Editor donde vas a trabajar | https://code.visualstudio.com |
| Node.js (versión 18 o superior) | Correr la app y sus herramientas | https://nodejs.org |
| Git | Subir el código a GitHub | https://git-scm.com |
| Claude Code | El asistente que edita y despliega por ti dentro de VS Code | se instala en el paso 2 |

Cuentas que necesitas crear (todas tienen plan gratis):
- **GitHub** (github.com) — donde vive tu código
- **Firebase** (console.firebase.google.com) — base de datos y usuarios
- **Vercel** (vercel.com) — donde queda publicada la app
- **Anthropic Console** (console.anthropic.com) — para la clave de la IA del chat

---

## 1. Descomprimir el proyecto

1. Descarga `finanzas-app.zip` desde la conversación.
2. Descomprímelo en una carpeta que uses para tus proyectos, por ejemplo
   `Documentos/finanzas-app`.
3. Abre VS Code → **File → Open Folder…** → selecciona esa carpeta.

---

## 2. Instalar Claude Code dentro de VS Code

1. En VS Code, abre la terminal integrada: **Terminal → New Terminal**
   (o `Ctrl+ñ` / `` Ctrl+` ``).
2. Instala Claude Code globalmente:
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```
3. Instala la extensión de Claude Code para VS Code: en el panel de
   Extensiones (ícono de cuadritos a la izquierda), busca **"Claude Code"**
   e instálala. También puedes escribir en la terminal, dentro de la
   carpeta del proyecto:
   ```bash
   claude
   ```
   La primera vez te pedirá iniciar sesión con tu cuenta de Anthropic
   (o pegar una API key) — sigue las instrucciones en pantalla.
4. Verifica que Claude Code ve tu proyecto: en el chat de Claude Code
   (aparece en un panel lateral) escribe:
   ```
   Lee la estructura de este proyecto y dime qué hace.
   ```
   Si te describe correctamente la app de gastos, quedó bien conectado.

> A partir de aquí, cualquier cambio que quieras ("agrega una categoría de
> gasto", "cambia el color del botón") se lo pides directamente a Claude
> Code en ese panel — ya tiene el proyecto abierto y puede editar los
> archivos, correr comandos y hacer commits por ti.

---

## 3. Crear el proyecto en Firebase

1. Entra a https://console.firebase.google.com → crea o abre tu proyecto
   (ej. "my-finanzas-app").
2. **Build → Authentication → Get started** → pestaña **Sign-in method** →
   habilita **Correo electrónico/contraseña**.
3. **Build → Firestore Database → Create database** → modo producción,
   elige la región más cercana.
4. En Firestore, pestaña **Reglas**: abre en VS Code el archivo
   `firestore.rules`, copia su contenido, pégalo ahí, y dale **Publicar**.
   Esto asegura que cada usuario solo vea sus propios datos.
5. **Project settings** (ícono de engranaje) → **Tus apps** → si no tienes
   una app web, créala (ícono `</>`) → copia el objeto `firebaseConfig`
   que te muestra (lo necesitas en el siguiente paso).

---

## 4. Configurar las variables de entorno

1. En VS Code, dentro de la carpeta del proyecto, copia el archivo
   `.env.local.example` y renómbralo a `.env.local`. Puedes pedírselo a
   Claude Code:
   ```
   Copia .env.local.example a .env.local
   ```
2. Abre `.env.local` y reemplaza los valores con los de tu `firebaseConfig`
   (paso 3.5) y tu clave de Anthropic:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...
   ANTHROPIC_API_KEY=sk-ant-tu-clave
   ```
   La clave de Anthropic la generas en https://console.anthropic.com →
   **API Keys → Create Key**.
3. Guarda el archivo. **Nunca subas este archivo a GitHub** (ya está
   excluido en `.gitignore`, no necesitas hacer nada extra).

---

## 5. Probar la app en tu computador

En la terminal de VS Code:
```bash
npm install
npm run dev
```
Abre tu navegador en http://localhost:3000, crea tu usuario con correo y
contraseña, y navega por las pestañas. Si algo no funciona, pégale el
error a Claude Code en el panel de chat — puede leer el error, encontrar
el archivo responsable y corregirlo.

Para detener el servidor local: `Ctrl + C` en la terminal.

---

## 6. Subir el código a GitHub

1. Crea un repositorio nuevo y **vacío** en https://github.com/new
   (no marques "Add README", ya tienes uno).
2. En la terminal de VS Code:
   ```bash
   git init
   git add .
   git commit -m "Primera versión de Cuaderno"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
   git push -u origin main
   ```
   (Reemplaza la URL por la de tu repositorio real — GitHub te la muestra
   apenas lo creas.)

También puedes pedirle esto a Claude Code directamente:
```
Inicializa git, haz el primer commit, y dime los comandos exactos
para conectarlo con mi repositorio de GitHub (ya lo creé, la URL es:
https://github.com/TU-USUARIO/TU-REPO.git)
```

---

## 7. Desplegar en Vercel (producción)

1. Entra a https://vercel.com → inicia sesión con tu cuenta de GitHub.
2. **Add New… → Project** → selecciona tu repositorio.
3. En **Environment Variables**, agrega las mismas variables de tu
   `.env.local`:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
   - `ANTHROPIC_API_KEY`
4. Dale **Deploy**. En 1-2 minutos tendrás tu URL pública, algo como
   `https://cuaderno-gastos.vercel.app`.
5. Entra desde tu celular, crea tu cuenta real, e instálala como app
   ("Añadir a pantalla de inicio" en el navegador).

De aquí en adelante: **cada vez que hagas `git push`, Vercel despliega la
nueva versión automáticamente.** No tienes que repetir el paso 7.

---

## 8. Flujo normal para pedir cambios (con la app ya en producción)

1. Abre VS Code, abre el panel de Claude Code.
2. Descríbele el cambio en español, ej:
   ```
   Agrega una categoría "mascotas" en gastos hormiga
   ```
3. Claude Code edita los archivos necesarios directamente.
4. Revisa el cambio corriendo `npm run dev` si quieres verlo antes de
   publicarlo.
5. Cuando estés conforme:
   ```bash
   git add .
   git commit -m "Agregar categoría mascotas"
   git push
   ```
   o pídeselo a Claude Code: `Haz commit y push de estos cambios`.
6. Vercel despliega solo — revisa en vercel.com → tu proyecto →
   **Deployments** que haya quedado en verde ("Ready").

---

## 9. Si algo falla al desplegar

- En Vercel, entra a **Deployments**, haz clic en el que falló, y revisa
  el log de errores (aparece en rojo).
- Copia el error y pégaselo a Claude Code en VS Code: puede leer el
  mensaje, identificar la causa (casi siempre una variable de entorno mal
  puesta o un error de sintaxis) y corregirlo.
- Verifica primero lo más común: que las variables de entorno estén bien
  copiadas en Vercel (sin espacios de más, sin comillas).

---

## Resumen del orden

1. Instalar VS Code, Node, Git, Claude Code
2. Descomprimir el proyecto y abrirlo en VS Code
3. Crear el proyecto en Firebase (Authentication + Firestore + reglas)
4. Configurar `.env.local`
5. Probar local con `npm run dev`
6. Subir a GitHub
7. Conectar el repo a Vercel y desplegar
8. Desde ahí, todo cambio = pedírselo a Claude Code → probar local → `git push`
