import {
  generateAdvisorHandoffPackage,
  generateCsv,
  generateEditableDocx,
  generateHumanReport,
  generatePreparationPackage,
  REPORT_KINDS,
  type OfficialDocumentOptions,
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
import { parsePdfLocally, validatePdfFile } from "./lib/pdf";
import {
  answerEligibility,
  deriveActions,
  evidenceFreshness,
  initializeProject,
  requirementMilestone,
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

function FirstRun({
  onPdf,
  onManual,
  onSample,
}: {
  readonly onPdf: () => void;
  readonly onManual: () => void;
  readonly onSample: () => void;
}) {
  return (
    <main className="first-run">
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
            Choose a local PDF. Deterministic extraction runs only in this browser, and you confirm
            every value.
          </span>
          <em>Choose local PDF →</em>
        </button>
        <button className="start-card" onClick={onManual}>
          <span className="start-card__icon" aria-hidden="true">
            ✎
          </span>
          <strong>Start without uploading a report</strong>
          <span>
            Answer the same guided questions and add report details manually whenever you are ready.
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
      <footer className="first-run__footer">
        <span>Open source · Local-first · Preparation support, not certification</span>
        <a href="../security-and-privacy">Security and privacy</a>
      </footer>
    </main>
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
    <main className="focused-page">
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
        if (candidate.field === "System or service name") draft.soc2.systemName = candidate.value;
        if (candidate.field === "Carve-out treatment") draft.soc2.treatment = "carve_out";
        if (candidate.field === "Trust Services Criteria")
          draft.soc2.trustServicesCriteria = [
            ...new Set([...draft.soc2.trustServicesCriteria, candidate.value]),
          ];
      }
    });
  const reviewed = project.soc2.extractionCandidates.filter(
    (item) => item.decision !== "unreviewed",
  ).length;
  return (
    <main className="focused-page focused-page--wide">
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
            The report may be scanned or use an unfamiliar format. Your project is preserved and the
            manual path remains available.
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
  );
}

