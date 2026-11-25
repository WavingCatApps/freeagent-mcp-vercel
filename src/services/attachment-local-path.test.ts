import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, mkdir, symlink, rm } from "node:fs/promises";
import { tmpdir, homedir } from "node:os";
import path from "node:path";
import { isInside, readLocalAttachment } from "./attachment-local-path.js";

describe("isInside", () => {
  it("accepts nested children", () => {
    expect(isInside("/vault/receipts", "/vault/receipts/a.pdf")).toBe(true);
  });

  it("rejects prefix lookalikes", () => {
    expect(isInside("/vault", "/vaultsecrets/x.pdf")).toBe(false);
  });

  it("rejects parent escapes", () => {
    expect(isInside("/vault/receipts", "/vault/other/a.pdf")).toBe(false);
  });
});

describe("readLocalAttachment", () => {
  const originalEnv = { ...process.env };
  let root: string;

  beforeEach(async () => {
    process.env = { ...originalEnv };
    root = await mkdtemp(path.join(tmpdir(), "fa-attach-"));
    process.env.FREEAGENT_ATTACHMENTS_DIR = root;
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    await rm(root, { recursive: true, force: true });
  });

  it("refuses when FREEAGENT_ATTACHMENTS_DIR is unset", async () => {
    delete process.env.FREEAGENT_ATTACHMENTS_DIR;
    await expect(readLocalAttachment("/tmp/x.pdf")).rejects.toThrow(/FREEAGENT_ATTACHMENTS_DIR/);
  });

  it("reads a PDF under the root", async () => {
    const file = path.join(root, "taxi.pdf");
    const bytes = Buffer.from("%PDF-1.4 hello");
    await writeFile(file, bytes);

    const result = await readLocalAttachment(file);
    expect(result.buffer.equals(bytes)).toBe(true);
    expect(result.file_name).toBe("taxi.pdf");
    expect(result.content_type).toBe("application/pdf");
  });

  it("rejects paths outside the root", async () => {
    const outside = path.join(tmpdir(), `outside-${Date.now()}.pdf`);
    await writeFile(outside, Buffer.from("%PDF-1.4 x"));
    try {
      await expect(readLocalAttachment(outside)).rejects.toThrow(/outside FREEAGENT_ATTACHMENTS_DIR/);
    } finally {
      await rm(outside, { force: true });
    }
  });

  it("rejects symlink escapes", async () => {
    const outside = path.join(tmpdir(), `secret-${Date.now()}.pdf`);
    await writeFile(outside, Buffer.from("%PDF-1.4 secret"));
    const link = path.join(root, "link.pdf");
    try {
      await symlink(outside, link);
      await expect(readLocalAttachment(link)).rejects.toThrow(/outside FREEAGENT_ATTACHMENTS_DIR/);
    } finally {
      await rm(outside, { force: true });
    }
  });

  it("rejects unsupported extensions", async () => {
    const file = path.join(root, "notes.txt");
    await writeFile(file, "hello");
    await expect(readLocalAttachment(file)).rejects.toThrow(/Unsupported attachment type/);
  });

  it("rejects home directory as the attachments root", async () => {
    process.env.FREEAGENT_ATTACHMENTS_DIR = homedir();
    await expect(readLocalAttachment(path.join(homedir(), "x.pdf"))).rejects.toThrow(
      /dedicated receipts directory/
    );
  });

  it("rejects oversized files", async () => {
    const file = path.join(root, "big.pdf");
    // Don't allocate 5MB+ in CI if avoidable — write a small file then mock? 
    // Write just over limit is heavy; instead nest and use a stub by writing max+1 via sparse? 
    // Simple: write 100 bytes and temporarily lower by testing the message path with a real oversize only if fast.
    // Use a nested dir + generate 5MB+1 — 5MB is acceptable for a unit test once.
    const over = Buffer.alloc(5 * 1024 * 1024 + 1, 1);
    await writeFile(file, over);
    await expect(readLocalAttachment(file)).rejects.toThrow(/5MB/);
  });

  it("accepts relative names resolved under the root via absolute path only", async () => {
    await mkdir(path.join(root, "inbox"), { recursive: true });
    const file = path.join(root, "inbox", "coffee.png");
    await writeFile(file, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const result = await readLocalAttachment(file);
    expect(result.content_type).toBe("image/png");
    expect(result.file_name).toBe("coffee.png");
  });
});
