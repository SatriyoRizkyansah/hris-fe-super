import { HrisResourcePage } from "@/components/hris/HrisResourcePage";
export default function Page() {
  return <HrisResourcePage title="Pengaturan Margin" description="Daftar pengaturan distribusi margin." group="masterPengaturanMargin" method="pengaturanMarginControllerGetData" />;
}
