import { z } from 'zod'

const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/

export const listMatchesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
})

export const MATCH_STATUS = {
  SCHEDULED: 'scheduled',
  LIVE: 'live',
  FINISHED: 'finished',
}

export const matchIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const createMatchSchema = z
  .object({
    sport: z.string().min(1),
    homeTeam: z.string().min(1),
    awayTeam: z.string().min(1),
    startTime: z
      .string()
      .refine(
        (v) => iso8601Regex.test(v) && !Number.isNaN(Date.parse(v)),
        { message: 'startTime must be a valid ISO date string' }
      ),
    endTime: z
      .string()
      .refine(
        (v) => iso8601Regex.test(v) && !Number.isNaN(Date.parse(v)),
        { message: 'endTime must be a valid ISO date string' }
      ),
    homeScore: z.coerce.number().int().nonnegative().optional(),
    awayScore: z.coerce.number().int().nonnegative().optional(),
  })
  .superRefine((data, ctx) => {
    const start = Date.parse(data.startTime)
    const end = Date.parse(data.endTime)
    if (Number.isNaN(start) || Number.isNaN(end)) return
    if (end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endTime'],
        message: 'endTime must be after startTime',
      })
    }
  })

export const updateScoreSchema = z.object({
  homeScore: z.coerce.number().int().min(0),
  awayScore: z.coerce.number().int().min(0),
})

export default null
