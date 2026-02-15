#!/bin/bash
# Remove problematic files from node_modules that cause build issues

# Find and remove test/bench/doc files from thread-stream packages
find node_modules -path "*/thread-stream/test" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -path "*/thread-stream/tests" -type d -exec rm -rf {} + 2>/dev/null || true  
find node_modules -path "*/thread-stream/bench.js" -type f -delete 2>/dev/null || true
find node_modules -path "*/thread-stream/README.md" -type f -delete 2>/dev/null || true
find node_modules -path "*/thread-stream/LICENSE" -type f -delete 2>/dev/null || true

# Remove test/bench files from pino packages
find node_modules -path "*/pino/test" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -path "*/pino/bench.js" -type f -delete 2>/dev/null || true
find node_modules -path "*/pino/benchmarks" -type d -exec rm -rf {} + 2>/dev/null || true

echo "Cleaned up problematic files from node_modules"
