import type { FaqItem, FooterGroup, GlossaryTerm, NavItem } from "./types";

export const productName = "Class A Bridge by Ancilis";
export const siteName = "Class A Bridge";
export const siteDescription =
  "A local-first, open-source FedRAMP 20x Class A workspace with deterministic, human-confirmed SOC 2 reuse suggestions, gap analysis, and package validation.";

export const siteNavigation: readonly NavItem[] = [
  { label: "Product", href: "/product/" },
  { label: "How it works", href: "/how-it-works/" },
  { label: "Open source", href: "/open-source/" },
  { label: "Security and privacy", href: "/security-and-privacy/" },
  { label: "Guidance", href: "/guidance/" },
  { label: "Ancilis services", href: "/services/" },
  { label: "Start assessment", href: "/launch/", emphasis: true },
];

export const homepage = {
  hero: {
    eyebrow: "Open-source FedRAMP 20x preparation",
    title: "Turn your SOC 2 Type II into a clear FedRAMP Class A plan.",
    description:
      "See what your existing SOC 2 program may support, identify what is still missing, and prepare a structured FedRAMP 20x Class A workspace. No account, no SDK, and no confidential document upload.",
    primaryCta: "Start the free assessment",
    secondaryCta: "Explore the sample workspace",
    trustLine: "Open source · Local-first · Built for compliance teams",
  },
  problem: {
    eyebrow: "A useful starting point",
    title: "A SOC 2 report answers important questions. It does not answer all of these.",
    intro:
      "Class A Bridge turns an existing assessment into a structured review without pretending the two programs are interchangeable.",
    points: [
      "Whether the assessed system matches the cloud service offering proposed for federal use",
      "Which Class A requirements call for additional processes or provider decisions",
      "What evidence is missing, stale, or still needs a qualified reviewer",
      "How to organize the resulting narratives, mappings, and package scaffold",
    ],
  },
  reuseModel: {
    eyebrow: "SOC 2 reuse with judgment intact",
    title: "A SOC 2 reuse accelerator—not a universal crosswalk.",
    intro:
      "Class A Bridge does not apply a universal crosswalk. Its deterministic suggestion engine runs locally in your browser and evaluates the control information your team confirms.",
    points: [
      {
        title: "Suggestions use your actual record",
        body: "Review likely relationships using confirmed criteria, control descriptions, scope, audit period, test results, exceptions, and carve-outs.",
      },
      {
        title: "Every suggestion explains why",
        body: "See the matching playbook, relevant criterion, source excerpt, alignment checks, conflicts, and information still missing.",
      },
      {
        title: "Your team confirms every mapping",
        body: "Accept partial support, reject a relationship, record a mismatch, or request expert review. A suggestion never completes a requirement.",
      },
    ],
    note: "The mapping engine does not use artificial intelligence, make opaque decisions, or send control content to a remote service.",
  },
  outcomes: [
    {
      title: "Fit and eligibility assessment",
      body: "See a preliminary classification after eight focused questions, with reasons, possible blockers, and three next actions.",
    },
    {
      title: "SOC 2 reuse and gap report",
      body: "Inventory actual controls, review explainable reuse suggestions, and separate confirmed support from scope, period, exception, and FedRAMP-specific gaps.",
    },
    {
      title: "Guided requirement workspace",
      body: "Work through plain-language prompts, implementation narratives, verification, validation, ownership, and open questions.",
    },
    {
      title: "Evidence and action plan",
      body: "Catalog evidence candidates locally and turn unresolved work into prioritized, assignable actions.",
    },
    {
      title: "Package scaffold",
      body: "Generate organized human-readable materials, manifests, open-item reports, and a package index.",
    },
    {
      title: "Machine-readable validation",
      body: "Validate applicable JSON against pinned schema copies and trace errors back to the field that needs attention.",
    },
    {
      title: "Advisor handoff bundle",
      body: "Create a redacted review bundle without including source reports or attachments unless you select them.",
    },
  ],
  steps: [
    {
      number: "01",
      title: "Start with your report—or answer manually",
      body: "Choose a local PDF, skip the file entirely, or explore a fully fictional workspace. No account wall.",
    },
    {
      number: "02",
      title: "Confirm eligibility and scope",
      body: "Review product alignment, report timing, carved-out services, exceptions, and the proposed federal use case.",
    },
    {
      number: "03",
      title: "Review reuse opportunities and gaps",
      body: "Confirm or reject explainable SOC 2 mapping suggestions, then connect evidence candidates, owners, and follow-up work.",
    },
    {
      number: "04",
      title: "Generate and validate materials",
      body: "Build a structured preparation package, resolve validation issues, and create a snapshot for internal review.",
    },
  ],
  complianceTeamPoints: [
    "Plain-language guidance before official identifiers",
    "No technical setup or infrastructure integrations required",
    "Official rule details available through progressive disclosure",
    "Clear prompts for engineering, legal, operations, and executive owners",
    "Milestone progress instead of an unexplained compliance score",
    "Every conclusion shows its inputs, rule basis, uncertainty, and next action",
  ],
  privacyPoints: [
    "Files are processed in the browser and are not automatically uploaded to Ancilis",
    "The assessment workspace has no analytics and no remote artificial-intelligence service",
    "Projects can be exported, password-protected, restored, redacted, or deleted",
    "Source code is available for review and the core product requires no proprietary service",
  ],
  serviceMessage:
    "Software can organize and accelerate the record. Ancilis can help validate the interpretation, close implementation gaps, and review the package before your company applies.",
} as const;

