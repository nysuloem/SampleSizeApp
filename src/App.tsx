import React, { useMemo, useState } from "react";

// ── Types ───────────────────────────────────────────────────────────────────

type Design = "" | "two-group" | "paired" | "correlation" | "anova";
type VariabilitySource = "" | "hummod" | "literature" | "biological_reasoning";

// ── Math helpers (unchanged from original) ─────────────────────────────────

function inverseNormalCdf(p: number) {
  if (p <= 0 || p >= 1) return NaN;
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const plow = 0.02425, phigh = 1 - plow;
  let q: number, r: number;
  if (p < plow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
  if (p > phigh) {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
  q = p - 0.5; r = q * q;
  return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
}

function roundUp(value: number) {
  if (!Number.isFinite(value)) return NaN;
  return Math.max(3, Math.ceil(value));
}

function calcTwoGroupSampleSize(effect: number, sd: number, alpha: number, power: number) {
  if (effect <= 0 || sd <= 0) return null;
  const za = inverseNormalCdf(1 - alpha / 2), zp = inverseNormalCdf(power), d = effect / sd;
  return { standardizedEffect: d, nPerGroup: roundUp(2 * Math.pow((za + zp) / d, 2)) };
}
function calcPairedSampleSize(effect: number, sdDiff: number, alpha: number, power: number) {
  if (effect <= 0 || sdDiff <= 0) return null;
  const za = inverseNormalCdf(1 - alpha / 2), zp = inverseNormalCdf(power), dz = effect / sdDiff;
  return { standardizedEffect: dz, nPairs: roundUp(Math.pow((za + zp) / dz, 2)) };
}
function calcCorrelationSampleSize(r: number, alpha: number, power: number) {
  if (r <= 0 || r >= 1) return null;
  const za = inverseNormalCdf(1 - alpha / 2), zp = inverseNormalCdf(power);
  const fisher = 0.5 * Math.log((1 + r) / (1 - r));
  return { n: roundUp(Math.pow((za + zp) / fisher, 2) + 3) };
}
function calcMultiGroupSampleSize(effect: number, sd: number, groups: number, alpha: number, power: number) {
  if (effect <= 0 || sd <= 0 || groups < 3) return null;
  const za = inverseNormalCdf(1 - alpha / 2), zp = inverseNormalCdf(power), d = effect / sd;
  const nPerGroup = roundUp(2 * Math.pow((za + zp) / d, 2) * (1 + 0.2 * (groups - 2)));
  return { standardizedEffect: d, nPerGroup, totalN: nPerGroup * groups };
}
function interpretMagnitude(value: number, type: "d" | "r") {
  if (!Number.isFinite(value)) return "Unclear";
  if (type === "d") { if (value < 0.2) return "Very small"; if (value < 0.5) return "Small"; if (value < 0.8) return "Moderate"; return "Large"; }
  if (value < 0.1) return "Very small"; if (value < 0.3) return "Small"; if (value < 0.5) return "Moderate"; return "Large";
}

// ── Shared UI components (matching the first app) ──────────────────────────

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function ButtonChoice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded border p-4 text-left transition ${selected ? "bg-slate-900 text-white" : "bg-white hover:border-slate-500"}`}
    >
      {children}
    </button>
  );
}

// ── Initial state ──────────────────────────────────────────────────────────

type Variable = { name: string; units: string };
type YesNo = "" | "yes" | "no";

type State = {
  question: string;
  questionSubmitted: boolean;
  design: Design;
  subgroups: YesNo;
  numSubgroups: number;
  subgroupLabel: string;
  variables: Variable[];
  outcomeSubmitted: boolean;
  effect: number;
  sd: number;
  sdDiff: number;
  r2: number;
  groups: number;
  variabilitySource: VariabilitySource;
  assumptionsConfirmed: boolean;
  alpha: number;
  power: number;
  powerConfirmed: boolean;
};

const INITIAL_STATE: State = {
  question: "",
  questionSubmitted: false,
  design: "",
  subgroups: "",
  numSubgroups: 2,
  subgroupLabel: "",
  variables: [{ name: "", units: "" }],
  outcomeSubmitted: false,
  effect: 10,
  sd: 12,
  sdDiff: 10,
  r2: 0.12,
  groups: 3,
  variabilitySource: "",
  assumptionsConfirmed: false,
  alpha: 0.05,
  power: 0.8,
  powerConfirmed: false,
};

// ── Main component ──────────────────────────────────────────────────────────

export default function PowerAnalysisStudentApp() {
  const [state, setState] = useState<State>(INITIAL_STATE);

  const update = (patch: Partial<State>) => setState((prev) => ({ ...prev, ...patch }));

  // When the user changes the design, reset downstream inputs to neutral defaults
  // so effect/SD entered for, say, two-group don't leak into a later paired calc.
  const setDesign = (design: Design) => {
    setState((prev) => ({
      ...prev,
      design,
      subgroups: "",
      numSubgroups: 2,
      subgroupLabel: "",
      variables: design === "correlation"
        ? [{ name: "", units: "" }, { name: "", units: "" }]
        : [{ name: "", units: "" }],
      outcomeSubmitted: false,
      effect: 10,
      sd: 12,
      sdDiff: 10,
      r2: 0.12,
      groups: 3,
      variabilitySource: "",
      assumptionsConfirmed: false,
      powerConfirmed: false,
    }));
  };

  const updateVariable = (index: number, field: keyof Variable, value: string) => {
    setState((prev) => {
      const next = [...prev.variables];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, variables: next, outcomeSubmitted: false };
    });
  };

  const addVariable = () => {
    setState((prev) => ({ ...prev, variables: [...prev.variables, { name: "", units: "" }], outcomeSubmitted: false }));
  };

  const removeVariable = (index: number) => {
    setState((prev) => {
      const next = prev.variables.filter((_, i) => i !== index);
      return { ...prev, variables: next, outcomeSubmitted: false };
    });
  };

  const { design, alpha, power, effect, sd, sdDiff, r2, groups, variables, variabilitySource,
          subgroups, numSubgroups, subgroupLabel } = state;

  // Convenience aliases for justification text
  const primaryVar = variables[0] ?? { name: "", units: "" };
  const secondaryVars = variables.slice(1);

  const result = useMemo(() => {
    if (!design) return null;
    if (design === "two-group") return calcTwoGroupSampleSize(effect, sd, alpha, power);
    if (design === "paired") return calcPairedSampleSize(effect, sdDiff, alpha, power);
    if (design === "correlation") return calcCorrelationSampleSize(Math.sqrt(r2), alpha, power);
    return calcMultiGroupSampleSize(effect, sd, groups, alpha, power);
  }, [design, effect, sd, sdDiff, r2, groups, alpha, power]);

  const variabilitySourceText =
    variabilitySource === "hummod" ? "a pilot experiment in HumMod"
    : variabilitySource === "literature" ? "prior studies in the literature"
    : variabilitySource === "biological_reasoning" ? "knowledge of the known physiological relationship between the variables"
    : "an estimated source of variability";

  // ── Gating helpers (must come before useMemos that reference them) ─────────
  const showDesignPanel = state.questionSubmitted;
  const showSubgroupQuestion = Boolean(design) && design !== "correlation";
  const subgroupsResolved = design === "correlation" || subgroups === "yes" || subgroups === "no";
  const showOutcomePanelGated = showDesignPanel && Boolean(design) && subgroupsResolved;
  const showAssumptionsPanel = showOutcomePanelGated && state.outcomeSubmitted;
  const assumptionsComplete = Boolean(variabilitySource);

  // ── Subgroup-adjusted totals ───────────────────────────────────────────────
  const sgCount = subgroups === "yes" ? numSubgroups : 1;
  const subgroupTotals = useMemo(() => {
    if (!result) return null;
    if (design === "two-group" && "nPerGroup" in result) {
      const n = result.nPerGroup as number;
      const interactionN = Math.ceil(n * 4);
      return { perCell: n, totalN: n * 2 * sgCount, interactionN, interactionTotal: interactionN * 2 * sgCount };
    }
    if (design === "paired" && "nPairs" in result) {
      const n = result.nPairs as number;
      const interactionN = Math.ceil(n * 4);
      return { perCell: n, totalN: n * sgCount, interactionN, interactionTotal: interactionN * sgCount };
    }
    if (design === "anova" && "nPerGroup" in result) {
      const n = result.nPerGroup as number;
      const interactionN = Math.ceil(n * 4);
      return { perCell: n, totalN: n * groups * sgCount, interactionN, interactionTotal: interactionN * groups * sgCount };
    }
    return null;
  }, [result, design, sgCount, groups]);

  const assumptionsText = useMemo(() => {
    const outcomeName = primaryVar.name || "the outcome variable";
    const outcomeUnits = primaryVar.units || "units";
    const secondaryNote = secondaryVars.filter(v => v.name).length > 0
      ? ` Secondary outcome variable${secondaryVars.filter(v => v.name).length > 1 ? "s" : ""} included in the study: ${secondaryVars.filter(v => v.name).map(v => v.units ? `${v.name} (${v.units})` : v.name).join(", ")}.`
      : "";

    // Subgroup sentence appended when subgroups are specified
    const sgLabel = subgroupLabel || "subgroup";
    const sgSentence = subgroups === "yes" && subgroupTotals
      ? ` This sample size applies within each level of the ${sgLabel} variable (${numSubgroups} levels), giving a total of ${subgroupTotals.totalN} participants across the full study. This design is powered to detect the specified effect within each subgroup independently; it is not powered to detect a difference in effect size between subgroups.`
      : "";

    if (design === "two-group" && result && "nPerGroup" in result)
      return `We estimated that a biologically meaningful difference in ${outcomeName} would be ${effect} ${outcomeUnits} between the treatment and control groups. We estimated the standard deviation to be ${sd} ${outcomeUnits}, based on ${variabilitySourceText}. Using a two-sided alpha of ${alpha.toFixed(2)} and desired power of ${(power*100).toFixed(0)}%, the estimated required sample size is ${result.nPerGroup} participants per group.${sgSentence}${secondaryNote}`;
    if (design === "paired" && result && "nPairs" in result)
      return `We estimated that a biologically meaningful difference in ${outcomeName} would be ${effect} ${outcomeUnits} between conditions. We estimated the standard deviation of the paired differences to be ${sdDiff} ${outcomeUnits}, based on ${variabilitySourceText}. Using a two-sided alpha of ${alpha.toFixed(2)} and desired power of ${(power*100).toFixed(0)}%, the estimated required sample size is ${result.nPairs} participants.${sgSentence}${secondaryNote}`;
    if (design === "correlation" && result && "n" in result) {
      const var1 = variables[0]?.name || "Variable 1";
      const var2 = variables[1]?.name || "Variable 2";
      const units1 = variables[0]?.units ? ` (${variables[0].units})` : "";
      const units2 = variables[1]?.units ? ` (${variables[1].units})` : "";
      const extraVars = variables.slice(2).filter(v => v.name);
      const extraNote = extraVars.length > 0
        ? ` Additional variables measured: ${extraVars.map(v => v.units ? `${v.name} (${v.units})` : v.name).join(", ")}.`
        : "";
      return `We estimated that a biologically meaningful association would correspond to an r² value of ${r2.toFixed(2)} (r ≈ ${Math.sqrt(r2).toFixed(2)}) between ${var1}${units1} and ${var2}${units2}, based on ${variabilitySourceText}. Using a two-sided alpha of ${alpha.toFixed(2)} and desired power of ${(power*100).toFixed(0)}%, the estimated required sample size is ${result.n} participants.${extraNote}`;
    }
    if (design === "anova" && result && "nPerGroup" in result && "totalN" in result)
      return `We estimated that the experiment would include ${groups} independent groups. We estimated that a biologically meaningful difference between any two groups in ${outcomeName} would be ${effect} ${outcomeUnits}, and that the standard deviation would be ${sd} ${outcomeUnits}, based on ${variabilitySourceText}. Using a two-sided alpha of ${alpha.toFixed(2)} and desired power of ${(power*100).toFixed(0)}%, the estimated required sample size is ${String(result.nPerGroup)} participants per group (${String(result.totalN)} total).${sgSentence}${secondaryNote}`;
    return "";
  }, [design, result, variables, primaryVar, secondaryVars, effect, sd, sdDiff, r2, alpha, power, groups, variabilitySourceText, subgroups, subgroupLabel, numSubgroups, subgroupTotals]);

  const teachingText = useMemo(() => {
    if (design === "two-group" && result && "standardizedEffect" in result) {
      const d = result.standardizedEffect;
      const mag = interpretMagnitude(d, "d");
      return `Your expected difference (${effect} ${primaryVar.units || "units"}) is ${d.toFixed(2)} times the expected variability between individuals (SD = ${sd} ${primaryVar.units || "units"}). This is considered a ${mag.toLowerCase()} effect relative to the background variability. ${mag === "Very small" || mag === "Small" ? "Because the effect is small relative to how variable individuals are, you need more participants to reliably tell signal from noise." : "Because the effect is large relative to individual variability, you can detect it with fewer participants."}`;
    }
    if (design === "paired" && result && "standardizedEffect" in result) {
      const dz = result.standardizedEffect;
      const mag = interpretMagnitude(dz, "d");
      return `Your expected within-subject difference (${effect} ${primaryVar.units || "units"}) is ${dz.toFixed(2)} times the expected variability in those differences (SD = ${sdDiff} ${primaryVar.units || "units"}). This is a ${mag.toLowerCase()} effect. Paired designs are efficient because they remove between-person variability — the same person is measured twice, so individual differences cancel out.`;
    }
    if (design === "correlation" && result && "n" in result)
      return `An r² of ${r2.toFixed(2)} means that ${(r2 * 100).toFixed(0)}% of the variation in one variable is explained by the other. Even though that sounds meaningful, weak-to-moderate associations are hard to distinguish from zero with small samples — which is why the required N is high. See the explanation in Step 4 for more detail.`;
    if (design === "anova" && result && "totalN" in result)
      return `The same logic applies as in the two-group case: the required sample size is driven by the ratio of your expected effect to your expected variability. With ${groups} groups, the total participant count is larger, but the per-group requirement is calculated the same way.`;
    return "";
  }, [design, result, r2, groups, effect, sd, sdDiff, primaryVar]);

  const copyText = async () => {
    try { await navigator.clipboard.writeText(assumptionsText); }
    catch { /* no-op */ }
  };

  const showPowerPanel = showAssumptionsPanel && state.assumptionsConfirmed;
  const showResultPanel = showPowerPanel && state.powerConfirmed && Boolean(result);

  // ── Practical sample size cap ─────────────────────────────────────────────
  // For student projects: 20 per group for group designs; 40 total for correlation
  // (equivalent ceiling — 20 per group × 2 groups).
  const CAP_PER_GROUP = 20;
  const CAP_CORRELATION = 40;

  const isCapped = (() => {
    if (!result) return false;
    if (design === "two-group" && "nPerGroup" in result) return (result.nPerGroup as number) > CAP_PER_GROUP;
    if (design === "paired" && "nPairs" in result) return (result.nPairs as number) > CAP_PER_GROUP;
    if (design === "correlation" && "n" in result) return (result.n as number) > CAP_CORRELATION;
    if (design === "anova" && "nPerGroup" in result) return (result.nPerGroup as number) > CAP_PER_GROUP;
    return false;
  })();

  const requiredLabel = (() => {
    if (!result) return "";
    if (design === "two-group" && "nPerGroup" in result) return `~${result.nPerGroup} per group`;
    if (design === "paired" && "nPairs" in result) return `~${result.nPairs} participants`;
    if (design === "correlation" && "n" in result) return `~${result.n} participants`;
    if (design === "anova" && "nPerGroup" in result && "totalN" in result) return `~${String(result.nPerGroup)} per group (~${String(result.totalN)} total)`;
    return "";
  })();

  const cappedLabel = (() => {
    if (design === "two-group") return `${CAP_PER_GROUP} per group`;
    if (design === "paired") return `${CAP_PER_GROUP} participants`;
    if (design === "correlation") return `${CAP_CORRELATION} participants`;
    if (design === "anova") return `${CAP_PER_GROUP} per group (${CAP_PER_GROUP * groups} total)`;
    return "";
  })();

  const underpoweredNote = `Note: the power calculation estimates ${requiredLabel} would be needed to achieve ${(power * 100).toFixed(0)}% power. This study is limited to the practical cap of ${cappedLabel}. This study is therefore underpowered. If the primary outcome does not reach statistical significance but the observed effect is in the expected direction, note in your report that the study was underpowered due to practical constraints, and that a larger study would be needed to confirm or refute the finding.`;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">

        {/* Header */}
        <div className="rounded-3xl bg-slate-900 p-6 text-white">
          <h1 className="text-3xl font-bold">Sample Size & Power Analysis Tool</h1>
          <p className="mt-2 text-slate-300">Estimate and justify a defensible sample size for your experiment.</p>
        </div>

        {/* ── Step 1: Research question ── */}
        <Panel title="Step 1: What is your research question?">
          <textarea
            className="w-full rounded border p-3"
            placeholder="Example: Does lisinopril affect blood glucose during an oral glucose tolerance test?"
            value={state.question}
            onChange={(e) => setState((prev) => ({ ...prev, question: e.target.value, questionSubmitted: false }))}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded bg-slate-900 px-4 py-2 text-white"
              onClick={() => {
                if (state.question.trim().length > 0) update({ questionSubmitted: true });
              }}
            >
              Submit Question
            </button>
          </div>

          {/* Quick-load examples — keep these accessible but out of the main flow */}
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <p className="mb-2 font-semibold">Or try a worked example:</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs hover:border-slate-500"
                onClick={() => setState({
                  ...INITIAL_STATE,
                  question: "Does sweat rate differ between males and females during moderate-intensity exercise?",
                  questionSubmitted: true,
                  design: "two-group",
                  variables: [{ name: "Sweat rate", units: "mL/min" }],
                  outcomeSubmitted: true,
                  effect: 0.3,
                  sd: 0.4,
                  variabilitySource: "literature",
                  assumptionsConfirmed: true,
                  powerConfirmed: true,
                })}
              >
                Does sweat rate differ between males and females during moderate-intensity exercise?
              </button>
              <button
                type="button"
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs hover:border-slate-500"
                onClick={() => setState({
                  ...INITIAL_STATE,
                  question: "Does lisinopril change the blood glucose response to an oral glucose tolerance test?",
                  questionSubmitted: true,
                  design: "paired",
                  variables: [{ name: "Blood glucose at 2 hours post-consumption", units: "mmol/L" }],
                  outcomeSubmitted: true,
                  effect: 1.5,
                  sdDiff: 2,
                  variabilitySource: "hummod",
                  assumptionsConfirmed: true,
                  powerConfirmed: true,
                })}
              >
                Does lisinopril change the blood glucose response to an oral glucose tolerance test?
              </button>
              <button
                type="button"
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs hover:border-slate-500"
                onClick={() => setState({
                  ...INITIAL_STATE,
                  question: "Is plasma insulin concentration correlated with plasma cortisol concentration in patients with type 1 diabetes?",
                  questionSubmitted: true,
                  design: "correlation",
                  variables: [
                    { name: "Plasma insulin", units: "pmol/L" },
                    { name: "Plasma cortisol", units: "nmol/L" },
                  ],
                  outcomeSubmitted: true,
                  r2: 0.12,
                  variabilitySource: "biological_reasoning",
                  assumptionsConfirmed: true,
                  powerConfirmed: true,
                })}
              >
                Is plasma insulin concentration correlated with plasma cortisol concentration in patients with type 1 diabetes?
              </button>
            </div>
          </div>
        </Panel>

        {/* ── Step 2: Choose study design ── */}
        {showDesignPanel && (
          <Panel title="Step 2: What kind of statistical test are you planning?">
            <p className="mb-3 text-sm text-slate-600">
              Your choice here determines which effect size and variability inputs you need to provide.
            </p>
            <div className="grid gap-3 text-sm">
              <ButtonChoice selected={design === "two-group"} onClick={() => setDesign("two-group")}>
                <strong>Two independent groups</strong>
                <p>Compare an outcome between two separate groups of participants or samples (e.g., treatment vs. control)</p>
              </ButtonChoice>
              <ButtonChoice selected={design === "paired"} onClick={() => setDesign("paired")}>
                <strong>Paired / repeated measures</strong>
                <p>Compare two conditions measured on the same participants or samples (e.g., before vs. after)</p>
              </ButtonChoice>
              <ButtonChoice selected={design === "correlation"} onClick={() => setDesign("correlation")}>
                <strong>Correlation / association</strong>
                <p>Test whether two continuous variables are associated</p>
              </ButtonChoice>
              <ButtonChoice selected={design === "anova"} onClick={() => setDesign("anova")}>
                <strong>3 or more independent groups</strong>
                <p>Compare an outcome across three or more separate groups (one-way ANOVA design)</p>
              </ButtonChoice>
            </div>

            {design === "anova" && (
              <div className="mt-4 rounded bg-amber-50 p-3 text-sm">
                <strong>Recommendation:</strong> Use no more than 2 groups unless absolutely necessary. Multi-group designs require more participants overall and more complex analysis.
              </div>
            )}

            {/* Subgroup question — not shown for correlation */}
            {showSubgroupQuestion && (
              <div className="mt-5 border-t border-slate-200 pt-5">
                <p className="mb-1 text-sm font-semibold">Are you planning to examine this question separately within pre-hoc groups?</p>
                <p className="mb-3 text-xs text-slate-500">
                  Pre-hoc groups are groups you define <em>before</em> running any simulations, based on a known participant characteristic — for example, sex (male/female), age group, or ethnicity. This is separate from the treatment groups you are already comparing.
                </p>
                <div className="grid gap-3 text-sm md:grid-cols-2">
                  <ButtonChoice selected={subgroups === "no"} onClick={() => update({ subgroups: "no", numSubgroups: 2, subgroupLabel: "" })}>
                    <strong>No</strong>
                    <p>All participants come from one group</p>
                  </ButtonChoice>
                  <ButtonChoice selected={subgroups === "yes"} onClick={() => update({ subgroups: "yes" })}>
                    <strong>Yes</strong>
                    <p>I want to examine the effect separately within two or more pre-hoc groups (e.g., males and females)</p>
                  </ButtonChoice>
                </div>

                {subgroups === "yes" && (
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="block text-sm font-semibold">What characteristic defines these pre-hoc groups?</label>
                        <input
                          type="text"
                          className="mt-1 w-full rounded border p-2 text-sm"
                          placeholder="e.g., Sex, Age group, Ethnicity"
                          value={subgroupLabel}
                          onChange={(e) => update({ subgroupLabel: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold">How many levels does this characteristic have?</label>
                        <input
                          type="number"
                          min={2}
                          className="mt-1 w-full rounded border p-2 text-sm"
                          value={numSubgroups}
                          onChange={(e) => update({ numSubgroups: Math.max(2, Number(e.target.value)) })}
                        />
                        <p className="mt-1 text-xs text-slate-500">e.g., 2 for male and female</p>
                      </div>
                    </div>

                    <div className="rounded bg-amber-50 p-4 text-sm ring-2 ring-amber-300">
                      <strong>Two different questions — two different sample sizes:</strong>
                      <p className="mt-2"><strong>Question 1: Does the effect exist within each pre-hoc group?</strong> The sample size this tool calculates applies within one pre-hoc group. You need that many participants <em>in each</em> {subgroupLabel || "group"} level. See the totals shown in Step 6.</p>
                      <p className="mt-2"><strong>Question 2: Does the effect differ between pre-hoc groups?</strong> This is the interaction question (e.g., is the effect of ethanol on BP different in males vs. females?). Detecting an interaction requires roughly <strong>4× the per-group N</strong> of the main effect. Whether this is feasible depends on how long each HumMod simulation takes — if your simulations run quickly you may be able to reach this number, but if each simulation takes significant time it may not be practical to conduct enough simulations to observe such interactions.</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Panel>
        )}

        {/* ── Step 3: Outcome variable description ── */}
        {showOutcomePanelGated && (
          <Panel title="Step 3: Describe your variable(s)">
            <p className="mb-4 text-sm text-slate-600">
              These are used to fill in your paste-ready justification. You can leave them blank and still get a sample size estimate.
            </p>

            {/* Dynamic variable rows */}
            <div className="space-y-4">
              {variables.map((v, i) => {
                const isCorrelation = design === "correlation";
                const label = isCorrelation
                  ? `Variable ${i + 1}`
                  : i === 0
                    ? "Primary outcome variable"
                    : `Additional variable ${i}`;
                const namePlaceholder = isCorrelation
                  ? i === 0 ? "e.g., Plasma insulin" : "e.g., Plasma cortisol"
                  : i === 0 ? "e.g., Sweat rate" : "e.g., Body mass";
                const unitPlaceholder = isCorrelation
                  ? i === 0 ? "e.g., pmol/L" : "e.g., nmol/L"
                  : "e.g., mL/min";

                // Minimum rows that cannot be removed:
                // correlation needs 2, others need 1
                const minRows = isCorrelation ? 2 : 1;
                const canRemove = i >= minRows;

                return (
                  <div key={i} className="rounded-xl border border-slate-200 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-semibold">{label}</span>
                      {canRemove && (
                        <button
                          type="button"
                          className="text-xs text-slate-400 hover:text-red-500"
                          onClick={() => removeVariable(i)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="block text-xs text-slate-500">Variable name</label>
                        <input
                          type="text"
                          className="mt-1 w-full rounded border p-2 text-sm"
                          placeholder={namePlaceholder}
                          value={v.name}
                          onChange={(e) => updateVariable(i, "name", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500">Units</label>
                        <input
                          type="text"
                          className="mt-1 w-full rounded border p-2 text-sm"
                          placeholder={unitPlaceholder}
                          value={v.units}
                          onChange={(e) => updateVariable(i, "units", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add another variable */}
            <button
              type="button"
              className="mt-3 rounded border border-slate-300 bg-white px-3 py-2 text-sm hover:border-slate-500"
              onClick={addVariable}
            >
              + Add another variable
            </button>
            <p className="mt-1 text-xs text-slate-400">
              {design === "correlation"
                ? "Add a third variable if you are measuring additional outcomes alongside the two correlated variables."
                : "Add extra variables if your study measures additional outcomes or covariates beyond the primary outcome."}
            </p>

            <button
              type="button"
              className="mt-5 rounded bg-slate-900 px-4 py-2 text-white"
              onClick={() => update({ outcomeSubmitted: true })}
            >
              Continue
            </button>
          </Panel>
        )}

        {/* ── Step 4: Assumptions (design-specific) ── */}
        {showAssumptionsPanel && (
          <Panel title="Step 4: Enter your effect size and variability assumptions">

            {/* ── Source question FIRST for non-correlation designs ── */}
            {design !== "correlation" && (
              <div className="mb-6">
                <label className="mb-2 block text-sm font-semibold">Before entering any numbers: where will your SD estimate come from?</label>
                <p className="mb-3 text-xs text-slate-500">Think about this first — your SD estimate is as important as your effect size. A poorly justified SD undermines the whole calculation.</p>
                <div className="grid gap-3">
                  <ButtonChoice
                    selected={variabilitySource === "literature"}
                    onClick={() => update({ variabilitySource: "literature", assumptionsConfirmed: false })}
                  >
                    <div className="flex items-center gap-2">
                      <strong>Prior studies in the literature</strong>
                      <span className="rounded bg-emerald-700 px-2 py-0.5 text-xs text-white">Recommended</span>
                    </div>
                    <p className="mt-1">Find a published study that measured the same variable in a similar population. Look up the SD they reported in their results (in a table, figure caption, or text), and use that number directly. Make sure to use the SD from a single group — not a pooled SD across groups.</p>
                  </ButtonChoice>
                  <ButtonChoice
                    selected={variabilitySource === "hummod"}
                    onClick={() => update({ variabilitySource: "hummod", assumptionsConfirmed: false })}
                  >
                    <strong>Pilot experiment in HumMod</strong>
                    <p className="mt-1">Run a small set of simulations, record the individual output values, and compute the SD of those values within one group. Use this if you cannot find a published SD for your specific variable and population.</p>
                  </ButtonChoice>
                </div>
                <div className="mt-4 border-t border-slate-200 pt-4" />
              </div>
            )}

            {/* ── Source question FIRST for correlation ── */}
            {design === "correlation" && (
              <div className="mb-6">
                <label className="mb-1 block text-sm font-semibold">Before setting the slider: how will you estimate the expected r²?</label>
                <p className="mb-3 text-xs text-slate-500">
                  Unlike SD estimates for group comparisons, you cannot derive an expected r² from a HumMod pilot in any straightforward way. The two approaches below are the most defensible.
                </p>
                <div className="grid gap-3">
                  <ButtonChoice
                    selected={variabilitySource === "literature"}
                    onClick={() => update({ variabilitySource: "literature", assumptionsConfirmed: false })}
                  >
                    <div className="flex items-center gap-2">
                      <strong>Prior studies in the literature</strong>
                      <span className="rounded bg-emerald-700 px-2 py-0.5 text-xs text-white">Recommended</span>
                    </div>
                    <p className="mt-1">A published study reported an r or r² between these variables (or closely related ones) — use that value directly</p>
                  </ButtonChoice>
                  <ButtonChoice
                    selected={variabilitySource === "biological_reasoning"}
                    onClick={() => update({ variabilitySource: "biological_reasoning", assumptionsConfirmed: false })}
                  >
                    <strong>Biological reasoning</strong>
                    <p className="mt-1">No published r is available — you will justify an estimate based on the known physiology of the relationship</p>
                  </ButtonChoice>
                </div>

                {variabilitySource === "biological_reasoning" && (
                  <div className="mt-4 rounded bg-slate-50 p-4 text-sm border border-slate-200">
                    <strong>Guidance for estimating r² from biological reasoning:</strong>
                    <p className="mt-2 text-slate-600">Work through these questions to arrive at a defensible estimate:</p>
                    <ol className="mt-2 ml-4 list-decimal space-y-2 text-xs leading-5 text-slate-700">
                      <li><strong>How direct is the physiological link?</strong> If one variable directly drives the other (e.g., two measurements of the same pathway), expect a strong association (r² ≈ 0.4–0.6+). If the link is indirect — mediated by several other processes — expect a weaker association (r² ≈ 0.05–0.2).</li>
                      <li><strong>How much noise is there?</strong> Variables that are tightly regulated (e.g., arterial pH, core body temperature) vary little between people, so any shared signal may account for a larger proportion of the total variance. Highly variable measures (e.g., hormone concentrations) introduce more noise, pushing r² down.</li>
                      <li><strong>Have these variables been mentioned together in lectures or readings?</strong> If so, does the source describe the relationship as strong, moderate, or weak? Use that as a rough guide: strong ≈ r² 0.4+, moderate ≈ r² 0.15–0.4, weak ≈ r² &lt;0.15.</li>
                    </ol>
                    <p className="mt-3 text-xs text-slate-600">In your methods section, explain your reasoning explicitly — e.g., <em>"We estimated r² ≈ 0.15 based on the known indirect relationship between insulin and cortisol via glucose counter-regulation, which is expected to produce a modest but detectable association in a non-diabetic population."</em></p>
                  </div>
                )}

                <div className="mt-4 border-t border-slate-200 pt-4" />
              </div>
            )}

            {/* ── Design-specific inputs ── */}
            {design === "two-group" && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold">Biologically meaningful difference between groups</label>
                  <input
                    type="number"
                    className="mt-1 w-full rounded border p-2"
                    value={effect}
                    onChange={(e) => update({ effect: Number(e.target.value), assumptionsConfirmed: false })}
                  />
                  <p className="mt-1 text-xs text-slate-500">The smallest difference you would consider meaningful{primaryVar.units ? `, in ${primaryVar.units}` : ""}.</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold">Estimated SD</label>
                  <input
                    type="number"
                    min={0}
                    className="mt-1 w-full rounded border p-2"
                    value={sd}
                    onChange={(e) => update({ sd: Math.max(0, Number(e.target.value)), assumptionsConfirmed: false })}
                  />
                  <p className="mt-1 text-xs text-slate-500">The SD of individual measurements within a single group. If you found this in a paper, enter it directly. If you ran a HumMod pilot, compute it from your pilot values.</p>
                </div>
              </div>
            )}

            {design === "paired" && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold">Biologically meaningful difference between conditions</label>
                  <input
                    type="number"
                    className="mt-1 w-full rounded border p-2"
                    value={effect}
                    onChange={(e) => update({ effect: Number(e.target.value), assumptionsConfirmed: false })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold">Estimated SD of paired differences</label>
                  <input
                    type="number"
                    min={0}
                    className="mt-1 w-full rounded border p-2"
                    value={sdDiff}
                    onChange={(e) => update({ sdDiff: Math.max(0, Number(e.target.value)), assumptionsConfirmed: false })}
                  />
                  <p className="mt-1 text-xs text-slate-500">The SD of the within-person change scores (Condition A − Condition B) — not the SD of raw measurements. This is rarely reported directly in papers; if you can't find it, use the SD of raw measurements from a single condition as a rough starting estimate.</p>
                </div>
              </div>
            )}

            {design === "correlation" && (
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold">Expected biologically meaningful correlation</label>
                  <span className="text-sm text-slate-600">r² = {r2.toFixed(2)} &nbsp;|&nbsp; r ≈ {Math.sqrt(r2).toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0.01}
                  max={0.8}
                  step={0.01}
                  value={r2}
                  onChange={(e) => update({ r2: Number(e.target.value), assumptionsConfirmed: false })}
                  className="mt-2 w-full accent-slate-900"
                />
                <p className="mt-1 text-xs text-slate-500">r² is the proportion of variation in the outcome explained by the other variable (e.g., r² = 0.25 → 25%).</p>
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-600 hover:text-slate-900">
                    ▸ Why does a small r² require so many participants?
                  </summary>
                  <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700">
                    <p>This surprises most students. Here is the key insight: a power calculation for a correlation is testing whether <strong>r</strong> is reliably distinguishable from zero — not whether r² is large in some absolute sense.</p>
                    <p className="mt-2">Consider r² = 0.10, which means r ≈ 0.316. That is a real but modest correlation. Now imagine you only measure 10 people. The sampling variability in r with n = 10 is enormous — by chance alone, your observed r could easily swing from −0.2 to +0.7 even if the true r is 0.316. With that much noise you simply cannot tell whether the true association is positive, negative, or absent.</p>
                    <p className="mt-2">The formula effectively asks: <em>how many observations do I need before the estimate of r is precise enough that a true correlation of this size would not be mistaken for zero?</em> For r ≈ 0.316 (r² = 0.10) at 80% power and α = 0.05, the answer is roughly 75–80 participants — because only at that sample size does the confidence interval around r become narrow enough to exclude zero reliably.</p>
                    <p className="mt-2">In short: <strong>weak-to-moderate associations are inherently difficult to pin down</strong>, and you need large samples to distinguish them from noise. This is one reason researchers often need to pool data or run multi-site studies when they expect modest correlations.</p>
                  </div>
                </details>
              </div>
            )}

            {design === "anova" && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold">Number of groups</label>
                  <input
                    type="number"
                    min={3}
                    className="mt-1 w-full rounded border p-2"
                    value={groups}
                    onChange={(e) => update({ groups: Number(e.target.value), assumptionsConfirmed: false })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold">Estimated SD</label>
                  <input
                    type="number"
                    min={0}
                    className="mt-1 w-full rounded border p-2"
                    value={sd}
                    onChange={(e) => update({ sd: Math.max(0, Number(e.target.value)), assumptionsConfirmed: false })}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold">Biologically meaningful difference between any two groups</label>
                  <input
                    type="number"
                    className="mt-1 w-full rounded border p-2"
                    value={effect}
                    onChange={(e) => update({ effect: Number(e.target.value), assumptionsConfirmed: false })}
                  />
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={!assumptionsComplete}
              className={`mt-6 rounded px-4 py-2 text-white ${assumptionsComplete ? "bg-slate-900" : "cursor-not-allowed bg-slate-400"}`}
              onClick={() => update({ assumptionsConfirmed: true })}
            >
              Continue
            </button>
          </Panel>
        )}

        {/* ── Step 5: Alpha and power ── */}
        {showPowerPanel && (
          <Panel title="Step 5: Confirm your alpha and desired power">
            <div className="mb-5 rounded bg-red-50 p-3 text-sm ring-2 ring-red-200">
              <strong>⚠ Important:</strong> The default values (α = 0.05, power = 80%) are the accepted standards in most physiological research. <strong>Do not change these values unless you have a compelling scientific reason to do so.</strong> Adjusting alpha upward or power downward specifically to reduce your sample size is not good practice — it inflates your false-positive rate or leaves you underpowered, and reviewers will notice.
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold">Alpha (significance threshold)</label>
                  <span className="text-sm text-slate-600">{alpha.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0.01}
                  max={0.1}
                  step={0.01}
                  value={alpha}
                  onChange={(e) => update({ alpha: Number(e.target.value), powerConfirmed: false })}
                  className="mt-2 w-full accent-slate-900"
                />
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  The P-value threshold used for statistical significance. The usual default is 0.05, meaning researchers accept about a 5% chance of concluding there is an effect when there really is not one.
                </p>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold">Desired power</label>
                  <span className="text-sm text-slate-600">{(power * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min={0.6}
                  max={0.95}
                  step={0.01}
                  value={power}
                  onChange={(e) => update({ power: Number(e.target.value), powerConfirmed: false })}
                  className="mt-2 w-full accent-slate-900"
                />
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  The probability that your experiment will detect the effect if the effect is real. The usual default is 80%.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="mt-6 rounded bg-slate-900 px-4 py-2 text-white"
              onClick={() => update({ powerConfirmed: true })}
            >
              Confirm alpha and power
            </button>
          </Panel>
        )}

        {/* ── Step 6: Result + paste-ready justification ── */}
        {showResultPanel && result && (
          <Panel title="Step 6: Your estimated sample size">

            {/* Result banner — green when fully powered, amber when capped */}
            <div className={`mb-3 rounded p-4 text-white ${isCapped ? "bg-amber-600" : "bg-emerald-700"}`}>
              <p className={`text-sm uppercase tracking-wide ${isCapped ? "text-amber-100" : "text-emerald-100"}`}>
                {isCapped ? "Practical sample size (underpowered)" : "Estimated required sample size"}
              </p>

              {isCapped ? (
                <>
                  <p className="mt-1 text-2xl font-semibold">{cappedLabel}</p>
                  <p className="mt-1 text-sm">
                    Fully powered study would require: <strong>{requiredLabel}</strong>
                  </p>
                </>
              ) : (
                <>
                  {design === "two-group" && "nPerGroup" in result && (
                    <>
                      <p className="mt-1 text-2xl font-semibold">{result.nPerGroup} per group</p>
                      {subgroups === "yes" && subgroupTotals && (
                        <p className={`mt-1 text-sm ${isCapped ? "text-amber-100" : "text-emerald-100"}`}>
                          {result.nPerGroup} per group × 2 groups × {numSubgroups} {subgroupLabel || "subgroup"} levels = <strong>{subgroupTotals.totalN} participants total</strong>
                        </p>
                      )}
                    </>
                  )}
                  {design === "paired" && "nPairs" in result && (
                    <>
                      <p className="mt-1 text-2xl font-semibold">{result.nPairs} participants</p>
                      {subgroups === "yes" && subgroupTotals && (
                        <p className={`mt-1 text-sm ${isCapped ? "text-amber-100" : "text-emerald-100"}`}>
                          {result.nPairs} per {subgroupLabel || "subgroup"} level × {numSubgroups} levels = <strong>{subgroupTotals.totalN} participants total</strong>
                        </p>
                      )}
                    </>
                  )}
                  {design === "correlation" && "n" in result && (
                    <p className="mt-1 text-2xl font-semibold">{result.n} participants</p>
                  )}
                  {design === "anova" && "nPerGroup" in result && "totalN" in result && (
                    <>
                      <p className="mt-1 text-2xl font-semibold">{String(result.nPerGroup)} per group</p>
                      {subgroups === "yes" && subgroupTotals ? (
                        <p className={`text-sm ${isCapped ? "text-amber-100" : "text-emerald-100"}`}>
                          {String(result.nPerGroup)} per group × {groups} groups × {numSubgroups} {subgroupLabel || "subgroup"} levels = <strong>{subgroupTotals.totalN} participants total</strong>
                        </p>
                      ) : (
                        <p className={`text-sm ${isCapped ? "text-amber-100" : "text-emerald-100"}`}>Total N ≈ {String(result.totalN)}</p>
                      )}
                    </>
                  )}
                </>
              )}
            </div>

            {/* Subgroup: two-question breakdown with interaction N */}
            {subgroups === "yes" && subgroupTotals && !isCapped && (
              <div className="mb-4 space-y-3">
                <div className="rounded bg-slate-100 p-4 text-sm ring-2 ring-slate-300">
                  <strong>Question 1 — Does the effect exist within each {subgroupLabel || "group"}?</strong>
                  <p className="mt-1 text-slate-700">Your study is powered to answer this. You need <strong>{subgroupTotals.perCell} participants per treatment group</strong> within each {subgroupLabel || "group"} level ({subgroupTotals.totalN} total across the full study).</p>
                  <p className="mt-2 text-xs text-slate-500">Note: this assumes the same effect size and variability in every {subgroupLabel || "group"} level. If you expect the effect to differ by {subgroupLabel || "group"}, each level may need its own separate power calculation.</p>
                </div>
                <div className="rounded bg-slate-100 p-4 text-sm ring-2 ring-slate-300">
                  <strong>Question 2 — Does the effect differ between {subgroupLabel || "group"} levels? (the interaction)</strong>
                  <p className="mt-1 text-slate-700">Detecting whether the effect is different across {subgroupLabel || "group"} levels requires roughly <strong>4× the per-group N</strong> of the main effect — approximately <strong>{subgroupTotals.interactionN} per treatment group per {subgroupLabel || "group"} level</strong>, or <strong>{subgroupTotals.interactionTotal} participants total</strong>. This is often not feasible in a student project.</p>
                  <p className="mt-2 text-xs text-slate-500">If your study is not powered for the interaction (Question 2), you can still report the within-{subgroupLabel || "group"} effects (Question 1) and acknowledge that the study was not designed to detect differences between {subgroupLabel || "group"} levels.</p>
                </div>
              </div>
            )}

            {/* Underpowered warning box */}
            {isCapped && (
              <div className="mb-4 rounded bg-amber-50 p-4 text-sm ring-2 ring-amber-300">
                <strong>⚠ This study is underpowered at the practical sample size.</strong>
                <p className="mt-2">A fully powered study would require <strong>{requiredLabel}</strong>. The practical limit for this project is <strong>{cappedLabel}</strong>.</p>
                <p className="mt-2"><strong>Stick to the practical limit unless your simulations are fast enough to go higher.</strong> If each HumMod simulation takes only a few seconds, consider running more participants — as many as you can feasibly manage — up to the fully powered N of {requiredLabel}. The closer you get to the powered sample size, the more confident you can be in your result.</p>
                <p className="mt-2"><strong>What to write if your result is not significant:</strong> Note that the study was underpowered due to practical constraints on the number of simulations that could be conducted. If the observed effect is in the expected direction and the p-value is close to your threshold, state that the result is consistent with the hypothesized effect but that a larger study ({requiredLabel}) would be needed to confirm it with adequate statistical power.</p>
              </div>
            )}

            {/* Interpretation callout */}
            {teachingText && (
              <div className="mb-4 rounded bg-blue-700 p-4 text-sm text-white">
                <strong>What this means:</strong>
                <p className="mt-1">{teachingText}</p>
              </div>
            )}

            {/* Paste-ready justification */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <strong className="text-sm">Paste-ready justification for your methods section</strong>
                <button
                  type="button"
                  className="rounded border border-slate-300 bg-white px-3 py-1 text-xs hover:border-slate-500"
                  onClick={copyText}
                >
                  Copy
                </button>
              </div>
              <textarea
                value={isCapped ? assumptionsText + " " + underpoweredNote : assumptionsText}
                readOnly
                className="min-h-[200px] w-full rounded border bg-white p-3 text-sm leading-6"
              />
              <p className="mt-2 text-xs text-slate-500">You can edit this text after pasting it into your methods section.</p>
            </div>

            <div className="mt-4 rounded bg-amber-50 p-3 text-xs text-slate-700">
              <strong>Caveat:</strong> This tool uses a normal-approximation formula and is intended as a defensible starting point for student projects. For high-stakes studies, consult G*Power or a statistician.
            </div>
          </Panel>
        )}
      </div>

      {/* Start Over button — matches the first app */}
      <div className="mx-auto max-w-5xl pt-2 pb-8">
        <button
          type="button"
          className="w-full rounded-2xl border-2 border-slate-300 bg-white py-3 text-sm font-semibold text-slate-500 transition hover:border-slate-500 hover:text-slate-800"
          onClick={() => {
            setState(INITIAL_STATE);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          ↺ Start Over
        </button>
      </div>
    </div>
  );
}
