const crypto = require('crypto');

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const DEMO_PASSWORD = process.env.AIDLYST_DEMO_PASSWORD || '';

const DEMO_USERS = [
  {
    id: 'usr_customer_demo',
    role: 'customer',
    name: 'Customer Demo',
    email: 'customer@aidlyst.local',
    password: process.env.AIDLYST_CUSTOMER_PASSWORD || DEMO_PASSWORD
  },
  {
    id: 'usr_employee_demo',
    role: 'employee',
    name: 'Employee Demo',
    email: 'employee@aidlyst.local',
    password: process.env.AIDLYST_EMPLOYEE_PASSWORD || DEMO_PASSWORD
  },
  {
    id: 'usr_ceo_demo',
    role: 'ceo',
    name: 'CEO Demo',
    email: 'ceo@aidlyst.local',
    password: process.env.AIDLYST_CEO_PASSWORD || DEMO_PASSWORD
  }
];

const ROLE_PERMISSIONS = {
  customer: ['account:read', 'products:research'],
  employee: ['metrics:read', 'audits:read', 'catalog:read'],
  ceo: ['metrics:read', 'audits:read', 'catalog:read', 'actions:execute', 'strategy:read', 'exports:create']
};

function safeCompare(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    permissions: ROLE_PERMISSIONS[user.role] || []
  };
}

class AuthService {
  constructor({ users = DEMO_USERS, sessionTtlMs = SESSION_TTL_MS } = {}) {
    this.users = users;
    this.sessionTtlMs = sessionTtlMs;
    this.sessions = new Map();
  }

  login({ email, password, role }) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedRole = String(role || '').trim().toLowerCase();
    const user = this.users.find((candidate) => (
      candidate.email.toLowerCase() === normalizedEmail &&
      candidate.role === normalizedRole
    ));

    if (!user || !user.password || !safeCompare(password, user.password)) {
      throw Object.assign(new Error('Invalid email, password, or role.'), { statusCode: 401 });
    }

    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + this.sessionTtlMs).toISOString();
    const session = {
      id: sessionId,
      user: publicUser(user),
      createdAt: new Date().toISOString(),
      expiresAt
    };
    this.sessions.set(sessionId, session);

    return session;
  }

  getSession(sessionId) {
    if (!sessionId) return null;
    const session = this.sessions.get(String(sessionId));
    if (!session) return null;
    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      this.sessions.delete(String(sessionId));
      return null;
    }
    return session;
  }

  logout(sessionId) {
    return this.sessions.delete(String(sessionId || ''));
  }

  requireSession(request) {
    const sessionId = this.sessionIdFromRequest(request);
    const session = this.getSession(sessionId);
    if (!session) {
      throw Object.assign(new Error('A valid login session is required.'), { statusCode: 401 });
    }
    return session;
  }

  requireRole(request, roles) {
    const session = this.requireSession(request);
    if (!roles.includes(session.user.role)) {
      throw Object.assign(new Error('This role cannot perform that action.'), { statusCode: 403 });
    }
    return session;
  }

  sessionIdFromRequest(request) {
    const bearer = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '');
    return bearer || request.headers['x-aidlyst-session'] || '';
  }
}

module.exports = {
  AuthService,
  DEMO_USERS,
  ROLE_PERMISSIONS
};
