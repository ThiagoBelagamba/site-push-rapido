"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, clearToken, getSelectedSiteId, isLoggedIn, setSelectedSiteId } from "@/lib/api";

const INTEGRAR_PREFIX = "/integrar";
const CAMPANHAS_PREFIX = "/campanhas";
const SITES_PREFIX = "/sites";
const CODIGO_INTEGRACAO_PATH = "/integrar/codigo";

export default function ProtectedGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [checking, setChecking] = useState(true);
  const [accessAllowed, setAccessAllowed] = useState(false);

  const isIntegrarRoute = pathname.startsWith(INTEGRAR_PREFIX);
  const isCampanhasRoute = pathname.startsWith(CAMPANHAS_PREFIX);
  const isSitesRoute = pathname.startsWith(SITES_PREFIX);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }

    if (isIntegrarRoute || isSitesRoute) {
      setAccessAllowed(true);
      setChecking(false);
      return;
    }
    let cancelled = false;

    const validateAccess = async () => {
      setChecking(true);
      setAccessAllowed(false);

      try {
        const sitesRes = await api.getSites();
        if (cancelled) return;

        if (!sitesRes.sites.length) {
          router.replace("/sites");
          return;
        }

        const storedSiteId = getSelectedSiteId();
        const selectedSite =
          sitesRes.sites.find((site) => String(site.id) === storedSiteId) ?? sitesRes.sites[0];
        if (!storedSiteId || String(selectedSite.id) !== storedSiteId) {
          setSelectedSiteId(selectedSite.id);
        }

        const site = await api.getSite(selectedSite.id);
        if (cancelled) return;

        if (!site.configurado) {
          router.replace("/integrar");
          return;
        }

        if (isCampanhasRoute) {
          const setup = await api.getSetupStatus();
          if (cancelled) return;

          if (!setup.ready) {
            router.replace(CODIGO_INTEGRACAO_PATH);
            return;
          }
        }

        setAccessAllowed(true);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (msg === "Sessão expirada" || msg === "Não autorizado") {
          clearToken();
          router.replace("/login");
          return;
        }
        router.replace("/integrar");
      } finally {
        if (!cancelled) setChecking(false);
      }
    };

    void validateAccess();

    return () => {
      cancelled = true;
    };
  }, [mounted, pathname, router, isIntegrarRoute, isCampanhasRoute, isSitesRoute]);

  if (!mounted || checking) {
    return <div className="loading">Carregando...</div>;
  }

  if (!isIntegrarRoute && !isSitesRoute && !accessAllowed) {
    return <div className="loading">Carregando...</div>;
  }

  return <>{children}</>;
}
