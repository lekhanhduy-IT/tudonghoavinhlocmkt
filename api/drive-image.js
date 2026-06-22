/**
 * Vercel image proxy/cache cho ảnh được lưu trong Google Shared Drive.
 * Sheet vẫn giữ URL Google Drive; post.html chỉ đổi sang endpoint này khi render.
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const rawId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  const fileId = String(rawId || '').trim();

  if (!/^[a-zA-Z0-9_-]{10,}$/.test(fileId)) {
    return res.status(400).json({ success: false, error: 'Invalid Google Drive file id' });
  }

  const candidates = [
    `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`,
    `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w4000`
  ];

  let upstream = null;
  let lastStatus = 502;

  for (const url of candidates) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 VinhLocMKT-DriveImageProxy/1.0',
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        }
      });

      const contentType = response.headers.get('content-type') || '';
      lastStatus = response.status;
      if (response.ok && contentType.toLowerCase().startsWith('image/')) {
        upstream = response;
        break;
      }
    } catch (error) {
      lastStatus = 502;
    }
  }

  if (!upstream) {
    return res.status(lastStatus >= 400 ? lastStatus : 502).json({
      success: false,
      error: 'Drive image is unavailable. Check link-sharing permission on the Shared Drive folder.'
    });
  }

  const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
  const etag = upstream.headers.get('etag');
  const lastModified = upstream.headers.get('last-modified');
  const bytes = Buffer.from(await upstream.arrayBuffer());

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', String(bytes.length));
  res.setHeader('Content-Disposition', `inline; filename="${fileId}"`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=86400, immutable');
  if (etag) res.setHeader('ETag', etag);
  if (lastModified) res.setHeader('Last-Modified', lastModified);

  if (req.method === 'HEAD') return res.status(200).end();
  return res.status(200).send(bytes);
};
