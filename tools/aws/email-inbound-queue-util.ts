/**
 * CLI utility for **document email inbound** queues and related AWS resources.
 *
 * - **`exec`** — long-poll the optional per-rail *tap* SQS queue (SNS duplicate of the worker feed),
 *   decode SES/SNS payloads, optional `--stats-only` / `--no-delete` (see `--help` on `exec`).
 * - **`show`** — inventory and metrics without consuming messages: `--sqs`, `--sns`, `--depths`.
 * - **`events`** — list or clear **`email_ingest_events`** (`DATABASE_URL`; see `events -h`).
 *
 * Lives under `tools/aws/` with other AWS-oriented helpers.
 *
 * Subcommands:
 * - `exec` — tap long-poll and related flags (see `--help` on `exec`).
 * - `show --sqs` / `show --sns` — list SQS queues (`ListQueues`) or SNS topics (`ListTopics`).
 * - `show --depths` — approximate depths for every queue matching a name prefix (default inbound notify + tap).
 *
 * Resolve queue URL for `exec` (first match wins):
 * 1. `--queue-url` / `EMAIL_INBOUND_TAP_QUEUE_URL`
 * 2. SSM `/milestone/email-inbound/rails/<subdomain>/sqs-tap-queue-url` using
 *    `EMAIL_INBOUND_TAP_QUEUE_SSM_PARAMETER` if set, else rail from
 *    `EMAIL_INBOUND_SQS_QUEUE_URL` or first label of `EMAIL_INBOUND_MAIL_FQDN`
 * 3. Same host/path as `EMAIL_INBOUND_SQS_QUEUE_URL` with queue name suffixed `-tap`
 *
 * With `set -a; source .local.env; set +a`, (2) or (3) usually succeeds without
 * defining `EMAIL_INBOUND_TAP_QUEUE_URL`.
 *
 * Flags (on `exec`): `--json`, `--verbose`, `--stats-only`, `--no-delete` (release tap messages with
 * visibility 0 instead of deleting — inspect backlog without draining the tap queue).
 * Run with `npx tsx tools/aws/email-inbound-queue-util.ts exec …` from repo root; npm
 * scripts in package.json are optional wrappers (`exec` is baked into the npm commands).
 * Periodically prints **approximate** SQS depths (tap + worker when
 * `EMAIL_INBOUND_SQS_QUEUE_URL` is set): **visible** = waiting to be received;
 * **in-flight** = received by a consumer until visibility timeout or `DeleteMessage`
 * (so >0 often means something is processing or stuck); **delayed** = not yet visible.
 * Styling: `chalk` (devDependency); set `NO_COLOR=1` to disable ANSI.
 *
 * Deploy tap queues: `cd infrastructure && npx cdk deploy -c emailInboundSnsTapQueues=true …`
 */

