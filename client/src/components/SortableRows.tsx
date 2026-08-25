import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, Modifier } from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { reorderAnnouncements } from "../core/reorder";

interface Props<T extends { key: number }> {
  items: T[];
  /** Goes on the <ol>, so a caller can add its own modifier. */
  className: string;
  /** What one row is — "olive oil", "step 2". Used for the handle's label and
   *  for what gets said out loud as the row moves. */
  describe: (item: T, index: number) => string;
  /** The caller owns the array; this only ever reports the two indices. */
  onMove: (from: number, to: number) => void;
  children: (item: T, index: number) => ReactNode;
}

/**
 * A list whose rows can be dragged into a new order.
 *
 * dnd-kit does the parts that are genuinely hard to get right: the row tracks
 * the pointer while its neighbours part around it, the list scrolls when a
 * drag reaches the edge of the window, and a keyboard gets the same sorting
 * through its own sensor. That last one is not a nicety — WCAG 2.2's
 * dragging-movements criterion wants a path that is not a drag, and a keyboard
 * has no pointer to drag with.
 *
 * It is the one dependency in this app that isn't React itself, and it is here
 * because the alternative was hand-rolling pointer physics and a FLIP
 * animation and then maintaining both.
 */
export function SortableRows<T extends { key: number }>({
  items,
  className,
  describe,
  onMove,
  children,
}: Props<T>) {
  const sensors = useSensors(
    // A few pixels of travel before a drag begins, so a plain click on the
    // handle — or a tap that was on its way to scrolling — isn't read as the
    // start of a move.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // These rows only ever move up and down, so sideways travel is noise the
  // pointer picks up on the way. Written out rather than pulled from
  // @dnd-kit/modifiers, which would be a fourth package for one line.
  const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

  const announcements = useMemo(() => reorderAnnouncements(items, describe), [items, describe]);

  function onDragEnd({ active, over }: DragEndEvent) {
    if (over === null || active.id === over.id) {
      return;
    }
    const from = items.findIndex((item) => item.key === active.id);
    const to = items.findIndex((item) => item.key === over.id);
    if (from !== -1 && to !== -1) {
      onMove(from, to);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[verticalOnly]}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Press space to pick this row up. Move it with the arrow keys, drop it with space, or cancel with escape.",
        },
        announcements,
      }}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={items.map((item) => item.key)} strategy={verticalListSortingStrategy}>
        <ol className={className}>
          {items.map((item, index) => (
            // Keyed by the row's own key, never by index. Keyed by index, React
            // reuses the node at position 2 for whatever row is now at position
            // 2 — so a move would swap the two rows' values straight back and
            // look exactly like a state bug.
            <Row key={item.key} id={item.key} label={`Reorder ${describe(item, index)}`}>
              {children(item, index)}
            </Row>
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function Row({ id, label, children }: { id: number; label: string; children: ReactNode }) {
  const stillness = usePrefersReducedMotion();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    // Null rather than a shorter duration: somebody who has asked their
    // system for less motion is asking for none, and the row still arrives
    // where they put it.
    transition: stillness ? null : undefined,
    attributes: { roleDescription: "sortable row" },
  });

  return (
    <li
      ref={setNodeRef}
      className={isDragging ? "rows__row--lifted" : undefined}
      style={{
        // Written out rather than taken from @dnd-kit/utilities' CSS helper,
        // which is a transitive package this app doesn't depend on directly.
        // The modifier has already flattened x, so only y ever moves.
        transform: transform === null ? undefined : `translate3d(0, ${transform.y}px, 0)`,
        transition,
      }}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="rows__handle"
        // Spread first so the label below wins: dnd-kit sets a role and a
        // description here, and the name of the row is ours to give.
        {...attributes}
        {...listeners}
        aria-label={label}
        title="Drag to reorder"
      >
        {/* The one filled mark in the app rather than a stroked one: a grip is
            a pattern of dots, and drawing it as six round-capped hairlines
            would be the same picture told a harder way. */}
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          {[5, 8, 11].flatMap((y) =>
            [5.5, 10.5].map((x) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="1.1" fill="currentColor" />
            )),
          )}
        </svg>
      </button>
      {children}
    </li>
  );
}

/** Whether the reader has asked their system for less movement. */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reduced;
}
