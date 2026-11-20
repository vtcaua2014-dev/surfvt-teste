# Iceland × Transylvania — compilado Unity + camada visual Iceland

## Protótipos ativos

- **Transylvania original intacta:** https://vtcaua2014-dev.github.io/surfvt-teste/transylvania/
- **Transylvania com camada visual Iceland:** https://vtcaua2014-dev.github.io/surfvt-teste/iceland/
- **Iceland Unity 2019 original preservado:** https://vtcaua2014-dev.github.io/surfvt-teste/iceland/original.html
- **Meshes e atlas Iceland extraídos:** https://vtcaua2014-dev.github.io/surfvt-teste/iceland/resources.html

A página `/iceland/` reutiliza literalmente o carregador da Transylvania
`Build/miamiSiteBuild.loader.js` junto com a build nativa `miamiSiteBuild`.
O projeto adiciona **uma camada WebGL separada**, baseada em Three.js, que tenta
compor 17 peças 3D extraídas do Iceland (ground, track, plataformas, estruturas
de estação, pilares, rochas e trens), com atlases e texturas PNG originais
ligados ao material desses modelos.

- O inventário extraído da versão Iceland WebGL inclui **303 meshes OBJ,
  142 texturas PNG e 3 sprites**, além de referências a 128 materiais.
  O relatório original é `iceland/extracted/manifest.json`.
- Os 17 objetos visuais do protótipo são selecionados no
  `iceland/scene-plan.json`. A implementação está em
  `iceland/iceland-layer.js`.
- Em desktop, a camada é tentada após o Unity iniciar; em mobile, deve ser
  acionada manualmente, pois dois contextos WebGL podem exceder a memória.
- A câmera e a geometria renderizadas por Three.js **não são sincronizadas
  diretamente com a câmera ou com os obstáculos do Unity**.
- **Não há substituição nativa do cenário na Unity 2022 compilada**, nem
  integração de física, colisões, shaders, GameObjects ou hierarquia de cena.
  Isso exigiria um projeto Unity editável ou engenharia específica dos arquivos
  e recursos da própria versão 2022.
- Os arquivos do APK Iceland 2018 v1.85.0 são tratados em workflow separado
  e **não** substituem automaticamente os recursos extraídos da build WebGL.

**Status:** código confirmado no GitHub; execução em navegador e qualidade
visual da composição ainda não foram validadas em partida.

---

# SurfVT Teste — Transylvania e Iceland

## Versões disponíveis

- **Transylvania original**: https://vtcaua2014-dev.github.io/surfvt-teste/transylvania/
- **Iceland Unity 2019 original no GitHub Pages**: https://vtcaua2014-dev.github.io/surfvt-teste/iceland/
- **Arquivos extraídos do Iceland (303 meshes, 142 texturas, 3 sprites)**: https://vtcaua2014-dev.github.io/surfvt-teste/iceland/resources.html

## Correção do erro `Out of bounds memory access`

O teste anterior carregava o pacote `iceland.alt.data.unityweb` (Unity 2019.2.0f1) com o WASM e framework compilados da Transylvania. Esse cruzamento de builds não é suportado e causou o erro de memória exibido no navegador.

A rota `/iceland/` agora usa **somente o runtime original da própria build Iceland**, com:
- `iceland/UnityLoader.2019.2.js`
- `iceland/4399.z.js`
- `iceland/build/iceland/iceland.alt.json` (manifesto com caminhos locais)
- `iceland/build/shared/wasm_framework.unityweb`
- `iceland/build/shared/wasm_code_shared.unityweb`
- `iceland/Build/iceland.alt.data.unityweb` (binário Iceland original, 27.865.882 bytes)

O workflow `.github/workflows/prepare-iceland-compatible-runtime.yml` copia os componentes da build pública `vtcaua2014-dev/surfvt14` para o repositório de testes. Os hashes Git dos componentes copiados conferem com os arquivos de origem.

**Importante:** isso torna o conjunto de arquivos da build Iceland consistente e evita o erro provocado pela mistura das duas versões do Unity, mas não constitui um porte da jogabilidade da Transylvania. Não há teste de gameplay concluído em iOS ou desktop nesta alteração.

A pasta `/transylvania/` continua com a build original e não foi alterada.

## Extrator de recursos

O workflow `.github/workflows/extract-iceland.yml` publicou 448 arquivos de modelo/textura/sprite no índice `iceland/extracted/manifest.json`. A galeria desses recursos está em `iceland/resources.html`; os modelos extraídos não são injetados na build Unity.

---

# Transylvania WebGL — teste

Versão de testes para GitHub Pages usando os arquivos da build Unity WebGL fornecidos pelo usuário.

## Situação da importação

- `index.html`: página inicial e carregador das sete partes do arquivo de dados.
- `.github/workflows/import-build.yml`: importa os recursos da build a partir do endereço público já utilizado na captura do usuário, verifica os hashes SHA-256 e grava os binários em `Build/` e `TemplateData/`.
- Os arquivos da build e as sete partes do pacote de dados já foram identificados no repositório. O funcionamento completo da build ainda requer teste no navegador.

## Como iniciar a importação dos arquivos grandes

1. Abra **Actions → Importar Transylvania WebGL** no repositório.
2. Se o workflow ainda não executou, use **Run workflow → main → Run workflow**.
3. Se Actions estiver desativado, ative-o nas configurações do repositório.
4. Aguarde a execução terminar com sucesso; em seguida confirme se a pasta `Build/` contém `miamiSiteBuild.wasm.unityweb` e os sete `miamiSiteBuild.data.unityweb.part0` … `.part6`.

Se o site original sair do ar ou bloquear o acesso do GitHub Actions, use o pacote `Transylvania_GitHub_Pages_Pronto.zip` fornecido nesta conversa: extraia o ZIP no Chromebook e faça upload da estrutura de pastas completa no repositório, sem enviar somente o ZIP.

## Publicar pelo GitHub Pages

1. Abra **Settings → Pages**.
2. Em **Build and deployment**, selecione **Deploy from a branch**.
3. Selecione **main**, **/(root)** e salve.
4. O endereço esperado é `https://vtcaua2014-dev.github.io/surfvt-teste/`.

**Importante:** se o GitHub Pages não estiver ativado para este repositório, habilite-o em Settings → Pages. Verifique os direitos de redistribuição dos assets originais antes de disponibilizá-los publicamente. GitHub Pages publica os arquivos do jogo para visitantes; confirme que tem autorização para redistribuição antes de tornar o repositório público.

A build original não foi validada em uma partida completa nesta etapa. O carregamento de aproximadamente 126 MB pode exigir muita memória em dispositivos móveis.
