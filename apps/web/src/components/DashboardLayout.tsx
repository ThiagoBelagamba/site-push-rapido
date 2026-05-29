"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  ChevronDown,
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
            <img src="/logo-horizontal.png" alt="Push Rápido" className="sidebar-logo" />
          </div>
          <button
            type="button"
            className="sidebar-close"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Fechar navegação"
          >
            <X size={24} />
          </button>
        </div>
        <div className="sidebar-divider" aria-hidden />
        <nav className="sidebar-nav custom-scrollbar">
          {navGroups.map((group) => (
            <div key={group.title} className="nav-group">
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
                        onClick={() => {
                          if (typeof window !== "undefined" && window.innerWidth < 1024) {
                            setMobileNavOpen(false);
                          }
                        }}
                      >
                        <div className="nav-link-main">
                          <Icon size={20} className="nav-link-icon" />
                          <span className="nav-link-label">{item.label}</span>
                        </div>
                        <ChevronRight size={16} className="chevron" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-site-select">
            <label className="sidebar-site-label" htmlFor="sidebar-site-select">
              Site
              <br />
              ativo
            </label>
            <div className="sidebar-site-field">
              <select
                id="sidebar-site-select"
                className="sidebar-site-input"
                value={selectedSiteId ?? ""}
                onChange={(e) => selectSite(e.target.value || null)}
                disabled={sitesLoading || sites.length === 0}
              >
                {sites.length === 0 ? <option value="">Nenhum site</option> : null}
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.nome}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="sidebar-site-chevron" aria-hidden />
            </div>
          </div>
          <div className={`sidebar-alert sidebar-alert-${statusTone}`}>
            <StatusIcon size={18} strokeWidth={statusTone === "pending" ? 2.5 : 2} />
            <span>{sitesLoading ? "Carregando sites..." : statusLabel}</span>
          </div>
          <button type="button" className="btn-logout" onClick={logout}>
            <LogOut size={18} />
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
            <Menu size={20} />
          </button>
          <div className="main-topbar-copy">
            <strong className="main-topbar-title">{currentSection}</strong>
          </div>
        </div>
        <div className="main-content">{children}</div>
      </main>
    </div>
  );
}
