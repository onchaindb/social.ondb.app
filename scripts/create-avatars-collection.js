#!/usr/bin/env node

/**
 * Create Avatars Collection for Blob CDN Testing
 *
 * This script creates the 'avatars' collection with blob-specific indexes:
 * - blob_id (hash) - unique identifier for the blob
 * - content_type (Hash) - MIME type for filtering
 * - user_address (Hash) - link to user wallet
 *
 * Usage:
 *   node scripts/create-avatars-collection.js
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
    console.log('🚀 Creating avatars collection with blob indexes...\n');
    console.log(`Backend: ${BACKEND_URL}`);
    console.log(`App ID: ${APP_ID}\n`);

    try {
        // Create indexes for the avatars collection
        // These will be created on-demand when first write happens

        console.log('📦 Creating blob-specific indexes for avatars collection:\n');

        // blob_id - unique identifier (hash index for fast equality lookups)
        await createIndex('avatars_blob_id_unique', 'avatars', 'blob_id', 'hash', true, false, true);

        // content_type - MIME type (hash index for filtering)
        await createIndex('avatars_content_type_filter', 'avatars', 'content_type', 'hash', false, false, true);

        // user_address - link to user (hash index for user lookups, unique per user)
        await createIndex('avatars_user_address_unique', 'avatars', 'user_address', 'hash', true, false, true);

        // size_bytes - file size (btree index for range queries and validation)
        await createIndex('avatars_size_bytes_range', 'avatars', 'size_bytes', 'btree', false, false, true);

        // uploaded_at - timestamp (btree index for time-based sorting)
        await createIndex('avatars_uploaded_at_sort', 'avatars', 'uploaded_at', 'btree', false, false, true);

        // uploaded_by - uploaded by address (hash index for user lookups)
        await createIndex('avatars_uploaded_by_join', 'avatars', 'uploaded_by', 'hash', false, false, true);

        // is_primary - primary avatar flag (hash index for filtering)
        await createIndex('avatars_is_primary_filter', 'avatars', 'is_primary', 'hash', false, false, true);

        console.log('\n✅ Avatars collection setup complete!');
        console.log('\n📚 Collection Details:');
        console.log('  - Collection: avatars');
        console.log('  - Type: blob (binary data storage)');
        console.log('  - Indexes:');
        console.log('    • avatars_blob_id_unique (hash, unique)');
        console.log('    • avatars_content_type_filter (hash)');
        console.log('    • avatars_user_address_unique (hash, unique)');
        console.log('    • avatars_size_bytes_range (btree)');
        console.log('    • avatars_uploaded_at_sort (btree)');
        console.log('    • avatars_uploaded_by_join (hash)');
        console.log('    • avatars_is_primary_filter (hash)');
        console.log('  - Use case: Profile picture storage with blockchain permanence');
        console.log('\n💡 Test the collection:');
        console.log('  1. Navigate to user profile page');
        console.log('  2. Connect with Privy wallet');
        console.log('  3. Upload a profile picture');
        console.log('  4. Watch it get stored on Celestia blockchain!\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();
