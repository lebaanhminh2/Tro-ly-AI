# Telegram iOS bottom strip investigation

Updated: 2026-11-17. Status: **The affected component is Telegram's native Mini App shell. The strip remains on the user's phone; no repair has been verified.** The glass paint path below is a strong regression candidate, not a confirmed trace of the installed binary.

## Confirmed reproduction

- User-reported iOS: **18.3.2**. Initial Telegram: **13.2.1**. The user subsequently updated Telegram after the 13.2.2 recommendation and confirmed the strip remains. The installed version after updating was not independently re-read.
- The rounded gray strip appears behind the white Home indicator immediately, before keyboard, input, or dialog interaction.
- After fully closing between trials, both the bot menu and an inline web_app button opening the same URL retain the strip.
- The user explicitly confirmed the strip on the independent white control page.
- The user then tested control **version 2**, pressing buttons 1 -> 2 -> 3. The strip remained after SDK/expand/ready, white native colors, and a fullscreen request.
- Actual native isFullscreen was not supplied. Do not describe that last result as independently verified fullscreen entry.
- The iOS status bar layout was explicitly excluded from the bug report.
- Last-known-good client version and timing relative to PWA changes remain unknown.

## Recording evidence

Recording: D:\desktop\downloads\44ad6b43-e14d-445d-8164-5496ffbc0a2f.mp4.
Duration: 18.80 seconds; 576 x 1246; 30 fps.

- About 2.5 seconds: the strip is already visible while Telegram's native four-square loading placeholder is displayed.
- About 4 seconds: the website skeleton appears; the strip remains.
- About 5.5 seconds: the schedule loads; the strip remains.
- In the iOS app switcher, the curve stays attached to Telegram's card as its displayed size changes.
- The recording shows the ordinary app. The white-page result comes from the user's subsequent report, not this recording.

Frames: output/telegram-frame/video-20261117/.
frame-06.png shows the native placeholder; frame-09.png the website skeleton; frame-12.png the loaded app; frame-15.png the app switcher. contact.png summarizes at 1 fps.

## Website checks and limits

- The bot menu URL matches deployed /app/.
- The actual application calls Telegram.WebApp.ready() after connection or error in web/core/lifecycle.js.
- The real SDK sends background #f4f3f8 and bottom-bar #ffffff with application light mode and Telegram dark mode.
- Chrome and Windows WebKit 27.2, real SDK, simulated native bridge: navigation fills a 390 x 844 viewport; bottom 844 px, radius zero, simulated safe-area padding 34 px. Bottom points belong to white navigation; toast is hidden and empty; dialog is closed; no JS errors.
- Dark layout also passes with navigation #22212d.
- These checks do not render Telegram's native shell and cannot establish removal on the phone.

Fixture-data screenshots: output/telegram-frame/webkit-light.png and webkit-dark.png.

## Verified native release change

Primary repository: <https://github.com/TelegramMessenger/Telegram-iOS>.
Local reference copies: output/telegram-frame/native-13.2/.

