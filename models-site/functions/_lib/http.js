export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extraHeaders },
  });
}

export function htmlResponse(title, message, backPath, status = 200) {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow"><title>${title} | Photoczaro Models</title>
<style>body{background:#0a0a0a;color:#f5f0eb;font-family:sans-serif;min-height:100svh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 24px;}
p{max-width:480px;color:#8a8680;margin:16px 0 28px;}a{color:#0a0a0a;background:#c9a96e;padding:12px 24px;border-radius:999px;text-decoration:none;}</style>
</head><body><h1>${title}</h1><p>${message}</p><a href="/${backPath}">Back</a></body></html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=UTF-8" } });
}
