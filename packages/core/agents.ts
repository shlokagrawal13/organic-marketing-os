import { AITask, draftSchema, sceneSchema, strategySchema } from "./ai";
import { checkContent } from "./content";

export const agentRoles = [
  "chief-marketing-orchestrator",
  "research",
  "brand",
  "audience",
  "strategy",
  "content-ideation",
  "script",
  "creative-director",
  "video-director",
  "editor",
  "seo",
  "aeo-ai-search",
  "localization",
  "publishing",
  "analytics",
  "growth",
  "compliance-safety",
  "community-intelligence",
] as const;
export type AgentRole = (typeof agentRoles)[number];
export type AgentStepKind = "context" | "generate" | "review" | "human";
export type AgentStepPlan = {
  id: string;
  role: AgentRole | "human-reviewer";
  kind: AgentStepKind;
  responsibility: string;
  dependsOn: string[];
};
export type AgentPlan = {
  version: "2026-09-29.1";
  task: AITask;
  steps: AgentStepPlan[];
};

export const agentCatalog: Record<AgentRole, string> = {
  "chief-marketing-orchestrator":
    "Coordinate the graph, compile bounded context and critique the final result.",
  research:
    "Separate supplied evidence from assumptions and identify missing research without inventing current facts.",
  brand: "Apply the frozen Brand Brain and Creative DNA revision.",
  audience:
    "Extract the intended audience, needs and objections from supplied context.",
  strategy: "Turn goals and constraints into an actionable marketing strategy.",
  "content-ideation":
    "Develop differentiated, goal-aligned content directions.",
  script: "Create structured copy, scripts and scene language.",
  "creative-director":
    "Direct hooks, visual identity, format and creative coherence.",
  "video-director":
    "Direct scene purpose, pacing, visuals, sound and transitions.",
  editor: "Improve clarity, continuity, pacing and production readiness.",
  seo: "Map supplied search intent to titles, descriptions and discoverability.",
  "aeo-ai-search":
    "Structure direct, attributable answers for AI search surfaces.",
  localization:
    "Flag language, culture, market, currency, time-zone and seasonal adaptation needs.",
  publishing:
    "Check channel format, timing and handoff requirements without publishing automatically.",
  analytics:
    "Define measurable outcomes and identify unavailable performance evidence.",
  growth:
    "Propose controlled experiments without claiming unobserved effectiveness.",
  "compliance-safety":
    "Detect obvious unsupported guarantees and require review of facts, rights and platform rules.",
  "community-intelligence":
    "Capture supplied questions, objections and community signals without fabricating social data.",
};

const step = (
  id: string,
  role: AgentStepPlan["role"],
  kind: AgentStepKind,
  dependsOn: string[] = [],
): AgentStepPlan => ({
  id,
  role,
  kind,
  responsibility:
    role === "human-reviewer"
      ? "Approve or reject facts, rights, brand fit and platform suitability before downstream use."
      : agentCatalog[role],
  dependsOn,
});

export function buildAgentPlan(task: AITask): AgentPlan {
  const common = [
    step("orchestrate", "chief-marketing-orchestrator", "context"),
    step("research", "research", "context", ["orchestrate"]),
    step("brand", "brand", "context", ["orchestrate"]),
    step("audience", "audience", "context", ["brand"]),
    step("community", "community-intelligence", "context", ["audience"]),
  ];
  const specific: AgentStepPlan[] =
    task === "strategy"
      ? [
          step("analytics", "analytics", "context", ["research"]),
          step("growth", "growth", "context", ["analytics"]),
          step("ideation", "content-ideation", "context", ["audience"]),
          step("seo", "seo", "context", ["research"]),
          step("aeo", "aeo-ai-search", "context", ["research"]),
          step("localization", "localization", "context", ["audience"]),
          step("generate", "strategy", "generate", [
            "growth",
            "ideation",
            "seo",
            "aeo",
            "localization",
            "community",
          ]),
        ]
      : task === "content"
        ? [
            step("strategy", "strategy", "context", ["audience"]),
            step("ideation", "content-ideation", "context", ["strategy"]),
            step("creative", "creative-director", "context", [
              "brand",
              "ideation",
            ]),
            step("seo", "seo", "context", ["research"]),
            step("aeo", "aeo-ai-search", "context", ["research"]),
            step("localization", "localization", "context", ["audience"]),
            step("publishing", "publishing", "context", ["creative"]),
            step("generate", "script", "generate", [
              "creative",
              "seo",
              "aeo",
              "localization",
              "publishing",
              "community",
            ]),
          ]
        : [
            step("script", "script", "context", ["brand"]),
            step("creative", "creative-director", "context", [
              "brand",
              "script",
            ]),
            step("video", "video-director", "context", ["creative"]),
            step("localization", "localization", "context", ["audience"]),
            step("generate", "editor", "generate", [
              "video",
              "localization",
              "community",
            ]),
          ];
  const steps = [
    ...common,
    ...specific,
    step("compliance", "compliance-safety", "review", ["generate"]),
    step("critique", "chief-marketing-orchestrator", "review", ["compliance"]),
    step("human-review", "human-reviewer", "human", ["critique"]),
  ];
  validateAgentPlan(steps);
  return { version: "2026-09-29.1", task, steps };
}

