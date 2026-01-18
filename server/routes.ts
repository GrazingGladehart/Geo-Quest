import { getDistance } from "geolib";
import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { openai } from "./replit_integrations/image/client";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Generate random checkpoints
  app.post(api.game.generate.path, async (req, res) => {
    try {
      const { lat, lng, radius, count } = api.game.generate.input.parse(req.body);
      const gameSettings = await storage.getSettings();
      const rovingCount = gameSettings.rovingCount ?? 2;
      
      const totalCount = count + rovingCount;
      const randomQuestions = await storage.getRandomQuestions(totalCount);
      const customCheckpoints = await storage.getCustomCheckpoints();
      
      const minDistanceFromCenter = 7; // meters
      const minDistanceBetweenCheckpoints = 7; // meters
      const generatedCoords: {lat: number, lng: number}[] = [];

      const checkpoints = [
        ...randomQuestions.map((q, index) => {
          let attempts = 0;
          let finalLat = lat, finalLng = lng;
          const isRoving = index >= count;
          
          while (attempts < 50) {
            const r = (minDistanceFromCenter + Math.sqrt(Math.random()) * (radius - minDistanceFromCenter)) / 111000;
            const t = 2 * Math.PI * Math.random();
            const x = r * Math.cos(t);
            const y = r * Math.sin(t) / Math.cos(lat * Math.PI / 180);
            
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
            points: isRoving ? q.points * 2 : q.points,
            collected: false,
            isCustom: false,
            isRoving
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
          isCustom: true,
          isRoving: false
        }))
      ];

      res.json(checkpoints);
    } catch (err) {
      res.status(400).json({ message: "Generation failed" });
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
      const { timeLimit, checkpointCount, rovingCount, radius } = req.body;
      await storage.updateSettings(timeLimit, checkpointCount, rovingCount, radius);
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
      
      if (isCorrect) {
        await storage.addPoints(question.points);
      }

      res.json({
        correct: isCorrect,
        points: isCorrect ? question.points : 0,
        message: isCorrect ? `Correct! +${question.points} points` : "Incorrect. Try again!",
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

  // User Stats
  app.get("/api/stats", async (req, res) => {
    const stats = await storage.getUserStats();
    res.json(stats);
  });

  app.get("/api/checkpoints/all", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      const custom = await storage.getCustomCheckpoints();
      
      // Return custom ones and placeholder random ones for map visualization
      // In a real app we might want to store random ones too, but for now
      // we'll just show custom ones as movable and settings define others
      res.json(custom.map(cp => ({ ...cp, isCustom: true })));
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch checkpoints" });
    }
  });

  app.patch("/api/checkpoints/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { lat, lng } = req.body;
      // Implement move logic in storage
      // For now just success
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ message: "Move failed" });
    }
  });

  app.post("/api/stats/complete-hunt", async (req, res) => {
    const stats = await storage.getUserStats();
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    let { currentStreak, longestStreak, lastActivityDate, huntsCompleted, streakFreezes } = stats;
    
    const hasToday = lastActivityDate === today;
    const hasYesterday = lastActivityDate === yesterday;

    if (!hasToday) {
      if (hasYesterday) {
        currentStreak++;
      } else if (streakFreezes > 0) {
        // Use a streak freeze if missed a day
        streakFreezes--;
        currentStreak++;
      } else {
        currentStreak = 1;
      }
    }
    
    // Completing quest gifts a streak freeze
    streakFreezes++;
    
    if (currentStreak > longestStreak) longestStreak = currentStreak;
    
    const updated = await storage.updateUserStats({
      currentStreak,
      longestStreak,
      lastActivityDate: today,
      huntsCompleted: huntsCompleted + 1,
      streakFreezes
    });
    
    res.json(updated);
  });

  // Photo Verification using OpenAI Vision
  app.post("/api/verify-photo", async (req, res) => {
    try {
      const { itemName, image } = req.body;
      
      if (!image) {
        return res.status(400).json({ message: "Image is required" });
      }

      // Extract base64 part from data URL if present
      const base64Image = image.includes(",") ? image.split(",")[1] : image;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `You are an expert nature guide. Identify if there is a ${itemName} in this image. 
                Respond ONLY with a JSON object in this format: 
                {
                  "verified": boolean,
                  "confidence": number (0-100),
                  "feedback": "a short, encouraging sentence explaining why it is or isn't the item"
                }`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      const isSuccess = result.verified && result.confidence > 70;
      
      if (isSuccess) {
        await storage.addPoints(25);
      }
      
      res.json({
        verified: isSuccess,
        confidence: result.confidence,
        feedback: result.feedback,
        points: isSuccess ? 25 : 0
      });
    } catch (err) {
      console.error("Vision verification failed:", err);
      res.status(500).json({ message: "Failed to analyze image" });
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
