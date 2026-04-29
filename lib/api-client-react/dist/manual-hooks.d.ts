import type { UseQueryOptions, UseQueryResult, QueryKey } from "@tanstack/react-query";
import type { ErrorType } from "./custom-fetch";
export interface TopScorer {
    playerId: string | null;
    playerName: string;
    teamId: string | null;
    teamName: string;
    goals: number;
}
export declare const getGetTournamentTopScorersUrl: (tournamentId: string) => string;
export declare const getTournamentTopScorers: (tournamentId: string, options?: RequestInit) => Promise<TopScorer[]>;
export declare const getGetTournamentTopScorersQueryKey: (tournamentId: string) => readonly [`/api/tournaments/${string}/top-scorers`];
export declare function useGetTournamentTopScorers<TData = TopScorer[], TError = ErrorType<unknown>>(tournamentId: string, options?: {
    query?: UseQueryOptions<TopScorer[], TError, TData>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
//# sourceMappingURL=manual-hooks.d.ts.map