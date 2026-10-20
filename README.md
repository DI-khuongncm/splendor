# Splendor (bản chơi riêng với bạn bè, phi thương mại)

Chạy: bấm đúp `start.bat` (hoặc `node server.js`). Không cần cài thư viện nào, chỉ cần Node.js ≥ 18.

- Chơi cùng WiFi/LAN: bạn bè mở link `Cùng WiFi: http://IP:3000` in ra ở cửa sổ server.
- Chơi qua Internet: chạy thêm `cloudflared tunnel --url http://localhost:3000` (hoặc ngrok) rồi gửi link nhận được.
- Tạo phòng -> gửi mã 4 chữ hoặc link -> chủ phòng thêm máy (nếu muốn) và bấm "Bắt đầu ván".
- `node test.js`: cho bot chơi ngẫu nhiên 400 ván để kiểm tra luật. `node test-bot.js`: 3 kiểu máy chơi 200 ván với nhau.

## Tính năng
- 2–4 người, có thể thêm **máy** (3 phong cách: Thương gia / Quý tộc / Tham lam) để đủ người.
- **Nhạc nền + âm thanh** kiểu Phục Hưng (tự tổng hợp, không cần file), hoạt ảnh thẻ/đá bay, pháo giấy khi thắng. Nút 🎵 🔔 góc dưới phải.
- **Đồng hồ lượt** (chủ phòng chọn 45–180 giây; hết giờ máy đi thay), nút **⏰ Nhắc** người đang suy nghĩ lâu.
- **Chat + emoji**, **lịch sử nước đi**, **bảng thành tích nhóm**, **Ván mới** ngay cùng nhóm.
- **Tuỳ chỉnh (nút ⚙️)**: 5 kiểu bàn, 4 bộ bài, chọn ảnh gốc hoặc tranh vẽ, 4 bản nhạc + chỉnh âm lượng. Màn kết quả có bục điểm, biểu đồ theo vòng, danh hiệu, pháo hoa khi thắng.
- Thông báo đến lượt: nhấp nháy tiêu đề, rung điện thoại, 📣 bật thông báo trình duyệt khi ở tab khác.

## Deploy lên Render (miễn phí)
1. Render -> New -> Web Service -> chọn repo này. Build Command để trống, Start Command `node server.js`, gói Free.
2. **Chống ngủ**: Render free ngủ sau 15 phút không ai vào. Server tự gọi chính nó khi đang có phòng hoạt động; ngoài ra có thể tạo monitor miễn phí ở UptimeRobot trỏ tới `https://<app>.onrender.com/health` (mỗi 5 phút).
3. **Không mất ván khi server khởi động lại**: tạo database Redis miễn phí ở upstash.com, rồi trong Render -> Environment thêm 2 biến
   `UPSTASH_REDIS_REST_URL` và `UPSTASH_REDIS_REST_TOKEN` (lấy ở tab REST API của database). Không có 2 biến này thì lưu file `data/rooms.json` (chỉ hữu ích khi chạy ở máy mình, vì Render free xoá đĩa mỗi lần restart).

Dữ liệu: 90 thẻ phát triển (40/30/20) và 10 quý tộc nằm trong public/data.js.

Ảnh thẻ: `public/art/c{id}.jpg` (thẻ) và `n{id}.jpg` (quý tộc), cắt từ các trang PnP trong `art-src/`:
- `python tools/build_art.py` — cắt lưới, khớp từng ô với id trong data.js theo bảng đọc tay ở `tools/cardmap.py`, xuất ảnh.
- `python tools/cardmap.py` — chỉ kiểm tra khớp (báo ô trùng / thẻ thiếu ảnh).
- Thiếu hoặc xoá ảnh nào thì game tự dùng lại tranh SVG cho thẻ đó.
