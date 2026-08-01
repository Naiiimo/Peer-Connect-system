export type ScheduleConflict = {
  topic?: string | null;
  start_at: string;
  end_at: string;
  tutor_id: string;
  student_id: string;
};

export function formatConflict(conflict: ScheduleConflict, currentUserId: string) {
  const start = new Date(conflict.start_at);
  const end = new Date(conflict.end_at);
  const owner = conflict.student_id === currentUserId ? "your" : "the other person's";
  return `This overlaps ${owner} “${conflict.topic ?? "scheduled session"}” on ${start.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}, ${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}–${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`;
}

export function validateTimeRange(startValue: string, endValue: string) {
  if (!startValue || !endValue) return "Choose both a start and end time.";
  const start = new Date(startValue);
  const end = new Date(endValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Choose valid dates and times.";
  if (end <= start) return "End time must be after start time.";
  if (start.getTime() <= Date.now()) return "Start time must be in the future.";
  return null;
}