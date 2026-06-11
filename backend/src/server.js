const http = require('http');
const crypto = require('crypto');
const path = require('path');
const { FileAuditStore } = require('./audit-store');
const { AuthService } = require('./auth-service');
const { FileCatalogStore } = require('./catalog-store');
const { ControlPlane } = require('./control-plane');
const { DashboardService } = require('./dashboard-service');

const PRODUCTION_ENVS = new Set(['production', 'preview', 'staging']);
const DEFAULT_PORT = Number(process.env.PORT || 8791);
const DEFAULT_HOST = process.env.AIDLYST_BIND_HOST || (isProductionLike() ? '0.0.0.0' : '127.0.0.1');
const DEFAULT_AUDIT_DIR = process.env.AIDLYST_AUDIT_DIR || path.join(__dirname, '..', 'data', 'audits');
const DEFAULT_CONTROL_DIR = process.env.AIDLYST_CONTROL_DIR || path.join(__dirname, '..', 'data', 'control-plane');
const MAX_BODY_BYTES = 1024 * 1024;

function envFlag(name) {
  return /^(1|true|yes|on)$/i.test(String(process.env[name] || '').trim());
}

function isProductionLike() {
  return PRODUCTION_ENVS.has(String(process.env.NODE_ENV || '').trim().toLowerCase());
}

function constantTimeEquals(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function resolveRuntimeOptions(options = {}) {
  const productionLike = options.productionLike ?? isProductionLike();
  const apiKey = options.apiKey !== undefined
    ? String(options.apiKey || '')
    : String(process.env.AIDLYST_BACKEND_API_KEY || '');
  const requireApiKey = options.requireApiKey ?? productionLike;
  const enableDevAuth = options.enableDevAuth ?? (!productionLike && !envFlag('AIDLYST_DISABLE_DEV_AUTH'));

  return {
    apiKey,
    enableDevAuth,
    productionLike,
    requireApiKey
  };
}

function assertRuntimeConfig(runtime) {
  if (runtime.requireApiKey && runtime.apiKey.length < 24) {
    throw new Error('AIDLYST_BACKEND_API_KEY must be set to a 24+ character server-only value before this backend is exposed.');
  }

  if (runtime.productionLike && runtime.enableDevAuth) {
    throw new Error('Development auth routes cannot be enabled in production-like environments.');
  }
}

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Cross-Origin-Resource-Policy': 'same-site',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(body);
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Request body too large.'), { statusCode: 413 }));
        request.destroy();
      }
    });
    request.on('end', () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(Object.assign(new Error('Request body must be valid JSON.'), { statusCode: 400 }));
      }
    });
    request.on('error', reject);
  });
}

function createRateLimiter({ limit = 120, windowMs = 60_000 } = {}) {
  const buckets = new Map();
  return function check(request) {
    const key = request.socket.remoteAddress || 'local';
    const now = Date.now();
    const bucket = buckets.get(key) || { count: 0, resetAt: now + windowMs };
    if (now > bucket.resetAt) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }
    bucket.count += 1;
    buckets.set(key, bucket);
    return bucket.count <= limit;
  };
}

function isAuthorized(request, runtime) {
  if (!runtime.requireApiKey && !runtime.apiKey) return true;

  const bearer = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const apiKey = request.headers['x-aidlyst-api-key'];
  return constantTimeEquals(bearer, runtime.apiKey) || constantTimeEquals(apiKey, runtime.apiKey);
}

function requestContext(request) {
  return {
    idempotencyKey: request.headers['idempotency-key'] || request.headers['x-idempotency-key'] || ''
  };
}

function toCollectionName(segment) {
  if (segment === 'products') return 'products';
  if (segment === 'suppliers') return 'suppliers';
  if (segment === 'offers') return 'offers';
  if (segment === 'push-queue' || segment === 'pushQueue') return 'pushQueue';
  return '';
}

