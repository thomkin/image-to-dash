#!/bin/bash
set -e

# --- 1. Define Variables ---
S3_DOWNLOAD_URI="$1"
S3_DESTINATION="$2"
AES_IV="$3"
AES_KEY="$4"
CLEAR_LEAD="$5"
BASE_NAME="$6"

# Remove Query Parameters from the URI
# This handles cases like s3://bucket/path/image.jpg?versionId=XYZ
CLEAN_URI="${S3_DOWNLOAD_URI%%\?*}"

# Extracts filename (e.g., 'photo.jpg') from the clean URI
FILENAME=$(basename "$CLEAN_URI")

# --- 2. Define Paths ---
INPUT_IMAGE_FILE="/tmp/$FILENAME"
OUTPUT_VIDEO_FILE="/tmp/${BASE_NAME}_temp.mp4"
MANIFEST_NAME="$BASE_NAME.mpd"
MASTER_PLAYLIST_NAME="$BASE_NAME.m3u8"
VIDEO_STREAM_NAME="video.mp4"
MASTER_PLAYLIST_VIDEO_NAME="video_master.m3u8"

# 3. Download the Image (using AWS CLI and IAM Role)
echo "Downloading $FILENAME from S3..."
# We use the original S3_DOWNLOAD_URI here for the 'aws s3 cp' command
# in case the query parameter (like a versionId) is actually necessary 
# for the CLI to uniquely identify the object.
aws s3 cp "$S3_DOWNLOAD_URI" "$INPUT_IMAGE_FILE"

# 4. Convert Image to Video (FFmpeg)
echo "Converting image to video..."
ffmpeg \
    -i "$INPUT_IMAGE_FILE" \
    -vframes 1 \
    -vf "scale=1280:720,format=yuv420p" \
    -t 1 \
    -r 1 \
    -c:v libx264 \
    "$OUTPUT_VIDEO_FILE"

# 5. Encrypt Video (Shaka Packager)
echo "Encrypting video with Shaka Packager... Clear Lead: $CLEAR_LEAD"
packager \
    in="$OUTPUT_VIDEO_FILE",stream=video,output="$VIDEO_STREAM_NAME",playlist_name="$MASTER_PLAYLIST_VIDEO_NAME",drm_label=VIDEO \
    --enable_raw_key_encryption \
    --enable_raw_key_decryption \
    --clear_lead="$CLEAR_LEAD" \
    --keys label=VIDEO:key_id="$AES_IV":key="$AES_KEY" \
    --mpd_output "$MANIFEST_NAME" \
    --hls_master_playlist_output "$MASTER_PLAYLIST_NAME"

# 6. Upload Results to S3
echo "Uploading results to S3: $S3_DESTINATION"
aws s3 cp "$MANIFEST_NAME" "$S3_DESTINATION$MANIFEST_NAME"
aws s3 cp "$MASTER_PLAYLIST_NAME" "$S3_DESTINATION$MASTER_PLAYLIST_NAME"
aws s3 cp "$VIDEO_STREAM_NAME" "$S3_DESTINATION$VIDEO_STREAM_NAME"
aws s3 cp "$MASTER_PLAYLIST_VIDEO_NAME" "$S3_DESTINATION$MASTER_PLAYLIST_VIDEO_NAME"

# 7. Clean up
rm -f "$INPUT_IMAGE_FILE" "$OUTPUT_VIDEO_FILE" "$MANIFEST_NAME" "$MASTER_PLAYLIST_NAME" "$VIDEO_STREAM_NAME" "$MASTER_PLAYLIST_VIDEO_NAME"

echo "Processing completed successfully."