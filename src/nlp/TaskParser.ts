/**
 * Natural Language Processing for Task Creation
 * ==============================================
 * Parses natural language input into structured tasks
 */

import type { ParsedTask, Priority, RecurrencePattern as RecurrencePatternType, NLPEntity } from '../types';

// ============================================
// DATE/TIME PATTERNS
// ============================================

interface DatePattern {
  regex: RegExp;
  parser: (...args: string[]) => Date | null;
}

interface TimePattern {
  regex: RegExp;
  parser: (...args: string[]) => Date | null;
}

interface PriorityPattern {
  regex: RegExp;
  priority?: Priority;
  parser?: (...args: string[]) => Priority;
}

interface RecurrencePatternMatch {
  regex: RegExp;
  recurrence: RecurrencePatternType;
}

interface DurationPattern {
  regex: RegExp;
  parser: (...args: string[]) => number;
}

const DATE_PATTERNS: DatePattern[] = [
  { regex: /\b(today|tonight)\b/i, parser: () => getToday() },
  { regex: /\b(tomorrow|tmrw)\b/i, parser: () => getTomorrow() },
  { regex: /\b(yesterday)\b/i, parser: () => getYesterday() },
  { regex: /\b(monday|mon)\b/i, parser: () => getWeekday(1) },
  { regex: /\b(tuesday|tue)\b/i, parser: () => getWeekday(2) },
  { regex: /\b(wednesday|wed)\b/i, parser: () => getWeekday(3) },
  { regex: /\b(thursday|thu)\b/i, parser: () => getWeekday(4) },
  { regex: /\b(friday|fri)\b/i, parser: () => getWeekday(5) },
  { regex: /\b(saturday|sat)\b/i, parser: () => getWeekday(6) },
  { regex: /\b(sunday|sun)\b/i, parser: () => getWeekday(0) },
  { regex: /\bin\s+(\d+)\s+(day|days)\b/i, parser: (days: string) => addDays(parseInt(days)) },
  { regex: /\bin\s+(\d+)\s+(week|weeks)\b/i, parser: (weeks: string) => addDays(parseInt(weeks) * 7) },
  { regex: /\bin\s+(\d+)\s+(month|months)\b/i, parser: (months: string) => addMonths(parseInt(months)) },
  { regex: /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/, parser: parseMDYDate },
  { regex: /(\d{4})-(\d{1,2})-(\d{1,2})/, parser: parseISODate },
];

const TIME_PATTERNS: TimePattern[] = [
  { regex: /(\d{1,2}):(\d{2})\s*(am|pm)/i, parser: parse12HourTime },
  { regex: /(\d{1,2})\s*(am|pm)/i, parser: parse12HourTimeNoMinutes },
  { regex: /(\d{1,2}):(\d{2})/, parser: parse24HourTime },
  { regex: /\bin\s+(\d+)\s+(hour|hours)\b/i, parser: (hours: string) => addHours(parseInt(hours)) },
  { regex: /\bin\s+(\d+)\s+(minute|minutes)\b/i, parser: (minutes: string) => addMinutes(parseInt(minutes)) },
];

const PRIORITY_PATTERNS: PriorityPattern[] = [
  { regex: /\b(urgent|critical|emergency)\b/i, priority: 'critical' },
  { regex: /\b(high|important|priority)\b/i, priority: 'high' },
  { regex: /\b(medium|normal|regular)\b/i, priority: 'medium' },
  { regex: /\b(low|optional|whenever)\b/i, priority: 'low' },
  { regex: /\[(!{1,4})\]/, parser: (exclaims: string) => exclaimsToPriority(exclaims) },
];

const RECURRENCE_PATTERNS: RecurrencePatternMatch[] = [
  { regex: /\b(every|daily|each day)\b/i, recurrence: 'daily' },
  { regex: /\b(weekly|each week|every week)\b/i, recurrence: 'weekly' },
  { regex: /\b(monthly|each month|every month)\b/i, recurrence: 'monthly' },
  { regex: /\b(yearly|annually|each year|every year)\b/i, recurrence: 'yearly' },
  { regex: /\b(every\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i, recurrence: 'weekly' },
];

const DURATION_PATTERNS: DurationPattern[] = [
  { regex: /\b(\d+)\s*(hour|hours|hr|hrs)\b/i, parser: (hours: string) => parseInt(hours) * 60 },
  { regex: /\b(\d+)\s*(minute|minutes|min|mins)\b/i, parser: (minutes: string) => parseInt(minutes) },
  { regex: /(\d+)h(\d*)m?/i, parser: (hours: string, minutes: string) => parseInt(hours) * 60 + (minutes ? parseInt(minutes) : 0) },
];

const TAG_PATTERN = /#(\w+)/g;
const CATEGORY_PATTERN = /\[([^\]]+)\]/g;

