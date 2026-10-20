# Splendor (bản chơi riêng với bạn bè, phi thương mại)

Chạy: bấm đúp `start.bat` (hoặc `node server.js`). Không cần cài thư viện nào, chỉ cần Node.js.

- Chơi cùng WiFi/LAN: bạn bè mở link `Cùng WiFi: http://IP:3000` in ra ở cửa sổ server.
- Chơi qua Internet: chạy thêm `cloudflared tunnel --url http://localhost:3000` (hoặc ngrok) rồi gửi link nhận được.
- Tạo phòng -> gửi mã 4 chữ hoặc link -> chủ phòng bấm "Bắt đầu ván".
- `node test.js`: cho bot chơi ngẫu nhiên 400 ván để kiểm tra luật.

Dữ liệu: 90 thẻ phát triển (40/30/20) và 10 quý tộc nằm trong public/data.js.

Ảnh thẻ: `public/art/c{id}.jpg` (thẻ) và `n{id}.jpg` (quý tộc), cắt từ các trang PnP trong `art-src/`:
- `python tools/build_art.py` — cắt lưới, khớp từng ô với id trong data.js theo bảng đọc tay ở `tools/cardmap.py`, xuất ảnh.
- `python tools/cardmap.py` — chỉ kiểm tra khớp (báo ô trùng / thẻ thiếu ảnh).
- Thiếu hoặc xoá ảnh nào thì game tự dùng lại tranh SVG cho thẻ đó.
