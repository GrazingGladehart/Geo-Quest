import { z } from 'zod';
import { checkpointSchema, verifyAnswerSchema } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  game: {
    generate: {
      method: 'POST' as const,
      path: '/api/game/generate',
      input: z.object({
        lat: z.number(),
        lng: z.number(),
        radius: z.number().default(500), // meters
        count: z.number().default(5),
      }),
      responses: {
        200: z.array(checkpointSchema),
        400: errorSchemas.validation,
      },
    },
    verify: {
      method: 'POST' as const,
      path: '/api/game/verify',
      input: verifyAnswerSchema,
      responses: {
        200: z.object({
          correct: z.boolean(),
          points: z.number(),
          message: z.string(),
        }),
        404: errorSchemas.notFound,
      },
    },
    getSettings: {
      method: 'GET' as const,
      path: '/api/settings',
      responses: {
        200: z.object({
          timeLimit: z.number(),
        }),
      },
    },
    updateSettings: {
      method: 'POST' as const,
      path: '/api/settings',
      input: z.object({
        timeLimit: z.number(),
      }),
      responses: {
        200: z.object({ success: z.boolean() }),
      },
    },
    addCustomCheckpoint: {
      method: 'POST' as const,
      path: '/api/checkpoints/custom',
      input: z.object({
        lat: z.number(),
        lng: z.number(),
        questionId: z.number(),
      }),
      responses: {
        201: z.object({ id: z.number() }),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type GenerateGameRequest = z.infer<typeof api.game.generate.input>;
export type VerifyAnswerResponse = z.infer<typeof api.game.verify.responses[200]>;
