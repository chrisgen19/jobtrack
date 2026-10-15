/**
 * Fills an existing LOCAL account with fictional data that covers every
 * scenario, option and label in JobTrack, so the UI can be reviewed with
 * realistic content (unlike `pnpm db:seed`, which only recreates demo users).
 *
 *   pnpm db:mock <email> [--reset]
 *
 * Register and onboard the account first. Refuses non-local databases.
 * Refuses an account that already has jobs unless --reset is given; --reset
 * deletes that account's jobs, companies, tags, tasks, documents,
 * notifications and reminders and restores the default pipeline (the login
 * and preferences stay). Dates are relative to today in the account's timezone.
 */
import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import type {
  ActivityType,
  ApplicationMethod,
  ApplicationOutcome,
  ContactKind,
  DocumentKind,
  EmploymentType,
  InterviewMode,
  InterviewResult,
  InterviewType,
  OfferStatus,
  Priority,
  SalaryBasis,
  SalaryPeriod,
  TaskStatus,
  TaskType,
  WorkArrangement,
} from "@/generated/prisma/enums";
import { normalizeCompanyName } from "@/features/companies/normalize";
import { syncReminders } from "@/features/integrations/side-effects";
import { normalizePostingUrl } from "@/features/opportunities/normalize";
import { ensureDefaultPipeline } from "@/features/pipelines/create-default";
import { addDaysToDateOnly, formatInTimeZone, parseDateOnly, todayInTimeZone, zonedToUtc } from "@/lib/dates";
import { getStorage } from "@/lib/integrations/storage";
import { APPLICATION_OUTCOME_LABEL, DOCUMENT_KIND_LABEL, INTERVIEW_RESULT_LABEL } from "@/lib/labels";
import { formatMoney, PERIOD_SUFFIX } from "@/lib/money";
import { prisma, type TransactionClient } from "@/lib/prisma";

// ---------------------------------------------------------------- data ----

type StageKey = "applied" | "screening" | "assessment" | "coding" | "technical" | "final" | "offer";
const ORDER: StageKey[] = ["applied", "screening", "assessment", "coding", "technical", "final", "offer"];

type Salary = { currency: string; min?: number; max?: number; period: SalaryPeriod; basis: SalaryBasis };
type ExtraEvent = { daysAgo: number; type: ActivityType; summary: string; details?: object };
type Job = {
  company: string;
  title: string;
  priority: Priority;
  stage?: StageKey; // omitted = saved, not applied
  appliedDaysAgo?: number;
  status?: "PAUSED" | "CLOSED";
  outcome?: ApplicationOutcome;
  closedDaysAgo?: number;
  closeNote?: string;
  closedByOffer?: boolean; // ACCEPTED / OFFER_DECLINED come from the offer decision
  salary?: Salary;
  employment?: EmploymentType;
  work?: WorkArrangement;
  location?: string;
  source?: string;
  method?: ApplicationMethod;
  referenceCode?: string;
  skills?: string[];
  notes?: string;
  applicationNotes?: string;
  tags?: string[];
  respondedAfter?: number; // days after applying
  walkStartDaysAgo?: number; // when the stage moves started (default: applied date)
  deadlineIn?: number;
  archivedDaysAgo?: number;
  restoredDaysAgo?: number;
  previousAttempt?: {
    appliedDaysAgo: number;
    closedDaysAgo: number;
    stage: StageKey;
    outcome: ApplicationOutcome;
  };
  events?: ExtraEvent[];
};

const PHP = (min: number, max: number): Salary => ({
  currency: "PHP",
  min,
  max,
  period: "MONTHLY",
  basis: "GROSS",
});

