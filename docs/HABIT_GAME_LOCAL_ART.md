# Tạo hình ảnh cục bộ cho Tu luyện

**Vòng hiện tại 2026-10-13:** bộ minh họa v2 đã thay toàn bộ art game theo [STYLE_V2](art/CULTIVATION_STYLE_V2.md). 61 raster và 39 SVG đã xuất bản, kiểm hash và xem trong app local; mọi QA/release 2026-10-12 bên dưới là lịch sử. Không sản xuất lại ba Thần binh đã bỏ. Trạng thái phát hành tại [CULTIVATION_PROGRESS](HABIT_GAME_CULTIVATION_PROGRESS.md) và RELEASE.

**Checkpoint nguồn và tích hợp:** 61 raster thành 122 WebP và 39 SVG; SHA nguồn/final, kích thước và dung lượng đã kiểm. Tổng WebP 2.663.754 byte; SVG 16.628 byte; không còn job GPU. Các lần loại/retry/crop ghi tại STYLE_V2 và manifest. Khi art-agent bàn giao,61QA UI pending; root đã kiểm matrix40đối thủ/15chương và40mànphái/cast sáng–tối, xem contact UI-final và cập nhật61approved-local. `cultivation-v2-audit.json` giữ cả trạng thái nguồn ban đầu và bằng chứng tích hợp sau đó. Hash staging được ghi riêng trong RELEASE.

Cập nhật 2026-10-12. User chọn AI tự thiết lập model ảnh local khi chạy `/goal`, ngân sách bổ sung **0đ**. Pipeline đã tạo/tích hợp finals cho40encounters,15cảnh chương,nămphái,baweapon và39symbols nguyên bản. Source QA/integration evidence tại inventory; visual/network/staging QA đạt trong [RELEASE](HABIT_GAME_RELEASE.md). [CREATIVE_BRIEF](HABIT_GAME_CREATIVE_BRIEF.md) sở hữu art direction/cast/inventory, [PROGRESS](HABIT_GAME_PROGRESS.md) lưu bằng chứng.

## 1. Phạm vi và cách vận hành

Ảnh cuối cho cast/boss/cảnh của đủ 15 chương, các tuyến phụ/năm phái/công pháp/thần binh. Generation chạy trên máy phát triển; app/Worker chỉ phục vụ finals tối ưu. App không cần máy cá nhân hoặc model chạy liên tục.

User cho tải model/cài môi trường art riêng khi bắt đầu goal; AI tự chọn backend miễn phí và workflow. Không API ảnh trả phí, top-up/subscription/nâng gói; không coi key Gemini có sẵn là nguồn ảnh miễn phí đã xác minh. Đây là workflow local do user chọn, không phải CLI OpenAI của skill imagegen và không cần OPENAI_API_KEY.

## 2. Preflight trước tải lớn

Đã xác minh: Windows/GTX 1650 4095 MiB, CUDA12.4, Python3.12.10, Torch2.6.0+cu124, diffusers0.35.2. Venv/models/drafts ở `D:\Tro-ly-AI-art`, ngoài Git. Hai trial float32 đạt hình hữu hạn ở 448×640/640×448, khoảng 100 giây/ảnh, peak4053MiB. Chưa chứng minh được độ phân giải lớn hơn hoặc identity variants.

- Xác minh Python dùng được, driver/GPU/VRAM/RAM và dung lượng trống cho model/cache/venv/art. Không báo CUDA chạy chỉ vì có NVIDIA.
- Chọn interpreter/dependencies tương thích trong môi trường riêng; không sửa Python hệ thống hoặc đưa ML packages vào runtime Workers/npm.
- Chọn nơi cache/models/venv/drafts ngoài Git và đủ disk; lưu paths/task-specific config. Không xóa/move thư mục khác để lấy chỗ.
- Thử một portrait + boss/cảnh, đo thời gian/VRAM/khả năng repeat/quality và export vào UI. Không bắt đầu hàng chục ảnh trước khi bản thử đạt.
- Chạy server local nếu cần với loopback, log có giới hạn và background ẩn trên Windows; không mở công cụ art ra internet. Có cách dừng/resume rõ.

Setup/download/inference thực hiện trong goal đang active. Script `scripts/art-local.py`, dependency pin `scripts/art-requirements.txt`, trial manifest `docs/art/trials.json`; metadata/finals tại `docs/art/assets.json` và `web/assets/than-lo`.

Workflow đang dùng `Lykon/dreamshaper-8`, revision `a7e52b98680b1ba8ff7bce97c7f9f2e2e5337917`, license `creativeml-openrail-m`. DPM++ Karras28steps, float32 với CPU offload/attention slicing/VAE slicing/tiling. Trial fp16 tạo NaN/ảnh đen và prompt cắt đã loại. Script kiểm CLIP token budget, finite latents/ảnh suy biến, hỗ trợ negative/style riêng cho chủ thể không phải người; không publish output lỗi. WebP/thumbnail/provenance cho40encounters/cảnh01–15/nămphái/baweapon ở `docs/art/assets.json`. Symbols SVG ở `technique-symbols.json` được tạo bởi `build-technique-art.ts`; text UI render riêng. Full campaign QA80previews/30chapters/30endings và lower-fold/light-dark/contact sheets đã xem; remote130WebP/39SVG SHA256 khớp source. `tram-nui` là ảnh dự phòng không tham gia runtime, không tuyên bố integratedQA của ảnh này.

## 3. Backend và model

