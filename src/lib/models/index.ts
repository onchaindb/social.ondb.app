// Enhanced Data Models for OnChainDB Social App
// Type-safe models with validation and relationship handling

export interface User {
    address: string; // Primary ID - wallet address
    display_name?: string; // Optional display name chosen by user
    bio?: string;
    avatar_url?: string;
    website_url?: string;
    verified: boolean;
    follower_count: number;
    following_count: number;
    tweet_count: number;
    created_at: string;
    updated_at: string;
    version: number; // For blockchain versioning
    status: 'active' | 'inactive';
}

export interface Tweet {
    id: string;
    author: string; // Wallet address of the author
    content: string;
    content_type: 'text' | 'media' | 'poll' | 'quote';
    hashtags: string[];
    mentions: string[];
    media_urls?: string[];
    reply_to_id?: string;
    retweet_of_id?: string;
    quote_tweet_id?: string;
    like_count: number;
    retweet_count: number;
    reply_count: number;
    quote_count: number;
    created_at: string;
    updated_at: string;
    is_deleted: boolean;
    visibility: 'public' | 'followers' | 'mentioned' | 'private';
    language?: string;
    location?: {
        name: string;
        country_code: string;
        coordinates: [number, number];
    };
    engagement_score: number;

    // Populated relationships (not stored in DB)
    author_info?: User;
    reply_to?: Tweet;
    retweet_of?: Tweet;
    quote_tweet?: Tweet;
    user_liked?: boolean;
    user_retweeted?: boolean;
}

export interface Follow {
    id: string;
    follower: string; // Wallet address of the person following
    following: string; // Wallet address of the person being followed
    created_at: string;
    updated_at: string; // For versioning - changes on status updates
    status: 'active' | 'inactive' | 'muted' | 'blocked'; // inactive = unfollowed
}

export interface Like {
    id: string;
    user: string; // Wallet address
    tweet_id: string;
    reaction_type: 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'angry';
    created_at: string;
}

export interface Message {
    id: string;
    conversation_id: string;
    sender_id: string;
    recipient_id: string;
    content: string;
    message_type: 'text' | 'media' | 'link';
    media_urls?: string[];
    created_at: string;
    read_at?: string;
    is_deleted: boolean;

    // Populated relationships
    sender?: User;
    recipient?: User;
}

export interface Trending {
    id: string;
    hashtag: string;
    tweet_count: number;
    engagement_score: number;
    trending_since: string;
    last_updated: string;
    category: 'general' | 'sports' | 'politics' | 'technology' | 'entertainment';
    location?: string;
    is_promoted: boolean;
}

export interface Conversation {
    id: string;
    participants: string[];
    last_message?: Message;
    last_updated: string;
    unread_count: number;
    is_group: boolean;
    group_name?: string;
    group_avatar?: string;
}

// ==================== Extended Models for UI ====================

export interface TweetWithContext extends Tweet {
    author: string;
    author_info?: User; // Populated user profile via JOIN
    reply_to?: TweetWithContext;
    retweet_of?: TweetWithContext;
    quote_tweet?: TweetWithContext;
    user_liked: boolean;
    user_retweeted: boolean;
    replies?: TweetWithContext[];
    thread_position?: {
        is_thread_start: boolean;
        is_thread_end: boolean;
        thread_length: number;
        position: number;
    };
}

export interface UserProfile extends User {
    is_following?: boolean;
    is_followed_by?: boolean;
    is_blocked?: boolean;
    is_muted?: boolean;
    mutual_followers?: User[];
    recent_tweets?: TweetWithContext[];
}

export interface TimelineEntry {
    type: 'tweet' | 'retweet' | 'quote' | 'reply' | 'like' | 'follow';
    id: string;
    created_at: string;
    actor: User; // User who performed the action
    tweet?: TweetWithContext;
    target_user?: User;
    metadata?: {
        reason?: string;
        promoted?: boolean;
        suggested?: boolean;
    };
}

export interface TrendingTopic extends Trending {
    sample_tweets?: TweetWithContext[];
    related_topics?: string[];
    description?: string;
}

// ==================== Form Types ====================

export interface CreateTweetRequest {
    content: string;
    media_urls?: string[];
    reply_to_id?: string;
    quote_tweet_id?: string;
    visibility?: Tweet['visibility'];
    location?: Tweet['location'];
}

export interface UpdateUserProfileRequest {
    display_name?: string;
    bio?: string;
    avatar_url?: string;
    website_url?: string;
}

export interface SendMessageRequest {
    recipient_id: string;
    content: string;
    message_type?: Message['message_type'];
    media_urls?: string[];
}

