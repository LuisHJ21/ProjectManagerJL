import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(), email: text("email").notNull().unique(),
  name: text("name").notNull(), role: text("role", { enum: ["coordinator", "staff"] }).notNull().default("staff"),
  authId: text("auth_id").unique(), createdAt: text("created_at").notNull(),
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(), name: text("name").notNull(), code: text("code").notNull(),
  description: text("description").notNull().default(""), objective: text("objective").notNull().default(""),
  approach: text("approach", { enum: ["predictive", "adaptive", "hybrid"] }).notNull().default("hybrid"),
  status: text("status", { enum: ["planning", "active", "completed"] }).notNull().default("planning"),
  plannedStart: text("planned_start"), plannedEnd: text("planned_end"),
  createdBy: text("created_by").notNull(), createdAt: text("created_at").notNull(),
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
});