import { ListTopicsCommand, SNSClient } from "@aws-sdk/client-sns";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import {
  ChangeMessageVisibilityCommand,
  DeleteMessageCommand,
  GetQueueAttributesCommand,
  ListQueuesCommand,
  ReceiveMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";
import chalk from "chalk";

/** Must match `infrastructure/ssm-email-inbound.ts` rail queue names. */
const EMAIL_INBOUND_RAILS = [
  { mailSubdomain: "doc-inbound", queueName: "milestone-email-inbound-notify" },
  {
    mailSubdomain: "doc-inbound-staging",
    queueName: "milestone-email-inbound-notify-staging",
  },
  {
    mailSubdomain: "doc-inbound-dev",
    queueName: "milestone-email-inbound-notify-dev",
  },
] as const;

/** Default `ListQueues` name prefix for `show --depths` (worker + `-tap` per rail). */
const DEFAULT_EMAIL_INBOUND_QUEUE_NAME_PREFIX = "milestone-email-inbound";

function queueNameFromQueueUrl(queueUrl: string): string {
  try {
    const u = new URL(queueUrl);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? queueUrl;
  } catch {
    return queueUrl;
  }
}

function inferQueueRole(queueName: string): "tap" | "worker" {
  return queueName.endsWith("-tap") ? "tap" : "worker";
}

function shortDlqHint(arn: string | undefined): string {
  if (!arn) {
    return "—";
  }
  const tail = arn.split(":").pop() ?? arn;
  return tail.length > 40 ? `…${tail.slice(-36)}` : tail;
}

async function listQueueUrls(
  client: SQSClient,
  namePrefix: string | undefined,
): Promise<string[]> {
  const urls: string[] = [];
  let nextToken: string | undefined;
  do {
    const out = await client.send(
      new ListQueuesCommand({
        QueueNamePrefix:
          namePrefix !== undefined && namePrefix.length > 0
            ? namePrefix
            : undefined,
        NextToken: nextToken,
      }),
    );
    if (out.QueueUrls?.length) {
      urls.push(...out.QueueUrls);
    }
    nextToken = out.NextToken;
  } while (nextToken);
  urls.sort((a, b) =>
    queueNameFromQueueUrl(a).localeCompare(queueNameFromQueueUrl(b)),
  );
  return urls;
}

async function printQueueDepthTableForPrefix(
  client: SQSClient,
  namePrefix: string,
): Promise<void> {
  console.log(
    chalk.bold(
      `SQS approximate depths (${namePrefix}*)`,
    ),
  );
  console.log(
    chalk.dim(
      "vis = visible backlog; in-flight = unacked ReceiveMessage; delayed = not yet visible. Counts are approximate.",
    ),
  );
  const urls = await listQueueUrls(client, namePrefix);
  if (urls.length === 0) {
    console.log(chalk.dim("  (no queues matched this prefix)"));
    return;
  }

  const rows: {
    name: string;
    role: string;
    url: string;
    d: QueueDepthSnapshot | undefined;
  }[] = [];
  for (const url of urls) {
    const name = queueNameFromQueueUrl(url);
    const d = await fetchQueueDepths(client, url);
    rows.push({
      name,
      role: inferQueueRole(name),
      url,
      d,
    });
  }

  const nw = Math.max(8, ...rows.map((r) => r.name.length));
  const rw = 6;
  const padEndStr = (s: string, w: number) =>
    s.length >= w ? s.slice(0, w) : s + " ".repeat(w - s.length);
  const padNum = (n: number, w: number) => String(n).padStart(w, " ");
  console.log("");
  console.log(
    `${padEndStr("queue", nw)}  ${padEndStr("role", rw)}  ${padEndStr("vis", 5)}  ${padEndStr("in-fl", 5)}  ${padEndStr("dlay", 5)}  redrive target (DLQ)`,
  );
  console.log(chalk.dim(`${"─".repeat(Math.min(120, nw + rw + 72))}`));
  for (const r of rows) {
    if (!r.d) {
      console.log(
        `${padEndStr(r.name, nw)}  ${padEndStr(r.role, rw)}  ${chalk.yellow("(could not read queue attributes)")}  ${r.url}`,
      );
      continue;
    }
    console.log(
      `${padEndStr(r.name, nw)}  ${padEndStr(r.role, rw)}  ${padNum(r.d.visible, 5)}  ${padNum(r.d.inflight, 5)}  ${padNum(r.d.delayed, 5)}  ${shortDlqHint(r.d.dlqTargetArn)}`,
    );
  }
  console.log("");
  for (const r of rows) {
    console.log(chalk.dim(`  ${r.url}`));
  }
}

function resolveSqsListPrefixForShow(
  wantSqs: boolean,
  wantDepths: boolean,
  explicitPrefix: string,
): string | undefined {
  if (!wantSqs) {
    return undefined;
  }
  if (explicitPrefix.length > 0) {
    return explicitPrefix;
  }
  if (wantDepths) {
    return DEFAULT_EMAIL_INBOUND_QUEUE_NAME_PREFIX;
  }
  return undefined;
}

function resolveDepthsNamePrefix(explicitPrefix: string): string {
  return explicitPrefix.length > 0
    ? explicitPrefix
    : DEFAULT_EMAIL_INBOUND_QUEUE_NAME_PREFIX;
}

function emailInboundTapSqsQueueUrlParameterName(mailSubdomain: string): string {
  return `/milestone/email-inbound/rails/${mailSubdomain}/sqs-tap-queue-url`;
}

function getArgFrom(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  if (i === -1 || i + 1 >= args.length) {
    return undefined;
  }
  return args[i + 1];
}

function mailSubdomainFromWorkerQueueUrl(
  workerQueueUrl: string,
): string | undefined {
  try {
    const u = new URL(workerQueueUrl);
    const parts = u.pathname.split("/").filter(Boolean);
    const queueName = parts[parts.length - 1];
    if (!queueName) {
      return undefined;
    }
    const rail = EMAIL_INBOUND_RAILS.find((r) => r.queueName === queueName);
    return rail?.mailSubdomain;
  } catch {
    return undefined;
  }
}

function mailSubdomainFromMailFqdn(fqdn: string): string | undefined {
  const first = fqdn.trim().split(".")[0];
  if (!first) {
    return undefined;
  }
  return EMAIL_INBOUND_RAILS.some((r) => r.mailSubdomain === first)
    ? first
    : undefined;
}

function tapQueueUrlDerivedFromWorkerQueueUrl(
  workerQueueUrl: string,
): string | undefined {
  try {
    const u = new URL(workerQueueUrl);
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 2) {
      return undefined;
    }
    const queueName = parts[parts.length - 1];
    if (!queueName) {
      return undefined;
    }
    if (queueName.endsWith("-tap")) {
      return u.toString();
    }
    parts[parts.length - 1] = `${queueName}-tap`;
    u.pathname = `/${parts.join("/")}`;
    return u.toString();
  } catch {
    return undefined;
  }
}

async function tapQueueUrlFromSsm(): Promise<string | undefined> {
  const explicit = process.env.EMAIL_INBOUND_TAP_QUEUE_SSM_PARAMETER?.trim();
  const fromWorker = process.env.EMAIL_INBOUND_SQS_QUEUE_URL?.trim();
  const fromFqdn = process.env.EMAIL_INBOUND_MAIL_FQDN?.trim();

  const mailSubdomain =
    explicit && explicit.length > 0
      ? undefined
      : fromWorker
        ? (mailSubdomainFromWorkerQueueUrl(fromWorker) ??
            (fromFqdn ? mailSubdomainFromMailFqdn(fromFqdn) : undefined))
        : fromFqdn
          ? mailSubdomainFromMailFqdn(fromFqdn)
          : undefined;

  const parameterName =
    explicit && explicit.length > 0
      ? explicit
      : mailSubdomain
        ? emailInboundTapSqsQueueUrlParameterName(mailSubdomain)
        : undefined;

  if (!parameterName) {
    return undefined;
  }

  const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;
  const ssm = new SSMClient(region ? { region } : {});
  try {
    const out = await ssm.send(
      new GetParameterCommand({ Name: parameterName }),
    );
    const v = out.Parameter?.Value?.trim();
    return v || undefined;
  } catch {
    return undefined;
  }
}

type QueueDepthSnapshot = {
  readonly visible: number;
  readonly inflight: number;
  readonly delayed: number;
  /** Present when the queue has a redrive (dead-letter) policy. */
  readonly dlqTargetArn?: string;
};

