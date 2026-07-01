"use client";

import { useState, useEffect, useRef } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// --- Types ---
type Task = {
  id: string;
  title: string;
};

// --- Sample data ---
const initialTasks: Task[] = [
  { id: "1", title: "Review weekly reports" },
  { id: "2", title: "Update project documentation" },
  { id: "3", title: "Schedule team meeting" },
  { id: "4", title: "Send invoice to client" },
];

// ─────────────────────────────────────────────
// SortableTaskRow — one task row with dnd-kit hooks
// We chose @dnd-kit because it gives smooth reordering with a
// placeholder (gap) showing where the item will land, with
// zero animation jank. Native HTML5 drag events don't provide
// this "live preview" behaviour without significant manual work.
// ─────────────────────────────────────────────
function SortableTaskRow({
  task,
  onEdit,
  onDelete,
  onMoveTop,
  onMoveBottom,
}: {
  task: Task;
  onEdit: (id: string, newTitle: string) => void;
  onDelete: (id: string) => void;
  onMoveTop: (id: string) => void;
  onMoveBottom: (id: string) => void;
}) {
  // dnd-kit hook: gives us listeners, attributes, and transform values
  // isDragging = true while this specific item is being dragged
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // While dragging, make the original slot look "empty" so the
    // gap/placeholder is clearly visible
    opacity: isDragging ? 0.3 : 1,
  };

  // ── per-row state ──────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.title);
  const [menuOpen, setMenuOpen] = useState(false);

  // Ref to the dropdown menu container — used to detect outside clicks
  const menuRef = useRef<HTMLDivElement>(null);

  // useEffect: attach a click listener to the document to close the menu
  // when the user clicks anywhere outside this component's dropdown.
  // This runs once on mount (attaches the listener) and cleans up on unmount.
  useEffect(() => {
    if (!menuOpen) return; // Only listen when menu is actually open

    function handleClickOutside(e: MouseEvent) {
      // If the click target is NOT inside menuRef, close the menu
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    // Cleanup: remove the listener when menu closes or component unmounts
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]); // re-runs whenever menuOpen changes

  const saveEdit = () => {
    if (editValue.trim()) {
      onEdit(task.id, editValue.trim());
    } else {
      setEditValue(task.title); // revert if blank
    }
    setIsEditing(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 bg-white border border-[#6b4423] px-3 py-2.5"
    >
      {/* Drag handle — we attach dnd-kit's listeners here so only
          dragging by this icon triggers a drag, not the whole row */}
      <button
        {...attributes}
        {...listeners}
        className="text-[#6b4423] opacity-50 hover:opacity-80 cursor-grab active:cursor-grabbing px-1 shrink-0 touch-none"
        tabIndex={-1}
        aria-label="Drag to reorder"
      >
        ☰
      </button>

      {/* Title: either plain text or an editable input */}
      {isEditing ? (
        <input
          autoFocus
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveEdit();
            if (e.key === "Escape") {
              setEditValue(task.title);
              setIsEditing(false);
            }
          }}
          onBlur={saveEdit}
          className="flex-1 border-b border-[#6b4423] outline-none bg-transparent text-sm py-0.5"
        />
      ) : (
        <span className="flex-1 text-sm text-gray-900">{task.title}</span>
      )}

      {/* Options menu (⋮) */}
      <div ref={menuRef} className="relative shrink-0">
        <button
          onClick={() => setMenuOpen((prev) => !prev)}
          className="px-2 py-1 text-[#6b4423] font-bold text-base leading-none hover:bg-[#f5f0e8] rounded-sm"
          aria-label="Task options"
        >
          ⋮
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-[#6b4423] z-20 shadow-none">
            <button
              onClick={() => {
                setIsEditing(true);
                setEditValue(task.title);
                setMenuOpen(false);
              }}
              className="block w-full text-left px-3 py-2 text-sm border-b border-[#e5d9cc] hover:bg-[#f5f0e8]"
            >
              Edit
            </button>
            <button
              onClick={() => { onMoveTop(task.id); setMenuOpen(false); }}
              className="block w-full text-left px-3 py-2 text-sm border-b border-[#e5d9cc] hover:bg-[#f5f0e8]"
            >
              Move to Top
            </button>
            <button
              onClick={() => { onMoveBottom(task.id); setMenuOpen(false); }}
              className="block w-full text-left px-3 py-2 text-sm border-b border-[#e5d9cc] hover:bg-[#f5f0e8]"
            >
              Move to Bottom
            </button>
            <button
              onClick={() => { onDelete(task.id); setMenuOpen(false); }}
              className="block w-full text-left px-3 py-2 text-sm text-red-700 hover:bg-[#f5f0e8]"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// DragOverlayCard — the "ghost" card shown under the cursor while dragging.
// dnd-kit renders this in a portal, outside the normal DOM flow,
// so it moves freely without affecting layout of other items.
// ─────────────────────────────────────────────
function DragOverlayCard({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 bg-white border-2 border-[#6b4423] px-3 py-2.5 shadow-sm">
      <span className="text-[#6b4423] opacity-60 px-1">☰</span>
      <span className="flex-1 text-sm text-gray-900">{title}</span>
      <span className="px-2 py-1 text-[#6b4423] font-bold text-base">⋮</span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page component
// ─────────────────────────────────────────────
export default function TaskPage() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  // activeId tracks which task is currently being dragged
  // (used to render the DragOverlay card)
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeTask = tasks.find((t) => t.id === activeId);

  // PointerSensor: works for both mouse and touch.
  // activationConstraint means you need to move 8px before drag starts,
  // preventing accidental drags when clicking buttons.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // ── Event handlers ──────────────────────────

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const newTask: Task = {
      id: Date.now().toString(),
      title: newTaskTitle.trim(),
    };
    setTasks((prev) => [...prev, newTask]);
    setNewTaskTitle("");
  };

  const handleEdit = (id: string, newTitle: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, title: newTitle } : t))
    );
  };

  const handleDelete = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleMoveTop = (id: string) => {
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (idx <= 0) return prev; // already at top
      const updated = [...prev];
      const [item] = updated.splice(idx, 1);
      updated.unshift(item);
      return updated;
    });
  };

  const handleMoveBottom = (id: string) => {
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (idx === prev.length - 1) return prev; // already at bottom
      const updated = [...prev];
      const [item] = updated.splice(idx, 1);
      updated.push(item);
      return updated;
    });
  };

  // Called when drag starts — record which item is being dragged
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  // Called when drag ends — reorder using arrayMove (dnd-kit utility)
  // arrayMove takes the array, the old index, and the new index, and
  // returns a new array with the item moved to the new position.
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null); // clear the dragged item highlight

    if (!over || active.id === over.id) return; // dropped on itself or outside

    setTasks((prev) => {
      const oldIndex = prev.findIndex((t) => t.id === active.id);
      const newIndex = prev.findIndex((t) => t.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  return (
    <div className="min-h-screen bg-[#f5f0e8] p-8">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <h1 className="text-xl font-bold text-[#6b4423] mb-6">Task List</h1>

        {/* Add Task Form */}
        <form
          onSubmit={handleAddTask}
          className="flex gap-2 mb-6 pb-6 border-b border-[#6b4423]"
        >
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="New task title..."
            className="flex-1 border border-[#6b4423] bg-white px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#6b4423]"
          />
          <button
            type="submit"
            className="bg-[#6b4423] text-white px-4 py-2 text-sm font-medium rounded-sm hover:bg-[#8a5a35]"
          >
            Add Task
          </button>
        </form>

        {/* Drag-and-drop context wraps the entire sortable list.
            - sensors: how drag is initiated (pointer with 8px threshold)
            - collisionDetection: how dnd-kit finds which item you're hovering over
            - onDragStart/End: our handlers above */}
        {/* id="dnd-ctx" makes aria-describedby IDs deterministic,
            preventing a server/client hydration mismatch */}
        <DndContext
          id="dnd-ctx"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* SortableContext tells dnd-kit the order of sortable items.
              We pass the list of IDs so it can calculate positions. */}
          <SortableContext
            items={tasks.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-2">
              {tasks.map((task) => (
                <SortableTaskRow
                  key={task.id}
                  task={task}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onMoveTop={handleMoveTop}
                  onMoveBottom={handleMoveBottom}
                />
              ))}
            </div>
          </SortableContext>

          {/* DragOverlay renders the "floating" card that follows the cursor.
              It's rendered outside the list so it doesn't disturb the layout.
              The gap left behind in the list shows where the item will land. */}
          <DragOverlay>
            {activeTask ? <DragOverlayCard title={activeTask.title} /> : null}
          </DragOverlay>
        </DndContext>

        {tasks.length === 0 && (
          <p className="text-center text-sm text-gray-500 py-6">
            No tasks yet. Add one above.
          </p>
        )}
      </div>
    </div>
  );
}