function validateAgentPlan(steps: AgentStepPlan[]) {
  const seen = new Set<string>();
  for (const node of steps) {
    if (seen.has(node.id)) throw new Error(`Duplicate agent step ${node.id}.`);
    for (const dependency of node.dependsOn)
      if (!seen.has(dependency))
        throw new Error(`Agent step ${node.id} has an unresolved dependency.`);
    seen.add(node.id);
  }
}

export function freezeAgentContext<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function contextArtifact(
  node: AgentStepPlan,
  context: Record<string, any>,
) {
  const prompt = String(context.input?.prompt || "");
  const profile = context.brand?.profile || {};
  const creativeDna = context.brand?.creativeDna || {};
  const approvedContent = Array.isArray(context.brand?.approvedContent)
    ? context.brand.approvedContent
    : [];
  return {
    role: node.role,
    responsibility: node.responsibility,
    evidencePolicy:
      "Use only the frozen request and Brand Brain. Missing current or external evidence must remain an assumption or research gap.",
    brandRevision: context.brand?.revision ?? null,
    inputs:
      node.role === "brand"
        ? { profile, creativeDna }
        : node.role === "audience"
          ? { audience: profile.audience ?? profile.targetAudience ?? null }
          : ["strategy", "content-ideation", "analytics", "growth"].includes(
                String(node.role),
              )
            ? { suppliedPrompt: prompt, approvedContent }
            : node.role === "research" || node.role === "community-intelligence"
              ? { suppliedPrompt: prompt, externalEvidence: "not_supplied" }
              : { suppliedPrompt: prompt },
  };
}

export function reviewAgentOutput(task: AITask, value: unknown) {
  if (task === "content") {
    const parsed = draftSchema.parse(value);
    const result = checkContent(parsed);
    return {
      passed: result.passed,
      findings: result.checks,
      requiresHumanReview: true,
    };
  }
  if (task === "scene") {
    const parsed = sceneSchema.parse(value);
    const risky = /guaranteed\s+(viral|results|returns)|will go viral/i.test(
      `${parsed.voiceover} ${parsed.caption} ${parsed.cta}`,
    );
    return {
      passed: !risky,
      findings: [
        {
          label: risky
            ? "Remove unsupported guaranteed-results language"
            : "No obvious guaranteed-results language detected",
          severity: risky ? "block" : "pass",
        },
        {
          label:
            "Human review required for facts, rights and production suitability",
          severity: "warning",
        },
      ],
      requiresHumanReview: true,
    };
  }
  const parsed = strategySchema.parse(value);
  return {
    passed: true,
    findings: [
      {
        label: parsed.assumptions.length
          ? "Assumptions are explicitly recorded"
          : "No assumptions were recorded; verify the strategy has sufficient evidence",
        severity: parsed.assumptions.length ? "pass" : "warning",
      },
      {
        label:
          "Human review required for evidence, feasibility, rights and brand fit",
        severity: "warning",
      },
    ],
    requiresHumanReview: true,
  };
}

export const mappedAgentRoles = () =>
  new Set(
    (["strategy", "content", "scene"] as const).flatMap((task) =>
      buildAgentPlan(task)
        .steps.map((node) => node.role)
        .filter((role): role is AgentRole => role !== "human-reviewer"),
    ),
  );
