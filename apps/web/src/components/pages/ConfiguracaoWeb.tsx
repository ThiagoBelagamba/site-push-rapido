"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  CheckCircle2,
  Copy,
  Download,
  Globe,
  Settings,
  Smartphone,
  UploadCloud,
} from "lucide-react";
import { api, PromptConfig, SetupStatus, SiteConfig, SnippetResponse, parseApiError } from "@/lib/api";
import { useSiteContext } from "@/components/SiteProvider";

type SettingsTab = "setup" | "prompt" | "install" | "devices";

const LEGACY_PROMPT_MESSAGE = "Receba alertas importantes direto no seu navegador.";
const PERSONALIZED_PROMPT_MESSAGE =
  "Receba alertas personalizados com novidades, atualizações e ofertas relevantes direto no seu navegador.";

const defaultPrompt: PromptConfig = {
  slidedown: {
    actionMessage: PERSONALIZED_PROMPT_MESSAGE,
    acceptButton: "Permitir",
    cancelButton: "Agora não",
  },
  bell: { tooltip: "Gerenciar notificações" },
  autoPromptDelayMs: 3000,
  mobile: {
    iosInstallTitle: "Instale na Tela de Início (iPhone)",
    iosInstallSteps:
      "Abra este site no Safari.\nToque em Compartilhar.\nEscolha \"Adicionar à Tela de Início\".\nAbra pelo ícone na tela inicial e permita notificações.",
    unsupportedBrowserMessage:
      "No iPhone, use o Safari e adicione o site à Tela de Início. O Chrome no iPhone não suporta notificações push.",
  },
};

function SlidedownPreview({ prompt, compact }: { prompt: PromptConfig; compact?: boolean }) {
  return (
    <div className={`preview-box${compact ? " preview-box-mobile" : ""}`}>
      <strong>Preview do soft prompt</strong>
      <div className="pr-slidedown-preview">
        <p>{prompt.slidedown.actionMessage}</p>
        <div className="preview-actions">
          <button type="button" className="btn btn-sm">
            {prompt.slidedown.cancelButton}
          </button>
          <button type="button" className="btn btn-sm btn-primary">
            {prompt.slidedown.acceptButton}
          </button>
        </div>
      </div>
    </div>
  );
}

function copyText(text: string) {
  return navigator.clipboard.writeText(text);
}

function snippetHelpMessage(err: unknown): string {
  const msg = parseApiError(err);
  if (msg.includes("push/sw.js") || msg.includes("Arquivo não encontrado")) {
    return `${msg} — Verifique se o arquivo do service worker foi gerado corretamente e atualize a API antes de tentar de novo.`;
  }
  if (msg.includes("conectar à API")) return msg;
  return `${msg} — Atualize a API do painel e tente novamente.`;
}

