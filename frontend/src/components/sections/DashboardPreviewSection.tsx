import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';

const DashboardPreviewSection: React.FC = () => {
  const { t } = useLanguage();
  const { currentUser } = useAuth();

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            {t('member.dashboard')}
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {t('dashboard.description')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Profile Management */}
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mr-4">
                <i className="fas fa-user text-primary-800 text-xl"></i>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">
                {t('profile.management')}
              </h3>
            </div>
            <p className="text-gray-600 mb-4">
              {t('profile.management.description')}
            </p>
            {currentUser ? (
              <Link
                to="/dashboard"
                className="inline-block bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 transition-colors"
              >
                {t('view.dashboard')}
              </Link>
            ) : (
              <Link
                to="/register"
                className="inline-block bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 transition-colors"
              >
                {t('register.member')}
              </Link>
            )}
          </div>

          {/* Dues & Giving */}
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                <i className="fas fa-dollar-sign text-green-800 text-xl"></i>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">
                {t('dues.and.giving')}
              </h3>
            </div>
            <p className="text-gray-600 mb-4">
              {t('dues.and.giving.description')}
            </p>
            {currentUser ? (
              <Link
                to="/dashboard"
                className="inline-block bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
              >
                {t('view.dues')}
              </Link>
            ) : (
              <Link
                to="/login"
                className="inline-block bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
              >
                {t('sign.in')}
              </Link>
            )}
          </div>

          {/* Events & Activities */}
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                <i className="fas fa-calendar text-blue-800 text-xl"></i>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">
                {t('events.and.activities')}
              </h3>
            </div>
            <p className="text-gray-600 mb-4">
              {t('events.and.activities.description')}
            </p>
            {currentUser ? (
              <Link
                to="/dashboard"
                className="inline-block bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                {t('view.events')}
              </Link>
            ) : (
              <Link
                to="/register"
                className="inline-block bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                {t('join.us')}
              </Link>
            )}
          </div>

          {/* Volunteer Opportunities */}
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mr-4">
                <i className="fas fa-hands-helping text-purple-800 text-xl"></i>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">
                {t('volunteer.opportunities')}
              </h3>
            </div>
            <p className="text-gray-600 mb-4">
              {t('volunteer.opportunities.description')}
            </p>
            {currentUser ? (
              <Link
                to="/dashboard"
                className="inline-block bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors"
              >
                {t('volunteer.sign.up')}
              </Link>
            ) : (
              <Link
                to="/register"
                className="inline-block bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors"
              >
                {t('get.involved')}
              </Link>
            )}
          </div>

          {/* Community Connection */}
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mr-4">
                <i className="fas fa-users text-yellow-800 text-xl"></i>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">
                {t('community.connection')}
              </h3>
            </div>
            <p className="text-gray-600 mb-4">
              {t('community.connection.description')}
            </p>
            {currentUser ? (
              <Link
                to="/dashboard"
                className="inline-block bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 transition-colors"
              >
                {t('connect.now')}
              </Link>
            ) : (
              <Link
                to="/register"
                className="inline-block bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 transition-colors"
              >
                {t('join.community')}
              </Link>
            )}
          </div>

          {/* Spiritual Growth */}
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mr-4">
                <i className="fas fa-pray text-indigo-800 text-xl"></i>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">
                {t('spiritual.growth')}
              </h3>
            </div>
            <p className="text-gray-600 mb-4">
              {t('spiritual.growth.description')}
            </p>
            {currentUser ? (
              <Link
                to="/dashboard"
                className="inline-block bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
              >
                {t('grow.together')}
              </Link>
            ) : (
              <Link
                to="/register"
                className="inline-block bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
              >
                {t('start.journey')}
              </Link>
            )}
          </div>
        </div>

        {!currentUser && (
          <div className="text-center mt-12">
            <p className="text-lg text-gray-600 mb-4">
              {t('dashboard.preview.cta')}
            </p>
            <div className="flex justify-center space-x-4">
              <Link
                to="/register"
                className="bg-primary-600 text-white px-6 py-3 rounded-md hover:bg-primary-700 transition-colors font-medium"
              >
                {t('register.member')}
              </Link>
              <Link
                to="/login"
                className="bg-gray-600 text-white px-6 py-3 rounded-md hover:bg-gray-700 transition-colors font-medium"
              >
                {t('sign.in')}
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default DashboardPreviewSection; 