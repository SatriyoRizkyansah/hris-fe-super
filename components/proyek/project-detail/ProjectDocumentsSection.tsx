import { DocumentLinks } from "@/components/common/DocumentLinks";
import type { ProjectDetail } from "./types";

export function ProjectDocumentsSection({ project }: { project: ProjectDetail }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
      <div className="border-b bg-muted/40 px-5 py-4">
        <h2 className="font-semibold">Dokumen proyek</h2>
        <p className="mt-1 text-sm text-muted-foreground">Dokumen administrasi yang tersimpan dan dapat dibuka.</p>
      </div>
      <div className="p-5">
        <DocumentLinks documents={[
          { label: "Kontrak Proyek", path: project.file_sk },
          { label: "RAB Proyek", path: project.file_rab },
          { label: "Notulen", path: project.file_notulen },
          { label: "BAST Proyek", path: project.file_bast },
        ]} />
      </div>
    </section>
  );
}
