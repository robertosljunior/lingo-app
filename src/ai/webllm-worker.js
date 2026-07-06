// webllm-worker.js — runs the WebLLM engine off the main thread.
// Inference and model loading happen here so the UI stays responsive; the main
// thread talks to it through the standard web-llm worker protocol.

import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm'

const handler = new WebWorkerMLCEngineHandler()
self.onmessage = (msg) => handler.onmessage(msg)
