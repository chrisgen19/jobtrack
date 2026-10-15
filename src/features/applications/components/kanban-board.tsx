"use client";

import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { MoreHorizontal, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { PriorityBadge, StatusBadge } from "@/components/shared/badges";
import { CompanyLogo } from "@/components/shared/company-logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QuickAddDialog } from "@/features/opportunities/components/quick-add-dialog";
import type { QuickAddOptions } from "@/features/opportunities/data";
import { formatDateOnly } from "@/lib/dates";
import { WORK_ARRANGEMENT_LABEL } from "@/lib/labels";
import { formatSalaryRange } from "@/lib/money";
import { cn } from "@/lib/utils";
import { changeStageAction } from "../actions";
import type { BoardCard, BoardColumn, SavedCard } from "../data";
import { SavedDropDialog } from "./saved-drop-dialog";

const SAVED_COLUMN = "saved";

type DragData = { kind: "application"; card: BoardCard } | { kind: "saved"; card: SavedCard };
type Move = { applicationId: string; toStageId: string };

interface KanbanBoardProps {
  saved: SavedCard[];
  columns: BoardColumn[];
  options: QuickAddOptions;
}

/** Moves the focused card to the next/previous column with arrow keys. */
const columnKeyboardCoordinates: KeyboardCoordinateGetter = (event, { context }) => {
  const { collisionRect, droppableRects } = context;
  if (!collisionRect) return undefined;
  const columns = [...droppableRects.values()].sort((a, b) => a.left - b.left);
  const center = collisionRect.left + collisionRect.width / 2;
  let target: (typeof columns)[number] | undefined;
  if (event.code === "ArrowRight") target = columns.find((rect) => rect.left > center);
  if (event.code === "ArrowLeft")
    target = [...columns].reverse().find((rect) => rect.left + rect.width < center);
  if (!target) return undefined;
  event.preventDefault();
  return { x: target.left + 12, y: Math.max(target.top + 48, collisionRect.top) };
};

const collisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  return pointerHits.length > 0 ? pointerHits : closestCenter(args);
};