export default function ConfiguracaoWeb({ initialTab = "setup" }: { initialTab?: SettingsTab }) {
  const { selectedSite, selectedSiteId, loading: sitesLoading } = useSiteContext();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"ok" | "err">("ok");

  const [snippet, setSnippet] = useState<SnippetResponse | null>(null);
  const [snippetError, setSnippetError] = useState("");
  const [setup, setSetup] = useState<SetupStatus | null>(null);
  const [setupError, setSetupError] = useState("");

  const [nome, setNome] = useState("Meu site");
  const [urlOrigem, setUrlOrigem] = useState("");
  const [iconeUrl, setIconeUrl] = useState("");
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [iconUploading, setIconUploading] = useState(false);
  const [autoResubscribe, setAutoResubscribe] = useState(true);
  const [allowLocalhost, setAllowLocalhost] = useState(true);
  const [welcomeEnabled, setWelcomeEnabled] = useState(false);
  const [welcomeTitulo, setWelcomeTitulo] = useState("Inscrição confirmada!");
  const [welcomeMensagem, setWelcomeMensagem] = useState(
    "Você passará a receber nossas notificações."
  );
  const [prompt, setPrompt] = useState<PromptConfig>(defaultPrompt);
  const [swPath, setSwPath] = useState("/push/sw.js");
  const [swScope, setSwScope] = useState("/push/");
  const [configurado, setConfigurado] = useState(false);
  const [mobileTested, setMobileTested] = useState(false);

  useEffect(() => {
    const queryTab = searchParams.get("aba");
    if (pathname === "/integrar/codigo") {
      setActiveTab("install");
      return;
    }
    if (queryTab === "prompt") {
      setActiveTab("prompt");
      return;
    }
    if (queryTab === "dispositivos") {
      setActiveTab("devices");
      return;
    }
    setActiveTab(initialTab);
  }, [initialTab, pathname, searchParams]);

  const applySite = useCallback((site: SiteConfig) => {
    const nextPrompt = site.prompt_config || defaultPrompt;
    const normalizedPrompt =
      nextPrompt.slidedown.actionMessage === LEGACY_PROMPT_MESSAGE
        ? {
            ...nextPrompt,
            slidedown: {
              ...nextPrompt.slidedown,
              actionMessage: PERSONALIZED_PROMPT_MESSAGE,
            },
          }
        : nextPrompt;

    setNome(site.nome);
    setUrlOrigem(site.url_origem);
    setIconeUrl(site.icone_padrao_url || "");
    setIconPreview(site.icone_padrao_url || null);
    setAutoResubscribe(site.auto_resubscribe ?? true);
    setAllowLocalhost(site.allow_localhost_http ?? true);
    setWelcomeEnabled(site.welcome_enabled ?? false);
    setWelcomeTitulo(site.welcome_titulo ?? "Inscrição confirmada!");
    setWelcomeMensagem(site.welcome_mensagem ?? "Você passará a receber nossas notificações.");
    setPrompt(normalizedPrompt);
    setSwPath(site.service_worker_path || "/push/sw.js");
    setSwScope(site.service_worker_scope || "/push/");
    setConfigurado(!!site.configurado);
    setMobileTested(!!site.mobile_tested);
  }, []);

  const refresh = useCallback(async () => {
    if (!selectedSiteId) {
      setSnippet(null);
      setSetup(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const results = await Promise.allSettled([api.getSite(), api.getSetupStatus(), api.getSnippet()]);
    const [siteRes, setupRes, snippetRes] = results;

    if (siteRes.status === "fulfilled") {
      applySite(siteRes.value);
    } else {
      setMessage(parseApiError(siteRes.reason));
      setMessageType("err");
    }

    if (setupRes.status === "fulfilled") {
      setSetup(setupRes.value);
      setSetupError("");
    } else {
      setSetup(null);
      setSetupError(parseApiError(setupRes.reason));
    }

    if (snippetRes.status === "fulfilled") {
      setSnippet(snippetRes.value);
      setSnippetError("");
    } else {
      setSnippet(null);
      setSnippetError(snippetHelpMessage(snippetRes.reason));
    }

    setLoading(false);
  }, [applySite, selectedSiteId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const autoPromptEnabled = prompt.autoPromptDelayMs > 0;
  const completedChecks = setup?.items.filter((item) => item.ok).length ?? 0;
  const totalChecks = setup?.items.length ?? 0;
  const nextPendingItem = setup?.items.find((item) => !item.ok) ?? null;
  const originLabel = urlOrigem ? urlOrigem.replace(/^https?:\/\//, "") : "Domínio ainda não informado";

  function goToTab(tab: SettingsTab) {
    setActiveTab(tab);
    if (tab === "install") {
      router.push("/integrar/codigo");
      return;
    }
    if (tab === "prompt") {
      router.push("/integrar?aba=prompt");
      return;
    }
    if (tab === "devices") {
      router.push("/integrar?aba=dispositivos");
      return;
    }
    router.push("/integrar");
  }

  const sitePayload = useMemo(
    () => ({
      nome,
      url_origem: urlOrigem,
      icone_padrao_url: iconeUrl,
      auto_resubscribe: autoResubscribe,
      allow_localhost_http: allowLocalhost,
      prompt_config: prompt,
      service_worker_path: swPath,
      service_worker_scope: swScope,
      welcome_enabled: welcomeEnabled,
      welcome_titulo: welcomeTitulo,
      welcome_mensagem: welcomeMensagem,
      mobile_tested: mobileTested,
    }),
    [
      allowLocalhost,
      autoResubscribe,
      iconeUrl,
      mobileTested,
      nome,
      prompt,
      swPath,
      swScope,
      urlOrigem,
      welcomeEnabled,
      welcomeMensagem,
      welcomeTitulo,
    ]
  );

  const httpsOk = /^https:\/\//i.test(urlOrigem) || /^http:\/\/(localhost|127\.0\.0\.1)/i.test(urlOrigem);

  async function save(
    partial?: Partial<SiteConfig> & { configurado?: boolean },
    successMessage = "Configuração salva."
  ) {
    setSaving(true);
    setMessage("");
    try {
      const site = await api.updateSite({
        ...sitePayload,
        ...partial,
      });
      applySite(site);
      setMessage(successMessage);
      setMessageType("ok");
      await refresh();
      return true;
    } catch (err) {
      setMessage(parseApiError(err));
      setMessageType("err");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleIconUpload(file: File) {
    setIconUploading(true);
    setMessage("");
    setIconPreview(URL.createObjectURL(file));
    try {
      const { icone_padrao_url } = await api.uploadIcon(file);
      setIconeUrl(icone_padrao_url);
      setIconPreview(icone_padrao_url);
      setMessage("Ícone enviado com sucesso!");
      setMessageType("ok");
    } catch (err) {
      setMessage(parseApiError(err));
      setMessageType("err");
    } finally {
      setIconUploading(false);
    }
  }

  function downloadSw() {
    if (!snippet) return;
    const blob = new Blob([snippet.service_worker_content], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = snippet.service_worker_filename;
    a.click();
    URL.revokeObjectURL(url);
    setMessage(`Download: ${snippet.service_worker_filename}`);
    setMessageType("ok");
  }

  async function handleConclude() {
    const ok = await save({ configurado: true }, "Configuração concluída com sucesso.");
    if (ok) router.push("/campanhas");
  }

  if (sitesLoading || loading) return <div className="loading">Carregando...</div>;
  if (!selectedSiteId) {
    return (
      <div className="page">
        <div className="banner-warn">
          Nenhum site selecionado. Abra a tela de Sites para criar ou escolher o site que será
          configurado.
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-primary" onClick={() => router.push("/sites")}>
            Abrir Sites
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page animate-in fade-in">
      <header className="page-header-simple settings-header-flat">
        <div>
          <span className="eyebrow">Configuração</span>
          <h1 className="page-title">Configuração Web</h1>
          <p className="page-desc">
            Configure domínio, prompt de permissão, instalação do SDK e testes em Android e iPhone.
          </p>
          <p className="hint" style={{ marginTop: 12 }}>
            Site ativo: <strong>{selectedSite?.nome ?? nome}</strong>
          </p>
        </div>
        <div className="settings-header-actions">
          {!setup?.ready ? (
            <button type="button" className="btn btn-primary" onClick={() => goToTab("install")}>
              Ver pendências
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => void handleConclude()} disabled={saving}>
              {saving ? "Salvando..." : "Concluir configuração"}
            </button>
          )}
        </div>
      </header>

      {message ? <div className={`toast ${messageType === "err" ? "toast-error" : ""}`}>{message}</div> : null}
      {setupError ? <div className="toast toast-error">{setupError}</div> : null}

      <section className="panel settings-shell">
        <div className="settings-content settings-content-wide">
          <section className="settings-section-shell">
            <div className="settings-section-label">1. Escolha da integração</div>
            <div className="settings-choice-grid">
              <button
                type="button"
                onClick={() => goToTab("setup")}
                className={`settings-choice-card${activeTab === "setup" ? " active" : ""}`}
              >
                <div className="settings-choice-icon">
                  <Globe size={18} />
                </div>
                <div className="settings-choice-copy">
                  <strong>Site padrão</strong>
                  <span>Ideal para a maioria dos sites que precisam configurar domínio, ícone e comportamento base.</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => goToTab("prompt")}
                className={`settings-choice-card${activeTab === "prompt" ? " active" : ""}`}
              >
                <div className="settings-choice-icon">
                  <Bell size={18} />
                </div>
                <div className="settings-choice-copy">
                  <strong>Prompt de permissão</strong>
                  <span>Personalize a mensagem, botões e tempo de disparo do soft prompt antes da permissão nativa.</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => goToTab("install")}
                className={`settings-choice-card${activeTab === "install" ? " active" : ""}`}
              >
                <div className="settings-choice-icon">
                  <Settings size={18} />
                </div>
                <div className="settings-choice-copy">
                  <strong>Código personalizado</strong>
                  <span>Baixe o service worker e copie o snippet do SDK para instalar manualmente no site.</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => goToTab("devices")}
                className={`settings-choice-card${activeTab === "devices" ? " active" : ""}`}
              >
                <div className="settings-choice-icon">
                  <Smartphone size={18} />
                </div>
                <div className="settings-choice-copy">
                  <strong>Dispositivos móveis</strong>
                  <span>Guias para Android (HTTPS) e iPhone (Safari + Tela de Início).</span>
                </div>
              </button>
            </div>
          </section>

          <div className="settings-install-summary settings-summary-inline">
            <div className="hero-chip light">
              <CheckCircle2 size={16} />
              <span>Checklist {completedChecks}/{totalChecks}</span>
            </div>
            <div className="hero-chip light">
              <Settings size={16} />
              <span>{configurado ? "Site configurado" : "Configuração pendente"}</span>
            </div>
            <div className="hero-chip light">
              <Globe size={16} />
              <span>{originLabel}</span>
            </div>
          </div>

          {activeTab === "setup" ? (
            <section className="settings-section-shell">
              <div className="settings-section-label">2. Configuração do site</div>
              <div className="settings-setup-grid">
                <div className="settings-stack">
                  <div className="settings-block">
                    <h3>Nome da aplicação / site</h3>
                    <p>Identifica este site dentro do seu painel.</p>
                    <input value={nome} onChange={(e) => setNome(e.target.value)} />
                  </div>

                  <div className="settings-block">
                    <h3>URL do site</h3>
                    <p>Informe a origem exata onde o script será instalado.</p>
                    <input
                      type="url"
                      value={urlOrigem}
                      onChange={(e) => setUrlOrigem(e.target.value)}
                      placeholder="https://meusite.com"
                    />
                  </div>

                  <div className="settings-block">
                    <h3>Ícone da notificação</h3>
                    <p>
                      Envie um ícone ou use uma URL pública já disponível. Para Safari (Mac) e iPhone,
                      use <strong>PNG 256×256 em HTTPS</strong> — SVG não é exibido nas notificações Apple.
                    </p>
                    <div className="icon-upload-row">
                      <label className="btn btn-ghost settings-upload-button">
                        <UploadCloud size={16} />
                        <span>{iconUploading ? "Enviando..." : "Carregar ícone"}</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp"
                          hidden
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            void handleIconUpload(file);
                          }}
                        />
                      </label>
                      {iconPreview ? <img src={iconPreview} alt="Preview ícone" className="icon-preview" width={64} height={64} /> : null}
                    </div>
                    <input
                      type="url"
                      value={iconeUrl}
                      onChange={(e) => {
                        setIconeUrl(e.target.value);
                        setIconPreview(e.target.value || null);
                      }}
                      placeholder="https://meusite.com/icon.png"
                    />
                  </div>
                </div>

                <aside className="settings-side-card">
                  <h3>Auto Resubscribe</h3>
                  <p>
                    Recomendado para ajudar a recuperar inscrições quando o navegador limpa dados e o
                    usuário retorna ao site.
                  </p>
                  <div className="settings-side-list">
                    <label className="checkbox settings-checkbox">
                      <input
                        type="checkbox"
                        checked={autoResubscribe}
                        onChange={(e) => setAutoResubscribe(e.target.checked)}
                      />
                      <span>Reinscrever automaticamente após limpeza de dados do navegador</span>
                    </label>

                    <label className="checkbox settings-checkbox">
                      <input
                        type="checkbox"
                        checked={allowLocalhost}
                        onChange={(e) => setAllowLocalhost(e.target.checked)}
                      />
                      <span>Permitir HTTP apenas em localhost para testes internos</span>
                    </label>

                    <label className="checkbox settings-checkbox">
                      <input
                        type="checkbox"
                        checked={welcomeEnabled}
                        onChange={(e) => setWelcomeEnabled(e.target.checked)}
                      />
                      <span>Notificação de boas-vindas ao inscrever</span>
                    </label>
                  </div>
                </aside>
              </div>

              {welcomeEnabled ? (
                <div className="settings-grid-two">
                  <div className="settings-block">
                    <h3>Título da mensagem de boas-vindas</h3>
                    <input value={welcomeTitulo} onChange={(e) => setWelcomeTitulo(e.target.value)} />
                  </div>
                  <div className="settings-block">
                    <h3>Mensagem de boas-vindas</h3>
                    <textarea
                      value={welcomeMensagem}
                      onChange={(e) => setWelcomeMensagem(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
              ) : null}

              <div className="settings-actions">
                <button type="button" className="btn btn-primary" onClick={() => void save(undefined, "Alterações salvas.")} disabled={saving}>
                  {saving ? "Salvando..." : "Salvar alterações"}
                </button>
              </div>
            </section>
          ) : null}

          {activeTab === "devices" ? (
            <section className="settings-section-shell">
              <div className="settings-section-label">Testes em dispositivos</div>
              <div className="settings-grid-two">
                <div className="settings-block">
                  <h3>Android (Chrome)</h3>
                  <ul className="checklist checklist-plain">
                    <li>O site deve estar em <strong>HTTPS</strong> no celular (HTTP só funciona em localhost no PC).</li>
                    <li>Peça ao usuário tocar em <strong>Permitir</strong> no soft prompt; evite depender só do prompt automático.</li>
                    <li>Se aparecer &quot;este site não pode pedir permissões&quot;, desative o prompt automático e use o sino.</li>
                    <li>Se bloqueou antes: cadeado do Chrome → Configurações do site → Notificações → Permitir.</li>
                  </ul>
                </div>
                <div className="settings-block">
                  <h3>iPhone (Safari + PWA)</h3>
                  <ul className="checklist checklist-plain">
                    <li><strong>Chrome no iPhone não suporta</strong> push web — use o Safari.</li>
                    <li>O snippet inclui <code>manifest.json</code> (obrigatório no iOS 16.4+).</li>
                    <li>Safari → Compartilhar → Adicionar à Tela de Início.</li>
                    <li>Abra o site pelo ícone na tela inicial e permita notificações.</li>
                    <li>Requer iOS 16.4 ou superior.</li>
                    <li>Após atualizar o service worker no painel, republique o <code>sw.js</code> no site.</li>
                  </ul>
                </div>
                <div className="settings-block">
                  <h3>Mac (Safari)</h3>
                  <ul className="checklist checklist-plain">
                    <li>Use ícone PNG em HTTPS (não SVG).</li>
                    <li>Confira Safari → Ajustes → Sites → Notificações.</li>
                    <li>Se a campanha aparece como entregue mas não visível, inspecione o console do service worker.</li>
                  </ul>
                </div>
              </div>
              {urlOrigem ? (
                <div className="settings-block">
                  <h3>Abrir site para teste</h3>
                  <p className="hint">Use o mesmo domínio configurado no painel.</p>
                  <div className="deploy-url">
                    <a href={urlOrigem} target="_blank" rel="noreferrer">
                      {urlOrigem}
                    </a>
                  </div>
                </div>
              ) : null}
              <label className="checkbox settings-checkbox">
                <input
                  type="checkbox"
                  checked={mobileTested}
                  onChange={(e) => setMobileTested(e.target.checked)}
                />
                <span>Marquei que testei a inscrição em um celular (Android ou iPhone PWA)</span>
              </label>
              <div className="settings-actions">
                <button type="button" className="btn btn-primary" onClick={() => void save(undefined, "Status mobile salvo.")} disabled={saving}>
                  {saving ? "Salvando..." : "Salvar status de teste"}
                </button>
              </div>
            </section>
          ) : null}

          {activeTab === "prompt" ? (
            <section className="settings-section-shell">
              <div className="settings-section-label">3. Prompt de permissão</div>
              <div className="warn">
                O formato do prompt nativo varia por navegador. No celular, o usuário precisa tocar em
                Permitir. Em Android, prefira desligar o prompt automático se o Chrome bloquear permissões.
              </div>

              <label className="checkbox settings-checkbox">
                <input
                  type="checkbox"
                  checked={autoPromptEnabled}
                  onChange={(e) =>
                    setPrompt((current) => ({
                      ...current,
                      autoPromptDelayMs: e.target.checked ? Math.max(current.autoPromptDelayMs, 3000) : 0,
                    }))
                  }
                />
                <span>Acionar automaticamente</span>
              </label>

              <div className="settings-block">
                <h3>Mensagem do prompt</h3>
                <textarea
                  value={prompt.slidedown.actionMessage}
                  onChange={(e) =>
                    setPrompt((current) => ({
                      ...current,
                      slidedown: { ...current.slidedown, actionMessage: e.target.value },
                    }))
                  }
                  rows={3}
                />
              </div>

              <div className="settings-grid-two">
                <div className="settings-block">
                  <h3>Botão aceitar</h3>
                  <input
                    value={prompt.slidedown.acceptButton}
                    onChange={(e) =>
                      setPrompt((current) => ({
                        ...current,
                        slidedown: { ...current.slidedown, acceptButton: e.target.value },
                      }))
                    }
                  />
                </div>
                <div className="settings-block">
                  <h3>Botão cancelar</h3>
                  <input
                    value={prompt.slidedown.cancelButton}
                    onChange={(e) =>
                      setPrompt((current) => ({
                        ...current,
                        slidedown: { ...current.slidedown, cancelButton: e.target.value },
                      }))
                    }
                  />
                </div>
              </div>

              {autoPromptEnabled ? (
                <div className="settings-block">
                  <h3>Atraso do prompt automático (ms)</h3>
                  <input
                    type="number"
                    value={prompt.autoPromptDelayMs}
                    onChange={(e) =>
                      setPrompt((current) => ({
                        ...current,
                        autoPromptDelayMs: parseInt(e.target.value, 10) || 0,
                      }))
                    }
                  />
                </div>
              ) : null}

              <div className="settings-block">
                <h3>Tooltip do sino</h3>
                <input
                  value={prompt.bell.tooltip}
                  onChange={(e) =>
                    setPrompt((current) => ({
                      ...current,
                      bell: { tooltip: e.target.value },
                    }))
                  }
                />
              </div>

              <div className="settings-grid-two">
                <SlidedownPreview prompt={prompt} />
                <SlidedownPreview prompt={prompt} compact />
              </div>

              <div className="settings-block">
                <h3>Mensagens para iPhone (SDK)</h3>
                <p className="hint">Exibidas quando o visitante usa Chrome no iOS ou Safari sem PWA.</p>
                <textarea
                  rows={2}
                  value={prompt.mobile?.unsupportedBrowserMessage ?? ""}
                  onChange={(e) =>
                    setPrompt((current) => ({
                      ...current,
                      mobile: {
                        ...current.mobile,
                        unsupportedBrowserMessage: e.target.value,
                      },
                    }))
                  }
                  placeholder={defaultPrompt.mobile?.unsupportedBrowserMessage}
                />
                <textarea
                  rows={4}
                  style={{ marginTop: 12 }}
                  value={prompt.mobile?.iosInstallSteps ?? ""}
                  onChange={(e) =>
                    setPrompt((current) => ({
                      ...current,
                      mobile: {
                        ...current.mobile,
                        iosInstallSteps: e.target.value,
                      },
                    }))
                  }
                  placeholder="Uma linha por passo (use Enter entre passos)"
                />
              </div>

              <div className="settings-actions">
                <button type="button" className="btn btn-primary" onClick={() => void save(undefined, "Prompts atualizados.")} disabled={saving}>
                  {saving ? "Salvando..." : "Salvar prompts"}
                </button>
              </div>
            </section>
          ) : null}

          {activeTab === "install" ? (
            <section className="settings-section-shell">
              <div className="settings-section-label">4. Integração de código</div>
              <div className="settings-stack">
                <div className="settings-overview-card">
                  <span>Próximo passo recomendado</span>
                  <strong>{nextPendingItem?.label ?? "Tudo pronto para lançar campanhas"}</strong>
                  <p>
                    {nextPendingItem?.detail ??
                      "Seu site já concluiu os requisitos principais para salvar rascunhos, testar e enviar campanhas."}
                  </p>
                </div>
              </div>

              {setup ? (
                <section className="panel-muted settings-install-card">
                  <div className="section-heading">
                    <CheckCircle2 size={18} />
                    <div className="section-heading-text">
                      <h3>Checklist pré-lançamento</h3>
                      <p>Use este resumo antes de disparar campanhas.</p>
                    </div>
                  </div>
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
                </section>
              ) : null}

              {snippet?.instructions?.length ? (
                <section className="settings-block">
                  <h3>Instruções de instalação</h3>
                  <ul className="checklist checklist-plain">
                    {snippet.instructions.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <div className="settings-grid-two">
                <div className="settings-block">
                  <h3>Caminho do Service Worker</h3>
                  <input value={swPath} onChange={(e) => setSwPath(e.target.value)} placeholder="/push/sw.js" />
                </div>
                <div className="settings-block">
                  <h3>Escopo do Service Worker</h3>
                  <input value={swScope} onChange={(e) => setSwScope(e.target.value)} placeholder="/push/" />
                </div>
              </div>

              {!httpsOk && urlOrigem ? (
                <div className="warn">
                  A URL do site não está em HTTPS. Push no celular Android exige HTTPS em produção.
                </div>
              ) : null}

              <section className="settings-block">
                <h3>1. Baixar o Service Worker</h3>
                <p>
                  Baixe o arquivo abaixo e publique-o na raiz ou subpasta correta do seu servidor web.
                  Republique após cada atualização da API (obrigatório para Safari/iPhone).
                </p>
                {snippet ? (
                  <>
                    <div className="deploy-url">
                      <code>{snippet.service_worker_deploy_url}</code>
                    </div>
                    <div className="settings-actions">
                      <button type="button" className="btn btn-primary" onClick={downloadSw}>
                        <Download size={16} />
                        <span>Baixar {snippet.service_worker_filename}</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => {
                          void copyText(snippet.service_worker_content);
                          setMessage("Service worker copiado!");
                          setMessageType("ok");
                        }}
                      >
                        <Copy size={16} />
                        <span>Copiar código</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="toast toast-error">{snippetError || "Snippet indisponível no momento."}</div>
                )}
              </section>

              <section className="settings-block">
                <h3>2. Adicionar o script do SDK</h3>
                <p>
                  Copie e cole este código no arquivo HTML principal do seu site, dentro da tag &lt;head&gt;.
                  O snippet inclui o manifest PWA exigido no iPhone.
                </p>
                {snippet?.manifest_url ? (
                  <p className="hint">
                    Manifest: <code>{snippet.manifest_url}</code>
                  </p>
                ) : null}
                {snippet ? (
                  <>
                    <pre className="code-block">{snippet.snippet_html}</pre>
                    <div className="settings-actions">
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => {
                          void copyText(snippet.snippet_html);
                          setMessage("Código copiado para a área de transferência!");
                          setMessageType("ok");
                        }}
                      >
                        <Copy size={16} />
                        <span>Copiar</span>
                      </button>
                    </div>
                  </>
                ) : null}
              </section>

              <div className="settings-actions">
                <button type="button" className="btn btn-primary" onClick={() => void handleConclude()} disabled={saving}>
                  {saving ? "Concluindo..." : "Salvar e concluir"}
                </button>
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </div>
  );
}