export const faqItems: readonly FaqItem[] = [
  {
    question: "Does this make us FedRAMP certified?",
    answer:
      "No. Class A Bridge helps your company prepare and organize its own record. It does not certify, authorize, approve, independently assess, or determine acceptance.",
  },
  {
    question: "Does a SOC 2 Type II guarantee Class A eligibility?",
    answer:
      "No. Report type and timing matter, but so do product scope, audit coverage, exceptions, external assessment materials, and the offering your company plans to provide to federal customers.",
  },
  {
    question: "Does Ancilis receive our SOC 2 report?",
    answer:
      "Not through the assessment application. If you choose a PDF, the browser processes it locally. Contacting Ancilis sends only the contact details and optional summary you explicitly approve.",
  },
  {
    question: "Where is project data stored?",
    answer:
      "Project records are stored in this browser using local browser storage. You can inspect storage information, export a backup, and delete a project or all local Class A Bridge data.",
  },
  {
    question: "Can we use the tool without uploading a report?",
    answer:
      "Yes. The manual path provides the same guided assessment and workspace. You can add report metadata, controls, pages, and evidence references as you go.",
  },
  {
    question: "Is the project open source?",
    answer:
      "Yes. Ancilis maintains the project as open-source software. Authored source code is released under Apache License 2.0; official third-party materials retain their own terms and provenance.",
  },
  {
    question: "Can it submit our application?",
    answer:
      "No. The product generates preparation materials and reminds the provider to review, approve, and submit its own application through the applicable official process.",
  },
  {
    question: "Is it only for AI vendors?",
    answer:
      "No. It is designed for cloud software providers, including SaaS, PaaS, hosted APIs, data platforms, developer platforms, workflow products, and cybersecurity products.",
  },
  {
    question: "Does it support Class B or Class C?",
    answer:
      "Version 0.9.0 Public Beta focuses on Class A preparation. The workspace can help organize early thinking, but it is not a complete Class B or Class C product.",
  },
  {
    question: "Can Ancilis review the result?",
    answer:
      "Yes. You can request a readiness review using contact details only and separately download a redacted advisor handoff. Nothing from the project is sent when you open the advisory contact flow.",
  },
  {
    question: "Does it use a universal SOC 2-to-FedRAMP crosswalk?",
    answer:
      "No. The deterministic engine suggests possible support from your actual control record, including scope, audit period, test results, exceptions, and carve-outs. Your team reviews the explanation and confirms, narrows, or rejects every mapping.",
  },
  {
    question: "Does it use artificial intelligence to suggest mappings?",
    answer:
      "No. Suggestions come from deterministic rules and versioned mapping playbooks with visible review status, all running locally in your browser. The product shows why each relationship was suggested and never treats it as confirmed without your decision.",
  },
];

