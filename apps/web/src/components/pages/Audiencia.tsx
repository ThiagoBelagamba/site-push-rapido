"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Filter,
  Globe,
  Monitor,
  Search,
  Smartphone,
  RotateCcw,
  Trash2,
  Users,
} from "lucide-react";
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

function formatProviderLabel(provider: string) {
  if (provider === "apple") return "Apple (iOS/PWA)";
  if (provider === "google") return "Google (FCM)";
  if (provider === "mozilla") return "Mozilla";
  return provider;
}

function formatStatusLabel(status: string) {
  if (status === "active") return "Ativo";
  if (status === "unregistered") return "Revogado";
  return "Inativo";
}

export default function Audiencia() {
  const { selectedSite, selectedSiteId, loading: sitesLoading } = useSiteContext();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"ok" | "err">("ok");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);
  const [purging, setPurging] = useState<"inactive" | "all" | null>(null);
  const [reactivatingBulk, setReactivatingBulk] = useState(false);
  const actionBusy = !!removingId || !!reactivatingId || !!purging || reactivatingBulk;

  const refresh = useCallback(async () => {
    if (!selectedSiteId) {
      setMetrics(null);
      setSubscriptions([]);
      setMessage("");
      setLoading(false);
      return;
    }
    setLoading(true);
    const results = await Promise.allSettled([api.getMetrics(), api.getSubscriptions()]);
    const [mRes, sRes] = results;
    if (mRes.status === "fulfilled") setMetrics(mRes.value);
    if (sRes.status === "fulfilled") setSubscriptions(sRes.value.subscriptions);
    const failed = results.find((r) => r.status === "rejected");
    if (failed?.status === "rejected") {
      setMessage(parseApiError(failed.reason));
      setMessageType("err");
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

  async function handleDelete(subscription: Subscription) {
    const ok = confirm(
      "Remover esta inscrição do painel?\n\nO dispositivo deixa de fazer parte da base de envio. Para inscrever de novo, o usuário precisa permitir notificações outra vez no site."
    );
    if (!ok) return;

    setRemovingId(subscription.id);
    setMessage("");
    try {
      await api.deleteSubscription(subscription.id);
      setMessage("Inscrição removida.");
      setMessageType("ok");
      await refresh();
    } catch (err) {
      setMessage(parseApiError(err));
      setMessageType("err");
    } finally {
      setRemovingId(null);
    }
  }

  async function handleReactivate(subscription: Subscription) {
    const ok = confirm(
      "Reativar esta inscrição?\n\nEla voltará a receber campanhas. Se o push falhar de novo, o worker pode marcar como inativa outra vez."
    );
    if (!ok) return;

    setReactivatingId(subscription.id);
    setMessage("");
    try {
      await api.reactivateSubscription(subscription.id);
      setMessage("Inscrição reativada.");
      setMessageType("ok");
      await refresh();
    } catch (err) {
      setMessage(parseApiError(err));
      setMessageType("err");
    } finally {
      setReactivatingId(null);
    }
  }

  async function handleReactivateBulk() {
    if (inactive === 0) {
      setMessage("Não há inscrições inativas para reativar.");
      setMessageType("err");
      return;
    }

    const siteName = selectedSite?.nome ?? "este site";
    if (!confirm(`Reativar ${inactive} inscrição(ões) inativa(s) de "${siteName}"?`)) return;

    setReactivatingBulk(true);
    setMessage("");
    try {
      const res = await api.reactivateSubscriptionsBulk();
      setMessage(
        res.reactivated_count === 1
          ? "1 inscrição reativada."
          : `${res.reactivated_count} inscrições reativadas.`
      );
      setMessageType("ok");
      await refresh();
    } catch (err) {
      setMessage(parseApiError(err));
      setMessageType("err");
    } finally {
      setReactivatingBulk(false);
    }
  }

  async function handlePurge(scope: "inactive" | "all") {
    const count = scope === "inactive" ? inactive : subscriptions.length;
    if (count === 0) {
      setMessage(scope === "inactive" ? "Não há inscrições inativas para remover." : "Não há inscrições para remover.");
      setMessageType("err");
      return;
    }

    const siteName = selectedSite?.nome ?? "este site";
    const firstMessage =
      scope === "inactive"
        ? `Remover ${count} inscrição(ões) inativa(s) de "${siteName}"?`
        : `Remover TODAS as ${count} inscrições de "${siteName}"?\n\nIsso apaga a base inteira e não pode ser desfeito.`;

    if (!confirm(firstMessage)) return;

    if (scope === "all") {
      const typed = prompt(`Digite REMOVER para confirmar a exclusão de todas as inscrições:`);
      if (typed?.trim().toUpperCase() !== "REMOVER") {
        setMessage("Confirmação cancelada.");
        setMessageType("err");
        return;
      }
    }

    setPurging(scope);
    setMessage("");
    try {
      const res = await api.purgeSubscriptions(scope);
      setMessage(
        res.deleted_count === 1
          ? "1 inscrição removida."
          : `${res.deleted_count} inscrições removidas.`
      );
      setMessageType("ok");
      await refresh();
    } catch (err) {
      setMessage(parseApiError(err));
      setMessageType("err");
    } finally {
      setPurging(null);
    }
  }

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
              Pesquise endpoints, remova testes e gerencie quem recebe campanhas neste site.
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

      {message ? (
        <div className={`toast ${messageType === "err" ? "toast-error" : ""}`}>{message}</div>
      ) : null}

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
            <p>Busca, remoção individual ou limpeza em lote (inativos ou todas).</p>
          </div>
        </div>

        {subscriptions.length > 0 ? (
          <div className="audience-bulk-actions">
            <button
              type="button"
              className="btn btn-success btn-sm"
              disabled={actionBusy || inactive === 0}
              onClick={() => void handleReactivateBulk()}
            >
              <RotateCcw size={14} />
              <span>{reactivatingBulk ? "Reativando..." : `Reativar inativos (${inactive})`}</span>
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={actionBusy || inactive === 0}
              onClick={() => void handlePurge("inactive")}
            >
              <Trash2 size={14} />
              <span>{purging === "inactive" ? "Removendo..." : `Remover inativos (${inactive})`}</span>
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              disabled={actionBusy}
              onClick={() => void handlePurge("all")}
            >
              <Trash2 size={14} />
              <span>{purging === "all" ? "Removendo..." : `Remover todas (${subscriptions.length})`}</span>
            </button>
          </div>
        ) : null}

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
          <p className="empty">Nenhuma inscrição encontrada com os filtros atuais.</p>
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
                    <th aria-label="Ações" />
                  </tr>
                </thead>
                <tbody>
                  {filteredSubscriptions.map((s) => {
                    const device = inferDeviceLabel(s.user_agent);
                    const DeviceIcon = device === "Desktop" ? Monitor : Smartphone;
                    const isRemoving = removingId === s.id;
                    const isReactivating = reactivatingId === s.id;
                    const isInactive = s.status !== "active";
                    return (
                      <tr key={s.id}>
                        <td>
                          <div className="device-pill">
                            <Globe size={14} />
                            <span>{formatProviderLabel(s.provider)}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`badge badge-${s.status === "active" ? "finished" : "draft"}`}>
                            {formatStatusLabel(s.status)}
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
                        <td className="table-actions">
                          {isInactive ? (
                            <button
                              type="button"
                              className="btn btn-success btn-sm btn-icon-only"
                              title="Reativar inscrição"
                              disabled={actionBusy}
                              onClick={() => void handleReactivate(s)}
                            >
                              <RotateCcw size={14} />
                              <span className="sr-only">{isReactivating ? "Reativando" : "Reativar"}</span>
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm btn-icon-only"
                            title="Remover inscrição"
                            disabled={actionBusy}
                            onClick={() => void handleDelete(s)}
                          >
                            <Trash2 size={14} />
                            <span className="sr-only">{isRemoving ? "Removendo" : "Remover"}</span>
                          </button>
                        </td>
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
                const isRemoving = removingId === s.id;
                const isReactivating = reactivatingId === s.id;
                const isInactive = s.status !== "active";
                return (
                  <article key={s.id} className="audience-card">
                    <div className="audience-card-top">
                      <div className="device-pill">
                        <Globe size={14} />
                        <span>{formatProviderLabel(s.provider)}</span>
                      </div>
                      <span className={`badge badge-${s.status === "active" ? "finished" : "draft"}`}>
                        {formatStatusLabel(s.status)}
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
                    <div className="audience-card-actions">
                      {isInactive ? (
                        <button
                          type="button"
                          className="btn btn-success btn-sm"
                          disabled={actionBusy}
                          onClick={() => void handleReactivate(s)}
                        >
                          <RotateCcw size={14} />
                          <span>{isReactivating ? "Reativando..." : "Reativar"}</span>
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={actionBusy}
                        onClick={() => void handleDelete(s)}
                      >
                        <Trash2 size={14} />
                        <span>{isRemoving ? "Removendo..." : "Remover"}</span>
                      </button>
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
