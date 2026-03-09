// CDP Screencast — Real-time browser view via Chrome DevTools Protocol
//
// Chrome blocks ALL DevTools access from extension contexts (pages + service workers),
// so we route everything through the native messaging host (Python process):
//   1. sendNativeMessage({action:'getCdpTargets'}) — discover page targets
//   2. connectNative() + postMessage({action:'startScreencast'}) — persistent proxy
//      Python connects to CDP WebSocket, starts Page.startScreencast,
//      and streams JPEG frames back through the native messaging pipe.

class CDPScreencast {
  constructor() {
    this.port = null;
    this.running = false;
    this.onFrame = null;
    this.onStatus = null;
    this.frameCount = 0;
  }

  /**
   * Start screencast from a CDP-enabled browser
   * @param {string} debugUrl - e.g. "127.0.0.1:18800"
   * @param {Function} onFrame - callback(dataUrl) for each frame
   * @param {Function} onStatus - callback(status, message) for status updates
   */
  async start(debugUrl, onFrame, onStatus) {
    this.onFrame = onFrame;
    this.onStatus = onStatus;
    this.frameCount = 0;

    const host = debugUrl.replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '').replace(/\/+$/, '');
    const jsonUrl = `http://${host}/json`;

    // Step 1: Discover targets via one-shot native message
    if (onStatus) onStatus('connecting', '正在发现浏览器页面...');

    const targets = await this._discoverTargets(jsonUrl);

    // Find XHS page first, then any page
    let page = targets.find(t => t.type === 'page' && t.url && t.url.includes('xiaohongshu.com'));
    if (!page) page = targets.find(t => t.type === 'page');
    if (!page) throw new Error('未找到浏览器页面目标');

    const wsUrl = page.webSocketDebuggerUrl;
    if (!wsUrl) throw new Error('页面无 WebSocket 调试地址');

    if (onStatus) onStatus('connecting', `连接到: ${page.title || page.url}`);

    // Step 2: Start persistent native messaging for screencast proxy
    return new Promise((resolve, reject) => {
      try {
        this.port = chrome.runtime.connectNative('com.openclaw.bridge');
      } catch (e) {
        reject(new Error('Native host 连接失败: ' + e.message));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('CDP screencast 连接超时'));
        this.stop();
      }, 8000);

      this.port.onMessage.addListener((msg) => {
        if (msg.type === 'status') {
          if (msg.status === 'streaming') {
            clearTimeout(timeout);
            this.running = true;
            resolve();
          }
          if (this.onStatus) this.onStatus(msg.status, msg.message);
        } else if (msg.type === 'frame') {
          this.frameCount++;
          if (this.onFrame) this.onFrame('data:image/jpeg;base64,' + msg.data);
        } else if (msg.type === 'error') {
          clearTimeout(timeout);
          reject(new Error(msg.error));
        }
      });

      this.port.onDisconnect.addListener(() => {
        clearTimeout(timeout);
        this.running = false;
        const err = chrome.runtime.lastError;
        if (err) {
          reject(new Error(err.message));
        }
        if (this.onStatus) this.onStatus('disconnected', '实时画面已断开');
      });

      // Tell native host to connect to CDP and start screencast
      this.port.postMessage({ action: 'startScreencast', wsUrl });
    });
  }

  async _discoverTargets(jsonUrl) {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendNativeMessage) {
      const result = await new Promise((resolve, reject) => {
        chrome.runtime.sendNativeMessage('com.openclaw.bridge',
          { action: 'getCdpTargets', url: jsonUrl },
          (resp) => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else resolve(resp);
          }
        );
      });
      if (!result || !result.ok) throw new Error(result?.error || 'native host error');
      return result.targets;
    }
    // Fallback: direct fetch (non-extension context)
    const resp = await fetch(jsonUrl);
    return resp.json();
  }

  stop() {
    this.running = false;
    if (this.port) {
      try { this.port.postMessage({ action: 'stopScreencast' }); } catch {}
      try { this.port.disconnect(); } catch {}
      this.port = null;
    }
    if (this.onStatus) this.onStatus('stopped', '实时画面已停止');
  }

  isActive() {
    return this.running && this.port !== null;
  }
}

// Singleton
window.cdpScreencast = new CDPScreencast();
