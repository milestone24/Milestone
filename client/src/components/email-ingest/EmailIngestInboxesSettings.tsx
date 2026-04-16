import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateEmailIngestInbox,
  useEmailIngestInboxes,
  useRegenerateEmailIngestInbox,
  useRevokeEmailIngestInbox,
  useUpdateEmailIngestInboxAllowedSenders,
} from "@/hooks/use-email-ingest-inboxes";
import {
  emailIngestAllowedSenderSchema,
  emailIngestAllowedSendersSchema,
  emailIngestInboxCreateRequestSchema,
  type EmailIngestInboxResponse,
} from "@shared/schema/email-ingest";
import { AlertCircle, Check, Copy, Mail, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { parseApiRequestError } from "./parse-api-error";

function linesToAllowedSenders(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

const createInboxFormSchema = z.object({
  platformKey: z.string().max(128, "Platform key must be at most 128 characters"),
  allowedSendersText: z.string(),
}).superRefine((data, ctx) => {
  const entries = linesToAllowedSenders(data.allowedSendersText);
  if (entries.length > 200) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "At most 200 allowed senders",
      path: ["allowedSendersText"],
    });
    return;
  }
  for (const entry of entries) {
    const parsed = emailIngestAllowedSenderSchema.safeParse(entry);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid allowed sender";
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: msg,
        path: ["allowedSendersText"],
      });
      return;
    }
  }
});

type CreateInboxFormValues = z.infer<typeof createInboxFormSchema>;

const allowedSendersEditFormSchema = z.object({
  allowedSendersText: z.string().superRefine((val, ctx) => {
    const entries = linesToAllowedSenders(val);
    const parsed = emailIngestAllowedSendersSchema.safeParse(entries);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid allow list";
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: msg,
        path: ["allowedSendersText"],
      });
    }
  }),
});

type AllowedSendersEditFormValues = z.infer<typeof allowedSendersEditFormSchema>;

function formatShortDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function IngestAddressRow({ address }: { address: string | null }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);

  if (address === null) {
    return (
      <Alert className="mt-2">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Ingest address not available</AlertTitle>
        <AlertDescription>
          This environment does not have inbound mail configured (for example the
          server may be missing <span className="font-mono text-xs">EMAIL_INBOUND_MAIL_FQDN</span>).
          You can still manage inboxes; the ingest address will appear here once it is configured.
        </AlertDescription>
      </Alert>
    );
  }

  const handleCopy = async () => {
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
    } catch {
      setCopyError("Could not copy to clipboard.");
    }
  };

  return (
    <div className="mt-2 space-y-1">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
        <code className="text-xs sm:text-sm font-mono break-all rounded-md border bg-muted px-2 py-1.5 flex-1 min-w-0">
          {address}
        </code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => void handleCopy()}
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 mr-1.5" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 mr-1.5" />
              Copy
            </>
          )}
        </Button>
      </div>
      {copyError ? (
        <p className="text-sm text-destructive" role="alert">
          {copyError}
        </p>
      ) : null}
    </div>
  );
}

