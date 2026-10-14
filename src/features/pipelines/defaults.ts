import type { StageCategory } from "@/generated/prisma/enums";

export type DefaultStage = { name: string; category: StageCategory; color: string };

/** Default pipeline created during onboarding. Users can change all of it. */
export const DEFAULT_PIPELINE_NAME = "Job search";

export const DEFAULT_STAGES: DefaultStage[] = [
  { name: "Applied", category: "APPLIED", color: "#8b92bf" },
  { name: "Recruiter Screening", category: "SCREENING", color: "#d0a16d" },
  { name: "Assessment", category: "ASSESSMENT", color: "#78a0bc" },
  { name: "Technical Interview", category: "INTERVIEW", color: "#5da3a7" },
  { name: "Final Interview", category: "INTERVIEW", color: "#a884bc" },
  { name: "Job Offer", category: "OFFER", color: "#4ba374" },
];

export const STAGE_CATEGORY_LABEL: Record<StageCategory, string> = {
  APPLIED: "Applied",
  SCREENING: "Screening",
  ASSESSMENT: "Assessment",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  OTHER: "Other",
};

/** Colour used for a new custom stage, by category. */
export const CATEGORY_COLOR: Record<StageCategory, string> = {
  APPLIED: "#8b92bf",
  SCREENING: "#d0a16d",
  ASSESSMENT: "#78a0bc",
  INTERVIEW: "#5da3a7",
  OFFER: "#4ba374",
  OTHER: "#9dac9a",
};
