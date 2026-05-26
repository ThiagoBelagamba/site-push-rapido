"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Apple,
  Bell,
  Edit2,
  Globe,
  Image as ImageIcon,
  Monitor,
  Plus,
  Search,
  Send,
  Smartphone,
  Users,
} from "lucide-react";
import { api, Campaign, Metrics, ServicesHealth, SiteConfig, STATUS_LABELS, parseApiError } from "@/lib/api";
import { useSiteContext } from "@/components/SiteProvider";

function statusLabel(status: string) {
  return STATUS_LABELS[status] ?? status;
}

function formatNumber(value: number | undefined) {
  return new Intl.NumberFormat("pt-BR").format(value ?? 0);
}

function formatDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function latestCampaignTimestamp(c: Campaign) {
  return c.finalizado_em || c.iniciado_em || c.criado_em;
}

function isSentLike(status: string) {
  return status !== "draft";
}

function campaignTone(status: string) {
  if (status === "finished") return "finished";
  if (status === "queued" || status === "processing" || status === "skipped") return status;
  if (status === "failed") return "failed";
  return "draft";
}

export default function Campanhas() {
  const { selectedSite, selectedSiteId, loading: sitesLoading } = useSiteContext();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isComposer = pathname === "/campanhas/nova";
  const editQueryId = searchParams.get("edit");

  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [site, setSite] = useState<SiteConfig | null>(null);
  const [health, setHealth] = useState<ServicesHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"ok" | "err">("ok");
  const [activeTab, setActiveTab] = useState<"sent" | "drafts">("sent");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [hydratedEditId, setHydratedEditId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [urlDestino, setUrlDestino] = useState("");
  const [iconeUrl, setIconeUrl] = useState("");
  const [showSendModal, setShowSendModal] = useState(false);
  const [pendingSendId, setPendingSendId] = useState<string | null>(null);
  const [previewOS, setPreviewOS] = useState<"mac" | "windows" | "android">("mac");
  const [search, setSearch] = useState("");

  const showMsg = (text: string, type: "ok" | "err" = "ok") => {
    setMessage(text);
    setMessageType(type);
  };

  const resetForm = useCallback(() => {
    setEditingId(null);
    setHydratedEditId(null);
    setTitulo("");
    setMensagem("");
    setUrlDestino(site?.url_origem ?? "");
    setIconeUrl(site?.icone_padrao_url ?? "");
  }, [site?.icone_padrao_url, site?.url_origem]);

  const refresh = useCallback(async () => {
    if (!selectedSiteId) {
      setMetrics(null);
      setCampaigns([]);
      setSite(null);
      setHealth(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const results = await Promise.allSettled([
      api.getMetrics(),
      api.getCampaigns(),
      api.getSite(),
      api.getServicesHealth(),
    ]);
    const [mRes, cRes, sRes, hRes] = results;
    const authFailed = results.some(
      (r) =>
        r.status === "rejected" &&
        r.reason instanceof Error &&
        (r.reason.message === "Sessão expirada" || r.reason.message === "Não autorizado")
    );
    if (authFailed) return;

    if (mRes.status === "fulfilled") setMetrics(mRes.value);
    if (cRes.status === "fulfilled") setCampaigns(cRes.value.campaigns);
    if (sRes.status === "fulfilled") {
      const nextSite = sRes.value;
      setSite(nextSite);
      if (!iconeUrl && nextSite.icone_padrao_url) setIconeUrl(nextSite.icone_padrao_url);
      if (!urlDestino) {
        setUrlDestino(nextSite.url_origem || urlDestino);
      }
    }
    if (hRes.status === "fulfilled") setHealth(hRes.value);
    else if (hRes.status === "rejected") console.warn("health:", hRes.reason);

    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      const first = failed[0];
      showMsg(first.status === "rejected" ? parseApiError(first.reason) : "Erro ao carregar", "err");
    }
    setLoading(false);
  }, [iconeUrl, selectedSiteId, urlDestino]);

  useEffect(() => {
    refresh();
    if (isComposer) return;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [isComposer, refresh]);

  useEffect(() => {
    if (!editQueryId) {
      resetForm();
    }
  }, [editQueryId, resetForm, selectedSiteId]);

  useEffect(() => {
    if (!isComposer) return;

    if (!editQueryId) {
      if (hydratedEditId) resetForm();
      return;
    }

    if (hydratedEditId === editQueryId) return;

    const match = campaigns.find((campaign) => campaign.id === editQueryId);
    if (!match) return;

    setEditingId(match.id);
    setHydratedEditId(match.id);
    setTitulo(match.titulo);
    setMensagem(match.mensagem);
    setUrlDestino(match.url_destino);
    setIconeUrl(match.icone_url ?? site?.icone_padrao_url ?? "");
  }, [campaigns, editQueryId, hydratedEditId, isComposer, resetForm, site?.icone_padrao_url]);

  const activeCount = metrics?.active_subscriptions ?? 0;
  const sentCount = campaigns.filter((campaign) => isSentLike(campaign.status)).length;
  const draftCount = campaigns.filter((campaign) => campaign.status === "draft").length;
  const previewIcon = iconeUrl || site?.icone_padrao_url || "/assets/icon.svg";
  const previewDomain = site?.url_origem?.replace(/^https?:\/\//, "") ?? "seu-site.com";
  const previewTitle = titulo || "Título da Mensagem";
  const previewMessage = mensagem || "Este é o corpo da mensagem que vai aparecer para os usuários.";
  const filteredCampaigns = useMemo(() => {
    const base = campaigns.filter((campaign) =>
      activeTab === "sent" ? isSentLike(campaign.status) : campaign.status === "draft"
    );
    const searchTerm = search.trim().toLowerCase();
    if (!searchTerm) return base;
    return base.filter((campaign) => {
      const haystack = `${campaign.titulo} ${campaign.mensagem}`.toLowerCase();
      return haystack.includes(searchTerm);
    });
  }, [activeTab, campaigns, search]);

  async function persistCampaign() {
    if (!titulo.trim() || !mensagem.trim()) {
      showMsg("Preencha título e mensagem", "err");
      return false;
    }

    try {
      const body = {
        titulo,
        mensagem,
        url_destino: urlDestino,
        icone_url: iconeUrl || undefined,
      };

      if (editingId) {
        await api.updateCampaign(editingId, body);
        showMsg("Rascunho salvo com sucesso.");
        await refresh();
        return true;
      }

      const { id } = await api.createCampaign(body);
      setEditingId(id);
      setHydratedEditId(id);
      showMsg("Rascunho criado com sucesso.");
      router.replace(`/campanhas/nova?edit=${id}`);
      await refresh();
      return true;
    } catch (err) {
      showMsg(parseApiError(err), "err");
      return false;
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    await persistCampaign();
  }

  async function handleTest(targetId?: string) {
    const id = targetId ?? editingId;
    if (!id) {
      showMsg("Salve o rascunho antes de enviar teste", "err");
      return;
    }

    try {
      await api.testCampaign(id);
      showMsg("Notificação de teste enviada! Verifique o navegador.");
    } catch (err) {
      showMsg(parseApiError(err), "err");
    }
  }

  function openSendModal(id: string) {
    if (activeCount === 0) {
      showMsg("Nenhum inscrito ativo. Abra o site integrado e aceite as notificações primeiro.", "err");
      return;
    }
    setPendingSendId(id);
    setShowSendModal(true);
  }

  async function confirmSend() {
    if (!pendingSendId) return;
    setShowSendModal(false);
    try {
      const res = await api.sendCampaign(pendingSendId);
      showMsg(`Campanha enfileirada para ${res.total_alvo} inscrito(s). Tempo estimado: ~${res.estimated_seconds}s`);
      await refresh();
      router.push("/campanhas");
    } catch (err) {
      showMsg(parseApiError(err), "err");
    }
    setPendingSendId(null);
  }

  function openComposer(editId?: string) {
    if (editId) {
      router.push(`/campanhas/nova?edit=${editId}`);
      return;
    }
    resetForm();
    router.push("/campanhas/nova");
  }

  function goBackToMessages() {
    router.push("/campanhas");
  }

  if (sitesLoading || loading) return <div className="loading">Carregando...</div>;
  if (!selectedSiteId) {
    return (
      <div className="page">
        <div className="banner-warn">
          Nenhum site selecionado. Abra <a href="/sites">Sites</a> para escolher o site que receberá
          as campanhas.
        </div>
      </div>
    );
  }

  return (
    <div className="page animate-in fade-in">
      {health && !health.all_ok && (
        <div className="banner-error">
          {health.message ?? "Alguns serviços essenciais estão indisponíveis. Revise a infraestrutura antes de disparar campanhas."}
        </div>
      )}

      {message && <div className={`toast ${messageType === "err" ? "toast-error" : ""}`}>{message}</div>}

      {!isComposer ? (
        <div>
          <section className="page-hero">
            <div className="page-hero-stack">
              <div>
                <span className="eyebrow">Campanhas</span>
                <h1 className="page-title">Campanhas e jornadas de envio</h1>
                <p className="page-desc">
                  Organize rascunhos, valide testes e acompanhe campanhas enviadas com uma operação
                  mais clara em desktop e mobile.
                </p>
                <p className="hint" style={{ marginTop: 12 }}>
                  Site ativo: <strong>{selectedSite?.nome ?? site?.nome ?? "Selecionado"}</strong>
                </p>
              </div>
              <div className="hero-badges">
                <div className="hero-chip light">
                  <Send size={16} />
                  <span>{formatNumber(sentCount)} campanhas enviadas</span>
                </div>
                <div className="hero-chip light">
                  <Edit2 size={16} />
                  <span>{formatNumber(draftCount)} rascunhos em andamento</span>
                </div>
                <div className="hero-chip light">
                  <Users size={16} />
                  <span>{formatNumber(activeCount)} usuários ativos</span>
                </div>
              </div>
            </div>
            <button type="button" onClick={() => openComposer()} className="btn btn-primary">
              <Plus size={16} />
              <span>Nova campanha</span>
            </button>
          </section>

          <section className="panel panel-table">
            <div className="messages-toolbar">
              <div className="messages-tabs">
                <button
                  type="button"
                  onClick={() => setActiveTab("sent")}
                  className={`messages-tab${activeTab === "sent" ? " active" : ""}`}
                >
                  Enviadas
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("drafts")}
                  className={`messages-tab${activeTab === "drafts" ? " active" : ""}`}
                >
                  Rascunhos
                </button>
              </div>
              <div className="toolbar-search toolbar-search-compact">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Pesquisar por título ou conteúdo"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {filteredCampaigns.length === 0 ? (
              <div className="table-empty">Nenhuma campanha encontrada com os filtros atuais.</div>
            ) : (
              <>
                <div className="messages-desktop-table">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Campanha</th>
                        <th style={{ textAlign: "right" }}>Destinatários</th>
                        <th style={{ textAlign: "right" }}>Entregues</th>
                        <th style={{ textAlign: "right" }}>Cliques</th>
                        <th>Última atualização</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCampaigns.map((campaign) => (
                        <tr key={campaign.id} className="messages-row">
                          <td>
                            <div className="table-title-cell">
                              <span
                                className={`table-title-dot ${isSentLike(campaign.status) ? "success" : "warning"}`}
                                aria-hidden
                              />
                              <div>
                                <div className="table-title table-link">{campaign.titulo}</div>
                                <span className={`badge badge-${campaignTone(campaign.status)}`}>
                                  {statusLabel(campaign.status)}
                                </span>
                                <span className="table-subtitle">{campaign.mensagem}</span>
                              </div>
                            </div>
                          </td>
                          <td style={{ textAlign: "right" }} className="table-number">
                            {campaign.total_alvo > 0 ? formatNumber(campaign.total_alvo) : "-"}
                          </td>
                          <td style={{ textAlign: "right" }} className="table-number">
                            <span>{campaign.total_entregues > 0 ? formatNumber(campaign.total_entregues) : "-"}</span>
                            {campaign.total_entregues > 0 && campaign.total_alvo > 0 ? (
                              <span className="table-muted">
                                {((campaign.total_entregues / campaign.total_alvo) * 100).toFixed(1)}%
                              </span>
                            ) : null}
                          </td>
                          <td style={{ textAlign: "right" }} className="table-number">
                            <span>{campaign.total_cliques > 0 ? formatNumber(campaign.total_cliques) : "-"}</span>
                            {campaign.total_entregues > 0 ? (
                              <span className="table-muted">
                                {((campaign.total_cliques / campaign.total_entregues) * 100).toFixed(1)}%
                              </span>
                            ) : null}
                          </td>
                          <td className="table-muted">{formatDate(latestCampaignTimestamp(campaign))}</td>
                          <td className="table-actions">
                            <button type="button" className="btn btn-sm" onClick={() => openComposer(campaign.id)}>
                              <Edit2 size={14} />
                              <span>Editar</span>
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-ghost"
                              onClick={() => handleTest(campaign.id)}
                            >
                              <Bell size={14} />
                              <span>Teste</span>
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              onClick={() => openSendModal(campaign.id)}
                              disabled={campaign.status === "processing" || campaign.status === "queued"}
                            >
                              <Send size={14} />
                              <span>Enviar</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="messages-mobile-list">
                  {filteredCampaigns.map((campaign) => (
                    <article key={campaign.id} className="message-card">
                      <div className="message-card-top">
                        <div>
                          <h3>{campaign.titulo}</h3>
                          <p>{campaign.mensagem}</p>
                        </div>
                        <span className={`badge badge-${campaignTone(campaign.status)}`}>
                          {statusLabel(campaign.status)}
                        </span>
                      </div>
                      <div className="message-card-stats">
                        <div>
                          <span>Destinatários</span>
                          <strong>{campaign.total_alvo > 0 ? formatNumber(campaign.total_alvo) : "-"}</strong>
                        </div>
                        <div>
                          <span>Entregues</span>
                          <strong>{campaign.total_entregues > 0 ? formatNumber(campaign.total_entregues) : "-"}</strong>
                        </div>
                        <div>
                          <span>Cliques</span>
                          <strong>{campaign.total_cliques > 0 ? formatNumber(campaign.total_cliques) : "-"}</strong>
                        </div>
                      </div>
                      <div className="message-card-footer">
                        <span className="table-muted">Atualizada em {formatDate(latestCampaignTimestamp(campaign))}</span>
                        <div className="message-card-actions">
                          <button type="button" className="btn btn-sm" onClick={() => openComposer(campaign.id)}>
                            <Edit2 size={14} />
                            <span>Editar</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            onClick={() => handleTest(campaign.id)}
                          >
                            <Bell size={14} />
                            <span>Teste</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => openSendModal(campaign.id)}
                            disabled={campaign.status === "processing" || campaign.status === "queued"}
                          >
                            <Send size={14} />
                            <span>Enviar</span>
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      ) : (
        <div>
          <section className="page-hero">
            <div className="page-hero-stack">
              <div>
                <span className="eyebrow">Composer</span>
                <h1 className="page-title">{editingId ? "Editar campanha" : "Nova campanha push"}</h1>
                <p className="page-desc">
                  Monte o conteúdo, valide o destino do clique e salve o rascunho antes de testar ou
                  enviar para a base ativa.
                </p>
                <p className="hint" style={{ marginTop: 12 }}>
                  Site ativo: <strong>{selectedSite?.nome ?? site?.nome ?? "Selecionado"}</strong>
                </p>
              </div>
              <div className="hero-badges">
                <div className="hero-chip light">
                  <Users size={16} />
                  <span>{formatNumber(activeCount)} usuários ativos</span>
                </div>
                <div className="hero-chip light">
                  <Bell size={16} />
                  <span>{editingId ? "Rascunho pronto para revisão" : "Salve para liberar envio e teste"}</span>
                </div>
              </div>
            </div>
            <div className="hero-actions">
              <button type="button" onClick={goBackToMessages} className="btn btn-ghost">
                Voltar para campanhas
              </button>
            </div>
          </section>

          <div className="composer-two-column">
            <div className="composer-main-column">
              <div className="section-card">
                <div className="section-card-header">
                  <h2>1. Audiência</h2>
                </div>
                <div className="section-card-body">
                  <div className="audience-pill">
                    <div className="audience-pill-dot" />
                    <div>
                      <p>Enviar para usuários ativos</p>
                      <span>
                        Aproximadamente {formatNumber(activeCount)} destinatários em{" "}
                        {selectedSite?.nome ?? site?.nome ?? "site ativo"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSave} className="form">
                <div className="section-card">
                  <div className="section-card-header">
                    <h2>2. Mensagem</h2>
                  </div>
                  <div className="section-card-body section-card-stack">
                    <label>
                      <span className="field-label">Título</span>
                      <input
                        type="text"
                        value={titulo}
                        onChange={(e) => setTitulo(e.target.value)}
                        placeholder="Título da Notificação"
                        maxLength={150}
                        required
                      />
                    </label>
                    <label>
                      <span className="field-label">Mensagem</span>
                      <textarea
                        value={mensagem}
                        onChange={(e) => setMensagem(e.target.value)}
                        rows={3}
                        placeholder="Digite o corpo da mensagem..."
                        required
                      />
                    </label>
                    <label>
                      <span className="field-label field-label-inline">
                        <ImageIcon size={14} />
                        <span>URL da Imagem / Ícone (Opcional)</span>
                      </span>
                      <input
                        type="url"
                        value={iconeUrl}
                        onChange={(e) => setIconeUrl(e.target.value)}
                        placeholder={site?.icone_padrao_url || "https://..."}
                      />
                    </label>
                  </div>
                </div>

                <div className="section-card">
                  <div className="section-card-header">
                    <h2>3. Ação ao Clicar</h2>
                  </div>
                  <div className="section-card-body">
                    <label>
                      <span className="field-label">URL de Lançamento</span>
                      <p className="field-help">
                        Para onde o usuário deve ir ao clicar na notificação.
                      </p>
                      <input
                        type="url"
                        value={urlDestino}
                        onChange={(e) => setUrlDestino(e.target.value)}
                        placeholder="https://meusite.com/promocao"
                        required
                      />
                    </label>
                  </div>
                </div>

                <div className="composer-bottom-bar">
                  <button type="button" onClick={goBackToMessages} className="btn btn-ghost">
                    Voltar
                  </button>
                  <button type="submit" className="btn">
                    <Edit2 size={16} />
                    <span>{editingId ? "Salvar alterações" : "Salvar rascunho"}</span>
                  </button>
                  <button type="button" className="btn" onClick={() => handleTest()} disabled={!editingId}>
                    <Bell size={16} />
                    <span>Enviar teste</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => editingId && openSendModal(editingId)}
                    disabled={!editingId || activeCount === 0}
                  >
                    <Send size={16} />
                    <span>Rever e Enviar</span>
                  </button>
                </div>
              </form>
            </div>

            <div className="composer-preview-column">
              <div className="section-card preview-shell">
                <div className="preview-selector">
                  <button
                    type="button"
                    className={`preview-button${previewOS === "mac" ? " active" : ""}`}
                    onClick={() => setPreviewOS("mac")}
                    title="macOS"
                  >
                    <Apple size={16} />
                  </button>
                  <button
                    type="button"
                    className={`preview-button${previewOS === "windows" ? " active" : ""}`}
                    onClick={() => setPreviewOS("windows")}
                    title="Windows"
                  >
                    <Monitor size={16} />
                  </button>
                  <button
                    type="button"
                    className={`preview-button${previewOS === "android" ? " active" : ""}`}
                    onClick={() => setPreviewOS("android")}
                    title="Android"
                  >
                    <Smartphone size={16} />
                  </button>
                </div>

                <div className="preview-stage preview-stage-mock">
                  {previewOS === "mac" ? (
                    <div className="notif-preview notif-preview-mac">
                      <div className="notif-preview-icon-shell">
                        <img
                          src={previewIcon}
                          alt=""
                          className="notif-preview-icon"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      </div>
                      <div className="notif-preview-body">
                        <div className="notif-preview-title">{previewTitle}</div>
                        <div className="notif-preview-msg">{previewMessage}</div>
                        <div className="notif-preview-domain">Google Chrome</div>
                      </div>
                    </div>
                  ) : null}

                  {previewOS === "windows" ? (
                    <div className="notif-preview windows">
                      <div className="notif-preview-domain">Google Chrome • {previewDomain}</div>
                      <div className="notif-preview-row">
                        <div className="notif-preview-body">
                          <div className="notif-preview-title">{previewTitle}</div>
                          <div className="notif-preview-msg">{previewMessage}</div>
                        </div>
                        <div className="notif-preview-icon-shell windows">
                          <Globe size={24} />
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {previewOS === "android" ? (
                    <div className="notif-preview android">
                      <div className="notif-preview-android-top">
                        <div className="notif-preview-android-app">
                          <Bell size={10} />
                        </div>
                        <span>{site?.nome || "Seu site"}</span>
                        <span className="notif-preview-android-time">agora</span>
                      </div>
                      <div className="notif-preview-title">{previewTitle}</div>
                      <div className="notif-preview-msg">{previewMessage}</div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSendModal && (
        <div className="modal-overlay" onClick={() => setShowSendModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h3>Confirmar envio</h3>
            <p>
              Enviar esta campanha para <strong>{formatNumber(activeCount)}</strong> inscrito
              {activeCount !== 1 ? "s" : ""} ativo{activeCount !== 1 ? "s" : ""}?
            </p>
            <p className="hint">Esta ação não pode ser desfeita. Inscritos inativos serão ignorados.</p>
            <div className="form-actions">
              <button type="button" className="btn" onClick={() => setShowSendModal(false)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" onClick={confirmSend}>
                Confirmar envio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
