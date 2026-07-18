import {
  isReviewedSoc2Mapping,
  isReviewedSoc2Control,
  soc2MappingSupportsReuse,
  type BridgeProject,
} from "@class-a-bridge/project";
import { RULE_GUIDANCE, getRule, getSoc2MappingPlaybook } from "@class-a-bridge/rules";
import { Button, Callout, Card, Field, ProgressTrack, StatusPill } from "@class-a-bridge/ui";
import "./guided-requirement.css";

type Requirement = BridgeProject["requirements"][number];

export interface GuidedRequirementProps {
  readonly project: BridgeProject;
  readonly ruleId: string;
  readonly change: (recipe: (requirement: Requirement) => void) => void;
  readonly openSoc2Reuse: () => void;
  readonly step: number;
  readonly setStep: (step: number) => void;
}

const words = (value: string) =>
  value.replaceAll("_", " ").replace(/^./u, (character) => character.toUpperCase());

const taskTitles = [
  "Understand the requirement",
  "Identify the owner",
  "Answer plain-language questions",
  "Review possible SOC 2 support",
  "Add evidence candidates",
  "Record gaps and blockers",
  "Create technical follow-up",
  "Review the draft narrative",
  "Choose the internal review state",
] as const;

const officialClassification = (value: string) => {
  if (value === "OFFICIALLY_MANDATORY") return "Officially mandatory for Class A";
  if (value === "OFFICIALLY_RECOMMENDED") return "Officially recommended for Class A";
  if (value === "OFFICIALLY_OPTIONAL") return "Officially optional for Class A";
  return "Not listed in an official Class A aggregate rule";
};

export function OfficialRuleDetails({ ruleId }: { readonly ruleId: string }) {
  const official = getRule(ruleId);
  const guidance = RULE_GUIDANCE.find((item) => item.ruleId === ruleId);
  if (!official) return null;
  const editorialOnly = official.officialClassASelection === "NOT_IN_CLASS_A_AGGREGATE";
  return (
    <Card title="Official Class A classification" eyebrow="Official and editorial labels separated">
      <dl className="guided-requirement__classification">
        <div>
          <dt>Official Class A classification</dt>
          <dd>{officialClassification(official.officialClassASelection)}</dd>
        </div>
        <div>
          <dt>Official Class A aggregate force</dt>
          <dd>{official.officialSelectionForce ?? "Not published in a Class A aggregate"}</dd>
        </div>
        <div>
          <dt>Individual rule force</dt>
          <dd>{official.officialIndividualForce ?? "Not separately published"}</dd>
        </div>
        <div>
          <dt>Effective statement source</dt>
          <dd>{official.fieldSourcePaths["statement"] ?? "No statement source path"}</dd>
        </div>
      </dl>
      {editorialOnly ? (
        <Callout title="Recommended by Ancilis for preparation" tone="info">
          <p>
            This product includes the record because it supports preparation. That inclusion is an
            Ancilis workflow decision, not an official FedRAMP requirement classification.
          </p>
        </Callout>
      ) : null}
      {official.needsFedrampConfirmation ? (
        <Callout title="Known upstream inconsistency — human review required" tone="warning">
          <p>
            The pinned official catalog contains an inconsistent Class A reference. Class A Bridge
            preserves the upstream value and provenance instead of silently rewriting it. Any
            Ancilis interpretation remains separate and must be reviewed before use in an output.
          </p>
        </Callout>
      ) : null}
      <div className="guided-requirement__official-text">
        <strong>Normalized official Class A text</strong>
        <blockquote>{official.officialText}</blockquote>
      </div>
      <p className="small">
        Source catalog {official.source.catalogVersion} · verified {official.source.verifiedAt} ·
        source object {official.officialObjectPath}
      </p>
      <p className="small">
        <strong>Ancilis guidance — explanatory content, not official FedRAMP text.</strong> Content
        review status: {guidance?.contentReviewStatus ?? "Draft"}. Reviewer:{" "}
        {guidance?.reviewer ?? "not yet assigned"}.
      </p>
      <details className="official-details">
        <summary>Advanced official source and provenance</summary>
        <p>
          <a href={official.source.sourceUrl} target="_blank" rel="noopener noreferrer">
            Open the pinned official source
          </a>
        </p>
        <pre>{JSON.stringify(official.official, null, 2)}</pre>
      </details>
    </Card>
  );
}

