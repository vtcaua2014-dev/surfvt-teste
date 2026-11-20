/* Iceland × Transylvania: integrity-checked small-part WASM transport.
 * Downloads original Transylvania WebAssembly in 2-MiB parts instead of one
 * fragile >40-MiB Pages request. No compiled Unity assets are modified.
 */
(function () {
  "use strict";
  const retries = 5;
  const partFormat = "surfvt14-transylvania-wasm-parts-v1";
  const wasmFilename = "Build/miamiSiteBuild.wasm";
  const manifestFilename = wasmFilename + ".parts.json";
  const nativeFetch = window.fetch;
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  function pathOf(file) { return new URL(file, document.baseURI).href; }
  function shortError(err) { return err && err.message ? err.message : String(err); }
  function validWasm(bytes) {
    return bytes.byteLength >= 1024 * 1024 &&
      bytes[0] === 0 && bytes[1] === 97 && bytes[2] === 115 && bytes[3] === 109;
  }
  async function sha256(bytes) {
    if (!crypto || !crypto.subtle) return null;
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join("");
  }
  async function fetchBytes(url, attempts = retries) {
    let lastError;
    for (let tryNumber = 1; tryNumber <= attempts; tryNumber++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 45000);
      try {
        const response = await nativeFetch(url, {
          cache: "no-store", credentials: "same-origin",
          signal: controller.signal
        });
        if (!response.ok) throw new Error("HTTP " + response.status + " (" + url + ")");
        const contentType = response.headers.get("content-type") || "";
        if (/text\/html/i.test(contentType)) {
          throw new Error("O servidor devolveu HTML, não o arquivo binário: " + url);
        }
        return new Uint8Array(await response.arrayBuffer());
      } catch (error) {
        lastError = error;
        console.warn("[SurfVT14] Unity WASM part retry", tryNumber, url, error);
        if (tryNumber < attempts) await wait(tryNumber * 450);
      } finally {
        clearTimeout(timer);
      }
    }
    throw new Error("Falha ao baixar parte WASM: " + shortError(lastError));
  }
  async function loadParts(onProgress) {
    const response = await nativeFetch(pathOf(manifestFilename) + "?v=partsv1", {
      cache: "no-store", credentials: "same-origin"
    });
    if (!response.ok) {
      throw new Error("Partes WASM ainda não publicadas no GitHub Pages (manifesto HTTP " +
        response.status + "). Verifique o workflow 'Publicar WASM da Transylvania em partes pequenas'.");
    }
    const manifest = await response.json();
    if (manifest.format !== partFormat || !Array.isArray(manifest.parts) ||
        !manifest.parts.length || manifest.parts.length > 100 ||
        !Number.isSafeInteger(manifest.bytes) || manifest.bytes < 1024 * 1024) {
      throw new Error("Manifesto de partes do WASM inválido.");
    }
    const blocks = [];
    let total = 0;
    for (let index = 0; index < manifest.parts.length; index++) {
      const entry = manifest.parts[index];
      if (!/^miamiSiteBuild\.wasm\.part\d{3}$/.test(entry.file) ||
          !Number.isSafeInteger(entry.bytes) || entry.bytes < 1 ||
          entry.bytes > 2 * 1024 * 1024) {
        throw new Error("Parte WASM " + index + " inválida no manifesto");
      }
      let block;
      let lastError;
      for (let attempt = 1; attempt <= 4; attempt++) {
        try {
          block = await fetchBytes(pathOf("Build/" + entry.file), 1);
          if (block.length !== entry.bytes) {
            throw new Error("Parte " + index + ": " + block.length + "/" + entry.bytes + " bytes");
          }
          if (entry.sha256) {
            const digest = await sha256(block);
            if (digest !== null && digest !== entry.sha256) {
              throw new Error("Parte " + index + " falhou na verificação SHA-256");
            }
          }
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          if (attempt < 4) await wait(attempt * 350);
        }
      }
      if (lastError) throw lastError;
      blocks.push(block);
      total += block.byteLength;
      onProgress("WASM Transylvania: " + (index + 1) + "/" +
        manifest.parts.length + " partes verificadas (" +
        Math.round(100 * total / manifest.bytes) + "%)");
    }
    if (total !== manifest.bytes) throw new Error("Tamanho do WASM incompleto: " + total + "/" + manifest.bytes);
    const blob = new Blob(blocks, { type: "application/wasm" });
    const header = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
    if (!validWasmHeader(header, total)) throw new Error("WASM remontado possui cabeçalho inválido");
    return { blob, bytes: total, sha256: manifest.sha256 };
  }
  function validWasmHeader(header, total) {
    return total >= 1024 * 1024 && header[0] === 0 && header[1] === 97 &&
      header[2] === 115 && header[3] === 109 && header[4] === 1 &&
      header[5] === 0 && header[6] === 0 && header[7] === 0;
  }
  async function prepare(onProgress) {
    let image;
    try {
      onProgress("Preparando download do WASM em blocos menores…");
      image = await loadParts(onProgress);
    } catch (error) {
      console.warn("[SurfVT14] Chunked WASM failed; attempting full original once", error);
      onProgress("WASM em blocos indisponível. Tentando arquivo original…");
      const bytes = await fetchBytes(pathOf(wasmFilename), 1).catch(originalError => {
        throw new Error(shortError(error) + " Falha no arquivo original: " +
          shortError(originalError));
      });
      if (!validWasm(bytes)) throw new Error("WASM original inválido ou incompleto (" + bytes.length + " bytes)");
      image = { blob: new Blob([bytes], {type:"application/wasm"}), bytes: bytes.byteLength };
    }
    onProgress("WASM validado (" + (image.bytes / 1048576).toFixed(1) + " MiB). Iniciando Unity…");
    const targetPath = new URL(pathOf(wasmFilename)).pathname;
    const previousFetch = window.fetch;
    const replacement = function (input, options) {
      const target = typeof input === "string" ? input : (input && input.url) || String(input);
      let requestPath = "";
      try { requestPath = new URL(target, document.baseURI).pathname; } catch (_) {}
      if (requestPath === targetPath || requestPath.endsWith("/build.wasm")) {
        return Promise.resolve(new Response(image.blob, {status:200, headers:{
          "Content-Type":"application/wasm", "Content-Length":String(image.bytes),
          "Cache-Control":"no-store"
        }}));
      }
      return previousFetch.apply(this, arguments);
    };
    window.fetch = replacement;
    return {
      url: pathOf(wasmFilename), bytes: image.bytes,
      release() {
        if (window.fetch === replacement) window.fetch = previousFetch;
        image = null;
      }
    };
  }
  window.SurfVTWasmRecovery = { prepare, wasmPath: () => pathOf(wasmFilename) };
})();
