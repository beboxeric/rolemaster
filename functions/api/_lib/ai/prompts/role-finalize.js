// Surface D — produces customer-voice content + sales materials per role.

export const ROLE_FINALIZE_SYSTEM_PROMPT = `You are RoleMaster's curation AI. The supplier has finalized one role (RP-NN). Generate sales-ready content for it.

You'll receive the role's name, capabilities, questionnaire answers, and the supplier's shared service + pricing answers.

## Output

Strict JSON only. No markdown fences.

{
  "generated": {
    "customer_voice_pain":  { "zh": "...", "en": "..." },
    "value_positioning":    { "zh": "...", "en": "..." },
    "capability_summary":   { "zh": "...", "en": "..." },
    "one_liner":            { "zh": "...", "en": "..." }
  },
  "materials": {
    "pitch_outline": [
      { "title": {"zh","en"}, "bullets": {"zh":[...], "en":[...]} }
    ],
    "faq": [
      { "q": {"zh","en"}, "a": {"zh","en"} }
    ],
    "elevator_pitch_zh": "...",
    "elevator_pitch_en": "...",
    "discovery_questions": [
      { "zh": "...", "en": "..." }
    ]
  }
}

## Rules

- customer_voice_pain: 2-3 sentences in the role's persona voice. Vent-style. Reference concrete tools/numbers.
- value_positioning: 1-2 sentences. What product delivers, who for, why.
- capability_summary: 5-8 bullet points (newline-separated), what the product does for this role.
- one_liner: ≤140 chars elevator pitch.
- pitch_outline: 5-7 slides total.
- faq: 8-12 Q&A pairs.
- elevator_pitch: ≤80 words each side.
- discovery_questions: 5-8 questions sales reps can ask prospects.
- Cost price NEVER appears anywhere. Only use suggested_retail / pricing model.
- Don't use "RolePack" / 执岗包 / 策展人 in customer-facing copy. Use product/solution/system.`;

export const ROLE_FINALIZE_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    generated: {
      type: 'object',
      properties: {
        customer_voice_pain: bilingualString(),
        value_positioning: bilingualString(),
        capability_summary: bilingualString(),
        one_liner: bilingualString(),
      },
      required: ['customer_voice_pain', 'value_positioning', 'capability_summary', 'one_liner'],
      additionalProperties: false,
    },
    materials: {
      type: 'object',
      properties: {
        pitch_outline: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: bilingualString(),
              bullets: {
                type: 'object',
                properties: {
                  zh: { type: 'array', items: { type: 'string' } },
                  en: { type: 'array', items: { type: 'string' } },
                },
                required: ['zh', 'en'], additionalProperties: false,
              },
            },
            required: ['title', 'bullets'], additionalProperties: false,
          },
        },
        faq: {
          type: 'array',
          items: {
            type: 'object',
            properties: { q: bilingualString(), a: bilingualString() },
            required: ['q', 'a'], additionalProperties: false,
          },
        },
        elevator_pitch_zh: { type: 'string' },
        elevator_pitch_en: { type: 'string' },
        discovery_questions: { type: 'array', items: bilingualString() },
      },
      required: ['pitch_outline', 'faq', 'elevator_pitch_zh', 'elevator_pitch_en', 'discovery_questions'],
      additionalProperties: false,
    },
  },
  required: ['generated', 'materials'],
  additionalProperties: false,
};

function bilingualString() {
  return {
    type: 'object',
    properties: { zh: { type: 'string' }, en: { type: 'string' } },
    required: ['zh', 'en'],
    additionalProperties: false,
  };
}
