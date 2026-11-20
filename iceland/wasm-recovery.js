/* Resilient WebAssembly preflight for the Iceland × Transylvania test only.
 * Never assume a successful HTTP status means the full Unity .wasm downloaded.
 * The Unity framework internally falls back to "build.wasm" on download failure.
 */
(function () {
  "use strict";
  const MAX_TRIES = 3;
  const bytesExpectedMin = 1024 * 1024;
  const wasmMagic = [0, 97, 115, 109];
  function wasmValid(bytes) {
    return bytes.byteLength >= bytesExpectedMin &&
      wasmMagic.every((value, i) => bytes[i] === value);
  }
  function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
  function wasmPath() {
    return new URL("Build/miamiSiteBuild.wasm", document.baseURI).href;
  }
  function describe(err) {
    return err && err.message ? err.message : String(err);
  }
  async function prepare(onProgress) {
    const target = wasmPath();
    const baseFetch = window.fetch;
    let lastError = null;
    let bytes = null;
    for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
      try {
        onProgress("Baixando WASM da Transylvania (" + attempt + "/" + MAX_TRIES + ")…");
        const response = await baseFetch(target + "?asset=iceland-transylvania-v2&t=" + attempt, {
          cache: "no-store", credentials: "same-origin"
        });
        if (!response.ok) {
          throw new Error("WASM HTTP " + response.status + " em " + target);
        }
        const contentType = response.headers.get("content-type") || "indisponível";
        bytes = new Uint8Array(await response.arrayBuffer());
        if (!wasmValid(bytes)) {
          throw new Error("WASM inválido ou incompleto: " + bytes.byteLength +
            " bytes, tipo " + contentType + ", cabeçalho " +
            Array.from(bytes.subarray(0, 4)).join(","));
        }
        break;
      } catch (error) {
        lastError = error;
        bytes = null;
        console.warn("[SurfVT14] WASM preflight failed attempt " + attempt, error);
        if (attempt < MAX_TRIES) await sleep(attempt * 450);
      }
    }
    if (!bytes) {
      throw new Error("Não foi possível baixar um arquivo WASM válido da Transylvania. " +
        describe(lastError) + ". Verifique Build/miamiSiteBuild.wasm no GitHub Pages.");
    }
    onProgress("WASM validado (" + (bytes.byteLength / 1048576).toFixed(1) +
      " MiB); iniciando Unity…");
    const blob = new Blob([bytes], { type: "application/wasm" });
    const previousFetch = window.fetch;
    const originalWasmPath = new URL(target).pathname;
    const patchedFetch = function (input, options) {
      const urlText = typeof input === "string" ? input :
        (input && input.url ? input.url : String(input));
      let path = "";
      try { path = new URL(urlText, document.baseURI).pathname; } catch (_) {}
      if (path === originalWasmPath || path.endsWith("/build.wasm")) {
        return Promise.resolve(new Response(blob, {
          status: 200, headers: {
            "Content-Type": "application/wasm",
            "Content-Length": String(blob.size),
            "Cache-Control": "no-store"
          }
        }));
      }
      return previousFetch.apply(this, arguments);
    };
    window.fetch = patchedFetch;
    return {
      url: target,
      bytes: blob.size,
      release: function () {
        if (window.fetch === patchedFetch) window.fetch = previousFetch;
        bytes = null;
      }
    };
  }
  window.SurfVTWasmRecovery = { prepare, wasmPath };
})();
