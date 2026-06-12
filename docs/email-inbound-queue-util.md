# Email inbound queue utility

Dev-oriented CLI for **document email ingest**: long-poll the optional **tap** SQS queue (same SNS payload as the worker), print **worker + tap** approximate depths, **list** SQS/SNS resources, and **`show --depths`** for all inbound worker and `*-tap` queues — without replacing the application worker.

For **end-to-end ingress architecture** (SES → S3 → SNS → SQS per environment) and Mermaid diagrams, see [`email-ingress-flows.md`](./email-ingress-flows.md).

- **Implementation:** [`tools/aws/email-inbound-queue-util.ts`](../tools/aws/email-inbound-queue-util.ts)
- **CDK / SSM naming:** [`infrastructure/ssm-email-inbound.ts`](../infrastructure/ssm-email-inbound.ts), [`infrastructure/milestone-email-inbound-stack.ts`](../infrastructure/milestone-email-inbound-stack.ts)

## Prerequisites

1. **Tap queues deployed**  
   Deploy `MilestoneEmailInboundStack` with CDK context `emailInboundSnsTapQueues=true` (see [`infrastructure/app.ts`](../infrastructure/app.ts)). That creates a second queue per rail (`<worker-queue-name>-tap`) and SSM parameters under `/milestone/email-inbound/rails/<mailSubdomain>/sqs-tap-queue-url`.

2. **AWS credentials**  
   Same account/region as the queues (for example `AWS_PROFILE`, `AWS_REGION`, or your usual `set -a; source .local.env; set +a` workflow so `AWS_REGION` and queue-related variables are exported).

3. **Dependencies**  
   Uses `chalk` (devDependency) and `@aws-sdk/client-sns`, `@aws-sdk/client-sqs`, `@aws-sdk/client-ssm` (dependencies). Run `npm install` from the repo root.

## Environment variables

| Variable | Role |
| -------- | ---- |
| `EMAIL_INBOUND_TAP_QUEUE_URL` | Optional explicit tap queue URL (highest precedence). |
| `EMAIL_INBOUND_TAP_QUEUE_SSM_PARAMETER` | Optional full SSM parameter name for the tap queue URL (overrides rail-derived path). |
| `EMAIL_INBOUND_SQS_QUEUE_URL` | Worker queue URL; used to infer rail, derive `…-tap` URL, and **worker queue depth** lines. |
| `EMAIL_INBOUND_MAIL_FQDN` | Used with worker URL to resolve rail for SSM when the worker queue name is not one of the built-in rails. |
| `AWS_REGION` / `AWS_DEFAULT_REGION` | Passed to AWS SDK clients. |

If `EMAIL_INBOUND_TAP_QUEUE_URL` is unset, the tool resolves the tap URL in order:

1. `exec --queue-url` CLI argument  
2. `EMAIL_INBOUND_TAP_QUEUE_URL`  
3. SSM `GetParameter` on `/milestone/email-inbound/rails/<subdomain>/sqs-tap-queue-url` (subdomain from worker URL or first label of `EMAIL_INBOUND_MAIL_FQDN`, unless `EMAIL_INBOUND_TAP_QUEUE_SSM_PARAMETER` is set)  
4. Same URL as `EMAIL_INBOUND_SQS_QUEUE_URL` with the last path segment suffixed `-tap`

## Commands

From the **repository root**, with env exported (for example `set -a; source .local.env; set +a`).

The script uses subcommands: **`exec`** (tap long-poll / payload decode / single-rail **`--stats-only`**), **`show`** (read-only AWS inventory), and **`events`** (list or clear **`email_ingest_events`** in Postgres via **`DATABASE_URL`**). For **every inbound worker + tap queue at once**, use **`show --depths`**. Run with no arguments or **`--help`** for top-level usage.

**Direct invocation (primary):**

