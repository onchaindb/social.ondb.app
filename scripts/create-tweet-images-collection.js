#!/usr/bin/env node

/**
 * Create Tweet Images Collection for Blob CDN
 *
 * This script creates the 'tweet_images' collection with blob-specific indexes:
 * - blob_id (Secondary) - unique identifier for the blob
 * - content_type (Secondary) - MIME type for filtering (image/jpeg, image/png, etc.)
 * - tweet_id (Secondary) - link to parent tweet
 * - user_address (Secondary) - link to user who uploaded
 * - size_bytes (Secondary) - file size for validation
 * - uploaded_at (Temporal) - timestamp for sorting
 *
 * Usage:
 *   node scripts/create-tweet-images-collection.js
 */

const dotenv = require('dotenv')

dotenv.config({path: '../.env'});

const CONFIG = {
    endpoint: process.env.NEXT_PUBLIC_ONCHAINDB_ENDPOINT || 'http://localhost:9092',
    apiKey: process.env.NEXT_PUBLIC_ONCHAINDB_API_KEY || '',
    appId: process.env.NEXT_PUBLIC_APP_ID || 'app_ac04adaaa50348a4'
};

const BACKEND_URL = CONFIG.endpoint
const APP_ID = CONFIG.appId
const API_KEY = CONFIG.apiKey

async function createIndex(indexName, collection, fieldName, indexType, unique = false, sparse = false, storeValues = true) {
    console.log(`Creating ${indexType} index '${indexName}' for field '${fieldName}' in collection '${collection}'...`);

    const response = await fetch(
        `${BACKEND_URL}/api/apps/${APP_ID}/indexes`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            },
            body: JSON.stringify({
                name: indexName,
                collection: collection,
                field_name: fieldName,
                index_type: indexType,
                unique: unique,
                sparse: sparse,
                store_values: storeValues
            })
        }
    );

    if (!response.ok) {
        const error = await response.text();
        if (error.includes('already exists')) {
            console.log(`⏭️  Index '${indexName}' already exists (skipped)`);
            return {status: 'already_exists'};
        }
        throw new Error(`Failed to create index ${indexName}: ${error}`);
    }

    const result = await response.json();
    console.log(`✅ Index '${indexName}' created successfully`);
    return result;
}

async function main() {
    console.log('🚀 Creating tweet_images collection with blob indexes...\n');
    console.log(`Backend: ${BACKEND_URL}`);
    console.log(`App ID: ${APP_ID}\n`);

    try {
        console.log('📦 Creating blob-specific indexes for tweet_images collection:\n');

        // blob_id - unique identifier (hash index for fast equality lookups)
        await createIndex('tweet_images_blob_id_unique', 'tweet_images', 'blob_id', 'hash', true, false, true);

        // content_type - MIME type (hash index for filtering by image type)
        await createIndex('tweet_images_content_type_filter', 'tweet_images', 'content_type', 'hash', false, false, true);

        // tweet_id - link to parent tweet (hash index for joining with tweets)
        await createIndex('tweet_images_tweet_id_join', 'tweet_images', 'tweet_id', 'hash', false, false, true);

        // user_address - link to user (hash index for user lookups)
        await createIndex('tweet_images_user_address_join', 'tweet_images', 'user_address', 'hash', false, false, true);

        // size_bytes - file size (btree index for range queries and validation)
        await createIndex('tweet_images_size_bytes_range', 'tweet_images', 'size_bytes', 'btree', false, false, true);

        // uploaded_at - timestamp (btree index for time-based sorting)
        await createIndex('tweet_images_uploaded_at_sort', 'tweet_images', 'uploaded_at', 'btree', false, false, true);

        console.log('\n✅ Tweet images collection setup complete!');
        console.log('\n📚 Collection Details:');
        console.log('  - Collection: tweet_images');
        console.log('  - Type: blob (binary data storage)');
        console.log('  - Indexes:');
        console.log('    • tweet_images_blob_id_unique (hash, unique)');
        console.log('    • tweet_images_content_type_filter (hash)');
        console.log('    • tweet_images_tweet_id_join (hash)');
        console.log('    • tweet_images_user_address_join (hash)');
        console.log('    • tweet_images_size_bytes_range (btree)');
        console.log('    • tweet_images_uploaded_at_sort (btree)');
        console.log('  - Use case: Tweet image attachments with blockchain permanence');
        console.log('  - Max size: 2MB per image');
        console.log('\n💡 Usage:');
        console.log('  1. Upload image when creating/replying to tweet');
        console.log('  2. Image is stored on Celestia blockchain');
        console.log('  3. Tweet stores blob_id in media_urls array');
        console.log('  4. Images displayed in tweet cards with CDN retrieval\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();
