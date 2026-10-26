"use client";

import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken } from "@/lib/api/hooks";
import { use_query } from "@/lib/api/use_query";
import { use_mutation } from "@/lib/api/use_mutation";
import { apiQueryKeys } from "@/lib/api/query-keys";
import { getApiErrorMessage } from "@/lib/api/errors";
import type { CreateUserDto, UpdateUserDto } from "@/lib/api/generated/api-generated";

export type UserRole = { id: string; kode: string; nama: string };
export type UserRecord = {
  id: string;
  nama: string;
  email: string;
  unitKerja: string | null;
  status: "aktif" | "nonaktif";
  vendorId?: string | null;
  vendor?: { id: string; nama: string } | null;
  roles?: string[];
  createdAt: string;
  role: UserRole;
};
type Envelope<T> = { status: number; message: string; data: T };
type UserList = Envelope<UserRecord[]> & { pagination: { page: number; limit: number; total_datas: number; total_pages: number } };
export type UserParams = { query?: string; page: number; limit: number };
export type UserCommand = { kind: "create"; body: CreateUserDto } | { kind: "update"; id: string; body: UpdateUserDto } | { kind: "deactivate"; id: string };

// Generated responses are void; local envelopes mirror the audited controllers.
async function request<T>(send: () => Promise<{ data: unknown }>): Promise<T> {
  setBrowserToken();
  return apiData(send()) as Promise<T>;
}

export function useUsers(params: UserParams) {
  return use_query<UserList, Error, UserParams>({
    tag: "user",
    method: "usersGetControllerGetData",
    params,
    queryFn: (query) => request(() => browserApi.users.usersGetControllerGetData(query, { format: "json" })),
  });
}

export function useUserRoles() {
  return use_query<Envelope<UserRole[]>, Error, Record<string, never>>({
    tag: "user",
    method: "usersGetControllerGetData",
    params: {},
    queryFn: async () => ({
      status: 200,
      message: "Daftar role HRIS",
      data: ["SUPERADMIN", "KOORDINATOR", "SUBKOOR", "KARYAWAN", "KEUANGAN", "KEU_BILLING", "KEU_BENDAHARA", "KEU_KARWAS", "PIMPINAN", "SPI"].map((kode) => ({ id: kode, kode, nama: kode })),
    }),
  });
}

export function useUserDetail(id: string | undefined) {
  return use_query<Envelope<UserRecord>, Error, { id?: string }>({
    tag: "user",
    method: "usersGetControllerGetData",
    params: { id },
    enabled: Boolean(id),
    queryFn: async () => {
      throw new Error("Endpoint detail user belum tersedia pada API HRIS.");
    },
  });
}

export function useUserWrite() {
  return use_mutation<unknown, unknown, UserCommand>({
    tag: "user",
    method: "administration",
    invalidateKeys: [apiQueryKeys.resource("user"), apiQueryKeys.resource("auth"), apiQueryKeys.resource("dashboard")],
    mutationFn: (command) =>
      request(() => {
        if (command.kind === "create") return browserApi.users.usersPostControllerCreate(command.body, { format: "json" });
        if (command.kind === "update") return browserApi.users.usersPutControllerUpdate(command.id, command.body, { format: "json" });
        throw new Error("Endpoint nonaktifkan user belum tersedia pada API HRIS.");
      }),
  });
}

export function userError(error: unknown): string {
  const http = error as { status?: number; error?: { statusCode?: number; code?: string } } | null;
  const message = getApiErrorMessage(error);
  if (http?.status === 409 || http?.error?.statusCode === 409 || http?.error?.code === "P2002" || /email sudah digunakan|unique constraint|P2002/i.test(message)) {
    return "Email sudah digunakan. Gunakan email lain.";
  }
  return message;
}
