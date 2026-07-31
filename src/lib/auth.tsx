import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  api,
  getStoredTenant,
  getStoredToken,
  setStoredTenant,
  setStoredToken,
} from "./api-client";

/**
 * Auth context sederhana. Sumber kebenaran: VPS API.
 * Frontend hanya menyimpan token JWT di localStorage + tenant aktif.
 */

export type Tenant = {
  id: string;
  kode: string;
  nama: string; // e.g. "Kepenghuluan Bagan Punak"
  kecamatan?: string;
};

export type User = {
  id: string;
  username: string;
  nama: string;
  peran: string;
  role?: string;
  kepenghuluanId: string | null;
  tenants: Tenant[];
};

type BackendUser = {
  id: string;
  username: string;
  nama?: string;
  nama_lengkap?: string;
  peran: string;
  role?: string;
  kepenghuluan_id: string | null;
};

type BackendKepenghuluan = { id: string | number; kecamatan_id?: string | number | null; nama: string };

function isGlobalBackendUser(me: BackendUser): boolean {
  const effectiveRole = me.role ?? me.peran;
  return ["admin", "auditor"].includes(effectiveRole) || me.peran === "admin";
}

function mapTenant(kepenghuluan: BackendKepenghuluan): Tenant {
  const id = String(kepenghuluan.id);
  return {
    id,
    kode: id.slice(0, 8),
    nama: kepenghuluan.nama,
    kecamatan: kepenghuluan.kecamatan_id == null ? undefined : String(kepenghuluan.kecamatan_id),
  };
}

function buildUserTenants(me: BackendUser, kepenghuluan: BackendKepenghuluan[]): Tenant[] {
  if (isGlobalBackendUser(me)) return kepenghuluan.map(mapTenant);
  const matched = kepenghuluan.find((k) => String(k.id) === String(me.kepenghuluan_id));
  return matched ? [mapTenant(matched)] : [];
}

function mapBackendUser(me: BackendUser, tenants: Tenant[]): User {
  // Backend memakai role internal; frontend memakai peran yang sama dengan tampilan.
  const mappedPeran =
    {
      admin: "super_admin",
      operator: "kaur",
      pimpinan: "penghulu",
    }[me.peran] ?? me.peran;

  return {
    id: me.id,
    username: me.username,
    nama: me.nama ?? me.nama_lengkap ?? me.username,
    peran: mappedPeran,
    role: me.role ?? me.peran,
    kepenghuluanId: me.kepenghuluan_id,
    tenants,
  };
}

type AuthState = {
  user: User | null;
  tenant: Tenant | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  switchTenant: (tenantId: string) => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }

    async function loadProfile() {
      try {
        const me = await api.get<BackendUser>("/auth/me");
        const keps = await api.get<BackendKepenghuluan[]>("/master/kepenghuluan");
        const mappedUser = mapBackendUser(me, buildUserTenants(me, keps));
        if (cancelled) return;
        setUser(mappedUser);
        const storedTenant = getStoredTenant();
        const active =
          mappedUser.tenants.find((t) => t.id === storedTenant) ??
          mappedUser.tenants[0] ??
          null;
        setTenant(active);
        if (active) setStoredTenant(active.id);
      } catch {
        setStoredToken(null);
        setStoredTenant(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      tenant,
      loading,
      async login(username, password) {
        const res = await api.post<{ token: string; user: BackendUser }>("/auth/login", {
          username,
          password,
        });
        setStoredToken(res.token);
        const keps = await api.get<BackendKepenghuluan[]>("/master/kepenghuluan");
        const mappedUser = mapBackendUser(res.user, buildUserTenants(res.user, keps));
        setUser(mappedUser);
        const active = mappedUser.tenants[0] ?? null;
        setTenant(active);
        if (active) setStoredTenant(active.id);
      },
      logout() {
        setStoredToken(null);
        setStoredTenant(null);
        setUser(null);
        setTenant(null);
      },
      switchTenant(tenantId) {
        const found = user?.tenants.find((t) => t.id === tenantId);
        if (!found) return;
        setTenant(found);
        setStoredTenant(found.id);
      },
    }),
    [user, tenant, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
