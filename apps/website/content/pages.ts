import type { StaticPageDefinition } from "./types";

export const requiredRoutePaths = [
  "/product/",
  "/how-it-works/",
  "/open-source/",
  "/security-and-privacy/",
  "/methodology/",
  "/guidance/",
  "/services/",
  "/faq/",
  "/docs/",
  "/release-notes/",
  "/privacy/",
  "/terms/",
  "/disclaimer/",
  "/trademark/",
  "/contact/",
  "/launch/",
] as const;

const productPage: StaticPageDefinition = {
  path: "/product/",
  title: "Class A Bridge product overview",
  description:
    "See how Class A Bridge turns a SOC 2 Type II starting point into an explainable FedRAMP 20x Class A preparation workspace and package scaffold.",
  eyebrow: "The product",
  headline: "A guided workspace between your SOC 2 report and a Class A plan.",
  intro:
    "Class A Bridge helps a compliance owner make the first decisions, organize existing assurance material, and show technical teams exactly where their input is needed.",
  sections: [
    {
      id: "outcomes",
      eyebrow: "Four practical outcomes",
      title: "Move from uncertainty to an inspectable record",
      cards: [
        {
          title: "Preliminary fit",
          body: "Answer eight high-value questions and receive a result with reasons, uncertainties, source rules, and three actions.",
        },
        {
          title: "Gap analysis",
          body: "Map SOC 2 controls, pages, tests, results, and exceptions to Class A requirements without claiming a universal crosswalk.",
        },
        {
          title: "Guided completion",
          body: "Develop implementation, verification, validation, ownership, and evidence records in plain language.",
        },
        {
          title: "Structured export",
          body: "Generate readable reports, package scaffolding, manifests, validated JSON, and a redacted advisor handoff.",
        },
      ],
    },
    {
      id: "workspace",
      title: "One project, ten focused work areas",
      bullets: [
        "Overview and recommended next actions",
        "Eligibility rationale and external prerequisites",
        "Cloud service offering scope",
        "SOC 2 materials and timing",
        "Class A requirements and seven dedicated Key Security Indicator workflows",
        "Evidence candidates, action planning, package generation, reports, and data settings",
      ],
      note: "The workspace uses milestones and record counts. It never reduces readiness to an unexplained compliance percentage.",
    },
    {
      id: "explainability",
      title: "Every conclusion keeps its reasoning attached",
      body: [
        "A finding shows which answers produced it, which rule applies, whether it is deterministic or suggested, and what remains unresolved.",
        "Suggested SOC 2 mappings require confirmation. Extracted report values require confirmation. A control identifier alone never completes a requirement.",
      ],
    },
    {
      id: "boundaries",
      title: "Preparation software with explicit boundaries",
      bullets: [
        "Does not certify, authorize, approve, audit, or independently assess a provider",
        "Does not guarantee eligibility, acceptance, or a successful review",
        "Does not connect to cloud infrastructure or submit an application",
        "Does not replace qualified security, assessment, or legal judgment",
      ],
    },
  ],
  cta: {
    title: "Get a useful answer before completing a full workspace.",
    body: "Start in your browser with a report, with manual answers, or with the fictional Acme Metrics example.",
    primaryLabel: "Start the free assessment",
    primaryHref: "/launch/",
    secondaryLabel: "See how it works",
    secondaryHref: "/how-it-works/",
  },
};

const howItWorksPage: StaticPageDefinition = {
  path: "/how-it-works/",
  title: "How Class A Bridge works",
  description:
    "Follow the private browser-based workflow from a SOC 2 Type II report or manual answers through scope, evidence, actions, and Class A package preparation.",
  eyebrow: "How it works",
  headline: "One understandable decision at a time.",
  intro:
    "The workflow starts with the questions that can change the direction of the project. Detailed requirement records appear after the early result, not before it.",
  sections: [
    {
      id: "start",
      eyebrow: "Step 1",
      title: "Choose the starting point that fits your team",
      cards: [
        {
          title: "Start with my SOC 2 report",
          body: "Select a local PDF. Deterministic extraction proposes report details with page references and confidence, then asks you to confirm each value.",
        },
        {
          title: "Start without uploading a report",
          body: "Use manual entry from the beginning. The product remains fully useful if the PDF is unavailable, scanned, protected, or unreadable.",
        },
        {
          title: "Explore a fictional sample",
          body: "Open Acme Metrics, a clearly watermarked demonstration with mixed progress, gaps, evidence, and generated outputs.",
        },
      ],
    },
    {
      id: "assess",
      eyebrow: "Step 2",
      title: "Receive a preliminary result after eight answers",
      body: [
        "Questions cover report type and timing, product alignment, federal-offering differences, carved-out dependencies, exceptions, cloud operation, and the federal use case.",
        "The result uses careful classifications such as likely fit, needs expert review, potential scope mismatch, or not currently eligible. It includes reasons and next actions—not a certification claim.",
      ],
    },
    {
      id: "build",
      eyebrow: "Step 3",
      title: "Define scope and develop requirement records",
      bullets: [
        "List systems, environments, data stores, identity, logging, deployment, security tooling, and third parties",
        "Identify resources handling federal customer data or affecting confidentiality, integrity, or availability",
        "Connect confirmed SOC 2 material and evidence candidates to the applicable requirement records",
        "Capture owners, dates, open questions, exceptions, approvals, and technical handoffs",
      ],
    },
    {
      id: "export",
      eyebrow: "Step 4",
      title: "Generate, validate, and prepare internal review",
      body: [
        "Generate human-readable reports and applicable JSON, review friendly validation issues, and create a versioned package snapshot.",
        "The resulting materials are a preparation scaffold. The provider remains responsible for reviewing representations, obtaining required assessments and approvals, and submitting its own application.",
      ],
    },
  ],
  cta: {
    title: "No account. No command line. No confidential upload.",
    body: "The first useful result is designed for a compliance owner, not a developer.",
    primaryLabel: "Choose a starting path",
    primaryHref: "/launch/",
    secondaryLabel: "Read the documentation",
    secondaryHref: "/docs/",
  },
};