export function KanbanBoard({ saved, columns, options }: KanbanBoardProps) {
  const [, startTransition] = useTransition();
  const [optimisticColumns, applyMove] = useOptimistic(columns, (state: BoardColumn[], move: Move) => {
    const card = state
      .flatMap((column) => column.cards)
      .find((item) => item.applicationId === move.applicationId);
    if (!card) return state;
    return state.map((column) => ({
      ...column,
      cards:
        column.id === move.toStageId
          ? [
              { ...card, stageId: move.toStageId },
              ...column.cards.filter((item) => item.applicationId !== move.applicationId),
            ]
          : column.cards.filter((item) => item.applicationId !== move.applicationId),
    }));
  });
  const [active, setActive] = useState<DragData | null>(null);
  const [savedDrop, setSavedDrop] = useState<{ card: SavedCard; stage: BoardColumn } | null>(null);
  const [quickAdd, setQuickAdd] = useState<{ open: boolean; stageId?: string }>({ open: false });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnKeyboardCoordinates }),
  );

  const stageName = (id: string | number | undefined) =>
    id === SAVED_COLUMN
      ? "Saved"
      : (optimisticColumns.find((column) => column.id === id)?.name ?? "this column");

  const announcements: Announcements = {
    onDragStart: ({ active: item }) =>
      `Picked up ${(item.data.current as DragData | undefined)?.card.title ?? "card"}.`,
    onDragOver: ({ over }) => (over ? `Over ${stageName(over.id)}.` : "Not over a stage."),
    onDragEnd: ({ over }) => (over ? `Dropped in ${stageName(over.id)}.` : "Dropped outside the board."),
    onDragCancel: () => "Move cancelled.",
  };

  function moveApplication(card: BoardCard, toStageId: string) {
    if (card.stageId === toStageId) return;
    const target = optimisticColumns.find((column) => column.id === toStageId);
    startTransition(async () => {
      applyMove({ applicationId: card.applicationId, toStageId });
      const result = await changeStageAction({ applicationId: card.applicationId, stageId: toStageId });
      if (result.ok) toast.success(`${card.title} moved to ${target?.name ?? "stage"}`);
      else toast.error(result.error);
    });
  }

  function onDragStart(event: DragStartEvent) {
    setActive((event.active.data.current as DragData | undefined) ?? null);
  }

  function onDragEnd(event: DragEndEvent) {
    setActive(null);
    const data = event.active.data.current as DragData | undefined;
    const overId = event.over?.id;
    if (!data || !overId) return;
    if (data.kind === "application") {
      if (overId === SAVED_COLUMN) {
        toast.info("Applications can't move back to Saved. Close or delete the attempt instead.");
        return;
      }
      moveApplication(data.card, String(overId));
      return;
    }
    if (overId !== SAVED_COLUMN) {
      const stage = optimisticColumns.find((column) => column.id === overId);
      if (stage) setSavedDrop({ card: data.card, stage });
    }
  }

  const total = saved.length + optimisticColumns.reduce((sum, column) => sum + column.cards.length, 0);

  return (
    <>
      <p className="mb-3 text-[11px] text-[#9ba99f]">
        {total} cards · {optimisticColumns.length} stages · Drag with a mouse or touch, or focus a card and
        press Space, arrow keys, then Space to drop. Every card also has a “Move to” menu.
      </p>
      <DndContext
        // Stable id: dnd-kit's fallback is a module-level counter that differs between SSR and hydration.
        id="pipeline-board"
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActive(null)}
        accessibility={{ announcements }}
      >
        <div className="-mx-4 overflow-x-auto pb-4 md:-mx-8 xl:-mx-10">
          <div className="flex w-max items-stretch gap-3.5 px-4 pt-1 pb-4 md:px-8 xl:px-10">
            <Column
              id={SAVED_COLUMN}
              title="Saved"
              color="#9dac9a"
              count={saved.length}
              onAdd={() => setQuickAdd({ open: true })}
            >
              {saved.map((card) => (
                <DraggableCard
                  key={card.opportunityId}
                  id={`saved:${card.opportunityId}`}
                  data={{ kind: "saved", card }}
                >
                  <CardBody
                    href={`/jobs/${card.opportunityId}`}
                    card={card}
                    footer={`Saved ${card.savedOn ? formatDateOnly(card.savedOn, "MMM d") : ""}`}
                    menu={<SavedCardMenu card={card} />}
                  />
                </DraggableCard>
              ))}
            </Column>
            {optimisticColumns.map((column) => (
              <Column
                key={column.id}
                id={column.id}
                title={column.name}
                color={column.color ?? "#9dac9a"}
                count={column.cards.length}
                disabled={!column.isActive}
                onAdd={column.isActive ? () => setQuickAdd({ open: true, stageId: column.id }) : undefined}
              >
                {column.cards.map((card) => (
                  <DraggableCard
                    key={card.applicationId}
                    id={card.applicationId}
                    data={{ kind: "application", card }}
                  >
                    <CardBody
                      href={`/applications/${card.applicationId}`}
                      card={card}
                      paused={card.status === "PAUSED"}
                      footer={`${card.attemptNumber > 1 ? `Attempt ${card.attemptNumber} · ` : ""}Applied ${formatDateOnly(card.appliedOn, "MMM d")}`}
                      menu={
                        <MoveMenu
                          card={card}
                          columns={optimisticColumns}
                          onMove={(stageId) => moveApplication(card, stageId)}
                        />
                      }
                    />
                  </DraggableCard>
                ))}
              </Column>
            ))}
          </div>
        </div>
        <DragOverlay>
          {active ? (
            <div className="w-[241px] rotate-2 rounded-xl border border-[#a1c8b1] bg-white p-3.5 shadow-card-hover">
              <CardBody card={active.card} footer="" />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <QuickAddDialog
        options={options}
        open={quickAdd.open}
        stageId={quickAdd.stageId}
        onOpenChange={(open) => setQuickAdd((state) => ({ ...state, open }))}
      />
      <SavedDropDialog drop={savedDrop} today={options.today} onClose={() => setSavedDrop(null)} />
    </>
  );
}

interface ColumnProps {
  id: string;
  title: string;
  color: string;
  count: number;
  disabled?: boolean;
  onAdd?: () => void;
  children: React.ReactNode;
}

