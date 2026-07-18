import { SOC2_MAPPING_PLAYBOOKS, type Soc2MappingPlaybook } from "@class-a-bridge/rules";

import {
  BridgeProjectSchema,
  SOC2_REVIEW_OUTCOME_COVERAGE,
  SOC2_SUPPORTING_REVIEW_OUTCOMES,
  Soc2ControlSchema,
  type BridgeProject,
  type Soc2Control,
  type Soc2Mapping,
} from "./model";
import { csvCell } from "./security";

export const SOC2_SUGGESTION_LEVELS = [
  "strong_candidate",
  "possible_candidate",
  "insufficient_information",
  "potential_conflict",
  "expert_review_suggested",
] as const;

export const SOC2_CONTROL_CSV_MAX_BYTES = 5 * 1024 * 1024;

export type Soc2SuggestionLevel = (typeof SOC2_SUGGESTION_LEVELS)[number];
export type Soc2ScopeAlignment = "aligned" | "potential_mismatch" | "not_sure";
export type Soc2PeriodAlignment = "aligned" | "mismatch" | "not_sure";
export type Soc2TestResultStatus =
  "no_exception_reported" | "exception_reported" | "needs_review" | "missing";
export type Soc2ExceptionStatus = "no_exception_reported" | "exception_reported" | "not_sure";

export interface Soc2MappingSuggestion {
  readonly id: string;
  readonly soc2ControlId: string;
  readonly classARuleId: string;
  readonly suggestionLevel: Soc2SuggestionLevel;
  readonly suggestionSource: "deterministic_playbook";
  readonly playbookContentVersion: string;
  readonly playbookEntry: {
    readonly ruleId: string;
    readonly requirementSummary: string;
  };
  readonly reason: string;
  readonly sourceExcerpt: string;
  readonly matchedCriteria: readonly string[];
  readonly matchedKeywords: readonly string[];
  readonly scopeAlignment: Soc2ScopeAlignment;
  readonly periodAlignment: Soc2PeriodAlignment;
  readonly testResultStatus: Soc2TestResultStatus;
  readonly exceptionStatus: Soc2ExceptionStatus;
  readonly missingInformation: readonly string[];
  readonly conflicts: readonly string[];
  readonly confirmed: false;
}

const SUPPORTING_REVIEW_OUTCOMES = new Set<Soc2Mapping["reviewOutcome"]>(
  SOC2_SUPPORTING_REVIEW_OUTCOMES,
);

/** A defensive check used by exports as well as the UI because typed projects can be mutated. */
export const isReviewedSoc2Mapping = (mapping: Soc2Mapping): boolean =>
  mapping.confirmed &&
  Boolean(mapping.reviewOutcome) &&
  Boolean(mapping.reviewer?.trim()) &&
  Boolean(mapping.reviewDate);

/** Only these reviewed outcomes establish supporting reuse; a reviewed rejection or conflict does not. */
export const soc2MappingSupportsReuse = (mapping: Soc2Mapping): boolean =>
  isReviewedSoc2Mapping(mapping) && SUPPORTING_REVIEW_OUTCOMES.has(mapping.reviewOutcome);

export const coverageForSoc2ReviewOutcome = (
  outcome: NonNullable<Soc2Mapping["reviewOutcome"]>,
): Soc2Mapping["coverage"] => SOC2_REVIEW_OUTCOME_COVERAGE[outcome];

export const soc2ReviewOutcomeSupportsReuse = (outcome: Soc2Mapping["reviewOutcome"]): boolean =>
  SUPPORTING_REVIEW_OUTCOMES.has(outcome);

export const isReviewedSoc2Control = (control: Soc2Control): boolean =>
  control.confirmationStatus === "confirmed" &&
  Boolean(control.reviewer?.trim()) &&
  Boolean(control.reviewDate);

