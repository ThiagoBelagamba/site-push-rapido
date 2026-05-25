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
  Clock3,
  MousePointerClick,
  Send,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { api, Metrics, ServicesHealth, SetupStatus, parseApiError } from "@/lib/api";

function formatNumber(value: number | undefined) {
  return new Intl.NumberFormat("pt-BR").format(value ?? 0);
}

function formatPercent(value: number | undefined) {
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value ?? 0)}%`;
}

function MetricCard({
  icon,
  title,
  value,
  trend,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  trend: string;
}) {
  return (
    <div className="metric-card">
      <div className="metric-card-top">
        <span className="metric-label">{title}</span>
        <span className="metric-icon">{icon}</span>
      </div>
      <span className="metric-value">{value}</span>
      <p className="metric-trend">{trend}</p>
    </div>
  );
}

export default function Home() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [setup, setSetup] = useState<SetupStatus | null>(null);
  const [health, setHealth] = useState<ServicesHealth | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, []);

  if (loading) return <div className="loading">Carregando...</div>;

  const completedChecks = setup?.items.filter((item) => item.ok).length ?? 0;
  const totalChecks = setup?.items.length ?? 0;
  const pendingChecks = setup?.items.filter((item) => !item.ok) ?? [];
  const lastCampaign = metrics?.last_campaign;
  const activeSubscriptions = metrics?.active_subscriptions ?? setup?.active_subscriptions ?? 0;
  const healthReady = health?.all_ok ?? false;

  const primaryAction = (() => {
    if (!setup?.ready) {
      return {
        eyebrow: "Próximo passo",
        title: "Finalize a integração para liberar campanhas",
        description:
          "Conclua a configuração do site e a instalação do código para começar a captar inscritos e enviar campanhas com segurança.",
        ctaHref: "/integrar",
        ctaLabel: "Concluir integração",
        secondaryHref: "/integrar/codigo",
        secondaryLabel: "Ver instalação do código",
      };
    }

    if (activeSubscriptions === 0) {
      return {
        eyebrow: "Próximo passo",
        title: "Capte os primeiros inscritos ativos",
        description:
          "Seu painel já está pronto, mas ainda não há usuários ativos para receber campanhas. Valide o script no site e teste o fluxo de permissão.",
        ctaHref: "/integrar/codigo",
        ctaLabel: "Revisar instalação",
        secondaryHref: "/audiencia",
        secondaryLabel: "Abrir audiência",
      };
    }

    if (!lastCampaign) {
      return {
        eyebrow: "Próximo passo",
        title: "Crie sua primeira campanha",
        description:
          "A integração está concluída e já existem usuários ativos. Agora vale preparar o primeiro rascunho, enviar um teste e validar a operação.",
        ctaHref: "/campanhas/nova",
        ctaLabel: "Criar campanha",
        secondaryHref: "/audiencia",
        secondaryLabel: "Revisar base ativa",
      };
    }

    return {
      eyebrow: "Operação em andamento",
      title: "Seu canal está pronto para otimização",
      description:
        "Acompanhe a última campanha, compare indicadores e avance para novos envios com base na audiência ativa e na saúde da infraestrutura.",
      ctaHref: "/campanhas",
      ctaLabel: "Ver campanhas",
      secondaryHref: "/campanhas/nova",
      secondaryLabel: "Nova campanha",
    };
  })();

  return (
    <div className="page animate-in fade-in">
      <section className="page-hero">
        <div className="page-hero-stack">
          <div>
            <span className="eyebrow">{primaryAction.eyebrow}</span>
            <h2 className="page-title">{primaryAction.title}</h2>
            <p className="page-desc">
              {primaryAction.description}
            </p>
          </div>
          <div className="hero-badges">
            <div className="hero-chip light">
              <CheckCircle2 size={16} />
              <span>{setup?.ready ? "Integração concluída" : `${pendingChecks.length} pendência(s) no setup`}</span>
            </div>
            <div className="hero-chip light">
              <Users size={16} />
              <span>{formatNumber(activeSubscriptions)} usuários prontos para receber push</span>
            </div>
            <div className="hero-chip light">
              <ShieldCheck size={16} />
              <span>{healthReady ? "Infraestrutura operacional" : "Revisar serviços da plataforma"}</span>
            </div>
          </div>
        </div>
        <div className="hero-actions">
          <Link href={primaryAction.ctaHref} className="btn btn-primary">
            <ArrowRight size={16} />
            <span>{primaryAction.ctaLabel}</span>
          </Link>
          <Link href={primaryAction.secondaryHref} className="btn btn-ghost">
            <Settings size={16} />
            <span>{primaryAction.secondaryLabel}</span>
          </Link>
        </div>
      </section>

      {error && <div className="toast toast-error">{error}</div>}

      <section className="metrics">
        <MetricCard
          icon={<Users size={20} />}
          title="Inscritos ativos"
          value={formatNumber(activeSubscriptions)}
          trend="Base disponível para novos envios"
        />
        <MetricCard
          icon={<Bell size={20} />}
          title="Última taxa de entrega"
          value={formatPercent(metrics?.last_delivery_rate)}
          trend="Qualidade do envio mais recente"
        />
        <MetricCard
          icon={<MousePointerClick size={20} />}
          title="CTR da última campanha"
          value={formatPercent(metrics?.last_ctr)}
          trend="Cliques gerados no último disparo"
        />
        <MetricCard
          icon={<CheckCircle2 size={20} />}
          title="Checklist pronto"
          value={totalChecks > 0 ? `${completedChecks}/${totalChecks}` : "0/0"}
          trend={setup?.ready ? "Integração liberada para campanhas" : "Ainda existem pendências"}
        />
      </section>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-heading">
            <Activity size={20} />
            <div className="section-heading-text">
              <h3>Radar operacional</h3>
              <p>Leitura rápida do que está pronto, do que falta e do que merece atenção imediata.</p>
            </div>
          </div>
          <div className="overview-stack">
            <div className="overview-highlight">
              <div className="overview-highlight-icon">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <strong>{setup?.ready ? "Canal liberado para campanhas" : "Integração ainda não concluída"}</strong>
                <p>
                  {setup?.ready
                    ? "A estrutura principal está pronta. O foco agora é audiência, testes e recorrência de envios."
                    : "Existem pendências que precisam ser resolvidas antes de iniciar envios em produção."}
                </p>
              </div>
            </div>

            <div className="overview-highlight">
              <div className="overview-highlight-icon">
                <Users size={18} />
              </div>
              <div>
                <strong>{formatNumber(activeSubscriptions)} usuários ativos na base</strong>
                <p>
                  {activeSubscriptions > 0
                    ? "Já existe audiência disponível para testes controlados e novos disparos."
                    : "Ainda não há usuários ativos. Priorize a validação do script e da permissão no site."}
                </p>
              </div>
            </div>

            <div className="overview-highlight">
              <div className="overview-highlight-icon">
                <ShieldCheck size={18} />
              </div>
              <div>
                <strong>{healthReady ? "Serviços principais operacionais" : "Infraestrutura precisa de revisão"}</strong>
                <p>{health?.message ?? "API, worker e dependências devem permanecer saudáveis para envio contínuo."}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="section-heading">
            <Clock3 size={20} />
            <div className="section-heading-text">
              <h3>Próximos passos</h3>
              <p>Atalhos orientados pelo estágio atual da operação para avançar sem perder contexto.</p>
            </div>
          </div>

          <div className="overview-actions">
            <Link href={primaryAction.ctaHref} className="overview-action-card">
              <strong>{primaryAction.ctaLabel}</strong>
              <span>{primaryAction.description}</span>
              <em>Abrir agora</em>
            </Link>
            <Link href="/campanhas" className="overview-action-card">
              <strong>Revisar campanhas</strong>
              <span>
                {lastCampaign
                  ? `Última campanha: ${lastCampaign.titulo} com ${formatNumber(lastCampaign.total_entregues)} entregas.`
                  : "Abra a central de campanhas para revisar rascunhos, testes e envios."}
              </span>
              <em>Ir para campanhas</em>
            </Link>
            <Link href="/audiencia" className="overview-action-card">
              <strong>Acompanhar audiência</strong>
              <span>
                Verifique a base ativa, provedores e a evolução das inscrições antes do próximo envio.
              </span>
              <em>Ver audiência</em>
            </Link>
          </div>
        </section>
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-heading">
            <CheckCircle2 size={20} />
            <div className="section-heading-text">
              <h3>Checklist de integração</h3>
              <p>Resumo dos requisitos que impactam diretamente a operação do canal.</p>
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
                      {item.detail && <div className="hint">{item.detail}</div>}
                    </div>
                  </li>
                ))}
              </ul>
              {setup.ready ? (
                <p className="check-success">Tudo pronto para criar, testar e enviar campanhas.</p>
              ) : (
                <p className="hint" style={{ marginTop: 14 }}>
                  Complete os itens pendentes em <Link href="/integrar">Configuração Web</Link> e{" "}
                  <Link href="/integrar/codigo">Instalação do código</Link>.
                </p>
              )}
            </>
          ) : (
            <p className="empty">Não foi possível carregar o checklist.</p>
          )}
        </section>

        <section className="panel">
          <div className="section-heading">
            <BarChart2 size={20} />
            <div className="section-heading-text">
              <h3>Último envio e desempenho</h3>
              <p>Indicadores da campanha mais recente para orientar o próximo disparo.</p>
            </div>
          </div>

          <div className="status-list">
            <div className="status-item">
              <Bell size={18} />
              <div>
                <strong>{lastCampaign?.titulo ?? "Nenhuma campanha finalizada ainda"}</strong>
                <span>
                  {lastCampaign
                    ? `${formatNumber(lastCampaign.total_entregues)} entregues, ${formatNumber(lastCampaign.total_cliques)} cliques e ${formatNumber(lastCampaign.total_alvo)} usuários impactados no último envio.`
                    : "Quando a primeira campanha for finalizada, os principais indicadores aparecem aqui."}
                </span>
              </div>
            </div>
            <div className="status-item">
              <MousePointerClick size={18} />
              <div>
                <strong>CTR atual: {formatPercent(metrics?.last_ctr)}</strong>
                <span>Use esse indicador para revisar mensagem, segmentação e destino do clique.</span>
              </div>
            </div>
            <div className="status-item">
              <Send size={18} />
              <div>
                <strong>Taxa de entrega: {formatPercent(metrics?.last_delivery_rate)}</strong>
                <span>Quedas aqui normalmente pedem revisão da base, do worker ou do estado da infraestrutura.</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="quick-links">
        <Link href="/campanhas/nova" className="quick-card">
          <div className="quick-card-copy">
            <strong>Nova campanha</strong>
            <span>Crie um novo rascunho com preview por plataforma, teste e revisão de envio.</span>
          </div>
          <span className="quick-card-icon">
            <Send size={20} />
          </span>
        </Link>
        <Link href="/audiencia" className="quick-card">
          <div className="quick-card-copy">
            <strong>Audiência</strong>
            <span>Veja provedores, status das inscrições e o volume total da lista.</span>
          </div>
          <span className="quick-card-icon">
            <Users size={20} />
          </span>
        </Link>
        <Link href="/integrar" className="quick-card">
          <div className="quick-card-copy">
            <strong>Configuração Web</strong>
            <span>Revise o site, o prompt de permissão e o código de instalação.</span>
          </div>
          <span className="quick-card-icon">
            <Settings size={20} />
          </span>
        </Link>
        <Link href="/integrar/codigo" className="quick-card">
          <div className="quick-card-copy">
            <strong>Instalação do código</strong>
            <span>Baixe o service worker e copie o snippet pronto para o site.</span>
          </div>
          <span className="quick-card-icon">
            <ChevronRight size={20} />
          </span>
        </Link>
      </section>
    </div>
  );
}
