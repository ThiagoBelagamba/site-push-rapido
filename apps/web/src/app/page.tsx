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
    <main className="page">
      <section className="page-header-simple">
        <div>
          <h1>Abrindo o painel</h1>
          <p>Você está sendo redirecionado para a página de login.</p>
        </div>
        <Link className="button-secondary" href="/login">
          Ir para login
        </Link>
      </section>
    </main>
  );
}
