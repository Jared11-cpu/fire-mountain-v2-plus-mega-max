const DEFAULT_ALLOWED_ORIGINS = [
  'https://jared11-cpu.github.io',
];

export function routeKey(request) {
  const url = new URL(request.url);
  return `${request.method.toUpperCase()} ${url.pathname}`;
}

export function corsHeaders(request, env = {}) {
  const origin = request.headers.get('Origin');
  const allowed = allowedOrigins(request, env);
  const reflectedOrigin = !origin || allowed.has(origin) || isLocalOrigin(origin) ? (origin || '*') : 'null';
  return {
    'Access-Control-Allow-Origin': reflectedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function isAllowedOrigin(request, env = {}) {
  const origin = request.headers.get('Origin');
  return !origin || corsHeaders(request, env)['Access-Control-Allow-Origin'] !== 'null';
}

export function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  });
}

export async function readJson(request, maxBytes = 64_000) {
  const declared = Number(request.headers.get('Content-Length') || 0);
  if (declared > maxBytes) throw httpError(413, '请求内容过大');
  let text;
  try { text = await request.text(); }
  catch { throw httpError(400, '无法读取请求内容'); }
  if (new TextEncoder().encode(text).length > maxBytes) throw httpError(413, '请求内容过大');
  try { return JSON.parse(text || '{}'); }
  catch { throw httpError(400, '请求内容不是有效 JSON'); }
}

export function assertText(value, name, { min = 1, max = 3000 } = {}) {
  const text = String(value ?? '').trim();
  if (text.length < min || text.length > max) throw httpError(400, `${name}长度必须在 ${min}-${max} 个字符之间`);
  return text;
}

export function httpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  error.expose = true;
  return error;
}

export function errorResponse(error, headers = {}) {
  const status = Number(error?.status) || 500;
  const safeMessage = error?.expose || status < 500 ? String(error?.message || '请求失败') : '服务暂时不可用，请稍后重试';
  return json({ error: safeMessage, ...(error?.details ? { details: error.details } : {}) }, status, headers);
}

export async function fetchJson(url, init = {}, { timeoutMs = 12_000, service = '上游服务' } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); }
    catch { throw httpError(502, `${service}返回了无法解析的数据`); }
    if (!response.ok) throw httpError(502, `${service}请求失败`, { upstreamStatus: response.status });
    return data;
  } catch (error) {
    if (error?.name === 'AbortError') throw httpError(504, `${service}响应超时`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function allowedOrigins(request, env) {
  const values = [new URL(request.url).origin, ...DEFAULT_ALLOWED_ORIGINS];
  if (env.ALLOWED_ORIGINS) values.push(...String(env.ALLOWED_ORIGINS).split(','));
  return new Set(values.map((value) => value.trim()).filter(Boolean));
}

function isLocalOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}
