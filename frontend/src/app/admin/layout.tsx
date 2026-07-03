import Sidebar from "@/components/admin/Sidebar";

export const metadata = {
  title: "Administration — APIX",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F6F5F3" }}>
      <Sidebar />
      <main style={{ flex: 1, minHeight: "100vh", overflow: "auto" }}>
        {children}
      </main>
    </div>
  );
}
