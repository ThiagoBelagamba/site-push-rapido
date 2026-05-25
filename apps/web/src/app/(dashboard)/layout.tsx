import DashboardLayout from "@/components/DashboardLayout";
import ProtectedGate from "@/components/ProtectedGate";

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedGate>
      <DashboardLayout>{children}</DashboardLayout>
    </ProtectedGate>
  );
}
