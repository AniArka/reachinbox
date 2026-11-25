export interface EmailAttachment {
  id: string;
  name: string;
  size: string;
  type?: string;
  dataUrl?: string;
}

export function parseEmailBodyAndAttachments(rawBody: string): {
  cleanBody: string;
  attachments: EmailAttachment[];
} {
  if (!rawBody) return { cleanBody: '', attachments: [] };

  let bodyText = rawBody;
  const attachments: EmailAttachment[] = [];

  // 1. Check for structured REACHINBOX_ATTACHMENTS delimiter
  if (bodyText.includes('---REACHINBOX_ATTACHMENTS---')) {
    const parts = bodyText.split('---REACHINBOX_ATTACHMENTS---');
    bodyText = parts[0];
    try {
      const parsed = JSON.parse(parts[1].trim());
      if (Array.isArray(parsed)) {
        attachments.push(...parsed);
      }
    } catch (e) {
      console.warn('Failed to parse attachment payload', e);
    }
  }

  // 2. Parse legacy [Attached Files]: block
  if (bodyText.includes('[Attached Files]:')) {
    const bodyParts = bodyText.split(/\[Attached Files\]:\s*/);
    bodyText = bodyParts[0].trim();
    if (attachments.length === 0 && bodyParts[1]) {
      const lines = bodyParts[1].split('\n');
      lines.forEach((line, idx) => {
        const match = line.match(/📎\s*(.+?)\s*\((.+?)\)/);
        if (match) {
          const name = match[1].trim();
          const size = match[2].trim();
          const ext = name.split('.').pop()?.toLowerCase() || '';
          let mime = 'application/octet-stream';
          if (ext === 'pdf') mime = 'application/pdf';
          else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) mime = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
          else if (ext === 'csv') mime = 'text/csv';
          else if (ext === 'txt') mime = 'text/plain';

          const sampleContent = `Attachment: ${name}\nSize: ${size}\nStatus: Delivered via ReachInbox Transactional Outbox\nTimestamp: ${new Date().toISOString()}`;
          const dataUrl = `data:${mime};charset=utf-8,${encodeURIComponent(sampleContent)}`;

          attachments.push({
            id: `legacy-${idx}-${Date.now()}`,
            name,
            size,
            type: mime,
            dataUrl,
          });
        }
      });
    }
  }

  return {
    cleanBody: bodyText.trim(),
    attachments,
  };
}

export function cleanEmailSnippet(rawBody: string): string {
  if (!rawBody) return '';
  return rawBody
    .split('---REACHINBOX_ATTACHMENTS---')[0]
    .split('[Attached Files]:')[0]
    .replace(/<[^>]*>?/gm, '')
    .trim();
}
