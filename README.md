# Concert Ticket Booking System

A full-stack ticket booking application built with React + TypeScript (frontend) and Node.js + TypeScript (backend), featuring robust concurrency control to prevent double-booking.

## Features

- **Ticket Catalog**: View available tickets across three tiers (VIP, Front Row, GA)
- **Real-time Availability**: Live ticket availability updates
- **Secure Booking**: Prevents double-booking through database-level constraints and transaction isolation
- **Payment Simulation**: Simulates payment processing (90% success rate)
- **Global Support**: Designed for globally distributed users (USD currency)

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL
- **Architecture**: RESTful API

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 12+ (or Docker for running PostgreSQL)

## Quick Start

### 1. Database Setup

#### Option A: Using Docker (Recommended)

```bash
docker run --name ticketbooking-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=ticketbooking \
  -p 5432:5432 \
  -d postgres:15
```

#### Option B: Local PostgreSQL

Create a database named `ticketbooking`:

```bash
createdb ticketbooking
```

**Note for macOS users**: If you installed PostgreSQL via Homebrew, the default username is your system username (not `postgres`). Update the `DATABASE_URL` in `.env` to use your username, e.g., `postgresql://yourusername@localhost:5432/ticketbooking` (no password needed for local connections).

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 3. Configure Environment

Create `backend/.env` file:

```bash
cd backend
cp env.example .env
```

Edit `backend/.env` with your database connection:

```
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ticketbooking
NODE_ENV=development
```

**macOS Note**: If using Homebrew PostgreSQL, replace `postgres:postgres` with your system username (no password), e.g., `postgresql://yourusername@localhost:5432/ticketbooking`

### 4. Run Database Migrations

```bash
cd backend
npm run migrate
```

This will:
- Create the `tickets` and `bookings` tables
- Insert initial inventory:
  - 100 VIP tickets ($100 each)
  - 200 Front Row tickets ($50 each)
  - 1000 GA tickets ($10 each)

### 5. Start the Backend

```bash
cd backend
npm run dev
```

The backend will start on `http://localhost:3001`

### 6. Start the Frontend

In a new terminal:

```bash
cd frontend
npm run dev
```

The frontend will start on `http://localhost:3000`

### 7. Access the Application

Open your browser and navigate to `http://localhost:3000`

## API Endpoints

### GET `/api/tickets/availability`
Returns availability count for each ticket tier.

**Response:**
```json
{
  "VIP": {
    "available": 100,
    "total": 100,
    "price": 100
  },
  "Front Row": {
    "available": 200,
    "total": 200,
    "price": 50
  },
  "GA": {
    "available": 1000,
    "total": 1000,
    "price": 10
  }
}
```

### GET `/api/tickets`
Returns all available tickets (for catalog display).

### POST `/api/bookings`
Creates a new booking.

**Request:**
```json
{
  "tier": "VIP",
  "quantity": 2,
  "userId": "user-123"
}
```

**Response:**
```json
{
  "success": true,
  "bookings": [...],
  "message": "Successfully booked 2 ticket(s)"
}
```

## Architecture & Design Decisions

### Concurrency Control & Double-Booking Prevention

This is the **critical requirement** of the system. We implement multiple layers of protection:

#### 1. Database-Level Constraints
- **UNIQUE constraint** on `bookings.ticket_id` ensures no two bookings can reference the same ticket
- This is enforced at the database level, preventing race conditions even if application logic fails
- PostgreSQL will reject any INSERT that violates this constraint with error code `23505`

#### 2. Transaction Isolation (SERIALIZABLE)
- All booking operations run in `SERIALIZABLE` isolation level
- This is the highest isolation level, ensuring that concurrent transactions see a consistent view
- PostgreSQL's MVCC (Multi-Version Concurrency Control) handles the complexity
- Trade-off: Higher isolation can lead to serialization failures, but we handle these gracefully

#### 3. SELECT FOR UPDATE SKIP LOCKED
- When selecting available tickets, we use `SELECT ... FOR UPDATE SKIP LOCKED`
- This locks the selected rows until the transaction commits
- `SKIP LOCKED` prevents blocking: if a ticket is locked by another transaction, we skip it and get the next available
- This allows high concurrency without deadlocks

#### 4. Atomic Operations
- Ticket selection, booking creation, and payment simulation happen in a **single transaction**
- Either all succeed or all fail (ACID compliance)
- If payment fails, the entire transaction rolls back, making tickets available again

#### 5. Idempotency
- Each booking has a unique `booking_reference`
- Retries with the same reference are handled gracefully
- Prevents duplicate bookings from network retries

**Code Location**: See `backend/src/services/bookingService.ts` for detailed comments explaining the concurrency handling.

### Trade-offs & Decisions

