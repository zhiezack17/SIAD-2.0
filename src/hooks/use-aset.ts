import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  asetApi,
  type CreateAsetInput,
  type ListAsetParams,
  type MutasiAsetInput,
  type UpdateAsetInput,
} from "@/lib/aset";

const keys = {
  all: ["aset"] as const,
  list: (params?: ListAsetParams) => [...keys.all, "list", params] as const,
  detail: (id: string) => [...keys.all, "detail", id] as const,
};

export function useAsetList(params?: ListAsetParams) {
  return useQuery({
    queryKey: keys.list(params),
    queryFn: () => asetApi.list(params),
  });
}

export function useAsetDetail(id: string) {
  return useQuery({
    queryKey: keys.detail(id),
    queryFn: () => asetApi.get(id),
    enabled: !!id,
  });
}

export function useCreateAset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAsetInput) => asetApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useUpdateAset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAsetInput }) =>
      asetApi.update(id, input),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: keys.detail(id) });
      qc.invalidateQueries({ queryKey: keys.all });
    },
  });
}

export function useMutasiAset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: MutasiAsetInput }) =>
      asetApi.mutate(id, input),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: keys.detail(id) });
      qc.invalidateQueries({ queryKey: keys.all });
    },
  });
}

export function useDeleteAset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => asetApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}
