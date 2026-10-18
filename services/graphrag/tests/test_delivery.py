import io
import unittest
import zipfile

from delivery.documents import DOCX, document_passages, extract_text, index_document
from delivery.retrieval import DeliveryRetrieval, query_terms, search_delivery, source_for


class FakeGraph:
    async def coverage(self, actor):
        return {"currentDocuments": 1, "unindexedDocuments": 0}

    async def search_kind(self, actor, kind, terms, ceiling):
        if kind != 'task':
            return []
        return [{"item": {"id": "task", "type": "task", "projectId": "other",
                          "projectCode": "OLD", "taskNumber": 7, "status": "in_progress",
                          "title": "Single sign on", "estimateHours": 8},
                 "body": "Single sign on with SSO", "matched": ["sso"], "score": 1}]

    async def document(self, actor, document):
        return {"id": document, "type": "document", "projectId": "other", "projectCode": "OLD",
                "title": "SSO requirements", "version": 2, "checksum": "private-checksum",
                "mimeType": "text/plain", "text": "SSO login " * 900, "indexStatus": "indexed"}


class DeliveryTests(unittest.IsolatedAsyncioTestCase):
    def test_concepts_and_stop_words(self):
        self.assertEqual(query_terms('Have we built login before?', ['SSO', 'authentication'])[0:2],
                         ['sso', 'authentication'])
        self.assertEqual(query_terms('the project', []), [])

    async def test_real_sdk_strategy_contract(self):
        self.assertTrue(issubclass(DeliveryRetrieval, __import__('graphrag_sdk').RetrievalStrategy))
        result = await search_delivery(FakeGraph(), 'employee', {'query': 'login', 'concepts': ['sso'], 'limit': 1})
        self.assertEqual(result['scope'], 'company_delivery')
        self.assertEqual(result['matches'][0]['status'], 'in_progress')
        self.assertEqual(result['sources'][0]['label'], 'OLD #7')

    async def test_real_sdk_passage_offsets_and_pagination(self):
        result = await document_passages(FakeGraph(), 'employee', {'documentId': 'doc', 'query': 'login', 'limit': 1})
        self.assertTrue(result['hasMore'])
        self.assertEqual(result['nextOffset'], 1)
        self.assertEqual(result['passages'][0]['startChar'], 0)
        self.assertIn('v2 (doc) passage 1', result['sources'][0]['label'])
        self.assertNotIn('checksum', result['document'])
        self.assertNotIn('mimeType', result['document'])

    async def test_extract_plain_and_docx(self):
        self.assertEqual(await extract_text(b'\xef\xbb\xbfSSO', 'text/plain'), ('SSO', 'indexed'))
        blob = io.BytesIO()
        with zipfile.ZipFile(blob, 'w') as archive:
            archive.writestr('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>SSO</w:t></w:r></w:p></w:document>')
        self.assertEqual(await extract_text(blob.getvalue(), DOCX), ('SSO', 'indexed'))
        self.assertEqual(await extract_text(b'zip', 'application/zip'), ('', 'unsupported'))

    async def test_sdk_pdf_loader(self):
        from pypdf import PdfWriter
        from pypdf.generic import DictionaryObject, NameObject, DecodedStreamObject
        writer = PdfWriter()
        page = writer.add_blank_page(width=300, height=300)
        font = DictionaryObject({NameObject('/Type'): NameObject('/Font'),
            NameObject('/Subtype'): NameObject('/Type1'), NameObject('/BaseFont'): NameObject('/Helvetica')})
        page[NameObject('/Resources')] = DictionaryObject({NameObject('/Font'):
            DictionaryObject({NameObject('/F1'): writer._add_object(font)})})
        stream = DecodedStreamObject()
        stream.set_data(b'BT /F1 12 Tf 10 10 Td (Payment checkout) Tj ET')
        page[NameObject('/Contents')] = writer._add_object(stream)
        content = io.BytesIO()
        writer.write(content)
        text, status = await extract_text(content.getvalue(), 'application/pdf')
        self.assertEqual(status, 'indexed')
        self.assertIn('Payment checkout', text)

    async def test_checksum_rejects_mismatched_bytes(self):
        with self.assertRaises(ValueError):
            await index_document(FakeGraph(), 'employee', 'doc', b'mismatched')


if __name__ == '__main__':
    unittest.main()
