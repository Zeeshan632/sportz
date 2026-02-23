import { Router } from 'express';
import {
  createCommentarySchema,
  listCommentaryQuerySchema,
} from '../validation/commentary.js';
import { matchIdParamSchema } from '../validation/matches.js';
import { db } from '../db/db.js';
import { commentary } from '../db/schema.js';
import { desc } from 'drizzle-orm';

export const commentaryRouter = Router({ mergeParams: true });

const MAX_LIMIT = 100;

commentaryRouter.get('/', async (req, res) => {
  const paramsParsed = matchIdParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    return res
      .status(400)
      .json({ error: 'Invalid params', details: paramsParsed.error.issues });
  }

  const queryParsed = listCommentaryQuerySchema.safeParse(req.query);
  if (!queryParsed.success) {
    return res
      .status(400)
      .json({ error: 'Invalid query', details: queryParsed.error.issues });
  }

  const matchId = paramsParsed.data.id;
  const limit = Math.min(queryParsed.data?.limit ?? 50, MAX_LIMIT);

  try {
    const data = await db
      .select()
      .from(commentary)
      .where({ matchId })
      .orderBy(desc(commentary.createdAt))
      .limit(limit);

    res.json({ data });
  } catch (error) {
    console.error('Error fetching commentary:', error);
    return res.status(500).json({
      error: 'failed to fetch commentary',
      details: JSON.stringify(error),
    });
  }
});

commentaryRouter.post('/', async (req, res) => {
  const paramsParsed = matchIdParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    return res
      .status(400)
      .json({ error: 'Invalid params', details: paramsParsed.error.issues });
  }

  const bodyParsed = createCommentarySchema.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json({
      error: 'Invalid payload',
      details: bodyParsed.error.issues,
    });
  }

  const matchId = paramsParsed.data.id;

  try {
    const [entry] = await db
      .insert(commentary)
      .values({
        matchId,
        ...bodyParsed.data,
      })
      .returning();
    
    if(res.app.locals.broadcastCommentary){
      res.app.locals.broadcastCommentary(entry.matchId, entry)
    }
    
    res.status(201).json({ data: entry });
  } catch (error) {
    console.error('Error creating commentary:', error);
    return res.status(500).json({
      error: 'failed to create commentary',
      details: JSON.stringify(error),
    });
  }
});