async function fetchQueueDepths(
  client: SQSClient,
  queueUrl: string,
): Promise<QueueDepthSnapshot | undefined> {
  try {
    const out = await client.send(
      new GetQueueAttributesCommand({
        QueueUrl: queueUrl,
        AttributeNames: ["All"],
      }),
    );
    const a = out.Attributes as Record<string, string> | undefined;
    const attrs = a ?? {};
    const visible = Number(attrs.ApproximateNumberOfMessagesVisible ?? "0");
    const inflight = Number(attrs.ApproximateNumberOfMessagesNotVisible ?? "0");
    const delayed = Number(attrs.ApproximateNumberOfMessagesDelayed ?? "0");
    let dlqTargetArn: string | undefined;
    const redrive = attrs.RedrivePolicy;
    if (typeof redrive === "string" && redrive.length > 0) {
      try {
        const parsed = JSON.parse(redrive) as { deadLetterTargetArn?: string };
        if (typeof parsed.deadLetterTargetArn === "string") {
          dlqTargetArn = parsed.deadLetterTargetArn;
        }
      } catch {
        /* ignore malformed RedrivePolicy */
      }
    }
    return {
      visible: Number.isFinite(visible) ? visible : 0,
      inflight: Number.isFinite(inflight) ? inflight : 0,
      delayed: Number.isFinite(delayed) ? delayed : 0,
      dlqTargetArn,
    };
  } catch {
    return undefined;
  }
}

function formatDepths(label: string, d: QueueDepthSnapshot | undefined): string {
  if (!d) {
    return `${label}: (could not read attributes)`;
  }
  return `${label} vis=${d.visible} in-flight=${d.inflight} delayed=${d.delayed}`;
}

async function printQueueDepthsLine(
  client: SQSClient,
  tapUrl: string,
  workerUrl: string | undefined,
  tag: string,
): Promise<void> {
  const tap = await fetchQueueDepths(client, tapUrl);
  const worker =
    workerUrl && workerUrl.length > 0
      ? await fetchQueueDepths(client, workerUrl)
      : undefined;
  const wPart =
    workerUrl && workerUrl.length > 0
      ? formatDepths("worker", worker)
      : "worker: (set EMAIL_INBOUND_SQS_QUEUE_URL)";
  console.error(
    chalk.dim(`[queues · ${tag}] ${formatDepths("tap", tap)} | ${wPart}`),
  );
}

function printDepthsBlock(
  title: string,
  url: string,
  d: QueueDepthSnapshot | undefined,
): void {
  console.log(chalk.bold(title));
  console.log(`  URL       : ${url}`);
  if (!d) {
    console.log(chalk.dim("  (could not read attributes — check URL and IAM)"));
    return;
  }
  console.log(`  Visible   : ${d.visible}  (waiting to be received)`);
  console.log(
    `  In-flight : ${d.inflight}  (received by a consumer; → 0 after delete or visibility timeout)`,
  );
  console.log(`  Delayed   : ${d.delayed}`);
  if (d.dlqTargetArn) {
    console.log(chalk.dim(`  DLQ (ARN) : ${d.dlqTargetArn}`));
  }
}

/** Build HTTPS queue URL from a standard SQS queue ARN. */
function sqsQueueUrlFromArn(arn: string): string | undefined {
  const m = /^arn:aws:sqs:([a-z0-9-]+):(\d+):(.+)$/.exec(arn);
  if (!m) {
    return undefined;
  }
  const [, region, accountId, queueName] = m;
  return `https://sqs.${region}.amazonaws.com/${accountId}/${queueName}`;
}

async function printQueueDepthsReport(
  client: SQSClient,
  tapUrl: string,
  workerUrl: string | undefined,
): Promise<void> {
  console.log(
    chalk.dim(
      "Approximate counts from SQS; there is no API to list message bodies without receiving them.",
    ),
  );
  console.log("");
  const tap = await fetchQueueDepths(client, tapUrl);
  printDepthsBlock("Tap queue (SNS duplicate for inspection)", tapUrl, tap);
  console.log("");
  if (workerUrl && workerUrl.length > 0) {
    const worker = await fetchQueueDepths(client, workerUrl);
    printDepthsBlock("Worker queue (application ingest)", workerUrl, worker);
    if (worker?.dlqTargetArn) {
      const dlqUrl = sqsQueueUrlFromArn(worker.dlqTargetArn);
      console.log("");
      if (dlqUrl) {
        const dlqDepths = await fetchQueueDepths(client, dlqUrl);
        printDepthsBlock(
          "Worker dead-letter queue (RedrivePolicy target)",
          dlqUrl,
          dlqDepths,
        );
      } else {
        console.log(chalk.bold("Worker dead-letter queue"));
        console.log(
          chalk.dim(
            `  Could not derive queue URL from ARN: ${worker.dlqTargetArn}`,
          ),
        );
      }
    }
  } else {
    console.log(chalk.bold("Worker queue"));
    console.log(
      chalk.dim(
        "  Set EMAIL_INBOUND_SQS_QUEUE_URL to compare backlog with the tap queue.",
      ),
    );
  }
  console.log("");
  console.log(
    chalk.dim(
      "Interpreting zeros: tap+worker visible/in-flight/delayed at 0 usually means messages were already deleted (consumed successfully) or never landed on that queue. This tool deletes only the tap copy. If the app did not log a receive, check another runtime or region, IAM/SNS subscription to the worker queue, or the worker DLQ counts above.",
    ),
  );
}

