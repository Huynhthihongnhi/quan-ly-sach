import type { ReactNode } from 'react';

import { useState } from 'react';
import { isAxiosError } from 'axios';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              if (isAxiosError(error) && error.response && error.response.status < 500)
                return false;
              return failureCount < 1;
            },
          },
          mutations: { retry: false },
        },
      })
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
