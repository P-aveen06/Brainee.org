"""Pinned CPU sentence encoder. No source text is sent to a remote service."""
import asyncio
import os
from functools import lru_cache
from pathlib import Path

MODEL = "sentence-transformers/all-MiniLM-L6-v2"
REVISION = "1110a243fdf4706b3f48f1d95db1a4f5529b4d41"
MODEL_ID = f"{MODEL}@{REVISION}"
DIMENSIONS = 384


class LocalEncoder:
    def __init__(self, path=None):
        import torch
        from transformers import AutoModel, AutoTokenizer
        torch.set_num_threads(2)
        path = path or os.environ.get("DELIVERY_ENCODER_PATH", "/opt/models/delivery-encoder")
        self.tokenizer = AutoTokenizer.from_pretrained(path, local_files_only=True)
        self.model = AutoModel.from_pretrained(path, local_files_only=True).eval()
        self.lock = asyncio.Lock()

    def _encode(self, texts):
        import torch
        import torch.nn.functional as functional
        inputs = self.tokenizer(texts, padding=True, truncation=True, max_length=256, return_tensors="pt")
        with torch.no_grad():
            tokens = self.model(**inputs)[0]
            mask = inputs["attention_mask"].unsqueeze(-1).expand(tokens.size()).float()
            vectors = (tokens * mask).sum(1) / mask.sum(1).clamp(min=1e-9)
            return functional.normalize(vectors, p=2, dim=1).tolist()

    @lru_cache(maxsize=256)
    def _query(self, text):
        return self._encode([text])[0]

    async def encode(self, texts):
        async with self.lock:
            return await asyncio.to_thread(self._encode, texts)

    async def query(self, text):
        async with self.lock:
            return await asyncio.to_thread(self._query, text)


def download_model(path):
    from transformers import AutoModel, AutoTokenizer
    Path(path).mkdir(parents=True, exist_ok=True)
    AutoTokenizer.from_pretrained(MODEL, revision=REVISION).save_pretrained(path)
    AutoModel.from_pretrained(MODEL, revision=REVISION, use_safetensors=True).save_pretrained(path)


if __name__ == "__main__":
    download_model("/opt/models/delivery-encoder")
