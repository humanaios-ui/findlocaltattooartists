export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface NotificationProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<{ id: string }>;
}

export class ConsoleNotificationProvider implements NotificationProvider {
  readonly name = "console";

  async send(message: EmailMessage): Promise<{ id: string }> {
    const id = `console-${crypto.randomUUID()}`;
    console.info(`[email:${id}] to=${message.to} subject=${message.subject}`);
    return { id };
  }
}

export class ResendNotificationProvider implements NotificationProvider {
  readonly name = "resend";

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<{ id: string }> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    if (!response.ok) {
      throw new Error(`Resend rejected the email (${response.status}).`);
    }
    const body = (await response.json()) as { id?: string };
    return { id: body.id ?? "resend" };
  }
}

export class PostmarkNotificationProvider implements NotificationProvider {
  readonly name = "postmark";

  constructor(
    private readonly token: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<{ id: string }> {
    const response = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": this.token,
      },
      body: JSON.stringify({
        From: this.from,
        To: message.to,
        Subject: message.subject,
        HtmlBody: message.html,
        TextBody: message.text,
        MessageStream: "outbound",
      }),
    });
    if (!response.ok) {
      throw new Error(`Postmark rejected the email (${response.status}).`);
    }
    const body = (await response.json()) as { MessageID?: string };
    return { id: body.MessageID ?? "postmark" };
  }
}

export function createNotificationProvider(env: {
  RESEND_API_KEY?: string;
  POSTMARK_SERVER_TOKEN?: string;
  EMAIL_FROM?: string;
}): NotificationProvider {
  const from = env.EMAIL_FROM?.trim() ?? "";
  if (env.RESEND_API_KEY?.trim()) {
    if (!from) throw new Error("EMAIL_FROM is required when RESEND_API_KEY is set.");
    return new ResendNotificationProvider(env.RESEND_API_KEY.trim(), from);
  }
  if (env.POSTMARK_SERVER_TOKEN?.trim()) {
    if (!from) throw new Error("EMAIL_FROM is required when POSTMARK_SERVER_TOKEN is set.");
    return new PostmarkNotificationProvider(env.POSTMARK_SERVER_TOKEN.trim(), from);
  }
  return new ConsoleNotificationProvider();
}
