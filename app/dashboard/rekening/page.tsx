import { HrisResourcePage } from "@/components/hris/HrisResourcePage";
export default function Page() {
  return <HrisResourcePage title="Rekening Bank" description="Daftar rekening bank terdaftar." group="masterRekeningBank" method="masterRekeningControllerFindAll" />;
}
