"use client";

import { useState } from "react";
import { ArrowRight, BriefcaseBusiness, ClipboardCheck, FileUp, ReceiptText, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";

export type ProjectWorkflowAction = { label: string; onClick?: () => void; href?: string };

const stages = [
  {
    title: "Ajukan proyek",
    owner: "KOORDINATOR",
    icon: BriefcaseBusiness,
    color: "sky",
    summary: "Isi informasi proyek, unit terlibat, RO awal, dan rencana termin.",
    result: "MENUNGGU_VALIDASI_UMUM",
    next: "Pengajuan masuk ke antrean pemeriksaan Koordinator Umum.",
  },
  {
    title: "Validasi Koordinator Umum",
    owner: "KOORDINATOR UMUM",
    icon: ShieldCheck,
    color: "violet",
    summary: "Periksa kelengkapan usulan dan kesesuaian administrasi proyek.",
    result: "MENUNGGU_NOTULEN",
    next: "Jika disetujui, koordinator pengusul melengkapi notulen. Jika ditolak, status menjadi DITOLAK_UMUM.",
  },
  {
    title: "Unggah notulen",
    owner: "KOORDINATOR PENGUSUL",
    icon: FileUp,
    color: "amber",
    summary: "Unggah notulen sebagai dokumen pendukung setelah validasi awal.",
    result: "MENUNGGU_VALIDASI_PIMPINAN",
    next: "Setelah file notulen tersimpan, proyek diteruskan ke antrean Pimpinan.",
  },
  {
    title: "Persetujuan Pimpinan",
    owner: "PIMPINAN",
    icon: ClipboardCheck,
    color: "indigo",
    summary: "Tinjau proyek dan dokumen sebelum memberikan keputusan akhir.",
    result: "DISETUJUI_PIMPINAN",
    next: "Jika ditolak, status menjadi DITOLAK_PIMPINAN. Jika disetujui, RO proyek menjadi aktif.",
  },
  {
    title: "RO aktif & pelaksanaan",
    owner: "UNIT / BILLING / BENDAHARA",
    icon: ReceiptText,
    color: "emerald",
    summary: "Unit menjalankan RO; tagihan termin dan penerimaan diproses melalui modul keuangan.",
    result: "DISETUJUI_PIMPINAN / RO AKTIF",
    next: "Billing menerbitkan invoice termin dan Bendahara mencatat penerimaan pada alur Penagihan/Invoice.",
  },
] as const;

const tones = {
  sky: { icon: "bg-sky-100 text-sky-700", selected: "border-sky-300 bg-sky-50", detail: "border-sky-200 bg-sky-50/70", text: "text-sky-800" },
  violet: { icon: "bg-violet-100 text-violet-700", selected: "border-violet-300 bg-violet-50", detail: "border-violet-200 bg-violet-50/70", text: "text-violet-800" },
  amber: { icon: "bg-amber-100 text-amber-800", selected: "border-amber-300 bg-amber-50", detail: "border-amber-200 bg-amber-50/70", text: "text-amber-900" },
  indigo: { icon: "bg-indigo-100 text-indigo-700", selected: "border-indigo-300 bg-indigo-50", detail: "border-indigo-200 bg-indigo-50/70", text: "text-indigo-800" },
  emerald: { icon: "bg-emerald-100 text-emerald-700", selected: "border-emerald-300 bg-emerald-50", detail: "border-emerald-200 bg-emerald-50/70", text: "text-emerald-800" },
} as const;

export function ProjectWorkflowDiagram({ actions }: { actions: ProjectWorkflowAction[] }) {
  const [activeStage, setActiveStage] = useState(0);
  const stage = stages[activeStage];
  const Icon = stage.icon;
  const tone = tones[stage.color];

  return (
    <Card className="overflow-hidden border-slate-200 shadow-none">
      <CardHeader className="gap-1 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Alur proyek</CardTitle>
            <CardDescription>Pilih tahap untuk melihat penanggung jawab dan hasilnya, atau gunakan tombol pada tahap untuk memulai aksinya.</CardDescription>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-600">5 tahap</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="pb-1">
          <ol className="grid grid-cols-5 gap-2" aria-label="Tahapan alur proyek">
            {stages.map((item, index) => {
              const StepIcon = item.icon;
              const stepTone = tones[item.color];
              const selected = activeStage === index;
              const action = actions[index];
              return (
                <li key={item.title} className="relative min-w-0">
                  <div className={`flex h-[192px] min-w-0 flex-col rounded-xl border p-2.5 transition-colors ${selected ? stepTone.selected : "border-slate-200 bg-white"}`}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setActiveStage(index)}
                      className="flex min-h-0 w-full flex-1 flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                    >
                      <span className="flex w-full items-center justify-between">
                        <span className={`flex size-8 items-center justify-center rounded-lg ${stepTone.icon}`}><StepIcon size={16} /></span>
                        <span className={`flex size-6 items-center justify-center rounded-full text-xs font-semibold ${selected ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"}`}>{index + 1}</span>
                      </span>
                      <span className={`mt-1.5 flex h-5 min-w-0 items-center truncate text-[10px] font-semibold uppercase leading-3 tracking-[0.1em] ${stepTone.text}`} title={item.owner}>{item.owner}</span>
                      <span className="line-clamp-2 h-10 text-sm font-semibold leading-5 text-slate-900">{item.title}</span>
                      <span className="mt-1 line-clamp-2 h-8 text-xs leading-4 text-slate-500">{item.summary}</span>
                    </button>
                    {action && <WorkflowActionButton action={action} />}
                  </div>
                  {index < stages.length - 1 && <ArrowRight aria-hidden="true" size={17} className="absolute -right-2.5 top-1/2 z-10 hidden -translate-y-1/2 text-slate-300 2xl:block" />}
                </li>
              );
            })}
          </ol>
        </div>

        <div className={`grid gap-3 rounded-xl border p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center ${tone.detail}`} aria-live="polite">
          <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${tone.icon}`}><Icon size={20} /></span>
          <div className="min-w-0 sm:col-start-2 sm:row-start-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-slate-950">Tahap {activeStage + 1}: {stage.title}</p>
              <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">{stage.owner}</span>
            </div>
            <p className="mt-1 text-sm leading-5 text-slate-700">{stage.next}</p>
          </div>
          <div className="max-w-[17rem] rounded-lg border border-white/80 bg-white/80 px-3 py-2 sm:col-start-3 sm:row-start-1 sm:justify-self-end">
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Status / hasil</p>
            <p className="mt-1 break-words text-xs font-semibold text-slate-800">{stage.result}</p>
          </div>
        </div>

        <p className="border-t border-slate-100 pt-3 text-xs leading-5 text-muted-foreground">Penolakan dapat terjadi pada validasi Koordinator Umum atau Pimpinan. Penerbitan invoice termin dan pencatatan pembayaran dilanjutkan di modul Penagihan/Invoice setelah proyek disetujui.</p>
      </CardContent>
    </Card>
  );
}

function WorkflowActionButton({ action }: { action: ProjectWorkflowAction }) {
  if (action.href) {
    return <Button size="sm" variant="ghost" className="mt-1.5 h-8 w-full justify-between border-t border-slate-200/70 px-1 pt-1.5 text-xs" render={<Link href={action.href} />}>
      <span className="truncate">{action.label}</span><ArrowRight size={14} className="shrink-0" />
    </Button>;
  }
  return <Button size="sm" variant="ghost" className="mt-1.5 h-8 w-full justify-between border-t border-slate-200/70 px-1 pt-1.5 text-xs" onClick={action.onClick}>
    <span className="truncate">{action.label}</span><ArrowRight size={14} className="shrink-0" />
  </Button>;
}
