import React from 'react';

const team = [
  {
    name: 'Noah D Yifter',
    img: '/profile1.jpg', // Will update to correct path if needed
    about: `Noah Yifter is a 15-year-old ninth-grader from Frisco, Texas, whose family heritage traces back to Tigray, Ethiopia. He lives with his brother Nathan and their dog Snowy, and cherishes family memories like their special trip to Cancun. As a freshman, Noah excels in his favorite subject, geometry, and plays basketball while maintaining his fitness through regular gym sessions. What sets him apart from many peers is his genuine fascination with finance—he spends his free time learning about money, investment strategies, and wealth-building principles, showing remarkable financial curiosity for his age.

Known by his friends as funny, nice, and a great conversationalist, Noah balances his Ethiopian heritage with his Texas upbringing while pursuing diverse interests ranging from mathematics to athletics to economics. Though he's uncertain about his specific career path after high school, his analytical mind, social skills, and early interest in financial literacy suggest a promising future. An interesting detail that few people know about Noah is that he's left-handed, adding to his unique character as someone who thoughtfully balances tradition with ambition, academics with athletics, and present enjoyment with future planning.`
  },
  {
    name: 'Nathan Yifter',
    img: '/profile2.jpg', // Will update to correct path if needed
    about: `Nathan Yifter is a 14-year-old high school freshman from Frisco, Texas, who embodies the perfect blend of athletic prowess, academic excellence, and creative passion. Born to Tigrayan parents Meaza and Dawit, Nathan represents a new generation that bridges cultures while pursuing diverse interests with remarkable dedication. As he prepares to enter 9th grade, Nathan has already established himself as a top student with particular excellence in mathematics, setting his sights on three distinct career paths: civil engineering, law, and computer science/AI. His interest in civil engineering stems from his love of building and designing things, his desire to pursue law is driven by a genuine wish to help people, and his fascination with computer science and artificial intelligence reflects his analytical mind and interest in cutting-edge technology. Nathan's athletic abilities are equally impressive, serving as a point guard on his basketball team where his skills as both a facilitator and shooter shine, while also excelling in football and soccer. His artistic side flourishes through three years of violin and five years of piano study, demonstrating his ability to balance multiple demanding activities with remarkable discipline.

Nathan's diverse interests extend beyond academics, athletics, and music into his passion for speed and precision. When not engaged in structured activities, he enjoys playing video games like Minecraft, which aligns perfectly with his interests in building and designing, while also spending quality time with friends at the park. Living with his older brother Noah, his parents, and his beloved dog Snowy, Nathan's Tigrayan heritage provides him with a rich cultural foundation that complements his American upbringing in Texas. As he stands on the threshold of high school, Nathan approaches this new chapter with excitement, particularly looking forward to reconnecting with friends and embracing new challenges. His combination of academic excellence, athletic versatility, musical talent, and genuine desire to help others positions him as a well-rounded young person who represents the best of his generation, ensuring he will make meaningful contributions to whatever field he ultimately chooses to pursue.`
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