type EmailIngestAllowedSendersDialogProps = {
  inbox: EmailIngestInboxResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function EmailIngestAllowedSendersDialog({
  inbox,
  open,
  onOpenChange,
}: EmailIngestAllowedSendersDialogProps) {
  const update = useUpdateEmailIngestInboxAllowedSenders(inbox.id);
  const form = useForm<AllowedSendersEditFormValues>({
    resolver: zodResolver(allowedSendersEditFormSchema),
    defaultValues: {
      allowedSendersText: inbox.allowedSenders.join("\n"),
    },
  });

  const onSubmit = async (values: AllowedSendersEditFormValues) => {
    const allowedSenders = linesToAllowedSenders(values.allowedSendersText);
    try {
      await update.mutateAsync({ allowedSenders });
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed";
      form.setError("root", { message: parseApiRequestError(message) });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      key={`${inbox.id}:${inbox.allowedSenders.join("|")}`}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Allowed senders</DialogTitle>
          <DialogDescription>
            Full email (e.g. <span className="font-mono text-xs">statements@broker.com</span>) or
            domain suffix (e.g. <span className="font-mono text-xs">@broker.com</span>). One entry
            per line, up to 200.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="allowedSendersText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Allow list</FormLabel>
                  <FormControl>
                    <Textarea rows={10} className="font-mono text-sm" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {form.formState.errors.root?.message ? (
              <p className="text-sm text-destructive" role="alert">
                {form.formState.errors.root.message}
              </p>
            ) : null}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? "Saving…" : "Save allow list"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

type DangerKind = "revoke" | "regenerate";

type EmailIngestDangerDialogProps = {
  kind: DangerKind | null;
  inbox: EmailIngestInboxResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
  errorMessage: string | null;
};

function EmailIngestDangerDialog({
  kind,
  inbox,
  open,
  onOpenChange,
  onConfirm,
  isPending,
  errorMessage,
}: EmailIngestDangerDialogProps) {
  const title =
    kind === "revoke"
      ? "Revoke this ingest inbox?"
      : kind === "regenerate"
        ? "Regenerate ingest inbox?"
        : "";

  const description =
    kind === "revoke" ? (
      <span>
        Brokers will no longer be able to use this inbox. This cannot be undone, but you can create
        another inbox later.
      </span>
    ) : kind === "regenerate" ? (
      <span>
        A <strong>new</strong> ingest address will be issued. The <strong>old</strong> address will
        stop working immediately. Update any broker forwarding rules to the new address.
      </span>
    ) : null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2 text-left">
            {inbox?.ingestAddress ? (
              <span className="block">
                Current address:{" "}
                <span className="font-mono text-xs text-foreground break-all">
                  {inbox.ingestAddress}
                </span>
              </span>
            ) : null}
            <span className="block">{description}</span>
            {errorMessage ? (
              <span className="block text-destructive" role="alert">
                {errorMessage}
              </span>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <Button
            type="button"
            variant={kind === "revoke" ? "destructive" : "default"}
            disabled={isPending || !kind}
            onClick={() => void onConfirm()}
          >
            {isPending ? "Working…" : kind === "revoke" ? "Revoke inbox" : "Regenerate inbox"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function EmailIngestInboxesSettings() {
  const [includeRevoked, setIncludeRevoked] = useState(false);
  const { data: inboxes, isLoading, isError, refetch, isFetching } = useEmailIngestInboxes({
    includeRevoked,
  });
  const createInbox = useCreateEmailIngestInbox();
  const revokeInbox = useRevokeEmailIngestInbox();
  const regenerateInbox = useRegenerateEmailIngestInbox();

  const [highlightInboxId, setHighlightInboxId] = useState<string | null>(null);
  const [successInbox, setSuccessInbox] = useState<EmailIngestInboxResponse | null>(null);
  const [successKind, setSuccessKind] = useState<"created" | "regenerated" | null>(null);

  const [allowListInbox, setAllowListInbox] = useState<EmailIngestInboxResponse | null>(null);
  const [danger, setDanger] = useState<{
    kind: DangerKind;
    inbox: EmailIngestInboxResponse;
  } | null>(null);
  const [dangerError, setDangerError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  useEffect(() => {
    if (!highlightInboxId) return;
    const t = window.setTimeout(() => setHighlightInboxId(null), 8000);
    return () => window.clearTimeout(t);
  }, [highlightInboxId]);

  const createForm = useForm<CreateInboxFormValues>({
    resolver: zodResolver(createInboxFormSchema),
    defaultValues: {
      platformKey: "",
      allowedSendersText: "",
    },
  });

  const sortedInboxes = useMemo(() => {
    if (!inboxes) return [];
    return [...inboxes].sort((a, b) => {
      const at = new Date(a.createdAt).getTime();
      const bt = new Date(b.createdAt).getTime();
      return bt - at;
    });
  }, [inboxes]);

  const onCreateSubmit = async (values: CreateInboxFormValues) => {
    createForm.clearErrors("root");
    const trimmedKey = values.platformKey.trim();
    const entries = linesToAllowedSenders(values.allowedSendersText);
    const body = emailIngestInboxCreateRequestSchema.parse({
      platformKey: trimmedKey.length > 0 ? trimmedKey : undefined,
      allowedSenders: entries.length > 0 ? entries : undefined,
    });
    try {
      const created = await createInbox.mutateAsync(body);
      setSuccessKind("created");
      setSuccessInbox(created);
      setHighlightInboxId(created.id);
      createForm.reset({ platformKey: "", allowedSendersText: "" });
      setCreateDialogOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed";
      createForm.setError("root", { message: parseApiRequestError(message) });
    }
  };

  const dangerOpen = danger !== null;

  const handleDangerConfirm = async () => {
    if (!danger) return;
    setDangerError(null);
    const { kind, inbox } = danger;
    try {
      if (kind === "revoke") {
        await revokeInbox.mutateAsync(inbox.id);
        setDanger(null);
        setAllowListInbox((current) => (current?.id === inbox.id ? null : current));
      } else {
        const next = await regenerateInbox.mutateAsync(inbox.id);
        setDanger(null);
        setAllowListInbox((current) => (current?.id === inbox.id ? null : current));
        setSuccessKind("regenerated");
        setSuccessInbox(next);
        setHighlightInboxId(next.id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed";
      setDangerError(parseApiRequestError(message));
    }
  };

  const dangerPending =
    danger?.kind === "revoke"
      ? revokeInbox.isPending
      : danger?.kind === "regenerate"
        ? regenerateInbox.isPending
        : false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          Statement email ingest
        </CardTitle>
        <CardDescription>
          Each inbox has a unique address (plus-addressing) for brokers to email statements. The
          verified subdomain is shared; routing uses the short code in the local part.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {successInbox && successKind ? (
          <Alert>
            <Check className="h-4 w-4" />
            <AlertTitle>
              {successKind === "created" ? "Inbox created" : "Inbox regenerated"}
            </AlertTitle>
            <AlertDescription className="space-y-2">
              <p>Use this ingest address with your broker (when available):</p>
              <IngestAddressRow address={successInbox.ingestAddress} />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-0 h-auto text-muted-foreground"
                onClick={() => {
                  setSuccessInbox(null);
                  setSuccessKind(null);
                }}
              >
                Dismiss
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        <Separator />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-medium">Your inboxes</h3>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                createForm.reset({ platformKey: "", allowedSendersText: "" });
                createForm.clearErrors();
                setCreateDialogOpen(true);
              }}
            >
              Add Inbox
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="email-ingest-include-revoked"
              checked={includeRevoked}
              onCheckedChange={setIncludeRevoked}
            />
            <Label htmlFor="email-ingest-include-revoked" className="text-sm font-normal">
              Show revoked
            </Label>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : null}

        {isError ? (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Could not load inboxes.</span>
            <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        ) : null}

        {!isLoading && !isError && sortedInboxes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No inboxes yet. Use <span className="font-medium text-foreground">Add Inbox</span> to
            create one.
          </p>
        ) : null}

        {!isLoading && !isError ? (
          <div className="space-y-4">
            {sortedInboxes.map((inbox) => (
              <div
                key={inbox.id}
                className={[
                  "rounded-lg border p-4 space-y-3",
                  highlightInboxId === inbox.id ? "ring-2 ring-primary/40" : "",
                  isFetching ? "opacity-80" : "",
                ].join(" ")}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {inbox.shortCode}
                      </span>
                      <Badge variant={inbox.status === "active" ? "default" : "secondary"}>
                        {inbox.status === "active" ? "Active" : "Revoked"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Created {formatShortDate(inbox.createdAt)}
                      {inbox.revokedAt ? (
                        <>
                          {" · "}
                          Revoked {formatShortDate(inbox.revokedAt)}
                        </>
                      ) : null}
                    </p>
                    {inbox.platformKey ? (
                      <p className="text-sm">
                        Platform:{" "}
                        <span className="font-medium">{inbox.platformKey}</span>
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">No platform key</p>
                    )}
                    {inbox.replacedByInboxId ? (
                      <p className="text-xs text-muted-foreground">
                        Superseded by inbox{" "}
                        <span className="font-mono">{inbox.replacedByInboxId}</span>
                      </p>
                    ) : null}
                  </div>
                  {inbox.status === "active" ? (
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setAllowListInbox(inbox)}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Allow list
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDangerError(null);
                          setDanger({ kind: "regenerate", inbox });
                        }}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Regenerate
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-destructive border-destructive/40 hover:bg-destructive/10"
                        onClick={() => {
                          setDangerError(null);
                          setDanger({ kind: "revoke", inbox });
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Revoke
                      </Button>
                    </div>
                  ) : null}
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Ingest address
                  </p>
                  <IngestAddressRow address={inbox.ingestAddress} />
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>

      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) {
            createForm.reset({ platformKey: "", allowedSendersText: "" });
            createForm.clearErrors();
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Inbox</DialogTitle>
            <DialogDescription>
              Optional platform label and initial allow list. You can change the allow list after
              creation.
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="platformKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Platform key (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. trading212" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="allowedSendersText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Initial allowed senders (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={4}
                        placeholder={"statements@broker.com\n@broker.com"}
                        className="font-mono text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {createForm.formState.errors.root?.message ? (
                <p className="text-sm text-destructive" role="alert">
                  {createForm.formState.errors.root.message}
                </p>
              ) : null}
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createInbox.isPending}>
                  {createInbox.isPending ? "Creating…" : "Create inbox"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {allowListInbox ? (
        <EmailIngestAllowedSendersDialog
          inbox={allowListInbox}
          open
          onOpenChange={(open) => {
            if (!open) setAllowListInbox(null);
          }}
        />
      ) : null}

      <EmailIngestDangerDialog
        kind={danger?.kind ?? null}
        inbox={danger?.inbox ?? null}
        open={dangerOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDanger(null);
            setDangerError(null);
          }
        }}
        onConfirm={() => void handleDangerConfirm()}
        isPending={dangerPending}
        errorMessage={dangerError}
      />
    </Card>
  );
}
