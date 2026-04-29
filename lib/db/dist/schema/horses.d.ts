import { z } from "zod/v4";
export declare const horsesTable: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "horses";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/pg-core").PgColumn<{
            name: "id";
            tableName: "horses";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: true;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        playerId: import("drizzle-orm/pg-core").PgColumn<{
            name: "player_id";
            tableName: "horses";
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
        horseName: import("drizzle-orm/pg-core").PgColumn<{
            name: "horse_name";
            tableName: "horses";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: 255;
        }>;
        owner: import("drizzle-orm/pg-core").PgColumn<{
            name: "owner";
            tableName: "horses";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: 255;
        }>;
        breeder: import("drizzle-orm/pg-core").PgColumn<{
            name: "breeder";
            tableName: "horses";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: 255;
        }>;
        ownedAndBredBy: import("drizzle-orm/pg-core").PgColumn<{
            name: "owned_and_bred_by";
            tableName: "horses";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: 255;
        }>;
        sire: import("drizzle-orm/pg-core").PgColumn<{
            name: "sire";
            tableName: "horses";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: 255;
        }>;
        dam: import("drizzle-orm/pg-core").PgColumn<{
            name: "dam";
            tableName: "horses";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: 255;
        }>;
        age: import("drizzle-orm/pg-core").PgColumn<{
            name: "age";
            tableName: "horses";
            dataType: "number";
            columnType: "PgInteger";
            data: number;
            driverParam: string | number;
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
        color: import("drizzle-orm/pg-core").PgColumn<{
            name: "color";
            tableName: "horses";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: 50;
        }>;
        sex: import("drizzle-orm/pg-core").PgColumn<{
            name: "sex";
            tableName: "horses";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: 20;
        }>;
        typeOrBreed: import("drizzle-orm/pg-core").PgColumn<{
            name: "type_or_breed";
            tableName: "horses";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: 255;
        }>;
        notes: import("drizzle-orm/pg-core").PgColumn<{
            name: "notes";
            tableName: "horses";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
export declare const HORSE_SEX_OPTIONS: readonly ["Mare", "Gelding", "Stallion"];
export declare const HORSE_COLOR_OPTIONS: readonly ["Bay", "Chestnut", "Liver Chestnut", "Gray", "Black", "Paint", "Other"];
export declare const insertHorseSchema: z.ZodObject<{
    owner: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    playerId: z.ZodUUID;
    horseName: z.ZodString;
    breeder: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    ownedAndBredBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    sire: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    dam: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    age: z.ZodOptional<z.ZodNullable<z.ZodInt>>;
    color: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    sex: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    typeOrBreed: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, {
    out: {};
    in: {};
}>;
export type InsertHorse = z.infer<typeof insertHorseSchema>;
export type Horse = typeof horsesTable.$inferSelect;
//# sourceMappingURL=horses.d.ts.map