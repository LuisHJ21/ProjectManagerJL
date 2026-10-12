import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(), email: text("email").notNull().unique(),
  name: text("name").notNull(), role: text("role", { enum: ["coordinator", "staff"] }).notNull().default("staff"),
  authId: text("auth_id").unique(), createdAt: text("created_at").notNull(),
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(), name: text("name").notNull(), code: text("code").notNull(),
  description: text("description").notNull().default(""), objective: text("objective").notNull().default(""),
  approach: text("approach", { enum: ["predictive", "adaptive", "hybrid"] }).notNull().default("hybrid"),
  status: text("status", { enum: ["planning", "active", "pending", "in_progress", "standby", "cancelled", "completed"] }).notNull().default("planning"),
  plannedStart: text("planned_start"), plannedEnd: text("planned_end"),
  createdBy: text("created_by").notNull(), createdAt: text("created_at").notNull(),
  scope: text("scope").notNull().default(""), risks: text("risks").notNull().default(""),
  budget: integer("budget").notNull().default(0), currency: text("currency").notNull().default("PEN"),
  groupId: text("group_id"),
});

export const projectGroups = sqliteTable("project_groups", {
  id: text("id").primaryKey(), name: text("name").notNull().unique(), createdAt: text("created_at").notNull(),
});

export const stages = sqliteTable("stages", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull(),
  name: text("name").notNull(), sortOrder: integer("sort_order").notNull().default(0),
});

export const stakeholders = sqliteTable("stakeholders", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull(),
  name: text("name").notNull(), organization: text("organization").notNull().default(""),
  role: text("role").notNull().default(""), raci: text("raci").notNull().default("I"),
});

export const projectMembers = sqliteTable("project_members", {
  projectId: text("project_id").notNull(), userId: text("user_id").notNull(),
});

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull(),
  title: text("title").notNull(), description: text("description").notNull().default(""),
  domain: text("domain").notNull().default("delivery"), assigneeId: text("assignee_id"),
  status: text("status", { enum: ["todo", "progress", "review", "done"] }).notNull().default("todo"),
  priority: text("priority", { enum: ["low", "medium", "high"] }).notNull().default("medium"),
  estimatedHours: integer("estimated_hours").notNull().default(0),
  plannedStart: text("planned_start"), plannedEnd: text("planned_end"),
  actualStart: text("actual_start"), actualEnd: text("actual_end"), createdAt: text("created_at").notNull(),
  kind: text("kind").notNull().default("activity"), stageId: text("stage_id"),
  progress: integer("progress").notNull().default(0),
  estimateValue: real("estimate_value").notNull().default(0),
  estimateUnit: text("estimate_unit").notNull().default("hours"),
});

export const taskDependencies = sqliteTable("task_dependencies", {
  taskId: text("task_id").notNull(), dependsOnId: text("depends_on_id").notNull(),
});

export const taskAssignees = sqliteTable("task_assignees", {
  taskId: text("task_id").notNull(), userId: text("user_id").notNull(),
});

export const taskReschedules = sqliteTable("task_reschedules", {
  id: text("id").primaryKey(), taskId: text("task_id").notNull(),
  oldStart: text("old_start"), oldEnd: text("old_end"),
  newStart: text("new_start"), newEnd: text("new_end"),
  reason: text("reason").notNull(), changedBy: text("changed_by").notNull(),
  createdAt: text("created_at").notNull(),
});
