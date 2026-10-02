// Versão local corrigida do intermediário fornecido pelo usuário. Não publicada.
const DEFAULT_UPSTREAM = "https://script.google.com/macros/s/AKfycbyhnrNA_Ubtb33LM6qCi16HjVJewfOM3PWXAZI61aZVotm53MNMuX9DjD97cI53NtEEVg/exec";
const DEFAULT_ORIGINS = ["https://relatorio.consultaedu.com.br"];

export default {
  async fetch(request, env = {}, ctx) {
    const origin = request.headers.get("Origin");
    const allowed = (env.ALLOWED_ORIGINS || DEFAULT_ORIGINS.join(",")).split(",").map(x => x.trim());
    const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Vary": "Origin", "X-Content-Type-Options": "nosniff" };
    if (origin && allowed.includes(origin)) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers["Access-Control-Allow-Methods"] = "GET, OPTIONS";
      headers["Access-Control-Allow-Headers"] = "Content-Type";
      headers["Access-Control-Max-Age"] = "86400";
    }
    const error = (status, message) => new Response(JSON.stringify({ ok: false, erro: message }), { status, headers });
    if (origin && !allowed.includes(origin)) return error(403, "Origem não permitida.");
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "GET") return new Response(JSON.stringify({ ok: false, erro: "Método não permitido." }), { status: 405, headers: { ...headers, Allow: "GET, OPTIONS" } });

    const input = new URL(request.url);
    const healthCheck = input.searchParams.get("ping") === "1";
    if (!["/", "/api", "/api/"].includes(input.pathname)) return error(404, "Rota não encontrada.");
    let target;
    try { target = new URL(env.APPS_SCRIPT_URL || DEFAULT_UPSTREAM); }
    catch { return error(500, "Configuração da origem inválida."); }
    if (target.protocol !== "https:" || target.hostname !== "script.google.com") return error(500, "Configuração da origem inválida.");
    const refresh = input.searchParams.get("refresh") === "1" || input.searchParams.has("t");
    // Preserva nomes/valores dos filtros existentes; parâmetros de atualização são locais.
    // API recebida: semana, instituicao, conta, turma, disciplina, status e ping.
    const names = [...new Set(input.searchParams.keys())];
    if (names.length > 20 || input.search.length > 4096) return error(400, "Parâmetros excedem o limite.");
    for (const name of names) {
      if (name === "refresh" || name === "t") continue;
      const values = input.searchParams.getAll(name);
      if (values.length !== 1) return error(400, "Parâmetro repetido.");
      target.searchParams.set(name, values[0]);
    }
    target.searchParams.sort();
    const key = new Request(target, { method: "GET" });
    const cache = globalThis.caches?.default;
    let cached;
    // Nunca compartilhar respostas associadas a credenciais entre usuários.
    const cacheable = !request.headers.has("Authorization") && !request.headers.has("Cookie");
    if (!refresh && !healthCheck && cacheable && cache) {
      try { cached = await cache.match(key); } catch { /* cache indisponível: consulta a origem */ }
    }
    if (cached) return new Response(cached.body, { status: 200, headers: { ...headers, "X-Dashboard-Cache": "HIT" } });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Number(env.UPSTREAM_TIMEOUT_MS) || 20000);
    try {
      const upstream = await fetch(target, { method: "GET", redirect: "follow", signal: controller.signal, cache: "no-store" });
      if (!upstream.ok) return error(502, "A origem dos dados está indisponível.");
      const declared = Number(upstream.headers.get("Content-Length"));
      if (declared > 10 * 1024 * 1024) return error(502, "Resposta da origem excede o limite.");
      // Limita o corpo mesmo quando a origem não envia Content-Length.
      const reader = upstream.body?.getReader();
      if (!reader) return error(502, "Resposta vazia da origem.");
      const chunks = [];
      let bytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 10 * 1024 * 1024) { await reader.cancel(); return error(502, "Resposta da origem excede o limite."); }
        chunks.push(value);
      }
      const body = new Uint8Array(bytes);
      let offset = 0;
      for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
      let payload;
      try { payload = JSON.parse(new TextDecoder().decode(body)); } catch { return error(502, "A origem não retornou JSON válido."); }
      const validPayload = payload?.ok === true && (healthCheck
        ? payload.sistema === "Monitor Meet Dashboard" && payload.status === "online" && typeof payload.versao === "string" && typeof payload.agora === "string"
        : Array.isArray(payload.dados) && !payload.dados.some(row => !row || typeof row !== "object" || Array.isArray(row)));
      if (!validPayload) {
        return error(502, "A origem retornou dados inválidos.");
      }
      const response = new Response(JSON.stringify(payload), { headers: { ...headers, "X-Dashboard-Cache": refresh || healthCheck ? "BYPASS" : "MISS" } });
      if (!healthCheck && cacheable && cache && ctx?.waitUntil) {
        const cacheResponse = new Response(JSON.stringify(payload), { headers: { "Content-Type": headers["Content-Type"], "Cache-Control": "public, max-age=30" } });
        // Falha do cache nunca transforma dados válidos em falha da API.
        ctx.waitUntil(cache.put(key, cacheResponse).catch(() => {}));
      }
      return response;
    } catch (errorCaught) {
      return error(errorCaught.name === "AbortError" ? 504 : 502, errorCaught.name === "AbortError" ? "Tempo limite da origem excedido." : "Falha ao consultar a origem.");
    } finally { clearTimeout(timer); }
  }
};
