import type { ReactNode } from "react";
import "./PublicPages.css";

type Feature = {
  title: string;
  description: string;
};

type PolicySection = {
  title: string;
  intro?: string;
  items?: string[];
  body?: string;
};

const welcomeFeatures: Feature[] = [
  {
    title: "Controle Financeiro",
    description:
      "Acompanhe despesas e fluxo de caixa automaticamente no Google Sheets.",
  },
  {
    title: "Integração Segura",
    description: "Seus dados estão protegidos com a Autenticação do Google.",
  },
  {
    title: "Sempre Disponível",
    description: "Interaja naturalmente a qualquer hora, em qualquer lugar.",
  },
];

const privacySections: PolicySection[] = [
  {
    title: "1. Informações que Coletamos",
    intro:
      "Ao interagir com nosso serviço, coletamos os seguintes tipos de informações:",
    items: [
      "Dados de Identidade: Seu nome e número de telefone, conforme fornecido pelo WhatsApp.",
      "Dados de Autenticação: Tokens de acesso do Google (Access e Refresh Tokens) para autenticar você e acessar serviços do Google em seu nome.",
      "Dados de Comunicação: O histórico de suas mensagens enviadas ao TheChatbot.",
      "Dados de Uso: IDs das planilhas do Google Sheets que você configura para controle de despesas.",
    ],
  },
  {
    title: "2. Como Usamos Suas Informações",
    intro: "Utilizamos suas informações para:",
    items: [
      "Fornecer o serviço de conversação via WhatsApp.",
      "Autenticar sua identidade usando Contas Google.",
      "Gerenciar seus dados financeiros em suas próprias planilhas do Google mediante sua solicitação.",
      "Processar suas mensagens usando Inteligência Artificial para fornecer respostas relevantes.",
    ],
  },
  {
    title: "3. Provedores de Serviço Terceiros",
    intro:
      "Compartilhamos dados com provedores específicos para facilitar nosso serviço:",
    items: [
      "Meta (WhatsApp): Para envio e recebimento de mensagens.",
      "Google: Para autenticação e acesso às suas planilhas. Armazenamos tokens de forma segura para manter essa conexão.",
      "OpenAI: Enviamos o conteúdo das mensagens para a OpenAI para gerar respostas inteligentes. Consulte a política de dados da OpenAI para mais detalhes.",
    ],
  },
  {
    title: "4. Retenção e Segurança de Dados",
    body: "Seus dados, incluindo logs de chat e tokens de autenticação, são armazenados com segurança em nosso banco de dados. Mantemos essas informações para preservar o contexto de suas conversas e garantir o funcionamento contínuo de serviços como o controle de despesas.",
  },
  {
    title: "5. Seus Direitos",
    body: "Você tem o direito de acessar, corrigir ou excluir seus dados pessoais. Você pode solicitar a exclusão de sua conta e de todos os dados associados diretamente através dos comandos do chatbot ou entrando em contato conosco.",
  },
];

function PublicPageShell({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <main className="public-page-shell">
      <section
        className={`public-page-card${wide ? " public-page-card--wide" : ""}`}
      >
        {children}
      </section>
    </main>
  );
}

function Logo() {
  return (
    <img
      className="public-page-logo"
      src="/logo.svg"
      alt="The Chatbot"
    />
  );
}

export function WelcomePage() {
  return (
    <PublicPageShell>
      <Logo />
      <h1 className="public-page-title">The Chatbot</h1>
      <p className="public-page-subtitle">Seu assistente pessoal inteligente</p>
      <div className="public-page-panel">
        <p>
          <strong>The Chatbot</strong> é um agente conversacional versátil
          projetado para ajudar você a organizar sua vida diretamente do
          WhatsApp.
        </p>
        <ul className="public-page-features">
          {welcomeFeatures.map((feature) => (
            <li className="public-page-feature" key={feature.title}>
              <span className="public-page-feature-icon">✓</span>
              <span>
                <strong>{feature.title}</strong>: {feature.description}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="public-page-footer">Envie uma mensagem para começar.</div>
    </PublicPageShell>
  );
}

export function PrivacyPolicyPage() {
  return (
    <PublicPageShell wide>
      <div className="public-page-policy">
        <h1 className="public-page-policy-title">Política de Privacidade</h1>
        <span className="public-page-policy-updated">
          Última atualização: Novembro 2025
        </span>
        <p>
          Bem-vindo ao <strong>TheChatbot</strong>. Valorizamos sua privacidade
          e estamos comprometidos em proteger seus dados pessoais. Esta Política
          de Privacidade explica como coletamos, usamos e compartilhamos
          informações sobre você quando utiliza nossos serviços via WhatsApp.
        </p>
        {privacySections.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            {section.intro ? <p>{section.intro}</p> : null}
            {section.items ? (
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
            {section.body ? <p>{section.body}</p> : null}
          </section>
        ))}
        <section>
          <h2>6. Dados de Usuário do Google</h2>
          <p>
            O uso das informações recebidas das APIs do Google aderirá à{" "}
            <a
              className="public-page-link"
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noreferrer"
            >
              Política de Dados do Usuário dos Serviços de API do Google
            </a>
            , incluindo os requisitos de Uso Limitado.
          </p>
        </section>
        <div className="public-page-footer">
          &copy; 2025 TheChatbot. Todos os direitos reservados.
        </div>
      </div>
    </PublicPageShell>
  );
}

export function ThankYouPage() {
  return (
    <PublicPageShell>
      <Logo />
      <h1 className="public-page-title">Obrigado!</h1>
      <p className="public-page-subtitle">Conta conectada com sucesso</p>
      <div className="public-page-panel">
        <p>
          Bem-vindo ao <strong>TheChatbot</strong>!
        </p>
        <p>
          Obrigado pela confiança. Sua conta Google foi autenticada com sucesso
          e você já está pronto para explorar todos os recursos.
        </p>
      </div>
      <div className="public-page-footer">
        Você já pode fechar esta janela com segurança.
      </div>
    </PublicPageShell>
  );
}

export function AlreadySignedInPage() {
  return (
    <PublicPageShell>
      <Logo />
      <h1 className="public-page-title">Já está conectado!</h1>
      <p className="public-page-subtitle">Sua sessão do Google está ativa</p>
      <div className="public-page-badge">
        <span>●</span>
        <span>Conectado</span>
      </div>
      <div className="public-page-panel">
        <p>
          Bem-vindo de volta ao <strong>TheChatbot</strong>!
        </p>
        <p>
          Detectamos uma autenticação existente para sua conta Google. Sua
          sessão foi atualizada automaticamente e você está pronto para
          continuar.
        </p>
      </div>
      <div className="public-page-footer">
        Você já pode fechar esta janela com segurança.
      </div>
    </PublicPageShell>
  );
}
