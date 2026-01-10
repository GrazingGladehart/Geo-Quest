import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Generate random checkpoints
  app.post(api.game.generate.path, async (req, res) => {
    try {
      const { lat, lng, radius, count } = api.game.generate.input.parse(req.body);
      
      const randomQuestions = await storage.getRandomQuestions(count);
      const customCheckpoints = await storage.getCustomCheckpoints();
      
      const checkpoints = [
        ...randomQuestions.map(q => {
          const r = radius / 111000;
          const u = Math.random();
          const v = Math.random();
          const w = r * Math.sqrt(u);
          const t = 2 * Math.PI * v;
          const x = w * Math.cos(t);
          const y = w * Math.sin(t);
          
          return {
            id: q.id,
            lat: lat + x,
            lng: lng + y / Math.cos(lat * Math.PI / 180),
            question: q.question,
            options: q.options,
            points: q.points,
            collected: false,
            isCustom: false
          };
        }),
        ...customCheckpoints.map(cp => ({
          id: cp.question.id,
          lat: cp.lat,
          lng: cp.lng,
          question: cp.question.question,
          options: cp.question.options,
          points: cp.question.points,
          collected: false,
          isCustom: true
        }))
      ];

      res.json(checkpoints);
    } catch (err) {
      // ... same error handling
    }
  });

  app.get(api.game.getSettings.path, async (req, res) => {
    const s = await storage.getSettings();
    res.json(s);
  });

  app.post(api.game.updateSettings.path, async (req, res) => {
    try {
      const { timeLimit } = api.game.updateSettings.input.parse(req.body);
      await storage.updateSettings(timeLimit);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ message: "Invalid settings" });
    }
  });

  app.post(api.game.addCustomCheckpoint.path, async (req, res) => {
    try {
      const input = api.game.addCustomCheckpoint.input.parse(req.body);
      const cp = await storage.addCustomCheckpoint(input);
      res.status(201).json({ id: cp.id });
    } catch (err) {
      res.status(400).json({ message: "Invalid checkpoint data" });
    }
  });

  // Verify Answer
  app.post(api.game.verify.path, async (req, res) => {
    try {
      const { questionId, answer } = api.game.verify.input.parse(req.body);
      const question = await storage.getQuestion(questionId);
      
      if (!question) {
        return res.status(404).json({ message: "Question not found" });
      }

      const isCorrect = question.answer.toLowerCase() === answer.toLowerCase();
      
      res.json({
        correct: isCorrect,
        points: isCorrect ? question.points : 0,
        message: isCorrect ? "Correct! +10 points" : "Incorrect. Try again!",
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // Seed Data if empty
  const existing = await storage.getAllQuestions();
  if (existing.length === 0) {
    const seedQuestions = [
      {
        question: "What is the chemical symbol for Gold?",
        answer: "Au",
        options: ["Au", "Ag", "Fe", "Cu"],
        points: 10,
        difficulty: "easy"
      },
      {
        question: "Which planet is known as the Red Planet?",
        answer: "Mars",
        options: ["Venus", "Mars", "Jupiter", "Saturn"],
        points: 10,
        difficulty: "easy"
      },
      {
        question: "What is the powerhouse of the cell?",
        answer: "Mitochondria",
        options: ["Nucleus", "Mitochondria", "Ribosome", "Golgi"],
        points: 15,
        difficulty: "medium"
      },
      {
        question: "What gas do plants absorb from the atmosphere?",
        answer: "Carbon Dioxide",
        options: ["Oxygen", "Nitrogen", "Carbon Dioxide", "Hydrogen"],
        points: 10,
        difficulty: "easy"
      },
      {
        question: "How many bones are in the adult human body?",
        answer: "206",
        options: ["206", "208", "210", "205"],
        points: 20,
        difficulty: "hard"
      }
    ];
    
    for (const q of seedQuestions) {
      await storage.createQuestion(q);
    }
  }

  return httpServer;
}
