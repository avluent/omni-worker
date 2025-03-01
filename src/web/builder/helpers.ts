import { JsExtension } from "../../types/web-omni-worker";

export function convertToJsUrl(tsUrl: URL, extension: JsExtension): URL {
  tsUrl.pathname = tsUrl.pathname.replace(/\.ts$/, extension);
  tsUrl.href = tsUrl.href.replace(/\.ts$/, extension);
  return tsUrl;
}