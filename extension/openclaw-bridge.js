// ========== OpenClaw Bridge ==========
// WebSocket client connecting Chrome extension to OpenClaw Gateway
// Enables AI-driven XHS nurturing instead of CSS selector automation

class OpenClawBridge {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.listeners = {};
    this.pendingRpc = new Map();
    this.rpcCounter = 0;
    this.reconnectTimer = null;
    this.config = { url: '', token: '' };
    this.activeSessions = new Map(); // sessionKey → { planId }
  }

  // ---- Connection ----

  async connect(url, token) {
    this.config = { url, token };
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);
      } catch (e) {
        reject(new Error('WebSocket creation failed: ' + e.message));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
        this.ws?.close();
      }, 10000);

      this.ws.onopen = () => {
        // Send handshake (OpenClaw Protocol v3)
        this._connectId = this._nextId();
        this._send({
          type: 'req',
          id: this._connectId,
          method: 'connect',
          params: {
            minProtocol: 3,
            maxProtocol: 3,
            client: {
              id: 'gateway-client',
              displayName: 'YangShuHu',
              version: '3.0.1',
              platform: 'chrome-extension',
              mode: 'backend',
            },
            caps: ['tool-events'],
            role: 'operator',
            scopes: ['operator.admin'],
            auth: token ? { token } : undefined,
          },
        });
      };

      this.ws.onmessage = (event) => {
        let msg;
        try { msg = JSON.parse(event.data); } catch { return; }
        this._handleMessage(msg, resolve, reject, timeout);
      };

      this.ws.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('WebSocket error'));
      };

      this.ws.onclose = (event) => {
        const reason = event?.reason ? ` (${event.reason})` : '';
        const msg = `Gateway disconnected${reason}`;
        // Surface socket close as runtime errors for active plans.
        if (this.activeSessions.size > 0) {
          for (const sessionKey of this.activeSessions.keys()) {
            this._emit('error', {
              sessionKey,
              source: 'ws',
              code: event?.code || 1006,
              message: msg,
            });
          }
          this.activeSessions.clear();
        }
        this._rejectPendingRpc(new Error(msg));
        this.connected = false;
        this._emit('disconnected');
        this._scheduleReconnect();
      };
    });
  }

  _handleMessage(msg, resolveConnect, rejectConnect, connectTimeout) {
    // Handle connect response (type="res")
    if (msg.type === 'res' && msg.id === this._connectId && !this.connected) {
      clearTimeout(connectTimeout);
      if (msg.ok === false) {
        if (rejectConnect) rejectConnect(new Error(msg.error?.message || 'Connect rejected'));
        return;
      }
      this.connected = true;
      this._emit('connected');
      if (resolveConnect) resolveConnect(true);
      return;
    }

    // Handle RPC responses (type="res")
    if (msg.type === 'res' && msg.id && this.pendingRpc.has(msg.id)) {
      const { resolve, reject } = this.pendingRpc.get(msg.id);
      this.pendingRpc.delete(msg.id);
      if (msg.ok === false) {
        reject(new Error(msg.error?.message || 'RPC error'));
      } else {
        resolve(msg.payload || msg);
      }
      return;
    }

    // Handle streamed events from agent
    // Gateway format: { type: "event", event: "agent", payload: { stream, data, ... } }
    if (msg.type === 'event' && msg.event === 'agent') {
      this._handleAgentEvent(msg.payload || {});
    }
  }

  _handleAgentEvent(payload) {
    const { stream, data, sessionKey } = payload;
    if (!stream || !data) return;

    // Only process events for sessions we're tracking
    if (sessionKey && !this.activeSessions.has(sessionKey)) return;

    // Assistant text output — parse for structured action reports
    if (stream === 'assistant') {
      const text = data.delta || data.text || '';
      if (text) this._parseAgentOutput(text, sessionKey || null);
    }

    // Tool events — track browser actions and screenshots
    if (stream === 'tool') {
      const toolName = data.toolName || data.name || '';
      const phase = data.phase || '';

      // Tool call start — track browser actions
      if (phase === 'start' && toolName === 'browser') {
        const input = data.input || {};
        this._emit('action', {
          sessionKey,
          action: input.action || 'browser',
          label: this._browserActionLabel(input),
          detail: this._browserActionDetail(input),
          url: input.url || input.targetUrl || '',
        });
      }

      // Tool result — extract screenshots
      if (phase === 'end' && data.result) {
        const content = data.result.content || data.result;
        const blocks = Array.isArray(content) ? content : [content];
        for (const block of blocks) {
          if (block.type === 'image' && block.source?.data) {
            this._emit('screenshot', { sessionKey, imageBase64: block.source.data });
          }
        }
      }

      // Tool failure
      if (phase === 'end' && data.error) {
        const errMsg = data.error?.message || data.error?.detail || data.error || `${toolName} failed`;
        this._emit('error', {
          sessionKey,
          source: 'tool',
          toolName,
          message: String(errMsg),
        });
      }
    }

    // Lifecycle — agent turn complete
    if (stream === 'lifecycle') {
      if (data.phase === 'done' || data.phase === 'complete') {
        this.activeSessions.delete(sessionKey);
        this._emit('complete', { sessionKey });
        return;
      }

      // Lifecycle failure/abort/timeout from gateway
      if (['error', 'failed', 'aborted', 'timeout', 'cancelled'].includes(data.phase)) {
        const errMsg = data.error?.message || data.error || data.message || `Agent lifecycle ${data.phase}`;
        this.activeSessions.delete(sessionKey);
        this._emit('error', {
          sessionKey,
          source: 'lifecycle',
          phase: data.phase,
          message: String(errMsg),
        });
      }
    }
  }

  _browserActionLabel(input) {
    const map = {
      navigate: 'navigate', screenshot: 'screenshot', snapshot: 'scan',
      act: input.kind || 'act', open: 'open-tab', close: 'close-tab',
      tabs: 'list-tabs', focus: 'focus-tab',
    };
    return map[input.action] || input.action;
  }

  _browserActionDetail(input) {
    if (input.action === 'navigate') return input.url || input.targetUrl || '';
    if (input.action === 'act') {
      if (input.kind === 'click') return `click ref=${input.ref || ''}`;
      if (input.kind === 'type') return `type "${(input.text || '').slice(0, 30)}"`;
      if (input.kind === 'wait') return `wait ${input.timeMs || 0}ms`;
      if (input.kind === 'press') return `press ${input.key || ''}`;
      if (input.kind === 'evaluate') return 'evaluate JS';
      return input.kind || '';
    }
    return '';
  }

  _parseAgentOutput(text, sk) {
    const errorPattern = /(api rate limit reached|login required|captcha|no pages available|device identity required)/i;
    if (errorPattern.test(text)) {
      this._emit('error', { sessionKey: sk, source: 'assistant', message: text.slice(0, 200) });
      return;
    }

    // Try to extract structured status updates from agent text
    // Agent writes JSON status to memory, but also narrates actions in text
    const actionPatterns = [
      { pattern: /browsed?\s+(?:note|the note|a note)/i, action: 'browse', label: 'browse' },
      { pattern: /liked?\s+(?:the|this)?\s*(?:note|post)/i, action: 'like', label: 'like' },
      { pattern: /collected?\s+|bookmarked?\s+|saved?\s+/i, action: 'collect', label: 'collect' },
      { pattern: /followed?\s+(?:the)?\s*(?:author|user|creator)/i, action: 'follow', label: 'follow' },
      { pattern: /commented?\s+|posted?\s+(?:a\s+)?comment/i, action: 'comment', label: 'comment' },
      { pattern: /scrolling|scroll(?:ed)?/i, action: 'scroll', label: 'scroll' },
      { pattern: /opening|clicked?\s+(?:on|into)\s+/i, action: 'click', label: 'open-note' },
      { pattern: /closing|closed?\s+(?:the)?\s*note/i, action: 'close', label: 'close-note' },
      { pattern: /completed?\s+|finished?\s+|done/i, action: 'done', label: 'done' },
    ];

    for (const { pattern, action, label } of actionPatterns) {
      if (pattern.test(text)) {
        this._emit('action', { sessionKey: sk, action, label, detail: text.slice(0, 80) });

        // Emit stat update for trackable actions
        if (['browse', 'like', 'collect', 'follow', 'comment'].includes(action)) {
          this._emit('stats', { sessionKey: sk, [action]: 1 });
        }
        break;
      }
    }
  }

  // ---- RPC Methods ----

  async startNurturing(plan, sessionKey = 'main') {
    if (!this.connected) throw new Error('Not connected to OpenClaw');

    this.activeSessions.set(sessionKey, { planId: plan.planName || sessionKey });

    const skillName = plan.skill || 'xhs-nurture';
    let message;

    // Check registry for skill-specific message template
    const registry = window.SkillRegistry;
    const skillDef = registry ? registry.get(skillName) : null;

    if (skillDef && skillDef.bridgeMessage) {
      message = registry.buildBridgeMessage(skillDef, plan);
    } else {
      // Default nurture message
      message = `Execute the xhs-nurture skill with this plan configuration:\n\n\`\`\`json\n${JSON.stringify(plan, null, 2)}\n\`\`\`\n\nStart nurturing now. Report each action as you go.`;
    }

    return this._rpc('chat.send', {
      sessionKey,
      message,
      idempotencyKey: `ysh-${skillName}-${sessionKey}-${Date.now()}`,
    });
  }

  async stopNurturing(sessionKey = 'main') {
    this.activeSessions.delete(sessionKey);
    if (!this.connected) return;
    return this._rpc('chat.abort', { sessionKey });
  }

  async stopAllSessions() {
    const keys = [...this.activeSessions.keys()];
    for (const sk of keys) {
      await this.stopNurturing(sk).catch(() => {});
    }
  }

  hasActiveSessions() {
    return this.activeSessions.size > 0;
  }

  async getStatus() {
    // Status is tracked locally via streamed events, not via RPC
    return null;
  }

  async healthCheck() {
    // Quick WebSocket connect test
    const url = this.config.url || 'ws://127.0.0.1:18789';
    return new Promise((resolve) => {
      try {
        const testWs = new WebSocket(url);
        const timer = setTimeout(() => { testWs.close(); resolve(false); }, 3000);
        testWs.onopen = () => { clearTimeout(timer); testWs.close(); resolve(true); };
        testWs.onerror = () => { clearTimeout(timer); resolve(false); };
      } catch { resolve(false); }
    });
  }

  // ---- Internal ----

  _rpc(method, params) {
    return new Promise((resolve, reject) => {
      const id = this._nextId();
      this.pendingRpc.set(id, { resolve, reject });
      this._send({ type: 'req', id, method, params });

      setTimeout(() => {
        if (this.pendingRpc.has(id)) {
          this.pendingRpc.delete(id);
          reject(new Error(`RPC timeout: ${method}`));
        }
      }, 420000); // 7 min timeout to avoid interrupting long-running nurture turns
    });
  }

  _send(obj) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  _nextId() {
    return `ysh-${++this.rpcCounter}-${Date.now().toString(36)}`;
  }

  _rejectPendingRpc(error) {
    for (const [id, pending] of this.pendingRpc.entries()) {
      this.pendingRpc.delete(id);
      try { pending.reject(error); } catch {}
    }
  }

  _scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (!this.connected && this.config.url) {
        try { await this.connect(this.config.url, this.config.token); }
        catch { /* will retry on next close */ }
      }
    }, 5000);
  }

  // ---- Events ----

  on(event, fn) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }

  off(event, fn) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(f => f !== fn);
  }

  _emit(event, data) {
    (this.listeners[event] || []).forEach(fn => {
      try { fn(data); } catch (e) { console.error('[OpenClaw Bridge] event handler error:', e); }
    });
  }

  // ---- Cleanup ----

  disconnect() {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.ws) { this.ws.close(); this.ws = null; }
    this.connected = false;
    this.activeSessions.clear();
    this._rejectPendingRpc(new Error('Bridge disconnected'));
  }
}

// Singleton
window.openclawBridge = new OpenClawBridge();
