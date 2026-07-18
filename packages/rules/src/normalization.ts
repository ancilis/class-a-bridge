export type JsonObject = Readonly<Record<string, unknown>>;

export type ClassAApplicability = "CLASS_A_BRANCH" | "GENERAL_RULE" | "NO_CLASS_A_BRANCH";

export interface EffectiveClassARule {
  readonly classAApplicability: ClassAApplicability;
  readonly effectiveOfficial: JsonObject;
  readonly fieldSourcePaths: Readonly<Record<string, string | null>>;
  readonly officialText: string;
  readonly requirementLevel: string;
  readonly usedGenericStatementFallback: boolean;
  readonly usesClassSpecificBranch: boolean;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Resolve the official fields that apply to Class A without changing the
 * original source object. Class-specific values override general values and
 * every effective field retains the relative JSON path it came from.
 */
export function resolveEffectiveClassARule(official: JsonObject): EffectiveClassARule {
  const variants = isObject(official.varies_by_class) ? official.varies_by_class : undefined;
  const classA = variants && isObject(variants.a) ? variants.a : undefined;
  const hasClassVariants = variants !== undefined;
  const effectiveOfficial: Record<string, unknown> = { ...official };
  const fieldSourcePaths: Record<string, string | null> = {};

  for (const key of Object.keys(official)) fieldSourcePaths[key] = key;
  if (classA) {
    for (const [key, value] of Object.entries(classA)) {
      effectiveOfficial[key] = value;
      fieldSourcePaths[key] = `varies_by_class.a.${key}`;
    }
  }

  const statement = effectiveOfficial.statement;
  const force = effectiveOfficial.force;
  const hasStatement = typeof statement === "string" && statement.trim().length > 0;

  return {
    classAApplicability: classA
      ? "CLASS_A_BRANCH"
      : hasClassVariants
        ? "NO_CLASS_A_BRANCH"
        : "GENERAL_RULE",
    effectiveOfficial,
    fieldSourcePaths,
    officialText: hasStatement ? statement : "",
    requirementLevel:
      typeof force === "string" && force.trim().length > 0 ? force : "NOT_PUBLISHED",
    usedGenericStatementFallback: false,
    usesClassSpecificBranch: classA !== undefined,
  };
}