export function removeSoc2Control(project: BridgeProject, controlId: string): BridgeProject {
  const next = structuredClone(project);
  next.soc2.controls = next.soc2.controls.filter((control) => control.id !== controlId);
  next.mappings = next.mappings.filter((mapping) => mapping.soc2ControlId !== controlId);
  for (const requirement of next.requirements) {
    requirement.soc2ControlIds = requirement.soc2ControlIds.filter((id) => id !== controlId);
  }
  for (const evidence of next.evidence) {
    evidence.relatedSoc2ControlIds = evidence.relatedSoc2ControlIds.filter(
      (id) => id !== controlId,
    );
  }
  next.metadata.updatedAt = new Date().toISOString();
  return BridgeProjectSchema.parse(next);
}

const normalize = (value: string) =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9.]+/gu, " ")
    .trim();

const searchableText = (control: Soc2Control) =>
  normalize(
    [
      control.title,
      control.description ?? "",
      control.auditorTest,
      control.auditorResult,
      control.excerpt,
      control.notes ?? "",
    ].join(" "),
  );

const includesPhrase = (haystack: string, phrase: string) => {
  const normalizedPhrase = normalize(phrase);
  if (!normalizedPhrase) return false;
  return ` ${haystack} `.includes(` ${normalizedPhrase} `);
};

const criterionWeight = (relationship: string) => {
  if (relationship === "Commonly supporting") return 4;
  if (relationship === "Context-dependent") return 2;
  return 1;
};

const scopeAlignmentFor = (project: BridgeProject, control: Soc2Control): Soc2ScopeAlignment => {
  if (control.scopeAlignment) return control.scopeAlignment;
  const controlScope = normalize(control.systemScope ?? "");
  if (!controlScope) return "not_sure";
  const candidates = [project.offering.name, project.soc2.systemName]
    .map(normalize)
    .filter((value) => value.length >= 4);
  return candidates.some(
    (candidate) => controlScope.includes(candidate) || candidate.includes(controlScope),
  )
    ? "aligned"
    : "potential_mismatch";
};

const periodAlignmentFor = (project: BridgeProject, control: Soc2Control): Soc2PeriodAlignment => {
  if (!control.reportPeriodStart || !control.reportPeriodEnd) return "not_sure";
  if (!project.soc2.reportStart || !project.soc2.reportEnd) return "not_sure";
  return control.reportPeriodStart === project.soc2.reportStart &&
    control.reportPeriodEnd === project.soc2.reportEnd
    ? "aligned"
    : "mismatch";
};

const testResultStatusFor = (control: Soc2Control): Soc2TestResultStatus => {
  const result = normalize(control.auditorResult);
  if (!result) return "missing";
  const unequivocalNegativePattern =
    /\bno (?:exceptions?|deviations?)(?: (?:or|and) (?:exceptions?|deviations?))?(?: (?:were )?(?:identified|noted|reported|observed|found))?\b|\bwithout exception\b/gu;
  const withoutUnequivocalNegative = result.replace(unequivocalNegativePattern, " ");
  if (/\b(exception|deviation|failed|not effective|deficien)/u.test(withoutUnequivocalNegative)) {
    return "exception_reported";
  }
  if (
    /\bno (?:exceptions?|deviations?)(?: (?:or|and) (?:exceptions?|deviations?))?(?: (?:were )?(?:identified|noted|reported|observed|found))?\b|\bwithout exception\b/u.test(
      result,
    )
  )
    return "no_exception_reported";
  if (/\boperated effectively\b/u.test(result)) return "no_exception_reported";
  return "needs_review";
};

const exceptionStatusFor = (
  control: Soc2Control,
  testResultStatus: Soc2TestResultStatus,
): Soc2ExceptionStatus => {
  if (control.exceptionStatus) return control.exceptionStatus;
  if (control.exceptionIds.length > 0 || testResultStatus === "exception_reported")
    return "exception_reported";
  if (testResultStatus === "no_exception_reported") return "no_exception_reported";
  return "not_sure";
};

