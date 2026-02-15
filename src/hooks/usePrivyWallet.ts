import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useCallback, useEffect, useState } from 'react';

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  isConnecting: boolean;
  error: string | null;
  balance: { tia: number } | null;
}

export function usePrivyWallet() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();

  const [state, setState] = useState<WalletState>({
    isConnected: false,
    address: null,
    isConnecting: false,
    error: null,
    balance: null,
  });

  // Get the embedded wallet (created automatically for email/phone users)
  const embeddedWallet = wallets.find((wallet) => wallet.walletClientType === 'privy');

  // Get EVM address from embedded wallet
  useEffect(() => {
    if (ready && authenticated && embeddedWallet) {
      const address = embeddedWallet.address;
      setState(prev => ({
        ...prev,
        isConnected: true,
        address,
        isConnecting: false,
        error: null,
      }));
    } else if (ready && !authenticated) {
      setState(prev => ({
        ...prev,
        isConnected: false,
        address: null,
        isConnecting: false,
      }));
    }
  }, [ready, authenticated, embeddedWallet]);

  const connect = useCallback(async () => {
    if (!ready) return;
    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      await login();
    } catch (error) {
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: error instanceof Error ? error.message : 'Failed to connect',
      }));
      throw error;
    }
  }, [ready, login]);

  const disconnect = useCallback(async () => {
    if (!ready) return;

    try {
      await logout();
      setState({
        isConnected: false,
        address: null,
        isConnecting: false,
        error: null,
        balance: null,
      });
    } catch (error) {
      console.error('Failed to disconnect:', error);
      throw error;
    }
  }, [ready, logout]);

  // For compatibility with existing code
  const getBalance = useCallback(async () => {
    // TODO: Fetch balance from Base Sepolia
    // For now, return mock balance
    return { tia: 0 };
  }, []);

  const isPrivyInstalled = useCallback(() => {
    return true; // Privy is always available (no extension needed)
  }, []);

  const getInstallUrl = useCallback(() => {
    return '#'; // No installation needed
  }, []);

  // Placeholder functions for tx signing (will implement with Tempo)
  const signTx = useCallback(async (
    recipientAddress: string,
    amount: string,
    memo: string
  ) => {
    throw new Error('Use Tempo for payments');
  }, []);

  const signAndBroadcast = useCallback(async (
    recipientAddress: string,
    amount: string,
    memo: string
  ) => {
    throw new Error('Use Tempo for payments');
  }, []);

  const canAffordTransaction = useCallback(async (
    amount: string,
    estimatedGas?: number
  ) => {
    // TODO: Implement with actual balance check
    return true;
  }, []);

  return {
    ...state,
    user,
    embeddedWallet,
    connect,
    disconnect,
    isPrivyInstalled,
    getInstallUrl,
    getBalance,
    signTx,
    signAndBroadcast,
    canAffordTransaction,
  };
}
