

## Fix: Dashboard chart showing "Unassigned" for tasks without a phase

**Problem**: The bar chart groups tasks by `phase`, and when a task has no phase set (null), it displays "Unassigned" as the label.

**Solution**: Change the fallback label from "Unassigned" to something more meaningful, or hide the phase chart entirely when no tasks have phases set. Since the task "Send mail" has `phase: null`, the chart shows "Unassigned".

**Change in `src/pages/Dashboard.tsx` (line 52)**:
- Replace `"Unassigned"` with `"General"` as the fallback label, or
- Skip tasks with no phase from the chart and only show the chart when there are tasks with phases

The cleaner approach: use `"General"` as the fallback label and only render the phase bar chart when at least one task has a non-null phase. This avoids a confusing "Unassigned" label.