const stableId = (controlId: string, ruleId: string) => {
  let hash = 0x811c9dc5;
  for (const character of `${controlId}\u0000${ruleId}`) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `soc2-suggestion-${hash.toString(16).padStart(8, "0")}`;
};

const levelRank: Readonly<Record<Soc2SuggestionLevel, number>> = {
  strong_candidate: 0,
  possible_candidate: 1,
  insufficient_information: 2,
  potential_conflict: 3,
  expert_review_suggested: 4,
};

/**
 * Produces explainable reuse candidates from user-confirmed inventory fields and
 * versioned playbooks. It never mutates the project or changes a requirement.
 * project.mappings remains the authoritative list of accepted/rejected review
 * records, so pairs already represented there are not suggested again.
 */
export function suggestSoc2Mappings(
  project: BridgeProject,
  playbooks: readonly Soc2MappingPlaybook[] = SOC2_MAPPING_PLAYBOOKS,
): readonly Soc2MappingSuggestion[] {
  const includedRuleIds = new Set(project.requirements.map(({ ruleId }) => ruleId));
  const existingPairs = new Set(
    project.mappings.map(
      ({ classARuleId, soc2ControlId }) => `${soc2ControlId}\u0000${classARuleId}`,
    ),
  );
  const suggestions: Soc2MappingSuggestion[] = [];

  for (const control of project.soc2.controls) {
    if (control.confirmationStatus === "ignored") continue;
    const controlCriteria = new Set(
      control.trustServicesCriteria.map((criterion) => criterion.trim().toUpperCase()),
    );
    const text = searchableText(control);

    for (const playbook of playbooks) {
      if (!includedRuleIds.has(playbook.ruleId)) continue;
      if (existingPairs.has(`${control.id}\u0000${playbook.ruleId}`)) continue;

      const criterionHints = playbook.trustServicesCriteria.filter((hint) =>
        controlCriteria.has(hint.id.toUpperCase()),
      );
      const matchedCriteria = criterionHints.map(({ id }) => id);
      const matchedKeywords = playbook.keywords.filter((keyword) => includesPhrase(text, keyword));
      if (matchedCriteria.length === 0 && matchedKeywords.length < 2) continue;

      const signalScore =
        criterionHints.reduce((score, hint) => score + criterionWeight(hint.relationship), 0) +
        Math.min(matchedKeywords.length, 3);
      const scopeAlignment = scopeAlignmentFor(project, control);
      const periodAlignment = periodAlignmentFor(project, control);
      const testResultStatus = testResultStatusFor(control);
      const exceptionStatus = exceptionStatusFor(control, testResultStatus);
      const missingInformation: string[] = [];
      const conflicts: string[] = [];

      if (scopeAlignment === "not_sure") missingInformation.push("Confirm scope alignment.");
      if (scopeAlignment === "potential_mismatch") {
        conflicts.push("The control scope may not match the proposed federal offering.");
      }
      if (periodAlignment === "not_sure") {
        missingInformation.push("Confirm the control's applicable audit period.");
      }
      if (periodAlignment === "mismatch") {
        conflicts.push("The control period does not match the confirmed SOC 2 report period.");
      }
      if (testResultStatus === "missing") missingInformation.push("Add the auditor test result.");
      if (!control.auditorTest.trim())
        missingInformation.push("Add the auditor test procedure before relying on this control.");
      if (testResultStatus === "needs_review") {
        missingInformation.push("Review the auditor result before relying on this control.");
      }
      if (testResultStatus === "exception_reported") {
        conflicts.push("The auditor result may contain an exception or failed test.");
      }
      if (exceptionStatus === "exception_reported") {
        conflicts.push("A recorded auditor exception affects this reuse candidate.");
      }
      if (exceptionStatus === "not_sure") {
        missingInformation.push("Confirm whether the auditor reported an exception or deviation.");
      }
      if (control.treatment === "carve_out") {
        conflicts.push("The supporting service or control is recorded as carved out.");
      }
      if (!isReviewedSoc2Control(control)) {
        missingInformation.push("Confirm the extracted or imported SOC 2 control record.");
      }

      let suggestionLevel: Soc2SuggestionLevel;
      if (exceptionStatus === "exception_reported" || control.treatment === "carve_out") {
        suggestionLevel = "expert_review_suggested";
      } else if (
        scopeAlignment === "potential_mismatch" ||
        periodAlignment === "mismatch" ||
        testResultStatus === "exception_reported"
      ) {
        suggestionLevel = "potential_conflict";
      } else if (
        scopeAlignment === "not_sure" ||
        periodAlignment === "not_sure" ||
        testResultStatus === "missing" ||
        !control.auditorTest.trim() ||
        exceptionStatus === "not_sure" ||
        !isReviewedSoc2Control(control)
      ) {
        suggestionLevel = "insufficient_information";
      } else if (signalScore >= 5 && testResultStatus === "no_exception_reported") {
        suggestionLevel = "strong_candidate";
      } else {
        suggestionLevel = "possible_candidate";
      }

      const basis = [
        matchedCriteria.length > 0
          ? `Trust Services Criteria ${matchedCriteria.join(", ")} match the playbook.`
          : "",
        matchedKeywords.length > 0 ? `Control text contains ${matchedKeywords.join(", ")}.` : "",
        conflicts[0] ?? "",
      ].filter(Boolean);

      suggestions.push({
        id: stableId(control.id, playbook.ruleId),
        soc2ControlId: control.id,
        classARuleId: playbook.ruleId,
        suggestionLevel,
        suggestionSource: "deterministic_playbook",
        playbookContentVersion: playbook.contentVersion,
        playbookEntry: {
          ruleId: playbook.ruleId,
          requirementSummary: playbook.requirementSummary,
        },
        reason: basis.join(" "),
        sourceExcerpt: control.excerpt,
        matchedCriteria,
        matchedKeywords,
        scopeAlignment,
        periodAlignment,
        testResultStatus,
        exceptionStatus,
        missingInformation,
        conflicts,
        confirmed: false,
      });
    }
  }

  return suggestions.toSorted(
    (left, right) =>
      levelRank[left.suggestionLevel] - levelRank[right.suggestionLevel] ||
      left.soc2ControlId.localeCompare(right.soc2ControlId) ||
      left.classARuleId.localeCompare(right.classARuleId),
  );
}