const openSourcePage: StaticPageDefinition = {
  path: "/open-source/",
  title: "Open-source Class A preparation",
  description:
    "Learn how Ancilis maintains Class A Bridge as open-source software, separates official source material from guidance, and keeps project data portable.",
  eyebrow: "Open source",
  headline: "Inspect the software that organizes your sensitive compliance work.",
  intro:
    "The core assessment, workspace, validation, and export workflows run without a proprietary service. Teams can review the implementation, deploy static builds, and retain portable project backups.",
  sections: [
    {
      id: "license",
      title: "Apache-licensed source code",
      body: [
        "Ancilis-authored source code is released under Apache License 2.0. Repository documentation explains contribution, governance, security reporting, and release practices.",
        "Official FedRAMP material, names, marks, and third-party dependencies are identified separately and retain their own source terms.",
      ],
    },
    {
      id: "regulatory-content",
      title: "Versioned official sources, separate Ancilis guidance",
      bullets: [
        "A dated rule-catalog version and last-verified date appear in the product",
        "Vendored schema bytes are pinned with source, retrieval date, and checksum",
        "Official text is stored separately from plain-language product guidance",
        "Maintainer updates produce a readable diff and require human approval",
        "Ambiguities are preserved and flagged instead of silently reinterpreted",
      ],
    },
    {
      id: "portable",
      title: "Portable by design",
      body: [
        "A standard project bundle contains structured project data, version metadata, hashes, and selected generated outputs. Password-protected and redacted variants support different handoffs.",
        "Original reports and evidence attachments stay out of an advisor handoff unless the user explicitly selects them.",
      ],
    },
    {
      id: "contribute",
      title: "Contribute with the same care the product asks of its users",
      cards: [
        {
          title: "Report a security issue",
          body: "Use the private vulnerability-reporting process in SECURITY.md rather than a public issue.",
        },
        {
          title: "Propose a product change",
          body: "Describe the user outcome, evidence for the interpretation, accessibility impact, tests, and migration implications.",
        },
        {
          title: "Review a rule update",
          body: "Compare the pinned source, confirm official changes, and keep interpretation changes explicit and reviewable.",
        },
      ],
    },
  ],
  cta: {
    title: "Use it freely. Verify it carefully.",
    body: "Start with the product documentation or open the browser workspace.",
    primaryLabel: "Read the documentation",
    primaryHref: "/docs/",
    secondaryLabel: "Start assessment",
    secondaryHref: "/launch/",
  },
};

