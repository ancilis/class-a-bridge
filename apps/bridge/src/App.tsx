import {
  generateAdvisorHandoffPackage,
  generateCsv,
  generateEditableDocx,
  generateHumanReport,
  generatePreparationPackage,
  REPORT_KINDS,
  type OfficialDocumentOptions,
  type PreparationPackage,
} from "@class-a-bridge/documents";
import {
  BridgeProjectSchema,
  ELIGIBILITY_QUESTIONS,
  browserStorageEstimate,
  createProjectStore,
  createProjectStoreSafely,
  decryptBundle,
  encryptBundle,
  exportProjectBundle,
  importProjectBundle,
  safeFilename,
  sha256Hex,
  type AnswerValue,
  type BridgeProject,
  type ProjectStore,
  type ProjectSummary,
} from "@class-a-bridge/project";
import {
  CATALOG_MANIFEST,
  KSI_WORKFLOWS,
  RULE_GUIDANCE,
  RULE_SELECTIONS,
  getRule,
} from "@class-a-bridge/rules";
import { ACME_METRICS_PROJECT } from "@class-a-bridge/testing";
import {
  Button,
  Callout,
  Card,
  EmptyState,
  Field,
  ProgressTrack,
  StatusPill,
} from "@class-a-bridge/ui";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";

import { diagnosticReport, downloadBytes, downloadText } from "./lib/download";
import {
  collectBundleAttachments,
  collectBundleGeneratedOutputs,
  persistProjectWithAttachmentAtomically,
  persistProjectWithGeneratedOutputAtomically,
  referencedGeneratedOutputs,
  referencedLocalAttachments,
  removeEvidenceCandidateLocally,
  restoreImportedProjectAtomically,
} from "./lib/backup";
import { parsePdfLocally, validatePdfFile } from "./lib/pdf";
import {
  answerEligibility,
  deriveActions,
  evidenceFreshness,
  initializeProject,
  requirementMilestone,
  soc2PackageFreshness,
} from "./lib/workspace";

type Route =
  | "/overview"
  | "/eligibility"
  | "/scope"
  | "/soc2-materials"
  | "/requirements"
  | "/evidence"
  | "/action-plan"
  | "/package"
  | "/reports"
  | "/settings";

type SaveState =
  | { readonly status: "idle" | "saving" | "saved" }
  | { readonly status: "error"; readonly message: string };

const DEFAULT_STORE_FACTORY = createProjectStoreSafely;

const NAVIGATION: readonly {
  readonly route: Route;
  readonly label: string;
  readonly short: string;
}[] = [
  { route: "/overview", label: "Overview", short: "01" },
  { route: "/eligibility", label: "Eligibility", short: "02" },
  { route: "/scope", label: "Scope", short: "03" },
  { route: "/soc2-materials", label: "SOC 2 materials", short: "04" },
  { route: "/requirements", label: "Class A requirements", short: "05" },
  { route: "/evidence", label: "Evidence", short: "06" },
  { route: "/action-plan", label: "Action plan", short: "07" },
  { route: "/package", label: "Package", short: "08" },
  { route: "/reports", label: "Reports", short: "09" },
  { route: "/settings", label: "Project settings", short: "10" },
] as const;

const requestedStart = (() => {
  if (typeof globalThis.location === "undefined") return "";
  return new URLSearchParams(globalThis.location.search).get("start") ?? "";
})();

const statusLabel = (value: string) =>
  value.replaceAll("_", " ").replace(/^./u, (character) => character.toUpperCase());
const routeFrom = (input: string): Route =>
  NAVIGATION.find(({ route }) => input.startsWith(route))?.route ?? "/overview";

interface ValidationEditTarget {
  readonly route: Route;
  readonly id?: string;
  readonly label: string;
}

export function validationEditTarget(documentName: string, pointer: string): ValidationEditTarget {
  if (documentName === "certification-package-overview") {
    if (pointer.includes("/providerName"))
      return { route: "/settings", id: "settings-organization-name", label: "Edit provider name" };
    if (pointer.includes("/serviceName"))
      return { route: "/settings", id: "settings-offering-name", label: "Edit offering name" };
    if (pointer.includes("/serviceAcronym"))
      return { route: "/settings", id: "settings-offering-acronym", label: "Edit acronym" };
    if (pointer.includes("/serviceDescription"))
      return {
        route: "/settings",
        id: "settings-offering-description",
        label: "Edit offering description",
      };
    if (pointer.includes("/serviceType"))
      return { route: "/settings", id: "settings-service-models", label: "Edit service models" };
    if (pointer.includes("/trustCenter/url"))
      return { route: "/settings", id: "settings-trust-center-url", label: "Edit trust center" };
    if (pointer.includes("/fedRampPackageId"))
      return { route: "/package", id: "package-cpo-id", label: "Edit package identifier" };
    if (pointer.includes("/logo"))
      return { route: "/package", id: "package-cpo-logo", label: "Edit logo URL" };
    if (pointer.includes("/website"))
      return { route: "/package", id: "package-cpo-website", label: "Edit offering website" };
    if (pointer.includes("/deploymentModel"))
      return {
        route: "/package",
        id: "package-cpo-deployment-model",
        label: "Edit deployment model",
      };
    if (pointer.includes("/contactInformation"))
      return {
        route: "/package",
        id: "package-cpo-contacts",
        label: "Edit provider contacts",
      };
    return { route: "/package", id: "package-cpo-id", label: "Edit package overview" };
  }
  if (documentName === "security-decision-record") {
    const port = /^\/portsAndProtocols\/(\d+)\/([^/]+)$/u.exec(pointer);
    if (port)
      return {
        route: "/package",
        id: `package-sdr-port-${port[1]}-${port[2]}`,
        label: "Edit port or protocol",
      };
    if (pointer.includes("/fedRampRequirements") || pointer.includes("/keySecurityIndicators"))
      return { route: "/requirements", label: "Open requirement record" };
    return {
      route: "/package",
      id: "package-sdr-cpo-uri",
      label: "Edit Security Decision Record",
    };
  }
  if (pointer.includes("/reportPeriod/from"))
    return { route: "/package", id: "package-ocr-report-from", label: "Edit report start" };
  if (pointer.includes("/reportPeriod/to"))
    return { route: "/package", id: "package-ocr-report-to", label: "Edit report end" };
  if (pointer === "/reportPeriod")
    return { route: "/package", id: "package-ocr-report-from", label: "Edit report period" };
  if (pointer.includes("/planningHorizonThrough"))
    return {
      route: "/package",
      id: "package-ocr-planning-through",
      label: "Edit planning horizon",
    };
  if (pointer.includes("/acceptedVulnerabilities"))
    return {
      route: "/package",
      id: "package-ocr-accepted-vulnerabilities",
      label: "Edit accepted-vulnerability summary",
    };
  if (pointer.includes("/plannedCertificationDataChanges"))
    return {
      route: "/package",
      id: "package-ocr-planned-changes",
      label: "Edit planned certification changes",
    };
  return {
    route: "/package",
    id: "package-ocr-cpo-uri",
    label: "Edit Ongoing Certification Report",
  };
}
const toneFor = (value: string): "neutral" | "info" | "positive" | "warning" | "critical" => {
  if (/approved|complete|likely_fit$/u.test(value)) return "positive";
  if (/critical|blocker|not_currently|mismatch|invalid|stale|rejected/u.test(value))
    return "critical";
  if (/review|missing|uncertain|needs|expiring|due/u.test(value)) return "warning";
  if (/draft|progress|candidate|present/u.test(value)) return "info";
  return "neutral";
};

function officialDocumentOptions(
  project: BridgeProject,
): Omit<OfficialDocumentOptions, "generatedAt"> {
  const cpo = project.packageInputs.certificationPackageOverview;
  const sdr = project.packageInputs.securityDecisionRecord;
  const ocr = project.packageInputs.ongoingCertificationReport;
  const contact = (value: typeof cpo.securityContact, contactType: string) => ({
    contactType,
    ...(value.name ? { contactName: value.name } : {}),
    ...(value.email ? { contactEmail: value.email } : {}),
    ...(value.phone ? { contactPhone: value.phone } : {}),
  });
  return {
    certificationPackageOverview: {
      ...(cpo.fedRampPackageId ? { fedRampPackageId: cpo.fedRampPackageId } : {}),
      ...(cpo.ueiNumber ? { ueiNumber: cpo.ueiNumber } : {}),
      ...(cpo.website ? { website: cpo.website } : {}),
      ...(cpo.logoUrl ? { logoUrl: cpo.logoUrl } : {}),
      ...(cpo.deploymentModel ? { deploymentModel: cpo.deploymentModel } : {}),
      ...(cpo.businessCategories.length > 0 ? { businessCategories: cpo.businessCategories } : {}),
      securityContact: contact(cpo.securityContact, "Security"),
      salesContact: contact(cpo.salesContact, "Sales"),
      trustCenterAuthenticationRequired: cpo.trustCenterAuthenticationRequired,
      ...(cpo.trustCenterAccessInstructions
        ? { trustCenterAccessInstructions: cpo.trustCenterAccessInstructions }
        : {}),
      ...(cpo.nextOngoingCertificationReportDate
        ? { nextOngoingCertificationReportDate: cpo.nextOngoingCertificationReportDate }
        : {}),
    },
    securityDecisionRecord: {
      ...(sdr.certificationPackageOverviewUri
        ? { certificationPackageOverviewUri: sdr.certificationPackageOverviewUri }
        : {}),
      portsAndProtocols: sdr.portsAndProtocols.map((port) => ({
        serviceName: port.serviceName,
        portNumber: port.portNumber,
        transportProtocol: port.transportProtocol,
        encryption: port.encryption,
        purpose: port.purpose,
      })),
    },
    ongoingCertificationReport: {
      ...(ocr.certificationPackageOverviewUri
        ? { certificationPackageOverviewUri: ocr.certificationPackageOverviewUri }
        : {}),
      ...(ocr.reportFrom ? { reportFrom: ocr.reportFrom } : {}),
      ...(ocr.reportTo ? { reportTo: ocr.reportTo } : {}),
      ...(ocr.planningHorizonThrough ? { planningHorizonThrough: ocr.planningHorizonThrough } : {}),
      certificationDataChanges: ocr.certificationDataChanges,
      plannedChanges: ocr.plannedChanges,
      ...(ocr.acceptedVulnerabilitiesSummary
        ? { acceptedVulnerabilitiesSummary: ocr.acceptedVulnerabilitiesSummary }
        : {}),
      transformativeChanges: ocr.transformativeChanges,
      updatedRecommendations: ocr.updatedRecommendations,
      activeAgencies: ocr.activeAgencies,
    },
  };
}

function cloneProject(project: BridgeProject) {
  return structuredClone(project);
}

function generatedPackageOutput(
  result: PreparationPackage,
  version: string,
  generatedAt: string,
): BridgeProject["generatedOutputs"][number] {
  return {
    id: `preparation-package-${result.sha256}`,
    kind: "preparation_package",
    title: `Preparation package version ${version}`,
    format: "zip",
    generatedAt,
    sha256: result.sha256,
    validationStatus: result.validation.valid ? "valid" : "invalid",
    validationIssues: result.validation.documents.flatMap((document) =>
      document.issues.map((issue) => ({
        pointer: issue.pointer,
        message: `${document.name}: ${issue.resolution}`,
        route: issue.route,
      })),
    ),
  };
}

function addGeneratedPackage(
  project: BridgeProject,
  result: PreparationPackage,
  version: string,
  generatedAt: string,
) {
  const output = generatedPackageOutput(result, version, generatedAt);
  if (!project.generatedOutputs.some((candidate) => candidate.id === output.id)) {
    project.generatedOutputs.push(output);
  }
  return output;
}

function localErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim()
    ? error.message.trim().slice(0, 240)
    : fallback;
}

