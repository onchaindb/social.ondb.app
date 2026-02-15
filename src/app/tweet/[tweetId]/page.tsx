'use client';

import {useEffect, useState} from 'react';
import {useParams, useRouter} from 'next/navigation';
import {WalletConnect} from '@/components/WalletConnect';
import {TweetCard} from '@/components/TweetCard';
import {RealSocialService} from '@/lib/services/RealSocialService';
import {CreateTweetRequest, TweetWithContext} from '@/lib/models';
import {Header} from "@/components/header";
import {CONFIG} from "@/lib/config";

export default function TweetPage() {
    const params = useParams();
    const router = useRouter();
    const tweetId = params?.tweetId as string;

    const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
    const [socialService, setSocialService] = useState<RealSocialService | null>(null);
    const [tweet, setTweet] = useState<TweetWithContext | null>(null);
    const [replies, setReplies] = useState<TweetWithContext[]>([]);
    const [loading, setLoading] = useState(true);
    const [showReplyComposer, setShowReplyComposer] = useState(false);
    const [replyContent, setReplyContent] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        initializeSocialService();
    }, []);

    useEffect(() => {
        if (socialService && tweetId) {
            loadTweetAndReplies();
        }
    }, [socialService, tweetId]);

    const initializeSocialService = async () => {
        const service = new RealSocialService(CONFIG);
        setSocialService(service);
    };

    const loadTweetAndReplies = async () => {
        if (!socialService || !tweetId) return;

        setLoading(true);
        try {
            // 🚀 SINGLE optimized call using join relations instead of 2 separate calls
            const {
                tweet: tweetData,
                replies: repliesData,
                total_replies
            } = await socialService.getTweetWithReplies(tweetId);

            console.log('Tweet With Replies Data:', {tweet: tweetData, replies: repliesData.length, total_replies});

            setTweet(tweetData);
            setReplies(repliesData);
        } catch (error) {
            console.error('Failed to load tweet with replies:', error);
        } finally {
            setLoading(false);
        }
    };

    const submitReply = async () => {
        if (!socialService || !connectedAddress || !replyContent.trim() || !tweet) return;

        setSubmitting(true);
        try {
            const request: CreateTweetRequest = {
                content: replyContent.trim(),
                visibility: 'public',
                reply_to_id: tweet.id
            };

            await socialService.createTweet(request, connectedAddress);

            setReplyContent('');
            setShowReplyComposer(false);

            // Reload replies to show the new one
            const repliesData = await socialService.getReplies(tweetId);
            setReplies(repliesData);
        } catch (error) {
            console.error('Failed to create reply:', error);
            alert('Failed to create reply. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0e1a] relative overflow-hidden">
                <Header onAddressChange={setConnectedAddress} onClick={loadTweetAndReplies} disabled={false}/>
                <div className="min-h-screen bg-[#0a0e1a] relative overflow-hidden">
                    <div className="flex items-center justify-center min-h-screen relative z-10">
                        <div className="text-center">
                            <svg className="w-10 h-10 text-blue-400 animate-spin mx-auto mb-4" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                            </svg>
                            <p className="text-slate-400 text-sm">Loading post...</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!tweet) {
        return (
            <div className="min-h-screen bg-[#0a0e1a] relative overflow-hidden">
                <Header onAddressChange={setConnectedAddress} onClick={loadTweetAndReplies} disabled={false}/>
                <div className="min-h-screen bg-[#0a0e1a] relative overflow-hidden">
                    <div className="flex items-center justify-center min-h-screen relative z-10">
                        <div className="text-center">
                            <div
                                className="w-24 h-24 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                                <span className="text-4xl">📭</span>
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-2">Post not found</h3>
                            <p className="text-slate-400 mb-6">This post does not exist or has been deleted.</p>
                            <button
                                onClick={() => router.push('/')}
                                className="btn-primary px-8 py-3"
                            >
                                Back to Home
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0e1a] relative overflow-hidden flex flex-col">
            {/* Subtle background gradient */}
            <div className="fixed inset-0 bg-gradient-to-b from-blue-950/20 via-transparent to-transparent pointer-events-none"/>

            {/* Minimal ambient glow */}
            <div className="fixed top-0 left-1/4 w-[600px] h-[600px] bg-blue-500/[0.03] rounded-full blur-[120px] pointer-events-none"/>
            <div className="fixed bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-600/[0.02] rounded-full blur-[100px] pointer-events-none"/>

            {/* Shooting Stars */}
            <div className="shooting-star" style={{
                top: '15%',
                right: '10%',
                animation: 'shooting-star 3s ease-in-out infinite',
                animationDelay: '1s'
            }}/>
            <div className="shooting-star" style={{
                top: '35%',
                right: '25%',
                animation: 'shooting-star 4s ease-in-out infinite',
                animationDelay: '3s'
            }}/>

            <Header onAddressChange={setConnectedAddress} onClick={loadTweetAndReplies} disabled={false}/>

            <main className="flex-1 container mx-auto px-4 sm:px-6 py-6 max-w-2xl relative z-10">
                {/* Wallet Connection */}
                {!connectedAddress && (
                    <div className="bg-blue-500/[0.08] border border-blue-500/20 rounded-xl p-5 mb-6">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-white font-medium text-sm">
                                        Connect your wallet
                                    </h3>
                                    <p className="text-slate-400 text-xs mt-0.5">
                                        Connect to like and reply to posts
                                    </p>
                                </div>
                            </div>
                            <WalletConnect onAddressChange={setConnectedAddress}/>
                        </div>
                    </div>
                )}

                {/* Back Button */}
                <button
                    onClick={() => router.back()}
                    className="mb-6 flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                >
                    <span>←</span>
                    <span>Back</span>
                </button>

                {/* Main Tweet */}
                <div className="mb-8">
                    <TweetCard
                        tweet={tweet}
                        connectedAddress={connectedAddress}
                        onReply={() => setShowReplyComposer(!showReplyComposer)}
                        showActions={true}
                    />
                </div>

                {/* Reply Composer */}
                {connectedAddress && showReplyComposer && (
                    <div className="bg-[#0f1420] border border-white/[0.08] rounded-2xl p-6 mb-8">
                        <div className="flex items-start space-x-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-400 rounded-full flex items-center justify-center">
                                <span className="text-white font-bold">
                                    {connectedAddress.slice(-4).toUpperCase()}
                                </span>
                            </div>

                            <div className="flex-1">
                                <textarea
                                    value={replyContent}
                                    onChange={(e) => setReplyContent(e.target.value)}
                                    placeholder="Post your reply..."
                                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 text-white placeholder-slate-600 resize-none focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 text-sm leading-relaxed transition-all duration-200"
                                    rows={3}
                                    maxLength={280}
                                    disabled={submitting}
                                    autoFocus
                                />

                                {replyContent && (
                                    <div className={`text-xs mt-2 text-right ${replyContent.length > 260 ? 'text-amber-400' : 'text-slate-500'}`}>
                                        {replyContent.length}/280
                                    </div>
                                )}

                                <div className="flex items-center justify-between mt-4">
                                    <div className="text-sm text-slate-500">
                                        Replying to @{tweet?.author.slice(-8)}
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => {
                                                setShowReplyComposer(false);
                                                setReplyContent('');
                                            }}
                                            disabled={submitting}
                                            className="btn-secondary px-4 py-2"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={submitReply}
                                            disabled={!replyContent.trim() || submitting}
                                            className="btn-primary px-5 py-2"
                                        >
                                            {submitting ? (
                                                <>
                                                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                                    </svg>
                                                    <span>Replying...</span>
                                                </>
                                            ) : (
                                                <span>Reply</span>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Replies Section */}
                <div className="space-y-3">
                    <h2 className="text-sm font-medium text-slate-300 mb-4">
                        {replies.length > 0 ? `Replies (${replies.length})` : 'Replies'}
                    </h2>

                    {replies.length === 0 ? (
                        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-10 text-center">
                            <div className="w-14 h-14 bg-white/[0.03] border border-white/[0.06] rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <svg className="w-7 h-7 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"/>
                                </svg>
                            </div>
                            <h3 className="text-base font-medium text-white mb-1">No replies yet</h3>
                            <p className="text-slate-500 text-sm">
                                Be the first to reply to this post.
                            </p>
                        </div>
                    ) : (
                        replies.map((reply, index) => (
                            <TweetCard
                                key={reply.id}
                                tweet={reply}
                                connectedAddress={connectedAddress}
                                index={index}
                                showActions={false}
                            />
                        ))
                    )}
                </div>
            </main>

            {/* Footer */}
            <footer className="bg-[#0a0e1a] text-white p-0 relative overflow-hidden mt-auto">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4/5 h-px bg-gradient-to-r from-transparent via-[#2563eb] to-transparent opacity-50"></div>

                <div className="bg-gradient-to-br from-[#0f172a] to-[#1a1f2e] py-10 relative border-t border-[rgba(37,99,235,0.2)]">
                    <div className="max-w-[1200px] mx-auto px-5 relative z-10">
                        <div className="flex items-center justify-between gap-12 flex-wrap">
                            <div className="flex items-center gap-8">
                                <div className="flex items-center gap-3">
                                    <svg width="36" height="36" viewBox="0 0 32 32" fill="none" className="drop-shadow-[0_2px_8px_rgba(37,99,235,0.3)]">
                                        <rect width="32" height="32" rx="8" fill="#2563eb"/>
                                        <path d="M8 12L16 8L24 12V20L16 24L8 20V12Z" stroke="white" strokeWidth="2" fill="none"/>
                                        <circle cx="16" cy="16" r="3" fill="white"/>
                                    </svg>
                                    <span className="text-xl font-bold tracking-[-0.025em]">
                                        OnDB
                                    </span>
                                </div>
                                <p className="text-[#64748b] text-sm font-normal pl-4 border-l border-[#334155]">
                                    The Collective Intelligence Database
                                </p>
                            </div>

                            <div className="flex items-center gap-10">
                                <a href="https://onchaindb.io#features" className="text-[#94a3b8] text-sm font-medium hover:text-white transition-colors relative after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-0.5 after:bg-[#2563eb] after:transition-all hover:after:w-full">
                                    Features
                                </a>
                                <a href="https://onchaindb.io/llms.txt" className="text-[#94a3b8] text-sm font-medium hover:text-white transition-colors relative after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-0.5 after:bg-[#2563eb] after:transition-all hover:after:w-full">
                                    Docs
                                </a>
                                <a href="https://github.com/onchaindb" className="text-[#94a3b8] text-sm font-medium hover:text-white transition-colors relative after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-0.5 after:bg-[#2563eb] after:transition-all hover:after:w-full">
                                    GitHub
                                </a>
                            </div>

                            <div className="flex gap-3">
                                <a href="https://x.com/onchaindb" aria-label="Twitter" className="w-9 h-9 flex items-center justify-center bg-white/5 border border-white/10 rounded-lg text-[#64748b] hover:bg-[rgba(37,99,235,0.15)] hover:border-[rgba(37,99,235,0.3)] hover:text-white hover:-translate-y-0.5 transition-all">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z"/>
                                    </svg>
                                </a>
                                <a href="https://github.com/onchaindb" aria-label="GitHub" className="w-9 h-9 flex items-center justify-center bg-white/5 border border-white/10 rounded-lg text-[#64748b] hover:bg-[rgba(37,99,235,0.15)] hover:border-[rgba(37,99,235,0.3)] hover:text-white hover:-translate-y-0.5 transition-all">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                                    </svg>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-[#050711] py-5 border-t border-white/5">
                    <div className="max-w-[1200px] mx-auto px-5 flex justify-between items-center flex-wrap gap-4">
                        <p className="text-[#475569] text-sm m-0 font-normal">
                            &copy; 2025 OnDB. All rights reserved.
                        </p>
                        <div className="flex gap-10">
                            <a href="#" className="text-[#475569] text-sm font-normal hover:text-[#94a3b8] transition-all relative after:absolute after:bottom-[-2px] after:left-0 after:w-0 after:h-px after:bg-[#2563eb] after:transition-all hover:after:w-full">
                                Privacy Policy
                            </a>
                            <a href="#" className="text-[#475569] text-sm font-normal hover:text-[#94a3b8] transition-all relative after:absolute after:bottom-[-2px] after:left-0 after:w-0 after:h-px after:bg-[#2563eb] after:transition-all hover:after:w-full">
                                Terms of Service
                            </a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}