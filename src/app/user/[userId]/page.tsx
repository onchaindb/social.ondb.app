'use client';

import {useEffect, useRef, useState} from 'react';
import {useParams, useRouter} from 'next/navigation';
import {WalletConnect} from '@/components/WalletConnect';
import {TweetCard} from '@/components/TweetCard';
import {usePrivyWallet} from '@/hooks/usePrivyWallet';
import {RealSocialService} from '@/lib/services/RealSocialService';
import {createTempoPaymentCallback} from '@/lib/services/TempoPaymentCallback';
import {TweetWithContext, User} from '@/lib/models';
import {Header} from "@/components/header";
import {CONFIG} from "@/lib/config";
import {createClient} from '@onchaindb/sdk';

// Create SDK client instance
const sdkClient = createClient({
    endpoint: CONFIG.endpoint,
    apiKey: CONFIG.apiKey || 'dev_key_12345678901234567890123456789012',
    appId: CONFIG.appId
});

export default function UserPage() {
    const params = useParams();
    const router = useRouter();
    const userAddress = params?.userId as string; // This is actually an address
    const {isConnected, address: walletAddress, user: privyUser, embeddedWallet} = usePrivyWallet();

    console.log('🚀 UserPage rendering with userAddress:', userAddress);

    const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
    const [socialService, setSocialService] = useState<RealSocialService | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [userTweets, setUserTweets] = useState<TweetWithContext[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [isFollowing, setIsFollowing] = useState(false);
    const [followLoading, setFollowLoading] = useState(false);
    const [showOnboardingModal, setShowOnboardingModal] = useState(false);
    const [creatingProfile, setCreatingProfile] = useState(false);
    const [hasCheckedUser, setHasCheckedUser] = useState(false);
    const [profileForm, setProfileForm] = useState({
        display_name: '',
        bio: '',
        avatar_url: '',
        website_url: ''
    });

    // Avatar upload state
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);


    const isOwnProfile = connectedAddress && connectedAddress === userAddress;

    useEffect(() => {
        // Update connected address when wallet state changes
        if (isConnected && walletAddress) {
            setConnectedAddress(walletAddress);
        } else if (!isConnected) {
            setConnectedAddress(null);
        }
    }, [isConnected, walletAddress]);

    useEffect(() => {
        // Initialize service on mount and whenever connected address changes
        initializeSocialService();
    }, [connectedAddress, isConnected]);

    useEffect(() => {
        // Reset hasCheckedUser when viewing a different user profile
        setHasCheckedUser(false);
        setUser(null);
        setUserTweets([]);
        setShowOnboardingModal(false);
    }, [userAddress]);

    useEffect(() => {
        // Check if we should show onboarding modal when wallet connects
        // This handles the case where user visits their profile before wallet is connected
        if (isOwnProfile && hasCheckedUser && !user && !loading) {
            console.log('🎯 Wallet connected to own profile with no user data - showing onboarding modal');
            setShowOnboardingModal(true);
        }
    }, [isOwnProfile, hasCheckedUser, user, loading]);

    useEffect(() => {
        if (userAddress && socialService && !hasCheckedUser) {
            console.log('🔄 useEffect triggered - loading user data for:', userAddress);
            loadUserData();
            checkFollowStatus();
        }
    }, [socialService, userAddress, hasCheckedUser]);

    const checkFollowStatus = async () => {
        if (!socialService || !connectedAddress || !userAddress || isOwnProfile) {
            return;
        }

        try {
            const following = await socialService.isFollowing(connectedAddress, userAddress);
            setIsFollowing(following);
        } catch (error) {
            console.error('Failed to check follow status:', error);
        }
    };

    const initializeSocialService = async () => {
        console.log('🔧 Initializing social service...');

        const serviceConfig = {
            ...CONFIG,
            currentUserAddress: connectedAddress || undefined,
            userWallet: undefined // Tempo handles payments
        };

        const service = new RealSocialService(serviceConfig);
        setSocialService(service);
        console.log('✅ Social service initialized');
    };

    const loadUserData = async () => {
        if (!socialService || !userAddress) {
            console.log('❌ Cannot load user data - missing socialService or userAddress');
            return;
        }

        console.log('🔄 Loading user data for:', userAddress);
        setLoading(true);
        try {
            // 🚀 OPTIMIZED: Load user profile, tweets, followers, and following in a single JOIN query!
            // This replaces 4 separate API calls with 1 optimized server-side JOIN
            const {
                user: userData,
                tweets,
                followers,
                following
            } = await (socialService as any).getUserWithTweets(userAddress, 50);
            console.log('✅ Got user data:', userData);
            console.log('✅ Got tweets:', tweets?.length || 0);
            console.log('✅ Got followers:', followers?.length || 0);
            console.log('✅ Got following:', following?.length || 0);

            setUser(userData);
            setUserTweets(tweets || []);
            setHasCheckedUser(true); // Mark that we've checked for the user

            // If no user profile exists and viewing own profile, show onboarding modal
            console.log('🔍 Profile check:', {
                hasUserData: !!userData,
                isOwnProfile,
                connectedAddress,
                userAddress,
                shouldShowModal: !userData && isOwnProfile
            });

            if (!userData && isOwnProfile) {
                console.log('🎯 No user profile found - showing onboarding modal');
                setShowOnboardingModal(true);
            }

            // Load avatar from blob storage if user has one
            if (userData?.avatar_url) {
                await loadUserAvatar(userData.avatar_url);
            }

            // Pre-fill profile form if it's the user's own profile
            if (userData && isOwnProfile) {
                setProfileForm({
                    display_name: userData.display_name || '',
                    bio: userData.bio || '',
                    avatar_url: userData.avatar_url || '',
                    website_url: userData.website_url || ''
                });
            }
        } catch (error) {
            console.error('Failed to load user data:', error);
            setHasCheckedUser(true); // Mark as checked even on error to prevent infinite loop
        } finally {
            setLoading(false);
        }
    };

    const handleCreateProfile = async () => {
        if (!socialService || !connectedAddress || !embeddedWallet) return;

        setCreatingProfile(true);
        try {
            // Create payment callback for SDK
            const provider = await embeddedWallet.getEthereumProvider();
            const paymentCallback = createTempoPaymentCallback({
                provider,
                userAddress: connectedAddress,
                preferredNetwork: process.env.NEXT_PUBLIC_X402_PREFERRED_NETWORK || 'base-sepolia',
                preferredToken: process.env.NEXT_PUBLIC_X402_PREFERRED_TOKEN || 'native',
            });

            console.log('💳 Creating user profile with payment via SDK...');

            const newUser = await socialService.upsertUser(
                connectedAddress,
                {
                    display_name: '',
                    bio: '',
                    avatar_url: '',
                    website_url: ''
                },
                paymentCallback
            );

            if (newUser) {
                console.log('✅ User profile created successfully');
                setUser(newUser);
                setShowOnboardingModal(false);
                // Reload user data to get tweets and other info
                setHasCheckedUser(false); // Allow reload after profile creation
                loadUserData();
                alert('✅ Welcome! Your profile has been created successfully!');
            } else {
                alert('❌ Failed to create profile');
            }
        } catch (error) {
            console.error('Failed to create profile:', error);
            alert(`Failed to create profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setCreatingProfile(false);
        }
    };

    const handleUpdateProfile = async () => {
        if (!socialService || !connectedAddress || !isOwnProfile || !embeddedWallet) return;

        try {
            setLoading(true);

            // Create payment callback for SDK
            const provider = await embeddedWallet.getEthereumProvider();
            const paymentCallback = createTempoPaymentCallback({
                provider,
                userAddress: connectedAddress,
                preferredNetwork: process.env.NEXT_PUBLIC_X402_PREFERRED_NETWORK || 'base-sepolia',
                preferredToken: process.env.NEXT_PUBLIC_X402_PREFERRED_TOKEN || 'native',
            });

            console.log('💳 Updating profile with payment via SDK...');
            const updatedUser = await socialService.updateUserProfile(connectedAddress, profileForm, paymentCallback);

            if (updatedUser) {
                setUser(updatedUser);
                setIsEditingProfile(false);
                alert('✅ Profile updated successfully!');
            } else {
                alert('❌ Failed to update profile');
            }
        } catch (error) {
            console.error('Failed to update profile:', error);
            alert(`❌ Error updating profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };

    const handleFollowToggle = async () => {
        if (!socialService || !connectedAddress || !userAddress || isOwnProfile || !embeddedWallet) {
            return;
        }

        setFollowLoading(true);
        try {
            // Create payment callback for SDK
            const provider = await embeddedWallet.getEthereumProvider();
            const paymentCallback = createTempoPaymentCallback({
                provider,
                userAddress: connectedAddress,
                preferredNetwork: process.env.NEXT_PUBLIC_X402_PREFERRED_NETWORK || 'base-sepolia',
                preferredToken: process.env.NEXT_PUBLIC_X402_PREFERRED_TOKEN || 'native',
            });

            if (isFollowing) {
                console.log('💳 Unfollowing with payment via SDK...');
                const success = await socialService.unfollowUser(connectedAddress, userAddress, paymentCallback);
                if (success) {
                    setIsFollowing(false);
                    // Update follower count optimistically
                    if (user) {
                        setUser({...user, follower_count: Math.max(0, user.follower_count - 1)});
                    }
                }
            } else {
                console.log('💳 Following with payment via SDK...');
                const success = await socialService.followUser(connectedAddress, userAddress, paymentCallback);
                if (success) {
                    setIsFollowing(true);
                    // Update follower count optimistically
                    if (user) {
                        setUser({...user, follower_count: user.follower_count + 1});
                    }
                }
            }
        } catch (error) {
            console.error('Failed to toggle follow:', error);
            alert(`❌ Failed to update follow status: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setFollowLoading(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            alert('Image must be less than 2MB');
            return;
        }

        setSelectedFile(file);

        const reader = new FileReader();
        reader.onloadend = () => {
            setPreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const loadUserAvatar = async (blobId: string) => {
        if (!blobId) return;

        try {
            console.log('🔍 Loading avatar blob:', blobId);

            // Retrieve blob using SDK
            const blob = await sdkClient.retrieveBlob({
                collection: 'avatars',
                blob_id: blobId
            });


            // Create object URL for display
            const blobUrl = URL.createObjectURL(blob as Blob);
            setCurrentAvatarUrl(blobUrl);
            console.log('✅ Avatar loaded successfully');
        } catch (error) {
            console.error('Failed to load avatar:', error);
            setCurrentAvatarUrl(null);
        }
    };

    const handleAvatarUpload = async () => {
        if (!selectedFile || !connectedAddress || !embeddedWallet) {
            alert('Please select an image and connect your wallet');
            return;
        }

        setUploadingAvatar(true);
        try {
            const provider = await embeddedWallet.getEthereumProvider();
            const paymentCallback = createTempoPaymentCallback({
                provider,
                userAddress: connectedAddress,
                preferredNetwork: process.env.NEXT_PUBLIC_X402_PREFERRED_NETWORK || 'base-sepolia',
                preferredToken: process.env.NEXT_PUBLIC_X402_PREFERRED_TOKEN || 'native',
            });

            const uploadResult = await sdkClient.uploadBlob({
                collection: 'avatars',
                blob: selectedFile,
                metadata: {
                    user_address: connectedAddress,
                    uploaded_by: connectedAddress,
                    is_primary: true
                },
            }, paymentCallback);

            console.log('📦 Blob upload queued:', uploadResult);
            console.log('   Blob ID:', uploadResult.blob_id);
            console.log('   Ticket ID:', uploadResult.ticket_id);

            // Wait for upload completion using SDK
            console.log('⏳ Waiting for upload to complete...');
            const task = await sdkClient.waitForTaskCompletion(
                uploadResult.ticket_id,
                1000,
                300000
            );

            console.log('✅ Upload complete!', task);

            // Store only the blob_id in user profile (not the full URL)
            const updatedUser = await socialService?.updateUserProfile(connectedAddress, {
                ...profileForm,
                avatar_url: uploadResult.blob_id  // Store blob_id, not full URL
            });

            if (updatedUser) {
                setUser(updatedUser);
                // Load the avatar to display it
                await loadUserAvatar(uploadResult.blob_id);
                alert('✅ Avatar uploaded successfully!');
                setSelectedFile(null);
                setPreviewUrl(null);
            }

        } catch (error: any) {
            console.error('Upload error:', error);
            alert(`❌ Failed to upload avatar: ${error.message}`);
        } finally {
            setUploadingAvatar(false);
        }
    };

    if (loading && !user) {
        return (
            <div className="min-h-screen bg-[#0a0e1a] relative overflow-hidden flex flex-col">
                <Header onAddressChange={setConnectedAddress}
                        onClick={loadUserData} disabled={false}/>
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <svg className="w-10 h-10 text-blue-400 animate-spin mx-auto mb-4" viewBox="0 0 24 24"
                             fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor"
                                    strokeWidth="3"/>
                            <path className="opacity-75" fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        <p className="text-slate-400 text-sm">Loading profile...</p>
                    </div>
                </div>
            </div>
        );
    }

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
                top: '20%',
                right: '15%',
                animation: 'shooting-star 3.5s ease-in-out infinite',
                animationDelay: '2s'
            }}/>
            <div className="shooting-star" style={{
                top: '45%',
                right: '20%',
                animation: 'shooting-star 4s ease-in-out infinite',
                animationDelay: '5s'
            }}/>

            <Header onAddressChange={setConnectedAddress} onClick={loadUserData}
                    disabled={false}/>

            {/* Onboarding Modal */}
            {showOnboardingModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>

                    <div className="bg-[#0f1420] border border-white/[0.08] rounded-2xl p-8 max-w-md w-full shadow-2xl animate-scale-in relative z-10">
                        <div className="text-center mb-6">
                            <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-400 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">Welcome to OnDB Social!</h2>
                            <p className="text-slate-400 text-sm">
                                Create your profile to start posting and interacting with the community
                            </p>
                        </div>

                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6">
                            <div className="flex items-start gap-3">
                                <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div>
                                    <p className="text-blue-200 text-sm font-medium mb-1">X-402 Payment Required</p>
                                    <p className="text-blue-300/80 text-xs">
                                        Creating your profile requires a small payment to store your data on Celestia blockchain. You'll be prompted to confirm the transaction.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <button
                                onClick={handleCreateProfile}
                                disabled={creatingProfile}
                                className="w-full btn-primary py-3 text-base font-semibold"
                            >
                                {creatingProfile ? (
                                    <>
                                        <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                        </svg>
                                        <span>Creating Profile...</span>
                                    </>
                                ) : (
                                    <span>🚀 Join Now!</span>
                                )}
                            </button>
                            <button
                                onClick={() => router.push('/')}
                                disabled={creatingProfile}
                                className="w-full btn-secondary py-3 text-base"
                            >
                                Maybe Later
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <main className="flex-1 container mx-auto px-4 sm:px-6 py-6 max-w-2xl relative z-10">

                {/* Wallet Connection */}
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
                                        Connect to interact with this profile
                                    </p>
                                </div>
                            </div>
                            <WalletConnect onAddressChange={setConnectedAddress}/>
                        </div>
                    </div>
                )}

                {/* User Profile Header */}
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 mb-6">
                    {!isEditingProfile ? (
                        /* View Mode */
                        <div className="flex items-start gap-5">
                            {/* Profile Picture */}
                            <div className="relative flex-shrink-0">
                                {currentAvatarUrl ? (
                                    <img
                                        src={currentAvatarUrl}
                                        alt="Avatar"
                                        className="w-20 h-20 rounded-full object-cover ring-2 ring-white/[0.08]"
                                    />
                                ) : (
                                    <div
                                        className="w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-400 rounded-full flex items-center justify-center ring-2 ring-white/[0.08]">
                                        <span className="text-white font-semibold text-xl">
                                            {(user?.display_name || userAddress).slice(-2).toUpperCase()}
                                        </span>
                                    </div>
                                )}
                                {user?.verified && (
                                    <div
                                        className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center ring-2 ring-[#0a0e1a]">
                                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                                        </svg>
                                    </div>
                                )}
                            </div>

                            {/* User Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-4 mb-3">
                                    <div className="min-w-0">
                                        <h1 className="text-xl font-semibold text-white truncate">
                                            {user?.display_name || `${userAddress.slice(0, 8)}...${userAddress.slice(-6)}`}
                                        </h1>
                                        <p className="text-slate-500 text-xs font-mono truncate mt-0.5">{userAddress}</p>
                                    </div>

                                    {/* Edit Button (only for own profile) */}
                                    {isOwnProfile ? (
                                        <button
                                            onClick={() => setIsEditingProfile(true)}
                                            className="btn-secondary px-4 py-2 text-sm flex-shrink-0"
                                        >
                                            Edit Profile
                                        </button>
                                    ) : connectedAddress ? (
                                        /* Follow/Unfollow button for other users */
                                        <button
                                            onClick={handleFollowToggle}
                                            disabled={followLoading}
                                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 ${
                                                isFollowing
                                                    ? 'bg-white/[0.06] border border-white/[0.1] text-slate-300 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400'
                                                    : 'btn-primary'
                                            }`}
                                        >
                                            {followLoading ? 'Loading...' : isFollowing ? 'Unfollow' : 'Follow'}
                                        </button>
                                    ) : null}
                                </div>

                                {/* Bio */}
                                {user?.bio && (
                                    <p className="text-slate-300 text-sm mb-3 leading-relaxed">{user.bio}</p>
                                )}

                                {/* Website */}
                                {user?.website_url && (
                                    <a
                                        href={user.website_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-sm mb-3 transition-colors"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
                                             stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round"
                                                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                                        </svg>
                                        {user.website_url}
                                    </a>
                                )}

                                {/* User Stats */}
                                <div className="flex items-center gap-5 text-sm mt-3">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-white font-semibold">{userTweets.length}</span>
                                        <span className="text-slate-500">Posts</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-white font-semibold">{user?.follower_count || 0}</span>
                                        <span className="text-slate-500">Followers</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-white font-semibold">{user?.following_count || 0}</span>
                                        <span className="text-slate-500">Following</span>
                                    </div>
                                </div>

                                {/* User Status */}
                                <div className="flex items-center gap-3 text-xs text-slate-500 mt-3">
                                    <span>Joined {new Date(user?.created_at || Date.now()).toLocaleDateString()}</span>
                                    {user?.status === 'active' && (
                                        <span
                                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-md">
                                            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full"/>
                                            Active
                                        </span>
                                    )}
                                </div>

                                {/* Wallet Info */}
                                <div className="mt-4 pt-4 border-t border-white/[0.06]">
                                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Wallet Address</h3>
                                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-slate-300 text-xs font-mono break-all">{userAddress}</p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(userAddress);
                                                    alert('Address copied to clipboard!');
                                                }}
                                                className="flex-shrink-0 p-2 hover:bg-white/[0.06] rounded-lg transition-colors"
                                                title="Copy address"
                                            >
                                                <svg className="w-4 h-4 text-slate-400 hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Edit Mode */
                        <div className="space-y-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-white">Edit Profile</h2>
                                <button
                                    onClick={() => setIsEditingProfile(false)}
                                    className="text-gray-400 hover:text-white"
                                >
                                    ✕ Cancel
                                </button>
                            </div>

                            {/* Display Name */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">
                                    Display Name
                                </label>
                                <input
                                    type="text"
                                    value={profileForm.display_name}
                                    onChange={(e) => setProfileForm({...profileForm, display_name: e.target.value})}
                                    placeholder="Enter your display name"
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-400/50"
                                    maxLength={50}
                                />
                            </div>

                            {/* Bio */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">
                                    Bio
                                </label>
                                <textarea
                                    value={profileForm.bio}
                                    onChange={(e) => setProfileForm({...profileForm, bio: e.target.value})}
                                    placeholder="Tell us about yourself"
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-400/50 resize-none"
                                    rows={3}
                                    maxLength={160}
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    {profileForm.bio.length}/160 characters
                                </p>
                            </div>

                            {/* Avatar Upload */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">
                                    Profile Photo (Stored on Celestia Blockchain)
                                </label>
                                <div
                                    className="border-2 border-dashed border-white/20 rounded-xl p-6 text-center hover:border-blue-400/50 transition-colors">
                                    {previewUrl ? (
                                        <div className="space-y-4">
                                            <div className="relative inline-block">
                                                <img
                                                    src={previewUrl}
                                                    alt="Preview"
                                                    className="w-32 h-32 object-cover rounded-xl mx-auto"
                                                />
                                                <button
                                                    onClick={() => {
                                                        setSelectedFile(null);
                                                        setPreviewUrl(null);
                                                        if (fileInputRef.current) {
                                                            fileInputRef.current.value = '';
                                                        }
                                                    }}
                                                    className="absolute top-0 right-0 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                            <p className="text-sm text-gray-400">
                                                {selectedFile?.name} ({Math.round((selectedFile?.size || 0) / 1024)}KB)
                                            </p>
                                            <button
                                                onClick={handleAvatarUpload}
                                                disabled={uploadingAvatar}
                                                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-gray-600 disabled:to-gray-700 text-white px-6 py-2 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {uploadingAvatar ? '⏳ Uploading to Celestia...' : '📤 Upload to Blockchain'}
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <div
                                                className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                                                <span className="text-2xl">📸</span>
                                            </div>
                                            <p className="text-gray-300 font-medium mb-1">Upload Profile Photo</p>
                                            <p className="text-sm text-gray-500 mb-3">PNG, JPG, GIF up to 2MB</p>
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/*"
                                                onChange={handleFileSelect}
                                                className="hidden"
                                            />
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-gray-300 hover:text-white transition-colors"
                                            >
                                                Select Image
                                            </button>
                                        </>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    💡 Photos are permanently stored on Celestia blockchain and served via OnDB
                                    CDN
                                </p>
                            </div>

                            {/* Website URL */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">
                                    Website
                                </label>
                                <input
                                    type="url"
                                    value={profileForm.website_url}
                                    onChange={(e) => setProfileForm({...profileForm, website_url: e.target.value})}
                                    placeholder="https://your-website.com"
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-400/50"
                                />
                            </div>

                            {/* Payment Notice */}
                            <div className="bg-yellow-500/10 border border-yellow-400/30 rounded-xl p-4">
                                <p className="text-yellow-200 text-sm">
                                    💰 <strong>Payment Required:</strong> Updating your profile requires a small
                                    payment to store data on Celestia blockchain. You'll be prompted to confirm the
                                    transaction via Tempo.
                                </p>
                            </div>

                            {/* Save Button */}
                            <button
                                onClick={handleUpdateProfile}
                                disabled={loading}
                                className="w-full inline-flex items-center justify-center bg-gradient-to-br from-[rgba(29,78,216,0.95)] via-[rgba(37,99,235,0.9)] to-[rgba(29,78,216,0.95)] backdrop-blur-[10px] text-white font-semibold py-3 px-6 border border-[rgba(255,255,255,0.18)] rounded-xl transition-all duration-500 hover:-translate-y-0.5 hover:scale-[1.02] shadow-[0_10px_40px_rgba(37,99,235,0.15),_inset_0_4px_12px_rgba(255,255,255,0.15),_inset_0_-4px_12px_rgba(37,99,235,0.08)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none gap-2"
                            >
                                {loading ? (
                                    <>
                                        <div
                                            className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        <span>Updating...</span>
                                    </>
                                ) : (
                                    <span>Save Profile</span>
                                )}
                            </button>
                        </div>
                    )}
                </div>

                {/* User's Tweets */}
                <div className="space-y-3">
                    <h2 className="text-sm font-medium text-slate-300 mb-4">
                        {userTweets.length > 0 ? `Posts (${userTweets.length})` : 'Posts'}
                    </h2>

                    {userTweets.length === 0 ? (
                        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-10 text-center">
                            <div
                                className="w-14 h-14 bg-white/[0.03] border border-white/[0.06] rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <svg className="w-7 h-7 text-slate-500" fill="none" viewBox="0 0 24 24"
                                     stroke="currentColor" strokeWidth="1.5">
                                    <path strokeLinecap="round" strokeLinejoin="round"
                                          d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"/>
                                </svg>
                            </div>
                            <h3 className="text-base font-medium text-white mb-1">No posts yet</h3>
                            <p className="text-slate-500 text-sm">
                                {isOwnProfile ? "You haven't posted anything yet." : "This user hasn't posted yet."}
                            </p>
                        </div>
                    ) : (
                        userTweets.map((tweet, index) => {
                            const t = {...tweet, author_info: user || undefined};

                            return (
                                <TweetCard
                                    key={tweet.id}
                                    tweet={t}
                                    connectedAddress={connectedAddress}
                                    index={index}
                                    showActions={false}
                                />
                            )
                        })
                    )}
                </div>
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
