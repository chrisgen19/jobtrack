/**
 * The board plus the `@peek` slot. Card links to `/applications/[id]` are
 * intercepted into that slot and open as a drawer over the board; a refresh or
 * shared link renders the full application page instead.
 */
export default function PipelineLayout({ children, peek }: LayoutProps<"/pipeline">) {
  return (
    <>
      {children}
      {peek}
    </>
  );
}
