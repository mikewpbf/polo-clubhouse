import { useQuery } from "@tanstack/react-query";
import type { UseQueryOptions, UseQueryResult, QueryKey } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { ErrorType } from "./custom-fetch";

export interface TopScorer {
  playerId: string | null;
  playerName: string;
  teamId: string | null;
  teamName: string;
  goals: number;
}

export const getGetTournamentTopScorersUrl = (tournamentId: string) => {
  return `/api/tournaments/${tournamentId}/top-scorers`;
};

export const getTournamentTopScorers = async (
  tournamentId: string,
  options?: RequestInit,
): Promise<TopScorer[]> => {
  return customFetch<TopScorer[]>(getGetTournamentTopScorersUrl(tournamentId), {
    ...options,
    method: "GET",
  });
};

export const getGetTournamentTopScorersQueryKey = (tournamentId: string) => {
  return [`/api/tournaments/${tournamentId}/top-scorers`] as const;
};

export function useGetTournamentTopScorers<
  TData = TopScorer[],
  TError = ErrorType<unknown>,
>(
  tournamentId: string,
  options?: {
    query?: UseQueryOptions<TopScorer[], TError, TData>;
  },
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const queryKey = options?.query?.queryKey ?? getGetTournamentTopScorersQueryKey(tournamentId);

  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => getTournamentTopScorers(tournamentId, { signal }),
    enabled: !!tournamentId,
    ...options?.query,
  }) as UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return { ...query, queryKey };
}
