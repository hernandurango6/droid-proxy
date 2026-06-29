export interface CommandCodeModelDefinition {
  id: string;
  name: string;
  levels?: string[];
  defaultLevel?: string;
  vision?: boolean;
  reasoning?: boolean;
}

export const COMMANDCODE_MODELS: CommandCodeModelDefinition[] = [
  { id: "deepseek/deepseek-v4-pro", name: "DeepSeek V4 Pro", levels: ["high", "max"], defaultLevel: "max" },
  { id: "deepseek/deepseek-v4-flash", name: "DeepSeek V4 Flash", levels: ["high", "max"], defaultLevel: "max" },
  { id: "moonshotai/Kimi-K2.7-Code", name: "Kimi K2.7 Code", vision: true, reasoning: true },
  { id: "moonshotai/Kimi-K2.7-Code-Highspeed", name: "Kimi K2.7 Code Highspeed", vision: true, reasoning: true },
  { id: "moonshotai/Kimi-K2.6", name: "Kimi K2.6", vision: true },
  { id: "moonshotai/Kimi-K2.5", name: "Kimi K2.5", vision: true },
  { id: "zai-org/GLM-5.2", name: "GLM 5.2" },
  { id: "zai-org/GLM-5.1", name: "GLM 5.1" },
  { id: "zai-org/GLM-5", name: "GLM 5" },
  { id: "MiniMaxAI/MiniMax-M3", name: "MiniMax M3", vision: true, reasoning: true },
  { id: "MiniMaxAI/MiniMax-M2.7", name: "MiniMax M2.7" },
  { id: "MiniMaxAI/MiniMax-M2.5", name: "MiniMax M2.5" },
  { id: "xiaomi/mimo-v2.5-pro", name: "MiMo V2.5 Pro" },
  { id: "xiaomi/mimo-v2.5", name: "MiMo V2.5", vision: true },
  { id: "Qwen/Qwen3.6-Max-Preview", name: "Qwen 3.6 Max Preview", reasoning: true },
  { id: "Qwen/Qwen3.6-Plus", name: "Qwen 3.6 Plus", vision: true, reasoning: true },
  { id: "Qwen/Qwen3.7-Max", name: "Qwen 3.7 Max", reasoning: true },
  { id: "Qwen/Qwen3.7-Plus", name: "Qwen 3.7 Plus", vision: true, reasoning: true },
  { id: "stepfun/Step-3.7-Flash", name: "Step 3.7 Flash", vision: true, reasoning: true },
  { id: "stepfun/Step-3.5-Flash", name: "Step 3.5 Flash", reasoning: true },
  { id: "nvidia/nemotron-3-ultra-550b-a55b", name: "Nemotron 3 Ultra 550B A55B", reasoning: true },
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
  { id: "claude-fable-5", name: "Claude Fable 5" },
  { id: "claude-opus-4-8", name: "Claude Opus 4.8" },
  { id: "claude-opus-4-7", name: "Claude Opus 4.7" },
  { id: "claude-haiku-4-5", name: "Claude Haiku 4.5" },
  { id: "gpt-5.5", name: "GPT 5.5" },
  { id: "gpt-5.4", name: "GPT 5.4" },
  { id: "gpt-5.3-codex", name: "GPT 5.3 Codex" },
  { id: "gpt-5.4-mini", name: "GPT 5.4 Mini" },
  { id: "google/gemini-3.5-flash", name: "Gemini 3.5 Flash" },
  { id: "google/gemini-3.1-flash-lite", name: "Gemini 3.1 Flash Lite" },
  { id: "sakana/fugu-ultra", name: "Fugu Ultra" }
];