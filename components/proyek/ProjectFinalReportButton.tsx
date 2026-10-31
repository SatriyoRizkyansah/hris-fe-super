"use client";

import { useState } from "react";
import { FileText, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { browserApi } from "@/lib/api/browser-client";
import { setBrowserToken } from "@/lib/api/hooks";
import { apiErrorMessage, envelopeData, envelopeRows, unwrapEnvelope } from "@/lib/hris/api";
import { buildProjectReportHtml } from "@/lib/hris/project-report";
import type { ProyekItemDto } from "@/lib/api/generated/api-generated";

type Row = Record<string, unknown>;

export function ProjectFinalReportButton({ project, compact = false }: { project: ProyekItemDto; compact?: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function openReport() {
    if (pending) return;
    setError("");
    const reportWindow = window.open("about:blank", "_blank");
    if (!reportWindow) {
      setError("Izinkan pop-up browser untuk membuka laporan PDF.");
      return;
    }
    reportWindow.opener = null;
    reportWindow.document.write("<!doctype html><html><head><title>Menyiapkan laporan</title></head><body style='font:14px Arial;padding:32px'>Menyiapkan laporan akhir proyek…</body></html>");
    setPending(true);

    try {
      setBrowserToken();
      const firstRosResponse = await browserApi.masterRo.roControllerGetData({ id_proyek: project.id, limit: 100, page: 1 });
      const firstRosEnvelope = unwrapEnvelope<Row[]>(firstRosResponse);
      const ros = Array.isArray(firstRosEnvelope.data) ? [...firstRosEnvelope.data] : [];
      const totalPages = Math.max(1, Number(firstRosEnvelope.pagination?.total_pages) || 1);
      if (totalPages > 1) {
        const remainingPages = await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) =>
          browserApi.masterRo.roControllerGetData({ id_proyek: project.id, limit: 100, page: index + 2 }),
        ));
        remainingPages.forEach((response) => ros.push(...envelopeRows<Row>(response)));
      }
      if (ros.some((ro) => ro.can_access_detail === false)) {
        throw new Error("Laporan lengkap hanya tersedia bagi pengguna yang memiliki akses ke seluruh detail RO proyek.");
      }

      const roDetails: Row[] = [];
      for (let index = 0; index < ros.length; index += 8) {
        const batch = ros.slice(index, index + 8);
        const detailResponses = await Promise.all(batch.map((ro) => browserApi.masterRo.roControllerGetDetail(String(ro.id))));
        roDetails.push(...detailResponses.map((response) => envelopeData<Row>(response) ?? {}));
      }

      const generatedAt = new Date();
      const html = buildProjectReportHtml({
        project,
        ros,
        roDetails,
        logoUrl: `${window.location.origin}/images/lemigas.webp`,
        generatedAt,
      });
      reportWindow.addEventListener("load", () => {
        window.setTimeout(() => {
          reportWindow.focus();
          reportWindow.print();
        }, 250);
      }, { once: true });
      reportWindow.document.open();
      reportWindow.document.write(html);
      reportWindow.document.close();
    } catch (caught) {
      reportWindow.close();
      setError(apiErrorMessage(caught, "Laporan proyek gagal disiapkan."));
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => void openReport()} title="Buka laporan akhir proyek dan simpan sebagai PDF">
        {pending ? <LoaderCircle size={15} className="animate-spin" /> : <FileText size={15} />}
        {!compact && (pending ? "Menyiapkan..." : "Laporan Akhir")}
        {compact && <><span>PDF</span><span className="sr-only"> Laporan Akhir proyek</span></>}
      </Button>
      {error && <span role="alert" className="max-w-48 text-right text-[11px] leading-tight text-destructive">{error}</span>}
    </span>
  );
}
