import { pgTable, text, serial, integer, boolean, jsonb, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  options: jsonb("options").$type<string[]>().notNull(),
  points: integer("points").notNull().default(10),
  difficulty: text("difficulty").notNull().default("easy"),
});

export const customCheckpoints = pgTable("custom_checkpoints", {
  id: serial("id").primaryKey(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  questionId: integer("question_id").references(() => questions.id),
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  timeLimit: integer("time_limit").notNull().default(30), // minutes
});

export const insertQuestionSchema = createInsertSchema(questions);
export type Question = typeof questions.$inferSelect;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;

export const insertCustomCheckpointSchema = createInsertSchema(customCheckpoints);
export type CustomCheckpoint = typeof customCheckpoints.$inferSelect;
export type InsertCustomCheckpoint = z.infer<typeof insertCustomCheckpointSchema>;

export const insertSettingsSchema = createInsertSchema(settings);
export type Settings = typeof settings.$inferSelect;

export const checkpointSchema = z.object({
  id: z.number(),
  lat: z.number(),
  lng: z.number(),
  question: z.string(),
  options: z.array(z.string()),
  points: z.number(),
  collected: z.boolean().optional(),
  isCustom: z.boolean().optional(),
});

export type Checkpoint = z.infer<typeof checkpointSchema>;

export const verifyAnswerSchema = z.object({
  questionId: z.number(),
  answer: z.string(),
});

export type VerifyAnswerRequest = z.infer<typeof verifyAnswerSchema>;