```bash
npx tsx tools/aws/email-inbound-queue-util.ts exec
npx tsx tools/aws/email-inbound-queue-util.ts exec --verbose
npx tsx tools/aws/email-inbound-queue-util.ts exec --json
npx tsx tools/aws/email-inbound-queue-util.ts exec --stats-only
npx tsx tools/aws/email-inbound-queue-util.ts exec --queue-url 'https://sqs.REGION.amazonaws.com/ACCOUNT/queue-name-tap'
npx tsx tools/aws/email-inbound-queue-util.ts exec --no-delete
npx tsx tools/aws/email-inbound-queue-util.ts show --sqs
npx tsx tools/aws/email-inbound-queue-util.ts show --sqs --prefix milestone
npx tsx tools/aws/email-inbound-queue-util.ts show --sns
npx tsx tools/aws/email-inbound-queue-util.ts show --sqs --sns
npx tsx tools/aws/email-inbound-queue-util.ts show --depths
npx tsx tools/aws/email-inbound-queue-util.ts show --depths --prefix milestone-email-inbound-notify-dev
npx tsx tools/aws/email-inbound-queue-util.ts events list
npx tsx tools/aws/email-inbound-queue-util.ts events list --status failed --limit 20
npx tsx tools/aws/email-inbound-queue-util.ts events clear --status failed
npx tsx tools/aws/email-inbound-queue-util.ts events clear --status failed --yes
```

**npm wrappers (optional):** npm scripts call **`exec`** for you; pass extra flags **after** `--`:

```bash
npm run email-inbound:tap-watch -- --verbose
npm run email-inbound:tap-watch:no-delete
npm run email-inbound:tap-watch -- --json --queue-url 'https://sqs....'
npm run email-inbound:queue-stats
npm run email-inbound:sqs-list
npm run email-inbound:sqs-list -- --prefix milestone
npm run email-inbound:sns-list
npm run email-inbound:queues-depths
npm run email-inbound:events-list
npm run email-inbound:events-clear -- --status failed
npm run email-inbound:events-clear -- --status failed --yes
```

## `events`

Requires **`DATABASE_URL`** (same database as the app). Does **not** use AWS for list/clear.

| Command | Effect |
| ------- | ------ |
| **`events list`** | Prints recent rows from **`email_ingest_events`** (default **`--limit`** 50, max 500), newest first. Optional **`--status`** (`pending`, `processing`, `completed`, `failed`). **`--json`** prints a JSON array. |
| **`events clear`** | Requires **`--all`** or **`--status`** with one of `pending`, `processing`, `completed`, `failed`. **Without `--yes`**: dry run — prints how many rows would be deleted and **`count=`**, then exits **0**. **With `--yes`**: deletes those rows. |

Use **`events list`** / **`events clear -h`** for full usage text.

## Flags (`exec`)

| Flag | Effect |
| ---- | ------ |
| *(none)* | Human layout: staged sections (SQS → flow → SNS envelope → payload summary → worker note). Deletes each tap message after printing (default). |
| `--no-delete` | After printing each tap message, **does not** call `DeleteMessage`. Calls **`ChangeMessageVisibility` with `0`** so the message is visible again immediately — use this to inspect **tap backlog** without draining the queue. The same payload can appear again on a later long poll. Does not affect the **worker** queue. No effect with **`--stats-only`**. |
| `--verbose` | Full decoded SNS payload (including S3 record detail or JSON key previews), non-JSON inner `Message` body (up to 500 chars), and SNS signature fields in the envelope section. |
| `--json` | One JSON object per message to stdout (good for piping). Deletes tap messages after emit unless **`--no-delete`** is set. Each object includes **`tapDisposition`**: `deleted` or `released-visibility-0`. SES ingest events may include **`sesCorrelation`** (`sesMailMessageId`, **`sesRawMailS3Uri`**) when the inner payload is an SES receipt. |
| `--stats-only` | No long poll: prints tap (and worker, if `EMAIL_INBOUND_SQS_QUEUE_URL` is set) **approximate** SQS depths (visible / in-flight / delayed) to stdout, then exits. If the worker queue has a **redrive policy**, prints the **DLQ** URL and its depths, plus a short note on how to read “all zeros”. Same tap URL resolution as watch mode. **`npm run email-inbound:queue-stats`** runs this flag via npm. |
| `--queue-url <url>` | Overrides tap queue URL resolution. |
| `-h` / `--help` | Usage text for **`exec`** (or top-level usage when no subcommand is given). |

## `show`

Pass at least one of **`--sqs`**, **`--sns`**, or **`--depths`** (any combination). Output order is always: URL list (**`--sqs`**), then topic list (**`--sns`**), then depth table (**`--depths`**).

