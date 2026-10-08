'use client';

import { createContext, useContext, type ReactNode } from 'react';

/**
 * Primary Domain Context
 *
 * Exposes the site's primary (canonical) domain to the builder UI so that
 * components can render the correct URL on first paint instead of briefly
 * showing one host and then swapping to another.
 *
 * The value is resolved server-side in the /ycode layout. Consumers should
 * treat null as "not configured" and fall back accordingly.
 */
const PrimaryDomainContext = createContext<string | null>(null);

interface PrimaryDomainProviderProps {
  value: string | null;
  children: ReactNode;
}

export function PrimaryDomainProvider({ value, children }: PrimaryDomainProviderProps) {
  return (
    <PrimaryDomainContext.Provider value={value}>
      {children}
    </PrimaryDomainContext.Provider>
  );
}

export function usePrimaryDomain(): string | null {
  return useContext(PrimaryDomainContext);
}
