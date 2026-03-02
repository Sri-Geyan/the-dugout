import { create } from 'zustand';

interface UserState {
    userId: string | null;
    username: string | null;
    isLoggedIn: boolean;
    setUser: (userId: string, username: string) => void;
    logout: () => void;
}

export const useUserStore = create<UserState>((set) => ({
    userId: null,
    username: null,
    isLoggedIn: false,
    setUser: (userId, username) => set({ userId, username, isLoggedIn: true }),
    logout: () => set({ userId: null, username: null, isLoggedIn: false }),
}));

interface RoomState {
    currentRoom: {
        code: string;
        hostId: string;
        status: string;
        players: { userId: string; username: string; teamName?: string }[];
    } | null;
    setRoom: (room: RoomState['currentRoom']) => void;
    clearRoom: () => void;
    updatePlayers: (players: RoomState['currentRoom'] extends null ? never : NonNullable<RoomState['currentRoom']>['players']) => void;
}

export const useRoomStore = create<RoomState>((set) => ({
    currentRoom: null,
    setRoom: (room) => set({ currentRoom: room }),
    clearRoom: () => set({ currentRoom: null }),
    updatePlayers: (players) => set((state) => ({
        currentRoom: state.currentRoom ? { ...state.currentRoom, players } : null,
    })),
}));

interface AuctionUIState {
    currentPlayer: { name: string; role: string; basePrice: number; battingSkill: number; bowlingSkill: number } | null;
    currentBid: number;
    currentBidder: { username: string; teamName: string } | null;
    timerEnd: number | null;
    teams: {
        userId: string;
        username: string;
        teamName: string;
        purse: number;
        squadSize: number;
    }[];
    soldPlayers: { playerName: string; soldTo: string; price: number }[];
    status: string;
    setAuctionState: (state: Partial<AuctionUIState>) => void;
    reset: () => void;
}

export const useAuctionStore = create<AuctionUIState>((set) => ({
    currentPlayer: null,
    currentBid: 0,
    currentBidder: null,
    timerEnd: null,
    teams: [],
    soldPlayers: [],
    status: 'idle',
    setAuctionState: (newState) => set((prev) => ({ ...prev, ...newState })),
    reset: () => set({
        currentPlayer: null, currentBid: 0, currentBidder: null,
        timerEnd: null, teams: [], soldPlayers: [], status: 'idle',
    }),
}));

interface MatchUIState {
    matchId: string | null;
    homeTeam: { name: string; score: number; wickets: number; overs: number; balls: number; runRate: number } | null;
    awayTeam: { name: string; score: number; wickets: number; overs: number; balls: number; runRate: number } | null;
    innings: number;
    status: string;
    target: number | null;
    striker: { name: string; runs: number; balls: number; fours: number; sixes: number } | null;
    nonStriker: { name: string; runs: number; balls: number } | null;
    bowler: { name: string; overs: number; runs: number; wickets: number; economy: number } | null;
    commentary: string[];
    result: string | null;
    matchPhase: string;
    setMatchState: (state: Partial<MatchUIState>) => void;
    reset: () => void;
}

export const useMatchStore = create<MatchUIState>((set) => ({
    matchId: null,
    homeTeam: null, awayTeam: null,
    innings: 1, status: 'scheduled', target: null,
    striker: null, nonStriker: null, bowler: null,
    commentary: [], result: null, matchPhase: 'powerplay',
    setMatchState: (newState) => set((prev) => ({ ...prev, ...newState })),
    reset: () => set({
        matchId: null, homeTeam: null, awayTeam: null,
        innings: 1, status: 'scheduled', target: null,
        striker: null, nonStriker: null, bowler: null,
        commentary: [], result: null, matchPhase: 'powerplay',
    }),
}));
