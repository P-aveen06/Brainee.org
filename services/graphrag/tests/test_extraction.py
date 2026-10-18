import io
import unittest
import zipfile

from delivery.extraction import extract_document, DOCX, XLSX, PPTX


def package(files):
    target = io.BytesIO()
    with zipfile.ZipFile(target, "w") as archive:
        for path, content in files.items():
            archive.writestr(path, content)
    return target.getvalue()


class ExtractionTests(unittest.TestCase):
    def test_spreadsheet_shared_strings_and_cell_location(self):
        content = package({
            "xl/workbook.xml": '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Budget" r:id="r1"/></sheets></workbook>',
            "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>',
            "xl/sharedStrings.xml": '<sst><si><t>Checkout estimate</t></si></sst>',
            "xl/worksheets/sheet1.xml": '<worksheet><sheetData><row><c r="A1" t="s"><v>0</v></c><c r="B1"><v>8</v></c></row></sheetData></worksheet>',
        })
        text, status, locations = extract_document(content, XLSX)
        self.assertEqual(text, "Checkout estimate\n8")
        self.assertEqual(status, "indexed")
        self.assertEqual(locations[1]["cell"], "B1")
        self.assertEqual(locations[0]["sheet"], "Budget")

    def test_slide_location_and_xml_entity_rejection(self):
        content = package({"ppt/slides/slide1.xml": '<slide><p><t>Refunds require reconciliation</t></p></slide>'})
        text, status, locations = extract_document(content, PPTX)
        self.assertIn("reconciliation", text)
        self.assertEqual(locations[0]["slide"], 1)
        dangerous = package({"word/document.xml": '<!DOCTYPE x [<!ENTITY a "text">]><document/>'})
        with self.assertRaises(ValueError):
            extract_document(dangerous, DOCX)

    def test_local_image_and_scanned_pdf_ocr(self):
        from PIL import Image, ImageDraw, ImageFont
        image = Image.new("RGB", (1000, 180), "white")
        ImageDraw.Draw(image).text((20, 40), "PAYMENT APPROVED", font=ImageFont.load_default(size=48), fill="black")
        for format, mime in (("PNG", "image/png"), ("PDF", "application/pdf")):
            blob = io.BytesIO()
            image.save(blob, format=format)
            text, status, locations = extract_document(blob.getvalue(), mime)
            self.assertIn("PAYMENT", text.upper())
            self.assertEqual(status, "indexed")
            self.assertEqual(locations[0]["page"], 1)


if __name__ == "__main__":
    unittest.main()
