import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  suratApi,
  CreateDisposisiInput,
  CreateSuratKeluarInput,
  CreateSuratMasukInput,
  JenisSurat,
  ListSuratParams,
  SifatSurat,
  TransisiSuratInput,
} from "@/lib/surat";

const SURAT_KEY = "surat";

export function useSuratList(params?: ListSuratParams) {
  return useQuery({
    queryKey: [SURAT_KEY, "list", params],
    queryFn: () => suratApi.listSurat(params),
  });
}

export function useSuratDetail(id: string) {
  return useQuery({
    queryKey: [SURAT_KEY, "detail", id],
    queryFn: () => suratApi.getSurat(id),
    enabled: !!id,
  });
}

export function useCreateSuratMasuk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSuratMasukInput) => suratApi.createSuratMasuk(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SURAT_KEY, "list"] });
    },
  });
}

export function useCreateSuratKeluar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSuratKeluarInput) => suratApi.createSuratKeluar(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SURAT_KEY, "list"] });
    },
  });
}

export function useTransisiSurat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TransisiSuratInput }) =>
      suratApi.transisiSurat(id, input),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: [SURAT_KEY, "list"] });
      qc.invalidateQueries({ queryKey: [SURAT_KEY, "detail", variables.id] });
    },
  });
}

export function useCreateDisposisi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ suratId, input }: { suratId: string; input: CreateDisposisiInput }) =>
      suratApi.createDisposisi(suratId, input),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: [SURAT_KEY, "list"] });
      qc.invalidateQueries({ queryKey: [SURAT_KEY, "detail", variables.suratId] });
    },
  });
}

export type { JenisSurat, ListSuratParams, SifatSurat };
