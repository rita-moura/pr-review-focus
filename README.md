# github-pr-code-only

Extensão privada do Chrome para focar nas alterações de código em Pull Requests do GitHub.

## Estado do projeto

Versão **0.2.1**, sem dependências e sem publicação na Chrome Web Store.
A lógica de classificação e de rotas foi verificada; a interface ainda precisa de teste
manual no Chrome em um PR real. O GitHub pode variar a estrutura do diff entre contas
e versões: esta versão não promete compatibilidade com todas essas interfaces.

## Funcionalidades

- Botão flutuante para ativar o foco e restaurar a página normal.
- Oculta elementos externos à área do diff quando ela é reconhecida.
- Opção para esconder arquivos que não são código; os comentários do GitHub permanecem visíveis.
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
Comentários escritos **dentro do código-fonte** e comentários de revisão do GitHub permanecem visíveis.
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
- `dom.js`: seletores e leitura de arquivos nas interfaces antiga e React (`/changes`).
- `content.js`: interface e restauração.
- `styles.css`: estilos limitados ao modo ativo.
- `tests/rules.test.cjs`: testes das funções puras.
- `tests/dom.test.cjs`: regressões com uma árvore DOM simulada; não substituem teste no navegador.

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
no arquivo dom.js. Os seletores de comentários ficam em styles.css.
Eles devem ser ajustados com base no DOM real da sua interface.

Não foram executados testes visuais de navegador nesta preparação.
Não publique capturas ou HTML com código privado para relatar um problema.


## Atualização 0.1.1

Corrige a ausência de detecção dos cartões React na tela /changes.
A detecção agora contempla as classes de arquivo e cabeçalho do GitHub, além de
alvos diff-* que contenham um cabeçalho de arquivo. Lê o nome no cabeçalho mesmo
quando o conteúdo está recolhido ou mostra Load Diff. Remove marcas direcionais
invisíveis do nome e usa o destino na descrição acessível de renomeações.
Uma falha na identificação continua deixando o arquivo/página visível.

Os padrões DOM foram conferidos no código público do
[Refined GitHub](https://github.com/refined-github/refined-github/tree/main/source/features),
em especial batch-mark-files-as-viewed, actionable-pr-view-file e restore-file.
Não foi acessado o conteúdo do PR privado mostrado na captura.

Para atualizar a instalação por ZIP:

1. Baixe o ZIP atual e extraia em uma pasta separada.
2. Copie os arquivos extraídos **para dentro da pasta que o Chrome já carrega**,
   substituindo os antigos e incluindo o novo dom.js.
3. Em chrome://extensions/, clique no botão de recarregar da extensão.
4. Confira a versão **0.1.1** e recarregue também a aba do PR.

Apenas baixar outro ZIP ou recarregar a extensão sem atualizar a pasta não instala a correção.


## Atualização 0.1.3

Corrige PRs com diff virtualizado: a extensão também examina as linhas da árvore lateral (File Tree) e usa um fallback seguro para reconhecer extensões no cabeçalho quando o GitHub não expõe `data-path` ou a classe esperada. Assim documentos como `.md` são ocultados mesmo antes de todos os diffs serem renderizados.


## Atualização 0.1.4

A versão usa também os links `#diff-...` da árvore lateral do GitHub. Isso é necessário porque a interface atual virtualiza os cartões do diff e pode manter apenas um cartão no DOM. Os itens da árvore são filtrados pelo caminho/extensão mesmo quando o conteúdo do arquivo ainda não foi carregado.


## Versão 0.2.0 — plano implementado

A versão 0.2 separa a árvore lateral dos cartões do diff, preserva comentários do GitHub e calcula uma contagem de alterações de código pelo patch completo do PR. O indicador próprio mostra `Código: +X -Y`; o contador original do GitHub continua disponível para comparação. Arquivos não código são ocultados somente quando o modo está ativo.


## Versão 0.2.0 — filtro e contador de código

A extensão agora separa a árvore lateral dos cartões do diff, sem depender de um contêiner comum no DOM. Arquivos não código são ocultados diretamente; comentários do GitHub não são ocultados. O patch completo do PR é analisado localmente pelo navegador para mostrar um indicador próprio `Código: +X -Y`, sem substituir o contador nativo do GitHub. Se o GitHub bloquear o patch, o filtro visual continua funcionando e a contagem informa que está indisponível.


## Versão 0.2.1

Evita novas requisições do patch a cada mutação da página e não inclui caminhos desconhecidos na soma de código. Formatos desconhecidos permanecem visíveis, mas a contagem de código só considera extensões reconhecidas.


## Versão 0.2.2

Corrige o acesso ao patch: o GitHub redireciona o arquivo para `patch-diff.githubusercontent.com`, então a busca agora passa por um service worker com permissões restritas aos dois hosts e somente a rotas de patch de Pull Request. Adiciona também detecção de nomes exibidos como texto na árvore React. Os comentários do GitHub continuam visíveis.
