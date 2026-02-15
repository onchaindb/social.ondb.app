#!/usr/bin/env node

/**
 * Complete Index Setup for OnChainDB Twitter Clone
 *
 * This creates ALL necessary indexes for:
 * - tweets collection (with JOIN support)
 * - users collection (with JOIN support)
 * - likes collection
 * - retweets collection
 * - follows collection (with versioning support)
 *
 * JOIN relationships:
 * - tweets.author -> users.address (one-to-one)
 * - tweets.reply_to_id -> tweets.id (one-to-one)
 * - tweets.quote_tweet_id -> tweets.id (one-to-one)
 * - follows.follower -> users.address (many-to-one)
 * - follows.following -> users.address (many-to-one)
 * - likes.user -> users.address (many-to-one)
 * - likes.tweet_id -> tweets.id (many-to-one)
 * - retweets.user -> users.address (many-to-one)
 * - retweets.tweet_id -> tweets.id (many-to-one)
 */

const dotenv = require('dotenv')

dotenv.config({path: '../.env'});

const {createClient} = require('@onchaindb/sdk');

// Configuration
const CONFIG = {
    endpoint: process.env.NEXT_PUBLIC_ONCHAINDB_ENDPOINT || 'http://localhost:9092',
    apiKey: process.env.NEXT_PUBLIC_ONCHAINDB_API_KEY || '',
    appId: process.env.NEXT_PUBLIC_APP_ID || 'app_ac04adaaa50348a4'
};

console.log('CONFIG', CONFIG);

if (!process.env.NEXT_PUBLIC_ONCHAINDB_API_KEY) {
    throw new Error('NEXT_PUBLIC_ONCHAINDB_API_KEY');
}

