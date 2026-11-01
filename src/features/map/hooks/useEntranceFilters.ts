// Hook for the entrance-type filter: which types are selected and whether the legend is open.

import { useCallback, useState } from "react";

import type { EntranceFilterKey } from "~/src/features/map/filters/entranceFilters";

export function useEntranceFilters() {
  const [selected, setSelected] = useState<EntranceFilterKey[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const toggleFilter = useCallback((key: EntranceFilterKey) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }, []);

  const clearFilters = useCallback(() => setSelected([]), []);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return {
    state: { selected, isOpen },
    action: { toggleFilter, clearFilters, open, close },
  };
}
