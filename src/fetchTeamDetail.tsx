import { useCachedPromise } from "@raycast/utils";
import fetch from "cross-fetch";
import { MatchItem, TeamDetailData } from "./types/matchTypes";

// Extend TeamDetailData
export type Data = TeamDetailData & {
  calculated: {
    upcomingMatch: MatchItem | null;
    lastMatches: MatchItem[];
    nextMatches: MatchItem[];
  };
};

export function fetchTeamDetail(teamId: string) {
  const { data, error, isLoading } = useCachedPromise(
    async (teamId: string): Promise<TeamDetailData> => {
      const url = `https://www.fotmob.com/api/teams?id=${teamId}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch team details");
      }
      const teamDetailData = (await response.json()) as TeamDetailData;
      return teamDetailData;
    },
    [teamId],
    {
      initialData: {},
    },
  );

  return { data, error, isLoading };
}
