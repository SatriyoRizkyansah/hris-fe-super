import { expect, test } from "@playwright/test";

test("pegawai page renders list, filters and empty state", async ({ page, context }) => {
  const session = encodeURIComponent(JSON.stringify({ token: "test-token", user: { name: "Admin Test", role: "superadmin", email: "admin@example.test", initials: "AT" } }));
  await context.addCookies([{ name: "lemigas_session", value: session, url: "http://localhost:3000" }]);
  await page.route("**/api/pegawai**", async (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: 200, message: "OK", data: [], pagination: { page: 1, limit: 10, total_pages: 1, total_datas: 0 } }) }),
  );
  await page.goto("http://localhost:3000/dashboard/pegawai");
  await expect(page.getByRole("heading", { name: "Data Pegawai" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tambah Pegawai" })).toBeVisible();
  await expect(page.getByLabel("Cari pegawai")).toBeVisible();
  await expect(page.getByText("Tidak ada data pegawai.")).toBeVisible();
});

test("pegawai page redirects unauthenticated users to login", async ({ page }) => {
  await page.goto("http://localhost:3000/dashboard/pegawai");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Fpegawai/);
});
