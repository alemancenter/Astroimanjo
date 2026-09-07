export async function readBoundedBody(response: Response, maxBytes: number): Promise<Buffer> {
 const declared = Number(response.headers.get('content-length'));
 if (Number.isFinite(declared) && declared > maxBytes) { await response.body?.cancel(); throw new Error('Image too large'); }
 if (!response.body) throw new Error('Empty image');
 const reader = response.body.getReader();
 const chunks: Uint8Array[] = []; let size = 0;
 try {
  for (;;) {
   const {done, value} = await reader.read(); if (done) break;
   size += value.byteLength;
   if (size > maxBytes) { await reader.cancel(); throw new Error('Image too large'); }
   chunks.push(value);
  }
 } finally { reader.releaseLock(); }
 return Buffer.concat(chunks, size);
}
