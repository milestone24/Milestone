ALTER TABLE "securities" ADD COLUMN "sourceIdentifier" text NOT NULL DEFAULT 'eodhd';
ALTER TABLE "securities" ALTER COLUMN "sourceIdentifier" DROP DEFAULT;
