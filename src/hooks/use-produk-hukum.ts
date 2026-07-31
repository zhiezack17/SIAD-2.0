import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  produkHukumApi,
  type CreateProdukHukumInput,
  type ListProdukHukumParams,
  type StatusProdukHukum,
} from "@/lib/produk-hukum";

const keys = {
  all: ["produk-hukum"] as const,
  list: (params?: ListProdukHukumParams) =>
    [...keys.all, "list", params] as const,
  detail: (id: string) => [...keys.all, "detail", id] as const,
};

export function useProdukHukumList(params?: ListProdukHukumParams) {
  return useQuery({
    queryKey: keys.list(params),
    queryFn: () => produkHukumApi.list(params),
  });
}

export function useProdukHukumDetail(id: string) {
  return useQuery({
    queryKey: keys.detail(id),
    queryFn: () => produkHukumApi.get(id),
    enabled: !!id,
  });
}

export function useCreateProdukHukum() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProdukHukumInput) => produkHukumApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useUpdateProdukHukumStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: StatusProdukHukum }) =>
      produkHukumApi.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useDeleteProdukHukum() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => produkHukumApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}
