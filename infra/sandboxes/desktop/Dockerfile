# Modified for marketbot on 2026-10-13; see MODIFICATIONS.md.
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash ca-certificates curl git python3 python3-pip xvfb x11vnc fluxbox procps \
    && rm -rf /var/lib/apt/lists/*
RUN useradd -m -s /bin/bash marketbot
WORKDIR /home/marketbot
USER marketbot
ENV DISPLAY=:1
CMD ["bash", "-lc", "Xvfb :1 -screen 0 1280x720x24 & sleep 0.5 && fluxbox & x11vnc -display :1 -forever -shared -nopw -listen 0.0.0.0 -rfbport 5900 & sleep infinity"]
