"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart2,
  Bell,
  CheckCircle2,
  ChevronRight,
  MousePointerClick,
  Send,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { api, Metrics, ServicesHealth, SetupStatus, parseApiError } from "@/lib/api";
import { useSiteContext } from "@/components/SiteProvider";

function formatNumber(value: number | undefined) {
  return new Intl.NumberFormat("pt-BR").format(value ?? 0);
}

function formatPercent(value: number | undefined) {
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value ?? 0)}%`;
}

function StatCard({ icon, title, value }: { icon: ReactNode; title: string; value: string }) {
  return (
    <div className="ui-stat-card">
      <div className="ui-stat-card-top">
        <span className="ui-stat-label">{title}</span>
        <span className="ui-stat-icon">{icon}</span>
      </div>
      <span className="ui-stat-value">{value}</span>
    </div>
  );
}

export default function Home() {
  const { selectedSiteId, loading: sitesLoading } = useSiteContext();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [setup, setSetup] = useState<SetupStatus | null>(null);
  const [health, setHealth] = useState<ServicesHealth | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedSiteId) {
      setMetrics(null);
      setSetup(null);
      setHealth(null);
      setError("");
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.allSettled([api.getMetrics(), api.getSetupStatus(), api.getServicesHealth()]).then((results) => {
      const [mRes, sRes, hRes] = results;
      if (mRes.status === "fulfilled") setMetrics(mRes.value);
      if (sRes.status === "fulfilled") setSetup(sRes.value);
      if (hRes.status === "fulfilled") setHealth(hRes.value);

      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        setError(
          failed
            .map((r) => (r.status === "rejected" ? parseApiError(r.reason) : ""))
            .filter(Boolean)
            .join(" · ")
        );
      }
      setLoading(false);
    });
  }, [selectedSiteId]);

  if (sitesLoading || loading) return <div className="ui-loading">Carregando...</div>;
  if (!selectedSiteId) {
    return (
      <div className="ui-page ui-empty">
        <div className="banner-warn">
          Nenhum site selecionado. Abra <Link href="/sites">Sites</Link> para criar ou escolher um site.
        </div>
      </div>
    );
  }

  const completedChecks = setup?.items.filter((item) => item.ok).length ?? 0;
  const totalChecks = setup?.items.length ?? 0;
  const pendingChecks = setup?.items.filter((item) => !item.ok) ?? [];
  const lastCampaign = metrics?.last_campaign;
  const activeSubscriptions = metrics?.active_subscriptions ?? setup?.active_subscriptions ?? 0;
  const healthReady = health?.all_ok ?? false;

  const primaryAction = (() => {
    if (!setup?.ready) {
      return {
        title: "Finalize a integração",
        ctaHref: "/integrar",
        ctaLabel: "Configuração Web",
        secondaryHref: "/integrar?aba=dispositivos",
        secondaryLabel: "Testar no celular",
      };
    }
    if (activeSubscriptions === 0) {
      return {
        title: "Capte inscritos",
        ctaHref: "/integrar?aba=dispositivos",
        ctaLabel: "Testar no celular",
        secondaryHref: "/integrar/codigo",
        secondaryLabel: "Ver código",
      };
    }
    if (!lastCampaign) {
      return {
        title: "Crie sua primeira campanha",
        ctaHref: "/campanhas/nova",
        ctaLabel: "Nova Push",
        secondaryHref: "/audiencia",
        secondaryLabel: "Ver audiência",
      };
    }
    return {
      title: "Canal operacional",
      ctaHref: "/campanhas",
      ctaLabel: "Ver campanhas",
      secondaryHref: "/campanhas/nova",
      secondaryLabel: "Nova Push",
    };
  })();

  return (
    <div className="ui-page ui-page-wide animate-in fade-in">
      <header className="ui-header">
        <h1 className="ui-title">Visão Geral</h1>
        <div className="ui-header-actions">
          <Link href={primaryAction.ctaHref} className="btn btn-primary">
            <ArrowRight size={16} />
            <span>{primaryAction.ctaLabel}</span>
          </Link>
          <Link href={primaryAction.secondaryHref} className="btn btn-ghost">
            <span>{primaryAction.secondaryLabel}</span>
          </Link>
        </div>
      </header>

      <div className="ui-summary">
        <div className="ui-chip">
          <CheckCircle2 size={16} />
          <span>{primaryAction.title}</span>
        </div>
        <div className="ui-chip">
          <Users size={16} />
          <span>{formatNumber(activeSubscriptions)} ativos</span>
        </div>
        <div className="ui-chip">
          <ShieldCheck size={16} />
          <span>{healthReady ? "Infra OK" : "Revisar infra"}</span>
        </div>
        {!setup?.ready ? (
          <div className="ui-chip">
            <Settings size={16} />
            <span>{pendingChecks.length} pendência(s)</span>
          </div>
        ) : null}
      </div>

      {error ? <div className="toast toast-error">{error}</div> : null}

      <div className="ui-stat-grid">
        <StatCard icon={<Users size={20} />} title="Inscritos ativos" value={formatNumber(activeSubscriptions)} />
        <StatCard icon={<Bell size={20} />} title="Taxa de entrega" value={formatPercent(metrics?.last_delivery_rate)} />
        <StatCard icon={<MousePointerClick size={20} />} title="CTR última campanha" value={formatPercent(metrics?.last_ctr)} />
        <StatCard
          icon={<CheckCircle2 size={20} />}
          title="Checklist"
          value={totalChecks > 0 ? `${completedChecks}/${totalChecks}` : "0/0"}
        />
      </div>

      <div className="ui-dashboard-grid">
        <section className="ui-section">
          <div className="ui-section-heading">
            <Activity size={20} />
            <div>
              <h3>Status</h3>
            </div>
          </div>
          <div className="ui-list-stack">
            <div className="ui-list-item">
              <CheckCircle2 size={18} />
              <div>
                <strong>{setup?.ready ? "Integração concluída" : "Integração pendente"}</strong>
                <span>
                  {setup?.ready
                    ? "Pronto para campanhas."
                    : `${pendingChecks.length} item(ns) pendente(s).`}
                </span>
              </div>
            </div>
            <div className="ui-list-item">
              <Users size={18} />
              <div>
                <strong>{formatNumber(activeSubscriptions)} inscritos ativos</strong>
                <span>{activeSubscriptions > 0 ? "Base disponível para envio." : "Nenhum inscrito ainda."}</span>
              </div>
            </div>
            <div className="ui-list-item">
              <ShieldCheck size={18} />
              <div>
                <strong>{healthReady ? "Serviços operacionais" : "Infra com alerta"}</strong>
                <span>{health?.message ?? "API e worker devem estar saudáveis."}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="ui-section">
          <div className="ui-section-heading">
            <BarChart2 size={20} />
            <div>
              <h3>Último envio</h3>
            </div>
          </div>
          {lastCampaign ? (
            <div className="ui-list-stack">
              <div className="ui-list-item">
                <Bell size={18} />
                <div>
                  <strong>{lastCampaign.titulo}</strong>
                  <span>
                    {formatNumber(lastCampaign.total_entregues)} entregues · {formatNumber(lastCampaign.total_cliques)}{" "}
                    cliques
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="empty">Nenhuma campanha enviada ainda.</p>
          )}
        </section>
      </div>

      <section className="ui-section">
        <div className="ui-section-heading">
          <CheckCircle2 size={20} />
          <div>
            <h3>Checklist</h3>
          </div>
        </div>
        {setup ? (
          <>
            <ul className="checklist">
              {setup.items.map((item) => (
                <li key={item.id} className={item.ok ? "check-ok" : "check-fail"}>
                  <span className="check-icon">{item.ok ? "✓" : "○"}</span>
                  <div>
                    <strong>{item.label}</strong>
                    {item.detail ? <div className="hint">{item.detail}</div> : null}
                  </div>
                </li>
              ))}
            </ul>
            {setup.ready ? (
              <p className="check-success">Pronto para enviar campanhas.</p>
            ) : (
              <p className="hint" style={{ marginTop: 12 }}>
                Pendências em <Link href="/integrar">Configuração Web</Link>.
              </p>
            )}
          </>
        ) : (
          <p className="empty">Checklist indisponível.</p>
        )}
      </section>

      <div className="ui-quick-grid">
        <Link href="/campanhas/nova" className="ui-quick-card">
          <strong>Nova Push</strong>
          <span className="ui-quick-card-icon">
            <Send size={20} />
          </span>
        </Link>
        <Link href="/audiencia" className="ui-quick-card">
          <strong>Base de usuários</strong>
          <span className="ui-quick-card-icon">
            <Users size={20} />
          </span>
        </Link>
        <Link href="/integrar" className="ui-quick-card">
          <strong>Configuração Web</strong>
          <span className="ui-quick-card-icon">
            <Settings size={20} />
          </span>
        </Link>
        <Link href="/integrar/codigo" className="ui-quick-card">
          <strong>Código de instalação</strong>
          <span className="ui-quick-card-icon">
            <ChevronRight size={20} />
          </span>
        </Link>
      </div>
    </div>
  );
}