#### 1. Database Choice: PostgreSQL
- **Why**: ACID compliance, strong consistency guarantees, excellent concurrency control
- **Trade-off**: Requires more setup than in-memory stores, but ensures data durability
- **Alternative considered**: Redis (faster, but requires additional persistence layer)

#### 2. Transaction Isolation: SERIALIZABLE
- **Why**: Maximum consistency, prevents all forms of race conditions
- **Trade-off**: Can cause serialization failures under high contention, but these are rare and handled gracefully
- **Alternative considered**: REPEATABLE READ (faster, but less strict)

#### 3. Row-Level Locking: SELECT FOR UPDATE SKIP LOCKED
- **Why**: Prevents blocking while ensuring exclusive access
- **Trade-off**: Slightly more complex queries, but enables high concurrency
- **Alternative considered**: Pessimistic locking (simpler, but causes blocking)

#### 4. Payment Simulation Before Commit
- **Why**: Ensures we only commit bookings with successful payments
- **Trade-off**: Payment processing happens inside transaction (could be slow), but ensures consistency
- **Alternative considered**: Two-phase commit (more complex, but allows async payment)

#### 5. Frontend: React + Vite
- **Why**: Modern, fast development experience, excellent TypeScript support
- **Trade-off**: Requires build step, but provides excellent developer experience
- **Alternative considered**: Next.js (more features, but heavier for this use case)

#### 6. No Authentication
- **Why**: Assignment requirement - users are mocked
- **Trade-off**: Not production-ready, but simplifies the demo
- **Production consideration**: Would add JWT-based auth with refresh tokens

## Scalability & Performance

### Target Metrics
- **Availability**: 99.99% (four nines)
- **Scale**: ~1,000,000 DAU, peak ~50,000 concurrent users
- **Performance**: Booking request p95 < 500ms

### How to Achieve 99.99% Availability

#### Current Design
- Single-region deployment with PostgreSQL
- No redundancy (for demo purposes)

#### Production Design (99.99% = ~52 minutes downtime/year)

1. **Multi-Region Deployment**
   - Deploy backend services in at least 3 regions (e.g., US-East, EU-West, Asia-Pacific)
   - Use a global load balancer (AWS Global Accelerator, Cloudflare) for geographic routing
   - Database replication: PostgreSQL streaming replication with read replicas in each region
   - Write operations go to primary, reads can use local replicas

2. **Database High Availability**
   - PostgreSQL primary-replica setup with automatic failover (Patroni, pg_auto_failover)
   - Connection pooling (PgBouncer) to handle connection limits
   - Database backups: Continuous WAL archiving + daily full backups

3. **Application Redundancy**
   - Multiple backend instances behind load balancer (health checks every 5s)
   - Stateless application design (all state in database)
   - Graceful shutdown handling (drain connections before termination)

4. **Infrastructure Resilience**
   - Container orchestration (Kubernetes) with auto-scaling and auto-healing
   - Multiple availability zones per region
   - Circuit breakers for external dependencies (payment providers)

5. **Monitoring & Alerting**
   - Comprehensive monitoring (Prometheus + Grafana)
   - Alerting on error rates, latency, availability metrics
   - On-call rotation for critical issues

6. **Disaster Recovery**
   - Cross-region database backups
   - RTO (Recovery Time Objective): < 15 minutes
   - RPO (Recovery Point Objective): < 5 minutes (via WAL replication)

**Expected Downtime**: ~52 minutes/year (mostly planned maintenance windows)

### How to Scale to 1M DAU, 50K Concurrent Users

#### Current Design
- Single PostgreSQL instance
- Single backend server
- No caching

#### Production Design

1. **Database Scaling**
   - **Read Replicas**: 3-5 read replicas per region for read-heavy operations (availability queries)
   - **Connection Pooling**: PgBouncer with 200+ connections per instance
   - **Partitioning**: Partition `tickets` table by tier or date for better query performance
   - **Indexing**: Already have indexes on `tier`, `available`, `ticket_id` - add composite indexes if needed
   - **Connection Limits**: PostgreSQL max_connections = 500, use connection poolers

2. **Application Scaling**
   - **Horizontal Scaling**: 10-20 backend instances per region (auto-scaling based on CPU/memory)
   - **Load Balancing**: Round-robin or least-connections algorithm
   - **Stateless Design**: All instances share database, no session state

3. **Caching Strategy**
   - **Redis Cache**: Cache ticket availability (5-second TTL) to reduce database load
   - **Cache Invalidation**: Invalidate on successful bookings
   - **CDN**: Static assets (frontend) served via CDN (Cloudflare, CloudFront)

4. **Database Query Optimization**
   - **Prepared Statements**: Already using parameterized queries (prevents SQL injection + faster)
   - **Query Optimization**: `EXPLAIN ANALYZE` to identify slow queries
   - **Batch Operations**: For bulk ticket creation (already done in migration)