const JOBS: Job[] = [
  // Active pipeline
  {
    company: "Northstar Labs",
    title: "Senior Frontend Engineer",
    priority: "HIGH",
    stage: "technical",
    appliedDaysAgo: 12,
    respondedAfter: 2,
    salary: PHP(150000, 185000),
    employment: "FULL_TIME",
    work: "REMOTE",
    location: "Manila, PH",
    source: "LinkedIn",
    method: "LINKEDIN_EASY_APPLY",
    referenceCode: "NSL-FE-0412",
    skills: ["React", "TypeScript", "Next.js", "Design systems"],
    notes: "Strong fit for React and design systems. Prepare component architecture examples.",
    tags: ["Dream job", "Remote first"],
    previousAttempt: { appliedDaysAgo: 210, closedDaysAgo: 190, stage: "screening", outcome: "REJECTED" },
    events: [
      {
        daysAgo: 9,
        type: "NOTE_ADDED",
        summary: "Maya said the team ships weekly and pairs a lot.",
        details: { note: "Maya said the team ships weekly and pairs a lot." },
      },
    ],
  },
  {
    company: "Atlas Digital",
    title: "Full-Stack Developer",
    priority: "HIGH",
    stage: "offer",
    appliedDaysAgo: 24,
    respondedAfter: 3,
    salary: { currency: "AUD", min: 110000, max: 135000, period: "ANNUALLY", basis: "GROSS" },
    employment: "FULL_TIME",
    work: "REMOTE",
    location: "Perth, AU",
    source: "Company website",
    method: "COMPANY_WEBSITE",
    skills: ["Next.js", "PostgreSQL", "Docker"],
    notes: "Offer in negotiation. Compare salary and time-zone overlap.",
    applicationNotes: "Sophie is the hiring manager; recruiter is Ellie from their people team.",
    tags: ["Remote first"],
  },
  {
    company: "Lumen Commerce",
    title: "WordPress Engineer",
    priority: "HIGH",
    stage: "screening",
    appliedDaysAgo: 8,
    respondedAfter: 3,
    salary: { currency: "AUD", min: 95000, max: 115000, period: "ANNUALLY", basis: "GROSS" },
    employment: "FULL_TIME",
    work: "REMOTE",
    location: "Melbourne, AU",
    source: "LinkedIn",
    method: "JOB_BOARD",
    skills: ["WordPress", "PHP", "WooCommerce"],
    tags: ["Agency"],
  },
  {
    company: "Cedar Systems",
    title: "Software Engineer",
    priority: "HIGH",
    stage: "final",
    appliedDaysAgo: 23,
    respondedAfter: 4,
    salary: PHP(135000, 165000),
    employment: "FULL_TIME",
    work: "HYBRID",
    location: "Makati, PH",
    source: "Referral",
    method: "REFERRAL",
    skills: ["Next.js", "API design", "PostgreSQL"],
    events: [{ daysAgo: 20, type: "APPLICATION_UPDATED", summary: "Application details updated" }],
  },
  {
    company: "Gather Labs",
    title: "Full Stack Engineer",
    priority: "HIGH",
    stage: "coding",
    appliedDaysAgo: 13,
    respondedAfter: 2,
    salary: PHP(145000, 175000),
    employment: "FULL_TIME",
    work: "REMOTE",
    location: "Manila, PH",
    source: "LinkedIn",
    method: "JOB_BOARD",
    skills: ["React", "Node.js", "PostgreSQL"],
    tags: ["Startup"],
  },
  {
    company: "Brightside Studio",
    title: "Frontend Developer",
    priority: "MEDIUM",
    stage: "applied",
    appliedDaysAgo: 4,
    salary: PHP(105000, 135000),
    employment: "FULL_TIME",
    work: "REMOTE",
    location: "Manila, PH",
    source: "JobStreet",
    method: "JOB_BOARD",
    skills: ["React", "CSS", "TypeScript"],
    tags: ["Agency"],
  },
  {
    company: "NovaStack",
    title: "Next.js Developer",
    priority: "HIGH",
    stage: "applied",
    appliedDaysAgo: 3,
    salary: PHP(130000, 160000),
    employment: "FULL_TIME",
    work: "REMOTE",
    location: "Manila, PH",
    source: "LinkedIn",
    method: "LINKEDIN_EASY_APPLY",
    skills: ["Next.js", "TypeScript", "Tailwind"],
    tags: ["Startup"],
  },
  {
    company: "Harbor Cloud",
    title: "Backend Developer",
    priority: "MEDIUM",
    stage: "applied",
    appliedDaysAgo: 10,
    salary: { currency: "USD", min: 33000, max: 42000, period: "ANNUALLY", basis: "GROSS" },
    employment: "FULL_TIME",
    work: "REMOTE",
    location: "Global",
    source: "RemoteOK",
    method: "JOB_BOARD",
    skills: ["Node.js", "Docker", "APIs"],
    events: [
      { daysAgo: 7, type: "APPLICATION_PAUSED", summary: "Application paused" },
      { daysAgo: 3, type: "APPLICATION_RESUMED", summary: "Application resumed" },
    ],
  },
  {
    company: "Pine & Pixel",
    title: "Senior Web Developer",
    priority: "MEDIUM",
    stage: "screening",
    appliedDaysAgo: 15,
    respondedAfter: 5,
    salary: PHP(115000, 145000),
    employment: "FULL_TIME",
    work: "HYBRID",
    location: "BGC, PH",
    source: "JobStreet",
    method: "JOB_BOARD",
    skills: ["PHP", "WordPress", "JavaScript"],
  },
  {
    company: "Reframe Digital",
    title: "Senior React Developer",
    priority: "MEDIUM",
    stage: "technical",
    appliedDaysAgo: 18,
    respondedAfter: 3,
    salary: PHP(140000, 180000),
    employment: "FULL_TIME",
    work: "REMOTE",
    location: "Manila, PH",
    source: "Referral",
    method: "REFERRAL",
    skills: ["React", "Jest", "TypeScript"],
  },
  {
    company: "Kite & Key",
    title: "Contract React Developer",
    priority: "MEDIUM",
    stage: "assessment",
    appliedDaysAgo: 9,
    respondedAfter: 1,
    salary: { currency: "USD", min: 35, max: 45, period: "HOURLY", basis: "NET" },
    employment: "CONTRACT",
    work: "REMOTE",
    location: "Global",
    source: "Upwork",
    method: "OTHER",
    skills: ["React", "React Native"],
    tags: ["Contract"],
  },
  {
    company: "Bayside Agency",
    title: "Freelance WordPress Developer",
    priority: "LOW",
    stage: "applied",
    appliedDaysAgo: 6,
    salary: { currency: "PHP", min: 4000, max: 6000, period: "DAILY", basis: "GROSS" },
    employment: "FREELANCE",
    work: "HYBRID",
    location: "Cebu, PH",
    source: "OnlineJobs.ph",
    method: "EMAIL",
    skills: ["WordPress", "Elementor", "SEO"],
    tags: ["Agency", "Contract"],
  },
  {
    company: "Quarry Analytics",
    title: "Part-time Frontend Developer",
    priority: "MEDIUM",
    stage: "screening",
    appliedDaysAgo: 11,
    respondedAfter: 3,
    salary: { currency: "SGD", min: 900, max: 1200, period: "WEEKLY", basis: "GROSS" },
    employment: "PART_TIME",
    work: "REMOTE",
    location: "Singapore",
    source: "Recruiter (Tech Talent Asia)",
    method: "RECRUITER",
    skills: ["Vue", "TypeScript", "D3"],
  },
  {
    company: "Meridian Bank",
    title: "Software Engineering Intern",
    priority: "LOW",
    stage: "applied",
    appliedDaysAgo: 26,
    status: "PAUSED",
    salary: PHP(25000, 30000),
    employment: "INTERNSHIP",
    work: "ONSITE",
    location: "BGC, PH",
    source: "Kalibrr",
    method: "COMPANY_WEBSITE",
    skills: ["Java", "SQL"],
    applicationNotes: "Paused: hiring freeze until next quarter.",
    events: [{ daysAgo: 5, type: "APPLICATION_PAUSED", summary: "Application paused" }],
  },
  {
    company: "Tidewater Logistics",
    title: "Web Developer (3-month contract)",
    priority: "MEDIUM",
    stage: "technical",
    appliedDaysAgo: 7,
    respondedAfter: 2,
    salary: { currency: "GBP", min: 40000, max: 48000, period: "ANNUALLY", basis: "UNKNOWN" },
    employment: "TEMPORARY",
    work: "HYBRID",
    location: "London, UK",
    source: "LinkedIn",
    method: "LINKEDIN_EASY_APPLY",
    referenceCode: "TW-2026-114",
    skills: ["TypeScript", "Angular"],
  },
  {
    company: "Summit Health",
    title: "Senior Engineer, Platform",
    priority: "MEDIUM",
    stage: "applied",
    appliedDaysAgo: 35,
    salary: PHP(120000, 150000),
    employment: "OTHER",
    work: "ONSITE",
    location: "Quezon City, PH",
    source: "Indeed",
    method: "JOB_BOARD",
    skills: ["Go", "Kubernetes"],
    notes: "No reply in over a month.",
  },
  // Minimal record: only what quick-add requires, plus an application date.
  {
    company: "Lantern Learning",
    title: "Frontend Engineer",
    priority: "MEDIUM",
    stage: "applied",
    appliedDaysAgo: 2,
  },
  {
    company: "Kestrel Data",
    title: "Data Platform Engineer",
    priority: "MEDIUM",
    stage: "screening",
    appliedDaysAgo: 50,
    respondedAfter: 44,
    walkStartDaysAgo: 6,
    salary: PHP(140000, 170000),
    employment: "FULL_TIME",
    work: "REMOTE",
    location: "Manila, PH",
    source: "LinkedIn",
    method: "LINKEDIN_EASY_APPLY",
    skills: ["Python", "dbt", "Airflow"],
    events: [
      {
        daysAgo: 20,
        type: "APPLICATION_CLOSED",
        summary: `Closed: ${APPLICATION_OUTCOME_LABEL.NO_RESPONSE}`,
        details: { outcome: "NO_RESPONSE" },
      },
      {
        daysAgo: 6,
        type: "APPLICATION_REOPENED",
        summary: "Application reopened",
        details: { previousOutcome: "NO_RESPONSE" },
      },
    ],
  },
  {
    company: "Sapling Studio",
    title: "Lead Frontend Developer",
    priority: "HIGH",
    stage: "offer",
    appliedDaysAgo: 30,
    respondedAfter: 4,
    salary: PHP(160000, 190000),
    employment: "FULL_TIME",
    work: "REMOTE",
    location: "Manila, PH",
    source: "Company website",
    method: "COMPANY_WEBSITE",
    skills: ["React", "Leadership"],
    tags: ["Startup"],
  },
  {
    company: "Willow Bank",
    title: "Full-Stack Engineer",
    priority: "MEDIUM",
    stage: "offer",
    appliedDaysAgo: 45,
    respondedAfter: 6,
    salary: PHP(130000, 150000),
    employment: "FULL_TIME",
    work: "HYBRID",
    location: "Ortigas, PH",
    source: "JobStreet",
    method: "JOB_BOARD",
    skills: ["Java", "React"],
    notes: "Let the deadline pass while waiting on Atlas.",
  },
  // Closed attempts, one per outcome
  {
    company: "Rivet Health",
    title: "Senior PHP Developer",
    priority: "LOW",
    stage: "technical",
    appliedDaysAgo: 33,
    respondedAfter: 5,
    status: "CLOSED",
    outcome: "REJECTED",
    closedDaysAgo: 5,
    closeNote: "They went with someone with more Laravel experience.",
    salary: PHP(125000, 145000),
    employment: "FULL_TIME",
    work: "ONSITE",
    location: "Makati, PH",
    source: "JobStreet",
    method: "JOB_BOARD",
    skills: ["PHP", "Laravel", "MySQL"],
  },
  {
    company: "Ventureline",
    title: "UI Engineer",
    priority: "MEDIUM",
    stage: "screening",
    appliedDaysAgo: 48,
    respondedAfter: 6,
    status: "CLOSED",
    outcome: "WITHDRAWN",
    closedDaysAgo: 30,
    closeNote: "Role moved to fully onsite.",
    salary: PHP(115000, 145000),
    employment: "FULL_TIME",
    work: "REMOTE",
    location: "Manila, PH",
    source: "LinkedIn",
    method: "LINKEDIN_EASY_APPLY",
    skills: ["React", "Design systems"],
  },
  {
    company: "Orchid Fintech",
    title: "Frontend Lead",
    priority: "HIGH",
    stage: "offer",
    appliedDaysAgo: 60,
    respondedAfter: 3,
    status: "CLOSED",
    outcome: "OFFER_DECLINED",
    closedDaysAgo: 32,
    closedByOffer: true,
    salary: { currency: "EUR", min: 70000, max: 85000, period: "ANNUALLY", basis: "GROSS" },
    employment: "FULL_TIME",
    work: "REMOTE",
    location: "Berlin, DE (remote)",
    source: "Referral",
    method: "REFERRAL",
    skills: ["React", "Fintech"],
  },
  {
    company: "Granite Works",
    title: "Full-Stack Engineer",
    priority: "HIGH",
    stage: "offer",
    appliedDaysAgo: 150,
    respondedAfter: 4,
    status: "CLOSED",
    outcome: "ACCEPTED",
    closedDaysAgo: 121,
    closedByOffer: true,
    salary: PHP(110000, 130000),
    employment: "FULL_TIME",
    work: "HYBRID",
    location: "Pasig, PH",
    source: "LinkedIn",
    method: "LINKEDIN_EASY_APPLY",
    skills: ["Laravel", "Vue"],
    notes: "Previous job search: accepted this one last cycle.",
  },
  {
    company: "Beacon Retail",
    title: "E-commerce Developer",
    priority: "LOW",
    stage: "applied",
    appliedDaysAgo: 70,
    status: "CLOSED",
    outcome: "NO_RESPONSE",
    closedDaysAgo: 40,
    salary: PHP(90000, 110000),
    employment: "FULL_TIME",
    work: "ONSITE",
    location: "Mandaluyong, PH",
    source: "JobStreet",
    method: "JOB_BOARD",
    skills: ["Shopify", "Liquid"],
  },
  {
    company: "Polar Systems",
    title: "Frontend Developer",
    priority: "MEDIUM",
    stage: "screening",
    appliedDaysAgo: 20,
    respondedAfter: 4,
    status: "CLOSED",
    outcome: "ROLE_CANCELLED",
    closedDaysAgo: 1,
    closeNote: "Role put on hold indefinitely.",
    salary: PHP(100000, 125000),
    employment: "FULL_TIME",
    work: "REMOTE",
    location: "Manila, PH",
    source: "LinkedIn",
    method: "JOB_BOARD",
    skills: ["React", "Redux"],
  },
  {
    company: "Driftwood Labs",
    title: "Senior Full-Stack Engineer",
    priority: "HIGH",
    stage: "offer",
    appliedDaysAgo: 55,
    respondedAfter: 3,
    status: "CLOSED",
    outcome: "ROLE_CANCELLED",
    closedDaysAgo: 26,
    closeNote: "Offer rescinded after a budget cut.",
    salary: { currency: "USD", min: 60000, max: 75000, period: "ANNUALLY", basis: "GROSS" },
    employment: "FULL_TIME",
    work: "REMOTE",
    location: "Austin, US (remote)",
    source: "Wellfound",
    method: "JOB_BOARD",
    skills: ["Next.js", "GraphQL"],
  },
  // Saved, not applied
  {
    company: "Monograph Works",
    title: "Headless CMS Developer",
    priority: "MEDIUM",
    deadlineIn: 10,
    salary: { currency: "AUD", min: 105000, max: 125000, period: "ANNUALLY", basis: "GROSS" },
    employment: "FULL_TIME",
    work: "REMOTE",
    location: "Sydney, AU",
    source: "Company website",
    skills: ["Builder.io", "Next.js", "GraphQL"],
    tags: ["Remote first"],
    events: [{ daysAgo: 2, type: "OPPORTUNITY_UPDATED", summary: "Job details updated" }],
  },
  {
    company: "Clover Creative",
    title: "Web Platform Engineer",
    priority: "LOW",
    deadlineIn: 2,
    salary: PHP(100000, 125000),
    employment: "FULL_TIME",
    work: "HYBRID",
    location: "Pasig, PH",
    source: "Company website",
    skills: ["React", "Node.js"],
  },
  {
    company: "Paperplane Co.",
    title: "WordPress Developer",
    priority: "MEDIUM",
    deadlineIn: -3,
    salary: PHP(90000, 115000),
    employment: "FULL_TIME",
    work: "REMOTE",
    location: "Cebu, PH",
    source: "LinkedIn",
    skills: ["WordPress", "PHP", "Elementor"],
  },
  {
    company: "Juniper AI",
    title: "AI Product Engineer",
    priority: "HIGH",
    deadlineIn: 1,
    salary: PHP(170000, 210000),
    employment: "FULL_TIME",
    work: "HYBRID",
    location: "Taguig, PH",
    source: "Referral",
    skills: ["TypeScript", "LLM apps", "Python"],
    tags: ["Dream job", "Startup", "Urgent"],
  },
  {
    company: "Old Mill Media",
    title: "PHP Developer",
    priority: "LOW",
    archivedDaysAgo: 4,
    salary: PHP(70000, 90000),
    employment: "FULL_TIME",
    work: "ONSITE",
    location: "Davao, PH",
    source: "JobStreet",
    skills: ["PHP", "CodeIgniter"],
  },
  // Minimal saved job, archived then restored.
  {
    company: "Ferris Wheel Games",
    title: "Gameplay UI Developer",
    priority: "MEDIUM",
    archivedDaysAgo: 10,
    restoredDaysAgo: 2,
  },
];

