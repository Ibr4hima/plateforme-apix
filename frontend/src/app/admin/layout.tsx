import Sidebar from "@/components/admin/Sidebar";

export const metadata = {
  title: "Administration — APIX",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F2F0EF" }}>
      <Sidebar />
      <main style={{ marginLeft: 240, flex: 1, minHeight: "100vh", overflow: "auto" }}>
        {children}
      </main>
    </div>
  );
}
