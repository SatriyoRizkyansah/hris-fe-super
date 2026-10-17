"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { browserApi } from "@/lib/api/browser-client";
import { setBrowserToken } from "@/lib/api/hooks";
import { use_mutation } from "@/lib/api/use_mutation";
import { use_query } from "@/lib/api/use_query";
import { apiErrorMessage, envelopeRows } from "@/lib/hris/api";
import type { CreateRoDto, ProyekItemDto } from "@/lib/api/generated/api-generated";

type Row = Record<string, unknown>;
type Form = {
  nama_ro: string;
  id_mak: string;
  id_proyek: string;
  id_unit_koordinator: string;
  id_rekening: string;
  tahun_fiscal: string;
  total_plafon: string;
  no_kontrak: string;
  pj: string;
  no_sk: string;
  mulai_sk: string;
  berakhir_sk: string;
};
const blank = (): Form => ({
  nama_ro: "",
  id_mak: "",
  id_proyek: "",
  id_unit_koordinator: "",
  id_rekening: "",
  tahun_fiscal: String(new Date().getFullYear()),
  total_plafon: "",
  no_kontrak: "",
  pj: "",
  no_sk: "",
  mulai_sk: "",
  berakhir_sk: "",
});

export function CreateRoDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: () => Promise<unknown> | void }) {
  const [form, setForm] = useState<Form>(blank);
  const [error, setError] = useState("");
  const mak = use_query({
    tag: "masterMak",
    method: "options",
    params: {},
    queryFn: async () => {
      setBrowserToken();
      return browserApi.masterMak.masterMakControllerFindAll();
    },
  });
  const project = use_query({
    tag: "masterProyek",
    method: "options",
    params: {},
    queryFn: async () => {
      setBrowserToken();
      return browserApi.masterProyek.proyekControllerGetData({ limit: 200 });
    },
  });
  const unit = use_query({
    tag: "masterUnitKerja",
    method: "coordinator-options",
    params: {},
    queryFn: async () => {
      setBrowserToken();
      return browserApi.masterUnitKerja.unitKerjaGetControllerGetData({ tipe_unit: "KOORDINATOR", limit: 200 });
    },
  });
  const rekening = use_query({
    tag: "masterRekening",
    method: "options",
    params: {},
    queryFn: async () => {
      setBrowserToken();
      return browserApi.masterRekeningBank.masterRekeningControllerFindAll();
    },
  });
  const create = use_mutation({
    tag: "masterRo",
    method: "create",
    mutationFn: async (data: CreateRoDto) => {
      setBrowserToken();
      return browserApi.masterRo.roControllerCreate(data);
    },
    onSuccess: async () => {
      await onCreated();
      setForm(blank());
      setError("");
      onOpenChange(false);
    },
  });
  const maks = envelopeRows<Row>(mak.data);
  const projects = envelopeRows<ProyekItemDto>(project.data);
  const units = envelopeRows<Row>(unit.data);
  const rekenings = envelopeRows<Row>(rekening.data);
  const field = (key: keyof Form, value: string) => setForm((state) => ({ ...state, [key]: value }));
  async function submit() {
    if (!form.nama_ro || !form.id_mak || !form.id_proyek || !form.id_unit_koordinator || !form.tahun_fiscal || Number(form.total_plafon) <= 0) {
      setError("MAK, nama, proyek, unit koordinator, tahun fiskal, dan plafon wajib diisi.");
      return;
    }
    if (form.mulai_sk && form.berakhir_sk && form.berakhir_sk < form.mulai_sk) {
      setError("Berakhir SK tidak boleh sebelum Mulai SK.");
      return;
    }
    try {
      setError("");
      await create.mutateAsync({
        nama_ro: form.nama_ro,
        id_mak: form.id_mak,
        id_proyek: form.id_proyek,
        id_unit_koordinator: form.id_unit_koordinator,
        id_rekening: form.id_rekening || undefined,
        tahun_fiscal: Number(form.tahun_fiscal),
        total_plafon: Number(form.total_plafon),
        no_kontrak: form.no_kontrak || undefined,
        pj: form.pj || undefined,
        no_sk: form.no_sk || undefined,
        mulai_sk: form.mulai_sk || undefined,
        berakhir_sk: form.berakhir_sk || undefined,
      });
    } catch (cause) {
      setError(apiErrorMessage(cause, "Gagal membuat RO."));
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tambah RO</DialogTitle>
          <DialogDescription>RO mandiri hanya untuk Superadmin. Total plafon tidak boleh melampaui direct cost proyek.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            Nama RO *<Input value={form.nama_ro} onChange={(event) => field("nama_ro", event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            Tahun fiskal *<Input type="number" value={form.tahun_fiscal} onChange={(event) => field("tahun_fiscal", event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            MAK *
            <select className="h-9 rounded-md border bg-background px-3 text-sm" value={form.id_mak} onChange={(event) => field("id_mak", event.target.value)}>
              <option value="">Pilih MAK</option>
              {maks.map((row) => (
                <option key={String(row.id)} value={String(row.id)}>
                  {String(row.kode_mak)} — {String(row.nama_mak)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Proyek *
            <select className="h-9 rounded-md border bg-background px-3 text-sm" value={form.id_proyek} onChange={(event) => field("id_proyek", event.target.value)}>
              <option value="">Pilih proyek</option>
              {projects.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.kode_proyek} — {row.nama_proyek}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Unit koordinator *
            <select className="h-9 rounded-md border bg-background px-3 text-sm" value={form.id_unit_koordinator} onChange={(event) => field("id_unit_koordinator", event.target.value)}>
              <option value="">Pilih unit</option>
              {units.map((row) => (
                <option key={String(row.id)} value={String(row.id)}>
                  {String(row.kode_unit)} — {String(row.nama_unit)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Rekening bank
            <select className="h-9 rounded-md border bg-background px-3 text-sm" value={form.id_rekening} onChange={(event) => field("id_rekening", event.target.value)}>
              <option value="">Tanpa rekening</option>
              {rekenings.map((row) => (
                <option key={String(row.id)} value={String(row.id)}>
                  {String(row.nama_bank)} — {String(row.nomor_rekening)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm sm:col-span-2">
            Plafon *<Input type="number" min="1" value={form.total_plafon} onChange={(event) => field("total_plafon", event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            No kontrak
            <Input value={form.no_kontrak} onChange={(event) => field("no_kontrak", event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            PJ
            <Input value={form.pj} onChange={(event) => field("pj", event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            No SK
            <Input value={form.no_sk} onChange={(event) => field("no_sk", event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            Mulai SK
            <Input type="date" value={form.mulai_sk} onChange={(event) => field("mulai_sk", event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            Berakhir SK
            <Input type="date" value={form.berakhir_sk} onChange={(event) => field("berakhir_sk", event.target.value)} />
          </label>
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button disabled={create.isPending} onClick={submit}>
            {create.isPending && <LoaderCircle className="animate-spin" size={16} />} Simpan RO
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
