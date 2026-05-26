import DashboardLayout from "@/components/DashboardLayout";
import ProtectedGate from "@/components/ProtectedGate";
import { SiteProvider } from "@/components/SiteProvider";

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedGate>
      <SiteProvider>
        <DashboardLayout>{children}</DashboardLayout>
      </SiteProvider>
    </ProtectedGate>
  );
}
