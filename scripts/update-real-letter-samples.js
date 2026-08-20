#!/usr/bin/env node

'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline');

const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_SOURCE = path.resolve(__dirname, '../../../outputs/letters-chain-real-inputs-20260820.json');
const PROTECTED_FILE = path.join(REPO_ROOT, 'data/prompt-lab-protected.json');
const MANIFEST_FILE = path.join(REPO_ROOT, 'deploy-manifest.json');

function decodeBase64(value) {
  return Buffer.from(String(value || ''), 'base64');
}

function encodeBase64(value) {
  return Buffer.from(value).toString('base64');
}

function deriveKey(password, salt, iterations, length, hash) {
  return crypto.pbkdf2Sync(
    Buffer.from(String(password), 'utf8'),
    salt,
    Number(iterations),
    Number(length) / 8,
    String(hash || 'SHA-256').toLowerCase().replace('-', ''),
  );
}

function nodeCipherName(cipher = {}) {
  const name = String(cipher.name || '').trim().toLowerCase();
  if (name === 'aes-gcm' || name === 'aes-256-gcm') return 'aes-256-gcm';
  throw new Error(`不支持的加密算法：${cipher.name || '未提供'}`);
}

function decryptProtectedPayload(protectedPayload, password) {
  const cipher = protectedPayload.cipher || {};
  const ciphertextWithTag = decodeBase64(protectedPayload.ciphertext);
  const tagLength = Number(cipher.tagLength || 128) / 8;
  if (ciphertextWithTag.length <= tagLength) throw new Error('受保护数据的 ciphertext 不完整');

  const ciphertext = ciphertextWithTag.subarray(0, ciphertextWithTag.length - tagLength);
  const authTag = ciphertextWithTag.subarray(ciphertextWithTag.length - tagLength);
  const key = deriveKey(
    password,
    decodeBase64(protectedPayload.kdf?.salt),
    protectedPayload.kdf?.iterations,
    cipher.length || 256,
    protectedPayload.kdf?.hash || 'SHA-256',
  );
  const decipher = crypto.createDecipheriv(nodeCipherName(cipher), key, decodeBase64(cipher.iv));
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const parsed = JSON.parse(plaintext.toString('utf8'));
  if (!Array.isArray(parsed.baselines) || !Array.isArray(parsed.letterSamples)) {
    throw new Error('旧受保护数据缺少 baselines 或 letterSamples');
  }
  return parsed;
}

function encryptProtectedPayload(protectedPayload, plaintextPayload, password) {
  const kdf = protectedPayload.kdf || {};
  const cipher = protectedPayload.cipher || {};
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = deriveKey(password, salt, kdf.iterations || 250000, cipher.length || 256, kdf.hash || 'SHA-256');
  const encryptor = crypto.createCipheriv(nodeCipherName(cipher), key, iv);
  const plaintext = Buffer.from(JSON.stringify(plaintextPayload), 'utf8');
  const ciphertext = Buffer.concat([encryptor.update(plaintext), encryptor.final()]);
  const authTag = encryptor.getAuthTag();

  return {
    version: protectedPayload.version || 2,
    usernameSha256: protectedPayload.usernameSha256,
    kdf: {
      name: kdf.name || 'PBKDF2',
      hash: kdf.hash || 'SHA-256',
      iterations: Number(kdf.iterations || 250000),
      salt: encodeBase64(salt),
    },
    cipher: {
      name: cipher.name || 'aes-256-gcm',
      length: Number(cipher.length || 256),
      tagLength: Number(cipher.tagLength || 128),
      iv: encodeBase64(iv),
    },
    payloadEncoding: protectedPayload.payloadEncoding || 'base64',
    ciphertext: encodeBase64(Buffer.concat([ciphertext, authTag])),
  };
}

function stableLabId(sample, index) {
  const kind = sample.kind === 'fan_love' ? 'fan-love' : 'persona-mail';
  const source = sample.source || {};
  const sourceId = source.source_id || source.private_thread_id || source.fragment_id || `sample-${index + 1}`;
  const normalized = String(sourceId).replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return `${kind}-${normalized || index + 1}`;
}

