"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  api,
  clearSelectedSiteId,
  getSelectedSiteId,
  setSelectedSiteId as persistSelectedSiteId,
  SiteSummary,
} from "@/lib/api";

interface SiteContextValue {
  sites: SiteSummary[];
  selectedSiteId: string | null;
  selectedSite: SiteSummary | null;
  loading: boolean;
  error: string;
  refreshSites: () => Promise<SiteSummary[]>;
  selectSite: (siteId: string | number | null) => void;
}

const SiteContext = createContext<SiteContextValue | null>(null);

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [selectedSiteId, setSelectedSiteIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const selectSite = useCallback((siteId: string | number | null) => {
    if (siteId === null || siteId === undefined || `${siteId}`.trim() === "") {
      clearSelectedSiteId();
      setSelectedSiteIdState(null);
      return;
    }
    const next = String(siteId);
    persistSelectedSiteId(next);
    setSelectedSiteIdState(next);
  }, []);

  const refreshSites = useCallback(async () => {
    setError("");
    const response = await api.getSites();
    const nextSites = response.sites ?? [];
    setSites(nextSites);

    const persisted = getSelectedSiteId();
    const selected =
      (persisted && nextSites.find((site) => String(site.id) === persisted)) ||
      nextSites[0] ||
      null;

    if (selected) {
      selectSite(selected.id);
    } else {
      selectSite(null);
    }

    return nextSites;
  }, [selectSite]);

  useEffect(() => {
    let cancelled = false;
    setSelectedSiteIdState(getSelectedSiteId());
    refreshSites()
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Não foi possível carregar os sites");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshSites]);

  const selectedSite = useMemo(
    () => sites.find((site) => String(site.id) === selectedSiteId) ?? null,
    [selectedSiteId, sites]
  );

  const value = useMemo<SiteContextValue>(
    () => ({
      sites,
      selectedSiteId,
      selectedSite,
      loading,
      error,
      refreshSites,
      selectSite,
    }),
    [sites, selectedSiteId, selectedSite, loading, error, refreshSites, selectSite]
  );

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSiteContext() {
  const context = useContext(SiteContext);
  if (!context) {
    throw new Error("useSiteContext deve ser usado dentro de SiteProvider");
  }
  return context;
}
