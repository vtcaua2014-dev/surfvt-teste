# Transylvania WebGL — teste

Versão de testes para GitHub Pages usando os arquivos da build Unity WebGL fornecidos pelo usuário.

## Situação da importação

- `index.html`: página inicial e carregador das sete partes do arquivo de dados.
- `.github/workflows/import-build.yml`: importa os recursos da build a partir do endereço público já utilizado na captura do usuário, verifica os hashes SHA-256 e grava os binários em `Build/` e `TemplateData/`.
- A importação **não está concluída** até que esse workflow termine sem erros e crie as pastas dos recursos.

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

**Importante:** atualmente este repositório está privado. GitHub Pages exige uma conta/organização com plano que suporte Pages privado, ou mudança do repositório para **public**. GitHub Pages publica os arquivos do jogo para visitantes; confirme que tem autorização para redistribuição antes de tornar o repositório público.

A build completa ainda não foi testada em gameplay. O carregamento de aproximadamente 126 MB pode exigir muita memória em Chromebooks.
