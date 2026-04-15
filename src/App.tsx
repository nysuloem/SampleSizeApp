import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Calculator, FlaskConical, Info, Users, Sigma, ChartScatter, Copy } from "lucide-react";

function erf(x: number) {
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-x * x);
  return sign * y;
}

function inverseNormalCdf(p: number) {
  if (p <= 0 || p >= 1) return NaN;
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const plow = 0.02425;
  const phigh = 1 - plow;
  let q: number;
  let r: number;

  if (p < plow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > phigh) {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }

  q = p - 0.5;
  r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

function roundUp(value: number) {
  if (!Number.isFinite(value)) return NaN;
  return Math.max(3, Math.ceil(value));
}

function calcTwoGroupSampleSize(effect: number, sd: number, alpha: number, power: number) {
  if (effect <= 0 || sd <= 0) return null;
  const zAlpha = inverseNormalCdf(1 - alpha / 2);
  const zPower = inverseNormalCdf(power);
  const d = effect / sd;
  const nPerGroup = 2 * Math.pow((zAlpha + zPower) / d, 2);
  return {
    standardizedEffect: d,
    nPerGroup: roundUp(nPerGroup),
  };
}

function calcPairedSampleSize(effect: number, sdDiff: number, alpha: number, power: number) {
  if (effect <= 0 || sdDiff <= 0) return null;
  const zAlpha = inverseNormalCdf(1 - alpha / 2);
  const zPower = inverseNormalCdf(power);
  const dz = effect / sdDiff;
  const nPairs = Math.pow((zAlpha + zPower) / dz, 2);
  return {
    standardizedEffect: dz,
    nPairs: roundUp(nPairs),
  };
}

function calcCorrelationSampleSize(r: number, alpha: number, power: number) {
  if (r <= 0 || r >= 1) return null;
  const zAlpha = inverseNormalCdf(1 - alpha / 2);
  const zPower = inverseNormalCdf(power);
  const fisher = 0.5 * Math.log((1 + r) / (1 - r));
  const n = Math.pow((zAlpha + zPower) / fisher, 2) + 3;
  return {
    n: roundUp(n),
  };
}

function calcMultiGroupSampleSize(effect: number, sd: number, groups: number, alpha: number, power: number) {
  if (effect <= 0 || sd <= 0 || groups < 3) return null;
  const zAlpha = inverseNormalCdf(1 - alpha / 2);
  const zPower = inverseNormalCdf(power);
  const d = effect / sd;
  const twoGroupEquivalent = 2 * Math.pow((zAlpha + zPower) / d, 2);
  const inflation = 1 + 0.2 * (groups - 2);
  const nPerGroup = twoGroupEquivalent * inflation;
  return {
    standardizedEffect: d,
    nPerGroup: roundUp(nPerGroup),
    totalN: roundUp(nPerGroup) * groups,
  };
}

function interpretMagnitude(value: number, type: "d" | "r") {
  if (!Number.isFinite(value)) return "Unclear";
  if (type === "d") {
    if (value < 0.2) return "Very small";
    if (value < 0.5) return "Small";
    if (value < 0.8) return "Moderate";
    return "Large";
  }
  if (value < 0.1) return "Very small";
  if (value < 0.3) return "Small";
  if (value < 0.5) return "Moderate";
  return "Large";
}

export default function PowerAnalysisStudentApp() {
  const [design, setDesign] = useState("two-group");
  const [alpha, setAlpha] = useState(0.05);
  const [power, setPower] = useState(0.8);
  const [biologicalQuestion, setBiologicalQuestion] = useState("");
  const [outcome, setOutcome] = useState("");
  const [units, setUnits] = useState("");

  const [effect, setEffect] = useState(10);
  const [sd, setSd] = useState(12);
  const [sdDiff, setSdDiff] = useState(10);
  const [r2, setR2] = useState(0.12);
  const [groups, setGroups] = useState(3);

  const [variabilitySource, setVariabilitySource] = useState<"" | "hummod" | "literature">("");

  const result = useMemo(() => {
    if (design === "two-group") return calcTwoGroupSampleSize(effect, sd, alpha, power);
    if (design === "paired") return calcPairedSampleSize(effect, sdDiff, alpha, power);
    if (design === "correlation") {
      const r = Math.sqrt(r2);
      return calcCorrelationSampleSize(r, alpha, power);
    }
    return calcMultiGroupSampleSize(effect, sd, groups, alpha, power);
  }, [design, effect, sd, sdDiff, r2, groups, alpha, power]);

  const variabilitySourceText = useMemo(() => {
    if (variabilitySource === "hummod") return "a pilot experiment in HumMod";
    if (variabilitySource === "literature") return "prior studies in the literature";
    return "an estimated source of variability";
  }, [variabilitySource]);

  const assumptionsText = useMemo(() => {
    if (design === "two-group" && result && "nPerGroup" in result) {
      return `We estimated that a biologically meaningful difference in ${outcome || "the outcome variable"} would be ${effect} ${units || "units"} between the treatment and control groups. We estimated the standard deviation to be ${sd} ${units || "units"}, based on ${variabilitySourceText}. Using a two-sided alpha of ${alpha.toFixed(2)} and desired power of ${(power * 100).toFixed(0)}%, the estimated required sample size is ${result.nPerGroup} participants per group.`;
    }
    if (design === "paired" && result && "nPairs" in result) {
      return `We estimated that a biologically meaningful difference in ${outcome || "the outcome variable"} would be ${effect} ${units || "units"} between conditions. We estimated the standard deviation of the paired differences to be ${sdDiff} ${units || "units"}, based on ${variabilitySourceText}. Using a two-sided alpha of ${alpha.toFixed(2)} and desired power of ${(power * 100).toFixed(0)}%, the estimated required sample size is ${result.nPairs} participants.`;
    }
    if (design === "correlation" && result && "n" in result) {
      return `We estimated that a biologically meaningful association would correspond to a an r² value of ${r2.toFixed(2)} (r ≈ ${Math.sqrt(r2).toFixed(2)}) between the two variables. Using a two-sided alpha of ${alpha.toFixed(2)} and desired power of ${(power * 100).toFixed(0)}%, the estimated required sample size is ${result.n} participants.`;
    }
    if (design === "anova" && result && "nPerGroup" in result && "totalN" in result) {
      return `We estimated that the experiment would include ${groups} independent groups. We estimated that a biologically meaningful difference between any two groups would be ${effect} ${units || "units"}, and that the standard deviation would be ${sd} ${units || "units"}, based on ${variabilitySourceText}. Using a two-sided alpha of ${alpha.toFixed(2)} and desired power of ${(power * 100).toFixed(0)}%, the estimated required sample size is ${result.nPerGroup} participants per group (${result.totalN} total).`;
    }
    return "Enter values to generate a sample size justification.";
  }, [design, result, outcome, units, effect, sd, sdDiff, r2, alpha, power, groups, variabilitySourceText]);

  const teachingText = useMemo(() => {
    if (design === "two-group" && result && "standardizedEffect" in result) {
      return `Your standardized effect size is d = ${result.standardizedEffect.toFixed(2)} (${interpretMagnitude(result.standardizedEffect, "d")}). Larger effects reduce required sample size. Greater variability increases required sample size.`;
    }
    if (design === "paired" && result && "standardizedEffect" in result) {
      return `Your standardized paired effect size is dz = ${result.standardizedEffect.toFixed(2)} (${interpretMagnitude(result.standardizedEffect, "d")}). Paired designs often need fewer subjects when within-subject variability is lower than between-subject variability.`;
    }
    if (design === "correlation" && result && "n" in result) {
      return `You are powered to detect an association of about r² = ${r2.toFixed(2)} (r ≈ ${Math.sqrt(r2).toFixed(2)}; ${interpretMagnitude(Math.sqrt(r2), "r")}). Smaller associations require much larger sample sizes.`;
    }
    if (design === "anova" && result && "standardizedEffect" in result && "totalN" in result) {
      return `Your multi-group design uses the same core logic as the two-group design: smaller meaningful differences and greater variability increase the required sample size. The current approximation adds a modest inflation for having ${groups} groups.`;
    }
    return "";
  }, [design, result, r2, groups]);

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(assumptionsText);
    } catch {
      // no-op
    }
  };

  const clearExample = () => {
    setBiologicalQuestion("");
    setOutcome("");
    setUnits("");
    setDesign("two-group");
    setEffect(10);
    setSd(12);
    setSdDiff(10);
    setR2(0.12);
    setGroups(3);
    setVariabilitySource("");
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border bg-white p-2 shadow-sm">
                <Calculator className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-2xl">Sample Size & Power Guide</CardTitle>
                <CardDescription>
                  Use this tool to estimate and justify a defensible sample size for your experiment.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border bg-white p-2 shadow-sm">
                <FlaskConical className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Study Design Info</CardTitle>
                <CardDescription>
                  Describe your experiment and enter the key assumptions needed to estimate sample size.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Research question</Label>
                <Textarea
                  value={biologicalQuestion}
                  onChange={(e) => setBiologicalQuestion(e.target.value)}
                  className="min-h-[90px]"
                  placeholder="Enter your research question here"
                />
              </div>
              <div className="space-y-2">
                <Label>What kind of statistical test are you planning?</Label>
                <Select value={design} onValueChange={setDesign}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="two-group">Two independent groups</SelectItem>
                    <SelectItem value="paired">Paired / repeated measures</SelectItem>
                    <SelectItem value="correlation">Correlation / association</SelectItem>
                    <SelectItem value="anova">3 or more independent groups</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Outcome variable name</Label>
                <Input
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  placeholder="e.g., Sweat rate"
                />
              </div>
              <div className="space-y-2">
                <Label>Units</Label>
                <Input
                  value={units}
                  onChange={(e) => setUnits(e.target.value)}
                  placeholder="e.g., mL/min or mmol/L"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="rounded-2xl"
                onClick={() => {
                  setDesign("two-group");
                  setBiologicalQuestion("Differences in sweat rate between males and females during exercise");
                  setOutcome("Sweat rate");
                  setUnits("mL/min");
                  setEffect(0.3);
                  setSd(0.4);
                }}
              >
                Sweat rate example
              </Button>
              <Button
                variant="outline"
                className="rounded-2xl"
                onClick={() => {
                  setDesign("paired");
                  setBiologicalQuestion("Effect of lisinopril on OGTT response");
                  setOutcome("Blood glucose at 2 hours post-consumption");
                  setUnits("mmol/L");
                  setEffect(1.5);
                  setSdDiff(2);
                }}
              >
                Lisinopril OGTT example
              </Button>
              <Button
                variant="outline"
                className="rounded-2xl"
                onClick={() => {
                  setDesign("correlation");
                  setBiologicalQuestion("Is plasma insulin correlated with plasma cortisol in T1D patients?");
                  setOutcome("Plasma insulin and plasma cortisol");
                  setUnits("pmol/L and nmol/L");
                  setR2(0.12);
                }}
              >
                T1D Example
              </Button>
              <Button
                className="rounded-2xl bg-red-500 text-white hover:bg-red-600"
                onClick={clearExample}
              >
                Clear info
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border bg-white p-2 shadow-sm">
                  <FlaskConical className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Sample Size Assumptions</CardTitle>
                  <CardDescription>
                    Enter the biologically meaningful effect and the expected variability for your design.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {design === "two-group" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Biologically meaningful difference in your outcome variable between groups</Label>
                    <Input type="number" value={effect} onChange={(e) => setEffect(Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Estimated SD</Label>
                    <Input type="number" min={0} value={sd} onChange={(e) => setSd(Math.max(0, Number(e.target.value)))} />
                    <p className="text-xs text-slate-500">Estimate the spread you would expect among participants.</p>
                  </div>
                </div>
              )}

              {design === "paired" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Biologically meaningful difference in your outcome variable between conditions</Label>
                    <Input type="number" value={effect} onChange={(e) => setEffect(Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Estimated SD of paired differences</Label>
                    <Input type="number" min={0} value={sdDiff} onChange={(e) => setSdDiff(Math.max(0, Number(e.target.value)))} />
                    <p className="text-xs text-slate-500">This is the spread of the within-subject differences across conditions.</p>
                  </div>
                </div>
              )}

              {design === "correlation" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Expected biologically meaningful correlation</Label>
                    <span className="text-sm text-slate-600">r² = {r2.toFixed(2)}</span>
                  </div>
                  <Slider value={[r2]} min={0.01} max={0.8} step={0.01} onValueChange={(v) => setR2(v[0])} />
                  <p className="text-xs text-slate-500">Example: r² represents the proportion of variation in the outcome variable explained by the other variable (e.g., r² = 0.25 means 25% explained).</p>
                </div>
              )}

              {design === "anova" && (
                <div className="space-y-4 rounded-2xl border p-4">
                  <p className="text-sm text-slate-700">
                    <strong>Recommendation:</strong> We recommend using a study design with no more than 2 groups unless absolutely necessary.
                  </p>
                  <p className="text-sm text-slate-600">
                    If you proceed with 3 or more groups, simplify by estimating the smallest meaningful difference between any two groups and the expected SD.
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Number of groups</Label>
                      <Input type="number" min={3} value={groups} onChange={(e) => setGroups(Number(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Estimated SD</Label>
                      <Input type="number" min={0} value={sd} onChange={(e) => setSd(Math.max(0, Number(e.target.value)))} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Biologically meaningful difference between any two groups</Label>
                      <Input type="number" value={effect} onChange={(e) => setEffect(Number(e.target.value))} />
                    </div>
                  </div>
                </div>
              )}

              {design !== "correlation" && (
                <div className="space-y-4 rounded-2xl border p-4">
                  <Label>Where did your variability estimate come from?</Label>
                  <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
                    <label className="flex items-center gap-2"><input type="checkbox" checked={variabilitySource === "hummod"} onChange={(e) => setVariabilitySource(e.target.checked ? "hummod" : "")} /> Pilot experiment in HumMod</label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={variabilitySource === "literature"} onChange={(e) => setVariabilitySource(e.target.checked ? "literature" : "")} /> Prior studies in the literature</label>
                  </div>
                </div>
              )}

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Alpha</Label>
                    <span className="text-sm text-slate-600">{alpha.toFixed(2)}</span>
                  </div>
                  <Slider value={[alpha]} min={0.01} max={0.1} step={0.01} onValueChange={(v) => setAlpha(v[0])} />
                  <p className="text-xs leading-5 text-slate-500">
                    Alpha is the P-value threshold used for statistical significance. The usual default is 0.05, meaning researchers accept about a 5% chance of concluding there is an effect when there really is not one. Most students should leave this at 0.05, but you can adjust it to see how stricter or looser thresholds affect sample size.
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Desired power</Label>
                    <span className="text-sm text-slate-600">{(power * 100).toFixed(0)}%</span>
                  </div>
                  <Slider value={[power]} min={0.6} max={0.95} step={0.01} onValueChange={(v) => setPower(v[0])} />
                  <p className="text-xs leading-5 text-slate-500">
                    Power is the probability that your experiment will detect the effect if the effect is real. The usual default is 80%, which is a common compromise between scientific rigor and practical feasibility. Most students should leave this at 80%, but you can adjust it to see how wanting more certainty increases sample size.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="rounded-2xl border-slate-200 shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border bg-white p-2 shadow-sm">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle>Estimated sample size</CardTitle>
                    <CardDescription>Approximate starting point for planning.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {design === "two-group" && result && "nPerGroup" in result && (
                  <div className="rounded-2xl border bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Required sample size</p>
                    <p className="text-3xl font-semibold">{result.nPerGroup} per group</p>
                  </div>
                )}
                {design === "paired" && result && "nPairs" in result && (
                  <div className="rounded-2xl border bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Required sample size</p>
                    <p className="text-3xl font-semibold">{result.nPairs} participants</p>
                  </div>
                )}
                {design === "correlation" && result && "n" in result && (
                  <div className="rounded-2xl border bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Required sample size</p>
                    <p className="text-3xl font-semibold">{result.n} participants</p>
                  </div>
                )}
                {design === "anova" && result && "nPerGroup" in result && "totalN" in result && (
                  <div className="rounded-2xl border bg-slate-50 p-4 space-y-1">
                    <p className="text-sm text-slate-500">Required sample size</p>
                    <p className="text-3xl font-semibold">{result.nPerGroup} per group</p>
                    <p className="text-sm text-slate-600">Total N ≈ {result.totalN}</p>
                  </div>
                )}
                <div className="rounded-2xl border p-4 text-sm leading-6 text-slate-700">
                  {teachingText}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-slate-200 shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border bg-white p-2 shadow-sm">
                    <Sigma className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle>Paste-ready justification</CardTitle>
                    <CardDescription>Students can adapt this into their methods section.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea value={assumptionsText} readOnly className="min-h-[180px]" />
                <Button className="w-full rounded-2xl" onClick={copyText}>
                  <Copy className="mr-2 h-4 w-4" /> Copy justification
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        
      </div>
    </div>
  );
}
