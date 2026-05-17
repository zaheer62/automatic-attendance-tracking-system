# infra/kiosk/Dockerfile
# Edge-deployable kiosk container
# Build: docker build -t attendance-kiosk .
# Run:   docker run --device=/dev/video0 --env-file .env attendance-kiosk

FROM python:3.11-slim

# OpenCV needs these system libs
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6 \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy kiosk app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py sync.py ./

# Copy ML layer
COPY ../ml/recognize.py ./ml/recognize.py
COPY ../ml/models/ ./ml/models/

ENV PYTHONUNBUFFERED=1

CMD ["python", "main.py"]
