# Order & Payment API

A small REST backend for a shop where a user creates an order, pays for it, and a
(very fake) payment provider calls us back to confirm. Built with Node.js,
TypeScript, Express and MongoDB/Mongoose. No UI - the backend is the point.

## Running it

```bash
cp .env.example .env      # set JWT_SECRET + MONGO_URI
npm install
npm run seed              # optional: creates an admin + a few products
npm run dev               # http://localhost:3000
```

Admin login after seeding: `admin@example.com` / `admin12345`.

Tests need no MongoDB of your own - they spin up an in-memory one:

```bash
npm test
```

If a `mongod` binary is on the machine (Homebrew path or `/usr/local/bin`, or via
`MONGOMS_SYSTEM_BINARY`) the tests reuse it; otherwise export `MONGO_URI` pointing
at any reachable MongoDB and the suite will use that instead.

## Stack

- Node.js + TypeScript (strict)
- Express 4
- MongoDB + Mongoose 8
- JWT (`jsonwebtoken`) + `bcryptjs` for passwords
- Redis (`ioredis`) as a server-side access-token store so sessions can be revoked
- `zod` for request validation
- `helmet`, `cors`, `express-rate-limit` for the usual hardening
- Jest + Supertest + mongodb-memory-server for tests

## Layout

```
src/
  config/         env parsing (fails fast on missing secrets)
  database/       mongoose connection
  models/         User, Product, Order(+embedded items), Payment
  shared/
    errors/       AppError + stable error codes
    middleware/   validate (zod), requireAuth, notFound, errorHandler
    http/         asyncHandler, response envelope
    auth/         token sign/verify + Redis-backed token store
    validation/   shared zod helpers (ObjectId)
  modules/
    auth/         register + login + logout
    products/     create / list / detail
    orders/       create / detail  (stock reservation lives here)
    payments/     create / callback (idempotency lives here)
  app.ts          wires routers + middleware
  server.ts       listens
tests/            integration tests over the HTTP layer
```

Each module keeps the same three layers: **routes → controller → service**.
Controllers only deal with HTTP (read `req`, call a service, shape the response).
All business rules live in the service so they stay testable and are never
duplicated across endpoints.

## Flow

```
login → create order (stock reserved, prices snapshotted)
      → create payment (server total verified, idempotent)
      → provider callback (confirm once) → order = paid
```

---

## The four "gotcha" requirements

### 1. Race condition on the last item

A product with `stock = 1` must never sell twice, even under two simultaneous
requests.

Stock is **reserved at order creation** with a single conditional atomic update:

```ts
Product.findOneAndUpdate(
  { _id, isActive: true, stock: { $gte: quantity } },
  { $inc: { stock: -quantity } },
  { new: true },
);
```

The filter and the update are one document-level operation that MongoDB executes
atomically. If two buyers race for the last unit, exactly one of them still
matches `stock: { $gte: 1 }` after the other's `$inc` lands; the loser matches
nothing, gets no document back, and the order is rejected. The `stock` field can
never go negative.

**Why reserve at creation instead of at the callback?** The task's diagram places
"Decrease Inventory" after payment confirmation. I moved the decrement earlier on
purpose: reserving at the callback means N pending orders can all "look" valid and
then fail at confirmation once stock is gone - worse UX and it leans on
multi-document transactions. Reserving up front is the safe default for a real
shop. If you'd rather hold stock only after payment, the same guarded `$inc` just
moves into the callback path and order creation becomes a non-binding check.

For multi-item orders, an early failure rolls back the lines already reserved
(`releaseStock`). This compensation is best-effort on a standalone Mongo. On a
replica set I'd wrap the whole create in a session/transaction so partial
reservations are impossible by construction - I kept it transaction-free so the
project runs against a plain `mongod`, but the rollback path is there so the
invariant holds either way.

### 2. Idempotency (retried `POST /payments`)

A client may send the same `Idempotency-Key: abc-123` more than once.

- `Payment.idempotencyKey` has a **unique, sparse** index.
- On create, we first look for an existing payment with the key and return it
  unchanged (no second charge).
- If two requests with the same key race past the lookup, the unique index lets
  only one insert succeed; the loser catches the `E11000` duplicate-key error and
  returns the document that won.

So retries are safe and never create duplicates, even concurrently.

### 3. Price tampering

The order request is validated with a zod schema that only allows `productId` and
`quantity`, and `.strip()` drops anything else. A client-sent `price` is silently
discarded. The unit price is read from the **Product document** and copied onto the
order item (`unitPrice`, `lineTotal`, `totalPrice`). Because prices are snapshotted
into the order, changing `Product.price` later never rewrites an existing order -
covered by a test.

### 4. Payment amount tampering

`POST /payments` accepts an `amount` to match the brief, but it is **never trusted**.
The service recomputes the charge from `order.totalPrice`. If the client's amount
differs, it's rejected with `PAYMENT_AMOUNT_MISMATCH`. The stored payment always
uses the server-side total. You cannot pay 100,000 for a 2,000,000 order.

The callback then only flips an already-correct payment/order pair; it re-checks
state rather than re-deriving money from any client input.

---

## Statuses as a business rule

