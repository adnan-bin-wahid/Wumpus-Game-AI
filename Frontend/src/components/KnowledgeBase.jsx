import React from 'react';
import './KnowledgeBase.css';

const KnowledgeBase = ({ percepts }) => {
  const perceptsData = [
    {
      name: 'Breeze',
      active: percepts.breeze,
      icon: '💨',
      description: 'You feel a breeze - there might be a pit nearby'
    },
    {
      name: 'Stench',
      active: percepts.stench,
      icon: '🦨',
      description: 'You smell a stench - the Wumpus could be close'
    },
    {
      name: 'Glitter',
      active: percepts.glitter,
      icon: '✨',
      description: 'You see a glitter - gold is in this room'
    }
  ];

  return (
    <div className="knowledge-base">
      <h2>Agent's Percepts</h2>
      <div className="percepts-grid">
        {perceptsData.map(percept => (
          <div
            key={percept.name}
            className={`percept-card ${percept.active ? 'active' : ''}`}
          >
            <div className="percept-icon">{percept.icon}</div>
            <div className="percept-info">
              <h3>{percept.name}</h3>
              {percept.active && (
                <p className="percept-description">{percept.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KnowledgeBase;
