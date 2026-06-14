import { kv } from '@vercel/kv';

export default async function handler(request, response) {
  // Bật Cache trình duyệt thêm 1 lớp (Cache 1 phút) để giảm tải hoàn toàn
  response.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
  
  try {
    // Rút thẳng dữ liệu từ Não Nhện
    const brainData = await kv.get('MKT_BRAIN_DATA');
    
    if (brainData) {
      return response.status(200).json({ success: true, data: brainData, source: 'spider-brain' });
    } else {
      // Nếu não trống (nhện chưa kịp cào), báo lỗi để frontend tự động gọi lại Google
      return response.status(404).json({ success: false, error: 'Não nhện đang trống' });
    }
  } catch (error) {
    return response.status(500).json({ success: false, error: error.message });
  }
}