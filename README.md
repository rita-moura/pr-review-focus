# github-pr-code-only

Extensão privada do Chrome para focar nas alterações de código em Pull Requests do GitHub.

## Estado do projeto

Versão inicial **0.1.0**, sem dependências e sem publicação na Chrome Web Store.
A lógica de classificação e de rotas foi verificada; a interface ainda precisa de teste
manual no Chrome em um PR real. O GitHub pode variar a estrutura do diff entre contas
e versões: esta versão não promete compatibilidade com todas essas interfaces.

## Funcionalidades

- Botão flutuante para ativar o foco e restaurar a página normal.
- Oculta elementos externos à área do diff quando ela é reconhecida.
- Opções separadas para esconder arquivos não código/gerados e comentários de revisão reconhecidos.
- Mantém nomes dos arquivos, numeração, linhas removidas/adicionadas e contexto do diff.
- Contador dos arquivos **carregados no DOM**, não necessariamente de todos os arquivos do PR.
- Preferências locais ao perfil do Chrome e compartilhadas entre suas abas.
- Reaplica o filtro em atualizações dinâmicas e navegação interna.
- Tecla **Esc** para sair do modo de foco.
- Se o diff não for reconhecido, mantém a página intacta e apresenta um aviso.

O filtro é apenas visual: não remove comentários, não altera arquivos e não executa
aprovações, merges ou outras ações no GitHub. Ele não bloqueia o download do conteúdo
ocultado nem funciona como uma barreira de segurança.

## Instalar sem publicar

1. Clone este repositório ou use **Code → Download ZIP** e extraia o arquivo.
2. Abra `chrome://extensions/` no Chrome.
3. Ative **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação**.
5. Selecione a pasta que contém `manifest.json`.
6. Abra ou recarregue um PR e entre em **Files changed**.
7. Clique em **Ativar somente código**, no canto inferior direito.

Não é necessário executar npm install, compilar o projeto ou gerar uma chave.
Se o Chrome for gerenciado pela empresa, a instalação depende das políticas do administrador.

## Usar com a equipe

Conceda acesso ao repositório privado somente às pessoas desejadas.
Cada pessoa deve clonar/baixar e carregar a extensão no próprio Chrome.

Após uma atualização: execute `git pull --ff-only` (ou baixe e extraia a nova versão),
clique no ícone de recarregar da extensão em `chrome://extensions/`
e recarregue a aba do PR. Não há atualização automática nesta forma de distribuição.

Para revisar/escrever comentários ou usar controles ocultados, restaure a página normal.
Desmarque o filtro de arquivos para inspecionar tudo antes de concluir sua revisão.

## O que é considerado código?

A classificação por caminho fica em `rules.js`.

- Mantidos: JavaScript, TypeScript, Ruby, Python, HTML, CSS, SQL e outras linguagens;
  Dockerfile, Jenkinsfile e Makefile.
- Configurações como JSON, YAML, TOML e .env também são mantidas, pois podem mudar
  o comportamento da aplicação.
- Ocultados pelo filtro: documentação, imagens (incluindo SVG), mídia, lockfiles,
  snapshots, source maps, arquivos minificados e pastas como dist, build e vendor.
- Formatos desconhecidos e caminhos não identificados são mantidos visíveis por segurança.

São heurísticas, não análise semântica: SVG e pastas chamadas build, por exemplo,
podem conter código importante no seu projeto. Ajuste as regras ou desmarque o filtro.
Comentários escritos **dentro do código-fonte** permanecem no diff.
Não há detecção universal de arquivos gerados nem lista configurável pela interface nesta versão.

## Privacidade e permissões

- Não usa token, API do GitHub, analytics, IA, servidor ou bibliotecas externas.
- Não envia conteúdo do PR para outros serviços.
- Usa somente a permissão storage para salvar três preferências booleanas.
- O content script tem acesso a github.com para detectar navegação sem recarregamento;
  as alterações visuais ficam restritas às rotas de arquivos do PR.
- O código e os nomes de arquivos são lidos apenas do DOM local para montar o filtro,
  sem serem salvos nas preferências.
- GitHub Enterprise em outro domínio não está incluído nesta versão.

## Desenvolvimento

- `manifest.json`: Manifest V3 e registro dos scripts.
- `rules.js`: classificação de arquivos e reconhecimento de rotas.
- `content.js`: interface, adaptação ao DOM e restauração.
- `styles.css`: estilos limitados ao modo ativo.
- `tests/rules.test.cjs`: testes das funções puras.

Com Node.js 18 ou superior, sem instalar dependências:

```bash
npm test
npm run check
```

Referências oficiais:
[content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
e [carregar uma extensão local](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked).

## Checklist manual antes de usar em revisões importantes

- Abrir um PR diretamente e também navegando de outra página do GitHub.
- Verificar modos unified e split, tema claro e escuro.
- Ativar, desativar e pressionar Esc; conferir restauração completa.
- Alternar filtro e comentários; confirmar que nomes e linhas do diff continuam visíveis.
- Testar PR apenas com documentação, arquivos renomeados e formatos desconhecidos.
- Rolar um PR grande, carregar diffs adicionais e conferir o contador.
- Navegar para Conversation/Commits/outro repositório; nada deve continuar oculto.
- Abrir duas abas e verificar sincronização das preferências.
- Conferir o console e a página de extensões em busca de erros.

## Se não funcionar no seu GitHub

Desative o foco pelo botão ou Esc. Se necessário, desative a extensão e recarregue a página.
Os seletores de arquivos e da área de diff estão centralizados em SELECTORS,
no início de content.js. Os seletores de comentários ficam em styles.css.
Eles devem ser ajustados com base no DOM real da sua interface.

Não foram executados testes visuais de navegador nesta preparação.
Não publique capturas ou HTML com código privado para relatar um problema.
