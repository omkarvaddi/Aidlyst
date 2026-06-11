const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { FileAuditStore } = require('../src/audit-store');
const { FileCatalogStore } = require('../src/catalog-store');
const { createServer } = require('../src/server');

const TEST_PASSWORD = 'test-password-only';
const TEST_USERS = ['customer', 'employee', 'ceo'].map((role) => ({
  id: `usr_${role}_test`,
  role,
  name: `${role} test`,
  email: `${role}@aidlyst.local`,
  password: TEST_PASSWORD
}));

function request(baseUrl, pathname, options = {}) {
  return fetch(new URL(pathname, baseUrl), {
    method: options.method || 'GET',
    headers: {
      ...(options.sessionId ? { Authorization: `Bearer ${options.sessionId}` } : {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
}

async function login(baseUrl, role) {
  const response = await request(baseUrl, '/v1/auth/login', {
    method: 'POST',
    body: {
      email: `${role}@aidlyst.local`,
      password: TEST_PASSWORD,
      role
    }
  });
  assert.equal(response.status, 200);
  return response.json();
}

test('role dashboard exposes CEO actions and keeps employee metrics read-only', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aidlyst-auth-dashboard-'));
  const catalogStore = new FileCatalogStore(path.join(root, 'catalog'));
  catalogStore.put('products', {
    id: 'PSC-INTERNAL-001',
    name: 'Internal research candidate',
    category: 'First Aid',
    claim_risk: 'low',
    medical_advisor_status: 'approved',
    pharmacist_recommended_status: 'approved',
    rx_or_restricted_flag: 'no'
  });

  const server = createServer({
    auth: { users: TEST_USERS },
    auditStore: new FileAuditStore(path.join(root, 'audits')),
    catalogStore,
    now: new Date('2026-06-03T12:00:00.000Z')
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const employeeSession = await login(baseUrl, 'employee');
  const employeeDashboard = await request(baseUrl, '/v1/dashboard', {
    sessionId: employeeSession.id
  });
  assert.equal(employeeDashboard.status, 200);
  const employeeBody = await employeeDashboard.json();
  assert.equal(employeeBody.permissions.readOnly, true);
  assert.deepEqual(employeeBody.actions, []);

  const employeeAction = await request(baseUrl, '/v1/dashboard/actions', {
    method: 'POST',
    sessionId: employeeSession.id,
    body: { actionId: 'export_audit_summary' }
  });
  assert.equal(employeeAction.status, 403);

  const ceoSession = await login(baseUrl, 'ceo');
  const ceoDashboard = await request(baseUrl, '/v1/dashboard', {
    sessionId: ceoSession.id
  });
  assert.equal(ceoDashboard.status, 200);
  const ceoBody = await ceoDashboard.json();
  assert.equal(ceoBody.permissions.canExecuteActions, true);
  assert.equal(ceoBody.actions.length > 0, true);

  const customerSession = await login(baseUrl, 'customer');
  const customerDashboard = await request(baseUrl, '/v1/dashboard', {
    sessionId: customerSession.id
  });
  assert.equal(customerDashboard.status, 200);
  const customerBody = await customerDashboard.json();
  assert.equal(customerBody.account.publicProductRecords, 0);
  assert.equal(customerBody.account.productResearchAvailable, 0);
  assert.equal(customerBody.account.checkoutEnabled, false);
  assert.deepEqual(customerBody.productCategories, []);
});
