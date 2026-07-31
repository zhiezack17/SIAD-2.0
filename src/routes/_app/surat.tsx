import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Layout induk untuk modul Surat.
 * Semua rute anak (daftar, detail) dirender melalui <Outlet />.
 */
export const Route = createFileRoute("/_app/surat")({
  component: SuratLayout,
});

function SuratLayout() {
  return <Outlet />;
}
