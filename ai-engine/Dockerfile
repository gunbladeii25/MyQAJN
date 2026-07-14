FROM python:3.12-slim

# gcc needed for a couple of packages without prebuilt linux wheels
RUN apt-get update && apt-get install -y --no-install-recommends gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Training data is self-contained (no network/DB dependency) — bake the
# Agent A classifier model into the image so it's ready on first boot.
RUN python train_classifier.py

EXPOSE 8010
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8010"]