// ==================== Query Types ====================

export interface TimelineQuery {
    user_id?: string;
    type?: 'home' | 'user' | 'mentions' | 'likes';
    max_id?: string;
    min_id?: string;
    limit?: number;
    include_retweets?: boolean;
    include_replies?: boolean;
}

export interface SearchQuery {
    query: string;
    type?: 'tweets' | 'users' | 'hashtags';
    filter?: {
        from_user?: string;
        language?: string;
        has_media?: boolean;
        has_links?: boolean;
        date_range?: {
            start: string;
            end: string;
        };
    };
    sort?: 'relevance' | 'recent' | 'popular';
    limit?: number;
    offset?: number;
}

export interface UserSearchQuery {
    query?: string;
    filter?: {
        verified?: boolean;
        has_bio?: boolean;
        location?: string;
        min_followers?: number;
    };
    sort?: 'relevance' | 'followers' | 'recent';
    limit?: number;
    offset?: number;
}

// ==================== Response Types ====================

export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        total: number;
        limit: number;
        offset: number;
        has_next: boolean;
        has_prev: boolean;
        next_cursor?: string;
        prev_cursor?: string;
    };
}

export interface TweetResponse {
    tweet: TweetWithContext;
    related_tweets?: TweetWithContext[];
    conversation?: TweetWithContext[];
}

export interface UserResponse {
    user: UserProfile;
    recent_activity?: TimelineEntry[];
}

export interface SearchResponse {
    tweets?: PaginatedResponse<TweetWithContext>;
    users?: PaginatedResponse<UserProfile>;
    hashtags?: TrendingTopic[];
    query_info: {
        query: string;
        execution_time: number;
        total_results: number;
    };
}

// ==================== Analytics Types ====================

export interface TweetAnalytics {
    tweet_id: string;
    impressions: number;
    engagements: number;
    engagement_rate: number;
    likes: number;
    retweets: number;
    replies: number;
    quotes: number;
    link_clicks?: number;
    profile_clicks?: number;
    detail_expands?: number;
    hashtag_clicks?: number;
    breakdown: {
        by_hour: { [hour: string]: number };
        by_day: { [day: string]: number };
        by_location?: { [location: string]: number };
        by_gender?: { [gender: string]: number };
        by_age?: { [age_range: string]: number };
    };
}

export interface UserAnalytics {
    user_id: string;
    period: {
        start: string;
        end: string;
    };
    followers_gained: number;
    followers_lost: number;
    tweets_count: number;
    total_impressions: number;
    total_engagements: number;
    top_tweets: TweetAnalytics[];
    audience_insights: {
        top_locations: { [location: string]: number };
        top_interests: string[];
        age_distribution: { [range: string]: number };
    };
}

// ==================== Error Types ====================

export interface APIError {
    code: string;
    message: string;
    details?: any;
    field?: string;
    timestamp: string;
}

export interface ValidationError {
    field: string;
    message: string;
    code: string;
    value?: any;
}

// ==================== Utility Types ====================

export type EntityType = 'user' | 'tweet' | 'hashtag' | 'mention';
export type NotificationType = 'like' | 'retweet' | 'reply' | 'mention' | 'follow' | 'message';
export type MediaType = 'image' | 'video' | 'gif' | 'audio';

export interface MediaFile {
    url: string;
    type: MediaType;
    size?: number;
    width?: number;
    height?: number;
    duration?: number; // for video/audio
    thumbnail_url?: string;
}

export interface Hashtag {
    tag: string;
    count: number;
    trending: boolean;
}

export interface Mention {
    user_id: string;
    username: string;
    display_name: string;
    start_position: number;
    end_position: number;
}

// ==================== Type Guards ====================

export function isUser(obj: any): obj is User {
    return obj && typeof obj.address === 'string' && obj.address.startsWith('celestia');
}

export function isTweet(obj: any): obj is Tweet {
    return obj && typeof obj.id === 'string' && obj.id.startsWith('tweet_');
}

export function isMessage(obj: any): obj is Message {
    return obj && typeof obj.id === 'string' && obj.id.startsWith('msg_');
}

// ==================== ID Generation ====================

export function generateId(prefix: string): string {
    const randomString = Math.random().toString(36).substring(2, 15);
    return `${prefix}_${randomString}`;
}

export function generateUserId(): string {
    return generateId('user');
}

export function generateTweetId(): string {
    return generateId('tweet');
}

export function generateMessageId(): string {
    return generateId('msg');
}

export function generateFollowId(): string {
    return generateId('follow');
}

export function generateLikeId(): string {
    return generateId('like');
}