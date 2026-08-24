"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";
import Dashboard from "./Dashboard";

export default function AuthGate() {
  const [session, setSession] = useState<Session | null | undefined>(
    undefined
  );
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const action =
      mode === "login"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });
    const { error } = await action;
    setLoading(false);
    if (error) setError(traducirError(error.message));
  }

  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center text-stone font-body">
        Cargando…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-3xl text-ink mb-1">Cuaderno</h1>
          <p className="text-stone text-sm mb-8">
            Tu control personal de gastos e ingresos.
          </p>

          <form
            onSubmit={handleSubmit}
            className="ledger-card p-6 space-y-4 rounded-sm"
          >
            <div>
              <label className="block text-xs uppercase tracking-wide text-stone mb-1">
                Correo
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-line bg-transparent px-3 py-2 rounded-sm focus:outline-none focus-visible:outline-2"
                placeholder="tucorreo@ejemplo.com"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-stone mb-1">
                Contraseña
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-line bg-transparent px-3 py-2 rounded-sm focus:outline-none focus-visible:outline-2"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-coral text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-ink text-paper py-2 rounded-sm hover:bg-ink/90 transition-colors disabled:opacity-60"
            >
              {loading
                ? "Un momento…"
                : mode === "login"
                ? "Entrar"
                : "Crear cuenta"}
            </button>
          </form>

          <button
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError("");
            }}
            className="mt-4 text-sm text-stone hover:text-ink underline underline-offset-4"
          >
            {mode === "login"
              ? "¿No tienes cuenta? Créala"
              : "¿Ya tienes cuenta? Entra"}
          </button>
        </div>
      </div>
    );
  }

  return <Dashboard session={session} />;
}

function traducirError(msg: string) {
  if (msg.includes("Invalid login credentials"))
    return "Correo o contraseña incorrectos.";
  if (msg.includes("User already registered"))
    return "Ese correo ya tiene una cuenta.";
  if (msg.includes("Password should be"))
    return "La contraseña debe tener al menos 6 caracteres.";
  return msg;
}
