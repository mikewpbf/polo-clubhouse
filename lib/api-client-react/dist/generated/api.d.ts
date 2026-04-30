import type { QueryKey, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from "@tanstack/react-query";
import type { AcceptInviteRequest, AddTournamentTeamRequest, AdminDashboard, AssignTeamManagerRequest, AuthResponse, Club, ClubDetail, ClubMembership, CreateClubMembershipRequest, CreateClubRequest, CreateFieldRequest, CreateHorseRequest, CreatePlayDateRequest, CreatePlayerRequest, CreateTeamOutDateRequest, CreateTeamRequest, CreateTournamentRequest, Field, GenerateScheduleResponse, GetAdminDashboardParams, GetMyTeamScheduleParams, GoogleAuthRequest, HealthStatus, Horse, InviteDetail, ListAllTournamentsParams, ListClubMembershipsParams, ListClubsParams, ListMatchesParams, ListPlayersParams, ListTeamsParams, ListTodayMatchesParams, ListTopPlayersParams, ListTournamentsParams, ListUpcomingMatchesParams, LoginRequest, MatchDetail, MatchEvent, MatchWithTeams, MessageResponse, MyTeamAssignment, PlayDate, Player, PlayerProfile, PlayerSummary, RecommendFormatRequest, RecommendFormatResponse, SelfEditPlayerRequest, SignupRequest, StandingsEntry, Team, TeamDetail, TeamManagerAssignment, TeamManagerDashboard, TeamOutDate, Tournament, TournamentDetail, TournamentTeamWithDetails, TournamentWithClub, UpdateClockRequest, UpdateClubRequest, UpdateFieldRequest, UpdateMatchRequest, UpdateMatchStatusRequest, UpdatePlayDateRequest, UpdatePlayerRequest, UpdateScoreRequest, UpdateTeamRequest, UpdateTournamentRequest, UpdateTournamentTeamRequest, UserWithRoles, WidgetFixtures } from "./api.schemas";
import { customFetch } from "../custom-fetch";
import type { ErrorType, BodyType } from "../custom-fetch";
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
/**
 * @summary Health check
 */
export declare const getHealthCheckUrl: () => string;
export declare const healthCheck: (options?: RequestInit) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: QueryKey;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
/**
 * @summary Health check
 */
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Register a new user
 */
export declare const getSignupUrl: () => string;
export declare const signup: (signupRequest: SignupRequest, options?: RequestInit) => Promise<AuthResponse>;
export declare const getSignupMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof signup>>, TError, {
        data: BodyType<SignupRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof signup>>, TError, {
    data: BodyType<SignupRequest>;
}, TContext>;
export type SignupMutationResult = NonNullable<Awaited<ReturnType<typeof signup>>>;
export type SignupMutationBody = BodyType<SignupRequest>;
export type SignupMutationError = ErrorType<unknown>;
/**
 * @summary Register a new user
 */
export declare const useSignup: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof signup>>, TError, {
        data: BodyType<SignupRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof signup>>, TError, {
    data: BodyType<SignupRequest>;
}, TContext>;
/**
 * @summary Log in
 */
export declare const getLoginUrl: () => string;
export declare const login: (loginRequest: LoginRequest, options?: RequestInit) => Promise<AuthResponse>;
export declare const getLoginMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof login>>, TError, {
        data: BodyType<LoginRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof login>>, TError, {
    data: BodyType<LoginRequest>;
}, TContext>;
export type LoginMutationResult = NonNullable<Awaited<ReturnType<typeof login>>>;
export type LoginMutationBody = BodyType<LoginRequest>;
export type LoginMutationError = ErrorType<unknown>;
/**
 * @summary Log in
 */
export declare const useLogin: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof login>>, TError, {
        data: BodyType<LoginRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof login>>, TError, {
    data: BodyType<LoginRequest>;
}, TContext>;
/**
 * @summary Sign in or sign up with a Google ID token
 */
export declare const getGoogleAuthUrl: () => string;
export declare const googleAuth: (googleAuthRequest: GoogleAuthRequest, options?: RequestInit) => Promise<AuthResponse>;
export declare const getGoogleAuthMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof googleAuth>>, TError, {
        data: BodyType<GoogleAuthRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof googleAuth>>, TError, {
    data: BodyType<GoogleAuthRequest>;
}, TContext>;
export type GoogleAuthMutationResult = NonNullable<Awaited<ReturnType<typeof googleAuth>>>;
export type GoogleAuthMutationBody = BodyType<GoogleAuthRequest>;
export type GoogleAuthMutationError = ErrorType<unknown>;
/**
 * @summary Sign in or sign up with a Google ID token
 */
export declare const useGoogleAuth: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof googleAuth>>, TError, {
        data: BodyType<GoogleAuthRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof googleAuth>>, TError, {
    data: BodyType<GoogleAuthRequest>;
}, TContext>;
/**
 * @summary Log out
 */
export declare const getLogoutUrl: () => string;
export declare const logout: (options?: RequestInit) => Promise<MessageResponse>;
export declare const getLogoutMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof logout>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof logout>>, TError, void, TContext>;
export type LogoutMutationResult = NonNullable<Awaited<ReturnType<typeof logout>>>;
export type LogoutMutationError = ErrorType<unknown>;
/**
 * @summary Log out
 */
export declare const useLogout: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof logout>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof logout>>, TError, void, TContext>;
/**
 * @summary Get current user
 */
export declare const getGetMeUrl: () => string;
export declare const getMe: (options?: RequestInit) => Promise<UserWithRoles>;
export declare const getGetMeQueryKey: () => readonly ["/api/auth/me"];
export declare const getGetMeQueryOptions: <TData = Awaited<ReturnType<typeof getMe>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMe>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getMe>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetMeQueryResult = NonNullable<Awaited<ReturnType<typeof getMe>>>;
export type GetMeQueryError = ErrorType<unknown>;
/**
 * @summary Get current user
 */
export declare function useGetMe<TData = Awaited<ReturnType<typeof getMe>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMe>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary List all clubs
 */
export declare const getListClubsUrl: (params?: ListClubsParams) => string;
export declare const listClubs: (params?: ListClubsParams, options?: RequestInit) => Promise<Club[]>;
export declare const getListClubsQueryKey: (params?: ListClubsParams) => readonly ["/api/clubs", ...ListClubsParams[]];
export declare const getListClubsQueryOptions: <TData = Awaited<ReturnType<typeof listClubs>>, TError = ErrorType<unknown>>(params?: ListClubsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listClubs>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listClubs>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListClubsQueryResult = NonNullable<Awaited<ReturnType<typeof listClubs>>>;
export type ListClubsQueryError = ErrorType<unknown>;
/**
 * @summary List all clubs
 */
export declare function useListClubs<TData = Awaited<ReturnType<typeof listClubs>>, TError = ErrorType<unknown>>(params?: ListClubsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listClubs>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create a club
 */
export declare const getCreateClubUrl: () => string;
export declare const createClub: (createClubRequest: CreateClubRequest, options?: RequestInit) => Promise<Club>;
export declare const getCreateClubMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createClub>>, TError, {
        data: BodyType<CreateClubRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createClub>>, TError, {
    data: BodyType<CreateClubRequest>;
}, TContext>;
export type CreateClubMutationResult = NonNullable<Awaited<ReturnType<typeof createClub>>>;
export type CreateClubMutationBody = BodyType<CreateClubRequest>;
export type CreateClubMutationError = ErrorType<unknown>;
/**
 * @summary Create a club
 */
export declare const useCreateClub: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createClub>>, TError, {
        data: BodyType<CreateClubRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createClub>>, TError, {
    data: BodyType<CreateClubRequest>;
}, TContext>;
/**
 * @summary Get club by slug
 */
export declare const getGetClubBySlugUrl: (slug: string) => string;
export declare const getClubBySlug: (slug: string, options?: RequestInit) => Promise<ClubDetail>;
export declare const getGetClubBySlugQueryKey: (slug: string) => readonly [`/api/clubs/${string}`];
export declare const getGetClubBySlugQueryOptions: <TData = Awaited<ReturnType<typeof getClubBySlug>>, TError = ErrorType<unknown>>(slug: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getClubBySlug>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getClubBySlug>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetClubBySlugQueryResult = NonNullable<Awaited<ReturnType<typeof getClubBySlug>>>;
export type GetClubBySlugQueryError = ErrorType<unknown>;
/**
 * @summary Get club by slug
 */
export declare function useGetClubBySlug<TData = Awaited<ReturnType<typeof getClubBySlug>>, TError = ErrorType<unknown>>(slug: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getClubBySlug>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Update club
 */
export declare const getUpdateClubUrl: (clubId: string) => string;
export declare const updateClub: (clubId: string, updateClubRequest: UpdateClubRequest, options?: RequestInit) => Promise<Club>;
export declare const getUpdateClubMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateClub>>, TError, {
        clubId: string;
        data: BodyType<UpdateClubRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateClub>>, TError, {
    clubId: string;
    data: BodyType<UpdateClubRequest>;
}, TContext>;
export type UpdateClubMutationResult = NonNullable<Awaited<ReturnType<typeof updateClub>>>;
export type UpdateClubMutationBody = BodyType<UpdateClubRequest>;
export type UpdateClubMutationError = ErrorType<unknown>;
/**
 * @summary Update club
 */
export declare const useUpdateClub: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateClub>>, TError, {
        clubId: string;
        data: BodyType<UpdateClubRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateClub>>, TError, {
    clubId: string;
    data: BodyType<UpdateClubRequest>;
}, TContext>;
/**
 * @summary Follow a club
 */
export declare const getFollowClubUrl: (clubId: string) => string;
export declare const followClub: (clubId: string, options?: RequestInit) => Promise<MessageResponse>;
export declare const getFollowClubMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof followClub>>, TError, {
        clubId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof followClub>>, TError, {
    clubId: string;
}, TContext>;
export type FollowClubMutationResult = NonNullable<Awaited<ReturnType<typeof followClub>>>;
export type FollowClubMutationError = ErrorType<unknown>;
/**
 * @summary Follow a club
 */
export declare const useFollowClub: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof followClub>>, TError, {
        clubId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof followClub>>, TError, {
    clubId: string;
}, TContext>;
/**
 * @summary Unfollow a club
 */
export declare const getUnfollowClubUrl: (clubId: string) => string;
export declare const unfollowClub: (clubId: string, options?: RequestInit) => Promise<MessageResponse>;
export declare const getUnfollowClubMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof unfollowClub>>, TError, {
        clubId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof unfollowClub>>, TError, {
    clubId: string;
}, TContext>;
export type UnfollowClubMutationResult = NonNullable<Awaited<ReturnType<typeof unfollowClub>>>;
export type UnfollowClubMutationError = ErrorType<unknown>;
/**
 * @summary Unfollow a club
 */
export declare const useUnfollowClub: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof unfollowClub>>, TError, {
        clubId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof unfollowClub>>, TError, {
    clubId: string;
}, TContext>;
/**
 * @summary List club fields
 */
export declare const getListFieldsUrl: (clubId: string) => string;
export declare const listFields: (clubId: string, options?: RequestInit) => Promise<Field[]>;
export declare const getListFieldsQueryKey: (clubId: string) => readonly [`/api/clubs/${string}/fields`];
export declare const getListFieldsQueryOptions: <TData = Awaited<ReturnType<typeof listFields>>, TError = ErrorType<unknown>>(clubId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listFields>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listFields>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListFieldsQueryResult = NonNullable<Awaited<ReturnType<typeof listFields>>>;
export type ListFieldsQueryError = ErrorType<unknown>;
/**
 * @summary List club fields
 */
export declare function useListFields<TData = Awaited<ReturnType<typeof listFields>>, TError = ErrorType<unknown>>(clubId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listFields>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create a field
 */
export declare const getCreateFieldUrl: (clubId: string) => string;
export declare const createField: (clubId: string, createFieldRequest: CreateFieldRequest, options?: RequestInit) => Promise<Field>;
export declare const getCreateFieldMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createField>>, TError, {
        clubId: string;
        data: BodyType<CreateFieldRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createField>>, TError, {
    clubId: string;
    data: BodyType<CreateFieldRequest>;
}, TContext>;
export type CreateFieldMutationResult = NonNullable<Awaited<ReturnType<typeof createField>>>;
export type CreateFieldMutationBody = BodyType<CreateFieldRequest>;
export type CreateFieldMutationError = ErrorType<unknown>;
/**
 * @summary Create a field
 */
export declare const useCreateField: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createField>>, TError, {
        clubId: string;
        data: BodyType<CreateFieldRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createField>>, TError, {
    clubId: string;
    data: BodyType<CreateFieldRequest>;
}, TContext>;
/**
 * @summary Update a field
 */
export declare const getUpdateFieldUrl: (fieldId: string) => string;
export declare const updateField: (fieldId: string, updateFieldRequest: UpdateFieldRequest, options?: RequestInit) => Promise<Field>;
export declare const getUpdateFieldMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateField>>, TError, {
        fieldId: string;
        data: BodyType<UpdateFieldRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateField>>, TError, {
    fieldId: string;
    data: BodyType<UpdateFieldRequest>;
}, TContext>;
export type UpdateFieldMutationResult = NonNullable<Awaited<ReturnType<typeof updateField>>>;
export type UpdateFieldMutationBody = BodyType<UpdateFieldRequest>;
export type UpdateFieldMutationError = ErrorType<unknown>;
/**
 * @summary Update a field
 */
export declare const useUpdateField: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateField>>, TError, {
        fieldId: string;
        data: BodyType<UpdateFieldRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateField>>, TError, {
    fieldId: string;
    data: BodyType<UpdateFieldRequest>;
}, TContext>;
/**
 * @summary Delete a field
 */
export declare const getDeleteFieldUrl: (fieldId: string) => string;
export declare const deleteField: (fieldId: string, options?: RequestInit) => Promise<MessageResponse>;
export declare const getDeleteFieldMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteField>>, TError, {
        fieldId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteField>>, TError, {
    fieldId: string;
}, TContext>;
export type DeleteFieldMutationResult = NonNullable<Awaited<ReturnType<typeof deleteField>>>;
export type DeleteFieldMutationError = ErrorType<unknown>;
/**
 * @summary Delete a field
 */
export declare const useDeleteField: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteField>>, TError, {
        fieldId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteField>>, TError, {
    fieldId: string;
}, TContext>;
/**
 * @summary List club teams
 */
export declare const getListTeamsUrl: (clubId: string, params?: ListTeamsParams) => string;
export declare const listTeams: (clubId: string, params?: ListTeamsParams, options?: RequestInit) => Promise<Team[]>;
export declare const getListTeamsQueryKey: (clubId: string, params?: ListTeamsParams) => readonly [`/api/clubs/${string}/teams`, ...ListTeamsParams[]];
export declare const getListTeamsQueryOptions: <TData = Awaited<ReturnType<typeof listTeams>>, TError = ErrorType<unknown>>(clubId: string, params?: ListTeamsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listTeams>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listTeams>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListTeamsQueryResult = NonNullable<Awaited<ReturnType<typeof listTeams>>>;
export type ListTeamsQueryError = ErrorType<unknown>;
/**
 * @summary List club teams
 */
export declare function useListTeams<TData = Awaited<ReturnType<typeof listTeams>>, TError = ErrorType<unknown>>(clubId: string, params?: ListTeamsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listTeams>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create a team
 */
export declare const getCreateTeamUrl: (clubId: string) => string;
export declare const createTeam: (clubId: string, createTeamRequest: CreateTeamRequest, options?: RequestInit) => Promise<Team>;
export declare const getCreateTeamMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createTeam>>, TError, {
        clubId: string;
        data: BodyType<CreateTeamRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createTeam>>, TError, {
    clubId: string;
    data: BodyType<CreateTeamRequest>;
}, TContext>;
export type CreateTeamMutationResult = NonNullable<Awaited<ReturnType<typeof createTeam>>>;
export type CreateTeamMutationBody = BodyType<CreateTeamRequest>;
export type CreateTeamMutationError = ErrorType<unknown>;
/**
 * @summary Create a team
 */
export declare const useCreateTeam: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createTeam>>, TError, {
        clubId: string;
        data: BodyType<CreateTeamRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createTeam>>, TError, {
    clubId: string;
    data: BodyType<CreateTeamRequest>;
}, TContext>;
/**
 * @summary Get team details
 */
export declare const getGetTeamUrl: (teamId: string) => string;
export declare const getTeam: (teamId: string, options?: RequestInit) => Promise<TeamDetail>;
export declare const getGetTeamQueryKey: (teamId: string) => readonly [`/api/teams/${string}`];
export declare const getGetTeamQueryOptions: <TData = Awaited<ReturnType<typeof getTeam>>, TError = ErrorType<unknown>>(teamId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getTeam>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getTeam>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetTeamQueryResult = NonNullable<Awaited<ReturnType<typeof getTeam>>>;
export type GetTeamQueryError = ErrorType<unknown>;
/**
 * @summary Get team details
 */
export declare function useGetTeam<TData = Awaited<ReturnType<typeof getTeam>>, TError = ErrorType<unknown>>(teamId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getTeam>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Update a team
 */
export declare const getUpdateTeamUrl: (teamId: string) => string;
export declare const updateTeam: (teamId: string, updateTeamRequest: UpdateTeamRequest, options?: RequestInit) => Promise<Team>;
export declare const getUpdateTeamMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateTeam>>, TError, {
        teamId: string;
        data: BodyType<UpdateTeamRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateTeam>>, TError, {
    teamId: string;
    data: BodyType<UpdateTeamRequest>;
}, TContext>;
export type UpdateTeamMutationResult = NonNullable<Awaited<ReturnType<typeof updateTeam>>>;
export type UpdateTeamMutationBody = BodyType<UpdateTeamRequest>;
export type UpdateTeamMutationError = ErrorType<unknown>;
/**
 * @summary Update a team
 */
export declare const useUpdateTeam: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateTeam>>, TError, {
        teamId: string;
        data: BodyType<UpdateTeamRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateTeam>>, TError, {
    teamId: string;
    data: BodyType<UpdateTeamRequest>;
}, TContext>;
/**
 * @summary List tournaments
 */
export declare const getListTournamentsUrl: (clubId: string, params?: ListTournamentsParams) => string;
export declare const listTournaments: (clubId: string, params?: ListTournamentsParams, options?: RequestInit) => Promise<Tournament[]>;
export declare const getListTournamentsQueryKey: (clubId: string, params?: ListTournamentsParams) => readonly [`/api/clubs/${string}/tournaments`, ...ListTournamentsParams[]];
export declare const getListTournamentsQueryOptions: <TData = Awaited<ReturnType<typeof listTournaments>>, TError = ErrorType<unknown>>(clubId: string, params?: ListTournamentsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listTournaments>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listTournaments>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListTournamentsQueryResult = NonNullable<Awaited<ReturnType<typeof listTournaments>>>;
export type ListTournamentsQueryError = ErrorType<unknown>;
/**
 * @summary List tournaments
 */
export declare function useListTournaments<TData = Awaited<ReturnType<typeof listTournaments>>, TError = ErrorType<unknown>>(clubId: string, params?: ListTournamentsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listTournaments>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create a tournament
 */
export declare const getCreateTournamentUrl: (clubId: string) => string;
export declare const createTournament: (clubId: string, createTournamentRequest: CreateTournamentRequest, options?: RequestInit) => Promise<Tournament>;
export declare const getCreateTournamentMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createTournament>>, TError, {
        clubId: string;
        data: BodyType<CreateTournamentRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createTournament>>, TError, {
    clubId: string;
    data: BodyType<CreateTournamentRequest>;
}, TContext>;
export type CreateTournamentMutationResult = NonNullable<Awaited<ReturnType<typeof createTournament>>>;
export type CreateTournamentMutationBody = BodyType<CreateTournamentRequest>;
export type CreateTournamentMutationError = ErrorType<unknown>;
/**
 * @summary Create a tournament
 */
export declare const useCreateTournament: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createTournament>>, TError, {
        clubId: string;
        data: BodyType<CreateTournamentRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createTournament>>, TError, {
    clubId: string;
    data: BodyType<CreateTournamentRequest>;
}, TContext>;
/**
 * @summary List all public tournaments
 */
export declare const getListAllTournamentsUrl: (params?: ListAllTournamentsParams) => string;
export declare const listAllTournaments: (params?: ListAllTournamentsParams, options?: RequestInit) => Promise<TournamentWithClub[]>;
export declare const getListAllTournamentsQueryKey: (params?: ListAllTournamentsParams) => readonly ["/api/tournaments", ...ListAllTournamentsParams[]];
export declare const getListAllTournamentsQueryOptions: <TData = Awaited<ReturnType<typeof listAllTournaments>>, TError = ErrorType<unknown>>(params?: ListAllTournamentsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listAllTournaments>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listAllTournaments>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListAllTournamentsQueryResult = NonNullable<Awaited<ReturnType<typeof listAllTournaments>>>;
export type ListAllTournamentsQueryError = ErrorType<unknown>;
/**
 * @summary List all public tournaments
 */
export declare function useListAllTournaments<TData = Awaited<ReturnType<typeof listAllTournaments>>, TError = ErrorType<unknown>>(params?: ListAllTournamentsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listAllTournaments>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Get tournament details
 */
export declare const getGetTournamentUrl: (tournamentId: string) => string;
export declare const getTournament: (tournamentId: string, options?: RequestInit) => Promise<TournamentDetail>;
export declare const getGetTournamentQueryKey: (tournamentId: string) => readonly [`/api/tournaments/${string}`];
export declare const getGetTournamentQueryOptions: <TData = Awaited<ReturnType<typeof getTournament>>, TError = ErrorType<unknown>>(tournamentId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getTournament>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getTournament>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetTournamentQueryResult = NonNullable<Awaited<ReturnType<typeof getTournament>>>;
export type GetTournamentQueryError = ErrorType<unknown>;
/**
 * @summary Get tournament details
 */
export declare function useGetTournament<TData = Awaited<ReturnType<typeof getTournament>>, TError = ErrorType<unknown>>(tournamentId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getTournament>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Update a tournament
 */
export declare const getUpdateTournamentUrl: (tournamentId: string) => string;
export declare const updateTournament: (tournamentId: string, updateTournamentRequest: UpdateTournamentRequest, options?: RequestInit) => Promise<Tournament>;
export declare const getUpdateTournamentMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateTournament>>, TError, {
        tournamentId: string;
        data: BodyType<UpdateTournamentRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateTournament>>, TError, {
    tournamentId: string;
    data: BodyType<UpdateTournamentRequest>;
}, TContext>;
export type UpdateTournamentMutationResult = NonNullable<Awaited<ReturnType<typeof updateTournament>>>;
export type UpdateTournamentMutationBody = BodyType<UpdateTournamentRequest>;
export type UpdateTournamentMutationError = ErrorType<unknown>;
/**
 * @summary Update a tournament
 */
export declare const useUpdateTournament: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateTournament>>, TError, {
        tournamentId: string;
        data: BodyType<UpdateTournamentRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateTournament>>, TError, {
    tournamentId: string;
    data: BodyType<UpdateTournamentRequest>;
}, TContext>;
/**
 * @summary List tournament teams
 */
export declare const getListTournamentTeamsUrl: (tournamentId: string) => string;
export declare const listTournamentTeams: (tournamentId: string, options?: RequestInit) => Promise<TournamentTeamWithDetails[]>;
export declare const getListTournamentTeamsQueryKey: (tournamentId: string) => readonly [`/api/tournaments/${string}/teams`];
export declare const getListTournamentTeamsQueryOptions: <TData = Awaited<ReturnType<typeof listTournamentTeams>>, TError = ErrorType<unknown>>(tournamentId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listTournamentTeams>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listTournamentTeams>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListTournamentTeamsQueryResult = NonNullable<Awaited<ReturnType<typeof listTournamentTeams>>>;
export type ListTournamentTeamsQueryError = ErrorType<unknown>;
/**
 * @summary List tournament teams
 */
export declare function useListTournamentTeams<TData = Awaited<ReturnType<typeof listTournamentTeams>>, TError = ErrorType<unknown>>(tournamentId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listTournamentTeams>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Add team to tournament
 */
export declare const getAddTournamentTeamUrl: (tournamentId: string) => string;
export declare const addTournamentTeam: (tournamentId: string, addTournamentTeamRequest: AddTournamentTeamRequest, options?: RequestInit) => Promise<TournamentTeamWithDetails>;
export declare const getAddTournamentTeamMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof addTournamentTeam>>, TError, {
        tournamentId: string;
        data: BodyType<AddTournamentTeamRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof addTournamentTeam>>, TError, {
    tournamentId: string;
    data: BodyType<AddTournamentTeamRequest>;
}, TContext>;
export type AddTournamentTeamMutationResult = NonNullable<Awaited<ReturnType<typeof addTournamentTeam>>>;
export type AddTournamentTeamMutationBody = BodyType<AddTournamentTeamRequest>;
export type AddTournamentTeamMutationError = ErrorType<unknown>;
/**
 * @summary Add team to tournament
 */
export declare const useAddTournamentTeam: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof addTournamentTeam>>, TError, {
        tournamentId: string;
        data: BodyType<AddTournamentTeamRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof addTournamentTeam>>, TError, {
    tournamentId: string;
    data: BodyType<AddTournamentTeamRequest>;
}, TContext>;
/**
 * @summary Update tournament team entry
 */
export declare const getUpdateTournamentTeamUrl: (tournamentId: string, teamId: string) => string;
export declare const updateTournamentTeam: (tournamentId: string, teamId: string, updateTournamentTeamRequest: UpdateTournamentTeamRequest, options?: RequestInit) => Promise<TournamentTeamWithDetails>;
export declare const getUpdateTournamentTeamMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateTournamentTeam>>, TError, {
        tournamentId: string;
        teamId: string;
        data: BodyType<UpdateTournamentTeamRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateTournamentTeam>>, TError, {
    tournamentId: string;
    teamId: string;
    data: BodyType<UpdateTournamentTeamRequest>;
}, TContext>;
export type UpdateTournamentTeamMutationResult = NonNullable<Awaited<ReturnType<typeof updateTournamentTeam>>>;
export type UpdateTournamentTeamMutationBody = BodyType<UpdateTournamentTeamRequest>;
export type UpdateTournamentTeamMutationError = ErrorType<unknown>;
/**
 * @summary Update tournament team entry
 */
export declare const useUpdateTournamentTeam: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateTournamentTeam>>, TError, {
        tournamentId: string;
        teamId: string;
        data: BodyType<UpdateTournamentTeamRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateTournamentTeam>>, TError, {
    tournamentId: string;
    teamId: string;
    data: BodyType<UpdateTournamentTeamRequest>;
}, TContext>;
/**
 * @summary Remove team from tournament
 */
export declare const getRemoveTournamentTeamUrl: (tournamentId: string, teamId: string) => string;
export declare const removeTournamentTeam: (tournamentId: string, teamId: string, options?: RequestInit) => Promise<MessageResponse>;
export declare const getRemoveTournamentTeamMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof removeTournamentTeam>>, TError, {
        tournamentId: string;
        teamId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof removeTournamentTeam>>, TError, {
    tournamentId: string;
    teamId: string;
}, TContext>;
export type RemoveTournamentTeamMutationResult = NonNullable<Awaited<ReturnType<typeof removeTournamentTeam>>>;
export type RemoveTournamentTeamMutationError = ErrorType<unknown>;
/**
 * @summary Remove team from tournament
 */
export declare const useRemoveTournamentTeam: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof removeTournamentTeam>>, TError, {
        tournamentId: string;
        teamId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof removeTournamentTeam>>, TError, {
    tournamentId: string;
    teamId: string;
}, TContext>;
/**
 * @summary List all out dates for tournament
 */
export declare const getListTournamentOutDatesUrl: (tournamentId: string) => string;
export declare const listTournamentOutDates: (tournamentId: string, options?: RequestInit) => Promise<TeamOutDate[]>;
export declare const getListTournamentOutDatesQueryKey: (tournamentId: string) => readonly [`/api/tournaments/${string}/out-dates`];
export declare const getListTournamentOutDatesQueryOptions: <TData = Awaited<ReturnType<typeof listTournamentOutDates>>, TError = ErrorType<unknown>>(tournamentId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listTournamentOutDates>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listTournamentOutDates>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListTournamentOutDatesQueryResult = NonNullable<Awaited<ReturnType<typeof listTournamentOutDates>>>;
export type ListTournamentOutDatesQueryError = ErrorType<unknown>;
/**
 * @summary List all out dates for tournament
 */
export declare function useListTournamentOutDates<TData = Awaited<ReturnType<typeof listTournamentOutDates>>, TError = ErrorType<unknown>>(tournamentId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listTournamentOutDates>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary List out dates for team in tournament
 */
export declare const getListTeamOutDatesUrl: (tournamentId: string, teamId: string) => string;
export declare const listTeamOutDates: (tournamentId: string, teamId: string, options?: RequestInit) => Promise<TeamOutDate[]>;
export declare const getListTeamOutDatesQueryKey: (tournamentId: string, teamId: string) => readonly [`/api/tournaments/${string}/teams/${string}/out-dates`];
export declare const getListTeamOutDatesQueryOptions: <TData = Awaited<ReturnType<typeof listTeamOutDates>>, TError = ErrorType<unknown>>(tournamentId: string, teamId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listTeamOutDates>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listTeamOutDates>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListTeamOutDatesQueryResult = NonNullable<Awaited<ReturnType<typeof listTeamOutDates>>>;
export type ListTeamOutDatesQueryError = ErrorType<unknown>;
/**
 * @summary List out dates for team in tournament
 */
export declare function useListTeamOutDates<TData = Awaited<ReturnType<typeof listTeamOutDates>>, TError = ErrorType<unknown>>(tournamentId: string, teamId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listTeamOutDates>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create team out date
 */
export declare const getCreateTeamOutDateUrl: (tournamentId: string, teamId: string) => string;
export declare const createTeamOutDate: (tournamentId: string, teamId: string, createTeamOutDateRequest: CreateTeamOutDateRequest, options?: RequestInit) => Promise<TeamOutDate>;
export declare const getCreateTeamOutDateMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createTeamOutDate>>, TError, {
        tournamentId: string;
        teamId: string;
        data: BodyType<CreateTeamOutDateRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createTeamOutDate>>, TError, {
    tournamentId: string;
    teamId: string;
    data: BodyType<CreateTeamOutDateRequest>;
}, TContext>;
export type CreateTeamOutDateMutationResult = NonNullable<Awaited<ReturnType<typeof createTeamOutDate>>>;
export type CreateTeamOutDateMutationBody = BodyType<CreateTeamOutDateRequest>;
export type CreateTeamOutDateMutationError = ErrorType<unknown>;
/**
 * @summary Create team out date
 */
export declare const useCreateTeamOutDate: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createTeamOutDate>>, TError, {
        tournamentId: string;
        teamId: string;
        data: BodyType<CreateTeamOutDateRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createTeamOutDate>>, TError, {
    tournamentId: string;
    teamId: string;
    data: BodyType<CreateTeamOutDateRequest>;
}, TContext>;
/**
 * @summary Delete out date
 */
export declare const getDeleteTeamOutDateUrl: (outDateId: string) => string;
export declare const deleteTeamOutDate: (outDateId: string, options?: RequestInit) => Promise<MessageResponse>;
export declare const getDeleteTeamOutDateMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteTeamOutDate>>, TError, {
        outDateId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteTeamOutDate>>, TError, {
    outDateId: string;
}, TContext>;
export type DeleteTeamOutDateMutationResult = NonNullable<Awaited<ReturnType<typeof deleteTeamOutDate>>>;
export type DeleteTeamOutDateMutationError = ErrorType<unknown>;
/**
 * @summary Delete out date
 */
export declare const useDeleteTeamOutDate: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteTeamOutDate>>, TError, {
        outDateId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteTeamOutDate>>, TError, {
    outDateId: string;
}, TContext>;
/**
 * @summary List play dates
 */
export declare const getListPlayDatesUrl: (tournamentId: string) => string;
export declare const listPlayDates: (tournamentId: string, options?: RequestInit) => Promise<PlayDate[]>;
export declare const getListPlayDatesQueryKey: (tournamentId: string) => readonly [`/api/tournaments/${string}/play-dates`];
export declare const getListPlayDatesQueryOptions: <TData = Awaited<ReturnType<typeof listPlayDates>>, TError = ErrorType<unknown>>(tournamentId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listPlayDates>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listPlayDates>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListPlayDatesQueryResult = NonNullable<Awaited<ReturnType<typeof listPlayDates>>>;
export type ListPlayDatesQueryError = ErrorType<unknown>;
/**
 * @summary List play dates
 */
export declare function useListPlayDates<TData = Awaited<ReturnType<typeof listPlayDates>>, TError = ErrorType<unknown>>(tournamentId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listPlayDates>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create play date
 */
export declare const getCreatePlayDateUrl: (tournamentId: string) => string;
export declare const createPlayDate: (tournamentId: string, createPlayDateRequest: CreatePlayDateRequest, options?: RequestInit) => Promise<PlayDate>;
export declare const getCreatePlayDateMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createPlayDate>>, TError, {
        tournamentId: string;
        data: BodyType<CreatePlayDateRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createPlayDate>>, TError, {
    tournamentId: string;
    data: BodyType<CreatePlayDateRequest>;
}, TContext>;
export type CreatePlayDateMutationResult = NonNullable<Awaited<ReturnType<typeof createPlayDate>>>;
export type CreatePlayDateMutationBody = BodyType<CreatePlayDateRequest>;
export type CreatePlayDateMutationError = ErrorType<unknown>;
/**
 * @summary Create play date
 */
export declare const useCreatePlayDate: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createPlayDate>>, TError, {
        tournamentId: string;
        data: BodyType<CreatePlayDateRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createPlayDate>>, TError, {
    tournamentId: string;
    data: BodyType<CreatePlayDateRequest>;
}, TContext>;
/**
 * @summary Update play date
 */
export declare const getUpdatePlayDateUrl: (playDateId: string) => string;
export declare const updatePlayDate: (playDateId: string, updatePlayDateRequest: UpdatePlayDateRequest, options?: RequestInit) => Promise<PlayDate>;
export declare const getUpdatePlayDateMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updatePlayDate>>, TError, {
        playDateId: string;
        data: BodyType<UpdatePlayDateRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updatePlayDate>>, TError, {
    playDateId: string;
    data: BodyType<UpdatePlayDateRequest>;
}, TContext>;
export type UpdatePlayDateMutationResult = NonNullable<Awaited<ReturnType<typeof updatePlayDate>>>;
export type UpdatePlayDateMutationBody = BodyType<UpdatePlayDateRequest>;
export type UpdatePlayDateMutationError = ErrorType<unknown>;
/**
 * @summary Update play date
 */
export declare const useUpdatePlayDate: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updatePlayDate>>, TError, {
        playDateId: string;
        data: BodyType<UpdatePlayDateRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updatePlayDate>>, TError, {
    playDateId: string;
    data: BodyType<UpdatePlayDateRequest>;
}, TContext>;
/**
 * @summary Delete play date
 */
export declare const getDeletePlayDateUrl: (playDateId: string) => string;
export declare const deletePlayDate: (playDateId: string, options?: RequestInit) => Promise<MessageResponse>;
export declare const getDeletePlayDateMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deletePlayDate>>, TError, {
        playDateId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deletePlayDate>>, TError, {
    playDateId: string;
}, TContext>;
export type DeletePlayDateMutationResult = NonNullable<Awaited<ReturnType<typeof deletePlayDate>>>;
export type DeletePlayDateMutationError = ErrorType<unknown>;
/**
 * @summary Delete play date
 */
export declare const useDeletePlayDate: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deletePlayDate>>, TError, {
        playDateId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deletePlayDate>>, TError, {
    playDateId: string;
}, TContext>;
/**
 * @summary List tournament matches
 */
export declare const getListMatchesUrl: (tournamentId: string, params?: ListMatchesParams) => string;
export declare const listMatches: (tournamentId: string, params?: ListMatchesParams, options?: RequestInit) => Promise<MatchWithTeams[]>;
export declare const getListMatchesQueryKey: (tournamentId: string, params?: ListMatchesParams) => readonly [`/api/tournaments/${string}/matches`, ...ListMatchesParams[]];
export declare const getListMatchesQueryOptions: <TData = Awaited<ReturnType<typeof listMatches>>, TError = ErrorType<unknown>>(tournamentId: string, params?: ListMatchesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listMatches>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listMatches>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListMatchesQueryResult = NonNullable<Awaited<ReturnType<typeof listMatches>>>;
export type ListMatchesQueryError = ErrorType<unknown>;
/**
 * @summary List tournament matches
 */
export declare function useListMatches<TData = Awaited<ReturnType<typeof listMatches>>, TError = ErrorType<unknown>>(tournamentId: string, params?: ListMatchesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listMatches>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Generate tournament schedule
 */
export declare const getGenerateScheduleUrl: (tournamentId: string) => string;
export declare const generateSchedule: (tournamentId: string, options?: RequestInit) => Promise<GenerateScheduleResponse>;
export declare const getGenerateScheduleMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generateSchedule>>, TError, {
        tournamentId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof generateSchedule>>, TError, {
    tournamentId: string;
}, TContext>;
export type GenerateScheduleMutationResult = NonNullable<Awaited<ReturnType<typeof generateSchedule>>>;
export type GenerateScheduleMutationError = ErrorType<unknown>;
/**
 * @summary Generate tournament schedule
 */
export declare const useGenerateSchedule: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generateSchedule>>, TError, {
        tournamentId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof generateSchedule>>, TError, {
    tournamentId: string;
}, TContext>;
/**
 * @summary Get match details
 */
export declare const getGetMatchUrl: (matchId: string) => string;
export declare const getMatch: (matchId: string, options?: RequestInit) => Promise<MatchDetail>;
export declare const getGetMatchQueryKey: (matchId: string) => readonly [`/api/matches/${string}`];
export declare const getGetMatchQueryOptions: <TData = Awaited<ReturnType<typeof getMatch>>, TError = ErrorType<unknown>>(matchId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMatch>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getMatch>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetMatchQueryResult = NonNullable<Awaited<ReturnType<typeof getMatch>>>;
export type GetMatchQueryError = ErrorType<unknown>;
/**
 * @summary Get match details
 */
export declare function useGetMatch<TData = Awaited<ReturnType<typeof getMatch>>, TError = ErrorType<unknown>>(matchId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMatch>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Update match
 */
export declare const getUpdateMatchUrl: (matchId: string) => string;
export declare const updateMatch: (matchId: string, updateMatchRequest: UpdateMatchRequest, options?: RequestInit) => Promise<MatchWithTeams>;
export declare const getUpdateMatchMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateMatch>>, TError, {
        matchId: string;
        data: BodyType<UpdateMatchRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateMatch>>, TError, {
    matchId: string;
    data: BodyType<UpdateMatchRequest>;
}, TContext>;
export type UpdateMatchMutationResult = NonNullable<Awaited<ReturnType<typeof updateMatch>>>;
export type UpdateMatchMutationBody = BodyType<UpdateMatchRequest>;
export type UpdateMatchMutationError = ErrorType<unknown>;
/**
 * @summary Update match
 */
export declare const useUpdateMatch: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateMatch>>, TError, {
        matchId: string;
        data: BodyType<UpdateMatchRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateMatch>>, TError, {
    matchId: string;
    data: BodyType<UpdateMatchRequest>;
}, TContext>;
/**
 * @summary Update match score
 */
export declare const getUpdateMatchScoreUrl: (matchId: string) => string;
export declare const updateMatchScore: (matchId: string, updateScoreRequest: UpdateScoreRequest, options?: RequestInit) => Promise<MatchWithTeams>;
export declare const getUpdateMatchScoreMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateMatchScore>>, TError, {
        matchId: string;
        data: BodyType<UpdateScoreRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateMatchScore>>, TError, {
    matchId: string;
    data: BodyType<UpdateScoreRequest>;
}, TContext>;
export type UpdateMatchScoreMutationResult = NonNullable<Awaited<ReturnType<typeof updateMatchScore>>>;
export type UpdateMatchScoreMutationBody = BodyType<UpdateScoreRequest>;
export type UpdateMatchScoreMutationError = ErrorType<unknown>;
/**
 * @summary Update match score
 */
export declare const useUpdateMatchScore: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateMatchScore>>, TError, {
        matchId: string;
        data: BodyType<UpdateScoreRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateMatchScore>>, TError, {
    matchId: string;
    data: BodyType<UpdateScoreRequest>;
}, TContext>;
/**
 * @summary Control match clock
 */
export declare const getUpdateMatchClockUrl: (matchId: string) => string;
export declare const updateMatchClock: (matchId: string, updateClockRequest: UpdateClockRequest, options?: RequestInit) => Promise<MatchWithTeams>;
export declare const getUpdateMatchClockMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateMatchClock>>, TError, {
        matchId: string;
        data: BodyType<UpdateClockRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateMatchClock>>, TError, {
    matchId: string;
    data: BodyType<UpdateClockRequest>;
}, TContext>;
export type UpdateMatchClockMutationResult = NonNullable<Awaited<ReturnType<typeof updateMatchClock>>>;
export type UpdateMatchClockMutationBody = BodyType<UpdateClockRequest>;
export type UpdateMatchClockMutationError = ErrorType<unknown>;
/**
 * @summary Control match clock
 */
export declare const useUpdateMatchClock: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateMatchClock>>, TError, {
        matchId: string;
        data: BodyType<UpdateClockRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateMatchClock>>, TError, {
    matchId: string;
    data: BodyType<UpdateClockRequest>;
}, TContext>;
/**
 * @summary Update match status
 */
export declare const getUpdateMatchStatusUrl: (matchId: string) => string;
export declare const updateMatchStatus: (matchId: string, updateMatchStatusRequest: UpdateMatchStatusRequest, options?: RequestInit) => Promise<MatchWithTeams>;
export declare const getUpdateMatchStatusMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateMatchStatus>>, TError, {
        matchId: string;
        data: BodyType<UpdateMatchStatusRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateMatchStatus>>, TError, {
    matchId: string;
    data: BodyType<UpdateMatchStatusRequest>;
}, TContext>;
export type UpdateMatchStatusMutationResult = NonNullable<Awaited<ReturnType<typeof updateMatchStatus>>>;
export type UpdateMatchStatusMutationBody = BodyType<UpdateMatchStatusRequest>;
export type UpdateMatchStatusMutationError = ErrorType<unknown>;
/**
 * @summary Update match status
 */
export declare const useUpdateMatchStatus: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateMatchStatus>>, TError, {
        matchId: string;
        data: BodyType<UpdateMatchStatusRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateMatchStatus>>, TError, {
    matchId: string;
    data: BodyType<UpdateMatchStatusRequest>;
}, TContext>;
/**
 * @summary Advance to next chukker
 */
export declare const getAdvanceChukkerUrl: (matchId: string) => string;
export declare const advanceChukker: (matchId: string, options?: RequestInit) => Promise<MatchWithTeams>;
export declare const getAdvanceChukkerMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof advanceChukker>>, TError, {
        matchId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof advanceChukker>>, TError, {
    matchId: string;
}, TContext>;
export type AdvanceChukkerMutationResult = NonNullable<Awaited<ReturnType<typeof advanceChukker>>>;
export type AdvanceChukkerMutationError = ErrorType<unknown>;
/**
 * @summary Advance to next chukker
 */
export declare const useAdvanceChukker: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof advanceChukker>>, TError, {
        matchId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof advanceChukker>>, TError, {
    matchId: string;
}, TContext>;
/**
 * @summary List match events
 */
export declare const getListMatchEventsUrl: (matchId: string) => string;
export declare const listMatchEvents: (matchId: string, options?: RequestInit) => Promise<MatchEvent[]>;
export declare const getListMatchEventsQueryKey: (matchId: string) => readonly [`/api/matches/${string}/events`];
export declare const getListMatchEventsQueryOptions: <TData = Awaited<ReturnType<typeof listMatchEvents>>, TError = ErrorType<unknown>>(matchId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listMatchEvents>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listMatchEvents>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListMatchEventsQueryResult = NonNullable<Awaited<ReturnType<typeof listMatchEvents>>>;
export type ListMatchEventsQueryError = ErrorType<unknown>;
/**
 * @summary List match events
 */
export declare function useListMatchEvents<TData = Awaited<ReturnType<typeof listMatchEvents>>, TError = ErrorType<unknown>>(matchId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listMatchEvents>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary List all live matches
 */
export declare const getListLiveMatchesUrl: () => string;
export declare const listLiveMatches: (options?: RequestInit) => Promise<MatchWithTeams[]>;
export declare const getListLiveMatchesQueryKey: () => readonly ["/api/matches/live"];
export declare const getListLiveMatchesQueryOptions: <TData = Awaited<ReturnType<typeof listLiveMatches>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listLiveMatches>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listLiveMatches>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListLiveMatchesQueryResult = NonNullable<Awaited<ReturnType<typeof listLiveMatches>>>;
export type ListLiveMatchesQueryError = ErrorType<unknown>;
/**
 * @summary List all live matches
 */
export declare function useListLiveMatches<TData = Awaited<ReturnType<typeof listLiveMatches>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listLiveMatches>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary List today matches
 */
export declare const getListTodayMatchesUrl: (params?: ListTodayMatchesParams) => string;
export declare const listTodayMatches: (params?: ListTodayMatchesParams, options?: RequestInit) => Promise<MatchWithTeams[]>;
export declare const getListTodayMatchesQueryKey: (params?: ListTodayMatchesParams) => readonly ["/api/matches/today", ...ListTodayMatchesParams[]];
export declare const getListTodayMatchesQueryOptions: <TData = Awaited<ReturnType<typeof listTodayMatches>>, TError = ErrorType<unknown>>(params?: ListTodayMatchesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listTodayMatches>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listTodayMatches>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListTodayMatchesQueryResult = NonNullable<Awaited<ReturnType<typeof listTodayMatches>>>;
export type ListTodayMatchesQueryError = ErrorType<unknown>;
/**
 * @summary List today matches
 */
export declare function useListTodayMatches<TData = Awaited<ReturnType<typeof listTodayMatches>>, TError = ErrorType<unknown>>(params?: ListTodayMatchesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listTodayMatches>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary List upcoming matches
 */
export declare const getListUpcomingMatchesUrl: (params?: ListUpcomingMatchesParams) => string;
export declare const listUpcomingMatches: (params?: ListUpcomingMatchesParams, options?: RequestInit) => Promise<MatchWithTeams[]>;
export declare const getListUpcomingMatchesQueryKey: (params?: ListUpcomingMatchesParams) => readonly ["/api/matches/upcoming", ...ListUpcomingMatchesParams[]];
export declare const getListUpcomingMatchesQueryOptions: <TData = Awaited<ReturnType<typeof listUpcomingMatches>>, TError = ErrorType<unknown>>(params?: ListUpcomingMatchesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listUpcomingMatches>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listUpcomingMatches>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListUpcomingMatchesQueryResult = NonNullable<Awaited<ReturnType<typeof listUpcomingMatches>>>;
export type ListUpcomingMatchesQueryError = ErrorType<unknown>;
/**
 * @summary List upcoming matches
 */
export declare function useListUpcomingMatches<TData = Awaited<ReturnType<typeof listUpcomingMatches>>, TError = ErrorType<unknown>>(params?: ListUpcomingMatchesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listUpcomingMatches>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Get admin dashboard data
 */
export declare const getGetAdminDashboardUrl: (params: GetAdminDashboardParams) => string;
export declare const getAdminDashboard: (params: GetAdminDashboardParams, options?: RequestInit) => Promise<AdminDashboard>;
export declare const getGetAdminDashboardQueryKey: (params?: GetAdminDashboardParams) => readonly ["/api/admin/dashboard", ...GetAdminDashboardParams[]];
export declare const getGetAdminDashboardQueryOptions: <TData = Awaited<ReturnType<typeof getAdminDashboard>>, TError = ErrorType<unknown>>(params: GetAdminDashboardParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAdminDashboard>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getAdminDashboard>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetAdminDashboardQueryResult = NonNullable<Awaited<ReturnType<typeof getAdminDashboard>>>;
export type GetAdminDashboardQueryError = ErrorType<unknown>;
/**
 * @summary Get admin dashboard data
 */
export declare function useGetAdminDashboard<TData = Awaited<ReturnType<typeof getAdminDashboard>>, TError = ErrorType<unknown>>(params: GetAdminDashboardParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAdminDashboard>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary List club memberships
 */
export declare const getListClubMembershipsUrl: (params: ListClubMembershipsParams) => string;
export declare const listClubMemberships: (params: ListClubMembershipsParams, options?: RequestInit) => Promise<ClubMembership[]>;
export declare const getListClubMembershipsQueryKey: (params?: ListClubMembershipsParams) => readonly ["/api/admin/club-memberships", ...ListClubMembershipsParams[]];
export declare const getListClubMembershipsQueryOptions: <TData = Awaited<ReturnType<typeof listClubMemberships>>, TError = ErrorType<unknown>>(params: ListClubMembershipsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listClubMemberships>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listClubMemberships>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListClubMembershipsQueryResult = NonNullable<Awaited<ReturnType<typeof listClubMemberships>>>;
export type ListClubMembershipsQueryError = ErrorType<unknown>;
/**
 * @summary List club memberships
 */
export declare function useListClubMemberships<TData = Awaited<ReturnType<typeof listClubMemberships>>, TError = ErrorType<unknown>>(params: ListClubMembershipsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listClubMemberships>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Appoint club manager
 */
export declare const getCreateClubMembershipUrl: () => string;
export declare const createClubMembership: (createClubMembershipRequest: CreateClubMembershipRequest, options?: RequestInit) => Promise<ClubMembership>;
export declare const getCreateClubMembershipMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createClubMembership>>, TError, {
        data: BodyType<CreateClubMembershipRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createClubMembership>>, TError, {
    data: BodyType<CreateClubMembershipRequest>;
}, TContext>;
export type CreateClubMembershipMutationResult = NonNullable<Awaited<ReturnType<typeof createClubMembership>>>;
export type CreateClubMembershipMutationBody = BodyType<CreateClubMembershipRequest>;
export type CreateClubMembershipMutationError = ErrorType<unknown>;
/**
 * @summary Appoint club manager
 */
export declare const useCreateClubMembership: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createClubMembership>>, TError, {
        data: BodyType<CreateClubMembershipRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createClubMembership>>, TError, {
    data: BodyType<CreateClubMembershipRequest>;
}, TContext>;
/**
 * @summary Remove club membership
 */
export declare const getRemoveClubMembershipUrl: (userId: string, clubId: string) => string;
export declare const removeClubMembership: (userId: string, clubId: string, options?: RequestInit) => Promise<MessageResponse>;
export declare const getRemoveClubMembershipMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof removeClubMembership>>, TError, {
        userId: string;
        clubId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof removeClubMembership>>, TError, {
    userId: string;
    clubId: string;
}, TContext>;
export type RemoveClubMembershipMutationResult = NonNullable<Awaited<ReturnType<typeof removeClubMembership>>>;
export type RemoveClubMembershipMutationError = ErrorType<unknown>;
/**
 * @summary Remove club membership
 */
export declare const useRemoveClubMembership: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof removeClubMembership>>, TError, {
        userId: string;
        clubId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof removeClubMembership>>, TError, {
    userId: string;
    clubId: string;
}, TContext>;
/**
 * @summary Assign team manager
 */
export declare const getAssignTeamManagerUrl: () => string;
export declare const assignTeamManager: (assignTeamManagerRequest: AssignTeamManagerRequest, options?: RequestInit) => Promise<TeamManagerAssignment>;
export declare const getAssignTeamManagerMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof assignTeamManager>>, TError, {
        data: BodyType<AssignTeamManagerRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof assignTeamManager>>, TError, {
    data: BodyType<AssignTeamManagerRequest>;
}, TContext>;
export type AssignTeamManagerMutationResult = NonNullable<Awaited<ReturnType<typeof assignTeamManager>>>;
export type AssignTeamManagerMutationBody = BodyType<AssignTeamManagerRequest>;
export type AssignTeamManagerMutationError = ErrorType<unknown>;
/**
 * @summary Assign team manager
 */
export declare const useAssignTeamManager: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof assignTeamManager>>, TError, {
        data: BodyType<AssignTeamManagerRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof assignTeamManager>>, TError, {
    data: BodyType<AssignTeamManagerRequest>;
}, TContext>;
/**
 * @summary Revoke team assignment
 */
export declare const getRevokeTeamAssignmentUrl: (assignmentId: string) => string;
export declare const revokeTeamAssignment: (assignmentId: string, options?: RequestInit) => Promise<MessageResponse>;
export declare const getRevokeTeamAssignmentMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof revokeTeamAssignment>>, TError, {
        assignmentId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof revokeTeamAssignment>>, TError, {
    assignmentId: string;
}, TContext>;
export type RevokeTeamAssignmentMutationResult = NonNullable<Awaited<ReturnType<typeof revokeTeamAssignment>>>;
export type RevokeTeamAssignmentMutationError = ErrorType<unknown>;
/**
 * @summary Revoke team assignment
 */
export declare const useRevokeTeamAssignment: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof revokeTeamAssignment>>, TError, {
        assignmentId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof revokeTeamAssignment>>, TError, {
    assignmentId: string;
}, TContext>;
/**
 * @summary Get my team assignments
 */
export declare const getGetMyTeamAssignmentsUrl: () => string;
export declare const getMyTeamAssignments: (options?: RequestInit) => Promise<MyTeamAssignment[]>;
export declare const getGetMyTeamAssignmentsQueryKey: () => readonly ["/api/my-team/assignments"];
export declare const getGetMyTeamAssignmentsQueryOptions: <TData = Awaited<ReturnType<typeof getMyTeamAssignments>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMyTeamAssignments>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getMyTeamAssignments>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetMyTeamAssignmentsQueryResult = NonNullable<Awaited<ReturnType<typeof getMyTeamAssignments>>>;
export type GetMyTeamAssignmentsQueryError = ErrorType<unknown>;
/**
 * @summary Get my team assignments
 */
export declare function useGetMyTeamAssignments<TData = Awaited<ReturnType<typeof getMyTeamAssignments>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMyTeamAssignments>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Get team manager dashboard
 */
export declare const getGetMyTeamDashboardUrl: (teamId: string) => string;
export declare const getMyTeamDashboard: (teamId: string, options?: RequestInit) => Promise<TeamManagerDashboard>;
export declare const getGetMyTeamDashboardQueryKey: (teamId: string) => readonly [`/api/my-team/${string}/dashboard`];
export declare const getGetMyTeamDashboardQueryOptions: <TData = Awaited<ReturnType<typeof getMyTeamDashboard>>, TError = ErrorType<unknown>>(teamId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMyTeamDashboard>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getMyTeamDashboard>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetMyTeamDashboardQueryResult = NonNullable<Awaited<ReturnType<typeof getMyTeamDashboard>>>;
export type GetMyTeamDashboardQueryError = ErrorType<unknown>;
/**
 * @summary Get team manager dashboard
 */
export declare function useGetMyTeamDashboard<TData = Awaited<ReturnType<typeof getMyTeamDashboard>>, TError = ErrorType<unknown>>(teamId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMyTeamDashboard>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Get my team schedule
 */
export declare const getGetMyTeamScheduleUrl: (teamId: string, params?: GetMyTeamScheduleParams) => string;
export declare const getMyTeamSchedule: (teamId: string, params?: GetMyTeamScheduleParams, options?: RequestInit) => Promise<MatchWithTeams[]>;
export declare const getGetMyTeamScheduleQueryKey: (teamId: string, params?: GetMyTeamScheduleParams) => readonly [`/api/my-team/${string}/schedule`, ...GetMyTeamScheduleParams[]];
export declare const getGetMyTeamScheduleQueryOptions: <TData = Awaited<ReturnType<typeof getMyTeamSchedule>>, TError = ErrorType<unknown>>(teamId: string, params?: GetMyTeamScheduleParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMyTeamSchedule>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getMyTeamSchedule>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetMyTeamScheduleQueryResult = NonNullable<Awaited<ReturnType<typeof getMyTeamSchedule>>>;
export type GetMyTeamScheduleQueryError = ErrorType<unknown>;
/**
 * @summary Get my team schedule
 */
export declare function useGetMyTeamSchedule<TData = Awaited<ReturnType<typeof getMyTeamSchedule>>, TError = ErrorType<unknown>>(teamId: string, params?: GetMyTeamScheduleParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMyTeamSchedule>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Get tournament standings
 */
export declare const getGetTournamentStandingsUrl: (tournamentId: string) => string;
export declare const getTournamentStandings: (tournamentId: string, options?: RequestInit) => Promise<StandingsEntry[]>;
export declare const getGetTournamentStandingsQueryKey: (tournamentId: string) => readonly [`/api/tournaments/${string}/standings`];
export declare const getGetTournamentStandingsQueryOptions: <TData = Awaited<ReturnType<typeof getTournamentStandings>>, TError = ErrorType<unknown>>(tournamentId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getTournamentStandings>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getTournamentStandings>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetTournamentStandingsQueryResult = NonNullable<Awaited<ReturnType<typeof getTournamentStandings>>>;
export type GetTournamentStandingsQueryError = ErrorType<unknown>;
/**
 * @summary Get tournament standings
 */
export declare function useGetTournamentStandings<TData = Awaited<ReturnType<typeof getTournamentStandings>>, TError = ErrorType<unknown>>(tournamentId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getTournamentStandings>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary AI format recommendation
 */
export declare const getRecommendFormatUrl: () => string;
export declare const recommendFormat: (recommendFormatRequest: RecommendFormatRequest, options?: RequestInit) => Promise<RecommendFormatResponse>;
export declare const getRecommendFormatMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof recommendFormat>>, TError, {
        data: BodyType<RecommendFormatRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof recommendFormat>>, TError, {
    data: BodyType<RecommendFormatRequest>;
}, TContext>;
export type RecommendFormatMutationResult = NonNullable<Awaited<ReturnType<typeof recommendFormat>>>;
export type RecommendFormatMutationBody = BodyType<RecommendFormatRequest>;
export type RecommendFormatMutationError = ErrorType<unknown>;
/**
 * @summary AI format recommendation
 */
export declare const useRecommendFormat: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof recommendFormat>>, TError, {
        data: BodyType<RecommendFormatRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof recommendFormat>>, TError, {
    data: BodyType<RecommendFormatRequest>;
}, TContext>;
/**
 * @summary Accept an invite
 */
export declare const getAcceptInviteUrl: () => string;
export declare const acceptInvite: (acceptInviteRequest: AcceptInviteRequest, options?: RequestInit) => Promise<AuthResponse>;
export declare const getAcceptInviteMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof acceptInvite>>, TError, {
        data: BodyType<AcceptInviteRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof acceptInvite>>, TError, {
    data: BodyType<AcceptInviteRequest>;
}, TContext>;
export type AcceptInviteMutationResult = NonNullable<Awaited<ReturnType<typeof acceptInvite>>>;
export type AcceptInviteMutationBody = BodyType<AcceptInviteRequest>;
export type AcceptInviteMutationError = ErrorType<unknown>;
/**
 * @summary Accept an invite
 */
export declare const useAcceptInvite: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof acceptInvite>>, TError, {
        data: BodyType<AcceptInviteRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof acceptInvite>>, TError, {
    data: BodyType<AcceptInviteRequest>;
}, TContext>;
/**
 * @summary Get invite details by token
 */
export declare const getGetInviteByTokenUrl: (token: string) => string;
export declare const getInviteByToken: (token: string, options?: RequestInit) => Promise<InviteDetail>;
export declare const getGetInviteByTokenQueryKey: (token: string) => readonly [`/api/invites/${string}`];
export declare const getGetInviteByTokenQueryOptions: <TData = Awaited<ReturnType<typeof getInviteByToken>>, TError = ErrorType<unknown>>(token: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getInviteByToken>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getInviteByToken>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetInviteByTokenQueryResult = NonNullable<Awaited<ReturnType<typeof getInviteByToken>>>;
export type GetInviteByTokenQueryError = ErrorType<unknown>;
/**
 * @summary Get invite details by token
 */
export declare function useGetInviteByToken<TData = Awaited<ReturnType<typeof getInviteByToken>>, TError = ErrorType<unknown>>(token: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getInviteByToken>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Get widget fixtures
 */
export declare const getGetWidgetFixturesUrl: (clubSlug: string) => string;
export declare const getWidgetFixtures: (clubSlug: string, options?: RequestInit) => Promise<WidgetFixtures>;
export declare const getGetWidgetFixturesQueryKey: (clubSlug: string) => readonly [`/api/widget/${string}/fixtures`];
export declare const getGetWidgetFixturesQueryOptions: <TData = Awaited<ReturnType<typeof getWidgetFixtures>>, TError = ErrorType<unknown>>(clubSlug: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getWidgetFixtures>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getWidgetFixtures>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetWidgetFixturesQueryResult = NonNullable<Awaited<ReturnType<typeof getWidgetFixtures>>>;
export type GetWidgetFixturesQueryError = ErrorType<unknown>;
/**
 * @summary Get widget fixtures
 */
export declare function useGetWidgetFixtures<TData = Awaited<ReturnType<typeof getWidgetFixtures>>, TError = ErrorType<unknown>>(clubSlug: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getWidgetFixtures>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary List/search players
 */
export declare const getListPlayersUrl: (params?: ListPlayersParams) => string;
export declare const listPlayers: (params?: ListPlayersParams, options?: RequestInit) => Promise<PlayerSummary[]>;
export declare const getListPlayersQueryKey: (params?: ListPlayersParams) => readonly ["/api/players", ...ListPlayersParams[]];
export declare const getListPlayersQueryOptions: <TData = Awaited<ReturnType<typeof listPlayers>>, TError = ErrorType<unknown>>(params?: ListPlayersParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listPlayers>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listPlayers>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListPlayersQueryResult = NonNullable<Awaited<ReturnType<typeof listPlayers>>>;
export type ListPlayersQueryError = ErrorType<unknown>;
/**
 * @summary List/search players
 */
export declare function useListPlayers<TData = Awaited<ReturnType<typeof listPlayers>>, TError = ErrorType<unknown>>(params?: ListPlayersParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listPlayers>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create a player
 */
export declare const getCreatePlayerUrl: () => string;
export declare const createPlayer: (createPlayerRequest: CreatePlayerRequest, options?: RequestInit) => Promise<Player>;
export declare const getCreatePlayerMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createPlayer>>, TError, {
        data: BodyType<CreatePlayerRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createPlayer>>, TError, {
    data: BodyType<CreatePlayerRequest>;
}, TContext>;
export type CreatePlayerMutationResult = NonNullable<Awaited<ReturnType<typeof createPlayer>>>;
export type CreatePlayerMutationBody = BodyType<CreatePlayerRequest>;
export type CreatePlayerMutationError = ErrorType<unknown>;
/**
 * @summary Create a player
 */
export declare const useCreatePlayer: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createPlayer>>, TError, {
        data: BodyType<CreatePlayerRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createPlayer>>, TError, {
    data: BodyType<CreatePlayerRequest>;
}, TContext>;
/**
 * @summary Top players by career goals and games played
 */
export declare const getListTopPlayersUrl: (params?: ListTopPlayersParams) => string;
export declare const listTopPlayers: (params?: ListTopPlayersParams, options?: RequestInit) => Promise<PlayerSummary[]>;
export declare const getListTopPlayersQueryKey: (params?: ListTopPlayersParams) => readonly ["/api/players/top", ...ListTopPlayersParams[]];
export declare const getListTopPlayersQueryOptions: <TData = Awaited<ReturnType<typeof listTopPlayers>>, TError = ErrorType<unknown>>(params?: ListTopPlayersParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listTopPlayers>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listTopPlayers>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListTopPlayersQueryResult = NonNullable<Awaited<ReturnType<typeof listTopPlayers>>>;
export type ListTopPlayersQueryError = ErrorType<unknown>;
/**
 * @summary Top players by career goals and games played
 */
export declare function useListTopPlayers<TData = Awaited<ReturnType<typeof listTopPlayers>>, TError = ErrorType<unknown>>(params?: ListTopPlayersParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listTopPlayers>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Public player profile with computed stats
 */
export declare const getGetPlayerProfileUrl: (playerId: string) => string;
export declare const getPlayerProfile: (playerId: string, options?: RequestInit) => Promise<PlayerProfile>;
export declare const getGetPlayerProfileQueryKey: (playerId: string) => readonly [`/api/players/${string}`];
export declare const getGetPlayerProfileQueryOptions: <TData = Awaited<ReturnType<typeof getPlayerProfile>>, TError = ErrorType<unknown>>(playerId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPlayerProfile>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getPlayerProfile>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetPlayerProfileQueryResult = NonNullable<Awaited<ReturnType<typeof getPlayerProfile>>>;
export type GetPlayerProfileQueryError = ErrorType<unknown>;
/**
 * @summary Public player profile with computed stats
 */
export declare function useGetPlayerProfile<TData = Awaited<ReturnType<typeof getPlayerProfile>>, TError = ErrorType<unknown>>(playerId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPlayerProfile>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Full edit (admin)
 */
export declare const getUpdatePlayerUrl: (playerId: string) => string;
export declare const updatePlayer: (playerId: string, updatePlayerRequest: UpdatePlayerRequest, options?: RequestInit) => Promise<Player>;
export declare const getUpdatePlayerMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updatePlayer>>, TError, {
        playerId: string;
        data: BodyType<UpdatePlayerRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updatePlayer>>, TError, {
    playerId: string;
    data: BodyType<UpdatePlayerRequest>;
}, TContext>;
export type UpdatePlayerMutationResult = NonNullable<Awaited<ReturnType<typeof updatePlayer>>>;
export type UpdatePlayerMutationBody = BodyType<UpdatePlayerRequest>;
export type UpdatePlayerMutationError = ErrorType<unknown>;
/**
 * @summary Full edit (admin)
 */
export declare const useUpdatePlayer: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updatePlayer>>, TError, {
        playerId: string;
        data: BodyType<UpdatePlayerRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updatePlayer>>, TError, {
    playerId: string;
    data: BodyType<UpdatePlayerRequest>;
}, TContext>;
/**
 * @summary Delete a player (admin)
 */
export declare const getDeletePlayerUrl: (playerId: string) => string;
export declare const deletePlayer: (playerId: string, options?: RequestInit) => Promise<MessageResponse>;
export declare const getDeletePlayerMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deletePlayer>>, TError, {
        playerId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deletePlayer>>, TError, {
    playerId: string;
}, TContext>;
export type DeletePlayerMutationResult = NonNullable<Awaited<ReturnType<typeof deletePlayer>>>;
export type DeletePlayerMutationError = ErrorType<unknown>;
/**
 * @summary Delete a player (admin)
 */
export declare const useDeletePlayer: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deletePlayer>>, TError, {
        playerId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deletePlayer>>, TError, {
    playerId: string;
}, TContext>;
/**
 * @summary Self-edit limited profile fields
 */
export declare const getUpdateMyProfileUrl: (playerId: string) => string;
export declare const updateMyProfile: (playerId: string, selfEditPlayerRequest: SelfEditPlayerRequest, options?: RequestInit) => Promise<Player>;
export declare const getUpdateMyProfileMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateMyProfile>>, TError, {
        playerId: string;
        data: BodyType<SelfEditPlayerRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateMyProfile>>, TError, {
    playerId: string;
    data: BodyType<SelfEditPlayerRequest>;
}, TContext>;
export type UpdateMyProfileMutationResult = NonNullable<Awaited<ReturnType<typeof updateMyProfile>>>;
export type UpdateMyProfileMutationBody = BodyType<SelfEditPlayerRequest>;
export type UpdateMyProfileMutationError = ErrorType<unknown>;
/**
 * @summary Self-edit limited profile fields
 */
export declare const useUpdateMyProfile: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateMyProfile>>, TError, {
        playerId: string;
        data: BodyType<SelfEditPlayerRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateMyProfile>>, TError, {
    playerId: string;
    data: BodyType<SelfEditPlayerRequest>;
}, TContext>;
/**
 * @summary Add a horse to a player's string
 */
export declare const getAddPlayerHorseUrl: (playerId: string) => string;
export declare const addPlayerHorse: (playerId: string, createHorseRequest: CreateHorseRequest, options?: RequestInit) => Promise<Horse>;
export declare const getAddPlayerHorseMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof addPlayerHorse>>, TError, {
        playerId: string;
        data: BodyType<CreateHorseRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof addPlayerHorse>>, TError, {
    playerId: string;
    data: BodyType<CreateHorseRequest>;
}, TContext>;
export type AddPlayerHorseMutationResult = NonNullable<Awaited<ReturnType<typeof addPlayerHorse>>>;
export type AddPlayerHorseMutationBody = BodyType<CreateHorseRequest>;
export type AddPlayerHorseMutationError = ErrorType<unknown>;
/**
 * @summary Add a horse to a player's string
 */
export declare const useAddPlayerHorse: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof addPlayerHorse>>, TError, {
        playerId: string;
        data: BodyType<CreateHorseRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof addPlayerHorse>>, TError, {
    playerId: string;
    data: BodyType<CreateHorseRequest>;
}, TContext>;
/**
 * @summary Remove a horse
 */
export declare const getRemovePlayerHorseUrl: (playerId: string, horseId: string) => string;
export declare const removePlayerHorse: (playerId: string, horseId: string, options?: RequestInit) => Promise<MessageResponse>;
export declare const getRemovePlayerHorseMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof removePlayerHorse>>, TError, {
        playerId: string;
        horseId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof removePlayerHorse>>, TError, {
    playerId: string;
    horseId: string;
}, TContext>;
export type RemovePlayerHorseMutationResult = NonNullable<Awaited<ReturnType<typeof removePlayerHorse>>>;
export type RemovePlayerHorseMutationError = ErrorType<unknown>;
/**
 * @summary Remove a horse
 */
export declare const useRemovePlayerHorse: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof removePlayerHorse>>, TError, {
        playerId: string;
        horseId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof removePlayerHorse>>, TError, {
    playerId: string;
    horseId: string;
}, TContext>;
/**
 * @summary Get the player record linked to the current user, if any
 */
export declare const getGetMyLinkedPlayerUrl: () => string;
export declare const getMyLinkedPlayer: (options?: RequestInit) => Promise<Player | null>;
export declare const getGetMyLinkedPlayerQueryKey: () => readonly ["/api/me/linked-player"];
export declare const getGetMyLinkedPlayerQueryOptions: <TData = Awaited<ReturnType<typeof getMyLinkedPlayer>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMyLinkedPlayer>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getMyLinkedPlayer>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetMyLinkedPlayerQueryResult = NonNullable<Awaited<ReturnType<typeof getMyLinkedPlayer>>>;
export type GetMyLinkedPlayerQueryError = ErrorType<unknown>;
/**
 * @summary Get the player record linked to the current user, if any
 */
export declare function useGetMyLinkedPlayer<TData = Awaited<ReturnType<typeof getMyLinkedPlayer>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMyLinkedPlayer>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Publish a tournament
 */
export declare const getPublishTournamentUrl: (tournamentId: string) => string;
export declare const publishTournament: (tournamentId: string, options?: RequestInit) => Promise<Tournament>;
export declare const getPublishTournamentMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof publishTournament>>, TError, {
        tournamentId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof publishTournament>>, TError, {
    tournamentId: string;
}, TContext>;
export type PublishTournamentMutationResult = NonNullable<Awaited<ReturnType<typeof publishTournament>>>;
export type PublishTournamentMutationError = ErrorType<unknown>;
/**
 * @summary Publish a tournament
 */
export declare const usePublishTournament: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof publishTournament>>, TError, {
        tournamentId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof publishTournament>>, TError, {
    tournamentId: string;
}, TContext>;
export {};
//# sourceMappingURL=api.d.ts.map