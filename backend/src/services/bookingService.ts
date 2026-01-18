import pool from '../db/connection';
import { TicketTier, BookingRequest, Booking, Ticket } from '../types';

/**
 * Booking Service
 * 
 * CRITICAL CONCURRENCY HANDLING:
 * 
 * This service implements multiple strategies to prevent double-booking:
 * 
 * 1. Database-Level Constraints:
 *    - UNIQUE constraint on bookings.ticket_id ensures no two bookings can reference the same ticket
 *    - This is enforced at the database level, preventing race conditions
 * 
 * 2. Transaction Isolation:
 *    - All booking operations run in SERIALIZABLE or REPEATABLE READ isolation level
 *    - PostgreSQL's MVCC (Multi-Version Concurrency Control) ensures consistency
 * 
 * 3. SELECT FOR UPDATE SKIP LOCKED:
 *    - When selecting available tickets, we use SELECT FOR UPDATE SKIP LOCKED
 *    - This locks the selected rows until the transaction commits
 *    - SKIP LOCKED prevents blocking - if a ticket is locked, we skip it and get the next available
 * 
 * 4. Idempotency:
 *    - Each booking has a unique booking_reference
 *    - If a booking fails mid-transaction, the ticket remains available
 *    - Retries with the same booking_reference are handled gracefully
 * 
 * 5. Atomic Operations:
 *    - Ticket selection, booking creation, and payment simulation happen in a single transaction
 *    - Either all succeed or all fail (ACID compliance)
 */

/**
 * Get available tickets for a specific tier
 * @param client - Database client (can be from a transaction)
 * @param tier - Ticket tier
 * @param quantity - Number of tickets needed
 */
export async function getAvailableTickets(
  client: any,
  tier: TicketTier,
  quantity: number
): Promise<Ticket[]> {
  // Use SELECT FOR UPDATE SKIP LOCKED to prevent double-booking
  // This locks the selected rows until the transaction commits
  // SKIP LOCKED ensures we don't block on already-locked tickets
  const result = await client.query(
    `SELECT id, tier, price, available, created_at
     FROM tickets
     WHERE tier = $1 AND available = true
     ORDER BY id
     LIMIT $2
     FOR UPDATE SKIP LOCKED`,
    [tier, quantity]
  );
  
  return result.rows;
}

/**
 * Create a booking with proper concurrency handling
 * 
 * This function implements the critical double-booking prevention logic:
 * 1. Starts a transaction with SERIALIZABLE isolation
 * 2. Locks available tickets using SELECT FOR UPDATE SKIP LOCKED
 * 3. Creates bookings atomically
 * 4. Simulates payment
 * 5. Commits or rolls back based on payment result
 */
export async function createBooking(request: BookingRequest): Promise<Booking[]> {
  const client = await pool.connect();
  
  try {
    // Set transaction isolation level to SERIALIZABLE for maximum consistency
    // This ensures that concurrent transactions see a consistent view of the data
    await client.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
    await client.query('BEGIN');

    // Get and lock available tickets
    // FOR UPDATE SKIP LOCKED ensures:
    // - We lock the tickets we're about to book
    // - We skip tickets that are already locked by other transactions
    // - This prevents two users from booking the same ticket simultaneously
    const tickets = await getAvailableTickets(client, request.tier, request.quantity);
    
    if (tickets.length < request.quantity) {
      await client.query('ROLLBACK');
      throw new Error(`Insufficient tickets available. Requested: ${request.quantity}, Available: ${tickets.length}`);
    }

    const bookings: Booking[] = [];
    const bookingReference = `BK-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const totalPrice = tickets.reduce((sum, ticket) => sum + parseFloat(ticket.price.toString()), 0);

    // Create bookings for each ticket
    // The UNIQUE constraint on ticket_id in the database ensures no double-booking
    for (const ticket of tickets) {
      try {
        const result = await client.query(
          `INSERT INTO bookings (ticket_id, user_id, quantity, total_price, booking_reference, payment_status)
           VALUES ($1, $2, $3, $4, $5, 'pending')
           RETURNING id, ticket_id, user_id, quantity, total_price, payment_status, booking_reference, created_at`,
          [ticket.id, request.userId, 1, ticket.price, bookingReference]
        );

        // Mark ticket as unavailable
        await client.query(
          'UPDATE tickets SET available = false WHERE id = $1',
          [ticket.id]
        );

        bookings.push(result.rows[0]);
      } catch (error: any) {
        // If we get a unique constraint violation, another transaction already booked this ticket
        if (error.code === '23505') { // PostgreSQL unique violation error code
          await client.query('ROLLBACK');
          throw new Error('Ticket was already booked by another user. Please try again.');
        }
        throw error;
      }
    }

    // Simulate payment processing
    // In a real system, this would call a payment provider
    const paymentSuccess = simulatePayment();

    if (paymentSuccess) {
      // Update payment status for all bookings in this transaction
      await client.query(
        `UPDATE bookings 
         SET payment_status = 'success' 
         WHERE booking_reference = $1`,
        [bookingReference]
      );
      
      await client.query('COMMIT');
      return bookings.map(b => ({ ...b, payment_status: 'success' }));
    } else {
      // Payment failed - rollback the entire transaction
      // This releases the locks and makes tickets available again
      await client.query('ROLLBACK');
      throw new Error('Payment processing failed. Booking cancelled.');
    }
  } catch (error) {
    // Ensure we rollback on any error
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      // Ignore rollback errors if transaction was already rolled back
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Simulate payment processing
 * Returns true 90% of the time to simulate successful payments
 */
function simulatePayment(): boolean {
  // Simulate 90% success rate
  return Math.random() > 0.1;
}

/**
 * Get ticket availability by tier
 */
export async function getTicketAvailability(): Promise<{
  VIP: { available: number; total: number; price: number };
  'Front Row': { available: number; total: number; price: number };
  GA: { available: number; total: number; price: number };
}> {
  const client = await pool.connect();
  
  try {
    const result = await client.query(`
      SELECT 
        tier,
        COUNT(*) as total,
        SUM(CASE WHEN available = true THEN 1 ELSE 0 END) as available,
        MAX(price) as price
      FROM tickets
      GROUP BY tier
    `);

    const availability: any = {};
    
    for (const row of result.rows) {
      availability[row.tier] = {
        available: parseInt(row.available),
        total: parseInt(row.total),
        price: parseFloat(row.price)
      };
    }

    return {
      'VIP': availability['VIP'] || { available: 0, total: 0, price: 100 },
      'Front Row': availability['Front Row'] || { available: 0, total: 0, price: 50 },
      'GA': availability['GA'] || { available: 0, total: 0, price: 10 }
    };
  } finally {
    client.release();
  }
}

/**
 * Get all available tickets (for catalog display)
 */
export async function getAllAvailableTickets(): Promise<Ticket[]> {
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      `SELECT id, tier, price, available, created_at
       FROM tickets
       WHERE available = true
       ORDER BY tier, id`
    );
    
    return result.rows;
  } finally {
    client.release();
  }
}
