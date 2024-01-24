export type MatchItem = {
  date: Date;
  id: string;
  leagueId: number;
  leagueName: string;
  away: {
    id: string;
    name: string;
    score?: number;
  };
  home: {
    id: string;
    name: string;
    score?: number;
  };
  status: {
    utcTime: Date;
    started: boolean;
    cancelled: boolean;
    finished: boolean;
    ongoing: boolean | null;
    scoreStr?: string;
    reason?: {
      short: string;
      shortKey: string;
      long: string;
      longKey: string;
    };
  };
  result: number | null;
  pageUrl: string;
  matchLink: string;
  winner: string;
};

export type MatchData = MatchItem[];

export type LeagueData = {
  overview?: {
    leagueOverviewMatches: MatchItem[];
  };
  details?: {
    name: string;
  };
};

export type AllFixtureData = {
  fixtures: MatchItem[];
  nextMatch: MatchItem | null;
};

export type FixtureData = {
  allFixtures: AllFixtureData;
};

export type TeamDetailData = {
  fixtures: FixtureData;
};