// ============================================
// MAIN PARSING FUNCTION
// ============================================

export function parseNaturalLanguage(input: string): ParsedTask {
  const entities: NLPEntity[] = [];
  const intents: string[] = [];

  let text = input.trim();
  let dueDate: Date | undefined;
  let priority: Priority | undefined;
  let recurrence: RecurrencePatternType | undefined;
  let estimatedMinutes: number | undefined;
  const categories: string[] = [];
  const tags: string[] = [];

  // Extract tags (#hashtag)
  text = extractPattern(text, TAG_PATTERN, (match, tag) => {
    tags.push(tag.toLowerCase());
    entities.push(createEntity('category', tag, match));
    return '';
  });

  // Extract categories [category]
  text = extractPattern(text, CATEGORY_PATTERN, (match, category) => {
    const cat = category.trim().toLowerCase();
    // Don't add if it looks like a priority marker
    if (!/^[!]+$/.test(cat)) {
      categories.push(cat);
      entities.push(createEntity('category', category, match));
    }
    return '';
  });

  // Parse dates
  const dateResult = parseDate(text);
  if (dateResult) {
    dueDate = dateResult.date;
    entities.push(dateResult.entity);
    intents.push('set_due_date');
  }

  // Parse times
  const timeResult = parseTime(text);
  if (timeResult && dueDate) {
    dueDate = mergeDateAndTime(dueDate, timeResult.time);
    entities.push(timeResult.entity);
  } else if (timeResult) {
    dueDate = timeResult.time;
    entities.push(timeResult.entity);
    intents.push('set_due_date');
  }

  // Parse priority
  const priorityResult = parsePriority(text);
  if (priorityResult) {
    priority = priorityResult.priority;
    entities.push(priorityResult.entity);
    intents.push('set_priority');
  }

  // Parse recurrence
  const recurrenceResult = parseRecurrence(text);
  if (recurrenceResult) {
    recurrence = recurrenceResult.recurrence;
    entities.push(recurrenceResult.entity);
    intents.push('set_recurrence');
  }

  // Parse duration/estimate
  const durationResult = parseDuration(text);
  if (durationResult) {
    estimatedMinutes = durationResult.minutes;
    entities.push(durationResult.entity);
    intents.push('set_estimate');
  }

  // Clean up remaining text
  text = text.replace(/\s+/g, ' ').trim();

  // Calculate confidence based on how much was parsed
  const confidence = calculateConfidence(input, text, entities.length);

  return {
    text,
    dueDate,
    priority,
    categories,
    tags,
    estimatedMinutes,
    recurrence,
    confidence,
    rawInput: input
  };
}

// ============================================
// PARSING HELPERS
// ============================================

function parseDate(text: string): { date: Date; entity: NLPEntity } | null {
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern.regex);
    if (match) {
      const args = match.slice(1).filter(Boolean);
      const date = pattern.parser(...args);
      if (date) {
        return {
          date,
          entity: createEntity('date', match[0], match[0])
        };
      }
    }
  }
  return null;
}

function parseTime(text: string): { time: Date; entity: NLPEntity } | null {
  for (const pattern of TIME_PATTERNS) {
    const match = text.match(pattern.regex);
    if (match) {
      const args = match.slice(1).filter(Boolean);
      const time = pattern.parser(...args);
      if (time) {
        return {
          time,
          entity: createEntity('time', match[0], match[0])
        };
      }
    }
  }
  return null;
}

function parsePriority(text: string): { priority: Priority; entity: NLPEntity } | null {
  for (const pattern of PRIORITY_PATTERNS) {
    const match = text.match(pattern.regex);
    if (match) {
      let priority: Priority;
      if (pattern.priority) {
        priority = pattern.priority;
      } else if (pattern.parser) {
        const args = match.slice(1).filter(Boolean);
        priority = pattern.parser(...args);
      } else {
        continue;
      }
      return {
        priority,
        entity: createEntity('priority', priority, match[0])
      };
    }
  }
  return null;
}

function parseRecurrence(text: string): { recurrence: RecurrencePatternType; entity: NLPEntity } | null {
  for (const pattern of RECURRENCE_PATTERNS) {
    const match = text.match(pattern.regex);
    if (match) {
      return {
        recurrence: pattern.recurrence,
        entity: createEntity('recurrence', pattern.recurrence, match[0])
      };
    }
  }
  return null;
}