// Complete index definitions organized by collection
const INDEXES = {
    // =====================================
    // TWEETS COLLECTION
    // =====================================
    tweets: [
        {
            name: 'tweets_id_unique',
            field_name: 'id',
            index_type: 'Hash',      // Changed to Hash for faster exact lookups
            store_values: true,
            unique_constraint: true,
            sort_enabled: false,
            description: 'Primary key - fast O(1) tweet lookup by ID'
        },
        {
            name: 'tweets_author_join',
            field_name: 'author',
            index_type: 'Hash',      // For JOIN to users.address
            store_values: true,
            unique_constraint: false,
            sort_enabled: false,
            description: 'JOIN field: tweets.author -> users.address (get author info)'
        },
        {
            name: 'tweets_reply_to_join',
            field_name: 'reply_to_id',
            index_type: 'Hash',      // For finding replies AND JOIN to parent tweet
            store_values: true,
            unique_constraint: false,
            sort_enabled: false,
            description: 'JOIN field: tweets.reply_to_id -> tweets.id (get parent tweet + find all replies)'
        },
        {
            name: 'tweets_quote_tweet_join',
            field_name: 'quote_tweet_id',
            index_type: 'Hash',      // For JOIN to quoted tweet
            store_values: true,
            unique_constraint: false,
            sort_enabled: false,
            description: 'JOIN field: tweets.quote_tweet_id -> tweets.id (get quoted tweet info)'
        },
        {
            name: 'tweets_created_at_sort',
            field_name: 'created_at',
            index_type: 'Hash',     // For sorting timeline by date
            store_values: true,
            unique_constraint: false,
            sort_enabled: true,
            description: 'Sort tweets by creation date (timeline ordering)'
        },
        {
            name: 'tweets_hashtags_search',
            field_name: 'hashtags',
            index_type: 'Hash',     // For searching by hashtag
            store_values: true,
            unique_constraint: false,
            sort_enabled: false,
            description: 'Search tweets by hashtags (e.g., #crypto)'
        },
        {
            name: 'tweets_visibility_filter',
            field_name: 'visibility',
            index_type: 'Hash',
            store_values: true,
            unique_constraint: false,
            sort_enabled: false,
            description: 'Filter tweets by visibility (public/private/followers)'
        },
        {
            name: 'tweets_is_deleted_filter',
            field_name: 'is_deleted',
            index_type: 'Hash',
            store_values: true,
            unique_constraint: false,
            sort_enabled: false,
            description: 'Filter out deleted tweets'
        },
        {
            name: 'tweets_engagement_score',
            field_name: 'engagement_score',
            index_type: 'Hash',
            store_values: true,
            unique_constraint: false,
            sort_enabled: true,
            description: 'Sort tweets by engagement (trending/popular)'
        },
        {
            name: 'tweets_like_count',
            field_name: 'like_count',
            index_type: 'Hash',
            store_values: true,
            unique_constraint: false,
            sort_enabled: true,
            description: 'Sort tweets by like count'
        }
    ],

    // =====================================
    // USERS COLLECTION
    // =====================================
    users: [
        {
            name: 'users_address_unique',
            field_name: 'address',
            index_type: 'Hash',
            store_values: true,
            unique_constraint: true,
            sort_enabled: false,
            description: 'Primary key - fast O(1) user lookup by wallet address'
        },
        {
            name: 'users_display_name_search',
            field_name: 'display_name',
            index_type: 'FullText',  // For searching users by name
            store_values: true,
            unique_constraint: false,
            sort_enabled: false,
            description: 'Full-text search on user display names'
        },
        {
            name: 'users_verified_filter',
            field_name: 'verified',
            index_type: 'Hash',
            store_values: true,
            unique_constraint: false,
            sort_enabled: false,
            description: 'Filter verified users (checkmark badge)'
        },
        {
            name: 'users_follower_count',
            field_name: 'follower_count',
            index_type: 'Hash',
            store_values: true,
            unique_constraint: false,
            sort_enabled: true,
            description: 'Sort users by follower count (find influencers)'
        },
        {
            name: 'users_status_filter',
            field_name: 'status',
            index_type: 'Hash',
            store_values: true,
            unique_constraint: false,
            sort_enabled: false,
            description: 'Filter users by status (active/suspended/deleted)'
        },
        {
            name: 'users_created_at',
            field_name: 'created_at',
            index_type: 'Hash',
            store_values: true,
            unique_constraint: false,
            sort_enabled: true,
            description: 'Sort users by join date'
        }
    ],

    // =====================================
    // LIKES COLLECTION
    // =====================================
    likes: [
        {
            name: 'likes_id_unique',
            field_name: 'id',
            index_type: 'Hash',
            store_values: true,
            unique_constraint: true,
            sort_enabled: false,
            description: 'Primary key for like records'
        },
        {
            name: 'likes_user_join',
            field_name: 'user',
            index_type: 'Hash',      // For JOIN to users.address
            store_values: true,
            unique_constraint: false,
            sort_enabled: false,
            description: 'JOIN field: likes.user -> users.address (get user who liked)'
        },
        {
            name: 'likes_tweet_id_join',
            field_name: 'tweet_id',
            index_type: 'Hash',      // For JOIN to tweets.id
            store_values: true,
            unique_constraint: false,
            sort_enabled: false,
            description: 'JOIN field: likes.tweet_id -> tweets.id (get liked tweet + count likes)'
        },
        {
            name: 'likes_user_tweet_composite',
            field_name: 'user',      // Composite index (user + tweet_id)
            index_type: 'Hash',
            store_values: true,
            unique_constraint: false,
            sort_enabled: false,
            description: 'Check if user already liked a tweet (prevents duplicates)'
        },
        {
            name: 'likes_created_at',
            field_name: 'created_at',
            index_type: 'Hash',
            store_values: true,
            unique_constraint: false,
            sort_enabled: true,
            description: 'Sort likes by date (activity timeline)'
        }
    ],

    // =====================================
    // RETWEETS COLLECTION
    // =====================================
    retweets: [
        {
            name: 'retweets_id_unique',
            field_name: 'id',
            index_type: 'Hash',
            store_values: true,
            unique_constraint: true,
            sort_enabled: false,
            description: 'Primary key for retweet records'
        },
        {
            name: 'retweets_user_join',
            field_name: 'user',
            index_type: 'Hash',      // For JOIN to users.address
            store_values: true,
            unique_constraint: false,
            sort_enabled: false,
            description: 'JOIN field: retweets.user -> users.address (get user who retweeted)'
        },
        {
            name: 'retweets_tweet_id_join',
            field_name: 'tweet_id',
            index_type: 'Hash',      // For JOIN to tweets.id
            store_values: true,
            unique_constraint: false,
            sort_enabled: false,
            description: 'JOIN field: retweets.tweet_id -> tweets.id (get retweeted tweet + count retweets)'
        },
        {
            name: 'retweets_user_tweet_composite',
            field_name: 'user',      // Composite index (user + tweet_id)
            index_type: 'Hash',
            store_values: true,
            unique_constraint: false,
            sort_enabled: false,
            description: 'Check if user already retweeted a tweet (prevents duplicates)'
        },
        {
            name: 'retweets_created_at',
            field_name: 'created_at',
            index_type: 'Hash',
            store_values: true,
            unique_constraint: false,
            sort_enabled: true,
            description: 'Sort retweets by date (activity timeline)'
        }
    ],

    // =====================================
    // FOLLOWS COLLECTION (with versioning)
    // =====================================
    follows: [
        {
            name: 'follows_id_unique',
            field_name: 'id',
            index_type: 'Hash',
            store_values: true,
            unique_constraint: true,   // Same ID for all versions of a relationship
            sort_enabled: false,
            description: 'Primary key - same ID across versions (follow/unfollow)'
        },
        {
            name: 'follows_follower_join',
            field_name: 'follower',
            index_type: 'Hash',      // For JOIN to users.address
            store_values: true,
            unique_constraint: false,
            sort_enabled: false,
            description: 'JOIN field: follows.follower -> users.address (get follower info)'
        },
        {
            name: 'follows_following_join',
            field_name: 'following',
            index_type: 'Hash',      // For JOIN to users.address
            store_values: true,
            unique_constraint: false,
            sort_enabled: false,
            description: 'JOIN field: follows.following -> users.address (get followed user info)'
        },
        {
            name: 'follows_status_version',
            field_name: 'status',
            index_type: 'Hash',      // For filtering active vs inactive follows
            store_values: true,
            unique_constraint: false,
            sort_enabled: false,
            description: 'Filter by status (active/inactive) for versioning'
        },
        {
            name: 'follows_updated_at',
            field_name: 'updated_at',
            index_type: 'Hash',
            store_values: true,
            unique_constraint: false,
            sort_enabled: true,
            description: 'Get latest version of follow relationship (versioning)'
        },
        {
            name: 'follows_created_at',
            field_name: 'created_at',
            index_type: 'Hash',
            store_values: true,
            unique_constraint: false,
            sort_enabled: true,
            description: 'Sort followers by when they followed'
        }
    ]
};

