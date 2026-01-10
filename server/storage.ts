import { db } from "./db";
import { questions, type Question, type InsertQuestion, customCheckpoints, settings, type CustomCheckpoint, type InsertCustomCheckpoint } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

export interface IStorage {
  // Questions
  getAllQuestions(): Promise<Question[]>;
  getQuestion(id: number): Promise<Question | undefined>;
  createQuestion(question: InsertQuestion): Promise<Question>;
  getRandomQuestions(count: number): Promise<Question[]>;
  
  // Custom Checkpoints
  getCustomCheckpoints(): Promise<(CustomCheckpoint & { question: Question })[]>;
  addCustomCheckpoint(cp: InsertCustomCheckpoint): Promise<CustomCheckpoint>;
  
  // Settings
  getSettings(): Promise<{ timeLimit: number }>;
  updateSettings(timeLimit: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getAllQuestions(): Promise<Question[]> {
    return await db.select().from(questions);
  }

  async getQuestion(id: number): Promise<Question | undefined> {
    const [question] = await db.select().from(questions).where(eq(questions.id, id));
    return question;
  }

  async createQuestion(question: InsertQuestion): Promise<Question> {
    const [newQuestion] = await db.insert(questions).values(question).returning();
    return newQuestion;
  }

  async getRandomQuestions(count: number): Promise<Question[]> {
    return await db.select().from(questions).orderBy(sql`RANDOM()`).limit(count);
  }

  async getCustomCheckpoints(): Promise<(CustomCheckpoint & { question: Question })[]> {
    const results = await db.select({
      checkpoint: customCheckpoints,
      question: questions
    }).from(customCheckpoints)
      .innerJoin(questions, eq(customCheckpoints.questionId, questions.id));
    
    return results.map(r => ({ ...r.checkpoint, question: r.question }));
  }

  async addCustomCheckpoint(cp: InsertCustomCheckpoint): Promise<CustomCheckpoint> {
    const [newCp] = await db.insert(customCheckpoints).values(cp).returning();
    return newCp;
  }

  async getSettings(): Promise<{ timeLimit: number }> {
    const [s] = await db.select().from(settings);
    if (!s) return { timeLimit: 30 };
    return { timeLimit: s.timeLimit };
  }

  async updateSettings(timeLimit: number): Promise<void> {
    const [s] = await db.select().from(settings);
    if (s) {
      await db.update(settings).set({ timeLimit }).where(eq(settings.id, s.id));
    } else {
      await db.insert(settings).values({ timeLimit });
    }
  }
}

export const storage = new DatabaseStorage();
