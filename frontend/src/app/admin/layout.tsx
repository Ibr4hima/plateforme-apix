import Sidebar from "@/components/admin/Sidebar";
import LectureSeule from "@/components/admin/LectureSeule";

export const metadata = {
  title: "Administration — APIX",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F6F5F3" }}>
      <Sidebar />
      <main style={{ flex: 1, minHeight: "100vh", overflow: "auto" }}>
        <LectureSeule>{children}</LectureSeule>
      </main>
    </div>
  );
}
