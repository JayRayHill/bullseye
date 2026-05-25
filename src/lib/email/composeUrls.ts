// URL builders for the two send paths.
//
// Gmail compose:
//   https://mail.google.com/mail/?view=cm&fs=1&bcc=…&su=…&body=…
// We BCC the recipient list so leads cannot see each other.
//
// mailto: one lead per call. The rep's default mail client takes over.
//
// Recipient cap: Gmail empirically tolerates ~30 KB URLs; we batch BCC into
// chunks of 50 to stay safely under that even with long subjects/bodies.

export const GMAIL_BCC_LIMIT = 50;

export interface GmailComposeInput {
  bcc: string[];
  subject: string;
  body: string;
}

export interface GmailComposeBatch {
  url: string;
  recipients: string[];
}

/** Build one or more Gmail compose URLs. If recipients exceed GMAIL_BCC_LIMIT,
 *  the list is split across multiple batches; callers should open each one. */
export function buildGmailComposeUrls(input: GmailComposeInput): GmailComposeBatch[] {
  const chunks: string[][] = [];
  for (let i = 0; i < input.bcc.length; i += GMAIL_BCC_LIMIT) {
    chunks.push(input.bcc.slice(i, i + GMAIL_BCC_LIMIT));
  }
  if (chunks.length === 0) chunks.push([]);
  return chunks.map((recipients) => ({
    recipients,
    url:
      'https://mail.google.com/mail/?view=cm&fs=1' +
      `&bcc=${encodeURIComponent(recipients.join(','))}` +
      `&su=${encodeURIComponent(input.subject)}` +
      `&body=${encodeURIComponent(input.body)}`,
  }));
}

export interface MailtoInput {
  to: string;
  subject: string;
  body: string;
}

export function buildMailtoUrl(input: MailtoInput): string {
  return (
    `mailto:${encodeURIComponent(input.to)}` +
    `?subject=${encodeURIComponent(input.subject)}` +
    `&body=${encodeURIComponent(input.body)}`
  );
}
