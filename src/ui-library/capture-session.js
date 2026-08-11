import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

import { extractDesignLanguage } from '../index.js';
import { collectCodexEvidence } from '../codex/collect-evidence.js';
import { navigateForCapture } from '../codex/navigate.js';
import { captureScrollReference, prepareCodexCapture } from '../codex/prepare-capture.js';
import { writeCodexContextPack } from '../codex/write-package.js';

const defaultDependencies = Object.freeze({
  browserLauncher: chromium,
  captureScrollReference,
  collectCodexEvidence,
  extractDesignLanguage,
  navigateForCapture,
  prepareCodexCapture,
  writeCodexContextPack,
});

function errorText(error) {
  return error instanceof Error && error.message ? error.message : String(error);
}

export function createUiLibraryCaptureSession({ dependencies = {}, emit }) {
  if (typeof emit !== 'function') throw new TypeError('emit is required');
  const deps = { ...defaultDependencies, ...dependencies };
  let active = null;

  const emitFor = (type, fields = {}) => {
    if (!active) throw new Error('NexPage capture session is not active');
    emit({ protocolVersion: 1, runId: active.runId, type, ...fields });
  };

  const closeBrowser = async () => {
    if (!active?.browser) return;
    const browser = active.browser;
    active.browser = null;
    await browser.close().catch(() => {});
  };

  return Object.freeze({
    cancel: async runId => {
      if (!active || active.runId !== runId || active.phase === 'terminal') return;
      await closeBrowser();
      active.phase = 'terminal';
      emitFor('cancelled', { message: '已关闭 NexPage 浏览器并取消采集。' });
    },
    continue: async runId => {
      if (!active || active.runId !== runId || active.phase !== 'browser_ready') {
        throw new Error('NexPage 页面还没有准备好。');
      }
      active.phase = 'extracting';
      const { outputDirectory, page, requestedUrl } = active;
      const referenceScreenshotPath = path.join(outputDirectory, 'reference.png');
      const fullScreenshotPath = path.join(outputDirectory, 'reference-full.png');
      let fullPagePath = null;
      let fullPageError = null;

      try {
        emitFor('progress', { message: '正在稳定页面并处理临时弹层…', step: 'prepare_page' });
        try {
          await deps.prepareCodexCapture(page);
        } catch {
          // Preparation is best-effort; the visible state selected by the user remains usable.
        }

        emitFor('progress', { message: '正在截取当前页面首屏…', step: 'capture_reference' });
        await page.screenshot({
          animations: 'disabled',
          fullPage: false,
          path: referenceScreenshotPath,
          type: 'png',
        });

        const finalUrl = page.url();
        const pageTitle = (await page.title()).trim();
        emitFor('progress', { message: '正在提取网页视觉语言…', step: 'extract_design' });
        const design = await deps.extractDesignLanguage(finalUrl, {
          existingPage: page,
          url: finalUrl,
        });
        delete design._raw;
        delete design._smart;

        emitFor('progress', { message: '正在收集页面证据与长图…', step: 'capture_full' });
        const evidence = await deps.collectCodexEvidence(page);
        try {
          await deps.captureScrollReference(page, fullScreenshotPath);
          fullPagePath = fullScreenshotPath;
        } catch (primaryError) {
          try {
            await page.screenshot({
              animations: 'disabled',
              fullPage: true,
              path: fullScreenshotPath,
              type: 'png',
            });
            fullPagePath = fullScreenshotPath;
          } catch (fallbackError) {
            fullPageError = `${errorText(primaryError)}; fallback failed: ${errorText(fallbackError)}`;
          }
        }

        emitFor('progress', { message: '正在生成 Codex 视觉包…', step: 'build_codex_context' });
        const hostname = new URL(finalUrl || requestedUrl).hostname
          .replace(/^www\./, '')
          .replace(/\./g, '-');
        const codexPack = deps.writeCodexContextPack({
          design,
          evidence,
          fullPageError,
          fullPagePath,
          hostname,
          outDir: outputDirectory,
          referencePath: referenceScreenshotPath,
        });

        await closeBrowser();
        active.phase = 'terminal';
        emitFor('completed', {
          finalUrl,
          ...(fullPagePath ? { fullScreenshotPath: fullPagePath } : {}),
          outputDirectory,
          referenceScreenshotPath,
          title: pageTitle || design.meta?.title || hostname,
          visualPackagePath: codexPack.directory,
        });
      } finally {
        if (active?.phase !== 'terminal') await closeBrowser();
      }
    },
    start: async input => {
      if (active && active.phase !== 'terminal') {
        throw new Error('NexPage capture session already has an active run');
      }
      fs.mkdirSync(input.outputDirectory, { recursive: true });
      const browser = await deps.browserLauncher.launch({ headless: false });
      active = {
        browser,
        outputDirectory: input.outputDirectory,
        page: null,
        phase: 'starting',
        requestedUrl: input.requestedUrl,
        runId: input.runId,
      };
      try {
        const context = await browser.newContext({ viewport: { height: 800, width: 1280 } });
        const page = await context.newPage();
        active.page = page;
        const navigation = await deps.navigateForCapture(page, input.requestedUrl);
        await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
        active.phase = 'browser_ready';
        const title = (await page.title()).trim();
        const navigationNote = navigation.degraded ? '（页面已渲染，但网络仍在加载）' : '';
        emitFor('browser_ready', {
          message: `真实浏览器已打开${title ? `：${title}` : ''}${navigationNote}。请完成登录或导航后回到 UI 灵感库继续。`,
        });
      } catch (error) {
        await closeBrowser();
        active.phase = 'terminal';
        throw error;
      }
    },
  });
}
