# Native overflow scrolling cleanup

The universal `-webkit-overflow-scrolling: touch` declaration has been removed.
WebKit documents accelerated overflow scrolling as automatic from iOS 13 and
recommends removing unnecessary scrolling workarounds. The legacy declaration
also had a stacking-context side effect on iPhone scrollable elements.

Source: [WebKit — New WebKit Features in Safari 13](https://webkit.org/blog/9674/new-webkit-features-in-safari-13/),
“Accelerated Scrolling on iOS and iPadOS” (December 20, 2019).

The existing stylesheet already uses Tailwind CSS 4.3.3, `@theme` and `oklch()`.
[Tailwind's browser guidance](https://tailwindcss.com/docs/upgrade-guide#browser-requirements)
targets Safari 16.4 and newer. This is the existing CSS framework's supported
range, rather than a newly declared application policy or a claim that older
Safari momentum scrolling is unchanged.

This is a narrow CSS cleanup. It does not establish the cause of the staged
WebKit native-scroll timeouts or unobserved page evaluations. The hosted Linux
WebKit port is not a physical iPhone. Media, animation, application behavior,
authentication and smoke-test assertions are preserved. Actual unchanged hosted
smoke acceptance is required before release.