async function createIndexes() {
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║   OnChainDB Twitter Clone - Complete Index Setup    ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');
    console.log(`📡 Endpoint: ${CONFIG.endpoint}`);
    console.log(`🆔 App ID: ${CONFIG.appId}\n`);

    try {
        const client = createClient({
            endpoint: CONFIG.endpoint,
            apiKey: CONFIG.apiKey,
            appId: CONFIG.appId
        });

        console.log('✅ SDK client initialized\n');

        let totalCreated = 0;
        let totalSkipped = 0;
        let totalFailed = 0;
        let totalIndexes = 0;

        // Process each collection
        for (const [collection, indexes] of Object.entries(INDEXES)) {
            console.log(`\n${'═'.repeat(60)}`);
            console.log(`📦 COLLECTION: ${collection.toUpperCase()}`);
            console.log(`   Creating ${indexes.length} indexes...\n`);

            for (const indexDef of indexes) {
                totalIndexes++;
                console.log(`⏳ ${indexDef.name}`);
                console.log(`   Field: ${indexDef.field_name}`);
                console.log(`   Type: ${indexDef.index_type}`);
                console.log(`   Description: ${indexDef.description}`);

                try {
                    await client.createIndex({
                        name: indexDef.field_name,
                        collection: collection,
                        field_name: indexDef.field_name,
                        index_type: indexDef.index_type,
                        store_values: indexDef.store_values,
                        unique_constraint: indexDef.unique_constraint,
                        sort_enabled: indexDef.sort_enabled
                    });

                    totalCreated++;
                    console.log(`   ✅ Created successfully`);

                    if (indexDef.unique_constraint) {
                        console.log(`   🔑 Unique constraint enabled`);
                    }
                } catch (error) {
                    console.log(error);
                    if (error.message && error.message.includes('already exists')) {
                        totalSkipped++;
                        console.log(`   ⏭️  Already exists (skipped)`);
                    } else {
                        totalFailed++;
                        console.log(`   ❌ Failed: ${error.message}`);
                    }
                }

                console.log('');
                // Small delay to avoid overwhelming the server
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }

        // Summary
        console.log('\n' + '═'.repeat(60));
        console.log('📊 INDEX CREATION SUMMARY');
        console.log('═'.repeat(60));
        console.log(`✅ Successfully created: ${totalCreated}`);
        console.log(`⏭️  Already existed (skipped): ${totalSkipped}`);
        console.log(`❌ Failed: ${totalFailed}`);
        console.log(`📈 Total indexes processed: ${totalIndexes}`);
        console.log(`🎯 Success rate: ${(((totalCreated + totalSkipped) / totalIndexes) * 100).toFixed(1)}%\n`);

        if (totalFailed === 0) {
            console.log('🎉 All indexes are ready! Your app is fully optimized!\n');
            return true;
        } else {
            console.log('⚠️  Some indexes failed. Check errors above.\n');
            return false;
        }

    } catch (error) {
        console.error('\n❌ Fatal error:', error.message);
        console.error(error.stack);
        return false;
    }
}

// Run the script
if (require.main === module) {
    createIndexes().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = {createIndexes, INDEXES};