const securityPage: StaticPageDefinition = {
  path: "/security-and-privacy/",
  title: "Security and privacy in Class A Bridge",
  description:
    "Understand the local-first privacy boundary, browser storage, export choices, document handling, and security controls used by Class A Bridge.",
  eyebrow: "Security and privacy",
  headline: "Your assessment workspace stays on your side of the browser boundary.",
  intro:
    "SOC 2 reports, evidence, architecture descriptions, exceptions, and incident material can be sensitive. The core product is designed to process and retain them locally by default.",
  sections: [
    {
      id: "defaults",
      title: "Private by default",
      bullets: [
        "No account is required",
        "Files are processed locally and are not automatically sent to Ancilis",
        "The assessment app has no analytics, remote artificial-intelligence service, or third-party document parser",
        "Project data and attachments are not included in website analytics",
        "No assessor or advisor receives project content automatically",
      ],
      note: "Private workspace — project data stays in this browser.",
    },
    {
      id: "storage",
      title: "You control what is stored and exported",
      cards: [
        {
          title: "Browser storage",
          body: "The data panel shows the active storage method, approximate size, and most recent local save.",
        },
        {
          title: "Portable backups",
          body: "Export a standard bundle or protect a bundle with a password using browser-native cryptography.",
        },
        {
          title: "Redacted handoff",
          body: "Prepare a review summary that excludes reports, attachments, excerpts, and sensitive notes by default.",
        },
        {
          title: "Deletion",
          body: "Delete a single project or remove all local Class A Bridge data through explicit confirmation flows.",
        },
      ],
    },
    {
      id: "documents",
      title: "Document handling is deliberately constrained",
      body: [
        "The product validates file type and size, disables dynamic PDF behavior, normalizes extracted text, sanitizes displayed content, and requires confirmation of every proposed value.",
        "Unreadable, scanned, protected, malformed, or image-only documents lead to a manual entry path. The initial release does not send a file to optical character recognition or a language model.",
      ],
    },
    {
      id: "threats",
      title: "Threats treated as product requirements",
      bullets: [
        "Malicious PDFs and imported project bundles",
        "Cross-site scripting and generated-content injection",
        "ZIP traversal, duplicate paths, compression abuse, and oversized files",
        "CSV formula injection and unsafe filenames",
        "Dependency compromise, third-party scripts, and accidental disclosure",
        "Contact-form abuse without mixing the contact system with assessment data",
      ],
    },
    {
      id: "limits",
      title: "The local-first model has limits",
      body: [
        "Anyone with access to the same unlocked browser profile or device may be able to access locally stored projects. Use device controls, export protected backups, and delete local data when the environment is shared.",
        "A compromised browser, extension, device, or host can undermine application controls. Review the threat model and deployment headers before operating the software in your environment.",
      ],
    },
  ],
  cta: {
    title: "Review the privacy boundary before adding a report.",
    body: "The manual path remains available if your policy does not permit local browser processing of the source PDF.",
    primaryLabel: "Read the privacy policy",
    primaryHref: "/privacy/",
    secondaryLabel: "Start without a report",
    secondaryHref: "/launch/",
  },
};

const methodologyPage: StaticPageDefinition = {
  path: "/methodology/",
  title: "Class A Bridge methodology",
  description:
    "Review the deterministic eligibility, SOC 2 mapping, uncertainty, evidence, status, and regulatory-source methodology behind Class A Bridge.",
  eyebrow: "Methodology",
  headline: "Organize the record without manufacturing certainty.",
  intro:
    "The product combines official source records, deterministic decision logic, and Ancilis-authored guidance. It keeps those layers visible so a provider can review every representation.",
  sections: [
    {
      id: "early-result",
      title: "Early value from eight consequential questions",
      body: [
        "The first assessment intentionally stops after eight high-value questions. It classifies likely fit and potential blockers based on answers, while leaving later prerequisites in the full workspace.",
        "Each finding records supporting answer identifiers, applicable rule references, the deterministic logic used, missing information, and the evidence that could resolve uncertainty.",
      ],
    },
    {
      id: "mapping",
      title: "SOC 2 material is reusable, not universally interchangeable",
      bullets: [
        "Mappings are many-to-many across controls, criteria, pages, tests, results, exceptions, requirements, evidence, and narratives",
        "Every suggestion explains why it may be relevant and requires user confirmation",
        "Coverage distinguishes likely coverage, partial support, evidence-only support, FedRAMP-specific work, scope mismatch, no mapping, and human review",
        "A generic Trust Services Criteria reference never becomes a universal one-to-one crosswalk",
      ],
    },
    {
      id: "evidence",
      title: "Evidence remains a candidate until reviewed",
      body: [
        "The workspace tracks provenance, period, freshness, owner, sensitivity, hash, and related records. It flags age and missing context but does not decide that a document is sufficient.",
        "Requirement completion remains user-controlled. Extraction, a mapping, or an attached file cannot automatically mark a record complete.",
      ],
    },
    {
      id: "status",
      title: "Milestones instead of a readiness percentage",
      bullets: [
        "Eligibility reviewed",
        "Scope defined",
        "External assessment materials collected",
        "Mandatory requirements drafted",
        "Evidence mapped",
        "Package validated",
        "Final review unresolved",
      ],
    },
    {
      id: "sources",
      title: "Regulatory content is versioned and reviewable",
      body: [
        "Release 1.0.0 uses FedRAMP Consolidated Rules for 2026 catalog 2026.07.14.01 and pinned official schema copies dated in their filenames 2026-06-24, retrieved and checked on 2026-07-17.",
        "When official content changes, maintainers compare source bytes and normalized records, review a readable diff, update provenance, and record interpretation changes instead of silently changing product behavior.",
      ],
    },
  ],
  cta: {
    title: "See the method applied to a fictional project.",
    body: "Acme Metrics includes complete records, partial work, missing evidence, scope questions, and advisor-review flags.",
    primaryLabel: "Explore the sample workspace",
    primaryHref: "/launch/",
    secondaryLabel: "Read Class A guidance",
    secondaryHref: "/guidance/",
  },
};

