import { generateCsv, generateHumanReport } from "@class-a-bridge/documents";
import {
  exportSoc2ControlsCsv,
  coverageForSoc2ReviewOutcome,
  isReviewedSoc2Control,
  isReviewedSoc2Mapping,
  parseSoc2ControlsCsv,
  SOC2_CONTROL_CSV_MAX_BYTES,
  soc2MappingSupportsReuse,
  soc2ReviewOutcomeSupportsReuse,
  soc2ControlCsvTemplate,
  suggestSoc2Mappings,
  type BridgeProject,
  type Soc2Mapping,
  type Soc2MappingSuggestion,
} from "@class-a-bridge/project";
import { Button, Callout, Card, Field, StatusPill } from "@class-a-bridge/ui";
import { useMemo, useState, type ChangeEvent } from "react";

import { downloadText } from "../../lib/download";
import "./soc2-reuse.css";

export interface Soc2ReuseProps {
  readonly project: BridgeProject;
  readonly update: (recipe: (draft: BridgeProject) => void) => void;
}

const label = (value: string) =>
  value.replaceAll("_", " ").replace(/^./u, (character) => character.toUpperCase());

const suggestionTone = (
  value: Soc2MappingSuggestion["suggestionLevel"],
): "positive" | "info" | "warning" | "critical" => {
  if (value === "strong_candidate") return "positive";
  if (value === "possible_candidate") return "info";
  if (value === "potential_conflict") return "critical";
  return "warning";
};

const outcomeOptions = [
  ["confirmed_supporting_material", "Confirmed supporting material"],
  ["partial_support", "Partial support"],
  ["supporting_evidence_only", "Supporting evidence only"],
  ["fedramp_specific_work_required", "FedRAMP-specific work required"],
  ["scope_mismatch", "Scope mismatch"],
  ["period_mismatch", "Period mismatch"],
  ["exception_affects_reuse", "Exception affects reuse"],
  ["needs_expert_review", "Needs expert review"],
  ["rejected_mapping", "Rejected mapping"],
] as const satisfies readonly (readonly [NonNullable<Soc2Mapping["reviewOutcome"]>, string])[];

const reviewedOutcomeTone = (
  mapping: Soc2Mapping,
): "positive" | "info" | "warning" | "critical" => {
  if (soc2MappingSupportsReuse(mapping)) return "positive";
  if (mapping.reviewOutcome === "scope_mismatch" || mapping.reviewOutcome === "period_mismatch")
    return "critical";
  if (mapping.reviewOutcome === "rejected_mapping") return "info";
  return "warning";
};

const mappingFromSuggestion = (
  project: BridgeProject,
  suggestion: Soc2MappingSuggestion,
): Soc2Mapping => {
  const control = project.soc2.controls.find(({ id }) => id === suggestion.soc2ControlId);
  return {
    id: `mapping-${crypto.randomUUID()}`,
    soc2ControlId: suggestion.soc2ControlId,
    reportPage: control?.reportPages[0] ?? 1,
    excerpt: suggestion.sourceExcerpt,
    classARuleId: suggestion.classARuleId,
    coverage: "needs_human_review",
    reason: suggestion.reason,
    gapDescription: [...suggestion.conflicts, ...suggestion.missingInformation].join(" "),
    additionalEvidenceNeeded: suggestion.missingInformation.join(" "),
    suggested: true,
    confirmed: false,
    suggestionLevel: suggestion.suggestionLevel,
    suggestionSource: suggestion.suggestionSource,
    playbookContentVersion: suggestion.playbookContentVersion,
    matchedCriteria: [...suggestion.matchedCriteria],
    matchedKeywords: [...suggestion.matchedKeywords],
    suggestionReasons: [suggestion.reason],
    scopeAlignment: suggestion.scopeAlignment,
    periodAlignment: suggestion.periodAlignment,
    testResultStatus: suggestion.testResultStatus,
    exceptionStatus: suggestion.exceptionStatus,
    missingInformation: [...suggestion.missingInformation],
    conflicts: [...suggestion.conflicts],
  };
};

const SummaryMetric = ({
  value,
  labelText,
}: {
  readonly value: number;
  readonly labelText: string;
}) => (
  <div className="soc2-reuse__metric">
    <strong>{value}</strong>
    <span>{labelText}</span>
  </div>
);