function FirstRun({
  onPdf,
  onManual,
  onSample,
  savedProjects,
  savedProjectsState,
  savedProjectsError,
  onOpenSaved,
  onImport,
}: {
  readonly onPdf: () => void;
  readonly onManual: () => void;
  readonly onSample: () => void;
  readonly savedProjects: readonly ProjectSummary[];
  readonly savedProjectsState: "loading" | "ready" | "error";
  readonly savedProjectsError: string;
  readonly onOpenSaved: (id: string) => Promise<void>;
  readonly onImport: (file: File, password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [importState, setImportState] = useState<"idle" | "busy">("idle");
  const [importMessage, setImportMessage] = useState("");
  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportState("busy");
    setImportMessage("");
    try {
      await onImport(file, password);
    } catch (caught) {
      setImportMessage(
        caught instanceof Error ? caught.message : "The backup could not be restored safely.",
      );
    } finally {
      setImportState("idle");
      event.target.value = "";
    }
  };
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <main className="first-run" id="main-content" tabIndex={-1}>
        <div className="first-run__brand">
          <span className="brand-mark" aria-hidden="true">
            A
          </span>
          <span>
            CLASS A BRIDGE <small>BY ANCILIS</small>
          </span>
        </div>
        <section className="first-run__hero" aria-labelledby="first-run-title">
          <p className="eyebrow">Private, guided FedRAMP 20x preparation</p>
          <h1 id="first-run-title">Turn your SOC 2 Type II into a clear Class A plan.</h1>
          <p className="lede">
            Start in your browser. You will receive a preliminary fit result after eight focused
            questions, then a workspace for scope, evidence, requirements, and package preparation.
          </p>
          <div className="privacy-chip">
            <span aria-hidden="true">●</span> No account. No SDK. No confidential document upload.
          </div>
        </section>
        <section className="start-paths" aria-label="Choose how to begin">
          <button className="start-card start-card--primary" onClick={onPdf}>
            <span className="start-card__icon" aria-hidden="true">
              ↥
            </span>
            <strong>Start with my SOC 2 report</strong>
            <span>
              Choose a local PDF. Deterministic extraction runs only in this browser, and you
              confirm every value.
            </span>
            <em>Choose local PDF →</em>
          </button>
          <button className="start-card" onClick={onManual}>
            <span className="start-card__icon" aria-hidden="true">
              ✎
            </span>
            <strong>Start without uploading a report</strong>
            <span>
              Answer the same guided questions and add report details manually whenever you are
              ready.
            </span>
            <em>Begin manually →</em>
          </button>
          <button className="start-card" onClick={onSample}>
            <span className="start-card__icon" aria-hidden="true">
              ◇
            </span>
            <strong>Explore a fictional sample workspace</strong>
            <span>
              See Acme Metrics with mixed progress, sample evidence, open issues, and generated
              outputs.
            </span>
            <em>Open fictional sample →</em>
          </button>
        </section>
        <section className="first-run__resume" aria-labelledby="saved-projects-title">
          <div>
            <p className="eyebrow">Continue locally</p>
            <h2 id="saved-projects-title">Saved projects on this browser</h2>
            {savedProjectsState === "loading" && <p role="status">Checking browser storage…</p>}
            {savedProjectsState === "error" && (
              <div className="error-summary" role="alert">
                <strong>Saved projects could not be listed.</strong>
                <p>{savedProjectsError}</p>
              </div>
            )}
            {savedProjectsState === "ready" && savedProjects.length === 0 && (
              <p>No saved projects are stored in this browser yet.</p>
            )}
            {savedProjects.length > 0 && (
              <div className="saved-projects">
                {savedProjects.map((saved) => (
                  <button
                    className="saved-project"
                    key={saved.id}
                    aria-label={`Open saved project ${saved.name}`}
                    onClick={() => void onOpenSaved(saved.id)}
                  >
                    <strong>{saved.name}</strong>
                    <span>{saved.organization || "Organization not named"}</span>
                    <small>Last changed {new Date(saved.updatedAt).toLocaleString()}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="first-run__import">
            <h2>Restore a portable backup</h2>
            <p>
              Import is available before creating a new project. The bundle is validated locally
              before any project is opened.
            </p>
            <Field label="Backup password (encrypted bundles only)">
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
            <Field label="Choose a Class A Bridge backup">
              <input
                type="file"
                accept=".classabridge,.encrypted"
                disabled={importState === "busy"}
                onChange={(event) => void importFile(event)}
              />
            </Field>
            {importMessage && (
              <div className="error-summary" role="alert">
                <strong>Backup import stopped safely.</strong>
                <p>{importMessage}</p>
              </div>
            )}
          </div>
        </section>
        <footer className="first-run__footer">
          <span>Open source · Local-first · Preparation support, not certification</span>
          <a href="../security-and-privacy">Security and privacy</a>
        </footer>
      </main>
    </>
  );
}

function PdfStart({
  onCancel,
  onManual,
  onProject,
}: {
  readonly onCancel: () => void;
  readonly onManual: () => void;
  readonly onProject: (
    project: BridgeProject,
    attachment: { readonly id: string; readonly bytes: Uint8Array },
  ) => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const validation = validatePdfFile(file);
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const [result, bytes] = await Promise.all([
        parsePdfLocally(file),
        file.arrayBuffer().then((value) => new Uint8Array(value)),
      ]);
      const project = initializeProject(
        safeFilename(file.name.replace(/\.pdf$/iu, "")) || "Class A preparation",
        "Your organization",
      );
      const attachmentId = `soc2-${crypto.randomUUID()}`;
      project.soc2.sourceReport = {
        fileName: safeFilename(file.name),
        attachmentId,
        sha256: await sha256Hex(bytes),
      };
      project.soc2.extractionCandidates = result.candidates.map((candidate) => ({ ...candidate }));
      project.materials = project.materials.map((material) =>
        material.kind === "soc2_report"
          ? {
              ...material,
              status: "needs_confirmation",
              attachmentId,
              rationale:
                result.warning ??
                "A local PDF was processed; confirm the extracted report details.",
            }
          : material,
      );
      if (result.warning) project.notes = result.warning;
      await onProject(project, { id: attachmentId, bytes });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "The file could not be processed locally.",
      );
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  };
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <main className="focused-page" id="main-content" tabIndex={-1}>
        <button className="back-link" onClick={onCancel}>
          ← Back
        </button>
        <Card title="Start with your SOC 2 report" eyebrow="Local document processing">
          <Callout title="Your report is not uploaded" tone="positive">
            <p>
              The PDF is read by a parser bundled with this application. No report name, text,
              metadata, or assessment answer is sent to Ancilis.
            </p>
          </Callout>
          <div className="drop-zone">
            <span className="drop-zone__icon" aria-hidden="true">
              PDF
            </span>
            <h3>Choose a SOC 2 report from this device</h3>
            <p>
              PDF only, up to 25 MB. Scanned, encrypted, or unreadable reports can be entered
              manually.
            </p>
            <label className="button button--primary">
              {busy ? "Processing locally…" : "Choose PDF"}
              <input
                className="visually-hidden"
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) => void handleFile(event)}
                disabled={busy}
              />
            </label>
          </div>
          {error && (
            <div className="error-summary" role="alert">
              <strong>We could not use that file.</strong>
              <p>{error}</p>
              <Button variant="secondary" onClick={onManual}>
                Continue with manual entry
              </Button>
            </div>
          )}
          <details>
            <summary>What the local parser looks for</summary>
            <p>
              Report type, issuer, period, date, system name, Trust Services Criteria, control
              identifiers, subservice organizations, treatment, exceptions, complementary controls,
              and bridge-letter references. Every item remains unconfirmed until you review it.
            </p>
          </details>
        </Card>
      </main>
    </>
  );
}

function PdfReview({
  project,
  update,
  onContinue,
}: {
  readonly project: BridgeProject;
  readonly update: (recipe: (draft: BridgeProject) => void) => void;
  readonly onContinue: () => void;
}) {
  const decide = (id: string, decision: "confirmed" | "edited" | "ignored", value?: string) =>
    update((draft) => {
      const candidate = draft.soc2.extractionCandidates.find((item) => item.id === id);
      if (!candidate) return;
      candidate.decision = decision;
      if (value !== undefined) candidate.value = value;
      if (decision === "confirmed" || decision === "edited") {
        if (candidate.field === "SOC 2 report type" && /type\s+ii/iu.test(candidate.value))
          draft.soc2.confirmedType = "type_ii";
        if (candidate.field === "Report issuer") draft.soc2.issuer = candidate.value;
        if (candidate.field === "Report date") draft.soc2.reportDate = candidate.value;
        if (candidate.field === "Report period") {
          const [start, end] = candidate.value.split(" to ", 2);
          if (start) draft.soc2.reportStart = start;
          if (end) draft.soc2.reportEnd = end;
        }
        if (candidate.field === "System or service name") draft.soc2.systemName = candidate.value;
        if (candidate.field === "Carve-out treatment") draft.soc2.treatment = "carve_out";
        if (candidate.field === "Inclusive treatment") draft.soc2.treatment = "inclusive";
        if (candidate.field === "Trust Services Criteria")
          draft.soc2.trustServicesCriteria = [
            ...new Set([...draft.soc2.trustServicesCriteria, candidate.value]),
          ];
        if (candidate.field === "Subservice organization")
          draft.soc2.subserviceOrganizations = [
            ...new Set([...draft.soc2.subserviceOrganizations, candidate.value]),
          ];
        if (candidate.field === "Complementary user-entity controls")
          draft.soc2.complementaryUserEntityControls = [
            ...new Set([...draft.soc2.complementaryUserEntityControls, candidate.value]),
          ];
        if (candidate.field === "Bridge or gap letter reference")
          draft.soc2.bridgeLetterReference = candidate.value;
      }
    });
  const reviewed = project.soc2.extractionCandidates.filter(
    (item) => item.decision !== "unreviewed",
  ).length;
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <main className="focused-page focused-page--wide" id="main-content" tabIndex={-1}>
        <p className="eyebrow">Confirm local extraction</p>
        <h1>Review every suggested report value.</h1>
        <p className="lede">
          Extracted text is not authoritative. Confirm, edit, or ignore each item; the tool never
          completes a requirement from an extracted value.
        </p>
        <ProgressTrack
          current={reviewed}
          total={Math.max(project.soc2.extractionCandidates.length, 1)}
          label="Extraction candidates reviewed"
        />
        {project.notes && (
          <Callout title="Manual entry may be needed" tone="warning">
            <p>{project.notes}</p>
          </Callout>
        )}
        {project.soc2.extractionCandidates.length === 0 ? (
          <EmptyState
            title="No reliable candidates found"
            action={<Button onClick={onContinue}>Continue manually</Button>}
          >
            <p>
              The report may be scanned or use an unfamiliar format. Your project is preserved and
              the manual path remains available.
            </p>
          </EmptyState>
        ) : (
          <div className="candidate-list">
            {project.soc2.extractionCandidates.map((candidate) => (
              <article className="candidate" key={candidate.id}>
                <div className="candidate__meta">
                  <span>Page {candidate.page}</span>
                  <StatusPill
                    tone={
                      candidate.confidence === "high"
                        ? "positive"
                        : candidate.confidence === "medium"
                          ? "info"
                          : "warning"
                    }
                  >
                    {candidate.confidence} confidence
                  </StatusPill>
                  <StatusPill tone={toneFor(candidate.decision)}>
                    {statusLabel(candidate.decision)}
                  </StatusPill>
                </div>
                <label>
                  <strong>{candidate.field}</strong>
                  <input
                    value={candidate.value}
                    onChange={(event) => decide(candidate.id, "edited", event.target.value)}
                  />
                </label>
                <blockquote>{candidate.snippet}</blockquote>
                <p className="small">
                  Detected by: {candidate.detector}. Human confirmation is required.
                </p>
                <div className="button-row">
                  <Button onClick={() => decide(candidate.id, "confirmed")}>Confirm</Button>
                  <Button
                    variant="secondary"
                    onClick={() => decide(candidate.id, "edited", candidate.value)}
                  >
                    Mark edited
                  </Button>
                  <Button variant="quiet" onClick={() => decide(candidate.id, "ignored")}>
                    Ignore
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
        <div className="sticky-action">
          <div>
            <strong>
              {reviewed} of {project.soc2.extractionCandidates.length} reviewed
            </strong>
            <p>You can revisit every item under SOC 2 materials.</p>
          </div>
          <Button onClick={onContinue}>Continue to fit assessment</Button>
        </div>
      </main>
    </>
  );
}

function Shell({
  project,
  route,
  setRoute,
  update,
  store,
  persistGeneratedProject,
  onClose,
  onRestore,
  saveState,
  online,
  updateAvailable,
  onApplyUpdate,
  restoreMessage,
  onDismissRestoreMessage,
}: {
  readonly project: BridgeProject;
  readonly route: Route;
  readonly setRoute: (route: Route) => void;
  readonly update: (recipe: (draft: BridgeProject) => void) => void;
  readonly store: ProjectStore;
  readonly persistGeneratedProject: (
    project: BridgeProject,
    output: { readonly id: string; readonly bytes: Uint8Array },
  ) => Promise<boolean>;
  readonly onClose: () => void;
  readonly onRestore: (file: File, password: string) => Promise<void>;
  readonly saveState: SaveState;
  readonly online: boolean;
  readonly updateAvailable: boolean;
  readonly onApplyUpdate: () => void;
  readonly restoreMessage: string;
  readonly onDismissRestoreMessage: () => void;
}) {
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    mainRef.current?.focus();
  }, [route]);
  const screens: Record<Route, ReactNode> = {
    "/overview": <Overview project={project} navigate={setRoute} />,
    "/eligibility": <Eligibility project={project} update={update} />,
    "/scope": <Scope project={project} update={update} />,
    "/soc2-materials": <Soc2Materials project={project} update={update} />,
    "/requirements": <Requirements project={project} update={update} />,
    "/evidence": <Evidence project={project} update={update} store={store} />,
    "/action-plan": <ActionPlan project={project} update={update} navigate={setRoute} />,
    "/package": (
      <Package
        project={project}
        update={update}
        store={store}
        navigate={setRoute}
        persistGeneratedProject={persistGeneratedProject}
      />
    ),
    "/reports": <Reports project={project} />,
    "/settings": (
      <Settings
        project={project}
        update={update}
        store={store}
        saveState={saveState}
        onClose={onClose}
        onRestore={onRestore}
      />
    ),
  };
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <aside className="sidebar">
        <button className="brand" onClick={() => setRoute("/overview")}>
          <span className="brand-mark" aria-hidden="true">
            A
          </span>
          <span>
            CLASS A BRIDGE<small>BY ANCILIS</small>
          </span>
        </button>
        <nav aria-label="Project navigation">
          {NAVIGATION.map((item) => (
            <button
              key={item.route}
              className={route === item.route ? "nav-item nav-item--active" : "nav-item"}
              aria-current={route === item.route ? "page" : undefined}
              onClick={() => setRoute(item.route)}
            >
              <span aria-hidden="true">{item.short}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar__footer">
          <p>Catalog</p>
          <strong>{CATALOG_MANIFEST.catalogVersion}</strong>
          <span>Verified {CATALOG_MANIFEST.verifiedAt}</span>
        </div>
      </aside>
      <div className="workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">{project.organization.name || "Your organization"}</p>
            <strong>{project.metadata.name}</strong>
          </div>
          <div className="privacy-indicator">
            <span aria-hidden="true">●</span>
            <span>
              <strong>Private workspace</strong> — project data stays in this browser.
            </span>
          </div>
        </header>
        <div className="workspace-state">
          <div className="connection-state" role="status" aria-label="Connection status">
            <span aria-hidden="true">{online ? "●" : "○"}</span>
            {online ? "Online — local workspace ready" : "Offline — workspace remains available"}
          </div>
          {saveState.status === "error" ? (
            <div className="save-state save-state--error" role="alert">
              <strong>Local save failed:</strong> {saveState.message}. Export a backup before
              closing this tab.
            </div>
          ) : (
            <div className="save-state" role="status" aria-label="Local save status">
              {saveState.status === "saving"
                ? "Saving locally…"
                : saveState.status === "saved"
                  ? "Saved locally"
                  : "Local save will begin after the first change"}
            </div>
          )}
          {updateAvailable && (
            <div className="update-state" role="status">
              <span>A Class A Bridge update is ready.</span>
              <Button
                variant="secondary"
                onClick={onApplyUpdate}
                disabled={saveState.status === "saving" || saveState.status === "error"}
              >
                Apply update
              </Button>
            </div>
          )}
        </div>
        {project.metadata.isSample && (
          <div className="sample-banner" role="note">
            Fictional demonstration — not an actual certification package.
          </div>
        )}
        {restoreMessage && (
          <div className="toast" role="status" aria-label="Backup restore status">
            <span>{restoreMessage}</span>
            <button
              className="toast__dismiss"
              type="button"
              aria-label="Dismiss backup restore status"
              onClick={onDismissRestoreMessage}
            >
              ×
            </button>
          </div>
        )}
        <main className="screen" id="main-content" ref={mainRef} tabIndex={-1}>
          {screens[route]}
        </main>
      </div>
    </div>
  );
}

function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

function Overview({
  project,
  navigate,
}: {
  readonly project: BridgeProject;
  readonly navigate: (route: Route) => void;
}) {
  const milestone = requirementMilestone(project);
  const result = project.eligibility.result;
  const openActions = project.actions.filter((item) => item.status !== "done");
  const evidenceReview = project.evidence.filter((item) => item.reviewStatus !== "reviewed").length;
  const soc2Freshness = soc2PackageFreshness(project);
  return (
    <>
      <PageHeading
        eyebrow="Preparation overview"
        title={project.offering.name || "Your Class A preparation workspace"}
        description="See the next decisions that materially affect eligibility, scope, evidence, and package structure."
        action={
          <Button variant="secondary" onClick={() => navigate("/settings")}>
            Manage local data
          </Button>
        }
      />
      <div className="metric-grid">
        <Card title="Preliminary fit">
          <StatusPill tone={result ? toneFor(result.classification) : "warning"}>
            {result?.label ?? "Interview not complete"}
          </StatusPill>
          <p>
            {result?.summary ??
              "Answer eight focused questions to receive a reasoned preliminary result."}
          </p>
          <Button variant="quiet" onClick={() => navigate("/eligibility")}>
            {result ? "Review rationale" : "Start the interview"} →
          </Button>
        </Card>
        <Card title="SOC 2 freshness">
          <StatusPill tone={toneFor(soc2Freshness)}>
            {soc2Freshness === "fresh" ? "Confirmed within window" : statusLabel(soc2Freshness)}
          </StatusPill>
          <p>
            {project.soc2.reportEnd
              ? `Report period ends ${project.soc2.reportEnd}.`
              : "Confirm the report and assessment dates before relying on freshness."}
          </p>
          <Button variant="quiet" onClick={() => navigate("/soc2-materials")}>
            Confirm report dates →
          </Button>
        </Card>
        <Card title="Mandatory requirements">
          <strong className="big-number">
            {milestone.complete} <small>of {milestone.total}</small>
          </strong>
          <p>
            Mandatory requirement records have complete internal-review drafts or provider approval.
          </p>
          <Button variant="quiet" onClick={() => navigate("/requirements")}>
            Continue requirement work →
          </Button>
        </Card>
        <Card title="Evidence review">
          <strong className="big-number">{evidenceReview}</strong>
          <p>
            Evidence candidates still need human review. A file is never treated as sufficient
            automatically.
          </p>
          <Button variant="quiet" onClick={() => navigate("/evidence")}>
            Review evidence candidates →
          </Button>
        </Card>
      </div>
      <div className="two-column">
        <Card title="Next three actions" eyebrow="Prioritized from your current record">
          {openActions.length === 0 ? (
            <EmptyState title="No generated actions">
              <p>Re-run the action plan after adding scope, materials, or requirements.</p>
            </EmptyState>
          ) : (
            <ol className="action-list">
              {openActions.slice(0, 3).map((item) => (
                <li key={item.id}>
                  <div>
                    <StatusPill tone={toneFor(item.priority)}>{item.priority}</StatusPill>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                    <span>{item.owner}</span>
                  </div>
                  <Button variant="secondary" onClick={() => navigate(routeFrom(item.nextRoute))}>
                    Open
                  </Button>
                </li>
              ))}
            </ol>
          )}
        </Card>
        <Card title="Current unresolved decisions">
          {[
            ...(result?.missingInformation ?? []),
            ...project.scope.questions,
            ...project.scope.mismatchFindings,
          ].slice(0, 6).length ? (
            <ul className="plain-list">
              {[
                ...(result?.missingInformation ?? []),
                ...project.scope.questions,
                ...project.scope.mismatchFindings,
              ]
                .slice(0, 6)
                .map((item) => (
                  <li key={item}>{item}</li>
                ))}
            </ul>
          ) : (
            <EmptyState title="No decisions recorded yet">
              <p>Add report details and scope resources to surface decisions that need owners.</p>
            </EmptyState>
          )}
        </Card>
      </div>
      <Callout title="Get judgment where it matters" tone="neutral">
        <p>
          Software can organize the record. Ancilis can help validate the interpretation, close
          implementation gaps, and review the package before your company applies.
        </p>
        <a
          className="button button--secondary"
          href="../contact"
          target="_blank"
          rel="noopener noreferrer"
        >
          Request an Ancilis Class A readiness review
        </a>
        <span className="small">Opening this contact page sends no project data.</span>
      </Callout>
    </>
  );
}

function Eligibility({
  project,
  update,
}: {
  readonly project: BridgeProject;
  readonly update: (recipe: (draft: BridgeProject) => void) => void;
}) {
  const answers = new Map(project.eligibility.answers.map((item) => [item.questionId, item.value]));
  const nextQuestion = ELIGIBILITY_QUESTIONS.find((question) => !answers.has(question.id));
  const setAnswer = (id: (typeof ELIGIBILITY_QUESTIONS)[number]["id"], value: AnswerValue) =>
    update((draft) => Object.assign(draft, answerEligibility(draft, id, value)));
  if (nextQuestion) {
    return (
      <>
        <PageHeading
          eyebrow="Preliminary eligibility"
          title="Eight decisions to find your starting point"
          description="One plain-language question at a time. You can use “Not sure” without losing progress."
        />
        <ProgressTrack current={answers.size} total={8} label="High-value questions answered" />
        <Card title={nextQuestion.question} eyebrow={`Question ${answers.size + 1} of 8`}>
          <div className="question-context">
            <div>
              <strong>Why we are asking</strong>
              <p>{nextQuestion.why}</p>
            </div>
            <div>
              <strong>Plain-language example</strong>
              <p>{nextQuestion.example}</p>
            </div>
            <div>
              <strong>A strong answer generally looks like</strong>
              <p>{nextQuestion.strongAnswer}</p>
            </div>
            <div>
              <strong>Who usually knows</strong>
              <p>{nextQuestion.owner}</p>
            </div>
          </div>
          {nextQuestion.canBlock && (
            <Callout title="This answer can identify a potential blocker" tone="warning">
              <p>A blocker is a preparation finding, not a FedRAMP determination.</p>
            </Callout>
          )}
          <div className="answer-buttons">
            <Button onClick={() => setAnswer(nextQuestion.id, "yes")}>Yes</Button>
            <Button variant="secondary" onClick={() => setAnswer(nextQuestion.id, "no")}>
              No
            </Button>
            <Button variant="quiet" onClick={() => setAnswer(nextQuestion.id, "not_sure")}>
              Not sure
            </Button>
          </div>
          <details>
            <summary>View official details</summary>
            <p>
              Applicable rule references: {nextQuestion.ruleRefs.join(", ")}. The evaluator uses a
              deterministic decision rule and still requires source-document and human review.
            </p>
          </details>
        </Card>
      </>
    );
  }
  const result = project.eligibility.result;
  return (
    <>
      <PageHeading
        eyebrow="Preliminary eligibility"
        title={result?.label ?? "Result needs regeneration"}
        description="This preparation result explains its inputs, rules, method, uncertainty, and next actions."
      />
      {result && (
        <Card title="Preliminary Class A fit result">
          <div className="result-header">
            <StatusPill tone={toneFor(result.classification)}>{result.label}</StatusPill>
            <span>Deterministic from 8 confirmed answers</span>
          </div>
          <p className="lede-small">{result.summary}</p>
          <Callout title="Important boundary" tone="warning">
            <p>{result.disclaimer}</p>
          </Callout>
          <div className="three-column">
            <div>
              <h3>Potential blockers</h3>
              <ListOrEmpty
                items={result.blockers}
                empty="No immediate blocker identified by these eight answers."
              />
            </div>
            <div>
              <h3>Missing information</h3>
              <ListOrEmpty
                items={result.missingInformation}
                empty="No “Not sure” answers remain."
              />
            </div>
            <div>
              <h3>Next three actions</h3>
              <ListOrEmpty items={result.recommendedActions} />
            </div>
          </div>
        </Card>
      )}
      <Card title="Answers and rationale" eyebrow="Revise any answer">
        <div className="answer-review">
          {ELIGIBILITY_QUESTIONS.map((question) => (
            <div className="answer-review__row" key={question.id}>
              <div>
                <strong>{question.question}</strong>
                <p>{question.why}</p>
              </div>
              <label>
                <span className="visually-hidden">Answer for {question.question}</span>
                <select
                  value={answers.get(question.id)}
                  onChange={(event) => setAnswer(question.id, event.target.value as AnswerValue)}
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                  <option value="not_sure">Not sure</option>
                </select>
              </label>
            </div>
          ))}
        </div>
      </Card>
      <Card
        title="Application prerequisites and follow-up confirmation"
        eyebrow="Shown after the eight-question result"
      >
        <p>
          These follow-up items refine the action plan without delaying the preliminary result. “Not
          sure” remains an acceptable answer and creates a confirmation task.
        </p>
        <div className="form-grid">
          <Field label="Will the offering handle federal customer data?">
            <select
              value={project.offering.handlesFederalData}
              onChange={(event) =>
                update((draft) => {
                  draft.offering.handlesFederalData = event.target
                    .value as BridgeProject["offering"]["handlesFederalData"];
                })
              }
            >
              <option value="not_sure">Not sure</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>
          <Field label="Marketplace listing status">
            <select
              value={project.organization.marketplaceStatus}
              onChange={(event) =>
                update((draft) => {
                  draft.organization.marketplaceStatus = event.target
                    .value as BridgeProject["organization"]["marketplaceStatus"];
                })
              }
            >
              <option value="not_started">Not started</option>
              <option value="preparing">Preparing</option>
              <option value="listed">Listed</option>
              <option value="not_sure">Not sure</option>
            </select>
          </Field>
          <Field label="Accountable executive">
            <input
              value={project.organization.accountableExecutive ?? ""}
              onChange={(event) =>
                update((draft) => {
                  draft.organization.accountableExecutive = event.target.value || undefined;
                })
              }
            />
          </Field>
          <Field label="Trust center or equivalent sharing URL">
            <input
              type="url"
              value={project.organization.trustCenterUrl ?? ""}
              onChange={(event) =>
                update((draft) => {
                  draft.organization.trustCenterUrl = event.target.value || undefined;
                })
              }
            />
          </Field>
          {project.materials
            .filter((material) => material.kind === "bridge_letter")
            .map((material) => (
              <Field label="Bridge or gap letter status" key={material.id}>
                <select
                  value={material.status}
                  onChange={(event) =>
                    update((draft) => {
                      const item = draft.materials.find(
                        (candidate) => candidate.id === material.id,
                      );
                      if (item) item.status = event.target.value as typeof item.status;
                    })
                  }
                >
                  <option value="needs_confirmation">Needs confirmation</option>
                  <option value="present">Present</option>
                  <option value="missing">Needed and missing</option>
                  <option value="expiring">Present but expiring</option>
                  <option value="not_applicable">Not applicable with rationale</option>
                </select>
              </Field>
            ))}
        </div>
      </Card>
      <Card title="Decision provenance">
        {result?.findings.map((finding) => (
          <details key={finding.id} className="finding">
            <summary>
              <StatusPill tone={toneFor(finding.title)}>{finding.title}</StatusPill>{" "}
              {finding.summary}
            </summary>
            <dl className="details-grid">
              <div>
                <dt>Supporting answers</dt>
                <dd>{finding.answerRefs.join(", ")}</dd>
              </div>
              <div>
                <dt>Applicable rules</dt>
                <dd>{finding.ruleRefs.join(", ")}</dd>
              </div>
              <div>
                <dt>Method</dt>
                <dd>{finding.method}</dd>
              </div>
              <div>
                <dt>Certainty</dt>
                <dd>{finding.certainty}</dd>
              </div>
              <div>
                <dt>Human review</dt>
                <dd>{finding.humanReview ? "Required" : "Not flagged"}</dd>
              </div>
              <div>
                <dt>Evidence that would resolve it</dt>
                <dd>{finding.evidenceNeeded.join("; ")}</dd>
              </div>
            </dl>
          </details>
        ))}
      </Card>
    </>
  );
}

function Scope({
  project,
  update,
}: {
  readonly project: BridgeProject;
  readonly update: (recipe: (draft: BridgeProject) => void) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] =
    useState<BridgeProject["scope"]["resources"][number]["kind"]>("component");
  const [relationshipFrom, setRelationshipFrom] = useState(project.scope.resources[0]?.id ?? "");
  const [relationshipTo, setRelationshipTo] = useState(project.scope.resources[1]?.id ?? "");
  const [relationshipKind, setRelationshipKind] =
    useState<BridgeProject["scope"]["relationships"][number]["kind"]>("sends_data");
  const [relationshipDescription, setRelationshipDescription] = useState("");
  const add = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    update((draft) => {
      draft.scope.resources.push({
        id: `scope-${crypto.randomUUID()}`,
        name: name.trim(),
        kind,
        description: description.trim(),
        handlesFederalData: false,
        affectsCia: true,
        included: true,
        rationale: "Included because it can affect the proposed cloud service offering.",
        needsTechnicalConfirmation: true,
      });
      draft.scope.questions.push(
        `Confirm ${name.trim()} ownership, data handling, and boundary impact with a technical owner.`,
      );
    });
    setName("");
    setDescription("");
  };
  const addRelationship = (event: FormEvent) => {
    event.preventDefault();
    if (!relationshipFrom || !relationshipTo || relationshipFrom === relationshipTo) return;
    update((draft) => {
      draft.scope.relationships.push({
        id: `relationship-${crypto.randomUUID()}`,
        fromId: relationshipFrom,
        toId: relationshipTo,
        kind: relationshipKind,
        description: relationshipDescription.trim(),
      });
      const from = draft.scope.resources.find((resource) => resource.id === relationshipFrom);
      const to = draft.scope.resources.find((resource) => resource.id === relationshipTo);
      if (from && to && !relationshipDescription.trim())
        draft.scope.questions.push(
          `Confirm how ${from.name} ${statusLabel(relationshipKind).toLowerCase()} ${to.name}.`,
        );
    });
    setRelationshipDescription("");
  };
  const included = project.scope.resources.filter((item) => item.included);
  const resourceName = (id: string) =>
    project.scope.resources.find((resource) => resource.id === id)?.name ?? "Unknown resource";
  return (
    <>
      <PageHeading
        eyebrow="Cloud service offering scope"
        title="Build the boundary as a simple inventory"
        description="List what stores federal customer data or can affect confidentiality, integrity, or availability. A technical architecture diagram is not required to begin."
      />
      <div className="two-column two-column--sidebar">
        <Card title="Add a resource or provider">
          <form onSubmit={add} className="form-stack">
            <Field label="Name">
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </Field>
            <Field label="Type">
              <select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
                {[
                  "environment",
                  "component",
                  "data_store",
                  "identity",
                  "logging",
                  "development",
                  "security_tool",
                  "endpoint",
                  "third_party_cloud",
                  "service_provider",
                ].map((value) => (
                  <option value={value} key={value}>
                    {statusLabel(value)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="What it does">
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
              />
            </Field>
            <Button type="submit">Add to inventory</Button>
          </form>
        </Card>
        <Card
          title="Scope inventory"
          actions={<StatusPill tone="info">{included.length} included</StatusPill>}
        >
          {project.scope.resources.length === 0 ? (
            <EmptyState title="No systems listed yet">
              <p>
                Start with the customer-facing product, production environment, primary data store,
                identity, logging, deployment, and material service providers.
              </p>
            </EmptyState>
          ) : (
            <div className="resource-list">
              {project.scope.resources.map((resource) => (
                <article key={resource.id}>
                  <div>
                    <span className="resource-kind">{statusLabel(resource.kind)}</span>
                    <h3>{resource.name}</h3>
                    <p>{resource.description || resource.rationale}</p>
                  </div>
                  <div className="resource-controls">
                    <label>
                      <input
                        type="checkbox"
                        checked={resource.included}
                        onChange={(event) =>
                          update((draft) => {
                            const item = draft.scope.resources.find(
                              (candidate) => candidate.id === resource.id,
                            );
                            if (item) item.included = event.target.checked;
                          })
                        }
                      />{" "}
                      In scope
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={resource.handlesFederalData}
                        onChange={(event) =>
                          update((draft) => {
                            const item = draft.scope.resources.find(
                              (candidate) => candidate.id === resource.id,
                            );
                            if (item) item.handlesFederalData = event.target.checked;
                          })
                        }
                      />{" "}
                      Federal data
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={resource.affectsCia}
                        onChange={(event) =>
                          update((draft) => {
                            const item = draft.scope.resources.find(
                              (candidate) => candidate.id === resource.id,
                            );
                            if (item) item.affectsCia = event.target.checked;
                          })
                        }
                      />{" "}
                      Affects CIA
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={resource.needsTechnicalConfirmation}
                        onChange={(event) =>
                          update((draft) => {
                            const item = draft.scope.resources.find(
                              (candidate) => candidate.id === resource.id,
                            );
                            if (item) item.needsTechnicalConfirmation = event.target.checked;
                          })
                        }
                      />{" "}
                      Needs technical confirmation
                    </label>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Card>
      </div>
      <Card title="Scope relationships" eyebrow="Simple data-flow and dependency builder">
        <p>
          Connect inventory items to explain how data moves, identity is used, logs are collected,
          deployments occur, or one service depends on another. A technical diagram is optional.
        </p>
        <form
          className="relationship-form"
          aria-label="Add a scope relationship"
          onSubmit={addRelationship}
        >
          <Field label="From resource">
            <select
              value={relationshipFrom}
              onChange={(event) => setRelationshipFrom(event.target.value)}
            >
              <option value="">Choose a resource</option>
              {project.scope.resources.map((resource) => (
                <option key={resource.id} value={resource.id}>
                  {resource.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Relationship">
            <select
              value={relationshipKind}
              onChange={(event) =>
                setRelationshipKind(event.target.value as typeof relationshipKind)
              }
            >
              {["sends_data", "authenticates", "logs_to", "deploys_to", "depends_on"].map(
                (value) => (
                  <option key={value} value={value}>
                    {statusLabel(value)}
                  </option>
                ),
              )}
            </select>
          </Field>
          <Field label="To resource">
            <select
              value={relationshipTo}
              onChange={(event) => setRelationshipTo(event.target.value)}
            >
              <option value="">Choose a resource</option>
              {project.scope.resources.map((resource) => (
                <option key={resource.id} value={resource.id}>
                  {resource.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Relationship description">
            <input
              value={relationshipDescription}
              onChange={(event) => setRelationshipDescription(event.target.value)}
              placeholder="What moves or depends on this connection?"
            />
          </Field>
          <Button
            type="submit"
            disabled={!relationshipFrom || !relationshipTo || relationshipFrom === relationshipTo}
          >
            Add relationship
          </Button>
        </form>
        {project.scope.relationships.length === 0 ? (
          <p className="empty-copy">No relationships recorded yet.</p>
        ) : (
          <div className="relationship-list">
            {project.scope.relationships.map((relationship) => (
              <article
                key={relationship.id}
                aria-label={`${resourceName(relationship.fromId)} ${statusLabel(
                  relationship.kind,
                ).toLowerCase()} ${resourceName(relationship.toId)} relationship`}
              >
                <div>
                  <strong>
                    {resourceName(relationship.fromId)} → {resourceName(relationship.toId)}
                  </strong>
                  <span>{statusLabel(relationship.kind)}</span>
                  <p>{relationship.description || "Description needs technical confirmation."}</p>
                </div>
                <Button
                  variant="quiet"
                  onClick={() =>
                    update((draft) => {
                      draft.scope.relationships = draft.scope.relationships.filter(
                        (candidate) => candidate.id !== relationship.id,
                      );
                    })
                  }
                >
                  Remove relationship
                </Button>
              </article>
            ))}
          </div>
        )}
      </Card>
      <Card title="Generated scope summaries">
        <div className="form-grid">
          <Field
            label="Plain-language scope summary"
            hint="Describe the included offering and why these resources matter."
          >
            <textarea
              rows={5}
              value={project.scope.summary}
              onChange={(event) =>
                update((draft) => {
                  draft.scope.summary = event.target.value;
                })
              }
            />
          </Field>
          <Field
            label="Basic data-flow summary"
            hint="Describe where customer data enters, is stored, and creates logs."
          >
            <textarea
              rows={5}
              value={project.scope.dataFlowSummary}
              onChange={(event) =>
                update((draft) => {
                  draft.scope.dataFlowSummary = event.target.value;
                })
              }
            />
          </Field>
        </div>
        <h3>Technical confirmation questions</h3>
        <ListOrEmpty
          items={project.scope.questions}
          empty="Questions appear as resources are added."
        />
        <h3>Potential SOC 2 mismatch</h3>
        <ListOrEmpty
          items={project.scope.mismatchFindings}
          empty="No mismatch has been recorded. This is not confirmation that the scopes match."
        />
      </Card>
    </>
  );
}

function Soc2Materials({
  project,
  update,
}: {
  readonly project: BridgeProject;
  readonly update: (recipe: (draft: BridgeProject) => void) => void;
}) {
  const [controlId, setControlId] = useState(project.soc2.controls[0]?.id ?? "");
  const [ruleId, setRuleId] = useState<string>(RULE_SELECTIONS.mandatory[0]);
  const [page, setPage] = useState("1");
  const [newControlId, setNewControlId] = useState("");
  const [newControlTitle, setNewControlTitle] = useState("");
  const [newControlPages, setNewControlPages] = useState("");
  const [newControlCriteria, setNewControlCriteria] = useState("");
  const [newControlTest, setNewControlTest] = useState("");
  const [newControlResult, setNewControlResult] = useState("");
  const [newControlExcerpt, setNewControlExcerpt] = useState("");
  const [newControlExceptionId, setNewControlExceptionId] = useState("");
  const [controlError, setControlError] = useState("");
  const [exceptionTitle, setExceptionTitle] = useState("");
  const [exceptionDescription, setExceptionDescription] = useState("");
  const [exceptionPages, setExceptionPages] = useState("");
  const [exceptionMateriality, setExceptionMateriality] = useState<
    "minor" | "material" | "not_sure"
  >("not_sure");
  const lines = (value: string) => [
    ...new Set(
      value
        .split(/\r?\n|,/u)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
  const pages = (value: string) => [
    ...new Set(
      value
        .split(/[^0-9]+/u)
        .map(Number)
        .filter((item) => Number.isInteger(item) && item > 0),
    ),
  ];
  const addControl = (event: FormEvent) => {
    event.preventDefault();
    const identifier = newControlId.trim();
    if (!identifier || !newControlTitle.trim()) return;
    if (project.soc2.controls.some((control) => control.id === identifier)) {
      setControlError(
        "That control identifier already exists. Remove it or use a distinct identifier.",
      );
      return;
    }
    update((draft) =>
      draft.soc2.controls.push({
        id: identifier,
        title: newControlTitle.trim(),
        trustServicesCriteria: lines(newControlCriteria),
        reportPages: pages(newControlPages),
        auditorTest: newControlTest.trim(),
        auditorResult: newControlResult.trim(),
        exceptionIds: newControlExceptionId ? [newControlExceptionId] : [],
        excerpt: newControlExcerpt.trim(),
      }),
    );
    setControlId(identifier);
    setNewControlId("");
    setNewControlTitle("");
    setNewControlPages("");
    setNewControlCriteria("");
    setNewControlTest("");
    setNewControlResult("");
    setNewControlExcerpt("");
    setNewControlExceptionId("");
    setControlError("");
  };
  const addException = (event: FormEvent) => {
    event.preventDefault();
    if (!exceptionTitle.trim() || !exceptionDescription.trim()) return;
    update((draft) =>
      draft.soc2.exceptions.push({
        id: `exception-${crypto.randomUUID()}`,
        title: exceptionTitle.trim(),
        description: exceptionDescription.trim(),
        materiality: exceptionMateriality,
        pages: pages(exceptionPages),
      }),
    );
    setExceptionTitle("");
    setExceptionDescription("");
    setExceptionPages("");
    setExceptionMateriality("not_sure");
  };
  const addMapping = (event: FormEvent) => {
    event.preventDefault();
    if (!controlId || !ruleId) return;
    update((draft) =>
      draft.mappings.push({
        id: `mapping-${crypto.randomUUID()}`,
        soc2ControlId: controlId,
        reportPage: Math.max(Number(page) || 1, 1),
        excerpt: "",
        classARuleId: ruleId,
        coverage: "needs_human_review",
        reason:
          "Manually linked by the user; scope, period, and coverage still require confirmation.",
        gapDescription: "",
        additionalEvidenceNeeded: "",
        suggested: false,
        confirmed: true,
      }),
    );
  };
  return (
    <>
      <PageHeading
        eyebrow="Existing assessment materials"
        title="Confirm the SOC 2 record and map only what you can support"
        description="A SOC 2 control can support a Class A requirement without fully covering it. Mappings remain many-to-many and human-reviewed."
      />
      <Card title="Confirmed report details">
        <div className="form-grid">
          <Field label="Report type">
            <select
              value={project.soc2.confirmedType}
              onChange={(event) =>
                update((draft) => {
                  draft.soc2.confirmedType = event.target
                    .value as BridgeProject["soc2"]["confirmedType"];
                })
              }
            >
              <option value="not_sure">Not sure</option>
              <option value="type_ii">SOC 2 Type II</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Report issuer">
            <input
              value={project.soc2.issuer}
              onChange={(event) =>
                update((draft) => {
                  draft.soc2.issuer = event.target.value;
                })
              }
            />
          </Field>
          <Field label="Report period start">
            <input
              type="date"
              value={project.soc2.reportStart ?? ""}
              onChange={(event) =>
                update((draft) => {
                  draft.soc2.reportStart = event.target.value;
                })
              }
            />
          </Field>
          <Field label="Report period end">
            <input
              type="date"
              value={project.soc2.reportEnd ?? ""}
              onChange={(event) =>
                update((draft) => {
                  draft.soc2.reportEnd = event.target.value;
                })
              }
            />
          </Field>
          <Field label="Report date">
            <input
              type="date"
              value={project.soc2.reportDate ?? ""}
              onChange={(event) =>
                update((draft) => {
                  draft.soc2.reportDate = event.target.value;
                })
              }
            />
          </Field>
          <Field label="Assessed system or service">
            <input
              value={project.soc2.systemName}
              onChange={(event) =>
                update((draft) => {
                  draft.soc2.systemName = event.target.value;
                })
              }
            />
          </Field>
        </div>
      </Card>
      <Card title="Report scope and reliance context" eyebrow="Plain-language manual entry">
        <p>
          Record the report context that may affect scope or reliance. These entries organize the
          record; they do not determine whether a third party or control is acceptable for Class A.
        </p>
        <div className="form-grid">
          <Field label="Trust Services Criteria (one per line)">
            <textarea
              rows={4}
              value={project.soc2.trustServicesCriteria.join("\n")}
              onChange={(event) =>
                update((draft) => {
                  draft.soc2.trustServicesCriteria = event.target.value.split(/\r?\n/u);
                })
              }
              onBlur={(event) =>
                update((draft) => {
                  draft.soc2.trustServicesCriteria = lines(event.target.value);
                })
              }
              placeholder={"Security\nAvailability"}
            />
          </Field>
          <Field label="Subservice-organization treatment">
            <select
              value={project.soc2.treatment}
              onChange={(event) =>
                update((draft) => {
                  draft.soc2.treatment = event.target.value as BridgeProject["soc2"]["treatment"];
                })
              }
            >
              <option value="not_sure">Not sure</option>
              <option value="inclusive">Inclusive</option>
              <option value="carve_out">Carve-out</option>
              <option value="mixed">Mixed</option>
            </select>
          </Field>
          <Field label="Subservice organizations (one per line)">
            <textarea
              rows={4}
              value={project.soc2.subserviceOrganizations.join("\n")}
              onChange={(event) =>
                update((draft) => {
                  draft.soc2.subserviceOrganizations = event.target.value.split(/\r?\n/u);
                })
              }
              onBlur={(event) =>
                update((draft) => {
                  draft.soc2.subserviceOrganizations = lines(event.target.value);
                })
              }
            />
          </Field>
          <Field label="Complementary user-entity controls (one per line)">
            <textarea
              rows={4}
              value={project.soc2.complementaryUserEntityControls.join("\n")}
              onChange={(event) =>
                update((draft) => {
                  draft.soc2.complementaryUserEntityControls = event.target.value.split(/\r?\n/u);
                })
              }
              onBlur={(event) =>
                update((draft) => {
                  draft.soc2.complementaryUserEntityControls = lines(event.target.value);
                })
              }
            />
          </Field>
          <Field label="Bridge or gap letter reference">
            <input
              value={project.soc2.bridgeLetterReference ?? ""}
              onChange={(event) =>
                update((draft) => {
                  draft.soc2.bridgeLetterReference = event.target.value || undefined;
                })
              }
              placeholder="Date, document title, or local reference"
            />
          </Field>
        </div>
      </Card>
      <Card title="External assessment materials">
        <div className="materials-list">
          {project.materials.map((material) => (
            <article key={material.id}>
              <div>
                <h3>{material.title}</h3>
                <p>{material.rationale}</p>
              </div>
              <select
                aria-label={`Status for ${material.title}`}
                value={material.status}
                onChange={(event) =>
                  update((draft) => {
                    const item = draft.materials.find((candidate) => candidate.id === material.id);
                    if (item) item.status = event.target.value as typeof item.status;
                  })
                }
              >
                {["present", "missing", "expiring", "needs_confirmation", "not_applicable"].map(
                  (value) => (
                    <option key={value} value={value}>
                      {statusLabel(value)}
                    </option>
                  ),
                )}
              </select>
            </article>
          ))}
        </div>
      </Card>
      {project.soc2.extractionCandidates.length > 0 && (
        <Card title="Local extraction review" eyebrow="Every value remains correctable">
          <div className="compact-candidates">
            {project.soc2.extractionCandidates.map((candidate) => (
              <article key={candidate.id}>
                <div>
                  <strong>{candidate.field}</strong>
                  <span>Page {candidate.page}</span>
                </div>
                <p>{candidate.value}</p>
                <StatusPill tone={toneFor(candidate.decision)}>
                  {statusLabel(candidate.decision)}
                </StatusPill>
              </article>
            ))}
          </div>
        </Card>
      )}
      <Card title="SOC 2 controls and exceptions" eyebrow="Manual records remain reviewable">
        <details open={project.soc2.controls.length === 0}>
          <summary>Add or review SOC 2 controls</summary>
          <form className="form-grid" aria-label="Add a SOC 2 control" onSubmit={addControl}>
            <Field label="Control identifier">
              <input
                required
                value={newControlId}
                onChange={(event) => setNewControlId(event.target.value)}
                placeholder="CC6.1"
              />
            </Field>
            <Field label="Control title">
              <input
                required
                value={newControlTitle}
                onChange={(event) => setNewControlTitle(event.target.value)}
                placeholder="Access authorization"
              />
            </Field>
            <Field label="Report pages" hint="Separate page numbers with commas.">
              <input
                value={newControlPages}
                onChange={(event) => setNewControlPages(event.target.value)}
                inputMode="numeric"
                placeholder="42, 43"
              />
            </Field>
            <Field label="Trust Services Criteria" hint="Separate entries with commas.">
              <input
                value={newControlCriteria}
                onChange={(event) => setNewControlCriteria(event.target.value)}
                placeholder="Security, Availability"
              />
            </Field>
            <Field label="Auditor test">
              <textarea
                rows={3}
                value={newControlTest}
                onChange={(event) => setNewControlTest(event.target.value)}
              />
            </Field>
            <Field label="Auditor result">
              <textarea
                rows={3}
                value={newControlResult}
                onChange={(event) => setNewControlResult(event.target.value)}
              />
            </Field>
            <Field label="Relevant excerpt">
              <textarea
                rows={3}
                value={newControlExcerpt}
                onChange={(event) => setNewControlExcerpt(event.target.value)}
              />
            </Field>
            <Field label="Related auditor exception">
              <select
                value={newControlExceptionId}
                onChange={(event) => setNewControlExceptionId(event.target.value)}
              >
                <option value="">None recorded</option>
                {project.soc2.exceptions.map((exception) => (
                  <option key={exception.id} value={exception.id}>
                    {exception.title}
                  </option>
                ))}
              </select>
            </Field>
            <div className="button-row form-grid__full">
              <Button type="submit">Add SOC 2 control</Button>
            </div>
          </form>
          {controlError && (
            <div className="error-summary" role="alert">
              <strong>Control not added.</strong>
              <p>{controlError}</p>
            </div>
          )}
          <div className="record-list">
            {project.soc2.controls.map((control) => (
              <article key={control.id}>
                <div>
                  <strong>
                    {control.id} — {control.title}
                  </strong>
                  <p>
                    {control.reportPages.length > 0
                      ? `Pages ${control.reportPages.join(", ")}`
                      : "Report pages need confirmation"}
                  </p>
                </div>
                <Button
                  variant="quiet"
                  onClick={() => {
                    update((draft) => {
                      draft.soc2.controls = draft.soc2.controls.filter(
                        (candidate) => candidate.id !== control.id,
                      );
                      draft.mappings = draft.mappings.filter(
                        (mapping) => mapping.soc2ControlId !== control.id,
                      );
                    });
                    if (controlId === control.id) setControlId("");
                  }}
                >
                  Remove control and its mappings
                </Button>
              </article>
            ))}
          </div>
        </details>
        <details open={project.soc2.exceptions.length === 0}>
          <summary>Record auditor exceptions</summary>
          <form className="form-grid" aria-label="Add an auditor exception" onSubmit={addException}>
            <Field label="Exception title">
              <input
                required
                value={exceptionTitle}
                onChange={(event) => setExceptionTitle(event.target.value)}
              />
            </Field>
            <Field label="Materiality">
              <select
                value={exceptionMateriality}
                onChange={(event) =>
                  setExceptionMateriality(event.target.value as typeof exceptionMateriality)
                }
              >
                <option value="not_sure">Not sure</option>
                <option value="minor">Minor</option>
                <option value="material">Material</option>
              </select>
            </Field>
            <Field label="Exception description">
              <textarea
                required
                rows={3}
                value={exceptionDescription}
                onChange={(event) => setExceptionDescription(event.target.value)}
              />
            </Field>
            <Field label="Exception report pages">
              <input
                value={exceptionPages}
                onChange={(event) => setExceptionPages(event.target.value)}
                inputMode="numeric"
                placeholder="67"
              />
            </Field>
            <div className="button-row form-grid__full">
              <Button type="submit">Add auditor exception</Button>
            </div>
          </form>
          <div className="record-list">
            {project.soc2.exceptions.map((exception) => (
              <article key={exception.id}>
                <div>
                  <strong>{exception.title}</strong>
                  <p>{exception.description}</p>
                  <StatusPill tone={exception.materiality === "material" ? "critical" : "warning"}>
                    {statusLabel(exception.materiality)} materiality
                  </StatusPill>
                </div>
                <Button
                  variant="quiet"
                  onClick={() =>
                    update((draft) => {
                      draft.soc2.exceptions = draft.soc2.exceptions.filter(
                        (candidate) => candidate.id !== exception.id,
                      );
                      for (const control of draft.soc2.controls)
                        control.exceptionIds = control.exceptionIds.filter(
                          (id) => id !== exception.id,
                        );
                    })
                  }
                >
                  Remove exception
                </Button>
              </article>
            ))}
          </div>
        </details>
      </Card>
      <Card title="SOC 2-to-Class A mappings">
        <form className="mapping-form" aria-label="Add a SOC 2 mapping" onSubmit={addMapping}>
          <Field label="SOC 2 control">
            <select value={controlId} onChange={(event) => setControlId(event.target.value)}>
              <option value="">Choose a control</option>
              {project.soc2.controls.map((control) => (
                <option key={control.id} value={control.id}>
                  {control.id} — {control.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Report page">
            <input
              type="number"
              min="1"
              value={page}
              onChange={(event) => setPage(event.target.value)}
            />
          </Field>
          <Field label="Class A rule">
            <select value={ruleId} onChange={(event) => setRuleId(event.target.value)}>
              {RULE_SELECTIONS.mandatory.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </Field>
          <Button type="submit" disabled={!controlId}>
            Add manual mapping
          </Button>
        </form>
        {project.soc2.controls.length === 0 && (
          <Callout
            title="Add controls manually or confirm extracted control identifiers"
            tone="warning"
          >
            <p>
              Control records need identifiers, report pages, auditor tests, results, and exceptions
              before they can be mapped.
            </p>
          </Callout>
        )}
        <div className="mapping-list">
          {project.mappings.map((mapping) => (
            <article
              key={mapping.id}
              aria-label={`${mapping.soc2ControlId} to ${mapping.classARuleId} mapping`}
            >
              <div className="mapping-list__header">
                <strong>
                  {mapping.soc2ControlId} → {mapping.classARuleId}
                </strong>
                <span>Page {mapping.reportPage}</span>
              </div>
              <div className="form-grid">
                <Field label="Coverage classification">
                  <select
                    aria-label={`Coverage for ${mapping.id}`}
                    value={mapping.coverage}
                    onChange={(event) =>
                      update((draft) => {
                        const item = draft.mappings.find(
                          (candidate) => candidate.id === mapping.id,
                        );
                        if (item) item.coverage = event.target.value as typeof item.coverage;
                      })
                    }
                  >
                    {[
                      "likely_covered",
                      "partially_covered",
                      "supporting_evidence_only",
                      "fedramp_specific_work_required",
                      "scope_mismatch",
                      "no_relevant_mapping",
                      "needs_human_review",
                    ].map((value) => (
                      <option value={value} key={value}>
                        {statusLabel(value)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Reason for the mapping">
                  <textarea
                    rows={3}
                    value={mapping.reason}
                    onChange={(event) =>
                      update((draft) => {
                        const item = draft.mappings.find(
                          (candidate) => candidate.id === mapping.id,
                        );
                        if (item) item.reason = event.target.value;
                      })
                    }
                  />
                </Field>
                <Field label="Relevant report excerpt">
                  <textarea
                    rows={3}
                    value={mapping.excerpt}
                    onChange={(event) =>
                      update((draft) => {
                        const item = draft.mappings.find(
                          (candidate) => candidate.id === mapping.id,
                        );
                        if (item) item.excerpt = event.target.value;
                      })
                    }
                  />
                </Field>
                <Field label="Gap description">
                  <textarea
                    rows={3}
                    value={mapping.gapDescription}
                    onChange={(event) =>
                      update((draft) => {
                        const item = draft.mappings.find(
                          (candidate) => candidate.id === mapping.id,
                        );
                        if (item) item.gapDescription = event.target.value;
                      })
                    }
                  />
                </Field>
                <Field label="Additional evidence needed">
                  <textarea
                    rows={3}
                    value={mapping.additionalEvidenceNeeded}
                    onChange={(event) =>
                      update((draft) => {
                        const item = draft.mappings.find(
                          (candidate) => candidate.id === mapping.id,
                        );
                        if (item) item.additionalEvidenceNeeded = event.target.value;
                      })
                    }
                  />
                </Field>
                <Field label="Reviewer">
                  <input
                    value={mapping.reviewer ?? ""}
                    onChange={(event) =>
                      update((draft) => {
                        const item = draft.mappings.find(
                          (candidate) => candidate.id === mapping.id,
                        );
                        if (item) item.reviewer = event.target.value || undefined;
                      })
                    }
                  />
                </Field>
                <Field label="Review date">
                  <input
                    type="date"
                    value={mapping.reviewDate ?? ""}
                    onChange={(event) =>
                      update((draft) => {
                        const item = draft.mappings.find(
                          (candidate) => candidate.id === mapping.id,
                        );
                        if (item) item.reviewDate = event.target.value || undefined;
                      })
                    }
                  />
                </Field>
              </div>
              <label>
                <input
                  type="checkbox"
                  checked={mapping.confirmed}
                  onChange={(event) =>
                    update((draft) => {
                      const item = draft.mappings.find((candidate) => candidate.id === mapping.id);
                      if (item) item.confirmed = event.target.checked;
                    })
                  }
                />{" "}
                Mapping confirmed by a person
              </label>
              <Button
                variant="quiet"
                onClick={() =>
                  update((draft) => {
                    draft.mappings = draft.mappings.filter(
                      (candidate) => candidate.id !== mapping.id,
                    );
                  })
                }
              >
                Remove mapping
              </Button>
            </article>
          ))}
        </div>
      </Card>
    </>
  );
}

function Requirements({
  project,
  update,
}: {
  readonly project: BridgeProject;
  readonly update: (recipe: (draft: BridgeProject) => void) => void;
}) {
  const [filter, setFilter] = useState("mandatory");
  const [search, setSearch] = useState("");
  const [approvalAttested, setApprovalAttested] = useState(false);
  const [selected, setSelected] = useState(
    project.requirements.find((item) =>
      (RULE_SELECTIONS.mandatory as readonly string[]).includes(item.ruleId),
    )?.ruleId ??
      project.requirements[0]?.ruleId ??
      "",
  );
  const requirement = project.requirements.find((item) => item.ruleId === selected);
  const official = getRule(selected);
  const guidance = RULE_GUIDANCE.find((item) => item.ruleId === selected);
  const ksi = KSI_WORKFLOWS.find((item) => item.ruleId === selected);
  const idsForFilter =
    filter === "all"
      ? undefined
      : new Set<string>(RULE_SELECTIONS[filter as keyof typeof RULE_SELECTIONS] ?? []);
  const visible = project.requirements.filter(
    (item) =>
      (!idsForFilter || idsForFilter.has(item.ruleId)) &&
      (!search ||
        `${item.ruleId} ${String(getRule(item.ruleId)?.official.name ?? "")}`
          .toLowerCase()
          .includes(search.toLowerCase())),
  );
  const change = (recipe: (item: BridgeProject["requirements"][number]) => void) =>
    update((draft) => {
      const item = draft.requirements.find((candidate) => candidate.ruleId === selected);
      if (item) recipe(item);
    });
  useEffect(() => setApprovalAttested(false), [selected]);
  const approvalLocked = requirement?.status === "approved_by_provider";
  const approvalReady = Boolean(
    requirement &&
    requirement.reviewStatus === "approved" &&
    requirement.userResponse.trim() &&
    requirement.implementationNarrative.trim() &&
    requirement.verificationNarrative.trim() &&
    requirement.validationNarrative.trim() &&
    requirement.providerApprovedBy?.trim() &&
    requirement.providerApprovedAt &&
    approvalAttested,
  );
  return (
    <>
      <PageHeading
        eyebrow="Versioned rule workspace"
        title="Class A requirements"
        description="Plain-language guidance first, official details on demand. Requirement status is always controlled by a person."
      />
      <div className="requirement-layout">
        <aside className="requirement-index">
          <input
            aria-label="Search requirements"
            type="search"
            placeholder="Search ID or title"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="filter-tabs" role="group" aria-label="Requirement filter">
            {[
              "mandatory",
              "recommended",
              "optional",
              "externalFramework",
              "marketplaceApplication",
              "all",
            ].map((value) => (
              <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>
                {statusLabel(value)}
              </button>
            ))}
          </div>
          <div className="rule-list">
            {visible.map((item) => (
              <button
                key={item.ruleId}
                className={
                  selected === item.ruleId
                    ? "rule-list__item rule-list__item--active"
                    : "rule-list__item"
                }
                onClick={() => setSelected(item.ruleId)}
              >
                <span>{item.ruleId}</span>
                <small>{String(getRule(item.ruleId)?.official.name ?? "Official rule")}</small>
                <StatusPill tone={toneFor(item.status)}>{statusLabel(item.status)}</StatusPill>
              </button>
            ))}
          </div>
        </aside>
        <section className="requirement-detail" aria-label="Requirement record">
          {!requirement || !official ? (
            <EmptyState title="Choose a requirement">
              <p>Select a rule to open its guided workspace.</p>
            </EmptyState>
          ) : (
            <>
              <div className="requirement-title">
                <div>
                  <p className="eyebrow">{official.selectionTags.map(statusLabel).join(" · ")}</p>
                  <h2>{requirement.ruleId}</h2>
                  <p className="lede-small">{String(official.official.name)}</p>
                </div>
                <StatusPill tone={toneFor(requirement.status)}>
                  {statusLabel(requirement.status)}
                </StatusPill>
              </div>
              <Callout title="What this means in practice">
                <p>{guidance?.plainLanguage}</p>
              </Callout>
              <div className="form-grid">
                <Field
                  label="Completion status"
                  hint="A mapping or attachment never changes this automatically."
                >
                  <select
                    disabled={approvalLocked}
                    value={requirement.status}
                    onChange={(event) =>
                      change((item) => {
                        item.status = event.target.value as typeof item.status;
                      })
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
                      "approved_by_provider",
                    ].map((value) => (
                      <option value={value} key={value} disabled={value === "approved_by_provider"}>
                        {value === "approved_by_provider"
                          ? "Approved by provider — use provider attestation below"
                          : statusLabel(value)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Review status">
                  <select
                    disabled={approvalLocked}
                    value={requirement.reviewStatus}
                    onChange={(event) =>
                      change((item) => {
                        item.reviewStatus = event.target.value as typeof item.reviewStatus;
                      })
                    }
                  >
                    {["unreviewed", "in_review", "changes_requested", "approved"].map((value) => (
                      <option value={value} key={value}>
                        {statusLabel(value)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Owner">
                  <input
                    value={requirement.owner}
                    onChange={(event) =>
                      change((item) => {
                        item.owner = event.target.value;
                      })
                    }
                  />
                </Field>
                <Field label="Due date">
                  <input
                    type="date"
                    value={requirement.dueDate ?? ""}
                    onChange={(event) =>
                      change((item) => {
                        item.dueDate = event.target.value;
                      })
                    }
                  />
                </Field>
              </div>
              {ksi && (
                <div className="ksi-flow">
                  <p className="eyebrow">Dedicated Key Security Indicator workflow</p>
                  <h3>{ksi.outcome}</h3>
                  <div className="three-column">
                    <div>
                      <strong>What compliance collects</strong>
                      <ListOrEmpty items={ksi.collectorPrompts} />
                    </div>
                    <div>
                      <strong>Technical team likely to help</strong>
                      <ListOrEmpty items={ksi.technicalHelpers} />
                    </div>
                    <div>
                      <strong>Common weaknesses</strong>
                      <ListOrEmpty items={ksi.weaknesses} />
                    </div>
                  </div>
                  <div className="three-column ksi-steps">
                    <div>
                      <strong>Implementation evidence to describe</strong>
                      <ListOrEmpty items={ksi.implementationSteps} />
                    </div>
                    <div>
                      <strong>How to verify</strong>
                      <ListOrEmpty items={ksi.verificationSteps} />
                    </div>
                    <div>
                      <strong>How to validate</strong>
                      <ListOrEmpty items={ksi.validationSteps} />
                    </div>
                  </div>
                  <details>
                    <summary>Common evidence candidates</summary>
                    <ListOrEmpty items={guidance?.evidenceExamples ?? []} />
                    <p className="small">Evidence remains a candidate until a person reviews it.</p>
                  </details>
                  <details>
                    <summary>Suggested narrative structure and remaining uncertainty</summary>
                    <p>{ksi.narrativeSections.join(" → ")}</p>
                    <ListOrEmpty items={ksi.uncertainties} />
                  </details>
                </div>
              )}
              <div className="narrative-stack">
                <Field label="Provider response">
                  <textarea
                    disabled={approvalLocked}
                    rows={4}
                    value={requirement.userResponse}
                    onChange={(event) =>
                      change((item) => {
                        item.userResponse = event.target.value;
                      })
                    }
                  />
                </Field>
                <Field label="Implementation explanation">
                  <textarea
                    disabled={approvalLocked}
                    rows={5}
                    value={requirement.implementationNarrative}
                    onChange={(event) =>
                      change((item) => {
                        item.implementationNarrative = event.target.value;
                      })
                    }
                  />
                </Field>
                <Field label="Verification explanation">
                  <textarea
                    disabled={approvalLocked}
                    rows={4}
                    value={requirement.verificationNarrative}
                    onChange={(event) =>
                      change((item) => {
                        item.verificationNarrative = event.target.value;
                      })
                    }
                  />
                </Field>
                <Field label="Validation explanation">
                  <textarea
                    disabled={approvalLocked}
                    rows={4}
                    value={requirement.validationNarrative}
                    onChange={(event) =>
                      change((item) => {
                        item.validationNarrative = event.target.value;
                      })
                    }
                  />
                </Field>
                {selected === "IVV-CSX-AIA" && (
                  <>
                    <Field label="Independent verification">
                      <textarea
                        rows={3}
                        value={requirement.independentVerification}
                        onChange={(event) =>
                          change((item) => {
                            item.independentVerification = event.target.value;
                          })
                        }
                      />
                    </Field>
                    <Field label="Independent validation">
                      <textarea
                        rows={3}
                        value={requirement.independentValidation}
                        onChange={(event) =>
                          change((item) => {
                            item.independentValidation = event.target.value;
                          })
                        }
                      />
                    </Field>
                  </>
                )}
              </div>
              <Card title="References, questions, and exceptions">
                <div className="form-grid">
                  <Field label="SOC 2 page references" hint="Separate page numbers with commas.">
                    <input
                      key={`${selected}-pages`}
                      defaultValue={requirement.soc2PageReferences.join(", ")}
                      onBlur={(event) =>
                        change((item) => {
                          item.soc2PageReferences = [
                            ...new Set(
                              event.target.value
                                .split(/[^0-9]+/u)
                                .map(Number)
                                .filter((page) => Number.isInteger(page) && page > 0),
                            ),
                          ];
                        })
                      }
                    />
                  </Field>
                  <Field label="Notes">
                    <textarea
                      rows={3}
                      value={requirement.notes}
                      onChange={(event) =>
                        change((item) => {
                          item.notes = event.target.value;
                        })
                      }
                    />
                  </Field>
                  <Field label="Open questions (one per line)">
                    <textarea
                      rows={3}
                      value={requirement.openQuestions.join("\n")}
                      onChange={(event) =>
                        change((item) => {
                          item.openQuestions = event.target.value.split(/\r?\n/u);
                        })
                      }
                      onBlur={(event) =>
                        change((item) => {
                          item.openQuestions = event.target.value
                            .split(/\r?\n/u)
                            .map((value) => value.trim())
                            .filter(Boolean);
                        })
                      }
                    />
                  </Field>
                  <Field label="Exceptions (one per line)">
                    <textarea
                      rows={3}
                      value={requirement.exceptions.join("\n")}
                      onChange={(event) =>
                        change((item) => {
                          item.exceptions = event.target.value.split(/\r?\n/u);
                        })
                      }
                      onBlur={(event) =>
                        change((item) => {
                          item.exceptions = event.target.value
                            .split(/\r?\n/u)
                            .map((value) => value.trim())
                            .filter(Boolean);
                        })
                      }
                    />
                  </Field>
                  <Field label="Senior-official acceptance (when applicable)">
                    <textarea
                      rows={3}
                      value={requirement.seniorOfficialAcceptance ?? ""}
                      onChange={(event) =>
                        change((item) => {
                          item.seniorOfficialAcceptance = event.target.value || undefined;
                        })
                      }
                    />
                  </Field>
                </div>
                <fieldset className="checkbox-grid">
                  <legend>Related SOC 2 controls</legend>
                  {project.soc2.controls.map((control) => (
                    <label key={control.id}>
                      <input
                        type="checkbox"
                        checked={requirement.soc2ControlIds.includes(control.id)}
                        onChange={(event) =>
                          change((item) => {
                            item.soc2ControlIds = event.target.checked
                              ? [...new Set([...item.soc2ControlIds, control.id])]
                              : item.soc2ControlIds.filter((id) => id !== control.id);
                          })
                        }
                      />
                      {control.id} — {control.title}
                    </label>
                  ))}
                </fieldset>
              </Card>
              <Card title="Linked evidence candidates">
                <div className="checkbox-grid">
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
                      {evidence.title} <small>({statusLabel(evidence.reviewStatus)})</small>
                    </label>
                  ))}
                </div>
                {project.evidence.length === 0 && (
                  <p>No evidence candidates have been added yet.</p>
                )}
              </Card>
              <Card title="Provider approval" eyebrow="Explicit attestation required">
                <p>
                  Provider approval is an internal representation by your company. It does not
                  indicate FedRAMP approval, acceptance, or certification.
                </p>
                <div className="form-grid">
                  <Field label="Provider approver">
                    <input
                      disabled={approvalLocked}
                      value={requirement.providerApprovedBy ?? ""}
                      onChange={(event) =>
                        change((item) => {
                          item.providerApprovedBy = event.target.value || undefined;
                        })
                      }
                    />
                  </Field>
                  <Field label="Provider approval date and time">
                    <input
                      disabled={approvalLocked}
                      type="datetime-local"
                      value={requirement.providerApprovedAt?.slice(0, 16) ?? ""}
                      onChange={(event) =>
                        change((item) => {
                          item.providerApprovedAt = event.target.value
                            ? new Date(event.target.value).toISOString()
                            : undefined;
                        })
                      }
                    />
                  </Field>
                </div>
                {approvalLocked ? (
                  <div className="button-row">
                    <StatusPill tone="positive">Approved by provider</StatusPill>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        change((item) => {
                          item.status = "complete_for_internal_review";
                          item.providerApprovedBy = undefined;
                          item.providerApprovedAt = undefined;
                        });
                        setApprovalAttested(false);
                      }}
                    >
                      Reopen and remove provider approval
                    </Button>
                  </div>
                ) : (
                  <>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={approvalAttested}
                        onChange={(event) => setApprovalAttested(event.target.checked)}
                      />
                      I attest that the named provider approver reviewed the response,
                      implementation, verification, validation, evidence references, and open
                      exceptions recorded here.
                    </label>
                    <Button
                      onClick={() =>
                        change((item) => {
                          item.status = "approved_by_provider";
                        })
                      }
                      disabled={!approvalReady}
                    >
                      Record provider approval
                    </Button>
                    {!approvalReady && (
                      <p className="small">
                        Complete all four narratives, set review status to Approved, name the
                        provider approver, add the approval date, and confirm the attestation.
                      </p>
                    )}
                  </>
                )}
              </Card>
              <details className="official-details">
                <summary>View official details</summary>
                <p>
                  <strong>Source version:</strong> {official.source.catalogVersion} ·{" "}
                  <strong>Last verified:</strong> {official.source.verifiedAt}
                </p>
                <p>
                  <a href={official.source.sourceUrl} target="_blank" rel="noopener noreferrer">
                    Open the pinned official source
                  </a>
                </p>
                {official.needsFedrampConfirmation && (
                  <Callout title="Needs FedRAMP confirmation" tone="warning">
                    <p>
                      The current official catalog contains an applicability reference that changed
                      in the July update. Class A Bridge preserves it without silently
                      reinterpreting it.
                    </p>
                  </Callout>
                )}
                <pre>{JSON.stringify(official.official, null, 2)}</pre>
                <p>{guidance?.disclaimer}</p>
              </details>
            </>
          )}
        </section>
      </div>
    </>
  );
}

function Evidence({
  project,
  update,
  store,
}: {
  readonly project: BridgeProject;
  readonly update: (recipe: (draft: BridgeProject) => void) => void;
  readonly store: ProjectStore;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [evidenceKind, setEvidenceKind] =
    useState<BridgeProject["evidence"][number]["kind"]>("external_reference");
  const [sourceSystem, setSourceSystem] = useState("");
  const [owner, setOwner] = useState("");
  const [collectedAt, setCollectedAt] = useState(new Date().toISOString().slice(0, 10));
  const [relevantPeriod, setRelevantPeriod] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [sensitivity, setSensitivity] =
    useState<BridgeProject["evidence"][number]["sensitivity"]>("confidential");
  const [notes, setNotes] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [relatedRequirementIds, setRelatedRequirementIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [relatedSoc2ControlIds, setRelatedSoc2ControlIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [file, setFile] = useState<File>();
  const [error, setError] = useState("");
  const [removingEvidenceId, setRemovingEvidenceId] = useState("");
  const add = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    setError("");
    try {
      let attachmentId: string | undefined;
      let attachmentBytes: Uint8Array | undefined;
      let kind = evidenceKind;
      let validatedExternalUrl: string | undefined;
      if (externalUrl.trim()) {
        const url = new URL(externalUrl.trim());
        if (!/^https?:$/u.test(url.protocol))
          throw new Error("External evidence references must use an HTTPS or HTTP URL.");
        validatedExternalUrl = url.toString();
      }
      let hash = await sha256Hex(
        new TextEncoder().encode(validatedExternalUrl ?? `${title.trim()}|${sourceSystem.trim()}`),
      );
      if (file) {
        if (file.size > 25 * 1024 * 1024)
          throw new Error("Evidence files must be 25 MB or smaller.");
        const bytes = new Uint8Array(await file.arrayBuffer());
        hash = await sha256Hex(bytes);
        attachmentId = `evidence-${crypto.randomUUID()}`;
        attachmentBytes = bytes;
        if (evidenceKind === "external_reference")
          kind = file.type.startsWith("image/")
            ? "screenshot"
            : file.name.toLowerCase().endsWith(".csv")
              ? "csv"
              : "file";
      }
      const evidenceRecord: BridgeProject["evidence"][number] = {
        id: `evidence-${crypto.randomUUID()}`,
        title: title.trim(),
        description:
          description.trim() ||
          (file
            ? `Local file: ${safeFilename(file.name)}`
            : "Manually recorded evidence reference."),
        kind,
        ...(sourceSystem.trim() ? { sourceSystem: sourceSystem.trim() } : {}),
        owner: owner.trim() || "Unassigned",
        collectedAt,
        ...(relevantPeriod.trim() ? { relevantPeriod: relevantPeriod.trim() } : {}),
        ...(reviewDate ? { reviewDate } : {}),
        relatedRequirementIds: [...relatedRequirementIds],
        relatedSoc2ControlIds: [...relatedSoc2ControlIds],
        sha256: hash,
        sensitivity,
        notes: notes.trim() || "Evidence candidate; sufficiency has not been determined.",
        reviewStatus: "candidate",
        ...(attachmentId ? { attachmentId } : {}),
        ...(validatedExternalUrl ? { externalUrl: validatedExternalUrl } : {}),
      };
      if (attachmentId && attachmentBytes) {
        const nextProject = cloneProject(project);
        nextProject.evidence.push(evidenceRecord);
        nextProject.metadata.updatedAt = new Date().toISOString();
        nextProject.actions = deriveActions(nextProject);
        await persistProjectWithAttachmentAtomically(store, nextProject, {
          id: attachmentId,
          bytes: attachmentBytes,
        });
      }
      update((draft) => draft.evidence.push(evidenceRecord));
      setTitle("");
      setDescription("");
      setEvidenceKind("external_reference");
      setSourceSystem("");
      setOwner("");
      setCollectedAt(new Date().toISOString().slice(0, 10));
      setRelevantPeriod("");
      setReviewDate("");
      setSensitivity("confidential");
      setNotes("");
      setExternalUrl("");
      setRelatedRequirementIds(new Set());
      setRelatedSoc2ControlIds(new Set());
      setFile(undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Evidence could not be stored locally.");
    }
  };
  const remove = async (item: BridgeProject["evidence"][number]) => {
    setError("");
    setRemovingEvidenceId(item.id);
    try {
      await removeEvidenceCandidateLocally(store, project, item.id);
      update((draft) => {
        draft.evidence = draft.evidence.filter((candidate) => candidate.id !== item.id);
        for (const requirement of draft.requirements) {
          requirement.evidenceIds = requirement.evidenceIds.filter(
            (evidenceId) => evidenceId !== item.id,
          );
        }
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The evidence candidate and its local attachment could not be removed safely.",
      );
    } finally {
      setRemovingEvidenceId("");
    }
  };
  const changeEvidence = (
    evidenceId: string,
    recipe: (item: BridgeProject["evidence"][number]) => void,
  ) =>
    update((draft) => {
      const item = draft.evidence.find((candidate) => candidate.id === evidenceId);
      if (item) recipe(item);
    });
  return (
    <>
      <PageHeading
        eyebrow="Local evidence library"
        title="Collect candidates without claiming sufficiency"
        description="Files stay in this browser. Hashes help identify the selected bytes; a human reviewer still decides relevance and sufficiency."
      />
      <div className="two-column two-column--sidebar">
        <Card title="Add an evidence candidate">
          <form
            onSubmit={(event) => void add(event)}
            className="form-stack"
            aria-label="Add an evidence candidate"
          >
            <Field label="Title">
              <input value={title} onChange={(event) => setTitle(event.target.value)} required />
            </Field>
            <Field label="Description">
              <textarea
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
            <Field label="Evidence type">
              <select
                value={evidenceKind}
                onChange={(event) => setEvidenceKind(event.target.value as typeof evidenceKind)}
              >
                {[
                  "external_reference",
                  "file",
                  "screenshot",
                  "report",
                  "policy",
                  "ticket",
                  "csv",
                  "url",
                ].map((value) => (
                  <option key={value} value={value}>
                    {statusLabel(value)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Source system">
              <input
                value={sourceSystem}
                onChange={(event) => setSourceSystem(event.target.value)}
                placeholder="Trust center, ticketing system, or repository"
              />
            </Field>
            <Field label="Owner">
              <input value={owner} onChange={(event) => setOwner(event.target.value)} />
            </Field>
            <Field label="Collection date">
              <input
                required
                type="date"
                value={collectedAt}
                onChange={(event) => setCollectedAt(event.target.value)}
              />
            </Field>
            <Field label="Relevant period">
              <input
                value={relevantPeriod}
                onChange={(event) => setRelevantPeriod(event.target.value)}
                placeholder="2026 Q2 or July 1–September 30"
              />
            </Field>
            <Field label="Review or expiration date">
              <input
                type="date"
                value={reviewDate}
                onChange={(event) => setReviewDate(event.target.value)}
              />
            </Field>
            <Field label="Sensitivity">
              <select
                value={sensitivity}
                onChange={(event) => setSensitivity(event.target.value as typeof sensitivity)}
              >
                {["public", "internal", "confidential", "restricted"].map((value) => (
                  <option key={value} value={value}>
                    {statusLabel(value)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="External URL (optional)">
              <input
                type="url"
                value={externalUrl}
                onChange={(event) => setExternalUrl(event.target.value)}
                placeholder="https://"
              />
            </Field>
            <Field label="Notes">
              <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
            </Field>
            <Field
              label="Local file (optional)"
              hint={
                store.supportsAttachments
                  ? "Files are stored in browser storage and omitted from exports by default."
                  : "This browser fallback cannot persist binary attachments; metadata can still be saved."
              }
            >
              <input
                type="file"
                disabled={!store.supportsAttachments}
                onChange={(event) => setFile(event.target.files?.[0])}
              />
            </Field>
            <details>
              <summary>Relate to Class A requirements</summary>
              <fieldset className="checkbox-grid evidence-relations">
                <legend className="visually-hidden">Related Class A requirements</legend>
                {project.requirements.map((requirement) => (
                  <label key={requirement.ruleId}>
                    <input
                      type="checkbox"
                      aria-label={`Relate to ${requirement.ruleId}`}
                      checked={relatedRequirementIds.has(requirement.ruleId)}
                      onChange={(event) =>
                        setRelatedRequirementIds((current) => {
                          const next = new Set(current);
                          if (event.target.checked) next.add(requirement.ruleId);
                          else next.delete(requirement.ruleId);
                          return next;
                        })
                      }
                    />
                    {requirement.ruleId}
                  </label>
                ))}
              </fieldset>
            </details>
            <details>
              <summary>Relate to SOC 2 controls</summary>
              <fieldset className="checkbox-grid evidence-relations">
                <legend className="visually-hidden">Related SOC 2 controls</legend>
                {project.soc2.controls.map((control) => (
                  <label key={control.id}>
                    <input
                      type="checkbox"
                      aria-label={`Relate to ${control.id}`}
                      checked={relatedSoc2ControlIds.has(control.id)}
                      onChange={(event) =>
                        setRelatedSoc2ControlIds((current) => {
                          const next = new Set(current);
                          if (event.target.checked) next.add(control.id);
                          else next.delete(control.id);
                          return next;
                        })
                      }
                    />
                    {control.id} — {control.title}
                  </label>
                ))}
              </fieldset>
            </details>
            {error && (
              <p className="field__error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit">Add evidence candidate</Button>
          </form>
        </Card>
        <Card
          title="Evidence candidates"
          actions={<StatusPill tone="info">{project.evidence.length} items</StatusPill>}
        >
          {project.evidence.length === 0 ? (
            <EmptyState title="No evidence candidates yet">
              <p>
                Add policies, screenshots, tickets, exported reports, CSVs, URLs, or external
                references. Files are never uploaded by the standard workflow.
              </p>
            </EmptyState>
          ) : (
            <div className="evidence-list">
              {project.evidence.map((item) => (
                <article key={item.id} aria-label={`Evidence candidate ${item.title}`}>
                  <div className="evidence-list__heading">
                    <div>
                      <span className="resource-kind">{statusLabel(item.kind)}</span>
                      <h3>{item.title}</h3>
                    </div>
                    <StatusPill tone={toneFor(evidenceFreshness(item.reviewDate))}>
                      {statusLabel(evidenceFreshness(item.reviewDate))}
                    </StatusPill>
                  </div>
                  <p>{item.description}</p>
                  <dl>
                    <div>
                      <dt>Owner</dt>
                      <dd>{item.owner}</dd>
                    </div>
                    <div>
                      <dt>Collected</dt>
                      <dd>{item.collectedAt}</dd>
                    </div>
                    <div>
                      <dt>Source</dt>
                      <dd>{item.sourceSystem ?? "Not recorded"}</dd>
                    </div>
                    <div>
                      <dt>Relevant period</dt>
                      <dd>{item.relevantPeriod ?? "Needs confirmation"}</dd>
                    </div>
                    <div>
                      <dt>Review date</dt>
                      <dd>{item.reviewDate ?? "Not scheduled"}</dd>
                    </div>
                    <div>
                      <dt>SHA-256</dt>
                      <dd>
                        <code>{item.sha256.slice(0, 16)}…</code>
                      </dd>
                    </div>
                    <div>
                      <dt>Sensitivity</dt>
                      <dd>{statusLabel(item.sensitivity)}</dd>
                    </div>
                  </dl>
                  <details className="evidence-editor">
                    <summary aria-label={`Edit evidence metadata for ${item.title}`}>
                      Edit evidence metadata
                    </summary>
                    <div className="form-grid">
                      <Field label="Title">
                        <input
                          disabled={!item.attachmentId}
                          value={item.title}
                          onChange={(event) =>
                            changeEvidence(item.id, (evidence) => {
                              evidence.title = event.target.value;
                            })
                          }
                        />
                      </Field>
                      <Field label="Description">
                        <textarea
                          rows={3}
                          value={item.description}
                          onChange={(event) =>
                            changeEvidence(item.id, (evidence) => {
                              evidence.description = event.target.value;
                            })
                          }
                        />
                      </Field>
                      <Field label="Evidence type">
                        <select
                          value={item.kind}
                          onChange={(event) =>
                            changeEvidence(item.id, (evidence) => {
                              evidence.kind = event.target.value as typeof evidence.kind;
                            })
                          }
                        >
                          {[
                            "external_reference",
                            "file",
                            "screenshot",
                            "report",
                            "policy",
                            "ticket",
                            "csv",
                            "url",
                          ].map((value) => (
                            <option key={value} value={value}>
                              {statusLabel(value)}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Source system">
                        <input
                          disabled={!item.attachmentId}
                          value={item.sourceSystem ?? ""}
                          onChange={(event) =>
                            changeEvidence(item.id, (evidence) => {
                              evidence.sourceSystem = event.target.value || undefined;
                            })
                          }
                        />
                      </Field>
                      <Field label="Owner">
                        <input
                          value={item.owner}
                          onChange={(event) =>
                            changeEvidence(item.id, (evidence) => {
                              evidence.owner = event.target.value;
                            })
                          }
                        />
                      </Field>
                      <Field label="Collection date">
                        <input
                          type="date"
                          value={item.collectedAt}
                          onChange={(event) =>
                            changeEvidence(item.id, (evidence) => {
                              evidence.collectedAt = event.target.value;
                            })
                          }
                        />
                      </Field>
                      <Field label="Relevant period">
                        <input
                          value={item.relevantPeriod ?? ""}
                          onChange={(event) =>
                            changeEvidence(item.id, (evidence) => {
                              evidence.relevantPeriod = event.target.value || undefined;
                            })
                          }
                        />
                      </Field>
                      <Field label="Review or expiration date">
                        <input
                          type="date"
                          value={item.reviewDate ?? ""}
                          onChange={(event) =>
                            changeEvidence(item.id, (evidence) => {
                              evidence.reviewDate = event.target.value || undefined;
                            })
                          }
                        />
                      </Field>
                      <Field label="Sensitivity">
                        <select
                          value={item.sensitivity}
                          onChange={(event) =>
                            changeEvidence(item.id, (evidence) => {
                              evidence.sensitivity = event.target
                                .value as typeof evidence.sensitivity;
                            })
                          }
                        >
                          {["public", "internal", "confidential", "restricted"].map((value) => (
                            <option key={value} value={value}>
                              {statusLabel(value)}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="External URL (optional)">
                        <input
                          disabled={!item.attachmentId}
                          type="url"
                          value={item.externalUrl ?? ""}
                          onChange={(event) =>
                            changeEvidence(item.id, (evidence) => {
                              evidence.externalUrl = event.target.value || undefined;
                            })
                          }
                        />
                      </Field>
                      {!item.attachmentId && (
                        <p className="small form-grid__full">
                          Title, source system, and URL identify this external reference and remain
                          locked so its SHA-256 stays reproducible. Remove and add a new candidate
                          to change that identity.
                        </p>
                      )}
                      <Field label="Notes">
                        <textarea
                          rows={3}
                          value={item.notes}
                          onChange={(event) =>
                            changeEvidence(item.id, (evidence) => {
                              evidence.notes = event.target.value;
                            })
                          }
                        />
                      </Field>
                    </div>
                    <details>
                      <summary>Related Class A requirements</summary>
                      <fieldset className="checkbox-grid evidence-relations">
                        <legend className="visually-hidden">Related Class A requirements</legend>
                        {project.requirements.map((requirement) => (
                          <label key={requirement.ruleId}>
                            <input
                              type="checkbox"
                              checked={item.relatedRequirementIds.includes(requirement.ruleId)}
                              onChange={(event) =>
                                changeEvidence(item.id, (evidence) => {
                                  evidence.relatedRequirementIds = event.target.checked
                                    ? [
                                        ...new Set([
                                          ...evidence.relatedRequirementIds,
                                          requirement.ruleId,
                                        ]),
                                      ]
                                    : evidence.relatedRequirementIds.filter(
                                        (id) => id !== requirement.ruleId,
                                      );
                                })
                              }
                            />
                            {requirement.ruleId}
                          </label>
                        ))}
                      </fieldset>
                    </details>
                    <details>
                      <summary>Related SOC 2 controls</summary>
                      <fieldset className="checkbox-grid evidence-relations">
                        <legend className="visually-hidden">Related SOC 2 controls</legend>
                        {project.soc2.controls.map((control) => (
                          <label key={control.id}>
                            <input
                              type="checkbox"
                              checked={item.relatedSoc2ControlIds.includes(control.id)}
                              onChange={(event) =>
                                changeEvidence(item.id, (evidence) => {
                                  evidence.relatedSoc2ControlIds = event.target.checked
                                    ? [...new Set([...evidence.relatedSoc2ControlIds, control.id])]
                                    : evidence.relatedSoc2ControlIds.filter(
                                        (id) => id !== control.id,
                                      );
                                })
                              }
                            />
                            {control.id} — {control.title}
                          </label>
                        ))}
                      </fieldset>
                    </details>
                  </details>
                  <div className="button-row">
                    <select
                      aria-label={`Review status for ${item.title}`}
                      value={item.reviewStatus}
                      onChange={(event) =>
                        update((draft) => {
                          const evidence = draft.evidence.find(
                            (candidate) => candidate.id === item.id,
                          );
                          if (evidence)
                            evidence.reviewStatus = event.target
                              .value as typeof evidence.reviewStatus;
                        })
                      }
                    >
                      <option value="candidate">Evidence candidate</option>
                      <option value="needs_review">Needs review</option>
                      <option value="reviewed">Reviewed</option>
                      <option value="rejected">Rejected</option>
                    </select>
                    <Button
                      variant="quiet"
                      disabled={removingEvidenceId === item.id}
                      onClick={() => void remove(item)}
                    >
                      {removingEvidenceId === item.id ? "Removing…" : "Remove"}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function ActionPlan({
  project,
  update,
  navigate,
}: {
  readonly project: BridgeProject;
  readonly update: (recipe: (draft: BridgeProject) => void) => void;
  readonly navigate: (route: Route) => void;
}) {
  const [category, setCategory] = useState("all");
  const visible = project.actions.filter(
    (item) => category === "all" || item.category === category,
  );
  return (
    <>
      <PageHeading
        eyebrow="Prioritized preparation plan"
        title="Turn every finding into an owned next action"
        description="Actions are grouped by consequence, not rolled into a readiness percentage."
        action={
          <Button
            onClick={() =>
              update((draft) => {
                draft.actions = deriveActions(draft);
              })
            }
          >
            Regenerate plan
          </Button>
        }
      />
      <div className="toolbar">
        <label>
          Filter category{" "}
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">All categories</option>
            {[...new Set(project.actions.map((item) => item.category))].map((value) => (
              <option key={value} value={value}>
                {statusLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="secondary"
          onClick={() => {
            const csv = generateCsv(project, "action-plan");
            downloadBytes(csv.bytes, csv.fileName, csv.mimeType);
          }}
        >
          Export CSV
        </Button>
        <Button
          variant="quiet"
          onClick={() => {
            const report = generateHumanReport(project, "action-plan");
            downloadText(report.html, report.fileName, report.mimeType);
          }}
        >
          Printable report
        </Button>
      </div>
      <div className="action-board">
        {visible.map((item) => (
          <article key={item.id}>
            <div className="action-board__meta">
              <StatusPill tone={toneFor(item.priority)}>{item.priority}</StatusPill>
              <span>{statusLabel(item.category)}</span>
            </div>
            <h2>{item.title}</h2>
            <p>{item.description}</p>
            <div className="form-grid">
              <Field label="Owner">
                <input
                  value={item.owner}
                  onChange={(event) =>
                    update((draft) => {
                      const action = draft.actions.find((candidate) => candidate.id === item.id);
                      if (action) action.owner = event.target.value;
                    })
                  }
                />
              </Field>
              <Field label="Due date">
                <input
                  type="date"
                  value={item.dueDate ?? ""}
                  onChange={(event) =>
                    update((draft) => {
                      const action = draft.actions.find((candidate) => candidate.id === item.id);
                      if (action) action.dueDate = event.target.value;
                    })
                  }
                />
              </Field>
              <Field label="Status">
                <select
                  value={item.status}
                  onChange={(event) =>
                    update((draft) => {
                      const action = draft.actions.find((candidate) => candidate.id === item.id);
                      if (action) action.status = event.target.value as typeof action.status;
                    })
                  }
                >
                  {["open", "in_progress", "blocked", "done"].map((value) => (
                    <option key={value} value={value}>
                      {statusLabel(value)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Button variant="secondary" onClick={() => navigate(routeFrom(item.nextRoute))}>
              Open next step
            </Button>
          </article>
        ))}
      </div>
      {visible.length === 0 && (
        <EmptyState title="No actions in this view">
          <p>Change the filter or regenerate the plan from the current project record.</p>
        </EmptyState>
      )}
    </>
  );
}

function Package({
  project,
  update,
  store,
  navigate,
  persistGeneratedProject,
}: {
  readonly project: BridgeProject;
  readonly update: (recipe: (draft: BridgeProject) => void, updatedAt?: string) => void;
  readonly store: ProjectStore;
  readonly navigate: (route: Route) => void;
  readonly persistGeneratedProject: (
    project: BridgeProject,
    output: { readonly id: string; readonly bytes: Uint8Array },
  ) => Promise<boolean>;
}) {
  const [packageResult, setPackageResult] =
    useState<Awaited<ReturnType<typeof generatePreparationPackage>>>();
  const [packageResultProjectUpdatedAt, setPackageResultProjectUpdatedAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retentionNotice, setRetentionNotice] = useState("");
  const [approver, setApprover] = useState(project.organization.accountableExecutive ?? "");
  const [version, setVersion] = useState("1.0");
  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const attachmentReferences = referencedLocalAttachments(project);
  const packageResultIsStale =
    Boolean(packageResult) && packageResultProjectUpdatedAt !== project.metadata.updatedAt;
  const cpo = project.packageInputs.certificationPackageOverview;
  const sdr = project.packageInputs.securityDecisionRecord;
  const ocr = project.packageInputs.ongoingCertificationReport;
  const openValidationTarget = (documentName: string, pointer: string) => {
    const target = validationEditTarget(documentName, pointer);
    navigate(target.route);
    globalThis.setTimeout(() => {
      if (!target.id) return;
      const element = document.getElementById(target.id);
      const disclosure = element?.closest("details");
      if (disclosure) disclosure.open = true;
      element?.focus();
      element?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    }, 0);
  };
  const selectedPackageAttachments = async () =>
    (await collectBundleAttachments(project, store, selectedAttachmentIds)).map((attachment) => ({
      attachmentId: attachment.id,
      fileName: attachment.fileName,
      bytes: attachment.bytes,
      userApproved: true as const,
    }));
  const generate = async () => {
    setBusy(true);
    setError("");
    setRetentionNotice("");
    try {
      const selectedAttachments = await selectedPackageAttachments();
      const result = await generatePreparationPackage(project, {
        packageVersion: version,
        officialDocuments: officialDocumentOptions(project),
        selectedAttachments,
      });
      const generatedAt = new Date().toISOString();
      const next = cloneProject(project);
      const output = addGeneratedPackage(next, result, version, generatedAt);
      next.metadata.updatedAt = generatedAt;
      next.actions = deriveActions(next);
      const retained = await persistGeneratedProject(next, {
        id: output.id,
        bytes: result.bytes,
      });
      setPackageResult(result);
      setPackageResultProjectUpdatedAt(generatedAt);
      downloadBytes(result.bytes, result.fileName, result.mimeType);
      setRetentionNotice(
        retained
          ? "The exact generated ZIP was downloaded and retained in this browser with its SHA-256 hash."
          : "The ZIP was downloaded. This browser storage fallback retained its metadata and hash, but cannot retain binary package bytes.",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Package generation failed locally.");
    } finally {
      setBusy(false);
    }
  };
  const finalize = async () => {
    if (!approver.trim()) {
      setError("Record the provider approver before creating a final-review snapshot.");
      return;
    }
    setBusy(true);
    setError("");
    setRetentionNotice("");
    try {
      // Finalization always regenerates from the current project. A prior on-screen validation
      // result may predate edits made after the user downloaded the last package.
      const selectedAttachments = await selectedPackageAttachments();
      const result = await generatePreparationPackage(project, {
        packageVersion: version,
        officialDocuments: officialDocumentOptions(project),
        selectedAttachments,
      });
      const projectHash = await sha256Hex(
        new TextEncoder().encode(JSON.stringify(BridgeProjectSchema.parse(project))),
      );
      const unresolved = [
        ...project.requirements
          .filter(
            (item) =>
              (RULE_SELECTIONS.mandatory as readonly string[]).includes(item.ruleId) &&
              !["complete_for_internal_review", "approved_by_provider"].includes(item.status),
          )
          .map((item) => `${item.ruleId}: ${statusLabel(item.status)}`),
        ...result.validation.documents.flatMap((document) =>
          document.issues.map((issue) => `${document.name}: ${issue.pointer}`),
        ),
      ];
      const finalizedAt = new Date().toISOString();
      const next = cloneProject(project);
      const output = addGeneratedPackage(next, result, version, finalizedAt);
      next.snapshots.push({
        id: `snapshot-${crypto.randomUUID()}`,
        version,
        createdAt: finalizedAt,
        providerApprover: approver.trim(),
        verificationDate: finalizedAt.slice(0, 10),
        validationDate: finalizedAt.slice(0, 10),
        projectHash,
        packageHash: result.sha256,
        freshnessStatus: soc2PackageFreshness(next, new Date(finalizedAt)),
        unresolvedItems: unresolved,
        immutable: true,
      });
      next.approvals.push({
        id: `approval-${crypto.randomUUID()}`,
        kind: "final_internal_review",
        title: `Package snapshot ${version} prepared for final internal review`,
        approver: approver.trim(),
        role: "Provider approver",
        acceptedAt: finalizedAt,
        scope: "Internal package snapshot; provider must review and submit its own application.",
        notes: "This record does not represent FedRAMP approval or acceptance.",
      });
      next.metadata.updatedAt = finalizedAt;
      next.actions = deriveActions(next);
      const retained = await persistGeneratedProject(next, {
        id: output.id,
        bytes: result.bytes,
      });
      setPackageResult(result);
      setPackageResultProjectUpdatedAt(finalizedAt);
      downloadBytes(result.bytes, result.fileName, result.mimeType);
      setRetentionNotice(
        retained
          ? "The exact frozen ZIP was downloaded and retained locally. Its hash is bound to this immutable snapshot record."
          : "The frozen ZIP was downloaded, but this browser storage fallback retained only snapshot metadata and hashes. Archive the downloaded ZIP with your review record.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Final-review snapshot could not be created.",
      );
    } finally {
      setBusy(false);
    }
  };
  const downloadFrozenPackage = async (snapshot: BridgeProject["snapshots"][number]) => {
    setError("");
    const output = project.generatedOutputs.find(
      (candidate) => candidate.format === "zip" && candidate.sha256 === snapshot.packageHash,
    );
    if (!output) {
      setError("This snapshot is missing its generated-package record. Restore a complete backup.");
      return;
    }
    try {
      const [generated] = await collectBundleGeneratedOutputs(project, store, new Set([output.id]));
      if (!generated) throw new Error("The frozen package bytes are not retained in this browser.");
      downloadBytes(generated.bytes, generated.fileName, "application/zip");
      setRetentionNotice(`Frozen package version ${snapshot.version} passed its hash check.`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The frozen package could not be read from local storage.",
      );
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="Package generation"
        title="Generate, validate, and freeze an internal-review scaffold"
        description="Sensitive evidence and the original SOC 2 report are excluded unless you explicitly select them. Class A Bridge does not submit an application."
        action={
          <Button onClick={() => void generate()} disabled={busy}>
            {busy ? "Generating locally…" : "Generate package ZIP"}
          </Button>
        }
      />
      {error && (
        <div className="error-summary" role="alert">
          <strong>Package action needs attention</strong>
          <p>{error}</p>
        </div>
      )}
      {retentionNotice && (
        <div className="callout callout--info" role="status" aria-label="Package retention status">
          <strong>Package record updated</strong>
          <p>{retentionNotice}</p>
        </div>
      )}
      <Card title="Optional package attachments" eyebrow="Explicit consent required">
        <p>
          The package excludes the original SOC 2 report and evidence files by default. Select only
          attachments your provider approver intends to place in this generated ZIP. The exact ZIP
          is retained locally when browser storage supports it and is selected by default in a
          complete project backup; you can deselect that generated output in Project settings.
        </p>
        {attachmentReferences.length === 0 ? (
          <p className="empty-copy">
            No locally stored attachments are referenced by this project.
          </p>
        ) : (
          <fieldset className="attachment-selector">
            <legend>Attachments approved for this package export</legend>
            {attachmentReferences.map((reference) => (
              <label className="checkbox-row" key={reference.id}>
                <input
                  type="checkbox"
                  disabled={!store.supportsAttachments}
                  checked={selectedAttachmentIds.has(reference.id)}
                  onChange={(event) => {
                    setSelectedAttachmentIds((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(reference.id);
                      else next.delete(reference.id);
                      return next;
                    });
                    setPackageResult(undefined);
                    setPackageResultProjectUpdatedAt("");
                  }}
                />
                <span>
                  <strong>{reference.label}</strong>
                  <small>{statusLabel(reference.sensitivity)} · excluded until selected</small>
                </span>
              </label>
            ))}
          </fieldset>
        )}
      </Card>
      <Card title="Official JSON document inputs" eyebrow="Progressive disclosure">
        <p>
          These fields feed the pinned Certification Package Overview, Security Decision Record, and
          Ongoing Certification Report schemas. Missing values appear as linked validation issues;
          structural validity still requires provider review.
        </p>
        <details>
          <summary>Certification Package Overview fields</summary>
          <div className="form-grid">
            <Field label="FedRAMP package identifier">
              <input
                id="package-cpo-id"
                value={cpo.fedRampPackageId}
                onChange={(event) =>
                  update((draft) => {
                    draft.packageInputs.certificationPackageOverview.fedRampPackageId =
                      event.target.value;
                  })
                }
              />
            </Field>
            <Field label="Unique Entity Identifier (UEI)">
              <input
                id="package-cpo-uei"
                value={cpo.ueiNumber}
                onChange={(event) =>
                  update((draft) => {
                    draft.packageInputs.certificationPackageOverview.ueiNumber = event.target.value;
                  })
                }
              />
            </Field>
            <Field label="Offering website">
              <input
                id="package-cpo-website"
                type="url"
                value={cpo.website}
                onChange={(event) =>
                  update((draft) => {
                    draft.packageInputs.certificationPackageOverview.website = event.target.value;
                  })
                }
              />
            </Field>
            <Field label="Provider logo URL">
              <input
                id="package-cpo-logo"
                type="url"
                value={cpo.logoUrl}
                onChange={(event) =>
                  update((draft) => {
                    draft.packageInputs.certificationPackageOverview.logoUrl = event.target.value;
                  })
                }
              />
            </Field>
            <Field label="Deployment model">
              <select
                id="package-cpo-deployment-model"
                value={cpo.deploymentModel}
                onChange={(event) =>
                  update((draft) => {
                    draft.packageInputs.certificationPackageOverview.deploymentModel = event.target
                      .value as typeof cpo.deploymentModel;
                  })
                }
              >
                <option value="">Choose a deployment model</option>
                {[
                  "Public Cloud",
                  "Government-Only Cloud",
                  "Hybrid Cloud",
                  "Community Cloud",
                  "Government Community Cloud",
                ].map((value) => (
                  <option value={value} key={value}>
                    {value}
                  </option>
                ))}
              </select>
            </Field>
            <fieldset className="contact-inputs" id="package-cpo-contacts" tabIndex={-1}>
              <legend>Security and sales contacts</legend>
              <div className="form-grid">
                <Field label="Security contact name">
                  <input
                    id="package-cpo-security-name"
                    value={cpo.securityContact.name}
                    onChange={(event) =>
                      update((draft) => {
                        draft.packageInputs.certificationPackageOverview.securityContact.name =
                          event.target.value;
                      })
                    }
                  />
                </Field>
                <Field label="Security contact email">
                  <input
                    id="package-cpo-security-email"
                    type="email"
                    value={cpo.securityContact.email}
                    onChange={(event) =>
                      update((draft) => {
                        draft.packageInputs.certificationPackageOverview.securityContact.email =
                          event.target.value;
                      })
                    }
                  />
                </Field>
                <Field label="Security contact phone">
                  <input
                    id="package-cpo-security-phone"
                    type="tel"
                    value={cpo.securityContact.phone}
                    onChange={(event) =>
                      update((draft) => {
                        draft.packageInputs.certificationPackageOverview.securityContact.phone =
                          event.target.value;
                      })
                    }
                    placeholder="202-555-0123"
                  />
                </Field>
                <Field label="Sales contact name">
                  <input
                    id="package-cpo-sales-name"
                    value={cpo.salesContact.name}
                    onChange={(event) =>
                      update((draft) => {
                        draft.packageInputs.certificationPackageOverview.salesContact.name =
                          event.target.value;
                      })
                    }
                  />
                </Field>
                <Field label="Sales contact email">
                  <input
                    id="package-cpo-sales-email"
                    type="email"
                    value={cpo.salesContact.email}
                    onChange={(event) =>
                      update((draft) => {
                        draft.packageInputs.certificationPackageOverview.salesContact.email =
                          event.target.value;
                      })
                    }
                  />
                </Field>
                <Field label="Sales contact phone">
                  <input
                    id="package-cpo-sales-phone"
                    type="tel"
                    value={cpo.salesContact.phone}
                    onChange={(event) =>
                      update((draft) => {
                        draft.packageInputs.certificationPackageOverview.salesContact.phone =
                          event.target.value;
                      })
                    }
                    placeholder="202-555-0123"
                  />
                </Field>
              </div>
            </fieldset>
            <Field label="Business categories (comma separated)">
              <input
                id="package-cpo-business-categories"
                value={cpo.businessCategories.join(",")}
                onChange={(event) =>
                  update((draft) => {
                    draft.packageInputs.certificationPackageOverview.businessCategories =
                      event.target.value.split(",");
                  })
                }
                onBlur={(event) =>
                  update((draft) => {
                    draft.packageInputs.certificationPackageOverview.businessCategories = [
                      ...new Set(
                        event.target.value
                          .split(",")
                          .map((value) => value.trim())
                          .filter(Boolean),
                      ),
                    ];
                  })
                }
                placeholder="Analytics, Data Management"
              />
            </Field>
            <label className="checkbox-row">
              <input
                id="package-cpo-trust-authentication"
                type="checkbox"
                checked={cpo.trustCenterAuthenticationRequired}
                onChange={(event) =>
                  update((draft) => {
                    draft.packageInputs.certificationPackageOverview.trustCenterAuthenticationRequired =
                      event.target.checked;
                  })
                }
              />
              Trust center requires authentication
            </label>
            <Field label="Trust center access instructions">
              <textarea
                id="package-cpo-trust-instructions"
                rows={3}
                value={cpo.trustCenterAccessInstructions}
                onChange={(event) =>
                  update((draft) => {
                    draft.packageInputs.certificationPackageOverview.trustCenterAccessInstructions =
                      event.target.value;
                  })
                }
              />
            </Field>
            <Field label="Next Ongoing Certification Report date">
              <input
                id="package-cpo-next-ocr-date"
                type="date"
                value={cpo.nextOngoingCertificationReportDate}
                onChange={(event) =>
                  update((draft) => {
                    draft.packageInputs.certificationPackageOverview.nextOngoingCertificationReportDate =
                      event.target.value;
                  })
                }
              />
            </Field>
          </div>
        </details>
        <details>
          <summary>Security Decision Record fields</summary>
          <Field label="Certification Package Overview URI">
            <input
              id="package-sdr-cpo-uri"
              value={sdr.certificationPackageOverviewUri}
              onChange={(event) =>
                update((draft) => {
                  draft.packageInputs.securityDecisionRecord.certificationPackageOverviewUri =
                    event.target.value;
                })
              }
            />
          </Field>
          {sdr.portsAndProtocols.map((port, portIndex) => (
            <div className="form-grid port-row" key={port.id}>
              <Field label="Service">
                <input
                  id={`package-sdr-port-${portIndex}-serviceName`}
                  value={port.serviceName}
                  onChange={(event) =>
                    update((draft) => {
                      const item =
                        draft.packageInputs.securityDecisionRecord.portsAndProtocols.find(
                          (candidate) => candidate.id === port.id,
                        );
                      if (item) item.serviceName = event.target.value;
                    })
                  }
                />
              </Field>
              <Field label="Port">
                <input
                  id={`package-sdr-port-${portIndex}-portNumber`}
                  value={port.portNumber}
                  onChange={(event) =>
                    update((draft) => {
                      const item =
                        draft.packageInputs.securityDecisionRecord.portsAndProtocols.find(
                          (candidate) => candidate.id === port.id,
                        );
                      if (item) item.portNumber = event.target.value;
                    })
                  }
                />
              </Field>
              <Field label="Transport">
                <input
                  id={`package-sdr-port-${portIndex}-transportProtocol`}
                  value={port.transportProtocol}
                  onChange={(event) =>
                    update((draft) => {
                      const item =
                        draft.packageInputs.securityDecisionRecord.portsAndProtocols.find(
                          (candidate) => candidate.id === port.id,
                        );
                      if (item) item.transportProtocol = event.target.value;
                    })
                  }
                />
              </Field>
              <Field label="Encryption">
                <input
                  id={`package-sdr-port-${portIndex}-encryption`}
                  value={port.encryption}
                  onChange={(event) =>
                    update((draft) => {
                      const item =
                        draft.packageInputs.securityDecisionRecord.portsAndProtocols.find(
                          (candidate) => candidate.id === port.id,
                        );
                      if (item) item.encryption = event.target.value;
                    })
                  }
                />
              </Field>
              <Field label="Purpose">
                <input
                  id={`package-sdr-port-${portIndex}-purpose`}
                  value={port.purpose}
                  onChange={(event) =>
                    update((draft) => {
                      const item =
                        draft.packageInputs.securityDecisionRecord.portsAndProtocols.find(
                          (candidate) => candidate.id === port.id,
                        );
                      if (item) item.purpose = event.target.value;
                    })
                  }
                />
              </Field>
              <Button
                variant="quiet"
                onClick={() =>
                  update((draft) => {
                    draft.packageInputs.securityDecisionRecord.portsAndProtocols =
                      draft.packageInputs.securityDecisionRecord.portsAndProtocols.filter(
                        (candidate) => candidate.id !== port.id,
                      );
                  })
                }
              >
                Remove row
              </Button>
            </div>
          ))}
          <Button
            variant="secondary"
            onClick={() =>
              update((draft) => {
                draft.packageInputs.securityDecisionRecord.portsAndProtocols.push({
                  id: `port-${crypto.randomUUID()}`,
                  serviceName: "HTTPS",
                  portNumber: "443",
                  transportProtocol: "TCP",
                  encryption: "TLS",
                  purpose: "",
                });
              })
            }
          >
            Add port or protocol
          </Button>
        </details>
        <details>
          <summary>Ongoing Certification Report fields</summary>
          <div className="form-grid">
            <Field label="Certification Package Overview URI">
              <input
                id="package-ocr-cpo-uri"
                value={ocr.certificationPackageOverviewUri}
                onChange={(event) =>
                  update((draft) => {
                    draft.packageInputs.ongoingCertificationReport.certificationPackageOverviewUri =
                      event.target.value;
                  })
                }
              />
            </Field>
            <Field label="Report period start">
              <input
                id="package-ocr-report-from"
                type="date"
                value={ocr.reportFrom}
                onChange={(event) =>
                  update((draft) => {
                    draft.packageInputs.ongoingCertificationReport.reportFrom = event.target.value;
                  })
                }
              />
            </Field>
            <Field label="Report period end">
              <input
                id="package-ocr-report-to"
                type="date"
                value={ocr.reportTo}
                onChange={(event) =>
                  update((draft) => {
                    draft.packageInputs.ongoingCertificationReport.reportTo = event.target.value;
                  })
                }
              />
            </Field>
            <Field label="Planning horizon through">
              <input
                id="package-ocr-planning-through"
                type="date"
                value={ocr.planningHorizonThrough}
                onChange={(event) =>
                  update((draft) => {
                    draft.packageInputs.ongoingCertificationReport.planningHorizonThrough =
                      event.target.value;
                  })
                }
              />
            </Field>
            <Field label="Accepted-vulnerability summary">
              <textarea
                id="package-ocr-accepted-vulnerabilities"
                rows={3}
                value={ocr.acceptedVulnerabilitiesSummary}
                onChange={(event) =>
                  update((draft) => {
                    draft.packageInputs.ongoingCertificationReport.acceptedVulnerabilitiesSummary =
                      event.target.value;
                  })
                }
              />
            </Field>
            <Field label="Planned certification-data changes (one per line)">
              <textarea
                id="package-ocr-planned-changes"
                rows={4}
                value={ocr.plannedChanges.join("\n")}
                onChange={(event) =>
                  update((draft) => {
                    draft.packageInputs.ongoingCertificationReport.plannedChanges =
                      event.target.value
                        .split(/\r?\n/u)
                        .map((value) => value.trim())
                        .filter(Boolean);
                  })
                }
              />
            </Field>
          </div>
        </details>
      </Card>
      <div className="metric-grid metric-grid--three">
        <Card title="Package scaffold">
          <strong className="big-number">11+</strong>
          <p>
            Human-readable, machine-readable, mapping, validation, manifest, and disclaimer
            artifacts in numbered directories.
          </p>
        </Card>
        <Card title="JSON validation">
          <StatusPill
            tone={
              packageResultIsStale
                ? "warning"
                : packageResult
                  ? packageResult.validation.valid
                    ? "positive"
                    : "critical"
                  : "neutral"
            }
          >
            {packageResultIsStale
              ? "Regenerate required"
              : packageResult
                ? packageResult.validation.valid
                  ? "Structurally valid"
                  : "Errors to resolve"
                : "Not run"}
          </StatusPill>
          <p>
            Schema validity is structural. It does not establish accuracy, completeness, approval,
            or acceptance.
          </p>
        </Card>
        <Card title="Package freshness">
          <StatusPill
            tone={
              project.snapshots.at(-1)?.freshnessStatus
                ? toneFor(project.snapshots.at(-1)?.freshnessStatus ?? "")
                : "warning"
            }
          >
            {project.snapshots.at(-1)?.freshnessStatus
              ? statusLabel(project.snapshots.at(-1)?.freshnessStatus ?? "")
              : "No snapshot"}
          </StatusPill>
          <p>Freshness is rechecked when a final-review snapshot is created.</p>
        </Card>
      </div>
      {packageResultIsStale && (
        <div
          className="callout callout--warning package-freshness-notice"
          role="status"
          aria-label="Package result freshness"
        >
          <strong>Project changed since this validation ran.</strong> Regenerate the package before
          relying on these results. Final review always regenerates from the current record.
        </div>
      )}
      {packageResult && (
        <Card title="JSON validation results">
          <p>
            <a href="https://www.fedramp.gov/schemas/" target="_blank" rel="noopener noreferrer">
              Check outputs with FedRAMP’s official browser validator
            </a>
          </p>
          <div className="validation-list">
            {packageResult.validation.documents.map((document) => (
              <details key={document.name} open={!document.valid}>
                <summary>
                  <StatusPill tone={document.valid ? "positive" : "critical"}>
                    {document.valid ? "Valid" : `${document.issues.length} issues`}
                  </StatusPill>{" "}
                  {document.name}
                </summary>
                {document.issues.length === 0 ? (
                  <p>No structural errors were returned by the pinned schema.</p>
                ) : (
                  <ul>
                    {document.issues.map((issue) => (
                      <li key={`${document.name}-${issue.pointer}-${issue.keyword}`}>
                        <strong>{issue.pointer}</strong>: {issue.resolution}
                        <br />
                        <span>
                          Expected: {issue.expected}. Current: {JSON.stringify(issue.current)}.
                        </span>
                        <br />
                        <span>How to resolve: {issue.resolution}</span>
                        <br />
                        <Button
                          variant="quiet"
                          onClick={() => openValidationTarget(document.name, issue.pointer)}
                        >
                          {validationEditTarget(document.name, issue.pointer).label}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            ))}
          </div>
        </Card>
      )}
      <Card title="Prepare final review" eyebrow="Creates an immutable local snapshot">
        <Callout title="Your company remains responsible for submission" tone="warning">
          <p>
            This mode creates an internal record only. It does not certify the offering, make it
            submission-ready by itself, or submit anything to FedRAMP.
          </p>
        </Callout>
        <div className="form-grid">
          <Field label="Package version">
            <input value={version} onChange={(event) => setVersion(event.target.value)} />
          </Field>
          <Field label="Provider approver">
            <input
              value={approver}
              onChange={(event) => setApprover(event.target.value)}
              placeholder="Name and accountable role"
            />
          </Field>
        </div>
        <Button onClick={() => void finalize()} disabled={busy}>
          Create immutable final-review snapshot
        </Button>
        {project.snapshots.map((snapshot) => (
          <article className="snapshot" key={snapshot.id}>
            <div>
              <strong>Version {snapshot.version}</strong>
              <span>{snapshot.createdAt}</span>
            </div>
            <StatusPill tone={toneFor(snapshot.freshnessStatus)}>
              {statusLabel(snapshot.freshnessStatus)}
            </StatusPill>
            <p>
              {snapshot.unresolvedItems.length} unresolved item(s) preserved. Approved internally by{" "}
              {snapshot.providerApprover}.
            </p>
            <p className="small">Package SHA-256: {snapshot.packageHash}</p>
            <Button variant="secondary" onClick={() => void downloadFrozenPackage(snapshot)}>
              Download frozen package version {snapshot.version}
            </Button>
          </article>
        ))}
      </Card>
    </>
  );
}

function Reports({ project }: { readonly project: BridgeProject }) {
  const label: Record<(typeof REPORT_KINDS)[number], string> = {
    "preliminary-fit": "Preliminary fit assessment",
    "executive-readiness": "Executive readiness summary",
    "detailed-gap": "Detailed gap report",
    "scope-summary": "Scope summary",
    "mandatory-requirements": "Mandatory requirements report",
    "evidence-manifest": "Evidence manifest",
    "action-plan": "Action plan",
    "package-validation": "Package validation report",
    "advisor-handoff": "Advisor handoff report",
  };
  return (
    <>
      <PageHeading
        eyebrow="Human-readable exports"
        title="Reports for internal review and careful handoff"
        description="Every report uses preparation language, preserves uncertainty, and is print-friendly. Sample reports carry a visible fictional watermark."
      />
      <div className="report-grid">
        {REPORT_KINDS.map((kind) => (
          <Card key={kind} title={label[kind]}>
            <p>
              Generate a standalone, sanitized HTML report that can be printed to PDF. Editable DOCX
              is also available where practical.
            </p>
            <div className="button-row">
              <Button
                onClick={() => {
                  const report = generateHumanReport(project, kind);
                  downloadText(report.html, report.fileName, report.mimeType);
                }}
              >
                Download HTML
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  const docx = generateEditableDocx(project, kind);
                  downloadBytes(docx.bytes, docx.fileName, docx.mimeType);
                }}
              >
                Download DOCX
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

function Settings({
  project,
  update,
  store,
  saveState,
  onClose,
  onRestore,
}: {
  readonly project: BridgeProject;
  readonly update: (recipe: (draft: BridgeProject) => void) => void;
  readonly store: ProjectStore;
  readonly saveState: SaveState;
  readonly onClose: () => void;
  readonly onRestore: (file: File, password: string) => Promise<void>;
}) {
  const [size, setSize] = useState<number>();
  const [quota, setQuota] = useState<number>();
  const [password, setPassword] = useState("");
  const [importPassword, setImportPassword] = useState("");
  const [message, setMessage] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const attachmentReferences = referencedLocalAttachments(project);
  const generatedOutputReferences = referencedGeneratedOutputs(project);
  const [selectedGeneratedOutputIds, setSelectedGeneratedOutputIds] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        generatedOutputReferences
          .filter((reference) => reference.inline || store.supportsAttachments)
          .map((reference) => reference.id),
      ),
  );
  useEffect(() => {
    void Promise.all([store.estimateOwnedBytes(), browserStorageEstimate()]).then(
      ([owned, estimate]) => {
        setSize(owned);
        setQuota(estimate.quota);
      },
    );
  }, [store, project.metadata.updatedAt]);
  const standard = async () => {
    try {
      const attachments = await collectBundleAttachments(project, store, selectedAttachmentIds);
      const generatedOutputs = await collectBundleGeneratedOutputs(
        project,
        store,
        selectedGeneratedOutputIds,
      );
      const bundle = await exportProjectBundle(project, { attachments, generatedOutputs });
      downloadBytes(
        bundle,
        `${safeFilename(project.metadata.name)}.classabridge`,
        "application/vnd.class-a-bridge+zip",
      );
      setMessage(
        `Standard project backup created with ${generatedOutputs.length} selected generated output(s) and ${attachments.length} explicitly selected sensitive attachment(s).`,
      );
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Standard export failed safely.");
    }
  };
  const protectedExport = async () => {
    try {
      const attachments = await collectBundleAttachments(project, store, selectedAttachmentIds);
      const generatedOutputs = await collectBundleGeneratedOutputs(
        project,
        store,
        selectedGeneratedOutputIds,
      );
      const bundle = await exportProjectBundle(project, { attachments, generatedOutputs });
      const encrypted = await encryptBundle(bundle, password);
      downloadBytes(
        encrypted,
        `${safeFilename(project.metadata.name)}.classabridge.encrypted`,
        "application/vnd.class-a-bridge+encrypted",
      );
      setMessage(
        `Password-protected backup created with ${generatedOutputs.length} generated output(s) and ${attachments.length} selected sensitive attachment(s). The password is not stored.`,
      );
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Encrypted export failed.");
    }
  };
  const advisor = async () => {
    const bundle = await generateAdvisorHandoffPackage(project);
    downloadBytes(bundle.bytes, bundle.fileName, bundle.mimeType);
    setMessage(
      "Redacted advisor handoff created without source documents or evidence attachments.",
    );
  };
  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await onRestore(file, importPassword);
      setMessage("Backup restored after schema, integrity, and storage checks.");
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
          : "Import failed safely; the current project was not replaced.",
      );
    } finally {
      event.target.value = "";
    }
  };
  const deleteLocalData = async (allProjects: boolean) => {
    if (saveState.status === "saving" || deleting) return;
    setDeleting(true);
    setMessage("");
    try {
      if (allProjects) await store.deleteAll();
      else await store.delete(project.metadata.id);
      onClose();
    } catch (caught) {
      setMessage(
        localErrorMessage(
          caught,
          allProjects
            ? "All local data could not be deleted. Nothing is being reported remotely."
            : "This project could not be deleted from browser storage.",
        ),
      );
    } finally {
      setDeleting(false);
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="Local project controls"
        title="Project settings and data management"
        description="See exactly what is stored, create portable backups, restore safely, or delete local data."
      />
      <div className="two-column">
        <Card title="Organization and offering">
          <div className="form-stack">
            <Field label="Project name">
              <input
                value={project.metadata.name}
                onChange={(event) =>
                  update((draft) => {
                    draft.metadata.name = event.target.value;
                  })
                }
              />
            </Field>
            <Field label="Organization">
              <input
                id="settings-organization-name"
                value={project.organization.name}
                onChange={(event) =>
                  update((draft) => {
                    draft.organization.name = event.target.value;
                  })
                }
              />
            </Field>
            <Field label="Organization website">
              <input
                id="settings-organization-website"
                type="url"
                value={project.organization.website ?? ""}
                onChange={(event) =>
                  update((draft) => {
                    draft.organization.website = event.target.value || undefined;
                  })
                }
              />
            </Field>
            <Field label="GRC owner">
              <input
                value={project.organization.grcOwner ?? ""}
                onChange={(event) =>
                  update((draft) => {
                    draft.organization.grcOwner = event.target.value || undefined;
                  })
                }
              />
            </Field>
            <Field label="Trust center URL">
              <input
                id="settings-trust-center-url"
                type="url"
                value={project.organization.trustCenterUrl ?? ""}
                onChange={(event) =>
                  update((draft) => {
                    draft.organization.trustCenterUrl = event.target.value || undefined;
                  })
                }
              />
            </Field>
            <Field label="Marketplace listing status">
              <select
                value={project.organization.marketplaceStatus}
                onChange={(event) =>
                  update((draft) => {
                    draft.organization.marketplaceStatus = event.target
                      .value as BridgeProject["organization"]["marketplaceStatus"];
                  })
                }
              >
                <option value="not_started">Not started</option>
                <option value="preparing">Preparing</option>
                <option value="listed">Listed</option>
                <option value="not_sure">Not sure</option>
              </select>
            </Field>
            <Field label="Cloud service offering">
              <input
                id="settings-offering-name"
                value={project.offering.name}
                onChange={(event) =>
                  update((draft) => {
                    draft.offering.name = event.target.value;
                  })
                }
              />
            </Field>
            <Field label="Offering acronym">
              <input
                id="settings-offering-acronym"
                value={project.offering.acronym ?? ""}
                onChange={(event) =>
                  update((draft) => {
                    draft.offering.acronym = event.target.value || undefined;
                  })
                }
              />
            </Field>
            <Field label="Offering description">
              <textarea
                id="settings-offering-description"
                rows={4}
                value={project.offering.description}
                onChange={(event) =>
                  update((draft) => {
                    draft.offering.description = event.target.value;
                  })
                }
              />
            </Field>
            <fieldset className="checkbox-grid" id="settings-service-models" tabIndex={-1}>
              <legend>Cloud service models</legend>
              {[
                ["SaaS", "Software as a Service (SaaS)"],
                ["PaaS", "Platform as a Service (PaaS)"],
                ["IaaS", "Infrastructure as a Service (IaaS)"],
              ].map(([value, label]) => (
                <label key={value}>
                  <input
                    type="checkbox"
                    checked={project.offering.serviceModels.includes(
                      value as BridgeProject["offering"]["serviceModels"][number],
                    )}
                    onChange={(event) =>
                      update((draft) => {
                        const model = value as BridgeProject["offering"]["serviceModels"][number];
                        draft.offering.serviceModels = event.target.checked
                          ? [...new Set([...draft.offering.serviceModels, model])]
                          : draft.offering.serviceModels.filter((candidate) => candidate !== model);
                      })
                    }
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <Field label="Deployment model">
              <select
                id="settings-deployment-model"
                value={project.offering.deploymentModel}
                onChange={(event) =>
                  update((draft) => {
                    draft.offering.deploymentModel = event.target.value;
                  })
                }
              >
                <option value="">Choose a deployment model</option>
                {[
                  "Public Cloud",
                  "Government-Only Cloud",
                  "Hybrid Cloud",
                  "Community Cloud",
                  "Government Community Cloud",
                ].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Handles federal customer data">
              <select
                value={project.offering.handlesFederalData}
                onChange={(event) =>
                  update((draft) => {
                    draft.offering.handlesFederalData = event.target
                      .value as BridgeProject["offering"]["handlesFederalData"];
                  })
                }
              >
                <option value="not_sure">Not sure</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </Field>
            <Field label="Offering website">
              <input
                id="settings-offering-website"
                type="url"
                value={project.offering.website ?? ""}
                onChange={(event) =>
                  update((draft) => {
                    draft.offering.website = event.target.value || undefined;
                  })
                }
              />
            </Field>
            <Field label="Accountable executive">
              <input
                value={project.organization.accountableExecutive ?? ""}
                onChange={(event) =>
                  update((draft) => {
                    draft.organization.accountableExecutive = event.target.value;
                  })
                }
              />
            </Field>
            <Field label="Defined federal use case">
              <textarea
                rows={3}
                value={project.offering.federalUseCase}
                onChange={(event) =>
                  update((draft) => {
                    draft.offering.federalUseCase = event.target.value;
                  })
                }
              />
            </Field>
          </div>
        </Card>
        <Card title="What is stored">
          <dl className="data-list">
            <div>
              <dt>Storage backend</dt>
              <dd>{store.backend}</dd>
            </div>
            <div>
              <dt>Project data</dt>
              <dd>
                {size === undefined
                  ? "Calculating…"
                  : `${Math.max(1, Math.round(size / 1024))} KB owned by the app`}
              </dd>
            </div>
            <div>
              <dt>Browser quota</dt>
              <dd>
                {quota
                  ? `${Math.round(quota / 1024 / 1024)} MB reported`
                  : "Not reported by this browser"}
              </dd>
            </div>
            <div>
              <dt>Local attachments</dt>
              <dd>
                {project.evidence.filter((item) => item.attachmentId).length +
                  (project.soc2.sourceReport ? 1 : 0)}{" "}
                referenced
              </dd>
            </div>
            <div>
              <dt>Generated outputs</dt>
              <dd>{project.generatedOutputs.length} recorded</dd>
            </div>
            <div>
              <dt>Last local save</dt>
              <dd>{project.metadata.lastLocalSaveAt ?? "Saving is pending"}</dd>
            </div>
            <div>
              <dt>Rule catalog</dt>
              <dd>{project.metadata.ruleCatalogVersion}</dd>
            </div>
          </dl>
        </Card>
      </div>
      <Card title="Portable project backups">
        {attachmentReferences.length > 0 && (
          <fieldset className="attachment-selector">
            <legend>Optional sensitive attachments</legend>
            <p>
              Nothing is selected by default. Select only files that should travel in this backup.
              The original SOC 2 report remains excluded unless you choose it here.
            </p>
            {!store.supportsAttachments && (
              <p className="small">
                This storage fallback cannot retain binary attachments, so referenced files cannot
                be added from this browser session.
              </p>
            )}
            {attachmentReferences.map((reference) => (
              <label className="checkbox-row" key={reference.id}>
                <input
                  type="checkbox"
                  disabled={!store.supportsAttachments}
                  checked={selectedAttachmentIds.has(reference.id)}
                  onChange={(event) =>
                    setSelectedAttachmentIds((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(reference.id);
                      else next.delete(reference.id);
                      return next;
                    })
                  }
                />
                <span>
                  <strong>{reference.label}</strong>
                  <small>{statusLabel(reference.sensitivity)} · included only in this export</small>
                </span>
              </label>
            ))}
          </fieldset>
        )}
        {generatedOutputReferences.length > 0 && (
          <fieldset className="attachment-selector">
            <legend>Generated outputs</legend>
            <p>
              Generated outputs are selected by default so the backup can reproduce frozen review
              records. A package ZIP can contain sensitive attachments you previously chose during
              package generation; deselect any output that should remain only in this browser.
            </p>
            {generatedOutputReferences.map((reference) => {
              const available = reference.inline || store.supportsAttachments;
              return (
                <label className="checkbox-row" key={reference.id}>
                  <input
                    type="checkbox"
                    disabled={!available}
                    checked={selectedGeneratedOutputIds.has(reference.id) && available}
                    onChange={(event) =>
                      setSelectedGeneratedOutputIds((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.add(reference.id);
                        else next.delete(reference.id);
                        return next;
                      })
                    }
                  />
                  <span>
                    <strong>{reference.label}</strong>
                    <small>
                      {available
                        ? "Included in this backup unless deselected"
                        : "Metadata only — bytes are unavailable in this storage fallback"}
                    </small>
                  </span>
                </label>
              );
            })}
          </fieldset>
        )}
        <div className="export-grid">
          <div>
            <h3>Standard project export</h3>
            <p>
              Project JSON, manifest, hashes, versions, migrations, and selected generated outputs.
              Source reports and evidence attachments are omitted unless selected above.
            </p>
            <Button onClick={() => void standard()}>Export .classabridge</Button>
          </div>
          <div>
            <h3>Password-protected export</h3>
            <p>
              Encrypts the bundle, selected generated outputs, and any attachments selected above
              with AES-256-GCM and a password-derived key in this browser.
            </p>
            <input
              type="password"
              aria-label="Export password"
              minLength={12}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 12 characters"
            />
            <Button onClick={() => void protectedExport()} disabled={password.length < 12}>
              Export encrypted backup
            </Button>
          </div>
          <div>
            <h3>Redacted advisor handoff</h3>
            <p>
              Allowlisted summary. Original report, source excerpts, narratives, hashes, and
              evidence attachments are excluded.
            </p>
            <Button onClick={() => void advisor()}>Export advisor handoff</Button>
          </div>
        </div>
      </Card>
      <Card title="Restore a backup">
        <div className="form-grid">
          <Field label="Password for encrypted backup (if applicable)">
            <input
              type="password"
              value={importPassword}
              onChange={(event) => setImportPassword(event.target.value)}
            />
          </Field>
          <Field label="Choose backup">
            <input
              type="file"
              accept=".classabridge,.encrypted"
              onChange={(event) => void importFile(event)}
            />
          </Field>
        </div>
        <p className="small">
          The file is checked for path safety, size, compression ratio, schema version, declared
          hashes, and supported migrations before the restored project becomes active. Failed
          attachment writes are rolled back.
        </p>
      </Card>
      <Card title="Privacy and diagnostics">
        <p>
          No assessment analytics, remote artificial intelligence, third-party parser, or
          project-content logging is enabled. Errors are shown locally.
        </p>
        <div className="button-row">
          <Button
            variant="secondary"
            onClick={() =>
              downloadText(
                JSON.stringify(diagnosticReport(), null, 2),
                "class-a-bridge-diagnostic.json",
                "application/json",
              )
            }
          >
            Download private diagnostic
          </Button>
          <a
            className="button button--quiet"
            href="../security-and-privacy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Read privacy documentation
          </a>
        </div>
      </Card>
      <Card title="Delete local data" className="danger-zone">
        <p>
          Deleting this project also deletes its owned local attachments. Export a backup first if
          you may need the record later.
        </p>
        {confirmDelete ? (
          <div className="button-row">
            <Button
              variant="danger"
              disabled={saveState.status === "saving" || deleting}
              onClick={() => void deleteLocalData(false)}
            >
              {deleting ? "Deleting local data…" : "Delete this project now"}
            </Button>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={saveState.status === "saving" || deleting}
              onClick={() => void deleteLocalData(true)}
            >
              Delete all Class A Bridge local data
            </Button>
          </div>
        ) : (
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            Review deletion options
          </Button>
        )}
      </Card>
      {message && (
        <div className="toast" role="status">
          {message}
        </div>
      )}
    </>
  );
}

function ListOrEmpty({
  items,
  empty = "Nothing recorded.",
}: {
  readonly items: readonly ReactNode[];
  readonly empty?: string;
}) {
  return items.length ? (
    <ul className="plain-list">
      {items.map((item, index) => (
        <li key={typeof item === "string" ? item : index}>{item}</li>
      ))}
    </ul>
  ) : (
    <p className="empty-copy">{empty}</p>
  );
}

export interface AppProps {
  readonly storeFactory?: () => Promise<ProjectStore>;
}

export function App({ storeFactory = DEFAULT_STORE_FACTORY }: AppProps = {}) {
  const [mode, setMode] = useState<"first" | "pdf" | "pdf-review" | "workspace">(() =>
    requestedStart === "report"
      ? "pdf"
      : requestedStart === "manual" || requestedStart === "sample"
        ? "workspace"
        : "first",
  );
  const [project, setProject] = useState<BridgeProject | undefined>(() =>
    requestedStart === "sample"
      ? cloneProject(ACME_METRICS_PROJECT)
      : requestedStart === "manual"
        ? initializeProject()
        : undefined,
  );
  const [route, setRoute] = useState<Route>(() =>
    requestedStart === "manual" ? "/eligibility" : "/overview",
  );
  const [store, setStore] = useState<ProjectStore>(() => createProjectStore());
  const [savedProjects, setSavedProjects] = useState<readonly ProjectSummary[]>([]);
  const [savedProjectsState, setSavedProjectsState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [savedProjectsError, setSavedProjectsError] = useState("");
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const [restoreMessage, setRestoreMessage] = useState("");
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [updateRegistration, setUpdateRegistration] = useState<ServiceWorkerRegistration>();
  const saveSequence = useRef(0);
  const updateRequested = useRef(false);
  const reloadingForUpdate = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setSavedProjectsState("loading");
    setSavedProjectsError("");
    void storeFactory()
      .then(async (nextStore) => {
        const summaries = await nextStore.list();
        if (cancelled) return;
        setStore(nextStore);
        setSavedProjects(summaries);
        setSavedProjectsState("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setSavedProjectsError(
          localErrorMessage(error, "Browser storage could not be opened safely."),
        );
        setSavedProjectsState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [storeFactory]);
  useEffect(() => {
    if (!project || mode !== "workspace") return;
    const sequence = ++saveSequence.current;
    setSaveState({ status: "saving" });
    const timer = setTimeout(() => {
      if (sequence !== saveSequence.current) return;
      const next = cloneProject(project);
      next.metadata.lastLocalSaveAt = new Date().toISOString();
      void store
        .save(next)
        .then(() => {
          if (sequence === saveSequence.current) {
            setProject((current) => (current?.metadata.id === next.metadata.id ? next : current));
            setSaveState({ status: "saved" });
          }
        })
        .catch((error: unknown) => {
          if (sequence === saveSequence.current) {
            setSaveState({
              status: "error",
              message: localErrorMessage(error, "browser storage rejected the write"),
            });
          }
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [project?.metadata.updatedAt, mode, store]);
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    globalThis.addEventListener("online", handleOnline);
    globalThis.addEventListener("offline", handleOffline);
    return () => {
      globalThis.removeEventListener("online", handleOnline);
      globalThis.removeEventListener("offline", handleOffline);
    };
  }, []);
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;
    let disposed = false;
    let registration: ServiceWorkerRegistration | undefined;
    const showWaitingUpdate = () => {
      if (!disposed && registration?.waiting && navigator.serviceWorker.controller)
        setUpdateRegistration(registration);
    };
    const handleControllerChange = () => {
      if (updateRequested.current && !reloadingForUpdate.current) {
        reloadingForUpdate.current = true;
        globalThis.location.reload();
      }
    };
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    void navigator.serviceWorker.register("./sw.js").then((nextRegistration) => {
      if (disposed) return;
      registration = nextRegistration;
      showWaitingUpdate();
      nextRegistration.addEventListener("updatefound", () => {
        const worker = nextRegistration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed") showWaitingUpdate();
        });
      });
    });
    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  const update = (recipe: (draft: BridgeProject) => void, updatedAt = new Date().toISOString()) =>
    setProject((current) => {
      if (!current) return current;
      const draft = cloneProject(current);
      recipe(draft);
      draft.metadata.updatedAt = updatedAt;
      draft.actions = deriveActions(draft);
      return draft;
    });
  const persistGeneratedProject = async (
    next: BridgeProject,
    output: { readonly id: string; readonly bytes: Uint8Array },
  ) => {
    const sequence = ++saveSequence.current;
    next.metadata.lastLocalSaveAt = new Date().toISOString();
    setSaveState({ status: "saving" });
    try {
      const retained = await persistProjectWithGeneratedOutputAtomically(store, next, output);
      setProject((current) =>
        current?.metadata.id === next.metadata.id ? cloneProject(next) : current,
      );
      if (sequence === saveSequence.current) setSaveState({ status: "saved" });
      return retained;
    } catch (error) {
      if (sequence === saveSequence.current) {
        setSaveState({
          status: "error",
          message: localErrorMessage(error, "generated package storage rejected the write"),
        });
      }
      throw error;
    }
  };
  const enter = (next: BridgeProject, nextRoute: Route) => {
    setRestoreMessage("");
    setProject(cloneProject(next));
    setRoute(nextRoute);
    setMode("workspace");
    window.scrollTo({ top: 0 });
  };
  const refreshSavedProjects = async () => {
    try {
      setSavedProjects(await store.list());
      setSavedProjectsState("ready");
      setSavedProjectsError("");
    } catch (error) {
      setSavedProjectsError(localErrorMessage(error, "Saved projects could not be listed."));
      setSavedProjectsState("error");
    }
  };
  const openSavedProject = async (id: string) => {
    try {
      const saved = await store.load(id);
      if (!saved) throw new Error("That saved project is no longer available in browser storage.");
      if (
        saved.soc2.extractionCandidates.some((candidate) => candidate.decision === "unreviewed")
      ) {
        setRestoreMessage("");
        setProject(cloneProject(saved));
        setMode("pdf-review");
        window.scrollTo({ top: 0 });
        return;
      }
      enter(saved, "/overview");
    } catch (error) {
      setSavedProjectsError(localErrorMessage(error, "The saved project could not be opened."));
      setSavedProjectsState("error");
    }
  };
  const restoreFile = async (file: File, password: string) => {
    let bytes: Uint8Array = new Uint8Array(await file.arrayBuffer());
    if (file.name.toLowerCase().endsWith(".encrypted"))
      bytes = await decryptBundle(bytes, password);
    const imported = await importProjectBundle(bytes);
    const omittedBinaryCount = store.supportsAttachments
      ? 0
      : imported.attachments.size + imported.generatedOutputs.size;
    const restored = await restoreImportedProjectAtomically(store, imported);
    enter(restored, "/overview");
    setRestoreMessage(
      omittedBinaryCount > 0
        ? `Restored “${restored.metadata.name}” after schema and integrity checks. This browser fallback restored the project record but could not retain ${omittedBinaryCount} bundled binary file${omittedBinaryCount === 1 ? "" : "s"}. Inline report content remains in the project record.`
        : `Restored “${restored.metadata.name}” after schema, integrity, and storage checks.`,
    );
    await refreshSavedProjects();
  };
  const firstRun = (
    <FirstRun
      onPdf={() => setMode("pdf")}
      onManual={() => enter(initializeProject(), "/eligibility")}
      onSample={() => enter(cloneProject(ACME_METRICS_PROJECT), "/overview")}
      savedProjects={savedProjects}
      savedProjectsState={savedProjectsState}
      savedProjectsError={savedProjectsError}
      onOpenSaved={openSavedProject}
      onImport={restoreFile}
    />
  );
  if (mode === "first") return firstRun;
  if (mode === "pdf")
    return (
      <PdfStart
        onCancel={() => setMode("first")}
        onManual={() => enter(initializeProject(), "/eligibility")}
        onProject={async (next, attachment) => {
          if (!store.supportsAttachments) {
            next.notes = [
              next.notes,
              "This browser storage fallback retained the extracted metadata but not the original PDF bytes.",
            ]
              .filter(Boolean)
              .join(" ");
          }
          await persistProjectWithAttachmentAtomically(store, next, attachment);
          setProject(next);
          setMode("pdf-review");
        }}
      />
    );
  if (mode === "pdf-review" && project)
    return (
      <PdfReview
        project={project}
        update={update}
        onContinue={() => {
          setRoute("/eligibility");
          setMode("workspace");
        }}
      />
    );
  if (!project) return firstRun;
  return (
    <Shell
      project={project}
      route={route}
      setRoute={(next) => {
        setRoute(next);
        window.scrollTo({ top: 0 });
      }}
      update={update}
      store={store}
      persistGeneratedProject={persistGeneratedProject}
      saveState={saveState}
      online={online}
      updateAvailable={Boolean(updateRegistration?.waiting)}
      restoreMessage={restoreMessage}
      onDismissRestoreMessage={() => setRestoreMessage("")}
      onApplyUpdate={() => {
        if (saveState.status === "saving" || saveState.status === "error") return;
        const waiting = updateRegistration?.waiting;
        if (!waiting) return;
        updateRequested.current = true;
        waiting.postMessage({ type: "SKIP_WAITING" });
      }}
      onRestore={restoreFile}
      onClose={() => {
        setRestoreMessage("");
        setProject(undefined);
        setMode("first");
        void refreshSavedProjects();
      }}
    />
  );
}