Order statuses: `pending`, `paid`, `cancelled`, `failed`. There is **no**
`PATCH /orders/:id` - a client can't set `status: "Paid"`. Transitions happen only
through the service, guarded by atomic conditional updates:

- `pending → paid` only when a payment callback confirms success.
- `pending → failed` only when a callback reports failure (and reserved stock is
  released back exactly once).

Each transition is a `findOneAndUpdate({ _id, status: 'pending' }, { status: ... })`,
so a second attempt matches nothing and is a no-op.

## Idempotent callbacks

`POST /payments/callback` may fire several times for one payment. The first thing
it does is an atomic `pending → succeeded|failed` on the **payment**. Only the
request whose update actually changes a document continues; duplicates find a
non-pending payment and return `{ processed: false }` without touching the order,
stock, or creating any transaction. Combined with the guarded order transition,
"double paid" and "double decrement" are both impossible.

## Validation

Every body/param goes through a zod schema before hitting a service: quantity must
be a positive integer, ids must be valid ObjectIds, amounts must be non-negative
integers, product prices must be positive integers, `items` can't be empty. Bad
input returns a 400 with per-field details.

Money is stored as a **non-negative integer** in the smallest currency unit (rials),
which sidesteps floating-point rounding errors entirely.

## Error handling

One central `errorHandler` is the only place that turns thrown values into
responses. It normalises `AppError`, zod errors, Mongoose cast errors, and
duplicate-key errors into a stable shape:

```json
{ "success": false, "message": "Insufficient stock", "code": "INSUFFICIENT_STOCK" }
```

Anything that isn't an `AppError` is treated as a bug: it's logged server-side and
the client gets a generic 500 with no message leakage. Real errors carry a machine
readable `code` from a single enum so integrations branch on code, not text. Success
responses share a `{ success: true, data }` envelope.

## Database indexes

| Collection | Index                             | Why / queries that use it                                                                             |
| ---------- | --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `users`    | `email` (unique)                  | Login looks up by email on every request; uniqueness prevents duplicate accounts.                     |
| `products` | `isActive, createdAt`             | `GET /products` lists active items newest-first - the filter and sort both fit this compound index.   |
| `products` | `name`                            | Catalog search / dedupe by name.                                                                      |
| `orders`   | `userId, createdAt`               | "My orders" list, scoped to a user and sorted by date.                                                |
| `orders`   | `status, createdAt`               | Ops/dashboard queries filtering by status over a time range.                                          |
| `payments` | `providerRef` (unique)            | Callbacks are keyed by provider reference; uniqueness guarantees one payment per ref.                 |
| `payments` | `idempotencyKey` (unique, sparse) | Enforces idempotent creation even under concurrent retries; sparse so keyless payments don't collide. |
| `payments` | `orderId, status`                 | Looking up the payment(s) for an order.                                                               |

Mongoose builds these automatically (`autoIndex`) when the models are first used,
which is also how the test run gets them.

**If you add too many indexes:** every index is a secondary structure that must be
updated on every write, so inserts/updates get slower and use more RAM/disk. Indexes
also fragment the working set, can confuse the query planner (the wrong index gets
picked), and slow down startup/sync. The rule I follow is index-for-the-queries-you
actually run, prefer a few good compound indexes over many single-field ones, and drop
anything unused.

## Revocable access tokens (Redis)

A plain JWT can't be logged out: once issued it is valid until it expires, even if
the client hands it to an attacker. To close that gap every token carries a unique
`jti`, and on login we mirror that `jti` into Redis with a TTL equal to the token's
lifetime:

```ts
// login -> issueSession()
const { token, jti } = signToken({ sub, role });
await tokenStore.save(jti, ttlSecondsFrom(config.jwtExpiresIn)); // Redis SET EX

// requireAuth() -> after verifying the signature
if (!(await tokenStore.exists(payload.jti))) throw AppError.unauthorized(...);
```

So a request needs both a valid signature **and** a live entry in Redis. `POST
/auth/logout` deletes the `jti`, so the very same still-unexpired token is rejected
immediately afterwards - real, server-side revocation. `POST /auth/login` (the
required endpoint) and the store check are covered in `tests/auth.test.ts`.

The store sits behind a tiny `TokenStore` interface with two implementations:
`RedisTokenStore` (used when `REDIS_URL` is set) and an in-memory one used by the
test suite, so tests stay self-contained. Keeping it to `save/exists/remove` on a
single key is deliberate - it's the smallest thing that gives revocation without
pulling in a session framework. A natural next step is a short-lived access token
plus a refresh token stored the same way.

## Security notes

- Passwords are bcrypt-hashed; the hash field is `select: false` so it never comes
  back in ordinary queries.
- Login returns the same message for unknown email and wrong password (no account
  enumeration).
- JWT auth on orders/payments; order reads and payment creation are owner-only
  (admins can read any order). An order is always created for `req.auth.userId`,
  never a client-supplied id.
- Product creation is admin-only.
- `helmet`, request body size cap, and a rate limiter on `/auth`.
- Access tokens are tracked in Redis by `jti`, so logout revokes them before expiry.
- The callback endpoint is intentionally unauthenticated (it "comes from the
  provider"); in a real integration it would require a verified signature - a
  `signature` field is already reserved in the schema for that.
