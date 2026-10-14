import {
  ArrowRight,
  CalendarCheck,
  Columns3,
  FileText,
  LineChart,
  ListChecks,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: Columns3,
    title: "Custom hiring pipeline",
    text: "Your own stages, a Kanban board and a dense table view.",
  },
  {
    icon: CalendarCheck,
    title: "Unlimited interview rounds",
    text: "Schedule, reschedule and record results for every round.",
  },
  {
    icon: ListChecks,
    title: "Follow-ups that happen",
    text: "Tasks, reminders and a daily Needs Attention list.",
  },
  { icon: FileText, title: "Resume versions", text: "Know exactly which resume and cover letter you sent." },
  {
    icon: LineChart,
    title: "Honest analytics",
    text: "Response times, interview and offer rates per source.",
  },
  { icon: ShieldCheck, title: "Private workspace", text: "Your data and documents are visible only to you." },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-8">
        <Brand href="/" withTagline={false} />
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Get started</Link>
          </Button>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 pt-12 pb-20 sm:px-8 sm:pt-20">
        <p className="text-[11px] font-bold tracking-[1.35px] text-[#7a9284] uppercase">Your career HQ</p>
        <h1 className="mt-3 max-w-3xl text-[36px] leading-[1.08] font-bold tracking-[-1.8px] text-heading sm:text-[54px]">
          A clearer path to your next role.
        </h1>
        <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-subtle">
          JobTrack keeps every opportunity, application, interview and follow-up in one calm, private
          workspace, so you always know your next move.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/register">
              Create your free workspace <ArrowRight aria-hidden />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/login">I already have an account</Link>
          </Button>
        </div>
        <ul className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="rounded-2xl border border-line bg-card p-6 shadow-panel">
              <span
                className="mb-4 grid size-10 place-items-center rounded-xl bg-brand-soft text-brand"
                aria-hidden
              >
                <Icon className="size-5" />
              </span>
              <h2 className="text-[15px] font-bold tracking-[-0.3px]">{title}</h2>
              <p className="mt-1.5 text-xs leading-relaxed text-subtle">{text}</p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
