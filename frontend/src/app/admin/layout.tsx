import AdminChrome from "@/components/admin/AdminChrome";

export const metadata = {
  title: "Administration — APIX",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminChrome>{children}</AdminChrome>;
}
