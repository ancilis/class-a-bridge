# Content and accessibility guide

## Voice and claims

Write for an informed business user who may know SOC 2 but not FedRAMP. Use direct verbs, short sentences, and concrete owners/evidence. Expand an acronym on first use in each independent document or flow.

Use “likely fit,” “potential blocker,” “needs confirmation,” “needs expert review,” “evidence candidate,” “requirement drafted,” “structurally complete,” “unresolved,” “application preparation complete,” and “package scaffold generated” only when supported by visible reasons.

Never say or imply that the user is FedRAMP compliant, certified, approved, guaranteed eligible, guaranteed to pass, or submission-ready because software fields are complete. Do not call Ancilis guidance an official rule. Do not invent legal conclusions, testimonials, customer logos, metrics, case studies, audit marks, or government endorsement.

Prefer “List the systems that store federal customer data” over a rule identifier as the primary instruction. Put identifiers, official text, JSON fields, and metadata under “View official details” or “Advanced.”

## Explainability pattern

Every generated conclusion should answer:

1. What did the product conclude?
2. Which user answers/records led to it?
3. Which official rule applies?
4. Is it deterministic or a suggestion?
5. What remains for human review?
6. What evidence could resolve uncertainty?
7. What is the next action?

Use milestone counts such as “18 of 23 mandatory requirement records have complete drafts,” not a compliance percentage.

## Forms and guided questions

Each high-value question includes a visible label, why it matters, example, generally strong answer, likely organizational owner, blocker potential, and “Not sure.” Keep one understandable decision at a time. Preserve user input after a validation error. Error summaries link to invalid fields; field errors state what to do.

Destructive actions name the scope (“Delete Acme Metrics from this browser”), state permanence and export recovery, require explicit confirmation, restore focus on cancel, and announce completion.

## WCAG 2.2 AA implementation checklist

- One `h1`; ordered semantic headings and landmark regions.
- Skip link to main content.
- Native controls/links before custom roles; every field has a programmatic label.
- Keyboard access without traps; dialogs trap focus while open and restore it on close.
- Visible focus indicator with sufficient contrast and no clipping.
- Status, error, freshness, and sensitivity use text/icon labels in addition to color.
- State changes use a polite live region; blocking errors use an appropriate alert without repeated announcements.
- Pointer targets meet the 24 by 24 CSS pixel minimum, with larger primary actions.
- Text and interface contrast meet AA in default, hover, focus, disabled, print, and high-contrast contexts.
- Content works at 200% browser zoom and 320 CSS pixel reflow without two-dimensional scrolling except genuine document/table regions.
- Motion honors `prefers-reduced-motion`; no essential information depends on animation.
- Dialog/disclosure/menu state uses correct accessible name, role, expanded/selected/current semantics.
- Tables have captions/headers; diagrams have useful text alternatives; decorative art is hidden.
- Time limits are absent. Autosave does not steal focus or announce continuously.
- Print output retains headings, URLs where useful, status text, disclaimer, version, and sample watermark.

Automated axe checks are necessary but not sufficient. Manually test the main flow using keyboard only and at least one screen reader/browser combination before release.

## Glossary wording

- **Cloud service offering:** The product, environments, systems, people, and services presented as one cloud service.
- **Certification package:** The provider's structured set of representations and supporting records for the applicable process.
- **Class A:** A FedRAMP 20x certification path with its current official applicability and requirements.
- **Key Security Indicator:** A required security outcome with implementation, verification, and validation records.
- **Verification:** Checking that an implementation or representation matches defined criteria.
- **Validation:** Evaluating whether the result supports the intended security outcome in context.
- **Independent assessment:** Review performed by a qualified party independent of the implementation owner, where required.
- **Trust center:** A controlled method for publishing or sharing security/compliance information.
- **Ongoing Certification Report:** A structured record used for applicable ongoing certification information.
- **Security Decision Record:** A structured record of a security decision and supporting basis.
- **Federal customer data:** Data handled for a federal customer/use case within or through the offering.
- **Information resource:** A system, service, component, data store, or capability relevant to the offering.
- **Subservice organization:** A third party whose services form part of, or support, the described system.
- **Bridge letter:** A document addressing the period between a report's coverage and a later point, subject to reviewer confirmation.

Definitions are plain-language orientation, not substitutes for official definitions or legal advice.
