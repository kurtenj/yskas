import { createRoot } from "react-dom/client";
import TodayPage from "../../app/(app)/page";
import SettingsPage from "../../app/(app)/settings/page";
import AppLayout from "../../app/(app)/layout";
import { usePathname } from "./services";
function Fixture() {
  const path = usePathname();
  return (
    <AppLayout>
      {path === "/settings" ? <SettingsPage /> : <TodayPage />}
    </AppLayout>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
