// TanStack Query Provider for the app
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5, // 5 minutes default
      gcTime: 1000 * 60 * 60, // 1 hour (previously cacheTime)
    },
  },
});

interface ApiQueryProviderProps {
  children: ReactNode;
}

export function ApiQueryProvider({ children }: ApiQueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

export { queryClient };
