import { generateHumanReport } from "@class-a-bridge/documents";
import { getStartingActions, type BridgeProject } from "@class-a-bridge/project";
import { CATALOG_MANIFEST } from "@class-a-bridge/rules";
import { Button, Card, Field } from "@class-a-bridge/ui";
import { downloadText } from "../../lib/download";

export function StartingPlan({
  project,
  update,
  navigate,
}: {
  readonly project: BridgeProject;
  readonly update: (recipe: (draft: BridgeProject) => void) => void;
  readonly navigate: (route: "/scope" | "/soc2-materials" | "/settings" | "/requirements") => void;
}) {
  const tasks = getStartingActions(
    Object.fromEntries(
      project.eligibility.answers.map((answer) => [answer.questionId, answer.value]),
    ),
  );
  const outdated = project.metadata.ruleCatalogVersion !== CATALOG_MANIFEST.catalogVersion;
  return (
    <Card title="Your starting plan" eyebrow="A useful next step">
      <p>
        Take this plan to your team. Each task names an owner, the material to collect, and what a
        completed review should establish.
      </p>
      <div className="button-row">
        <Button
          onClick={() => {
            const report = generateHumanReport(project, "preliminary-fit");
            downloadText(report.html, report.fileName, report.mimeType);
          }}
        >
          Download your starting plan
        </Button>
        <Button variant="quiet" onClick={() => navigate("/settings")}>
          Save a portable backup
        </Button>
      </div>
      <p className="small">
        The plan is an HTML document you can print to PDF. Browser storage can be cleared; a
        portable backup lets you restore your work.
      </p>
      <details>
        <summary>Name your plan (optional)</summary>
        <div className="two-column">
          <Field label="Organization for this plan">
            <input
              value={project.organization.name}
              onChange={(event) =>
                update((draft) => {
                  draft.organization.name = event.target.value;
                })
              }
            />
          </Field>
          <Field label="Offering for this plan">
            <input
              value={project.offering.name}
              onChange={(event) =>
                update((draft) => {
                  draft.offering.name = event.target.value;
                })
              }
            />
          </Field>
        </div>
      </details>
      {outdated && (
        <p role="status">
          This project uses an older catalog. Review the catalog update before relying on new
          guidance.
        </p>
      )}
      <h3>Next three actions</h3>
      <ol className="action-list">
        {tasks.map((task, index) => (
          <li key={task.id}>
            <div>
              <strong>{task.title}</strong>
              <p>
                <span className="small">Suggested owner: </span>
                {task.owner}
              </p>
              <details open={index === 0}>
                <summary>Evidence and completion condition</summary>
                <p>{task.evidence}</p>
                <p>
                  <strong>Done when: </strong>
                  {task.doneWhen}
                </p>
              </details>
              <Button
                variant={index === 0 ? "primary" : "secondary"}
                onClick={() => navigate(task.route)}
              >
                Continue: {task.title}
              </Button>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
