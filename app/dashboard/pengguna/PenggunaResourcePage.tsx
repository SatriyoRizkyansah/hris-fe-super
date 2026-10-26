"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { HrisResourcePage } from "@/components/hris/HrisResourcePage";
import { Button } from "@/components/ui/Button";
import { useCurrentUser } from "@/lib/api/hooks";
import { useUsers, type UserRecord } from "./user-api";
import UserForm from "./UserForm";

export function PenggunaResourcePage() {
  const currentUser = useCurrentUser();
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | undefined>();
  const [refreshKey, setRefreshKey] = useState(0);
  const canManage = currentUser.data?.role?.toUpperCase() === "SUPERADMIN";
  const users = useUsers({ query: undefined, page: 1, limit: 10 });
  return (
    <>
      <HrisResourcePage
        key={refreshKey}
        title="Pengguna"
        description="Daftar akun pengguna sistem."
        group="users"
        method="usersGetControllerGetData"
        headerAction={
          canManage ? (
            <Button
              type="button"
              onClick={() => {
                setEditingUser(undefined);
                setFormOpen(true);
              }}
            >
              <Plus size={18} /> Tambah Pengguna
            </Button>
          ) : null
        }
        filters={[
          {
            field: "role",
            label: "Role",
            options: [
              { label: "Superadmin", value: "SUPERADMIN" },
              { label: "Koordinator", value: "KOORDINATOR" },
              { label: "Subkoordinator", value: "SUBKOOR" },
              { label: "Karyawan", value: "KARYAWAN" },
              { label: "Keuangan", value: "KEUANGAN" },
              { label: "Pimpinan", value: "PIMPINAN" },
              { label: "SPI", value: "SPI" },
            ],
          },
          {
            field: "status",
            label: "Status",
            options: [
              { label: "Aktif", value: "AKTIF" },
              { label: "Nonaktif", value: "NONAKTIF" },
            ],
          },
        ]}
        columns={[
          { key: "nama", header: "Nama" },
          { key: "email", header: "Email" },
          { key: "nama_role", header: "Role", render: (value, row) => String(value ?? row.role ?? "—") },
          { key: "roles", header: "Hak akses", render: (value) => (Array.isArray(value) ? value.join(", ") : "—") },
          { key: "nama_unit_kerja", header: "Unit kerja" },
          { key: "status", header: "Status", render: (value) => String(value ?? "—") },
          ...(canManage
            ? [
                {
                  key: "aksi",
                  header: "Aksi",
                  render: (_value: unknown, row: Record<string, any>) => (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingUser({
                          id: String(row.id),
                          nama: String(row.nama ?? ""),
                          email: String(row.email ?? ""),
                          unitKerja: row.nama_unit_kerja ?? null,
                          status: String(row.status ?? "aktif").toLowerCase() as "aktif" | "nonaktif",
                          role: { id: String(row.role ?? ""), kode: String(row.role ?? ""), nama: String(row.nama_role ?? row.role ?? "") },
                          roles: Array.isArray(row.roles) ? row.roles.map(String) : [String(row.role ?? "")],
                          createdAt: String(row.created_at ?? ""),
                        });
                        setFormOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                  ),
                },
              ]
            : []),
        ]}
      />
      {formOpen && (
        <UserForm
          user={editingUser}
          canManage={canManage}
          onClose={() => {
            setFormOpen(false);
            setEditingUser(undefined);
          }}
          onSaved={() => {
            setFormOpen(false);
            setEditingUser(undefined);
            setRefreshKey((value) => value + 1);
            void users.refetch();
          }}
        />
      )}
    </>
  );
}
