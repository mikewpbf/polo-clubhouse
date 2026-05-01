import { z } from "zod/v4";
export declare const producerClubMembershipsTable: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "producer_club_memberships";
    schema: undefined;
    columns: {
        userId: import("drizzle-orm/pg-core").PgColumn<{
            name: "user_id";
            tableName: "producer_club_memberships";
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
            tableName: "producer_club_memberships";
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
        assignedBy: import("drizzle-orm/pg-core").PgColumn<{
            name: "assigned_by";
            tableName: "producer_club_memberships";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: false;
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
            tableName: "producer_club_memberships";
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
export declare const insertProducerClubMembershipSchema: z.ZodObject<{
    clubId: z.ZodUUID;
    userId: z.ZodUUID;
    assignedBy: z.ZodOptional<z.ZodNullable<z.ZodUUID>>;
}, {
    out: {};
    in: {};
}>;
export type InsertProducerClubMembership = z.infer<typeof insertProducerClubMembershipSchema>;
export type ProducerClubMembership = typeof producerClubMembershipsTable.$inferSelect;
//# sourceMappingURL=producer-club-memberships.d.ts.map