export function Soc2Reuse({ project, update }: Soc2ReuseProps) {
  const suggestions = useMemo(() => suggestSoc2Mappings(project), [project]);
  const [pasteValue, setPasteValue] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [importIssues, setImportIssues] = useState<readonly string[]>([]);
  const [reviewErrors, setReviewErrors] = useState<Readonly<Record<string, string>>>({});

  const confirmedControls = project.soc2.controls.filter(isReviewedSoc2Control).length;
  const confirmedMappings = project.mappings.filter(soc2MappingSupportsReuse).length;
  const partialMappings = project.mappings.filter(({ coverage }) =>
    ["partially_covered", "supporting_evidence_only"].includes(coverage),
  ).length;
  const fedrampGaps = project.mappings.filter(({ coverage }) =>
    ["fedramp_specific_work_required", "scope_mismatch", "needs_human_review"].includes(coverage),
  ).length;
  const scopeConflicts = project.mappings.filter(
    ({ coverage, scopeAlignment }) =>
      coverage === "scope_mismatch" || scopeAlignment === "potential_mismatch",
  ).length;
  const periodConflicts = project.mappings.filter(
    ({ periodAlignment, reviewOutcome }) =>
      periodAlignment === "mismatch" || reviewOutcome === "period_mismatch",
  ).length;
  const exceptionConflicts = project.mappings.filter(
    ({ exceptionStatus, reviewOutcome }) =>
      exceptionStatus === "exception_reported" || reviewOutcome === "exception_affects_reuse",
  ).length;
  const carveOutControls = project.soc2.controls.filter(
    ({ treatment }) => treatment === "carve_out",
  ).length;
  const controlsNeedingReview = project.soc2.controls.filter(
    (control) => !isReviewedSoc2Control(control),
  ).length;
  const rulesWithCandidates = new Set([
    ...suggestions.map(({ classARuleId }) => classARuleId),
    ...project.mappings.map(({ classARuleId }) => classARuleId),
  ]);
  const requirementsWithoutCandidate = project.requirements.filter(
    ({ ruleId }) => !rulesWithCandidates.has(ruleId),
  ).length;

  const importControls = (value: string) => {
    const parsed = parseSoc2ControlsCsv(value, {
      knownEvidenceIds: project.evidence.map(({ id }) => id),
    });
    if (parsed.issues.length > 0) {
      setImportIssues(
        parsed.issues.map(
          ({ row, column, message }) =>
            `${row > 0 ? `Row ${row}${column ? `, ${column}` : ""}: ` : ""}${message}`,
        ),
      );
      setImportMessage("No controls were imported. Correct the listed CSV issues and try again.");
      return;
    }
    const existing = new Set(project.soc2.controls.map(({ id }) => id));
    const imported = parsed.controls.filter(({ id }) => !existing.has(id));
    const duplicates = parsed.controls.length - imported.length;
    if (imported.length > 0) {
      update((draft) => {
        draft.soc2.controls.push(...structuredClone(imported));
      });
    }
    setImportIssues(
      duplicates > 0
        ? [
            `${duplicates} control identifier${duplicates === 1 ? " was" : "s were"} already present and not overwritten.`,
          ]
        : [],
    );
    setImportMessage(
      `Imported ${imported.length} control${imported.length === 1 ? "" : "s"} locally. Every imported value remains a suggestion until your team reviews it.`,
    );
    if (imported.length > 0) setPasteValue("");
  };

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > SOC2_CONTROL_CSV_MAX_BYTES) {
      setImportIssues(["The selected CSV exceeds the 5 MB import limit."]);
      setImportMessage("No controls were imported.");
      event.target.value = "";
      return;
    }
    try {
      importControls(await file.text());
    } catch {
      setImportIssues(["The selected file could not be read in this browser."]);
      setImportMessage("No controls were imported.");
    } finally {
      event.target.value = "";
    }
  };

  const updateMapping = (mappingId: string, recipe: (mapping: Soc2Mapping) => void) =>
    update((draft) => {
      const mapping = draft.mappings.find(({ id }) => id === mappingId);
      if (mapping) recipe(mapping);
    });

  const updateControl = (
    controlId: string,
    recipe: (control: BridgeProject["soc2"]["controls"][number]) => void,
  ) =>
    update((draft) => {
      const control = draft.soc2.controls.find(({ id }) => id === controlId);
      if (control) recipe(control);
    });

  const editControl = (
    controlId: string,
    recipe: (control: BridgeProject["soc2"]["controls"][number]) => void,
  ) =>
    update((draft) => {
      const control = draft.soc2.controls.find(({ id }) => id === controlId);
      if (!control) return;
      recipe(control);
      control.confirmationStatus = "edited";
      for (const mapping of draft.mappings) {
        if (
          mapping.soc2ControlId === controlId &&
          soc2ReviewOutcomeSupportsReuse(mapping.reviewOutcome)
        ) {
          mapping.confirmed = false;
          mapping.missingInformation = [
            ...new Set([
              ...(mapping.missingInformation ?? []),
              "Reconfirm this mapping after reviewing the updated SOC 2 control record.",
            ]),
          ];
        }
      }
    });

  const decideMapping = (mappingId: string, rejected: boolean) => {
    const mapping = project.mappings.find(({ id }) => id === mappingId);
    if (!mapping?.reviewer?.trim() || !mapping.reviewDate) {
      setReviewErrors((current) => ({
        ...current,
        [mappingId]: "Add a named reviewer and review date before recording this decision.",
      }));
      return;
    }
    const outcome = rejected
      ? "rejected_mapping"
      : (mapping.reviewOutcome ?? "needs_expert_review");
    const control = project.soc2.controls.find(({ id }) => id === mapping.soc2ControlId);
    if (soc2ReviewOutcomeSupportsReuse(outcome) && (!control || !isReviewedSoc2Control(control))) {
      setReviewErrors((current) => ({
        ...current,
        [mappingId]:
          "Review and confirm the source SOC 2 control before recording this relationship as supporting material.",
      }));
      return;
    }
    updateMapping(mappingId, (draft) => {
      draft.reviewOutcome = outcome;
      draft.coverage = coverageForSoc2ReviewOutcome(outcome);
      draft.confirmed = true;
    });
    setReviewErrors((current) => {
      const next = { ...current };
      delete next[mappingId];
      return next;
    });
  };

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Reuse actual tested controls</p>
          <h1>SOC 2 reuse</h1>
          <p>
            Class A Bridge does not apply a universal crosswalk. It suggests reuse opportunities
            from your actual control record, scope, period, test result, and exceptions. Your team
            confirms every mapping.
          </p>
        </div>
      </header>

      <Callout tone="warning" title="Interpretation remains your responsibility">
        <strong>Ancilis draft guidance — explanatory content, not official FedRAMP text.</strong> A
        suggestion identifies possible supporting material. It never completes a requirement or
        establishes evidence sufficiency.
      </Callout>

      <section className="soc2-reuse__metrics" aria-label="SOC 2 reuse summary">
        <SummaryMetric value={confirmedControls} labelText="confirmed SOC 2 controls" />
        <SummaryMetric value={suggestions.length} labelText="suggested reuse opportunities" />
        <SummaryMetric value={confirmedMappings} labelText="confirmed supporting mappings" />
        <SummaryMetric value={partialMappings} labelText="partial or supporting-only mappings" />
        <SummaryMetric value={fedrampGaps} labelText="FedRAMP-specific gaps" />
        <SummaryMetric value={scopeConflicts} labelText="scope conflicts" />
        <SummaryMetric value={periodConflicts} labelText="audit-period conflicts" />
        <SummaryMetric value={exceptionConflicts} labelText="exceptions affecting reuse" />
        <SummaryMetric value={carveOutControls} labelText="carved-out controls" />
        <SummaryMetric value={controlsNeedingReview} labelText="controls needing review" />
        <SummaryMetric
          value={requirementsWithoutCandidate}
          labelText="requirements without a candidate"
        />
      </section>

      <Card title="Import or export the SOC 2 control inventory">
        <p>
          Paste the provided CSV columns or choose a local CSV file. Import runs only in this
          browser, existing identifiers are never overwritten, and all imported values require
          review.
        </p>
        <div className="button-row">
          <Button
            variant="secondary"
            onClick={() =>
              downloadText(
                soc2ControlCsvTemplate(),
                "class-a-bridge-soc2-control-template.csv",
                "text/csv;charset=utf-8",
              )
            }
          >
            Download CSV template
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              downloadText(
                exportSoc2ControlsCsv(project.soc2.controls),
                "soc2-control-inventory.csv",
                "text/csv;charset=utf-8",
              )
            }
          >
            Export control inventory CSV
          </Button>
          <label className="button button--secondary soc2-reuse__file-button">
            Choose local CSV
            <input
              className="visually-hidden"
              type="file"
              accept=".csv,.tsv,text/csv,text/tab-separated-values"
              onChange={(event) => void importFile(event)}
            />
          </label>
        </div>
        <Field
          label="Paste SOC 2 control CSV or tabular data"
          hint="Use the downloadable template. Semicolon-separated values are supported inside list columns."
        >
          <textarea
            rows={6}
            value={pasteValue}
            onChange={(event) => setPasteValue(event.target.value)}
          />
        </Field>
        <Button disabled={!pasteValue.trim()} onClick={() => importControls(pasteValue)}>
          Import pasted controls
        </Button>
        {importMessage ? (
          <p className="soc2-reuse__message" role="status" aria-label="SOC 2 import result">
            {importMessage}
          </p>
        ) : null}
        {importIssues.length > 0 ? (
          <ul className="plain-list" aria-label="SOC 2 import issues">
            {importIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : null}
        <details open>
          <summary>Review the current control inventory ({project.soc2.controls.length})</summary>
          <div className="soc2-reuse__inventory">
            {project.soc2.controls.map((control) => (
              <article key={control.id} aria-label={`${control.id} SOC 2 control review`}>
                <div className="soc2-reuse__article-header">
                  <div>
                    <strong>
                      {control.id} — {control.title || "Title needs review"}
                    </strong>
                    <p className="small">
                      {control.trustServicesCriteria.join(", ") || "Criteria not recorded"} · pages{" "}
                      {control.reportPages.join(", ") || "not recorded"}
                    </p>
                  </div>
                  <StatusPill tone={isReviewedSoc2Control(control) ? "positive" : "warning"}>
                    {isReviewedSoc2Control(control) ? "Control reviewed" : "Needs control review"}
                  </StatusPill>
                </div>
                <details>
                  <summary>Edit and confirm this control</summary>
                  <div className="form-grid">
                    <Field label="Control title">
                      <input
                        value={control.title}
                        onChange={(event) =>
                          editControl(control.id, (draft) => {
                            draft.title = event.target.value;
                          })
                        }
                      />
                    </Field>
                    <Field label="Control description">
                      <textarea
                        rows={3}
                        value={control.description ?? ""}
                        onChange={(event) =>
                          editControl(control.id, (draft) => {
                            draft.description = event.target.value || undefined;
                          })
                        }
                      />
                    </Field>
                    <Field label="Trust Services Criteria" hint="Separate identifiers with commas.">
                      <input
                        value={control.trustServicesCriteria.join(", ")}
                        onChange={(event) =>
                          editControl(control.id, (draft) => {
                            draft.trustServicesCriteria = event.target.value
                              .split(",")
                              .map((value) => value.trim())
                              .filter(Boolean);
                          })
                        }
                      />
                    </Field>
                    <Field label="Report pages" hint="Separate page numbers with commas.">
                      <input
                        value={control.reportPages.join(", ")}
                        onChange={(event) =>
                          editControl(control.id, (draft) => {
                            draft.reportPages = event.target.value
                              .split(/[^0-9]+/u)
                              .map(Number)
                              .filter((value) => Number.isInteger(value) && value > 0);
                          })
                        }
                      />
                    </Field>
                    <Field label="Control frequency">
                      <input
                        value={control.frequency ?? ""}
                        onChange={(event) =>
                          editControl(control.id, (draft) => {
                            draft.frequency = event.target.value || undefined;
                          })
                        }
                      />
                    </Field>
                    <Field label="Control owner">
                      <input
                        value={control.owner ?? ""}
                        onChange={(event) =>
                          editControl(control.id, (draft) => {
                            draft.owner = event.target.value || undefined;
                          })
                        }
                      />
                    </Field>
                    <Field label="System or service scope">
                      <input
                        value={control.systemScope ?? ""}
                        onChange={(event) =>
                          editControl(control.id, (draft) => {
                            draft.systemScope = event.target.value || undefined;
                          })
                        }
                      />
                    </Field>
                    <Field label="Environment">
                      <input
                        value={control.environment ?? ""}
                        onChange={(event) =>
                          editControl(control.id, (draft) => {
                            draft.environment = event.target.value || undefined;
                          })
                        }
                      />
                    </Field>
                    <Field label="Subservice organization">
                      <input
                        value={control.subserviceOrganization ?? ""}
                        onChange={(event) =>
                          editControl(control.id, (draft) => {
                            draft.subserviceOrganization = event.target.value || undefined;
                          })
                        }
                      />
                    </Field>
                    <Field label="Subservice treatment">
                      <select
                        value={control.treatment ?? "not_sure"}
                        onChange={(event) =>
                          editControl(control.id, (draft) => {
                            draft.treatment = event.target.value as NonNullable<
                              typeof draft.treatment
                            >;
                          })
                        }
                      >
                        <option value="not_sure">Not sure</option>
                        <option value="inclusive">Inclusive</option>
                        <option value="carve_out">Carved out</option>
                        <option value="not_applicable">Not applicable</option>
                      </select>
                    </Field>
                    <Field label="Scope alignment">
                      <select
                        value={control.scopeAlignment ?? "not_sure"}
                        onChange={(event) =>
                          editControl(control.id, (draft) => {
                            draft.scopeAlignment = event.target.value as NonNullable<
                              typeof draft.scopeAlignment
                            >;
                          })
                        }
                      >
                        <option value="not_sure">Not sure</option>
                        <option value="aligned">Aligned</option>
                        <option value="potential_mismatch">Potential mismatch</option>
                      </select>
                    </Field>
                    <Field label="Report period start">
                      <input
                        type="date"
                        value={control.reportPeriodStart ?? ""}
                        onChange={(event) =>
                          editControl(control.id, (draft) => {
                            draft.reportPeriodStart = event.target.value || undefined;
                          })
                        }
                      />
                    </Field>
                    <Field label="Report period end">
                      <input
                        type="date"
                        value={control.reportPeriodEnd ?? ""}
                        onChange={(event) =>
                          editControl(control.id, (draft) => {
                            draft.reportPeriodEnd = event.target.value || undefined;
                          })
                        }
                      />
                    </Field>
                    <Field label="Auditor test procedure">
                      <textarea
                        rows={3}
                        value={control.auditorTest}
                        onChange={(event) =>
                          editControl(control.id, (draft) => {
                            draft.auditorTest = event.target.value;
                          })
                        }
                      />
                    </Field>
                    <Field label="Auditor test result">
                      <textarea
                        rows={3}
                        value={control.auditorResult}
                        onChange={(event) =>
                          editControl(control.id, (draft) => {
                            draft.auditorResult = event.target.value;
                          })
                        }
                      />
                    </Field>
                    <Field label="Exception status">
                      <select
                        value={control.exceptionStatus ?? "not_sure"}
                        onChange={(event) =>
                          editControl(control.id, (draft) => {
                            draft.exceptionStatus = event.target.value as NonNullable<
                              typeof draft.exceptionStatus
                            >;
                          })
                        }
                      >
                        <option value="not_sure">Not sure</option>
                        <option value="no_exception_reported">No exception reported</option>
                        <option value="exception_reported">Exception reported</option>
                      </select>
                    </Field>
                    <Field label="Exception description">
                      <textarea
                        rows={3}
                        value={control.exceptionDescription ?? ""}
                        onChange={(event) =>
                          editControl(control.id, (draft) => {
                            draft.exceptionDescription = event.target.value || undefined;
                          })
                        }
                      />
                    </Field>
                    <Field label="Remediation status">
                      <select
                        value={control.remediationStatus ?? "not_sure"}
                        onChange={(event) =>
                          editControl(control.id, (draft) => {
                            draft.remediationStatus = event.target.value as NonNullable<
                              typeof draft.remediationStatus
                            >;
                          })
                        }
                      >
                        <option value="not_sure">Not sure</option>
                        <option value="not_required">Not required</option>
                        <option value="not_started">Not started</option>
                        <option value="in_progress">In progress</option>
                        <option value="remediated">Remediated</option>
                        <option value="accepted">Accepted</option>
                      </select>
                    </Field>
                    <Field label="Complementary user-entity control">
                      <textarea
                        rows={3}
                        value={control.complementaryUserEntityControl ?? ""}
                        onChange={(event) =>
                          editControl(control.id, (draft) => {
                            draft.complementaryUserEntityControl = event.target.value || undefined;
                          })
                        }
                      />
                    </Field>
                    <Field label="Complementary subservice-organization control">
                      <textarea
                        rows={3}
                        value={control.complementarySubserviceOrganizationControl ?? ""}
                        onChange={(event) =>
                          editControl(control.id, (draft) => {
                            draft.complementarySubserviceOrganizationControl =
                              event.target.value || undefined;
                          })
                        }
                      />
                    </Field>
                    <Field label="Relevant source excerpt">
                      <textarea
                        rows={3}
                        value={control.excerpt}
                        onChange={(event) =>
                          editControl(control.id, (draft) => {
                            draft.excerpt = event.target.value;
                          })
                        }
                      />
                    </Field>
                    <Field label="Control reviewer">
                      <input
                        value={control.reviewer ?? ""}
                        onChange={(event) =>
                          editControl(control.id, (draft) => {
                            draft.reviewer = event.target.value || undefined;
                          })
                        }
                      />
                    </Field>
                    <Field label="Control review date">
                      <input
                        type="date"
                        value={control.reviewDate ?? ""}
                        onChange={(event) =>
                          editControl(control.id, (draft) => {
                            draft.reviewDate = event.target.value || undefined;
                          })
                        }
                      />
                    </Field>
                    <Field label="Control notes">
                      <textarea
                        rows={3}
                        value={control.notes ?? ""}
                        onChange={(event) =>
                          editControl(control.id, (draft) => {
                            draft.notes = event.target.value || undefined;
                          })
                        }
                      />
                    </Field>
                  </div>
                  {project.evidence.length > 0 ? (
                    <fieldset>
                      <legend>Related evidence candidates</legend>
                      {project.evidence.map((evidence) => (
                        <label className="checkbox-row" key={evidence.id}>
                          <input
                            type="checkbox"
                            checked={(control.evidenceReferences ?? []).includes(evidence.id)}
                            onChange={(event) =>
                              editControl(control.id, (draft) => {
                                const references = new Set(draft.evidenceReferences ?? []);
                                if (event.target.checked) references.add(evidence.id);
                                else references.delete(evidence.id);
                                draft.evidenceReferences = [...references];
                              })
                            }
                          />
                          {evidence.title} — {label(evidence.reviewStatus)}
                        </label>
                      ))}
                    </fieldset>
                  ) : null}
                  <Button
                    disabled={
                      !control.title.trim() ||
                      control.reportPages.length === 0 ||
                      !control.auditorTest.trim() ||
                      !control.auditorResult.trim() ||
                      !control.reviewer?.trim() ||
                      !control.reviewDate
                    }
                    onClick={() =>
                      updateControl(control.id, (draft) => {
                        draft.confirmationStatus = "confirmed";
                      })
                    }
                  >
                    Confirm control record
                  </Button>
                  {!control.title.trim() ||
                  control.reportPages.length === 0 ||
                  !control.auditorTest.trim() ||
                  !control.auditorResult.trim() ||
                  !control.reviewer?.trim() ||
                  !control.reviewDate ? (
                    <p className="small">
                      Add a title, report page, auditor test and result, named reviewer, and review
                      date before confirmation.
                    </p>
                  ) : null}
                </details>
              </article>
            ))}
          </div>
        </details>
      </Card>

      <Card title="Suggested reuse opportunities">
        {suggestions.length === 0 ? (
          <p>
            No new deterministic candidates are available. Confirm control details or review the
            mappings already below.
          </p>
        ) : (
          <div className="soc2-reuse__suggestions">
            {suggestions.map((suggestion) => {
              const control = project.soc2.controls.find(
                ({ id }) => id === suggestion.soc2ControlId,
              );
              return (
                <article
                  key={suggestion.id}
                  aria-label={`${suggestion.soc2ControlId} to ${suggestion.classARuleId} suggestion`}
                >
                  <div className="soc2-reuse__article-header">
                    <div>
                      <p className="eyebrow">{control?.title || "SOC 2 control"}</p>
                      <h3>
                        {suggestion.soc2ControlId} → {suggestion.classARuleId}
                      </h3>
                    </div>
                    <StatusPill tone={suggestionTone(suggestion.suggestionLevel)}>
                      {label(suggestion.suggestionLevel)}
                    </StatusPill>
                  </div>
                  <p>{suggestion.reason}</p>
                  {suggestion.sourceExcerpt ? (
                    <blockquote className="soc2-reuse__excerpt">
                      <strong>Relevant source excerpt</strong>
                      <p>{suggestion.sourceExcerpt}</p>
                    </blockquote>
                  ) : null}
                  <div className="soc2-reuse__playbook">
                    <strong>Playbook basis</strong>
                    <p>{suggestion.playbookEntry.requirementSummary}</p>
                    <small>Content version {suggestion.playbookContentVersion}</small>
                  </div>
                  <dl className="soc2-reuse__signals">
                    <div>
                      <dt>Trust Services Criteria</dt>
                      <dd>{suggestion.matchedCriteria.join(", ") || "No criterion match"}</dd>
                    </div>
                    <div>
                      <dt>Matched control language</dt>
                      <dd>{suggestion.matchedKeywords.join(", ") || "No keyword match"}</dd>
                    </div>
                    <div>
                      <dt>Scope alignment</dt>
                      <dd>{label(suggestion.scopeAlignment)}</dd>
                    </div>
                    <div>
                      <dt>Audit period</dt>
                      <dd>{label(suggestion.periodAlignment)}</dd>
                    </div>
                    <div>
                      <dt>Auditor result</dt>
                      <dd>{label(suggestion.testResultStatus)}</dd>
                    </div>
                    <div>
                      <dt>Exception status</dt>
                      <dd>{label(suggestion.exceptionStatus)}</dd>
                    </div>
                  </dl>
                  {suggestion.conflicts.length > 0 ? (
                    <div>
                      <strong>Potential conflicts</strong>
                      <ul className="plain-list">
                        {suggestion.conflicts.map((conflict) => (
                          <li key={conflict}>{conflict}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <div>
                    <strong>Information still missing</strong>
                    {suggestion.missingInformation.length > 0 ? (
                      <ul className="plain-list">
                        {suggestion.missingInformation.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>No missing field was detected. Human judgment is still required.</p>
                    )}
                  </div>
                  <Button
                    onClick={() =>
                      update((draft) => {
                        draft.mappings.push(mappingFromSuggestion(draft, suggestion));
                      })
                    }
                  >
                    Review this candidate
                  </Button>
                </article>
              );
            })}
          </div>
        )}
      </Card>

      <Card title="Mapping review record">
        {project.mappings.length === 0 ? (
          <p>
            No mapping records yet. Add a deterministic candidate above or create a manual mapping
            under SOC 2 materials.
          </p>
        ) : (
          <div className="soc2-reuse__reviews">
            {project.mappings.map((mapping) => {
              const requirement = project.requirements.find(
                ({ ruleId }) => ruleId === mapping.classARuleId,
              );
              const outcome = mapping.reviewOutcome ?? "needs_expert_review";
              const reviewed = isReviewedSoc2Mapping(mapping);
              return (
                <article
                  key={mapping.id}
                  aria-label={`${mapping.soc2ControlId} to ${mapping.classARuleId} mapping review`}
                >
                  <div className="soc2-reuse__article-header">
                    <h3>
                      {mapping.soc2ControlId} → {mapping.classARuleId}
                    </h3>
                    <StatusPill tone={reviewed ? reviewedOutcomeTone(mapping) : "warning"}>
                      {reviewed ? `Reviewed: ${label(outcome)}` : "Needs user confirmation"}
                    </StatusPill>
                  </div>
                  <p>{mapping.reason}</p>
                  <p className="small">
                    Related requirement remains{" "}
                    <strong data-testid="related-requirement-status">
                      {label(requirement?.status ?? "not started")}
                    </strong>
                    . Mapping review never changes this status.
                  </p>
                  {mapping.missingInformation?.length ? (
                    <ul className="plain-list" aria-label="Mapping information still needed">
                      {mapping.missingInformation.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                  <Field
                    label="What the SOC 2 control establishes"
                    hint="Describe only the support actually demonstrated by the report scope, period, test, and result."
                  >
                    <textarea
                      rows={3}
                      value={mapping.reason}
                      onChange={(event) =>
                        updateMapping(mapping.id, (draft) => {
                          draft.reason = event.target.value;
                          draft.confirmed = false;
                        })
                      }
                    />
                  </Field>
                  <div className="form-grid">
                    <Field label="Mapping review outcome">
                      <select
                        value={outcome}
                        onChange={(event) =>
                          updateMapping(mapping.id, (draft) => {
                            const nextOutcome = event.target.value as typeof outcome;
                            draft.reviewOutcome = nextOutcome;
                            draft.coverage = coverageForSoc2ReviewOutcome(nextOutcome);
                            draft.confirmed = false;
                          })
                        }
                      >
                        {outcomeOptions.map(([value, text]) => (
                          <option key={value} value={value}>
                            {text}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Reviewer" hint="Name the person making this mapping decision.">
                      <input
                        value={mapping.reviewer ?? ""}
                        onChange={(event) =>
                          updateMapping(mapping.id, (draft) => {
                            draft.reviewer = event.target.value;
                            draft.confirmed = false;
                          })
                        }
                      />
                    </Field>
                    <Field label="Review date">
                      <input
                        type="date"
                        value={mapping.reviewDate ?? ""}
                        onChange={(event) =>
                          updateMapping(mapping.id, (draft) => {
                            draft.reviewDate = event.target.value || undefined;
                            draft.confirmed = false;
                          })
                        }
                      />
                    </Field>
                  </div>
                  <Field label="What remains missing">
                    <textarea
                      rows={3}
                      value={mapping.gapDescription}
                      onChange={(event) =>
                        updateMapping(mapping.id, (draft) => {
                          draft.gapDescription = event.target.value;
                          draft.confirmed = false;
                        })
                      }
                    />
                  </Field>
                  {project.evidence.length > 0 ? (
                    <fieldset>
                      <legend>Evidence candidates supporting this review</legend>
                      {project.evidence.map((evidence) => (
                        <label className="checkbox-row" key={evidence.id}>
                          <input
                            type="checkbox"
                            checked={(mapping.evidenceIds ?? []).includes(evidence.id)}
                            onChange={(event) =>
                              updateMapping(mapping.id, (draft) => {
                                const references = new Set(draft.evidenceIds ?? []);
                                if (event.target.checked) references.add(evidence.id);
                                else references.delete(evidence.id);
                                draft.evidenceIds = [...references];
                                draft.confirmed = false;
                              })
                            }
                          />
                          {evidence.title} — {label(evidence.reviewStatus)}
                        </label>
                      ))}
                    </fieldset>
                  ) : null}
                  {reviewErrors[mapping.id] ? <p role="alert">{reviewErrors[mapping.id]}</p> : null}
                  <div className="button-row">
                    <Button onClick={() => decideMapping(mapping.id, false)}>
                      Confirm mapping
                    </Button>
                    <Button variant="secondary" onClick={() => decideMapping(mapping.id, true)}>
                      Reject mapping
                    </Button>
                  </div>
                  {mapping.reviewOutcome ? (
                    <p className="soc2-reuse__decision" role="status">
                      <strong>{label(mapping.reviewOutcome)}</strong> ·{" "}
                      {soc2MappingSupportsReuse(mapping)
                        ? "Available as reviewed supporting material; additional Class A work may remain."
                        : reviewed
                          ? "Reviewed decision; it does not establish support or enter requirement narratives as support."
                          : "Not included in generated reports until the review decision is recorded."}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </Card>

      <Card title="SOC 2 Reuse and Gap Report">
        <p>
          Generate a sanitized report for internal review. It preserves mapping provenance,
          unresolved gaps, exceptions, carve-outs, scope and period concerns, reviewer, and review
          date.
        </p>
        <div className="button-row">
          <Button
            onClick={() => {
              const report = generateHumanReport(project, "soc2-mapping");
              downloadText(report.html, report.fileName, report.mimeType);
            }}
          >
            Download reuse report HTML
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              const csv = generateCsv(project, "soc2-mapping");
              downloadText(csv.text, csv.fileName, csv.mimeType);
            }}
          >
            Download mapping matrix CSV
          </Button>
        </div>
      </Card>
    </>
  );
}
