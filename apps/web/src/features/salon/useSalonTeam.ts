import { useMemo } from 'react';
import { useSalonMasters, useSalonServices } from '@/api/cabinetApi';

export interface SalonTeamMember {
  id: string;
  name: string;
  services: { id: string; name: string; price: number; duration: number }[];
}

/** Salon masters with their active services — the shape cabinet views expect for master pickers. */
export function useSalonTeam() {
  const masters = useSalonMasters();
  const services = useSalonServices();
  const team = useMemo<SalonTeamMember[]>(
    () =>
      (masters.data ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        services: (services.data ?? [])
          .filter((s) => s.masterId === m.id && s.isActive)
          .map((s) => ({ id: s.id, name: s.name, price: s.price, duration: s.duration })),
      })),
    [masters.data, services.data],
  );
  const flatServices = useMemo(
    () =>
      (services.data ?? []).map((s) => ({
        id: s.id,
        name: `${s.name} · ${s.masterName}`,
        masterId: s.masterId,
      })),
    [services.data],
  );
  return { team, flatServices, isLoading: masters.isLoading || services.isLoading };
}
