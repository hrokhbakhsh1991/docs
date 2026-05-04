"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { tourKeys } from "@/lib/query-keys";
import { createTour } from "@/lib/services/tours.service";

import { mapCreateTourDto } from "../domain/mapCreateTourDto";
import type { TourCreateModel } from "../models/tourCreateModel";

export function useCreateTour() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: TourCreateModel) => createTour(mapCreateTourDto(values)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: tourKeys.lists() });
    },
  });
}
