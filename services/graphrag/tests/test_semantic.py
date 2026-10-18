import unittest
from pathlib import Path

from delivery.encoder import LocalEncoder
from delivery.semantic import chunks, fingerprint
from delivery.vocabulary import expand_vocabulary


class SemanticTests(unittest.IsolatedAsyncioTestCase):
    def test_vocabulary_without_assistant_synonyms(self):
        self.assertIn("checkout", expand_vocabulary(["payments"]))
        self.assertNotIn("checkout", expand_vocabulary(["project paymentsonly"]))

    def test_chunks_and_source_fingerprints(self):
        body = "x" * 2000
        self.assertEqual(chunks(body)[1][0], 750)
        self.assertNotEqual(fingerprint(body), fingerprint(body + "changed"))

    @unittest.skipUnless(Path("/opt/models/delivery-encoder").exists(), "Build local encoder image first")
    async def test_real_local_paraphrase_without_shared_words(self):
        encoder = LocalEncoder()
        vectors = await encoder.encode(["Collect money from a customer's credit card",
                                        "Implement Stripe checkout and capture a payment",
                                        "Publish holiday attendance reporting"])
        positive = sum(a*b for a, b in zip(vectors[0], vectors[1]))
        negative = sum(a*b for a, b in zip(vectors[0], vectors[2]))
        self.assertGreater(positive, 0.28)
        self.assertGreater(positive, negative + 0.15)


if __name__ == "__main__":
    unittest.main()