export const SOC2_CONTROL_CSV_COLUMNS = [
  "Control identifier",
  "Control title",
  "Control description",
  "Trust Services Criteria",
  "Report pages",
  "Source excerpt",
  "Auditor test procedure",
  "Auditor test result",
  "Exception status",
  "Exception description",
  "Remediation status",
  "Report period start",
  "Report period end",
  "Control frequency",
  "Control owner",
  "System or service scope",
  "Environment",
  "Subservice organization",
  "Inclusive or carve-out treatment",
  "Complementary user-entity control",
  "Complementary subservice-organization control",
  "Evidence references",
  "User confirmation status",
  "Reviewer",
  "Review date",
  "Notes",
] as const;

const csvRow = (values: readonly (string | number | boolean | null | undefined)[]) =>
  values.map(csvCell).join(",");

export function soc2ControlCsvTemplate(): string {
  return `${csvRow(SOC2_CONTROL_CSV_COLUMNS)}\n`;
}

const csvValuesFor = (control: Soc2Control) =>
  [
    control.id,
    control.title,
    control.description ?? "",
    control.trustServicesCriteria.join("; "),
    control.reportPageRange ?? control.reportPages.join("; "),
    control.excerpt,
    control.auditorTest,
    control.auditorResult,
    control.exceptionStatus ?? "",
    control.exceptionDescription ?? "",
    control.remediationStatus ?? "",
    control.reportPeriodStart ?? "",
    control.reportPeriodEnd ?? "",
    control.frequency ?? "",
    control.owner ?? "",
    control.systemScope ?? "",
    control.environment ?? "",
    control.subserviceOrganization ?? "",
    control.treatment ?? "",
    control.complementaryUserEntityControl ?? "",
    control.complementarySubserviceOrganizationControl ?? "",
    control.evidenceReferences?.join("; ") ?? "",
    control.confirmationStatus ?? "",
    control.reviewer ?? "",
    control.reviewDate ?? "",
    control.notes ?? "",
  ] as const;

