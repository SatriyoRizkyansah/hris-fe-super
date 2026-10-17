import { HrisResourcePage } from "@/components/hris/HrisResourcePage";
export default function Page() {
  return (
    <HrisResourcePage
      title="Rekening Bank"
      description="Daftar rekening bank terdaftar."
      group="masterRekeningBank"
      method="masterRekeningControllerFindAll"
      methodHasQuery={false}
      create={{
        method: "masterRekeningControllerCreate",
        fields: [
          { name: "nama_bank", label: "Nama bank", required: true },
          { name: "nomor_rekening", label: "Nomor rekening", required: true },
          { name: "nama_rekening", label: "Nama pemilik rekening", required: true },
        ],
      }}
    />
  );
}
