import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import {
  createEmptyProject,
  exportProjectBundle,
  importProjectBundle,
  projectForAdvisor,
  sha256Hex,
} from "../src/index";

type TestProject = ReturnType<typeof createEmptyProject>;

async function addEvidenceAttachmentReference(
  project: TestProject,
  attachmentId: string,
  bytes: Uint8Array,
) {
  project.evidence.push({
    id: `evidence-${attachmentId}`,
    title: "Evidence attachment",
    description: "Locally stored evidence",
    kind: "file",
    owner: "Security",
    collectedAt: "2026-07-01",
    relatedRequirementIds: [],
    relatedSoc2ControlIds: [],
    sha256: await sha256Hex(bytes),
    sensitivity: "confidential",
    notes: "",
    reviewStatus: "candidate",
    attachmentId,
  });
}

async function addGeneratedOutputReference(project: TestProject, id: string, bytes: Uint8Array) {
  project.generatedOutputs.push({
    id,
    kind: "readiness_report",
    title: "Readiness report",
    format: "html",
    generatedAt: "2026-07-17T12:00:00.000Z",
    sha256: await sha256Hex(bytes),
    validationStatus: "not_applicable",
    validationIssues: [],
  });
}

describe(".classabridge bundles", () => {
  it("round-trips a standard project with verified hashes", async () => {
    const project = createEmptyProject("Portable", "Acme Metrics");
    project.notes = "private canary";
    const bundle = await exportProjectBundle(project);
    const restored = await importProjectBundle(bundle);
    expect(restored.project).toEqual(project);
    expect(restored.manifest.ruleCatalogVersion).toBe("2026.07.14.01");
  });

  it("round-trips attachment identities instead of archive paths", async () => {
    const project = createEmptyProject("Files", "Acme Metrics");
    const bytes = strToU8("local evidence");
    await addEvidenceAttachmentReference(project, "att-1", bytes);
    const bundle = await exportProjectBundle(project, {
      attachments: [{ id: "att-1", fileName: "review.txt", bytes }],
    });
    const restored = await importProjectBundle(bundle);
    expect(restored.attachments.get("att-1")).toEqual(bytes);
  });

  it("permits referenced attachments to be intentionally excluded from an export", async () => {
    const project = createEmptyProject("Metadata only", "Acme Metrics");
    const bytes = strToU8("sensitive local evidence");
    await addEvidenceAttachmentReference(project, "att-excluded", bytes);

    const restored = await importProjectBundle(await exportProjectBundle(project));

    expect(restored.project.evidence[0]?.attachmentId).toBe("att-excluded");
    expect(restored.attachments.size).toBe(0);
  });

  it("rejects an included attachment that is not referenced by the project", async () => {
    const project = createEmptyProject("Unreferenced file", "Acme Metrics");
    const bytes = strToU8("orphaned evidence");
    const bundle = await exportProjectBundle(project, {
      attachments: [{ id: "att-orphan", fileName: "orphan.txt", bytes }],
    });

    await expect(importProjectBundle(bundle)).rejects.toThrow(/not referenced|logical id/iu);
  });

  it("rejects duplicate attachment logical IDs", async () => {
    const project = createEmptyProject("Duplicate files", "Acme Metrics");
    const bytes = strToU8("same evidence");
    await addEvidenceAttachmentReference(project, "att-duplicate", bytes);
    const bundle = await exportProjectBundle(project, {
      attachments: [
        { id: "att-duplicate", fileName: "first.txt", bytes },
        { id: "att-duplicate", fileName: "second.txt", bytes },
      ],
    });

    await expect(importProjectBundle(bundle)).rejects.toThrow(/duplicate logical id/iu);
  });

  it("rejects included attachments without a logical ID", async () => {
    const project = createEmptyProject("Missing logical ID", "Acme Metrics");
    const bytes = strToU8("identified evidence");
    await addEvidenceAttachmentReference(project, "att-identified", bytes);
    const archive = unzipSync(
      await exportProjectBundle(project, {
        attachments: [{ id: "att-identified", fileName: "identified.txt", bytes }],
      }),
    );
    const manifest = JSON.parse(strFromU8(archive["manifest.json"]!)) as {
      files: { kind: string; logicalId?: string }[];
    };
    const attachment = manifest.files.find((file) => file.kind === "attachment")!;
    delete attachment.logicalId;
    archive["manifest.json"] = strToU8(JSON.stringify(manifest));

    await expect(importProjectBundle(zipSync(archive))).rejects.toThrow(/logical id/iu);
  });

  it("rejects an attachment declared as included when its archive entry is missing", async () => {
    const project = createEmptyProject("Missing file", "Acme Metrics");
    const bytes = strToU8("required evidence");
    await addEvidenceAttachmentReference(project, "att-missing", bytes);
    const archive = unzipSync(
      await exportProjectBundle(project, {
        attachments: [{ id: "att-missing", fileName: "missing.txt", bytes }],
      }),
    );
    const manifest = JSON.parse(strFromU8(archive["manifest.json"]!)) as {
      files: { path: string; kind: string }[];
    };
    const attachment = manifest.files.find((file) => file.kind === "attachment")!;
    delete archive[attachment.path];

    await expect(importProjectBundle(zipSync(archive))).rejects.toThrow(/integrity check/iu);
  });

  it("rejects evidence attachment bytes that do not match the project hash", async () => {
    const project = createEmptyProject("Mismatched evidence", "Acme Metrics");
    const expectedBytes = strToU8("expected evidence");
    const includedBytes = strToU8("different evidence");
    await addEvidenceAttachmentReference(project, "att-evidence", expectedBytes);
    const bundle = await exportProjectBundle(project, {
      attachments: [{ id: "att-evidence", fileName: "evidence.txt", bytes: includedBytes }],
    });

    await expect(importProjectBundle(bundle)).rejects.toThrow(/project hash|integrity/iu);
  });

  it("rejects SOC 2 report bytes that do not match the project hash", async () => {
    const project = createEmptyProject("Mismatched report", "Acme Metrics");
    const expectedBytes = strToU8("expected report");
    const includedBytes = strToU8("different report");
    project.soc2.sourceReport = {
      fileName: "soc-2.pdf",
      attachmentId: "att-soc2",
      sha256: await sha256Hex(expectedBytes),
    };
    const bundle = await exportProjectBundle(project, {
      attachments: [{ id: "att-soc2", fileName: "soc-2.pdf", bytes: includedBytes }],
    });

    await expect(importProjectBundle(bundle)).rejects.toThrow(/project hash|integrity/iu);
  });

  it("accepts a manifest-hashed attachment referenced only by SOC 2 materials", async () => {
    const project = createEmptyProject("Material attachment", "Acme Metrics");
    const bytes = strToU8("bridge letter");
    project.materials.push({
      id: "material-1",
      kind: "bridge_letter",
      title: "Bridge letter",
      status: "present",
      rationale: "Covers the gap after the report period.",
      attachmentId: "att-material",
    });
    const bundle = await exportProjectBundle(project, {
      attachments: [{ id: "att-material", fileName: "bridge-letter.pdf", bytes }],
    });

    const restored = await importProjectBundle(bundle);

    expect(restored.attachments.get("att-material")).toEqual(bytes);
  });

  it("validates included generated output logical IDs and project hashes", async () => {
    const project = createEmptyProject("Generated output", "Acme Metrics");
    const bytes = strToU8("readiness report");
    await addGeneratedOutputReference(project, "output-1", bytes);
    const bundle = await exportProjectBundle(project, {
      generatedOutputs: [{ id: "output-1", fileName: "report.html", bytes }],
    });

    const restored = await importProjectBundle(bundle);

    expect(restored.generatedOutputs.get("output-1")).toEqual(bytes);
  });

  it("rejects an unreferenced generated output", async () => {
    const project = createEmptyProject("Generated output integrity", "Acme Metrics");
    const bytes = strToU8("expected report");
    await addGeneratedOutputReference(project, "output-1", bytes);

    const unreferenced = await exportProjectBundle(project, {
      generatedOutputs: [{ id: "output-orphan", fileName: "orphan.html", bytes }],
    });

    await expect(importProjectBundle(unreferenced)).rejects.toThrow(/not referenced|logical id/iu);
  });

  it("rejects duplicate generated output logical IDs", async () => {
    const project = createEmptyProject("Generated output integrity", "Acme Metrics");
    const bytes = strToU8("expected report");
    await addGeneratedOutputReference(project, "output-1", bytes);
    const duplicate = await exportProjectBundle(project, {
      generatedOutputs: [
        { id: "output-1", fileName: "first.html", bytes },
        { id: "output-1", fileName: "second.html", bytes },
      ],
    });

    await expect(importProjectBundle(duplicate)).rejects.toThrow(/duplicate logical id/iu);
  });

  it("rejects generated output bytes that do not match the project hash", async () => {
    const project = createEmptyProject("Generated output integrity", "Acme Metrics");
    const expectedBytes = strToU8("expected report");
    const includedBytes = strToU8("different report");
    await addGeneratedOutputReference(project, "output-1", expectedBytes);
    const mismatched = await exportProjectBundle(project, {
      generatedOutputs: [{ id: "output-1", fileName: "report.html", bytes: includedBytes }],
    });

    await expect(importProjectBundle(mismatched)).rejects.toThrow(/project hash|integrity/iu);
  });

  it("permits referenced generated outputs to be intentionally excluded", async () => {
    const project = createEmptyProject("Generated output metadata", "Acme Metrics");
    await addGeneratedOutputReference(project, "output-excluded", strToU8("private report"));

    const restored = await importProjectBundle(await exportProjectBundle(project));

    expect(restored.project.generatedOutputs[0]?.id).toBe("output-excluded");
    expect(restored.generatedOutputs.size).toBe(0);
  });

  it("migrates supported legacy project data before applying current validation", async () => {
    const projectBytes = strToU8(
      JSON.stringify({
        schemaVersion: 0,
        projectName: "Legacy bundle",
        organizationName: "Old Co",
      }),
    );
    const manifest = {
      format: "class-a-bridge",
      formatVersion: 1,
      createdAt: "2026-07-17T12:00:00.000Z",
      projectId: "legacy-project",
      schemaVersion: 0,
      ruleCatalogVersion: "2025.01.01",
      files: [
        {
          path: "project/project.json",
          sha256: await sha256Hex(projectBytes),
          bytes: projectBytes.byteLength,
          kind: "project",
        },
      ],
      migrationHistory: [],
    };
    const bundle = zipSync({
      "manifest.json": strToU8(JSON.stringify(manifest)),
      "project/project.json": projectBytes,
    });
    const restored = await importProjectBundle(bundle);
    expect(restored.project.metadata.name).toBe("Legacy bundle");
    expect(restored.project.metadata.migrations[0]?.id).toBe("v0-to-v1");
  });

  it("rejects archive traversal and malformed projects", async () => {
    const traversal = zipSync({ "../project.json": strToU8("{}") });
    await expect(importProjectBundle(traversal)).rejects.toThrow(/unsafe|manifest/iu);
  });

  it("rejects a hash-consistent imported project with status-only provider approval", async () => {
    const project = createEmptyProject("Tampered approval", "Acme Metrics");
    project.requirements.push({
      ruleId: "KSI-IAM-AAM",
      status: "drafted",
      reviewStatus: "in_review",
      userResponse: "Central workflows manage accounts.",
      implementationNarrative: "Lifecycle events trigger managed changes.",
      verificationNarrative: "The identity team reviews changes monthly.",
      validationNarrative: "A reviewer samples completed changes quarterly.",
      independentVerification: "",
      independentValidation: "",
      soc2ControlIds: [],
      soc2PageReferences: [],
      evidenceIds: [],
      owner: "Identity engineering",
      notes: "",
      openQuestions: [],
      exceptions: [],
    });
    const archive = unzipSync(await exportProjectBundle(project));
    const projectBytes = archive["project/project.json"]!;
    const projectJson = JSON.parse(strFromU8(projectBytes)) as {
      requirements: { status: string }[];
    };
    projectJson.requirements[0]!.status = "approved_by_provider";
    const tamperedProjectBytes = strToU8(JSON.stringify(projectJson));
    const manifest = JSON.parse(strFromU8(archive["manifest.json"]!)) as {
      files: { path: string; sha256: string; bytes: number }[];
    };
    const projectEntry = manifest.files.find((file) => file.path === "project/project.json")!;
    projectEntry.sha256 = await sha256Hex(tamperedProjectBytes);
    projectEntry.bytes = tamperedProjectBytes.byteLength;
    archive["project/project.json"] = tamperedProjectBytes;
    archive["manifest.json"] = strToU8(JSON.stringify(manifest));

    await expect(importProjectBundle(zipSync(archive))).rejects.toThrow(
      /invalid or unsupported project data/iu,
    );
  });

  it("rejects a suspicious compression ratio before expansion", async () => {
    const bomb = zipSync({ "manifest.json": strToU8("A".repeat(2 * 1024 * 1024)) }, { level: 9 });
    await expect(importProjectBundle(bomb)).rejects.toThrow(/compression|safe import/iu);
  });

  it("uses an allowlisted advisor projection that excludes sensitive content", () => {
    const project = createEmptyProject("Advisor", "Acme Metrics");
    project.notes = "general counsel note";
    project.soc2.sourceReport = {
      fileName: "secret.pdf",
      attachmentId: "att-1",
      sha256: "a".repeat(64),
    };
    project.evidence.push({
      id: "ev-1",
      title: "Secret screenshot",
      description: "private",
      kind: "screenshot",
      owner: "Security",
      collectedAt: "2026-07-01",
      relatedRequirementIds: [],
      relatedSoc2ControlIds: [],
      sensitivity: "confidential",
      reviewStatus: "candidate",
      sha256: "b".repeat(64),
      attachmentId: "att-2",
      notes: "secret note",
    });
    const redacted = projectForAdvisor(project);
    const serialized = JSON.stringify(redacted);
    expect(serialized).not.toContain("secret.pdf");
    expect(serialized).not.toContain("general counsel note");
    expect(serialized).not.toContain("att-2");
    expect(serialized).toContain("Secret screenshot");
  });

  it("removes provider approval claims from redacted advisor requirement records", () => {
    const project = createEmptyProject("Advisor approval", "Acme Metrics");
    project.requirements.push({
      ruleId: "KSI-IAM-AAM",
      status: "approved_by_provider",
      reviewStatus: "approved",
      userResponse: "Central workflows manage accounts.",
      implementationNarrative: "Lifecycle events trigger managed changes.",
      verificationNarrative: "The identity team reviews changes monthly.",
      validationNarrative: "A reviewer samples completed changes quarterly.",
      independentVerification: "",
      independentValidation: "",
      soc2ControlIds: [],
      soc2PageReferences: [],
      evidenceIds: [],
      owner: "Identity engineering",
      notes: "",
      openQuestions: [],
      exceptions: [],
      providerApprovedBy: "Provider representative",
      providerApprovedAt: "2026-07-17T15:00:00.000Z",
    });

    const redacted = projectForAdvisor(project);

    expect(redacted.requirements[0]?.status).toBe("needs_expert_review");
    expect(redacted.requirements[0]?.reviewStatus).toBe("unreviewed");
    expect(redacted.requirements[0]?.providerApprovedBy).toBeUndefined();
    expect(redacted.requirements[0]?.providerApprovedAt).toBeUndefined();
  });
});
