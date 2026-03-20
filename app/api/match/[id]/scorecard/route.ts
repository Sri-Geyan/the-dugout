import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: matchId } = await params;

    if (!matchId) {
        return NextResponse.json({ error: 'Match ID is required' }, { status: 400 });
    }

    try {
        const match = await prisma.match.findUnique({
            where: { id: matchId },
            include: {
                homeTeam: true,
                awayTeam: true,
                battingStats: {
                    include: {
                        player: {
                            select: { name: true }
                        }
                    },
                    orderBy: { id: 'asc' }
                },
                bowlingStats: {
                    include: {
                        player: {
                            select: { name: true }
                        }
                    },
                    orderBy: { id: 'asc' }
                }
            }
        });

        if (!match) {
            return NextResponse.json({ error: 'Match not found' }, { status: 404 });
        }

        // Organize stats by team
        const homeBatting = match.battingStats.filter(s => s.teamId === match.homeTeamId);
        const awayBatting = match.battingStats.filter(s => s.teamId === match.awayTeamId);
        const homeBowling = match.bowlingStats.filter(s => s.teamId === match.homeTeamId);
        const awayBowling = match.bowlingStats.filter(s => s.teamId === match.awayTeamId);

        return NextResponse.json({
            match: {
                id: match.id,
                homeTeam: match.homeTeam,
                awayTeam: match.awayTeam,
                homeScore: match.homeScore,
                homeWickets: match.homeWickets,
                homeOvers: match.homeOvers,
                awayScore: match.awayScore,
                awayWickets: match.awayWickets,
                awayOvers: match.awayOvers,
                result: match.result,
                pitchType: match.pitchType
            },
            scorecard: {
                homeBatting,
                awayBatting,
                homeBowling,
                awayBowling
            }
        });
    } catch (error) {
        console.error('Scorecard fetch error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
