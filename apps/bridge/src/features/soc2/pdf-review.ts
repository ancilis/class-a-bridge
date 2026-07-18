import type { BridgeProject } from "@class-a-bridge/project";

type ExtractionDecision = "confirmed" | "edited" | "ignored";

type ExtractionCandidate = BridgeProject["soc2"]["extractionCandidates"][number];

const activeDecision = (candidate: ExtractionCandidate) =>
  candidate.decision === "confirmed" || candidate.decision === "edited";

const otherCandidateUsesValue = (
  project: BridgeProject,
  candidate: ExtractionCandidate,
  value: string,
) =>
  project.soc2.extractionCandidates.some(
    (other) =>
      other.id !== candidate.id &&
      other.field === candidate.field &&
      activeDecision(other) &&
      other.application?.appliedValue === value,
  );

const replaceControlReferences = (project: BridgeProject, from: string, to: string) => {
  for (const requirement of project.requirements) {
    requirement.soc2ControlIds = [
      ...new Set(requirement.soc2ControlIds.map((id) => (id === from ? to : id))),
    ];
  }
  const duplicateMappingIds = new Set<string>();
  for (const mapping of project.mappings) {
    if (mapping.soc2ControlId !== from) continue;
    const target = project.mappings.find(
      (candidate) =>
        candidate.id !== mapping.id &&
        candidate.soc2ControlId === to &&
        candidate.classARuleId === mapping.classARuleId,
    );
    if (target) {
      target.confirmed = false;
      target.reviewOutcome = "needs_expert_review";
      target.coverage = "needs_human_review";
      target.conflicts = [
        ...new Set([
          ...(target.conflicts ?? []),
          `A corrected extracted control identifier merged duplicate mapping ${mapping.id}; compare both review records.`,
        ]),
      ];
      target.gapDescription = [target.gapDescription, mapping.gapDescription, mapping.reason]
        .filter(Boolean)
        .join(" ");
      duplicateMappingIds.add(mapping.id);
    } else mapping.soc2ControlId = to;
  }
  project.mappings = project.mappings.filter(({ id }) => !duplicateMappingIds.has(id));
  for (const evidence of project.evidence) {
    evidence.relatedSoc2ControlIds = [
      ...new Set(evidence.relatedSoc2ControlIds.map((id) => (id === from ? to : id))),
    ];
  }
};

const removeCandidateApplication = (project: BridgeProject, candidate: ExtractionCandidate) => {
  const application = candidate.application;
  if (!application) return;
  const value = application.appliedValue;

  if (candidate.field === "SOC 2 report type" && project.soc2.confirmedType === value)
    project.soc2.confirmedType =
      (application.previousValue as BridgeProject["soc2"]["confirmedType"] | undefined) ??
      "not_sure";
  if (candidate.field === "Report issuer" && project.soc2.issuer === value)
    project.soc2.issuer = application.previousValue ?? "";
  if (candidate.field === "Report date" && project.soc2.reportDate === value)
    project.soc2.reportDate = application.previousValue ?? "";
  if (candidate.field === "System or service name" && project.soc2.systemName === value)
    project.soc2.systemName = application.previousValue ?? "";
  if (
    candidate.field === "Bridge or gap letter reference" &&
    project.soc2.bridgeLetterReference === value
  )
    project.soc2.bridgeLetterReference = application.previousValue || undefined;
  if (
    (candidate.field === "Carve-out treatment" || candidate.field === "Inclusive treatment") &&
    project.soc2.treatment === value
  )
    project.soc2.treatment =
      (application.previousValue as BridgeProject["soc2"]["treatment"] | undefined) || "not_sure";
  if (candidate.field === "Report period") {
    const [start, end] = value.split(" to ", 2);
    if (project.soc2.reportStart === start)
      project.soc2.reportStart = application.previousValue ?? "";
    if (project.soc2.reportEnd === end)
      project.soc2.reportEnd = application.previousSecondaryValue ?? "";
  }

  const listForField =
    candidate.field === "Trust Services Criteria"
      ? project.soc2.trustServicesCriteria
      : candidate.field === "Subservice organization"
        ? project.soc2.subserviceOrganizations
        : candidate.field === "Complementary user-entity controls"
          ? project.soc2.complementaryUserEntityControls
          : undefined;
  if (
    listForField &&
    application.addedToCanonical &&
    !otherCandidateUsesValue(project, candidate, value)
  ) {
    listForField.splice(0, listForField.length, ...listForField.filter((item) => item !== value));
  }

  if (candidate.field === "Auditor exception") {
    const exceptionId = `extracted-${candidate.id}`;
    project.soc2.exceptions = project.soc2.exceptions.filter(({ id }) => id !== exceptionId);
    for (const control of project.soc2.controls) {
      control.exceptionIds = control.exceptionIds.filter((id) => id !== exceptionId);
    }
  }

  if (candidate.field === "Control identifier") {
    const control = project.soc2.controls.find(({ id }) => id === value);
    if (control) {
      control.sourceSuggestions = (control.sourceSuggestions ?? []).filter(
        ({ candidateId }) => candidateId !== candidate.id,
      );
      const referenced =
        project.mappings.some(({ soc2ControlId }) => soc2ControlId === value) ||
        project.requirements.some(({ soc2ControlIds }) => soc2ControlIds.includes(value)) ||
        project.evidence.some(({ relatedSoc2ControlIds }) => relatedSoc2ControlIds.includes(value));
      if (application.addedToCanonical && !referenced && control.sourceSuggestions.length === 0) {
        project.soc2.controls = project.soc2.controls.filter(({ id }) => id !== value);
      }
    }
  }
  candidate.application = undefined;
};

