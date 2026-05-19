import { json } from './_helpers.js';

export async function onRequestGet(context) {
  // `copilot: true` means an AI-capable env is configured. Either Qwen env
  // var works (DASHSCOPE_API_KEY mirrors the Aselo convention).
  const hasAi = !!(context.env.QWEN_API_KEY || context.env.DASHSCOPE_API_KEY);
  return json({
    ok: true,
    copilot: hasAi,
    runtime: 'cloudflare-pages-functions',
  });
}
