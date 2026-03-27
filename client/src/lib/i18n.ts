/**
 * Internationalization (i18n) system for DreamForgeX.
 *
 * Approach: Client-side translation with language switcher.
 * - Core UI strings are translated via static dictionary
 * - Tool-generated content stays in original language (user's prompt language)
 * - SEO metadata handled via hreflang tags in layout
 */

export const LANGUAGES = [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "pt", name: "Português", flag: "🇧🇷" },
  { code: "it", name: "Italiano", flag: "🇮🇹" },
  { code: "nl", name: "Nederlands", flag: "🇳🇱" },
  { code: "ru", name: "Русский", flag: "🇷🇺" },
  { code: "zh", name: "中文", flag: "🇨🇳" },
  { code: "ja", name: "日本語", flag: "🇯🇵" },
  { code: "ko", name: "한국어", flag: "🇰🇷" },
  { code: "ar", name: "العربية", flag: "🇸🇦" },
  { code: "hi", name: "हिन्दी", flag: "🇮🇳" },
  { code: "tr", name: "Türkçe", flag: "🇹🇷" },
  { code: "pl", name: "Polski", flag: "🇵🇱" },
  { code: "sv", name: "Svenska", flag: "🇸🇪" },
  { code: "da", name: "Dansk", flag: "🇩🇰" },
  { code: "fi", name: "Suomi", flag: "🇫🇮" },
  { code: "th", name: "ไทย", flag: "🇹🇭" },
  { code: "vi", name: "Tiếng Việt", flag: "🇻🇳" },
  { code: "id", name: "Bahasa Indonesia", flag: "🇮🇩" },
  { code: "uk", name: "Українська", flag: "🇺🇦" },
] as const;

export type LangCode = (typeof LANGUAGES)[number]["code"];