5. **Rate Limiting**
   - **Per-User Rate Limits**: 10 bookings per minute per user (prevent abuse)
   - **Global Rate Limits**: 1000 requests/second per endpoint
   - **Implementation**: Redis-based rate limiting (sliding window)

6. **Message Queue (Optional)**
   - For high-volume scenarios: Use message queue (RabbitMQ, Kafka) for booking requests
   - Workers process bookings asynchronously
   - Trade-off: Adds complexity, but enables better load distribution

**Capacity Calculation**:
- 50K concurrent users × 1 request/10s = 5,000 requests/second
- With 20 backend instances: 250 requests/second per instance (well within capacity)
- Database: 5,000 reads/second (handled by read replicas), 500 writes/second (primary can handle)

### How to Achieve p95 < 500ms

#### Current Design
- Direct database queries
- No caching
- Payment simulation is synchronous

#### Production Optimizations

1. **Database Performance**
   - **Connection Pooling**: Already implemented (pg Pool with max: 20)
   - **Indexes**: Already have indexes on critical columns
   - **Query Optimization**: Use `EXPLAIN ANALYZE` to identify bottlenecks
   - **Read Replicas**: Route availability queries to read replicas (lower latency)

2. **Caching Layer**
   - **Redis Cache**: Cache availability data (5-second TTL)
   - **Cache Hit Rate Target**: > 80% (most requests served from cache)
   - **Cache Warming**: Pre-warm cache on application startup

3. **Application Optimization**
   - **Async Operations**: Use async/await (already implemented)
   - **Connection Reuse**: HTTP keep-alive for frontend-backend communication
   - **Compression**: gzip compression for API responses

4. **Payment Processing**
   - **Current**: Synchronous simulation (fast, but not realistic)
   - **Production**: Async payment processing with webhooks
   - **Optimization**: Return booking immediately with "pending" status, update via webhook
   - This reduces p95 latency from ~200ms (payment) to ~50ms (just DB operations)

5. **Database Query Optimization**
   - **Batch Inserts**: Already batching ticket creation in migration
   - **Prepared Statements**: Already using parameterized queries
   - **Query Timeout**: Set 2-second timeout to prevent hanging queries

6. **Monitoring & Profiling**
   - **APM Tools**: New Relic, Datadog to identify slow queries
   - **Database Monitoring**: pg_stat_statements to track query performance
   - **Alerting**: Alert if p95 > 400ms (before hitting 500ms target)

**Expected Performance**:
- Availability query (cached): < 10ms
- Availability query (DB): < 50ms
- Booking creation: < 200ms (with async payment)
- p95: < 400ms (well under 500ms target)

## Testing

### Manual Testing

1. **Double-Booking Test**:
   - Open two browser windows
   - Try to book the same ticket tier simultaneously
   - Verify only one succeeds

2. **Concurrency Test**:
   - Use a tool like `ab` (Apache Bench) or `wrk`:
   ```bash
   ab -n 1000 -c 50 -p booking.json -T application/json http://localhost:3001/api/bookings
   ```
   - Verify no double-bookings occur

### Automated Testing (Bonus)

To add comprehensive testing:

```bash
# Backend tests
cd backend
npm install --save-dev jest @types/jest ts-jest
npm test

# Frontend tests
cd frontend
npm install --save-dev vitest @testing-library/react
npm test
```

## Project Structure

```
ticketbooking/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── connection.ts      # PostgreSQL connection pool
│   │   │   └── migrate.ts          # Database migrations
│   │   ├── routes/
│   │   │   └── bookingRoutes.ts   # API routes
│   │   ├── services/
│   │   │   └── bookingService.ts  # Business logic + concurrency control
│   │   ├── types.ts               # TypeScript types
│   │   └── index.ts               # Express server
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── TicketCatalog.tsx  # Ticket display
│   │   │   └── BookingForm.tsx    # Booking form
│   │   ├── api.ts                 # API client
│   │   ├── types.ts               # TypeScript types
│   │   ├── App.tsx                # Main app component
│   │   └── main.tsx               # Entry point
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

## Future Enhancements

1. **Authentication & Authorization**: JWT-based auth with user management
2. **Real Payment Integration**: Stripe, PayPal, etc.
3. **Email Notifications**: Booking confirmations
4. **Admin Dashboard**: Manage tickets, view bookings
5. **Booking History**: User can view their past bookings
6. **Waitlist**: For sold-out tiers
7. **Seat Selection**: Visual seat map (if applicable)
8. **Multi-Currency**: Support for different currencies with conversion

## License

This is a take-home assignment project.

## Contact

For questions or issues, please refer to the code comments or create an issue in the repository.
