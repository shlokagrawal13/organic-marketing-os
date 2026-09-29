CREATE TYPE "AgentRunStatus" AS ENUM (
  'RUNNING',
  'AWAITING_REVIEW',
  'APPROVED',
  'REJECTED',
  'FAILED'
);

CREATE TYPE "AgentStepStatus" AS ENUM (
  'PENDING',
  'RUNNING',
  'SUCCEEDED',
  'BLOCKED',
  'WAITING',
  'APPROVED',
  'REJECTED',
  'FAILED'
);

CREATE TABLE "AIAgentRun" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "graphVersion" TEXT NOT NULL,
  "task" TEXT NOT NULL,
  "frozenContext" JSONB NOT NULL,
  "state" "AgentRunStatus" NOT NULL DEFAULT 'RUNNING',
  "finalReview" JSONB,
  "reviewedBy" TEXT,
  "reviewNote" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "AIAgentRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AIAgentStep" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "role" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "responsibility" TEXT NOT NULL,
  "dependencies" JSONB NOT NULL,
  "state" "AgentStepStatus" NOT NULL DEFAULT 'PENDING',
  "inputContext" JSONB NOT NULL,
  "output" JSONB,
  "error" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "AIAgentStep_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AIUsage" ADD COLUMN "agentStepId" TEXT;

CREATE UNIQUE INDEX "AIAgentRun_jobId_key" ON "AIAgentRun"("jobId");
CREATE INDEX "AIAgentRun_organizationId_createdAt_idx" ON "AIAgentRun"("organizationId", "createdAt");
CREATE INDEX "AIAgentRun_state_createdAt_idx" ON "AIAgentRun"("state", "createdAt");
CREATE UNIQUE INDEX "AIAgentStep_runId_key_key" ON "AIAgentStep"("runId", "key");
CREATE INDEX "AIAgentStep_runId_sequence_idx" ON "AIAgentStep"("runId", "sequence");
CREATE INDEX "AIAgentStep_state_startedAt_idx" ON "AIAgentStep"("state", "startedAt");
CREATE INDEX "AIUsage_agentStepId_idx" ON "AIUsage"("agentStepId");

ALTER TABLE "AIAgentRun"
  ADD CONSTRAINT "AIAgentRun_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIAgentRun"
  ADD CONSTRAINT "AIAgentRun_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "AIJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIAgentStep"
  ADD CONSTRAINT "AIAgentStep_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "AIAgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIUsage"
  ADD CONSTRAINT "AIUsage_agentStepId_fkey"
  FOREIGN KEY ("agentStepId") REFERENCES "AIAgentStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;
