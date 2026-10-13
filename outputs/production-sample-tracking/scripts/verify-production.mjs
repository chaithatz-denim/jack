const baseUrls = (process.env.PRODUCTION_URLS || "https://www.jackrussel-sample.com,https://jackrussel-sample.com")
  .split(",")
  .map((value) => value.trim().replace(/\/$/, ""))
  .filter(Boolean);

const results = [];

for (const baseUrl of baseUrls) {
  for (const path of ["/", "/login", "/samples", "/api/health"]) {
    const startedAt = Date.now();
    const response = await fetch(`${baseUrl}${path}`, {
      redirect: "manual",
      headers: { "user-agent": "jack-russel-release-verifier/1.0" },
    });
    const location = response.headers.get("location");
    let health = null;
    if (path === "/api/health") {
      health = await response.json().catch(() => null);
    }
    const ok = path === "/api/health"
      ? response.ok && health?.status === "ok"
      : response.ok || [301, 302, 303, 307, 308].includes(response.status);
    results.push({
      url: `${baseUrl}${path}`,
      ok,
      status: response.status,
      location,
      durationMs: Date.now() - startedAt,
      healthStatus: health?.status ?? null,
    });
  }
}

const failed = results.filter((result) => !result.ok);
console.log(JSON.stringify({ ok: failed.length === 0, checkedAt: new Date().toISOString(), results, failed }, null, 2));
if (failed.length) process.exitCode = 1;