- Public release-13.1.2: 279f89e4d4f63f17227bf877dc3d8990f22ecd58.
- Public release-13.2: 24638bc69bd083981b178dd1e7f921eebbf7fc46.
- In 13.1.2, standaloneWebAppController in submodules/WebUI/Sources/WebAppController.swift does not specify style; AttachmentController defaults to .legacy.
- In 13.2 the helper explicitly passes style: .glass (line 4338). The constructor default remains .legacy.
- The change was introduced by [0f7c023af28029adab66a71c1020f064d9ac78af](https://github.com/TelegramMessenger/Telegram-iOS/commit/0f7c023af28029adab66a71c1020f064d9ac78af), dated 2026-10-23, titled "fix(ui): various design improvements".
- No public release-13.2.1 tag is available at checking time (GitHub ref lookup returns 404). The user's version matches the affected release family, but the exact App Store binary has not been compared against an exact patch-version source tag.

## Concrete glass paint-path candidate

In submodules/AttachmentUI/Sources/AttachmentPanel.swift:

1. Glass side inset is 22 pt, nominal height 62 pt, corner radius 31 pt.
2. Lines 2720-2723 collapse the empty single-tab row to accessory height, zero without an accessory. Mini Apps use one standalone tab.
3. Line 2736 still updates backgroundView without setting isVisible false for a zero-height panel. Darkness follows Telegram's theme.

In submodules/TelegramUI/Components/GlassBackgroundComponent/Sources/GlassBackgroundComponent.swift:

4. iOS below 26 uses the legacy implementation, relevant to the reported iOS 18.3.2.
5. Foreground and shadow images use the corner radius, with frames extending 32 pt outside the supplied bounds (lines 775, 855, 919, 922). A supplied height of zero still gives these image views a 64 pt frame.
6. Visibility defaults to true. Existing isVisible controls foreground and shadow alpha (lines 827, 862).

This provides a specific explanation for an empty rounded fragment surviving panel collapse. UIKit rasterization and the device's native view hierarchy have not been inspected, so the exact paint mechanism remains unconfirmed.

## Why website APIs do not hide this view

- web_app_set_bottom_bar_color updates bottomPanelColor and the ordinary backgroundNode via updateCustomBottomPanelBackgroundColor (AttachmentPanel.swift:2420), not the separate glass background.
- ready() removes the loading placeholder, not this background.
- Fullscreen changes controller state/layout; the compact iPhone path still includes the attachment panel.
- Native AttachmentMainButtonState.hidesPanelBackground defaults to false and is not exposed by the WebApp main/secondary button JSON parser. An invented parameter is not a supported workaround.
- Menu, inline, simple/reply-keyboard, and generic profile/direct routes inspected in ChatControllerOpenWebApp.swift reuse standaloneWebAppController.
- HTML/CSS cannot cover a native sibling view drawn over the WebView.

Candidate native repair: pass isVisible: panelSize.height > 0.0 when updating the glass background at AttachmentPanel.swift:2736. This would need a native iOS build and device validation, including transitions to visible tabs/accessories. It has not been applied, built, or submitted. Deploying Workers cannot install a native Telegram patch.

## Control page v2 and CSP correction

Sources: web/telegram-frame-check.html and web/telegram-frame-check.js.
URL: <https://personal-assistant-staging.telegram-assistant-ai-trial.workers.dev/app/telegram-frame-check>.
Use the extensionless URL; the .html form redirects outside /app/.

- The white baseline loads no SDK, app modules, data APIs, or fixed bottom element. External module JS displays diagnostics.
- Button 1 loads the official SDK, subscribes to native events, calls expand and ready.
- Button 2 sends white background and bottom-bar colors when supported.
- Button 3 requests fullscreen, reports failures, and permits exit when native state confirms entry.
- Details include SDK status, platform, Bot API version (not installed client version), viewport/safe areas, fullscreen, and user agent. No initData, identity, or credentials.

**V1 verification correction:** The original inline JS was blocked by the Worker's script-src 'self' https://telegram.org CSP. Earlier local checks did not reproduce that header. V1 was still an independent white-page comparison, but its intended native color/expand calls were not established on the live deployment. This mistake was acknowledged to the user. V2 uses an external module without weakening CSP.

V2 deployment: **64361dc0-c4fd-4057-a3ec-ae7d91ab189d**.
Exactly two assets changed (control HTML and JS); no main application source changed.

Verification before the user's physical v2 trial:

- Live assets HTTP 200, local/deployed SHA-256 equal.
- Live-URL Chrome with actual production CSP: baseline initializes without SDK; SDK loads after button 1; simulated bridge receives expand/ready/colors/fullscreen; zero CSP violations and zero app API calls.
- Local production-CSP test: fullscreen entry/exit and failure handling pass.
- Diagnostic JS lint, formatting, web syntax (55 modules), and staging checks pass.
- Browser bridge tests cannot verify native strip removal.

The user's subsequent physical result: strip remains after all three buttons.

## Temporary bot diagnostic button

Existing message 710, reminder at 21:02 local on 2026-11-16, has the control-page button. The markup edit was delivered at 21:30:52 local. The regular menu opens the app. V2 sent no new messages.

The original message had no markup; restore {"inline_keyboard":[]} when the control is no longer useful. Retain it for a potential client-update comparison.

## Client update result and remaining limitation

The [Vietnam App Store lookup](https://itunes.apple.com/lookup?id=686449807&country=vn) on 2026-11-17 reports **Telegram 13.2.2**, released 2026-11-16T08:10:38Z. Release notes are generic bug fixes. No evidence establishes a fix for this strip.

The user subsequently reported: they updated Telegram, opened it, and the strip is still present. This rules out treating the recommended update as a verified fix on this phone. They did not separately report a fresh control-page result after updating; retain that distinction. Do not ask them to repeat the same color/fullscreen/update checks.

Additional read-only review found no exposed glass visibility control in the [official Mini Apps API](https://core.telegram.org/bots/webapps), and confirmed that the inspected launch routes reuse the same glass controller. Searching the official iOS repository issues found other Mini App rendering reports, but no verified resolution for this specific zero-height glass fragment. An older generic WebView bottom-bar issue does not establish that it is the same regression.

No further main-app changes or deployments were made in response to the update result. The standalone PWA bypasses Telegram's shell but is a separate launch path, not a repaired Mini App. No supported website-side repair has been established, and native Telegram cannot be rebuilt or installed through this Workers project. The issue remains unresolved on the phone.

## Upstream report draft (not sent)

**Title:** iOS Mini Apps: rounded glass fragment remains at the bottom with no native action buttons

**Environment:** User-reported iOS 18.3.2; initially Telegram 13.2.1; still present after the available client update recommended as 13.2.2. Device model and exact post-update build are unrecorded.

**Reproduction:** Open a bot Mini App from its menu button. The reporter also reproduced through an inline web_app button, fully closing the Mini App between comparisons. The fragment is already visible during Telegram's native four-square loading placeholder. It persists on an independent white HTML page without application CSS, data calls, SDK initialization, or a fixed bottom element. Subsequently initializing the official SDK, sending ready/expand, changing background/bottom colors to white, and requesting fullscreen did not remove it on the reporter's phone.

**Expected:** No empty native glass fragment above the Home indicator when no native action buttons or media accessory are present.

**Actual:** A dark rounded fragment remains at the bottom, independent of website content.

**Suspected source path:** Public release-13.2 selects .glass in standaloneWebAppController. AttachmentPanel.update collapses the single-tab glass background to zero accessory height but calls GlassBackgroundView.update with default isVisible true. On pre-iOS-26 legacy rendering, foreground and shadow image frames extend 32 pt outside the zero-height bounds. The installed binary's view hierarchy has not been inspected; this is a source-based candidate.

**Candidate correction:** At AttachmentPanel.swift:2736, pass isVisible: panelSize.height > 0.0 to backgroundView.update. Validate on a native iOS build with an empty standalone Mini App, visible action buttons, accessory transitions, light/dark Telegram themes, compact/fullscreen layouts, and older iOS legacy glass. This candidate has not been built or device-tested and must not be called an implemented fix.

No issue, pull request, message, user recording, or application data has been published externally. The recording and diagnostic details remain local.
