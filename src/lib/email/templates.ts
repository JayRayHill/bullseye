// Three starter email templates baked into the app. Reps pick one in the
// campaign drawer; they can also edit subject/body in place before sending.
// Token syntax uses {{snake_case}}; resolution happens in mergeFields.ts.

import type { EmailTemplate } from '../../types';

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'warm-neighbor',
    name: 'Warm neighbor mention',
    blurb: 'Soft re-engagement that name-drops the closed customer.',
    subject: 'Quick note about {{nearby_customer}}',
    body:
      `Hey {{lead_first_name}},

Saw {{lead_business}} on my list and wanted to circle back. {{nearby_customer}} ({{distance}} miles away in {{nearby_customer_city}}) just got their cups dialed in with us — figured it might be worth another look on your end too.

Want to grab 10 minutes next week?

{{rep_signature}}`,
  },
  {
    id: 'direct-ask',
    name: 'Direct ask, no fluff',
    blurb: 'Short and clear. Best for reps who hate small talk.',
    subject: '{{nearby_customer}} is loving their cups — your turn?',
    body:
      `Hi {{lead_first_name}},

Quick one: {{nearby_customer}} in {{nearby_customer_city}} just wrapped a cup order with us and they're happy. You filled out a form a while back and I never properly closed the loop. Worth picking up where we left off?

Reply with a good time or just "no" and I'll stop bugging you.

{{rep_signature}}`,
  },
  {
    id: 'same-need',
    name: 'Same need, same solution',
    blurb: 'Leads with the proof point. Best when the use case is similar.',
    subject: 'How {{nearby_customer}} solved their cup problem',
    body:
      `{{lead_first_name}},

Wanted to send this your way since you're nearby to {{nearby_customer}}. They had a similar setup to {{lead_business}} and went with our cups — about {{distance}} miles from you.

Happy to send over what they ordered so you can see if it'd fit your spot. Free to grab a few minutes this week?

{{rep_signature}}`,
  },
];

export function findTemplate(id: string): EmailTemplate {
  return EMAIL_TEMPLATES.find((t) => t.id === id) ?? EMAIL_TEMPLATES[0];
}
