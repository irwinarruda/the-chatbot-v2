import { homedir } from "node:os";
import { join } from "node:path";

export const CONFIG_PATH = join(
  homedir(),
  ".config",
  "the-chatbot",
  "config.json",
);
export const CONFIG_LABEL = "~/.config/the-chatbot/config.json";
export const TOKEN_PATTERN = /^tca_[A-Za-z0-9_-]{43}$/;
export const ENVIRONMENT_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;

export function validateBaseUrl(value) {
  const url = new URL(value);
  const isLocalHttp =
    url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if (url.protocol !== "https:" && !isLocalHttp) {
    throw new Error(
      "The configured server URL must use HTTPS, except for localhost.",
    );
  }
  if (url.username || url.password) {
    throw new Error("The configured server URL cannot contain credentials.");
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error(
      "The configured server URL cannot contain a path, query, or fragment.",
    );
  }
  return url;
}
