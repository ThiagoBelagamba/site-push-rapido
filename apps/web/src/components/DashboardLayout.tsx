"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  ChevronRight,
  Globe,
  Home,
  LogOut,
  Menu,
  Send,
  Settings,
  Users,
  X,
} from "lucide-react";
import { api, clearToken } from "@/lib/api";
import { useSiteContext } from "@/components/SiteProvider";
import "../app/layout-dashboard.css";

const navGroups = [
  {
    title: "Dashboard",
    items: [{ href: "/", label: "Visão Geral", exact: true, icon: Home }],
  },
  {
    title: "Mensagens",
    items: [
      { href: "/campanhas/nova", label: "Nova Push", exact: true, icon: Bell, highlight: true },
      { href: "/campanhas", label: "Campanhas", exact: true, icon: Send },
    ],
  },
  {
    title: "Audiência",
    items: [
      { href: "/audiencia", label: "Base de usuários", exact: true, icon: Users },
    ],
  },
  {
    title: "Configurações",
    items: [
      { href: "/sites", label: "Sites", exact: true, icon: Globe },
      { href: "/integrar", label: "Configuração Web", exact: false, icon: Settings },
    ],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { sites, selectedSite, selectedSiteId, selectSite, loading: sitesLoading } = useSiteContext();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [statusLabel, setStatusLabel] = useState("Verificando configuração");
  const [statusTone, setStatusTone] = useState<"ready" | "pending" | "error">("pending");

  function logout() {
    clearToken();
    router.replace("/login");
  }

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    if (href === "/campanhas") return pathname === "/campanhas";
    if (href === "/campanhas/nova") return pathname === "/campanhas/nova";
    if (href === "/integrar") return pathname === "/integrar" || pathname.startsWith("/integrar/");
    return pathname === href || pathname.startsWith(href + "/");
  }

  const currentSection = useMemo(() => {
    for (const group of navGroups) {
      for (const item of group.items) {
        if (isActive(item.href, item.exact)) return item.label;
      }
    }
    return "Painel";
  }, [pathname]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;

    if (!selectedSiteId) {
      setStatusTone("pending");
      setStatusLabel("Selecione ou cadastre um site");
      return () => {
        cancelled = true;
      };
    }

    api
      .getSetupStatus()
      .then((setup) => {
        if (cancelled) return;
        if (setup.ready) {
          setStatusTone("ready");
          setStatusLabel(`Integração pronta: ${selectedSite?.nome ?? "site ativo"}`);
          return;
        }

        const pendingCount = setup.items.filter((item) => !item.ok).length;
        setStatusTone("pending");
        setStatusLabel(
          pendingCount > 0 ? `${pendingCount} pendência${pendingCount > 1 ? "s" : ""} antes do envio` : "Finalize a integração"
        );
      })
      .catch(() => {
        if (cancelled) return;
        setStatusTone("error");
        setStatusLabel("Não foi possível validar a integração");
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSite?.nome, selectedSiteId]);

  const StatusIcon = statusTone === "ready" ? CheckCircle2 : AlertCircle;

  return (
    <div className="layout">
      {mobileNavOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Fechar menu"
        />
      ) : null}

      <aside className={`sidebar${mobileNavOpen ? " sidebar-open" : ""}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="brand-icon" aria-hidden>
              <Bell size={22} />
            </div>
            <div className="brand-copy">
              <h1>Push Rápido</h1>
              <p>Painel Web Push</p>
            </div>
          </div>
          <button
            type="button"
            className="sidebar-close"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Fechar navegação"
          >
            <X size={18} />
          </button>
        </div>
        <nav>
          {navGroups.map((group) => (
            <div key={group.title}>
              <span className="nav-group-label">{group.title}</span>
              <ul className="nav-list">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href, item.exact);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`nav-link${active ? " active" : ""}${item.highlight ? " nav-link-highlight" : ""}`}
                      >
                        <Icon size={18} />
                        <span>{item.label}</span>
                        <ChevronRight size={15} className="chevron" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-status">
            <span>{sitesLoading ? "Carregando sites..." : "Site ativo"}</span>
            <select
              value={selectedSiteId ?? ""}
              onChange={(e) => selectSite(e.target.value || null)}
              disabled={sitesLoading || sites.length === 0}
              style={{ width: "100%", marginTop: 8 }}
            >
              {sites.length === 0 ? <option value="">Nenhum site</option> : null}
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.nome}
                </option>
              ))}
            </select>
          </div>
          <div className={`sidebar-status sidebar-status-${statusTone}`}>
            <StatusIcon size={16} />
            <span>{statusLabel}</span>
          </div>
          <button type="button" className="btn-logout" onClick={logout}>
            <LogOut size={16} />
            <span>Sair</span>
          </button>
        </div>
      </aside>
      <main className="main">
        <div className="main-topbar">
          <button
            type="button"
            className="sidebar-mobile-trigger"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Abrir navegação"
          >
            <Menu size={18} />
          </button>
          <div className="main-topbar-copy">
            <span>Painel administrativo</span>
            <strong>
              {currentSection}
              {selectedSite ? ` · ${selectedSite.nome}` : ""}
            </strong>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
