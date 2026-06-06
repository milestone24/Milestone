import * as schema from "../schema/index.js";
import type { BuildQueryResult, DBQueryConfig, ExtractTablesWithRelations, InferInsertModel, Table, Equal } from "drizzle-orm";
import { assetValues } from "../schema/portfolio-assets.js";
import { PgTable } from "drizzle-orm/pg-core";

export type Schema = typeof schema;
export type TSchema = ExtractTablesWithRelations<Schema>;

export type IncludeRelation<TableName extends keyof TSchema> = DBQueryConfig<
    "one" | "many",
    boolean,
    TSchema,
    TSchema[TableName]
>["with"];

export type InferResultType<
    TableName extends keyof TSchema,
    With extends IncludeRelation<TableName> | undefined = undefined
> = BuildQueryResult<
    TSchema,
    TSchema[TableName],
    {
        with: With;
    }
>;

export type InferInsertType<T> = Omit<T, "id">;