| Flag | Effect |
| ---- | ------ |
| `--sqs` | Prints sorted queue URLs from **`ListQueues`**. Omit **`--prefix`** to list **all** queues in the region (can be long). |
| `--sns` | Prints sorted topic ARNs from **`ListTopics`** for the current account/region. |
| `--depths` | Lists queues whose names start with **`--prefix`**, then prints **approximate** visible / in-flight / delayed counts and **redrive (DLQ) target** per queue via **`GetQueueAttributes`** (no consume). **Default prefix** when omitted: **`milestone-email-inbound`** (all three rails’ **worker** queues plus **`*-tap`** queues from CDK). Narrow with e.g. **`--prefix milestone-email-inbound-notify-dev`** for one rail’s worker + tap only. |
| `--prefix <name>` | With **`--sqs`**: optional **`QueueNamePrefix`**. With **`--depths`**: optional name prefix for the depth scan (default **`milestone-email-inbound`** when **`--depths`** is set and prefix is omitted). If both **`--sqs`** and **`--depths`** are set and prefix is omitted, **both** use the same default prefix so URL list and table stay aligned. |
| `-h` / `--help` | Usage text for **`show`**. |

Disable ANSI colors: `NO_COLOR=1` (see [NO_COLOR](https://no-color.org/)).

## Human output (default)

Each received tap message is printed as numbered **steps**:

1. **SQS (tap queue)** — This process: SQS message id, approximate receive count, timestamps.  
2. **Flow** — SES → S3 → SNS, and fan-out to worker + tap.  
3. **SNS envelope** — Topic, SNS `MessageId`, timestamps; inner `Message` shown as `<string, N chars>` unless `--verbose`.  
4. **Payload** — For **SES email receipt** notifications (inner JSON with `mail` + `receipt`), prints **`SES mail.messageId`**, recipients, and **`Raw mail (S3)`** `s3://…` without `--verbose`. For **S3 event** style payloads (`Records`), brief per-record lines. Other shapes: key list only unless `--verbose`.  
5. **Worker** — Reminder that **who** deletes messages on the **worker** queue is not visible from this tool.

**stderr** also prints dim **`[queues · …]`** lines with approximate **visible / in-flight / delayed** counts for the tap queue and (when `EMAIL_INBOUND_SQS_QUEUE_URL` is set) the worker queue:

- **startup** — once when the watcher starts  
- **idle** — after each long-poll window with no tap messages  
- **after tap delete** — after this tool deletes a tap message  

## Queue depth semantics (`--stats-only` and `[queues · …]` lines)

SQS exposes **approximate** counts only; there is **no API to list message bodies** without receiving (and optionally deleting) messages.

| Metric | Meaning |
| ------ | ------- |
| **Visible** | Messages available for `ReceiveMessage` (backlog). |
| **In-flight** | Messages received by *some* consumer and not yet deleted or past visibility timeout (often “being processed”). |
| **Delayed** | Messages not yet visible to consumers. |

When the app **successfully consumes** a worker message, you expect **visible** and/or **in-flight** on the worker queue to drop after `DeleteMessage` (or after visibility timeout if the worker crashed without deleting).

If you **just** saw a tap event but **`--stats-only`** shows **0** on the worker queue, that often means the worker copy was **already deleted** (another process consumed it) or you are sampling **after** processing finished — not necessarily that SNS never delivered to the worker. Check **DLQ** counts in the stats output when configured, app logs for the **SES `mail.messageId`** / **S3 key** from step 4, and that **`EMAIL_INBOUND_SQS_QUEUE_URL`** matches the queue your runtime polls.

## Limitations

- **Not the worker consumer:** This process only **`ReceiveMessage`s** on the **tap** queue. By default it **`DeleteMessage`s** each tap message after printing; with **`--no-delete`** it **`ChangeMessageVisibility(0)`** instead so the tap backlog is not drained. It does not observe the worker queue. Use application logs (correlate S3 key or flow), or CloudTrail data events on the worker queue ARN, for worker-side receives/deletes.  
- **Same payload as worker:** Tap and worker copies are separate SQS messages with the same SNS body; tap handling does **not** affect the worker copy.  
- **Approximate metrics:** CloudWatch and SQS counts can lag slightly.

## CDK reference

Tap queues and SSM paths are defined in the inbound stack when `enableSnsTapQueues` / context `emailInboundSnsTapQueues` is true. See [`infrastructure/README.md`](../infrastructure/README.md) (email ingest section) for deploy notes and parameter layout.
