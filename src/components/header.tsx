'use client';

import {WalletConnect} from "@/components/WalletConnect";
import {useRouter} from "next/navigation";
import {usePrivyWallet} from "@/hooks/usePrivyWallet";

export function Header(props: {
    onClick: () => Promise<void>,
    disabled: boolean,
    onAddressChange: (value: (((prevState: (string | null)) => (string | null)) | string | null)) => void
}) {
    const router = useRouter();
    const { isConnected, disconnect, user } = usePrivyWallet();

    return <header className="sticky top-0 z-40 bg-[#0a0e1a]/80 backdrop-blur-xl border-b border-white/[0.06] shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
        <div className="container mx-auto px-6 py-3">
            <div className="flex items-center justify-between">
                <button
                    onClick={() => router.push('/')}
                    className="flex items-center gap-3 group"
                >
                    <div className="relative">
                        <svg width="36" height="36" viewBox="0 0 32 32" fill="none" className="transition-transform duration-300 group-hover:scale-105">
                            <rect width="32" height="32" rx="8" fill="#2563eb"/>
                            <path d="M8 12L16 8L24 12V20L16 24L8 20V12Z" stroke="white" strokeWidth="2" fill="none"/>
                            <circle cx="16" cy="16" r="3" fill="white"/>
                        </svg>
                        <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-lg font-semibold text-white tracking-tight">OnDB</span>
                        <span className="text-[10px] text-slate-500 uppercase tracking-widest -mt-0.5">Social</span>
                    </div>
                </button>

                <div className="flex items-center gap-3">
                    <button
                        onClick={props.onClick}
                        disabled={props.disabled}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-300 bg-white/[0.03] border border-white/[0.08] rounded-lg hover:bg-white/[0.06] hover:border-white/[0.12] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    >
                        {props.disabled ? (
                            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                            </svg>
                        ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        )}
                        <span>Refresh</span>
                    </button>

                    {isConnected && (
                        <button
                            onClick={disconnect}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-200 transition-all duration-200"
                            title="Logout from Privy"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            <span>Logout</span>
                        </button>
                    )}

                    <WalletConnect onAddressChange={props.onAddressChange}/>
                </div>
            </div>
        </div>
    </header>;
}