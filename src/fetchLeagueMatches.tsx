import { getPreferenceValues } from "@raycast/api";
import { MatchData, MatchItem, TeamDetailData } from "./types/matchTypes";
import { Preferences } from "./types/preferencesTypes";
import { fetchTeamDetail } from "./fetchTeamDetail";

export type Data = TeamDetailData & {
  calculated: {
    upcomingMatch: MatchItem | null;
    lastMatches: MatchItem[];
    nextMatches: MatchItem[];
  };
};

export async function fetchLeagueMatches(): Promise<MatchData> {
  const prefs = getPreferenceValues<Preferences>();
  const interestedTeams = getInterestedTeams(prefs);
  const startDateOffset = Number(prefs.startDateOffset) || 7;
  const endDateOffset = Number(prefs.endDateOffset) || 30;
  const currentDate = new Date();
  const startDate = new Date();
  startDate.setDate(currentDate.getDate() - startDateOffset);
  const endDate = new Date();
  endDate.setDate(currentDate.getDate() + endDateOffset);
  const allMatches: MatchData = [];

  for (const teamId of interestedTeams) {
    console.log(`Fetching matches for team ${teamId}`);
    const result = await fetchTeamFixture(teamId);

    if (result.data && result.data.calculated) {
      const { previousMatches, nextMatches } = result.data.calculated;

      const teamMatches: MatchItem[] = [];
      if (Array.isArray(previousMatches)) {
        teamMatches.push(...previousMatches);
      }
      if (Array.isArray(nextMatches)) {
        teamMatches.push(...nextMatches);
      }

      const processedMatches = teamMatches
        .filter((match: MatchItem) => isValidMatch(match as MatchItem, startDate, endDate))
        .map((match) => processMatchData(match));
      allMatches.push(...processedMatches);
    }
  }
  return allMatches;
}

function isValidMatch(match: MatchItem, startDate: Date, endDate: Date) {
  const matchDate = new Date(match.status?.utcTime || Date.now());
  return matchDate >= startDate && matchDate <= endDate;
}

function getInterestedTeams(prefs: Preferences): number[] {
  const interestedTeams: number[] = [];

  for (let i = 1; i <= 5; i++) {
    const teamId = Number(prefs[`team${i}` as keyof Preferences]);
    if (teamId && !isNaN(teamId)) {
      interestedTeams.push(teamId);
    }
  }

  return interestedTeams;
}

function processMatchData(match: MatchItem) {
  const isMatchCompleted = match.status?.finished ?? false;
  const winningTeam = isMatchCompleted ? determineWinningTeam(match) : "";

  const date = new Date(match.status?.utcTime ?? new Date());
  const id = match.id;
  const tournament = {
    leagueId: match.tournament?.leagueId,
    name: match.tournament?.name ?? "",
  };
  const leagueId = match.tournament?.leagueId;
  const leagueName = match.tournament?.name;
  const away = {
    id: match.away?.id ?? "",
    name: match.away?.name ?? "",
    score: match.away?.score,
  };
  const home = {
    id: match.home?.id ?? "",
    name: match.home?.name ?? "",
    score: match.home?.score,
  };
  const status = {
    utcTime: match.status?.utcTime ?? new Date(),
    started: match.status?.started ?? false,
    cancelled: match.status?.cancelled ?? false,
    finished: isMatchCompleted,
    ongoing: match.status?.ongoing ?? false,
  };
  const result = match.result;
  const pageUrl = match.pageUrl;
  const matchLink = `https://www.fotmob.com${pageUrl}`;

  return {
    date,
    id,
    leagueId,
    leagueName,
    away,
    home,
    status,
    result,
    pageUrl,
    matchLink,
    tournament,
    winner: winningTeam,
  };
}

function determineWinningTeam(match: MatchItem) {
  const homeScore = match.home?.score ?? 0;
  const awayScore = match.away?.score ?? 0;

  if (homeScore > awayScore) {
    return match.home?.name ?? "";
  } else if (homeScore < awayScore) {
    return match.away?.name ?? "";
  } else if (homeScore === awayScore) {
    return "draw";
  }

  return "";
}

async function fetchTeamFixture(teamId: number) {
  const { data, error, isLoading } = await fetchTeamDetail(teamId);

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
