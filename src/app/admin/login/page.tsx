"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/client-api";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await fetchJson("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      router.replace("/admin");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo iniciar sesión.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-showcase">
        <Link className="site-brand" href="/"><span className="brand-mark">N</span><span>Nexo</span></Link>
        <h1>Todo lo que tu sitio necesita, en un solo lugar.</h1>
        <p>ESPACIO DE TRABAJO · SITIO WEB</p>
      </section>
      <section className="login-card-wrap">
        <form className="login-card" onSubmit={signIn}>
          <h2>Qué bueno verte.</h2>
          <p>Entra para gestionar tu sitio web.</p>
          {error && <p className="error-message" role="alert">{error}</p>}
          <div className="form-field">
            <label htmlFor="email">Correo electrónico</label>
            <input id="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="password">Contraseña</label>
            <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          <button className="primary-action" type="submit" disabled={busy}>{busy ? "Verificando..." : "Entrar al panel"} <span aria-hidden="true">→</span></button>
        </form>
      </section>
    </main>
  );
}