export const glossaryTerms: readonly GlossaryTerm[] = [
  {
    term: "Cloud service offering",
    definition:
      "The specific hosted product, service, environments, people, processes, and technology being described for federal use.",
  },
  {
    term: "Certification package",
    definition:
      "The organized set of provider representations, supporting records, and machine-readable documents used in the applicable FedRAMP process.",
  },
  {
    term: "Class A",
    definition:
      "A FedRAMP 20x certification path with its own applicability rules, package expectations, and ongoing requirements.",
  },
  {
    term: "Key Security Indicator",
    definition:
      "A security outcome that the provider explains through implementation, verification, validation, and supporting evidence.",
  },
  {
    term: "Verification",
    definition:
      "Work performed to check that a described security capability exists or behaves as represented.",
  },
  {
    term: "Validation",
    definition:
      "Work performed to evaluate whether the capability and its verification support the required security outcome.",
  },
  {
    term: "Independent assessment",
    definition:
      "An evaluation performed by a qualified party with the required independence. The software does not perform this role.",
  },
  {
    term: "Trust center",
    definition:
      "A controlled or public location used to share security, privacy, compliance, and assurance information with appropriate audiences.",
  },
  {
    term: "Ongoing Certification Report",
    definition:
      "A recurring structured report used to communicate defined security and certification information after initial work.",
  },
  {
    term: "Security Decision Record",
    definition:
      "A structured record of security decisions, supporting rationale, representations, and associated review information.",
  },
  {
    term: "Federal customer data",
    definition:
      "Information a federal customer provides, creates, stores, processes, or transmits through the proposed offering.",
  },
  {
    term: "Information resource",
    definition:
      "A system, service, component, data store, tool, or other resource that supports or can affect the offering.",
  },
  {
    term: "Subservice organization",
    definition:
      "A third-party organization whose services are relevant to the system described by a SOC 2 report.",
  },
  {
    term: "Bridge letter",
    definition:
      "A time-bounded representation that can help address the period between an assurance report and a later review date; its need and suitability require review.",
  },
];

export const footerGroups: readonly FooterGroup[] = [
  {
    title: "Product",
    links: [
      { label: "Product", href: "/product/" },
      { label: "How it works", href: "/how-it-works/" },
      { label: "Security and privacy", href: "/security-and-privacy/" },
      { label: "Start assessment", href: "/launch/" },
    ],
  },
  {
    title: "Learn",
    links: [
      { label: "Methodology", href: "/methodology/" },
      { label: "Class A guidance", href: "/guidance/" },
      { label: "Documentation", href: "/docs/" },
      { label: "FAQ", href: "/faq/" },
      { label: "Release notes", href: "/release-notes/" },
    ],
  },
  {
    title: "Ancilis",
    links: [
      { label: "Open source", href: "/open-source/" },
      { label: "Services", href: "/services/" },
      { label: "Contact", href: "/contact/" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy/" },
      { label: "Terms", href: "/terms/" },
      { label: "Disclaimer", href: "/disclaimer/" },
      { label: "Trademark", href: "/trademark/" },
    ],
  },
];

export const verticalLandingPageTemplate = {
  requiredFields: [
    "audienceName",
    "audienceContext",
    "scopeQuestions",
    "evidenceExamples",
    "handoffOwners",
  ],
  sectionOrder: [
    "audience problem",
    "Class A fit questions",
    "SOC 2 reuse boundaries",
    "guided workflow",
    "privacy",
    "next action",
  ],
  invariantMessage:
    "The vertical context may change; the product remains a general FedRAMP 20x Class A preparation workspace.",
} as const;