const guidancePage: StaticPageDefinition = {
  path: "/guidance/",
  title: "FedRAMP 20x Class A guidance",
  description:
    "A plain-language starting guide to FedRAMP 20x Class A fit, SOC 2 Type II scope, external materials, requirements, evidence, and provider review.",
  eyebrow: "Class A guidance",
  headline: "Start with fit, timing, and scope—not a wall of control identifiers.",
  intro:
    "Class A preparation begins by confirming that the assurance report and proposed cloud service offering describe the same product reality. Detailed requirement work follows from that foundation.",
  sections: [
    {
      id: "fit",
      title: "Questions that shape a preliminary fit review",
      bullets: [
        "Is the assessment a SOC 2 Type II report, and is its coverage period current enough for the intended timeline?",
        "Does the report cover the same product, environments, and operations proposed for federal use?",
        "Would a federal configuration introduce different infrastructure, identity, operations, or third parties?",
        "Were important services carved out, and are there exceptions or timing gaps that need review?",
        "Is the product operated as a cloud service with a defined federal use case and accountable owner?",
      ],
    },
    {
      id: "scope",
      title: "Define the offering in operational language",
      body: [
        "List the systems that store or process federal customer data and the resources that can affect the service's confidentiality, integrity, or availability. Include identity, logging, deployment, security tools, customer endpoints, cloud platforms, and third-party providers.",
        "Then compare that proposed boundary with the system described by the SOC 2 report. A meaningful difference is a scope question, not a detail to hide inside a narrative.",
      ],
    },
    {
      id: "materials",
      title: "Collect the external assessment story",
      bullets: [
        "Complete SOC 2 Type II report",
        "Bridge or gap letter when timing or coverage makes one relevant",
        "Audit-engagement documentation that can be verified",
        "Expected schedule for the next report",
        "Supplemental compliance evidence when applicable",
      ],
    },
    {
      id: "requirements",
      title: "Work from outcomes to records",
      cards: [
        {
          title: "Package and prerequisites",
          body: "Confirm the program path, marketplace work, schema expectations, provider approvals, and external framework dependencies.",
        },
        {
          title: "Communications and incidents",
          body: "Prepare security inbox, access, required-action, incident evaluation, and final-reporting records.",
        },
        {
          title: "Ongoing certification",
          body: "Track report availability, next report dates, independent assessment expectations, and record freshness.",
        },
        {
          title: "Seven Key Security Indicators",
          body: "Develop implementation, verification, and validation for change logging, network restriction, training review, account automation, passwordless methods, incident response review, and information security.",
        },
      ],
    },
    {
      id: "sources",
      title: "Use official sources for official decisions",
      body: [
        "Class A Bridge displays the rule catalog and schema versions it uses. The current product registry is pinned to catalog 2026.07.14.01 and keeps official source text separate from Ancilis guidance.",
        "Official rules and schemas remain authoritative. Review the current FedRAMP source and obtain expert review where applicability, scope, evidence, or timing is uncertain.",
      ],
      cards: [
        {
          title: "Official FedRAMP 20x rules",
          body: "Review the current provider rules and applicability information at the source.",
          href: "https://www.fedramp.gov/2026/providers/20x/rules/fedramp-certification/",
          linkLabel: "Open official rules",
        },
        {
          title: "Official schema library",
          body: "Review the current JSON schema catalog and official validator guidance.",
          href: "https://www.fedramp.gov/schemas/",
          linkLabel: "Open official schemas",
        },
      ],
    },
  ],
  cta: {
    title: "Turn the guidance into a project-specific plan.",
    body: "Class A Bridge attaches each finding to your own answers and keeps unresolved questions visible.",
    primaryLabel: "Start the assessment",
    primaryHref: "/launch/",
    secondaryLabel: "Review the methodology",
    secondaryHref: "/methodology/",
  },
};

