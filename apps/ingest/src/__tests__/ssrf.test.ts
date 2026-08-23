/**
 * SSRF guard tests.
 *
 * Verifies that assertSafeEgressUrl rejects every class of blocked address.
 */

import { describe, it, expect } from "vitest";
import { assertSafeEgressUrl, SsrfError } from "@submitpulse/security/ssrf";

async function expectSsrfRejection(url: string, reason?: string): Promise<void> {
  await expect(assertSafeEgressUrl(url)).rejects.toSatisfy(
    (err: unknown) => {
      if (!(err instanceof SsrfError)) return false;
      if (reason !== undefined) return err.reason === reason;
      return true;
    },
  );
}

describe("SSRF — scheme enforcement", () => {
  it("allows HTTPS", async () => {
    const safe = await assertSafeEgressUrl("https://example.com");
    expect(safe.href).toContain("example.com");
  });

  it("rejects HTTP", async () => {
    await expectSsrfRejection("http://example.com", "SCHEME_NOT_HTTPS");
  });

  it("rejects FTP", async () => {
    await expectSsrfRejection("ftp://example.com", "SCHEME_NOT_HTTPS");
  });

  it("rejects file://", async () => {
    await expectSsrfRejection("file:///etc/passwd", "SCHEME_NOT_HTTPS");
  });
});

describe("SSRF — loopback", () => {
  it("rejects localhost by name", async () => {
    await expectSsrfRejection("https://localhost/", "LOOPBACK");
  });

  it("rejects 127.0.0.1", async () => {
    await expectSsrfRejection("https://127.0.0.1/", "LOOPBACK");
  });

  it("rejects 127.0.0.2 (loopback range)", async () => {
    await expectSsrfRejection("https://127.0.0.2/", "LOOPBACK");
  });

  it("rejects ::1", async () => {
    await expectSsrfRejection("https://[::1]/", "LOOPBACK");
  });
});

describe("SSRF — private IPv4 ranges", () => {
  it("rejects 10.0.0.1 (10/8)", async () => {
    await expectSsrfRejection("https://10.0.0.1/", "PRIVATE_IP");
  });

  it("rejects 10.255.255.255", async () => {
    await expectSsrfRejection("https://10.255.255.255/", "PRIVATE_IP");
  });

  it("rejects 172.16.0.1 (172.16/12)", async () => {
    await expectSsrfRejection("https://172.16.0.1/", "PRIVATE_IP");
  });

  it("rejects 172.31.255.255", async () => {
    await expectSsrfRejection("https://172.31.255.255/", "PRIVATE_IP");
  });

  it("allows 172.32.0.1 (outside 172.16/12)", async () => {
    // 172.32.x.x is outside the private range — should be allowed.
    const safe = await assertSafeEgressUrl("https://172.32.0.1/");
    expect(safe.href).toBeTruthy();
  });

  it("rejects 192.168.1.1 (192.168/16)", async () => {
    await expectSsrfRejection("https://192.168.1.1/", "PRIVATE_IP");
  });
});

describe("SSRF — link-local", () => {
  it("rejects 169.254.0.1 (APIPA)", async () => {
    await expectSsrfRejection("https://169.254.0.1/", "LINK_LOCAL");
  });

  it("rejects 169.254.169.254 (AWS metadata)", async () => {
    await expectSsrfRejection("https://169.254.169.254/", "LINK_LOCAL");
  });

  it("rejects fe80:: (IPv6 link-local)", async () => {
    await expectSsrfRejection("https://[fe80::1]/", "LINK_LOCAL");
  });
});

describe("SSRF — cloud metadata endpoints", () => {
  it("rejects metadata.google.internal", async () => {
    await expectSsrfRejection("https://metadata.google.internal/", "CLOUD_METADATA");
  });

  it("rejects metadata.goog", async () => {
    await expectSsrfRejection("https://metadata.goog/", "CLOUD_METADATA");
  });
});

describe("SSRF — IPv6 private", () => {
  it("rejects fc00:: (ULA)", async () => {
    await expectSsrfRejection("https://[fc00::1]/", "PRIVATE_IP");
  });

  it("rejects fd00:: (ULA)", async () => {
    await expectSsrfRejection("https://[fd00::1]/", "PRIVATE_IP");
  });
});

describe("SSRF — blocked ports", () => {
  it("rejects port 8080", async () => {
    await expectSsrfRejection("https://example.com:8080/", "BLOCKED_PORT");
  });

  it("rejects port 6379 (Redis)", async () => {
    await expectSsrfRejection("https://example.com:6379/", "BLOCKED_PORT");
  });

  it("allows standard HTTPS port 443 (implicit)", async () => {
    const safe = await assertSafeEgressUrl("https://example.com/");
    expect(safe.href).toBeTruthy();
  });
});

describe("SSRF — invalid URLs", () => {
  it("rejects empty string", async () => {
    await expectSsrfRejection("", "INVALID_URL");
  });

  it("rejects non-URL", async () => {
    await expectSsrfRejection("not-a-url", "INVALID_URL");
  });
});
