import React from 'react';
import { Percepts } from '../types';
import './KnowledgeBase.css';

interface KnowledgeBaseProps {
  percepts: Percepts;
}

const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({ percepts }) => {
  const getPerceptDescriptions = (): string[] => {
    const descriptions: string[] = [];
    if (percepts.breeze) descriptions.push('You feel a breeze');
    if (percepts.stench) descriptions.push('You smell a stench');
    if (percepts.glitter) descriptions.push('You see a glitter');
    return descriptions;
  };

  return (
    <div className="knowledge-base">
      <h3>Agent's Percepts</h3>
      <div className="percept-list">
        {getPerceptDescriptions().map((description, index) => (
          <div key={index} className="percept-item">
            {description}
          </div>
        ))}
        {getPerceptDescriptions().length === 0 && (
          <div className="percept-item">No percepts detected</div>
        )}
      </div>
    </div>
  );
};

export default KnowledgeBase;
