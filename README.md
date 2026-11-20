# Transylvania × Iceland — teste de dados Unity

## Endereços

- **Transylvania original (intacta):** https://vtcaua2014-dev.github.io/surfvt-teste/transylvania/
- **Transylvania + Iceland `alt.data` (teste híbrido):** https://vtcaua2014-dev.github.io/surfvt-teste/iceland/
- **Iceland original (build Unity 2019):** https://surfvt14.up.railway.app/maps/iceland/index.html
- **Meshes e texturas extraídos:** https://vtcaua2014-dev.github.io/surfvt-teste/iceland/resources.html

## Alteração solicitada

O runner Three.js anterior (`iceland/game.js`, `iceland/play.html` e `iceland/scene-assets.json`) foi removido.

A página `/iceland/index.html` foi reconstruída usando o carregador da **Transylvania** e os mesmos `Build/miamiSiteBuild.loader.js`, `Build/miamiSiteBuild.framework.js` e `Build/miamiSiteBuild.wasm` do projeto.

O `config.dataUrl` dessa página aponta para **`iceland/Build/iceland.alt.data.unityweb`**, e não para os dados da Transylvania.

A nova automação `.github/workflows/prepare-iceland-unity-data.yml` copia esse arquivo da build pública Iceland em `vtcaua2014-dev/surfvt14`, sem modificá-lo, e salva `iceland/Build/iceland-data.json` para verificação.

- **Tamanho do arquivo:** 27.865.882 bytes
- **SHA-256:** `192bd8bbf9822b696259aa288491753581531ec63bb8387965882a277f7100b0`
- **Formato:** UnityWebData1.0 (sem compressão HTTP embutida)
- **Origem:** Unity 2019.2.0f1

### Aviso de compatibilidade

**O arquivo Iceland foi compilado com Unity 2019 e não é compatível, por simples troca de arquivos, com o runtime da Transylvania.** A página `/iceland/` é um teste diagnóstico que pode falhar na inicialização; não se deve descrevê-la como uma versão jogável com o cenário Iceland.

Uma integração funcional exigiria reconstruir/importar a cena em um projeto compatível com a versão de destino ou utilizar o runtime completo da própria build Iceland. Os modelos e atlas extraídos permanecem em `/iceland/extracted/` para referência e análise.

A página `/transylvania/` e o `index.html` original da raiz não foram alterados nesta troca.

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
