---
name: file-to-base64
description: Convert files (PDF, images) to Base64 for the FreeAgent MCP inline attachment.data fallback. Prefer attachment.path (local) or freeagent_prepare_attachment_upload + upload_id (remote) when available.
---

# File to Base64 Converter (inline fallback)

Use this skill only when you need **inline** `attachment.data` for FreeAgent MCP tools. Prefer these modes instead when they are available:

1. **Local / stdio** — set `FREEAGENT_ATTACHMENTS_DIR` and pass `attachment.path` (server reads the file; no base64 in the model).
2. **Remote MCP** — call `freeagent_prepare_attachment_upload`, PUT raw bytes to the returned URL, then pass `attachment.upload_id`.
3. **Inline base64** — this skill: `attachment.data` (+ optional gzip / `is_gzipped`).

Expenses and bank transaction explanations accept receipts. **Timeslips do not** accept attachments through this server.

## When to Use This Skill

- Staging / path modes are unavailable, and you must pass `attachment.data`
- Preparing a tiny PDF or image for FreeAgent create/update expense or explanation
- Detecting MIME types and validating size before encoding

## Supported File Formats (FreeAgent)

- PDF (`.pdf`) — `application/pdf`
- PNG (`.png`) — `image/png`
- JPEG (`.jpg`, `.jpeg`) — `image/jpeg`
- GIF (`.gif`) — `image/gif`

**Maximum file size:** 5MB (5 242 880 bytes) per attachment.

## How to Use

### 1. Prefer path or upload_id first

```bash
# Local: copy the receipt into FREEAGENT_ATTACHMENTS_DIR, then pass attachment.path
# Remote: freeagent_prepare_attachment_upload → PUT bytes → attachment.upload_id
```

### 2. Convert a Single File (fallback)

```bash
base64 /path/to/file.pdf          # macOS / Linux
base64 -w 0 /path/to/file.pdf     # Linux, no line wraps
```

MIME from extension: `.pdf` → `application/pdf`, `.png` → `image/png`, `.jpg`/`.jpeg` → `image/jpeg`, `.gif` → `image/gif`.

### 3. Check File Size

```bash
stat -f%z /path/to/file.pdf  # macOS
stat -c%s /path/to/file.pdf  # Linux
# Must be <= 5242880
```

## Example: Inline Attachment Payload

```json
{
  "attachment": {
    "data": "base64_encoded_string",
    "file_name": "receipt.pdf",
    "content_type": "application/pdf",
    "description": "Receipt for office supplies"
  }
}
```

With `path` or `upload_id`, omit `data`; `file_name` / `content_type` are optional (inferred). Provide exactly one of `path`, `upload_id`, or `data`.

## Tips

- Base64 increases size by ~33%; compress or resize images before encoding
- Optional: gzip the file, base64 the gzip bytes, set `is_gzipped: true` (inline `data` only)
- Always validate format and size before conversion
