'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivyWallet } from '@/hooks/usePrivyWallet';

interface WalletConnectProps {
  onAddressChange: (address: string | null) => void;
}

export function WalletConnect({ onAddressChange }: WalletConnectProps) {
  const router = useRouter();
  const {
    isConnected,
    address,
    isConnecting,
    error,
    balance,
    user,
    connect,
    disconnect,
    getBalance
  } = usePrivyWallet();

  // Notify parent component when address changes
  React.useEffect(() => {
    onAddressChange(address);
  }, [address, onAddressChange]);

  // Load balance when connected
  useEffect(() => {
    if (isConnected) {
      getBalance();
    }
  }, [isConnected, getBalance]);

  const handleConnect = async () => {
    try {
      await connect();
    } catch (err) {
      console.error('Connection failed:', err);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch (err) {
      console.error('Disconnection failed:', err);
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  // Get user display name (email or phone)
  const getUserDisplay = () => {
    if (!user) return null;

    if (user.email) {
      return user.email.address;
    }
    if (user.phone) {
      return user.phone.number;
    }
    return null;
  };

  const userDisplay = getUserDisplay();

  if (error) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
        <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-red-300 text-sm font-medium truncate" title={error}>Error</span>
        <button
          onClick={handleConnect}
          disabled={isConnecting}
          className="ml-1 text-xs text-red-400 hover:text-red-300 underline underline-offset-2 transition-colors disabled:opacity-50"
        >
          {isConnecting ? 'Retrying...' : 'Retry'}
        </button>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <button
        onClick={handleConnect}
        disabled={isConnecting}
        className="btn-primary"
      >
        {isConnecting ? (
          <>
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
            <span>Connecting...</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <span>Connect Wallet</span>
          </>
        )}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-lg hover:border-white/[0.12] transition-all duration-200 group">
      <div className="relative">
        <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-400 rounded-full flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 32 32" fill="none">
            <path d="M8 12L16 8L24 12V20L16 24L8 20V12Z" stroke="currentColor" strokeWidth="2.5" fill="none"/>
            <circle cx="16" cy="16" r="2.5" fill="currentColor"/>
          </svg>
        </div>
        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-[#0a0e1a]" />
      </div>

      <button
        onClick={() => address && router.push(`/user/${address}`)}
        className="flex flex-col min-w-0"
      >
        {userDisplay && (
          <span className="text-white text-sm font-medium truncate hover:text-blue-400 transition-colors">
            {userDisplay}
          </span>
        )}
        <span className="text-slate-500 text-[11px] font-mono">
          {formatAddress(address!)}
        </span>
      </button>

      <button
        onClick={handleDisconnect}
        className="ml-1 p-1.5 text-slate-500 hover:text-white hover:bg-white/[0.06] rounded-md transition-all duration-200"
        title="Disconnect wallet"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      </button>
    </div>
  );
}
