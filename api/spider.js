import { kv } from '@vercel/kv';

export default async function handler(request, response) {
  // ĐÃ TẠM BẬT Ổ KHÓA BẢO MẬT ĐỂ MÁ TEST BẰNG TAY TRÊN TRÌNH DUYỆT
   const authHeader = request.headers.authorization;
   if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
     return response.status(401).json({ success: false, error: 'Unauthorized' });
   }

  // Link Google Apps Script Cũ Của Bạn
  const GAS_URL = "https://script.google.com/macros/s/AKfycbytCrAHTpFnykzOAwTkxbAR6tm32P9RZrS42EnUFh2WTWTQRtZr60Q27Lzrbhq_cuo/exec";

  try {
    // 1. Nhện bò đi lấy dữ liệu từ Google
    const res = await fetch(GAS_URL + "?t=" + new Date().getTime());
    const data = await res.json();

    if (data.success) {
      // 2. Bơm dữ liệu vào Não Nhện (Vercel KV)
      await kv.set('MKT_BRAIN_DATA', data.data);
      await kv.set('MKT_BRAIN_TIMESTAMP', new Date().toISOString());

      return response.status(200).json({ success: true, message: '🕷️ Nhện đã cào và lưu não thành công!' });
    } else {
      return response.status(500).json({ success: false, error: 'Lỗi từ Google Apps Script' });
    }
  } catch (error) {
    return response.status(500).json({ success: false, error: error.message });
  }
}