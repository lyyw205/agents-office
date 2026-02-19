import { z } from 'zod';

export const jsonString = z.string().refine(
  (val) => {
    try { JSON.parse(val); return true; } catch { return false; }
  },
  { message: 'Must be valid JSON string' }
);

export const optionalJsonString = jsonString.optional();
