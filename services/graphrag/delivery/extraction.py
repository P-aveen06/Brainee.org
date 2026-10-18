"""Bounded local extraction with page, slide, sheet/cell and paragraph locations."""
import io
import re
import subprocess
import tempfile
import time
import zipfile
from contextlib import closing
from pathlib import Path
from xml.etree import ElementTree as ET

DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
TEXT_TYPES = {"text/plain", "text/markdown", "text/csv", "application/json"}
MAX_TEXT = 1_000_000


class TextBuilder:
    def __init__(self):
        self.parts, self.locations, self.length, self.truncated = [], [], 0, False

    def append(self, text, location):
        text = text.strip()
        if not text:
            return
        remaining = MAX_TEXT - self.length
        if len(text) + 1 > remaining:
            self.truncated = True
        value = (text + "\n")[:max(0, remaining)]
        if value:
            self.locations.append({"startChar": self.length, "endChar": self.length + len(value), **location})
            self.parts.append(value)
            self.length += len(value)

    def result(self):
        text = "".join(self.parts).rstrip()
        return text, "truncated" if self.truncated else "indexed" if text else "empty", self.locations


def xml(archive, path):
    info = archive.getinfo(path)
    if info.file_size > 10 * 1024 * 1024:
        raise ValueError("Document XML exceeds the extraction limit.")
    content = archive.read(info)
    if b"<!DOCTYPE" in content.upper() or b"<!ENTITY" in content.upper():
        raise ValueError("Document XML declarations are not supported.")
    return ET.fromstring(content)


def office(content, mime):
    out = TextBuilder()
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        if sum(info.file_size for info in archive.infolist()) > 50 * 1024 * 1024:
            raise ValueError("Expanded document exceeds the extraction limit.")
        if mime == DOCX:
            root = xml(archive, "word/document.xml")
            for index, paragraph in enumerate(root.findall(".//{*}p")):
                out.append("".join(node.text or "" for node in paragraph.findall(".//{*}t")),
                           {"paragraph": index + 1})
        elif mime == PPTX:
            names = sorted((name for name in archive.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", name)),
                           key=lambda name: int(re.search(r"slide(\d+)", name)[1]))
            for index, name in enumerate(names):
                root = xml(archive, name)
                out.append("\n".join("".join(node.text or "" for node in paragraph.findall(".//{*}t"))
                                     for paragraph in root.findall(".//{*}p")), {"slide": index + 1})
        else:
            strings = []
            if "xl/sharedStrings.xml" in archive.namelist():
                strings = ["".join(node.text or "" for node in item.findall(".//{*}t"))
                           for item in xml(archive, "xl/sharedStrings.xml").findall(".//{*}si")]
            relations = {node.attrib["Id"]: node.attrib["Target"] for node in
                         xml(archive, "xl/_rels/workbook.xml.rels")}
            for sheet in xml(archive, "xl/workbook.xml").findall(".//{*}sheet"):
                target = relations[sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]]
                name = target.lstrip("/") if target.startswith("/") else "xl/" + target
                for cell in xml(archive, name).findall(".//{*}c"):
                    value = cell.find("{*}v")
                    value = value.text if value is not None else "".join(node.text or "" for node in cell.findall(".//{*}t"))
                    if cell.attrib.get("t") == "s" and value:
                        value = strings[int(value)]
                    if value:
                        out.append(str(value), {"sheet": sheet.attrib["name"], "cell": cell.attrib.get("r", "")})
    return out.result()


def ocr(image, deadline):
    from PIL import Image
    if image.width * image.height > 20_000_000:
        raise ValueError("Image exceeds the OCR pixel limit.")
    with tempfile.TemporaryDirectory(prefix="delivery-ocr-") as folder:
        path = Path(folder) / "source.png"
        image.convert("RGB").save(path)
        result = subprocess.run(["tesseract", str(path), "stdout", "--psm", "6"],
            capture_output=True, timeout=max(0.1, min(5, deadline - time.monotonic())), check=True)
        return result.stdout.decode("utf-8")


def extract_document(content, mime):
    if mime in TEXT_TYPES:
        text = content.decode("utf-8-sig")
        return text[:MAX_TEXT], "truncated" if len(text) > MAX_TEXT else "indexed" if text.strip() else "empty", []
    if mime in (DOCX, XLSX, PPTX):
        return office(content, mime)
    out, deadline = TextBuilder(), time.monotonic() + 18
    if mime == "application/pdf":
        import pypdfium2 as pdfium
        with closing(pdfium.PdfDocument(content)) as document:
            for index in range(min(len(document), 60)):
                if time.monotonic() >= deadline:
                    out.truncated = True
                    break
                with closing(document[index]) as page:
                    with closing(page.get_textpage()) as textpage:
                        text = textpage.get_text_range()
                    if not text.strip():
                        width, height = page.get_size()
                        if width * height * 2.25 > 20_000_000:
                            raise ValueError("PDF page exceeds the OCR pixel limit.")
                        with closing(page.render(scale=1.5)) as bitmap:
                            text = ocr(bitmap.to_pil(), deadline)
                    out.append(text, {"page": index + 1})
            out.truncated |= len(document) > 60
        return out.result()
    if mime in ("image/png", "image/jpeg", "image/webp", "image/tiff"):
        from PIL import Image
        Image.MAX_IMAGE_PIXELS = 20_000_000
        with Image.open(io.BytesIO(content)) as image:
            out.append(ocr(image, deadline), {"page": 1, "ocr": True})
            out.truncated |= getattr(image, "n_frames", 1) > 1
        return out.result()
    return "", "unsupported", []
