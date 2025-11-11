#!/bin/bash
# Script to build the image-processor-container using Podman

# Exit immediately if a command exits with a non-zero status
set -e

CONTAINER_IMAGE_NAME="image-to-dash"

echo "Starting build process for container image: ${CONTAINER_IMAGE_NAME}..."

# Build the container image. The '.' indicates that the Dockerfile is in the current directory.
podman build -t "${CONTAINER_IMAGE_NAME}" .

echo "---"
echo "✅ Build successful!"
echo "The image has been created and tagged as: ${CONTAINER_IMAGE_NAME}"
echo "You can view it with: podman images"