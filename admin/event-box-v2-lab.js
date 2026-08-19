(function () {
  'use strict';

  const state = {
    baselines: [], baseline: null, currentAssembly: null,
    fanLoveAssembly: null, personaMailAssembly: null,
  };
  const byId = (id) => document.getElementById(id);
  const els = {};
  [
    'baselineSelect','baselineMeta','testKind','mode','allowedTypes','nickname','gender','bio','fanNickname','fanName','latestPost',
    'occasionDate','holidayName','holidayHint','occasionUseSupportingPost','birthdayConfirmed','previousVoiceStyle','batchSeed','runCount','apiKey',
    'maxTokens','temperature','assembleBtn','runBtn','runTypesBtn','rebuildCurrentBtn','generateCurrentBtn','currentSystemPrompt','currentUserPrompt',
    'currentPromptMeta','currentPromptOutput','labError','originalBadge','originalOutput','originalPrompt','batchMeta','experimentList',
    'fanLoveDisplayName','fanLoveGender','fanLoveBio','fanLoveFanNickname','fanLoveFanName','fanLoveMemory','fanLoveVariant','fanLoveSeed',
    'fanLoveApiKey','fanLoveMaxTokens','fanLoveTemperature','fanLoveAssembleBtn','fanLoveGenerateBtn','fanLoveRunVariantsBtn','fanLovePrompt',
    'fanLovePromptBadge','fanLoveMeta','fanLoveOutput','fanLoveVariantResults','fanLoveError',
    'personaDisplayName','personaSetting','personaBaseVoice','personaPrivateExtension','personaPrivateTurns','personaRecentPost','personaMailApiKey',
    'personaMailMaxTokens','personaMailTemperature','personaMailAssembleBtn','personaMailGenerateBtn','personaMailPrompt','personaMailPromptBadge',
    'personaMailMeta','personaMailOutput','personaMailError',
    'authGate','authForm','authUsername','authPassword','authSubmit','authError',
  ].forEach((id) => { els[id] = byId(id); });
  for (let i = 1; i <= 4; i += 1) {
    els[`fanLovePostId${i}`] = byId(`fanLovePostId${i}`);
    els[`fanLovePost${i}`] = byId(`fanLovePost${i}`);
  }

  async function apiJson(url, options = {}) {
    if (window.StarletPromptLabRuntime?.request && String(url).includes('/api/')) {
      return window.StarletPromptLabRuntime.request(url, options);
    }
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) throw new Error(data.error || `请求失败：${response.status}`);
    return data;
  }

  function postJson(url, payload) {
    return apiJson(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = String(text);
    return node;
  }

  function showError(target, message) {
    if (!target) return;
    target.textContent = message || '';
    target.classList.toggle('hidden', !message);
  }

  function usageMeta(response) {
    const usage = response?.usage;
    return `${response?.model || ''}${usage ? ` ｜ 输入 ${usage.prompt_tokens || 0} / 输出 ${usage.completion_tokens || 0} tokens` : ''}`;
  }

  function activatePanel(name) {
    document.querySelectorAll('.lab-panel').forEach((panel) => panel.classList.toggle('active', panel.dataset.panelName === name));
    document.querySelectorAll('.lab-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.panel === name));
    if (window.history?.replaceState) window.history.replaceState(null, '', `#${name}`);
  }

  function normalizeOutput(output) {
    if (!output || typeof output !== 'object') return null;
    return {
      title: output.title || '', subtitle: output.subtitle || output.chapter_subtitle || '',
      body: output.body || output.description || '', responses: output.responses || output.response_options || [],
      series: output.series || null,
    };
  }

  function renderEventResult(container, rawOutput) {
    container.innerHTML = '';
    const output = normalizeOutput(rawOutput);
    if (!output) {
      container.appendChild(element('div', 'experiment-state', '没有可展示的结构化输出'));
      return;
    }
    container.appendChild(element('div', 'event-title', output.title || '（无标题）'));
    if (output.subtitle) container.appendChild(element('div', 'event-subtitle', output.subtitle));
    container.appendChild(element('p', 'event-body', output.body || '（无正文）'));
    const responses = element('ol', 'event-responses');
    (Array.isArray(output.responses) ? output.responses : []).forEach((item, index) => responses.appendChild(element('li', '', `${index + 1}. ${item}`)));
    container.appendChild(responses);
    if (output.series) container.appendChild(element('div', 'series-debug', `series: ${JSON.stringify(output.series)}`));
  }

  function renderOriginal() {
    const baseline = state.baseline;
    if (!baseline) return;
    els.originalBadge.textContent = `${baseline.id} · ${baseline.mode}`;
    els.baselineMeta.textContent = `${baseline.sourceKind} → ${baseline.testKind} ｜ 输入保真：${baseline.fidelity.input}`;
    els.testKind.value = baseline.testKind;
    els.mode.value = baseline.mode;
    els.allowedTypes.value = 'A,B,C';
    els.occasionDate.value = baseline.eventDate || els.occasionDate.value;
    els.nickname.value = baseline.nickname || '';
    els.gender.value = baseline.gender || '';
    els.bio.value = baseline.bio || baseline.profile || '';
    els.fanNickname.value = baseline.fanNickname || '';
    els.fanName.value = baseline.fanName || '';
    els.latestPost.value = baseline.latestPost || '';
    els.originalPrompt.textContent = baseline.originalPrompt || '';
    renderEventResult(els.originalOutput, baseline.originalOutput);
  }

  function collectEventPayload() {
    return {
      count: Math.max(1, Math.min(Number(els.runCount.value) || 3, 6)),
      batchSeed: els.batchSeed.value.trim() || 'event-box-v2-test', apiKey: els.apiKey.value.trim(),
      maxTokens: Number(els.maxTokens.value) || 4096, temperature: Number(els.temperature.value),
      input: {
        testKind: els.testKind.value, mode: els.mode.value,
        allowedTypes: els.allowedTypes.value.split(',').map((item) => item.trim()).filter(Boolean),
        nickname: els.nickname.value, gender: els.gender.value, bio: els.bio.value,
        fanNickname: els.fanNickname.value, fanName: els.fanName.value, latestPost: els.latestPost.value,
        occasionDate: els.occasionDate.value, holidayName: els.holidayName.value, holidayHint: els.holidayHint.value,
        occasionUseSupportingPost: els.occasionUseSupportingPost.checked,
        birthdayConfirmed: els.birthdayConfirmed.checked,
        history: els.previousVoiceStyle.value ? [{ voice_style: els.previousVoiceStyle.value }] : [],
        eventDate: els.occasionDate.value, sourceEvent: state.baseline?.sourceEvent || null,
      },
    };
  }

  function addVariable(list, label, value) {
    const wrapper = document.createElement('div');
    wrapper.appendChild(element('dt', '', label)); wrapper.appendChild(element('dd', '', value || '—')); list.appendChild(wrapper);
  }

  function renderEventModelResult(container, item) {
    container.innerHTML = '';
    if (item.error) {
      container.appendChild(element('div', 'experiment-state failed', `${item.error.code || 'ERROR'}: ${item.error.message || item.error}`));
      return;
    }
    if (item.parsedOutput?.value) renderEventResult(container, item.parsedOutput.value);
    else {
      container.appendChild(element('div', 'experiment-state failed', `模型返回了非 JSON：${item.parsedOutput?.error || '未知解析错误'}`));
      container.appendChild(element('pre', 'deepseek-output', item.response?.content || ''));
    }
    container.appendChild(element('div', 'meta result-meta', usageMeta(item.response)));
  }

  function renderExperiment(item, index, hasModelOutput) {
    const assembly = item.assembly || item;
    const card = element('article', 'experiment-card');
    const variables = element('aside', 'experiment-variables');
    const type = assembly.variables?.type;
    variables.appendChild(element('span', 'run-badge', type ? `TYPE ${type}` : `RUN ${index + 1}`));
    const list = element('dl', 'variable-list');
    addVariable(list, 'Seed', assembly.seed); addVariable(list, 'Type', assembly.variables?.typeLabel);
    addVariable(list, 'Mode', assembly.variables?.modeLabel); addVariable(list, 'Tone', assembly.variables?.tone);
    addVariable(list, 'Plot', assembly.variables?.plot); addVariable(list, 'Causality', assembly.variables?.causality);
    addVariable(list, 'Layer 4', assembly.variables?.voiceStyle); addVariable(list, 'Route', assembly.variables?.route);
    addVariable(list, 'Prompt', assembly.variables?.promptVersion);
    variables.appendChild(list); card.appendChild(variables);

    const output = element('section', 'experiment-output');
    const resultContainer = element('div', 'single-run-result');
    if (hasModelOutput) renderEventModelResult(resultContainer, item);
    else resultContainer.appendChild(element('div', 'experiment-state', 'Prompt 已组装；可在下方继续修改后单独生成。'));
    output.appendChild(resultContainer);

    const details = element('details', 'prompt-disclosure');
    details.appendChild(element('summary', '', '查看并编辑本次 System / User Prompt'));
    const pair = element('div', 'prompt-pair');
    const system = element('label', 'field'); system.appendChild(element('span', '', 'SYSTEM'));
    const systemEditor = element('textarea', 'prompt-output'); systemEditor.rows = 16; systemEditor.value = assembly.systemPrompt; system.appendChild(systemEditor);
    const user = element('label', 'field'); user.appendChild(element('span', '', 'USER'));
    const userEditor = element('textarea', 'prompt-output'); userEditor.rows = 16; userEditor.value = assembly.userPrompt; user.appendChild(userEditor);
    pair.appendChild(system); pair.appendChild(user); details.appendChild(pair); output.appendChild(details);
    const generateButton = element('button', 'card-generate', '用修改后的 Prompt 生成'); generateButton.type = 'button';
    generateButton.addEventListener('click', () => generateEditedEventPrompt({ button: generateButton, resultContainer, systemEditor, userEditor }));
    output.appendChild(generateButton); card.appendChild(output); return card;
  }

  async function generateEditedEventPrompt({ button, resultContainer, systemEditor, userEditor }) {
    showError(els.labError, '');
    if (!els.apiKey.value.trim()) { showError(els.labError, '请先填写硅基流动 API Key'); els.apiKey.focus(); return; }
    const idleLabel = button.textContent; button.disabled = true; button.textContent = '生成中…';
    resultContainer.innerHTML = '<div class="experiment-state">正在调用 DeepSeek V3.2…</div>';
    try {
      const data = await postJson('/api/event-box-v2/generate', {
        apiKey: els.apiKey.value.trim(), systemPrompt: systemEditor.value, userPrompt: userEditor.value,
        maxTokens: Number(els.maxTokens.value) || 4096, temperature: Number(els.temperature.value),
      });
      renderEventModelResult(resultContainer, data.result || {});
    } catch (error) {
      resultContainer.innerHTML = ''; resultContainer.appendChild(element('div', 'experiment-state failed', error.message || '生成失败'));
    } finally { button.disabled = false; button.textContent = idleLabel; }
  }

  function renderExperiments(items, batchSeed, hasModelOutput) {
    els.experimentList.innerHTML = '';
    items.forEach((item, index) => els.experimentList.appendChild(renderExperiment(item, index, hasModelOutput)));
    els.batchMeta.textContent = `${items.length} 组 ｜ batch seed: ${batchSeed}`;
  }

  async function rebuildCurrentPrompt() {
    showError(els.labError, '');
    const payload = collectEventPayload(); payload.count = 1; payload.batchSeed = `${payload.batchSeed}:current:${Date.now()}`;
    const data = await postJson('/api/event-box-v2/assemble', payload);
    state.currentAssembly = data.assemblies?.[0] || null;
    if (!state.currentAssembly) throw new Error('当前 Prompt 组装为空');
    els.currentSystemPrompt.value = state.currentAssembly.systemPrompt;
    els.currentUserPrompt.value = state.currentAssembly.userPrompt;
    els.currentPromptMeta.textContent = `${state.currentAssembly.variables.typeLabel} ｜ ${state.currentAssembly.variables.modeLabel} ｜ ${state.currentAssembly.variables.tone} ｜ ${state.currentAssembly.variables.plot} ｜ Layer 4：${state.currentAssembly.variables.voiceStyle} ｜ ${state.currentAssembly.variables.promptVersion}`;
  }

  async function loadBaseline(id) {
    showError(els.labError, '');
    const data = await apiJson(`/api/event-box-v2/baseline?id=${encodeURIComponent(id)}`);
    state.baseline = data.baseline; renderOriginal();
    els.experimentList.innerHTML = '<div class="empty-state">共同输入已固定。可随机组装，或填写 API Key 一键跑 A–E。</div>';
    els.batchMeta.textContent = '尚未运行';
    await rebuildCurrentPrompt();
  }

  async function loadBaselines() {
    const health = await apiJson('/api/health');
    els.previousVoiceStyle.innerHTML = '<option value="">无上一集口吻</option>';
    (health.voiceStyles || []).forEach((voice) => {
      const option = document.createElement('option'); option.value = voice.code; option.textContent = `${voice.label} · ${voice.guidance}`;
      els.previousVoiceStyle.appendChild(option);
    });
    const data = await apiJson('/api/event-box-v2/baselines'); state.baselines = data.baselines || [];
    els.baselineSelect.innerHTML = '';
    state.baselines.forEach((baseline) => {
      const option = document.createElement('option'); option.value = baseline.id;
      option.textContent = `${baseline.id} · ${baseline.sourceKind} · ${baseline.originalTitle || '无标题'}`; els.baselineSelect.appendChild(option);
    });
    const preferred = state.baselines.find((item) => item.id === 'event_02' && item.testKind === 'opening')
      || state.baselines.find((item) => item.testKind === 'opening') || state.baselines[0];
    if (preferred) { els.baselineSelect.value = preferred.id; await loadBaseline(preferred.id); }
  }

  async function assembleEventOnly() {
    showError(els.labError, ''); els.assembleBtn.disabled = true;
    try {
      const payload = collectEventPayload();
      const data = await postJson('/api/event-box-v2/assemble', payload);
      renderExperiments(data.assemblies || [], data.batchSeed, false);
    } catch (error) { showError(els.labError, error.message || '组装失败'); } finally { els.assembleBtn.disabled = false; }
  }

  async function runEventEndpoint({ endpoint, button, loadingText, emptyText, restoreText }) {
    showError(els.labError, '');
    if (!els.apiKey.value.trim()) { showError(els.labError, '请先填写硅基流动 API Key'); els.apiKey.focus(); return; }
    button.disabled = true; button.textContent = loadingText; els.experimentList.innerHTML = `<div class="empty-state">${emptyText}</div>`;
    try {
      const payload = collectEventPayload();
      const data = await postJson(endpoint, payload);
      renderExperiments(data.results || [], data.batchSeed, true);
    } catch (error) { showError(els.labError, error.message || '批量测试失败'); }
    finally { button.disabled = false; button.textContent = restoreText; }
  }

  function collectFanLoveInput() {
    const sources = [];
    for (let i = 1; i <= 4; i += 1) {
      const content = els[`fanLovePost${i}`].value.trim();
      if (!content) continue;
      sources.push({ id: els[`fanLovePostId${i}`].value.trim() || `post-${i}`, content });
    }
    return {
      seed: els.fanLoveSeed.value.trim() || 'fan-love-lab', variantId: els.fanLoveVariant.value,
      profile: {
        display_name: els.fanLoveDisplayName.value, gender: els.fanLoveGender.value, bio: els.fanLoveBio.value,
        fan_nickname: els.fanLoveFanNickname.value, fan_name: els.fanLoveFanName.value,
        long_term_memory: els.fanLoveMemory.value,
      },
      sources,
    };
  }

  async function assembleFanLovePrompt() {
    showError(els.fanLoveError, '');
    const data = await postJson('/api/fan-love/assemble', { input: collectFanLoveInput() });
    state.fanLoveAssembly = data.assembly;
    els.fanLovePrompt.value = data.assembly.prompt;
    els.fanLovePromptBadge.textContent = `${data.assembly.variant.label} · ${Math.round(data.assembly.variant.weight * 100)}%`;
    els.fanLoveMeta.textContent = `${data.assembly.sources.length} 条 Post ｜ ${data.assembly.allowedPostIds.join(', ')} ｜ production: ${data.assembly.generation.maxTokens} tokens / temp ${data.assembly.generation.temperature}`;
    return data.assembly;
  }

  function renderFanLoveResult(container, result, assembly) {
    container.innerHTML = '';
    const parsed = result?.parsedOutput;
    if (parsed?.value) {
      const value = parsed.value;
      const card = element('article', 'letter-card');
      if (value.text === null) {
        card.appendChild(element('div', 'event-title', '跳过生成'));
        card.appendChild(element('p', 'fan-love-text', value.reason || '素材不足'));
      } else {
        card.appendChild(element('p', 'fan-love-text', value.text));
        card.appendChild(element('div', 'meta result-meta', `evidence: ${(value.evidencePostIds || []).join(', ')} ｜ multiple: ${String(value.basedOnMultiplePosts)}`));
      }
      card.appendChild(element('div', 'contract-pass', '✓ 已通过生产 fanLoveWritingContract 输出校验'));
      container.appendChild(card);
    } else {
      const card = element('article', 'letter-card');
      card.appendChild(element('div', 'contract-fail', `✕ 生产合同校验失败：${parsed?.error || '模型未返回可解析输出'}`));
      card.appendChild(element('pre', 'deepseek-output', result?.response?.content || ''));
      container.appendChild(card);
    }
    container.appendChild(element('div', 'meta result-meta', `${assembly?.variant?.label || ''} ｜ ${usageMeta(result?.response)}`));
  }

  async function generateFanLove() {
    showError(els.fanLoveError, '');
    if (!els.fanLoveApiKey.value.trim()) { showError(els.fanLoveError, '请先填写硅基流动 API Key'); els.fanLoveApiKey.focus(); return; }
    const button = els.fanLoveGenerateBtn; const idle = button.textContent; button.disabled = true; button.textContent = '生成中…';
    els.fanLoveOutput.innerHTML = '<div class="experiment-state">正在调用 DeepSeek V3.2，并按生产合同解析…</div>';
    try {
      const assembly = state.fanLoveAssembly || await assembleFanLovePrompt();
      const data = await postJson('/api/fan-love/generate', {
        apiKey: els.fanLoveApiKey.value.trim(), prompt: els.fanLovePrompt.value, assembly,
        maxTokens: Number(els.fanLoveMaxTokens.value) || 520, temperature: Number(els.fanLoveTemperature.value),
      });
      renderFanLoveResult(els.fanLoveOutput, data.result, data.assembly);
    } catch (error) { showError(els.fanLoveError, error.message || '粉丝爱意生成失败'); }
    finally { button.disabled = false; button.textContent = idle; }
  }

  async function runFanLoveVariants() {
    showError(els.fanLoveError, '');
    if (!els.fanLoveApiKey.value.trim()) { showError(els.fanLoveError, '请先填写硅基流动 API Key'); els.fanLoveApiKey.focus(); return; }
    const button = els.fanLoveRunVariantsBtn; const idle = button.textContent; button.disabled = true; button.textContent = '四风格生成中…';
    els.fanLoveVariantResults.innerHTML = '<div class="empty-state">同一组 Profile / Post 正在并行跑四套生产 Prompt…</div>';
    try {
      const data = await postJson('/api/fan-love/run-variants', {
        apiKey: els.fanLoveApiKey.value.trim(), input: collectFanLoveInput(),
        maxTokens: Number(els.fanLoveMaxTokens.value) || 520, temperature: Number(els.fanLoveTemperature.value),
      });
      els.fanLoveVariantResults.innerHTML = '';
      (data.results || []).forEach((item) => {
        const card = element('article', 'variant-card');
        card.appendChild(element('span', 'run-badge', `${item.assembly.variant.label} · ${Math.round(item.assembly.variant.weight * 100)}%`));
        card.appendChild(element('h3', '', item.assembly.variant.label));
        const output = element('div', 'variant-result'); renderFanLoveResult(output, item.result, item.assembly); card.appendChild(output);
        const details = element('details', 'prompt-disclosure'); details.appendChild(element('summary', '', '查看本风格生产 Prompt'));
        details.appendChild(element('pre', '', item.assembly.prompt)); card.appendChild(details);
        els.fanLoveVariantResults.appendChild(card);
      });
    } catch (error) { showError(els.fanLoveError, error.message || '四风格测试失败'); }
    finally { button.disabled = false; button.textContent = idle; }
  }

  function parsePrivateTurns(raw) {
    const turns = [];
    String(raw || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).forEach((line, index) => {
      const match = line.match(/^\[?(user|persona)\]?\s*[:：]\s*(.+)$/i);
      if (!match) return;
      turns.push({ id: `turn-${index + 1}`, from: match[1].toLowerCase() === 'user' ? 'user' : 'persona', content: match[2] });
    });
    return turns;
  }

  function collectPersonaInput() {
    return {
      persona: {
        id: 'prompt-lab-persona', display_name: els.personaDisplayName.value,
        setting: els.personaSetting.value, base_voice_style: els.personaBaseVoice.value,
      },
      private_extension: els.personaPrivateExtension.value,
      privateTurns: parsePrivateTurns(els.personaPrivateTurns.value),
      recent_public_post: els.personaRecentPost.value,
      sessionId: 'prompt-lab-session', threadId: 'prompt-lab-thread',
    };
  }

  async function assemblePersonaMailPrompt() {
    showError(els.personaMailError, '');
    const data = await postJson('/api/persona-mail/assemble', { input: collectPersonaInput() });
    state.personaMailAssembly = data.assembly;
    els.personaMailPrompt.value = data.assembly.prompt;
    els.personaMailPromptBadge.textContent = `${data.assembly.persona.displayName} · ${data.assembly.relationship.privateTurns.length} turns`;
    els.personaMailMeta.textContent = `${data.assembly.relationship.privateTurns.length ? '已有私聊关系' : '无私聊历史'} ｜ ${data.assembly.recentPost ? '含 recent public post' : '无 public post'} ｜ private extension: ${data.assembly.persona.privateExtension ? 'yes' : 'no'} ｜ production: ${data.assembly.generation.maxTokens} / temp ${data.assembly.generation.temperature}`;
    return data.assembly;
  }

  function renderPersonaMailResult(container, result, assembly) {
    container.innerHTML = '';
    const parsed = result?.parsedOutput;
    if (parsed?.value) {
      const value = parsed.value;
      const card = element('article', 'letter-card');
      card.appendChild(element('h3', '', value.title));
      card.appendChild(element('div', 'letter-preview', value.preview));
      const body = element('div', 'letter-body');
      (value.paragraphs || []).forEach((paragraph) => body.appendChild(element('p', '', paragraph)));
      card.appendChild(body);
      card.appendChild(element('div', 'letter-signature', value.signature));
      card.appendChild(element('div', 'contract-pass', '✓ 已通过生产 personaMailPrompt 输出校验'));
      container.appendChild(card);
    } else {
      const card = element('article', 'letter-card');
      card.appendChild(element('div', 'contract-fail', `✕ 生产合同校验失败：${parsed?.error || '模型未返回可解析输出'}`));
      card.appendChild(element('pre', 'deepseek-output', result?.response?.content || ''));
      container.appendChild(card);
    }
    container.appendChild(element('div', 'meta result-meta', `${assembly?.persona?.displayName || ''} ｜ ${usageMeta(result?.response)}`));
  }

  async function generatePersonaMail() {
    showError(els.personaMailError, '');
    if (!els.personaMailApiKey.value.trim()) { showError(els.personaMailError, '请先填写硅基流动 API Key'); els.personaMailApiKey.focus(); return; }
    const button = els.personaMailGenerateBtn; const idle = button.textContent; button.disabled = true; button.textContent = '生成中…';
    els.personaMailOutput.innerHTML = '<div class="experiment-state">正在调用 DeepSeek V3.2，并按生产合同解析…</div>';
    try {
      const assembly = state.personaMailAssembly || await assemblePersonaMailPrompt();
      const data = await postJson('/api/persona-mail/generate', {
        apiKey: els.personaMailApiKey.value.trim(), prompt: els.personaMailPrompt.value, assembly,
        maxTokens: Number(els.personaMailMaxTokens.value) || 760, temperature: Number(els.personaMailTemperature.value),
      });
      renderPersonaMailResult(els.personaMailOutput, data.result, data.assembly);
    } catch (error) { showError(els.personaMailError, error.message || '人设来信生成失败'); }
    finally { button.disabled = false; button.textContent = idle; }
  }

  function bindApiKeySync() {
    const keys = [els.apiKey, els.fanLoveApiKey, els.personaMailApiKey].filter(Boolean);
    keys.forEach((input) => input.addEventListener('input', () => {
      keys.forEach((other) => { if (other !== input) other.value = input.value; });
    }));
  }

  function bindEvents() {
    document.querySelectorAll('.lab-tab').forEach((tab) => tab.addEventListener('click', () => activatePanel(tab.dataset.panel)));
    els.baselineSelect.addEventListener('change', () => loadBaseline(els.baselineSelect.value).catch((error) => showError(els.labError, error.message)));
    els.assembleBtn.addEventListener('click', assembleEventOnly);
    els.rebuildCurrentBtn.addEventListener('click', () => rebuildCurrentPrompt().catch((error) => showError(els.labError, error.message)));
    els.generateCurrentBtn.addEventListener('click', () => generateEditedEventPrompt({ button: els.generateCurrentBtn, resultContainer: els.currentPromptOutput,
      systemEditor: els.currentSystemPrompt, userEditor: els.currentUserPrompt }));
    els.runBtn.addEventListener('click', () => runEventEndpoint({ endpoint: '/api/event-box-v2/run', button: els.runBtn,
      loadingText: '批量生成中…', emptyText: '模型正在逐组生成…', restoreText: '批量生成' }));
    els.runTypesBtn.addEventListener('click', () => runEventEndpoint({ endpoint: '/api/event-box-v2/run-types', button: els.runTypesBtn,
      loadingText: 'A–E 生成中…', emptyText: '正在并行生成 Type A、B、C、D、E…', restoreText: '一键跑 A–E' }));

    els.fanLoveAssembleBtn.addEventListener('click', () => assembleFanLovePrompt().catch((error) => showError(els.fanLoveError, error.message)));
    els.fanLoveGenerateBtn.addEventListener('click', generateFanLove);
    els.fanLoveRunVariantsBtn.addEventListener('click', runFanLoveVariants);
    els.personaMailAssembleBtn.addEventListener('click', () => assemblePersonaMailPrompt().catch((error) => showError(els.personaMailError, error.message)));
    els.personaMailGenerateBtn.addEventListener('click', generatePersonaMail);
    bindApiKeySync();
  }

  function revealPromptLab() {
    document.body.classList.remove('prompt-lab-locked');
    els.authGate?.setAttribute('aria-hidden', 'true');
  }

  async function waitForAccess() {
    const runtime = window.StarletPromptLabRuntime;
    if (!runtime?.unlock) {
      revealPromptLab();
      return;
    }

    await new Promise((resolve) => {
      const submit = async (event) => {
        event.preventDefault();
        showError(els.authError, '');
        const username = els.authUsername.value.trim();
        const password = els.authPassword.value;
        if (!username || !password) {
          showError(els.authError, '请输入账号和密码');
          return;
        }
        const idle = els.authSubmit.textContent;
        els.authSubmit.disabled = true;
        els.authSubmit.textContent = '正在解锁…';
        try {
          await runtime.unlock({ username, password });
          els.authPassword.value = '';
          revealPromptLab();
          resolve();
        } catch (error) {
          els.authPassword.value = '';
          showError(els.authError, error?.message || '账号或密码错误');
          els.authPassword.focus();
        } finally {
          els.authSubmit.disabled = false;
          els.authSubmit.textContent = idle;
        }
      };
      els.authForm.addEventListener('submit', submit);
      window.setTimeout(() => els.authUsername?.focus(), 0);
    });
  }

  async function boot() {
    await waitForAccess();
    bindEvents();
    const requestedPanel = String(window.location.hash || '').replace(/^#/, '');
    if (['event', 'fan-love', 'persona-mail'].includes(requestedPanel)) activatePanel(requestedPanel);
    const tasks = [
      loadBaselines().catch((error) => showError(els.labError, error.message || 'baseline 加载失败')),
      assembleFanLovePrompt().catch((error) => showError(els.fanLoveError, error.message || '粉丝爱意 Prompt 组装失败')),
      assemblePersonaMailPrompt().catch((error) => showError(els.personaMailError, error.message || '人设来信 Prompt 组装失败')),
    ];
    await Promise.all(tasks);
  }

  boot();
}());
