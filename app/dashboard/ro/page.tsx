import { HrisResourcePage } from "@/components/hris/HrisResourcePage";
export default function Page() {
  return <HrisResourcePage title="RO" description="Daftar rekening operasional." group="masterRo" method="roControllerGetData" />;
}
