import React from 'react';
import { useParams } from 'react-router-dom';

const MatchDetailPage: React.FC = () => {
  const { matchId } = useParams<{ matchId: string }>();

  // TODO: Fetch match details based on matchId

  return (
    <div>
      <h1>Match Details</h1>
      <p>Details for Match ID: {matchId}</p>
      {/* Placeholder for match details */}
    </div>
  );
};

export default MatchDetailPage; 