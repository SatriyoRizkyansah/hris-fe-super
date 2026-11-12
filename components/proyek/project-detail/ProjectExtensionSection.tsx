import { Clock3 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DocumentLinks } from "@/components/common/DocumentLinks";
import { formatDate, humanizeStatus } from "@/lib/hris/format";
import type { ProjectExtensionRow } from "./types";

export function ProjectExtensionSection({ rows, isKarwas, isSubmitter, extensionOpenForSubmission, pendingExtension, projectEndDate, isExpired, onReview }: {
  rows: ProjectExtensionRow[];
  isKarwas: boolean;
  isSubmitter: boolean;
  extensionOpenForSubmission: boolean;
  pendingExtension: boolean;
  projectEndDate: string;
  isExpired: boolean;
  onReview: (row: ProjectExtensionRow) => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-muted/30 px-5 py-4">
        <div>
          <h2 className="font-semibold">Perpanjangan SK Proyek</h2>
          <p className="mt-1 text-sm text-muted-foreground">Perubahan jadwal SK diajukan sebelum tanggal akhir dan berlaku setelah disetujui KARWAS. Nilai kontrak dan alokasi RO tidak berubah.</p>
        </div>
        {pendingExtension && <StatusBadge status="warn">Menunggu pemeriksaan KARWAS</StatusBadge>}
      </div>
      <div className="space-y-3 p-5">
        {!rows.length ? (
          <p className="text-sm text-muted-foreground">
            {extensionOpenForSubmission
              ? "Belum ada pengajuan perpanjangan. Ajukan sebelum masa SK berakhir jika proyek memerlukan tambahan waktu."
              : isExpired
                ? "Masa SK sudah berakhir dan pengajuan perpanjangan baru tidak dapat dibuat."
                : "Belum ada riwayat perpanjangan masa SK."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="p-3">Tanggal akhir SK</th>
                  <th className="p-3">Alasan</th>
                  <th className="p-3">Pengajuan</th>
                  <th className="p-3">Status / pemeriksaan</th>
                  {isKarwas && <th className="p-3 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id} className="border-b last:border-0 align-top">
                    <td className="p-3">
                      <span className="text-muted-foreground">{formatDate(item.berakhir_sk_sebelumnya)}</span>
                      <span className="mx-2 text-muted-foreground">→</span>
                      <span className="font-medium">{formatDate(item.berakhir_sk_baru)}</span>
                      <div className="mt-1 text-xs"><DocumentLinks documents={[{ label: "Dokumen pendukung", path: item.file_dokumen }]} /></div>
                    </td>
                    <td className="max-w-sm whitespace-normal p-3">{item.alasan}</td>
                    <td className="p-3">
                      <div>{item.diajukan_oleh?.nama ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(item.diajukan_pada)}</div>
                    </td>
                    <td className="p-3">
                      <StatusBadge status={item.status === "DISETUJUI_KARWAS" ? "ok" : item.status === "DITOLAK_KARWAS" ? "danger" : "warn"}>{humanizeStatus(item.status)}</StatusBadge>
                      {item.diperiksa_oleh && <div className="mt-1 text-xs text-muted-foreground">{item.diperiksa_oleh.nama} · {formatDate(item.diperiksa_pada)}</div>}
                      {item.catatan_pemeriksa && <div className="mt-1 max-w-xs whitespace-normal text-xs text-muted-foreground">{item.catatan_pemeriksa}</div>}
                    </td>
                    {isKarwas && <td className="p-3 text-right">{item.status === "DIAJUKAN" && <Button size="sm" onClick={() => onReview(item)}>Tinjau</Button>}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pendingExtension && isSubmitter && <p className="text-xs text-muted-foreground">Pengajuan perpanjangan sedang diperiksa. Pengajuan baru dapat dibuat setelah pemeriksaan ini selesai.</p>}
        {!extensionOpenForSubmission && isSubmitter && projectEndDate && isExpired && <p className="flex items-center gap-2 text-xs text-amber-700"><Clock3 size={14} /> Masa SK telah berakhir; perpanjangan tidak dapat diajukan setelah tanggal tersebut.</p>}
      </div>
    </section>
  );
}
