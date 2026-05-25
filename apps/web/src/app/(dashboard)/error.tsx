"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="page">
      <h2 className="page-title">Algo deu errado</h2>
      <p className="page-desc">{error.message || "Erro ao carregar a página"}</p>
      <p className="hint">
        Se a API estiver offline, rode <code>npm run dev:api</code> (porta 3000) e confira{" "}
        <code>NEXT_PUBLIC_API_URL</code> em apps/web/.env.local.
      </p>
      <div className="form-actions">
        <button type="button" className="btn btn-primary" onClick={() => reset()}>
          Tentar de novo
        </button>
        <a href="/" className="btn">
          Ir para início
        </a>
      </div>
    </div>
  );
}
