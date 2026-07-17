import {
  AnswerValueSchema,
  EligibilityQuestionIdSchema,
  PreliminaryResultSchema,
  type AnswerValue,
  type EligibilityClassification,
  type EligibilityQuestionId,
  type PreliminaryResult,
} from "./model";

export interface EligibilityQuestion {
  readonly id: EligibilityQuestionId;
  readonly question: string;
  readonly why: string;
  readonly example: string;
  readonly strongAnswer: string;
  readonly owner: string;
  readonly canBlock: boolean;
  readonly ruleRefs: readonly string[];
}

export const ELIGIBILITY_QUESTIONS: readonly EligibilityQuestion[] = [
  {
    id: "soc2_type_ii",
    question: "Is the current report a SOC 2 Type II report?",
    why: "Class A relies on a recent independently assessed alternative framework.",
    example: "The report title states SOC 2 Type II and covers controls operating over a period.",
    strongAnswer: "Yes, confirmed from the signed report.",
    owner: "Compliance owner",
    canBlock: true,
    ruleRefs: ["FRC-CLA-ASF"],
  },
  {
    id: "soc2_fresh",
    question: "Was that assessment completed within the applicable 12-month period?",
    why: "The current Class A alternative-framework rule has a 12-month freshness window.",
    example:
      "The independent assessment was completed less than 12 months before the planned application.",
    strongAnswer: "Yes, with confirmed report and assessment dates.",
    owner: "Compliance owner",
    canBlock: true,
    ruleRefs: ["FRC-CLA-ASF"],
  },
  {
    id: "product_match",
    question: "Does the report cover the product you are considering for Class A?",
    why: "Evidence for a different service may not describe the proposed federal offering.",
    example: "The audited system name and boundaries include the same production service.",
    strongAnswer: "Yes, with documented scope alignment.",
    owner: "GRC and product leadership",
    canBlock: true,
    ruleRefs: ["FRC-CLA-EAM", "MAS-CSO-IIR"],
  },
  {
    id: "federal_differs",
    question: "Will the federal offering differ materially from the audited commercial product?",
    why: "New environments, features, operations, or dependencies can create a scope mismatch.",
    example: "A dedicated federal environment uses a different identity or deployment process.",
    strongAnswer: "No material difference, or every difference is already mapped and assessed.",
    owner: "Engineering or architecture lead",
    canBlock: true,
    ruleRefs: ["MAS-CSO-IIR"],
  },
  {
    id: "carved_out",
    question: "Were important infrastructure or service providers carved out of the report?",
    why: "Carved-out dependencies may affect the Class A boundary and need separate evidence.",
    example: "The cloud host or managed identity service is described using the carve-out method.",
    strongAnswer: "No material carve-outs, or coverage and responsibilities are confirmed.",
    owner: "Compliance and cloud operations",
    canBlock: true,
    ruleRefs: ["FRC-CLA-EAM", "MAS-CSO-IIR"],
  },
  {
    id: "material_exceptions",
    question: "Does the report contain exceptions that could affect this offering?",
    why: "Exceptions need human review before existing evidence can be relied on.",
    example: "A sampled access review was late or an account remained active after termination.",
    strongAnswer: "No material exceptions, or remediation and current evidence are documented.",
    owner: "Compliance owner and control owner",
    canBlock: true,
    ruleRefs: ["FRC-CLA-EAM"],
  },
  {
    id: "cloud_service",
    question: "Is the product operated for customers as a cloud service?",
    why: "FedRAMP certification applies to a defined cloud service offering.",
    example: "Customers access a provider-operated SaaS, PaaS, or hosted API.",
    strongAnswer: "Yes, with a named offering and operating model.",
    owner: "Product leadership",
    canBlock: true,
    ruleRefs: ["FRC-CSO-FCP"],
  },
  {
    id: "federal_use_case",
    question: "Do you have a defined federal use case for the offering?",
    why: "A concrete use case helps establish scope, data handling, and Marketplace preparation.",
    example: "A federal agency would use the SaaS to analyze operational metrics.",
    strongAnswer: "Yes, including expected users and federal customer data.",
    owner: "Federal sales or executive sponsor",
    canBlock: false,
    ruleRefs: ["MKT-CSO-PML", "CDS-CSO-PUB"],
  },
];

export type EligibilityAnswers = Record<EligibilityQuestionId, AnswerValue>;

const LABELS: Record<EligibilityClassification, string> = {
  likely_fit: "Likely fit",
  likely_fit_with_preparation: "Likely fit with preparation work",
  needs_expert_review: "Needs expert review",
  potential_scope_mismatch: "Potential scope mismatch",
  not_currently_eligible: "Not currently eligible",
};

