export interface EmailAttachment {
  id: string;
  name: string;
  size: string;
  type?: string;
  dataUrl?: string;
}

export function getValidMinimalPdfDataUrl(title: string, details: string): string {
  const cleanTitle = (title || 'Document').replace(/[()\\]/g, '');
  const cleanDetails = (details || '').replace(/[()\\]/g, '');
  const content = `BT
/F1 18 Tf
50 720 Td
(${cleanTitle}) Tj
/F1 12 Tf
0 -30 Td
(${cleanDetails}) Tj
0 -20 Td
(Verified Delivery via ReachInbox Outbox Engine) Tj
ET`;
  const streamLength = content.length;
  const pdfStr = `%PDF-1.4
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources <</Font <</F1 5 0 R>>>> >> endobj
4 0 obj <</Length ${streamLength}>> stream
${content}
endstream
endobj
5 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000236 00000 n 
0000000450 00000 n 
trailer <</Size 6 /Root 1 0 R>>
startxref
530
%%EOF`;
  return `data:application/pdf;base64,${btoa(unescape(encodeURIComponent(pdfStr)))}`;
}

export function getValidFallbackSvgDataUrl(title: string): string {
  const cleanTitle = (title || 'Image').replace(/[<>&"]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
    <rect width="600" height="400" fill="#f8fafc" rx="16"/>
    <rect x="20" y="20" width="560" height="360" fill="none" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="6,6" rx="12"/>
    <circle cx="300" cy="150" r="44" fill="#dbeafe"/>
    <path d="M280 170l15-20 12 15 18-24 25 33H270z" fill="#0284c7"/>
    <circle cx="288" cy="134" r="7" fill="#38bdf8"/>
    <text x="300" y="235" font-family="system-ui, sans-serif" font-size="18" font-weight="bold" fill="#0f172a" text-anchor="middle">${cleanTitle}</text>
    <text x="300" y="265" font-family="system-ui, sans-serif" font-size="13" fill="#64748b" text-anchor="middle">Attached Image • ReachInbox Preview</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
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
          let dataUrl = '';

          if (ext === 'pdf') {
            mime = 'application/pdf';
            dataUrl = getValidMinimalPdfDataUrl(name, `Size: ${size}`);
          } else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
            mime = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
            dataUrl = getValidFallbackSvgDataUrl(name);
          } else {
            if (ext === 'csv') mime = 'text/csv';
            else if (ext === 'txt') mime = 'text/plain';
            const sampleContent = `Attachment: ${name}\nSize: ${size}\nStatus: Delivered via ReachInbox Transactional Outbox\nTimestamp: ${new Date().toISOString()}`;
            dataUrl = `data:${mime};charset=utf-8,${encodeURIComponent(sampleContent)}`;
          }

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
