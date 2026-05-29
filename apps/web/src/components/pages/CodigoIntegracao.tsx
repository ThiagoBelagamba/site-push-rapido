"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, SetupStatus, SnippetResponse, parseApiError } from "@/lib/api";

function copyText(text: string) {
  navigator.clipboard.writeText(text);
}

function snippetHelpMessage(err: unknown): string {
  const msg = parseApiError(err);
  if (msg.includes("push/sw.js") || msg.includes("Arquivo não encontrado")) {
    return `${msg} — Confira se push/sw.js existe na raiz do monorepo e reinicie a API (npm run dev:api).`;
  }
  if (msg.includes("conectar à API")) {
    return msg;
  }
  return `${msg} — Reinicie a API em http://localhost:3000 e tente de novo.`;
}

export default function CodigoIntegracao() {
  const [snippet, setSnippet] = useState<SnippetResponse | null>(null);
  const [setup, setSetup] = useState<SetupStatus | null>(null);
  const [snippetError, setSnippetError] = useState("");
  const [setupError, setSetupError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([api.getSnippet(), api.getSetupStatus()]).then((results) => {
      const [snippetRes, setupRes] = results;

      if (snippetRes.status === "fulfilled") {
        setSnippet(snippetRes.value);
        setSnippetError("");
      } else {
        setSnippetError(snippetHelpMessage(snippetRes.reason));
      }

      if (setupRes.status === "fulfilled") {
        setSetup(setupRes.value);
        setSetupError("");
      } else {
        setSetupError(parseApiError(setupRes.reason));
      }

      setLoading(false);
    });
  }, []);

  function downloadSw() {
    if (!snippet) return;
    const blob = new Blob([snippet.service_worker_content], {
      type: "application/javascript",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = snippet.service_worker_filename;
    a.click();
    URL.revokeObjectURL(url);
    setMessage(`Download: ${snippet.service_worker_filename}`);
  }

  if (loading) return <div className="loading">Carregando...</div>;

  if (!snippet) {
    return (
      <div className="page">
        <h2 className="page-title">Adicionar código ao site</h2>
        <div className="toast toast-error">
          {snippetError || "Erro ao carregar o snippet"}
        </div>
        {setupError && <div className="toast">{setupError}</div>}
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          Tentar de novo
        </button>
        <Link href="/integrar" className="btn" style={{ marginLeft: "0.5rem" }}>
          Voltar ao Integrar
        </Link>
      </div>
    );
  }

  return (
    <div className="page">
      <h2 className="page-title">Adicionar código ao site</h2>
      <p className="page-desc">
        Siga os dois passos abaixo, como no{" "}
        <a
          href="https://documentation.onesignal.com/docs/en/onesignal-service-worker"
          target="_blank"
          rel="noreferrer"
        >
          setup do OneSignal
        </a>
        .
      </p>

      {message && <div className="toast">{message}</div>}
      {setupError && <div className="toast toast-error">Checklist: {setupError}</div>}

      {setup && (
        <section className="panel">
          <h3>Checklist pré-lançamento</h3>
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
        </section>
      )}

      <section className="panel integration-step">
        <div className="step-header">
          <span className="step-check">✓</span>
          <h3>1. Upload do Service Worker</h3>
        </div>
        <p>
          Baixe o arquivo e envie para a <strong>raiz ou subpasta</strong> do seu site. Ele deve
          ficar acessível em:
        </p>
        <p className="deploy-url">
          <code>{snippet.service_worker_deploy_url}</code>
        </p>
        <p className="hint">
          Recomendado: subpasta dedicada (ex: <code>/push/</code>) para não conflitar com PWA.
          Após atualizar a integração, <strong>republique o service worker</strong> no site (Safari/iPhone
          exigem a versão mais recente). Veja a{" "}
          <a
            href="https://documentation.onesignal.com/docs/en/onesignal-service-worker"
            target="_blank"
            rel="noreferrer"
          >
            documentação do service worker
          </a>
          .
        </p>
        <div className="code-actions">
          <button type="button" className="btn btn-primary" onClick={downloadSw}>
            Baixar Service Worker ({snippet.service_worker_filename})
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              copyText(snippet.service_worker_content);
              setMessage("Service worker copiado!");
            }}
          >
            Copiar código
          </button>
        </div>
        <details className="code-details">
          <summary>Ver conteúdo do arquivo</summary>
          <pre className="code-block">{snippet.service_worker_content}</pre>
        </details>
      </section>

      <section className="panel integration-step">
        <div className="step-header">
          <span className="step-check">✓</span>
          <h3>2. Adicionar código no site</h3>
        </div>
        <p>
          Cole este trecho na seção <strong>&lt;head&gt;</strong> de todas as páginas em que o
          usuário pode se inscrever. O snippet já inclui o <code>manifest.json</code> exigido no
          iPhone (
          <a
            href="https://documentation.onesignal.com/docs/en/web-push-setup"
            target="_blank"
            rel="noreferrer"
          >
            passo 7 do Web Push Setup
          </a>
          ).
        </p>
        {snippet.manifest_url ? (
          <p className="hint">
            Manifest PWA: <code>{snippet.manifest_url}</code>
          </p>
        ) : null}
        <pre className="code-block">{snippet.snippet_html}</pre>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            copyText(snippet.snippet_html);
            setMessage("Código copiado para a área de transferência!");
          }}
        >
          Copiar código
        </button>
      </section>

      <div className="form-actions">
        <Link href="/campanhas" className="btn btn-primary">
          Concluir — ir para Campanhas
        </Link>
        <Link href="/integrar" className="btn">
          Voltar ao Integrar
        </Link>
      </div>
    </div>
  );
}