function normalizeSamples(sourcePayload) {
  if (!Array.isArray(sourcePayload?.samples)) throw new Error('输入 JSON 缺少 samples 数组');

  const samples = sourcePayload.samples.map((sample, index) => ({
    ...sample,
    lab_id: String(sample.lab_id || stableLabId(sample, index)),
  }));
  const ids = new Set();
  for (const sample of samples) {
    if (ids.has(sample.lab_id)) throw new Error(`样本 lab_id 重复：${sample.lab_id}`);
    ids.add(sample.lab_id);
  }

  const fanLoveSamples = samples.filter((sample) => sample.kind === 'fan_love');
  const personaMailSamples = samples.filter((sample) => sample.kind === 'persona_mail');
  if (fanLoveSamples.length !== 15 || personaMailSamples.length !== 15) {
    throw new Error(`样本数量不符合预期：fan_love=${fanLoveSamples.length}，persona_mail=${personaMailSamples.length}，应为 15 / 15`);
  }

  for (const [index, sample] of fanLoveSamples.entries()) {
    const posts = sample.input?.posts;
    if (!Array.isArray(posts) || posts.length !== 3 || posts.some((post) => !String(post?.content || '').trim())) {
      throw new Error(`第 ${index + 1} 条 fan_love 样本必须包含 3 篇非空帖子`);
    }
  }
  for (const [index, sample] of personaMailSamples.entries()) {
    const turns = sample.input?.private_turns;
    if (!Array.isArray(turns) || !turns.length || turns.some((turn) => !String(turn?.content || '').trim())) {
      throw new Error(`第 ${index + 1} 条 persona_mail 样本必须包含非空 private_turns`);
    }
  }
  return samples;
}

function manifestSourcePath(sourceFile) {
  const normalized = sourceFile.split(path.sep).join('/');
  const marker = '/outputs/';
  const markerIndex = normalized.lastIndexOf(marker);
  return markerIndex >= 0 ? normalized.slice(markerIndex + 1) : path.basename(sourceFile);
}

function timestampForFilename() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function writeJsonAtomic(filePath, value) {
  const tempPath = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tempPath, filePath);
}

function backupFile(filePath) {
  const backupPath = path.join(os.tmpdir(), `${path.basename(filePath)}.backup-${timestampForFilename()}`);
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

function promptHiddenPassword() {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    return new Promise((resolve, reject) => {
      const input = readline.createInterface({ input: process.stdin, output: process.stdout });
      input.question('请输入当前 Prompt Lab 登录密码：', (answer) => {
        input.close();
        resolve(answer);
      });
      input.on('SIGINT', () => {
        input.close();
        reject(new Error('已取消密码输入'));
      });
    });
  }

  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    let password = '';
    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
    };
    const onData = (chunk) => {
      for (const character of String(chunk)) {
        if (character === '\u0003') {
          cleanup();
          stdout.write('\n');
          reject(new Error('已取消密码输入'));
          return;
        }
        if (character === '\r' || character === '\n') {
          cleanup();
          stdout.write('\n');
          resolve(password);
          return;
        }
        if (character === '\u007f' || character === '\b') {
          password = password.slice(0, -1);
          continue;
        }
        password += character;
      }
    };
    stdout.write('请输入当前 Prompt Lab 登录密码：');
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');
    stdin.resume();
    stdin.on('data', onData);
  });
}

async function main() {
  const sourceFile = path.resolve(process.argv[2] || DEFAULT_SOURCE);
  if (!fs.existsSync(sourceFile)) throw new Error(`找不到输入文件：${sourceFile}`);
  if (!fs.existsSync(PROTECTED_FILE)) throw new Error(`找不到受保护数据：${PROTECTED_FILE}`);

  const sourcePayload = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
  const samples = normalizeSamples(sourcePayload);
  const protectedPayload = JSON.parse(fs.readFileSync(PROTECTED_FILE, 'utf8'));
  const password = await promptHiddenPassword();
  if (!password) throw new Error('密码不能为空');

  let currentPayload;
  try {
    currentPayload = decryptProtectedPayload(protectedPayload, password);
  } catch (_error) {
    throw new Error('旧密码校验失败，未改动任何文件');
  }

  const nextProtectedPayload = encryptProtectedPayload(protectedPayload, {
    baselines: currentPayload.baselines,
    letterSamples: samples,
  }, password);
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
  const fanLoveCount = samples.filter((sample) => sample.kind === 'fan_love').length;
  const personaMailCount = samples.filter((sample) => sample.kind === 'persona_mail').length;
  const nextManifest = {
    ...manifest,
    generatedAt: new Date().toISOString(),
    lettersRealInputSource: manifestSourcePath(sourceFile),
    letterSampleCount: samples.length,
    fanLoveSampleCount: fanLoveCount,
    personaMailSampleCount: personaMailCount,
  };

  const protectedBackup = backupFile(PROTECTED_FILE);
  const manifestBackup = backupFile(MANIFEST_FILE);
  writeJsonAtomic(PROTECTED_FILE, nextProtectedPayload);
  writeJsonAtomic(MANIFEST_FILE, nextManifest);
  console.log(`已更新 ${fanLoveCount} 条 fan_love + ${personaMailCount} 条 persona_mail 样本`);
  console.log(`已自动补齐 lab_id；每条 fan_love 样本均校验为 3 篇帖子`);
  console.log(`受保护数据备份：${protectedBackup}`);
  console.log(`发布清单备份：${manifestBackup}`);
  console.log('下一步：检查 git diff，然后提交并推送 main。');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`更新失败：${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  decryptProtectedPayload,
  encryptProtectedPayload,
  normalizeSamples,
};