const TAGS: [string, string][] = [
  ["Dream job", "#d97757"],
  ["Remote first", "#5b9e77"],
  ["Startup", "#7c6cc4"],
  ["Agency", "#c9a227"],
  ["Contract", "#4f8fbf"],
  ["Urgent", "#c4554d"],
];

type ContactSeed = {
  company: string;
  name: string;
  title: string;
  kind: ContactKind;
  email?: string;
  phone?: string;
  linkedin?: string;
  notes?: string;
};
const CONTACTS: ContactSeed[] = [
  {
    company: "Northstar Labs",
    name: "Maya Chen",
    title: "Senior Talent Partner",
    kind: "RECRUITER",
    email: "maya.chen@northstar.example",
    linkedin: "https://www.linkedin.com/in/maya-chen-demo",
    notes: "Very responsive on LinkedIn.",
  },
  {
    company: "Atlas Digital",
    name: "Sophie Reed",
    title: "Engineering Manager",
    kind: "HIRING_MANAGER",
    email: "sophie@atlas.example",
    phone: "+61 8 5550 1234",
  },
  {
    company: "Lumen Commerce",
    name: "Jordan Lee",
    title: "Recruiter",
    kind: "RECRUITER",
    email: "jordan@lumen.example",
  },
  {
    company: "Cedar Systems",
    name: "Arjun Patel",
    title: "Staff Engineer",
    kind: "INTERVIEWER",
    email: "arjun@cedar.example",
  },
  {
    company: "Cedar Systems",
    name: "Carlo Santos",
    title: "Senior Developer (former colleague)",
    kind: "REFERRER",
    phone: "+63 917 555 0142",
    notes: "Referred me; owes me a coffee update.",
  },
  { company: "Reframe Digital", name: "Lena Ortiz", title: "Principal Engineer", kind: "INTERVIEWER" },
  {
    company: "Reframe Digital",
    name: "Bea Villanueva",
    title: "Product Designer",
    kind: "REFERRER",
    linkedin: "https://www.linkedin.com/in/bea-villanueva-demo",
  },
  {
    company: "Tidewater Logistics",
    name: "Tom Becker",
    title: "Head of Digital",
    kind: "HIRING_MANAGER",
    email: "tom.becker@tidewater.example",
  },
  {
    company: "Quarry Analytics",
    name: "Priya Nair",
    title: "Consultant, Tech Talent Asia",
    kind: "RECRUITER",
    email: "priya@techtalent.example",
    phone: "+65 5550 7788",
  },
  {
    company: "Gather Labs",
    name: "Nina Park",
    title: "People Operations",
    kind: "OTHER",
    email: "nina@gather.example",
    notes: "Sends the take-home links.",
  },
];

