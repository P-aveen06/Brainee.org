FROM python:3.12-slim AS dependencies
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*
# Install CPU PyTorch first so GLiNER does not pull GPU runtimes into the image.
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu 'torch>=2.6,<3'
COPY services/graphrag/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY services/graphrag/delivery ./delivery
COPY services/graphrag/tests ./tests
RUN python -m unittest discover -s tests -p 'test_*.py'
RUN useradd --create-home retrieval
USER retrieval
EXPOSE 3200
CMD ["python", "-m", "delivery.server"]
