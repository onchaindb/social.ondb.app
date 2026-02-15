'use client';

import { PrivyProvider as BasePrivyProvider } from '@privy-io/react-auth';
import { ReactNode } from 'react';

export function PrivyProvider({ children }: { children: ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId) {
    throw new Error('NEXT_PUBLIC_PRIVY_APP_ID is not set');
  }

  return (
    <BasePrivyProvider
      appId={appId}
      config={{
        // Appearance customization
        appearance: {
          theme: 'dark',
          accentColor: '#2563eb',
          logo: '/images/stacky-mail.png',
        },
        // Login methods - email/phone for Venmo-like UX
        loginMethods: ['email', 'wallet'],
        // Embedded wallet configuration
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
          noPromptOnSignature: true,
        },
        // Support for multiple chains
        supportedChains: [
          // Base Sepolia for testnet
          {
            id: 84532,
            name: 'Base Sepolia',
            network: 'base-sepolia',
            nativeCurrency: {
              name: 'Ethereum',
              symbol: 'ETH',
              decimals: 18,
            },
            rpcUrls: {
              default: {
                http: ['https://sepolia.base.org'],
              },
              public: {
                http: ['https://sepolia.base.org'],
              },
            },
            blockExplorers: {
              default: {
                name: 'BaseScan',
                url: 'https://sepolia.basescan.org',
              },
            },
            testnet: true,
          },
        ],
        defaultChain: {
          id: 84532,
          name: 'Base Sepolia',
        },
      }}
    >
      {children}
    </BasePrivyProvider>
  );
}
