#!/bin/bash
# Script to test the image-to-dash workflow using Podman

# Exit immediately if a command exits with a non-zero status
set -e

# --- Configuration ---
CONTAINER_IMAGE_NAME="localhost/image-to-dash"

# For local checks, use localhost
LOCAL_ENDPOINT="http://localhost:9000"
# For container access, use host.containers.internal
CONTAINER_ENDPOINT="http://host.containers.internal:9000"

# Use the local endpoint for the initial check
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin"

# Use AWS profile for local checks
export AWS_PROFILE=minio

echo "Using MinIO endpoint (local): $LOCAL_ENDPOINT"
echo "Using MinIO endpoint (container): $CONTAINER_ENDPOINT"

# Test file configuration
TEST_BUCKET="test-bucket"
TEST_IMAGE_PATH="test-images/sample-image.jpg"
TEST_OUTPUT_PATH="test-output/"

# Generate a unique name for this test run
TIMESTAMP=$(date +%s)
BASE_NAME="test-run-$TIMESTAMP"

# Encryption keys (for testing purposes, in a real scenario, use secure key management)
AES_IV="fedcba9876543210fedcba9876543210"
AES_KEY="0123456789abcdef0123456789abcdef"
CLEAR_LEAD="0"  # 1 second of unencrypted content at the beginning

# --- Prepare S3 URIs ---
S3_DOWNLOAD_URI="s3://${TEST_BUCKET}/${TEST_IMAGE_PATH}"
S3_DESTINATION="s3://${TEST_BUCKET}/${TEST_OUTPUT_PATH}"

# --- Create test directories in MinIO if they don't exist ---
# First, check if the test image exists
echo "Checking if test image exists in MinIO..."
if ! aws --endpoint-url "$LOCAL_ENDPOINT" s3 ls "s3://${TEST_BUCKET}/${TEST_IMAGE_PATH}" >/dev/null 2>&1; then
    echo "Test image not found in MinIO. Please upload an image to s3://${TEST_BUCKET}/${TEST_IMAGE_PATH}"
    echo "You can use this command to upload a test image:"
    echo "  aws --endpoint-url $LOCAL_ENDPOINT s3 cp /path/to/your/image.jpg s3://${TEST_BUCKET}/${TEST_IMAGE_PATH}"
    exit 1
fi

# Create output directory if it doesn't exist
aws --endpoint-url "$LOCAL_ENDPOINT" s3 mv "s3://${TEST_BUCKET}/${TEST_OUTPUT_PATH}" "s3://${TEST_BUCKET}/${TEST_OUTPUT_PATH}${TIMESTAMP}/" --recursive --quiet 2>/dev/null || true
aws --endpoint-url "$LOCAL_ENDPOINT" s3 rm "s3://${TEST_BUCKET}/${TEST_OUTPUT_PATH}" --recursive --quiet 2>/dev/null || true
aws --endpoint-url "$LOCAL_ENDPOINT" s3api put-object --bucket "$TEST_BUCKET" --key "$TEST_OUTPUT_PATH"

# --- Run the workflow in the container ---
echo "Starting image-to-dash workflow..."
# Make a temporary copy of the workflow script that's executable
cp podman_workflow.sh /tmp/workflow.sh
chmod +x /tmp/workflow.sh

# Run the container with memory limits
echo -e "\n--- Starting container with resource limits ---"
echo "Memory: 256MB"

START_TIME=$(date +%s.%N)
podman run --rm \
    --network=host \
    --memory="256m" \
    --memory-swap="256m" \
    -e AWS_ACCESS_KEY_ID="$MINIO_ACCESS_KEY" \
    -e AWS_SECRET_ACCESS_KEY="$MINIO_SECRET_KEY" \
    -e AWS_DEFAULT_REGION="us-east-1" \
    -e AWS_ENDPOINT_URL="http://localhost:9000" \
    -v "/tmp/workflow.sh:/app/workflow.sh:ro" \
    "$CONTAINER_IMAGE_NAME" \
    /app/workflow.sh "$S3_DOWNLOAD_URI" "$S3_DESTINATION" "$AES_IV" "$AES_KEY" "$CLEAR_LEAD" "$BASE_NAME"

# Calculate and display execution time
END_TIME=$(date +%s.%N)
ELAPSED=$(echo "$END_TIME - $START_TIME" | bc)
echo -e "\n--- Container Execution Time ---"
printf "Elapsed time: %.2f seconds\n" $ELAPSED

# --- Verify the output ---
echo -e "\n--- Verification ---"
if aws --endpoint-url "$LOCAL_ENDPOINT" s3 ls "s3://${TEST_BUCKET}/${TEST_OUTPUT_PATH}${BASE_NAME}.mpd" >/dev/null; then
    echo "✅ Success: MPD manifest created: s3://${TEST_BUCKET}/${TEST_OUTPUT_PATH}${BASE_NAME}.mpd"
else
    echo "❌ Error: MPD manifest not found in the output location"
    exit 1
fi

if aws --endpoint-url "$LOCAL_ENDPOINT" s3 ls "s3://${TEST_BUCKET}/${TEST_OUTPUT_PATH}video.mp4" >/dev/null; then
    echo "✅ Success: Encrypted video created: s3://${TEST_BUCKET}/${TEST_OUTPUT_PATH}video.mp4"
else
    echo "❌ Error: Encrypted video not found in the output location"
    exit 1
fi

echo -e "\n🎉 Workflow completed successfully!"
echo "Output files in MinIO (${LOCAL_ENDPOINT}):"
aws --endpoint-url "$LOCAL_ENDPOINT" s3 ls "s3://${TEST_BUCKET}/${TEST_OUTPUT_PATH}" --human-readable
