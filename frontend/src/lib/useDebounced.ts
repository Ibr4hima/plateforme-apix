"use client";

import { useEffect, useState } from "react";

// Renvoie une copie de `value` qui ne se met à jour qu'après `delay` ms sans
// changement — pour éviter les rafales de requêtes pendant un drag de slider
// ou une série de clics rapides.
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
