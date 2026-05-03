import { z } from "zod/v4";
export declare const adminClubMembershipsTable: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "admin_club_memberships";
    schema: undefined;
    columns: {
        userId: import("drizzle-orm/pg-core").PgColumn<{
            name: "user_id";
            tableName: "admin_club_memberships";
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
            tableName: "admin_club_memberships";
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
        role: import("drizzle-orm/pg-core").PgColumn<{
            name: "role";
            tableName: "admin_club_memberships";
            dataType: "string";
            columnType: "PgEnumColumn";
            data: "owner" | "manager";
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: ["owner", "manager"];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        assignedBy: import("drizzle-orm/pg-core").PgColumn<{
            name: "assigned_by";
            tableName: "admin_club_memberships";
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
            tableName: "admin_club_memberships";
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
export declare const insertAdminClubMembershipSchema: z.ZodObject<{
    role: z.ZodEnum<{
        owner: "owner";
        manager: "manager";
    }>;
    userId: z.ZodUUID;
    clubId: z.ZodUUID;
    assignedBy: z.ZodOptional<z.ZodNullable<z.ZodUUID>>;
}, {
    out: {};
    in: {};
}>;
export type InsertAdminClubMembership = z.infer<typeof insertAdminClubMembershipSchema>;
export type AdminClubMembership = typeof adminClubMembershipsTable.$inferSelect;
//# sourceMappingURL=admin-club-memberships.d.ts.map