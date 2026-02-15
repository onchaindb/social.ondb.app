'use client';

import {TweetWithContext} from '@/lib/models';
import {useRouter} from 'next/navigation';
import {useEffect, useState} from 'react';
import {createPortal} from 'react-dom';
import {createClient} from '@onchaindb/sdk';
import {CONFIG} from '@/lib/config';

const sdkClient = createClient({
    endpoint: CONFIG.endpoint,
    apiKey: CONFIG.apiKey || 'dev_key_12345678901234567890123456789012',
    appId: CONFIG.appId
});

interface TweetCardProps {
    tweet: TweetWithContext;
    connectedAddress?: string | null;
    onLike?: (tweetId: string) => void;
    onReply?: (tweet: TweetWithContext) => void;
    onQuote?: (tweet: TweetWithContext) => void;
    onFollow?: (userAddress: string) => void;
    index?: number;
    showActions?: boolean;
    isLiking?: boolean;
}

export function TweetCard({
                              tweet,
                              connectedAddress,
                              onLike,
                              onReply,
                              onQuote,
                              onFollow,
                              index = 0,
                              showActions = true,
                              isLiking = false
                          }: TweetCardProps) {
    const router = useRouter();
    const [authorAvatarUrl, setAuthorAvatarUrl] = useState<string | null>(null);
    const [quotedAuthorAvatarUrl, setQuotedAuthorAvatarUrl] = useState<string | null>(null);
    const [tweetImageUrls, setTweetImageUrls] = useState<string[]>([]);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxImageIndex, setLightboxImageIndex] = useState(0);
    const [mounted, setMounted] = useState(false);

    // Track client-side mount for portal
    useEffect(() => {
        setMounted(true);
    }, []);

    // Load author avatar
    useEffect(() => {
        const loadAvatar = async () => {
            if (tweet.author_info?.avatar_url) {
                try {
                    const blob = await sdkClient.retrieveBlob({
                        collection: 'avatars',
                        blob_id: tweet.author_info.avatar_url
                    });
                    const blobUrl = URL.createObjectURL(blob as Blob);
                    setAuthorAvatarUrl(blobUrl);
                } catch (error) {
                    console.error('Failed to load author avatar:', error);
                    setAuthorAvatarUrl(null);
                }
            }
        };
        loadAvatar();

        // Cleanup URL on unmount
        return () => {
            if (authorAvatarUrl) {
                URL.revokeObjectURL(authorAvatarUrl);
            }
        };
    }, [tweet.author_info?.avatar_url]);

    // Load quoted tweet author avatar
    useEffect(() => {
        const loadQuotedAvatar = async () => {
            if (tweet.quote_tweet?.author_info?.avatar_url) {
                try {
                    const blob = await sdkClient.retrieveBlob({
                        collection: 'avatars',
                        blob_id: tweet.quote_tweet.author_info.avatar_url
                    });
                    const blobUrl = URL.createObjectURL(blob as Blob);
                    setQuotedAuthorAvatarUrl(blobUrl);
                } catch (error) {
                    console.error('Failed to load quoted author avatar:', error);
                    setQuotedAuthorAvatarUrl(null);
                }
            }
        };
        loadQuotedAvatar();

        // Cleanup URL on unmount
        return () => {
            if (quotedAuthorAvatarUrl) {
                URL.revokeObjectURL(quotedAuthorAvatarUrl);
            }
        };
    }, [tweet.quote_tweet?.author_info?.avatar_url]);

    // Load tweet images
    useEffect(() => {
        const loadImages = async () => {
            if (tweet.media_urls && tweet.media_urls.length > 0) {
                try {
                    const imagePromises = tweet.media_urls.map(async (blobId) => {
                        try {
                            const blob = await sdkClient.retrieveBlob({
                                collection: 'tweet_images',
                                blob_id: blobId
                            });
                            return URL.createObjectURL(blob as Blob);
                        } catch (error) {
                            console.error(`Failed to load tweet image ${blobId}:`, error);
                            return null;
                        }
                    });

                    const urls = await Promise.all(imagePromises);
                    setTweetImageUrls(urls.filter((url): url is string => url !== null));
                } catch (error) {
                    console.error('Failed to load tweet images:', error);
                }
            }
        };
        loadImages();

        // Cleanup URLs on unmount
        return () => {
            tweetImageUrls.forEach(url => URL.revokeObjectURL(url));
        };
    }, [tweet.media_urls]);

    // Handle keyboard navigation in lightbox
    useEffect(() => {
        if (!lightboxOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setLightboxOpen(false);
            } else if (e.key === 'ArrowLeft' && lightboxImageIndex > 0) {
                setLightboxImageIndex(prev => prev - 1);
            } else if (e.key === 'ArrowRight' && lightboxImageIndex < tweetImageUrls.length - 1) {
                setLightboxImageIndex(prev => prev + 1);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [lightboxOpen, lightboxImageIndex, tweetImageUrls.length]);

    return (
        <div
            className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.06] rounded-xl p-4 hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-200 relative group"
            style={{
                animationDelay: `${index * 50}ms`
            }}
        >
            {/* Reply indicator */}
            {tweet.reply_to_id && (
                <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-3 pl-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                    <span>Replying to a post</span>
                </div>
            )}

            <div className="flex items-start gap-3">
                <button
                    onClick={() => router.push(`/user/${tweet.author}`)}
                    className="relative flex-shrink-0 group/avatar"
                >
                    {authorAvatarUrl ? (
                        <img
                            src={authorAvatarUrl}
                            alt={tweet.author_info?.display_name || 'Avatar'}
                            className="w-10 h-10 rounded-full object-cover ring-2 ring-white/[0.08] group-hover/avatar:ring-blue-500/30 transition-all duration-200"
                        />
                    ) : (
                        <div
                            className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-400 rounded-full flex items-center justify-center ring-2 ring-white/[0.08] group-hover/avatar:ring-blue-500/30 transition-all duration-200">
                            <span className="text-white font-semibold text-xs">
                                {tweet.author.slice(-4).toUpperCase()}
                            </span>
                        </div>
                    )}
                    {tweet.author_info?.verified && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center ring-2 ring-[#0a0e1a]">
                            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                            </svg>
                        </div>
                    )}
                </button>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                        <button
                            onClick={() => router.push(`/user/${tweet.author}`)}
                            className="text-white font-medium text-sm hover:text-blue-400 transition-colors truncate"
                        >
                            {tweet.author_info?.display_name || `${tweet.author.slice(0, 8)}...${tweet.author.slice(-6)}`}
                        </button>
                        {tweet.author_info?.verified && (
                            <svg className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                            </svg>
                        )}
                        <span className="text-slate-500 text-xs font-mono truncate">@{tweet.author.slice(-8)}</span>
                        <span className="text-slate-600 text-xs flex-shrink-0">·</span>
                        <span className="text-slate-500 text-xs flex-shrink-0">{new Date(tweet.created_at).toLocaleDateString()}</span>
                    </div>

                    <button
                        onClick={() => router.push(`/tweet/${tweet.id}`)}
                        className="w-full text-left"
                    >
                        <p className="text-slate-200 text-sm leading-relaxed mb-3 whitespace-pre-wrap">
                            {tweet.content}
                        </p>
                    </button>

                    {/* Display tweet images */}
                    {tweetImageUrls.length > 0 && (
                        <>
                            <div
                                className={`mb-3 grid gap-2 ${tweetImageUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                {tweetImageUrls.map((imageUrl, idx) => (
                                    <button
                                        key={idx}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setLightboxImageIndex(idx);
                                            setLightboxOpen(true);
                                        }}
                                        className="relative group/image overflow-hidden rounded-lg border border-white/[0.08] hover:border-blue-500/40 transition-all duration-200 cursor-pointer"
                                    >
                                        <img
                                            src={imageUrl}
                                            alt={`Post image ${idx + 1}`}
                                            className="w-full h-auto max-h-52 object-cover transition-transform duration-300 group-hover/image:scale-[1.02]"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover/image:opacity-100 transition-opacity duration-200"/>
                                        {tweetImageUrls.length > 1 && (
                                            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-md text-[10px] text-white/80 font-medium">
                                                {idx + 1}/{tweetImageUrls.length}
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>

                            {/* Lightbox Modal */}
                            {mounted && lightboxOpen && createPortal(
                                <div
                                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-md animate-fade-in p-4"
                                    onClick={() => setLightboxOpen(false)}
                                >
                                    {/* Close button - top right, always visible */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setLightboxOpen(false);
                                        }}
                                        className="fixed top-6 right-6 w-12 h-12 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white text-2xl transition-all duration-300 hover:scale-110 hover:rotate-90 shadow-lg z-[10000] border border-white/30"
                                        title="Close (or click outside)"
                                    >
                                        ✕
                                    </button>

                                    {/* Image counter - top center */}
                                    {tweetImageUrls.length > 1 && (
                                        <div
                                            className="fixed top-6 left-1/2 transform -translate-x-1/2 bg-black/70 backdrop-blur-sm px-4 py-2 rounded-full text-white font-medium shadow-lg border border-white/20 z-[10000]">
                                            {lightboxImageIndex + 1} / {tweetImageUrls.length}
                                        </div>
                                    )}

                                    {/* Previous button */}
                                    {tweetImageUrls.length > 1 && lightboxImageIndex > 0 && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setLightboxImageIndex(prev => prev - 1);
                                            }}
                                            className="fixed left-6 top-1/2 transform -translate-y-1/2 w-14 h-14 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white text-3xl transition-all duration-300 hover:scale-110 shadow-lg z-[10000] border border-white/30"
                                            title="Previous image"
                                        >
                                            ‹
                                        </button>
                                    )}

                                    {/* Next button */}
                                    {tweetImageUrls.length > 1 && lightboxImageIndex < tweetImageUrls.length - 1 && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setLightboxImageIndex(prev => prev + 1);
                                            }}
                                            className="fixed right-6 top-1/2 transform -translate-y-1/2 w-14 h-14 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white text-3xl transition-all duration-300 hover:scale-110 shadow-lg z-[10000] border border-white/30"
                                            title="Next image"
                                        >
                                            ›
                                        </button>
                                    )}

                                    {/* Image Container - centered */}
                                    <div
                                        className="relative flex items-center justify-center max-w-[95vw] max-h-[85vh]"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <img
                                            src={tweetImageUrls[lightboxImageIndex]}
                                            alt={`Post image ${lightboxImageIndex + 1}`}
                                            className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border border-white/20"
                                        />
                                    </div>

                                    {/* Hint text - bottom center */}
                                    <div
                                        className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full text-gray-300 text-sm z-[10000]">
                                        Press ESC or click outside to close
                                    </div>
                                </div>,
                                document.body
                            )}
                        </>
                    )}

                    {/* Show quoted tweet if this is a quote tweet */}
                    {tweet.quote_tweet_id && tweet.quote_tweet && (
                        <div className="mb-3 p-3 bg-white/[0.03] rounded-lg border border-white/[0.06] hover:border-white/[0.1] transition-colors cursor-pointer">
                            <div className="flex items-start gap-2.5">
                                {quotedAuthorAvatarUrl ? (
                                    <img
                                        src={quotedAuthorAvatarUrl}
                                        alt={tweet.quote_tweet.author_info?.display_name || 'Avatar'}
                                        className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                                    />
                                ) : (
                                    <div className="w-5 h-5 bg-gradient-to-br from-slate-600 to-slate-500 rounded-full flex items-center justify-center flex-shrink-0">
                                        <span className="text-white text-[8px] font-semibold">
                                            {tweet.quote_tweet.author.slice(-2).toUpperCase()}
                                        </span>
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        <span className="text-slate-300 text-xs font-medium">
                                            {tweet.quote_tweet.author_info?.display_name ||
                                                `${tweet.quote_tweet.author.slice(0, 6)}...${tweet.quote_tweet.author.slice(-4)}`}
                                        </span>
                                        <span className="text-slate-600 text-[10px]">Quoted</span>
                                    </div>
                                    <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">{tweet.quote_tweet.content}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {showActions && (
                        <div className="flex items-center gap-1 pt-1 -ml-2">
                            <button
                                onClick={() => onReply?.(tweet)}
                                className="action-btn reply"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                                </svg>
                                <span>{tweet.reply_count}</span>
                            </button>

                            <button
                                onClick={() => onLike?.(tweet.id)}
                                disabled={!connectedAddress || isLiking}
                                className={`action-btn like ${tweet.user_liked ? 'active' : ''}`}
                            >
                                {isLiking ? (
                                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                    </svg>
                                ) : (
                                    <svg className="w-4 h-4" fill={tweet.user_liked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                                    </svg>
                                )}
                                <span>{tweet.like_count}</span>
                            </button>

                            <button
                                onClick={() => onQuote?.(tweet)}
                                disabled={!connectedAddress}
                                className="action-btn quote"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                                </svg>
                                <span>{tweet.quote_count || 0}</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