type InterviewSeed = {
  company: string;
  title: string;
  type: InterviewType;
  mode: InterviewMode;
  offset?: number; // omitted = time not set yet
  time?: string;
  minutes?: number;
  zone?: string;
  done?: InterviewResult; // completed with this result
  resultLater?: boolean; // completed as "awaiting feedback", result recorded a day later
  cancelReason?: string;
  rescheduledFrom?: number;
  interviewers?: string;
  location?: string;
  contacts?: string[];
  updated?: boolean;
};
const INTERVIEWS: InterviewSeed[] = [
  {
    company: "Northstar Labs",
    title: "Recruiter Call",
    type: "RECRUITER_SCREEN",
    mode: "VIDEO",
    offset: -9,
    time: "14:00",
    minutes: 30,
    done: "PASSED",
    interviewers: "Maya Chen",
    contacts: ["Maya Chen"],
  },
  {
    company: "Northstar Labs",
    title: "Technical Interview",
    type: "TECHNICAL",
    mode: "VIDEO",
    offset: 1,
    time: "14:00",
    minutes: 60,
    rescheduledFrom: 0,
    interviewers: "Maya Chen, Engineering Manager",
    contacts: ["Maya Chen"],
  },
  {
    company: "Lumen Commerce",
    title: "Recruiter Call",
    type: "RECRUITER_SCREEN",
    mode: "VIDEO",
    offset: 2,
    time: "10:30",
    minutes: 30,
    interviewers: "Jordan Lee",
    contacts: ["Jordan Lee"],
  },
  {
    company: "Cedar Systems",
    title: "Technical Round 1",
    type: "TECHNICAL",
    mode: "VIDEO",
    offset: -8,
    time: "15:00",
    minutes: 60,
    done: "PASSED",
    interviewers: "Platform team",
  },
  {
    company: "Cedar Systems",
    title: "Final Panel",
    type: "PANEL",
    mode: "ONSITE",
    offset: 5,
    time: "15:00",
    minutes: 90,
    interviewers: "Hiring panel (4)",
    location: "Cedar Systems HQ, 8F Ayala Ave, Makati",
    contacts: ["Arjun Patel"],
    updated: true,
  },
  {
    company: "Reframe Digital",
    title: "Technical Round 1",
    type: "TECHNICAL",
    mode: "VIDEO",
    offset: -4,
    time: "11:00",
    minutes: 60,
    done: "PASSED",
    resultLater: true,
    interviewers: "Lena Ortiz",
  },
  {
    company: "Reframe Digital",
    title: "System Design · Round 2",
    type: "SYSTEM_DESIGN",
    mode: "VIDEO",
    offset: 6,
    time: "11:00",
    minutes: 90,
    interviewers: "Lena Ortiz, Engineering Manager",
    contacts: ["Lena Ortiz"],
  },
  {
    company: "Gather Labs",
    title: "Take-home Assignment",
    type: "CODING_CHALLENGE",
    mode: "TAKE_HOME",
    offset: 3,
    time: "18:00",
    interviewers: "Tech Lead",
  },
  {
    company: "Atlas Digital",
    title: "Hiring Manager Chat",
    type: "HIRING_MANAGER",
    mode: "VIDEO",
    offset: -10,
    time: "08:30",
    minutes: 45,
    done: "PASSED",
    interviewers: "Sophie Reed",
    contacts: ["Sophie Reed"],
  },
  {
    company: "Atlas Digital",
    title: "Final Interview",
    type: "FINAL",
    mode: "VIDEO",
    offset: -6,
    time: "09:00",
    minutes: 60,
    done: "PASSED",
    interviewers: "Sophie Reed, CTO",
    contacts: ["Sophie Reed"],
  },
  {
    company: "Rivet Health",
    title: "Technical Interview",
    type: "TECHNICAL",
    mode: "ONSITE",
    offset: -8,
    time: "10:00",
    minutes: 60,
    done: "FAILED",
    interviewers: "CTO",
    location: "Rivet Health, 12F Paseo de Roxas, Makati",
  },
  {
    company: "Quarry Analytics",
    title: "Phone Screen",
    type: "PHONE_SCREEN",
    mode: "PHONE",
    offset: -1,
    time: "15:00",
    minutes: 30,
    done: "AWAITING_FEEDBACK",
    interviewers: "Priya Nair",
    contacts: ["Priya Nair"],
  },
  {
    company: "Pine & Pixel",
    title: "Behavioral Interview",
    type: "BEHAVIORAL",
    mode: "VIDEO",
    offset: 0,
    time: "16:00",
    minutes: 45,
    interviewers: "Head of People",
  },
  {
    company: "Tidewater Logistics",
    title: "Hiring Manager Interview",
    type: "HIRING_MANAGER",
    mode: "VIDEO",
    offset: 1,
    time: "09:30",
    minutes: 45,
    zone: "Europe/London",
    interviewers: "Tom Becker",
    contacts: ["Tom Becker"],
  },
  {
    company: "Kite & Key",
    title: "Client Interview",
    type: "CLIENT",
    mode: "VIDEO",
    offset: -4,
    time: "21:00",
    minutes: 30,
    done: "PASSED",
    interviewers: "Client product owner",
  },
  {
    company: "Kite & Key",
    title: "Skills Assessment",
    type: "ASSESSMENT",
    mode: "OTHER",
    interviewers: "TBD",
  },
  {
    company: "Polar Systems",
    title: "Culture Chat",
    type: "OTHER",
    mode: "OTHER",
    offset: 2,
    time: "13:00",
    minutes: 30,
    cancelReason: "Role put on hold",
    interviewers: "Team lead",
  },
  {
    company: "Kestrel Data",
    title: "Recruiter Call",
    type: "RECRUITER_SCREEN",
    mode: "PHONE",
    offset: 4,
    time: "11:00",
    minutes: 30,
    interviewers: "Talent team",
  },
  {
    company: "Sapling Studio",
    title: "Final Interview",
    type: "FINAL",
    mode: "VIDEO",
    offset: -8,
    time: "10:00",
    minutes: 60,
    done: "PASSED",
    interviewers: "Founders",
  },
  {
    company: "Willow Bank",
    title: "Final Interview",
    type: "FINAL",
    mode: "VIDEO",
    offset: -12,
    time: "14:00",
    minutes: 60,
    done: "PASSED",
    interviewers: "Head of Engineering",
  },
  {
    company: "Orchid Fintech",
    title: "Technical Interview",
    type: "TECHNICAL",
    mode: "VIDEO",
    offset: -40,
    time: "17:00",
    minutes: 60,
    done: "PASSED",
    interviewers: "Frontend chapter lead",
  },
  {
    company: "Granite Works",
    title: "Final Interview",
    type: "FINAL",
    mode: "ONSITE",
    offset: -128,
    time: "10:00",
    minutes: 60,
    done: "PASSED",
    interviewers: "CEO",
    location: "Granite Works, Pasig",
  },
];

type Revision = {
  receivedDaysAgo: number;
  base: number;
  status: OfferStatus;
  bonus?: string;
  equity?: string;
  benefits?: string;
  startIn?: number;
  deadlineIn?: number;
  notes?: string;
};
type OfferSeed = {
  company: string;
  revisions: Revision[];
  decision?: { status: "ACCEPTED" | "DECLINED"; daysAgo: number };
};
const OFFERS: OfferSeed[] = [
  {
    company: "Atlas Digital",
    revisions: [
      {
        receivedDaysAgo: 4,
        base: 122000,
        status: "RECEIVED",
        bonus: "8% annual bonus",
        benefits: "Superannuation, 20 days leave",
        startIn: 30,
        deadlineIn: 4,
      },
      {
        receivedDaysAgo: 1,
        base: 128000,
        status: "NEGOTIATING",
        bonus: "10% annual performance bonus",
        benefits: "Superannuation, 20 days leave, equipment allowance",
        startIn: 30,
        deadlineIn: 4,
        notes: "Asked for AUD 135k; recruiter is checking with the hiring manager.",
      },
    ],
  },
  {
    company: "Sapling Studio",
    revisions: [
      {
        receivedDaysAgo: 3,
        base: 175000,
        status: "RECEIVED",
        equity: "0.25% over 4 years",
        benefits: "HMO + 2 dependents, 15 days leave",
        startIn: 21,
        deadlineIn: 9,
      },
    ],
  },
  {
    company: "Willow Bank",
    revisions: [
      {
        receivedDaysAgo: 7,
        base: 140000,
        status: "EXPIRED",
        bonus: "13th and 14th month pay",
        deadlineIn: -2,
      },
    ],
  },
  {
    company: "Orchid Fintech",
    revisions: [
      {
        receivedDaysAgo: 36,
        base: 78000,
        status: "RECEIVED",
        benefits: "Relocation optional, 28 days leave",
        deadlineIn: -32,
      },
    ],
    decision: { status: "DECLINED", daysAgo: 32 },
  },
  {
    company: "Granite Works",
    revisions: [
      {
        receivedDaysAgo: 124,
        base: 125000,
        status: "RECEIVED",
        benefits: "HMO, 15 days leave",
        startIn: -95,
        deadlineIn: -120,
      },
    ],
    decision: { status: "ACCEPTED", daysAgo: 121 },
  },
  {
    company: "Driftwood Labs",
    revisions: [
      { receivedDaysAgo: 30, base: 70000, status: "RESCINDED", equity: "0.1% over 4 years", deadlineIn: -23 },
    ],
  },
];

type TaskSeed = {
  title: string;
  type: TaskType;
  status: TaskStatus;
  company?: string;
  opportunityOnly?: boolean;
  interview?: string;
  priority?: Priority;
  due?: number | null;
  time?: string;
  description?: string;
  reason?: string;
};
const TASKS: TaskSeed[] = [
  { title: "Send follow-up email", company: "Brightside Studio", type: "FOLLOW_UP", status: "OPEN", due: -1 },
  {
    title: "Prepare system design examples",
    company: "Northstar Labs",
    interview: "Technical Interview",
    type: "INTERVIEW_PREP",
    status: "OPEN",
    due: 0,
    priority: "HIGH",
    description: "Two stories: the design system migration and the checkout rewrite.",
  },
  {
    title: "Compare compensation and benefits",
    company: "Atlas Digital",
    type: "OFFER_DECISION",
    status: "OPEN",
    due: 3,
    priority: "HIGH",
  },
  {
    title: "Review WordPress portfolio",
    company: "Lumen Commerce",
    type: "INTERVIEW_PREP",
    status: "OPEN",
    due: 1,
  },
  {
    title: "Check back with the recruiter",
    company: "Harbor Cloud",
    type: "RECRUITER_FOLLOW_UP",
    status: "OPEN",
    due: 6,
    priority: "LOW",
  },
  {
    title: "Finish the take-home assignment",
    company: "Gather Labs",
    interview: "Take-home Assignment",
    type: "ASSESSMENT",
    status: "OPEN",
    due: 2,
    priority: "HIGH",
  },
  {
    title: "Prepare questions for the panel",
    company: "Cedar Systems",
    interview: "Final Panel",
    type: "INTERVIEW_PREP",
    status: "OPEN",
    due: 4,
  },
  {
    title: "Ask about the hiring timeline",
    company: "Summit Health",
    type: "RECRUITER_FOLLOW_UP",
    status: "OPEN",
    due: -2,
  },
  {
    title: "Decide on the Sapling Studio offer",
    company: "Sapling Studio",
    type: "OFFER_DECISION",
    status: "OPEN",
    due: 8,
    priority: "HIGH",
  },
  {
    title: "Submit application",
    company: "Juniper AI",
    opportunityOnly: true,
    type: "APPLICATION",
    status: "OPEN",
    due: 1,
    priority: "HIGH",
    description: "Tailor the resume to LLM product work first.",
  },
  { title: "Update LinkedIn headline", type: "OTHER", status: "OPEN", due: null, priority: "LOW" },
  { title: "Update CV project highlights", type: "RESUME_UPDATE", status: "COMPLETED", due: -3 },
  { title: "Send thank-you note", company: "Atlas Digital", type: "FOLLOW_UP", status: "COMPLETED", due: -5 },
  {
    title: "Follow up on Next.js Developer application",
    company: "NovaStack",
    type: "FOLLOW_UP",
    status: "SUGGESTED",
    due: 4,
    reason: "application_submitted",
  },
  {
    title: "Thank Priya for the phone screen",
    company: "Quarry Analytics",
    interview: "Phone Screen",
    type: "FOLLOW_UP",
    status: "SUGGESTED",
    due: 1,
    reason: "interview_completed",
  },
  {
    title: "Follow up on Senior Engineer, Platform application",
    company: "Summit Health",
    type: "FOLLOW_UP",
    status: "DISMISSED",
    due: -28,
    reason: "application_submitted",
  },
];

