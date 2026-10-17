"use client";

import { HrisResourcePage } from "@/components/hris/HrisResourcePage";

export function PenggunaResourcePage() {
  return (
    <HrisResourcePage
      title="Pengguna"
      description="Daftar akun pengguna sistem."
      group="users"
      method="usersGetControllerGetData"
      columns={[
        { key: "nama", header: "Nama" },
        { key: "email", header: "Email" },
        { key: "nama_role", header: "Role", render: (value, row) => String(value ?? row.role ?? "—") },
        { key: "roles", header: "Hak akses", render: (value) => (Array.isArray(value) ? value.join(", ") : "—") },
        { key: "nama_unit_kerja", header: "Unit kerja" },
        { key: "status", header: "Status", render: (value) => String(value ?? "—") },
      ]}
    />
  );
}