function Shell({
  project,
  route,
  setRoute,
  update,
  store,
  onClose,
}: {
  readonly project: BridgeProject;
  readonly route: Route;
  readonly setRoute: (route: Route) => void;
  readonly update: (recipe: (draft: BridgeProject) => void) => void;
  readonly store: ProjectStore;
  readonly onClose: () => void;
}) {
  const screens: Record<Route, ReactNode> = {
    "/overview": <Overview project={project} navigate={setRoute} />,
    "/eligibility": <Eligibility project={project} update={update} />,
    "/scope": <Scope project={project} update={update} />,
    "/soc2-materials": <Soc2Materials project={project} update={update} />,
    "/requirements": <Requirements project={project} update={update} />,
    "/evidence": <Evidence project={project} update={update} store={store} />,
    "/action-plan": <ActionPlan project={project} update={update} navigate={setRoute} />,
    "/package": <Package project={project} update={update} />,
    "/reports": <Reports project={project} />,
    "/settings": <Settings project={project} update={update} store={store} onClose={onClose} />,
  };
  return (
    <div className="app-shell">
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
        {project.metadata.isSample && (
          <div className="sample-banner" role="note">
            Fictional demonstration — not an actual certification package.
          </div>
        )}
        <main className="screen" id="main-content">
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
          <StatusPill
            tone={
              project.eligibility.answers.find((item) => item.questionId === "soc2_fresh")
                ?.value === "yes"
                ? "positive"
                : "warning"
            }
          >
            {project.eligibility.answers.find((item) => item.questionId === "soc2_fresh")?.value ===
            "yes"
              ? "Confirmed within window"
              : "Needs confirmation"}
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
  const included = project.scope.resources.filter((item) => item.included);
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
      <Card title="SOC 2-to-Class A mappings">
        <form className="mapping-form" onSubmit={addMapping}>
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
            <article key={mapping.id}>
              <div>
                <strong>
                  {mapping.soc2ControlId} → {mapping.classARuleId}
                </strong>
                <span>Page {mapping.reportPage}</span>
              </div>
              <select
                aria-label={`Coverage for ${mapping.id}`}
                value={mapping.coverage}
                onChange={(event) =>
                  update((draft) => {
                    const item = draft.mappings.find((candidate) => candidate.id === mapping.id);
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
              <p>{mapping.reason}</p>
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
        <section className="requirement-detail">
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
                      <option value={value} key={value}>
                        {statusLabel(value)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Review status">
                  <select
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
  const [owner, setOwner] = useState("");
  const [file, setFile] = useState<File>();
  const [error, setError] = useState("");
  const add = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    setError("");
    try {
      let attachmentId: string | undefined;
      let hash = "0".repeat(64);
      let kind: BridgeProject["evidence"][number]["kind"] = "external_reference";
      if (file) {
        if (file.size > 25 * 1024 * 1024)
          throw new Error("Evidence files must be 25 MB or smaller.");
        const bytes = new Uint8Array(await file.arrayBuffer());
        hash = await sha256Hex(bytes);
        attachmentId = `evidence-${crypto.randomUUID()}`;
        kind = file.type.startsWith("image/")
          ? "screenshot"
          : file.name.toLowerCase().endsWith(".csv")
            ? "csv"
            : "file";
        await store.putAttachment(attachmentId, bytes, project.metadata.id);
      }
      update((draft) =>
        draft.evidence.push({
          id: `evidence-${crypto.randomUUID()}`,
          title: title.trim(),
          description: file
            ? `Local file: ${safeFilename(file.name)}`
            : "Manually recorded evidence reference.",
          kind,
          owner: owner.trim() || "Unassigned",
          collectedAt: new Date().toISOString().slice(0, 10),
          relatedRequirementIds: [],
          relatedSoc2ControlIds: [],
          sha256: hash,
          sensitivity: "confidential",
          notes: "Evidence candidate; sufficiency has not been determined.",
          reviewStatus: "candidate",
          ...(attachmentId ? { attachmentId } : {}),
        }),
      );
      setTitle("");
      setOwner("");
      setFile(undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Evidence could not be stored locally.");
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="Local evidence library"
        title="Collect candidates without claiming sufficiency"
        description="Files stay in this browser. Hashes help identify the selected bytes; a human reviewer still decides relevance and sufficiency."
      />
      <div className="two-column two-column--sidebar">
        <Card title="Add an evidence candidate">
          <form onSubmit={(event) => void add(event)} className="form-stack">
            <Field label="Title">
              <input value={title} onChange={(event) => setTitle(event.target.value)} required />
            </Field>
            <Field label="Owner">
              <input value={owner} onChange={(event) => setOwner(event.target.value)} />
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
                <article key={item.id}>
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
                      <dt>SHA-256</dt>
                      <dd>
                        <code>{item.sha256.slice(0, 16)}…</code>
                      </dd>
                    </div>
                    <div>
                      <dt>Sensitivity</dt>
                      <dd>{item.sensitivity}</dd>
                    </div>
                  </dl>
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
                      onClick={() =>
                        update((draft) => {
                          draft.evidence = draft.evidence.filter(
                            (candidate) => candidate.id !== item.id,
                          );
                        })
                      }
                    >
                      Remove
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
}: {
  readonly project: BridgeProject;
  readonly update: (recipe: (draft: BridgeProject) => void) => void;
}) {
  const [packageResult, setPackageResult] =
    useState<Awaited<ReturnType<typeof generatePreparationPackage>>>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [approver, setApprover] = useState(project.organization.accountableExecutive ?? "");
  const [version, setVersion] = useState("1.0");
  const cpo = project.packageInputs.certificationPackageOverview;
  const sdr = project.packageInputs.securityDecisionRecord;
  const ocr = project.packageInputs.ongoingCertificationReport;
  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await generatePreparationPackage(project, {
        packageVersion: version,
        officialDocuments: officialDocumentOptions(project),
      });
      setPackageResult(result);
      downloadBytes(result.bytes, result.fileName, result.mimeType);
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
    try {
      const result =
        packageResult ??
        (await generatePreparationPackage(project, {
          packageVersion: version,
          officialDocuments: officialDocumentOptions(project),
        }));
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
      update((draft) => {
        const now = new Date().toISOString();
        draft.snapshots.push({
          id: `snapshot-${crypto.randomUUID()}`,
          version,
          createdAt: now,
          providerApprover: approver.trim(),
          verificationDate: now.slice(0, 10),
          validationDate: now.slice(0, 10),
          projectHash,
          packageHash: result.sha256,
          freshnessStatus:
            draft.soc2.reportEnd &&
            Date.now() - new Date(draft.soc2.reportEnd).getTime() > 365 * 86_400_000
              ? "stale"
              : "fresh",
          unresolvedItems: unresolved,
          immutable: true,
        });
        draft.approvals.push({
          id: `approval-${crypto.randomUUID()}`,
          kind: "final_internal_review",
          title: `Package snapshot ${version} prepared for final internal review`,
          approver: approver.trim(),
          role: "Provider approver",
          acceptedAt: now,
          scope: "Internal package snapshot; provider must review and submit its own application.",
          notes: "This record does not represent FedRAMP approval or acceptance.",
        });
      });
      setPackageResult(result);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Final-review snapshot could not be created.",
      );
    } finally {
      setBusy(false);
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
                type="url"
                value={cpo.website}
                onChange={(event) =>
                  update((draft) => {
                    draft.packageInputs.certificationPackageOverview.website = event.target.value;
                  })
                }
              />
            </Field>
            <Field label="Deployment model">
              <select
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
            <Field label="Security contact name">
              <input
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
            <Field label="Sales contact name">
              <input
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
            <Field label="Next Ongoing Certification Report date">
              <input
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
              value={sdr.certificationPackageOverviewUri}
              onChange={(event) =>
                update((draft) => {
                  draft.packageInputs.securityDecisionRecord.certificationPackageOverviewUri =
                    event.target.value;
                })
              }
            />
          </Field>
          {sdr.portsAndProtocols.map((port) => (
            <div className="form-grid port-row" key={port.id}>
              <Field label="Service">
                <input
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
              packageResult ? (packageResult.validation.valid ? "positive" : "critical") : "neutral"
            }
          >
            {packageResult
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
                        <span>
                          How to resolve: {issue.resolution} · Edit: {issue.route}
                        </span>
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
  onClose,
}: {
  readonly project: BridgeProject;
  readonly update: (recipe: (draft: BridgeProject) => void) => void;
  readonly store: ProjectStore;
  readonly onClose: () => void;
}) {
  const [size, setSize] = useState<number>();
  const [quota, setQuota] = useState<number>();
  const [password, setPassword] = useState("");
  const [importPassword, setImportPassword] = useState("");
  const [message, setMessage] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    void Promise.all([store.estimateOwnedBytes(), browserStorageEstimate()]).then(
      ([owned, estimate]) => {
        setSize(owned);
        setQuota(estimate.quota);
      },
    );
  }, [store, project.metadata.updatedAt]);
  const standard = async () => {
    const bundle = await exportProjectBundle(project);
    downloadBytes(
      bundle,
      `${safeFilename(project.metadata.name)}.classabridge`,
      "application/vnd.class-a-bridge+zip",
    );
    setMessage("Standard project backup created without attachments.");
  };
  const protectedExport = async () => {
    try {
      const bundle = await exportProjectBundle(project);
      const encrypted = await encryptBundle(bundle, password);
      downloadBytes(
        encrypted,
        `${safeFilename(project.metadata.name)}.classabridge.encrypted`,
        "application/vnd.class-a-bridge+encrypted",
      );
      setMessage("Password-protected backup created. The password is not stored.");
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
      let bytes: Uint8Array = new Uint8Array(await file.arrayBuffer());
      if (file.name.endsWith(".encrypted")) bytes = await decryptBundle(bytes, importPassword);
      const restored = await importProjectBundle(bytes);
      update((draft) => Object.assign(draft, restored.project));
      for (const [id, attachment] of restored.attachments)
        await store.putAttachment(id, attachment, restored.project.metadata.id);
      setMessage(`Restored “${restored.project.metadata.name}” after schema and hash validation.`);
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
            <Field label="Organization">
              <input
                value={project.organization.name}
                onChange={(event) =>
                  update((draft) => {
                    draft.organization.name = event.target.value;
                  })
                }
              />
            </Field>
            <Field label="Cloud service offering">
              <input
                value={project.offering.name}
                onChange={(event) =>
                  update((draft) => {
                    draft.offering.name = event.target.value;
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
        <div className="export-grid">
          <div>
            <h3>Standard project export</h3>
            <p>
              Project JSON, manifest, hashes, versions, migrations, and generated-output metadata.
              Attachments are omitted by default.
            </p>
            <Button onClick={() => void standard()}>Export .classabridge</Button>
          </div>
          <div>
            <h3>Password-protected export</h3>
            <p>
              Encrypts the standard bundle with AES-256-GCM and a password-derived key in this
              browser.
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
          hashes, and supported migrations before replacing this project.
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
              onClick={() => void store.delete(project.metadata.id).then(onClose)}
            >
              Delete this project now
            </Button>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void store.deleteAll().then(onClose)}>
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

export function App() {
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
  const saveSequence = useRef(0);

  useEffect(() => {
    void createProjectStoreSafely().then(setStore);
  }, []);
  useEffect(() => {
    if (!project || mode !== "workspace") return;
    const sequence = ++saveSequence.current;
    const timer = setTimeout(() => {
      const next = cloneProject(project);
      next.metadata.lastLocalSaveAt = new Date().toISOString();
      void store
        .save(next)
        .then(() => {
          if (sequence === saveSequence.current)
            setProject((current) => (current?.metadata.id === next.metadata.id ? next : current));
        })
        .catch(() => undefined);
    }, 250);
    return () => clearTimeout(timer);
  }, [project?.metadata.updatedAt, mode, store]);
  useEffect(() => {
    if ("serviceWorker" in navigator && import.meta.env.PROD)
      void navigator.serviceWorker.register("./sw.js");
  }, []);

  const update = (recipe: (draft: BridgeProject) => void) =>
    setProject((current) => {
      if (!current) return current;
      const draft = cloneProject(current);
      recipe(draft);
      draft.metadata.updatedAt = new Date().toISOString();
      draft.actions = deriveActions(draft);
      return draft;
    });
  const enter = (next: BridgeProject, nextRoute: Route) => {
    setProject(cloneProject(next));
    setRoute(nextRoute);
    setMode("workspace");
    window.scrollTo({ top: 0 });
  };
  if (mode === "first")
    return (
      <FirstRun
        onPdf={() => setMode("pdf")}
        onManual={() => enter(initializeProject(), "/eligibility")}
        onSample={() => enter(cloneProject(ACME_METRICS_PROJECT), "/overview")}
      />
    );
  if (mode === "pdf")
    return (
      <PdfStart
        onCancel={() => setMode("first")}
        onManual={() => enter(initializeProject(), "/eligibility")}
        onProject={async (next, attachment) => {
          await store.putAttachment(attachment.id, attachment.bytes, next.metadata.id);
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
  if (!project)
    return (
      <FirstRun
        onPdf={() => setMode("pdf")}
        onManual={() => enter(initializeProject(), "/eligibility")}
        onSample={() => enter(cloneProject(ACME_METRICS_PROJECT), "/overview")}
      />
    );
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
      onClose={() => {
        setProject(undefined);
        setMode("first");
      }}
    />
  );
}