type DocSeed = {
  title: string;
  label: string;
  kind: DocumentKind;
  attach: { company: string; submitted: boolean }[];
  replaces?: string;
  blocked?: boolean;
  notes?: string;
};
const DOCUMENTS: DocSeed[] = [
  {
    title: "Full-Stack Developer Resume",
    label: "v1",
    kind: "RESUME",
    attach: [
      { company: "Granite Works", submitted: true },
      { company: "Orchid Fintech", submitted: true },
    ],
  },
  {
    title: "Full-Stack Developer Resume",
    label: "v2",
    kind: "RESUME",
    replaces: "v1",
    attach: [
      { company: "Cedar Systems", submitted: true },
      { company: "Reframe Digital", submitted: true },
      { company: "Willow Bank", submitted: true },
    ],
  },
  {
    title: "Full-Stack Developer Resume",
    label: "v3",
    kind: "RESUME",
    replaces: "v2",
    notes: "Latest: adds the Next.js 16 migration.",
    attach: [
      { company: "Northstar Labs", submitted: true },
      { company: "NovaStack", submitted: true },
      { company: "Gather Labs", submitted: true },
      { company: "Sapling Studio", submitted: true },
    ],
  },
  {
    title: "WordPress Specialist Resume",
    label: "v1",
    kind: "RESUME",
    attach: [
      { company: "Lumen Commerce", submitted: true },
      { company: "Pine & Pixel", submitted: true },
      { company: "Bayside Agency", submitted: true },
    ],
  },
  {
    title: "Atlas Digital Cover Letter",
    label: "v1",
    kind: "COVER_LETTER",
    attach: [{ company: "Atlas Digital", submitted: true }],
  },
  {
    title: "Tidewater Cover Letter (draft)",
    label: "v1",
    kind: "COVER_LETTER",
    attach: [{ company: "Tidewater Logistics", submitted: false }],
  },
  {
    title: "Portfolio & Selected Projects",
    label: "v1",
    kind: "PORTFOLIO",
    attach: [
      { company: "Northstar Labs", submitted: true },
      { company: "Atlas Digital", submitted: false },
    ],
  },
  {
    title: "AWS Certified Cloud Practitioner",
    label: "v1",
    kind: "CERTIFICATE",
    attach: [
      { company: "Harbor Cloud", submitted: true },
      { company: "Kite & Key", submitted: true },
    ],
  },
  {
    title: "Professional References",
    label: "v1",
    kind: "OTHER",
    attach: [{ company: "Sapling Studio", submitted: true }],
  },
  {
    title: "Scanned Transcript",
    label: "v1",
    kind: "OTHER",
    blocked: true,
    notes: "Blocked by the file scanner (demo).",
    attach: [],
  },
];

const MINIMAL_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
);

// ------------------------------------------------------------- helpers ----

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

function assertLocalDatabase() {
  const url = new URL(process.env.DATABASE_URL ?? "postgresql://missing");
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || process.env.NODE_ENV === "production")
    throw new Error(`Refusing to write mock data to ${url.hostname}: local databases only.`);
}

async function resetAccount(tx: TransactionClient, userId: string) {
  const where = { userId };
  await tx.notificationDelivery.deleteMany({ where });
  await tx.notification.deleteMany({ where });
  await tx.reminder.deleteMany({ where });
  await tx.task.deleteMany({ where });
  await tx.document.deleteMany({ where }); // the trigger queues their file cleanup
  await tx.jobOpportunity.deleteMany({ where }); // cascades applications, interviews, offers, activity
  await tx.jobTag.deleteMany({ where });
  await tx.company.deleteMany({ where }); // cascades contacts
  await tx.activityEvent.deleteMany({ where });
  await tx.pipeline.deleteMany({ where }); // cascades stages
  await ensureDefaultPipeline(tx, userId);
}

// ---------------------------------------------------------------- main ----

