# Policy Workflow Engine

A full-stack approval workflow system that enforces **role-based spending policies**. Tasks carry a dollar amount, each role has an approval ceiling, and the policy engine decides — in real time — whether a given user is authorized to approve a request. Every decision is written to an immutable audit trail.

Built with a Node/Express + Prisma + PostgreSQL backend and a React front end.

---

## What it does

Organizations need controls over who can approve what. A team lead shouldn't be able to greenlight a $500,000 acquisition; a director shouldn't be blocked on a $250 supply order. This engine encodes those rules as data-driven policies and enforces them on every approval attempt.

- **Role-based access control** — approval authority is defined per role, not hard-coded
- **Policy engine** — a request is approved only if its amount is within the acting role's ceiling, otherwise it's rejected with a reason
- **Audit trail** — every task creation, approval, and rejection is logged with a timestamp for accountability
- **REST API** — clean, validated endpoints for tasks, policies, users, and audit logs
- **Web UI** — sign in by role, search and filter requests, and action approvals with live policy feedback

---

## Approval rules (seed policy)

| Role     | Approval ceiling |
| -------- | ---------------- |
| employee | $500             |
| manager  | $5,000           |
| director | $50,000          |
| ceo      | $1,000,000       |

The core rule lives in `src/services/policyEngine.js`:

> A role may approve a task only if `task.amount <= policy.maxAmount` for that role.

---

## Tech stack

**Backend:** Node.js, Express, Prisma ORM, PostgreSQL
**Frontend:** React
**Tooling:** Prisma migrations + seed script, dotenv

---

## Project structure

```
policy-workflow-engine/
├── src/
│   ├── app.js                  # Express server + REST endpoints
│   └── services/
│       ├── policyEngine.js     # Role-based approval logic
│       └── auditService.js     # Audit trail read/write
├── prisma/
│   └── schema.prisma           # User, Task, Policy, AuditLog models
├── seed.js                     # Seeds policies, users, tasks, audit logs
├── frontend/
│   └── index.html              # React UI for the approval workflow
└── .env.example
```

---

## API endpoints

| Method | Endpoint              | Description                                  |
| ------ | --------------------- | -------------------------------------------- |
| GET    | `/health`             | Service health check                         |
| GET    | `/tasks`              | List tasks (optional `?status=` filter)      |
| GET    | `/tasks/:id`          | Get a task with its audit history            |
| POST   | `/tasks`              | Create a task (`{ title, amount }`)          |
| POST   | `/tasks/:id/approve`  | Attempt approval (`{ userRole }`)            |
| GET    | `/policies`           | List approval policies                       |
| POST   | `/policies`           | Create or update a policy                    |
| GET    | `/audit`              | Recent audit log entries                     |
| GET    | `/audit/:entityId`    | Audit history for a specific entity          |
| GET    | `/users`              | List users                                   |
| POST   | `/users`              | Create a user (`{ email, role }`)            |

---

## Running locally

### Backend

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` from the example and point it at your PostgreSQL database:
   ```bash
   cp .env.example .env
   # set DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
   ```
3. Apply the schema and seed sample data:
   ```bash
   npx prisma db push
   node seed.js
   ```
4. Start the server:
   ```bash
   npm run dev
   ```
   The API runs at `http://localhost:3000`.

### Frontend

The UI in `frontend/index.html` is a self-contained React app — no build step required. Open it directly in a browser, or deploy it as a static site (Netlify, Vercel, GitHub Pages).

It ships with the same seed data and policy logic as the backend so it can be demoed standalone; point it at the live REST API to run fully end-to-end.

---

## Example scenarios

- Employee approves a $250 supply order → **approved** (within $500 ceiling)
- Employee attempts a $2,500 laptop purchase → **rejected** (over ceiling)
- Manager approves $4,200 in conference tickets → **approved**
- Manager attempts a $500,000 acquisition → **rejected** (needs CEO authority)

Each outcome is recorded in the audit log with the acting role and the reason.

---

## Possible extensions

- Server-side authentication with hashed passwords and JWT sessions
- Multi-step approval chains (escalate to the next role up instead of rejecting)
- Configurable policies per department, not just role
- Pagination and date-range filtering on the audit log