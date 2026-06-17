import React from 'react';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function PlayerDashboard({ params }: { params: { id: string } }) {
  const player = await prisma.player.findUnique({
    where: { id: params.id },
    include: {
      ratings: true,
      form: true,
      archetypes: true,
      scoutReport: true,
      venueRatings: true,
      matchups: true,
      auctionScore: true,
    }
  });

  if (!player) {
    return <div className="p-8 text-white">Player not found</div>;
  }

  return (
    <div className="p-8 text-white bg-slate-900 min-h-screen">
      <h1 className="text-3xl font-bold mb-4">{player.name} - Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
          <h2 className="text-xl font-semibold mb-2 text-blue-400">Core Ratings</h2>
          <p>Overall: <span className="font-bold">{player.ratings?.overall ?? 'N/A'}</span></p>
          <p>Base Price: {player.basePrice} L</p>
          <p>Auction Value Score: {player.auctionScore?.score ?? 'N/A'}</p>
        </div>

        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
          <h2 className="text-xl font-semibold mb-2 text-green-400">Dynamic Form</h2>
          <p>Base Rating: {player.form?.baseRating ?? 'N/A'}</p>
          <p>Current Form Modifier: {player.form?.currentForm ?? 0}</p>
          <p className="text-lg mt-2">Adjusted Overall: <span className="font-bold text-yellow-400">{player.form?.currentOverall ?? player.ratings?.overall ?? 'N/A'}</span></p>
        </div>

        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
          <h2 className="text-xl font-semibold mb-2 text-purple-400">Archetypes</h2>
          <ul className="list-disc ml-5">
            {player.archetypes && player.archetypes.length > 0 ? (
              player.archetypes.map(a => <li key={a.id}>{a.name}</li>)
            ) : <li>No Archetypes Assigned</li>}
          </ul>
        </div>

        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
          <h2 className="text-xl font-semibold mb-2 text-red-400">Scouting Report</h2>
          <div className="whitespace-pre-wrap text-sm text-gray-300">
            {player.scoutReport?.generatedText || 'Report not generated yet.'}
          </div>
        </div>
      </div>
    </div>
  );
}
