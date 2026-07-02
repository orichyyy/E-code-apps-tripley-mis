import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, type PropsWithChildren } from "react";

import { queryClient } from "@/queries/query-client";
import { useLayoutStore } from "@/stores/layout.store";

export function AppProviders({ children }: PropsWithChildren) {
  const darkModeEnabled = useLayoutStore((state) => state.darkModeEnabled);
  const themeColor = useLayoutStore((state) => state.themeColor);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkModeEnabled);
    document.documentElement.dataset.themeColor = themeColor;
  }, [darkModeEnabled, themeColor]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
