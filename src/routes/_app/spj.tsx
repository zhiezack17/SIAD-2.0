import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Layout induk untuk modul SPJ Kegiatan.
 * Semua rute anak (index, detail kegiatan, dll.) dirender melalui <Outlet />.
 */
export const Route = createFileRoute("/_app/spj")({
  component: SpjLayout,
});

function SpjLayout() {
  return <Outlet />;
}
