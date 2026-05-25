"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, PromptConfig, SiteConfig } from "@/lib/api";

const defaultPrompt: PromptConfig = {
  slidedown: {
    actionMessage:
      "Receba alertas personalizados com novidades, atualizações e ofertas relevantes direto no seu navegador.",
    acceptButton: "Permitir",
    cancelButton: "Agora não",
  },
  bell: { tooltip: "Gerenciar notificações" },
  autoPromptDelayMs: 3000,
};

export default function Integrar() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const [nome, setNome] = useState("Meu Site");
  const [urlOrigem, setUrlOrigem] = useState("http://localhost:8080");
  const [iconeUrl, setIconeUrl] = useState("");
  const [iconUploading, setIconUploading] = useState(false);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [autoResubscribe, setAutoResubscribe] = useState(true);
  const [allowLocalhost, setAllowLocalhost] = useState(true);
  const [prompt, setPrompt] = useState<PromptConfig>(defaultPrompt);
  const [swPath, setSwPath] = useState("/push/sw.js");
  const [swScope, setSwScope] = useState("/push/");
  const [welcomeEnabled, setWelcomeEnabled] = useState(false);
  const [welcomeTitulo, setWelcomeTitulo] = useState("Inscrição confirmada!");
  const [welcomeMensagem, setWelcomeMensagem] = useState(
    "Você passará a receber nossas notificações."
  );

  useEffect(() => {
    api
      .getSite()
      .then((site: SiteConfig) => {
        setNome(site.nome);
        setUrlOrigem(site.url_origem);
        setIconeUrl(site.icone_padrao_url || "");
        setIconPreview(site.icone_padrao_url || null);
        setAutoResubscribe(site.auto_resubscribe ?? true);
        setAllowLocalhost(site.allow_localhost_http ?? true);
        setPrompt(site.prompt_config || defaultPrompt);
        setSwPath(site.service_worker_path || "/push/sw.js");
        setSwScope(site.service_worker_scope || "/push/");
        setWelcomeEnabled(site.welcome_enabled ?? false);
        setWelcomeTitulo(site.welcome_titulo ?? "Inscrição confirmada!");
        setWelcomeMensagem(
          site.welcome_mensagem ?? "Você passará a receber nossas notificações."
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function save(partial: Record<string, unknown>, nextStep?: number) {
    setMessage("");
    try {
      await api.updateSite({
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
        ...partial,
      });
      if (nextStep) setStep(nextStep);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Erro ao salvar");
    }
  }

  async function handleFinish(e: FormEvent) {
    e.preventDefault();
    try {
      await api.updateSite({
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
        configurado: true,
      });
      router.push("/integrar/codigo");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao finalizar");
    }
  }

  if (loading) return <div className="loading">Carregando...</div>;

  return (
    <div className="page">
      <h2 className="page-title">Integrar Web Push</h2>
      <p className="page-desc">
        Configure seu site como no OneSignal Site Setup. Depois copie o código JS para o site externo.
      </p>

      <div className="steps">
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className={`step-dot ${step === n ? "active" : step > n ? "done" : ""}`}>
            {n}
          </span>
        ))}
      </div>

      {message && <div className="toast">{message}</div>}

      {step === 1 && (
        <section className="panel">
          <h3>1. Site Setup</h3>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              save({}, 2);
            }}
          >
            <label>
              Nome do site
              <input value={nome} onChange={(e) => setNome(e.target.value)} required />
            </label>
            <label>
              URL do site (origin)
              <input
                value={urlOrigem}
                onChange={(e) => setUrlOrigem(e.target.value)}
                required
                type="url"
                placeholder="https://seusite.com"
              />
            </label>
            <label>
              Ícone padrão das notificações (256×256, PNG ou JPG)
              <div className="icon-upload-row">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setIconPreview(URL.createObjectURL(file));
                    setIconUploading(true);
                    setMessage("");
                    try {
                      const { icone_padrao_url } = await api.uploadIcon(file);
                      setIconeUrl(icone_padrao_url);
                      setIconPreview(icone_padrao_url);
                      setMessage("Ícone enviado com sucesso!");
                    } catch (err) {
                      setMessage(err instanceof Error ? err.message : "Falha no upload");
                    } finally {
                      setIconUploading(false);
                    }
                  }}
                />
                {iconUploading && <span className="hint">Enviando...</span>}
              </div>
              {iconPreview && (
                <img src={iconPreview} alt="Preview ícone" className="icon-preview" width={64} height={64} />
              )}
            </label>
            <label>
              Ou URL do ícone (alternativa)
              <input
                value={iconeUrl}
                onChange={(e) => {
                  setIconeUrl(e.target.value);
                  setIconPreview(e.target.value || null);
                }}
                type="url"
                placeholder="http://localhost:3000/uploads/icon.png"
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={autoResubscribe}
                onChange={(e) => setAutoResubscribe(e.target.checked)}
              />
              Auto resubscribe (reinscrever após limpar dados do navegador)
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={allowLocalhost}
                onChange={(e) => setAllowLocalhost(e.target.checked)}
              />
              Local testing — tratar HTTP localhost como permitido
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={welcomeEnabled}
                onChange={(e) => setWelcomeEnabled(e.target.checked)}
              />
              Notificação de boas-vindas ao inscrever (OneSignal Welcome)
            </label>
            {welcomeEnabled && (
              <>
                <label>
                  Título da boas-vindas
                  <input
                    value={welcomeTitulo}
                    onChange={(e) => setWelcomeTitulo(e.target.value)}
                  />
                </label>
                <label>
                  Mensagem da boas-vindas
                  <textarea
                    value={welcomeMensagem}
                    onChange={(e) => setWelcomeMensagem(e.target.value)}
                    rows={2}
                  />
                </label>
              </>
            )}
            <button type="submit" className="btn btn-primary">
              Próximo
            </button>
          </form>
        </section>
      )}

      {step === 2 && (
        <section className="panel">
          <h3>2. Permission Prompt</h3>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              save({}, 3);
            }}
          >
            <label>
              Mensagem do Slidedown
              <textarea
                value={prompt.slidedown.actionMessage}
                onChange={(e) =>
                  setPrompt({
                    ...prompt,
                    slidedown: { ...prompt.slidedown, actionMessage: e.target.value },
                  })
                }
                rows={3}
              />
            </label>
            <label>
              Botão aceitar
              <input
                value={prompt.slidedown.acceptButton}
                onChange={(e) =>
                  setPrompt({
                    ...prompt,
                    slidedown: { ...prompt.slidedown, acceptButton: e.target.value },
                  })
                }
              />
            </label>
            <label>
              Botão cancelar
              <input
                value={prompt.slidedown.cancelButton}
                onChange={(e) =>
                  setPrompt({
                    ...prompt,
                    slidedown: { ...prompt.slidedown, cancelButton: e.target.value },
                  })
                }
              />
            </label>
            <label>
              Delay auto-prompt (ms)
              <input
                type="number"
                value={prompt.autoPromptDelayMs}
                onChange={(e) =>
                  setPrompt({ ...prompt, autoPromptDelayMs: parseInt(e.target.value, 10) || 0 })
                }
              />
            </label>
            <label>
              Tooltip do sino
              <input
                value={prompt.bell.tooltip}
                onChange={(e) =>
                  setPrompt({ ...prompt, bell: { tooltip: e.target.value } })
                }
              />
            </label>
            <div className="preview-box">
              <strong>Preview Slidedown</strong>
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
            <div className="form-actions">
              <button type="button" className="btn" onClick={() => setStep(1)}>
                Voltar
              </button>
              <button type="submit" className="btn btn-primary">
                Próximo
              </button>
            </div>
          </form>
        </section>
      )}

      {step === 3 && (
        <section className="panel">
          <h3>3. Service Worker</h3>
          <p className="warn">
            O arquivo do service worker deve ser hospedado no <strong>mesmo origin</strong> do site
            integrado (não no servidor Push Rápido).
          </p>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              save({}, 4);
            }}
          >
            <label>
              Caminho do SW no seu site
              <input value={swPath} onChange={(e) => setSwPath(e.target.value)} />
            </label>
            <label>
              Scope do SW
              <input value={swScope} onChange={(e) => setSwScope(e.target.value)} />
            </label>
            <p className="hint">
              URL final: {urlOrigem.replace(/\/$/, "")}
              {swPath}
            </p>
            <div className="form-actions">
              <button type="button" className="btn" onClick={() => setStep(2)}>
                Voltar
              </button>
              <button type="submit" className="btn btn-primary">
                Próximo
              </button>
            </div>
          </form>
        </section>
      )}

      {step === 4 && (
        <section className="panel">
          <h3>4. Concluir</h3>
          <p>Revise e finalize para gerar o código de integração.</p>
          <ul className="summary-list">
            <li>
              <strong>Site:</strong> {nome} — {urlOrigem}
            </li>
            <li>
              <strong>SW:</strong> {swPath} (scope {swScope})
            </li>
            <li>
              <strong>Localhost:</strong> {allowLocalhost ? "Sim" : "Não"}
            </li>
          </ul>
          <form onSubmit={handleFinish} className="form-actions">
            <button type="button" className="btn" onClick={() => setStep(3)}>
              Voltar
            </button>
            <button type="submit" className="btn btn-primary">
              Salvar e gerar código JS
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
