import { Ticket, TicketAvailability, BookingRequest, BookingResponse } from './types';

const API_BASE_URL = '/api';

export async function fetchTicketAvailability(): Promise<{
  VIP: { available: number; total: number; price: number };
  'Front Row': { available: number; total: number; price: number };
  GA: { available: number; total: number; price: number };
}> {
  const response = await fetch(`${API_BASE_URL}/tickets/availability`);
  if (!response.ok) {
    throw new Error('Failed to fetch ticket availability');
  }
  return response.json();
}

export async function fetchTickets(): Promise<Ticket[]> {
  const response = await fetch(`${API_BASE_URL}/tickets`);
  if (!response.ok) {
    throw new Error('Failed to fetch tickets');
  }
  return response.json();
}

export async function createBooking(request: BookingRequest): Promise<BookingResponse> {
  const response = await fetch(`${API_BASE_URL}/bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create booking');
  }

  return response.json();
}
