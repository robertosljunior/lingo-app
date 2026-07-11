import { describe, it, expect } from 'vitest'
import { nextSrs, rankPracticeQuestions, BOX_INTERVALS, srsKey } from './srs.js'

const NOW = 1_700_000_000_000

describe('nextSrs', () => {
  it('starts a new question in box 1 when wrong', () => {
    const s = nextSrs(null, { correct: false, now: NOW })
    expect(s.box).toBe(1)
    expect(s.due_at).toBe(NOW + BOX_INTERVALS[1])
    expect(s.last_result).toBe('wrong')
  })

  it('promotes one box on a correct answer', () => {
    const s = nextSrs({ box: 2 }, { correct: true, now: NOW })
    expect(s.box).toBe(3)
    expect(s.due_at).toBe(NOW + BOX_INTERVALS[3])
  })

  it('promotes two boxes when self-rated easy', () => {
    const s = nextSrs({ box: 2 }, { correct: true, confidence: 'easy', now: NOW })
    expect(s.box).toBe(4)
  })

  it('caps at box 5', () => {
    expect(nextSrs({ box: 5 }, { correct: true, now: NOW }).box).toBe(5)
    expect(nextSrs({ box: 4 }, { correct: true, confidence: 'easy', now: NOW }).box).toBe(5)
  })

  it('demotes to box 1 on a wrong answer', () => {
    expect(nextSrs({ box: 4 }, { correct: false, now: NOW }).box).toBe(1)
  })
})

describe('rankPracticeQuestions', () => {
  const answer = (lesson, qid, verdict, mistake = null, at = NOW) => ({
    lesson_id: lesson, question_id: qid, verdict, mistake_type: mistake, answered_at: at,
  })

  it('only includes questions that were missed at least once', () => {
    const out = rankPracticeQuestions({
      answers: [answer('l1', 1, 'correct'), answer('l1', 2, 'incorrect', 'preposition')],
    })
    expect(out.map((q) => q.question_id)).toEqual([2])
  })

  it('ranks frequent misses and top mistake types first', () => {
    const answers = [
      answer('l1', 1, 'incorrect', 'article'),
      answer('l1', 2, 'incorrect', 'preposition'),
      answer('l1', 2, 'incorrect', 'preposition'),
    ]
    const out = rankPracticeQuestions({ answers, topMistakeTypes: ['preposition'] })
    expect(out[0].question_id).toBe(2)
  })

  it('respects the limit', () => {
    const answers = Array.from({ length: 20 }, (_, i) => answer('l1', i, 'incorrect', 'vocabulary'))
    expect(rankPracticeQuestions({ answers, limit: 5 })).toHaveLength(5)
  })
})

describe('srsKey', () => {
  it('is stable per profile/lesson/question', () => {
    expect(srsKey('p1', 'eng_001', 3)).toBe('p1:eng_001:3')
  })
})
