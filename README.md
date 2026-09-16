# GitHub PR Code Only

Extensão do Chrome para focar no código de um Pull Request do GitHub. Versão **0.6.1**.

## Instalação e uso

1. Em `chrome://extensions/`, ative **Modo do desenvolvedor**.
2. Use **Carregar sem compactação** e selecione esta pasta.
3. Abra um PR em **Changes / Files changed** e recarregue a aba.
4. Clique no ícone da extensão para ligar. Use o pequeno seletor no canto inferior direito para escolher o modo. Clique no ícone novamente ou pressione **Esc** para desligar.

O ícone mostra **ON** enquanto o filtro está ativo. O seletor oferece **Só código** (modo atual: oculta comentários no código e comentários de revisão) e **Arquivos de código** (mostra esses comentários e as linhas vazias, mas mantém documentação e outros arquivos não código ocultos). O modo escolhido permanece na aba enquanto ela estiver aberta; a próxima ativação usa o mesmo modo.
O estado é independente por aba e começa desligado ao recarregar. Ao sair da tela de alterações, a página é restaurada.
Se o ícone mostrar **!**, passe o mouse sobre ele para ver a orientação: abra a tela de alterações ou recarregue a página.

Após atualizar os arquivos, recarregue a extensão em `chrome://extensions/` e também a aba do PR.

## O que é ocultado

- Arquivos de documentação, imagens, mídia, lockfiles, snapshots e arquivos gerados reconhecidos pelas regras.
- A estrutura do GitHub (cabeçalho, abas, árvore e controles) permanece visível.
- No modo **Só código**, comentários de revisão dentro dos arquivos e comentários do código são ocultados. Linhas compostas só por comentários desaparecem; código na mesma linha é preservado.
- No modo **Arquivos de código**, o conteúdo completo dos arquivos de código permanece visível, inclusive comentários e linhas vazias.

Nomes dos arquivos de código, linhas adicionadas/removidas e contexto do diff são preservados.
JSON, YAML e outras configurações são considerados código. Formatos desconhecidos permanecem visíveis.
As regras estão em `rules.js`; os seletores do GitHub estão em `dom.js` e `styles.css`.
Os contadores reconhecidos são substituídos temporariamente por **Código carregado: +X −Y**. Quando o GitHub usa outro formato de contador, a extensão tenta atualizar diretamente os números exibidos no topo. Se não encontrar um par seguro, mantém o resumo original. A soma considera apenas arquivos de código carregados. No modo Só código, exclui comentários e linhas vazias; no modo Arquivos de código, usa os totais nativos dos cartões de arquivos de código, incluindo ambos. Diffs ainda não carregados, recolhidos ou fora do DOM não entram no total. Ao desligar, os contadores originais são restaurados. Se o GitHub não expuser a marcação de sintaxe ou um contador reconhecível, esses comentários ou contadores permanecem como estão.

Se nenhum cartão de diff for reconhecido, a página fica intacta e o ícone mostra **!**.
A extensão acompanha mudanças no DOM e reaplica o filtro a arquivos carregados depois.
Desligue o filtro para escrever comentários e acessar os controles completos do GitHub.

## Privacidade

Sem token, chamadas de rede, dependências externas ou armazenamento de preferências/conteúdo.
O filtro é visual, não altera arquivos nem envia ações de revisão. Funciona em `github.com`, não em domínios Enterprise.

## Desenvolvimento e validação

Execute `npm test` e `npm run check` com Node.js 18 ou superior. Não é necessário instalar dependências.
Os testes cobrem classificação, detecção do DOM, ativação, restauração, navegação e comunicação com o ícone.
O DOM e as APIs Chrome são simulados nos testes; isso não substitui validação em um PR real.

Para validar no Chrome: teste ativar/desativar e Esc, navegação interna, modos unified/split,
PRs só de documentação e rolagem com carregamento de arquivos. O GitHub pode variar o DOM entre contas.

`patch.js` é um utilitário legado com testes; não é carregado pela extensão.

## Erro “Extension context invalidated”

Ao recarregar ou atualizar a extensão, abas abertas podem continuar com o content script da versão anterior,
cuja conexão com o Chrome deixou de existir. Recarregue também a aba do PR e clique no ícone para ativar.
A versão 0.6.1 trata falhas síncronas e assíncronas de comunicação e encerra o script invalidado,
restaurando a página e desligando seus observadores e temporizadores. Ela não pode atualizar scripts antigos
já em execução: o primeiro recarregamento da aba continua necessário.

A lista de erros em `chrome://extensions/` também guarda erros anteriores: use **Clear all** depois de recarregar a extensão e a aba para verificar se aparece um erro novo.
