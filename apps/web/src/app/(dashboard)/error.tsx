"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="ui-page">
      <header className="ui-header">
        <h1 className="ui-title">Erro</h1>
      </header>
      <section className="ui-section">
        <p>{error.message || "Erro ao carregar a página"}</p>
        <p className="hint">
          Confira se a API está online e se <code>NEXT_PUBLIC_API_URL</code> está correto.
        </p>
        <div className="ui-actions">
          <button type="button" className="btn btn-primary" onClick={() => reset()}>
            Tentar de novo
          </button>
          <a href="/" className="btn btn-ghost">
            Início
          </a>
        </div>
      </section>
    </div>
  );
}
