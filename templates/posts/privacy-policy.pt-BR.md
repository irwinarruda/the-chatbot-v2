# Política de Privacidade

*Última atualização: Novembro 2026*

Bem-vindo ao **The Chatbot**. Valorizamos sua privacidade e estamos comprometidos em proteger seus dados pessoais. Esta Política de Privacidade explica como coletamos, usamos e compartilhamos informações sobre você quando utiliza nossos serviços via WhatsApp e pelo aplicativo web em [the-chatbot.irwinarruda.com](https://the-chatbot.irwinarruda.com).

## 1. Informações que Coletamos

Ao interagir com nosso serviço, coletamos os seguintes tipos de informações:

- **Dados de Identidade**: Seu nome e número de telefone, conforme fornecido pelo WhatsApp, e o endereço de e-mail da sua Conta Google.
- **Dados de Autenticação**: Tokens de acesso do Google (Access e Refresh Tokens) para autenticar você e acessar serviços do Google em seu nome.
- **Dados de Comunicação**: O histórico de suas mensagens enviadas ao The Chatbot.
- **Dados de Uso**: IDs das planilhas do Google Sheets que você configura para controle de despesas.

## 2. Como Usamos Suas Informações

Utilizamos suas informações para:

- Fornecer o serviço de conversação via WhatsApp e pelo aplicativo web.
- Autenticar sua identidade usando Contas Google.
- Gerenciar seus dados financeiros em suas próprias planilhas do Google mediante sua solicitação.
- Processar suas mensagens usando Inteligência Artificial para fornecer respostas relevantes.

## 3. Provedores de Serviço Terceiros

Compartilhamos dados com provedores específicos para facilitar nosso serviço:

- **Meta (WhatsApp)**: Para envio e recebimento de mensagens.
- **Google**: Para autenticação e acesso às suas planilhas. Armazenamos tokens de forma segura para manter essa conexão.
- **Provedores de modelos de IA**: Para gerar respostas, enviamos o conteúdo da sua conversa a um provedor de modelos de IA. Isso inclui os dados da planilha necessários para responder ao seu pedido, como transações, categorias e saldos de contas. Nosso provedor padrão é a Z.ai. Se você escolher outro provedor nas suas configurações, suas conversas passam a ser processadas por ele. Consulte a política de dados do provedor para mais detalhes.
- **OpenAI**: Enviamos mensagens de voz para a OpenAI para transcrevê-las em texto.

## 4. Proteção, Retenção e Segurança de Dados

Seus dados, incluindo logs de chat e tokens de autenticação, são armazenados em nosso banco de dados. Mantemos essas informações enquanto sua conta existir, para preservar o contexto de suas conversas e garantir o funcionamento contínuo de serviços como o controle de despesas.

Protegemos dados sensíveis com estes mecanismos:

- **Criptografia em trânsito**: toda conexão entre você, o The Chatbot e o Google usa HTTPS (TLS).
- **Criptografia em repouso**: seus tokens de acesso e de atualização do Google são criptografados com AES-256-GCM antes de serem armazenados.
- **Acesso restrito**: somente a aplicação e seu mantenedor acessam o banco de dados de produção, e as chaves de acesso ficam fora do código-fonte.
- **Sessões protegidas**: o aplicativo web mantém você conectado com um cookie que scripts não conseguem ler (HttpOnly).
- **Acesso mínimo ao Google**: o The Chatbot só consegue abrir a planilha que você seleciona no seletor de arquivos do Google, e nenhum outro arquivo do seu Google Drive.

## 5. Seus Direitos

Você tem o direito de acessar, corrigir ou excluir seus dados pessoais. Você pode solicitar a exclusão de sua conta e de todos os dados associados diretamente através dos comandos do chatbot ou entrando em contato conosco. Você também pode revogar o acesso do The Chatbot à sua Conta Google a qualquer momento em [myaccount.google.com/permissions](https://myaccount.google.com/permissions).

## 6. Dados de Usuário do Google

O uso e a transferência de dados brutos ou derivados recebidos das APIs do Google Workspace aderirão à [Política de Dados do Usuário dos Serviços de API do Google](https://developers.google.com/terms/api-services-user-data-policy), incluindo os requisitos de Uso Limitado.

- Pedimos apenas acesso por arquivo (a permissão `drive.file`). Acessamos somente a planilha que você seleciona no seletor de arquivos do Google, e somente para ler e registrar seus dados financeiros a seu pedido.
- Não usamos dados de usuário obtidos pelas APIs do Google Workspace, incluindo o conteúdo das suas planilhas do Google, para desenvolver, melhorar ou treinar modelos generalizados de IA ou de aprendizado de máquina.
- Enviamos dados da planilha a um provedor de modelos de IA somente para produzir a resposta ou a ação que você pediu.
- Não vendemos dados de usuário do Google nem os usamos para publicidade.
