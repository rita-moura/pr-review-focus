# PR Review Focus

Extensão do Chrome que filtra visualmente a aba **Files changed / Changes** de um Pull Request no `github.com`, mantendo a interface de revisão do GitHub.

## Instalação e uso

1. Abra `chrome://extensions/` e ative **Modo do desenvolvedor**.
2. Clique em **Carregar sem compactação** e selecione a pasta que contém `manifest.json`.
3. Abra a aba **Files changed / Changes** de um PR. Ela pode já estar aberta.
4. Clique no ícone da extensão para ligar o filtro. Clique novamente ou pressione **Esc** para desligar.

Com o filtro ligado, o ícone mostra **ON**. O seletor no canto inferior direito permite trocar de modo sem desligá-lo:

Se o script da extensão ainda não estiver disponível nessa aba, o primeiro clique recarrega o PR e ativa o filtro automaticamente quando a página terminar de abrir. Nos cliques seguintes, o ícone apenas liga ou desliga o filtro.

| Modo | O que aparece nos arquivos de código |
| --- | --- |
| **Código sem comentários** | Código e contexto do diff. Comentários do código e conversas de revisão reconhecidos são ocultados. |
| **Arquivos de código** | Diff completo dos arquivos de código, inclusive comentários, conversas de revisão e linhas vazias. |

Nos dois modos, a extensão oculta arquivos não código reconhecidos, como `.md`, imagens, mídia, lockfiles, snapshots e arquivos gerados. JSON, YAML e MDX são tratados como código; formatos desconhecidos permanecem visíveis. A árvore de arquivos e os controles do GitHub continuam disponíveis. Para escrever comentários com todos os controles do GitHub, desligue o filtro.

O modo escolhido é mantido até a aba ser recarregada. Cada aba tem seu próprio estado; após recarregar, o filtro começa desligado no modo **Código sem comentários**. Ao sair da tela de alterações, a página é restaurada.

### Contadores

Os números filtrados consideram **apenas os diffs carregados na página**, não necessariamente todos os arquivos do PR. No modo **Código sem comentários**, a contagem exclui alterações compostas só por comentários e linhas vazias. No modo **Arquivos de código**, inclui essas linhas nos arquivos de código. Passe o mouse sobre o seletor de modos para ver esse lembrete.

A extensão atualiza os contadores que consegue identificar com segurança. Se não reconhecer o contador geral, **o número original do GitHub permanece** e pode não corresponder aos arquivos visíveis. Arquivos ainda não carregados ou fora do DOM não entram na soma filtrada. Ao desligar, os números originais são restaurados. Comentários sem marcação de sintaxe reconhecível também podem continuar visíveis.

## Problemas comuns

- **O ícone mostra `!`:** a extensão não encontrou um diff reconhecível ou não conseguiu ativar o filtro após recarregar. Abra **Files changed / Changes** e tente novamente; se persistir, recarregue a aba manualmente.
- **Após atualizar a extensão, aparece “Extension context invalidated”:** em `chrome://extensions/`, recarregue a extensão para aplicar os novos arquivos. Depois clique no ícone na aba do PR; a extensão recarrega essa aba automaticamente se o script antigo não responder. A lista de erros do Chrome pode conter registros antigos; limpe-a para verificar se o erro reaparece.

## Privacidade

O filtro atua no DOM da página. A permissão `activeTab` permite identificar e recarregar temporariamente a aba em que o usuário clicou no ícone. A extensão não usa token, não faz requisições de rede próprias, não armazena o conteúdo do PR e não envia ações de revisão. Funciona em `github.com`; domínios GitHub Enterprise não estão incluídos.

## Desenvolvimento

O uso da extensão não exige `npm install`. Para executar as verificações, use Node.js 20.19 ou superior:

```sh
npm install
npm test
npm run check
npm run test:browser
```

`test:browser` exige Chrome instalado em `/usr/bin/google-chrome`; em outro local, defina `CHROME_PATH`. Os testes unitários simulam o DOM e as APIs Chrome; o teste de navegador usa uma página local no Chrome. Para validar mudanças no GitHub, confira também um PR real com arquivos de código e documentação, os dois modos, diffs unificados/divididos, rolagem com carregamento de arquivos e restauração ao desligar. O DOM do GitHub pode variar entre contas.

As regras de classificação estão em [rules.js](rules.js), a detecção de arquivos em [dom.js](dom.js) e a filtragem e contagem em [diff.js](diff.js).
