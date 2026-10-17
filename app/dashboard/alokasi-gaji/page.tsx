import Link from "next/link";
import { HrisResourcePage } from "@/components/hris/HrisResourcePage";
export default function Page() {
  return (
    <>
      <div className="flex justify-end">
        <Link className="inline-flex h-10 items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent" href="/dashboard/alokasi-gaji/rekap">
          Buka Rekap Alokasi
        </Link>
      </div>
      <HrisResourcePage title="Alokasi Gaji" description="Daftar alokasi gaji tenaga ahli." group="alokasiGajiTa" method="alokasiGetControllerGetData" />
    </>
  );
}
