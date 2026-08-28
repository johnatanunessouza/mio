import { resolveTools } from './registry.js';
import type { ToolInstallContext, ToolInstallResult } from './types.js';

export interface InstallToolsOptions extends ToolInstallContext {
  toolIds: readonly string[];
}

/**
 * Install every requested tool in menu order. Each installer reports its own
 * per-step outcome instead of throwing, so one tool failing never blocks the
 * next one — `mio init` always reaches the summary.
 */
export async function installTools(options: InstallToolsOptions): Promise<ToolInstallResult[]> {
  const installers = resolveTools(options.toolIds);
  const results: ToolInstallResult[] = [];
  for (const installer of installers) {
    let steps;
    try {
      steps = await installer.install(options);
    } catch (error: unknown) {
      steps = [{ label: installer.definition.name, status: 'failed' as const, detail: error instanceof Error ? error.message : String(error) }];
    }
    results.push({ tool: installer.definition, steps });
  }
  return results;
}
