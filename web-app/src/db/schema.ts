import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/**
 * Skill stars table
 * Tracks upvotes/star counts for each skill
 */
export const skillStars = sqliteTable('skill_stars', {
  skillId: text('skill_id').primaryKey().notNull(),
  starCount: integer('star_count').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type SkillStar = typeof skillStars.$inferSelect;
export type NewSkillStar = typeof skillStars.$inferInsert;
