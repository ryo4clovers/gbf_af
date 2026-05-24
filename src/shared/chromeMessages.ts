import type { ExtensionMessage, ExtensionResponse } from "./messages";

export async function sendRuntimeMessage(
  message: ExtensionMessage,
): Promise<ExtensionResponse> {
  return chrome.runtime.sendMessage(message);
}
