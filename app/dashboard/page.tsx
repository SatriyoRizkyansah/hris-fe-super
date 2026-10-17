import { LayoutTemplate, Rocket, Wrench } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const templateAreas = [
  {
    title: "Halaman baru",
    description: "Tambahkan route di app/dashboard untuk memulai fitur baru.",
    icon: LayoutTemplate,
  },
  {
    title: "Komponen UI",
    description: "Gunakan kembali komponen dari components/ui dan components/common.",
    icon: Wrench,
  },
  {
    title: "Integrasi API",
    description: "Sambungkan endpoint melalui utilitas dan hooks yang sudah tersedia di lib/api.",
    icon: Rocket,
  },
];

export default function DashboardPage() {
  return (
    <section className="space-y-8 py-1" aria-labelledby="template-title">
      <div>
        <h1 id="template-title" className="text-2xl font-bold tracking-tight">
          LEMIGAS Frontend Template
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Mulai pengembangan aplikasi LEMIGAS dari halaman ini.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {templateAreas.map(({ title, description, icon: Icon }) => (
          <Card key={title}>
            <CardHeader className="space-y-3">
              <Icon className="size-5 text-primary" aria-hidden="true" />
              <div>
                <CardTitle className="text-base">{title}</CardTitle>
                <CardDescription className="mt-1">{description}</CardDescription>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">Belum ada data aplikasi. Tambahkan fitur dan data sesuai kebutuhan proyek baru.</CardContent>
      </Card>
    </section>
  );
}
