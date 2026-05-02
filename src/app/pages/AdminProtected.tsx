import { AdminGuard } from "../components/AdminGuard";
import { AdminPage } from "./AdminPage";

export function AdminProtected() {
  return (
    <AdminGuard>
      <AdminPage />
    </AdminGuard>
  );
}