// Core UI translations — most critical strings
const translations: Record<string, Record<string, string>> = {
  en: {
    "nav.tools": "AI Tools",
    "nav.video": "Video Studio",
    "nav.gallery": "Gallery",
    "nav.marketplace": "Marketplace",
    "nav.studio": "Studio",
    "nav.pricing": "Pricing",
    "nav.signin": "Sign In",
    "nav.signout": "Sign Out",
    "hero.title": "Create Something Amazing",
    "hero.subtitle": "71+ AI tools for images, video, songs, and design — powered by 20 AI models",
    "cta.start_free": "Start Free",
    "cta.go_pro": "Go Pro",
    "cta.generate": "Generate",
    "cta.download": "Download",
    "cta.share": "Share",
    "cta.sign_in_free": "Sign In Free",
    "auth.sign_in_to_generate": "Sign in to generate — it's free to start",
    "pricing.explorer": "Explorer",
    "pricing.pro": "Pro",
    "pricing.studio": "Studio",
    "pricing.enterprise": "Enterprise",
    "pricing.free": "Free",
    "pricing.month": "month",
    "tools.all_tools": "All Tools",
    "tools.image_editing": "Image Editing",
    "tools.creative": "Creative Generation",
    "tools.video": "Video Generation",
    "tools.audio": "Audio & Music",
    "tools.workflow": "Workflow",
    "tools.utility": "Utilities",
    "footer.powered_by": "Powered by",
    "footer.all_rights": "All rights reserved",
  },
  es: {
    "nav.tools": "Herramientas IA",
    "nav.video": "Estudio de Video",
    "nav.gallery": "Galería",
    "nav.marketplace": "Mercado",
    "nav.studio": "Estudio",
    "nav.pricing": "Precios",
    "nav.signin": "Iniciar Sesión",
    "nav.signout": "Cerrar Sesión",
    "hero.title": "Crea Algo Increíble",
    "hero.subtitle": "71+ herramientas de IA para imágenes, video, canciones y diseño — impulsado por 20 modelos de IA",
    "cta.start_free": "Empezar Gratis",
    "cta.go_pro": "Ser Pro",
    "cta.generate": "Generar",
    "cta.download": "Descargar",
    "cta.share": "Compartir",
    "cta.sign_in_free": "Regístrate Gratis",
    "auth.sign_in_to_generate": "Inicia sesión para generar — es gratis",
    "pricing.free": "Gratis",
    "pricing.month": "mes",
    "footer.powered_by": "Impulsado por",
    "footer.all_rights": "Todos los derechos reservados",
  },
  fr: {
    "nav.tools": "Outils IA",
    "nav.video": "Studio Vidéo",
    "nav.gallery": "Galerie",
    "nav.marketplace": "Marché",
    "nav.studio": "Studio",
    "nav.pricing": "Tarifs",
    "nav.signin": "Connexion",
    "nav.signout": "Déconnexion",
    "hero.title": "Créez Quelque Chose d'Incroyable",
    "hero.subtitle": "71+ outils IA pour images, vidéo, chansons et design — propulsé par 20 modèles IA",
    "cta.start_free": "Commencer Gratuit",
    "cta.go_pro": "Passer Pro",
    "cta.generate": "Générer",
    "cta.download": "Télécharger",
    "cta.share": "Partager",
    "cta.sign_in_free": "Inscription Gratuite",
    "auth.sign_in_to_generate": "Connectez-vous pour générer — c'est gratuit",
    "pricing.free": "Gratuit",
    "pricing.month": "mois",
    "footer.powered_by": "Propulsé par",
    "footer.all_rights": "Tous droits réservés",
  },
  de: {
    "nav.tools": "KI-Werkzeuge",
    "nav.video": "Video Studio",
    "nav.gallery": "Galerie",
    "nav.marketplace": "Marktplatz",
    "nav.studio": "Studio",
    "nav.pricing": "Preise",
    "nav.signin": "Anmelden",
    "hero.title": "Erschaffe Etwas Erstaunliches",
    "hero.subtitle": "71+ KI-Tools für Bilder, Video, Songs und Design — angetrieben von 20 KI-Modellen",
    "cta.start_free": "Kostenlos Starten",
    "cta.generate": "Generieren",
    "cta.download": "Herunterladen",
    "pricing.free": "Kostenlos",
    "pricing.month": "Monat",
  },
  zh: {
    "nav.tools": "AI工具",
    "nav.video": "视频工作室",
    "nav.gallery": "画廊",
    "nav.marketplace": "市场",
    "nav.studio": "工作室",
    "nav.pricing": "价格",
    "nav.signin": "登录",
    "hero.title": "创造令人惊叹的作品",
    "hero.subtitle": "71+AI工具，用于图像、视频、歌曲和设计——由20个AI模型驱动",
    "cta.start_free": "免费开始",
    "cta.generate": "生成",
    "cta.download": "下载",
    "pricing.free": "免费",
    "pricing.month": "月",
  },
  ja: {
    "nav.tools": "AIツール",
    "nav.video": "ビデオスタジオ",
    "nav.gallery": "ギャラリー",
    "nav.marketplace": "マーケット",
    "nav.pricing": "料金",
    "nav.signin": "ログイン",
    "hero.title": "素晴らしいものを創造しよう",
    "hero.subtitle": "画像、動画、音楽、デザインのための66以上のAIツール",
    "cta.start_free": "無料で始める",
    "cta.generate": "生成",
    "cta.download": "ダウンロード",
    "pricing.free": "無料",
    "pricing.month": "月",
  },
  ko: {
    "nav.tools": "AI 도구",
    "nav.video": "비디오 스튜디오",
    "nav.gallery": "갤러리",
    "nav.pricing": "가격",
    "nav.signin": "로그인",
    "hero.title": "놀라운 것을 만들어보세요",
    "cta.start_free": "무료로 시작",
    "cta.generate": "생성",
    "cta.download": "다운로드",
    "pricing.free": "무료",
    "pricing.month": "월",
  },
  pt: {
    "nav.tools": "Ferramentas IA",
    "nav.video": "Estúdio de Vídeo",
    "nav.gallery": "Galeria",
    "nav.pricing": "Preços",
    "nav.signin": "Entrar",
    "hero.title": "Crie Algo Incrível",
    "hero.subtitle": "71+ ferramentas de IA para imagens, vídeo, músicas e design",
    "cta.start_free": "Começar Grátis",
    "cta.generate": "Gerar",
    "cta.download": "Baixar",
    "pricing.free": "Grátis",
    "pricing.month": "mês",
  },
  hi: {
    "nav.tools": "AI उपकरण",
    "nav.pricing": "मूल्य",
    "nav.signin": "साइन इन",
    "hero.title": "कुछ अद्भुत बनाएं",
    "cta.start_free": "मुफ्त शुरू करें",
    "cta.generate": "जनरेट",
    "pricing.free": "मुफ्त",
  },
  ar: {
    "nav.tools": "أدوات الذكاء الاصطناعي",
    "nav.pricing": "الأسعار",
    "nav.signin": "تسجيل الدخول",
    "hero.title": "أنشئ شيئاً مذهلاً",
    "cta.start_free": "ابدأ مجاناً",
    "cta.generate": "إنشاء",
    "pricing.free": "مجاني",
  },
  ru: {
    "nav.tools": "ИИ Инструменты",
    "nav.pricing": "Цены",
    "nav.signin": "Войти",
    "hero.title": "Создайте что-то удивительное",
    "cta.start_free": "Начать бесплатно",
    "cta.generate": "Генерировать",
    "pricing.free": "Бесплатно",
    "pricing.month": "месяц",
  },
  tr: {
    "nav.tools": "AI Araçları",
    "nav.pricing": "Fiyatlar",
    "nav.signin": "Giriş Yap",
    "hero.title": "Harika Bir Şey Yaratın",
    "cta.start_free": "Ücretsiz Başla",
    "cta.generate": "Oluştur",
    "pricing.free": "Ücretsiz",
  },
  it: {
    "nav.tools": "Strumenti IA",
    "nav.pricing": "Prezzi",
    "nav.signin": "Accedi",
    "hero.title": "Crea Qualcosa di Straordinario",
    "cta.start_free": "Inizia Gratis",
    "cta.generate": "Genera",
    "pricing.free": "Gratuito",
  },
};

/**
 * Get a translated string. Falls back to English if not found.
 */
export function t(key: string, lang: string = "en"): string {
  return translations[lang]?.[key] || translations.en?.[key] || key;
}

/**
 * Get the user's preferred language from browser or localStorage.
 */
export function getPreferredLanguage(): LangCode {
  if (typeof window === "undefined") return "en";
  const saved = localStorage.getItem("dfx-lang");
  if (saved && LANGUAGES.some((l) => l.code === saved)) return saved as LangCode;
  const browser = navigator.language?.split("-")[0];
  if (browser && LANGUAGES.some((l) => l.code === browser)) return browser as LangCode;
  return "en";
}

/**
 * Save language preference.
 */
export function setLanguage(lang: LangCode): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("dfx-lang", lang);
  document.documentElement.lang = lang;
  // Set dir for RTL languages
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
}
