import { useState } from 'react';
import { TicketTier } from '../types';
import { createBooking } from '../api';
import './BookingForm.css';

interface BookingFormProps {
  availability: {
    VIP: { available: number; total: number; price: number };
    'Front Row': { available: number; total: number; price: number };
    GA: { available: number; total: number; price: number };
  };
  userId: string;
  onBookingSuccess: (message: string) => void;
  onError: (error: string) => void;
}

const BookingForm: React.FC<BookingFormProps> = ({
  availability,
  userId,
  onBookingSuccess,
  onError,
}) => {
  const [selectedTier, setSelectedTier] = useState<TicketTier>('GA');
  const [quantity, setQuantity] = useState<number>(1);
  const [loading, setLoading] = useState(false);

  const selectedTierData = availability[selectedTier];
  const maxQuantity = selectedTierData.available;
  const totalPrice = selectedTierData.price * quantity;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (quantity > maxQuantity) {
      onError(`Only ${maxQuantity} tickets available for ${selectedTier}`);
      return;
    }

    if (quantity < 1) {
      onError('Quantity must be at least 1');
      return;
    }

    setLoading(true);
    try {
      const response = await createBooking({
        tier: selectedTier,
        quantity,
        userId,
      });

      onBookingSuccess(
        `Successfully booked ${response.bookings.length} ${selectedTier} ticket(s)! Total: $${totalPrice.toFixed(2)}`
      );

      // Reset form
      setQuantity(1);
    } catch (err: any) {
      onError(err.message || 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="booking-form-container">
      <h2>Book Tickets</h2>
      <form onSubmit={handleSubmit} className="booking-form">
        <div className="form-group">
          <label htmlFor="tier">Ticket Tier</label>
          <select
            id="tier"
            value={selectedTier}
            onChange={(e) => {
              setSelectedTier(e.target.value as TicketTier);
              setQuantity(1); // Reset quantity when tier changes
            }}
            className="form-select"
          >
            <option value="VIP" disabled={availability.VIP.available === 0}>
              VIP - ${availability.VIP.price.toFixed(2)} ({availability.VIP.available} available)
            </option>
            <option
              value="Front Row"
              disabled={availability['Front Row'].available === 0}
            >
              Front Row - ${availability['Front Row'].price.toFixed(2)} (
              {availability['Front Row'].available} available)
            </option>
            <option value="GA" disabled={availability.GA.available === 0}>
              GA - ${availability.GA.price.toFixed(2)} ({availability.GA.available}{' '}
              available)
            </option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="quantity">Quantity</label>
          <input
            id="quantity"
            type="number"
            min="1"
            max={maxQuantity}
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
            className="form-input"
            disabled={maxQuantity === 0 || loading}
          />
          <span className="form-hint">
            Maximum: {maxQuantity} available
          </span>
        </div>

        <div className="form-summary">
          <div className="summary-row">
            <span>Price per ticket:</span>
            <span>${selectedTierData.price.toFixed(2)}</span>
          </div>
          <div className="summary-row">
            <span>Quantity:</span>
            <span>{quantity}</span>
          </div>
          <div className="summary-row total">
            <span>Total:</span>
            <span>${totalPrice.toFixed(2)}</span>
          </div>
        </div>

        <button
          type="submit"
          className="submit-button"
          disabled={maxQuantity === 0 || loading || quantity < 1}
        >
          {loading ? 'Processing...' : 'Book Tickets'}
        </button>
      </form>
    </div>
  );
};

export default BookingForm;