function Column({ id, title, color, count, disabled, onAdd, children }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled });
  return (
    <section
      ref={setNodeRef}
      aria-label={`${title} column, ${count} card${count === 1 ? "" : "s"}`}
      className={cn(
        "flex min-h-[420px] w-[260px] flex-col gap-2.5 rounded-[13px] border border-[#e8ede7] bg-[#f0f3ef] p-3 md:min-h-[510px] md:w-[265px]",
        isOver && "bg-[#e8f4eb] outline-2 outline-[#65ac86] outline-dashed",
      )}
    >
      <header className="mx-0.5 mt-1 mb-2 flex items-center gap-2">
        <i className="size-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />
        <h2 className="text-xs font-bold">{title}</h2>
        {disabled ? <StatusBadge label="Disabled" /> : null}
        <span className="ml-auto rounded-md bg-white px-1.5 py-0.5 text-[10px] text-[#86958a]">{count}</span>
      </header>
      {children}
      {onAdd ? (
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center justify-center gap-1 rounded-[9px] border border-dashed border-[#d3ded3] p-3 text-[11px] font-bold text-[#92a397] hover:bg-[#e8f2e9] hover:text-brand"
        >
          <Plus className="size-3" aria-hidden /> Add job
        </button>
      ) : null}
    </section>
  );
}

function DraggableCard({ id, data, children }: { id: string; data: DragData; children: React.ReactNode }) {
  const label = `${data.card.title} at ${data.card.company}`;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({
    id,
    data,
  });
  // The card is also the activator, so Enter/Space only pick it up when the card itself has
  // focus; from the title link inside, Enter follows the link instead of starting a drag.
  const ref = useCallback(
    (node: HTMLElement | null) => {
      setNodeRef(node);
      setActivatorNodeRef(node);
    },
    [setNodeRef, setActivatorNodeRef],
  );
  return (
    <article
      ref={ref}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "cursor-grab touch-none rounded-xl border border-[#e6ebe5] bg-white p-3.5 shadow-card hover:border-[#a1c8b1] hover:shadow-card-hover active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
      {...attributes}
      {...listeners}
      aria-label={label}
      aria-roledescription="Draggable job card"
    >
      {children}
    </article>
  );
}

type CardLike = Pick<
  BoardCard,
  | "title"
  | "company"
  | "salaryMin"
  | "salaryMax"
  | "currency"
  | "salaryPeriod"
  | "workArrangement"
  | "priority"
>;

function CardBody({
  card,
  footer,
  href,
  menu,
  paused,
}: {
  card: CardLike;
  footer: string;
  href?: string;
  menu?: React.ReactNode;
  paused?: boolean;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-[11px] font-semibold text-[#86958b]">
          <CompanyLogo name={card.company} size="sm" />
          <span className="truncate">{card.company}</span>
        </div>
        {menu}
      </div>
      <h3 className="mt-3 mb-1.5 text-[13px] leading-tight font-bold tracking-[-0.2px]">
        {href ? (
          <Link href={href} className="hover:underline" onPointerDown={(event) => event.stopPropagation()}>
            {card.title}
          </Link>
        ) : (
          card.title
        )}
      </h3>
      <p className="mb-3 text-[10px] text-[#95a199]">
        {formatSalaryRange({
          min: card.salaryMin,
          max: card.salaryMax,
          currency: card.currency,
          period: card.salaryPeriod,
        })}
        {card.workArrangement ? ` · ${WORK_ARRANGEMENT_LABEL[card.workArrangement]}` : ""}
      </p>
      <div className="flex items-center justify-between gap-1 border-t border-line-soft pt-3">
        {/* sr-only labels give the badges their meaning ("Priority: Medium", not just "Medium");
            the footer date already starts with its own label ("Applied", "Saved", "Attempt"). */}
        <span className="flex items-center gap-1">
          <span className="sr-only">Priority:</span>
          <PriorityBadge priority={card.priority} />
          {paused ? (
            <>
              <span className="sr-only">Status:</span>
              <StatusBadge label="Paused" tone="amber" />
            </>
          ) : null}
        </span>
        <span className="text-[10px] text-[#98a49d]">{footer}</span>
      </div>
    </>
  );
}

function MoveMenu({
  card,
  columns,
  onMove,
}: {
  card: BoardCard;
  columns: BoardColumn[];
  onMove: (stageId: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Move ${card.title} to another stage`}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-xs">Move to</DropdownMenuLabel>
        {columns
          .filter((column) => column.isActive)
          .map((column) => (
            <DropdownMenuItem
              key={column.id}
              disabled={column.id === card.stageId}
              onSelect={() => onMove(column.id)}
            >
              <i
                className="size-2 rounded-full"
                style={{ backgroundColor: column.color ?? "#9dac9a" }}
                aria-hidden
              />
              {column.name}
            </DropdownMenuItem>
          ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/applications/${card.applicationId}`}>Open application</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SavedCardMenu({ card }: { card: SavedCard }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Actions for ${card.title}`}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/jobs/${card.opportunityId}`}>Open job and mark as applied</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