export function evaluateEligibility(input: Record<string, unknown>): PreliminaryResult {
  const answers = Object.fromEntries(
    ELIGIBILITY_QUESTIONS.map(({ id }) => [id, AnswerValueSchema.parse(input[id])]),
  ) as EligibilityAnswers;
  const findings: PreliminaryResult["findings"] = [];
  const blockers: string[] = [];
  const missing: string[] = [];

  for (const question of ELIGIBILITY_QUESTIONS) {
    const value = answers[question.id];
    const concerning =
      value === "not_sure" ||
      (question.id === "federal_differs" ? value === "yes" : value === "no") ||
      ((["carved_out", "material_exceptions"] as EligibilityQuestionId[]).includes(question.id) &&
        value === "yes");
    if (concerning) {
      const uncertain = value === "not_sure";
      const summary = uncertain
        ? `The answer to “${question.question}” needs confirmation.`
        : `The current answer to “${question.question}” may require additional preparation.`;
      findings.push({
        id: `finding-${question.id}`,
        title: uncertain
          ? "Needs confirmation"
          : question.canBlock
            ? "Potential blocker"
            : "Preparation item",
        summary,
        answerRefs: [question.id],
        ruleRefs: [...question.ruleRefs],
        method: "deterministic",
        certainty: uncertain ? "uncertain" : "conditional",
        evidenceNeeded: [
          `Source material or owner confirmation that resolves: ${question.question}`,
        ],
        humanReview: true,
      });
      if (uncertain) missing.push(summary);
      else if (question.canBlock) blockers.push(summary);
    }
  }

  let classification: EligibilityClassification;
  if (
    answers.soc2_type_ii === "no" ||
    answers.soc2_fresh === "no" ||
    answers.cloud_service === "no"
  ) {
    classification = "not_currently_eligible";
  } else if (answers.product_match === "no" || answers.federal_differs === "yes") {
    classification = "potential_scope_mismatch";
  } else if (
    Object.values(answers).includes("not_sure") ||
    answers.carved_out === "yes" ||
    answers.material_exceptions === "yes"
  ) {
    classification = "needs_expert_review";
  } else if (answers.federal_use_case === "no") {
    classification = "likely_fit_with_preparation";
  } else {
    classification = "likely_fit";
  }

  if (findings.length === 0) {
    findings.push({
      id: "finding-preliminary-alignment",
      title: "Preliminary alignment",
      summary:
        "The eight confirmed answers do not identify an immediate eligibility or scope blocker.",
      answerRefs: [...EligibilityQuestionIdSchema.options],
      ruleRefs: ["FRC-CLA-ASF", "FRC-CLA-EAM", "MAS-CSO-IIR"],
      method: "deterministic",
      certainty: "conditional",
      evidenceNeeded: [
        "Confirmed report dates, system scope, exceptions, and supporting assessment materials.",
      ],
      humanReview: true,
    });
  }

  const actionsByClass: Record<EligibilityClassification, [string, string, string]> = {
    likely_fit: [
      "Confirm SOC 2 report dates and system name.",
      "Build the proposed Class A scope inventory.",
      "Collect the external assessment materials checklist.",
    ],
    likely_fit_with_preparation: [
      "Define the federal use case and expected data.",
      "Confirm the proposed offering boundary.",
      "Collect current SOC 2 assessment materials.",
    ],
    needs_expert_review: [
      "Resolve the highest-impact uncertain answer.",
      "Collect evidence for carved-out services or exceptions.",
      "Request an expert scope and interpretation review.",
    ],
    potential_scope_mismatch: [
      "Compare the audited system to the proposed federal offering.",
      "Document every federal-offering difference and dependency.",
      "Resolve the scope mismatch with technical and compliance owners.",
    ],
    not_currently_eligible: [
      "Confirm the applicable alternative-framework and freshness requirements.",
      "Plan a qualifying independent assessment for the offering.",
      "Re-run the preliminary assessment when the starting requirement is met.",
    ],
  };
  const reasons = findings.map(({ summary }) => summary);
  const summary =
    classification === "likely_fit"
      ? "Your confirmed answers indicate a likely Class A fit, subject to source-document, scope, and provider review."
      : `${LABELS[classification]} based on the answers provided; review the findings before relying on this result.`;

  return PreliminaryResultSchema.parse({
    classification,
    label: LABELS[classification],
    summary,
    reasons,
    supportingAnswerIds: [...EligibilityQuestionIdSchema.options],
    blockers,
    missingInformation: missing,
    recommendedActions: actionsByClass[classification],
    ruleRefs: [...new Set(findings.flatMap(({ ruleRefs }) => ruleRefs))],
    findings,
    disclaimer:
      "This preliminary result is preparation guidance, not a FedRAMP determination, certification, approval, legal opinion, or guarantee of acceptance.",
    evaluatedAt: new Date().toISOString(),
  });
}
