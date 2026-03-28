import { Sidebar } from "./Sidebar";

interface Props {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: Props) {
  return (
    <div className="flex min-h-screen bg-surface-950">
      <Sidebar />
      <main className="flex-1 ml-56 p-8 overflow-y-auto">{children}</main>
    </div>
  );
}
