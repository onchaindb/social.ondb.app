// Real Social Service using OnChainDB SDK
// This connects to the actual db-client backend for real data operations

import type {X402PaymentCallbackResult, X402Quote} from "@onchaindb/sdk";
import {createClient, DatabaseManager, OnChainDBClient} from "@onchaindb/sdk";

import {CreateTweetRequest, TweetWithContext, UpdateUserProfileRequest, User,} from "@/lib/models";
import {CONFIG} from "@/lib/config";

export interface SocialServiceConfig {
    endpoint: string;
    appId: string;
    apiKey?: string;
    currentUserAddress?: string;
}

/**
 * Real social service that connects to OnChainDB backend
 * Provides actual database operations for social media functionality
 */
export class RealSocialService {
    private client: OnChainDBClient;
    private dbManager: DatabaseManager;
    private config: SocialServiceConfig;

    constructor(config: SocialServiceConfig) {
        this.config = config;

        // Create SDK client for data operations with simplified API
        this.client = createClient({
            endpoint: config.endpoint,
            apiKey: config.apiKey,
            appId: config.appId, // Use simplified API with appId
        });

        // Get database manager for schema operations
        this.dbManager = this.client.database(config.appId);
    }

    /**
     * Create a new tweet
     */
    async createTweet(
        request: CreateTweetRequest,
        authorAddress: string,
        paymentCallback?: (quote: X402Quote) => Promise<X402PaymentCallbackResult>,
    ): Promise<TweetWithContext | null> {
        try {
            // Extract hashtags from content
            const hashtags = request.content.match(/#[\w]+/g) || [];

            const newTweet = {
                id: `tweet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                author: authorAddress,
                content: request.content,
                hashtags: hashtags,
                mentions: [], // Could extract mentions like @username
                media_urls: request.media_urls,
                reply_to_id: request.reply_to_id, // Handle reply relationships
                visibility: request.visibility || "public",
                like_count: 0,
                retweet_count: 0,
                reply_count: 0,
                quote_count: 0,
                is_deleted: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                location: request.location,
                engagement_score: 0,
            };

            // Store tweet with payment callback
            const storeRequest = {
                collection: "tweets",
                data: [newTweet],
            };

            // SDK handles 402 payment automatically with callback
            await this.client.store(storeRequest, paymentCallback);

            console.log("✅ Tweet stored successfully (async processing completed)");
            // TODO: Increment reply_count on parent tweet if this is a reply

            return this.mapTweetData(newTweet);
        } catch (error) {
            console.error("Failed to create tweet:", error);
            return null;
        }
    }

    mapTweetData(
        tweetData: Record<string, any>,
        user_liked = false,
        user_retweeted = false,
    ): TweetWithContext {
        return {
            id: tweetData.id,
            author: tweetData.author,
            content: tweetData.content,
            content_type: tweetData.content_type || "text",
            hashtags: tweetData.hashtags || [],
            mentions: tweetData.mentions || [],
            media_urls: tweetData.media_urls,
            reply_to_id: tweetData.reply_to_id,
            retweet_of_id: tweetData.retweet_of_id,
            quote_tweet_id: tweetData.quote_tweet_id,
            like_count: tweetData.like_count || 0,
            retweet_count: tweetData.retweet_count || 0,
            reply_count: tweetData.reply_count || 0,
            quote_count: tweetData.quote_count || 0,
            created_at: tweetData.timestamp || tweetData.created_at,
            updated_at: tweetData.timestamp || tweetData.updated_at,
            is_deleted: tweetData.is_deleted || false,
            visibility: tweetData.visibility || "public",
            language: tweetData.language,
            location: tweetData.location,
            engagement_score: tweetData.engagement_score || 0,
            user_liked,
            user_retweeted,
        };
    }

    /**
     * Get public timeline with server-side JOINs and pagination
     * Uses joinMany to get ALL likes and retweets in a single query
     */
    async getPublicTimeline(limit: number = 20, offset: number = 0): Promise<TweetWithContext[]> {
        try {
            console.log(
                `🚀 Getting public timeline with server-side JOINs (limit: ${limit}, offset: ${offset})`,
            );

            // Use server-side JOINs to get tweets with authors, quoted tweets, likes, and retweets in ONE request
            const result = await this.client
                .queryBuilder()
                .collection("tweets")
                .whereField("reply_to_id")
                .isNull() // Only root tweets (not replies)
                // JOIN 1: Get author user profile (one-to-one)
                .joinOne("author_info", "users")
                .onField("address")
                .equals("$data.author")
                .selectFields([
                    "address",
                    "display_name",
                    "bio",
                    "avatar_url",
                    "verified",
                ])
                .build()
                // JOIN 2: Get ALL likes for this tweet (one-to-many)
                .joinMany("likes", "likes")
                .onField("tweet_id")
                .equals("$data.id")
                .selectFields(["user", "created_at"])
                .build()
                // JOIN 3: Get ALL retweets for this tweet (one-to-many)
                .joinMany("retweets", "retweets")
                .onField("tweet_id")
                .equals("$data.id")
                .selectFields(["user", "created_at"])
                .build()
                // JOIN 4: Get ALL replies to this tweet (one-to-many)
                .joinMany("replies", "tweets")
                .onField("reply_to_id")
                .equals("$data.id")
                .selectFields(["id", "author", "created_at"])
                .build()
                // JOIN 5: Get ALL quote tweets of this tweet (one-to-many)
                .joinMany("quotes", "tweets")
                .onField("quote_tweet_id")
                .equals("$data.id")
                .selectFields(["id", "author", "created_at"])
                .build()
                // JOIN 6: Get quoted tweet if this tweet quotes another (one-to-one)
                .joinOne("quote_tweet", "tweets")
                .onField("id")
                .equals("$data.quote_tweet_id")
                .selectFields(["id", "content", "author", "like_count", "created_at"])
                // JOIN 4.1: Get author info for the quoted tweet (nested JOIN)
                .joinOne("author_info", "users")
                .onField("address")
                .equals("$data.author")
                .selectFields([
                    "address",
                    "display_name",
                    "bio",
                    "avatar_url",
                    "verified",
                ])
                .build()
                .build()
                .selectAll()
                .offset(offset)
                .limit(limit)
                .execute();

            if (!result.records) return [];

            // Process tweets - all data already resolved by server-side JOINs
            const tweets: TweetWithContext[] = result.records.map((record: any) => {
                const tweetData = record;

                // Count likes and check if current user liked (from JOIN)
                const likes = tweetData.likes || [];
                const like_count = likes.length;
                const user_liked = this.config.currentUserAddress
                    ? likes.some((like: any) => like.user === this.config.currentUserAddress)
                    : false;

                // Count retweets (from JOIN)
                const retweets = tweetData.retweets || [];
                const retweet_count = retweets.length;

                // Count replies (from JOIN)
                const replies = tweetData.replies || [];
                const reply_count = replies.length;

                // Count quotes (from JOIN)
                const quotes = tweetData.quotes || [];
                const quote_count = quotes.length;

                // Author info and quoted tweet already resolved by server-side JOINs
                const authorInfo = tweetData.author_info || null;
                const quotedTweet = tweetData.quote_tweet || null;

                const tweetWithContext = this.mapTweetData(
                    tweetData,
                    user_liked,
                    false,
                );

                // Set real-time counts from JOINs
                tweetWithContext.like_count = like_count;
                tweetWithContext.retweet_count = retweet_count;
                tweetWithContext.reply_count = reply_count;
                tweetWithContext.quote_count = quote_count;

                // Add author info if available
                if (authorInfo) {
                    tweetWithContext.author_info = authorInfo;
                }

                if (quotedTweet) {
                    tweetWithContext.quote_tweet = quotedTweet as never;
                }

                return tweetWithContext;
            });

            console.log(
                `✅ Processed ${tweets.length} tweets with real-time counts from JOINs`,
            );
            return tweets;
        } catch (error) {
            console.error("Failed to get public timeline:", error);
            return [];
        }
    }

    /**
     * Get tweets by author address with server-side JOINs
     */
    async getTweetsByAuthor(
        authorAddress: string,
        limit: number = 20,
    ): Promise<TweetWithContext[]> {
        try {
            console.log(
                "🚀 Getting tweets by author with server-side JOINs (author + quoted tweets)",
            );

            // Use server-side JOINs for author info and quote tweets
            const result = await this.client
                .queryBuilder()
                .collection("tweets")
                .whereField("author")
                .equals(authorAddress)
                // JOIN 1: Get author user profile (one-to-one)
                .joinOne("author_info", "users")
                .onField("address")
                .equals("$data.author")
                .selectFields([
                    "address",
                    "display_name",
                    "bio",
                    "avatar_url",
                    "verified",
                ])
                .build()
                // JOIN 2: Get quoted tweet if this tweet quotes another (one-to-one)
                .joinOne("quote_tweet", "tweets")
                .onField("id")
                .equals("$data.quote_tweet_id")
                .selectFields(["id", "content", "author", "like_count", "created_at"])
                // JOIN 2.1: Get author info for the quoted tweet (nested JOIN)
                .joinOne("author_info", "users")
                .onField("address")
                .equals("$data.author")
                .selectFields([
                    "address",
                    "display_name",
                    "bio",
                    "avatar_url",
                    "verified",
                ])
                .build()
                .build()
                .selectAll()
                .limit(limit)
                .execute();

            if (!result.records) return [];

            // Process tweets - author info and quoted tweets already resolved by server-side JOINs
            const tweets: TweetWithContext[] = [];
            for (const record of result.records) {
                const tweetData = record;

                // Author info and quoted tweet already resolved by server-side JOINs
                const authorInfo = tweetData.author_info || null;
                const quotedTweet = tweetData.quote_tweet || null; // JOIN alias is 'quote_tweet'

                const tweetWithContext = this.mapTweetData(tweetData);

                // Add author info if available
                if (authorInfo) {
                    tweetWithContext.author_info = authorInfo;
                }

                if (quotedTweet) {
                    tweetWithContext.quote_tweet = quotedTweet;
                }
                tweets.push(tweetWithContext);
            }

            console.log(
                `✅ Processed ${tweets.length} tweets for author with server-side JOINs (including author info)`,
            );
            return tweets;
        } catch (error) {
            console.error("Failed to get tweets by author:", error);
            return [];
        }
    }

    /**
     * Get a single tweet with its replies using server-side JOINs
     */
    async getTweetWithReplies(tweetId: string): Promise<{
        tweet: TweetWithContext | null;
        replies: TweetWithContext[];
        total_replies: number;
    }> {
        try {
            console.log(
                "🚀 Getting tweet with replies using server-side JOINs (author + replies + quoted tweets)",
            );

            // Use server-side JOINs to get tweet with author, replies, AND quoted tweets in ONE request
            const result = await this.client
                .queryBuilder()
                .collection("tweets")
                .whereField("id")
                .equals(tweetId)
                // JOIN 1: Get author user profile (one-to-one)
                .joinOne("author_info", "users")
                .onField("address")
                .equals("$data.author")
                .selectFields([
                    "address",
                    "display_name",
                    "bio",
                    "avatar_url",
                    "verified",
                ])
                .build()
                // JOIN 2: Get all replies to this tweet (one-to-many)
                .joinMany("replies", "tweets")
                .onField("reply_to_id")
                .equals("$data.id")
                .selectAll()
                // JOIN 2.1: Get author info for each reply (nested JOIN)
                .joinOne("author_info", "users")
                .onField("address")
                .equals("$data.author")
                .selectFields([
                    "address",
                    "display_name",
                    "bio",
                    "avatar_url",
                    "verified",
                ])
                .build()
                // JOIN 2.2: Get quoted tweet for each reply if it quotes another (nested JOIN)
                .joinOne("quote_tweet", "tweets")
                .onField("id")
                .equals("$data.quote_tweet_id")
                .selectFields(["id", "content", "author", "like_count", "created_at"])
                // JOIN 2.2.1: Get author info for the quoted tweet in reply (nested nested JOIN)
                .joinOne("author_info", "users")
                .onField("address")
                .equals("$data.author")
                .selectFields([
                    "address",
                    "display_name",
                    "bio",
                    "avatar_url",
                    "verified",
                ])
                .build()
                .build()
                .build()
                // JOIN 3: Get quoted tweet if main tweet quotes another (one-to-one)
                .joinOne("quote_tweet", "tweets")
                .onField("id")
                .equals("$data.quote_tweet_id")
                .selectFields(["id", "content", "author", "like_count", "created_at"])
                // JOIN 3.1: Get author info for the quoted tweet (nested JOIN)
                .joinOne("author_info", "users")
                .onField("address")
                .equals("$data.author")
                .selectFields([
                    "address",
                    "display_name",
                    "bio",
                    "avatar_url",
                    "verified",
                ])
                .build()
                .build()
                .selectAll()
                .limit(1)
                .execute();

            if (!result.records || result.records.length === 0) {
                return {
                    tweet: null,
                    replies: [],
                    total_replies: 0,
                };
            }

            const tweetWithJoins = result.records[0];

            // Process main tweet - author info and quoted tweet already resolved by server-side JOINs
            let user_liked = false;
            if (this.config.currentUserAddress) {
                const likeResult = await this.client
                    .queryBuilder()
                    .collection("likes")
                    .whereField("user")
                    .equals(this.config.currentUserAddress)
                    .whereField("tweet_id")
                    .equals(tweetId)
                    .selectAll()
                    .limit(1)
                    .execute();
                user_liked = likeResult.records && likeResult.records.length > 0;
            }

            const authorInfo = tweetWithJoins.author_info || null;
            const quotedTweet = tweetWithJoins.quote_tweet || null; // JOIN alias is 'quote_tweet'
            const tweet = this.mapTweetData(tweetWithJoins, user_liked, false);

            // Add author info if available
            if (authorInfo) {
                tweet.author_info = authorInfo;
            }

            if (quotedTweet) {
                tweet.quote_tweet = quotedTweet;
            }

            // Process replies - already resolved by server-side JOIN
            const replies: TweetWithContext[] = [];
            const repliesData = tweetWithJoins.replies || [];

            for (const replyRecord of repliesData) {
                if (!replyRecord.content) continue; // Skip invalid replies

                // Check if user liked this reply
                let reply_user_liked = false;
                if (this.config.currentUserAddress) {
                    const replyLikeResult = await this.client
                        .queryBuilder()
                        .collection("likes")
                        .whereField("user")
                        .equals(this.config.currentUserAddress)
                        .whereField("tweet_id")
                        .equals(replyRecord.id)
                        .selectAll()
                        .limit(1)
                        .execute();
                    reply_user_liked =
                        replyLikeResult.records && replyLikeResult.records.length > 0;
                }

                // Author info and quoted tweet already resolved by nested JOINs
                const replyAuthorInfo = replyRecord.author_info || null;
                const replyQuotedTweet = replyRecord.quote_tweet || null;

                const replyWithContext = this.mapTweetData(
                    replyRecord,
                    reply_user_liked,
                    false,
                );

                // Add author info if available
                if (replyAuthorInfo) {
                    replyWithContext.author_info = replyAuthorInfo;
                }

                // Add quoted tweet if available
                if (replyQuotedTweet) {
                    replyWithContext.quote_tweet = replyQuotedTweet;
                }

                replies.push(replyWithContext);
            }

            console.log(
                `✅ Retrieved tweet with ${replies.length} replies using server-side JOINs`,
            );

            return {
                tweet,
                replies,
                total_replies: replies.length,
            };
        } catch (error) {
            console.error("Failed to get tweet with replies:", error);
            return {
                tweet: null,
                replies: [],
                total_replies: 0,
            };
        }
    }

    /**
     * Get a single tweet by ID
     */
    async getTweet(tweetId: string): Promise<TweetWithContext | null> {
        try {
            const result = await this.client
                .queryBuilder()
                .collection("tweets")
                .whereField("id")
                .equals(tweetId)
                .selectAll()
                .limit(1)
                .execute();

            if (!result.records || result.records.length === 0) return null;

            const tweet = result.records[0];
            return this.mapTweetData(tweet);
        } catch (error) {
            console.error("Failed to get tweet:", error);
            return null;
        }
    }

    /**
     * Get replies to a tweet with server-side JOINs
     */
    async getReplies(
        tweetId: string,
        limit: number = 50,
    ): Promise<TweetWithContext[]> {
        try {
            console.log(
                "🚀 Getting replies with server-side JOINs (author + quoted tweets):",
                tweetId,
            );

            // Use server-side JOINs to get replies with author info and quoted tweets
            const result = await this.client
                .queryBuilder()
                .collection("tweets")
                .whereField("reply_to_id")
                .equals(tweetId)
                // JOIN 1: Get author user profile (one-to-one)
                .joinOne("author_info", "users")
                .onField("address")
                .equals("$data.author")
                .selectFields([
                    "address",
                    "display_name",
                    "bio",
                    "avatar_url",
                    "verified",
                ])
                .build()
                // JOIN 2: Get quoted tweet if reply quotes another tweet (one-to-one)
                .joinOne("quote_tweet", "tweets")
                .onField("id")
                .equals("$data.quote_tweet_id")
                .selectFields(["id", "content", "author", "like_count", "created_at"])
                .build()
                .selectAll()
                .limit(limit)
                .execute();

            console.log("Replies query result:", result);

            if (!result.records) {
                console.log("No reply records found");
                return [];
            }

            console.log(`Found ${result.records.length} reply records`);

            // Process replies - author info and quoted tweets already resolved by server-side JOINs
            const replies: TweetWithContext[] = [];
            for (const record of result.records) {
                const tweetData = record;

                console.log("Processing reply record:", record.id);

                // Filter out non-tweet records
                if (!tweetData.content) {
                    console.log("Skipping non-reply record:", record.id, "no content");
                    continue;
                }

                // Check if current user liked this reply
                let user_liked = false;
                if (this.config.currentUserAddress) {
                    const likeResult = await this.client
                        .queryBuilder()
                        .collection("likes")
                        .whereField("user")
                        .equals(this.config.currentUserAddress)
                        .whereField("tweet_id")
                        .equals(record.id)
                        .selectAll()
                        .limit(1)
                        .execute();
                    user_liked = likeResult.records && likeResult.records.length > 0;
                }

                // Author info and quoted tweet already resolved by server-side JOINs
                const authorInfo = tweetData.author_info || null;
                const quotedTweet = tweetData.quote_tweet || null; // JOIN alias is 'quote_tweet'

                const replyWithContext = this.mapTweetData(
                    tweetData,
                    user_liked,
                    false,
                );

                // Add author info if available
                if (authorInfo) {
                    replyWithContext.author_info = authorInfo;
                }

                if (quotedTweet) {
                    replyWithContext.quote_tweet = quotedTweet;
                }
                replies.push(replyWithContext);
            }

            console.log(
                `✅ Processed ${replies.length} valid replies with server-side JOINs (including author info)`,
            );
            return replies;
        } catch (error) {
            console.error("Failed to get replies:", error);
            return [];
        }
    }

    /**
     * Create a quote tweet (subtweet)
     */
    async createQuoteTweet(
        request: CreateTweetRequest,
        authorAddress: string,
        quotedTweetId: string,
        paymentCallback?: (quote: X402Quote) => Promise<X402PaymentCallbackResult>,
    ): Promise<TweetWithContext | null> {
        try {
            const newTweet = {
                id: `tweet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                author: authorAddress,
                content: request.content,
                media_urls: request.media_urls,
                reply_to_id: request.reply_to_id,
                quote_tweet_id: quotedTweetId, // Link to the quoted tweet
                like_count: 0,
                retweet_count: 0,
                reply_count: 0,
                quote_count: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                is_deleted: false,
                visibility: request.visibility || "public",
                location: request.location,
                engagement_score: 0,
            };

            console.log("Creating quote tweet:", newTweet);

            // Store quote tweet with payment callback
            const storeRequest = {
                collection: "tweets",
                data: [newTweet],
            };

            // SDK handles 402 payment automatically with callback
            await this.client.store(storeRequest, paymentCallback);

            // TODO: Increment quote_count on original tweet

            return this.mapTweetData(newTweet);
        } catch (error) {
            console.error("Failed to create quote tweet:", error);
            return null;
        }
    }

    /*
       * tweets [id] [author] [content] [createdAt]
       * users  [address] [publicUsername]
       * *      author_info
       * * user publish
       *       tweet  1 0xcelectia3999312 "Hey" 10/09/2025
       * result = await this.client.queryBuilder()
                  .collection('tweets')
                  .join('users', 'address', 'author', 'author_info')
                  .whereField("reply_to_id").equals(tweetId)
                  .selectAll()
                  .limit(limit)
                  .execute()
       *
       * *
       * *   1 0xcelectia3999312 "Hey" 10/09/2025 -> author_info author_info
       * *   2 0xcelectia3999312 "Hey Now" 10/09/2025
       * *
       * * { id: 1, author: "0xcelectia3999312" content: "Hey", author_info: { address: "0xcelectia3999312" , publicUsername: Matt }}
       * *
       * *
       * *
      */

    /**
     * Upload image for tweet with 402 payment flow
     * Returns blob_id on success, null on failure
     */
    async uploadImage(
        file: File,
        userAddress: string,
        paymentCallback: (quote: X402Quote) => Promise<X402PaymentCallbackResult>,
        tweetId?: string
    ): Promise<string | null> {
        try {
            console.log(`📸 Uploading image: ${file.name} (${file.size} bytes)`);

            const fileSizeKB = Math.ceil(file.size / 1024);
            console.log(`💰 Uploading ${fileSizeKB}KB image with payment callback...`);

            // Upload blob with metadata using payment callback
            const uploadResult = await this.client.uploadBlob({
                collection: 'tweet_images',
                blob: file,
                metadata: {
                    user_address: userAddress,
                    tweet_id: tweetId || ''
                },
            }, paymentCallback);

            console.log(`✅ Blob upload initiated: ${uploadResult.blob_id}`);
            console.log(`⏳ Waiting for upload completion (ticket: ${uploadResult.ticket_id})...`);

            // Step 4: Wait for upload completion
            const task = await this.client.waitForTaskCompletion(uploadResult.ticket_id);

            if (task.status === 'Completed') {
                console.log(`🎉 Image uploaded successfully! Blob ID: ${uploadResult.blob_id}`);
                return uploadResult.blob_id;
            } else {
                console.error(`❌ Upload failed with status: ${task.status}`);
                return null;
            }
        } catch (error) {
            console.error('Failed to upload image:', error);
            return null;
        }
    }

    /**
     * Like a tweet
     */
    async likeTweet(
        userAddress: string,
        tweetId: string,
        paymentCallback?: (quote: X402Quote) => Promise<X402PaymentCallbackResult>
    ): Promise<boolean> {
        try {
            // Check if already liked
            const existingLike = await this.client
                .queryBuilder()
                .collection("likes")
                .whereField("user")
                .equals(userAddress)
                .whereField("tweet_id")
                .equals(tweetId)
                .selectAll()
                .limit(1)
                .execute();

            if (existingLike.records && existingLike.records.length > 0) {
                return false; // Already liked
            }

            // Create like record
            const likeData = {
                id: `like_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                user: userAddress,
                tweet_id: tweetId,
                reaction_type: "like",
                created_at: new Date().toISOString(),
            };

            // Store like with payment callback
            const storeRequest = {
                collection: "likes",
                data: [likeData],
            };

            // SDK handles 402 payment automatically with callback
            await this.client.store(storeRequest, paymentCallback);

            console.log("✅ Like stored successfully");

            return true;
        } catch (error) {
            console.error("Failed to like tweet:", error);
            return false;
        }
    }


    /**
     * Follow a user (versioned with status tracking)
     * Uses the same ID to create new versions when status changes
     */
    async followUser(
        followerAddress: string,
        followingAddress: string,
        paymentCallback?: (quote: X402Quote) => Promise<X402PaymentCallbackResult>
    ): Promise<boolean> {
        try {
            if (followerAddress === followingAddress) {
                console.warn("Cannot follow yourself");
                return false;
            }

            console.log(
                `🔄 Following user: ${followerAddress} → ${followingAddress}`,
            );

            // Check existing follow relationship (get latest version)
            const existingFollow = await this.client
                .queryBuilder()
                .collection("follows")
                .whereField("follower")
                .equals(followerAddress)
                .whereField("following")
                .equals(followingAddress)
                .selectAll()
                .limit(10) // Get multiple versions to find latest
                .execute();

            let followId: string;
            let isRefollow = false;

            if (existingFollow.records && existingFollow.records.length > 0) {
                // Sort by updated_at to get the latest version
                const sortedRecords = existingFollow.records.sort(
                    (a: any, b: any) =>
                        new Date(b.updated_at || b.created_at).getTime() -
                        new Date(a.updated_at || a.created_at).getTime(),
                );
                const latestFollow = sortedRecords[0];

                if (latestFollow.status === "active") {
                    console.log("Already following (active status)");
                    return false; // Already actively following
                }

                // Refollow - use the same ID
                followId = latestFollow.id;
                isRefollow = true;
                console.log(`📝 Refollowing with ID: ${followId}`);
            } else {
                // New follow relationship
                followId = `follow_${followerAddress.slice(
                    -8,
                )}_${followingAddress.slice(-8)}_${Date.now()}`;
                console.log(`✨ New follow with ID: ${followId}`);
            }

            // Create new version of follow relationship with active status
            const newFollowVersion = {
                id: followId,
                follower: followerAddress,
                following: followingAddress,
                status: "active",
                created_at: isRefollow
                    ? existingFollow.records[0].created_at
                    : new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };

            // Store follow relationship with payment callback
            const storeRequest = {
                collection: "follows",
                data: [newFollowVersion],
            };

            // SDK handles 402 payment automatically with callback
            await this.client.store(storeRequest, paymentCallback);

            console.log(`✅ ${isRefollow ? "Refollowed" : "Followed"} successfully`);
            return true;
        } catch (error) {
            console.error("Failed to follow user:", error);
            return false;
        }
    }

    /**
     * Unfollow a user (creates new version with inactive status)
     * This preserves the follow history while marking the relationship as inactive
     */
    async unfollowUser(
        followerAddress: string,
        followingAddress: string,
        paymentCallback?: (quote: X402Quote) => Promise<X402PaymentCallbackResult>
    ): Promise<boolean> {
        try {
            console.log(
                `🔄 Unfollowing user: ${followerAddress} ⊗ ${followingAddress}`,
            );

            // Get existing follow relationship
            const existingFollow = await this.client
                .queryBuilder()
                .collection("follows")
                .whereField("follower")
                .equals(followerAddress)
                .whereField("following")
                .equals(followingAddress)
                .selectAll()
                .limit(10)
                .execute();

            if (!existingFollow.records || existingFollow.records.length === 0) {
                console.log("Not following this user");
                return false;
            }

            // Get latest version
            const sortedRecords = existingFollow.records.sort(
                (a: any, b: any) =>
                    new Date(b.updated_at || b.created_at).getTime() -
                    new Date(a.updated_at || a.created_at).getTime(),
            );
            const latestFollow = sortedRecords[0];

            if (latestFollow.status !== "active") {
                console.log("Already unfollowed");
                return false;
            }

            // Create new version with inactive status
            const unfollowVersion = {
                id: latestFollow.id, // Same ID for versioning
                follower: followerAddress,
                following: followingAddress,
                status: "inactive", // Mark as inactive instead of deleting
                created_at: latestFollow.created_at,
                updated_at: new Date().toISOString(),
            };

            // Store unfollow relationship with payment callback
            const storeRequest = {
                collection: "follows",
                data: [unfollowVersion],
            };

            // SDK handles 402 payment automatically with callback
            await this.client.store(storeRequest, paymentCallback);

            console.log("✅ Unfollowed successfully (marked inactive)");
            return true;
        } catch (error) {
            console.error("Failed to unfollow user:", error);
            return false;
        }
    }

    /**
     * Check if follower is following another user
     */
    async isFollowing(
        followerAddress: string,
        followingAddress: string,
    ): Promise<boolean> {
        try {
            const result = await this.client
                .queryBuilder()
                .collection("follows")
                .whereField("follower")
                .equals(followerAddress)
                .whereField("following")
                .equals(followingAddress)
                .selectAll()
                .limit(10)
                .execute();

            if (!result.records || result.records.length === 0) return false;

            // Get latest version
            const sortedRecords = result.records.sort(
                (a: any, b: any) =>
                    new Date(b.updated_at || b.created_at).getTime() -
                    new Date(a.updated_at || a.created_at).getTime(),
            );

            return sortedRecords[0].status === "active";
        } catch (error) {
            console.error("Failed to check follow status:", error);
            return false;
        }
    }

    /**
     * Get quoted tweet with optimized lookup
     * Leverages tweets -> tweets quote relation
     */
    async getQuotedTweet(quoteTweetId: string): Promise<TweetWithContext | null> {
        if (!quoteTweetId) return null;

        console.log("🚀 Using join-optimized lookup for quoted tweet");

        // This benefits from the Hash index on tweets.id (unique constraint)
        // Making it an O(log n) lookup, but typically very fast due to index
        return await this.getTweet(quoteTweetId);
    }

    /**
     * Create or update a user profile
     * Called when user connects wallet or updates their profile
     */
    async upsertUser(
        address: string,
        profileData?: UpdateUserProfileRequest,
        paymentCallback?: (quote: X402Quote) => Promise<X402PaymentCallbackResult>,
    ): Promise<User | null> {
        try {
            console.log("🚀 Upserting user profile for address:", address);

            // First, check if user already exists
            const existingUser = await this.getUser(address);

            if (existingUser) {
                // User exists - update if profile data provided
                if (profileData) {
                    console.log("📝 Updating existing user profile");
                    const updatedUser = {
                        ...existingUser,
                        ...profileData,
                        updated_at: new Date().toISOString(),
                    };

                    const storeRequest = {
                        collection: "users",
                        data: [updatedUser],
                    };

                    // SDK handles 402 payment automatically with callback
                    await this.client.store(storeRequest, paymentCallback);
                    console.log("✅ User profile updated successfully");
                    return updatedUser;
                } else {
                    console.log("✅ User already exists, no update needed");
                    return existingUser;
                }
            } else {
                // Create new user
                console.log("✨ Creating new user profile");
                const newUser: User = {
                    address,
                    display_name: profileData?.display_name,
                    bio: profileData?.bio,
                    avatar_url: profileData?.avatar_url,
                    website_url: profileData?.website_url,
                    verified: false,
                    follower_count: 0,
                    following_count: 0,
                    tweet_count: 0,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    version: 1,
                    status: "active",
                };

                const storeRequest = {
                    collection: "users",
                    data: [newUser],
                };

                // SDK handles 402 payment automatically with callback
                await this.client.store(storeRequest, paymentCallback);
                console.log("✅ New user profile created");
                return newUser;
            }
        } catch (error) {
            console.error("Failed to upsert user:", error);
            return null;
        }
    }

    /**
     * Get user profile by address
     */
    async getUser(address: string): Promise<User | null> {
        try {
            const result = await this.client
                .queryBuilder()
                .collection("users")
                .whereField("address")
                .equals(address)
                .selectAll()
                .limit(1)
                .execute();

            if (!result.records || result.records.length === 0) {
                return null;
            }

            return result.records[0] as User;
        } catch (error) {
            console.error("Failed to get user:", error);
            return null;
        }
    }

    /**
     * Update user profile
     */
    async updateUserProfile(
        address: string,
        updates: UpdateUserProfileRequest,
        paymentCallback?: (quote: X402Quote) => Promise<X402PaymentCallbackResult>
    ): Promise<User | null> {
        return this.upsertUser(address, updates, paymentCallback);
    }

    /**
     * Get user profile WITH their tweets, followers, and following in a SINGLE optimized query using server-side JOINs
     * This demonstrates the power of JOINs - fetching all related data in one request!
     */
    async getUserWithTweets(
        address: string,
        limit: number = 50,
    ): Promise<{
        user: User | null;
        tweets: TweetWithContext[];
        followers?: any[];
        following?: any[];
    }> {
        try {
            console.log(
                "🚀🚀🚀 Getting user WITH tweets, followers, and following using server-side JOINs",
            );
            console.log(
                "📊 This is an OPTIMIZED query - user + tweets + followers + following in ONE request!",
            );

            // SINGLE QUERY with MULTIPLE JOINs: Get user with tweets, followers, and following together!
            const result = await this.client
                .queryBuilder()
                .collection("users")
                .whereField("address")
                .equals(address)
                // JOIN 1: Get all tweets by this user (one-to-many)
                .joinMany("user_tweets", "tweets")
                .onField("author")
                .equals("$data.address")
                .selectAll()
                .build()
                // JOIN 2: Get all followers (people who follow this user) (one-to-many)
                .joinMany("followers", "follows")
                .onField("following")
                .equals("$data.address")
                .selectAll()
                .build()
                // JOIN 3: Get all following (people this user follows) (one-to-many)
                .joinMany("following", "follows")
                .onField("follower")
                .equals("$data.address")
                .selectAll()
                .build()
                .selectAll()
                .limit(1)
                .execute();

            console.log("📦 Query result:", JSON.stringify(result, null, 2));

            if (!result.records || result.records.length === 0) {
                console.log("❌ No user found");
                return {
                    user: null,
                    tweets: [],
                    followers: [],
                    following: [],
                };
            }

            const userRecord = result.records[0];
            console.log("✅ User record with joined data:", userRecord);

            // Extract user data (excluding the joined fields)
            const {
                user_tweets,
                followers: followersData,
                following: followingData,
                ...userData
            } = userRecord;
            const user = userData as User;

            // Extract tweets from the joined field
            const tweetsArray = user_tweets || [];
            console.log(
                `📝 Found ${
                    Array.isArray(tweetsArray) ? tweetsArray.length : 0
                } tweets in JOIN result`,
            );

            // Process tweets (limit on client side since JOIN doesn't support limit)
            const tweets: TweetWithContext[] = Array.isArray(tweetsArray)
                ? tweetsArray
                    .filter((tweet: any) => tweet && tweet.content) // Filter out invalid tweets
                    .slice(0, limit) // Limit to requested number of tweets
                    .map((tweet: any) => this.mapTweetData(tweet))
                : [];

            // Extract followers (people who follow this user)
            const followers = Array.isArray(followersData) ? followersData : [];
            console.log(`👥 Found ${followers.length} followers in JOIN result`);

            // Extract following (people this user follows)
            const following = Array.isArray(followingData) ? followingData : [];
            console.log(`👤 Found ${following.length} following in JOIN result`);

            // Update user counts based on actual JOIN results
            user.follower_count = followers.length;
            user.following_count = following.length;

            console.log(
                `✅✅✅ Retrieved user profile + ${tweets.length} tweets + ${followers.length} followers + ${following.length} following in ONE optimized query with JOINs!`,
            );
            console.log(
                `⚡ Performance win: 1 request instead of 4 separate requests!`,
            );

            return {
                user,
                tweets,
                followers,
                following,
            };
        } catch (error) {
            console.error("Failed to get user with tweets:", error);
            return {
                user: null,
                tweets: [],
                followers: [],
                following: [],
            };
        }
    }

    /**
     * Get real-time counts for a tweet using aggregation queries
     */
    private async getTweetCounts(tweetId: string): Promise<{
        like_count: number;
        reply_count: number;
        quote_count: number;
    }> {
        try {
            // Run 3 count queries in parallel
            const [likeResult, replyResult, quoteResult] = await Promise.all([
                // Count likes for this tweet
                this.client
                    .queryBuilder()
                    .collection("likes")
                    .whereField("tweet_id")
                    .equals(tweetId)
                    .selectAll()
                    .execute(),
                // Count replies to this tweet
                this.client
                    .queryBuilder()
                    .collection("tweets")
                    .whereField("reply_to_id")
                    .equals(tweetId)
                    .selectAll()
                    .execute(),
                // Count quotes of this tweet
                this.client
                    .queryBuilder()
                    .collection("tweets")
                    .whereField("quote_tweet_id")
                    .equals(tweetId)
                    .selectAll()
                    .execute(),
            ]);

            return {
                like_count: likeResult.records?.length || 0,
                reply_count: replyResult.records?.length || 0,
                quote_count: quoteResult.records?.length || 0,
            };
        } catch (error) {
            console.error(`Failed to get counts for tweet ${tweetId}:`, error);
            return {like_count: 0, reply_count: 0, quote_count: 0};
        }
    }

}