export function GuidedRequirement({
  project,
  ruleId,
  change,
  openSoc2Reuse,
  step,
  setStep,
}: GuidedRequirementProps) {
  const requirement = project.requirements.find((item) => item.ruleId === ruleId);
  const official = getRule(ruleId);
  const guidance = RULE_GUIDANCE.find((item) => item.ruleId === ruleId);
  const playbook = getSoc2MappingPlaybook(ruleId);
  if (!requirement || !official || !guidance || !playbook) return null;

  const mappings = project.mappings.filter((mapping) => mapping.classARuleId === ruleId);
  const confirmedMappings = mappings.filter(
    (mapping) =>
      soc2MappingSupportsReuse(mapping) &&
      Boolean(
        project.soc2.controls.find(
          (control) => control.id === mapping.soc2ControlId && isReviewedSoc2Control(control),
        ),
      ),
  );
  const taskTitle = taskTitles[step] ?? taskTitles[0];
  const addNotSure = () =>
    change((item) => {
      item.status = "needs_information";
      item.openQuestions = [
        ...new Set([...item.openQuestions, `${taskTitle} needs confirmation.`]),
      ];
    });

  const content = (() => {
    switch (step) {
      case 0:
        return (
          <>
            <Callout title="What this means in practice">
              <p>{guidance.plainLanguage}</p>
            </Callout>
            <h4>Why it matters</h4>
            <p>{guidance.whyItMatters}</p>
            <h4>What a strong response tends to contain</h4>
            <ul className="plain-list">
              {playbook.strongMappingCharacteristics.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </>
        );
      case 1:
        return (
          <>
            <Field label="Likely owner" hint={`Common owner: ${guidance.suggestedOwner}`}>
              <input
                value={requirement.owner}
                onChange={(event) => change((item) => void (item.owner = event.target.value))}
              />
            </Field>
            <Field label="Due date">
              <input
                type="date"
                value={requirement.dueDate ?? ""}
                onChange={(event) =>
                  change((item) => void (item.dueDate = event.target.value || undefined))
                }
              />
            </Field>
            <h4>Technical teams likely to help</h4>
            <p>{playbook.technicalTeams.join(" · ")}</p>
          </>
        );
      case 2:
        return (
          <>
            <ul className="plain-list">
              {guidance.questions.slice(0, 5).map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
            <Field
              label="Provider response"
              hint="Record what your team knows. Name uncertainty instead of guessing."
            >
              <textarea
                rows={6}
                value={requirement.userResponse}
                onChange={(event) =>
                  change((item) => void (item.userResponse = event.target.value))
                }
              />
            </Field>
          </>
        );
      case 3:
        return (
          <>
            <Callout title="No universal crosswalk" tone="info">
              <p>
                A confirmed mapping is supporting material only. Scope, period, auditor result,
                exceptions, and remaining FedRAMP-specific work stay visible.
              </p>
            </Callout>
            {mappings.length ? (
              <ul className="plain-list">
                {mappings.map((mapping) => (
                  <li key={mapping.id}>
                    <strong>{mapping.soc2ControlId}</strong> — {words(mapping.coverage)} ·{" "}
                    {isReviewedSoc2Mapping(mapping)
                      ? `reviewed: ${words(mapping.reviewOutcome ?? "needs expert review")}${
                          soc2MappingSupportsReuse(mapping)
                            ? " (supporting material)"
                            : " (not support)"
                        }`
                      : "needs user confirmation"}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No mapping candidate has been recorded for this requirement.</p>
            )}
            <Button variant="secondary" onClick={openSoc2Reuse}>
              Review SOC 2 reuse suggestions
            </Button>
          </>
        );
      case 4:
        return (
          <>
            <p>
              Evidence remains an evidence candidate until a person reviews its relevance,
              freshness, scope, and context.
            </p>
            <fieldset className="checkbox-grid">
              <legend>Link evidence candidates</legend>
              {project.evidence.map((evidence) => (
                <label key={evidence.id}>
                  <input
                    type="checkbox"
                    checked={requirement.evidenceIds.includes(evidence.id)}
                    onChange={(event) =>
                      change((item) => {
                        item.evidenceIds = event.target.checked
                          ? [...new Set([...item.evidenceIds, evidence.id])]
                          : item.evidenceIds.filter((id) => id !== evidence.id);
                      })
                    }
                  />
                  {evidence.title} — {words(evidence.reviewStatus)}
                </label>
              ))}
            </fieldset>
            {project.evidence.length === 0 ? <p>No evidence candidates exist yet.</p> : null}
          </>
        );
      case 5:
        return (
          <>
            <Field label="Known exceptions or constraints (one per line)">
              <textarea
                rows={5}
                value={requirement.exceptions.join("\n")}
                onChange={(event) =>
                  change((item) => {
                    item.exceptions = event.target.value
                      .split(/\r?\n/u)
                      .map((value) => value.trim())
                      .filter(Boolean);
                  })
                }
              />
            </Field>
            <h4>Common blocker signals</h4>
            <ul className="plain-list">
              {playbook.commonBlockers.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </>
        );
      case 6:
        return (
          <>
            <Field label="Technical follow-up questions (one per line)">
              <textarea
                rows={7}
                value={requirement.openQuestions.join("\n")}
                onChange={(event) =>
                  change((item) => {
                    item.openQuestions = event.target.value
                      .split(/\r?\n/u)
                      .map((value) => value.trim())
                      .filter(Boolean);
                  })
                }
              />
            </Field>
            <p className="small">Who usually knows: {playbook.technicalTeams.join(", ")}.</p>
          </>
        );
      case 7:
        return (
          <div className="narrative-stack">
            <Field label="Implementation explanation">
              <textarea
                rows={5}
                value={requirement.implementationNarrative}
                onChange={(event) =>
                  change((item) => void (item.implementationNarrative = event.target.value))
                }
              />
            </Field>
            <Field label="Verification explanation">
              <textarea
                rows={4}
                value={requirement.verificationNarrative}
                onChange={(event) =>
                  change((item) => void (item.verificationNarrative = event.target.value))
                }
              />
            </Field>
            <Field label="Validation explanation">
              <textarea
                rows={4}
                value={requirement.validationNarrative}
                onChange={(event) =>
                  change((item) => void (item.validationNarrative = event.target.value))
                }
              />
            </Field>
          </div>
        );
      case 8:
        return (
          <>
            <div className="form-grid">
              <Field label="Completion status">
                <select
                  value={requirement.status}
                  onChange={(event) =>
                    change(
                      (item) =>
                        void (item.status = event.target.value as typeof requirement.status),
                    )
                  }
                >
                  {[
                    "not_started",
                    "needs_information",
                    "drafted",
                    "evidence_missing",
                    "needs_technical_confirmation",
                    "needs_expert_review",
                    "complete_for_internal_review",
                  ].map((value) => (
                    <option key={value} value={value}>
                      {words(value)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Review status">
                <select
                  value={requirement.reviewStatus}
                  onChange={(event) =>
                    change(
                      (item) =>
                        void (item.reviewStatus = event.target
                          .value as typeof requirement.reviewStatus),
                    )
                  }
                >
                  {["unreviewed", "in_review", "changes_requested", "approved"].map((value) => (
                    <option key={value} value={value}>
                      {words(value)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="button-row">
              <Button onClick={() => change((item) => void (item.status = "needs_expert_review"))}>
                Flag for expert review
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  change((item) => void (item.status = "complete_for_internal_review"))
                }
              >
                Complete for internal review
              </Button>
            </div>
            <p className="small">
              Provider approval remains a separate explicit attestation in Record mode. Neither
              state indicates FedRAMP approval or evidence sufficiency.
            </p>
          </>
        );
      default:
        return null;
    }
  })();

  return (
    <div className="guided-requirement">
      <div className="requirement-title">
        <div>
          <p className="eyebrow">{ruleId} · guided workflow</p>
          <h2>{official.officialTitle}</h2>
        </div>
        <StatusPill tone={requirement.status === "needs_expert_review" ? "warning" : "info"}>
          {words(requirement.status)}
        </StatusPill>
      </div>
      <ProgressTrack
        current={step + 1}
        total={taskTitles.length}
        label="Guided requirement tasks"
      />
      <Card title={taskTitle} eyebrow={`Guided task ${step + 1} of ${taskTitles.length}`}>
        <p className="small">
          <strong>Why this task:</strong> {guidance.whyItMatters}
        </p>
        {content}
        <div className="guided-requirement__uncertainty">
          <Button variant="quiet" onClick={addNotSure}>
            Not sure — record a follow-up
          </Button>
          <span>
            Potential blocker: {playbook.commonBlockers[0] ?? "Unresolved scope or evidence."}
          </span>
        </div>
        <div className="button-row guided-requirement__navigation">
          <Button variant="secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>
            Previous task
          </Button>
          {step < taskTitles.length - 1 ? (
            <Button onClick={() => setStep(step + 1)}>
              Next: {taskTitles[step + 1] ?? "Continue"}
            </Button>
          ) : null}
        </div>
      </Card>
      <Card title="Current record summary">
        <p>
          {confirmedMappings.length} confirmed supporting mapping
          {confirmedMappings.length === 1 ? "" : "s"} · {requirement.evidenceIds.length} linked
          evidence candidate{requirement.evidenceIds.length === 1 ? "" : "s"} ·{" "}
          {requirement.openQuestions.length} open question
          {requirement.openQuestions.length === 1 ? "" : "s"}
        </p>
      </Card>
      <OfficialRuleDetails ruleId={ruleId} />
    </div>
  );
}
