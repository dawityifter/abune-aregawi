import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-800 text-white py-12">
      <div className="container mx-auto px-4 text-center">
        <p>&copy; 2024 Debre Tsehay Abune Aregawi Tigray Orthodox Tewahedo Church. All rights reserved.</p>
        <p className="mt-2 text-gray-400">1621 S Jupiter Rd, Garland, TX 75042</p>
        <p className="mt-4">
          <a href="/credits" className="text-blue-300 hover:underline">Tech Team / Credits</a>
        </p>
      </div>
    </footer>
  );
};

export default Footer; 