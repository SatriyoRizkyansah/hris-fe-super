import { HrisResourcePage } from "@/components/hris/HrisResourcePage";
export default function Page() {
  return <HrisResourcePage title="Dana Operasional" description="Daftar dana operasional dan statusnya." group="masterDanaOperasional" method="danaOperasionalControllerGetData" />;
}
