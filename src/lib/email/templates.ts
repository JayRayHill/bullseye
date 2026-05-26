// Three starter email templates baked into the app. Reps pick one in the
// campaign drawer; they can also edit subject/body in place before sending.
//
// Two interpolation syntaxes (see mergeFields.ts pipeline):
//   - {{merge_field}}  — replaced with data (lead/anchor/distance/rep).
//   - {a|b|c}          — spintax. Deterministically picks one option per
//                        lead identity so the preview is stable but the
//                        sent emails vary across recipients in a batch.
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
//   - Spintax used sparingly — just enough variation to defeat naive spam
//     filters that flag identical mass sends. Never on the core message.
//   - {{distance_phrase}} (e.g. "1 mile" / "12 miles") preferred over the
//     raw {{distance}} + " miles" pattern so we never read "1 miles".

import type { EmailTemplate } from '../../types';

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'another-swing',
    name: 'Take another swing',
    blurb: 'Direct re-engagement that names the prior form-fill without over-apologizing.',
    subject: '{{lead_business}} — {want to take another swing at custom cups?|still thinking about custom cups?|cups still on your radar?}',
    body:
      `{{lead_first_name}},

You {filled out a form|reached out} with us a while back and {it never quite came together|we never got to put anything together for you}. {{nearby_customer}} in {{nearby_customer_city}} just got their custom cups from us and they're {stoked with how it turned out|really happy with the results} — {{distance_phrase}} from your spot.

If it's still on your radar, I can put together a free cup mockup and a quote. {Just say the word|Just let me know}.

{{rep_signature}}`,
  },
  {
    id: 'worth-another-look',
    name: 'Worth another look',
    blurb: 'Softer opener — gives the lead the benefit of the doubt about why it stalled.',
    subject: '{Worth another look?|Quick update —} {{nearby_customer}} just got their cups',
    body:
      `{{lead_first_name}},

You reached out about custom cups a while back — {wasn't sure if the timing was right then|figured the timing might not have been right}. {{nearby_customer}} in {{nearby_customer_city}} just wrapped an order with us ({{distance_phrase}} from you) and {the result came out really clean|the cups turned out great}.

{If you want to take another look|If you're open to revisiting it}, I'll send over a free cup mockup and a quote.

{{rep_signature}}`,
  },
  {
    id: 'neighbor-just-ordered',
    name: 'Neighbor just ordered',
    blurb: 'Leads with the proof point. Best when the social proof is the strongest lever.',
    subject: '{{nearby_customer}} just {ordered custom cups|wrapped their cup order} — thought you should see',
    body:
      `{{lead_first_name}},

{{nearby_customer}} in {{nearby_customer_city}} just got their custom cups from us — {{distance_phrase}} from {{lead_business}}. {Came out really clean|Turned out great}.

We connected a while back but never got to put anything together. If you're still in the market, I'd love to send a free cup mockup your way and a quote.

{Just reply if you want it|Let me know if you want a look}.

{{rep_signature}}`,
  },
];

export function findTemplate(id: string): EmailTemplate {
  return EMAIL_TEMPLATES.find((t) => t.id === id) ?? EMAIL_TEMPLATES[0];
}