export function updateExtractionCandidateValue(
  project: BridgeProject,
  candidateId: string,
  value: string,
): void {
  const candidate = project.soc2.extractionCandidates.find(({ id }) => id === candidateId);
  if (!candidate) return;
  candidate.value = value;
  candidate.decision = "unreviewed";
}

export function applyExtractionCandidateDecision(
  project: BridgeProject,
  candidateId: string,
  decision: ExtractionDecision,
): void {
  const candidate = project.soc2.extractionCandidates.find(({ id }) => id === candidateId);
  if (!candidate) return;
  if (decision === "ignored") {
    removeCandidateApplication(project, candidate);
    candidate.decision = decision;
    return;
  }

  const value = candidate.value.trim();
  if (!value) {
    candidate.decision = "unreviewed";
    return;
  }
  const previousApplication = candidate.application;
  if (candidate.field === "Report period") {
    const [start, end] = value.split(" to ", 2);
    if (!start || !end) {
      removeCandidateApplication(project, candidate);
      candidate.decision = "unreviewed";
      return;
    }
  }
  candidate.decision = decision;
  if (candidate.field === "SOC 2 report type") {
    const appliedValue = /type\s+ii/iu.test(value) ? "type_ii" : "other";
    if (!previousApplication)
      candidate.application = {
        appliedValue,
        previousValue: project.soc2.confirmedType,
      };
    else candidate.application = { ...previousApplication, appliedValue };
    project.soc2.confirmedType = appliedValue;
  }
  if (candidate.field === "Report issuer") {
    candidate.application = previousApplication
      ? { ...previousApplication, appliedValue: value }
      : { appliedValue: value, previousValue: project.soc2.issuer };
    project.soc2.issuer = value;
  }
  if (candidate.field === "Report date") {
    candidate.application = previousApplication
      ? { ...previousApplication, appliedValue: value }
      : { appliedValue: value, previousValue: project.soc2.reportDate };
    project.soc2.reportDate = value;
  }
  if (candidate.field === "Report period") {
    const originalStart = previousApplication?.previousValue ?? project.soc2.reportStart;
    const originalEnd = previousApplication?.previousSecondaryValue ?? project.soc2.reportEnd;
    const [start, end] = value.split(" to ", 2);
    if (start) project.soc2.reportStart = start;
    if (end) project.soc2.reportEnd = end;
    candidate.application = {
      appliedValue: value,
      previousValue: originalStart,
      previousSecondaryValue: originalEnd,
    };
  }
  if (candidate.field === "System or service name") {
    candidate.application = previousApplication
      ? { ...previousApplication, appliedValue: value }
      : { appliedValue: value, previousValue: project.soc2.systemName };
    project.soc2.systemName = value;
  }
  if (candidate.field === "Carve-out treatment" || candidate.field === "Inclusive treatment") {
    const appliedValue = candidate.field === "Carve-out treatment" ? "carve_out" : "inclusive";
    candidate.application = previousApplication
      ? { ...previousApplication, appliedValue }
      : { appliedValue, previousValue: project.soc2.treatment ?? "" };
    project.soc2.treatment = appliedValue;
  }
  const listForField =
    candidate.field === "Trust Services Criteria"
      ? project.soc2.trustServicesCriteria
      : candidate.field === "Subservice organization"
        ? project.soc2.subserviceOrganizations
        : candidate.field === "Complementary user-entity controls"
          ? project.soc2.complementaryUserEntityControls
          : undefined;
  if (listForField) {
    if (
      previousApplication?.addedToCanonical &&
      previousApplication.appliedValue !== value &&
      !otherCandidateUsesValue(project, candidate, previousApplication.appliedValue)
    ) {
      const oldIndex = listForField.indexOf(previousApplication.appliedValue);
      if (oldIndex >= 0) listForField.splice(oldIndex, 1);
    }
    const addedToCanonical = !listForField.includes(value);
    if (addedToCanonical) listForField.push(value);
    candidate.application = { appliedValue: value, addedToCanonical };
  }
  if (candidate.field === "Bridge or gap letter reference") {
    candidate.application = previousApplication
      ? { ...previousApplication, appliedValue: value }
      : { appliedValue: value, previousValue: project.soc2.bridgeLetterReference ?? "" };
    project.soc2.bridgeLetterReference = value;
  }

  if (candidate.field === "Control identifier") {
    const suggestion = {
      field: candidate.field,
      suggestedValue: value,
      sourcePage: candidate.page,
      sourceExcerpt: candidate.snippet,
      extractionBasis: candidate.detector,
      decision,
      candidateId: candidate.id,
    } as const;
    const oldValue = previousApplication?.appliedValue;
    const oldControl = oldValue
      ? project.soc2.controls.find(({ id }) => id === oldValue)
      : undefined;
    if (oldValue && oldControl && oldValue !== value && previousApplication?.addedToCanonical) {
      const target = project.soc2.controls.find(({ id }) => id === value);
      if (target) {
        target.reportPages = [...new Set([...target.reportPages, ...oldControl.reportPages])];
        target.sourceSuggestions = [
          ...(target.sourceSuggestions ?? []),
          ...(oldControl.sourceSuggestions ?? []).filter(
            ({ candidateId }) => candidateId !== candidate.id,
          ),
        ];
        project.soc2.controls = project.soc2.controls.filter(({ id }) => id !== oldValue);
      } else {
        oldControl.id = value;
      }
      replaceControlReferences(project, oldValue, value);
    } else if (oldValue && oldControl && oldValue !== value) {
      oldControl.sourceSuggestions = (oldControl.sourceSuggestions ?? []).filter(
        ({ candidateId }) => candidateId !== candidate.id,
      );
    }
    const existing = project.soc2.controls.find(({ id }) => id === value);
    const targetExistedBeforeCorrection = Boolean(existing && existing !== oldControl);
    if (existing) {
      existing.reportPages = [...new Set([...existing.reportPages, candidate.page])];
      existing.sourceSuggestions = [...(existing.sourceSuggestions ?? [])];
      if (
        !existing.sourceSuggestions.some(
          (item) =>
            item.field === suggestion.field &&
            item.sourcePage === suggestion.sourcePage &&
            item.suggestedValue === suggestion.suggestedValue,
        )
      )
        existing.sourceSuggestions.push(suggestion);
    } else {
      project.soc2.controls.push({
        id: value,
        title: `Extracted control ${value} — title needs confirmation`,
        trustServicesCriteria: [],
        reportPages: [candidate.page],
        auditorTest: "",
        auditorResult: "",
        exceptionIds: [],
        excerpt: candidate.snippet,
        confirmationStatus: "unreviewed",
        notes:
          "Created from a deterministic local PDF suggestion. Confirm the title, scope, period, test procedure, and result before reuse.",
        sourceSuggestions: [suggestion],
      });
    }
    candidate.application = {
      appliedValue: value,
      addedToCanonical: targetExistedBeforeCorrection
        ? false
        : existing
          ? (previousApplication?.addedToCanonical ?? false)
          : true,
    };
  }

  if (candidate.field === "Auditor exception") {
    const id = `extracted-${candidate.id}`;
    const existing = project.soc2.exceptions.find((exception) => exception.id === id);
    if (existing) {
      existing.description = value;
      existing.pages = [candidate.page];
    } else
      project.soc2.exceptions.push({
        id,
        title: "Extracted auditor exception — needs review",
        description: value,
        materiality: "not_sure",
        pages: [candidate.page],
      });
    candidate.application = { appliedValue: value, addedToCanonical: !existing };
  }
}
