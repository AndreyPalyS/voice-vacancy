export interface AnswerInput { questionId: number; rawText: string; timestamp?: number }
export const QUESTIONS: string[]
export function assessAnswer(id: number, text: string): { score: number; sufficient: boolean; hint: string }
export function validateAnswers(value: unknown): AnswerInput[]
export function generateLocalVacancy(answers: AnswerInput[]): string
