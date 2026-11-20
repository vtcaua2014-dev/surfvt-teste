/* Iceland × Transylvania: verified small-file WASM transport.
 * The source WASM is unchanged. Github Actions splits it into 2 MiB shards,
 * which GitHub Pages can serve and clients can retry independently.
 *
 * The Unity loader/framework do not know about shards; this shim makes both
 * codeUrl and Emscripten's "build.wasm" fallback see one valid WASM Response.
 */
(function () {
  "use strict";
  const MAX_PART_ATTEMPTS = 5;
  const MAX_WHOLE_ATTEMPTS = 2;
  const MIME = "application/wasm";
  const WASM_MAGIC = [0, 97, 115, 109, 1, 0, 0, 0];

  function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
  function fileUrl(path) { return new URL(path, document.baseURI).href; }
  function wasmPath() { return fileUrl("Build/miamiSiteBuild.wasm"); }
  function manifestPath() { return fileUrl("iceland/wasm-chunks.json"); }
  function getMessage(error) { return error && error.message ? error.message : String(error); }

  function hasWasmMagic(buffer) {
    if (!buffer || buffer.byteLength < WASM_MAGIC.length) return false;
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    return WASM_MAGIC.every((value, index) => bytes[index] === value);
  }

  function validManifest(manifest) {
    if (!manifest || manifest.format !== "surfvt14-transylvania-wasm-shards-v1" ||
        !Number.isSafeInteger(manifest.totalBytes) ||
        manifest.totalBytes < 1024 * 1024 || manifest.totalBytes > 512 * 1024 * 1024 ||
        !Array.isArray(manifest.parts) || !manifest.parts.length || manifest.parts.length > 300 ||
        !Number.isSafeInteger(manifest.chunkSize) || manifest.chunkSize < 65536 ||
        manifest.chunkSize > 8 * 1024 * 1024) {
      throw new Error("Manifesto de partes WASM inválido");
    }
    let count = 0;
    for (const part of manifest.parts) {
      if (!part || typeof part.path !== "string" ||
          !/^Build\/wasm-shards\/miamiSiteBuild\.wasm\.part\d{3}$/.test(part.path) ||
          !Number.isSafeInteger(part.size) || part.size < 1 || part.size > manifest.chunkSize ||
          !/^[0-9a-f]{64}$/.test(part.sha256)) {
        throw new Error("Manifesto contém parte WASM inválida");
      }
      count += part.size;
    }
    if (count !== manifest.totalBytes) throw new Error("Manifesto WASM não soma o tamanho total");
  }

  async function sha256(buffer) {
    if (!self.crypto || !crypto.subtle) return null;
    const result = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(result),
      byte => byte.toString(16).padStart(2, "0")).join("");
  }

  async function fetchPart(part, fetchImpl, progress, index, total) {
    let lastError;
    for (let attempt = 1; attempt <= MAX_PART_ATTEMPTS; attempt++) {
      try {
        progress("Baixando WASM: parte " + (index + 1) + "/" + total +
          " (tentativa " + attempt + "/" + MAX_PART_ATTEMPTS + ")…");
        const response = await fetchImpl(fileUrl(part.path) +
          "?shard=iceland-v3&r=" + attempt, {
          cache: "no-store",
          credentials: "same-origin"
        });
        if (!response.ok) throw new Error("HTTP " + response.status);
        const data = await response.arrayBuffer();
        if (data.byteLength !== part.size) throw new Error(
          "parte incompleta: " + data.byteLength + "/" + part.size + " bytes");
        if (index === 0 && !hasWasmMagic(data)) throw new Error("assinatura WebAssembly inválida");
        const actualHash = await sha256(data);
        if (actualHash && actualHash !== part.sha256) throw new Error(
          "SHA-256 incorreto para a parte " + (index + 1));
        return data;
      } catch (error) {
        lastError = error;
        console.warn("[SurfVT14] Retry WASM shard", index, attempt, error);
        if (attempt < MAX_PART_ATTEMPTS) await sleep(300 * attempt);
      }
    }
    throw new Error("Falha na parte WASM " + (index + 1) + "/" + total +
      ": " + getMessage(lastError));
  }

  async function loadFromShards(fetchImpl, progress) {
    progress("Procurando pacote WASM dividido em arquivos menores…");
    const response = await fetchImpl(manifestPath() + "?manifest=iceland-v3", {
      cache: "no-store", credentials: "same-origin"
    });
    if (!response.ok) throw new Error("Partes WASM ainda não publicadas (HTTP " + response.status + ")");
    const manifest = await response.json();
    validManifest(manifest);
    const parts = [];
    let length = 0;
    for (let index = 0; index < manifest.parts.length; index++) {
      const bytes = await fetchPart(manifest.parts[index], fetchImpl, progress,
        index, manifest.parts.length);
      length += bytes.byteLength;
      parts.push(bytes);
    }
    if (length !== manifest.totalBytes) throw new Error("WASM reconstruído tem tamanho incorreto");
    progress("WASM reconstruído e verificado: " + (length / 1048576).toFixed(1) + " MiB");
    return new Blob(parts, { type: MIME });
  }

  async function loadOriginal(fetchImpl, progress) {
    let lastError;
    for (let attempt = 1; attempt <= MAX_WHOLE_ATTEMPTS; attempt++) {
      try {
        progress("Tentando WASM original da Transylvania (" + attempt + "/" +
          MAX_WHOLE_ATTEMPTS + ")…");
        const response = await fetchImpl(wasmPath() + "?download=iceland-fallback-v3-" + attempt, {
          cache: "no-store", credentials: "same-origin"
        });
        if (!response.ok) throw new Error("HTTP " + response.status);
        const data = await response.arrayBuffer();
        if (data.byteLength < 1024 * 1024 || !hasWasmMagic(data)) {
          throw new Error("Resposta não contém o WASM original (" + data.byteLength + " bytes)");
        }
        return new Blob([data], { type: MIME });
      } catch (error) {
        lastError = error;
        console.warn("[SurfVT14] Original WASM unavailable", attempt, error);
        if (attempt < MAX_WHOLE_ATTEMPTS) await sleep(450 * attempt);
      }
    }
    throw lastError;
  }

  async function prepare(progressFn) {
    const progress = typeof progressFn === "function" ? progressFn : function () {};
    const fetchImpl = window.fetch;
    let blob;
    let chunkError;
    try {
      blob = await loadFromShards(fetchImpl, progress);
    } catch (error) {
      chunkError = error;
      console.warn("[SurfVT14] WASM shard transport unavailable", error);
      try {
        blob = await loadOriginal(fetchImpl, progress);
      } catch (originalError) {
        throw new Error("Falha no download do WASM. Partes: " + getMessage(chunkError) +
          ". Arquivo original: " + getMessage(originalError) +
          ". Confira se o workflow de partes WASM concluiu no GitHub Actions.");
      }
    }
    const wasmUrl = new URL(wasmPath());
    const patchedFetch = function (input, options) {
      let path = "";
      try {
        const target = typeof input === "string" ? input :
          (input && input.url) || String(input);
        path = new URL(target, document.baseURI).pathname;
      } catch (_) {}
      if (blob && (path === wasmUrl.pathname ||
          path === new URL("build.wasm", document.baseURI).pathname)) {
        return Promise.resolve(new Response(blob, {
          status: 200, headers: {
            "Content-Type": MIME,
            "Content-Length": String(blob.size),
            "Cache-Control": "no-store"
          }
        }));
      }
      return fetchImpl.apply(this, arguments);
    };
    window.fetch = patchedFetch;
    progress("WASM disponível para o Unity (" + (blob.size / 1048576).toFixed(1) + " MiB)");
    return {
      url: wasmUrl.href,
      bytes: blob.size,
      release() {
        if (window.fetch === patchedFetch) window.fetch = fetchImpl;
        blob = null;
      }
    };
  }

  window.SurfVTWasmRecovery = { prepare, wasmPath, manifestPath };
})();
