import { db } from "./db";
import { questions, type Question, type InsertQuestion, customCheckpoints, settings, type CustomCheckpoint, type InsertCustomCheckpoint, userStats, type UserStats, type InsertUserStats } from "@shared/schema";
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
  getSettings(): Promise<{ timeLimit: number; checkpointCount: number; rovingCount: number; radius: number }>;
  updateSettings(timeLimit: number, checkpointCount: number, rovingCount: number, radius: number): Promise<void>;

  // User Stats
  getUserStats(): Promise<UserStats>;
  updateUserStats(stats: Partial<UserStats>): Promise<UserStats>;
  addPoints(points: number): Promise<UserStats>;
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
    const [newQuestion] = await db.insert(questions).values({
      question: question.question,
      answer: question.answer,
      options: question.options,
      points: question.points ?? 10,
      difficulty: question.difficulty ?? "easy"
    }).returning();
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

  async getSettings(): Promise<{ timeLimit: number; checkpointCount: number; rovingCount: number; radius: number }> {
    const [s] = await db.select().from(settings);
    if (!s) return { timeLimit: 30, checkpointCount: 5, rovingCount: 2, radius: 500 };
    return { 
      timeLimit: s.timeLimit,
      checkpointCount: s.checkpointCount,
      rovingCount: s.rovingCount,
      radius: s.radius
    };
  }

  async updateSettings(timeLimit: number, checkpointCount: number, rovingCount: number, radius: number): Promise<void> {
    const [s] = await db.select().from(settings);
    if (s) {
      await db.update(settings).set({ timeLimit, checkpointCount, rovingCount, radius }).where(eq(settings.id, s.id));
    } else {
      await db.insert(settings).values({ timeLimit, checkpointCount, rovingCount, radius });
    }
  }

  async getUserStats(): Promise<UserStats> {
    const [stats] = await db.select().from(userStats);
    if (!stats) {
      const [newStats] = await db.insert(userStats).values({
        totalPoints: 0,
        currentStreak: 0,
        longestStreak: 0,
        huntsCompleted: 0,
        pointsHistory: []
      }).returning();
      return newStats;
    }
    return stats;
  }

  async updateUserStats(statsUpdate: Partial<UserStats>): Promise<UserStats> {
    const stats = await this.getUserStats();
    const [updated] = await db.update(userStats)
      .set(statsUpdate)
      .where(eq(userStats.id, stats.id))
      .returning();
    return updated;
  }

  async addPoints(points: number): Promise<UserStats> {
    const stats = await this.getUserStats();
    const today = new Date().toISOString().split('T')[0];
    
    let history = [...(stats.pointsHistory as {date: string, points: number}[])];
    const todayIndex = history.findIndex(h => h.date === today);
    
    if (todayIndex >= 0) {
      history[todayIndex].points += points;
    } else {
      history.push({ date: today, points });
    }

    if (history.length > 30) history = history.slice(-30);

    const [updated] = await db.update(userStats)
      .set({ 
        totalPoints: stats.totalPoints + points,
        pointsHistory: history
      })
      .where(eq(userStats.id, stats.id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
