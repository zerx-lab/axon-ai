import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import zhTranslation from "./locales/zh.json";
import enTranslation from "./locales/en.json";

// 定义支持的语言
export const supportedLanguages = {
  zh: { name: "中文", nativeName: "中文" },
  en: { name: "English", nativeName: "English" },
} as const;

export type SupportedLanguage = keyof typeof supportedLanguages;

// 语言资源
const resources = {
  zh: {
    translation: zhTranslation,
  },
  en: {
    translation: enTranslation,
  },
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

// 切换语言
export const changeLanguage = async (lang: SupportedLanguage): Promise<void> => {
  await i18n.changeLanguage(lang);
  localStorage.setItem("axon-language", lang);
};

export default i18n;
