import { randomUUID } from "crypto";
import path from "path";
import multer from "multer";

const UPLOADS_DIR = path.join(__dirname, "..", "..", "uploads", "logos");

const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const extension = ALLOWED_MIME_TYPES[file.mimetype] ?? "";
    cb(null, `${randomUUID()}${extension}`);
  },
});

/** Upload de logo : PNG/JPEG/WEBP uniquement (pas de SVG — risque XSS si servi sans précaution), 2 Mo max. */
export const logoUpload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES[file.mimetype]) {
      cb(new Error("UNSUPPORTED_FILE_TYPE"));
      return;
    }
    cb(null, true);
  },
});
