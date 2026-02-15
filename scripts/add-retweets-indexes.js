#!/usr/bin/env node

const dotenv = require('dotenv')


const {createClient} = require('@onchaindb/sdk');

dotenv.config({path: '../.env'});
const CONFIG = {
    endpoint: process.env.NEXT_PUBLIC_ONCHAINDB_ENDPOINT || 'http://localhost:9092',
    apiKey: process.env.NEXT_PUBLIC_ONCHAINDB_API_KEY || '',
    appId: process.env.NEXT_PUBLIC_APP_ID || 'app_ac04adaaa50348a4'
};
console.log(CONFIG)

if (!process.env.NEXT_PUBLIC_ONCHAINDB_API_KEY) {
    throw "No API key provided.";
}

// Retweets collection indexes
const RETWEETS_INDEXES = [
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
        index_type: 'Hash',
        store_values: true,
        unique_constraint: false,
        sort_enabled: false,
        description: 'JOIN field: retweets.user -> users.address (get user who retweeted)'
    },
    {
        name: 'retweets_tweet_id_join',
        field_name: 'tweet_id',
        index_type: 'Hash',
        store_values: true,
        unique_constraint: false,
        sort_enabled: false,
        description: 'JOIN field: retweets.tweet_id -> tweets.id (get retweeted tweet + count retweets)'
    },
    {
        name: 'retweets_user_tweet_composite',
        field_name: 'user',
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
];

async function addRetweetsIndexes() {
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║      Migration: Add Retweets Collection Indexes     ║');
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

        console.log('════════════════════════════════════════════════════════════');
        console.log('📦 COLLECTION: RETWEETS (NEW)');
        console.log(`   Creating ${RETWEETS_INDEXES.length} indexes...\n`);

        for (const indexDef of RETWEETS_INDEXES) {
            console.log(`⏳ ${indexDef.name}`);
            console.log(`   Field: ${indexDef.field_name}`);
            console.log(`   Type: ${indexDef.index_type}`);
            console.log(`   Description: ${indexDef.description}`);

            try {
                await client.createIndex({
                    name: indexDef.field_name,
                    collection: 'retweets',
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

        // Summary
        console.log('\n' + '═'.repeat(60));
        console.log('📊 MIGRATION SUMMARY');
        console.log('═'.repeat(60));
        console.log(`✅ Successfully created: ${totalCreated}`);
        console.log(`⏭️  Already existed (skipped): ${totalSkipped}`);
        console.log(`❌ Failed: ${totalFailed}`);
        console.log(`📈 Total indexes: ${RETWEETS_INDEXES.length}`);
        console.log(`🎯 Success rate: ${(((totalCreated + totalSkipped) / RETWEETS_INDEXES.length) * 100).toFixed(1)}%\n`);

        // What changed
        console.log('═'.repeat(60));
        console.log('🔄 WHAT CHANGED');
        console.log('═'.repeat(60));
        console.log('');
        console.log('BEFORE:');
        console.log('  ❌ Retweets stored in tweets collection with retweet_of_id');
        console.log('  ❌ Mixed with regular tweets, replies, and quotes');
        console.log('  ❌ Inconsistent with likes pattern');
        console.log('');
        console.log('AFTER:');
        console.log('  ✅ Retweets have dedicated "retweets" collection');
        console.log('  ✅ Clean data model: user + tweet_id + created_at');
        console.log('  ✅ Matches likes pattern exactly');
        console.log('  ✅ Proper indexes for fast lookups and JOINs');
        console.log('');

        // New capabilities
        console.log('═'.repeat(60));
        console.log('✨ NEW CAPABILITIES');
        console.log('═'.repeat(60));
        console.log('');
        console.log('1️⃣  Fast duplicate checking');
        console.log('    Query: retweets WHERE user=X AND tweet_id=Y');
        console.log('    Prevents users from retweeting the same tweet twice');
        console.log('');
        console.log('2️⃣  Efficient retweet counting');
        console.log('    Query: retweets WHERE tweet_id=Y GROUP BY tweet_id');
        console.log('    Get real-time retweet count for any tweet');
        console.log('');
        console.log('3️⃣  User retweet activity');
        console.log('    Query: retweets WHERE user=X ORDER BY created_at DESC');
        console.log('    Show all tweets a user has retweeted');
        console.log('');
        console.log('4️⃣  JOIN support');
        console.log('    retweets.user -> users.address (get retweeter info)');
        console.log('    retweets.tweet_id -> tweets.id (get retweeted tweet)');
        console.log('');

        // Migration notes
        console.log('═'.repeat(60));
        console.log('📝 MIGRATION NOTES');
        console.log('═'.repeat(60));
        console.log('');
        console.log('⚠️  Existing retweets in tweets collection are NOT migrated');
        console.log('   Old retweets (with retweet_of_id) will still work for reads');
        console.log('   New retweets will use the retweets collection');
        console.log('');
        console.log('💡 To migrate old data (optional):');
        console.log('   1. Query tweets WHERE retweet_of_id IS NOT NULL');
        console.log('   2. Transform to new format: {user, tweet_id, created_at}');
        console.log('   3. Store in retweets collection');
        console.log('   4. Update count aggregation to include both sources');
        console.log('');

        if (totalFailed === 0) {
            console.log('🎉 Migration completed successfully!\n');
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

// Run the migration
if (require.main === module) {
    addRetweetsIndexes().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = {addRetweetsIndexes, RETWEETS_INDEXES};
