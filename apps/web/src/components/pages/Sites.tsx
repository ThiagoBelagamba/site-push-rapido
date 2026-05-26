"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, Plus, Settings } from "lucide-react";
import { api, parseApiError, SiteConfig, SiteInput } from "@/lib/api";
import { useSiteContext } from "@/components/SiteProvider";

function emptyForm(): SiteInput {
  return {
    nome: "",
    url_origem: "",
  };
}

export default function Sites() {
  const router = useRouter();
  const { sites, selectedSiteId, selectSite, refreshSites, loading: loadingSites, error } =
    useSiteContext();
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [form, setForm] = useState<SiteInput>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"ok" | "err">("ok");

  const activeSite = useMemo(
    () => sites.find((site) => String(site.id) === selectedSiteId) ?? null,
    [selectedSiteId, sites]
  );

  useEffect(() => {
    if (!sites.length) {
      setEditingSiteId(null);
      setForm(emptyForm());
      return;
    }

    if (editingSiteId) return;
    if (activeSite) {
      setEditingSiteId(String(activeSite.id));
      void api
        .getSite(activeSite.id)
        .then((site) => {
          setForm({
            nome: site.nome,
            url_origem: site.url_origem,
            slug: site.slug,
            icone_padrao_url: site.icone_padrao_url ?? undefined,
            configurado: site.configurado,
            auto_resubscribe: site.auto_resubscribe,
            allow_localhost_http: site.allow_localhost_http,
            service_worker_path: site.service_worker_path,
            service_worker_scope: site.service_worker_scope,
            prompt_config: site.prompt_config,
            welcome_enabled: site.welcome_enabled,
            welcome_titulo: site.welcome_titulo,
            welcome_mensagem: site.welcome_mensagem,
            ativo: site.ativo,
          });
        })
        .catch(() => {
          setForm({
            nome: activeSite.nome,
            url_origem: activeSite.url_origem,
            slug: activeSite.slug,
          });
        });
    }
  }, [activeSite, editingSiteId, sites]);

  async function startEdit(siteId: string | number) {
    try {
      const site = await api.getSite(siteId);
      setEditingSiteId(String(site.id));
      setForm({
        nome: site.nome,
        url_origem: site.url_origem,
        slug: site.slug,
        icone_padrao_url: site.icone_padrao_url ?? undefined,
        configurado: site.configurado,
        auto_resubscribe: site.auto_resubscribe,
        allow_localhost_http: site.allow_localhost_http,
        service_worker_path: site.service_worker_path,
        service_worker_scope: site.service_worker_scope,
        prompt_config: site.prompt_config,
        welcome_enabled: site.welcome_enabled,
        welcome_titulo: site.welcome_titulo,
        welcome_mensagem: site.welcome_mensagem,
        ativo: site.ativo,
      });
      setMessage("");
    } catch (err) {
      setMessage(parseApiError(err));
      setMessageType("err");
    }
  }

  function startCreate() {
    setEditingSiteId(null);
    setForm(emptyForm());
    setMessage("");
  }

  async function saveSite() {
    if (!form.nome?.trim() || !form.url_origem?.trim()) {
      setMessage("Informe nome e URL do site.");
      setMessageType("err");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const site: SiteConfig = editingSiteId
        ? await api.updateSite(form, editingSiteId)
        : await api.createSite(form);
      selectSite(site.id);
      await refreshSites();
      setEditingSiteId(String(site.id));
      setMessage(editingSiteId ? "Site atualizado com sucesso." : "Site criado com sucesso.");
      setMessageType("ok");
    } catch (err) {
      setMessage(parseApiError(err));
      setMessageType("err");
    } finally {
      setSaving(false);
    }
  }

  if (loadingSites) return <div className="loading">Carregando...</div>;

  return (
    <div className="page animate-in fade-in">
      <section className="page-hero">
        <div className="page-hero-stack">
          <div>
            <span className="eyebrow">Sites</span>
            <h1 className="page-title">Gerenciar sites conectados</h1>
            <p className="page-desc">
              Cadastre novos domínios, escolha o site ativo do painel e abra a configuração detalhada
              de integração de cada um deles.
            </p>
          </div>
        </div>
        <div className="hero-actions">
          <button type="button" className="btn btn-primary" onClick={startCreate}>
            <Plus size={16} />
            <span>Novo site</span>
          </button>
          {activeSite ? (
            <button type="button" className="btn btn-ghost" onClick={() => router.push("/integrar")}>
              <Settings size={16} />
              <span>Abrir configuração</span>
            </button>
          ) : null}
        </div>
      </section>

      {error ? <div className="toast toast-error">{error}</div> : null}
      {message ? <div className={`toast ${messageType === "err" ? "toast-error" : ""}`}>{message}</div> : null}

      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-heading">
            <Globe size={20} />
            <div className="section-heading-text">
              <h3>Lista de sites</h3>
              <p>Escolha o site que ficará ativo para campanhas, audiência e integração.</p>
            </div>
          </div>

          {sites.length === 0 ? (
            <p className="empty">Nenhum site cadastrado ainda. Crie o primeiro para começar.</p>
          ) : (
            <div className="overview-actions">
              {sites.map((site) => {
                const active = String(site.id) === selectedSiteId;
                return (
                  <button
                    key={site.id}
                    type="button"
                    className="overview-action-card"
                    onClick={() => {
                      selectSite(site.id);
                      void startEdit(site.id);
                    }}
                    style={{ textAlign: "left" }}
                  >
                    <strong>{site.nome}</strong>
                    <span>{site.url_origem}</span>
                    <span>
                      {site.active_subscriptions ?? 0} inscritos ativos · {site.campaign_count ?? 0} campanhas
                    </span>
                    <em>{active ? "Site ativo" : "Selecionar este site"}</em>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="section-heading">
            <Settings size={20} />
            <div className="section-heading-text">
              <h3>{editingSiteId ? "Editar site" : "Cadastrar site"}</h3>
              <p>
                Este cadastro inicial define o domínio e o identificador do site. O restante da
                integração pode ser concluído depois em Configuração Web.
              </p>
            </div>
          </div>

          <div className="form">
            <label>
              <span className="field-label">Nome do site</span>
              <input
                value={form.nome ?? ""}
                onChange={(e) => setForm((current) => ({ ...current, nome: e.target.value }))}
                placeholder="Ex.: Loja Principal"
              />
            </label>

            <label>
              <span className="field-label">URL do site</span>
              <input
                type="url"
                value={form.url_origem ?? ""}
                onChange={(e) => setForm((current) => ({ ...current, url_origem: e.target.value }))}
                placeholder="https://meusite.com"
              />
            </label>

            <label>
              <span className="field-label">Slug interno (opcional)</span>
              <input
                value={form.slug ?? ""}
                onChange={(e) => setForm((current) => ({ ...current, slug: e.target.value }))}
                placeholder="loja-principal"
              />
            </label>

            <div className="form-actions">
              <button type="button" className="btn" onClick={startCreate}>
                Limpar
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void saveSite()} disabled={saving}>
                {saving ? "Salvando..." : editingSiteId ? "Salvar site" : "Criar site"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
