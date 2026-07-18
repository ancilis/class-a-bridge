# SOC 2 Reuse Accelerator Design

## Product rule

Suggest likely support; require the user to confirm the actual control, scope, period, test result, exceptions, carve-outs, and evidence. A suggestion never completes or approves a requirement and never becomes a provider representation.

## Components

1. **Control inventory:** backward-compatible structured control records populated manually, from local PDF suggestions, CSV/paste, or the fictional sample.
2. **Draft playbooks:** versioned Ancilis editorial records keyed by rule, visibly separated from official text and marked with an honest content-review status.
3. **Deterministic engine:** pure rules over confirmed Trust Services Criteria, normalized text tokens, scope, period, results, exceptions, treatment, and playbook patterns.
4. **Review workspace:** dedicated navigation showing suggestions, basis, conflicts, missing information, and individual confirm/reject/partial/expert-review actions.
5. **Reuse report:** safe HTML/print plus CSV matrix and mapping provenance for package/advisor inclusion.

## Suggestion model

Qualitative levels are `strong_candidate`, `possible_candidate`, `insufficient_information`, `potential_conflict`, and `expert_review_suggested`. Explanations list matched criteria/patterns, scope/period status, test-result and exception status, source excerpt, playbook version, and missing information. No percentages are used.

## Persistence and compatibility

New control/mapping fields are optional or migrated with conservative defaults. Existing exports remain readable. Only confirmed mappings with reviewer provenance may enter generated narratives; suggestions remain derived and can be regenerated from the pinned playbooks.

## UI boundary

The existing SOC 2 materials function is extracted from `App.tsx` into a feature module. The new SOC 2 reuse route consumes the same `BridgeProject` and `update(recipe)` contract, preserving autosave, imports, and route behavior.