const servicesPage: StaticPageDefinition = {
  path: "/services/",
  title: "Ancilis Class A advisory services",
  description:
    "Learn where Ancilis can add professional judgment through Class A fit, scope, SOC 2 mapping, package, implementation, maintenance, and Class B planning services.",
  eyebrow: "Ancilis services",
  headline: "Get organized with the software. Get judgment where it matters.",
  intro:
    "The open-source product is useful on its own. Ancilis services are available when your company wants an experienced review of interpretation, implementation, evidence, or package quality.",
  sections: [
    {
      id: "services",
      title: "Focused support at the points where context matters",
      cards: [
        {
          title: "Class A fit and scope review",
          body: "Review report timing, the proposed federal offering, boundary questions, third parties, exceptions, and likely blockers.",
        },
        {
          title: "SOC 2 mapping review",
          body: "Challenge suggested coverage, distinguish reusable assurance material from program-specific work, and document the rationale.",
        },
        {
          title: "Class A package sprint",
          body: "Work through open records, strengthen narratives, resolve placeholders, validate structured outputs, and prepare internal review.",
        },
        {
          title: "Security implementation support",
          body: "Help product and engineering teams close clearly defined implementation or verification gaps without taking over the provider's representations.",
        },
        {
          title: "Ongoing certification maintenance",
          body: "Establish owners, evidence rhythms, report dates, change review, and internal checkpoints for the continuing record.",
        },
        {
          title: "Class B planning",
          body: "Use the Class A work as an input to a separate, scoped planning exercise. Class A Bridge itself is not a complete Class B product.",
        },
      ],
    },
    {
      id: "when",
      title: "Good reasons to request a review",
      bullets: [
        "The SOC 2 scope and proposed federal offering do not clearly match",
        "Material auditor exceptions or carved-out services need interpretation",
        "Third-party services may change the boundary",
        "Several records remain marked needs expert review",
        "Generated narratives contain unresolved provider representations",
        "Report freshness and the application timeline may conflict",
        "Executive acceptance or a final package review is approaching",
      ],
    },
    {
      id: "privacy",
      title: "A contact request does not share your workspace",
      body: [
        "The advisory call to action opens a separate contact flow. It sends only the contact details and optional summary you approve.",
        "If a later engagement requires project material, you choose what to share through a separate secure intake. Clicking the call to action never sends the SOC 2 report, evidence, answers, or project records.",
      ],
    },
    {
      id: "message",
      title: "Software can organize the record.",
      note: "Ancilis can help validate the interpretation, close implementation gaps, and review the package before your company applies.",
    },
  ],
  cta: {
    title: "Bring the questions that are still unresolved.",
    body: "Request a contact-only conversation or prepare a redacted advisor handoff in the application first.",
    primaryLabel: "Request an Ancilis Class A readiness review",
    primaryHref: "/contact/",
    secondaryLabel: "Use the free product",
    secondaryHref: "/launch/",
  },
};

const faqPage: StaticPageDefinition = {
  path: "/faq/",
  title: "Class A Bridge frequently asked questions",
  description:
    "Get direct answers about eligibility, certification boundaries, local browser storage, report handling, open source, submission, other classes, and Ancilis review.",
  eyebrow: "Frequently asked questions",
  headline: "Clear answers before you put sensitive work into the browser.",
  intro:
    "These answers describe the product boundary for version 1.0. Official program rules and qualified reviewers remain authoritative for provider-specific decisions.",
  sections: [],
  cta: {
    title: "Still deciding whether Class A fits?",
    body: "The free assessment produces a preliminary result without an account or exhaustive data entry.",
    primaryLabel: "Start the free assessment",
    primaryHref: "/launch/",
    secondaryLabel: "Read Class A guidance",
    secondaryHref: "/guidance/",
  },
};

const docsPage: StaticPageDefinition = {
  path: "/docs/",
  title: "Class A Bridge documentation",
  description:
    "Learn how to start, manage local data, work with a SOC 2 report, build scope and requirement records, create exports, and troubleshoot Class A Bridge.",
  eyebrow: "Documentation",
  headline: "A practical guide for the person responsible for the compliance program.",
  intro:
    "You do not need developer tools, an account, or prior FedRAMP terminology. Each workspace section explains what to decide, why it matters, and who usually knows the answer.",
  sections: [
    {
      id: "quick-start",
      title: "Quick start",
      bullets: [
        "Choose a report, manual, or fictional sample starting path",
        "Answer the eight preliminary questions and read the reasons behind the result",
        "Confirm the offering and compare it with the SOC 2 system description",
        "Collect external assessment materials and assign open requirement records",
        "Map evidence candidates, generate an action plan, and validate package outputs",
      ],
    },
    {
      id: "reports",
      title: "Working with a SOC 2 report",
      body: [
        "A selected PDF stays in the browser. Deterministic parsing may propose report type, issuer, period, product, criteria, controls, subservice organizations, exceptions, user controls, and bridge references.",
        "Confirm, edit, or ignore every candidate. If the file cannot be read, choose manual entry and continue without losing the project.",
      ],
    },
    {
      id: "project-data",
      title: "Local projects and backups",
      cards: [
        {
          title: "Save",
          body: "Projects save to supported browser storage on the current device and browser profile.",
        },
        {
          title: "Back up",
          body: "Download a standard .classabridge bundle before clearing browser data or moving devices.",
        },
        {
          title: "Protect",
          body: "Create a password-protected export when the backup needs an additional confidentiality layer.",
        },
        {
          title: "Delete",
          body: "Use Project settings to delete the active project or every local project owned by the app.",
        },
      ],
    },
    {
      id: "exports",
      title: "What exports mean",
      bullets: [
        "Reports are preparation materials, not FedRAMP determinations",
        "Structurally complete means required document fields are populated, not that the content has been accepted",
        "Evidence candidates require human review for relevance and sufficiency",
        "Package validation checks structure and pinned schemas; it does not approve the provider's representations",
        "A final-review snapshot is immutable, but the provider still owns approval and submission",
      ],
    },
    {
      id: "troubleshooting",
      title: "Common recovery paths",
      cards: [
        {
          title: "The PDF is unreadable",
          body: "Check the size and file type, then continue with manual report details. Image-only and password-protected files are not sent elsewhere for processing.",
        },
        {
          title: "Storage is unavailable",
          body: "The app explains the active fallback and its attachment limitations. Export a project bundle regularly.",
        },
        {
          title: "JSON does not validate",
          body: "Open the friendly issue, follow its link to the editable field, compare expected and current values, and regenerate.",
        },
        {
          title: "A rule looks ambiguous",
          body: "Review official details and source version, record the uncertainty, and seek expert review rather than silently choosing an interpretation.",
        },
      ],
    },
    {
      id: "browser-support",
      title: "Browser support",
      body: [
        "The primary workflow targets current major desktop browsers and a tablet-compatible layout. Desktop is recommended for report review and package work.",
        "The progressive web app can work offline after its initial successful load. Keep an exported backup; clearing site data removes local projects.",
      ],
    },
  ],
  cta: {
    title: "Learn the product by exploring a safe example.",
    body: "The fictional Acme Metrics project includes guidance, mixed statuses, evidence gaps, actions, and sample outputs.",
    primaryLabel: "Open the fictional sample",
    primaryHref: "/launch/",
    secondaryLabel: "Review security and privacy",
    secondaryHref: "/security-and-privacy/",
  },
};

