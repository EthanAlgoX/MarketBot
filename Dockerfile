FROM python:3.12-slim-bookworm

# Install Node.js 20 for the WhatsApp bridge
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates gnupg git && \
    mkdir -p /etc/apt/keyrings && \
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" > /etc/apt/sources.list.d/nodesource.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends nodejs && \
    apt-get purge -y gnupg && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv

WORKDIR /app

# Install Python dependencies first (cached layer)
COPY pyproject.toml README.md LICENSE ./
RUN mkdir -p marketbot bridge && touch marketbot/__init__.py && \
    uv pip install --system --no-cache . && \
    rm -rf marketbot bridge

# Copy the full source and install
COPY marketbot/ marketbot/
COPY bridge/ bridge/
RUN uv pip install --system --no-cache .

# Build the WhatsApp bridge
WORKDIR /app/bridge
RUN npm install && npm run build
WORKDIR /app

# Create config directory
RUN mkdir -p /root/.marketbot

# Gateway default port
EXPOSE 18790

ENTRYPOINT ["marketbot"]
CMD ["status"]
