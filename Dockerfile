# Use a base Alpine Linux image
FROM alpine:3.18

# Install necessary tools
RUN apk add --no-cache \
    bash \
    curl \
    wget \
    python3 \
    py3-pip \
    ffmpeg \
    cpulimit \
    && pip3 install --no-cache-dir awscli

# Install Shaka Packager
ENV SHAKA_PACKAGER_VERSION v2.6.1
RUN wget -O /usr/local/bin/packager \
    https://github.com/shaka-project/shaka-packager/releases/download/${SHAKA_PACKAGER_VERSION}/packager-linux-x64 && \
    chmod +x /usr/local/bin/packager

# Set environment variable for Shaka Packager path
ENV SHAKA_PACKAGER_PATH="/usr/local/bin/packager"

# Set a working directory
WORKDIR /app
COPY podman_workflow.sh /tmp/workflow.sh

# Set a default command that will run if no command is provided
CMD ["sh"]