'use client';

import {useEffect, useState} from 'react';
import {useRouter} from 'next/navigation';
import {WalletConnect} from '@/components/WalletConnect';
import {TweetCard} from '@/components/TweetCard';
import {usePrivyWallet} from '@/hooks/usePrivyWallet';
import {RealSocialService} from '@/lib/services/RealSocialService';
import {createTempoPaymentCallback} from '@/lib/services/TempoPaymentCallback';
import {CreateTweetRequest, TweetWithContext} from '@/lib/models';
import {Header} from "@/components/header";
import {CONFIG} from "@/lib/config";

export default function Home() {
    const router = useRouter();
    const {isConnected, address: walletAddress, user, embeddedWallet} = usePrivyWallet();

    const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
    const [socialService, setSocialService] = useState<RealSocialService | null>(null);
    const [tweets, setTweets] = useState<TweetWithContext[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [offset, setOffset] = useState(0);
    const [tweetContent, setTweetContent] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [showComposer, setShowComposer] = useState(false);
    const [replyingTo, setReplyingTo] = useState<TweetWithContext | null>(null);
    const [quotingTweet, setQuotingTweet] = useState<TweetWithContext | null>(null);
    const [likingTweets, setLikingTweets] = useState<Set<string>>(new Set());
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [uploadingImage, setUploadingImage] = useState(false);


    useEffect(() => {
        // Update connected address when wallet state changes
        if (isConnected && walletAddress) {
            setConnectedAddress(walletAddress);
        } else if (!isConnected) {
            setConnectedAddress(null);
        }
    }, [isConnected, walletAddress]);

    useEffect(() => {
        // Initialize service and load tweets whenever connected address changes (including on mount)
        initializeSocialService();
    }, [connectedAddress]);


    const initializeSocialService = async () => {
        // Initialize service with payment options if user is connected
        const serviceConfig = {
            ...CONFIG,
            currentUserAddress: connectedAddress || undefined,
            // Wallet functions no longer needed - Tempo handles payments
            userWallet: undefined
        };

        const service = new RealSocialService(serviceConfig);
        setSocialService(service);

        // Skip automatic user profile creation to avoid payment on wallet connect
        // User profiles are optional and will be created on-demand if needed
        if (connectedAddress) {
            console.log('🔐 Wallet connected:', connectedAddress);
            console.log('💡 User profile creation skipped (will be created when posting)');
        }

        // Load public timeline immediately
        try {
            setLoading(true);
            setOffset(0);
            setHasMore(true);
            const timeline = await service.getPublicTimeline(20, 0);
            setTweets(timeline.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
            setOffset(20);
            setHasMore(timeline.length === 20);
        } catch (error) {
            console.error('Failed to load initial tweets:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadTweets = async () => {
        if (!socialService) return;

        setLoading(true);
        try {
            setOffset(0);
            setHasMore(true);
            // Query tweets collection for public timeline
            const timeline = await socialService.getPublicTimeline(20, 0);
            setTweets(timeline.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
            setOffset(20);
            setHasMore(timeline.length === 20);
            console.log(`Loaded ${timeline.length} tweets from tweets collection`);
        } catch (error) {
            console.error('Failed to load tweets from collection:', error);
            setTweets([]); // Clear tweets on error
        } finally {
            setLoading(false);
        }
    };

    const loadMoreTweets = async () => {
        if (!socialService || loadingMore || !hasMore) return;

        setLoadingMore(true);
        try {
            const moreTweets = await socialService.getPublicTimeline(20, offset);
            if (moreTweets.length > 0) {
                setTweets(prev => [...prev, ...moreTweets].sort((a, b) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                ));
                setOffset(prev => prev + moreTweets.length);
                setHasMore(moreTweets.length === 20);
            } else {
                setHasMore(false);
            }
        } catch (error) {
            console.error('Failed to load more tweets:', error);
        } finally {
            setLoadingMore(false);
        }
    };

    // Infinite scroll handler
    useEffect(() => {
        const handleScroll = () => {
            if (loading || loadingMore || !hasMore) return;

            const scrollHeight = document.documentElement.scrollHeight;
            const scrollTop = document.documentElement.scrollTop;
            const clientHeight = document.documentElement.clientHeight;

            // Load more when user is 80% down the page
            if (scrollTop + clientHeight >= scrollHeight * 0.8) {
                loadMoreTweets();
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [loading, loadingMore, hasMore, offset, socialService]);

    const submitTweet = async () => {
        console.log({socialService, connectedAddress, tweetContent})
        if (!socialService || !connectedAddress || !tweetContent.trim()) return;

        setSubmitting(true);
        try {
            // Step 1: Create payment callback for SDK
            if (!embeddedWallet) {
                throw new Error('Wallet not connected');
            }

            const provider = await embeddedWallet.getEthereumProvider();
            const paymentCallback = createTempoPaymentCallback({
                provider,
                userAddress: connectedAddress,
                preferredNetwork: process.env.NEXT_PUBLIC_X402_PREFERRED_NETWORK || 'base-sepolia',
                preferredToken: process.env.NEXT_PUBLIC_X402_PREFERRED_TOKEN || 'native',
            });

            let blobId: string | null = null;

            // Step 2: Upload image if selected
            if (selectedImage) {
                setUploadingImage(true);
                console.log('📸 Uploading image to Celestia blob storage...');
                blobId = await socialService.uploadImage(selectedImage, connectedAddress, paymentCallback);

                if (!blobId) {
                    throw new Error('Failed to upload image to blob storage');
                }
                console.log(`✅ Image uploaded successfully. Blob ID: ${blobId}`);
                setUploadingImage(false);
            }

            // Step 3: Prepare tweet data
            const request: CreateTweetRequest = {
                content: tweetContent.trim(),
                visibility: 'public',
                reply_to_id: replyingTo?.id,
                media_urls: blobId ? [blobId] : undefined
            };

            console.log('💳 Creating tweet with payment via SDK...');

            // Step 4: Create tweet using SDK with payment callback
            let tweet;
            if (quotingTweet) {
                tweet = await socialService.createQuoteTweet(request, connectedAddress, quotingTweet.id, paymentCallback);
            } else {
                tweet = await socialService.createTweet(request, connectedAddress, paymentCallback);
            }

            console.log('✅ Tweet created successfully:', tweet);

            // Clean up state
            setTweetContent('');
            setSelectedImage(null);
            setImagePreview(null);
            setShowComposer(false);
            setReplyingTo(null);
            setQuotingTweet(null);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
            loadTweets();
        } catch (error) {
            console.error('Failed to create tweet:', error);
            alert(`Failed to create tweet: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setSubmitting(false);
            setUploadingImage(false);
        }
    };

    const likeTweet = async (tweetId: string) => {
        if (!socialService || !connectedAddress || !embeddedWallet) return;

        // Prevent duplicate likes while processing
        if (likingTweets.has(tweetId)) return;

        try {
            setLikingTweets(prev => new Set(prev).add(tweetId));

            // Create payment callback for SDK
            const provider = await embeddedWallet.getEthereumProvider();
            const paymentCallback = createTempoPaymentCallback({
                provider,
                userAddress: connectedAddress,
                preferredNetwork: process.env.NEXT_PUBLIC_X402_PREFERRED_NETWORK || 'base-sepolia',
                preferredToken: process.env.NEXT_PUBLIC_X402_PREFERRED_TOKEN || 'native',
            });

            console.log('💳 Liking tweet with payment via SDK...');
            const success = await socialService.likeTweet(connectedAddress, tweetId, paymentCallback);

            if (success) {
                console.log('✅ Like successful');
                setTweets(prev => prev.map(tweet =>
                    tweet.id === tweetId
                        ? {...tweet, like_count: tweet.like_count + 1, user_liked: true}
                        : tweet
                ));
            }
        } catch (error) {
            console.error('Failed to like tweet:', error);
            alert(`Failed to like tweet: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setLikingTweets(prev => {
                const newSet = new Set(prev);
                newSet.delete(tweetId);
                return newSet;
            });
        }
    };

    const followUser = async (userAddress: string) => {
        if (!socialService || !connectedAddress || !embeddedWallet) return;

        try {
            // Create payment callback for SDK
            const provider = await embeddedWallet.getEthereumProvider();
            const paymentCallback = createTempoPaymentCallback({
                provider,
                userAddress: connectedAddress,
                preferredNetwork: process.env.NEXT_PUBLIC_X402_PREFERRED_NETWORK || 'base-sepolia',
                preferredToken: process.env.NEXT_PUBLIC_X402_PREFERRED_TOKEN || 'native',
            });

            console.log('💳 Following user with payment via SDK...');
            const success = await socialService.followUser(connectedAddress, userAddress, paymentCallback);

            if (success) {
                console.log('✅ Follow successful');
                // Update tweet author info
                setTweets(prev => prev.map(tweet =>
                    tweet.author === userAddress
                        ? {
                            ...tweet,
                        }
                        : tweet
                ));
            }
        } catch (error) {
            console.error('Failed to follow user:', error);
            alert(`Failed to follow user: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        // Validate file size (2MB max)
        const maxSize = 2 * 1024 * 1024; // 2MB in bytes
        if (file.size > maxSize) {
            alert('Image must be smaller than 2MB');
            return;
        }

        setSelectedImage(file);

        // Create preview
        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const removeImage = () => {
        setSelectedImage(null);
        setImagePreview(null);
    };

    const startReply = (tweet: TweetWithContext) => {
        setReplyingTo(tweet);
        setQuotingTweet(null);
        setTweetContent(`Replying to ${tweet.author.slice(-4)}: `);
        setShowComposer(true);
    };

    const startQuote = (tweet: TweetWithContext) => {
        setQuotingTweet(tweet);
        setReplyingTo(null);
        setTweetContent('');
        setShowComposer(true);
    };

    return (
        <div className="min-h-screen bg-[#0a0e1a] relative overflow-hidden flex flex-col">
            {/* Subtle background gradient */}
            <div
                className="fixed inset-0 bg-gradient-to-b from-blue-950/20 via-transparent to-transparent pointer-events-none"/>

            {/* Minimal ambient glow */}
            <div
                className="fixed top-0 left-1/4 w-[600px] h-[600px] bg-blue-500/[0.03] rounded-full blur-[120px] pointer-events-none"/>
            <div
                className="fixed bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-600/[0.02] rounded-full blur-[100px] pointer-events-none"/>

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
            <div className="shooting-star" style={{
                top: '55%',
                right: '15%',
                animation: 'shooting-star 3.5s ease-in-out infinite',
                animationDelay: '6s'
            }}/>

            {/* Success Toast */}
            {showSuccess && (
                <div className="fixed top-20 right-6 z-50 animate-slide-down">
                    <div
                        className="flex items-center gap-3 bg-emerald-500/10 backdrop-blur-xl border border-emerald-500/20 text-emerald-300 px-4 py-3 rounded-lg shadow-lg">
                        <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                             strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round"
                                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        <span className="font-medium text-sm">Post published successfully</span>
                    </div>
                </div>
            )}

            {/* Header */}
            <Header onClick={loadTweets} disabled={loading} onAddressChange={setConnectedAddress}/>

            {/* Floating Action Button */}
            {isConnected && !showComposer && (
                <button
                    onClick={() => setShowComposer(true)}
                    className="fixed bottom-8 right-8 z-30 btn-primary px-6 py-3 rounded-full shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
                    title="Create a new post"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
                    </svg>
                    <span className="font-semibold">New Post</span>
                </button>
            )}

            {/* Tweet Composer Modal */}
            {isConnected && showComposer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                         onClick={() => {
                             setShowComposer(false);
                             setTweetContent('');
                             setReplyingTo(null);
                             setQuotingTweet(null);
                         }}></div>

                    <div
                        className="bg-[#0f1420] border border-white/[0.08] rounded-2xl p-6 max-w-xl w-full shadow-2xl animate-scale-in relative z-10">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-semibold text-white">
                                {replyingTo ? 'Reply to post' : quotingTweet ? 'Quote post' : 'Create post'}
                            </h2>
                            <button
                                onClick={() => {
                                    setShowComposer(false);
                                    setTweetContent('');
                                    setReplyingTo(null);
                                    setQuotingTweet(null);
                                }}
                                className="text-slate-500 hover:text-white p-1.5 rounded-lg hover:bg-white/[0.06] transition-all duration-200"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                     strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                                </svg>
                            </button>
                        </div>

                        {/* Reply context */}
                        {replyingTo && (
                            <div className="mb-4 p-3 bg-white/[0.03] rounded-lg border border-white/[0.06]">
                                <div className="flex items-start gap-3">
                                    <div
                                        className="w-8 h-8 bg-gradient-to-br from-slate-600 to-slate-500 rounded-full flex items-center justify-center flex-shrink-0">
                                        <span className="text-white text-xs font-semibold">
                                            {replyingTo.author.slice(-2).toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-slate-500 text-xs font-mono">
                                            {replyingTo.author.slice(0, 6)}...{replyingTo.author.slice(-4)}
                                        </span>
                                        <p className="text-slate-300 text-sm mt-1 line-clamp-2">{replyingTo.content}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Quote context */}
                        {quotingTweet && (
                            <div className="mb-4 p-3 bg-white/[0.03] rounded-lg border border-white/[0.06]">
                                <div className="flex items-center gap-1.5 mb-2">
                                    <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24"
                                         stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round"
                                              d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"/>
                                    </svg>
                                    <span className="text-slate-500 text-xs">Quoting</span>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div
                                        className="w-7 h-7 bg-gradient-to-br from-slate-600 to-slate-500 rounded-full flex items-center justify-center flex-shrink-0">
                                        <span className="text-white text-[10px] font-semibold">
                                            {quotingTweet.author.slice(-2).toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-slate-500 text-xs font-mono">
                                            {quotingTweet.author.slice(0, 6)}...{quotingTweet.author.slice(-4)}
                                        </span>
                                        <p className="text-slate-400 text-sm mt-1 line-clamp-2">{quotingTweet.content}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="relative">
                            <textarea
                                value={tweetContent}
                                onChange={(e) => setTweetContent(e.target.value)}
                                placeholder={replyingTo ? "Write your reply..." : quotingTweet ? "Add your thoughts..." : "What's on your mind?"}
                                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 text-white placeholder-slate-600 resize-none focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 text-sm leading-relaxed transition-all duration-200"
                                rows={4}
                                maxLength={280}
                                disabled={submitting}
                                autoFocus
                            />
                            <div className={`absolute bottom-3 right-3 text-xs px-2 py-0.5 rounded-md ${
                                tweetContent.length > 260 ? 'text-amber-400 bg-amber-500/10' : 'text-slate-500 bg-white/[0.05]'
                            }`}>
                                {tweetContent.length}/280
                            </div>
                        </div>

                        {/* Image Upload Section */}
                        <div className="flex items-center gap-3 pt-4 mt-4 border-t border-white/[0.06]">
                            <input
                                type="file"
                                id="tweet-image"
                                accept="image/*"
                                onChange={handleImageSelect}
                                className="hidden"
                                disabled={submitting}
                            />
                            <label
                                htmlFor="tweet-image"
                                className={`flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-lg cursor-pointer transition-all duration-200 ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                     strokeWidth="1.5">
                                    <path strokeLinecap="round" strokeLinejoin="round"
                                          d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/>
                                </svg>
                                <span className="text-sm">Image</span>
                            </label>

                            {imagePreview && (
                                <div className="relative">
                                    <img
                                        src={imagePreview}
                                        alt="Preview"
                                        className="h-16 w-16 object-cover rounded-lg border border-white/[0.1]"
                                    />
                                    <button
                                        onClick={removeImage}
                                        disabled={submitting}
                                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full text-white flex items-center justify-center transition-colors disabled:opacity-50"
                                        title="Remove image"
                                    >
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                             strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round"
                                                  d="M6 18L18 6M6 6l12 12"/>
                                        </svg>
                                    </button>
                                    {selectedImage && (
                                        <div
                                            className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] px-1 py-0.5 text-center rounded-b-lg">
                                            {(selectedImage.size / 1024).toFixed(0)}KB
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex-1"/>

                            <button
                                onClick={() => {
                                    setShowComposer(false);
                                    setTweetContent('');
                                    setReplyingTo(null);
                                    setQuotingTweet(null);
                                }}
                                disabled={submitting}
                                className="btn-secondary px-4 py-2"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitTweet}
                                disabled={!tweetContent.trim() || submitting}
                                className="btn-primary px-5 py-2"
                            >
                                {submitting ? (
                                    <>
                                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor"
                                                    strokeWidth="3"/>
                                            <path className="opacity-75" fill="currentColor"
                                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                        </svg>
                                        <span>{uploadingImage ? 'Uploading...' : 'Posting...'}</span>
                                    </>
                                ) : (
                                    <span>{replyingTo ? 'Reply' : quotingTweet ? 'Quote' : 'Post'}</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Stacky mascot - fixed on left side for large screens */}
            <div
                className="hidden lg:block fixed left-8 top-1/2 -translate-y-1/2 z-10 opacity-80 hover:opacity-100 transition-opacity duration-300">
                <img
                    src="/images/stacky-mail.png"
                    alt="Stacky"
                    className="w-44 h-44 object-contain drop-shadow-[0_0_20px_rgba(37,99,235,0.3)]"
                />
            </div>

            {/* Main Content */}
            <main className="container mx-auto px-4 sm:px-6 py-6 max-w-2xl relative z-10">
                {!connectedAddress && (
                    <div className="bg-blue-500/[0.08] border border-blue-500/20 rounded-xl p-5 mb-6">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24"
                                         stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round"
                                              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-white font-medium text-sm">
                                        Connect your wallet
                                    </h3>
                                    <p className="text-slate-400 text-xs mt-0.5">
                                        Start posting and engaging with the community
                                    </p>
                                </div>
                            </div>
                            <WalletConnect onAddressChange={setConnectedAddress}/>
                        </div>
                    </div>
                )}


                {/* Tweet Feed */}
                <div className="space-y-3">
                    {tweets.length === 0 && !loading ? (
                        <div className="text-center py-20">
                            <div
                                className="w-16 h-16 bg-white/[0.03] border border-white/[0.06] rounded-2xl flex items-center justify-center mx-auto mb-5">
                                <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24"
                                     stroke="currentColor" strokeWidth="1.5">
                                    <path strokeLinecap="round" strokeLinejoin="round"
                                          d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"/>
                                </svg>
                            </div>
                            <h3 className="text-lg font-medium text-white mb-2">No posts yet</h3>
                            <p className="text-slate-500 text-sm mb-4">Be the first to share something</p>
                            {!isConnected && (
                                <p className="text-blue-400 text-sm">Connect your wallet to start posting</p>
                            )}
                        </div>
                    ) : (
                        tweets.map((tweet, index) => (
                            <TweetCard
                                key={tweet.id}
                                tweet={tweet}
                                connectedAddress={connectedAddress}
                                onLike={likeTweet}
                                onReply={startReply}
                                onQuote={startQuote}
                                onFollow={followUser}
                                index={index}
                                isLiking={likingTweets.has(tweet.id)}
                            />
                        ))
                    )}
                </div>

                {/* Loading More Indicator */}
                {loadingMore && (
                    <div className="text-center py-8">
                        <div className="inline-flex items-center gap-3 px-4 py-2">
                            <svg className="w-5 h-5 text-blue-400 animate-spin" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor"
                                        strokeWidth="3"/>
                                <path className="opacity-75" fill="currentColor"
                                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                            </svg>
                            <span className="text-slate-400 text-sm">Loading more...</span>
                        </div>
                    </div>
                )}

                {/* Status */}
                {tweets.length > 0 && !loadingMore && (
                    <div className="text-center py-8">
                        <div className="inline-flex items-center gap-2 text-slate-500 text-sm">
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"/>
                            <span>{tweets.length} post{tweets.length !== 1 ? 's' : ''}</span>
                            {!hasMore && (
                                <>
                                    <span className="text-slate-600">·</span>
                                    <span className="text-slate-600">You're all caught up</span>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="bg-[#0a0e1a] text-white p-0 relative overflow-hidden mt-auto">
                <div
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-4/5 h-px bg-gradient-to-r from-transparent via-[#2563eb] to-transparent opacity-50"></div>

                <div
                    className="bg-gradient-to-br from-[#0f172a] to-[#1a1f2e] py-10 relative border-t border-[rgba(37,99,235,0.2)]">
                    <div className="max-w-[1200px] mx-auto px-5 relative z-10">
                        <div className="flex items-center justify-between gap-12 flex-wrap">
                            <div className="flex items-center gap-8">
                                <div className="flex items-center gap-3">
                                    <svg width="36" height="36" viewBox="0 0 32 32" fill="none"
                                         className="drop-shadow-[0_2px_8px_rgba(37,99,235,0.3)]">
                                        <rect width="32" height="32" rx="8" fill="#2563eb"/>
                                        <path d="M8 12L16 8L24 12V20L16 24L8 20V12Z" stroke="white" strokeWidth="2"
                                              fill="none"/>
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
                                <a href="https://onchaindb.io#features"
                                   className="text-[#94a3b8] text-sm font-medium hover:text-white transition-colors relative after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-0.5 after:bg-[#2563eb] after:transition-all hover:after:w-full">
                                    Features
                                </a>
                                <a href="https://onchaindb.io/llms.txt"
                                   className="text-[#94a3b8] text-sm font-medium hover:text-white transition-colors relative after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-0.5 after:bg-[#2563eb] after:transition-all hover:after:w-full">
                                    Docs
                                </a>
                                <a href="https://github.com/onchaindb"
                                   className="text-[#94a3b8] text-sm font-medium hover:text-white transition-colors relative after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-0.5 after:bg-[#2563eb] after:transition-all hover:after:w-full">
                                    GitHub
                                </a>
                            </div>

                            <div className="flex gap-3">
                                <a href="https://x.com/onchaindb" aria-label="Twitter"
                                   className="w-9 h-9 flex items-center justify-center bg-white/5 border border-white/10 rounded-lg text-[#64748b] hover:bg-[rgba(37,99,235,0.15)] hover:border-[rgba(37,99,235,0.3)] hover:text-white hover:-translate-y-0.5 transition-all">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                        <path
                                            d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z"/>
                                    </svg>
                                </a>
                                <a href="https://github.com/onchaindb" aria-label="GitHub"
                                   className="w-9 h-9 flex items-center justify-center bg-white/5 border border-white/10 rounded-lg text-[#64748b] hover:bg-[rgba(37,99,235,0.15)] hover:border-[rgba(37,99,235,0.3)] hover:text-white hover:-translate-y-0.5 transition-all">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                        <path
                                            d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
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
                            <a href="#"
                               className="text-[#475569] text-sm font-normal hover:text-[#94a3b8] transition-all relative after:absolute after:bottom-[-2px] after:left-0 after:w-0 after:h-px after:bg-[#2563eb] after:transition-all hover:after:w-full">
                                Privacy Policy
                            </a>
                            <a href="#"
                               className="text-[#475569] text-sm font-normal hover:text-[#94a3b8] transition-all relative after:absolute after:bottom-[-2px] after:left-0 after:w-0 after:h-px after:bg-[#2563eb] after:transition-all hover:after:w-full">
                                Terms of Service
                            </a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}