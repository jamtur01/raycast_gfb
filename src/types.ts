export type MatchItem = {
  date: Date;
  leagueId: string;
  leagueName: string;
  match: Match;
  matchLink: string;
  winner: string;
};

export type MatchData = MatchItem[];

export type Match = {
  id: string;
  pageUrl: string;
  opponent: {
    id: string;
    name: string;
    score?: number;
  };
  home: {
    id: string;
    name: string;
    score?: number;
  };
  away: {
    id: string;
    name: string;
    score?: number;
  };
  displayTournament: boolean;
  notStarted: boolean;
  tournament: Record<string, unknown>;
  status: {
    utcTime: Date;
    started: boolean;
    cancelled: boolean;
    finished: boolean;
    scoreStr?: string;
    reason?: {
      short: string;
      shortKey: string;
      long: string;
      longKey: string;
    };
  };
};

export type MatchStatus = {
  status: {
    cancelled: boolean;
    finished: boolean;
    started: boolean;
  };
};

export type LeaguePair = Record<string, string>;
