<BACKGROUND_INFORMATION>
O VOXA é uma plataforma de monetização onde fãs podem fazer perguntas pagas ou enviar apoio a influenciadores/criadores, com prazo crítico de resposta de 36 horas (senão ocorre reembolso). A plataforma combina uma UI/UX *premium*, contraste forte ("dark mode"), rodando sobre uma **Stack de Next.js Web App** somada a um **App Wrapper Expo/React Native** para mobile nativo.

Você está atuando no repositório `voxa`. O principal paradigma de desenvolvimento aqui utiliza os conceitos de *progressive disclosure* para documentação, portanto as especificações pesadas não estão visíveis por padrão nestas regras. Se achar necessário entender as vísceras para realizar sua tarefa, utilize as referências abaixo.
</BACKGROUND_INFORMATION>

<INSTRUCTIONS>
- Construa código moderno de Next.js 14.1+ utilizando App Router, TypeScript e Tailwind.
- Siga estritamente as restrições arquitetônicas documentadas.
- Consulte a documentação de negócio no diretório `/docs/` antes de alterar lógicas profundas, fluxo de pagamentos, e modelagens RLS de segurança (ver PROGRESSIVE DOCUMENT LOADING abaixo).
- Considere sempre a usabilidade *Mobile* na UI.
- Preserve a janela de contexto (*Context Budgeting*): seja cirúrgico ao invocar leitura de arquivos de documentação para evitar saturação, adotando a informatividade primária no lugar de ler artefatos inteiros desnecessariamente.
</INSTRUCTIONS>

<TOOL_GUIDANCE>
Use as definições de Progressive Document Loading de acordo com o tópico da solicitação do usuário:

# Progressive Document Loading

Arquivos-guia essenciais localizados no diretório `/docs/`:

1. Para criar ou alterar **Interfaces, Padrões, CSS Vars ou regras Mobile/Next.js**, leia OBRIGATORIAMENTE:
   `docs/architecture.md`
2. Para alterar regras rígidas via **Supabase, tabelas SQL, triggers e RLS Security Constraints**, leia:
   `docs/database.md`  *(Não recrie cálculo no frontend que precise habitar em SQL)*
3. Para tocar no fluxo sensível de **Pagamentos Mercado Pago, HMAC, Reembolso Pós-36h (Cron) e Webhooks**, leia as regras em:
   `docs/workflows.md`
4. Para implementar ou planejar testes, consulte a estratégia planejada em:
   `docs/testing_strategy.md`

Caso precise de visão geral das tabelas de banco, o source of truth habita os arquivos modulares em `database/schemas/` (ordem: 00→06).
</TOOL_GUIDANCE>

<OUTPUT_DESCRIPTION>
Ao redigir e gerar os trechos de modificações, mantenha código legível, fortemente tipado usando TS e com comentários explicativos (em português) acima de lógicas ou dependências complexas. Evite modificação massiva injustificada nos schemas de banco de dados e UI sem consenso com os relatórios já existentes na documentação.
</OUTPUT_DESCRIPTION>
