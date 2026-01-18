import { TicketTier } from '../types';
import './TicketCatalog.css';

interface TicketCatalogProps {
  availability: {
    VIP: { available: number; total: number; price: number };
    'Front Row': { available: number; total: number; price: number };
    GA: { available: number; total: number; price: number };
  };
}

const TicketCatalog: React.FC<TicketCatalogProps> = ({ availability }) => {
  const tiers: TicketTier[] = ['VIP', 'Front Row', 'GA'];

  return (
    <div className="ticket-catalog">
      <h2>Available Tickets</h2>
      <div className="ticket-grid">
        {tiers.map((tier) => {
          const tierData = availability[tier];
          const isSoldOut = tierData.available === 0;
          
          return (
            <div key={tier} className={`ticket-card ${isSoldOut ? 'sold-out' : ''}`}>
              <div className="ticket-tier">{tier}</div>
              <div className="ticket-price">${tierData.price.toFixed(2)}</div>
              <div className="ticket-availability">
                <span className="available-count">{tierData.available}</span>
                <span className="available-label">available</span>
              </div>
              <div className="ticket-total">
                of {tierData.total} total
              </div>
              {isSoldOut && <div className="sold-out-badge">Sold Out</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TicketCatalog;
