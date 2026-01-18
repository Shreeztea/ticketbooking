import express, { Request, Response } from 'express';
import { z } from 'zod';
import { createBooking, getTicketAvailability, getAllAvailableTickets } from '../services/bookingService';
import { TicketTier } from '../types';

const router = express.Router();

// Validation schema for booking request
const bookingRequestSchema = z.object({
  tier: z.enum(['VIP', 'Front Row', 'GA']),
  quantity: z.number().int().min(1).max(100),
  userId: z.string().min(1)
});

/**
 * GET /api/tickets/availability
 * Get availability count for each ticket tier
 */
router.get('/availability', async (req: Request, res: Response) => {
  try {
    const availability = await getTicketAvailability();
    res.json(availability);
  } catch (error: any) {
    console.error('Error fetching availability:', error);
    res.status(500).json({ error: 'Failed to fetch ticket availability' });
  }
});

/**
 * GET /api/tickets
 * Get all available tickets (for catalog display)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const tickets = await getAllAvailableTickets();
    res.json(tickets);
  } catch (error: any) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

/**
 * POST /api/bookings
 * Create a new booking
 * 
 * This endpoint handles the critical booking logic with proper concurrency control.
 * See bookingService.ts for detailed explanation of double-booking prevention.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validationResult = bookingRequestSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validationResult.error.errors
      });
    }

    const bookingRequest = validationResult.data;

    // Create booking with proper transaction handling
    const bookings = await createBooking(bookingRequest);

    res.status(201).json({
      success: true,
      bookings,
      message: `Successfully booked ${bookings.length} ticket(s)`
    });
  } catch (error: any) {
    console.error('Booking error:', error);
    
    // Handle specific error cases
    if (error.message.includes('Insufficient tickets')) {
      return res.status(409).json({ error: error.message });
    }
    
    if (error.message.includes('already booked')) {
      return res.status(409).json({ error: error.message });
    }
    
    if (error.message.includes('Payment processing failed')) {
      return res.status(402).json({ error: error.message });
    }

    res.status(500).json({ error: 'Failed to create booking' });
  }
});

export default router;
