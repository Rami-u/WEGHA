import tempfile
from pathlib import Path

from django.http import Http404
from django.test import RequestFactory, SimpleTestCase, override_settings

from config.spa import spa_view

IMMUTABLE = "public, max-age=31536000, immutable"


class SpaViewTests(SimpleTestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        (self.root / "assets").mkdir()
        (self.root / "images").mkdir()
        (self.root / "index.html").write_text("<html>index</html>")
        (self.root / "robots.txt").write_text("User-agent: *")
        (self.root / "images" / "hero.jpg").write_bytes(b"\xff\xd8\xff\xe0jpeg")
        (self.root / "assets" / "app-abc123.js").write_text("console.log(1)")

    def get(self, path):
        request = RequestFactory().get("/" + path)
        with override_settings(FRONTEND_DIST=self.root):
            response = spa_view(request, path=path)
        body = b"".join(response.streaming_content)
        return response, body

    def test_client_route_returns_index(self):
        response, body = self.get("teacher/courses")
        self.assertEqual(response["Content-Type"], "text/html")
        self.assertIn(b"index", body)
        self.assertEqual(response["Cache-Control"], "no-cache")

    def test_hashed_asset_is_served_and_cached_forever(self):
        response, body = self.get("assets/app-abc123.js")
        self.assertEqual(body, b"console.log(1)")
        self.assertEqual(response["Cache-Control"], IMMUTABLE)

    def test_public_image_is_served_not_index(self):
        response, body = self.get("images/hero.jpg")
        self.assertEqual(response["Content-Type"], "image/jpeg")
        self.assertTrue(body.startswith(b"\xff\xd8\xff"))
        self.assertEqual(response["Cache-Control"], "no-cache")

    def test_root_file_is_served_not_index(self):
        response, body = self.get("robots.txt")
        self.assertEqual(body, b"User-agent: *")
        self.assertTrue(response["Content-Type"].startswith("text/plain"))

    def test_missing_asset_is_404_not_index(self):
        with self.assertRaises(Http404):
            self.get("assets/old-hash.js")

    def test_path_traversal_falls_back_to_index(self):
        response, body = self.get("../../etc/passwd")
        self.assertIn(b"index", body)