async function main() {
  assertLocalDatabase();
  const email = process.argv[2];
  const reset = process.argv.includes("--reset");
  if (!email || email.startsWith("--")) throw new Error("Usage: pnpm db:mock <email> [--reset]");

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, preferences: true } });
  if (!user) throw new Error(`No account for ${email}. Register it first.`);
  if (!user.preferences?.onboardedAt) throw new Error(`${email} hasn't finished onboarding yet.`);
  const userId = user.id;
  const tz = user.preferences.timezone;
  const existing = await prisma.jobOpportunity.count({ where: { userId } });
  if (existing > 0 && !reset)
    throw new Error(`${email} already has ${existing} jobs. Re-run with --reset to replace all of its data.`);

  const today = todayInTimeZone(tz);
  const day = (offset: number) => addDaysToDateOnly(today, offset);
  const at = (offset: number, time: string, zone = tz) => zonedToUtc(day(offset), time, zone);
  const describe = (instant: Date | null) =>
    instant ? formatInTimeZone(instant, tz, "EEE, MMM d 'at' h:mm a") : "an unset time";

  // Files first (outside the transaction); keys are tracked for cleanup on failure.
  const storage = getStorage();
  const fileKeys: string[] = [];
  for (const _doc of DOCUMENTS) {
    const key = `users/${userId}/${randomUUID()}`;
    await storage.put(key, MINIMAL_PDF, "application/pdf");
    fileKeys.push(key);
  }

  const counts = {
    jobs: 0,
    applications: 0,
    interviews: 0,
    offers: 0,
    tasks: 0,
    contacts: 0,
    documents: 0,
    events: 0,
  };
  try {
    await prisma.$transaction(
      async (tx) => {
        if (reset) await resetAccount(tx, userId);
        const act = async (data: {
          opportunityId: string;
          applicationId?: string;
          type: ActivityType;
          summary: string;
          occurredAt: Date;
          details?: object;
        }) => {
          counts.events += 1;
          await tx.activityEvent.create({
            data: { userId, ...data, applicationId: data.applicationId ?? null, details: data.details ?? {} },
          });
        };

        // Pipeline: default stages + a custom "Coding Challenge" + a disabled stage.
        const pipelineId = await ensureDefaultPipeline(tx, userId);
        const defaults = await tx.pipelineStage.findMany({
          where: { userId, pipelineId },
          orderBy: { position: "asc" },
        });
        await tx.pipelineStage.updateMany({
          where: { userId, pipelineId, position: { gte: 3 } },
          data: { position: { increment: 1 } },
        });
        const coding = await tx.pipelineStage.create({
          data: {
            userId,
            pipelineId,
            name: "Coding Challenge",
            category: "ASSESSMENT",
            color: "#78a0bc",
            position: 3,
          },
        });
        await tx.pipelineStage.create({
          data: {
            userId,
            pipelineId,
            name: "Reference Check",
            category: "OTHER",
            color: "#b0a48c",
            position: defaults.length + 1,
            isActive: false,
          },
        });
        const [applied, screening, assessment, technical, final, offer] = defaults;
        const stages: Record<StageKey, { id: string; name: string; category: string }> = {
          applied: applied!,
          screening: screening!,
          assessment: assessment!,
          coding,
          technical: technical!,
          final: final!,
          offer: offer!,
        };

        const tagIds = new Map<string, string>();
        for (const [name, color] of TAGS) {
          const tag = await tx.jobTag.create({ data: { userId, name, color } });
          tagIds.set(name, tag.id);
        }

        const companies = new Map<string, string>();
        const opportunities = new Map<string, string>();
        const applications = new Map<string, string>();

        for (const job of JOBS) {
          const companySlug = slug(job.company);
          const company = await tx.company.create({
            data: {
              userId,
              name: job.company,
              normalizedName: normalizeCompanyName(job.company),
              website: job.salary ? `https://${companySlug}.example` : null,
              location: job.location ?? null,
            },
          });
          companies.set(job.company, company.id);
          const savedDaysAgo = (job.appliedDaysAgo ?? 5) + 3;
          const postingUrl = job.source ? `https://${companySlug}.example/careers/${slug(job.title)}` : null;
          const opportunity = await tx.jobOpportunity.create({
            data: {
              userId,
              companyId: company.id,
              title: job.title,
              description: job.salary
                ? `Join the ${job.company} team to design, build and maintain thoughtful digital products. Collaborate with engineers and designers, ship reliable interfaces and help deliver polished customer experiences.\n\n(Fictional mock data.)`
                : null,
              postingUrl,
              normalizedUrl: postingUrl ? normalizePostingUrl(postingUrl) : null,
              source: job.source ?? null,
              referenceCode: job.referenceCode ?? null,
              salaryMin: job.salary?.min !== undefined ? String(job.salary.min) : null,
              salaryMax: job.salary?.max !== undefined ? String(job.salary.max) : null,
              currency: job.salary?.currency ?? "PHP",
              salaryPeriod: job.salary?.period ?? null,
              salaryBasis: job.salary?.basis ?? "UNKNOWN",
              employmentType: job.employment ?? null,
              workArrangement: job.work ?? null,
              location: job.location ?? null,
              requiredSkills: job.skills ?? [],
              priority: job.priority,
              notes: job.notes ?? null,
              deadline: job.deadlineIn !== undefined ? parseDateOnly(day(job.deadlineIn)) : null,
              savedOn: parseDateOnly(day(-savedDaysAgo)),
              archivedAt:
                job.archivedDaysAgo !== undefined && job.restoredDaysAgo === undefined
                  ? at(-job.archivedDaysAgo, "18:00")
                  : null,
              createdAt: at(-savedDaysAgo, "09:00"),
            },
          });
          counts.jobs += 1;
          opportunities.set(job.company, opportunity.id);
          for (const tag of job.tags ?? [])
            await tx.opportunityTag.create({
              data: { userId, opportunityId: opportunity.id, tagId: tagIds.get(tag)! },
            });
          await act({
            opportunityId: opportunity.id,
            type: "OPPORTUNITY_SAVED",
            summary: `Saved ${job.title} at ${job.company}`,
            occurredAt: at(-savedDaysAgo, "09:00"),
          });
          if (job.archivedDaysAgo !== undefined)
            await act({
              opportunityId: opportunity.id,
              type: "OPPORTUNITY_ARCHIVED",
              summary: "Job archived",
              occurredAt: at(-job.archivedDaysAgo, "18:00"),
            });
          if (job.restoredDaysAgo !== undefined)
            await act({
              opportunityId: opportunity.id,
              type: "OPPORTUNITY_RESTORED",
              summary: "Job restored from archive",
              occurredAt: at(-job.restoredDaysAgo, "10:00"),
            });
          if (!job.stage || job.appliedDaysAgo === undefined) {
            for (const event of job.events ?? [])
              await act({
                opportunityId: opportunity.id,
                type: event.type,
                summary: event.summary,
                details: event.details,
                occurredAt: at(-event.daysAgo, "12:00"),
              });
            continue;
          }

          // An earlier, closed attempt (reapplication scenario).
          let attemptNumber = 1;
          if (job.previousAttempt) {
            const previous = job.previousAttempt;
            const earlier = await tx.application.create({
              data: {
                userId,
                opportunityId: opportunity.id,
                pipelineId,
                stageId: stages[previous.stage].id,
                attemptNumber: 1,
                appliedOn: parseDateOnly(day(-previous.appliedDaysAgo)),
                method: job.method ?? null,
                submittedVia: job.source ?? null,
                status: "CLOSED",
                outcome: previous.outcome,
                closedAt: at(-previous.closedDaysAgo, "12:00"),
                stageChangedAt: at(-previous.closedDaysAgo - 5, "12:00"),
              },
            });
            counts.applications += 1;
            await act({
              opportunityId: opportunity.id,
              applicationId: earlier.id,
              type: "APPLICATION_SUBMITTED",
              summary: "Application submitted",
              occurredAt: at(-previous.appliedDaysAgo, "10:00"),
              details: { attemptNumber: 1, stageName: stages.applied.name },
            });
            await act({
              opportunityId: opportunity.id,
              applicationId: earlier.id,
              type: "STAGE_CHANGED",
              summary: `Moved from ${stages.applied.name} to ${stages[previous.stage].name}`,
              occurredAt: at(-previous.closedDaysAgo - 5, "12:00"),
              details: {
                fromStageId: stages.applied.id,
                fromStageName: stages.applied.name,
                fromStageCategory: stages.applied.category,
                toStageId: stages[previous.stage].id,
                toStageName: stages[previous.stage].name,
                toStageCategory: stages[previous.stage].category,
              },
            });
            await act({
              opportunityId: opportunity.id,
              applicationId: earlier.id,
              type: "APPLICATION_CLOSED",
              summary: `Closed: ${APPLICATION_OUTCOME_LABEL[previous.outcome]}`,
              occurredAt: at(-previous.closedDaysAgo, "12:00"),
              details: { outcome: previous.outcome },
            });
            attemptNumber = 2;
          }

          // Stage moves, spread between the start and the close (or today).
          const finalStage = job.stage;
          const path = ORDER.slice(1, ORDER.indexOf(finalStage) + 1).filter(
            (key) => key !== "coding" || finalStage === "coding",
          );
          const start = job.walkStartDaysAgo ?? job.appliedDaysAgo;
          const end = job.closedDaysAgo ?? 0;
          const moveDaysAgo = path.map((_, index) =>
            Math.round(start - ((index + 1) * (start - end)) / (path.length + 1)),
          );
          const lastMove = moveDaysAgo.at(-1);
          const closedDaysAgo = end;

          const application = await tx.application.create({
            data: {
              userId,
              opportunityId: opportunity.id,
              pipelineId,
              stageId: stages[finalStage].id,
              attemptNumber,
              appliedOn: parseDateOnly(day(-job.appliedDaysAgo)),
              method: job.method ?? null,
              submittedVia: job.source ?? null,
              status: job.status ?? "ACTIVE",
              outcome: job.outcome ?? null,
              closedAt: job.status === "CLOSED" ? at(-closedDaysAgo, "17:00") : null,
              stageChangedAt: at(-(lastMove ?? job.appliedDaysAgo), "14:00"),
              firstResponseOn:
                job.respondedAfter !== undefined
                  ? parseDateOnly(day(-job.appliedDaysAgo + job.respondedAfter))
                  : null,
              notes: job.applicationNotes ?? null,
            },
          });
          counts.applications += 1;
          applications.set(job.company, application.id);
          await act({
            opportunityId: opportunity.id,
            applicationId: application.id,
            type: "APPLICATION_SUBMITTED",
            summary: attemptNumber > 1 ? `Reapplied (attempt ${attemptNumber})` : "Application submitted",
            occurredAt: at(-job.appliedDaysAgo, "10:00"),
            details: {
              attemptNumber,
              appliedOn: day(-job.appliedDaysAgo),
              stageId: stages.applied.id,
              stageName: stages.applied.name,
              method: job.method ?? null,
            },
          });
          if (job.respondedAfter !== undefined) {
            const respondedOn = day(-job.appliedDaysAgo + job.respondedAfter);
            await act({
              opportunityId: opportunity.id,
              applicationId: application.id,
              type: "EMPLOYER_RESPONSE_RECEIVED",
              summary: "Employer responded",
              occurredAt: zonedToUtc(respondedOn, "12:00", tz),
              details: { respondedOn },
            });
          }
          for (const [index, key] of path.entries()) {
            const from =
              stages[
                ORDER[ORDER.indexOf(key) - 1] === "coding" && finalStage !== "coding"
                  ? "assessment"
                  : ORDER[ORDER.indexOf(key) - 1]!
              ];
            const to = stages[key];
            await act({
              opportunityId: opportunity.id,
              applicationId: application.id,
              type: "STAGE_CHANGED",
              summary: `Moved from ${from.name} to ${to.name}`,
              occurredAt: at(-moveDaysAgo[index]!, "14:00"),
              details: {
                fromStageId: from.id,
                fromStageName: from.name,
                fromStageCategory: from.category,
                toStageId: to.id,
                toStageName: to.name,
                toStageCategory: to.category,
              },
            });
          }
          for (const event of job.events ?? [])
            await act({
              opportunityId: opportunity.id,
              applicationId: application.id,
              type: event.type,
              summary: event.summary,
              details: event.details,
              occurredAt: at(-event.daysAgo, "12:00"),
            });
          if (job.status === "CLOSED" && !job.closedByOffer && job.outcome)
            await act({
              opportunityId: opportunity.id,
              applicationId: application.id,
              type: "APPLICATION_CLOSED",
              summary: `Closed: ${APPLICATION_OUTCOME_LABEL[job.outcome]}`,
              occurredAt: at(-closedDaysAgo, "17:00"),
              details: { outcome: job.outcome, ...(job.closeNote ? { note: job.closeNote } : {}) },
            });
        }

        // Contacts.
        const contactIds = new Map<string, string>();
        for (const contact of CONTACTS) {
          const created = await tx.contact.create({
            data: {
              userId,
              companyId: companies.get(contact.company)!,
              name: contact.name,
              title: contact.title,
              kind: contact.kind,
              email: contact.email ?? null,
              phone: contact.phone ?? null,
              linkedinUrl: contact.linkedin ?? null,
              notes: contact.notes ?? null,
            },
          });
          contactIds.set(contact.name, created.id);
          counts.contacts += 1;
        }

        // Interviews.
        const interviewIds = new Map<string, string>();
        const rounds = new Map<string, number>();
        for (const interview of INTERVIEWS) {
          const applicationId = applications.get(interview.company)!;
          const opportunityId = opportunities.get(interview.company)!;
          const zone = interview.zone ?? tz;
          const startsAt =
            interview.offset !== undefined ? at(interview.offset, interview.time!, zone) : null;
          const endsAt =
            startsAt && interview.minutes ? new Date(startsAt.getTime() + interview.minutes * 60_000) : null;
          const round = (rounds.get(interview.company) ?? 0) + 1;
          rounds.set(interview.company, round);
          const status = interview.done
            ? "COMPLETED"
            : interview.cancelReason
              ? "CANCELLED"
              : !startsAt
                ? "UNSCHEDULED"
                : interview.rescheduledFrom !== undefined
                  ? "RESCHEDULED"
                  : "SCHEDULED";
          const created = await tx.interview.create({
            data: {
              userId,
              applicationId,
              title: interview.title,
              type: interview.type,
              roundNumber: round,
              status,
              result: interview.done ?? "PENDING",
              startsAt,
              endsAt,
              timezone: zone,
              mode: interview.mode,
              meetingUrl:
                interview.mode === "VIDEO"
                  ? `https://meet.google.com/mock-${slug(interview.company)}-${round}`
                  : null,
              location: interview.location ?? null,
              interviewers: interview.interviewers ?? null,
              prepNotes:
                "Review the job description, prepare two project stories and three questions for them.",
              feedback: interview.done
                ? interview.done === "FAILED"
                  ? "They wanted deeper Laravel queue experience."
                  : "Good conversation; they asked about system design trade-offs."
                : null,
              reminderMinutesBefore:
                interview.done || interview.cancelReason ? null : interview.offset === 0 ? 60 : 1440,
              completedAt: interview.done ? (endsAt ?? startsAt) : null,
              cancelledAt: interview.cancelReason ? at(-1, "18:00") : null,
              scheduleRevision: interview.rescheduledFrom !== undefined ? 1 : 0,
            },
          });
          counts.interviews += 1;
          interviewIds.set(`${interview.company}:${interview.title}`, created.id);
          const contactRows = (interview.contacts ?? []).map((name) => ({
            userId,
            interviewId: created.id,
            contactId: contactIds.get(name)!,
          }));
          if (contactRows.length) await tx.interviewContact.createMany({ data: contactRows });

          const scheduledAt = at(Math.min(interview.offset ?? -1, 0) - 3, "09:00");
          const originalStart =
            interview.rescheduledFrom !== undefined
              ? at(interview.rescheduledFrom, interview.time!, zone)
              : startsAt;
          await act({
            opportunityId,
            applicationId,
            type: "INTERVIEW_SCHEDULED",
            summary: originalStart
              ? `Scheduled ${interview.title} for ${describe(originalStart)}`
              : `Added ${interview.title} (time not set yet)`,
            occurredAt: scheduledAt,
            details: {
              interviewId: created.id,
              startsAt: originalStart?.toISOString() ?? null,
              timezone: zone,
            },
          });
          if (interview.rescheduledFrom !== undefined) {
            await tx.interviewReschedule.create({
              data: {
                userId,
                interviewId: created.id,
                previousStartsAt: originalStart,
                previousEndsAt: null,
                previousTimezone: zone,
                newStartsAt: startsAt,
                newEndsAt: endsAt,
                newTimezone: zone,
                reason: "Interviewer conflict",
              },
            });
            await act({
              opportunityId,
              applicationId,
              type: "INTERVIEW_RESCHEDULED",
              summary: `Rescheduled ${interview.title} from ${describe(originalStart)} to ${describe(startsAt)}`,
              occurredAt: at(-1, "16:00"),
              details: {
                interviewId: created.id,
                previousStartsAt: originalStart?.toISOString() ?? null,
                newStartsAt: startsAt?.toISOString() ?? null,
                reason: "Interviewer conflict",
              },
            });
          }
          if (interview.updated)
            await act({
              opportunityId,
              applicationId,
              type: "INTERVIEW_UPDATED",
              summary: `Updated ${interview.title} details`,
              occurredAt: at(-1, "11:00"),
              details: { interviewId: created.id },
            });
          if (interview.done) {
            const firstResult = interview.resultLater ? "AWAITING_FEEDBACK" : interview.done;
            await act({
              opportunityId,
              applicationId,
              type: "INTERVIEW_COMPLETED",
              summary: `Completed ${interview.title} · ${INTERVIEW_RESULT_LABEL[firstResult]}`,
              occurredAt: endsAt ?? startsAt!,
              details: { interviewId: created.id, result: firstResult },
            });
            if (interview.resultLater)
              await act({
                opportunityId,
                applicationId,
                type: "INTERVIEW_RESULT_RECORDED",
                summary: `${interview.title}: ${INTERVIEW_RESULT_LABEL[interview.done]}`,
                occurredAt: at(interview.offset! + 1, "10:00"),
                details: { interviewId: created.id, result: interview.done },
              });
          }
          if (interview.cancelReason)
            await act({
              opportunityId,
              applicationId,
              type: "INTERVIEW_CANCELLED",
              summary: `Cancelled ${interview.title}`,
              occurredAt: at(-1, "18:00"),
              details: { interviewId: created.id, reason: interview.cancelReason },
            });
          await syncReminders(tx, userId, { interviewId: created.id });
        }

        // Offers (revisions, every status, accept/decline closing the application).
        for (const seed of OFFERS) {
          const job = JOBS.find((item) => item.company === seed.company)!;
          const applicationId = applications.get(seed.company)!;
          const opportunityId = opportunities.get(seed.company)!;
          for (const [index, revision] of seed.revisions.entries()) {
            const revisionNumber = index + 1;
            const isLatest = index === seed.revisions.length - 1;
            const status = isLatest && seed.decision ? seed.decision.status : revision.status;
            const created = await tx.offer.create({
              data: {
                userId,
                applicationId,
                revisionNumber,
                positionTitle: job.title,
                baseSalary: String(revision.base),
                currency: job.salary!.currency,
                salaryPeriod: job.salary!.period,
                salaryBasis: job.salary!.basis === "UNKNOWN" ? "GROSS" : job.salary!.basis,
                bonus: revision.bonus ?? null,
                equity: revision.equity ?? null,
                benefits: revision.benefits ?? null,
                startDate: revision.startIn !== undefined ? parseDateOnly(day(revision.startIn)) : null,
                decisionDeadline:
                  revision.deadlineIn !== undefined ? parseDateOnly(day(revision.deadlineIn)) : null,
                receivedOn: parseDateOnly(day(-revision.receivedDaysAgo)),
                status,
                negotiationNotes: revision.notes ?? null,
                decidedAt: isLatest && seed.decision ? at(-seed.decision.daysAgo, "15:00") : null,
              },
            });
            counts.offers += 1;
            const amount = `${formatMoney(String(revision.base), job.salary!.currency)}${PERIOD_SUFFIX[job.salary!.period]}`;
            await act({
              opportunityId,
              applicationId,
              type: revisionNumber > 1 ? "OFFER_REVISED" : "OFFER_RECEIVED",
              summary:
                revisionNumber > 1
                  ? `Offer revised (revision ${revisionNumber}): ${amount}`
                  : `Offer received: ${amount}`,
              occurredAt: at(-revision.receivedDaysAgo, "16:00"),
              details: { offerId: created.id, revisionNumber },
            });
            if (isLatest && seed.decision) {
              const accepted = seed.decision.status === "ACCEPTED";
              const occurredAt = at(-seed.decision.daysAgo, "15:00");
              await act({
                opportunityId,
                applicationId,
                type: accepted ? "OFFER_ACCEPTED" : "OFFER_DECLINED",
                summary: `${accepted ? "Accepted" : "Declined"} the ${job.title} offer (revision ${revisionNumber})`,
                occurredAt,
                details: { offerId: created.id },
              });
              const outcome = accepted ? "ACCEPTED" : "OFFER_DECLINED";
              await tx.application.update({ where: { id: applicationId }, data: { closedAt: occurredAt } });
              await act({
                opportunityId,
                applicationId,
                type: "APPLICATION_CLOSED",
                summary: accepted ? "Closed: Accepted" : "Closed: Offer declined",
                occurredAt,
                details: { outcome, offerId: created.id },
              });
            }
            await syncReminders(tx, userId, { offerId: created.id });
          }
        }

        // Tasks.
        const taskIds = new Map<string, string>();
        for (const task of TASKS) {
          const applicationId =
            task.company && !task.opportunityOnly ? applications.get(task.company) : undefined;
          const opportunityId = task.company ? opportunities.get(task.company) : undefined;
          const interviewId = task.interview
            ? interviewIds.get(`${task.company}:${task.interview}`)
            : undefined;
          const dueAt =
            task.due === null || task.due === undefined ? null : at(task.due, task.time ?? "09:00");
          const created = await tx.task.create({
            data: {
              userId,
              applicationId: applicationId ?? null,
              opportunityId: opportunityId ?? null,
              interviewId: interviewId ?? null,
              title: task.title,
              description: task.description ?? null,
              type: task.type,
              priority: task.priority ?? "MEDIUM",
              status: task.status,
              dueAt,
              completedAt: task.status === "COMPLETED" ? at(task.due ?? 0, "15:00") : null,
              reminderMinutesBefore: task.status === "OPEN" && dueAt ? 60 : null,
              suggestionReason: task.reason ?? null,
            },
          });
          counts.tasks += 1;
          taskIds.set(task.title, created.id);
          if (task.status === "COMPLETED" && opportunityId)
            await act({
              opportunityId,
              applicationId,
              type: "TASK_COMPLETED",
              summary: `Completed task: ${task.title}`,
              occurredAt: at(task.due ?? 0, "15:00"),
              details: { taskId: created.id },
            });
          await syncReminders(tx, userId, { taskId: created.id });
        }

        // Documents: version chains, every kind, one blocked; attached to the attempts they were used in.
        const documentIds = new Map<string, string>();
        for (const [index, doc] of DOCUMENTS.entries()) {
          const replacesId = doc.replaces ? documentIds.get(`${doc.title}:${doc.replaces}`) : undefined;
          const created = await tx.document.create({
            data: {
              userId,
              kind: doc.kind,
              title: doc.title,
              versionLabel: doc.label,
              originalFilename: `${doc.title} ${doc.label}.pdf`,
              mimeType: "application/pdf",
              sizeBytes: MINIMAL_PDF.length,
              sha256: createHash("sha256").update(MINIMAL_PDF).digest("hex"),
              storageKey: fileKeys[index]!,
              status: doc.blocked ? "BLOCKED" : "READY",
              notes: doc.notes ?? null,
              replacesId: replacesId ?? null,
            },
          });
          counts.documents += 1;
          if (replacesId)
            await tx.document.update({ where: { id: replacesId }, data: { supersededAt: new Date() } });
          documentIds.set(`${doc.title}:${doc.label}`, created.id);
          for (const link of doc.attach) {
            const applicationId = applications.get(link.company);
            if (!applicationId) continue;
            await tx.applicationDocument.create({
              data: {
                userId,
                applicationId,
                documentId: created.id,
                purpose: doc.kind,
                wasSubmitted: link.submitted,
              },
            });
            const job = JOBS.find((item) => item.company === link.company)!;
            await act({
              opportunityId: opportunities.get(link.company)!,
              applicationId,
              type: "DOCUMENT_ATTACHED",
              summary: `${link.submitted ? "Submitted" : "Attached"} ${DOCUMENT_KIND_LABEL[doc.kind].toLowerCase()}: ${doc.title} (${doc.label})`,
              occurredAt: at(-(job.appliedDaysAgo ?? 1), "10:05"),
              details: { documentId: created.id, purpose: doc.kind, wasSubmitted: link.submitted },
            });
          }
        }
        // A document that was attached and later removed again.
        await act({
          opportunityId: opportunities.get("Lumen Commerce")!,
          applicationId: applications.get("Lumen Commerce")!,
          type: "DOCUMENT_ATTACHED",
          summary: `Attached portfolio: Portfolio & Selected Projects (v1)`,
          occurredAt: at(-8, "10:10"),
          details: {
            documentId: documentIds.get("Portfolio & Selected Projects:v1"),
            purpose: "PORTFOLIO",
            wasSubmitted: false,
          },
        });
        await act({
          opportunityId: opportunities.get("Lumen Commerce")!,
          applicationId: applications.get("Lumen Commerce")!,
          type: "DOCUMENT_DETACHED",
          summary: "Removed Portfolio & Selected Projects from this application",
          occurredAt: at(-7, "09:00"),
          details: { documentId: documentIds.get("Portfolio & Selected Projects:v1") },
        });

        // Reminder log history: sent (in-app + email), cancelled, skipped, failed.
        const northstarCall = interviewIds.get("Northstar Labs:Recruiter Call")!;
        const atlasFinal = interviewIds.get("Atlas Digital:Final Interview")!;
        const rivetTech = interviewIds.get("Rivet Health:Technical Interview")!;
        const polarChat = interviewIds.get("Polar Systems:Culture Chat")!;
        const cvTask = taskIds.get("Update CV project highlights")!;
        const sentInApp = await tx.reminder.create({
          data: {
            userId,
            interviewId: northstarCall,
            channel: "IN_APP",
            remindAt: at(-10, "14:00"),
            dedupeKey: `mock:${randomUUID()}`,
            status: "SENT",
            attempts: 1,
            sentAt: at(-10, "14:00"),
          },
        });
        await tx.notification.create({
          data: {
            userId,
            reminderId: sentInApp.id,
            type: "INTERVIEW_REMINDER",
            title: "Upcoming interview: Recruiter Call with Northstar Labs",
            body: "Tomorrow at 2:00 PM",
            link: `/applications/${applications.get("Northstar Labs")}?tab=interviews`,
            readAt: at(-10, "15:00"),
            createdAt: at(-10, "14:00"),
          },
        });
        const sentEmail = await tx.reminder.create({
          data: {
            userId,
            interviewId: atlasFinal,
            channel: "EMAIL",
            remindAt: at(-7, "09:00"),
            dedupeKey: `mock:${randomUUID()}`,
            status: "SENT",
            attempts: 1,
            sentAt: at(-7, "09:00"),
          },
        });
        await tx.notificationDelivery.create({
          data: {
            userId,
            reminderId: sentEmail.id,
            channel: "EMAIL",
            status: "SENT",
            provider: "resend",
            idempotencyKey: `mock:${randomUUID()}`,
            providerMessageId: "mock_msg_8f2a",
            createdAt: at(-7, "09:00"),
          },
        });
        await tx.reminder.create({
          data: {
            userId,
            taskId: cvTask,
            channel: "IN_APP",
            remindAt: at(-3, "08:00"),
            dedupeKey: `mock:${randomUUID()}`,
            status: "CANCELLED",
            cancelledAt: at(-3, "07:30"),
          },
        });
        await tx.reminder.create({
          data: {
            userId,
            interviewId: polarChat,
            channel: "IN_APP",
            remindAt: at(1, "13:00"),
            dedupeKey: `mock:${randomUUID()}`,
            status: "SKIPPED",
            lastError: "The interview was cancelled before the reminder was due.",
          },
        });
        const failed = await tx.reminder.create({
          data: {
            userId,
            interviewId: rivetTech,
            channel: "EMAIL",
            remindAt: at(-9, "10:00"),
            dedupeKey: `mock:${randomUUID()}`,
            status: "FAILED",
            attempts: 3,
            lastError: "Resend validation_error: bad address",
          },
        });
        await tx.notificationDelivery.create({
          data: {
            userId,
            reminderId: failed.id,
            channel: "EMAIL",
            status: "FAILED",
            provider: "resend",
            idempotencyKey: `mock:${randomUUID()}`,
            error: "Resend validation_error: bad address",
            createdAt: at(-9, "10:00"),
          },
        });

        // Other notification types, read and unread.
        await tx.notification.createMany({
          data: [
            {
              userId,
              type: "SYSTEM",
              title: "Welcome to JobTrack",
              body: "Mock data: every scenario, option and label is filled in.",
              link: "/dashboard",
              readAt: at(-14, "10:00"),
              createdAt: at(-14, "09:00"),
            },
            {
              userId,
              type: "OFFER_DEADLINE",
              title: "Offer deadline tomorrow: Willow Bank",
              body: "Full-Stack Engineer · decide by the end of the day",
              link: `/applications/${applications.get("Willow Bank")}?tab=offers`,
              readAt: at(-3, "10:00"),
              createdAt: at(-3, "09:00"),
            },
            {
              userId,
              type: "TASK_REMINDER",
              title: "Task due: Send follow-up email",
              body: "Brightside Studio",
              link: "/tasks",
              createdAt: at(-1, "08:00"),
            },
            {
              userId,
              type: "CALENDAR_SYNC_ERROR",
              title: "Google Calendar needs reconnecting",
              body: "Mock notification: shows how sync errors look.",
              link: "/settings/integrations",
              createdAt: at(0, "07:00"),
            },
          ],
        });
      },
      { timeout: 180_000, maxWait: 20_000 },
    );
  } catch (error) {
    for (const key of fileKeys) await storage.delete(key).catch(() => undefined);
    throw error;
  }

  process.stdout.write(`Mock data added to ${email}: ${JSON.stringify(counts)}\n`);
}

main()
  .catch((error: unknown) => {
    process.stderr.write(
      `Mock data failed: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
