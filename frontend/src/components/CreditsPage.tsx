import React from 'react';

const team = [
  {
    name: 'Noah D Yifter',
    img: '/profile1.jpg', // Will update to correct path if needed
    about: `I am still figuring out who I am, but don't worry, God's got a plan! check back soon,`
  },
  {
    name: 'Nathan Yifter',
    img: '/profile2.jpg', // Will update to correct path if needed
    about: `Still being written!`
  },
  {
    name: 'Dawit Yifter',
    img: '/profile3.jpg', // Will update to correct path if needed
    about: 'Coming soon.'
  }
];

const CreditsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">Tech Team / Credits</h1>
        <div className="space-y-10">
          {team.map((member, idx) => (
            <div key={member.name} className="bg-white rounded-lg shadow p-6 flex flex-col md:flex-row items-center gap-6">
              <img
                src={member.img}
                alt={member.name}
                className="w-32 h-32 rounded-full object-cover border-2 border-primary-500"
                style={{ minWidth: 128 }}
              />
              <div>
                <h2 className="text-xl font-semibold mb-2">{member.name}</h2>
                <p className="text-gray-700 whitespace-pre-line">{member.about}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CreditsPage; 