async function resolveTapQueueUrl(execArgs: string[]): Promise<string> {
  const fromArg = getArgFrom(execArgs, "--queue-url");
  if (fromArg?.trim()) {
    return fromArg.trim();
  }
  const fromEnv = process.env.EMAIL_INBOUND_TAP_QUEUE_URL?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  const fromSsm = await tapQueueUrlFromSsm();
  if (fromSsm) {
    return fromSsm;
  }
  const worker = process.env.EMAIL_INBOUND_SQS_QUEUE_URL?.trim();
  if (worker) {
    const derived = tapQueueUrlDerivedFromWorkerQueueUrl(worker);
    if (derived) {
      return derived;
    }
  }
  return "";
}

function safeDecodeS3Key(key: string): string {
  try {
    return decodeURIComponent(key.replace(/\+/g, "%20"));
  } catch {
    return key;
  }
}

function msToIso(ms: string | undefined): string {
  if (!ms) {
    return "(unknown)";
  }
  const n = Number(ms);
  if (!Number.isFinite(n)) {
    return ms;
  }
  return new Date(n).toISOString();
}

function summarizeS3RecordBrief(
  record: Record<string, unknown>,
  index: number,
): string {
  const eventName =
    typeof record.eventName === "string" ? record.eventName : "?";
  const s3 = record.s3 as Record<string, unknown> | undefined;
  const bucket = s3?.bucket as Record<string, unknown> | undefined;
  const obj = s3?.object as Record<string, unknown> | undefined;
  const name =
    bucket && typeof bucket.name === "string" ? bucket.name : "?";
  const key = obj && typeof obj.key === "string" ? obj.key : "?";
  const size = obj && obj.size !== undefined ? String(obj.size) : "?";
  const keyDecoded = safeDecodeS3Key(key);
  return `    Record ${index + 1}: ${eventName}  ${name}  ${keyDecoded}  (${size} bytes)`;
}

function summarizeS3Record(
  record: Record<string, unknown>,
  index: number,
): string[] {
  const lines: string[] = [];
  const eventName =
    typeof record.eventName === "string" ? record.eventName : "?";
  const src =
    typeof record.eventSource === "string" ? record.eventSource : "?";
  lines.push(`    Record ${index + 1}  (${src})`);
  lines.push(`      Event   : ${eventName}`);
  const s3 = record.s3 as Record<string, unknown> | undefined;
  if (s3) {
    const bucket = s3.bucket as Record<string, unknown> | undefined;
    const obj = s3.object as Record<string, unknown> | undefined;
    const name =
      bucket && typeof bucket.name === "string" ? bucket.name : "?";
    const key = obj && typeof obj.key === "string" ? obj.key : "?";
    const size = obj && obj.size !== undefined ? String(obj.size) : "?";
    const etag = obj && typeof obj.eTag === "string" ? obj.eTag : "";
    lines.push(`      Bucket  : ${name}`);
    lines.push(`      Key     : ${safeDecodeS3Key(key)}`);
    lines.push(`      Size    : ${size}`);
    if (etag) {
      lines.push(`      ETag    : ${etag}`);
    }
  }
  return lines;
}

function isSesReceiptNotification(obj: Record<string, unknown>): boolean {
  return (
    typeof obj.notificationType === "string" &&
    obj.mail !== null &&
    typeof obj.mail === "object" &&
    obj.receipt !== null &&
    typeof obj.receipt === "object"
  );
}

function eachReceiptAction(
  receipt: Record<string, unknown>,
): Record<string, unknown>[] {
  const actions = receipt.actions;
  if (Array.isArray(actions)) {
    return actions.filter(
      (x): x is Record<string, unknown> =>
        x !== null && typeof x === "object",
    );
  }
  const single = receipt.action;
  if (single !== null && typeof single === "object") {
    return [single as Record<string, unknown>];
  }
  return [];
}

function s3UriFromSesAction(action: Record<string, unknown>): string | undefined {
  const bucket =
    typeof action.bucketName === "string" ? action.bucketName : undefined;
  if (!bucket) {
    return undefined;
  }
  const prefix =
    typeof action.objectKeyPrefix === "string" ? action.objectKeyPrefix : "";
  const key = typeof action.objectKey === "string" ? action.objectKey : "";
  if (key.length > 0) {
    const combined =
      prefix.length > 0 && !key.startsWith(prefix) ? `${prefix}${key}` : key;
    return `s3://${bucket}/${safeDecodeS3Key(combined)}`;
  }
  if (prefix.length > 0) {
    return `s3://${bucket}/${safeDecodeS3Key(prefix)}`;
  }
  return `s3://${bucket}/`;
}

function summarizeSesReceiptNotification(obj: Record<string, unknown>): string[] {
  const lines: string[] = [];
  lines.push(
    `    (Amazon SES receipt — notificationType=${String(obj.notificationType)})`,
  );
  const mail = obj.mail as Record<string, unknown>;
  const mid = mail.messageId;
  if (typeof mid === "string") {
    lines.push(`    SES mail.messageId    : ${mid}`);
  }
  const mts = mail.timestamp;
  if (typeof mts === "string") {
    lines.push(`    SES mail.timestamp    : ${mts}`);
  }
  const src = mail.source;
  if (typeof src === "string") {
    lines.push(`    From (mail.source)    : ${src}`);
  }
  const dest = mail.destination;
  if (Array.isArray(dest) && dest.length > 0) {
    lines.push(`    To (mail.destination) : ${dest.map(String).join(", ")}`);
  }
  const receipt = obj.receipt as Record<string, unknown>;
  const rcpt = receipt.recipients;
  if (
    Array.isArray(rcpt) &&
    rcpt.length > 0 &&
    !(Array.isArray(dest) && dest.length > 0)
  ) {
    lines.push(`    Recipients (receipt)  : ${rcpt.map(String).join(", ")}`);
  }
  let actionIdx = 0;
  for (const act of eachReceiptAction(receipt)) {
    actionIdx += 1;
    const t = typeof act.type === "string" ? act.type : "?";
    if (t === "S3") {
      const loc = s3UriFromSesAction(act);
      lines.push(
        `    Raw mail (S3)         : ${loc ?? "(bucket/key incomplete in payload)"}`,
      );
    } else if (t === "SNS" && typeof act.topicArn === "string") {
      lines.push(`    Receipt action[${actionIdx}] : SNS → ${act.topicArn}`);
    } else if (t === "Lambda" && typeof act.functionArn === "string") {
      lines.push(
        `    Receipt action[${actionIdx}] : Lambda → ${act.functionArn}`,
      );
    } else {
      lines.push(`    Receipt action[${actionIdx}] : type=${t}`);
    }
  }
  return lines;
}

