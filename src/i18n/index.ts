import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// 只同步加载默认语言（中文），其他语言按需加载
import zhTranslation from "./locales/zh.json";

// 定义支持的语言
export const supportedLanguages = {
  zh: { name: "中文", nativeName: "中文" },
  en: { name: "English", nativeName: "English" },
} as const;

export type SupportedLanguage = keyof typeof supportedLanguages;

// 语言资源（初始只加载中文）
const resources = {
  zh: {
    translation: zhTranslation,
  },
};

// 懒加载英文语言包
const loadEnglish = async () => {
  const enTranslation = await import("./locales/en.json");
  i18n.addResourceBundle("en", "translation", enTranslation.default, true, true);
};

// 初始化 i18next
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "zh", // 默认中文
    lng: "zh", // 初始语言为中文
    debug: import.meta.env.DEV,
    interpolation: {
      escapeValue: false, // React 已经默认转义
    },
    detection: {
      // 语言检测配置
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "axon-language",
      caches: ["localStorage"],
    },
  });

// 获取当前语言
export const getCurrentLanguage = (): SupportedLanguage => {
  return i18n.language as SupportedLanguage;
};

// 切换语言（支持懒加载）
export const changeLanguage = async (lang: SupportedLanguage): Promise<void> => {
  // 如果切换到英文且尚未加载，先加载语言包
  if (lang === "en" && !i18n.hasResourceBundle("en", "translation")) {
    await loadEnglish();
  }
  await i18n.changeLanguage(lang);
  localStorage.setItem("axon-language", lang);
};

// 预加载英文语言包（可选，用于提升切换体验）
export const preloadLanguage = async (lang: SupportedLanguage): Promise<void> => {
  if (lang === "en" && !i18n.hasResourceBundle("en", "translation")) {
    await loadEnglish();
  }
};

// 检测用户偏好语言并预加载
const savedLang = localStorage.getItem("axon-language") as SupportedLanguage | null;
if (savedLang === "en") {
  // 如果用户之前选择了英文，异步加载英文语言包
  loadEnglish().then(() => {
    i18n.changeLanguage("en");
  });
}

export default i18n;