function parseDuration(text: string): { minutes: number; entity: NLPEntity } | null {
  for (const pattern of DURATION_PATTERNS) {
    const match = text.match(pattern.regex);
    if (match) {
      const args = match.slice(1).filter(Boolean);
      const minutes = pattern.parser(...args);
      return {
        minutes,
        entity: createEntity('duration', `${minutes} minutes`, match[0])
      };
    }
  }
  return null;
}

// ============================================
// DATE/TIME UTILITIES
// ============================================

function getToday(): Date {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
}

function getTomorrow(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(23, 59, 59, 999);
  return date;
}

function getYesterday(): Date {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  date.setHours(23, 59, 59, 999);
  return date;
}

function getWeekday(dayOfWeek: number): Date {
  const date = new Date();
  const currentDay = date.getDay();
  const daysUntil = (dayOfWeek + 7 - currentDay) % 7 || 7;
  date.setDate(date.getDate() + daysUntil);
  date.setHours(23, 59, 59, 999);
  return date;
}

function addDays(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(23, 59, 59, 999);
  return date;
}

function addMonths(months: number): Date {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  date.setHours(23, 59, 59, 999);
  return date;
}

function addHours(hours: number): Date {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date;
}

function addMinutes(minutes: number): Date {
  const date = new Date();
  date.setMinutes(date.getMinutes() + minutes);
  return date;
}

function parseMDYDate(month: string, day: string, year?: string): Date {
  const date = new Date();
  const m = parseInt(month) - 1;
  const d = parseInt(day);
  const y = year ? (year.length === 2 ? 2000 + parseInt(year) : parseInt(year)) : date.getFullYear();
  
  date.setFullYear(y, m, d);
  date.setHours(23, 59, 59, 999);
  return date;
}

function parseISODate(year: string, month: string, day: string): Date {
  const date = new Date();
  date.setFullYear(parseInt(year), parseInt(month) - 1, parseInt(day));
  date.setHours(23, 59, 59, 999);
  return date;
}

function parse12HourTime(hours: string, minutes: string, ampm: string): Date {
  const date = new Date();
  let h = parseInt(hours);
  const m = parseInt(minutes);
  
  if (ampm.toLowerCase() === 'pm' && h !== 12) h += 12;
  if (ampm.toLowerCase() === 'am' && h === 12) h = 0;
  
  date.setHours(h, m, 0, 0);
  return date;
}

function parse12HourTimeNoMinutes(hours: string, ampm: string): Date {
  return parse12HourTime(hours, '0', ampm);
}

function parse24HourTime(hours: string, minutes: string): Date {
  const date = new Date();
  date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  return date;
}

function mergeDateAndTime(date: Date, time: Date): Date {
  const merged = new Date(date);
  merged.setHours(time.getHours(), time.getMinutes(), time.getSeconds());
  return merged;
}

function exclaimsToPriority(exclaims: string): Priority {
  const count = exclaims.length;
  if (count >= 4) return 'critical';
  if (count === 3) return 'high';
  if (count === 2) return 'medium';
  return 'low';
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function extractPattern(
  text: string,
  regex: RegExp,
  extractor: (match: string, ...groups: string[]) => string
): string {
  return text.replace(regex, (match, ...args) => {
    const groups = args.slice(0, -2);
    const replacement = extractor(match, ...groups);
    return replacement ? replacement : '';
  });
}

function createEntity(type: NLPEntity['type'], value: string, raw: string): NLPEntity {
  return {
    type,
    value,
    startIndex: 0,
    endIndex: raw.length,
    confidence: 0.9
  };
}

function calculateConfidence(original: string, remaining: string, entityCount: number): number {
  const originalLength = original.length;
  const remainingLength = remaining.length;
  const extractedRatio = (originalLength - remainingLength) / originalLength;
  
  let confidence = extractedRatio * 0.5;
  confidence += Math.min(entityCount * 0.1, 0.3);
  
  if (remainingLength > 3) {
    confidence += 0.2;
  }
  
  return Math.min(Math.round(confidence * 100) / 100, 1);
}

// ============================================
// EXPORTS
// ============================================

export {
  parseNaturalLanguage as parseTaskInput,
  DATE_PATTERNS,
  TIME_PATTERNS,
  PRIORITY_PATTERNS,
  RECURRENCE_PATTERNS,
  DURATION_PATTERNS
};
