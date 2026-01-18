export type TicketTier = 'VIP' | 'Front Row' | 'GA';

export interface Ticket {
  id: number;
  tier: TicketTier;
  price: number;
  available: boolean;
  created_at: string;
}

export interface TicketAvailability {
  tier: TicketTier;
  available: number;
  total: number;
  price: number;
}

export interface BookingRequest {
  tier: TicketTier;
  quantity: number;
  userId: string;
}

export interface Booking {
  id: number;
  ticket_id: number;
  user_id: string;
  quantity: number;
  total_price: number;
  payment_status: 'pending' | 'success' | 'failed';
  booking_reference: string | null;
  created_at: string;
}

export interface BookingResponse {
  success: boolean;
  bookings: Booking[];
  message: string;
}
