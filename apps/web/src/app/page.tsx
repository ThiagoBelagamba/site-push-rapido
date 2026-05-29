"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login");
  }, [router]);

  return (
    <main className="ui-page">
      <section className="ui-section">
        <h1 className="ui-title">Abrindo o painel</h1>
        <p>Redirecionando para o login…</p>
        <div className="ui-actions">
          <Link className="btn btn-primary" href="/login">
            Ir para login
          </Link>
        </div>
      </section>
    </main>
  );
}
