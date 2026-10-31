import type { ProyekItemDto } from "@/lib/api/generated/api-generated";

type ReportRow = Record<string, unknown>;
type ItemDetail = { quantity?: string; unit?: string; unitPrice?: number; note: string };

function row(value: unknown): ReportRow {
  return value && typeof value === "object" ? (value as ReportRow) : {};
}

function valueText(value: unknown, fallback = "—"): string {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "string" || typeof value === "number") return String(value);
  const item = row(value);
  for (const key of ["nama", "nama_unit", "nama_client", "nama_mak", "label", "name"]) {
    if (item[key] !== null && item[key] !== undefined && item[key] !== "") return String(item[key]);
  }
  return fallback;
}

function escapeHtml(value: unknown): string {
  const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return valueText(value).replace(/[&<>"']/g, (character) => entities[character] ?? character);
}

function amount(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function money(value: unknown): string {
  return new Intl.NumberFormat("id-ID", { style: "decimal", maximumFractionDigits: 0 }).format(amount(value));
}

function date(value: unknown, includeYear = true): string {
  if (!value) return "—";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", ...(includeYear ? { year: "numeric" as const } : {}) }).format(parsed);
}

function unique(values: unknown[]): string[] {
  return [...new Set(values.map((value) => valueText(value, "")).filter(Boolean))];
}

function itemDetail(note: unknown): ItemDetail {
  const source = valueText(note, "");
  const parsed = source.match(/^\s*(\d+(?:[,.]\d+)?)\s+(.+?)\s*[x×]\s*Rp\s*([\d.]+)\s*(?:;\s*(.*))?$/i);
  if (!parsed) return { note: source };
  const unitPrice = Number(parsed[3].replace(/\./g, ""));
  return {
    quantity: parsed[1],
    unit: parsed[2],
    unitPrice: Number.isFinite(unitPrice) ? unitPrice : undefined,
    note: parsed[4] ?? "",
  };
}

function amountCell(value: unknown): string {
  return `<td class="number">${escapeHtml(money(value))}</td>`;
}

export function buildProjectReportHtml(input: {
  project: ProyekItemDto;
  ros: ReportRow[];
  roDetails: ReportRow[];
  logoUrl: string;
  generatedAt: Date;
}): string {
  const { project, ros, roDetails, logoUrl, generatedAt } = input;
  const reports = ros.map((ro, index) => {
    const detail = roDetails[index] ?? {};
    const transactions = Array.isArray(detail.transaksi_list) ? detail.transaksi_list.map(row) : [];
    const expenses = transactions.filter((transaction) => amount(transaction.kredit) > 0 && !String(transaction.keterangan ?? "").startsWith("Alokasi "));
    const budget = amount(ro.nilai_rencana ?? ro.total_plafon);
    return { ro, transactions, expenses, budget };
  });

  const byMak = new Map<string, { code: string; name: string; descriptions: string[]; budget: number }>();
  reports.forEach(({ ro, budget }) => {
    const code = valueText(ro.kode_mak, "");
    const name = valueText(ro.nama_mak, "MAK belum diisi");
    const key = `${code}:${name}`;
    const group = byMak.get(key) ?? { code, name, descriptions: [], budget: 0 };
    const collaboration = Array.isArray(ro.unit_kolaborasi) ? unique(ro.unit_kolaborasi).join(", ") : "";
    group.descriptions.push(valueText(ro.nama_unit_koordinator, "Unit belum tersedia") + " / " + valueText(ro.nama_ro) + (collaboration ? " / Kolaborasi: " + collaboration : ""));
    group.budget += budget;
    byMak.set(key, group);
  });

  const directCost = amount(project.total_direct_cost);
  const contract = amount(project.nilai_kontrak);
  const margin = amount(project.total_margin);
  const profitPercent = contract > 0 ? (margin / contract) * 100 : 0;
  const generatedDate = date(generatedAt);
  const contractNumber = valueText(project.no_kontrak, unique(ros.map((ro) => ro.no_kontrak)).join(" · ") || valueText(project.kode_proyek));
  const jobs = unique(ros.map((ro) => ro.nomor_job));
  const jobCounts = new Map<string, number>();
  for (const job of jobs) jobCounts.set(job, ros.filter((ro) => valueText(ro.nomor_job, "") === job).length);
  const units = unique(project.unit_terlibat?.map((unit) => unit.nama_unit) ?? ros.map((ro) => ro.nama_unit_koordinator));
  const periodStart = project.mulai_proyek ?? ros.map((ro) => ro.mulai_sk).find(Boolean);
  const periodEnd = project.estimasi_selesai_proyek ?? ros.map((ro) => ro.berakhir_sk).find(Boolean);
  const fileName = valueText(project.file_rab || ros.find((ro) => ro.file_rab)?.file_rab, "Rekap aplikasi").split(/[\\/]/).pop() || "Rekap aplikasi";

  const summaryRows = [...byMak.values()].map((group, index) => `<tr>
    <td class="center">${index + 1}</td>
    <td>${escapeHtml(group.code ? `${group.code} · ${group.name}` : group.name)}</td>
    <td>${group.descriptions.map(escapeHtml).join("<br>")}</td>
    ${amountCell(group.budget)}
  </tr>`).join("");

  const allocationRows = reports.map(({ ro, budget }, index) => {
    const percentage = directCost > 0 ? (budget / directCost) * 100 : 0;
    const collaboration = Array.isArray(ro.unit_kolaborasi) ? unique(ro.unit_kolaborasi).join(", ") : "";
    const job = valueText(ro.nomor_job, "");
    const splitParts = job ? (jobCounts.get(job) ?? 0) : 0;
    const splitLabel = splitParts > 1 ? " / RO split " + splitParts : "";
    const allocation = valueText(ro.nama_unit_koordinator, "Unit belum tersedia") + " / " + valueText(ro.nama_ro) + (collaboration ? " / Kolaborasi: " + collaboration : "") + splitLabel;
    return `<tr><td class="center">${index + 1}</td><td>${escapeHtml(allocation)}</td><td class="number">${percentage.toFixed(2)}</td><td>%</td>${amountCell(budget)}</tr>`;
  }).join("");

  const operationalRows = [...byMak.values()].map((group, index) => `<tr><td class="center">${index + 1}</td><td>${escapeHtml(group.code)} · ${escapeHtml(group.name)}</td>${amountCell(group.budget)}</tr>`).join("");

  const detailSections = reports.map(({ ro, expenses }, roIndex) => {
    const rows = expenses.map((transaction, index) => {
      const detail = itemDetail(transaction.keterangan);
      const total = amount(transaction.kredit);
      const unitPrice = detail.unitPrice ?? (detail.quantity ? total / Number(detail.quantity.replace(",", ".")) : undefined);
      return `<tr>
        <td class="center">${index + 1}</td>
        <td>${escapeHtml(valueText(transaction.nama_kegiatan))}${transaction.no_kuitansi ? `<span class="sub">Kuitansi ${escapeHtml(transaction.no_kuitansi)}</span>` : ""}</td>
        <td>${escapeHtml(detail.note)}</td>
        <td class="number">${escapeHtml(detail.quantity ?? "")}</td>
        <td>${escapeHtml(detail.unit ?? "")}</td>
        <td class="number">${unitPrice === undefined ? "" : escapeHtml(money(unitPrice))}</td>
        ${amountCell(total)}
      </tr>`;
    }).join("");
    const expenseTotal = expenses.reduce((sum, transaction) => sum + amount(transaction.kredit), 0);
    return `<section class="mak-section">
      <div class="group-title"><strong>${escapeHtml(valueText(ro.kode_mak))} · ${escapeHtml(valueText(ro.nama_mak))}</strong><span>${escapeHtml(valueText(ro.nama_unit_koordinator, "Unit belum tersedia"))} · ${escapeHtml(valueText(ro.nama_ro))}</span></div>
      <table><thead><tr><th class="center">No.</th><th>Uraian</th><th>Rincian / keterangan</th><th class="number">Jumlah</th><th>Satuan</th><th class="number">Unit Biaya [Rp]</th><th class="number">Total [Rp]</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="7" class="empty">Belum ada rincian transaksi.</td></tr>`}</tbody>
        <tfoot><tr><th colspan="6">Total ${escapeHtml(valueText(ro.nama_mak))}</th>${amountCell(expenseTotal || reports[roIndex].budget)}</tr></tfoot>
      </table>
    </section>`;
  }).join("");

  return `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(project.nama_proyek)} - Rencana Operasional</title>
<style>
@page{size:A4 portrait;margin:9mm 8mm 10mm}*{box-sizing:border-box}body{margin:0;font:8pt/1.2 Arial,Helvetica,sans-serif;color:#111}.toolbar{position:sticky;top:0;display:flex;justify-content:flex-end;gap:8px;padding:9px;background:#f3f4f6;border-bottom:1px solid #bbb}.toolbar button{padding:6px 10px;border:1px solid #888;background:#fff;border-radius:3px;font:inherit;cursor:pointer}.sheet{max-width:194mm;margin:10px auto;padding:0}.letterhead{display:grid;grid-template-columns:23mm 1fr;gap:2mm;align-items:center;border-bottom:1.3px solid #111;padding-bottom:2mm;margin-bottom:3mm}.logo{width:19mm;height:19mm;object-fit:contain}.institution{text-align:center;font-weight:600;text-transform:uppercase;line-height:1.25}.institution div:first-child{font-size:8.5pt}.institution div{font-size:7.5pt}.metadata{width:100%;border-collapse:collapse;margin:2mm 0 3mm}.metadata td{border:0;padding:1.05mm 1mm;vertical-align:top}.metadata td:first-child{width:21mm}.metadata td:nth-child(2){width:3mm;text-align:center}.metadata td:nth-child(3){font-weight:500}.metadata .amount{font-weight:700}.title{text-align:center;margin:1mm 0;font-size:10pt;text-transform:uppercase}.subtitle{text-align:center;margin:0 0 3mm;font-weight:700;font-size:8.5pt;text-transform:uppercase}.section-heading{font-size:8pt;font-weight:700;text-transform:uppercase;text-align:center;margin:3mm 0 1.3mm}.summary,.allocation,.operational,.items{width:100%;border-collapse:collapse;table-layout:fixed}.summary th,.summary td,.allocation th,.allocation td,.operational th,.operational td,.items th,.items td{border:.45pt solid #333;padding:1mm 1.1mm;vertical-align:top}.summary th,.allocation th,.operational th,.items th{background:#f1f1f1;font-weight:700;text-align:left}.summary th:nth-child(1){width:7mm}.summary th:nth-child(2){width:49mm}.summary th:nth-child(4){width:27mm}.summary td:nth-child(4),.number{text-align:right;white-space:nowrap}.center{text-align:center}.subtotal td,.subtotal th,tfoot th{font-weight:700}.profit-total{display:flex;justify-content:space-between;border-top:.5pt solid #333;padding:1.2mm 1mm;margin-top:1mm;font-weight:700}.evaluation-title,.approval-title{text-align:center;font-weight:700;margin:4mm 0 1mm}.signatures{display:grid;grid-template-columns:1fr 1fr;border:.45pt solid #333;text-align:center}.signatures>div{padding:1.2mm;border-right:.45pt solid #333}.signatures>div:last-child{border:0}.signatures strong,.approval strong{display:block;text-transform:uppercase;font-size:7.5pt}.signature-space{height:15mm}.approval{width:52%;margin:auto;border:.45pt solid #333;text-align:center;padding:1.2mm}.page-break{break-before:page;page-break-before:always}.form-heading{text-align:center;font-weight:700;font-size:10pt;margin:0 0 1mm;text-transform:uppercase}.form-subheading{text-align:center;font-weight:700;font-size:8.5pt;margin:0 0 3mm;text-transform:uppercase}.form-meta{width:100%;border-collapse:collapse;margin:2mm 0}.form-meta td{border:.4pt solid #333;padding:1.15mm}.form-meta td:nth-child(odd){font-weight:600;width:17%}.form-meta td:nth-child(even){width:33%}.form-meta .money{white-space:nowrap;text-align:right}.allocation th:first-child{width:7mm}.allocation th:nth-child(4){width:18mm}.allocation th:nth-child(5){width:30mm}.operational th:first-child{width:18mm}.operational th:last-child{width:32mm}.mak-section{margin:2.3mm 0;break-inside:auto}.group-title{display:flex;justify-content:space-between;gap:4mm;margin:1mm 0;padding:1mm 0;border-bottom:.6pt solid #333;font-size:8pt}.items th:first-child{width:7mm}.items th:nth-child(2){width:38mm}.items th:nth-child(3){width:47mm}.items th:nth-child(4){width:14mm}.items th:nth-child(5){width:17mm}.items th:nth-child(6){width:25mm}.items th:nth-child(7){width:28mm}.sub{display:block;font-size:7pt;color:#444;margin-top:.4mm}.empty{text-align:center;color:#555;padding:3mm}.foot{text-align:right;font-size:7pt;margin-top:3mm;color:#444}thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}
@media print{.toolbar{display:none}.sheet{max-width:none;margin:0}.page-break{break-before:page}.mak-section{break-inside:auto}}
@media screen{body{background:#e5e7eb}.sheet{background:white;padding:8mm;box-shadow:0 2px 14px #0002}}
</style></head><body><div class="toolbar"><button onclick="window.print()">Cetak / Simpan PDF</button><button onclick="window.close()">Tutup</button></div><main class="sheet">
<header class="letterhead"><img class="logo" src="${escapeHtml(logoUrl)}" alt="Logo LEMIGAS"><div class="institution"><div>Kementerian Energi dan Sumber Daya Mineral - Republik Indonesia</div><div>Badan Penelitian dan Pengembangan Energi dan Sumber Daya Mineral</div><div>Pusat Penelitian dan Pengembangan Teknologi Minyak dan Gas Bumi</div></div></header>
<table class="metadata"><tbody>
<tr><td>Kontrak</td><td>:</td><td>${escapeHtml(contractNumber)}<br>${escapeHtml(project.nama_proyek)}<br>${escapeHtml(money(contract))} RUPIAH</td></tr>
<tr><td>Pelanggan</td><td>:</td><td>${escapeHtml(project.nama_client)}</td></tr>
<tr><td>Job</td><td>:</td><td>${escapeHtml(jobs.join(" · ") || "—")}<br>${escapeHtml(project.nama_proyek)}<br>${escapeHtml(money(directCost))} RUPIAH</td></tr>
<tr><td>Durasi</td><td>:</td><td>${escapeHtml(date(periodStart, false))} s.d. ${escapeHtml(date(periodEnd, false))}</td></tr>
<tr><td>Kelompok</td><td>:</td><td>${escapeHtml(units.join(" · ") || "—")}</td></tr>
<tr><td>File / Tgl</td><td>:</td><td>${escapeHtml(fileName)} · Dicetak: ${escapeHtml(generatedDate)}</td></tr>
</tbody></table>
<table class="summary"><thead><tr><th>No</th><th>MAK</th><th>Uraian</th><th class="number">Jumlah</th></tr></thead>
<tbody>${summaryRows || `<tr><td colspan="4" class="empty">Belum ada rincian MAK pada proyek ini.</td></tr>`}</tbody>
<tfoot><tr><th colspan="3">Total Biaya Operasional</th>${amountCell(directCost)}</tr></tfoot></table>
<div class="profit-total"><span>Profit: ${profitPercent.toFixed(2)}%</span><span>Total (Rp): ${escapeHtml(money(directCost))}</span></div>
<div class="evaluation-title">Dievaluasi</div><div class="signatures"><div><strong>Kepala Bagian Umum</strong><div class="signature-space"></div><div>(........................................)</div></div><div><strong>Koordinator ${escapeHtml(units.join(" · "))}</strong><div class="signature-space"></div><div>(${escapeHtml(valueText(project.pj_1))})</div></div></div>
<div class="approval-title">Disetujui</div><div class="approval"><strong>Pimpinan BLU</strong><div class="signature-space"></div><div>(........................................)</div></div>

<div class="page-break"></div>
<h1 class="form-heading">Rencana Operasional</h1><h2 class="form-subheading">Tahun Anggaran ${escapeHtml(project.tahun_fiscal)} · ${escapeHtml(units.join(" · "))}</h2>
<table class="form-meta"><tbody>
<tr><td>Kelompok</td><td>${escapeHtml(units.join(" · ") || "—")}</td><td>Penanggung jawab</td><td>${escapeHtml(valueText(project.pj_1))}</td></tr>
<tr><td>Judul kegiatan</td><td colspan="3">${escapeHtml(project.nama_proyek)}</td></tr>
<tr><td>Nama pelanggan</td><td>${escapeHtml(project.nama_client)}</td><td>Nomor kontrak</td><td>${escapeHtml(contractNumber)}</td></tr>
<tr><td>Nomor Job</td><td>${escapeHtml(jobs.join(" · ") || "—")}</td><td>Durasi</td><td>${escapeHtml(date(periodStart, false))} s.d. ${escapeHtml(date(periodEnd, false))}</td></tr>
<tr><td>Nilai kontrak</td><td class="money">${escapeHtml(money(contract))}</td><td>Direct cost</td><td class="money">${escapeHtml(money(directCost))}</td></tr>
<tr><td>Nilai akhir</td><td class="money">${escapeHtml(money(contract))}</td><td>Profit</td><td class="money">${escapeHtml(money(margin))} · ${profitPercent.toFixed(2)}%</td></tr>
</tbody></table>
<h3 class="section-heading">Rincian Pokok Peruntukan</h3>
<table class="allocation"><thead><tr><th>No.</th><th>Uraian</th><th class="number">Jumlah</th><th>Satuan</th><th class="number">Total (Rp)</th></tr></thead>
<tbody>${allocationRows || `<tr><td colspan="5" class="empty">Belum ada RO.</td></tr>`}</tbody><tfoot><tr><th colspan="2">Total</th><th class="number">${directCost > 0 ? "100,00" : "0,00"}</th><th>%</th>${amountCell(directCost)}</tr></tfoot></table>
<h3 class="section-heading">Biaya Operasional</h3>
<table class="operational"><thead><tr><th>No.</th><th>Uraian</th><th class="number">Total (Rp)</th></tr></thead><tbody>${operationalRows || `<tr><td colspan="3" class="empty">Belum ada biaya operasional.</td></tr>`}</tbody><tfoot><tr><th colspan="2">Total</th>${amountCell(directCost)}</tr></tfoot></table>

<div class="page-break"></div>
<h1 class="form-heading">Biaya Operasional</h1><h2 class="form-subheading">${escapeHtml(project.nama_proyek)} · Tahun Anggaran ${escapeHtml(project.tahun_fiscal)}</h2>
${detailSections || `<p class="empty">Belum ada transaksi pengeluaran.</p>`}
<div class="foot">Dicetak ${escapeHtml(generatedDate)}</div>
</main></body></html>`;
}