function extractSesCorrelationForJson(
  inner: unknown,
): Record<string, string> | undefined {
  if (inner === null || typeof inner !== "object") {
    return undefined;
  }
  const obj = inner as Record<string, unknown>;
  if (!isSesReceiptNotification(obj)) {
    return undefined;
  }
  const mail = obj.mail as Record<string, unknown>;
  const mid = mail.messageId;
  const receipt = obj.receipt as Record<string, unknown>;
  let sesRawMailS3Uri: string | undefined;
  for (const act of eachReceiptAction(receipt)) {
    if (act.type === "S3") {
      sesRawMailS3Uri = s3UriFromSesAction(act);
      break;
    }
  }
  const out: Record<string, string> = {};
  if (typeof mid === "string") {
    out.sesMailMessageId = mid;
  }
  if (sesRawMailS3Uri) {
    out.sesRawMailS3Uri = sesRawMailS3Uri;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function describeInnerPayload(inner: unknown, verbose: boolean): string[] {
  const lines: string[] = [];
  if (inner === null || inner === undefined) {
    lines.push("    (empty)");
    return lines;
  }
  if (typeof inner !== "object") {
    lines.push(`    ${String(inner)}`);
    return lines;
  }
  const obj = inner as Record<string, unknown>;
  const records = obj.Records;
  if (Array.isArray(records) && records.length > 0) {
    lines.push("    (S3 notification — inbound raw mail object)");
    let i = 0;
    for (const r of records) {
      if (r && typeof r === "object") {
        const rec = r as Record<string, unknown>;
        if (verbose) {
          lines.push(...summarizeS3Record(rec, i));
        } else {
          lines.push(summarizeS3RecordBrief(rec, i));
        }
        i += 1;
      }
    }
    if (!verbose) {
      lines.push(
        chalk.dim("    [full S3 record fields omitted — use --verbose]"),
      );
    }
    return lines;
  }
  if (isSesReceiptNotification(obj)) {
    lines.push(...summarizeSesReceiptNotification(obj));
    if (verbose) {
      lines.push("    (additional top-level keys — preview)");
      for (const k of Object.keys(obj).slice(0, 20)) {
        const v = obj[k];
        const preview =
          typeof v === "string"
            ? v.length > 120
              ? `${v.slice(0, 117)}…`
              : v
            : JSON.stringify(v);
        lines.push(`      ${k}: ${preview}`);
      }
      if (Object.keys(obj).length > 20) {
        lines.push(
          chalk.dim(`      … ${Object.keys(obj).length - 20} more keys`),
        );
      }
    } else {
      lines.push(
        chalk.dim(
          "    [other mail/receipt fields omitted — use --verbose for full JSON]",
        ),
      );
    }
    return lines;
  }
  if (verbose) {
    lines.push("    (JSON — top-level keys)");
    for (const k of Object.keys(obj).slice(0, 20)) {
      const v = obj[k];
      const preview =
        typeof v === "string"
          ? v.length > 120
            ? `${v.slice(0, 117)}…`
            : v
          : JSON.stringify(v);
      lines.push(`      ${k}: ${preview}`);
    }
    if (Object.keys(obj).length > 20) {
      lines.push(chalk.dim(`      … ${Object.keys(obj).length - 20} more keys`));
    }
  } else {
    const keys = Object.keys(obj);
    const sample = keys.slice(0, 8).join(", ");
    lines.push(
      `    Object with ${keys.length} top-level key(s): ${sample}${keys.length > 8 ? " …" : ""}`,
    );
    lines.push(
      chalk.dim("    [values omitted — use --verbose for decoded JSON]"),
    );
  }
  return lines;
}

function parseSnsBody(raw: string): {
  outer: Record<string, unknown> | null;
  inner: unknown;
  innerRaw: string;
} {
  try {
    const outer = JSON.parse(raw) as Record<string, unknown>;
    const msg = outer.Message;
    if (typeof msg !== "string") {
      return { outer, inner: null, innerRaw: "" };
    }
    try {
      return { outer, inner: JSON.parse(msg) as unknown, innerRaw: msg };
    } catch {
      return { outer, inner: null, innerRaw: msg };
    }
  } catch {
    return { outer: null, inner: null, innerRaw: raw };
  }
}

function printHumanReadableEvent(options: {
  eventIndex: number;
  receivedAt: string;
  sqsMessageId: string | undefined;
  attrs: Record<string, string>;
  body: string;
  verbose: boolean;
  workerQueueHint: string | undefined;
}): void {
  const { eventIndex, receivedAt, sqsMessageId, attrs, body, verbose, workerQueueHint } =
    options;
  const sentMs = attrs.SentTimestamp;
  const approxFirst = attrs.ApproximateFirstReceiveTimestamp;
  const receiveCount = attrs.ApproximateReceiveCount ?? "?";

  const { outer, inner, innerRaw } = parseSnsBody(body);

  const width = 62;
  const rule = "═".repeat(width);
  console.log("");
  console.log(chalk.dim(rule));
  console.log(
    `${chalk.bold(`Event ${eventIndex}`)}  ${chalk.dim(receivedAt)}`,
  );
  console.log(chalk.dim(rule));

  console.log("");
  console.log(chalk.bold("1) SQS  ·  tap inspection queue  (this process)"));
  console.log(`    SqsMessageId          : ${sqsMessageId ?? "?"}`);
  console.log(`    Approx receive count  : ${receiveCount}`);
  console.log(`    SentTimestamp (SQS)   : ${msToIso(sentMs)}  (${sentMs ?? "?"})`);
  if (approxFirst) {
    console.log(
      `    First receive (approx): ${msToIso(approxFirst)}  (${approxFirst})`,
    );
  }

  console.log("");
  console.log(chalk.bold("2) Flow  ·  SNS → SQS"));
  console.log(
    "    SES receipt rule wrote raw RFC822 to S3, then published one SNS",
  );
  console.log(
    "    notification. SNS fanned out to:  (a) worker queue  (b) this tap queue.",
  );
  if (workerQueueHint) {
    console.log(`    Worker queue (app)    : ${workerQueueHint}`);
  } else {
    console.log(
      chalk.dim("    Worker queue name     : set EMAIL_INBOUND_SQS_QUEUE_URL to show here"),
    );
  }

  console.log("");
  console.log(chalk.bold("3) SNS  ·  envelope  (what SQS received as the body)"));
  if (!outer) {
    console.log("    (Body is not JSON — raw preview)");
    console.log(
      chalk.dim(`    ${body.slice(0, 400)}${body.length > 400 ? "…" : ""}`),
    );
    console.log("");
    console.log(chalk.bold("4) Payload  ·  decoded SNS Message"));
    console.log(chalk.dim("    (skipped — body was not JSON)"));
    console.log("");
    console.log(chalk.bold("5) Worker  ·  who consumed the *worker* queue?"));
    printWorkerFooter();
    return;
  }

  const topicArn =
    typeof outer.TopicArn === "string" ? outer.TopicArn : "?";
  const shortTopic =
    topicArn.length > 56 ? `…${topicArn.slice(-54)}` : topicArn;
  console.log(`    Type        : ${String(outer.Type ?? "?")}`);
  console.log(`    MessageId   : ${String(outer.MessageId ?? "?")}`);
  console.log(`    TopicArn    : ${shortTopic}`);
  console.log(`    Timestamp   : ${String(outer.Timestamp ?? "?")}`);
  console.log(`    Subject     : ${String(outer.Subject ?? "(none)")}`);
  if (verbose) {
    console.log(`    Signature   : ${String(outer.Signature ?? "").slice(0, 48)}…`);
    console.log(
      `    SigningCert : ${String(outer.SigningCertURL ?? "").slice(0, 64)}…`,
    );
  } else {
    console.log(chalk.dim("    Signature   : [omitted — use --verbose]"));
  }
  const msgStr = outer.Message;
  console.log(
    `    Message     : ${typeof msgStr === "string" ? `<string, ${msgStr.length} chars>` : String(msgStr)}`,
  );

  console.log("");
  console.log(chalk.bold("4) Payload  ·  decoded SNS Message"));
  if (inner !== null && typeof inner === "object") {
    for (const line of describeInnerPayload(inner, verbose)) {
      console.log(line);
    }
  } else if (innerRaw.length > 0) {
    console.log("    (Not JSON — inner Message is plain text)");
    if (verbose) {
      console.log(
        chalk.dim(
          `    ${innerRaw.slice(0, 500)}${innerRaw.length > 500 ? "…" : ""}`,
        ),
      );
    } else {
      console.log(
        chalk.dim(
          `    ${innerRaw.length} chars — ${innerRaw.slice(0, 100)}${innerRaw.length > 100 ? "…" : ""}`,
        ),
      );
      console.log(
        chalk.dim("    [full inner text omitted — use --verbose]"),
      );
    }
  } else {
    console.log(chalk.dim("    (no inner Message)"));
  }

  console.log("");
  console.log(chalk.bold("5) Worker  ·  who consumed the *worker* queue?"));
  printWorkerFooter();
}

function printWorkerFooter(): void {
  console.log(
    chalk.dim(
      "    This tool only deletes messages on the tap queue. The app consumes the",
    ),
  );
  console.log(
    chalk.dim(
      "    worker queue separately — you will not see that here. Correlate using",
    ),
  );
  console.log(
    chalk.dim(
      "    SES mail.messageId + Raw mail (S3) in step 4, SQS MessageId in step 1, app logs, or CloudTrail on the worker queue.",
    ),
  );
  console.log(
    chalk.dim(
      "    Queue backlog: stderr [queues · …] lines, or `npx tsx tools/aws/email-inbound-queue-util.ts exec --stats-only` (npm: email-inbound:queue-stats).",
    ),
  );
}

function printJsonEvent(options: {
  receivedAt: string;
  sqsMessageId: string | undefined;
  attrs: Record<string, string>;
  body: string;
  noDelete: boolean;
}): void {
  const { outer, inner } = parseSnsBody(options.body);
  const payload =
    outer && inner !== null && typeof inner === "object"
      ? { sns: outer, payload: inner }
      : outer ?? options.body;
  const sesCorrelation = extractSesCorrelationForJson(inner);
  console.log(
    JSON.stringify(
      {
        receivedAt: options.receivedAt,
        queue: "tap",
        consumer: "email-inbound-queue-util",
        tapDisposition: options.noDelete
          ? "released-visibility-0"
          : "deleted",
        messageId: options.sqsMessageId,
        approximateReceiveCount: options.attrs.ApproximateReceiveCount,
        sentTimestamp: options.attrs.SentTimestamp,
        ...(sesCorrelation ? { sesCorrelation } : {}),
        body: payload,
      },
      null,
      2,
    ),
  );
}

function printGlobalHelp(): void {
  console.error(`Usage (from repository root; export env first, e.g. set -a; source .local.env; set +a):

  npx tsx tools/aws/email-inbound-queue-util.ts exec [flags…]   # tap watch / stats (default behaviour)
  npx tsx tools/aws/email-inbound-queue-util.ts show (--sqs | --sns | --depths | combinations)
  npx tsx tools/aws/email-inbound-queue-util.ts events (list | clear) …

Subcommands:
  exec   Long-poll tap queue (or --stats-only). Run with -h for exec flags and URL resolution.
  show   Inspect account resources. Run show -h for flags.
  events List or clear email_ingest_events (needs DATABASE_URL). Run: … events -h

npm (optional wrappers):
  npm run email-inbound:tap-watch -- [exec flags…]   # exec is baked in
  npm run email-inbound:queue-stats   # exec --stats-only
  npm run email-inbound:sqs-list      # show --sqs (optional: -- --prefix name)
  npm run email-inbound:sns-list      # show --sns
  npm run email-inbound:queues-depths # show --depths (all inbound worker + tap queues)
  npm run email-inbound:events-list
`);
}

const SHOW_SUBCOMMAND_HELP = `Usage:

  npx tsx tools/aws/email-inbound-queue-util.ts show (--sqs | --sns | --depths | combine)

  --sqs     List queue URLs (SQS ListQueues). Optional --prefix filters names; omit prefix to list all queues.
  --sns     List topic ARNs (SNS ListTopics) in the current account/region.
  --depths  For every queue whose name starts with --prefix (default: milestone-email-inbound), print
            approximate visible / in-flight / delayed counts and redrive (DLQ) target when set.
            Use this to see backlog on every real worker queue and every -tap queue at once (no ReceiveMessage).

  --prefix  With --sqs: optional ListQueues name filter. With --depths: optional; default is milestone-email-inbound.
            When both --sqs and --depths are used without --prefix, both use the same default prefix above.

Sections print in order: --sqs (URLs), --sns (topics), --depths (table).

npm:
  npm run email-inbound:sqs-list
  npm run email-inbound:sqs-list -- --prefix milestone-email-inbound
  npm run email-inbound:sns-list
  npm run email-inbound:queues-depths
  npm run email-inbound:queues-depths -- --prefix other-prefix`;

async function runShow(showArgs: string[]): Promise<void> {
  const help =
    showArgs.includes("-h") || showArgs.includes("--help");
  const wantSqs = showArgs.includes("--sqs");
  const wantSns = showArgs.includes("--sns");
  const wantDepths = showArgs.includes("--depths");
  if (help) {
    console.error(SHOW_SUBCOMMAND_HELP);
    process.exit(0);
  }
  if (!wantSqs && !wantSns && !wantDepths) {
    console.error(SHOW_SUBCOMMAND_HELP);
    process.exit(1);
  }

  const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;
  const clientConfig = region ? { region } : {};
  const explicitPrefix = getArgFrom(showArgs, "--prefix")?.trim() ?? "";
  const sqsClient =
    wantSqs || wantDepths ? new SQSClient(clientConfig) : undefined;
  const sqsListPrefix = resolveSqsListPrefixForShow(
    wantSqs,
    wantDepths,
    explicitPrefix,
  );
  const depthsPrefix = wantDepths
    ? resolveDepthsNamePrefix(explicitPrefix)
    : "";

  if (wantSqs && sqsClient) {
    const urls = await listQueueUrls(sqsClient, sqsListPrefix);
    const labelPrefix =
      sqsListPrefix !== undefined && sqsListPrefix.length > 0
        ? ` prefix="${sqsListPrefix}"`
        : " (all queues in region)";
    console.log(chalk.bold(`SQS queues (${urls.length})${labelPrefix}:`));
    for (const url of urls) {
      console.log(`  ${url}`);
    }
  }

  if (wantSns) {
    if (wantSqs) {
      console.log();
    }
    const snsClient = new SNSClient(clientConfig);
    const arns: string[] = [];
    let snsNext: string | undefined;
    do {
      const out = await snsClient.send(
        new ListTopicsCommand({ NextToken: snsNext }),
      );
      for (const t of out.Topics ?? []) {
        if (t.TopicArn) {
          arns.push(t.TopicArn);
        }
      }
      snsNext = out.NextToken;
    } while (snsNext);

    arns.sort();
    console.log(chalk.bold(`SNS topics (${arns.length}):`));
    for (const arn of arns) {
      console.log(`  ${arn}`);
    }
  }

  if (wantDepths && sqsClient) {
    if (wantSqs || wantSns) {
      console.log();
    }
    await printQueueDepthTableForPrefix(sqsClient, depthsPrefix);
  }
}

async function runExec(execArgs: string[]): Promise<void> {
  const help =
    execArgs.includes("-h") || execArgs.includes("--help");
  const jsonMode = execArgs.includes("--json");
  const verbose = execArgs.includes("--verbose");
  const statsOnly = execArgs.includes("--stats-only");
  const noDelete = execArgs.includes("--no-delete");
  const queueUrl = help ? "" : await resolveTapQueueUrl(execArgs);

  if (help || !queueUrl) {
    console.error(`Usage (from repository root; export env first, e.g. set -a; source .local.env; set +a):

  npx tsx tools/aws/email-inbound-queue-util.ts exec
  npx tsx tools/aws/email-inbound-queue-util.ts exec --queue-url <tap-queue-url>
  npx tsx tools/aws/email-inbound-queue-util.ts exec --json
  npx tsx tools/aws/email-inbound-queue-util.ts exec --verbose
  npx tsx tools/aws/email-inbound-queue-util.ts exec --stats-only
  npx tsx tools/aws/email-inbound-queue-util.ts exec --no-delete

Flags:
  --json          One JSON object per tap message to stdout (deletes tap messages after emit unless
                  combined with --no-delete; JSON includes tapDisposition).
  --verbose       Full decoded SNS payload, S3 record detail, SNS signature fields.
  --no-delete     Do not delete tap messages after printing; use ChangeMessageVisibility(0) so each
                  message becomes visible again immediately (inspect backlog without draining the tap queue).
                  You may see the same message again on later polls. Ignored with --stats-only.
  --stats-only    No long poll: print approximate SQS depths (visible / in-flight / delayed)
                  for tap + worker queues to stdout, then exit. Same URL resolution as watch mode.

Tap queue URL resolution (watch and --stats-only):
  1) --queue-url  2) EMAIL_INBOUND_TAP_QUEUE_URL  3) SSM …/sqs-tap-queue-url
  4) derive from EMAIL_INBOUND_SQS_QUEUE_URL with queue name suffixed -tap

Worker depth line needs EMAIL_INBOUND_SQS_QUEUE_URL (optional for tap-only URL).

npm (optional wrappers; pass flags after --):
  npm run email-inbound:tap-watch -- [flags…]
  npm run email-inbound:queue-stats   # same as exec --stats-only

Requires tap queues deployed (CDK context emailInboundSnsTapQueues=true).`);
    process.exit(help ? 0 : 1);
  }

  const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;
  const client = new SQSClient(region ? { region } : {});
  const workerHint = process.env.EMAIL_INBOUND_SQS_QUEUE_URL?.trim();
  let queueNameFromUrl: string | undefined;
  try {
    const u = new URL(queueUrl);
    const parts = u.pathname.split("/").filter(Boolean);
    queueNameFromUrl = parts[parts.length - 1];
  } catch {
    queueNameFromUrl = undefined;
  }

  if (statsOnly) {
    await printQueueDepthsReport(client, queueUrl, workerHint);
    process.exit(0);
  }

  console.error(
    `[email-inbound-queue-util] ${jsonMode ? "json" : "human"}${noDelete ? " no-delete" : ""}  queue=${queueNameFromUrl ?? queueUrl.slice(0, 48)}…`,
  );
  console.error(
    chalk.dim(
      "[queues] vis = waiting; in-flight = received (not deleted yet); delayed = not yet visible",
    ),
  );
  if (noDelete) {
    console.error(
      chalk.dim(
        "[no-delete] Tap messages are released with visibility 0 after each print (queue is not drained).",
      ),
    );
  }
  await printQueueDepthsLine(client, queueUrl, workerHint, "startup");

  let eventIndex = 0;
  for (;;) {
    const out = await client.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 20,
        AttributeNames: ["All"],
        MessageAttributeNames: ["All"],
      }),
    );

    const messages = out.Messages ?? [];
    if (messages.length === 0) {
      await printQueueDepthsLine(client, queueUrl, workerHint, "idle");
      continue;
    }

    const receivedAt = new Date().toISOString();
    for (const message of messages) {
      eventIndex += 1;
      const body = message.Body ?? "";
      const attrs = message.Attributes ?? {};

      if (jsonMode) {
        printJsonEvent({
          receivedAt,
          sqsMessageId: message.MessageId,
          attrs,
          body,
          noDelete,
        });
      } else {
        printHumanReadableEvent({
          eventIndex,
          receivedAt,
          sqsMessageId: message.MessageId,
          attrs,
          body,
          verbose,
          workerQueueHint: workerHint,
        });
      }

      if (message.ReceiptHandle) {
        if (noDelete) {
          try {
            await client.send(
              new ChangeMessageVisibilityCommand({
                QueueUrl: queueUrl,
                ReceiptHandle: message.ReceiptHandle,
                VisibilityTimeout: 0,
              }),
            );
            await printQueueDepthsLine(
              client,
              queueUrl,
              workerHint,
              "after tap release (--no-delete)",
            );
          } catch (err: unknown) {
            console.error(
              chalk.yellow(
                `[email-inbound-queue-util] ChangeMessageVisibility(0) failed; message may stay in-flight until queue timeout: ${String(err)}`,
              ),
            );
          }
        } else {
          await client.send(
            new DeleteMessageCommand({
              QueueUrl: queueUrl,
              ReceiptHandle: message.ReceiptHandle,
            }),
          );
          await printQueueDepthsLine(
            client,
            queueUrl,
            workerHint,
            "after tap delete",
          );
        }
      }
    }
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    printGlobalHelp();
    process.exit(1);
  }
  const top = argv[0];
  const rest = argv.slice(1);
  if (top === "-h" || top === "--help") {
    printGlobalHelp();
    process.exit(0);
  }
  if (top === "exec") {
    await runExec(rest);
    return;
  }
  if (top === "show") {
    await runShow(rest);
    return;
  }
  if (top === "events") {
    if (!process.env.DATABASE_URL?.trim()) {
      console.error(
        "DATABASE_URL must be set for `events` (e.g. set -a; source .local.env; set +a).",
      );
      process.exit(1);
    }
    const { runEvents } = await import("./email-inbound-queue-util-events.ts");
    await runEvents(rest);
    return;
  }
  console.error(`Unknown command "${top}".`);
  printGlobalHelp();
  process.exit(1);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
