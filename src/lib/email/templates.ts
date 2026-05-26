// Three starter email templates baked into the app. Reps pick one in the
// campaign drawer; they can also edit subject/body in place before sending.
// Token syntax uses {{snake_case}}; resolution happens in mergeFields.ts.
//
// Voice notes (refined with the rep's dictated draft, May 2026):
//   - Acknowledge the lead's prior form-fill, but stay NEUTRAL about why
//     it stalled — "it never quite came together" / "wasn't sure if the
//     timing was right" — never "we dropped the ball." Could be either
//     side and over-apologizing reads as weak.
//   - Lead with concrete result, not vague enthusiasm: "the result came
//     out really clean" beats "they're loving their cups."
//   - Low-friction CTA: free CUP MOCKUP + a quote. No "10 minute call",
//     no "schedule a demo" — just a tangible artifact they can react to.
//   - Short. Each body is ~75 words.

import type { EmailTemplate } from '../../types';

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'another-swing',
    name: 'Take another swing',
    blurb: 'Direct re-engagement that names the prior form-fill without over-apologizing.',
    subject: '{{lead_business}} — want to take another swing at custom cups?',
    body:
      `{{lead_first_name}},

You filled out a form with us a while back and it never quite came together. {{nearby_customer}} in {{nearby_customer_city}} just got their custom cups from us and they're stoked with how it turned out — {{distance}} miles from your spot.

If it's still on your radar, I can put together a free cup mockup and a quote. Just say the word.

{{rep_signature}}`,
  },
  {
    id: 'worth-another-look',
    name: 'Worth another look',
    blurb: 'Softer opener — gives the lead the benefit of the doubt about why it stalled.',
    subject: 'Worth another look? {{nearby_customer}} just got their cups',
    body:
      `{{lead_first_name}},

You reached out about custom cups a while back — wasn't sure if the timing was right then. {{nearby_customer}} in {{nearby_customer_city}} just wrapped an order with us ({{distance}} miles from you) and the result came out really clean.

If you want to take another look, I'll send over a free cup mockup and a quote.

{{rep_signature}}`,
  },
  {
    id: 'neighbor-just-ordered',
    name: 'Neighbor just ordered',
    blurb: 'Leads with the proof point. Best when the social proof is the strongest lever.',
    subject: '{{nearby_customer}} just ordered custom cups — thought you should see',
    body:
      `{{lead_first_name}},

{{nearby_customer}} in {{nearby_customer_city}} just got their custom cups from us — {{distance}} miles from {{lead_business}}. Came out really clean.

We connected a while back but never got to put anything together. If you're still in the market, I'd love to send a free cup mockup your way and a quote.

Just reply if you want it.

{{rep_signature}}`,
  },
];

export function findTemplate(id: string): EmailTemplate {
  return EMAIL_TEMPLATES.find((t) => t.id === id) ?? EMAIL_TEMPLATES[0];
}
