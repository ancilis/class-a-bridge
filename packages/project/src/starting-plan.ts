import type { AnswerValue, EligibilityQuestionId } from "./model";

export interface StartingAction {
  readonly id: string;
  readonly title: string;
  readonly owner: string;
  readonly evidence: string;
  readonly doneWhen: string;
  readonly route: "/soc2-materials" | "/scope" | "/settings" | "/requirements";
  readonly ruleRefs: readonly string[];
}

const tasks: Record<EligibilityQuestionId, StartingAction> = {
  soc2_type_ii: {
    id: "soc2_type_ii",
    title: "Confirm your alternative-framework starting point",
    owner: "Compliance owner",
    evidence:
      "Read the signed report title and opinion. Record whether you have SOC 2 Type II, GovRAMP, or FedRAMP Rev5 materials.",
    doneWhen:
      "The framework and assessment type are documented. If it is not SOC 2 Type II, review the official alternative-framework path before continuing this SOC 2 workflow.",
    route: "/soc2-materials",
    ruleRefs: ["FRC-CLA-ASF"],
  },
  soc2_fresh: {
    id: "soc2_fresh",
    title: "Confirm assessment dates against your application date",
    owner: "Compliance owner and auditor liaison",
    evidence:
      "Collect the assessment completion date, signed report, planned application date, next assessment schedule, and any applicable bridge or gap letter.",
    doneWhen:
      "The completion date is checked against the 12-month requirement; any expired assessment or reporting gap has an agreed resolution. A bridge letter alone does not establish eligibility.",
    route: "/soc2-materials",
    ruleRefs: ["FRC-CLA-ASF", "FRC-CLA-EAM"],
  },
  product_match: {
    id: "product_match",
    title: "Compare the audited system with the federal offering",
    owner: "Compliance and architecture owners",
    evidence:
      "Compare the report system description with the proposed product, environments, data flows, identities, and dependencies.",
    doneWhen:
      "The scope comparison documents what matches, what differs, and which differences require additional assessment or review.",
    route: "/scope",
    ruleRefs: ["FRC-CLA-EAM", "MAS-CSO-IIR"],
  },
  federal_differs: {
    id: "federal_differs",
    title: "Document federal-offering differences",
    owner: "Engineering and architecture owners",
    evidence:
      "List changed environments, features, deployment processes, identity systems, and third-party dependencies.",
    doneWhen:
      "Each difference has an owner, impact explanation, supporting evidence, and a recorded decision on any further assessment needed.",
    route: "/scope",
    ruleRefs: ["MAS-CSO-IIR"],
  },
  carved_out: {
    id: "carved_out",
    title: "Review the providers excluded from your SOC 2 assessment",
    owner: "Compliance and cloud operations",
    evidence:
      "Record each carved-out provider, affected services, available assurance materials, and responsibilities retained by your team.",
    doneWhen:
      "Coverage and shared responsibilities are documented for each provider; unresolved coverage is assigned for expert review.",
    route: "/scope",
    ruleRefs: ["FRC-CLA-EAM", "MAS-CSO-IIR"],
  },
  material_exceptions: {
    id: "material_exceptions",
    title: "Review the exceptions affecting this offering",
    owner: "Compliance and affected control owners",
    evidence:
      "Collect the auditor finding, affected control and period, management response, remediation record, and current operating evidence.",
    doneWhen:
      "Each relevant exception has a documented impact and remediation decision; unresolved reliance on that control is flagged for qualified review.",
    route: "/soc2-materials",
    ruleRefs: ["FRC-CLA-EAM"],
  },
  cloud_service: {
    id: "cloud_service",
    title: "Confirm the provider-operated cloud service boundary",
    owner: "Product and architecture leads",
    evidence:
      "Describe who operates the service, where it runs, what customers access, and which responsibilities belong to customers.",
    doneWhen:
      "A named cloud service offering and operating boundary are documented, or the team has identified that this preparation path does not apply.",
    route: "/scope",
    ruleRefs: ["FRC-CSO-FCP"],
  },
  federal_use_case: {
    id: "federal_use_case",
    title: "Define the federal customer use case",
    owner: "Federal sales and executive sponsor",
    evidence:
      "Describe the intended agency users, work they perform, expected data, and the product capabilities they would use.",
    doneWhen:
      "The team has recorded a concrete use case and proposed data boundary for Marketplace and scope preparation.",
    route: "/scope",
    ruleRefs: ["MKT-CSO-PML", "CDS-CSO-PUB"],
  },
};

const defaults: readonly StartingAction[] = [
  tasks.soc2_fresh,
  tasks.product_match,
  {
    id: "assessment_materials",
    title: "Collect the external assessment materials",
    owner: "Compliance owner",
    evidence:
      "Gather the complete report, applicable bridge or gap letter, verified audit-engagement documentation, next-report schedule, and supplemental evidence.",
    doneWhen:
      "Every checklist item is present, assigned for follow-up, or documented as not applicable with a rationale.",
    route: "/soc2-materials",
    ruleRefs: ["FRC-CLA-EAM"],
  },
];

/** The same tasks drive the assessment screen, work queue and exported plan. */
export function getPreparationActions(answers: Record<string, unknown>): readonly StartingAction[] {
  const priority: readonly EligibilityQuestionId[] = [
    "soc2_type_ii",
    "soc2_fresh",
    "cloud_service",
    "product_match",
    "federal_differs",
    "carved_out",
    "material_exceptions",
    "federal_use_case",
  ];
  const adverse = (id: EligibilityQuestionId, value: unknown) =>
    ["federal_differs", "carved_out", "material_exceptions"].includes(id)
      ? value === "yes"
      : value === "no";
  const selected = priority
    .filter((id) => adverse(id, answers[id]) || answers[id] === "not_sure")
    .map((id) => {
      const task = tasks[id];
      const value = answers[id] as AnswerValue;
      return value === "not_sure"
        ? {
            ...task,
            title: task.title.startsWith("Confirm")
              ? task.title
              : `Confirm: ${task.title.toLowerCase()}`,
          }
        : task;
    });
  for (const task of defaults) {
    if (!selected.some((item) => item.id === task.id)) selected.push(task);
  }
  return selected;
}

export function getStartingActions(answers: Record<string, unknown>): readonly StartingAction[] {
  return getPreparationActions(answers).slice(0, 3);
}
