export const SITE_NAME = "金融助手";

const appUrl = import.meta.env.PUBLIC_APP_URL?.trim();
if (appUrl && !/^https?:\/\//.test(appUrl)) {
  throw new Error("PUBLIC_APP_URL must be an absolute HTTP or HTTPS URL");
}

export const APP_URL = appUrl ? new URL(appUrl).toString() : undefined;
export const START_HREF = APP_URL ?? "/start/";
export const START_LABEL = APP_URL ? "打开工作台" : "开始使用";
