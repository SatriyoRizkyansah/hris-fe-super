import { HrisResourcePage } from "@/components/hris/HrisResourcePage";
export default function Page() {
  return (
    <HrisResourcePage
      title="Proyek"
      description="Daftar dan status proyek HRIS."
      group="masterProyek"
      method="proyekControllerGetData"
      columns={[
        { key: "kode_proyek", header: "Kode Proyek" },
        { key: "nama_proyek", header: "Nama Proyek" },
        { key: "status", header: "Status" },
        { key: "tanggal_mulai", header: "Tanggal Mulai" },
        { key: "tanggal_selesai", header: "Tanggal Selesai" },
      ]}
    />
  );
}
