import { HrisResourcePage } from "@/components/hris/HrisResourcePage";
export default function Page() {
  return (
    <HrisResourcePage
      title="Master MAK"
      description="Daftar mata anggaran kegiatan."
      group="masterMak"
      method="masterMakControllerFindAll"
      requestStyle="params"
      create={{
        method: "masterMakControllerCreate",
        fields: [
          { name: "kode_mak", label: "Kode MAK", required: true },
          { name: "nama_mak", label: "Nama MAK", required: true },
          { name: "tipe_akun", label: "Tipe akun", required: true },
        ],
      }}
    />
  );
}
