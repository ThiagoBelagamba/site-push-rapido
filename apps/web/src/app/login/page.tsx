"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Bell } from "lucide-react";
import { api, clearToken, isLoggedIn, setToken } from "@/lib/api";

async function resolveLandingRoute(): Promise<string> {
  const site = await api.getSite();
  if (!site.configurado) return "/integrar";

  const setup = await api.getSetupStatus();
  return setup.ready ? "/campanhas" : "/integrar/codigo";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) return;
    resolveLandingRoute()
      .then((route) => router.replace(route))
      .catch(() => clearToken());
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      clearToken();
      const { token } = await api.login(email, password);
      setToken(token);
      router.replace(await resolveLandingRoute());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card animate-in fade-in" onSubmit={handleSubmit}>
        <div className="login-brand">
          <div className="login-brand-icon" aria-hidden>
            <Bell size={24} />
          </div>
          <div className="login-brand-copy">
            <h1>Push Rápido</h1>
            <p className="login-subtitle">
              Acesse o painel para configurar o site, acompanhar sua audiência e operar campanhas de
              Web Push com mais segurança.
            </p>
          </div>
        </div>
        <p className="login-support-copy">Use as credenciais da sua conta para entrar no painel.</p>
        {error && <div className="login-error">{error}</div>}
        <label>
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@empresa.com"
            required
          />
        </label>
        <label>
          Senha
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Digite sua senha"
            required
          />
        </label>
        <button type="submit" className="btn btn-primary login-submit" disabled={loading}>
          {loading ? (
            <>
              <Activity size={16} className="animate-spin" />
              <span>Entrando...</span>
            </>
          ) : (
            "Entrar no painel"
          )}
        </button>
      </form>
    </div>
  );
}
