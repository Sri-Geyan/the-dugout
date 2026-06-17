FROM python:3.10-slim

WORKDIR /app

# Install system dependencies if required by any ML libraries (like g++, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage Docker cache
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Hugging Face Spaces use port 7860 by default
EXPOSE 7860

# Command to run the application
CMD ["uvicorn", "api.server:app", "--host", "0.0.0.0", "--port", "7860"]
