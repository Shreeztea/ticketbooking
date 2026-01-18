import { useState, useEffect } from 'react';
import { fetchTicketAvailability } from './api';
import TicketCatalog from './components/TicketCatalog';
import BookingForm from './components/BookingForm';
import './App.css';

function App() {
  const [availability, setAvailability] = useState<{
    VIP: { available: number; total: number; price: number };
    'Front Row': { available: number; total: number; price: number };
    GA: { available: number; total: number; price: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);

  // Mock user ID - in a real app, this would come from authentication
  const userId = 'user-' + Math.random().toString(36).substring(2, 11);

  useEffect(() => {
    loadAvailability();
    // Refresh availability every 5 seconds
    const interval = setInterval(loadAvailability, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadAvailability = async () => {
    try {
      setError(null);
      const data = await fetchTicketAvailability();
      setAvailability(data);
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleBookingSuccess = (message: string) => {
    setBookingSuccess(message);
    loadAvailability(); // Refresh availability after booking
    setTimeout(() => setBookingSuccess(null), 5000);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🎵 Concert Ticket Booking</h1>
        <p className="subtitle">Book your tickets for the upcoming concert</p>
      </header>

      <main className="app-main">
        {loading && <div className="loading">Loading ticket availability...</div>}
        
        {error && (
          <div className="error">
            Error: {error}
            <button onClick={loadAvailability} className="retry-button">
              Retry
            </button>
          </div>
        )}

        {bookingSuccess && (
          <div className="success">
            ✅ {bookingSuccess}
          </div>
        )}

        {availability && (
          <>
            <TicketCatalog availability={availability} />
            <BookingForm
              availability={availability}
              userId={userId}
              onBookingSuccess={handleBookingSuccess}
              onError={setError}
            />
          </>
        )}
      </main>

      <footer className="app-footer">
        <p>All prices in USD. Global users welcome!</p>
      </footer>
    </div>
  );
}

export default App;