export function exportSoc2ControlsCsv(controls: readonly Soc2Control[]): string {
  return [
    csvRow(SOC2_CONTROL_CSV_COLUMNS),
    ...controls.map((control) => csvRow(csvValuesFor(control))),
  ].join("\r\n");
}

export interface Soc2CsvIssue {
  readonly row: number;
  readonly column?: string;
  readonly message: string;
}

export interface Soc2CsvParseResult {
  readonly controls: readonly Soc2Control[];
  readonly issues: readonly Soc2CsvIssue[];
}

const parseDelimitedRows = (
  input: string,
  delimiter: "," | "\t",
): { rows: string[][]; malformed: boolean } => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]!;
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
      continue;
    }
    if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === delimiter) {
      row.push(cell);
      cell = "";
    } else if (character === "\n") {
      row.push(cell.replace(/\r$/u, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.replace(/\r$/u, ""));
    rows.push(row);
  }
  return { rows, malformed: quoted };
};

const splitList = (value: string) =>
  value
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);

const parsePages = (value: string): number[] | null => {
  const pages = new Set<number>();
  for (const part of splitList(value.replaceAll(",", ";"))) {
    const range = /^(\d+)-(\d+)$/u.exec(part);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (start < 1 || end < start || end - start > 1_000) return null;
      for (let page = start; page <= end; page += 1) pages.add(page);
      continue;
    }
    if (!/^\d+$/u.test(part) || Number(part) < 1) return null;
    pages.add(Number(part));
  }
  return [...pages].toSorted((left, right) => left - right);
};

const setOptional = (target: Record<string, unknown>, key: string, value: string) => {
  if (value.trim()) target[key] = value.trim();
};

