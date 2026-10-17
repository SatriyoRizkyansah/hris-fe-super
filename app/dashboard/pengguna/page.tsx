import { HrisResourcePage } from "@/components/hris/HrisResourcePage";
export default function Page() {
  return <HrisResourcePage title="Pengguna" description="Daftar akun pengguna sistem." group="users" method="usersGetControllerGetData" />;
}
