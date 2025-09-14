import React from 'react';
import { Link } from 'react-router-dom';

type CardProps = { icon: string; title: string; desc: React.ReactNode; to?: string; external?: boolean };
const Card: React.FC<CardProps>
  = ({ icon, title, desc, to, external }) => {
  const content = (
    <div className="card h-full border-accent-200 hover:border-accent-300">
      <div className="flex items-start space-x-4">
        <div className="text-2xl text-primary-700">
          <i className={icon} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-accent-900">{title}</h3>
          <div className="mt-1 text-sm text-accent-700 leading-relaxed">{desc}</div>
        </div>
      </div>
    </div>
  );
  if (to && external) {
    return (
      <a href={to} target="_blank" rel="noreferrer" className="block">{content}</a>
    );
  }
  if (to) {
    return (
      <Link to={to} className="block">{content}</Link>
    );
  }
  return content;
};

const QuickLinks: React.FC = () => {
  return (
    <section className="max-w-7xl mx-auto px-4 py-8">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card
          icon="fas fa-church"
          title="Priest"
          desc={(
            <>
              <div>
                <strong>Priest:</strong> መልኣከ ፀሃይ Mel’Ake Tsehay keshi Tadesse
              </div>
              <div>Our Church Father</div>
            </>
          )}
          to="#priest"
        />
        <Card
          icon="fas fa-clock"
          title="Service Times"
          desc={(
            <>
              <div><strong>Morning Prayers:</strong> 6:00 AM</div>
              <div><strong>Divine Liturgy:</strong> 8:30 AM</div>
            </>
          )}
          to="#worship-times"
        />
        <Card
          icon="fas fa-map-marker"
          title="Location"
          desc={(
            <>
              <div className="font-semibold">1621 S Jupiter Rd, Garland, TX 75042</div>
              <a
                href="https://maps.google.com/?q=1621+S+Jupiter+Rd,+Garland,+TX+75042"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 mt-3 text-amber-500 hover:text-amber-600"
              >
                <i className="fas fa-diamond-turn-right text-lg" />
                <span className="font-medium">Get Directions</span>
              </a>
            </>
          )}
        />
      </div>
    </section>
  );
};

export default QuickLinks;