export function parseSoc2ControlsCsv(
  input: string,
  options: { readonly knownEvidenceIds?: readonly string[] } = {},
): Soc2CsvParseResult {
  const issues: Soc2CsvIssue[] = [];
  const knownEvidenceIds = new Set(options.knownEvidenceIds ?? []);
  if (new TextEncoder().encode(input).byteLength > SOC2_CONTROL_CSV_MAX_BYTES) {
    return { controls: [], issues: [{ row: 0, message: "CSV exceeds the 5 MB import limit." }] };
  }
  const normalizedInput = input.replace(/^\uFEFF/u, "");
  const firstLine = normalizedInput.split(/\r?\n/u, 1)[0] ?? "";
  const delimiter = firstLine.includes("\t") && !firstLine.includes(",") ? "\t" : ",";
  const { rows, malformed } = parseDelimitedRows(normalizedInput, delimiter);
  if (malformed) {
    return { controls: [], issues: [{ row: 0, message: "CSV contains an unclosed quote." }] };
  }
  const headers = rows[0] ?? [];
  const indexByColumn = new Map(headers.map((header, index) => [header.trim(), index]));
  const missingColumns = SOC2_CONTROL_CSV_COLUMNS.filter((column) => !indexByColumn.has(column));
  if (missingColumns.length > 0) {
    return {
      controls: [],
      issues: [
        {
          row: 1,
          message: `CSV is missing template columns: ${missingColumns.join(", ")}.`,
        },
      ],
    };
  }

  const value = (row: readonly string[], column: (typeof SOC2_CONTROL_CSV_COLUMNS)[number]) =>
    row[indexByColumn.get(column)!]?.trim() ?? "";
  const controls: Soc2Control[] = [];
  const identifiers = new Set<string>();

  rows.slice(1).forEach((row, rowOffset) => {
    const rowNumber = rowOffset + 2;
    if (row.every((cell) => !cell.trim())) return;
    const identifier = value(row, "Control identifier");
    if (!identifier) {
      issues.push({
        row: rowNumber,
        column: "Control identifier",
        message: "Control identifier is required.",
      });
      return;
    }
    if (identifiers.has(identifier)) {
      issues.push({
        row: rowNumber,
        column: "Control identifier",
        message: `Duplicate control identifier ${identifier}.`,
      });
      return;
    }
    const reportPages = parsePages(value(row, "Report pages"));
    if (!reportPages) {
      issues.push({
        row: rowNumber,
        column: "Report pages",
        message: "Report pages must contain positive pages or ranges such as 42-44.",
      });
      return;
    }

    const candidate: Record<string, unknown> = {
      id: identifier,
      title: value(row, "Control title"),
      trustServicesCriteria: splitList(value(row, "Trust Services Criteria")),
      reportPages,
      auditorTest: value(row, "Auditor test procedure"),
      auditorResult: value(row, "Auditor test result"),
      exceptionIds: [],
      excerpt: value(row, "Source excerpt"),
    };
    setOptional(candidate, "description", value(row, "Control description"));
    setOptional(candidate, "reportPageRange", value(row, "Report pages"));
    setOptional(candidate, "exceptionStatus", value(row, "Exception status"));
    setOptional(candidate, "exceptionDescription", value(row, "Exception description"));
    setOptional(candidate, "remediationStatus", value(row, "Remediation status"));
    setOptional(candidate, "reportPeriodStart", value(row, "Report period start"));
    setOptional(candidate, "reportPeriodEnd", value(row, "Report period end"));
    setOptional(candidate, "frequency", value(row, "Control frequency"));
    setOptional(candidate, "owner", value(row, "Control owner"));
    setOptional(candidate, "systemScope", value(row, "System or service scope"));
    setOptional(candidate, "environment", value(row, "Environment"));
    setOptional(candidate, "subserviceOrganization", value(row, "Subservice organization"));
    setOptional(candidate, "treatment", value(row, "Inclusive or carve-out treatment"));
    setOptional(
      candidate,
      "complementaryUserEntityControl",
      value(row, "Complementary user-entity control"),
    );
    setOptional(
      candidate,
      "complementarySubserviceOrganizationControl",
      value(row, "Complementary subservice-organization control"),
    );
    const evidenceReferences = splitList(value(row, "Evidence references"));
    const unknownEvidenceReferences = evidenceReferences.filter((id) => !knownEvidenceIds.has(id));
    if (unknownEvidenceReferences.length > 0) {
      issues.push({
        row: rowNumber,
        column: "Evidence references",
        message: `Evidence reference${unknownEvidenceReferences.length === 1 ? "" : "s"} ${unknownEvidenceReferences.join(", ")} must already exist in this project.`,
      });
      return;
    }
    if (evidenceReferences.length > 0) candidate.evidenceReferences = evidenceReferences;
    setOptional(candidate, "confirmationStatus", value(row, "User confirmation status"));
    setOptional(candidate, "reviewer", value(row, "Reviewer"));
    setOptional(candidate, "reviewDate", value(row, "Review date"));
    setOptional(candidate, "notes", value(row, "Notes"));

    const parsed = Soc2ControlSchema.safeParse(candidate);
    if (!parsed.success) {
      issues.push({
        row: rowNumber,
        message: parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "row"}: ${issue.message}`)
          .join("; "),
      });
      return;
    }
    identifiers.add(identifier);
    controls.push({ ...parsed.data, confirmationStatus: "unreviewed" });
  });

  return { controls, issues };
}