const releaseNotesPage: StaticPageDefinition = {
  path: "/release-notes/",
  title: "Class A Bridge release notes",
  description:
    "Review the Class A Bridge 1.0.0 release scope, pinned regulatory sources, local-first capabilities, quality boundary, and known non-blocking limitations.",
  eyebrow: "Release notes",
  headline: "Version 1.0.0 — the complete Class A preparation foundation.",
  intro:
    "Released July 17, 2026. This first public release provides a no-account, local-first assessment and guided preparation workspace for FedRAMP 20x Class A.",
  sections: [
    {
      id: "included",
      title: "Included in 1.0.0",
      bullets: [
        "Eight-question preliminary eligibility assessment with explainable results",
        "Local deterministic SOC 2 PDF parsing with manual fallback and confirmation",
        "Guided scope, materials, requirement, seven-KSI, evidence, mapping, and action-plan workflows",
        "Human-readable package artifacts, pinned-schema JSON validation, and final-review snapshots",
        "Standard, password-protected, and redacted advisor project exports",
        "Complete fictional Acme Metrics sample and static marketing, guidance, legal, and documentation site",
      ],
    },
    {
      id: "sources",
      title: "Pinned source versions",
      body: [
        "Rule registry: FedRAMP Consolidated Rules for 2026 catalog 2026.07.14.01, verified July 17, 2026.",
        "Schema registry: eleven official schema files dated 2026-06-24 in their filenames, retrieved July 17, 2026, with recorded checksums and no local changes to vendored bytes.",
      ],
    },
    {
      id: "limits",
      title: "Known non-blocking limitations",
      bullets: [
        "No optical character recognition for scanned or image-only PDF pages",
        "No collaborative cloud sync, accounts, or multi-user server workspace",
        "No cloud-provider integrations or automated evidence collection",
        "No automated FedRAMP application submission",
        "Class B and Class C preparation are outside the 1.0 product scope",
      ],
    },
  ],
  cta: {
    title: "Start with the release as shipped.",
    body: "The core product remains useful when no optional contact service is configured.",
    primaryLabel: "Start the assessment",
    primaryHref: "/launch/",
    secondaryLabel: "Read the documentation",
    secondaryHref: "/docs/",
  },
};

const privacyPage: StaticPageDefinition = {
  path: "/privacy/",
  title: "Class A Bridge privacy policy",
  description:
    "Read how the Class A Bridge website, local-first assessment application, optional contact flow, browser storage, diagnostics, and exports handle data.",
  eyebrow: "Privacy policy",
  headline: "The assessment workspace is designed not to collect your project data.",
  intro:
    "Effective July 17, 2026. This policy distinguishes the public website, the local-first assessment application, and the optional contact channel.",
  sections: [
    {
      id: "app",
      title: "Assessment application",
      body: [
        "Project answers, source reports, control mappings, evidence metadata, attachments, generated narratives, and package outputs are processed and stored in your browser during normal use. The application does not send them to Ancilis automatically.",
        "The application has no assessment analytics, remote artificial-intelligence processing, or third-party document parser. It does not fingerprint users.",
      ],
    },
    {
      id: "website",
      title: "Public website",
      body: [
        "This static website can be operated without analytics. A deployer may enable privacy-conscious, configurable website analytics, but it must remain outside the assessment workspace and must not collect document names, answers, progress, or evidence metadata.",
        "A hosting provider may process ordinary network information such as IP address, request time, path, and user agent to deliver and secure the site. Review the deployer's hosting notice for its retention practices.",
      ],
    },
    {
      id: "contact",
      title: "Contact and advisory requests",
      body: [
        "The optional contact flow can collect name, work email, company, role, message, and an optional summary that you affirmatively approve. It does not read the assessment workspace.",
        "Do not paste a SOC 2 report, evidence content, credentials, incident details, or other sensitive project material into the contact form. A later secure intake is a separate, deliberate step.",
      ],
    },
    {
      id: "control",
      title: "Your controls",
      bullets: [
        "Inspect the data-management panel and local storage estimate",
        "Export a portable or password-protected backup",
        "Create a redacted handoff with explicit attachment selection",
        "Delete an individual project or all local application data",
        "Clear site data through browser settings when decommissioning a device or profile",
      ],
    },
    {
      id: "security",
      title: "Security and retention",
      body: [
        "Local data remains until you delete it, clear browser storage, or a browser/device policy removes it. Ancilis cannot restore a project that never left your browser.",
        "Contact information is retained only as needed to respond, maintain business records, protect the service, and meet applicable obligations. A production deployer should publish its contact endpoint retention details.",
      ],
    },
    {
      id: "changes",
      title: "Changes and questions",
      body: [
        "Material policy changes should be dated in release notes. Privacy questions or requests about contact information can be sent through the contact page.",
      ],
    },
  ],
};

