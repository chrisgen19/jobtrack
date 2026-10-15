import { CalendarCheck, Columns3, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/layout/brand";

const HIGHLIGHTS = [
  {
    icon: Columns3,
    title: "Your own hiring pipeline",
    text: "Custom stages, Kanban and table views for every application.",
  },
  {
    icon: CalendarCheck,
    title: "Never miss a follow-up",
    text: "Interviews, tasks and reminders in one calm agenda.",
  },
  {
    icon: ShieldCheck,
    title: "Private by default",
    text: "Your jobs, notes and resumes are visible only to you.",
  },
];

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="hidden flex-col justify-between border-r border-line bg-[#eff5f0] p-10 lg:flex">
        <Brand href="/" />
        <div className="max-w-md">
          <p className="text-[11px] font-bold tracking-[1.35px] text-[#7a9284] uppercase">Your career HQ</p>
          <h2 className="mt-3 text-[32px] leading-tight font-bold tracking-[-1.35px] text-heading">
            A clearer path to your next role.
          </h2>
          <ul className="mt-8 flex flex-col gap-5">
            {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <span
                  className="grid size-9 flex-none place-items-center rounded-[10px] bg-white text-brand"
                  aria-hidden
                >
                  <Icon className="size-4" />
                </span>
                <span>
                  <strong className="block text-[13px]">{title}</strong>
                  <span className="text-xs leading-relaxed text-[#718379]">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[11px] text-faint">© JobTrack</p>
      </aside>
      <main className="flex flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="mb-8 lg:hidden">
          <Brand href="/" />
        </div>
        {children}
      </main>
    </div>
  );
}
