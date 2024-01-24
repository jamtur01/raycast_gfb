import { MatchItem, TeamDetailData } from "./types/matchTypes";
import { fetchTeamDetail } from "./fetchTeamDetail";

export type Data = TeamDetailData & {
  calculated: {
    upcomingMatch: MatchItem | null;
    lastMatches: MatchItem[];
    nextMatches: MatchItem[];
  };
};

export function fetchTeamFixture(teamId: string) {
  const { data, error, isLoading } = fetchTeamDetail(teamId);

  if (data == null || error != null || isLoading) {
    return {
      data: {
        calculated: {
          upcomingMatch: null,
          ongoingMatch: null,
          previousMatches: [],
          nextMatches: [],
        },
      },
      error,
      isLoading,
    };
  }

  const fixtures = data.fixtures.allFixtures.fixtures;
  const nextMatch = data.fixtures.allFixtures.nextMatch;

  const ongoingMatch: MatchItem | null = nextMatch?.status.ongoing ? nextMatch : null;

  const nextMatchIndex = fixtures.findIndex((fixture) => fixture.id === nextMatch?.id);

  const previousMatches = fixtures.slice(0, nextMatchIndex);
  const nextMatches = (function () {
    if (ongoingMatch) {
      return fixtures.slice(nextMatchIndex + 1, fixtures.length - 1);
    }
    return fixtures.slice(nextMatchIndex, fixtures.length - 1);
  })();

  return {
    data: {
      ...data,
      calculated: {
        upcomingMatch: nextMatch,
        ongoingMatch: ongoingMatch,
        previousMatches: previousMatches,
        nextMatches: nextMatches,
      },
    },
    error,
    isLoading,
  };
}