const termsPage: StaticPageDefinition = {
  path: "/terms/",
  title: "Class A Bridge terms of use",
  description:
    "Review the terms for using Class A Bridge, including open-source licensing, acceptable use, provider responsibility, official sources, and warranty limitations.",
  eyebrow: "Terms of use",
  headline: "Use the software as a preparation aid, with provider review.",
  intro:
    "Effective July 17, 2026. These website terms supplement, but do not replace, the licenses and notices shipped with the open-source repository.",
  sections: [
    {
      id: "license",
      title: "Software license and third-party material",
      body: [
        "Ancilis-authored source code is provided under the license included with the repository. Official FedRAMP materials, third-party libraries, names, and marks remain subject to their applicable rights and notices.",
      ],
    },
    {
      id: "use",
      title: "Appropriate use",
      bullets: [
        "Use the product lawfully and do not misrepresent its output as government approval",
        "Do not use the optional contact service to transmit malicious code, credentials, or confidential assessment documents",
        "Do not interfere with, overload, or attempt to bypass protections on a hosted contact endpoint",
        "Preserve required license, attribution, trademark, and disclaimer notices in distributions",
      ],
    },
    {
      id: "responsibility",
      title: "Provider responsibility",
      body: [
        "You are responsible for the accuracy, completeness, authorization, retention, review, approval, and submission of your company's project data and representations. Confirm current official rules and schema versions before relying on generated materials.",
        "Back up projects you need to retain. Local browser data can be removed by browser settings, device policies, storage pressure, or user action.",
      ],
    },
    {
      id: "warranty",
      title: "No warranty or guaranteed outcome",
      body: [
        "The software is provided under the warranty and liability terms in its license. It does not promise eligibility, completeness, legal sufficiency, assessment results, government acceptance, continuous availability, or error-free output.",
      ],
    },
    {
      id: "changes",
      title: "Changes",
      body: [
        "Product and terms changes should be documented through versioned releases. Continuing to use a hosted site after an effective-date update indicates acceptance of the updated website terms, subject to applicable law.",
      ],
    },
  ],
};

const disclaimerPage: StaticPageDefinition = {
  path: "/disclaimer/",
  title: "Class A Bridge project disclaimer",
  description:
    "Understand the Class A Bridge relationship to Ancilis, GSA, FedRAMP, certification, legal advice, independent assessment, submission, and provider approval.",
  eyebrow: "Disclaimer",
  headline: "Preparation support is not a FedRAMP determination.",
  intro:
    "Class A Bridge is maintained by Ancilis. It is an independent open-source preparation product with explicit limits.",
  sections: [
    {
      id: "affiliation",
      title: "No government affiliation or endorsement",
      body: [
        "The project is not affiliated with, endorsed by, certified by, or operated on behalf of the U.S. General Services Administration or FedRAMP. Use of descriptive program names does not imply sponsorship.",
      ],
    },
    {
      id: "not-provided",
      title: "What the project does not provide",
      bullets: [
        "FedRAMP certification, authorization, approval, or a determination of eligibility",
        "Legal advice or a legal conclusion",
        "An independent assessment or a replacement for an assessor",
        "A guarantee of completeness, acceptance, timing, or review outcome",
        "Automated application submission or representation on the provider's behalf",
      ],
    },
    {
      id: "provider-review",
      title: "Provider review is required",
      body: [
        "The provider must review and approve all representations, confirm scope and evidence, obtain required independent work, resolve placeholders and uncertainties, and submit its own application through the applicable official process.",
        "Official FedRAMP rules and schemas control when they differ from Ancilis guidance or product behavior. Regulatory content can change after a software release.",
      ],
    },
    {
      id: "sample",
      title: "Fictional sample data",
      body: [
        "Acme Metrics and its reports, controls, evidence, exceptions, people, systems, and outputs are fictional. Sample outputs are watermarked “Fictional example — not for submission.”",
      ],
    },
  ],
};

