import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';

const Card: React.FC<{ icon: string; title: string; desc: string; to: string; color?: string }>
  = ({ icon, title, desc, to, color = 'primary' }) => {
  const colorMap: Record<string, string> = {
    primary: 'border-primary-200 hover:border-primary-300',
    secondary: 'border-secondary-200 hover:border-secondary-300',
    accent: 'border-accent-200 hover:border-accent-300',
  };
  return (
    <Link to={to} className={`card ${colorMap[color]} h-full`}>
      <div className="flex items-start space-x-4">
        <div className="text-2xl text-primary-700">
          <i className={icon} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-accent-900">{title}</h3>
          <p className="mt-1 text-sm text-accent-700">{desc}</p>
        </div>
      </div>
    </Link>
  );
};

const QuickActions: React.FC = () => {
  const { t, lang } = useI18n();
  return (
    <section className="max-w-7xl mx-auto px-4 py-10">
      <div className={`grid sm:grid-cols-2 lg:grid-cols-3 gap-4 ${lang === 'ti' ? 'text-tigrigna' : ''}`}>
        <Card
          icon="fas fa-church"
          title={t('actions.worship.title')}
          desc={t('actions.worship.desc')}
          to="/" // could anchor to #worship-times
          color="primary"
        />
        <Card
          icon="fas fa-calendar-alt"
          title={t('actions.events.title')}
          desc={t('actions.events.desc')}
          to="/" // placeholder for events page/anchor
          color="accent"
        />
        <Card
          icon="fas fa-heart"
          title={t('actions.give.title')}
          desc={t('actions.give.desc')}
          to="/donate"
          color="secondary"
        />
      </div>
    </section>
  );
};

export default QuickActions;
