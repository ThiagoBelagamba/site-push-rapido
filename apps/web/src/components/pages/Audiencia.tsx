"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Filter, Globe, Monitor, Search, Smartphone, Users } from "lucide-react";
import { api, Metrics, Subscription, parseApiError } from "@/lib/api";
import { useSiteContext } from "@/components/SiteProvider";

function truncate(s: string, n = 48) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function formatNumber(value: number | undefined) {
  return new Intl.NumberFormat("pt-BR").format(value ?? 0);
}

function inferDeviceLabel(userAgent?: string) {
  const ua = String(userAgent || "").toLowerCase();
  if (!ua) return "Desconhecido";
  if (ua.includes("android") || ua.includes("iphone") || ua.includes("mobile")) return "Mobile";
  if (ua.includes("ipad") || ua.includes("tablet")) return "Tablet";
  return "Desktop";
}

export default function Audiencia() {
  const { selectedSite, selectedSiteId, loading: sitesLoading } = useSiteContext();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const refresh = useCallback(async () => {
    if (!selectedSiteId) {
      setMetrics(null);
      setSubscriptions([]);
      setMessage("");
      setLoading(false);
      return;
    }
    setLoading(true);
    const results = await Promise.allSettled([
      api.getMetrics(),
      api.getSubscriptions(),
    ]);
    const [mRes, sRes] = results;
    if (mRes.status === "fulfilled") setMetrics(mRes.value);
    if (sRes.status === "fulfilled") setSubscriptions(sRes.value.subscriptions);
    const failed = results.find((r) => r.status === "rejected");
    if (failed?.status === "rejected") {
      setMessage(parseApiError(failed.reason));
    }
    setLoading(false);
  }, [selectedSiteId]);

  useEffect(() => {
    refresh();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }, 12000);
    return () => clearInterval(interval);
  }, [refresh]);
  const active = subscriptions.filter((s) => s.status === "active").length;
  const inactive = subscriptions.filter((s) => s.status !== "active").length;
  const filteredSubscriptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return subscriptions.filter((subscription) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? subscription.status === "active" : subscription.status !== "active");
      if (!matchesStatus) return false;

      if (!normalizedQuery) return true;
      const haystack = [
        subscription.provider,
        subscription.status,
        subscription.endpoint,
        subscription.user_agent,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [subscriptions, query, statusFilter]);

  if (sitesLoading || loading) return <div className="loading">Carregando...</div>;
  if (!selectedSiteId) {
    return (
      <div className="page">
        <div className="banner-warn">
          Nenhum site selecionado. Abra <Link href="/sites">Sites</Link> para escolher o site que será
          usado na audiência.
        </div>
      </div>
    );
  }

  return (
    <div className="page animate-in fade-in">
      <section className="page-hero">
        <div className="page-hero-stack">
          <div>
            <span className="eyebrow">Audiência</span>
            <h2 className="page-title">Base de usuários inscritos</h2>
            <p className="page-desc">
              Pesquise endpoints, separe inscrições ativas e acompanhe a saúde da sua audiência com
              uma leitura mais clara para a operação do dia a dia.
            </p>
            <p className="hint" style={{ marginTop: 12 }}>
              Site ativo: <strong>{selectedSite?.nome ?? "Selecionado"}</strong>
            </p>
          </div>
          <div className="hero-badges">
            <div className="hero-chip light">
              <CheckCircle2 size={16} />
              <span>{formatNumber(active)} usuários ativos</span>
            </div>
            <div className="hero-chip light">
              <Filter size={16} />
              <span>{formatNumber(inactive)} usuários inativos ou revogados</span>
            </div>
          </div>
        </div>
        <div className="hero-actions">
          <Link href="/campanhas/nova" className="btn btn-primary">
            <Users size={16} />
            <span>Criar campanha</span>
          </Link>
          <Link href="/integrar" className="btn btn-ghost">
            <CheckCircle2 size={16} />
            <span>Revisar integração</span>
          </Link>
        </div>
      </section>

      {message && <div className="toast toast-error">{message}</div>}

      <section className="metrics">
        <div className="metric-card">
          <div className="metric-card-top">
            <span className="metric-label">Ativos</span>
            <span className="metric-icon">
              <CheckCircle2 size={20} />
            </span>
          </div>
          <span className="metric-value">{formatNumber(metrics?.active_subscriptions ?? active)}</span>
          <p className="metric-trend">Inscrições prontas para novos envios.</p>
        </div>
        <div className="metric-card">
          <div className="metric-card-top">
            <span className="metric-label">Revogados / inativos</span>
            <span className="metric-icon">
              <Filter size={20} />
            </span>
          </div>
          <span className="metric-value">{formatNumber(metrics?.unregistered_subscriptions ?? inactive)}</span>
          <p className="metric-trend">Assinaturas limpas automaticamente pelo worker.</p>
        </div>
        <div className="metric-card">
          <div className="metric-card-top">
            <span className="metric-label">Total listado</span>
            <span className="metric-icon">
              <Users size={20} />
            </span>
          </div>
          <span className="metric-value">{formatNumber(subscriptions.length)}</span>
          <p className="metric-trend">Entradas retornadas pelo endpoint de inscrições.</p>
        </div>
      </section>

      {active === 0 && (
        <div className="banner-warn">
          Nenhum inscrito ativo no momento. Revise a instalação do script e conclua o teste de
          inscrição antes de iniciar campanhas.
        </div>
      )}

      <section className="panel">
        <div className="section-heading">
          <Users size={20} />
          <div className="section-heading-text">
            <h3>Inscrições</h3>
            <p>Busca rápida por endpoint, provider ou user-agent.</p>
          </div>
        </div>

        <div className="toolbar">
          <div className="toolbar-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Pesquisar por endpoint, provider ou user-agent"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <button
              type="button"
              className={`filter-chip${statusFilter === "all" ? " active" : ""}`}
              onClick={() => setStatusFilter("all")}
            >
              <Filter size={14} />
              <span>Todos</span>
            </button>
            <button
              type="button"
              className={`filter-chip${statusFilter === "active" ? " active" : ""}`}
              onClick={() => setStatusFilter("active")}
            >
              <CheckCircle2 size={14} />
              <span>Ativos</span>
            </button>
            <button
              type="button"
              className={`filter-chip${statusFilter === "inactive" ? " active" : ""}`}
              onClick={() => setStatusFilter("inactive")}
            >
              <Filter size={14} />
              <span>Inativos</span>
            </button>
          </div>
        </div>

        {filteredSubscriptions.length === 0 ? (
          <p className="empty">Nenhuma inscrição registrada ainda.</p>
        ) : (
          <>
            <div className="audience-desktop-table">
              <table className="table">
                <thead>
                  <tr>
                    <th>Provider</th>
                    <th>Status</th>
                    <th>Endpoint</th>
                    <th>Dispositivo</th>
                    <th>Desde</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubscriptions.map((s) => {
                    const device = inferDeviceLabel(s.user_agent);
                    const DeviceIcon = device === "Desktop" ? Monitor : Smartphone;
                    return (
                      <tr key={s.id}>
                        <td>
                          <div className="device-pill">
                            <Globe size={14} />
                            <span>{s.provider}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`badge badge-${s.status === "active" ? "finished" : "draft"}`}>
                            {s.status === "active" ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                        <td className="endpoint-cell" title={s.endpoint}>
                          {truncate(s.endpoint)}
                        </td>
                        <td>
                          <div className="device-pill">
                            <DeviceIcon size={14} />
                            <span>{device}</span>
                          </div>
                        </td>
                        <td>{new Date(s.criado_em).toLocaleString("pt-BR")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="audience-mobile-list">
              {filteredSubscriptions.map((s) => {
                const device = inferDeviceLabel(s.user_agent);
                const DeviceIcon = device === "Desktop" ? Monitor : Smartphone;
                return (
                  <article key={s.id} className="audience-card">
                    <div className="audience-card-top">
                      <div className="device-pill">
                        <Globe size={14} />
                        <span>{s.provider}</span>
                      </div>
                      <span className={`badge badge-${s.status === "active" ? "finished" : "draft"}`}>
                        {s.status === "active" ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                    <div className="audience-card-row">
                      <span>Endpoint</span>
                      <strong title={s.endpoint}>{truncate(s.endpoint, 72)}</strong>
                    </div>
                    <div className="audience-card-meta">
                      <div className="device-pill">
                        <DeviceIcon size={14} />
                        <span>{device}</span>
                      </div>
                      <span className="table-muted">{new Date(s.criado_em).toLocaleString("pt-BR")}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