function pickAuthorization(result, action, decision) {
  const authorization = result.authorization[action];
  return {
    sku: result.sku,
    policyVersion: result.policyVersion,
    evaluatedAt: result.evaluatedAt,
    authorization,
    route: result.route,
    classification: result.classification,
    auditId: result.audit.id,
    decisionId: decision?.id || result.audit.id
  };
}

function createServer(options = {}) {
  const runtime = resolveRuntimeOptions(options);
  assertRuntimeConfig(runtime);

  const auditStore = options.auditStore || new FileAuditStore(options.auditDir || DEFAULT_AUDIT_DIR);
  const catalogStore = options.catalogStore || new FileCatalogStore(options.controlDir || DEFAULT_CONTROL_DIR);
  const controlPlane = options.controlPlane || new ControlPlane({ auditStore, catalogStore, now: options.now });
  const authService = options.authService || new AuthService(options.auth);
  const dashboardService = options.dashboardService || new DashboardService({ controlPlane });
  const checkRateLimit = options.rateLimiter || createRateLimiter(options.rateLimit);

  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

      if (!checkRateLimit(request)) {
        sendJson(response, 429, { error: 'rate_limited' });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/health') {
        sendJson(response, 200, {
          ok: true,
          service: 'aidlyst-backend',
          protected: runtime.requireApiKey || Boolean(runtime.apiKey),
          devAuthEnabled: runtime.enableDevAuth
        });
        return;
      }

      if (!runtime.enableDevAuth && url.pathname.startsWith('/v1/auth/')) {
        sendJson(response, 404, { error: 'not_found' });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/v1/auth/login') {
        const payload = await readJson(request);
        const session = authService.login(payload);
        sendJson(response, 200, session);
        return;
      }

      if (request.method === 'POST' && url.pathname === '/v1/auth/logout') {
        const sessionId = authService.sessionIdFromRequest(request);
        authService.logout(sessionId);
        sendJson(response, 200, { ok: true });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/v1/auth/session') {
        const session = authService.requireSession(request);
        sendJson(response, 200, session);
        return;
      }

      if (!isAuthorized(request, runtime)) {
        sendJson(response, 401, { error: 'unauthorized' });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/v1/dashboard') {
        const session = authService.requireSession(request);
        sendJson(response, 200, dashboardService.metricsForRole(session.user.role));
        return;
      }

      if (request.method === 'POST' && url.pathname === '/v1/dashboard/actions') {
        authService.requireRole(request, ['ceo']);
        const payload = await readJson(request);
        sendJson(response, 200, dashboardService.executeAction(payload.actionId));
        return;
      }

      if (request.method === 'GET' && url.pathname === '/v1/control-plane/status') {
        sendJson(response, 200, controlPlane.status());
        return;
      }

      if (request.method === 'POST' && url.pathname === '/v1/control-plane/import-vault') {
        const payload = await readJson(request);
        const result = controlPlane.importVault({ vaultPath: payload.vaultPath || process.env.AIDLYST_VAULT_PATH });
        sendJson(response, 200, result);
        return;
      }

      if (request.method === 'GET' && url.pathname.startsWith('/v1/catalog/')) {
        const collection = toCollectionName(url.pathname.slice('/v1/catalog/'.length));
        if (!collection) {
          sendJson(response, 404, { error: 'catalog_collection_not_found' });
          return;
        }
        const limit = Number(url.searchParams.get('limit') || 100);
        const offset = Number(url.searchParams.get('offset') || 0);
        sendJson(response, 200, controlPlane.catalogStore.list(collection, { limit, offset }));
        return;
      }

      if (request.method === 'POST' && url.pathname.startsWith('/v1/catalog/')) {
        const collection = toCollectionName(url.pathname.slice('/v1/catalog/'.length));
        if (!collection) {
          sendJson(response, 404, { error: 'catalog_collection_not_found' });
          return;
        }
        const payload = await readJson(request);
        sendJson(response, 200, controlPlane.catalogStore.put(collection, payload));
        return;
      }

      if (request.method === 'GET' && url.pathname.startsWith('/v1/audits/')) {
        const auditId = decodeURIComponent(url.pathname.slice('/v1/audits/'.length));
        const record = auditStore.get(auditId);
        if (!record) {
          sendJson(response, 404, { error: 'audit_not_found' });
          return;
        }
        sendJson(response, 200, record);
        return;
      }

      if (request.method === 'GET' && url.pathname.startsWith('/v1/decisions/')) {
        const decisionId = decodeURIComponent(url.pathname.slice('/v1/decisions/'.length));
        const record = controlPlane.catalogStore.getDecision(decisionId);
        if (!record) {
          sendJson(response, 404, { error: 'decision_not_found' });
          return;
        }
        sendJson(response, 200, record);
        return;
      }

      if (request.method === 'POST' && url.pathname === '/v1/evaluate-sku') {
        const payload = await readJson(request);
        const evaluation = controlPlane.evaluatePayload(payload, {
          action: 'evaluate',
          ...requestContext(request)
        });
        sendJson(response, 200, {
          ...evaluation.result,
          decisionId: evaluation.decision.id,
          idempotent: evaluation.idempotent
        });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/v1/authorize-checkout') {
        const payload = await readJson(request);
        const evaluation = controlPlane.evaluatePayload(payload, {
          action: 'checkout',
          ...requestContext(request)
        });
        sendJson(response, evaluation.result.authorization.checkout.allowed ? 200 : 409, pickAuthorization(evaluation.result, 'checkout', evaluation.decision));
        return;
      }

      if (request.method === 'POST' && url.pathname === '/v1/authorize-publishing') {
        const payload = await readJson(request);
        const evaluation = controlPlane.evaluatePayload(payload, {
          action: 'publish',
          ...requestContext(request)
        });
        sendJson(response, evaluation.result.authorization.publish.allowed ? 200 : 409, pickAuthorization(evaluation.result, 'publish', evaluation.decision));
        return;
      }

      if (request.method === 'POST' && url.pathname === '/v1/evaluate-stored') {
        const payload = await readJson(request);
        const evaluation = controlPlane.evaluateStored(payload, {
          action: payload.action || 'evaluate',
          ...requestContext(request)
        });
        sendJson(response, 200, {
          decisionId: evaluation.decision.id,
          idempotent: evaluation.idempotent,
          payload: evaluation.payload,
          result: evaluation.result
        });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/v1/batch/evaluate-sku') {
        const payload = await readJson(request);
        const results = controlPlane.evaluateBatch(payload.items || [], {
          action: payload.action || 'evaluate',
          ...requestContext(request)
        });
        sendJson(response, 200, {
          count: results.length,
          results: results.map((evaluation) => ({
            decisionId: evaluation.decision.id,
            idempotent: evaluation.idempotent,
            result: evaluation.result
          }))
        });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/v1/shopify/draft-plan') {
        const payload = await readJson(request);
        const plan = payload.payload
          ? controlPlane.shopifyDraftPlan(payload.payload, requestContext(request))
          : controlPlane.shopifyDraftPlanForStored(payload, requestContext(request));
        sendJson(response, plan.plan.allowed ? 200 : 409, {
          decisionId: plan.decision.id,
          idempotent: plan.idempotent,
          plan: plan.plan,
          result: plan.result
        });
        return;
      }

      sendJson(response, 404, { error: 'not_found' });
    } catch (error) {
      const status = error.statusCode || (error instanceof TypeError ? 400 : 500);
      sendJson(response, status, {
        error: status >= 500 ? 'internal_error' : 'bad_request',
        message: status >= 500 ? 'The backend could not process the request safely.' : error.message
      });
    }
  });
}

if (require.main === module) {
  const server = createServer();
  server.listen(DEFAULT_PORT, DEFAULT_HOST, () => {
    console.log(`Aidlyst backend listening on http://${DEFAULT_HOST}:${DEFAULT_PORT}`);
  });
}

module.exports = {
  assertRuntimeConfig,
  createServer
};