AI chọn ComfyUI hoặc pipeline diffusion tương đương có workflow lưu/tái tạo được; ưu tiên model nhẹ họ SD 1.5 hoặc tương đương đã đo trên 4 GB, chế độ low VRAM/offload/tiled nếu cần. Không mặc định model mới/nặng nhất tốt nhất cho máy này.

- Tải từ nguồn có thông tin model/version/license rõ; ghi nguồn/hash và quyền dùng outputs, không commit model weights. Kiểm entry script/dependency và pin phiên bản hợp lý trước chạy; không dùng remote-code execution chỉ vì model yêu cầu.
- Bắt đầu độ phân giải vừa phải, kiểm ảnh gốc rồi upscale/crop/optimize. Có thể dùng nhiều bước/khâu chỉnh thủ công bằng công cụ local để giữ chất lượng.
- Dùng reference/conditioning nhất quán cho cùng nhân vật nếu backend hỗ trợ; kiểm identity bằng mắt, seed không đủ để bảo đảm giống mặt.
- Đầu backend không chạy hoặc style không đạt: sửa cấu hình, thử model/workflow miễn phí phù hợp có lý do; lưu findings và next attempt, không đổi trả phí.
- Nếu cần token tải model miễn phí, ưu tiên nguồn không token hoặc hỏi đúng cấu hình; token không trong prompt/log/Git. License/model không đáp ứng thì chọn nguồn khác.

Tên model và parameters là lựa chọn của agent sau preflight, không giả được hỗ trợ qua biến env chưa có code. GPU yếu có thể làm batch chậm; chia việc/tiếp tục checkpoint, không tự hạ yêu cầu ảnh thật hoặc thổi phồng khả năng máy.

## 4. Workflow và manifest

Trước batch đầu, AI chọn format manifest/workflow phù hợp repo và tooling thật. Mỗi asset tối thiểu có:

| Nhóm | Fields cần lưu |
| --- | --- |
| Nội dung | Stable asset/content/character ID, mục đích/màn/chương, variant và identity reference |
| Tái tạo | Model/backend/version/hash/source/license, prompt/negative nếu dùng, seed/steps/settings, workflow reference |
| Source/đầu ra | Reference được phép dùng, source path ngoài bundle, final path/hash/format/dimensions, derivatives |
| Trình bày | Ratio, focal/crop safe area, dark/light use, alt/decorative, nơi tích hợp |
| QA | Người/agent đã xem, findings/fixes, approved final, screenshot/màn/viewport và ngày |

Model/cache/venv/drafts/large intermediates nằm ngoài Git/Worker; finals, manifest, style/character guides và script/config cần tái tạo được đưa vào repo. Không lưu key/provider response riêng tư trong manifest. Quản lý paths bằng task variables riêng, không repurpose HOME/CODEX_HOME.

## 5. Sản xuất toàn nội dung

1. Thiết kế cast/style bible, map assets theo đủ 15 chương/năm phái/39 môn/tuyến phụ; đánh dấu cần raster hay biểu tượng đơn giản.
2. Tạo references đạt chất lượng, tích hợp thử và chọn hướng cuối trước bulk.
3. Batch theo encounter/chapter/phái: giữ khuôn mặt/silhouette/vật dụng, thay đổi có lý do truyện; review bằng contact sheet và ảnh phóng to.
4. Tạo lại/chỉnh các lỗi cụ thể (tay, mắt, vật dụng, dark image, crop), không random vô hạn không tiêu chí.
5. Export finals/thumbnail phù hợp màn; không cần đưa mọi source full-resolution vào Static Assets. Text UI luôn render riêng.
6. Tích hợp, test URL/dimensions/lazy loading/network và visual QA dark/light/mobile. Asset inventory đủ final trước release.

Hướng budget ban đầu để đo và điều chỉnh: thumbnail khoảng 48–96 px, portrait/card khoảng 512–768 px cạnh dài, cảnh hero khoảng 1024 px hoặc derivatives phù hợp; WebP/AVIF khi runtime/browser tương thích, fallback hợp lý. Đích dung lượng ban đầu thumbnail≤50 KB, card≤200 KB, hero≤350 KB; AI có thể sửa khi chất lượng/đo mạng chứng minh cần. Không gửi bản nhiều MB chỉ vì output model lớn.

SVG/CSS/canvas phù hợp icon/effects/charts/code-native visuals. Portrait/boss/cảnh bắt buộc phải là raster được tạo thật, không đổi sang silhouette tạm để che pipeline lỗi. Chương không dùng một poster placeholder chung.

## 6. Config, khả năng tiếp tục và hoàn thành

- Script/config/example bám workflow thực sự chạy; chỉ thêm biến `.env.example` khi code đọc, có hướng dẫn local/runtime/default/required rõ. Giữ `.env` và không in values.
- Mỗi batch lưu checkpoint: outputs thành công/thất bại, selected finals, seed/workflow, tiến độ inventory và tác vụ đang chạy. Dừng/resume không tạo lại cả bộ đã đạt.
- Art hoàn thành khi pipeline đã tạo ảnh thật, finals đủ inventory và nhất quán, integrate/QA mobile được xem, staging URLs đúng và manifest/workflow có thể tiếp tục chỉnh.
- Nếu môi trường thiếu hoặc không đạt sau các điều chỉnh hợp lý, nêu chặn cụ thể và phương án 0đ; tiếp tục phần độc lập. Không goal complete khi art bắt buộc còn thiếu.
