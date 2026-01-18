import pool from './connection';

/**
 * Database migration script
 * Creates tables for tickets and bookings with proper constraints
 * 
 * Concurrency Strategy:
 * - Uses PostgreSQL's SELECT FOR UPDATE SKIP LOCKED for row-level locking
 * - Unique constraint on ticket_id to prevent double-booking
 * - Transaction isolation level ensures consistency
 */
async function migrate() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Create tickets table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        id SERIAL PRIMARY KEY,
        tier VARCHAR(50) NOT NULL CHECK (tier IN ('VIP', 'Front Row', 'GA')),
        price DECIMAL(10, 2) NOT NULL,
        available BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(id)
      )
    `);

    // Create bookings table
    // Critical: ticket_id is unique to prevent double-booking
    await client.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        ticket_id INTEGER NOT NULL UNIQUE REFERENCES tickets(id) ON DELETE CASCADE,
        user_id VARCHAR(255) NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        total_price DECIMAL(10, 2) NOT NULL,
        payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'success', 'failed')),
        booking_reference VARCHAR(255) UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(ticket_id)
      )
    `);

    // Create index on ticket_id for faster lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_bookings_ticket_id ON bookings(ticket_id)
    `);

    // Create index on tier for faster catalog queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tickets_tier ON tickets(tier)
    `);

    // Create index on available for faster availability queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tickets_available ON tickets(available)
    `);

    // Insert initial ticket inventory
    // VIP tickets: 100 tickets
    const vipTickets = Array.from({ length: 100 }, (_, i) => ({
      tier: 'VIP',
      price: 100.00,
      available: true
    }));

    // Front Row tickets: 200 tickets
    const frontRowTickets = Array.from({ length: 200 }, (_, i) => ({
      tier: 'Front Row',
      price: 50.00,
      available: true
    }));

    // GA tickets: 1000 tickets
    const gaTickets = Array.from({ length: 1000 }, (_, i) => ({
      tier: 'GA',
      price: 10.00,
      available: true
    }));

    // Check if tickets already exist
    const existingTickets = await client.query('SELECT COUNT(*) FROM tickets');
    if (existingTickets.rows[0].count === '0') {
      const allTickets = [...vipTickets, ...frontRowTickets, ...gaTickets];
      
      for (const ticket of allTickets) {
        await client.query(
          'INSERT INTO tickets (tier, price, available) VALUES ($1, $2, $3)',
          [ticket.tier, ticket.price, ticket.available]
        );
      }
      
      console.log(`Inserted ${allTickets.length} tickets into database`);
    } else {
      console.log('Tickets already exist, skipping insertion');
    }

    await client.query('COMMIT');
    console.log('Migration completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration if called directly
if (require.main === module) {
  migrate()
    .then(() => {
      console.log('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

export { migrate };
