/** Base URL da API (sempre explícita — API separada do frontend). */
export function getApiBase(): string {
  const env = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (env?.startsWith("http://") || env?.startsWith("https://")) {
    return env.replace(/\/$/, "");
  }
  return "http://localhost:3000";
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("pr_token");
}

export function setToken(token: string) {
  localStorage.setItem("pr_token", token);
}

export function clearToken() {
  localStorage.removeItem("pr_token");
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

export function parseApiError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Erro desconhecido";
}

function networkErrorMessage(url: string): string {
  const isLocalApi = /https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(url);
  if (!isLocalApi) {
    return (
      `Não foi possível conectar à API (${url}). ` +
      "Confira se a URL pública está correta, se a API está online e se o CORS permite o domínio do painel."
    );
  }
  return (
    `Não foi possível conectar à API (${url}). ` +
    "Confira: (1) docker compose up -d  (2) npm run dev:api na porta 3000 — se a porta estiver ocupada pelo disparorapido_api, pare-o primeiro. " +
    "Painel: http://localhost:3001"
  );
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const url = `${getApiBase()}${path.startsWith("/api") ? path : `/api${path}`}`;
  const hasBody =
    options?.body !== undefined && options?.body !== null && options.body !== "";
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options?.headers as Record<string, string> | undefined) ?? {}),
  };
  if (hasBody) {
    headers["Content-Type"] = "application/json";
  }
  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err) {
    if (err instanceof TypeError) {
      if (url.includes("/metrics/") || url.includes("/stats/")) {
        throw new Error(
          "Requisição bloqueada pelo navegador (extensão anti-anúncio). " +
            "Desative o bloqueador em localhost:3001 ou permita localhost:3000."
        );
      }
      throw new Error(networkErrorMessage(url));
    }
    throw err;
  }
  if (res.status === 401 && !path.includes("/auth/login")) {
    clearToken();
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("Sessão expirada");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const raw = (err as { error?: unknown }).error;
    const message =
      typeof raw === "string"
        ? raw
        : raw && typeof raw === "object"
          ? JSON.stringify(raw)
          : res.statusText;
    throw new Error(message);
  }
  return res.json();
}

export interface Metrics {
  active_subscriptions: number;
  unregistered_subscriptions?: number;
  last_campaign: {
    id: string;
    titulo: string;
    total_entregues: number;
    total_falhas: number;
    total_cliques: number;
    total_alvo: number;
  } | null;
  last_delivery_rate: number;
  last_ctr: number;
}

export interface Campaign {
  id: string;
  titulo: string;
  mensagem: string;
  url_destino: string;
  icone_url: string | null;
  status: string;
  total_alvo: number;
  total_entregues: number;
  total_falhas: number;
  total_cliques: number;
  erro_detalhe?: string | null;
  criado_em: string;
  iniciado_em?: string;
  finalizado_em?: string;
}

export interface PromptConfig {
  slidedown: {
    actionMessage: string;
    acceptButton: string;
    cancelButton: string;
  };
  bell: { tooltip: string };
  autoPromptDelayMs: number;
}

export interface SiteConfig {
  nome: string;
  url_origem: string;
  icone_padrao_url: string;
  prompt_config: PromptConfig;
  configurado: boolean;
  auto_resubscribe: boolean;
  allow_localhost_http: boolean;
  service_worker_path: string;
  service_worker_scope: string;
  api_public_url: string;
  welcome_enabled?: boolean;
  welcome_titulo?: string;
  welcome_mensagem?: string;
}

export interface SnippetResponse {
  api_public_url: string;
  service_worker_deploy_url: string;
  service_worker_filename: string;
  service_worker_scope: string;
  service_worker_content: string;
  snippet_html: string;
  instructions: string[];
}

export interface ServicesHealth {
  postgres: boolean;
  rabbitmq: boolean;
  worker: boolean;
  all_ok: boolean;
  message?: string;
}

export interface SetupStatusItem {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface SetupStatus {
  items: SetupStatusItem[];
  ready: boolean;
  active_subscriptions: number;
}

export interface Subscription {
  id: string;
  endpoint: string;
  provider: string;
  status: string;
  user_agent?: string;
  criado_em: string;
}

export const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  queued: "Na fila",
  processing: "Enviando…",
  finished: "Concluída",
  failed: "Falhou",
  skipped: "Ignorada",
};

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; email: string }>("/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<{ email: string }>("/v1/auth/me"),

  getSite: () => request<SiteConfig>("/v1/site"),

  updateSite: (body: Partial<SiteConfig> & { configurado?: boolean }) =>
    request<SiteConfig>("/v1/site", {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  uploadIcon: async (file: File): Promise<{ icone_padrao_url: string }> => {
    const token = getToken();
    const url = `${getApiBase()}/api/v1/site/icon`;
    const form = new FormData();
    form.append("file", file);
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
    } catch (err) {
      if (err instanceof TypeError) {
        throw new Error(networkErrorMessage(url));
      }
      throw err;
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      const raw = (err as { error?: unknown }).error;
      throw new Error(typeof raw === "string" ? raw : res.statusText);
    }
    return res.json();
  },

  getSnippet: () => request<SnippetResponse>("/v1/site/snippet"),

  getSetupStatus: () => request<SetupStatus>("/v1/site/setup-status"),

  getServicesHealth: async (): Promise<ServicesHealth> => {
    const token = getToken();
    const url = `${getApiBase()}/api/v1/health/services`;
    let res: Response;
    try {
      res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch (err) {
      if (err instanceof TypeError) {
        throw new Error(networkErrorMessage(url));
      }
      throw err;
    }
    if (res.status === 401) {
      clearToken();
      if (typeof window !== "undefined") window.location.href = "/login";
      throw new Error("Sessão expirada");
    }
    return res.json() as Promise<ServicesHealth>;
  },

  getMetrics: () => request<Metrics>("/v1/stats/overview"),

  getCampaigns: () => request<{ campaigns: Campaign[] }>("/v1/campaigns"),

  getCampaign: (id: string) => request<Campaign>(`/v1/campaigns/${id}`),

  createCampaign: (body: {
    titulo: string;
    mensagem: string;
    url_destino: string;
    icone_url?: string;
  }) =>
    request<{ id: string }>("/v1/campaigns", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateCampaign: (
    id: string,
    body: { titulo: string; mensagem: string; url_destino: string; icone_url?: string }
  ) =>
    request<{ id: string; updated: boolean }>(`/v1/campaigns/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  sendCampaign: (id: string) =>
    request<{ queued: boolean; total_alvo: number; estimated_seconds: number }>(
      `/v1/campaigns/${id}/send`,
      { method: "POST", body: "{}" }
    ),

  testCampaign: (id: string, body?: { subscription_id?: string; endpoint?: string }) =>
    request<{ sent: boolean }>(`/v1/campaigns/${id}/test`, {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),

  getSubscriptions: () =>
    request<{ subscriptions: Subscription[] }>("/v1/subscriptions"),
};
