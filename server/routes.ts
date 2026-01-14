import { getDistance } from "geolib";
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
      
      const minDistanceFromCenter = 7; // meters
      const minDistanceBetweenCheckpoints = 7; // meters
      const generatedCoords: {lat: number, lng: number}[] = [];

      const checkpoints = [
        ...randomQuestions.map(q => {
          let attempts = 0;
          let x = 0, y = 0;
          let finalLat = lat, finalLng = lng;
          
          while (attempts < 50) {
            // Ensure radius is scaled correctly and use square root for uniform distribution within circle
            const r = (minDistanceFromCenter + Math.sqrt(Math.random()) * (radius - minDistanceFromCenter)) / 111000;
            const t = 2 * Math.PI * Math.random();
            x = r * Math.cos(t);
            y = r * Math.sin(t) / Math.cos(lat * Math.PI / 180);
            
            finalLat = lat + x;
            finalLng = lng + y;

            const distFromStart = getDistance({latitude: lat, longitude: lng}, {latitude: finalLat, longitude: finalLng});
            const tooCloseToOthers = generatedCoords.some(c => 
              getDistance({latitude: finalLat, longitude: finalLng}, {latitude: c.lat, longitude: c.lng}) < minDistanceBetweenCheckpoints
            );

            if (distFromStart >= minDistanceFromCenter && distFromStart <= radius && !tooCloseToOthers) break;
            attempts++;
          }
          
          generatedCoords.push({lat: finalLat, lng: finalLng});
          
          return {
            id: q.id,
            lat: finalLat,
            lng: finalLng,
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

  // Get all questions (for settings page dropdown)
  app.get("/api/questions", async (req, res) => {
    const questions = await storage.getAllQuestions();
    res.json(questions);
  });

  app.get(api.game.getSettings.path, async (req, res) => {
    const s = await storage.getSettings();
    res.json(s);
  });

  app.post(api.game.updateSettings.path, async (req, res) => {
    try {
      const { timeLimit, checkpointCount, radius } = req.body;
      await storage.updateSettings(timeLimit, checkpointCount, radius);
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
