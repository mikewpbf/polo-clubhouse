import { z } from "zod/v4";
export declare const spectatorFollowsTable: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "spectator_follows";
    schema: undefined;
    columns: {
        userId: import("drizzle-orm/pg-core").PgColumn<{
            name: "user_id";
            tableName: "spectator_follows";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        clubId: import("drizzle-orm/pg-core").PgColumn<{
            name: "club_id";
            tableName: "spectator_follows";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        createdAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "created_at";
            tableName: "spectator_follows";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: false;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
export declare const insertSpectatorFollowSchema: z.ZodObject<{
    clubId: z.ZodUUID;
    userId: z.ZodUUID;
}, {
    out: {};
    in: {};
}>;
export type InsertSpectatorFollow = z.infer<typeof insertSpectatorFollowSchema>;
export type SpectatorFollow = typeof spectatorFollowsTable.$inferSelect;
//# sourceMappingURL=spectator-follows.d.ts.map