const trademarkPage: StaticPageDefinition = {
  path: "/trademark/",
  title: "Class A Bridge trademark policy",
  description:
    "Review fair-use guidance for the Class A Bridge and Ancilis names, FedRAMP and GSA references, forks, distributions, endorsements, and project attribution.",
  eyebrow: "Trademark policy",
  headline: "Open source does not create an endorsement right.",
  intro:
    "This policy explains how to identify the project accurately while keeping source-code rights separate from names, logos, and marks.",
  sections: [
    {
      id: "descriptive-use",
      title: "Descriptive use",
      body: [
        "You may accurately state that software is based on or compatible with Class A Bridge, subject to the repository license and applicable trademark law. Do not imply that Ancilis reviewed, supports, or approves a modified distribution unless it has agreed in writing.",
      ],
    },
    {
      id: "forks",
      title: "Forks and modified distributions",
      bullets: [
        "Choose a distinct product name and visual identity for a materially modified distribution",
        "State clearly that the distribution is modified and identify its maintainer",
        "Do not use Ancilis branding as the primary branding for another service or product",
        "Preserve required source-license and notice files without turning attribution into an endorsement claim",
      ],
    },
    {
      id: "government-marks",
      title: "Government names and marks",
      body: [
        "FedRAMP and GSA names may be used descriptively to explain the subject of the product. Do not use government seals, FedRAMP logos, official badges, or similar imagery in a way that suggests approval, certification, affiliation, or authority.",
      ],
    },
    {
      id: "questions",
      title: "Questions and permission requests",
      body: [
        "Use the contact page for a trademark question or a request that falls outside ordinary descriptive use.",
      ],
    },
  ],
};

const contactPage: StaticPageDefinition = {
  path: "/contact/",
  title: "Contact Ancilis about Class A readiness",
  description:
    "Request an Ancilis Class A readiness review with contact details and an optional approved summary, without sending assessment workspace data or documents.",
  eyebrow: "Contact Ancilis",
  headline: "Request a Class A readiness review without sharing your workspace.",
  intro:
    "The contact flow is separate from the assessment application. Nothing from a local project is read or sent when you open this page.",
  sections: [
    {
      id: "before-you-send",
      title: "Send the minimum useful context",
      bullets: [
        "Your name, work email, company, and role",
        "A short description of the decision or review you need",
        "An optional summary only if you deliberately approve it",
      ],
      note: "Do not paste confidential report excerpts, evidence, credentials, incident details, or regulated customer data into this form.",
    },
    {
      id: "later-sharing",
      title: "Project sharing is a separate decision",
      body: [
        "If a conversation leads to a review engagement, Ancilis can provide a separate secure intake. You can first generate a redacted advisor handoff and decide whether any original documents are necessary.",
      ],
    },
  ],
};

const launchPage: StaticPageDefinition = {
  path: "/launch/",
  title: "Start the Class A Bridge assessment",
  description:
    "Open the private Class A Bridge workspace with a local SOC 2 report, with manual answers, or through the complete fictional Acme Metrics sample project.",
  eyebrow: "Start assessment",
  headline: "Choose how you want to begin.",
  intro:
    "Each path opens the same local-first browser application. No account is required, and project content is not sent to Ancilis during normal use.",
  sections: [
    {
      id: "paths",
      title: "Three ways into the workspace",
      cards: [
        {
          title: "Start with my SOC 2 report",
          body: "Choose a PDF from this device. The application processes it locally, proposes metadata, and asks you to confirm every extracted value.",
          href: "/app/?start=report",
          linkLabel: "Choose a local report",
        },
        {
          title: "Start without uploading a report",
          body: "Answer the preliminary questions now and add report details manually when they are available.",
          href: "/app/?start=manual",
          linkLabel: "Start manually",
        },
        {
          title: "Explore a fictional sample workspace",
          body: "Open Acme Metrics, a populated demonstration that is clearly marked and watermarked as fictional.",
          href: "/app/?start=sample",
          linkLabel: "Explore Acme Metrics",
        },
      ],
      note: "Private workspace — project data stays in this browser.",
    },
    {
      id: "expect",
      title: "What to expect in the first few minutes",
      bullets: [
        "Eight plain-language questions before the first result",
        "A likely-fit classification with reasons, blockers, uncertainties, and three actions",
        "The ability to change an answer and see why the result changed",
        "A complete guided workspace available immediately after the early result",
      ],
    },
  ],
};

export const allStaticPages: readonly StaticPageDefinition[] = [
  productPage,
  howItWorksPage,
  openSourcePage,
  securityPage,
  methodologyPage,
  guidancePage,
  servicesPage,
  faqPage,
  docsPage,
  releaseNotesPage,
  privacyPage,
  termsPage,
  disclaimerPage,
  trademarkPage,
  contactPage,
  launchPage,
];

export const pageByPath = new Map(allStaticPages.map((page) => [page.path, page] as const));

export function requirePage(path: string): StaticPageDefinition {
  const page = pageByPath.get(path);
  if (!page) throw new Error(`Static page content is missing: ${path}`);
  return page;
}
