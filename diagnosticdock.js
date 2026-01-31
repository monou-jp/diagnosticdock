/*!
 * diagnosticdock.js v1.0.0
 * BSD-3-Clause
 * Vanilla JS / single file / ES5-friendly
 */
/*!
 * DiagnosticDock
 * Copyright (c) 2026 門王 (https://monou.jp)
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice,
 *    this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 * 3. Neither the name of the copyright holder nor the names of its
 *    contributors may be used to endorse or promote products derived from
 *    this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */


(function (w, d) {
  'use strict';

  var DEFAULTS = {
    mount: null,                 // selector | element | null
    mode: 'embed',               // 'embed' | 'modal'
    position: 'relative',        // 'relative' | 'fixed' (embed時のみ)
    title: '診断',
    noteText: '回答はこのページ内でのみ扱われます（サーバー送信はしません）',
    primaryLabel: '次へ',
    backLabel: '戻る',
    resetLabel: 'リセット',
    closeLabel: '閉じる',
    ctaTarget: '_self',

    // floatdock的 起点ボタン（mount未指定時）
    floatingLauncher: true,
    launcherLabel: '診断',
    zIndex: 999999,

    // 推奨: 進捗表示
    showProgress: true,          // true: "2/5" とバーを表示
    progressStyle: 'bar',        // 'bar' | 'text' | 'both'

    // 推奨: theme（密度・角丸など）
    theme: {
      density: 'normal',         // 'compact' | 'normal' | 'comfortable'
      radius: 12,                // px
      fontSize: 13,              // px
      maxWidth: 520,             // px (modal/固定embedの最大幅)
      offset: 16                 // px (fixed時の余白)
    },

    // 推奨: hooks（計測・連携用）
    onOpen: null,
    onClose: null,
    onStepChange: null,          // (payload) => {}
    onReset: null,               // (payload) => {}
    onResult: null,              // (payload) => {}  result表示タイミング
    onCtaClick: null             // (payload) => {}  CTAクリック時（遷移前）
  };

  function extend(base, extra) {
    var k;
    base = base || {};
    extra = extra || {};
    for (k in extra) {
      if (Object.prototype.hasOwnProperty.call(extra, k)) {
        base[k] = extra[k];
      }
    }
    return base;
  }

  function deepMerge(obj, patch) {
    // ES5簡易: themeだけ深くマージ
    var out = extend({}, obj);
    if (!patch) return out;
    var k;
    for (k in patch) {
      if (!Object.prototype.hasOwnProperty.call(patch, k)) continue;
      if (patch[k] && typeof patch[k] === 'object' && !isArray(patch[k])) {
        out[k] = extend(extend({}, out[k] || {}), patch[k]);
      } else {
        out[k] = patch[k];
      }
    }
    return out;
  }

  function isFn(v) { return typeof v === 'function'; }
  function isArray(v) { return Object.prototype.toString.call(v) === '[object Array]'; }
  function safeText(s) { return (s === null || s === undefined) ? '' : String(s); }
  function q(sel, root) { return (root || d).querySelector(sel); }
  function byId(id) { return d.getElementById(id); }
  function hasOwn(obj, k) { return Object.prototype.hasOwnProperty.call(obj, k); }

  function createEl(tag, attrs, children) {
    var el = d.createElement(tag);
    var k;
    attrs = attrs || {};
    for (k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      if (k === 'className') el.className = attrs[k];
      else if (k === 'text') el.textContent = attrs[k];
      else if (k === 'style') el.setAttribute('style', attrs[k]);
      else el.setAttribute(k, attrs[k]);
    }
    if (children && children.length) {
      for (k = 0; k < children.length; k++) {
        if (children[k]) el.appendChild(children[k]);
      }
    }
    return el;
  }

  function resolveMount(mount) {
    if (!mount) return null;
    if (typeof mount === 'string') return q(mount);
    if (mount && mount.nodeType === 1) return mount;
    return null;
  }

  function buildStepIndex(steps) {
    var map = {};
    var i;
    for (i = 0; i < steps.length; i++) map[steps[i].id] = i;
    return map;
  }

  function sanitizeTheme(theme) {
    theme = theme || {};
    var out = extend({}, DEFAULTS.theme);
    out = extend(out, theme);

    if (out.radius < 0) out.radius = 0;
    if (out.fontSize < 10) out.fontSize = 10;
    if (out.maxWidth < 280) out.maxWidth = 280;
    if (out.offset < 0) out.offset = 0;

    if (out.density !== 'compact' && out.density !== 'comfortable') out.density = 'normal';
    return out;
  }

  function densityVars(density) {
    // padding / gap を変える
    if (density === 'compact') return { pad: 12, optPad: 9, gap: 6 };
    if (density === 'comfortable') return { pad: 18, optPad: 12, gap: 10 };
    return { pad: 14, optPad: 10, gap: 8 };
  }

  function injectStylesOnce(config) {
    if (byId('dd-style')) return;

    var theme = sanitizeTheme((config && config.theme) || {});
    var den = densityVars(theme.density);
    var z = (config && config.zIndex) || 999999;
    var maxW = theme.maxWidth;
    var r = theme.radius;
    var fs = theme.fontSize;
    var gap = den.gap;
    var pad = den.pad;
    var optPad = den.optPad;

    var style = createEl('style', { id: 'dd-style', type: 'text/css' });
    style.appendChild(d.createTextNode([
      '.dd-root{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5;color:#111;font-size:' + fs + 'px}',
      '.dd-root *{box-sizing:border-box}',
      '.dd-card{border:1px solid #e5e7eb;border-radius:' + r + 'px;padding:' + pad + 'px;background:#fff;box-shadow:0 10px 30px rgba(0,0,0,0.08)}',
      '.dd-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}',
      '.dd-title{font-size:14px;font-weight:700;margin:0}',
      '.dd-body{display:block}',
      '.dd-q{font-size:14px;font-weight:600;margin:10px 0 8px}',
      '.dd-desc{font-size:12px;color:#444;margin:0 0 10px}',
      '.dd-progress{margin:6px 0 10px}',
      '.dd-progress-top{display:flex;justify-content:space-between;gap:10px;font-size:12px;color:#444;margin-bottom:6px}',
      '.dd-bar{height:8px;border-radius:999px;background:#f3f4f6;overflow:hidden;border:1px solid #e5e7eb}',
      '.dd-bar>i{display:block;height:100%;width:0;background:#111}',
      '.dd-options{display:grid;gap:' + gap + 'px;margin:8px 0 12px}',
      '.dd-opt{display:flex;align-items:flex-start;gap:8px;border:1px solid #e5e7eb;border-radius:' + Math.max(8, Math.floor(r * 0.8)) + 'px;padding:' + optPad + 'px;cursor:pointer;background:#fff}',
      '.dd-opt:hover{background:#fafafa}',
      '.dd-opt input{margin-top:2px}',
      '.dd-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}',
      '.dd-btn{appearance:none;border:1px solid #e5e7eb;background:#fff;border-radius:' + Math.max(8, Math.floor(r * 0.8)) + 'px;padding:10px 12px;font-size:13px;cursor:pointer}',
      '.dd-btn:hover{background:#fafafa}',
      '.dd-btn-primary{border-color:#111;background:#111;color:#fff}',
      '.dd-btn-primary:hover{filter:brightness(0.95)}',
      '.dd-meta{font-size:12px;color:#444;margin-top:8px}',
      '.dd-kv{display:grid;gap:6px;margin:10px 0 12px}',
      '.dd-kv-row{display:flex;justify-content:space-between;gap:10px;border-bottom:1px dashed #e5e7eb;padding:6px 0}',
      '.dd-k{color:#444}',
      '.dd-v{font-weight:600}',
      '.dd-cta{display:inline-flex;align-items:center;justify-content:center;text-decoration:none}',
      '.dd-textarea{width:100%;resize:vertical;min-height:120px}',
      '.dd-error{font-size:12px;color:#b91c1c;margin-top:8px}',
      '.dd-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.35);z-index:' + z + ';display:flex;align-items:flex-end;justify-content:center;padding:16px}',
      '.dd-modal{width:100%;max-width:' + maxW + 'px}',
      '.dd-launcher{position:fixed;right:16px;bottom:16px;z-index:' + (z + 1) + ';border:1px solid #111;background:#111;color:#fff;border-radius:999px;padding:10px 12px;font-size:13px;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,0.18)}',
      '.dd-launcher:hover{filter:brightness(0.95)}',
      '@media(min-width:640px){.dd-overlay{align-items:center}}'
    ].join('')));
    d.head.appendChild(style);
  }

  function DiagnosticDock(userConfig) {
    // window.DIAGNOSTICDOCK_CONFIG で上書き可能（1ファイル運用向け）
    var globalOverride = w.DIAGNOSTICDOCK_CONFIG || {};

    // themeのみ深マージ
    var merged = deepMerge(extend({}, userConfig || {}), globalOverride);
    var config = extend(extend({}, DEFAULTS), merged);
    config.theme = sanitizeTheme(config.theme);

    injectStylesOnce(config);

    if (!config.steps || !config.steps.length) throw new Error('DiagnosticDock: steps is required.');
    if (!config.result || !isFn(config.result)) throw new Error('DiagnosticDock: result(answers) function is required.');

    var mountEl = resolveMount(config.mount);
    var stepIndex = buildStepIndex(config.steps);

    var state = {
      currentId: config.steps[0].id,
      answers: {},
      history: [],         // stack: { stepId, prevAnswer, prevCurrentId }
      resultCache: null
    };

    var root = createEl('div', { className: 'dd-root' });
    var overlay = null;
    var container = null;
    var launcher = null;

    function callHook(name, payload) {
      var fn = config[name];
      if (fn && isFn(fn)) {
        try { fn(payload); } catch (e) { /* noop */ }
      }
    }

    function getCurrentStep() {
      return config.steps[stepIndex[state.currentId]];
    }

    function stepCount() {
      return config.steps.length;
    }

    function currentStepNumber() {
      if (state.currentId === 'end') return stepCount();
      var idx = stepIndex[state.currentId];
      return (idx >= 0 ? idx + 1 : 1);
    }

    function clearError(card) {
      var el = card.querySelector('[data-dd="error"]');
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }

    function showError(card, msg) {
      var el = card.querySelector('[data-dd="error"]');
      if (!el) {
        el = createEl('div', { className: 'dd-error', 'data-dd': 'error' });
        card.appendChild(el);
      }
      el.textContent = safeText(msg);
    }

    function getNextStepIdByOption(step, selectedValue) {
      // option.next（single/multi共通で利用する）
      var i, opt;
      if (!step || !step.options) return null;

      // multiの場合: selectedValue は配列
      if (isArray(selectedValue)) {
        for (i = 0; i < step.options.length; i++) {
          opt = step.options[i];
          if (!opt || !opt.next) continue;
          if (selectedValue.indexOf(opt.value) >= 0) return opt.next; // 最初にマッチしたnextを採用
        }
        return null;
      }

      for (i = 0; i < step.options.length; i++) {
        opt = step.options[i];
        if (opt && opt.value === selectedValue && opt.next) return opt.next;
      }
      return null;
    }

    function getNextStepId(step, selectedValue) {
      // 1) option.next
      var optNext = getNextStepIdByOption(step, selectedValue);
      if (optNext) return optNext;

      // 2) step.next
      if (step && step.next) {
        if (typeof step.next === 'string') return step.next;
        if (isFn(step.next)) return step.next(state.answers);
        if (isArray(step.next)) {
          var i;
          for (i = 0; i < step.next.length; i++) {
            var rule = step.next[i];
            if (!rule) continue;
            if (!rule.when) return rule.goto;

            var a = state.answers[rule.when.id];
            if (rule.when.eq !== undefined && a === rule.when.eq) return rule.goto;
            if (rule.when.truthy && !!a) return rule.goto;

            if (rule.when.in && rule.when.in.length) {
              var j;
              for (j = 0; j < rule.when.in.length; j++) {
                if (a === rule.when.in[j]) return rule.goto;
              }
            }
          }
        }
      }

      // 3) next in array
      var idx = stepIndex[step.id];
      if (idx < config.steps.length - 1) return config.steps[idx + 1].id;
      return 'end';
    }

    function setAnswer(stepId, value) {
      var prev = hasOwn(state.answers, stepId) ? state.answers[stepId] : undefined;
      state.history.push({ stepId: stepId, prevAnswer: prev, prevCurrentId: state.currentId });
      state.answers[stepId] = value;
    }

    function goTo(stepId, reason) {
      var prev = state.currentId;
      if (stepId === 'end' || !hasOwn(stepIndex, stepId)) state.currentId = 'end';
      else state.currentId = stepId;

      callHook('onStepChange', {
        reason: reason || 'navigate',
        from: prev,
        to: state.currentId,
        stepNumber: currentStepNumber(),
        stepCount: stepCount(),
        answers: extend({}, state.answers)
      });

      render();
    }

    function goNextSingle(selectedValue) {
      var step = getCurrentStep();
      setAnswer(step.id, selectedValue);
      goTo(getNextStepId(step, selectedValue), 'next');
    }

    function goNextMulti() {
      var step = getCurrentStep();
      var card = getCardEl();
      if (!card) return;

      var inputs = card.querySelectorAll('input[type="checkbox"][name="dd_' + step.id + '"]');
      var vals = [];
      var i;
      for (i = 0; i < inputs.length; i++) {
        if (inputs[i].checked) vals.push(inputs[i].value);
      }

      if ((step.required !== false) && vals.length === 0) {
        showError(card, '1つ以上選択してください');
        return;
      }

      clearError(card);
      setAnswer(step.id, vals);
      // 推奨: multiでも option.next を使う（選ばれた中で最初にマッチした next を採用）
      goTo(getNextStepId(step, vals), 'next');
    }

    function goBack() {
      if (!state.history.length) return;

      var last = state.history.pop();
      if (last.prevAnswer === undefined) delete state.answers[last.stepId];
      else state.answers[last.stepId] = last.prevAnswer;

      state.currentId = last.prevCurrentId || last.stepId;
      callHook('onStepChange', {
        reason: 'back',
        from: null,
        to: state.currentId,
        stepNumber: currentStepNumber(),
        stepCount: stepCount(),
        answers: extend({}, state.answers)
      });
      render();
    }

    function reset() {
      state.currentId = config.steps[0].id;
      state.answers = {};
      state.history = [];
      state.resultCache = null;

      callHook('onReset', { answers: extend({}, state.answers) });
      callHook('onStepChange', {
        reason: 'reset',
        from: null,
        to: state.currentId,
        stepNumber: currentStepNumber(),
        stepCount: stepCount(),
        answers: extend({}, state.answers)
      });
      render();
    }

    function getCardEl() {
      // modal: containerはcard、embed: containerはcard
      return container || null;
    }

    function renderProgress() {
      if (!config.showProgress) return null;
      if (state.currentId === 'end') return null;

      var n = currentStepNumber();
      var total = stepCount();
      var pct = Math.max(0, Math.min(100, Math.round((n - 1) / total * 100)));

      var wrap = createEl('div', { className: 'dd-progress' });
      var style = config.progressStyle || 'bar';

      if (style === 'text' || style === 'both') {
        wrap.appendChild(createEl('div', { className: 'dd-progress-top' }, [
          createEl('div', { text: '進捗' }),
          createEl('div', { text: n + '/' + total })
        ]));
      }

      if (style === 'bar' || style === 'both') {
        var bar = createEl('div', { className: 'dd-bar' }, [createEl('i', {})]);
        bar.firstChild.style.width = pct + '%';
        wrap.appendChild(bar);
      }

      return wrap;
    }

    function renderHeader() {
      var head = createEl('div', { className: 'dd-head' });
      head.appendChild(createEl('p', { className: 'dd-title', text: safeText(config.title) }));

      var right = createEl('div', {});
      if (config.mode === 'modal') {
        right.appendChild(createEl('button', {
          className: 'dd-btn',
          type: 'button',
          'data-dd-action': 'close',
          text: safeText(config.closeLabel)
        }));
      }
      head.appendChild(right);
      return head;
    }

    function renderStep(step) {
      var body = createEl('div', { className: 'dd-body' });

      var prog = renderProgress();
      if (prog) body.appendChild(prog);

      body.appendChild(createEl('p', { className: 'dd-q', text: safeText(step.question) }));
      if (step.description) body.appendChild(createEl('p', { className: 'dd-desc', text: safeText(step.description) }));

      var type = step.type || 'single';
      var optWrap = createEl('div', { className: 'dd-options' });

      var i;
      for (i = 0; i < step.options.length; i++) {
        var opt = step.options[i];
        var id = 'dd_' + step.id + '_' + i;
        var isMulti = (type === 'multi');

        var input = createEl('input', {
          type: isMulti ? 'checkbox' : 'radio',
          name: 'dd_' + step.id,
          value: safeText(opt.value),
          id: id
        });

        var label = createEl('label', {
          className: 'dd-opt',
          for: id,
          'data-dd-action': isMulti ? 'toggle' : 'select',
          'data-dd-value': safeText(opt.value)
        }, [
          input,
          createEl('div', {}, [createEl('div', { text: safeText(opt.label) })])
        ]);

        optWrap.appendChild(label);
      }

      body.appendChild(optWrap);

      var actions = createEl('div', { className: 'dd-actions' });

      actions.appendChild(createEl('button', {
        className: 'dd-btn',
        type: 'button',
        'data-dd-action': 'back',
        text: safeText(config.backLabel)
      }));

      if (type === 'multi') {
        actions.appendChild(createEl('button', {
          className: 'dd-btn dd-btn-primary',
          type: 'button',
          'data-dd-action': 'next_multi',
          text: safeText(config.primaryLabel)
        }));
      }

      actions.appendChild(createEl('button', {
        className: 'dd-btn',
        type: 'button',
        'data-dd-action': 'reset',
        text: safeText(config.resetLabel)
      }));

      body.appendChild(actions);
      body.appendChild(createEl('div', { className: 'dd-meta', text: safeText(config.noteText) }));

      return body;
    }

    function buildResult() {
      // resultを毎回呼ぶと重いケースがあるためキャッシュ（シンプル）
      state.resultCache = config.result(state.answers, {
        config: config,
        stepCount: stepCount()
      }) || {};
      callHook('onResult', { answers: extend({}, state.answers), result: state.resultCache });
      return state.resultCache;
    }

    function renderResult() {
      var body = createEl('div', { className: 'dd-body' });
      var out = state.resultCache || buildResult();

      body.appendChild(createEl('p', { className: 'dd-q', text: safeText(out.title || '診断結果') }));
      if (out.description) body.appendChild(createEl('p', { className: 'dd-desc', text: safeText(out.description) }));

      if (out.items && out.items.length) {
        var kv = createEl('div', { className: 'dd-kv' });
        var i;
        for (i = 0; i < out.items.length; i++) {
          kv.appendChild(createEl('div', { className: 'dd-kv-row' }, [
            createEl('div', { className: 'dd-k', text: safeText(out.items[i].label) }),
            createEl('div', { className: 'dd-v', text: safeText(out.items[i].value) })
          ]));
        }
        body.appendChild(kv);
      }

      if (out.payload) {
        body.appendChild(createEl('p', { className: 'dd-desc', text: '問い合わせ内容（コピーして使えます）' }));
        var ta = createEl('textarea', { className: 'dd-btn dd-textarea', rows: '6' });
        ta.value = safeText(out.payload);
        body.appendChild(ta);
      }

      var actions = createEl('div', { className: 'dd-actions' });

      if (out.ctaUrl) {
        actions.appendChild(createEl('a', {
          className: 'dd-btn dd-btn-primary dd-cta',
          href: safeText(out.ctaUrl),
          target: safeText(config.ctaTarget),
          rel: (config.ctaTarget === '_blank') ? 'noopener noreferrer' : '',
          'data-dd-action': 'cta',
          text: safeText(out.ctaLabel || '問い合わせへ')
        }));
      }

      actions.appendChild(createEl('button', {
        className: 'dd-btn',
        type: 'button',
        'data-dd-action': 'reset',
        text: safeText(config.resetLabel)
      }));

      body.appendChild(actions);

      return body;
    }

    function renderEmbedWrapper(card) {
      if (config.mode !== 'embed') return card;

      if (config.position === 'fixed') {
        var off = config.theme.offset;
        var wrap = createEl('div', {
          style:
            'position:fixed;right:' + off + 'px;bottom:' + off + 'px;z-index:' + config.zIndex + ';' +
            'width:min(' + config.theme.maxWidth + 'px, calc(100vw - ' + (off * 2) + 'px));'
        }, [card]);
        return wrap;
      }
      return card;
    }

    function render() {
      if (!container) return;

      while (container.firstChild) container.removeChild(container.firstChild);

      container.appendChild(renderHeader());

      if (state.currentId === 'end') container.appendChild(renderResult());
      else container.appendChild(renderStep(getCurrentStep()));
    }

    function openModal() {
      // modalはoverlay内にcardを作って差し替え
      overlay = createEl('div', { className: 'dd-overlay', 'data-dd': 'overlay' });
      var card = createEl('div', { className: 'dd-card', 'data-dd': 'card' });
      var modal = createEl('div', { className: 'dd-modal' }, [card]);

      overlay.appendChild(modal);
      d.body.appendChild(overlay);

      container = card;
      state.resultCache = null;
      render();

      callHook('onOpen', { mode: 'modal' });
    }

    function openEmbed() {
      var card = createEl('div', { className: 'dd-card', 'data-dd': 'card' });
      container = card;

      root.appendChild(renderEmbedWrapper(card));
      mountEl.appendChild(root);

      state.resultCache = null;
      render();

      callHook('onOpen', { mode: 'embed' });
    }

    function close() {
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      overlay = null;
      container = null;
      state.resultCache = null;

      callHook('onClose', {});
    }

    function ensureLauncher() {
      if (!config.floatingLauncher) return;
      if (mountEl) return;
      if (launcher) return;

      launcher = createEl('button', {
        className: 'dd-launcher',
        type: 'button',
        'data-dd-action': 'open',
        text: safeText(config.launcherLabel)
      });
      d.body.appendChild(launcher);
    }

    function onClick(e) {
      var t = e.target;

      // overlay click close
      if (overlay && t && t.getAttribute && t.getAttribute('data-dd') === 'overlay') {
        close();
        return;
      }

      // bubble to action
      while (t && t !== d.body && !(t.getAttribute && t.getAttribute('data-dd-action'))) {
        t = t.parentNode;
      }
      if (!t || !t.getAttribute) return;

      var action = t.getAttribute('data-dd-action');

      if (action === 'open') {
        // launcher -> modal
        if (!overlay) openModal();
      } else if (action === 'close') {
        close();
      } else if (action === 'select') {
        var val = t.getAttribute('data-dd-value');
        state.resultCache = null;
        goNextSingle(val);
      } else if (action === 'next_multi') {
        state.resultCache = null;
        goNextMulti();
      } else if (action === 'back') {
        state.resultCache = null;
        goBack();
      } else if (action === 'reset') {
        reset();
      } else if (action === 'cta') {
        var payload = { answers: extend({}, state.answers), result: state.resultCache || null };
        callHook('onCtaClick', payload);
        // 遷移はaタグの既定動作に任せる
      } else if (action === 'toggle') {
        // checkbox label clickは既定でトグルされる
      }
    }

    function init() {
      d.addEventListener('click', onClick, true);

      // mountがあれば embed (or modal直置き)
      if (mountEl) {
        if (config.mode === 'modal') openModal();
        else openEmbed();
        return;
      }

      // mount無し: launcher運用（floatdock思想）
      ensureLauncher();
    }

    init();

    return {
      open: function () { if (!overlay) openModal(); },
      close: close,
      reset: reset,
      getAnswers: function () { return extend({}, state.answers); }
    };
  }

  w.diagnosticDock = function (config) {
    return new DiagnosticDock(config);
  };

})(window, document);
