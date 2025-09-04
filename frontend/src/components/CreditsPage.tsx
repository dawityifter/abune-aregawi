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
    about: 'I’m Dawit Yifter—a husband, father, and longtime software engineer who loves building tools that serve people. At Abune Aregawi Orthodox Tewahedo Church, I help with our digital ministry: the website, secure member registration, and simple ways to stay connected and give. My approach is straightforward: keep technology human, private, and reliable so it strengthens community rather than getting in the way. When I’m not coding, you’ll find me volunteering, learning, or cheering on our kids’ activities. If something on the site can be clearer or easier, please tell me—I’m listening..'
  }
];

const CreditsPage: React.FC = () => {
  const bgStyle: React.CSSProperties = {
    backgroundImage: `url(${process.env.PUBLIC_URL || ''}/bylaws/TigrayOrthodox-background.png)`,
    backgroundRepeat: 'repeat',
    backgroundPosition: 'top left',
    backgroundSize: 'auto',
  };
  return (
    <div className="min-h-screen pt-16 py-12 px-4" style={bgStyle}>
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