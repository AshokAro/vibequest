// Leveling system calculations

// XP Leveling: Level 1→2 requires 500 XP, then increases progressively
// Formula: Each level requires 500 + (level - 1) * 300 XP
// Level 1→2: 500 XP
// Level 2→3: 800 XP (500 + 300)
// Level 3→4: 1100 XP (500 + 600)
// etc.

/**
 * Get XP required to reach next level from current level
 * @param currentLevel - Current user level (1-based)
 * @returns XP needed to reach next level
 */
export function getXpToNextLevel(currentLevel: number): number {
  // Level 1 starts at 500, each subsequent level adds 300 more than the previous jump
  // Base: 500, increment: 300 per level progression
  return 500 + (currentLevel - 1) * 300;
}

/**
 * Calculate level from total XP
 * @param totalXp - Total accumulated XP
 * @returns Current level and progress info
 */
export function calculateLevelFromXp(totalXp: number): {
  level: number;
  xpInCurrentLevel: number;
  xpToNext: number;
  progressPercent: number;
} {
  let level = 1;
  let xpRemaining = totalXp;

  while (xpRemaining >= getXpToNextLevel(level)) {
    xpRemaining -= getXpToNextLevel(level);
    level++;
  }

  const xpToNext = getXpToNextLevel(level);
  const progressPercent = Math.min(100, (xpRemaining / xpToNext) * 100);

  return {
    level,
    xpInCurrentLevel: xpRemaining,
    xpToNext,
    progressPercent,
  };
}

// Skill Leveling: Similar progression but with smaller numbers
// Level 1→2: 100 points
// Level 2→3: 160 points (100 + 60)
// Level 3→4: 220 points (160 + 60)
// Each level adds 60 more points needed

/**
 * Get points required to reach next skill level
 * @param currentLevel - Current skill level (1-based)
 * @returns Points needed to reach next level
 */
export function getSkillPointsToNextLevel(currentLevel: number): number {
  // Level 1 starts at 100, each subsequent level adds 60
  return 100 + (currentLevel - 1) * 60;
}

/**
 * Calculate skill level from total points
 * Handles level-up with carryover points
 * @param totalPoints - Total accumulated points in this skill
 * @returns Current level and progress info
 */
export function calculateSkillLevel(totalPoints: number): {
  level: number;
  pointsInLevel: number;
  pointsToNext: number;
  progressPercent: number;
} {
  let level = 1;
  let pointsRemaining = totalPoints;

  while (pointsRemaining >= getSkillPointsToNextLevel(level)) {
    pointsRemaining -= getSkillPointsToNextLevel(level);
    level++;
  }

  const pointsToNext = getSkillPointsToNextLevel(level);
  const progressPercent = Math.min(100, (pointsRemaining / pointsToNext) * 100);

  return {
    level,
    pointsInLevel: pointsRemaining,
    pointsToNext,
    progressPercent,
  };
}

/**
 * Calculate total accumulated points from skill level info
 * Used when adding points to a skill (reverse of calculateSkillLevel)
 * @param level - Current level
 * @param pointsInLevel - Points accumulated in current level
 * @returns Total points accumulated across all levels
 */
export function getTotalSkillPoints(level: number, pointsInLevel: number): number {
  // Sum up points needed for all previous levels
  let total = 0;
  for (let i = 1; i < level; i++) {
    total += getSkillPointsToNextLevel(i);
  }
  // Add points in current level
  return total + pointsInLevel;
}

/**
 * Add XP to user and calculate new level
 * @param currentXp - Current total XP
 * @param xpToAdd - XP to add
 * @returns New level info
 */
export function addXp(currentXp: number, xpToAdd: number): {
  newTotalXp: number;
  level: number;
  xpInCurrentLevel: number;
  xpToNext: number;
  progressPercent: number;
  leveledUp: boolean;
} {
  const newTotalXp = currentXp + xpToAdd;
  const beforeLevel = calculateLevelFromXp(currentXp).level;
  const after = calculateLevelFromXp(newTotalXp);

  return {
    newTotalXp,
    level: after.level,
    xpInCurrentLevel: after.xpInCurrentLevel,
    xpToNext: after.xpToNext,
    progressPercent: after.progressPercent,
    leveledUp: after.level > beforeLevel,
  };
}

/**
 * Add points to a skill and calculate new level
 * @param currentPoints - Current total points in skill
 * @param pointsToAdd - Points to add
 * @returns New skill level info
 */
export function addSkillPoints(currentPoints: number, pointsToAdd: number): {
  newTotalPoints: number;
  level: number;
  pointsInLevel: number;
  pointsToNext: number;
  progressPercent: number;
  leveledUp: boolean;
} {
  const newTotalPoints = currentPoints + pointsToAdd;
  const beforeLevel = calculateSkillLevel(currentPoints).level;
  const after = calculateSkillLevel(newTotalPoints);

  return {
    newTotalPoints,
    level: after.level,
    pointsInLevel: after.pointsInLevel,
    pointsToNext: after.pointsToNext,
    progressPercent: after.progressPercent,
    leveledUp: after.level > beforeLevel,
  };
}

/**
 * Calculate momentum change
 * +1 for each quest completed
 * -1 per day since last quest
 * @param currentMomentum - Current momentum score
 * @param questsCompleted - Number of quests just completed
 * @param daysSinceLastQuest - Days since last quest (0 if today)
 * @returns New momentum score (minimum 0)
 */
export function calculateMomentum(
  currentMomentum: number,
  questsCompleted: number,
  daysSinceLastQuest: number
): number {
  // Add momentum for completed quests
  const gained = questsCompleted;

  // Lose momentum for inactive days (except today)
  const lost = daysSinceLastQuest > 0 ? daysSinceLastQuest : 0;

  // Calculate new momentum (minimum 0)
  return Math.max(0, currentMomentum + gained - lost);
}

/**
 * Get days difference between two dates
 * @param date1 - First date
 * @param date2 - Second date (defaults to now)
 * @returns Number of days difference
 */
export function getDaysDifference(date1: string, date2?: string): number {
  const d1 = new Date(date1);
  const d2 = date2 ? new Date(date2) : new Date();

  // Reset time to midnight for accurate day calculation
  const start = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const end = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate());

  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return diffDays;
}
