(function () {
  'use strict';

  const state = {
    baselines: [], baseline: null, currentAssembly: null,
    fanLoveAssembly: null, fanLoveVariants: [], fanLoveVariantEdits: {}, fanLoveVariantResults: {}, fanLoveSelectedVariantId: '', personaMailAssembly: null,
    fanLoveSamples: [], fanLoveSample: null,
    personaMailSamples: [], personaMailSample: null,
  };
  const byId = (id) => document.getElementById(id);
  const els = {};
  [
    'baselineSelect','baselineMeta','testKind','mode','allowedTypes','nickname','gender','bio','fanNickname','fanName','latestPost',
    'occasionDate','holidayName','holidayHint','occasionUseSupportingPost','birthdayConfirmed','previousVoiceStyle','batchSeed','runCount','apiKey',
    'maxTokens','temperature','assembleBtn','runBtn','runTypesBtn','rebuildCurrentBtn','generateCurrentBtn','currentSystemPrompt','currentUserPrompt',
    'currentPromptMeta','currentPromptOutput','labError','originalBadge','originalOutput','originalPrompt','batchMeta','experimentList',
    'fanLoveNickname','fanLoveSeed',
    'fanLoveApiKey','fanLoveMaxTokens','fanLoveTemperature','fanLoveAssembleBtn','fanLoveGenerateBtn','fanLoveRunVariantsBtn',
    'fanLovePromptBadge','fanLoveMeta','fanLoveOutput','fanLoveVariantPromptGrid','fanLoveError',
    'fanLoveSampleSelect','fanLoveSampleMeta','fanLoveRealMaterial','fanLoveOriginalOutput',
    'personaDisplayName','personaSetting','personaBaseVoice','personaPrivateExtension','personaPrivateTurns','personaRecentPost','personaMailScenario','personaMailApiKey',
    'personaMailMaxTokens','personaMailTemperature','personaMailAssembleBtn','personaMailGenerateBtn','personaMailPrompt','personaMailPromptBadge',
    'personaMailMeta','personaMailOutput','personaMailOriginalPrompt','personaMailError',
    'personaMailSampleSelect','personaMailSampleMeta','personaMailRealMaterial','personaMailOriginalOutput',
    'authGate','authForm','authUsername','authPassword','authSubmit','authError',
  ].forEach((id) => { els[id] = byId(id); });
  for (let i = 1; i <= 3; i += 1) {
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

  function renderHistoricalOutput(container, value, emptyText) {
    if (!container) return;
    const text = String(value || '').trim();
    container.textContent = text || emptyText;
    container.classList.toggle('empty', !text);
  }

  function renderRealMaterial(container, sample) {
    if (!container) return;
    container.textContent = JSON.stringify({ source: sample?.source || null, input: sample?.input || null }, null, 2);
  }

  function personaTurnsFromRealSample(sample) {
    const rawTurns = Array.isArray(sample?.input?.private_turns) ? sample.input.private_turns : [];
    const lines = rawTurns
      .filter((turn) => String(turn?.content || '').trim())
      .map((turn) => `${turn.role === 'user' ? 'user' : 'persona'}: ${String(turn.content).trim()}`);
    const userInput = String(sample?.input?.user_input || '').trim();
    if (userInput) lines.push(`user: ${userInput}`);
    return lines.join('\n');
  }

  async function applyFanLoveRealSample(id) {
    const data = await apiJson(`/api/letters-real-sample?id=${encodeURIComponent(id)}`);
    const sample = data.sample;
    state.fanLoveSample = sample;
    const profile = sample?.input?.profile || {};
    const posts = Array.isArray(sample?.input?.posts) ? sample.input.posts.slice(0, 3) : [];
    const nicknameAndInfo = [
      profile.display_name,
      profile.gender ? `性别：${profile.gender}` : '',
      profile.bio ? `简介：${profile.bio}` : '',
      profile.fan_nickname ? `粉丝称呼：${profile.fan_nickname}` : '',
      profile.fan_name ? `粉丝团：${profile.fan_name}` : '',
    ].filter(Boolean).join('\n');
    els.fanLoveNickname.value = nicknameAndInfo;
    for (let index = 1; index <= 3; index += 1) {
      const post = posts[index - 1] || {};
      els[`fanLovePostId${index}`].value = post.id || '';
      els[`fanLovePost${index}`].value = post.content || '';
    }
    els.fanLoveSeed.value = `real:${sample.lab_id}`;
    els.fanLoveSampleMeta.textContent = `${sample.lab_id} ｜ source ${sample?.source?.source_id || '—'} ｜ ${sample?.source?.created_at || '—'} ｜ 已载入 ${posts.length} 条真实 Post`;
    renderRealMaterial(els.fanLoveRealMaterial, {
      source: sample?.source || null,
      input: {
        nickname: nicknameAndInfo,
        post_content: posts.map((post, index) => `【帖子 ${index + 1}｜${post.id || `post-${index + 1}`}】\n${post.content || ''}`).join('\n\n'),
        posts,
      },
    });
    renderHistoricalOutput(els.fanLoveOriginalOutput, sample.original_output, '这条样本没有原流程输出。');
    els.fanLoveOutput.innerHTML = '<div class="experiment-state">已切换真实样本；可直接编辑四张 Prompt 卡片。</div>';
    await assembleFanLoveVariants();
  }

  async function loadFanLoveRealSamples() {
    const data = await apiJson('/api/letters-real-samples?kind=fan_love');
    state.fanLoveSamples = data.samples || [];
    els.fanLoveSampleSelect.innerHTML = '';
    state.fanLoveSamples.forEach((item, index) => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = `${String(index + 1).padStart(2, '0')} · ${item.profileName || '未命名'} · ${item.postCount} Post`;
      els.fanLoveSampleSelect.appendChild(option);
    });
    if (state.fanLoveSamples[0]) {
      els.fanLoveSampleSelect.value = state.fanLoveSamples[0].id;
      await applyFanLoveRealSample(state.fanLoveSamples[0].id);
    }
  }

  async function applyPersonaMailRealSample(id) {
    const data = await apiJson(`/api/letters-real-sample?id=${encodeURIComponent(id)}`);
    const sample = data.sample;
    state.personaMailSample = sample;
    const input = sample?.input || {};
    const persona = input.persona || {};
    els.personaDisplayName.value = persona.name || '';
    els.personaSetting.value = persona.persona_prompt || '';
    els.personaBaseVoice.value = persona.speaking_style || '';
    els.personaPrivateExtension.value = input.private_extension || '';
    els.personaPrivateTurns.value = personaTurnsFromRealSample(sample);
    els.personaMailScenario.value = Array.isArray(input.private_turns) && input.private_turns.length ? 'recent_chat' : 'first_letter';
    const recentPost = input.recent_post;
    els.personaRecentPost.value = typeof recentPost === 'string'
      ? recentPost
      : (recentPost?.content || recentPost?.user_text || '');
    const rawTurnCount = Array.isArray(input.private_turns) ? input.private_turns.length : 0;
    const contentTurnCount = Array.isArray(input.private_turns)
      ? input.private_turns.filter((turn) => String(turn?.content || '').trim()).length
      : 0;
    const injectedUserInput = Boolean(String(input.user_input || '').trim());
    els.personaMailSampleMeta.textContent = `${sample.lab_id} ｜ ${persona.name || '未命名 Character'} ｜ 导出 private_turns ${rawTurnCount} 条 / 有正文 ${contentTurnCount} 条${injectedUserInput ? ' ｜ user_input 已作为最新 user turn 注入测试' : ''}`;
    renderRealMaterial(els.personaMailRealMaterial, sample);
    renderHistoricalOutput(els.personaMailOriginalOutput, sample.historical_output || sample.original_output, '这 15 条 persona_mail 样本在导出文件中没有历史原信输出。');
    els.personaMailOutput.innerHTML = '<div class="experiment-state">已切换真实样本；生成后这里显示新版人设来信输出。</div>';
    await assemblePersonaMailPrompt();
  }

  async function loadPersonaMailRealSamples() {
    const data = await apiJson('/api/letters-real-samples?kind=persona_mail');
    state.personaMailSamples = data.samples || [];
    els.personaMailSampleSelect.innerHTML = '';
    state.personaMailSamples.forEach((item, index) => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = `${String(index + 1).padStart(2, '0')} · ${item.personaName || '未命名 Character'} · ${item.privateTurnCount} turns`;
      els.personaMailSampleSelect.appendChild(option);
    });
    if (state.personaMailSamples[0]) {
      els.personaMailSampleSelect.value = state.personaMailSamples[0].id;
      await applyPersonaMailRealSample(state.personaMailSamples[0].id);
    }
  }

  const FAN_LOVE_VARIANT_IDS = ['restrained', 'energetic', 'gentle', 'shy'];

  function collectFanLoveInput() {
    const nickname = els.fanLoveNickname.value.trim();
    const sources = [];
    for (let index = 1; index <= 3; index += 1) {
      const content = els[`fanLovePost${index}`].value.trim();
      if (!content) continue;
      sources.push({ id: els[`fanLovePostId${index}`].value.trim() || `post-${index}`, content });
    }
    const postContent = sources.map((source, index) => `【帖子 ${index + 1}｜${source.id}】\n${source.content}`).join('\n\n');
    return {
      seed: els.fanLoveSeed.value.trim() || 'fan-love-lab',
      nickname,
      postContent,
      profile: { display_name: nickname },
      sources,
    };
  }

  function fanLoveVariantCard(variantId) {
    return els.fanLoveVariantPromptGrid?.querySelector(`[data-fan-love-variant="${variantId}"]`) || null;
  }

  function updateFanLoveVariantBadge(variantId) {
    const card = fanLoveVariantCard(variantId);
    const assembly = state.fanLoveVariants.find((item) => item.variant.id === variantId);
    if (!card || !assembly) return;
    const badge = card.querySelector('[data-fan-love-edited-badge]');
    const edited = state.fanLoveVariantEdits[variantId] !== assembly.prompt;
    badge.textContent = edited ? '已修改' : '原始版本';
    badge.classList.toggle('edited', edited);
  }

  function renderFanLoveVariantEditors() {
    els.fanLoveVariantPromptGrid.innerHTML = '';
    state.fanLoveVariants.forEach((assembly, index) => {
      const variantId = assembly.variant.id;
      const card = element('article', 'variant-prompt-card');
      card.dataset.fanLoveVariant = variantId;

      const header = element('div', 'variant-prompt-card-header');
      const titleWrap = element('div', 'variant-prompt-title');
      titleWrap.appendChild(element('div', 'section-kicker', `STYLE ${String(index + 1).padStart(2, '0')}`));
      titleWrap.appendChild(element('h3', '', assembly.variant.label));
      titleWrap.appendChild(element('span', 'run-badge', `生产权重 ${Math.round(assembly.variant.weight * 100)}%`));
      const badge = element('span', 'edit-badge', '原始版本');
      badge.dataset.fanLoveEditedBadge = variantId;
      header.appendChild(titleWrap);
      header.appendChild(badge);
      card.appendChild(header);

      const promptPair = element('div', 'variant-prompt-pair');
      const originalColumn = element('label', 'field variant-prompt-column');
      originalColumn.appendChild(element('span', '', '原始提示词'));
      const original = element('pre', 'variant-original-prompt', assembly.prompt);
      originalColumn.appendChild(original);
      const editedColumn = element('label', 'field variant-prompt-column');
      editedColumn.appendChild(element('span', '', '当前可编辑版本'));
      const editor = element('textarea', 'variant-prompt-editor');
      editor.dataset.fanLovePrompt = variantId;
      editor.rows = 18;
      editor.spellcheck = false;
      editor.value = state.fanLoveVariantEdits[variantId] || assembly.prompt;
      editedColumn.appendChild(editor);
      promptPair.appendChild(originalColumn);
      promptPair.appendChild(editedColumn);
      card.appendChild(promptPair);

      const actions = element('div', 'variant-prompt-actions');
      const meta = element('span', 'meta', `${assembly.sources.length} 条 Post ｜ ${assembly.allowedPostIds.join(', ') || '无证据'}`);
      const button = element('button', 'card-generate', '用当前版本生成');
      button.type = 'button';
      button.dataset.fanLoveGenerateVariant = variantId;
      actions.appendChild(meta);
      actions.appendChild(button);
      card.appendChild(actions);

      const result = element('div', 'variant-prompt-result');
      result.dataset.fanLoveVariantResult = variantId;
      const previousResult = state.fanLoveVariantResults[variantId];
      if (previousResult) renderFanLoveResult(result, previousResult, assembly);
      else result.appendChild(element('div', 'experiment-state', '还没有生成结果。'));
      card.appendChild(result);
      els.fanLoveVariantPromptGrid.appendChild(card);
    });
  }

  async function assembleFanLoveVariants() {
    showError(els.fanLoveError, '');
    const input = collectFanLoveInput();
    const assemblies = await Promise.all(FAN_LOVE_VARIANT_IDS.map(async (variantId) => {
      const data = await postJson('/api/fan-love/assemble', { input: { ...input, variantId } });
      return data.assembly;
    }));
    state.fanLoveVariants = assemblies;
    state.fanLoveAssembly = assemblies[0] || null;
    state.fanLoveSelectedVariantId = state.fanLoveSelectedVariantId || assemblies[0]?.variant.id || '';
    state.fanLoveVariantResults = {};
    state.fanLoveVariantEdits = Object.fromEntries(assemblies.map((assembly) => [assembly.variant.id, assembly.prompt]));
    els.fanLovePromptBadge.textContent = `${assemblies.length} 种风格已组装`;
    els.fanLoveMeta.textContent = `${assemblies[0]?.sources.length || 0} 条 Post ｜ 每张卡都可独立修改后生成`;
    els.fanLoveOutput.innerHTML = '<div class="experiment-state">四种风格 Prompt 已组装。现在可以直接改卡片里的当前版本。</div>';
    renderFanLoveVariantEditors();
    return assemblies;
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
        card.appendChild(element('div', 'meta result-meta', `evidence: ${(value.evidencePostIds || []).join(', ')}`));
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

  async function generateFanLoveVariant(variantId) {
    showError(els.fanLoveError, '');
    if (!els.fanLoveApiKey.value.trim()) { showError(els.fanLoveError, '请先填写硅基流动 API Key'); els.fanLoveApiKey.focus(); return; }
    const assembly = state.fanLoveVariants.find((item) => item.variant.id === variantId);
    if (!assembly) {
      await assembleFanLoveVariants();
      return generateFanLoveVariant(variantId);
    }
    const card = fanLoveVariantCard(variantId);
    const button = card?.querySelector('[data-fan-love-generate-variant]');
    const resultContainer = card?.querySelector('[data-fan-love-variant-result]');
    const idle = button?.textContent || '用当前版本生成';
    if (button) { button.disabled = true; button.textContent = '生成中…'; }
    if (resultContainer) resultContainer.innerHTML = '<div class="experiment-state">正在调用 DeepSeek V3.2，并按生产合同解析…</div>';
    try {
      const data = await postJson('/api/fan-love/generate', {
        apiKey: els.fanLoveApiKey.value.trim(), prompt: state.fanLoveVariantEdits[variantId] || assembly.prompt, assembly,
        maxTokens: Number(els.fanLoveMaxTokens.value) || 520, temperature: Number(els.fanLoveTemperature.value),
      });
      state.fanLoveVariantResults[variantId] = data.result;
      if (resultContainer) renderFanLoveResult(resultContainer, data.result, data.assembly);
      els.fanLoveOutput.innerHTML = `<div class="experiment-state">${assembly.variant.label} 已使用当前编辑版本生成。</div>`;
    } catch (error) { showError(els.fanLoveError, error.message || '粉丝爱意生成失败'); }
    finally { if (button) { button.disabled = false; button.textContent = idle; } }
  }

  async function generateFanLove() {
    const variantId = state.fanLoveSelectedVariantId || state.fanLoveVariants[0]?.variant.id;
    if (variantId) await generateFanLoveVariant(variantId);
  }

  async function runFanLoveVariants() {
    showError(els.fanLoveError, '');
    if (!els.fanLoveApiKey.value.trim()) { showError(els.fanLoveError, '请先填写硅基流动 API Key'); els.fanLoveApiKey.focus(); return; }
    const button = els.fanLoveRunVariantsBtn; const idle = button.textContent; button.disabled = true; button.textContent = '四风格生成中…';
    try {
      if (!state.fanLoveVariants.length) await assembleFanLoveVariants();
      await Promise.all(state.fanLoveVariants.map((assembly) => generateFanLoveVariant(assembly.variant.id)));
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
    const basePersona = state.personaMailSample?.input?.persona || {};
    const baseProfile = state.personaMailSample?.input?.profile || {};
    const source = state.personaMailSample?.source || {};
    return {
      profile: baseProfile,
      persona: {
        ...basePersona,
        id: basePersona.id || 'prompt-lab-persona', display_name: els.personaDisplayName.value,
        name: els.personaDisplayName.value,
        setting: els.personaSetting.value, persona_prompt: els.personaSetting.value,
        base_voice_style: els.personaBaseVoice.value, speaking_style: els.personaBaseVoice.value,
      },
      private_extension: els.personaPrivateExtension.value,
      privateTurns: parsePrivateTurns(els.personaPrivateTurns.value),
      recent_public_post: els.personaRecentPost.value,
      sessionId: source.user_message_id || 'prompt-lab-session',
      threadId: source.private_thread_id || 'prompt-lab-thread',
    };
  }

  async function assemblePersonaMailPrompt() {
    showError(els.personaMailError, '');
    const data = await postJson('/api/persona-mail/assemble', { input: collectPersonaInput() });
    state.personaMailAssembly = data.assembly;
    els.personaMailOriginalPrompt.textContent = data.assembly.prompt;
    els.personaMailPrompt.value = data.assembly.prompt;
    els.personaMailPromptBadge.textContent = `${data.assembly.persona.displayName} · ${data.assembly.scenario.label}`;
    els.personaMailMeta.textContent = `${data.assembly.scenario.label} ｜ ${data.assembly.relationship.privateTurns.length} turns ｜ ${data.assembly.recentPost ? '含 recent public post' : '无 public post'} ｜ private extension: ${data.assembly.persona.privateExtension ? 'yes' : 'no'} ｜ production: ${data.assembly.generation.maxTokens} / temp ${data.assembly.generation.temperature}`;
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

    els.fanLoveSampleSelect.addEventListener('change', () => applyFanLoveRealSample(els.fanLoveSampleSelect.value).catch((error) => showError(els.fanLoveError, error.message)));
    els.fanLoveAssembleBtn.addEventListener('click', () => assembleFanLoveVariants().catch((error) => showError(els.fanLoveError, error.message)));
    els.fanLoveGenerateBtn.addEventListener('click', generateFanLove);
    els.fanLoveRunVariantsBtn.addEventListener('click', runFanLoveVariants);
    els.fanLoveVariantPromptGrid.addEventListener('input', (event) => {
      const editor = event.target.closest('[data-fan-love-prompt]');
      if (!editor) return;
      const variantId = editor.dataset.fanLovePrompt;
      state.fanLoveSelectedVariantId = variantId;
      state.fanLoveVariantEdits[variantId] = editor.value;
      updateFanLoveVariantBadge(variantId);
    });
    els.fanLoveVariantPromptGrid.addEventListener('click', (event) => {
      const button = event.target.closest('[data-fan-love-generate-variant]');
      if (!button) return;
      const variantId = button.dataset.fanLoveGenerateVariant;
      state.fanLoveSelectedVariantId = variantId;
      generateFanLoveVariant(variantId).catch((error) => showError(els.fanLoveError, error.message));
    });
    els.personaMailSampleSelect.addEventListener('change', () => applyPersonaMailRealSample(els.personaMailSampleSelect.value).catch((error) => showError(els.personaMailError, error.message)));
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
      loadFanLoveRealSamples().catch((error) => showError(els.fanLoveError, error.message || '真实粉丝爱意样本加载失败')),
      loadPersonaMailRealSamples().catch((error) => showError(els.personaMailError, error.message || '真实人设来信样本加载失败')),
    ];
    await Promise.all(tasks);
  }

  boot();
}());
