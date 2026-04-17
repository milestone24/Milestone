/**
 * `email-inbound-queue-util events …` — list or clear rows in `email_ingest_events`.
 * Requires `DATABASE_URL` (same as the app). Loaded only when the `events` subcommand runs.
 */

import chalk from "chalk";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@server/db";
import {
  emailIngestEvents,
  emailIngestEventStatuses,
  type EmailIngestEventStatus,
} from "@server/db/schema/email-ingest";

function getArgFrom(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  if (i === -1 || i + 1 >= args.length) {
    return undefined;
  }
  return args[i + 1];
}

function isEmailIngestEventStatus(value: string): value is EmailIngestEventStatus {
  return (emailIngestEventStatuses as readonly string[]).includes(value);
}

const EVENTS_SUBCOMMAND_HELP = `Usage:

  npx tsx tools/aws/email-inbound-queue-util.ts events list [--limit <n>] [--status <pending|processing|completed|failed>] [--json]
  npx tsx tools/aws/email-inbound-queue-util.ts events clear (--all | --status <status>) [--yes]

  list     Latest rows from email_ingest_events (default limit 50, max 500).
  clear    Delete rows. Requires either --all or --status <…>.
           Without --yes: prints how many rows would be deleted (dry run, exit 0).
           With --yes: performs the delete.

Requires DATABASE_URL (e.g. set -a; source .local.env; set +a).

npm:
  npm run email-inbound:events-list
  npm run email-inbound:events-clear -- --status failed
  npm run email-inbound:events-clear -- --status failed --yes`;

async function countEvents(whereStatus: EmailIngestEventStatus | undefined): Promise<number> {
  const row =
    whereStatus === undefined
      ? await db
          .select({ c: sql<string>`count(*)::text` })
          .from(emailIngestEvents)
          .then((r) => r[0])
      : await db
          .select({ c: sql<string>`count(*)::text` })
          .from(emailIngestEvents)
          .where(eq(emailIngestEvents.status, whereStatus))
          .then((r) => r[0]);
  const n = Number(row?.c ?? "0");
  return Number.isFinite(n) ? n : 0;
}

async function runEventsList(args: string[]): Promise<void> {
  const help = args.includes("-h") || args.includes("--help");
  const json = args.includes("--json");
  if (help) {
    console.error(EVENTS_SUBCOMMAND_HELP);
    process.exit(0);
  }
  const statusRaw = getArgFrom(args, "--status")?.trim();
  if (statusRaw !== undefined && statusRaw.length > 0 && !isEmailIngestEventStatus(statusRaw)) {
    console.error(
      `Invalid --status "${statusRaw}". Expected one of: ${emailIngestEventStatuses.join(", ")}`,
    );
    process.exit(1);
  }
  const statusFilter: EmailIngestEventStatus | undefined =
    statusRaw && statusRaw.length > 0 && isEmailIngestEventStatus(statusRaw)
      ? statusRaw
      : undefined;

  const limitRaw = getArgFrom(args, "--limit")?.trim();
  const parsed = limitRaw !== undefined ? Number.parseInt(limitRaw, 10) : 50;
  const limit = Number.isFinite(parsed)
    ? Math.min(500, Math.max(1, parsed))
    : 50;

  const rows =
    statusFilter === undefined
      ? await db
          .select()
          .from(emailIngestEvents)
          .orderBy(desc(emailIngestEvents.createdAt))
          .limit(limit)
      : await db
          .select()
          .from(emailIngestEvents)
          .where(eq(emailIngestEvents.status, statusFilter))
          .orderBy(desc(emailIngestEvents.createdAt))
          .limit(limit);

  if (json) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  console.log(
    chalk.bold(`email_ingest_events (${rows.length} row(s), limit=${limit})`),
  );
  if (rows.length === 0) {
    console.log(chalk.dim("  (no rows)"));
    return;
  }
  for (const r of rows) {
    const err =
      r.error && r.error.length > 80 ? `${r.error.slice(0, 77)}…` : (r.error ?? "—");
    console.log(
      `  ${r.id}  ${r.status}  ${r.s3Bucket}  ${r.s3Key}  ${r.createdAt?.toISOString() ?? "?"}  err=${err}`,
    );
  }
}

async function runEventsClear(args: string[]): Promise<void> {
  const help = args.includes("-h") || args.includes("--help");
  if (help) {
    console.error(EVENTS_SUBCOMMAND_HELP);
    process.exit(0);
  }

  const all = args.includes("--all");
  const statusRaw = getArgFrom(args, "--status")?.trim();
  const yes = args.includes("--yes");

  if (all && statusRaw !== undefined && statusRaw.length > 0) {
    console.error("Use either --all or --status <…>, not both.");
    process.exit(1);
  }
  if (!all && (statusRaw === undefined || statusRaw.length === 0)) {
    console.error("clear requires --all or --status <pending|processing|completed|failed>.");
    console.error(EVENTS_SUBCOMMAND_HELP);
    process.exit(1);
  }
  if (!all && statusRaw !== undefined && !isEmailIngestEventStatus(statusRaw)) {
    console.error(
      `Invalid --status "${statusRaw}". Expected one of: ${emailIngestEventStatuses.join(", ")}`,
    );
    process.exit(1);
  }

  const statusFilter: EmailIngestEventStatus | undefined =
    !all && statusRaw && isEmailIngestEventStatus(statusRaw) ? statusRaw : undefined;

  const n = await countEvents(statusFilter);

  if (!yes) {
    const mode = all ? "all rows" : `status=${statusFilter}`;
    console.log(
      chalk.dim(
        `[events clear] dry run: would delete ${n} row(s) (${mode}). Re-run with --yes to delete.`,
      ),
    );
    console.log(chalk.bold(`count=${n}`));
    process.exit(0);
  }

  if (n === 0) {
    console.log(chalk.dim("[events clear] nothing to delete."));
    process.exit(0);
  }

  if (all) {
    await db.delete(emailIngestEvents).where(sql`true`);
  } else if (statusFilter !== undefined) {
    await db.delete(emailIngestEvents).where(eq(emailIngestEvents.status, statusFilter));
  }

  console.log(chalk.bold(`[events clear] deleted ${n} row(s).`));
}

export async function runEvents(rest: string[]): Promise<void> {
  if (rest.length === 0) {
    console.error(EVENTS_SUBCOMMAND_HELP);
    process.exit(1);
  }
  if (rest[0] === "-h" || rest[0] === "--help") {
    console.error(EVENTS_SUBCOMMAND_HELP);
    process.exit(0);
  }
  const sub = rest[0];
  const subRest = rest.slice(1);
  if (sub === "list") {
    await runEventsList(subRest);
    return;
  }
  if (sub === "clear") {
    await runEventsClear(subRest);
    return;
  }
  console.error(EVENTS_SUBCOMMAND_HELP);
  process.exit(1);
}
